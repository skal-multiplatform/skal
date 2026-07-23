// Regression tests for SkalFill — the widget behind every
// `width="fill"` / `height="fill"` (root.dart) and the codegen
// adapters' _skalApplyBaseProps sizing.
//
// The bug this pins down: fill used to be a raw SizedBox(∞), which
// under an UNBOUNDED axis (a fill-width Column inside a Row, a
// fill-height child inside a Column) threw "BoxConstraints forces an
// infinite width/height" — and one throwing node aborts Flutter's
// entire layout flush, so the whole app rendered blank with nothing
// legible in the iOS logs. SkalFill's contract per axis:
//
//   finite value    → exact dp (SizedBox parity, clamped to parent)
//   double.infinity → fill IF the incoming max is bounded,
//                     else wrap content — never throw
//   null            → constraints pass through untouched

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:skal_flutter/skal/root.dart' show SkalFill;

void main() {
  Future<Size> sizeOf(WidgetTester tester, Widget widget) async {
    final key = GlobalKey();
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: KeyedSubtree(key: key, child: widget)),
      ),
    );
    expect(tester.takeException(), isNull,
        reason: 'SkalFill must never throw during layout');
    return (key.currentContext!.findRenderObject()! as RenderBox).size;
  }

  testWidgets('fill under BOUNDED constraints fills the axis',
      (tester) async {
    final size = await sizeOf(
      tester,
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300, maxHeight: 200),
        child: const SkalFill(
          width: double.infinity,
          child: SizedBox(width: 10, height: 10),
        ),
      ),
    );
    expect(size.width, 300, reason: 'fill = as much as the parent allows');
    expect(size.height, 10, reason: 'unset axis wraps the child');
  });

  testWidgets('fill under UNBOUNDED width wraps instead of throwing',
      (tester) async {
    // The exact shape that used to blank the app: a fill-width child
    // inside a Row (unbounded width for non-flex children).
    final size = await sizeOf(
      tester,
      Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          SkalFill(
            width: double.infinity,
            child: SizedBox(width: 40, height: 20),
          ),
        ],
      ),
    );
    expect(size.width, 40, reason: 'unbounded + fill degrades to wrap');
    expect(size.height, 20);
  });

  testWidgets('fill under UNBOUNDED height wraps instead of throwing',
      (tester) async {
    // Fill-height child inside a Column (unbounded main axis).
    final size = await sizeOf(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: const [
          SkalFill(
            height: double.infinity,
            child: SizedBox(width: 25, height: 35),
          ),
        ],
      ),
    );
    expect(size.height, 35, reason: 'unbounded + fill degrades to wrap');
    expect(size.width, 25);
  });

  testWidgets('finite dims behave like SizedBox (exact, clamped)',
      (tester) async {
    final size = await sizeOf(
      tester,
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 120, maxHeight: 500),
        child: const SkalFill(
          width: 200, // clamped by the parent's 120
          height: 80,
          child: SizedBox(width: 5, height: 5),
        ),
      ),
    );
    expect(size.width, 120, reason: 'exact width clamps to parent max');
    expect(size.height, 80, reason: 'exact height applies');
  });

  testWidgets('null axes pass constraints through untouched',
      (tester) async {
    final size = await sizeOf(
      tester,
      const SkalFill(child: SizedBox(width: 33, height: 44)),
    );
    expect(size, const Size(33, 44));
  });

  testWidgets('no child: fill sizes to max when bounded, zero when not',
      (tester) async {
    final bounded = await sizeOf(
      tester,
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 90, maxHeight: 70),
        child: const SkalFill(width: double.infinity),
      ),
    );
    expect(bounded.width, 90);
    final unbounded = await sizeOf(
      tester,
      Row(
        mainAxisSize: MainAxisSize.min,
        children: const [SkalFill(width: double.infinity)],
      ),
    );
    expect(unbounded.width, 0, reason: 'nothing to wrap, nothing to fill');
  });
}
