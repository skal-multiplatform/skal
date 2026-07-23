// Fixture for the `services:` path (Roadmap A2) — a headless
// capability class shaped like a real plugin's static API.
//
// Deliberately covers every branch the service emitter has to decide:
//
//   • void / bool / int / double / String returns   → pass through
//   • a class WITH toJson()                          → pass through
//     (the bridge's jsonEncode calls it)
//   • a class WITHOUT toJson()                       → emitted encoder
//   • an enum return                                 → `.name`
//   • Future<T>                                      → `.then(...)`
//   • Stream<T>                                      → `.map(...)`
//   • List<T>                                        → elementwise
//   • enum + value-class + primitive parameters      → arg readers
//   • a parameter type nothing can reconstruct       → method skipped,
//     service still ships (the B4 rule applied to methods)

import 'dart:async';

enum LocationAccuracy { low, medium, high }

/// Has a toJson() — the plugin author already answered the
/// serialization question, so codegen must not emit an encoder.
class Position {
  const Position({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;

  Map<String, Object?> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
      };
}

/// No toJson() — codegen has to walk its public getters.
class Battery {
  const Battery(this.level, this.charging, this.health);

  final int level;
  final bool charging;
  final LocationAccuracy health;
}

/// A plain value class used as a METHOD ARGUMENT — reconstructed from
/// the decoded JSON map the bridge hands the dispatcher.
class Region {
  const Region({
    required this.latitude,
    required this.longitude,
    this.radiusMeters = 100.0,
    this.label = '',
  });

  final double latitude;
  final double longitude;
  final double radiusMeters;
  final String label;
}

/// Not reconstructable from JSON and not encodable — the method that
/// touches it must be dropped without taking the service down.
class NativeHandle {
  NativeHandle(this._raw);
  final Object _raw;
  Object get raw => _raw;
  void dispose() {}
}

class Geo {
  static Future<Position> getCurrentPosition({
    LocationAccuracy accuracy = LocationAccuracy.medium,
  }) async =>
      const Position(latitude: 0, longitude: 0);

  static Stream<Position> positionStream({double distanceFilter = 0.0}) =>
      const Stream<Position>.empty();

  static Future<List<Position>> history(int limit) async => const [];

  static Battery battery() => const Battery(50, false, LocationAccuracy.high);

  static LocationAccuracy currentAccuracy() => LocationAccuracy.medium;

  static bool isInside(Region region, double lat, double lng) => false;

  static Future<void> startTracking(String tag) async {}

  /// List-of-primitive arg — must decode elementwise via
  /// `List<String>.from`, NOT route to the opaque-handle fallback
  /// (which erased the type param to `List<dynamic>` and broke the
  /// call site — caught live wrapping share_plus's shareXFiles).
  static Future<void> sharePaths(List<String> paths) async {}

  /// List-of-value-class arg — per-element parse + `whereType<Region>`
  /// filter so a malformed element drops instead of crashing the call.
  static bool coversAll(List<Region> regions) => false;

  static String describe() => 'geo';

  /// Dropped: no way to rebuild a NativeHandle from a bridge arg.
  static void attach(NativeHandle handle) {}

  /// Dropped: nothing can serialize a NativeHandle back to JS.
  static NativeHandle acquire() => NativeHandle(0);

  /// FutureOr — exposes only Object members, so a wrapped return must
  /// normalize through Future.value before `.then` exists.
  static FutureOr<LocationAccuracy> pickAccuracy() => LocationAccuracy.medium;

  /// Dropped: a stream of unserializable values would retain one
  /// opaque handle per event with nothing releasing them.
  static Stream<NativeHandle> handleStream() => const Stream.empty();

  /// Not static — instance methods belong to A3 (opaque handles).
  Future<void> ignored() async {}
}
