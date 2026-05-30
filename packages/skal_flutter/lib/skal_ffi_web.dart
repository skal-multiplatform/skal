// Skal runtime — Flutter Web target (Shape D of WEB_SUPPORT_PLAN.md).
//
// No libskal. No JavaScriptCore. No bun. The Solid/Skal JS bundle runs
// in the browser's own JS engine; the Dart side (compiled to JS via
// dart2js OR Wasm via dart2wasm) runs in the same browser tab. They
// share bridge state through a buffer published on
// `globalThis.__skal_acquireBridge()`.
//
// **dart2js path** (default `flutter build web`):
//   JS owns a `Uint8Array(6 MiB)`. Dart holds its own `Uint8List(6 MiB)`
//   mirror. The two are kept in sync via slice copies at pump + wake
//   boundaries (see [syncFromJs] / [syncToJs]).
//
// **dart2wasm path** (`flutter build web --wasm`, skwasm renderer):
//   Same protocol — Wasm linear memory and the JS heap are two
//   separate address spaces, so a JS `Uint8Array` and a Dart `Uint8List`
//   can't alias regardless. The slice-sync machinery is identical;
//   only the per-slice cost is higher (each slice crosses the Wasm/JS
//   boundary, instead of being one cast + one in-process memcpy).
//
// **Why slice-based, not bulk?**
//   The bridge is 6 MiB. A naive "copy the whole buffer each pump in
//   both directions" costs ~12 MiB/pump regardless of how much actual
//   traffic flowed — and that's typically <30 KB/pump on active
//   frames and zero on idle frames. Slice sync uses the producer's
//   own write watermark — present in the bridge header — to copy
//   exactly the bytes that changed since the last sync. Idle frame:
//   2× 64 B header copies. 1000-op frame: header + ~16 KB op slice +
//   ~16 KB event slice. ~50–200× cheaper than bulk on dart2wasm
//   (each slice crosses Wasm↔JS twice); ~100–400× on dart2js where
//   `.toDart`/`.toJS` are casts.
//
// **Region shapes — three bump-allocators + one true circular ring.**
//   • Op ring + JS string heap (JS-write, Dart-read) — bump.
//   • Reply heap (Dart-write, JS-read) — bump.
//   • Event ring (Dart-write, JS-read) — TRUE CIRCULAR RING with
//     `writePos = (pos + 16) % size`. A regression on the event ring
//     is a legitimate wrap, NOT a reset — the new content spans
//     `[lastSynced, ringSize) + [0, currentWp)` and the slice copy
//     must transfer both ranges. See [Skal.syncToJs] for the impl.
//
// SkalBridge's cached `ByteData` / `Uint8List` views (final fields,
// constructed once) stay valid across pumps because we mirror INTO
// the same persistent `bridge` Uint8List rather than swapping it.

import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:typed_data';

import 'skal/wire.dart';

/// External binding for JS's `Uint8Array`. Dart's built-in
/// `JSUint8Array` exposes `.toDart` (for materializing bytes back into
/// a Dart `Uint8List`) but not the three methods needed for slice sync:
///
///   • `.buffer` — to hand JS the underlying ArrayBuffer for the
///     bridge protocol (`__skal_acquireBridge`).
///   • `.subarray(begin, end)` — to view a slice of the JS-side buffer
///     without copying on the JS side; `.toDart` on the subarray then
///     materializes JUST that slice into Dart memory.
///   • `.set(source, offset)` — to write a Dart-produced slice into a
///     specific region of the JS-side canonical buffer in one call.
///
/// Declaring a thin extension type on `JSUint8Array` adds these three
/// without losing the built-in conversions.
@JS('Uint8Array')
extension type _Uint8Array._(JSUint8Array _) implements JSUint8Array {
  external _Uint8Array(int length);
  external JSObject get buffer;
  external void set(JSAny source, int offset);
  external _Uint8Array subarray(int begin, int end);
}

/// Result of `Skal.evaluate` — kept on the web side purely for
/// source-compat with the native API (evaluate is a no-op here).
class EvalResult {
  final String value;
  final bool isError;
  EvalResult(this.value, this.isError);

  @override
  String toString() => isError ? 'EvalError($value)' : 'Eval($value)';
}

/// Web-target stand-in for the FFI `Skal` class. Same public surface
/// (`bridge`, `evaluate`, `wakeJs`, `prewarmStore`, `dispose`,
/// `syncFromJs`, `syncToJs`) so the framework's `SkalBridge` works
/// without target-aware branches.
class Skal {
  /// Dart-side mirror of the bridge buffer. The JS side has its own
  /// `Uint8Array` over a separately-allocated buffer; the two are kept
  /// in sync at pump + wake boundaries via [syncFromJs] / [syncToJs].
  /// Neither side needs to know about the mirror — the protocol just
  /// sees its own typed-array view of the same logical state.
  ///
  /// `final` — `SkalBridge` caches `ByteData.sublistView(skal.bridge)`
  /// at construction; the reference must stay stable for the lifetime
  /// of the bridge. We mirror INTO this buffer rather than replacing
  /// it.
  final Uint8List bridge;

  /// JS-side canonical buffer. Lives in the JS heap so the Solid/Skal
  /// JS bundle's `bridge.js` can read/write it directly via a
  /// `Uint8Array` view over `bridge.buffer`.
  final _Uint8Array _jsBridge;

  /// `ByteData` view over the Dart mirror, used to read header words
  /// after [syncFromJs] pulls fresh watermarks from JS. Cached once
  /// because `bridge` is final.
  late final ByteData _data = ByteData.sublistView(bridge);

  /// High-water marks of what's already been synced for each region.
  /// Every region is bump-allocated; the producer publishes its current
  /// write pointer in the header. The dirty range per sync is
  /// `[_synced*, currentWp)`, or `[0, currentWp)` when we detect a
  /// regression (producer reset the pointer on overflow / commit).
  ///
  /// `_syncedOpWp` / `_syncedStrWp` are JS-side producers (advanced
  /// in [syncFromJs]); `_syncedReplyWp` / `_syncedEventWp` are
  /// Dart-side producers (advanced in [syncToJs]).
  int _syncedOpWp = 0;
  int _syncedStrWp = 0;
  int _syncedReplyWp = 0;
  int _syncedEventWp = 0;

  /// Last `hJsResetEpoch` value seen from JS. JS bumps that header word
  /// whenever it rewinds the op-ring + string-heap write cursors to 0
  /// (overflow path). When the epoch changes we force a full
  /// `[0, currentWp)` re-copy of both regions instead of trusting the
  /// watermark-regression heuristic — which silently misses a reset
  /// whose post-reset write lands *above* the pre-sync mark. See
  /// [syncFromJs].
  int _syncedJsResetEpoch = 0;

  /// Latched when [syncFromJs] observes an op-ring reset (epoch change),
  /// consumed by `SkalBridge._drain` via [takeOpRingReset]. The drain
  /// keeps its OWN checkpoint (`_lastDrainedWritePos`) separate from the
  /// copy watermarks above; it must ALSO reset to 0 on a JS rewind, and
  /// its writePos-regression heuristic misses the web case where the
  /// reset fires on a string-heap overflow at a lightly-filled op ring
  /// (consecutive same-size chunks land writePos right at the old
  /// checkpoint). This flag carries the epoch signal across to the drain.
  bool _opRingReset = false;

  Skal._(this.bridge, this._jsBridge);

  /// Allocate the bridge buffer (JS side) and install the
  /// `__skal_acquireBridge` global so the Solid/Skal JS bundle's
  /// `bridge.js` picks it up when it boots. Optionally publishes
  /// `dataDir` as `__skal_data_dir` (the store reads it synchronously
  /// instead of an async RPC) — pass `''` to opt out.
  ///
  /// Order matters: this MUST run BEFORE the JS bundle's `bridge.js`
  /// is evaluated, otherwise the bundle's module-level
  /// `globalThis.__skal_acquireBridge()` call returns `undefined`.
  /// The host's bootstrap calls `Skal.create()` early in `main()` and
  /// only injects the `<script src="skal-app.js">` after this returns.
  static Skal? create(String dataDir) {
    final jsBridge = _Uint8Array(kBridgeSize);

    // Hand JS the underlying ArrayBuffer. `bridge.js` does
    // `new Uint8Array(buffer)` to get its own view; that view aliases
    // the same JS-side memory _jsBridge sees here.
    globalContext['__skal_acquireBridge'] = (() => jsBridge.buffer).toJS;

    if (dataDir.isNotEmpty) {
      globalContext['__skal_data_dir'] = dataDir.toJS;
    }

    // Dart-side mirror. SkalBridge holds ByteData/Uint8List views over
    // THIS buffer for the bridge's lifetime; the slice-sync methods
    // refresh it on demand.
    return Skal._(Uint8List(kBridgeSize), jsBridge);
  }

  /// No-op on web — the Solid/Skal bundle is loaded as a regular
  /// browser script (see `flutter-host/lib/main_web.dart`'s
  /// `_injectSkalJsBundle`), not eval'd here. Returns success so the
  /// host's boot-sequence error-handling reads the same as native.
  EvalResult evaluate(String source, {String url = 'skal:eval'}) {
    return EvalResult('', false);
  }

  /// Pull JS-side bridge state into the Dart-side mirror. Called at
  /// the start of each pumpOps so the framework picks up any new ops
  /// JS wrote since the last drain.
  ///
  /// Slice-sync strategy:
  ///
  ///   1. Always copy the 64-byte header first — it carries every
  ///      region's write watermark, and we need the fresh values to
  ///      know how big the body slices are.
  ///   2. For each JS-write region (op ring, JS string heap), copy
  ///      only the delta since the last sync. Handle ring resets by
  ///      detecting when the write pointer regressed and copying
  ///      from 0. Watermarks are clamped to their region size
  ///      defensively — a corrupted writePos must not read past the
  ///      region boundary.
  ///
  /// Idle frame: 64 B copied total (just the header — every other
  /// watermark equals its last-synced value, so the body copies are
  /// skipped). 1000-op frame: 64 B + ~16 KB op slice + a few KB of
  /// string heap. ~50–200× cheaper than copying the full 6 MiB every
  /// pump on dart2wasm (each slice crosses the Wasm/JS boundary twice
  /// via `slice.toJS` → JS-side `set`); ~100–400× cheaper on dart2js
  /// where those calls degenerate to casts.
  ///
  /// **JS-side resets are signalled via `hJsResetEpoch`.** The op ring +
  /// JS string heap rewind their write cursors to 0 on overflow (via
  /// `flushAndWaitForDrain` in `bridge.js`), and JS bumps `hJsResetEpoch`
  /// in the same `publishProgress` store that writes the post-reset
  /// positions. We compare it against [_syncedJsResetEpoch]; on a change
  /// we force a full `[0, currentWp)` re-copy of both regions. Without
  /// this, a post-reset write landing *above* the pre-sync watermark
  /// looks like monotonic growth and the slice copy misses the new
  /// batch's `[0, _syncedWp)` prefix. (The reply heap is the symmetric
  /// Dart-produced case; because its producer is in-process it uses the
  /// [markReplyHeapReset] signal instead of a header epoch.)
  void syncFromJs() {
    // (1) Header — small (64 B), always synced. Carries every region's
    // write watermark plus hJsResetEpoch, read below.
    _copyFromJs(0, kHeaderSize);

    // Did JS rewind its bump regions since the last sync? If so, both the
    // op ring and the string heap restarted from 0 together (they only
    // ever reset in lockstep), so drop both synced marks to force a full
    // re-copy rather than a (wrong) delta.
    final jsEpoch = _data.getUint32(hJsResetEpoch, Endian.little);
    if (jsEpoch != _syncedJsResetEpoch) {
      _syncedJsResetEpoch = jsEpoch;
      _syncedOpWp = 0;
      _syncedStrWp = 0;
      _opRingReset = true; // tell the drain to rewind its checkpoint too.
    }

    // (2) Op ring + JS string heap — both JS-write, Dart-read, both
    // bump-allocated. Identical delta-or-reset shape, so the same helper
    // drives both. (The regression branch inside _syncBumpRegion is now a
    // belt-and-suspenders fallback — the epoch above is the primary reset
    // signal — but it still correctly handles a below-mark rewind.)
    final opWp =
        _data.getUint32(hOpWritePos, Endian.little).clamp(0, kOpRingSize);
    _syncedOpWp = _syncBumpRegion(kOpRingOffset, opWp, _syncedOpWp, _copyFromJs);

    final strWp =
        _data.getUint32(hStrWritePos, Endian.little).clamp(0, kStringHeapSize);
    _syncedStrWp =
        _syncBumpRegion(kStringHeapOff, strWp, _syncedStrWp, _copyFromJs);
  }

  /// Sync one bump-allocated region. The producer publishes its write
  /// pointer; copy `[syncedWp, currentWp)` on growth, or the full
  /// `[0, currentWp)` when the pointer regressed below our mark (the
  /// producer reset it). Returns the new synced watermark. Shared by
  /// the three bump regions (op ring + JS string heap on the read side,
  /// reply heap on the write side); the event ring is a true circular
  /// ring and is handled separately in [syncToJs].
  int _syncBumpRegion(
      int regionOffset, int currentWp, int syncedWp, void Function(int, int) copy) {
    if (currentWp < syncedWp) {
      if (currentWp > 0) copy(regionOffset, regionOffset + currentWp);
    } else if (currentWp > syncedWp) {
      copy(regionOffset + syncedWp, regionOffset + currentWp);
    }
    return currentWp;
  }

  /// Push Dart-side bridge state back to the JS canonical buffer.
  /// Called at the end of pumpOps + before invoking
  /// `__skal_drainEvents` so JS sees any events / replies Dart wrote.
  ///
  /// Mirror of [syncFromJs], with one critical asymmetry: this pushes
  /// only the header words **Dart owns** — never the full 64 B. The
  /// header is co-written (JS owns hOpSeq/hOpWritePos/hStrWritePos and
  /// the read cursors hEventReadPos/hReplyHeapReadPos + hJsResetEpoch;
  /// Dart owns hEventSeq/hEventWritePos/hLastDrainedSeq/
  /// hReplyHeapWritePos). A blanket `[0, kHeaderSize)` push would stomp
  /// JS-owned words with Dart's mirror copy — and that copy can be stale
  /// (JS advances hOpSeq/hOpWritePos from a `queueMicrotask(commit)` that
  /// runs after the last [syncFromJs]), silently regressing JS's op
  /// watermark so the next drain misses those ops, and rewinding JS's
  /// read cursors so it re-drains consumed events. So we push the three
  /// contiguous Dart-owned runs only, each bounded by the next JS-owned
  /// word. [syncFromJs] pulling the full header back is safe in the
  /// reverse direction — JS never writes the Dart-owned words, so the
  /// pull is an identity for them.
  ///
  /// Then the delta of each Dart-write body region. Two region shapes:
  ///
  ///   • **Reply heap** — bump-allocator. Resets writePos to 0 on
  ///     overflow (see `_writeReplyString` in `bridge.dart`). The
  ///     producer signals resets in-process via [markReplyHeapReset],
  ///     which zeroes the synced watermark so the next sync re-copies
  ///     the full `[0, replyWp)` instead of mistaking a post-reset
  ///     write for growth.
  ///   • **Event ring** — TRUE CIRCULAR RING. `dispatchEvent` writes
  ///     at `(pos + 16) % kEventRingSize`, so writePos legitimately
  ///     wraps to 0 mid-ring without any "reset". A regression
  ///     (`eventWp < _syncedEventWp`) means the writes wrapped past
  ///     the ring end; the new content spans two ranges:
  ///     `[_syncedEventWp, kEventRingSize)` (tail of the prior chunk)
  ///     and `[0, eventWp)` (the wrapped prefix). Both must be
  ///     copied for JS to see all events.
  void syncToJs() {
    // (1) Header — push ONLY the Dart-owned words, never the JS-owned
    // ones (see doc above). Each range runs from a Dart-owned word up to
    // (but excluding) the next JS-owned word:
    //   [hEventSeq, hEventReadPos)        → hEventSeq + hEventWritePos
    //   [hLastDrainedSeq, hReplyHeapReadPos) → hLastDrainedSeq
    //   [hReplyHeapWritePos, hJsResetEpoch)  → hReplyHeapWritePos
    _copyToJs(hEventSeq, hEventReadPos);
    _copyToJs(hLastDrainedSeq, hReplyHeapReadPos);
    _copyToJs(hReplyHeapWritePos, hJsResetEpoch);

    final replyWp = _data.getUint32(hReplyHeapWritePos, Endian.little)
        .clamp(0, kReplyHeapSize);
    final eventWp = _data.getUint32(hEventWritePos, Endian.little)
        .clamp(0, kEventRingSize);

    // (2a) Reply heap — Dart-write, JS-read. Plain bump-allocator, so
    // the same helper as the JS-side regions drives it. The producer
    // ([markReplyHeapReset]) zeroes _syncedReplyWp on a wraparound,
    // which makes the helper re-copy the full [0, replyWp) instead of
    // mistaking a post-reset write for monotonic growth.
    _syncedReplyWp =
        _syncBumpRegion(kReplyHeapOff, replyWp, _syncedReplyWp, _copyToJs);

    // (2b) Event ring — Dart-write, JS-read. True circular ring:
    // a regression means the writes wrapped past the ring end. The new
    // content spans the tail [_syncedEventWp, kEventRingSize) AND the
    // wrapped prefix [0, eventWp); both must reach JS.
    if (eventWp < _syncedEventWp) {
      _copyToJs(
          kEventRingOffset + _syncedEventWp, kEventRingOffset + kEventRingSize);
      if (eventWp > 0) {
        _copyToJs(kEventRingOffset, kEventRingOffset + eventWp);
      }
    } else if (eventWp > _syncedEventWp) {
      _copyToJs(kEventRingOffset + _syncedEventWp, kEventRingOffset + eventWp);
    }
    _syncedEventWp = eventWp;
  }

  /// Copy `[start, end)` from `_jsBridge` (JS heap) into `bridge`
  /// (Dart-side mirror). `subarray` is a no-copy JS-side view;
  /// `.toDart` then materializes JUST that slice on the Dart side
  /// (a cast on dart2js, a copy on dart2wasm — both proportional to
  /// slice length, not buffer length).
  void _copyFromJs(int start, int end) {
    bridge.setAll(start, _jsBridge.subarray(start, end).toDart);
  }

  /// Copy `[start, end)` from `bridge` into `_jsBridge` at the same
  /// offset. `Uint8List.sublistView` is a no-copy Dart-side window;
  /// `.toJS` produces a short-lived `JSUint8Array` over those bytes
  /// (a cast on dart2js, a copy on dart2wasm); JS-side
  /// `set(src, offset)` does the final placement memcpy. So per call
  /// on dart2wasm this is two slice-sized copies: bridge → temp
  /// JSUint8Array → `_jsBridge`. On dart2js the first leg is a cast
  /// and only the JS-side set memcpy runs.
  void _copyToJs(int start, int end) {
    _jsBridge.set(Uint8List.sublistView(bridge, start, end).toJS, start);
  }

  /// On native this signals bun's JS worker thread, which then runs
  /// `globalThis.__skal_drainEvents()` to consume any new events the
  /// Dart side just wrote into the event ring. On Shape D web there's
  /// no worker — JS and Dart share the browser's main thread — so we
  /// invoke the drain inline, syncing Dart→JS first so JS sees the
  /// events, then JS→Dart after so Dart picks up any ops the handlers
  /// triggered.
  void wakeJs() {
    syncToJs();
    final drain = globalContext['__skal_drainEvents'];
    if (drain != null) {
      (drain as JSFunction).callAsFunction();
    }
    syncFromJs();
  }

  /// Producer signal: bridge.dart calls this from `_writeReplyString`
  /// after wrapping the reply heap (resetting `_replyHeapWritePos` to
  /// 0). Zeroes the synced watermark so the next [syncToJs] re-copies
  /// the full `[0, replyWp)` range.
  ///
  /// Why this is needed: the watermark-regression check inside
  /// [_syncBumpRegion] (`currentWp < syncedWp`) only catches resets
  /// where the post-reset writePos lands *below* the pre-sync mark. A
  /// reset followed by a single large reply (e.g. a 100 KB+ XFile JSON)
  /// lands *above* the mark, looks like monotonic growth, and the slice
  /// copy would transfer only `[syncedWp, replyWp)` — missing
  /// `[0, syncedWp)` of the new reply, which JS would read as the stale
  /// tail of the old one. Resetting the watermark to 0 closes that gap
  /// without a wire-format change.
  void markReplyHeapReset() {
    _syncedReplyWp = 0;
  }

  /// Consume the "op ring was reset since the last drain" signal latched
  /// by [syncFromJs] on an `hJsResetEpoch` change. `SkalBridge._drain`
  /// calls this each drain and rewinds its `_lastDrainedWritePos` to 0 on
  /// `true`, so a JS-side ring rewind can't strand the post-reset chunk.
  /// One-shot: returns the flag and clears it.
  bool takeOpRingReset() {
    final r = _opRingReset;
    _opRingReset = false;
    return r;
  }

  /// No-op on web — the native parallel-prewarm-the-disk-store
  /// optimization doesn't apply (no store on disk; in-memory backend).
  void prewarmStore(String dir) {}

  /// No-op on web. dart2js GCs the buffer when nothing references it;
  /// we just drop the `__skal_acquireBridge` reference for cleanliness.
  void dispose() {
    globalContext.delete('__skal_acquireBridge'.toJS);
  }
}
