plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.skal.skal_flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.skal.skal_flutter"
        // minSdk 28 — libskal.so is linked against Android API 28+ in
        // link-libskal-flutter.sh (--target=aarch64-...-android28). Below
        // 28 the loader will reject it with an ELF version mismatch.
        // Also: Impeller's Vulkan path needs API 29+ — anything older
        // falls back to the OpenGL ES Skia renderer (slower, more jank
        // on first-frame). We want Impeller-Vulkan in the experiment.
        minSdk = 29
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // arm64-v8a only. Skal's libskal.so is ~90 MB; we have no
        // 32-bit / x86 builds, and we only care about modern arm64
        // perf characteristics for this experiment.
        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    // Compress .so files in the APK ZIP.
    //
    // AGP 8+ defaults `useLegacyPackaging = false`, which stores .so
    // files uncompressed so the OS can mmap them directly from the
    // APK without extracting (faster install + better RAM sharing on
    // modern Android). The trade-off is a much larger APK download
    // because the dominant 87 MB libskal.so is stored raw.
    //
    // For Skal specifically the trade-off goes the other way: an APK
    // sideloaded via `adb install` over USB is what we ship to testers,
    // and saving ~58 MB on that download more than offsets the
    // ~hundreds of ms install-time extraction cost (one-time per
    // install). On the Play Store the choice is moot — Play repacks
    // with its own transit compression regardless of this flag.
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
}

flutter {
    source = "../.."
}
