# Skal — open items

Things deferred or in-flight, in roughly priority order. Real items
only — only what we've actually hit and chosen to defer or schedule.

For perf-specific decisions see [`PERFORMANCE.md`](PERFORMANCE.md).
For platform-specific work see [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md).

---

## Build pipeline

### Runtime bytecode version check
The `.cjs.jsc` is JSC-version-keyed. If the bun used to BUILD the
bytecode and the bun used INSIDE libskal disagree (e.g. someone
runs `bun run build` with a system bun by mistake), JSC silently
rejects the bytecode at runtime and falls back to parsing — no
error, just a cold-launch perf regression.

`js-app/scripts/find-vendored-bun.sh` enforces the right bun at
build time. Add a complementary RUNTIME check: emit a marker file
alongside the bytecode containing the bun build commit hash; libskal
exposes its expected hash via a new C ABI; the loader logs a warning
on mismatch.

See `docs/bytecode-cache.md` § "JSC version coupling".

### iOS Frameworks/ dylib regeneration on bun rebuild
`flutter/skal_flutter/ios/Frameworks/{iphonesimulator,iphoneos}/libskal.dylib`
are checked-in copies of `build/skal-iossim/libskal.dylib` /
`build/skal-ios-device/libskal.dylib`. If you rebuild bun for iOS
without re-copying, the Flutter iOS build ships a stale dylib. Add
this to `flutter/Makefile`'s `bundle` target (or a new `sync-ios`
target).

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
The Web target uses `js-app/src/renderer-web.js` which maps
`<column>` etc. to `<div>` plus inline styles. The mapping is
hand-maintained and lags behind the Flutter side. Specifically:
adding a new widget type means three edits — `wire.dart`,
`renderer.js`, `renderer-web.js` — and forgetting the third is a
silent bug. A code-gen step from a single source-of-truth wire
schema would close that gap.

---

## Store (`createSkalStore`) — known rough edges

Items found during review of the `native-store-engine` work. None are
critical — the store is correct for typical usage — but each is a sharp
edge that would bite a specific pattern.

### Phantom element frames for `_id`-less objects in non-collection arrays
[`db.js`](js-app/src/skal/store/db.js) — `arrayProxy.get`, numeric key
branch.

When an array contains objects-without-`_id` (degenerate case —
arrays mixed with primitives, or objects placed via raw `produce`),
`arrayProxy.get` creates a synthetic `elInfo` so writes inside the
element re-stage a `items.0` frame. But the persisted whole-array
frame at `'items'` remains the source of truth on disk — the
`items.0` frame is an orphan.

Manifests only for degenerate arrays. Fix: detect the case, either
upgrade the array to a real collection (give every element an `_id`)
or skip the synthetic `elInfo` and stage through the parent frame.

### `_skalNotify` descendant walk is O(`_skalEffectMap.size`)
[`db.js`](js-app/src/skal/store/db.js) — `_skalNotify`, descendant
branch.

Every wholesale write at sk walks the full effect map for keys
starting with `sk.`. Fine for typical stores (10s–100s of effect
paths); could matter for an app with 10,000+ declared-dep effects
AND frequent wholesale writes.

Fix idea: maintain a path-tree (radix tree) of registered effect
paths so descendant lookup is O(prefix-depth · branch-factor)
instead of O(total-paths). Only worth doing if profiling shows it.

### `arrayProxy.set` numeric key calls `_isColl(arr())` per write
[`db.js`](js-app/src/skal/store/db.js) — `arrayProxy.set`, numeric
key branch.

The splice path uses `collCache` to skip the O(n) rescan; the direct
index-assign path doesn't. Direct index assign on collections is
uncommon (most code splices/pushes), so this isn't a hot path. Fix:
add the same collCache-with-incremental-update treatment that splice
uses.

### Symmetric hydrate shape divergence
[`db.js`](js-app/src/skal/store/db.js) — `hydrate`, primitive
branch.

The asymmetric case ("disk says primitive where initState says
object") is fixed: hydrate now skips the recursion and schedules a
prefix-tombstone. The symmetric case ("disk says object where
initState says primitive") is unfixed: hydrate sets the live value
to the disk-loaded object but doesn't recurse into its shape, so
any deeper leaf-overrides written under it are silently dropped.

Plausibility is low — devs typically type initState faithfully — so
this is deferred. Fix when it manifests.

---

## Smaller things

### `<lazyColumn>` alignment support
Today `_buildLazyColumn` ignores `PROP_ALIGNMENT`. `ListView.builder`
positions children by extent, not by main-axis arrangement; getting
alignment to work needs a `SliverList` + leading/trailing widgets.
Add when an app shows up that needs it.

### Tests
- Bridge round-trip test: write a known op stream into the shared
  region, call `pumpOps`, assert the resulting NodeState graph.
  Catches future wire-format regressions.
- Cross-language wire-constant test: parse `wire.dart` + `bridge.js`
  side by side and assert all `OP_*` / `PROP_*` / `WT_*` literals
  agree. Catches the "added a constant on one side, forgot the
  other" footgun.

### `flutter analyze` warning
`bridge.dart:59:23` — "Angle brackets will be interpreted as HTML".
A `Set<int>` in a doc comment. Wrap in backticks.

### Dispose semantics on hot reload
`NodeState.dispose()` releases the ChangeNotifier listeners. On
Flutter hot reload the entire SkalRoot tree gets recreated but the
bridge's `nodes` map persists — listeners from the old tree are
leaked. Not critical for production builds (no hot reload there)
but worth a clean shutdown path.
