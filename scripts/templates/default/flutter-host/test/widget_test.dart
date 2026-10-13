// Tests for the app's shell (lib/main.dart's SkalApp).
//
// `flutter create` writes Flutter's counter-app test to this path. It
// cannot compile here (this app has no `MyApp`), so `flutter test` failed
// in every new app. Skal ships this file instead; `flutter create` leaves
// an existing file alone.
//
// libskal does not load under `flutter test`, so these pump the shell over
// a runtime with nothing in it: the Skal tree is empty, and what is tested
// is the shell around it. Run them with `bun run test`, which builds the
// JS bundle first: pubspec.yaml requires assets/skal-app.js to exist.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal/runtime.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'package:__APP_NAME_SNAKE__/main.dart';

void main() {
  late SkalBridge bridge;

  setUp(() => bridge = SkalBridge(_EmptyRuntime())..ensureRoot());
  tearDown(() => bridge.disableOffFrameDrain());

  /// What `setDesign(mode, 'dark' | 'light')` in JS does to the host.
  void setBrightness({required bool dark}) {
    bridge.designBrightness = dark ? 1 : 0;
    bridge.designChanged.notify();
  }

  BuildContext tree(WidgetTester tester) =>
      tester.element(find.byType(SkalRoot));

  testWidgets('the shell is light until the app picks a dark design',
      (tester) async {
    await tester.pumpWidget(SkalApp(bridge: bridge));
    expect(Theme.of(tree(tester)).brightness, Brightness.light);
    // What the shell told the platform: dark icons, on Android and on iOS,
    // over a transparent bar.
    final bar = SystemChrome.latestStyle;
    expect(bar?.statusBarIconBrightness, Brightness.dark);
    expect(bar?.statusBarBrightness, Brightness.light);
    expect(bar?.statusBarColor, Colors.transparent,
        reason: "Android's default scrim would sit over the tree");
  });

  testWidgets('a dark design turns the theme and the status bar dark',
      (tester) async {
    await tester.pumpWidget(SkalApp(bridge: bridge));
    setBrightness(dark: true);
    await tester.pump();

    final theme = Theme.of(tree(tester));
    expect(theme.brightness, Brightness.dark);
    final scaffold = tester.widget<Material>(find
        .descendant(of: find.byType(Scaffold), matching: find.byType(Material))
        .first);
    expect(scaffold.color, theme.scaffoldBackgroundColor,
        reason: 'the background behind the tree is the dark theme\'s');
    final bar = SystemChrome.latestStyle;
    expect(bar?.statusBarIconBrightness, Brightness.light);
    expect(bar?.statusBarBrightness, Brightness.dark);
    expect(bar?.statusBarColor, Colors.transparent);
  });

  testWidgets('the tree is drawn edge to edge', (tester) async {
    // A phone with a notch and a home indicator: 47 and 34 dp at 3x.
    tester.view.padding = const FakeViewPadding(top: 141, bottom: 102);
    addTearDown(tester.view.resetPadding);
    await tester.pumpWidget(SkalApp(bridge: bridge));

    expect(tester.getTopLeft(find.byType(SkalRoot)), Offset.zero,
        reason: 'nothing in the host pads the tree below the status bar');
    expect(MediaQuery.paddingOf(tree(tester)).top, 47,
        reason: "the insets are left for the app's own <SafeArea>");
  });
}

/// A JS runtime with nothing running in it: a zeroed bridge region, so
/// the bridge drains no ops and the Skal tree stays empty.
class _EmptyRuntime implements SkalRuntime {
  @override
  final Uint8List bridge = Uint8List(kBridgeSize);

  @override
  EvalResult evaluate(String source, {String url = ''}) =>
      EvalResult('', false);

  @override
  void wakeJs() {}

  @override
  void syncFromJs() {}

  @override
  void syncToJs() {}

  @override
  bool takeOpRingReset() => false;

  @override
  void markReplyHeapReset() {}

  // No doorbell: the shell then drains on every frame, as on a libskal
  // without one.
  @override
  bool enableHostNotify(void Function() callback) => false;

  @override
  void disableHostNotify() {}

  // A member a later skal_flutter adds to SkalRuntime lands here instead
  // of stopping this file from compiling after an upgrade.
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
