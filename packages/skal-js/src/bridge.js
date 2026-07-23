// Skal bridge — wraps the shared 2 MiB ArrayBuffer that the JS worker
// thread shares with the native host. This module is the lowest level: raw op
// writers, atomic seq counters, event dispatch.
//
// Higher-level code (the universal renderer in renderer.js) builds on top.

import { installHotCoordinator } from './hot.js';

// ───────────────────────────────────────────────────────────────────────
// Buffer layout — must match flutter/skal_flutter/lib/skal/wire.dart
// + patches/skal_entry.zig.
// ───────────────────────────────────────────────────────────────────────

const BRIDGE_SIZE = 6 * 1024 * 1024;
const HEADER_SIZE = 64;
export const OP_RING_OFFSET = HEADER_SIZE;
export const OP_RING_SIZE = 4 * 1024 * 1024;
export const STRING_HEAP_OFFSET = OP_RING_OFFSET + OP_RING_SIZE;
export const STRING_HEAP_SIZE = 768 * 1024;   // trimmed 25% to make room for reply heap
// Dart-write-only reply heap. JS reads strings from here when an
// event arrives with eventArgStr / eventArgJson and the offset is
// in the reply-heap range (≥ REPLY_HEAP_OFFSET). See readReplyString.
export const REPLY_HEAP_OFFSET = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;
export const REPLY_HEAP_SIZE   = 256 * 1024;
export const EVENT_RING_OFFSET = REPLY_HEAP_OFFSET + REPLY_HEAP_SIZE;
const STRING_HEAP_END = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;

// Header layout — byte offsets, then derived u32 / BigInt64 indices.
const HB_OP_SEQ           = 0;   // u64
const HB_OP_WRITE_POS     = 8;   // u32
const HB_STR_WRITE_POS    = 12;  // u32
const HB_EVENT_SEQ        = 16;  // u64
const HB_EVENT_WRITE_POS  = 24;  // u32
const HB_EVENT_READ_POS   = 28;  // u32
const HB_LAST_DRAINED_SEQ = 32;  // u64 — Dart bumps after each drain (JS spin-wait target)
// JS bumps to the byte-offset it's drained up to in the reply heap.
// Dart's _writeReplyString reads this before wrapping the write
// cursor to 0 — without it, an in-flight str/json event referencing
// offset X would point to bytes Dart just clobbered.
const HB_REPLY_HEAP_READ_POS  = 40;  // u32
const HB_REPLY_HEAP_WRITE_POS = 44;  // u32 — Dart bumps when writing to the reply heap
// Bumped whenever we reset the op ring + JS string heap write cursors to
// 0 (overflow path). The web slice-sync mirror (skal_ffi_web.dart) caches
// the last value it saw; on a change it re-copies the full [0, writePos)
// of both regions instead of mistaking a post-reset write above the old
// mark for monotonic growth. No-op on native — the FFI buffer is shared,
// so Dart observes the reset (writePos regression) directly.
const HB_JS_RESET_EPOCH       = 48;  // u32

const H_OP_WRITE_POS         = HB_OP_WRITE_POS         >> 2;
const H_STR_WRITE_POS        = HB_STR_WRITE_POS        >> 2;
const H_EVENT_WRITE_POS      = HB_EVENT_WRITE_POS      >> 2;
const H_EVENT_READ_POS       = HB_EVENT_READ_POS       >> 2;
const H_REPLY_HEAP_READ_POS  = HB_REPLY_HEAP_READ_POS  >> 2;
const H_REPLY_HEAP_WRITE_POS = HB_REPLY_HEAP_WRITE_POS >> 2;
const H_JS_RESET_EPOCH       = HB_JS_RESET_EPOCH       >> 2;

const B_OP_SEQ            = HB_OP_SEQ            >> 3;
const B_EVENT_SEQ         = HB_EVENT_SEQ         >> 3;
const B_LAST_DRAINED_SEQ  = HB_LAST_DRAINED_SEQ  >> 3;

// ───────────────────────────────────────────────────────────────────────
// Opcodes — must match wire.dart exactly.
// ───────────────────────────────────────────────────────────────────────
export const OP_CREATE_NODE         = 0x01;
export const OP_REMOVE_NODE         = 0x02;
export const OP_INSERT_BEFORE       = 0x03;
// Like CREATE_NODE but for a custom (registry-dispatched) widget. The
// nameHash arg is a 32-bit FNV-1a of the widget name; the host looks
// up the matching builder in SkalRegistry. The name string is first
// brought into the host's dictionary via OP_DECLARE_NAME (emitted
// once per unique name).
export const OP_CREATE_CUSTOM_NODE  = 0x04;
export const OP_SET_PROP_U32        = 0x10;
export const OP_SET_PROP_F32        = 0x11;
export const OP_SET_TEXT            = 0x14;
export const OP_BIND_HANDLER        = 0x15;
export const OP_SET_PROP_STR        = 0x16;
// Custom-widget props are name-keyed (not enum-keyed). Each unique
// name is interned + declared once via OP_DECLARE_NAME; subsequent
// prop writes reference the name by 32-bit hash only. See bridge.dart
// for the full rationale.
export const OP_DECLARE_NAME        = 0x17;
export const OP_SET_CUSTOM_PROP_U32 = 0x18;
export const OP_SET_CUSTOM_PROP_F32 = 0x19;
export const OP_SET_CUSTOM_PROP_STR = 0x1A;
export const OP_CLEAR_CUSTOM_PROP  = 0x2C;
export const OP_BIND_CUSTOM_HANDLER = 0x1B;
// JS → Dart RPC. JSX side calls `await ref.takePicture()`. The macro
// resolves the method name to a hash (same FNV-1a as custom-prop
// names, declared once via OP_DECLARE_NAME), allocates a 32-bit
// callId, emits OP_METHOD_ARG ops for each arg, then OP_INVOKE_METHOD.
// Dart processes the args (accumulated keyed by callId), invokes the
// host's registered method, writes a reply event under that callId.
// JS resolves the matching Promise. See bridge.dart's op handlers and
// __skal_drainEvents' EV_METHOD_REPLY branch.
export const OP_INVOKE_METHOD       = 0x1C;
export const OP_METHOD_ARG          = 0x1D;
// Stream subscription: subscribe a Dart-side Stream<T>, then later
// unsubscribe by callId. See wire.dart for the protocol details.
export const OP_SUBSCRIBE_STREAM    = 0x1E;
export const OP_UNSUBSCRIBE_STREAM  = 0x1F;
// Hot-prop opcodes — distinct from OP_SET_PROP_F32 so the host's
// switch on opcode dispatches them directly to their dedicated
// notifier without going through the cold-prop machinery. See
// PROPS_PLAN.md §5.
export const OP_SET_OPACITY       = 0x20;
export const OP_SET_TRANSLATION_X = 0x21;
export const OP_SET_TRANSLATION_Y = 0x22;
export const OP_SET_SCALE_X       = 0x23;
export const OP_SET_SCALE_Y       = 0x24;
export const OP_SET_ROTATION_Z    = 0x25;
// Global design-system selector (mode, brightness). See wire.dart.
export const OP_SET_DESIGN        = 0x26;
// Pull-to-refresh completion — JS → host: app finished refreshing.
export const OP_COMPLETE_REFRESH  = 0x27;
// Diagnostic log — native only. Routes a console.* line to the host (see
// installConsoleBridge below). a = level, b = str offset, c = byte length.
export const OP_LOG               = 0x28;

// Hot reload — tear down every node under the root (id 1), keeping the root
// shell, so a re-evaluated bundle rebuilds the tree from a clean host state.
// See hot.js (beginReload) + bridge.dart's opResetRootSubtree handler.
export const OP_RESET_ROOT_SUBTREE = 0x29;
// Builder-mode <listView> rows — sparse, index-keyed attachment. See
// wire.dart's opListSetRow / opListClearRow for the full contract.
// listClearRow tears down the row's subtree HOST-side; the JS caller
// must not also emit OP_REMOVE_NODE for it.
export const OP_LIST_SET_ROW   = 0x2A;
export const OP_LIST_CLEAR_ROW = 0x2B;

// Widget types — naming mirrors Flutter's widget vocabulary.
export const WT_BOX                  = 0;
export const WT_COLUMN               = 1;
export const WT_ROW                  = 2;
export const WT_TEXT                 = 3;
export const WT_BUTTON               = 4;
// Eagerly-built scrolling column — Flutter `SingleChildScrollView` +
// `Column`. Use only for short scrollable content (no virtualization).
export const WT_SCROLL_VIEW          = 5;
// Lazy-rendered, virtualizing vertical list — Flutter `ListView.builder`.
// Child widgets are constructed only as they scroll into view. The
// bridge's NodeState graph still holds every entry; the host just
// doesn't materialize off-screen widgets. Append-only contract — the
// children-list backing is the cheap O(1) ListChildList. For random-
// position mutation, use WT_REORDERABLE_LIST_VIEW.
export const WT_LIST_VIEW            = 6;
// Same shape as WT_LIST_VIEW but children-list backing is an order-
// statistic treap, so insertAt / removeAt / move at random positions
// are O(log N). On the Flutter side renders to `ReorderableListView.builder`.
// Pay the constant-factor cost only when you explicitly opt in.
export const WT_REORDERABLE_LIST_VIEW = 7;
// Custom widget — dispatched on the Flutter side via SkalRegistry.
// The renderer emits OP_CREATE_CUSTOM_NODE (carrying the widget's
// name hash) instead of OP_CREATE_NODE when it sees an unknown JSX
// tag. The host looks the name up in its registry to know what real
// Flutter widget to build.
export const WT_CUSTOM                = 8;
// Image leaf — Flutter `Image`. `src` dispatched by URI scheme,
// `contentScale` → BoxFit. See wire.dart's wtImage.
export const WT_IMAGE                 = 9;
// Overlapping-children container — Flutter `Stack`. See wire.dart.
export const WT_STACK                 = 10;
// Wave-2 controls. See wire.dart for the per-widget prop surface.
export const WT_SWITCH                 = 11;
export const WT_SLIDER                 = 12;
export const WT_CHECKBOX                = 13;
export const WT_ACTIVITY_INDICATOR      = 14;
export const WT_PROGRESS_BAR            = 15;
// Wave-3 widgets. See wire.dart.
export const WT_LAZY_GRID               = 16;
export const WT_WRAP                    = 17;
export const WT_SAFE_AREA               = 18;
export const WT_RICH_TEXT               = 19;
// TextField — host-pattern. See wire.dart's wtTextInput.
export const WT_TEXT_INPUT              = 20;
// Navigation — <navigator> (Navigator pages-API) + <screen> (a Page).
export const WT_NAVIGATOR               = 21;
export const WT_SCREEN                  = 22;
// Tabs — <tabs> (IndexedStack + NavigationBar) + <tab> (one destination).
export const WT_TABS                    = 23;
export const WT_TAB                     = 24;
// Animation widgets — <animatedList> (AnimatedList), <crossFade>
// (AnimatedSwitcher), <hero> (Hero). See ANIMATION.md.
export const WT_ANIMATED_LIST           = 25;
export const WT_CROSS_FADE              = 26;
export const WT_HERO                    = 27;
// <listTile> — structured row; <pageView> — swipeable full pages;
// <dismissible> — swipe-away wrapper.
export const WT_LIST_TILE               = 28;
export const WT_PAGE_VIEW               = 29;
export const WT_DISMISSIBLE             = 30;
// Slivers — <customScrollView> viewport + sliver sections.
export const WT_CUSTOM_SCROLL_VIEW      = 31;
export const WT_SLIVER_APP_BAR          = 32;
export const WT_SLIVER_LIST             = 33;
export const WT_SLIVER_GRID             = 34;
// <canvas> — CustomPaint; the draw program rides opSetText.
export const WT_CANVAS                  = 35;
// Drag-and-drop — <dragItem> (Draggable) + <dropZone> (DragTarget).
export const WT_DRAG_ITEM               = 36;
export const WT_DROP_ZONE               = 37;
// §2 controls — radio, chip, segmented button, expansion tile, dropdown.
export const WT_RADIO                   = 38;
export const WT_CHIP                    = 39;
export const WT_SEGMENTED_BUTTON        = 40;
export const WT_EXPANSION_TILE          = 41;
export const WT_DROPDOWN                = 42;
// §2 — multi-step flow: <stepper> holds <step> children.
export const WT_STEPPER                 = 43;
export const WT_STEP                    = 44;
// §2 — <drawer> side panel: a <screen> child routed to Scaffold.drawer.
export const WT_DRAWER                  = 45;
// §2 — <bottomSheet>: a draggable / expandable DraggableScrollableSheet.
export const WT_BOTTOM_SHEET            = 46;
// §3 polish — <backdropFilter> blur layer, <interactiveViewer> zoom/pan.
export const WT_BACKDROP_FILTER         = 47;
export const WT_INTERACTIVE_VIEWER      = 48;
// <htmlEmbed> — Flutter Web only. A `HtmlElementView` window into a
// JS-defined DOM element (Stripe, OAuth iframes, third-party JS
// widgets). See packages/skal-js/src/skal/index.js#registerHtmlView.
export const WT_HTML_EMBED              = 49;

// Event kinds
export const EV_CLICK         = 0x01;
export const EV_CHANGE        = 0x02;
// Method-RPC reply / error. The "handlerId" slot (bytes 4-7 of the
// event record) carries the callId. JS keeps a `Map<callId, {resolve,
// reject}>` and consumes it on receipt. See OP_INVOKE_METHOD.
export const EV_METHOD_REPLY  = 0x03;
export const EV_METHOD_ERROR  = 0x04;
// Stream emissions: one event per stream element (Value), one when
// the stream completes (Done), one on error (Error). idSlot in the
// event record carries the callId — same identifier used at subscribe
// time, looked up in streamHandlers.
export const EV_STREAM_VALUE  = 0x05;
export const EV_STREAM_DONE   = 0x06;
export const EV_STREAM_ERROR  = 0x07;
// Gesture events for container behavior props. onTap reuses EV_CLICK.
export const EV_LONG_PRESS    = 0x08;
export const EV_DOUBLE_TAP    = 0x09;
// Text-field submit (Enter) — onSubmit on <textInput>.
export const EV_SUBMIT        = 0x0A;
// Reorder — <reorderableListView> drag completed; tuple (from, to).
export const EV_REORDER       = 0x0B;
// Navigator pop — <navigator> route popped via gesture / system back.
export const EV_NAV_POP       = 0x0C;
// Gesture events — pan/drag + pinch-scale on a container. The *_UPDATE
// kinds carry a vec2 payload (EVENT_ARG_VEC2): pan-update is (dx, dy),
// pan-start (localX, localY), pan-end (velocityX, velocityY), scale-
// update (scale, rotation). scale-start / scale-end are void.
export const EV_PAN_START     = 0x0D;
export const EV_PAN_UPDATE    = 0x0E;
export const EV_PAN_END       = 0x0F;
export const EV_SCALE_START   = 0x10;
export const EV_SCALE_UPDATE  = 0x11;
export const EV_SCALE_END     = 0x12;
// Pull-to-refresh (onRefresh) + swipe-to-dismiss (onDismiss).
export const EV_REFRESH       = 0x13;
export const EV_DISMISS       = 0x14;
// Drag-and-drop — a <dragItem> dropped on a <dropZone> (carries the
// item's dragData string).
export const EV_DROP          = 0x15;
// Pointer hover — onHover on a container; bool (true enter / false exit).
export const EV_HOVER         = 0x16;
// Keyboard — onKey on a focused container; a normalized combo string.
export const EV_KEY           = 0x17;
// Builder-mode <listView> row request — host's itemBuilder hit missing
// indices. Tuple payload (firstIndex, lastIndex); handled internally by
// the renderer (materialize window + evict), never by user code.
export const EV_ROW_REQUEST   = 0x18;

// Event-arg types — encoded in byte 1 of the event record. See
// flutter/skal_flutter/lib/skal/wire.dart's `eventArg*` constants.
export const EVENT_ARG_VOID = 0x00;
export const EVENT_ARG_I32  = 0x01;
export const EVENT_ARG_F32  = 0x02;
export const EVENT_ARG_BOOL = 0x03;
// String — payload is (heapOffset << 8) | length, packed in the
// 32-bit argValue slot. For JS → Dart args (OP_METHOD_ARG, typed
// callbacks), the heap is the JS write heap at STRING_HEAP_OFFSET.
// For Dart → JS replies (RPC return values, error messages), the
// heap is the REPLY heap at REPLY_HEAP_OFFSET — JS reads only.
export const EVENT_ARG_STR  = 0x04;
// JSON — same payload as EVENT_ARG_STR but JS.parses on receipt.
// Used for object returns from RPC (XFile, Map<String,…>, anything
// Dart's jsonEncode can serialize cleanly).
export const EVENT_ARG_JSON = 0x05;
// Tuple — payload is a JSON-encoded ARRAY; JS SPREADS the parsed
// array on the bound handler. Used for multi-arg event callbacks
// (`void Function(int, String)` etc.), distinct from EVENT_ARG_JSON
// (single Map/Array arg) by spreading at call time.
export const EVENT_ARG_TUPLE = 0x06;
// Vec2 — two f32s packed directly into the event record's two payload
// words (no reply-heap traffic). JS reinterprets both as f32 and
// SPREADS them on the handler: `fn(x, y)`. Used for gesture deltas
// (pan dx/dy, scale factor + rotation) that fire every drag frame.
export const EVENT_ARG_VEC2  = 0x07;

// ───────────────────────────────────────────────────────────────────────
// Prop key namespace — must match wire.dart's prop* constants.
// Partitioned by tier; see PROPS_PLAN.md §6.
// ───────────────────────────────────────────────────────────────────────

// Layout (u32 unless noted)
export const PROP_PADDING          = 0x00;
export const PROP_PADDING_TOP      = 0x01;
export const PROP_PADDING_RIGHT    = 0x02;
export const PROP_PADDING_BOTTOM   = 0x03;
export const PROP_PADDING_LEFT     = 0x04;
export const PROP_WIDTH            = 0x05;
export const PROP_HEIGHT           = 0x06;
export const PROP_WEIGHT           = 0x07; // f32 → setPropF32
export const PROP_ALIGNMENT        = 0x08;
export const PROP_GAP              = 0x09;
// Scroll axis: 0 = vertical (default), 1 = horizontal.
export const PROP_AXIS             = 0x0A;
// Stack-child positioning (→ Positioned). Set on a child of <stack>.
export const PROP_TOP              = 0x0B;
export const PROP_RIGHT            = 0x0C;
export const PROP_BOTTOM           = 0x0D;
export const PROP_LEFT             = 0x0E;
// Grid layout (lazyGrid).
export const PROP_CROSS_AXIS_COUNT = 0x0F;
export const PROP_ASPECT_RATIO     = 0x10;
// Builder-mode <listView count> — virtual row count (pull-based rows).
export const PROP_ITEM_COUNT       = 0x11;

// Visual
export const PROP_BG_COLOR         = 0x20;
export const PROP_FG_COLOR         = 0x21;
export const PROP_CORNER_RADIUS    = 0x22;
export const PROP_BORDER_WIDTH     = 0x23;
export const PROP_BORDER_COLOR     = 0x24;
export const PROP_SHADOW_ELEVATION = 0x25;

// Text
export const PROP_FONT_SIZE        = 0x40;
export const PROP_FONT_WEIGHT      = 0x41;
export const PROP_FONT_FAMILY      = 0x42;
export const PROP_TEXT_ALIGN       = 0x43;
export const PROP_LINE_HEIGHT      = 0x44;
export const PROP_MAX_LINES        = 0x45;
export const PROP_TEXT_OVERFLOW    = 0x46;
// Screen / tab chrome title — AppBar title on <screen>, nav-bar label
// on <tab>.
export const PROP_TITLE            = 0x47;
// <hero> shared-element tag (string).
export const PROP_HERO_TAG         = 0x48;
// <listTile> subtitle (string).
export const PROP_SUBTITLE         = 0x49;
// <dragItem> payload — string id carried to the <dropZone>'s onDrop.
export const PROP_DRAG_DATA        = 0x4A;
// Accessibility label — wraps any node in a Semantics widget.
// Mount-once; not in KEY_TO_SLOT.
export const PROP_SEMANTIC_LABEL   = 0x4B;
// Stable test handle — sets the Semantics `identifier`, which E2E tools
// (Maestro `tapOn: { id }`, integration_test bySemanticsIdentifier) match on.
// Separate from the a11y label so test ids don't leak to screen readers.
export const PROP_TEST_ID          = 0x4C;

// Image (string-valued)
export const PROP_IMAGE_SRC        = 0x60;
export const PROP_CONTENT_SCALE    = 0x61;
// <tab> nav-bar icon / <listTile> leading icon — a name resolved host-side.
export const PROP_ICON             = 0x62;
// <listTile> trailing icon — same host-side name table.
export const PROP_TRAILING_ICON    = 0x63;

// Input (string-valued except enums)
export const PROP_PLACEHOLDER      = 0x80;
export const PROP_VALUE            = 0x81;
export const PROP_KEYBOARD_TYPE    = 0x82;
export const PROP_SECURE_ENTRY     = 0x83;
// Control values — switch / checkbox / slider / progressBar.
export const PROP_CHECKED          = 0x84;
export const PROP_SLIDER_VALUE     = 0x85;
export const PROP_SLIDER_MIN       = 0x86;
export const PROP_SLIDER_MAX       = 0x87;
export const PROP_PROGRESS         = 0x88;
// <tabs> selected destination index (controlled).
export const PROP_ACTIVE_TAB       = 0x89;

// Behavior
export const PROP_ENABLED          = 0xA0;
export const PROP_FOCUSABLE        = 0xA1;
export const PROP_VISIBLE          = 0xA2;
// Animation — `animate={{duration, curve, delay}}`. See §10.3.
export const PROP_ANIM_DURATION    = 0xA3;
export const PROP_ANIM_CURVE       = 0xA4;
export const PROP_ANIM_DELAY       = 0xA5;
// <screen> presentation — 0 = push, 1 = modal.
export const PROP_PRESENTATION     = 0xA6;
// Animation looping — repeat (0/1), reverse/ping-pong (0/1), loop count.
export const PROP_ANIM_REPEAT      = 0xA7;
export const PROP_ANIM_REVERSE     = 0xA8;
export const PROP_ANIM_LOOP        = 0xA9;
// Physics spring enum — 0 off, 1 gentle, 2 bouncy, 3 stiff.
export const PROP_ANIM_SPRING      = 0xAA;
// <screen> transition enum — 0 default, 1 fade, 2 none.
export const PROP_TRANSITION       = 0xAB;
// Draggable fast-path enum — 0 off, 1 free, 2 horizontal, 3 vertical.
// Non-zero → the host drives the node's translation itself as the
// pointer moves (zero per-frame bridge traffic). See wire.dart.
export const PROP_DRAGGABLE        = 0xAC;
// Spring physics mode — 0 off, 1 gentle, 2 bouncy, 3 stiff. Non-zero →
// the node's hot props are driven by a real SpringSimulation (velocity-
// aware), distinct from the curve-based animate.spring. See wire.dart.
export const PROP_SPRING           = 0xAD;
// Draggable release physics — 0 none, 1 glide (friction), 2 springBack.
// What a draggable node does with its fling velocity on release.
export const PROP_RELEASE          = 0xAE;
// <sliverAppBar> scroll mode — 0 normal, 1 pinned, 2 floating, 3 both.
export const PROP_SLIVER_MODE      = 0xAF;
// <bottomSheet> extent fractions (f32, 0..1) — initial / min / max size
// of the DraggableScrollableSheet. Mount-once props — see KEY_TO_SLOT.
export const PROP_SHEET_INITIAL    = 0xB0;
export const PROP_SHEET_MIN        = 0xB1;
export const PROP_SHEET_MAX        = 0xB2;
// <scrollView> / <listView> explicit scrollbar — 0 off, 1 on.
// Mount-once — see KEY_TO_SLOT note.
export const PROP_SCROLLBAR        = 0xB3;
// <backdropFilter> blur sigma (px); <interactiveViewer> zoom clamps.
// Mount-once.
export const PROP_BLUR_RADIUS      = 0xB4;
export const PROP_MIN_SCALE        = 0xB5;
export const PROP_MAX_SCALE        = 0xB6;
// <htmlEmbed> view type — string key, matches a factory registered
// via skal/index.js's `registerHtmlView`. Mount-once: the factory
// runs at view creation; later changes don't replace the element.
export const PROP_VIEW_TYPE        = 0xB7;

// Sentinel values for width/height u32 props.
export const NO_VALUE     = -1 | 0;          // prop unset → host default
export const FILL_MAX     = 0x7FFFFFFE | 0;
export const WRAP_CONTENT = 0x7FFFFFFD | 0;

// Alignment enum values (for PROP_ALIGNMENT).
export const ALIGN_START         = 0;
export const ALIGN_CENTER        = 1;
export const ALIGN_END           = 2;
export const ALIGN_SPACE_BETWEEN = 3;
export const ALIGN_SPACE_AROUND  = 4;
export const ALIGN_SPACE_EVENLY  = 5;

// ───────────────────────────────────────────────────────────────────────
// Acquire the shared buffer. __skal_acquireBridge is installed by the
// native side (skal_entry.zig). On web (renderer-web.js path) no native
// bridge exists — feature-detect and fall back to a zero-init
// ArrayBuffer so this module imports cleanly. The web renderer speaks
// DOM directly and never reads/writes encoded ops, so the bytes are
// inert; the buffer just satisfies the new Uint8Array / Uint32Array
// views below.
// ───────────────────────────────────────────────────────────────────────

export const HAS_NATIVE_BRIDGE =
  typeof globalThis.__skal_acquireBridge === 'function';

// A DOM window exists. NOT the inverse of HAS_NATIVE_BRIDGE — Flutter
// Web (Shape D) has both. The three-valued platform picture (native /
// DOM browser / Flutter Web) is documented at the sites that branch on
// it; consumers should import this rather than re-deriving
// `typeof window` locally, so a future environment shift (SSR shims,
// workers) is one edit, not a scavenger hunt.
export const IS_BROWSER = typeof window !== 'undefined';

let buffer;
if (HAS_NATIVE_BRIDGE) {
  buffer = globalThis.__skal_acquireBridge();
  if (!buffer || buffer.byteLength !== BRIDGE_SIZE) {
    throw new Error(`Skal: bridge buffer not available (got ${buffer && buffer.byteLength})`);
  }
} else {
  buffer = new ArrayBuffer(BRIDGE_SIZE);
}

const u8     = new Uint8Array(buffer);
const u32    = new Uint32Array(buffer);
const seqArr = new BigInt64Array(buffer);

// Singleton encoder — `new TextEncoder()` per writeString would allocate
// thousands of times during a tweet-list rebuild.
const TEXT_ENCODER = new TextEncoder();

const OP_RING_OFFSET32 = OP_RING_OFFSET >> 2;
const OP_RING_END32 = (OP_RING_OFFSET + OP_RING_SIZE) >> 2;

// Auto-commit threshold — when opWritePos32 has advanced this many
// u32-indices since the last publish, JS bumps opSeq mid-batch
// (without resetting). Lets the host's next Ticker tick consume a
// chunk while JS keeps writing, so a 5000-tweet mount shows "list
// growing" instead of "click → pause → everything appears."
//
// Each op writes 4 u32-indices (16 bytes), so this constant translates
// to 16384 / 4 = 4096 ops per commit chunk = 64 KiB per chunk.
// ~120 tweets per chunk in the demo's tweet-card structure.
const AUTO_COMMIT_OPS = 16384;

// Near-end threshold — once writePos is this close to the ring end,
// every writeOp triggers flushAndWaitForDrain() instead of crashing
// past the boundary. One op's worth of margin (4 u32-indices = 16 B)
// is all we need — flushAndWaitForDrain writes only to the header,
// not the ring, so the slack just has to cover the in-progress op.
const RING_NEAR_END32 = OP_RING_END32 - 4;

// Cursors are SEEDED FROM THE LIVE HEADER, not hardcoded, so re-evaluating
// this bundle in the same VM (JS hot reload — see hot.js) continues exactly
// where the previous generation left off instead of regressing the shared
// op-ring / string-heap write positions (which would desync the host drain).
// The header stores positions RELATIVE to each region's base (see
// publishProgress), so we add the base back. On a cold start the header is
// zeroed, so this reduces to OP_RING_OFFSET32 / STRING_HEAP_OFFSET / 0n —
// byte-identical to the original hardcoded defaults.
const _seededOpRelBytes  = u32[H_OP_WRITE_POS];
const _seededStrRelBytes = u32[H_STR_WRITE_POS];
let opSeq = Atomics.load(seqArr, B_OP_SEQ);
let opWritePos32 = _seededOpRelBytes
  ? (_seededOpRelBytes >> 2) + OP_RING_OFFSET32
  : OP_RING_OFFSET32;
let strWritePos = _seededStrRelBytes
  ? _seededStrRelBytes + STRING_HEAP_OFFSET
  : STRING_HEAP_OFFSET;

// Tracks the writePos at which we last bumped opSeq. Auto-commit kicks
// in when (opWritePos32 - lastCommittedPos32) >= AUTO_COMMIT_OPS. Seed it to
// the current cursor (not the ring base) or the first op after a hot reload
// would trip a spurious auto-commit.
let lastCommittedPos32 = opWritePos32;

// Set when the op-ring + string-heap write cursors have been reset to 0
// but the reset hasn't been published yet. The next publishProgress
// bumps HB_JS_RESET_EPOCH together with the (post-reset) write positions,
// so the web mirror always reads a consistent {writePos, epoch} snapshot.
let pendingResetEpoch = false;

// Reentrancy guard for the web synchronous-drain path (see
// flushAndWaitForDrain). The host drain we invoke there can itself
// enqueue ops (an RPC reply / event handler that writes during the
// drain); a re-overflow must NOT recurse into another synchronous drain.
let inSyncDrain = false;

// Set for the full duration of flushAndWaitForDrain. The console shim's
// _emitLog checks it and drops any log that fires from INSIDE a flush —
// notably the internal `console.warn` calls below, which would otherwise
// re-enter writeOp while the ring is still full (opWritePos is at the
// overflow point until resetFrame), triggering a nested flush/second spin.
let _inFlush = false;

function resetFrame() {
  opWritePos32       = OP_RING_OFFSET32;
  strWritePos        = STRING_HEAP_OFFSET;
  lastCommittedPos32 = OP_RING_OFFSET32;
  pendingResetEpoch  = true;
}

// Publish current write position to the host without resetting the
// ring. Used both by auto-commit (mid-batch progressive painting) and
// by flushAndWaitForDrain (overflow handling).
function publishProgress() {
  u32[H_OP_WRITE_POS]  = (opWritePos32 - OP_RING_OFFSET32) << 2;
  u32[H_STR_WRITE_POS] = strWritePos - STRING_HEAP_OFFSET;
  // Publish the reset epoch in the SAME store as the post-reset write
  // positions so the web mirror never sees a bumped epoch paired with a
  // stale (pre-reset) writePos. No-op on native (no mirror reads it).
  if (pendingResetEpoch) {
    u32[H_JS_RESET_EPOCH] = (u32[H_JS_RESET_EPOCH] + 1) >>> 0;
    pendingResetEpoch = false;
  }
  opSeq += 1n;
  Atomics.store(seqArr, B_OP_SEQ, opSeq);
  lastCommittedPos32 = opWritePos32;
}

// Overflow path — JS would write past the end of the ring. Publish what
// we have, get the host to drain it, then rewind to the start of the ring
// so we can keep going.
//
// Two host topologies:
//
//   • Native (bun worker thread ≠ Flutter UI thread): the consumer drains
//     concurrently, so we spin on H_LAST_DRAINED_SEQ until it catches up.
//
//   • Web (Shape D: JS + Dart share the browser main thread): the consumer
//     CANNOT run while we spin — a spin would just burn its budget and then
//     overwrite undrained ops. So if the host installed `__skal_drainOpsSync`
//     (it does on web, not on native), we call it to pump the host inline,
//     exactly like `wakeJs` calls `__skal_drainEvents`. That actually
//     drains the ring (no data loss, no freeze). A reentrancy guard covers
//     the rare case where the drain itself re-overflows.
function flushAndWaitForDrain() {
  // _inFlush is cleared in a finally so it ALWAYS resets — even if the web
  // inline drain (drainOpsSync) throws. A leaked _inFlush=true would, on any
  // target where the console shim is installed, silence every later console.*
  // for the session (see _emitLog). resetFrame stays on the happy path: on a
  // failed drain the host may not have consumed the ops, so blindly rewinding
  // the ring could overwrite undrained data — leave that pre-existing behavior.
  _inFlush = true;
  try {
    publishProgress();
    const targetSeq = opSeq;

    const drainOpsSync = globalThis.__skal_drainOpsSync;
    if (typeof drainOpsSync === 'function') {
      // Web — drain inline on the shared thread instead of spinning.
      // Diagnostic counter (readable as globalThis.__skal_opRingResets) —
      // lets a dev confirm whether a render is overflowing the ring. Rare
      // path, so the bookkeeping is free.
      globalThis.__skal_opRingResets = (globalThis.__skal_opRingResets | 0) + 1;
      if (!inSyncDrain) {
        inSyncDrain = true;
        try { drainOpsSync(); } finally { inSyncDrain = false; }
      } else {
        // Re-overflow while already draining (e.g. an RPC reply handler that
        // itself writes > a ring of ops). Can't recurse; fall back to a blind
        // rewind. Chunk such producers (ChunkedFor) to avoid stale ops.
        console.warn('Skal: op ring re-overflowed during inline drain — chunk large renders to avoid stale ops');
      }
      resetFrame();
      return;
    }

    // Native — spin until the worker's consumer drains. 5 s budget. Throwing
    // here is dangerous in microtask context (ChunkedFor's queued steps
    // aren't wrapped in try/catch, and an uncaught throw blows through to
    // bun's error printer), so on timeout we warn and overwrite; the host
    // catches up over the next vsync.
    const deadline = performance.now() + 5000;
    while (true) {
      const drained = Atomics.load(seqArr, B_LAST_DRAINED_SEQ);
      if (drained >= targetSeq) break;
      if (performance.now() > deadline) {
        console.warn('Skal: drain spin timeout — UI thread slow; ring will overwrite');
        break;
      }
    }
    resetFrame();
  } finally {
    _inFlush = false;
  }
}

export function writeOp(opcode, a, b, c) {
  let w = opWritePos32;
  // Overflow guard — must run BEFORE the write so the safety margin in
  // RING_NEAR_END32 keeps publishProgress's own writes safe.
  if (w >= RING_NEAR_END32) {
    flushAndWaitForDrain();
    w = opWritePos32;
  }
  // Opcode packs as a full u32 (high 24 bits zero); reader consumes byte 0.
  u32[w]     = opcode >>> 0;
  u32[w + 1] = a >>> 0;
  u32[w + 2] = b >>> 0;
  u32[w + 3] = c >>> 0;
  opWritePos32 = w + 4;
  // Progressive commit — host's next vsync drains everything written
  // since the last bump. Without this, a 5K-tweet mount sits silent
  // until end-of-batch.
  if ((opWritePos32 - lastCommittedPos32) >= AUTO_COMMIT_OPS) {
    publishProgress();
  }
}

// Outputs of writeString — module globals so we don't allocate a tuple
// per call (matters when emitting thousands of SET_TEXTs in one frame).
let _strOffset = 0;
let _strLength = 0;

function writeString(s) {
  // Worst-case UTF-8 expansion is 3 bytes per code unit (BMP chars; the
  // 4-byte surrogate-pair case averages 2 bytes per code unit, so 3× is
  // conservative). If the next string might not fit, drain everything
  // first — flushAndWaitForDrain resets strWritePos along with the op
  // ring, and by then Dart has copied every drained SET_TEXT /
  // SET_PROP_STR into Dart String objects, so the heap bytes are safe
  // to overwrite. Mirrors the op-ring near-end guard in writeOp.
  if (strWritePos + s.length * 3 > STRING_HEAP_END) {
    flushAndWaitForDrain();
  }
  const start = strWritePos - STRING_HEAP_OFFSET;
  const slot = u8.subarray(strWritePos, STRING_HEAP_END);
  const { read, written } = TEXT_ENCODER.encodeInto(s, slot);
  if (read !== s.length) {
    // Even after a drain-reset the heap can't fit this string.
    // Means a single value is larger than the entire heap — caller
    // error (probably wants to chunk or paginate text), not capacity
    // churn we can recover from.
    throw new Error(
      `Skal: string too large for heap (${s.length} code units > ${STRING_HEAP_SIZE} bytes)`,
    );
  }
  strWritePos += written;
  _strOffset = start;
  _strLength = written;
}

export function setText(id, text) {
  writeString(text);
  writeOp(OP_SET_TEXT, id, _strOffset, _strLength);
}

// ───────────────────────────────────────────────────────────────────────
// Console bridge (NATIVE ONLY) — route console.* into the host log stream.
//
// Under bun, globalThis.console is JSC's ConsoleObject writing to a stdio
// the embedded runtime never wires up: on device that's /dev/null at best,
// and historically it crashed the VM outright. So a user's `console.log`
// had nowhere safe to go. We shadow console with a shim that serializes the
// args and ships them through OP_LOG; the Dart side debugPrints each line,
// so logs land in `flutter run` / logcat / Console.app interleaved with
// Dart's own [skal] logs — one place to look, on every native platform.
//
// Web keeps the browser's real console (DevTools is strictly better), so the
// shim is installed only under the embedded bun runtime — gated on
// HAS_NATIVE_BRIDGE AND the absence of a DOM `window` (the bridge is also
// present on the Flutter Web target, which DOES have a window). It REPLACES
// console rather than wrapping it, so a connected JS inspector's console pane
// won't mirror these lines — the inspector's value is breakpoints, not its console.
const LOG_MAX_CHARS = 8192;

// Hoisted (not re-created per call). JSON.stringify visits every value, and a
// BigInt anywhere in the object would otherwise throw — collapsing the whole
// value to "[object Object]" in _fmtLogArg's catch. Circular refs still fall through.
const _bigintReplacer = (_k, v) => (typeof v === 'bigint' ? `${v}n` : v);

function _fmtLogArg(a) {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack || a.message || String(a);
  if (typeof a === 'object' && a !== null) {
    try {
      return JSON.stringify(a, _bigintReplacer);
    } catch (_) {
      return String(a);
    }
  }
  return String(a);
}

// Reentrancy guards. Two distinct cases must not re-enter the op ring:
//   • _inEmitLog — a log fired from inside _emitLog itself.
//   • _inFlush   — a log fired from inside flushAndWaitForDrain (its own
//     console.warn diagnostics). _inEmitLog is FALSE there because the flush
//     was triggered by a normal op, so without _inFlush the warn's _emitLog
//     would run writeOp while the ring is still full → nested flush/spin.
// Either way the nested log is dropped. Logging must also never throw into
// app code, hence the try/catch.
let _inEmitLog = false;

function _emitLog(level, args) {
  if (_inEmitLog || _inFlush) return;
  _inEmitLog = true;
  try {
    let s = '';
    for (let i = 0; i < args.length; i++) {
      if (i) s += ' ';
      s += _fmtLogArg(args[i]);
    }
    if (s.length === 0) return;
    if (s.length > LOG_MAX_CHARS) s = s.slice(0, LOG_MAX_CHARS) + '…';
    writeString(s);
    writeOp(OP_LOG, level, _strOffset, _strLength);
    // Schedule (don't force) a commit so the log reaches the host at the end
    // of the current tick — covering a log from an idle async callback/timer
    // without a per-call opSeq bump + Atomics.store. Idempotent: a loop of
    // N logs in one tick publishes once, and a mid-render log piggybacks the
    // render's own end-of-batch commit.
    scheduleCommit();
  } catch (_) {
    // swallow — a logging failure must never break the app
  } finally {
    _inEmitLog = false;
  }
}

function installConsoleBridge() {
  // level: 0 log, 1 info, 2 warn, 3 error, 4 debug
  const con = {
    log:   function () { _emitLog(0, arguments); },
    info:  function () { _emitLog(1, arguments); },
    warn:  function () { _emitLog(2, arguments); },
    error: function () { _emitLog(3, arguments); },
    debug: function () { _emitLog(4, arguments); },
    trace: function () { _emitLog(4, arguments); },
  };
  // Methods that should still surface output route to log; assert keeps its
  // semantics. Everything else we don't define (groupEnd, count, time,
  // profile, timeStamp, createTask, …) falls through to the Proxy's no-op
  // below, so no console method ever throws under bun — no curated list to
  // maintain, and we REPLACE rather than wrap so there's no native fallback.
  con.dir = con.log;
  con.dirxml = con.log;
  con.table = con.log;
  con.group = con.log;
  con.groupCollapsed = con.log;
  con.assert = function (cond) {
    if (!cond) {
      const rest = Array.prototype.slice.call(arguments, 1);
      _emitLog(3, ['Assertion failed:'].concat(rest));
    }
  };
  const noop = function () {};
  globalThis.console = new Proxy(con, {
    get(target, prop) {
      const v = target[prop];
      return v !== undefined ? v : noop;
    },
  });
}

// Install ONLY under the embedded bun runtime — which has no DOM. Note
// HAS_NATIVE_BRIDGE is ALSO true on the Flutter Web (Shape D) target, where
// Dart hands us the bridge buffer via __skal_acquireBridge; there a real
// browser console (DevTools) exists and is strictly better, so the `window`
// check keeps the shim off the web and leaves console.* going to DevTools.
if (HAS_NATIVE_BRIDGE && typeof window === 'undefined') {
  installConsoleBridge();
}

// ───────────────────────────────────────────────────────────────────────
// Frame commit — Solid's effect flush calls this at the end of each
// reactive batch. By the time we get here, writeOp may already have
// fired several auto-commits inside the batch (progressive painting);
// this final commit publishes any remaining ops.
//
// Important: commit does NOT reset writePos. opWritePos32 grows
// monotonically across batches until flushAndWaitForDrain (overflow
// path) spin-waits for the host to fully catch up and resets to 0.
// Resetting at end-of-batch is the wrong thing — it rewinds the local
// cursor while leaving the published H_OP_WRITE_POS stale, so the
// host's drain checkpoint sits above the new batch's first chunk and
// those ops get silently skipped. The (no-resetFrame) shape here is
// the fix for that bug; see flushAndWaitForDrain for the wrap-around.
// ───────────────────────────────────────────────────────────────────────

let scheduled = false;

function commit() {
  scheduled = false;
  // Publish any un-published progress and let the host catch up over
  // the next vsync(s). DO NOT resetFrame here — that would rewind the
  // local writePos but leave the published H_OP_WRITE_POS stale, so
  // the host would skip the first chunk of the next batch (it'd see
  // its lastDrainedWritePos checkpoint sitting above the new writes).
  //
  // Reset only happens inside flushAndWaitForDrain, after the host
  // has confirmed it drained everything via Atomics.store on
  // lastDrainedSeq. opWritePos32 grows monotonically until then.
  if (opWritePos32 !== lastCommittedPos32) {
    publishProgress();
  }
}

/**
 * Schedule a commit at the end of the current microtask batch. Solid
 * batches signal updates inside a synchronous run; the renderer accumulates
 * ops as those updates flow through, and we publish the whole frame once
 * via this hook.
 *
 * Idempotent — the first call queues a microtask; subsequent calls in the
 * same tick are no-ops.
 */
export function scheduleCommit() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(commit);
}

// ───────────────────────────────────────────────────────────────────────
// Hot-reload support — see hot.js. resetRootSubtree emits the host tree-reset
// op and publishes synchronously (commit, no microtask wait) so the OUTGOING
// generation's teardown is visible in the header before the incoming bundle
// seeds its cursors from it.
// ───────────────────────────────────────────────────────────────────────

export function resetRootSubtree() {
  // Rewind the op-ring + string-heap write cursors to base BEFORE emitting the
  // reset. The outgoing generation is fully torn down and the host has already
  // drained its published ops (it pumps every frame), so reusing the byte
  // ranges is safe — and it stops the write positions from ratcheting upward
  // on every reload. Without this, after ~20 reloads a re-mount overflows the
  // ring/heap mid-eval; on native the overflow path spin-waits on the host
  // consumer, which is blocked inside the synchronous evaluate() — a ~5s
  // freeze then a blind overwrite. The host sees writePos regress (its
  // existing ring-reset detection) and snaps its drain checkpoint to 0.
  resetFrame();
  writeOp(OP_RESET_ROOT_SUBTREE, ROOT_NODE_ID, 0, 0);
  commit(); // publish synchronously so the incoming bundle seeds past this
}

// ───────────────────────────────────────────────────────────────────────
// Diff cache — flat-array, O(1) lookup, sparse rows allocated per active
// node. See PROPS_PLAN.md §4.
//
// The point of the cache: skip a wire write when the value is unchanged.
// Most "renders" don't change every prop; for a button being re-emitted
// because a sibling's count signal changed, skipping its bg-color write
// is pure win.
//
// Sparse design — `nodeIdToRow` maps a node's id to a row in the flat
// array. Rows are recycled via `freeRows` when nodes are removed.
//
// The flat arrays grow on demand via amortized doubling (same pattern
// as Vec<T>::push / V8's elements backing store). Initial capacity
// covers the typical 50–500 node app for free; large apps (5000-tweet
// feeds, infinite-scroll lists) trigger one or two growth passes and
// then settle. There is no hard cap — the JS heap is the only limit.
// ───────────────────────────────────────────────────────────────────────

let activeNodeCapacity = 1024;

// Dense slot table — maps each defined PROP_* key (sparse across the
// 0x00..0xA2 range) to a contiguous slot index in the per-node diff-
// cache rows. Avoids the wasted memory of a sparse 256-wide row AND
// the collision bug of masking with (key & 0x3F).
//
// `KEY_TO_SLOT[propKey] = slot` or -1 if the key is not registered as
// a known cold prop. Build it once at module load; the lookup is then
// a single Int8Array load per setProp call.
const KEY_TO_SLOT = new Int8Array(256);
KEY_TO_SLOT.fill(-1);

// Layout (slots 0..9)
KEY_TO_SLOT[PROP_PADDING]          = 0;
KEY_TO_SLOT[PROP_PADDING_TOP]      = 1;
KEY_TO_SLOT[PROP_PADDING_RIGHT]    = 2;
KEY_TO_SLOT[PROP_PADDING_BOTTOM]   = 3;
KEY_TO_SLOT[PROP_PADDING_LEFT]     = 4;
KEY_TO_SLOT[PROP_WIDTH]            = 5;
KEY_TO_SLOT[PROP_HEIGHT]           = 6;
KEY_TO_SLOT[PROP_WEIGHT]           = 7;
KEY_TO_SLOT[PROP_ALIGNMENT]        = 8;
KEY_TO_SLOT[PROP_GAP]              = 9;
// Visual (slots 10..15)
KEY_TO_SLOT[PROP_BG_COLOR]         = 10;
KEY_TO_SLOT[PROP_FG_COLOR]         = 11;
KEY_TO_SLOT[PROP_CORNER_RADIUS]    = 12;
KEY_TO_SLOT[PROP_BORDER_WIDTH]     = 13;
KEY_TO_SLOT[PROP_BORDER_COLOR]     = 14;
KEY_TO_SLOT[PROP_SHADOW_ELEVATION] = 15;
// Text (slots 16..22)
KEY_TO_SLOT[PROP_FONT_SIZE]        = 16;
KEY_TO_SLOT[PROP_FONT_WEIGHT]      = 17;
KEY_TO_SLOT[PROP_FONT_FAMILY]      = 18;
KEY_TO_SLOT[PROP_TEXT_ALIGN]       = 19;
KEY_TO_SLOT[PROP_LINE_HEIGHT]      = 20;
KEY_TO_SLOT[PROP_MAX_LINES]        = 21;
KEY_TO_SLOT[PROP_TEXT_OVERFLOW]    = 22;
// Image (slots 23..24)
KEY_TO_SLOT[PROP_IMAGE_SRC]        = 23;
KEY_TO_SLOT[PROP_CONTENT_SCALE]    = 24;
// Input (slots 25..28)
KEY_TO_SLOT[PROP_PLACEHOLDER]      = 25;
KEY_TO_SLOT[PROP_VALUE]            = 26;
KEY_TO_SLOT[PROP_KEYBOARD_TYPE]    = 27;
KEY_TO_SLOT[PROP_SECURE_ENTRY]     = 28;
// Behavior (slots 29..31)
KEY_TO_SLOT[PROP_ENABLED]          = 29;
KEY_TO_SLOT[PROP_FOCUSABLE]        = 30;
KEY_TO_SLOT[PROP_VISIBLE]          = 31;
// Extended widget set (slots 32..46) — scroll axis, stack positioning,
// grid layout, control values, and the animation spec. EVERY cold
// prop key must appear here to be diff-cached; an unregistered key
// still works (setProp* writes it uncached) but pays a write each set.
KEY_TO_SLOT[PROP_AXIS]             = 32;
KEY_TO_SLOT[PROP_TOP]              = 33;
KEY_TO_SLOT[PROP_RIGHT]            = 34;
KEY_TO_SLOT[PROP_BOTTOM]           = 35;
KEY_TO_SLOT[PROP_LEFT]             = 36;
KEY_TO_SLOT[PROP_CROSS_AXIS_COUNT] = 37;
KEY_TO_SLOT[PROP_ASPECT_RATIO]     = 38;
KEY_TO_SLOT[PROP_CHECKED]          = 39;
KEY_TO_SLOT[PROP_SLIDER_VALUE]     = 40;
KEY_TO_SLOT[PROP_SLIDER_MIN]       = 41;
KEY_TO_SLOT[PROP_SLIDER_MAX]       = 42;
KEY_TO_SLOT[PROP_PROGRESS]         = 43;
KEY_TO_SLOT[PROP_ANIM_DURATION]    = 44;
KEY_TO_SLOT[PROP_ANIM_CURVE]       = 45;
KEY_TO_SLOT[PROP_ANIM_DELAY]       = 46;
KEY_TO_SLOT[PROP_PRESENTATION]     = 47;
KEY_TO_SLOT[PROP_TITLE]            = 48;
KEY_TO_SLOT[PROP_ICON]             = 49;
KEY_TO_SLOT[PROP_ACTIVE_TAB]       = 50;
KEY_TO_SLOT[PROP_HERO_TAG]         = 51;
KEY_TO_SLOT[PROP_ANIM_REPEAT]      = 52;
KEY_TO_SLOT[PROP_ANIM_REVERSE]     = 53;
KEY_TO_SLOT[PROP_ANIM_LOOP]        = 54;
KEY_TO_SLOT[PROP_ANIM_SPRING]      = 55;
KEY_TO_SLOT[PROP_TRANSITION]       = 56;
KEY_TO_SLOT[PROP_DRAGGABLE]        = 57;
KEY_TO_SLOT[PROP_SPRING]           = 58;
KEY_TO_SLOT[PROP_RELEASE]          = 59;
KEY_TO_SLOT[PROP_SUBTITLE]         = 60;
KEY_TO_SLOT[PROP_TRAILING_ICON]    = 61;
KEY_TO_SLOT[PROP_SLIVER_MODE]      = 62;
KEY_TO_SLOT[PROP_DRAG_DATA]        = 63;
// PROP_SHEET_INITIAL / MIN / MAX (0xB0-0xB2) are deliberately NOT
// registered here: a `<bottomSheet>`'s extent fractions are set once at
// mount, so they gain nothing from the per-write diff cache. Leaving
// them out avoids growing the 64-slot stride for every node. They still
// work — an unregistered key takes the uncached setProp* path.

// 64-slot row stride (was 32 — the extended widget set filled it).
// KEY_TO_SLOT is an Int8Array, so slots must stay < 128.
const SLOTS_PER_NODE = 64;

// `let` bindings (not const) — `growCache()` rebinds them when the
// flat-array capacity doubles. JS modules pass `let` exports as live
// bindings, and within-module reads always observe the current value,
// so the per-prop setters below don't need any indirection.
let diffCacheU32 = new Int32Array(activeNodeCapacity * SLOTS_PER_NODE);
let diffCacheF32 = new Float32Array(activeNodeCapacity * SLOTS_PER_NODE);
let diffCacheStr = new Array(activeNodeCapacity * SLOTS_PER_NODE);

// Parallel "has value been set" flag, one byte per slot. Needed
// because EVERY 32-bit pattern is a legitimate u32 prop value (colors,
// dp counts, enums) — there is no sentinel int we can safely reserve.
// Using `Uint8Array` keeps the check to a single load per setProp call,
// and `0/1` lets us reset whole rows with `.fill(0)`.
//
// (For F32 we rely on NaN's `NaN !== NaN` semantics — that one sentinel
// works because no animation value is ever NaN. Strings use `undefined`
// as their unset sentinel — distinct from any user-supplied string.)
let hasValueU32 = new Uint8Array(activeNodeCapacity * SLOTS_PER_NODE);

// Hot-prop cache — separate space from cold-prop cache. Each active
// node has 6 slots (one per hot prop: opacity, transX, transY, scaleX,
// scaleY, rotZ). Indexed by (row * HOT_PROPS_PER_NODE + hotIdx).
const HOT_PROPS_PER_NODE = 6;
let diffHotF32 = new Float32Array(activeNodeCapacity * HOT_PROPS_PER_NODE);
diffHotF32.fill(NaN);

const nodeIdToRow = new Map();
const freeRows    = [];
let   nextRow     = 0;

// Amortized doubling — when nextRow would exceed capacity, allocate
// new typed arrays of 2× the size, copy existing contents over, and
// rebind. O(n) per growth, O(1) amortized per row. Initial cap of 1024
// covers a 50–200-node demo with zero growths; a 30,000-node feed
// triggers 5 growths total (1k→2k→4k→8k→16k→32k).
function growCache() {
  const newCap = activeNodeCapacity * 2;
  const oldRows = activeNodeCapacity * SLOTS_PER_NODE;
  const newRows = newCap * SLOTS_PER_NODE;
  const oldHotRows = activeNodeCapacity * HOT_PROPS_PER_NODE;
  const newHotRows = newCap * HOT_PROPS_PER_NODE;

  // U32 + Uint8 default to zero on construction, which is the unset
  // sentinel — just copy old data into the head and the tail stays 0.
  const newU32 = new Int32Array(newRows);
  newU32.set(diffCacheU32);
  diffCacheU32 = newU32;

  const newHas = new Uint8Array(newRows);
  newHas.set(hasValueU32);
  hasValueU32 = newHas;

  // F32 unset sentinel is NaN. Copy old data first, then NaN-fill only
  // the new tail — fill(NaN, oldRows) is roughly half the work of
  // filling the whole array and then overwriting the head.
  const newF32 = new Float32Array(newRows);
  newF32.set(diffCacheF32);
  newF32.fill(NaN, oldRows);
  diffCacheF32 = newF32;

  const newHot = new Float32Array(newHotRows);
  newHot.set(diffHotF32);
  newHot.fill(NaN, oldHotRows);
  diffHotF32 = newHot;

  // diffCacheStr is a plain Array — auto-grows when written to, but
  // bumping `.length` here lets V8/JSC's elements backing store
  // pre-size in one shot instead of nudging on every first write.
  // Default value at the new positions is `undefined` (= unset).
  diffCacheStr.length = newRows;

  activeNodeCapacity = newCap;
}

function rowFor(nodeId) {
  let row = nodeIdToRow.get(nodeId);
  if (row === undefined) {
    row = freeRows.pop();
    if (row === undefined) row = nextRow++;
    if (row >= activeNodeCapacity) growCache();
    nodeIdToRow.set(nodeId, row);
    const base = row * SLOTS_PER_NODE;
    hasValueU32.fill(0, base, base + SLOTS_PER_NODE);
    // U32 cache cells are filled lazily on first write — we only care
    // about hasValueU32 for correctness, so the U32 cell can hold any
    // garbage until first set. (We still zero the F32/Str sentinels
    // because their first-write contract relies on the sentinel value.)
    diffCacheF32.fill(NaN, base, base + SLOTS_PER_NODE);
    for (let i = base; i < base + SLOTS_PER_NODE; i++) diffCacheStr[i] = undefined;
  }
  return row;
}

/**
 * Release a node's diff-cache row. MUST be called from `removeNode` in
 * the renderer — otherwise a recycled node id sees stale "last values"
 * from its previous incarnation and silently drops legitimate writes.
 *
 * Both the cold row and the hot-prop row are released. The U32/F32/Str
 * cells are reset to their unset sentinels lazily when `rowFor` next
 * reclaims this row — no need to clear here.
 */
// ── Cross-cutting per-node state (declared above the writer/subscribe
// functions that populate them, so call sites read them after the
// `const` initializers have run — no TDZ ambiguity even if a future
// refactor invokes a writer during module init).

// Custom-prop diff caches. Built-in props use the typed-array
// diffCache* arrays above (one slot per (node, key) pair, addressed
// by KEY_TO_SLOT). Custom props live in the open hash namespace and
// can't take that compact form — we use per-node Maps keyed by name
// hash instead. Same skip-on-no-change contract: a no-op rebuild that
// re-sets every prop costs zero wire bytes for unchanged values.
// Cleared in diffCacheReleaseNode.
//
// Three separate caches (U32 / F32 / Str) so the inner equality check
// stays type-specific and inline-friendly — JIT inlines a typed === on
// a hot Map.get cheaper than a tagged-union shape check.
const _customCacheU32 = new Map();
const _customCacheF32 = new Map();
const _customCacheStr = new Map();

// Per-node index of live stream callIds. diffCacheReleaseNode walks
// this on unmount (via cancelStreamsForNode) to fire OP_UNSUBSCRIBE_STREAM
// for each — otherwise every host unmount leaks one Dart-side listener
// subscription + its closure on the JS heap.
const _streamsByNode = new Map();

// Remove one callId from a node's live-stream index, dropping the Set
// when it empties. Shared by unsubscribe and the terminal-event paths
// (done/error) so no path can forget the index half of the cleanup.
function _dropStreamIndex(nodeId, callId) {
  const idx = _streamsByNode.get(nodeId);
  if (!idx) return;
  idx.delete(callId);
  if (idx.size === 0) _streamsByNode.delete(nodeId);
}

export function diffCacheReleaseNode(nodeId) {
  const row = nodeIdToRow.get(nodeId);
  if (row !== undefined) {
    nodeIdToRow.delete(nodeId);
    freeRows.push(row);
    // Reset the hot-prop row too — it shares the same row index so
    // recycling this row for a different node would otherwise see
    // stale hot-prop "last values."
    const hotBase = row * HOT_PROPS_PER_NODE;
    diffHotF32.fill(NaN, hotBase, hotBase + HOT_PROPS_PER_NODE);
  }
  // Drop per-node custom-prop rows so a recycled nodeId doesn't see
  // stale name-hash → value mappings from its previous incarnation.
  _customCacheU32.delete(nodeId);
  _customCacheF32.delete(nodeId);
  _customCacheStr.delete(nodeId);
  // Stream subscriptions: same recycling concern, but the Dart side
  // also needs to know to stop emitting. cancelStreamsForNode emits
  // an OP_UNSUBSCRIBE_STREAM per live callId, so the Dart-side
  // listener tears down before the next render frame.
  cancelStreamsForNode(nodeId);
}

// ───────────────────────────────────────────────────────────────────────
// Typed prop setters. Each does a diff-cache check first; if the value
// hasn't changed, it skips the wire write entirely (no opcode, no
// position bump, no commit dirty bit). Skipped writes don't count in
// `jsWritesPerSecond`.
//
// Free functions (not methods on an object) so bun's JIT can inline
// them at the call site — the per-call cost should be ~one TypedArray
// store and one position bump in the common case.
// ───────────────────────────────────────────────────────────────────────

let propWritesCounter = 0;
let propSkipsCounter  = 0;

const _f32buf  = new Float32Array(1);
const _u32view = new Uint32Array(_f32buf.buffer);

export function setPropU32(nodeId, key, value) {
  // | 0 normalizes the value to int32 — JS subtraction-then-equality
  // would mis-fire on JS numbers that aren't exact 32-bit. The Int32Array
  // load also yields a signed int, so this matches Dart's signed int.
  const v = value | 0;
  const slotIdx = KEY_TO_SLOT[key];
  if (slotIdx < 0) {
    // Key not in the diff-cache slot table — write it UNCACHED rather
    // than drop it. A missing KEY_TO_SLOT entry then costs a redundant
    // write, never a silently-lost prop.
    writeOp(OP_SET_PROP_U32, nodeId, key, v);
    propWritesCounter++;
    return;
  }
  const row = rowFor(nodeId);
  const slot = row * SLOTS_PER_NODE + slotIdx;
  // Two-step check: only consult the value cell if we've previously
  // stored something there. Every 32-bit pattern is a legitimate u32
  // prop value, so we can't reserve a sentinel — see hasValueU32.
  if (hasValueU32[slot] !== 0 && diffCacheU32[slot] === v) { propSkipsCounter++; return; }
  diffCacheU32[slot] = v;
  hasValueU32[slot] = 1;
  writeOp(OP_SET_PROP_U32, nodeId, key, v);
  propWritesCounter++;
}

export function setPropF32(nodeId, key, value) {
  const slotIdx = KEY_TO_SLOT[key];
  if (slotIdx < 0) {
    // Uncached fallback — see setPropU32.
    _f32buf[0] = value;
    writeOp(OP_SET_PROP_F32, nodeId, key, _u32view[0]);
    propWritesCounter++;
    return;
  }
  const row = rowFor(nodeId);
  const slot = row * SLOTS_PER_NODE + slotIdx;
  if (diffCacheF32[slot] === value) { propSkipsCounter++; return; }
  diffCacheF32[slot] = value;
  // Encode the f32 bit pattern into u32 — the host's drain calls
  // Float.fromBits to recover it. The single-element Float32Array trick
  // is the fastest way to get IEEE 754 bits in JS without a DataView.
  _f32buf[0] = value;
  writeOp(OP_SET_PROP_F32, nodeId, key, _u32view[0]);
  propWritesCounter++;
}

export function setPropStr(nodeId, key, value) {
  const slotIdx = KEY_TO_SLOT[key];
  if (slotIdx < 0) {
    // Uncached fallback — see setPropU32.
    writeString(value == null ? '' : String(value));
    const packedB0 = ((key & 0xFF) << 24) | (_strOffset & 0xFFFFFF);
    writeOp(OP_SET_PROP_STR, nodeId, packedB0, _strLength);
    propWritesCounter++;
    return;
  }
  const row = rowFor(nodeId);
  const slot = row * SLOTS_PER_NODE + slotIdx;
  if (diffCacheStr[slot] === value) { propSkipsCounter++; return; }
  diffCacheStr[slot] = value;
  writeString(value == null ? '' : String(value));
  // Wire format: b = (key << 24) | (offset & 0xFFFFFF); c = length.
  // 24-bit offset = 16 MiB addressable, far above the 512 KiB heap.
  // 8-bit key = 256 distinct prop keys, more than the namespace defines.
  // 32-bit length supports any string up to 4 GiB, though in practice
  // an entry can never exceed the 512 KiB heap.
  const packedB = ((key & 0xFF) << 24) | (_strOffset & 0xFFFFFF);
  writeOp(OP_SET_PROP_STR, nodeId, packedB, _strLength);
  propWritesCounter++;
}

// ── Hot-prop setters — direct routes, dedicated opcodes ─────────────
//
// Each hot prop has its own dedicated opcode AND a slot in the separate
// `diffHotF32` cache (declared above, alongside the cold cache).
//
// The host's drain dispatches each hot opcode directly to its
// dedicated notifier — no cold-prop fan-out, no full rebuild. Animation-
// frequency updates here cost zero composition work.

function setHotF32Indexed(nodeId, opcode, hotIdx, value) {
  const row = rowFor(nodeId);
  const slot = row * HOT_PROPS_PER_NODE + hotIdx;
  if (diffHotF32[slot] === value) { propSkipsCounter++; return; }
  diffHotF32[slot] = value;
  _f32buf[0] = value;
  writeOp(opcode, nodeId, 0, _u32view[0]);
  propWritesCounter++;
}

export function setOpacity     (nodeId, v) { setHotF32Indexed(nodeId, OP_SET_OPACITY,       0, v); }
export function setTranslationX(nodeId, v) { setHotF32Indexed(nodeId, OP_SET_TRANSLATION_X, 1, v); }
export function setTranslationY(nodeId, v) { setHotF32Indexed(nodeId, OP_SET_TRANSLATION_Y, 2, v); }
export function setScaleX      (nodeId, v) { setHotF32Indexed(nodeId, OP_SET_SCALE_X,       3, v); }
export function setScaleY      (nodeId, v) { setHotF32Indexed(nodeId, OP_SET_SCALE_Y,       4, v); }
export function setRotationZ   (nodeId, v) { setHotF32Indexed(nodeId, OP_SET_ROTATION_Z,    5, v); }

/**
 * Select the app-wide design system + brightness. Not node-scoped —
 * the host's SkalApp rebuilds its theme in response.
 *   mode:       0 = material, 1 = cupertino, 2 = adaptive (per-platform)
 *   brightness: 0 = light, 1 = dark
 * Accepts string aliases for ergonomics.
 */
const _DESIGN_MODES = { material: 0, cupertino: 1, adaptive: 2 };
const _BRIGHTNESSES = { light: 0, dark: 1 };
export function setDesign(mode, brightness) {
  const m = typeof mode === 'string' ? (_DESIGN_MODES[mode] ?? 0) : (mode | 0);
  const b = typeof brightness === 'string'
    ? (_BRIGHTNESSES[brightness] ?? 0)
    : (brightness | 0);
  writeOp(OP_SET_DESIGN, m, b, 0);
  scheduleCommit();
}

/**
 * Pull-to-refresh completion — tell the host the app has finished
 * refreshing so it can retract the `<listView onRefresh>` spinner.
 * Called by the renderer once the user's `onRefresh` Promise resolves.
 */
export function completeRefresh(nodeId) {
  writeOp(OP_COMPLETE_REFRESH, nodeId, 0, 0);
  scheduleCommit();
}

/**
 * Builder-mode <listView> row attachment — bind an already-created
 * subtree root as the row at `index`. Sparse + index-keyed on the host
 * (NOT the ordered children list); replacing an occupied index tears
 * the old row down host-side.
 */
export function listSetRow(listId, index, childId) {
  writeOp(OP_LIST_SET_ROW, listId, index, childId);
}

/**
 * Builder-mode <listView> row eviction. The host tears down the row's
 * whole subtree — callers must NOT also emit OP_REMOVE_NODE for it
 * (the renderer still disposes the Solid root and releases the JS-side
 * diff-cache rows).
 */
export function listClearRow(listId, index) {
  writeOp(OP_LIST_CLEAR_ROW, listId, index, 0);
}

/**
 * Imperative dialog API — FLUTTER_JS_COMPONENTS.md §10.2. Each call
 * crosses the bridge as an RPC on the root node and returns a Promise
 * that resolves with the chosen action's `value` (or null/undefined
 * on a barrier dismiss).
 *
 *   spec: { title?, message?, actions?: [{ label, value, style? }] }
 *
 * `style: 'destructive'` renders the action emphasized (red).
 *
 * The spec deliberately ships as a JSON STRING arg, not an object arg
 * (EVENT_ARG_JSON), even though the wire now supports objects. Reason:
 * version skew. JS hot reload is the default dev flow, so a newer JS
 * bundle routinely runs against an app binary built with an older
 * skal_flutter — and an old host's opMethodArg switch decodes the JSON
 * arg type as null, turning every dialog into an empty shell with no
 * error anywhere. The string shape is decodable by every host version;
 * new APIs (services) may use object args freely because no older host
 * ever dispatched them.
 */
export function showDialog(spec) {
  return invokeMethod(ROOT_NODE_ID, 'showDialog', [JSON.stringify(spec || {})]);
}
export function showActionSheet(spec) {
  return invokeMethod(
    ROOT_NODE_ID, 'showActionSheet', [JSON.stringify(spec || {})]);
}
export function showSnackbar(spec) {
  const s = typeof spec === 'string' ? { message: spec } : (spec || {});
  return invokeMethod(ROOT_NODE_ID, 'showSnackbar', [JSON.stringify(s)]);
}

/**
 * Imperative date / time pickers — §2. Like the dialog API, each call
 * is an RPC on the root node and returns a Promise.
 *
 *   showDatePicker({ initialDate?, firstDate?, lastDate? })
 *     — dates are ISO `YYYY-MM-DD` strings. Resolves to an ISO date
 *       string, or null if dismissed.
 *   showTimePicker({ initialHour?, initialMinute? })
 *     — ints. Resolves to a 24-hour `HH:MM` string, or null if dismissed.
 */
export function showDatePicker(spec) {
  return invokeMethod(
    ROOT_NODE_ID, 'showDatePicker', [JSON.stringify(spec || {})]);
}
export function showTimePicker(spec) {
  return invokeMethod(
    ROOT_NODE_ID, 'showTimePicker', [JSON.stringify(spec || {})]);
}

/**
 * The host's writable data directory for the persistence store. The
 * embedded runtime's `os.tmpdir()` can't see the macOS sandbox
 * container, so the store asks the host (which resolves it via
 * `path_provider`). Resolves to an absolute path, or '' on failure.
 */
export function getAppDataDir() {
  return invokeMethod(ROOT_NODE_ID, 'getDataDir', []);
}

// ───────────────────────────────────────────────────────────────────────
// Custom-widget machinery — name-keyed props + handlers + create.
//
// Built-in widgets identify their props with a u8 enum key (PROP_BG_COLOR
// = 0x20, etc.). Custom widgets identify their props with an arbitrary
// string name ("latitude", "onMapReady", …). The wire optimization:
// each unique name is hashed (FNV-1a 32-bit) and declared ONCE via
// OP_DECLARE_NAME — which writes the name to the string heap and tells
// the host to associate the hash with it. Every subsequent prop op
// carries just the hash. No heap traffic per write.
//
// `_nameHashes` is the JS-side intern table. The first write of any
// name pays for one heap entry + one OP_DECLARE_NAME op; thereafter
// the cost matches built-in prop writes (one 16-byte op).
// ───────────────────────────────────────────────────────────────────────

const _nameHashes = new Map();

// FNV-1a 32-bit. Computed over JS UTF-16 code units (not UTF-8 bytes) —
// the Dart side never recomputes the hash, it just receives it via
// OP_DECLARE_NAME and stores the mapping. So the hash function only
// needs to be deterministic + collision-resistant on its own.
function _fnv1a32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Get-or-create: return the cached hash for `name`, OR compute it,
// write the name to the string heap, emit OP_DECLARE_NAME, and cache.
function _internName(name) {
  let h = _nameHashes.get(name);
  if (h !== undefined) return h;
  h = _fnv1a32(name);
  writeString(name);
  writeOp(OP_DECLARE_NAME, h, _strOffset, _strLength);
  _nameHashes.set(name, h);
  return h;
}

// Create a custom (registry-dispatched) node. The host looks up `name`
// in SkalRegistry to know what real Flutter widget to build.
export function createCustomNode(nodeId, name) {
  const h = _internName(name);
  writeOp(OP_CREATE_CUSTOM_NODE, nodeId, h, 0);
}

// ── Custom-prop diff cache helpers ──────────────────────────────────
//
// The cache Maps themselves (_customCacheU32 / F32 / Str) live up
// near diffCacheReleaseNode — declared before any caller so there's
// no TDZ ambiguity. This block just defines the per-node row getter
// and the writer functions that consume the cache.

function _customRow(map, nodeId) {
  let row = map.get(nodeId);
  if (row === undefined) {
    row = new Map();
    map.set(nodeId, row);
  }
  return row;
}

export function setCustomPropU32(nodeId, name, value) {
  const h = _internName(name);
  const v = value >>> 0;
  const row = _customRow(_customCacheU32, nodeId);
  if (row.get(h) === v) { propSkipsCounter++; return; }
  row.set(h, v);
  writeOp(OP_SET_CUSTOM_PROP_U32, nodeId, h, v);
  propWritesCounter++;
}

export function setCustomPropF32(nodeId, name, value) {
  const h = _internName(name);
  const row = _customRow(_customCacheF32, nodeId);
  if (row.get(h) === value) { propSkipsCounter++; return; }
  row.set(h, value);
  // Float32 → u32 bit-pattern via aliased typed arrays (same trick as
  // the built-in setPropF32 just above). Mirror the variable names:
  // `_f32buf` is the Float32Array, `_u32view` is the Uint32Array view
  // over the same backing buffer. Writing the float, reading the u32
  // gives the IEEE-754 bit pattern that the wire passes verbatim and
  // the Dart side decodes back via _bitsToF32.
  _f32buf[0] = value;
  writeOp(OP_SET_CUSTOM_PROP_F32, nodeId, h, _u32view[0]);
  propWritesCounter++;
}

// String values cap at 255 chars (8-bit length, packed alongside the
// 24-bit heap offset in arg c). Beyond that, fall back to enum-keyed
// setPropStr or split the value. Per wire.dart's opSetCustomPropStr
// comment.
export function setCustomPropStr(nodeId, name, value) {
  const h = _internName(name);
  const s = value == null ? '' : String(value);
  const row = _customRow(_customCacheStr, nodeId);
  if (row.get(h) === s) { propSkipsCounter++; return; }
  row.set(h, s);
  writeString(s);
  const offset = _strOffset & 0xFFFFFF;
  const len = _strLength & 0xFF;
  const packed = (offset << 8) | len;
  writeOp(OP_SET_CUSTOM_PROP_STR, nodeId, h, packed);
  propWritesCounter++;
}

// Clear a custom prop from ALL Dart-side typed maps AND the JS dedup
// caches. The renderer calls this when a prop's value TYPE changes
// (number → string, string → object, …): the typed maps are
// insert-only, so without the clear a stale numeric slot permanently
// shadows a later string write for readers that probe the typed slot
// first. Purging the JS caches matters just as much — toggling
// 300 → 'fill' → 300 must NOT be deduped against the pre-clear 300,
// or the F32 slot stays empty on the way back.
export function clearCustomProp(nodeId, name) {
  const h = _internName(name);
  _customCacheU32.get(nodeId)?.delete(h);
  _customCacheF32.get(nodeId)?.delete(h);
  _customCacheStr.get(nodeId)?.delete(h);
  writeOp(OP_CLEAR_CUSTOM_PROP, nodeId, h, 0);
}

export function bindCustomHandler(nodeId, name, handlerId) {
  const h = _internName(name);
  writeOp(OP_BIND_CUSTOM_HANDLER, nodeId, h, handlerId);
}

// ───────────────────────────────────────────────────────────────────────
// Method invocation — JS → Dart RPC
//
// JSX side calls `await ref.takePicture()`. This module:
//
//   1. Allocates a fresh 32-bit callId (monotonic counter)
//   2. Stores the (resolve, reject) pair in a callId-keyed Map
//   3. Writes OP_METHOD_ARG for each positional arg (in order)
//   4. Writes OP_INVOKE_METHOD with (nodeId, methodNameHash, callId)
//   5. Returns the Promise
//
// Dart-side bridge accumulates args, looks up the node's dispatcher,
// invokes the method, writes EV_METHOD_REPLY (or EV_METHOD_ERROR) back
// through the event ring. __skal_drainEvents below routes by event kind:
// regular events → handlers map; replies → pendingCalls map.
// ───────────────────────────────────────────────────────────────────────

const pendingCalls = new Map();
// Per-stream callback table — keyed by callId, same id-space as
// pendingCalls (one nextCallId counter shared so the spaces don't
// overlap). Value shape: { onValue, onError?, onDone? }.
const streamHandlers = new Map();
// Seeded from the previous generation's high-water mark (persisted by the
// hot-reload cleanup below) so a reloaded bundle does NOT reuse call ids the
// host may still have in flight — a late RPC reply for a gen-1 call id would
// otherwise resolve an unrelated gen-2 call. Fresh on cold boot (undefined → 1).
let nextCallId = globalThis.__skalNextCallId || 1;

/**
 * Invoke a method on a Dart-side host's controller. Returns a Promise
 * that resolves with the method's return value (decoded per its
 * argType) or rejects with an error code string.
 *
 * @param {number} nodeId   The host's bridge node id.
 * @param {string} methodName  e.g. 'takePicture', 'pause'.
 * @param {Array<number|boolean>} args  Positional args, in order.
 */
// Pack `args` into one OP_METHOD_ARG per entry, in order, keyed by
// callId. Shared by invokeMethod + subscribeStream because their
// argument wire shape is identical — only the trailing op (INVOKE vs
// SUBSCRIBE) differs. Centralizing keeps the type-dispatch + string-
// encoding rules from drifting between the two paths.
//
// Order matters — Dart's dispatcher reads positional args in op-
// arrival order. Objects and arrays ship as EVENT_ARG_JSON (same heap
// packing as a string; Dart jsonDecodes on receipt), so a dispatcher
// gets a real Map/List. `null`, `undefined`, functions and symbols land
// as EVENT_ARG_VOID, which the Dart side maps to null in that arg slot.
//
// Payload law (docs/NATIVE_SUPPORT.md): the string heap is a budget
// invariant, not an elastic buffer. Pass paths and handles, never bulk
// bytes — do not stringify a base64 image into an arg.
// Write one string-backed method arg (STR or JSON discriminator).
// Returns false — WITHOUT having written any op — when the string
// alone exceeds the heap, so the caller can substitute a VOID op and
// keep the call's arg slots aligned. The payload law (PERFORMANCE.md)
// says bulk bytes should never be here in the first place; this makes
// violating it a warned-null instead of a wire desync.
function _writeStringArgOp(callId, s, discriminator) {
  try {
    writeString(s);
  } catch (e) {
    console.warn('[skal] RPC arg dropped: string/JSON arg exceeds the '
      + `string heap (${s.length} chars). Pass a path or handle instead `
      + 'of bulk bytes — see PERFORMANCE.md payload law.');
    return false;
  }
  const offset = _strOffset >>> 0;
  const lenAndType = discriminator | ((_strLength & 0xFFFFFF) << 8);
  writeOp(OP_METHOD_ARG, callId, lenAndType, offset);
  return true;
}

function _writeMethodArgs(callId, args) {
  for (let i = 0; i < args.length; i++) {
    const v = args[i];
    if (typeof v === 'number') {
      // Only encodings that survive the trip. `v | 0` silently WRAPS
      // integers outside int32 (Date.now() becomes a garbage negative),
      // and F32 rounds doubles that need the full 53 bits (GPS
      // coordinates drift by ~1e-6). Anything either encoding would
      // corrupt rides the JSON path instead — Dart jsonDecode returns
      // the exact num. RPC args are cold-path; the heap write is noise.
      if (Number.isInteger(v) && v >= -0x80000000 && v <= 0x7FFFFFFF) {
        writeOp(OP_METHOD_ARG, callId, EVENT_ARG_I32, v | 0);
      } else if (!Number.isInteger(v) && Math.fround(v) === v) {
        // f32 bit-cast via the same _f32buf scratch the prop-write uses.
        _f32buf[0] = v;
        writeOp(OP_METHOD_ARG, callId, EVENT_ARG_F32, _u32view[0]);
      } else if (Number.isFinite(v)) {
        writeString(String(v));
        const offset = _strOffset >>> 0;
        const lenAndType = EVENT_ARG_JSON | ((_strLength & 0xFFFFFF) << 8);
        writeOp(OP_METHOD_ARG, callId, lenAndType, offset);
      } else {
        // NaN / Infinity — not JSON-encodable; VOID → null, and the
        // dispatcher's own default applies.
        writeOp(OP_METHOD_ARG, callId, EVENT_ARG_VOID, 0);
      }
    } else if (typeof v === 'boolean') {
      writeOp(OP_METHOD_ARG, callId, EVENT_ARG_BOOL, v ? 1 : 0);
    } else if (typeof v === 'string') {
      // Write to the JS string heap. Layout: argType in the low byte
      // of word2, length in word2's upper 24 bits, offset (full 32
      // bits) in word3. Length is therefore bounded only by the heap
      // capacity (~768 KiB), not by the wire encoding — fine for any
      // realistic RPC string arg.
      //
      // writeString THROWS when a single string cannot fit the heap
      // even after a flush — and by this point earlier args' ops are
      // already in the ring, so letting it propagate would orphan them
      // (a callId with args but no INVOKE ever arriving) and throw
      // synchronously out of invokeMethod instead of rejecting.
      // Degrade the one oversized arg to VOID, loudly.
      if (!_writeStringArgOp(callId, v, EVENT_ARG_STR)) {
        writeOp(OP_METHOD_ARG, callId, EVENT_ARG_VOID, 0);
      }
    } else if (v !== null && (typeof v === 'object')) {
      // Objects + arrays → JSON, identical heap packing to a string;
      // only the discriminator differs so Dart knows to decode. A
      // non-serializable value (cyclic, BigInt, a live handle) throws
      // in stringify — degrade that one arg to VOID rather than
      // failing the whole call with a wire desync (the arg ops for
      // this callId are already partly written by now).
      let json;
      try {
        json = JSON.stringify(v);
      } catch (_) {
        json = undefined;
      }
      if (json === undefined || !_writeStringArgOp(callId, json, EVENT_ARG_JSON)) {
        writeOp(OP_METHOD_ARG, callId, EVENT_ARG_VOID, 0);
      }
    } else {
      writeOp(OP_METHOD_ARG, callId, EVENT_ARG_VOID, 0);
    }
  }
}

export function invokeMethod(nodeId, methodName, args) {
  const h = _internName(methodName);
  const callId = nextCallId++;
  // Emit OP_METHOD_ARG per arg BEFORE the invoke — Dart drains args
  // keyed by callId, picks them up when OP_INVOKE_METHOD arrives.
  _writeMethodArgs(callId, args);
  writeOp(OP_INVOKE_METHOD, nodeId, h, callId);
  scheduleCommit();
  return new Promise((resolve, reject) => {
    pendingCalls.set(callId, { resolve, reject });
  });
}

/**
 * Subscribe to a Dart-side `Stream<T>`. Emits OP_SUBSCRIBE_STREAM and
 * registers the callback in `streamHandlers`. Returns an unsubscribe
 * function — call it to send OP_UNSUBSCRIBE_STREAM and stop receiving
 * values.
 *
 * Wire shape matches invokeMethod for the subscribe op + args; the
 * difference is just the opcode (subscribe vs invoke). Dart's
 * dispatcher returns the Stream as-is; bridge does the `.listen` and
 * emits evStreamValue per element.
 *
 * @param {number} nodeId
 * @param {string} methodName  Dart-side method name (NO `$` suffix —
 *                             that's the JSX-side disambiguator).
 * @param {Array} args         Positional args (same encoding as invoke)
 * @param {Function} onValue   Called per emission with the decoded value
 * @param {{onError?: Function, onDone?: Function}} [opts]
 * @returns {Function}         Call to unsubscribe.
 */
export function subscribeStream(nodeId, methodName, args, onValue, opts) {
  const h = _internName(methodName);
  const callId = nextCallId++;
  // Same arg-pack pattern as invokeMethod.
  _writeMethodArgs(callId, args);
  writeOp(OP_SUBSCRIBE_STREAM, nodeId, h, callId);
  scheduleCommit();
  streamHandlers.set(callId, {
    nodeId,
    onValue,
    onError: opts && opts.onError,
    onDone: opts && opts.onDone,
  });
  // Index by nodeId so diffCacheReleaseNode can find and cancel all
  // outstanding subscriptions when the host unmounts. Without this,
  // each unmount leaks a Dart-side stream listener (and the JS-side
  // callback closure it pins) until the next reload.
  let nodeStreams = _streamsByNode.get(nodeId);
  if (nodeStreams === undefined) {
    nodeStreams = new Set();
    _streamsByNode.set(nodeId, nodeStreams);
  }
  nodeStreams.add(callId);
  return function unsubscribe() {
    if (!streamHandlers.has(callId)) return;  // already cleaned up
    streamHandlers.delete(callId);
    _dropStreamIndex(nodeId, callId);
    writeOp(OP_UNSUBSCRIBE_STREAM, callId, 0, 0);
    scheduleCommit();
  };
}

// _streamsByNode (the per-node index of live stream callIds) is
// declared above near diffCacheReleaseNode — both this function and
// the writer in subscribeStream consume it.

/**
 * Cancel every outstanding stream subscription owned by `nodeId`. Called
 * from diffCacheReleaseNode at host unmount. Idempotent — subsequent
 * calls are no-ops once the node's index entry is gone.
 */
export function cancelStreamsForNode(nodeId) {
  const idx = _streamsByNode.get(nodeId);
  if (idx === undefined) return;
  for (const callId of idx) {
    if (streamHandlers.has(callId)) {
      streamHandlers.delete(callId);
      writeOp(OP_UNSUBSCRIBE_STREAM, callId, 0, 0);
    }
  }
  _streamsByNode.delete(nodeId);
  scheduleCommit();
}

// ───────────────────────────────────────────────────────────────────────
// Event dispatch — the host writes events into the event ring and wakes
// the JS thread; the native bridge then runs `__skal_drainEvents()` which
// looks up handlers and calls them.
// ───────────────────────────────────────────────────────────────────────

const handlers = new Map();
// Same cross-generation continuity as nextCallId — a tap the host queued for a
// gen-1 handler id must not fire a gen-2 handler that happens to reuse that id.
let nextHandlerId = globalThis.__skalNextHandlerId || 1;

export function newHandlerId(fn) {
  const id = nextHandlerId++;
  handlers.set(id, fn);
  return id;
}

// Release a handler id when its owning reactive scope disposes (the
// renderer registers an onCleanup for every bound handler). Without
// this the map grows for the life of the process — normally bounded by
// node count, but a builder-mode <listView> that evicts and
// re-materializes rows on every scroll would grow it without bound.
// A late event addressed to a released id simply finds nothing and
// no-ops in the drain below.
export function releaseHandlerId(id) {
  handlers.delete(id);
}

// Record an error caught outside the event drain (e.g. a throwing
// renderItem in a builder-mode row) so `skalStatus()` surfaces it,
// mirroring the drain's own catch. console is safe here — the native
// console shim is installed long before any row materializes.
export function recordHandlerError(e) {
  lastHandlerError = (e && (e.stack || e.message || String(e))) || 'unknown';
  try { console.error('skal:', lastHandlerError); } catch (_) { /* ignore */ }
}

export function bindHandler(nodeId, eventKind, handlerId) {
  writeOp(OP_BIND_HANDLER, nodeId, eventKind, handlerId);
}

let lastEventSeq = 0n;
let lastHandlerError = null;
const EVENT_RING_BYTES = BRIDGE_SIZE - EVENT_RING_OFFSET;
const EVENT_RING_BASE32 = EVENT_RING_OFFSET >> 2;
const EVENT_RING_END32  = (EVENT_RING_OFFSET + EVENT_RING_BYTES) >> 2;
const EVENT_SAFETY      = (EVENT_RING_BYTES / 16) | 0;

// Float-decode scratch — single u32 ↔ f32 reinterpret without
// allocating per event. Same instance for every drain.
const _f32DecodeBuf = new ArrayBuffer(4);
const _f32DecodeF32 = new Float32Array(_f32DecodeBuf);
const _f32DecodeU32 = new Uint32Array(_f32DecodeBuf);

// UTF-8 decoder for reply-heap strings + JSON payloads. Shared across
// drains; calling .decode on a fresh subarray is allocation-light.
const _replyTextDecoder = new TextDecoder('utf-8');

/// Read `length` UTF-8 bytes starting at `offset` (byte offset into
/// the reply heap, NOT absolute). Used by the event drain when an
/// event arrives with eventArgStr / eventArgJson — Dart-produced
/// strings always live in the reply heap at REPLY_HEAP_OFFSET.
function readReplyString(offset, length) {
  if (length === 0) return '';
  return _replyTextDecoder.decode(
    u8.subarray(REPLY_HEAP_OFFSET + offset, REPLY_HEAP_OFFSET + offset + length),
  );
}

/// Advance the JS-side reply-heap read cursor past a just-consumed
/// (offset, length) span. Dart's _writeReplyString reads this header
/// slot when it's about to wraparound (writePos + len > heapSize) to
/// confirm no in-flight string event references bytes about to be
/// clobbered. If Dart wraps, it resets BOTH cursors to 0 — our next
/// bump starts fresh.
function _advanceReplyReadCursor(offset, length) {
  u32[H_REPLY_HEAP_READ_POS] = offset + length;
}

function _drainEvents() {
  const seq = Atomics.load(seqArr, B_EVENT_SEQ);
  if (seq === lastEventSeq) return;

  const writePos32 = EVENT_RING_BASE32 + (u32[H_EVENT_WRITE_POS] >> 2);
  let readPos32    = EVENT_RING_BASE32 + (u32[H_EVENT_READ_POS]  >> 2);
  const end32      = EVENT_RING_END32;
  const base32     = EVENT_RING_BASE32;

  let safety = EVENT_SAFETY;
  while (readPos32 !== writePos32 && safety-- > 0) {
    // Word 0 packs eventKind (byte 0) + argType (byte 1). Word 1 is
    // handlerId (or callId, for method replies). Word 2 holds the
    // typed arg payload (length for str/json). Word 3 holds the
    // heap offset (str/json only; reserved otherwise). See wire.dart.
    const word0     = u32[readPos32 + 0];
    const eventKind = word0 & 0xFF;
    const argType   = (word0 >>> 8) & 0xFF;
    const idSlot    = u32[readPos32 + 1];
    const argRaw    = u32[readPos32 + 2];
    const argOffset = u32[readPos32 + 3];

    // Decode the typed arg once — same shape for regular events AND
    // method replies. Five primitives + void. F32 reinterprets the
    // u32 bits via the shared scratch ArrayBuffer; STR/JSON read
    // bytes from the reply heap (Dart-produced strings live there).
    let arg = undefined;
    let hasArg = false;
    if (argType === EVENT_ARG_I32) {
      arg = argRaw | 0;
      hasArg = true;
    } else if (argType === EVENT_ARG_F32) {
      _f32DecodeU32[0] = argRaw;
      arg = _f32DecodeF32[0];
      hasArg = true;
    } else if (argType === EVENT_ARG_BOOL) {
      arg = argRaw !== 0;
      hasArg = true;
    } else if (argType === EVENT_ARG_STR) {
      // argRaw is the byte length; argOffset is the reply-heap offset.
      arg = readReplyString(argOffset, argRaw);
      hasArg = true;
      _advanceReplyReadCursor(argOffset, argRaw);
    } else if (argType === EVENT_ARG_JSON) {
      const raw = readReplyString(argOffset, argRaw);
      try { arg = JSON.parse(raw); }
      catch (_) { arg = raw; /* fall through to raw string */ }
      hasArg = true;
      _advanceReplyReadCursor(argOffset, argRaw);
    } else if (argType === EVENT_ARG_TUPLE) {
      const raw = readReplyString(argOffset, argRaw);
      try { arg = JSON.parse(raw); }
      catch (_) { arg = []; }
      hasArg = true;
      _advanceReplyReadCursor(argOffset, argRaw);
      // Note: handler invocation below SPREADS this array if it's
      // actually an array — the regular-event branch checks for it.
    } else if (argType === EVENT_ARG_VEC2) {
      // Two f32s packed in the payload words — no heap involved.
      // argRaw is component 0's bits, argOffset component 1's.
      _f32DecodeU32[0] = argRaw;
      const vx = _f32DecodeF32[0];
      _f32DecodeU32[0] = argOffset;
      const vy = _f32DecodeF32[0];
      arg = [vx, vy];
      hasArg = true;
      // SPREAD on the handler — see the regular-event branch.
    }

    if (eventKind === EV_METHOD_REPLY) {
      // RPC reply — resolve the pending Promise. The id slot is
      // callId, not handlerId. Pass `undefined` for void returns
      // (hasArg=false).
      const pending = pendingCalls.get(idSlot);
      if (pending) {
        pendingCalls.delete(idSlot);
        try { pending.resolve(hasArg ? arg : undefined); }
        catch (e) {
          lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
        }
      }
    } else if (eventKind === EV_METHOD_ERROR) {
      // RPC error — reject the pending Promise. Dart's _writeMethodError
      // now sends a descriptive string in `arg`; fall back to a generic
      // message if the legacy status-code path triggered somehow.
      const pending = pendingCalls.get(idSlot);
      if (pending) {
        pendingCalls.delete(idSlot);
        try {
          const msg = (typeof arg === 'string')
            ? arg
            : `skal RPC error (status ${arg})`;
          pending.reject(new Error(msg));
        } catch (e) {
          lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
        }
      }
    } else if (eventKind === EV_STREAM_VALUE) {
      // Stream element. Look up the active subscription's onValue,
      // call with the decoded value. The subscription stays open until
      // EV_STREAM_DONE or the dev unsubscribes.
      const sub = streamHandlers.get(idSlot);
      if (sub) {
        try { sub.onValue(hasArg ? arg : undefined); }
        catch (e) {
          lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
        }
      }
    } else if (eventKind === EV_STREAM_DONE) {
      // Stream completed. Fire onDone if registered, then clean up —
      // INCLUDING the per-node index: service streams live on the root
      // node, which never unmounts, so an index entry left behind here
      // accumulated forever for every naturally-completed stream (the
      // unsubscribe short-circuits on streamHandlers.has and could
      // never remove it).
      const sub = streamHandlers.get(idSlot);
      if (sub) {
        streamHandlers.delete(idSlot);
        _dropStreamIndex(sub.nodeId, idSlot);
        try { if (sub.onDone) sub.onDone(); }
        catch (e) {
          lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
        }
      }
    } else if (eventKind === EV_STREAM_ERROR) {
      // Stream errored. Fire onError if registered (defaults to a
      // console.warn-shaped log via lastHandlerError), clean up — same
      // index purge as the done path.
      const sub = streamHandlers.get(idSlot);
      if (sub) {
        streamHandlers.delete(idSlot);
        _dropStreamIndex(sub.nodeId, idSlot);
        try {
          if (sub.onError) sub.onError(new Error(
            typeof arg === 'string' ? arg : 'skal stream error'));
        } catch (e) {
          lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
        }
      }
    } else {
      // Regular event — fire the bound JSX handler.
      const fn = handlers.get(idSlot);
      if (fn) {
        try {
          if (!hasArg) {
            fn();
          } else if ((argType === EVENT_ARG_TUPLE || argType === EVENT_ARG_VEC2)
                     && Array.isArray(arg)) {
            // Multi-arg callback — spread the tuple / vec2 payload.
            fn(...arg);
          } else {
            fn(arg);
          }
        } catch (e) {
          // Capture into a module global so we can read it via skalStatus()
          // — calling console.error here crashes Bun's ConsoleObject in the
          // embedded environment (no stdio wired up yet).
          lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
        }
      }
    }
    readPos32 += 4;
    if (readPos32 >= end32) readPos32 = base32;
  }
  u32[H_EVENT_READ_POS] = (readPos32 - base32) << 2;
  lastEventSeq = seq;
}

// Install the event drain. On native DEV we route through the hot-reload
// coordinator's trampoline: the worker permanently caches the FIRST
// __skal_drainEvents it sees (patches/skal_entry.zig), so a re-evaluated
// bundle's new drain would otherwise never be called. The coordinator keeps a
// stable trampoline and we register THIS generation's drain as the live
// target. On web / non-native there's no in-VM re-eval, so install directly
// (zero indirection) — matching the original behavior exactly. In RELEASE the
// host sets `globalThis.__skalRelease` before this bundle loads (no reload can
// ever fire), so we skip the coordinator/trampoline + all createHotState/
// createRouter stash work entirely and install the drain directly too.
if (HAS_NATIVE_BRIDGE && typeof window === 'undefined' && !globalThis.__skalRelease) {
  const _hot = installHotCoordinator();
  _hot.setDrain(_drainEvents);
  // Reject this generation's in-flight RPCs on hot-reload teardown so awaiting
  // code fails fast instead of hanging on a promise the new generation will
  // never resolve. (The host cancels stream subscriptions via the tree reset.)
  _hot.configure({
    cleanup() {
      // Hand the next generation our id high-water marks FIRST — before the
      // reject loop below, whose user reject-handlers could throw — so they're
      // always persisted and the next generation never reuses ids the host may
      // still have in flight.
      globalThis.__skalNextCallId = nextCallId;
      globalThis.__skalNextHandlerId = nextHandlerId;
      for (const pending of pendingCalls.values()) {
        try { pending.reject(new Error('skal: hot reload')); } catch (_) { /* ignore */ }
      }
      pendingCalls.clear();
    },
  });
} else {
  globalThis.__skal_drainEvents = _drainEvents;
}

// Debug snapshot. `propWrites/propSkips` are diff-cache effectiveness
// counters — visible via `JSON.parse(skalStatus()).propSkips / (writes+skips)`
// from a JS console, or via host-side `propWritesLastDrain` /
// `coldPropsTouchedLastDrain` which measure the receive side.
globalThis.skalStatus = () => JSON.stringify({
  handlerCount: handlers.size,
  opSeq: Number(opSeq),
  lastEventSeq: Number(lastEventSeq),
  lastHandlerError,
  propWrites: propWritesCounter,
  propSkips: propSkipsCounter,
});

// ───────────────────────────────────────────────────────────────────────
// Node ID allocator — used by the renderer.
// ───────────────────────────────────────────────────────────────────────

export const ROOT_NODE_ID = 1;

let nextNodeId = 2;
export function allocNodeId() { return nextNodeId++; }
