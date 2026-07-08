// Test fixture for Gradient codegen support.
//
// `Painted` exercises the Gradient encoder — the field type is the
// abstract `Gradient`, which the codegen recognizes (also covers
// LinearGradient/RadialGradient/SweepGradient subtypes). The encoder
// emits a single `_skalParseGradient(json)` call + injects three
// shared helpers at the top of the generated file (deduplicated, so
// multiple widgets with Gradient params land the same helper code
// just once).

import '_fake_flutter.dart';

class Painted extends StatelessWidget {
  final Gradient? gradient;
  const Painted({super.key, this.gradient});
  @override
  Widget build(BuildContext context) => const Text('');
}

class Banner extends StatelessWidget {
  final Gradient gradient;
  final String label;
  const Banner({
    super.key,
    required this.gradient,
    this.label = 'banner',
  });
  @override
  Widget build(BuildContext context) => const Text('');
}
