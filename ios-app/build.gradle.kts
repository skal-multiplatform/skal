// Skal iOS — Kotlin Multiplatform module producing Skal.framework.
//
// **Status: Phase 2** — Compose Multiplatform UI runs on iOS Simulator
// AND real iOS device. The bun-iOS runtime (libskal.dylib) is built
// for both Simulator (scripts/link-skal-iossim.sh) and Device
// (scripts/link-skal-ios.sh). Skal.kt's `evaluate()` resolves through
// cinterop into the actual JSC engine.
//
// Targets:
//   iosArm64           — physical iPhone/iPad (uses build/skal-ios-device/)
//   iosSimulatorArm64  — Xcode iOS Simulator on Apple Silicon (uses
//                        build/skal-iossim/)
//   iosX64             — Xcode iOS Simulator on Intel (rarely needed; kept
//                        for parity with stock JetBrains templates; uses
//                        build/skal-iossim/)
//
// Output: `Skal.framework` (dynamic, embeds LC_LOAD_DYLIB →
// @rpath/libskal.dylib) under `build/bin/iosArm64/{release,debug}Framework/`
// or `build/bin/iosSimulatorArm64/{release,debug}Framework/`.
// The Xcode app in ios-app/iosApp/ embeds the matching variant per
// active SDK via its postBuildScripts (see ios-app/iosApp/project.yml).

import org.jetbrains.kotlin.gradle.plugin.mpp.KotlinNativeTarget

plugins {
    kotlin("multiplatform") version "2.0.21"
    id("org.jetbrains.compose") version "1.7.1"
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21"
}

kotlin {
    // Three iOS targets — same set JetBrains' KMP + Compose-iOS template
    // ships. iosX64 is for Intel-Mac simulators and will become extinct
    // when CI runners drop x86_64; it costs ~30 sec of extra link time
    // on each build. Drop it when no developer needs it.
    iosArm64()
    iosSimulatorArm64()
    iosX64()

    // Skal.framework is now DYNAMIC (was static in Phase 0). The shift
    // is necessary to generate an LC_LOAD_DYLIB record in the framework's
    // Mach-O that points at @rpath/libskal.dylib (the bun runtime, built
    // by scripts/link-skal-iossim.sh for the Simulator and
    // scripts/link-skal-ios.sh for real iOS device). With a static
    // framework, the cinterop'd skal_* symbols would be left as
    // undefined external references for the consuming Xcode app to
    // resolve — that works, but means the Xcode project has to know
    // about libskal.dylib too. Going dynamic puts the dependency
    // declaration inside Skal.framework where it belongs.
    //
    // Two libskal builds exist, one per iOS Mach-O ABI:
    //   build/skal-iossim/    — Simulator (LC_BUILD_VERSION = IOSSIMULATOR)
    //   build/skal-ios-device/ — Device    (LC_BUILD_VERSION = IPHONEOS)
    // The Kotlin/Native linker generates an iOS-Simulator framework for
    // iosSimulatorArm64 + iosX64, and an iOS-Device framework for
    // iosArm64. The two libskal flavors share the same install_name
    // (@rpath/libskal.dylib) but differ in their LC_BUILD_VERSION, so
    // dyld at runtime only accepts the matching pair.
    val skalIosSimDir = rootProject.file("../build/skal-iossim")
    val skalIosDeviceDir = rootProject.file("../build/skal-ios-device")
    targets.withType<KotlinNativeTarget>().configureEach {
        val isDeviceTarget = name == "iosArm64"
        val skalLibDir = if (isDeviceTarget) skalIosDeviceDir else skalIosSimDir
        binaries.framework {
            baseName = "Skal"
            isStatic = false
            // -L<dir> -lskal — Kotlin/Native's linker (lld via clang)
            // generates LC_LOAD_DYLIB to libskal.dylib's install_name
            // (@rpath/libskal.dylib). dyld resolves @rpath against the
            // app's @executable_path/Frameworks at runtime.
            //
            // If the matching libskal hasn't been built yet, drop the
            // linkerOpts entirely so `./gradlew assemble` still succeeds
            // for the *other* iOS target — handy when you've built only
            // the Simulator libskal and want to iterate on Sim without
            // rebuilding the Device libskal each time.
            if (skalLibDir.isDirectory) {
                linkerOpts("-L${skalLibDir.absolutePath}", "-lskal")
            }
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            // Compose Multiplatform's iOS UIViewController integration —
            // used by `MainViewController()` to bridge into UIKit.
            implementation(compose.components.uiToolingPreview)
            // Skal bridge + composables — multiplatform module shared
            // with android-app and desktop-app. Resolved via composite
            // build (see settings.gradle.kts's includeBuild("../shared")).
            // Brings SkalBridge, SkalRoot, SkalRuntime, and createSkal()
            // (returns the iOS stub for now — Phase 2+ replaces with
            // libskal-ios cinterop). The framework's static linker pulls
            // shared's iosMain klib into Skal.framework.
            implementation("com.skal:shared")
        }
    }
}

// Compose Compiler plugin needs to know we're compiling Compose code on
// non-android, non-jvm targets. The org.jetbrains.kotlin.plugin.compose
// plugin (above) handles this transparently as of 2.0.20+.
