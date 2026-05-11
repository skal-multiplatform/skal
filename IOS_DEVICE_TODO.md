# iOS Device — readiness checklist

**Status as of 2026-05-11**: iOS Simulator is fully working
(`libskal.dylib` is bun's macOS objects re-stamped via `vtool` from
`MACOS` → `IOSSIMULATOR`). **iOS Device is NOT working** — the vtool
shortcut fails on device because real iPhones enforce the iphoneos
SDK ABI at dyld load time. This file enumerates every remaining task
to get a real device build green.

Total realistic budget: **~2.5 weeks** for an experienced
Kotlin/Native + bun + WebKit dev. Could be 1.5 weeks if WebKit
cooperates, 3-4 weeks if it doesn't. See § "Suggested next step:
2-day spike" before committing the full budget.

---

## ✅ Already done (Simulator-proven, reusable on device)

These layers don't need rework when device builds land.

### 1. Kotlin Multiplatform module structure
`shared/` produces `Skal.framework` for both `iosArm64` (device) and
`iosSimulatorArm64` (sim). The device framework binary IS being built
today via `:linkDebugFrameworkIosArm64`. What's **missing** is the
backing native lib: the device framework's `-L` path points at
`build/skal-iossim/libskal.dylib` (the Sim binary, wrong ABI). Once
there's a `build/skal-ios-device/libskal.dylib`, the framework wires
up against it without further changes.

### 2. C ABI cinterop surface
`native/ios/skal.h` + `shared/src/iosMain/cinterop/skal.def` are
platform-agnostic. The `skal_*` symbols are the same on Sim and
device. Same `SkalIosRuntime` consumer code.

### 3. Bytecode-cache cold-start path
`.cjs` + `.cjs.jsc` already ship in the `.app` bundle Resources.
**Critical on device** because JIT is forbidden — without bytecode
the interpreter would parse 20 KB of JS on every cold start.

### 4. Compose Multiplatform iOS rendering
`MainViewController()` → Skia → MTKView pipeline is identical between
Sim and device.

### 5. XcodeGen project scaffold (partial)
`ios-app/iosApp/project.yml` exists. Has `CODE_SIGN_STYLE: Manual` +
`CODE_SIGNING_REQUIRED: NO` + `CODE_SIGNING_ALLOWED: NO` for Sim
convenience. Device requires flipping these and wiring a real
provisioning profile (see § F below).

---

## 🔴 Blocking work (Phase 2-Device)

The genuinely-multi-week chunk. Each item lists touched files, patch
shape, and the specific things that could go wrong.

---

### A. Bun's build system needs an `os: "ios"` target

**Effort**: ~3-5 days, mostly mechanical, large patch surface.

**Why patch (not fork)**: changes are additive — new branches in
existing `os.tag` switches, new entries in flag tables. Patches stay
re-appliable across upstream bun releases. Long-term: upstream the
non-Skal-specific bits to bun's main branch so our local patches
shrink.

**Files to touch in `vendor/bun/`**:

- **`scripts/build/config.ts:20`** — the `OS` type is currently:
  ```ts
  type OS = "linux" | "darwin" | "windows" | "freebsd";
  ```
  Extend to include `"ios"`. (1-line change, propagates type errors
  everywhere the OS is switched on — those are the "~40 callsites"
  we have to fix.)

- **`scripts/build/profiles.ts`** — add an `ios-release` profile next
  to the existing `darwin-release` / `linux-release` / etc.

- **`scripts/build/flags.ts`** — every `os === "darwin"` predicate
  needs a decision: does iOS share the darwin branch, or fork off?
  Mostly *share* (clock, threading, Mach-O linker semantics). Occasionally
  *fork* (e.g., `clock_gettime(CLOCK_MONOTONIC_RAW)` is documented on
  macOS but iOS support varies by SDK version).

- **`scripts/build/deps/*.ts`** — each of ~15 dep build scripts needs
  an iOS toolchain branch:
  ```ts
  if (cfg.ios) {
    sysroot = await execStdout("xcrun --sdk iphoneos --show-sdk-path");
    target = "aarch64-apple-ios14.0";
    extraCflags = ["-fembed-bitcode-marker"];  // App Store may want this
  }
  ```

- **`config.ts` tinycc clause** — bun disables tinycc on
  `!android && !freebsd`. Extend to `!ios` (no executable memory).

**Risks**:

- **Upstream churn risk: HIGH.** This is the biggest patch we'd
  carry. *Mitigation*: file PRs against bun upstream incrementally —
  start with the additive `"ios"` enum value, get it merged before
  the larger plumbing patches build on it.
- **`lsquic` / `c-ares`**: POSIX assumptions may not hold on iOS.
  Each is potentially a half-day rabbit hole. *Mitigation*: skim
  their `configure.ac` / `CMakeLists.txt` for `darwin` vs
  `__APPLE__` macros — usually flagged for porting.
- **`tinycc`**: trivial — copy the existing `!android && !freebsd`
  pattern, extend to `!ios`.

---

### B. Build WebKit / JSC for iOS arm64

**Effort**: 1-2 days, **biggest unknown in the whole plan**.

**The problem**: bun pulls a prebuilt `bun-webkit-{macos,linux,
windows,freebsd}` via `deps/webkit.ts`. **No `bun-webkit-ios-arm64`
exists** anywhere. We have to build JSC from source for iOS arm64.

**Concrete steps**:

1. Check out WebKit at the SHA bun's manifest pins (find via
   `vendor/bun/scripts/build/deps/webkit.ts` and the URL it
   references).
2. Apply bun's WebKit fork patches (bun ships local patches to
   WebKit; their `WebKit.patches/` or similar).
3. Run the iOS JSC build:
   ```bash
   Tools/Scripts/build-jsc \
     --jsc-only \
     --release \
     --ios-device \
     --cmakeargs="-DENABLE_JIT=0 -DENABLE_FTL_JIT=0 -DENABLE_DFG_JIT=0"
   ```
4. Package the resulting `libJavaScriptCore.a` (static, NOT dylib
   — see § "static vs dynamic" below) + headers into a tarball
   matching bun's naming convention (`bun-webkit-ios-arm64.tar.gz`).
5. Either upload to a CI artifact store OR check the small binary
   into the `vendor/` tree (gitignored — would need
   `scripts/download-bun-webkit-ios.sh`).

**Risks**:

- **`-DENABLE_JIT=0` interactions**: certain JSC subsystems have
  JIT-specific code paths.
  - **Wasm**: doesn't matter (Solid doesn't use it).
  - **Regex**: matters — every `.split()` / `.match()` in Solid's
    templating goes through JSC's regex engine. Need to verify the
    regex interpreter path is fully functional with JIT disabled.
    *Mitigation*: write a small benchmark that runs the Solid demo's
    template-string-heavy code paths against a JIT-disabled JSC
    build before committing to the full plan.
- **Bun's WebKit fork**: may have local patches that conflict with
  the iOS build path. 4-8 hours of build-system debugging in the
  worst case.
- **Static vs dynamic linking**: third-party iOS apps can only load
  dylibs from `App.app/Frameworks/` (not from `/usr/lib` or
  arbitrary paths). Easiest: build JSC as a static `.a` and link it
  *into* `libskal.dylib`. Bun's macOS build dynamically-links WebKit;
  we'd need a static-link variant for iOS.

---

### C. Cross-compile bun-zig to iOS

**Effort**: 1-2 days, **contingent on A + B**.

Once A unblocks the build-system plumbing and B provides the WebKit
.a file, the actual Zig + C++ compile is straightforward:

```bash
cd vendor/bun
zig build \
  -Dtarget=aarch64-apple-ios14.0 \
  -Doptimize=ReleaseFast \
  -Dwebkit-static=/path/to/libJavaScriptCore.a
```

Bun's Zig code already abstracts over OS via `std.os` — Zig stdlib
has had iOS branches since 0.10. The C++ side compiles against the
iOS SDK once the toolchain swap is wired through (§ A).

**Risks**:

- **macOS-specific `@cImport`s** like `Carbon/Carbon.h` would break.
  Bun doesn't use Carbon AFAIK; spot-check by grepping `vendor/bun/
  src/**/*.zig` for `Carbon|CoreServices|ApplicationServices`.
- **`<mach/mach.h>`**: iOS has a subset of mach APIs. Bun uses
  some for diagnostics. Likely OK but verify.
- **uSockets / libus**: bun's network layer. Uses kqueue on darwin,
  works on iOS. **iOS background-task restrictions** are the real
  concern — a backgrounded bun worker may get aggressively suspended
  by the OS. Mostly fine for foreground UI apps, problematic for
  apps doing real background work.

---

### D. iOS link script (replace `link-skal-iossim.sh`)

**Effort**: ~0.5 day.

Today `link-skal-iossim.sh` does:
- Link bun's macOS objects as a dylib targeting macOS
- vtool re-stamp `LC_BUILD_VERSION` from `MACOS` → `IOSSIMULATOR`
- Per-symbol shim for `__clear_cache` (iOS Sim's libSystem doesn't
  export it)

The new `link-skal-ios.sh` will do:
- Link iOS-targeted `.o` files (from § C) directly — no vtool
- Drop the `__clear_cache` shim (iOS device's libSystem exports it
  directly, unlike Simulator)
- Add iOS code signing pass (`codesign --sign <id>` after link)

Keep `link-skal-iossim.sh` separate — Simulator still uses the
vtool path because we don't want to bloat dev-loop time by doing a
real cross-compile for Sim when the shortcut works.

**Risks**: low. Mostly script changes.

---

### E. Convert to static framework bundle

**Effort**: ~1 day.

Today's output is `libskal.dylib`. For App Store distribution, an
iOS framework bundle is the conventional shape:

```
Skal.framework/
  Skal                    ← the binary (was libskal.dylib)
  Info.plist
  Headers/
    Skal.h
  Modules/
    module.modulemap
  _CodeSignature/
```

- Wrap `libskal.dylib` in the bundle layout.
- Generate the `Info.plist` (CFBundleIdentifier, CFBundleVersion,
  MinimumOSVersion).
- Update `ios-app/iosApp/project.yml`'s "Embed Frameworks" phase to
  embed `Skal.framework` (path becomes
  `../build/skal-ios-device/$(SKAL_KOTLIN_VARIANT)Framework/Skal.framework`
  via the same `$(SKAL_KOTLIN_VARIANT)` per-config trick we use today).
- Or: keep dylib for Sim/dev, only produce framework for `Release`.

---

### F. Code signing + provisioning

**Two distinct paths depending on goal**:

#### F.1 Free Apple ID (personal sideload — sufficient for testing)

**Goal**: install on YOUR iPhone for development + dogfooding.
**Cost**: $0. Free Apple ID is enough.

**Limits**:
- App expires every 7 days; re-run via Xcode to refresh.
- Max 3 sideloaded apps installed at once per device.
- Devices: up to 10 per year per Apple ID.
- No TestFlight, no App Store, no push/IAP/CloudKit.

**Engineering work** (~30 min):
- Sign into Xcode with Apple ID (Xcode → Settings → Accounts → "+").
- Plug in iPhone, accept "Trust this computer" prompt; Xcode
  auto-registers the device.
- In `ios-app/iosApp/project.yml`:
  - Set `DEVELOPMENT_TEAM` to the personal team ID (visible in Xcode
    after sign-in — looks like `ABC1234DEF`).
  - Set `CODE_SIGN_STYLE: Automatic` so Xcode wrangles the profile.
  - Flip `CODE_SIGNING_REQUIRED: YES` + `CODE_SIGNING_ALLOWED: YES`
    for device builds (Sim keeps NO).
- `xcodegen generate` to refresh the .xcodeproj.
- Build + run from Xcode against the iPhone target. Xcode signs
  the `.app` + everything in `Frameworks/` (including our
  `libskal.dylib`) with the personal team's auto-generated cert.
- First launch on phone: Settings → General → VPN & Device
  Management → trust the dev cert.

**Sufficient for: shipping the Solid demo on your own iPhone.**

#### F.2 Apple Developer Program (production distribution)

**Goal**: TestFlight beta + App Store submission.
**Cost**: $99/yr + ~24-72 hr enrollment delay.

Same engineering work as F.1 plus:
- Distribution certificate (separate from development cert).
- Provisioning profile for App Store / Ad Hoc distribution.
- For CI: `fastlane match` or manually managed `.p12` + `.mobileprovision`
  stored as repo secrets.
- App Store Connect record + Apple-side review (guideline 2.5.2 for
  interpreters — Skal should pass since bytecode is bundled not
  downloaded; expect Q&A on first submission).

#### Engineering shared between F.1 and F.2

- `scripts/link-skal-ios.sh` produces `libskal.dylib` UNSIGNED. Xcode's
  "Embed Frameworks" build phase signs it with whatever identity the
  Skal app uses (personal team / dev cert / distribution cert).
  This lets one link script work for all signing paths.

---

## 🟡 iOS-specific concerns not covered by the phase docs

Things that bite once you ship to a real device, even with the
build pipeline working.

### G. Sandbox-aware file paths
- `NSBundle.mainBundle.pathForResource()` for bundle Resources
  (already used in `Main.kt`).
- Writeable paths are `NSDocumentDirectory`, `NSCachesDirectory`,
  or `NSTemporaryDirectory`. **No `extractAsset` step needed**
  on iOS — bun reads bytecode directly from `pathForResource`.
  `MainActivity.extractAsset()` is Android-only.

### H. Memory pressure
`libskal.dylib` is ~65 MB stripped. iOS kills apps that grow beyond:
- ~1.5 GB on modern devices (iPhone 13+)
- ~500 MB on older devices (iPhone 8, SE 2nd gen)

Idle Skal app footprint estimate: **80-120 MB** (libskal 65 MB +
JSC heap 10-20 MB + Compose Skia surface 10-30 MB + 2 MiB bridge).
Comfortable for modern devices, tight on legacy ones. Worth
profiling with Instruments before shipping.

### I. Networking permission
iOS 14+ requires `Privacy - Local Network Usage Description` in
Info.plist for local network IO. Not relevant for current demo (no
network use). Add when first app uses LAN/mDNS.

### J. Background execution
iOS suspends apps when backgrounded. Bun worker thread pauses.
Solid reactive effects pause. Probably fine — document the
behavior. Real background work requires `UIBackgroundModes` in
Info.plist + appropriate `BGTaskScheduler` usage (not in Skal's
scope to start).

### K. iPad / orientation / split-view
`project.yml` currently has portrait-only iPhone. Real apps need:
- All orientations
- iPad multitasking (Slide Over, Split View)
- iPad-specific layouts (sidebar / NavigationSplitView analogues)

Compose Multiplatform handles orientation/sizing via standard
Compose layout APIs. Worth a smoke test on iPad simulator.

### L. Real-device dev loop
- `xcrun simctl` doesn't work for device. Use `xcrun devicectl`
  (iOS 17+) or `ios-deploy` (older).
- Logs from `Console.app` or `idevicesyslog` instead of `simctl
  spawn`.
- Hot reload (see `TODO_PLATFORMS § 3.1`) harder on device —
  needs network access to dev server, mDNS or LAN IP discovery.
  Probably keep hot reload Sim-only initially.

---

## 🎯 Risk + effort matrix

| Step | Effort | Cost driver | Confidence |
|---|---|---|---|
| A. Bun build-system iOS target | 3-5 days | Mostly mechanical, large patch surface | High — additive |
| B. WebKit/JSC for iOS arm64 | 1-2 days | WebKit build debugging | **Medium** — biggest unknown |
| C. Bun-zig cross-compile | 1-2 days | Contingent on A + B | High |
| D. iOS link script | 0.5 day | Mechanical | High |
| E. Framework wrapping | 1 day | Xcode plumbing | High |
| F. Code signing setup | 0.5 day + Apple Dev account | Ceremony | High |
| G–L. Sandbox / memory / etc. | 1-2 days total | Per-issue investigation | Medium |
| | | | |
| **Total** | **~2.5 weeks** | | |

---

## 📊 Spike progress log (live, updated as work happens)

### Spike day 1 — Zig cross-compile dry run (COMPLETE ✅)

**Result**: `bun-zig.o` cross-compiles cleanly for `aarch64-ios.14.0`.
185 MB Mach-O 64-bit arm64 object, `LC_BUILD_VERSION platform = IOS,
minos = 14.0`. This is a **real iOS cross-compile**, not a vtool
re-stamp — the Zig compiler honors the target throughout.

**Error trajectory** (each round = one batch of fixes):
- Round 1: panic — "Unsupported OS tag .ios" (build.zig didn't know about iOS)
- Round 2: 80 compile errors (mostly downstream of stub_event_loop)
- Round 3: 29 errors (event loop fixed, surfacing real switch sites)
- Round 4: 13 errors (most switches handled)
- Round 5: 4 errors (deeper darwin-specific paths)
- Round 6: **0 errors** ✅

**Total patches applied** (~250 LOC across ~20 files in vendor/bun):

1. **Build-system plumbing** (`build.zig`, `env.zig`, `c-headers-for-zig.h`)
   — base patch already captured in `patches/0004-bun-ios-target-plumbing.patch`.

2. **`Environment.isIos` + `Environment.isApple` helpers** in `env.zig`
   — `isApple = isMac or isIos`. Most code that branches on `isMac`
   really meant "darwin family" — that became `isApple`.

3. **Per-OS switch coverage** across ~20 files. Pattern was:
   `.mac => X` → `.mac, .ios => X` (iOS shares macOS behavior).
   The exceptions where iOS got special handling:
   - `node_os.cpus()`: stub returning empty array (mach_host APIs
     are sandboxed away on iOS).
   - `CompileTarget.isSupported`: ios returns false (Apple disallows
     downloading executables in 3rd-party apps).

4. **C header gates** (`c-headers-for-zig.h`):
   - Gated `<libproc.h>`, `<mach/mach_host.h>`, `<mach/processor_info.h>`
     behind `#if !IOS` — these don't exist in iPhoneOS.sdk.
   - `<sys/mount.h>`, `<copyfile.h>`, `<net/if_dl.h>`, `<sys/clonefile.h>`,
     `<sys/sysctl.h>` — kept; available on iOS even though some
     operations error at runtime.

5. **LLD/Mach-O fix**: bun's build.zig had `use_lld = false` only for
   `.mac`; extended to `.ios` since iOS is also Mach-O.

6. **Event loop wiring**: `.ios` shares `posix_event_loop.zig`
   (kqueue) with `.mac, .freebsd`.

7. **zlib internal**: `.ios` shares `zlib_sys/posix.zig` with
   `.linux, .mac, .freebsd`.

**Next**: these are the Zig-only changes; C++ side and deps (WebKit,
mimalloc, BoringSSL, etc.) haven't been touched. Spike day 2 below.

### Spike day 2 — JSC for iOS (COMPLETE ✅)

**Result**: `libJavaScriptCore.a` (69.5 MB), `libWTF.a` (2.6 MB),
`libbmalloc.a` (116 KB) — all real iOS arm64 Mach-O.
`LC_BUILD_VERSION platform=IOS, minos=14.0, sdk=26.2`. 192 object
files inside `libJavaScriptCore.a`. The JSC shell binary `bin/jsc`
(38.8 MB iOS arm64) also linked — fully exercises the static lib.

**Build path**: bun's pinned WebKit commit
(88b2f7a2159c913f7dd0d73c0e88d66138cd67ba) + 4 surgical WebKit
patches (`patches/0005-webkit-ios-target.patch`, 89 LOC).

**Build script**: `scripts/build-jsc-ios.sh` is now real-runnable.
Build time on M1: ~10 min once WebKit source is in place. Output
under `build/skal-jsc-ios/`.

**Error trajectory** (each round = batch of fixes):

| Round | First blocker | Fix shape |
|---|---|---|
| 1 | `string(TOLOWER ...) no output variable` | Add `-DCMAKE_SYSTEM_PROCESSOR=arm64` to script |
| 2 | `mach_vm.h unsupported` | Gate `BUN_MACOSX` on `PLATFORM(MAC)` not `OS(DARWIN)` |
| 3 | `pthread_jit_write_protect_np` unavailable | Gate ARM64 branch in FastJITPermissions.h on `PLATFORM(MAC)` |
| 4 | `JSC::DFG::AbstractHeapKind` missing | Flip to `ENABLE_FTL_JIT=ON` — compile-time-on / runtime-off pattern (matches bun Android prebuilt) |
| 5 | `CCallHelpers` forward-decl insufficient | Add `#include "CCallHelpers.h"` to InlineCacheCompiler.h |
| 6 | `readline/history.h` not found + B3 Wasm types missing | Flip `ENABLE_WEBASSEMBLY=ON` + gate `HAVE_READLINE` on `PLATFORM(MAC)` |
| 7 | none — clean build | — |

**Key insight**: bun's WebKit fork compiles JIT + Wasm code regardless
of whether they're enabled at runtime. The right pattern for iOS is
**compile-time-ON, runtime-OFF** — disable JIT/Wasm via
`g_jscConfig.useJIT`/etc. on startup. Code paths that would call into
JIT/Wasm at runtime just go through their interpreter fallbacks
(LLInt for JIT, the WebAssembly interpreter for Wasm).

**Patches captured** in `patches/0005-webkit-ios-target.patch`
(89 LOC across 4 files):
1. `Source/WTF/wtf/posix/OSAllocatorPOSIX.cpp` — `BUN_MACOSX` gate
2. `Source/JavaScriptCore/assembler/FastJITPermissions.h` — ARM64 branch
3. `Source/JavaScriptCore/bytecode/InlineCacheCompiler.h` — CCallHelpers include
4. `Source/WTF/wtf/PlatformHave.h` — HAVE_READLINE gates (2 sites)

### Spike day 3 — Bun C++ side fully compiles for iOS

**Status**: bun's TypeScript build system fully configures for iOS,
all 22 deps build, only the final link remains. ~1277 LOC of bun
patches (`patches/0004-bun-ios-target-plumbing.patch`) — 36 files
touched.

**Per-dep error trajectory**:

| Issue | Fix | Where |
|---|---|---|
| `linux build missing abi` | Add `aarch64-ios.16.0` zigTarget branch | `scripts/build/zig.ts` |
| c-ares: `<malloc.h>` not found (and 83 others) | `cfg.darwin → cfg.apple` in cares.ts | `deps/cares.ts` |
| libarchive: `st_atim`/`linux/fs.h` etc (and 6 others) | `cfg.darwin → cfg.apple` in libarchive.ts | `deps/libarchive.ts` |
| lolhtml: wrong rust target (`aarch64-unknown-linux-gnu`) | Add `aarch64-apple-ios` to rustTargetTriple | `deps/lolhtml.ts` |
| lolhtml: stable rustc finds `-Z` flag | Run ninja with `PATH=$HOME/.cargo/bin:$PATH` so rustup proxy wins over Homebrew's stable rustc | session env (not a patch) |
| lolhtml: `-Cpanic=abort` needs nightly buildStd | Add `cfg.apple` to `canBuildStdImmediateAbort` | `deps/lolhtml.ts` |
| `std::bit_cast` missing on iOS 14 libc++ | Bump iOS min from 14 → 16 (matches Skal's deployment target) | `build.zig`, `zig.ts` |
| iOS C++ cross-compile target unset | New `if (ios) { crossTarget = "aarch64-apple-ios16.0"; sysroot = xcrun --sdk iphoneos }` block | `scripts/build/config.ts` |
| bun's local WebKit cmake missing iOS flags | Add iOS-specific cmake args mirroring `scripts/build-jsc-ios.sh` | `deps/webkit.ts` |

**Configure** (`bun scripts/build.ts --profile=ios-release
--build-dir=build/ios-release --configure-only`): produces a
`build.ninja` with **22 deps, 88 codegen steps, 1134 objects** all
targeting `ios-aarch64`.

**Changes landed in `patches/0004-bun-ios-target-plumbing.patch`**
(expanded to ~1140 LOC total across both Zig + TS sides):

1. `scripts/build/config.ts`:
   - `"ios"` added to `OS` type
   - `Config.ios` (boolean) + `Config.apple` (= darwin || ios)
   - `unix`/`kqueue` extended to include iOS
   - `ndkHostTag` exhaustiveness — iOS is target-only
2. `scripts/build/zig.ts`: `zigTarget()` returns `aarch64-ios.14.0`
3. `scripts/build/profiles.ts`: new `ios-release` profile

**Next failure surface** (discovered by running ninja against the iOS
config): individual deps have Linux/macOS-specific assumptions that
need iOS-aware patches. First two seen:

| Dep | Failure | Fix shape |
|---|---|---|
| `libarchive` | `struct stat` field `st_atim`/`st_mtim`/`st_ctim` missing on iOS (those are Linux; darwin uses `st_atimespec`/etc.) | Pass `-DHAVE_STRUCT_STAT_ST_ATIMESPEC` to libarchive cc on iOS; same as macOS treatment |
| `libarchive` | `<sys/sysmacros.h>` not found | Linux-only header; needs `cfg.linux`-only include |

**Pattern**: each dep has 2-5 such issues. The macOS prebuilt would have
been configured via autoconf-style probing; the `direct` mode bun uses
needs explicit defines. Estimated ~2-5 hours per dep × 15 deps =
**1-2 focused days** of mechanical work. Each dep build script in
`scripts/build/deps/<name>.ts` gets an iOS branch mirroring its
darwin branch (most defines transfer 1:1 since iOS is darwin-family).

### Spike day 2 — earlier (now historical)

**Status as of 2026-05-11**: cmake configured cleanly, ninja build at
~700/3080 steps (~22%). Two WebKit patches landed at
`patches/0005-webkit-ios-target.patch` (15 LOC, surgical):

1. `Source/WTF/wtf/posix/OSAllocatorPOSIX.cpp`: gate the
   `mach_vm_map` path on `PLATFORM(MAC)` instead of `OS(DARWIN)` —
   iPhoneOS.sdk marks `<mach/mach_vm.h>` as "unsupported." Falls
   through to the regular mmap path.
2. `Source/JavaScriptCore/assembler/FastJITPermissions.h`: gate the
   `pthread_jit_write_protect_np` arm64 branch on `PLATFORM(MAC)` —
   iOS pthread.h marks it `__API_UNAVAILABLE(ios)`. Header gets
   compiled but the path is unreachable at runtime (we set
   useJIT=false on startup, mirroring bun's Android pattern).

**Key insight discovered during the spike**: JIT must be **compile-time
ON, runtime-OFF** on iOS — mirroring bun's existing Android prebuilt.
The earlier attempt with `ENABLE_JIT=OFF` cmake flag failed because
WebKit's DOMJITEffect.h uses `DFG::AbstractHeapKind` types regardless
of whether DFG_JIT is enabled. Compiling JIT code is fine on iOS as
long as it never executes — bun's runtime config flag `useJIT=false`
prevents that.

### Spike day 2 — earlier skeleton (now superseded by the live build)

**Status**: scripts drafted, WebKit clone running in background, actual
build not yet attempted.

**Artifacts**:

- `scripts/build-jsc-ios.sh` — runnable cmake invocation. Configures
  `PORT=JSCOnly` + `ENABLE_JIT=OFF` (and FTL/DFG/YARR JIT all off) +
  `CMAKE_OSX_SYSROOT=$(xcrun --sdk iphoneos)` + `CMAKE_OSX_ARCHITECTURES=arm64`
  + `CMAKE_OSX_DEPLOYMENT_TARGET=14.0` + bun-specific flags
  (`USE_BUN_JSC_ADDITIONS`, `USE_BUN_EVENT_LOOP`, etc.). Output:
  `build/skal-jsc-ios/lib/libJavaScriptCore.a`.

- `scripts/link-skal-ios.sh` — SKELETON only. Documents the expected
  final-link shape: iOS-targeted Mach-O dylib using bun-zig.o + iOS
  JSC + iOS-cross-compiled deps + iOS frameworks. Prints a clear
  "not yet implemented" message when run; the LDFLAGS comment block
  records the planned invocation for when the C++ side is ready.

**Build steps for the user (after WebKit clone completes)**:

```bash
# 1. Checkout the pinned commit (full history needed):
cd vendor/bun/vendor/WebKit
git checkout 88b2f7a2159c913f7dd0d73c0e88d66138cd67ba

# 2. Build JSC for iOS (1-2 hours on M1):
cd /path/to/Skal
./scripts/build-jsc-ios.sh
```

**Expected first blocker**: WebKit's cmake will probably hit a
JSC-iOS-specific issue at configure time. Best guesses:
- ICU resolution — bun's macOS prebuilt expects to use system ICU
  (libicucore.dylib at /usr/lib); iOS has the same path but cmake's
  FindICU might not search there with iOS sysroot. May need
  `-DICU_LIBRARY=$(SDK)/usr/lib/libicucore.dylib`.
- JIT-related sources still being compiled despite `ENABLE_JIT=OFF`
  flags. WebKit's ENABLE flag plumbing isn't always consistent — some
  files have hard-coded JIT references that need a JIT_OS guard
  rather than `ENABLE_JIT` macro.
- `Tools/` build targets pulling in macOS-only frameworks (Cocoa,
  AppKit) that aren't on iOS.

**What's still ahead after JSC builds**:

- **C. Bun C++ side cross-compile.** Bun's `scripts/build/` builds a
  C++ side via ninja using each dep's `direct` or `nested-cmake`
  spec. We need to add an iOS profile in `profiles.ts` and thread
  `cfg.ios` through every dep build (mimalloc, BoringSSL, libuv,
  brotli, etc.). Mechanical but ~15 deps to touch — estimated 1-2
  days.
- **D. iOS link script.** Once C produces an `.a` archive of bun C++
  objects, fill in `scripts/link-skal-ios.sh`'s LDFLAGS block to do
  the actual link. ~0.5 day.
- **E + F**: framework wrapping + code signing — unchanged from the
  upstream IOS_DEVICE_TODO entries.

---

### Spike day 1 — historical (kept for reference)

**Patches landed in `patches/0004-bun-ios-target-plumbing.patch`** (~200 LOC):

1. `src/bun_core/env.zig` — added `.ios` to `OperatingSystem` enum + filled
   in switch coverage in `displayString` / `nameString` / `stdOSTag` /
   `npmName`. `nameString` maps `.ios → "darwin"` because iOS userland
   would see `process.platform === "darwin"` (Apple Mach-O + BSD libc).
2. `build.zig` — `.ios => .ios` in the os.tag dispatch, iOS 14.0 min
   version, `BunBuildOptions.ios_sdkroot` field, `-Dios_sdkroot=...`
   CLI option with auto-detect via `xcrun --sdk iphoneos --show-sdk-path`
   on darwin host, plumbed through `getTranslateC` (2 callsites).
3. `src/c-headers-for-zig.h` — guarded `<libproc.h>`, `<mach/mach_host.h>`,
   `<mach/processor_info.h>`, `<sys/mount.h>` behind `#if !IOS` (they're
   macOS-only; iOS sandboxes the underlying capabilities away).

**Progress**: `zig build obj -Dtarget=aarch64-ios.14.0` now gets past:
- "Unsupported OS tag" panic ✅
- "switch must handle all possibilities" enum coverage errors ✅
- "'fcntl.h' file not found" — solved by sysroot plumbing ✅
- "'libproc.h' file not found" — solved by `#if !IOS` gate ✅

**Next**: actual Zig code that imports the now-stripped libproc/mach
functions will fail to compile. Need to add `Environment.os != .ios`
guards (or stubs) at each call site. Number of sites unknown until
we run the build — easy to find via the build's compile errors.

### Header surface to gate (iOS macOS-only-API list)

These came up while iterating; documenting now so a future contributor
doesn't rediscover from scratch:

| Header | Purpose | iOS situation | Skal status |
|---|---|---|---|
| `<libproc.h>` | proc_listpids, proc_pidpath | Not in iPhoneOS.sdk | Gated `!IOS` |
| `<mach/mach_host.h>` | host_info, host_statistics | Restricted on iOS | Gated `!IOS` |
| `<mach/processor_info.h>` | processor_info_array_t | Restricted on iOS | Gated `!IOS` |
| `<sys/mount.h>` | getmntinfo, statfs | Restricted on iOS | Gated `!IOS` |
| `<copyfile.h>` | copyfile() | Available on iOS | Kept under DARWIN |
| `<net/if_dl.h>` | LLAddr | Available on iOS | Kept under DARWIN |
| `<sys/clonefile.h>` | clonefile() | Available on iOS (APFS) | Kept under DARWIN |
| `<sys/sysctl.h>` | sysctlbyname | Available on iOS (mostly) | Kept under DARWIN |

The DARWIN macro stays inclusive (true for both macOS + iOS) — covers
the common Mach-O / kqueue / pthread / BSD-libc path. New IOS macro
gates off the macOS-only stuff.

### Toolchain notes for future sessions

- bun's pinned zig lives at `vendor/bun/vendor/zig/zig` (v0.15.2).
  System zig 0.16 has incompatible Build.zig API changes; use the
  pinned one.
- Codegen output dir for cross-builds: `-Dcodegen_path=<absolute path
  to existing release codegen>`. Doing the actual codegen run for iOS
  isn't necessary for the spike — the codegen is target-agnostic Zig
  source.
- iOS SDK location: `/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS<NN>.sdk`
  (currently iPhoneOS26.2.sdk on this Mac). Auto-detected by `xcrun`.

---

## 🚀 Suggested next step: 2-day spike before committing the full budget

Don't commit ~2.5 weeks until two specific unknowns are de-risked.

### Spike day 1 — Bun Zig-cross-compile dry run (~6 hours)

1. Add the minimum 5-line patch to `vendor/bun/scripts/build/config.ts`:
   extend the `OS` type to include `"ios"`. Don't wire it into
   anything yet — just want the type to exist.
2. Run `zig build -Dtarget=aarch64-apple-ios14.0` on **just the Zig
   portion** of bun (skip C++, skip deps, skip WebKit).
3. **Outcome**: either "Zig side mostly works, here are the specific
   platform branches I need to add" OR "Zig stdlib has fundamental
   issues with iOS target."

### Spike day 2 — JSC-for-iOS build (~6 hours)

1. Check out WebKit at bun's pinned SHA.
2. Try:
   ```bash
   Tools/Scripts/build-jsc --jsc-only --release \
     --cmakeargs="-DENABLE_JIT=0 -DPORT=iOS"
   ```
3. **Outcome**: either "builds in 30 min, here's
   libJavaScriptCore.a" OR "WebKit's iOS build path needs N
   patches, here are the errors."

### Decision criteria after the spike

- **Both spikes green** → green-light the ~2.5 week plan.
- **Spike 1 red** → unknown Zig stdlib issues; reassess effort
  estimate (could be 4-5 weeks).
- **Spike 2 red** → WebKit-for-iOS is harder than expected;
  consider falling back to **WKWebView embedding** as an
  alternative path (different architecture, ~1 week, but ships).
- **Both spikes red** → defer iOS device past v0.1 public alpha.
  Ship Skal-on-Simulator + Android + Desktop as the v0.1 surface.

---

## What this unlocks once done

- **Real iOS app shipping**: TestFlight + App Store distribution.
- **The "three platforms" claim becomes real**: today Android +
  Desktop are production-shape; iOS is dev-only.
- **CI parity**: nightly runs that exercise device-target builds
  catch regressions before they reach the Sim-only dev loop.

---

## Cross-references

- `docs/ios-port.md` — original Phase 2 design doc (slightly stale,
  written before bun-iOS-Sim shipped).
- `TODO_PLATFORMS.md` § 9.14 — original 1-week estimate (low end of
  this doc's range).
- `TODO_PLATFORMS.md` § 2.3 — `skal build ios-device` CLI plumbing
  (P0 device after Phase 2).
- `scripts/link-skal-iossim.sh` — the Sim link script that becomes
  the basis for `link-skal-ios.sh`.
- `native/ios/skal_iossim_shim.c` — the `__clear_cache` shim that
  goes away on real device.
