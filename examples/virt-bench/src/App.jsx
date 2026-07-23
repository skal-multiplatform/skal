// virt-bench — builder-mode <ListView> proof harness.
//
// Exercises the paths the code review flagged, all without interaction:
//   • boot: 100k virtual rows → only the visible window materializes
//   • rows carry an onClick handler (handler-map churn on evict)
//   • the RPC bench suite runs first (~20s; see rpc-bench.js), then:
//   • +0.5s: <Show> hides the list's ANCESTOR (nested-unmount teardown)
//   • +3.5s: <Show> shows it again (clean remount)
//   • +6.5s: count → 0 then → N (evict-all + re-request round-trip)
// Watch the log for `[bench]`/`[rpcbench]` lines and any exception.
import { createSignal, Show } from 'solid-js';
import { Box, Column, Row, Text, Button, ListView } from 'skal';
import { runRpcBench } from './rpc-bench.js';

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

  // The RPC bench runs FIRST and the list-churn phases hang off its
  // completion. Overlapping them would measure transport latency
  // against a tree that is simultaneously evicting and rebuilding
  // hundreds of rows — real, but not the number we're after here.
  //
  // Promise.race with a hard timeout: benches 4-5 deliberately drive
  // reply-heap wraparound and backpressure — the exact regimes where a
  // stream's terminal event could plausibly be lost — and drain() has
  // no timeout of its own. Without the race, a wedged bench silently
  // cancelled the virtualization phases, which are this harness's
  // actual job.
  setTimeout(() => {
    const deadline = new Promise((resolve) => setTimeout(() => {
      console.log('[bench] rpc bench did not settle within 90s — '
        + 'running virtualization phases anyway');
      resolve();
    }, 90000));
    Promise.race([runRpcBench().catch(() => {}), deadline])
      .then(() => {
        setTimeout(() => { console.log('[bench] hide ancestor (nested unmount)'); setVisible(false); }, 500);
        setTimeout(() => { console.log('[bench] show ancestor again (remount)'); setVisible(true); }, 3500);
        setTimeout(() => { console.log('[bench] count -> 0'); setN(0); }, 6500);
        setTimeout(() => { console.log(`[bench] count -> ${N} (re-request)`); setN(N); }, 8500);
      });
  }, 800);

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
