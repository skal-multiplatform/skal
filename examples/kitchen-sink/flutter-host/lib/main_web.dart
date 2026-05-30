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
//   3. Skal.create() — web shim allocates a 6 MiB ArrayBuffer + installs
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
import 'dart:ui_web' as ui_web;

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/dialogs.dart';
import 'package:skal_flutter/skal/root.dart';
import 'package:skal_flutter/skal_ffi.dart';
import 'package:web/web.dart' as web;

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

/// One-shot boot probe: logs the cross-origin isolation state and
/// stashes it on `globalThis.__skal_isolation_info` so apps can read
/// it programmatically.
///
/// When `window.crossOriginIsolated` is `true` (the host sent
/// `Cross-Origin-Opener-Policy: same-origin` +
/// `Cross-Origin-Embedder-Policy: require-corp`), Flutter's skwasm
/// renderer fans tile rasterization across Web Worker threads —
/// typically 2-4× faster raster on multi-core machines. Otherwise
/// raster stays single-threaded.
///
/// The bridge itself doesn't change either way: slice-sync stays
/// faster than buffer aliasing on dart2wasm (the drain loop reads
/// ~1 ns each as Wasm load instructions vs ~10-30 ns each as JS
/// interop calls). This probe is purely about raster, plus helping
/// users diagnose "why isn't my deploy faster" issues. See
/// `docs/WEB_SUPPORT_PLAN.md` §Shape D-skwasm for deploy snippets
/// (Vercel / Netlify / Firebase / nginx headers).
///
/// Logged unconditionally — useful in production for verifying the
/// deploy configuration. The stashed object is read-only by intent;
/// it's a diagnostic surface, not a control knob.
void _logIsolationState() {
  // This is a diagnostic that runs unconditionally at the very top of
  // main() (before runApp / the bridge try-catch), so it must NEVER be
  // able to abort boot. crossOriginIsolated + hardwareConcurrency are
  // typed getters on package:web's Window/Navigator (already imported
  // for the HtmlEmbed DOM hooks); they're present on every browser
  // Flutter Web supports, but reading an absent property through an
  // `external` getter throws on dart2wasm rather than yielding a
  // fallback — so the whole probe is wrapped defensively. SharedArrayBuffer
  // has no typed existence check, so it stays a globalContext probe.
  try {
    final isolated = web.window.crossOriginIsolated;
    final hasSAB = globalContext['SharedArrayBuffer'] != null;
    final cores = web.window.navigator.hardwareConcurrency;

    final info = JSObject();
    info['crossOriginIsolated'] = isolated.toJS;
    info['hasSharedArrayBuffer'] = hasSAB.toJS;
    info['hardwareConcurrency'] = cores.toJS;
    globalContext['__skal_isolation_info'] = info;

    if (isolated && hasSAB) {
      // ignore: avoid_print
      print('[skal] threading: isolated=true, sab=true, cores=$cores '
          '— threaded skwasm should be active');
    } else {
      // ignore: avoid_print
      print('[skal] threading: isolated=$isolated, sab=$hasSAB, cores=$cores '
          '— single-threaded raster '
          '(set COOP/COEP headers to enable; see docs/WEB_SUPPORT_PLAN.md)');
    }
  } catch (e) {
    // ignore: avoid_print
    print('[skal] threading: isolation probe failed ($e) — continuing boot');
  }
}

// ── HtmlEmbed factory bridge (Shape D-with-holes) ────────────────────
//
// JS side calls `registerHtmlView(viewType, factory)` (in
// skal/index.js); that function calls
// `globalThis.__skalRegisterHtmlView(viewType)`, installed here, which
// registers a Dart-side platformViewRegistry factory for viewType.
// When Flutter Web instantiates an HtmlElementView, the Dart factory
// calls JS's `__skalCreateHtmlViewElement(viewType, viewId)` to build
// the actual DOM element. End-to-end: JS owns the factory body, Dart
// owns the registry, Flutter owns the composite.
final Set<String> _registeredHtmlViewTypes = <String>{};

void _installHtmlEmbedHooks() {
  globalContext['__skalRegisterHtmlView'] = ((JSString viewType) {
    final type = viewType.toDart;
    // platformViewRegistry throws on duplicate registration — guard
    // for HMR / repeated calls in dev.
    if (_registeredHtmlViewTypes.contains(type)) return;
    _registeredHtmlViewTypes.add(type);
    ui_web.platformViewRegistry.registerViewFactory(
      type,
      (int viewId, {Object? params}) {
        // Call back into JS to build the actual DOM element.
        final create = globalContext.getProperty<JSFunction?>(
          '__skalCreateHtmlViewElement'.toJS,
        );
        if (create == null) {
          // JS bundle didn't install the hook (out-of-order load?) —
          // return a visible error placeholder so layout doesn't
          // collapse silently.
          final fallback = web.HTMLDivElement();
          fallback.textContent =
              'Skal: __skalCreateHtmlViewElement missing for viewType="$type"';
          fallback.style.color = '#d33';
          return fallback;
        }
        // The JS factory returns the DOM element; cast back to
        // web.HTMLElement for Flutter's HtmlElementView API.
        final el = create.callAsFunction(null, type.toJS, viewId.toJS);
        return el as web.HTMLElement;
      },
    );
  }).toJS;
}

Future<void> main() async {
  _mark('main:enter');
  WidgetsFlutterBinding.ensureInitialized();
  _mark('main:after-binding-init');

  // Probe the cross-origin isolation context. If the host set
  // COOP/COEP, skwasm auto-enables threaded raster — biggest perf
  // win available on the web target; checked once at boot so the
  // log line shows up in dev + production both.
  _logIsolationState();

  // ── 0. Register codegen adapters + HtmlEmbed hook ───────────────────
  local_gen.registerAll();
  packages_gen.registerAll();
  // Install the JS↔Dart bridge for <HtmlEmbed> BEFORE the JS bundle
  // loads — apps that call registerHtmlView at module top-level need
  // __skalRegisterHtmlView to already be on globalThis.
  _installHtmlEmbedHooks();
  _mark('main:after-register-adapters');

  // ── 1. Create the (web) Skal runtime ────────────────────────────────
  //
  // Allocates the 6 MiB bridge buffer in JS heap + installs
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

  // ── 2. Wrap in the bridge BEFORE injecting the bundle ───────────────
  //
  // The bridge only views the (still-empty) buffer, so it can exist
  // before the JS app mounts — and it must, so we can install the
  // synchronous op-drain hook the initial mount may need. On web JS and
  // Dart share the main thread, so if the bundle's first render writes
  // more than the 4 MiB op ring in one synchronous turn, the JS producer
  // can't spin-wait for a consumer that never gets a turn. The hook lets
  // it pump us inline instead (see [_installOpDrainHook]).
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
  bridge.ensureRoot();
  // Install the app-level RPC dispatcher BEFORE injecting the bundle:
  // a large initial mount can overflow the op ring and drain inline (via
  // the hook below) mid-inject, and that drain may process a mount-time
  // root-node RPC (e.g. getDataDir / showDialog at module top-level). If
  // the dispatcher weren't set yet, such a call would get a spurious
  // "host not mounted" error. It only sets bridge.rootDispatcher +
  // re-attaches it to the root node, so it's safe this early.
  installAppDispatcher(bridge);
  _installOpDrainHook(bridge);
  _mark('main:after-bridge-ctor');

  // ── 3. Inject the JS bundle ─────────────────────────────────────────
  //
  // Awaited before runApp so the bridge buffer is populated with the
  // initial CREATE_NODE batch before Flutter's first frame. Tried
  // parallelizing this with runApp once — Flutter Web's CanvasKit
  // skips painting when the first frame's widget tree is empty, and
  // the flt-scene-host stays at width:auto/height:auto forever
  // (lastDrainedSeq stuck at 0, blank page). The ~50-100 ms gain
  // wasn't worth re-debugging that.
  await _injectSkalJsBundle();
  _mark('main:after-inject-bundle');

  // ── 4. Initial drain ────────────────────────────────────────────────
  // Drains whatever the mount left in the ring (the inline hook above may
  // already have consumed earlier chunks of a large mount).
  try {
    bridge.pumpOps();
  } catch (e, st) {
    _recordError('pumpOps', e, st);
    runApp(_ErrorApp(message: 'pumpOps threw: $e'));
    return;
  }
  _mark('main:after-pump-ops');
  installAppDispatcher(bridge);
  _mark('main:after-app-dispatcher');

  // ── 5. Mount the Flutter tree ───────────────────────────────────────
  runApp(SkalWebApp(bridge: bridge));
  _mark('main:after-runApp');
}

/// Install the synchronous op-ring drain hook the JS bridge calls from
/// `flushAndWaitForDrain` when a render would overflow the op ring. On web
/// the JS producer and the Dart consumer share the browser main thread, so
/// JS can't spin-wait for us to drain — it would just burn its budget and
/// then overwrite undrained ops. This hook lets JS pump us inline instead
/// (the op-ring counterpart to `wakeJs` → `__skal_drainEvents`), so a
/// large mount drains in chunks with no freeze and no data loss.
/// [SkalBridge.pumpOps] guards against re-entry. Native installs no such
/// hook — its consumer runs on a separate thread, so the spin works there.
void _installOpDrainHook(SkalBridge bridge) {
  globalContext['__skal_drainOpsSync'] = (() {
    bridge.pumpOps();
  }).toJS;
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
