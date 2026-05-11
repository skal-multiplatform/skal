// Skal shared — bridge + composables that compile for JVM (Android +
// Desktop) and iOS Kotlin/Native. Composite-build consumers refer to
// this as `com.skal:shared`.

import org.jetbrains.kotlin.gradle.plugin.mpp.KotlinNativeTarget

plugins {
    kotlin("multiplatform") version "2.0.21"
    id("org.jetbrains.compose") version "1.7.1"
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21"
}

group = "com.skal"
version = "0.1.0-SNAPSHOT"

kotlin {
    // expect/actual class shape is "Beta" in Kotlin 2.0; we know what we're
    // doing (SkalBuffer is the only expect class, has no inheritance, and
    // the actuals are intentionally divergent). The flag silences the warn
    // without affecting code generation.
    compilerOptions {
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    // Single jvm target serves both Android and Desktop. They both run on
    // a Hotspot/JNI-capable JVM 17 and share the libskal.{so,dylib} ABI;
    // there's no Android-vs-Desktop split inside the bridge code.
    //
    // withJava() enables a `java/` source dir alongside `kotlin/` in
    // jvmMain — needed so Skal.java (the JNI-bound class with native
    // methods that resolve against `Java_com_skal_Skal_*` in
    // libskal.{so,dylib}) compiles in this module rather than the per-app
    // ones. Renaming the class would break the JNI symbol table, so we
    // keep it as a Java source verbatim and let Kotlin call into it.
    jvm {
        @Suppress("OPT_IN_USAGE")
        withJava()
    }

    // iOS targets — same triplet ios-app/ uses, so the shared/ klib
    // commonizes cleanly with ios-app's iosMain.
    //
    // cinterop block on each target wires the Skal C entry surface
    // (native/ios/skal.h) into Kotlin/Native bindings. The `.def` file
    // also ships an inline stub implementation that gets compiled and
    // statically linked into Skal.framework — no external build for the
    // stub. When Phase 2 of docs/ios-port.md lands the real bun-iOS
    // build, replace the inline impl with a static-library reference.
    // Absolute paths — relative paths in .def's `headers`/`compilerOpts`
    // resolve from cinterop's temp dir, not the .def's location, so we
    // pass them through Gradle's includeDirs DSL instead of putting them
    // in the .def file.
    val nativeIosDir = rootProject.file("../native/ios")
    // libskal.dylib (re-stamped as IOSSIMULATOR by scripts/link-skal-iossim.sh).
    // The Kotlin/Native linker needs to see this at link time to resolve
    // skal_create_runtime / skal_evaluate / etc. symbols. The resulting
    // Skal.framework binary gets an LC_LOAD_DYLIB record pointing at
    // @rpath/libskal.dylib (the dylib's install_name); dyld resolves
    // that against the app's @executable_path/Frameworks at runtime.
    val skalIosSimDir = rootProject.file("../build/skal-iossim")
    val configureIosCinterop: org.jetbrains.kotlin.gradle.plugin.mpp.KotlinNativeTarget.() -> Unit = {
        compilations.getByName("main") {
            cinterops {
                create("skal") {
                    defFile(project.file("src/iosMain/cinterop/skal.def"))
                    packageName("com.skal.bridge.cinterop")
                    includeDirs(nativeIosDir)
                }
            }
        }
    }
    iosArm64 { configureIosCinterop() }
    iosSimulatorArm64 { configureIosCinterop() }
    iosX64 { configureIosCinterop() }

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            // Multiplatform primitive-keyed maps — used by SkalBridge in
            // place of Android's SparseArray. The JVM artifact resolves
            // for android-app + desktop-app; iOS gets the Kotlin/Native
            // klib variant.
            implementation("androidx.collection:collection:1.4.5")
        }
    }
}
