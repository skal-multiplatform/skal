// Skal — Flutter Web app entry point (Shape D of WEB_SUPPORT_PLAN.md).
//
// Native main.dart relies on libskal (bun + JavaScriptCore inside a
// dynamic library) for the JS runtime + on dart:io for APK bytecode
// extraction. Neither applies on web: the Solid/Skal JS bundle runs in
// the browser's own JS engine, and there's no APK to crack open.
//
// Boot sequence (matches the native one in main.dart 1:1 except for
// the JS-runtime + bytecode-extraction steps):
//
//   1. WidgetsFlutterBinding.ensureInitialized()
//   2. Register codegen-emitted custom widget adapters.
//   3. Skal.create() — web shim allocates a 2 MiB ArrayBuffer + installs
//      `globalThis.__skal_acquireBridge = () => buffer`.
//   4. Inject a `<script src="skal-app.js">` tag. Once it loads, the JS
//      bundle's `bridge.js` calls __skal_acquireBridge, gets the SAME
//      buffer (zero-copy), wires Solid's universal renderer to it, and
//      mounts the App component — writing op-batches into the shared
//      buffer.
//   5. SkalBridge(skal) wraps the buffer in the op-pump logic.
//   6. bridge.pumpOps() — initial drain so the very first Flutter
//      frame already has the JS-emitted tree.
//   7. runApp(SkalApp) — Flutter mounts the tree; pumpOps ticks every
//      frame thereafter.
//
// `flutter build web --target lib/main_web.dart` uses this entry.
// `flutter run -d chrome --target lib/main_web.dart` for dev.

import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/dialogs.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal_ffi.dart';

import 'adapters/generated/skal_adapters.g.dart' as local_gen;
import 'skal_codegen.g.dart' as packages_gen;

// Debug-only step marker — gated on kDebugMode so release builds don't
// leak `__skalDartStep` to globalThis or spam the console. Useful when
// the page goes blank: poke `window.__skalDartStep` in DevTools to see
// how far Dart's boot got before stalling.
void _mark(String label) {
  if (!kDebugMode) return;
  globalContext['__skalDartStep'] = label.toJS;
  // ignore: avoid_print
  print('[skal] step: $label');
}

// Debug-only error pinning — same gate as _mark. The visible
// _ErrorApp fires regardless; this is just the DevTools-poke channel.
void _recordError(String stage, Object error, StackTrace st) {
  if (!kDebugMode) return;
  globalContext['__skalDartError'] = '$stage: $error\n$st'.toJS;
}

Future<void> main() async {
  _mark('main:enter');
  WidgetsFlutterBinding.ensureInitialized();
  _mark('main:after-binding-init');

  // ── 0. Register codegen adapters ────────────────────────────────────
  local_gen.registerAll();
  packages_gen.registerAll();
  _mark('main:after-register-adapters');

  // ── 1. Create the (web) Skal runtime ────────────────────────────────
  //
  // Allocates the 2 MiB bridge buffer in JS heap + installs
  // `globalThis.__skal_acquireBridge`. The Solid/Skal JS bundle's
  // `bridge.js` will read the SAME buffer back when it boots in step 2.
  // The empty dataDir is intentional — the web store falls back to its
  // in-memory backend (no IndexedDB integration yet).
  final skal = Skal.create('');
  if (skal == null) {
    runApp(const _ErrorApp(message: 'Skal.create returned null'));
    return;
  }
  _mark('main:after-skal-create');

  // ── 2. Wrap in the bridge + dispatcher ──────────────────────────────
  //
  // Bridge wraps the (still-empty) buffer; ensureRoot reserves node 1
  // so SkalRoot can mount even before JS has emitted any ops. No
  // initial pumpOps here — the buffer is empty (JS bundle hasn't been
  // injected yet) and SkalRoot's per-frame Ticker will drain whatever
  // JS writes once the bundle lands.
  //
  // Try-caught only on web (not on native main.dart) because dart2js
  // surfaces some bridge failures (Int64-accessor incompat, typed-
  // array shape mismatches) that don't exist on native AOT. An
  // _ErrorApp here is much more useful than a blank Flutter Web canvas.
  final SkalBridge bridge;
  try {
    bridge = SkalBridge(skal);
  } catch (e, st) {
    _recordError('SkalBridge ctor', e, st);
    runApp(_ErrorApp(message: 'SkalBridge ctor threw: $e'));
    return;
  }
  _mark('main:after-bridge-ctor');
  bridge.ensureRoot();
  installAppDispatcher(bridge);
  _mark('main:after-app-dispatcher');

  // ── 3. Mount + load the JS bundle in parallel ───────────────────────
  //
  // Critically: runApp() FIRST so Flutter Web's first frame paints
  // immediately (theme + scaffold visible). _injectSkalJsBundle runs
  // concurrently — the browser fetches + parses skal-app.js while
  // Flutter is mounting its tree. When the bundle finishes executing,
  // it has already written ops to the bridge; SkalRoot's next Ticker
  // tick drains them and paints the Solid tree.
  //
  // Order safety: Skal.create above has already installed
  // __skal_acquireBridge, so it doesn't matter whether the JS bundle
  // evaluates before, during, or after runApp — the bridge buffer is
  // there. Static <script src=> in index.html is the one thing that
  // wouldn't work, because that runs BEFORE Dart's main.
  runApp(SkalWebApp(bridge: bridge));
  _mark('main:after-runApp');

  // Fire-and-forget the injection. Errors are surfaced via the
  // browser's console + _recordError; the Skal tree will simply stay
  // empty if the bundle fails to load.
  unawaited(_injectSkalJsBundle().then(
    (_) => _mark('main:after-inject-bundle'),
    onError: (Object e, StackTrace st) {
      _recordError('skal-app.js inject', e, st);
    },
  ));
}

/// Dynamically inject the Solid/Skal JS bundle. Resolves when the
/// script has finished executing — by which point the JS side has
/// called __skal_acquireBridge, wired Solid's universal renderer, and
/// queued the initial CREATE_NODE batch into the shared buffer.
Future<void> _injectSkalJsBundle() async {
  final completer = Completer<void>();

  // The bundle is intentionally NOT a module — it's the same IIFE form
  // libskal evaluates on native, so it runs synchronously on `<script>`
  // load. (A module would defer + add a microtask hop.)
  final doc = globalContext['document'] as JSObject;
  final script = doc.callMethod<JSObject>(
    'createElement'.toJS,
    'script'.toJS,
  );
  script['src'] = 'skal-app.js'.toJS;
  script['async'] = false.toJS;
  // Onload fires when the script has been parsed AND its top-level
  // body has run to completion. The DOM passes the event as the first
  // arg — our callback must accept (and ignore) it; a 0-arg Dart
  // closure converted via .toJS would throw "JS argument count
  // mismatch" silently.
  script['onload'] = ((JSAny? _) {
    if (!completer.isCompleted) completer.complete();
  }).toJS;
  script['onerror'] = ((JSAny? e) {
    if (!completer.isCompleted) {
      completer.completeError(
        StateError('Skal: failed to load skal-app.js — $e'),
      );
    }
  }).toJS;

  final head = doc['head'] as JSObject;
  head.callMethod<JSAny?>('appendChild'.toJS, script);

  return completer.future;
}

class SkalWebApp extends StatelessWidget {
  final SkalBridge bridge;
  const SkalWebApp({super.key, required this.bridge});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: bridge.designChanged,
      builder: (context, _) {
        final dark = bridge.designBrightness == 1;
        return MaterialApp(
          title: 'Skal — Web (Flutter)',
          theme: dark
              ? ThemeData.dark(useMaterial3: true)
              : ThemeData.light(useMaterial3: true),
          debugShowCheckedModeBanner: false,
          navigatorKey: skalNavigatorKey,
          scaffoldMessengerKey: skalScaffoldMessengerKey,
          home: CupertinoTheme(
            data: CupertinoThemeData(
              brightness: dark ? Brightness.dark : Brightness.light,
            ),
            child: Scaffold(
              backgroundColor: dark
                  ? const Color(0xFF101014)
                  : const Color(0xFFF0F0F3),
              body: SafeArea(
                child: SkalRoot(bridge: bridge),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ErrorApp extends StatelessWidget {
  final String message;
  const _ErrorApp({required this.message});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Skal boot failed:\n\n$message',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red),
            ),
          ),
        ),
      ),
    );
  }
}
