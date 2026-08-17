// The JS half of chunked reply delivery — the reassembler.
//
// `packages/skal_flutter/test/reply_backpressure_test.dart` covers the
// SPLITTER: that Dart cuts an oversize payload into parts, marks only
// the last one with the real arg type, and never ends a part
// mid-codepoint. It cannot cover the reassembler, because the fake host
// it drives returns the parts as separate events and the test joins
// them itself — which is exactly what this side is supposed to do, so
// the assertion was on the test's own arithmetic.
//
// That gap shipped three live bugs (a dropped tail hung the caller
// forever, a hot reload spliced two generations' parts together, and an
// orphaned accumulation poisoned the next unrelated event that happened
// to reuse the id slot). All three live entirely on this side of the
// wire. So: play the host directly — write real event records into the
// ring, run the real `_drainEvents`, and assert on what the handler was
// actually called with.
//
// Setup note: bridge.js grabs its buffer at MODULE EVAL time from
// `globalThis.__skal_acquireBridge`, and bun shares the module registry
// across test files, so the first file to import it wins. Reuse
// whatever is installed rather than installing our own — see the long
// note in bridge.test.js.

import { test, expect, describe, beforeAll, beforeEach } from 'bun:test';

const BRIDGE_SIZE = 6 * 1024 * 1024;
const HEADER_SIZE = 64;

// Header + region offsets, duplicated from wire.dart / bridge.js on
// purpose: a test that imported them could not catch the module moving
// one out from under the host.
const HB_EVENT_SEQ       = 16;  // u64
const HB_EVENT_WRITE_POS = 24;  // u32
const HB_EVENT_READ_POS  = 28;  // u32

const OP_RING_SIZE     = 4 * 1024 * 1024;
const STRING_HEAP_SIZE = 768 * 1024;
const REPLY_HEAP_SIZE  = 256 * 1024;
const REPLY_HEAP_OFFSET = HEADER_SIZE + OP_RING_SIZE + STRING_HEAP_SIZE;
const EVENT_RING_OFFSET = REPLY_HEAP_OFFSET + REPLY_HEAP_SIZE;
const EVENT_RING_BYTES  = BRIDGE_SIZE - EVENT_RING_OFFSET;

// Event kinds (wire.dart).
const EV_CLICK        = 0x01;
const EV_STREAM_VALUE = 0x05;

// Arg types (wire.dart).
const ARG_STR       = 0x04;
const ARG_JSON      = 0x05;
const ARG_TUPLE     = 0x06;
const ARG_STR_CHUNK = 0x08;

let B;
let buf, u32, u8, seq64;

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
  B = await import('../src/bridge.js');
});

// The module's `lastEventSeq` and the ring cursors persist across tests
// (one module instance per process). Align read to write and drain once
// so each test starts from a quiet ring rather than inheriting a
// neighbour's records.
beforeEach(() => {
  u32[HB_EVENT_READ_POS >> 2] = u32[HB_EVENT_WRITE_POS >> 2];
  globalThis.__skal_drainEvents();
});

const encoder = new TextEncoder();

/// Write `s` into the reply heap at `offset`, as Dart's
/// _tryWriteReplyString would. Returns the BYTE length, which is what
/// the event record carries — not the code-unit count.
function hostWriteReply(offset, s) {
  const bytes = encoder.encode(s);
  u8.set(bytes, REPLY_HEAP_OFFSET + offset);
  return bytes.length;
}

/// Place one 16-byte event record, exactly as SkalBridge._placeEvent
/// does: kind + argType packed into word 0, id in word 1, then the
/// typed payload words.
function hostPlaceEvent(kind, argType, id, argRaw = 0, argOffset = 0) {
  const pos = u32[HB_EVENT_WRITE_POS >> 2];
  const base = EVENT_RING_OFFSET + pos;
  u8[base + 0] = kind;
  u8[base + 1] = argType;
  u8[base + 2] = 0;
  u8[base + 3] = 0;
  u32[(base >> 2) + 1] = id;
  u32[(base >> 2) + 2] = argRaw;
  u32[(base >> 2) + 3] = argOffset;
  u32[HB_EVENT_WRITE_POS >> 2] = (pos + 16) % EVENT_RING_BYTES;
  seq64[HB_EVENT_SEQ >> 3] += 1n;
}

/// Send `parts` as a chunked payload for `id`: every part but the last
/// as ARG_STR_CHUNK, the last carrying `finalArgType`. Mirrors
/// SkalBridge._dispatchChunked. Parts are laid out consecutively in the
/// reply heap because a real host cannot reuse a byte JS has not read.
function hostSendChunked(id, parts, finalArgType, kind = EV_CLICK) {
  let off = 0;
  parts.forEach((part, i) => {
    const len = hostWriteReply(off, part);
    const isLast = i === parts.length - 1;
    hostPlaceEvent(kind, isLast ? finalArgType : ARG_STR_CHUNK, id, len, off);
    off += len;
  });
}

/// Register a handler and capture every call's arguments.
function capturingHandler() {
  const calls = [];
  const id = B.newHandlerId((...args) => { calls.push(args); });
  return { id, calls };
}

describe('chunked reply reassembly', () => {
  test('parts accumulate and the final record delivers the whole string', () => {
    const h = capturingHandler();
    hostSendChunked(h.id, ['alpha-', 'beta-', 'gamma'], ARG_STR);

    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('alpha-beta-gamma');
  });

  test('a chunk part dispatches nothing on its own', () => {
    const h = capturingHandler();
    // Two parts, no terminator — the transfer is still open.
    hostPlaceEvent(EV_CLICK, ARG_STR_CHUNK, h.id, hostWriteReply(0, 'one'), 0);
    hostPlaceEvent(EV_CLICK, ARG_STR_CHUNK, h.id, hostWriteReply(8, 'two'), 8);

    globalThis.__skal_drainEvents();
    expect(h.calls.length).toBe(0);

    // The terminator releases exactly one call, with everything.
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(16, 'three'), 16);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('onetwothree');
  });

  test('a chunked JSON payload parses after reassembly, not before', () => {
    // The motivating case: an XFile-shaped reply that only becomes
    // valid JSON once the parts are joined. Each part alone is a parse
    // error, so this fails loudly if the join is skipped — and
    // bridge.js swallows JSON.parse errors into the raw string, which
    // is why the assertion is on the parsed VALUE, not on truthiness.
    const value = { path: '/tmp/x.png', bytes: 'q'.repeat(120), n: 42 };
    const json = JSON.stringify(value);
    const cut = Math.floor(json.length / 2);

    const h = capturingHandler();
    hostSendChunked(h.id, [json.slice(0, cut), json.slice(cut)], ARG_JSON);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toEqual(value);
  });

  test('a chunked tuple payload reassembles and still SPREADS', () => {
    // The tuple branch degrades to `arg = []` on a parse failure, which
    // calls the handler with NO arguments — silently the wrong arity
    // rather than an error.
    const json = JSON.stringify(['row', 7, true]);
    const cut = 5;

    const h = capturingHandler();
    hostSendChunked(h.id, [json.slice(0, cut), json.slice(cut)], ARG_TUPLE);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0]).toEqual(['row', 7, true]);
  });

  test('multi-byte codepoints survive a seam between parts', () => {
    // Parts are decoded INDIVIDUALLY (readReplyString runs a TextDecoder
    // per part, then the strings are joined), so this only holds while
    // the host cuts on codepoint boundaries. If someone deletes Dart's
    // continuation-byte backoff, the seam becomes U+FFFD — and the
    // decoder here is non-fatal, so nothing throws.
    const a = 'héllo wörld ';
    const b = '🎉 naïve café';

    const h = capturingHandler();
    hostSendChunked(h.id, [a, b], ARG_STR);
    globalThis.__skal_drainEvents();

    expect(h.calls[0][0]).toBe(a + b);
  });

  test('the accumulation is dropped once delivered, not reused', () => {
    const h = capturingHandler();
    hostSendChunked(h.id, ['first-', 'payload'], ARG_STR);
    globalThis.__skal_drainEvents();
    expect(h.calls[0][0]).toBe('first-payload');

    // A plain, unchunked event on the SAME id must not inherit anything.
    // Forgetting the `_replyChunks.delete` makes this 'first-payloadnext'.
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(0, 'next'), 0);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(2);
    expect(h.calls[1][0]).toBe('next');
  });

  test('an unchunked event passes straight through', () => {
    const h = capturingHandler();
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(0, 'plain'), 0);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('plain');
  });
});

describe('chunk ownership', () => {
  test('parts orphaned under another event kind do not poison the id', () => {
    // handlerId and callId are independent sequences that both start at
    // 1, so an abandoned stream transfer on id N and a regular event on
    // handler N share a slot. Without the kind check the handler below
    // receives 'STALE-STALE-real', silently, in a completely unrelated
    // widget.
    const h = capturingHandler();
    hostPlaceEvent(EV_STREAM_VALUE, ARG_STR_CHUNK, h.id,
                   hostWriteReply(0, 'STALE-'), 0);
    hostPlaceEvent(EV_STREAM_VALUE, ARG_STR_CHUNK, h.id,
                   hostWriteReply(16, 'STALE-'), 16);
    globalThis.__skal_drainEvents();

    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(32, 'real'), 32);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('real');
  });

  test('a mismatched completion also frees the orphan', () => {
    // Discarding without deleting would leave the parts pinned and hand
    // the SAME stale prefix to every later event on this id.
    const h = capturingHandler();
    hostPlaceEvent(EV_STREAM_VALUE, ARG_STR_CHUNK, h.id,
                   hostWriteReply(0, 'STALE'), 0);
    globalThis.__skal_drainEvents();

    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(8, 'one'), 8);
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(16, 'two'), 16);
    globalThis.__skal_drainEvents();

    expect(h.calls.map((c) => c[0])).toEqual(['one', 'two']);
  });

  test('a new transfer displaces a stranded one rather than merging into it',
       () => {
    // The other half of the ownership rule, and the half a mismatch
    // check on the COMPLETING record alone cannot cover: parts arriving
    // under a new kind have to RESET the accumulation, not append to
    // whatever was stranded there.
    //
    // Appending instead is invisible until the end — the entry keeps the
    // stale kind, so the new transfer's own terminator is then rejected
    // as foreign and every part it accumulated is thrown away with it.
    // The handler fires with just the tail: a silently short payload,
    // from a transfer that was never in any trouble.
    const h = capturingHandler();
    hostPlaceEvent(EV_STREAM_VALUE, ARG_STR_CHUNK, h.id,
                   hostWriteReply(0, 'STRANDED'), 0);
    globalThis.__skal_drainEvents();

    hostPlaceEvent(EV_CLICK, ARG_STR_CHUNK, h.id, hostWriteReply(16, 'p1'), 16);
    hostPlaceEvent(EV_CLICK, ARG_STR_CHUNK, h.id, hostWriteReply(24, 'p2'), 24);
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(32, 'tail'), 32);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('p1p2tail');
  });

  test('an empty terminator delivers the prefix instead of hanging', () => {
    // Dart's _abandonChunked closes a transfer the overflow ceiling
    // refused by sending the real arg type with an EMPTY payload. The
    // handler has to fire — a dropped tail used to mean the accumulated
    // parts sat in the map forever and the caller never settled.
    const h = capturingHandler();
    hostPlaceEvent(EV_CLICK, ARG_STR_CHUNK, h.id,
                   hostWriteReply(0, 'prefix-kept'), 0);
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, 0, 16);  // zero length
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('prefix-kept');
  });
});

// LAST in the file on purpose: beginReload() disposes the reactive root
// and resets the host tree for the whole module instance, which every
// other test here shares.
describe('hot reload', () => {
  test('a transfer in flight does not survive into the next generation', () => {
    // Ids are deliberately carried across generations (bridge.js hands
    // the next one its nextCallId / nextHandlerId high-water marks), so
    // an id live before a reload can be live again after it. Parts left
    // in _replyChunks would then be prepended to a payload from the NEW
    // generation — a silently short value, and short JSON that still
    // parses is the bad case, because it fails nowhere near the bridge.
    // PRECONDITION, asserted rather than assumed. bridge.js only registers
    // the cleanup that clears `_replyChunks` when, at ITS module eval,
    // HAS_NATIVE_BRIDGE is true AND `window` is undefined AND __skalRelease
    // is unset. bun shares the module registry across test files, so which
    // file evaluated bridge.js first decides that — and it is not the same
    // on every platform. This test failed on Linux CI (556/1) while passing
    // on macOS in isolation, in the full suite, and in CI's exact file
    // order. Without this check the symptom is a bare value mismatch that
    // says nothing about why.
    const cfg = globalThis.__skalHot && globalThis.__skalHot._cfg;
    expect({
      cleanupRegistered: !!(cfg && typeof cfg.cleanup === 'function'),
      hasNativeBridge: typeof globalThis.__skal_acquireBridge === 'function',
      windowDefined: typeof window !== 'undefined',
      releaseFlag: !!globalThis.__skalRelease,
    }).toEqual({
      cleanupRegistered: true,
      hasNativeBridge: true,
      windowDefined: false,
      releaseFlag: false,
    });

    const h = capturingHandler();
    hostPlaceEvent(EV_CLICK, ARG_STR_CHUNK, h.id,
                   hostWriteReply(0, 'GEN1-ORPHAN'), 0);
    globalThis.__skal_drainEvents();

    // Teardown runs bridge.js's registered cleanup, which clears the map.
    globalThis.__skalHot.beginReload();

    // Same id, new generation, completing record.
    hostPlaceEvent(EV_CLICK, ARG_STR, h.id, hostWriteReply(16, 'gen2'), 16);
    globalThis.__skal_drainEvents();

    expect(h.calls.length).toBe(1);
    expect(h.calls[0][0]).toBe('gen2');
  });
});
