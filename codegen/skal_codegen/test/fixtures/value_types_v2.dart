// Test fixture for the v2 batch of value types added to type_mapper:
// TextStyle, BoxDecoration, BorderRadius, Offset, Alignment,
// ImageProvider. Each is a small `is*` predicate + an encoder branch
// in encodingFor() that decomposes the type into JSX sub-props (or
// emits a string-coercion helper, for ImageProvider).

import '_fake_flutter.dart';

class Styled extends StatelessWidget {
  final TextStyle style;
  const Styled({super.key, this.style = const TextStyle(
    fontSize: 14,
    color: Color(0xFF000000),
    fontWeight: FontWeight.w400,
    letterSpacing: 0.5,
    height: 1.2,
  )});
  @override Widget build(BuildContext context) => const Text('');
}

class Card extends StatelessWidget {
  final BoxDecoration decoration;
  final BorderRadius radius;
  const Card({
    super.key,
    this.decoration = const BoxDecoration(
      color: Color(0xFFEEEEEE),
      borderRadius: BorderRadius.all(Radius.circular(8)),
    ),
    this.radius = const BorderRadius.all(Radius.circular(4)),
  });
  @override Widget build(BuildContext context) => const Text('');
}

class Anchored extends StatelessWidget {
  final Offset position;
  final Alignment anchor;
  const Anchored({
    super.key,
    this.position = const Offset(10, 20),
    this.anchor = const Alignment(0, 0),
  });
  @override Widget build(BuildContext context) => const Text('');
}

class Pic extends StatelessWidget {
  final ImageProvider image;
  const Pic({super.key, this.image = const AssetImage('placeholder.png')});
  @override Widget build(BuildContext context) => const Text('');
}
