# Skal iOS — Phase 0 scaffold

**Status (2026-05-10)**: Compose Multiplatform iOS pipeline alive,
verified rendering on iPhone 15 Pro Max simulator (iOS 17.0). JS
runtime side (bun-on-iOS) is not yet built. See `docs/ios-port.md`
for the full plan.

## What this builds

A Kotlin Multiplatform module producing `Skal.framework` (static) for
three iOS targets:

  * `iosArm64`           — physical iPhone/iPad (production)
  * `iosSimulatorArm64`  — iOS Simulator on Apple Silicon (dev loop)
  * `iosX64`             — iOS Simulator on Intel-Mac (parity only)

The framework includes:
  * Compose Multiplatform's iOS UI runtime (Skiko + Compose UI)
  * `com.skal.ios.MainKt.MainViewController()` — entry point returning
    a `UIViewController` that displays the Phase 0 placeholder UI.
  * `com.skal.ios.Skal` — stub class with the same shape as
    `android-app`'s `Skal.java`. Every method that needs a real JS
    runtime throws `NotImplementedError` with a pointer to
    `docs/ios-port.md`.

Output paths after build:
```
build/bin/iosArm64/debugFramework/Skal.framework
build/bin/iosSimulatorArm64/debugFramework/Skal.framework
```

## Build

```
./gradlew linkDebugFrameworkIosSimulatorArm64
./gradlew linkDebugFrameworkIosArm64
```

First run downloads Kotlin/Native LLVM + sysroot (~500 MB into
`~/.konan`). Subsequent builds are fast (10-30 sec) thanks to
incremental compile.

## Consume from an Xcode app

There's a working host already: `iosApp/`. It's an XcodeGen-managed
SwiftUI shell that consumes `Skal.framework`. Regenerate the Xcode
project from spec when you change anything:

```sh
cd iosApp
xcodegen generate                          # writes SkalIosApp.xcodeproj
```

Build + install + launch on the booted simulator (assumes
iPhone 15 Pro Max id is `52387C36…`; swap for `xcrun simctl list`):

```sh
# 1. Build the Kotlin/Native framework
cd ..
./gradlew linkDebugFrameworkIosSimulatorArm64

# 2. Build the Xcode app
cd iosApp
xcodebuild -project SkalIosApp.xcodeproj -scheme SkalIosApp \
  -configuration Debug -sdk iphonesimulator \
  -destination "id=52387C36-71E4-4FDF-8483-8D7B66F6512E" build

# 3. Install + launch
DERIVED=~/Library/Developer/Xcode/DerivedData/SkalIosApp-*/Build/Products/Debug-iphonesimulator
xcrun simctl install booted $DERIVED/SkalIosApp.app
xcrun simctl launch booted com.skal.ios.demo
```

The Swift host is in `iosApp/SkalIosApp/SkalIosApp.swift` — a 30-line
SwiftUI shell that wraps `MainKt.MainViewController()` (the
Compose-rendered UIViewController exported from Skal.framework) in a
`UIViewControllerRepresentable`. When the JS runtime arrives, only
the Kotlin side changes; the Swift shell stays unchanged.

If you'd rather hook the framework into your own existing iOS app,
the steps are:

1. `./gradlew :linkDebugFrameworkIosSimulatorArm64` (or the
   `iosArm64` variant for device).
2. Drag `build/bin/iosSimulatorArm64/debugFramework/Skal.framework`
   into your Xcode project — set "Embed & Sign".
3. Add `<key>CADisableMinimumFrameDurationOnPhone</key><true/>` to
   your Info.plist. (Compose Multiplatform iOS aborts with a sanity
   check on launch if this is missing — it's about ProMotion 120 Hz
   support.)
4. In Swift: `import Skal` then `MainKt.MainViewController()` returns
   the UIViewController you embed.

## What's NOT in this scaffold

  * **No bun runtime.** `Skal().evaluate(...)` throws. The work to
    cross-compile bun + WebKit + all native deps to iOS arm64 is
    captured in `docs/ios-port.md` (Phase 2, ~1 week).
  * **No bridge code.** `SkalBridge.kt` + `SkalRoot.kt` from
    `android-app/.../bridge/` aren't reachable yet. They use
    `java.nio.ByteBuffer` and depend on `Skal.java`, both
    JVM-specific. Phase 1 (~0.5 day) abstracts the buffer access
    behind expect/actual and moves the bridge to `commonMain`.
  * **No Xcode project.** We don't ship a `.xcodeproj` because it'd
    be deeply machine-specific (signing, bundle IDs, deployment
    target). The 4-step recipe above is enough for any Skal dev to
    hook the framework into their own iOS app.

## Why iOS isn't "just like desktop"

The Kotlin side reuses cleanly (Compose Multiplatform, KMP source
sets). The native side does not — bun has no iOS profile, no iOS
prebuilt WebKit exists, JIT is restricted on iOS, and the JNI bridge
in `skal_entry.zig` doesn't apply on Kotlin/Native (we'd need a plain
C export surface for cinterop). See `docs/ios-port.md` for the full
breakdown.
