# Skal

> Solid in JS, Flutter rendering, native plugins, one bridge.

Skal embeds [bun](https://bun.sh) + [JavaScriptCore](https://trac.webkit.org/wiki/JavaScriptCore)
inside a [Flutter](https://flutter.dev/) app. Your UI is a [SolidJS](https://www.solidjs.com/)
component tree; Skal's bridge translates Solid's
[universal renderer](https://www.solidjs.com/docs/latest/api#createcomponent) ops into
Flutter widgets through a zero-copy 2 MiB shared memory region. Same JS bundle, native
performance, pub.dev's plugin ecosystem for camera / location / biometrics / file picker
and every other RN-shaped native capability.

This is **"RN but actually fast"** — Solid + bun beat React + Hermes on the JS side; a
permanent shared ArrayBuffer beats RN's old MessageQueue serialization on the bridge side;
pub.dev's plugin ecosystem covers every native capability you'd otherwise need to bridge by hand.

See [`docs/ENGINE_CHOICE.md`](docs/ENGINE_CHOICE.md) for the full decision matrix.

## Status

| Platform | State | Notes |
|----------|-------|-------|
| **Android** | ✅ working | arm64 only currently; release path uses bun bytecode cache |
| **iOS Simulator** | ✅ working | dylib re-stamped from macOS arm64 → IOSSIMULATOR via `vtool`; debug + profile only (Flutter blocks release on Sim) |
| **iOS Device** | ✅ working | bun + WebKit cross-compiled for `aarch64-apple-ios`; libskal.dylib embedded + signed by Xcode |
| **macOS Desktop** | ✅ working | debug + release; libskal.dylib in `macos/Frameworks/` |
| **Linux / Windows Desktop** | ⏳ pending | Flutter Desktop supports them; per-platform libskal linkers not written |
| **Web** | ✅ working | separate target — Solid + DOM directly, no Flutter Web |

See [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) for the perf decision log and budget invariants.

## What it looks like

The same `skal-app.js` (a Solid app with a counter, +1000-bench button, and up-to-5000-tweet
feed) runs on each platform. JSX in, native UI out. Performance budget on the emulator:

```
init 20 ms · first eval 36 ms (bytecode cache hit) · boot 56 ms
60 FPS · pump 0.151 ms avg (0.151 ms peak) · 1207 prop writes / 316 nodes touched
```

## Architecture

```
                 ┌──────────────────────────────────────────┐
                 │  flutter/skal_flutter/lib/skal/          │
                 │    wire.dart       — opcode constants    │
                 │    node_state.dart — per-node Notifier×2 │
                 │    bridge.dart     — pumpOps op decoder  │
                 │    root.dart       — SkalNode widget tree│
                 │  drains the op ring once per Ticker tick │
                 └──────────────────────────────────────────┘
                          ▲
                          │ bridge ops (2 MiB shared
                          │             ArrayBuffer)
                          │
                 ┌──────────────────────────────────┐
                 │  libskal.{so,dylib}              │
                 │    bun runtime + JSC + bridge    │
                 │    skal_entry.zig — C ABI exports│
                 └──────────────────────────────────┘
                          ▲
                          │ globalThis.__skal_acquireBridge()
                          │ (no-copy ArrayBuffer)
                          │
                 ┌──────────────────────────────────┐
                 │  skal-app.js (Solid + universal  │
                 │   renderer + bridge.js helpers)  │
                 └──────────────────────────────────┘
```

The shared region has three rings:

- **Op ring** (1 MiB) — JS writes node-tree mutations, Dart reads them. `CREATE_NODE`,
  `INSERT_BEFORE`, `SET_PROP_*`, `SET_TEXT`, etc.
- **String heap** (512 KiB) — UTF-8 bytes referenced by string ops.
- **Event ring** (~448 KiB) — Dart writes gesture events, JS reads them.

JS sees the region as a `Uint8Array` (zero-copy via JSC's
`JSObjectMakeArrayBufferWithBytesNoCopy`). Dart sees it as a `Uint8List` view over an
FFI pointer (zero-copy via `Pointer<Uint8>.asTypedList`). Same bytes, same memory, no
serialization in the bridge hot path.

## Build

### Prerequisites

- macOS 14+ (other hosts: TODO)
- Flutter 3.41+ (`flutter --version`)
- Xcode 16+ — needed for both the libskal iOS/macOS cross-compile and the Flutter iOS/macOS shells
- JDK 17 — Gradle's toolchain manager auto-downloads if absent
- `~/.cargo/bin` on PATH (`rustup install nightly` once — bun's lolhtml dep)
- Android NDK at `/opt/homebrew/share/android-ndk`

### One-time setup

```sh
# Clones vendor/bun + vendor/WebKit at pinned commits, applies patches,
# copies skal_entry.zig into bun's source tree.
scripts/setup.sh

# Builds the host bun used for bytecode generation. ~30 min cold,
# ~3 min incremental.
cd vendor/bun
PATH="$HOME/.cargo/bin:$PATH" bun run build:release
cd ../..

# Builds bun for Android (~30 min cold, ~3 min incremental).
ANDROID_NDK_ROOT=/opt/homebrew/share/android-ndk \
  bun --cwd vendor/bun scripts/build.ts --profile=android-release \
  --build-dir=$(pwd)/vendor/bun/build/android

# Build ICU + JSC for Android (one-time, ~30-60 min).
scripts/build-icu-android.sh
scripts/build-jsc-android.sh

# Link libskal.so for the Flutter Android app.
flutter/scripts/link-libskal-flutter.sh
```

### Day-to-day builds

**Android APK** (the Makefile orchestrates JS bundle + bytecode + Flutter):

```sh
cd flutter
make release    # JS bundle + bytecode + Flutter APK
make profile    # same, profile mode (Dart AOT + DevTools wiring)
make debug      # debug mode (hot reload friendly)
```

**Other targets** — rebuild the JS bundle first, then invoke Flutter directly:

```sh
cd js-app && bun run build   # rebuild skal-app.{js,cjs,cjs.jsc} into flutter assets
cd ../flutter/skal_flutter

# Android — equivalent to `make release`
flutter build apk --release --target-platform android-arm64
adb install -r build/app/outputs/flutter-apk/app-release.apk

# macOS Desktop
flutter build macos --release           # or --debug
open build/macos/Build/Products/Release/skal_flutter.app

# iOS Simulator (release blocked by Flutter — Dart AOT has no Sim target)
flutter build ios --simulator --debug   # or --profile
xcrun simctl install booted build/ios/iphonesimulator/Runner.app
xcrun simctl launch --console-pty booted com.skal.skalFlutter

# iOS Device (requires a provisioning profile)
flutter build ios --release
```

### Bytecode regeneration footgun

The `.cjs.jsc` is JSC-version-keyed to the bun used at build time. The Makefile + the
vendored-bun resolver in `js-app/scripts/find-vendored-bun.sh` guard against version drift.
If you ever see a cold-launch regression with no error, regenerate with the vendored bun:

```sh
cd js-app && bun run build
```

## Module layout

```
skal/
├── flutter/                  # Flutter shell — primary host renderer
│   ├── Makefile              # bundle + APK orchestration
│   ├── scripts/
│   │   └── link-libskal-flutter.sh   # re-link libskal.so with skal_* C-ABI exports
│   └── skal_flutter/         # the Flutter app
│       ├── lib/skal/         # Dart-side renderer (~1300 LOC)
│       │   ├── wire.dart
│       │   ├── node_state.dart
│       │   ├── bridge.dart
│       │   ├── root.dart
│       │   └── memoizing_listenable_builder.dart
│       ├── lib/skal_ffi.dart # dart:ffi bindings to skal_* C ABI
│       ├── lib/main.dart     # boot + PerfHud
│       ├── assets/           # skal-app.js + .cjs + .cjs.jsc (the JS bundle)
│       └── test/             # wire + node_state unit tests
├── js-app/                   # Solid UI — Vite + bytecode pipeline
│   └── src/
│       ├── App.jsx           # the demo
│       ├── bridge.js         # JS-side bridge (op encoder, diff cache)
│       ├── renderer.js       # Solid universal renderer for native targets
│       └── renderer-web.js   # Solid universal renderer for the web target
├── packages/skal_native/     # C ABI surface — header + iOS sim shim
├── patches/                  # bun + WebKit patches
├── scripts/                  # ICU/JSC builds, libskal linkers per-platform
├── vendor/                   # bun + WebKit pinned commits (setup.sh clones)
├── build/                    # build outputs
└── docs/                     # all design docs (RESTRUCTURE, PERFORMANCE, ENGINE_CHOICE, FastStorage, ...)
```

## Documentation

| Doc | What's in it |
|---|---|
| [`docs/RESTRUCTURE.md`](docs/RESTRUCTURE.md) | Framework / app boundary; monorepo layout |
| [`docs/ENGINE_CHOICE.md`](docs/ENGINE_CHOICE.md) | Why bun+JSC, why Flutter, alternatives considered |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | Perf decision log + budget invariants |
| [`docs/PROPS_PLAN.md`](docs/PROPS_PLAN.md) | Wire-format prop architecture (renderer-agnostic) |
| [`docs/FastStorage.md`](docs/FastStorage.md) | Store engine — design, optimizations, native port |
| [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) | Bench numbers + methodology |
| [`docs/FLUTTER_JS_COMPONENTS.md`](docs/FLUTTER_JS_COMPONENTS.md) | Fast-path widget layer |
| [`docs/WRAPPING_PUB_PACKAGES.md`](docs/WRAPPING_PUB_PACKAGES.md) | Custom widget codegen for pub.dev packages |
| [`docs/ANIMATION.md`](docs/ANIMATION.md) / [`docs/NAVIGATION.md`](docs/NAVIGATION.md) | Animation + navigation subsystems |
| [`docs/bytecode-cache.md`](docs/bytecode-cache.md) | Why `.cjs.jsc` exists; JSC version coupling |
| [`docs/crash-symbolication.md`](docs/crash-symbolication.md) | Symbolicating libskal crashes from device logs |
| [`docs/TODO.md`](docs/TODO.md) / [`docs/TODO_PLATFORMS.md`](docs/TODO_PLATFORMS.md) | Open work |

## What's next

- Linux / Windows Desktop shells — Flutter Desktop supports them; per-platform libskal linkers not written yet
- Plugin bridge — Dart-side dispatcher exposing pub.dev plugins (camera, geo, etc.) to JS

## License

TBD — see repo settings.
