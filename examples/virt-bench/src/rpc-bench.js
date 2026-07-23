// rpc-bench — the five numbers docs/NATIVE_SUPPORT.md requires before
// codegen starts emitting service methods.
//
//   1. RPC round-trip latency         (the critical one)
//   2. JSON encode/decode cost by payload size
//   3. Stream throughput ceiling
//   4. Reply-heap capacity + overflow behaviour
//   5. Event coalescing when Dart outruns the JS handler
//
// The Dart half is examples/virt-bench/flutter-host/lib/bench_service.dart.
// Results print as `[rpcbench]` lines; docs/BENCHMARKS.md § Bench 4
// records them.
//
// Methodology notes, so a later run is comparable:
//
//   • Every sub-bench warms up first. The first call of a session pays
//     opDeclareName for the method string plus JSC's tier-up; including
//     it would triple the reported median.
//   • Latency is reported as a distribution, not a mean. A per-vsync
//     drain makes the mean meaningless — what matters is whether the
//     median sits near 0 or near a frame (16.6 ms), and how fat the
//     tail is.
//   • Sequential and batched are measured separately. Ten chained
//     awaits costing ten frames is the failure mode the doc predicts;
//     if the batched number is ~1/N of the sequential one, the ring is
//     draining per frame and `Promise.all` is the mitigation.

import { createSkalService } from 'skal/runtime';

const bench = createSkalService('bench');

const now = () =>
  (typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now());

const log = (...a) => console.log('[rpcbench]', ...a);

function stats(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return {
    n: s.length,
    min: s[0],
    p50: at(0.5),
    p95: at(0.95),
    max: s[s.length - 1],
    mean: s.reduce((x, y) => x + y, 0) / s.length,
  };
}

const ms = (v) => `${v.toFixed(3)}ms`;
const fmt = (st) =>
  `n=${st.n} min=${ms(st.min)} p50=${ms(st.p50)} p95=${ms(st.p95)} `
  + `max=${ms(st.max)} mean=${ms(st.mean)}`;

async function warmup(fn, times = 30) {
  for (let i = 0; i < times; i++) await fn();
}

// ── 1. Round-trip latency ────────────────────────────────────────────
async function benchLatency() {
  log('── 1. RPC round-trip latency ──');
  await warmup(() => bench.nop());

  const N = 200;
  const seq = [];
  for (let i = 0; i < N; i++) {
    const t0 = now();
    await bench.nop();
    seq.push(now() - t0);
  }
  log(`sequential await  ${fmt(stats(seq))}`);

  // The same N calls issued before any await. If the op ring drains
  // per frame, these all ride one drain and the amortized cost
  // collapses — which is the whole argument for batching a generated
  // service's calls rather than chaining them.
  const t0 = now();
  await Promise.all(Array.from({ length: N }, () => bench.nop()));
  const batched = now() - t0;
  log(`batched x${N}       total=${ms(batched)} `
    + `amortized=${ms(batched / N)}`);

  // The doc's specific worry: "ten chained awaits ≈ 160 ms".
  const t1 = now();
  for (let i = 0; i < 10; i++) await bench.nop();
  log(`10 chained awaits total=${ms(now() - t1)}`);

  return { seq: stats(seq), batchedTotal: batched, perCall: batched / N };
}

// ── 2. JSON encode/decode cost by payload size ───────────────────────
async function benchJson() {
  log('── 2. JSON cost by payload size ──');
  const sizes = [128, 1024, 8 * 1024, 64 * 1024, 200 * 1024];
  const rows = [];
  for (const size of sizes) {
    await warmup(() => bench.makeString(size), 10);
    const K = size > 64 * 1024 ? 20 : 60;

    const strSamples = [];
    for (let i = 0; i < K; i++) {
      const t = now();
      const s = await bench.makeString(size);
      strSamples.push(now() - t);
      if (i === 0 && s.length !== size) {
        log(`  !! makeString(${size}) returned ${s.length} chars`);
      }
    }

    const jsonSamples = [];
    let jsonBytes = 0;
    for (let i = 0; i < K; i++) {
      const t = now();
      const o = await bench.makeJson(size);
      jsonSamples.push(now() - t);
      if (i === 0) jsonBytes = JSON.stringify(o).length;
    }

    // Round-trip: JS stringify + Dart decode inbound, Dart encode + JS
    // parse outbound. The realistic shape for a generated service that
    // takes an options object and returns a record.
    const payload = await bench.makeJson(size);
    const echoSamples = [];
    for (let i = 0; i < K; i++) {
      const t = now();
      await bench.echoJson(payload);
      echoSamples.push(now() - t);
    }

    const st = stats(strSamples);
    const js = stats(jsonSamples);
    const ec = stats(echoSamples);
    log(`${String(size).padStart(7)}B  string  ${fmt(st)}`);
    log(`${String(jsonBytes).padStart(7)}B  json→   ${fmt(js)}`);
    log(`${String(jsonBytes).padStart(7)}B  json↔   ${fmt(ec)}`);
    rows.push({ size, jsonBytes, string: st, json: js, echo: ec });
  }
  return rows;
}

// Subscribe and resolve once the stream completes (or errors).
function drain(count, payloadBytes, onValue) {
  return new Promise((resolve, reject) => {
    let received = 0;
    const t0 = now();
    const stop = bench.burst$(count, payloadBytes, {
      onValue: (v) => {
        received++;
        if (onValue) onValue(v, received);
      },
      onDone: () => resolve({ received, elapsed: now() - t0, stop }),
      onError: (e) => reject(new Error(String(e))),
    });
  });
}

// ── 3. Stream throughput ceiling ─────────────────────────────────────
async function benchStreams() {
  log('── 3. Stream throughput ──');
  const out = {};
  for (const [label, count, payload] of [
    ['bare int events', 20000, 0],
    ['256B json events', 5000, 256],
    ['4KB json events', 1000, 4096],
  ]) {
    const r = await drain(count, payload);
    const rate = r.received / (r.elapsed / 1000);
    log(`${label.padEnd(17)} sent=${count} recv=${r.received} `
      + `elapsed=${ms(r.elapsed)} rate=${Math.round(rate)}/s`);
    out[label] = { ...r, rate };
  }
  return out;
}

// ── 4. Reply heap capacity + overflow ────────────────────────────────
// wire.dart puts the reply heap at 256 KiB with a documented
// truncate-on-oversize and spin-wait-on-wraparound. Both branches are
// asserted here rather than trusted.
async function benchReplyHeap() {
  log('── 4. Reply heap ──');
  const CAP = 256 * 1024;
  const out = {};

  for (const size of [CAP - 4096, CAP, CAP + 8192, 2 * CAP]) {
    const t = now();
    const s = await bench.makeString(size);
    const got = typeof s === 'string' ? s.length : -1;
    out[size] = got;
    log(`request=${String(size).padStart(7)}B  received=`
      + `${String(got).padStart(7)}B  ${got === size ? 'exact' : 'TRUNCATED'}`
      + `  ${ms(now() - t)}`);
  }

  // Force many wraparounds in one burst: 4 KiB × 400 ≈ 1.6 MiB through
  // a 256 KiB heap, i.e. ~6 wraps. If the spin-wait is hit, it shows up
  // as elapsed time far above the same event count with tiny payloads.
  const r = await drain(400, 4096);
  log(`wraparound burst  sent=400 recv=${r.received} `
    + `elapsed=${ms(r.elapsed)} (≈${Math.round(400 * 4096 / 1024)}KiB `
    + `through a ${CAP / 1024}KiB heap)`);
  out.wraparound = r;
  return out;
}

// ── 5. Coalescing / backpressure ─────────────────────────────────────
// The open policy question: when Dart outruns the JS handler, does the
// queue grow unbounded, drop, or coalesce? Burn real CPU per event and
// see whether every event still arrives and how far behind we finish.
async function benchBackpressure() {
  log('── 5. Backpressure (slow JS handler) ──');
  const SENT = 3000;
  let sink = 0;
  const burn = () => {
    // ~0.05ms of unavoidable work per event. Not a sleep — a sleep
    // would yield and hide the queue behaviour we are probing.
    for (let i = 0; i < 3000; i++) sink += Math.sqrt(i);
  };
  const r = await drain(SENT, 0, burn);
  log(`sent=${SENT} recv=${r.received} elapsed=${ms(r.elapsed)} `
    + `lossless=${r.received === SENT} (sink=${Math.round(sink)})`);
  log(r.received === SENT
    ? 'policy: UNBOUNDED QUEUE — every event is delivered; a fast '
      + 'producer grows memory and delays the frame, it does not drop.'
    : `policy: LOSSY — ${SENT - r.received} events dropped.`);
  return r;
}

export async function runRpcBench() {
  log('start');
  const t0 = now();
  const results = {};
  try {
    results.latency = await benchLatency();
    results.json = await benchJson();
    results.streams = await benchStreams();
    results.replyHeap = await benchReplyHeap();
    results.backpressure = await benchBackpressure();
  } catch (e) {
    log('FAILED:', e && e.message ? e.message : String(e));
    throw e;
  }
  log(`done in ${ms(now() - t0)}`);
  return results;
}
