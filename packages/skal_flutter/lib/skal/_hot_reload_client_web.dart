// Web JS hot-reload client — no-op. The web target reloads through Vite's dev
// server / a browser refresh, not in-VM re-eval, so there's nothing to wire up
// here. This stub keeps the shared SkalRoot compiling for web (dart:io's
// WebSocket isn't available there).

import 'bridge.dart';

// ignore: avoid_unused_constructor_parameters
void startHotReloadClient(SkalBridge bridge) {}
