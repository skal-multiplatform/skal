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
        // JNI's GetStringUTFChars returns *modified* UTF-8: characters above
        // U+FFFF (e.g. 🚀 in our skal-app.js bundle) get encoded as their
        // UTF-16 surrogate pair, with each surrogate emitted as a 3-byte
        // sequence. JSC's WTF::String::fromUTF8 expects standard UTF-8 and
        // rejects the modified form (the surrogate codepoints aren't valid
        // UTF-8). The result is a silently-empty source — JSC evaluates
        // nothing, returns undefined, and the bundle's IIFE never runs.
        //
        // Workaround: escape every non-ASCII code unit as a backslash-u
        // hex escape before crossing the JNI boundary. The resulting source
        // is pure ASCII, so modified UTF-8 == standard UTF-8 and JSC parses
        // it correctly. Each Java char is a UTF-16 code unit, so a surrogate
        // pair like 🚀 (U+1F680) naturally emits as two consecutive escapes
        // — both ECMAScript-valid in any string-literal context.
        return nativeEvaluate(handle, asciiEscapeForJni(source), url);
    }

    /**
     * Replace every code unit greater than 0x7F with a backslash-u four-hex
     * escape so the entire source string survives JNI's modified-UTF-8
     * conversion unscathed. See {@link #evaluate(String, String)} for the
     * bug this works around.
     *
     * <p>Cost: one allocation + one pass per evaluate. For our 18 KB Solid
     * bundle (5 non-ASCII chars), this adds ~30 µs to a ~10 ms parse —
     * invisible. If a future bundle is mostly non-ASCII, consider switching
     * to a {@code byte[]}-based JNI method instead.
     */
    private static String asciiEscapeForJni(String s) {
        // Fast path — most sources are pure ASCII.
        boolean clean = true;
        for (int i = 0, n = s.length(); i < n; i++) {
            if (s.charAt(i) > 0x7F) { clean = false; break; }
        }
        if (clean) return s;

        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0, n = s.length(); i < n; i++) {
            char c = s.charAt(i);
            if (c <= 0x7F) {
                sb.append(c);
            } else {
                sb.append("\\u");
                String hex = Integer.toHexString(c);
                for (int pad = hex.length(); pad < 4; pad++) sb.append('0');
                sb.append(hex);
            }
        }
        return sb.toString();
    }

    /**
     * Load + evaluate a CJS-formatted JS bundle that ships with adjacent
     * bytecode (a {@code .cjs} file with a {@code .cjs.jsc} sibling). Used
     * by release builds for fast cold start.
     *
     * <p>Build pipeline produces these via:
     * <pre>
     *   bun build skal-app.js --bytecode --format=cjs
     * </pre>
     * which emits {@code skal-app.cjs} (with the {@code @bun @bytecode @bun-cjs}
     * marker in its header) and {@code skal-app.cjs.jsc} (the JSC unlinked
     * code-block bytes for the wrapped source).
     *
     * <p>At runtime this method evaluates a tiny bootstrap that does
     * {@code await import(jsPath)}. Bun's module loader sees the marker,
     * appends {@code .jsc} to the path, reads the bytecode, attaches it to
     * the SourceProvider, and JSC's parser short-circuits — no parse cost.
     *
     * <p>Caller is responsible for ensuring {@code jsPath} (and
     * {@code jsPath + ".jsc"}) exist on the device's filesystem (typically
     * after extracting from APK assets).
     *
     * @param jsPath absolute path on the device's filesystem to the
     *               {@code .cjs} file. The matching {@code .jsc} must
     *               sit next to it.
     * @return result of the dynamic import (a module namespace object,
     *         stringified)
     */
    public String evaluateModuleAtPath(String jsPath) {
        if (handle == 0L) throw new IllegalStateException("Skal: runtime is closed");
        // Async IIFE — Bun__REPL__evaluate runs as Program (no top-level
        // await), but dynamic import() works in script context. The Zig
        // worker's waitForPromise hook unwraps the returned promise before
        // returning to Java, so this is synchronous from the caller's POV.
        // The IIFE bundle's side effects (mounting the renderer, registering
        // bridge globals) execute during the import — the returned namespace
        // is irrelevant for us.
        final String loader =
            "(async()=>{" +
                "await import(" + jsStringLiteral("file://" + jsPath) + ");" +
                "return 'skal-app loaded';" +
            "})();";
        return nativeEvaluate(handle, loader, "skal:loader");
    }

    /**
     * Encode a string as a JS string literal (a la JSON.stringify). Used for
     * embedding the source + cache path into the {@link #evaluateCached}
     * loader script. Handles all control chars and the U+2028/U+2029 line
     * separators that are valid in JSON but illegal raw inside JS string
     * literals.
     */
    private static String jsStringLiteral(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 16);
        sb.append('"');
        for (int i = 0, n = s.length(); i < n; i++) {
            char c = s.charAt(i);
            switch (c) {
                case 0x5C /* \ */: sb.append("\\\\"); break;
                case 0x22 /* " */: sb.append("\\\""); break;
                case 0x0A /* \n */: sb.append("\\n"); break;
                case 0x0D /* \r */: sb.append("\\r"); break;
                case 0x09 /* \t */: sb.append("\\t"); break;
                case 0x08 /* \b */: sb.append("\\b"); break;
                case 0x0C /* \f */: sb.append("\\f"); break;
                case 0x2028: sb.append("\\u2028"); break;
                case 0x2029: sb.append("\\u2029"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
        return sb.toString();
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
