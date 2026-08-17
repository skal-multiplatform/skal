// Get a frame on screen before the app's tree is ready, so Android's
// splash-reveal animation overlaps boot instead of following it.
//
// WHY
// ---
// Flutter holds the Android 12+ system splash until its first frame. The
// system then runs a `starting_reveal` animation to hand over. Measured
// on a Galaxy A14 (release, arm64): that reveal keeps the splash
// composited for ~90 ms AFTER Flutter's content has already presented —
// pure serial latency at the end of cold start.
//
// React Native does not pay it the same way: its window comes up early
// (empty), so the same reveal runs concurrently with JS startup and is
// finished by the time content lands. This closes that gap.
//
// MEASURED: platform tax 186 -> 173 ms, total cold start 346 -> 320 ms.
// A/B/A, n=10 per block, 6 ms session drift. See
// docs/BENCHMARKS.md.
//
// THE SHAPE MATTERS — THIS IS THE SECOND ATTEMPT
// ----------------------------------------------
// The obvious implementation is:
//
//     runApp(placeholder);   ... heavy init ...;   runApp(realApp);
//
// That REPLACES the root widget, so Flutter tears down the first element
// tree and builds a second one. Measured cost: platform tax 163 -> 170 ms,
// a 13 ms REGRESSION that exactly cancelled the engine pre-warm's gain.
// Dismissing the splash sooner is worth less than building two trees
// costs.
//
// [SkalEarlyFrame] calls runApp ONCE with a stable root and swaps only
// the CHILD, so the element tree above the swap survives and the real app
// is a subtree insert. Same idea, opposite sign.
//
// USAGE
// -----
// ```dart
// void main() async {
//   WidgetsFlutterBinding.ensureInitialized();
//   final early = SkalEarlyFrame.show();   // paints immediately
//
//   ... Skal.create(), bundle eval, pumpOps ...
//
//   early.reveal(SkalRoot(bridge: bridge));  // subtree insert
// }
// ```
//
// Pass `background` to match your launch theme's `windowBackground`, or
// the handover shows as a flash. Default is opaque white, which is what
// Flutter's generated `launch_background.xml` uses.
//
// Android-specific in benefit, harmless elsewhere: on iOS/macOS/desktop
// the placeholder frame is simply one cheap frame before the real tree.
import 'package:flutter/widgets.dart';

/// Handle returned by [SkalEarlyFrame.show]. Call [reveal] once the real
/// tree is ready.
class SkalEarlyFrame {
  SkalEarlyFrame._(this._slot, this.root);

  final ValueNotifier<Widget?> _slot;

  /// The stable root. [show] hands this to `runApp`; tests pump it
  /// directly so the "element tree survives reveal" property — the whole
  /// point of this class — can be asserted rather than assumed.
  final Widget root;

  /// Paint a placeholder frame now and return a handle to swap it out.
  ///
  /// Calls `runApp` — do not call `runApp` again afterwards; use [reveal],
  /// which inserts into the existing tree instead of replacing it.
  static SkalEarlyFrame show({Color background = const Color(0xFFFFFFFF)}) {
    final f = _build(background);
    runApp(f.root);
    return f;
  }

  /// Same object graph as [show] without touching `runApp`, for tests.
  @visibleForTesting
  static SkalEarlyFrame forTest({Color background = const Color(0xFFFFFFFF)}) =>
      _build(background);

  static SkalEarlyFrame _build(Color background) {
    final slot = ValueNotifier<Widget?>(null);
    return SkalEarlyFrame._(
        slot, _EarlyRoot(slot: slot, background: background));
  }

  /// Swap the placeholder for the real app. A subtree insert under a root
  /// that already exists — not a second tree.
  ///
  /// Idempotent: calling it again just replaces the child again.
  void reveal(Widget app) => _slot.value = app;
}

class _EarlyRoot extends StatelessWidget {
  const _EarlyRoot({required this.slot, required this.background});

  final ValueNotifier<Widget?> slot;
  final Color background;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<Widget?>(
        valueListenable: slot,
        builder: (_, child, _) => child ?? ColoredBox(color: background),
      );
}
