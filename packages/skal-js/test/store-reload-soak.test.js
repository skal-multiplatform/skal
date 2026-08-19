// The store's engine handle is reused across hot-reload generations.
//
// `__skal_store_open` has no matching `store_close`, so a generation that
// opened its own handle could never give it back. Every reload leaked one
// engine — and worse, left two live handles on one directory, where the
// outgoing generation's debounced flush writes through a keydir the
// incoming one knows nothing about.
//
// The fix is a registry on `globalThis.__skalStoreEngines`, keyed by
// `dataDir + '/' + name`, that hands each new generation the handle the
// last one already had. db.js has one of these in each branch (native and
// JS) and it shipped with no test for either. The reload work was
// exercised to 11 generations by hand, on a device, watching a probe
// line — which proves nothing about the 12th and cannot fail in CI.
//
// WHAT IS NOT ASSERTED HERE: open file descriptors. The obvious check —
// leak 59 engines and watch /dev/fd grow — was written, and it passes
// with the fix deleted. The JS backends go through writeFileSync or
// Bun.mmap and hold no descriptor between calls, so descriptor counting
// cannot see this leak on the path CI takes. It is left out rather than
// left in green: an assertion that cannot fail reads like coverage.
// The count that CAN fail is how many times the host was asked to open,
// which is what the native test below pins to 1.

import { test, expect, describe, afterEach } from 'bun:test';
import { createSkalStore, STORE } from '../src/skal/store/db.js';
import { NativeLogStore } from '../src/skal/store/engine.js';
import { installHotCoordinator } from '../src/hot.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const GENERATIONS = 60;

async function settle(s) {
  for (let i = 0; i < 400; i++) {
    if (s[STORE].ready()) return true;
    await new Promise((r) => setTimeout(r, 5));
  }
  return s[STORE].ready();
}

/// One hot-reload generation: the bundle is re-evaluated, so module state
/// and the whole Solid tree are rebuilt from scratch against the SAME data
/// directory.
///
/// NOT the whole of a reload. db.js registers a `__skalHot.addCleanup`
/// that flushes the outgoing generation (db.js:871), and nothing here sets
/// `globalThis.__skalHot` or tears a generation down, so that branch is
/// dead in this file. What these tests pin is handle identity across 60
/// opens — NOT the flush/hydrate ordering across a teardown, which is the
/// other half of the hazard the registry comment describes and is still
/// uncovered.
async function generation(init) {
  const s = createSkalStore(init, {});
  expect(await settle(s)).toBe(true);
  return s;
}

const registry = () => globalThis.__skalStoreEngines;
const keyFor = (dir) =>
  [...(registry()?.keys() ?? [])].find((k) => k.startsWith(dir));

/// Leave the process as we found it.
///
/// The registry is keyed by `dataDir + '/' + name` with no backend
/// discriminator, so an engine left behind here is handed to whatever
/// opens that directory next — and the native tests below leave a
/// `NativeLogStore` whose host hooks are about to be deleted. A later file
/// inheriting both that entry and a stale `__skal_data_dir` would take the
/// JS branch, find the dead native engine, and die on the first `put`.
///
/// Today's filename ordering hides it. That is exactly the dependency
/// 0fe252b removed from the other reload test, so it does not get to come
/// back in through this one.
function sandbox(prefix) {
  const savedDir = globalThis.__skal_data_dir;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  globalThis.__skal_data_dir = dir;
  return {
    dir,
    cleanup() {
      for (const k of [...(registry()?.keys() ?? [])])
        if (k.startsWith(dir)) registry().delete(k);
      if (savedDir === undefined) delete globalThis.__skal_data_dir;
      else globalThis.__skal_data_dir = savedDir;
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { }
    },
  };
}

describe('store survives repeated hot-reload generations', () => {
  let box;
  afterEach(() => { box?.cleanup(); box = null; });

  test('JS backend: 60 generations share one engine, data survives', async () => {
    const { dir } = (box = sandbox('skal-soak-js-'));

    const g1 = await generation({ todos: [] });
    g1.todos.push({ _id: 1, text: 'written by generation 1' });
    g1[STORE].flushNow();

    const key = keyFor(dir);
    expect(key).toBeString();
    const engine1 = registry().get(key);
    expect(engine1).toBeDefined();

    let last = g1;
    for (let gen = 2; gen <= GENERATIONS; gen++) {
      last = await generation({ todos: [] });
      // The whole contract, in one line: the new generation got the OLD
      // handle. Both mutations of the fix — dropping the lookup, and
      // dropping the lookup while still writing the registry so the map
      // stays tidy — fail here, on generation 2.
      expect(registry().get(key), `generation ${gen}`).toBe(engine1);
    }

    expect([...registry().keys()].filter((k) => k.startsWith(dir)))
      .toHaveLength(1);

    // And the point of all of it.
    expect(last.todos).toHaveLength(1);
    expect(last.todos[0].text).toBe('written by generation 1');
  }, 120_000);
});

// ---------------------------------------------------------------------
// The native branch.
//
// This is the branch the leak actually mattered on — there is no
// `store_close`, so a per-generation open is unrecoverable — and it is
// the branch nothing has ever driven. engine.js says so itself, twice:
// "no test drives NativeLogStore, so nothing can construct a short
// buffer".
//
// The host is faked, but faithfully: the wire formats below are the ones
// NativeLogStore decodes, not a convenient stand-in. A double that hands
// back Uint8Arrays where the real host sends ArrayBuffers would exercise
// the fallback paths instead of the ones on device.
// ---------------------------------------------------------------------

const HOOKS = ['__skal_store_open', '__skal_store_put', '__skal_store_get',
  '__skal_store_get_many', '__skal_store_keys', '__skal_store_del',
  '__skal_store_del_prefix', '__skal_store_stats', '__skal_store_compact'];

const enc = new TextEncoder();
const bytesOf = (v) =>
  (typeof v === 'string') ? enc.encode(v)
    : (v instanceof Uint8Array) ? v : new Uint8Array(v);

/// ONE buffer, reused for every batched read — the way the real host does
/// it, not the convenient way.
///
/// engine.js is explicit that these are "a no-copy view over the store's
/// single reusable scratch ... valid only until the next get/getMany", and
/// that holding two at once shipped a bug once: N results aliasing one
/// buffer, every one decoding to the last record read, caught only by a
/// benchmark checksum. A fake that allocates a fresh ArrayBuffer per call
/// makes that whole class unreachable — correct code and the aliasing bug
/// both pass. Reusing the buffer means a future reader that holds results
/// across a read fails here instead of on a device.
///
/// The readers bound-check against `byteLength`, so a scratch larger than
/// the payload is fine; the count header is what they size from.
///
/// LIMIT, stated rather than papered over: `get` (per-key) returns a
/// length-sized ArrayBuffer over the same memory, which pure JS cannot
/// model — two ArrayBuffer objects cannot share bytes. So `_perKey`'s
/// load-bearing copy is still not covered. It is only reached when
/// `__skal_store_get_many` is absent or refuses, which this fake never
/// does.
const SCRATCH = new ArrayBuffer(1 << 20);

/// [u32 count][u32 len_i × count][bytes...], little-endian — the format
/// allKeys and getMany both decode. A null item is marked absent with the
/// 0xFFFFFFFF sentinel getMany looks for.
function packed(items) {
  const n = items.length;
  const total = items.reduce((a, b) => a + (b ? b.length : 0), 0);
  const need = 4 + n * 4 + total;
  if (need > SCRATCH.byteLength) throw new Error('fake scratch too small');
  const ab = SCRATCH;
  const dv = new DataView(ab);
  const u8 = new Uint8Array(ab);
  u8.fill(0, 0, need);
  dv.setUint32(0, n, true);
  let off = 4 + n * 4;
  for (let i = 0; i < n; i++) {
    const b = items[i];
    if (b === null) { dv.setUint32(4 + i * 4, 0xFFFFFFFF, true); continue; }
    dv.setUint32(4 + i * 4, b.length, true);
    u8.set(b, off);
    off += b.length;
  }
  return ab;
}

/// An in-memory host. `opens` is the number the test is really about.
function fakeNativeHost() {
  const dirs = new Map();          // dir  → Map<key, Uint8Array>
  const handles = new Map();       // h    → dir
  let next = 1, opens = 0;

  const data = (h) => dirs.get(handles.get(h));
  const saved = Object.fromEntries(HOOKS.map((k) => [k, globalThis[k]]));

  globalThis.__skal_store_open = (dir) => {
    opens++;
    if (!dirs.has(dir)) dirs.set(dir, new Map());
    const h = next++;
    handles.set(h, dir);
    return h;                       // nonzero, or open() throws
  };
  globalThis.__skal_store_put = (h, k, v) => { data(h).set(k, bytesOf(v)); };
  globalThis.__skal_store_del = (h, k) => { data(h).delete(k); };
  globalThis.__skal_store_del_prefix = (h, p) => {
    for (const k of [...data(h).keys()])
      if (k.startsWith(p + '.') || k.startsWith(p + '#')) data(h).delete(k);
  };
  // ArrayBuffer | null — NOT Uint8Array. See the contract note in engine.js.
  globalThis.__skal_store_get = (h, k) => {
    const v = data(h).get(k);
    return v ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : null;
  };
  globalThis.__skal_store_get_many = (h, keys) =>
    packed(keys.map((k) => data(h).get(k) ?? null));
  globalThis.__skal_store_keys = (h) =>
    packed([...data(h).keys()].map((k) => enc.encode(k)));
  // Four little-endian u32s: records, segments, deadBytes, seq. Omitting
  // these two was not a harmless gap — db.js calls stats() on every init
  // and NativeLogStore.stats() reaches for the hook with no `typeof`
  // guard, so the store threw before the first generation finished.
  globalThis.__skal_store_stats = (h) => {
    const ab = new ArrayBuffer(16);
    const dv = new DataView(ab);
    dv.setUint32(0, data(h).size, true);
    dv.setUint32(4, 1, true);
    dv.setUint32(8, 0, true);
    dv.setUint32(12, data(h).size, true);
    return ab;
  };
  globalThis.__skal_store_compact = () => false;

  return {
    get opens() { return opens; },
    restore() {
      for (const k of HOOKS) {
        if (saved[k] === undefined) delete globalThis[k];
        else globalThis[k] = saved[k];
      }
    },
  };
}

describe('store survives repeated hot-reload generations (native host)', () => {
  let host, box;
  afterEach(() => { host?.restore(); host = null; box?.cleanup(); box = null; });

  test('60 generations ask the host to open exactly once', async () => {
    host = fakeNativeHost();
    const { dir } = (box = sandbox('skal-soak-native-'));

    const g1 = await generation({ todos: [] });
    // `backendKind` is a Solid signal, not a field. Prove we took the
    // native branch — without this the whole test would still pass with
    // the host fake ignored and the JS backend quietly serving it.
    expect(g1[STORE].backendKind()).toBe('native');
    expect(host.opens).toBe(1);

    g1.todos.push({ _id: 7, text: 'native generation 1' });
    g1[STORE].flushNow();

    const engine1 = registry().get(keyFor(dir));
    let last = g1;
    for (let gen = 2; gen <= GENERATIONS; gen++) {
      last = await generation({ todos: [] });
      expect(registry().get(keyFor(dir)), `generation ${gen}`).toBe(engine1);
    }

    // The leak, stated as a number. Without reuse this is 60, and 59 of
    // those handles can never be given back.
    expect(host.opens, `host opened ${host.opens} handles`).toBe(1);

    expect(last.todos).toHaveLength(1);
    expect(last.todos[0].text).toBe('native generation 1');
  }, 120_000);
});


// ---------------------------------------------------------------------
// Version skew: a JS bundle newer than the dylib.
//
// `allKeys`, `delPrefix` and `getMany` have always guarded their host
// hooks with `typeof fn === 'function'` for exactly this case. `stats`
// and `compact` did not, and db.js calls `stats()` on every init — so an
// absent hook threw the store dead during initialization instead of
// taking the zeroed-stats branch that was sitting three lines below it,
// unreachable.
//
// Mutation-checked: restoring either bare call fails this with
// "globalThis.__skal_store_stats is not a function".
// ---------------------------------------------------------------------
describe('NativeLogStore tolerates a host that predates a hook', () => {
  test('stats and compact degrade instead of throwing', () => {
    const saved = {
      stats: globalThis.__skal_store_stats,
      compact: globalThis.__skal_store_compact,
    };
    delete globalThis.__skal_store_stats;
    delete globalThis.__skal_store_compact;
    try {
      const s = new NativeLogStore('/nonexistent');
      s._h = 1;                       // pretend open() succeeded
      expect(s.stats()).toEqual({
        backend: 'native', records: 0, segments: 0, deadBytes: 0, seq: 0,
      });
      expect(s.compact()).toBe(false);
    } finally {
      if (saved.stats === undefined) delete globalThis.__skal_store_stats;
      else globalThis.__skal_store_stats = saved.stats;
      if (saved.compact === undefined) delete globalThis.__skal_store_compact;
      else globalThis.__skal_store_compact = saved.compact;
    }
  });
});


// ---------------------------------------------------------------------
// The OTHER half of the reload hazard: teardown ordering.
//
// The tests above pin handle identity across 60 generations. They say
// nothing about the flush, and cannot: because the engine is reused, a
// later generation reads the SAME in-memory keydir, so "the data is
// still there" is true whether or not anything reached the disk. That
// makes data-survival the wrong observable here, and the flush itself
// the right one.
//
// The hazard db.js:869 describes: a reload tears a generation down while
// a debounced flush is still pending (FLUSH_DEBOUNCE_MS = 60), so a write
// made within ~60 ms of a save used to fire AFTER beginReload(). The fix
// registers a cleanup that lands it synchronously instead.
//
// Driven through the real coordinator, not a stand-in — installHotCoordinator
// has no imports and manages globals only, so there is no reason to model it.
//
// Mutation-checked: deleting the addCleanup block in db.js leaves
// pending() at 1 and flushes() unmoved, and this fails on both.
// ---------------------------------------------------------------------
describe('a reload lands a pending write before tearing the generation down', () => {
  let box, savedHot;

  afterEach(() => {
    box?.cleanup(); box = null;
    if (savedHot === undefined) delete globalThis.__skalHot;
    else globalThis.__skalHot = savedHot;
  });

  test('beginReload() flushes synchronously instead of leaving a timer armed', async () => {
    savedHot = globalThis.__skalHot;
    delete globalThis.__skalHot;          // a fresh coordinator, not a leftover
    const hot = installHotCoordinator();

    box = sandbox('skal-teardown-');
    const s = await generation({ todos: [] });

    const before = s[STORE].flushes();
    s.todos.push({ _id: 1, text: 'written 1 ms before the save' });

    // The precondition the whole test rests on. If the write had already
    // been flushed there would be no pending timer to race, and this
    // would pass against any implementation.
    expect(s[STORE].pending()).toBeGreaterThan(0);
    expect(s[STORE].flushes()).toBe(before);

    // No await. The point is that teardown does not wait for the debounce.
    hot.beginReload();

    expect(s[STORE].pending(), 'a write was still staged after teardown').toBe(0);
    expect(s[STORE].flushes(), 'teardown did not flush').toBe(before + 1);
  }, 60_000);
});
