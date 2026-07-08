// Test fixture for the GENERIC value-class encoder.
//
// Real-world driver: flutter_map's `MapOptions` (a data-class wrapping
// LatLng + initial zoom + interaction flags) needed to be encodable
// without a hand-coded type_mapper branch. This fixture stands in for
// that shape:
//
//   • [GeoPoint] — leaf value class, two doubles. Mirrors `LatLng`.
//   • [GeoBounds] — nested value class, two GeoPoints. Mirrors
//                   `LatLngBounds`.
//   • [MapInit] — outer config record. Mixes nested value classes
//                 (`initialCenter: GeoPoint`, `bounds: GeoBounds?`),
//                 a primitive double with a default, a bool with a
//                 default, and a nullable Color (covered by the
//                 dedicated _skalParseColor helper).
//
// The widget under test takes a non-nullable MapInit param (with no
// declared default — JSX MUST set it; missing → `!` null-check trap)
// AND a nullable `GeoBounds?` for round-tripping the nullable case.
//
// Expected codegen behavior:
//
//   1. Emit ONE `_skalParseGeoPoint(Object? raw)` helper.
//   2. Emit ONE `_skalParseGeoBounds(Object? raw)` helper that calls
//      `_skalParseGeoPoint(raw['southwest'])` etc.
//   3. Emit ONE `_skalParseMapInit(Object? raw)` helper that calls
//      `_skalParseGeoPoint(raw['initialCenter'])`,
//      `_skalParseGeoBounds(raw['bounds'])`, etc.
//   4. The adapter reads each prop via `n.getCustomPropStr('paramName')`
//      and routes through the appropriate parser.

import '_fake_flutter.dart';

/// Plain value class: two doubles. Overrides `==` / `hashCode` and
/// exposes a computed getter — the analyzer induces SYNTHETIC backing
/// fields for those, which report `isFinal == false`. The value-class
/// eligibility heuristic must skip synthetic fields; otherwise this
/// (and every other well-written value class that implements value
/// equality) would be wrongly rejected as "stateful". Regression
/// guard for exactly that bug.
class GeoPoint {
  final double lat;
  final double lng;
  const GeoPoint(this.lat, this.lng);

  /// Computed getter → synthetic field. Must not trip the heuristic.
  bool get isOrigin => lat == 0 && lng == 0;

  @override
  bool operator ==(Object other) =>
      other is GeoPoint && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);
}

/// Nested value class: two GeoPoints. Forces the codegen to recurse one
/// level when emitting `_skalParseGeoBounds` — the southwest/northeast
/// field readers must call `_skalParseGeoPoint(raw['southwest'])` etc.
class GeoBounds {
  final GeoPoint southwest;
  final GeoPoint northeast;
  const GeoBounds(this.southwest, this.northeast);
}

/// Outer config record. Has named params with defaults, a required
/// nested value class, a nullable nested value class, and primitive
/// fields. Mirrors the flutter_map MapOptions shape that motivated
/// the encoder.
class MapInit {
  final GeoPoint initialCenter;
  final double initialZoom;
  final bool keepAlive;
  final GeoBounds? bounds;
  final Color? backgroundColor;
  const MapInit({
    required this.initialCenter,
    this.initialZoom = 13.0,
    this.keepAlive = false,
    this.bounds,
    this.backgroundColor,
  });
}

/// The widget the codegen wraps. Exercises:
///   • value-class param with no default (must provide via JSX)
///   • nullable value-class param (handles the null path)
///   • interleaving with a primitive prop (`label`) confirms the new
///     encoder doesn't disrupt existing branches
class MiniMap extends StatelessWidget {
  final MapInit init;
  final GeoBounds? cameraBounds;
  final String label;

  const MiniMap({
    super.key,
    required this.init,
    this.cameraBounds,
    this.label = 'map',
  });

  @override
  Widget build(BuildContext context) => const Text('');
}
