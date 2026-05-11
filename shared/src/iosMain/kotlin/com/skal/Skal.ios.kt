package com.skal

import com.skal.bridge.SkalBuffer
import com.skal.bridge.cinterop.skal_acquire_bridge
import com.skal.bridge.cinterop.skal_create_runtime
import com.skal.bridge.cinterop.skal_dispose_runtime
import com.skal.bridge.cinterop.skal_evaluate
import com.skal.bridge.cinterop.skal_free_string
import com.skal.bridge.cinterop.skal_wake_js
import kotlinx.cinterop.ByteVar
import kotlinx.cinterop.COpaquePointerVar
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.IntVar
import kotlinx.cinterop.UByteVar
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.allocPointerTo
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import platform.posix.memcpy
import platform.posix.size_tVar

/**
 * iOS `actual` for [createSkal]. Wraps the C entry surface declared in
 * `native/ios/skal.h` (see `shared/src/iosMain/cinterop/skal.def`).
 *
 * As of Phase 2 the C surface is backed by the real bun-iOS-Simulator
 * runtime — `libskal.dylib` is the actual bun + JSC binary, vtool-
 * stamped with LC_BUILD_VERSION = IOSSIMULATOR (see
 * `scripts/link-skal-iossim.sh`). `evaluate` runs JS through JSC;
 * `acquireBridge` hands back the same 2 MiB shared region the JVM
 * impl uses on Android/Desktop. The Kotlin pipeline below is
 * identical in shape to the JVM `Skal.java` JNI wrapper — only the
 * cinterop'd C calls differ.
 */
@OptIn(ExperimentalForeignApi::class)
actual fun createSkal(): SkalRuntime {
    val handle = skal_create_runtime()
    if (handle == 0L) {
        throw IllegalStateException("Skal: failed to create runtime (handle=0)")
    }
    return SkalIosRuntime(handle)
}

@OptIn(ExperimentalForeignApi::class)
private class SkalIosRuntime(private var handle: Long) : SkalRuntime {

    override fun evaluate(source: String, url: String): String = memScoped {
        require(handle != 0L) { "Skal: runtime is closed" }

        val sourceBytes = source.encodeToByteArray()
        val urlBytes = url.encodeToByteArray()
        val outResult = allocPointerTo<ByteVar>()
        val outLen = alloc<size_tVar>()
        val outIsError = alloc<IntVar>()

        // Pin the byte arrays so their addresses are stable for the
        // duration of the call. The C side is synchronous — it returns
        // before the pinning ends — so this is safe.
        sourceBytes.usePinned { srcPin ->
            urlBytes.usePinned { urlPin ->
                skal_evaluate(
                    handle,
                    if (sourceBytes.isNotEmpty()) srcPin.addressOf(0) else null,
                    sourceBytes.size.convert(),
                    if (urlBytes.isNotEmpty()) urlPin.addressOf(0) else null,
                    urlBytes.size.convert(),
                    outResult.ptr,
                    outLen.ptr,
                    outIsError.ptr,
                )
            }
        }

        val resultPtr = outResult.value
        val resultLenRaw = outLen.value.toLong()
        // size_t is 64-bit on iOS arm64; ByteArray is Int-indexed. A
        // result larger than Int.MAX_VALUE would silently truncate via
        // .toInt() and then either over- or under-read — fail loudly
        // instead. In practice eval results are bounded by the V8 string
        // limit (~512 MiB), so this only fires on a corrupt out_len.
        if (resultLenRaw < 0 || resultLenRaw > Int.MAX_VALUE) {
            // Free first — even a corrupt-length result was malloc'd by
            // the C side and skal_free_string is the right disposer.
            skal_free_string(resultPtr)
            throw IllegalStateException(
                "Skal: evaluate returned implausible length $resultLenRaw",
            )
        }
        val resultLen = resultLenRaw.toInt()
        val isError = outIsError.value != 0
        val resultStr = if (resultPtr == null || resultLen == 0) {
            ""
        } else {
            // skal_evaluate's contract: out_result is UTF-8 bytes
            // (NOT null-terminated), out_result_len is the byte count.
            // memcpy is significantly faster than the byte-by-byte
            // loop — Apple's libSystem ships a vectorized SIMD
            // implementation. usePinned gives us a stable address for
            // the destination ByteArray; the C source is a heap
            // pointer that's already stable until skal_free_string.
            val bytes = ByteArray(resultLen)
            bytes.usePinned { dstPin ->
                memcpy(
                    dstPin.addressOf(0),
                    resultPtr,
                    resultLen.convert(),
                )
            }
            bytes.decodeToString()
        }
        // skal_free_string is a NOP on NULL by contract, so safe.
        skal_free_string(resultPtr)

        if (isError) {
            // Mirrors the JNI side, which throws for explicit JS
            // exceptions. Caller can catch and inspect the message.
            throw RuntimeException("Skal eval error: $resultStr")
        }
        resultStr
    }

    override fun evaluateModuleAtPath(jsPath: String): String {
        // Mirror Skal.java's loader: build an async IIFE that does
        // `await import("file://...")` and run it through evaluate.
        // The JS-string-literal escaping for jsPath has to handle
        // backslashes and quotes; the Java side does it manually,
        // we use Kotlin's JSON-style encoding via a small helper.
        val escapedPath = jsStringLiteral("file://$jsPath")
        val loader =
            "(async()=>{" +
                "await import($escapedPath);" +
                "return 'skal-app loaded';" +
                "})();"
        return evaluate(loader, "skal:loader")
    }

    override fun acquireBridge(): SkalBuffer = memScoped {
        require(handle != 0L) { "Skal: runtime is closed" }
        // C signature: `void** out_ptr` → CPointer<COpaquePointerVar>.
        // We allocate a COpaquePointerVar in the mem scope, pass its
        // address to the C call, and read back the pointer value the
        // C side wrote into it. The pointer points to the start of
        // the bridge memory (skal_entry.zig owns the allocation).
        val outPtr = alloc<COpaquePointerVar>()
        val outLen = alloc<size_tVar>()
        skal_acquire_bridge(handle, outPtr.ptr, outLen.ptr)
        val rawPtr = outPtr.value
            ?: throw IllegalStateException("Skal: acquireBridge returned null pointer")
        SkalBuffer(rawPtr.reinterpret<UByteVar>(), outLen.value.toInt())
    }

    override fun wakeJs() {
        if (handle == 0L) return
        skal_wake_js(handle)
    }

    override fun close() {
        if (handle != 0L) {
            skal_dispose_runtime(handle)
            handle = 0L
        }
    }
}

/**
 * Encode [s] as a JS string literal — same wire format Skal.java's
 * `jsStringLiteral` uses on the JVM side. Backslash, double-quote,
 * standard control chars, and U+2028/U+2029 (valid in JSON, illegal
 * raw inside JS string literals) all get escaped.
 */
private fun jsStringLiteral(s: String): String {
    val sb = StringBuilder(s.length + 16)
    sb.append('"')
    for (c in s) {
        when (c) {
            '\\' -> sb.append("\\\\")
            '"' -> sb.append("\\\"")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            '\b' -> sb.append("\\b")
            '' -> sb.append("\\f")
            ' ' -> sb.append("\\u2028")
            ' ' -> sb.append("\\u2029")
            else -> if (c.code < 0x20) {
                sb.append("\\u")
                val hex = c.code.toString(16)
                repeat(4 - hex.length) { sb.append('0') }
                sb.append(hex)
            } else {
                sb.append(c)
            }
        }
    }
    sb.append('"')
    return sb.toString()
}
