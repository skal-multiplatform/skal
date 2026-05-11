// Skal shared — Kotlin Multiplatform module containing the bridge code
// (SkalBridge.kt, SkalRoot.kt) and the SkalRuntime abstraction. Built
// for JVM (consumed by android-app + desktop-app) and iOS (consumed by
// ios-app). Same source for all three; platform-specific bits live
// behind the SkalRuntime interface and the SkalBuffer expect class.
//
// This module is consumed by the per-platform app modules via Gradle
// composite builds (`includeBuild("../shared")` in their settings.gradle).
// Standalone build also works for verifying it compiles in isolation.

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

rootProject.name = "shared"
