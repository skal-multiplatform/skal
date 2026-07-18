// gallery — one component per screen, for the docs screenshot pipeline.
//
// The bar sits at the TOP (directly under the status bar), so the docs
// crop is a constant top trim on every demo (see scripts/shoot-gallery.sh).
// Maestro steps through the demos by tapping `next` and screenshotting
// each screen (scripts/gen-gallery.js emits the flow).
//
// NB: keep this tree free of width="fill" / height="fill" at the root —
// that combination collapses the whole tree on the iOS host today
// (kitchen-sink's SkalApp shell handles fill; the template shell doesn't).

import { createSignal } from 'solid-js';
import { Box, Column, Row, Text, Button } from 'skal';
import { DEMOS } from './demos.jsx';
import { slug } from './slug.js';

// Resolve a demo address to an index: a slug (canonical), or a numeric
// index (legacy). Returns -1 if it matches nothing.
function demoIndex(q) {
  if (q == null) return -1;
  const bySlug = DEMOS.findIndex((d) => slug(d.name) === String(q));
  if (bySlug >= 0) return bySlug;
  const byIndex = Number(q);
  return Number.isInteger(byIndex) && DEMOS[byIndex] ? byIndex : -1;
}

// Web embeds deep-link a demo (?demo=<slug|index>) and drive the player
// from the docs page via postMessage — both no-ops on native, where
// location/addEventListener don't exist.
function initialDemo() {
  try {
    const q = /[?&]demo=([a-z0-9-]+)/.exec(globalThis.location?.search ?? '')?.[1];
    const idx = demoIndex(q);
    return idx >= 0 ? idx : 0;
  } catch { return 0; }
}

export default function App() {
  const [i, setI] = createSignal(initialDemo());
  const demo = () => DEMOS[i()];
  // Browser only (DOM build + Flutter-wasm iframe): both expose
  // addEventListener + postMessage. Native JSC has neither. (This app
  // never runs under the happy-dom prerender — only the site's own
  // routes do — so no bun-event-loop concern applies here.) NB: don't
  // gate on `window === globalThis`; that reads false at bundle-eval
  // time inside the Flutter-wasm host, so the listener never binds.
  if (typeof globalThis.addEventListener === 'function' &&
      typeof globalThis.postMessage === 'function') {
    globalThis.addEventListener('message', (e) => {
      const d = e?.data;
      if (!d || d.type !== 'skal-gallery-demo') return;
      // Accept a slug (canonical, regen-skew-proof) or a legacy index.
      const idx = demoIndex(d.slug ?? d.index);
      if (idx >= 0) setI(idx);
    });
    // Announce readiness so the docs page can flush a demo request that
    // was clicked before this bundle — which only runs once the wasm
    // engine has booted — registered its listener.
    try { globalThis.parent?.postMessage({ type: 'skal-gallery-ready' }, '*'); } catch { /* no parent */ }
  }
  return (
    <Column padding={0} background="#FFF7F7F9">
      <Row padding={12} gap={10} background="#FFFFFFFF">
        <Text label={demo().name} testID="gallery-title" fontSize={15} fontWeight={700} color="#FF1C1C1E" />
        <Text label={`${i() + 1} / ${DEMOS.length}`} fontSize={11} color="#FF8E8E93" />
        <Button label="prev" testID="prev" onClick={() => setI((i() + DEMOS.length - 1) % DEMOS.length)} />
        <Button label="next" testID="next" onClick={() => setI((i() + 1) % DEMOS.length)} />
      </Row>
      <Box padding={20}>
        {demo().view()}
      </Box>
    </Column>
  );
}
