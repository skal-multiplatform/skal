// Test fixture — a target Widget class that the codegen should
// process. Mimics the shape of `flutter/skal_flutter/lib/adapters/greeting.dart`
// but framed as an INPUT to the generator (representing some
// hypothetical pub.dev package's exported widget), not an output.
//
// Constructor has three primitive-typed named parameters with default
// values:
//
//   String? message    → getCustomPropStr('message') ?? 'Hello'
//   Color? color       → Color(getCustomPropU32('color', 0xFF000000))
//   double? fontSize   → getCustomPropF32('fontSize', 14.0)
//
// What we want the generator to read off the constructor here, the
// matching expected output file (fancy_text.expected.dart) shows
// verbatim. If the test passes, the generator correctly mapped each
// param's type + default to the right `n.getCustomPropX(name, default)`
// call and emitted a single `SkalRegistry.registerWidget` call.

// Fixture imports the fake-Flutter shim instead of real
// `package:flutter/material.dart` — see _fake_flutter.dart for why.
// In real codegen usage the input file would have `package:flutter/…`
// imports and the generator's behavior is identical.
import '_fake_flutter.dart';

class FancyText extends StatelessWidget {
  final String message;
  final Color color;
  final double fontSize;

  const FancyText({
    super.key,
    this.message = 'Hello',
    this.color = const Color(0xFF000000),
    this.fontSize = 14.0,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      message,
      style: TextStyle(color: color, fontSize: fontSize),
    );
  }
}
