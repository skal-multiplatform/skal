// Skal iOS — Kotlin Multiplatform module producing Skal.framework.
//
// **Status: Phase 0** — Compose Multiplatform UI runs on iOS; the JS
// runtime side (libskal.dylib equivalent for iOS) is not yet built.
// Skal.kt's `evaluate()` throws NotImplementedError. See docs/ios-port.md
// for the path to a real bun-iOS build.
//
// Targets:
//   iosArm64           — physical iPhone/iPad (production)
//   iosSimulatorArm64  — Xcode iOS Simulator on Apple Silicon (dev loop)
//   iosX64             — Xcode iOS Simulator on Intel (rarely needed; kept
//                        for parity with stock JetBrains templates)
//
// Output: `Skal.framework` (static) under
// `build/bin/iosArm64/SkalDebugFramework/` etc. An Xcode app project
// (not in this repo yet) would add this as an embedded framework.

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
    // Mach-O that points at @rpath/libskal.dylib (the bun runtime,
    // re-stamped for iOS Simulator by scripts/link-skal-iossim.sh). With
    // a static framework, the cinterop'd skal_* symbols would be left
    // as undefined external references for the consuming Xcode app to
    // resolve — that works, but means the Xcode project has to know
    // about libskal.dylib too. Going dynamic puts the dependency
    // declaration inside Skal.framework where it belongs.
    val skalIosSimDir = rootProject.file("../build/skal-iossim")
    targets.withType<KotlinNativeTarget>().configureEach {
        binaries.framework {
            baseName = "Skal"
            isStatic = false
            // -L<dir> -lskal — Kotlin/Native's linker (lld via clang)
            // generates LC_LOAD_DYLIB to libskal.dylib's install_name
            // (@rpath/libskal.dylib). dyld resolves @rpath against the
            // app's @executable_path/Frameworks at runtime.
            if (skalIosSimDir.isDirectory) {
                linkerOpts("-L${skalIosSimDir.absolutePath}", "-lskal")
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
