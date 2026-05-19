// store.js — createSkalStore: the reactive layer over the log engine.
//
// Two element kinds, declared in a schema:
//   • scalar     — one keyed value (settings, a counter, a doc).
//   • collection — many records, each its own keyed frame. The RECORD
//                  is the unit of storage + dirty-tracking, so editing
//                  one record writes one small frame, never the whole
//                  collection.
//
// Per-element flags: `persist` (default true — false ⇒ memory-only,
// never touches disk) and `lazy` (default false — true ⇒ not loaded at
// open, loaded on an explicit `.load()`).
//
// Writes are coalesced into a debounced batch: a burst of N mutations
// becomes one engine flush. Reads are pure in-memory Solid signal
// reads — they never touch the engine.

import { createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { LogStore, NativeLogStore, openBackend } from './engine.js';
import { encodeValue, decodeValue } from './codec.js';
import { getAppDataDir } from '../../bridge.js';

// Hot-path value codec — a compact binary format (see codec.js), not
// JSON. decodeValue() still reads legacy JSON-encoded values, so an
// existing on-disk store keeps loading.
const _encVal = (v) => encodeValue(v);
const _decVal = (b) => decodeValue(b);

const FLUSH_DEBOUNCE_MS = 60;
// A record updated this many times accumulates that many delta frames;
// past the cap update() collapses the chain back into one snapshot, so
// a load never replays an unbounded chain.
const DELTA_MAX_CHAIN = 8;
// Default window size for a collection without an explicit `window:` —
// how many record bodies are materialized into RAM at once.
const WINDOW_DEFAULT = 200;

// Fetch the host's writable directory, retried — the RPC dispatcher may
// not be installed for the first few ticks after the JS bundle runs.
async function fetchDataDir() {
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

export function createSkalStore(schema) {
  let engine = null;
  const [ready, setReady] = createSignal(false);
  const [backendKind, setBackendKind] = createSignal('…');
  const [backendDiag, setBackendDiag] = createSignal('initializing…');
  const [initError, setInitError] = createSignal('');
  const [statsTick, setStatsTick] = createSignal(0);
  const bumpStats = () => setStatsTick((n) => n + 1);

  // Pending writes — engineKey → bytes (or null to delete). A Map, so
  // repeated writes to the same key coalesce automatically (last wins).
  const dirty = new Map();
  let flushTimer = null;
  let flushCount = 0;
  let lastFlushMs = 0;

  const scalars = {};      // name → { sig:[get,set], persist, lazy, def }
  const collections = {};  // name → collection state

  for (const name of Object.keys(schema)) {
    const el = schema[name];
    const persist = el.persist !== false;
    const lazy = !!el.lazy;
    if (el.kind === 'collection') {
      // Windowed collection. The full index (order / idIndex / nextId)
      // is small and stays resident; record *bodies* are materialized
      // only for the current window — `records` is a Solid store proxy
      // holding just that slice, so RAM is bounded by the window, not
      // the collection size. `total` and `winStart` are signals so the
      // UI tracks the count and scroll position reactively.
      const [records, setRecords] = createStore([]);
      const [total, setTotal] = createSignal(0);
      const [winStart, setWinStart] = createSignal(0);
      collections[name] = {
        persist, lazy, loaded: false,
        records, setRecords,
        total, setTotal, winStart, setWinStart,
        winCount: (el.window | 0) > 0 ? (el.window | 0) : WINDOW_DEFAULT,
        order: [],              // every id, in collection order
        idIndex: new Map(),      // id → position in order[]
        deltaCount: new Map(),   // id → delta-chain length (materialized rows)
        nextId: 1,
      };
    } else {
      collections[name] = undefined;
      scalars[name] = { sig: createSignal(el.default), persist, lazy,
        def: el.default, loaded: false };
    }
  }

  // ── flushing ──────────────────────────────────────────────────────
  function scheduleFlush() {
    if (flushTimer != null) return;
    flushTimer = setTimeout(() => { flushTimer = null; doFlush(); },
      FLUSH_DEBOUNCE_MS);
  }

  function _now() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  function doFlush() {
    if (!engine || dirty.size === 0) return;
    const t0 = _now();
    for (const [key, bytes] of dirty) {
      if (bytes === null) engine.del(key);
      else engine.put(key, bytes);
    }
    dirty.clear();
    engine.flush();
    flushCount++;
    lastFlushMs = _now() - t0;
    bumpStats();
  }

  function flushNow() {
    if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null; }
    doFlush();
  }

  // ── scalars ───────────────────────────────────────────────────────
  function getScalar(name) {
    const s = scalars[name];
    return s ? s.sig[0]() : undefined;
  }
  function setScalar(name, value) {
    const s = scalars[name];
    if (!s) return;
    s.sig[1](() => value);
    if (s.persist) { dirty.set('s:' + name, _encVal(value)); scheduleFlush(); }
  }
  function loadScalar(name) {
    const s = scalars[name];
    if (!s || !engine) return;
    const b = engine.get('s:' + name);
    if (b != null) s.sig[1](() => _decVal(b));
    s.loaded = true;
  }

  // ── collections ───────────────────────────────────────────────────
  // A pending (unflushed) write must win over the persisted state — the
  // window can be re-materialized before the debounced flush lands.
  function readRaw(key) {
    return dirty.has(key) ? dirty.get(key) : (engine ? engine.get(key) : null);
  }

  // Build a record from its snapshot frame + replayed delta chain.
  // Returns { rec, deltaCount } or null when the record is absent.
  function readRecord(name, id) {
    const rb = readRaw('c:' + name + ':' + id);
    if (rb == null) return null;
    const rec = _decVal(rb);
    let n = 0;
    for (;;) {                              // probe d0,d1,… until a miss
      const db = readRaw('c:' + name + ':' + id + ':d' + n);
      if (db == null) break;
      Object.assign(rec, _decVal(db));      // shallow-merge each patch
      n++;
    }
    return { rec, deltaCount: n };
  }

  // Materialize the live window — records [winStart, winStart+winCount)
  // — into the reactive store. These are the only record bodies held as
  // JS objects; everything outside the window lives only on disk.
  function refreshWindow(c, name) {
    const start = Math.max(0, Math.min(c.winStart(), c.order.length));
    if (start !== c.winStart()) c.setWinStart(start);
    const end = Math.min(c.order.length, start + c.winCount);
    const win = [];
    for (let i = start; i < end; i++) {
      const r = readRecord(name, c.order[i]);
      if (r) { c.deltaCount.set(c.order[i], r.deltaCount); win.push(r.rec); }
    }
    c.setRecords(produce((arr) => {
      arr.length = 0;
      for (let i = 0; i < win.length; i++) arr[i] = win[i];
    }));
  }

  function loadCollection(name) {
    const c = collections[name];
    if (!c || !engine || c.loaded) return;
    c.loaded = true;
    const idxBytes = engine.get('c:' + name + ':#x');
    if (idxBytes != null) {
      const idx = _decVal(idxBytes);        // { ids, nextId } — index only
      c.nextId = idx.nextId || 1;
      c.order = Array.isArray(idx.ids) ? idx.ids.slice() : [];
      c.idIndex = new Map();
      for (let i = 0; i < c.order.length; i++) c.idIndex.set(c.order[i], i);
    }
    c.setTotal(c.order.length);
    refreshWindow(c, name);                 // materialize only the first window
  }

  function persistIndex(name, c) {
    if (!c.persist) return;
    dirty.set('c:' + name + ':#x',
      _encVal({ ids: c.order, nextId: c.nextId }));
  }

  function collectionHandle(name) {
    const c = collections[name];
    if (!c) throw new Error(`skal-store: no collection "${name}"`);

    const writeRec = (id, rec) => {
      if (c.persist) dirty.set('c:' + name + ':' + id, _encVal(rec));
    };

    const dkey = (id, n) => 'c:' + name + ':' + id + ':d' + n;

    // Append a delta frame — just the patch, not the whole record.
    const writeDelta = (id, patch) => {
      const n = c.deltaCount.get(id) || 0;
      if (c.persist) dirty.set(dkey(id, n), _encVal(patch));
      c.deltaCount.set(id, n + 1);
    };

    // Tombstone a record's whole delta chain (collapse / remove / clear).
    const dropDeltas = (id) => {
      const n = c.deltaCount.get(id) || 0;
      if (c.persist) {
        for (let k = 0; k < n; k++) dirty.set(dkey(id, k), null);
      }
      c.deltaCount.set(id, 0);
    };

    // A lazy collection must load its index before its first mutation —
    // otherwise add()/clear() would rewrite the index over records that
    // were never read in, losing them.
    const ensure = () => { if (c.lazy && !c.loaded) loadCollection(name); };

    const add = (record) => {
      ensure();
      const id = String(c.nextId++);
      const rec = { ...record, _id: id };
      const pos = c.order.length;
      c.order.push(id);
      c.idIndex.set(id, pos);
      c.deltaCount.set(id, 0);
      writeRec(id, rec);
      persistIndex(name, c);
      c.setTotal(c.order.length);
      // Show it immediately only when it lands inside the live window.
      if (pos >= c.winStart() && pos < c.winStart() + c.winCount) {
        c.setRecords(produce((arr) => { arr.push(rec); }));
      }
      scheduleFlush();
      return id;
    };

    // Batch insert — one store write + one flush for the whole batch.
    const addMany = (records) => {
      ensure();
      const ids = [];
      const winAppend = [];
      const ws = c.winStart(), we = ws + c.winCount;
      for (const record of records) {
        const id = String(c.nextId++);
        const rec = { ...record, _id: id };
        const pos = c.order.length;
        c.order.push(id);
        c.idIndex.set(id, pos);
        c.deltaCount.set(id, 0);
        writeRec(id, rec);
        ids.push(id);
        if (pos >= ws && pos < we) winAppend.push(rec);
      }
      persistIndex(name, c);
      c.setTotal(c.order.length);
      if (winAppend.length) {
        c.setRecords(produce((arr) => { for (const r of winAppend) arr.push(r); }));
      }
      scheduleFlush();
      return ids;
    };

    const update = (id, patch) => {
      ensure();
      const pos = c.idIndex.get(id);
      if (pos == null) return false;
      const wp = pos - c.winStart();
      const onScreen = wp >= 0 && wp < c.records.length;
      // The full current record + its chain length — needed to decide a
      // collapse. An on-screen row already has both; an off-screen one
      // is read back (snapshot + deltas) just for this.
      let fullRec, count;
      if (onScreen) {
        c.setRecords(wp, patch);            // reactive, fine-grained
        fullRec = c.records[wp];
        count = c.deltaCount.get(id) || 0;
      } else {
        const r = readRecord(name, id);
        if (!r) return false;
        Object.assign(r.rec, patch);
        fullRec = r.rec;
        count = r.deltaCount;
        c.deltaCount.set(id, count);
      }
      // Persist the *change*, not the record: append a small delta
      // frame. Once the chain hits the cap, collapse it back into one
      // fresh snapshot so a load never replays an unbounded chain.
      if (count >= DELTA_MAX_CHAIN) {
        dropDeltas(id);
        writeRec(id, fullRec);
      } else {
        writeDelta(id, patch);
      }
      scheduleFlush();
      return true;
    };

    const remove = (id) => {
      ensure();
      const pos = c.idIndex.get(id);
      if (pos == null) return false;
      const wp = pos - c.winStart();        // window slot, before the splice
      c.order.splice(pos, 1);
      c.idIndex.delete(id);
      // Rows after the hole shifted down one — reindex them.
      for (let k = pos; k < c.order.length; k++) c.idIndex.set(c.order[k], k);
      dropDeltas(id);                                  // tombstone the chain
      c.deltaCount.delete(id);
      if (c.persist) dirty.set('c:' + name + ':' + id, null); // tombstone snapshot
      persistIndex(name, c);
      c.setTotal(c.order.length);
      // Window maintenance. For an on-screen removal, splice the one row
      // and pull in at most one new tail row — no whole-window rebuild.
      if (wp >= 0 && wp < c.records.length) {
        const tailPos = c.winStart() + c.records.length - 1;
        let tailRec = null;
        if (tailPos < c.order.length) {     // a record exists past the window
          const r = readRecord(name, c.order[tailPos]);
          if (r) {
            c.deltaCount.set(c.order[tailPos], r.deltaCount);
            tailRec = r.rec;
          }
        }
        c.setRecords(produce((arr) => {
          arr.splice(wp, 1);
          if (tailRec) arr.push(tailRec);
        }));
      } else if (wp < 0) {
        refreshWindow(c, name);             // removal before the window
      }
      // wp past the window — nothing on screen changed.
      scheduleFlush();
      return true;
    };

    const clear = () => {
      ensure();
      for (const id of c.order) {
        dropDeltas(id);
        if (c.persist) dirty.set('c:' + name + ':' + id, null);
      }
      c.order = [];
      c.idIndex = new Map();
      c.deltaCount = new Map();
      persistIndex(name, c);
      c.setTotal(0);
      c.setWinStart(0);
      refreshWindow(c, name);                          // → empty window
      scheduleFlush();
    };

    return {
      list: () => c.records,                 // the materialized window
      count: () => c.total(),                // total record count (reactive)
      loaded: () => c.loaded,
      // Reactive window descriptor — start, configured size, rows
      // actually materialized, and the collection total.
      window: () => ({
        start: c.winStart(),
        size: c.winCount,
        shown: c.records.length,
        total: c.total(),
      }),
      setWindow: (start) => {
        c.setWinStart(Math.max(0, start | 0));
        refreshWindow(c, name);
      },
      get: (id) => {
        const pos = c.idIndex.get(id);
        if (pos == null) return undefined;
        const wp = pos - c.winStart();
        if (wp >= 0 && wp < c.records.length) return c.records[wp];
        const r = readRecord(name, id);     // off-window — transient copy
        return r ? r.rec : undefined;
      },
      add, addMany, update, remove, clear,
      load: () => { loadCollection(name); },
    };
  }

  // ── init ──────────────────────────────────────────────────────────
  async function init() {
    try {
      const dataDir = await fetchDataDir();
      // Prefer the native engine (the Zig log-store compiled into
      // libskal) when the runtime exposes it; fall back to the JS
      // LogStore (mmap / fs / memory) otherwise.
      let nativeOk = false;
      if (typeof globalThis.__skal_store_open === 'function' && dataDir) {
        try {
          const dir = dataDir + '/skal-native';
          const ns = new NativeLogStore(dir);
          ns.open();
          engine = ns;
          setBackendKind('native');
          setBackendDiag('native engine @ ' + dir);
          nativeOk = true;
        } catch (_) { /* fall through to the JS engine */ }
      }
      if (!nativeOk) {
        const backend = await openBackend(dataDir);
        setBackendKind(backend.kind);
        setBackendDiag(backend.diag || backend.kind);
        engine = new LogStore(backend);
        engine.open();
      }
      for (const name of Object.keys(scalars)) {
        const s = scalars[name];
        if (s.persist && !s.lazy) loadScalar(name);
      }
      for (const name of Object.keys(collections)) {
        const c = collections[name];
        if (c && c.persist && !c.lazy) loadCollection(name);
      }
    } catch (e) {
      // The store still works in-memory; surface the failure in the UI
      // (NOT via console — the runtime has no reliable console).
      setInitError((e && e.message) ? e.message : String(e));
    }
    setReady(true);
    bumpStats();
  }
  init();

  return {
    ready,
    backendKind,
    backendDiag,
    initError,
    statsTick,
    get: getScalar,
    set: setScalar,
    collection: collectionHandle,
    flushNow,
    compact: () => {
      if (!engine) return false;
      const did = engine.compact();
      if (did) { engine.flush(); bumpStats(); }
      return did;
    },
    engineStats: () => engine
      ? engine.stats()
      : { backend: '…', records: 0, segments: 0, deadBytes: 0, seq: 0 },
    flushInfo: () => ({ count: flushCount, lastMs: lastFlushMs }),
    pending: () => dirty.size,
  };
}
