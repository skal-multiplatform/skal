# Compose Desktop release-mode ProGuard keep rules.
#
# Compose Desktop uses ProGuard 7.2 (not Android's R8) — slightly
# different syntax and defaults. The big rule: `-keep` is only for
# APP-OWNED classes; library classes (java.awt, javax.swing, etc.)
# should never appear in keep rules — those are SDK classes ProGuard
# knows about from the JRE classpath. If they need to be kept-quiet,
# `-dontwarn` is the right tool.

# ── App: JNI surface ───────────────────────────────────────────────────

-keep class com.skal.Skal {
    *;
}
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── App: bridge code ───────────────────────────────────────────────────

-keep class com.skal.bridge.** {
    *;
}
-keep class com.skal.SkalRuntime { *; }
-keep class com.skal.SkalRuntimeKt { *; }
-keep class com.skal.desktop.** { *; }

# ── App: Compose Multiplatform reflection points ──────────────────────

-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.coroutines.jvm.internal.** { *; }

# androidx.collection's MutableInt*Map use Kotlin operator inline
# functions that ProGuard sometimes rewrites incorrectly.
-keep class androidx.collection.MutableIntObjectMap { *; }
-keep class androidx.collection.MutableIntIntMap { *; }

# ── Stack trace readability ────────────────────────────────────────────

-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Quiet library-class warnings ───────────────────────────────────────
#
# ProGuard's default JDK detection (java.home, jrt:/) misses some
# JRE 17 / JDK 21 modules; the resulting "unresolved reference" notes
# aren't actionable from app code, so we silence them.

-dontwarn java.awt.**
-dontwarn javax.swing.**
-dontwarn sun.**
-dontwarn org.jetbrains.skiko.**
-dontwarn org.jetbrains.skia.**
-dontwarn org.jetbrains.compose.**
-dontwarn kotlinx.coroutines.debug.**
-dontwarn javax.lang.model.**
-dontwarn java.lang.invoke.**
-dontwarn org.slf4j.**
-dontwarn kotlin.reflect.**

# ── Don't fail on the kind of "library class needs keep" notes that ────
#    happen because ProGuard can't see the full JDK classpath ───────────

-ignorewarnings
