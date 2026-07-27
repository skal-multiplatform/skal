// The JS half of the bridge — encoder, diff cache, and the §2b doorbell.
//
// `packages/skal_flutter/test/bridge_drain_test.dart` covers the Dart
// half: what the host does with a ring someone else filled. It cannot
// see whether JS put the right bytes there, or whether JS rang the
// doorbell at the right moments — and the doorbell's ringing RULE lives
// entirely on this side.
//
// That rule is not a heuristic and it is worth stating exactly, because
// getting it wrong is silent both ways. `__skal_notifyHost()` fires only
// for a batch containing a ROOT_NODE_ID-targeted invoke:
//
//   • `createSkalService('x').y()` routes through ROOT_NODE_ID, and node
//     1 exists from boot, so a root-targeted call can never outrun its
//     own CREATE_NODE.
//   • `ref.y()` on a host widget targets a real node id whose
//     CREATE_NODE may still be sitting undrained ahead of it. Ringing
//     for that would ask the host to dispatch against a node it has not
//     built yet.
//
// Ring too eagerly and you get that race, plus a port message per commit
// (measured, rejected — docs/TODO_OPTIMIZATIONS.md §2c). Ring too rarely
// and every service call costs a frame again, silently, because the Dart
// side degrades rather than failing.
//
// Setup note: bridge.js grabs its buffer at MODULE EVAL time from
// `globalThis.__skal_acquireBridge`, so the globals have to be installed
// before the dynamic import below. One module instance is shared by the
// whole file (ESM caches it), so assertions read cursors before/after
// rather than assuming a pristine ring.

import { test, expect, describe, beforeAll, beforeEach } from 'bun:test';

const BRIDGE_SIZE = 6 * 1024 * 1024;
const HEADER_SIZE = 64;
const OP_RING_OFFSET = HEADER_SIZE;

// Header byte offsets — from wire.dart / bridge.js. Duplicated on
// purpose: a test that imported them from the module under test could
// not catch the module moving one.
const HB_OP_SEQ = 0;
const HB_OP_WRITE_POS = 8;
const HB_LAST_DRAINED_SEQ = 32;

let B;              // the bridge module
let buf, u32, u8, seq64;
let doorbells;      // times __skal_notifyHost was called

beforeAll(async () => {
  buf = new ArrayBuffer(BRIDGE_SIZE);
  u32 = new Uint32Array(buf);
  u8 = new Uint8Array(buf);
  seq64 = new BigInt64Array(buf);
  doorbells = 0;

  globalThis.__skal_acquireBridge = () => buf;
  globalThis.__skal_notifyHost = () => { doorbells++; };

  B = await import('../src/bridge.js');
});

/// Read the u64 at a header byte offset as a Number.
const u64 = (byteOff) =>
  u32[byteOff >> 2] + u32[(byteOff >> 2) + 1] * 0x100000000;

const opWritePos = () => u32[HB_OP_WRITE_POS >> 2];
const opSeq = () => u64(HB_OP_SEQ);

/// Decode the 16-byte op at a byte offset into the ring.
function opAt(ringByteOffset) {
  const p = OP_RING_OFFSET + ringByteOffset;
  return {
    opcode: u8[p],
    a: u32[(p >> 2) + 1],
    b: u32[(p >> 2) + 2],
    c: u32[(p >> 2) + 3],
  };
}

/// Pretend the host drained everything published so far. The doorbell
/// gate reopens only when the host has caught up to the last ring, so
/// without this a test's second ring is legitimately suppressed.
function hostDrainedEverything() {
  seq64[HB_LAST_DRAINED_SEQ >> 3] = BigInt(opSeq());
}

/// Run JS's commit microtask.
const flush = () => new Promise((r) => queueMicrotask(r));

describe('op encoding', () => {
  test('writeOp lays down 16 bytes: opcode byte + three LE u32s', () => {
    const at = opWritePos();
    B.writeOp(0x2a, 7, 8, 9);

    expect(opWritePos()).toBe(at); // not published until commit
    const op = opAt(at);
    expect(op.opcode).toBe(0x2a);
    expect(op.a).toBe(7);
    expect(op.b).toBe(8);
    expect(op.c).toBe(9);
  });

  test('commit publishes the write position and bumps the seq', async () => {
    const seqBefore = opSeq();
    const posBefore = opWritePos();

    B.writeOp(0x01, 42, 0, 0);
    B.scheduleCommit();
    await flush();

    expect(opSeq()).toBe(seqBefore + 1);
    expect(opWritePos()).toBeGreaterThan(posBefore);
  });

  test('a commit with nothing written does not bump the seq', async () => {
    B.scheduleCommit();
    await flush();
    const seqBefore = opSeq();

    B.scheduleCommit();
    await flush();

    expect(opSeq()).toBe(seqBefore);
  });
});

describe('diff cache', () => {
  // The point of the cache is skipping a WIRE WRITE when the value is
  // unchanged — a button re-emitted because a sibling's signal changed
  // must not re-send its unchanged width.
  //
  // Measured through the published cursor rather than module internals:
  // `commit` publishes `H_OP_WRITE_POS`, so the delta across two commits
  // is exactly the bytes the encoder emitted between them.
  const PROP_WIDTH = 0x05;

  async function bytesWritten(fn) {
    B.scheduleCommit();
    await flush();
    const before = opWritePos();
    fn();
    B.scheduleCommit();
    await flush();
    return opWritePos() - before;
  }

  test('a repeated identical value emits nothing', async () => {
    expect(await bytesWritten(() => B.setPropU32(900, PROP_WIDTH, 123)))
      .toBe(16);
    expect(await bytesWritten(() => B.setPropU32(900, PROP_WIDTH, 123)))
      .toBe(0);
    expect(await bytesWritten(() => B.setPropU32(900, PROP_WIDTH, 124)))
      .toBe(16);
  });

  test('the cache is per (node, key), not global', async () => {
    await bytesWritten(() => B.setPropU32(902, PROP_WIDTH, 7));
    // Same key, same value, DIFFERENT node — must still be written.
    expect(await bytesWritten(() => B.setPropU32(903, PROP_WIDTH, 7)))
      .toBe(16);
  });

  test('releasing a node forgets its cached values', async () => {
    await bytesWritten(() => B.setPropU32(901, PROP_WIDTH, 55));
    expect(await bytesWritten(() => B.setPropU32(901, PROP_WIDTH, 55)))
      .toBe(0);

    B.diffCacheReleaseNode(901);

    // A recycled id must not inherit the previous occupant's values —
    // the new node genuinely has width 55 and the host has never been
    // told, because the swept node's CREATE_NODE reset it.
    expect(await bytesWritten(() => B.setPropU32(901, PROP_WIDTH, 55)))
      .toBe(16);
  });
});

describe('the §2b doorbell', () => {
  beforeEach(async () => {
    // Settle: drain whatever a previous test left pending, then tell the
    // gate the host is fully caught up.
    B.scheduleCommit();
    await flush();
    hostDrainedEverything();
    doorbells = 0;
  });

  test('does NOT ring for plain UI ops', async () => {
    B.setPropU32(910, 0x05, 1);
    B.setText(910, 'hello');
    B.scheduleCommit();
    await flush();

    expect(doorbells).toBe(0);
  });

  test('rings for a ROOT-targeted invoke', async () => {
    B.invokeMethod(B.ROOT_NODE_ID, 'svc.ping', []);
    await flush();

    expect(doorbells).toBe(1);
  });

  test('does NOT ring for an invoke on a non-root node', async () => {
    // `ref.method()` — the node's CREATE_NODE may still be undrained
    // ahead of the invoke, so waking the host now would dispatch
    // against a node it has not built.
    B.invokeMethod(912, 'doThing', []);
    await flush();

    expect(doorbells).toBe(0);
  });

  test('one ring per batch, not per call', async () => {
    for (let i = 0; i < 25; i++) {
      B.invokeMethod(B.ROOT_NODE_ID, 'svc.ping', []);
    }
    await flush();

    expect(doorbells).toBe(1);
  });

  test('coalesces: no second ring until the host catches up', async () => {
    B.invokeMethod(B.ROOT_NODE_ID, 'svc.a', []);
    await flush();
    expect(doorbells).toBe(1);

    // Host has NOT drained. A second ring buys nothing — the host is
    // already scheduled and will see these ops too — and the delivery
    // queue is unbounded, so a burst inside one heavy frame would
    // otherwise pile up a message per microtask batch.
    B.invokeMethod(B.ROOT_NODE_ID, 'svc.b', []);
    await flush();
    expect(doorbells).toBe(1);

    hostDrainedEverything();

    B.invokeMethod(B.ROOT_NODE_ID, 'svc.c', []);
    await flush();
    expect(doorbells).toBe(2);
  });

  test('a UI op batched with a root invoke rings once, and carries the '
    + 'UI op with it', async () => {
    // `setLoading(true); api.fetch()` — ONE commit batch. The doorbell
    // drains the whole ring, so the prop write goes off-frame too. That
    // is the shape that stranded updates until the Dart side learned to
    // flush deferred notifications (§2c).
    B.setPropU32(913, 0x05, 200);
    B.invokeMethod(B.ROOT_NODE_ID, 'api.fetch', []);
    await flush();

    expect(doorbells).toBe(1);
  });
});
