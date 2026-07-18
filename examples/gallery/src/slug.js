// Canonical demo slug — the deep-link / run-live address for a demo.
// Shared so the gallery app (App.jsx), the screenshot flow generator
// (scripts/gen-gallery.js), and the docs builder (website/build-components.mjs)
// all produce byte-identical slugs; drift would silently break deep links.
export const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
