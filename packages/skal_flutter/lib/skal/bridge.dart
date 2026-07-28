// Skal bridge. Owns the shared 6 MiB region, drains the op ring once
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

import 'handles.dart';
import 'node_state.dart';
import 'registry.dart';
import 'runtime.dart';
import 'wire.dart';

class SkalBridge {
  /// The JS runtime — used to dispatch events back to JS, and exposed
  /// so callers can run extra eval probes from outside.
  ///
  /// Typed to the [SkalRuntime] interface, not the concrete `Skal`, so
  /// the drain path can be exercised in `flutter test` against a plain
  /// `Uint8List` instead of a 60 MB dlopen. A host still passes its real
  /// `Skal`, which implements this. See `runtime.dart` for why.
  final SkalRuntime skal;

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

  /// Last `hJsResetEpoch` we observed. JS bumps the epoch whenever it rewinds
  /// the op-ring/string-heap cursors to base (overflow path + every hot
  /// reload). A change is the reliable cross-topology reset signal — see the
  /// detection in [_drain].
  int _lastJsResetEpoch = 0;

  /// Heap-side overflow queue for events that didn't fit in the
  /// 1 MiB event ring. The other three rings use JS-side spin-wait
  /// because their producer (the bun worker) can safely block; the
  /// event ring's producer is the Flutter UI thread, so blocking is
  /// catastrophic. Instead: if the ring would wrap onto an undrained
  /// event, append to this queue and flush on the next Ticker tick
  /// (after JS has had a chance to drain). Bounded only by Dart heap.
  ///
  /// Records are stored as 6 consecutive ints — [eventKind, argType,
  /// handlerId, argValueI32, argHeapOffset, hasPayload, …repeat…] —
  /// mirroring the in-ring event layout plus one flag. A single
  /// `Queue<int>` avoids per-record object allocation under stress. The
  /// argHeapOffset slot is 0 for non-string events (kept uniform so the
  /// flush loop has one shape).
  ///
  /// `hasPayload` is 1 when the record's string had not been placed in
  /// the reply heap yet — see [_replyOverflow].
  final Queue<int> _eventOverflow = Queue<int>();

  /// Reply strings belonging to spilled events whose payload could not
  /// be written to the reply heap yet (JS still holds undrained
  /// references to the bytes we would have to clobber).
  ///
  /// Parallel to the `hasPayload == 1` records in [_eventOverflow], in
  /// the same order — both are FIFO and pushed/popped in lockstep, so
  /// the head of this queue always belongs to the first payload-bearing
  /// record in that one.
  final Queue<String> _replyOverflow = Queue<String>();

  /// Total UTF-16 code units held in [_replyOverflow]. Tracked
  /// incrementally — summing the queue would make spilling quadratic
  /// under exactly the burst that fills it.
  int _replyOverflowChars = 0;

  /// Ceiling on retained payloads, ~8 MiB of UTF-16.
  ///
  /// The queue only grows when JS is not draining, and correctness says
  /// hold rather than clobber — but "hold" without a bound trades a
  /// corrupted string for an OOM. Past this, the oldest payloads are
  /// dropped: they are the ones whose consumer has been unreachable
  /// longest, and a wedged JS worker is already a dead app.
  static const int _kReplyOverflowMaxChars = 4 * 1024 * 1024;

  /// Whether the drop diagnostic has been emitted — once per run, not
  /// once per drop.
  bool _warnedReplyOverflow = false;

  /// UTF-16 code units of payload currently retained by the overflow
  /// queue. A seam, because the ceiling is otherwise unobservable: a
  /// test could only watch what got *delivered*, which is the same
  /// whether the queue is bounded or growing until the process dies.
  @visibleForTesting
  int get queuedReplyChars => _replyOverflowChars;

  /// One state per JS-created node, keyed by JS node id (dense small
  /// ints). Plain `Map<int, NodeState>` — primitive int keys avoid
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
  /// Read as a BUILD-TIME branch: the renderer caches each node's
  /// subtree (`MemoizingListenableBuilder`) and nothing registers a
  /// reactive dependency on this. Switching mid-app still works —
  /// `opSetDesign` dirties every node when the mode changes, so the
  /// caches are invalidated directly instead. That is a full rebuild,
  /// but it happens once per explicit toggle; the alternative is every
  /// node re-registering a dependency on every build for a value that
  /// almost never changes.
  ///
  /// Pinned by `test/design_mode_test.dart`.
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
  /// dialog API (skal/dialogs.dart) and the service registry
  /// (skal/services.dart). Held on the bridge (not just the node) so it
  /// survives a root-node recreation: `opCreateNode` re-attaches it
  /// whenever id 1 is (re)created.
  ///
  /// Assigning re-attaches to the live root node as a side effect. That
  /// is not a nicety — the root node caches its own `methodDispatcher`,
  /// so the obvious app-side idiom
  ///
  /// ```dart
  /// final base = bridge.rootDispatcher;
  /// bridge.rootDispatcher = (m, a) => m == 'ping' ? 'pong' : base!(m, a);
  /// ```
  ///
  /// used to appear to work and silently dispatch to the *old* closure
  /// forever. The setter closes that trap; app code never has to know
  /// `kRootNodeId` exists.
  SkalMethodDispatcher? _rootDispatcher;

  SkalMethodDispatcher? get rootDispatcher => _rootDispatcher;

  set rootDispatcher(SkalMethodDispatcher? dispatcher) {
    _rootDispatcher = dispatcher;
    nodes[kRootNodeId]?.methodDispatcher = dispatcher;
  }

  /// Latches true once any `<richText>` node is created. Gates the
  /// drain's pass-0 (richText child→parent rebuild propagation) so a
  /// tree that never uses richText skips that scan entirely — one
  /// bool test instead of a full `touched` walk every drain.
  bool _treeHasRichText = false;

  // ── Perf instrumentation (read by PerfHud) ───────────────────────
  //
  // `pumpAvgNs` / `pumpPeakNs` are FRAME-drain costs only — what the
  // drain adds to the frame budget. Off-frame drains are tracked
  // separately below so they can't dilute a number the HUD and the
  // perf docs present as per-frame.
  int pumpAvgNs = 0;
  int pumpPeakNs = 0;

  /// Off-frame (doorbell) drains — count and EMA, in nanoseconds.
  /// Deliberately NOT folded into [pumpAvgNs]; see `_pumpOpsBody`.
  int offFrameDrains = 0;
  int offFrameAvgNs = 0;

  /// True for the duration of a doorbell-triggered drain. Set by
  /// [pumpOffFrame], read only by the instrumentation tail.
  bool _offFrameDrain = false;
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
        _bytes = skal.bridge {
    // Armed HERE, not from a widget. The doorbell is a property of the
    // runtime + this bridge, not of anything's build lifecycle: it must
    // be live for `main()`'s own pre-runApp pumpOps, it must not depend
    // on a SkalRoot happening to mount, and a widget has no business
    // owning an FFI registration it cannot correctly release.
    enableOffFrameDrain();
  }

  // ── Off-frame drain — docs/TODO_OPTIMIZATIONS.md §2b ────────────────
  //
  // The Ticker drain at handleBeginFrame is kept exactly as-is: it runs
  // before the build phase, so UI ops mark their nodes dirty in time to
  // rebuild in the SAME frame. That is a genuinely good property and
  // this does not replace it.
  //
  // What it adds is a second, event-driven trigger. JS rings
  // `__skal_notifyHost()` after committing a batch containing a
  // ROOT-targeted (logic) invoke; libskal calls this listener from the
  // JS worker thread; Dart delivers it to this isolate's event loop and
  // we drain immediately instead of waiting up to a full vsync.
  //
  // Delivery is a port message, so it can never land mid-build — the
  // isolate is run-to-completion and Flutter's whole frame is one task.
  //
  // The NativeCallable itself lives in skal_ffi_io.dart, not here:
  // this file also compiles for web, where dart:ffi does not exist.

  /// Arm the off-frame drain. Called from the constructor; safe to call
  /// again (re-arming replaces the port). A no-op on web and on any
  /// libskal without the doorbell exports.
  ///
  /// `pumpOps()` already guards reentrancy (`_pumping`), so a doorbell
  /// landing while the frame drain is running is harmlessly skipped —
  /// that frame's drain picks the ops up anyway.
  bool enableOffFrameDrain() => _doorbellArmed = skal.enableHostNotify(_onDoorbell);

  /// Whether the doorbell actually armed. False on web and on any
  /// libskal predating the exports — in which case the host MUST keep
  /// ticking every vsync, because nothing else will tell it that ops
  /// arrived. See [isIdle].
  bool get doorbellArmed => _doorbellArmed;
  bool _doorbellArmed = false;

  /// Called when JS rings. Set by the host so it can restart a stopped
  /// frame ticker; the off-frame drain happens regardless.
  void Function()? onWake;

  void _onDoorbell() {
    // Wake the host FIRST. `pumpOffFrame` applies ops but defers every
    // notification to the next frame pump — so if the ticker is stopped
    // and we drained without asking for a frame, those notifications
    // would sit there with nothing coming to deliver them. That is the
    // stranded-update bug with a different cause, and the ordering here
    // is what prevents it.
    onWake?.call();
    pumpOffFrame();
  }

  /// Nothing applied, nothing owed, nothing queued.
  ///
  /// The host asks this right after a frame pump to decide whether to
  /// stop ticking. It is deliberately conservative: any doubt reports
  /// busy, because the cost of a false "busy" is one wasted frame and
  /// the cost of a false "idle" is an app that stops updating.
  bool get isIdle =>
      _touched.isEmpty &&
      _eventOverflow.isEmpty &&
      _replyOverflow.isEmpty &&
      _getU64(_data, hOpSeq) == _lastOpSeq;

  /// Disarm and release the doorbell. Call from a host that is tearing
  /// a bridge down deliberately; not required for process exit.
  void disableOffFrameDrain() => skal.disableHostNotify();

  /// A drain triggered by the doorbell rather than by the frame. Split
  /// out solely so the instrumentation can keep the two populations
  /// apart — see [offFrameDrains].
  void pumpOffFrame() {
    _offFrameDrain = true;
    try {
      pumpOps();
    } finally {
      _offFrameDrain = false;
    }
  }

  /// Idempotent — ensures the root node (id 1) exists so SkalRoot can
  /// always mount even if the JS app forgot to create it. wtBox so
  /// the root is a transparent single-child passthrough; the App's
  /// outer container decides scrolling / layout shape.
  void ensureRoot() {
    nodes.putIfAbsent(kRootNodeId, () => NodeState(wtBox));
  }

  /// Source of the JS generation currently running. Lets [hotReload] skip a
  /// byte-identical bundle (e.g. a pure-Dart Flutter hot reload that didn't
  /// touch the JS) instead of needlessly re-evaluating and resetting
  /// in-component state.
  String? _lastHotReloadSource;

  /// Apply a freshly-built JS bundle to the LIVE runtime (native dev hot
  /// reload). Prepends the outgoing generation's teardown
  /// (`__skalHot.beginReload()` — dispose + host tree reset, see hot.js) then
  /// re-evaluates the new bundle so it re-mounts in place. Returns false and
  /// does nothing if the source matches the running generation or the eval
  /// fails. Shared by the manual `r` ([SkalRoot.reassemble]) and the automatic
  /// socket (hot_reload_client) paths so the two can't drift.
  bool hotReload(String source) {
    if (source == _lastHotReloadSource) return false;
    final result = _evalReload(source);
    if (result.isError) {
      debugPrint('[skal] JS hot reload failed:\n${result.value}');
      // beginReload already tore down the previous generation, so a bundle that
      // threw mid-mount (a broken intermediate save — very common while
      // editing) left the tree blank/partial. Re-mount the last good bundle so
      // the app keeps running instead of going blank until the error is fixed
      // (beginReload resets the tree again, clearing the failed attempt's
      // orphan nodes). _lastHotReloadSource stays at the last good source, so a
      // later save that reverts to it is correctly a no-op.
      final lastGood = _lastHotReloadSource;
      if (lastGood != null) {
        _evalReload(lastGood);
        pumpOps();
      }
      return false;
    }
    _lastHotReloadSource = source;
    // Pump immediately so the rebuilt tree appears this frame, not next.
    pumpOps();
    return true;
  }

  /// Evaluate `src` as a hot reload: prepend the outgoing generation's teardown
  /// (`__skalHot.beginReload()`) so the new bundle re-mounts in place (hot.js).
  EvalResult _evalReload(String src) => skal.evaluate(
        '$kSkalBeginReload\n$src',
        url: 'skal-app.js',
      );

  /// Reentrancy guard. On web, the JS overflow path
  /// (`flushAndWaitForDrain`) can call back into [pumpOps] synchronously
  /// via the `__skal_drainOpsSync` hook to drain the op ring inline. If
  /// that happens while a pump is already on the stack (an RPC reply or
  /// event handler that overflows the ring mid-drain), re-entering would
  /// corrupt the shared scratch (`_touched`, the watermarks). We skip the
  /// nested pump instead; JS falls back to a blind ring rewind for that
  /// rare case. Never set on native (no inline-drain hook).
  bool _pumping = false;

  /// Drain new ops from the ring. Cheap when nothing is pending —
  /// a single u64 load + compare.
  void pumpOps() {
    if (_pumping) return; // nested inline-drain — see [_pumping].
    _pumping = true;
    // On the dart2wasm web path the Wasm linear memory is separate
    // from the JS heap, so the "shared" bridge buffer is actually
    // two copies kept in sync at pump boundaries. syncFromJs pulls
    // JS-side writes (new ops + advanced opSeq) into our Dart-side
    // mirror so reads below see them; syncToJs at the end pushes our
    // drained-seq + any reply-heap / event-ring writes back. On
    // native + on dart2js web both calls are no-ops — the buffer is
    // genuinely shared, no copy needed.
    try {
      skal.syncFromJs();
      try {
        _pumpOpsBody();
      } finally {
        skal.syncToJs();
      }
    } finally {
      _pumping = false;
    }
  }

  void _pumpOpsBody() {
    // Flush any queued events first — they may carry a tap that
    // triggers ops to drain in this same tick, so getting them into
    // the ring before reading opSeq keeps the round-trip latency low.
    if (_eventOverflow.isNotEmpty) _flushEventOverflow();

    // ── The invariant, in exactly one place ─────────────────────────
    //
    // A FRAME pump must never return leaving notifications owed. An
    // off-frame (doorbell) drain applies ops and defers notification to
    // "the next frame drain" — so if a frame pump can reach `return`
    // without flushing, the update is stranded and nothing is coming
    // back for it.
    //
    // That is not hypothetical. It shipped: this used to bail out on
    // `seq == _lastOpSeq` before flushing, and because the doorbell
    // drains the WHOLE ring, any UI op batched alongside a root-targeted
    // invoke — `setLoading(true); api.fetch()` in one handler — went
    // off-frame with it and then sat there while further doorbell
    // batches kept the ring empty at every vsync. Measured 366 ms to
    // first paint, p95 978 ms, frequently no paint at all. See
    // docs/TODO_OPTIMIZATIONS.md §2c.
    //
    // So the flush is NOT attached to a particular return path. `_drain`
    // is pure apply; the settle happens here, unconditionally, on the
    // one exit a frame pump has. A new early return added above this
    // point would reintroduce the bug — below it, it cannot.
    // Pinned by `test/bridge_drain_test.dart`.
    final seq = _getU64(_data, hOpSeq);
    final hasNewOps = seq != _lastOpSeq;
    final isFramePump = !_offFrameDrain;

    // Idle fast path: nothing to apply and nothing owed. One u64 load
    // and two tests — this runs every vsync in a quiet app, so it stays
    // ahead of the clock read below.
    if (!hasNewOps && !(isFramePump && _touched.isNotEmpty)) return;

    final t0 = _pumpClock.elapsedMicroseconds;

    if (hasNewOps) {
      _drain();
      _lastOpSeq = seq;
      // Publish drained seq back to the JS side. JS spin-waits on this
      // value inside flushAndWaitForDrain to know we've caught up. The
      // companion hLastDrainedWritePos slot is reserved in the wire
      // format but currently unread on the JS side, so we don't bother
      // writing it.
      _setU64(_data, hLastDrainedSeq, seq);
    }

    if (isFramePump) _flushTouched();

    _recordPump((_pumpClock.elapsedMicroseconds - t0) * 1000); // µs→ns
  }

  /// Fold one drain's cost into the instrumentation.
  void _recordPump(int dt) {
    // `pumpAvgNs` / `pumpPeakNs` mean ONE THING: what the per-frame
    // drain costs inside the frame budget. That's how the HUD labels
    // them and how PERFORMANCE.md quotes them. Off-frame drains (the
    // §2b doorbell) are a different population — many, tiny, and NOT
    // charged to the frame — so folding them in would drag the average
    // down by an order of magnitude while the actual frame-time
    // contribution was unchanged, and the next person reading a jank
    // profile would trust a number that no longer means what it says.
    // Counted separately instead.
    if (_offFrameDrain) {
      offFrameDrains++;
      offFrameAvgNs =
          offFrameAvgNs == 0 ? dt : (offFrameAvgNs * 7 + dt) ~/ 8;
      return;
    }

    // EMA with α=1/8 — smooths jitter while staying responsive to
    // sudden bumps (e.g. a +1000-batch frame visibly nudges the avg).
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
    // NOT cleared here. An off-frame (doorbell) drain applies ops and
    // defers notification, so its touched ids must survive until a
    // FRAME drain flushes them — that is what preserves one-notify-per-
    // node-per-frame now that drains can happen more than once a frame.
    // Cleared at the end of the frame drain instead; see the flush loop.
    final touched = _touched;

    // Clamp defensively — a corrupted writePos (e.g. wild pointer write
    // from a misbehaving JS host) must not let the decoder read past the
    // op ring into the string heap.
    final writePos = data.getInt32(hOpWritePos, Endian.little).clamp(0, kOpRingSize);

    // Detect a JS-side ring reset and snap our drain checkpoint back to 0.
    // Three signals:
    //   • hJsResetEpoch bumped — JS rewound the op-ring + string-heap cursors
    //     to base. This fires on the overflow path AND on every hot reload
    //     (resetRootSubtree rewinds so positions don't accumulate across
    //     reloads). It is the RELIABLE signal: because the buffer is shared we
    //     read it directly, and unlike the regression test below it fires even
    //     when the post-reset tree is the same size or LARGER than what we last
    //     drained — exactly the case for a hot reload re-mounting a similar
    //     tree, where writePos would NOT regress.
    //   • Native overflow: flushAndWaitForDrain only fires near ring-full, so
    //     the post-reset writePos lands far below our checkpoint — the
    //     regression test catches it as a belt-and-braces fallback.
    //   • Web: the slice-sync mirror reports the reset out-of-band;
    //     `skal.takeOpRingReset()` returns it (always false on native).
    final jsResetEpoch = data.getInt32(hJsResetEpoch, Endian.little);
    final epochBumped = jsResetEpoch != _lastJsResetEpoch;
    _lastJsResetEpoch = jsResetEpoch;
    if (skal.takeOpRingReset() || epochBumped || writePos < _lastDrainedWritePos) {
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
          if (a == kRootNodeId && ns[a] != null) {
            // The root box is re-emitted on every boot AND every hot reload
            // (renderer.js runs at bundle top level). Keep the live NodeState
            // SkalRoot is bound to instead of replacing it — a fresh one would
            // strand SkalRoot on a dead notifier. Scoped to the root: every
            // other id is created fresh, since after a reload's tree sweep no
            // non-root id survives (so there is nothing to keep, and a chance
            // type-match must never silently reuse a stale NodeState).
            ns[a]!.methodDispatcher = rootDispatcher;
          } else {
            ns[a] = NodeState(b);
            // JS (re)creates the root node id at startup — re-attach the
            // app-level dispatcher so the imperative dialog API survives.
            if (a == kRootNodeId) ns[a]!.methodDispatcher = rootDispatcher;
            // Latch — enables the richText pass-0 in the coalescer.
            if (b == wtRichText) _treeHasRichText = true;
          }
          break;

        case opCreateCustomNode:
          // a = nodeId, b = nameHash (resolved via _nameDict, which was
          // populated by a prior opDeclareName op for this same hash).
          final node = NodeState(wtCustom);
          node.customWidgetName = _nameDict[b];
          ns[a] = node;
          break;

        case opResetRootSubtree:
          // Hot reload — the outgoing JS generation has been disposed and a
          // fresh bundle is about to rebuild the tree with freshly-reused node
          // ids. Drop every node except the root shell so the rebuild lands on
          // a clean map (the re-emitted root create is idempotent above, so any
          // gen-1 node left behind would leak as an orphan). Cancel every
          // stream subscription (all subscribing nodes are being torn down),
          // keep the live root NodeState (SkalRoot is bound to it), clear its
          // children, and re-attach the app dispatcher.
          for (final sub in _streamSubscriptions.values) {
            sub.cancel();
          }
          _streamSubscriptions.clear();
          // The outgoing generation's opaque handles (A3) die with it:
          // JS-held handle ids are numbers in the discarded bundle, so
          // nothing can ever release them again. Without this sweep,
          // every hot reload stranded the previous generation's
          // controllers — camera hardware stayed locked, liveCount grew
          // monotonically — with no missing-release bug anywhere in the
          // app's code. releaseAll() also runs each object's dispose().
          SkalHandles.releaseAll();
          final resetRoot = ns[kRootNodeId];
          // We deliberately do NOT dispose the swept NodeStates: their SkalNode
          // widgets (and any host-side AnimationControllers) are still mounted
          // until this frame's build rebuilds the root, and disposing their
          // notifiers now would risk a "used after dispose" if a controller
          // ticks before the rebuild detaches them. Dropping them from the map
          // is enough — each is unreferenced (and GC'd) once its widget
          // unmounts on the rebuild and removes its own listener.
          ns.clear();
          // Buffered method-arg lists and animatedList mid-exit children belong
          // to the swept generation — drop them so they don't leak across the
          // reload (the leaving NodeStates are already gone with ns.clear()).
          _pendingMethodArgs.clear();
          // Queued events belong to the swept generation too: their
          // handler ids and callIds index a JS registry that no longer
          // exists, so flushing them after the reload dispatches into
          // nothing. Left alone they also pinned every deferred payload
          // string for the life of the process — a hot-reload loop
          // during a stream grew the Dart heap monotonically.
          _eventOverflow.clear();
          _replyOverflow.clear();
          _replyOverflowChars = 0;
          if (resetRoot != null) {
            resetRoot.clearChildren();
            resetRoot.leavingChildren?.clear();
            resetRoot.methodDispatcher = rootDispatcher;
            resetRoot.coldDirty = true;
            ns[kRootNodeId] = resetRoot;
          } else {
            ns[kRootNodeId] = NodeState(wtBox)..methodDispatcher = rootDispatcher;
          }
          // Per-tree latch — the swept tree is gone, so let the new generation
          // re-latch only if it actually mounts rich text.
          _treeHasRichText = false;
          // The reply heap is logically empty now (subscribers gone, RPCs
          // rejected); rewind its cursors so they don't accumulate across
          // reloads (which would otherwise force a wraparound-deferral every
          // few reloads) — but ONLY when JS has consumed everything (its read
          // cursor caught up to the write cursor), so we never clobber a reply
          // string that an undrained event still points at. Otherwise leave it
          // for this round.
          if (_data.getInt32(hReplyHeapReadPos, Endian.little) >=
              _replyHeapWritePos) {
            _replyHeapWritePos = 0;
            _data.setInt32(hReplyHeapWritePos, 0, Endian.little);
            _data.setInt32(hReplyHeapReadPos, 0, Endian.little);
          }
          touched.add(kRootNodeId);
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

        case opListSetRow:
          // Builder-mode row attachment: a = list id, b = virtual index,
          // c = subtree-root id. Sparse map, not the children list.
          final rowList = ns[a];
          final rowChild = ns[c];
          if (rowList != null && rowChild != null) {
            final rows = rowList.builderRows ??= <int, int>{};
            final old = rows[b];
            if (old != null && old != c) _removeSubtree(old, ns);
            rows[b] = c;
            rowChild.parent = a;
            rowList.coldDirty = true;
            touched.add(a);
          }
          break;

        case opClearCustomProp:
          // a = nodeId, b = nameHash. Remove the prop from every typed
          // map — see wire.dart's rationale (type-change invalidation).
          final clearNode = ns[a];
          final clearName = _nameDict[b];
          if (clearNode != null && clearName != null) {
            clearNode.clearCustomProp(clearName);
            clearNode.coldDirty = true;
            touched.add(a);
          }
          break;

        case opClearProp:
          // a = nodeId, b = propKey. Remove from every typed map, for
          // the same reason opClearCustomProp does: the three maps are
          // insert-only and independently lived, so leaving a stale
          // numeric slot behind would shadow the default a reader gets
          // from `getPropU32(key, fallback)`.
          //
          // Removing a key has the SAME downstream consequences as
          // writing one, so this mirrors opSetPropU32's two follow-ups.
          // Not a comment you have to trust: `bridge_drain_test.dart`
          // runs the set and clear paths through the same assertions, so
          // a follow-up added to one and not the other fails there.
          final clearPropNode = ns[a];
          if (clearPropNode != null) {
            clearPropNode.removeProp(b);
            clearPropNode.coldDirty = true;
            touched.add(a);
            // Clearing itemCount drops the count to its default — every
            // cached row extent is now out of range.
            if (b == propItemCount) clearPropNode.rowExtents?.clear();
            // Stack-positioning props are consumed by the PARENT's
            // builder; without this the `<stack>` never rebuilds and the
            // child stays pinned at the offset that was just removed.
            if (b >= propTop && b <= propLeft) {
              final clearParent = ns[clearPropNode.parent];
              if (clearParent != null) {
                clearParent.coldDirty = true;
                touched.add(clearPropNode.parent);
              }
            }
          }
          break;

        case opListClearRow:
          // Builder-mode row eviction: tear the row's subtree down here
          // (JS does NOT also send opRemoveNode for evicted rows).
          final clearList = ns[a];
          if (clearList != null) {
            final evicted = clearList.builderRows?.remove(b);
            if (evicted != null) {
              _removeSubtree(evicted, ns);
              clearList.coldDirty = true;
              touched.add(a);
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
            node.setPropU32(b, c);
            node.coldDirty = true;
            touched.add(a);
            propWrites++;
            // A builder list's virtual count changed — drop cached row
            // extents at indices that no longer exist (a shrink/dataset
            // swap) so stale heights don't size the new data's
            // placeholders. Indices still in range keep their measured
            // extents (valid on a pure grow/append).
            if (b == propItemCount) {
              node.rowExtents?.removeWhere((k, _) => k >= c);
            }
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
            node.setPropF32(b, _bitsToF32(c));
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
            node.setPropStr(key, _readString(kStringHeapOff + offset, length));
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
            } else if (b == evRowRequest) {
              node.onRowRequestHandlerId = c;
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
            case eventArgJson:
              // Same packing as eventArgStr — the discriminator is the
              // only difference. JS stringified an object/array; the
              // dispatcher receives the decoded Map/List rather than
              // having to jsonDecode a String arg by convention (which
              // is what dialogs.dart's `_decodeSpec` had to do before
              // this case existed).
              final length = (b >> 8) & 0xFFFFFF;
              final offset = c;
              final raw = _readString(kStringHeapOff + offset, length);
              try {
                args.add(jsonDecode(raw));
              } catch (_) {
                // Malformed JSON can only come from a corrupt ring;
                // degrade to the raw string rather than killing the
                // whole drain loop.
                args.add(raw);
              }
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
                'mounted yet, or this widget isn\'t a host-pattern target'
                '${a == kRootNodeId ? '. Node $kRootNodeId is the root: '
                    'call installAppDispatcher(bridge) BEFORE the first '
                    'pumpOps() in your host\'s main()' : ''}');
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
            // First hot prop: the node has no hot layer yet, so also
            // dirty COLD once to rebuild the subtree WITH one. See
            // NodeState.everHot.
            if (!node.everHot) { node.everHot = true; node.coldDirty = true; }
            touched.add(a);
          }
          break;
        case opSetTranslationX:
          final node = ns[a];
          if (node != null) {
            node.translationX = _bitsToF32(c);
            node.hotDirty = true;
            // First hot prop: the node has no hot layer yet, so also
            // dirty COLD once to rebuild the subtree WITH one. See
            // NodeState.everHot.
            if (!node.everHot) { node.everHot = true; node.coldDirty = true; }
            touched.add(a);
          }
          break;
        case opSetTranslationY:
          final node = ns[a];
          if (node != null) {
            node.translationY = _bitsToF32(c);
            node.hotDirty = true;
            // First hot prop: the node has no hot layer yet, so also
            // dirty COLD once to rebuild the subtree WITH one. See
            // NodeState.everHot.
            if (!node.everHot) { node.everHot = true; node.coldDirty = true; }
            touched.add(a);
          }
          break;
        case opSetScaleX:
          final node = ns[a];
          if (node != null) {
            node.scaleX = _bitsToF32(c);
            node.hotDirty = true;
            // First hot prop: the node has no hot layer yet, so also
            // dirty COLD once to rebuild the subtree WITH one. See
            // NodeState.everHot.
            if (!node.everHot) { node.everHot = true; node.coldDirty = true; }
            touched.add(a);
          }
          break;
        case opSetScaleY:
          final node = ns[a];
          if (node != null) {
            node.scaleY = _bitsToF32(c);
            node.hotDirty = true;
            // First hot prop: the node has no hot layer yet, so also
            // dirty COLD once to rebuild the subtree WITH one. See
            // NodeState.everHot.
            if (!node.everHot) { node.everHot = true; node.coldDirty = true; }
            touched.add(a);
          }
          break;
        case opSetRotationZ:
          final node = ns[a];
          if (node != null) {
            node.rotationZ = _bitsToF32(c);
            node.hotDirty = true;
            // First hot prop: the node has no hot layer yet, so also
            // dirty COLD once to rebuild the subtree WITH one. See
            // NodeState.everHot.
            if (!node.everHot) { node.everHot = true; node.coldDirty = true; }
            touched.add(a);
          }
          break;

        case opSetDesign:
          // Global, not node-scoped — a = mode, b = brightness.
          final modeChanged = designMode != a;
          designMode = a;
          designBrightness = b;
          designChanged.notify();
          // Material ↔ Cupertino is a build-time branch in every control
          // builder, and `MemoizingListenableBuilder` returns each node's
          // CACHED subtree until that node's own `cold` fires. So a mode
          // flip on its own reaches only the nodes that happened to
          // change for some other reason, and the tree renders half in
          // each design — which is what the demo's design switcher did.
          //
          // Dirty everything instead. It is a full rebuild, but it
          // happens once, on an explicit user action, and the
          // alternative is a documented-unsupported flag that the
          // shipped demo offers a button for. Brightness alone still
          // goes through `_SkalBrightness` and rebuilds only `<text>`.
          if (modeChanged) {
            for (final entry in ns.entries) {
              entry.value.coldDirty = true;
              touched.add(entry.key);
            }
          }
          break;

        case opLog:
          // JS `console.*` from the native shim (bridge.js). a = level,
          // b = string-heap offset, c = byte length. Surface it in the
          // Flutter log stream so it shows wherever the dev is already
          // watching, next to Dart's own logs. Gated on kDebugMode: the
          // shim only installs on native and is meant for dev, and release
          // builds shouldn't pay the decode/print. The op is still consumed
          // either way (p advances below), so gating can't desync the ring.
          if (kDebugMode) {
            final msg = _readString(kStringHeapOff + b, c);
            const tags = ['log', 'info', 'warn', 'error', 'debug'];
            final tag = (a >= 0 && a < tags.length) ? tags[a] : 'log';
            debugPrint('[skal-js:$tag] $msg');
          }
          break;
      }

      p += 16;
    }

    // ── The control lane, without a second ring ────────────────────
    //
    // An off-frame (doorbell) drain APPLIES its ops but does not notify.
    // The touched set and the per-node dirty flags carry forward, and
    // the next frame drain flushes them — so N off-frame drains plus a
    // frame drain still produce exactly ONE notify per node, which is
    // the coalescing property the per-frame drain was giving us for
    // free before the doorbell existed.
    //
    // This is why `_drain` no longer clears `touched` on entry: the set
    // is cleared after a FRAME drain flushes it, not at the start of
    // every drain.
    //
    // Deferring costs nothing visually. Nothing paints before vsync, so
    // a notify issued off-frame would only mark elements dirty for the
    // same frame that is about to run anyway. What it buys is that a
    // node written during a logic batch is not rebuilt twice.
    //
    // Note the RPC reply is NOT deferred — it goes out during dispatch
    // via the event ring, which is the whole point of the doorbell.
    // Only widget notification waits.
    propWritesLastDrain = propWrites;

    // Advance the drain checkpoint. JS reads this back to know when
    // it's safe to reset writePos to 0 (we've consumed everything) or
    // how far it must spin-wait for at near-overflow.
    //
    // Advances on an off-frame drain too. Deferring NOTIFICATION must
    // never look like deferring CONSUMPTION — the ops really are gone
    // from the ring, and JS spin-waits on this before rewinding its
    // write cursor over them.
    _lastDrainedWritePos = writePos;
  }

  /// Notify every node the applied ops touched, then clear the set.
  ///
  /// Deliberately NOT called from [_drain]: deferring notification is
  /// only safe if something is guaranteed to come back for it, so the
  /// call site is the single exit of a frame pump in [_pumpOpsBody] —
  /// including the case where the ring was empty and `_drain` never
  /// ran. Cheap on an empty set.
  void _flushTouched() {
    final ns = nodes;
    final touched = _touched;

    // Pass 0 — `<richText>` reactivity. A richText absorbs each child
    // `<text>` into a TextSpan; the child is never its own widget, so
    // a dirty child must rebuild the parent. Promote each such parent
    // into the `touched` set + mark it cold-dirty so the coalescing
    // loop below notifies it EXACTLY ONCE — no per-child or
    // parent+child double rebuild. `richTextParents` is lazily
    // allocated, so a richText-using app with no dirty spans this
    // drain still pays nothing; `_treeHasRichText` skips the scan
    // outright for an app that never uses richText.
    //
    // Runs HERE, once per frame, and not in `_drain`. `touched` now
    // accumulates across off-frame drains and `coldDirty` is only
    // cleared below, so deriving this per drain re-walked a growing set
    // to reach the same answer — N doorbell batches did the promotion N
    // times. Idempotent, so it was never wrong, just repeated work on
    // the drain hot path in exactly the burst shape §2c measured.
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
        node.notifyCold();
      }
      if (node.hotDirty) {
        node.hotDirty = false;
        node.notifyHot();
      }
    }
    touched.clear();
    coldPropsTouchedLastDrain = coldCount;
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
      // Builder-mode rows live in the sparse index map, not childIds —
      // fold them in too so removing a builder list (or an ancestor,
      // incl. the hot-reload root sweep) doesn't leak its window. Zero
      // the request handler so a post-frame row request already queued
      // for this list bails instead of dispatching to a dead node.
      final builderRows = node.builderRows;
      if (builderRows != null) stack.addAll(builderRows.values);
      node.onRowRequestHandlerId = 0;
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
  /// Back-pressure has two sources and one answer. If the ring is full
  /// (next write would wrap onto an undrained event), or [payload] does
  /// not fit in the reply heap without clobbering bytes JS has not read,
  /// the event is queued in `_eventOverflow` and flushed on the next
  /// pumpOps tick — by then JS has had time to drain. **The UI thread
  /// never blocks on the JS side.**
  ///
  /// Pass [payload] rather than pre-writing the string and passing an
  /// offset: placement has to happen at the moment the event is actually
  /// admitted to the ring, and only this method knows when that is.
  void dispatchEvent(
    int handlerId, {
    int eventKind = evClick,
    int argType = eventArgVoid,
    int argValueI32 = 0,
    int argHeapOffset = 0,
    String? payload,
  }) {
    if (handlerId == 0) return;

    // Anything we send JS produces ops coming back, and a spilled event
    // needs pumps to drain — either way the ticker has to be running.
    // Three field reads on the gesture path; the alternative is a tap
    // that lands on a stopped ticker and never repaints.
    onWake?.call();

    // Ordering first: once anything has spilled, everything spills, or a
    // later event overtakes an earlier one. Both back-pressure sources
    // share this one queue precisely so that ordering is a single rule
    // rather than two interacting ones.
    if (_eventOverflow.isNotEmpty) {
      _spill(eventKind, argType, handlerId, argValueI32, argHeapOffset, payload);
      skal.wakeJs();
      return;
    }

    if (payload != null && utf8.encode(payload).length > kReplyHeapSize) {
      _dispatchChunked(handlerId, eventKind, argType, payload);
      return;
    }

    if (payload != null) {
      final slot = _tryWriteReplyString(payload);
      if (slot == null) {
        // Reply heap still holds bytes JS has not read. Queue the event
        // with its string in Dart and place it once JS catches up — a
        // frame of latency instead of a stalled UI thread.
        _spill(eventKind, argType, handlerId, argValueI32, argHeapOffset,
            payload);
        skal.wakeJs();
        return;
      }
      argHeapOffset = slot.$1;
      argValueI32 = slot.$2;
    }

    final pos = _data.getInt32(hEventWritePos, Endian.little);
    final nextPos = (pos + 16) % kEventRingSize;
    final readPos = _data.getInt32(hEventReadPos, Endian.little);
    if (nextPos == readPos) {
      // Ring full — JS hasn't drained recent events yet (likely a
      // wedged worker or 18+ minutes of unprocessed input). Spill to
      // the heap-side queue so the producer (this thread) doesn't lose
      // the event or block. The payload (if any) is already placed, so
      // it rides as a plain offset from here.
      _spill(eventKind, argType, handlerId, argValueI32, argHeapOffset, null);
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

  /// Deliver a payload larger than the whole reply heap, in parts.
  ///
  /// An event record carries a single (offset, length) into a 256 KiB
  /// region, so one bigger value has no representation. It used to be
  /// truncated — loudly, but truncated, and a 100 KB+ XFile JSON is not
  /// far off that ceiling.
  ///
  /// Split it instead: N-1 `eventArgStrChunk` records carrying
  /// successive slices, then one final record with the REAL arg type
  /// carrying the last. JS keys the parts by the record's id and
  /// prepends them when the final one lands.
  ///
  /// Slices are cut on CODEPOINT boundaries even though JS reassembles
  /// before decoding — a chunk that ends mid-sequence would still be
  /// decoded by anything that inspects parts individually, and the cost
  /// of not relying on that is a few bytes per chunk.
  void _dispatchChunked(
      int handlerId, int eventKind, int argType, String payload) {
    final bytes = utf8.encode(payload);
    // Leave headroom so a chunk always fits even when the heap is
    // partly occupied — otherwise the first chunk defers, the queue
    // drains it, and the next still cannot fit.
    final limit = kReplyHeapSize ~/ 2;

    var at = 0;
    while (at < bytes.length) {
      var end = at + limit;
      if (end >= bytes.length) {
        end = bytes.length;
      } else {
        // Back off to a lead byte so no chunk ends mid-sequence.
        while (end > at && (bytes[end] & 0xC0) == 0x80) {
          end--;
        }
      }
      final isLast = end >= bytes.length;
      dispatchEvent(
        handlerId,
        eventKind: eventKind,
        // Only the LAST record carries the real type; the rest announce
        // themselves as parts so JS accumulates instead of dispatching.
        argType: isLast ? argType : eventArgStrChunk,
        payload: utf8.decode(bytes.sublist(at, end)),
      );
      at = end;
    }
  }

  /// Append one record to [_eventOverflow] (and its string, if the
  /// payload has not been placed in the reply heap yet, to
  /// [_replyOverflow]).
  void _spill(int eventKind, int argType, int handlerId, int argValueI32,
      int argHeapOffset, String? payload) {
    if (payload != null &&
        _replyOverflowChars + payload.length > _kReplyOverflowMaxChars) {
      // Over the ceiling. Refuse the INCOMING record rather than evicting
      // the head: the two queues advance in lockstep, and dropping from
      // the front would mean finding and removing the matching event
      // record — a scan, on the exact path that is already under
      // pressure. Refusing here is O(1) and cannot desync them. The
      // consumer sees a gap either way; this way it is a gap and not a
      // reorder.
      if (!_warnedReplyOverflow) {
        _warnedReplyOverflow = true;
        assert(() {
          debugPrint('Skal: the JS side has not drained the reply heap and '
              'over ${_kReplyOverflowMaxChars ~/ (1024 * 1024)} MiB of '
              'payloads are queued — dropping further ones. The JS worker '
              'is probably wedged or the app was backgrounded mid-stream.');
          return true;
        }());
      }
      return;
    }
    _eventOverflow.add(eventKind);
    _eventOverflow.add(argType);
    _eventOverflow.add(handlerId);
    _eventOverflow.add(argValueI32);
    _eventOverflow.add(argHeapOffset);
    _eventOverflow.add(payload == null ? 0 : 1);
    if (payload != null) {
      _replyOverflow.add(payload);
      _replyOverflowChars += payload.length;
    }
  }

  /// Reply-heap cursor — bumped on each [_tryWriteReplyString] call.
  /// Rewinds to 0 when an allocation would exceed capacity AND JS's
  /// read pointer (`hReplyHeapReadPos`) has caught up.
  int _replyHeapWritePos = 0;

  /// Try to write [s] into the reply heap (Dart-write, JS-read) as
  /// UTF-8. Returns the byte offset + byte length, or **null** when the
  /// write would clobber bytes JS has not read yet.
  ///
  /// Null means "not now", never "not ever": [dispatchEvent] queues the
  /// event and retries on the next pump, by which time JS has drained.
  ///
  /// This used to spin instead — up to 50 ms of `DateTime.now()` on the
  /// UI thread, then reset and clobber anyway if the deadline passed, so
  /// it bought a frozen app and *not* correctness. On Flutter Web it
  /// could not even work in principle: `_data` there is a Dart-side
  /// mirror refreshed only by `syncFromJs` at pump boundaries, and JS is
  /// on the same thread, so the loop re-read one stale word until the
  /// deadline expired. The comment claimed "a ms or two".
  ///
  /// The wrap rule is deliberately the conservative one — rewind only
  /// when JS has consumed *everything* (`readPos >= writePos`), not when
  /// the low region alone happens to be free. Exact circular accounting
  /// would recover more space, but `readPos` is written by another
  /// thread on native with no barrier, and `readPos == writePos` is the
  /// single state a stale read cannot get wrong (it only ever advances,
  /// so a stale value is behind the truth, never ahead of it).
  (int offset, int length)? _tryWriteReplyString(String s) {
    final bytes = utf8.encode(s);
    final len = bytes.length;
    if (len > kReplyHeapSize) {
      // KNOWN LIMIT, not a wraparound case: one value larger than the
      // whole heap cannot be delivered WHOLE by this protocol, because
      // an event record carries a single (offset, length) into a fixed
      // region. Carrying it properly needs chunked payload ownership (a
      // multi-part arg type on the wire, all three languages).
      //
      // It still has to obey the same invariant as every other write,
      // though: this lands at offset 0 and spans the entire heap, so it
      // clobbers EVERY live reference. Report "not now" until JS has
      // drained, exactly as the wraparound branch below does. (This
      // branch used to write unconditionally — the one place the
      // rewrite left the old clobber-anyway behaviour in place.)
      final readPos = _data.getInt32(hReplyHeapReadPos, Endian.little);
      if (readPos < _replyHeapWritePos) return null;

      // Truncate LOUDLY, and on a codepoint boundary — cutting
      // mid-sequence would hand JS a string that fails to decode rather
      // than one that is merely short.
      var end = kReplyHeapSize;
      while (end > 0 && (bytes[end] & 0xC0) == 0x80) {
        end--; // back off continuation bytes to the lead byte
      }
      assert(() {
        debugPrint('Skal: reply payload is $len bytes, over the '
            '$kReplyHeapSize-byte reply heap — TRUNCATED to $end. The '
            'receiver will see a short value. Split the payload, or '
            'stream it in chunks.');
        return true;
      }());
      _data.buffer
          .asUint8List(kReplyHeapOff, kReplyHeapSize)
          .setRange(0, end, bytes);
      _replyHeapWritePos = end;
      _data.setInt32(hReplyHeapWritePos, _replyHeapWritePos, Endian.little);
      // Rewind the read cursor with the write cursor. Without this a
      // stale readPos ≥ `end` survives, and the NEXT wraparound sees
      // `readPos >= _replyHeapWritePos`, concludes JS has caught up, and
      // rewinds over this payload before JS has read a byte of it.
      _data.setInt32(hReplyHeapReadPos, 0, Endian.little);
      // Wrote at offset 0 (effectively a reset), so signal the web-side
      // slice-sync to push the full range — without this, the
      // monotonic-growth branch would miss [0, _syncedReplyWp).
      skal.markReplyHeapReset();
      return (0, end);
    }
    if (_replyHeapWritePos + len > kReplyHeapSize) {
      // Wraparound. JS may still be sitting on undrained events that
      // reference strings at offsets ∈ [readPos, writePos); rewinding
      // now would clobber them. Report "no room" and let the caller
      // queue — never block, never clobber.
      final readPos = _data.getInt32(hReplyHeapReadPos, Endian.little);
      if (readPos < _replyHeapWritePos) return null;
      _replyHeapWritePos = 0;
      // Reset our own view of the read cursor. JS never *reads*
      // hReplyHeapReadPos (it only writes it as it drains, via
      // _advanceReplyReadCursor) — so this is purely for Dart's next
      // wraparound check above, which compares the (JS-written, sync-
      // pulled) readPos against _replyHeapWritePos. On web syncToJs no
      // longer pushes this word (it's JS-owned), which is fine: the next
      // syncFromJs pulls JS's authoritative value back in.
      _data.setInt32(hReplyHeapReadPos, 0, Endian.little);
      // Tell the web-side slice-sync that the reply heap was reset.
      // The watermark-regression check alone misses the case where a
      // single post-reset write is larger than the pre-sync mark; this
      // signal forces the next syncToJs to push [0, replyWp). No-op on
      // native (FFI bridge buffer is genuinely shared). See
      // skal_ffi_web.dart::markReplyHeapReset.
      skal.markReplyHeapReset();
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
    dispatchEvent(handlerId,
        eventKind: eventKind, argType: eventArgStr, payload: value);
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
    dispatchEvent(handlerId,
        eventKind: eventKind, argType: eventArgTuple, payload: encoded);
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
    String? payload;
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
      argType = eventArgStr;
      payload = result;
    } else {
      // Try JSON. Anything Dart's jsonEncode can handle (Map, List,
      // any class with toJson(), nested combinations) works — JS
      // auto-parses on receipt. For non-jsonable objects (closures,
      // streams), jsonEncode throws; we catch and fall back to void.
      try {
        payload = jsonEncode(result);
        argType = eventArgJson;
      } catch (_) {
        argType = eventArgVoid;
      }
    }
    dispatchEvent(callId,
        eventKind: evMethodReply,
        argType: argType,
        argValueI32: argValueI32,
        payload: payload);
  }

  /// Write a method-invocation error reply with a descriptive message.
  /// JS rejects the matching Promise with `new Error(message)`.
  void _writeMethodError(int callId, String message) {
    dispatchEvent(callId,
        eventKind: evMethodError, argType: eventArgStr, payload: message);
  }

  /// Write one stream element. Same payload-encoding shape as
  /// _writeMethodReply, but eventKind = evStreamValue so JS routes
  /// to streamHandlers[callId] (callback) instead of pendingCalls
  /// (Promise).
  void _writeStreamValue(int callId, Object? value) {
    int argType;
    int argValueI32 = 0;
    String? payload;
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
      argType = eventArgStr;
      payload = value;
    } else {
      try {
        payload = jsonEncode(value);
        argType = eventArgJson;
      } catch (_) {
        argType = eventArgVoid;
      }
    }
    dispatchEvent(callId,
        eventKind: evStreamValue,
        argType: argType,
        argValueI32: argValueI32,
        payload: payload);
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
    dispatchEvent(callId,
        eventKind: evStreamError, argType: eventArgStr, payload: message);
  }

  /// Drain queued overflow events into the bridge ring. Called from
  /// pumpOps before the op-ring drain; the read side (JS) is woken on
  /// each successful write, so events propagate immediately.
  ///
  /// Overflow queue layout matches the event-record layout plus a flag:
  /// each event is 6 consecutive ints — kind, argType, handlerId,
  /// argValueI32, argHeapOffset, hasPayload.
  void _flushEventOverflow() {
    while (_eventOverflow.isNotEmpty) {
      final pos = _data.getInt32(hEventWritePos, Endian.little);
      final nextPos = (pos + 16) % kEventRingSize;
      final readPos = _data.getInt32(hEventReadPos, Endian.little);
      if (nextPos == readPos) break; // ring still full; try again next tick

      // Place a still-unplaced payload BEFORE consuming the record —
      // if the reply heap has no room yet, the record has to stay
      // queued, so nothing may be removed. Peek, then commit.
      var argValueI32 = _eventOverflow.elementAt(3);
      var argHeapOffset = _eventOverflow.elementAt(4);
      if (_eventOverflow.elementAt(5) == 1) {
        final slot = _tryWriteReplyString(_replyOverflow.first);
        if (slot == null) break; // JS still hasn't drained; next tick
        _replyOverflowChars -= _replyOverflow.removeFirst().length;
        argHeapOffset = slot.$1;
        argValueI32 = slot.$2;
      }

      final eventKind = _eventOverflow.removeFirst();
      final argType = _eventOverflow.removeFirst();
      final handlerId = _eventOverflow.removeFirst();
      _eventOverflow.removeFirst(); // argValueI32 — resolved above
      _eventOverflow.removeFirst(); // argHeapOffset — resolved above
      _eventOverflow.removeFirst(); // hasPayload
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
