// Skal Desktop — Compose Multiplatform / Desktop (JVM) target.
//
// Reuses the android-app's bridge + composable source files via
// srcDirs. The bridge package (com.skal.bridge.*) and the JNI Java
// wrapper (com.skal.Skal) are platform-neutral — they compile against
// the same Compose Multiplatform APIs and androidx.collection on
// any JVM target. The Android-specific bench/MainActivity is excluded;
// our entry point is com.skal.desktop.Main below.

plugins {
    kotlin("jvm") version "2.0.21"
    id("org.jetbrains.compose") version "1.7.1"
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21"
}

kotlin {
    jvmToolchain(17)
}

// Java toolchain — used by both the JVM compile tasks AND compose.desktop's
// `run` task. Without this block, compose's run uses the daemon's JDK
// (system Java 11 here), which fails to load class files compiled at
// version 61 (Java 17). Setting java.toolchain forces Gradle to pick
// (download if needed) a JDK 17 launcher for `run` too.
java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

// Source layout: only desktop-specific Main.kt lives here. The bridge
// (SkalBridge.kt, SkalRoot.kt) and the JNI-bound Skal.java are pulled
// in transitively from `com.skal:shared` — see the dependency below.

// ── libskal.dylib auto-build ────────────────────────────────────────────
//
// `desktop-app/native/libskal.dylib` is a JNI runtime artifact. Without
// it, `System.loadLibrary("skal")` in Skal.java's static initializer
// throws UnsatisfiedLinkError before MainKt can even start.
//
// The `linkSkalDylib` task wraps scripts/link-skal-dylib.sh so a fresh
// checkout's `./gradlew :run` Just Works — no manual link-script
// invocation. The script itself depends on
// vendor/bun/build/release/bun-profile, which is built separately by
// `bun run build:release` in vendor/bun (we don't drive that from
// Gradle yet — it'd need rust toolchain detection + caching, ~1 day
// of work; see TODO_PLATFORMS § 1.5).
//
// Inputs / outputs are declared so Gradle's up-to-date check skips the
// script when nothing's changed (most rebuilds are no-ops). The native/
// dir gets a fresh symlink each run because the dylib is content-
// addressable via build/skal-darwin/.
val linkSkalDylib by tasks.registering(Exec::class) {
    val repoRoot = rootProject.projectDir.parentFile
    val script = repoRoot.resolve("scripts/link-skal-dylib.sh")
    val skalEntry = repoRoot.resolve("vendor/bun/src/skal_entry.zig")
    val bunProfile = repoRoot.resolve("vendor/bun/build/release/bun-profile")
    val out = repoRoot.resolve("build/skal-darwin/libskal.dylib")
    val nativeLink = rootProject.projectDir.resolve("native/libskal.dylib")

    inputs.file(script)
    // skal_entry.zig + bun-profile are tracked as **optional** inputs:
    // `optional(true)` lets Gradle accept a missing file at task-graph
    // realization time without throwing, but still records the file
    // path so a later mtime change triggers re-link. The earlier
    // `if (...exists()) inputs.file(...)` form silently dropped the
    // input registration on first eval — meaning a freshly-built
    // bun-profile was never recorded as an input, and subsequent
    // rebuilds wouldn't pick up changes to the bun release link.
    // The friendly "run bun run build:release" error still fires from
    // doFirst below; it just doesn't double as a plumbing-error
    // workaround anymore.
    inputs.file(skalEntry).withPropertyName("skalEntry").optional(true)
    inputs.file(bunProfile).withPropertyName("bunProfile").optional(true)
    outputs.file(out)

    commandLine("/bin/bash", script.absolutePath)
    workingDir = repoRoot

    doFirst {
        if (!bunProfile.exists()) {
            // \${...} keeps Kotlin's string templating from trying to
            // resolve $HOME/$PATH at script-compile time.
            throw GradleException(
                "vendor/bun/build/release/bun-profile not found.\n" +
                    "Run: cd vendor/bun && PATH=\${HOME}/.cargo/bin:\$PATH bun run build:release\n" +
                    "See TODO_PLATFORMS § 1.5 for the long-term Gradle-driven bun build."
            )
        }
    }
    doLast {
        // Symlink the freshly-built dylib into desktop-app/native/ so
        // the -Djava.library.path=...native runtime arg below resolves it.
        // We shell out to /bin/ln rather than java.nio.file.Files because
        // the Gradle DSL's `java { ... }` extension shadows the bare
        // `java` package — the reflective workaround is uglier than the
        // shell-out for a one-line operation.
        nativeLink.parentFile.mkdirs()
        project.exec {
            commandLine("/bin/ln", "-sfn", out.absolutePath, nativeLink.absolutePath)
        }
    }
}

// Wire the link as a prereq of every task that needs the dylib at
// runtime: :run, :runRelease, :runDistributable, :runReleaseDistributable,
// :package*, :createDistributable, :createReleaseDistributable. Other
// tasks (:compileKotlin etc.) don't need the dylib so we leave them
// untouched.
//
// `tasks.matching` is the lazy form — `compose.desktop`'s `application`
// block creates these tasks only during task-graph realization, not at
// script-evaluation time. `tasks.named("runRelease") { ... }` blows up
// with "task with name 'runRelease' not found" because the eager lookup
// runs before the plugin's deferred registration.
//
// Earlier this matcher was `it.name == "run"` — the literal-only match
// silently dropped runRelease/runDistributable from the dependency
// graph, so a fresh checkout's `./gradlew runRelease` would skip the
// link step and crash with UnsatisfiedLinkError. startsWith("run")
// catches all four run* variants Compose Desktop emits.
tasks.matching {
    it.name.startsWith("run") ||
        it.name.startsWith("package") ||
        it.name.startsWith("createDistributable") ||
        it.name.startsWith("createReleaseDistributable")
}.configureEach { dependsOn(linkSkalDylib) }

dependencies {
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.runtime)
    implementation(compose.foundation)
    implementation(compose.ui)

    // Skal bridge + composables — multiplatform module shared with
    // android-app and ios-app. Resolved via composite build (see
    // settings.gradle.kts's includeBuild("../shared")). Brings in
    // androidx.collection, com.skal.Skal (the JNI-bound class), and
    // SkalBuffer/SkalBridge/SkalRoot/createSkal transitively.
    implementation("com.skal:shared")
}

// Locate a JDK 17 launcher via Gradle's toolchain service. Compose Desktop's
// `run` task needs javaHome set explicitly — the default would be the daemon's
// JDK (often older than 17), which can't load class files compiled at v61.
val jdk17Launcher = javaToolchains.launcherFor {
    languageVersion.set(JavaLanguageVersion.of(17))
}

compose.desktop {
    application {
        mainClass = "com.skal.desktop.MainKt"
        // Force the run task to use the same JDK 17 we compile against.
        // Without this, compose.desktop falls back to the gradle daemon's
        // JDK (system default — Zulu 11 on this box) and the run aborts
        // with UnsupportedClassVersionError.
        javaHome = jdk17Launcher.get().metadata.installationPath.asFile.absolutePath
        // Add native/ to java.library.path so System.loadLibrary("skal")
        // finds libskal.dylib (macOS) / libskal.so (Linux) / skal.dll
        // (Windows) without env-var setup. Symlink or copy the platform
        // binary into desktop-app/native/.
        jvmArgs += "-Djava.library.path=${rootProject.projectDir}/native"
        nativeDistributions {
            targetFormats(
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Dmg,
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Deb,
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Msi,
            )
            packageName = "Skal"
            // Compose Desktop's nativeDistributions requires MAJOR > 0 even
            // for pre-1.0 software. Using 1.0.0 keeps Dmg/Deb/Msi happy;
            // the actual Skal version lives elsewhere (TODO: pull from a
            // shared version constant once android + desktop converge).
            packageVersion = "1.0.0"
        }

        // ── Release variant — minified JVM jar via R8, smaller .dmg ──
        //
        // Compose Desktop's release variant ships a separate task set
        // (:runRelease, :packageReleaseDmg) that runs R8 over the JVM
        // bytecode + resource shrinking, mirroring Android's release
        // mode. Without explicit config, :runRelease and :run produce
        // identical output (just renamed); enabling proguard here
        // makes release noticeably smaller and starts faster (less
        // class loading at runtime).
        //
        // The keep rules mirror android-app/app/proguard-rules.pro
        // because the JNI/bridge surface is identical on JVM Desktop
        // — Compose Desktop just runs the same SkalBridge+SkalRoot
        // code in a Skia/AWT host instead of an Activity host.
        buildTypes.release.proguard {
            isEnabled.set(true)
            // Compose Desktop bundles its own Skia + AWT shims; R8 is
            // conservative about reflection-using parts of those, so
            // we let it run with optimization but no obfuscation.
            // Names stay readable in stack traces — important for
            // production crash reports without source maps yet.
            obfuscate.set(false)
            optimize.set(true)
            configurationFiles.from(project.file("proguard-rules.pro"))
        }
    }
}
