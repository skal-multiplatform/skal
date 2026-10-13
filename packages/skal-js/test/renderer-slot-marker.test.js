// The text nodes the renderer makes itself are flagged; <text> is not.
//
// `{cond ? <X/> : null}` among siblings leaves an empty text node behind
// as the slot's insertion anchor: `cleanChildren` in Solid's universal
// renderer calls our `createTextNode('')`. The host lays that marker out
// as nothing. An empty `<text label="">` is the app's own element (an
// error line keeping its space, a status that fades in) and keeps its
// line. Host-side both are an empty WT_TEXT, so OP_CREATE_NODE's third
// argument carries CREATE_ANON_TEXT for the nodes the renderer makes.

import { test, expect, describe, beforeAll } from 'bun:test';

const BRIDGE_SIZE = 6 * 1024 * 1024;
const HEADER_SIZE = 64;
const OP_RING_OFFSET = HEADER_SIZE;
const HB_OP_WRITE_POS = 8;

let R, B;
let buf, u32, u8;

// Shared with the other renderer tests: bridge.js binds its buffer and
// doorbell once per process (see renderer-hot-clear.test.js).
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

// Ops reach the header's write position on commit, a microtask later.
const publish = async () => {
  B.scheduleCommit();
  await new Promise((r) => queueMicrotask(r));
};

function opAt(ringByteOffset) {
  const p = OP_RING_OFFSET + ringByteOffset;
  return {
    opcode: u8[p],
    a: u32[(p >> 2) + 1],
    b: u32[(p >> 2) + 2],
    c: u32[(p >> 2) + 3],
  };
}

function createdSince(from) {
  const out = [];
  for (let at = from; at < opWritePos(); at += 16) {
    const op = opAt(at);
    if (op.opcode === B.OP_CREATE_NODE) out.push(op);
  }
  return out;
}

describe('which text nodes are flagged', () => {
  test('the flag is a bit no other create sets', () => {
    expect(B.CREATE_ANON_TEXT).toBe(1);
  });

  test('createTextNode flags its node', async () => {
    await publish();
    const at = opWritePos();
    const t = R.createTextNode('');
    await publish();
    const created = createdSince(at);
    expect(created).toEqual([
      { opcode: B.OP_CREATE_NODE, a: t.id, b: B.WT_TEXT, c: B.CREATE_ANON_TEXT },
    ]);
  });

  test('a string child is flagged whatever its text', async () => {
    // Solid reuses a string child's node with replaceText when the string
    // changes: `{status()}` going 'Saving…' -> '' is that node, emptied. The
    // flag is set once, at creation, so it must not depend on the text.
    await publish();
    const at = opWritePos();
    const t = R.createTextNode('Saving…');
    await publish();
    const created = createdSince(at);
    expect(created).toEqual([
      { opcode: B.OP_CREATE_NODE, a: t.id, b: B.WT_TEXT, c: B.CREATE_ANON_TEXT },
    ]);
  });

  test('a <text> element is not flagged', async () => {
    await publish();
    const at = opWritePos();
    const t = R.createElement('text');
    await publish();
    const created = createdSince(at);
    expect(created).toEqual([
      { opcode: B.OP_CREATE_NODE, a: t.id, b: B.WT_TEXT, c: 0 },
    ]);
  });

  test("Solid's null slot leaves a flagged marker", async () => {
    // <column>{cond() ? <X/> : null}<box/></column> with cond() false:
    // babel emits insert(column, …, box), and Solid inserts an empty
    // text node before the box to hold the slot's place.
    const column = R.createElement('column');
    const after = R.createElement('box');
    R.insertNode(column, after);
    await publish();
    const at = opWritePos();
    R.insert(column, null, after);
    await publish();
    const created = createdSince(at);
    expect(created.length).toBe(1);
    expect(created[0].b).toBe(B.WT_TEXT);
    expect(created[0].c).toBe(B.CREATE_ANON_TEXT);
  });
});
