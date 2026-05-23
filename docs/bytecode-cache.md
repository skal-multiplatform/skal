# Bytecode caching in Skal

Goal: eliminate per-launch JS parse cost in release builds. Skal ships ~18 KB
of Vite-bundled Solid app code; without caching, JSC parses + bytecode-generates
that on every cold start (~80–250 ms in release). With caching, that work
happens once at build time on the host and the `.jsc` bytes ride along in the
APK; runtime loads them and skips parse entirely.

## What landed

Release-build cold start, observed:

| | Plain evaluate | Phase 2 (bytecode cache) |
|---|---|---|
| First launch (cache cold) eval | 109–252 ms | **40 ms** |
| Subsequent eval (warm) | 109–252 ms | **34 ms** |
| Total cold start (init+eval) | ~700 ms | **~70–137 ms** |

That's ~3–6× faster on the JS portion of cold start. Total cold start improves
proportionally because the eval phase is now a small fraction of the budget.

Debug builds keep the simple source-eval path — they re-parse every launch,
which we'll trade for hot-reload support later.

## Three caching layers (only one is "ours")

JavaScriptCore (via bun) supports three distinct bytecode caching mechanisms.
Skal uses two of them and ignores the third.

### Layer 1 — built-in module bytecode (free, already on)

Every file under `vendor/bun/src/js/` (`node:fs`, `node:vm`, `node:http`, the
global `console`/`URL`/`fetch` setup, `Bun.serve` glue, etc.) gets parsed and
serialized as bytecode at **bun's** build time. The bytecode bytes are linked
into `libskal.so` as `.rodata` sections. At runtime, when our worker thread
calls `bun.jsc.VirtualMachine.init(...)`, all the built-in module loading
short-circuits parsing — JSC just deserializes the embedded bytecode.

This is what makes `init` itself fast (~70 ms warm, ~600 ms cold). Without it,
bun's startup would re-parse the entire Node compatibility surface on every
launch, which would take seconds.

We don't have to do anything for this. It's automatic when you build bun.

### Layer 2 — app bytecode shipped in APK (what we built)

Skal's app code (`skal-app.js`) is parsed at build time on the host machine
using `bun build --bytecode --format=cjs`. The output is two files:

- `skal-app.cjs` — the source, wrapped in a CommonJS function and prefixed
  with the `// @bun @bytecode @bun-cjs` marker.
- `skal-app.cjs.jsc` — JSC's serialized unlinked code block for that source.

Both ship in `APK/assets/`. At runtime, we extract them to `filesDir/` (the
app's private data directory, accessible via standard filesystem APIs from
JS) and call `await import('file:///path/to/skal-app.cjs')`. Bun's module
loader sees the marker, finds the adjacent `.jsc`, attaches it to the
`SourceProvider` as a `JSC::CachedBytecode`, and JSC's parser short-circuits.

No C++ shim required. We reuse bun's existing module loader path.

### Layer 3 — `node:vm` Script.cachedData (tried, rejected)

`node:vm`'s `new Script(source, { cachedData, produceCachedData })` exposes
JSC's `CachedBytecode` API to user JS. We tried this first because it's a
runtime-only solution (no build-pipeline change), but for our 18 KB IIFE the
wrapper overhead (async IIFE + dynamic imports of `node:fs`/`node:vm` +
`vm.Script` construction) exceeded the parse savings. The cache file was also
only ~1 KB — `vm.Script` only caches the program-level wrapper, not the IIFE
function body, so most of the parse cost still happened on every launch.

Layer 2 wins because it caches **the whole bundle** (`recursivelyGenerate
UnlinkedCodeBlockForProgram` in bun's bytecode generator goes through nested
function bodies eagerly, where `vm.Script` defers them) and goes through the
module loader directly with no `vm.Script` wrapper overhead.

## Build pipeline

```
packages/skal-js/src/*.jsx                                                       (source)
        │
        ▼ vite build (with vite-plugin-solid in universal mode)
android-app/.../assets/skal-app.js                                     (IIFE, ~18 KB — debug)
        │
        ▼ bun build --bytecode --format=cjs
android-app/.../assets/skal-app.cjs                                    (CJS-wrapped, ~27 KB — release)
android-app/.../assets/skal-app.cjs.jsc                                (bytecode, ~234 KB — release)
        │
        ▼ ./gradlew :app:assembleRelease
APK with all three files in assets/
```

The pipeline is wired in `packages/skal-js/package.json`:

```json
"scripts": {
  "build": "vite build && bun run build:bytecode",
  "build:js-only": "vite build",
  "build:bytecode": "bun build .../assets/skal-app.js --bytecode --format=cjs ..."
}
```

`vite build` is the canonical Solid-toolchain step (we need it because
`babel-preset-solid` does Solid's template-optimization JSX transform, and
Vite is the standard host for that). The bytecode pass takes Vite's IIFE
output and re-bundles it as CJS with bytecode appended. Total per-build cost:
~150 ms vite + ~50 ms bun build + ~3 sec APK assemble = ~3–4 sec per change.

The bytecode step is **only** for release builds — debug builds use the
plain IIFE because they want hot-reload-friendliness.

## Runtime path

`examples/kitchen-sink/flutter-host/lib/main.dart` switches on `kReleaseMode`:

```dart
if (kReleaseMode) {
  final cjsPath = await _extractBytecodeAssets();
  final loader =
      "(async()=>{await import(${_jsStringLiteral('file://$cjsPath')});"
      "return 'skal-app loaded';})();";
  result = skal.evaluate(loader, url: 'skal:loader');
} else {
  final source = await rootBundle.loadString('assets/skal-app.js');
  result = skal.evaluate(source, url: 'skal-app.js');
}
```

`_extractBytecodeAssets` copies both `skal-app.cjs` and
`skal-app.cjs.jsc` out of the APK ZIP into
`getApplicationSupportDirectory()` and returns the absolute path to
the `.cjs`. Required because bun's module loader works on real
filesystem paths — APK assets aren't directly addressable by
`node:fs`. Skip-if-exists makes this a no-op on warm relaunches.

The async-IIFE bootstrap script:

```js
(async () => {
  await import("file:///data/data/com.skal.bench/files/skal-app.cjs");
  return 'skal-app loaded';
})();
```

That script is passed to `skal_evaluate` (which goes through
`Bun__REPL__evaluate`). The dynamic `import()` triggers bun's module loader,
which:

1. Resolves the file URL to `/data/data/com.skal.bench/files/skal-app.cjs`
2. Reads the source, sees `// @bun @bytecode @bun-cjs` marker → CJS module
   with adjacent bytecode
3. Reads `skal-app.cjs.jsc` from the same directory
4. Validates the bytecode header against JSC's current `SourceCodeKey` +
   `getJSCBytecodeCacheVersion()`
5. If valid: `CachedBytecode::create(bytes, ...)` → attaches to source
   provider → JSC's parser short-circuits → unlinked code block deserialized
6. If invalid (rare — would mean a JSC version mismatch): silently falls
   back to parsing the source. Slower, but still correct.
7. Bun calls the CJS wrapper function. The IIFE inside runs synchronously,
   mounts the Solid app, registers bridge globals.
8. The async IIFE resolves; Zig's `EvalRequest.runOnVmThread` sees the
   promise, calls `waitForPromise`, returns to the caller.

By the time `skal_evaluate` returns, the app is fully mounted. The whole
async dance is observably synchronous from the Dart side because the
worker thread waits for the promise before returning.

## Why CJS, not ESM

Bun's `--bytecode` flag combined with `--format=cjs` produces a separable
`.js` + `.jsc` pair we can ship and load independently. `--format=esm`
**requires** `--compile` (which produces a self-contained executable, not
useful for embedding in an APK). The CJS form keeps the bytecode in a
sibling file with a stable convention (`<source>.jsc`) that bun's module
loader picks up automatically.

The CJS wrapper that bun adds is the standard
`(function(exports, require, module, __filename, __dirname) { ... })` envelope.
Our IIFE doesn't actually use any of those parameters — Vite's bundle is
self-contained. The wrapper is essentially invisible to our code; it just
makes the source addressable via the module loader's CJS path.

A more detailed CJS-vs-ESM comparison lives in `docs/cjs-vs-esm.md` (TODO if
ever needed).

## Risks and limitations

### JSC version coupling

The `.jsc` file is keyed to the exact JSC version that produced it (via
`getJSCBytecodeCacheVersion()` plus the source's `SourceCodeKey`). The
host bun and our libskal.so must agree:

```
host bun:        1.3.13 at vendor/bun commit 6d0d86b71a...
libskal.so:      built from vendor/bun at commit 6d0d86b71a... (same commit)
```

When you upgrade `vendor/bun` to a newer commit, you **must** also rebuild
`libskal.so` AND regenerate the bytecode (just running `bun run build` in
`packages/skal-js/` (and the consuming app) re-runs the bytecode pass). If only one is updated, JSC will
reject the bytecode at load time and silently fall back to parsing — no
crash, but no perf win either.

There's no automated version check yet. The mismatch is detectable by
observing eval times stay high after a bun upgrade. A future improvement
would be to read `getJSCBytecodeCacheVersion()` from JS at startup and
compare against a value baked into the bytecode build.

### APK size

The `.jsc` is ~234 KB for our 18 KB source — about 13× larger because
bytecode encodes pre-resolved symbol tables, function executables, string
literals, etc. For our 91 MB libskal.so this is rounding error, but for a
hypothetical larger app the ratio holds: bytecode is ~10–15× source size.

The IIFE source (`skal-app.js`, debug-only) also ships in release APKs
today. Could be stripped via build-flavor-specific source sets if APK size
matters.

### Asset extraction every launch

`extractAsset` re-copies both files to `filesDir` on every cold launch.
Cheap (~1–10 ms for ~250 KB on internal storage), but unnecessary when the
APK hasn't changed. A small optimization: compare the APK's last-modified
time against `filesDir/skal-app.cjs.mtime` and skip the copy when up to date.

### No fallback path

If the bytecode is rejected (version mismatch) or the `.jsc` file is
missing, bun falls back to parsing the `.cjs` source. This works correctly
but silently — there's no log surfacing the rejection. For diagnosing perf
regressions, we'd want to surface the `cachedDataRejected`-style signal.
Currently observable only by measuring eval times.

## Measurement / verification

The simplest signal is the on-screen perf HUD (`init=… · eval=…`). Compare
release-mode eval before vs after bytecode caching:

```
Plain evaluate (release):    init=92 ms · eval=42–252 ms
Phase 2 (release, warm):     init=37 ms · eval=34 ms
```

For deeper inspection, force-stop and relaunch:

```bash
adb shell am force-stop com.skal.bench
adb shell am start -n com.skal.bench/com.skal.bench.MainActivity
adb logcat -d -s SkalBench:I | tail -3
```

Each line shows `init=Xms eval=Yms result=skal-app loaded` (or an error
string if something failed).

To confirm the bytecode is actually being used (vs silently falling back),
delete it from the device and observe eval time grow:

```bash
adb shell run-as com.skal.bench rm files/skal-app.cjs.jsc
# (only works on debuggable builds; release builds need root or a
#  workaround)
```

## File map

| Path | Role |
|---|---|
| `packages/skal-js/src/*.jsx` | Solid app source |
| `examples/kitchen-sink/vite.config.js` | Vite + vite-plugin-solid (universal renderer mode) |
| `packages/skal-js/package.json` | Build orchestration (vite + bun build) |
| `android-app/.../assets/skal-app.js` | Vite IIFE — debug eval target |
| `android-app/.../assets/skal-app.cjs` | bun-built CJS wrapper — release eval target |
| `android-app/.../assets/skal-app.cjs.jsc` | bytecode for the .cjs |
| `packages/skal_flutter/lib/skal_ffi.dart` | `Skal.evaluate(source)` — both debug and release call through this; the release loader IIFE just happens to be `await import('file://...')` |
| `examples/kitchen-sink/flutter-host/lib/main.dart` | `kReleaseMode` switch + asset extraction |
| `vendor/bun/src/jsc/bindings/ZigSourceProvider.cpp` | (bun internal) `extern "C"` bytecode generator + loader plumbing — what makes Layer 2 possible without us writing C++ |
| `vendor/bun/src/jsc/ModuleLoader.zig` | (bun internal) auto-discovers adjacent `.jsc` files when source has `@bun-cjs` marker |

## What we explicitly didn't build (for context)

- A custom `JSC::SourceProvider` subclass in C++ that takes raw bytecode
  bytes. We were going to write this; turned out unnecessary because bun's
  module loader already does it.
- A standalone `bun` host build with a custom `bytecode-emit` CLI subcommand.
  Same reason — `bun build --bytecode --format=cjs` from the user's
  installed bun (matching version) does the job.
- A `skal_evaluate_with_bytecode(handle, source, bytecode)` C ABI.
  Replaced by the simpler `evaluateModuleAtPath` that goes through the
  existing eval path.
- Build-time bytecode embedded in `libskal.so`. Possible (concatenate `.jsc`
  into a `.rodata` section at link time) but offers no runtime benefit over
  shipping as an APK asset, costs us a 10-min libskal.so rebuild on every
  JS change.
