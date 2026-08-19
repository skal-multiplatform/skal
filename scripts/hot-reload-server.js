#!/usr/bin/env bun
// hot-reload-server.js — push JS hot reloads to a running native Skal app.
//
// What it does:
//   1. Spawns `vite build --watch` for the target app so its
//      flutter-host/assets/skal-app.js is rebuilt on every source edit.
//   2. Watches that bundle file and, on each change, broadcasts the fresh
//      source over a WebSocket to every connected app.
//
// The app's debug-only Dart client (packages/skal_flutter — hot_reload_client)
// connects here, and on each message re-evaluates the bundle in the live VM:
// it prepends `globalThis.__skalHot.beginReload();` so the outgoing generation
// is torn down (dispose + host tree reset, see hot.js) before the new bundle
// re-mounts in place. Store-backed state survives; in-component signal state
// resets (remount semantics).
//
// Usage:
//   bun scripts/hot-reload-server.js [app-name]   # default: kitchen-sink
//   SKAL_HOT_PORT=8765 bun scripts/hot-reload-server.js my-app
//
// The app's `dev:<platform>` script (scripts/dev-hot.sh) starts this server
// and then launches the app itself with `--dart-define=SKAL_HOT=1`, so the
// app's debug client knows to connect back here. Native + debug only.

import { watch, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const APP = process.argv[2] || 'kitchen-sink';
const PORT = parseInt(process.env.SKAL_HOT_PORT || '8765', 10);

// A path argument (e.g. `.` from a standalone `skal create` app) is the
// app dir itself; a bare name means examples/<name> in the repo.
const APP_DIR = existsSync(join(resolve(APP), 'package.json'))
  ? resolve(APP)
  : join(REPO_ROOT, 'examples', APP);
const BUNDLE = join(APP_DIR, 'flutter-host', 'assets', 'skal-app.js');

if (!existsSync(APP_DIR)) {
  console.error(`[skal-hot] app not found: ${APP_DIR}`);
  process.exit(1);
}

// ── 1. Keep the bundle fresh: spawn `vite build --watch` (the app `dev` script).
const vite = Bun.spawn({
  cmd: ['bun', 'run', 'dev'],
  cwd: APP_DIR,
  stdout: 'inherit',
  stderr: 'inherit',
});

// ── 2. WebSocket server — one text frame per reload, body = bundle source.
const clients = new Set();

// Bind, and say something USEFUL if the port is taken.
//
// This used to be a bare Bun.serve({ port: PORT }): an EADDRINUSE threw,
// the server died, and nothing else noticed. `flutter run` carried on,
// vite kept printing "built in 57ms", the app launched fine — and every
// save silently failed to reach the device, with the only evidence a
// stack trace scrolled off the top of the log. An unrelated process
// holding 8765 (a stray python -m http.server, say) made hot reload look
// broken with no way to tell why.
function serveOrDie(port) {
  const opts = {
    port,
    fetch(req, srv) {
      if (srv.upgrade(req)) return; // upgraded to WebSocket
      return new Response('skal hot-reload server\n', { status: 200 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        console.log(`[skal-hot] app connected (${clients.size} total)`);
      },
      close(ws) {
        clients.delete(ws);
        console.log(`[skal-hot] app disconnected (${clients.size} total)`);
      },
      message() { /* clients don't send anything */ },
    },
  };
  try {
    return Bun.serve(opts);
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') return null;
    throw e;
  }
}

const server = serveOrDie(PORT);
if (!server) {
  // The client dials a COMPILE-TIME port (int.fromEnvironment in
  // _hot_reload_client_io.dart), so moving to a free port silently would
  // leave the app dialling the old one. Fail loudly instead.
  console.error(
    `[skal-hot] port ${PORT} is already in use — hot reload cannot start.\n` +
    `[skal-hot]   who has it:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n` +
    `[skal-hot]   or pick another: SKAL_HOT_PORT=8799 bun run dev:<target>`);
  process.exit(1);
}

console.log(`[skal-hot] watching ${APP}  ·  ws://localhost:${PORT}`);
console.log('[skal-hot] waiting for the app to connect — edit a src/*.jsx to push a live reload');

// ── 3. Watch the bundle; debounce (vite writes can fire several events).
let timer = null;
function broadcast() {
  if (clients.size === 0) return; // nobody to push to — skip the read
  let source;
  try {
    source = readFileSync(BUNDLE, 'utf8');
  } catch (e) {
    console.error(`[skal-hot] could not read bundle: ${e.message}`);
    return;
  }
  for (const ws of clients) {
    try { ws.send(source); } catch (_) { /* dropped client */ }
  }
  console.log(`[skal-hot] pushed reload (${(source.length / 1024) | 0} KiB) to ${clients.size} app(s)`);
}

function scheduleBroadcast() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(broadcast, 120);
}

// Watch the assets dir (not the file: a rename/replace would drop an
// inode watch) and broadcast on ANY event in it.
//
// Do NOT filter by filename. macOS coalesces directory events, so a build
// that writes several files in the same tick can surface as a SINGLE
// event carrying a sibling's name — vite rewrites `favicon.png` on every
// build, and an observed sequence went:
//
//     built in 75ms                        <- skal-app.js written
//     event change file="favicon.png"      <- the only event delivered
//
// A `filename === 'skal-app.js'` test discards that, and the save never
// reaches the device. The bug is invisible: vite keeps printing
// "built in Nms", the socket stays connected, and nothing happens.
//
// Over-broadcasting is free by design — broadcast() re-reads the bundle
// and the client ignores a byte-identical source (SkalBridge.hotReload
// dedupes) — so the filter only ever bought a skipped file read, at the
// cost of the whole feature.
const assetsDir = dirname(BUNDLE);
watch(assetsDir, () => scheduleBroadcast());

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try { server.stop(true); } catch (_) { /* ignore */ }
  try { vite.kill(); } catch (_) { /* ignore */ }
  // Wait for the watcher to actually exit, then go; escalate to SIGKILL if it
  // lingers so we never leave an orphaned vite process behind.
  const t = setTimeout(() => {
    try { vite.kill('SIGKILL'); } catch (_) { /* ignore */ }
    process.exit(0);
  }, 500);
  vite.exited.then(() => { clearTimeout(t); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
