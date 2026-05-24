// Skal — hidden Flutter Web plugin host (Phase 1 of WEB_SUPPORT_PLAN.md).
//
// This is the Dart entry point of a separate Flutter Web app that the
// main Skal JS bundle lazy-loads on the first call to a Flutter plugin
// (geolocator, camera, biometric, file picker, …). The Flutter Web
// instance runs inside a 1×1, off-screen `<div>` injected by
// `plugin-bridge-web.js`, so the user never sees it; its only job is
// to expose the unmodified Dart plugin code to JS.
//
// Wire protocol:
//   JS calls `globalThis.__skalPluginCall(name, jsonArgs)`.
//     - `name`: a string identifying the plugin route (e.g. 'ping',
//       'geolocator.getCurrentPosition', 'camera.takePicture').
//     - `jsonArgs`: a JSON string with the arguments.
//   Returns a Promise<string> that resolves to the JSON-encoded result:
//     - `{"ok": true,  "value": <plugin result>}` on success
//     - `{"ok": false, "error": "...", "stack": "..."}` on failure
//   The JS side does `JSON.parse(await __skalPluginCall(...))` and
//   either resolves the user-level Promise with `value` or rejects with
//   an Error whose message is `error`.
//
// Readiness signal: Phase 1 sets `globalThis.__skalPluginHostReady = true`
// and dispatches a `skal-plugin-host-ready` event on window so the JS
// loader can resolve its boot Promise regardless of when it started
// listening relative to the Flutter Web bootstrap.
//
// Adding a new plugin (Phase 4 onward): import its `package:foo` Dart
// API, add a `case 'foo.xxx': …` branch in `_route`. ~50 LOC per plugin.

import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/widgets.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  // STEP markers help debug if the boot hangs in production: each step
  // sets globalThis.__skalPluginHostStep, so the JS-side loader can
  // tell exactly how far Dart got even when the engine is silent.
  _step('main:enter');
  try {
    _bootHost();
    _step('main:exit');
  } catch (e, st) {
    globalContext['__skalPluginHostError'] = '$e\n$st'.toJS;
    rethrow;
  }
}

void _step(String label) {
  globalContext['__skalPluginHostStep'] = label.toJS;
}

void _bootHost() {
  _step('boot:before-register');

  // Expose the dispatch entry point on globalThis BEFORE runApp — that
  // way even if runApp blocks (waiting for a frame in the off-screen
  // host) the JS side already has a working hook.
  globalContext['__skalPluginCall'] = ((JSString name, JSString jsonArgs) {
    return _dispatch(name.toDart, jsonArgs.toDart).toJS;
  }).toJS;
  _step('boot:after-set-pluginCall');

  globalContext['__skalPluginHostReady'] = true.toJS;
  _step('boot:after-set-ready-flag');

  _dispatchReadyEvent();
  _step('boot:after-dispatch-event');

  // Boot a 0-size widget tree. We still need to call `runApp` so the
  // Flutter engine initializes (binding, scheduler, gesture arena);
  // SizedBox.shrink() is the cheapest possible widget. The whole
  // Flutter Web instance is mounted into a 1×1 host div by the JS-side
  // lazy loader (Phase 2), so visually it contributes nothing.
  runApp(const SizedBox.shrink());
  _step('boot:after-runApp');
}

void _dispatchReadyEvent() {
  final win = globalContext['window'] as JSObject?;
  if (win == null) return;
  final eventCtor = globalContext['Event'] as JSFunction?;
  if (eventCtor == null) return;
  final ev = eventCtor.callAsConstructor<JSObject>(
    'skal-plugin-host-ready'.toJS,
  );
  win.callMethod<JSAny?>('dispatchEvent'.toJS, ev);
}

/// Decode args, run the route, encode the result. All exceptions become
/// `{ok: false, error, stack}` so the JS side never sees a raw rejection.
Future<JSString> _dispatch(String name, String jsonArgs) async {
  try {
    final Map<String, dynamic> args = jsonArgs.isEmpty
        ? const <String, dynamic>{}
        : (jsonDecode(jsonArgs) as Map<String, dynamic>);
    final value = await _route(name, args);
    return jsonEncode(<String, dynamic>{'ok': true, 'value': value}).toJS;
  } catch (e, st) {
    return jsonEncode(<String, dynamic>{
      'ok': false,
      'error': e.toString(),
      'stack': st.toString(),
    }).toJS;
  }
}

/// Plugin dispatch table. Phase 1 only has `ping` (smoke test). Phase
/// 4 adds `geolocator.getCurrentPosition`. Subsequent plugins each add
/// one `case` here plus a `package:<name>` dep in pubspec.yaml.
Future<Object?> _route(String name, Map<String, dynamic> args) async {
  switch (name) {
    case 'ping':
      // Echoes args + identifies the host. Used by the JS-side
      // plugin-bridge-web.js to verify the boot succeeded end-to-end
      // before any real plugin call gets made.
      return <String, dynamic>{
        'pong': true,
        'echoed': args,
        'host': 'skal_plugin_host',
        'ts': DateTime.now().millisecondsSinceEpoch,
      };
    case 'geolocator.getCurrentPosition':
      // Federated plugin pattern: `Geolocator.getCurrentPosition()`
      // delegates to `geolocator_web` in the browser, which calls
      // `navigator.geolocation.getCurrentPosition` (which gates on
      // the browser's location permission prompt). The same Dart call
      // hits CoreLocation / FusedLocationProvider / etc. on native —
      // unchanged across targets.
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw StateError('Location permission denied (got $permission)');
      }
      final pos = await Geolocator.getCurrentPosition();
      return <String, dynamic>{
        'lat': pos.latitude,
        'lon': pos.longitude,
        'accuracy': pos.accuracy,
        'altitude': pos.altitude,
        'speed': pos.speed,
        'timestamp': pos.timestamp.millisecondsSinceEpoch,
      };
    default:
      throw StateError('Skal plugin host: unknown plugin call "$name"');
  }
}
