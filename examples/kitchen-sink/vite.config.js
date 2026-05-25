import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';
import { createRequire } from 'module';
import { skalCodegen } from './vite-plugin-skal-codegen.js';

const require = createRequire(import.meta.url);
const skalJsxPlugin = require('./babel-plugin-skal-jsx.cjs');

// Auto-discover widgets wrapped by skal_codegen on the Flutter side.
// Reads JSON manifests emitted by BOTH:
//   • the local CLI (lib/adapters/generated/skal_adapters.json — for
//     Widget classes in the consumer's own lib/, e.g. Greeting /
//     Stickers in this demo)
//   • build_runner (lib/skal_codegen.json — for third-party pub
//     packages listed in lib/skal_codegen.yaml: qr_flutter, shimmer)
// All widgets surface through one virtual module `skal-flutter`
// (the plugin's default; override via `moduleName:`), so JSX has a
// single import source regardless of where the underlying adapter was
// generated. See vite-plugin-skal-codegen.js for the merge semantics
// (last-wins on key collision, by array order).
const codegen = skalCodegen({
  manifests: [
    './flutter-host/lib/adapters/generated/skal_adapters.json',
    './flutter-host/lib/skal_codegen.json',
  ],
});

// Solid's universal-renderer mode: babel-preset-solid (wrapped by
// vite-plugin-solid) compiles JSX into direct calls to OUR custom
// renderer's createElement/insertNode/etc. — no DOM dependency.
//
// `moduleName: 'skal/renderer'` tells the babel plugin where those
// helpers come from. Bun's workspace resolution maps this to
// `packages/skal-js/src/renderer.js` via the `skal` package's
// `exports` map (see packages/skal-js/package.json). The web config
// (vite.config.web.js) swaps in `skal/renderer-web` to hit
// renderer-web.js instead — same JSX, different sink.
//
// `skal-jsx` babel plugin runs BEFORE solid's preset (babel plugin
// pass precedes preset pass). It rewrites capitalized JSX tags like
// <Column> back to their lowercase intrinsic form <column> at build
// time, so the runtime never pays the component-wrapper overhead.
// See babel-plugin-skal-jsx.js for the full rationale.

// The skal-jsx macro options are identical across both renderer
// targets — only Solid's `moduleName` (which renderer createElement /
// insertNode / etc. resolve to) differs per-file. Pull the config
// out so both plugin instances share it.
const skalJsxOptions = {
  moduleName: 'skal',
  modules: {
    // ALL custom-widget imports flow through `skal-flutter` —
    // local CLI-emitted (Greeting, Stickers) + build_runner pub-
    // package (QrImageView, ShimmerFromColors). Single source of
    // truth; the JS side doesn't care which generator produced a
    // widget.
    ...codegen.macroModules,
  },
};

export default defineConfig({
  plugins: [
    // Virtual module + manifest watcher for codegen-wrapped widgets.
    // Synthesizes `skal-flutter` from skal_codegen.json so JSX can
    // `import { QrImageView } from 'skal-flutter'` without any
    // hand-written stub.
    codegen.vitePlugin,
    // Default solid plugin — JSX in *.jsx (excluding *.dom.jsx) lowers
    // to `skal/renderer`'s createElement, which writes BRIDGE OPS.
    // This is the outer Skal app's compile path.
    solid({
      include: /\.jsx$/,
      exclude: /\.dom\.jsx$/,
      solid: { generate: 'universal', moduleName: 'skal/renderer' },
      babel: { plugins: [[skalJsxPlugin, skalJsxOptions]] },
    }),
    // Second solid plugin — JSX in *.dom.jsx lowers to
    // `skal/renderer-web`'s createElement, which writes DOM
    // mutations directly. Used by HtmlEmbed factories so the same
    // <Column>/<Text>/<Button> JSX syntax can render as DOM inside
    // Flutter Web's render tree. Same babel macro, same skal-flutter
    // codegen vocabulary, different sink.
    solid({
      include: /\.dom\.jsx$/,
      solid: { generate: 'universal', moduleName: 'skal/renderer-web' },
      babel: { plugins: [[skalJsxPlugin, skalJsxOptions]] },
    }),
  ],
  build: {
    target: 'es2022',
    minify: 'esbuild',
    lib: {
      entry: 'src/index.jsx',
      // IIFE = self-contained script. JSC evaluates skal-app.js as a
      // top-level script (Bun__REPL__evaluate), so we can't ship ESM
      // import statements at the entry.
      formats: ['iife'],
      name: 'SkalApp',
      fileName: () => 'skal-app.js',
    },
    outDir: resolve(__dirname, 'flutter-host/assets'),
    // Keep other assets intact — Flutter's pubspec.yaml lists the
    // .js / .cjs / .cjs.jsc trio, so we mustn't wipe siblings.
    emptyOutDir: false,
  },
});
