package com.skal.bridge

import android.util.SparseArray
import android.util.SparseIntArray
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.snapshots.SnapshotStateList
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
     * One state per JS-created node. Keyed by JS node id (dense small ints,
     * so SparseArray's binary search beats a HashMap on cache pressure).
     *
     * NOT a SnapshotStateMap: nothing recomposes purely because a node was
     * added or removed from this container. The composable tree is driven by
     * each parent's `children` SnapshotStateList — when a parent's children
     * mutate, the parent recomposes and invokes SkalNode(newId), at which
     * point the SparseArray entry for `newId` has already been populated by
     * pumpOps (CREATE_NODE always precedes INSERT_BEFORE in the op stream).
     *
     * Removing the SnapshotStateMap eliminates per-`get` Snapshot read
     * tracking — measurable savings on every op decode and every
     * SkalNode composition.
     */
    val nodes: SparseArray<NodeState> = SparseArray()

    /**
     * Reusable scratch for UTF-8 string decoding in [readStringRef]. Grows
     * on demand. Only touched on the UI thread (pumpOps is called from
     * withFrameNanos), so no synchronization needed.
     */
    private var stringScratch: ByteArray = ByteArray(256)

    /**
     * Exponential moving average of the time spent draining ops, in
     * nanoseconds. Updated only on frames where pumpOps actually drained
     * (not the early-return idle case), so this measures "drain cost when
     * there's work to do" rather than "average cost across all frames" —
     * which is what's interesting for tuning.
     *
     * Read by [com.skal.bench.PerfHud]; not Compose state because the HUD
     * already has a withFrameNanos coroutine that polls it once per frame.
     */
    @Volatile
    var pumpAvgNs: Long = 0L
        private set

    /**
     * Worst single drain time across the last [PUMP_PEAK_WINDOW] drains, in
     * nanoseconds. The EMA above smooths spikes into invisibility — useful
     * for steady-state, but it hides hitches. This is the complement: a
     * spike of e.g. 5 ms appears immediately and persists until 60 newer
     * drains push it out of the ring.
     */
    @Volatile
    var pumpPeakNs: Long = 0L
        private set

    /**
     * Sliding window of recent drain times. Each drain writes to the next
     * slot; we recompute the max across the live entries on every drain.
     * 60 entries × O(1) write + O(60) max scan = ~600 ns per drain — well
     * under the cost of the drain itself.
     */
    private val pumpWindow = LongArray(PUMP_PEAK_WINDOW)
    private var pumpWindowIdx = 0
    private var pumpWindowFill = 0

    /**
     * Defensive root fallback: if the JS app forgot to create node 1, treat
     * it as an empty Column so SkalRoot at least mounts.
     */
    fun ensureRoot() {
        if (nodes.get(ROOT_NODE_ID) == null) {
            nodes.put(ROOT_NODE_ID, NodeState(WT_COLUMN))
        }
    }

    /**
     * Drain any new ops the JS side has committed. Call from a per-frame
     * Compose effect (`withFrameNanos`).
     */
    fun pumpOps() {
        val seq = readSeq(buffer, H_OP_SEQ_OFFSET)
        if (seq == lastOpSeq) return

        // Time only the actually-draining frames. The seq-equal early return
        // above is a single 64-bit load + compare; tracking that case in the
        // EMA would just dilute the meaningful "drain cost" signal.
        val tStart = System.nanoTime()

        val writePos = buffer.getInt(H_OP_WRITE_POS_OFFSET)

        // Hoist into locals so the JIT doesn't re-fetch fields each iter.
        val buf = buffer
        val ns = nodes
        val opEnd = OP_RING_OFFSET + writePos
        val strBase = STRING_HEAP_OFFSET
        var p = OP_RING_OFFSET
        while (p < opEnd) {
            // Reader only consumes byte 0 of the opcode field; the writer
            // packs the high 24 bits as zero.
            val opcode = buf.get(p).toInt() and 0xff
            val a = buf.getInt(p + 4)
            val b = buf.getInt(p + 8)
            val c = buf.getInt(p + 12)
            when (opcode) {
                OP_CREATE_NODE -> ns.put(a, NodeState(b))
                OP_REMOVE_NODE -> removeSubtree(a, ns)
                OP_INSERT_BEFORE -> {
                    val parent = ns.get(a)
                    if (parent != null) {
                        // Auto-detach: Solid's keyed-list reordering relies on
                        // DOM-style insertNode semantics — moving a node by
                        // re-inserting without first calling removeNode. Our
                        // bridge has to enforce the "node id appears in at most
                        // one parent's children list at a time" invariant
                        // ourselves; the DOM does it implicitly. Without this,
                        // any reorder would leave the moving id duplicated in
                        // both old and new parents.
                        val movingNode = ns.get(b)
                        if (movingNode != null) {
                            val oldParentId = movingNode.parent.value
                            if (oldParentId != 0) {
                                ns.get(oldParentId)?.children?.let { oldChildren ->
                                    val oldIdx = oldChildren.lastIndexOf(b)
                                    if (oldIdx >= 0) oldChildren.removeAt(oldIdx)
                                }
                            }
                        }
                        val children = parent.children
                        val anchor = c
                        if (anchor == 0) {
                            children.add(b)
                        } else {
                            val idx = children.indexOf(anchor)
                            if (idx >= 0) children.add(idx, b) else children.add(b)
                        }
                        movingNode?.parent?.value = a
                    }
                }
                OP_SET_PROP_U32 -> ns.get(a)?.props?.put(b, c)
                OP_SET_PROP_F32 -> ns.get(a)?.propsF?.put(b, java.lang.Float.intBitsToFloat(c))
                OP_SET_TEXT -> ns.get(a)?.text?.value = readString(buf, strBase, b, c)
                OP_BIND_HANDLER -> {
                    val node = ns.get(a)
                    if (node != null) {
                        when (b) {
                            EV_CLICK -> node.onClickHandlerId.value = c
                            EV_CHANGE -> node.onChangeHandlerId.value = c
                        }
                    }
                }
            }
            p += 16
        }
        lastOpSeq = seq

        val dt = System.nanoTime() - tStart

        // EMA with α=1/8 — smooths jitter while staying responsive enough
        // that a sudden +1000-batch frame visibly bumps the displayed value.
        // Single-write to a @Volatile Long is atomic on ARM64.
        val prev = pumpAvgNs
        pumpAvgNs = if (prev == 0L) dt else (prev * 7 + dt) / 8

        // Peak: write to the next ring slot, then recompute max across the
        // live entries. Spikes appear in the displayed peak immediately and
        // age out after PUMP_PEAK_WINDOW newer drains.
        val win = pumpWindow
        win[pumpWindowIdx] = dt
        pumpWindowIdx = (pumpWindowIdx + 1) % win.size
        if (pumpWindowFill < win.size) pumpWindowFill++
        var max = 0L
        var i = 0
        val n = pumpWindowFill
        while (i < n) {
            val v = win[i]
            if (v > max) max = v
            i++
        }
        pumpPeakNs = max
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

    /**
     * Read a UTF-8 string from the string heap at [offset], length [length].
     * Wire format: SET_TEXT op carries `b = offset` and `c = length` directly
     * — no u16|u16 packing, so a single frame can address the full string
     * heap (used to be capped at 64 KiB per frame).
     */
    private fun readString(buf: ByteBuffer, base: Int, offset: Int, length: Int): String {
        if (length == 0) return ""
        // Reuse the per-bridge scratch — pumpOps is the only consumer and runs
        // exclusively on the UI thread (withFrameNanos), so no synchronization.
        var scratch = stringScratch
        if (scratch.size < length) {
            scratch = ByteArray(maxOf(length, scratch.size * 2))
            stringScratch = scratch
        }
        // Bulk relative read is the fastest path for DirectByteBuffer (no
        // backing array). No save/restore of position: nothing else in
        // pumpOps reads relatively, and the next pumpOps call will set its
        // own absolute reads.
        buf.position(base + offset)
        buf.get(scratch, 0, length)
        // String constructor copies into its own char[]; scratch is free for
        // immediate reuse on the next op.
        return String(scratch, 0, length, Charsets.UTF_8)
    }

    /**
     * Worklist-DFS scratch — owned by [removeSubtree], reused across calls.
     * IntArray (not Deque) so push/pop are no-allocation and cache-friendly.
     * Grows on demand (doubles when full); never shrinks. UI thread only,
     * no synchronization needed.
     */
    private var removeStack: IntArray = IntArray(64)

    /**
     * Remove a node and all its descendants from the [nodes] map, and detach
     * the subtree root from its parent's children list.
     *
     * Why both: keeping the dead id in the parent's children would grow that
     * list forever (Compose recompose work degrades; SkalNode early-returns
     * on null); keeping the [NodeState] entries in [nodes] would leak memory.
     * The two representations have to agree.
     *
     * Iterative (worklist-based) rather than recursive — bounded by JVM heap
     * via the [removeStack] IntArray, not by thread stack. Today's UI trees
     * are <5 deep so it's purely defensive against future deep nests.
     *
     * Order across the subtree doesn't matter — these are flat-map deletes
     * from [nodes], no parent-cleanup-after-children dependency.
     */
    private fun removeSubtree(id: Int, ns: SparseArray<NodeState>) {
        val rootNode = ns.get(id) ?: return

        // Detach the subtree root from its parent's children list — the only
        // "outward" mutation. Use lastIndexOf because JS shrink-loops walk in
        // reverse, putting the target id at the tail; lastIndexOf finds it
        // in one step, and removeAt(last) is O(1) on PersistentList. Reverse
        // removals become O(N) total instead of O(N²).
        val parentId = rootNode.parent.value
        if (parentId != 0) {
            val parent = ns.get(parentId)
            if (parent != null) {
                val idx = parent.children.lastIndexOf(id)
                if (idx >= 0) parent.children.removeAt(idx)
            }
        }

        // Worklist DFS. Push the root; loop popping nodes, pushing their
        // children, dropping each from the map.
        var stack = removeStack
        var top = 0
        stack[top++] = id

        while (top > 0) {
            val cur = stack[--top]
            val curNode = ns.get(cur) ?: continue
            val children = curNode.children
            val n = children.size

            // Ensure capacity before bulk-pushing children. Double-and-retry
            // until the new size accommodates them — amortized O(1) per push.
            if (top + n > stack.size) {
                var newSize = stack.size * 2
                while (top + n > newSize) newSize *= 2
                stack = stack.copyOf(newSize)
                removeStack = stack
            }
            for (i in 0 until n) stack[top++] = children[i]
            children.clear()
            ns.remove(cur)
        }
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

        /** Window size for [pumpPeakNs] — 60 drains ≈ a few seconds of clicks. */
        const val PUMP_PEAK_WINDOW = 60

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
        const val WT_SCROLL_COLUMN = 5

        // Event kinds (u32 in JS, byte here)
        const val EV_CLICK = 0x01
        const val EV_CHANGE = 0x02
        const val EV_CLICK_BYTE = 0x01.toByte()
    }
}

/**
 * Per-node state.
 *
 * The fields actually read by composables ([text], [children],
 * [onClickHandlerId], [onChangeHandlerId]) are Compose snapshot states, so
 * reading them inside a composable subscribes that composable to *that
 * specific* MutableState — a SET_TEXT op recomposes only the matching Text
 * leaf.
 *
 * [props] / [propsF] are write-only from Compose's perspective today: they
 * exist for the wire format but no composable reads them. They're stored in
 * non-reactive containers ([SparseIntArray] / [HashMap]) so OP_SET_PROP_*
 * writes don't pay Snapshot bookkeeping. If a future composable starts
 * reading them, switch back to a reactive container at that point.
 */
class NodeState(val type: Int) {
    val parent = mutableStateOf(0)
    val text = mutableStateOf("")
    val children: SnapshotStateList<Int> = mutableStateListOf()
    val onClickHandlerId = mutableStateOf(0)
    val onChangeHandlerId = mutableStateOf(0)
    val props: SparseIntArray = SparseIntArray()
    val propsF: HashMap<Int, Float> = HashMap()
}
