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
import 'dart:convert';
import 'dart:typed_data';

import '../skal_ffi.dart';
import 'node_state.dart';
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
  /// Pairs are stored as alternating ints — [kind, handlerId, kind,
  /// handlerId, …] — so a single Queue<int> avoids per-pair object
  /// allocation under stress.
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

  // ── Perf instrumentation (read by PerfHud) ───────────────────────
  int pumpAvgNs = 0;
  int pumpPeakNs = 0;
  int propWritesLastDrain = 0;
  int coldPropsTouchedLastDrain = 0;

  /// Sliding window of recent drain times for the rolling peak.
  static const int _pumpPeakWindow = 60;
  final Int64List _pumpWindow = Int64List(_pumpPeakWindow);
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

    final seq = _data.getInt64(hOpSeq, Endian.little);
    if (seq == _lastOpSeq) return;

    final t0 = _pumpClock.elapsedMicroseconds;
    _drain();
    _lastOpSeq = seq;

    // Publish drained seq back to the JS side. JS spin-waits on this
    // value inside flushAndWaitForDrain to know we've caught up. The
    // companion hLastDrainedWritePos slot is reserved in the wire
    // format but currently unread on the JS side, so we don't bother
    // writing it.
    _data.setInt64(hLastDrainedSeq, seq, Endian.little);

    // EMA with α=1/8 — smooths jitter while staying responsive to
    // sudden bumps (e.g. a +1000-batch frame visibly nudges the avg).
    final dt = (_pumpClock.elapsedMicroseconds - t0) * 1000; // µs→ns
    pumpAvgNs = pumpAvgNs == 0 ? dt : (pumpAvgNs * 7 + dt) ~/ 8;

    // Rolling peak: write to next slot, max across live entries.
    _pumpWindow[_pumpWindowIdx] = dt;
    _pumpWindowIdx = (_pumpWindowIdx + 1) % _pumpPeakWindow;
    if (_pumpWindowFill < _pumpPeakWindow) _pumpWindowFill++;
    int peak = 0;
    for (var i = 0; i < _pumpWindowFill; i++) {
      final v = _pumpWindow[i];
      if (v > peak) peak = v;
    }
    pumpPeakNs = peak;
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
          break;

        case opRemoveNode:
          _removeSubtree(a, ns);
          break;

        case opInsertBefore:
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
            // duplicated in old + new parents.
            if (movingNode.parent != 0) {
              final oldParent = ns[movingNode.parent];
              if (oldParent != null) {
                final oldChildren = oldParent.children;
                // lastIndexOf because JS shrink-loops walk in reverse —
                // the target is at the tail, so this is O(1) typically.
                final oldIdx = oldChildren.lastIndexOf(b);
                if (oldIdx >= 0) {
                  oldChildren.removeAt(oldIdx);
                  oldParent.coldDirty = true;
                  touched.add(movingNode.parent);
                }
              }
            }
            final children = parentNode.children;
            final anchor = c;
            if (anchor == 0) {
              children.add(b);
            } else {
              final idx = children.indexOf(anchor);
              if (idx >= 0) {
                children.insert(idx, b);
              } else {
                // Anchor not yet a child of this parent — defensive
                // fallback to append. Not observed in practice with
                // Solid's universal renderer (which always inserts
                // anchors before referring to them), but a misbehaving
                // renderer would otherwise lose ops here.
                children.add(b);
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
            }
            node.coldDirty = true;
            touched.add(a);
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
      }

      p += 16;
    }

    // ── Coalesced notifies — one fan-out per touched node per channel ─
    // Hot and cold are independent: a frame can hit one, the other, or
    // both. Tree-shape ops fall into cold (the parent's cached widget
    // tree needs to invalidate to re-emit children).
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
        final idx = parent.children.lastIndexOf(id);
        if (idx >= 0) {
          parent.children.removeAt(idx);
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
      stack.addAll(node.children);
      node.children.clear();
      ns.remove(cur);
      node.dispose();
    }
  }

  /// Diagnostic — peek at the current header so a stuck bridge (op
  /// ring never advances) can be eyeballed from logcat. Never called
  /// in the hot path.
  Map<String, int> debugReadHeader() => {
        'opSeq': _data.getInt64(hOpSeq, Endian.little),
        'opWritePos': _data.getInt32(hOpWritePos, Endian.little),
        'eventSeq': _data.getInt64(hEventSeq, Endian.little),
      };

  /// Write an event record into the event ring and wake the JS worker.
  /// Called from a button's onPressed.
  ///
  /// If the ring is full (next write would wrap onto an undrained
  /// event) the event is queued in `_eventOverflow` and will be flushed
  /// on the next pumpOps tick — by then JS has had time to drain. The
  /// UI thread never blocks on the JS side.
  void dispatchEvent(int handlerId, {int eventKind = evClick}) {
    if (handlerId == 0) return;

    // If we've spilled to overflow, keep spilling so events stay in
    // dispatch order. A drain will eventually clear both.
    if (_eventOverflow.isNotEmpty) {
      _eventOverflow.add(eventKind);
      _eventOverflow.add(handlerId);
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
      _eventOverflow.add(handlerId);
      skal.wakeJs();
      return;
    }

    final base = kEventRingOffset + pos;
    _data.setUint8(base, eventKind);
    _data.setInt32(base + 4, handlerId, Endian.little);
    _data.setInt32(hEventWritePos, nextPos, Endian.little);
    final seq = _data.getInt64(hEventSeq, Endian.little);
    _data.setInt64(hEventSeq, seq + 1, Endian.little);
    skal.wakeJs();
  }

  /// Drain queued overflow events into the bridge ring. Called from
  /// pumpOps before the op-ring drain; the read side (JS) is woken on
  /// each successful write, so events propagate immediately.
  void _flushEventOverflow() {
    while (_eventOverflow.isNotEmpty) {
      final pos = _data.getInt32(hEventWritePos, Endian.little);
      final nextPos = (pos + 16) % kEventRingSize;
      final readPos = _data.getInt32(hEventReadPos, Endian.little);
      if (nextPos == readPos) break; // ring still full; try again next tick

      final eventKind = _eventOverflow.removeFirst();
      final handlerId = _eventOverflow.removeFirst();
      final base = kEventRingOffset + pos;
      _data.setUint8(base, eventKind);
      _data.setInt32(base + 4, handlerId, Endian.little);
      _data.setInt32(hEventWritePos, nextPos, Endian.little);
      final seq = _data.getInt64(hEventSeq, Endian.little);
      _data.setInt64(hEventSeq, seq + 1, Endian.little);
    }
    if (_eventOverflow.isNotEmpty) skal.wakeJs();
  }
}
