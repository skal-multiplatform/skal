// Skal — hidden Flutter Web plugin host + visible <FlutterEmbed>
// rendering (Phase 1 + Shape C of WEB_SUPPORT_PLAN.md).
//
// This Dart entry point serves two surfaces over a single Flutter Web
// engine:
//
//   1. PLUGIN CALLS (Phase 1) — JS calls
//      `globalThis.__skalPluginCall(name, jsonArgs)` to invoke a
//      federated pub.dev plugin (geolocator, etc.). Returns a
//      Promise<JSON-string> with the result. No view needed — it's
//      JSON-RPC over dart:js_interop.
//
//   2. <FlutterEmbed> RENDERING (Shape C) — JS calls
//      `__skalFlutterApp.addView({hostElement})` to mount a Flutter
//      view inside a DOM region, then calls `embed.setSpec(viewId,
//      widgetName, props)` to tell us which widget to render there.
//      Each view runs the requested widget independently.
//
// Multi-view is on (initializeEngine config has multiViewEnabled:true,
// set in vite.config.web.js's patchBootstrap), which means we MUST use
// `runWidget` + `ViewCollection` instead of `runApp` — there's no
// implicit "default" view. The JS side adds + removes views as
// <FlutterEmbed> nodes mount + unmount.
//
// Adding a new embeddable widget: extend `_widgetFor` with another
// case. The widget can be anything pulled from a pub.dev package —
// the kitchen-sink demo uses `counter` (hand-written) and `greeting`
// (also hand-written). Future work: auto-pull from skal_codegen so
// every <skal-flutter> widget renders here automatically without code
// changes.

import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:geolocator/geolocator.dart';

// ── <FlutterEmbed> view registry ────────────────────────────────────
//
// JS owns view lifecycle (addView → viewId, removeView). When a view
// is added, JS calls `embed.setSpec(viewId, name, props)` to declare
// what Dart should render in it. The notifier rebuilds `_Root` on any
// spec change so views pick up new content immediately.

class _EmbedSpec {
  final String widgetName;
  final Map<String, dynamic> props;
  const _EmbedSpec(this.widgetName, this.props);
}

final ValueNotifier<Map<int, _EmbedSpec>> _embedSpecs =
    ValueNotifier<Map<int, _EmbedSpec>>(const <int, _EmbedSpec>{});

void main() {
  try {
    _bootHost();
  } catch (e, st) {
    globalContext['__skalPluginHostError'] = '$e\n$st'.toJS;
    rethrow;
  }
}

void _bootHost() {
  _step('boot:before-runWidget');
  // Multi-view mode — no implicit view; the JS-side <FlutterEmbed>
  // intrinsic adds views as needed. `runWidget` (not `runApp`) is the
  // multi-view entry point; it waits for views to exist before
  // rendering instead of demanding a default at boot time.
  runWidget(const _Root());
  _step('boot:after-runWidget');

  // Expose the dispatcher on globalThis. Same as the single-view
  // Phase 1 surface — JS calls __skalPluginCall(name, jsonArgs).
  globalContext['__skalPluginCall'] = ((JSString name, JSString jsonArgs) {
    return _dispatch(name.toDart, jsonArgs.toDart).toJS;
  }).toJS;
  _step('boot:after-set-pluginCall');

  globalContext['__skalPluginHostReady'] = true.toJS;
  _step('boot:after-set-ready-flag');

  _dispatchReadyEvent();
  _step('boot:after-dispatch-event');
}

void _step(String label) {
  globalContext['__skalPluginHostStep'] = label.toJS;
}

void _dispatchReadyEvent() {
  final win = globalContext['window'] as JSObject?;
  if (win == null) return;
  final eventCtor = globalContext['Event'] as JSFunction?;
  if (eventCtor == null) return;
  final ev = eventCtor.callAsConstructor<JSObject>(
    'skal-plugin-host-ready'.toJS,
  );
  win.callMethod<JSAny?>('dispatchEvent'.toJS, ev);
}

// ── Multi-view root ────────────────────────────────────────────────
//
// `_Root` listens to two signals:
//   - PlatformDispatcher metric changes (a view was added or removed)
//   - `_embedSpecs` (JS changed the widget for an existing view)
// On either, it rebuilds the ViewCollection: one View per platform
// view, each wrapping a MaterialApp at the spec's widget. Views
// without a spec show nothing (covers the brief gap between addView
// completing and the JS-side embed.setSpec call landing).

class _Root extends StatefulWidget {
  const _Root();
  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _embedSpecs.addListener(_onSpecsChanged);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _embedSpecs.removeListener(_onSpecsChanged);
    super.dispose();
  }

  void _onSpecsChanged() {
    if (mounted) setState(() {});
  }

  // Fires when platform views are added or removed — rebuild to pick
  // up the new view list.
  @override
  void didChangeMetrics() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final views = WidgetsBinding.instance.platformDispatcher.views;
    final specs = _embedSpecs.value;
    return ViewCollection(
      views: views.map((flutterView) {
        final spec = specs[flutterView.viewId];
        return View(
          view: flutterView,
          child: _ViewContent(spec: spec),
        );
      }).toList(growable: false),
    );
  }
}

class _ViewContent extends StatelessWidget {
  final _EmbedSpec? spec;
  const _ViewContent({required this.spec});

  @override
  Widget build(BuildContext context) {
    if (spec == null) {
      // A view exists but JS hasn't yet declared what should render in
      // it (e.g. between addView and embed.setSpec). Render nothing.
      return const SizedBox.shrink();
    }
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      // No Scaffold — the embed is a single widget inside a DOM-sized
      // region. App-level chrome (AppBar, navigation) belongs to the
      // surrounding DOM, not to Flutter.
      home: Material(
        type: MaterialType.transparency,
        child: _widgetFor(spec!),
      ),
    );
  }
}

// ── Widget registry ────────────────────────────────────────────────
//
// Maps a widget name (sent from JS in embed.setSpec) to the Dart
// widget that renders it. Adding a new embeddable widget is one
// `case` here + (if it pulls a pub.dev package) one line in pubspec.
//
// Long term: skal_codegen should generate this registry from
// `examples/<app>/flutter-host/lib/skal_codegen.json` so every
// codegen-wrapped widget the app declares is automatically available
// on web. Today the registry is hand-maintained.

Widget _widgetFor(_EmbedSpec spec) {
  switch (spec.widgetName) {
    case 'counter':
      return _CounterDemo(initial: (spec.props['initial'] as num?)?.toInt() ?? 0);
    case 'greeting':
      return _GreetingDemo(name: spec.props['name'] as String? ?? 'World');
    default:
      return Center(
        child: Text(
          'Skal: unknown <FlutterEmbed widget="${spec.widgetName}">.\n'
          'Register it in flutter-web-plugins/lib/main.dart `_widgetFor`.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.red),
        ),
      );
  }
}

class _CounterDemo extends StatefulWidget {
  final int initial;
  const _CounterDemo({required this.initial});
  @override
  State<_CounterDemo> createState() => _CounterDemoState();
}

class _CounterDemoState extends State<_CounterDemo> {
  late int _n = widget.initial;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            'Flutter counter: $_n',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: () => setState(() => _n++),
            child: const Text('+1 (Dart)'),
          ),
        ],
      ),
    );
  }
}

class _GreetingDemo extends StatelessWidget {
  final String name;
  const _GreetingDemo({required this.name});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        'Hello, $name! (from Flutter)',
        style: const TextStyle(fontSize: 16),
      ),
    );
  }
}

// ── Plugin dispatcher (Phase 1) ────────────────────────────────────
//
// Same surface as the single-view Phase 1 version — JS calls
// __skalPluginCall(name, jsonArgs), gets back a Promise<JSON-string>
// with the {ok, value | error, stack} envelope.

Future<JSString> _dispatch(String name, String jsonArgs) async {
  try {
    final Map<String, dynamic> args = jsonArgs.isEmpty
        ? const <String, dynamic>{}
        : (jsonDecode(jsonArgs) as Map<String, dynamic>);
    final value = await _route(name, args);
    return jsonEncode(<String, dynamic>{'ok': true, 'value': value}).toJS;
  } catch (e, st) {
    return jsonEncode(<String, dynamic>{
      'ok': false,
      'error': e.toString(),
      'stack': st.toString(),
    }).toJS;
  }
}

Future<Object?> _route(String name, Map<String, dynamic> args) async {
  switch (name) {
    case 'ping':
      return <String, dynamic>{
        'pong': true,
        'echoed': args,
        'host': 'skal_plugin_host',
        'ts': DateTime.now().millisecondsSinceEpoch,
      };

    // ── <FlutterEmbed> spec management ────────────────────────────
    case 'embed.setSpec':
      final viewId = (args['viewId'] as num).toInt();
      final widgetName = args['widget'] as String;
      final props = (args['props'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{};
      final next = Map<int, _EmbedSpec>.from(_embedSpecs.value);
      next[viewId] = _EmbedSpec(widgetName, props);
      _embedSpecs.value = next;
      return <String, dynamic>{'viewId': viewId, 'widget': widgetName};
    case 'embed.unsetSpec':
      final viewId = (args['viewId'] as num).toInt();
      final next = Map<int, _EmbedSpec>.from(_embedSpecs.value);
      next.remove(viewId);
      _embedSpecs.value = next;
      return <String, dynamic>{'viewId': viewId, 'removed': true};

    // ── geolocator.getCurrentPosition ─────────────────────────────
    case 'geolocator.getCurrentPosition':
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw StateError('Location permission denied (got $permission)');
      }
      final pos = await Geolocator.getCurrentPosition();
      return <String, dynamic>{
        'lat': pos.latitude,
        'lon': pos.longitude,
        'accuracy': pos.accuracy,
        'altitude': pos.altitude,
        'speed': pos.speed,
        'timestamp': pos.timestamp.millisecondsSinceEpoch,
      };

    default:
      throw StateError('Skal plugin host: unknown plugin call "$name"');
  }
}
