import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';
import { createRequire } from 'module';
import { skalCodegen } from './vite-plugin-skal-codegen.js';

const require = createRequire(import.meta.url);
const skalJsxPlugin = require('./babel-plugin-skal-jsx.cjs');

// Codegen-wrapped Flutter widgets. Empty manifest by default — once
// you add `skal_codegen` builders and YAML entries to flutter-host/,
// build_runner emits these manifests automatically and `<MyWidget />`
// imports from 'skal-flutter' will start resolving here.
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
        moduleName: 'skal/renderer',
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
  build: {
    target: 'es2022',
    minify: 'esbuild',
    lib: {
      entry: 'src/index.jsx',
      formats: ['iife'],
      name: 'SkalApp',
      fileName: () => 'skal-app.js',
    },
    outDir: resolve(__dirname, 'flutter-host/assets'),
    emptyOutDir: false,
  },
});
