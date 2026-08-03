// db.js — createSkalStore: a reactive, persistent, deep-object store.
//
//   const state = createSkalStore(initState, config?);
//
// One plain nested object in, a proxy out. Mutate the proxy directly —
// every write is reactive (SolidJS, fine-grained) AND staged to the
// log-structured engine. Reads are reactive. Persisted + eager by
// default; `config.paths` overrides behaviour per subtree:
//
//   createSkalStore(init, { paths: {
//     scratch: { persist: false },     // memory-only
//     archive: { lazy: true },         // load on first access, not at open
//   }, version: 2, migrate: (old, from) => ... });
//
// `initState` IS the schema: shape + defaults, no `kind`, no types.
//
// Reading in a loop? HOIST THE PARENT. `const c = state.cfg` outside the
// loop, then `c[k]` inside, is 1.8x faster than `state.cfg[k]` per
// iteration — the intermediate node is otherwise re-resolved on every
// read, which costs an array allocation, a string concat and a Map
// lookup before any data is touched. Only safe outside a reactive scope:
// a held parent will not see the parent itself being replaced.
// (Device medians of 3: 1.204 us vs 0.670 us per read.)
//
// Granularity:
//   • plain object        — per-leaf frames, keyed by path (`a.b.c`)
//   • array of objects    — a stable-id COLLECTION: an index frame
//     (`items#x`) + one whole-element frame per record (`items.<id>`)
//   • anything else       — one whole frame
//
// Loading:
//   • eager (default)     — hydrated at open
//   • lazy (config)       — faulted in on first access; LRU-evicted

import { createSignal, untrack } from 'solid-js';
import { LogStore, NativeLogStore, openBackend } from './engine.js';
import { getAppDataDir } from '../../bridge.js';

const FLUSH_DEBOUNCE_MS = 60;
// LRU cap on memoized proxy nodes (see makeNode). Deliberately moderate:
// a larger cap was measured to *regress* large-collection throughput
// 2-3x — it retains the whole proxy graph, so heap + GC pressure
// outweighs the higher hit rate. The trade-off: a <For> over a
// collection larger than this re-creates rows on change (such lists
// should virtualize anyway). Covers realistic non-virtualized lists.
const NODE_MEMO_MAX = 8192;

// Sentinel stored in `dirty` for a collection index frame. The actual
// { ids, nextId } is computed once at flush time from live state, not
// rebuilt on every push — see doFlush. Keeps push O(1) instead of O(n).
const INDEX_DIRTY = Symbol('skal.indexDirty');

/// A frame whose bytes are produced at FLUSH time by reading live state
/// at `sp`, instead of at mutation time.
///
/// `dirty` is a Map keyed by store key, so only the LAST staging of a
/// key ever reaches the engine — every earlier encode was thrown away.
/// For a write inside a collection element that meant re-encoding the
/// WHOLE element on every keystroke: measured at 278 600 bytes
/// serialized to persist a final 463-byte frame, 99.8% of it discarded.
///
/// INDEX_DIRTY has always worked this way for the collection index
/// ("a burst of N pushes encodes the index once at flush"). This is the
/// same trick for the element frames themselves.
///
/// Deferring the READ is only safe because a collection element's solid
/// path is id-addressed (`{__id, hint}`), not index-addressed — see the
/// `elSp` construction in arrayProxy. A splice that shifts indices
/// resolves to the same element, or to nothing; it can never resolve to
/// a DIFFERENT one. Index-based paths could not be deferred this way.
class DeferredFrame {
  constructor(sp) { this.sp = sp; }
}

// ── frame codec — JSON ──────────────────────────────────────────────
// JSC's JSON.stringify / JSON.parse are heavily-optimized native C++
// and beat any JS-implemented codec at every size: faster encode,
// faster decode, *and* more compact on disk for typical app data
// (no per-value type tag + 4-byte length prefix).
const _textEnc = new TextEncoder();
const _textDec = new TextDecoder();

function encodeFrame(value) {
  return _textEnc.encode(JSON.stringify(value));
}
function decodeFrame(bytes) {
  return JSON.parse(_textDec.decode(bytes));
}

// `state[STORE]` → a control handle (ready / flushNow / stats).
export const STORE = Symbol.for('skal.store');

const _isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Object OR array — i.e. anything that can have descendants.
const _isNode = (v) => v !== null && typeof v === 'object';
// An array is a granular collection iff every element is a plain object
// (empty counts — so `items: []` becomes a collection on first push).
const _isColl = (v) => Array.isArray(v) && v.every(_isObj);
const _isNumKey = (k) => typeof k === 'string' && /^(0|[1-9]\d*)$/.test(k);
// Dotted store key — no leading dot for a root-level child.
const _join = (sk, key) => (sk ? sk + '.' + key : key);

// High-resolution clock for the init timing log.
const _now = () => (typeof performance !== 'undefined' && performance.now
  ? performance.now() : Date.now());

function _clone(v) {
  if (Array.isArray(v)) return v.map(_clone);
  if (_isObj(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = _clone(v[k]);
    return o;
  }
  return v;
}

// Fetch the host's writable directory. The host installs it as a
// global (`__skal_data_dir`) before the bundle runs — read that
// synchronously and skip the RPC entirely. The retried RPC below is
// the fallback for hosts that don't inject it (web / older builds);
// the dispatcher may lag the first few ticks after the bundle runs.
async function fetchDataDir() {
  const injected = globalThis.__skal_data_dir;
  if (typeof injected === 'string' && injected.length) return injected;

  // No native host to ask, so do not spend five seconds asking.
  //
  // `getAppDataDir()` is an RPC: it writes an invoke op into the bridge
  // ring and waits for a host to answer. On a DOM target there is no
  // host and no drain, so every attempt times out — 5 x (800 ms + 150 ms
  // backoff) = 4.75 s before returning '' and falling back to the
  // in-memory backend it was always going to use.
  //
  // Measured before this guard: `createSkalStore(...)` on a DOM target
  // reported ready after 4774 ms. After: ~0 ms.
  // Checked at CALL time, not via bridge.js's module-eval
  // HAS_NATIVE_BRIDGE constant. A host installs this global before the
  // bundle runs in production, so the two agree there — but the
  // constant is frozen at first import, which makes it untestable once
  // any other module has already pulled bridge.js in, and would miss a
  // host that appeared later.
  if (typeof globalThis.__skal_acquireBridge !== 'function') return '';

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const d = await Promise.race([
        getAppDataDir(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getDataDir timeout')), 800)),
      ]);
      if (typeof d === 'string' && d.length) return d;
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return '';
}

export function createSkalStore(initState, config = {}) {
  const cfg = {
    name: config.name || 'store',
    paths: config.paths || null,
    residentMax: config.residentMax || 10000,
    version: config.version || 0,
    migrate: config.migrate || null,
  };

  // Pre-compute "does the config define ANY lazy / non-persist paths?"
  // The hot-path get/set traps short-circuit policy lookups entirely
  // when the answer is no — the overwhelmingly common case, since most
  // apps just use the eager+persist default. Each `policyFor` call is
  // a Map.get plus a property access; eliminated entirely here.
  let hasLazyPaths = false;
  let hasNonPersistPaths = false;
  if (cfg.paths) {
    for (const rule in cfg.paths) {
      const p = cfg.paths[rule];
      if (p && p.lazy === true) hasLazyPaths = true;
      if (p && p.persist === false) hasNonPersistPaths = true;
    }
  }

  // Resolve { persist, lazy } for a dotted path. Every matching config
  // rule applies least-specific → most-specific (children inherit).
  // Memoized — config is immutable, and this runs on every get/set.
  const policyCache = new Map();
  function policyFor(pathStr) {
    const hit = policyCache.get(pathStr);
    if (hit) return hit;
    let persist = true, lazy = false;            // defaults: persisted, eager
    if (cfg.paths) {
      const matched = [];
      for (const rule in cfg.paths) {
        if (rule === pathStr || pathStr.startsWith(rule + '.')) matched.push(rule);
      }
      matched.sort((a, b) => a.length - b.length);
      for (const rule of matched) {
        const p = cfg.paths[rule];
        if (p.persist !== undefined) persist = p.persist;
        if (p.lazy !== undefined) lazy = p.lazy;
      }
    }
    const pol = { persist, lazy };
    policyCache.set(pathStr, pol);
    return pol;
  }

  // ── reactive tree — starts at defaults; init() hydrates disk ──
  //
  // NOT solid-js/store. `root` is a plain mutable tree and the single
  // source of truth; reactivity is a side table of VERSION SIGNALS,
  // created lazily per store key on first read.
  //
  // Why: a Solid store wraps every nested object in its own proxy, so a
  // read paid a trap for Skal's layer AND one for Solid's underneath —
  // and `state.a.b.c` walked from the root, firing one Solid trap per
  // segment. Measured on device: reading a fixed literal path was 16.7x
  // slower than the same read in React Native, whose store hands back a
  // plain object and charges nothing per access.
  //
  // Here a leaf read is: one Skal trap, a cached parent object, a
  // version-signal call to subscribe, and a plain property read. One
  // proxy layer total, and nothing walks.
  //
  // The version signal carries no value — it exists purely to be
  // subscribed to and bumped. Keeping values only in `root` means there
  // is exactly one place a value lives, which is what makes writes
  // impossible to desynchronise.
  const root = _clone(initState);
  const vers = new Map();                      // storeKey -> [get, set]

  // Lazily created: only leaves that have actually been READ get one, so
  // an app that never reads a subtree never allocates for it.
  function verFor(sk) {
    let v = vers.get(sk);
    if (v === undefined) {
      v = createSignal(0, { equals: false });   // every set must notify
      vers.set(sk, v);
    }
    return v[0];
  }
  function bumpKey(sk) {
    const v = vers.get(sk);
    if (v !== undefined) v[1]((n) => n + 1);
  }
  // Bump `sk` and everything beneath it. Used for STRUCTURAL changes,
  // where a subtree is replaced wholesale and any descendant may have
  // moved or changed.
  //
  // This deliberately OVER-notifies: it wakes descendants whose values
  // did not change, where solid-js/store diffed and woke only the ones
  // that did. Over-notifying costs redundant effect runs; under-
  // notifying would serve stale UI. Structural writes are rare relative
  // to reads and leaf writes, so the trade is one-sided.
  //
  // Cost is O(number of leaves ever read), since only those have
  // signals. If that ever shows up in a profile the fix is a tree of
  // version nodes rather than a flat map — measure before building it.
  function bumpTree(sk) {
    if (sk === '') {
      for (const v of vers.values()) v[1]((n) => n + 1);
      return;
    }
    const dot = sk + '.', hash = sk + '#';
    for (const [k, v] of vers) {
      if (k === sk || k.startsWith(dot) || k.startsWith(hash)) v[1]((n) => n + 1);
    }
  }
  const [ready, setReady] = createSignal(false);
  const [backendKind, setBackendKind] = createSignal('…');
  // init() timing breakdown, set once init completes (null until then).
  const [initTiming, setInitTiming] = createSignal(null);

  // ── engine + debounced write batching ──────────────────────────────
  let engine = null;
  // 'k:<key>' → encoded bytes | null (delete) | INDEX_DIRTY (recompute).
  const dirty = new Map();
  const nextIds = new Map();        // collection storeKey → next element id
  // Memoized "is this storeKey a collection?" — splice maintains it
  // incrementally so a push burst skips the O(n) _isColl rescan. Any
  // wholesale array write deletes the entry so the next splice re-derives.
  const collCache = new Map();
  // Subtrees needing a native prefix-tombstone at flush. A wholesale
  // object/array assign at sk invalidates any prior leaf-override
  // frames under sk.* on disk — del_prefix clears them in one native
  // call, off the per-key JS loop.
  const pendingDelPrefix = new Set();
  let flushTimer = null;
  let flushCount = 0;

  function genId(sk) {
    const n = nextIds.get(sk) || 1;
    nextIds.set(sk, n + 1);
    return String(n);
  }

  function scheduleFlush() {
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => { flushTimer = null; doFlush(); },
      FLUSH_DEBOUNCE_MS);
  }
  function doFlush() {
    if (!engine || (dirty.size === 0 && pendingDelPrefix.size === 0)) return;
    // Sweep stale leaf overrides on subtrees that were wholesale-
    // reassigned (or wholesale-deleted) since the last flush. Runs
    // in native — one call per subtree, no per-key JS loop. Always
    // clear the set, even when the engine doesn't support delPrefix —
    // otherwise it would grow unbounded on every wholesale write.
    if (pendingDelPrefix.size > 0) {
      if (engine.delPrefix) {
        for (const sk of pendingDelPrefix) engine.delPrefix(sk);
      }
      pendingDelPrefix.clear();
    }
    for (const [key, val] of dirty) {
      // `val` is encoded bytes, null (delete), or INDEX_DIRTY — a
      // collection index frame whose { ids, nextId } is built from
      // live state right here, so a burst of N pushes encodes the
      // index once at flush instead of rebuilding it on every push.
      if (val === null) {
        engine.del(key);
      } else if (val instanceof DeferredFrame) {
        const live = readSolid(val.sp);
        // DEFENSIVE, and known to be so: removing an element routes
        // through tombstoneTree, which overwrites this very key with a
        // `null` tombstone, so the removed case never reaches here.
        // Deleting this guard fails no test — that was checked, not
        // assumed. It stays because encodeFrame(undefined) would write
        // the literal bytes "undefined", which the next open()'s
        // JSON.parse throws on, and the cost of the check is one
        // comparison per dirty key per flush.
        if (live !== undefined) engine.put(key, encodeFrame(live));
      } else if (val === INDEX_DIRTY) {
        const sk = key.slice(2, -2);                 // 'k:' + sk + '#x'
        const a = readSolid(sk === '' ? [] : sk.split('.'));
        if (Array.isArray(a)) {
          engine.put(key, encodeFrame({
            ids: a.map((e) => e && e._id),
            nextId: nextIds.get(sk) || (a.length + 1),
          }));
        }
      } else {
        engine.put(key, val);
      }
    }
    dirty.clear();
    engine.flush();
    flushCount++;
  }
  function flushNow() {
    if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null; }
    doFlush();
  }

  // ── solid-path resolution ───────────────────────────────────────────
  // A solid path is an array of segments. A string/number segment indexes
  // directly; an object segment {__id, hint} addresses an array element
  // by its stable `_id` — resolved to the element's CURRENT index, so an
  // element proxy stays correct after the array is spliced. `hint` caches
  // the last index for an O(1) fast path (a linear scan only on a miss).
  // Locate an element by `_id` after its cached hint went stale.
  //
  // A splice moves everything after it by a small delta — usually one —
  // so scanning OUTWARD from the old hint finds it in a step or two,
  // where a findIndex from zero walks half the array per element. With
  // every hint invalidated at once (the shape a single `shift()`
  // produces) that is most of the cost of the pass. Measured, touching
  // every element after one shift:
  //
  //     N=500    1.3 ms -> 0.5 ms
  //     N=2000   6.1 ms -> 1.6 ms
  //
  // ~3.8x, not the order of magnitude an "O(N^2) -> O(N)" framing would
  // suggest — the residue is proxy and path-resolution work this does
  // not touch. Worth having; not worth overselling.
  //
  // Falls back to a full scan, so a genuine reorder is still correct —
  // just not faster.
  function _findFromHint(arr, id, hint) {
    const n = arr.length;
    if (n === 0) return -1;
    let lo = (hint >= 0 && hint < n) ? hint : 0;
    let hi = lo;
    while (lo >= 0 || hi < n) {
      if (lo >= 0) {
        const e = arr[lo];
        if (e && e._id === id) return lo;
        lo--;
      }
      if (hi < n) {
        const e = arr[hi];
        if (e && e._id === id) return hi;
        hi++;
      }
    }
    return -1;
  }

  function resolvePath(sp) {
    const path = [];
    let cur = root;
    for (const seg of sp) {
      if (seg !== null && typeof seg === 'object') {
        let idx = -1;
        if (Array.isArray(cur)) {
          const h = seg.hint;
          if (h >= 0 && h < cur.length && cur[h] && cur[h]._id === seg.__id) {
            idx = h;                                   // fast path
          } else {
            idx = _findFromHint(cur, seg.__id, h);
            seg.hint = idx;
          }
        }
        path.push(idx);
        cur = idx < 0 ? undefined : cur[idx];
      } else {
        path.push(seg);
        cur = (cur == null) ? undefined : cur[seg];
      }
    }
    return { path, value: cur };
  }
  // resolvePath also produces `path`; readSolid callers only care about
  // `.value`, so this path-less variant skips the array + wrapper allocs.
  // Hot read paths route through here, not through resolvePath.
  function readSolid(sp) {
    let cur = root;
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') {
        let idx = -1;
        if (Array.isArray(cur)) {
          const h = seg.hint;
          if (h >= 0 && h < cur.length && cur[h] && cur[h]._id === seg.__id) {
            idx = h;
          } else {
            idx = _findFromHint(cur, seg.__id, h);
            seg.hint = idx;
          }
        }
        cur = idx < 0 ? undefined : cur[idx];
      } else {
        cur = (cur == null) ? undefined : cur[seg];
      }
      if (cur == null) return undefined;
    }
    return cur;
  }
  // Walk `sp` and then read [key] on the resolved node — without
  // allocating a child-path array. The hot get trap uses this so a
  // primitive-leaf read costs ZERO new allocations (no `[...sp, key]`
  // and no resolvePath wrapper object).
  function readSolidChildValue(sp, key) {
    let cur = root;
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') {
        let idx = -1;
        if (Array.isArray(cur)) {
          const h = seg.hint;
          if (h >= 0 && h < cur.length && cur[h] && cur[h]._id === seg.__id) {
            idx = h;
          } else {
            idx = _findFromHint(cur, seg.__id, h);
            seg.hint = idx;
          }
        }
        cur = idx < 0 ? undefined : cur[idx];
      } else {
        cur = (cur == null) ? undefined : cur[seg];
      }
      if (cur == null) return undefined;
    }
    return cur[key];
  }
  // Concrete key path for `sp` — id-addressed segments resolved to their
  // CURRENT index. Returns null when an addressed element is gone.
  function concreteOf(sp) {
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') {
        const r = resolvePath(sp);
        return r.path.indexOf(-1) >= 0 ? null : r.path;
      }
    }
    return sp;                                   // no allocation, common case
  }

  // Assign into the plain tree. `sk` is the store key of the subtree
  // being changed, used to scope the notification.
  function setAt(sp, value, sk) {
    const path = concreteOf(sp);
    if (path === null) return;                   // target element gone
    structGen++;
    if (path.length === 0) {
      for (const k of Object.keys(root)) delete root[k];
      if (value !== null && typeof value === 'object') Object.assign(root, value);
    } else {
      let cur = root;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
      }
      cur[path[path.length - 1]] = value;
    }
    bumpTree(sk === undefined ? '' : sk);
  }

  // Mutate the node AT `sp` in place. Replaces solid-js/store's
  // `produce` — with a plain tree the callback can simply operate on the
  // real object, so delete / splice / sort / length are ordinary
  // JavaScript rather than a tracked-write protocol.
  function mutateAt(sp, fn, sk) {
    const path = concreteOf(sp);
    if (path === null) return;
    let cur = root;
    for (let i = 0; i < path.length; i++) {
      if (cur == null) return;
      cur = cur[path[i]];
    }
    if (cur == null) return;
    structGen++;
    fn(cur);
    bumpTree(sk === undefined ? '' : sk);
  }

  // ── resolved-parent cache generation ────────────────────────────────
  // `readSolidChildValue` walks from the ROOT on every read, firing one
  // Solid proxy trap per path segment. So `node.display` on a node at
  // `posts.p3` costs THREE traps (posts, p3, display) even when the
  // caller already hoisted `node` — hoisting only avoids rebuilding
  // Skal's child proxy, never the Solid walk. That is why hoisting is
  // worth just 1.8x while the theoretical floor is ~25x.
  //
  // Each object proxy caches the node `sp` resolves to, so a read costs
  // ONE trap on the leaf. The cache is keyed by this counter rather than
  // invalidated per path: only STRUCTURAL changes can move a node, and
  // they are rare compared to reads.
  //
  // A primitive-leaf write does NOT bump it — Solid stores mutate in
  // place, so the parent object's identity is unchanged and the cache
  // stays valid. That matters: bumping on every write would make the
  // cache useless in any read/write mix, which is most real code.
  let structGen = 0;

  // ── lazy faulting + LRU eviction ────────────────────────────────────
  // `faulted` holds only lazy paths that have been loaded; its insertion
  // order IS the LRU order. Eager paths are never tracked here.
  const faulted = new Map();

  function defaultAt(sk) {
    let cur = initState;
    for (const seg of sk.split('.')) {
      if (cur == null) return undefined;
      cur = cur[seg];
    }
    return _clone(cur);
  }

  function touchFaulted(sk) {
    faulted.delete(sk);
    faulted.set(sk, true);                     // move to most-recently-used
    while (faulted.size > cfg.residentMax) {
      const lru = faulted.keys().next().value;
      if (lru === sk) break;
      faulted.delete(lru);
      setAt(lru.split('.'), defaultAt(lru), lru);  // drop the value → freed
    }
  }

  // Load a lazy leaf or collection from disk on its first access.
  function faultIn(sp, sk) {
    if (!engine || faulted.has(sk)) return;
    if (Array.isArray(readSolid(sp))) hydrateArray(sp, sk);
    else {
      const b = engine.get('k:' + sk);
      if (b != null) setAt(sp, decodeFrame(b), sk);
    }
    touchFaulted(sk);
  }

  // ── persistence staging ────────────────────────────────────────────
  // Stage the value at (solidPath sp, storeKey sk). `elInfo` is the
  // enclosing array element {solidPath, storeKey} or null — any write
  // inside an element re-stages that whole element frame.
  function stageAt(sp, sk, elInfo, value) {
    if (elInfo) {
      // Staged, not encoded — see DeferredFrame. A burst of writes
      // inside one element now costs one encode at flush instead of one
      // per write.
      dirty.set('k:' + elInfo.storeKey, new DeferredFrame(elInfo.solidPath));
      return;
    }
    if (_isColl(value)) {
      for (const el of value) {
        dirty.set('k:' + _join(sk, el._id), encodeFrame(el));
      }
      dirty.set('k:' + sk + '#x', INDEX_DIRTY);
      return;
    }
    if (sk === '' && _isObj(value)) {
      // Root: still recurse per top-level key, so the root isn't one
      // giant frame and embedded collections at top level keep their
      // own structure. Non-persist top-level keys are skipped.
      for (const k of Object.keys(value)) {
        const childSk = _join(sk, k);
        if (!policyFor(childSk).persist) continue;
        stageAt([...sp, k], childSk, null, value[k]);
      }
      return;
    }
    // Auto-blob: one frame at `sk` encoding the whole value, whether
    // it's a primitive or a deep object. Leaf overrides ride on top
    // (see writeAt's pendingDelPrefix on wholesale assigns).
    dirty.set('k:' + sk, encodeFrame(value));
  }

  // Tombstone every frame `value` occupied at storeKey `sk` — used when a
  // subtree is deleted, so its leaf / element frames don't orphan.
  function tombstoneTree(sk, value) {
    if (_isColl(value)) {
      for (const el of value) {
        if (el && el._id != null) dirty.set('k:' + _join(sk, el._id), null);
      }
      dirty.set('k:' + sk + '#x', null);
      return;
    }
    // For any other value: tombstone the frame at sk. If it was an
    // object/array it may have descendants (leaf override frames or a
    // collection's element frames) — del_prefix clears them natively.
    dirty.set('k:' + sk, null);
    if (sk && value !== null && typeof value === 'object') {
      pendingDelPrefix.add(sk);
    }
  }

  function writeAt(sp, sk, elInfo, value) {
    let v = value;
    if (!elInfo && _isColl(value)) {
      v = value.map((e) => (e._id != null ? e : { ...e, _id: genId(sk) }));
    }
    // Fast path: when sp contains only string/number segments (no
    // {__id, hint} element addresses), the resolved path IS sp itself —
    // no need to allocate a new path array via resolvePath. Most writes
    // hit this path. Only collection-element writes need resolvePath's
    // id-to-index translation.
    let needsResolve = false;
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') { needsResolve = true; break; }
    }
    let structural = _isNode(v);
    {
      const path = needsResolve ? concreteOf(sp) : sp;
      if (path === null) return;                   // target element gone
      if (path.length === 0) {
        structural = true;
        for (const k of Object.keys(root)) delete root[k];
        if (_isNode(v)) Object.assign(root, v);
      } else {
        let cur = root;
        for (let i = 0; i < path.length - 1; i++) {
          const k = path[i];
          if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
          cur = cur[k];
        }
        const last = path[path.length - 1];
        // See setAt: overwriting an object with a scalar is structural
        // too, and the old value costs nothing to read here.
        if (_isNode(cur[last])) structural = true;
        cur[last] = v;
      }
    }
    // THE HOT PATH. A scalar leaf write over a scalar wakes exactly its
    // own key — one Map lookup and one signal set. Only a change that
    // can move descendants pays the subtree sweep.
    if (structural) { structGen++; bumpTree(sk); } else bumpKey(sk);
    // Wholesale assignment replaces a node, so any cached resolution of
    // it or of anything beneath it is stale.
    if (v !== null && typeof v === 'object') structGen++;
    if (Array.isArray(v)) collCache.delete(sk);   // wholesale array write
    // Parallel declared-dep effects: notify any registered for this
    // exact storeKey. Wholesale assigns (v is object/array) also fire
    // descendant observers — replacing `sub` invalidates effects on
    // `sub.s5` etc. Primitive-leaf writes skip the descendant walk.
    if (sk && _skalEffectMap.size > 0) {
      _skalNotify(sk, v !== null && typeof v === 'object');
    }
    // Skip the policyFor lookup entirely when neither lazy nor non-
    // persist paths exist — the common case. Default policy is
    // {persist: true, lazy: false}, so we can assume it.
    let shouldPersist = true;
    if (hasLazyPaths || hasNonPersistPaths) {
      const pol = policyFor(sk);
      if (!elInfo && pol.lazy) touchFaulted(sk);  // the write loaded it
      shouldPersist = pol.persist;
    }
    if (shouldPersist) {
      // Wholesale object/array assign at a non-root key: clear any
      // prior leaf-override frames under sk.* on disk. The native
      // del_prefix runs in one call, so the JS thread isn't looping.
      if (!elInfo && sk && v !== null && typeof v === 'object') {
        pendingDelPrefix.add(sk);
      }
      stageAt(sp, sk, elInfo, v);
      scheduleFlush();
    }
  }

  // ── parallel reactive primitive — declared-dep effects ────────────
  // A flat alternative to Solid's createEffect, where the user declares
  // the dep paths upfront instead of discovering them via tracked reads.
  // Mount cost drops dramatically because:
  //   - We don't run the effect fn just to discover deps (no proxy reads
  //     during dep collection — the paths ARE the deps)
  //   - Each dep is registered via one Map.set per path (no Solid
  //     Computation node, no proxy trap traversal)
  //   - On rerun, the fn receives a values snapshot directly, bypassing
  //     the wrapping proxy on the read path
  //
  // Notify costs:
  //   - Exact-path notify: O(1) Map.get
  //   - Wholesale-write notify (includeDescendants): O(_skalEffectMap.size)
  //     — a flat scan checking `path.startsWith(sk + '.')`. Acceptable
  //     for typical stores (10s–100s of paths); see TODO.md for the
  //     considered-and-rejected trie alternative.
  //
  // Trade-off vs Solid effects: the dep set is static — the user must
  // know the paths upfront. For dynamic-dep effects, use Solid's
  // createEffect (which we still support).
  //
  // History: a native (Zig) backing for the dep graph was attempted
  // and removed — the per-write JS↔native crossing on `_skalNotify`
  // cost more than the JS Map operations it replaced, causing a 14×
  // regression on 1k-write propagation. See FastStorage.md Lesson 5.
  const _skalEffectMap = new Map();   // storeKey → Set<SkalEffect>
  let _skalDirty = new Set();
  let _skalFlushPending = false;

  function _skalScheduleFlush() {
    if (_skalFlushPending) return;
    _skalFlushPending = true;
    queueMicrotask(_skalFlush);
  }
  function _skalFlush() {
    _skalFlushPending = false;
    // Snapshot dirty set so reruns adding to _skalDirty don't double-fire
    // in this same tick.
    const batch = _skalDirty;
    _skalDirty = new Set();
    for (const eff of batch) {
      if (eff._disposed) continue;
      eff._dirty = false;
      // Per-effect try/catch: one effect throwing must NOT prevent the
      // rest of the batch from running. Bubbling out would also leak
      // _skalFlushPending state (already cleared above) and silently
      // drop subsequent reruns.
      try { _skalRun(eff); }
      catch (e) { console.error('[skal] effect threw:', e); }
    }
  }
  function _skalRun(eff) {
    const sps = eff._sps;
    // Reused values array — allocated once at effect creation. User
    // code MUST treat `vals` as a single-tick parameter: do not retain
    // the reference past the callback. The next rerun overwrites it in
    // place. (We rebind in-place rather than allocating per rerun so a
    // 1k-write burst doesn't garbage-collect 1k arrays.)
    const vals = eff._vals;
    for (let i = 0; i < sps.length; i++) vals[i] = readSolid(sps[i]);
    eff._fn(vals);
  }
  function _skalMarkDirtySet(set) {
    for (const eff of set) {
      if (!eff._dirty) {
        eff._dirty = true;
        _skalDirty.add(eff);
      }
    }
  }
  // Notify effects observing `sk`. With `includeDescendants`, also notify
  // effects observing any `sk.*` path — used for wholesale writes and
  // subtree deletes, where the structural change invalidates everything
  // beneath. The descendant walk is O(distinct paths) per call; gated on
  // `_skalEffectMap.size > 0` at the caller to avoid the iter cost when
  // no effects are registered.
  //
  // History: replaced with a path-segment trie in 74148b9 to make the
  // descendant walk O(depth + matched), but reverted — the trie's
  // per-effect register cost (O(depth) instead of O(1)) made the trade
  // a wash at current Skal scale (10s–100s of registered paths), where
  // the flat-scan walk was already <5 µs. Revisit when profiling shows
  // the descendant walk as a real cost. See TODO.md.
  function _skalNotify(sk, includeDescendants) {
    const set = _skalEffectMap.get(sk);
    if (set) _skalMarkDirtySet(set);
    if (includeDescendants) {
      if (sk === '') {
        // Root subtree: every registered path is a descendant.
        // Only used for root-array splice / wholesale root reassign,
        // both rare. The O(map.size) walk is acceptable.
        for (const [, descSet] of _skalEffectMap) {
          if (descSet !== set) _skalMarkDirtySet(descSet);
        }
      } else {
        const prefix = sk + '.';
        for (const [k, descSet] of _skalEffectMap) {
          if (k.startsWith(prefix)) _skalMarkDirtySet(descSet);
        }
      }
    }
    if (set || includeDescendants) _skalScheduleFlush();
  }
  // Public API (exposed as `state[STORE].createEffect(paths, fn)`):
  //   • paths: string[] of dotted storeKeys to observe (static — no
  //     conditional / dynamic deps; use Solid's createEffect for those)
  //   • fn:    (vals: any[]) => void, called once synchronously at
  //            registration and again whenever any observed path changes.
  //            ⚠️  `vals` is reused across reruns — read or destructure
  //                values out, but do NOT retain the array reference past
  //                the callback. The next rerun overwrites it in place.
  //   returns: dispose function — call to deregister + tear down.
  function createSkalEffect(paths, fn) {
    // Pre-parse paths once: storeKey string + segment array for readSolid.
    const sps = new Array(paths.length);
    for (let i = 0; i < paths.length; i++) sps[i] = paths[i].split('.');
    const eff = {
      _fn: fn, _paths: paths, _sps: sps,
      _vals: new Array(paths.length),
      _dirty: false, _disposed: false,
    };
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      let set = _skalEffectMap.get(p);
      if (!set) { set = new Set(); _skalEffectMap.set(p, set); }
      set.add(eff);
    }
    const dispose = () => {
      if (eff._disposed) return;
      eff._disposed = true;
      for (let i = 0; i < eff._paths.length; i++) {
        const set = _skalEffectMap.get(eff._paths[i]);
        if (set) {
          set.delete(eff);
          if (set.size === 0) _skalEffectMap.delete(eff._paths[i]);
        }
      }
    };
    // Initial run is synchronous. If fn throws here, we must still
    // tear down the registrations we just put in `_skalEffectMap` —
    // otherwise the effect orphans and keeps getting marked dirty
    // forever on subsequent writes, with no way to remove it.
    try { _skalRun(eff); }
    catch (e) { dispose(); throw e; }
    return dispose;
  }

  // ── control handle ─────────────────────────────────────────────────
  const ctrl = {
    ready,
    backendKind,
    initTiming,
    flushNow,
    version: () => cfg.version,
    pending: () => dirty.size,
    flushes: () => flushCount,
    resident: () => faulted.size,
    engineStats: () => (engine && engine.stats ? engine.stats() : null),
    createEffect: createSkalEffect,   // declared-dep effects
  };

  // ── the proxy ──────────────────────────────────────────────────────
  // Proxy nodes are memoized by storeKey so repeated access yields the
  // same identity. Solid <For> reconciles by reference — a fresh proxy
  // per access would re-create every row on every mutation. Bounded
  // LRU: the oldest entry is evicted once size passes NODE_MEMO_MAX.
  const nodeMemo = new Map();

  // `isArray` lets a caller that already read the value skip a second
  // resolvePath traversal (the hot get path always knows it).
  function makeNode(sp, sk, elInfo, isArray) {
    if (isArray === undefined) isArray = Array.isArray(readSolid(sp));
    const hit = nodeMemo.get(sk);
    if (hit !== undefined && hit.isArray === isArray) {
      // Insertion-order eviction WITHOUT an LRU touch — the touch
      // (Map.delete + Map.set on every hit) was measured as ~0.4 µs of
      // pure overhead per read in the hot path. With NODE_MEMO_MAX=8192
      // and typical app stores in the hundreds-to-low-thousands of
      // paths, the eviction cap almost never triggers, so strict-LRU
      // buys nothing in practice.
      return hit.node;
    }
    const node = isArray
      ? arrayProxy(sp, sk, elInfo)
      : objectProxy(sp, sk, elInfo);
    nodeMemo.set(sk, { node, isArray });
    if (nodeMemo.size > NODE_MEMO_MAX) {
      nodeMemo.delete(nodeMemo.keys().next().value);
    }
    return node;
  }

  // Drop memoized proxies for a set of storeKey prefixes (a removed
  // element and everything riding its frame), so they aren't handed
  // back stale after the underlying record is gone.
  /// Evict every memoized node at or under any of `prefixes`.
  ///
  /// The obvious loop — every memo key against every prefix — is
  /// O(memo x removed), and both grow together: clearing a collection
  /// passes one prefix PER REMOVED ELEMENT while the memo holds an
  /// entry per element that was ever touched. Measured on a bulk
  /// `splice(0, N)` with the memo warm:
  ///
  ///     N=500      18.7 ms
  ///     N=2000    231.0 ms
  ///     N=5000   1435.6 ms
  ///
  /// A second and a half to empty a list is a freeze, not a cost.
  ///
  /// Instead: put the prefixes in a Set and walk each memo key's OWN
  /// ancestor chain against it — `todos.1.title` -> `todos.1` ->
  /// `todos`. Path depth is a handful of segments and does not grow
  /// with the collection, so this is O(memo x depth).
  ///
  /// The small case keeps the original loop: building a Set costs more
  /// than a couple of startsWith calls, and single-element removal is
  /// by far the common path.
  function dropMemo(prefixes) {
    const n = prefixes.length;
    if (n === 0) return;
    if (n < 8) {
      for (const k of nodeMemo.keys()) {
        for (const p of prefixes) {
          if (k === p || k.startsWith(p + '.') || k.startsWith(p + '#')) {
            nodeMemo.delete(k);
            break;
          }
        }
      }
      return;
    }
    const victims = new Set(prefixes);
    for (const k of nodeMemo.keys()) {
      let cur = k;
      for (;;) {
        if (victims.has(cur)) { nodeMemo.delete(k); break; }
        // Trim the last path segment. Store keys use '.' between
        // object/element steps and '#' before a collection sidecar
        // (`todos#x`), so either terminates a segment.
        let cut = -1;
        for (let i = cur.length - 1; i > 0; i--) {
          const c = cur.charCodeAt(i);
          if (c === 46 /* . */ || c === 35 /* # */) { cut = i; break; }
        }
        if (cut < 0) break;
        cur = cur.slice(0, cut);
      }
    }
  }

  function objectProxy(sp, sk, elInfo) {
    let cachedNode, cachedGen = -1;
    // PER-NODE CACHES, and they are most of the win. Without them every
    // read rebuilds `sk + '.' + key` and does a global Map lookup just
    // to find the version signal — a string concat and a hash per read,
    // before any data is touched. Keyed by property name on the node
    // that serves it, so a hot leaf read costs one small Map.get.
    //
    // `verCache` is never invalidated: `verFor` is keyed by store key,
    // which does not change for a given (node, key), and the signal
    // itself must outlive structural changes because effects hold
    // subscriptions to it. `kidCache` IS invalidated, since a structural
    // change can swap an object for an array at the same path.
    // NULL-PROTOTYPE OBJECTS, not Maps. A Map.get is a hash lookup and
    // a method call; a property load on a monomorphic dictionary object
    // is an inline-cached slot read, which JSC does far better. This is
    // the innermost step of every leaf read, so the shape of this one
    // lookup is worth more than it looks.
    const verCache = { __proto__: null };
    let kidCache = null;
    return new Proxy({}, {
      get(_t, key) {
        if (key === STORE) return ctrl;
        if (typeof key === 'symbol') return undefined;
        // Lazy fault-in: only walk the policy + faulted maps when the
        // store actually has lazy paths configured. For the common case
        // (no lazy), this branch is dead — saves ~0.4 µs/read with no
        // memory cost.
        if (hasLazyPaths && !elInfo) {
          const childSk = sk ? sk + '.' + key : key;
          if (!faulted.has(childSk) && policyFor(childSk).lazy) {
            untrack(() => faultIn(sp.length === 0 ? [key] : [...sp, key],
              childSk));
          }
        }
        // Resolve `sp` once per structural generation. `readSolid` now
        // walks a plain tree, so this is ordinary property access — no
        // proxy traps, and nothing to untrack.
        let parent;
        if (cachedGen === structGen) {
          parent = cachedNode;
        } else {
          parent = readSolid(sp);
          cachedNode = parent;
          cachedGen = structGen;
          kidCache = null;                 // structure may have moved
        }

        // SUBSCRIBE. This is the only reactive step in a read: the value
        // itself comes from a plain object, so without this call nothing
        // would track. Each effect therefore depends on exactly the
        // leaves it read — never on the intermediate nodes it passed
        // through, which is what keeps a deep read from over-subscribing.
        let vg = verCache[key];
        if (vg === undefined) vg = verCache[key] = verFor(sk ? sk + '.' + key : key);
        vg();

        const child = parent == null ? undefined : parent[key];
        if (child !== null && typeof child === 'object') {
          const isArr = Array.isArray(child);
          if (kidCache === null) kidCache = { __proto__: null };
          const hit = kidCache[key];
          // The is-array check is DEFENSIVE, and known to be: any
          // structural change advances the generation, which nulls
          // kidCache above, so a cached child cannot outlive a shape
          // flip. Deleting the check fails no test — that was verified,
          // not assumed. It stays because the cost is one comparison and
          // the failure it prevents is silent: an object proxy served
          // for an array makes `.length` and index access wrong.
          if (hit !== undefined && hit.isArr === isArr) return hit.node;
          const childSp = sp.length === 0 ? [key] : [...sp, key];
          const node = makeNode(childSp, sk ? sk + '.' + key : key, elInfo, isArr);
          kidCache[key] = { node, isArr };
          return node;
        }
        return child;
      },
      set(_t, key, value) {
        if (typeof key === 'symbol') return false;
        writeAt(sp.length === 0 ? [key] : [...sp, key],
          sk ? sk + '.' + key : key, elInfo, value);
        return true;
      },
      has(_t, key) { const o = readSolid(sp); return o != null && key in o; },
      ownKeys() { const o = readSolid(sp); return o ? Reflect.ownKeys(o) : []; },
      getOwnPropertyDescriptor(_t, key) {
        const o = readSolid(sp);
        if (o != null && key in o) {
          return { enumerable: key !== '_id', configurable: true };
        }
        return undefined;
      },
      deleteProperty(_t, key) {
        if (typeof key === 'symbol') return false;
        const childSk = sk ? sk + '.' + key : key;
        const childSp = sp.length === 0 ? [key] : [...sp, key];
        const old = readSolid(childSp);            // capture before deletion
        mutateAt(sp, (o) => { delete o[key]; }, sk);
        if (elInfo) stageAt(sp, sk, elInfo, null);          // re-stage element
        else if (!hasNonPersistPaths || policyFor(childSk).persist) {
          tombstoneTree(childSk, old);
        }
        // Only sweep the proxy-node memo + collCache when the deleted
        // value was an object/array — primitives are never memoized
        // and never had a collection cache entry. The dropMemo sweep
        // is O(memo size), so this skip is the biggest win on the
        // hot "delete a primitive leaf" path.
        if (old !== null && typeof old === 'object') {
          dropMemo([childSk]);
          collCache.delete(childSk);
        }
        // Declared-dep effects: deleting a subtree always invalidates
        // descendants too (e.g. `delete s.user` should fire effects on
        // 'user.name'). Pass `true` for the prefix walk.
        if (childSk && _skalEffectMap.size > 0) _skalNotify(childSk, true);
        scheduleFlush();
        return true;
      },
    });
  }

  function arrayProxy(sp, sk, elInfo) {
    const arr = () => readSolid(sp) || [];

    const persist = () => {
      // Flag-gate the policyFor lookup: default policy is persist=true,
      // so when no non-persist paths are configured we can assume it
      // without consulting the cache. Same shape as writeAt's gate.
      if (elInfo || !hasNonPersistPaths || policyFor(sk).persist) {
        stageAt(sp, sk, elInfo, arr());
      }
      scheduleFlush();
    };

    // The one structural primitive — push/pop/shift/unshift route here.
    function splice(start, delCount, ...items) {
      const a = arr();
      const len = a.length;
      start = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      delCount = delCount === undefined
        ? len - start
        : Math.max(0, Math.min(delCount, len - start));
      const removed = a.slice(start, start + delCount);
      let ins = items;
      if (!elInfo) {
        ins = items.map((e) => (_isObj(e) && e._id == null
          ? { ...e, _id: genId(sk) } : e));
      }
      // Append (push) is the hot path: set the new indices directly so
      // it costs O(items), not an O(n) produce-splice over the whole
      // tracked array. Any other splice (mid-array, deletion) takes the
      // general produce route.
      if (delCount === 0 && start === len && ins.length > 0) {
        for (let i = 0; i < ins.length; i++) setAt([...sp, len + i], ins[i], sk);
      } else {
        mutateAt(sp, (x) => { x.splice(start, delCount, ...ins); }, sk);
      }
      // Tombstone removed records + drop their memoized proxies. Runs
      // unconditionally (not gated on the post-splice array still being
      // a collection) so a splice that empties or degrades the array
      // still releases the removed element frames.
      if (!elInfo) {
        const prefixes = [];
        for (const r of removed) {
          if (r && r._id != null) {
            const rSk = _join(sk, r._id);
            dirty.set('k:' + rSk, null);
            prefixes.push(rSk);
          }
        }
        dropMemo(prefixes);
      }
      // Is `sk` a collection? Cached + maintained incrementally so a
      // push burst skips the O(n) _isColl rescan: derive once from the
      // pre-splice array, then a non-object insert is the only thing
      // that can degrade it. Removals never change collection-ness.
      let isColl = false;
      if (!elInfo) {
        const cached = collCache.get(sk);
        isColl = cached === undefined ? _isColl(a) : cached;
        if (isColl) isColl = ins.every(_isObj);
        collCache.set(sk, isColl);
      }
      if (isColl) {
        // collection: write inserted records, mark the index dirty.
        // Untouched records stay untouched; the index frame is rebuilt
        // once at flush (doFlush), not on every push.
        for (const it of ins) {
          if (it && it._id != null) {
            dirty.set('k:' + _join(sk, it._id), encodeFrame(it));
          }
        }
        dirty.set('k:' + sk + '#x', INDEX_DIRTY);
        scheduleFlush();
      } else {
        persist();
      }
      // Declared-dep effects: a splice changes array structure; notify
      // observers on this path + descendants (element-paths beneath).
      if (_skalEffectMap.size > 0) _skalNotify(sk, true);
      return removed;
    }

    // sort / reverse only reorder — element ids are unchanged, so just
    // re-stage the index. fill / copyWithin replace slots — re-stage the
    // whole thing. (Without these, the methods fall through to
    // Array.prototype bound to the Solid array and throw on mutation.)
    function reorderBy(fn, indexOnly) {
      mutateAt(sp, fn, sk);
      const coll = collCache.get(sk);
      if (indexOnly && !elInfo && (coll === undefined ? _isColl(arr()) : coll)) {
        dirty.set('k:' + sk + '#x', INDEX_DIRTY);
        scheduleFlush();
      } else {
        persist();
      }
      // Reorder + fill + copyWithin can change values at any index;
      // notify the array path with descendants.
      if (_skalEffectMap.size > 0) _skalNotify(sk, true);
      return arr();
    }

    const mutators = {
      splice,
      push: (...items) => { splice(arr().length, 0, ...items); return arr().length; },
      unshift: (...items) => { splice(0, 0, ...items); return arr().length; },
      pop: () => splice(arr().length - 1, 1)[0],
      shift: () => splice(0, 1)[0],
      sort: (cmp) => reorderBy((x) => { x.sort(cmp); }, true),
      reverse: () => reorderBy((x) => { x.reverse(); }, true),
      fill: (v, s, e) => reorderBy((x) => { x.fill(v, s, e); }, false),
      copyWithin: (t, s, e) => reorderBy((x) => { x.copyWithin(t, s, e); }, false),
    };

    return new Proxy([], {
      get(_t, key) {
        if (key === STORE) return ctrl;
        // Subscribe to the array itself for length and element reads.
        // Splices, reorders and truncations all bump this key, so a
        // consumer iterating the array re-runs when its shape changes.
        if (key === 'length') { verFor(sk)(); return arr().length; }
        if (typeof key === 'string' && Object.hasOwn(mutators, key)) {
          return mutators[key];
        }
        if (_isNumKey(key)) verFor(sk)();
        if (_isNumKey(key)) {
          // Keep using `arr()[i]` here: making arrayProxy also call
          // `readSolidChildValue` made the function polymorphic across
          // its callers and measurably regressed objectProxy reads
          // (the function couldn't be inlined as aggressively). The
          // arrayProxy hot path is rarely a bottleneck — arrays are
          // iterated via <For>, not read in tight loops.
          const a = arr();
          const i = +key;
          const el = a[i];
          if (el !== null && typeof el === 'object') {
            // Is the array as a whole actually a collection (every
            // element an object with `_id`)? For MIXED arrays — some
            // elements with `_id`, some primitives — el._id might be
            // non-null on this element, but the array still persists
            // as one whole-array frame at sk, NOT as a collection
            // with per-element frames. Routing to per-element
            // addressing in that case would write a phantom frame
            // the rehydrate-from-whole-array would silently drop.
            let arrIsColl = false;
            if (!elInfo) {
              const cached = collCache.get(sk);
              if (cached === undefined) {
                arrIsColl = _isColl(arr());
                collCache.set(sk, arrIsColl);   // amortize the O(n) rescan
              } else {
                arrIsColl = cached;
              }
            }
            if (arrIsColl && el._id != null) {
              // top-level collection element — address by stable id, so
              // the proxy survives splices that shift its index.
              const elSk = _join(sk, el._id);
              const elSp = [...sp, { __id: el._id, hint: i }];
              return makeNode(elSp, elSk,
                { solidPath: elSp, storeKey: elSk }, false);
            }
            const childSk = _join(sk, key);
            const idxSp = [...sp, i];
            if (elInfo) {
              // Nested array (or non-collection array) inside an existing
              // element — writes ride that element's frame.
              return makeNode(idxSp, childSk, elInfo, Array.isArray(el));
            }
            // Non-collection array of objects (mixed-type arrays, or
            // objects placed via raw produce that lack _id, or a mixed
            // array where SOME elements have `_id`). The array is
            // persisted as one whole-array frame at sk; writes inside
            // an element MUST re-stage that whole-array frame — not a
            // phantom `items.0` (or `items.<id>`) frame, which the
            // persisted `items` blob would overwrite on rehydrate. So
            // the synthetic elInfo points at the PARENT array (sp/sk),
            // not at the element. Cost: O(array size) per write inside
            // the element. Correctness over perf for the degenerate
            // case. Note: mixed arrays don't auto-promote to
            // collection — once classified non-collection, stays so
            // until a wholesale `state.items = [...]` reassign
            // invalidates collCache.
            return makeNode(idxSp, childSk,
              { solidPath: sp, storeKey: sk }, Array.isArray(el));
          }
          return el;
        }
        // inherited read methods (map/filter/forEach/find/…): bind to
        // the live array so they iterate the real values. Hoist arr()
        // to a single call so .bind doesn't trigger a second readSolid.
        const a = arr();
        const v = a[key];
        return typeof v === 'function' ? v.bind(a) : v;
      },
      set(_t, key, value) {
        if (key === 'length') {
          const newLen = +value;
          // If truncating a collection, capture the elements about to be
          // dropped so their per-element frames get tombstoned (and the
          // memoized proxies dropped). Without this the element frames
          // at `items.<id>` orphan on disk — the new index frame won't
          // reference them, but the keydir entries linger until
          // compaction. Same treatment splice gives its `removed` list.
          let removed = null;
          if (!elInfo && newLen < arr().length) {
            const cached = collCache.get(sk);
            const wasColl = cached === undefined ? _isColl(arr()) : cached;
            if (wasColl) removed = arr().slice(newLen);
          }
          mutateAt(sp, (x) => { x.length = newLen; }, sk);
          collCache.delete(sk);            // truncate/extend may degrade it
          if (removed) {
            const prefixes = [];
            for (const r of removed) {
              if (r && r._id != null) {
                const rSk = _join(sk, r._id);
                dirty.set('k:' + rSk, null);
                prefixes.push(rSk);
              }
            }
            dropMemo(prefixes);
          }
          persist();
          // Truncate/extend can change values at any index — notify with
          // descendants so element-path observers see the change.
          if (_skalEffectMap.size > 0) _skalNotify(sk, true);
          return true;
        }
        if (_isNumKey(key)) {
          const i = +key;
          const old = arr()[i];
          let v = value;
          if (!elInfo && _isObj(value) && value._id == null) {
            v = { ...value, _id: (old && old._id != null) ? old._id : genId(sk) };
          }
          setAt([...sp, i], v, sk);
          // Cached collection-ness, maintained incrementally — same
          // shape as splice's collCache update: derive once if cold,
          // then on a single index-assign the array can only DEGRADE
          // (was-coll AND new value is an object → still coll; was-
          // coll AND new value is non-object → degrades). Promotion
          // (non-coll → coll via one slot upgrade) isn't detected
          // here, but wholesale-array writes / length changes
          // invalidate the cache, so the next access re-derives.
          // Avoids an O(n) _isColl rescan on every index assign.
          let coll = false;
          if (!elInfo) {
            const cached = collCache.get(sk);
            coll = cached === undefined ? _isColl(arr()) : cached;
            if (coll && !_isObj(v)) coll = false;
            collCache.set(sk, coll);
          }
          if (coll && v && v._id != null) {
            dirty.set('k:' + _join(sk, v._id), encodeFrame(v));
            scheduleFlush();
          } else {
            persist();
          }
          // Notify on the specific index and the element-id path (if it
          // is a collection). Descendants under v are included when v
          // is an object (e.g. setting `items[3] = newObj` should fire
          // observers on `items.3.foo` if any). If a prior element at
          // this index had a DIFFERENT `_id` (or v isn't a collection
          // element at all anymore), observers on `items.<oldId>` see
          // the value vanish or change identity — fire them too with
          // descendants so they rerun and read the new shape.
          if (_skalEffectMap.size > 0) {
            const isObj = v !== null && typeof v === 'object';
            _skalNotify(_join(sk, key), isObj);
            const newId = (v && v._id != null) ? v._id : null;
            if (coll && newId != null) _skalNotify(_join(sk, newId), isObj);
            const oldId = (old && old._id != null) ? old._id : null;
            if (oldId != null && oldId !== newId) {
              _skalNotify(_join(sk, oldId), true);
            }
          }
          return true;
        }
        return false;
      },
      has(_t, key) {
        if (key === 'length') return true;
        if (typeof key === 'string' && Object.hasOwn(mutators, key)) return true;
        return key in arr();
      },
      ownKeys() { return Reflect.ownKeys(arr()); },
      getOwnPropertyDescriptor(_t, key) {
        const a = arr();
        if (key === 'length') {
          return { value: a.length, writable: true, enumerable: false, configurable: false };
        }
        if (_isNumKey(key) && +key < a.length) {
          return { enumerable: true, configurable: true };
        }
        return undefined;
      },
    });
  }

  // ── migration support ─────────────────────────────────────────────
  // Rebuild the persisted state under `sk` as a plain object, driven by
  // `shape` (the OLD initState skeleton recorded in #meta). Reading it by
  // the OLD shape is what catches renamed-away fields. Keys touched go
  // into `keys` so the old layout can be tombstoned afterwards.
  function reconstruct(shape, sk, keys) {
    if (Array.isArray(shape)) {
      const idxB = engine.get('k:' + sk + '#x');
      if (idxB != null) {
        keys.push(sk + '#x');
        const idx = decodeFrame(idxB);
        const out = [];
        for (const id of idx.ids || []) {
          const eSk = _join(sk, id);
          keys.push(eSk);
          const b = engine.get('k:' + eSk);
          if (b != null) out.push(decodeFrame(b));
        }
        return out;
      }
      const whole = engine.get('k:' + sk);
      if (whole != null) { keys.push(sk); return decodeFrame(whole); }
      return _clone(shape);
    }
    if (_isObj(shape)) {
      const out = {};
      for (const k of Object.keys(shape)) {
        out[k] = reconstruct(shape[k], _join(sk, k), keys);
      }
      return out;
    }
    const b = engine.get('k:' + sk);
    if (b != null) { keys.push(sk); return decodeFrame(b); }
    return shape;                                    // the old default
  }

  // Give every collection element a stable id — a migrate fn returns
  // plain objects, so freshly-shaped collections need them. Elements
  // that kept an id (migrate passed them through) seed `nextIds` past
  // the highest, so a later push can't reissue a live id.
  function ensureIds(value, sk) {
    if (_isColl(value)) {
      let max = 0;
      for (const el of value) {
        const n = el._id == null ? 0 : +el._id;
        if (n > max) max = n;
      }
      if (max + 1 > (nextIds.get(sk) || 1)) nextIds.set(sk, max + 1);
      for (const el of value) if (el._id == null) el._id = genId(sk);
    } else if (_isObj(value)) {
      for (const k of Object.keys(value)) ensureIds(value[k], _join(sk, k));
    }
  }

  // ── init — open the engine, migrate, hydrate ───────────────────────
  // Write one hydrated value. When the live parent is known — which is
  // every case except a shape divergence — this is a single property
  // assignment. Routing through setAt instead re-resolves the whole path
  // FROM THE ROOT for every record, which is O(depth) of redundant
  // walking plus a childSp array allocation per leaf.
  //
  // Notification still happens. It would be tempting to skip it during
  // hydration on the grounds that nothing has subscribed yet, but that
  // is not guaranteed: createSkalStore returns the proxy immediately and
  // init() runs async, so a component can read — and subscribe — before
  // hydration finishes.
  function writeHydrated(live, sp, k, sk, decoded) {
    if (live !== null && typeof live === 'object') {
      const old = live[k];
      live[k] = decoded;
      if (_isNode(decoded) || _isNode(old)) { structGen++; bumpTree(sk); }
      else bumpKey(sk);
      return;
    }
    setAt([...sp, k], decoded, sk);          // shapes diverged — walk it
  }
  const _liveChild = (live, k) =>
    (live !== null && typeof live === 'object') ? live[k] : undefined;

  function hydrate(node, sp, sk, live) {
    for (const k of Object.keys(node)) {
      const v = node[k];
      const childSk = _join(sk, k);
      const pol = policyFor(childSk);
      if (Array.isArray(v)) {
        if (pol.persist && !pol.lazy) hydrateArray([...sp, k], childSk);
        continue;
      }
      const dk = 'k:' + childSk;             // built ONCE, not per lookup
      if (_isObj(v)) {
        // Auto-blob: a wholesale assign at this path is stored as one
        // frame here; load it first, then recurse to overlay any
        // deeper-stored leaf overrides on top.
        //
        // Shape divergence: the persisted value may not be an object
        // anymore (e.g. a later `state.user = "alice"` or
        // `state.user = null` overwrote an object with a primitive).
        // Detect that and skip the recursion — descending into a non-
        // object parent would try to write child paths against it, which
        // fails. Any leaf-override frames under childSk.* are orphans
        // from the previous shape; schedule a native prefix-tombstone so
        // they don't haunt the next run.
        let recurse = true;
        if (pol.persist && !pol.lazy && !dirty.has(dk)) {
          const b = engine.get(dk);
          if (b != null) {
            const decoded = decodeFrame(b);
            writeHydrated(live, sp, k, childSk, decoded);
            if (!_isObj(decoded)) {
              recurse = false;
              if (engine.delPrefix) pendingDelPrefix.add(childSk);
            }
          }
        }
        if (recurse) hydrate(v, [...sp, k], childSk, _liveChild(live, k));
      } else {
        if (!pol.persist || pol.lazy) continue;   // lazy leaf → faults on access
        if (dirty.has(dk)) continue;              // app already wrote it
        const b = engine.get(dk);
        if (b != null) {
          const decoded = decodeFrame(b);
          writeHydrated(live, sp, k, childSk, decoded);
          // Symmetric to the object branch above: persisted shape may
          // have upgraded (e.g. initState declared `config: ""` and the
          // app later did `state.config = {complex: 'obj'}`, then
          // `state.config.complex = 'new'` writing a deeper leaf
          // override at `k:config.complex`). Recurse on the loaded shape
          // so any deeper overrides under it get overlaid.
          if (_isObj(decoded)) {
            hydrate(decoded, [...sp, k], childSk, _liveChild(live, k));
          }
        }
      }
    }
  }

  function hydrateArray(sp, sk) {
    if (!policyFor(sk).persist
      || dirty.has('k:' + sk + '#x') || dirty.has('k:' + sk)) return;
    collCache.delete(sk);                  // array replaced — re-derive later
    const idxBytes = engine.get('k:' + sk + '#x');
    if (idxBytes != null) {                          // a persisted collection
      const idx = decodeFrame(idxBytes);             // { ids, nextId }
      nextIds.set(sk, idx.nextId || 1);
      const els = [];
      for (const id of idx.ids || []) {
        const b = engine.get('k:' + _join(sk, id));
        if (b != null) els.push(decodeFrame(b));
      }
      setAt(sp, els, sk);
      return;
    }
    const whole = engine.get('k:' + sk);             // a whole-frame array
    if (whole != null) { setAt(sp, decodeFrame(whole), sk); return; }

    // Nothing persisted for this array at all: it exists only because
    // `initState` declared it. Stage it now, at first open.
    //
    // Not an optimisation — a correctness hole. Initial state is
    // otherwise never written (it lives in the app's code, so a scalar
    // that is never changed hydrates to the same value either way). For
    // a COLLECTION that reasoning breaks: editing one element stages
    // that element's frame, but the index `#x` is only staged when
    // membership changes, so the store ends up holding element bytes
    // with no id list to reach them by. `hydrateArray` needs the index
    // to rebuild the array, finds none, and leaves the live array at its
    // initState value — the edit is silently gone after a restart, and
    // its frame is orphaned on disk forever.
    //
    // Seeding here writes the elements AND the index together, so the
    // very first open leaves the collection fully addressable. Runs once
    // per collection ever: the next open takes the `idxBytes` path
    // above.
    const live = readSolid(sp);
    if (Array.isArray(live) && live.length > 0 && _isColl(live)) {
      stageAt(sp, sk, null, live);
    }
  }

  async function init() {
    // Timing breakdown — all of init() runs async, off the first-paint
    // path, but the engine-open + hydrate work still costs JS-thread
    // time shortly after launch. Logged so it can be measured.
    const t0 = _now();
    let tDir = t0, tOpen = t0, tMig = t0;
    try {
      const dataDir = await fetchDataDir();
      tDir = _now();
      if (typeof globalThis.__skal_store_open === 'function' && dataDir) {
        // Native open can fail (disk full, sandbox denied us write, the
        // dir path is bogus). Don't let that pin us to memory-only —
        // fall through to the JS LogStore so we still get real
        // persistence (memory-only is a LAST resort, not the first
        // non-native fallback).
        try {
          const ns = new NativeLogStore(dataDir + '/' + cfg.name);
          ns.open();
          engine = ns;
          setBackendKind('native');
        } catch (_) {
          engine = null;
        }
      }
      if (!engine) {
        // Namespace by store name, exactly as the native path above
        // does. Without this every store in a process shared ONE
        // segment directory: a second `createSkalStore` hydrated the
        // first one's data over its own initState, and their writes
        // interleaved into the same keyspace.
        //
        // `name` is not decorative — docs/BENCHMARKS.md builds two
        // stores in one run (`RUN + '-warm'`, `RUN + '-frame'`) and
        // relies on it for isolation, which held on native and silently
        // did not here.
        const backend = await openBackend(dataDir + '/' + cfg.name);
        const ls = new LogStore(backend);
        ls.open();
        engine = ls;
        setBackendKind(backend.kind);
      }

      tOpen = _now();

      // ── version / migration ──────────────────────────────────────
      let meta = null;
      const mb = engine.get('k:#meta');
      if (mb != null) { try { meta = decodeFrame(mb); } catch (_) { meta = null; } }
      const storedVersion = meta ? (meta.version | 0) : 0;
      let migrated = false;

      if (meta && meta.shape && cfg.migrate && storedVersion < cfg.version) {
        // Reconstruct the old-shaped state, run the dev's migrate, then
        // replace the persisted layout with the result.
        const oldKeys = [];
        const oldState = reconstruct(meta.shape, '', oldKeys);
        let next = null;
        try { next = cfg.migrate(oldState, storedVersion); } catch (_) { next = null; }
        if (_isObj(next)) {
          for (const k of oldKeys) dirty.set('k:' + k, null);  // tombstone old layout
          ensureIds(next, '');
          collCache.clear();                                    // tree replaced
          setAt([], next, '');                                  // replace live tree
          stageAt([], '', null, next);                          // write new layout
          migrated = true;
        }
      }
      // Record the baseline / new version (only when it changed).
      if (!meta || storedVersion !== cfg.version) {
        dirty.set('k:#meta',
          encodeFrame({ version: cfg.version, shape: _clone(initState) }));
      }

      tMig = _now();
      if (!migrated) hydrate(initState, [], '', root);
      scheduleFlush();
    } catch (_) {
      // The store still works in-memory; the failure is non-fatal.
    }
    const tEnd = _now();
    const s = engine && engine.stats ? engine.stats() : null;
    const r1 = (x) => Math.round(x * 10) / 10;
    setInitTiming({
      total: r1(tEnd - t0),
      dir: r1(tDir - t0),         // waiting on the host data-dir RPC
      open: r1(tOpen - tDir),     // engine open
      migrate: r1(tMig - tOpen),  // version migration (0 if none)
      hydrate: r1(tEnd - tMig),   // eager hydrate from disk
      records: s ? s.records : 0,
    });
    setReady(true);
  }
  init();

  return makeNode([], '', null, Array.isArray(initState));
}
