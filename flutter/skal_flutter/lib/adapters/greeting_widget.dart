// `Greeting` — the same demo widget that previously lived inline in a
// hand-written adapter (`greeting.dart`). Pulled out into a real
// Flutter Widget class so the codegen tool can wrap it automatically.
//
// What this proves end-to-end:
//
//   1. The dev writes ordinary Flutter Widget code — exactly what
//      they'd write without Skal — placing all rendering logic
//      (Padding, Text, TextStyle, string interpolation, etc.) inside
//      the build() method.
//   2. Codegen (`codegen/skal_codegen`) reads this file, walks the
//      Greeting constructor, emits a registry adapter at
//      `lib/adapters/generated/skal_adapters.g.dart`.
//   3. The dev's main.dart calls the generated `registerAll()`
//      function once at startup.
//   4. `<Greeting name="…" color={…} fontSize={…} />` works from JSX
//      identically to the prior hand-written adapter.
//
// This file's relationship to a real third-party Flutter package:
//
//   • For a real wrap target (e.g. `qr_flutter`), the dev doesn't
//     write any Widget class — they install the package and run
//     codegen against the package's `lib/`. The codegen reads someone
//     else's already-published Widget classes the same way it reads
//     this one.
//   • For local widgets that JUST happen to be Flutter Widgets but
//     belong to the dev's own app, this file's shape is exactly what
//     they'd write. Codegen wraps everything in `lib/` (or whichever
//     directory they point it at) and registers all of it.
//
// Re-generation flow (until build_runner integration lands):
//
//   $ cd flutter/skal_flutter
//   $ dart run ../../codegen/skal_codegen/bin/skal_codegen.dart \
//       lib/adapters/greeting_widget.dart \
//       -o lib/adapters/generated/skal_adapters.g.dart

import 'package:flutter/material.dart';

class Greeting extends StatelessWidget {
  final String name;
  final Color color;
  final double fontSize;

  const Greeting({
    super.key,
    this.name = 'World',
    this.color = const Color(0xFF000000),
    this.fontSize = 24.0,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Text(
        'Hello, $name!',
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
