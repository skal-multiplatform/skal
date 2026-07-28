// Deferred element-frame staging.
//
// `dirty` is a Map keyed by store key, so only the LAST staging of a key
// ever reaches the engine. Writes inside a collection element used to
// encode the WHOLE element on every mutation anyway — measured at
// 278 600 bytes serialized to persist a final 463-byte frame, 99.8% of
// it thrown away before it could be written.
//
// Encoding is now deferred to the flush, the way INDEX_DIRTY has always
// worked for the collection index. That is only sound because a
// collection element's solid path is id-addressed (`{__id, hint}`), not
// index-addressed — so a splice that shifts indices still resolves to
// the same element, or to nothing, but never to a DIFFERENT one.
//
// These tests exist for that "or to nothing, but never a different one"
// clause. The win is worthless if the wrong bytes land.

import { test, expect, describe, beforeEach } from 'bun:test';
import { createSkalStore, STORE } from '../src/skal/store/db.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Two things this has to do.
//
// 1. Without an injected dir, `fetchDataDir` polls a host hook that does
//    not exist here — five attempts on 800 ms timeouts, ~5 s before it
//    gives up. Injecting one attaches the engine at once.
// 2. A FRESH dir per store. The JS engine path is
//    `openBackend(dataDir)` and does not incorporate `cfg.name` (only
//    the native path appends it), so every store sharing a dataDir
//    shares one segment directory — and each test hydrated the previous
//    test's todos. Isolation has to come from the directory.
function freshStore(initState) {
  globalThis.__skal_data_dir =
    fs.mkdtempSync(path.join(os.tmpdir(), 'skal-db-test-'));
  return createSkalStore(initState, { persist: true });
}

/// Reopen the SAME directory with a fresh store and return what
/// hydrates.
///
/// Every assertion here has to go through this. An earlier version of
/// this file checked the live Solid state instead — which is correct
/// whether or not the deferred encode reads the right object, because
/// the in-memory tree was never in doubt. Both mutations of the fix
/// (index-addressing the deferred path; dropping the removed-element
/// guard) passed that version. What is at stake is the BYTES, so the
/// bytes are what get read back.
async function reopen() {
  const s2 = createSkalStore({ todos: [] }, { persist: true });
  expect(await settle(s2)).toBe(true);
  return s2;
}

/// Build the collection by PUSHING, not by seeding initState.
///
/// Collections seeded in initState do not come back on reopen — only
/// pushed ones do. That is a real asymmetry (see the note at the bottom
/// of this file); here it just means the fixture has to match how an app
/// actually fills a list.
async function seeded(items) {
  const s = freshStore({ todos: [] });
  expect(await settle(s)).toBe(true);
  for (const it of items) s.todos.push(it);
  s[STORE].flushNow();
  return s;
}

/// Serialization work, so a test can prove the deferral rather than
/// assume it.
function countingStringify() {
  const real = JSON.stringify;
  let calls = 0, bytes = 0;
  JSON.stringify = function (...a) {
    calls++;
    const out = real.apply(this, a);
    if (typeof out === 'string') bytes += out.length;
    return out;
  };
  return {
    get calls() { return calls; },
    get bytes() { return bytes; },
    reset() { calls = 0; bytes = 0; },
    restore() { JSON.stringify = real; },
  };
}

const body = (n) => ({
  _id: n,
  title: 'record ' + n,
  meta: { created: 1700000000 + n },
  blurb: 'x'.repeat(200),
});

/// Wait for the engine to actually attach. `createSkalStore` opens its
/// backend asynchronously, and `doFlush` early-returns when `engine` is
/// null — so a test that does not wait here measures a store that was
/// never going to persist anything, and every "nothing was encoded"
/// assertion passes for the wrong reason. (It did. That is why this
/// exists.)
async function settle(s) {
  for (let i = 0; i < 400; i++) {
    if (s[STORE].ready()) return true;
    await new Promise((r) => setTimeout(r, 5));
  }
  return s[STORE].ready();
}

describe('deferred element frames', () => {
  test('a burst inside one element encodes once, not once per write', async () => {
    const s = await seeded([body(1), body(2)]);

    const counter = countingStringify();
    try {
      for (let i = 1; i <= 200; i++) s.todos[0].meta.created = i;
      expect(counter.calls).toBe(0);        // nothing encoded yet

      s[STORE].flushNow();
      expect(counter.calls).toBeGreaterThan(0);
      expect(counter.calls).toBeLessThan(5); // one frame, not 200
    } finally { counter.restore(); }
  });

  test('the last value written is the one persisted', async () => {
    const s = await seeded([body(1), body(2)]);
    for (let i = 1; i <= 50; i++) s.todos[0].meta.created = i;
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.length).toBe(2);
    expect(s2.todos[0].meta.created).toBe(50);
  });

  test('a splice before the flush does not persist the WRONG element', async () => {
    // The hazard the whole design rests on. Element 2 is edited, then
    // element 1 is removed, so the edited one moves to index 0. An
    // index-addressed deferred path would resolve `hint: 1` to element 3
    // and persist its body under element 2's key — invisible in live
    // state, wrong on reload. Hence the reopen.
    const s = await seeded([body(1), body(2), body(3)]);
    s.todos[1].title = 'edited-two';
    s.todos.shift();
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.length).toBe(2);
    expect(s2.todos[0].title).toBe('edited-two');
    expect(s2.todos[1].title).toBe('record 3');
  });

  test('an element removed before the flush persists nothing for it', async () => {
    // NB: this passes with the `live !== undefined` guard deleted, which
    // was checked. Removal routes through tombstoneTree, and that
    // overwrites the staged frame with a tombstone before the flush sees
    // it — so the guard is unreachable defence, not a tested path. The
    // test still earns its place: it pins that removal-during-a-window
    // ends with the element gone rather than half-written.
    const s = await seeded([body(1), body(2)]);
    s.todos[0].title = 'doomed';
    s.todos.shift();
    expect(() => s[STORE].flushNow()).not.toThrow();

    const s2 = await reopen();
    expect(s2.todos.length).toBe(1);
    expect(s2.todos[0].title).toBe('record 2');
  });

  test('writes to two elements in one window both survive', async () => {
    const s = await seeded([body(1), body(2), body(3)]);
    s.todos[0].title = 'first';
    s.todos[2].title = 'third';
    s.todos[0].meta.created = 111;
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.map((t) => t.title)).toEqual(['first', 'record 2', 'third']);
    expect(s2.todos[0].meta.created).toBe(111);
  });

  test('a nested array inside an element round-trips', async () => {
    const s = await seeded([{ _id: 1, tags: ['a', 'b'], meta: { n: 0 } }]);
    s.todos[0].tags.push('c');
    s.todos[0].meta.n = 7;
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos[0].tags).toEqual(['a', 'b', 'c']);
    expect(s2.todos[0].meta.n).toBe(7);
  });

  test('elements added during the window all survive', async () => {
    const s = await seeded([]);
    for (let i = 1; i <= 20; i++) s.todos.push({ _id: i, title: 't' + i });
    s.todos[5].title = 'edited';
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.length).toBe(20);
    expect(s2.todos[5].title).toBe('edited');
    expect(s2.todos[19].title).toBe('t20');
  });
});

// NOTE, found while building this: a collection seeded in `initState`
// does not come back on reopen, while one built by `push` does. Scalars
// round-trip either way. Not touched here — it is a separate bug from
// the staging change, and worth its own investigation.
