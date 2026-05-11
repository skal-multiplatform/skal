// Skal iOS — single-module Kotlin Multiplatform project producing a static
// framework (Skal.framework) that an Xcode app embeds. The framework
// includes Compose Multiplatform's iOS UI runtime + a stub Skal class
// that throws "not yet implemented" until libskal-ios is built (see
// docs/ios-port.md for the bun-cross-compile work).
//
// We do NOT srcDirs into android-app yet: that module's bridge code uses
// java.nio.ByteBuffer + Java sources, which don't compile on Kotlin/Native.
// A future commonMain refactor (see TODO.md "iOS port") moves bridge into
// platform-neutral expect/actual.

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
        // JetBrains Compose Multiplatform plugin
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Compose Multiplatform binaries
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

rootProject.name = "SkalIos"

// Composite build: pull bridge + composables from shared/ (KMP module
// shared with android-app and desktop-app). The framework this module
// produces (Skal.framework) bundles shared's iosMain code transitively,
// so the Xcode app gets bridge + Compose UI in a single binary.
includeBuild("../shared")
