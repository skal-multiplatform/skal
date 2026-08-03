# Skal — open items

Things deferred or in-flight, in roughly priority order. Real items
only — only what we've actually hit and chosen to defer or schedule.

For perf-specific decisions see [`PERFORMANCE.md`](PERFORMANCE.md).
For measured-but-undesigned optimization candidates see
[`TODO_OPTIMIZATIONS.md`](TODO_OPTIMIZATIONS.md).
For platform-specific work see [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md).

---

## Open as of 2026-07-28 — after the review sweep

A snapshot of what is left after the two code reviews and the
performance report were worked through. Everything here is either
verified-real or explicitly marked unmeasured; nothing is speculative.

Items are ordered by what I would actually do next, not by size.

### 0. The performance report is stale — check it against this table

A performance report covering the ticker, node inflation, store hot
path and web lists was worked through on 2026-07-28. It gets re-read,
and re-reading it wastes time because most of it is done. Its own
validation line dates it: "74 Flutter, 33 codegen, 50 JS/store" is a
mid-sweep snapshot; the tree is now 112 Flutter / 33 codegen / 147 JS
plus 6 plugin and 14 Zig.

| Report item | Status |
|---|---|
| 1 · idle ticker at 60/120 fps | **done** — `7987927`, measured 0 BUILD phases while idle |
| 2 · per-node memory | **partly** — NodeState lazy in `e763910`; the hot layer is still installed on every node, see § 6c |
| 3 · ChunkedFor / web lists | **mostly** — scheduler `992674d`, builder windowing `50a65c1`. The prefix re-slice it flags measures 0.010 ms/mount — negligible. JSX-children and horizontal lists still eager, see § 4 |
| 4 · store hot path | **partly** — staging `068f8c7`, index hints `a83f4fd`. Hydration batching open, see § 6 |
| 5 · event-path stalls | **partly** — reply heap `e83e0ef`; the wake hang below `35d1ddd` / `31fec35`. Zig per-wake task and web sync round trip declined, see § 6b |
| `<Row>` → SingleChildScrollView | **done** — `7987927` |
| codegen caching | open, see § 7 |
| native store double scan | **done in source** — `e763910`; inert until a libskal rebuild, see § 2 |
| geolocator on web | open, see § 8 |
| site prerender / bundling | open, see § 8 |
| dev-hot duplicate build | **done** — `1e8fdbb` |
| overclaiming comments | **done** — `992674d` corrected three |
| HUD forcing continuous frames | **done** — `eafdb1c` |
| Zig store has no tests | **done** — `fa51592`, 14 tests |
| `skal.h` dispose mismatch | **done** — `992674d` |
| kitchen-sink "virtualized" feed | **done** — `3b0c52d`, see § 9 |
| 11,600 lines across five files | open, unaddressed |
| mobile-perf benchmark is a scaffold | **partly** — a repeatable release-only scroll harness now lives in `benchmarks/mobile-perf`; nothing else is automated |

What the report does NOT contain, found while working through it — all
fixed, listed so nobody re-derives them from a report that never
mentioned them: the seeded-collection persistence bug (`e829952`), the
JS store sharing one keyspace across stores (`dcb7c5c`), the stale-hint
segment aliasing (`201de7d`), unremovable null props (`e83e0ef`), the
console proxy clobbering the string-heap cursor and the oversize-reply
branch clobbering unread bytes (both `e83e0ef`), a `will-change` layer
pinned forever after clearing a hot prop (`50a65c1`), and two rows in
the demo that genuinely overflow an iPhone (`ae5230b`, `e65a57f`).

### 1. ~~Nothing on this branch has been through CI~~ — done (2026-07-29)

Merged to `main` and pushed. The full matrix — tests, desktop, ios-sim,
android, nightly — is green. Suites now 147 JS · 6 plugin · 14 Zig ·
33 codegen · 112 Flutter.

### 2. libskal rebuild — partly done (2026-07-29)

`patches/skal_entry.zig` no longer CRC-verifies every frame twice at
startup (`mapSegment` already checks everything below the cursor, so
`replayInto` skips it). That is **source-only**: it does nothing until
libskal is rebuilt and the binaries republished.

Same applies to anything else landing in the Zig store.

**Done for the iOS Simulator** (2026-07-29): relinked while fixing the
missing `skal_prewarm_store` export, so the halved startup CRC is live
there. The iOS-device, Android and desktop binaries are still the old
build — the source fix remains inert on those until they are
republished.

Note `build/skal-darwin/libskal.dylib` is a stale May-11 artifact that
exports no `skal_*` symbols at all. Nothing links it today, but it cost
a silently-dead baseline build once (the app launched, found no
`skal_create_runtime`, and reported 0% CPU with no boot line). Delete or
regenerate it — it is exactly the trap `c127687` exists to prevent.

### 3. ~~Web still allocates a 6 MiB bridge it never uses~~ — done (2026-07-28)

Importing `bridge.js` on a DOM target allocates a 6 MiB `ArrayBuffer`
plus ~1 MB of diff-cache arrays, and `skal-runtime.jsx` imports it
unconditionally — the store pulls it in merely to resolve a directory.
The DOM renderer never reads or writes an encoded op, so all of it is
inert.

Fixed without reshaping module boundaries: with no host, bridge.js now
allocates only the 64-byte header. That is safe only because the writers
now REFUSE when there is no host — everything past the header lives at
offsets outside the stub, and a typed-array write past the end is
silently dropped in JS rather than throwing, so quietly scribbling into
nowhere was the real risk.

Chasing whether the fallback bytes were genuinely "inert" (the comment
said so; they were not) turned up the 4.8-second DOM store boot, which
was much larger than the allocation. See the commit for that.

The diff caches (~1 MB) are still allocated eagerly on web. Smaller, and
they would need the same audit.

### 4. Web list parity — the two halves still missing

Builder-mode `<listView count renderItem>` is windowed as of
2026-07-28 (O(viewport), no cap). Still eager:

- **JSX-children lists.** Still eager, and now believed to be the right
  call rather than merely unfinished. Solid builds every child before
  the renderer is called, and its reconciler navigates the real DOM
  through `getFirstChild` / `getNextSibling` — so windowing would mean
  those two lying about what is attached, on the hot reconcile path, for
  every node in the tree. That is a contract change with a cost paid by
  everything to serve one shape.

  Mitigated instead, 2026-07-29:
  - The renderer **warns once** past 200 JSX children, naming builder
    mode. The cliff was silent and superlinear; now it is loud.
  - The demo's todos list — the last one in-tree on this path — is
    converted. Measured on web, production build, adding 100 items:

    | collection | JSX children | builder mode |
    |---:|---:|---:|
    | 0 | 4.5 ms | 4.2 ms |
    | 1 000 | 18.7 ms | 0.5 ms |
    | 2 000 | 34.0 ms | 0.5 ms |
    | 3 500 | 72.5 ms | 0.9 ms |

    Linear-in-rendered became flat, so building N went from quadratic to
    linear: 80x at 3 500 items. 4 000 todos render as 17 rows / 830 DOM
    nodes, against 4 758 nodes for 2 000 on the old path.
- ~~**Horizontal builder lists**~~ — done (2026-07-28). Windowed on the
  same path: `_AXIS` selects width / scrollLeft / offsetWidth, and the
  1500-row cap is deleted rather than relaxed.

See also *Web target — Flutter→DOM consistency* below, which tracks a
different web gap (hand-maintained widget mapping), and
[`WEB_SUPPORT_PLAN.md`](WEB_SUPPORT_PLAN.md).

### 5. ~~Reply payloads larger than the whole reply heap truncate~~ — done (2026-07-28)

A single value over 256 KiB had no representation: an event record
carries one `(offset, length)` into a fixed region, so anything bigger
was truncated.

Fixed with `eventArgStrChunk` (0x08): Dart splits an oversize payload
into N-1 part records plus a final one carrying the real arg type, and
JS accumulates by record id and prepends on completion. Ordering comes
free from the overflow queue. Chunks are cut on codepoint boundaries,
which is required rather than tidy — JS decodes each part as it lands
and its decoder is non-fatal, so a seam inside a sequence would corrupt
in silence.

A follow-up review (2026-07-28) found the first cut shipped correct
splitting on top of three receive-side holes, all of them downstream of
the same gap: the JS reassembler had no tests at all, because the Dart
tests joined the parts themselves. Closed together —

- the oversize check sat BELOW the back-pressure gate, so a big payload
  arriving while the queue was busy spilled whole and hit the truncating
  path — chunking skipped itself in the one case it was written for;
- a tail refused by the 4 MiB queue ceiling left the transfer open
  forever: handler never fired, parts pinned for the process lifetime.
  It now closes with an empty terminator and delivers the prefix;
- accumulations were keyed by record id alone, but handler ids and call
  ids are independent sequences that collide, so an orphaned transfer
  could prepend itself to an unrelated event. Entries carry their event
  kind and a mismatch discards. Hot-reload teardown clears the map.

Hot-path cost went with it: the size check was encoding the whole
payload and throwing the result away, leaving `_tryWriteReplyString` to
encode it again. It now decides from the UTF-16 length in the common
case and never allocates.

**The chunking was not the end of it (2026-07-29).** Measuring the
finished feature on macOS **release** found a hang underneath it, older
than chunking and not caused by it: `_flushEventOverflow` woke JS only
while records were still queued, so the record that COMPLETED a
back-pressure burst was written into the ring and never announced. JS
drains only when woken, so it sat there. One byte decided it — 262144 B
took 1.8 ms, 262145 B never completed in 40 s with the app otherwise
silent, and completed in exactly 2001.6 ms / 12002.1 ms when given an
unrelated 2 s / 12 s heartbeat. It was never slow; it was waiting to be
knocked. Any spilled event could hit it; chunked replies hit it almost
every time because their tail is usually the record that empties the
queue.

After the fix, release, no heartbeat: 262145 B **16.7 ms**, 1 MiB
**50.2 ms**, 4 MiB **265.7 ms** — ~0.05-0.065 ms/KB, flat.

Two lessons worth keeping: the earlier "large replies are quadratic"
reading (40 / 688 / 10769 ms) was a DEBUG build measuring this hang plus
whatever incidental traffic released it, and a follow-up review found
the fix itself had one untested half plus the same stranding one branch
away in `_dispatchChunked`. See CLAUDE.md.

### 6. Store — measured; one was real, one was not

- `dropMemo` **was** quadratic and is fixed (2026-07-28): 1435 ms ->
  1.8 ms to clear a 5000-element collection.
- **Hydration batching is NOT worth doing.** Measured on reopen:
  2202 records hydrate in 2.1 ms (702 in 1.3 ms) — linear, about a
  microsecond per record, against a total store-open of ~4 ms. The
  "many independent reactive writes" concern is real in shape and
  irrelevant in size. Left alone deliberately.

### 6z. (former text, kept for the reasoning)

Flagged by review, **not measured**, and this session's record on
unmeasured perf claims is poor (see `BENCHMARKS.md` Bench 6 and 9 — two
"obvious" wins turned out to be noise, one turned out to be 2x). Measure
before touching:

- `dropMemo` is `memo-size x removed-prefixes`, so bulk deletion may be
  quadratic.
- Hydration performs many independent reactive writes where one batch
  would do.

### 6b. Event path — analysed 2026-07-28, deliberately NOT done

Both are real. Both are also in code this repo cannot currently test,
and in each case the win is smaller than the risk of shipping an
unverified change to the event path. Recording the analysis so this is a
decision rather than an omission.

**`EventDrainTask` allocated per wake** (`patches/skal_entry.zig`,
`skal_wake_js`). One `create` + `destroy` of `{*Runtime, AnyTask,
ConcurrentTask}` per dispatched event — tens of nanoseconds against an
event that crosses into JSC and runs a JS handler. The fix is to reuse
one task behind an atomic pending flag, which means getting the flag
right on a lock-free `enqueueTaskConcurrent` path: enqueue only when not
pending, clear at the START of `run` so a wake during the drain
schedules a fresh one. Get that wrong and you corrupt the task queue's
linked list — a crash in the native runtime.

The Zig test harness extracts only the std-only STORE region; this is
bun-coupled and outside it (`awk` between the markers finds zero
references). So the trade is: save one malloc per event, in exchange for
an untestable concurrency change to the runtime's scheduler. Not worth
it. Revisit if the harness ever grows to cover the bun-coupled half.

**Web `syncToJs` / drain / `syncFromJs` per event**
(`skal_ffi_web.dart`, `wakeJs`). `syncToJs` is NOT a no-op — it copies
three header ranges plus reply-heap and event-ring slices — so a burst
pays it per event. The burst case is real: a Dart stream emitting N
values in one turn wakes N times. A gesture at 120 Hz is one event per
frame and gains nothing.

The fix is a coalesced pending flag draining once per microtask. It
changes event timing from synchronous to deferred, and
`skal_ffi_web.dart` imports `dart:js_interop`, so it cannot run under
`flutter test` at all — there is no way to verify it here. Wants a web
integration test first; that is the actual prerequisite.

### 6b-orig. (superseded — kept for the original framing)

Flagged by the performance report and **not done**; I closed the
reply-heap half and dropped these two on the floor when writing this
list up. Recorded now so they are not lost twice.

- `EventDrainTask` (`patches/skal_entry.zig`) is allocated and destroyed
  per host wake. A coalesced pending flag would reuse one. Needs a
  libskal rebuild to land, same as item 2.
- Web events do an individual `syncFromJs` / drain / `syncToJs` round
  trip each (`skal_ffi_web.dart`). The dart2wasm mirror has to be
  reconciled at those boundaries, but not necessarily per event.

### 6c. The hot layer is still installed on every node

Partially addressed and worth being precise about, because the headline
number in `BENCHMARKS.md` Bench 8 does not tell the whole story.

`NodeState`'s storage is lazy as of 2026-07-28. But `_hotLayer()` in
`root.dart` is called for EVERY node and always returns a layer
(`_StaticHotLayer` / `_AnimatedHotLayer` / `_SpringHotLayer`) that
subscribes to `node.hot` — so any node that is actually BUILT allocates
both notifiers regardless of the laziness.

The laziness is therefore effective exactly in proportion to how much of
the tree goes unbuilt: in a windowed 5000-row list where ~20 rows build,
~4980 nodes skip both notifiers. In a fully-built tree it saves the
three prop maps and the child backing, and nothing else.

The existing comment in `root.dart` explains why the builders are
unconditional — making them conditional means reading hot values in the
outer build, which subscribes the outer build to them and defeats the
purpose — and calls the cost "tiny". That reasoning is sound; the cost
claim is now measurable and unmeasured.

### 7. Codegen is slow, but not for the reasons listed — measured 2026-07-29

Timed on the demo's local widget, three runs, `skal_codegen.dart`:

    total                13.06 - 14.59 s
      context creation        608 ms   (4.5%)
      first getResolvedUnit  8581 ms   (63%)
      rest (VM start, JIT, emit)  ~4.4 s

So the dominant cost is the analyzer building its element model for the
Flutter SDK on the first resolve. That is not codegen redoing work — it
is the price of resolving anything at all, paid once per process.

Three of the four original claims do not survive the measurement:

- ~~`package_config.json` re-read and re-parsed~~ — already cached in
  `package_resolver.dart`, invalidated on (mtime, length) so a `pub get`
  between builds is picked up.
- ~~fresh analyzer context per invocation~~ — the CLI already shares one
  across watch rebuilds (see the comment at `skal_codegen.dart:194`).
  The `build_runner` builder does construct one per build, but that is
  608 ms against a 13 s run.
- **Service discovery walking the package again** — real: `builder.dart`
  resolves every file at :165 and again at :504. Whether it costs
  anything is UNMEASURED, and probably little, because the second pass
  should hit the analyzer's session cache. Measure before touching it.

The one lever that would matter is a persistent byte store, so the
element model survives between processes instead of being rebuilt for
8.6 s every run. `AnalysisContextCollection` does not expose it; it
needs `AnalysisContextCollectionImpl` from `analyzer/src/…`, a private
API that moves between analyzer versions.

**Not doing it now, deliberately.** This is build-time only, and the
failure mode of a wrongly-invalidated analyzer cache is silently WRONG
generated code — the worst thing a codegen tool can produce, and not
something the current tests would catch. Worth doing with a real
invalidation test behind it, not as a speed patch.

### 8. Smaller, real, independent

- ~~`skal-plugin-geolocator` boots a Flutter Web runtime to reach
  `navigator.geolocation`~~ — done in `86aa2fa`. Calls the browser API
  directly; `callPlugin` stays as the fallback for a browser without it,
  so nothing that worked stopped working.
- ~~The site prerenderer clears the static tree before the module
  remounts it~~ — done (2026-07-29). The inline
  `<script>…innerHTML=''</script>` before `</body>` ran during parse,
  while the bundle is deferred and re-renders only after fetch, parse
  and execute; everything between was a blank page, and it grew with
  latency. `main.jsx` now clears one statement before `render()`, so the
  swap is a single task. It also degrades the right way — if the bundle
  never arrives the reader keeps the prerendered content. Verified in a
  browser: no duplicated nav, and the auto-demo interval runs, which
  only happens if the module mounted. Both halves pinned by
  `prerender-paint.test.js`, mutation-checked.
- **Still open:** every docs content module is bundled into one client
  chunk (~102 KB of raw strings). Unmeasured.

### 9. ~~The kitchen-sink feed is not actually virtualized~~ — done (2026-07-28)

Converted to builder mode in `3b0c52d`. Measured afterwards: 10 000 rows
mount in 0.10 ms on web with 25 rows materialized, and scrolling to the
midpoint materializes rows 5071-5088 with the DOM bounded at 758 nodes.
`virt-bench` renders 100 000 rows in 87 DOM nodes.

The original entry read:

`examples/kitchen-sink/src/App.jsx` renders the tweet feed with a plain
`<For each={tweetsToShow()}>` inside a `<ListView>` — JSX children, not
builder mode — so every tweet is created eagerly.

It matters more than a demo blemish: the builder path (`count` +
`renderItem`) is the one that virtualizes on native and, as of
`50a65c1`, windows on web. The showcase for virtualization is the one
screen not using it, so neither implementation is exercised by the app
people actually run.

Converting it would demonstrate the feature and give both paths a real
workload at the same time.

### Known coverage gaps (deliberate, recorded so they are not surprises)

- **Native store, tombstone accounting.** Removing replay's tombstone
  branch fails no test. `get()` filters tombstones itself so reads are
  unaffected, and superseded frames are already marked dead upstream, so
  `dead` stays over the compaction threshold either way. Catching it
  needs an exact-byte assertion brittle enough to break on any
  frame-header change. See the note in `store_test.zig`.
- **Perf budgets.** Only `indexed_child_list_test.dart` has one. The
  benchmarks in `BENCHMARKS.md` are run by hand. `benchmarks/mobile-perf`
  now holds a repeatable scroll harness (opt-in, release-only) — see its
  README; nothing runs it automatically.

### Open question

- **Are the published Android artifacts stale?** The android CI job was
  red from 2026-07-19 until the WebKit pin fix on 2026-07-27, so the
  last genuinely-built Android libskal predates that window. Worth
  checking what is actually published before anyone depends on it.

### Migration note (pre-release, so cheap — but do not lose it)

Store data on the **JS engine** moved from `<dataDir>/` to
`<dataDir>/<name>/` (default name `store`) when `cfg.name` started being
honoured on that path. Anything persisted on the old path reads as
empty. Native was always namespaced and is unaffected.

---

## Store & benchmark work parked 2026-08-03

From the store read-path session. Full findings and the sequenced plan
are in [`STORE_SLOT_PLAN.md`](STORE_SLOT_PLAN.md); this is the checklist
of what was **not** done.

### Shipped in that session (for orientation)
- Resolved-parent cache in `objectProxy` — 1.70× on the hoisted read
  arm, both invalidation points mutation-tested.
- `snapshot()` removed (silent-mutation footgun, see STORE_SLOT_PLAN §7).

### Not done — store
- [ ] **A. Re-run two thin arms at n=3.** `leaf, full literal path` and
      `leaf, parent hoisted` are single-round numbers and they are the
      headline figures (RN 16.7× / 7.8× ahead). Everything is sized
      against them.
- [x] **B/C. Solid backing replaced** — done 2026-08-03, see
      `STORE_SLOT_PLAN.md` §5d. Reads 3.3×–5.2× faster, writes to 3.9×,
      storage staging 1.8× faster, cold start unchanged. The spike was
      skipped in favour of doing the real thing; the contradiction it
      would have investigated (raw `createStore` 0.0503 vs Skal's
      0.0395) is now moot since neither path exists.
- [ ] **B2. The Proxy trap is now the floor.** RN still leads leaf reads
      2.3×–3.6×; a bare signal read is 0.0023 vs our 0.0086, so the
      remainder is the `get` trap plus one cache lookup. Options:
      accessor properties on a plain object (cannot intercept assignment
      to NEW keys — would need a fallback), or compile-time path
      resolution. Neither is costed.
- [ ] **B3. `bumpTree` over-notifies.** Solid diffed a replaced subtree
      and woke only changed leaves; we wake every descendant with a
      signal, at O(leaves ever read) per structural write. Fix is a
      version tree rather than a flat map — measure before building.
- [ ] **D. `makeNode` on object reads** — `s.user` is 6.8× behind RN and
      `object + 6 fields` 17.2×. That cost is entirely Skal's (array
      alloc + string concat + `nodeMemo` lookup), so it is attackable
      without touching the backing. Probably the best value per hour.
- [ ] **E. Lazy init** — Skal's eager init walk is 67% of the +38 ms a
      4 500-leaf store adds to cold start. Machinery exists but is
      opt-in (`paths: { x: { lazy: true } }`, `faulted`, `residentMax`).

### Not done — shipping fixes
- [ ] **WebCrypto ≥64-byte dispatch** — `TODO_OPTIMIZATIONS.md` §5. The
      one unambiguous benchmark RN wins; problem measured, fix designed,
      **not shipped**. Re-measure against benchmark §6 after.
- [ ] **Stale-bundle guard** — `if (!cjs.existsSync())` in
      `scripts/templates/default`, `examples/gallery`,
      `examples/virt-bench`. Only `examples/kitchen-sink` has the
      byte-comparing fix. `adb install -r` updates the APK and the app
      keeps running the previously extracted JS. Cost a full measurement
      round on 2026-08-02; presents as "my code didn't take effect".
      Workaround until fixed: `adb shell pm clear <pkg>` before each run.

### Not done — measurement debt
- [ ] **Persistence comparison is confounded.** Identical Skal code read
      0.0139–0.0167 in one run and 0.0396–0.0591 in another; adding the
      granular sweep ahead of it warmed the engine. Until re-run
      interleaved under one condition, **neither figure is usable** and
      whether MMKV or Skal wins durability is open.
- [ ] Storage / collection-shape results never written into
      `benchmark_v2/final-benchmark/RESULTS.md`.
- [ ] 5-minute background→resume produced no data (`resume-300s.csv` is
      a bare header).
- [ ] 15 code-review findings on `benchmark_v2` unaddressed.

**Note:** `benchmark_v2/` is gitignored, so every harness, bench screen
and prototype from that session (`ministore.js`, `FeedStoreScreen.jsx`,
`StoreBootScreen.jsx`, `harness/feedstore-scroll.sh`, the REAL/CTRL/MINI
arms) exists **only in the working tree**. It is not in any commit.

## Build pipeline

### Runtime bytecode version check
The `.cjs.jsc` is JSC-version-keyed. If the bun used to BUILD the
bytecode and the bun used INSIDE libskal disagree (e.g. someone
runs `bun run build` with a system bun by mistake), JSC silently
rejects the bytecode at runtime and falls back to parsing — no
error, just a cold-launch perf regression.

`examples/kitchen-sink/scripts/find-vendored-bun.sh` enforces the right bun at
build time. Add a complementary RUNTIME check: emit a marker file
alongside the bytecode containing the bun build commit hash; libskal
exposes its expected hash via a new C ABI; the loader logs a warning
on mismatch.

See `docs/bytecode-cache.md` § "JSC version coupling".

### ~~iOS Frameworks/ dylib regeneration on bun rebuild~~ — done (2026-07-27)
`examples/kitchen-sink/Makefile` now has a `sync-ios` target: the
checked-in `ios/Frameworks/{iphonesimulator,iphoneos}/libskal.dylib`
are declared as Make targets of `build/skal-ios*/libskal.dylib`, so a
newer source is copied automatically and `ios-sim` depends on it. Each
variant is included only if its source exists — the device dylib needs
a from-source WebKit JSC build most checkouts lack.

Complementary guard: `scripts/skal-link.sh` now verifies every binary
it installs against the C ABI header, symbol by symbol (the expected
set is parsed from `packages/skal_native/include/skal.h`, so adding an
entry point tightens the check automatically). A missing export is
otherwise SILENT — the Dart lookups are nullable and degrade, so an
app on a pre-doorbell libskal runs fine and merely loses the
optimization. That cost two benchmark runs on 2026-07-26.

### Background-isolate asset extraction
`main.dart`'s `_extractBytecodeAssets` runs synchronously on the
main isolate at cold launch. On first install it blocks for
~hundreds of ms while the .cjs + .cjs.jsc are written out of the
APK ZIP. Move to a background isolate (with `TransferableTypedData`
to avoid copying the payload across isolates). See
[`PERFORMANCE.md`](PERFORMANCE.md) §1.

---

## SDK shape

### `npx skal create my-app`
Today's repo IS the app. A user wanting to build with Skal would
have to fork this whole thing. The end state: a CLI scaffold that
produces a fresh project pulling pre-built `libskal.{so,dylib}`
binaries (per arch + platform) from a CDN, ships a `package.json`
with `skal-app` deps, and wires it into a Flutter app shell.

This is post-MVP work; tracked in
[`TODO_PLATFORMS.md`](TODO_PLATFORMS.md) §3 (the "third-party app"
shape).

### Plugin bridge
Today Skal apps can call JS Web APIs (fetch, URL, etc. via bun) but
not platform-native APIs (camera, geolocation, biometrics, file
picker). The plan: a Dart-side dispatcher in Flutter that exposes
pub.dev plugins to JS through the bridge's event-ring path. Each
plugin gets ~50 LOC of Dart shim.

Spec to write: how JS `import Camera from '@skal/camera'` resolves
at build time, how its calls cross the bridge, how event-back
callbacks deliver results.

### Web target — Flutter→DOM consistency
The Web target uses `packages/skal-js/src/renderer-web.js` which maps
`<column>` etc. to `<div>` plus inline styles. The mapping is
hand-maintained and lags behind the Flutter side. Specifically:
adding a new widget type means three edits — `wire.dart`,
`renderer.js`, `renderer-web.js` — and forgetting the third is a
silent bug. A code-gen step from a single source-of-truth wire
schema would close that gap.

See [`WEB_SUPPORT_PLAN.md`](WEB_SUPPORT_PLAN.md) for the full web
architecture — DOM renderer + Option B.5 hidden Flutter Web for
plugins. Phases 0-5 tracked there.

---

## Considered and rejected (revisit when profiling shows it)

### Trie for `_skalNotify` descendant walk
[`db.js`](../packages/skal-js/src/skal/store/db.js) — `_skalNotify`, descendant
branch.

Currently `_skalNotify(sk, true)` walks the full `_skalEffectMap` for
keys starting with `sk + '.'` — O(total registered paths). A
path-segment trie was tried in a pre-release spike: it makes the
descendant walk O(depth + matched), but the trie's per-effect
register cost rose from O(1) Map.set to O(depth) trie walk.
For typical Skal stores (10s–100s of registered paths), the flat-scan
descendant walk was already <5 µs, so the trade ended up a wash or
slightly negative.

Reverted. Revisit when profiling shows the descendant walk as a real
cost — most likely an app with 10k+ declared-dep effects + frequent
wholesale writes.

---

## Smaller things

### ~~Material ↔ Cupertino design switching~~ — fixed (2026-07-27)
Two independent defects, both surfaced by the demo's Animations screen:

- **A crash in a supported configuration.** `_screenChrome`'s Cupertino
  branch returned a bare `CupertinoPageScaffold`, which hosts no
  `Material`. A Skal tree is not all-Cupertino — the builders emit
  Material widgets needing an ink host — so a `<screen title>` under
  Cupertino design threw "No Material widget found" as soon as one
  painted. No switching involved. Fixed with a
  `Material(type: MaterialType.transparency)` around the content: it
  paints nothing, clips nothing, sets no text style.
- **Switching the mode did nothing.** `MemoizingListenableBuilder`
  serves each node's cached subtree until that node's own `cold` fires,
  so a flip reached almost nothing and the tree rendered half in each
  design — while three comments called the mode init-time-only and the
  demo shipped a button for it. `opSetDesign` now dirties every node
  when (and only when) the mode actually changes; brightness alone still
  goes through `_SkalBrightness` and rebuilds only `<text>`. The three
  stale comments are corrected.

A third suspect — `CupertinoPage` ↔ `MaterialPage` colliding under one
`ValueKey<int>` — turned out to be wrong: `Page.canUpdate` compares
`runtimeType`, so the navigator replaces the route by itself. The
design-discriminating page key written for it was deleted after mutating
it back changed no test.

Covered by `test/design_mode_test.dart` (7 widget tests over a real
`SkalRoot` + `Navigator`, which the `SkalRuntime` seam made possible).

### `<lazyColumn>` alignment support
Today `_buildLazyColumn` ignores `PROP_ALIGNMENT`. `ListView.builder`
positions children by extent, not by main-axis arrangement; getting
alignment to work needs a `SliverList` + leading/trailing widgets.
Add when an app shows up that needs it.

### Tests
- ~~Bridge round-trip test~~ — **done** (2026-07-27).
  `test/bridge_drain_test.dart` + `test/fake_skal_runtime.dart` write a
  real op stream into a real 6 MiB region at the real `wire.dart`
  offsets, pump, and assert the resulting NodeState graph and its
  notifications. Needed a seam first (`skal/runtime.dart`) because
  `Skal`'s constructor is private behind a `dlopen`.
- ~~Cross-language wire-constant test~~ — **done**,
  `test/wire_cross_lang_test.dart`.
- ~~`packages/skal-js` has no suite~~ — **started** (2026-07-27).
  `packages/skal-js/test/bridge.test.js` (`bun test`, wired into
  `.github/workflows/tests.yml`) covers the encoder, the diff cache and
  the doorbell ringing rule + coalescing gate. Still uncovered on the JS
  side: the renderer, `hot.js`, and the store.

### ~~`flutter analyze` warning~~ — done (2026-07-27)
`packages/skal_flutter` and both example hosts now analyze with **zero**
issues (was 13 infos + 1). Worth keeping at zero: the next real warning
should not have to be spotted inside a standing list.

### ~~Dispose semantics on hot reload~~ — investigated, not a leak (2026-07-27)
Two paths, both already correct:

- **Node removal** (`opRemoveNode`, `<animatedList>` exit, builder-row
  eviction) goes through `_removeSubtree`, which *does* call
  `NodeState.dispose()` on every node in the DFS.
- **The hot-reload sweep** (`opResetRootSubtree`) deliberately does
  NOT dispose the generation it drops, and says so in a comment: the
  outgoing SkalNode widgets and any host `AnimationController`s are
  still mounted until the rebuild, and disposing a notifier they hold
  would risk "used after dispose" if one ticks in between. Dropping
  from `nodes` is enough — each swept NodeState is unreferenced once
  its widget unmounts and removes its own listener.

Now pinned by `group('hot-reload tree sweep')` in
`test/bridge_drain_test.dart`, including the root-instance identity
(SkalRoot is bound to it; replacing it strands the mounted root on a
dead notifier) and id reuse by the incoming generation.

---

## Codegen polish

Carried over from the archived [`TODO_FLUTTER_LIBS.md`](DONE_OR_STALE/TODO_FLUTTER_LIBS.md) —
small, mechanical extensions to add as real pub packages surface needs.

### More value types
`Curve`, `BorderSide` (per-side `Border`), `DecorationImage`, `Locale`,
`IconData`, plus `BoxShadow` (list form). Each is a ~30 min branch in
`packages/skal_codegen/lib/src/type_mapper.dart` — same pattern as
the existing `Gradient` / `BoxDecoration` / `TextStyle` encoders.

### Per-package codegen subdirectories
The flat output `lib/skal_codegen.g.dart` works fine while a host wraps
10-20 packages. Past 50+ it would help to split outputs per source
package.

### Source maps for generated code
Stack traces inside an emitted adapter point at the `.g.dart` file
(useful) but not back at the source widget class. A source-map would
close the loop. In practice the Dart errors already include line
numbers in the generated file, so this is a polish item.

### Hot-reload of generated code
Codegen runs in ~1s; incremental doesn't add value today. Revisit if
the host package list grows past ~50.

### RPC over network / out-of-process Dart side
Would require rethinking the shared-memory bridge as a transport-
agnostic channel. Feasibility study only — not in any current slice.
