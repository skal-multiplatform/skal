# Skal — performance decision log

Per-decision tracker for everything perf-relevant. Records what
we've done, what we've decided NOT to do (and why), and what's
pending.

Status legend: ✓ landed · ⚠ bug · ◇ pending · ✗ rejected · ⊖ deferred

---

## Design principle

**Performance is the #1 priority, but spend complexity on the
actual hot path.** Reactive primitive updates (text, numbers in
JSX expressions) are high-frequency; aggressively optimize them.
Style / event / a11y compound updates are low-frequency (theme
switches, hover states, occasional animations on a handful of
elements); accept a single full-blob `setProp` and let Flutter's
widget-tree diffing handle visual perf.

Over-engineering the low-frequency path costs complexity budget
that's better spent on the actual hot path or on net-new features.
If profiling later reveals a specific compound-update workload as
binding, revisit the deferred items.

---

## Perf budget (target invariants)

Workload: counter demo, 1000 rapid taps:

| Metric                                           | Target |
|--------------------------------------------------|--------|
| `flushOps` per signal write                      | 1      |
| Ops per `flushOps` for one text change            | 1      |
| Bridge round-trips per signal write              | 0 (shared region; no FFI per op) |
| `cold.notify` invocations per touched node       | 1      |
| Bytes/frame written to the bridge (steady state) | ≤ 30   |
| Pump drain time (steady state)                   | < 250 µs avg, < 500 µs peak |
| FPS                                              | 60 (panel refresh) |
| Frame work (totalSpan)                           | < 16 ms |

Workload: 5000-tweet feed scroll:

| Metric                                            | Target |
|---------------------------------------------------|--------|
| FPS during scroll                                 | ≥ 50   |
| Widget Elements mounted at any time               | < 100 (lazy column virtualization) |
| Memory after full scroll-through                  | ≤ 200 MB |

Fixed-size regions (`wire.dart`) — these are **invariants, not elastic
buffers**. Exceeding them is silent, not an error:

| Region | Size | Direction | Overflow behaviour |
|---|---:|---|---|
| Op ring | see `kOpRingSize` | JS → Dart | rewind + host re-checkpoint |
| JS string heap | 768 KiB | JS → Dart | reset on commit; bounds every string prop + string/JSON method arg |
| Reply heap | 256 KiB | Dart → JS | **silently truncates** an oversize reply; wraparound spin-waits up to 50 ms |

---

## Bridge RPC — rate classes

Measured 2026-07-21 on a macOS debug build, 60 Hz. Full distributions
in [BENCHMARKS.md § Bench 4](BENCHMARKS.md); this is the contract those
numbers imply. It is a DOCUMENTED contract, not a mechanically enforced
one — the registry cannot observe call rates, and an earlier
`assertRateClass` shim claimed enforcement while nothing called it,
which was worse than no enforcement at all. If a real guard ever lands
it will come from the generator, per method, with tests.

**The one number that matters: a one-shot RPC round-trip costs one
frame — p50 16.67 ms at 60 Hz — regardless of payload size.**

The transport is not the cost. 200 calls issued together complete in
16.74 ms total (0.084 ms amortized); the 16.67 ms is purely waiting for
the next per-frame op drain (`root.dart`'s Ticker). Three consequences,
in priority order:

1. **Call count is the budget, not bytes.** Ten chained `await`s
   measured 163 ms. The same ten batched through `Promise.all` cost
   one frame. Any generated service API that reads naturally as
   `await a(); await b(); await c();` is a latency bug by construction.

2. **Streams are the fast path.** A stream burst rides a single drain:
   477k bare-int events/sec, 131k/sec at 256 B of JSON per event. That
   is ~5,700× the throughput of the same event count as sequential
   RPC. Prefer `svc.foo$(cb)` over polling `await svc.foo()`.

3. **JSON is free below ~64 KB.** Encode/decode does not become visible
   until a 241 KB round-trip, and even then it costs exactly one extra
   frame (the work stops fitting in the slack). Do not trade JSON for a
   binary encoding to save microseconds inside a 16.67 ms quantum.

| Tier | Rate | Contract |
|---|---|---|
| One-shot RPC | human-paced | JSON args/returns fine. **Batch** anything issued together. |
| Low-rate stream | ≤ ~10 Hz (GPS, battery, connectivity) | JSON per event — fine, with margin to spare. |
| Frame-rate | ≥ 60 Hz (sensors, per-frame callbacks) | A *stream* is fine (it rides one drain). A per-frame `await` is not — it cannot beat one frame per call by construction. |

**Payload law.** Bulk bytes never cross the bridge — paths and handles,
not payloads. This is not a preference: a reply over 256 KiB is
truncated silently (measured: 270,336 B in → 262,144 B out, no error).
`XFile` already conforms by returning a path. Never base64 a photo into
a reply.

**Backpressure is an unbounded queue.** 3,000 events into a
deliberately slow JS handler: 3,000 delivered, nothing dropped or
coalesced. A producer faster than its consumer grows memory and delays
the frame. Coalescing, if a service needs it, belongs on the Dart side
before the value enters the stream.

**Cold-path rule.** Custom-widget JSON props (`options` on
`<FlutterMap>`) parse on *change*, not per frame, and `propSkips`
already dedupes unchanged strings. Frame-rate mutation of custom-widget
props from JS is forbidden — that is what imperative methods and
host-side animation are for (same doctrine as ANIMATION.md).

---

## Already optimal (don't regress)

| # | Item | Where landed | Note |
|---|------|--------------|------|
| ✓ | Bun + JSC via static-linked libskal | core architecture | No platform-channel serialization. dart:ffi calls into a single shared library. |
| ✓ | Permanent shared 2 MiB ArrayBuffer between JS and host | core architecture | Zero-copy. JS writes ops, host reads. Atomic seq counter publishes per-frame batches. |
| ✓ | Fixed 16-byte ops + separate string heap | `wire.dart` + `bridge.js` | Switch dispatch on a u8 + 3 i32 reads. No length-prefixed strings inline. |
| ✓ | Typed prop categories (u32 / f32 / string distinct opcodes) | `wire.dart`, `packages/skal-js/src/bridge.js` | No polymorphic ValueKind tag per prop. Opcode encodes the type. |
| ✓ | Hot / cold prop split | `OP_SET_OPACITY` etc. | A 60 fps opacity tween bypasses the cold-prop machinery entirely. |
| ✓ | Per-microtask op batching JS-side | `bridge.js scheduleCommit` | One FFI hop carries N mutations. |
| ✓ | JS-side traversal pointers (parent / firstChild / nextSibling) | `renderer.js makeNode` | Solid's `getParentNode` / `getNextSibling` are zero-FFI. |
| ✓ | Per-frame drain on a Ticker | `root.dart _SkalRootState` | Vsync-aligned via `SchedulerBinding.handleBeginFrame`. |
| ✓ | Per-node `ChangeNotifier` × 2 channels (cold, hot) | `node_state.dart` | One subscription per node from the SkalNode widget; hot props don't fire cold listeners. |
| ✓ | End-of-drain coalesced notify | `bridge.dart _drain` | N writes to same node → 1 `cold.notify()`. Touched set deduplicates. |
| ✓ | `MemoizingListenableBuilder` for cached widget subtrees | `memoizing_listenable_builder.dart` | Parent rebuild doesn't cascade through children unless their listenable actually fired. |
| ✓ | `ValueKey(childId)` on every child slot | `root.dart _childWidgets` | Element diff reconciles by id, not position. |
| ✓ | Bytecode cache (`skal-app.cjs.jsc`) via `await import('file://...')` | `main.dart` release path | JSC parser skipped on cold launch when bytecode loads cleanly. |
| ✓ | Compress libskal in APK (`useLegacyPackaging = true`) | `android/app/build.gradle.kts` | 91 MB → 33 MB compressed. APK 102 MB → 41 MB. |
| ✓ | `<lazyColumn>` virtualization (ListView.builder backing) | `wire.dart`, `root.dart`, `renderer.js` | 5000-item feeds mount ~10 Element trees. |
| ✓ | `Uint8List.sublistView` (zero-copy) for string decoding | `bridge.dart _readString` | No per-string allocation in the op decoder. |
| ✓ | `Stopwatch` (monotonic) for pump timing | `bridge.dart` | Wall-clock `DateTime.now()` can jump backward; would corrupt the EMA / window peak. |
| ✓ | `DecoratedBox` instead of `Container` for box decoration | `root.dart _applyColdVisual` | Container composes 5 unused widgets; DecoratedBox is exactly what's needed. |

---

## Pending — high impact

### 1. Background-isolate the asset extraction (cold-launch only)
- **Status:** ⊖ deferred — naive `Isolate.run` copies the 290 KB
  payload across the isolate boundary, negating the win. Proper
  implementation needs `TransferableTypedData` for zero-copy
  transfer plus a parallelization design that overlaps extraction
  with `skal_create_runtime`.
- **Impact:** Medium. Saves 2.7 s on emulator first install
  (one-time), ~300 ms on real-device first install.
- **Cost:** ~50 LOC.
- **Trigger to land:** when a real-device first-install benchmark
  shows > 500 ms.

### 1b. Decouple RPC reply latency from the frame Ticker
- **Status:** ◇ pending — identified by [Bench 4](BENCHMARKS.md).
- **Problem:** `root.dart` drains the op ring once per frame. A JS
  method call written just after a pump waits a full vsync, so every
  one-shot RPC round-trip costs p50 **16.67 ms** and ten chained
  `await`s cost 163 ms. The transport itself is 0.084 ms amortized —
  the latency is 99.5% scheduling.
- **Impact:** High for Roadmap A (native services). Batching via
  `Promise.all` is the current mitigation and it works, but it is a
  workaround the API shouldn't need.
- **Cost:** Unknown, and the reason this is pending rather than done.
  Draining on JS's wake signal instead of (or in addition to) vsync
  means mutating `NodeState` outside `handleBeginFrame`, which is
  exactly the ordering the current design depends on for
  same-frame rebuilds. Needs a design, not a patch.
- **Do not** "fix" this by pumping on a short timer — that trades a
  latency win for continuous CPU and reintroduces the mid-frame
  notify hazard.
- **Trigger to land:** a real service workload where batching is not
  expressible (a genuine request → response → request chain).

### 2. Defer-mount the tweet feed tail
- **Status:** ⊖ deferred (made largely redundant by `<lazyColumn>`).
- **Note:** `<lazyColumn>` solves the rendering side. The JS side
  still synchronously creates all 5000 NodeStates inside the
  evaluate call, which adds ~hundreds of ms to first-eval. A
  separate Solid-side change (mount first 50 sync, append rest in
  microtasks) would also help, but lazy rendering dominates the
  user-visible win.
- **Trigger:** if first-eval time on the tweet feed crosses 500 ms.

---

## Pending — medium impact

### 3. Bytecode version-check at runtime
- **Status:** ◇ pending
- **Impact:** Medium correctness. The "silent invalidation" footgun
  documented in `examples/kitchen-sink/scripts/find-vendored-bun.sh` is real. A
  version-mismatched .jsc falls back to parsing — no error, just a
  cold-launch regression.
- **Cost:** Medium. Emit a marker file alongside the bytecode
  containing the bun build commit hash; at runtime, log a warning
  if the marker disagrees with libskal's expected version.

### 4. Tree-shake `babel-preset-solid` runtime
- **Status:** ◇ pending
- **Impact:** Low. Drops 5-8 KB of unused server-rendering / SSR /
  hydration code from the bundle. One-time parse cost.
- **Cost:** Trivial — config flag in `vite.config.js`.

---

## Pending — lower priority / future

### 5. Interned key table for hot prop names
- **Status:** ⊖ deferred
- **Note:** Our flat typed-opcode design already encodes prop keys
  as 1-byte enums (`PROP_PADDING` = 0x00 etc.). This optimization
  doesn't apply — we already did it implicitly.

### 6. Style diff → setProps op
- **Status:** ✗ rejected
- **Rationale:** Style is not a single op in our design; each
  style property is its own typed opcode (PROP_BG_COLOR,
  PROP_PADDING etc.). The diff cache in `bridge.js` already skips
  equal-value writes per-prop. There is no compound
  `setProp("style", {...})` op to diff.

### 7. Mega-fused `mountNode` op
- **Status:** ✗ rejected
- **Rationale:** Fusing CREATE_NODE + SET_PROP_* + INSERT_BEFORE
  into one op would save ~9 bytes per mount and 2 decoder
  iterations. The complexity tax (deferred-emit buffer, subtree-
  flush invariants for nested JSX) exceeded the win. Per-microtask
  FFI batching already groups mounts into single FFI hops.

---

## Build pipeline correctness

### 8. Vendored-bun-only bytecode generation
- **Status:** ✓ enforced via `examples/kitchen-sink/scripts/find-vendored-bun.sh`
- **Why:** JSC bytecode is tied to a specific JSC version. The
  version libskal links against IS the vendored one. If a
  developer's system `$PATH` bun is used (e.g. 1.3.13 by accident),
  drift between it and vendor/bun's JSC silently invalidates the
  .jsc at runtime → fallback to parsing → cold-start regression
  with no error.

### 9. `make release` orchestrates the full chain
- **Status:** ✓ landed (`examples/kitchen-sink/Makefile`)
- **Why:** The chain `JS source → bundle → bytecode → APK` has 3
  hops with cache-staleness footguns at each. Make's mtime check
  handles it.

---

## Rejected outright (don't propose these again)

### `JSClassDef` HostObjects with finalizers (per-node JSC class)
- **Why rejected:** One FFI hop per `createElement` to allocate
  the HostObject. Plain JS objects + `FinalizationRegistry` (which
  our renderer already uses via Solid's universal renderer) saves
  the FFI and ~60 lines of C/Dart glue.

### JSON wire format
- **Why rejected:** ~5× slower per flush than our custom binary
  format. JSON.stringify allocates; custom encoder writes into a
  pre-grown Uint8Array.

### Per-op dedicated FFI symbol (no batching)
- **Why rejected:** One FFI per op = ~1000 FFI/sec for steady
  state. Batched flush is ~1 FFI/frame. Order of magnitude
  difference.

### Switching engines to V8 / Hermes for perf
- **Why rejected:** V8's mandatory JIT bans it from iOS App Store.
  Hermes is RN-coupled and lacks Web APIs. JSC + bytecode cache
  already hits our cold-start target.

### Synchronous JS → Dart returns (blocking the UI thread on JS)
- **Why rejected:** Inverts the architecture's core promise — JS never
  blocks the frame. Shared memory makes it *possible*; that is not the
  same as sane. Any JS work on the critical path becomes frame time,
  and a JS exception becomes a stalled UI thread.
- **Escape hatch:** precompute and pass the data, or restructure as
  async. Recorded as S4 in [NATIVE_SUPPORT.md](NATIVE_SUPPORT.md).

### Replacing dart:ffi with platform channels
- **Why rejected:** Platform channels serialize via MessageCodec
  (~10 µs/call); dart:ffi is ~100 ns/call. Two orders of magnitude
  in the wrong direction for the bridge hot path.

---

## Reviewing this doc

When proposing a perf change:
1. Add it as a new numbered item under the right priority section.
2. State `Impact` (in terms of which budget invariant it improves)
   and `Cost` (LOC + cross-system coordination).
3. If rejecting an idea, move it to "Rejected outright" with the
   one-line reason. Future-you doesn't want to re-litigate.
