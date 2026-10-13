// stale-bundle.js — bring apps made before 2026-10 up to the fix for
// release builds that kept running the previous version's JS.
//
// Until then the app template copied skal-app.cjs and its .jsc out of the
// assets only when no copy existed yet. An update keeps the app's data
// directory, so a release app ran the JS it was first installed with after
// every update — and after a Skal upgrade that old JS can fail against the
// new libskal. The runtime's template now carries the fix:
//
//   flutter-host/lib/skal_bundle.dart   re-checks the copy on every launch
//   scripts/skal-bundle-stamp.js        lets that check skip reading the bundle
//
// An app scaffolded before it needs up to four edits, all made here:
//
//   1. add flutter-host/lib/skal_bundle.dart, copied from the runtime
//   2. the old _extractBytecodeAssets() hands off to it (main.dart, or
//      wherever under lib/ it lives)
//   3. package.json: build:bytecode writes the stamp
//   4. pubspec.yaml, for apps made before 2026-07-19: list assets/ so the
//      stamp is bundled at all
//
// Each edit replaces only text Skal generated, matched exactly, and that
// includes skal_bundle.dart itself: it is replaced only while it is
// byte-identical to a version Skal shipped (KNOWN_BUNDLES). Anything a
// developer changed is reported, never rewritten.

import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { standalonePackageJson } from './create.js';

const TEMPLATE = join('scripts', 'templates', 'default');
const LIB = join('flutter-host', 'lib');
const BUNDLE_DART = join(LIB, 'skal_bundle.dart');
const PUBSPEC = join('flutter-host', 'pubspec.yaml');
const STAMP_SCRIPT = join('scripts', 'skal-bundle-stamp.js');

/**
 * sha256 of every skal_bundle.dart Skal has shipped, oldest first. A copy
 * matching one of these is Skal's own, so a newer one may replace it; any
 * other copy was edited and is left alone. When the template's
 * skal_bundle.dart changes, append its new hash here — a test fails until
 * you do — and keep the old ones, or apps on them stop being upgraded.
 */
export const KNOWN_BUNDLES = [
  '3e19c980c459a865adf257cb640d841d807e18032273564c19a5196a511308fa', // 2026-10-12
];

// Every template from the first public commit to 2026-10-08 shipped this
// function byte for byte (and `dart format` leaves it as it is), so an
// exact match is safe.
const OLD_EXTRACT = [
  'Future<String> _extractBytecodeAssets() async {',
  '  final support = await getApplicationSupportDirectory();',
  "  final out = '${support.path}/skal-bundle';",
  '  Directory(out).createSync(recursive: true);',
  "  final cjs = File('$out/skal-app.cjs');",
  "  final jsc = File('$out/skal-app.cjs.jsc');",
  '  if (!cjs.existsSync()) {',
  "    final bytes = await rootBundle.load('assets/skal-app.cjs');",
  '    cjs.writeAsBytesSync(bytes.buffer.asUint8List());',
  '  }',
  '  if (!jsc.existsSync()) {',
  "    final bytes = await rootBundle.load('assets/skal-app.cjs.jsc');",
  '    jsc.writeAsBytesSync(bytes.buffer.asUint8List());',
  '  }',
  '  return cjs.path;',
  '}',
].join('\n');

// Same name and signature, so the call site in _boot stays as it is.
const NEW_EXTRACT = [
  "// The copy that stood here skipped the bundle whenever one existed, so",
  "// an update kept running the previous version's JS. skal_bundle.dart",
  '// re-checks it on every launch.',
  'Future<String> _extractBytecodeAssets() async {',
  '  final support = await getApplicationSupportDirectory();',
  "  return extractSkalBundle('${support.path}/skal-bundle');",
  '}',
].join('\n');

// The template's build:bytecode for the same span, untouched by create.js's
// rewiring (it names only app-local scripts).
const OLD_BYTECODE = "bash -c 'BUN=$(./scripts/find-vendored-bun.sh) && \"$BUN\" build ./flutter-host/assets/skal-app.js --bytecode --format=cjs --outdir=./flutter-host/assets/ --entry-naming=skal-app.cjs --root=./flutter-host/assets'";

// The pubspec asset list templates carried until 2026-07-19. Every entry is
// explicit, so a stamp is never bundled; later templates list `assets/`,
// the directory, which picks it up.
const OLD_PUBSPEC_ASSETS = [
  '  assets:',
  '    - assets/skal-app.js',
  '    - assets/skal-app.cjs',
  '    - assets/skal-app.cjs.jsc',
].join('\n');
const NEW_PUBSPEC_ASSETS = [
  OLD_PUBSPEC_ASSETS,
  '    # skal-app.stamp lets a relaunch check the extracted copy without',
  '    # reading the bundle (lib/skal_bundle.dart). It rides the directory',
  '    # entry so a bundle built before the stamp existed still builds.',
  '    - assets/',
].join('\n');
// `- assets/` (the directory) or `- assets/skal-app.stamp` bundles it.
const BUNDLES_STAMP = /^\s*-\s*["']?assets\/(?:skal-app\.stamp)?["']?\s*(?:#.*)?$/m;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** True when `runtime` carries the fix, i.e. --fix has something to copy. */
export function runtimeHasFix(runtime) {
  return !!runtime && existsSync(join(runtime, TEMPLATE, BUNDLE_DART))
    && existsSync(join(runtime, STAMP_SCRIPT));
}

/** A short name for a runtime in messages: its commit, else its folder. */
export function runtimeLabel(runtime) {
  try {
    const meta = JSON.parse(readFileSync(join(runtime, 'runtime.json'), 'utf8'));
    return String(meta.commit || meta.id).slice(0, 12);
  } catch {
    return runtime ? basename(runtime) : 'none';
  }
}

/** build:bytecode as a fresh `skal create` from `runtime` would write it. */
function freshBytecodeScript(runtime, name) {
  const text = readFileSync(join(runtime, TEMPLATE, 'package.json'), 'utf8')
    .replaceAll('__APP_NAME_SNAKE__', name.replaceAll('-', '_'))
    .replaceAll('__APP_NAME__', name);
  return JSON.parse(standalonePackageJson(text, name)).scripts['build:bytecode'];
}

/** Every .dart file under flutter-host/lib except skal_bundle.dart. */
function hostSources(appRoot) {
  const ours = join(appRoot, BUNDLE_DART);
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.dart') && p !== ours) out.push(p);
    }
  };
  walk(join(appRoot, LIB));
  return out.map((p) => ({ path: p, text: read(p) ?? '' }));
}

/** Compare the app's skal_bundle.dart with the runtime's. */
function bundleFileState(ours, theirs, known) {
  if (theirs === null || ours === theirs) return 'current';
  const mine = known.indexOf(sha256(ours));
  if (mine < 0) return 'edited';
  // A runtime copy this CLI doesn't know is newer than everything it does:
  // runtimes are released, never edited.
  const runtimes = known.indexOf(sha256(theirs));
  return runtimes >= 0 && runtimes < mine ? 'newer' : 'outdated';
}

/**
 * Where an app stands.
 *   main        'none'   no Dart file under lib/ copies a bundle
 *               'old'    the template's copy-once code, in `oldFiles`
 *               'edited' copies a bundle with code Skal did not write
 *               'fixed'  calls extractSkalBundle()
 *   bundleFile  'missing' | 'current' | 'outdated' | 'newer' | 'edited'
 *   stamp       'old' | 'written' | 'custom'   — package.json build:bytecode
 *   pubspec     'bundles' | 'old' | 'custom'   — is the stamp bundled at all
 * `known` overrides KNOWN_BUNDLES, for tests.
 */
export function inspectApp(appRoot, runtime, { known = KNOWN_BUNDLES } = {}) {
  const state = {
    main: 'none', oldFiles: [], bundleFile: 'missing', stamp: 'custom', pubspec: 'custom',
  };

  const sources = hostSources(appRoot);
  state.oldFiles = sources.filter((s) => s.text.includes(OLD_EXTRACT))
    .map((s) => relative(appRoot, s.path));
  if (state.oldFiles.length) state.main = 'old';
  else if (sources.some((s) => s.text.includes('extractSkalBundle('))) state.main = 'fixed';
  else if (sources.some((s) => /_extractBytecodeAssets|skal-bundle|skal-app\.cjs/.test(s.text))) {
    state.main = 'edited';
  }

  const ours = read(join(appRoot, BUNDLE_DART));
  if (ours !== null) {
    const theirs = runtime ? read(join(runtime, TEMPLATE, BUNDLE_DART)) : null;
    state.bundleFile = bundleFileState(ours, theirs, known);
  }

  let script;
  try {
    script = JSON.parse(read(join(appRoot, 'package.json')) ?? '{}')
      .scripts?.['build:bytecode'];
  } catch {}
  if (script === OLD_BYTECODE) state.stamp = 'old';
  else if (script?.includes('skal-bundle-stamp.js')) state.stamp = 'written';

  const pubspec = read(join(appRoot, PUBSPEC)) ?? '';
  if (BUNDLES_STAMP.test(pubspec)) state.pubspec = 'bundles';
  else if (pubspec.includes(OLD_PUBSPEC_ASSETS)) state.pubspec = 'old';
  return state;
}

/**
 * Doctor lines for an app: [{ label, pass, warn?, detail }]. Empty when no
 * Dart file copies a bundle. A line fails only when there is something to
 * do about it now; one that needs a newer runtime, or a developer's
 * judgement, is a warning.
 */
export function checkStaleBundle(appRoot, runtime, opts = {}) {
  const s = inspectApp(appRoot, runtime, opts);
  if (s.main === 'none') return [];
  const fixable = runtimeHasFix(runtime);
  const fix = 'run: skal doctor --fix';
  const later = `the fix needs a runtime newer than ${runtimeLabel(runtime)} — `
    + '`skal upgrade` installs one once it is released';
  const fail = (label, detail) => ({ label, pass: false, detail });
  const warn = (label, detail) => ({ label, pass: false, warn: true, detail });
  const lines = [];

  const stale = 'release builds keep the old JS after an update';
  if (s.main === 'old') {
    lines.push(fixable ? fail('bundle refresh', `${stale} — ${fix}`)
      : warn('bundle refresh', `${stale}; ${later}`));
  } else if (s.main === 'edited') {
    lines.push(warn('bundle refresh', 'the bundle is copied by code Skal did not write — '
      + 'check that it re-copies after an update, or call extractSkalBundle() '
      + 'from skal_bundle.dart (CHANGELOG, 2026-10)'));
  } else if (s.bundleFile === 'missing') {
    lines.push(fail('bundle refresh', 'extractSkalBundle() is called but '
      + `flutter-host/lib/skal_bundle.dart is missing — ${fixable ? fix
        : 'copy it from Skal\'s app template'}`));
  } else if (s.bundleFile === 'outdated') {
    lines.push(fail('bundle refresh', `skal_bundle.dart is an older Skal version — ${fix}`));
  } else if (s.bundleFile === 'edited') {
    lines.push(warn('bundle refresh', 'skal_bundle.dart has changes Skal did not make, '
      + 'so --fix leaves it alone — compare it with '
      + `.skal-runtime/${TEMPLATE}/${BUNDLE_DART}`));
  } else {
    lines.push({ label: 'bundle refresh', pass: true, detail: 're-checked on every launch' });
  }

  // The stamp only matters to extractSkalBundle(), and only helps if
  // build:bytecode writes it AND pubspec.yaml bundles it; without either,
  // every launch byte-compares the .cjs.
  if (s.main !== 'fixed') return lines;
  const slow = 'so each launch reads the whole .cjs to check it';
  if (s.stamp === 'written' && !(runtime && existsSync(join(runtime, STAMP_SCRIPT)))) {
    lines.push(fail('bundle stamp', 'build:bytecode runs skal-bundle-stamp.js, which runtime '
      + `${runtimeLabel(runtime)} lacks, so \`bun run build\` fails — run: skal upgrade`));
  } else if (s.stamp !== 'written') {
    lines.push(warn('bundle stamp', `build:bytecode writes no stamp, ${slow} — ${
      s.stamp === 'custom' ? 'have it delete skal-app.stamp before compiling and run '
        + '.skal-runtime/scripts/skal-bundle-stamp.js after'
        : fixable ? fix : later}`));
  } else if (s.pubspec !== 'bundles') {
    lines.push(warn('bundle stamp', `pubspec.yaml does not bundle skal-app.stamp, ${slow} — ${
      s.pubspec === 'old' ? (fixable ? fix : later)
        : 'list `- assets/` under flutter: assets:'}`));
  } else {
    lines.push({ label: 'bundle stamp', pass: true,
      detail: 'built by build:bytecode, bundled by pubspec.yaml' });
  }
  return lines;
}

/**
 * Apply whatever part of the fix the app lacks. Returns
 * { changed: [paths], skipped: [reasons], runtimeTooOld }. Idempotent, and
 * a runtime without the fix changes nothing.
 */
export function fixStaleBundle(appRoot, runtime, name, opts = {}) {
  const changed = [];
  const skipped = [];
  const s = inspectApp(appRoot, runtime, opts);
  if (s.main === 'none') return { changed, skipped, runtimeTooOld: false };
  if (!runtimeHasFix(runtime)) return { changed, skipped, runtimeTooOld: true };
  if (s.main === 'edited') {
    skipped.push('the bundle is copied by code Skal did not write; left alone — '
      + 'call extractSkalBundle() from skal_bundle.dart instead');
    return { changed, skipped, runtimeTooOld: false };
  }

  if (s.bundleFile === 'missing' || s.bundleFile === 'outdated') {
    copyFileSync(join(runtime, TEMPLATE, BUNDLE_DART), join(appRoot, BUNDLE_DART));
    changed.push(BUNDLE_DART);
  } else if (s.bundleFile === 'edited') {
    skipped.push('flutter-host/lib/skal_bundle.dart has changes Skal did not make; left alone');
  }

  for (const file of s.oldFiles) {
    const path = join(appRoot, file);
    let text = readFileSync(path, 'utf8');
    // An import has to go in the library, not in a part of it.
    if (/^part of\b/m.test(text)) {
      skipped.push(`${file} is a part file; replace its _extractBytecodeAssets() `
        + 'with a call to extractSkalBundle() and import skal_bundle.dart in its library');
      continue;
    }
    text = text.replace(OLD_EXTRACT, NEW_EXTRACT);
    const target = relative(dirname(path), join(appRoot, BUNDLE_DART)).split(sep).join('/');
    if (!/^import\s+['"][^'"]*skal_bundle\.dart['"]/m.test(text)) {
      // After the last import directive; a relative import is its own group.
      const imports = [...text.matchAll(/^import\s[^;]*;/gm)];
      const at = imports.length ? imports.at(-1).index + imports.at(-1)[0].length : 0;
      text = `${text.slice(0, at)}\n\nimport '${target}';${text.slice(at)}`;
    }
    writeFileSync(path, text);
    changed.push(file);
  }

  if (s.stamp === 'old') {
    const path = join(appRoot, 'package.json');
    const text = readFileSync(path, 'utf8');
    const old = `"build:bytecode": ${JSON.stringify(OLD_BYTECODE)}`;
    const fresh = `"build:bytecode": ${JSON.stringify(freshBytecodeScript(runtime, name))}`;
    if (text.includes(old)) {
      writeFileSync(path, text.replace(old, fresh));
      changed.push('package.json');
    } else {
      skipped.push('package.json: build:bytecode is formatted unusually; '
        + 'add the stamp step by hand');
    }
  } else if (s.stamp === 'custom') {
    skipped.push('package.json: build:bytecode is custom — have it delete '
      + 'skal-app.stamp before compiling and run '
      + '.skal-runtime/scripts/skal-bundle-stamp.js after');
  }

  if (s.pubspec === 'old') {
    const path = join(appRoot, PUBSPEC);
    writeFileSync(path, readFileSync(path, 'utf8').replace(OLD_PUBSPEC_ASSETS, NEW_PUBSPEC_ASSETS));
    changed.push(PUBSPEC);
  } else if (s.pubspec === 'custom') {
    skipped.push('flutter-host/pubspec.yaml: list `- assets/` under flutter: assets: '
      + 'so skal-app.stamp is bundled');
  }
  return { changed, skipped, runtimeTooOld: false };
}
