package com.skal.bridge

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
    val node = bridge.nodes[id] ?: return
    when (node.type) {
        SkalBridge.WT_BOX -> SkalBox(node, bridge)
        SkalBridge.WT_COLUMN -> SkalColumn(node, bridge)
        SkalBridge.WT_ROW -> SkalRow(node, bridge)
        SkalBridge.WT_TEXT -> SkalText(node)
        SkalBridge.WT_BUTTON -> SkalButton(node, bridge)
    }
}

@Composable
private fun SkalBox(node: NodeState, bridge: SkalBridge) {
    Box(modifier = Modifier.padding(4.dp)) {
        // Reading node.children here subscribes us; on add/remove we recompose.
        node.children.forEach { childId ->
            SkalNode(childId, bridge)
        }
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
        node.children.forEach { childId ->
            SkalNode(childId, bridge)
        }
    }
}

@Composable
private fun SkalRow(node: NodeState, bridge: SkalBridge) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        node.children.forEach { childId ->
            SkalNode(childId, bridge)
        }
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
