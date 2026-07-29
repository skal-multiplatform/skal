// SkalEarlyFrame exists to dismiss Android's system splash early so its
// ~90 ms `starting_reveal` animation overlaps boot instead of following
// it. The FIRST implementation of that idea was a 13 ms REGRESSION,
// because it did:
//
//     runApp(placeholder);  ...;  runApp(realApp);
//
// which replaces the root and makes Flutter build a second element tree.
// The whole value of this class is that it does NOT do that — one runApp,
// stable root, child swapped underneath.
//
// So the load-bearing test is not "does the child appear" (it obviously
// does) but "did the root survive the swap". If someone later
// 'simplifies' this back into two runApp calls, the perf win silently
// evaporates while the naive test still passes.
//
// MUTATION-CHECKED, and the results are worth recording because one of
// them was negative:
//
//   reveal(app) => runApp(app)          → `element identity survives
//     i.e. the actual regression          reveal` FAILS, and only it.
//                                         'reveal shows the real tree'
//                                         still passes, so that test is
//                                         NOT the guard.
//
//   builder wraps its output in          → ALL FOUR TESTS PASS.
//   KeyedSubtree(key: UniqueKey())         Internal subtree churn is NOT
//                                          covered — the assertion is on
//                                          the root element, which is the
//                                          widget the test pumped, so it
//                                          survives anything internal.
//
// In other words: this file guards against the root being replaced. It
// does NOT guard against the subtree below the builder being rebuilt
// every frame. If that becomes a concern, the test for it has to assert
// State survival below the swap point, which these tests do not do.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/early_frame.dart';

void main() {
  group('SkalEarlyFrame', () {
    testWidgets('paints the placeholder background before reveal',
        (tester) async {
      final early = SkalEarlyFrame.forTest(background: const Color(0xFF102030));
      await tester.pumpWidget(early.root);

      final box = tester.widget<ColoredBox>(find.byType(ColoredBox));
      expect(box.color, const Color(0xFF102030),
          reason: 'the placeholder must match the launch theme background, '
              'or the handover to the real tree shows as a flash');
      expect(find.text('real'), findsNothing);
    });

    testWidgets('reveal shows the real tree', (tester) async {
      final early = SkalEarlyFrame.forTest();
      await tester.pumpWidget(early.root);

      early.reveal(const Directionality(
        textDirection: TextDirection.ltr,
        child: Text('real'),
      ));
      await tester.pump();

      expect(find.text('real'), findsOneWidget);
      expect(find.byType(ColoredBox), findsNothing);
    });

    testWidgets('element identity survives reveal — the tree is NOT rebuilt',
        (tester) async {
      final early = SkalEarlyFrame.forTest();
      await tester.pumpWidget(early.root);

      // Identity of the root element BEFORE the swap.
      final before = tester.element(find.byWidget(early.root));

      early.reveal(const Directionality(
        textDirection: TextDirection.ltr,
        child: Text('real'),
      ));
      await tester.pump();

      final after = tester.element(find.byWidget(early.root));
      expect(after, same(before),
          reason: 'reveal must be a SUBTREE INSERT under a live root. A new '
              'root element means Flutter built a second tree, which is the '
              '13 ms regression this class was written to avoid.');
      expect(find.text('real'), findsOneWidget);
    });

    testWidgets('reveal is idempotent — a second call replaces the child',
        (tester) async {
      final early = SkalEarlyFrame.forTest();
      await tester.pumpWidget(early.root);

      early.reveal(const Directionality(
          textDirection: TextDirection.ltr, child: Text('first')));
      await tester.pump();
      expect(find.text('first'), findsOneWidget);

      early.reveal(const Directionality(
          textDirection: TextDirection.ltr, child: Text('second')));
      await tester.pump();
      expect(find.text('second'), findsOneWidget);
      expect(find.text('first'), findsNothing);
    });
  });
}
