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
import { createStore as createSolidStore, produce } from 'solid-js/store';
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
  const [state, setState] = createSolidStore(_clone(initState));
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
    // in native — one call per subtree, no per-key JS loop.
    if (pendingDelPrefix.size > 0 && engine.delPrefix) {
      for (const sk of pendingDelPrefix) engine.delPrefix(sk);
      pendingDelPrefix.clear();
    }
    for (const [key, val] of dirty) {
      // `val` is encoded bytes, null (delete), or INDEX_DIRTY — a
      // collection index frame whose { ids, nextId } is built from
      // live state right here, so a burst of N pushes encodes the
      // index once at flush instead of rebuilding it on every push.
      if (val === null) {
        engine.del(key);
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
  function resolvePath(sp) {
    const path = [];
    let cur = state;
    for (const seg of sp) {
      if (seg !== null && typeof seg === 'object') {
        let idx = -1;
        if (Array.isArray(cur)) {
          const h = seg.hint;
          if (h >= 0 && h < cur.length && cur[h] && cur[h]._id === seg.__id) {
            idx = h;                                   // fast path
          } else {
            idx = cur.findIndex((e) => e && e._id === seg.__id);
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
    let cur = state;
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') {
        let idx = -1;
        if (Array.isArray(cur)) {
          const h = seg.hint;
          if (h >= 0 && h < cur.length && cur[h] && cur[h]._id === seg.__id) {
            idx = h;
          } else {
            idx = cur.findIndex((e) => e && e._id === seg.__id);
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
    let cur = state;
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') {
        let idx = -1;
        if (Array.isArray(cur)) {
          const h = seg.hint;
          if (h >= 0 && h < cur.length && cur[h] && cur[h]._id === seg.__id) {
            idx = h;
          } else {
            idx = cur.findIndex((e) => e && e._id === seg.__id);
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
  function setAt(sp, ...args) {
    // Fast path: skip resolvePath's array allocation when sp has no
    // object (id-addressed) segments. Hot deletes / produce-mutations
    // route through here.
    for (let i = 0; i < sp.length; i++) {
      const seg = sp[i];
      if (seg !== null && typeof seg === 'object') {
        const r = resolvePath(sp);
        if (r.path.indexOf(-1) >= 0) return;          // target gone
        setState(...r.path, ...args);
        return;
      }
    }
    setState(...sp, ...args);
  }

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
      setAt(lru.split('.'), defaultAt(lru));   // drop the value → freed
    }
  }

  // Load a lazy leaf or collection from disk on its first access.
  function faultIn(sp, sk) {
    if (!engine || faulted.has(sk)) return;
    if (Array.isArray(readSolid(sp))) hydrateArray(sp, sk);
    else {
      const b = engine.get('k:' + sk);
      if (b != null) setAt(sp, decodeFrame(b));
    }
    touchFaulted(sk);
  }

  // ── persistence staging ────────────────────────────────────────────
  // Stage the value at (solidPath sp, storeKey sk). `elInfo` is the
  // enclosing array element {solidPath, storeKey} or null — any write
  // inside an element re-stages that whole element frame.
  function stageAt(sp, sk, elInfo, value) {
    if (elInfo) {
      dirty.set('k:' + elInfo.storeKey,
        encodeFrame(readSolid(elInfo.solidPath)));
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
    if (needsResolve) {
      const r = resolvePath(sp);
      if (r.path.indexOf(-1) >= 0) return;         // target element gone
      setState(...r.path, v);
    } else {
      setState(...sp, v);
    }
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
  //   - Each dep is registered via one Map.set, not a proxy trap +
  //     Solid signal traversal + Computation node allocation
  //   - On rerun, the fn receives a values snapshot directly, bypassing
  //     the wrapping proxy on the read path
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
  function dropMemo(prefixes) {
    if (!prefixes.length) return;
    for (const k of nodeMemo.keys()) {
      for (const p of prefixes) {
        if (k === p || k.startsWith(p + '.') || k.startsWith(p + '#')) {
          nodeMemo.delete(k);
          break;
        }
      }
    }
  }

  function objectProxy(sp, sk, elInfo) {
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
        // Walk sp + read [key] in one pass — no childSp array alloc on
        // the primitive-leaf hot path. childSp / childSk are computed
        // lazily below ONLY when the result is an object (needed for
        // makeNode). Saves ~0.5 µs/read for primitive leaves.
        const child = readSolidChildValue(sp, key);
        if (child !== null && typeof child === 'object') {
          const childSp = sp.length === 0 ? [key] : [...sp, key];
          return makeNode(childSp, sk ? sk + '.' + key : key, elInfo,
            Array.isArray(child));
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
        setAt(sp, produce((o) => { if (o != null) delete o[key]; }));
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
        for (let i = 0; i < ins.length; i++) setAt([...sp, len + i], ins[i]);
      } else {
        setAt(sp, produce((x) => { x.splice(start, delCount, ...ins); }));
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
      setAt(sp, produce(fn));
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
        if (key === 'length') return arr().length;
        if (typeof key === 'string' && Object.hasOwn(mutators, key)) {
          return mutators[key];
        }
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
            if (!elInfo && el._id != null) {
              // top-level collection element — address by stable id, so
              // the proxy survives splices that shift its index.
              const elSk = _join(sk, el._id);
              const elSp = [...sp, { __id: el._id, hint: i }];
              return makeNode(elSp, elSk,
                { solidPath: elSp, storeKey: elSk }, false);
            }
            // in-element nested array (rides the element frame) — index.
            const childSk = _join(sk, key);
            const idxSp = [...sp, i];
            return makeNode(idxSp, childSk,
              elInfo || { solidPath: idxSp, storeKey: childSk },
              Array.isArray(el));
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
          setAt(sp, produce((x) => { x.length = +value; }));
          collCache.delete(sk);            // truncate/extend may degrade it
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
          setAt(sp, i, v);
          const coll = !elInfo && _isColl(arr());
          if (!elInfo) collCache.set(sk, coll);     // refresh the cache
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
  function hydrate(node, sp, sk) {
    for (const k of Object.keys(node)) {
      const v = node[k];
      const childSp = [...sp, k];
      const childSk = _join(sk, k);
      const pol = policyFor(childSk);
      if (Array.isArray(v)) {
        if (pol.persist && !pol.lazy) hydrateArray(childSp, childSk);
      } else if (_isObj(v)) {
        // Auto-blob: a wholesale assign at this path is stored as one
        // frame here; load it first, then recurse to overlay any
        // deeper-stored leaf overrides on top.
        //
        // Shape divergence: the persisted value may not be an object
        // anymore (e.g. a later `state.user = "alice"` or
        // `state.user = null` overwrote an object with a primitive).
        // Detect that and skip the recursion — descending into a non-
        // object parent would try to write child paths against it via
        // setState('user', 'name', …), which fails. Any leaf-override
        // frames under childSk.* are orphans from the previous shape;
        // schedule a native prefix-tombstone so they don't haunt the
        // next run.
        let recurse = true;
        if (pol.persist && !pol.lazy && !dirty.has('k:' + childSk)) {
          const b = engine.get('k:' + childSk);
          if (b != null) {
            const decoded = decodeFrame(b);
            setAt(childSp, decoded);
            if (!_isObj(decoded)) {
              recurse = false;
              if (engine.delPrefix) pendingDelPrefix.add(childSk);
            }
          }
        }
        if (recurse) hydrate(v, childSp, childSk);
      } else {
        if (!pol.persist || pol.lazy) continue;   // lazy leaf → faults on access
        if (dirty.has('k:' + childSk)) continue;  // app already wrote it
        const b = engine.get('k:' + childSk);
        if (b != null) setAt(childSp, decodeFrame(b));
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
      setAt(sp, els);
      return;
    }
    const whole = engine.get('k:' + sk);             // a whole-frame array
    if (whole != null) setAt(sp, decodeFrame(whole));
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
        const backend = await openBackend(dataDir);
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
          setAt([], next);                                      // replace live tree
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
      if (!migrated) hydrate(initState, [], '');
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
