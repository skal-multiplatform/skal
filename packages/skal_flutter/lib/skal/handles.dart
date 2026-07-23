// Opaque handles — Roadmap A3 in docs/NATIVE_SUPPORT.md.
//
// The problem:
//
//   Plenty of native APIs hand back a live object: a CameraController,
//   a database connection, a stream subscription, a Bluetooth device.
//   None of them can be serialized, and none of them should be — the
//   value IS the identity, not the field contents. Before this file,
//   codegen's only honest answer was to drop the method.
//
// The fix, which is what JNI and PyObjC both do:
//
//   Keep the object on the Dart side, give JS an integer that names it,
//   and let JS pass that integer back. Zero serialization in either
//   direction, which also makes this the most perf-positive item in the
//   plan — an int arg is already a supported wire type (eventArgI32), so
//   there is no new transport at all.
//
// JS sees a self-describing object rather than a bare int:
//
//   { $skalHandle: 7, $type: 'CameraController' }
//
//   The int alone would be indistinguishable from any other number in a
//   console log or a debugger, and "why is this API returning 7" is a
//   question nobody should have to ask. Arguments accept either form,
//   so passing the whole object straight back works.
//
// Lifetime is EXPLICIT. JS holds a number; Dart cannot know when that
// number becomes garbage, and a FinalizationRegistry would tie native
// resource release to GC timing — which is nondeterministic, and for a
// camera or a file lock that is a bug, not a latency detail. So:
// whoever takes a handle releases it.
//
//   const cam = await camera.open();
//   try { … } finally { await camera.release(cam); }
//
// A leaked handle costs one map entry plus whatever the object holds.
// A double release is a no-op, not an error — releasing twice is a
// symptom of confusing cleanup paths, and crashing on it turns a small
// confusion into a dead app.

import 'dart:async';

/// Wire key for the handle id. The `$` prefix marks it as a Skal
/// protocol field rather than data, matching the `$type` discriminator
/// the subtype-union encoder uses.
const String kHandleIdKey = r'$skalHandle';

/// Wire key for the handle's Dart type name — diagnostics only. Dart
/// never trusts it on the way back in; the handle id is authoritative.
const String kHandleTypeKey = r'$type';

/// Dart-side handle table. Not per-bridge: handles outlive any single
/// node and an app has exactly one bridge, so a global table matches
/// the lifetime that actually exists.
class SkalHandles {
  SkalHandles._();

  static final Map<int, Object> _objects = <int, Object>{};

  /// Monotonic. Never reused, even after release — a stale JS-side
  /// handle must fail to resolve rather than silently address whatever
  /// object landed in the recycled slot. Recycling ids here would turn
  /// a use-after-release into a use-after-*substitution*, which is the
  /// far worse bug.
  static int _nextId = 1;

  /// Store [object] and return its handle id.
  static int retain(Object object) {
    final id = _nextId++;
    _objects[id] = object;
    return id;
  }

  /// Resolve a handle to its object, or null when the id is unknown
  /// (released, never issued, or the wrong type).
  static T? resolve<T>(int id) {
    final o = _objects[id];
    return o is T ? o : null;
  }

  /// Drop a handle. Returns true if one was held.
  ///
  /// Calls `dispose()` on the object when it has one, so the common
  /// case — a controller — does the right thing without every service
  /// re-implementing teardown. A `dispose()` that throws is swallowed:
  /// release is cleanup, usually in a `finally`, and an exception
  /// there would mask whatever the caller was actually handling.
  static bool release(int id) {
    final o = _objects.remove(id);
    if (o == null) return false;
    try {
      final dynamic d = o;
      final result = d.dispose();
      if (result is Future) unawaited(result.catchError((_) {}));
    } catch (_) {
      // No dispose(), or it threw. Either way the handle is gone.
    }
    return true;
  }

  /// Release everything. Wired into the JS hot-reload teardown
  /// (`opResetRootSubtree` in bridge.dart): the discarded bundle's
  /// handle ids are unrecoverable, so its objects are released — and
  /// disposed — with the generation that owned them. Also available to
  /// JS as `handles.releaseAll()` and useful in test teardown.
  static void releaseAll() {
    for (final id in _objects.keys.toList()) {
      release(id);
    }
  }

  /// Live handle count. Diagnostics — a number that only grows is the
  /// signature of a missing release.
  static int get liveCount => _objects.length;
}

/// Wrap [object] as the wire form a service returns. Null passes
/// through so a nullable native getter stays nullable in JS.
Object? skalHandleOf(Object? object) {
  if (object == null) return null;
  return <String, Object?>{
    kHandleIdKey: SkalHandles.retain(object),
    kHandleTypeKey: object.runtimeType.toString(),
  };
}

/// Read a handle argument back into its object.
///
/// Accepts the full wire object (`{$skalHandle: 7, …}`) or a bare int,
/// so JS can pass back exactly what it received or just the number.
/// Returns null when the handle is unknown or holds the wrong type —
/// the generated caller decides whether that is fatal.
T? skalHandleArg<T>(Object? raw) {
  final id = skalHandleId(raw);
  return id == null ? null : SkalHandles.resolve<T>(id);
}

/// Extract the handle id from either wire form — the full object
/// (`{$skalHandle: 7, …}`) or a bare number — or null when [raw] is
/// neither. The single place the wire format is parsed: the built-in
/// `handles.release` arm and every generated arg reader route through
/// here, so a format change can never leave release() behind.
int? skalHandleId(Object? raw) {
  if (raw is int) return raw;
  if (raw is Map) {
    final id = raw[kHandleIdKey];
    if (id is num) return id.toInt();
  }
  return null;
}
