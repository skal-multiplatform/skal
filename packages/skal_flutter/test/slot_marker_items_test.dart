// Solid's slot marker is not an item, a page, a screen or a body.
//
// `{cond ? <X/> : null}` leaves an empty text node behind as the slot's
// insertion anchor (renderer.js `createTextNode('')`, flagged
// kCreateAnonText). The axis containers lay it out as nothing
// (empty_text_slot_test.dart). These are the builders whose children are
// their ITEMS — segments, options, steps, tabs, screens, pages, grid
// cells, reorderable rows — or that show ONE child: to them a marker was
// an item of its own (a blank tab, a page you can swipe to, a hole in a
// grid, a blank screen on top of the stack) and shifted every index after
// it, so `activeTab`, `onChange(i)` and `onReorder` named different items
// to JS and to the host.

import 'dart:convert';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

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
    // A host app gives its Skal tree a Material (Scaffold); the dropdown
    // and stepper ink need one.
    await tester.pumpWidget(
        MaterialApp(home: Material(child: SkalRoot(bridge: bridge))));
    await tester.pump();
  }

  /// Solid's slot marker, appended to [parent].
  void marker(int parent, int id) => js
    ..createTextNode(id)
    ..appendChild(parent, id);

  /// A `<text label=…>` element.
  void label(int parent, int id, String s) => js
    ..createNode(id, wtText)
    ..setText(id, s)
    ..appendChild(parent, id);

  void box(int parent, int id, {int width = 40, int height = 40}) => js
    ..createNode(id, wtBox)
    ..setPropU32(id, propWidth, width)
    ..setPropU32(id, propHeight, height)
    ..appendChild(parent, id);

  /// Built anywhere, offstage included (an inactive tab, a lower route).
  Finder skalNode(int id) => find.byWidgetPredicate(
      (w) => w is SkalNode && w.nodeId == id,
      skipOffstage: false);

  List<int> changes() => [
        for (final e in js.drainEvents())
          if (e.id == _handler) e.argValueI32,
      ];

  testWidgets('segmented button: segments and the selected index',
      (tester) async {
    js
      ..createNode(10, wtSegmentedButton)
      ..setPropU32(10, propActiveTab, 0)
      ..writeOp(opBindHandler, 10, evChange, _handler)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    label(10, 12, 'Day');
    label(10, 13, 'Week');
    await mount(tester);

    final seg =
        tester.widget<SegmentedButton<int>>(find.byType(SegmentedButton<int>));
    expect(seg.segments.length, 2);
    expect((seg.segments.first.label! as SkalNode).nodeId, 12,
        reason: 'activeTab 0 is the first segment the user sees');
    changes();
    await tester.tap(find.text('Week'));
    await tester.pump();
    expect(changes(), [1], reason: '"Week" is segment 1 to JS');
  });

  testWidgets('dropdown: options', (tester) async {
    js
      ..createNode(10, wtDropdown)
      ..setPropU32(10, propActiveTab, 0)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    label(10, 12, 'One');
    label(10, 13, 'Two');
    await mount(tester);
    final dd = tester.widget<DropdownButton<int>>(find.byType(DropdownButton<int>));
    expect(dd.items!.length, 2);
    expect((dd.items!.first.child as SkalNode).nodeId, 12);
  });

  testWidgets("stepper: steps, and a step's content", (tester) async {
    js
      ..createNode(10, wtStepper)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    for (final (id, title) in [(12, 'First'), (13, 'Second')]) {
      js
        ..createNode(id, wtStep)
        ..setPropStr(id, propTitle, title)
        ..appendChild(10, id);
    }
    marker(12, 30);
    box(12, 22);
    box(13, 23);
    await mount(tester);
    final stepper = tester.widget<Stepper>(find.byType(Stepper));
    expect(stepper.steps.length, 2);
    expect((stepper.steps.first.title as Text).data, 'First');
    expect(skalNode(22), findsOneWidget,
        reason: "the current step shows its content, not the marker ahead "
            'of it');
  });

  testWidgets("tabs: tabs, and a tab's body", (tester) async {
    js
      ..createNode(10, wtTabs)
      ..setPropU32(10, propActiveTab, 0)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    for (final (id, title) in [(12, 'Home'), (13, 'Search')]) {
      js
        ..createNode(id, wtTab)
        ..setPropStr(id, propTitle, title)
        ..appendChild(10, id);
    }
    marker(12, 30);
    box(12, 22);
    box(13, 23);
    await mount(tester);
    expect(tester.widget<NavigationBar>(find.byType(NavigationBar))
        .destinations.length, 2);
    expect(skalNode(22), findsOneWidget,
        reason: "a tab's body is its first child that is not a marker");
    expect(skalNode(23), findsOneWidget);
  });

  testWidgets("navigator: screens, and a screen's content", (tester) async {
    js
      ..createNode(10, wtNavigator)
      ..appendChild(kRootNodeId, 10)
      ..createNode(12, wtScreen)
      ..appendChild(10, 12);
    marker(12, 30);
    box(12, 22);
    // `{signedIn() ? <screen/> : null}` after the first screen.
    marker(10, 11);
    await mount(tester);

    final nav = tester
        .widgetList<Navigator>(find.byType(Navigator))
        .where((n) => n.pages.any((p) => p.key == const ValueKey<int>(12)))
        .single;
    expect(nav.pages.length, 1,
        reason: 'a marker among the screens is not a blank route on top');
    expect(skalNode(22), findsOneWidget,
        reason: "a screen's content is its first child that is not a marker");
    expect(tester.widget<PopScope<dynamic>>(find.byType(PopScope<dynamic>))
        .canPop, isTrue,
        reason: 'one screen: system back falls through');
  });

  testWidgets('page view: pages and the page index', (tester) async {
    js
      ..createNode(10, wtPageView)
      ..writeOp(opBindHandler, 10, evChange, _handler)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    box(10, 12);
    box(10, 13);
    await mount(tester);
    expect(skalNode(12), findsOneWidget,
        reason: 'page 0 is the first page the app wrote');
    changes();
    // A <pageView> with no axis pages sideways (page_view_axis_test.dart).
    await tester.drag(find.byType(PageView), const Offset(-450, 0));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(skalNode(13), findsOneWidget);
    expect(changes().last, 1, reason: 'the second page is page 1 to JS');
  });

  testWidgets('lazy grid: the first item fills the first cell',
      (tester) async {
    js
      ..createNode(10, wtLazyGrid)
      ..setPropU32(10, propCrossAxisCount, 2)
      ..setPropU32(10, propGap, 0)
      ..setPropU32(10, propPadding, 0)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    box(10, 12);
    box(10, 13);
    box(10, 14);
    await mount(tester);
    expect(tester.getTopLeft(skalNode(12)),
        tester.getTopLeft(find.byType(GridView)));
    expect(tester.getTopLeft(skalNode(13)).dy, tester.getTopLeft(skalNode(12)).dy,
        reason: 'items 1 and 2 share the first row');
  });

  testWidgets('sliver grid and sliver app bar', (tester) async {
    js
      ..createNode(10, wtCustomScrollView)
      ..appendChild(kRootNodeId, 10)
      ..createNode(20, wtSliverAppBar)
      ..setPropStr(20, propTitle, 'T')
      ..setPropU32(20, propHeight, 200)
      ..appendChild(10, 20);
    marker(20, 31);
    box(20, 21);
    js
      ..createNode(40, wtSliverGrid)
      ..setPropU32(40, propCrossAxisCount, 2)
      ..setPropU32(40, propGap, 0)
      ..appendChild(10, 40);
    marker(40, 41);
    box(40, 42);
    box(40, 43);
    await mount(tester);
    expect(skalNode(21), findsOneWidget,
        reason: "the app bar's background is its first non-marker child");
    expect(tester.getTopLeft(skalNode(42)).dx, 0);
    expect(tester.getTopLeft(skalNode(43)).dx, 400,
        reason: 'items 1 and 2 fill the first row of two 400 px cells');
  });

  testWidgets('reorderable list: rows, and the indices a drag reports',
      (tester) async {
    js
      ..createNode(10, wtReorderableListView)
      ..setPropU32(10, propGap, 8)
      ..setPropU32(10, propPadding, 0)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    box(10, 12, height: 50);
    marker(10, 13);
    box(10, 14, height: 50);
    marker(10, 15);
    await mount(tester);
    final list =
        tester.widget<ReorderableListView>(find.byType(ReorderableListView));
    expect(list.itemCount, 2,
        reason: 'a drag reports item indices to JS, which counts no marker');
    final top = tester.getTopLeft(find.byType(ReorderableListView)).dy;
    expect(tester.getTopLeft(skalNode(12)).dy - top, 0);
    expect(tester.getTopLeft(skalNode(14)).dy - top, 58);
    // The gap is a Padding around each row but the last, outside the
    // row's own box — so it is read off the Padding, not the row.
    Iterable<Padding> gaps(int id) => tester
        .widgetList<Padding>(find.ancestor(
            of: skalNode(id), matching: find.byType(Padding)))
        .where((p) => p.padding == const EdgeInsets.only(bottom: 8));
    expect(gaps(12), hasLength(1), reason: 'the first row carries the gap');
    expect(gaps(14), isEmpty, reason: 'the last row carries no gap');
  });

  for (final (name, type) in [
    ('dismissible', wtDismissible),
    ('dragItem', wtDragItem),
    ('dropZone', wtDropZone),
    ('crossFade', wtCrossFade),
    ('screen', wtScreen),
    ('tab', wtTab),
    ('step', wtStep),
  ]) {
    testWidgets('$name shows its first child that is not a marker',
        (tester) async {
      js
        ..createNode(10, wtColumn)
        ..appendChild(kRootNodeId, 10)
        ..createNode(11, type)
        ..appendChild(10, 11);
      marker(11, 12);
      box(11, 13);
      await mount(tester);
      expect(skalNode(13), findsOneWidget);
    });
  }

  group('<tabs> and <navigator> mount their bodies', () {
    testWidgets('a second tab arriving keeps the first one mounted',
        (tester) async {
      // <tabs><tab Home>…</tab>{admin() ? <tab Admin/> : null}</tabs>: one
      // real tab, then two. The bar comes and goes; Home must not remount
      // (its text field would lose what was typed).
      js
        ..createNode(10, wtTabs)
        ..appendChild(kRootNodeId, 10)
        ..createNode(11, wtTab)
        ..setPropStr(11, propTitle, 'Home')
        ..appendChild(10, 11);
      box(11, 21);
      marker(10, 30);
      await mount(tester);
      final home = tester.element(skalNode(21));

      // Solid fills the slot: the new tab goes in before the marker, and
      // the marker comes out.
      js
        ..createNode(31, wtTab)
        ..setPropStr(31, propTitle, 'Admin')
        ..writeOp(opInsertBefore, 10, 31, 30)
        ..writeOp(opRemoveNode, 30, 0, 0)
        ..commit();
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(tester.element(skalNode(21)), same(home));

      // ...and empties it again.
      js
        ..createTextNode(32)
        ..writeOp(opInsertBefore, 10, 32, 31)
        ..writeOp(opRemoveNode, 31, 0, 0)
        ..commit();
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.byType(NavigationBar), findsNothing);
      expect(tester.element(skalNode(21)), same(home));
    });

    testWidgets('a tab arriving ahead of the others moves them, mounted',
        (tester) async {
      js
        ..createNode(10, wtTabs)
        ..appendChild(kRootNodeId, 10);
      marker(10, 30);
      for (final (id, body) in [(11, 21), (12, 22)]) {
        js
          ..createNode(id, wtTab)
          ..setPropStr(id, propTitle, 'T$id')
          ..appendChild(10, id);
        box(id, body);
      }
      await mount(tester);
      final a = tester.element(skalNode(21));
      final b = tester.element(skalNode(22));
      js
        ..createNode(31, wtTab)
        ..setPropStr(31, propTitle, 'Admin')
        ..writeOp(opInsertBefore, 10, 31, 30)
        ..writeOp(opRemoveNode, 30, 0, 0)
        ..commit();
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.widget<NavigationBar>(find.byType(NavigationBar))
          .destinations.length, 3);
      expect(tester.element(skalNode(21)), same(a));
      expect(tester.element(skalNode(22)), same(b));
    });

    testWidgets("a tab's string body that starts empty shows up",
        (tester) async {
      // <tab title="Status">{status()}</tab>, status() '' at first. The
      // change re-dirties the text's parent — the <tab> — so the <tab> has
      // to be what is mounted and rebuilds.
      js
        ..createNode(10, wtTabs)
        ..appendChild(kRootNodeId, 10)
        ..createNode(11, wtTab)
        ..setPropStr(11, propTitle, 'Status')
        ..appendChild(10, 11)
        ..createTextNode(21)
        ..appendChild(11, 21)
        ..createNode(12, wtTab)
        ..setPropStr(12, propTitle, 'Other')
        ..appendChild(10, 12);
      await mount(tester);
      js
        ..setText(21, 'Connected')
        ..commit();
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.text('Connected'), findsOneWidget);
    });

    testWidgets("a screen's string body that starts empty shows up",
        (tester) async {
      js
        ..createNode(10, wtNavigator)
        ..appendChild(kRootNodeId, 10)
        ..createNode(12, wtScreen)
        ..appendChild(10, 12)
        ..createTextNode(22)
        ..appendChild(12, 22);
      await mount(tester);
      js
        ..setText(22, 'Ready')
        ..commit();
      await tester.pump(const Duration(milliseconds: 16));
      expect(find.text('Ready'), findsOneWidget);
    });
  });

  testWidgets('cupertino segmented control: a marker beside one segment',
      (tester) async {
    // CupertinoSlidingSegmentedControl asserts two segments or more; with
    // the marker no longer counted, `{all() ? <text/> : null}<text Mine/>`
    // is one.
    js
      ..setDesign(1) // Cupertino
      ..createNode(10, wtSegmentedButton)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    label(10, 12, 'Mine');
    await mount(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('Mine'), findsOneWidget);
  });

  testWidgets('reorderable list: a drag reports the indices JS rendered',
      (tester) async {
    // Painted rows: an unpainted box is not hit-testable, so a drag on it
    // would start nothing.
    void row(int id) => js
      ..createNode(id, wtBox)
      ..setPropU32(id, propWidth, 40)
      ..setPropU32(id, propHeight, 50)
      ..setPropU32(id, propBgColor, 0xFF336699)
      ..appendChild(10, id);
    js
      ..createNode(10, wtReorderableListView)
      ..setPropU32(10, propGap, 8)
      ..setPropU32(10, propPadding, 0)
      ..writeOp(opBindHandler, 10, evReorder, _handler)
      ..appendChild(kRootNodeId, 10);
    marker(10, 11);
    row(12);
    marker(10, 13);
    row(14);
    marker(10, 15);
    await mount(tester);
    js.drainEvents();

    final drag = await tester.startGesture(tester.getCenter(skalNode(12)));
    await tester.pump(kLongPressTimeout + const Duration(milliseconds: 50));
    for (var i = 0; i < 10; i++) {
      await drag.moveBy(const Offset(0, 10));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await drag.up();
    await tester.pumpAndSettle();
    final moves = [
      for (final e in js.drainEvents())
        if (e.kind == evReorder && e.id == _handler)
          (jsonDecode(e.payload!) as List).cast<int>(),
    ];
    expect(moves, [
      [0, 1]
    ], reason: 'the first row moved below the second: 0 -> 1, the markers '
        'around them are not rows');
  });
}
