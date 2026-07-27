// store.test.js — LogStore recovery and segment-lifecycle coverage.
//
// The store is the only subsystem in Skal that can hand back silently
// WRONG data: every other failure mode is a crash, a missing frame, or
// a dropped paint. It had no tests at all, and a data-corruption bug
// lived in `open()` behind a comment asserting the opposite ("a stale
// one is still safe"). This file exists so that class of bug has to get
// past something.
//
// Everything here runs against BOTH pure-JS backends. `MemoryBackend`
// and `FsBackend` differ in how a reopen sees prior state — one keeps
// the same object graph, the other re-reads bytes off disk — and the
// recovery paths are exactly where that difference bites. `MmapBackend`
// needs `Bun.mmap` over real files and is exercised by the native
// store's own harness; `NativeLogStore` runs entirely inside libskal.
//
// White-box in two places, deliberately:
//   - `_lastHintMs` is frozen to suppress hint writes. That is how a
//     crash inside the 1 s `HINT_THROTTLE_MS` window presents, and it
//     is deterministic where sleeping is not.
//   - `_active.id` is asserted directly. Which segment takes appends is
//     the invariant under test; asserting only on reads would let a
//     future regression hide until it aliased something.

import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LogStore, MemoryBackend, FsBackend } from '../src/skal/store/engine.js';
import { decodeFrame, FLAG_TOMBSTONE } from '../src/skal/store/frame.js';

const SEG_SIZE = 256 * 1024;      // must track engine.js
const FRAME_HEADER = 15;          // must track frame.js

const fill = (n, byte) => { const u = new Uint8Array(n); u.fill(byte); return u; };
const str = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

// Suppress further hint writes without touching the clock. Every write
// path gates on `_nowMs() - _lastHintMs >= HINT_THROTTLE_MS`, so a
// far-future stamp freezes the hint at whatever it last held.
const freezeHint = (store) => { store._lastHintMs = Number.MAX_SAFE_INTEGER; };

// Every keydir entry must land on a frame that actually carries that
// key. This is the invariant aliasing breaks, and — unlike a spot-check
// on one value — it cannot be satisfied by accident: two keys pointing
// at one frame always trips it, whichever of them you happen to read.
//
// Worth stating why it earns its keep. Reading a single key back after
// a stale-hint reopen can SELF-HEAL: the recovery scan re-derives the
// physical offset of the last frame, and for a two-record shape that
// lands on the right answer even though the keydir it was built from
// was wrong. A check over the whole keydir has nowhere to hide.
function expectKeydirConsistent(store) {
  const bad = [];
  for (const [key, e] of store._keydir) {
    const bytes = store._segBytes(e.seg);
    if (!bytes) { bad.push(`${key}: segment ${e.seg} missing`); continue; }
    const f = decodeFrame(bytes, e.off);
    if (!f) { bad.push(`${key}: no frame at seg ${e.seg}+${e.off}`); continue; }
    const got = dec(f.key);
    if (got !== key) bad.push(`${key}: seg ${e.seg}+${e.off} holds "${got}"`);
    if (f.flags & FLAG_TOMBSTONE) bad.push(`${key}: keydir points at a tombstone`);
  }
  expect(bad).toEqual([]);
}

// ── Backend harnesses ──────────────────────────────────────────────
// `backend()` yields a handle onto the SAME durable storage each call,
// so `new LogStore(h.backend())` is a faithful reopen.

const HARNESSES = [
  {
    name: 'MemoryBackend',
    make() {
      const b = new MemoryBackend();
      return { backend: () => b, dispose() {} };
    },
  },
  {
    name: 'FsBackend',
    make() {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-store-test-'));
      return {
        backend: () => new FsBackend(fs, path, root),
        root,
        dispose() { fs.rmSync(root, { recursive: true, force: true }); },
      };
    },
  },
];

for (const harness of HARNESSES) {
  describe(harness.name, () => {
    let h;
    const open = () => { const s = new LogStore(h.backend()); s.open(); return s; };
    afterEach(() => { h?.dispose(); h = null; });
    const start = () => { h = harness.make(); return open(); };

    // ── basics ─────────────────────────────────────────────────────

    describe('roundtrip', () => {
      test('put / get / del', () => {
        const s = start();
        s.put('a', str('alpha'));
        s.put('b', str('beta'));
        expect(dec(s.get('a'))).toBe('alpha');
        expect(dec(s.get('b'))).toBe('beta');
        expect(s.get('missing')).toBeNull();
        s.del('a');
        expect(s.get('a')).toBeNull();
        expect(dec(s.get('b'))).toBe('beta');
      });

      test('last write wins', () => {
        const s = start();
        s.put('k', str('one'));
        s.put('k', str('two'));
        s.put('k', str('three'));
        expect(dec(s.get('k'))).toBe('three');
      });

      test('survives a clean reopen', () => {
        const s = start();
        s.put('k', str('durable'));
        s.flush();
        expect(dec(open().get('k'))).toBe('durable');
      });

      test('deletions survive a reopen', () => {
        const s = start();
        s.put('gone', str('x'));
        s.put('kept', str('y'));
        s.flush();
        s.del('gone');
        s.flush();
        const s2 = open();
        expect(s2.get('gone')).toBeNull();
        expect(dec(s2.get('kept'))).toBe('y');
      });
    });

    // ── the P0 ─────────────────────────────────────────────────────
    //
    // A hint naming an older tail must never be read back as the active
    // segment. If it is, the next seal advances onto an id that already
    // exists and writes frames at offsets that alias the ones there.

    describe('stale hint', () => {
      // Leaves the store with segments [0, 1] on disk and a hint that
      // still names segment 0 as the tail.
      function staleAfterOneSeal() {
        const s = start();
        s.put('anchor', str('anchor-value'));
        s.flush();                       // hint written: tail = segment 0
        freezeHint(s);                   // crash before the next one
        s.put('a', fill(100 * 1024, 1));
        s.put('b', fill(100 * 1024, 2));
        s.put('c', fill(100 * 1024, 3)); // overflows segment 0 → seal
        s.flush();
        expect(s._active.id).toBe(1);
        expect(h.backend().listSegments()).toEqual([0, 1]);
        return s;
      }

      test('reopen picks the newest segment, not the hint tail', () => {
        staleAfterOneSeal();
        expect(open()._active.id).toBe(1);
      });

      test('a later write does not alias existing records', () => {
        staleAfterOneSeal();
        const s2 = open();
        expect(s2.get('c')[0]).toBe(3);  // sane before the write

        s2.put('d', fill(100 * 1024, 9));
        s2.flush();

        const c = s2.get('c');
        const d = s2.get('d');
        expect(c.length).toBe(100 * 1024);
        expect(c[0]).toBe(3);
        expect(c[c.length - 1]).toBe(3);
        expect(d.length).toBe(100 * 1024);
        expect(d[0]).toBe(9);
        expect(dec(s2.get('anchor'))).toBe('anchor-value');
      });

      test('no two keys end up pointing at the same frame', () => {
        staleAfterOneSeal();
        const s2 = open();
        s2.put('d', fill(100 * 1024, 9));
        s2.flush();
        expectKeydirConsistent(s2);
        expectKeydirConsistent(open());
      });

      test('holds when the hint is stale by several seals', () => {
        const s = start();
        s.put('anchor', str('v'));
        s.flush();                       // hint: tail = segment 0
        freezeHint(s);
        const marks = [];
        for (let i = 0; i < 9; i++) {
          marks.push(`k${i}`);
          s.put(`k${i}`, fill(100 * 1024, i + 1));
        }
        s.flush();
        expect(h.backend().listSegments().length).toBeGreaterThan(2);

        const s2 = open();
        expect(s2._active.id).toBe(h.backend().listSegments().at(-1));
        s2.put('after', fill(100 * 1024, 200));
        s2.flush();

        for (let i = 0; i < marks.length; i++) {
          const v = s2.get(marks[i]);
          expect(v.length).toBe(100 * 1024);
          expect(v[0]).toBe(i + 1);
        }
        expect(s2.get('after')[0]).toBe(200);
        expectKeydirConsistent(s2);
      });

      test('repeated seals after a stale reopen stay consistent', () => {
        staleAfterOneSeal();
        const s2 = open();
        const before = h.backend().listSegments();
        for (let i = 0; i < 4; i++) s2.put(`spill-${i}`, fill(200 * 1024, 100 + i));
        s2.flush();

        const after = h.backend().listSegments();
        expect(new Set(after).size).toBe(after.length);       // no id reused
        expect(Math.max(...after)).toBeGreaterThan(Math.max(...before));
        expect(s2._active.id).toBe(Math.max(...after));
        expectKeydirConsistent(s2);

        for (let i = 0; i < 4; i++) expect(s2.get(`spill-${i}`)[0]).toBe(100 + i);
        expect(s2.get('c')[0]).toBe(3);
      });
    });

    // ── hint recovery ──────────────────────────────────────────────

    describe('hint recovery', () => {
      function twoSegments() {
        const s = start();
        s.put('a', fill(100 * 1024, 1));
        s.put('b', fill(100 * 1024, 2));
        s.put('c', fill(100 * 1024, 3));
        s.flush();
        return s;
      }

      test('full scan when no hint exists', () => {
        twoSegments();
        const b = h.backend();
        if (b.kind === 'memory') b._meta.delete('hint');
        else fs.rmSync(path.join(h.root, 'meta-hint'), { force: true });

        const s2 = open();
        expect(s2.get('a')[0]).toBe(1);
        expect(s2.get('b')[0]).toBe(2);
        expect(s2.get('c')[0]).toBe(3);
        expect(s2._active.id).toBe(b.listSegments().at(-1));
      });

      test('a corrupt hint falls back to a full scan', () => {
        twoSegments();
        h.backend().metaPut('hint', fill(64, 0xAB));   // bad magic
        const s2 = open();
        expect(s2.get('a')[0]).toBe(1);
        expect(s2.get('c')[0]).toBe(3);
      });

      test('a truncated hint falls back to a full scan', () => {
        const s = twoSegments();
        const raw = h.backend().metaGet('hint');
        h.backend().metaPut('hint', raw.subarray(0, Math.min(40, raw.length)));
        const s2 = open();
        expect(s2.get('a')[0]).toBe(1);
        expect(s2.get('c')[0]).toBe(3);
        expect(s2._seq).toBeGreaterThanOrEqual(s._seq);
      });

      test('a hint naming a vanished segment is distrusted', () => {
        twoSegments();
        const b = h.backend();
        const oldest = b.listSegments()[0];
        b.dropSegment(oldest);            // behind the store's back
        const s2 = open();
        // Whatever survived must still read back as itself, and the
        // active segment must be the newest thing left.
        expect(s2._active.id).toBe(b.listSegments().at(-1));
        for (const [k, v] of [['a', 1], ['b', 2], ['c', 3]]) {
          const got = s2.get(k);
          if (got) expect(got[0]).toBe(v);
        }
      });
    });

    // ── segment lifecycle ──────────────────────────────────────────

    describe('segment boundaries', () => {
      test('a frame that exactly fills the segment does not seal early', () => {
        const s = start();
        const key = 'exact';
        const value = fill(SEG_SIZE - FRAME_HEADER - key.length, 5);
        s.put(key, value);
        s.flush();
        expect(s._active.id).toBe(0);
        expect(s.get(key).length).toBe(value.length);
        expect(open().get(key)[0]).toBe(5);
      });

      test('one byte past the boundary seals', () => {
        const s = start();
        s.put('exact', fill(SEG_SIZE - FRAME_HEADER - 5, 5));
        s.put('next', str('spill'));
        s.flush();
        expect(s._active.id).toBe(1);
        const s2 = open();
        expect(s2.get('exact')[0]).toBe(5);
        expect(dec(s2.get('next'))).toBe('spill');
      });

      test('a value larger than a whole segment roundtrips', () => {
        const s = start();
        const huge = fill(SEG_SIZE * 3 + 77, 42);
        s.put('huge', huge);
        s.put('small', str('after'));
        s.flush();
        const s2 = open();
        expect(s2.get('huge').length).toBe(huge.length);
        expect(s2.get('huge')[0]).toBe(42);
        expect(s2.get('huge')[huge.length - 1]).toBe(42);
        expect(dec(s2.get('small'))).toBe('after');
      });

      test('many keys across many segments all survive a reopen', () => {
        const s = start();
        const n = 60;
        for (let i = 0; i < n; i++) s.put(`key-${i}`, fill(8 * 1024, i & 0xFF));
        s.flush();
        expect(h.backend().listSegments().length).toBeGreaterThan(1);
        const s2 = open();
        for (let i = 0; i < n; i++) {
          const v = s2.get(`key-${i}`);
          expect(v.length).toBe(8 * 1024);
          expect(v[0]).toBe(i & 0xFF);
        }
        expectKeydirConsistent(s2);
      });
    });

    describe('compaction', () => {
      test('preserves live values and deletions', () => {
        const s = start();
        // Churn one key hard so its segment goes mostly dead.
        for (let i = 0; i < 8; i++) s.put('churn', fill(100 * 1024, i));
        s.put('live', str('keep-me'));
        s.put('doomed', str('bye'));
        s.flush();
        s.del('doomed');
        s.flush();

        let ran = false;
        for (let i = 0; i < 8; i++) if (s.compact()) ran = true;
        expect(ran).toBe(true);

        expect(s.get('churn')[0]).toBe(7);
        expect(dec(s.get('live'))).toBe('keep-me');
        expect(s.get('doomed')).toBeNull();

        const s2 = open();
        expect(s2.get('churn')[0]).toBe(7);
        expect(dec(s2.get('live'))).toBe('keep-me');
        expect(s2.get('doomed')).toBeNull();
        expectKeydirConsistent(s2);
      });
    });

    // ── prefix delete ──────────────────────────────────────────────

    describe('delPrefix', () => {
      test('tombstones the subtree and nothing else', () => {
        const s = start();
        s.put('users.1', str('a'));
        s.put('users.2', str('b'));
        s.put('users#meta', str('m'));
        s.put('userspace', str('untouched'));
        s.put('posts.1', str('p'));
        s.delPrefix('users');
        s.flush();

        const s2 = open();
        expect(s2.get('users.1')).toBeNull();
        expect(s2.get('users.2')).toBeNull();
        expect(s2.get('users#meta')).toBeNull();
        expect(dec(s2.get('userspace'))).toBe('untouched');
        expect(dec(s2.get('posts.1'))).toBe('p');
      });
    });
  });
}
