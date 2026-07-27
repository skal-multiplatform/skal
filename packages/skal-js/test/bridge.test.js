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
  seq64 = new BigInt64Array(buf);
  doorbells = 0;

  // Claim the doorbell hook. Setting `__skal_notifyHost` directly would
  // be too late if another file imported bridge.js first — it captured
  // whatever was there. The dispatcher forwards here.
  globalThis.__skal_onNotify = () => { doorbells++; };

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

  // These two used to assert the OPPOSITE — that plain UI ops and
  // non-root invokes must not ring. That rule was narrower than it
  // needed to be on a stated rationale that does not hold (see the
  // comment above `_notifyHost`: the host drains IN ORDER, so a ring
  // cannot dispatch against an unbuilt node), and the host now depends
  // on being woken for ANY work, because its frame ticker is allowed to
  // stop when idle. A publish that does not ring is a frozen app.
  test('rings for plain UI ops', async () => {
    B.setPropU32(910, 0x05, 1);
    B.setText(910, 'hello');
    B.scheduleCommit();
    await flush();

    expect(doorbells).toBe(1);
  });

  test('does NOT ring when nothing was published', async () => {
    // The genuine no-op: a commit with an empty batch. Waking the host
    // to look at an unchanged ring is pure overhead.
    hostDrainedEverything();
    const before = doorbells;
    B.scheduleCommit();
    await flush();

    expect(doorbells).toBe(before);
  });

  test('rings for a ROOT-targeted invoke', async () => {
    B.invokeMethod(B.ROOT_NODE_ID, 'svc.ping', []);
    await flush();

    expect(doorbells).toBe(1);
  });

  test('rings for an invoke on a non-root node too', async () => {
    // `ref.method()`. The old rule refused this, reasoning that the
    // node's CREATE_NODE might still be undrained ahead of the invoke.
    // It can be — and that is fine: the ring makes the host drain the
    // ring IN ORDER, so the CREATE_NODE is applied first, by
    // construction. There was never a race here to avoid.
    hostDrainedEverything();
    const before = doorbells;
    B.invokeMethod(912, 'doThing', []);
    await flush();

    expect(doorbells).toBe(before + 1);
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

describe('oversize custom prop strings', () => {
  // The wire packs a custom prop's value as (24-bit heap offset << 8 |
  // 8-bit length). The length used to be written as `_strLength & 0xFF`,
  // so a 300-byte value advertised 300 & 0xFF = 44 and the host read a
  // 44-byte prefix of it — a silently wrong value, and a torn one when
  // the cut landed inside a multi-byte sequence.
  const STR_HEAP_OFFSET = HEADER_SIZE + 4 * 1024 * 1024;
  const OP_SET_CUSTOM_PROP_STR = 0x1A;   // wire.dart opSetCustomPropStr

  // setCustomPropStr may emit an intern op for a first-seen name, so
  // the prop op is not necessarily the first one written. Bound the
  // scan by the PUBLISHED cursor, which is why each case commits — an
  // earlier draft scanned a fixed window from an un-advancing
  // `opWritePos()` and every case silently re-read the first one's op.
  async function customStrOpSince(from) {
    B.scheduleCommit();
    await flush();
    for (let at = from; at < opWritePos(); at += 16) {
      const op = opAt(at);
      if (op.opcode === OP_SET_CUSTOM_PROP_STR) return op;
    }
    throw new Error('no OP_SET_CUSTOM_PROP_STR written');
  }

  const decode = (off, len) =>
    new TextDecoder('utf-8', { fatal: true })
      .decode(u8.subarray(STR_HEAP_OFFSET + off, STR_HEAP_OFFSET + off + len));

  test('a value at the 255-byte limit is sent whole', async () => {
    const at = opWritePos();
    const value = 'a'.repeat(255);
    B.setCustomPropStr(9001, 'exact', value);

    const op = await customStrOpSince(at);
    expect(op.c & 0xFF).toBe(255);
    expect(decode(op.c >>> 8, op.c & 0xFF)).toBe(value);
  });

  test('an over-length ASCII value is truncated to 255, not masked', async () => {
    const at = opWritePos();
    B.setCustomPropStr(9002, 'long', 'b'.repeat(300));

    const op = await customStrOpSince(at);
    const len = op.c & 0xFF;
    expect(len).not.toBe(300 & 0xFF);   // 44 — the old, wrong answer
    expect(len).toBe(255);
    expect(decode(op.c >>> 8, len)).toBe('b'.repeat(255));
  });

  test('truncation lands on a codepoint boundary', async () => {
    // '€' is 3 UTF-8 bytes and 255 is not a multiple of 3, so a blind
    // cut at 255 splits the 85th character.
    const at = opWritePos();
    B.setCustomPropStr(9003, 'euro', '€'.repeat(120)); // 360 bytes

    const op = await customStrOpSince(at);
    const len = op.c & 0xFF;
    expect(len).toBe(255);              // 255 IS divisible by 3 — 85 chars
    // `fatal: true` makes this throw on a split sequence.
    expect(decode(op.c >>> 8, len)).toBe('€'.repeat(85));
  });

  test('a split sequence is backed off rather than sent torn', async () => {
    // 'é' is 2 bytes; 127 of them is 254, the 128th straddles 255.
    const at = opWritePos();
    B.setCustomPropStr(9004, 'accent', 'é'.repeat(200)); // 400 bytes

    const op = await customStrOpSince(at);
    const len = op.c & 0xFF;
    expect(len).toBe(254);              // backed off from 255
    expect(decode(op.c >>> 8, len)).toBe('é'.repeat(127));
  });
});

describe('clearing a built-in cold prop', () => {
  // Setting a cold prop to null used to emit nothing at all — the
  // renderer called it "leave as previous". That made a removal
  // unrepresentable on the wire, so `bg={active ? RED : null}` painted
  // red forever once it had been red once.
  const OP_CLEAR_PROP = 0x2D;

  function opsSince(from) {
    const out = [];
    for (let at = from; at < opWritePos(); at += 16) out.push(opAt(at));
    return out;
  }
  const publish = async () => { B.scheduleCommit(); await flush(); };

  test('a null after a value emits OP_CLEAR_PROP', async () => {
    B.setPropU32(7101, B.PROP_BG_COLOR, 0xFFFF0000);
    await publish();

    const at = opWritePos();
    B.clearProp(7101, B.PROP_BG_COLOR);
    await publish();

    const cleared = opsSince(at).filter((o) => o.opcode === OP_CLEAR_PROP);
    expect(cleared.length).toBe(1);
    expect(cleared[0].a).toBe(7101);
    expect(cleared[0].b).toBe(B.PROP_BG_COLOR);
  });

  test('clearing a prop that was never set emits nothing', async () => {
    const at = opWritePos();
    B.clearProp(7102, B.PROP_CORNER_RADIUS);
    await publish();
    expect(opsSince(at).filter((o) => o.opcode === OP_CLEAR_PROP)).toEqual([]);
  });

  test('re-setting the SAME value after a clear is not deduped away', async () => {
    // The diff cache mirrors what the host holds. If a clear left the
    // old value cached, this second set would be skipped as a no-op and
    // the host would stay cleared — the prop could be turned off, but
    // then never back on.
    B.setPropU32(7103, B.PROP_WIDTH, 300);
    await publish();
    B.clearProp(7103, B.PROP_WIDTH);
    await publish();

    const at = opWritePos();
    B.setPropU32(7103, B.PROP_WIDTH, 300);   // same value as before
    await publish();

    const sets = opsSince(at).filter((o) => o.opcode === B.OP_SET_PROP_U32);
    expect(sets.length).toBe(1);
    expect(sets[0].c).toBe(300);
  });
});

describe('clearProp never-set probe', () => {
  const OP_CLEAR_PROP = 0x2D;
  const publish = async () => { B.scheduleCommit(); await flush(); };
  const clearOpsSince = (from) => {
    const out = [];
    for (let at = from; at < opWritePos(); at += 16) {
      const op = opAt(at);
      if (op.opcode === OP_CLEAR_PROP) out.push(op);
    }
    return out;
  };

  test('a slot holding a legitimately-stored NaN still clears', async () => {
    // NaN is a real f32 prop value (parseFloat of bad input, 0/0). The
    // probe used to read it as the "unset" sentinel and skip the wire
    // op, so the host kept the NaN and the widget never fell back.
    B.setPropF32(9201, B.PROP_HEIGHT, NaN);
    await publish();

    const at = opWritePos();
    B.clearProp(9201, B.PROP_HEIGHT);
    await publish();

    expect(clearOpsSince(at).length).toBe(1);
  });

  test('a slot holding a stored string still clears', async () => {
    B.setPropStr(9202, B.PROP_WIDTH, 'fill');
    await publish();

    const at = opWritePos();
    B.clearProp(9202, B.PROP_WIDTH);
    await publish();

    expect(clearOpsSince(at).length).toBe(1);
  });

  test('a genuinely untouched slot still emits nothing', async () => {
    const at = opWritePos();
    B.clearProp(9203, B.PROP_GAP);
    await publish();
    expect(clearOpsSince(at)).toEqual([]);
  });
});
