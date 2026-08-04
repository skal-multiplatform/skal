# Skal's store vs React Native's — the comprehensive comparison

**Measured 2026-08-04.** Samsung Galaxy A14 5G (SM-A146P), Android 15,
arm64-v8a. **Release builds, physical hardware, screen held awake and
asserted.** Skal `com.example.skal_bench` vs React Native
`com.anonymous.rnfeed` (Expo 57 / RN 0.86 / Hermes + zustand +
`subscribeWithSelector` + MMKV).

Runs are **interleaved** (Skal round, RN round, repeat), each preceded by
`pm clear`. Two of three captured rounds are reported below; both agree
closely, and every arm's **checksums match across stacks** — `ck=300`,
`700`, `100`, `6500`, `19900`, `50`, `4950`, `613`. A mismatched checksum
means the two stacks did different work and the row is void.

**No arm builds a key string.** Every path is a literal, which is what
components write. An earlier version of this comparison indexed with
`key(i)`, and since Hermes pays ~3.8× more than JSC for the same string
concat, that cost sat inside both stacks' numbers and flattered RN by
roughly an order of magnitude. See `STORE_SLOT_PLAN.md` §0.

---

## Reads — RN wins every shape

| ms per 100 reads | Skal | RN | |
|---|---:|---:|---|
| leaf, full literal path `s.user.name.first` | 0.0319 | **0.0090** | RN 3.5× |
| leaf, parent hoisted | 0.0086 | **0.0037** | RN 2.3× |
| whole object `s.user` | 0.0093 | **0.0070** | RN 1.3× |
| `const u = s.user` + 6 fields | 0.0767 | **0.0191** | RN 4.0× |
| deep path `a.b.c.d` (4 levels) | 0.0421–0.0441 | **0.0086** | RN 4.8× |
| collection sweep, 200 rows | 0.0504–0.0511 | **0.0308** | RN 1.7× |
| *floor: plain array, int index* | *0.0002* | *0.0031* | *JSC 15×* |
| *floor: bare reactive read* | *0.0023* | *none exists* | |

**Why RN wins reads at all**, given JSC is 15× faster at raw property
access: zustand's `getState()` hands back a **plain object**, so every
subsequent access is a bare property load with no reactivity. Skal pays
one proxy trap and one signal read per level — 0.0086 against a 0.0023
bare-signal floor. The trap is irreducible while `state.a.b` is the API.

The per-level cost is what makes the deep-path row worse than the leaf
row: 4 levels, 4 traps.

---

## Writes — Skal wins, except on structural operations

| ms per op | Skal | RN | |
|---|---:|---:|---|
| 1 leaf, 0 subs | **0.0012–0.0014** | 0.1081–0.1104 | **Skal 79×** |
| 1 leaf, 50 subs | **0.0355–0.0363** | 0.1851–0.2295 | Skal 5.7× |
| 1 leaf, 200 subs | **0.1421–0.1476** | 0.2119–0.2174 | Skal 1.5× |
| 200 leaves, 1 sub each | **~0.63** | 38.15–38.66 | **Skal 61×** |
| no-op write (same value) | **0.0007** | 0.0016 | Skal 2.3× |
| wholesale replace, 1 of 3 changed | 0.0034–0.0037 | **0.0013–0.0014** | RN 2.6× |
| array push + splice, length stable | 0.0298–0.0393 | **0.0058** | RN 5.9× |

RN's 38 ms on the 200-leaf sweep is zustand's `{...st.cells, [k]: v}`
copying per write, making 200 writes O(n²). That is inherent to
immutable state management, not imposed by the harness.

**The two rows Skal loses to RN are still large IMPROVEMENTS on what
Skal had before** — a claim that they were "the price of features
chosen" was wrong, and the A/B below settles it. Wholesale replace is
behind RN because Skal *diffs* old against new to keep re-renders
precise where zustand swaps a reference; array mutation is behind
because Skal maintains stable `_id`s, per-record persistence frames and
per-index notification where zustand copies a 50-element array. Neither
cost anything relative to the previous implementation.

---

## Against the previous implementation (solid-js/store)

Same benchmark code, same device, same session — only `db.js` and
`engine.js` swapped back to commit `71e7446`, the last on
`solid-js/store`. Checksums matched throughout.

| ms per op / per 100 reads | solid-js/store | **own store** | gain | RN |
|---|---:|---:|---:|---:|
| deep path `a.b.c.d` | 0.2949 | **0.0421** | 7.0× | 0.0087 |
| collection sweep ×200 | 0.3321 | **0.0511** | 6.5× | 0.0308 |
| object + 6 fields | 0.3246 | **0.0767** | 4.2× | 0.0191 |
| read x100 untracked | 0.1545 | **0.0416** | 3.7× | 0.0413 |
| write 1 leaf, 0 subs | 0.0043 | **0.0012** | 3.6× | 0.1081 |
| write 1 leaf, 50 subs | 0.0688 | **0.0355** | 1.9× | 0.1851 |
| write 1 leaf, 200 subs | 0.2693 | **0.1476** | 1.8× | 0.2119 |
| no-op write | 0.0042 | **0.0007** | 6.0× | 0.0016 |
| **wholesale replace, 1 of 3** | 0.0060 | **0.0034** | **1.8×** | 0.0013 |
| **array push + splice** | 0.1745 | **0.0393** | **4.4×** | 0.0058 |
| precision write (200 subs) | 0.0053 | **0.0023** | 2.3× | 0.1500 |

**Every arm improved, including the two that lose to RN.** Wholesale
replace and array mutation are 1.8× and 4.4× FASTER than they were,
while also being more precise about what they re-render. The diff and
the per-index notification were not paid for out of throughput.

Also worth noting: on `solid-js/store`, Skal LOST the no-op write to RN
(0.0042 vs 0.0016). It now wins it 2.3×.

---

## Re-render precision — both exact, and Skal is 65× cheaper

200 subscribers, one per distinct leaf. One leaf is written.

| | Skal | RN |
|---|---:|---:|
| **subscribers actually woken** | **1 of 200** | **1 of 200** |
| cost of that write | **0.0023–0.0027 ms** | 0.1500 ms |

**Both stacks are exactly precise.** zustand with `subscribeWithSelector`
wakes only the subscriber whose selector result changed — the same
answer Skal's per-leaf signals give.

**The difference is what precision costs.** zustand must evaluate all 200
selectors on every write to discover which changed; Skal's signal graph
routes straight to the one subscriber and touches nothing else. That is
**65×**, and it is the clearest single statement of the architectural
difference in this whole comparison — invisible to every read benchmark
and to any write benchmark that does not count subscribers.

Skal's re-render precision is separately verified case-by-case on device
(`benchmark_v2/skal-bench/src/RerenderScreen.jsx`, 9/9): sibling leaves
independent, no-op writes silent, wholesale replace waking only changed
leaves, shared subtrees pruned by reference, splices waking only shifted
indices plus length.

---

## Composite and storage

| | Skal | RN | |
|---|---:|---:|---|
| realistic frame (200 dependents × 10 reads + 1 mutation) | **~0.05** | 0.797–0.847 | **Skal 16×** |
| cold open + read 500 records | 6.2 (eager) | **0.662** | RN 9.4× |
| cold open + read 5 of 500 | 2.08 (lazy) | **0.259** | RN 8× |

Storage reads are RN's clearest win. MMKV parses the whole file into an
in-memory dictionary at `createMMKV()` and returns typed values across
the boundary; Skal's keydir holds **offsets**, so every record is a read
plus a JS-side `JSON.parse`. That is a real trade — MMKV's memory scales
with bytes stored and it supports only `boolean | string | number |
ArrayBuffer`; Skal's scales with key count and it stores arbitrary
nested values.

Cold start: a 4 500-leaf store adds **+33.5 ms** to `Displayed`. 67% of
that is Skal's own eager init walk (`STORE_SLOT_PLAN.md` §5b), which is
untouched and remains the largest unaddressed number.

---

## The shape of it

**Skal wins the in-memory state layer decisively** — 79× on a leaf
write, 61× on a bulk write, 16× on a realistic frame, 65× on precise
notification.

**RN wins reads (1.3–4.8×) and disk (8–9.4×).** Both for the same
structural reason: zustand and MMKV hand back plain data and charge
nothing per access, where Skal charges a proxy trap per level in memory
and a parse per record on disk.

An app that writes state and re-renders from it is Skal's case. An app
that loads a large blob at startup and mostly reads it is RN's.

---

## Method notes

- **Shared driver.** `statebench.js` is byte-identical in both apps
  (verify with `md5`). Arms written per-stack are structurally mirrored
  and produce identical checksums.
- **Auto-scaled iterations** to ≥400 ms with warm-ups discarded.
- **Bounded workloads.** An unbounded `push` arm grew a list to tens of
  thousands of elements under auto-scaling and **crashed the app with a
  native SIGSEGV in libskal**. Both array arms are now length-stable.
  That a JS-level runaway segfaults the native engine rather than
  throwing is worth investigating on its own.
- **Screen held awake and asserted** (`svc power stayon true`, then check
  `dumpsys power | grep mWakefulness`). A dozing screen once inflated
  Skal's numbers ~2× and left RN's untouched.
- **`pm clear` before every Skal run.** The host extracts the JS bundle
  only when absent, so `adb install -r` alone keeps serving the previous
  bundle.

### What is NOT measured
- Two of three rounds reported; no medians-of-many, no spread analysis.
- Cold start has no RN counterpart arm.
- Persistence *writes* remain confounded — Skal's bench warms the engine
  with the granular sweep before that arm and RN's does not. Open all
  session; do not quote a persist-write comparison.
- Memory footprint of either store.

## Related
- `STORE_SLOT_PLAN.md` — how the store got here, including four
  corrected mis-attributions and the reactivity regressions.
- `ENGINE_AND_REACTIVITY.md` — JSC vs Hermes, and Solid vs React.
- `WEBCRYPTO_DISPATCH.md` — the other place RN wins.

---

*Last updated: 2026-08-04.*
