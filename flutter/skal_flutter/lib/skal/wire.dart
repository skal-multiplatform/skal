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
const int hReplyHeapWritePos   = 44;   // u32 — Dart bumps after each reply-heap write

const int kHeaderSize     = 64;
const int kOpRingOffset   = kHeaderSize;
const int kOpRingSize     = 4 * 1024 * 1024;
// JS write-only string heap. Bump-allocated; resets when JS commits
// + the UI thread has drained past the high-water mark.
const int kStringHeapOff  = kOpRingOffset + kOpRingSize;
const int kStringHeapSize = 768 * 1024;   // was 1 MiB; trimmed 25% for reply heap
// Dart-side reply heap — JS reads only. Carries:
//   • String return values from RPC method invocations
//   • JSON-encoded object returns (XFile-style)
//   • String error messages (replaces the status-code shorthand)
// Bump-allocated by Dart; resets when the cursor approaches capacity
// AND the JS event-ring read position has caught up (so any in-flight
// string references in undrained events stay valid).
const int kReplyHeapOff   = kStringHeapOff + kStringHeapSize;
const int kReplyHeapSize  = 256 * 1024;
const int kBridgeSize     = 6 * 1024 * 1024;
const int kEventRingOffset = kReplyHeapOff + kReplyHeapSize;
const int kEventRingSize   = kBridgeSize - kEventRingOffset;

// ── Opcodes (1 byte; reader masks the low byte of the u32 opcode word) ─
const int opCreateNode       = 0x01;
const int opRemoveNode       = 0x02;
const int opInsertBefore     = 0x03;
// Like opCreateNode but for a custom (registry-dispatched) widget. The
// `nameHash` arg is a 32-bit FNV-1a of the widget name; the host looks
// up the matching builder in `SkalRegistry` to know what to construct.
// The name string itself is brought into the dictionary via a prior
// [opDeclareName] (emitted once per unique name).
const int opCreateCustomNode = 0x04;
const int opSetPropU32       = 0x10;
const int opSetPropF32       = 0x11;
const int opSetText          = 0x14;
const int opBindHandler      = 0x15;
const int opSetPropStr       = 0x16;
// ── Custom-widget props (name-keyed, not enum-keyed) ────────────────
//
// Where built-in widget props use a u8 enum key (propBgColor = 0x20,
// etc.), custom widgets identify their props by an arbitrary string
// name ("latitude", "onMapReady", ...). The wire optimization: each
// unique name is hashed (FNV-1a 32-bit) and declared ONCE with
// [opDeclareName], which writes the name to the string heap and
// associates it with the hash on the host side. Subsequent prop ops
// reference the name by hash only — no string-heap traffic per write.
//
// Wire shape for opDeclareName: (nameHash, nameHeapOffset, nameHeapLen).
// Wire shape for the four prop ops: (nodeId, nameHash, value).
// String values use the same packed (offset<<8 | len) encoding as
// opSetPropStr — values longer than 255 bytes need to be split or use
// the enum-keyed opSetPropStr fast path instead.
const int opDeclareName       = 0x17;
const int opSetCustomPropU32  = 0x18;
const int opSetCustomPropF32  = 0x19;
const int opSetCustomPropStr  = 0x1A;
const int opBindCustomHandler = 0x1B;
// Method invocation — JS → Dart RPC for controller-owning host widgets.
// JSX side: `await ref.takePicture()`. Wire shape:
//
//   opInvokeMethod(nodeId, methodNameHash, callId)
//
// The methodNameHash uses the same FNV-1a 32-bit + opDeclareName
// dictionary as custom-prop names. callId is a 32-bit JS-side counter
// that pairs the invocation with its reply (see evMethodReply below).
// Returns are delivered through the event ring under a callId key
// rather than handlerId, discriminated by the event kind byte.
//
// Method args (0..N) are sent as separate opMethodArg ops BEFORE the
// opInvokeMethod for the same callId. Dart accumulates args keyed by
// callId, drains them when the invoke arrives, then discards.
const int opInvokeMethod      = 0x1C;
const int opMethodArg         = 0x1D;
// Stream subscription — `ref.foo$(cb)` on JSX maps to a Dart-side
// `Stream<T>`-returning method. Wire shape mirrors opInvokeMethod:
// (nodeId, methodNameHash, callId). Args ship via opMethodArg ops
// BEFORE the subscribe (same as one-shot invokes). Dart `.listen`s
// the stream, stores the subscription keyed by callId; JS keeps the
// callback in its streamHandlers map. JS-initiated cancellation
// sends opUnsubscribeStream(callId).
const int opSubscribeStream   = 0x1E;
const int opUnsubscribeStream = 0x1F;
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
/// Custom widget — dispatched through `SkalRegistry`. The wire knows
/// the node is "something registered by name"; the actual widget name
/// comes from the prior [opCreateCustomNode]'s `nameHash` arg, looked
/// up in the name dictionary populated by [opDeclareName].
///
/// Lets devs (and codegen) bring arbitrary Flutter widgets — `GoogleMap`,
/// `VideoPlayer`, anything from pub.dev — into JSX with a 5-line
/// adapter, without touching the wire format.
const int wtCustom               = 8;

// ── Event kinds (u32 in JS, byte on the wire) ─────────────────────────
const int evClick        = 0x01;
const int evChange       = 0x02;
// Method-invocation reply. The "handlerId" slot (bytes 4-7 of the
// event record) carries the callId from the matching opInvokeMethod.
// JS side maintains a `Map<callId, {resolve, reject}>` and resolves
// the Promise when this event arrives. argType + argValueI32 encode
// the return value (eventArgVoid for `void`/`Future<void>` methods).
const int evMethodReply  = 0x03;
// Method-invocation failure. Same layout, but argType+argValueI32
// encode an error code or string-heap ref. The Promise rejects.
const int evMethodError  = 0x04;
// Stream emission events. evStreamValue carries one element of a
// subscribed Stream<T> (encoded via the standard argType + argValue
// + argHeapOffset triple). evStreamDone fires when the stream
// completes normally; evStreamError fires on stream error and carries
// the error message via the reply heap. All three use the
// handlerId/callId slot to identify the active subscription.
const int evStreamValue  = 0x05;
const int evStreamDone   = 0x06;
const int evStreamError  = 0x07;

// ── Event record layout (16 bytes per slot in the event ring) ────────
//
//   byte 0: eventKind (evClick / evChange / …)
//   byte 1: argType   (eventArgVoid / I32 / F32 / Bool / Str / Json)
//   bytes 2-3: reserved
//   bytes 4-7: handlerId / callId (i32) — discriminated by eventKind
//   bytes 8-11: argValueI32
//      • I32 / Bool  → the int value
//      • F32         → the float's u32 bit pattern
//      • Str / Json  → the string LENGTH in UTF-8 bytes
//      • Void        → 0
//   bytes 12-15: argHeapOffset (i32)
//      • Str / Json  → byte offset into the heap. For Dart-produced
//                      events (replies, error messages) this is offset
//                      into the REPLY heap (kReplyHeapOff). All other
//                      argTypes leave this slot at 0.
//      • everything else → reserved / 0
//
// JS-side reads at u32-aligned positions: word0 has kind+argType, word1
// has handlerId/callId, word2 has the argValue (or length for strings),
// word3 has the heap offset for string-shaped payloads.
const int eventArgVoid = 0x00;  // void Function() — no payload
const int eventArgI32  = 0x01;  // covers ValueChanged<int>
const int eventArgF32  = 0x02;  // covers ValueChanged<double>
const int eventArgBool = 0x03;  // 0/1, covers ValueChanged<bool>
// String — payload is (heapOffset << 8) | length, same packing the
// existing opSetCustomPropStr / opSetPropStr ops use. For JS-side
// producers (OP_METHOD_ARG carrying a String arg) the heap is the
// regular JS write heap at kStringHeapOff. For Dart-side producers
// (event-ring strings shipped via dispatchEvent / method replies)
// the heap is the REPLY heap at kReplyHeapOff — JS-read-only,
// Dart-write-only. See readReplyString on the JS side.
const int eventArgStr  = 0x04;
// JSON — same packing as eventArgStr (heap offset + length), but the
// receiver JSON.parses the payload before forwarding. Used for object
// returns from RPC methods (XFile, Map<String, …>, anything Dart's
// jsonEncode can serialize). The codegen-emitted host adapter calls
// jsonEncode for non-primitive returns; JS auto-parses on receipt.
const int eventArgJson = 0x05;
// Tuple — payload is a JSON-encoded ARRAY of positional args. JS
// SPREADS the array on the bound handler: `fn(...args)`. Used for
// multi-arg callbacks like `void Function(int, String)`. Distinct
// from `eventArgJson` (where the parsed value is passed as a single
// arg). The Dart side serializes the arg list with jsonEncode and
// dispatches via `bridge.dispatchEventTuple(handlerId, [a, b, c])`.
const int eventArgTuple = 0x06;

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
