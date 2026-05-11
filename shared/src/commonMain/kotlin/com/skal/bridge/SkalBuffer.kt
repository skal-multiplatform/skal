package com.skal.bridge

/**
 * Multiplatform byte-addressable view over Skal's shared bridge memory.
 *
 * All multi-byte reads and writes are **little-endian** — that's what
 * `skal_entry.zig` (and JS, via `DataView` calls inside `bridge.js`)
 * writes. JVM impls (android-app + desktop-app) wrap `java.nio.ByteBuffer`
 * with `order(LITTLE_ENDIAN)` set once at construction; iOS impls (Phase 4)
 * will read via cinterop'd `CPointer<ByteVar>` with explicit byte
 * shuffling.
 *
 * The surface area is deliberately minimal — only what [SkalBridge]
 * actually consumes. ByteBuffer's relative-position reads are not
 * exposed here; instead, [copyToByteArray] takes an explicit source
 * offset (matching how `readString` uses it). That avoids the iOS impl
 * having to model ByteBuffer's stateful position cursor.
 */
expect class SkalBuffer {
    /** Read a little-endian u32 at absolute byte [index]. */
    fun getInt(index: Int): Int

    /** Read a little-endian u64 at absolute byte [index]. */
    fun getLong(index: Int): Long

    /** Read a single byte at absolute byte [index]. */
    fun getByte(index: Int): Byte

    /** Bulk-copy [length] bytes from [srcOffset] into [dst]'s start. */
    fun copyToByteArray(dst: ByteArray, srcOffset: Int, length: Int)

    /** Write a single byte at absolute byte [index]. */
    fun putByte(index: Int, value: Byte)

    /** Write a little-endian u32 at absolute byte [index]. */
    fun putInt(index: Int, value: Int)

    /** Write a little-endian u64 at absolute byte [index]. */
    fun putLong(index: Int, value: Long)
}
