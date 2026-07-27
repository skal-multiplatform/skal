# Skal — open items

Things deferred or in-flight, in roughly priority order. Real items
only — only what we've actually hit and chosen to defer or schedule.

For perf-specific decisions see [`PERFORMANCE.md`](PERFORMANCE.md).
For measured-but-undesigned optimization candidates see
[`TODO_OPTIMIZATIONS.md`](TODO_OPTIMIZATIONS.md).
For platform-specific work see [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md).

---

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
