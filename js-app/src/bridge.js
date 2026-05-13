// Skal bridge — wraps the shared 2 MiB ArrayBuffer that the JS worker
// thread shares with the native host. This module is the lowest level: raw op
// writers, atomic seq counters, event dispatch.
//
// Higher-level code (the universal renderer in renderer.js) builds on top.

// ───────────────────────────────────────────────────────────────────────
// Buffer layout — must match flutter/skal_flutter/lib/skal/wire.dart
// + patches/skal_entry.zig.
// ───────────────────────────────────────────────────────────────────────

const BRIDGE_SIZE = 6 * 1024 * 1024;
const HEADER_SIZE = 64;
export const OP_RING_OFFSET = HEADER_SIZE;
export const OP_RING_SIZE = 4 * 1024 * 1024;
export const STRING_HEAP_OFFSET = OP_RING_OFFSET + OP_RING_SIZE;
export const STRING_HEAP_SIZE = 1024 * 1024;
export const EVENT_RING_OFFSET = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;
const STRING_HEAP_END = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;

// Header layout — byte offsets, then derived u32 / BigInt64 indices.
const HB_OP_SEQ           = 0;   // u64
const HB_OP_WRITE_POS     = 8;   // u32
const HB_STR_WRITE_POS    = 12;  // u32
const HB_EVENT_SEQ        = 16;  // u64
const HB_EVENT_WRITE_POS  = 24;  // u32
const HB_EVENT_READ_POS   = 28;  // u32
const HB_LAST_DRAINED_SEQ = 32;  // u64 — Dart bumps after each drain (JS spin-wait target)

// Reserved: bytes 40..43 hold Dart's drain checkpoint (u32). JS doesn't
// read it today; the seq above is sufficient for spin-wait synchronization.

const H_OP_WRITE_POS    = HB_OP_WRITE_POS    >> 2;
const H_STR_WRITE_POS   = HB_STR_WRITE_POS   >> 2;
const H_EVENT_WRITE_POS = HB_EVENT_WRITE_POS >> 2;
const H_EVENT_READ_POS  = HB_EVENT_READ_POS  >> 2;

const B_OP_SEQ            = HB_OP_SEQ            >> 3;
const B_EVENT_SEQ         = HB_EVENT_SEQ         >> 3;
const B_LAST_DRAINED_SEQ  = HB_LAST_DRAINED_SEQ  >> 3;

// ───────────────────────────────────────────────────────────────────────
// Opcodes — must match wire.dart exactly.
// ───────────────────────────────────────────────────────────────────────
export const OP_CREATE_NODE       = 0x01;
export const OP_REMOVE_NODE       = 0x02;
export const OP_INSERT_BEFORE     = 0x03;
export const OP_SET_PROP_U32      = 0x10;
export const OP_SET_PROP_F32      = 0x11;
export const OP_SET_TEXT          = 0x14;
export const OP_BIND_HANDLER      = 0x15;
export const OP_SET_PROP_STR      = 0x16;
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

// Widget types
export const WT_BOX           = 0;
export const WT_COLUMN        = 1;
export const WT_ROW           = 2;
export const WT_TEXT          = 3;
export const WT_BUTTON        = 4;
export const WT_SCROLL_COLUMN = 5;
// Lazy-rendered vertically-scrolling column. The host builds only the
// child widgets currently visible (ListView.builder on Flutter).
// Same NodeState graph as wt_column / wt_scrollColumn — the renderer
// just chooses a virtualizing layout.
export const WT_LAZY_COLUMN   = 6;

// Event kinds
export const EV_CLICK  = 0x01;
export const EV_CHANGE = 0x02;

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

// Image (string-valued)
export const PROP_IMAGE_SRC        = 0x60;
export const PROP_CONTENT_SCALE    = 0x61;

// Input (string-valued except enums)
export const PROP_PLACEHOLDER      = 0x80;
export const PROP_VALUE            = 0x81;
export const PROP_KEYBOARD_TYPE    = 0x82;
export const PROP_SECURE_ENTRY     = 0x83;

// Behavior
export const PROP_ENABLED          = 0xA0;
export const PROP_FOCUSABLE        = 0xA1;
export const PROP_VISIBLE          = 0xA2;

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
// native side (skal_entry.zig).
// ───────────────────────────────────────────────────────────────────────

const buffer = globalThis.__skal_acquireBridge();
if (!buffer || buffer.byteLength !== BRIDGE_SIZE) {
  throw new Error(`Skal: bridge buffer not available (got ${buffer && buffer.byteLength})`);
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

let opSeq = 0n;
let opWritePos32 = OP_RING_OFFSET32;
let strWritePos = STRING_HEAP_OFFSET;

// Tracks the writePos at which we last bumped opSeq. Auto-commit kicks
// in when (opWritePos32 - lastCommittedPos32) >= AUTO_COMMIT_OPS.
let lastCommittedPos32 = OP_RING_OFFSET32;

function resetFrame() {
  opWritePos32       = OP_RING_OFFSET32;
  strWritePos        = STRING_HEAP_OFFSET;
  lastCommittedPos32 = OP_RING_OFFSET32;
}

// Publish current write position to the host without resetting the
// ring. Used both by auto-commit (mid-batch progressive painting) and
// by flushAndWaitForDrain (overflow handling).
function publishProgress() {
  u32[H_OP_WRITE_POS]  = (opWritePos32 - OP_RING_OFFSET32) << 2;
  u32[H_STR_WRITE_POS] = strWritePos - STRING_HEAP_OFFSET;
  opSeq += 1n;
  Atomics.store(seqArr, B_OP_SEQ, opSeq);
  lastCommittedPos32 = opWritePos32;
}

// Overflow path — JS would write past the end of the ring. Publish
// what we have, spin until the host drains it, then reset writePos to
// the start of the ring so we can keep going. Cross-thread sync: the
// host is on Flutter's UI thread and drains in its Ticker callback;
// each spin iteration is a single atomic load (~ns). We bound the spin
// to 250 ms so a genuinely wedged UI thread surfaces an error instead
// of hanging forever.
function flushAndWaitForDrain() {
  publishProgress();
  const targetSeq = opSeq;
  // 5 s budget. Throwing here is dangerous in microtask context —
  // ChunkedFor's queued steps aren't wrapped in try/catch, and an
  // uncaught throw in a microtask blows through to bun's error
  // printer (which can itself segfault under heavy load). Instead,
  // log a warning and fall through to overwrite the ring. The host
  // will catch up eventually; in the worst case the user sees one
  // visually-stale chunk before the next drain resolves it.
  const deadline = performance.now() + 5000;
  while (true) {
    const drained = Atomics.load(seqArr, B_LAST_DRAINED_SEQ);
    if (drained >= targetSeq) break;
    if (performance.now() > deadline) {
      console.warn('Skal: drain spin timeout — UI thread slow; ring will overwrite');
      break;
    }
  }
  opWritePos32       = OP_RING_OFFSET32;
  strWritePos        = STRING_HEAP_OFFSET;
  lastCommittedPos32 = OP_RING_OFFSET32;
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
  const start = strWritePos - STRING_HEAP_OFFSET;
  const slot = u8.subarray(strWritePos, STRING_HEAP_END);
  const { read, written } = TEXT_ENCODER.encodeInto(s, slot);
  if (read !== s.length) {
    throw new Error(`Skal: string heap full (need ${s.length} code units, fit ${read})`);
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

// Round up to 32 for a tidy power-of-two row stride. Leaves room to
// add ~32 more cold props without resizing — beyond that, expand to 64.
const SLOTS_PER_NODE = 32;

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
  const slotIdx = KEY_TO_SLOT[key];
  if (slotIdx < 0) return; // unknown key — drop silently (no host rebuild, no wire byte spent)
  const row = rowFor(nodeId);
  const slot = row * SLOTS_PER_NODE + slotIdx;
  // | 0 normalizes the value to int32 — JS subtraction-then-equality
  // would mis-fire on JS numbers that aren't exact 32-bit. The Int32Array
  // load also yields a signed int, so this matches Dart's signed int.
  const v = value | 0;
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
  if (slotIdx < 0) return;
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
  if (slotIdx < 0) return;
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

// ───────────────────────────────────────────────────────────────────────
// Event dispatch — the host writes events into the event ring and wakes
// the JS thread; the native bridge then runs `__skal_drainEvents()` which
// looks up handlers and calls them.
// ───────────────────────────────────────────────────────────────────────

const handlers = new Map();
let nextHandlerId = 1;

export function newHandlerId(fn) {
  const id = nextHandlerId++;
  handlers.set(id, fn);
  return id;
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

globalThis.__skal_drainEvents = function () {
  const seq = Atomics.load(seqArr, B_EVENT_SEQ);
  if (seq === lastEventSeq) return;

  const writePos32 = EVENT_RING_BASE32 + (u32[H_EVENT_WRITE_POS] >> 2);
  let readPos32    = EVENT_RING_BASE32 + (u32[H_EVENT_READ_POS]  >> 2);
  const end32      = EVENT_RING_END32;
  const base32     = EVENT_RING_BASE32;

  let safety = EVENT_SAFETY;
  while (readPos32 !== writePos32 && safety-- > 0) {
    const handlerId = u32[readPos32 + 1];
    const fn = handlers.get(handlerId);
    if (fn) {
      try { fn(); } catch (e) {
        // Capture into a module global so we can read it via skalStatus()
        // — calling console.error here crashes Bun's ConsoleObject in the
        // embedded environment (no stdio wired up yet).
        lastHandlerError = e && (e.stack || e.message || String(e)) || 'unknown';
      }
    }
    readPos32 += 4;
    if (readPos32 >= end32) readPos32 = base32;
  }
  u32[H_EVENT_READ_POS] = (readPos32 - base32) << 2;
  lastEventSeq = seq;
};

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
