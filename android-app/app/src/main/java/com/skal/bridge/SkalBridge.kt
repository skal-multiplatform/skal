package com.skal.bridge

import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.snapshots.SnapshotStateMap
import com.skal.Skal
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Skal ↔ Compose bridge. Owns the shared 2 MiB DirectByteBuffer that bun's
 * worker thread writes ops into. On each Compose frame, [pumpOps] is called
 * to drain the op ring and push mutations into compose-observable state.
 *
 * Layout (must match assets/skal-app.js + skal_entry.zig):
 *   [Header 64B][Op ring 1 MiB][String heap 512 KiB][Event ring 64 KiB]
 */
class SkalBridge(private val skal: Skal) {
    private val buffer: ByteBuffer = skal.acquireBridge().order(ByteOrder.LITTLE_ENDIAN)

    private var lastOpSeq: Long = 0L

    /**
     * One state per JS-created node. JS emits ops; we mutate the matching
     * NodeState's MutableStates. Compose's recomposer observes only the
     * specific MutableState a composable read, so a SET_TEXT only re-renders
     * that one Text composable — no tree walking.
     */
    val nodes: SnapshotStateMap<Int, NodeState> = mutableStateMapOf()

    /**
     * Defensive root fallback: if the JS app forgot to create node 1, treat
     * it as an empty Column so SkalRoot at least mounts.
     */
    fun ensureRoot() {
        if (!nodes.containsKey(ROOT_NODE_ID)) {
            nodes[ROOT_NODE_ID] = NodeState(WT_COLUMN)
        }
    }

    /**
     * Drain any new ops the JS side has committed. Call from a per-frame
     * Compose effect (`withFrameNanos`).
     */
    fun pumpOps() {
        val seq = readSeq(buffer, H_OP_SEQ_OFFSET)
        if (seq == lastOpSeq) return
        val writePos = buffer.getInt(H_OP_WRITE_POS_OFFSET)

        val opEnd = OP_RING_OFFSET + writePos
        val strBase = STRING_HEAP_OFFSET
        var p = OP_RING_OFFSET
        while (p < opEnd) {
            val opcode = buffer.get(p).toInt() and 0xff
            val a = buffer.getInt(p + 4)
            val b = buffer.getInt(p + 8)
            val c = buffer.getInt(p + 12)
            when (opcode) {
                OP_CREATE_NODE -> {
                    val widgetType = b
                    nodes[a] = NodeState(widgetType)
                }
                OP_REMOVE_NODE -> nodes.remove(a)
                OP_INSERT_BEFORE -> {
                    val parent = nodes[a]
                    if (parent != null) {
                        val anchor = c
                        if (anchor == 0) parent.children.add(b)
                        else {
                            val idx = parent.children.indexOf(anchor)
                            if (idx >= 0) parent.children.add(idx, b)
                            else parent.children.add(b)
                        }
                        nodes[b]?.parent?.value = a
                    }
                }
                OP_SET_PROP_U32 -> nodes[a]?.props?.put(b, c)
                OP_SET_PROP_F32 -> nodes[a]?.propsF?.put(b, java.lang.Float.intBitsToFloat(c))
                OP_SET_TEXT -> nodes[a]?.text?.value = readStringRef(buffer, strBase, c)
                OP_BIND_HANDLER -> {
                    val node = nodes[a] ?: continue.also {}
                    when (b) {
                        EV_CLICK -> node.onClickHandlerId.value = c
                        EV_CHANGE -> node.onChangeHandlerId.value = c
                    }
                }
            }
            p += 16
        }
        lastOpSeq = seq
    }

    /**
     * Compose calls this from an onClick. Writes an event record to the
     * event ring and wakes the JS thread (single JNI call).
     */
    fun dispatchEvent(handlerId: Int, eventKind: Byte = EV_CLICK_BYTE) {
        if (handlerId == 0) return
        val pos = buffer.getInt(H_EVENT_WRITE_POS_OFFSET)
        val base = EVENT_RING_OFFSET + pos
        buffer.put(base, eventKind)
        buffer.putInt(base + 4, handlerId)
        val newPos = (pos + 16) % EVENT_RING_SIZE
        buffer.putInt(H_EVENT_WRITE_POS_OFFSET, newPos)
        val current = buffer.getLong(H_EVENT_SEQ_OFFSET)
        buffer.putLong(H_EVENT_SEQ_OFFSET, current + 1)
        skal.wakeJs()
    }

    private fun readStringRef(buf: ByteBuffer, base: Int, packed: Int): String {
        val offset = (packed ushr 16) and 0xFFFF
        val length = packed and 0xFFFF
        if (length == 0) return ""
        val bytes = ByteArray(length)
        // Slice into a temp ByteArray; encoding is UTF-8 from JS TextEncoder.
        val savedPos = buf.position()
        buf.position(base + offset)
        buf.get(bytes)
        buf.position(savedPos)
        return String(bytes, Charsets.UTF_8)
    }

    private fun readSeq(buf: ByteBuffer, offset: Int): Long {
        // VarHandle would be more correct for atomic load; for our writer-
        // bumps-once-per-frame model, plain getLong is fine — the cache-line
        // visibility is established by the per-frame commit barrier on the
        // JS side (Atomics.store provides the happens-before).
        return buf.getLong(offset)
    }

    companion object {
        const val ROOT_NODE_ID = 1

        // Header layout
        const val H_OP_SEQ_OFFSET = 0
        const val H_OP_WRITE_POS_OFFSET = 8
        const val H_STR_WRITE_POS_OFFSET = 12
        const val H_EVENT_SEQ_OFFSET = 16
        const val H_EVENT_WRITE_POS_OFFSET = 24
        const val H_EVENT_READ_POS_OFFSET = 28

        const val HEADER_SIZE = 64
        const val OP_RING_OFFSET = HEADER_SIZE
        const val OP_RING_SIZE = 1024 * 1024
        const val STRING_HEAP_OFFSET = OP_RING_OFFSET + OP_RING_SIZE
        const val STRING_HEAP_SIZE = 512 * 1024
        const val EVENT_RING_OFFSET = STRING_HEAP_OFFSET + STRING_HEAP_SIZE
        const val EVENT_RING_SIZE = (2 * 1024 * 1024) - EVENT_RING_OFFSET

        // Opcodes
        const val OP_CREATE_NODE = 0x01
        const val OP_REMOVE_NODE = 0x02
        const val OP_INSERT_BEFORE = 0x03
        const val OP_SET_PROP_U32 = 0x10
        const val OP_SET_PROP_F32 = 0x11
        const val OP_SET_TEXT = 0x14
        const val OP_BIND_HANDLER = 0x15

        // Widget types
        const val WT_BOX = 0
        const val WT_COLUMN = 1
        const val WT_ROW = 2
        const val WT_TEXT = 3
        const val WT_BUTTON = 4

        // Event kinds (u32 in JS, byte here)
        const val EV_CLICK = 0x01
        const val EV_CHANGE = 0x02
        const val EV_CLICK_BYTE = 0x01.toByte()
    }
}

/**
 * Per-node observable state. Each MutableState here is a Compose Snapshot
 * state, so reading it inside a composable subscribes that composable for
 * recomposition when the value changes — and only when *that* state changes,
 * not the whole tree.
 */
class NodeState(val type: Int) {
    val parent = mutableStateOf(0)
    val text = mutableStateOf("")
    val children: SnapshotStateList<Int> = mutableStateListOf()
    val onClickHandlerId = mutableStateOf(0)
    val onChangeHandlerId = mutableStateOf(0)
    val props: SnapshotStateMap<Int, Int> = mutableStateMapOf()
    val propsF: SnapshotStateMap<Int, Float> = mutableStateMapOf()
}
