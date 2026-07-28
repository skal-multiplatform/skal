import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { createRequire } from 'module';
import { skalCodegen } from './vite-plugin-skal-codegen.js';

const require = createRequire(import.meta.url);
const skalJsxPlugin = require('./babel-plugin-skal-jsx.cjs');

const codegen = skalCodegen({
  manifests: [
    './flutter-host/lib/adapters/generated/skal_adapters.json',
    './flutter-host/lib/skal_codegen.json',
  ],
});

export default defineConfig({
  plugins: [
    codegen.vitePlugin,
    solid({
      solid: {
        generate: 'universal',
        moduleName: 'skal/renderer-web',
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
  resolve: {
    // ARRAY form, and the first entry is an anchored RegExp on purpose.
    // Vite's object form matches by PREFIX, and 'skal/renderer' is a
    // prefix of 'skal/renderer-web' — so an object entry would rewrite
    // the web renderer's own specifier into 'skal/renderer-web-web' and
    // break the build. /^skal\/renderer$/ matches the bare specifier
    // only.
    alias: [
      // The app-facing imperative API — setDesign / showDialog /
      // showSnackbar / the pickers — is re-exported by BOTH renderers.
      // App code imports it from 'skal/renderer' (one import site for
      // every target), so on the DOM build that specifier has to land on
      // the DOM implementations. Without this it resolved to the native
      // renderer, whose versions write ops into a bridge that does not
      // exist here: every call was dropped with a console error and the
      // working implementations in renderer-web.js were never reached.
      //
      // Safe on THIS config only. vite.config.js (moduleName
      // 'skal/renderer') builds the native bundle, which is also what
      // Flutter Web loads as skal-app.js — that target has a real bridge
      // and must keep the native versions.
      { find: /^skal\/renderer$/, replacement: 'skal/renderer-web' },
      { find: '~renderer', replacement: 'skal/renderer-web' },
    ],
  },
  server: { port: 5173, open: false },
  build: {
    outDir: 'dist',
    target: 'es2022',
    minify: 'esbuild',
    emptyOutDir: true,
  },
});
