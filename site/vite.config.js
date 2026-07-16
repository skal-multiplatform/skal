// skal-site — plain Solid DOM app (the ".dom island" vocabulary as the
// whole tree). The Skal widget renderer isn't used here: the site's
// component showcases are the embedded gallery builds (dist/gallery*,
// see package.json "assets"), and the shell is document-shaped HTML
// that Shape E prerenders to static markup.
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  build: { outDir: 'dist', target: 'es2022', emptyOutDir: true },
  server: { port: 5174, open: false },
});
