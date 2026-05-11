package com.skal

import com.skal.bridge.SkalBuffer
import java.nio.ByteOrder

/**
 * JVM `actual` for [createSkal] — wraps the JNI-loaded `com.skal.Skal`
 * Java class as a [SkalRuntime].
 *
 * The Java class lives in the same module (`shared/src/jvmMain/java/`)
 * and stays unchanged so its native methods keep matching the
 * `Java_com_skal_Skal_*` symbol table that `skal_entry.zig` exports.
 * This wrapper only adapts the `acquireBridge()` return type from
 * `java.nio.ByteBuffer` to the multiplatform [SkalBuffer], and forwards
 * everything else 1:1.
 */
actual fun createSkal(): SkalRuntime = SkalJvm(Skal())

private class SkalJvm(private val native: Skal) : SkalRuntime {
    override fun evaluate(source: String, url: String): String =
        native.evaluate(source, url)

    override fun evaluateModuleAtPath(jsPath: String): String =
        native.evaluateModuleAtPath(jsPath)

    override fun acquireBridge(): SkalBuffer {
        // The JNI side hands us a no-copy DirectByteBuffer over the 2 MiB
        // shared region. Pin its byte order to little-endian here so
        // every read/write through SkalBuffer matches what skal_entry.zig
        // and JS write — the bridge code in commonMain doesn't (and
        // can't) call .order() itself.
        val bb = native.acquireBridge().order(ByteOrder.LITTLE_ENDIAN)
        return SkalBuffer(bb)
    }

    override fun wakeJs() = native.wakeJs()

    override fun close() = native.close()
}
