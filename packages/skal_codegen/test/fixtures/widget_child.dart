// Test fixture for widget-child codegen support.
//
// `Wrapper` exercises the `Widget child` constructor param — a
// non-nullable, required widget input. The codegen should detect
// the Widget type, emit a SkalNode-based reader, and skip the
// widget if no JSX child is provided (fallback: SizedBox.shrink).
//
// `Tinted` adds an optional `Widget?` child alongside a primitive
// param, validating that the encoding works in both nullable and
// non-nullable positions + composes with regular prop encodings.

import '_fake_flutter.dart';

class Wrapper extends StatelessWidget {
  final Widget child;

  const Wrapper({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) => child;
}

class Tinted extends StatelessWidget {
  final Widget? child;
  final Color tint;

  const Tinted({
    super.key,
    this.child,
    this.tint = const Color(0xFFAA0000),
  });

  @override
  Widget build(BuildContext context) => child ?? const Text('');
}
