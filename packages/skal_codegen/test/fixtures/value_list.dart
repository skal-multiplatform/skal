// Fixture for B5 — `List<ValueClass>` as child nodes.
//
// `List<Marker>` is what kills flutter_map's MarkerLayer, and markers
// are the single most-used map feature. `Pin` here stands in for
// Marker: an ordinary value class that the encoder can already build,
// which is only unreachable because it arrives inside a List.
//
// The fix is deliberately NOT "encode the list as one JSON array
// prop". That is O(n) per change — add one pin and you re-encode,
// re-send and re-parse all thousand. Child nodes are diffed per-node
// by the tree machinery that already exists, so adding a pin costs
// one node.

import '_fake_flutter.dart';

class LatLng {
  const LatLng({this.latitude = 0.0, this.longitude = 0.0});
  final double latitude;
  final double longitude;
}

/// The element class. Nested value class (`LatLng`) included on
/// purpose: the child builder has to run the full encoder, not just
/// primitives.
class Pin {
  const Pin({
    this.point = const LatLng(),
    this.label = '',
    this.size = 24.0,
  });

  final LatLng point;
  final String label;
  final double size;
}

/// The widget that was unreachable. One `List<Pin>` param and nothing
/// else exotic.
class PinLayer extends StatelessWidget {
  const PinLayer({required this.pins, this.rotate = false});

  final List<Pin> pins;
  final bool rotate;

  @override
  Widget build(BuildContext context) => const Text('');
}
