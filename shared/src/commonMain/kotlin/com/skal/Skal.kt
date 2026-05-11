package com.skal

import com.skal.bridge.SkalBuffer

/**
 * Multiplatform abstraction over the Skal JS runtime.
 *
 * Mirrors the surface of the original `com.skal.Skal` Java class
 * (android-app's JNI wrapper) but with [SkalBuffer] as the portable
 * bridge-memory type. Concrete impls:
 *
 *   - **JVM** (Android + Desktop): wraps `com.skal.Skal` (a JNI-loaded
 *     class that talks to libskal.{so,dylib} via the JNI symbols
 *     `Java_com_skal_Skal_*` exported from `skal_entry.zig`).
 *   - **iOS** (Kotlin/Native): a stub that throws until Phase 2 of
 *     `docs/ios-port.md` (bun cross-compile) ships libskal-ios + the
 *     non-JNI C entry surface.
 *
 * Callers should obtain instances via [createSkal]. The interface itself
 * is intentionally minimal — anything specific to the JNI path (e.g.
 * raw long handles, native loader bookkeeping) stays inside the JVM
 * impl.
 */
interface SkalRuntime : AutoCloseable {
    /** Evaluate JS source. Blocks the calling thread until the JS worker returns. */
    fun evaluate(source: String, url: String): String

    /**
     * Eval-then-import a CJS bundle with adjacent `.cjs.jsc` bytecode.
     * Used by Android release for parse-free cold start. Path is
     * absolute on the device's filesystem.
     */
    fun evaluateModuleAtPath(jsPath: String): String

    /**
     * Returns the shared bridge memory as a multiplatform [SkalBuffer].
     * On JVM this is a no-copy wrapper over a `DirectByteBuffer` that
     * the native side allocated; on iOS it'll wrap a pinned
     * `ByteArray` (or `CPointer<ByteVar>`) once the runtime exists.
     */
    fun acquireBridge(): SkalBuffer

    /**
     * Wakes the JS worker thread to drain any pending events. Called
     * from the UI thread on every Compose-side event dispatch.
     */
    fun wakeJs()
}

/**
 * Construct the platform-default Skal runtime. Each platform's `actual`
 * decides how to wire the underlying native runtime.
 */
expect fun createSkal(): SkalRuntime
