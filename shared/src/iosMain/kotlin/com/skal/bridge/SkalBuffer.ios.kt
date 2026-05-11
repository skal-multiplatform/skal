package com.skal.bridge

import kotlinx.cinterop.CPointer
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.UByteVar
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.get
import kotlinx.cinterop.interpretCPointer
import kotlinx.cinterop.rawValue
import kotlinx.cinterop.set
import kotlinx.cinterop.usePinned
import platform.posix.memcpy

/**
 * iOS `actual` for [SkalBuffer] — backed by a raw C pointer + length
 * obtained from [com.skal.SkalRuntime.acquireBridge] (which calls
 * `skal_acquire_bridge` via cinterop).
 *
 * All reads/writes are little-endian regardless of host byte order
 * (iOS arm64 is little-endian, but we don't rely on that — explicit
 * byte shuffles keep this aligned with the JVM impl's
 * `ByteBuffer.order(LITTLE_ENDIAN)` contract).
 *
 * No alignment assumption: each multi-byte access reads byte-by-byte
 * and shifts. Cheap on arm64 — the compiler folds the byte loads into
 * a single ldr with a bswap when possible. Avoids the
 * unaligned-load-via-CPointer<IntVar>-indexing footgun where index 1
 * of an IntVar pointer means byte offset 4, not byte offset 1.
 *
 * **Bounds checking**: every accessor validates that the requested
 * range fits inside [size] and throws [IndexOutOfBoundsException] on
 * violation. The JVM impl gets this for free from `ByteBuffer.getInt`
 * etc.; on iOS the underlying [CPointer] has no length carried with it,
 * so we'd otherwise read/write past the end of the bridge region —
 * silently corrupting whatever heap happens to live there. The checks
 * compile to a single `cmp` + `b.hi` per call on arm64; both branches
 * are well-predicted (the unhappy branch never fires in well-behaved
 * code), so cost is in the noise compared with the byte-shuffle work
 * the accessor does anyway.
 */
@OptIn(ExperimentalForeignApi::class)
actual class SkalBuffer(
    internal val ptr: CPointer<UByteVar>,
    internal val size: Int,
) {
    actual fun getInt(index: Int): Int {
        checkRange(index, 4)
        val p = ptr
        return (p[index].toInt() and 0xFF) or
            ((p[index + 1].toInt() and 0xFF) shl 8) or
            ((p[index + 2].toInt() and 0xFF) shl 16) or
            ((p[index + 3].toInt() and 0xFF) shl 24)
    }

    actual fun getLong(index: Int): Long {
        checkRange(index, 8)
        val p = ptr
        // Build a little-endian Long via two getInt halves.
        val lo = (p[index].toLong() and 0xFF) or
            ((p[index + 1].toLong() and 0xFF) shl 8) or
            ((p[index + 2].toLong() and 0xFF) shl 16) or
            ((p[index + 3].toLong() and 0xFF) shl 24)
        val hi = (p[index + 4].toLong() and 0xFF) or
            ((p[index + 5].toLong() and 0xFF) shl 8) or
            ((p[index + 6].toLong() and 0xFF) shl 16) or
            ((p[index + 7].toLong() and 0xFF) shl 24)
        return lo or (hi shl 32)
    }

    actual fun getByte(index: Int): Byte {
        checkRange(index, 1)
        return ptr[index].toByte()
    }

    actual fun copyToByteArray(dst: ByteArray, srcOffset: Int, length: Int) {
        if (length == 0) return
        checkRange(srcOffset, length)
        if (length < 0 || length > dst.size) {
            throw IndexOutOfBoundsException(
                "SkalBuffer.copyToByteArray: length=$length, dst.size=${dst.size}",
            )
        }
        // Pin the destination so we can hand its raw address to memcpy.
        // Pinning is cheap (no copy on Kotlin/Native) and ends with the
        // closure scope.
        dst.usePinned { pinned ->
            memcpy(
                pinned.addressOf(0),
                interpretCPointer<UByteVar>(ptr.rawValue + srcOffset.toLong()),
                length.toULong(),
            )
        }
    }

    actual fun putByte(index: Int, value: Byte) {
        checkRange(index, 1)
        ptr[index] = value.toUByte()
    }

    actual fun putInt(index: Int, value: Int) {
        checkRange(index, 4)
        val p = ptr
        p[index] = (value and 0xFF).toUByte()
        p[index + 1] = ((value ushr 8) and 0xFF).toUByte()
        p[index + 2] = ((value ushr 16) and 0xFF).toUByte()
        p[index + 3] = ((value ushr 24) and 0xFF).toUByte()
    }

    actual fun putLong(index: Int, value: Long) {
        checkRange(index, 8)
        val p = ptr
        p[index] = (value and 0xFF).toUByte()
        p[index + 1] = ((value ushr 8) and 0xFF).toUByte()
        p[index + 2] = ((value ushr 16) and 0xFF).toUByte()
        p[index + 3] = ((value ushr 24) and 0xFF).toUByte()
        p[index + 4] = ((value ushr 32) and 0xFF).toUByte()
        p[index + 5] = ((value ushr 40) and 0xFF).toUByte()
        p[index + 6] = ((value ushr 48) and 0xFF).toUByte()
        p[index + 7] = ((value ushr 56) and 0xFF).toUByte()
    }

    /**
     * Single check used by every accessor. The check is `Int` arithmetic
     * — `index + len` could overflow near Int.MAX_VALUE, so we phrase
     * it as `index > size - len` and also guard `index < 0` / `len < 0`
     * to keep the comparison well-defined under wraparound.
     *
     * Not `inline` — Kotlin's inliner only meaningfully helps when the
     * function takes lambdas, and the AOT/JIT compilers already inline
     * small private functions on hot paths. Keeps the call site's stack
     * frame pointing at the accessor that actually failed (good for
     * crash reports), at no measurable runtime cost.
     */
    private fun checkRange(index: Int, len: Int) {
        if (index < 0 || len < 0 || index > size - len) {
            throw IndexOutOfBoundsException(
                "SkalBuffer access out of range: index=$index len=$len size=$size",
            )
        }
    }
}
