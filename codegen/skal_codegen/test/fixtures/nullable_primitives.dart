// Test fixture for NULLABLE primitive + U32-channel constructor params.
//
// Regression guard for the nullable-coercion bug: the `double` / `int`
// / `bool` / `Color` / enum / `Duration` encoders used to ALWAYS
// coerce a missing JSX prop to a zero value (`0.0` / `0` / `false` /
// opaque black / `values[defaultIndex]` / `Duration(milliseconds: 0)`),
// even when the param was nullable. A nullable param the consumer
// omits must read as `null` — the wrapped widget often treats null
// distinctly (flutter_map's `TileLayer.tileSize` divides by it; many
// widgets treat `color: null` as "inherit theme").
//
// `Tunable` mixes nullable and non-nullable params of each type so the
// snapshot captures BOTH emission shapes side by side:
//
//   nullable     → n.getCustomProp<T>OrNull('name')   (null when unset)
//   non-nullable → n.getCustomProp<T>('name', <fallback>)
//
// Color?, enum?, and Duration? get the IIFE form (the U32 channel
// can't natively express null, so the reader maps the OrNull int →
// the typed value or null).

import '_fake_flutter.dart';

/// Local enum so the fixture exercises the enum encoder without
/// depending on a Flutter enum.
enum Density { compact, comfortable, spacious }

class Tunable extends StatelessWidget {
  // Nullable — must read via the *OrNull getters.
  final double? opacity;
  final int? maxLines;
  final bool? dense;
  final Color? tint;
  final Density? density;
  final Duration? fadeIn;

  // Non-nullable counterparts — must keep the zero-fallback form.
  final double scale;
  final int priority;
  final bool enabled;
  final Color background;
  final Density layout;
  final Duration animation;

  const Tunable({
    super.key,
    this.opacity,
    this.maxLines,
    this.dense,
    this.tint,
    this.density,
    this.fadeIn,
    this.scale = 1.0,
    this.priority = 0,
    this.enabled = true,
    this.background = const Color(0xFF202020),
    this.layout = Density.comfortable,
    this.animation = const Duration(milliseconds: 250),
  });

  @override
  Widget build(BuildContext context) => const Text('');
}
