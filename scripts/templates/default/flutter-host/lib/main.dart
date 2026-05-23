// __APP_NAME__ — Flutter host entry.
//
// Boot sequence:
//   1. Resolve the app data dir + create the Skal runtime
//      (`Skal.create()` spins up bun's worker + JSC).
//   2. Load the JS bundle from assets — bytecode cache in release,
//      source bundle in debug.
//   3. Wrap the bridge buffer in SkalBridge, drain once, then mount
//      Flutter widgets from the JS-produced tree.

import 'dart:io';

import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/dialogs.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal_ffi.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Resolve the data dir up front so the JS store can read it
  // synchronously (skips the async getDataDir() RPC at boot).
  String dataDir = '';
  try {
    final support = await getApplicationSupportDirectory();
    dataDir = '${support.path}/skal-store';
    Directory(dataDir).createSync(recursive: true);
  } catch (_) {}

  final skal = Skal.create(dataDir);
  if (skal == null) {
    runApp(const MaterialApp(home: Scaffold(body: Center(child: Text('skal_create_runtime returned 0')))));
    return;
  }

  // Background-prewarm the native store while the JS bundle parses.
  if (dataDir.isNotEmpty) {
    try { skal.prewarmStore('$dataDir/store'); } catch (_) {}
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

  final bridge = SkalBridge(skal);
  bridge.ensureRoot();
  bridge.pumpOps();
  installAppDispatcher(bridge);

  if (result.isError) {
    debugPrint('[skal] EVAL ERROR: ${result.value}');
  }

  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    navigatorKey: skalNavigatorKey,
    scaffoldMessengerKey: skalScaffoldMessengerKey,
    home: Scaffold(
      body: SafeArea(child: SkalRoot(bridge: bridge)),
    ),
  ));
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
