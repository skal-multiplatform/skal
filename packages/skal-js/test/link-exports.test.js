// The four platform link scripts each carry their own exported-symbols
// list, and nothing kept them in agreement.
//
// They drifted: `skal_prewarm_store` was in the macOS and Linux/Android
// lists but missing from BOTH iOS ones, so on iPhone and the iOS
// Simulator `skal_ffi_io.dart`'s `lookupFunction('skal_prewarm_store')`
// threw, `main.dart` swallowed it with a bare `catch (_)`, and the
// native store prewarm — a boot optimisation whose entire job is to
// overlap the segment scan with bundle eval — silently never ran. On
// iOS only. For as long as the lists had been apart.
//
// Nothing could have caught that: it links, it loads, it boots, it
// renders, and the fallback path is correct-but-slower by design. The
// only observable is a symbol that is absent from one binary.
//
// So pin the two invariants instead:
//   1. every link script exports the same set of skal_* symbols;
//   2. that set covers every symbol the Dart FFI actually looks up.
//
// (2) is the one that matters — it ties the linker config to real usage,
// so adding an FFI binding without exporting it fails here rather than
// on one platform at runtime.
//
// This lives in the JS suite purely because that is what CI already runs
// on every push; it tests repo config, not JavaScript.

import { test, expect, describe } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

// Apple linkers take a symbols FILE with C names mangled (leading _);
// the GNU linker takes --export-dynamic-symbol= with the bare name.
const APPLE_SCRIPTS = [
  'scripts/link-libskal-flutter-mac.sh',
  'scripts/link-skal-iossim.sh',
  'scripts/link-skal-ios.sh',
];
const GNU_SCRIPT = 'scripts/link-libskal-flutter.sh';

const appleExports = (src) =>
  new Set((src.match(/^_skal_[a-z_]+$/gm) || []).map((s) => s.slice(1)));

const gnuExports = (src) =>
  new Set((src.match(/export-dynamic-symbol=(skal_[a-z_]+)/g) || [])
    .map((s) => s.split('=')[1]));

/// Every 'skal_*' string literal in the FFI binding — lookupFunction,
/// lookup, and the nullable/optional forms alike.
const dartLookups = () =>
  new Set((read('packages/skal_flutter/lib/skal_ffi_io.dart')
    .match(/'(skal_[a-z_]+)'/g) || []).map((s) => s.replace(/'/g, '')));

describe('libskal export lists', () => {
  test('every link script exports the same skal_* set', () => {
    const sets = [
      ...APPLE_SCRIPTS.map((p) => [p, appleExports(read(p))]),
      [GNU_SCRIPT, gnuExports(read(GNU_SCRIPT))],
    ];
    for (const [p, s] of sets) {
      expect(s.size, `${p} exported no skal_* symbols — parser out of date?`)
        .toBeGreaterThan(0);
    }
    const [refPath, ref] = sets[0];
    const expected = [...ref].sort();
    for (const [p, s] of sets.slice(1)) {
      expect([...s].sort(), `${p} disagrees with ${refPath}`).toEqual(expected);
    }
  });

  test('every symbol the Dart FFI looks up is exported everywhere', () => {
    const needed = dartLookups();
    expect(needed.size).toBeGreaterThan(5);
    // The one that actually broke — assert it by name so a regression
    // reads as itself rather than as a set diff.
    expect(needed.has('skal_prewarm_store')).toBe(true);

    for (const p of APPLE_SCRIPTS) {
      const have = appleExports(read(p));
      for (const sym of needed) {
        expect(have.has(sym), `${p} does not export ${sym}`).toBe(true);
      }
    }
    const gnu = gnuExports(read(GNU_SCRIPT));
    for (const sym of needed) {
      expect(gnu.has(sym), `${GNU_SCRIPT} does not export ${sym}`).toBe(true);
    }
  });

  test('an Apple export list also anchors each symbol against dead_strip',
       () => {
    // -dead_strip removes anything unreferenced; the exported list alone
    // does not keep a symbol alive, so each needs a -Wl,-u anchor too.
    // Exporting without anchoring links clean and drops the symbol.
    for (const p of APPLE_SCRIPTS) {
      const src = read(p);
      for (const sym of appleExports(src)) {
        expect(src.includes(`-Wl,-u,_${sym}`), `${p} exports ${sym} but does ` +
          `not anchor it with -Wl,-u,_${sym}`).toBe(true);
      }
    }
  });
});
