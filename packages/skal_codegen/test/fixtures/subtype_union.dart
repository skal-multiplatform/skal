// Fixture for B1 — subtype unions.
//
// `Gradient` was already handled by a hand-written
// `_skalParseGradient` that switches on a discriminator field. Every
// OTHER abstract param type was rejected outright, so a widget taking
// a `ShapeBorder`, `ScrollPhysics`, `Decoration` or `TileProvider` was
// skipped entirely.
//
// `Frame` here is that shape: an abstract base with three concrete
// subclasses, each of which the value-class encoder can already build.
// The only thing that was missing is the dispatch layer above them.

import '_fake_flutter.dart';

abstract class Frame {
  const Frame();
}

class SquareFrame extends Frame {
  const SquareFrame({this.thickness = 1.0});
  final double thickness;
}

class RoundFrame extends Frame {
  const RoundFrame({this.radius = 4.0, this.thickness = 1.0});
  final double radius;
  final double thickness;
}

class BeveledFrame extends Frame {
  const BeveledFrame({this.cut = 2.0});
  final double cut;
}

/// Abstract but with NO concrete subclasses in the analyzed set — must
/// still be rejected, and must reject the widget that requires it
/// rather than emitting a parser with an empty switch.
abstract class Unknowable {
  const Unknowable();
}

class Card extends StatelessWidget {
  const Card({this.frame = const SquareFrame(), this.label = ''});

  final Frame frame;
  final String label;

  @override
  Widget build(BuildContext context) => Text(label);
}

class Unbuildable extends StatelessWidget {
  const Unbuildable({required this.thing});

  final Unknowable thing;

  @override
  Widget build(BuildContext context) => const Text('');
}

/// B6 — a generic widget class. Nothing in `Chip<T>` says what T should
/// be, so codegen can't pick; an `overrides: { typeArgs: [...] }` entry
/// has to say. Note `payloads` is a `List<T>` too, which is why the
/// constructor must be read off the INSTANTIATED type — otherwise the
/// encoder sees a bare type variable and gives up.
class Chip<T> extends StatelessWidget {
  const Chip({required this.label, this.payloads = const []});

  final String label;
  final List<T> payloads;

  @override
  Widget build(BuildContext context) => Text(label);
}
