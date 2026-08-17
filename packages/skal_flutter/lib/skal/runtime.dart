// The runtime surface `SkalBridge` needs — and nothing else.
//
// `Skal` is target-conditional (`skal_ffi_io.dart` dlopens a 60+ MB
// libskal; `skal_ffi_web.dart` talks to a browser ArrayBuffer), and both
// only hand out instances through a factory that starts a real runtime.
// That made the drain path untestable: no test could construct a
// `SkalBridge`, so `pumpOps` / `_drain` / `_flushTouched` — the hottest
// and most stateful code in the framework — had no unit coverage at all.
//
// It cost us. A stranded-update bug shipped in 9fa78b7 and survived a
// 13-finding review: a frame drain returned on its `seq == _lastOpSeq`
// fast path without flushing notifications an off-frame drain had
// deferred to it, so `setLoading(true); api.fetch()` in one handler took
// 366 ms to paint (p95 978 ms) instead of 11.5 ms, and often never
// painted at all. It took a 45-second benchmark on a real macOS build to
// find. See notes/drafts/TODO_OPTIMIZATIONS.md §2c.
//
// This interface is the seam. It is deliberately the MINIMUM the bridge
// actually calls — not the whole `Skal` class — so a fake stays small
// enough to be obviously correct, and so widening it is a visible
// decision rather than a drift.
//
// `Skal` implements it on both targets. `SkalBridge.skal` is typed to
// it, so a host still passes its real `Skal` and a test can pass a
// plain-`Uint8List` fake.

import 'dart:typed_data';

/// Result of evaluating JS in the runtime.
///
/// Lives here rather than in the two target files so there is one
/// definition instead of two identical ones; both re-export it, so
/// `import 'package:skal_flutter/skal_ffi.dart'` still resolves it.
class EvalResult {
  final String value;
  final bool isError;
  EvalResult(this.value, this.isError);

  @override
  String toString() => isError ? 'EvalError($value)' : 'Eval($value)';
}

/// What [SkalBridge] requires of a JS runtime.
///
/// Implemented by `Skal` on native and on web. Adding a member here
/// means every implementation — including test fakes — has to grow one,
/// which is the point: the bridge's dependencies stay countable.
abstract interface class SkalRuntime {
  /// The shared region. 6 MiB, laid out by `wire.dart`: header, op
  /// ring, JS string heap, Dart reply heap, event ring.
  ///
  /// Genuinely shared memory on native. On web it is a Dart-side mirror
  /// kept in step at pump boundaries by [syncFromJs] / [syncToJs].
  Uint8List get bridge;

  /// Evaluate JS synchronously. Used by the bridge only for hot reload.
  EvalResult evaluate(String source, {String url});

  /// Signal the JS side that the event ring has something in it.
  void wakeJs();

  /// Pull JS-side writes into the Dart mirror. A no-op on native and on
  /// dart2js — the buffer is really shared there, so there is nothing
  /// to copy.
  void syncFromJs();

  /// Push Dart-side writes back to the JS mirror. Same no-op note.
  void syncToJs();

  /// Whether the JS side reset the op ring since the last call, and
  /// clear the flag. Always false on native, where the reset is visible
  /// directly in the shared header; the web mirror has to report it
  /// out-of-band.
  bool takeOpRingReset();

  /// Tell the runtime the Dart reply heap cursor rewound to 0, so JS
  /// stops treating stale offsets as live.
  void markReplyHeapReset();

  /// Arm the doorbell — `callback` runs when JS rings
  /// `__skal_notifyHost()`. See notes/drafts/TODO_OPTIMIZATIONS.md §2b.
  ///
  /// **Returns whether it actually armed.** A no-op returning false
  /// where the mechanism does not exist (web, and any libskal predating
  /// the exports).
  ///
  /// The return value is load-bearing, not diagnostic. The host stops
  /// its frame ticker when idle and relies on this callback to wake it,
  /// so a silent failure to arm would be a permanently frozen UI. When
  /// this returns false the host keeps ticking every vsync — slower, and
  /// the only safe direction to be wrong in.
  bool enableHostNotify(void Function() callback);

  /// Disarm and release the doorbell.
  void disableHostNotify();
}
