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
// Re-generation flow (CLI path, used for LOCAL widgets — build_runner
// is reserved for wrapping third-party pub.dev packages via the
// `lib/skal_codegen.yaml` marker file):
//
//   $ cd flutter/skal_flutter
//   $ dart run ../../codegen/skal_codegen/bin/skal_codegen.dart \
//       lib/adapters/greeting_widget.dart \
//       -o lib/adapters/generated/skal_adapters.g.dart
//
// Emits both `skal_adapters.g.dart` (the Dart adapter) and a sibling
// `skal_adapters.json` manifest the Vite plugin reads to auto-wire
// the JSX side — no per-widget JS stub modules required.

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

/// A stateful counter that fires typed + void callbacks back to JSX.
/// Exercises the codegen's callback path end-to-end:
///
///   `<Counter onChanged={(n) => …} onReset={() => …} initial={5} />`
///
/// Generated adapter wires:
///   • initial → JSX int prop, read via getCustomPropU32
///   • onChanged → ValueChanged<int>, emits dispatchEventInt(handlerId, n)
///   • onReset   → VoidCallback,     emits dispatchEvent(handlerId)
///
/// Two buttons inside the widget bump or reset the count, calling
/// the respective Dart callbacks. The codegen handles the JSX bind.
class Counter extends StatefulWidget {
  final int initial;
  final ValueChanged<int>? onChanged;
  final VoidCallback? onReset;

  const Counter({
    super.key,
    this.initial = 0,
    this.onChanged,
    this.onReset,
  });

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  late int _count = widget.initial;

  void _bump(int delta) {
    setState(() => _count += delta);
    widget.onChanged?.call(_count);
  }

  void _reset() {
    setState(() => _count = widget.initial);
    widget.onReset?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        TextButton(onPressed: () => _bump(-1), child: const Text('−')),
        Text('count: $_count',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        TextButton(onPressed: () => _bump(1), child: const Text('+')),
        TextButton(onPressed: _reset, child: const Text('reset')),
      ],
    );
  }
}

/// A vertically-stacked group of children sitting on a colored card.
/// Exercises the codegen's `List<Widget> children` encoding — every
/// JSX child element becomes one row inside the column.
///
/// JSX usage:
///
/// ```jsx
/// <Stickers background={0xFFFFE082} gap={8}>
///   <Greeting name="Stacked A" />
///   <Greeting name="Stacked B" />
///   <Greeting name="Stacked C" />
/// </Stickers>
/// ```
///
/// Codegen output (see lib/adapters/generated/skal_adapters.g.dart):
///
/// ```dart
/// children: List.generate(n.childCount, (i) => SkalNode(
///                nodeId: n.childAt(i), bridge: bridge,
///                key: ValueKey<int>(n.childAt(i)))),
/// ```
class Stickers extends StatelessWidget {
  final List<Widget> children;
  final Color background;
  final Gradient? gradient;
  final double gap;
  final double padding;

  const Stickers({
    super.key,
    this.children = const [],
    this.background = const Color(0xFFFFE082),
    this.gradient,
    this.gap = 8.0,
    this.padding = 12.0,
  });

  @override
  Widget build(BuildContext context) {
    // Interleave children with SizedBox gaps so we don't need
    // `Column.gap` (which Flutter only added recently). Keeps the
    // widget runnable on older Flutter versions in CI.
    final spaced = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) spaced.add(SizedBox(height: gap));
      spaced.add(children[i]);
    }
    return Container(
      decoration: BoxDecoration(
        // Gradient takes precedence over solid color when both are
        // set — same precedence Flutter's own BoxDecoration uses
        // (gradient overrides color visually).
        color: gradient == null ? background : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: EdgeInsets.all(padding),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: spaced,
      ),
    );
  }
}
