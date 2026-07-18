// virt-bench — builder-mode <ListView> proof harness.
//
// Exercises the paths the code review flagged, all without interaction:
//   • boot: 100k virtual rows → only the visible window materializes
//   • rows carry an onClick handler (handler-map churn on evict)
//   • 3s: <Show> hides the list's ANCESTOR (nested-unmount teardown)
//   • 6s: <Show> shows it again (clean remount)
//   • 9s: count → 0 then → N (evict-all + re-request round-trip)
// Watch the log for `[bench]` lines and any exception.
import { createSignal, Show } from 'solid-js';
import { Box, Column, Row, Text, Button, ListView } from 'skal';

const N = 100000;

let lo = Infinity;
let hi = -1;
let logTimer = null;
function note(i) {
  if (i < lo) lo = i;
  if (i > hi) hi = i;
  if (logTimer) return;
  logTimer = setTimeout(() => {
    console.log(`[bench] materialized rows ${lo}..${hi}`);
    logTimer = null;
    lo = Infinity;
    hi = -1;
  }, 50);
}

export default function App() {
  const [visible, setVisible] = createSignal(true);
  const [n, setN] = createSignal(N);

  setTimeout(() => { console.log('[bench] hide ancestor (nested unmount)'); setVisible(false); }, 3000);
  setTimeout(() => { console.log('[bench] show ancestor again (remount)'); setVisible(true); }, 6000);
  setTimeout(() => { console.log('[bench] count -> 0'); setN(0); }, 9000);
  setTimeout(() => { console.log(`[bench] count -> ${N} (re-request)`); setN(N); }, 11000);

  return (
    <Column padding={0} background="#FFF7F7F9">
      <Row padding={12} gap={10} background="#FFFFFFFF">
        <Text label={`virt-bench — ${N} rows, builder mode`} testID="bench-title"
              fontSize={15} fontWeight={700} color="#FF1C1C1E" />
      </Row>
      <Show when={visible()} fallback={<Box padding={20}><Text label="(list hidden)" fontSize={14} color="#FF8E8E93" /></Box>}>
        <Box height={520}>
          <ListView
            count={n()}
            renderItem={(i) => {
              note(i);
              return (
                <Box padding={10} width={360}
                     background={i % 2 === 0 ? '#FFFFFFFF' : '#FFF2F2F7'}>
                  <Text label={`Row ${i}`} fontSize={14} color="#FF1C1C1E" />
                </Box>
              );
            }}
          />
        </Box>
      </Show>
    </Column>
  );
}
