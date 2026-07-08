// Native JS hot-reload client (dart:io WebSocket). Enabled only by
// `flutter run --dart-define=SKAL_HOT=1` (the dev:hot scripts set it), so a
// plain `flutter run` never opens a socket. Connects to the dev server
// (scripts/hot-reload-server.js) and re-evaluates each pushed bundle in the
// live VM — the same teardown + remount path as the manual `r` trigger
// (SkalRoot.reassemble): prepend `globalThis.__skalHot.beginReload();` so the
// outgoing generation is disposed and the host tree reset (see hot.js) before
// the new bundle re-mounts.

import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart' show kDebugMode, debugPrint;

import 'bridge.dart';

// Any non-empty value enables it (`--dart-define=SKAL_HOT=1`). Not
// `bool.fromEnvironment`, which only accepts the literal "true".
const String _hotFlag = String.fromEnvironment('SKAL_HOT');
const int _port = int.fromEnvironment('SKAL_HOT_PORT', defaultValue: 8765);
// 'localhost' for macOS / iOS simulator; pass SKAL_HOT_HOST=10.0.2.2 for the
// Android emulator (its host-loopback alias).
const String _host =
    String.fromEnvironment('SKAL_HOT_HOST', defaultValue: 'localhost');

void startHotReloadClient(SkalBridge bridge) {
  if (_hotFlag.isEmpty || !kDebugMode) return;
  _HotReloadClient(bridge)._connect();
}

class _HotReloadClient {
  _HotReloadClient(this.bridge);

  final SkalBridge bridge;

  Future<void> _connect() async {
    try {
      final ws = await WebSocket.connect('ws://$_host:$_port');
      debugPrint('[skal] JS hot reload: connected to ws://$_host:$_port');
      ws.listen(
        (data) {
          if (data is String) _apply(data);
        },
        onDone: _reconnectSoon,
        onError: (_) => _reconnectSoon(),
        cancelOnError: true,
      );
    } catch (_) {
      // Server not up yet (or went away) — retry quietly.
      _reconnectSoon();
    }
  }

  void _reconnectSoon() {
    Future.delayed(const Duration(seconds: 2), _connect);
  }

  void _apply(String source) {
    bridge.hotReload(source);
  }
}
