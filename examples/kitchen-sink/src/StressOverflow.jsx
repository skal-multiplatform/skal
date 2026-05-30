// Stress route (web only) — a synchronous big-list mount that overflows
// the bridge's 768 KiB JS string heap several times mid-mount, exercising
// the op-ring / string-heap overflow path (`flushAndWaitForDrain` → the
// web inline-drain hook `__skal_drainOpsSync`). See WEB_SUPPORT_PLAN.md
// "Op-ring overflow — inline drain instead of a futile spin (web)".
//
// Reached via `?stress=<count>` (wired in index.jsx). Each row writes a
// ~1.5 KB label into the string heap, so ~520 rows fill it; the default
// 1500 rows overflow it ~3× in a single synchronous render.
//
// Why this is the test: on web, JS and Dart share the main thread, so the
// old `flushAndWaitForDrain` spin could never see the consumer drain — it
// burned 5 s, then blind-rewound the ring and overwrote undrained ops. The
// inline-drain hook instead pumps the consumer synchronously, so the ring
// drains in chunks with no freeze and no loss. The proof is visual: the
// EARLIEST rows belong to the first chunk (drained inline at the first
// overflow) — if "Row 0", "Row 1", … render in order, that chunk survived;
// on the old blind-reset path they'd be clobbered by later rows.
//
// `maxLines={1}` + ellipsis keeps Flutter layout cheap despite the long
// hidden strings, so the only heavy thing here is the bridge traffic.

import { For, onMount } from 'solid-js';
import { ScrollView, Box, Text } from 'skal';
// Shared palette — same string literals the rest of the app uses, so the
// bridge's prop-diff cache hits across routes. See ./theme.js.
import { BG, CARD, INK, BODY } from './theme.js';

// ~1.5 KB of filler per row.
const FILLER = '.'.repeat(1500);

export default function StressOverflow(props) {
  const count = props.count || 1500;
  const rows = Array.from({ length: count }, (_, i) => i);
  const approxOverflows = Math.max(1, Math.round((count * 1.5) / 768));

  onMount(() => {
    // Readable in the browser console — confirms how many times the web
    // overflow path fired during the synchronous mount above.
    // eslint-disable-next-line no-undef
    console.log(
      `[skal-stress] mounted ${count} rows (~1.5 KB each); ` +
        `overflow resets = ${globalThis.__skal_opRingResets | 0}`,
    );
  });

  return (
    <ScrollView background={BG} padding={16} gap={6} scrollbar>
      <Text
        label={`Skal overflow stress — ${count} rows × ~1.5 KB ` +
          `→ overflows the 768 KiB string heap ~${approxOverflows}× in one mount`}
        fontSize={15}
        fontWeight={800}
        color={INK}
      />
      <For each={rows}>
        {(i) => (
          <Box background={CARD} cornerRadius={6} padding={8}>
            <Text
              label={`Row ${i}: ${FILLER}`}
              fontSize={12}
              maxLines={1}
              textOverflow={1}
              color={BODY}
            />
          </Box>
        )}
      </For>
    </ScrollView>
  );
}
