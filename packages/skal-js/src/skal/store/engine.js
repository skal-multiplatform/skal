// engine.js — the Skal log-structured storage engine.
//
// A `LogStore` is an append-only key→value log split into fixed-size
// segments. Writes append a frame and repoint an in-RAM keydir;
// updates/deletes leave the old frame dead, reclaimed later by the
// compactor. The keydir (key → {seg, off}) is small and resident; the
// segment data lives in the backend, read on demand.
//
// Pluggable backend: an in-memory one (always works, demoable now) and
// an `fs` one (real persistence, used when the runtime exposes node:fs).
// A future native / Bun.mmap backend slots in behind the same contract.

import {
  encodeFrameInto, decodeFrame, FLAG_TOMBSTONE, FRAME_HEADER,
} from './frame.js';

const SEG_SIZE = 256 * 1024;          // seal a segment once it reaches this
const COMPACT_DEAD_RATIO = 0.4;       // compact a sealed segment past this
const HINT_THROTTLE_MS = 1000;        // re-serialize the keydir hint at most this often
const CACHE_MAX_SEGMENTS = 8;         // LRU cap on the engine's sealed-segment cache
const MMAP_MAX_OPEN = 16;             // LRU cap on simultaneously mapped segments

const _enc = new TextEncoder();
const _dec = new TextDecoder();
const _utf8e = (s) => _enc.encode(s);
const _utf8d = (b) => _dec.decode(b);
const _nowMs = () => Date.now();
const _EMPTY = new Uint8Array(0);
const HINT_MAGIC = 0x534B4831;        // "SKH1" — binary keydir-hint magic

// Dynamic import the bundler can't see — see App.jsx's JS tab for the
// rationale (the bundle runs as a classic Program; import() still works,
// and `new Function` hides it from vite / `bun build`).
const _dynImport = new Function('m', 'return import(m);');
const _norm = (mod, probeKey) =>
  (mod && mod[probeKey]) ? mod : ((mod && mod.default) || mod);

// ── Backends ───────────────────────────────────────────────────────
// Contract: listSegments, appendSegment, getSegment, dropSegment,
// flush, metaGet, metaPut.

export class MemoryBackend {
  constructor() {
    this.kind = 'memory';
    this._segs = new Map();   // id → Uint8Array (whole segment)
    this._meta = new Map();
  }
  listSegments() { return [...this._segs.keys()].sort((a, b) => a - b); }

  // Capacity-doubling, not copy-the-whole-thing-every-time.
  //
  // This used to allocate a new array of (old + delta) per append and
  // copy the old contents in, which is quadratic in the number of
  // appends. Filling one 256 KiB segment with 256-byte deltas took
  // 1024 appends, ~134 MB of copying and 12 ms.
  //
  // Doubling makes it amortized O(1) with no cost on the read side —
  // `getSegment` hands back a subarray of the live buffer rather than
  // concatenating chunks, so reads stay exactly as cheap as before.
  // (A chunk list would have fixed the append and taxed every read.)
  appendSegment(id, bytes) {
    let seg = this._segs.get(id);
    if (!seg) {
      seg = { buf: new Uint8Array(Math.max(1024, bytes.length * 2)), len: 0 };
      this._segs.set(id, seg);
    }
    const need = seg.len + bytes.length;
    if (need > seg.buf.length) {
      let cap = seg.buf.length || 1024;
      while (cap < need) cap *= 2;
      const grown = new Uint8Array(cap);
      grown.set(seg.buf.subarray(0, seg.len));
      seg.buf = grown;
    }
    seg.buf.set(bytes, seg.len);
    seg.len = need;
  }
  getSegment(id) {
    const seg = this._segs.get(id);
    return seg ? seg.buf.subarray(0, seg.len) : null;
  }
  dropSegment(id) { this._segs.delete(id); }
  flush() {}
  metaGet(k) { return this._meta.get(k) || null; }
  metaPut(k, v) { this._meta.set(k, v.slice()); }
}

export class FsBackend {
  constructor(fs, path, root) {
    this.kind = 'fs';
    this._fs = fs;
    this._p = path;
    this.root = root;
  }
  _seg(id) {
    return this._p.join(this.root, `seg-${String(id).padStart(5, '0')}.log`);
  }
  listSegments() {
    let names = [];
    try { names = this._fs.readdirSync(this.root); } catch (_) { return []; }
    return names
      .filter((n) => /^seg-\d+\.log$/.test(n))
      .map((n) => parseInt(n.slice(4), 10))
      .sort((a, b) => a - b);
  }
  appendSegment(id, bytes) { this._fs.appendFileSync(this._seg(id), bytes); }
  getSegment(id) {
    try { return new Uint8Array(this._fs.readFileSync(this._seg(id))); }
    catch (_) { return null; }
  }
  dropSegment(id) { try { this._fs.unlinkSync(this._seg(id)); } catch (_) {} }
  flush() {}
  metaGet(k) {
    try { return new Uint8Array(this._fs.readFileSync(
      this._p.join(this.root, `meta-${k}`))); }
    catch (_) { return null; }
  }
  metaPut(k, v) {
    this._fs.writeFileSync(this._p.join(this.root, `meta-${k}`), v);
  }
}

// The mmap backend — segment files mapped with `Bun.mmap`.
//
// A segment defaults to SEG_SIZE and holds many frames; a frame larger
// than that gets its own segment sized exactly to it (createSegment) —
// so a value of any size is storable, bounded only by device storage.
// A file is never *resized* once mapped (`Bun.mmap` segfaults on
// truncation of a live mapping): each segment is created at its final
// size. Writing is a `memcpy` into the mapping (no syscall — the OS
// flushes dirty pages); reading is straight out of it. A dropped
// segment is renamed aside, never `unlink`ed while it might be mapped.
export class MmapBackend {
  constructor(mmap, fs, path, root) {
    this.kind = 'mmap';
    // The active segment IS the mapping — the engine writes frames
    // straight into it, with no JS shadow buffer (see LogStore).
    this.directActive = true;
    this._mmap = mmap;
    this._fs = fs;
    this._p = path;
    this.root = root;
    this._open = new Map();   // id → { mapped:Uint8Array, cursor:number }
    // Retire segments a previous run renamed aside — safe now, before
    // anything is mapped.
    try {
      for (const n of fs.readdirSync(root)) {
        if (n.endsWith('.dead')) {
          try { fs.unlinkSync(path.join(root, n)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  _segPath(id) {
    return this._p.join(this.root, `seg-${String(id).padStart(5, '0')}.log`);
  }

  // Map an existing segment file (at whatever size it is on disk — a
  // segment holding one oversized frame is larger than SEG_SIZE).
  // Throws if the file does not exist; callers that may hit a missing
  // segment (getSegment / segmentLen / segmentCapacity) wrap the call.
  _handle(id) {
    let h = this._open.get(id);
    if (h) {                              // cache hit — promote to MRU end
      this._open.delete(id);
      this._open.set(id, h);
      return h;
    }
    const mapped = this._mmap(this._segPath(id), { shared: true });
    // Derive the write cursor — scan frames until the zero padding
    // (an all-zero header fails its CRC, so decodeFrame stops there).
    let cursor = 0;
    while (cursor < mapped.length) {
      const f = decodeFrame(mapped, cursor);
      if (!f) break;
      cursor += f.total;
    }
    h = { mapped, cursor };
    this._open.set(id, h);
    this._evictOpen(id);
    return h;
  }

  // LRU-evict the least-recently-used mapping (keeping `keepId`) —
  // dropping our last reference lets the GC unmap it, bounding mapped
  // virtual memory. The active segment is written constantly, so LRU
  // never picks it.
  _evictOpen(keepId) {
    while (this._open.size > MMAP_MAX_OPEN) {
      const oldest = this._open.keys().next().value;
      if (oldest === keepId) break;
      this._open.delete(oldest);
    }
  }

  // Create a brand-new segment file sized to `capacity` bytes and map
  // it. Callers pass max(SEG_SIZE, frameTotal) so a single frame of any
  // size gets a segment big enough to hold it.
  createSegment(id, capacity) {
    const p = this._segPath(id);
    this._fs.writeFileSync(p, new Uint8Array(capacity));
    const mapped = this._mmap(p, { shared: true });
    const h = { mapped, cursor: 0 };
    this._open.set(id, h);
    this._evictOpen(id);
    return h;
  }

  // Capacity (file size) of segment `id`, or 0 if it does not exist yet.
  segmentCapacity(id) {
    const h = this._open.get(id);
    if (h) return h.mapped.length;
    try { return this._handle(id).mapped.length; } catch (_) { return 0; }
  }

  listSegments() {
    let names = [];
    try { names = this._fs.readdirSync(this.root); } catch (_) { return []; }
    return names
      .filter((n) => /^seg-\d+\.log$/.test(n))
      .map((n) => parseInt(n.slice(4), 10))
      .sort((a, b) => a - b);
  }

  // Current write cursor of segment `id`, or 0 if it does not exist yet.
  // (mmap is always direct-write — there is no buffered appendSegment.)
  segmentLen(id) {
    try { return this._handle(id).cursor; } catch (_) { return 0; }
  }

  // Reserve `n` bytes at the write cursor; the caller encodes a frame
  // directly into mapped[offset .. offset+n). Overflow is the caller's
  // responsibility — the engine seals before reserving.
  reserve(id, n) {
    const h = this._handle(id);
    const offset = h.cursor;
    h.cursor += n;
    return { mapped: h.mapped, offset };
  }

  getSegment(id) {
    let h;
    try { h = this._handle(id); } catch (_) { return null; }
    return h.mapped.subarray(0, h.cursor);
  }

  dropSegment(id) {
    this._open.delete(id);           // drop the ref → GC eventually unmaps
    // Never unlink a file that may still be mapped — rename aside; the
    // .dead file is cleaned up on the next cold open.
    try {
      this._fs.renameSync(this._segPath(id), this._segPath(id) + '.dead');
    } catch (_) {}
  }

  flush() { /* the OS flushes dirty mmap pages; no msync is exposed */ }

  metaGet(k) {
    try {
      return new Uint8Array(this._fs.readFileSync(
        this._p.join(this.root, `meta-${k}`)));
    } catch (_) { return null; }
  }
  metaPut(k, v) {
    this._fs.writeFileSync(this._p.join(this.root, `meta-${k}`), v);
  }
}

function _withDiag(backend, diag) { backend.diag = diag; return backend; }

// Pick the best backend the runtime can give us: Bun.mmap > node:fs >
// in-memory. Never throws — the store always gets a working backend.
// The chosen backend carries a `.diag` string explaining the decision;
// the store surfaces it in the UI (the runtime has no reliable console,
// so diagnostics must NOT go through console.* — that throws).
//
// `baseDir` is a host-provided writable directory. The embedded
// runtime's `os.tmpdir()` returns `/tmp`, which the macOS app sandbox
// forbids — so the store fetches a real sandbox-container path from the
// host and passes it here. Without it, only the in-memory backend works.
export async function openBackend(baseDir) {
  let fs, os, path;
  try {
    // Race the imports against a timeout — a hung import() must not
    // wedge the store's init forever.
    const probe = Promise.all([
      _dynImport('node:' + 'fs'),
      _dynImport('node:' + 'os'),
      _dynImport('node:' + 'path'),
    ]);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('module import timed out')), 2000));
    const [fsM, osM, pathM] = await Promise.race([probe, timeout]);
    fs = _norm(fsM, 'readFileSync');
    os = _norm(osM, 'tmpdir');
    path = _norm(pathM, 'join');
    if (typeof fs.readFileSync !== 'function' ||
        typeof fs.writeFileSync !== 'function' ||
        typeof os.tmpdir !== 'function' ||
        typeof path.join !== 'function') {
      return _withDiag(new MemoryBackend(),
        'node:fs/os/path resolved but missing methods');
    }
  } catch (e) {
    return _withDiag(new MemoryBackend(),
      'node: import failed — ' + ((e && e.message) || e));
  }

  // Prefer the host-provided directory; only fall back to os.tmpdir()
  // (which is /tmp and sandbox-forbidden) when the host gave us nothing.
  const base = (baseDir && baseDir.length)
    ? baseDir
    : path.join(os.tmpdir(), 'skal-store');
  let why = '';

  // 1 — mmap, when the runtime exposes a working Bun.mmap.
  try {
    if (typeof Bun !== 'undefined' && typeof Bun.mmap === 'function') {
      const root = path.join(base, 'mmap');
      fs.mkdirSync(root, { recursive: true });
      const probePath = path.join(root, '.mmap-probe');
      fs.writeFileSync(probePath, new Uint8Array(64));
      const m = Bun.mmap(probePath, { shared: true }); // verify it works here
      if (m && m.length >= 64) {
        return _withDiag(
          new MmapBackend((p, o) => Bun.mmap(p, o), fs, path, root),
          'mmap @ ' + root);
      }
      why += 'Bun.mmap probe unusable; ';
    } else {
      why += 'Bun.mmap absent; ';
    }
  } catch (e) {
    why += 'mmap — ' + ((e && e.message) || e) + '; ';
  }

  // 2 — plain node:fs.
  try {
    if (typeof fs.appendFileSync === 'function') {
      const root = path.join(base, 'fs');
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, '.fs-probe'), new Uint8Array(1)); // writable?
      return _withDiag(new FsBackend(fs, path, root), why + 'fs @ ' + root);
    }
    why += 'fs.appendFileSync absent; ';
  } catch (e) {
    why += 'fs — ' + ((e && e.message) || e) + '; ';
  }

  // 3 — in-memory.
  return _withDiag(new MemoryBackend(), why + 'memory fallback');
}

// ── The log engine ─────────────────────────────────────────────────

export class LogStore {
  // Engine reads, counted AT THE BOUNDARY. db.js used to count its own
  // intent to probe, which meant a gate and its counter shared the same
  // condition — deleting the gate left the count unchanged and the test
  // green. Counting where the crossing actually happens cannot be
  // fooled that way.
  reads = 0;
  constructor(backend) {
    this._b = backend;
    this._keydir = new Map();   // key → { seg, off, len, seq }
    this._dead = new Map();     // segId → dead byte count
    this._cache = new Map();    // sealed segId → Uint8Array
    this._seq = 0;
    this._active = null;        // { id, buf, len, persisted }
    this._lastHintMs = 0;       // throttle clock for _writeHint
    this._maxSegId = -1;        // highest segment id known to exist
  }

  get backendKind() { return this._b.kind; }

  // Rebuild the keydir. With a valid hint file the keydir / dead-map /
  // seq are loaded straight from it — O(key-count) — and only the tail
  // segment is forward-scanned for frames written since the hint. With
  // no usable hint we fall back to a full segment scan — O(total-bytes).
  //
  // The hint is self-validating (every segment it references must still
  // exist) and a stale one costs only latency: the forward scan from the
  // hint's tail reconciles any frames the hint didn't yet know about.
  //
  // What the scan does NOT reconcile is which segment takes appends.
  // The hint records the tail as of the last (throttled, 1/s) write; a
  // crash between a seal and the next hint leaves it naming an OLDER
  // segment. This used to be read back as the active one — and the next
  // `_seal()` then advanced to `id + 1`, an id that already existed, and
  // began writing frames at offsets that aliased the ones already there.
  // Reads of untouched keys started returning other keys' bytes. See
  // the `stale hint` group in test/store.test.js.
  //
  // So: the hint controls WHERE THE SCAN RESUMES, and nothing else. The
  // active segment is always the newest segment in existence.
  open() {
    const segs = this._b.listSegments();
    const hint = this._loadHint(segs);
    if (hint) {
      this._keydir = hint.keydir;
      this._dead = hint.dead;
      this._seq = hint.seq;
    }

    if (segs.length === 0) {
      const id = hint ? hint.tail.id : 0;
      this._maxSegId = id;
      this._active = this._b.directActive
        ? { id, direct: true }
        : { id, buf: new Uint8Array(SEG_SIZE), len: 0, persisted: 0 };
      return;
    }

    const lastId = segs[segs.length - 1];
    // Newest in existence — on disk, or the empty never-flushed segment
    // a seal opened just before the hint was written (`_loadHint` admits
    // a tail above `lastId` only when its length is 0). Never the hint's
    // tail on its own: see the note above `open()`.
    const activeId = hint ? Math.max(lastId, hint.tail.id) : lastId;
    const scanFrom = hint ? hint.tail.id : segs[0];
    this._maxSegId = activeId;
    let activeBytes = null;

    for (const id of segs) {
      if (id < scanFrom) continue;            // covered by the hint — skip
      const bytes = this._b.getSegment(id) || new Uint8Array(0);
      // The tail segment is scanned from where the hint left off; any
      // later segment (a seal the hint didn't capture) is scanned whole.
      let off = (hint && id === hint.tail.id) ? hint.tail.len : 0;
      while (off < bytes.length) {
        const f = decodeFrame(bytes, off);
        if (!f) break;                        // torn tail — stop this segment
        const key = _utf8d(f.key);
        const prev = this._keydir.get(key);
        if (prev) this._addDead(prev.seg, prev.len); // superseded → dead
        if (f.flags & FLAG_TOMBSTONE) {
          this._keydir.delete(key);
          this._addDead(id, f.total);
        } else {
          this._keydir.set(key, { seg: id, off, len: f.total, seq: f.seq });
        }
        if (f.seq > this._seq) this._seq = f.seq;
        off += f.total;
      }
      if (id === activeId) activeBytes = bytes;
      else this._cacheSet(id, bytes);
    }
    // The active segment (hint tail, or last on disk) takes appends.
    this._cache.delete(activeId);
    if (this._b.directActive) {
      // mmap: the segment IS the mapping — no JS shadow buffer. The
      // backend mapped it (and derived its write cursor) during the
      // scan above; getSegment() here just guarantees that for an
      // empty, never-flushed tail the loop never reached.
      this._b.getSegment(activeId);
      this._active = { id: activeId, direct: true };
    } else {
      if (activeBytes == null) {
        activeBytes = this._b.getSegment(activeId) || new Uint8Array(0);
      }
      const buf = new Uint8Array(Math.max(SEG_SIZE, activeBytes.length));
      buf.set(activeBytes);
      this._active = {
        id: activeId, buf, len: activeBytes.length, persisted: activeBytes.length,
      };
    }
  }

  _addDead(seg, n) { this._dead.set(seg, (this._dead.get(seg) || 0) + n); }

  // The sealed-segment cache is an LRU: `_cache` is a Map (insertion-
  // ordered), a read re-inserts to mark it most-recently-used, and a
  // write evicts from the front once over CACHE_MAX_SEGMENTS. A miss
  // just re-reads the segment from the backend — lazy materialization,
  // bounded RAM. (The active segment is never in here.)
  _cacheGet(id) {
    const b = this._cache.get(id);
    if (b !== undefined) { this._cache.delete(id); this._cache.set(id, b); }
    return b;
  }
  _cacheSet(id, bytes) {
    this._cache.delete(id);
    this._cache.set(id, bytes);
    while (this._cache.size > CACHE_MAX_SEGMENTS) {
      this._cache.delete(this._cache.keys().next().value);
    }
  }

  // Read + validate the binary keydir hint written by flush()/compact().
  // Returns { seq, tail:{id,len}, keydir, dead } or null when the hint
  // is absent, malformed, or references a segment that no longer exists
  // (in which case a full scan is the only safe path). Layout:
  //   magic u32 · seq u32 · tailId u32 · tailLen u32 · keyCount u32
  //   keyCount × [ keyLen u16 · key · seg u32 · off u32 · len u32 · seq u32 ]
  //   deadCount u32 · deadCount × [ seg u32 · dead u32 ]
  _loadHint(segs) {
    let raw;
    try { raw = this._b.metaGet('hint'); } catch (_) { return null; }
    if (!raw || raw.length < 20) return null;
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (dv.getUint32(0, true) !== HINT_MAGIC) return null;
    const seq = dv.getUint32(4, true);
    const tailId = dv.getUint32(8, true);
    const tailLen = dv.getUint32(12, true);
    const keyCount = dv.getUint32(16, true);
    const segSet = new Set(segs);
    const keydir = new Map();
    let o = 20;
    try {
      for (let i = 0; i < keyCount; i++) {
        const klen = dv.getUint16(o, true); o += 2;
        if (o + klen + 16 > raw.length) return null;
        const key = _utf8d(raw.subarray(o, o + klen)); o += klen;
        const seg = dv.getUint32(o, true); o += 4;
        const off = dv.getUint32(o, true); o += 4;
        const len = dv.getUint32(o, true); o += 4;
        const eseq = dv.getUint32(o, true); o += 4;
        if (!segSet.has(seg)) return null;   // vanished segment — distrust
        keydir.set(key, { seg, off, len, seq: eseq });
      }
      const deadCount = dv.getUint32(o, true); o += 4;
      const dead = new Map();
      for (let i = 0; i < deadCount; i++) {
        const seg = dv.getUint32(o, true); o += 4;
        dead.set(seg, dv.getUint32(o, true)); o += 4;
      }
      // The tail must exist on disk unless it's empty + never-flushed.
      if (!segSet.has(tailId) && tailLen !== 0) return null;
      return { seq, tail: { id: tailId, len: tailLen }, keydir, dead };
    } catch (_) { return null; }             // truncated / malformed
  }

  // Persisted byte length of the active segment — `persisted` in
  // buffered mode, the live mmap write cursor in direct mode.
  _tailLen() {
    const a = this._active;
    if (!a) return 0;
    return a.direct ? this._b.segmentLen(a.id) : a.persisted;
  }

  // Serialize the in-RAM keydir to the binary hint — the next-open fast
  // path. `tail.len` is the *persisted* active length, so a reopen's
  // forward scan resumes from exactly the right place. Sized in one
  // pass (keys encoded once), then filled — no growable buffer, no JSON.
  _writeHint() {
    this._lastHintMs = _nowMs();
    const a = this._active;
    const keys = [];
    let size = 20;                          // header
    for (const [k, e] of this._keydir) {
      const kb = _utf8e(k);
      keys.push([kb, e]);
      size += 2 + kb.length + 16;
    }
    size += 4 + this._dead.size * 8;
    const buf = new Uint8Array(size);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, HINT_MAGIC, true);
    dv.setUint32(4, this._seq >>> 0, true);
    dv.setUint32(8, a ? a.id : 0, true);
    dv.setUint32(12, this._tailLen(), true);
    dv.setUint32(16, keys.length, true);
    let o = 20;
    for (const [kb, e] of keys) {
      dv.setUint16(o, kb.length, true); o += 2;
      buf.set(kb, o); o += kb.length;
      dv.setUint32(o, e.seg, true); o += 4;
      dv.setUint32(o, e.off, true); o += 4;
      dv.setUint32(o, e.len, true); o += 4;
      dv.setUint32(o, e.seq >>> 0, true); o += 4;
    }
    dv.setUint32(o, this._dead.size, true); o += 4;
    for (const [seg, dead] of this._dead) {
      dv.setUint32(o, seg, true); o += 4;
      dv.setUint32(o, dead, true); o += 4;
    }
    try { this._b.metaPut('hint', buf); } catch (_) {}
  }

  // The id a seal opens next. `a.id + 1` alone is only safe while the
  // active segment is the newest one — which `open()` now guarantees.
  // This keeps the guarantee LOCAL: even if some future path made an
  // older segment active, a seal still lands on unused ground rather
  // than writing frames over an existing segment's bytes.
  _nextSegId() {
    const next = Math.max(this._active.id, this._maxSegId) + 1;
    this._maxSegId = next;
    return next;
  }

  // Seal the active segment (flush its tail, cache it) and open a fresh one.
  _seal() {
    const a = this._active;
    if (a.direct) {
      // Every byte is already in the mapping — just advance to a fresh
      // segment; the mmap backend maps the new file on first write.
      this._active = { id: this._nextSegId(), direct: true };
      return;
    }
    if (a.len > a.persisted) {
      this._b.appendSegment(a.id, a.buf.subarray(a.persisted, a.len));
    }
    this._cacheSet(a.id, a.buf.slice(0, a.len));
    this._active = {
      id: this._nextSegId(), buf: new Uint8Array(SEG_SIZE), len: 0, persisted: 0,
    };
  }

  // Encode a frame straight into the active segment — no intermediate
  // frame buffer. Direct (mmap) mode encodes into the mapping; buffered
  // mode encodes into the JS segment buffer. Returns the frame offset.
  _writeFrame(seq, flags, key, value) {
    const total = FRAME_HEADER + key.length + value.length;
    const a = this._active;
    if (a.direct) {
      // Variable-size segments: a frame larger than SEG_SIZE gets a
      // segment sized to fit it. Create the active segment if it does
      // not exist yet; otherwise seal + create a new one when this
      // frame would not fit. The new segment is max(SEG_SIZE, total) —
      // so a value of any size always fits, never rejected.
      const cap = this._b.segmentCapacity(a.id);
      if (cap === 0) {
        this._b.createSegment(a.id, Math.max(SEG_SIZE, total));
      } else if (this._b.segmentLen(a.id) + total > cap) {
        this._seal();
        this._b.createSegment(this._active.id, Math.max(SEG_SIZE, total));
      }
      const slot = this._b.reserve(this._active.id, total);
      encodeFrameInto(slot.mapped, slot.offset, seq, flags, key, value);
      return slot.offset;
    }
    if (a.len > 0 && a.len + total > SEG_SIZE) this._seal();
    const cur = this._active;
    if (cur.len + total > cur.buf.length) {
      const grown = new Uint8Array(
        Math.max(cur.buf.length * 2, cur.len + total));
      grown.set(cur.buf.subarray(0, cur.len));
      cur.buf = grown;
    }
    const off = cur.len;
    encodeFrameInto(cur.buf, off, seq, flags, key, value);
    cur.len += total;
    return off;
  }

  put(key, value) {                       // key: string, value: Uint8Array
    const seq = ++this._seq;
    const kb = _utf8e(key);
    const off = this._writeFrame(seq, 0, kb, value);
    const prev = this._keydir.get(key);
    if (prev) this._addDead(prev.seg, prev.len);
    this._keydir.set(key, {
      seg: this._active.id, off,
      len: FRAME_HEADER + kb.length + value.length, seq,
    });
  }

  del(key) {
    const prev = this._keydir.get(key);
    if (!prev) return;
    this._writeFrame(++this._seq, FLAG_TOMBSTONE, _utf8e(key), _EMPTY);
    this._addDead(prev.seg, prev.len);
    this._keydir.delete(key);
  }

  // Every key currently on disk.
  //
  // Hydration used to ask "does a frame exist?" once per DECLARED leaf,
  // so a store whose data lives in one blob still paid a lookup per leaf
  // of initState. Handing the set over once makes hydration O(records).
  //
  // A SNAPSHOT Set, matching what the native backend returns.
  //
  // A live `{ has }` view over `_keydir` was cheaper and is reverted: it
  // gave the two backends different semantics on the one method whose
  // whole job is to be believed, and CI only ever runs this one. The
  // saving was argued, never measured — and this repo's rule is that a
  // performance claim is a measurement. If it is worth having, it is
  // worth measuring and applying to BOTH backends.
  allKeys() { return new Set(this._keydir.keys()); }

  // Tombstone every keydir key starting with `prefix.` or `prefix#`.
  // Used by db.js's wholesale-assign + tombstoneTree paths to clear
  // stale leaf-override frames in one call.
  delPrefix(prefix) {
    if (!prefix) return;
    const dot = prefix + '.';
    const hash = prefix + '#';
    const victims = [];
    for (const key of this._keydir.keys()) {
      if (key.startsWith(dot) || key.startsWith(hash)) victims.push(key);
    }
    for (const key of victims) this.del(key);
  }

  // Same contract as the native batch: one call, N results, nulls for
  // misses, IN THE ORDER ASKED. The JS backend has no crossing to
  // amortise, so this is a plain loop — it exists so callers never have
  // to branch on which backend they got.
  getMany(keys) {
    this.reads += keys.length;
    // VIEWS OVER A REUSABLE SCRATCH, deliberately — matching what the
    // native backend does. Returning fresh copies here made the JS
    // backend a test double that under-reports the real consumer: a
    // caller that holds these across another read is correct in CI and
    // returns another record's bytes on device. That exact bug shipped
    // once and only a benchmark checksum caught it.
    // `_frameValue`, not `get`: get() returns an OWNED copy because its
    // callers keep the result, but this method copies into the scratch
    // itself — so routing through get() allocated a throwaway
    // Uint8Array per key and walked every byte twice. On a 256-key
    // hydration chunk that is 256 dead allocations and a redundant pass
    // over the whole payload, on the cold-start path.
    //
    // ONE PASS, copying as it goes.
    //
    // Two earlier shapes were both wrong. Buffering the slices to size
    // the payload first pinned one whole segment buffer per distinct
    // segment touched — `_segBytes` reads an entire file per miss and
    // the LRU bounds only 8 — so a 256-key chunk spanning 20 segments
    // retained all 20. Sizing in a separate pass instead resolved every
    // key TWICE, and the second resolve is not a cheap keydir hit: on an
    // LRU miss it re-reads the whole segment file. The comment there
    // asserted it was cheaper, which was an argument, not a measurement.
    //
    // Copying into a growable scratch as each key resolves has neither
    // problem: one resolve per key, and nothing retained past the copy.
    const out = new Array(keys.length);
    const lens = new Array(keys.length);
    let off = 0;
    if (!this._many) this._many = new Uint8Array(1024);
    for (let i = 0; i < keys.length; i++) {
      const v = this._frameValue(keys[i]);
      if (!v) { lens[i] = -1; continue; }
      if (off + v.length > this._many.length) {
        // Grow geometrically and carry the prefix over. Views handed out
        // below are taken AFTER the loop, so a realloc mid-loop cannot
        // strand one.
        let cap = this._many.length * 2;
        while (cap < off + v.length) cap *= 2;
        const bigger = new Uint8Array(cap);
        bigger.set(this._many.subarray(0, off));
        this._many = bigger;
      }
      this._many.set(v, off);
      lens[i] = v.length;
      off += v.length;
    }
    const buf = this._many;
    let at = 0;
    for (let i = 0; i < keys.length; i++) {
      if (lens[i] < 0) { out[i] = null; continue; }
      out[i] = buf.subarray(at, at + lens[i]);
      at += lens[i];
    }
    return out;
  }

  // Locate a key's committed frame value WITHOUT copying — the result
  // is a view into the segment buffer and is only valid until that
  // segment is rewritten. Internal: `get` owns the copy, `getMany`
  // copies into its own scratch.
  _frameValue(key) {
    const e = this._keydir.get(key);
    if (!e) return null;
    const bytes = this._segBytes(e.seg);
    if (!bytes) return null;
    // Keydir-located committed frame — skip the CRC re-check (verify
    // earns its keep only on the recovery scan, not the hot read path).
    const f = decodeFrame(bytes, e.off, false);
    if (!f || (f.flags & FLAG_TOMBSTONE)) return null;
    return f.value;
  }

  get(key) {                              // → Uint8Array | null
    this.reads++;
    const v = this._frameValue(key);
    return v === null ? null : v.slice();
  }

  _segBytes(id) {
    if (this._active && id === this._active.id) {
      return this._active.direct
        ? this._b.getSegment(id)
        : this._active.buf.subarray(0, this._active.len);
    }
    let b = this._cacheGet(id);
    if (!b) {
      b = this._b.getSegment(id);
      if (b) this._cacheSet(id, b);
    }
    return b;
  }

  // Persist the active segment's un-written tail (append-only — only the
  // delta since the last flush is written).
  flush() {
    const a = this._active;
    // Direct (mmap) mode has no shadow buffer — frames are already in
    // the mapping; only buffered mode appends its un-written tail here.
    if (a && !a.direct && a.len > a.persisted) {
      this._b.appendSegment(a.id, a.buf.subarray(a.persisted, a.len));
      a.persisted = a.len;
    }
    this._b.flush();
    // Refresh the keydir hint, throttled — re-serializing the whole
    // keydir on every 60ms write batch would defeat the point.
    if (_nowMs() - this._lastHintMs >= HINT_THROTTLE_MS) this._writeHint();
  }

  // Compact the worst sealed segment: copy its live frames forward,
  // then drop it. One segment per call — bounded, incremental.
  compact() {
    let worst = -1;
    let worstDead = 0;
    for (const [seg, dead] of this._dead) {
      if (this._active && seg === this._active.id) continue;
      if (dead > worstDead) { worstDead = dead; worst = seg; }
    }
    if (worst < 0 || worstDead < SEG_SIZE * COMPACT_DEAD_RATIO) return false;
    const bytes = this._segBytes(worst);
    if (!bytes) return false;
    // A tombstone may only be DROPPED when no older segment can still
    // hold a pre-delete frame for its key — i.e. when `worst` is the
    // oldest segment (listSegments() is ascending, so [0] is oldest).
    // Otherwise it is forwarded so a reopen still sees the deletion.
    const segs = this._b.listSegments();
    const worstIsOldest = segs.length > 0 && worst === segs[0];
    let off = 0;
    while (off < bytes.length) {
      const f = decodeFrame(bytes, off);
      if (!f) break;
      const key = _utf8d(f.key);
      if (f.flags & FLAG_TOMBSTONE) {
        // Forward the tombstone only if the deletion must be preserved:
        // an older segment may still hold a pre-delete frame AND the key
        // was not re-added since. An obsolete tombstone is dropped.
        if (!worstIsOldest && !this._keydir.has(key)) {
          this._writeFrame(++this._seq, FLAG_TOMBSTONE, f.key, _EMPTY);
          this._addDead(this._active.id, FRAME_HEADER + f.key.length);
        }
      } else {
        const e = this._keydir.get(key);
        // Live iff the keydir still points at THIS exact frame.
        if (e && e.seg === worst && e.off === off) {
          this.put(key, f.value.slice());
        }
      }
      off += f.total;
    }
    // Persist the forwarded frames BEFORE dropping the source — a crash
    // in between would otherwise lose data the source still held.
    this.flush();
    this._b.dropSegment(worst);
    this._cache.delete(worst);
    this._dead.delete(worst);
    this._writeHint();          // rewrite the hint free of the dropped segment
    return true;
  }

  stats() {
    let dead = 0;
    for (const d of this._dead.values()) dead += d;
    return {
      backend: this._b.kind,
      records: this._keydir.size,
      // Count segments on the backend — in direct (mmap) mode sealed
      // segments live in the backend's map, not the engine's _cache.
      segments: this._b.listSegments().length,
      activeSegment: this._active ? this._active.id : -1,
      deadBytes: dead,
      seq: this._seq,
    };
  }
}

// ── Native engine ──────────────────────────────────────────────────
// A drop-in replacement for LogStore backed by the Zig log-structured
// store compiled into libskal (patches/skal_entry.zig). The engine —
// mmap segments, keydir, frames, CRC — runs in native code; JS only
// crosses the boundary with a key string and opaque value bytes. Used
// when the runtime exposes the `__skal_store_*` host functions; the
// store falls back to the JS LogStore otherwise.
export class NativeLogStore {
  reads = 0;
  constructor(dir) {
    this.backendKind = 'native';
    this._dir = dir;
    this._h = 0;
  }

  open() {
    const fn = globalThis.__skal_store_open;
    this._h = (typeof fn === 'function') ? (fn(this._dir) || 0) : 0;
    if (!this._h) {
      throw new Error('skal-store: native engine open failed @ ' + this._dir);
    }
  }

  put(key, value) { globalThis.__skal_store_put(this._h, key, value); }
  del(key) { globalThis.__skal_store_del(this._h, key); }

  // Tombstone every native-keydir entry under `prefix.` or `prefix#`
  // in a single native call — used by db.js when a wholesale assign
  // invalidates leaf overrides under that subtree.
  delPrefix(prefix) {
    const fn = globalThis.__skal_store_del_prefix;
    if (typeof fn === 'function') fn(this._h, prefix);
  }

  // Every key currently on disk, or null when the host cannot answer.
  //
  // VALIDATED AT EVERY STEP, and null on anything unexpected. The
  // consumer uses this as a FILTER on hydration, so a malformed buffer
  // is not a read error that surfaces — it is persisted data quietly
  // not loading, followed by the next flush writing defaults over it.
  // Returning null puts hydration back on the probe-everything path,
  // which is slow and correct. getMany guards the same class one
  // function down (`n !== keys.length -> _perKey`).
  //
  // The buffer is a no-copy view over the store's single reusable
  // scratch — the same one getMany uses — so it is decoded into a Set
  // here, before returning. A caller must never hold it.
  allKeys() {
    const fn = globalThis.__skal_store_keys;
    if (typeof fn !== 'function') return null;
    // The DECODE is inside the try as well as the call. A host handing
    // back a Uint8Array instead of an ArrayBuffer — the plausible
    // mistake, since getMany returns views — passes both the truthiness
    // and byteLength checks and then throws out of `new DataView`. The
    // contract above promises null; only the caller's own try/catch was
    // making that true.
    //
    // No 0xFFFFFFFF sentinel check: this format has no missing-value
    // marker (that is getMany's), and the bounds test below already
    // rejects it. Keeping it implied a sentinel the writer never emits.
    try {
      const ab = fn(this._h);
      if (!ab || ab.byteLength < 4) return null;
      const dv = new DataView(ab);
      const n = dv.getUint32(0, true);
      if (4 + n * 4 > ab.byteLength) return null;
      const out = new Set();
      let off = 4 + n * 4;
      for (let i = 0; i < n; i++) {
        const len = dv.getUint32(4 + i * 4, true);
        if (off + len > ab.byteLength) return null;
        out.add(_utf8d(new Uint8Array(ab, off, len)));
        off += len;
      }
      return out;
    } catch (_) { return null; }
  }

  _perKey(keys) {
    const out = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      // Uint8Array, matching the batched path — the contract above says
      // "both getMany -> Uint8Array views". This returned ArrayBuffers,
      // and it is taken only on old libskal or a refused batch, i.e. the
      // paths CI never runs: correct in CI, wrong on those devices.
      // UNCONDITIONAL copy. The `ab.slice ? ... : ab` fallback was
      // unreachable today but its else-arm is precisely the scratch
      // aliasing this comment records as a shipped bug: N results
      // aliasing one buffer, every one decoding to the last record read.
      // A guard that quietly degrades to the known failure is worse than
      // no guard.
      const ab = this.get(keys[i]);
      out[i] = ab === null ? null : new Uint8Array(ab.slice(0));
    }
    return out;
  }

  // One crossing for N records instead of N. Returns ArrayBuffer views
  // | null, IN THE ORDER ASKED.
  //
  // Wire format, little-endian, from store_get_many_cb:
  //   [u32 count][u32 len_0 .. u32 len_{count-1}][bytes_0][bytes_1]...
  //   len === 0xFFFFFFFF marks a MISSING key — a zero-length value would
  //   otherwise be indistinguishable from one.
  //
  // LIFETIME: the buffer is a no-copy view over the store's reusable
  // scratch and is valid only until the next get/getMany. The slices
  // handed back are views into it, so a caller must decode all of them
  // before issuing another read. `hydrate` does exactly that.
  // Per-key fallback for both the old-libskal and refused-batch paths.
  //
  // THE COPY IS LOAD-BEARING. `get` hands back a view over the store's
  // single reusable scratch buffer, so a loop that keeps N of them ends
  // up with N aliases of the SAME memory and every one decodes to the
  // last record read. Shipped exactly that for one build; the
  // benchmark's checksum caught it (11263132 against an expected
  // 16366700) because the batched path is the only reader that holds
  // more than one buffer at a time.
  getMany(keys) {
    this.reads += keys.length;
    const fn = globalThis.__skal_store_get_many;
    if (typeof fn !== 'function') return this._perKey(keys);   // older libskal
    const ab = fn(this._h, keys);
    // A NULL RETURN IS A REFUSAL, NOT AN EMPTY RESULT. The native side
    // returns null when it cannot allocate, when the argument is not a
    // usable array, and when a store mutation invalidated its buffered
    // slices mid-call. Mapping that to `fill(null)` said "every key is
    // missing", which hydrate cannot tell apart from a genuinely empty
    // store: up to CHUNK persisted leaves would silently revert to
    // their initState defaults, and the next flush would write those
    // defaults back over the real data. Fall back to per-key reads,
    // which are slower and correct.
    if (!ab) return this._perKey(keys);
    const dv = new DataView(ab);
    const n = dv.getUint32(0, true);
    // A SHORT result is a refusal too. hydrate sizes its `has`/`vals`
    // arrays from the REQUEST, so a buffer describing fewer records
    // leaves the tail as "key missing" — and up to CHUNK persisted
    // leaves silently revert to their initState defaults, which the next
    // flush writes back over the real data. Same failure the null
    // fallback exists to prevent, so it takes the same route.
    // DEFENSIVE, and untested: no test drives NativeLogStore, so nothing
    // can construct a short buffer. It guards a native contract
    // violation, and the cost is one comparison per batch.
    if (n !== keys.length) return this._perKey(keys);
    const out = new Array(n);
    let off = 4 + n * 4;
    for (let i = 0; i < n; i++) {
      const len = dv.getUint32(4 + i * 4, true);
      if (len === 0xFFFFFFFF) { out[i] = null; continue; }
      out[i] = new Uint8Array(ab, off, len);
      off += len;
    }
    return out;
  }

  // RETURN TYPES DIFFER BY BACKEND, DELIBERATELY, AND THAT IS A TRAP.
  //
  //   LogStore.get        -> Uint8Array | null   (owned copy)
  //   NativeLogStore.get  -> ArrayBuffer | null  (no-copy, see below)
  //   both getMany        -> Uint8Array views | null
  //
  // It works only because every consumer hands the result straight to
  // `decodeFrame`, which feeds TextDecoder — that accepts both. Anything
  // doing `b.length` (an ArrayBuffer has `byteLength`), `b[0]`, or
  // `b.slice(0, n)` is correct against the JS backend in CI and silently
  // wrong on device. That CI-vs-device split has already shipped once
  // here, from the scratch-buffer aliasing the getMany comment records.
  // Normalise at the call site or widen this contract before adding a
  // consumer that does anything else with these bytes.
  get(key) {                    // → ArrayBuffer | null (decoder takes both)
    this.reads++;
    // Returned raw. Wrapping in a Uint8Array cost one allocation per
    // record on the hydration path for nothing: TextDecoder accepts an
    // ArrayBuffer directly, and every caller hands this straight to
    // decodeFrame.
    return globalThis.__skal_store_get(this._h, key) || null;
  }

  // The store is mmap-backed — the OS persists dirty pages; there is no
  // separate flush step.
  flush() {}

  // Reclaim one dead-heavy segment in the native engine; returns whether
  // anything was compacted (so the store can refresh its stats).
  // GUARDED like allKeys/delPrefix/getMany, and for the same reason: a JS
  // bundle newer than the dylib. All nine hooks install together in
  // installStoreGlobals (patches/skal_entry.zig), so a MATCHED pair always
  // has them — the skew case is the one the siblings already defend, and
  // these two were the only readers reaching for a hook bare.
  //
  // stats() is the one that bit: db.js calls it on every init, so an absent
  // hook threw the store dead during initialization instead of taking the
  // zeroed-stats branch three lines down, which existed the whole time and
  // was simply unreachable.
  compact() {
    const fn = globalThis.__skal_store_compact;
    return (typeof fn === 'function') ? !!fn(this._h) : false;
  }

  stats() {
    const fn = globalThis.__skal_store_stats;
    const ab = (this._h && typeof fn === 'function') ? fn(this._h) : null;
    if (!ab) {
      return { backend: 'native', records: 0, segments: 0, deadBytes: 0, seq: 0 };
    }
    const dv = new DataView(ab);
    return {
      backend: 'native',
      records: dv.getUint32(0, true),
      segments: dv.getUint32(4, true),
      deadBytes: dv.getUint32(8, true),
      seq: dv.getUint32(12, true),
    };
  }
}
