// Skal Desktop — single-module project. Shares bridge + composables with
// android-app/ via srcDirs (see build.gradle.kts) so SkalBridge.kt and
// SkalRoot.kt are the same source on both targets. Only platform-specific
// piece is the entry point: this module's Main.kt vs android-app's
// MainActivity.kt.

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

rootProject.name = "SkalDesktop"

// Composite build: pull bridge + composables from shared/ (KMP module
// shared with android-app and ios-app). All three modules consume
// `com.skal:shared`; includeBuild substitutes it from this path.
includeBuild("../shared")
