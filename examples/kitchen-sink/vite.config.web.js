// Vite config for the WEB target.
//
// Sibling of vite.config.js (which builds the native bundle for libskal).
// Two big differences:
//
//   1. Solid's `moduleName` points at `skal/renderer-web` (DOM-targeting
//      universal renderer) instead of `skal/renderer` (bridge-targeting).
//   2. Build emits a normal multi-file ES module bundle, not the
//      IIFE that JSC's top-level eval expects.
//
// `App.jsx`, `index.jsx`, and the rest of the JSX are unchanged across
// both targets — same JSX, different sink decided by which renderer
// `moduleName` resolves to.

import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { skalCodegen } from './vite-plugin-skal-codegen.js';

const require = createRequire(import.meta.url);
const skalJsxPlugin = require('./babel-plugin-skal-jsx.cjs');

// ── B.5 plugin host wiring (see docs/WEB_SUPPORT_PLAN.md Phase 3) ───
// The hidden Flutter Web plugin host lives at `flutter-web-plugins/`
// and is built with `flutter build web --release` (aliased as `bun run
// build:flutter-plugins`). This plugin makes the resulting bundle
// reachable from the kitchen-sink web target in two modes:
//
//   - DEV: a server.middlewares hook serves files from
//     `flutter-web-plugins/build/web/` at `/flutter-web-plugins/*`,
//     so JS-side `plugin-bridge-web.js` can lazy-load
//     `/flutter-web-plugins/flutter_bootstrap.js` in dev too.
//   - BUILD: closeBundle copies the bundle into
//     `dist/flutter-web-plugins/` next to the JS app, so the deployed
//     static site is self-contained.
//
// The Flutter build is NOT triggered automatically — it's slow (~15s
// cold, ~5s warm) and rarely changes once a plugin is added. Run it
// once with `bun run build:flutter-plugins` (and again whenever you
// edit `flutter-web-plugins/lib/main.dart` or pubspec.yaml). The
// plugin warns at startup if the bundle is missing so the failure
// mode is loud rather than a 404 at first plugin call.
const PLUGIN_HOST_SRC = path.resolve(
  import.meta.dirname,
  'flutter-web-plugins/build/web',
);
const PLUGIN_HOST_URL = '/flutter-web-plugins';
const PLUGIN_HOST_DIST = 'dist/flutter-web-plugins';

function skalFlutterPluginHost() {
  function pluginHostBundleExists() {
    return fs.existsSync(path.join(PLUGIN_HOST_SRC, 'flutter_bootstrap.js'));
  }
  function warnMissing(target) {
    console.warn(
      `[skal-flutter-plugin-host] No bundle at ${PLUGIN_HOST_SRC}. ` +
        `Run \`bun run build:flutter-plugins\` first if you want ${target} ` +
        `to include the hidden Flutter Web plugin host.`,
    );
  }
  // Flutter Web's flutter_bootstrap.js ends with:
  //   _flutter.loader.load({ serviceWorkerSettings: {...} });
  // …which resolves `main.dart.js` and canvaskit/* relative to
  // `document.baseURI` (= the host page's origin). When the bundle is
  // mounted under /flutter-web-plugins/, Flutter ends up fetching
  // /main.dart.js and /canvaskit/canvaskit.wasm from the wrong path
  // and silently never finishes booting (no error — the load promise
  // just hangs).
  //
  // We inject `config: { entrypointBaseUrl, canvasKitBaseUrl }` into
  // the load() call so Flutter's URL resolver (see flutter.js's
  // `c(...)` helper) joins our base before hitting document.baseURI.
  // The replace target is the exact `_flutter.loader.load(...)` call
  // emitted by every Flutter 3.4+ build; it's stable across builds
  // because flutter_bootstrap.js is mechanically generated.
  function patchBootstrap(src, urlBase) {
    // Strategy: REPLACE the bootstrap's default `_flutter.loader.load(...)`
    // call with our own. That gives us:
    //   1. Control over `config.{entrypointBaseUrl, canvasKitBaseUrl, assetBase}`
    //      so the bundle's main.dart.js / canvaskit / assets all resolve
    //      under PLUGIN_HOST_URL rather than the host page's origin.
    //      (Without `assetBase`, engine init silently dies during
    //      AssetBundle parse — gets the host's SPA-fallback HTML.)
    //   2. A custom `onEntrypointLoaded` that passes `hostElement` (a
    //      DOM ref, so JSON-serializable config can't carry it) to
    //      `initializeEngine` — so Flutter Web mounts INSIDE our
    //      hidden 1×1 div rather than expanding to fill document.body.
    //   3. No `serviceWorkerSettings`. Flutter's bootstrap-time SW
    //      registration is deprecated, the plugin host doesn't need
    //      offline support, and the SW's fetch interception caused
    //      double-mounts on reload during development.
    const SKAL_MARKER = '/* SKAL_PATCHED_BOOTSTRAP */';
    if (src.includes(SKAL_MARKER)) return src;
    const cfg = JSON.stringify({
      entrypointBaseUrl: `${urlBase}/`,
      canvasKitBaseUrl: `${urlBase}/canvaskit/`,
      assetBase: `${urlBase}/`,
    });
    const replacement = `${SKAL_MARKER}
_flutter.loader.load({
  config: ${cfg},
  onEntrypointLoaded: function(initializer) {
    var mount = window.__skalPluginHostMount;
    var initConfig = Object.assign({}, ${cfg});
    if (mount) initConfig.hostElement = mount;
    return initializer.initializeEngine(initConfig).then(function(engine) {
      return engine.runApp();
    });
  },
});`;
    // Match the original load() call — handles a multi-line argument list
    // (which the current Flutter bootstrap uses).
    const patched = src.replace(
      /_flutter\.loader\.load\(\{[\s\S]*?\}\);?/m,
      replacement,
    );
    if (!patched.includes(SKAL_MARKER)) {
      console.warn(
        '[skal-flutter-plugin-host] Could not find _flutter.loader.load({...}) ' +
          'in flutter_bootstrap.js — Flutter Web bundle layout may have changed. ' +
          'Plugin host will likely fail to boot.',
      );
    }
    return patched;
  }
  return {
    name: 'skal-flutter-plugin-host',
    configureServer(server) {
      if (!pluginHostBundleExists()) {
        warnMissing('dev:web');
        return;
      }
      // Serve flutter-web-plugins/build/web/* at /flutter-web-plugins/*.
      // We use a streaming static-file middleware (no caching headers
      // — vite's HMR doesn't track these files, but they change rarely).
      server.middlewares.use(PLUGIN_HOST_URL, (req, res, next) => {
        // req.url has PLUGIN_HOST_URL stripped (middleware mount-point
        // convention), so req.url for /flutter-web-plugins/foo.js is
        // /foo.js relative to PLUGIN_HOST_SRC.
        const rel = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = path.join(PLUGIN_HOST_SRC, rel);
        // Guard against directory traversal — resolved path must stay
        // within PLUGIN_HOST_SRC.
        if (!filePath.startsWith(PLUGIN_HOST_SRC)) {
          res.statusCode = 403;
          return res.end('forbidden');
        }
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next();
          // Minimal content-type map covers the file kinds Flutter Web
          // emits. Vite's default mime handling kicks in for unknown
          // types via res.end.
          const ext = path.extname(filePath).toLowerCase();
          const types = {
            '.js': 'application/javascript; charset=utf-8',
            '.mjs': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.wasm': 'application/wasm',
            '.png': 'image/png',
            '.ico': 'image/x-icon',
            '.ttf': 'font/ttf',
            '.otf': 'font/otf',
            '.svg': 'image/svg+xml',
            '.map': 'application/json; charset=utf-8',
          };
          if (types[ext]) res.setHeader('Content-Type', types[ext]);
          // Patch flutter_bootstrap.js on the fly so it loads main.dart.js
          // + canvaskit from /flutter-web-plugins/ rather than the page
          // root. See patchBootstrap() comment above.
          if (rel === '/flutter_bootstrap.js') {
            const src = fs.readFileSync(filePath, 'utf8');
            const patched = patchBootstrap(src, PLUGIN_HOST_URL);
            res.setHeader('Content-Length', Buffer.byteLength(patched));
            return res.end(patched);
          }
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
    // closeBundle fires after `vite build` finishes — only in build
    // mode. configureServer above only fires in dev. So no `apply` is
    // needed (`apply: 'build'` would exclude dev and break the
    // middleware).
    closeBundle: () => {
      if (!pluginHostBundleExists()) {
        warnMissing('build:web');
        return;
      }
      fs.cpSync(PLUGIN_HOST_SRC, PLUGIN_HOST_DIST, { recursive: true });
      // Patch the copied flutter_bootstrap.js in dist/ the same way the
      // dev middleware does. Without this the production bundle hangs
      // at boot because main.dart.js is loaded from the wrong path.
      const distBootstrap = path.join(PLUGIN_HOST_DIST, 'flutter_bootstrap.js');
      const src = fs.readFileSync(distBootstrap, 'utf8');
      fs.writeFileSync(distBootstrap, patchBootstrap(src, PLUGIN_HOST_URL));
      console.log(
        `[skal-flutter-plugin-host] Copied plugin host bundle into ${PLUGIN_HOST_DIST}/ ` +
          `(patched flutter_bootstrap.js to use ${PLUGIN_HOST_URL}/ as the asset base)`,
      );
    },
  };
}

// Codegen-wrapped widgets — same setup as vite.config.js. The web
// target needs this too: App.jsx imports `skal-flutter` (Greeting,
// QrImageView, …), so the virtual module must resolve here as well.
// On web these custom widgets render through renderer-web.js's
// custom-node path (degraded — the underlying Flutter widgets aren't
// available in a browser), but the build + macro tag-lowering work.
const codegen = skalCodegen({
  manifests: [
    './flutter-host/lib/adapters/generated/skal_adapters.json',
    './flutter-host/lib/skal_codegen.json',
  ],
});

export default defineConfig({
  plugins: [
    codegen.vitePlugin,
    skalFlutterPluginHost(),
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
    // `~renderer` is the single bare specifier the web entry shell
    // (`src/web-main.jsx`) uses for its `render(...)` import — we keep
    // it as an alias here (rather than swapping the entry to import
    // from 'skal/renderer-web' directly) so the same web-main.jsx file
    // works as a copy-paste template for new web entries, regardless of
    // which Skal renderer the host config picks.
    alias: {
      '~renderer': 'skal/renderer-web',
    },
  },
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
