package com.skal.bridge

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Root composable. Walks the bridge's reactive node map, materializing a
 * Compose subtree per JS-created node. Each composable subscribes only
 * to the specific MutableStates it reads (text, children, handler ID,
 * `propsVersion` for cold props, individual hot-prop states inside a
 * `graphicsLayer` block) — so a single SET_TEXT op recomposes one Text,
 * a single OP_SET_PROP_U32 op recomposes one node's body, and a single
 * OP_SET_OPACITY skips composition entirely and only updates a GPU layer.
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
            withFrameNanos {
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
    // recompose, which calls SkalNode(newId) where the entry has already
    // been populated by pumpOps before the snapshot was applied.
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
 * id.
 *
 *  • `key(childId)` is load-bearing — without it, Compose memoizes by call
 *    site only, and inserting/removing a child shifts every subsequent slot,
 *    tearing down all later children. With `key(childId)`, Compose moves
 *    slots around instead.
 *
 *  • Indexed access (`children[i]`) avoids the per-recompose Iterator
 *    allocation that `forEach` desugars to. Reading `.size` and each index
 *    both subscribe via Snapshot, so observability is preserved.
 *
 *  • This composable does NOT read `propsVersion` — children rendering is
 *    independent of the parent's styling. A bg-color change to the parent
 *    must not cascade into a re-emit of the whole children list.
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

// ─────────────────────────────────────────────────────────────────────────
// Modifier helpers
//
// Pulled out as private file-level functions (not methods on Modifier)
// because Kotlin inlines them aggressively and they're free of @Composable
// machinery — no slot-table cost per call.
// ─────────────────────────────────────────────────────────────────────────

private fun applyWidth(m: Modifier, v: Int): Modifier = when (v) {
    SkalBridge.NO_VALUE     -> m
    SkalBridge.FILL_MAX     -> m.fillMaxWidth()
    SkalBridge.WRAP_CONTENT -> m.wrapContentWidth()
    else                    -> m.width(v.dp)
}

private fun applyHeight(m: Modifier, v: Int): Modifier = when (v) {
    SkalBridge.NO_VALUE     -> m
    SkalBridge.FILL_MAX     -> m.fillMaxHeight()
    SkalBridge.WRAP_CONTENT -> m.wrapContentHeight()
    else                    -> m.height(v.dp)
}

private fun verticalArrangement(alignment: Int, gap: Int): Arrangement.Vertical = when (alignment) {
    SkalBridge.ALIGN_CENTER        -> Arrangement.Center
    SkalBridge.ALIGN_END           -> Arrangement.Bottom
    SkalBridge.ALIGN_SPACE_BETWEEN -> Arrangement.SpaceBetween
    SkalBridge.ALIGN_SPACE_AROUND  -> Arrangement.SpaceAround
    SkalBridge.ALIGN_SPACE_EVENLY  -> Arrangement.SpaceEvenly
    else                           -> if (gap > 0) Arrangement.spacedBy(gap.dp) else Arrangement.Top
}

private fun horizontalArrangement(alignment: Int, gap: Int): Arrangement.Horizontal = when (alignment) {
    SkalBridge.ALIGN_CENTER        -> Arrangement.Center
    SkalBridge.ALIGN_END           -> Arrangement.End
    SkalBridge.ALIGN_SPACE_BETWEEN -> Arrangement.SpaceBetween
    SkalBridge.ALIGN_SPACE_AROUND  -> Arrangement.SpaceAround
    SkalBridge.ALIGN_SPACE_EVENLY  -> Arrangement.SpaceEvenly
    else                           -> if (gap > 0) Arrangement.spacedBy(gap.dp) else Arrangement.Start
}

private fun fontFamilyFor(value: Int): FontFamily = when (value) {
    1    -> FontFamily.Serif
    2    -> FontFamily.Monospace
    3    -> FontFamily.SansSerif
    else -> FontFamily.Default
}

private fun textAlignFor(value: Int): TextAlign = when (value) {
    1    -> TextAlign.Center
    2    -> TextAlign.End
    3    -> TextAlign.Justify
    else -> TextAlign.Start
}

private fun textOverflowFor(value: Int): TextOverflow = when (value) {
    1    -> TextOverflow.Ellipsis
    2    -> TextOverflow.Visible
    else -> TextOverflow.Clip
}

/**
 * Append a `graphicsLayer { … }` modifier that reads the 6 hot-prop
 * states (opacity, translate, scale, rotation). State reads inside the
 * layer block are tracked at the GPU-layer level, NOT the composable
 * level — changes to these props update the GPU layer property without
 * recomposing the surrounding composable or re-running layout.
 *
 * Always-on layer: making it conditional on "any hot prop != default"
 * would require reading those states in the composable body, which
 * would subscribe the composable to them — exactly what we're trying to
 * avoid. The per-node memory cost is small; the win when any animation
 * runs on the node is large (zero composition, zero layout, just a
 * single layer-property update on the GPU).
 *
 * Inline so the lambda capture stays close to its single call site
 * inside each primitive composable.
 */
private fun Modifier.skalHotLayer(node: NodeState): Modifier = this.graphicsLayer {
    alpha        = node.opacity.value
    translationX = node.translationX.value
    translationY = node.translationY.value
    scaleX       = node.scaleX.value
    scaleY       = node.scaleY.value
    rotationZ    = node.rotationZ.value
}

/**
 * Apply the visual + per-side-padding cold props that every primitive
 * composable wants in the same shape. Reads cold props in a fixed order:
 *
 *   width → height → corner clip → border → background → padding
 *
 * Order matters in Compose: `clip` before `background` makes the bg
 * follow the corner radius; `padding` after `background` keeps the bg
 * extending to the node's outer bounds rather than being inset.
 *
 * `defaultPadding` is consumed only when no PROP_PADDING* is set —
 * lets containers (Column, ScrollColumn) keep their historical 16dp
 * default without imposing it on Box/Row where the developer typically
 * sets padding explicitly.
 *
 * Caller MUST have read `node.propsVersion.value` before invoking this —
 * otherwise the recompose subscription is missing and the cold-prop
 * reads will silently go stale.
 */
private fun Modifier.skalColdVisual(node: NodeState, defaultPadding: Int = 0): Modifier {
    var m = this

    val cornerRadius = node.props.getOrDefault(SkalBridge.PROP_CORNER_RADIUS, 0)
    if (cornerRadius > 0) m = m.clip(RoundedCornerShape(cornerRadius.dp))

    val borderWidth = node.props.getOrDefault(SkalBridge.PROP_BORDER_WIDTH, 0)
    if (borderWidth > 0) {
        val borderColor = node.props.getOrDefault(SkalBridge.PROP_BORDER_COLOR, 0xFF000000.toInt())
        val color = Color(borderColor.toLong() and 0xFFFFFFFFL)
        m = if (cornerRadius > 0) {
            m.border(borderWidth.dp, color, RoundedCornerShape(cornerRadius.dp))
        } else {
            m.border(borderWidth.dp, color)
        }
    }

    val bg = node.props.getOrDefault(SkalBridge.PROP_BG_COLOR, 0)
    if (bg != 0) m = m.background(Color(bg.toLong() and 0xFFFFFFFFL))

    // Padding — per-side overrides win when present; otherwise fall back
    // to all-sides; otherwise the caller's default.
    val paddingAll = node.props.getOrDefault(SkalBridge.PROP_PADDING, defaultPadding)
    val padTop = node.props.getOrDefault(SkalBridge.PROP_PADDING_TOP, -1)
    val padRight = node.props.getOrDefault(SkalBridge.PROP_PADDING_RIGHT, -1)
    val padBottom = node.props.getOrDefault(SkalBridge.PROP_PADDING_BOTTOM, -1)
    val padLeft = node.props.getOrDefault(SkalBridge.PROP_PADDING_LEFT, -1)
    if (padTop >= 0 || padRight >= 0 || padBottom >= 0 || padLeft >= 0) {
        m = m.padding(
            start  = (if (padLeft   >= 0) padLeft   else paddingAll).dp,
            top    = (if (padTop    >= 0) padTop    else paddingAll).dp,
            end    = (if (padRight  >= 0) padRight  else paddingAll).dp,
            bottom = (if (padBottom >= 0) padBottom else paddingAll).dp,
        )
    } else if (paddingAll > 0) {
        m = m.padding(paddingAll.dp)
    }

    return m
}

// ─────────────────────────────────────────────────────────────────────────
// Primitive composables — each reads `propsVersion` once to subscribe,
// then composes its modifier chain inline via `.skalColdVisual(node)` +
// `.skalHotLayer(node)`. No `remember` caching of the chain: with
// `@Stable` on NodeState, the only thing that can drag a composable
// into a recompose is its own state changing, which means the rebuild
// was going to happen anyway.
//
// Per-widget defaults (default width/padding/alignment/gap) are kept
// inline at each call site since they differ — Column defaults to
// fillMaxWidth + 16dp padding + 8dp gap; Box has no defaults; etc.
// ─────────────────────────────────────────────────────────────────────────

@Composable
private fun SkalBox(node: NodeState, bridge: SkalBridge) {
    node.propsVersion.value
    val width = node.props.getOrDefault(SkalBridge.PROP_WIDTH, SkalBridge.NO_VALUE)
    val height = node.props.getOrDefault(SkalBridge.PROP_HEIGHT, SkalBridge.NO_VALUE)
    val m = applyHeight(applyWidth(Modifier, width), height)
        .skalColdVisual(node)
        .skalHotLayer(node)
    Box(modifier = m) {
        SkalChildren(node, bridge)
    }
}

@Composable
private fun SkalColumn(node: NodeState, bridge: SkalBridge) {
    node.propsVersion.value

    // SkalColumn historically defaulted to fillMaxWidth + padding(16dp) +
    // gap(8dp). Preserve those as defaults so apps that haven't been
    // migrated to set styles render the same shape as before.
    val width = node.props.getOrDefault(SkalBridge.PROP_WIDTH, SkalBridge.FILL_MAX)
    val height = node.props.getOrDefault(SkalBridge.PROP_HEIGHT, SkalBridge.NO_VALUE)
    val alignment = node.props.getOrDefault(SkalBridge.PROP_ALIGNMENT, -1)
    val gap = node.props.getOrDefault(SkalBridge.PROP_GAP, 8)

    val m = applyHeight(applyWidth(Modifier, width), height)
        .skalColdVisual(node, defaultPadding = 16)
        .skalHotLayer(node)

    Column(
        verticalArrangement = verticalArrangement(alignment, gap),
        modifier = m,
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
    node.propsVersion.value

    val alignment = node.props.getOrDefault(SkalBridge.PROP_ALIGNMENT, -1)
    val gap = node.props.getOrDefault(SkalBridge.PROP_GAP, 8)

    val m = Modifier.fillMaxSize()
        .verticalScroll(rememberScrollState())
        .skalColdVisual(node, defaultPadding = 16)
        .skalHotLayer(node)

    Column(
        verticalArrangement = verticalArrangement(alignment, gap),
        modifier = m,
    ) {
        SkalChildren(node, bridge)
    }
}

@Composable
private fun SkalRow(node: NodeState, bridge: SkalBridge) {
    node.propsVersion.value

    val alignment = node.props.getOrDefault(SkalBridge.PROP_ALIGNMENT, -1)
    val gap = node.props.getOrDefault(SkalBridge.PROP_GAP, 8)

    val width = node.props.getOrDefault(SkalBridge.PROP_WIDTH, SkalBridge.NO_VALUE)
    val height = node.props.getOrDefault(SkalBridge.PROP_HEIGHT, SkalBridge.NO_VALUE)

    // Default: horizontally scrollable so a wide row doesn't get clipped.
    // Scroll axis is orthogonal to a parent SkalScrollColumn's vertical
    // scroll, so Compose handles the nesting cleanly.
    val m = Modifier.horizontalScroll(rememberScrollState())
        .let { applyHeight(applyWidth(it, width), height) }
        .skalColdVisual(node)
        .skalHotLayer(node)

    Row(
        horizontalArrangement = horizontalArrangement(alignment, gap),
        modifier = m,
    ) {
        SkalChildren(node, bridge)
    }
}

@Composable
private fun SkalText(node: NodeState) {
    // `node.text.value` subscribes us to text changes — only this Text
    // recomposes when SET_TEXT fires. `propsVersion.value` subscribes
    // to style changes. The two subscriptions are independent: a
    // bg-color change won't dirty the text, and a text change won't
    // re-evaluate the style block.
    node.propsVersion.value
    val text = node.text.value

    val fontSize = node.props.getOrDefault(SkalBridge.PROP_FONT_SIZE, 14)
    val fontWeight = FontWeight(node.props.getOrDefault(SkalBridge.PROP_FONT_WEIGHT, 400))
    val fgColorRaw = node.props.getOrDefault(SkalBridge.PROP_FG_COLOR, 0xFF000000.toInt())
    val align = textAlignFor(node.props.getOrDefault(SkalBridge.PROP_TEXT_ALIGN, 0))
    val maxLines = node.props.getOrDefault(SkalBridge.PROP_MAX_LINES, Int.MAX_VALUE)
    val overflow = textOverflowFor(node.props.getOrDefault(SkalBridge.PROP_TEXT_OVERFLOW, 0))
    val fontFamily = fontFamilyFor(node.props.getOrDefault(SkalBridge.PROP_FONT_FAMILY, 2)) // mono default

    val lineHeight = node.props.getOrDefault(SkalBridge.PROP_LINE_HEIGHT, 0)

    Text(
        text = text,
        fontSize = fontSize.sp,
        fontWeight = fontWeight,
        color = Color(fgColorRaw.toLong() and 0xFFFFFFFFL),
        textAlign = align,
        maxLines = maxLines,
        overflow = overflow,
        fontFamily = fontFamily,
        lineHeight = if (lineHeight > 0) lineHeight.sp else TextUnit.Unspecified,
        // graphicsLayer wraps the Text so opacity / transform animate
        // without recomposing the text styling.
        modifier = Modifier.skalHotLayer(node),
    )
}

@Composable
private fun SkalButton(node: NodeState, bridge: SkalBridge) {
    node.propsVersion.value

    val enabled = node.props.getOrDefault(SkalBridge.PROP_ENABLED, 1) != 0
    val width = node.props.getOrDefault(SkalBridge.PROP_WIDTH, SkalBridge.NO_VALUE)
    val height = node.props.getOrDefault(SkalBridge.PROP_HEIGHT, SkalBridge.NO_VALUE)

    // Material3 Button does NOT honor Modifier.background — its surface
    // color is controlled via the `colors` ButtonColors parameter. So
    // we route bg/fg props through ButtonDefaults.buttonColors rather
    // than skalColdVisual (which uses Modifier.background internally).
    val bg = node.props.getOrDefault(SkalBridge.PROP_BG_COLOR, 0)
    val fg = node.props.getOrDefault(SkalBridge.PROP_FG_COLOR, 0)
    val fontSize = node.props.getOrDefault(SkalBridge.PROP_FONT_SIZE, 14)

    // Optional cornerRadius override — defaults to the Material3 pill
    // shape if absent.
    val cornerRadius = node.props.getOrDefault(SkalBridge.PROP_CORNER_RADIUS, -1)

    // Optional compact mode — when PROP_PADDING is set, override the
    // Material3 default contentPadding (24dp horizontal × 8dp vertical
    // = chunky 48dp-tall buttons). The 3:1 horizontal:vertical ratio
    // matches Material3's own default proportions, so `padding={6}`
    // produces an 18dp × 6dp pill that looks like a scaled-down
    // Material3 button rather than a stubby one.
    val pad = node.props.getOrDefault(SkalBridge.PROP_PADDING, -1)
    val contentPadding = if (pad >= 0) PaddingValues(horizontal = (pad * 3).dp, vertical = pad.dp)
                         else ButtonDefaults.ContentPadding

    val defaults = ButtonDefaults.buttonColors()
    val colors = if (bg != 0 || fg != 0) {
        ButtonDefaults.buttonColors(
            containerColor = if (bg != 0) Color(bg.toLong() and 0xFFFFFFFFL) else defaults.containerColor,
            contentColor   = if (fg != 0) Color(fg.toLong() and 0xFFFFFFFFL) else defaults.contentColor,
        )
    } else defaults

    val m = applyHeight(applyWidth(Modifier, width), height).skalHotLayer(node)

    Button(
        onClick = { bridge.dispatchEvent(node.onClickHandlerId.value) },
        enabled = enabled,
        colors = colors,
        contentPadding = contentPadding,
        shape = if (cornerRadius >= 0) RoundedCornerShape(cornerRadius.dp) else ButtonDefaults.shape,
        modifier = m,
    ) {
        Text(text = node.text.value, fontSize = fontSize.sp)
    }
}
