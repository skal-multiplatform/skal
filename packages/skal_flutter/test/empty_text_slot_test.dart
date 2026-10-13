// Solid's empty slot marker must lay out as nothing: no space, no gap.
//
// `{cond ? <X/> : null}` among siblings is the commonest line of Solid
// JSX there is, and it leaves an empty text node behind as the slot's
// insertion anchor — `cleanChildren` in Solid's universal renderer, via
// renderer.js `createTextNode('')`, which creates a WT_TEXT node flagged
// kCreateAnonText and sends no text at all. Rendered as a `Text('')`,
// that marker was one full line tall plus a gap: a text-only post of the
// bench feed measured 235.0 dp with it and 205.9 dp without, on the
// Galaxy A14, where React Native's `null` renders nothing.
//
// An empty `<text label="">` is the app's own element, not a marker: it
// keeps its line, its style and its animations (the last group below).
//
// The ops below are the ones the JS side really sends, in its order: the
// static children are appended, then the marker is inserted BEFORE the
// sibling that follows the slot.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() => js = FakeSkalRuntime());

  /// Publish what the test has written and mount (or re-pump) the tree.
  Future<void> mount(WidgetTester tester) async {
    js.commit();
    await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
  }

  /// Publish and run one frame, the way a JS batch lands mid-session.
  Future<void> land(WidgetTester tester) async {
    js.commit();
    await tester.pump(const Duration(milliseconds: 16));
  }

  void start() {
    bridge = SkalBridge(js)..ensureRoot();
    addTearDown(bridge.disableOffFrameDrain);
  }

  Finder node(int id) => find.byKey(ValueKey<int>(id));

  /// Solid's slot marker: a text node the renderer made, with no text.
  void marker(int parent, int id, {required int before}) => js
    ..createTextNode(id)
    ..writeOp(opInsertBefore, parent, id, before);

  void text(int parent, int id, String s, {int fontSize = 14}) => js
    ..createNode(id, wtText)
    ..setPropU32(id, propFontSize, fontSize)
    ..setText(id, s)
    ..appendChild(parent, id);

  void box(int parent, int id, {int? width, required int height}) {
    js.createNode(id, wtBox);
    if (width != null) js.setPropU32(id, propWidth, width);
    js
      ..setPropU32(id, propHeight, height)
      ..appendChild(parent, id);
  }

  /// A container of [type] under the root (via a gap-less, unpadded
  /// column so siblings stack instead of overlapping in the root box).
  int wrapper = 0;
  void container(int id, int type, {int gap = 8, int padding = 0}) {
    if (wrapper == 0) {
      wrapper = 2;
      js
        ..createNode(wrapper, wtColumn)
        ..setPropU32(wrapper, propGap, 0)
        ..setPropU32(wrapper, propPadding, 0)
        ..appendChild(kRootNodeId, wrapper);
    }
    js
      ..createNode(id, type)
      ..setPropU32(id, propGap, gap)
      ..setPropU32(id, propPadding, padding)
      ..appendChild(wrapper, id);
  }

  tearDown(() => wrapper = 0);

  testWidgets('a feed post with a null image slot is as tall as one without',
      (tester) async {
    start();
    // Feed.jsx's <Post> for a text-only post, twice: once with the slot
    // marker `{p.image ? … : null}` leaves, once as if it did not exist.
    void post(int base, {required bool withSlot}) {
      final col = base;
      container(col, wtColumn, gap: 8, padding: 14);
      final head = base + 1;
      js
        ..createNode(head, wtRow)
        ..setPropU32(head, propGap, 10)
        ..appendChild(col, head);
      box(head, base + 2, width: 40, height: 40);
      final names = base + 3;
      js
        ..createNode(names, wtColumn)
        ..setPropU32(names, propGap, 2)
        ..setPropU32(names, propPadding, 0)
        ..appendChild(head, names);
      text(names, base + 4, 'Display Name', fontSize: 15);
      text(names, base + 5, '@handle', fontSize: 12);
      text(col, base + 6, 'The body of a post with no image.');
      final metrics = base + 7;
      js
        ..createNode(metrics, wtRow)
        ..setPropU32(metrics, propGap, 20)
        ..appendChild(col, metrics);
      text(metrics, base + 8, 'R 1', fontSize: 12);
      text(metrics, base + 9, 'B 2', fontSize: 12);
      text(metrics, base + 10, 'L 3', fontSize: 12);
      box(col, base + 11, height: 1);
      if (withSlot) marker(col, base + 12, before: metrics);
    }

    post(100, withSlot: true);
    post(200, withSlot: false);
    await mount(tester);

    expect(bridge.nodes[100]!.childCount, 5,
        reason: 'the marker must really be in the column for this to test '
            'anything');
    expect(tester.getSize(node(100)).height, tester.getSize(node(200)).height,
        reason: 'the empty slot marker must add neither a line nor a gap');
  });

  testWidgets(
      'a marker that gets text later appears, with its gaps, and goes '
      'again when emptied', (tester) async {
    start();
    // Solid reuses the marker: when the slot's value becomes a string it
    // calls `replaceText` on it rather than inserting a new node, so the
    // only op is a SET_TEXT on the child. The column has to rebuild for
    // a child it had left out.
    container(10, wtColumn);
    text(10, 11, 'above');
    text(10, 13, 'below');
    marker(10, 12, before: 13);
    // The same column built with the middle text from the start.
    container(20, wtColumn);
    text(20, 21, 'above');
    text(20, 22, 'middle');
    text(20, 23, 'below');
    // ...and with no middle at all.
    container(30, wtColumn);
    text(30, 31, 'above');
    text(30, 33, 'below');
    await mount(tester);
    expect(tester.getSize(node(10)).height, tester.getSize(node(30)).height);

    js.setText(12, 'middle');
    await land(tester);
    expect(find.descendant(of: node(10), matching: find.text('middle')),
        findsOneWidget,
        reason: 'the column must rebuild when its left-out marker gets text');
    expect(tester.getSize(node(10)).height, tester.getSize(node(20)).height);

    js.setText(12, '');
    await land(tester);
    expect(find.descendant(of: node(10), matching: find.text('middle')),
        findsNothing);
    expect(tester.getSize(node(10)).height, tester.getSize(node(30)).height);
  });

  testWidgets('a row: no width, no gap and no line height from a marker',
      (tester) async {
    start();
    container(10, wtRow, gap: 10);
    box(10, 11, width: 20, height: 10);
    box(10, 13, width: 30, height: 10);
    marker(10, 12, before: 13);
    await mount(tester);
    // An empty Text would make the row a text line tall, too.
    expect(tester.getSize(node(10)), const Size(60, 10));
  });

  testWidgets('a wrap: no spacing around a marker', (tester) async {
    start();
    container(10, wtWrap, gap: 8);
    box(10, 11, width: 20, height: 10);
    box(10, 13, width: 20, height: 10);
    marker(10, 12, before: 13);
    await mount(tester);
    expect(tester.getSize(node(10)), const Size(48, 10));
  });

  testWidgets('a box keeps its Stack, and the marker in it has no size',
      (tester) async {
    start();
    // <box>{child}{cond ? … : null}</box>. The box is a Stack of its two
    // children; leaving the marker out would make it a bare child, and
    // the slot filling would turn it back into a Stack — remounting the
    // child that never changed. So the marker stays, at zero size.
    container(10, wtColumn, gap: 0);
    js
      ..createNode(11, wtBox)
      ..appendChild(10, 11);
    box(11, 12, width: 20, height: 10);
    js
      ..createTextNode(13)
      ..appendChild(11, 13);
    await mount(tester);
    expect(find.descendant(of: node(11), matching: find.byType(Stack)),
        findsOneWidget);
    expect(tester.getSize(node(11)), const Size(20, 10));
  });

  testWidgets('a children-mode list: markers are zero-height rows with no gap',
      (tester) async {
    start();
    js
      ..createNode(10, wtListView)
      ..setPropU32(10, propGap, 8)
      ..setPropU32(10, propPadding, 0)
      ..appendChild(kRootNodeId, 10);
    // [marker, A, marker, B, C, marker]: leading, inner and trailing.
    js.createTextNode(11);
    js.appendChild(10, 11);
    box(10, 12, height: 50);
    js.createTextNode(13);
    js.appendChild(10, 13);
    box(10, 14, height: 50);
    box(10, 15, height: 50);
    js.createTextNode(16);
    js.appendChild(10, 16);
    await mount(tester);

    final top = tester.getTopLeft(node(10)).dy;
    double at(int id) => tester.getTopLeft(node(id)).dy - top;
    expect(at(12), 0, reason: 'nothing above the first row that takes space');
    expect(at(14), 58);
    expect(at(15), 116);
    expect(tester.getSize(node(16)).height, 0);
    expect(at(16), 166,
        reason: 'no gap after the last row that takes space, before the '
            'trailing marker (`{loading() ? <Spinner/> : null}` after a list)');
  });

  testWidgets('a reorderable list: a marker is no row and carries no gap',
      (tester) async {
    start();
    js
      ..createNode(10, wtReorderableListView)
      ..setPropU32(10, propGap, 8)
      ..setPropU32(10, propPadding, 0)
      ..appendChild(kRootNodeId, 10);
    box(10, 11, height: 50);
    box(10, 13, height: 50);
    marker(10, 12, before: 13);
    js.createTextNode(14);
    js.appendChild(10, 14);
    await mount(tester);

    final top = tester.getTopLeft(node(10)).dy;
    expect(tester.getTopLeft(node(13)).dy - top, 58);
    // 13 is the last row, so it gets no trailing gap — the markers are
    // not rows at all (a drag reports row indices to JS, which counts no
    // marker; slot_marker_items_test.dart).
    expect(find.byKey(const ValueKey<int>(14)), findsNothing);
    // The gap is a Padding outside the row's own box: read it there.
    Iterable<Padding> gaps(int id) => tester
        .widgetList<Padding>(
            find.ancestor(of: node(id), matching: find.byType(Padding)))
        .where((p) => p.padding == const EdgeInsets.only(bottom: 8));
    expect(gaps(11), hasLength(1));
    expect(gaps(13), isEmpty);
  });

  testWidgets('an animated list: a marker entry carries no gap',
      (tester) async {
    start();
    container(10, wtAnimatedList, gap: 8);
    box(10, 11, height: 50);
    box(10, 13, height: 50);
    marker(10, 12, before: 13);
    await mount(tester);
    expect(tester.getTopLeft(node(13)).dy - tester.getTopLeft(node(11)).dy,
        58);
  });

  group('an empty <text> the app wrote is not a marker', () {
    testWidgets('it keeps its line, so an error appearing moves nothing',
        (tester) async {
      start();
      // A form keeping the error line's space: <text label={error() ?? ''}
      // fontSize={12}/> between two fields. renderer.js sends a <text>'s
      // label as SET_TEXT, '' included, on a node it did not flag.
      container(10, wtColumn);
      box(10, 11, height: 20);
      text(10, 12, '', fontSize: 12);
      box(10, 13, height: 20);
      // The same form with the error showing.
      container(20, wtColumn);
      box(20, 21, height: 20);
      text(20, 22, 'Required', fontSize: 12);
      box(20, 23, height: 20);
      await mount(tester);
      final reserved = tester.getSize(node(10)).height;
      expect(reserved, tester.getSize(node(20)).height,
          reason: 'an empty <text> keeps its line and the gaps beside it');

      js.setText(12, 'Required');
      await land(tester);
      expect(tester.getSize(node(10)).height, reserved,
          reason: 'the error filling its reserved line moves nothing');
    });

    testWidgets('it fades in when its text and opacity land together',
        (tester) async {
      start();
      // <text label={status()} opacity={status() ? 1 : 0}
      //       animate={{duration: 300}}/>, going '' -> 'Saved'.
      container(10, wtColumn);
      js
        ..createNode(11, wtText)
        ..setPropU32(11, propAnimDuration, 300)
        ..setText(11, '')
        ..setOpacity(11, 0)
        ..appendChild(10, 11);
      await mount(tester);

      js
        ..setText(11, 'Saved')
        ..setOpacity(11, 1);
      await land(tester);
      await tester.pump(const Duration(milliseconds: 134));
      final fade = find.ancestor(
          of: find.text('Saved'), matching: find.byType(Opacity));
      expect(fade, findsOneWidget,
          reason: 'the text must still be mid-fade, under its hot layer');
      expect(tester.widget<Opacity>(fade).opacity, inExclusiveRange(0.05, 0.95),
          reason: 'a node that stayed mounted tweens from 0; a remounted one '
              'starts at its target and snaps');
    });

    testWidgets('its style tweens when its first text lands', (tester) async {
      start();
      // In a <box>, which keeps every child mounted: what is left to test
      // is the text's own build, which must not skip the
      // AnimatedDefaultTextStyle while the label is empty.
      container(10, wtBox);
      js
        ..createNode(11, wtText)
        ..setPropU32(11, propAnimDuration, 300)
        ..setPropU32(11, propFontSize, 12)
        ..setText(11, '')
        ..appendChild(10, 11);
      await mount(tester);

      js
        ..setText(11, 'Big')
        ..setPropU32(11, propFontSize, 20);
      await land(tester);
      await tester.pump(const Duration(milliseconds: 134));
      final size =
          DefaultTextStyle.of(tester.element(find.text('Big'))).style.fontSize;
      expect(size, inExclusiveRange(12.5, 19.5),
          reason: 'fontSize 12 -> 20 over 300 ms is mid-tween at ~150 ms');
    });

    test('only a text node can carry the flag', () {
      start();
      js
        ..writeOp(opCreateNode, 11, wtBox, kCreateAnonText)
        ..createTextNode(12)
        ..createNode(13, wtText);
      js.commit();
      bridge.pumpOps();
      expect(bridge.nodes[11]!.isSlotMarker, isFalse,
          reason: 'an empty box is not a marker, whatever the flag says');
      expect(bridge.nodes[12]!.isSlotMarker, isTrue);
      expect(bridge.nodes[13]!.isSlotMarker, isFalse);
    });
  });

  test("a <text>'s label changing leaves its parent alone", () {
    // Only a slot marker's emptiness matters to its parent, which leaves it
    // out. A <text> element going '' -> 'Required' is its own rebuild; the
    // whole column rebuilding with it would be a per-label-change cost.
    start();
    js
      ..createNode(10, wtColumn)
      ..appendChild(kRootNodeId, 10)
      ..createNode(11, wtText)
      ..setText(11, '')
      ..appendChild(10, 11)
      ..createTextNode(12)
      ..appendChild(10, 12)
      ..commit();
    bridge.pumpOps();
    var columnRebuilds = 0;
    bridge.nodes[10]!.cold.addListener(() => columnRebuilds++);

    js
      ..setText(11, 'Required')
      ..commit();
    bridge.pumpOps();
    expect(columnRebuilds, 0);

    js
      ..setText(12, 'shown')
      ..commit();
    bridge.pumpOps();
    expect(columnRebuilds, 1,
        reason: 'a marker getting text is a child the column had left out');
  });
}
