// `<pageView>` pages horizontally unless `axis` is 0.
//
// It read its axis through the scrollers' `_axisFor(getPropU32(propAxis,
// 0))`, so an unset axis was 0 = vertical: a default `<PageView>` paged up
// and down, while its docs and the web target paged sideways. The enum
// itself is right and shared — 0 = vertical, 1 = horizontal on every
// scroller — so only the pager's DEFAULT moves. The last test pins the
// scrollers' default, which must not move with it.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

const int _pager = 10;
const int _handler = 77;

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js)..ensureRoot();
  });
  tearDown(() => bridge.disableOffFrameDrain());

  Future<void> mount(WidgetTester tester) async {
    js.commit();
    await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: SkalRoot(bridge: bridge))));
    await tester.pump();
  }

  /// A full-screen `<pageView>` with two pages; [axis] null leaves the
  /// prop unset, which is what `<PageView>` with no `axis` sends.
  void pager({int? axis}) {
    js
      ..createNode(_pager, wtPageView)
      ..writeOp(opBindHandler, _pager, evChange, _handler);
    if (axis != null) js.setPropU32(_pager, propAxis, axis);
    js.appendChild(kRootNodeId, _pager);
    for (final id in [11, 12]) {
      js
        ..createNode(id, wtBox)
        ..appendChild(_pager, id);
    }
  }

  Axis direction(WidgetTester tester) =>
      tester.widget<PageView>(find.byType(PageView)).scrollDirection;

  List<int> pageChanges() => [
        for (final e in js.drainEvents())
          if (e.id == _handler) e.argValueI32,
      ];

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  for (final (name, axis, expected) in [
    ('no axis', null, Axis.horizontal),
    ('axis 1', 1, Axis.horizontal),
    ('axis 0', 0, Axis.vertical),
  ]) {
    testWidgets('a <pageView> with $name pages ${expected.name}ly',
        (tester) async {
      pager(axis: axis);
      await mount(tester);
      expect(direction(tester), expected);
    });
  }

  testWidgets('a sideways swipe turns the default pager, an upward one not',
      (tester) async {
    pager();
    await mount(tester);
    pageChanges();

    await tester.drag(find.byType(PageView), const Offset(0, -450));
    await settle(tester);
    expect(pageChanges(), isEmpty, reason: 'it does not page vertically');

    await tester.drag(find.byType(PageView), const Offset(-450, 0));
    await settle(tester);
    expect(pageChanges(), [1]);
  });

  testWidgets('clearing axis returns the pager to horizontal',
      (tester) async {
    // `axis={vertical() ? 0 : null}` — the null sends opClearProp, and the
    // host must fall back to the PAGER's default, not the scrollers'.
    pager(axis: 0);
    await mount(tester);
    expect(direction(tester), Axis.vertical);

    js
      ..clearProp(_pager, propAxis)
      ..commit();
    await tester.pump();
    expect(direction(tester), Axis.horizontal);
  });

  testWidgets('the scrollers keep their vertical default', (tester) async {
    // The root box shows one child, so a column holds the three.
    js
      ..createNode(50, wtColumn)
      ..appendChild(kRootNodeId, 50);
    for (final (id, type, axis) in [
      (20, wtScrollView, null),
      (30, wtScrollView, 1),
      (40, wtListView, null),
    ]) {
      js
        ..createNode(id, type)
        ..setPropU32(id, propHeight, 150);
      if (axis != null) js.setPropU32(id, propAxis, axis);
      js
        ..appendChild(50, id)
        ..createNode(id + 1, wtBox)
        ..appendChild(id, id + 1);
    }
    await mount(tester);

    AxisDirection axisOf(int id) => tester
        .widget<Scrollable>(find
            .descendant(
                of: find.byWidgetPredicate(
                    (w) => w is SkalNode && w.nodeId == id),
                matching: find.byType(Scrollable))
            .first)
        .axisDirection;
    expect(axisOf(20), AxisDirection.down, reason: 'unset <scrollView>');
    expect(axisOf(30), AxisDirection.right, reason: '<scrollView axis={1}>');
    expect(axisOf(40), AxisDirection.down, reason: 'unset <listView>');
  });
}
