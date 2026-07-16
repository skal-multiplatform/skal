// prerender-web.js — Shape E v1: prerender a Skal web build to static HTML.
//
//   bun scripts/prerender-web.js <app>/dist [route ...]
//
// Runs the app's built web bundle under bun against a happy-dom window
// (renderer-web's whole browser-API surface is emulated — no real
// browser involved), waits for the first render to settle, and writes
// the resulting markup back into dist/index.html. Crawlers and first
// paint get real content; on load, an injected inline script clears the
// root just before the bundle re-renders (prerender + remount — see
// docs/WEB_SUPPORT_PLAN.md §Shape E; adopt-mode hydration is v2).
//
// Routes: v1 prerenders "/" only unless routes are passed; each extra
// route becomes dist/<route>/index.html rendered with that location.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const dist = resolve(process.argv[2] ?? 'dist');
const routes = process.argv.slice(3);
if (routes.length === 0) routes.push('/');

const shell = readFileSync(join(dist, 'index.html'), 'utf8');

// The vite build hashes the entry — find it in the shell.
const entryMatch = shell.match(/<script[^>]+type="module"[^>]+src="\.?\/?(assets\/[^"]+\.js)"/);
if (!entryMatch) {
  console.error('prerender: no module entry found in dist/index.html');
  process.exit(1);
}
const entry = join(dist, entryMatch[1]);

async function renderRoute(route) {
  const win = new Window({ url: `http://localhost${route}` });
  const doc = win.document;
  doc.body.innerHTML = '<div id="app"></div>';

  // Expose the window's API surface as globals for the bundle. Skal's
  // renderer-web touches a deliberately small set; anything missing in
  // happy-dom gets a shim below.
  const g = globalThis;
  const saved = {};
  const expose = {
    window: win, document: doc, location: win.location,
    navigator: win.navigator, history: win.history,
    requestAnimationFrame: win.requestAnimationFrame?.bind(win) ?? ((cb) => setTimeout(() => cb(Date.now()), 0)),
    cancelAnimationFrame: win.cancelAnimationFrame?.bind(win) ?? clearTimeout,
    ResizeObserver: win.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} },
    IntersectionObserver: win.IntersectionObserver ?? class { observe() {} unobserve() {} disconnect() {} },
    getComputedStyle: win.getComputedStyle?.bind(win),
    matchMedia: win.matchMedia?.bind(win) ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
    MutationObserver: win.MutationObserver ?? class { observe() {} disconnect() {} },
    __skalPrerender: true,
  };
  for (const [k, v] of Object.entries(expose)) { saved[k] = g[k]; g[k] = v; }

  try {
    // The web entry renders on import (src/web-main.jsx). Bust bun's
    // module cache per route with a query param.
    await import(`${entry}?route=${encodeURIComponent(route)}`);
    // Settle: microtasks + two frames covers Solid's initial effects.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => g.requestAnimationFrame(() => g.requestAnimationFrame(r)));

    const app = doc.getElementById('app');
    if (!app || app.children.length === 0) {
      throw new Error(`route ${route}: nothing rendered into #app`);
    }
    const headExtra = doc.head.innerHTML.trim();
    return { appHtml: app.innerHTML, headExtra };
  } finally {
    for (const [k, v] of Object.entries(saved)) { g[k] = v; }
    await win.happyDOM?.abort?.();
  }
}

for (const route of routes) {
  const { appHtml, headExtra } = await renderRoute(route);

  let html = shell.replace(
    /<div id="app">\s*<\/div>/,
    `<div id="app" data-skal-prerender>${appHtml}</div>`,
  );
  if (headExtra) {
    // The route's <Head> owns the title — drop the shell's static one.
    if (/<title>/.test(headExtra)) html = html.replace(/<title>[^<]*<\/title>\s*/, '');
    html = html.replace('</head>', `${headExtra}\n</head>`);
  }
  // Clear the prerendered tree right before the (deferred) module
  // bundle re-renders — crawlers and no-JS keep the content; browsers
  // swap it for the live app. Adopt-mode hydration replaces this in v2.
  html = html.replace(
    '</body>',
    `<script>document.getElementById('app').innerHTML=''</script>\n</body>`,
  );

  // "/" and "/docs/" → <dir>/index.html; "/docs/state.html" → that file.
  const rel = route.replace(/^\//, '');
  const out = route.endsWith('.html')
    ? join(dist, rel)
    : join(dist, rel, 'index.html');
  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(out, html);
  console.log(`✓ prerendered ${route} → ${out} (${appHtml.length} bytes of markup)`);
}
