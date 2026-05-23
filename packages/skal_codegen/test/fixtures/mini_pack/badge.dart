// Fixture file #1 — a small Widget with a mix of primitive types
// the codegen handles natively.
//
// Together with `panel.dart` + the non-widget `helpers.dart`, this
// exercises the multi-file scanning path: the generator should
// produce ONE output file with TWO `_build_*` functions and ONE
// `registerAll()` listing both. The helper file contributes nothing
// but must not error out the walk.

import '../_fake_flutter.dart';

class Badge extends StatelessWidget {
  final String text;
  final Color color;
  final int count;

  const Badge({
    super.key,
    this.text = 'New',
    this.color = const Color(0xFFFF0000),
    this.count = 0,
  });

  @override
  Widget build(BuildContext context) => Text('$text ($count)');
}
