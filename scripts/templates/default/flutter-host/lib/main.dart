// __APP_NAME__ — Flutter host entry.
//
// Boot sequence:
//   1. Resolve the app data dir + create the Skal runtime
//      (`Skal.create()` spins up bun's worker + JSC).
//   2. Load the JS bundle from assets — bytecode cache in release
//      (copied out by skal_bundle.dart), source bundle in debug.
//   3. Wrap the bridge buffer in SkalBridge, drain once, then mount
//      Flutter widgets from the JS-produced tree.
//
// The whole sequence runs inside a try/catch: any boot failure (e.g. a
// dlopen error if libskal.dylib isn't embedded, or a JS eval error) shows a
// visible error screen instead of a silent black window.

import 'dart:io';

import 'package:flutter/foundation.dart' show kDebugMode, kReleaseMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/dialogs.dart';
import 'package:skal_flutter/skal/early_frame.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal_ffi.dart';

import 'skal_bundle.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Paint a frame NOW, before Skal.create() and the bundle eval.
  //
  // Flutter holds the Android 12+ system splash until its first frame,
  // then the OS runs a ~90 ms `starting_reveal` animation to hand over —
  // pure serial latency at the END of cold start. Getting a cheap frame
  // up first lets that reveal overlap boot instead of following it.
  //
  // `early.reveal()` below swaps the child under a root that already
  // exists. Do NOT replace this with a second runApp(): that rebuilds
  // the whole element tree and measured 13 ms SLOWER. See
  // SkalEarlyFrame for the full comparison.
  //
  // Measured on a Galaxy A14 (release, A/B/A n=10, 6 ms drift):
  // cold start 346 -> 320 ms. Neutral on other platforms — they have no
  // system splash reveal to overlap.
  final early = SkalEarlyFrame.show();
  // E2E visibility — force Flutter's semantics tree on so Maestro can read it.
  // Native Flutter only builds semantics when an accessibility service is
  // active, and Maestro's UIAutomator query doesn't reliably trigger that, so
  // without this the tree is invisible to it. Debug builds (where dev:android
  // E2E runs) plus an explicit `--dart-define=SKAL_E2E=true` for release E2E;
  // release otherwise never pays the always-on cost. See https://github.com/skal-multiplatform/skal/blob/main/docs/TESTING.md.
  if (kDebugMode || const bool.fromEnvironment('SKAL_E2E')) {
    WidgetsBinding.instance.ensureSemantics();
  }
  try {
    await _boot(early);
  } catch (e, st) {
    // Surface the failure instead of leaving a black screen. Common cause on
    // a fresh app: libskal.dylib not embedded in the .app (dlopen throws) —
    // see scripts/skal-link.sh / https://github.com/skal-multiplatform/skal/blob/main/docs/DEBUGGING.md.
    debugPrint('[skal] BOOT FAILED: $e\n$st');
    early.reveal(_BootError(message: '$e', detail: '$st'));
  }
}

Future<void> _boot(SkalEarlyFrame early) async {
  // Resolve the data dir up front so the JS store can read it
  // synchronously (skips the async getDataDir() RPC at boot). The
  // release bundle is copied out under the same directory, so keep it
  // rather than asking path_provider a second time (that call measured
  // 0.6 ms median on an M2 Mac release build, n=31).
  Directory? support;
  String dataDir = '';
  try {
    support = await getApplicationSupportDirectory();
    dataDir = '${support.path}/skal-store';
    Directory(dataDir).createSync(recursive: true);
  } catch (_) {}

  final tCreate0 = DateTime.now().microsecondsSinceEpoch;
  final skal = Skal.create(dataDir);
  if (skal == null) {
    throw StateError(
        'skal_create_runtime returned 0 — libskal initialized but the runtime '
        'failed to start.');
  }
  final tCreate1 = DateTime.now().microsecondsSinceEpoch;

  // Background-prewarm the native store while the JS bundle parses.
  if (dataDir.isNotEmpty) {
    try {
      skal.prewarmStore('$dataDir/store');
    } catch (_) {}
  }

  // Eval the JS bundle. Release path uses pre-compiled JSC bytecode
  // (~3× faster cold start than parsing).
  final EvalResult result;
  if (kReleaseMode) {
    // Re-checked on every launch: an update keeps the data directory, so
    // a copy made by the previous version would otherwise run forever.
    support ??= await getApplicationSupportDirectory();
    final cjsPath = await extractSkalBundle('${support.path}/skal-bundle');
    final loader =
        "(async()=>{await import(${_jsStringLiteral('file://$cjsPath')});"
        "return 'app loaded';})();";
    result = skal.evaluateApp(loader, url: 'skal:loader');
  } else {
    final source = await rootBundle.loadString('assets/skal-app.js');
    result = skal.evaluateApp(source, url: 'skal-app.js');
  }

  if (result.isError) {
    throw StateError('JS bundle failed to evaluate:\n${result.value}');
  }

  final bridge = SkalBridge(skal);
  bridge.ensureRoot();
  // Install the app dispatcher BEFORE the first pump: the eval above
  // already queued ops, and an app that fires an RPC during its initial
  // render (onMount probes, boot telemetry) has that invoke sitting in
  // the ring RIGHT NOW. Draining it before the dispatcher exists fails
  // the app's very first call with "no method dispatcher on node 1".
  installAppDispatcher(bridge);
  bridge.pumpOps();

  // Boot signal — confirms libskal loaded, the JS bundle evaluated, and
  // the first op pump produced a node tree. Also what E2E smoke tests
  // and `bun run dev:*` look for. Silence it once your app is real.
  debugPrint('[skal] init=${((tCreate1 - tCreate0) / 1000).toStringAsFixed(1)}ms '
      'nodes=${bridge.nodes.length}');

  // reveal(), not runApp() — a subtree insert under the root the early
  // frame already put up.
  early.reveal(SkalApp(bridge: bridge));
}

/// The app's shell around the Skal tree.
///
/// Edge to edge: the tree draws behind the status bar and the home
/// indicator, and places `<SafeArea>` where its content needs one (a
/// screen with a `title` gets a bar that insets itself). A SafeArea here
/// painted those strips in the host's colour, which no app could change.
///
/// Light or dark follows the app's `setDesign(mode, 'light' | 'dark')`:
/// the Material theme, and with it the background behind the tree, the
/// Cupertino theme and the status-bar icons.
class SkalApp extends StatelessWidget {
  const SkalApp({super.key, required this.bridge});

  final SkalBridge bridge;

  // Built once, not on every setDesign; Theme's change check is then an
  // identity test.
  static final ThemeData _light = ThemeData(brightness: Brightness.light);
  static final ThemeData _dark = ThemeData(brightness: Brightness.dark);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: bridge.designChanged,
      builder: (context, _) {
        final dark = bridge.designBrightness == 1;
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          navigatorKey: skalNavigatorKey,
          scaffoldMessengerKey: skalScaffoldMessengerKey,
          theme: dark ? _dark : _light,
          // Skal's own <text> colours flip in one frame. The default
          // 200 ms theme lerp would trail them, rebuilding every themed
          // widget on each frame of it.
          themeAnimationDuration: Duration.zero,
          // A transparent status bar, so on Android the tree shows through
          // rather than under Flutter's default dark scrim. This replaces
          // the style MaterialApp derives from the theme, so it carries the
          // icon brightness too. The navigation bar keeps the platform's,
          // and a screen's own bar overrides all of it.
          builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarBrightness: dark ? Brightness.dark : Brightness.light,
              statusBarIconBrightness:
                  dark ? Brightness.light : Brightness.dark,
            ),
            child: child!,
          ),
          home: Scaffold(body: SkalRoot(bridge: bridge)),
        );
      },
    );
  }
}

/// Visible boot-failure screen. Without this a boot exception leaves a black
/// window with no clue what went wrong; this shows the error + stack so you
/// can act on it.
class _BootError extends StatelessWidget {
  const _BootError({required this.message, this.detail});

  final String message;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF2A0000),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Skal failed to boot',
                    style: TextStyle(
                        color: Color(0xFFFF6B6B),
                        fontSize: 22,
                        fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  SelectableText(
                    message,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontFamily: 'monospace'),
                  ),
                  if (detail != null && detail!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    SelectableText(
                      detail!,
                      style: const TextStyle(
                          color: Color(0xFFBBBBBB),
                          fontSize: 11,
                          fontFamily: 'monospace'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _jsStringLiteral(String s) {
  final esc = s.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
  return "'$esc'";
}
