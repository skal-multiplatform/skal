# Slot-resolved store — measured case, and the plan

**Measured:** 2026-08-02, Samsung Galaxy A14 5G (SM-A146P), Android 15,
arm64-v8a, **release builds, physical hardware, screen held awake**.
Skal `com.example.skal_bench` vs React Native `com.anonymous.rnfeed`
(Expo 57 / RN 0.86 / Hermes + zustand + MMKV). Medians of 3, checksums
matched on every arm.

The prototype is `benchmark_v2/skal-bench/src/ministore.js` ("MINI") —
35 lines, not a store, deliberately. It exists to answer one question:
**what does the store's read path cost, and is that cost necessary?**

Status: ✗ **Phase 0 killed the plan for list rendering** (§5) — and
§1's read numbers were later found **contaminated by benchmark key-string
construction; see §0 for the corrected, real-shape figures.** The microbenchmark result (§1) stands and is reproducible; what
failed is the claim that it reaches a real frame. Phases 1–3 are kept
as a design record, not as scheduled work.

---

## 0. CORRECTION — 2026-08-03: §1's read numbers are contaminated

**Every arm in §1 indexes with `key(i)`, which BUILDS A STRING each
iteration. Real code does not — `user.name.first` has literal keys.**
That string cost is engine-asymmetric, so it sat inside both stacks'
store numbers and inflated RN's far more than Skal's:

| | plain read, `key(i)` | plain read, int index | ⇒ string build |
|---|---:|---:|---:|
| Skal (JSC) | 0.0083 | 0.0003 | **0.080 µs** |
| RN (Hermes) | 0.0331 | 0.0029 | **0.302 µs** |

Hermes pays ~3.8× more for the same string — consistent with
`ENGINE_AND_REACTIVITY.md`, where string+regex is 6.6× slower on Hermes.

Arms that build **no strings at all** (fixed literal paths, the shape
components actually write). Checksums matched across stacks
(`ck=300/100/6500`); RN stable to the 4th decimal across rounds:

| read shape, ms/100 | Skal | RN | RN faster |
|---|---:|---:|---:|
| `s.user.name.first`, full literal path | 0.1505 † | 0.0090 | **16.7×** |
| same, parent hoisted | 0.0288 † | 0.0037 | 7.8× |
| **`s.user`, whole object** | 0.0486 | 0.0072 | **6.8×** |
| `const u = s.user` + 6 fields | 0.3276 | 0.0191 | **17.2×** |

† one round only; the other two are medians of 3. Re-run before quoting.

**Two claims in §1 are therefore wrong and are withdrawn:**

- "MINI is a 12.4× win over RN" — MINI's slot arm is int-indexed and
  builds no string, so it was being compared against an RN number
  carrying 0.302 µs of string cost. Like for like, MINI's ~0.027 µs is
  roughly **parity** with RN's ~0.036 µs real read, not 12×.
- "Skal is 1.18× behind RN after the resolved-parent cache" — on real
  paths it is **7–17× behind**.

**What did NOT change:** the write, frame and persistence results (no
key construction in the dominant term), the Phase 0 kill, and the
cold-start attribution.

**What it makes stronger:** the floors say the headroom is real — raw
property access is 0.0003–0.0006 on JSC vs 0.0029 on Hermes, so the
engine is **5–10× in Skal's favour** and the store layer is spending all
of it and more. At MINI's measured leaf cost the `object + 6 fields`
loop would be ~0.19 µs against RN's 1.91 µs — Skal ~10× *ahead*.

---

## 1. The finding

Reads, ms per 100, and the controls that make them mean something:

| arm | Skal today | MINI | RN |
|---|---:|---:|---:|
| store read, naive | 0.1204 | 0.0245 | 0.0384 |
| **store read, best case** | 0.0670 | **0.0027** | 0.0336 |
| `snapshot()` — non-reactive, **since removed** | 0.0089 | n/a | n/a |
| *plain object, string key* | *0.0079* | — | *0.0336* |
| *plain array, int index* | *0.0006* | — | *0.0029* |
| *bare reactive read* | *0.0024* | — | *none exists* |

Writes, ms per op:

| arm | Skal today | MINI | RN |
|---|---:|---:|---:|
| 1 leaf, 0 subs | 0.0057 | **0.0005** | 0.0843 |
| 1 leaf, 50 subs | 0.0817 | — | 0.1920 |
| 1 leaf, 200 subs | 0.2691 | **0.0649** | 0.2082 |
| 200 leaves, 1 sub each | 1.2589 | **0.2288** | 39.75 |
| realistic frame (200×10 + 1 mutation) | **0.1182** | — | 0.8560 |

Three things follow, and only these three are load-bearing:

1. **Reads were the one arm RN won** (2.0× on Skal's best case). MINI
   flips it to a **12.4× Skal win**, while staying reactive.
2. **MINI sits on the reactive floor** — 0.0027 against 0.0024 for a
   bare Solid signal. There is no headroom left; no reactive store can
   go lower.
3. **MINI's reactive read is at parity with the fastest read RN can
   physically perform** (0.0029 — plain array, integer index, no
   reactivity at all).

Of any Skal-vs-RN gap, **~4.8× is the engine** (JSC vs Hermes at the
int-index floor, 0.0006 vs 0.0029), not the design. MINI's remaining
~2.6× is design.

RN's 39.75 ms on the 200-leaf sweep is zustand's `{...st.cells, [k]: v}`
copying per write, making 200 writes O(n²). Inherent to immutable state
management, not imposed by the harness.

---

## 2. Where the current store's time goes

The controls decompose the 0.1204 full-path read exactly:

| layer | cost | adds | share |
|---|---:|---:|---:|
| bare Solid signal | 0.0024 | — | 2% |
| + Solid `createStore` proxy | 0.0503 | **×21** | 40% |
| + Skal's leaf trap | 0.0670 | ×1.33 | 14% |
| + Skal's intermediate-node resolution | 0.1204 | ×1.8 | 44% |

**The current store re-derives where the data is on every read. MINI
derives it once, at construction, and stores the answer as an integer.**

- **Solid's store proxy (×21)** — a property access is a trap dispatch,
  a lookup-or-lazily-create of that property's signal node, dependency
  bookkeeping, then wrapping object values in child proxies. Solid
  creates leaf nodes lazily on first access, so it must check on every
  access. MINI creates every signal eagerly at construction, so the
  closure already *is* the node.
- **Skal's leaf trap (×1.33)** — resolves the leaf's storage key and
  checks residency before delegating down. This is what buys staging,
  faulting and tombstones.
- **Skal's intermediate node (×1.8, the largest Skal-side item)** —
  `state.cells.k7` fires **two** traps. The first returns no value at
  all: it allocates a child path array, concatenates the child storage
  key, and does a `nodeMemo` Map lookup, then returns another proxy. An
  allocation, a string concat and a hash lookup *before any data is
  touched*. Hoisting the parent skips exactly this: 0.1204 → 0.0670.

### Why tuning the existing layers is not enough

Delete **both** Skal traps and you land on Solid's `createStore` at
**0.0503** — still 19× MINI and **1.5× slower than RN**. So:

> Fixing everything Skal owns, while keeping `createStore`, still loses
> the read benchmark to React Native.

The two available changes are independent, and **either alone leaves us
at or behind RN on the default access pattern**:

| configuration | reads (naive) | vs RN 0.0336 |
|---|---:|---|
| today | 0.1204 | RN 3.6× faster |
| drop Solid, keep Skal's layers | ~0.0725 † | RN 2.2× faster |
| keep Solid, add slot resolution | ~0.0503 † | RN 1.5× faster |
| **both (MINI)** | **0.0027** | **Skal 12.4×** |

† **These two rows are additive projections, not measurements.** They
assume separately-measured layer costs compose, which is precisely what
this repo's rules say does not hold — sizing segments tells you where
time is spent, not what removing one does to the total. Three targets
picked that way in one earlier session all evaporated under a control.
Treat them as hypotheses.

Note the consequence if they do hold: once Solid's proxy is gone,
**Skal's own layers become the bottleneck** (0.0167 + 0.0534 = 0.0701,
29× the floor). They are currently hidden behind Solid's cost.

---

## 3. Granular persistence — the bar to preserve

Measured on the current store, `assert_fail=0` on every arm (exactly
*n* frames staged before each flush, zero after):

| changed | stage loop | flush | total | per changed leaf |
|---:|---:|---:|---:|---:|
| 1 of 200 | 0.0644 | 0.0432 | 0.1076 | 108 µs |
| 10 of 200 | 0.1921 | 0.0795 | 0.2716 | 27 µs |
| 200 of 200 | 3.7689 | 1.1688 | 4.9377 | 25 µs |
| *memory-only, 1 leaf* | *0.0062* | — | *0.0062* | — |
| *memory-only, 200 leaves* | *1.3751* | — | *1.3751* | — |

Flush fits **≈37 µs fixed + ≈5.7 µs per changed leaf**. Durability costs
**17× the memory-only write** for one leaf, falling to 3.6× at 200.

**The 27× ratio between 1-changed and 200-changed is the entire argument
for granular over coarse persistence, and it must not regress.** A coarse
store (zustand's `persist` middleware) re-serialises everything on every
change, so its cost for one changed leaf *is* the 200-leaf number.

Consequence for MINI: a persisted leaf costs ~0.1 ms end to end, so its
0.0005 ms write becomes engine-bound and the 169× over RN collapses.
**The write advantage is real only for memory-only state. The read win
is unaffected.**

### Granularity maps onto slots well

Each slot's storage key is computed once at construction, so staging
becomes `dirty.add(slot)` — an integer, no string work — and flush reads
`storageKey[slot]` from an array. Per-path config (`persist: false`,
`lazy`) becomes `persist[slot]` rather than a path-prefix match.

`walk` is depth-first, so **a subtree is a contiguous slot range**.
Prefix operations (`tombstoneTree`, wholesale replace, faulting a
subtree) become integer range operations instead of string prefix scans.

Falsifiable prediction: staging currently costs ~12 µs/leaf (3.7689 vs
1.3751 over 200). Slots delete the path→key part of that.

Harder: dynamic keys append outside their subtree's range, breaking
contiguity; collections need dynamic allocation *and* an `_id`→slot map;
lazy faulting's residency check currently rides in the trap being
deleted, so it needs a self-replacing accessor rather than a per-read
test.

---

## 4. What MINI is not

2 of ~20 features: per-leaf reactivity and `batch`. Missing: mutation
syntax `state.a.b = v`, `delete`, subtree reads, collections with stable
`_id` and their mutators, runtime-added keys, `snapshot()`, declared-dep
effects — and the whole persistence and lifecycle surface (staging,
flush, hydration, `ready()`, tombstones, lazy faulting, `paths`, `name`,
`version`/`migrate`, `engineStats`).

**Objects are the good case, arrays are the hard case.** The benchmark
*was* a nested object (`{ cells: { k0…k199 } }`), so 0.0027 is already
the object number. Static shape means static slots. Arrays are stored as
a single opaque signal today, so a `push` would be
`write(s, [...read(s), item])` — O(n), waking every subscriber. That is
*literally zustand's pattern*, the thing that produced RN's 39.75 ms.
**On collections MINI is currently worse than the store it aims to
replace.**

---

## 5. The plan

Sequenced by risk: cheapest experiment that could kill the design first.
Each phase has a kill criterion. Nothing proceeds past a failed gate.

### Phase 0 — prove it matters at all — ✗ RUN 2026-08-02, KILL CRITERION MET

**Result: the read path is not on the critical path for list rendering.
Phases 1–3 are not justified by the feed, and the arithmetic below that
motivated them was wrong by two orders of magnitude.**

Store-backed feed (`FeedStoreScreen.jsx`, flattened to `posts.p<i>.<f>`),
identical pixels in every arm, A/B/A because the arms are compile-time
flags. Medians of 3, `dumpsys gfxinfo`, screen awake and asserted, arm
identity asserted from the APK (`ARMTAG`) on every build:

| arm | janky % | p50 | p90 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| plain (block A) | 0.00 | 5 | 5 | 6 | 9 |
| skal, hoisted | 0.00 | 5 | 5 | 6 | 9 |
| mini, slots | 0.00 | 5 | 5 | 6 | 9 |
| plain (block A′, drift) | 0.00 | 5 | 5 | 6 | 8 |
| **skalx20 — 20× positive control** | **0.00** | **5** | **5** | **6** | **8** |

Every arm identical, and the A-to-A drift (p99 9→8) is as large as any
arm-to-arm delta, so nothing is proven different.

**The positive control is what makes this conclusive rather than
ambiguous.** With ~6 ms of per-frame headroom, "read cost is free here"
and "this instrument cannot see read cost" produce the same table. So an
arm doing **20 store reads per field** — 180 per row instead of 9 — was
run. It moved nothing either.

**Why, and this is the part the original plan got wrong.**
`ListView.builder` calls `renderItem` once per row **materialised**, not
per frame. The gesture travels 8 × 1400 px ≈ 11 200 px, which at ~600 px
average row height materialises ~19 rows, plus ~4 in the opening
viewport. So the whole 4.8-second gesture performs:

    23 rows × 9 leaves ≈ 207 store reads  ≈  0.14 ms  TOTAL

Not per frame — total. The 20× control is ~2.8 ms spread over 4.8
seconds. **A windowed list does almost no store reading**, because
nothing re-reads unless it changes. The estimate below assumed every row
re-reads every frame; windowing means none of them do.

**What it would take to matter.** ~6 ms of headroom at 0.67 µs per
hoisted read is roughly **5 000 reads per frame**. The feed does ~36. A
workload would need ~140× more read pressure — hundreds of components
re-reading store leaves every frame (a live grid, a store-driven
animation, a dashboard). Whether that shape is real in Skal apps is now
the open question, and it should be answered from a real app before
anything below is built.

**Not settled by this**: cold start. The `skal` arm builds a 4 500-leaf
store at boot, which the 8-second settle absorbs entirely. If the read
path is ever revisited, store construction cost is a separate question
this run says nothing about.

<details>
<summary>The original Phase 0 rationale, kept for the record</summary>

Everything above is a **component benchmark**. This repo's most
expensive lesson is that a big segment is not necessarily a
critical-path segment.

**Build:** MINI behind the existing 500-row feed screen.
**Measure:** frame time and jank from `dumpsys gfxinfo` — *not* read
cost. A/B interleaved, screen held awake and asserted.
**Arithmetic that motivates it** (not evidence): ~500 rows × a few
leaves ≈ 1 500 reads/frame → ~1.8 ms at 1.2 µs/read vs ~0.04 ms at the
floor, against an 11 ms budget at 90 Hz.

> **KILL:** if the feed's frame stats are unchanged, the 24× is not on
> the critical path and Phases 1–3 are not worth building. Stop here.

</details>

**This kill fired.** Phases 1–3 below are retained as a design record,
not as scheduled work. Do not start Phase 1a without first finding a
real workload that reads at frame rate.

### Phase 1 — retire the two design risks

**1a. Collections on slots.** The biggest risk, and it gates everything.

- Build: `length` signal; element slots allocated on append; `_id`→slot
  map; `push`/`splice` as O(1) slot operations.
- The escape from per-read `Map.get` is that `<For>` is keyed by
  identity and creates a row once, so handles resolve **once per row at
  creation**, not per read.
- Measure: 500-row collection — per-row read cost against the 0.0027
  floor; `push`/`splice`/reorder against both the current store's
  collection path and RN.

> **KILL:** if per-row reads land near 0.0245 (the `Map.get` path)
> rather than 0.0027, MINI is a flat-leaf optimisation, not a store
> architecture. Apply slot resolution *inside* the existing store and
> abandon the replacement.

**1b. Staging + residency on the hot path.** Tests §2's additive
projection directly — the shakiest claim in this document.

- Build: persistence staging and a lazy-faulting residency check on
  MINI.
- Measure: the **total** read and write cost, not the increments.
- Preserve §3's bar: 1-changed must stay ~27× cheaper than 200-changed.

> **KILL:** if totals land near 0.05 rather than near 0.0027, the layers
> do not compose additively and the projection was wrong.

### Phase 2 — the ergonomic layer

Only after 1a. Deliberately **before** the transform, so the transform
emits into an API that already exists and is tested.

`$` is a proxy whose traps run once, at setup, returning **handles
instead of values**, destructurable as Solid's `[get, set]`:

```jsx
const { name, streak } = store.$.user;
const [n, setN] = store.$.user.streak;
<Text label={name()} />
```

Subtrees pass as handle bundles, not values, which preserves reactivity:
`<Profile user={store.$.user} />`.

Also build the **dev-mode guard**: `$` resolution inside a reactive or
render scope is a silent perf regression with no symptom
(`<For>{(r) => store.$.items[r.id].title()}</For>` resolves per row per
render). Count resolutions and warn.

Consider keeping the **proxy for writes** and handles only for reads:
the 24× is entirely on the read path, while write cost is dominated by
effect propagation (0.2691 at 200 subs) and, when persisted, by the
engine (~0.1 ms). Needs a MINI-plus-write-proxy arm to confirm.

### Phase 3 — compile-time path resolution

Biggest, last, only justified once the representation is proven. Skal
owns a Babel/vite step, so `state.user.name` — a literal path — can be
resolved at build time:

```js
<Text label={state.user.name} />   →   <Text label={__slot(37)()} />
```

App code does not change at all. Dynamic access falls back to a runtime
lookup (0.0245), which still beats today's 0.1204, so the floor of the
design is "no worse than now".

**This is the one lever RN structurally cannot copy** — zustand is a
runtime library with no compiler.

---

## 5b. What replaced it — the cold-start question

Phase 0 killed the read path for list rendering. The remaining honest
question is **not** a different read workload — hunting for one is how a
dead result gets resurrected. It is whether the store is on the
**cold-start** critical path, which is the one place a store cost cannot
hide behind windowing or behind fine-grained reactivity.

Reads escape the frame twice over: a windowed list materialises ~23 rows
per gesture, and a fine-grained read only re-runs when its own leaf
changes. Construction has neither escape — it is O(store size) and it
happens before the first frame. Today's Phase 0 `skal` arm built a
**4 500-leaf store at boot** and an 8-second settle absorbed it
completely. It has never been measured.

### RESULT — 2026-08-02: the store IS on the cold-start path, and it is
### NOT the layer anyone was looking at

8 launches per arm, medians, A/B/A, arm identity asserted from the APK
(`LEAFTAG`), `pm clear` + a seed launch before each block so measured
runs hydrate existing data.

| arm | Displayed | vs base | Fully drawn | vs base |
|---|---:|---:|---:|---:|
| 0 leaves (pooled A/A′) | 382.0 | — | 416.8 | — |
| 500 leaves, persisted | 387.5 | +5.5 | 426.0 | +9.2 |
| 4 500 leaves, persisted | 420.0 | **+38.0** | 453.5 | **+36.8** |
| 4 500 leaves, `persist:false` | 408.5 | +26.5 | 444.5 | +27.8 |
| 4 500 leaves, **Solid `createStore` only** | 383.0 | **+1.0** | 411.0 | **−5.8** |

**A-to-A drift 7.0 / 7.5 ms.** Deltas below that are not proven.

Attribution of the 38 ms:

| component | Displayed | Fully | share |
|---|---:|---:|---:|
| Solid's `createStore` | +1.0 | −5.8 | **~0 — within drift** |
| **Skal's own init walk** | **+25.5** | **+33.5** | **67–91%** |
| engine open + hydrate | +11.5 | +9.0 | 24–30% |

Roughly linear at **~8.4 µs per leaf**.

**Solid's `createStore` is innocent, and that kills variant (b) below as
a cold-start fix.** Constructing Solid's store over the same 4 500-leaf
object is indistinguishable from building no store at all, because
Solid's store is **lazy** — it wraps the object and creates nodes on
first access, so there is nothing to walk at construction.

The cost is **Skal's eager init walk**: visiting every leaf at
construction to compute storage keys, seed `nodeMemo` and register
paths. Both MINI and variant (b) targeted the layer beneath it. Only
measuring the TOTAL, with a control that removed each layer in turn,
caught that.

### The fix this points at

**Make Skal's init lazy, the way Solid's already is.** The machinery
exists and is not the default: `paths: { x: { lazy: true } }`, the
`faulted` map, `residentMax` LRU eviction. What is missing is doing it
without being asked.

Not yet decomposed, and the same discipline applies before attributing
further: "Skal's init walk" is itself several things (the walk, storage
key computation, `nodeMemo` seeding, hydration scheduling). Laziness
targets all of them at once, which is why it is worth trying before
sub-timing any of them — and it is testable by exactly the method used
here: build it, re-measure the TOTAL.

Secondary, ~25% of the cost: **engine open + hydrate**, +11.5 ms for
4 500 records. Worth a look only after the init walk, and its ceiling is
much lower.

### The original experiment design

Sweep store size and measure **TOTAL cold start** — not a phase timer.
The distinction is the whole point: a phase timer once charged a
function 78 ms that sub-timing showed was 3 ms, and three
segments picked by size in one session all evaporated under a control.
**The only evidence a segment costs anything is removing it and
re-measuring the total.**

- Arms: 0 / 500 / 4 500 leaves, otherwise identical app.
- Metric: `Displayed` / `Fully drawn`, the same instrument as
  `ANDROID_COLD_START.md`, so the numbers sit on an existing scale.
- A/B/A with drift reported — the arms are compile-time flags on one
  applicationId and cannot be interleaved.
- `pm clear` before every run.
- `initTiming` on the store handle is available as *corroboration*, but
  the total is what decides.

> **KILL:** if total cold start does not move between 0 and 4 500
> leaves, store construction is not on the critical path either.
> Combined with Phase 0, that means the store is not where Skal's
> remaining time is — **stop all store work**, including 5b.

### If it does move

Build **variant (b)**: replace Solid's `createStore` with per-leaf
signals held directly on the nodes Skal already memoizes (`nodeMemo`).

Why this shape rather than MINI: **the entire API and feature set
survive**. `state.a.b = v`, collections with stable ids, `delete`,
subtree reads — all of that lives in Skal's own proxy layer, which is
untouched. Only the thing *beneath* it changes. No compile-time
transform, no collections redesign, no two-store world.

Today a read traverses **two** proxy layers (Skal's trap, then Solid's
store proxy), and a two-level path fires Skal's intermediate trap with
Solid beneath it as well. Variant (b) collapses that to one.

Projected, and **projections here have already been wrong by two orders
of magnitude once today** — worth one experiment, not a plan:

| backing | hoisted read /100 | note |
|---|---:|---|
| today (Solid `createStore`) | 0.0670 | two proxy layers |
| flat `Map<sk, signal>` | ~0.035 † | the string-keyed `Map.get` caps it |
| signal cached on the memoized node | → 0.0024 † | approaches the floor |

The read improvement is **not the justification** — Phase 0 settled
that. It is a side effect. The justification would be construction and
write cost, which the experiment above is what actually tests.

---

## 5c. The plan, as of 2026-08-03

Goal, set explicitly: **make reads faster.** Phase 0 showed reads do not
reach a frame in a windowed list; that is noted and not relitigated —
the target here is store-heavy access, and §0 shows the gap there is
7–17×, not the 1.18× the contaminated arms suggested.

### A. Pin the two thin numbers  *(30 min)*

`leaf, full literal path` and `leaf, parent hoisted` are single-round.
Re-run both stacks at n=3. They are the headline figures; everything
below is sized against them.

### B. Spike: what is the Solid trap actually worth?  *(~1 hour)*

Behind a flag, back leaves with our own `createSignal`, created lazily,
keyed by the storage key the proxy already computes; the get trap reads
`sigFor(childSk)()` instead of `parent[key]`. Tracked and real, but
**measurement-only** — wrong for structural writes until diffing exists.

This exists because the projection cannot be trusted: raw `createStore`
measures 0.0503/100 while Skal's hoisted read — which contains a Solid
trap *plus* Skal's own — measures 0.0395. Strictly more work, less time.
One of those arms is misleading, and the difference is exactly the
number the whole rewrite is justified by.

> **KILL:** if removing the Solid trap moves the real-shape arms by less
> than ~2×, the trap is not the cost and the rewrite is not justified.
> Look at `makeNode` (D) instead.

### C. If B pays: replace the backing  *(the real work)*

Own leaf storage; Solid keeps nothing. The seam is narrow — 7 call sites
(3 read, 4 write) — but three things must be reproduced:

1. **Diffing on wholesale replace.** Solid compares old against new and
   fires only the leaves that changed. The resolved-parent cache's
   `untrack` **depends** on this for correctness. This is the hard part.
2. **Collections** — `splice`/`sort`/`reverse` go through `produce` with
   id-addressed paths.
3. **Hydration**, which writes into the tree via `setState`.

A side benefit worth as much as the speed: **reactivity becomes
testable**. Today Solid's effect queue never flushes under bun (verified:
`createEffect` never runs, `createComputed`/`createRenderEffect` run once
and never again, `createMemo` returned 10 while its signal was 3), so the
`untrack` contract had to be checked on a phone via `ck=613`. If Skal
owns notification, that runs synchronously and can be asserted in
`bun test`.

### D. The object-read path  *(independent of B and C)*

`s.user` is Skal's worst per-access case and it is **6.8× behind RN**.
Unlike a leaf read it takes the `makeNode` branch: an array allocation
(`[...sp, key]`), a string concat (`sk + '.' + key`) and a `nodeMemo`
lookup. None of that is Solid's — it is all Skal's, so it can be
attacked without touching the backing, and the `object + 6 fields`
pattern (17.2× behind) pays it once per component read.

### E. Lazy init  *(independent, cold start)*

Skal's eager init walk is 67% of the +38 ms in §5b. The machinery exists
but is opt-in (`paths: { x: { lazy: true } }`, `faulted`,
`residentMax`). Nothing here depends on B/C/D.

### Landed but uncommitted

The **resolved-parent cache** (§5b/§0 measurements were taken with it):
each object proxy resolves its own path once per structural generation
instead of walking from the root per read, turning O(d²) Solid traps
into O(d). Worth 1.70× on the hoisted DIAG arm. Both invalidation points
are mutation-tested — the first four tests passed with each deletion,
because they held a *parent* and replaced a *child*, and Solid mutates in
place so the parent's identity never changes. 162 tests green.

Also removed: **`snapshot()`** — see §7.

---

## 5d. DONE 2026-08-03 — solid-js/store removed

`db.js` imports only `createSignal` and `untrack` from solid-js core.
`root` is a plain mutable tree and the single source of truth;
reactivity is a side table of version signals created lazily per store
key on first read, carrying no value. A leaf read is one Skal trap, a
cached parent object, a version call to subscribe, and a plain property
read. One proxy layer, and nothing walks.

Device medians of 3, release, screen awake, checksums matched:

| ms/100 | before | after | gain | RN |
|---|---:|---:|---:|---:|
| leaf, full literal path | 0.1505 | **0.0325** | 4.6× | 0.0090 |
| leaf, parent hoisted | 0.0288 | **0.0086** | 3.3× | 0.0037 |
| whole object `s.user` | 0.0486 | **0.0093** | 5.2× | 0.0072 |
| object + 6 fields | 0.3276 | **0.0743** | 4.4× | 0.0191 |
| write 1 leaf | 0.0062 | **0.0016** | 3.9× | 0.0849 |
| write 200 leaves | 1.31 | **0.62** | 2.1× | 44.2 |
| realistic frame | 0.0996 | **0.0498** | 2.0× | 0.8553 |

**RN is still ahead on leaf reads** — 2.3× hoisted, 3.6× full path — and
level on whole-object reads (1.3×). The remaining term is the Proxy
`get` trap: a bare signal read is 0.0023 against our 0.0086, so ~0.006
per 100 is trap plus lookup. That is irreducible while `state.a.b` is
the API. Writes and frames are 17×–71× ahead.

### Storage was not regressed by the rewrite — it improved

| | before | after | |
|---|---:|---:|---|
| stage-loop, 200 leaves | 3.7689 | **2.1047** | 1.8× |
| stage-loop, 10 | 0.1921 | **0.1102** | 1.7× |
| flush, 200 of 200 | 1.1688 | **0.9055** | 1.3× |
| flush, 10 of 200 | 0.0795 | 0.0759 | flat |
| persist 500 + flush | 0.0139 | **0.0099** | 1.4× |

The 1-of-200 flush arm stays too wide to call (0.032–0.175 across
rounds), as it was before. §3's granular-vs-coarse ratio is preserved.

### Cold start is UNCHANGED, exactly as §5b predicted

A 4 500-leaf store costs **+33.5 / +37.0 ms** against **+38.0 / +36.8**
before — inside the 7.0/7.5 ms drift. §5b attributed the cost to Skal's
own eager init walk and measured Solid's `createStore` at ~0, so
removing Solid was never going to help boot. It didn't. **Lazy init (E)
remains the only fix for cold start**, and it is untouched by this work.

### What the read numbers do and do not cover

Every read figure above is **memory-only** — the store is hydrated by
then, so a read touches the plain tree and never the log. Storage enters
at three points: hydration at open, `faultIn` on first access of a lazy
path, and staging + flush on writes. The first two are the cold-start
row; the third is the storage table.

---

## 5e. Getting data OUT of storage — RN wins, ~8–11×

**Measured 2026-08-03**, cold process, interleaved, checksums identical
across stacks (`16366700` for 500 records, `142888` for 5).

The question is the one an app asks: **from a cold process, how long
until N records are readable in JS**, with each stack's store open
INSIDE the timer.

| need | Skal | RN (MMKV) | RN faster |
|---|---:|---:|---:|
| **all 500 records** | eager **7.13–7.75 ms** | **0.662 ms** | **~11×** |
| | *lazy 64.9–73.0 ms* | | |
| **5 of 500 records** | lazy **2.08–2.09 ms** | **0.259 ms** | **~8×** |
| | *eager 5.79–6.00 ms* | | |

**This is RN's clearest win in the whole comparison** and it is not
close. Skal is faster at reads once resident, at writes, and at frames;
it is ~10× slower at getting bytes off disk into JS.

### A wrong number, and why it was wrong

A first pass reported **RN 129× faster** (113.59 µs/record vs 0.88).
**That figure is void.** It timed Skal's per-record fault-in against
MMKV's `getNumber` — but MMKV mmaps and parses the WHOLE file inside
`createMMKV()`, which sat outside the timer. So it compared Skal doing
real disk work against RN doing a memory lookup whose disk cost had
already been paid off-camera. Moving the open inside the timer took the
gap from 129× to ~8–11×.

The tell was in the data and was missed on the first read: RN's "cold"
pass (0.88 µs/rec) was barely above its own warm control (0.69). A real
first-touch-from-disk cannot be 1.3× a memory re-read; that ratio said
the disk cost was elsewhere.

### Lazy is a trap at volume

Reading all 500 through `lazy: true` costs **64.9–73.0 ms** against
**7.1–7.7 ms** eager — **~9× worse**, because each leaf pays its own
`engine.get` + `JSON.parse` + tree write + LRU bookkeeping. Lazy only
pays off when you genuinely touch few records: at 5 of 500 it is 2.08 ms
against eager's 5.79 ms.

Contributors to the per-record cost, in likely order: `JSON.parse` per
record, `touchFaulted`'s LRU bookkeeping, and — introduced by the
rewrite — `faultIn` → `setAt` → `bumpTree`, which scans every version
signal, making a 500-record fault loop O(n²). The last is ours and
scales badly; the first is the obvious target (one bulk frame per
subtree rather than one per leaf).

### Decomposed 2026-08-03 — and it inverts the obvious guess

Temporary instrumentation in `hydrate` (added, measured, reverted — not
in the tree). Per record, n=500, medians of 3:

| phase | per record | share of attributed |
|---|---:|---:|
| **`engine.get`** — native crossing + ArrayBuffer alloc | **5.29–5.61 µs** | **51%** |
| `setAt` — tree write | 2.57–2.58 µs | 25% |
| `decodeFrame` — TextDecoder + `JSON.parse` | 1.78–1.95 µs | 17% |
| `bumpTree` | 0.56–0.63 µs | 6% |

**The native crossing dominates. `JSON.parse` is the SMALLEST of the
three main phases.** The proposal to replace the JSON codec was aimed at
the least important term — and it had already been rejected on
measurement (see the codec comment in `db.js`: JSC's JSON is native C++
and beats any JS codec at every size). Wrong on both counts.

**The right target for eager hydration is a BATCH GET** — one native
call returning many frames — because that is the 51%. A codec change
attacks 17%; a faster tree write attacks 25%.

### Lazy mode: 72–77% of it is a regression I introduced

Same instrumentation on the lazy path: **`bumpTree` is 47.1–56.3 ms of
the 65.3–72.7 ms total.** `faultIn` → `setAt` → `bumpTree` scans every
version signal, and lazy reads populate that map as they go, so a
500-record fault loop is O(n²).

Eager hydration escapes it (0.56 µs/record) because `vers` is still
empty at open — nothing has subscribed yet. Lazy is quadratic precisely
because it interleaves reads with faults.

**Fixing this is a bug fix, not a redesign**, and should take lazy-500
from ~69 ms to roughly ~18 ms. It is the single largest storage win
available and it is cheaper than everything else on this list.

### Caveat on the absolute numbers

Instrumented total was 11.1–12.6 ms against 7.1–7.7 ms clean, so the
clock reads cost ~1 µs each and every phase carries about one of them.
**Treat the RATIOS as the finding, not the absolutes** — subtracting
~1 µs per phase gives roughly get 4.3, setAt 1.6, decode 0.8, and the
ordering is unchanged.

### Not measured
- MMKV's open cost is now inside the timer but not isolated, so how much
  of RN's 0.662 ms is open vs reads is unknown.
- One seed + 3 interleaved rounds; Skal's spread is ±10% on the lazy
  arms, RN's is tight. No medians-of-many.

---

## 6. Not to build

- **Persistence improvements.** Measured as engine-bound at ~0.1 ms per
  persisted leaf; the state layer is noise there.
- **`snapshot()` on the new representation.** Already removed from the
  current store (§7); do not reintroduce it.
- **MINI as a user-facing API alongside `createSkalStore`.** Devs would
  have to split state across two systems and choose per-field which one
  persists.

---

## 7. Independent of all of the above

Both are live today and neither should wait on this plan.

- **`snapshot()` silently accepts mutation.** Verified: writing to a
  returned snapshot does not throw, the store reads back the mutated
  value, and **nothing is staged** — memory says 99, the UI still says 1
  (no effect fired), disk still says 1. A three-way inconsistency that
  surfaces as "my change vanished after restart". It is guarded by a
  doc comment and nothing else. Options: frozen deep copy (costs one
  O(n) pass, keeps the name), or rename to `unsafeRawSubtree()`. A
  plain `Object.freeze` is **not** available — it would freeze the live
  store data and break legitimate writes.
- **The stale-bundle guard.** `if (!cjs.existsSync())` in
  `scripts/templates/default`, `examples/gallery` and
  `examples/virt-bench` (only `examples/kitchen-sink` has the
  byte-comparing fix). `adb install -r` updates the APK and the app
  keeps running the previously extracted JS. It cost a full measurement
  round on 2026-08-02 and presents exactly as "my code didn't take
  effect". Workaround until fixed: `adb shell pm clear <pkg>` before
  every run.

---

## 8. Re-running

Harnesses are byte-identical in both apps (verify with `md5`):
`benchmark_v2/skal-bench/src/statebench.js` and
`benchmark_v2/rn-feed/statebench.js`. Adapters and DIAG/CTRL/MINI arms
live in `StateBenchScreen.jsx` and `StateBench.tsx`.

```bash
cd benchmark_v2/skal-bench && VITE_BENCH_SCREEN=state bun run build
cd flutter-host && flutter build apk --release --target-platform android-arm64
```

RN needs JDK 17 and an explicit SDK path — the system default here is
JDK 11 and gradle refuses it:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew assembleRelease
```

**Four harness rules this benchmark had to learn the hard way:**

- **`adb shell pm clear <pkg>` before every Skal run**, or you measure
  the previously extracted bundle (§7).
- **Hold the screen awake and assert it** — `svc power stayon true`,
  then check `dumpsys power | grep mWakefulness` in the same pass. A
  dozing screen inflated Skal's crypto numbers ~2× and left RN's
  untouched.
- **Match the access shape across arms.** MINI first read *faster than a
  plain JS object*, which is impossible for a signal read — it was
  indexing an array with an integer while every other arm built a key
  string with `key(i)`. The CTRL rows exist to separate those costs.
- **Give each arm its own store, and discard the warm-up.** Sharing one
  store leaked 200 subscribers between write arms; and a new persisting
  store stages its entire initial state, so iteration 0 flushes all 200
  frames regardless of `n` — left in, it made 1 changed leaf look
  *slower* to flush than 10.

---

## Related

- [`ENGINE_AND_REACTIVITY.md`](ENGINE_AND_REACTIVITY.md) — rungs 1 and 2.
- [`WEBCRYPTO_DISPATCH.md`](WEBCRYPTO_DISPATCH.md) — the other place RN wins.
- [`TODO_OPTIMIZATIONS.md`](TODO_OPTIMIZATIONS.md) §6 — the index entry.

---

*Last updated: 2026-08-02.*
