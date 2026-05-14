// Test fixture for named-constructor codegen support.
//
// Three classes, each exercising a different named-ctor shape:
//
//   • `Card` — has BOTH a default ctor AND a named one (`Card.outlined`).
//     Generator should emit TWO adapters: `<Card>` and `<CardOutlined>`,
//     each calling the respective constructor with its own param list.
//
//   • `Sheet` — has ONLY a named ctor (`Sheet.elevated`). No default
//     means no `<Sheet>` symbol — only `<SheetElevated>`. Validates
//     that the absence of a default ctor doesn't cause a skip or
//     error.
//
//   • `Link` — has a default ctor and a redirecting named ctor
//     (`Link.empty` redirects to `Link(label: '')`). The redirecting
//     one should be SKIPPED — emitting it would produce a duplicate
//     adapter that calls the same underlying constructor.

import '_fake_flutter.dart';

class Card extends StatelessWidget {
  final String title;
  final Color background;

  const Card({
    super.key,
    this.title = 'untitled',
    this.background = const Color(0xFFFFFFFF),
  });

  // Named ctor: different default for `background`, no param of its
  // own. Generator emits a separate adapter that calls Card.outlined()
  // — the wrap-target's own constructor logic chooses how it composes.
  const Card.outlined({
    super.key,
    this.title = 'untitled',
  }) : background = const Color(0xFF000000);

  @override
  Widget build(BuildContext context) => const Text('');
}

class Sheet extends StatelessWidget {
  final String label;

  // No default ctor declared, so the implicit no-arg one is
  // suppressed. Only the named ctor is callable. Adapter surfaces as
  // <SheetElevated>.
  const Sheet.elevated({
    super.key,
    this.label = 'sheet',
  });

  @override
  Widget build(BuildContext context) => const Text('');
}

class Link extends StatelessWidget {
  final String label;

  const Link({
    super.key,
    this.label = 'click me',
  });

  // Redirecting ctor — should be SKIPPED by the eligibility filter so
  // we don't emit `_build_LinkEmpty` that just calls Link() with the
  // same default. The target ctor (the default one above) is the
  // canonical entry point and already handles the empty case via its
  // own default.
  const Link.empty({Key? key}) : this(key: key, label: '');

  @override
  Widget build(BuildContext context) => const Text('');
}
