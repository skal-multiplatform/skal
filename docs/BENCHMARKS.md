# Benchmarks — Skal vs React Native

Every performance number Skal claims, in one place.

**Device:** Samsung Galaxy A14 5G (SM-A146P), Android 15, arm64-v8a.
Physical hardware, **release builds on both sides**, screen held awake
and asserted, runs interleaved, `pm clear` between cold starts.

**Opponent:** React Native 0.86 / Expo 57 — Hermes, zustand with
`subscribeWithSelector`, and MMKV. Brought to true WebCrypto parity with
`react-native-quick-crypto` where crypto is measured.

**Dates:** app-level 2026-07-31 · JS engine and reactivity 2026-08-01 ·
crypto 2026-08-03 · store 2026-08-04, Skal's column re-measured
2026-08-05 · store regression check 2026-08-16.

Checksums match across stacks on every state and storage row — a
mismatched checksum means the two stacks did different work and the row
is void.

---

## The short version

**Skal wins what happens continuously — frames, touch, idle, every state
update. It loses what happens once: cold start, bulk disk load, a single
crypto call.**

---

## What a user feels

| | Skal | React Native | |
|---|---:|---:|---|
| Dropped frames, scrolling an image feed | **0** | 13 | — |
| Scroll p95, image feed | **6 ms** | 12 ms | 2× |
| Input-latency events while scrolling | **0** | 631 | — |
| Tap → render, median | **3.53 ms** | 7.30 ms | 2.07× |
| Tap → render, p95 | **4.87 ms** | 10.24 ms | 2.10× |
| Idle CPU | **1.20%** | 6.93% | 5.8× |
| Background → resume, median | 60 ms | 62 ms | tie |

**Input responsiveness has three independent instruments agreeing** —
tap→render 2.07×, scroll input-latency 0 vs 631, and reactivity 18 vs 429
(below). That makes it the best-evidenced claim in this file.

### Scroll under JS load

500-row feed, identical gestures via `adb shell input swipe`, frame data
from `dumpsys gfxinfo`, one run per condition.

| JS load | Skal p95 | RN p95 | Skal input-latency frames | RN |
|---|---:|---:|---:|---:|
| none | 5 ms | 16 ms | **0** | 470 |
| 16 ms stall / 1 s | 5 ms | 14 ms | **0** | 312 |
| 300 ms stall / 1 s | 5 ms | 11 ms | **0** | 431 |
| 5 s stall / 6 s | 5 ms | 10 ms | **0** | 127 |

Skal's percentiles are identical across a **300× range** of JS load.

> ⚠️ Two caveats. This ran on a **different Skal app**
> (`com.skal.benchv2.skal`) — do not merge it with the table above. And
> RN's percentiles *improve* as load rises because it renders fewer
> frames, and a percentile over a shrinking population flatters the app:
> at the 5 s stall it is **Skal 387 frames vs RN 260** for the same
> gesture. At that magnitude frame count is the honest metric.

---

## State

The **realistic frame** is the row to read first: 200 components each
reading 10 leaves, then one mutation propagated to completion. It is the
only unit where the work is provably identical on both stacks.

| ms per op | Skal | React Native | |
|---|---:|---:|---|
| **Realistic frame** — 200 × 10 reads + 1 update | **0.05** | 0.797–0.847 | Skal 16× |
| 1 leaf, 0 subscribers | **0.0012–0.0016** | 0.1081 | Skal 79× |
| 1 leaf, 50 subscribers | **0.0356–0.0369** | 0.1851 | Skal 5.7× |
| 1 leaf, 200 subscribers | **0.1425–0.1447** | 0.2119 | Skal 1.5× |
| 200 leaves, 1 subscriber each | **0.63–0.66** | 38.15 | Skal 61× |
| No-op write (same value) | **0.0008–0.0009** | 0.0016 | Skal 1.9× |
| Array push + splice, length stable | 0.0235–0.0271 | **0.0058** | RN 4.4× |
| Wholesale replace, 1 of 3 changed | 0.0043–0.0071 | **0.0013** | RN 4.2× |

Immutable stores copy the whole state object per write, so the gap
**widens with store size and narrows with subscriber count** — both ends
are in the table. RN's 38 ms on the 200-leaf sweep is
`{...st.cells, [k]: v}` making 200 writes O(n²); that is inherent to
immutable state management, not imposed by the harness.

> ⚠️ Do not quote a delta from **wholesale replace**. Its own
> round-to-round spread is 0.0043 → 0.0071, about 65% — wider than any
> effect worth arguing about.

### Reads — React Native wins every shape

| ms per 100 reads | Skal | React Native | |
|---|---:|---:|---|
| Leaf, full literal path | 0.0319–0.0322 | **0.0090** | RN 3.5× |
| Leaf, parent hoisted | 0.0086–0.0087 | **0.0037** | RN 2.3× |
| Whole object `s.user` | 0.0092–0.0102 | **0.0070** | RN 1.3× |
| `const u = s.user` + 6 fields | 0.0742–0.0743 | **0.0191** | RN 4.0× |
| Deep path `a.b.c.d` (4 levels) | 0.0419–0.0453 | **0.0086** | RN 4.8× |
| Collection sweep, 200 rows | 0.0504–0.0506 | **0.0308** | RN 1.7× |
| *floor: plain array, int index* | *0.0002* | *0.0031* | *JSC 15×* |
| *floor: bare reactive read* | *0.0023* | *none exists* | |

zustand's `getState()` hands back a plain object, so every access after
it is a bare property load. Skal pays one proxy trap and one signal read
**per level** — which is why the 4-level path is the worst row. Against a
0.0023 bare-signal floor, the trap is irreducible while `state.a.b` is
the API.

**No arm builds a key string.** Every path is a literal, which is what
components write. An earlier version indexed with `key(i)`, and since
Hermes pays ~3.8× more than JSC for the same concat, that cost sat inside
both stacks' numbers and flattered RN by roughly an order of magnitude.

### Re-render precision

200 subscribers, one per distinct leaf, one leaf written.

| | Skal | React Native |
|---|---:|---:|
| Subscribers actually woken | **1 of 200** | **1 of 200** |
| Cost of that write | **0.0024–0.0025 ms** | 0.1500 ms |

**Both stacks are exactly precise.** The difference is what precision
costs: zustand must evaluate all 200 selectors to discover which changed;
Skal's signal graph routes straight to the one subscriber. That is
**50×**, and it is invisible to every read benchmark and to any write
benchmark that does not count subscribers.

Verified case-by-case on device, **17/17** — sibling leaves independent,
no-op writes silent, splices waking only shifted indices plus length, one
index assign costing one re-run, held element proxies surviving
re-insertion under both addressing schemes.

One deliberate exception, Skal's only coarse path: a consumer that
**iterates** an array (`map` / `filter` / `for..of` / spread) is woken by
any write beneath that array, because the callback receives raw objects
and registers no per-element dependency. Index and leaf readers keep
exact per-key precision.

---

## Reactivity under render pressure

288 independent leaf cells. App counters and `dumpsys gfxinfo` agree
independently.

| | Skal | React Native | |
|---|---:|---:|---|
| 1 cell / batch | **384/s** | 68/s | 5.6× |
| 16 cells / batch | **7 621/s** | 893/s | 8.5× |
| **all 288 / batch** | **103 846/s** | 4 901/s | **21.2×** |
| Janky frames | **4.60%** (18) | 50.38% (265) | — |
| p95 frame time | **9 ms** | 150 ms | — |
| High-input-latency frames | **18** | 429 | — |

> ⚠️ **Quote the 21×, not a per-cell figure.** At low pressure both
> numbers are scheduler-bound: 384 batches/s is a `setTimeout(0)` floor,
> and RN's 14.8 ms floor is one 60 Hz frame because React schedules for
> the next frame. Subtracting each stack's own floor gives ~260× per
> cell, but the two floors are different mechanisms, so that is
> indicative only.

**One shape of update.** Independent leaf cells with no derived state is
the case fine-grained reactivity is built for. Deep dependency chains,
list reorders and cross-cutting derived values are untested.

---

## JavaScript engine — JSC + bytecode vs Hermes

**Warm, JSC wins 8 of 8, median 7.3×. Cold, it is a tie** — RN takes 4 of
7 and JSC overtakes within about 10 iterations.

| ms per iteration, steady state | Skal (JSC) | RN (Hermes) | | stresses |
|---|---:|---:|---|---|
| Pure-JS SHA-256 | **0.0261** | 1.1712 | 44.9× | tight int32 loop |
| Closure calls 3k | **0.0124** | 0.2141 | 17.3× | megamorphic call sites |
| Array pipeline | **0.0225** | 0.2463 | 10.9× | JS callbacks, hot loop |
| Sort 500 | **0.0948** | 0.7520 | 7.9× | comparison callbacks |
| Megamorphic access | **0.0175** | 0.1167 | 6.7× | polymorphic loads |
| String + regex | **0.2520** | 1.6528 | 6.6× | JS + native regex |
| Alloc churn 2k | **0.0294** | 0.1811 | 6.2× | short-lived objects, GC |
| JSON.parse 500 posts | **1.1755** | 1.9915 | 1.7× | mostly native C++ both |

Warm-up is the whole story — same SHA-256 loop, by run index:

| ms/iter | 1st | 2–10 | 11–100 | 101–1k |
|---|---:|---:|---:|---:|
| Skal (JSC) | 0.916 | 0.298 | 0.071 | **0.034** |
| RN (Hermes) | 1.181 | 1.161 | 1.162 | **1.163** |

JSC drops **27×** as it tiers up; Hermes ships pre-compiled bytecode and
is flat. So RN starts faster and JSC overtakes almost immediately.

> ⚠️ Always ship the "warm" qualifier. A reader who runs one iteration
> sees no difference at all.

### Bytecode cache

| | plain evaluate | with bytecode cache |
|---|---:|---:|
| First launch (cache cold) eval | 109–252 ms | **40 ms** |
| Subsequent eval (warm) | 109–252 ms | **34 ms** |

---

## Storage and persistence — React Native's clearest win

| | Skal | RN (MMKV) | |
|---|---:|---:|---|
| Cold open + read 500 records | 6.2 ms (eager) | **0.662 ms** | RN 9.4× |
| Cold open + read 5 of 500 | 2.08 ms (lazy) | **0.259 ms** | RN 8× |
| Lazy bulk 500, improvement to date | 69 → **9.16 ms** | — | 7.5× |
| Granular flush, 1 of 200 changed | **0.043 ms** | — | 27× cheaper than 200 |
| 4 500-leaf store, added to cold start | +33.5 ms | — | 67% is the eager init walk |

A real trade, not a defect. MMKV parses the whole file into an in-memory
dictionary at `createMMKV()` and returns typed values across the
boundary, so its memory scales with **bytes stored** and it supports only
`boolean | string | number | ArrayBuffer`. Skal's keydir holds
**offsets**, so every record is a read plus a JS-side `JSON.parse` —
memory scales with **key count** and it stores arbitrary nested values.

> ⚠️ Persistence **writes** vs RN remain confounded and should not be
> quoted in either direction. The +33.5 ms init walk is the largest
> unaddressed number in the store.

---

## WebCrypto — the one Skal loses badly

**Status: measured, root-caused in the source, not yet fixed.**

| SHA-256, ms per digest | Skal | RN (quick-crypto) | |
|---|---:|---:|---|
| 1 byte | **0.0145** | 0.0371 | Skal 2.6× |
| 1 KB | 0.1793 | **0.0378** | RN 4.7× |
| 64 KB | 0.3459 | **0.0901** | RN 3.8× |
| 1 MB | 2.1778 | **0.8557** | RN 2.5× |
| `getRandomValues` | **0.0004** | 0.016 | Skal 37× |

Skal wins the 1-byte digest and loses everything with a payload, which
rules out per-call overhead. The cause is **a thread-pool dispatch per
call**, found in the source: bun's `CryptoAlgorithmSHA256::digest` hashes
inline only below **64 bytes** and dispatches everything larger to a work
queue (~0.165 ms round trip). The non-digest algorithms have no inline
path at all.

Four other hypotheses were tested and eliminated: per-`await` promise
overhead (batching 50 digests behind one await made Skal *worse*),
missing ARMv8 SHA instructions (the binary has 56 `sha256h`/`sha256su`
instructions and CPU feature detection), LITTLE-core scheduling (85% of
the hot thread ran on the 2.2 GHz A75 pair), and a slow bun worker pool
(those threads were nearly idle — 57 ticks against the main thread's 988).

---

## Memory and size

| | Skal | React Native | |
|---|---:|---:|---|
| PSS, feed + images | 437 MB | **368 MB** | RN 19% lower |
| Peak RSS (VmHWM) | 469 MB | **433 MB** | RN 8% lower |
| APK, no images | **40.7 MiB** | 45.7 MiB | Skal 11% smaller |
| APK, with images | **51.6 MiB** | 56.5 MiB | Skal 9% smaller |
| **APK at full WebCrypto parity** | **51.6 MiB** | 67.2 MiB | **Skal 23% smaller** |

Images cost both stacks about the same (+155 MB vs +149 MB), so the
memory gap is **entirely runtime baseline**, not asset handling.

---

## Cold start — unresolved, do not quote

Two experiments disagree, and the winner flips. The cause is the
opponent: one RN build is **24.9 MiB**, the other **45.7 MiB** — nearly
twice the app.

| source | Skal | RN | RN APK | says |
|---|---:|---:|---:|---|
| app benchmark, 2026-07-31, stock host | **406 ms** | 553 ms | 45.7 MiB | Skal 148 ms faster |
| four-app control, 2026-07-30, + host wins | 333 ms | **278 ms** | 24.9 MiB | RN 56 ms faster |

**One interleaved run against a single named RN build would settle it.**
Until then no cold-start number belongs on a marketing page.

The four-app control is still the better experiment for *attribution*,
because it separates Skal's cost from Flutter's — same 27-node static
screen, interleaved n=10, all launches confirmed `COLD`:

| | time to content | time to window | APK |
|---|---:|---:|---:|
| React Native 0.86 | **278 ms** | 222 ms | 24.9 MiB |
| **Skal**, scaffolded + host wins | **333 ms** | 324 ms | 40.7 MiB |
| Pure Flutter, stock (no Skal) | 362 ms | 362 ms | 14.1 MiB |
| Skal in a kitchen-sink host, stock | 428 ms | 428 ms | 41.7 MiB |

**A properly configured Skal app is 29 ms faster than a bare Flutter
app.** The Flutter tax is not inherent — nearly all of it is what a stock
`FlutterActivity` does on the critical path. The 95 ms between the two
Skal rows is four changes at once (host wins, fewer plugins, smaller
bundle, early frame); do not attribute it to any one of them.

Host optimisations, A/B/A blocks with drift quantified per run:

| change | moved | result | verdict |
|---|---|---:|---|
| TextureView render mode | tax 167→89 | **−65 ms** | proven, drift 8 |
| FlutterEngine pre-create | js_done 264→238 | **−23 ms** | proven, drift 8 |
| Flutter loader pre-warm | activity_done 114→106 | **−8 ms** | proven |
| Early placeholder frame | tax 163→170 | +13 ms | regression, off |
| Splash view removal | tax 92→88 | 1 ms | no effect, off |

---

## Not measured — do not infer

The list exists so that silence is never read as a result.

| | |
|---|---|
| Any second device | single device throughout, every number here |
| Deep dependency chains, list reorders, derived values | the reactivity result covers independent leaf cells only |
| Navigation between screens | — |
| Network | deliberately excluded, bundled fixture |
| First launch after install | known: Skal pays ~150 ms more for bundle extraction |
| Persistence writes vs RN | confounded, not quotable either way |
| Cold start vs a single named RN build | see above |

---

## How these were produced

Rules this benchmark had to learn the hard way, kept because each one
cost a wrong answer:

- **`pm clear` before every Skal run**, or you measure the previously
  extracted bundle.
- **Hold the screen awake and assert it** in the same pass. A dozing
  screen inflated Skal's crypto numbers ~2× and left RN's untouched.
- **Match the access shape across arms.** No arm may build a key string
  if the others don't.
- **Give each arm its own store, and discard the warm-up.** A new
  persisting store stages its entire initial state.
- **A/B/A with the drift quantified** when two builds can't interleave
  per-run. A change smaller than the drift is not proven.
- **Prove the workload ran** — assert the iteration count and the
  checksum. A "39% faster" list benchmark was once timing 10 virtualized
  rows, not 2000.
- **Medians, never a single sample.** A second run of identical code once
  gave 695 ms → 8 ms for the same payload.

A note on effect size and sample count: a 25-pair interleaved A/B of the
store's last seven commits reported two arms regressing at n=9, both with
a mechanism that could be named, and **both evaporated by n=25**. An
effect that shrinks as n grows is noise.
