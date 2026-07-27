// A `<row>` must not be a scroll container.
//
// It used to be: every Row was wrapped in a horizontal
// SingleChildScrollView "so wide rows don't clip". That put a
// Scrollable, a viewport, a ScrollPosition and a gesture recognizer on
// the single most common container in the framework, whether or not
// anything ever scrolled.
//
// Measured on 400 rows of 6 children, wrapped vs plain:
//
//     wrapped : 4156 elements, 62.6 ms per build
//     plain   : 1895 elements, 11.6 ms per build
//     delta   : +119% elements, +437% build time
//
// It cost correctness too — nested horizontal scrollables fight the
// parent for pan gestures, and a row that overflowed silently became
// scrollable instead of reporting the layout bug.
//
// `<scrollView axis={1}>` is the scrolling row, and always was: it
// produces this exact widget shape.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

void main() {
  testWidgets('a <row> builds no Scrollable', (tester) async {
    final js = FakeSkalRuntime();
    final bridge = SkalBridge(js)..ensureRoot();
    addTearDown(bridge.disableOffFrameDrain);

    // Mount inside real app chrome — a bare <row> at the root has no
    // Directionality ancestor, and a horizontal RenderFlex needs one to
    // resolve start/end.
    js
      ..createNode(2, wtNavigator)
      ..createNode(3, wtScreen)
      ..createNode(4, wtRow)
      ..createNode(5, wtBox)
      ..setPropStr(3, propTitle, 'Rows')
      ..appendChild(kRootNodeId, 2)
      ..appendChild(2, 3)
      ..appendChild(3, 4)
      ..appendChild(4, 5)
      ..commit();

    await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
    // Explicit pumps, not pumpAndSettle: the route transition needs
    // time, and SkalRoot's ticker is the thing under test elsewhere.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byType(Row), findsWidgets, reason: 'the row must render');
    expect(
      find.descendant(
        of: find.byType(Row).first,
        matching: find.byType(Scrollable),
      ),
      findsNothing,
    );
    // The row itself must not be INSIDE a scroll view of its own making
    // either. A Scrollable anywhere in the Skal-built subtree means the
    // implicit wrapper is back.
    expect(find.byType(SingleChildScrollView), findsNothing,
        reason: 'a plain <row> must not build a scroll container; use '
            '<scrollView axis={1}> for that');
  });
}
