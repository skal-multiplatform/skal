// Skal bridge. Owns the shared 2 MiB region, drains the op ring once
// per frame, fans changes into NodeState's reactive notifiers.
//
// Two architectural decisions:
//
//   1. **Per-frame drain, single-pass.** pumpOps reads the published
//      op-write position once at start, then iterates ops linearly
//      until that mark. Bun's commit() bumps writePos AFTER all of
//      this frame's ops are written, so the writePos we see is a
//      consistent end-of-frame snapshot.
//
//   2. **Coalesced notify at end of drain.** Each op mutates the
//      node's plain-field state and flags it `coldDirty` or
//      `hotDirty`. Tree-shape ops (INSERT_BEFORE etc.) flag the
//      affected parent as `coldDirty`. At end of drain we iterate the
//      touched set and fire the right notifier exactly once per node.
//      Without this, a 200-tweet batch with 1200 prop writes would
//      call notifyListeners 1200 times in the same frame — Flutter
//      coalesces rebuilds to next frame anyway, but the per-notify
//      cost (linked-list walk over listeners) still adds up.
//
// Performance:
//
//   • ByteData over the FFI-backed Uint8List — getInt32 in AOT Dart
//     resolves to a single LDR with bswap if needed.
//   • The decode loop is straight-line Dart with a single switch.
//     No allocation per op except for string ops (forced by the
//     UTF-8 decode, which has to produce a Dart String).
//   • Touched set is a `Set<int>` — for small dirty counts a
//     LinkedHashSet is fine.

import 'dart:collection';
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../skal_ffi.dart';
import 'node_state.dart';
import 'registry.dart';
import 'wire.dart';

class SkalBridge {
  /// FFI handle to the bun runtime — used to dispatch events back to
  /// JS, and exposed so callers can run extra eval probes from outside.
  final Skal skal;

  /// ByteData view of the shared bridge memory. Same memory bun sees
  /// from JS via JSObjectMakeArrayBufferWithBytesNoCopy. ByteData
  /// gives us aligned typed-load/store APIs; the Uint8List underneath
  /// (`skal.bridge`) is used for bulk byte copies (string decode).
  final ByteData _data;
  final Uint8List _bytes;

  /// Last opSeq we drained. If the producer hasn't moved past it,
  /// pumpOps early-returns without walking the ring.
  int _lastOpSeq = 0;

  /// Byte offset (relative to the op ring base) up to which we've
  /// drained. JS auto-commits mid-batch as the ring fills, bumping
  /// opSeq and advancing writePos without resetting; we resume the
  /// drain from this checkpoint so each op is consumed exactly once.
  /// When JS resets writePos to 0 (overflow path or end-of-batch), we
  /// detect the regression and snap this back to 0 too.
  int _lastDrainedWritePos = 0;

  /// Heap-side overflow queue for events that didn't fit in the
  /// 1 MiB event ring. The other three rings use JS-side spin-wait
  /// because their producer (the bun worker) can safely block; the
  /// event ring's producer is the Flutter UI thread, so blocking is
  /// catastrophic. Instead: if the ring would wrap onto an undrained
  /// event, append to this queue and flush on the next Ticker tick
  /// (after JS has had a chance to drain). Bounded only by Dart heap.
  ///
  /// Records are stored as 5 consecutive ints — [eventKind, argType,
  /// handlerId, argValueI32, argHeapOffset, …repeat…] — mirroring the
  /// in-ring event layout. A single Queue<int> avoids per-record
  /// object allocation under stress. The argHeapOffset slot is 0 for
  /// non-string events (kept uniform so the flush loop has one shape).
  final Queue<int> _eventOverflow = Queue<int>();

  /// One state per JS-created node, keyed by JS node id (dense small
  /// ints). Plain Map<int,NodeState> — primitive int keys avoid
  /// boxing in Dart AOT.
  final Map<int, NodeState> nodes = <int, NodeState>{};

  /// Per-drain scratch — node ids that had ANY mutation (cold or hot).
  /// Cleared at start of drain; iterated at end of drain to fire the
  /// appropriate notifier(s) per touched node. A field (not a local)
  /// so the pumpOps hot path pays zero allocation per drain.
  final Set<int> _touched = <int>{};

  /// Name dictionary for custom-widget dispatch. Populated by
  /// [opDeclareName] ops emitted lazily by the JS encoder the first
  /// time it sees a given name (widget name, custom prop key, or
  /// custom event name). All subsequent custom-prop / custom-handler /
  /// wtCustom-create ops carry just the 32-bit hash; the drain
  /// resolves the hash back to a string via this map.
  ///
  /// FNV-1a 32-bit hashes. Collision probability across a few hundred
  /// names is negligible; if it ever bit us in production we'd switch
  /// to xxhash + 64-bit. For now FNV is good enough and trivial to
  /// implement on both sides.
  final Map<int, String> _nameDict = <int, String>{};

  /// Args accumulated by opMethodArg, keyed by callId, drained when
  /// the matching opInvokeMethod arrives. Most call sites have 0-1
  /// args; the map stays tiny in practice + nothing strands across
  /// drains since invoke + args ship in the same op batch.
  final Map<int, List<Object?>> _pendingMethodArgs = <int, List<Object?>>{};

  /// Active stream subscriptions, keyed by callId. opSubscribeStream
  /// adds an entry; the stream's `onDone` / `onError` callbacks remove
  /// it; opUnsubscribeStream cancels + removes. The bridge writes
  /// evStreamValue events per emission; on done/error it writes the
  /// terminal event and cleans up.
  final Map<int, StreamSubscription<Object?>> _streamSubscriptions =
      <int, StreamSubscription<Object?>>{};

  // ── Design system (set by opSetDesign from JS) ───────────────────
  /// 0 = material, 1 = cupertino, 2 = adaptive (resolved per platform
  /// in root.dart). The control builders branch on this.
  int designMode = 0;

  /// 0 = light, 1 = dark.
  int designBrightness = 0;

  /// Fires when opSetDesign changes either field — SkalApp rebuilds
  /// the MaterialApp theme + CupertinoTheme in response.
  final NodeNotifier designChanged = NodeNotifier();

  /// True when the active design system resolves to Cupertino.
  ///
  /// `designMode` 2 (adaptive) resolves to Cupertino on iOS / macOS and
  /// Material elsewhere; mode 1 is always Cupertino, mode 0 always
  /// Material. Single source of truth — the renderer (`root.dart`) and
  /// the imperative dialog API (`dialogs.dart`) both branch on this so a
  /// dialog never disagrees with the surrounding controls.
  ///
  /// Read as an init-time flag: the renderer caches the branch per node
  /// (`MemoizingListenableBuilder`) and nothing depends on it reactively,
  /// so switching Material ↔ Cupertino mid-app will not refresh
  /// already-built nodes. Set the mode once at startup.
  bool get isCupertino {
    switch (designMode) {
      case 1:
        return true;
      case 2:
        final p = defaultTargetPlatform;
        return p == TargetPlatform.iOS || p == TargetPlatform.macOS;
      default:
        return false;
    }
  }

  /// App-level RPC dispatcher for the root node — backs the imperative
  /// dialog API (skal/dialogs.dart). Held on the bridge (not just the
  /// node) so it survives a root-node recreation: `opCreateNode`
  /// re-attaches it whenever id 1 is (re)created.
  SkalMethodDispatcher? rootDispatcher;

  /// Latches true once any `<richText>` node is created. Gates the
  /// drain's pass-0 (richText child→parent rebuild propagation) so a
  /// tree that never uses richText skips that scan entirely — one
  /// bool test instead of a full `touched` walk every drain.
  bool _treeHasRichText = false;

  // ── Perf instrumentation (read by PerfHud) ───────────────────────
  int pumpAvgNs = 0;
  int pumpPeakNs = 0;
  int propWritesLastDrain = 0;
  int coldPropsTouchedLastDrain = 0;

  /// Sliding window of recent drain times for the rolling peak.
  /// Float64List (not Int64List) so this works on dart2js too — JS has
  /// no native int64 typed array. Float64 represents integer nanosecond
  /// counts losslessly up to 2^53 ns (~104 days), far above any plausible
  /// pump time. The peak read site rounds back to int.
  static const int _pumpPeakWindow = 60;
  final Float64List _pumpWindow = Float64List(_pumpPeakWindow);
  int _pumpWindowIdx = 0;
  int _pumpWindowFill = 0;

  /// Scratch for float-from-bits — same trick as the JS side
  /// (Float32Array + Uint32Array aliasing): write the i32 bit
  /// pattern, read the float interpretation back.
  final ByteData _f32Scratch = ByteData(4);

  /// Monotonic clock for pump timing. `DateTime.now()` is wall-clock —
  /// can jump backward under NTP correction or deep-sleep wakeup,
  /// which produces garbage in the EMA + sliding-window peak.
  final Stopwatch _pumpClock = Stopwatch()..start();

  // ── 64-bit accessor shims (web-safe) ───────────────────────────────
  //
  // `ByteData.getInt64` / `setInt64` aren't supported on dart2js (JS
  // has no native int64 type). We always go through these two-step
  // helpers — read low + high u32 halves separately and combine using
  // multiplication, not shifts (`<< 32` overflows int32 on web). Dart
  // `int` on web is the JS Number type — losslessly precise up to
  // 2^53, which is ~9e15. The opSeq counter ticks once per JS commit
  // batch (often 1 per frame); even at 1M batches/sec a session
  // would have to run for ~280 years to exhaust the safe range. The
  // tradeoff is one extra u32 load per pump vs. one missing API.
  static int _getU64(ByteData d, int offset) {
    final lo = d.getUint32(offset,     Endian.little);
    final hi = d.getUint32(offset + 4, Endian.little);
    return lo + hi * 0x100000000;
  }

  static void _setU64(ByteData d, int offset, int value) {
    final lo = value & 0xFFFFFFFF;
    // Floor-divide rather than `>> 32` so the high half is computed
    // through doubles on web. Dart `~/` on big ints/doubles works on
    // both platforms.
    final hi = (value ~/ 0x100000000) & 0xFFFFFFFF;
    d.setUint32(offset,     lo, Endian.little);
    d.setUint32(offset + 4, hi, Endian.little);
  }

  SkalBridge(this.skal)
      : _data = ByteData.sublistView(skal.bridge),
        _bytes = skal.bridge;

  /// Idempotent — ensures the root node (id 1) exists so SkalRoot can
  /// always mount even if the JS app forgot to create it. wtBox so
  /// the root is a transparent single-child passthrough; the App's
  /// outer container decides scrolling / layout shape.
  void ensureRoot() {
    nodes.putIfAbsent(kRootNodeId, () => NodeState(wtBox));
  }

  /// Drain new ops from the ring. Cheap when nothing is pending —
  /// a single u64 load + compare.
  void pumpOps() {
    // Flush any queued events first — they may carry a tap that
    // triggers ops to drain in this same tick, so getting them into
    // the ring before reading opSeq keeps the round-trip latency low.
    if (_eventOverflow.isNotEmpty) _flushEventOverflow();

    final seq = _getU64(_data, hOpSeq);
    if (seq == _lastOpSeq) return;

    final t0 = _pumpClock.elapsedMicroseconds;
    _drain();
    _lastOpSeq = seq;

    // Publish drained seq back to the JS side. JS spin-waits on this
    // value inside flushAndWaitForDrain to know we've caught up. The
    // companion hLastDrainedWritePos slot is reserved in the wire
    // format but currently unread on the JS side, so we don't bother
    // writing it.
    _setU64(_data, hLastDrainedSeq, seq);

    // EMA with α=1/8 — smooths jitter while staying responsive to
    // sudden bumps (e.g. a +1000-batch frame visibly nudges the avg).
    final dt = (_pumpClock.elapsedMicroseconds - t0) * 1000; // µs→ns
    pumpAvgNs = pumpAvgNs == 0 ? dt : (pumpAvgNs * 7 + dt) ~/ 8;

    // Rolling peak: write to next slot, max across live entries.
    _pumpWindow[_pumpWindowIdx] = dt.toDouble();
    _pumpWindowIdx = (_pumpWindowIdx + 1) % _pumpPeakWindow;
    if (_pumpWindowFill < _pumpPeakWindow) _pumpWindowFill++;
    double peak = 0.0;
    for (var i = 0; i < _pumpWindowFill; i++) {
      final v = _pumpWindow[i];
      if (v > peak) peak = v;
    }
    pumpPeakNs = peak.toInt();
  }

  /// Decode loop — extracted so pumpOps stays small and the inner
  /// hot path lives in its own function (helps Dart's AOT inliner).
  void _drain() {
    final data = _data;
    final ns = nodes;
    final touched = _touched;
    touched.clear();

    // Clamp defensively — a corrupted writePos (e.g. wild pointer write
    // from a misbehaving JS host) must not let the decoder read past the
    // op ring into the string heap.
    final writePos = data.getInt32(hOpWritePos, Endian.little).clamp(0, kOpRingSize);

    // Detect a JS-side wrap. flushAndWaitForDrain spin-waits for us to
    // catch up THEN resets opWritePos32 to 0; the next publishProgress
    // exposes a writePos lower than our checkpoint, which is the signal
    // that the ring has wrapped and we should resume the drain from
    // offset 0. (End-of-batch commit no longer resets, so this only
    // fires on the overflow path — see bridge.js `commit()`.)
    if (writePos < _lastDrainedWritePos) {
      _lastDrainedWritePos = 0;
    }

    final opEnd = kOpRingOffset + writePos;
    int p = kOpRingOffset + _lastDrainedWritePos;
    int propWrites = 0;

    while (p < opEnd) {
      // Opcode is byte 0 of the 4-byte opcode field; high 3 bytes
      // are written as zero by the JS encoder.
      final opcode = data.getUint8(p);
      final a = data.getInt32(p + 4, Endian.little);
      final b = data.getInt32(p + 8, Endian.little);
      final c = data.getInt32(p + 12, Endian.little);

      switch (opcode) {
        case opCreateNode:
          ns[a] = NodeState(b);
          // JS (re)creates the root node id at startup — re-attach the
          // app-level dispatcher so the imperative dialog API survives.
          if (a == kRootNodeId) ns[a]?.methodDispatcher = rootDispatcher;
          // Latch — enables the richText pass-0 in the coalescer.
          if (b == wtRichText) _treeHasRichText = true;
          break;

        case opCreateCustomNode:
          // a = nodeId, b = nameHash (resolved via _nameDict, which was
          // populated by a prior opDeclareName op for this same hash).
          final node = NodeState(wtCustom);
          node.customWidgetName = _nameDict[b];
          ns[a] = node;
          break;

        case opRemoveNode:
          final victim = ns[a];
          if (victim != null) {
            final rmParent = ns[victim.parent];
            if (rmParent != null && rmParent.type == wtAnimatedList) {
              // ANIMATION.md §6 — deferred teardown. Detach the child
              // from the animated list (the data model is now correct)
              // but keep its NodeState + subtree ALIVE so the host can
              // animate the exit. `_SkalAnimatedList` calls
              // `finalizeLeavingNode` once the exit finishes.
              final rmIdx = rmParent.childIndexOf(a);
              if (rmIdx >= 0) {
                rmParent.removeChildAt(rmIdx);
                (rmParent.leavingChildren ??= <int, int>{})[a] = rmIdx;
                rmParent.coldDirty = true;
                touched.add(victim.parent);
              } else {
                _removeSubtree(a, ns);
              }
            } else {
              _removeSubtree(a, ns);
            }
          }
          break;

        case opInsertBefore:
          // Insert-before-self ("X before X") is a no-op — X stays
          // put. A reconciler may emit it for an adjacent swap;
          // without this the detach-then-reinsert below would fail to
          // find the (just-detached) anchor and append X instead.
          if (b == c) break;
          final parentNode = ns[a];
          final movingNode = ns[b];
          // Both parent and moving node must exist — without the moving
          // guard a dangling child id would pollute parent.children, and
          // a subsequent build would lookup ns[id] and find null.
          if (parentNode != null && movingNode != null) {
            // Auto-detach: Solid's keyed-list reorder relies on DOM-style
            // insertNode semantics (moving by re-inserting). The bridge
            // has to enforce the "appears in at most one parent" invariant
            // ourselves; without this, reorders leave the moving id
            // duplicated in old + new parents. childIndexOf is O(1) via
            // the parallel _childIdx map.
            if (movingNode.parent != 0) {
              final oldParent = ns[movingNode.parent];
              if (oldParent != null) {
                final oldIdx = oldParent.childIndexOf(b);
                if (oldIdx >= 0) {
                  oldParent.removeChildAt(oldIdx);
                  oldParent.coldDirty = true;
                  touched.add(movingNode.parent);
                }
              }
            }
            final anchor = c;
            if (anchor == 0) {
              parentNode.appendChild(b);
            } else {
              final idx = parentNode.childIndexOf(anchor);
              if (idx >= 0) {
                parentNode.insertChildAt(idx, b);
              } else {
                // Anchor not yet a child of this parent — defensive
                // fallback to append. Not observed in practice with
                // Solid's universal renderer (which always inserts
                // anchors before referring to them), but a misbehaving
                // renderer would otherwise lose ops here.
                parentNode.appendChild(b);
              }
            }
            parentNode.coldDirty = true;
            touched.add(a);
            movingNode.parent = a;
          }
          break;

        // ── Cold props ──────────────────────────────────────────────
        case opSetPropU32:
          final node = ns[a];
          if (node != null) {
            node.props[b] = c;
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
            // Stack-positioning props (top/right/bottom/left) live on
            // the CHILD but are consumed by the parent `<stack>`'s
            // builder, which wraps the child in a Positioned. Re-dirty
            // the parent so the stack rebuilds with the new offset.
            if (b >= propTop && b <= propLeft) {
              final parent = ns[node.parent];
              if (parent != null) {
                parent.coldDirty = true;
                touched.add(node.parent);
              }
            }
          }
          break;

        case opSetPropF32:
          final node = ns[a];
          if (node != null) {
            node.propsF[b] = _bitsToF32(c);
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
          }
          break;

        case opSetPropStr:
          final node = ns[a];
          if (node != null) {
            // Wire format: b = (key << 24) | (offset & 0xFFFFFF), c = length.
            final key = (b >> 24) & 0xFF;
            final offset = b & 0xFFFFFF;
            final length = c;
            node.propsStr[key] = _readString(kStringHeapOff + offset, length);
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
          }
          break;

        case opSetText:
          final node = ns[a];
          if (node != null) {
            node.text = _readString(kStringHeapOff + b, c);
            node.coldDirty = true;
            touched.add(a);
          }
          break;

        case opBindHandler:
          final node = ns[a];
          if (node != null) {
            if (b == evClick) {
              node.onClickHandlerId = c;
            } else if (b == evChange) {
              node.onChangeHandlerId = c;
            } else if (b == evLongPress) {
              node.onLongPressHandlerId = c;
            } else if (b == evDoubleTap) {
              node.onDoubleTapHandlerId = c;
            } else if (b == evSubmit) {
              node.onSubmitHandlerId = c;
            } else if (b == evReorder) {
              node.onReorderHandlerId = c;
            } else if (b == evNavPop) {
              node.onPopHandlerId = c;
            } else if (b == evPanStart) {
              node.onPanStartHandlerId = c;
            } else if (b == evPanUpdate) {
              node.onPanUpdateHandlerId = c;
            } else if (b == evPanEnd) {
              node.onPanEndHandlerId = c;
            } else if (b == evScaleStart) {
              node.onScaleStartHandlerId = c;
            } else if (b == evScaleUpdate) {
              node.onScaleUpdateHandlerId = c;
            } else if (b == evScaleEnd) {
              node.onScaleEndHandlerId = c;
            } else if (b == evRefresh) {
              node.onRefreshHandlerId = c;
            } else if (b == evDismiss) {
              node.onDismissHandlerId = c;
            } else if (b == evDrop) {
              node.onDropHandlerId = c;
            } else if (b == evHover) {
              node.onHoverHandlerId = c;
            } else if (b == evKey) {
              node.onKeyHandlerId = c;
            }
            node.coldDirty = true;
            touched.add(a);
          }
          break;

        // Pull-to-refresh completion — JS finished refreshing; resolve
        // the Future the host's RefreshIndicator is awaiting so the
        // spinner retracts. No rebuild needed (the new data already
        // arrived via the ops in this same drain).
        case opCompleteRefresh:
          ns[a]?.refreshCompleter?.complete();
          ns[a]?.refreshCompleter = null;
          break;

        // ── Custom-widget machinery ─────────────────────────────────
        //
        // Wire shape for these is the same 16-byte op as built-ins,
        // but the "key" arg is a 32-bit name hash that resolves to a
        // string via _nameDict (populated by opDeclareName).

        case opDeclareName:
          // a = nameHash, b = nameHeapOffset, c = nameHeapLen.
          // Dictionary entries persist for the lifetime of the bridge;
          // names are uniqued + interned on the JS side so each hash
          // is declared exactly once.
          _nameDict[a] = _readString(kStringHeapOff + b, c);
          break;

        case opSetCustomPropU32:
          final node = ns[a];
          final name = _nameDict[b];
          if (node != null && name != null) {
            node.setCustomPropU32(name, c);
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
          }
          break;

        case opSetCustomPropF32:
          final node = ns[a];
          final name = _nameDict[b];
          if (node != null && name != null) {
            node.setCustomPropF32(name, _bitsToF32(c));
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
          }
          break;

        case opSetCustomPropStr:
          // Wire format: b = nameHash, c = (offset << 8) | length.
          // Value length is capped at 255 bytes — see PROP_PLAN /
          // wire.dart comment for the rationale. Use enum-keyed
          // opSetPropStr for longer values.
          final node = ns[a];
          final name = _nameDict[b];
          if (node != null && name != null) {
            final offset = (c >> 8) & 0xFFFFFF;
            final length = c & 0xFF;
            node.setCustomPropStr(
              name,
              _readString(kStringHeapOff + offset, length),
            );
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
          }
          break;

        case opBindCustomHandler:
          // Named handlers — like opBindHandler but the event name is
          // a string ("onTap", "onCameraMove", ...) instead of an
          // evClick / evChange enum. The adapter on the Flutter side
          // fires `bridge.dispatchEvent(handlerId)` when the underlying
          // widget's matching callback fires.
          final node = ns[a];
          final name = _nameDict[b];
          if (node != null && name != null) {
            node.setCustomHandler(name, c);
            node.coldDirty = true;
            touched.add(a);
          }
          break;

        case opMethodArg:
          // a = callId, b = argType (low byte) | (length << 8) for
          // strings, c = argValueI32 or string heap offset. Args
          // accumulate in a callId-keyed buffer until the matching
          // opInvokeMethod drains them. Order matters — positional
          // args in declaration order on the controller method.
          final args = _pendingMethodArgs.putIfAbsent(a, () => []);
          final argType = b & 0xFF;
          switch (argType) {
            case eventArgI32:
              args.add(c);
              break;
            case eventArgF32:
              args.add(_bitsToF32(c));
              break;
            case eventArgBool:
              args.add(c != 0);
              break;
            case eventArgStr:
              // String layout: b's upper 24 bits hold the length
              // (max ~16M — bounded in practice by the JS string
              // heap capacity, ~768 KiB), c holds the full 32-bit
              // offset into the JS-write heap.
              final length = (b >> 8) & 0xFFFFFF;
              final offset = c;
              args.add(_readString(kStringHeapOff + offset, length));
              break;
            default:
              args.add(null);
          }
          break;

        case opInvokeMethod:
          // a = nodeId, b = methodNameHash, c = callId. Drain the
          // pending arg list (or empty for 0-arg methods), look up
          // the node's dispatcher, invoke. Write reply or error to
          // the event ring under callId.
          final node = ns[a];
          final methodName = _nameDict[b];
          final args = _pendingMethodArgs.remove(c) ?? const <Object?>[];
          if (node == null) {
            _writeMethodError(c, 'skal RPC: no such node id ($a)');
            break;
          }
          if (methodName == null) {
            _writeMethodError(c,
                'skal RPC: unknown method name hash (0x${b.toRadixString(16)})');
            break;
          }
          final dispatcher = node.methodDispatcher;
          if (dispatcher == null) {
            _writeMethodError(c,
                'skal RPC: no method dispatcher on node $a — host not '
                'mounted yet, or this widget isn\'t a host-pattern target');
            break;
          }
          try {
            final result = dispatcher(methodName, args);
            if (result is Stream<Object?>) {
              // One-shot invoke can't return a stream — that's a
              // subscribe-shaped operation. Tell the dev to use the
              // $-suffixed JSX form (which emits opSubscribeStream
              // instead). Cancel the inadvertent listen so we don't
              // leak.
              _writeMethodError(c,
                  'skal RPC: $methodName returns Stream — use '
                  '`ref.$methodName\$(cb)` to subscribe '
                  '(callback last; returns an unsubscribe fn)');
            } else if (result is Future<Object?>) {
              // Async — write the reply when the future resolves.
              // Capture callId in the closure; bridge can keep going.
              final callId = c;
              final mName = methodName;
              result.then(
                (value) => _writeMethodReply(callId, value),
                onError: (e, _) => _writeMethodError(callId,
                    'skal RPC: $mName threw (async): $e'),
              );
            } else {
              _writeMethodReply(c, result);
            }
          } catch (e) {
            _writeMethodError(c, 'skal RPC: $methodName threw: $e');
          }
          break;

        case opSubscribeStream:
          // a = nodeId, b = methodNameHash, c = callId. Args drain the
          // same way as opInvokeMethod (via _pendingMethodArgs). The
          // dispatcher MUST return a Stream<T>; we .listen and write
          // each emission via evStreamValue + the same typed-arg
          // encoding. Stream done/error fire terminal events.
          final node = ns[a];
          final methodName = _nameDict[b];
          final args = _pendingMethodArgs.remove(c) ?? const <Object?>[];
          if (node == null) {
            _writeStreamError(c, 'skal stream: no such node id ($a)');
            break;
          }
          if (methodName == null) {
            _writeStreamError(c,
                'skal stream: unknown method name hash '
                '(0x${b.toRadixString(16)})');
            break;
          }
          final dispatcher = node.methodDispatcher;
          if (dispatcher == null) {
            _writeStreamError(c,
                'skal stream: no method dispatcher on node $a — host '
                'not mounted yet');
            break;
          }
          try {
            final result = dispatcher(methodName, args);
            if (result is! Stream<Object?>) {
              _writeStreamError(c,
                  'skal stream: $methodName did not return a Stream '
                  '(got ${result.runtimeType}). Use `ref.$methodName()` '
                  'for one-shot RPC instead of `.$methodName\$(cb)`.');
              break;
            }
            final callId = c;
            final sub = result.listen(
              (value) => _writeStreamValue(callId, value),
              onError: (e, _) => _writeStreamError(callId,
                  'skal stream: $methodName errored: $e'),
              onDone: () {
                _writeStreamDone(callId);
                _streamSubscriptions.remove(callId);
              },
              cancelOnError: false,
            );
            _streamSubscriptions[callId] = sub;
          } catch (e) {
            _writeStreamError(c, 'skal stream: $methodName threw: $e');
          }
          break;

        case opUnsubscribeStream:
          // a = callId. JS-initiated cancellation (e.g. dev called
          // unsub() or component unmounted). Cancel the Dart-side
          // subscription if it's still active.
          final sub = _streamSubscriptions.remove(a);
          if (sub != null) {
            sub.cancel();
          }
          break;

        // ── Hot props ───────────────────────────────────────────────
        // Mutate the plain field, flag hotDirty, add to touched. End-of-
        // drain coalesces N hot-prop writes on the same node into ONE
        // hot.notify() call. Only the Transform/Opacity wrapper listens
        // on `hot` — the surrounding cached widget tree never sees it.
        case opSetOpacity:
          final node = ns[a];
          if (node != null) {
            node.opacity = _bitsToF32(c);
            node.hotDirty = true;
            touched.add(a);
          }
          break;
        case opSetTranslationX:
          final node = ns[a];
          if (node != null) {
            node.translationX = _bitsToF32(c);
            node.hotDirty = true;
            touched.add(a);
          }
          break;
        case opSetTranslationY:
          final node = ns[a];
          if (node != null) {
            node.translationY = _bitsToF32(c);
            node.hotDirty = true;
            touched.add(a);
          }
          break;
        case opSetScaleX:
          final node = ns[a];
          if (node != null) {
            node.scaleX = _bitsToF32(c);
            node.hotDirty = true;
            touched.add(a);
          }
          break;
        case opSetScaleY:
          final node = ns[a];
          if (node != null) {
            node.scaleY = _bitsToF32(c);
            node.hotDirty = true;
            touched.add(a);
          }
          break;
        case opSetRotationZ:
          final node = ns[a];
          if (node != null) {
            node.rotationZ = _bitsToF32(c);
            node.hotDirty = true;
            touched.add(a);
          }
          break;

        case opSetDesign:
          // Global, not node-scoped — a = mode, b = brightness.
          designMode = a;
          designBrightness = b;
          designChanged.notify();
          break;
      }

      p += 16;
    }

    // ── Coalesced notifies — one fan-out per touched node per channel ─
    // Hot and cold are independent: a frame can hit one, the other, or
    // both. Tree-shape ops fall into cold (the parent's cached widget
    // tree needs to invalidate to re-emit children).
    // Pass 0 — `<richText>` reactivity. A richText absorbs each child
    // `<text>` into a TextSpan; the child is never its own widget, so
    // a dirty child must rebuild the parent. Promote each such parent
    // into the `touched` set + mark it cold-dirty so the coalescing
    // loop below notifies it EXACTLY ONCE — no per-child or
    // parent+child double rebuild. `richTextParents` is lazily
    // allocated, so a richText-using app with no dirty spans this
    // drain still pays nothing; `_treeHasRichText` skips the scan
    // outright for an app that never uses richText.
    if (_treeHasRichText) {
      List<int>? richTextParents;
      for (final id in touched) {
        final node = ns[id];
        if (node == null || !node.coldDirty) continue;
        final parent = ns[node.parent];
        if (parent != null && parent.type == wtRichText) {
          (richTextParents ??= <int>[]).add(node.parent);
        }
      }
      if (richTextParents != null) {
        for (final pid in richTextParents) {
          ns[pid]?.coldDirty = true;
        }
        touched.addAll(richTextParents);
      }
    }

    int coldCount = 0;
    for (final id in touched) {
      final node = ns[id];
      if (node == null) continue;
      if (node.coldDirty) {
        node.coldDirty = false;
        coldCount++;
        node.cold.notify();
      }
      if (node.hotDirty) {
        node.hotDirty = false;
        node.hot.notify();
      }
    }

    propWritesLastDrain = propWrites;
    coldPropsTouchedLastDrain = coldCount;

    // Advance the drain checkpoint. JS reads this back to know when
    // it's safe to reset writePos to 0 (we've consumed everything) or
    // how far it must spin-wait for at near-overflow.
    _lastDrainedWritePos = writePos;
  }

  /// IEEE-754 bit pattern → double via aliased ByteData. Same trick
  /// as the JS encoder's Float32Array+Uint32Array aliasing.
  double _bitsToF32(int bits) {
    _f32Scratch.setInt32(0, bits, Endian.little);
    return _f32Scratch.getFloat32(0, Endian.little);
  }

  /// Decode `length` UTF-8 bytes from the string heap. Uses
  /// `Uint8List.sublistView` (zero-copy view, no allocation) feeding
  /// utf8.decode — the previous `_bytes.sublist(...)` was a real
  /// allocation per string op, hot enough on tweet-list mounts to
  /// show up in pump timings.
  String _readString(int offset, int length) {
    if (length == 0) return '';
    return utf8.decode(
      Uint8List.sublistView(_bytes, offset, offset + length),
      allowMalformed: false,
    );
  }

  /// Worklist-DFS scratch for [removeSubtree] — reused across calls.
  final List<int> _removeStack = <int>[];

  /// Remove `id` and all descendants from [nodes]; detach the subtree
  /// root from its parent's children. Worklist-DFS via [_removeStack]
  /// so we're bounded by heap, not thread stack, for deep trees.
  void _removeSubtree(int id, Map<int, NodeState> ns) {
    final root = ns[id];
    if (root == null) return;

    if (root.parent != 0) {
      final parent = ns[root.parent];
      if (parent != null) {
        final idx = parent.childIndexOf(id);
        if (idx >= 0) {
          parent.removeChildAt(idx);
          parent.coldDirty = true;
          _touched.add(root.parent);
        }
      }
    }

    final stack = _removeStack;
    stack.add(id);
    while (stack.isNotEmpty) {
      final cur = stack.removeLast();
      final node = ns[cur];
      if (node == null) continue;
      stack.addAll(node.childIds);
      // Deferred-teardown children (an `<animatedList>` mid-exit) are
      // detached from `childIds` but still alive — fold them into the
      // DFS so removing the list doesn't leak its leaving subtrees.
      final leaving = node.leavingChildren;
      if (leaving != null) stack.addAll(leaving.keys);
      node.clearChildren();
      ns.remove(cur);
      node.dispose();
    }
  }

  /// Finish the deferred teardown of an `<animatedList>` child whose
  /// exit animation has completed — called by `_SkalAnimatedList`
  /// (post-frame, after it has stopped rendering the child so the
  /// `SkalNode` element has already dropped its `cold` listener).
  /// ANIMATION.md §6.
  void finalizeLeavingNode(int childId) {
    final child = nodes[childId];
    if (child == null) return;
    nodes[child.parent]?.leavingChildren?.remove(childId);
    _removeSubtree(childId, nodes);
  }

  /// Diagnostic — peek at the current header so a stuck bridge (op
  /// ring never advances) can be eyeballed from logcat. Never called
  /// in the hot path.
  Map<String, int> debugReadHeader() => {
        'opSeq': _getU64(_data, hOpSeq),
        'opWritePos': _data.getInt32(hOpWritePos, Endian.little),
        'eventSeq': _getU64(_data, hEventSeq),
      };

  /// Write an event record into the event ring and wake the JS worker.
  /// Called from a button's onPressed.
  ///
  /// If the ring is full (next write would wrap onto an undrained
  /// event) the event is queued in `_eventOverflow` and will be flushed
  /// on the next pumpOps tick — by then JS has had time to drain. The
  /// UI thread never blocks on the JS side.
  void dispatchEvent(
    int handlerId, {
    int eventKind = evClick,
    int argType = eventArgVoid,
    int argValueI32 = 0,
    int argHeapOffset = 0,
  }) {
    if (handlerId == 0) return;

    // If we've spilled to overflow, keep spilling so events stay in
    // dispatch order. A drain will eventually clear both. Overflow
    // queue layout is 5 ints per event: kind, argType, handlerId,
    // argValue, argHeapOffset. The heap-offset slot is unused for
    // non-string events (just stored as 0) — kept uniform so the
    // flush loop has one shape to handle.
    if (_eventOverflow.isNotEmpty) {
      _eventOverflow.add(eventKind);
      _eventOverflow.add(argType);
      _eventOverflow.add(handlerId);
      _eventOverflow.add(argValueI32);
      _eventOverflow.add(argHeapOffset);
      skal.wakeJs();
      return;
    }

    final pos = _data.getInt32(hEventWritePos, Endian.little);
    final nextPos = (pos + 16) % kEventRingSize;
    final readPos = _data.getInt32(hEventReadPos, Endian.little);
    if (nextPos == readPos) {
      // Ring full — JS hasn't drained recent events yet (likely a
      // wedged worker or 18+ minutes of unprocessed input). Spill to
      // the heap-side queue so the producer (this thread) doesn't lose
      // the event or block.
      _eventOverflow.add(eventKind);
      _eventOverflow.add(argType);
      _eventOverflow.add(handlerId);
      _eventOverflow.add(argValueI32);
      _eventOverflow.add(argHeapOffset);
      skal.wakeJs();
      return;
    }

    final base = kEventRingOffset + pos;
    _data.setUint8(base + 0, eventKind);
    _data.setUint8(base + 1, argType);
    _data.setInt32(base + 4, handlerId, Endian.little);
    _data.setInt32(base + 8, argValueI32, Endian.little);
    _data.setInt32(base + 12, argHeapOffset, Endian.little);
    _data.setInt32(hEventWritePos, nextPos, Endian.little);
    final seq = _getU64(_data, hEventSeq);
    _setU64(_data, hEventSeq, seq + 1);
    skal.wakeJs();
  }

  /// Reply-heap cursor — bumped on each [_writeReplyString] call.
  /// Resets to 0 when an allocation would exceed capacity AND JS's
  /// read pointer (`hReplyHeapReadPos`) has caught up — see the
  /// wraparound branch below. Until then, we spin-wait (the same
  /// pattern the op ring + JS string heap use on overflow).
  int _replyHeapWritePos = 0;

  /// Write [s] into the reply heap (Dart-write, JS-read) as UTF-8.
  /// Returns the byte offset (into the reply heap) + the byte length.
  /// Caller packs these into the event record's argValueI32 (length)
  /// and argHeapOffset (offset) slots.
  ///
  /// Wraparound: when the write cursor reaches capacity we reset to 0,
  /// but only AFTER JS has read past all in-flight references. JS
  /// bumps `hReplyHeapReadPos` in the event drain whenever it consumes
  /// a Str/Json event; this method spin-waits (rare path) until JS has
  /// caught up before clobbering older bytes.
  (int offset, int length) _writeReplyString(String s) {
    final bytes = utf8.encode(s);
    final len = bytes.length;
    if (len > kReplyHeapSize) {
      // String alone exceeds the heap — rare; truncate.
      final truncated = bytes.sublist(0, kReplyHeapSize);
      _data.buffer
          .asUint8List(kReplyHeapOff, kReplyHeapSize)
          .setRange(0, kReplyHeapSize, truncated);
      _replyHeapWritePos = kReplyHeapSize;
      _data.setInt32(hReplyHeapWritePos, _replyHeapWritePos, Endian.little);
      return (0, kReplyHeapSize);
    }
    if (_replyHeapWritePos + len > kReplyHeapSize) {
      // Wraparound. JS may still be sitting on undrained events that
      // reference strings at offsets ∈ [readPos, writePos). Spin-wait
      // until JS catches up (readPos == writePos) before clobbering.
      // In practice this never fires in the demo workload — replies
      // get drained the same frame they're produced. Under heavy
      // stream emissions or burst RPC, the spin protects correctness
      // at the cost of a ms or two.
      final deadline = DateTime.now().millisecondsSinceEpoch + 50;
      while (DateTime.now().millisecondsSinceEpoch < deadline) {
        final readPos = _data.getInt32(hReplyHeapReadPos, Endian.little);
        if (readPos >= _replyHeapWritePos) break;
      }
      _replyHeapWritePos = 0;
      // Mirror to header so JS sees the reset on its next drain (it
      // compares its readPos against this to decide whether wraparound
      // has happened).
      _data.setInt32(hReplyHeapReadPos, 0, Endian.little);
    }
    final offset = _replyHeapWritePos;
    _data.buffer
        .asUint8List(kReplyHeapOff + offset, len)
        .setRange(0, len, bytes);
    _replyHeapWritePos += len;
    _data.setInt32(hReplyHeapWritePos, _replyHeapWritePos, Endian.little);
    return (offset, len);
  }

  /// Convenience: dispatch a `ValueChanged<double>` callback with a
  /// floating-point argument. Encodes the f32 bit pattern as i32 so
  /// it survives the wire. JS side decodes via `Float32Array` view
  /// over the same word.
  void dispatchEventDouble(int handlerId, double value,
      {int eventKind = evChange}) {
    final bits = _f32ToBits(value);
    dispatchEvent(handlerId,
        eventKind: eventKind, argType: eventArgF32, argValueI32: bits);
  }

  /// Convenience: dispatch a `ValueChanged<bool>` callback.
  void dispatchEventBool(int handlerId, bool value,
      {int eventKind = evChange}) {
    dispatchEvent(handlerId,
        eventKind: eventKind,
        argType: eventArgBool,
        argValueI32: value ? 1 : 0);
  }

  /// Convenience: dispatch a `ValueChanged<int>` callback.
  void dispatchEventInt(int handlerId, int value,
      {int eventKind = evChange}) {
    dispatchEvent(handlerId,
        eventKind: eventKind, argType: eventArgI32, argValueI32: value);
  }

  /// Convenience: dispatch a `ValueChanged<String>` callback. Writes
  /// the string to the reply heap (Dart-produced strings always go
  /// there) and packs (length, offset) into the event record.
  void dispatchEventStr(int handlerId, String value,
      {int eventKind = evChange}) {
    final (offset, length) = _writeReplyString(value);
    dispatchEvent(handlerId,
        eventKind: eventKind,
        argType: eventArgStr,
        argValueI32: length,
        argHeapOffset: offset);
  }

  /// Dispatch a two-float gesture callback — `fn(x, y)` on the JS side.
  /// Both floats ride in the event record's two payload words as raw
  /// f32 bit patterns, so there is ZERO reply-heap traffic: a pan that
  /// fires 120×/sec during an active drag stays a fixed 16-byte event
  /// rather than JSON-encoding a tuple every frame. JS reinterprets the
  /// words as f32 and spreads them on the handler.
  void dispatchEventVec2(int handlerId, double x, double y,
      {int eventKind = evChange}) {
    dispatchEvent(handlerId,
        eventKind: eventKind,
        argType: eventArgVec2,
        argValueI32: _f32ToBits(x),
        argHeapOffset: _f32ToBits(y));
  }

  /// Dispatch a multi-arg callback. JS-side bound handler receives the
  /// args SPREAD as positional params (`fn(a, b, c)`), not as a single
  /// array. Used for `void Function(int, String)`-shaped callbacks
  /// like list `onItemTap(index, payload)` or table `onSort(column,
  /// direction)`.
  ///
  /// All args must be jsonEncode-able (primitives, Maps, Lists, classes
  /// with toJson). Non-encodable values short-circuit to a void
  /// dispatch — the JSX handler still fires, but with no args.
  void dispatchEventTuple(int handlerId, List<Object?> args,
      {int eventKind = evChange}) {
    if (handlerId == 0) return;
    String encoded;
    try {
      encoded = jsonEncode(args);
    } catch (_) {
      // jsonEncode threw — fall back to void dispatch so the handler
      // still fires. Dev catches this in development.
      dispatchEvent(handlerId, eventKind: eventKind);
      return;
    }
    final (offset, length) = _writeReplyString(encoded);
    dispatchEvent(handlerId,
        eventKind: eventKind,
        argType: eventArgTuple,
        argValueI32: length,
        argHeapOffset: offset);
  }

  /// Bit-cast a double down to an f32 and return the bit pattern as
  /// a signed 32-bit int (matching the i32 storage slot in the event
  /// record). Uses ByteData rather than `(value as int)` so subnormal
  /// values + NaN bit patterns round-trip cleanly.
  static int _f32ToBits(double value) {
    final bd = ByteData(4);
    bd.setFloat32(0, value, Endian.little);
    return bd.getInt32(0, Endian.little);
  }

  /// Write a method-invocation reply into the event ring. Encodes
  /// the result value via the argType discriminator. The "handlerId"
  /// slot carries the callId so JS can route to the right Promise.
  ///
  /// Supported result types:
  ///   • null / void          → eventArgVoid, Promise resolves with undefined
  ///   • bool                 → eventArgBool
  ///   • int                  → eventArgI32
  ///   • double               → eventArgF32 (bit-cast)
  ///   • String               → eventArgStr, written to reply heap
  ///   • everything else      → eventArgJson, jsonEncode'd to reply heap
  ///                            (JS receives the parsed object)
  void _writeMethodReply(int callId, Object? result) {
    int argType;
    int argValueI32 = 0;
    int argHeapOffset = 0;
    if (result == null) {
      argType = eventArgVoid;
    } else if (result is bool) {
      argType = eventArgBool;
      argValueI32 = result ? 1 : 0;
    } else if (result is int) {
      argType = eventArgI32;
      argValueI32 = result;
    } else if (result is double) {
      argType = eventArgF32;
      argValueI32 = _f32ToBits(result);
    } else if (result is String) {
      final (offset, length) = _writeReplyString(result);
      argType = eventArgStr;
      argValueI32 = length;
      argHeapOffset = offset;
    } else {
      // Try JSON. Anything Dart's jsonEncode can handle (Map, List,
      // any class with toJson(), nested combinations) works — JS
      // auto-parses on receipt. For non-jsonable objects (closures,
      // streams), jsonEncode throws; we catch and fall back to void.
      try {
        final encoded = jsonEncode(result);
        final (offset, length) = _writeReplyString(encoded);
        argType = eventArgJson;
        argValueI32 = length;
        argHeapOffset = offset;
      } catch (_) {
        argType = eventArgVoid;
      }
    }
    dispatchEvent(callId,
        eventKind: evMethodReply,
        argType: argType,
        argValueI32: argValueI32,
        argHeapOffset: argHeapOffset);
  }

  /// Write a method-invocation error reply with a descriptive message.
  /// JS rejects the matching Promise with `new Error(message)`.
  void _writeMethodError(int callId, String message) {
    final (offset, length) = _writeReplyString(message);
    dispatchEvent(callId,
        eventKind: evMethodError,
        argType: eventArgStr,
        argValueI32: length,
        argHeapOffset: offset);
  }

  /// Write one stream element. Same payload-encoding shape as
  /// _writeMethodReply, but eventKind = evStreamValue so JS routes
  /// to streamHandlers[callId] (callback) instead of pendingCalls
  /// (Promise).
  void _writeStreamValue(int callId, Object? value) {
    int argType;
    int argValueI32 = 0;
    int argHeapOffset = 0;
    if (value == null) {
      argType = eventArgVoid;
    } else if (value is bool) {
      argType = eventArgBool;
      argValueI32 = value ? 1 : 0;
    } else if (value is int) {
      argType = eventArgI32;
      argValueI32 = value;
    } else if (value is double) {
      argType = eventArgF32;
      argValueI32 = _f32ToBits(value);
    } else if (value is String) {
      final (offset, length) = _writeReplyString(value);
      argType = eventArgStr;
      argValueI32 = length;
      argHeapOffset = offset;
    } else {
      try {
        final encoded = jsonEncode(value);
        final (offset, length) = _writeReplyString(encoded);
        argType = eventArgJson;
        argValueI32 = length;
        argHeapOffset = offset;
      } catch (_) {
        argType = eventArgVoid;
      }
    }
    dispatchEvent(callId,
        eventKind: evStreamValue,
        argType: argType,
        argValueI32: argValueI32,
        argHeapOffset: argHeapOffset);
  }

  /// Write the stream's terminal "done" event. No payload; JS deletes
  /// the streamHandlers entry on receipt.
  void _writeStreamDone(int callId) {
    dispatchEvent(callId, eventKind: evStreamDone);
  }

  /// Write a stream's terminal "error" event with a descriptive
  /// message. JS routes this to the optional onError callback
  /// (defaults to console.warn) and removes the subscription.
  void _writeStreamError(int callId, String message) {
    final (offset, length) = _writeReplyString(message);
    dispatchEvent(callId,
        eventKind: evStreamError,
        argType: eventArgStr,
        argValueI32: length,
        argHeapOffset: offset);
  }

  /// Drain queued overflow events into the bridge ring. Called from
  /// pumpOps before the op-ring drain; the read side (JS) is woken on
  /// each successful write, so events propagate immediately.
  ///
  /// Overflow queue layout matches the event-record layout: each event
  /// is 5 consecutive ints — kind, argType, handlerId, argValueI32,
  /// argHeapOffset.
  void _flushEventOverflow() {
    while (_eventOverflow.isNotEmpty) {
      final pos = _data.getInt32(hEventWritePos, Endian.little);
      final nextPos = (pos + 16) % kEventRingSize;
      final readPos = _data.getInt32(hEventReadPos, Endian.little);
      if (nextPos == readPos) break; // ring still full; try again next tick

      final eventKind = _eventOverflow.removeFirst();
      final argType = _eventOverflow.removeFirst();
      final handlerId = _eventOverflow.removeFirst();
      final argValueI32 = _eventOverflow.removeFirst();
      final argHeapOffset = _eventOverflow.removeFirst();
      final base = kEventRingOffset + pos;
      _data.setUint8(base + 0, eventKind);
      _data.setUint8(base + 1, argType);
      _data.setInt32(base + 4, handlerId, Endian.little);
      _data.setInt32(base + 8, argValueI32, Endian.little);
      _data.setInt32(base + 12, argHeapOffset, Endian.little);
      _data.setInt32(hEventWritePos, nextPos, Endian.little);
      final seq = _getU64(_data, hEventSeq);
      _setU64(_data, hEventSeq, seq + 1);
    }
    if (_eventOverflow.isNotEmpty) skal.wakeJs();
  }

  // ──────────────────────────────────────────────────────────────────
  // Public registry helpers (called from custom-widget adapters)
  // ──────────────────────────────────────────────────────────────────

  /// Build a typed value from a child node via the registered value
  /// builder. Adapters call this when a third-party widget's
  /// constructor expects structured data — e.g.
  ///
  /// ```dart
  /// final markers = <Marker>{};
  /// for (final id in n.childIds) {
  ///   final m = bridge.buildValue<Marker>(id);
  ///   if (m != null) markers.add(m);
  /// }
  /// return GoogleMap(markers: markers, ...);
  /// ```
  ///
  /// Returns null if [nodeId] doesn't exist, the node isn't a custom
  /// (wtCustom) node, no value builder is registered for the node's
  /// widget name, or the builder's return type doesn't match [T].
  /// Callers should treat null as "child wasn't a value this adapter
  /// recognizes" and skip it — usually JSX has mistakenly nested a
  /// non-data widget under a parent that expects only data children.
  T? buildValue<T>(int nodeId) {
    final node = nodes[nodeId];
    if (node == null) return null;
    final name = node.customWidgetName;
    if (name == null) return null;
    final builder = SkalRegistry.valueBuilderFor(name);
    if (builder == null) return null;
    final result = builder(node, this);
    return result is T ? result : null;
  }
}
