# Skal — build variants per platform

Six variants total: Android, Desktop (macOS), iOS Simulator, each
in **debug** and **release** flavors. Same Solid bundle, same
`SkalBridge` + `SkalRoot` from `shared/`, same `bun-zig.*.o` source
tree → distinct per-platform link outputs in `build/skal-<platform>/`
that don't share fate (per § 0.5 modularity invariants in
`TODO_PLATFORMS.md`).

This doc covers: how to invoke each variant, what optimizations
apply, perf baselines measured 2026-05-10, and what's still open.

---

## At a glance

| Variant | Build command | Cold start | Binary size | Notes |
|---------|---------------|-----------|-------------|-------|
| Android Debug | `:app:assembleDebug` | ⚠️ unmeasured (no phone in this session) | APK 80 MB | source-eval path |
| Android Release | `:app:assembleRelease` | ⚠️ unmeasured | **APK 38 MB** | bytecode cache + R8 |
| Desktop Debug | `./gradlew run` | **83 ms init / 13 ms eval (warm)** | dylib 65 MB | bytecode cache |
| Desktop Release | `./gradlew runRelease` | **65 ms init / 32 ms eval** | dylib 65 MB + R8'd JVM jar | R8 + bytecode |
| iOS Sim Debug | `linkDebugFrameworkIosSimulatorArm64` + xcodebuild | not measured (sim metric noisy) | dylib 65 MB + framework 45.9 MB | bytecode cache |
| iOS Sim Release | `linkReleaseFrameworkIosSimulatorArm64` + xcodebuild | not measured | dylib 65 MB + framework **25.8 MB** (-44% LTO) | bytecode + Kotlin/Native LTO |

Cold start = milliseconds from `createSkal()` returning to JS evaluation
finishing. The Desktop numbers are warm (JVM class cache hot, OS file
cache hot); cold-cold first-launch is 1-2 sec mostly from JVM startup.

---

## Android

### Debug — `./gradlew :app:assembleDebug`

- JS path: `MainActivity.evaluate(source)` reads `assets/skal-app.js`
  (the Vite IIFE bundle), feeds it through `Bun__REPL__evaluate` as a
  Program. Re-parses on every launch.
- ProGuard / R8: **off**. Full Compose Multiplatform tooling kept.
- libskal.so: 87 MB stripped (already at minimum — bun's Android
  cross-compile drops debug syms at link time, no further strip
  available without rebuilding bun-Android with different flags).
- APK: ~80 MB total.
- Use case: dev loop. Hot-reload-ready (TODO_PLATFORMS § 3.1).

### Release — `./gradlew :app:assembleRelease`

- JS path: `MainActivity.evaluateModuleAtPath(extracted .cjs path)`.
  Bun's module loader finds the `@bun @bytecode` marker in the .cjs
  header, reads the sibling .cjs.jsc, attaches it to JSC's
  SourceProvider, parser short-circuits — **no parse cost**.
- ProGuard / R8: **on**. JNI surface (`com.skal.Skal.*`), bridge
  classes (`com.skal.bridge.*`), and snapshot-state reflection
  classes are kept; everything else minified/obfuscated.
- libskal.so: 87 MB (same as debug).
- **APK: 38 MB** — R8 dropped ~42 MB of the JVM bytecode (Compose's
  tooling/preview/inspector classes that aren't referenced from
  release code paths).
- Asset extraction: skipped on subsequent launches via
  `<name>.apk-mtime` marker file (TODO_PLATFORMS § 2.5).
- Signing: env-var-driven (`SKAL_RELEASE_STORE_FILE` etc.) with a
  throwaway-keystore fallback for dev builds.
- Use case: production. Play Store ready once a real upload keystore
  fills in for the throwaway.

### Why no further perf wins on Android

- libskal.so is at minimum strip size (no debug info present).
- Bytecode cache eliminates the ~700 ms parse cost.
- R8 minification cuts startup class-loading time.
- ABI: arm64 only — accepting the ~5% of devices on armeabi-v7a is
  the standard tradeoff for size + native-perf homogeneity. Bumping
  to multi-ABI (TODO_PLATFORMS § 2.4) is ~1 day if needed.

The remaining 38 MB is dominated by libskal.so (which is bun + JSC
+ all bun's vendored deps statically linked — irreducible without
recompiling bun with LTO across the whole tree).

---

## Desktop (macOS arm64)

### Debug — `./gradlew run`

- JS path: bytecode cache when `skal-app.cjs + .cjs.jsc` are present
  in `android-app/app/src/main/assets/` (read directly out of the
  monorepo path); falls back to source eval otherwise.
- libskal.dylib: 65 MB stripped (was 91 MB; `xcrun strip -x -S`
  drops local symbols + DWARF debug info while keeping JNI exports).
- Auto-build: `:run` depends on a `linkSkalDylib` Gradle task that
  invokes `scripts/link-skal-dylib.sh` and symlinks the output into
  `desktop-app/native/`. Fresh checkouts work without manual
  link-script invocation.
- Cold start (warm OS cache):
  ```
  [SkalDesktop] init=83.1ms eval=32.0ms (bytecode) result=skal-app loaded
  ```
- Use case: dev loop. Window state (size + position) persists in
  `java.util.prefs` across launches; native menu bar wired (File →
  Quit Skal, ⌘Q).

### Release — `./gradlew runRelease`

- JS path: same as debug (bytecode when available).
- ProGuard: on, optimize but no obfuscation (stack traces stay
  readable for production crash reports).
- Cold start (warm):
  ```
  [SkalDesktop] init=65.4ms eval=28.7ms (bytecode) result=skal-app loaded
  ```
  R8 inlining + dead-code elimination shaves ~18 ms off init vs
  debug.
- `./gradlew packageReleaseDmg` produces a `.dmg` with the R8'd jar.
  Code signing not yet wired (`TODO_PLATFORMS § 3.1` — awaiting
  Apple Developer ID cert).
- Distribution: `compose.desktop.application.nativeDistributions`
  emits `.dmg` (macOS), `.deb` (Linux), `.msi` (Windows). Signing
  config slots are in place; need real certs.

### Performance ceiling

Cold start is dominated by JVM startup (~50 ms) + libskal.dylib
load (~10 ms) + bun runtime init (~10 ms). The `eval` cost is
mostly dynamic-import + microtask drain; bytecode cache already
saved the ~500 ms parse step.

The dylib is mostly `__text` (48 MB executable) + `__const` (6 MB)
+ `__eh_frame` (6 MB). Further shrinkage needs LTO at the bun
build level — out of scope for the SDK distribution but a
~30-50% potential win.

---

## iOS Simulator (arm64)

### Debug — `linkDebugFrameworkIosSimulatorArm64` + xcodebuild

- JS path: bytecode cache (`skal-app.cjs` + `skal-app.cjs.jsc`
  bundled as Resources via XcodeGen `fileGroups`). Falls back to
  source eval if either is missing.
- Skal.framework: 45.9 MB (Kotlin/Native debug build, unstripped).
- libskal.dylib: 65 MB stripped — embedded in the .app's
  `Frameworks/` via the `postBuildScripts` `cp` step.
- LC_BUILD_VERSION: `IOSSIMULATOR` (re-stamped by
  `link-skal-iossim.sh`; the script links bun's macOS .o files with
  macOS target, then `vtool -set-build-version 7 14.0 14.0
  -replace`).
- Cold start: not benchmarked numerically (Simulator metrics are
  noisy under host CPU contention), but the `(bytecode → skal-app
  loaded)` path is verified and renders the full Solid demo.

### Release — `linkReleaseFrameworkIosSimulatorArm64` + xcodebuild

- JS path: same as debug (bytecode).
- Skal.framework: **25.8 MB** (was 45.9 in debug — 44% smaller via
  Kotlin/Native LTO + DCE).
- libskal.dylib: 65 MB (same).
- Memory: needs `-Xmx4g` Gradle JVM heap during the Kotlin/Native
  release link (LTO across Compose Multiplatform's iOS deps
  thrashes the GC at default 512 MB). Set in
  `ios-app/gradle.properties`.

### Why bytecode matters more on iOS than Desktop

JSC's JIT is **disabled** in third-party iOS apps (apps can't
allocate executable memory without entitlement). The interpreter
re-parses the entire bundle on every cold start unless the
bytecode cache is in play. On Desktop the JIT compensates after a
few hundred ms; on iOS, parse is the entire cold-start cost.

The `evaluateModuleAtPath` path skips parse completely → cold
start lands within tens of ms instead of hundreds.

---

## Modularity guarantees (per platform)

Every platform's pipeline is independent. A change to one's link
script doesn't cause another's binary to relink:

| Pipeline | Source | Link script | Output dir | Unique exports |
|----------|--------|-------------|------------|----------------|
| Android  | `vendor/bun/build/android/*.o` | `scripts/link-skal-so.sh` | `build/skal-android/` | `Java_com_skal_Skal_*` + `JNI_OnLoad` |
| Desktop  | `vendor/bun/build/release/*.o` | `scripts/link-skal-dylib.sh` | `build/skal-darwin/` | `Java_com_skal_Skal_*` + `JNI_OnLoad` |
| iOS Sim  | `vendor/bun/build/release/*.o` | `scripts/link-skal-iossim.sh` | `build/skal-iossim/` | `skal_*` C ABI + `___clear_cache` |

Symbol audits (run after each link):

- **Android `libskal.so`**: 6 JNI exports, 0 C exports. Verified
  via `llvm-nm -D | grep -E "Java|skal_"` showing only Java_*.
- **Desktop `libskal.dylib`**: 6 JNI exports, 0 C exports, 0 local
  `__clear_cache` (uses libSystem.B's). 65 MB stripped.
- **iOS Sim `libskal.dylib`**: 6 C exports, 0 JNI exports, 1 local
  `__clear_cache` (the shim). 65 MB stripped, IOSSIMULATOR
  platform tag.

Per-platform CI workflow under `.github/workflows/<platform>.yml`
runs only on path-matching changes; `nightly.yml` cross-builds
all three to catch coupling slip-throughs.

---

## What's deliberately not optimized further

These are deferred trade-offs, not oversights:

- **Android debug R8**: off so dev iteration cycles stay fast (R8
  adds 30+ sec per build). Release covers the production case.
- **Desktop release obfuscation**: off in `proguard-rules.pro` —
  stack traces stay readable for production crash diagnostics.
  Without source maps, obfuscated traces would be useless.
- **iOS Sim native binary stripping**: same `xcrun strip -x -S` as
  Desktop. Could potentially shrink the framework via Kotlin/Native
  flag tweaking, but Kotlin/Native's `-opt` already aggressive in
  release.
- **Android multi-ABI (armeabi-v7a)**: arm64 only today. Adding
  arm32 support requires building bun for arm32 + a separate
  `link-skal-so-arm32.sh` (~1 day). Skipped pending demand.
- **JSC JIT on iOS**: not possible — Apple platform restriction.
  Bytecode cache is the only available perf optimization for cold
  start; runtime hot-path perf is interpreter-bound.

---

## Performance baselines as of 2026-05-10

| Metric | Android Debug | Android Release | Desktop Debug | Desktop Release | iOS Sim Debug | iOS Sim Release |
|--------|---------------|-----------------|---------------|-----------------|---------------|-----------------|
| Cold start init | unmeasured | unmeasured | 83 ms (warm) | **65 ms (warm)** | rendering | rendering |
| Cold start eval | unmeasured | unmeasured | 32 ms | 29 ms | rendering | rendering |
| Steady-state pump avg | unmeasured | unmeasured | < 1 ms | < 1 ms | unmeasured | unmeasured |
| Steady-state FPS | unmeasured | unmeasured | 60 (vsync) | 60 | unmeasured | unmeasured |
| Binary size (stripped) | APK 80 MB | **APK 38 MB** | dylib 65 MB | dylib 65 MB | dylib 65 + framework 45.9 MB | dylib 65 + framework **25.8 MB** |

"unmeasured" rows are gated on real-device or sim-perf-tooling
availability:
- Android: needs an attached phone or emulator with a known CPU
  baseline (Pixel 7 reference per § 1.6).
- iOS Sim: simulator metrics include host CPU contention; need
  `xcrun simctl spawn launch --benchmark` or the user's wall-clock
  measurement on a known reference (M1 MBP).

Once those measurements are wired into CI (TODO_PLATFORMS § 1.6 —
performance regression suite), each PR can compare against the
recorded baselines and fail on regression.

---

## SDK readiness implications

For "Skal as a public dev platform" (TODO_PLATFORMS goal), each
variant becomes a **default the SDK delivers to user apps** — not
something the user has to configure. Specifically:

- `skal build android` → release variant by default (R8, bytecode,
  signed APK), debug only with `--debug` flag.
- `skal build desktop --target=mac` → release variant, signed dmg
  by default.
- `skal build ios-sim` → debug variant by default (faster
  iteration); `skal build ios-sim --release` for size validation.
- `skal dev` → debug variant on the user's chosen platform, with
  hot reload (TODO_PLATFORMS § 3.1).

Today every variant is reproducible from this repo; the SDK
refactor (TODO_PLATFORMS § 1.4) puts the same outputs behind
`skal build` calls so users don't see Gradle/xcodebuild.
