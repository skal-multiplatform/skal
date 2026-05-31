// JS hot-reload dev client — connects to scripts/hot-reload-server.js and
// re-evaluates each pushed bundle in the live VM. Native uses a dart:io
// WebSocket; web is a no-op (it reloads via Vite / the browser). The
// conditional export keeps the shared SkalRoot compiling on both targets.
export '_hot_reload_client_io.dart'
    if (dart.library.js_interop) '_hot_reload_client_web.dart';
