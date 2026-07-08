// Test fixture for VoidCallback codegen support.
//
// `VoidCallback` is dart:ui's typedef for `void Function()` — the
// signature most "fire-and-forget" Flutter event hooks use: onPressed,
// onTap, onRefresh, onSubmit. The codegen detects either form (the
// typedef alias OR raw `void Function()`) and emits a closure that
// dispatches a bridge event by name.
//
// Two classes exercise both forms:
//
//   • `Tappable` — uses the typedef alias `VoidCallback onTap`. Most
//     real-world Flutter APIs reach for this form (it reads naturally
//     in IDE autocomplete + matches dart:ui's own convention).
//
//   • `Refreshable` — uses the raw `void Function()? onRefresh`. Some
//     packages prefer this form because it's self-documenting at the
//     declaration site without needing a typedef import.

import '_fake_flutter.dart';

class Tappable extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const Tappable({
    super.key,
    this.label = 'Tap me',
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Text(label);
}

class Refreshable extends StatelessWidget {
  final String label;
  final void Function()? onRefresh;

  const Refreshable({
    super.key,
    this.label = 'pull',
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) => Text(label);
}

/// Exercises every supported `ValueChanged<T>` shape in one widget.
/// Mirrors how real form widgets layer typed callbacks (Switch's
/// onChanged: bool, Slider's onChanged: double, custom widgets with
/// integer pickers). The codegen should emit dispatchEventBool /
/// dispatchEventDouble / dispatchEventInt respectively.
class Form extends StatelessWidget {
  final ValueChanged<bool>? onSwitch;
  final ValueChanged<double>? onSlide;
  final ValueChanged<int>? onPick;

  const Form({
    super.key,
    this.onSwitch,
    this.onSlide,
    this.onPick,
  });

  @override
  Widget build(BuildContext context) => const Text('form');
}

/// Multi-arg callbacks — codegen routes through dispatchEventTuple,
/// which JSON-encodes the arg list. JS-side drain spreads the array
/// on the bound handler: `fn(...args)`.
class TapList extends StatelessWidget {
  final void Function(int index, String payload)? onItemTap;
  final void Function(int oldIndex, int newIndex)? onReorder;

  const TapList({super.key, this.onItemTap, this.onReorder});

  @override
  Widget build(BuildContext context) => const Text('list');
}
