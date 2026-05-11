package com.skal.bridge

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

/**
 * Root composable. Walks the bridge's reactive node map, materializing a
 * Compose subtree per JS-created node. Each composable subscribes only
 * to the specific MutableStates it reads (text, children, handler ID),
 * so an op like SET_TEXT triggers a single Text recompose.
 *
 * Compose's slot table memoizes by call site + key; calling [SkalNode]
 * with the same id keeps the same slot, keeps the same ComposeNode,
 * doesn't tear it down on unrelated updates.
 */
@Composable
fun SkalRoot(bridge: SkalBridge) {
    // Drain ops once per frame, before recomposition decisions.
    // withFrameNanos suspends until the next frame is being prepared by
    // the Choreographer — this is the same hook Compose's animation system
    // uses, so it stays vsync-aligned.
    LaunchedEffect(bridge) {
        while (true) {
            androidx.compose.runtime.withFrameNanos {
                bridge.pumpOps()
            }
        }
    }

    SkalNode(SkalBridge.ROOT_NODE_ID, bridge)
}

@Composable
private fun SkalNode(id: Int, bridge: SkalBridge) {
    // SparseArray.get is a non-tracked read — that's fine, because the parent
    // composable subscribes to its `children` list (a SnapshotStateList), so
    // any new id inserted into a parent's children triggers the parent to
    // recompose, which calls SkalNode(newId) where the SparseArray entry has
    // already been populated by pumpOps before the snapshot was applied.
    val node = bridge.nodes.get(id) ?: return
    when (node.type) {
        SkalBridge.WT_BOX -> SkalBox(node, bridge)
        SkalBridge.WT_COLUMN -> SkalColumn(node, bridge)
        SkalBridge.WT_SCROLL_COLUMN -> SkalScrollColumn(node, bridge)
        SkalBridge.WT_ROW -> SkalRow(node, bridge)
        SkalBridge.WT_TEXT -> SkalText(node)
        SkalBridge.WT_BUTTON -> SkalButton(node, bridge)
    }
}

/**
 * Iterate `node.children` and emit one [SkalNode] per child, keyed by child
 * id. Two performance details:
 *
 *  • `key(childId)` is load-bearing. Compose memoizes by call site, so
 *    without an explicit key, inserting/removing a child shifts every
 *    subsequent slot and Compose tears down all later children to rebuild
 *    them. With `key(childId)`, Compose moves slots around instead.
 *
 *  • Indexed access (`children[i]`) avoids the per-recompose Iterator
 *    allocation that `forEach`/`for-each` desugars to. Reading `.size` and
 *    each index both subscribe via Snapshot the same way, so observability
 *    is preserved.
 */
@Composable
private fun SkalChildren(node: NodeState, bridge: SkalBridge) {
    val children = node.children
    val n = children.size
    var i = 0
    while (i < n) {
        val childId = children[i]
        key(childId) {
            SkalNode(childId, bridge)
        }
        i++
    }
}

@Composable
private fun SkalBox(node: NodeState, bridge: SkalBridge) {
    Box(modifier = Modifier.padding(4.dp)) {
        SkalChildren(node, bridge)
    }
}

@Composable
private fun SkalColumn(node: NodeState, bridge: SkalBridge) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
    ) {
        SkalChildren(node, bridge)
    }
}

/**
 * A vertically scrollable Column. Use for the root container when content
 * may exceed the viewport (e.g. long lists). Wraps a regular Column in
 * [verticalScroll] with a remembered ScrollState so position survives
 * recompositions.
 *
 * Important: don't nest a SkalScrollColumn inside another scrollable layout
 * — Compose throws on nested verticalScroll. For now we use this only at
 * the root.
 */
@Composable
private fun SkalScrollColumn(node: NodeState, bridge: SkalBridge) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        SkalChildren(node, bridge)
    }
}

@Composable
private fun SkalRow(node: NodeState, bridge: SkalBridge) {
    // Horizontally scrollable so a wide row of buttons doesn't get clipped.
    // Scroll axis is orthogonal to the parent SkalScrollColumn's vertical
    // scroll, so Compose handles the nesting cleanly.
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.horizontalScroll(rememberScrollState()),
    ) {
        SkalChildren(node, bridge)
    }
}

@Composable
private fun SkalText(node: NodeState) {
    // Reading node.text subscribes us. SET_TEXT op flips this MutableState;
    // only this Text recomposes. Cheapest possible recompose unit.
    Text(
        text = node.text.value,
        fontFamily = FontFamily.Monospace,
    )
}

@Composable
private fun SkalButton(node: NodeState, bridge: SkalBridge) {
    Button(onClick = { bridge.dispatchEvent(node.onClickHandlerId.value) }) {
        Text(node.text.value)
    }
}
