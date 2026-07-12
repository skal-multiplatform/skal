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
    alias: { '~renderer': 'skal/renderer-web' },
  },
  server: { port: 5173, open: false },
  build: {
    outDir: 'dist',
    target: 'es2022',
    minify: 'esbuild',
    emptyOutDir: true,
  },
});
