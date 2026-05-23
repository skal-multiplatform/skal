// Test fixture for List<Widget> children codegen support.
//
// Multi-child wrapper widgets (Wrap, Stack, Flow, third-party
// StaggeredGrid, etc.) all take `List<Widget> children` as their
// signature primitive. Each JSX child becomes one element of that
// list; the codegen-emitted reader walks NodeState.childCount and
// emits one SkalNode per child.
//
//   • `Grid`   — `List<Widget> children` (non-nullable, required-ish
//                via `const []` default). Validates the encoding fires
//                + composes with primitive sibling params.
//
//   • `LayerStack` — also `List<Widget>` but with a different param
//                name (`layers`). Validates the encoding doesn't
//                hardcode the param name "children" anywhere.

import '_fake_flutter.dart';

class Grid extends StatelessWidget {
  final List<Widget> children;
  final int columns;

  const Grid({
    super.key,
    this.children = const [],
    this.columns = 2,
  });

  @override
  Widget build(BuildContext context) => const Text('');
}

class LayerStack extends StatelessWidget {
  final List<Widget> layers;
  final Color background;

  const LayerStack({
    super.key,
    this.layers = const [],
    this.background = const Color(0xFF000000),
  });

  @override
  Widget build(BuildContext context) => const Text('');
}
