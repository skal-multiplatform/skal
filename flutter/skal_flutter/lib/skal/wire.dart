// Wire-format constants for the Skal bridge. MUST match
// js-app/src/bridge.js verbatim — drift here is silent: ops
// decode to wrong values, props get applied to wrong widgets, no
// error. `flutter/skal_flutter/test/wire_test.dart` snapshots every
// value so an inadvertent change fails CI.
//
// Layout of the 2 MiB shared region (acquired via skal_acquire_bridge):
//
//   [Header 64B][Op ring 1 MiB][String heap 512 KiB][Event ring (rest)]
//
// The header carries the producer/consumer seq counters and write
// positions for each ring. Ops are 16 bytes: u8 opcode + 3 u32 args.

const int kRootNodeId = 1;

// ── Header offsets (bytes into the shared region) ────────────────────
const int hOpSeq               = 0;    // u64 — JS bumps on every commit (incl. auto-commits)
const int hOpWritePos          = 8;    // u32 — bytes from OP_RING_OFFSET; advances during a batch
const int hStrWritePos         = 12;   // u32 — bytes from STRING_HEAP_OFFSET
const int hEventSeq            = 16;   // u64 — Dart bumps after each event write
const int hEventWritePos       = 24;   // u32
const int hEventReadPos        = 28;   // u32
const int hLastDrainedSeq      = 32;   // u64 — Dart bumps after each drain (JS spin-wait target)
const int hLastDrainedWritePos = 40;   // u32 — reserved slot; not currently read by either side

const int kHeaderSize     = 64;
const int kOpRingOffset   = kHeaderSize;
const int kOpRingSize     = 4 * 1024 * 1024;
const int kStringHeapOff  = kOpRingOffset + kOpRingSize;
const int kStringHeapSize = 1024 * 1024;
const int kBridgeSize     = 6 * 1024 * 1024;
const int kEventRingOffset = kStringHeapOff + kStringHeapSize;
const int kEventRingSize   = kBridgeSize - kEventRingOffset;

// ── Opcodes (1 byte; reader masks the low byte of the u32 opcode word) ─
const int opCreateNode      = 0x01;
const int opRemoveNode      = 0x02;
const int opInsertBefore    = 0x03;
const int opSetPropU32      = 0x10;
const int opSetPropF32      = 0x11;
const int opSetText         = 0x14;
const int opBindHandler     = 0x15;
const int opSetPropStr      = 0x16;
// Hot props — own opcodes so the drain dispatches them directly to
// dedicated ValueNotifiers without the propsVersion bump. See
// PROPS_PLAN.md §5.
const int opSetOpacity      = 0x20;
const int opSetTranslationX = 0x21;
const int opSetTranslationY = 0x22;
const int opSetScaleX       = 0x23;
const int opSetScaleY       = 0x24;
const int opSetRotationZ    = 0x25;

// ── Widget types (NodeState.type) ─────────────────────────────────────
//
// Naming mirrors Flutter's widget vocabulary so the layer underneath
// is unsurprising: `<column>` → `Column`, `<listView>` → `ListView`,
// etc. The split between `listView` and `reorderableListView` is the
// same API-level split Flutter uses (`ListView.builder` vs
// `ReorderableListView.builder`), and it doubles as the signal the
// bridge needs to pick the right children-list backing — see
// `NodeState._children` in `node_state.dart`.
const int wtBox                  = 0;
const int wtColumn               = 1;
const int wtRow                  = 2;
const int wtText                 = 3;
const int wtButton               = 4;
/// Eagerly-built scrolling column — Flutter's `SingleChildScrollView`
/// wrapping a `Column`. Use when you want scroll but child count is
/// small (no virtualization). For long feeds, prefer [wtListView].
const int wtScrollView           = 5;
/// Vertically-scrolling lazily-built list. Backed by Flutter's
/// `ListView.builder` — children are constructed only as they scroll
/// into view, so a 5000-item feed mounts ~10 child widgets up front
/// instead of all 50K node widgets at once. Children are still all
/// registered in the bridge (the JS side emits CREATE_NODE +
/// INSERT_BEFORE for every item), but the Flutter Element tree only
/// materializes the visible window.
///
/// Append-only contract: this widget's children-list backing is the
/// cheap O(1)-append `ListChildList`. Inserting / removing at random
/// positions on a large `<listView>` will hit the O(N) tail-shift
/// cost. For drag-and-drop / random-position mutation, use
/// [wtReorderableListView].
const int wtListView             = 6;
/// Vertically-scrolling lazily-built list, with drag-and-drop reorder
/// support. Backed by Flutter's `ReorderableListView.builder`.
///
/// Children-list backing is an order-statistic treap, so insertAt /
/// removeAt / move-item are O(log N) regardless of position. Pay the
/// constant-factor overhead vs `listView` only when the dev opts in
/// by picking this widget — making the perf contract explicit at the
/// call site rather than something the framework adaptively guesses.
const int wtReorderableListView  = 7;

// ── Event kinds (u32 in JS, byte on the wire) ─────────────────────────
const int evClick  = 0x01;
const int evChange = 0x02;

// ── Prop key namespace ────────────────────────────────────────────────
// Partitioned by tier so apps + future expansions don't collide. See
// PROPS_PLAN.md §6.
//
// 0x00–0x1F layout    0x20–0x3F visual    0x40–0x5F text
// 0x60–0x7F image     0x80–0x9F input     0xA0–0xBF behavior

// Layout (u32 unless noted)
const int propPadding         = 0x00;
const int propPaddingTop      = 0x01;
const int propPaddingRight    = 0x02;
const int propPaddingBottom   = 0x03;
const int propPaddingLeft     = 0x04;
const int propWidth           = 0x05;
const int propHeight          = 0x06;
const int propWeight          = 0x07;     // f32 → propsF
const int propAlignment       = 0x08;
const int propGap             = 0x09;

// Visual (u32 ARGB for colors)
const int propBgColor         = 0x20;
const int propFgColor         = 0x21;
const int propCornerRadius    = 0x22;
const int propBorderWidth     = 0x23;
const int propBorderColor     = 0x24;
const int propShadowElevation = 0x25;

// Text
const int propFontSize        = 0x40;     // sp
const int propFontWeight      = 0x41;     // 100..900
const int propFontFamily      = 0x42;     // enum: 0=default 1=serif 2=mono 3=sans
const int propTextAlign       = 0x43;     // enum: 0=start 1=center 2=end 3=justify
const int propLineHeight      = 0x44;     // sp
const int propMaxLines        = 0x45;
const int propTextOverflow    = 0x46;     // enum: 0=clip 1=ellipsis 2=visible

// Image (string-valued)
const int propImageSrc        = 0x60;
const int propContentScale    = 0x61;

// Input
const int propPlaceholder     = 0x80;
const int propValue           = 0x81;
const int propKeyboardType    = 0x82;
const int propSecureEntry     = 0x83;

// Behavior
const int propEnabled         = 0xA0;
const int propFocusable       = 0xA1;
const int propVisible         = 0xA2;

// ── Sentinel values for width/height props ───────────────────────────
// Encoded into PROP_WIDTH / PROP_HEIGHT instead of needing distinct
// opcodes. NO_VALUE keeps the widget at its default (don't apply a
// width modifier at all).
const int kNoValue     = -1;
const int kFillMax     = 0x7FFFFFFE;
const int kWrapContent = 0x7FFFFFFD;

// ── Alignment enum (PROP_ALIGNMENT) ──────────────────────────────────
const int alignStart        = 0;
const int alignCenter       = 1;
const int alignEnd          = 2;
const int alignSpaceBetween = 3;
const int alignSpaceAround  = 4;
const int alignSpaceEvenly  = 5;
