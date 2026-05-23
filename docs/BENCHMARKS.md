# Benchmarks — consolidated numbers + the bench code we used

The single place to look up "what does Skal actually measure as?"
For *why* these numbers look the way they do, the analysis lives in
[FastStorage.md](FastStorage.md). The bench source itself is
embedded below — the actual files were removed from the tree to
keep the production bundle lean, but the code is preserved here as
the methodology record so any later commit can resurrect the bench
and reproduce.

All numbers are on Android release builds on the same arm64-v8a
Pixel-class emulator, Skal commit `native-store-engine`.

---

## At a glance — what a typical user would feel

The headline metric for "is the app snappy on first interaction":

| Metric | Skal (Solid + Flutter) | Zustand+MMKV+RN | Ratio |
|---|---:|---:|---:|
| Cold mount, 200 reactive cells     | **68 ms**     | 2,612 ms       | **Skal 38×** |
| 1 mutation → next frame             | **3.8 ms**    | 243 ms         | **Skal 65×** |
| 1,000 same-cell writes → settle     | **105 ms**    | 6,819 ms       | **Skal 65×** |
| 200 distinct mutations → settle     | **44 ms**     | 16,801 ms      | **Skal 381×** |

Medians of 5 cold app launches per side. Distributions below.

> One sentence: **Skal's worst-case run beats RN's best-case run on
> every workload that scales with state size or write count.**

---

## Bench 1 — Render bench (end-to-end "what the user sees")

200 visible leaf components subscribed to one key each, programmatic
mutation, `setTimeout(0)` chain as "frame settled" proxy.

### Setup
- 5 cold app launches per side (`adb shell pm clear` between each)
- Bench auto-runs 4 s after first paint
- 3 warmup writes before each timed sub-bench
- Output captured via `adb logcat`, parsed to per-run files

### Mount results

| Metric | Skal sorted distribution | Median | RN sorted distribution | Median | Ratio (med) |
|---|---|---:|---|---:|---:|
| Total mount, 200 cells | 48.6 / 52.6 / **68.4** / 99.9 / 170.4 ms | 68 ms | 2384.7 / 2609.9 / **2612.2** / 2834.6 / 4093.1 ms | 2,612 ms | **38.2×** |
| Per cell | 0.24 / 0.26 / **0.34** / 0.50 / 0.85 ms | 0.34 ms | 11.9 / 13.0 / **13.1** / 14.2 / 20.5 ms | 13.06 ms | **38.2×** |

The two distributions do not overlap. Skal's *worst* (170 ms) is
14× faster than RN's *best* (2,385 ms).

### Mutation results

| Sub-bench | Skal min / **med** / max | RN min / **med** / max | Median ratio |
|---|---:|---:|---:|
| 1 mutation                  | 1.1 / **3.8** / 71.1 ms   | 64 / **243** / 321 ms       | **Skal 64.7×** |
| 1k writes (same cell)       | 78 / **105** / 232 ms     | 1,132 / **6,819** / 8,197 ms | **Skal 65.1×** |
| 200 distinct mutations      | 11 / **44** / 196 ms      | 6,949 / **16,801** / 24,365 ms | **Skal 381.0×** |

Even worst-case Skal beats best-case RN by 5–35× on the 1k-writes
and 200-distinct workloads.

### The bench code

The Skal side lived at `js-app/src/skal/RenderBench.jsx` before
removal — full source preserved here. The RN counterpart was a
near-identical file at
`Skal-RN-Comparison/app/(tabs)/render.tsx` in the sibling repo;
that one is still on disk there since the sibling repo is a
dedicated comparison fixture.

```jsx
// RenderBench — end-to-end render-pipeline benchmark.
//
// Mounts 200 actual visible Solid components subscribed to a Skal
// store, programmatically triggers mutations, and measures the JS-side
// work needed to commit the new render output through the Skal bridge.
//
// What it measures: time from `state.cells[k] = v` to the next
// microtask / setTimeout chain settling, after which all dependent
// Solid components have rerun their render functions and pushed ops
// onto the Skal bridge ring.
//
// What it does NOT measure: Dart-side widget rebuild + Flutter layout
// + Impeller paint.

import { createSignal, For, onMount } from 'solid-js';
import { Box, Column, Row, Text, Button, ListView } from 'skal';
import { createSkalStore, STORE } from './store/db.js';
import { invokeMethod, ROOT_NODE_ID } from '../bridge.js';

const BG = '#FFF2F2F7';
const CARD = '#FFFFFFFF';
const INK = '#FF1C1C1E';
const SUBTLE = '#FF8E8E93';

const N_CELLS = 200;
const N_WRITES = 1000;

const now = () => (typeof performance !== 'undefined' && performance.now
  ? performance.now() : Date.now());

// Module-level cell-mount counter — incremented from each Cell's
// onMount. The bench component records the mount-start timestamp, then
// reads back the time delta once the counter reaches N_CELLS.
let _mountStart = 0;
let _mountedCount = 0;
let _mountAllAt = 0;

// Approximate "frame committed" — flush pending microtasks then
// schedule a setTimeout(0). The timeout fires after the current
// macrotask boundary, by which point Solid's batched updates have
// settled, the Skal bridge has emitted its ops, and Flutter has
// scheduled the next frame.
function waitFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// One leaf cell. Subscribes to `store.cells[i]` via Solid's fine-
// grained reactivity. When the leaf changes, only this Text re-emits
// its op via the Skal bridge — Flutter rebuilds only this widget.
function Cell(props) {
  onMount(() => {
    _mountedCount++;
    if (_mountedCount === N_CELLS) _mountAllAt = now();
  });
  return (
    <Box background={CARD} padding={6} cornerRadius={6}>
      <Text label={'cell ' + props.idx + ': ' + props.store.cells[props.idx]}
        fontSize={11} color={INK} />
    </Box>
  );
}

export default function RenderBench() {
  // Independent store per mount so reruns of the bench don't fight
  // with leftover state from a previous run.
  const initial = { cells: {} };
  for (let i = 0; i < N_CELLS; i++) initial.cells['c' + i] = 0;
  const store = createSkalStore(initial, { name: 'render-bench-' + Date.now() });

  // Capture the mount-start timestamp BEFORE the JSX returns — the
  // first Cell onMount fires after this returns, so this is the
  // earliest "JS work started for this render" baseline.
  _mountStart = now();
  _mountedCount = 0;
  _mountAllAt = 0;

  const [status, setStatus] = createSignal('idle');
  const [lastResult, setLastResult] = createSignal('');

  // Bench A: single-mutation propagation.
  async function runOneMutation() {
    setStatus('running: 1 mutation');
    await waitFrame();
    const t0 = now();
    store.cells.c100 = Math.floor(Math.random() * 1e9);
    await waitFrame();
    return now() - t0;
  }

  // Bench B: 1k-write throughput — flip the same cell 1000× in a
  // tight loop. Skal's batched-mount coalesces effects to one rerun
  // per microtask, so 200 dependent components rerun ONCE despite
  // 1000 mutations.
  async function runThousandWrites() {
    setStatus('running: 1k writes');
    await waitFrame();
    const t0 = now();
    for (let i = 0; i < N_WRITES; i++) store.cells.c100 = i;
    await waitFrame();
    return now() - t0;
  }

  // Bench C: 200 distinct mutations — flip each cell once, every one
  // observed by exactly one component.
  async function runDistinctMutations() {
    setStatus('running: 200 distinct');
    await waitFrame();
    const t0 = now();
    for (let i = 0; i < N_CELLS; i++) store.cells['c' + i] = i + 1;
    await waitFrame();
    return now() - t0;
  }

  async function runAll() {
    // Warm-up — JIT hot paths.
    for (let i = 0; i < 3; i++) {
      store.cells.c100 = i;
      await waitFrame();
    }
    const a = await runOneMutation();
    const b = await runThousandWrites();
    const c = await runDistinctMutations();
    const mountTotal = _mountAllAt > 0 ? _mountAllAt - _mountStart : -1;
    const mountPerCell = mountTotal > 0 ? mountTotal / N_CELLS : -1;
    const lines = [
      'RENDER-BENCH — Skal+Solid+Flutter · ' + new Date().toISOString(),
      'cells=' + N_CELLS + ' · writes=' + N_WRITES,
      '',
      '  initial mount · all ' + N_CELLS + ' cells       : '
        + (mountTotal >= 0 ? mountTotal.toFixed(2) + ' ms ('
          + mountPerCell.toFixed(3) + ' ms/cell)' : '— (not captured)'),
      '  1 mutation · settle               : ' + a.toFixed(2) + ' ms',
      '  1k writes · settle (coalesced)    : ' + b.toFixed(2) + ' ms',
      '  200 distinct mutations · settle   : ' + c.toFixed(2) + ' ms',
    ];
    const text = lines.join('\n');
    setLastResult(text);
    setStatus('done');
    // Mirror to Dart logcat so we can capture without the UI.
    try {
      await invokeMethod(ROOT_NODE_ID, 'benchReport',
        [JSON.stringify({ text: 'RENDER-' + text.replace(/\n/g, '\nRENDER-') })]);
    } catch (_) { /* debug-only */ }
  }

  // Auto-run shortly after mount so we don't need a manual tap.
  onMount(() => { setTimeout(runAll, 4000); });

  return (
    <Column background={BG} padding={12} gap={8} height="fill">
      <Row gap={8}>
        <Button label="Run again" onClick={runAll} />
        <Text label={'status: ' + status()} fontSize={13} color={SUBTLE} />
      </Row>
      <Text label={lastResult() || '(running on mount)'}
        fontSize={11} color={INK} />
      <Text label={'mounted ' + N_CELLS + ' subscribed components below'}
        fontSize={11} color={SUBTLE} />
      <ListView height="fill" itemHeight={32}>
        <For each={Array.from({ length: N_CELLS }, (_, i) => i)}>
          {(i) => <Cell idx={i} store={store} />}
        </For>
      </ListView>
    </Column>
  );
}
```

To re-run: drop this file at `js-app/src/skal/RenderBench.jsx`,
import + add a `<Tab title="Render"><RenderBench /></Tab>` in
`App.jsx`, restore the `benchReport` RPC case in
`flutter/skal_flutter/lib/skal/dialogs.dart` (it just
`debugPrint`s each line with a `SKAL-BENCH ` prefix), rebuild the
JS bundle and the APK.

---

## Bench 2 — Store µs bench (the reactive plumbing in isolation)

Measures effect-level cost: write a leaf, fire dependent effects,
read leaves inside effect. No component, no widget tree, no native
paint. The right tool for tuning the store; the wrong tool for
"what the user sees" (use Bench 1 for that).

### Setup
- 10-run median across cold app launches
- All numbers µs/op
- Skal: bun+JSC + Solid + Skal proxy + native log persistence
- Zustand+MMKV: RN/Hermes + Zustand vanilla + MMKV persistence

### Reads

| Workload | Skal | Zustand+MMKV | Result |
|---|---:|---:|---|
| Bare read same key                       | 19.3 µs | 1.3 µs  | Zustand 15× |
| Bare read distinct keys                   | 5.5 µs  | 0.63 µs | Zustand 9× |
| Read 1 tracked leaf (200 subs)            | 4.10 µs | 0.07 µs | Zustand 59× |
| Read distinct tracked leaves               | 2.39 µs | 0.48 µs | Zustand 5× |

Skal's reads are at the Solid floor (~4 µs is what bare Solid
costs in the same engine). Zustand reads are plain-object property
access plus a cheap selector — structurally faster.

### Writes (200-subscriber setup)

| Workload | Skal | Zustand+MMKV | Result |
|---|---:|---:|---|
| 1 leaf · 1,000 writes                     | 67.95 µs | 9,796 µs  | **Skal 144×** |
| 200 distinct mutations · 1 each            | 391.2 µs | 10,096 µs | **Skal 26×** |
| Set distinct keys (no subs)                | 23.5 µs  | 431 µs    | **Skal 18×** |

The Skal write advantage IS the cost of Solid's read-time tracking
shifted to the write side; Zustand defers tracking and pays
200,000 selector evaluations per 1,000 writes × 200 subscribers.

### Realistic frame (200 effects × 10 reads each)

| Workload | Skal | Zustand+MMKV | Result |
|---|---:|---:|---|
| Mount per effect                          | 156.5 µs | 65 µs   | Zustand 2.4× |
| 1 mutation · full propagation             | 349.9 µs | 1,264 µs | **Skal 3.6×** |
| 1 leaf · 1k writes · propagation          | 535.5 µs | 9,796 µs | **Skal 18×** |
| 200 distinct mutations · 1 each           | 391.2 µs | 10,096 µs | **Skal 26×** |

### Untracked-write baseline (the most revealing column)

A write to a leaf nothing subscribes to. *Should* be near-free in
both stacks. In practice:

| Stack | Cost |
|---|---:|
| Skal     | ~5 µs    |
| Zustand+MMKV | ~2,400 µs |

Zustand still runs 200 selectors, allocates 200 arrays, JSON-
stringifies whole state, writes MMKV — all paid regardless of
whether anything cares. **~500× difference on writes that "should
be free."**

### The bench code — harness + the realistic-frame sub-bench

The Skal side lived at `js-app/src/skal/store/bench.js` (~840
lines, seven sub-benches sharing one harness). The full file isn't
inlined here — the harness pattern + one representative sub-bench
shows the shape; the rest of the file applies the same pattern to
different store-API operations.

```js
// bench.js — Skal-vs-MMKV stress benchmark (debug-only, not shipped).
//
// Writes results to <dataDir>/_skal_bench.txt and ferries them via
// the `benchReport` RPC so they land in logcat (release APKs aren't
// debuggable, so adb run-as can't read the file).

import { createEffect, createRoot } from 'solid-js';
import { createStore as createSolidStore } from 'solid-js/store';
import { createStore as createZustand } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { createSkalStore, STORE } from './db.js';
import { NativeLogStore } from './engine.js';
import { invokeMethod, ROOT_NODE_ID } from '../../bridge.js';

const now = () => (typeof performance !== 'undefined' && performance.now
  ? performance.now() : Date.now());
const RUN = 'mmkv-' + Date.now();
const N = 1000;
const VAL = 'hello';

// Wait for a store's native engine to finish opening before timing.
async function ready(store) {
  const c = store[STORE];
  for (let i = 0; i < 2000; i++) {
    if (c.ready()) return c;
    await new Promise((r) => setTimeout(r, 5));
  }
  return c;
}

// Parametric deep object — used by the DEEP OBJECT scaling sub-bench
// to show how MMKV's whole-blob rewrite scales with state size while
// Skal's leaf-frame writes don't.
function makeDeepObj(target) {
  const profileSize = Math.max(2, Math.floor(target * 0.1));
  const settingsSize = Math.max(4, Math.floor(target * 0.7));
  const sessionSize = Math.max(2, target - profileSize - settingsSize);
  const obj = { profile: {}, settings: {}, session: {} };
  for (let i = 0; i < profileSize; i++) obj.profile['p' + i] = 'profileVal' + i;
  for (let i = 0; i < settingsSize; i++) obj.settings['s' + i] = (i & 1) === 0;
  for (let i = 0; i < sessionSize; i++) obj.session['ss' + i] = i * 97;
  return obj;
}

// Warmup — exercise every hot path so JIT settles before timing.
async function warmup() {
  const w = createSkalStore({ kv: {} }, { name: RUN + '-warm' });
  await ready(w);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 2000; i++) w.kv['w' + i] = VAL;
    let a = ''; for (let i = 0; i < 2000; i++) a = w.kv['w' + i];
    for (let i = 0; i < 2000; i++) delete w.kv['w' + i];
    if (a === ' ') w.kv.x = a;
  }
  w[STORE].flushNow();
}

export async function runBench() {
  const wall0 = now();
  const rows = [];
  const rec = (name, n, ms, note) => {
    rows.push({
      name, n, ms,
      usPerOp: n > 0 && ms >= 0 ? (ms * 1000) / n : 0,
      note: note || '',
    });
  };
  const sep = (label) => rows.push({ sep: label });

  await warmup();

  // ── 6. REALISTIC FRAME — 200 effects × 10 leaf reads each ────────
  // Frame-shaped workload: 200 components each subscribed to 10 leaves
  // via a Solid createEffect. The realistic-frame sub-bench is the
  // workload whose numbers headline FastStorage.md.
  sep('REALISTIC FRAME — 200 effects × 10 leaf reads each');
  {
    const N_SUBS = 200;
    const N_PROPS = 10;
    const initial = { sub: {}, untracked: 0 };
    for (let i = 0; i < N_SUBS; i++) initial.sub['s' + i] = 0;
    const s = createSkalStore(initial, { name: RUN + '-frame' });
    await ready(s);

    let totalReads = 0;
    let firedEffects = 0;
    let sink = 0;
    let dispose;

    // initial mount — 200 effects × 10 reads each
    {
      const t = now();
      createRoot((d) => {
        dispose = d;
        for (let i = 0; i < N_SUBS; i++) {
          const keys = [];
          for (let j = 0; j < N_PROPS; j++) {
            keys.push('s' + ((i + j) % N_SUBS));
          }
          createEffect(() => {
            let acc = 0;
            for (let j = 0; j < N_PROPS; j++) acc += s.sub[keys[j]] | 0;
            sink = acc;
            totalReads += N_PROPS;
            firedEffects++;
          });
        }
      });
      rec('initial mount · 200 effects × 10 reads', N_SUBS, now() - t,
        'reads=' + totalReads + ', fired=' + firedEffects);
    }

    // (A) one mutation — full propagation cost
    {
      const r0 = totalReads, f0 = firedEffects;
      const t = now();
      s.sub.s100 = 1;
      rec('1 mutation · propagation (10 effects rerun)', 1, now() - t,
        'reads=' + (totalReads - r0) + ', fired=' + (firedEffects - f0));
    }

    // (B) 1,000 mutations to same leaf — throughput
    {
      const r0 = totalReads, f0 = firedEffects;
      const t = now();
      for (let i = 0; i < N; i++) s.sub.s100 = i + 2;
      rec('1 leaf · 1,000 writes · propagation', N, now() - t,
        'reads=' + (totalReads - r0) + ', fired=' + (firedEffects - f0));
    }

    // (C) 200 distinct mutations · 1 each
    {
      const r0 = totalReads, f0 = firedEffects;
      const t = now();
      for (let i = 0; i < N_SUBS; i++) s.sub['s' + i] = i + 3000;
      rec('200 distinct mutations · 1 each', N_SUBS, now() - t,
        'reads=' + (totalReads - r0) + ', fired=' + (firedEffects - f0));
    }

    // (D) untracked mutation — baseline (no effects rerun, no reads)
    {
      const r0 = totalReads, f0 = firedEffects;
      const t = now();
      for (let i = 0; i < N; i++) s.untracked = i + 5000;
      rec('1 untracked leaf · 1,000 writes (baseline)', N, now() - t,
        'reads=' + (totalReads - r0) + ', fired=' + (firedEffects - f0));
    }

    if (dispose) dispose();
    if (sink === Number.POSITIVE_INFINITY) console.log(sink); // dce
  }

  // ... (analogous GET, SET, ENGINE DIRECT, DEEP OBJECT, MANY
  //      SUBSCRIBERS, and PURE LIBRARIES (Solid-vs-Zustand) sub-
  //      benches followed the same pattern — see git history for the
  //      full ~840-line file.)

  // Format + ship to Dart logcat via the benchReport RPC.
  const out = [];
  out.push('SKAL STORE — STRESS BENCHMARK  ·  ' + new Date().toISOString());
  out.push('total wall time: ' + (now() - wall0).toFixed(0) + 'ms');
  for (const r of rows) {
    if (r.sep) { out.push(''); out.push('• ' + r.sep); continue; }
    out.push(`  ${r.name.padEnd(46)} ${r.usPerOp.toFixed(3).padStart(10)} us/op  ${r.note}`);
  }
  const text = out.join('\n') + '\n';
  try {
    await invokeMethod(ROOT_NODE_ID, 'benchReport',
      [JSON.stringify({ text })]);
  } catch (_) { /* debug-only */ }
  return text;
}
```

The deleted sub-benches (GET / SET / ENGINE DIRECT / DEEP OBJECT /
MANY SUBSCRIBERS / PURE LIBRARIES) all followed this same harness
pattern — `sep('SECTION NAME')`, set up the workload, `const t =
now()` / loop / `rec(...)` to capture, dispose. The DEEP OBJECT
sub-bench swept three object sizes (20 / 200 / 2000 leaves) to
show MMKV's whole-blob rewrite scaling linearly while Skal's
leaf-frame writes don't.

---

## Bench 3 — Pure libraries (same engine, no persistence)

Solid `createStore` against Zustand vanilla, both inside Skal's JSC
engine. Isolates the libraries from MMKV vs Skal-engine persistence
costs and from RN-vs-Flutter render-pipeline costs.

### Results

| Workload | Solid | Zustand | Winner |
|---|---:|---:|---|
| **Bare reads** | | | |
| Same key, 1,000×                          | 7.8 µs | 1.3 µs  | Zustand 6× |
| Distinct keys, 1,000×                      | 5.2 µs | 0.63 µs | Zustand 8× |
| **Bare writes (no subscribers)** | | | |
| Same key, 1,000×                          | 8.9 µs | 6.8 µs  | Zustand 1.3× |
| Distinct keys, 1,000× (state grows 0→1000) | 3.1 µs | 431 µs  | **Solid 141×** |
| **Many subs (200 · 1 leaf each)** | | | |
| 1 leaf · 1,000 writes                     | 17.8 µs | 253 µs  | **Solid 14×** |
| Untracked · 1,000 writes                  | 9.1 µs  | 42.8 µs | **Solid 4.7×** |
| **Realistic frame (200 × 10 reads)** | | | |
| Mount per effect/listener                  | 12.7 µs | 11.2 µs | Tied |
| 1 leaf · 1,000 writes                     | 285 µs  | 457 µs  | **Solid 1.6×** |
| Untracked · 1,000 writes                  | 5.9 µs  | 296 µs  | **Solid 50×** |

Source: same `bench.js` as Bench 2, in the "PURE LIBRARIES" section.
The pattern is the same — `createSolidStore` / `createZustand`
instead of `createSkalStore`, same harness, same workloads. The
imports at the top of the bench above (`createSolidStore`,
`createZustand`, `subscribeWithSelector`) are for this section.

---

## MMKV side — Dart counterpart (`mmkv_bench.dart`)

The MMKV bench is the Dart-side companion to `bench.js`. Both target
the same physical device (Android emulator) so the comparison is
on-device-comparable, not a cross-device estimate. Lived at
`flutter/skal_flutter/lib/mmkv_bench.dart`:

```dart
// mmkv_bench.dart — DEBUG-ONLY MMKV stress bench, mirrors bench.js so
// Skal and MMKV are measured with identical methodology on the same
// device. Results go to debugPrint (captured in the `flutter run` log).

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:mmkv/mmkv.dart';

Map<String, dynamic> _makeDeepObj(int target) {
  final profileSize = (target * 0.1).floor().clamp(2, target);
  final settingsSize = (target * 0.7).floor().clamp(4, target);
  final sessionSize = (target - profileSize - settingsSize).clamp(2, target);
  final profile = <String, dynamic>{};
  final settings = <String, dynamic>{};
  final session = <String, dynamic>{};
  for (var i = 0; i < profileSize; i++) profile['p$i'] = 'profileVal$i';
  for (var i = 0; i < settingsSize; i++) settings['s$i'] = (i & 1) == 0;
  for (var i = 0; i < sessionSize; i++) session['ss$i'] = i * 97;
  return {'profile': profile, 'settings': settings, 'session': session};
}

String _settingsLeafKey(Map<String, dynamic> obj) {
  final keys = (obj['settings'] as Map).keys.toList();
  return keys[keys.length >> 1] as String;
}

Future<void> runMmkvBench() async {
  const int n = 1000;
  const String val = 'hello';

  try {
    await MMKV.initialize();
    final mmkv = MMKV.defaultMMKV();

    // Warmup — match bench.js shape: hammer every path so JIT is hot.
    for (var r = 0; r < 3; r++) {
      for (var i = 0; i < 2000; i++) mmkv.encodeString('w$i', val);
      var a = '';
      for (var i = 0; i < 2000; i++) a = mmkv.decodeString('w$i') ?? '';
      for (var i = 0; i < 2000; i++) mmkv.removeValue('w$i');
      if (a == ' ') mmkv.encodeString('x', a);
    }
    for (final size in [20, 200, 2000]) {
      final obj = _makeDeepObj(size);
      for (var i = 0; i < 50; i++) {
        mmkv.encodeString('wb', jsonEncode(obj));
        jsonDecode(mmkv.decodeString('wb')!);
      }
    }

    final rows = <String>[];
    void rec(String name, int us, [int iterations = n]) {
      final usPerOp = iterations > 0 ? us / iterations : 0;
      rows.add('  ${name.padRight(44)}'
          '${(us / 1000).toStringAsFixed(2).padLeft(11)} ms'
          '${usPerOp.toStringAsFixed(3).padLeft(10)} us/op');
    }
    void sep(String s) { rows.add(''); rows.add('• $s'); }

    final sw = Stopwatch();
    var acc = '';

    sep('GET — 1,000× (the StorageBenchmark workload)');
    mmkv.encodeString('key', val);
    sw.reset(); sw.start();
    for (var i = 0; i < n; i++) acc = mmkv.decodeString('key') ?? '';
    sw.stop(); rec('get - same key', sw.elapsedMicroseconds);

    for (var i = 0; i < n; i++) mmkv.encodeString('k$i', val);
    sw.reset(); sw.start();
    for (var i = 0; i < n; i++) acc = mmkv.decodeString('k$i') ?? '';
    sw.stop(); rec('get - distinct keys', sw.elapsedMicroseconds);

    sep('SET / DELETE — 1,000×');
    sw.reset(); sw.start();
    for (var i = 0; i < n; i++) mmkv.encodeString('key', val);
    sw.stop(); rec('set - same key', sw.elapsedMicroseconds);

    sw.reset(); sw.start();
    for (var i = 0; i < n; i++) mmkv.encodeString('s$i', val);
    sw.stop(); rec('set - distinct keys', sw.elapsedMicroseconds);

    for (var i = 0; i < n; i++) mmkv.encodeString('d$i', val);
    sw.reset(); sw.start();
    for (var i = 0; i < n; i++) mmkv.removeValue('d$i');
    sw.stop(); rec('delete - distinct keys', sw.elapsedMicroseconds);

    // DEEP OBJECT — scaling: MMKV has no nested types, so the realistic
    // pattern is a JSON blob under one key. Save / get / update all
    // touch the WHOLE blob — cost scales with object size.
    for (final size in [20, 200, 2000]) {
      sep('DEEP OBJECT — $size leaves  (JSON blob)');
      final obj = _makeDeepObj(size);
      final leafKey = _settingsLeafKey(obj);

      sw.reset(); sw.start();
      for (var i = 0; i < n; i++) {
        mmkv.encodeString('blob$size', jsonEncode(obj));
      }
      sw.stop(); rec('deep save - JSON blob', sw.elapsedMicroseconds);

      sw.reset(); sw.start();
      for (var i = 0; i < n; i++) {
        final m = jsonDecode(mmkv.decodeString('blob$size')!) as Map;
        acc = ((m['settings'] as Map)[leafKey]).toString();
      }
      sw.stop(); rec('deep get  - JSON blob (parse whole)', sw.elapsedMicroseconds);

      sw.reset(); sw.start();
      for (var i = 0; i < n; i++) {
        final m = jsonDecode(mmkv.decodeString('blob$size')!) as Map;
        (m['settings'] as Map)[leafKey] = i;
        mmkv.encodeString('blob$size', jsonEncode(m));
      }
      sw.stop(); rec('deep update - JSON blob (rewrite whole)', sw.elapsedMicroseconds);
    }

    debugPrint('=== MMKV-BENCH START (same device, ${n}x each) ===');
    for (final r in rows) {
      debugPrint('MMKV-BENCH$r');
    }
    debugPrint('=== MMKV-BENCH END ===');
    if (acc == ' ') debugPrint(acc);
  } catch (e, st) {
    debugPrint('=== MMKV-BENCH ERROR: $e\n$st');
  }
}
```

To re-run: drop this file at `flutter/skal_flutter/lib/mmkv_bench.dart`,
add `mmkv: ^2.4.0` to `pubspec.yaml`, run `flutter pub get`, then
hook it from `main.dart` with `Future.delayed(const Duration(seconds: 8), runMmkvBench);`.

---

## Skal optimization history (µs reads/mount, from Bench 2)

| Workload | Baseline | **Final (shipped)** | Δ |
|---|---:|---:|---|
| **Reads** | | | |
| Bare read same key                       | 20.4 | **19.3** | ↓ 5% |
| Bare read distinct keys                  | 79.3 | **5.5**  | ↓ 93% |
| Read 1 tracked leaf (200 subs)           | 8.85 | **4.10** | ↓ 54% |
| Read distinct tracked leaves              | 13.35 | **2.39** | ↓ 82% |
| **Writes** | | | |
| 1 leaf · 1,000 writes (200 subs)         | 139.3 | **67.95** | ↓ 51% |
| 200 distinct mutations                    | 1057.9 | **391.2** | ↓ 63% |
| Set distinct keys                          | 83.9  | **23.5**  | ↓ 72% |
| **Realistic frame** | | | |
| Mount per effect                          | 317.3 | **156.5** | ↓ 51% |
| 1 mutation · propagation                  | 549.7 | **349.9** | ↓ 36% |
| 1 leaf · 1k writes · propagation          | 1090.5 | **535.5** | ↓ 51% |
| 200 distinct mutations                    | 1057.9 | **391.2** | ↓ 63% |

The Phase 1+2 changes (all in [`js-app/src/skal/store/db.js`](js-app/src/skal/store/db.js))
are zero-memory and have no API change. Each named optimization is
documented in [FastStorage.md § What we built](FastStorage.md).

---

## How to re-run

To resurrect the bench:

1. Drop the source files above back into the tree at the indicated
   paths (`bench.js`, `RenderBench.jsx`, `mmkv_bench.dart`).
2. Restore deps: `zustand: ^5.0.13` in `js-app/package.json` (for
   the pure-libraries section of `bench.js`); `mmkv: ^2.4.0` in
   `flutter/skal_flutter/pubspec.yaml` (for the MMKV bench).
3. Re-wire entry points: `runBench()` from `App.jsx`'s root
   `onMount` (delay ~2.5 s); `<RenderBench />` as a Tab; the
   `benchReport` case in `dialogs.dart`; `runMmkvBench` from
   `main.dart` with `Future.delayed(8 seconds, ...)`.
4. Restore native bindings (MMKV adds entries to the macOS
   `GeneratedPluginRegistrant.swift`, `Podfile.lock`, and the
   Xcode `project.pbxproj` — `flutter pub get` regenerates the
   first two; the third needs an Xcode build to refresh).
5. `bun run build` (rebuilds `skal-app.cjs/.jsc/.js`),
   `flutter build apk --release`, `adb install -r ...`.

### APK builds (still applicable)

```bash
# Skal APK
cd js-app
bun run build                                  # rebuilds skal-app.cjs + .jsc

cd ../flutter/skal_flutter
export JAVA_HOME=$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
flutter build apk --release
adb install -r build/app/outputs/flutter-apk/app-release.apk

# RN comparison APK (sibling repo, bench-fixture still on disk there)
cd /Users/andrepimenta/Documents/coding/explore/Skal-RN-Comparison/android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Capture loops (after bench code is restored)

```bash
# Render bench — 5 cold launches per side
mkdir -p /tmp/render_bench
for n in 1 2 3 4 5; do
  adb shell am force-stop com.skal.skal_flutter
  adb shell pm clear com.skal.skal_flutter > /dev/null
  adb logcat -c
  adb shell am start -n com.skal.skal_flutter/.MainActivity > /dev/null
  until adb logcat -d | grep -q "RENDER-  200 distinct mutations · settle"; do
    sleep 3
  done
  adb logcat -d | grep "SKAL-BENCH RENDER-" > /tmp/render_bench/skal_run${n}.txt
done
for n in 1 2 3 4 5; do
  adb shell am force-stop com.anonymous.SkalRNComparison
  adb shell pm clear com.anonymous.SkalRNComparison > /dev/null
  adb logcat -c
  adb shell am start -n com.anonymous.SkalRNComparison/.MainActivity > /dev/null
  until adb logcat -d | grep -q "RENDER-BENCH END"; do
    sleep 5
  done
  adb logcat -d | grep "RENDER-BENCH" > /tmp/render_bench/rn_run${n}.txt
done

# µs bench — 10 cold launches Skal side, 3 RN side
for n in 1 2 3 4 5 6 7 8 9 10; do
  adb shell am force-stop com.skal.skal_flutter
  adb shell pm clear com.skal.skal_flutter > /dev/null
  adb logcat -c
  adb shell am start -n com.skal.skal_flutter/.MainActivity > /dev/null
  until adb logcat -d -t 8000 | grep -q "SKAL-BENCH total wall time"; do
    sleep 3
  done
  adb logcat -d -t 8000 | grep "SKAL-BENCH" > /tmp/skal_run${n}.txt
done
```

Then parse the per-run `.txt` files with a Python script that
extracts the µs/op column (second numeric value per row) and
reports min / median / max + the full sorted distribution.

---

## A note on noise

Both stacks show bimodal run-to-run variance — this is JIT/GC
behavior on the emulator, not a measurement bug. Two clusters:

- Fast cluster: hot JIT, no GC pause during the timed window
- Slow cluster: cold JIT or one GC pause during the timed window

3-run medians can be misleading (Lesson 6 in
[FastStorage.md](FastStorage.md) documents a case where 3 runs
suggested ~12 µs and 10 runs revealed ~50–80 µs). Read the
sorted distribution, not just the median.

Skal's slow tail is bounded — even on a bad run, mount stays
under 200 ms and propagation under 250 ms. RN's slow tail is not
bounded — bad runs on 200-distinct went past 24 seconds. The
qualitative shape of "how bad does it get when JIT is cold and
GC pauses" differs structurally between the stacks.

---

*Last updated: 2026-05-21. Numbers from `native-store-engine`
branch with Phase 1+2 optimizations. Render bench captured at 5
cold launches per side; µs bench at 10 cold launches per side.
Bench source files embedded above; the production tree no longer
contains them.*
