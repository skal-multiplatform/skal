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

    @Override
    public void close() {
        if (handle != 0L) {
            nativeDisposeRuntime(handle);
            handle = 0L;
        }
    }

    private static native long nativeCreateRuntime();
    private static native void nativeDisposeRuntime(long handle);
    private static native String nativeEvaluate(long handle, String source, String url);
}
