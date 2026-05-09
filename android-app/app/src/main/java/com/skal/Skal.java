package com.skal;

/**
 * Skal — embeddable JS runtime backed by JavaScriptCore (in progress) and
 * a web-API surface compatible with bun.
 *
 * Usage:
 *   try (Skal s = new Skal()) {
 *     String result = s.evaluate("1 + 2", "inline.js");
 *   }
 *
 * The native library is named "skal" and is loaded via System.loadLibrary.
 * Place libskal.so under src/main/jniLibs/{arm64-v8a,armeabi-v7a,x86_64}
 * in your Android Gradle module.
 */
public final class Skal implements AutoCloseable {
    static {
        System.loadLibrary("skal");
    }

    private long handle;

    public Skal() {
        this.handle = nativeCreateRuntime();
        if (this.handle == 0L) {
            throw new IllegalStateException("Skal: failed to create runtime");
        }
    }

    public String evaluate(String source, String url) {
        if (handle == 0L) throw new IllegalStateException("Skal: runtime is closed");
        return nativeEvaluate(handle, source, url);
    }

    /**
     * Evaluate {@code source} with on-disk JSC bytecode caching at
     * {@code cachePath}.
     *
     * On the first call (cache miss), this should parse the source, compile
     * it to bytecode, save the bytecode to {@code cachePath}, and execute.
     * On subsequent calls (cache hit), it should load the bytecode from
     * {@code cachePath} and execute without re-parsing — saving the parse
     * + initial bytecode-generation cost (~30–50 ms for a typical 18 KB
     * bundle).
     *
     * <p><strong>Current implementation:</strong> identical to
     * {@link #evaluate(String, String)} — the cache path is reserved for the
     * future C++ shim that integrates with JSC's CachedBytecode API. The
     * bytecode-generation extern functions exposed by bun
     * ({@code generateCachedCommonJSProgramByteCodeFromSourceCode} etc.)
     * give us the bytes; the missing piece is a custom
     * {@code JSC::SourceProvider} subclass that feeds those bytes into
     * {@code JSC::evaluate}'s parse fast-path. ~100 lines of WebKit C++
     * + a libskal.so rebuild.
     *
     * <p>Until that's done, callers can use this method anyway — the API
     * is stable and the implementation will get faster transparently.
     *
     * @param source    the JS source text
     * @param url       source URL for stack traces
     * @param cachePath absolute path on the device's filesystem where the
     *                  bytecode cache should be read from / written to
     * @return result of evaluation as a string (same as {@link #evaluate})
     */
    public String evaluateCached(String source, String url, String cachePath) {
        if (handle == 0L) throw new IllegalStateException("Skal: runtime is closed");
        // TODO: wire to nativeEvaluateCached once the C++ shim is added.
        // For now, the cache path is unused; we still re-parse on every launch.
        return nativeEvaluate(handle, source, url);
    }

    @Override
    public void close() {
        if (handle != 0L) {
            nativeDisposeRuntime(handle);
            handle = 0L;
        }
    }

    /** Returns a DirectByteBuffer over the shared bridge memory (no copy). */
    public java.nio.ByteBuffer acquireBridge() {
        if (handle == 0L) throw new IllegalStateException("Skal: runtime is closed");
        return nativeAcquireBridge(handle);
    }

    /** Wakes the JS thread so it drains the event ring. */
    public void wakeJs() {
        if (handle == 0L) throw new IllegalStateException("Skal: runtime is closed");
        nativeWakeJs(handle);
    }

    long handle() { return handle; }

    private static native long nativeCreateRuntime();
    private static native void nativeDisposeRuntime(long handle);
    private static native String nativeEvaluate(long handle, String source, String url);
    private static native java.nio.ByteBuffer nativeAcquireBridge(long handle);
    private static native void nativeWakeJs(long handle);
}
