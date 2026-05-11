# Skal — R8 / ProGuard keep rules for the release build.
#
# Goal: shrink + obfuscate the Kotlin/Compose code in the APK without
# breaking JNI lookups or the reflection-using bits of the bridge.
#
# What survives explicitly here is the union of:
#   1. The JNI-bound class (com.skal.Skal) — its native methods are
#      looked up by name from libskal.so via JNIEnv->FindClass +
#      GetMethodID; renaming the class or its methods would break the
#      Java_com_skal_Skal_native* symbols' lookup.
#   2. The bridge state types (com.skal.bridge.*) — Compose's runtime
#      reflects over them in some snapshot/mutableState codegen paths,
#      and stripping their generic signatures has been observed to
#      cause runtime "no such method" failures.
#
# Anything not explicitly kept here is fair game for R8 to obfuscate
# / remove / inline. That's most of the APK by file count but only
# ~5 MB of bytes (libskal.so dominates the APK size).

# ── JNI surface (com.skal.Skal) ────────────────────────────────────────

# Keep the class and ALL members. R8's default keep wouldn't preserve
# the throwaway long handle field; without it the JNI bridge segfaults.
-keep class com.skal.Skal {
    *;
}

# Native methods are auto-kept by R8 when the enclosing class is kept,
# but make it explicit so a future R8 default change doesn't regress.
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── Bridge code (com.skal.bridge.*) ────────────────────────────────────

# SkalBridge / SkalRoot / NodeState. Compose's snapshot-state machinery
# does Class.getDeclaredField on the @Volatile pumpAvgNs / pumpPeakNs
# pair, and Compose's MutableState delegate codegen relies on field
# names being stable.
-keep class com.skal.bridge.** {
    *;
}

# Same for the multiplatform SkalRuntime / SkalBuffer. The expect/actual
# matching is at compile time; at runtime these are just classes that
# happen to be reachable from SkalBridge.
-keep class com.skal.SkalRuntime { *; }
-keep class com.skal.SkalRuntimeKt { *; }   # the createSkal() top-level fn

# ── Compose Multiplatform reflection ───────────────────────────────────

# Compose's runtime uses kotlin-reflect for some recomposer / slot-table
# work in debug paths. Keep the metadata classes Kotlin emits; they're
# tiny but R8 default removes them.
-keep class kotlin.Metadata { *; }
-keep class kotlin.coroutines.jvm.internal.** { *; }

# androidx.collection's MutableIntObjectMap / MutableIntIntMap —
# accessed via Kotlin operator conventions that R8 sometimes flags as
# unused (false positive on inline operators).
-keep class androidx.collection.MutableIntObjectMap { *; }
-keep class androidx.collection.MutableIntIntMap { *; }

# ── No obfuscation of public Compose composables ───────────────────────

# Function names like `SkalRoot`, `SkalNode` show up in stack traces
# and Compose-side error messages. Keep them readable for production
# crash reports.
-keepnames class com.skal.bridge.SkalRootKt { *; }
-keepnames class com.skal.bridge.SkalBridgeKt { *; }

# ── R8 quality-of-life ────────────────────────────────────────────────

# Don't warn on missing classes — Compose Multiplatform pulls in some
# desktop-only Skia paths that aren't on the Android classpath. R8
# would fail the build with "Missing class: org.jetbrains.skiko.foo" if
# these aren't excluded.
-dontwarn org.jetbrains.skiko.**
-dontwarn org.jetbrains.skia.**

# Keep line numbers in stack traces. Without this, R8 strips line
# info and the only trace info is method names → ~useless for
# diagnosing crashes in production.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
