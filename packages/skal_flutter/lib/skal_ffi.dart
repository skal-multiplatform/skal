// Skal runtime — target-conditional re-export.
//
// On native (Android / iOS / macOS / Linux / Windows desktop), Skal's
// runtime is libskal — a 60+ MB dynamic library bundling bun's worker +
// JavaScriptCore. The Dart side talks to it via `dart:ffi`. That code
// lives in `skal_ffi_io.dart`.
//
// On Flutter Web (Shape D of docs/WEB_SUPPORT_PLAN.md) there is no
// libskal, no JSC, no bun. The JS bundle runs in the browser's own JS
// engine, and the Dart side (compiled to JS via dart2js) talks to it
// across a shared `Uint8Array` ArrayBuffer using `dart:js_interop`.
// That code lives in `skal_ffi_web.dart`.
//
// Consumers (`skal/bridge.dart`, `kitchen-sink/lib/main.dart`, etc.)
// just `import 'package:skal_flutter/skal_ffi.dart'` — the conditional
// `if (dart.library.js_interop)` clause flips between the two at
// compile time. Both files expose the same `Skal` class + `EvalResult`
// type surface so the rest of the framework reads from `skal.bridge`,
// calls `skal.evaluate(source)` / `skal.wakeJs()`, etc. without knowing
// which target it's running on.

export 'skal_ffi_io.dart'
    if (dart.library.js_interop) 'skal_ffi_web.dart';
