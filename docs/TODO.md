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

`examples/kitchen-sink/scripts/find-vendored-bun.sh` enforces the right bun at
build time. Add a complementary RUNTIME check: emit a marker file
alongside the bytecode containing the bun build commit hash; libskal
exposes its expected hash via a new C ABI; the loader logs a warning
on mismatch.

See `docs/bytecode-cache.md` § "JSC version coupling".

### iOS Frameworks/ dylib regeneration on bun rebuild
`examples/kitchen-sink/flutter-host/ios/Frameworks/{iphonesimulator,iphoneos}/libskal.dylib`
are checked-in copies of `build/skal-iossim/libskal.dylib` /
`build/skal-ios-device/libskal.dylib`. If you rebuild bun for iOS
without re-copying, the Flutter iOS build ships a stale dylib. Add
this to `examples/kitchen-sink/Makefile`'s `bundle` target (or a new `sync-ios`
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
