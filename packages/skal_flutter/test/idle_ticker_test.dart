// The frame ticker stops when there is nothing to do.
//
// It used to run forever. A Ticker asks the engine for a frame every
// vsync while it is active, so a completely static screen woke the
// engine 120 times a second to find nothing — the largest battery cost
// in the framework, paid by every idle app.
//
// The failure mode of getting this wrong is the worst one available: an
// app that stops updating. So the rule is deliberately lopsided —
// anything uncertain keeps ticking, and the ticker only stops on a
// frame that positively reported idle.
//
// `SkalRoot` is a widget, so these drive it through `WidgetTester`.
// `tester.binding.hasScheduledFrame` is the observable that matters: it
// is what actually costs battery, and it is false only when nothing has
// asked the engine for another frame.

import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  Future<void> mount(WidgetTester tester) async {
    bridge = SkalBridge(js)..ensureRoot();
    await tester.pumpWidget(SkalRoot(bridge: bridge));
    addTearDown(bridge.disableOffFrameDrain);
  }

  /// Pump until the tree stops asking for frames, or give up. Returns
  /// whether it settled — `pumpAndSettle` cannot be used here, since a
  /// never-stopping ticker is precisely the bug under test and would
  /// hang the suite instead of failing it.
  Future<bool> settle(WidgetTester tester, {int maxFrames = 40}) async {
    for (var i = 0; i < maxFrames; i++) {
      if (!tester.binding.hasScheduledFrame) return true;
      await tester.pump(const Duration(milliseconds: 16));
    }
    return !tester.binding.hasScheduledFrame;
  }

  setUp(() => js = FakeSkalRuntime());

  group('with the doorbell armed (native)', () {
    testWidgets('an idle tree stops asking for frames', (tester) async {
      await mount(tester);
      expect(await settle(tester), isTrue,
          reason: 'a static tree must let the engine go to sleep');
    });

    testWidgets('a published batch wakes it and it settles again',
        (tester) async {
      await mount(tester);
      await settle(tester);
      expect(tester.binding.hasScheduledFrame, isFalse);

      // The real JS path: publish rings, the ring wakes the host.
      js
        ..createNode(2, wtBox)
        ..appendChild(kRootNodeId, 2)
        ..commit();

      expect(tester.binding.hasScheduledFrame, isTrue,
          reason: 'the doorbell must restart a stopped ticker');

      await settle(tester);
      expect(bridge.nodes.containsKey(2), isTrue,
          reason: 'the ops must actually have been applied');
      expect(tester.binding.hasScheduledFrame, isFalse);
    });

    testWidgets('the notifications an off-frame drain defers are still '
        'delivered', (tester) async {
      // The dangerous interaction. `pumpOffFrame` applies ops but defers
      // every notification to the next FRAME pump. If the doorbell
      // drained without also restarting the ticker, those notifications
      // would sit forever with nothing coming to deliver them — the
      // stranded-update bug, reached by a different route.
      await mount(tester);
      js
        ..createNode(2, wtBox)
        ..appendChild(kRootNodeId, 2)
        ..commit();
      await settle(tester);

      var notified = 0;
      bridge.nodes[2]!.cold.addListener(() => notified++);

      js
        ..setPropU32(2, propWidth, 42)
        ..commit();
      await settle(tester);

      expect(notified, 1, reason: 'a deferred notify must still arrive');
      expect(bridge.nodes[2]!.getPropU32(propWidth, 0), 42);
    });

    testWidgets('a host-side event wakes it', (tester) async {
      await mount(tester);
      await settle(tester);
      expect(tester.binding.hasScheduledFrame, isFalse);

      // A tap. JS will answer with ops, and a spilled event needs pumps
      // to drain — either way something has to be running.
      bridge.dispatchEvent(77);
      expect(tester.binding.hasScheduledFrame, isTrue);
    });

    testWidgets('repeated idle frames do not thrash start/stop',
        (tester) async {
      await mount(tester);
      await settle(tester);
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(tester.binding.hasScheduledFrame, isFalse,
            reason: 'an idle pump must not re-arm the ticker');
      }
    });
  });

  group('without the doorbell (web, or a libskal predating it)', () {
    testWidgets('keeps ticking every frame', (tester) async {
      js.doorbellAvailable = false;
      await mount(tester);

      // Nothing will ever wake this host, so it must never stop. The
      // assertion is the inverse of the one above, and it is the more
      // important of the two: stopping here is a frozen app.
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(tester.binding.hasScheduledFrame, isTrue,
            reason: 'without a wake signal the ticker is the only thing '
                'moving ops across — it may not stop');
      }
    });

    testWidgets('still applies ops published with no ring', (tester) async {
      js.doorbellAvailable = false;
      await mount(tester);

      js
        ..createNode(2, wtBox)
        ..appendChild(kRootNodeId, 2)
        ..publishOnly(); // no ring — the web shape
      await tester.pump(const Duration(milliseconds: 16));
      await tester.pump(const Duration(milliseconds: 16));

      expect(bridge.nodes.containsKey(2), isTrue);
    });
  });
}
