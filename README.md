# Skal

> Solid in JS, Compose Multiplatform rendering. One bridge, three platforms.

Skal embeds [bun](https://bun.sh) (and [JavaScriptCore](https://trac.webkit.org/wiki/JavaScriptCore))
inside a [Compose Multiplatform](https://www.jetbrains.com/lp/compose-multiplatform/) app. Your UI
is a [SolidJS](https://www.solidjs.com/) component tree; Skal's bridge translates Solid's
[universal renderer](https://www.solidjs.com/docs/latest/api#createcomponent) ops into
Compose composables. Same JS bundle runs on Android, macOS Desktop, and iOS Simulator.

## Status

| Platform | State | Notes |
|----------|-------|-------|
| **Android** | ✅ working | arm64 only; release path uses bun bytecode cache for parse-free cold start |
| **macOS Desktop** | ✅ working | Compose Desktop window with the Solid demo, JNI-backed |
| **iOS Simulator** | ✅ working | Real bun runtime via vtool re-stamp + cinterop bridge (see [docs/ios-port.md](docs/ios-port.md)) |
| **iOS Device** | ⏳ pending | needs full bun cross-compile — Phase 2-Device in `docs/ios-port.md` |
| **Linux/Windows Desktop** | ⏳ pending | tracked in `TODO_PLATFORMS.md` § 3.4 |

See [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md) for the punch list to take each platform from
"demo runs" to "ship-it on app stores".

## What it looks like

The same `skal-app.js` (a Solid app with a counter, +1000-bench button, and 5000 fake
tweets) on each platform. Wire format and bridge code is in `shared/`; per-platform native
runtime is `libskal.so` (Android) / `libskal.dylib` (Desktop, iOS Sim).

## Architecture

```
                 .———————————————————————————————————————.
                 |  shared/ (Kotlin Multiplatform)        |
                 |    commonMain: SkalBridge, SkalRoot,   |
                 |                SkalRuntime, SkalBuffer |
                 |    jvmMain:    Skal.java + JNI wrapper |
                 |    iosMain:    cinterop'd C wrapper    |
                 |  drains the op ring once per frame     |
                 .———————————————————————————————————————.
                          ^                ^
                          | bridge ops     | bridge ops
                          | (2 MiB shared  | (2 MiB shared
                          |  ring buffer)  |  ring buffer)
                          |                |
                 .—————————————————————————————————.
                 |  libskal.{so,dylib}              |
                 |    bun runtime + JSC + bridge.js |
                 |    skal_entry.zig — JNI + C ABI  |
                 .—————————————————————————————————.
                          ^
                          | __skal_acquireBridge()
                          | (no-copy ArrayBuffer)
                          |
                 .—————————————————————————————————.
                 |  skal-app.js (Solid + universal  |
                 |   renderer + bridge.js helpers)  |
                 .—————————————————————————————————.
```

The bridge is a 2 MiB shared memory region with three rings:

  * **Op ring** (1 MiB) — JS writes node-tree mutations, Compose reads them. CREATE_NODE,
    INSERT_BEFORE, SET_TEXT, etc.
  * **String heap** (512 KiB) — UTF-8 bytes for SET_TEXT payloads.
  * **Event ring** (~448 KiB) — Compose writes touch events, JS reads them.

JS sees the region as a `Uint8Array` (no copy via JSC's `JSObjectMakeArrayBufferWithBytesNoCopy`);
Kotlin sees it as a `DirectByteBuffer` on JVM (no copy via JNI's `NewDirectByteBuffer`)
or as a `CPointer<UByteVar>` on Kotlin/Native iOS (cinterop). See
[`patches/SKAL_WIRE.md`](patches/SKAL_WIRE.md) for the wire format and
[`docs/bytecode-cache.md`](docs/bytecode-cache.md) for the JSC bytecode story.

## Build

### Prerequisites

  * macOS 14+ (other hosts: TODO — see `TODO_PLATFORMS.md` § 3.4)
  * Xcode 16+ (15 may work; 26.x verified)
  * JDK 17 — Gradle's toolchain manager auto-downloads if absent
  * `~/.cargo/bin` on PATH (for bun's lolhtml dep — `rustup install nightly` once)
  * Android NDK at `/opt/homebrew/share/android-ndk` (Android only)

### One-time setup

```sh
# Clones vendor/bun + vendor/WebKit at pinned commits, applies patches,
# copies skal_entry.zig into bun's source tree.
scripts/setup.sh

# Builds the host bun used for bytecode generation. ~30 min cold,
# ~3 min incremental. Required by every platform.
cd vendor/bun
PATH="$HOME/.cargo/bin:$PATH" bun run build:release
cd ../..
```

### Per-platform builds

| Platform | Command |
|----------|---------|
| Android  | `scripts/build-icu-android.sh && scripts/build-jsc-android.sh` (one-time) → `cd vendor/bun && PATH=... bun scripts/build.ts --profile=android-release` → `scripts/link-skal-so.sh` → `cd android-app && ./gradlew :app:assembleDebug` |
| Desktop  | `scripts/link-skal-dylib.sh` → `cd desktop-app && ./gradlew run` (Gradle's `linkSkalDylib` task auto-invokes the link script for fresh checkouts) |
| iOS Sim  | `scripts/link-skal-iossim.sh` → `cd ios-app && ./gradlew linkDebugFrameworkIosSimulatorArm64` → `cd iosApp && xcodegen generate && xcodebuild ...` (full recipe in `ios-app/README.md`) |

### JS bundle

Edit `js-app/src/`, then `cd js-app && bun run build`. Produces:
  * `android-app/app/src/main/assets/skal-app.js` (Vite IIFE bundle, used by Debug)
  * `android-app/app/src/main/assets/skal-app.cjs` + `.cjs.jsc` (bytecode pair, used by Release for parse-free start)

Bytecode generation uses `vendor/bun/build/release/bun` — see `js-app/scripts/find-vendored-bun.sh`
for why we don't use `$PATH` bun.

## Module layout

```
skal/
├── shared/                   # KMP module — bridge code, runs on all platforms
├── android-app/              # Android Gradle module — produces APK
├── desktop-app/              # Compose Desktop module — produces .dmg
├── ios-app/                  # Kotlin/Native iOS framework + Xcode host project
├── js-app/                   # Solid UI — Vite + bytecode pipeline
├── native/                   # C entry surface for iOS cinterop + iOS Sim shim
├── patches/                  # bun + WebKit patches; skal_entry.zig (the runtime)
├── scripts/                  # link-skal-*.sh, build-*.sh, setup.sh
├── vendor/                   # cloned by setup.sh: bun + WebKit at pinned commits
├── build/                    # build outputs — skal-android/, skal-darwin/, skal-iossim/
└── docs/                     # bytecode-cache.md, ios-port.md, SKAL_WIRE.md (in patches/)
```

## What lands where (modularity invariants)

Per `TODO_PLATFORMS.md` § 0.5:

  * `libskal.so` (Android, JNI exports only)
  * `libskal.dylib` macOS Desktop (JNI exports only, no iOS code)
  * `libskal.dylib` iOS Simulator (C exports only, with `__clear_cache` shim)
  * `libskal.dylib` iOS Device (future, C exports only)

Same `bun-zig.*.o` source feeds all four; the link step is per-platform and outputs go in
distinct `build/skal-<platform>/` dirs. Changing the iOS Sim link script doesn't relink
the Desktop binary, and vice versa.

CI is per-platform (`.github/workflows/{android,desktop,ios-sim}.yml`) with paths-filtered
triggers. A nightly cross-platform job catches the case where a per-platform PR's filter
let a coupling slip through.

## Documentation

| Doc | Audience |
|-----|----------|
| [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md) | Anyone shipping a platform — the punch list |
| [`docs/ios-port.md`](docs/ios-port.md) | Phase 2-Device (real iOS cross-compile) |
| [`docs/bytecode-cache.md`](docs/bytecode-cache.md) | Why `.cjs.jsc` exists; JSC version coupling |
| [`patches/SKAL_WIRE.md`](patches/SKAL_WIRE.md) | Bridge wire format spec |
| [`TODO.md`](TODO.md) | Smaller deferred items (perf, hot reload research, etc.) |
| `ios-app/README.md` | iOS-specific build + Xcode setup |

## License

TBD — see repo settings.
