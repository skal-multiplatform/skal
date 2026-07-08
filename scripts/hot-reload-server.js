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
// Pair it with `flutter run -d macos --dart-define=SKAL_HOT=1` (the app's
// `dev:hot:*` script wires both up). Native + debug only.

import { watch, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const APP = process.argv[2] || 'kitchen-sink';
const PORT = parseInt(process.env.SKAL_HOT_PORT || '8765', 10);

const APP_DIR = join(REPO_ROOT, 'examples', APP);
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
const server = Bun.serve({
  port: PORT,
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
});

console.log(`[skal-hot] watching ${APP}  ·  ws://localhost:${PORT}`);
console.log('[skal-hot] run the app with:  flutter run -d macos --dart-define=SKAL_HOT=1');

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

// Watch the assets dir and filter, so a vite rename/replace of the file
// doesn't drop the watch (watching the file inode directly would).
const assetsDir = dirname(BUNDLE);
watch(assetsDir, (_event, filename) => {
  // `filename` can be null on some platforms/events; fall back to scheduling
  // a broadcast rather than silently missing the change. An over-broadcast is
  // harmless — broadcast() re-reads the bundle and the app's client ignores a
  // byte-identical source (SkalBridge.hotReload dedupes).
  if (filename == null || filename === 'skal-app.js') scheduleBroadcast();
});

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
