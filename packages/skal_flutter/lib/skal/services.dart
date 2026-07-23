// Skal service registry — namespaced, nodeless RPC.
//
// Why this exists:
//
//   `registerWidget` / `registerValue` (registry.dart) open the widget
//   set. But most native capability is not widget-shaped: geolocation,
//   share sheets, secure storage, biometrics, clipboard, haptics,
//   permissions. Nine of the twelve capabilities in
//   docs/NATIVE_SUPPORT.md have nothing to mount.
//
//   Those already worked — `dialogs.dart` proved it, by dispatching on
//   the ROOT node instead of a mounted one. What was missing is that
//   `bridge.rootDispatcher` was a single closure with a hardcoded
//   six-case switch, so every app that wanted a native service had to
//   monkey-patch it in `main.dart` and chain to the previous one by
//   hand. This file is that switch turned into a registry.
//
// The wire is unchanged. A service call is an ordinary
// `opInvokeMethod` on `kRootNodeId` whose method name is namespaced:
//
//   JS   invokeMethod(ROOT_NODE_ID, 'geolocator.getCurrentPosition', [])
//   Dart dispatchService('geolocator.getCurrentPosition', [])
//        → the 'geolocator' dispatcher, called with 'getCurrentPosition'
//
// Streams work identically — `opSubscribeStream` on the root node. A
// dispatcher that returns a `Stream<T>` gets `.listen`ed by the bridge
// exactly as a mounted host's would.
//
// Registration is global (not per-bridge) for the same reason
// `registerWidget` is: registrations happen at import/`main()` time,
// before any bridge exists, and an app has exactly one.
//
//   registerService('clipboard', (method, args) async {
//     switch (method) {
//       case 'read':
//         final d = await Clipboard.getData('text/plain');
//         return d?.text ?? '';
//       case 'write':
//         await Clipboard.setData(ClipboardData(text: args[0] as String));
//         return null;
//     }
//     throw 'clipboard: unknown method "$method"';
//   });
//
// From JS:
//
//   const clip = createSkalService('clipboard');
//   await clip.write('hello');
//   await clip.read();            // 'hello'
//
// Performance contract (docs/PERFORMANCE.md § Bridge RPC rate
// classes): one-shot calls and low-rate (≤ ~10 Hz) streams may carry
// JSON freely; a per-frame `await` cannot beat one frame per call by
// construction, so batch or use a stream. The contract is documented,
// not mechanically enforced — the registry cannot see call rates, and
// a previous `assertRateClass` shim here had no callers while the
// docs claimed it was the enforcement point, which is worse than no
// enforcement at all.

import 'dart:async';

import 'handles.dart';
import 'node_state.dart';

/// Thrown when a service method is invoked that no registered service
/// claims. Distinct from an error *inside* a service so the JS-side
/// rejection message can say which of the two happened.
class SkalUnknownService implements Exception {
  SkalUnknownService(this.qualifiedName, this.known);

  /// The full `service.method` string that failed to route.
  final String qualifiedName;

  /// Service names registered at the time of the failure — the useful
  /// half of the error message when someone mistypes a namespace or
  /// forgets to call `registerService` before `runApp`.
  final List<String> known;

  @override
  String toString() {
    final service = qualifiedName.split('.').first;
    final list = known.isEmpty ? '(none)' : known.join(', ');
    return 'skal: no service "$service" registered for '
        '"$qualifiedName". Registered services: $list. '
        'Did you call registerService("$service", …) before runApp()?';
  }
}

/// A service's dispatcher. Same shape as a node's — deliberately, so
/// generated adapters and hand-written ones are interchangeable and
/// the bridge needs no new code path. [method] is the *bare* method
/// name with the service namespace already stripped.
typedef SkalServiceDispatcher = SkalMethodDispatcher;

final Map<String, SkalServiceDispatcher> _services =
    <String, SkalServiceDispatcher>{};

/// Register [dispatcher] under [name]. JS reaches it as
/// `createSkalService(name)`.
///
/// Re-registering an existing name replaces it — hot restart re-runs
/// `main()`, and throwing there would turn every reload into a crash.
void registerService(String name, SkalServiceDispatcher dispatcher) {
  // A real throw, not an assert: in release mode an asserted-away
  // dotted name would register a namespace `dispatchService` can never
  // route (it splits on the FIRST dot) — a permanently unreachable
  // service whose error message would then list the very name it
  // refuses to route.
  if (name.contains('.')) {
    throw ArgumentError.value(name, 'name',
        'skal: service names must not contain "." — the dot separates '
        'the service from the method on the wire');
  }
  // Reserved namespaces. `handles` backs the A3 opaque-handle release
  // protocol; registration is last-writer-wins, so without this an app
  // service named "handles" would either be silently clobbered by the
  // built-in (registered later, in installAppDispatcher) or silently
  // clobber it — breaking `handles.release()` and leaking every
  // retained controller. Loud beats either.
  if (_kReservedServiceNames.contains(name) && !_registeringBuiltins) {
    throw ArgumentError.value(name, 'name',
        'skal: "$name" is a reserved built-in service namespace');
  }
  _services[name] = dispatcher;
}

/// Namespaces owned by [registerBuiltinServices].
const Set<String> _kReservedServiceNames = {'handles'};

/// True only while [registerBuiltinServices] runs — lets the built-in
/// registrar claim reserved names through the same public entry point
/// every other caller uses.
bool _registeringBuiltins = false;

/// Names currently registered, for diagnostics and error messages.
List<String> get registeredServices => _services.keys.toList(growable: false);

/// True when [qualifiedName] looks like `service.method` AND that
/// service is registered.
///
/// The registration check is what keeps this safe to put ahead of the
/// built-in app methods in `installAppDispatcher`: a future built-in
/// with a dot in its name still reaches its own switch arm unless an
/// app has deliberately registered that namespace.
bool isServiceMethod(String qualifiedName) {
  final dot = qualifiedName.indexOf('.');
  if (dot <= 0 || dot == qualifiedName.length - 1) return false;
  return _services.containsKey(qualifiedName.substring(0, dot));
}

/// Route `service.method` to its registered dispatcher.
///
/// Returns whatever the dispatcher returns — a value, a `Future`, or a
/// `Stream`; the bridge's existing reply machinery handles all three,
/// so this adds no transport code.
///
/// Throws [SkalUnknownService] when the namespace isn't registered.
/// The bridge turns a throw into a Promise rejection on the JS side.
FutureOr<Object?> dispatchService(
    String qualifiedName, List<Object?> args) {
  final dot = qualifiedName.indexOf('.');
  if (dot <= 0) {
    throw SkalUnknownService(qualifiedName, registeredServices);
  }
  final dispatcher = _services[qualifiedName.substring(0, dot)];
  if (dispatcher == null) {
    throw SkalUnknownService(qualifiedName, registeredServices);
  }
  return dispatcher(qualifiedName.substring(dot + 1), args);
}

/// Register the services Skal itself provides. Called by
/// `installAppDispatcher`, so every app has them without opting in.
///
/// Currently one: `handles`, the release side of A3's opaque-handle
/// protocol. It has to be a built-in rather than something each
/// generated service re-declares — a handle's lifetime is owned by the
/// handle table, not by whichever service happened to hand it out, and
/// making every service carry its own `release` would let two services
/// disagree about what releasing means.
///
///   const cam = await camera.open();
///   try { … } finally { await handles.release(cam); }
void registerBuiltinServices() {
  _registeringBuiltins = true;
  try {
    registerService('handles', (String method, List<Object?> args) {
      switch (method) {
        case 'release':
          // Wire-form parsing lives in handles.dart (skalHandleId) so
          // the release arm — the one call every correct consumer must
          // hit in its `finally` — can never drift from the format's
          // definition. Releasing an unknown handle is a no-op, not an
          // error; see the lifetime note in handles.dart.
          final id = skalHandleId(args.isEmpty ? null : args.first);
          return id == null ? false : SkalHandles.release(id);
        case 'liveCount':
          return SkalHandles.liveCount;
        case 'releaseAll':
          SkalHandles.releaseAll();
          return null;
      }
      throw 'handles: unknown method "$method"';
    });
  } finally {
    _registeringBuiltins = false;
  }
}

