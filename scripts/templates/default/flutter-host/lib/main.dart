// __APP_NAME__ — Flutter host entry.
//
// Boot sequence:
//   1. Resolve the app data dir + create the Skal runtime
//      (`Skal.create()` spins up bun's worker + JSC).
//   2. Load the JS bundle from assets — bytecode cache in release,
//      source bundle in debug.
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
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal_ffi.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // E2E visibility — force Flutter's semantics tree on so Maestro can read it.
  // Native Flutter only builds semantics when an accessibility service is
  // active, and Maestro's UIAutomator query doesn't reliably trigger that, so
  // without this the tree is invisible to it. Debug builds (where dev:android
  // E2E runs) plus an explicit `--dart-define=SKAL_E2E=true` for release E2E;
  // release otherwise never pays the always-on cost. See docs/TESTING.md.
  if (kDebugMode || const bool.fromEnvironment('SKAL_E2E')) {
    WidgetsBinding.instance.ensureSemantics();
  }
  try {
    await _boot();
  } catch (e, st) {
    // Surface the failure instead of leaving a black screen. Common cause on
    // a fresh app: libskal.dylib not embedded in the .app (dlopen throws) —
    // see scripts/skal-link.sh / docs/DEBUGGING.md.
    debugPrint('[skal] BOOT FAILED: $e\n$st');
    runApp(_BootError(message: '$e', detail: '$st'));
  }
}

Future<void> _boot() async {
  // Resolve the data dir up front so the JS store can read it
  // synchronously (skips the async getDataDir() RPC at boot).
  String dataDir = '';
  try {
    final support = await getApplicationSupportDirectory();
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
    final cjsPath = await _extractBytecodeAssets();
    final loader =
        "(async()=>{await import(${_jsStringLiteral('file://$cjsPath')});"
        "return 'app loaded';})();";
    result = skal.evaluate(loader, url: 'skal:loader');
  } else {
    final source = await rootBundle.loadString('assets/skal-app.js');
    result = skal.evaluate(source, url: 'skal-app.js');
  }

  if (result.isError) {
    throw StateError('JS bundle failed to evaluate:\n${result.value}');
  }

  final bridge = SkalBridge(skal);
  bridge.ensureRoot();
  bridge.pumpOps();
  installAppDispatcher(bridge);

  // Boot signal — confirms libskal loaded, the JS bundle evaluated, and
  // the first op pump produced a node tree. Also what E2E smoke tests
  // and `bun run dev:*` look for. Silence it once your app is real.
  debugPrint('[skal] init=${((tCreate1 - tCreate0) / 1000).toStringAsFixed(1)}ms '
      'nodes=${bridge.nodes.length}');

  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    navigatorKey: skalNavigatorKey,
    scaffoldMessengerKey: skalScaffoldMessengerKey,
    home: Scaffold(
      body: SafeArea(child: SkalRoot(bridge: bridge)),
    ),
  ));
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

Future<String> _extractBytecodeAssets() async {
  final support = await getApplicationSupportDirectory();
  final out = '${support.path}/skal-bundle';
  Directory(out).createSync(recursive: true);
  final cjs = File('$out/skal-app.cjs');
  final jsc = File('$out/skal-app.cjs.jsc');
  if (!cjs.existsSync()) {
    final bytes = await rootBundle.load('assets/skal-app.cjs');
    cjs.writeAsBytesSync(bytes.buffer.asUint8List());
  }
  if (!jsc.existsSync()) {
    final bytes = await rootBundle.load('assets/skal-app.cjs.jsc');
    jsc.writeAsBytesSync(bytes.buffer.asUint8List());
  }
  return cjs.path;
}

String _jsStringLiteral(String s) {
  final esc = s.replaceAll(r'\', r'\\').replaceAll("'", r"\'");
  return "'$esc'";
}
