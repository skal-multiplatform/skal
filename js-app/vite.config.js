import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const skalJsxPlugin = require('./babel-plugin-skal-jsx.cjs');

// Solid's universal-renderer mode: babel-preset-solid (wrapped by
// vite-plugin-solid) compiles JSX into direct calls to OUR custom
// renderer's createElement/insertNode/etc. — no DOM dependency.
//
// `moduleName` tells the babel plugin where those helpers come from.
// We expose them via the `~renderer` alias so the import works the
// same from any source file regardless of nesting.
//
// `skal-jsx` babel plugin runs BEFORE solid's preset (babel plugin
// pass precedes preset pass). It rewrites capitalized JSX tags like
// <Column> back to their lowercase intrinsic form <column> at build
// time, so the runtime never pays the component-wrapper overhead.
// See babel-plugin-skal-jsx.js for the full rationale.

export default defineConfig({
  resolve: {
    alias: {
      '~renderer': resolve(__dirname, 'src/renderer.js'),
      // Bare-specifier import path for the capitalized-component
      // module. Used as `import { Column, Row } from 'skal'`. The
      // exports are runtime-fallback throwers; the babel plugin
      // strips real usages at compile time.
      'skal': resolve(__dirname, 'src/skal/index.js'),
      // Example Skal adapter package — see js-app/src/skal-greeting and
      // flutter/skal_flutter/lib/adapters/greeting.dart for the matched
      // pair. Real third-party adapters would live as separate pub.dev /
      // npm publications; here we keep both halves in-tree for the
      // demo + Slice 1 validation.
      'skal-greeting': resolve(__dirname, 'src/skal-greeting/index.js'),
    },
  },
  plugins: [
    solid({
      solid: {
        generate: 'universal',
        moduleName: '~renderer',
      },
      babel: {
        plugins: [
          [skalJsxPlugin, {
            moduleName: 'skal',
            // Each entry adds another module the macro recognizes; values
            // are { ImportedName: 'loweredTag' } maps. Custom widgets
            // lower to a camelCase intrinsic tag that matches the Dart-
            // side SkalRegistry registration key (see greeting.dart's
            // `SkalRegistry.registerWidget('greeting', …)`).
            modules: {
              'skal-greeting': { Greeting: 'greeting' },
            },
          }],
        ],
      },
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
    outDir: resolve(__dirname, '../flutter/skal_flutter/assets'),
    // Keep other assets intact — Flutter's pubspec.yaml lists the
    // .js / .cjs / .cjs.jsc trio, so we mustn't wipe siblings.
    emptyOutDir: false,
  },
});
