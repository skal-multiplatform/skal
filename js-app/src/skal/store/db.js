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
import { encodeValue, decodeValue } from './codec.js';
import { getAppDataDir } from '../../bridge.js';

const FLUSH_DEBOUNCE_MS = 60;
// LRU cap on memoized proxy nodes (see makeNode).
const NODE_MEMO_MAX = 8192;

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
  const dirty = new Map();          // 'k:<key>' → bytes (null ⇒ delete)
  const nextIds = new Map();        // collection storeKey → next element id
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
    if (!engine || dirty.size === 0) return;
    for (const [key, val] of dirty) {
      // `val` is encoded bytes, null (delete), or — for index frames —
      // a raw { ids, nextId } object encoded here so a burst of pushes
      // collapses to a single encode of the final index, not one per.
      if (val === null) engine.del(key);
      else engine.put(key, val instanceof Uint8Array ? val : encodeValue(val));
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
  function readSolid(sp) { return resolvePath(sp).value; }
  function setAt(sp, ...args) {
    const r = resolvePath(sp);
    if (r.path.indexOf(-1) >= 0) return;               // target no longer exists
    setState(...r.path, ...args);
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
      if (b != null) setAt(sp, decodeValue(b));
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
        encodeValue(readSolid(elInfo.solidPath)));
    } else if (_isColl(value)) {
      for (const el of value) dirty.set('k:' + sk + '.' + el._id, encodeValue(el));
      dirty.set('k:' + sk + '#x', {
        ids: value.map((e) => e._id), nextId: nextIds.get(sk) || (value.length + 1),
      });
    } else if (_isObj(value)) {
      // Recurse per leaf, skipping non-persist subtrees — staging a
      // whole object (a parent write, or a migration replacing the
      // tree) must still honour a nested `persist: false`.
      for (const k of Object.keys(value)) {
        const childSk = _join(sk, k);
        if (!policyFor(childSk).persist) continue;
        stageAt([...sp, k], childSk, null, value[k]);
      }
    } else {
      dirty.set('k:' + sk, encodeValue(value));   // primitive / array-of-primitives
    }
  }

  // Tombstone every frame `value` occupied at storeKey `sk` — used when a
  // subtree is deleted, so its leaf / element frames don't orphan.
  function tombstoneTree(sk, value) {
    if (_isColl(value)) {
      for (const el of value) {
        if (el && el._id != null) dirty.set('k:' + sk + '.' + el._id, null);
      }
      dirty.set('k:' + sk + '#x', null);
    } else if (Array.isArray(value)) {
      dirty.set('k:' + sk, null);
    } else if (_isObj(value)) {
      for (const k of Object.keys(value)) tombstoneTree(_join(sk, k), value[k]);
    } else {
      dirty.set('k:' + sk, null);
    }
  }

  function writeAt(sp, sk, elInfo, value) {
    let v = value;
    if (!elInfo && _isColl(value)) {
      v = value.map((e) => (e._id != null ? e : { ...e, _id: genId(sk) }));
    }
    const r = resolvePath(sp);
    if (r.path.indexOf(-1) >= 0) return;          // target element is gone
    setState(...r.path, v);
    const pol = policyFor(sk);
    if (!elInfo && pol.lazy) touchFaulted(sk);    // the write loaded it
    if (pol.persist) { stageAt(sp, sk, elInfo, v); scheduleFlush(); }
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
      nodeMemo.delete(sk);                 // LRU touch — re-insert as newest
      nodeMemo.set(sk, hit);
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
        const childSp = [...sp, key];
        const childSk = _join(sk, key);
        // Lazy: a leaf or collection under a lazy path faults on first
        // touch — untracked, so the load isn't itself a reactive write.
        // Skipped inside an element (elInfo) — an element loads whole,
        // so per-field faulting is meaningless and would also blow up
        // the policy cache with one entry per element id.
        if (!elInfo && !faulted.has(childSk) && policyFor(childSk).lazy) {
          const cur = readSolid(childSp);
          if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
            untrack(() => faultIn(childSp, childSk));
          }
        }
        const child = readSolid(childSp);
        if (child !== null && typeof child === 'object') {
          return makeNode(childSp, childSk, elInfo, Array.isArray(child));
        }
        return child;
      },
      set(_t, key, value) {
        if (typeof key === 'symbol') return false;
        writeAt([...sp, key], _join(sk, key), elInfo, value);
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
        const childSk = _join(sk, key);
        const old = readSolid([...sp, key]);     // capture before deletion
        setAt(sp, produce((o) => { if (o != null) delete o[key]; }));
        if (elInfo) stageAt(sp, sk, elInfo, null);          // re-stage element
        else if (policyFor(childSk).persist) tombstoneTree(childSk, old);
        dropMemo([childSk]);                       // subtree proxies are gone
        scheduleFlush();
        return true;
      },
    });
  }

  function arrayProxy(sp, sk, elInfo) {
    const arr = () => readSolid(sp) || [];

    const persist = () => {
      if (policyFor(sk).persist || elInfo) stageAt(sp, sk, elInfo, arr());
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
      setAt(sp, produce((x) => { x.splice(start, delCount, ...ins); }));
      // Tombstone removed records + drop their memoized proxies. Runs
      // unconditionally (not gated on the post-splice array still being
      // a collection) so a splice that empties or degrades the array
      // still releases the removed element frames.
      if (!elInfo) {
        const prefixes = [];
        for (const r of removed) {
          if (r && r._id != null) {
            dirty.set('k:' + sk + '.' + r._id, null);
            prefixes.push(sk + '.' + r._id);
          }
        }
        dropMemo(prefixes);
      }
      if (!elInfo && _isColl(arr())) {
        // collection: write inserted records, refresh the index —
        // untouched records stay untouched.
        for (const it of ins) {
          if (it && it._id != null) dirty.set('k:' + sk + '.' + it._id, encodeValue(it));
        }
        dirty.set('k:' + sk + '#x', {
          ids: arr().map((e) => e._id), nextId: nextIds.get(sk) || 1,
        });
        scheduleFlush();
      } else {
        persist();
      }
      return removed;
    }

    // sort / reverse only reorder — element ids are unchanged, so just
    // re-stage the index. fill / copyWithin replace slots — re-stage the
    // whole thing. (Without these, the methods fall through to
    // Array.prototype bound to the Solid array and throw on mutation.)
    function reorderBy(fn, indexOnly) {
      setAt(sp, produce(fn));
      if (indexOnly && !elInfo && _isColl(arr())) {
        dirty.set('k:' + sk + '#x', {
          ids: arr().map((e) => e._id), nextId: nextIds.get(sk) || 1,
        });
        scheduleFlush();
      } else {
        persist();
      }
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
          const i = +key;
          const el = arr()[i];
          if (el !== null && typeof el === 'object') {
            if (!elInfo && el._id != null) {
              // top-level collection element — address by stable id, so
              // the proxy survives splices that shift its index.
              const elSk = sk + '.' + el._id;
              const elSp = [...sp, { __id: el._id, hint: i }];
              return makeNode(elSp, elSk,
                { solidPath: elSp, storeKey: elSk }, false);
            }
            // in-element nested array (rides the element frame) — index.
            const childSk = sk + '.' + key;
            const idxSp = [...sp, i];
            return makeNode(idxSp, childSk,
              elInfo || { solidPath: idxSp, storeKey: childSk },
              Array.isArray(el));
          }
          return el;
        }
        // inherited read methods (map/filter/forEach/find/…): bind to
        // the live array so they iterate the real values.
        const v = arr()[key];
        return typeof v === 'function' ? v.bind(arr()) : v;
      },
      set(_t, key, value) {
        if (key === 'length') {
          setAt(sp, produce((x) => { x.length = +value; }));
          persist();
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
          if (!elInfo && _isColl(arr()) && v && v._id != null) {
            dirty.set('k:' + sk + '.' + v._id, encodeValue(v));
            scheduleFlush();
          } else {
            persist();
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
        const idx = decodeValue(idxB);
        const out = [];
        for (const id of idx.ids || []) {
          keys.push(sk + '.' + id);
          const b = engine.get('k:' + sk + '.' + id);
          if (b != null) out.push(decodeValue(b));
        }
        return out;
      }
      const whole = engine.get('k:' + sk);
      if (whole != null) { keys.push(sk); return decodeValue(whole); }
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
    if (b != null) { keys.push(sk); return decodeValue(b); }
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
        hydrate(v, childSp, childSk);             // leaves decide individually
      } else {
        if (!pol.persist || pol.lazy) continue;   // lazy leaf → faults on access
        if (dirty.has('k:' + childSk)) continue;  // app already wrote it
        const b = engine.get('k:' + childSk);
        if (b != null) setAt(childSp, decodeValue(b));
      }
    }
  }

  function hydrateArray(sp, sk) {
    if (!policyFor(sk).persist
      || dirty.has('k:' + sk + '#x') || dirty.has('k:' + sk)) return;
    const idxBytes = engine.get('k:' + sk + '#x');
    if (idxBytes != null) {                          // a persisted collection
      const idx = decodeValue(idxBytes);             // { ids, nextId }
      nextIds.set(sk, idx.nextId || 1);
      const els = [];
      for (const id of idx.ids || []) {
        const b = engine.get('k:' + sk + '.' + id);
        if (b != null) els.push(decodeValue(b));
      }
      setAt(sp, els);
      return;
    }
    const whole = engine.get('k:' + sk);             // a whole-frame array
    if (whole != null) setAt(sp, decodeValue(whole));
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
        const ns = new NativeLogStore(dataDir + '/' + cfg.name);
        ns.open();
        engine = ns;
        setBackendKind('native');
      } else {
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
      if (mb != null) { try { meta = decodeValue(mb); } catch (_) { meta = null; } }
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
          setAt([], next);                                      // replace live tree
          stageAt([], '', null, next);                          // write new layout
          migrated = true;
        }
      }
      // Record the baseline / new version (only when it changed).
      if (!meta || storedVersion !== cfg.version) {
        dirty.set('k:#meta',
          encodeValue({ version: cfg.version, shape: _clone(initState) }));
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
