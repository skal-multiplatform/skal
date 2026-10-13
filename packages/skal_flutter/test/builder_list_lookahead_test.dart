// A builder-mode <listView> must ask for rows well ahead of the
// viewport, and size the rows it has not seen from the ones it has.
//
// Builder rows are pull-based: the layout that first touches a missing
// index requests it, JS materializes it, and it lands a frame or two
// later. Two things made a fast fling outrun that round trip:
//
//   * Flutter's default cache extent (250 px) was the only look-ahead —
//     ~30 ms of travel at the 8000 dp/s fling ceiling, less than the
//     round trip and far less than an image decode, which only starts
//     once the row is built.
//   * Every never-measured row was a 48 dp placeholder. A fling into
//     unmeasured territory crossed several times more placeholders per
//     screen than real rows, and asked JS for all of them.
//
// The JS side here is a responder that answers each evRowRequest the way
// renderer.js `_fillRows` does — create the row, LIST_SET_ROW it, publish
// — minus the overscan, so what is measured is exactly what the HOST
// asked for.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/node_state.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

const int _list = 2;
const int _handler = 99;

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  /// Every index the host has asked for, in request order.
  late List<List<int>> requests;

  /// Mount a builder list of [count] rows with no padding and no gap, so
  /// row i spans [i * rowHeight, (i + 1) * rowHeight).
  Future<void> mount(WidgetTester tester, int count) async {
    requests = [];
    bridge = SkalBridge(js)..ensureRoot();
    addTearDown(bridge.disableOffFrameDrain);
    js
      ..createNode(_list, wtListView)
      ..setPropU32(_list, propPadding, 0)
      ..setPropU32(_list, propGap, 0)
      ..setPropU32(_list, propItemCount, count)
      ..writeOp(opBindHandler, _list, evRowRequest, _handler)
      ..appendChild(kRootNodeId, _list)
      ..commit();
    await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
  }

  /// The list's ListView — a subclass of it (root.dart's
  /// _LookAheadListView), which `find.byType` would not match.
  final listView = find.byWidgetPredicate((w) => w is ListView);

  ScrollPosition position(WidgetTester tester) =>
      tester.state<ScrollableState>(find.byType(Scrollable)).position;

  /// Answer outstanding row requests with [rowHeight]-tall rows, the way
  /// `_fillRows` would, then pump. Returns how many requests it served.
  Future<int> serve(WidgetTester tester, double rowHeight,
      {int? onlyBelow}) async {
    var served = 0;
    for (final e in js.drainEvents()) {
      if (e.kind != evRowRequest || e.id != _handler) continue;
      final idx = (jsonDecode(e.payload!) as List).cast<int>();
      requests.add(idx);
      served++;
      for (final i in idx) {
        if (onlyBelow != null && i >= onlyBelow) continue;
        final row = 1000 + i;
        if (bridge.nodes.containsKey(row)) continue;
        js
          ..createNode(row, wtBox)
          ..setPropU32(row, propHeight, rowHeight.round())
          ..writeOp(opListSetRow, _list, i, row);
      }
    }
    js.commit();
    await tester.pump(const Duration(milliseconds: 16));
    return served;
  }

  /// Serve until the host stops asking (or 30 rounds).
  Future<void> settle(WidgetTester tester, double rowHeight) async {
    for (var round = 0; round < 30; round++) {
      await tester.pump(const Duration(milliseconds: 16));
      if (await serve(tester, rowHeight) == 0) {
        // One more frame for a post-frame request to be dispatched.
        await tester.pump(const Duration(milliseconds: 16));
        if (await serve(tester, rowHeight) == 0) return;
      }
    }
  }

  int maxRequested() =>
      requests.expand((r) => r).fold(-1, (a, b) => a > b ? a : b);

  setUp(() => js = FakeSkalRuntime());

  testWidgets('rows are requested a viewport past the visible area',
      (tester) async {
    // 600 px tall surface, 40 px rows: 15 rows on screen. The default
    // 250 px cache extent reaches row ~21; a viewport of look-ahead
    // reaches row ~30.
    await mount(tester, 200);
    await settle(tester, 40);
    final viewport = tester.getSize(listView).height;
    expect(viewport, 600, reason: 'the arithmetic below assumes the 800x600 test surface');
    expect(maxRequested(), greaterThanOrEqualTo(27),
        reason: 'the list must build rows a viewport (600 px = 15 rows) '
            'beyond the 15 on screen; it asked only up to row '
            '${maxRequested()} (250 px of look-ahead ends at row ~21)');
    // ...and not unboundedly: the window, not the whole list.
    expect(maxRequested(), lessThan(45));
  });

  testWidgets('the first frame keeps the default look-ahead', (tester) async {
    // Before any row is measured every unbuilt row is a 48 dp guess, and
    // a viewport of look-ahead full of guesses would ask JS for ~25 rows
    // on frame one to fill a screen that ten real rows may cover.
    await mount(tester, 200);
    await tester.pump(const Duration(milliseconds: 16));
    await serve(tester, 40);
    expect(requests, isNotEmpty);
    final first = requests.first;
    // (600 + 250) px / 48 px per placeholder = 17.7 -> indices 0..17.
    expect(first.length, lessThanOrEqualTo(20),
        reason: 'frame one requested ${first.length} rows');
  });

  testWidgets('the look-ahead turns on even when no further row is requested',
      (tester) async {
    // 300 px rows: frame one's 48 dp guesses ask for rows 0..17, which
    // land as 5400 px of real rows — more than the default window AND the
    // look-ahead window, so nothing else will ever be requested or
    // rebuild the list on its own. The look-ahead has to switch on anyway,
    // or the rows (and images) a viewport ahead are not BUILT until the
    // user has scrolled most of the way to them.
    await mount(tester, 1000);
    await settle(tester, 300);
    await tester.pump(const Duration(milliseconds: 16));
    await tester.pump(const Duration(milliseconds: 16));
    // Built includes the cache region, which finders treat as offstage.
    int built() => List.generate(30, (i) => 1000 + i)
        .where((id) => find
            .byKey(ValueKey<int>(id), skipOffstage: false)
            .evaluate()
            .isNotEmpty)
        .length;
    // Viewport 600 + 600 ahead = 1200 px = rows 0..3 (+1 straddling).
    expect(built(), greaterThanOrEqualTo(4),
        reason: 'only ${built()} rows are built; 250 px of default look-ahead '
            'builds 3 (850 px / 300 px)');
  });

  testWidgets('images in a flinging builder list are not deferred',
      (tester) async {
    // Flutter's Image asks Scrollable.recommendDeferredLoadingForContext
    // before starting an uncached image, and the default physics say yes
    // above (view's longest physical side) px/s — 2400 on the test view.
    // A builder list must answer no, or the rows its look-ahead built
    // early sit with grey boxes until the fling slows.
    await mount(tester, 200);
    await settle(tester, 100);
    await tester.fling(listView, const Offset(0, -300), 8000);
    await tester.pump(const Duration(milliseconds: 16));
    final pos = position(tester);
    // ignore: invalid_use_of_protected_member, invalid_use_of_visible_for_testing_member
    final v = pos.activity!.velocity.abs();
    final threshold = tester.view.physicalSize.longestSide;
    expect(v, greaterThan(threshold),
        reason: 'the fling must actually be in the range Flutter defers in '
            '(v=$v, threshold=$threshold), or this proves nothing');
    final row = find
        .byWidgetPredicate((w) => w is SkalNode && w.nodeId >= 1000,
            skipOffstage: false)
        .first;
    expect(Scrollable.recommendDeferredLoadingForContext(tester.element(row)),
        isFalse);
  });

  testWidgets('unbuilt rows are sized from measured ones, not 48 dp',
      (tester) async {
    // 300 px rows. Materialize what the first frames ask for, then jump
    // past them: the list lays out placeholders from the end of the
    // materialized rows to the new offset and through the window there.
    // Sized at 300 px that is ~12 rows; at 48 px it is ~60 — the "fling
    // asks JS for far more rows than will fit" failure.
    await mount(tester, 1000);
    await settle(tester, 300);
    final materialized =
        bridge.nodes.keys.where((k) => k >= 1000).length;
    expect(materialized, greaterThan(0));
    position(tester).jumpTo(materialized * 300.0 + 2400);
    await tester.pump(const Duration(milliseconds: 16));
    await tester.pump(const Duration(milliseconds: 16));
    // Serve nothing yet — look at what the jump itself asked for.
    final jump = <int>{};
    for (final e in js.drainEvents()) {
      if (e.kind == evRowRequest) {
        jump.addAll((jsonDecode(e.payload!) as List).cast<int>());
      }
    }
    expect(jump, isNotEmpty, reason: 'the jump must land on unbuilt rows');
    expect(jump.length, lessThanOrEqualTo(20),
        reason: 'a jump of 2400 px past the last real row plus a 1200-1800 px '
            'window is ~12-14 rows of 300 px; the list asked for '
            '${jump.length}, i.e. it sized unbuilt rows far smaller '
            'than the rows it had measured');
  });

  group('rows that measure zero', () {
    testWidgets('do not shrink the placeholders to nothing', (tester) async {
      // Rows whose data is still loading render nothing: 0 dp. If those
      // set the mean, every unbuilt row is a 0 dp placeholder and one
      // viewport fill asks JS for every remaining row in a single frame.
      await mount(tester, 2000);
      final perFrame = <int>[];
      for (var f = 0; f < 6; f++) {
        await tester.pump(const Duration(milliseconds: 16));
        final before = requests.expand((r) => r).length;
        await serve(tester, 0);
        perFrame.add(requests.expand((r) => r).length - before);
      }
      expect(bridge.nodes.keys.where((k) => k >= 1000), isNotEmpty,
          reason: 'rows must really have landed at 0 dp for this to test '
              'anything');
      expect(perFrame.reduce((a, b) => a > b ? a : b), lessThanOrEqualTo(40),
          reason: 'requests per frame were $perFrame: a 0 dp mean asks for '
              'the whole list at once');
    });

    test('are left out of the mean, and never drive it below zero', () {
      final list = NodeState(wtListView);
      expect(list.recordRowExtent(0, 0), isFalse,
          reason: 'a zero extent gives no mean to switch the look-ahead on');
      expect(list.recordRowExtent(1, 0), isFalse);
      expect(list.meanRowExtent, isNull);
      expect(list.rowExtentOf(0), 0, reason: 'its own extent is still exact');
      expect(list.recordRowExtent(2, 300), isTrue,
          reason: 'the first non-zero row is what gives the list a mean');
      expect(list.recordRowExtent(3, 100), isFalse);
      expect(list.meanRowExtent, 200);
      // A row that drops to zero leaves the mean; one that grows rejoins.
      list.recordRowExtent(3, 0);
      expect(list.meanRowExtent, 300);
      list.recordRowExtent(0, 500);
      expect(list.meanRowExtent, 400);

      // Fractional extents (pixels / 2.8125) summed and taken back out
      // leave rounding drift behind; with only zeros left there must be
      // no mean, not a tiny negative one.
      final drift = NodeState(wtListView);
      for (var i = 0; i < 3; i++) {
        drift.recordRowExtent(i, 0);
      }
      const px = [1344, 1695, 793, 542, 1344, 456];
      for (var i = 0; i < px.length; i++) {
        drift.recordRowExtent(3 + i, px[i] / 2.8125);
      }
      drift.dropRowExtentsFrom(3);
      expect(drift.meanRowExtent, isNull);
      expect(drift.recordRowExtent(3, 100), isTrue);
      expect(drift.meanRowExtent, 100);
    });
  });

  testWidgets('measuring the first rows does not remount the list',
      (tester) async {
    // The look-ahead switching on must change the ListView's cacheExtent,
    // not move the ListView under a new parent: that would be a new
    // Scrollable — offset back to 0 — and every built row rebuilt.
    await mount(tester, 200);
    final scrollable = tester.state<ScrollableState>(find.byType(Scrollable));
    // Scroll through the placeholders before any row has landed (JS busy
    // at boot), then let rows arrive and the look-ahead switch on.
    position(tester).jumpTo(300);
    await tester.pump(const Duration(milliseconds: 16));
    await settle(tester, 40);
    expect(bridge.nodes[_list]!.meanRowExtent, isNotNull,
        reason: 'the look-ahead must have switched on for this to test it');
    expect(tester.state<ScrollableState>(find.byType(Scrollable)),
        same(scrollable),
        reason: 'the Scrollable must be the same one, not a remount');
    expect(position(tester).pixels, greaterThan(200),
        reason: 'the user scrolled to 300; a remount puts them back at 0');

    // A refresh that clears the list and reloads it switches the
    // look-ahead off and on again: still the same Scrollable.
    js
      ..setPropU32(_list, propItemCount, 0)
      ..commit();
    await tester.pump(const Duration(milliseconds: 16));
    js
      ..setPropU32(_list, propItemCount, 200)
      ..commit();
    await tester.pump(const Duration(milliseconds: 16));
    await settle(tester, 40);
    expect(tester.state<ScrollableState>(find.byType(Scrollable)),
        same(scrollable));
  });

  testWidgets('a short builder list can still be dragged and overscrolled',
      (tester) async {
    // A plain ListView given no physics picks AlwaysScrollableScrollPhysics
    // (vertical, no controller). The builder list hands ListView a
    // wrapper, which must keep that default inside it.
    await mount(tester, 3);
    await settle(tester, 40);
    final pos = position(tester);
    expect(pos.maxScrollExtent, 0,
        reason: '3 x 40 px rows must not fill the 600 px viewport');
    expect(pos.physics.shouldAcceptUserOffset(pos), isTrue,
        reason: 'a list shorter than its viewport must still accept a drag');
  });

  testWidgets('rows evicted after measuring zero are sized like unseen ones',
      (tester) async {
    // Rows that render nothing while their data loads measure 0 dp, and JS
    // evicts the ones far from what was last asked for. An evicted row's
    // placeholder sized by its cached 0 takes no space, so the layout walks
    // through every such row, asking for all of them again in one frame.
    //
    // JS here is renderer.js `_fillRows`: each requested index brings its
    // +-8 neighbours, and rows more than the keep radius outside the
    // requested span are evicted (LIST_CLEAR_ROW). The radius is 30 rather
    // than renderer.js's 300 only so eviction starts within a few frames.
    const overscan = 8, keepRadius = 30, count = 2000;
    await mount(tester, count);
    final jsRows = <int>{};
    final perFrame = <int>[];
    for (var f = 0; f < 40; f++) {
      await tester.pump(const Duration(milliseconds: 16));
      var asked = 0;
      for (final e in js.drainEvents()) {
        if (e.kind != evRowRequest || e.id != _handler) continue;
        final idx = (jsonDecode(e.payload!) as List).cast<int>();
        asked += idx.length;
        var lo = count, hi = -1;
        for (final i in idx) {
          if (i < lo) lo = i;
          if (i > hi) hi = i;
          for (var k = (i - overscan).clamp(0, count - 1);
              k <= (i + overscan).clamp(0, count - 1);
              k++) {
            if (!jsRows.add(k)) continue;
            js
              ..createNode(1000 + k, wtBox)
              ..setPropU32(1000 + k, propHeight, 0)
              ..writeOp(opListSetRow, _list, k, 1000 + k);
          }
        }
        for (final k in jsRows.toList()) {
          if (k >= lo - keepRadius && k <= hi + keepRadius) continue;
          jsRows.remove(k);
          js.writeOp(opListClearRow, _list, k, 0);
        }
      }
      js.commit();
      perFrame.add(asked);
    }
    expect(perFrame.where((n) => n > 0).length, greaterThan(20),
        reason: 'the list must keep asking (its rows stay empty) for this to '
            'test anything: $perFrame');
    final most = perFrame.reduce((a, b) => a > b ? a : b);
    expect(most, lessThanOrEqualTo(40),
        reason: 'one frame asked for $most rows; per frame: $perFrame');
  });

  test('dropping or clearing zero-height rows leaves no mean behind', () {
    // The pull-to-refresh sequence: count 0, then the new count.
    final cleared = NodeState(wtListView)
      ..recordRowExtent(0, 0)
      ..recordRowExtent(1, 0)
      ..recordRowExtent(2, 300);
    cleared.dropRowExtentsFrom(0);
    expect(cleared.meanRowExtent, isNull);

    final shrunk = NodeState(wtListView)
      ..recordRowExtent(0, 300)
      ..recordRowExtent(1, 0)
      ..recordRowExtent(2, 0);
    shrunk.dropRowExtentsFrom(1);
    expect(shrunk.meanRowExtent, 300);

    final reset = NodeState(wtListView)
      ..recordRowExtent(0, 0)
      ..recordRowExtent(1, 300);
    reset.clearRowExtents();
    expect(reset.meanRowExtent, isNull);
    expect(reset.recordRowExtent(0, 100), isTrue,
        reason: 'after a clear, the next non-zero row is the first again');
    expect(reset.meanRowExtent, 100);
  });

  test('a list that grew drops nothing; one that shrank drops the rest', () {
    final l = NodeState(wtListView);
    for (var i = 0; i < 10; i++) {
      l.recordRowExtent(i, 100);
    }
    l.dropRowExtentsFrom(20);
    expect(l.rowExtentOf(9), 100);
    l.dropRowExtentsFrom(9);
    expect(l.rowExtentOf(9), isNull, reason: 'the boundary row goes too');
    expect(l.rowExtentOf(8), 100);
    l.dropRowExtentsFrom(5);
    expect(l.rowExtentOf(5), isNull);
    expect(l.rowExtentOf(4), 100);
    // A row past the last drop, measured again, must be found by the next.
    l.recordRowExtent(7, 50);
    l.dropRowExtentsFrom(6);
    expect(l.rowExtentOf(7), isNull);
    expect(l.meanRowExtent, 100);
  });

  testWidgets('a resize does not rebuild the list or re-request its rows',
      (tester) async {
    // The look-ahead is sized by the viewport itself. A LayoutBuilder doing
    // it re-ran on every constraint change (a keyboard inset animating),
    // rebuilding every built row — and every unbuilt placeholder asked JS
    // for its row again.
    await mount(tester, 200);
    await tester.pump(const Duration(milliseconds: 16));
    expect(js.drainEvents().where((e) => e.kind == evRowRequest), isNotEmpty,
        reason: 'the first frame asks for its rows');
    addTearDown(tester.view.resetPhysicalSize);
    final start = tester.view.physicalSize;
    for (var i = 1; i <= 5; i++) {
      tester.view.physicalSize = Size(start.width, start.height - i * 60);
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(js.drainEvents().where((e) => e.kind == evRowRequest), isEmpty,
        reason: 'a shrinking viewport needs no new rows');
  });

  for (final (name, axis, scrollbar) in [
    ('horizontal', 1, false),
    ('with a scrollbar', 0, true),
  ]) {
    testWidgets('a short $name builder list keeps the plain default physics',
        (tester) async {
      // ScrollView adds AlwaysScrollableScrollPhysics only to a vertical
      // list without a controller. A short horizontal list inside a
      // horizontal <pageView> must leave the swipe to the pager.
      requests = [];
      bridge = SkalBridge(js)..ensureRoot();
      addTearDown(bridge.disableOffFrameDrain);
      js
        ..createNode(_list, wtListView)
        ..setPropU32(_list, propPadding, 0)
        ..setPropU32(_list, propGap, 0)
        ..setPropU32(_list, propAxis, axis)
        ..setPropU32(_list, propItemCount, 3)
        ..writeOp(opBindHandler, _list, evRowRequest, _handler)
        ..appendChild(kRootNodeId, _list);
      if (scrollbar) js.setPropU32(_list, propScrollbar, 1);
      js.commit();
      await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
      await tester.pump(const Duration(milliseconds: 16));
      final pos = position(tester);
      expect(pos.maxScrollExtent, 0);
      expect(pos.physics.shouldAcceptUserOffset(pos), isFalse);
    });
  }
}
