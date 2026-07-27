// Turning a HOT prop back off.
//
// Cold props are cleared with a wire op that drops the key
// (`opClearProp`). Hot props — the animation lane: opacity, translation,
// scale, rotation — took the `typeof value === 'number'` branch and
// silently returned on anything else, so `opacity={fading() ? 0.3 : null}`
// stuck at 0.3 forever. Exactly the defect the cold branch three lines
// below it had.
//
// They need no opcode of their own: every one is a transform or opacity
// component, and "absent" for those IS the identity value. Writing the
// identity through the existing hot setter costs one op on a lane that
// already exists, instead of a new opcode plus a drain case plus a clear
// path through `diffHotF32`.

import { test, expect, describe, beforeAll } from 'bun:test';

const BRIDGE_SIZE = 6 * 1024 * 1024;
const HEADER_SIZE = 64;
const OP_RING_OFFSET = HEADER_SIZE;
const HB_OP_WRITE_POS = 8;

// From bridge.js's opcode table.
const OP_SET_OPACITY = 0x20;
const OP_SET_SCALE_X = 0x23;

let R, B;
let buf, u32, u8;

// bridge.js binds BOTH of its host hooks once per process, at
// module-eval time — the buffer via `__skal_acquireBridge()` and the
// doorbell into a `const _notifyHost`. bun shares the module registry
// across test files, so the first file to import it wins both, and any
// other file that installs its own gets views over memory bridge.js
// never touches and a doorbell that is never called.
//
// So: reuse the installed buffer, and install a DISPATCHER for the
// doorbell that forwards to a mutable hook. Whichever file is running
// sets the hook; the function bridge.js captured stays valid.
function acquireSharedBridge(size) {
  if (typeof globalThis.__skal_acquireBridge !== 'function') {
    const owned = new ArrayBuffer(size);
    globalThis.__skal_acquireBridge = () => owned;
  }
  if (typeof globalThis.__skal_notifyHost !== 'function') {
    globalThis.__skal_notifyHost = () => { globalThis.__skal_onNotify?.(); };
  }
  return globalThis.__skal_acquireBridge();
}

beforeAll(async () => {
  buf = acquireSharedBridge(BRIDGE_SIZE);
  u32 = new Uint32Array(buf);
  u8 = new Uint8Array(buf);
  B = await import('../src/bridge.js');
  R = await import('../src/renderer.js');
});

const opWritePos = () => u32[HB_OP_WRITE_POS >> 2];

function opAt(ringByteOffset) {
  const p = OP_RING_OFFSET + ringByteOffset;
  return { opcode: u8[p], a: u32[(p >> 2) + 1], c: u32[(p >> 2) + 3] };
}

const publish = async () => {
  B.scheduleCommit();
  await new Promise((r) => queueMicrotask(r));
};

function opsSince(from, opcode) {
  const out = [];
  for (let at = from; at < opWritePos(); at += 16) {
    const op = opAt(at);
    if (op.opcode === opcode) out.push(op);
  }
  return out;
}

// f32 values ride as their IEEE-754 bit pattern in the `c` slot.
const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);
const bitsOf = (v) => { _f32[0] = v; return _u32[0]; };

describe('clearing a hot prop', () => {
  test('opacity resets to 1, not to nothing', async () => {
    const node = { id: 4101, tag: 'box' };
    R.setProp(node, 'opacity', 0.3);
    await publish();

    const at = opWritePos();
    R.setProp(node, 'opacity', null);
    await publish();

    const ops = opsSince(at, OP_SET_OPACITY);
    expect(ops.length).toBe(1);
    expect(ops[0].a).toBe(4101);
    expect(ops[0].c).toBe(bitsOf(1));
  });

  test('scaleX resets to 1', async () => {
    const node = { id: 4102, tag: 'box' };
    R.setProp(node, 'scaleX', 2.5);
    await publish();

    const at = opWritePos();
    R.setProp(node, 'scaleX', null);
    await publish();

    const ops = opsSince(at, OP_SET_SCALE_X);
    expect(ops.length).toBe(1);
    expect(ops[0].c).toBe(bitsOf(1));
  });

  test('a hot prop can be turned off and back on', async () => {
    const node = { id: 4103, tag: 'box' };
    R.setProp(node, 'opacity', 0.5);
    R.setProp(node, 'opacity', null);
    await publish();

    const at = opWritePos();
    R.setProp(node, 'opacity', 0.5);   // the SAME value as before
    await publish();

    // The identity write moved the diff cache off 0.5, so this is not
    // deduped away — otherwise a prop could be turned off but never on.
    const ops = opsSince(at, OP_SET_OPACITY);
    expect(ops.length).toBe(1);
    expect(ops[0].c).toBe(bitsOf(0.5));
  });

  test('a non-numeric, non-null value is still ignored', async () => {
    const node = { id: 4104, tag: 'box' };
    const at = opWritePos();
    R.setProp(node, 'opacity', 'nonsense');
    await publish();
    expect(opsSince(at, OP_SET_OPACITY)).toEqual([]);
  });
});
