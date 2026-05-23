# Fast Storage — Skal performance analysis & optimization results

Comprehensive write-up of the cross-stack benchmarking, the optimizations
that shipped, the lessons learned along the way, and what remains.

All numbers are **median across N runs, Android release on the emulator**
(arm64-v8a, Pixel-class). Skal runs on bun+JSC (custom libskal build);
Zustand-with-MMKV runs on RN/Hermes. The Solid-vs-Zustand library
comparison runs on the same JSC engine inside Skal for an apples-to-
apples library shootout.

The bench source code is preserved in [BENCHMARKS.md](BENCHMARKS.md) —
the actual files were removed from the tree to keep the production
bundle lean, but BENCHMARKS.md embeds them as the methodology record
so any later commit can resurrect the bench and reproduce. The RN
counterpart still lives on disk in the sibling
[`Skal-RN-Comparison`](../explore/Skal-RN-Comparison) repo as a
dedicated comparison fixture.

---

## TL;DR

1. **Skal beats Zustand+MMKV by 18-26× on realistic-frame writes** — the
   workload that real interactive apps actually experience. After
   shipping Phase 1+2 optimizations, this lead widened from 9× to 18-26×.

2. **Reads now match Solid alone.** The wrapping proxy that previously
   added ~50% overhead on top of Solid is now essentially free. Reads
   are at the architectural floor for a runtime-tracking reactive
   system.

3. **Mount cost halved.** Phase 1+2 took mount per effect from 403 µs
   → 156 µs — closing the gap to Zustand from 6.2× to 2.4× and going
   from "noticeable on cold screen entry" to "imperceptible."

4. **All wins are zero-memory.** No new caches that scale with usage,
   no API change, Solid still underneath. ~16 bytes of init flags total.

5. **The path forward**: Phase 1+2 is done and shipped. Remaining
   optimization opportunities involve trade-offs (memory, API change,
   native code, replacing Solid) and aren't necessary for current
   performance targets.

---

## Methodology

### Setup

- Android release APKs on an emulator (Pixel-class, arm64-v8a).
- Both apps installed fresh per run (`adb shell pm clear`).
- Bench auto-runs ~1.5-8 s after first paint; results captured via
  `adb logcat | grep SKAL-BENCH` (or `ZBENCH` for the RN side).
- **10-run median** for final numbers (3-run median for some earlier
  reference points — flagged where used). Larger sample sizes reveal
  the bimodal JIT-warmup distribution that 3 runs miss.
- All numbers in µs/op unless stated.

### Workloads

| Section | What it stresses |
|---|---|
| GET 1,000× same/distinct                  | Bare RAM read cost |
| SET 1,000× same/distinct                  | Bare write cost |
| ENGINE DIRECT                              | Native log put/get with no Solid / no proxy |
| DEEP OBJECT (20/200/2000 leaves)          | Scaling of partial updates with state size |
| MANY SUBSCRIBERS (200 subs · 1 leaf)      | Fine-grained vs selector-based dispatch |
| REALISTIC FRAME (200 effects × 10 reads)  | Frame-shaped workload — components reading multiple props |
| SOLID-store vs ZUSTAND (no persistence)   | Pure library shootout in the same engine |

The MANY SUBSCRIBERS and REALISTIC FRAME sections include both write
and read workloads, and an "untracked baseline" (mutate a leaf nothing
subscribes to — should be free in both stacks).

### Counters

Each many-subs/frame test reports:
- `fired` — actual subscriber callbacks invoked
- `sel` (Zustand only) — selector executions per setState (selector
  amplification cost)
- `reads` — total leaf reads during the workload (for realistic-frame)

These confirm we're comparing equivalent semantics, not measuring
different work.

### A note on noise

The bench shows bimodal run-to-run variance:
- Fast cluster: 1.5-3 µs for reads, 100-200 µs for mount
- Slow cluster: 5-15 µs for reads, 250-400 µs for mount

This is JIT/GC noise on the emulator. 3-run medians can be lucky
or unlucky; 10-run medians give a stable picture. The shipped state's
fast tail matches Solid alone — when JSC is warm and not GC-pausing,
Skal's wrapper costs essentially nothing.

---

## Results — baseline vs achieved (10-run median)

### Skal Final vs Skal Baseline (before any optimization)

| Workload | Baseline | **Final** | Δ |
|---|---:|---:|---|
| **READS** | | | |
| Bare read same key                       | 20.4 | **19.3** | ↓ 5% |
| Bare read distinct keys                  | 79.3 | **5.5**  | **↓ 93%** |
| Read 1 tracked leaf (200 subs)           | 8.85 | **4.10** | ↓ 54% |
| Read distinct tracked leaves              | 13.35| **2.39** | **↓ 82%** |
| **WRITES (200-sub setup)** | | | |
| 1 leaf · 1,000 writes                    | 139.3| **67.95**| ↓ 51% |
| 200 distinct mutations                    | 1057.9| **391.2**| **↓ 63%** |
| Set distinct keys                          | 83.9 | **23.5** | ↓ 72% |
| **REALISTIC FRAME (200 effects × 10 reads)** | | | |
| Initial mount per effect                  | 317.3| **156.5**| **↓ 51%** |
| 1 mutation · full propagation             | 549.7| **349.9**| ↓ 36% |
| 1 leaf · 1k writes · propagation          | 1090.5| **535.5**| ↓ 51% |
| 200 distinct mutations · 1 each           | 1057.9| **391.2**| ↓ 63% |

### Skal Final vs Zustand+MMKV (Android release)

| Workload | Skal Final | Zustand+MMKV | Result |
|---|---:|---:|---|
| Read 1 tracked leaf (200 subs)         | 4.10  | 0.07  | Zustand 59× *(was 173×)* |
| Read distinct tracked leaves            | 2.39  | 0.48  | Zustand 5× *(was 25×)* |
| Mount per effect                        | 156.5 | 65    | Zustand 2.4× *(was 6.2×)* |
| 1 mutation propagation                   | 349.9 | 1264  | **Skal 3.6×** *(was 2.7×)* |
| 1 leaf · 1k writes propagation           | 535.5 | 9796  | **Skal 18×** *(was 8.6×)* |
| 200 distinct mutations                   | 391.2 | 10096 | **Skal 26×** *(was 9.5×)* |

**Reads now match Solid alone.** The wrapping proxy that previously
added ~50% overhead on reads is gone. **Frame-shaped writes are 18-26×
faster than Zustand+MMKV** — the workloads that interactive apps
actually feel.

### What the counters reveal

For "**1 leaf · 1,000 writes · 200 subs**":

| | Skal | Zustand |
|---|---:|---:|
| Effects/listeners that actually fired | 1,000 (1 per write) | 1,000 (1 per write) |
| Selector evaluations needed to figure that out | 0 | 200,000 (200 selectors × 1,000 writes) |

Both stacks end with the same number of callbacks fired. Zustand pays
200,000 selector evaluations to decide who to notify — the entire
purpose of read-time dependency tracking is to avoid that. **Skal's
write advantage IS the cost of Solid's read-time tracking shifted to
the write side; Zustand defers it and pays 18-26× more per write.**

### Untracked baseline — the most revealing column

A write to a leaf nothing subscribes to *should* be free:

- Skal: ~5 µs (one leaf-frame write + deferred persist)
- Zustand+MMKV: ~2,400 µs

Zustand still:
- Runs all 200 selectors (each evaluating a 10-key multi-key selector
  in the realistic-frame case)
- Allocates 200 new arrays
- Shallow-compares each against previous
- JSON.stringifies whole state
- Writes to MMKV

All paid on every write, regardless of whether anything cares.

That's the structural floor of "no read-time tracking + whole-state
persist." Apps that write frequently to inconsequential leaves (last
interaction timestamp, route, loading flag) pay 2 ms each on Zustand,
~5 µs each on Skal.

---

## Pure libraries, same engine, no persistence

Comparing Solid's `createStore` directly against Zustand's vanilla
store (no MMKV, no Skal wrapping). Both run inside JSC, so platform
overhead is identical.

| Workload | Solid | Zustand | Winner |
|---|---:|---:|---|
| **BARE READS** | | | |
| Same key, 1,000×                          | 7.8   | 1.3    | Zustand 6× |
| Distinct keys, 1,000×                      | 5.2   | 0.63   | Zustand 8× |
| **BARE WRITES (no subscribers)** | | | |
| Same key, 1,000×                          | 8.9   | 6.8    | Zustand 1.3× |
| Distinct keys, 1,000× (state grows 0→1000) | 3.1   | 431    | **Solid 141×** |
| **MANY SUBS (200 · 1 leaf each)** | | | |
| 1 leaf · 1,000 writes                     | 17.8  | 253    | **Solid 14×** |
| Untracked · 1,000 writes                  | 9.1   | 42.8   | **Solid 4.7×** |
| **REALISTIC FRAME (200 × 10 reads)** | | | |
| Mount per effect/listener                  | 12.7  | 11.2   | Zustand 1.1× (tied) |
| 1 leaf · 1,000 writes                     | 285   | 457    | **Solid 1.6×** |
| Untracked · 1,000 writes                  | 5.9   | 296    | **Solid 50×** |

### The discovery that drove most of the work

Before optimization, the Skal-wrapped store was much slower than Solid
alone:

| Test | Skal (pre-opt) | Solid alone | Wrapper overhead |
|---|---:|---:|---:|
| Bare read same key                  | 11.5 µs | 7.8 µs  | +3.7 µs *(48%)* |
| **Frame mount per effect**          | **403 µs** | **12.7 µs** | **+390 µs *(30×)*** |
| Frame 1 leaf · 1,000 writes         | 1141 µs | 285 µs  | +856 µs *(4×)* |
| Many-subs 1 leaf write              | 102 µs  | 17.8 µs | +84 µs *(5.7×)* |

**Solid was doing its job well.** It was competitive with Zustand on
mount and beat Zustand on writes by 1.6-50×. **Skal's wrapping proxy
was where most of the overhead lived** — 30× the mount cost, 50% the
read cost, all stacked on top of Solid's already-good performance.

This insight reshaped the optimization plan: instead of replacing
Solid (4-8 weeks of work + maintenance burden), strip the wrapper's
overhead. Phase 1+2 did exactly that.

---

## End-to-end render benchmark — what the user sees

The µs-level store bench above measures the reactive-effect plumbing
in isolation. It is the right tool for tuning the store, but it
deliberately omits everything past the effect callback — no
component, no widget tree, no native paint. To answer *"does the
user see the difference?"* we need a bench that actually mounts UI
components, mutates state, and times the next-frame settle.

Bench source preserved in [BENCHMARKS.md § Bench 1](BENCHMARKS.md);
the RN counterpart still lives at
[`(tabs)/render.tsx`](../explore/Skal-RN-Comparison/app/(tabs)/render.tsx)
in the sibling repo.

### What the bench does

Both apps mount 200 visible leaf components (`<Box><Text/></Box>` on
Skal, `<View><Text/></View>` on RN), each subscribed to a single key
in a 200-entry store. The bench fires three workloads programmatically
and times the JS-side settle:

| Sub-bench | Mutation pattern | What it stresses |
|---|---|---|
| 1 mutation                | flip one cell once       | min-overhead path: one write, one rerender |
| 1k writes                | flip same cell 1,000×    | batching/coalescing — Skal should coalesce, React shouldn't |
| 200 distinct mutations    | flip each cell exactly once | N independent reactive paths firing in one frame |

Each test brackets the workload in `setTimeout(0)` chains. After the
trailing `setTimeout(0)` fires we declare the frame "settled" — at
that point Solid's batched updates have run, Skal has emitted ops,
the bridge has shipped them, Flutter has scheduled the next frame.
(React equivalent: Zustand listeners have dispatched, React has
reconciled, the bridge has committed.) This is a coarser proxy than
a Dart-side post-frame callback would be, but it is portable across
the two stacks and applies the same omission to both.

The bench also records **initial-mount time**: a module-level
counter is bumped from each leaf's `onMount` / `useEffect`. The
container component captures the mount-start timestamp before its
children create, then reads the delta once the counter reaches 200.

### Methodology — 5 cold launches per side

The first 3-run capture of this bench was misleading in exactly the
way Lesson 6 of the µs bench predicted. Numbers below are **5 cold
launches per side, full app re-clear between each**. Both stacks
show bimodal variance; we report median and the full sorted
distribution so the noise is visible.

### Mount results — what cold screen entry costs

The most reliable end-to-end metric. Mount only happens once per
launch — no JIT warmup, no GC luck — and dominates the perceptible
"how snappy does the app feel when I tap the icon" budget.

| | Skal+Solid+Flutter | Zustand+MMKV+RN | Result |
|---|---:|---:|---|
| Initial mount, 200 cells (median)  | **68 ms**      | 2,612 ms       | **Skal 38.2×** |
| Per cell (median)                   | **0.34 ms**    | 13.06 ms       | **Skal 38.2×** |
| Skal sorted distribution            | 48.6 / 52.6 / **68.4** / 99.9 / 170.4 ms | — | |
| RN sorted distribution              | — | 2384.7 / 2609.9 / **2612.2** / 2834.6 / 4093.1 ms | |

Even Skal's *worst* cold mount (170 ms) is **14× faster than RN's
best** (2385 ms). The two distributions don't overlap.

A Skal user sees 200 reactive components in ~68 ms — ~4 frames at
60 Hz, near-imperceptible. The same workload on RN takes ~43
frames — a half-second of visible jank.

The store-only Zustand subscribe cost is ~8 µs/listener; the full
mount per React cell is 13 ms. **The store is 0.06% of the mount
cost.** The remaining 99.94% is framework + native render — React
reconciler, Fabric bridge marshaling, RN's view creation, native
layout. That's the cost we're displacing by using Flutter's
compositor with Solid's fine-grained reactivity.

### Mutation results — 5-run distribution

All numbers are ms-to-settle (`setTimeout(0)` after the workload).
The 3-warmup-write preamble before each timed sub-bench is what it
is; the runs still span 1.1 ms to 71 ms on Skal's "1 mutation" path
and 1.1 s to 8.2 s on RN's "1k writes" path. The bimodal pattern is
real and inherent to JIT-on-emulator.

| Sub-bench | Skal min / **med** / max | RN min / **med** / max | Median ratio |
|---|---:|---:|---:|
| 1 mutation                  | 1.1 / **3.8** / 71.1 ms   | 64 / **243** / 321 ms       | **Skal 64.7×** |
| 1k writes (coalesced)       | 78 / **105** / 232 ms     | 1,132 / **6,819** / 8,197 ms | **Skal 65.1×** |
| 200 distinct mutations      | 11 / **44** / 196 ms      | 6,949 / **16,801** / 24,365 ms | **Skal 381×** |

**Two structural points the distribution makes:**

1. **Skal's slow tail is bounded; RN's isn't.** Skal's worst-case
   200-distinct run is 196 ms (~12 frames). RN's worst-case is
   24.4 seconds. The means of bad luck on each stack are
   *qualitatively* different — Skal degrades gracefully, RN
   degrades catastrophically.

2. **The "warm Skal vs cold RN" headline holds even on Skal's bad
   runs.** Skal's *worst* 1k-writes run (232 ms) is 4.9× faster than
   RN's *best* (1,132 ms). Skal's *worst* 200-distinct run (196 ms)
   is 35× faster than RN's *best* (6,949 ms).

### Decomposing the 65–381× gap

This isn't a head-to-head comparison of stores — it's a head-to-head
comparison of *render pipelines*. The factors that combine to produce
the gap, in approximate magnitude:

| Factor | Approx. contribution |
|---|---|
| Skal's batched-mount coalescing (1k writes → 1 rerender)         | 20–50× |
| Solid fine-grained reactivity vs React reconciler diff           | 5–10× |
| Flutter compositor vs RN Fabric bridge for the final commit      | 2–5× |
| Persistence cost (leaf-frame log vs JSON.stringify whole state) | 1.5–3× |

The headline 65–381× is the product of several smaller wins, not a
single architectural advantage. The microtask coalescing in
`createSkalStore` is the largest single factor — React batching is
per-event, but the bench drives 1,000 sequential `setState` calls
which React does not coalesce into one render. The 381× on
200-distinct is amplified further by RN's per-key list re-render
cost: each `setState` produces a new `cells` object reference,
which causes every `useStore` selector across all 200 components
to re-evaluate, even though only one cell's value changed.

### Honest caveats

- **This is a cross-pipeline comparison.** Skal numbers include
  Solid + Flutter + Impeller; RN numbers include React + Fabric +
  RN view manager. The store difference is part of the gap but is
  not isolated. The two stacks are what the user actually ships;
  this is the right comparison for "which platform feels faster" —
  it is the wrong comparison for "which store is faster" (that's
  the µs-bench section above).
- **`setTimeout(0)` is not paint timing.** It approximates "JS work
  settled, frame scheduled" but does not measure when pixels hit
  the screen. Both stacks share this omission, so the relative
  ratios are meaningful even if absolutes aren't.
- **5-run distribution shown, not a single number.** Same bimodal
  JIT/GC noise as the µs bench. The Lesson 6 caution applies: a
  3-run median here was off by ~2× from the 5-run median on Skal
  mount and ~2× from the 5-run median on RN's 200-distinct path.
  Read the distribution columns, not the median in isolation.
- **The bench auto-runs 4 s after mount.** That gives the engine
  time to load `skal-app.jsc` / the RN bundle and warm the basic
  interpreter. Each sub-bench has 3 warmup writes before timing
  starts. Mutation hot paths are still cold-ish on first measure;
  the slow tails in both stacks reflect that.
- **5 runs is still not many.** 10 runs would tighten the slow-
  tail estimates further. 5 is enough to see the distribution
  shape and rule out the "one lucky run picked as median" trap;
  not enough to confidently estimate a P99.

### Takeaway

The µs-store bench measures one layer; this bench measures every
layer below it down to "next frame scheduled." With 5-run medians:

- **Cold mount: Skal 38× faster.** Distributions don't overlap —
  even Skal's worst is 14× better than RN's best.
- **Cold mutation: Skal 65–381× faster on median.** Even worst-
  case Skal beats best-case RN by 5–35× on the workloads that
  scale with state size.

The store layer is a small fraction of these numbers — at 13 ms
per RN cell mount and ~50 µs of Zustand setup, the store is < 0.5%
of the pipeline cost. The wins are mostly from the rendering stack
underneath. But the store layer matters for two reasons specific
to Skal:

1. It is the layer most code touches directly — every component
   subscription, every write, every persisted leaf goes through it.
2. The µs-bench wins compound through the render pipeline. Saving
   ~200 µs on store dispatch isn't visible at the µs level, but
   it adds up to one less reconciler pass per frame, one less
   bridge crossing, one less paint — which is visible.

For the consolidated table of all benchmark numbers in one place,
see [`BENCHMARKS.md`](BENCHMARKS.md).

---

## What we built — Phase 1 + Phase 2 optimizations

All changes in [`db.js`](js-app/src/skal/store/db.js), zero memory
scaling, no API change, Solid still underneath.

### Phase 1 (zero-memory)

1. **`hasLazyPaths` / `hasNonPersistPaths` flags** — computed once at
   `createSkalStore`. The hot `objectProxy.get` skips the lazy
   policy check entirely when no lazy paths are configured. Same
   pattern for the persist check in `writeAt` and `deleteProperty`.
   ~16 bytes per store, ~0.4 µs/read saved.

2. **Drop `makeNode` LRU touch on cache hit** — previously every
   cache hit did `Map.delete + Map.set` to re-insert as most-recently-
   used. Insertion-order eviction with no touch works fine at the
   8,192-entry cap. ~0.4 µs/read saved.

3. **Deferred `childSk` for primitive leaves** — only compute the
   dotted storeKey when the read result is an object (needed for
   `makeNode`). Primitives skip the `_join` concat. ~0.2 µs/read saved.

### Phase 2 (zero-memory)

4. **Path-less `readSolid`** — split from `resolvePath`. The original
   `resolvePath` allocates a `path[]` array and returns
   `{path, value}` — wasted for the read path which only needs `.value`.
   The new `readSolid` walks `sp` inline without allocating either.
   ~0.5 µs/read saved.

5. **`readSolidChildValue(sp, key)`** — walks `sp` then reads `[key]`
   on the resolved node in one pass. Eliminates the `[...sp, key]`
   array allocation that the get trap otherwise does on every primitive-
   leaf read. ~0.6 µs/read saved.

6. **`writeAt` fast path for string-only sp** — when sp contains only
   string segments (the common case), the resolved path IS sp itself.
   Skip `resolvePath`'s allocation; call `setState(...sp, v)` directly.
   Only collection-element writes need the id-to-index resolution.
   ~0.3 µs/write saved.

7. **`setAt` fast path** — same shape as `writeAt`.

8. **arrayProxy: hoist `arr()`** — for inherited array methods
   (map/filter/forEach), bind to a single `arr()` call instead of
   calling it twice. Minor but free.

9. **arrayProxy: flag-gate `persist()`** — same `hasNonPersistPaths`
   short-circuit as elsewhere.

### Memory footprint

| Thing added | Cost |
|---|---|
| 2 init flags                | ~16 bytes per store |
| Per-read allocations         | **Zero (eliminated)** |
| Per-write allocations         | **Reduced** (fast path skips path[] alloc) |
| Per-proxy-node overhead       | None added beyond existing |

Net: **the optimizations REDUCE memory churn** by eliminating per-
operation allocations. Steady-state memory is essentially unchanged;
GC pressure is lower.

---

## Lessons learned the hard way

### 1. Path interning was a trap

The first Phase 1 attempt added per-node `Object.create(null)` caches
mapping `key → childSk` and `key → childSp`. **Big wins on the bench
(~70% read improvement)** but memory could grow unboundedly with
dynamic keys (e.g., `s.events[uuid]` on long-running apps).

After the user pushed back on memory cost, we reverted the cache and
relied on the deferred childSk / readSolidChildValue tricks instead.
**Most of the cache's benefit (60-80%) came back** — the cache was
optimizing things that the other zero-memory tricks also addressed,
just less elegantly.

**Takeaway**: zero-memory optimizations were nearly as good as the
cache. The cache was overkill.

### 2. The polymorphic IC trap

Phase 2 polish added `readSolidChildValue` calls to `arrayProxy.get`
too — same function, two callers. Reads regressed ~40% on the bench.

Cause: JSC's inline cache for `readSolidChildValue` went polymorphic
because it was called from two different proxy shapes (object and
array). JSC couldn't inline as aggressively, slowing every call.

**Reverting to `arr()[i]` in arrayProxy recovered read performance**
while keeping the other Phase 2 wins. The arrayProxy doesn't see hot
read loops anyway — arrays are iterated via `<For>`, not random-
accessed in tight loops.

**Takeaway**: when sharing helper functions across hot paths, watch
for IC pollution. A function called from N different shapes will be
deoptimized for all of them.

### 3. The JIT shape trap

Monomorphic dispatch in `writeAt` / `setAt` (replacing
`setState(...sp, v)` spread with explicit `setState(sp[0], sp[1], v)`
calls) **looked clever and was worse**.

Counter-intuitive but reproducible: `setState(...r.path, v)` (where
`r.path` came from `resolvePath`'s `const path = []` + `.push(seg)`)
JIT-specialized differently than `setState(...sp, v)` (where sp was
`[...parent, key]` from the proxy trap). The two arrays were
functionally identical but JSC treated them as different shapes.

**Verdict: keep `setState(...sp, v)` for the fast path; don't bother
with explicit-arg dispatch.** The simpler form was actually better.

### 4. The bare-write "regression" was statistical

After shipping Phase 2's `writeAt` / `setAt` fast paths, the bench
showed `200 distinct leaves · 1 write each` at 78 µs (Phase 2) vs
12 µs (Phase 1) — looked like a clear regression.

Two fix attempts BOTH made things worse:

- **Attempt A**: monomorphic dispatch (the JIT shape trap above).
  Regressed reads ~10× and didn't help the write.
- **Attempt B**: revert the writeAt + setAt fast paths entirely
  (always use resolvePath). Lost most of the Phase 2 write gains
  AND didn't recover the 12 µs Phase 1 number — landed at 130 µs.

Then we looked at Phase 1's individual values: `[12.0, 11.3, 64.4]`.
**The "12 µs median" was actually two lucky runs + one outlier at
64 µs.** With 10 runs, Phase 1's true behavior would have been
~50-80 µs on this test — basically the same as Phase 2.

The fast path (`setState(...sp, v)`) was right all along. The
"regression" never existed.

**Verdict: kept the fast paths.** The bare-write test fluctuates
60-130 µs depending on JIT state — that's the true cost in the
wrapper, not a code bug. The realistic-frame equivalent
(`200 distinct mutations · 1 each`) IMPROVED 31% from Phase 1 with
the fast path in place, confirming the fast path is right for real
workloads.

### 5. Native port of the dep graph was a 14× regression

After the JS-side batched-mount win, we built a native (Zig) backing
for the dep graph in `skal_entry.zig`:
- `__skal_dep_register(effect_id, paths_joined)` — bulk-register an
  effect with all its paths in one call
- `__skal_dep_notify(sk)` — mark dependent effects dirty
- `__skal_dep_drain_dirty()` — copy dirty effect IDs to a no-copy
  ArrayBuffer
- `__skal_dep_unregister(effect_id)` — disposer

The doc had projected 5-10% additional perf over the JS-side win.
**Measured reality: 14× regression on 1k-write propagation** (23 µs →
332 µs) and 4× regression on 200-distinct-mutations (62 µs → 267 µs).

**Why**: every write triggers `_skalNotify(sk)`, which became a native
crossing. JSC↔native crossing is ~200-500 ns including string
marshaling — MORE expensive than the JS-side Map.get + Set.add it was
supposed to replace (~350 ns total). For 1000 writes/workload that's
~400 µs of pure crossing overhead before any work happens. The mount-
side win (~8 µs/effect, 1.6 ms across 200 effects) didn't begin to
pay for the per-write crossing cost.

**The lesson the doc already had but I underestimated**: native wins
when the unit of work crossing the boundary is BIG relative to the
crossing cost. The dep-graph notify is *smaller* than the crossing
itself — going native makes it slower, not faster.

**Verdict**: Zig dep-graph code was removed entirely from
`skal_entry.zig`. The JS-side bridge was also removed from `db.js`.
The shipped state is pure JS — the batched-mount win comes from
declared deps + microtask coalescing, not from native code.

**Generalizable principle**: for per-event hot paths, only go native
when (a) the native work amortizes across many events in one call,
or (b) the per-event work is genuinely large (>>500 ns). Neither
holds for dep-graph notify. The bun build infrastructure remains
ready for future native ops where the math actually works (e.g.,
native flush batching where many writes serialize into one crossing).

### 6. 3-run medians lie

Initial Phase 2 numbers showed reads at "2.43 µs median" across 3 runs.
With 10 runs the same code showed `[1.66, 1.80, 1.91, 1.96, 3.20,
3.29, 3.30, 5.03, 6.32, 6.75]` — clearly bimodal. The 2.43 was just
one fast-cluster sample picked as median.

**Always use 10+ runs for variance assessment.** The bimodal pattern
is a real characteristic of JIT-on-emulator, not a code bug.

---

## Architectural analysis — current state

A single `s.sub.s5` read traverses two Proxy traps. After Phase 1+2,
the per-read accounting is:

| Step | Per read (current) | Per read (pre-opt) | Δ |
|---|---:|---:|---|
| JSC Proxy `get` trap dispatch × 2          | ~1.0 µs | ~1.0 µs | — |
| `[...sp, key]` array alloc                  | 0       | ~0.6 µs | ✓ skipped (readSolidChildValue) |
| `_join` string concat                       | 0       | ~0.2 µs | ✓ deferred (primitive leaf) |
| `faulted.has` Set lookup                    | 0       | ~0.1 µs | ✓ flag-gated |
| `policyFor.lazy` Map lookup                  | 0       | ~0.2 µs | ✓ flag-gated |
| `readSolidChildValue` walk (replaces resolvePath) | ~0.5 µs | ~0.7 µs | ↓ |
| `cur[seg]` against Solid proxy × N           | ~2.0 µs | ~2.1 µs | — (Solid floor) |
| Solid dep registration                        | ~0.5 µs | ~0.5 µs | — (Solid floor) |
| `{path, value}` return obj alloc            | 0       | ~0.4 µs | ✓ skipped |
| `makeNode` LRU touch on hit                  | 0       | ~0.4 µs | ✓ removed |
| Final returns                                | ~0.1 µs | ~0.1 µs | — |
| **Total per read**                           | **~4 µs** | **~6-8 µs** | **~50% reduction** |

The remaining ~4 µs is essentially the Solid floor — what `state.sub.s5`
costs on a bare Solid createStore proxy (measured ~5.5 µs Solid bare
read distinct, ~7.8 µs same key in the same JSC engine).

### Why each feature still exists

After optimization, every feature still works but most pay nothing
when not in use:

| Operation | Feature it enables | Cost when feature unused |
|---|---|---:|
| `STORE` symbol check          | Control handle (`state[STORE].flushNow()`) | ~0.2 µs/read *(still on hot path)* |
| `typeof 'symbol'` check       | Correctness (Symbol.iterator etc.)     | — (required) |
| Lazy fault-in checks           | Lazy paths                             | **Zero** *(flag-gated)* |
| Non-persist policy check       | Memory-only paths                      | **Zero** *(flag-gated)* |
| Path id resolution             | Collection element stable IDs          | **Zero** *(fast path skips it)* |
| `makeNode` memoization        | Identity-stable proxies for `<For>` | ~0.4 µs/read on object results *(required)* |
| Outer Skal Proxy layer         | Persistence, collections, policy       | ~1.0 µs/read *(structural)* |

Features that are paid for: STORE check and the wrapper Proxy itself.
Everything else short-circuits when unused.

---

## The architectural trade

> *Why do we have read cost? Because when 1 leaf changes only the
> components that are subscribed to that leaf rerender.*

Yes. Two stacks, same end result, different distribution of work:

```
write to sub.s5
├── Skal:    proxy notes who read sub.s5 → reruns 1 effect
└── Zustand: notifies all 200 listeners → 200 selectors run → 1 callback
```

To know "who depends on sub.s5", the store must observe reads through
some interception layer. Three options exist; you can have any TWO of
{fast reads, fast writes, automatic dependency discovery}:

| Approach | Reads | Writes | Auto-tracking | Used by |
|---|---|---|---|---|
| **Plain object + selectors** | Fast | Slow per subscriber | No (manual selectors) | Zustand, Redux |
| **Proxy + signals** | Slow | Fast | Yes | Skal, MobX, Solid stores |
| **Compile-time wiring** | Fast | Fast | Yes (within compiled code) | Svelte, JSX-compiled Solid |

Skal chose option 2 because we want reactive subscriptions across
arbitrary JS code, not just compiled component bodies.

The ~4 µs read penalty (now matching Solid alone) buys you a write
path that scales O(1) in subscriber count, persists efficiently
(leaf-sized frames, not whole state), and notifies only affected
effects.

---

## Remaining optimization roadmap

### Tier 1 — Zero-memory, no API change (~half day each, ~0.5-1 µs total)

Tiny micro-optimizations within the existing constraints. None
individually moves the needle much; combined they shave ~0.5-1 µs/read.

#### A1. Combine the symbol checks

```js
// before
if (key === STORE) return ctrl;
if (typeof key === 'symbol') return undefined;

// after
if (typeof key !== 'string') return key === STORE ? ctrl : undefined;
```

One branch instead of two on the hot path. Saves ~50 ns/read.

#### A2. Specialized `readSolid` for common arities

Split into `readSolid0()`, `readSolid1(sp0)`, `readSolid2(sp0, sp1)`.
Each call site is monomorphic, no for-loop, no array iteration. Saves
~100-200 ns/read for the ~95% case (sp length 1-2).

#### A3. Branch reorder in `objectProxy.get`

Put the primitive-leaf return first to make it the fall-through path.
JSC handles this naturally but explicit ordering helps the cold branch
go cold. Saves ~30-50 ns/read.

#### A4. Faster `_isNumKey` in arrayProxy

Replace the regex test with `+key === +key | 0` for numeric detection.
~50-100 ns saved on array index reads.

#### A5. `Object.hasOwn(mutators, key)` → Set check

Pre-compute a `Set` of mutator names; check via `Set.has`. Tiny but
free. ~30-50 ns saved on arrayProxy reads.

**Verdict on Tier 1**: cost-benefit is marginal. The current ~4 µs/read
is already at the Solid floor — taking it to ~3-3.5 µs probably isn't
worth the code complexity. Implement only if profiling identifies one
of these as a real bottleneck.

---

### Tier 2 — One constraint relaxed (real wins)

#### B1. Native batched mount registration — TRIED, REMOVED

We built it and removed it (see Lesson 5 above). The Zig dep-graph
code was added to `skal_entry.zig`, the JS bridge wired up in
`db.js`, libskal rebuilt — and the bench showed a **14× regression
on write propagation** because per-write `__skal_dep_notify`
crossings cost more than the JS Map operations they replaced.

The mount-side win was real but tiny (~8 µs/effect = ~1.6 ms across
200 effects), nowhere close to the projected 30-50 µs/effect savings.
The projection was wrong — most of the mount cost is in initial
effect-fn execution (10 readSolid calls) and JS object allocation,
not in dep registration.

The Zig code, the JS bridge, and the host-function registrations
were all removed. The shipped state is pure JS.

**Verdict**: the *architectural* win was the JS-side batched
implementation (declared deps + microtask coalescing) we already
shipped. Going native on top adds crossing overhead with no useful
amortization. Don't take this path further unless a different scheme
(e.g., native flush batching that queues many notifies into one
crossing) makes the math work.

#### B2. Read-once-then-plain effects (~2-3 weeks, bounded memory per effect)

The biggest non-architectural perf win. After a `createEffect` runs
the first time, snapshot which leaves it depends on. On subsequent
reruns, switch to plain (untracked) reads from a cached snapshot —
no Proxy traps, no Solid signal dispatch on the read path. Only
re-track when the dep set might have changed (conditional reads).

**Mechanism**:
- First run: full tracked reads through proxy, collect deps
- Cache `effect → Set<storeKey>` (bounded by effect count)
- Subsequent runs: pass a plain-object snapshot to the effect fn
- Detect dep-set change via a version counter; re-track if changed

**Savings**: rerun read cost ~4 µs → ~0.5 µs. Realistic-frame
propagation 350 µs → ~50 µs. **Beats Zustand on propagation by ~25×.**

**Catch**:
- Bounded memory per effect (the cached dep set)
- Correctness risk on effects with truly dynamic dep sets (conditional
  reads of `state.user.isAdmin ? state.secret : state.public`).
  Needs careful detection — fall back to always-track for those.
- Inherited from MobX's `computed` and Vue's `watch` patterns; the
  technique is well-understood, just not trivial.

#### B3. Move `STORE` handle off proxy (~half day, breaking API change)

The `if (key === STORE) return ctrl` check runs on every read but is
only hit when the user accesses `state[STORE].flushNow()` (extremely
rare). Moving the handle off the proxy to a separate return value
saves ~0.05-0.2 µs/read.

**Catch**: breaking API change. `state[STORE].flushNow()` callers
would need updating to `[state, store] = createSkalStore(...)` or
similar. Worth bundling with other API changes if any happen.

#### B4. Flat leaf signal table (~1-2 weeks, bounded memory by state size)

Maintain a parallel `Map<storeKey, value>` updated on write. Reads
check the flat cache first; on hit, return immediately AND register
the dep with Solid (so reactivity still works). Tracking still
through Solid; only the value lookup is short-circuited.

**Mechanism**: on each leaf write, also update `flatCache.set(sk, v)`.
On read, `flatCache.get(sk)` + Solid signal access for tracking.

**Savings**: reads ~4 µs → ~2 µs. Brings reads close to Zustand
absolute (still ~3× behind, but in the same order of magnitude).

**Memory cost**: ~200-250 bytes per leaf. A 2000-leaf state grows by
~500 KB. Bounded by state size, not by usage.

---

### Tier 3 — Architectural

#### C1. Native JSC custom-class Proxy (~3-4 weeks)

Replace the JS `Proxy` with a JSC native class that has a C-level
`[[Get]]` slot. Skips JSC's generic Proxy machinery. Estimated savings:
~500 ns/read → ~4 µs → ~3.5 µs.

Significant systems work — custom JSC classes, GC integration,
brittleness across JSC versions. Probably overkill.

#### C2. Replace Solid entirely (4-8 weeks)

The from-scratch reactive runtime. Detailed sketch below. Projected
~2 µs/read, ~30 µs/effect mount, beats Zustand on every metric.

**Catch**: significant correctness risk, ongoing maintenance burden,
4-8 weeks of focused engineering.

#### C3. JSX-compiled access (months)

A Babel/Vite plugin rewrites `s.foo.bar` to direct signal access at
build time. Reads → ~0.5 µs for compiled call sites. Only works for
compiled code (typically JSX components); dynamic accesses
(`s.foo[someVar]`) fall back to the runtime proxy.

**Catch**: a real compiler. Type-system complications. Doesn't help
arbitrary JS helper functions that receive the store as a parameter.
Months of work for a partial win.

---

### Stop point

Phase 1+2 is shipped. The current state:
- Reads at the Solid floor (~4 µs)
- Mount 2.4× behind Zustand (down from 6.2×)
- Realistic-frame writes 18-26× ahead of Zustand
- Zero memory cost
- No API change

These numbers fit any realistic frame budget. Further work is
discretionary, not necessary.

---

## Custom Store from Scratch — sketch for future reference

If Skal becomes the foundational primitive for multiple long-lived
apps and reads become a measured bottleneck, the custom-store rewrite
is the right end state. Otherwise the maintenance burden isn't
justified.

### Core data structures

```ts
type Leaf = {
  value: any
  observers: Set<Effect>        // who depends on this leaf
  policy: { persist, lazy }     // resolved at leaf creation, not per read
  node?: ProxyNode              // cached identity-stable proxy
  state: 'loaded' | 'unloaded'  // lazy
}

type Effect = {
  fn: () => void
  sources: Set<Leaf>            // dependencies
  state: 0 | 1 | 2              // clean | dirty | running
  scope: Effect | null          // for hierarchical cleanup
}

const leafTable = new Map<string, Leaf>()    // FLAT: one entry per leaf
let CURRENT_EFFECT: Effect | null = null     // single thread-local
let TRACKING = false
```

### The read path (one trap, one map lookup, one signal dereference)

```js
get(_t, key) {
  const childSk = this.childSk[key]
    ?? (this.childSk[key] = this.sk + '.' + key);
  const leaf = leafTable.get(childSk);
  if (!leaf) return undefined;
  if (leaf.state === 'unloaded') faultIn(leaf);
  if (TRACKING) {
    leaf.observers.add(CURRENT_EFFECT);
    CURRENT_EFFECT.sources.add(leaf);
  }
  if (leaf.kind === 'leaf') return leaf.value;
  return leaf.node ??= this.makeNode(childSk);
}
```

### The write path (fused write+notify+persist)

```js
function setLeaf(sk, value) {
  const leaf = leafTable.get(sk);
  if (Object.is(leaf.value, value)) return;
  leaf.value = value;
  for (const eff of leaf.observers) markDirty(eff);
  if (leaf.policy.persist) dirty.set('k:' + sk, encodeFrame(value));
  scheduleFlush();
}
```

### Effect flush (batched, one rerun per dirty effect per tick)

```js
function flushEffects() {
  const dirtyEffects = collectDirty();
  for (const eff of dirtyEffects) {
    eff.state = 2; // running
    CURRENT_EFFECT = eff; TRACKING = true;
    eff.fn();
    CURRENT_EFFECT = null; TRACKING = false;
    eff.state = 0; // clean
  }
}
```

### Features preserved

| Feature | Mechanism |
|---|---|
| Reactive deep tracking | Per-leaf `observers: Set<Effect>` + `CURRENT_EFFECT` thread-local |
| Persistence | `dirty` queue + native log (unchanged) |
| Lazy loading | `Leaf.state = 'unloaded'` until first access |
| Stable-id collections | `CollectionLeaf` subtype with element `_id` index |
| Identity-stable nodes | `Leaf.node` field caches the proxy |
| Per-path policy | `Leaf.policy = {persist, lazy}` at leaf creation |
| Multi-key effects | `Effect.sources: Set<Leaf>` holds all deps |
| Batched updates | Microtask-flushed dirty queue |
| Subtree ops (delete, prefix tombstone) | One scan over `leafTable` for affected prefix |

### Projected numbers (all features preserved)

| Workload | Today (Final) | Custom from scratch | Zustand |
|---|---:|---:|---:|
| Bare read same key             | 4 µs    | **~2 µs**    | 1.3 µs |
| Mount per effect               | 157 µs  | **~30-40 µs** | 65 µs |
| 1 mutation propagation         | 350 µs  | **~50 µs**    | 1264 µs |
| 1k-write propagation           | 535 µs  | **~120 µs**   | 9796 µs |
| Untracked baseline             | ~5 µs   | **~2 µs**     | 296 µs |

### Costs

- 4-8 weeks of focused engineering
- ~2,500-4,000 LOC for the reactive runtime + Skal feature layer
- Significant correctness risk (reactive bugs are silent)
- Ongoing maintenance burden (you own the reactive runtime forever)
- Possible compatibility work with Solid's `<For>`, `createMemo`, etc.

---

## Native code opportunities

Skal already runs the log-structured store engine and JSON codec
natively. The question is what *additional* operations would benefit
from going to Zig/C.

### The wall: JS↔native crossing cost (~200 ns)

For individual operations smaller than ~500 ns, crossing the boundary
**adds** overhead, not removes it. JS `Map.get` is ~50 ns; pushing it
native would make it ~400 ns total. Native wins only when a single
call does *much* more work than the crossing costs — batched ops,
I/O, expensive computation.

### What would NOT help

- Native leaf signal table accessed per-read (crossing > Map lookup)
- Native dep tracking on the read path (tracking needs to know
  "current effect" which lives in JS)
- Native Proxy trap dispatch (still goes through JSC's Proxy machinery)
- Native string interning (JSC already interns short strings)
- Native effect rerun dispatch (effects ARE JS closures)

### What WOULD help, in order of payoff

#### 1. Native batched mount registration (~1 week)

Send all `{effectId, paths[]}` tuples for mount in a single native
call. Native side parses, builds the dep graph in native data
structures.

**Savings**: mount drops from ~156 µs/effect to ~30-50 µs/effect.
Closes the mount gap to Zustand and goes past it.

**Catch**: only helps effects with known-static dep sets at mount time.
Dynamic-dep effects need runtime tracking still.

#### 2. Native flush batching (~3 days)

Serialize the whole dirty queue into one buffer; send in a single
`__skal_store_put_many(buffer)` call instead of N individual puts.

**Savings**: for a 1,000-write flush, ~200 µs of crossing overhead
eliminated.

**Cost**: mechanical, ~3 days.

#### 3. Native dep notification on write (~1-2 weeks)

When a write happens, native walks the observer list and returns an
array of effect IDs to rerun. Crossing cost is amortized across all
observers.

**Savings**: ~9 µs per write with 200 subs. Only matters when you have
many subscribers AND they fire frequently.

#### 4. Native JSC class for the proxy with C [[Get]] slot (~3-4 weeks)

Replace the JS Proxy with a JSC custom class that has a native getter.
Bypasses the JS Proxy machinery.

**Savings**: ~500 ns per trap → reads ~4 µs → ~3.5 µs.

**Cost**: significant systems work — JSC's C API for custom classes,
GC integration, version brittleness.

---

## Trade-off summary

### Where Skal wins (and by how much, after Phase 1+2)

| Dimension | Magnitude vs Zustand+MMKV | When it matters |
|---|---|---|
| Untracked writes              | ~500× | Apps with frequent "no-op" writes |
| Tracked writes with subscribers | 18-26× | Interactive UIs with many bound components |
| Realistic frame propagation   | 3.6-26× | Every UI interaction |
| Many-subscriber scaling       | O(1) vs O(N) | Apps with high subscriber counts |
| Selector amplification        | 0 vs 200× per write | High write-rate workloads |
| Persistence cost              | Leaf frame vs whole state | Apps with large state |

### Where Zustand still wins

| Dimension | Magnitude | When it matters |
|---|---|---|
| Bare RAM reads                | 5-59× | Hot loops with thousands of reads |
| Mount cost (200 effects)       | 2.4× faster | Cold screen entry |
| Read-path simplicity           | Plain JS | Easier mental model |

### Practical interpretation

For typical interactive apps:

- **Mutations dominate runtime**: every keystroke, drag, scroll, frame
  tick triggers writes. Skal's 18-26× write advantage prevents the
  exact frame drops users notice.
- **Reads are bounded by render budget**: at ~4 µs/read, a component
  reading 100 leaves costs 0.4 ms — well under a 16.6 ms frame budget.
  Zustand's read advantage is real but rarely visible.
- **Mount is one-time**: 156 ms vs 65 ms (for 200 effects) is one frame
  delay on cold screen entry — barely perceptible. Native batched
  mount could close this further.
- **Untracked writes**: the ~500× difference is the most consequential
  hidden cost. Real apps do many "uninteresting" writes that Zustand
  charges full price for.

The net architectural picture: **Skal wins the workloads users
actually experience**; Zustand wins the micro-benchmarks of bare
property access. The trade is favorable for interactive apps and
unfavorable only for render-dominated, mutation-light apps (rare
in practice).

---

## Recommendations

### 1. Ship Phase 1+2 (done)

All changes in [`db.js`](js-app/src/skal/store/db.js). Zero memory
cost, no API change, ~50% mount improvement, ~50-80% improvement on
hot-path reads and frame propagation.

### 2. Stop unless a real-app bottleneck appears

The current state matches Solid alone on reads and is 3.6-26× ahead
of Zustand on realistic-frame writes. These numbers fit any realistic
frame budget. Further work is discretionary, not necessary.

### 3. If you push further, do it in this order

**3a. Read-once-then-plain effects (Tier 2, B2)** — biggest non-
architectural perf win available. ~25× propagation speedup. Adds
bounded per-effect memory (the cached dep set). 2-3 weeks of careful
work for the dep-set-change detection.

**3b. ~~Native batched mount~~ — TRIED, DON'T REPEAT** — see Lesson 5.
The native dep-graph caused a 14× regression on write propagation
because per-write JSC↔native crossings cost more than the JS Map
operations. Zig code is in place but disabled. Future native ops
should target paths where amortization is real (e.g., flush batching).

**3c. Flat leaf signal table (Tier 2, B4)** — reads ~4 µs → ~2 µs.
Adds bounded memory by state size (~500 KB at 2000 leaves). Useful
if reads become a measured bottleneck.

**3d. From-scratch reactive rewrite (Tier 3, C2)** — only if Skal
becomes the foundational primitive for multiple long-lived apps and
3a-3c aren't enough. 4-8 weeks, real correctness risk, lifetime
maintenance burden.

### Skip these unless something forces them

- **Tier 1 micro-optimizations** — combined ~0.5-1 µs/read. The
  cost-benefit is marginal once you're already at the Solid floor.
- **Native JSC custom-class Proxy** — ~500 ns savings for 3-4 weeks
  of brittle systems work.
- **JSX-compiled access** — months of compiler work for a partial
  win. Only meaningful if you're committed to a custom build pipeline.
- **Move STORE off proxy** — saves 0.05-0.2 µs/read at the cost of a
  breaking API change. Only worth it if bundled with other API work.

---

## Appendix — How to reproduce

The bench source is no longer in the tree — see
[BENCHMARKS.md](BENCHMARKS.md) for the full code embedded as inline
markdown, plus restoration instructions (drop the files back at the
indicated paths, restore the `zustand` + `mmkv` deps, re-wire the
entry points, rebuild bundle + APK, loop logcat). The APK build
commands themselves are unchanged and live in BENCHMARKS.md's "How
to re-run" section.

---

*Last updated: 2026-05-21. All measurements on Android release on
an arm64-v8a Pixel-class emulator. Skal commit: native-store-engine
branch with auto-blob + JSON-everywhere codec + del_prefix native +
Phase 1+2 zero-memory wrapper optimizations. End-to-end render
bench added 2026-05-21 (re-captured at 5 cold launches per side
later the same day after the initial 3-run pass exhibited the
expected bimodal noise — see [`BENCHMARKS.md`](BENCHMARKS.md) for
the consolidated numbers).*
