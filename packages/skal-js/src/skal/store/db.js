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
// Reading in a loop? Hoisting the parent (`const c = state.cfg` outside
// the loop, `c[k]` inside) still helps, but far less than it used to:
// each proxy node caches the object its path resolves to, so a read
// costs one trap on the leaf rather than one per path segment. Device
// medians: full literal path 0.0294 ms/100 vs 0.0087 hoisted.
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

import { createSignal, untrack, batch } from 'solid-js';
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
// TWO QUESTIONS, NOT ONE. Treating them as the same predicate cost
// data twice, in two different call sites, two review rounds apart.
//
//   _isColl    — "are all the elements objects?" Decides ADDRESSING:
//                whether a child is reached by stable id (`items.<id>`)
//                or by index (`items.0`).
//   _isIdColl  — "is this a DENSE array of objects that ALL carry an
//                `_id`?" Decides the ON-DISK FORMAT: per-element frames
//                plus an `#x` index, or one whole-array frame.
//
// They agree until an array is all-objects WITHOUT ids — which happens
// whenever a whole-array frame comes back off disk, or a splice removes
// the primitive that made a mixed array mixed. Every site that used the
// first to answer the second wrote an index of `ids: [undefined]` and
// lost the array on reopen.
//
// `_isColl` uses `every`, which SKIPS holes; `_isIdColl` walks by index,
// which sees them (`value[i]` on a hole is `undefined`). A sparse array
// is not something the per-element format can address.
const _isColl = (v) => Array.isArray(v) && v.every(_isObj);
const _isIdColl = (v) => {
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < v.length; i++) {
    const el = v[i];
    if (!_isObj(el) || el._id == null) return false;
  }
  return true;
};
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
  // The configured `persist: false` rules, kept as a list so a stage can
  // ask "is one of these BENEATH me?" without walking the value.
  const nonPersistRules = [];
  if (cfg.paths) {
    for (const rule in cfg.paths) {
      const p = cfg.paths[rule];
      if (p && p.lazy === true) hasLazyPaths = true;
      if (p && p.persist === false) { hasNonPersistPaths = true; nonPersistRules.push(rule); }
    }
  }
  // Every store key that has a `persist: false` path strictly beneath
  // it, precomputed from the rules. `a.secret` contributes `a`.
  //
  // This is asked on the object-assign path, so it has to be free.
  // Recursing per key whenever the store had ANY non-persist rule was
  // correct and cost 5.5x on every object assign — it turned one blob
  // frame into one frame per key for subtrees with nothing sensitive
  // under them. Scanning the rule list instead was still +47%, because
  // `sk + '.'` allocates a string per call on a path that runs per
  // write. A prepopulated Set is one hash lookup and no allocation.
  const nonPersistAncestors = new Set();
  for (const rule of nonPersistRules) {
    for (let i = rule.indexOf('.'); i >= 0; i = rule.indexOf('.', i + 1)) {
      nonPersistAncestors.add(rule.slice(0, i));
    }
  }
  const nonPersistUnder = (sk) => nonPersistAncestors.has(sk);

  // Resolve { persist, lazy } for a dotted path. Every matching config
  // rule applies least-specific → most-specific (children inherit).
  // Memoized — config is immutable, and this runs on every get/set.
  const policyCache = new Map();
  // Frozen and shared: the gated hot paths hand this back instead of
  // allocating a fresh {persist, lazy} per key.
  const DEFAULT_POLICY = Object.freeze({ persist: true, lazy: false });
  // The two gates this file repeats. Eleven copy-pasted sites, and
  // "a fix reached one call site and not its siblings" is the shape of
  // four of this store's shipped bugs — including one where six of the
  // eight copies were added in a single review round.
  const persists = (k) => !hasNonPersistPaths || policyFor(k).persist;
  const policyOf = (k) =>
    (hasLazyPaths || hasNonPersistPaths) ? policyFor(k) : DEFAULT_POLICY;

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
  // Notify a REPLACED node: the node itself, then only the descendants
  // whose values actually differ.
  //
  // Replaces a blanket `bumpTree` on wholesale assignment. solid-js/store
  // diffed here and woke only what changed; sweeping every version signal
  // instead was a regression — it re-runs effects on leaves that are
  // identical before and after.
  //
  // Reference equality prunes whole subtrees: an untouched child object
  // is `===` on both sides, so recursion stops there. That makes this
  // O(what changed) rather than O(every leaf ever read), which is what
  // the sweep cost.
  function bumpReplaced(sk, oldV, newV) {
    if (oldV === newV) return;
    // Nothing has ever been read, so nothing can be listening. Without
    // this, hydrating a 5000-element collection allocated a Set and a
    // joined string per node to notify an empty map — on the cold-start
    // path, which is the one this is meant to be cheap on.
    if (vers.size === 0) return;
    const o = _isNode(oldV) ? oldV : null;
    const n = _isNode(newV) ? newV : null;
    if (!o && !n) { bumpKey(sk); return; }     // a scalar leaf changed

    // BUMP THE NODE ITSELF ONLY ON A SHAPE CHANGE.
    //
    // The get trap subscribes to every key it touches BEFORE it knows
    // whether that key is a leaf or a node, so reading `s.user.name`
    // subscribes to `user` as well as `user.name`. Bumping `user` on
    // every replacement therefore woke everything that merely traversed
    // it, and the diff below could not help — measured on device: an
    // effect on `user.name` re-ran when only `user.age` had changed.
    //
    // Same keys means nothing a traverser read has moved; the per-leaf
    // bumps below carry the actual news. A holder that read the node and
    // nothing else is correctly left alone — the node proxy is memoized
    // by store key, so its reference stays valid and later reads resolve
    // against the current tree.
    // node <-> scalar is always a shape change, and only one side has
    // keys to walk. Guarding this with `!o && !n` alone crashed on
    // Object.keys(null) — the mixed case has to be handled explicitly.
    // ARRAYS SUBSCRIBE BY `sk#i` / `sk#len` / `sk#all`, never by dotted
    // child keys — so recursing with `_join(sk, '0')` notified nobody and
    // a wholesale `state.items = [...]` was invisible to index readers.
    if (Array.isArray(oldV) || Array.isArray(newV)) {
      const oa = Array.isArray(oldV) ? oldV : null;
      const na = Array.isArray(newV) ? newV : null;
      const ol = oa ? oa.length : 0;
      const nl = na ? na.length : 0;
      bumpKey(sk);                              // the node itself changed
      bumpArray(sk, 0, Math.max(ol, nl));
      // ...but index readers are not the only subscribers. A COLLECTION
      // element hands out a proxy addressed by stable id, so its leaves
      // are interned as `items.<id>.<field>` — real dotted keys that the
      // index bumps above cannot reach. Without this, `state.items =
      // [...]` left every held element proxy silently stale (it served
      // the NEW value on read, so only a subscriber count saw it).
      //
      // Matched by id, not by position: that is the whole point of id
      // addressing, and a re-ordered replace must not notify elements
      // whose contents did not move. Reference equality inside
      // bumpReplaced then prunes untouched elements for free.
      // Only arrays that have actually handed out an ELEMENT PROXY can
      // have a holder to notify. Without this gate the diff ran on every
      // wholesale replace and cost 5.7x, for elements nobody was
      // subscribed to. Two flags, because the two addressing schemes
      // intern different keys and a wrong guess notifies nothing:
      // collections address by stable `_id` (`items.<id>.f`), every
      // other array of objects addresses by INDEX (`mixed.0.f`).
      const byIdSubs = elemProxiedById.has(sk);
      const byIxSubs = elemProxiedByIx.has(sk);
      if (!byIdSubs && !byIxSubs) return;
      if (byIxSubs) {
        // Index addressing: position IS the identity, so diff by slot.
        // Reference equality inside bumpReplaced prunes slots that did
        // not move, which is what makes this affordable.
        const m = Math.max(ol, nl);
        for (let i = 0; i < m; i++) {
          bumpReplaced(_join(sk, i), oa ? oa[i] : undefined, na ? na[i] : undefined);
        }
      }
      if (!byIdSubs) return;
      let byId = null;
      for (let i = 0; i < nl; i++) {
        const e = na[i];
        if (!_isObj(e) || e._id == null) continue;
        if (byId === null) byId = new Map();
        byId.set(String(e._id), e);
      }
      for (let i = 0; i < ol; i++) {
        const e = oa[i];
        if (!_isObj(e) || e._id == null) continue;
        const id = String(e._id);
        const ne = byId === null ? undefined : byId.get(id);
        if (byId !== null) byId.delete(id);
        bumpReplaced(_join(sk, id), e, ne);     // ne undefined => dropped
      }
      // Ids only in the NEW array. These are usually brand-new elements
      // nobody can hold a proxy for — but an id CAN come back: drop a
      // row and re-add it with the same id (a server payload does this
      // routinely) and a live subscriber is still holding
      // `items.<id>.title`. A bare `bumpKey(items.<id>)` cannot reach
      // that subscriber, so this walks the element like any other
      // replacement. Bounded by the new array, which bumpArray above
      // already walks.
      // Ids only in the NEW array are brand-new elements nobody can
      // hold a proxy for — UNLESS a caller supplied an id that was used
      // before, which is the only way one can reappear (genId is
      // monotonic). Walking every new element's fields unconditionally
      // is O(rows x fields) on every wholesale replace, permanently,
      // because the gate admitting it is monotonic. Reference equality
      // cannot prune it either: `oldV` is always undefined here.
      if (byId !== null) {
        if (sawCallerIds.has(sk)) {
          for (const [id, e] of byId) bumpReplaced(_join(sk, id), undefined, e);
        } else {
          for (const id of byId.keys()) bumpKey(_join(sk, id));
        }
      }
      return;
    }
    const oo = o || {}, nn = n || {};
    // No `Array.isArray` flip check: the branch above returns whenever
    // EITHER side is an array, so both would be false here by
    // construction.
    let shaped = !o || !n;
    if (!shaped) {
      const ok = Object.keys(oo), nk = Object.keys(nn);
      shaped = ok.length !== nk.length;
      if (!shaped) for (const k of ok) if (!(k in nn)) { shaped = true; break; }
    }
    if (shaped) bumpKey(sk);

    const seen = new Set();
    for (const k of Object.keys(oo)) seen.add(k);
    for (const k of Object.keys(nn)) seen.add(k);
    for (const k of seen) bumpReplaced(_join(sk, k), oo[k], nn[k]);
  }

  // Array reads subscribe per INDEX (`sk#3`) and to length (`sk#len`),
  // mirroring solid-js/store, which keeps a node per property including
  // array indices plus a separate `length` node. Collapsing all of them
  // onto the array's own key — which is what this store did — meant any
  // splice re-ran every consumer that had touched the list.
  const _ix = (sk, i) => sk + '#' + i;
  const _len = (sk) => sk + '#len';
  // Whole-array key. Index reads subscribe per index, but map/filter/
  // for..of/spread go through the method fall-through and touch no
  // index at all — they subscribed to NOTHING, so `state.items.map(...)`
  // in a component never re-ran. Every array mutation bumps this, and
  // every non-index read subscribes to it.
  const _all = (sk) => sk + '#all';

  // OWNING-ARRAY WAKE. Iteration binds its method to the RAW array, so
  // the callback reads plain objects and registers nothing — `sk#all` is
  // the only dependency it can have. Structural mutations bump it, but a
  // leaf write inside an element does not, so `list[0].v = 42` left
  // every `list.map(...)` in the app permanently stale. It kept serving
  // the right value on read, which is why only a subscriber count found
  // it, and why the existing `array methods track` test — which mutates
  // with `push`, a structural op — passed straight over it.
  //
  // The keys are precomputed onto elInfo when the element node is built
  // (makeNode memoizes, so once per node), not derived per write: the
  // write path pays one property load and a walk of a 1-2 element array
  // instead of a string concat. `allKeys` is a CHAIN so a write nested
  // under `list[0].tags[2]` wakes iterators of `tags` AND of `list`.
  //
  // This is deliberately coarser than per-leaf: any write beneath an
  // array wakes every consumer that iterated it. That is the floor, not
  // a shortcut — an iterator cannot report which elements it read. Index
  // and leaf subscribers keep their exact per-key precision.
  const _allChain = (elInfo, sk) => {
    const k = _all(sk);
    const prev = elInfo === undefined || elInfo === null ? undefined : elInfo.allKeys;
    if (prev === undefined) return [k];
    return prev.indexOf(k) >= 0 ? prev : prev.concat(k);
  };
  // Takes the elInfo, not its `allKeys`, so no caller has to remember
  // the null dance. Five array mutators each repeated the same guarded
  // one-liner, and a sixth that forgot it would reproduce exactly the
  // silent under-notification this file has now shipped six fixes for.
  function bumpOwners(info) {
    if (info === undefined || info === null) return;
    const allKeys = info.allKeys;
    if (allKeys === undefined) return;
    for (let i = 0; i < allKeys.length; i++) bumpKey(allKeys[i]);
  }
  // Is anything actually iterating one of these arrays? `#all` gets a
  // signal only when a consumer reaches the method fall-through, so an
  // app that never maps over a collection leaves it absent — and then
  // the owner wake is a couple of failed Map lookups with nothing to
  // coalesce. Checking first lets the write path skip batch() entirely,
  // which is where the cost of this fix lives (measured: +12.3% on a
  // write inside a collection element, down to the drift floor).
  function anyLive(info) {
    if (info === undefined || info === null) return false;
    const allKeys = info.allKeys;
    if (allKeys === undefined) return false;
    for (let i = 0; i < allKeys.length; i++) if (vers.has(allKeys[i])) return true;
    return false;
  }
  function bumpArray(sk, from, to) {
    bumpKey(_all(sk));
    bumpKey(_len(sk));
    for (let i = from; i < to; i++) bumpKey(_ix(sk, i));
  }
  function bumpIndices(sk, from, to) {
    for (let i = from; i < to; i++) bumpKey(_ix(sk, i));
  }

  // COALESCE. Each version signal is `equals:false`, so every bump
  // schedules its own flush — a single delete that bumps the parent key
  // and the removed subtree re-ran one effect TWICE, and a wholesale
  // replace re-ran a leaf's effect once per bump that reached it.
  // Wrapping a mutation's notification in solid's batch collapses them
  // into one run per effect, which is what "only what changed
  // re-renders" has to mean to be worth anything.
  const notify = (fn) => batch(fn);

  // Prune the version signals of SPLICED-OUT COLLECTION RECORDS.
  //
  // ONLY these. Deleting a signal orphans any effect already holding it:
  // if the key is ever written again the write interns a FRESH signal and
  // the old subscriber never re-runs — silent under-notification, the
  // dangerous direction. `delete state.cfg.a` followed by
  // `state.cfg.a = 5` is exactly that, and pruning on delete produced it
  // (measured: 1 re-run for the delete, 0 for the re-create).
  //
  // Removed records are the one case where it is provably safe: element
  // ids come from genId, which increments monotonically and is seeded
  // past the persisted high-water mark on hydrate, so a spliced-out id
  // can never be issued again.
  //
  // One pass, not one per record: pruning per element made a splice
  // O(removed x vers.size) and a 500-element splice blew a 150 ms
  // budget in the existing perf test.
  // First path segment under `sk` — the element id. `items.7#len`
  // yields `7`, not `7#len`, which is the whole reason this is a
  // function and not an inline slice.
  function idSegment(key, dotLen) {
    let end = key.indexOf('.', dotLen);
    const hash = key.indexOf('#', dotLen);
    if (hash >= 0 && (end < 0 || hash < end)) end = hash;
    return end < 0 ? key.slice(dotLen) : key.slice(dotLen, end);
  }

  // THE SINGLE OWNER of "these elements are gone".
  //
  // Four mutators removed elements and each hand-rolled the same five
  // steps with a different gate: splice and the length setter on
  // `_isIdColl`, reorderBy on its own `wasIdColl`, the index setter on
  // `_isColl` — and reorderBy skipped the emptiness guard while the
  // index setter skipped the notification entirely. EVERY round of
  // review on this branch has found a different one of the four out of
  // step, including a fix that converted three and missed the fourth.
  //
  // The five steps, and why each is gated the way it is:
  //   - NOTIFY holders. A proxy addressed by the removed element's id
  //     is subscribed to `sk.<id>.field`, which no index bump reaches.
  //     Without this it serves the dead element's value forever, and
  //     the prune below then deletes the signal so no later write can
  //     wake it either.
  //   - TOMBSTONE the frame. Persistence, so it rides the policy.
  //   - dropMemo and pruneVersRecords. Memory hygiene, so they do NOT
  //     ride the policy — gating all three together once leaked 181
  //     proxies on a persist:false collection.
  //
  // `removed` may contain primitives and id-less objects; only
  // id-carrying ones were ever addressed by id.
  function releaseElements(sk, removed, isIdColl, alreadyNotified) {
    if (!isIdColl || removed.length === 0) return;
    const persistThis = persists(sk);
    const prefixes = [];
    const removedIds = new Set();
    for (let i = 0; i < removed.length; i++) {
      const r = removed[i];
      if (!_isObj(r) || r._id == null) continue;
      const id = String(r._id);
      const rSk = _join(sk, id);
      if (!alreadyNotified) bumpReplaced(rSk, r, undefined);   // holder sees it go
      if (persistThis) dirty.set('k:' + rSk, null);
      prefixes.push(rSk);
      removedIds.add(id);
    }
    if (prefixes.length === 0) return;
    dropMemo(prefixes);
    pruneVersRecords(sk, removedIds);
  }

  function pruneVersRecords(sk, ids) {
    if (ids.size === 0) return;
    // ONLY WHEN IDS CANNOT COME BACK. The safety proof below rests on
    // genId being monotonic — true for ids this store mints, false for
    // ids a CALLER supplied, which the same store now supports
    // first-class. A server that drops a row and re-sends it under the
    // same `_id` (bumpReplaced's own comment says "a server payload
    // does this routinely") re-interns a fresh signal, and every
    // subscriber still holding the deleted one goes silent for good.
    // That is the under-notification this function's comment calls the
    // dangerous direction; not pruning merely grows `vers`, which
    // `versions()` reports.
    // The Set sweeps run FIRST: they are memory hygiene, and the early
    // return below gates the `vers` prune only. Behind it, a store fed
    // caller ids never swept them and `proxied()` — added because that
    // pair leaked for three rounds — climbed without bound.
    pruneKeyed(elemProxiedById, sk, ids);
    pruneKeyed(elemProxiedByIx, sk, ids);
    if (sawCallerIds.has(sk)) return;
    // The addressing-scheme sets are keyed by store key too, and a
    // nested array inside a collection element interns
    // `items.<id>.tags` — so element churn grew them without bound, and
    // neither `versions()` nor `memos()` can see it. Swept on the same
    // pass, by the same id match.
    if (vers.size === 0) return;
    const dot = sk + '.';
    for (const k of vers.keys()) {
      if (!k.startsWith(dot)) continue;
      if (ids.has(idSegment(k, dot.length))) vers.delete(k);
    }
  }

  // Drop entries of a Set of store keys whose first segment under `sk`
  // is one of `ids`.
  function pruneKeyed(set, sk, ids) {
    if (set.size === 0) return;
    const dot = sk + '.';
    for (const k of set) {
      if (!k.startsWith(dot)) continue;
      if (ids.has(idSegment(k, dot.length))) set.delete(k);
    }
  }

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
  // Every key on disk, listed once at open. null = the host cannot list,
  // so hydration probes every declared leaf as it always did.
  let diskKeys = null;
  // Engine reads performed during hydration, taken from the ENGINE's own
  // counter rather than from db.js's intent to probe. The whole point of
  // `diskKeys` is that this stops scaling with the size of initState, and
  // a saving nobody counts is one nobody notices regressing — but a
  // counter incremented next to a gate shares that gate's condition, so
  // deleting the gate left the number unchanged. Counting at the
  // boundary being crossed cannot be fooled that way.
  let hydrateProbes = 0;
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
  const EMPTY = [];
  // Arrays that have written per-element frames, so the blob path knows
  // whether there is anything to sweep. Seeded by hydrateArray when it
  // finds an index frame, since the frames may predate this process.
  const hadElementFrames = new Set();
  const collCache = new Map();
  // Arrays that have handed out at least one element proxy, split by
  // ADDRESSING SCHEME. Gates the per-element diff in bumpReplaced: no
  // proxy ever created means no holder can exist, so there is nothing
  // under `items.<id>.*` (or `mixed.<index>.*`) to notify. Monotonic —
  // a replaced array keeps its flag, because proxies handed out before
  // the replace may still be held.
  const elemProxiedById = new Set();
  const elemProxiedByIx = new Set();
  // Subtrees needing a native prefix-tombstone at flush. A wholesale
  // object/array assign at sk invalidates any prior leaf-override
  // frames under sk.* on disk — del_prefix clears them in one native
  // call, off the per-key JS loop.
  const pendingDelPrefix = new Set();
  // Registered prefix sweeps. Each one costs a full-keydir scan at
  // flush, natively and in LogStore — so an array that registers one per
  // mutation for a namespace that has never held a `k:sk.*` record is a
  // cost nothing else can see. Counted for the same reason as
  // versions() / memos() / proxied().
  let prefixSweeps = 0;

  // Register a subtree for `delPrefix` at the next flush, AND drop every
  // descendant key staged so far.
  //
  // The purge has to happen HERE, not at flush time. doFlush runs
  // delPrefix before writing `dirty`, so a leaf override staged earlier
  // in the same window was deleted on disk and then immediately
  // re-written: `s.a.b.c = 1` then `s.a = {x:2}` brought `a.b.c` back on
  // reopen as an overlay on the new `a` — memory said it was gone, disk
  // disagreed. Purging at flush instead is WRONG in the other direction:
  // a wholesale collection assign stages its own `sk.<id>` element
  // frames AFTER registering the prefix, and those must survive. At this
  // instant every descendant in `dirty` predates the write that
  // invalidates them, which is exactly the set to drop.
  function delPrefixLater(sk) {
    // EMPTY sk IS THE ROOT, and the root has no prefix. Without this
    // guard `pre` is just `'k:'`, which matches every namespaced key
    // whose next character is '.' or '#' — including `k:#meta`. A push
    // to a root-level array deleted the version/shape metadata that
    // migrate() depends on AND lost the push. tombstoneTree and writeAt
    // both guard with `sk &&`; this one did not.
    // DEFENSIVE given the `hadElementFrames` gate above, which is what
    // keeps a root-level array from reaching here at all today — with
    // both in place no test distinguishes this line, which was checked.
    // It stays because the two guards protect different things: that one
    // is "is there anything to sweep", this one is "is `sk` even a
    // prefix". Without it, one caller that forgets the first guard
    // tombstones `k:#meta` and takes the store's version and shape with
    // it.
    if (!sk) return;
    prefixSweeps++;
    pendingDelPrefix.add(sk);
    if (dirty.size === 0) return;
    // O(dirty) per registration, and MEASURED: a bisect puts +22% of a
    // 50-element wholesale array replace here (the arm reads +29%
    // against HEAD, +7% with this loop removed). It stays, because what
    // it buys is the difference between a deleted leaf staying deleted
    // and resurrecting on the next open — doFlush runs `delPrefix`
    // BEFORE writing `dirty`, so any stale descendant still staged is
    // written straight back over the delete that was meant to catch it.
    //
    // The cheap version is wrong: `dirty` is insertion-ordered, but
    // re-staging an existing key keeps its ORIGINAL position, so a
    // cutoff index cannot tell "staged before this write" from
    // "re-staged after it". One startsWith instead of two, then a single
    // character check for the separator, is as far as it goes without
    // giving each dirty entry a sequence number — which would cost an
    // allocation on every stage to save a scan on a much rarer one.
    const pre = 'k:' + sk;
    const n = pre.length;
    for (const key of dirty.keys()) {
      if (!key.startsWith(pre)) continue;
      const c = key.charCodeAt(n);
      if (c === 46 /* . */ || c === 35 /* # */) dirty.delete(key);
    }
  }
  let flushTimer = null;
  let flushCount = 0;

  // Advance `genId` past any caller-supplied numeric id.
  //
  // Keeping a caller's `_id` without doing this let genId reissue an id
  // that is still live: `s.items = [{_id:'2'}]` then two pushes handed
  // out '1' and '2', so two elements collided on store key `items.2` and
  // the first was destroyed on the next open. It also breaks
  // pruneVersRecords' safety proof, which rests on ids never being
  // reissued. `ensureIds` has always done this for the migrate path;
  // every other entry point for caller ids now does too.
  // Arrays ever given a caller-supplied `_id`. Only those can see an id
  // REAPPEAR, so only those need the expensive new-element walk above.
  const sawCallerIds = new Set();

  // `markCaller = false` advances the counter without recording that a
  // CALLER supplied these ids. Hydration restores whatever was stored,
  // and it cannot tell a minted id from a supplied one — marking them
  // meant every store disabled pruneVersRecords permanently after its
  // first reopen, which is the unbounded `vers` growth versions() was
  // added to catch.
  function seedIds(sk, els, markCaller = true) {
    let max = 0;
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      if (!_isObj(e) || e._id == null) continue;
      // ANY caller id marks the array, numeric or not. Gating the mark
      // on `max > 0` meant a store using string or uuid ids never set
      // it — so both protections that depend on it (bumpReplaced's
      // element walk for a reappearing id, and pruneVersRecords
      // refusing to prune ids that can come back) were dead for exactly
      // the id scheme most likely to see one reappear.
      if (markCaller) sawCallerIds.add(sk);
      const n = +e._id;                       // non-numeric ids: NaN, ignored
      if (n > max) max = n;
    }
    if (max + 1 > (nextIds.get(sk) || 1)) nextIds.set(sk, max + 1);
  }

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
        // 'k:' + sk, NOT sk. Every key in the keydir is namespaced,
        // so `delPrefix('a')` tested `startsWith('a.')` against
        // `'k:a.b.c'` and swept nothing — on both backends, since the
        // JS one mirrors the native matcher. A leaf override written in
        // an EARLIER flush window therefore survived the wholesale
        // assign that invalidated it and came back on reopen. The
        // same-window case was masked by delPrefixLater's dirty purge,
        // which is why every test of this passed.
        for (const sk of pendingDelPrefix) engine.delPrefix('k:' + sk);
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
        if (live !== undefined) engine.put(key, encodeAt(key.slice(2), live));
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
  // A reload tears this generation down while a debounced flush may still
  // be pending (FLUSH_DEBOUNCE_MS). Nothing used to clear that timer, so a
  // write made within ~60 ms of a save could fire after beginReload().
  // Land it synchronously instead, then the incoming generation hydrates
  // from a file that already has it.
  if (typeof globalThis.__skalHot === 'object' && globalThis.__skalHot &&
      typeof globalThis.__skalHot.addCleanup === 'function') {
    globalThis.__skalHot.addCleanup('store:' + cfg.name, () => {
      try { flushNow(); } catch (_) { /* a failed flush must not block teardown */ }
    });
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
  function setAt(sp, value, sk, silent, force) {
    const path = concreteOf(sp);
    if (path === null) return;                   // target element gone
    const key = sk === undefined ? '' : sk;
    if (path.length === 0) {                     // whole-tree replace (migrate)
      structGen++;
      for (const k of Object.keys(root)) delete root[k];
      if (_isNode(value)) Object.assign(root, value);
      bumpTree(key);                             // no old snapshot to diff
      // The whole tree moved, so every declared-dep effect is stale.
      // This branch returned before reaching the notify below, which
      // meant a version migration — the single largest state change the
      // store can make — never reached them at all.
      if (_skalEffectMap.size > 0) _skalNotify('', true);
      return;
    }
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      // VIVIFYING A MISSING PARENT IS A STRUCTURAL CHANGE — see writeAt,
      // where this exact omission made a successful write unreadable
      // through the store.
      //
      // DEFENSIVE HERE, and known to be: no test fails without it. That
      // was checked, not assumed. setAt's only proxy caller is
      // arrayProxy, which re-resolves from the root on every access and
      // so has no cached resolution to go stale; objectProxy, the one
      // that DOES cache per generation, writes through writeAt. It stays
      // because giving arrayProxy the same resolution cache is an
      // obvious next optimisation, and it would silently reintroduce the
      // writeAt bug on the array path. One increment on the write-into-
      // a-hole path is a cheap way to make that refactor safe.
      if (cur[k] === null || typeof cur[k] !== 'object') { cur[k] = {}; structGen++; }
      cur = cur[k];
    }
    const last = path[path.length - 1];
    const old = cur[last];
    // Structural iff EITHER side can have descendants — replacing an
    // object with a scalar moves things just as much as the reverse.
    const structural = _isNode(value) || _isNode(old);
    // No-op writes do not notify, matching solid-js/store's setProperty.
    // This is the path hydration and faultIn take, so it also stops a
    // reload from re-notifying leaves whose stored value equals the
    // default already in the tree.
    if (!structural && old === value && !force) return;
    cur[last] = value;
    // Only a shape change invalidates the parent caches. Bumping for a
    // primitive array write defeated the cache in any read/write mix,
    // which is the exact scenario its own comment says must not happen.
    if (silent) { if (structural) structGen++; return; }
    if (structural) { structGen++; notify(() => bumpReplaced(key, old, value)); }
    else bumpKey(key);
    // DECLARED-DEP EFFECTS TOO. writeAt does this; setAt did not, so a
    // lazy fault-in, an array hydration or an LRU eviction updated the
    // tree and re-ran Solid effects while `createEffect(['archive.x'])`
    // kept serving the initState default forever. The silent callers
    // (array mutators) pass `silent` and notify themselves.
    if (key && _skalEffectMap.size > 0) _skalNotify(key, _isNode(value));
  }

  // Mutate the node AT `sp` in place. Replaces solid-js/store's
  // `produce` — with a plain tree the callback can simply operate on the
  // real object, so delete / splice / sort / length are ordinary
  // JavaScript rather than a tracked-write protocol.
  // Notification is the CALLER's job: every call site is an in-place
  // array mutation or a delete, and each notifies per index (or per
  // subtree) itself. A `silent` flag and a bumpTree fallback lived here
  // for a while with all four call sites passing `silent = true` — dead
  // weight that read as a live coarse-notification path.
  function mutateAt(sp, fn) {
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
  }

  // ── resolved-parent cache generation ────────────────────────────────
  // Reads used to walk from the ROOT every time, firing one proxy trap
  // per path segment. Each object proxy now caches the node its path
  // resolves to, so a read costs one trap on the leaf.
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
      // An index-addressed array persists as ONE blob here. If the array
      // previously wrote per-element frames, its `#x` index is still
      // authoritative and hydrateArray reads it FIRST — the blob would
      // never be read. Same retirement stageArray's blob branch does.
      if (elInfo.arrayFrame && hadElementFrames.has(elInfo.storeKey)) {
        hadElementFrames.delete(elInfo.storeKey);
        delPrefixLater(elInfo.storeKey);
        dirty.set('k:' + elInfo.storeKey + '#x', null);
      }
      dirty.set('k:' + elInfo.storeKey, new DeferredFrame(elInfo.solidPath));
      return;
    }
    // PER-ELEMENT FRAMES REQUIRE IDS TO ADDRESS THEM BY. `_isColl` only
    // asks "are they all objects", and an array can satisfy that without
    // any element carrying an `_id` — a MIXED array (never id-assigned,
    // because it was not a collection when it was written) truncated
    // down to its object members is exactly that. Staging it here wrote
    // an index frame of `ids: [undefined]` and no element frames, while
    // `k:sk` still held the pre-truncation blob; hydrateArray reads the
    // index FIRST and rebuilt an empty array from it, losing everything.
    //
    // No ids means it persists as one whole-array frame, which is what
    // it was already doing before the truncation.
    if (Array.isArray(value)) { stageArray(sk, value); return; }
    // Recurse per key instead of blobbing when EITHER
    //   - this is the root (so the root is not one giant frame and
    //     top-level collections keep their own structure), or
    //   - the store has any `persist: false` path at all.
    //
    // The second case is the fix for a real leak: `s.a = {secret, b}`
    // with `a.secret` non-persist encoded the secret into the blob at
    // `k:a`, because the policy was only ever consulted for `a`. The
    // vivification path made it easy to hit (it re-stages a whole
    // materialised ancestor), but any wholesale assign over a subtree
    // containing a non-persist leaf had the same hole.
    if (_isObj(value) && (sk === '' || nonPersistUnder(sk))) {
      // RETIRE THE WHOLE-VALUE FRAME this recursion supersedes. Writing
      // per-key children while an older `k:sk` blob survives loses the
      // entire assign: hydrate's object branch reads `k:sk` FIRST, and
      // if what it finds is not an object it stops recursing and
      // prefix-deletes the children. `s.a = 5` then `s.a = {b:1}` under
      // a non-persist path read back as 5.
      //
      // writeAt's delPrefixLater(sk) sweeps `k:sk.` and `k:sk#`, which
      // does not include `k:sk` itself — the same off-by-one namespace
      // that made delPrefix a no-op for a year. Root has no frame of
      // its own to retire.
      if (sk !== '') dirty.set('k:' + sk, null);
      for (const k of Object.keys(value)) {
        const childSk = _join(sk, k);
        if (!persists(childSk)) continue;
        stageAt([...sp, k], childSk, null, value[k]);
      }
      return;
    }
    // A key that persisted as a COLLECTION is being written as
    // something that is not an array at all. stageArray owns the `#x`
    // index, but stageAt only routes there when the new value IS an
    // array — so `s.items = 5` over a persisted collection left the
    // index behind, and hydrateArray reads `#x` FIRST: the old
    // collection came back and the 5 was lost. Same masking as the
    // degrade case, one shape further out.
    if (hadElementFrames.has(sk)) {
      hadElementFrames.delete(sk);
      // delPrefixLater FIRST — it purges staged `sk#*` keys, so setting
      // the tombstone before it dropped the tombstone it had just been
      // given. stageArray's blob branch orders these correctly; this
      // copy did not, leaving retirement dependent on engine.delPrefix,
      // which silently no-ops without __skal_store_del_prefix.
      delPrefixLater(sk);
      dirty.set('k:' + sk + '#x', null);
    }
    // Auto-blob: one frame at `sk` encoding the whole value, whether
    // it's a primitive or a deep object. Leaf overrides ride on top
    // (see writeAt's pendingDelPrefix on wholesale assigns).
    dirty.set('k:' + sk, encodeAt(sk, value));
  }

  // Encode a value for storage at `sk`, dropping any `persist: false`
  // descendant.
  //
  // stageAt's per-key recursion honours the policy, but it is only
  // reachable for plain objects: the ARRAY route and the element-frame
  // route both return before it. So a non-persist leaf beneath an array
  // was written to disk by any sibling write — `tags[0].label = 'y'`
  // serialised `tags[0].token` with it. Filtering at the ENCODE covers
  // every route, including the DeferredFrame flush, which is where the
  // element case actually lands.
  //
  // `nonPersistUnder` is a Set lookup and false for almost every store,
  // so the recursion below is not on anyone's hot path.
  function stripNP(sk, v) {
    if (!_isNode(v)) return v;
    if (Array.isArray(v)) {
      // Elements get the same `persists` check the object branch below
      // gets. Without it `paths: {'codes.0': {persist:false}}` was
      // ignored — the recursion descended but never asked the question,
      // so the leak this function exists to close was open for exactly
      // half of it. A dropped element becomes a hole rather than
      // shifting its neighbours, so indices still line up on reload.
      const out = new Array(v.length);
      for (let i = 0; i < v.length; i++) {
        const ck = _join(sk, i);
        if (!persists(ck)) continue;
        out[i] = stripNP(ck, v[i]);
      }
      return out;
    }
    const o = {};
    for (const k of Object.keys(v)) {
      const ck = _join(sk, k);
      if (!persists(ck)) continue;
      o[k] = stripNP(ck, v[k]);
    }
    return o;
  }
  const encodeAt = (sk, v) =>
    encodeFrame(nonPersistUnder(sk) ? stripNP(sk, v) : v);

  // THE SINGLE OWNER of how an array is represented on disk.
  //
  // An array persists one of two ways, and the `#x` index frame is what
  // tells hydrateArray which: present means "rebuild from per-element
  // frames", absent means "read the whole-array frame at k:sk".
  // hydrateArray reads `#x` FIRST, so a stale index MASKS the blob
  // entirely.
  //
  // That made every mutator responsible for retiring or writing `#x`
  // whenever it changed an array's format. Four mutators each did it
  // slightly differently, and three consecutive review rounds each found
  // a different one that had been missed — a degrading index assign, a
  // degrading `fill`, an extending `length`, a splice that left an
  // id-less object array. All four now call this, and none of them can
  // get it wrong separately.
  //
  // `changed` lists the elements whose frames need rewriting; omitted
  // means all of them. A push must not re-encode the whole collection —
  // that is the deferred-element-frame win (99.8% of encoded bytes were
  // being thrown away).
  function stageArray(sk, value, changed) {
    if (!persists(sk)) return;
    if (_isIdColl(value)) {
      // `changed` NAMES THE ELEMENTS WHOSE BYTES MOVED — meaningful only
      // when the others already HAVE frames. On a PROMOTION (a blob, or
      // never persisted, becoming a collection) none of them do, so
      // honouring it wrote an index listing every id, frames for a
      // subset, and a tombstone over the blob holding the rest. `pop()`
      // on a degraded collection lost the whole array: memory
      // [{a:1}], reopen [].
      const promoting = !hadElementFrames.has(sk);
      const list = (changed === undefined || promoting) ? value : changed;
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (_isObj(el) && el._id != null) {
          const eSk = _join(sk, el._id);          // built once, not twice
          if (!persists(eSk)) continue;          // a non-persist element
          dirty.set('k:' + eSk, encodeAt(eSk, el));
        }
      }
      dirty.set('k:' + sk + '#x', INDEX_DIRTY);
      // UNCONDITIONAL, because the `#x` above is written unconditionally
      // and this flag's whole job is to record that. Gating it on
      // `list.length > 0` to avoid a sweep for an empty array meant
      // `s.items = []` wrote an index nothing remembered, so the next
      // `s.items = 5` never retired it and hydrateArray rebuilt `[]`
      // over the 5. The sweep that gate removed is not waste — it is
      // the retirement of exactly this index.
      hadElementFrames.add(sk);
      // ...and retire any whole-array frame from before the promotion,
      // mirroring the index tombstone on the blob path below.
      //
      // DEFENSIVE, and known to be: no test distinguishes it. The
      // resurrection this was reported for (blob -> promote -> delete ->
      // reopen) did reproduce, but it stops reproducing with the
      // `delPrefix` namespace fix alone, and removing BOTH this line and
      // its mirror in tombstoneTree leaves the suite green. That was
      // checked rather than assumed. It stays because the invariant is
      // "one owner decides the format", and an owner that writes one
      // representation while leaving the other on disk is not one.
      dirty.set('k:' + sk, null);
    } else {
      // Clear the per-element frames this array used to have — but ONLY
      // if it ever wrote any. Unconditionally, every push to a plain
      // `number[]` registered a full-keydir `delPrefix` per flush plus an
      // O(dirty) scan per mutation, for a namespace that has never held
      // a `k:sk.*` record.
      if (hadElementFrames.has(sk)) {
        hadElementFrames.delete(sk);
        delPrefixLater(sk);
      }
      dirty.set('k:' + sk, encodeAt(sk, value));
      // RETIRE THE INDEX unconditionally. Staging a tombstone for a key
      // that never existed costs one dirty entry and a `del` of a
      // missing key; tracking "was this ever a collection?" to avoid it
      // is exactly the state that kept being wrong.
      dirty.set('k:' + sk + '#x', null);
    }
    scheduleFlush();
  }

  // Tombstone every frame `value` occupied at storeKey `sk` — used when a
  // subtree is deleted, so its leaf / element frames don't orphan.
  function tombstoneTree(sk, value) {
    // `_isIdColl`, not `_isColl`: this has to match the format stageArray
    // actually WROTE. An all-objects array without ids persisted as one
    // whole-array frame at `k:sk`, and tombstoning only `k:sk#x` left
    // that frame on disk — `delete s.list` and the list came back at the
    // next open. The two predicates were the same function until an
    // array could be all-objects without ids; then they silently
    // diverged.
    if (_isIdColl(value)) {
      for (const el of value) {
        if (el && el._id != null) dirty.set('k:' + _join(sk, el._id), null);
      }
      dirty.set('k:' + sk + '#x', null);
      // The blob too: this array may have persisted as one before it
      // was promoted, and that frame is what hydrateArray falls back to
      // once the index is gone. Defensive — see stageArray.
      dirty.set('k:' + sk, null);
      return;
    }
    // For any other value: tombstone the frame at sk. If it was an
    // object/array it may have descendants (leaf override frames or a
    // collection's element frames) — del_prefix clears them natively.
    dirty.set('k:' + sk, null);
    if (sk && value !== null && typeof value === 'object') {
      delPrefixLater(sk);
    }
  }

  function writeAt(sp, sk, elInfo, value) {
    let v = value;
    // `Array.isArray`, not `_isColl`: seeding is about the IDS present,
    // and a mixed array carries them just as well. Gated on all-objects,
    // `s.items = [5, {_id:'1'}]` never advanced the counter and the next
    // push reissued '1' onto a live element.
    if (!elInfo && Array.isArray(value)) {
      // ONE scan for both jobs, and no rebuild when there is nothing to
      // fill in. A server payload usually arrives with every `_id`
      // already set — the old unconditional `.map` allocated a fresh
      // array and N fresh objects to change nothing, and adding a
      // separate seeding pass on top measured +20% on a 50-element
      // replace. Seeding still has to happen first: genId cannot fill a
      // gap safely until it is past every id the caller brought.
      // SEED NOW, NOT LATER. Deferring this scan to `genId` was an
      // optimisation that reintroduced the exact bug seeding exists to
      // prevent, moved across a restart: doFlush writes the index frame
      // as `nextId: nextIds.get(sk) || (a.length + 1)`, so a wholesale
      // assign that flushed before any push persisted `nextId: 2` for
      // `[{_id:'2'}]` — reopen, push once, and two elements collided on
      // `items.2`. It was also wrong in memory, because the deferred
      // scan ran against the array AS IT EXISTS AT DRAIN TIME: assign
      // two ids, splice them both out, push, and the scan saw an empty
      // array and reissued '1' — an id pruneVersRecords had already
      // deleted the signals for. `nextIds` has to be monotonic to keep
      // that proof, and monotonic means recording the maximum while the
      // array is still in hand.
      seedIds(sk, value);
      // Only rebuild when something actually needs an id. A server
      // payload usually arrives with every `_id` set, and the old
      // unconditional `.map` allocated a fresh array and N fresh objects
      // to change nothing.
      // `value[i]` on a HOLE is undefined, and `_isColl` gating this
      // uses `every`, which skips holes — so a sparse array of objects
      // reached here and threw out of the assignment. The `value.map`
      // this replaced skipped holes and never threw; this is the
      // regression, not the array.
      // "An OBJECT is missing an id" — not "some element is not an
      // id-carrying object". Widening the outer gate from `_isColl` to
      // `Array.isArray` brought primitives in here, and the old test
      // treated the primitive itself as missing: `{...5}` is `{}`, so a
      // mixed array's number was rewritten into an empty id-carrying
      // object. Primitives are left exactly as they are.
      let missing = false;
      for (let i = 0; i < value.length; i++) {
        const el = value[i];
        if (_isObj(el) && el._id == null) { missing = true; break; }
      }
      if (missing) {
        v = value.map((e) => (_isObj(e) && e._id == null
          ? { ...e, _id: genId(sk) } : e));
      }
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
    let old;
    // Index in `path` of the SHALLOWEST parent this write had to
    // materialise, or -1, and the resolved path itself. See the staging
    // block at the end.
    let vivTop = -1;
    let vivKeys = null;
    let skSegs = null;
    let path;
    {
      // `path.length === 0` is unreachable here: the only caller is
      // objectProxy.set, which always appends a key. Whole-tree replace
      // goes through setAt([], …) in migrate, which notifies with
      // bumpTree rather than bumpReplaced — so a root-clobbering branch
      // here was both dead and divergent.
      path = needsResolve ? concreteOf(sp) : sp;
      if (path === null) return;                   // target element gone
      {
        let cur = root;
        for (let i = 0; i < path.length - 1; i++) {
          const k = path[i];
          // See setAt: materialising a missing parent moves structure,
          // so every cached resolution through it is stale.
          if (cur[k] === null || typeof cur[k] !== 'object') {
            cur[k] = {};
            structGen++;
            if (vivTop < 0) vivTop = i;
            // The ancestor's OWN value just changed — scalar (or absent)
            // to object. Its subscribers have to hear that; bumping only
            // the leaf left an effect reading `s.a` serving the stale
            // `5` forever while `s.a.b.c` read 7. Round three fixed the
            // disk half of this exact scenario and left the reactive
            // half — the same "other half of the wire" shape three of
            // these rounds have now produced.
            // STORE keys, not the resolved path. `concreteOf` turns
            // `{__id:'1'}` into an INDEX, so `path.slice(...)` yielded
            // `items.0.meta` while the proxies interned `items.1.meta` —
            // the bump reached nobody, and on a mixed array it would
            // wake an unrelated slot. `sk` and `path` have the same
            // segment count by construction, so a prefix of `sk` is the
            // ancestor's key.
            if (vivKeys === null) { vivKeys = []; skSegs = sk.split('.'); }
            vivKeys.push(skSegs.slice(0, i + 1).join('.'));
          }
          cur = cur[k];
        }
        const last = path[path.length - 1];
        // See setAt: overwriting an object with a scalar is structural
        // too, and the old value costs nothing to read here.
        old = cur[last];
        if (_isNode(old)) structural = true;
        // NO-OP WRITES DO NOT NOTIFY. solid-js/store skips these
        // (`setProperty`: `if (!deleting && state[property] === value)
        // return;`) and dropping it was a regression: assigning a whole
        // server payload re-rendered every field, including the ones
        // that had not changed.
        // `vivTop >= 0` means the loop above already replaced an
        // ancestor scalar with `{}` and advanced structGen. Returning
        // here left that mutation in memory with nothing notified and
        // nothing staged — `held.c = undefined` destroyed `s.a = 5`
        // while disk still said 5. The no-op guard is only a no-op when
        // nothing has happened yet.
        if (!structural && old === v && vivTop < 0) return;
        cur[last] = v;
      }
    }
    // Materialised ancestors are news too — their value changed from a
    // scalar (or nothing) to an object — but they go in the SAME batch
    // as the leaf. A separate notify() is a second update cycle, and an
    // effect reading `s.a` re-ran twice for the one write: once for the
    // ancestor, then again when the leaf bump reached the key it had
    // just re-subscribed to. That is the defect batching exists to stop.
    // THE HOT PATH. A scalar leaf write over a scalar wakes exactly its
    // own key — one Map lookup and one signal set, no batch. A
    // structural change diffs, waking only descendants that differ.
    //
    // `allKeys` is set only for writes beneath an ARRAY; those also wake
    // that array's iterators (see _allChain) and so must be batched with
    // the key bump, or one write re-runs a consumer twice. A plain
    // object write skips both the batch and the walk.
    if (structural) {
      // Wholesale assignment replaces a node, so any cached resolution
      // of it or of anything beneath it is stale. `structural` is true
      // for every object/array `v` (it is initialised to `_isNode(v)`),
      // so this single bump covers what a second one below used to.
      structGen++;
      notify(() => {
        bumpReplaced(sk, old, v); bumpOwners(elInfo);
        if (vivKeys !== null) for (let i = 0; i < vivKeys.length; i++) bumpKey(vivKeys[i]);
      });
    } else if (vivKeys !== null
               || (elInfo !== undefined && elInfo !== null && anyLive(elInfo))) {
      notify(() => {
        bumpKey(sk); bumpOwners(elInfo);
        if (vivKeys !== null) for (let i = 0; i < vivKeys.length; i++) bumpKey(vivKeys[i]);
      });
    } else bumpKey(sk);
    if (vivKeys !== null && _skalEffectMap.size > 0) {
      for (let i = 0; i < vivKeys.length; i++) _skalNotify(vivKeys[i], true);
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
    // policyOf, not a hand-rolled gate — the eleventh copy, and the one
    // left behind when the helper was introduced to collapse them.
    const pol = policyOf(sk);
    if (!elInfo && pol.lazy) touchFaulted(sk);    // the write loaded it
    const shouldPersist = pol.persist;
    if (shouldPersist) {
      // VIVIFICATION IS A SHAPE CHANGE ON DISK TOO. Staging only the
      // leaf left the clobbered ancestor's old frame in place: after
      // `s.a = 5; held.c = 7` disk still said `k:a = 5` while `k:a.b.c`
      // said 7, and hydrate's shape-divergence branch prefix-deleted the
      // override — the write was correct in memory and gone on reopen.
      // The unit test for this checked memory only, which is exactly the
      // half-of-the-wire gap CLAUDE.md warns about.
      //
      // Stage the materialised ancestor WHOLESALE instead; its encoding
      // already contains the leaf. Only reachable on the write-into-a-
      // hole path, so the normal write is untouched. `elInfo` writes
      // already re-stage the whole element frame and need none of this.
      if (vivTop >= 0 && !elInfo) {
        const ancSp = path.slice(0, vivTop + 1);
        const ancSk = ancSp.join('.');
        delPrefixLater(ancSk);
        stageAt(ancSp, ancSk, null, readSolid(ancSp));
        scheduleFlush();
        return;
      }
      // Wholesale object/array assign at a non-root key: clear any
      // prior leaf-override frames under sk.* on disk. The native
      // del_prefix runs in one call, so the JS thread isn't looping.
      if (!elInfo && sk && v !== null && typeof v === 'object') {
        delPrefixLater(sk);
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
  //     for typical stores (10s–100s of paths); see notes/drafts/TODO.md for the
  //     considered-and-rejected trie alternative.
  //
  // Trade-off vs Solid effects: the dep set is static — the user must
  // know the paths upfront. For dynamic-dep effects, use Solid's
  // createEffect (which we still support).
  //
  // History: a native (Zig) backing for the dep graph was attempted
  // and removed — the per-write JS↔native crossing on `_skalNotify`
  // cost more than the JS Map operations it replaced, causing a 14×
  // regression on 1k-write propagation. See BENCHMARKS.md Lesson 5.
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
    const wave = _skalDirty;
    _skalDirty = new Set();
    for (const eff of wave) {
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
    hydrateProbes: () => hydrateProbes,
    flushNow,
    version: () => cfg.version,
    pending: () => dirty.size,
    flushes: () => flushCount,
    resident: () => faulted.size,
    // Live version signals — one per store key ever READ. Exposed
    // alongside pending/resident/flushes because it is the store's other
    // unbounded-growth risk: nothing pruned it until removed subtrees
    // started being swept, and a leak here is invisible except as
    // gradually slower notification.
    versions: () => vers.size,
    // Memoized proxy nodes. Paired with `versions()` deliberately: an
    // element proxy holds its version signals alive through `verCache`,
    // so a memo that fails to evict makes `versions()` report a leak as
    // FIXED while the objects stay reachable. One number without the
    // other is not evidence.
    memos: () => nodeMemo.size,
    // Arrays that have handed out an element proxy, by addressing
    // scheme. Counted for the same reason as the two above: this pair
    // leaked for three rounds precisely because no number moved.
    proxied: () => elemProxiedById.size + elemProxiedByIx.size,
    prefixSweeps: () => prefixSweeps,
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
  // `memoKey` separates ID-addressed collection elements from
  // INDEX-addressed ones. Both derive a store key of the form
  // `items.<n>`, and generated ids start at 1 — so element `_id` '1'
  // collided with index 1 and the memo served the wrong element
  // (`[items[0].v, items[1].v]` returned [20,20] for [10,20]). The store
  // key is unchanged, so nothing on disk moves.
  function makeNode(sp, sk, elInfo, isArray, memoKey) {
    if (isArray === undefined) isArray = Array.isArray(readSolid(sp));
    const mk = memoKey === undefined ? sk : memoKey;
    const hit = nodeMemo.get(mk);
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
    nodeMemo.set(mk, { node, isArray });
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
          // `\0` terminates a segment too: id-addressed elements memoize
          // under `items.<id>\0id` to keep out of the index namespace.
          // Without this case NO removed element proxy was ever evicted
          // — and each retained proxy kept, through its verCache
          // closure, the very signals pruneVersRecords had deleted. So
          // `versions()` reported the leak as fixed while the objects
          // stayed reachable, and a re-inserted element got a proxy
          // wired to a dead signal that no write could ever reach.
          if (k === p || k.startsWith(p + '.') || k.startsWith(p + '#')
              || k.startsWith(p + '\0')) {
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
        // object/element steps, '#' before a collection sidecar
        // (`todos#x`), and '\0' before the id-namespace marker on a
        // memoized collection element (`todos.7\0id`) — any of the three
        // terminates a segment.
        let cut = -1;
        for (let i = cur.length - 1; i > 0; i--) {
          const c = cur.charCodeAt(i);
          if (c === 46 /* . */ || c === 35 /* # */ || c === 0 /* NUL */) { cut = i; break; }
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
        // Silent + precise, for the same reason array mutations are:
        // letting mutateAt sweep `sk` would wake every SIBLING under the
        // parent, when the only thing that changed is this key and what
        // hung beneath it.
        mutateAt(sp, (o) => { delete o[key]; });
        notify(() => {
          bumpKey(sk);                     // the parent's shape changed
          // Only walk `vers` when there IS a subtree. For a scalar the
          // one key bumpTree could find is the key itself, so bumpKey is
          // the same notification without the O(vers.size) scan — on a
          // map that grows with every leaf ever read. Mirrors the
          // dropMemo skip a few lines below.
          //
          // No test distinguishes these, and cannot: they are equivalent
          // by construction for a scalar. This is an efficiency change
          // asserted by reading, not by measurement.
          if (old !== null && typeof old === 'object') bumpTree(childSk);
          else bumpKey(childSk);
          bumpOwners(elInfo);
        });
        // Re-stage the element frame — but only if it is persisted at
        // all. This wrote a frame for every `persist: false` element.
        if (elInfo) {
          if (persists(elInfo.storeKey)) {
            stageAt(sp, sk, elInfo, null);
          }
        }
        else if (persists(childSk)) {
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
    // Hoisted: `sk` and `elInfo` are closure constants, so the chain is
    // too. Building it inside the get trap put a string concat and an
    // array allocation on every element read — memo hit or not, since
    // the argument is evaluated before makeNode can return the cached
    // node. Measured +46% on a 200-row collection sweep.
    const allChain = _allChain(elInfo, sk);
    // Latched, NOT a Set.add per read. These only ever go false->true,
    // and the arrayProxy is memoized per store key, so a 200-row sweep
    // was doing 200 redundant hash inserts against the same key on the
    // read path this file has already paid a hoist to protect.
    let markedById = false, markedByIx = false;
    // Hoisted with `allChain`, and for the same reason: these literals
    // were built inside the get trap, so every element read allocated a
    // throwaway object that makeNode discarded on a memo hit. `sp`,
    // `sk` and `elInfo` are closure constants, so both shapes are too.
    // The nested branch previously passed the parent's elInfo BY
    // REFERENCE with zero allocation; adding `allKeys` introduced the
    // copy, which is the cost the hoist above exists to prevent.
    const nestedInfo = elInfo === undefined || elInfo === null ? null
      : { solidPath: elInfo.solidPath, storeKey: elInfo.storeKey, allKeys: allChain };
    // `arrayFrame` marks the ONE elInfo whose storeKey is an ARRAY, not
    // an element: writes inside an index-addressed element ride the
    // whole-array frame. stageAt's element route writes that frame
    // directly, bypassing stageArray — so it is the one place that has
    // to retire an `#x` index stageArray may have made authoritative.
    const idxInfo = { solidPath: sp, storeKey: sk, allKeys: allChain, arrayFrame: true };

    // ONE persistence entry point for every mutator on this array.
    //
    // Inside an element, the write rides that element's frame and the
    // array has no representation of its own. Otherwise stageArray owns
    // the choice of format AND the `#x` index that selects it — no
    // caller decides either any more.
    const persist = (changed) => {
      // `null`, not `arr()`: stageAt's element branch stages a
      // DeferredFrame and never looks at the value, so resolving the
      // array was a full root-to-leaf walk (plus `|| []` on a miss) per
      // mutation of any nested array, for an argument thrown away.
      // The element frame rides the policy of the element's own key.
      // deleteProperty added exactly this gate one round earlier; the
      // array mutators were missed, so `s.secrets[0].tags.push('b')`
      // wrote a `persist: false` element to disk.
      if (elInfo) {
        if (persists(elInfo.storeKey)) { stageAt(sp, sk, elInfo, null); scheduleFlush(); }
        return;
      }
      stageArray(sk, arr(), changed);
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
      // INDEX-addressed holders subscribe to dotted keys (`rows.1.v`),
      // which the per-index bumps below cannot reach. reorderBy and
      // bumpReplaced both diff by slot for exactly this; splice did not,
      // so a held proxy for a shifted slot went permanently stale.
      const ixSlots = elemProxiedByIx.has(sk) ? a.slice() : null;
      // CLASSIFY BEFORE MUTATING. `a` is the tree's array and both
      // branches below splice it IN PLACE, so `_isColl(a)` after the
      // mutation reports the POST-splice shape. Reading it late made a
      // cold collCache classify `[{...}]` spliced to `[5]` as a
      // non-collection, and the removed element's frame was then never
      // tombstoned — it orphaned on disk with its version signals
      // leaked, visibly only as `pending()` being 1 instead of 2.
      // Computed ONLY when something is actually being removed. The
      // previous form ran `_isIdColl(a)` in BOTH arms of the cache
      // check, so a push burst — which removes nothing — paid a full
      // array scan per push: the O(n) rescan collCache exists to avoid.
      //
      // `_isIdColl`, not `_isColl`: this gates ID-ADDRESSED cleanup, a
      // question about the element FORMAT, not about addressing. On an
      // array where only some elements carry an `_id`, `_isColl` is true
      // and a removed element's id then deletes the version signals of
      // the INDEX-addressed element at the same numeric key.
      // Two independent conditions, and the last change collapsed them
      // into one and lost the second:
      //   `delCount > 0` — nothing is being removed on an append, so the
      //     scan is skipped entirely. This is the perf half.
      //   `cached !== false` — collCache latching FALSE means the array
      //     is INDEX-addressed, whatever its elements look like now. An
      //     array that degraded and came back can satisfy `_isIdColl`
      //     while its children are still reached at `sk.<index>`, and
      //     releasing by id then deletes a LIVE index's signals.
      // Dropping the second was not needed for the first.
      const cachedColl = collCache.get(sk);
      const wasColl = (!elInfo && delCount > 0 && cachedColl !== false)
        ? _isIdColl(a) : false;
      let ins = items;
      if (!elInfo) {
        seedIds(sk, items);
        ins = items.map((e) => (_isObj(e) && e._id == null
          ? { ...e, _id: genId(sk) } : e));
      }
      // Append (push) is the hot path: set the new indices directly so
      // it costs O(items), not an O(n) produce-splice over the whole
      // tracked array. Any other splice (mid-array, deletion) takes the
      // general produce route.
      if (delCount === 0 && start === len && ins.length > 0) {
        // `force`: setAt's no-op guard (`old === value`) is right for
        // hydration and faultIn, but an append past the end reads `old`
        // as undefined, so `push(undefined)` matched it and the array
        // never grew.
        for (let i = 0; i < ins.length; i++) setAt([...sp, len + i], ins[i], sk, true, true);
      } else {
        mutateAt(sp, (x) => { x.splice(start, delCount, ...ins); });
      }
      // Per-index notification: everything from `start` onward may have
      // shifted, and the length changed. Indices before `start` are
      // untouched, so their readers are left alone — that is the whole
      // point of tracking per index.
      notify(() => {
        bumpIndices(sk, start, Math.max(len, arr().length));
        bumpKey(_len(sk)); bumpKey(_all(sk));
        bumpOwners(elInfo);
        if (ixSlots !== null) {
          const m = Math.max(ixSlots.length, a.length);
          for (let i = start; i < m; i++) bumpReplaced(_join(sk, i), ixSlots[i], a[i]);
        }
        // IN THIS BATCH. A second notify() is a second update cycle, so a
        // subscriber both reach re-ran twice for one mutation — the
        // defect batching exists to prevent, reintroduced by the commit
        // that consolidated these four call sites.
        if (!elInfo) releaseElements(sk, removed, wasColl);
      });
      // Tombstone removed records + drop their memoized proxies. Gated
      // on the PRE-splice collection-ness, not the post-splice state, so
      // a splice that empties or degrades the array still releases the
      // element frames it wrote — while a non-collection array never
      // enters here at all.
      //
      // That gate is load-bearing for correctness, not just for waste. A
      // MIXED array (some elements carrying caller-supplied `_id`s, one
      // primitive) is not a collection, so its children are addressed by
      // INDEX — `items.1.a`. Splicing out the element whose `_id` is '1'
      // would then have pruned every `items.1.*` signal, silently
      // killing index-1's live subscribers. Same id-vs-index collision
      // the memo key namespace fixed for nodeMemo.
      // What addressing applies GOING FORWARD — a different question
      // from `wasColl` above, and it must be answered on the POST-splice
      // array. `_isColl([])` is true, so an empty array pushed full of
      // objects promotes to a collection; reusing `wasColl` here would
      // have blocked promotion for `[5]` spliced to `[{...}]`.
      let isColl = false;
      if (!elInfo) {
        const cached = collCache.get(sk);
        isColl = cached === undefined ? _isColl(a) : cached;
        if (isColl) isColl = ins.every(_isObj);
        collCache.set(sk, isColl);
      }
      // Only the INSERTED records need re-encoding; stageArray decides
      // the format and maintains `#x`. A push that used to re-encode the
      // whole collection was 99.8% wasted bytes.
      persist(ins);
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
      const a = arr();                  // one resolve; mutated in place
      const before = a.length;
      // Snapshot the elements when a holder could be affected.
      //
      // INDEX-addressed proxies subscribe to dotted keys (`rows.0.v`),
      // which the per-index bumps below cannot reach — a reverse moved a
      // different element under `rows.0` and its holder kept serving the
      // old one.
      //
      // ID-addressed proxies need nothing for sort/reverse: they follow
      // their element across a move, which is the point of stable ids.
      // But `indexOnly` is false for fill/copyWithin, and those REPLACE
      // elements — the element a proxy is addressed by stops existing.
      // Treating the whole family as "only moves things" left a
      // subscriber on a destroyed element serving its value forever.
      const byIx = elemProxiedByIx.has(sk);
      const byId = !indexOnly && elemProxiedById.has(sk);
      // The array WAS id-addressed — a different question from "does a
      // proxy exist", and the one the persistence cleanup below turns
      // on. Gating the tombstone on proxy existence conflated
      // reactivity with storage, which is the same mistake the
      // tombstone/dropMemo split in splice exists to record.
      const wasIdColl = !elInfo && !indexOnly && _isIdColl(a);
      const slots = (byIx || byId || wasIdColl) ? a.slice() : null;
      mutateAt(sp, fn);
      // Ids that this mutation destroyed — only reachable when elements
      // are replaced, i.e. fill / copyWithin.
      // Gated on ID ADDRESSING, exactly as splice's removal block is.
      // On an INDEX-addressed array the children are `rows.1.v`, so
      // pruning "the removed element's id 1" deletes index 1's live
      // signals and orphans their subscribers — the same id-vs-index
      // collision the memo-key namespace fixed, reintroduced next to the
      // comment describing it.
      let goneIds = null;
      if (wasIdColl && slots !== null) {
        const live = new Set();
        for (let i = 0; i < a.length; i++) {
          const e = a[i];
          if (_isObj(e) && e._id != null) live.add(String(e._id));
        }
        for (let i = 0; i < slots.length; i++) {
          const e = slots[i];
          if (!_isObj(e) || e._id == null) continue;
          const id = String(e._id);
          if (!live.has(id)) (goneIds === null ? (goneIds = new Set()) : goneIds).add(id);
        }
      }
      notify(() => {
        bumpIndices(sk, 0, Math.max(before, a.length));
        bumpKey(_len(sk)); bumpKey(_all(sk));
        bumpOwners(elInfo);
        if (byIx) {
          const m = Math.max(slots.length, a.length);
          for (let i = 0; i < m; i++) bumpReplaced(_join(sk, i), slots[i], a[i]);
        }
        // In this batch, for the same reason as splice's.
        if (goneIds !== null) {
          const gone = [];
          for (let i = 0; i < slots.length; i++) {
            const e = slots[i];
            if (_isObj(e) && e._id != null && goneIds.has(String(e._id))) gone.push(e);
          }
          releaseElements(sk, gone, true);
        }
        if (byId) {
          const now = new Map();
          for (let i = 0; i < a.length; i++) {
            const e = a[i];
            if (_isObj(e) && e._id != null) now.set(String(e._id), e);
          }
          for (let i = 0; i < slots.length; i++) {
            const e = slots[i];
            if (!_isObj(e) || e._id == null) continue;
            const id = String(e._id);
            bumpReplaced(_join(sk, id), e, now.get(id));
          }
        }
      });
      // Destroyed elements get the same treatment splice gives its
      // `removed` list: their proxies dropped and their version records
      // pruned, or they leak exactly as a spliced-out element would.
      // The elements fill / copyWithin destroyed. `slots` holds them as
      // they were, which is what releaseElements needs to notify holders.

      // fill / copyWithin can drop a primitive in and DEGRADE the array;
      // sort / reverse cannot. Either way the cached classification is
      // re-derived rather than trusted — this was the one mutator that
      // never maintained collCache, and a stale `true` after a `fill`
      // made the next push erase the primitives on reopen.
      // `a` is the live array, mutated in place — no need to re-resolve
      // from the root, which is the hoist this function already paid for
      // `before` and `slots`. sort/reverse cannot change collection-ness,
      // so a warm cache stands; fill/copyWithin can, so it is re-derived.
      if (!elInfo) {
        const warm = indexOnly ? collCache.get(sk) : undefined;
        collCache.set(sk, warm === undefined ? _isColl(a) : warm);
      }
      // `indexOnly` (sort / reverse) keeps every element's bytes and only
      // moves them, so nothing needs re-encoding — but stageArray still
      // has to rewrite the index that records the ORDER.
      persist(indexOnly ? EMPTY : undefined);
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
        if (key === 'length') { verFor(_len(sk))(); return arr().length; }
        if (typeof key === 'string' && Object.hasOwn(mutators, key)) {
          return mutators[key];
        }
        if (_isNumKey(key)) {
          verFor(_ix(sk, key))();
          // `arr()` is one resolve for the whole trap; indexing it is a
          // plain property read. The arrayProxy hot path is rarely a
          // bottleneck — arrays are iterated via <For>, not read in
          // tight loops.
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
              // Memoize in a SEPARATE namespace from index-addressed
              // nodes: both produce `items.<n>`, and generated ids start
              // at 1, so element _id '1' collided with index 1 and the
              // memo handed back the wrong element. The store key is
              // untouched, so nothing on disk moves.
              if (!markedById) { markedById = true; elemProxiedById.add(sk); }
              return makeNode(elSp, elSk,
                { solidPath: elSp, storeKey: elSk, allKeys: allChain },
                false,
                elSk + '\u0000id');
            }
            const childSk = _join(sk, key);
            const idxSp = [...sp, i];
            if (elInfo) {
              // Nested array (or non-collection array) inside an existing
              // element — writes ride that element's frame. The elInfo is
              // rebuilt rather than reused so `allKeys` gains THIS
              // array's `#all`: a write under `list[0].tags[2]` has to
              // wake iterators of `tags` and of `list`.
              // Index-addressed, exactly like the non-element branch
              // below — so a wholesale replace of THIS array has to diff
              // by slot to reach a holder. Marking only the outer case
              // left `s.list[0].tags = [...]` silently stale.
              if (!markedByIx) { markedByIx = true; elemProxiedByIx.add(sk); }
              return makeNode(idxSp, childSk, nestedInfo, Array.isArray(el));
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
            // INDEX-ADDRESSED, so a wholesale replace has to diff by
            // slot to reach a holder of this proxy — the same defect the
            // id diff fixes for collections.
            if (!markedByIx) { markedByIx = true; elemProxiedByIx.add(sk); }
            return makeNode(idxSp, childSk, idxInfo, Array.isArray(el));
          }
          return el;
        }
        // Inherited read methods (map/filter/forEach/find/join/…) and
        // Symbol.iterator, which is what `for..of` and spread use. These
        // touch no index, so without this they registered NO dependency
        // and the consumer never re-ran. Subscribing to the whole-array
        // key is coarser than per-index and necessarily so: the callback
        // reads raw values off a plain array, out of reach of any trap.
        verFor(_all(sk))();
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
          const a = arr();                 // one resolve for the trap
          let removed = null;
          if (!elInfo && newLen < a.length) {
            const cached = collCache.get(sk);
            const wasColl = cached !== false && _isIdColl(a);
            if (wasColl) removed = a.slice(newLen);
          }
          const oldLen = a.length;
          const ixSlots = elemProxiedByIx.has(sk) ? a.slice() : null;
          mutateAt(sp, (x) => { x.length = newLen; });
          notify(() => {
            bumpIndices(sk, Math.min(oldLen, newLen), Math.max(oldLen, newLen));
            bumpKey(_len(sk)); bumpKey(_all(sk));
            bumpOwners(elInfo);
            // Same by-slot diff splice needs: a truncation leaves a held
            // index-addressed proxy subscribed to a key nothing bumps.
            if (ixSlots !== null) {
              const m = Math.max(ixSlots.length, a.length);
              for (let i = Math.min(oldLen, newLen); i < m; i++) {
                bumpReplaced(_join(sk, i), ixSlots[i], a[i]);
              }
            }
            if (removed) releaseElements(sk, removed, true);
          });
          // Truncate/extend may DEGRADE the format, so the cache has to
          // be re-derived — but a plain `delete` also lets it PROMOTE,
          // and promotion re-keys every element proxy already handed
          // out (`items.1` -> `items.<id>`). A held proxy then bumps a
          // signal nobody reads: `s.items[1] !== el` after truncating an
          // array that had degraded and become all-objects again, and a
          // write through either one is invisible to the other. Only the
          // length setter re-derived here; splice leaves the latch
          // alone, which is why splice never detached anything.
          // Degrading is forced by the data. Promoting is not.
          if (collCache.get(sk) !== false) collCache.delete(sk);
          // Truncating drops elements and extending punches holes;
          // either can change the format, and stageArray decides which.
          // But NO surviving element's bytes change — only membership,
          // which lives in `#x` — so nothing needs re-encoding. Passing
          // `undefined` re-encoded every survivor: `length = 40` on a
          // 50-element collection staged 52 frames where a push stages 3.
          persist(EMPTY);
          // Truncate/extend can change values at any index — notify with
          // descendants so element-path observers see the change.
          if (_skalEffectMap.size > 0) _skalNotify(sk, true);
          return true;
        }
        if (_isNumKey(key)) {
          const i = +key;
          // ONE resolve for the trap. `a` is the live array object and
          // setAt writes into it in place, so reading `a.length` after
          // the write is correct AND free — where `arr()` re-walked from
          // the root for each of the five reads this path used to do.
          // The one shape where `a` is NOT the tree's array is when the
          // path resolves to nothing and `arr()`'s `|| []` hands back a
          // detached empty array. That case is degenerate either way:
          // setAt then vivifies a plain object, which has no `length`,
          // so the pre-hoist code computed `grewTo === undefined` and
          // looped to NaN. Hoisting makes it a no-growth notification
          // instead, which is at least defined.
          const a = arr();
          const old = a[i];
          let v = value;
          if (!elInfo && _isObj(value)) {
            if (value._id == null) {
              v = { ...value, _id: (old && old._id != null) ? old._id : genId(sk) };
            } else {
              seedIds(sk, [value]);   // caller id kept: genId must clear it
            }
          }
          const grewFrom = a.length;
          // `force` when the slot does not exist yet. setAt's no-op
          // guard reads `old` as undefined for a slot past the end, so
          // `rows[5] = undefined` matched it and the array never grew —
          // the same defect the flag was added to fix for push, at its
          // sibling call site.
          setAt([...sp, i], v, sk, true, i >= grewFrom);
          const grewTo = a.length;
          // Derived BEFORE the notify because the element bump needs it.
          // Same incremental maintenance as before: a single index
          // assign can only DEGRADE collection-ness.
          let coll = false;
          if (!elInfo) {
            const cached = collCache.get(sk);
            coll = cached === undefined ? _isColl(a) : cached;
            if (coll && !_isObj(v)) coll = false;
            collCache.set(sk, coll);
          }
          // BATCHED, like every other array mutation. Unbatched, the two
          // bumps below are two update cycles (every version signal is
          // `equals:false`), so one index assign re-ran a consumer that
          // both indexed and iterated the array TWICE.
          notify(() => {
            if (grewTo !== grewFrom) {
              // Assigning past the end grows `length`; every other
              // length-changing path remembers to say so.
              bumpArray(sk, Math.min(grewFrom, i), Math.max(grewTo, i + 1));
            } else {
              bumpKey(_ix(sk, i));          // exactly this slot…
              bumpKey(_all(sk));            // …plus anything iterating
            }
            // A nested array's own mutation still has to wake iterators
            // of the arrays it sits inside.
            bumpOwners(elInfo);
            // THE SLOT'S ELEMENT WAS REPLACED. `_ix` above reaches index
            // readers, but a held element proxy subscribes to DOTTED
            // keys — `rows.<id>.v` when the array is a collection,
            // `rows.<i>.v` otherwise — and nothing above touches those.
            // `arr[0] = {v:99}` reuses the old element's `_id`, so the
            // proxy still resolves and still served the stale value.
            // Both schemes, INDEPENDENTLY — not either/or. An element
            // that had no `_id` hands out an INDEX-addressed proxy, and
            // this very write then mints an id for its replacement, so
            // the subscriber is on `rows.0.v` while the new value lives
            // at `rows.<id>`. Notifying only by the post-write scheme
            // missed it.
            if (elemProxiedByIx.has(sk)) bumpReplaced(_join(sk, i), old, v);
            if (coll && elemProxiedById.has(sk)) {
              const oldK = _isObj(old) && old._id != null ? _join(sk, old._id) : null;
              const newK = _isObj(v) && v._id != null ? _join(sk, v._id) : null;
              if (oldK !== null && oldK === newK) bumpReplaced(oldK, old, v);
              else {
                if (oldK !== null) bumpReplaced(oldK, old, undefined);
                if (newK !== null) bumpReplaced(newK, undefined, v);
              }
            }
          });
          // The slot's previous element is destroyed when the new value
          // carries a DIFFERENT id (or none). splice, truncate and
          // reorderBy all tombstone + drop + prune in that case; this
          // path left the frame, the memo entry and the signals behind.
          // `coll` and both keys are already computed above.
          // The slot's previous element is destroyed when the new value
          // carries a DIFFERENT id (or none). `_isIdColl(a)` — the
          // FORMAT question — not `coll`, which answers addressing: on
          // an array where only some elements carry an id, `coll` is
          // true while children are index-addressed, and releasing by
          // id then deletes index-N's signals. This was the last of the
          // four sites still on the addressing predicate.
          // NOTE the notify block above already bumped this element via
          // the id diff, so releaseElements must not bump it again — its
          // notification is skipped here by passing the already-notified
          // element through `alreadyNotified`. One index assign is one
          // re-run; a duplicate bump outside the batch made it two.
          if (!elInfo && _isObj(old) && old._id != null) {
            const newId = _isObj(v) && v._id != null ? String(v._id) : null;
            if (String(old._id) !== newId) {
              // `_isIdColl`, not `_isColl` — the FORMAT question, as at
              // the other three release sites.
              //
              // NO TEST DISTINGUISHES THIS, and none can: the shape
              // where the two predicates differ (all objects, not all
              // id-carrying) requires a caller-supplied id, which sets
              // `sawCallerIds`, which makes pruneVersRecords early-
              // return — so only the memo eviction differs and that
              // changes no value. Checked, not assumed. It stays
              // because the other three sites ask the same question
              // this way, and a fourth asking it differently is how
              // every drift in this family has started.
              releaseElements(sk, [old], coll && _isIdColl(a), true);
            }
          }
          // Only this slot's element can need re-encoding. stageArray
          // handles both directions the old inline branch got wrong: a
          // DEGRADING assign (object -> primitive) left the `#x` index
          // in place so the blob was masked on reopen, and a PROMOTING
          // one wrote `k:sk.<id>` with no index for hydrateArray to find
          // it by, orphaning the frame.
          persist(_isObj(v) ? [v] : EMPTY);
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
      const structural = _isNode(decoded) || _isNode(old);
      // Same no-op guard setAt has, for the same reason: a persisted
      // value equal to the default in initState is not news, and on a
      // large store this woke every subscriber at cold start.
      if (!structural && old === decoded) return;
      live[k] = decoded;
      if (structural) { structGen++; bumpReplaced(sk, old, decoded); }
      else bumpKey(sk);
      // Declared-dep effects too. This is the fast path EVERY eagerly
      // hydrated leaf takes, and it woke Solid's signals but not
      // `_skalEffectMap` — so `createEffect(['user.name'])` rendered the
      // initState default forever while a Solid effect on the same path
      // updated. Same defect as setAt's, one level down; fixing setAt
      // alone left the common case broken.
      if (sk && _skalEffectMap.size > 0) _skalNotify(sk, _isNode(decoded));
      return;
    }
    setAt([...sp, k], decoded, sk);          // shapes diverged — walk it
  }
  const _liveChild = (live, k) =>
    (live !== null && typeof live === 'object') ? live[k] : undefined;

  function hydrate(node, sp, sk, live) {
    // Scalar leaves at this level are collected and read in ONE call.
    // Hydration reads every leaf of a subtree at open, and the per-record
    // boundary crossing was the largest single term in a cold load —
    // 51% of the attributed time, against 17% for JSON decode.
    const lk = [], lsk = [], ldk = [];
    for (const k of Object.keys(node)) {
      const v = node[k];
      const childSk = _join(sk, k);
      // Flag-gated like every other hot policy lookup. Ungated, a
      // 5000-leaf store with no `paths` configured allocated 5000 policy
      // objects and inserted 5000 permanent policyCache entries during
      // cold-start hydration — for the default {persist:true,lazy:false}
      // that the rest of the file simply assumes.
      const pol = policyOf(childSk);
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
        //
        // Left as a single get: it is one frame per subtree, not per
        // leaf, so there is nothing here to amortise.
        let recurse = true;
        if (pol.persist && !pol.lazy && !dirty.has(dk)
            && (diskKeys === null || diskKeys.has(dk))) {
          const b = engine.get(dk);
          if (b != null) {
            const decoded = decodeFrame(b);
            writeHydrated(live, sp, k, childSk, decoded);
            if (!_isObj(decoded)) {
              recurse = false;
              // `pendingDelPrefix.add`, NOT delPrefixLater.
              // delPrefixLater also purges staged descendants, on the
              // argument that they predate the write invalidating them.
              // Here they do not: the invalidating value came off DISK,
              // and `dirty` may hold an app write made during the async
              // init window (the proxy is returned before init
              // finishes). doFlush runs delPrefix and then writes
              // `dirty` on top, which is the order that keeps it.
              // Counted, like every other registration. It cannot go
              // through delPrefixLater — that also purges staged
              // descendants, and here the invalidating value came off
              // DISK, so an app write made during the async init window
              // must survive. But it costs the same full-keydir scan at
              // flush, so it reaches the same counter.
              if (engine.delPrefix) { prefixSweeps++; pendingDelPrefix.add(childSk); }
            }
          }
        }
        if (recurse) hydrate(v, [...sp, k], childSk, _liveChild(live, k));
        continue;
      }
      if (!pol.persist || pol.lazy) continue;   // lazy leaf → faults on access
      if (dirty.has(dk)) continue;              // app already wrote it
      lk.push(k); lsk.push(childSk); ldk.push(dk);
    }
    if (lk.length === 0) return;

    // ONE REPRESENTATION, both branches: a decoded value plus a
    // parallel presence flag.
    //
    // This used to hand back raw scratch views below 256 keys and
    // decoded values above it, distinguished by a `preDecoded` flag, so
    // the presence test was `b != null` in one case and a sentinel
    // comparison in the other. Two contracts behind a boolean, on a path
    // whose entire bug class is "the wrong bytes land" — and only one of
    // the two would be exercised by any given store size. Decoding
    // eagerly in both costs nothing: the small branch decoded on the
    // very next line anyway.
    //
    // PRESENCE, NOT VALUE. Testing the decoded value for null conflated
    // "key missing" with "stored value IS null", and a persisted null
    // came back as the initState default.
    //
    // DECODE BEFORE ANY FURTHER READ. The slices are views over the
    // engine's REUSABLE SCRATCH and stay valid only until the next
    // get/getMany, so recursing while any slice is undecoded would hand
    // back another record's bytes. JSON.parse yields independent values,
    // after which the scratch is free.
    // DRIVEN BY WHAT IS ON DISK, not by the shape of initState.
    //
    // Every declared leaf used to be probed, so a 4 500-leaf store whose
    // `cells` object persists as ONE blob performed 4 500 keydir lookups
    // across 18 batch crossings against a keydir holding a single record
    // — measured at +27 ms of a +34 ms cold start. `diskKeys` is fetched
    // once per open; when the host cannot provide it the probe falls
    // back to asking for everything, which is the old behaviour.
    if (diskKeys !== null) {
      let w = 0;
      for (let i = 0; i < ldk.length; i++) {
        if (!diskKeys.has(ldk[i])) continue;
        lk[w] = lk[i]; lsk[w] = lsk[i]; ldk[w] = ldk[i]; w++;
      }
      lk.length = w; lsk.length = w; ldk.length = w;
    }
    const vals = new Array(ldk.length);
    const has = new Array(ldk.length);
    for (let i = 0; i < ldk.length; i += CHUNK) {
      // No copy when the level fits in one chunk — the common case, and
      // this is the cold-start path. The loop only reaches i > 0 when
      // `ldk.length > CHUNK`, so the length test alone is the condition.
      const part = engine.getMany(
        ldk.length <= CHUNK ? ldk : ldk.slice(i, i + CHUNK));
      for (let j = 0; j < part.length; j++) {
        const b = part[j];
        const at = i + j;
        has[at] = b != null;
        if (has[at]) vals[at] = decodeFrame(b);
      }
    }
    for (let i = 0; i < lk.length; i++) {
      if (!has[i]) continue;
      const decoded = vals[i];
      writeHydrated(live, sp, lk[i], lsk[i], decoded);
      // Symmetric to the object branch: the persisted shape may have
      // upgraded (initState declared `config: ""`, the app later wrote
      // `state.config = {complex: 'obj'}` and then a deeper leaf
      // override at `k:config.complex`). Recurse on the loaded shape so
      // those overlays land.
      if (_isObj(decoded)) {
        hydrate(decoded, [...sp, lk[i]], lsk[i], _liveChild(live, lk[i]));
      }
    }
  }

  // CHUNKED. The native batch sizes its scratch to the whole request and
  // only ever grows it, so an unchunked level would leave the store
  // holding its largest payload for the process lifetime — set by the
  // widest object in initState, on mobile. 256 keys keeps the crossing
  // amortised while bounding the retained buffer.
  //
  // Shared by BOTH hydration paths: collection elements were read one at
  // a time, so the bound only applied to half of hydration.
  const CHUNK = 256;

  function hydrateArray(sp, sk) {
    // Flag-gated like hydrate's: a store of 500 collections otherwise
    // allocated 500 policy objects and 500 permanent policyCache
    // entries at cold start, which is the cost the sibling gate was
    // added to remove.
    if (!policyOf(sk).persist
      || dirty.has('k:' + sk + '#x') || dirty.has('k:' + sk)) return;
    collCache.delete(sk);                  // array replaced — re-derive later
    // The same guard the scalar path gets, but on the READS only —
    // never as an early return. `collCache.delete` above and the
    // shape-divergence handling below run regardless of what is on
    // disk, and skipping the whole function broke three seeded-
    // collection tests. Without this a store declaring 500 collections
    // with nothing persisted still performs 1000 point lookups at open:
    // the identical O(declared) pattern, one function over.
    // Hoisted: a closure per collection plus two `has` lookups each was
    // the same O(declared) cold-start waste the gate exists to remove.
    const bk = 'k:' + sk;
    const ixk = bk + '#x';
    const hasIx = diskKeys === null || diskKeys.has(ixk);
    const hasWhole = diskKeys === null || diskKeys.has(bk);
    const idxBytes = hasIx ? engine.get(ixk) : null;
    // Element frames may predate this process; the blob path needs to
    // know they exist before it can decide whether to sweep them.
    if (idxBytes != null) hadElementFrames.add(sk);
    if (idxBytes != null) {                          // a persisted collection
      const idx = decodeFrame(idxBytes);             // { ids, nextId }
      nextIds.set(sk, idx.nextId || 1);
      // BATCHED, like the scalar path. One boundary crossing per
      // element is the term the scalar path was chunked to avoid — 51%
      // of a cold load — and a 500-element collection was paying 500 of
      // them here, uncounted, in the function this change optimises.
      const ids = idx.ids || [];
      const els = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK).map((id) => 'k:' + _join(sk, id));
        const got = engine.getMany(part);
        for (let j = 0; j < got.length; j++) {
          if (got[j] != null) els.push(decodeFrame(got[j]));
        }
      }
      setAt(sp, els, sk);
      return;
    }
    const whole = hasWhole ? engine.get(bk) : null;          // whole-frame array
    if (whole != null) {
      const arr = decodeFrame(whole);
      // SEED FROM WHAT CAME OFF DISK. A blob-persisted array restores
      // its elements' ids without touching nextIds, so the first push
      // after a reopen reissued one of them. The index-frame branch
      // above gets this from `idx.nextId`; this branch had nothing.
      if (Array.isArray(arr)) seedIds(sk, arr, false);
      setAt(sp, arr, sk);
      return;
    }

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
      const cacheKey = dataDir + '/' + cfg.name;
      if (typeof globalThis.__skal_store_open === 'function' && dataDir) {
        // Native open can fail (disk full, sandbox denied us write, the
        // dir path is bogus). Don't let that pin us to memory-only —
        // fall through to the JS LogStore so we still get real
        // persistence (memory-only is a LAST resort, not the first
        // non-native fallback).
        // REUSE the handle across hot-reload generations.
        //
        // A reload re-evaluates the bundle, so this init() runs again and
        // opens the SAME directory again. `__skal_store_open` does no
        // dedup and there is no store_close in the native layer, so every
        // reload used to strand another SkalStore — mmap and keydir — for
        // the life of the process. Measured on device: 8 bundle evals ->
        // 8 createSkalStore calls, 1:1, none of them releasable.
        //
        // The engine is stateless with respect to the JS tree (the proxies
        // and signals are rebuilt per generation regardless), so handing
        // the new generation the existing handle is both correct and the
        // only way to avoid the leak without a native free. It also
        // removes the second hazard: two live handles on one directory,
        // where the outgoing generation's debounced flush could write
        // through a keydir the incoming one knows nothing about.
        const reg = (globalThis.__skalStoreEngines ||= new Map());
        try {
          let ns = reg.get(cacheKey);
          if (!ns) {
            ns = new NativeLogStore(cacheKey);
            ns.open();
            reg.set(cacheKey, ns);
          }
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
        // Same generation-reuse as the native branch above. This is the
        // path the iOS simulator actually takes, so a fix applied only to
        // the native branch would have looked right and changed nothing —
        // the probe reported `engine handles alive: n/a` because the
        // registry was never reached.
        const reg = (globalThis.__skalStoreEngines ||= new Map());
        let ls = reg.get(cacheKey);
        if (!ls) {
          const backend = await openBackend(cacheKey);
          ls = new LogStore(backend);
          ls.open();
          ls._skalBackendKind = backend.kind;
          reg.set(cacheKey, ls);
        }
        engine = ls;
        setBackendKind(ls._skalBackendKind);
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
      // ONE flush for the whole open. Un-batched, an N-leaf hydration
      // scheduled N separate update cycles on the cold-start path.
      if (!migrated) {
        // One listing per open, and ONLY when hydrate will run — the
        // migration path does not, so building it there was pure waste
        // on a launch path. Its own try/catch: init's catch-all treats
        // failures as non-fatal, so a throw here would skip hydration
        // entirely and every value would silently revert to its
        // initState default.
        try {
          diskKeys = (engine && engine.allKeys) ? engine.allKeys() : null;
        } catch (_) { diskKeys = null; }
        // FINALLY: hydrate can throw — decodeFrame JSON.parses raw
        // bytes, and a torn frame raises. init's catch-all treats that
        // as non-fatal, so without this the listing stayed pinned for
        // the life of the store, which is the leak the release exists
        // to prevent.
        //
        // No test distinguishes the `finally` from a plain sequence, and
        // none can: the two differ only on the throw path, and what
        // differs there is retained memory, which nothing observable
        // reports. Checked, not assumed.
        const reads0 = engine ? engine.reads : 0;
        try { notify(() => hydrate(initState, [], '', root)); }
        finally {
          hydrateProbes = (engine ? engine.reads : 0) - reads0;
          diskKeys = null;
        }
      }
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
