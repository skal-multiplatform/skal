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
import { createRoot, createEffect } from 'solid-js';

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
  // THE REACTIVITY CONTRACT IS NOT TESTABLE HERE, and that is an
  // environment fact rather than a decision. Verified in this repo with
  // solid-js 1.9.13 under bun, inside createRoot:
  //
  //     createEffect        never ran at all        []
  //     createComputed      ran once, never again   [1]
  //     createRenderEffect  ran once, never again   [1]
  //     createMemo          returned 10 while the signal was already 3
  //
  // Reactive propagation does not flush without a renderer, so any
  // assertion about re-runs here would be testing the harness. An
  // earlier version of this test read `null` and looked exactly like a
  // broken subscription; it fails identically at HEAD.
  //
  // WHY IT MATTERS FOR THE CACHE: resolution is untracked, so an effect
  // subscribes only to the leaf it reads, not to intermediate nodes.
  // That is sound only if Solid still notifies the leaf when an ancestor
  // is replaced wholesale (it diffs the new object and fires the leaves
  // whose values changed). Verified on device instead, via the
  // subscriber arms of benchmark_v2's state bench — those run real
  // effects and assert checksums, so a lost subscription changes the
  // reported checksum rather than passing silently.
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
