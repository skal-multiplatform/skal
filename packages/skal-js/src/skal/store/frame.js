// frame.js — the on-disk record format for the Skal log store.
//
// Every record in every segment is one frame:
//
//   crc32   u32   4   CRC of everything after it
//   seq     u32   4   global write sequence — highest wins on recovery
//   flags   u8    1   bit0 = tombstone (deleted)
//   keyLen  u16   2
//   valLen  u32   4
//   key     bytes keyLen   UTF-8
//   value   bytes valLen   opaque payload
//                          ─ header = 15 bytes
//
// The frame is the unit of storage, granularity, and crash-recovery: a
// torn tail (a half-written last frame) simply fails its CRC and is
// ignored, so a crash never corrupts a committed record.

export const FRAME_HEADER = 15;
export const FLAG_TOMBSTONE = 1;

// ── CRC32 (IEEE 802.3 polynomial) ──────────────────────────────────
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xFFFFFFFF;
  for (let i = start; i < end; i++) {
    c = _crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Encode one frame straight into `dst` at byte offset `off` — no
// intermediate allocation. `key` and `value` are Uint8Array; `dst`
// must already have room for FRAME_HEADER + key + value bytes at
// `off` (the engine reserves the slot in the mmap / segment buffer
// before calling). Returns the frame's total byte length.
export function encodeFrameInto(dst, off, seq, flags, key, value) {
  const total = FRAME_HEADER + key.length + value.length;
  const dv = new DataView(dst.buffer, dst.byteOffset + off, total);
  dv.setUint32(4, seq >>> 0, true);
  dst[off + 8] = flags & 0xFF;
  dv.setUint16(9, key.length, true);
  dv.setUint32(11, value.length, true);
  dst.set(key, off + FRAME_HEADER);
  dst.set(value, off + FRAME_HEADER + key.length);
  // crc covers everything after it — computed over the just-written slice.
  dv.setUint32(0, crc32(dst, off + 4, off + total), true);
  return total;
}

// Decode the frame at `offset` in `bytes`. Returns null when the frame
// is incomplete (a torn tail) or fails its CRC — callers treat that as
// "stop scanning here". `verify` defaults true; pass false on the hot
// read path, where the keydir already vouches for a committed frame
// and the CRC re-check is pure cost. Recovery scans MUST keep it true
// (the CRC is what distinguishes a real frame from zero padding).
export function decodeFrame(bytes, offset, verify = true) {
  if (offset + FRAME_HEADER > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const crc    = dv.getUint32(offset, true);
  const seq    = dv.getUint32(offset + 4, true);
  const flags  = bytes[offset + 8];
  const keyLen = dv.getUint16(offset + 9, true);
  const valLen = dv.getUint32(offset + 11, true);
  const total  = FRAME_HEADER + keyLen + valLen;
  if (offset + total > bytes.length) return null;                 // torn
  if (verify && crc32(bytes, offset + 4, offset + total) !== crc) {
    return null;                                                  // corrupt
  }
  const keyStart = offset + FRAME_HEADER;
  const valStart = keyStart + keyLen;
  return {
    seq,
    flags,
    total,
    key: bytes.subarray(keyStart, valStart),
    value: bytes.subarray(valStart, valStart + valLen),
  };
}
