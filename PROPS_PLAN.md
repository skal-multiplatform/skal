# Skal Props — Implementation Plan

Status: design locked, ready to implement. Everything below ships as one
cohesive change. No tiers, no "later" — the cost of doing all six layers
at once is small (the layers compose cleanly) and the cost of half-doing
it is large (every measurement decision later depends on the full
picture being in place).

## 0. Goals

The bridge is currently fast at everything except styling, because the
prop wire is plumbed end-to-end but no composable reads from it. We're
finishing that wire while preserving the per-frame cost model:

- **JS-side `setProp` is ~free** — three TypedArray writes, optional
  diff-cache skip.
- **Per-prop drain cost is ~4 instructions** — one map put, one int-set
  add (for cold props) or one MutableState write (for hot props).
- **Snapshot apply fires at most once per drain.** All prop writes
  coalesce into ≤1 observer fan-out per node.
- **Recompose count per frame stays bounded** — exactly the composables
  whose state changed, no parents dragged in.
- **Animation-frequency props (opacity, transform) cost zero
  composition + layout work** — only GPU layer property updates.

The plan delivers all of these as one shippable surface.

## 1. Architecture in one diagram

```
JS frame
  ├─ setPropU32(node, key, value)        ◄── diff-cache check, skip if equal
  ├─ TypedArray store: opcode | node | key | value
  ├─ … more setProp calls …
  └─ Atomics.store(H_OP_SEQ, ++seq)      ◄── one commit per JS frame

                ↓ next vsync ↓

Compose frame (withFrameNanos)
  └─ pumpOps()
      └─ Snapshot.withMutableSnapshot {
          for op in ring:
            switch (opcode):
              OP_SET_PROP_U32  → props[key] = value; touched.add(node)
              OP_SET_PROP_F32  → propsF[key] = value; touched.add(node)
              OP_SET_PROP_STR  → propsStr[key] = decoded; touched.add(node)
              OP_SET_OPACITY   → node.opacity.value = value      ◄── hot, direct
              OP_SET_TRANSLATION_X → …                            ◄── hot, direct
              OP_SET_SCALE_X   → …                                ◄── hot, direct
              OP_SET_ROTATION_Z → …                               ◄── hot, direct
              … other ops …
          for nodeId in touched:
              node.propsVersion.value++                          ◄── one bump per (node, drain)
        }
                ↓
Compose recompose
  └─ SkalBox(node) re-runs if propsVersion read changed
       ├─ reads node.props.* (non-reactive)
       ├─ builds Modifier chain inline
       └─ Modifier.graphicsLayer { reads node.opacity etc. }    ◄── hot prop sub-graph

Layout/Draw
  └─ Cold-prop changes: invalidate the phase the modifier touches
  └─ Hot-prop changes: skip composition + layout, only draw
```

## 2. Wire format

### 2.1 Opcodes

Existing (preserved):

| Hex | Name | Notes |
|-----|------|-------|
| 0x01 | OP_CREATE_NODE | a=nodeId, b=widgetType |
| 0x02 | OP_REMOVE_NODE | a=nodeId |
| 0x03 | OP_INSERT_BEFORE | a=parent, b=child, c=anchor (0 = append) |
| 0x10 | OP_SET_PROP_U32 | a=node, b=propKey, c=u32 value |
| 0x11 | OP_SET_PROP_F32 | a=node, b=propKey, c=f32 bits |
| 0x14 | OP_SET_TEXT | a=node, b=strOffset, c=strLength |
| 0x15 | OP_BIND_HANDLER | a=node, b=eventKind, c=handlerId |

New:

| Hex | Name | Notes |
|-----|------|-------|
| 0x16 | OP_SET_PROP_STR | a=node, b=propKey, c=(offset<<16 \| length) into string heap |
| 0x20 | OP_SET_OPACITY | a=node, c=f32 bits (hot prop, direct route) |
| 0x21 | OP_SET_TRANSLATION_X | a=node, c=f32 bits |
| 0x22 | OP_SET_TRANSLATION_Y | a=node, c=f32 bits |
| 0x23 | OP_SET_SCALE_X | a=node, c=f32 bits |
| 0x24 | OP_SET_SCALE_Y | a=node, c=f32 bits |
| 0x25 | OP_SET_ROTATION_Z | a=node, c=f32 bits |

Distinct opcodes for hot props (not a `when (b)` inside `OP_SET_PROP_F32`)
so cold-only drains pay zero branches for hot-prop routing.

Uniform 16-byte op shape preserved. No variable-length ops. No
combined "create+set" ops — the drain atomicity already gives mount-with-
styles for free; combining ops would break the uniform decoder.

### 2.2 Prop-key namespace

Partitioned by tier so the JS side can validate by range and the Kotlin
side reads can branch by category if needed:

```
0x00–0x1F   layout       (width, height, padding, margin, weight, alignment, gap)
0x20–0x3F   visual       (bg, fg, opacity*, border, corner radius, shadow)
0x40–0x5F   text         (font size, weight, family, align, line height, max lines, overflow)
0x60–0x7F   image        (src*, content scale, tint)
0x80–0x9F   input        (placeholder*, value*, keyboard type, secure entry)
0xA0–0xBF   behavior     (clickable, enabled, focusable, visible)
0xC0–0xFF   reserved
```

(*) string-valued props use `OP_SET_PROP_STR`. (`opacity` not in the
key namespace at all — it's a dedicated opcode now.)

Tier 1 prop keys to define on day one:

```
// Layout (u32)
PROP_PADDING            = 0x00     // dp, all sides
PROP_PADDING_TOP        = 0x01
PROP_PADDING_RIGHT      = 0x02
PROP_PADDING_BOTTOM     = 0x03
PROP_PADDING_LEFT       = 0x04
PROP_WIDTH              = 0x05     // dp; sentinels FILL_MAX, WRAP_CONTENT
PROP_HEIGHT             = 0x06
PROP_WEIGHT             = 0x07     // f32 (uses propsF)
PROP_ALIGNMENT          = 0x08     // enum: start/center/end/etc.
PROP_GAP                = 0x09     // dp; arrangement spacedBy

// Visual (u32)
PROP_BG_COLOR           = 0x20     // ARGB
PROP_FG_COLOR           = 0x21     // ARGB
PROP_CORNER_RADIUS      = 0x22     // dp
PROP_BORDER_WIDTH       = 0x23     // dp
PROP_BORDER_COLOR       = 0x24     // ARGB
PROP_SHADOW_ELEVATION   = 0x25     // dp

// Text (u32 unless noted)
PROP_FONT_SIZE          = 0x40     // sp
PROP_FONT_WEIGHT        = 0x41     // 100..900
PROP_FONT_FAMILY        = 0x42     // enum: default/serif/mono/sans
PROP_TEXT_ALIGN         = 0x43     // enum
PROP_LINE_HEIGHT        = 0x44     // sp
PROP_MAX_LINES          = 0x45     // int
PROP_TEXT_OVERFLOW      = 0x46     // enum: clip/ellipsis/visible

// Image
PROP_IMAGE_SRC          = 0x60     // string, via OP_SET_PROP_STR
PROP_CONTENT_SCALE      = 0x61     // enum: fit/crop/fill/inside

// Input
PROP_PLACEHOLDER        = 0x80     // string
PROP_VALUE              = 0x81     // string
PROP_KEYBOARD_TYPE      = 0x82     // enum
PROP_SECURE_ENTRY       = 0x83     // bool (u32: 0/1)

// Behavior
PROP_ENABLED            = 0xA0     // bool
PROP_FOCUSABLE          = 0xA1     // bool
PROP_VISIBLE            = 0xA2     // bool
```

### 2.3 Value encoding rules

Locked-in choices (cheap to enforce now, expensive to retrofit):

1. **dp/sp values are integers.** No fractional dp. JS writes `16`,
   Kotlin reads `16.dp`. Compact, fast decode.
2. **Color = packed ARGB u32** (0xAARRGGBB). Never a string.
3. **Sentinel values** in width/height u32:
   ```
   const val NO_VALUE      = -1           // prop not set
   const val FILL_MAX      = 0x7FFFFFFE   // fillMaxWidth/Height
   const val WRAP_CONTENT  = 0x7FFFFFFD   // wrapContent
   // everything else = literal dp
   ```
4. **Enums fit in u32.** No string-valued enum props. The Kotlin side
   maps each enum value to its Compose equivalent in a `when` block.
5. **Bools are u32: 0 = false, 1 = true.** Same wire shape as enums.
6. **Strings go through the string heap** via `OP_SET_PROP_STR`. Only
   actual strings (src, placeholder, value, accessibility label).

## 3. Kotlin side

### 3.1 NodeState shape

```kotlin
import androidx.compose.runtime.Stable

/**
 * Per-node state.
 *
 * @Stable contract: this class's identity (reference equality) is
 * sufficient for Compose to skip recomposition when only the
 * reference is passed as a parameter. Any observable mutation goes
 * through one of the [MutableState] fields below or is paired with a
 * [propsVersion] bump. The non-snapshot [props]/[propsF]/[propsStr]
 * maps MUST be read alongside [propsVersion] from any composable that
 * wants reactivity; reading them in isolation is silent.
 */
@Stable
class NodeState(val type: Int) {
    // ── Tree shape (Compose-reactive) ─────────────────────────────
    val parent = mutableStateOf(0)
    val children: SnapshotStateList<Int> = mutableStateListOf()

    // ── Per-node single-value reactive fields ─────────────────────
    val text = mutableStateOf("")
    val onClickHandlerId = mutableStateOf(0)
    val onChangeHandlerId = mutableStateOf(0)

    // ── Cold-prop storage (non-reactive, primitive-keyed) ─────────
    // Zero-allocation puts. NOT visible to Compose on their own.
    val props: MutableIntIntMap = MutableIntIntMap()
    val propsF: MutableIntFloatMap = MutableIntFloatMap()
    val propsStr: MutableIntObjectMap<String> = MutableIntObjectMap()

    // ── Cold-prop reactivity signal ───────────────────────────────
    // Bumped once per (node, drain) when any of the three prop maps
    // above mutated. Composables consuming cold props subscribe here.
    val propsVersion = mutableStateOf(0)

    // ── Hot props (animation-frequency) ───────────────────────────
    // Each gets its own MutableState. Composables consume them inside
    // a graphicsLayer block, so changes skip composition + layout and
    // only update GPU layer properties.
    val opacity = mutableStateOf(1f)
    val translationX = mutableStateOf(0f)
    val translationY = mutableStateOf(0f)
    val scaleX = mutableStateOf(1f)
    val scaleY = mutableStateOf(1f)
    val rotationZ = mutableStateOf(0f)
}
```

### 3.2 `pumpOps` drain

Additions to the existing drain, all inside the existing
`Snapshot.withMutableSnapshot` block:

```kotlin
class SkalBridge(private val skal: SkalRuntime) {
    // … existing fields …

    /**
     * Reused per-drain scratch — nodes whose cold props changed in this
     * drain. Cleared at start of each drain. Field, not local, so we
     * pay zero allocation per drain.
     */
    private val touchedNodes: MutableIntSet = MutableIntSet()

    fun pumpOps() {
        val seq = readSeq(buffer, H_OP_SEQ_OFFSET)
        if (seq == lastOpSeq) return
        val mark = TIME_SOURCE.markNow()

        Snapshot.withMutableSnapshot {
            val writePos = buffer.getInt(H_OP_WRITE_POS_OFFSET)
            val buf = buffer
            val ns = nodes
            val opEnd = OP_RING_OFFSET + writePos
            val strBase = STRING_HEAP_OFFSET
            val touched = touchedNodes
            touched.clear()
            var p = OP_RING_OFFSET
            while (p < opEnd) {
                val opcode = buf.getByte(p).toInt() and 0xff
                val a = buf.getInt(p + 4)
                val b = buf.getInt(p + 8)
                val c = buf.getInt(p + 12)
                when (opcode) {
                    OP_CREATE_NODE   -> ns.put(a, NodeState(b))
                    OP_REMOVE_NODE   -> removeSubtree(a, ns)
                    OP_INSERT_BEFORE -> { /* unchanged, with existing auto-detach */ }

                    // Cold props — write into the typed map, mark node touched.
                    OP_SET_PROP_U32 -> {
                        val node = ns.get(a)
                        if (node != null) { node.props.put(b, c); touched.add(a) }
                    }
                    OP_SET_PROP_F32 -> {
                        val node = ns.get(a)
                        if (node != null) { node.propsF.put(b, Float.fromBits(c)); touched.add(a) }
                    }
                    OP_SET_PROP_STR -> {
                        val node = ns.get(a)
                        if (node != null) {
                            val offset = (c ushr 16) and 0xFFFF
                            val length = c and 0xFFFF
                            node.propsStr.put(b, readString(buf, strBase, offset, length))
                            touched.add(a)
                        }
                    }

                    OP_SET_TEXT -> ns.get(a)?.text?.value = readString(buf, strBase, b, c)
                    OP_BIND_HANDLER -> { /* unchanged */ }

                    // Hot props — direct MutableState write, no version bump.
                    // Composables don't recompose; only graphicsLayer block re-runs.
                    OP_SET_OPACITY       -> ns.get(a)?.opacity?.value       = Float.fromBits(c)
                    OP_SET_TRANSLATION_X -> ns.get(a)?.translationX?.value  = Float.fromBits(c)
                    OP_SET_TRANSLATION_Y -> ns.get(a)?.translationY?.value  = Float.fromBits(c)
                    OP_SET_SCALE_X       -> ns.get(a)?.scaleX?.value        = Float.fromBits(c)
                    OP_SET_SCALE_Y       -> ns.get(a)?.scaleY?.value        = Float.fromBits(c)
                    OP_SET_ROTATION_Z    -> ns.get(a)?.rotationZ?.value     = Float.fromBits(c)
                }
                p += 16
            }

            // Coalesced version bumps — one per touched node per drain,
            // regardless of how many cold prop ops hit that node.
            // Inside the same snapshot block so all bumps land in the
            // single observer fan-out at apply.
            touched.forEach { id ->
                val node = ns.get(id) ?: return@forEach
                node.propsVersion.value = node.propsVersion.value + 1
            }

            lastOpSeq = seq
        }

        // … existing EMA + peak timing code, unchanged …
    }
}
```

Key properties:

- **One snapshot block** for the whole drain. One observer fan-out.
- **No allocation per drain** — `touchedNodes` is a field, cleared in place.
- **No branch on hot props during cold ops** — opcodes are distinct.
- **No branch on cold props during hot ops** — same.
- **Coalesced bumps** — N cold prop writes on one node = 1 propsVersion bump.

### 3.3 Composable read pattern

```kotlin
@Composable
private fun SkalBox(node: NodeState, bridge: SkalBridge) {
    // Subscribe to cold-prop changes. Whole-body re-runs when bumped.
    node.propsVersion.value

    // Read cold props from non-reactive storage. The subscribe above
    // is what makes Compose re-invoke this body when any of these
    // values change.
    var m: Modifier = Modifier

    val cornerRadius = node.props.getOrDefault(PROP_CORNER_RADIUS, 0)
    if (cornerRadius > 0) m = m.clip(RoundedCornerShape(cornerRadius.dp))

    val bg = node.props.getOrDefault(PROP_BG_COLOR, 0)
    if (bg != 0) m = m.background(Color(bg.toULong()))

    val borderWidth = node.props.getOrDefault(PROP_BORDER_WIDTH, 0)
    if (borderWidth > 0) {
        val borderColor = node.props.getOrDefault(PROP_BORDER_COLOR, 0xFF000000.toInt())
        m = m.border(borderWidth.dp, Color(borderColor.toULong()))
    }

    val padding = node.props.getOrDefault(PROP_PADDING, 0)
    if (padding > 0) m = m.padding(padding.dp)
    // (per-side padding overrides — read after the all-sides; whichever
    //  was last set in JS frame wins because of map-overwrite semantics)

    m = applyWidth(m, node.props.getOrDefault(PROP_WIDTH, NO_VALUE))
    m = applyHeight(m, node.props.getOrDefault(PROP_HEIGHT, NO_VALUE))

    // Hot props via graphicsLayer. State reads inside this block are
    // tracked at the layer level, NOT the composable level — changes
    // to opacity/transform here will NOT trigger SkalBox to recompose.
    // The layer block re-runs, updates GPU properties, done.
    //
    // Always-on layer is the right default: the per-node memory cost
    // is small and the win when ANY animation runs on this node is
    // order-of-magnitude (no composition, no layout).
    m = m.graphicsLayer {
        alpha = node.opacity.value
        translationX = node.translationX.value
        translationY = node.translationY.value
        scaleX = node.scaleX.value
        scaleY = node.scaleY.value
        rotationZ = node.rotationZ.value
    }

    Box(modifier = m) { SkalChildren(node, bridge) }
}

private fun applyWidth(m: Modifier, v: Int): Modifier = when (v) {
    NO_VALUE     -> m
    FILL_MAX     -> m.fillMaxWidth()
    WRAP_CONTENT -> m.wrapContentWidth()
    else         -> m.width(v.dp)
}

private fun applyHeight(m: Modifier, v: Int): Modifier = when (v) {
    NO_VALUE     -> m
    FILL_MAX     -> m.fillMaxHeight()
    WRAP_CONTENT -> m.wrapContentHeight()
    else         -> m.height(v.dp)
}
```

Same pattern for `SkalText`:

```kotlin
@Composable
private fun SkalText(node: NodeState) {
    node.propsVersion.value  // subscribe to cold prop changes
    // node.text.value subscribes separately — text content recomposes
    // independently of style changes

    val fontSize = node.props.getOrDefault(PROP_FONT_SIZE, 14).sp
    val fontWeight = FontWeight(node.props.getOrDefault(PROP_FONT_WEIGHT, 400))
    val fgColor = node.props.getOrDefault(PROP_FG_COLOR, 0xFF000000.toInt())
    val align = when (node.props.getOrDefault(PROP_TEXT_ALIGN, 0)) {
        1 -> TextAlign.Center
        2 -> TextAlign.End
        3 -> TextAlign.Justify
        else -> TextAlign.Start
    }
    val maxLines = node.props.getOrDefault(PROP_MAX_LINES, Int.MAX_VALUE)
    val overflow = when (node.props.getOrDefault(PROP_TEXT_OVERFLOW, 0)) {
        1 -> TextOverflow.Ellipsis
        2 -> TextOverflow.Visible
        else -> TextOverflow.Clip
    }
    val fontFamily = when (node.props.getOrDefault(PROP_FONT_FAMILY, 0)) {
        1 -> FontFamily.Serif
        2 -> FontFamily.Monospace
        3 -> FontFamily.SansSerif
        else -> FontFamily.Default
    }

    Text(
        text = node.text.value,
        fontSize = fontSize,
        fontWeight = fontWeight,
        color = Color(fgColor.toULong()),
        textAlign = align,
        maxLines = maxLines,
        overflow = overflow,
        fontFamily = fontFamily,
    )
}
```

Same shape extended to `SkalColumn`, `SkalRow`, `SkalScrollColumn`,
`SkalButton`. The pattern is uniform: subscribe to `propsVersion`,
read what you need from the typed map, apply.

`SkalChildren` does NOT read `propsVersion` — children rendering is
independent of parent styling.

## 4. JS side

### 4.1 Helpers

Flat free functions, never methods on an object. Bun's JIT inlines these
at the call site:

```typescript
// All operate on the same shared TypedArray view of the op ring.
// `opPos` is module-local, bumped after each write.

export function skalCreateNode(nodeId: number, widgetType: number): void {
    const p = opPos
    opBytes[p] = 0x01
    opU32[(p + 4) >> 2] = nodeId
    opU32[(p + 8) >> 2] = widgetType
    // c unused
    opPos = p + 16
}

export function skalSetPropU32(nodeId: number, key: number, value: number): void {
    // Diff cache check first — see §4.2.
    if (diffCacheGetU32(nodeId, key) === value) return
    diffCacheSetU32(nodeId, key, value)

    const p = opPos
    opBytes[p] = 0x10
    opU32[(p + 4) >> 2] = nodeId
    opU32[(p + 8) >> 2] = key
    opU32[(p + 12) >> 2] = value
    opPos = p + 16
}

// Similar for skalSetPropF32, skalSetPropStr, skalSetOpacity, etc.

export function skalCommit(): void {
    // Single Atomics.store at end of JS frame — the only publish barrier.
    const newSeq = (currentSeq = currentSeq + 1)
    Atomics.store(headerI64, H_OP_SEQ_INDEX, BigInt(newSeq))
    // (writePos already advanced by each setProp call)
}
```

### 4.2 Diff cache — flat array, O(1) lookup

```typescript
// Preallocated. Memory cost: 4 bytes * MAX_NODES * MAX_PROPS_PER_NODE.
// At 65536 nodes * 256 prop slots * 4 bytes = 64 MiB — too large.
// Sparse fallback: one row per ACTIVE node, slot table indexed by
// (rowIndex * MAX_PROPS_PER_NODE + propKey).
//
// Realistically:  MAX_ACTIVE_NODES = 8192,  MAX_PROPS_PER_NODE = 64
//                  → 8192 * 64 * 4 = 2 MiB  (acceptable)
const MAX_ACTIVE_NODES = 8192
const MAX_PROPS_PER_NODE = 64
const diffCacheU32 = new Int32Array(MAX_ACTIVE_NODES * MAX_PROPS_PER_NODE)
const diffCacheF32 = new Float32Array(MAX_ACTIVE_NODES * MAX_PROPS_PER_NODE)

// Sentinel: 0x80000001 means "no prior value." Avoids confusion with
// legitimate u32 = 0 (transparent black) or u32 = 0xFFFFFFFF.
const UNSET = 0x80000001 | 0

// Sparse index: nodeId → rowIndex.
// Allocated on first setProp for a node; freed on removeNode.
const nodeIdToRow = new Map<number, number>()
const freeRows: number[] = []
let nextRow = 0

function rowFor(nodeId: number): number {
    let row = nodeIdToRow.get(nodeId)
    if (row === undefined) {
        row = freeRows.pop() ?? nextRow++
        nodeIdToRow.set(nodeId, row)
        diffCacheU32.fill(UNSET, row * MAX_PROPS_PER_NODE, (row + 1) * MAX_PROPS_PER_NODE)
        diffCacheF32.fill(NaN, row * MAX_PROPS_PER_NODE, (row + 1) * MAX_PROPS_PER_NODE)
    }
    return row
}

function diffCacheGetU32(nodeId: number, key: number): number {
    const row = nodeIdToRow.get(nodeId)
    if (row === undefined) return UNSET
    return diffCacheU32[row * MAX_PROPS_PER_NODE + (key & 0xFF)]
}

function diffCacheSetU32(nodeId: number, key: number, value: number): void {
    const row = rowFor(nodeId)
    diffCacheU32[row * MAX_PROPS_PER_NODE + (key & 0xFF)] = value
}

// CRITICAL: must be called from skalRemoveNode. Otherwise recycled
// node IDs see stale "last values" and silently drop writes.
export function diffCacheReleaseNode(nodeId: number): void {
    const row = nodeIdToRow.get(nodeId)
    if (row !== undefined) {
        nodeIdToRow.delete(nodeId)
        freeRows.push(row)
    }
}
```

### 4.3 Batching rules

The framework adapter (SolidJS bindings, or whatever sits between user
code and these helpers) is responsible for:

1. **One commit per JS macrotask.** Inside a microtask cascade,
   keep accumulating ops; only call `skalCommit()` at the end. Solid's
   `batch()` and the natural microtask queue make this automatic — just
   don't sprinkle `skalCommit()` calls.

2. **Initial setup is one batch.** `createNode` → `setProp...` →
   `insertBefore` all in the same task. The drain atomicity guarantees
   no unstyled-flash regardless of order, but only if they're in the
   same commit.

3. **Release diff cache on remove.** `skalRemoveNode(id)` must call
   `diffCacheReleaseNode(id)`. Otherwise leak.

## 5. Hot props

### 5.1 The full hot set

Hot props get distinct opcodes, dedicated MutableStates, and live
inside a `graphicsLayer` block. Property choice driven by:

- Animation/gesture frequency (set 60+ times per second under common UI)
- Can be made paint-only via `graphicsLayer`

Six hot props on day one:

| Prop | Opcode | NodeState field | graphicsLayer property |
|------|--------|-----------------|------------------------|
| Opacity | OP_SET_OPACITY (0x20) | `opacity` | `alpha` |
| Translation X | OP_SET_TRANSLATION_X (0x21) | `translationX` | `translationX` |
| Translation Y | OP_SET_TRANSLATION_Y (0x22) | `translationY` | `translationY` |
| Scale X | OP_SET_SCALE_X (0x23) | `scaleX` | `scaleX` |
| Scale Y | OP_SET_SCALE_Y (0x24) | `scaleY` | `scaleY` |
| Rotation Z | OP_SET_ROTATION_Z (0x25) | `rotationZ` | `rotationZ` |

These cover: fade in/out, slide transitions, swipe gestures, pinch-zoom,
parallax scrolling, spinner rotations, list-item drag-and-drop. The
vast majority of common animation patterns.

### 5.2 Always-on graphicsLayer

Every node that supports transforms gets a `graphicsLayer` modifier in
its baseline chain (SkalBox, SkalColumn, SkalRow, SkalScrollColumn,
SkalText, SkalButton).

Rationale: making the layer conditional ("only add it if any hot prop
is non-default") requires reading the hot states in the composable
body, which subscribes the composable to them — defeating the entire
point of graphicsLayer's sub-graph subscription.

Per-node cost is small. The win when animations run is enormous.

### 5.3 Promotion criterion (for future hot props)

The six hot props above are correct for v1. If we discover another prop
needs promotion later, the rule is:

> Promote a cold prop to a hot prop (dedicated MutableState + dedicated
> opcode + graphicsLayer or drawBehind integration) iff:
>
> - It is set more than ~10×/sec in a typical workload, AND
> - It can be implemented as paint-only via a layer-modifier property.
>
> Don't promote just because a prop is "important." Promote based on
> update frequency and paint-only feasibility.

A prop that's set rarely but is visually critical (bg color) stays
cold — the cold path is already cheap for rare updates.

A prop that updates frequently but can't be paint-only (e.g. width
during a resize animation) stays cold — the layout invalidation is
unavoidable and hot-pathing doesn't help.

## 6. Measurement

Three numbers track the system's health. All implementable now.

### 6.1 Existing — keep

- **`pumpAvgNs`** — drain time, EMA. Already in place.
- **`pumpPeakNs`** — drain time, 60-sample sliding window max. Already
  in place.

### 6.2 New — add as part of this change

- **`recomposeCountPerFrame`** — total composables recomposed in the
  last frame. Use `Snapshot.registerApplyObserver` to count the dirty
  scope set each frame. Display in PerfHud.
  - Goal: ≤ N composables recomposed per frame where N ≈ number of
    nodes that received any state change.
  - Red flag: > 2× that — means stability is broken, parents are
    dragging children into recompose.

- **`jsWritesPerSecond`** — counter incremented in every `setProp*`
  helper, sampled and logged once per second. Sanity check that the
  diff cache is skipping the work we expect.

### 6.3 Benchmarks

Run before and after the implementation lands, plus on every PR touching
the bridge:

1. **+200 tweet feed benchmark** — already wired. Goal: no regression
   in pump time when every tweet has 10 props vs today's
   zero-prop-styled rendering. Pump should remain dominated by tree
   mutations, not prop writes.

2. **Single-prop animation @ 120 fps stress test** — new. JS-side
   `setInterval(8)` updates one node's opacity from 0 to 1 and back.
   Verify:
   - Pump time stays flat (one tiny op per drain).
   - `recomposeCountPerFrame` stays at 0 (graphicsLayer skips composition).
   - The animation displays at 120 fps on a ProMotion device.

3. **Bulk prop change @ create-time** — new. Mount a tree with 1000
   nodes, each with 10 cold props set during mount. Verify:
   - One drain processes all 11,000 ops.
   - One snapshot apply fires.
   - 1000 composables mount, none recompose a second time.

## 7. Implementation order

This is one cohesive change; the order is just the natural dependency
graph within the change.

1. **Add `@Stable` to `NodeState`. Add `propsVersion`, all hot-prop
   MutableStates, `propsStr`. Add `touchedNodes: MutableIntSet` field
   to `SkalBridge`.** Zero behavior change — just shape.

2. **Define all prop-key and opcode constants** in `SkalBridge.kt`
   companion object (Tier 1 covers it). Define `NO_VALUE`, `FILL_MAX`,
   `WRAP_CONTENT` sentinels.

3. **Extend the `pumpOps` `when` block** with the new opcodes
   (cold prop opcodes, hot prop opcodes, string prop opcode) and the
   coalesced version-bump loop at end-of-drain.

4. **Wire `SkalBox`, `SkalColumn`, `SkalRow`, `SkalScrollColumn`,
   `SkalText`, `SkalButton`** to read cold props, apply the
   `graphicsLayer` block, and use the helper functions for
   width/height/alignment/etc. Each composable subscribes to
   `propsVersion`, builds its modifier chain inline.

5. **JS-side helpers and diff cache.** Implement `skalSetPropU32`,
   `skalSetPropF32`, `skalSetPropStr`, hot-prop setters, the flat
   diff cache, `diffCacheReleaseNode`. Wire `skalRemoveNode` to call
   `diffCacheReleaseNode`.

6. **Measurement: `recomposeCountPerFrame` and `jsWritesPerSecond`**.
   Display both in PerfHud.

7. **Solid framework bindings.** Map JSX style attributes to the
   typed `setProp*` calls; expose `<Box style={{ background, padding,
   width, height, opacity, ... }}>` ergonomics.

8. **Run all three benchmarks.** Compare against pre-change pump
   times. Investigate any regression. Verify recompose-count claims.

Steps 1–4 are Kotlin-only. Steps 5 and 7 are JS-only. Step 6 spans
both. They can be done in parallel after step 1.

## 8. Invariants and gotchas

Things future maintainers (and future me) need to know:

- **`@Stable` on `NodeState` is load-bearing.** Without it, every
  parent recompose drags children into a recompose, breaking the
  whole recompose-count guarantee. Don't remove the annotation.
  Don't add a non-snapshot-observable public property without also
  routing its writes through `propsVersion`.

- **Reading `node.props.*` without first reading `node.propsVersion`
  is a bug.** Compose has no way to know when the read is stale. The
  rule: at the top of any composable that consumes cold props, do
  `node.propsVersion.value` first.

- **Hot props inside `graphicsLayer` block** stays inside the block.
  Don't read `node.opacity.value` outside a layer block "for
  convenience" — that subscribes the composable body and re-introduces
  the composition cost.

- **`OP_SET_PROP_STR` is only for actual strings.** Don't use it for
  enums or anything packable into a u32. The string heap is a
  precious resource (512 KiB).

- **Diff cache must be released on remove.** `skalRemoveNode` calls
  `diffCacheReleaseNode`. If a future change adds another removal
  path (bulk clear?), wire it.

- **One JS commit per macrotask.** Sprinkling `skalCommit()` mid-flow
  breaks atomicity and causes the unstyled-flash failure mode.
  Solid's `batch()` and the natural microtask queue handle this — just
  don't fight them.

- **`touchedNodes` is cleared at start of each drain.** Not at end.
  Cleared at start so the field can be inspected during the drain for
  debugging.

- **The 16-byte op shape is sacrosanct.** Don't add variable-length
  ops, don't pack multiple props into one op, don't add an "op header
  size" field. The uniformity is what makes the drain a tight branch-
  free loop.

## 8a. Decisions explicitly NOT taken

For things future readers will reasonably ask about.

### Batched `OP_SET_PROPS_N` op

**Considered, rejected.** A single op carrying N (key, value) pairs in
subsequent 16-byte slots would save ~20-40% of wire bytes and ~30-50ns
of JS write time per multi-prop node. None of that is the bottleneck:

- Drain cost is dominated by `props.put` (per-op), snapshot apply (one
  per drain, already coalesced), and the recompose-layout-draw cycle
  (one per touched node). Batching touches only the outer `when`
  dispatch — the smallest line item.
- Wire bandwidth is nowhere near the 1 MiB ring limit; ~65k ops per
  drain would be needed to fill it.
- The drain's tight 16-byte-stride decode loop is quietly load-bearing
  — multi-slot ops or variable-length ops add branches.
- The "batch" semantics already exist at the JS API level: multiple
  `setProp*` calls inside one function land in the same drain, dedup
  through `touchedNodes`, and trigger one coalesced `propsVersion`
  bump. Functionally identical to a single batched op.

Revisit if: profiling shows the drain decode loop as a real hotspot
(not currently true), or a semantic emerges that can't be reproduced
by ordering individual ops (not currently true).

### Variable-length ops in general

**Considered, rejected.** The uniform 16-byte op stride is what makes
the drain a branch-predictable tight loop. Any variable-length op
forces either an "op size" read per iteration or a switch-and-sub-loop
shape that adds branches. Sub-loops within specific arms (e.g.
hypothetical `OP_SET_PROPS_N` reading subsequent slots) are slightly
better than true variable-length but still cost the uniformity.

### CSS-string-style props (`"padding: 16px; bg: red"`)

**Considered, rejected.** Parsing strings per prop write would be
orders of magnitude slower than the typed wire format, defeats the
diff cache (string equality is expensive), and bloats the string heap
with style fragments. Skal's framework adapter can present any
ergonomics it wants to user code; the wire stays typed.

### One MutableState per prop key

**Considered, rejected.** Covered in §3.1's rationale — 30+ allocations
per node with most never set is strictly more bookkeeping than the
shared `propsVersion` + non-reactive map design. Hot-prop promotion
remains the targeted exception.

### `remember(propsVersion) { modifier }` for caching

**Considered, rejected.** When `propsVersion` changes the cache key
changes, so the lambda recomputes — exactly when we'd want it to
recompute. The remember would only help when SkalBox recomposes for
unrelated reasons, which `@Stable` on `NodeState` already prevents.
Net: redundant. Build modifiers inline.

## 9. What this delivers

When the implementation lands:

- JS apps can style any Box, Text, Column, Row, ScrollColumn, Button
  with the full Tier 1 prop set — colors, padding, borders, font
  styling, dimensions, alignment.
- Hot props (opacity, translate, scale, rotation) animate at native
  refresh rate with zero composition cost per frame.
- Pump time on a 200-node-with-10-props-each mount matches today's
  zero-prop-styled pump (drain cost is dominated by snapshot apply,
  not by prop writes).
- Recompose count per prop change is exactly 1 composable per node
  whose props changed. No spillover to children. No spillover to
  parent.
- The wire format has a partitioned, extensible prop-key namespace
  ready for Tier 2 props (LazyColumn, Image, TextField) without
  schema churn.

That's the prop system done — performant, complete, and structurally
ready for everything we'd want to add on top.
