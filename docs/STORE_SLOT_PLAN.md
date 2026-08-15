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

### CORRECTION — 2026-08-05: the attribution INVERTED, and the fix was elsewhere

Re-measured against the rewritten store, same device, same protocol
(8 launches per arm, medians, A/B/A, arm asserted from the APK):

| | Displayed | in-memory | engine |
|---|---:|---:|---:|
| 2026-08-02, solid-js/store | +38.0 | **+26.5 (67–91%)** | +11.5 (24–30%) |
| 2026-08-05, own store | +34.2 | **+7.2 (21%)** | **+27.0 (79%)** |

**The rewrite already cut in-memory construction 3.7× — and nobody
re-measured.** Lazy version signals and lazy proxies removed the eager
init walk that §5b was written about; the walk this section says to fix
no longer exists. The total barely moved because the cost simply moved
house.

**What it moved to was not "engine open + hydrate" being slow. It was
hydration asking the wrong question.** `hydrate` walked the shape of
`initState` and asked the keydir, per DECLARED leaf, whether a frame
existed. A 4 500-leaf store whose `cells` object persists as ONE blob
therefore performed 4 500 point lookups across 18 batch crossings —
against a keydir holding **one record**. Verified directly:
`engineStats().records === 1` after a plain open and reopen.

### The fix, and what it bought

A key listing (`__skal_store_keys`, mirroring `getMany`'s wire format,
plus `allKeys()` on both backends), fetched once per open. Hydration
intersects against it instead of probing:

| | Displayed | 4 500-leaf cost | drift |
|---|---:|---:|---:|
| before | 433.0 | **+34.2** | −1.5 |
| after | 414.0 | **+19.0** | −8.0 |
| after two rounds of hardening | 411.0 | **+20.2** | −9.5 |

The third row is the same protocol re-run once the key listing had been
hardened twice (a testable encoder, guards on every decode, reads
counted at the engine boundary, collection elements batched). It sits
1.2 ms from the second against a 9.5 ms drift floor: **the hardening
cost nothing measurable**, and the 45% saving held.

**45% of the cold-start cost removed, 7.61 → 4.22 µs/leaf.** The change
is 15.2 ms against an 8.0 ms drift floor — under this repo's rules that
is proven, but only by ~2×, so it is reported with the drift rather than
alone.

The mechanism is confirmed independently of the timing, which is the
stronger evidence: `hydrateProbes()` counts the leaf frames actually
requested, and it is **0** for a 2 000-leaf store with one record on
disk, **200** when 200 leaf frames exist, and a blob parent still
overlays its leaf overrides correctly.

### Two harness faults found on the way, both of which would have lied

- The arm-identity check used `unzip -p … | grep -q`. `grep -q` exits on
  first match, `unzip` takes SIGPIPE, and `set -o pipefail` reports the
  SUCCESSFUL match as a failed pipeline — so it voided a correct build.
- `scripts/link-libskal-flutter.sh` installs into **kitchen-sink**, not
  skal-bench. The first three arms therefore ran against the previous
  day's libskal. Harmless there (all three shared it), fatal for the
  after-measurement: the shipped `.so` was dated 16:14 the day before and
  did not contain `__skal_store_keys`. Caught by asserting the symbol in
  the artifact rather than assuming the build reached the device — the
  rule this repo already has about several `libskal` copies not all
  exporting the same symbols.

### What this section originally pointed at

**Make Skal's init lazy, the way Solid's already is.**

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

### REACTIVITY PARITY RESTORED 2026-08-04 — and it cost nothing

All three regressions below are fixed, measured, and free:

| arm | before parity | after |
|---|---:|---:|
| leaf, parent hoisted | 0.0086 | 0.0087 |
| object + 6 fields | 0.0740 | 0.0747–0.0772 |
| write 1 leaf, 0 subs | 0.0018 | 0.0017–0.0022 |
| write 1 leaf, 200 subs | 0.1387–0.1431 | 0.1415–0.1435 |
| write 200 leaves | 0.62 | **0.599** |
| realistic frame | 0.0505 | 0.0509 |

All within noise; checksums and `assert_fail=0` intact. The reasoning
held: precision and speed are independent here, because the 3.3–5.2×
came from deleting a proxy layer and a per-read walk — not from being
imprecise about notification.

**A PROCESS FAILURE FOUND WHILE FIXING THIS.** Commit 9528792 claims to
have scoped `setAt`'s notification. **It never applied** — the edit was a
silent no-match in a `str.replace`, and it is absent from that commit and
every one after. The script even printed a count that would have exposed
it (`_isNode: 3`, where success is 5) and it went unchecked.

That invalidates §5c's conclusion. Hydration and `faultIn` go through
`setAt`, so the change said to target the lazy path never touched it. The
69 → 56.5 ms measured there came from `writeAt` alone, and "the fix
underdelivered, the attribution was wrong" was itself wrong — **the fix
was not in the build.** Every edit that matters now asserts its anchor.

### Re-render precision, verified on device 2026-08-04

`benchmark_v2/skal-bench/src/RerenderScreen.jsx` counts effect re-runs
and asserts exactly which fired. It lives on DEVICE because it cannot
live anywhere else — solid's scheduler never flushes headless, so
`bun test` observes no effect re-runs at all. **9/9 pass.**

| case | result |
|---|---|
| write x → only x re-runs | `{x:1, y:0}` |
| no-op write → nothing re-runs | `{x:0}` |
| replace parent → only the CHANGED leaf | `{name:0, age:1}` |
| replace parent, child `===` → child quiet | `{deep:0}` |
| splice at 1 → index 0 quiet, 1 + length fire | `{i0:0, i1:1, len:1}` |
| `items[1] = x` → only index 1 | `{i0:0, i1:1, len:0}` |
| same-shape replace → node holder quiet | `{user:0}` |
| shape change → node holder DOES re-run | `{user:1}` |
| deep leaf unchanged under a new parent → quiet | `{deep:0}` |

**The first run caught two real failures** (`{name:1, age:2}` and
`{deep:2}`). Cause: the get trap subscribes to every key it touches
BEFORE knowing whether that key is a leaf or a node, so reading
`s.user.name` subscribes to `user` as well. Bumping `user` on every
replacement therefore woke everything that had merely traversed it, and
the diff underneath could not help. The doubled counts were the parent
bump plus the leaf bump.

**Fix: bump the node itself only on a SHAPE change** — keys added or
removed, or node↔scalar, or object↔array. Same keys means nothing a
traverser read has moved, and the per-leaf bumps carry the news. A
holder that read the node and nothing else is correctly left alone,
because the node proxy is memoized by store key so its reference stays
valid.

That is MORE precise than solid-js/store, which notifies the node on any
replacement. Costs nothing measurable: every state-bench arm within
noise, `ck=613` and `assert_fail=0` intact.

### The three regressions (all fixed above)

Dropping `solid-js/store` cost precision, and the original commit
disclosed only one of these — framed as "a cost deliberately accepted"
rather than as a regression. All three verified against Solid's own
source in `solid-js/store/dist/store.cjs`:

1. **No-op writes now notify.** `setProperty` line 134:
   `if (!deleting && state[property] === value) return;` — Solid skips a
   write whose value is unchanged. `writeAt` has no such check and the
   version signals are `equals: false`, so `state.count = 5` when it is
   already 5 re-runs every subscriber. This bites the common pattern of
   assigning a whole payload from the network: every field re-renders
   even where nothing changed. **Fix: two lines, mirroring Solid —
   skip the bump when non-structural and `cur[last] === v`.**

2. **Structural replace over-notifies.** Solid diffed a replaced subtree
   and woke only leaves whose values changed; `bumpTree` sweeps every
   descendant that has a signal. Fix is a real diff — moderate work.

3. **Arrays are array-grained.** Solid creates a node per property
   INCLUDING array indices (`getNode(nodes, property, value)`) plus a
   separate `length` node, so a splice woke the affected indices. We
   subscribe every index read and every `length` read to ONE array-level
   key, so any mutation wakes every reader of the list. Fields inside an
   element are still per-leaf. Fix: per-index version keys — moderate,
   and it interacts with the id-addressed collection model.

None of these is unsound; all three are strictly MORE re-renders, never
stale UI. But "only the changed leaf re-renders" is now true for plain
leaves and false for the other two cases, and that was the store's
headline property.

**Cannot be unit-tested here** — Solid's scheduler does not flush
headless, so reactivity is only observable on device. That is exactly
why these went unnoticed.

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

**PREDICTION MADE HERE: fixing it takes lazy-500 from ~69 ms to ~18 ms.**

**IT DID NOT. Fixed 2026-08-03 and measured: ~69 ms → 56.5 ms median
(52.0 / 56.5 / 64.8), about 18%, with the ranges OVERLAPPING at the
boundary — 64.8 after against 64.9 before.** Eager is unchanged (8.0 vs
7.1–7.7). The change is directionally right and not proven.

**The attribution was wrong and the removal control is the authority.**
That is the third time in this session that segment-sizing failed under
a control — after the feed read benchmark (§5) and Solid's `createStore`
construction cost (§5b). Clock overhead alone (~1 ms over 1000 reads)
cannot explain a 47 ms error; the likely mechanism is that instrumenting
a hot function with paired `performance.now()` calls deoptimises it, so
the most heavily instrumented phase absorbs the distortion.

**CORRECTED 2026-08-04 — this conclusion was wrong.** The `setAt` half
of the fix never applied (silent `str.replace` no-match; see §5f), so
the 56.5 ms above was measured on a build that did not contain it. With
`setAt` genuinely scoped, **lazy-500 is 9.16 ms** (9.159 / 8.919 /
9.772) — 2.7× below the 25.1 ms it sat at afterwards, and **better than
the ~18 ms this section forecast.**

**The attribution was RIGHT.** `bumpTree` was dominating lazy hydration
exactly as the instrumentation said. What failed was my check that the
fix was in the binary.

So the standing rule needs stating more carefully than "never size a win
by instrumenting". Of the four over-predictions logged today:

- **feed reads (§5)** — genuine failure of SEGMENT-SIZE reasoning,
  confirmed by a positive control.
- **`createStore` construction (§5b)** — genuine failure, confirmed by
  ablation arms.
- **`bumpTree` (this section)** — **not a failure.** Correct
  attribution, measured against a build missing the fix.
- **batch get (§5e)** — real but small, with a specific cause: the
  attribution had gone stale, having been taken before A+B+C removed the
  wrapper on that same crossing.

**The honest rule: attributions are hypotheses with a shelf life, and
they must be re-checked against the build that actually ships. Two of
today's four "failures" were mine, not the method's.**

The change was kept, because it carries a genuine correctness fix
alongside the (unproven) performance one — see below.

### Caveat on the absolute numbers

Instrumented total was 11.1–12.6 ms against 7.1–7.7 ms clean, so the
clock reads cost ~1 µs each and every phase carries about one of them.
**Treat the RATIOS as the finding, not the absolutes** — subtracting
~1 µs per phase gives roughly get 4.3, setAt 1.6, decode 0.8, and the
ordering is unchanged.

### 2026-08-03 — three lossless changes, measured as one

Bundled deliberately so the result is a total, not an attribution:

- **A** the engine key `'k:' + childSk` was built TWICE per record (once
  for `dirty.has`, once for `engine.get`). Built once.
- **B** `NativeLogStore.get` wrapped its result in `new Uint8Array(ab)`;
  `TextDecoder` takes an `ArrayBuffer` directly and every caller hands
  it straight to `decodeFrame`. One allocation per record removed.
- **C** hydration routed every leaf through `setAt`, which re-resolves
  from the ROOT per record — O(depth) of redundant walking plus a
  `childSp` allocation. `hydrate` now carries the live parent, so a leaf
  is one property assignment. Notification is unchanged: skipping it
  would be wrong, because `createSkalStore` returns the proxy before
  `init()` finishes, so a component can subscribe mid-hydration.

**Result — lazy open + read 500: 56.5 ms → 31.1 ms median** (25.8 /
31.1 / 36.2 vs 52.0 / 56.5 / 64.8). **Ranges do not overlap; this one is
proven.** Cumulative for the day on that arm: ~69 → 31.1, **2.4×**.

**Eager is unchanged** (~7.5 ms vs 7.9–8.1), and so are both read-5 arms.

**Which change did it is NOT known, and deliberately so** — they were
bundled to get one honest total. But the shape is informative: C targets
the EAGER path and eager did not move, so hydration's per-record walk
was not a real cost. The lazy win must come from B, the only change on
the `faultIn` path — an inference, not a measurement.

That makes two intuitions today that looked substantial and paid
nothing (hydrate's walk, and `bumpTree`'s 72–77%), against one
unglamorous allocation that apparently paid a lot.

**Unchanged vs RN**: eager-500 is still 7.5 ms against MMKV's 0.662 ms,
~11×. Lazy is no longer catastrophic but eager remains the right choice
for bulk, and the gap to MMKV is untouched.

### Batch get MEASURED 2026-08-04 — works, under-delivers

Built locally against this branch: bun's Android cross-build (ICU + JSC
were already cached, so the CMake-4 problem that breaks
`build-jsc-android.sh` never applied), then `link-libskal-flutter.sh`
relinked from source, `.so` verified to export `__skal_store_get_many`,
and the APK verified to carry it. **No push, no CI, and nothing near the
`libskal-dev` rolling release that `npm create skal` users resolve
through.**

The screen asserts which path ran — `native batch get available? YES`
on every round. Without that, the correct-but-per-key fallback produces
entirely plausible numbers for the wrong code.

| open + read, cold | per-key | **native batch** |
|---|---:|---:|
| EAGER 500 | 6.5–8.1 | **5.853** (5.675 / 5.853 / 6.554) |
| EAGER 5 | 4.6–6.0 | **3.455** |
| LAZY 500 | 31.1 | 25.1 — overlapping; `faultIn` does not use getMany |
| LAZY 5 | 2.08–2.76 | 2.169 |

~11% against the immediately-prior run with identical JS (6.551), ~22%
against the pre-batch-JS baseline (7.515). **Not the ~2× that "the
crossing is 51% of per-record time" implies.**

**Fourth over-prediction from segment sizing today**, after the feed
reads (§5), `createStore` construction (§5b) and `bumpTree` (§5c). The
probable cause here is specific and worth remembering: the A+B+C change
had already removed the `Uint8Array` wrapper on that same crossing, so
**the 51% was measured on a code path that no longer existed by the time
the batch landed.** An attribution has a shelf life.

**RN is still ~9× ahead on this arm** (0.662 ms). Narrowed, not closed.

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

## 7b. The under-notification class (found 2026-08-04, all fixed)

An independent review of the rewrite found **fifteen** issues; five were
silent under-notification and all five reproduced. They are recorded
together because they share one signature, and that signature is the
lesson:

> **The store kept serving the correct value.** Every one of these bugs
> is invisible to a test that writes and then reads. Only a subscriber
> count sees them.

| what stopped re-rendering | why |
|---|---|
| `list.map(...)` / `filter` / `for..of` / spread, on an element FIELD write | iteration binds to the RAW array, so it can only depend on `sk#all`, which no leaf write bumped |
| a spliced-out element that is re-inserted | its signals were pruned while its memoized proxy kept serving the dead getter from `verCache` |
| a held element proxy after `state.items = [...]` | `bumpReplaced`'s array branch returned after the index bumps and never recursed into `items.<id>.<field>` |
| index-1 subscribers on a MIXED array after a splice | `pruneVersRecords` cannot tell an element `_id` from an INDEX — the same collision the memo key namespace had already fixed for `nodeMemo` |
| a write into a vivified parent (readable in `root`, not through the store) | `cur[k] = {}` did not advance `structGen`, so cached resolutions kept serving `undefined` |

Two further notes worth keeping:

- **The memo fix disabled the memo.** Namespacing element proxies under
  `items.<id>\0id` put them outside every branch of `dropMemo`'s prefix
  matching, so no removed element proxy was ever evicted — and each one
  retained, through its `verCache` closure, the very signals
  `pruneVersRecords` deleted. `versions()`, added in the same diff to
  watch for exactly this leak, therefore reported it as FIXED. **One
  number was not enough to see its own blind spot**; `memos()` now sits
  beside it.
- **The test that should have caught the worst one passed over it.**
  `array methods track: map / filter / for..of / spread` mutates with
  `push`, which is STRUCTURAL, and structural mutations do bump `#all`.
  Coverage of the right API surface with the wrong mutation is not
  coverage.

**Cost of fixing all of it: nothing outside the drift floor.** A/B
interleaved on host JSC, medians of 9, with an A/A control per arm:

| arm | HEAD | fixed | delta | A/A drift |
|---|---:|---:|---:|---:|
| leaf write, plain object (the hot path) | 0.1293 | 0.1246 | −3.6% | +1.6% |
| leaf write inside a collection element | 0.4612 | 0.4676 | +1.4% | −2.9% |
| collection read sweep, 200 rows | 0.0610 | 0.0631 | +3.5% | +1.2% |
| iterate 200 rows with `map` | 0.0015 | 0.0016 | +5.9% | −2.5% |
| array push + splice | 0.0043 | 0.0042 | −2.9% | +1.9% |
| wholesale array replace, 50 elements | 0.0034 | 0.0036 | +7.1% | −1.8% |

That is the SECOND version of this table. The first was honest and bad:
**+46% on the read sweep and +474% on wholesale replace.** Both were
mine, both were the same mistake in different places — putting work in a
path that runs far more often than the case it serves:

- the owning-array key chain was rebuilt inside the array get trap, so
  every element read paid a string concat and an array allocation even
  on a memo hit (the argument is evaluated before `makeNode` can return
  the cache). Hoisted to the `arrayProxy` closure, where `sk` and
  `elInfo` are constants.
- the per-element diff ran on every wholesale replace, including arrays
  that had never handed out an element proxy and so could have no
  holder. Gated on a per-array flag set when such a proxy is created.

A third: the owner wake forced `batch()` on every write inside a
collection element (+12.3%, against a −1.8% drift — the one delta that
was real). `#all` only has a signal if something actually iterated, so
checking first lets the write path skip the batch entirely.

**Verified 15/15 on device** (`RerenderScreen.jsx`, Galaxy A14, release)
and by 12 new unit tests, every one mutation-checked. One mutant
survived the first pass — dropping the ancestor chain from `allKeys` —
because the nested-array test reached the element's `elInfo` directly
and never exercised the chain. A leaf under a nested array now covers
it. One line is deliberately kept without a failing test: `setAt`'s
`structGen++` on vivification, which is unreachable today because
`setAt`'s only proxy caller re-resolves from the root every access. That
was checked, not assumed, and it is labelled as such in the source.

---

## 7c. Round two — the review reviewed the fixes

A second independent pass over §7b's fixes found **twelve** more, six of
which reproduced empirically. **Four were introduced or left unfinished
by round one**, which is the headline: the round that fixed silent
under-notification shipped more of it.

| what broke | mine? |
|---|---|
| splice read `_isColl(a)` AFTER `mutateAt` spliced `a` in place, so a cold `collCache` classified the POST-splice array — the removed element's frame was never tombstoned | yes, and the comment claimed "PRE-splice" |
| ids only in the NEW array got a bare `bumpKey(items.<id>)`, which cannot reach a subscriber on `items.<id>.title` — a row that disappears and comes back goes stale | yes: a documented trade whose own comment named the case it failed |
| the `elemProxied` gate skipped INDEX-addressed element proxies entirely — every non-collection array of objects | yes |
| the vivified write was correct in memory and GONE on reopen: only `k:a.b.c` was staged while `k:a` still held the clobbered scalar | yes — the test asserted memory only |
| `writeAt` kept caller `_id`s without seeding `genId`, so a later push reissued a LIVE id and destroyed a row | pre-existing |
| splice's collection branch wrote element frames straight to `dirty`, bypassing `persist: false` — verified by finding the plaintext value in a segment file | pre-existing |
| `setAt` never called `_skalNotify`, so lazy fault-in / array hydration / LRU eviction never reached declared-dep effects | pre-existing |

Plus one dual-representation footgun in `hydrate` (raw scratch views
below 256 keys, decoded values above, behind a `preDecoded` flag — now
one representation), the file's only ungated `policyFor` on its
highest-volume caller, a five-way copy-paste of the owning-array wake
(now one `bumpOwners`), and a double copy in `LogStore.getMany`.

### The perf lesson, which inverts §7b's

Fixing these looked like a **+20% regression on wholesale replace**, and
a bisect said the whole of it was the id-seeding scan I had just added —
**not** the per-element diff, which §7b had blamed for +7% and which
turns out to be free:

```
baseline (all round-two fixes)                delta +21.5%   drift +0.3%
without the new-only element walk             delta +17.9%   drift -2.8%
without the byIx Set.has                      delta +19.2%   drift -4.4%
without the id-seed scan                      delta  -4.6%   drift -3.6%
without the id DIFF entirely                  delta +18.8%   drift -1.8%
```

The scan only has to run before the next id is minted, so it now waits
in `genId` — once per new element instead of once per replace. And when
every element already carries an id (the server-payload case) the
rebuild `.map` is skipped entirely, which is why the arm ends up
slightly FASTER than before the fix.

**A combined harness could not resolve the hot path.** Its A/A drift on
`leaf write, plain object` swung ±13% across runs, producing deltas from
−3.8% to +43.8% for identical code. One arm alone, 200k writes, 21
rounds, A/B/A:

    HEAD 0.0794 us   fixed 0.0770 us   delta -2.9%   A/A drift -1.9%

Final, all arms, medians of 9 with an A/A control (host JSC, bun — a
relative comparison of JS-only work, not a device number):

| arm | delta | A/A drift |
|---|---:|---:|
| leaf write, plain object | −1.6% | −4.6% |
| leaf write inside a collection element | +3.2% | +1.1% |
| collection read sweep, 200 rows | −2.4% | −1.6% |
| iterate 200 rows with `map` | −0.7% | −0.9% |
| array push + splice | −21.4% | −6.0% |
| cold open + hydrate 500 leaves | −2.0% | −3.4% |
| wholesale array replace, 50 | −0.1% | −4.1% |

Nothing exceeds its drift floor. **17/17 on device**, 204 unit tests,
every fix mutation-checked with no survivors.

### Three things the mutation pass caught that review did not

- A seeding test used `_id: '5'` and one push, so `genId` never reached
  the collision and it passed with the fix deleted. Ids and pushes now
  chosen so the counter actually collides.
- A splice test asserted only that cold and warm agree — satisfied by
  "always a collection" as well as by the right answer. A second case
  now pins the answer itself.
- Gating tombstone, `dropMemo` and `pruneVersRecords` together on the
  persistence policy leaked 181 proxies on a `persist: false`
  collection. The tombstone is persistence; the other two are memory
  hygiene and must run either way. Caught by the memo-count test, which
  is precisely why it asserts a number rather than a value.

---

## 7d. Round three — and the matrix that should have existed first

A third review found **fourteen** more; seven reproduced empirically.
**Eight were mine from rounds one and two.** The worst was an
optimisation from the same session: deferring the id-seeding scan to
`genId` (to kill the +20% in §7c) reintroduced the exact data
destruction seeding exists to prevent, moved across a restart —
`doFlush` writes `nextId: nextIds.get(sk) || (a.length + 1)`, so a
wholesale assign that flushed before any push persisted `nextId: 2` for
`[{_id:'2'}]`. Reopen, push once, two elements collide on `items.2`,
server row gone. **My test for it pushed before flushing**, which drains
the deferral and steps around the hole I had just opened.

The same deferral was also wrong in memory: it scanned the array as it
existed at DRAIN time, so assigning two ids, splicing both out and
pushing reissued `'1'` — an id `pruneVersRecords` had already deleted
the signals for. **The deferral is gone.** `seedIds` runs at assign
time, which costs ~+20% on a 50-element wholesale replace (0.0034 ->
0.0040 ms, drift ~1%). That is the honest price of not destroying rows,
and it is recorded rather than optimised away a second time.

Also fixed: `writeHydrated` (the path EVERY eagerly hydrated leaf takes)
never told declared-dep effects anything, so fixing `setAt` in §7c left
the common case broken; `setAt`'s whole-tree branch returned before the
notify, so a version migration reached none of them either; degrading a
collection left a stale `#x` index that `hydrateArray` reads FIRST,
silently dropping everything added after; `doFlush` ran `delPrefix`
before writing the batch, so a leaf staged earlier in the same window
resurrected on reopen; the truncation path never pruned version records
(401 live signals where splice left 202) and wrote tombstones for
`persist: false` records; nested arrays inside elements never marked
`elemProxiedByIx`.

### The pattern, and what was done about it

Three rounds, twenty-six defects, and the ones I introduced cluster on
exactly three axes:

1. **the PERSISTENCE half of an in-memory fix**
2. **the OTHER addressing scheme or nesting level**
3. **the OTHER call site of the same function**

Hand-written cases kept missing the same three. So the suite now
GENERATES the cross product: every mutation (leaf write, index assign,
push, splice out, splice in, truncate, reverse, delete-a-field) against
every array shape (collection / mixed / nested-in-element) under both
persistence policies, each checked by four observers — value, iteration
re-runs, held-element-proxy re-runs, and signal/memo growth — plus a
reopen and a `persist: false` staging check.

**It found four more real bugs on its first run**, none of which were in
the review: index assign never notified the element's dotted keys (all
three shapes); `persist: false` was bypassed by index assign, by
`reverse`, and by deleting a field inside an element; and `stageAt`
staged per-element frames for arrays whose elements have no ids, writing
an index of `ids: [undefined]` that lost the whole array on reopen.

The matrix documents its one accepted gap explicitly: a proxy held
across a `splice out` or `truncate` is not notified, because
`pruneVersRecords` deletes those signals so the id can never be reused.
The list-level notification is the channel that unmounts the row, and
the iteration observer asserts it.

### Measurement note

The combined A/B harness **cannot resolve the plain leaf write**. It
reported +6.3% to +12.9% across runs for code an isolated A/B/A measured
at -2.1%, +0.2% and +3.7% (drift 1-2%). Two instruments, same code,
opposite answers. Ruled out in order: arm ORDER (alternating A,B/B,A per
round changed nothing), JIT warm-up (a 5000-iteration warm-up outside
the timer changed nothing), and sample size (the isolated harness reads
+0.2% at N=20 000 and +3.7% at N=200 000 — both at the floor). What is
left is cross-arm interference: five other arms allocating stores and
churning the heap between measurements. **For a single hot arm, use the
isolated harness**; the combined one is for arms whose deltas are large.

Final state: **343 unit tests** (the matrix is ~130 of them), **17/17 on
device**, every fix mutation-checked with no survivors across all three
rounds.

---

## 7e. Round four — a crash, and a flaw in the mutation harness itself

Fourteen more; four reproduced immediately, including the first **crash**
in this whole sequence.

| | mine? |
|---|---|
| `items.length = 4` on a collection threw `undefined is not an object (evaluating 'el._id')` out of the proxy set trap — `_isColl` and `every` SKIP holes, `for...of` does not | **pre-existing** (HEAD has the same shape); my extra `every` guard neither caused nor fixed it |
| `reorderBy` was the only mutator that never touched `collCache`, so a `fill` that degraded a collection left the cache asserting "collection" and the next push erased the primitives on reopen (`[5,5,{q:1}]` in memory, `[{q:1}]` after) | yes |
| vivification bumped the leaf but never the materialised ANCESTOR: `s.a` kept serving the stale `5` while `s.a.b.c` read 7 | yes — round three fixed the disk half of this exact scenario and left the reactive half |
| a null return from the native batch meant "every key missing", and my epoch guard added two new null paths — up to 256 persisted leaves per chunk would revert to initState and be flushed back over the real data | the hazard is mine |
| `del`/`delPrefix` never bumped `get_epoch`, so my own guard did not uphold the invariant its comment claimed | yes |
| `reverse` left INDEX-addressed element proxies stale (found by the matrix, not the review) | pre-existing, unfixed by round three |

Plus: the `elInfo` literals were rebuilt inside the get trap on every
element read — the exact per-read allocation the `allChain` hoist was
added to remove, reintroduced two rounds later by adding `allKeys` to
them; `delPrefixLater` scanning `dirty` per assign; three copies of the
id-seed scan; eleven copy-pasted persistence gates (now `persists(k)` /
`policyOf(k)`); a 16 MB caller-controlled allocation in the zig; and
`{ persist: true }` in every persistence test — **not a recognised
config key**, silently ignored, reading as an opt-in that never existed.

### The mutation harness was lying

`#3`'s declared-dep test was appended and mutation-checked in the same
step, **without first confirming it passed on unmutated code**. It did
not — the declared-dep flush is scheduled, not synchronous, and the test
asserted immediately. A test that fails both with and without the
mutation reports **KILLED**. Four of that round's checks were worthless
and looked green.

The harness now runs the baseline first and refuses to report on a
filter that is not green (and not empty — a typo'd `-t` matches zero
tests and also "passes"). Same class as everything else in this file:
the instrument agreed with itself.

### Perf

The vivification fix cost **+6%** on a write inside a collection element
— a `const bumpViv = vivKeys === null ? null : () => {...}` closure
variable on the hot path. Inlining the loop into the two `notify`
callbacks put it back at the floor:

| arm (isolated, medians of 15) | delta | drift |
|---|---:|---:|
| leaf write, plain object | −2.0% | +0.6% |
| leaf write inside a collection element | **+0.9%** | −0.9% |

The combined harness read the same code at **+20.9%** and **+9.0%**. It
still cannot resolve these arms; §7d has the ruled-out causes.

Standing after four rounds: **347 unit tests, 17/17 on device**, every
fix mutation-checked against a verified-green baseline, no survivors.

---

## 7f. Round five — the collapse, and why the count kept not falling

Twelve findings. **Five of them were one cause**, and that is the
finding worth keeping:

> `stageAt` used **"are all the elements objects?"** to answer **"can
> this be stored as per-element frames?"**, and the four array mutators
> each maintained the `#x` index frame by hand.

`_isColl` and the format question agree until an array is all-objects
WITHOUT ids — which happens whenever a whole-array frame comes back off
disk, or a splice removes the primitive that made a mixed array mixed.
Every site that conflated them wrote an index of `ids: [undefined]`, and
`hydrateArray` reads `#x` FIRST, so the index masked the real data.
Reported as five bugs (splice, degrading index-assign, promoting
index-assign, extending `length`, `delete`), all silent on disk and
invisible in memory.

### What changed

- **Two named predicates.** `_isColl` answers ADDRESSING (id vs index);
  `_isIdColl` answers FORMAT (dense array of `_id`-carrying objects).
  `_isColl` uses `every`, which skips holes; `_isIdColl` walks by index,
  which sees them.
- **One `stageArray(sk, value, changed)`** owns an array's on-disk
  representation and the `#x` index that selects it. All four mutators
  call it; none can get it wrong separately. `changed` keeps the
  deferred-element-frame win (a push must not re-encode the collection).
- **`tombstoneTree` matches the format actually written**, so deleting
  an id-less object array deletes the blob rather than only an index
  that was never there.

Four of the five bugs disappeared the moment the mutators were routed
through one function — before any of them was addressed individually.

### Also fixed

`persist: false` leaked through **any** wholesale object assign over a
subtree containing a non-persist leaf, not just the vivification path
the review named — `s.a = {secret, b}` blobbed the secret into `k:a`
because the policy was only consulted for `a`. Plus: the
addressing-scheme sets grew without bound under element churn (nested
arrays intern `items.<id>.tags`; now swept by `pruneVersRecords`, and
counted by a new `proxied()` — a leak nobody counts is a leak nobody
finds); `hydrate` no longer purges staged writes made during the async
init window; three inlined copies of the persistence gate; a dead
`i === 0 &&`.

### Two matrix axes it was missing

The generator now has an **`idless`** shape (all objects, no ids — the
shape all five bugs lived in) and a **flush between the seed and the
mutation** (without it the two land in one batch and the mutation's
frames overwrite the seed's, which hides every stale-frame bug). Both
were needed for any of this to be caught mechanically.

### Perf, and a mis-attribution corrected twice over

The first fix for the `persist: false` leak recursed per key whenever
the store had ANY non-persist rule: **+449%** on object assign. Scanning
the rule list instead was still **+47%** — `sk + '.'` allocates a string
per call on a per-write path. A precomputed ancestor Set is one hash
lookup: **+3%**.

A bisect on the remaining wholesale-array-replace regression put it
squarely on `delPrefixLater`'s dirty purge, **not** on the id-seeding
scan §7d blamed for the same arm:

```
baseline (all of this branch)          +29.1%   drift +6.1%
without the id-seed scan               +32.5%   drift +4.5%
with _isColl instead of _isIdColl      +27.2%   drift -3.7%
without delPrefixLater's dirty purge    +7.1%   drift +0.6%
```

That purge stays: it is the difference between a deleted leaf staying
deleted and resurrecting at the next open, because `doFlush` runs
`delPrefix` before writing `dirty`. The cost is now recorded at the
call site instead of being rediscovered.

| arm (medians of 11, A/B/A) | delta | drift |
|---|---:|---:|
| leaf write, plain object | +3.3% | −0.4% |
| leaf write inside a collection element | +3.9% | −0.7% |
| array push + splice (persisted) | −2.3% | +0.3% |
| wholesale array replace (persisted) | +21..29% | ±3% |
| object assign, store has a non-persist path | +3% | — |

### The answer to "why does it keep finding more?"

It was not finding new kinds of defect. It was finding **one invariant
applied to a subset of its sites**, once per site. Twelve sites touched
`#x`; twenty-six expressed "is this a collection?"; four mutators had to
agree on both. A rule written as a convention at N places generates N
chances to be wrong, and each round's fixes added another convention.

Making the two invariants into two functions is what changed the shape
of the problem. **402 unit tests, 17/17 on device**, every fix
mutation-checked against a verified-green baseline, no survivors.

---

## 7g. Round six — `delPrefix` had never once deleted anything

Fifteen findings. One of them is the largest single defect in this whole
sequence, and it predates every round:

> Every engine key is namespaced **`'k:' + sk`**. `doFlush` handed
> `delPrefix` the **bare `sk`**, so it tested `startsWith('a.')` against
> `'k:a.b.c'` and matched nothing — on **both** backends, since the JS
> one mirrors the native matcher.

`delPrefix` is what sweeps stale leaf-override frames when a wholesale
assign invalidates a subtree. It has been a no-op for the life of this
branch. Reproduced: `s.a.b.c = 1`, flush, `s.a = {x:2}`, flush, reopen
→ `{x:2, b:{c:1}}`. The deleted leaf comes back.

**Every test of this passed** because they all used a SINGLE flush
window, where `delPrefixLater`'s dirty purge covers it. Two windows is
what exercises the native sweep, and nothing had two. §7f even
documented and priced that purge — the +22% is real, but it was buying
half of what the comment claimed.

Also fixed: `fill`/`copyWithin` destroyed collection elements without
notifying or pruning any ID-addressed holder (`reorderBy` treated the
whole family as "only moves things", true for sort/reverse only); the
blob branch of `stageArray` orphaned a generation of `k:sk.<id>` frames
per degrade/re-promote cycle; `LogStore.getMany` resolved every key
twice, and the second resolve re-reads a whole segment file on an
8-entry-LRU miss — now one pass copying into a growable scratch, which
has neither the retention of the buffered version nor the double read;
the zig epoch check moved above the realloc, so a refused batch can no
longer permanently raise resident memory.

### The matrix had no `fill`, no `copyWithin`, no `sort`

`reverse` was its only `reorderBy` entry, and `reverse` is `indexOnly` —
so neither the `!indexOnly` staging path nor the element-DESTROYING half
was ever generated, for any shape. That gap is exactly what hid the
`fill` bug. All three are in now.

### Two lines kept without a test, and labelled

`stageArray`'s id branch retiring the blob, and its mirror in
`tombstoneTree`. The resurrection they were reported for DID reproduce,
but it stops reproducing with the `delPrefix` namespace fix alone, and
removing **both** leaves the suite green — checked, not assumed. They
stay because "one owner decides the format" is not satisfied by an owner
that writes one representation and leaves the other on disk. Labelled
defensive at both sites, matching the precedent for setAt's vivify
`structGen`.

### Process notes

- **Five mutants survived the first pass**, because the fixes were made
  against a probe file that was then deleted without being converted
  into tests. The probes proved the bugs; nothing pinned the fixes. All
  five now have tests and all five die.
- **The first perf run was void** — every arm's A/A drift was +20..35%
  because the zig build was still running on the same machine. Re-run
  idle. This is the same "rule out the tool" discipline the browser-pane
  and stale-bundle rules exist for, applied to my own background job.
- 34 unrelated bridge tests failed mid-round; that was my probe file
  leaking a global, not the change. Confirmed by deleting it.

| arm (medians of 11, A/B/A, idle) | delta | drift |
|---|---:|---:|
| leaf write, plain object | +3.9% | −1.7% |
| leaf write inside a collection element | +2.1% | +0.3% |
| array push + splice (persisted) | −1.2% | −1.9% |
| wholesale array replace (persisted) | +15..30% | ±5% |
| cold open + hydrate 400 leaves | −2.1% | −6.5% |

The replace arm remains dominated by `delPrefixLater`'s dirty purge —
now buying the whole invariant rather than half of it.

**473 unit tests, 17/17 on device**, zig builds ReleaseFast for
`aarch64-linux-android`.

---

## 7h. Round seven — and the rule that should have been in force

Fourteen findings. **Four were regressions from round six**, and three of
those four came from work nobody asked for — orphan cleanup and a tidier
argument, bolted onto a reported fix. Round six's *reported* bugs were
all still fixed; the damage was entirely in the adjacent tidying.

The worst: `delPrefixLater` had no empty-`sk` guard, so a root-level
array made the prefix `'k:'` — which matches `k:#meta`. A push
tombstoned the store's version and shape metadata. `tombstoneTree` and
`writeAt` both guard with `sk &&`; the one I added did not.

Second worst: `reorderBy`'s `goneIds` prune ran on index-addressed
arrays, deleting index-N's live signals under the guise of "removing
element id N". **That is the id-vs-index collision splice already guards
against, with a comment three lines away describing it.** I read that
comment and wrote the bug next to it.

Also: `arrayProxy.persist` was the last stageAt caller without a policy
gate (`s.secrets[0].tags.push()` wrote a `persist: false` element to
disk); the `missing` scan threw on a sparse array where the `.map` it
replaced never did; `push(undefined)` was swallowed by setAt's no-op
guard; splice and `length` never diffed by slot for index-addressed
holders; an index assign that changed an element's `_id` orphaned the
old frame, memo and signals; `_perKey` returned ArrayBuffers where the
contract says Uint8Array.

### The rule

**Fix what reproduced. Nothing adjacent.** Three of this round's four
self-inflicted defects were unforced improvements. The discipline is not
"be more careful" — it is to stop making changes no finding asked for.

### Two guards kept without a test, both labelled

- `delPrefixLater`'s empty-`sk` guard is unreachable given the
  `hadElementFrames` gate that landed with it. Both survive mutation;
  neither is redundant, because they protect different things ("is there
  anything to sweep" vs "is `sk` even a prefix").
- The scalar-delete `bumpKey`-instead-of-`bumpTree` is equivalent by
  construction, so no test can distinguish it. Asserted by reading, and
  said so at the site.

### A cost nothing could see

`delPrefixLater` was registering a sweep on every push to a plain
`number[]` — a full-keydir scan per flush for a namespace that has never
held a `k:sk.*` record. `records` cannot see it (sweeping nothing
deletes nothing), so it is now counted: `prefixSweeps()`, alongside
`versions()` / `memos()` / `proxied()`. The test asserts **zero** for a
plain array. Every one of those four counters exists because a leak
went unnoticed until a number moved.

### Corrected

Round six's finding about root-level arrays claimed the push was lost.
It is — but **root arrays have never persisted, at HEAD or now**. That
is a separate unsupported shape, and the test asserts only what the
finding was actually about: that a mutation cannot take `#meta` with it,
observed through `migrate()` still running on reopen.

**484 unit tests, 17/17 on device**, zig `ast-check` clean.

---

## 7i. Round eight — and an audit of what the tests actually assert

Ten findings, all fixed. Four mattered:

- **A collection replaced by a NON-array never retired `#x`.** `stageArray`
  is the documented single owner of the index, but `stageAt` only routes
  there when the new value IS an array — so `s.items = 5` left the index
  behind and hydrateArray, which reads it first, rebuilt the old
  collection over the scalar. Same masking as the degrade case, one
  shape further out.
- **`vivKeys` was built from the RESOLVED path.** `concreteOf` turns
  `{__id:'1'}` into an index, so the ancestor bump targeted
  `items.0.meta` while the proxies had interned `items.1.meta`. It
  reached nobody, and on a mixed array it would wake an unrelated slot.
- **The `old === v` no-op return fired AFTER vivification had already
  clobbered the ancestor.** `held.c = undefined` destroyed `s.a = 5` in
  memory with nothing notified and nothing staged; disk still said 5.
- **A truncation re-encoded every survivor** — `length = 40` on a
  50-element collection staged 52 frames where a push stages 3. No
  surviving element's bytes change; only membership, which lives in `#x`.

### The fixture that made 44 tests duplicates

`SHAPES.idless` was **byte-identical to `SHAPES.mixed`** — including the
primitive whose entire purpose is to distinguish them. For three rounds
the id-less axis existed only in the persistence loop, which compensated
with a `splice(2,1)`. It was cited three times as evidence that class
was covered. Now `[{v:1},{v:2}]`, and the compensating splice is gone.

## The audit

**Static:** 112 hand-written tests, zero with no `expect`, zero
duplicate bodies, one loose bound (a timing guard).

**Mechanical mutation sweep** — delete one effectful statement at a time
(`bumpKey`, `dirty.set`, `dropMemo`, `_skalNotify`, `stageAt`, …) and see
whether any of the 489 tests notice:

> **24 of 45 survived.** Over half the store's effectful statements could
> be deleted with the whole suite green.

Splitting them by reading each site:

**Genuinely redundant** — another line already covers it, so deletion is
safe: `bumpKey(_all(sk))` inside `bumpArray` (every array mutator bumps
`_all` in its own notify block), the `bumpIndices` calls that the new
by-slot diffs now subsume, five `scheduleFlush()` (tests call `flushNow`
explicitly), three `collCache` writes (a cache — deleting a set only
forces re-derivation), and `nodeMemo.set` (memoisation, not behaviour).

**Real coverage gaps.** The sharpest: `bumpOwners(elInfo)` in
`reorderBy`, in the length setter and in the index-assign path — round
ONE's headline fix, reachable and correct, covered by nothing. The
`nested` matrix shape only ever observed the INNER array. Adding an
outer-iteration observer for that shape took the sweep from **24/45 to
21/45** and added 11 tests.

### Closing them

Written from the SITE rather than from a behaviour someone thought of,
which is the difference between a suite that grows and one that covers:

```
24/45 survived  ->  21  ->  13  ->  8
```

The tests that moved it: index readers on reverse/truncate (`bumpIndices`
— `s.rows[1]` subscribes to `rows#1`, a different key from the by-slot
`rows.1` diff added later); declared-dep effects on an ordinary leaf
write and on an index assign; leaf overrides under a deleted subtree;
a vivified ancestor not carrying stale siblings back; non-persist
SIBLINGS still persisting; the debounced flush landing without
`flushNow` on four separate write paths; proxy identity; the memo not
growing across DISTINCT deleted keys (the first version reused one key,
so the memo never grew and the test could not see `dropMemo` at all);
`bumpArray`'s `#all` on the grow path (on a wholesale replace
`bumpKey(sk)` already wakes iteration, so `#all` is redundant THERE —
assigning past the end is where it is the only bump).

**Two of those tests failed when first written, and both times my
expectation was wrong, not the code.** One asserted a deleted subtree
reads back `undefined`; it reads back the initState default, because a
delete removes persisted state, not the schema. At HEAD the same case
returned the deleted data — that is round six's `delPrefix` fix, now
covered.

### The eight that remain, classified

Not gaps. Recorded at the bottom of the test file with the reasoning:

- **`structGen++` in setAt's whole-tree branch** — only caller is
  migrate, which runs before any proxy exists. Unobservable.
- **Three `scheduleFlush()`** — empirically redundant: the debounce
  tests exercise all three paths and stay green with the line deleted,
  because another call on the same path arms the same timer.
- **`nodeMemo.set`** — `kidCache` already returns the same child proxy
  for repeated access through one parent. Affects how often a proxy is
  rebuilt, never what it reads.
- **Three `collCache` writes** — a cache of "is this a collection?".
  Dropping a write only forces re-derivation.

A statement that survives is either covered by a test that does not
exist yet, or one of these eight. **That distinction is the only thing
the test count cannot tell you**, and it costs 90 seconds to get.

### What the audit is for

A suite is not measured by its test count. 489 green tests coexisted with
half the store being deletable, and the one number that showed it took
90 seconds to produce. **Run this sweep before trusting the suite**, not
after a reviewer finds the hole.

**518 unit tests, 17/17 on device**, zig `ast-check` clean.

---

## 7j. Rounds nine to twelve — the cost of unforced tidying

The finding count did not fall. Reviewing `d3d582d` — the commit whose
whole subject was *fixing* the previous round — returned **fifteen**,
and roughly half were defects that commit had introduced. Not
pre-existing holes it failed to close: new ones.

Every one traced to the same habit. While fixing a verified finding, the
diff also tightened three things nobody had reported:

- a conjunct dropped from splice's `wasColl` (`cachedColl !== false`),
  which let a degraded array be pruned by id;
- `releaseElements` moved into its own `notify()` batch, doubling the
  re-runs for any consumer both batches reach;
- `hadElementFrames.add(sk)` gated on `list.length > 0`, which lost data
  on reopen — a store written as `items: 5` read back `items: []`.

None was requested; all three were regressions. The fix was to **revert
them rather than patch them**, and only then close the two genuine
holes. That is the rule this round bought:

> **Fix what reproduced, nothing adjacent.** A tidy-up inside a fix
> commit gets none of the scrutiny the fix gets, and ships with its
> authority.

One of the fifteen did not reproduce at all (id minting into a mixed
array: `[{a:1},{a:2},7]` came back unchanged). Reproducing before
accepting remains worth the minute it costs.

### A failing test of my own found the bug the review missed

The last two mutants needed tests, and the one written for the length
setter **failed against correct code**. Chasing why — rather than
adjusting the assertion until it passed — turned up a defect fifteen
review findings had not:

`collCache.delete(sk)` in the length setter re-derives the format cache,
and a re-derive is allowed to **promote**. Truncating an array that had
degraded to index-addressing and since become all-objects again moved
every element from `items.<i>` to `items.<id>`, so `s.items[1] !== el`
for a proxy the caller already held — and a write through either was
invisible to the other's readers. Only the length setter did this;
splice leaves the latch alone, which is why splice never detached
anything. Degrading is forced by the data; promoting is not.

### Where it landed

The mutation matrix for this round's fixes: **11 of 11 killed**, none
labelled unobservable.

```
collCache conjunct on splice / on length      no-promote on truncate
release shares the splice batch / length batch   release runs at all (x2)
index assign does not double-bump             hadElementFrames records what was written
stripNP checks array elements                 element frames honour the policy
hydrate does not claim caller ids
```

**557 JS tests, 18 native, 17/17 on device** (`RerenderScreen.jsx`,
Galaxy A14, release, arm asserted in the APK).

The first capture read `status: RUNNING` with no rows — a `pm clear`
launch still extracting the bundle, not a hang. Warm relaunch and it
completes. That artifact has now impersonated a product bug twice on
this branch; the tell is that the title and status render while the
result list is empty.

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

- [`STORE_VS_RN.md`](STORE_VS_RN.md) — **the current, authoritative
  Skal-vs-RN store comparison (2026-08-04).** This file is the working
  record of how the store got there, including four corrected
  mis-attributions; that file is the result.
- [`ENGINE_AND_REACTIVITY.md`](ENGINE_AND_REACTIVITY.md) — rungs 1 and 2.
- [`WEBCRYPTO_DISPATCH.md`](WEBCRYPTO_DISPATCH.md) — the other place RN wins.
- [`TODO_OPTIMIZATIONS.md`](TODO_OPTIMIZATIONS.md) §6 — the index entry.

---

*Last updated: 2026-08-15.*
