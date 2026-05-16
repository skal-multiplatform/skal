// Vite config for the WEB target.
//
// Sibling of vite.config.js (which builds the native bundle for libskal).
// Two big differences:
//
//   1. `~renderer` alias points at renderer-web.js (DOM-targeting
//      universal renderer) instead of renderer.js (bridge-targeting).
//   2. Build emits a normal multi-file ES module bundle, not the
//      IIFE that JSC's top-level eval expects.
//
// `App.jsx`, `index.jsx` (well, here `web-main.jsx`), and the Tweet
// component are unchanged across both targets — same JSX, different
// sink decided by which renderer the `~renderer` alias resolves to.

import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';
import { createRequire } from 'module';
import { skalCodegen } from './vite-plugin-skal-codegen.js';

const require = createRequire(import.meta.url);
const skalJsxPlugin = require('./babel-plugin-skal-jsx.cjs');

// Codegen-wrapped widgets — same setup as vite.config.js. The web
// target needs this too: App.jsx imports `skal-flutter` (Greeting,
// QrImageView, …), so the virtual module must resolve here as well.
// On web these custom widgets render through renderer-web.js's
// custom-node path (degraded — the underlying Flutter widgets aren't
// available in a browser), but the build + macro tag-lowering work.
const codegen = skalCodegen({
  manifests: [
    '../flutter/skal_flutter/lib/adapters/generated/skal_adapters.json',
    '../flutter/skal_flutter/lib/skal_codegen.json',
  ],
});

export default defineConfig({
  resolve: {
    alias: {
      '~renderer': resolve(__dirname, 'src/renderer-web.js'),
      'skal': resolve(__dirname, 'src/skal/index.js'),
    },
  },
  plugins: [
    codegen.vitePlugin,
    solid({
      solid: {
        generate: 'universal',
        moduleName: '~renderer',
      },
      babel: {
        plugins: [
          [skalJsxPlugin, {
            moduleName: 'skal',
            modules: { ...codegen.macroModules },
          }],
        ],
      },
    }),
  ],
  // index.html is at the project root; vite picks it up automatically.
  // Dev server: `bun run dev:web` → opens http://localhost:5173/
  // Build: `bun run build:web` → emits to dist/.
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    minify: 'esbuild',
    emptyOutDir: true,
    // Produce a static site that can be served from any CDN. No SSR,
    // no Wasm — just JS + HTML + (eventually) bundled fonts.
  },
});
