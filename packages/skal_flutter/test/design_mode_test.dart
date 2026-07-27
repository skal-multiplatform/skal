// Material ↔ Cupertino: the crash, and the switch.
//
// These are WIDGET tests — a real `SkalRoot` over a real `Navigator`,
// mounted on `FakeSkalRuntime`. That only became possible with the
// `SkalRuntime` seam; before it, everything below needed a device.
//
// Two independent defects, both reported from the demo's Animations
// screen:
//
//  1. **A crash in a supported configuration.** `_screenChrome`'s
//     Cupertino branch returned a bare `CupertinoPageScaffold`, which
//     hosts no `Material`. A Skal tree is not all-Cupertino — the
//     builders emit Material widgets that need an ink host — so a
//     `<screen title>` under Cupertino design threw "No Material widget
//     found" as soon as such a child painted. No switching involved: a
//     pure Cupertino app hit this.
//
//  2. **Switching mode did nothing.** Three separate comments in
//     `root.dart` / `bridge.dart` called the mode an init-time flag,
//     while the shipped demo has a button for it.
//     `MemoizingListenableBuilder` returns each node's cached subtree
//     until that node's own `cold` fires, so the flip reached almost
//     nothing and the tree rendered half in each design.
//
//     The `CupertinoPage` ↔ `MaterialPage` swap under one
//     `ValueKey<int>` was ALSO suspected, and a design-discriminating
//     page key was written for it — then deleted, because mutating it
//     back changed no test. `Page.canUpdate` already compares
//     `runtimeType`, so the navigator replaces the route rather than
//     trying to update across page types. The suspicion was wrong and
//     the extra key type was pure weight.

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

const int kDesignMaterial = 0;
const int kDesignCupertino = 1;

const int navId = 10;
const int screenId = 11;
const int contentId = 12;
const int buttonId = 13;

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  /// root(1) → navigator → screen(title) → box → button
  ///
  /// The button matters: it is a Material `ElevatedButton`, i.e. an ink
  /// host is REQUIRED. That is what turns defect 1 from a cosmetic
  /// difference into an exception.
  Future<void> mount(WidgetTester tester, {required int design}) async {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js)..ensureRoot();

    js
      ..setDesign(design)
      ..createNode(navId, wtNavigator)
      ..createNode(screenId, wtScreen)
      ..createNode(contentId, wtBox)
      ..createNode(buttonId, wtButton)
      ..setPropStr(screenId, propTitle, 'Animations')
      ..setText(buttonId, 'Run')
      ..appendChild(kRootNodeId, navId)
      ..appendChild(navId, screenId)
      ..appendChild(screenId, contentId)
      ..appendChild(contentId, buttonId)
      ..commit();

    await tester.pumpWidget(MaterialApp(home: SkalRoot(bridge: bridge)));
    await tester.pump();
  }

  tearDown(() => bridge.disableOffFrameDrain());

  group('Cupertino design', () {
    testWidgets('renders a titled screen without throwing', (tester) async {
      await mount(tester, design: kDesignCupertino);

      // THE regression: a bare CupertinoPageScaffold hosts no Material,
      // so the ElevatedButton below threw "No Material widget found".
      expect(tester.takeException(), isNull);
      expect(find.byType(CupertinoNavigationBar), findsOneWidget);
      expect(find.text('Animations'), findsWidgets);
    });

    testWidgets('provides an ink host for Material children', (tester) async {
      await mount(tester, design: kDesignCupertino);

      // Present, and transparent — the iOS chrome must not gain a
      // Material surface colour just because we needed ink.
      final materials = tester
          .widgetList<Material>(find.byType(Material))
          .where((m) => m.type == MaterialType.transparency);
      expect(materials, isNotEmpty,
          reason: 'MaterialType.transparency paints nothing; it exists '
              'purely so Material children have an ink host');
    });
  });

  group('Material design', () {
    testWidgets('renders an AppBar, not a Cupertino nav bar', (tester) async {
      await mount(tester, design: kDesignMaterial);

      expect(tester.takeException(), isNull);
      expect(find.byType(AppBar), findsOneWidget);
      expect(find.byType(CupertinoNavigationBar), findsNothing);
    });
  });

  group('switching mode at runtime', () {
    testWidgets('Cupertino → Material swaps the chrome', (tester) async {
      await mount(tester, design: kDesignCupertino);
      expect(find.byType(CupertinoNavigationBar), findsOneWidget);

      js
        ..setDesign(kDesignMaterial)
        ..commit();
      // NOT pumpAndSettle: SkalRoot drives its drain from a Ticker,
      // which requests a frame every frame forever, so the frame queue
      // never drains and pumpAndSettle times out. Pump past the route
      // transition explicitly instead.
      await tester.pump(); // drain applies the op
      await tester.pump(); // rebuild
      await tester.pump(const Duration(milliseconds: 400)); // transition
      await tester.pump(const Duration(milliseconds: 400));

      expect(tester.takeException(), isNull);
      expect(find.byType(AppBar), findsOneWidget,
          reason: 'the flip has to invalidate cached subtrees — without '
              'that, MemoizingListenableBuilder keeps serving the '
              'Cupertino build and the app renders half in each design');
      expect(find.byType(CupertinoNavigationBar), findsNothing);
    });

    testWidgets('Material → Cupertino swaps the chrome', (tester) async {
      await mount(tester, design: kDesignMaterial);
      expect(find.byType(AppBar), findsOneWidget);

      js
        ..setDesign(kDesignCupertino)
        ..commit();
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 400));

      expect(tester.takeException(), isNull);
      expect(find.byType(CupertinoNavigationBar), findsOneWidget);
      expect(find.byType(AppBar), findsNothing);
    });

    testWidgets('a flip marks every node dirty, exactly once', (tester) async {
      await mount(tester, design: kDesignMaterial);

      final notified = <int, int>{};
      for (final id in bridge.nodes.keys) {
        notified[id] = 0;
        bridge.nodes[id]!.cold
            .addListener(() => notified[id] = notified[id]! + 1);
      }

      js
        ..setDesign(kDesignCupertino)
        ..commit();
      await tester.pump();

      expect(notified.values.every((v) => v == 1), isTrue,
          reason: 'every node rebuilds, and none of them twice: $notified');
    });

    testWidgets('re-setting the SAME mode does not dirty the tree',
        (tester) async {
      await mount(tester, design: kDesignMaterial);

      final notified = <int, int>{};
      for (final id in bridge.nodes.keys) {
        notified[id] = 0;
        bridge.nodes[id]!.cold
            .addListener(() => notified[id] = notified[id]! + 1);
      }

      // Brightness-only updates go through `_SkalBrightness` and must
      // not drag a full-tree rebuild with them.
      js
        ..setDesign(kDesignMaterial, brightness: 1)
        ..commit();
      await tester.pump();

      expect(notified.values.every((v) => v == 0), isTrue,
          reason: 'only the mode CHANGING justifies invalidating every '
              'cached subtree: $notified');
    });
  });
}
