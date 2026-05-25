// Skal runtime — Flutter Web target (Shape D of WEB_SUPPORT_PLAN.md).
//
// No libskal. No JavaScriptCore. No bun. The Solid/Skal JS bundle runs
// in the browser's own JS engine; the Dart side (compiled to JS via
// dart2js) runs in the same browser tab. They share a single
// JavaScript `ArrayBuffer` allocated on the Dart side and exposed to
// JS via `globalThis.__skal_acquireBridge()` — bit-for-bit the same
// hook the native side installs, just backed by JS heap instead of a
// native shared memory region.
//
// The Dart `Uint8List` returned by `Skal.bridge` and the JavaScript
// `Uint8Array` returned from `__skal_acquireBridge()` are the SAME
// memory: in dart2js, `Uint8List` IS a JS `Uint8Array` over the same
// `ArrayBuffer`. Writes from either side become visible to the other
// on the next event-loop turn — no Atomics needed because both halves
// run on the browser's main thread (no worker).
//
// All other entry points (`evaluate`, `wakeJs`, `prewarmStore`,
// `dispose`) are no-ops on web: the JS bundle is loaded by a `<script>`
// tag (not eval'd by Dart), there's no separate worker to wake (same
// event loop), and there's no native store engine to prewarm (the
// store falls back to its in-memory backend).

import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:typed_data';

/// Bridge buffer size — must match `BRIDGE_SIZE` in
/// `packages/skal-js/src/bridge.js` (6 MiB). The JS side rejects the
/// buffer with `Skal: bridge buffer not available` if these disagree.
const int _bridgeSize = 6 * 1024 * 1024;

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
/// (`bridge`, `evaluate`, `wakeJs`, `prewarmStore`, `dispose`) so the
/// framework's `SkalBridge` + the host's `main.dart` work without
/// target-aware branches.
class Skal {
  /// The 2 MiB bridge buffer. Shared with the JS side as a
  /// `Uint8Array` over the same `ArrayBuffer` via the
  /// `__skal_acquireBridge` global.
  final Uint8List bridge;

  Skal._(this.bridge);

  /// Allocate the bridge buffer in JS heap and install the
  /// `__skal_acquireBridge` global so the Solid/Skal JS bundle's
  /// `bridge.js` picks up the SAME bytes when it boots. Optionally
  /// publishes `dataDir` as `__skal_data_dir` (the store reads it
  /// synchronously instead of an async RPC) — pass `''` to opt out.
  ///
  /// Order matters: this MUST run BEFORE the JS bundle's `bridge.js`
  /// is evaluated, otherwise the bundle's module-level
  /// `globalThis.__skal_acquireBridge()` call returns `undefined`.
  /// The host's bootstrap calls `Skal.create()` early in `main()` and
  /// only injects the `<script src="skal-app.js">` after this returns.
  static Skal? create(String dataDir) {
    final bridge = Uint8List(_bridgeSize);

    // Expose the underlying ArrayBuffer to JS. We hand out a function
    // (not a property) to match the native hook's shape — bun's
    // `JSObjectMakeArrayBufferWithBytesNoCopy` installs a callable
    // that JS-side `bridge.js` invokes as `globalThis.__skal_acquireBridge()`.
    // Same call site on both targets.
    globalContext['__skal_acquireBridge'] =
        (() => bridge.buffer.toJS).toJS;

    if (dataDir.isNotEmpty) {
      globalContext['__skal_data_dir'] = dataDir.toJS;
    }

    return Skal._(bridge);
  }

  /// No-op on web — the Solid/Skal bundle is loaded as a regular
  /// browser script (see `flutter-host/web/index.html`'s ready-event
  /// handler), not eval'd here. Returns success so the host's
  /// boot-sequence error-handling reads the same as native.
  EvalResult evaluate(String source, {String url = 'skal:eval'}) {
    return EvalResult('', false);
  }

  /// On native this signals bun's JS worker thread, which then runs
  /// `globalThis.__skal_drainEvents()` to consume any new events the
  /// Dart side just wrote into the event ring. On Shape D web there's
  /// no worker — JS and Dart share the browser's main thread — so we
  /// invoke the drain inline. Without this, button taps + gesture
  /// events would be written to the ring but never delivered to JS
  /// handlers, making the app feel "frozen" even though Dart-side
  /// rendering looks fine.
  void wakeJs() {
    final drain = globalContext['__skal_drainEvents'];
    if (drain == null) return; // JS bundle not loaded yet, or no events bound
    (drain as JSFunction).callAsFunction();
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
