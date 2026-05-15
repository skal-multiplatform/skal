// Test fixture for NULLABLE primitive constructor params.
//
// Regression guard for the nullable-coercion bug: the `double` / `int`
// / `bool` / `Color` encoders used to ALWAYS coerce a missing JSX prop
// to a zero value (`0.0` / `0` / `false` / opaque black), even when
// the param was nullable. A nullable param the consumer omits must
// read as `null` — the wrapped widget often treats null distinctly
// (flutter_map's `TileLayer.tileSize` divides by it; many widgets
// treat `color: null` as "inherit theme").
//
// `Tunable` mixes nullable and non-nullable params of each type so the
// snapshot captures BOTH emission shapes side by side:
//
//   nullable     → n.getCustomProp<T>OrNull('name')   (null when unset)
//   non-nullable → n.getCustomProp<T>('name', <fallback>)
//
// Color? gets the IIFE form (the U32 channel can't natively express
// null, so the reader maps the OrNull int → Color or null).

import '_fake_flutter.dart';

class Tunable extends StatelessWidget {
  // Nullable — must read via the *OrNull getters.
  final double? opacity;
  final int? maxLines;
  final bool? dense;
  final Color? tint;

  // Non-nullable counterparts — must keep the zero-fallback form.
  final double scale;
  final int priority;
  final bool enabled;
  final Color background;

  const Tunable({
    super.key,
    this.opacity,
    this.maxLines,
    this.dense,
    this.tint,
    this.scale = 1.0,
    this.priority = 0,
    this.enabled = true,
    this.background = const Color(0xFF202020),
  });

  @override
  Widget build(BuildContext context) => const Text('');
}
