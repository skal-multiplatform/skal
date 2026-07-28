// Every node used to get a hot `ListenableBuilder`, whether or not it
// ever animated. Measured at +32% on a 2000-node build (~8 us per node,
// debug-mode Flutter), and most nodes in a real tree are static.
//
// It is now installed only for a node that has actually received a hot
// prop (`NodeState.everHot`, latched by the drain) or that drives its
// own transform through a gesture.
//
// These are WIDGET tests because the drain-side latch is not the
// interesting half. `bridge_drain_test.dart` already pins that the first
// hot prop dirties cold once and later ones do not — but both of those
// pass with the layer left unconditional, because they never look at the
// tree. Counting the builders is what actually distinguishes the two.

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

  /// Mount `count` sibling boxes under the root. `decorate` runs per node
  /// so a test can make some of them animated or gesture-driven.
  Future<void> mount(
    WidgetTester tester,
    int count, {
    void Function(int id)? decorate,
  }) async {
    for (var i = 0; i < count; i++) {
      final id = 100 + i;
      js
        ..createNode(id, wtBox)
        ..appendChild(kRootNodeId, id);
      decorate?.call(id);
    }
    js.commit();
    await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
    await tester.pump();
  }

  int listenableBuilders() =>
      find.byType(ListenableBuilder).evaluate().length;

  testWidgets('static nodes get no hot listener', (tester) async {
    await mount(tester, 30);
    final withNone = listenableBuilders();

    // Baseline with a different node count isolates the PER-NODE
    // contribution from the constant chrome around the tree.
    await tester.pumpWidget(const SizedBox());
    js = FakeSkalRuntime();
    bridge = SkalBridge(js)..ensureRoot();
    await mount(tester, 10);
    final withFewer = listenableBuilders();

    expect(withNone, withFewer,
        reason: '20 extra STATIC nodes must add no hot listeners');
  });

  testWidgets('a node that receives a hot prop gains one', (tester) async {
    await mount(tester, 10);
    final before = listenableBuilders();

    js
      ..setOpacity(105, 0.5)
      ..commit();
    bridge.pumpOps();
    await tester.pump();

    expect(bridge.nodes[105]!.everHot, isTrue);
    expect(listenableBuilders(), before + 1,
        reason: 'the first hot prop installs exactly one hot layer');
  });

  testWidgets('the layer persists once installed', (tester) async {
    await mount(tester, 10);
    js..setOpacity(105, 0.5)..commit();
    bridge.pumpOps();
    await tester.pump();
    final installed = listenableBuilders();

    // Back to identity. The latch is one-way on purpose: a tree whose
    // shape oscillates with the animation value would re-parent widgets
    // mid-animation.
    js..setOpacity(105, 1.0)..commit();
    bridge.pumpOps();
    await tester.pump();

    expect(listenableBuilders(), installed);
    expect(bridge.nodes[105]!.everHot, isTrue);
  });

  testWidgets('a gesture-driven node is wrapped BEFORE any hot prop',
      (tester) async {
    // The exemption that must not be optimized away. Inserting a
    // Transform the moment a drag first moves would re-parent the
    // GestureDetector below it and dispose the in-flight recognizer,
    // killing the drag after one frame — so these are wrapped from the
    // start, identity or not.
    await mount(tester, 10);
    final plain = listenableBuilders();

    await tester.pumpWidget(const SizedBox());
    js = FakeSkalRuntime();
    bridge = SkalBridge(js)..ensureRoot();
    await mount(tester, 10, decorate: (id) {
      if (id == 105) js.setPropU32(id, propDraggable, 1);
    });

    expect(bridge.nodes[105]!.everHot, isFalse,
        reason: 'no hot prop has arrived — this is the gesture path');
    expect(listenableBuilders(), plain + 1,
        reason: 'a draggable node keeps its hot layer from the start');
  });
}
