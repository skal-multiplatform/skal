// Skal-app — counter demo running inside libskal.so, rendering through Compose.
//
// This single file contains:
//   1. Bridge — wraps the shared 2 MiB buffer JS↔Compose communicate over.
//   2. Reactive runtime — tiny Solid-shaped signals + effects (no VDOM).
//   3. Renderer — emits ops directly to the bridge.
//   4. The counter app.
//
// Performance choices:
//   • Single pre-resolved Uint32Array view over the shared ArrayBuffer.
//     No allocations in the op-write hot path. The opcode is packed into
//     a full u32 (high 24 bits left zero, reader only consumes byte 0)
//     so writeOp is exactly four u32 stores plus an index bump.
//   • Each op is exactly 16 bytes. Strings live in a separate "string heap"
//     and are referenced by (offset, length) packed into a u32. JS appends
//     ops + strings independently, both reset to 0 on each commit (frames
//     are full-replay; ring-management deferred).
//   • TextEncoder is a module-level singleton; encodeInto writes UTF-8
//     directly into the heap slice, no intermediate Uint8Array.
//   • Effects emit ops directly. No diffing, no VDOM. Solid's fine-grained
//     reactivity → 1 signal flip → 1 effect re-run → 1 op → 1 Compose state
//     mutation → 1 leaf composable recomposes.
//   • Effect flush uses two pre-allocated Sets ping-ponged across cycles —
//     no `[...set]` spread, no per-flush Set construction; re-entrant
//     setSignal calls during effect execution land in the swapped-out Set
//     and run on the next microtask.
//   • Commit = single Atomics.store on the seq counter. Compose reader
//     (running on the Choreographer/withFrameNanos callback) checks once
//     per frame.

// ───────────────────────────────────────────────────────────────────────
// Buffer layout — must match Kotlin SkalBridge + skal_entry.zig.
// ───────────────────────────────────────────────────────────────────────

const BRIDGE_SIZE = 2 * 1024 * 1024;
const HEADER_SIZE = 64;
const OP_RING_OFFSET = HEADER_SIZE;
const OP_RING_SIZE = 1024 * 1024;
const STRING_HEAP_OFFSET = OP_RING_OFFSET + OP_RING_SIZE;
const STRING_HEAP_SIZE = 512 * 1024;
const EVENT_RING_OFFSET = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;

// Header layout — byte offsets from start of buffer.
// Kotlin uses byte offsets directly (buffer.getInt(offset)). For JS we
// derive both the u32 array index (offset/4) and the BigInt64 array index
// (offset/8) below.
const HB_OP_SEQ        = 0;    // u64
const HB_OP_WRITE_POS  = 8;    // u32
const HB_STR_WRITE_POS = 12;   // u32
const HB_EVENT_SEQ     = 16;   // u64
const HB_EVENT_WRITE_POS = 24; // u32
const HB_EVENT_READ_POS  = 28; // u32

// Same offsets as u32-array indices (Uint32Array view).
const H_OP_WRITE_POS    = HB_OP_WRITE_POS    >> 2;  // 2
const H_STR_WRITE_POS   = HB_STR_WRITE_POS   >> 2;  // 3
const H_EVENT_WRITE_POS = HB_EVENT_WRITE_POS >> 2;  // 6
const H_EVENT_READ_POS  = HB_EVENT_READ_POS  >> 2;  // 7

// Same offsets as BigInt64-array indices (BigInt64Array view).
const B_OP_SEQ    = HB_OP_SEQ    >> 3;  // 0
const B_EVENT_SEQ = HB_EVENT_SEQ >> 3;  // 2

// Opcodes
const OP_CREATE_NODE   = 0x01;  // a=node_id, b=widget_type, c=parent_id
const OP_REMOVE_NODE   = 0x02;  // a=node_id
const OP_INSERT_BEFORE = 0x03;  // a=parent_id, b=child_id, c=anchor_id
const OP_SET_PROP_U32  = 0x10;  // a=node_id, b=prop_id, c=value
const OP_SET_PROP_F32  = 0x11;  // a=node_id, b=prop_id, c=f32 bits
const OP_SET_TEXT      = 0x14;  // a=node_id, c=string_ref
const OP_BIND_HANDLER  = 0x15;  // a=node_id, b=event_kind, c=handler_id

// Widget types
const WT_BOX = 0, WT_COLUMN = 1, WT_ROW = 2, WT_TEXT = 3, WT_BUTTON = 4;

// Prop IDs
const P_PADDING = 1, P_BACKGROUND = 2, P_FOREGROUND = 3, P_FONT_SIZE = 4;

// Event kinds
const EV_CLICK = 0x01, EV_CHANGE = 0x02;

// ───────────────────────────────────────────────────────────────────────
// 1. Bridge — owns the buffer + writer state.
// ───────────────────────────────────────────────────────────────────────

const buffer = globalThis.__skal_acquireBridge();
if (!buffer || buffer.byteLength !== BRIDGE_SIZE) {
  throw new Error(`Skal: bridge buffer not available (got ${buffer && buffer.byteLength})`);
}

const u8  = new Uint8Array(buffer);
const u32 = new Uint32Array(buffer);
// BigInt64Array view for atomic seq counters
const seqArr = new BigInt64Array(buffer);

// Singleton encoder — `new TextEncoder()` is cheap but still an allocation.
// One encoder is reusable across all writeString calls (TextEncoder is
// stateless modulo the encodeInto target).
const TEXT_ENCODER = new TextEncoder();

// Op ring constants pre-shifted to u32 indices so writeOp doesn't shift
// every call. We track ONLY the u32 index — the byte offset is derived
// in commit() so we don't pay two stores per writeOp.
const OP_RING_OFFSET32 = OP_RING_OFFSET >> 2;
const OP_RING_END32 = (OP_RING_OFFSET + OP_RING_SIZE) >> 2;
const STRING_HEAP_END = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;

let opSeq = 0n;        // local mirror of u64 op_seq we'll publish
let opWritePos32 = OP_RING_OFFSET32;
let strWritePos = STRING_HEAP_OFFSET;

function resetFrame() {
  opWritePos32 = OP_RING_OFFSET32;
  strWritePos = STRING_HEAP_OFFSET;
}

function writeOp(opcode, a, b, c) {
  const w = opWritePos32;
  if (w + 4 > OP_RING_END32) {
    throw new Error('Skal: op ring overflow');
  }
  // Pack opcode as a full u32 (high 24 bits left zero); the Kotlin reader
  // only consumes byte 0 (`buf.get(p) and 0xff`). Writing one u32 instead
  // of u8+u32 saves a memory access per op vs. the previous code, and
  // avoids leaving bytes 1..3 with stale data.
  u32[w]     = opcode >>> 0;
  u32[w + 1] = a >>> 0;
  u32[w + 2] = b >>> 0;
  u32[w + 3] = c >>> 0;
  opWritePos32 = w + 4;
}

function writeString(s) {
  // Write UTF-8 of s into the string heap, return packed (offset|len) u32.
  const start = strWritePos - STRING_HEAP_OFFSET;
  // Pass the full remaining heap as the encode target so encodeInto can
  // fit any string up to the heap budget. Validate `read === s.length`
  // afterwards; encodeInto silently truncates if the target is too small.
  const slot = u8.subarray(strWritePos, STRING_HEAP_END);
  const { read, written } = TEXT_ENCODER.encodeInto(s, slot);
  if (read !== s.length) {
    throw new Error(`Skal: string heap full (need ${s.length} code units, fit ${read})`);
  }
  if (start > 0xFFFF || written > 0xFFFF) {
    // Wire format packs (offset|length) as u16|u16. A frame can hold at
    // most 64 KiB of strings (well above any UI-realistic usage); a
    // single string is also capped at 64 KiB.
    throw new Error('Skal: string ref overflow (offset or length > 64 KiB)');
  }
  strWritePos += written;
  return (start << 16) | written;
}

function commit() {
  // Derive byte offset from the u32 index — saves one store per writeOp.
  u32[H_OP_WRITE_POS]  = (opWritePos32 - OP_RING_OFFSET32) << 2;
  u32[H_STR_WRITE_POS] = strWritePos - STRING_HEAP_OFFSET;
  opSeq += 1n;
  // Atomics.store gives release semantics: every write above this point
  // becomes visible to any thread that observes the new opSeq via an
  // acquire load (Kotlin's plain getLong on naturally-aligned u64 is
  // acquire-equivalent on ARM64).
  Atomics.store(seqArr, B_OP_SEQ, opSeq);
  // Lossy single-buffer model: each commit overwrites the ring from the
  // start. If Compose hasn't drained the previous commit by the time we
  // arrive here, those ops are dropped. That's acceptable because the
  // renderer emits incremental state changes — the next signal flip will
  // re-emit a SET_TEXT (etc.) and Compose converges to the latest state.
  // It would NOT be acceptable for an event-log model where each op must
  // be observed; we'd need double-buffering or a true ring with reader
  // ack for that.
  resetFrame();
}

// ───────────────────────────────────────────────────────────────────────
// 2. Reactive runtime — Solid-style signals + effects, ~40 lines.
//
// Performance notes:
//   • Two pre-allocated Sets ping-ponged across flushes — no `[...set]`
//     spread, no per-flush Set construction. Effects scheduled DURING a
//     flush land in the OTHER set and run next microtask cycle.
//   • Signal subscribers are a Set so duplicate reads from the same effect
//     are O(1) deduped.
//   • setSignal short-circuits with `Object.is` semantics (NaN-safe).
// ───────────────────────────────────────────────────────────────────────

let currentEffect = null;
let pendingEffects = new Set();
let runningEffects = new Set();
let scheduling = false;

function flushEffects() {
  scheduling = false;
  // Swap so re-entrant setSignal calls during effect execution land in the
  // other (empty) Set and get scheduled for the next microtask cycle —
  // rather than mutating the Set we're currently iterating.
  const toRun = pendingEffects;
  pendingEffects = runningEffects;
  runningEffects = toRun;
  for (const e of toRun) e();
  toRun.clear();
  // After all effects, commit the frame.
  commit();
}

function scheduleFlush() {
  if (scheduling) return;
  scheduling = true;
  // queueMicrotask gives effects a chance to batch within the current
  // synchronous run (e.g., multiple setSignal calls in one click handler).
  queueMicrotask(flushEffects);
}

function createSignal(initial) {
  let v = initial;
  const subs = new Set();
  return [
    () => {
      if (currentEffect !== null) subs.add(currentEffect);
      return v;
    },
    (next) => {
      if (Object.is(v, next)) return;
      v = next;
      for (const e of subs) pendingEffects.add(e);
      scheduleFlush();
    },
  ];
}

function effect(fn) {
  const run = () => {
    const prev = currentEffect;
    currentEffect = run;
    try { fn(); } finally { currentEffect = prev; }
  };
  run();
}

// ───────────────────────────────────────────────────────────────────────
// 3. Renderer — primitives that emit ops.
// ───────────────────────────────────────────────────────────────────────

const ROOT_NODE_ID = 1;
let nextNodeId = 2;
let nextHandlerId = 1;
const handlers = new Map();

// The root node is implicitly id=1 of widget-type Column. Emit an explicit
// CREATE so Compose can find it. parent=0 means "no parent" — Compose
// mounts this directly at SkalRoot's position in the tree.
writeOp(OP_CREATE_NODE, ROOT_NODE_ID, WT_COLUMN, 0);

function newNodeId() { return nextNodeId++; }
function newHandlerId(fn) {
  const id = nextHandlerId++;
  handlers.set(id, fn);
  return id;
}

function createNode(widgetType, parent) {
  const id = newNodeId();
  writeOp(OP_CREATE_NODE, id, widgetType, parent);
  return id;
}

function setText(id, text) {
  const ref = writeString(text);
  writeOp(OP_SET_TEXT, id, 0, ref);
}

function setPropU32(id, propId, value) {
  writeOp(OP_SET_PROP_U32, id, propId, value);
}

function bindHandler(id, eventKind, handlerId) {
  writeOp(OP_BIND_HANDLER, id, eventKind, handlerId);
}

function insertBefore(parent, child, anchor) {
  writeOp(OP_INSERT_BEFORE, parent, child, anchor);
}

// Tiny declarative helpers
function Column(parent, build) {
  const id = createNode(WT_COLUMN, parent);
  insertBefore(parent, id, 0);
  build(id);
  return id;
}
function Box(parent, build) {
  const id = createNode(WT_BOX, parent);
  insertBefore(parent, id, 0);
  build(id);
  return id;
}
function Text(parent, get) {
  const id = createNode(WT_TEXT, parent);
  insertBefore(parent, id, 0);
  // Text is reactive: re-runs whenever the signal it reads changes.
  effect(() => setText(id, get()));
  return id;
}
function Button(parent, label, onClick) {
  const id = createNode(WT_BUTTON, parent);
  insertBefore(parent, id, 0);
  setText(id, label);
  bindHandler(id, EV_CLICK, newHandlerId(onClick));
  return id;
}

// ───────────────────────────────────────────────────────────────────────
// 4. Counter app
// ───────────────────────────────────────────────────────────────────────

const [count, setCount] = createSignal(0);
const [bigBenchMs, setBigBenchMs] = createSignal(null);

// Build the static UI structure once. Reactive bits are wrapped in effect()s
// inside Text() so only the relevant Text node updates on signal change.
Column(ROOT_NODE_ID, (col) => {
  Text(col, () => `Count: ${count()}`);
  Button(col, "Increment", () => setCount(count() + 1));
  Button(col, "Decrement", () => setCount(count() - 1));
  Button(col, "+1000 (benchmark)", () => {
    const t1 = performance.now();
    for (let i = 0; i < 1000; i++) setCount(count() + 1);
    // The setSignal calls schedule one flush via queueMicrotask, so this
    // measures the time to run the handler; the actual UI commit happens
    // in the microtask after this returns.
    const ms = (performance.now() - t1).toFixed(3);
    setBigBenchMs(`+1000 in ${ms} ms (handler) — UI commits next microtask`);
  });
  Text(col, () => bigBenchMs() ?? "tap +1000 to benchmark fast-path");
});

// First commit publishes the initial frame.
commit();

// ───────────────────────────────────────────────────────────────────────
// 5. Event drain — Compose calls __skal_drainEvents after writing events.
// ───────────────────────────────────────────────────────────────────────

let lastEventSeq = 0n;

const EVENT_RING_BYTES = 2 * 1024 * 1024 - EVENT_RING_OFFSET;
// Ring boundaries pre-shifted to u32 indices so the inner drain loop
// advances u32-index, no per-iteration `>> 2`, no modulo (replaced by an
// inline wrap check).
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
    // Event record: [u8 kind | 3B pad | u32 handler_id | 8B reserved]
    const handlerId = u32[readPos32 + 1];
    const fn = handlers.get(handlerId);
    if (fn) {
      try { fn(); } catch (_) {}
    }
    readPos32 += 4;          // 16 bytes = 4 u32 slots
    if (readPos32 >= end32) readPos32 = base32; // wrap
  }
  u32[H_EVENT_READ_POS] = (readPos32 - base32) << 2;
  lastEventSeq = seq;
};

// Debug snapshot — call from Java via skal.evaluate("skalStatus()").
globalThis.skalStatus = () => JSON.stringify({
  nodeCount: nextNodeId - 2,
  handlerCount: handlers.size,
  opSeq: Number(opSeq),
  count: count(),
  lastEventSeq: Number(lastEventSeq),
  evWritePos: u32[H_EVENT_WRITE_POS],
  evSeqJs: Number(Atomics.load(seqArr, B_EVENT_SEQ)),
});

"skal-app initialized"
