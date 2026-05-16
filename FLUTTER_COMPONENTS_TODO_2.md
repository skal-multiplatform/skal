# Skal — Flutter components, round 2

The next slice of the **fast-path component layer**. Round 1
([`FLUTTER_JS_COMPONENTS.md`](FLUTTER_JS_COMPONENTS.md)) landed the
core primitives — `<box>`, `<column>`, `<row>`, `<text>`, `<listView>`,
the control set, navigation, animation, gestures, physics. This doc
tracks what's still missing.

For the codegen path that wraps arbitrary pub.dev widgets see
[`WRAPPING_PUB_PACKAGES.md`](WRAPPING_PUB_PACKAGES.md); for animation
see [`ANIMATION.md`](ANIMATION.md); for navigation see
[`NAVIGATION.md`](NAVIGATION.md).

---

## 0. Framing — fast-path vs reachable

Skal can **already render any Flutter widget** through the codegen
custom-widget path. So "what's left" is not "what's reachable" — it's
**which widgets earn a hand-coded fast-path**: ones that are
perf-critical, near-universal, or need new wire support that codegen
can't express. Everything else stays fine on codegen.

Priority key: **P0** changes what Skal apps *can be*; **P1** is
"nearly every app wants this"; **P2** is polish.

---

## 1. Big capability gaps

Genuinely missing capabilities — not just unwrapped widgets.

### 1.1 Slivers — `CustomScrollView` & collapsing headers — **P0**

`CustomScrollView`, `SliverAppBar` (collapsing / parallax headers),
`SliverList` / `SliverGrid`, `SliverPersistentHeader` (pinned &
floating sticky headers). Skal's scrolling is flat `listView` /
`scrollView`. This is the largest *structural* gap — a collapsing
header is in nearly every real app. Needs new widget types and a
sliver-aware children protocol.

### 1.2 `CustomPaint` / Canvas — **P0**

Arbitrary 2-D drawing: shapes, paths, charts, custom graphics. Skal
has no painting primitive at all. The hard part is the wire format —
a draw-command stream (or a retained display list) rather than the
widget-tree ops. High ceiling: unlocks charts, custom controls,
game-like rendering.

### 1.3 `PageView` — **P1**

Swipeable full-page pages — carousels, onboarding flows, image
galleries. Host-side `PageController`; one new widget type.

### 1.4 Drag-and-drop between targets — `Draggable` / `DragTarget` — **P1**

Skal's `draggable` is *self-move* only. Dragging an item *onto a drop
zone* — kanban boards, reorder-across-lists, sortable grids — needs a
`Draggable` / `DragTarget` pair and a host-side drag session that
hit-tests targets.

### 1.5 Pull-to-refresh + swipe-to-dismiss — **P1**

`RefreshIndicator` (pull a list to refresh) and `Dismissible`
(swipe a row away). Both are near-universal list interactions and
both need host support — they can't be composed from existing props.

---

## 2. Common widgets worth a fast-path — **P1**

Frequent enough to deserve first-class wire ops rather than codegen:

- **`ListTile`** — the structured leading / title / subtitle /
  trailing row. The single most-used Material layout primitive.
- **`Radio`** + radio groups.
- **`DropdownButton` / `PopupMenuButton`** — menus.
- **`Chip`** family — `Chip`, `FilterChip`, `ChoiceChip`, `InputChip`.
- **`SegmentedButton` / `ToggleButtons`** — segmented selectors.
- **`ExpansionTile`** — accordion / disclosure rows.
- **`Stepper`** — multi-step flows.
- **Date / time pickers** — `showDatePicker` / `showTimePicker`
  (imperative, like the existing dialogs API).
- **`Drawer`** — side navigation.
- **Draggable `BottomSheet`** — persistent / expandable bottom sheet.

---

## 3. Platform & polish — **P2**

- **`MouseRegion` / hover states** — desktop & web hover affordances.
- **Focus traversal / keyboard shortcuts** — `Focus`, `Shortcuts`,
  `Actions` / `Intents`. Tab-order, keyboard-driven UIs.
- **`Semantics` / accessibility** — Skal currently exposes ~nothing
  to screen readers. Required for production-grade apps.
- **`InteractiveViewer`** — packaged pinch-zoom-pan-with-bounds
  (photos, maps, diagrams). Skal has scale gestures; this is the
  bounded, inertial, batteries-included version.
- **`BackdropFilter`** — blur / frosted-glass effects.
- **`Scrollbar`** — explicit scrollbars (desktop especially).

---

## 4. Out of scope — trivial or already covered

Composable from existing `<box>` + styling, or cheap one-off codegen —
not worth wire surface:

`Divider`, `Card`, `Badge`, `FloatingActionButton`, `Center` / `Align`,
`Spacer`, `AspectRatio`, `Tooltip`. Vector-animation files (Lottie /
Rive) stay on the codegen path — see `ANIMATION.md` §13.

---

## 5. Suggested order

1. **`ListTile`** + **pull-to-refresh / swipe-to-dismiss** (§1.5, §2)
   — fastest wins; every list-driven app benefits immediately.
2. **`PageView`** (§1.3) — small, self-contained, high visibility.
3. **Slivers** (§1.1) — the most ambitious; collapsing headers change
   what Skal apps look like.
4. **`CustomPaint`** (§1.2) — highest ceiling, hardest wire design;
   best tackled once the draw-command format is thought through.
5. Drag-and-drop (§1.4), then the §2 control widgets, then §3 polish.
