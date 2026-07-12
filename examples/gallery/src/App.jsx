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

export default function App() {
  const [i, setI] = createSignal(0);
  const demo = () => DEMOS[i()];
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
