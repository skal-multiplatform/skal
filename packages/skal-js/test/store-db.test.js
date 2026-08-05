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
// 2. A fresh dir per store. Store `name` now namespaces the JS engine
//    too, so this is belt-and-braces rather than load-bearing — but a
//    test that shares a directory with its neighbours is one refactor
//    away from being about the wrong thing.
// NB: persistence is controlled by `paths`, not by a `persist` flag —
// createSkalStore reads only name/paths/residentMax/version/migrate, so
// a `{ persist: true }` here was silently ignored and read as an opt-in
// that never existed. What actually makes these stores persist is
// `__skal_data_dir` being set.
function freshStore(initState) {
  globalThis.__skal_data_dir =
    fs.mkdtempSync(path.join(os.tmpdir(), 'skal-db-test-'));
  return createSkalStore(initState, {});
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
  const s2 = createSkalStore({ todos: [] }, {});
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

describe('collections seeded in initState', () => {
  // Initial state is deliberately not persisted — it lives in the app's
  // code, so an unchanged scalar hydrates to the same value either way.
  // For a COLLECTION that reasoning broke: editing an element staged
  // that element's frame, but the index `#x` is only staged when
  // membership changes, so the store held element bytes with no id list
  // to reach them by. hydrateArray found no index, left the array at its
  // initState value, and the edit was gone after a restart — with its
  // frame orphaned on disk.
  //
  // The persisted key sets are now identical whether a collection is
  // seeded or pushed: k:<c>#x plus one k:<c>.<id> per element.

  test('an edit to a seeded collection survives a restart', async () => {
    const s = freshStore({ todos: [body(1), body(2)] });
    expect(await settle(s)).toBe(true);

    s.todos[0].title = 'EDITED';
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.length).toBe(2);
    expect(s2.todos[0].title).toBe('EDITED');
    expect(s2.todos[1].title).toBe('record 2');
  });

  test('a seeded collection is fully addressable after first open', async () => {
    // Every element, not just the edited one — an index listing ids the
    // store has no frames for would rebuild a SHORTER array.
    const s = freshStore({ todos: [body(1), body(2), body(3)] });
    expect(await settle(s)).toBe(true);
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.map((t) => t.title))
        .toEqual(['record 1', 'record 2', 'record 3']);
  });

  test('pushing onto a seeded collection keeps both halves', async () => {
    const s = freshStore({ todos: [body(1)] });
    expect(await settle(s)).toBe(true);

    s.todos.push({ _id: 99, title: 'pushed' });
    s.todos[0].title = 'seeded-edited';
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.map((t) => t.title)).toEqual(['seeded-edited', 'pushed']);
  });

  test('removing a seeded element persists the removal', async () => {
    const s = freshStore({ todos: [body(1), body(2), body(3)] });
    expect(await settle(s)).toBe(true);

    s.todos.shift();
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos.map((t) => t.title)).toEqual(['record 2', 'record 3']);
  });

  test('an empty seeded collection stays empty, and writes nothing', async () => {
    const s = freshStore({ todos: [] });
    expect(await settle(s)).toBe(true);
    s[STORE].flushNow();

    const s2 = await reopen();
    expect(s2.todos).toEqual([]);
  });
});

describe('store isolation', () => {
  // The JS engine path took `openBackend(dataDir)` and never saw
  // `cfg.name` — only the native path appended it. So every store in a
  // process shared one segment directory: a second createSkalStore
  // hydrated the first one's data over its own initState.
  //
  // Not hypothetical and not new: docs/BENCHMARKS.md builds two stores
  // in one run (`RUN + '-warm'`, `RUN + '-frame'`) and relies on `name`
  // for isolation. That held on native and silently did not here, so
  // any bench arm measured on the JS engine could have been reading the
  // other arm's data.

  test('two stores in one data dir do not see each other', async () => {
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-iso-'));

    const a = createSkalStore({ value: 'from-A' },
      { persist: true, name: 'alpha' });
    expect(await settle(a)).toBe(true);
    a.value = 'A-WROTE';
    a[STORE].flushNow();

    const b = createSkalStore({ value: 'from-B' },
      { persist: true, name: 'beta' });
    expect(await settle(b)).toBe(true);

    expect(b.value).toBe('from-B');       // its own initState, not A's
    expect(a.value).toBe('A-WROTE');
  });

  test('the same name in the same dir DOES reopen the same data', async () => {
    // The other half of the contract — namespacing must not break
    // reopening, which is the whole point of persistence.
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-iso-'));

    const a = createSkalStore({ value: 'init' },
      { persist: true, name: 'shared' });
    expect(await settle(a)).toBe(true);
    a.value = 'PERSISTED';
    a[STORE].flushNow();

    const b = createSkalStore({ value: 'init' },
      { persist: true, name: 'shared' });
    expect(await settle(b)).toBe(true);
    expect(b.value).toBe('PERSISTED');
  });
});

describe('bulk removal evicts the node memo', () => {
  // dropMemo used to check every memo key against every removed prefix.
  // Both grow together — clearing a collection passes one prefix per
  // element while the memo holds an entry per element ever touched — so
  // it was O(memo x removed). A splice(0, 5000) took 1435 ms.
  //
  // It now walks each memo key's own ancestor chain against a Set of
  // the removed keys, which is O(memo x path-depth). 1.8 ms.
  //
  // What these can and cannot check, established by mutation rather
  // than assumed — the first draft of this block got it wrong.
  //
  // `nodeMemo` caches the PROXY, not the data, and a proxy re-resolves
  // its path on every access. So neither a missed eviction nor a
  // spurious one changes an observed VALUE: breaking the ancestor walk
  // outright, and making it over-match siblings, both leave every
  // value-level assertion below green. Memo eviction is memory hygiene
  // and identity freshness, not correctness of reads.
  //
  // The load-bearing test here is therefore the BUDGET. The value tests
  // stay because a rewrite of this function could plausibly break
  // reads even though this one does not — but they are a floor, not
  // the point, and they are not evidence that the eviction logic is
  // right.

  test('re-adding the same ids after a bulk clear reads fresh values', async () => {
    const s = freshStore({ todos: [] });
    expect(await settle(s)).toBe(true);

    for (let i = 1; i <= 40; i++) s.todos.push({ _id: i, title: `first ${i}` });
    for (let i = 0; i < 40; i++) expect(s.todos[i].title).toBe(`first ${i + 1}`);

    s.todos.splice(0, s.todos.length);
    expect(s.todos.length).toBe(0);

    // Same ids again. A stale memo entry would serve the OLD proxy and
    // report "first N".
    for (let i = 1; i <= 40; i++) s.todos.push({ _id: i, title: `second ${i}` });
    for (let i = 0; i < 40; i++) expect(s.todos[i].title).toBe(`second ${i + 1}`);
  });

  test('the small and large paths agree', async () => {
    // Under 8 removed keys keeps the original loop; 8 and over takes the
    // Set + ancestor walk. Both must evict exactly the same entries.
    for (const n of [3, 40]) {
      const s = freshStore({ todos: [] });
      expect(await settle(s)).toBe(true);
      for (let i = 1; i <= n; i++) s.todos.push({ _id: i, title: `a${i}` });
      for (let i = 0; i < n; i++) void s.todos[i].title;   // warm the memo

      s.todos.splice(0, n);
      for (let i = 1; i <= n; i++) s.todos.push({ _id: i, title: `b${i}` });
      for (let i = 0; i < n; i++) {
        expect(s.todos[i].title).toBe(`b${i + 1}`);
      }
    }
  });

  test('removing one element leaves its prefix-sharing siblings', async () => {
    // `todos.1` must not swallow `todos.10`. Note this asserts the
    // VALUES survive, which over-eviction would not disturb — it is a
    // plain removal check, not proof the boundary logic is right.
    const s = freshStore({ todos: [] });
    expect(await settle(s)).toBe(true);
    for (const id of [1, 10, 100]) s.todos.push({ _id: id, title: `t${id}` });
    for (let i = 0; i < 3; i++) void s.todos[i].title;

    s.todos.splice(0, 1);                       // removes _id 1 only
    expect(s.todos.map((t) => t.title)).toEqual(['t10', 't100']);
  });

  test('clearing a large collection is not quadratic', async () => {
    // 1435 ms before the rewrite, 1.8 ms after — so 150 ms sits two
    // orders of magnitude clear of the fixed path and an order clear of
    // the broken one. An earlier draft used N=3000 / 300 ms and did NOT
    // catch the quadratic version when mutated back; the shapes only
    // separate decisively further up the curve.
    const s = freshStore({ todos: [] });
    expect(await settle(s)).toBe(true);
    const N = 5000;
    for (let i = 1; i <= N; i++) s.todos.push({ _id: i, title: `t${i}` });
    for (let i = 0; i < N; i++) void s.todos[i].title;

    const t0 = performance.now();
    s.todos.splice(0, N);
    const ms = performance.now() - t0;

    expect(s.todos.length).toBe(0);
    expect(ms).toBeLessThan(150);
  });
});

describe('store init on a DOM target', () => {
  // `fetchDataDir` asks the host for a data directory over RPC:
  // `getAppDataDir()` writes an invoke op into the bridge ring and waits
  // for an answer. On a DOM target there is no host and nothing drains
  // the ring, so every attempt timed out — 5 x (800 ms + 150 ms backoff)
  // = 4.75 s — before returning '' and falling back to the in-memory
  // backend it was always going to use.
  //
  // Measured: ready after 4774 ms. Nobody had flagged it; it was found
  // while checking whether the fallback bridge buffer is genuinely
  // inert on web. It is not — that RPC writes into it.

  test('does not wait on an RPC no host can answer', async () => {
    const savedDir = globalThis.__skal_data_dir;
    const savedAcq = globalThis.__skal_acquireBridge;
    delete globalThis.__skal_data_dir;      // no injected dir
    delete globalThis.__skal_acquireBridge; // and no native bridge
    try {
      const t0 = performance.now();
      const s = createSkalStore({ n: 0 }, { persist: true, name: 'domboot' });
      expect(await settle(s)).toBe(true);
      const ms = performance.now() - t0;

      // 4774 ms before, ~12 ms after. 1000 ms is comfortably below one
      // single retry cycle (800 ms timeout + 150 ms backoff), so a
      // return to even ONE round trip fails this.
      expect(ms).toBeLessThan(1000);
    } finally {
      if (savedDir !== undefined) globalThis.__skal_data_dir = savedDir;
      if (savedAcq !== undefined) globalThis.__skal_acquireBridge = savedAcq;
    }
  });
});

// ── objectProxy identity and shape changes ──────────────────────────
//
// These were written against a prototype per-node child cache that was
// measured and REVERTED (no gain: 0.1097 -> 0.1163 ms). They are kept
// because they assert store behaviour that holds regardless of caching
// and that nothing else covered — a re-read after a subtree is replaced,
// and what happens when a path changes SHAPE between object and array.
//
// They also guard the reverted idea: both of its mutations survived the
// rest of the suite, so if per-node caching is ever attempted again,
// these are the tests that would have caught it being wrong.
describe('objectProxy identity and shape changes', () => {
  test('a cached child stays a LIVE view, not a snapshot', () => {
    const s = freshStore({ cfg: { theme: { dark: false } } });
    const first = s.cfg.theme;          // populates the parent's cache
    s.cfg.theme.dark = true;
    // Same proxy identity is fine and expected — but it must read
    // through to the new value, not the one captured at cache time.
    expect(s.cfg.theme.dark).toBe(true);
    expect(first.dark).toBe(true);
  });

  test('replacing the subtree with a NEW object reads through', () => {
    const s = freshStore({ cfg: { theme: { dark: false } } });
    void s.cfg.theme;                   // cache it
    s.cfg.theme = { dark: true, accent: 'red' };
    expect(s.cfg.theme.dark).toBe(true);
    expect(s.cfg.theme.accent).toBe('red');
  });

  // THE GUARD THAT MATTERS. A path can flip object <-> array, and the
  // two proxy shapes are not interchangeable. Any node caching that
  // ignores the shape hands back an object proxy for an array (or vice
  // versa) and `length` / index access silently break.
  test('object -> array at the same path returns the ARRAY proxy', () => {
    const s = freshStore({ slot: { a: 1 } });
    expect(s.slot.a).toBe(1);           // caches an OBJECT proxy at `slot`
    s.slot = [{ v: 10 }, { v: 20 }];
    expect(s.slot.length).toBe(2);
    expect(s.slot[1].v).toBe(20);
  });

  // WAS a known bug, FIXED by dropping solid-js/store. Flipping a path
  // from array to object used to read the new object correctly while
  // `.length` still answered 1 from the stale array shape. The plain
  // tree resolves the node fresh and the child cache is keyed on
  // is-array, so the shape can no longer lag the value.
  //
  // Kept as a regression test rather than deleted: it is the assertion
  // that would fail first if node caching ever stops checking shape.
  test('array -> object at the same path changes SHAPE, not just value', () => {
    const s = freshStore({ slot: [{ v: 1 }] });
    expect(s.slot.length).toBe(1);      // an array at `slot`
    s.slot = { a: 7 };
    expect(s.slot.a).toBe(7);           // value reads through
    expect(s.slot.length).toBeUndefined();   // ...and so does the shape
  });
});

// ── resolved-parent cache (objectProxy) ─────────────────────────────
//
// Each object proxy caches the node its path resolves to, so a read
// costs one Solid trap instead of one per path segment. The cache is
// keyed by a structural generation counter.
//
// THESE TESTS EXIST BECAUSE THE REST OF THE SUITE DOES NOT COVER IT:
// both invalidation points were deleted, one at a time, and all 23
// other tests still passed. The reason is subtle — the obvious test
// holds a PARENT and replaces a CHILD, and a Solid store mutates in
// place, so the parent's identity never changes and the cache is
// legitimately still valid. Staleness needs a node whose OWN path is
// replaced out from under it.
import { createRoot, createEffect, createRenderEffect } from 'solid-js';

describe('objectProxy resolved-parent cache', () => {
  test('a held node sees its OWN path replaced wholesale', () => {
    const s = freshStore({ cfg: { theme: { dark: false } } });
    const theme = s.cfg.theme;
    expect(theme.dark).toBe(false);      // fills the cache at cfg.theme
    s.cfg.theme = { dark: true };        // replaces that very object
    expect(theme.dark).toBe(true);       // a stale cache answers false
  });

  test('a held node sees a key deleted from its own object', () => {
    const s = freshStore({ cfg: { a: 1, b: 2 } });
    const cfg = s.cfg;
    expect(cfg.a).toBe(1);
    delete s.cfg.a;
    expect(cfg.a).toBeUndefined();
  });

  // PRE-EXISTING, not caused by the cache: verified by running this
  // against db.js at HEAD, where it fails identically. A node obtained
  // via `s.items[i]` and HELD across a splice tracks the INDEX, not the
  // element — so it starts pointing at whatever slid into that slot.
  // (Element frames themselves are id-addressed for persistence; this is
  // about a proxy node the caller kept a reference to.) Recorded so the
  // next person does not rediscover it, and asserted as-is so the test
  // stays honest rather than encoding a fix nobody made.
  test('a held element node tracks the INDEX across a splice, not the element', () => {
    const s = freshStore({ items: [{ v: 'a' }, { v: 'b' }, { v: 'c' }] });
    const second = s.items[1];
    expect(second.v).toBe('b');
    s.items.splice(0, 1);                // 'b' -> index 0, 'c' -> index 1
    expect(second.v).toBe('c');          // the held node followed the slot
    expect(s.items[0].v).toBe('b');      // the data itself is correct
  });

  // Covers setAt's structural-generation bump specifically. Deletes and
  // splices route through mutateAt, which advances the generation
  // separately — so without this, removing setAt's bump broke nothing
  // and the whole suite still passed.
  test('a held element node sees its own slot replaced', () => {
    const s = freshStore({ items: [{ v: 1 }, { v: 2 }] });
    const first = s.items[0];
    expect(first.v).toBe(1);
    s.items[0] = { v: 9 };              // replaces the object at that slot
    expect(first.v).toBe(9);            // stale cached node answers 1
    expect(s.items[0].v).toBe(9);
  });

  // Replacing an object with a SCALAR is structural too. An earlier
  // version tested only the NEW value, so `state.user = 'alice'` bumped
  // `user` and left every subscriber to `user.name` stale — and left
  // cached nodes pointing at the old object. The old value is free to
  // check, since the parent is already resolved by then.
  test('replacing an object with a SCALAR is structural', () => {
    const s = freshStore({ user: { name: 'Ada' } });
    const u = s.user;
    expect(u.name).toBe('Ada');
    s.user = 'alice';
    expect(s.user).toBe('alice');
    expect(u.name).toBeUndefined();     // a stale cache answers 'Ada'
  });

  test('replacing an array with a scalar is structural', () => {
    const s = freshStore({ items: [{ v: 1 }] });
    const it = s.items;
    expect(it.length).toBe(1);
    s.items = 0;
    expect(s.items).toBe(0);
  });

  test('a held node sees an ancestor replaced wholesale', () => {
    const s = freshStore({ a: { b: { c: 1 } } });
    const b = s.a.b;
    expect(b.c).toBe(1);
    s.a = { b: { c: 9 } };               // replaces b's PARENT
    expect(b.c).toBe(9);
  });

  // THE REACTIVITY CONTRACT. Resolution is untracked, so an effect no
  // longer subscribes to intermediate nodes — only to the leaf it reads.
  // That is only safe if Solid still notifies the leaf when an ancestor
  // is replaced wholesale, which it does by diffing the new object.
  // If this ever fails, the untrack in objectProxy is not sound.
  // REACTIVITY *IS* TESTABLE HERE. An earlier version of this file
  // claimed the opposite — "solid's scheduler never flushes headless" —
  // and dropped the coverage. That was a module-resolution artifact, not
  // a property of the world: solid-js's export map lists `node` before
  // `development` and bun always sets `node`, so a bare import landed on
  // dist/server.js, the SSR build where createSignal never notifies and
  // createEffect is a no-op. Every reactivity assertion silently became a
  // tautology, and five real regressions shipped behind it.
  //
  // `bun test --conditions=browser` (wired into the root `test:js` script
  // and CI) resolves dist/solid.js instead. The first test below fails
  // loudly if that ever regresses.
});

// ── batched hydration ───────────────────────────────────────────────
//
// Hydration reads every scalar leaf of a level in ONE engine.getMany
// call. Two things can go wrong that nothing else in this suite could
// see — both were checked by mutation and BOTH SURVIVED before these
// tests existed:
//
//   1. results coming back in the wrong ORDER, which silently assigns
//      each leaf its neighbour's value;
//   2. holding the returned slices across a nested read. They are views
//      over the engine's REUSABLE SCRATCH buffer, so the next
//      get/getMany overwrites them.
//
// (2) cannot be provoked through the JS backend, which returns fresh
// arrays — it is guarded by decoding everything before recursing, and
// by the lifetime note on NativeLogStore.getMany. (1) is covered here.
describe('batched hydration', () => {
  test('many leaves each keep their OWN value across a reopen', async () => {
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-batch-'));
    const init = () => {
      const c = {};
      for (let i = 0; i < 40; i++) c['k' + i] = 0;
      return { cells: c };
    };
    const a = createSkalStore(init(), { name: 'batch' });
    expect(await settle(a)).toBe(true);
    for (let i = 0; i < 40; i++) a.cells['k' + i] = i * 7 + 1;   // all distinct
    a[STORE].flushNow();

    const b = createSkalStore(init(), { name: 'batch' });
    expect(await settle(b)).toBe(true);
    for (let i = 0; i < 40; i++) {
      // Reversing or rotating getMany's results still yields the right
      // SET of values, so a checksum would pass. Each key is asserted
      // against its own value instead.
      expect(b.cells['k' + i]).toBe(i * 7 + 1);
    }
  });

  test('a missing leaf keeps its default while its neighbours load', async () => {
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-batch2-'));
    const init = () => ({ cells: { a: -1, gap: -1, b: -1 } });
    const s1 = createSkalStore(init(), { name: 'gap' });
    expect(await settle(s1)).toBe(true);
    s1.cells.a = 10;
    s1.cells.b = 30;                    // `gap` is never written
    s1[STORE].flushNow();

    const s2 = createSkalStore(init(), { name: 'gap' });
    expect(await settle(s2)).toBe(true);
    expect(s2.cells.a).toBe(10);
    expect(s2.cells.gap).toBe(-1);      // default, not a shifted neighbour
    expect(s2.cells.b).toBe(30);
  });
});

// ── reactivity: what actually re-renders ────────────────────────────

const rx = (read) => {
  let n = 0;
  createRoot(() => createRenderEffect(() => { read(); n++; }));
  return () => n;
};
const memStore = (init) => {
  globalThis.__skal_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rx-'));
  const top = {};
  for (const k of Object.keys(init)) top[k] = { persist: false };
  return createSkalStore(init, { paths: top });
};

describe('reactivity', () => {
  // GUARD. If solid resolves to its SSR build again this is the only
  // test that says so — every other reactive assertion would just pass.
  test('the reactive build is the one under test', () => {
    const s = memStore({ a: { x: 1 } });
    const n = rx(() => s.a.x);
    const b = n();
    s.a.x = 2;
    expect(n() - b).toBe(1);
  });

  test('array methods track: map / filter / for..of / spread', () => {
    const s = memStore({ list: [{ v: 1 }] });
    const m = rx(() => s.list.map((e) => e.v));
    const f = rx(() => s.list.filter((e) => e.v > 0).length);
    const o = rx(() => { for (const e of s.list) e.v; });
    const sp = rx(() => [...s.list].length);
    const b = [m(), f(), o(), sp()];
    s.list.push({ v: 2 });
    expect([m() - b[0], f() - b[1], o() - b[2], sp() - b[3]]).toEqual([1, 1, 1, 1]);
  });

  test('a wholesale array replace reaches index subscribers', () => {
    const s = memStore({ items: [{ v: 1 }, { v: 2 }] });
    const n = rx(() => { s.items[0]; });
    const b = n();
    s.items = [{ v: 10 }, { v: 20 }];
    expect(n() - b).toBeGreaterThanOrEqual(1);
  });

  test('assigning past the end wakes length subscribers', () => {
    const s = memStore({ items: [{ v: 1 }, { v: 2 }] });
    const n = rx(() => s.items.length);
    const b = n();
    s.items[5] = { v: 99 };
    expect(s.items.length).toBe(6);
    expect(n() - b).toBeGreaterThanOrEqual(1);
  });

  test('id-addressed elements do not collide with indices', () => {
    const s = memStore({ items: [{ v: 1 }, { v: 2 }] });
    void s.items[0].v; void s.items[1].v;      // memoize index-addressed nodes
    s.items = [{ v: 10 }, { v: 20 }];          // now the elements gain _id
    expect([s.items[0].v, s.items[1].v]).toEqual([10, 20]);
  });

  test('hydration is batched and skips leaves equal to their default', async () => {
    globalThis.__skal_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hy-'));
    const s1 = createSkalStore({ c: { a: 0, b: 0, d: 0 } }, { name: 'HY' });
    expect(await settle(s1)).toBe(true);
    s1.c.a = 7; s1.c.b = 8; s1.c.d = 9;
    await new Promise((r) => setTimeout(r, 0));
    s1[STORE].flushNow();
    // `a` reopens with a default that ALREADY equals what was stored.
    const s2 = createSkalStore({ c: { a: 7, b: 0, d: 0 } }, { name: 'HY' });
    const unchanged = rx(() => s2.c.a);
    const all = rx(() => { s2.c.a; s2.c.b; s2.c.d; });
    const bu = unchanged(), ba = all();
    expect(await settle(s2)).toBe(true);
    expect(unchanged() - bu).toBe(0);          // nothing changed for it
    expect(all() - ba).toBe(1);                // one batched flush, not three
  });
});

// ── batched reads share one scratch buffer ──────────────────────────
//
// Both backends hand back VIEWS over a reusable buffer that the next
// read invalidates. That is deliberate on the JS side: returning copies
// there made it a test double that under-reports the real consumer, so a
// caller holding results across another read passed in CI and returned
// another record's bytes on device. It shipped once; only a benchmark
// checksum caught it.
//
// A level wider than the 256-key chunk is the case that bites: chunk 2's
// read invalidates chunk 1's views, so chunk 1 must be decoded first.
describe('chunked hydration', () => {
  test('300 leaves across a chunk boundary each keep their own value', async () => {
    globalThis.__skal_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-'));
    const N = 300;
    const init = () => {
      const c = {};
      for (let i = 0; i < N; i++) c['k' + i] = 0;
      return { cells: c };
    };
    const a = createSkalStore(init(), { name: 'CK' });
    expect(await settle(a)).toBe(true);
    // Distinct, variable-LENGTH values: equal-width records would still
    // line up if the views were misaligned by a whole record.
    for (let i = 0; i < N; i++) a.cells['k' + i] = 'v' + i + '-'.repeat(i % 7);
    await new Promise((r) => setTimeout(r, 0));
    a[STORE].flushNow();

    const b = createSkalStore(init(), { name: 'CK' });
    expect(await settle(b)).toBe(true);
    for (let i = 0; i < N; i++) {
      expect(b.cells['k' + i]).toBe('v' + i + '-'.repeat(i % 7));
    }
  });
});

// ── version signals are bounded ─────────────────────────────────────
//
// `vers` interns one signal per store key ever READ. Nothing removed
// them, so a list that pushes and shifts leaked a signal per dead
// element id for the process lifetime, and notification (O(vers.size))
// degraded with it. Only observable through ctrl.versions(), which is
// why the leak survived every other test in this file.
describe('version-signal growth', () => {
  test('churning a collection does not grow the signal table', async () => {
    globalThis.__skal_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vg-'));
    const s = createSkalStore({ todos: [] }, { name: 'VG' });
    expect(await settle(s)).toBe(true);
    const ctl = s[STORE];

    for (let i = 0; i < 20; i++) {          // warm up, then take a baseline
      s.todos.push({ title: 't' + i });
      void s.todos[s.todos.length - 1].title;
      s.todos.splice(0, 1);
    }
    const base = ctl.versions();

    for (let i = 0; i < 200; i++) {          // 10x the churn
      s.todos.push({ title: 'x' + i });
      void s.todos[s.todos.length - 1].title;
      s.todos.splice(0, 1);
    }
    // Bounded, not merely "smaller than 200x": the dead records' keys
    // must actually be gone, leaving only the live window plus indices.
    expect(ctl.versions()).toBeLessThan(base * 3);
  });
});

// ── regressions from fixing the review findings ─────────────────────
describe('notification survives key churn', () => {
  // Pruning a version signal orphans any effect already holding it: a
  // later write to the same key interns a FRESH signal and the old
  // subscriber never re-runs. Measured when delete pruned: 1 re-run for
  // the delete, 0 for the re-create. Only spliced-out collection records
  // are pruned now, because genId never reissues an id.
  test('delete then re-create the same key still notifies', async () => {
    globalThis.__skal_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-'));
    // Distinct name: `cfg.name` defaults to 'store', so without it this
    // shares a backing store with every other test in the file.
    const s = createSkalStore({ cfg: { a: 1, b: 2 } },
      { name: 'KC', paths: { cfg: { persist: false } } });
    // Record what the subscriber SAW rather than how many times it ran:
    // run counts are sensitive to batching left over from earlier async
    // tests, and what matters is that the re-create reached it at all.
    const seen = [];
    createRoot(() => createRenderEffect(() => { seen.push(s.cfg.a); }));
    delete s.cfg.a;
    s.cfg.a = 5;
    await new Promise((r) => setTimeout(r, 0));
    expect(s.cfg.a).toBe(5);
    expect(seen).toContain(undefined);   // saw the delete
    expect(seen).toContain(5);           // …and the re-create
  });

  test('a persisted null survives, across the chunk boundary too', async () => {
    globalThis.__skal_data_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-'));
    const N = 300;                    // > the 256-key hydration chunk
    const init = () => { const c = {}; for (let i = 0; i < N; i++) c['k' + i] = 'default'; return { cells: c }; };
    const a = createSkalStore(init(), { name: 'NL' });
    expect(await settle(a)).toBe(true);
    for (let i = 0; i < N; i++) a.cells['k' + i] = (i === 5 || i === 280) ? null : 'v' + i;
    await new Promise((r) => setTimeout(r, 0));
    a[STORE].flushNow();
    const b = createSkalStore(init(), { name: 'NL' });
    expect(await settle(b)).toBe(true);
    // A stored null is a VALUE, not an absent frame — it must not fall
    // back to the initState default.
    expect(b.cells.k5).toBe(null);
    expect(b.cells.k280).toBe(null);
    expect(b.cells.k6).toBe('v6');
  });
});

// ── under-notification: what silently STOPS re-rendering ─────────────
//
// Every case here was found by an independent review pass, reproduced,
// and only then fixed. They share one shape: the store keeps serving the
// CORRECT value, so any test that reads after writing passes. Only a
// subscriber count sees them. That is why the assertions below count
// re-runs and never trust a read.
//
// The other half of the shape: `array methods track` (above) covers
// map/filter/for..of/spread but mutates with `push`, which is
// STRUCTURAL. Structural mutations bump `sk#all`; leaf writes inside an
// element do not, and that gap is exactly what shipped.
describe('iteration sees writes inside elements', () => {
  test('map / for..of / filter / spread re-run on an element FIELD write', () => {
    const s = memStore({ list: [{ v: 1 }, { v: 2 }] });
    const m = rx(() => s.list.map((e) => e.v).join(','));
    const f = rx(() => s.list.filter((e) => e.v > 1).length);
    const o = rx(() => { let t = 0; for (const e of s.list) t += e.v; return t; });
    const p = rx(() => [...s.list].length);
    const b = [m(), f(), o(), p()];
    s.list[0].v = 42;
    expect(m() - b[0]).toBe(1);
    expect(f() - b[1]).toBe(1);
    expect(o() - b[2]).toBe(1);
    expect(p() - b[3]).toBe(1);
    expect(s.list[0].v).toBe(42);
  });

  test('a write NESTED under an element also reaches iteration', () => {
    const s = memStore({ list: [{ meta: { v: 1 } }] });
    const m = rx(() => s.list.map((e) => e.meta.v).join(','));
    const b = m();
    s.list[0].meta.v = 9;
    expect(m() - b).toBe(1);
  });

  test('mutating a nested array inside an element reaches the outer iteration', () => {
    const s = memStore({ list: [{ tags: ['a'] }] });
    const m = rx(() => s.list.map((e) => e.tags.length).join(','));
    const b = m();
    s.list[0].tags.push('b');
    expect(m() - b).toBe(1);
  });

  // THE CHAIN, specifically. The test above passes even if `allKeys`
  // only ever holds ONE key, because the nested array's own mutator
  // reads the element's elInfo directly. Only a write to a node BELOW a
  // nested array exercises the ancestor chain — and it has to wake both
  // levels of iteration at once.
  test('a leaf under a nested array wakes BOTH arrays iterating it', () => {
    const s = memStore({ list: [{ tags: [{ name: 'a' }] }] });
    const outer = rx(() => s.list.map((e) => e.tags.length).join(','));
    const inner = rx(() => s.list[0].tags.map((t) => t.name).join(','));
    const b = [outer(), inner()];
    s.list[0].tags[0].name = 'z';
    expect(inner() - b[1]).toBe(1);
    expect(outer() - b[0]).toBe(1);
  });

  test('an id-addressed collection element notifies its array too', () => {
    const s = memStore({ items: [] });
    s.items.push({ title: 'a' }, { title: 'b' });
    const m = rx(() => s.items.map((e) => e.title).join(','));
    const b = m();
    s.items[1].title = 'B';
    expect(m() - b).toBe(1);
    expect(s.items.map((e) => e.title).join(',')).toBe('a,B');
  });

  // THE PRECISION FLOOR for the fix above. Waking `sk#all` on every
  // write beneath an array is deliberately coarser than per-leaf — an
  // iterator cannot say which elements it read, because it reads raw
  // objects off a plain array. But it must not leak SIDEWAYS: a write
  // in one array may not wake another array's iterators, and it may not
  // wake leaf subscribers that read a different leaf.
  test('the whole-array wake does not leak to siblings', () => {
    const s = memStore({ a: [{ v: 1 }], b: [{ v: 1 }], plain: { x: 1 } });
    const ia = rx(() => s.a.map((e) => e.v).join(','));
    const ib = rx(() => s.b.map((e) => e.v).join(','));
    const leaf = rx(() => s.plain.x);
    const other = rx(() => s.a[0].other);
    const base = [ia(), ib(), leaf(), other()];
    s.a[0].v = 2;
    expect(ia() - base[0]).toBe(1);      // its own iterators, once
    expect(ib() - base[1]).toBe(0);      // the sibling array: untouched
    expect(leaf() - base[2]).toBe(0);
    expect(other() - base[3]).toBe(0);   // a different leaf of the same element
  });
});

describe('element proxies survive churn and replacement', () => {
  test('splice out and re-insert the same object keeps notification alive', () => {
    const s = memStore({ items: [] });
    s.items.push({ title: 'a' }, { title: 'b' });
    const seen = [];
    createRoot(() => createRenderEffect(() => { seen.push(s.items[0]?.title); }));
    const x = s.items.shift();
    s.items.unshift(x);
    seen.length = 0;
    s.items[0].title = 'Z';
    expect(seen).toContain('Z');
    expect(s.items[0].title).toBe('Z');
  });

  test('a wholesale array replace notifies a held element proxy', () => {
    const s = memStore({ items: [] });
    s.items.push({ title: 'a' });
    const el = s.items[0];
    const id = el._id;
    const n = rx(() => el.title);
    const b = n();
    s.items = [{ _id: id, title: 'zzz' }];
    expect(n() - b).toBe(1);
    expect(el.title).toBe('zzz');
  });

  test('a replace that DROPS an element notifies its holder', () => {
    const s = memStore({ items: [] });
    s.items.push({ title: 'a' });
    const el = s.items[0];
    const n = rx(() => el.title);
    const b = n();
    s.items = [{ _id: 'other', title: 'new' }];
    expect(n() - b).toBe(1);
  });

  test('id-addressed proxies are evicted from the node memo on removal', () => {
    const s = memStore({ items: [] });
    const before = s[STORE].memos();
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 30; i++) s.items.push({ title: 't' + i });
      for (let i = 0; i < 30; i++) void s.items[i].title;   // materialise proxies
      s.items.splice(0, s.items.length);
    }
    // 180 element proxies were created and all 180 removed. A memo that
    // cannot match the NUL-separated element key retains every one of
    // them — and through their verCache closures retains the very
    // signals pruneVersRecords deleted, so `versions()` reports a leak
    // as fixed while the objects are still reachable.
    expect(s[STORE].memos() - before).toBeLessThan(30);
  });
});

describe('writes stay readable', () => {
  test('vivifying a missing parent does not strand the write', () => {
    const s = memStore({ a: { b: { c: 1 } } });
    const held = s.a.b;
    s.a = 5;                       // structural: b is gone
    expect(held.c).toBeUndefined();
    held.c = 7;                    // re-creates a.b, writes c
    expect(held.c).toBe(7);
    expect(s.a.b.c).toBe(7);       // and a fresh path agrees
  });

  test('one index assign is one re-run', () => {
    const s = memStore({ items: [{ v: 1 }, { v: 2 }] });
    const n = rx(() => { s.items[0]; s.items.map((e) => e.v); });
    const b = n();
    s.items[0] = { v: 9 };
    expect(n() - b).toBe(1);
  });

  test('a mixed array keeps index subscribers alive across a splice', () => {
    // Elements carry caller-supplied `_id`s but the array is NOT a
    // collection (a primitive member), so children are addressed by
    // INDEX. Pruning `items.1.*` because some element's `_id` was '1'
    // kills a live index-1 subscriber.
    // The trailing primitive is what makes this array a non-collection.
    // Two objects follow the one that gets spliced out, so index 1 is
    // still an object afterwards and can take a field write.
    const s = memStore({
      items: [{ _id: '1', a: 1 }, { _id: '9', a: 2 }, { _id: 'x', a: 3 }, 5],
    });
    const n = rx(() => s.items[1]?.a);
    const b = n();
    s.items.splice(0, 1);          // removes the element whose _id is '1'
    const mid = n();
    expect(mid).toBeGreaterThan(b);
    // Must be a FIELD write through the element proxy. An index assign
    // bumps `items#1`, which this subscriber also holds, so it would
    // re-run either way and hide the pruned `items.1.a` signal.
    s.items[1].a = 77;
    expect(n()).toBeGreaterThan(mid);
  });
});

// Reopen whatever directory the last freshStore() created. The existing
// reopen() hardcodes {todos: []}; these cases need other shapes.
const reopenSame = (init) => createSkalStore(init, {});

// ── round two: what the second independent review found ─────────────
//
// Same signature as the first round — the store keeps serving the right
// value, so only a counter, a `pending()` count or a REOPEN sees these.
// Four of them were introduced by the fixes for the first round, which
// is why every one of these asserts the other side of the wire.
describe('splice classifies before it mutates', () => {
  test('a cold collCache still tombstones the removed element', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 }, { a: 2 });
    await s[STORE].flushNow();

    // Reopen: hydrateArray drops collCache, so the classification is
    // cold — the state in which `_isColl(a)` was being read AFTER the
    // in-place splice and reporting the post-splice shape.
    const cold = reopenSame({ items: [] });
    expect(await settle(cold)).toBe(true);
    cold.items.splice(0, 1, 5);           // post-splice array is NOT a collection
    const coldPending = cold[STORE].pending();

    const s2 = freshStore({ items: [] });
    expect(await settle(s2)).toBe(true);
    s2.items.push({ a: 1 }, { a: 2 });
    await s2[STORE].flushNow();
    const warm = reopenSame({ items: [] });
    expect(await settle(warm)).toBe(true);
    void warm.items[0].a;                 // warms collCache
    warm.items.splice(0, 1, 5);

    expect(coldPending).toBe(warm[STORE].pending());
  });

  test('a NON-collection array stages no per-element frames', async () => {
    // The other side of the same gate. Asserting only that cold and warm
    // agree is satisfied by "always a collection" as well as by the
    // correct answer — mutation caught that. This pins the answer itself:
    // an array that was never a collection must stage ONE whole-array
    // frame, not a per-element tombstone.
    const s = freshStore({ mixed: [] });
    expect(await settle(s)).toBe(true);   // else engine is null and
    s.mixed = [{ _id: '1', a: 1 }, { _id: '9', a: 2 }, 5];
    await s[STORE].flushNow();            // ...flushNow is a no-op
    expect(s[STORE].pending()).toBe(0);   // prove the flush actually ran
    s.mixed.splice(0, 1);
    // TWO frames, and both are the point: the whole-array blob, plus a
    // tombstone retiring any `#x` index. stageArray stages the second
    // unconditionally on the blob path — hydrateArray reads `#x` first,
    // so an index left behind from when the array WAS a collection masks
    // the blob entirely. No per-element frame appears either way.
    expect(s[STORE].pending()).toBe(2);
  });

  test('an empty array still promotes to a collection on push', () => {
    // The pre-splice classification must not block promotion.
    // `_isColl([])` is true, which is what makes this work.
    const s = memStore({ items: [] });
    s.items.push({ a: 1 });
    expect(s.items[0]._id).toBeDefined();
  });
});

describe('generated ids never collide with caller ids', () => {
  test('a wholesale assign seeds genId past the ids it keeps', () => {
    const s = memStore({ items: [] });
    s.items = [{ _id: '2', t: 'server' }];
    s.items.push({ t: 'y' });
    s.items.push({ t: 'z' });
    const ids = s.items.map((e) => e._id);
    expect(new Set(ids).size).toBe(3);
    expect(s.items.find((e) => e.t === 'server')).toBeDefined();
  });

  test('a splice insert seeds genId too', () => {
    // `_id: '2'` and TWO pushes: genId must actually REACH the caller's
    // id for the collision to show. An earlier version used '5' and one
    // push, so it passed with the seeding deleted — caught by mutation.
    const s = memStore({ items: [] });
    s.items.splice(0, 0, { _id: '2', t: 'a' });
    s.items.push({ t: 'b' });
    s.items.push({ t: 'c' });
    expect(new Set(s.items.map((e) => e._id)).size).toBe(3);
  });

  test('an index assign seeds genId too', () => {
    const s = memStore({ items: [] });
    s.items.push({ t: 'a' });
    s.items[0] = { _id: '2', t: 'replaced' };
    s.items.push({ t: 'b' });
    s.items.push({ t: 'c' });
    expect(new Set(s.items.map((e) => e._id)).size).toBe(3);
  });

  test('the caller row survives a reopen', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ _id: '2', t: 'server' }];
    s.items.push({ t: 'y' });
    s.items.push({ t: 'z' });
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items.map((e) => e.t).sort()).toEqual(['server', 'y', 'z']);
  });
});

describe('wholesale replace reaches every held element proxy', () => {
  test('an id that disappears and comes back still notifies', () => {
    const s = memStore({ items: [] });
    s.items.push({ title: 'a' });
    const el = s.items[0];
    const id = el._id;
    const n = rx(() => el.title);
    s.items = [];
    const mid = n();
    s.items = [{ _id: id, title: 'back' }];
    expect(n() - mid).toBe(1);
    expect(el.title).toBe('back');
  });

  test('an INDEX-addressed element proxy is notified', () => {
    // Not a collection (the primitive), so children are keyed
    // `mixed.0.a` — dotted keys the index bumps cannot reach.
    const s = memStore({ mixed: [{ a: 1 }, 5] });
    const el = s.mixed[0];
    const n = rx(() => el.a);
    const b = n();
    s.mixed = [{ a: 9 }, 5];
    expect(n() - b).toBe(1);
    expect(el.a).toBe(9);
  });

  test('an array nobody proxied still costs nothing', () => {
    const s = memStore({ items: [] });
    s.items.push({ v: 1 });
    const n = rx(() => s.items.length);
    const b = n();
    s.items = [{ _id: '1', v: 2 }];
    expect(n() - b).toBe(1);
  });
});

describe('the persistence side of the wire', () => {
  test('a vivified write survives a reopen', async () => {
    const s = freshStore({ a: { b: { c: 1 } } });
    expect(await settle(s)).toBe(true);
    const held = s.a.b;
    s.a = 5;
    void held.c;
    held.c = 7;
    expect(s.a.b.c).toBe(7);                 // memory — the half tested before
    await s[STORE].flushNow();
    const b = reopenSame({ a: { b: { c: 1 } } });
    expect(await settle(b)).toBe(true);
    expect(b.a).toEqual({ b: { c: 7 } });    // ...and the half that was not
  });

  test('persist:false keeps pushed collection records off disk', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-np-'));
    globalThis.__skal_data_dir = dir;
    const s = createSkalStore({ secrets: [] },
      { name: 'np', paths: { secrets: { persist: false } } });
    expect(await settle(s)).toBe(true);
    s.secrets.push({ token: 'SUPERSECRET' });
    await s[STORE].flushNow();
    let found = false;
    const walk = (d) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (fs.readFileSync(p).includes('SUPERSECRET')) found = true;
      }
    };
    walk(dir);
    expect(found).toBe(false);
    expect(s.secrets[0].token).toBe('SUPERSECRET');   // still live in memory
  });

  test('persist:false still evicts removed element proxies', () => {
    // The tombstone rides the persistence policy; dropMemo and
    // pruneVersRecords are memory hygiene and must not.
    const s = memStore({ items: [] });
    const before = s[STORE].memos();
    for (let r = 0; r < 6; r++) {
      for (let i = 0; i < 30; i++) s.items.push({ t: 't' + i });
      for (let i = 0; i < 30; i++) void s.items[i].t;
      s.items.splice(0, s.items.length);
    }
    expect(s[STORE].memos() - before).toBeLessThan(30);
  });
});

describe('declared-dep effects hear the load paths', () => {
  test('a lazy array fault-in notifies createEffect subscribers', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ t: 'a' }, { t: 'b' });
    await s[STORE].flushNow();

    // Reopen with `items` LAZY: hydrate skips it, so the records only
    // arrive when the first read triggers faultIn -> hydrateArray ->
    // setAt. setAt bumped Solid's signals but never called _skalNotify,
    // so a declared-dep effect kept serving the initState default
    // forever while a Solid effect on the same path re-ran.
    const b = createSkalStore({ items: [] }, { paths: { items: { lazy: true } } });
    expect(await settle(b)).toBe(true);
    const seen = [];
    // `fn` receives a POSITIONAL array, one slot per declared path.
    b[STORE].createEffect(['items'], (vals) => { seen.push(vals[0].length); });
    expect(seen).toEqual([0]);                  // initial run: not yet loaded
    expect(b.items.length).toBe(2);             // the read that faults it in
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toContain(2);
  });
});

// ── round three: the fixes' fixes ───────────────────────────────────
//
// Every case here failed against the previous round. The clustering is
// the point: each one is an in-memory fix whose PERSISTENCE half was
// missing, a fix applied to one addressing scheme and not the other, or
// a fix applied to one call site of a function and not its siblings.
// The generated matrix at the bottom of this file exists to stop having
// to think of those three axes by hand every time.
describe('id minting survives a restart', () => {
  test('a wholesale assign that flushes before any push keeps its ids', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ _id: '2', t: 'server' }];
    await s[STORE].flushNow();          // flush with NO push in between
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    b.items.push({ t: 'y' });
    expect(new Set(b.items.map((e) => e._id)).size).toBe(2);
    await b[STORE].flushNow();
    const c = reopenSame({ items: [] });
    expect(await settle(c)).toBe(true);
    expect(c.items.map((e) => e.t).sort()).toEqual(['server', 'y']);
  });

  test('ids removed by a splice are never reissued', () => {
    // The deferred scan ran against the array as it existed at DRAIN
    // time, so emptying it first meant seeding nothing and reissuing an
    // id whose signals pruneVersRecords had already deleted.
    const s = memStore({ items: [] });
    s.items = [{ _id: '1', t: 'a' }, { _id: '2', t: 'b' }];
    s.items.splice(0, 2);
    s.items.push({ t: 'c' });
    expect(s.items[0]._id).not.toBe('1');
    expect(s.items[0]._id).not.toBe('2');
  });
});

describe('hydration reaches declared-dep effects', () => {
  test('EAGER hydration notifies createEffect subscribers', async () => {
    const s = freshStore({ user: { name: 'default' } });
    expect(await settle(s)).toBe(true);
    s.user.name = 'alice';
    await s[STORE].flushNow();

    // The fast path every eagerly hydrated leaf takes is writeHydrated,
    // not setAt — fixing setAt alone left the common case broken.
    const b = reopenSame({ user: { name: 'default' } });
    const seen = [];
    b[STORE].createEffect(['user.name'], (v) => { seen.push(v[0]); });
    expect(await settle(b)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(b.user.name).toBe('alice');
    expect(seen).toContain('alice');
  });
});

describe('degrading a collection retires its index frame', () => {
  test('a push that degrades the array keeps the pushed value', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ a: 1 }];
    await s[STORE].flushNow();
    s.items.push(5);                   // now a non-collection
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items.length).toBe(2);
    expect(b.items[1]).toBe(5);
  });

  test('a truncation that degrades the array does the same', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 }, { a: 2 });
    await s[STORE].flushNow();
    s.items.length = 1;
    s.items.push(7);
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items.length).toBe(2);
    expect(b.items[1]).toBe(7);
  });
});

describe('a wholesale assign clears what it replaces', () => {
  test('a leaf override staged in the same window does not resurrect', async () => {
    const s = freshStore({ a: { b: { c: 0 } } });
    expect(await settle(s)).toBe(true);
    s.a.b.c = 1;
    s.a = { x: 2 };                    // same flush window
    await s[STORE].flushNow();
    const b = reopenSame({ a: { b: { c: 0 } } });
    expect(await settle(b)).toBe(true);
    expect(b.a).toEqual({ x: 2 });
  });

  test('...but a collection assign keeps its own element frames', async () => {
    // The mirror hazard: purging at flush time instead of at
    // registration time would drop the frames the assign itself staged.
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ t: 'a' }, { t: 'b' }];
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items.map((e) => e.t)).toEqual(['a', 'b']);
  });
});

describe('truncation is symmetric with splice', () => {
  test('length = 0 prunes version records the way splice does', () => {
    const build = () => {
      const s = memStore({ items: [] });
      for (let i = 0; i < 200; i++) s.items.push({ t: 't' + i });
      for (let i = 0; i < 200; i++) void s.items[i].t;
      return s;
    };
    const viaLen = build(); viaLen.items.length = 0;
    const viaSplice = build(); viaSplice.items.splice(0, viaSplice.items.length);
    expect(viaLen[STORE].versions())
      .toBeLessThanOrEqual(viaSplice[STORE].versions() + 5);
  });

  test('truncating a persist:false collection writes nothing', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-tr-'));
    globalThis.__skal_data_dir = dir;
    const s = createSkalStore({ secrets: [] },
      { name: 'tr', paths: { secrets: { persist: false } } });
    expect(await settle(s)).toBe(true);
    // A DELTA, not an absolute: init stages a store-level frame of its
    // own, so `pending()` is already 1 here. What this pins is that a
    // persist:false collection adds nothing — the truncation used to
    // write a tombstone per removed record for records never on disk.
    const base = s[STORE].pending();
    s.secrets.push({ token: 'A' }, { token: 'B' });
    s.secrets.length = 0;
    expect(s[STORE].pending()).toBe(base);
    expect(s.secrets.length).toBe(0);
  });
});

describe('nested arrays are notified like top-level ones', () => {
  test('replacing an array inside an element wakes a held proxy', () => {
    const s = memStore({ list: [{ tags: [{ name: 'a' }] }] });
    const t = s.list[0].tags[0];
    const n = rx(() => t.name);
    const b = n();
    s.list[0].tags = [{ name: 'z' }];
    expect(n() - b).toBe(1);
    expect(t.name).toBe('z');
  });
});

// ── THE MATRIX ───────────────────────────────────────────────────────
//
// Three review rounds found twenty-six defects in this store. Eight were
// introduced by the previous round's fixes, and they clustered on three
// axes that hand-written cases keep missing:
//
//   1. the PERSISTENCE half of an in-memory fix        (D, #1, #3, #5, #6)
//   2. the OTHER ADDRESSING SCHEME or nesting level    (E, #4)
//   3. the OTHER CALL SITE of the same function        (G -> #2, #7; K -> #11)
//
// So this generates the cross product instead of enumerating it. Every
// mutation is applied to every array shape under both persistence
// policies, and each is checked against all four observers rather than
// whichever one the author of the fix was looking at.
//
// It is deliberately mechanical and deliberately not clever: the point
// is coverage of combinations nobody thought about, and a failure here
// names its own cell.
const SHAPES = {
  // collection: every element an object WITH AN ID -> id-addressed,
  // per-element frames. The ids are explicit: without them the elements
  // are addressed by INDEX and the shape does not test what its name
  // says — which is how `reverse` briefly appeared to fail here.
  collection: () => ({
    rows: [{ _id: '1', v: 1 }, { _id: '2', v: 2 }, { _id: '3', v: 3 }],
  }),
  // mixed: a primitive present -> NOT a collection -> index-addressed
  mixed: () => ({ rows: [{ v: 1 }, { v: 2 }, 9] }),
  // nested: the array lives inside a collection element
  nested: () => ({ rows: [{ inner: [{ v: 1 }, { v: 2 }] }] }),
  // idless: all objects, NO ids — and NO primitive, which is the whole
  // difference from `mixed`. `_isColl` says collection; the on-disk
  // per-element format cannot address it. This is the shape five
  // separate reported bugs lived in, and it arises whenever a
  // whole-array frame comes back off disk, or a splice removes the
  // primitive that made a mixed array mixed.
  //
  // This fixture was BYTE-IDENTICAL to `mixed` for three rounds,
  // including the primitive the comment says distinguishes them — so 44
  // generated in-memory tests were exact duplicates and the axis existed
  // only in the persistence loop, which compensated with a splice. It
  // was cited three times as evidence this class was covered.
  idless: () => ({ rows: [{ v: 1 }, { v: 2 }] }),
};

// Each mutation returns a description of what it changed, so the
// observers know what to expect without hard-coding per-shape values.
const MUTATIONS = {
  'leaf write':        (arr) => { arr[0].v = 99; return { v: 99 }; },
  'index assign':      (arr) => { arr[0] = { v: 99 }; return { v: 99 }; },
  'push':              (arr) => { arr.push({ v: 99 }); return { grew: 1 }; },
  'splice out':        (arr) => { arr.splice(0, 1); return { shrank: 1 }; },
  'splice in':         (arr) => { arr.splice(1, 0, { v: 99 }); return { grew: 1 }; },
  'truncate':          (arr) => { arr.length = 1; return { len: 1 }; },
  'reverse':           (arr) => { arr.reverse(); return {}; },
  'delete a field':    (arr) => { delete arr[0].v; return { deleted: true }; },
  // The rest of the reorderBy family. `reverse` alone is `indexOnly`,
  // so it exercised neither the `!indexOnly` staging path nor the
  // element-DESTROYING half — and that gap is precisely what hid
  // `fill` wiping collection elements without notifying anyone.
  'sort':              (arr) => { arr.sort((x, y) => (y && y.v || 0) - (x && x.v || 0)); return {}; },
  'fill':              (arr) => { arr.fill({ v: 99 }); return { v: 99 }; },
  'copyWithin':        (arr) => { arr.copyWithin(0, 1); return {}; },
};

const armOf = (shape, live) => (shape === 'nested' ? live.rows[0].inner : live.rows);

describe('mutation x shape x policy matrix', () => {
  for (const shape of Object.keys(SHAPES)) {
    for (const mut of Object.keys(MUTATIONS)) {
      // ── memory: the value the store serves ──────────────────────
      test(`${shape} / ${mut} / reads back`, () => {
        const s = memStore(SHAPES[shape]());
        const before = JSON.stringify(armOf(shape, s));
        MUTATIONS[mut](armOf(shape, s));
        const after = JSON.stringify(armOf(shape, s));
        expect(after).not.toBe(before);          // prove the workload ran
      });

      // ── notification: iteration must see EVERY mutation ─────────
      // The axis that produced the worst bug of round one and was still
      // incomplete in rounds two and three.
      test(`${shape} / ${mut} / iteration re-runs`, () => {
        const s = memStore(SHAPES[shape]());
        const n = rx(() => armOf(shape, s).map((e) => (e && e.v) ?? 0).join(','));
        const b = n();
        MUTATIONS[mut](armOf(shape, s));
        expect(n() - b).toBeGreaterThan(0);
      });

      // ── notification: a HELD ELEMENT PROXY must see it ──────────
      // Both addressing schemes, which is where round two and three
      // each found a gap.
      test(`${shape} / ${mut} / held element proxy re-runs`, () => {
        const s = memStore(SHAPES[shape]());
        const el = armOf(shape, s)[0];
        const n = rx(() => el.v);
        const b = n();
        MUTATIONS[mut](armOf(shape, s));
        // EVERY cell asserts. An earlier version bare-`return`ed for
        // five of the eight mutations, so 15 of these 24 generated tests
        // ran zero expects and reported green — the exact "a test that
        // passes with the fix deleted is worse than no test" shape this
        // file keeps re-learning, this time in the instrument built to
        // stop it.
        //
        // `push` and `splice in` do not touch slot 0, so silence is
        // correct. `splice out` and `truncate` REMOVE the element: a
        // proxy held across that is deliberately not notified, because
        // pruneVersRecords deletes those signals so a removed id can
        // never be reused, and the list-level notification is what
        // unmounts the row (asserted by the iteration observer above).
        // `reverse` moves the element — an ID-addressed proxy follows it
        // and stays quiet, which is what stable ids are FOR, while an
        // INDEX-addressed one sees a different element and must re-run.
        // Quiet is now ADDRESSING-DEPENDENT, and narrower than it was.
        //
        // `push` / `splice in` do not touch slot 0 under any scheme.
        //
        // `splice out` and `truncate` REMOVE an element. Under ID
        // addressing the holder is deliberately not notified —
        // pruneVersRecords deletes those signals so a removed id can
        // never be reused, and the list-level notification is what
        // unmounts the row. Under INDEX addressing nothing was removed
        // from the holder's point of view: slot 0 now holds a DIFFERENT
        // element, and it must see that.
        //
        // `sort` / `reverse` MOVE elements; an id-addressed proxy
        // follows its element, which is what stable ids are for. `fill`
        // and `copyWithin` REPLACE them, so every scheme must wake.
        const quiet = mut === 'push' || mut === 'splice in'
          // truncate here is `length = 1`, so SLOT 0 — the slot this
          // observer holds — is untouched under every scheme.
          || mut === 'truncate'
          || (shape === 'collection'
              && (mut === 'splice out' || mut === 'reverse' || mut === 'sort'));
        if (quiet) expect(n() - b).toBe(0);
        else expect(n() - b).toBeGreaterThan(0);
      });

      // ── the OUTER iteration, for nested arrays ──────────────────
      // The `nested` shape only ever observed the INNER array, so
      // `bumpOwners(elInfo)` in reorderBy, the length setter and the
      // index-assign path was reachable, correct, and covered by
      // nothing — a mutation sweep deleted all three with 489 tests
      // still green. Every mutation of an inner array must wake a
      // consumer iterating the OUTER one.
      if (shape === 'nested') {
        test(`${shape} / ${mut} / the OUTER iteration re-runs`, () => {
          const s = memStore(SHAPES[shape]());
          const n = rx(() => s.rows.map((e) => e.inner.length).join(','));
          const b = n();
          MUTATIONS[mut](armOf(shape, s));
          expect(n() - b).toBeGreaterThan(0);
        });
      }

      // ── no runaway signal growth ────────────────────────────────
      test(`${shape} / ${mut} / no unbounded version growth`, () => {
        const s = memStore(SHAPES[shape]());
        const arm = armOf(shape, s);
        for (let i = 0; i < arm.length; i++) void arm[i];
        const before = s[STORE].versions();
        for (let r = 0; r < 20; r++) {
          const a = armOf(shape, s);
          if (a.length === 0) a.push({ v: 0 });
          MUTATIONS[mut](armOf(shape, s));
          const a2 = armOf(shape, s);
          for (let i = 0; i < a2.length; i++) void (a2[i] && a2[i].v);
        }
        // 20 rounds of churn must not scale signals with the churn.
        expect(s[STORE].versions()).toBeLessThan(before + 200);
        expect(s[STORE].memos()).toBeLessThan(400);
      });
    }
  }

  // ── persistence: the half that keeps going missing ──────────────
  // Separate loop because it needs async + a reopen, and because the
  // failure it catches ("correct in memory, wrong on disk") is exactly
  // the one that four hand-written fixes shipped.
  for (const shape of ['collection', 'mixed', 'idless']) {
    for (const mut of Object.keys(MUTATIONS)) {
      test(`${shape} / ${mut} / survives a reopen`, async () => {
        const s = freshStore(SHAPES[shape]());
        expect(await settle(s)).toBe(true);
        // Seed through the store so collections get real element frames,
        // rather than relying on initState (which does not round-trip).
        s.rows = SHAPES[shape]().rows;
        // FLUSH BETWEEN THE SEED AND THE MUTATION. Without it the two
        // land in one batch and the mutation's frames simply overwrite
        // the seed's — which hides every stale-frame bug, and every one
        // of the five found in this round needed the first flush to have
        // actually happened.
        await s[STORE].flushNow();
        MUTATIONS[mut](s.rows);
        const expected = JSON.parse(JSON.stringify(s.rows));
        await s[STORE].flushNow();
        const b = reopenSame(SHAPES[shape]());
        expect(await settle(b)).toBe(true);
        expect(JSON.parse(JSON.stringify(b.rows))).toEqual(expected);
      });

      test(`${shape} / ${mut} / persist:false writes nothing`, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-mx-'));
        globalThis.__skal_data_dir = dir;
        const s = createSkalStore(SHAPES[shape](),
          { name: 'mx', paths: { rows: { persist: false } } });
        expect(await settle(s)).toBe(true);
        const base = s[STORE].pending();
        s.rows = SHAPES[shape]().rows;
        MUTATIONS[mut](s.rows);
        expect(s[STORE].pending()).toBe(base);
      });
    }
  }
});

describe('a version migration reaches declared-dep effects', () => {
  test('setAt([], ...) notifies the whole tree', async () => {
    const s = freshStore({ user: { name: 'ada' } });
    expect(await settle(s)).toBe(true);
    s.user.name = 'bo';
    await s[STORE].flushNow();

    // Reopen at a higher version with a migrate fn. init() replaces the
    // whole tree via setAt([], next, ''), whose early return skipped the
    // notify entirely — the single largest state change the store can
    // make never reached a declared-dep effect.
    const b = createSkalStore({ user: { name: 'ada' } }, {
      version: 2,
      migrate: (old) => ({ user: { name: String(old?.user?.name ?? '') + '-v2' } }),
    });
    const seen = [];
    b[STORE].createEffect(['user.name'], (v) => { seen.push(v[0]); });
    expect(await settle(b)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(b.user.name).toBe('bo-v2');
    expect(seen).toContain('bo-v2');
  });
});

// ── round four ───────────────────────────────────────────────────────
describe('round four regressions', () => {
  test('extending a collection with length does not throw', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 });
    expect(() => { s.items.length = 4; }).not.toThrow();
    expect(s.items.length).toBe(4);
  });

  test('fill degrades a collection and a later push still round-trips', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 }, { a: 2 });
    void s.items[0].a;                       // warm collCache = true
    await s[STORE].flushNow();
    s.items.fill(5);
    await s[STORE].flushNow();
    s.items.push({ q: 1 });
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(JSON.parse(JSON.stringify(b.items))).toEqual([5, 5, { q: 1 }]);
  });

  test('vivification wakes the ancestor exactly once', () => {
    const s = memStore({ a: { b: { c: 1 } } });
    const held = s.a.b;
    const n = rx(() => JSON.stringify(s.a));
    s.a = 5;
    const b = n();
    void held.c;
    held.c = 7;
    expect(n() - b).toBe(1);
    expect(s.a).toEqual({ b: { c: 7 } });
  });

  test('vivification reaches declared-dep effects on the ancestor', async () => {
    const s = memStore({ a: { b: { c: 1 } } });
    const held = s.a.b;
    s.a = 5;
    const seen = [];
    s[STORE].createEffect(['a'], (v) => { seen.push(JSON.stringify(v[0])); });
    void held.c;
    held.c = 7;
    // Declared-dep effects flush on a scheduled tick, not synchronously.
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.some((x) => x && x.includes('7'))).toBe(true);
  });
});

// ── round five: one predicate, one owner ─────────────────────────────
//
// Five reported bugs, one cause. `stageAt` used "are all elements
// objects?" to answer "can this be stored as per-element frames?", and
// the four array mutators each maintained the `#x` index frame by hand.
// Every case below was a different site failing the same way.
describe('the array on-disk format has one owner', () => {
  test('a splice leaving an ID-LESS object array round-trips', async () => {
    const s = freshStore({ list: [] });
    expect(await settle(s)).toBe(true);
    s.list = [1, { a: 1 }];              // mixed -> no ids minted
    await s[STORE].flushNow();
    s.list.splice(0, 1);                 // now all-objects, still id-less
    await s[STORE].flushNow();
    const b = reopenSame({ list: [] });
    expect(await settle(b)).toBe(true);
    expect(JSON.parse(JSON.stringify(b.list))).toEqual([{ a: 1 }]);
  });

  test('an index assign that DEGRADES a collection round-trips', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ a: 1 }, { a: 2 }];
    await s[STORE].flushNow();
    s.items[0] = 5;
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items[0]).toBe(5);
    expect(b.items[1].a).toBe(2);
  });

  test('an index assign that PROMOTES to a collection round-trips', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [5];
    await s[STORE].flushNow();
    s.items[0] = { v: 1 };
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items[0].v).toBe(1);
  });

  test('EXTENDING a collection with length round-trips', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ a: 1 }, { a: 2 }];
    await s[STORE].flushNow();
    s.items.length = 4;                  // holes -> no longer per-element
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items.length).toBe(4);
  });

  test('deleting an ID-LESS object array actually deletes it', async () => {
    // tombstoneTree has to match the format stageArray WROTE. Keyed off
    // `_isColl`, it tombstoned only `k:list#x` and left the whole-array
    // frame on disk, so the list came back at the next open.
    const s = freshStore({ list: [] });
    expect(await settle(s)).toBe(true);
    s.list = [1, { a: 1 }];
    await s[STORE].flushNow();
    s.list.splice(0, 1);
    await s[STORE].flushNow();
    delete s.list;
    await s[STORE].flushNow();
    const b = reopenSame({ list: [] });
    expect(await settle(b)).toBe(true);
    expect(JSON.parse(JSON.stringify(b.list))).toEqual([]);
  });
});

describe('persist:false survives a wholesale assign over it', () => {
  test('a subtree assign does not blob a non-persist leaf onto disk', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-np2-'));
    globalThis.__skal_data_dir = dir;
    const s = createSkalStore({ a: { secret: '', b: { c: 0 } } },
      { name: 'np2', paths: { 'a.secret': { persist: false } } });
    expect(await settle(s)).toBe(true);
    // The secret arrives at RUNTIME — an initState default would be in
    // the app binary anyway (and is recorded in `#meta` as the schema).
    s.a = { secret: 'SUPERSECRET', b: { c: 1 } };
    await s[STORE].flushNow();
    let found = false;
    const walk = (p) => {
      for (const f of fs.readdirSync(p, { withFileTypes: true })) {
        const q = path.join(p, f.name);
        if (f.isDirectory()) walk(q);
        else if (fs.readFileSync(q).includes('SUPERSECRET')) found = true;
      }
    };
    walk(dir);
    expect(found).toBe(false);
    expect(s.a.secret).toBe('SUPERSECRET');     // still live in memory
    expect(s.a.b.c).toBe(1);                    // and its sibling persisted
  });
});

describe('addressing-scheme sets do not grow with churn', () => {
  test('nested arrays under churned elements are pruned', () => {
    const s = memStore({ items: [] });
    for (let r = 0; r < 60; r++) {
      s.items.push({ tags: [{ n: r }] });
      void s.items[0].tags[0].n;                // interns items.<id>.tags
      s.items.splice(0, 1);
    }
    // Keyed by store key, so a nested array under a collection element
    // interns a NEW key per element id. Nothing pruned them, and neither
    // versions() nor memos() can see it — hence the third counter.
    expect(s[STORE].proxied()).toBeLessThan(10);
  });
});

// ── round six ────────────────────────────────────────────────────────
describe('delPrefix actually sweeps', () => {
  test('a leaf override from an EARLIER flush window does not resurrect', async () => {
    // Every engine key is namespaced `k:` + sk, and doFlush handed
    // delPrefix the bare sk — so it tested `startsWith('a.')` against
    // `'k:a.b.c'` and swept nothing, on either backend. The
    // same-window case was masked by delPrefixLater's dirty purge,
    // which is why the existing test of this passed. TWO windows is
    // what exercises the native sweep.
    const s = freshStore({ a: { b: { c: 0 } } });
    expect(await settle(s)).toBe(true);
    s.a.b.c = 1;
    await s[STORE].flushNow();                 // the leaf is ON DISK now
    s.a = { x: 2 };
    await s[STORE].flushNow();
    const b = reopenSame({ a: { b: { c: 0 } } });
    expect(await settle(b)).toBe(true);
    expect(b.a).toEqual({ x: 2 });
  });

  test('degrading a collection does not orphan its element frames', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items = [{ a: 1 }, { a: 2 }];
    await s[STORE].flushNow();
    const before = s[STORE].engineStats().records;
    s.items[0] = 5;                            // -> whole-array frame
    await s[STORE].flushNow();
    // The two `k:items.<id>` frames are superseded and must go, or a
    // list that degrades and re-promotes leaks a generation per cycle
    // with nothing in engineStats() to tell it from real data.
    expect(s[STORE].engineStats().records).toBeLessThan(before);
  });
});

describe('deleting a promoted collection deletes all of it', () => {
  test('the pre-promotion blob does not come back', async () => {
    const s = freshStore({ list: [] });
    expect(await settle(s)).toBe(true);
    s.list = [1, 2, 3];                        // blob at k:list
    await s[STORE].flushNow();
    s.list = [{ a: 1 }];                       // promotes; blob masked by #x
    await s[STORE].flushNow();
    delete s.list;
    await s[STORE].flushNow();
    const b = reopenSame({ list: [] });
    expect(await settle(b)).toBe(true);
    expect(JSON.parse(JSON.stringify(b.list))).toEqual([]);
  });
});

describe('fill and copyWithin destroy elements, and say so', () => {
  test('an id-addressed holder is notified when fill replaces its element', () => {
    const s = memStore({ rows: [{ _id: '1', v: 1 }, { _id: '2', v: 2 }] });
    const el = s.rows[0];
    const n = rx(() => el.v);
    const b = n();
    s.rows.fill(5);
    expect(n() - b).toBeGreaterThan(0);
  });

  test('the destroyed elements are pruned like a splice would', () => {
    const build = () => {
      const s = memStore({ rows: [] });
      for (let i = 0; i < 80; i++) s.rows.push({ v: i });
      for (let i = 0; i < 80; i++) void s.rows[i].v;
      return s;
    };
    const viaFill = build();
    viaFill.rows.fill({ v: 0 });
    const viaSplice = build();
    viaSplice.rows.splice(0, viaSplice.rows.length);
    expect(viaFill[STORE].versions())
      .toBeLessThanOrEqual(viaSplice[STORE].versions() + 90);
    expect(viaFill[STORE].memos() - viaSplice[STORE].memos()).toBeLessThan(80);
  });
});

// ── round seven ──────────────────────────────────────────────────────
// Four of these were introduced by round six's fixes. Three of those
// four came from work nobody asked for — orphan cleanup and a tidier
// argument — bolted onto a reported fix. The rule that follows: fix what
// reproduced, nothing adjacent.
describe('the ROOT key is not a prefix', () => {
  test('a root-level array does not destroy #meta', async () => {
    // `sk === ''` made delPrefixLater's prefix `'k:'`, which matches
    // `k:#meta` — so a push to a root array tombstoned the version and
    // shape metadata that migrate() reads.
    //
    // NB: root arrays do not round-trip, at HEAD or now — that is a
    // separate unsupported shape and this test deliberately does not
    // assert it. What is at stake here is only that the mutation cannot
    // take `#meta` with it.
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-root-'));
    const s = createSkalStore([1, 2, 3], { name: 'root', version: 1 });
    expect(await settle(s)).toBe(true);
    s.push(4);
    await s[STORE].flushNow();
    // Reopen at a HIGHER version: migrate only runs when `#meta` and its
    // `shape` survived, so this is the observable for the metadata.
    let sawMigrate = false;
    const b = createSkalStore([1, 2, 3], {
      name: 'root', version: 2,
      migrate: (old) => { sawMigrate = true; return old; },
    });
    expect(await settle(b)).toBe(true);
    expect(sawMigrate).toBe(true);
  });

  test('a root-level object assign keeps #meta too', async () => {
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-root2-'));
    const s = createSkalStore({ a: 1 }, { name: 'root2', version: 2 });
    expect(await settle(s)).toBe(true);
    s.a = 9;
    await s[STORE].flushNow();
    const b = createSkalStore({ a: 1 }, { name: 'root2', version: 2 });
    expect(await settle(b)).toBe(true);
    expect(b.a).toBe(9);
  });
});

describe('array mutators honour persist:false', () => {
  test('a nested array push inside a non-persist element stages nothing', async () => {
    globalThis.__skal_data_dir =
      fs.mkdtempSync(path.join(os.tmpdir(), 'skal-np3-'));
    const s = createSkalStore({ secrets: [] },
      { name: 'np3', paths: { secrets: { persist: false } } });
    expect(await settle(s)).toBe(true);
    s.secrets = [{ tags: ['a'] }];
    const base = s[STORE].pending();
    s.secrets[0].tags.push('b');
    expect(s[STORE].pending()).toBe(base);
    expect(s.secrets[0].tags).toEqual(['a', 'b']);
  });
});

describe('id-pruning never touches an index-addressed array', () => {
  test('fill on a mixed array leaves index subscribers alive', () => {
    // The element carrying `_id` '1' is destroyed, but children here are
    // addressed by INDEX — so pruning `rows.1.*` deletes index 1's live
    // signals. splice guards this with `wasColl`; reorderBy did not.
    const s = memStore({ rows: [{ _id: '1', v: 10 }, { v: 20 }, 7] });
    const n = rx(() => s.rows[1]?.v);
    s.rows.fill(0, 0, 1);
    const mid = n();
    s.rows[1].v = 99;
    expect(n()).toBeGreaterThan(mid);
  });
});

describe('sparse and odd values do not break assignment', () => {
  test('a sparse array of objects assigns without throwing', () => {
    const s = memStore({ items: [] });
    const a = [];
    a[0] = { _id: '1', x: 1 };
    a[2] = { y: 2 };                    // hole at 1
    expect(() => { s.items = a; }).not.toThrow();
    expect(s.items.length).toBe(3);
  });

  test('push(undefined) grows the array', () => {
    // setAt's no-op guard is right for hydration but wrong for an
    // append, where `old` is undefined because the slot does not exist.
    const s = memStore({ list: [] });
    s.list.push(undefined);
    expect(s.list.length).toBe(1);
  });
});

describe('replacing an element by id cleans up the old one', () => {
  test('an index assign with a new _id does not orphan the old frame', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ v: 1 });
    s.items.push({ v: 2 });
    await s[STORE].flushNow();
    const before = s[STORE].engineStats().records;
    s.items[0] = { _id: '99', v: 3 };
    await s[STORE].flushNow();
    expect(s[STORE].engineStats().records).toBeLessThanOrEqual(before);
  });

  test('fill over a collection tombstones the frames it destroys', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ v: 1 });
    s.items.push({ v: 2 });
    s.items.push({ v: 3 });
    await s[STORE].flushNow();
    const before = s[STORE].engineStats().records;
    s.items.copyWithin(0, 1);
    await s[STORE].flushNow();
    expect(s[STORE].engineStats().records).toBeLessThan(before);
  });
});

describe('index-addressed holders see slots move', () => {
  test('splice shifts a held index proxy and says so', () => {
    const s = memStore({ rows: [{ v: 1 }, { v: 2 }, 7] });
    const el = s.rows[1];
    const n = rx(() => el.v);
    const b = n();
    s.rows.splice(0, 1);
    expect(n() - b).toBeGreaterThan(0);
  });

  test('a truncation past a held index proxy says so', () => {
    const s = memStore({ rows: [{ v: 1 }, { v: 2 }, 7] });
    const el = s.rows[1];
    const n = rx(() => el.v);
    const b = n();
    s.rows.length = 1;
    expect(n() - b).toBeGreaterThan(0);
  });
});

describe('plain arrays do not register a prefix sweep', () => {
  test('pushing numbers never schedules a delPrefix', async () => {
    const s = freshStore({ nums: [] });
    expect(await settle(s)).toBe(true);
    s.nums.push(1);
    s.nums.push(2);
    await s[STORE].flushNow();
    // ZERO registered sweeps. `records` cannot see this — a sweep of a
    // namespace with no records deletes nothing — so the cost is only
    // visible as a count. Each one is a full-keydir scan per flush,
    // natively and in LogStore.
    expect(s[STORE].prefixSweeps()).toBe(0);
    expect(s[STORE].engineStats().records).toBeLessThanOrEqual(3);
    const b = reopenSame({ nums: [] });
    expect(await settle(b)).toBe(true);
    expect(JSON.parse(JSON.stringify(b.nums))).toEqual([1, 2]);
  });
});

// ── round eight ──────────────────────────────────────────────────────
describe('a collection replaced by a NON-array', () => {
  test('assigning a scalar over it retires the index', async () => {
    // stageArray is the single owner of `#x`, but stageAt only routes
    // there when the new value IS an array — so the index survived and
    // hydrateArray, which reads it first, rebuilt the old collection
    // over the scalar.
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 });
    await s[STORE].flushNow();
    s.items = 5;
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items).toBe(5);
  });

  test('assigning null over it does the same', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 });
    await s[STORE].flushNow();
    s.items = null;
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items).toBe(null);
  });
});

describe('vivification inside a collection element', () => {
  test('the ancestor bump uses the STORE key, not the resolved index', () => {
    // concreteOf turns `{__id:'1'}` into an INDEX, so building the
    // ancestor key from the resolved path produced `items.0.meta` while
    // the proxies interned `items.1.meta`.
    const s = memStore({ items: [] });
    s.items.push({ meta: { q: 1 } });
    const el = s.items[0];
    const m = el.meta;
    const n = rx(() => JSON.stringify(el.meta));
    el.meta = 5;
    const b = n();
    void m.q;
    m.q = 7;
    expect(n() - b).toBeGreaterThan(0);
    expect(el.meta).toEqual({ q: 7 });
  });

  test('a no-op write does not silently clobber the ancestor', () => {
    // The `old === v` early return fired AFTER the vivification loop had
    // already replaced the ancestor scalar with `{}` — memory mutated,
    // nothing notified, nothing staged.
    const s = memStore({ a: { b: { c: 1 } } });
    const held = s.a.b;
    s.a = 5;
    const n = rx(() => JSON.stringify(s.a));
    void held.c;
    const b = n();
    held.c = undefined;                 // `old === v`, both undefined
    // The vivification loop has already replaced `5` with `{}` by the
    // time the no-op guard is reached. Returning there left memory
    // mutated with NOTHING notified — a subscriber on `s.a` kept
    // serving `5` while the tree said otherwise. The write must either
    // not happen or be announced; silence with a mutated tree is the bug.
    expect(n() - b).toBeGreaterThan(0);
  });
});

describe('a truncation re-encodes nothing', () => {
  test('length = N stages the index, not every survivor', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    for (let i = 0; i < 50; i++) s.items.push({ v: i });
    await s[STORE].flushNow();
    s.items.length = 40;
    // No surviving element's bytes change — only membership, which
    // lives in `#x`. Re-encoding all 40 was the exact waste the
    // `changed` parameter exists to prevent.
    expect(s[STORE].pending()).toBeLessThan(20);
    await s[STORE].flushNow();
    const b = reopenSame({ items: [] });
    expect(await settle(b)).toBe(true);
    expect(b.items.length).toBe(40);
  });
});

// ── closing the mutation-sweep survivors ─────────────────────────────
//
// Each of these pins a statement that could be deleted with the whole
// suite green. Written from the SITE, not from a behaviour someone
// happened to think of — which is the difference between a suite that
// grows and one that covers.
describe('array iteration hears a wholesale replace', () => {
  test('map re-runs when the array is reassigned', () => {
    // `bumpArray` is the only thing that bumps `#all` on a wholesale
    // replace — the mutators bump it themselves, so nothing else covers
    // this path.
    const s = memStore({ items: [{ v: 1 }] });
    const n = rx(() => s.items.map((e) => e.v).join(','));
    const b = n();
    s.items = [{ v: 2 }, { v: 3 }];
    expect(n() - b).toBeGreaterThan(0);
  });
});

describe('index readers hear reorders and truncations', () => {
  test('a bare index read re-runs on reverse', () => {
    // `s.rows[1]` subscribes to `rows#1`, which only bumpIndices touches
    // — the by-slot bumpReplaced added later bumps `rows.1`, a different
    // key.
    const s = memStore({ rows: [{ v: 1 }, { v: 2 }, { v: 3 }] });
    const n = rx(() => s.rows[1]);
    const b = n();
    s.rows.reverse();
    expect(n() - b).toBeGreaterThan(0);
  });

  test('a bare index read re-runs on truncation', () => {
    const s = memStore({ rows: [{ v: 1 }, { v: 2 }, { v: 3 }] });
    const n = rx(() => s.rows[2]);
    const b = n();
    s.rows.length = 1;
    expect(n() - b).toBeGreaterThan(0);
  });
});

describe('declared-dep effects hear ordinary writes', () => {
  test('a leaf write reaches createEffect', async () => {
    const s = memStore({ a: { x: 0 } });
    const seen = [];
    s[STORE].createEffect(['a.x'], (v) => { seen.push(v[0]); });
    s.a.x = 42;
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toContain(42);
  });

  test('an index assign reaches createEffect', async () => {
    const s = memStore({ items: [{ v: 1 }] });
    const seen = [];
    s[STORE].createEffect(['items.0'], (v) => { seen.push(JSON.stringify(v[0])); });
    s.items[0] = { v: 9 };
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.some((x) => x && x.includes('9'))).toBe(true);
  });
});

describe('deleting a subtree clears what hung beneath it', () => {
  test('leaf overrides under a deleted subtree do not resurrect', async () => {
    const s = freshStore({ a: { b: { c: 0, d: 0 } } });
    expect(await settle(s)).toBe(true);
    s.a.b.c = 1;
    s.a.b.d = 2;
    await s[STORE].flushNow();
    delete s.a;
    await s[STORE].flushNow();
    const b = reopenSame({ a: { b: { c: 0, d: 0 } } });
    expect(await settle(b)).toBe(true);
    // The OVERRIDES must not come back. What is left is whatever
    // initState declares — a delete removes persisted state, it does not
    // remove the schema. (At HEAD this returned {c:1,d:2}: the whole
    // subtree resurrected, because delPrefix was matching nothing.)
    expect(b.a && b.a.b && b.a.b.c).not.toBe(1);
    expect(b.a && b.a.b && b.a.b.d).not.toBe(2);
  });

  test('a vivified ancestor does not carry stale siblings back', async () => {
    const s = freshStore({ a: { b: { c: 0, d: 0 } } });
    expect(await settle(s)).toBe(true);
    s.a.b.c = 1;
    s.a.b.d = 2;
    await s[STORE].flushNow();
    const held = s.a.b;
    s.a = 5;
    await s[STORE].flushNow();
    void held.c;
    held.c = 7;                        // re-materialises `a`
    await s[STORE].flushNow();
    const b = reopenSame({ a: { b: { c: 0, d: 0 } } });
    expect(await settle(b)).toBe(true);
    // `d` was staged before `a` became a scalar; the ancestor stage must
    // clear it or it rides back in under the new `a`. The ancestor is
    // staged WHOLESALE as `{b:{c:7}}`, so `d` is simply absent — what
    // matters is that it is not 2.
    expect(b.a.b.d).not.toBe(2);
    expect(b.a.b.c).toBe(7);
  });
});

describe('non-persist siblings still persist', () => {
  test('a subtree assign stages every persisted child', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-sib-'));
    globalThis.__skal_data_dir = dir;
    const s = createSkalStore({ a: { secret: '', b: 0 } },
      { name: 'sib', paths: { 'a.secret': { persist: false } } });
    expect(await settle(s)).toBe(true);
    s.a = { secret: 'x', b: 7 };       // takes the per-key recursion
    await s[STORE].flushNow();
    globalThis.__skal_data_dir = dir;
    const b = createSkalStore({ a: { secret: '', b: 0 } },
      { name: 'sib', paths: { 'a.secret': { persist: false } } });
    expect(await settle(b)).toBe(true);
    expect(b.a.b).toBe(7);             // the persisted sibling survived
    expect(b.a.secret).toBe('');       // the non-persist one did not
  });
});

describe('the debounced flush lands without flushNow', () => {
  test('a write persists on the timer alone', async () => {
    const s = freshStore({ v: 0 });
    expect(await settle(s)).toBe(true);
    s.v = 99;
    // No flushNow. FLUSH_DEBOUNCE_MS is 60; every scheduleFlush() in the
    // write paths is what arms it, and the rest of the suite calls
    // flushNow explicitly so none of them are covered.
    await new Promise((r) => setTimeout(r, 200));
    const b = reopenSame({ v: 0 });
    expect(await settle(b)).toBe(true);
    expect(b.v).toBe(99);
  });
});

describe('proxies are memoized', () => {
  test('the same path yields the same proxy', () => {
    const s = memStore({ a: { b: { c: 1 } } });
    expect(s.a).toBe(s.a);
    expect(s.a.b).toBe(s.a.b);
  });

  test('repeated delete and recreate does not grow the memo', () => {
    const s = memStore({ cfg: {} });
    const before = s[STORE].memos();
    for (let i = 0; i < 60; i++) {
      s.cfg.sub = { v: i };
      void s.cfg.sub.v;
      delete s.cfg.sub;
    }
    expect(s[STORE].memos() - before).toBeLessThan(10);
  });
});

describe('the element-frame flag is cleared once used', () => {
  test('a second non-array write does not register another sweep', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 });
    await s[STORE].flushNow();
    s.items = 5;
    const afterFirst = s[STORE].prefixSweeps();
    s.items = 6;
    // The flag is consumed by the first non-array write; leaving it set
    // registers a full-keydir scan on every subsequent one.
    expect(s[STORE].prefixSweeps()).toBe(afterFirst);
  });
});

// ── sweep survivors, second pass ─────────────────────────────────────
describe('growing an array past its end', () => {
  test('iteration hears an assign past the end', () => {
    // On a wholesale replace, `bumpKey(sk)` already wakes anything that
    // read `s.items` — so bumpArray's `#all` is redundant THERE. The
    // grow path is where it is the only bump.
    const s = memStore({ items: [{ v: 1 }] });
    const n = rx(() => s.items.map((e) => (e && e.v) || 0).join(','));
    const b = n();
    s.items[3] = { v: 9 };
    expect(n() - b).toBeGreaterThan(0);
  });
});

describe('the element-frame flag on the degrade path', () => {
  test('a degrade consumes the flag exactly once', async () => {
    const s = freshStore({ items: [] });
    expect(await settle(s)).toBe(true);
    s.items.push({ a: 1 });
    await s[STORE].flushNow();
    // A wholesale assign registers a sweep from writeAt regardless, so
    // the observable is the DELTA: the first degrade also consumes the
    // element-frame flag (two registrations), the second must not.
    const s0 = s[STORE].prefixSweeps();
    s.items = [5];                     // degrades: blob branch
    const s1 = s[STORE].prefixSweeps();
    s.items = [6];                     // still a blob; nothing to sweep
    const s2 = s[STORE].prefixSweeps();
    expect(s2 - s1).toBeLessThan(s1 - s0);
  });
});

describe('every write path arms the debounced flush', () => {
  const landsWithoutFlushNow = async (mutate, init) => {
    const s = freshStore(init);
    expect(await settle(s)).toBe(true);
    mutate(s);
    await new Promise((r) => setTimeout(r, 200));   // FLUSH_DEBOUNCE_MS is 60
    const b = reopenSame(init);
    expect(await settle(b)).toBe(true);
    return b;
  };

  test('an array mutation lands on the timer', async () => {
    const b = await landsWithoutFlushNow((s) => { s.items.push({ v: 1 }); },
      { items: [] });
    expect(b.items.length).toBe(1);
  });

  test('a delete lands on the timer', async () => {
    const s = freshStore({ cfg: { a: 1, b: 2 } });
    expect(await settle(s)).toBe(true);
    s.cfg.a = 9;
    await s[STORE].flushNow();
    delete s.cfg.a;
    await new Promise((r) => setTimeout(r, 200));
    const b = reopenSame({ cfg: { a: 1, b: 2 } });
    expect(await settle(b)).toBe(true);
    expect(b.cfg.a).not.toBe(9);
  });

  test('a vivified write lands on the timer', async () => {
    const s = freshStore({ a: { b: { c: 0 } } });
    expect(await settle(s)).toBe(true);
    const held = s.a.b;
    s.a = 5;
    await s[STORE].flushNow();
    void held.c;
    held.c = 7;
    await new Promise((r) => setTimeout(r, 200));
    const b = reopenSame({ a: { b: { c: 0 } } });
    expect(await settle(b)).toBe(true);
    expect(b.a.b.c).toBe(7);
  });
});

describe('deleting distinct keys releases their proxies', () => {
  test('the memo does not grow across distinct deleted subtrees', () => {
    // The earlier version reused ONE key, so the memo never grew and the
    // test could not see dropMemo at all.
    const s = memStore({ cfg: {} });
    const before = s[STORE].memos();
    for (let i = 0; i < 60; i++) {
      s.cfg['sub' + i] = { v: i };
      void s.cfg['sub' + i].v;
      delete s.cfg['sub' + i];
    }
    expect(s[STORE].memos() - before).toBeLessThan(20);
  });
});

// ── the sweep's remaining survivors, classified ──────────────────────
//
// `bun test` cannot pin these, and the reason is worth writing down so
// the next person does not re-derive it. Reproduce the sweep with:
// delete one effectful statement at a time from db.js, run this file.
//
//   24/45 survived  ->  21  ->  13  ->  8
//
// The eight that remain, and why each is not a coverage gap:
//
//   db.js:906   structGen++            in setAt's whole-tree branch.
//                                      Its only caller is migrate, which
//                                      runs during init before any proxy
//                                      exists to hold a stale
//                                      resolution. Unobservable from
//                                      outside the store.
//
//   db.js:1157  scheduleFlush()        stageArray
//   db.js:1387  scheduleFlush()        vivification staging
//   db.js:2762  scheduleFlush()        after init hydration
//                                      Each is EMPIRICALLY redundant:
//                                      the debounce tests above exercise
//                                      all three paths and stay green
//                                      with the line deleted, because
//                                      another call on the same path
//                                      arms the same timer. Redundant is
//                                      not the same as wrong — they are
//                                      cheap and they make each site
//                                      self-contained.
//
//   db.js:1601  nodeMemo.set           objectProxy's `kidCache` already
//                                      returns the same child proxy for
//                                      repeated access through one
//                                      parent, so the node memo is a
//                                      second-level cache. Affects how
//                                      often a proxy is REBUILT, never
//                                      what it reads.
//
//   db.js:1811  collCache.delete
//   db.js:1970  collCache.set
//   db.js:2084  collCache.set          A cache of "is this a
//                                      collection?". Dropping a write
//                                      only forces the next access to
//                                      re-derive it — correctness-
//                                      neutral by construction, which is
//                                      exactly why `_isColl` is cheap to
//                                      call and the cache exists at all.
//
// Everything else in the sweep is now pinned. A statement that can be
// deleted with 518 tests green is either covered by a test that does not
// exist yet, or it is one of these eight — and the difference is the
// only thing the test count cannot tell you.

// ── hydration is driven by disk, not by initState ────────────────────
describe('hydration probes what exists, not what is declared', () => {
  test('a large initState with one record on disk probes nothing', async () => {
    const cells = {};
    for (let i = 0; i < 2000; i++) cells['k' + i] = i;
    const s = freshStore({ cells });
    expect(await settle(s)).toBe(true);
    await s[STORE].flushNow();
    // Nothing was written, so `cells` has no frame and no leaf overrides.
    expect(s[STORE].engineStats().records).toBeLessThan(3);

    const b = reopenSame({ cells });
    expect(await settle(b)).toBe(true);
    // Before this, hydrate asked the keydir about all 2000 declared
    // leaves regardless — 2000 lookups across 8 batch crossings against
    // a keydir holding one record.
    expect(b[STORE].hydrateProbes()).toBe(0);
  });

  test('...and still loads every leaf that IS on disk', async () => {
    const cells = {};
    for (let i = 0; i < 200; i++) cells['k' + i] = 0;
    const s = freshStore({ cells });
    expect(await settle(s)).toBe(true);
    for (let i = 0; i < 200; i++) s.cells['k' + i] = i + 1;   // 200 leaf frames
    await s[STORE].flushNow();

    const b = reopenSame({ cells });
    expect(await settle(b)).toBe(true);
    expect(b[STORE].hydrateProbes()).toBe(200);               // all of them
    for (let i = 0; i < 200; i++) expect(b.cells['k' + i]).toBe(i + 1);
  });

  test('a blob parent still overlays its leaf overrides', async () => {
    const s = freshStore({ cfg: { a: 0, b: 0 } });
    expect(await settle(s)).toBe(true);
    s.cfg = { a: 1, b: 1 };            // one blob frame at k:cfg
    await s[STORE].flushNow();
    s.cfg.b = 9;                       // a leaf override on top
    await s[STORE].flushNow();
    const b = reopenSame({ cfg: { a: 0, b: 0 } });
    expect(await settle(b)).toBe(true);
    expect(b.cfg.a).toBe(1);
    expect(b.cfg.b).toBe(9);
  });
});
