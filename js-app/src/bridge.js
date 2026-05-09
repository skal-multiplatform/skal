// Skal bridge — wraps the shared 2 MiB DirectByteBuffer that the JS worker
// thread shares with Compose. This module is the lowest level: raw op
// writers, atomic seq counters, event dispatch.
//
// Higher-level code (the universal renderer in renderer.js) builds on top.

// ───────────────────────────────────────────────────────────────────────
// Buffer layout — must match Kotlin SkalBridge + skal_entry.zig.
// ───────────────────────────────────────────────────────────────────────

const BRIDGE_SIZE = 2 * 1024 * 1024;
const HEADER_SIZE = 64;
export const OP_RING_OFFSET = HEADER_SIZE;
export const OP_RING_SIZE = 1024 * 1024;
export const STRING_HEAP_OFFSET = OP_RING_OFFSET + OP_RING_SIZE;
export const STRING_HEAP_SIZE = 512 * 1024;
export const EVENT_RING_OFFSET = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;
const STRING_HEAP_END = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;

// Header layout — byte offsets, then derived u32 / BigInt64 indices.
const HB_OP_SEQ          = 0;   // u64
const HB_OP_WRITE_POS    = 8;   // u32
const HB_STR_WRITE_POS   = 12;  // u32
const HB_EVENT_SEQ       = 16;  // u64
const HB_EVENT_WRITE_POS = 24;  // u32
const HB_EVENT_READ_POS  = 28;  // u32

const H_OP_WRITE_POS    = HB_OP_WRITE_POS    >> 2;
const H_STR_WRITE_POS   = HB_STR_WRITE_POS   >> 2;
const H_EVENT_WRITE_POS = HB_EVENT_WRITE_POS >> 2;
const H_EVENT_READ_POS  = HB_EVENT_READ_POS  >> 2;

const B_OP_SEQ    = HB_OP_SEQ    >> 3;
const B_EVENT_SEQ = HB_EVENT_SEQ >> 3;

// Opcodes
export const OP_CREATE_NODE   = 0x01;
export const OP_REMOVE_NODE   = 0x02;
export const OP_INSERT_BEFORE = 0x03;
export const OP_SET_PROP_U32  = 0x10;
export const OP_SET_PROP_F32  = 0x11;
export const OP_SET_TEXT      = 0x14;
export const OP_BIND_HANDLER  = 0x15;

// Widget types
export const WT_BOX           = 0;
export const WT_COLUMN        = 1;
export const WT_ROW           = 2;
export const WT_TEXT          = 3;
export const WT_BUTTON        = 4;
export const WT_SCROLL_COLUMN = 5;

// Event kinds
export const EV_CLICK  = 0x01;
export const EV_CHANGE = 0x02;

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

let opSeq = 0n;
let opWritePos32 = OP_RING_OFFSET32;
let strWritePos = STRING_HEAP_OFFSET;

function resetFrame() {
  opWritePos32 = OP_RING_OFFSET32;
  strWritePos = STRING_HEAP_OFFSET;
}

export function writeOp(opcode, a, b, c) {
  const w = opWritePos32;
  if (w + 4 > OP_RING_END32) throw new Error('Skal: op ring overflow');
  // Opcode packs as a full u32 (high 24 bits zero); reader consumes byte 0.
  u32[w]     = opcode >>> 0;
  u32[w + 1] = a >>> 0;
  u32[w + 2] = b >>> 0;
  u32[w + 3] = c >>> 0;
  opWritePos32 = w + 4;
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
// Frame commit — Solid's effect flush calls this; Compose drains on the
// next vsync. Lossy single-buffer model (each commit overwrites the ring;
// renderer re-emits on every state change so UI converges to the latest).
// ───────────────────────────────────────────────────────────────────────

let scheduled = false;

function commit() {
  scheduled = false;
  u32[H_OP_WRITE_POS]  = (opWritePos32 - OP_RING_OFFSET32) << 2;
  u32[H_STR_WRITE_POS] = strWritePos - STRING_HEAP_OFFSET;
  opSeq += 1n;
  Atomics.store(seqArr, B_OP_SEQ, opSeq);
  resetFrame();
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
// Event dispatch — Compose writes events into the event ring and wakes
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
const EVENT_RING_BYTES = 2 * 1024 * 1024 - EVENT_RING_OFFSET;
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

// Debug snapshot.
globalThis.skalStatus = () => JSON.stringify({
  handlerCount: handlers.size,
  opSeq: Number(opSeq),
  lastEventSeq: Number(lastEventSeq),
  lastHandlerError,
});

// ───────────────────────────────────────────────────────────────────────
// Node ID allocator — used by the renderer.
// ───────────────────────────────────────────────────────────────────────

export const ROOT_NODE_ID = 1;

let nextNodeId = 2;
export function allocNodeId() { return nextNodeId++; }
