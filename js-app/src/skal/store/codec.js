// codec.js — a compact binary value codec for the Skal store.
//
// Replaces JSON.stringify / JSON.parse on the hot encode/decode paths
// (every scalar value, every collection record, every delta patch).
// Values are written straight to a growable byte buffer — no giant
// intermediate JS string — with a one-byte type tag per value.
//
// Anything the binary path can't represent natively (bigint, etc.)
// falls back to a tagged JSON blob, so the codec never loses data.

const _enc = new TextEncoder();
const _dec = new TextDecoder();

const T_NULL = 0, T_FALSE = 1, T_TRUE = 2,
      T_INT = 3, T_FLOAT = 4, T_STR = 5,
      T_ARR = 6, T_OBJ = 7, T_JSON = 8;

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

// ── writer ──────────────────────────────────────────────────────────
class Writer {
  constructor() {
    this.buf = new Uint8Array(64);
    this.dv = new DataView(this.buf.buffer);
    this.len = 0;
  }
  _ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const grown = new Uint8Array(cap);
    grown.set(this.buf.subarray(0, this.len));
    this.buf = grown;
    this.dv = new DataView(grown.buffer);
  }
  u8(v) { this._ensure(1); this.buf[this.len++] = v & 0xFF; }
  u32(v) { this._ensure(4); this.dv.setUint32(this.len, v >>> 0, true); this.len += 4; }
  i32(v) { this._ensure(4); this.dv.setInt32(this.len, v | 0, true); this.len += 4; }
  f64(v) { this._ensure(8); this.dv.setFloat64(this.len, v, true); this.len += 8; }
  blob(b) { this._ensure(b.length); this.buf.set(b, this.len); this.len += b.length; }
  // A length-prefixed UTF-8 string (used for both string values and
  // object keys).
  str(b) { this.u32(b.length); this.blob(b); }
  take() { return this.buf.subarray(0, this.len); }
}

function _write(w, v) {
  if (v === null || v === undefined) { w.u8(T_NULL); return; }
  const t = typeof v;
  if (t === 'boolean') { w.u8(v ? T_TRUE : T_FALSE); return; }
  if (t === 'number') {
    if (Number.isInteger(v) && v >= I32_MIN && v <= I32_MAX) {
      w.u8(T_INT); w.i32(v);
    } else if (Number.isFinite(v)) {
      w.u8(T_FLOAT); w.f64(v);
    } else {
      w.u8(T_NULL);                 // NaN / ±Infinity — JSON renders null
    }
    return;
  }
  if (t === 'string') { w.u8(T_STR); w.str(_enc.encode(v)); return; }
  if (Array.isArray(v)) {
    w.u8(T_ARR); w.u32(v.length);
    for (let i = 0; i < v.length; i++) _write(w, v[i]);
    return;
  }
  if (t === 'object') {
    // Plain object — also covers Solid store proxies, which expose
    // their keys transparently. Skip undefined-valued keys, matching
    // JSON.stringify.
    const keys = Object.keys(v);
    let count = 0;
    for (let i = 0; i < keys.length; i++) {
      if (v[keys[i]] !== undefined) count++;
    }
    w.u8(T_OBJ); w.u32(count);
    for (let i = 0; i < keys.length; i++) {
      const val = v[keys[i]];
      if (val === undefined) continue;
      w.str(_enc.encode(keys[i]));
      _write(w, val);
    }
    return;
  }
  // function / symbol / bigint — JSON fallback (may itself drop it,
  // exactly as a plain JSON.stringify would).
  w.u8(T_JSON); w.str(_enc.encode(JSON.stringify(v)));
}

// ── reader ──────────────────────────────────────────────────────────
function _readStr(r) {
  const n = r.dv.getUint32(r.off, true); r.off += 4;
  const s = _dec.decode(r.buf.subarray(r.off, r.off + n));
  r.off += n;
  return s;
}

function _read(r) {
  const t = r.buf[r.off++];
  switch (t) {
    case T_NULL:  return null;
    case T_FALSE: return false;
    case T_TRUE:  return true;
    case T_INT:   { const v = r.dv.getInt32(r.off, true); r.off += 4; return v; }
    case T_FLOAT: { const v = r.dv.getFloat64(r.off, true); r.off += 8; return v; }
    case T_STR:   return _readStr(r);
    case T_ARR: {
      const n = r.dv.getUint32(r.off, true); r.off += 4;
      const a = new Array(n);
      for (let i = 0; i < n; i++) a[i] = _read(r);
      return a;
    }
    case T_OBJ: {
      const n = r.dv.getUint32(r.off, true); r.off += 4;
      const o = {};
      for (let i = 0; i < n; i++) { const k = _readStr(r); o[k] = _read(r); }
      return o;
    }
    case T_JSON:  return JSON.parse(_readStr(r));
    default:      throw new Error('skal-codec: bad tag ' + t);
  }
}

// ── public API ──────────────────────────────────────────────────────
export function encodeValue(v) {
  const w = new Writer();
  _write(w, v);
  return w.take();
}

export function decodeValue(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const r = {
    buf: bytes,
    off: 0,
    dv: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  };
  return _read(r);
}
