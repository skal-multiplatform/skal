#!/usr/bin/env bun
// Static server for the dart2wasm+skwasm build, with the COOP/COEP
// headers needed to put the page in a cross-origin-isolated context.
//
// Why this exists: production-style threaded skwasm only fires when
// `crossOriginIsolated === true`, which itself only fires when the
// top-level document is served with:
//
//   Cross-Origin-Opener-Policy:   same-origin
//   Cross-Origin-Embedder-Policy: require-corp
//
// `bunx serve` (our default kitchen-sink-web-flutter preview) doesn't
// set them, so threaded raster is off. This script sends them on
// every response so `flutter build web --wasm` output can be tested
// in its threaded configuration without booting `flutter run`.
//
// Listens on port 5176 by default; override with PORT=xxxx.

import { resolve, extname, join, sep } from 'node:path';
import { existsSync, statSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '..', 'flutter-host', 'build', 'web');
const PORT = Number(process.env.PORT ?? 5176);

if (!existsSync(ROOT)) {
  console.error(
    `[serve-isolated] build dir missing: ${ROOT}\n` +
    `Run \`bun run build:web-flutter\` first.`,
  );
  process.exit(1);
}

// Minimal content-type table — covers what `flutter build web --wasm`
// emits. .wasm is the one most other static servers get wrong.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8',
};

// COOP + COEP put the document in a cross-origin-isolated context.
// CORP on subresources is what `require-corp` actually validates —
// adding it `same-origin` here is fine since everything served from
// build/web is same-origin to itself.
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy':   'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    if (path.endsWith('/'))           path += 'index.html';

    // Prevent path-traversal: resolve, then verify still under ROOT.
    // Require a separator boundary so a sibling dir sharing ROOT's
    // prefix (e.g. `build/web-secret` vs ROOT `build/web`) can't slip
    // through a bare `startsWith` prefix match.
    const filePath = resolve(join(ROOT, path));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const ext  = extname(filePath).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';
    const headers = {
      'Content-Type': mime,
      // Always send the isolation headers — they're cheap and the
      // browser only honors them on the top-level document anyway.
      ...ISOLATION_HEADERS,
    };

    return new Response(Bun.file(filePath), { headers });
  },
});

console.log(
  `[serve-isolated] http://127.0.0.1:${PORT}/  (COOP=same-origin, COEP=require-corp)`,
);
