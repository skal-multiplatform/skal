// Skal-app — counter demo running inside libskal.so, rendering through Compose.
//
// This single file contains:
//   1. Bridge — wraps the shared 2 MiB buffer JS↔Compose communicate over.
//   2. Reactive runtime — tiny Solid-shaped signals + effects (no VDOM).
//   3. Renderer — emits ops directly to the bridge.
//   4. The counter app.
//
// Performance choices:
//   • Pre-resolved Uint32Array / DataView views over the shared ArrayBuffer.
//     No allocations in the op-write hot path.
//   • Each op is exactly 16 bytes. Strings live in a separate "string heap"
//     and are referenced by (offset, length) packed into a u32. JS appends
//     ops + strings independently, both reset to 0 on each commit (frames
//     are full-replay; ring-management deferred).
//   • Effects emit ops directly. No diffing, no VDOM. Solid's fine-grained
//     reactivity → 1 signal flip → 1 effect re-run → 1 op → 1 Compose state
//     mutation → 1 leaf composable recomposes.
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

let opSeq = 0n;        // local mirror of u64 op_seq we'll publish
let opWritePos = OP_RING_OFFSET;
let strWritePos = STRING_HEAP_OFFSET;

function resetFrame() {
  opWritePos = OP_RING_OFFSET;
  strWritePos = STRING_HEAP_OFFSET;
}

function writeOp(opcode, a, b, c) {
  if (opWritePos + 16 > OP_RING_OFFSET + OP_RING_SIZE) {
    throw new Error('Skal: op ring overflow');
  }
  u8[opWritePos] = opcode;
  // bytes 1..3 unused; left zero from frame reset
  // u32 fields are at offset+4, +8, +12
  u32[(opWritePos >> 2) + 1] = a >>> 0;
  u32[(opWritePos >> 2) + 2] = b >>> 0;
  u32[(opWritePos >> 2) + 3] = c >>> 0;
  opWritePos += 16;
}

function writeString(s) {
  // Write UTF-8 of s into the string heap, return packed (offset|len) u32.
  const start = strWritePos - STRING_HEAP_OFFSET;
  // Use TextEncoder.encodeInto into the slice.
  const view = u8.subarray(strWritePos, strWritePos + 4096);
  const enc = new TextEncoder();
  const { written } = enc.encodeInto(s, view);
  strWritePos += written;
  if (start > 0xFFFF || written > 0xFFFF) {
    throw new Error('Skal: string ref overflow');
  }
  return (start << 16) | written;
}

function commit() {
  // Update header positions, then bump seq with release ordering.
  u32[H_OP_WRITE_POS] = opWritePos - OP_RING_OFFSET;
  u32[H_STR_WRITE_POS] = strWritePos - STRING_HEAP_OFFSET;
  opSeq += 1n;
  Atomics.store(seqArr, B_OP_SEQ, opSeq);
  // Reset for next frame after commit (Compose drains synchronously
  // before the next commit; we're effectively double-buffering by
  // restarting at the beginning of each frame).
  resetFrame();
}

// ───────────────────────────────────────────────────────────────────────
// 2. Reactive runtime — Solid-style signals + effects, ~30 lines.
// ───────────────────────────────────────────────────────────────────────

let currentEffect = null;
const effectsToRun = new Set();
let scheduling = false;

function flushEffects() {
  scheduling = false;
  const pending = [...effectsToRun];
  effectsToRun.clear();
  for (const e of pending) e();
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
      if (currentEffect) subs.add(currentEffect);
      return v;
    },
    (next) => {
      if (Object.is(v, next)) return;
      v = next;
      for (const e of subs) effectsToRun.add(e);
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

globalThis.__skal_drainEvents = function () {
  const seq = Atomics.load(seqArr, B_EVENT_SEQ);
  if (seq === lastEventSeq) return;

  // Drain everything between the last position we read and the current
  // write head. Ring wraps via modulo EVENT_RING_BYTES.
  const writePos = u32[H_EVENT_WRITE_POS];
  let readPos = u32[H_EVENT_READ_POS];

  // Cap iterations — one full wrap is the absolute max.
  let safety = (EVENT_RING_BYTES / 16) | 0;
  while (readPos !== writePos && safety-- > 0) {
    const evBase = EVENT_RING_OFFSET + readPos;
    const handlerId = u32[(evBase >> 2) + 1];
    const fn = handlers.get(handlerId);
    if (fn) {
      try { fn(); } catch (_) {}
    }
    readPos = (readPos + 16) % EVENT_RING_BYTES;
  }
  u32[H_EVENT_READ_POS] = readPos;
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
