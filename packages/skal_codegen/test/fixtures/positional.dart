// Test fixture for positional-constructor-param codegen support.
//
// Real Flutter widgets like `Padding(this.padding, {this.child})` and
// `Text(this.data, {...})` use positional params for their primary
// argument. Previously codegen skipped positional params silently,
// emitting a constructor call with the positional slot empty —
// crashing at runtime.
//
// Now: positional params are walked in declaration order and emitted
// WITHOUT a name prefix on the constructor call. The JSX side still
// uses the param's declared name as the prop name.
//
//   • `Padded` — required positional `int` first, optional `Widget?`
//     named second. Generated adapter calls `Padded(<encoded>,
//     child: <encoded>)`.
//   • `Tagged` — required positional `String`, plus a default-valued
//     positional `int`. Both walked positionally, in order.

import '_fake_flutter.dart';

class Padded extends StatelessWidget {
  final int padding;
  final Widget? child;

  const Padded(this.padding, {super.key, this.child});

  @override
  Widget build(BuildContext context) => child ?? const Text('');
}

class Tagged extends StatelessWidget {
  final String label;
  final int badge;

  const Tagged(this.label, [this.badge = 0]);

  @override
  Widget build(BuildContext context) => Text(label);
}
