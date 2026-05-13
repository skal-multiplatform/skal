import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';

// Solid's universal-renderer mode: babel-preset-solid (wrapped by
// vite-plugin-solid) compiles JSX into direct calls to OUR custom
// renderer's createElement/insertNode/etc. — no DOM dependency.
//
// `moduleName` tells the babel plugin where those helpers come from.
// We expose them via the `~renderer` alias so the import works the
// same from any source file regardless of nesting.

export default defineConfig({
  resolve: {
    alias: {
      '~renderer': resolve(__dirname, 'src/renderer.js'),
    },
  },
  plugins: [
    solid({
      solid: {
        generate: 'universal',
        moduleName: '~renderer',
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
