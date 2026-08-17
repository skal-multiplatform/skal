<p align="center">
  <img src="assets/skal-hero.png" alt="Skal — Solid in JS, Flutter rendering, native plugins, one bridge" width="860">
</p>

<h1 align="center">Skal</h1>

<p align="center"><em>The modern alternative to React Native — Solid in JS, Flutter rendering, one zero-copy bridge.</em></p>

Skal embeds [bun](https://bun.sh) + [JavaScriptCore](https://trac.webkit.org/wiki/JavaScriptCore)
inside a [Flutter](https://flutter.dev/) app. Your UI is a [SolidJS](https://www.solidjs.com/)
component tree; Skal's bridge translates Solid's
[universal renderer](https://www.solidjs.com/docs/latest/api#createcomponent) ops into
Flutter widgets through a zero-copy 6 MiB shared memory region. Same JS bundle, native
performance, pub.dev's plugin ecosystem for camera / location / biometrics / file picker
and every other RN-shaped native capability.

## Why

We built Skal because we were tired of fighting React Native: performance
retrofitted through successive architectures instead of designed in; a
mobile-subset JS engine that needs polyfills for `crypto` and half the web
platform; a state layer you assemble yourself from Redux + AsyncStorage + a
storage lib; navigation from a third-party dependency matrix; and UI composed
of platform views, so it renders — and breaks — differently on every OS.

That's really two complaints, and Skal is built around both.

**"I was tired of fighting the framework"**

- **Batteries actually included.** Navigation (Hero transitions, deep links) and a
  persistent reactive store are first-party. Zero dependency matrix before your first screen.
- **No native-module cliff.** Any pub.dev package becomes a JSX component, and any plugin
  API an awaitable JS call, from one yaml file — static-API plugins like geolocator need
  zero hand-written Dart ([`docs/WRAPPING_PUB_PACKAGES.md`](docs/WRAPPING_PUB_PACKAGES.md)).
- **A real JavaScript runtime.** bun + JSC with the web platform built in — `crypto`,
  `fetch`, `TextEncoder`, `Buffer`. No mobile-subset gaps, no polyfill graveyard.
- **Multiplatform by default.** One codebase on iPhone, Android, desktop and the web.
  Not "mobile now, desktop via a fork later."
- **Nothing to eject from.** The scaffold hands you the real Android/iOS/macOS projects.
- **Upgrades that don't rewrite your app.** Non-breaking changes are a commitment, not a hope.

**"I wanted it to actually be fast"**

- **Cost scales with what changed, not how big you've grown.** One state change wakes
  1 of 200 subscribers, and the write costs the same at 3 keys or 3,000. Persistence is
  leaf-granular: change 1 record of 200, flush 1 record.
- **Components run once.** Solid's signals update exactly the nodes that changed — no
  virtual DOM, no reconciliation, no re-render tax. The work simply never happens.
- **One renderer, every platform.** Flutter's GPU compositor paints every pixel; the OS is
  never asked for a widget. No "works on iOS, broken on Android 16."
- **A zero-copy bridge.** UI updates cross one shared-memory boundary as binary ops —
  nothing serialized, nothing copied.
- **Measured, not marketed.** Every performance claim here is a measurement on real
  hardware, and the ones that didn't survive a control were deleted.

**Fast at your first screen. Still fast at your hundredth.**

See [`docs/ENGINE_CHOICE.md`](docs/ENGINE_CHOICE.md) for the full decision matrix.

## Status

| Platform | State | Notes |
|----------|-------|-------|
| **Android** | ✅ working | arm64 only currently; release path uses bun bytecode cache |
| **iOS Simulator** | ✅ working | dylib re-stamped from macOS arm64 → IOSSIMULATOR via `vtool`; debug + profile only (Flutter blocks release on Sim) |
| **iOS Device** | ✅ working | bun + WebKit cross-compiled for `aarch64-apple-ios`; libskal.dylib embedded + signed by Xcode |
| **macOS Desktop** | ✅ working | debug + release; libskal.dylib in `macos/Frameworks/` |
| **Linux / Windows Desktop** | ⏳ pending | Flutter Desktop supports them; per-platform libskal linkers not written |
| **Web** | ✅ working | three shapes: Solid→DOM directly, full Flutter Web (wasm), and static prerender (SSG) for SEO |

## Measured against React Native

| | Skal | React Native |
|---|---:|---:|
| Dropped frames, scrolling an image feed | **0** | 13 |
| Tap → render (median) | **3.53 ms** | 7.30 ms |
| Idle CPU | **1.20%** | 6.93% |
| One frame of work — 200 components × 10 reads + 1 update | **0.05 ms** | 0.80 ms |
| State updates per second, 288 live cells | **103,846** | 4,901 |
| App size at full WebCrypto parity | **51.6 MiB** | 67.2 MiB |

Samsung Galaxy A14 5G · Android 15 · release builds both sides · interleaved runs ·
RN 0.86 / Expo 57 with Hermes, zustand and MMKV.

See [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) for the full store comparison and
[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) for the perf decision log and budget invariants.

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
                          │ bridge ops (6 MiB shared
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

The shared region (see `wire.dart` for the authoritative layout) carries:

- **Op ring** (4 MiB) — JS writes node-tree mutations, Dart reads them. `CREATE_NODE`,
  `INSERT_BEFORE`, `SET_PROP_*`, `SET_TEXT`, etc.
- **JS string heap** (768 KiB) — UTF-8 bytes referenced by string ops (JS-write, Dart-read).
- **Reply heap** (256 KiB) — RPC return values / error strings (Dart-write, JS-read).
- **Event ring** (~1 MiB) — Dart writes gesture events, JS reads them.

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

### The three commands

```sh
SKAL_PREBUILT=1 bun run setup   # one-time install — downloads prebuilt libskal (~2 min)
bun run new my-app              # scaffold a new app — flutter create + libskal link included
bun run dev:macos               # run the kitchen-sink demo (or use bun --filter my-app)
```

`SKAL_PREBUILT=1` pulls CI-built binaries (macOS, iOS Simulator, Android arm64,
plus the matching host bun for bytecode) from the
[`libskal-dev` release](https://github.com/skal-multiplatform/skal/releases/tag/libskal-dev)
— no toolchain needed beyond Flutter. Drop it to build the vendor stack from
source (LLVM 21 + Rust nightly required).

Prefer your app in its own directory instead of inside this repo?

```sh
npm create skal my-app          # no clone needed — scaffolds a standalone app
```

The [`skal` CLI](packages/skal-cli/) ([`@skal/cli`](https://www.npmjs.com/package/@skal/cli)
on npm) puts the shared runtime — same template, same prebuilt binaries — in
`~/.skal` and wires apps to it, so your project lives wherever you want it.

That's the whole workflow. Each one is idempotent and self-contained:

| Command | What it does | Cold time |
|---|---|---|
| `bun run setup` | Workspace install + link libskal into kitchen-sink. With `SKAL_PREBUILT=1`: download CI-built binaries and skip the vendor stack entirely. Without it: clone Skal's bun + WebKit forks (branch `skal` — patches live there as commits) + build host bun (+ build Android cross-stack if NDK present; `SKAL_NO_ANDROID=1` to skip). | ~2 min prebuilt; ~30-40 min from source, ~90-120 min with Android |
| `bun run new <name>` | Scaffold app under `examples/<name>/` from `scripts/templates/default/`, run `flutter create` for android/ios/macos, drop libskal binaries into the new platform configs. Pass `--platforms <list>` to limit, or `--no-platforms` for the JS scaffold only. Requires `setup` first. | ~30 seconds |
| `bun run dev:*` | Rebuild JS bundle + `flutter run -d <target>`. Available on kitchen-sink and any scaffolded app via `bun --filter <name> dev:*`. | seconds (the build hot-incremental) |

### Other handy scripts

```sh
bun run test                         # skal_codegen + skal_flutter test suites
bun run analyze                      # dart analyze across framework packages
bun run link <name>                  # re-link libskal binaries into an app (if you rebuilt vendor/bun)
```

Each app under `examples/` also has its own scripts — run with
`bun --filter <name> <task>` from anywhere, or `cd` in and drop the
prefix. See `examples/kitchen-sink/package.json` for the full list
(`build`, `build:web`, `build:macos`/`ios`/`android`, `dev:flutter`,
`pub`, `codegen`, `analyze`, `test`, `clean`, …).

### Bytecode regeneration footgun

The `.cjs.jsc` is JSC-version-keyed to the bun used at build time. `bun run build`
invokes `scripts/find-vendored-bun.sh` to lock onto the vendored bun, not the
system `$PATH` bun. If you ever see a cold-launch regression with no error, regenerate:

```sh
bun run build
```

## Module layout

```
skal/
├── package.json              # bun workspace root + top-level scripts
├── packages/                 # framework — consumed by apps
│   ├── skal-js/              # JS framework (Solid universal renderer, store, runtime)
│   │   └── src/{bridge.js, renderer.js, renderer-web.js, skal-runtime.jsx, skal/*}
│   ├── skal_flutter/         # Dart/Flutter framework (bridge, registry, root, FFI)
│   │   └── lib/{skal/*, skal_ffi.dart, skal_flutter.dart}
│   ├── skal_codegen/         # Dart codegen tool (build_runner builder + CLI)
│   └── skal_native/          # C ABI surface — header + iOS Simulator shim
├── examples/                 # apps consuming the framework
│   └── kitchen-sink/         # the demo (renders every fast-path widget + store + bench)
│       ├── src/App.jsx       # ~2100-line demo entry
│       ├── flutter-host/     # Flutter app — main.dart, platform configs, libskal binaries
│       └── Makefile          # APK orchestration
├── patches/                  # skal_entry.zig + pinned fork tips (patches = commits on the forks' `skal` branch)
├── scripts/                  # libskal linkers, new-app scaffold, build pipeline
│   ├── new-app.sh            # `bun run new <name>` — scaffold
│   ├── skal-link.sh          # `bun run link <name>` — drop libskal into platform configs
│   ├── link-libskal-flutter-{mac,}.sh    # per-target libskal re-linkers
│   └── templates/default/    # template tree used by new-app.sh
├── vendor/                   # skal-multiplatform/{bun,WebKit} clones @ skal (gitignored; setup.sh)
├── build/                    # libskal link inputs per platform (gitignored)
└── docs/                     # design docs (RESTRUCTURE, PERFORMANCE, FastStorage, ...)
```

## Documentation

Index: [`docs/README.md`](docs/README.md).

| Doc | What's in it |
|---|---|
| [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) | Every performance claim, measured against React Native — and what has *not* been measured |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | The invariants a change has to respect; what's already optimal; what's been rejected and why |
| [`docs/COMPONENTS.md`](docs/COMPONENTS.md) | The fast-path widget layer — 49 primitives on the wire |
| [`docs/PROPS.md`](docs/PROPS.md) | How a prop travels from JSX to a Flutter widget; hot vs cold |
| [`docs/ANIMATION.md`](docs/ANIMATION.md) / [`docs/NAVIGATION.md`](docs/NAVIGATION.md) | Motion and the screen stack — both host-side |
| [`docs/WEB.md`](docs/WEB.md) | The web target — DOM renderer + hidden Flutter Web for plugins |
| [`docs/NATIVE_SUPPORT.md`](docs/NATIVE_SUPPORT.md) | What a Skal app can reach natively today |
| [`docs/WRAPPING_PUB_PACKAGES.md`](docs/WRAPPING_PUB_PACKAGES.md) | Expose any pub.dev widget or plugin API to JSX |
| [`docs/TESTING.md`](docs/TESTING.md) / [`docs/DEBUGGING.md`](docs/DEBUGGING.md) | Three runtimes, three test layers; and how to debug across them |
| [`docs/bytecode-cache.md`](docs/bytecode-cache.md) | Why `.cjs.jsc` exists; JSC version coupling |
| [`docs/crash-symbolication.md`](docs/crash-symbolication.md) | Symbolicating libskal crashes from device logs |
| [`docs/ENGINE_CHOICE.md`](docs/ENGINE_CHOICE.md) | Why bun+JSC, why Flutter, alternatives considered |

## What's next

- Linux / Windows Desktop shells — Flutter Desktop supports them; per-platform libskal linkers not written yet
- Plugin bridge — Dart-side dispatcher exposing pub.dev plugins (camera, geo, etc.) to JS

## License

[Apache-2.0](LICENSE). `libskal` embeds third-party components (bun,
WebKit/JavaScriptCore, ICU) under their own licenses — see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), including the LGPL
source-availability statement for JavaScriptCore.
