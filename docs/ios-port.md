# Skal on iOS — design + status

**Status as of 2026-05-10**: **iOS Simulator is fully working.** The
real bun runtime + JavaScriptCore + SolidJS demo bundle render on the
iPhone 15 Pro Max simulator (iOS 17.0) — same `skal-app.js` Android
and Desktop run, same Compose `SkalRoot`/`SkalBridge` code, same JS
ops over the 2 MiB shared bridge buffer. Verified visually: Count
button increments, the 5000-tweet feed displays with the rocket
emoji intact, +1000 benchmark fast-path runs.

The shortcut: instead of cross-compiling bun for `aarch64-apple-ios-
simulator` (Phase 2 in the original plan, ~1 week), we re-stamp the
existing macOS `libskal.dylib`'s `LC_BUILD_VERSION` from `MACOS` to
`IOSSIMULATOR` via `vtool`. That works because iOS Simulator on
Apple Silicon runs arm64 darwin code natively over the macOS kernel —
the only check that prevents loading is the platform identifier in
the Mach-O header. One per-symbol fixup (`__clear_cache`, which
macOS's libSystem.B exports but iOS Simulator's doesn't) is shimmed
in `native/ios/skal_iossim_shim.c` and resolved via
`-Wl,-U,___clear_cache -Wl,-exported_symbol,___clear_cache` at link
time.

**Real iOS device (not simulator) still needs the full Phase 2
cross-compile** — device binaries are linked against the iphoneos SDK
(different sysroot, different framework versions, JIT must be
explicitly disabled). The vtool trick fails on device because
`aarch64-apple-ios-device` actually enforces the iOS SDK's ABI
restrictions. That's the genuinely-multi-week project covered below.
  * **Phase 0 ✅**: `Skal.framework` builds for both iOS device
    (`iosArm64`) and Simulator (`iosSimulatorArm64`); the XcodeGen-
    managed host app under `ios-app/iosApp/` was launched on the
    iPhone 15 Pro Max simulator (iOS 17.0) and rendered the
    placeholder UI.
  * **Phase 1 ✅**: bridge + Skal extracted into a `shared/` KMP
    module (commonMain holds `SkalBridge`, `SkalRoot`, `SkalRuntime`,
    `expect class SkalBuffer`, `expect fun createSkal`). All three
    apps consume it via composite build.
  * **Phase 4 ✅** (out of order; turns out Phase 4 didn't depend on
    Phase 2/3): C entry surface (`native/ios/skal.h`) +
    Kotlin/Native cinterop (`shared/src/iosMain/cinterop/skal.def`)
    + iOS `actual class SkalBuffer` over `CPointer<UByteVar>` with
    explicit little-endian byte shuffles. Verified end-to-end on
    Simulator: `runtime.evaluate("1+2", "skal:probe")` round-trips
    Kotlin → cinterop → stub C `skal_evaluate` → byte-array result
    → UTF-8 decode → Compose UI displays the C-side message.

The cinterop scaffold is backed by an inline C stub (in the .def's
inline impl section) that returns sentinel values — no real JS
runtime yet. Phase 2 will replace those stubs with `skal_entry.zig`'s
own C exports, compiled for iOS arm64 alongside the existing JNI
exports (gated on target abi).

This document captures the path for Phase 2 + 3 from here.

The desktop (macOS) port shipped in the same session that produced this
doc — that work proves out the source-sharing model (`com.skal.bridge.*`
+ `com.skal.Skal` compile against Compose Multiplatform on JVM Desktop
without changes) and the linker strategy for re-using bun's release
object files as a host-side `libskal.dylib`. iOS reuses the *idea* —
JS bytecode + bun runtime + Compose UI — but the embedding shape is
fundamentally different.

## Why iOS is not a "build it like desktop, but for iOS" job

Three structural differences from Android/Desktop:

### 1. No JIT in third-party processes

iOS bans dynamic code generation outside the system WebKit/WKWebView.
JSC's tiered JIT (LLInt → Baseline → DFG → FTL) is the foundation of
its competitive perf — without it, JS runs on the LLInt interpreter
only, ~5-10× slower for hot code.

Two paths around this:
  * **Bytecode-cache only, interpreter runtime.** Ship `.jsc` (the
    bytecode we already produce in `js-app/build:bytecode` for Android
    release). JSC skips parse, runs the bytecode in interpreter. We
    lose JIT but keep parse-free cold start. Realistic perf ceiling:
    "fast enough for UI work but not for compute-heavy JS."
  * **WKWebView host.** Use Apple's WebKit (which has JIT) via
    `WKWebView` evaluating off-screen. Trades direct embedding for an
    extra IPC hop on every bridge call. This is how RN/Expo solved
    JIT-availability on iOS for years before Hermes.

The "build bun-on-iOS" path picks option 1 — keeps the embedding
architecture identical to Android, accepts the perf hit.

### 2. Bun's build system has no iOS profile

`vendor/bun/scripts/build/profiles.ts` defines presets for `linux`
(android & glibc & musl), `darwin`, `windows`, `freebsd`. The
`OS` type in `config.ts:20` is literally
`"linux" | "darwin" | "windows" | "freebsd"` — adding "ios" requires
threading through ~40 callsites (search for `cfg.darwin`,
`cfg.os === "darwin"`, `host.os`, etc.).

Beyond the type plumbing, every flag table in `flags.ts` would need
iOS predicates, and every dep build in `deps/*.ts` would need iOS
toolchain handling. Concretely:

  * **WebKit** — `deps/webkit.ts` only knows the `bun-webkit-{macos,
    linux, windows, freebsd}` prebuilt naming scheme (line 73). iOS
    has no prebuilt. A local WebKit build for iOS arm64 takes ~1-2 hr
    on M1 and requires the iOS SDK plus iOS-specific JSC compile
    flags (`-DENABLE_JIT=0`).
  * **mimalloc, BoringSSL, libuv, brotli, libdeflate, picohttpparser,
    zlib-ng, zstd, lsquic, lshpack, lsqpack, c-ares, libarchive,
    hdrhistogram, highway, libjpeg-turbo, libspng, libwebp** — most
    will compile for iOS with the right SDK + min-version flags.
    `lsquic`, `c-ares` are the higher-risk ones (POSIX assumptions).
  * **lolhtml** — Rust crate. `cargo build --target=aarch64-apple-ios`
    works, no iOS-specific changes needed.
  * **tinycc** — Skal disables this anyway (`!android && !freebsd`
    in `config.ts`). iOS would need the same `!ios` clause.

Estimated effort for the build-system changes: **3-5 days** of careful
work, mostly mechanical, with the WebKit-from-source build being the
biggest time sink.

### 3. The bridge is JNI-only

`patches/skal_entry.zig` exports JNI symbols (`Java_com_skal_Skal_*`),
which assume a JVM. iOS has no JVM — Kotlin/Native compiles to Mach-O
and calls C functions via cinterop, not JNI.

Two changes to `skal_entry.zig`:

  * **Add a non-JNI entry surface.** Functions like
    `skal_create_runtime() -> i64`, `skal_evaluate(handle, source,
    url) -> *u8`, `skal_acquire_bridge(handle) -> *u8` (returning a
    raw pointer + length, not `DirectByteBuffer`).
  * **Compile guard.** The JNI exports stay for android/macos host
    (which both load via `System.loadLibrary` from a JVM); the C
    exports are added when `target.os.tag.isDarwin() && target.abi
    .isIOS()` (or whatever the right Zig predicate is).

Estimated effort: **0.5-1 day** for the export surface, plus a Kotlin
side change — `Skal.kt` (or a `SkalNative.kt` actual for the iOS
target) that wraps the C entries instead of JNI.

## The actually-easy parts

For perspective on what's *not* the bottleneck:

  * **Compose Multiplatform on iOS** is supported (beta in 1.7,
    stabilizing in 1.8). The same `SkalRoot.kt` + `SkalBridge.kt` we
    share with desktop should compile against the iOS target with
    minimal changes — the bridge code already uses
    `java.nio.ByteBuffer`, which has a Kotlin/Native equivalent
    (`kotlinx.cinterop.ByteBuffer`-ish, but actually we'd write a
    typealias-based abstraction).
  * **Source sharing.** A Kotlin Multiplatform project with `androidMain`,
    `desktopMain`, `iosMain` source sets, with `commonMain` holding
    `SkalBridge.kt` + `SkalRoot.kt`, is the textbook KMP layout.
    Convert `desktop-app/build.gradle.kts` from `kotlin("jvm")` to
    `kotlin("multiplatform")` and add the `iosArm64` target.
  * **Xcode glue.** Compose Multiplatform's `experimental.uikit`
    integration produces a `*.framework` from the Kotlin/Native build;
    a thin Xcode project consumes it and exposes a `UIViewController`
    subclass. Standard KMP iOS template.

## Recommended order — for iOS device (Sim is done via shortcut)

1. **Phase 0: Compose iOS hello-world** ✅ done. KMP + Compose iOS
   without any Skal integration. `ios-app/` ships this; see
   `ios-app/README.md`. Build with
   `./gradlew :linkDebugFrameworkIosSimulatorArm64`.
2. **Phase 1: stub Skal on iOS** ✅ done. `shared/` KMP module with
   commonMain bridge code, jvmMain actuals (wraps existing Skal.java),
   iosMain actuals (`SkalIosStub` throwing on `evaluate`/`acquireBridge`).
   Android + Desktop + iOS Simulator all verified building/running
   against the shared module. Composite-build wiring documented in
   each app's `settings.gradle` / `settings.gradle.kts`.
3. **Phase 2: bun-iOS build pipeline.**
   * **Phase 2-Simulator ✅ done via shortcut.** Re-stamp macOS
     `libskal.dylib` → iOS Simulator binary via `vtool
     -set-build-version 7 14.0 14.0 -replace` (platform 7 =
     IOSSIMULATOR). One missing libSystem symbol (`__clear_cache`,
     normally provided on macOS but absent from iOS Simulator's
     libSystem) is shimmed in `native/ios/skal_iossim_shim.c` and
     pinned to flat-namespace dynamic lookup via the linker flags
     `-Wl,-U,___clear_cache -Wl,-exported_symbol,___clear_cache`.
     End-to-end pipeline: `scripts/link-skal-dylib.sh` →
     `scripts/link-skal-iossim.sh` → `build/skal-iossim/libskal.dylib`
     → embedded under `SkalIosApp.app/Frameworks/` by the Xcode
     post-build script.
   * **Phase 2-Device** (~1 week, not done). The vtool trick won't
     work — iOS device enforces the iphoneos SDK ABI. Fork bun's
     build system: add `os: "ios"` to `Config`, add an `ios-release`
     profile, thread through every `darwin`/`linux` switch. Build
     local WebKit for iOS arm64 (no prebuilt — JSC must be built
     with `-DENABLE_JIT=0` since third-party iOS apps can't allocate
     executable memory). Get `bun-zig.*.o` cross-compiling cleanly
     against `aarch64-apple-ios`. Replace `link-skal-iossim.sh`'s
     vtool re-stamp with a direct link from the iOS-built objects.
4. **Phase 3: relink as static framework** (~1 day). On iOS, dynamic
   libs in third-party apps load only from `Frameworks/` inside the
   app bundle — `link-skal-dylib.sh` becomes
   `link-skal-framework.sh` producing `Skal.framework`.
5. **Phase 4: cinterop bridge** ✅ done. `native/ios/skal.h` declares
   the non-JNI C surface (`skal_create_runtime`, `skal_evaluate`,
   `skal_acquire_bridge`, `skal_wake_js`, `skal_dispose_runtime`,
   `skal_free_string`). `shared/src/iosMain/cinterop/skal.def` maps
   it to `com.skal.bridge.cinterop.*` Kotlin/Native bindings; the
   `.def`'s inline impl section ships a stub that returns sentinels
   so the cinterop pipeline links cleanly without bun-iOS.
   `Skal.ios.kt`'s `SkalIosRuntime` and `SkalBuffer.ios.kt` consume
   those bindings — `SkalBuffer` does explicit little-endian byte
   shuffles over `CPointer<UByteVar>` (no alignment assumptions),
   `SkalIosRuntime.evaluate` pins source/url byte arrays for the
   call and decodes the result back from the C-side buffer.

**Total realistic budget: ~2.5 weeks for an experienced Kotlin/Native
+ bun + WebKit dev.** Not a session-sized task, not even a sprint —
this is its own milestone.

## Why we did desktop and stopped at iOS in this session

Desktop was a proof of the "shared bridge + per-platform native lib"
hypothesis — the JNI ABI works the same on Android JVM and OpenJDK 17,
the bridge code is platform-neutral, and `compose.desktop` reuses every
`androidx.compose.*` API the Android app uses. Total marginal cost
over Android: a build-system patch (`builtin.target.os.tag == .macos`),
~140 LOC of `Main.kt`, a 130-line `link-skal-dylib.sh`, and one
`build.gradle.kts`.

iOS doesn't share any of those affordances at the runtime layer. The
Kotlin side reuses cleanly; the native side is a separate research
project. We stopped to avoid producing something that *looks* like an
iOS port but actually punts the hard work to a comment block in
half-finished scaffolding.
