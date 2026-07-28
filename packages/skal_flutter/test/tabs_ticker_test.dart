// `<tabs>` keeps every tab subtree mounted — that is the keep-alive
// guarantee, and it is deliberate. But mounted is not the same as
// running, and `IndexedStack` says nothing about tickers: an animation
// in a tab the user cannot see went on asking for a frame every vsync,
// forever.
//
// Measured on the kitchen-sink demo (macOS release): a looping animation
// plus an indeterminate spinner, sitting on a hidden tab, held the whole
// app at 61 FPS and 7.83% CPU while it did nothing. With hidden tabs
// ticker-disabled that is 2 FPS and 0.67% — against 0.1% for a stock
// Flutter app doing nothing at all.
//
// None of the drain-side or bridge-side tests can see this: the tree is
// identical either way, the ops are identical either way, and the app
// looks correct the whole time. It is only visible by asking the widget
// tree whether the hidden subtrees are allowed to tick.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js)..ensureRoot();
  });
  tearDown(() => bridge.disableOffFrameDrain());

  /// A `<tabs>` with [count] `<tab>` children, [active] selected. Each
  /// tab holds one box so there is a real subtree to tick.
  Future<void> mountTabs(WidgetTester tester, int count, int active) async {
    const tabsId = 50;
    js
      ..createNode(tabsId, wtTabs)
      ..setPropU32(tabsId, propActiveTab, active)
      ..appendChild(kRootNodeId, tabsId);
    for (var i = 0; i < count; i++) {
      final tabId = 100 + i;
      final bodyId = 200 + i;
      js
        ..createNode(tabId, wtTab)
        ..setPropStr(tabId, propTitle, 'tab$i')
        ..appendChild(tabsId, tabId)
        ..createNode(bodyId, wtBox)
        ..appendChild(tabId, bodyId);
    }
    js.commit();
    await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
    await tester.pump();
  }

  /// `enabled` of every TickerMode the tabs body installed, in order.
  ///
  /// Read off the IndexedStack's own child list rather than via
  /// `find.byType`, for two reasons that both silently return the wrong
  /// answer otherwise:
  ///
  ///  * `find.byType` skips OFFSTAGE widgets by default, and an
  ///    inactive IndexedStack child is precisely that — so it reports
  ///    only the visible tab and every assertion below passes
  ///    vacuously, including on code with the fix deleted.
  ///  * MaterialApp / Navigator install TickerModes of their own, all
  ///    enabled, so an unscoped search counts Flutter's as well as ours.
  ///
  /// The tabs body is the one IndexedStack whose children are all
  /// TickerMode — which is the property under test, so a build that
  /// stopped wrapping them yields `[]` and fails loudly.
  List<bool> tickerModes(WidgetTester tester) {
    for (final s in tester.widgetList<IndexedStack>(
        find.byType(IndexedStack, skipOffstage: false))) {
      if (s.children.isNotEmpty && s.children.every((c) => c is TickerMode)) {
        return s.children.cast<TickerMode>().map((t) => t.enabled).toList();
      }
    }
    return const <bool>[];
  }

  testWidgets('only the active tab may tick', (tester) async {
    await mountTabs(tester, 3, 1);

    final modes = tickerModes(tester);
    expect(modes.length, 3, reason: 'each tab body needs its own TickerMode');
    expect(modes, [false, true, false],
        reason: 'a hidden tab that can still tick animates forever');
  });

  testWidgets('switching tabs moves the enabled one, and does not remount',
      (tester) async {
    await mountTabs(tester, 3, 0);
    expect(tickerModes(tester).indexOf(true), 0);

    // Every subtree stays mounted across the switch — that is the
    // keep-alive guarantee TickerMode must not break. IndexedStack keeps
    // all three children in the tree regardless of which is painted.
    final mountedBefore = tickerModes(tester).length;

    js.setPropU32(50, propActiveTab, 2);
    js.commit();
    bridge.pumpOps();
    await tester.pump();

    expect(tickerModes(tester).indexOf(true), 2,
        reason: 'the newly selected tab has to resume ticking');
    expect(tickerModes(tester).length, mountedBefore,
        reason: 'switching tabs must not unmount or add subtrees');
  });

  testWidgets('the first tab is the enabled one when it is selected',
      (tester) async {
    // Guards the off-by-one shape of the loop — an `i != active` or an
    // off-by-one bound leaves the visible tab frozen, which is the
    // failure mode a user would actually notice.
    await mountTabs(tester, 2, 0);
    expect(tickerModes(tester), [true, false]);
  });
}
