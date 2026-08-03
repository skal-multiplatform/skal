# The JS engine and the reactive layer, measured against React Native

**Measured:** 2026-08-01, Samsung Galaxy A14 5G (SM-A146P), Android 15,
arm64-v8a, **release builds, physical hardware, screen held awake**.
Skal `com.example.skal_bench` vs React Native `com.anonymous.rnfeed`
(Expo 57 / RN 0.86 / Hermes).

These are `BENCHMARK_PLAN_V2.md` Track A rungs 1 and 2. They are
**component benchmarks** — the plan's own premise is that rungs do not
compose, so neither predicts app performance. Their value is as a
**regression net**: checksummed workloads that will catch a future Skal
regression before it ships.

Full data and read-outs live in `benchmark_v2/final-benchmark/`
(gitignored) §7 and §8. This file exists so the findings survive that
folder.

---

## Rung 1 — the JS engine: JSC + bun bytecode vs Hermes

Pure JS. **No UI, no bridge, no native calls, synchronous throughout**,
so nothing here can be measuring scheduling instead of execution.

Both ship **precompiled bytecode**, verified in the APKs: Skal carries
`skal-app.cjs.jsc`; RN's `index.android.bundle` opens with the Hermes
magic `c6 1f bc 03`. Bytecode against bytecode.

**Every workload returns a checksum and both engines agreed on all
eight.** That is what stops dead-code elimination from deleting a loop
and reporting a spectacular number for doing nothing — the classic way
this rung produces a fake win.

3 passes, medians, iterations auto-scaled to ≥400 ms, 20 warm-up
iterations.

| workload | Skal (JSC) | RN (Hermes) | | what it stresses |
|---|---:|---:|---|---|
| JSON.parse 500 posts | **1.1755 ms** | 1.9915 | 1.7× | mostly native C++ in both |
| array pipeline | **0.0225 ms** | 0.2463 | 10.9× | JS callbacks in a hot loop |
| string + regex | **0.2520 ms** | 1.6528 | 6.6× | JS + native regex engine |
| megamorphic access | **0.0175 ms** | 0.1167 | 6.7× | polymorphic property loads |
| alloc churn 2k | **0.0294 ms** | 0.1811 | 6.2× | short-lived objects, GC |
| closure calls 3k | **0.0124 ms** | 0.2141 | 17.3× | megamorphic call sites |
| **pure-JS SHA-256** | **0.0261 ms** | 1.1712 | **44.9×** | tight int32/bitwise loop |
| sort 500 | **0.0948 ms** | 0.7520 | 7.9× | comparison callbacks |

**JSC wins every workload. Median 7.3×, range 1.7×–44.9×.**

### The pre-registered suspicion test

The prediction was written into `enginebench.js` *before* the run: JSC
tiers up through an optimising JIT, Hermes is AOT bytecode with no
optimising JIT, so JSC should win hot loops — **and "if Skal wins every
column including cold parse, distrust the harness."**

Skal won every column, so the test applies. It survives, because the
ordering is what the theory predicts: the **largest** gap is the tightest
interpretable loop (pure-JS SHA-256, 44.9×), the **smallest** is
`JSON.parse` (1.7×), which is native C++ in both engines and barely runs
JS at all. A harness fault would not produce that gradient, and the
matching checksums prove the work ran.

### Cold execution — measured, and it is a tie

The table above discards 20 warm-up iterations, so it is **steady state
only** — the half JSC wins. Hermes's design goal is the cold half, so
that alone would be half a comparison presented as a whole one.

A workload is cold exactly once per process, so this is the **warm-up
curve** from fresh launches (Skal n=3, RN n=2). Clock resolution
0.00008 ms, far below the smallest value.

| first execution, ms | Skal (JSC) | RN (Hermes) | |
|---|---:|---:|---|
| JSON.parse 500 posts | **1.781** | 1.956 | Skal 1.1× |
| array pipeline | 0.592 | **0.317** | RN 1.9× |
| megamorphic access | 0.200 | **0.126** | RN 1.6× |
| alloc churn 2k | 0.447 | **0.176** | RN 2.5× |
| closure calls 3k | 0.272 | **0.216** | RN 1.3× |
| pure-JS SHA-256 | **0.916** | 1.180 | Skal 1.3× |
| sort 500 | **0.343** | 0.795 | Skal 2.3× |

**Cold is a tie — RN 4, Skal 3.** (`string + regex` is excluded: RN's
first execution measured 23.2 ms and 2.3 ms on two launches, a one-time
regex-compilation cost far too unstable to quote.) By iterations
101–1000, **Skal wins 8 of 8**.

Hermes is flat, JSC is a curve — the JIT-vs-interpreter signature and
the strongest evidence the harness is sound:

| pure-JS SHA-256, ms/iter | 1st | 2–10 | 11–100 | 101–1k |
|---|---:|---:|---:|---:|
| Skal (JSC) | 0.916 | 0.298 | 0.071 | **0.034** (27× drop) |
| RN (Hermes) | 1.181 | 1.161 | 1.162 | **1.163** (flat) |

**JSC overtakes within iterations 2–10** on three of the four workloads
Hermes wins cold, and by 11–100 on the fourth. So: code that runs
**once** is a tie; code called **repeatedly** — rendering, scrolling,
list building — goes to JSC by 1.7×–34.7× after about ten calls.

### What it still does not show
- **It does not predict app performance.** A 7× engine advantage did not
  stop RN winning the crypto comparison (`WEBCRYPTO_DISPATCH.md`),
  because that work is native, not JS.
- **Memory is not measured**, and low memory is Hermes's stated goal.

---

## Rung 2 — reactivity: Solid signals vs React hooks, under real render pressure

The plan asked for "no paint". **That is not achievable symmetrically:**
Solid's graph runs headless, but React's hooks cannot execute without a
renderer and an RN release build has none. Rendering into `null`
components would have compared *signal write → effect ran* against
*state write → component reconciled* — two different units.

So both stacks render **real host views** and are measured in the same
unit: **updates actually applied per second, and the frames while doing
it.** 288 live cells (16×18), all on screen, three pressure levels, 8 s
each, deterministic cell selection identical on both sides.

**Each stack gets its best case, deliberately.** Skal: one signal per
cell, so a write touches exactly one `Text`. RN: one `useState` per
cell, memo'd, driver calling that cell's own setter — only touched cells
re-render, no store library, no parent re-render, no reconciliation of
untouched siblings. The naive "lift state to the parent" version would
re-render all 288 per batch and make RN look far worse than it is.

Self-paced, never `setInterval` — a fixed-interval timer is not the same
load on both engines (RN's catches up after a long callback).

| pressure | Skal | RN | |
|---|---:|---:|---|
| 1 cell / batch | **384 writes/s** | 68 | 5.6× |
| 16 cells / batch | **7 621 writes/s** | 893 | 8.5× |
| **ALL 288 / batch** | **103 846 writes/s** | 4 901 | **21.2×** |

Frame quality over the same run, from `dumpsys gfxinfo` — an instrument
independent of the app's own counters:

| | Skal | RN |
|---|---:|---:|
| janky frames | **4.60%** (18) | **50.38%** (265) |
| p95 frame time | **9 ms** | **150 ms** |
| high-input-latency | **18** | 429 |

**RN drops half its frames, p95 150 ms.** Two independent instruments
agree.

### Isolating the framework from the scheduler

At low pressure the numbers are **scheduler-bound, not
reactivity-bound** — 384 batches/s is a `setTimeout(0)` floor, not a
measurement of Solid. Subtracting each stack's own k=1 floor:

| cost of updating 288 cells, above that stack's own floor | | per cell |
|---|---:|---:|
| Skal | 0.169 ms | **0.59 µs** |
| RN | 43.974 ms | **152.7 µs** |

~260× per cell. **Indicative, not exact** — the two floors are different
mechanisms. Skal's k=1 floor (2.604 ms) is `setTimeout` latency; RN's
(14.789 ms) is suspiciously close to one 60 Hz frame, because React
schedules the re-render for the next frame and is therefore frame-bound
even at a single cell.

**The 21× at full pressure needs no such adjustment** and is the number
to quote.

### What it does not settle

- **One shape of update.** Independent leaf cells with no derived state
  is the case fine-grained reactivity is built for. Deep dependency
  chains, list reorders and cross-cutting derived values are untested.
- **Coalescing is not separated.** Both apply every write, but a 90 Hz
  display merges batches on both sides. This is update *application*
  throughput, not distinct painted frames.
- **n=1 per level**, one device.

---

## Re-running

Harnesses are byte-identical in both apps (verify with `md5`):

| rung | Skal | RN |
|---|---|---|
| 1 | `benchmark_v2/skal-bench/src/enginebench.js` | `benchmark_v2/rn-feed/enginebench.js` |
| 2 | `benchmark_v2/skal-bench/src/reactivebench.js` | `benchmark_v2/rn-feed/reactivebench.js` |

```bash
# Skal — build-time screen switch
cd benchmark_v2/skal-bench && VITE_BENCH_SCREEN=engine bun run build   # or =reactive
cd flutter-host && flutter build apk --release --target-platform android-arm64

# RN — runtime screen switch
adb shell am start -n com.anonymous.rnfeed/.MainActivity --es screen engine
```

**Hold the screen awake and assert it.** `svc power stayon true`, then
check `dumpsys power | grep mWakefulness` in the same pass as the
measurement. A dozing screen inflated Skal's crypto numbers ~2× and left
RN's untouched — an error that penalises exactly one arm and is
invisible in the output.

## Related

- `WEBCRYPTO_DISPATCH.md` — the one place RN wins, and why.
- `ANDROID_COLD_START.md` — cold start.
- `BENCHMARKS.md` — **v1, superseded for reactivity.** Its Bench 3
  compares Skal against **Zustand + MMKV**, so it is Track A *rung 3*
  wearing a rung 2 label: its read figures (Zustand 5×–59× faster on
  bare reads) are measured against a persistence layer, not against
  React. Do not cite it as a Solid-vs-React result.
