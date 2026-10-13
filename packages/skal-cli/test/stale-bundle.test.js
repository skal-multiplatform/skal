// The stale-bundle fix for apps scaffolded before 2026-10: `skal doctor`
// reports it, `--fix` and `skal upgrade` apply it.
//
// fixtures/old-app is the pre-fix template exactly as `skal create` wrote
// it — the input every existing app has (its package.json and pubspec.yaml
// match the real Pulse app's but for the name). fixtures/pubspec-2026-07-12
// is the pubspec templates shipped before 2026-07-19. The runtime is this
// checkout, which carries the fix.
//
//   node --test packages/skal-cli/test/stale-bundle.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { standalonePackageJson } from '../lib/create.js';
import {
  KNOWN_BUNDLES, checkStaleBundle, fixStaleBundle, inspectApp,
} from '../lib/stale-bundle.js';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/old-app', import.meta.url));
const PUBSPEC_0712 = fileURLToPath(new URL('./fixtures/pubspec-2026-07-12.yaml', import.meta.url));
const TEMPLATE = join(REPO, 'scripts/templates/default');
const MAIN = 'flutter-host/lib/main.dart';
const BUNDLE = 'flutter-host/lib/skal_bundle.dart';
const PUBSPEC = 'flutter-host/pubspec.yaml';
const CLI = join(REPO, 'packages/skal-cli/bin/skal.js');

/** A scratch copy of the pre-fix app, with skal.json pointing at `runtime`. */
function oldApp(t, runtime = REPO) {
  const dir = mkdtempSync(join(tmpdir(), 'skal-old-app-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(FIXTURE, dir, { recursive: true });
  writeFileSync(join(dir, 'skal.json'),
    JSON.stringify({ name: 'old-app', runtime }, null, 2) + '\n');
  return dir;
}

/** A runtime laid out like the ones released before the fix. */
function preFixRuntime(t) {
  const dir = mkdtempSync(join(tmpdir(), 'skal-old-runtime-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts/templates/default'), { recursive: true });
  writeFileSync(join(dir, 'runtime.json'),
    JSON.stringify({ id: '80a5b89ae0a9', commit: '80a5b89ae0a9757e152e41d7f5367cff33c884a1' }));
  return dir;
}

const read = (dir, p) => readFileSync(join(dir, p), 'utf8');
const bytecode = (dir) => JSON.parse(read(dir, 'package.json')).scripts['build:bytecode'];
const failures = (lines) => lines.filter((l) => !l.pass && !l.warn).map((l) => l.label);
const warnings = (lines) => lines.filter((l) => l.warn).map((l) => l.label);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const OLD_FN = /^Future<String> _extractBytecodeAssets\(\) async \{[\s\S]*?\n\}\n/m;
const DELEGATE = "return extractSkalBundle('${support.path}/skal-bundle');";

test('an app made before the fix is reported, with the way to fix it', (t) => {
  const app = oldApp(t);

  assert.deepEqual(inspectApp(app, REPO), {
    main: 'old', oldFiles: [MAIN], bundleFile: 'missing', stamp: 'old', pubspec: 'bundles',
  });
  const lines = checkStaleBundle(app, REPO);
  assert.deepEqual(failures(lines), ['bundle refresh']);
  assert.match(lines[0].detail, /keep the old JS after an update — run: skal doctor --fix/);
});

test('--fix makes exactly the three edits, and the app then passes', (t) => {
  const app = oldApp(t);
  const before = read(app, MAIN);

  const { changed, skipped } = fixStaleBundle(app, REPO, 'old-app');

  assert.deepEqual(changed, [BUNDLE, MAIN, 'package.json']);
  assert.deepEqual(skipped, []);
  assert.deepEqual(checkStaleBundle(app, REPO).map((l) => [l.label, l.pass]),
    [['bundle refresh', true], ['bundle stamp', true]]);

  // skal_bundle.dart is the runtime's, byte for byte.
  assert.equal(read(app, BUNDLE), read(TEMPLATE, BUNDLE));

  // main.dart: one function swapped, one import added, nothing else moved.
  const main = read(app, MAIN);
  assert.ok(main.includes(DELEGATE));
  assert.ok(!main.includes('if (!cjs.existsSync())'));
  assert.equal(main.split("import 'skal_bundle.dart';").length - 1, 1);
  assert.ok(main.includes(
    "import 'package:skal_flutter/skal_ffi.dart';\n\nimport 'skal_bundle.dart';\n\nvoid main()"));
  const untouched = (s) => s
    .replace(/\nimport 'skal_bundle\.dart';\n/, '')
    .replace(/(\/\/[^\n]*\n)*Future<String> _extractBytecodeAssets\(\) async \{[\s\S]*?\n\}\n/, '');
  assert.equal(untouched(main), untouched(before));

  // package.json: build:bytecode is what a fresh `skal create` writes.
  const fresh = JSON.parse(standalonePackageJson(
    read(TEMPLATE, 'package.json').replaceAll('__APP_NAME_SNAKE__', 'old_app')
      .replaceAll('__APP_NAME__', 'old-app'), 'old-app'));
  assert.equal(bytecode(app), fresh.scripts['build:bytecode']);
  const pkgBefore = JSON.parse(readFileSync(join(FIXTURE, 'package.json'), 'utf8'));
  const pkgAfter = JSON.parse(read(app, 'package.json'));
  delete pkgBefore.scripts['build:bytecode'];
  delete pkgAfter.scripts['build:bytecode'];
  assert.deepEqual(pkgAfter, pkgBefore);
});

test('an app made before 2026-07-19 also gets assets/ in its pubspec', (t) => {
  // Those templates listed every asset by name, so the stamp would never
  // be bundled and every launch would fall back to comparing the .cjs.
  const app = oldApp(t);
  const old = readFileSync(PUBSPEC_0712, 'utf8');
  writeFileSync(join(app, PUBSPEC), old);
  assert.equal(inspectApp(app, REPO).pubspec, 'old');

  const { changed } = fixStaleBundle(app, REPO, 'old-app');

  assert.deepEqual(changed, [BUNDLE, MAIN, 'package.json', PUBSPEC]);
  assert.equal(read(app, PUBSPEC), old.replace('    - assets/skal-app.cjs.jsc\n',
    '    - assets/skal-app.cjs.jsc\n'
    + '    # skal-app.stamp lets a relaunch check the extracted copy without\n'
    + '    # reading the bundle (lib/skal_bundle.dart). It rides the directory\n'
    + '    # entry so a bundle built before the stamp existed still builds.\n'
    + '    - assets/\n'));
  assert.deepEqual(checkStaleBundle(app, REPO).map((l) => [l.label, l.pass]),
    [['bundle refresh', true], ['bundle stamp', true]]);
});

test('a fixed app whose pubspec does not bundle the stamp is not passed', (t) => {
  // An app migrated before the pubspec check existed: everything else done.
  const app = oldApp(t);
  const old = readFileSync(PUBSPEC_0712, 'utf8');
  fixStaleBundle(app, REPO, 'old-app');
  writeFileSync(join(app, PUBSPEC), old);

  const lines = checkStaleBundle(app, REPO);
  assert.deepEqual(warnings(lines), ['bundle stamp']);
  assert.match(lines[1].detail, /pubspec\.yaml does not bundle skal-app\.stamp/);
  assert.deepEqual(fixStaleBundle(app, REPO, 'old-app').changed, [PUBSPEC]);
});

test('--fix is idempotent', (t) => {
  const app = oldApp(t);
  writeFileSync(join(app, PUBSPEC), readFileSync(PUBSPEC_0712, 'utf8'));
  fixStaleBundle(app, REPO, 'old-app');
  const files = [MAIN, BUNDLE, 'package.json', PUBSPEC];
  const after = files.map((p) => read(app, p));

  assert.deepEqual(fixStaleBundle(app, REPO, 'old-app'),
    { changed: [], skipped: [], runtimeTooOld: false });
  assert.deepEqual(files.map((p) => read(app, p)), after);
});

test('a runtime without the fix changes nothing and sends no one in a circle', (t) => {
  const runtime = preFixRuntime(t);
  const app = oldApp(t, runtime);
  const before = read(app, MAIN);

  assert.deepEqual(fixStaleBundle(app, runtime, 'old-app'),
    { changed: [], skipped: [], runtimeTooOld: true });
  assert.equal(read(app, MAIN), before);

  // Nothing to do until a fixed runtime exists, so a warning that says so,
  // not a failure that says "run: skal upgrade" to someone who just did.
  const lines = checkStaleBundle(app, runtime);
  assert.deepEqual(failures(lines), []);
  assert.deepEqual(warnings(lines), ['bundle refresh']);
  assert.match(lines[0].detail, /needs a runtime newer than 80a5b89ae0a9/);
  assert.doesNotMatch(lines[0].detail, /doctor --fix/);
});

test('bundle code a developer edited is reported, never rewritten', (t) => {
  const app = oldApp(t);
  const edited = read(app, MAIN).replace(
    "  if (!jsc.existsSync()) {", "  if (!jsc.existsSync() || alwaysCopy) {");
  writeFileSync(join(app, MAIN), edited);

  const { changed, skipped } = fixStaleBundle(app, REPO, 'old-app');

  assert.deepEqual(changed, []);
  assert.match(skipped[0], /code Skal did not write; left alone/);
  assert.equal(read(app, MAIN), edited);
  assert.deepEqual(warnings(checkStaleBundle(app, REPO)), ['bundle refresh']);
});

test('a skal_bundle.dart you edited is reported, never rewritten', (t) => {
  const app = oldApp(t);
  fixStaleBundle(app, REPO, 'old-app');
  const edited = `${read(app, BUNDLE)}// my own logging\n`;
  writeFileSync(join(app, BUNDLE), edited);
  assert.equal(inspectApp(app, REPO).bundleFile, 'edited');

  const { changed, skipped } = fixStaleBundle(app, REPO, 'old-app');

  assert.deepEqual(changed, []);
  assert.match(skipped[0], /skal_bundle\.dart has changes Skal did not make; left alone/);
  assert.equal(read(app, BUNDLE), edited);
  assert.deepEqual(warnings(checkStaleBundle(app, REPO)), ['bundle refresh']);
});

test('a skal_bundle.dart Skal shipped earlier is replaced with the runtime\'s', (t) => {
  const app = oldApp(t);
  fixStaleBundle(app, REPO, 'old-app');
  const older = '// skal_bundle.dart as an earlier Skal shipped it\n';
  writeFileSync(join(app, BUNDLE), older);
  const known = [sha256(older), sha256(read(TEMPLATE, BUNDLE))];
  assert.deepEqual(failures(checkStaleBundle(app, REPO, { known })), ['bundle refresh']);

  assert.deepEqual(fixStaleBundle(app, REPO, 'old-app', { known }).changed, [BUNDLE]);
  assert.equal(read(app, BUNDLE), read(TEMPLATE, BUNDLE));
});

test('a skal_bundle.dart newer than the runtime\'s is never downgraded', (t) => {
  const app = oldApp(t);
  fixStaleBundle(app, REPO, 'old-app');
  const newer = '// skal_bundle.dart as a later Skal shipped it\n';
  writeFileSync(join(app, BUNDLE), newer);
  const known = [sha256(read(TEMPLATE, BUNDLE)), sha256(newer)];

  assert.deepEqual(fixStaleBundle(app, REPO, 'old-app', { known }).changed, []);
  assert.equal(read(app, BUNDLE), newer);
  assert.deepEqual(failures(checkStaleBundle(app, REPO, { known })), []);
});

test('the template\'s skal_bundle.dart is the newest known version', () => {
  // Otherwise every app on it would be reported as edited, and an app on
  // the version before it would never be upgraded.
  assert.equal(KNOWN_BUNDLES.at(-1), sha256(read(TEMPLATE, BUNDLE)),
    'scripts/templates/default/flutter-host/lib/skal_bundle.dart changed: append its '
      + 'sha256 to KNOWN_BUNDLES in packages/skal-cli/lib/stale-bundle.js');
});

test('copy-once code outside main.dart is found and fixed', (t) => {
  const app = oldApp(t);
  const main = read(app, MAIN);
  const fn = main.match(OLD_FN)[0];
  mkdirSync(join(app, 'flutter-host/lib/src'));
  writeFileSync(join(app, 'flutter-host/lib/src/boot.dart'),
    "import 'dart:io';\n\nimport 'package:flutter/services.dart';\n"
    + "import 'package:path_provider/path_provider.dart';\n\n" + fn);
  writeFileSync(join(app, MAIN), main.replace(fn, ''));

  const { changed } = fixStaleBundle(app, REPO, 'old-app');

  assert.ok(changed.includes('flutter-host/lib/src/boot.dart'), changed.join(', '));
  const boot = read(app, 'flutter-host/lib/src/boot.dart');
  assert.ok(boot.includes(DELEGATE));
  assert.ok(boot.includes("import '../skal_bundle.dart';"));
});

test('copy-once code in a part file is reported, not broken', (t) => {
  // An import can only go in the library, so the part is left to the
  // developer rather than given an import that does not compile.
  const app = oldApp(t);
  const main = read(app, MAIN);
  const fn = main.match(OLD_FN)[0];
  const part = `part of 'main.dart';\n\n${fn}`;
  writeFileSync(join(app, 'flutter-host/lib/boot.dart'), part);
  writeFileSync(join(app, MAIN), main.replace(fn, ''));

  const { changed, skipped } = fixStaleBundle(app, REPO, 'old-app');

  assert.ok(!changed.includes('flutter-host/lib/boot.dart'));
  assert.equal(read(app, 'flutter-host/lib/boot.dart'), part);
  assert.ok(skipped.some((s) => /boot\.dart is a part file/.test(s)), skipped.join('\n'));
});

test('an app that copies no bundle is left out', (t) => {
  const app = oldApp(t);
  writeFileSync(join(app, MAIN), 'void main() {}\n');

  assert.deepEqual(checkStaleBundle(app, REPO), []);
  assert.deepEqual(fixStaleBundle(app, REPO, 'old-app'),
    { changed: [], skipped: [], runtimeTooOld: false });
});

test('`skal doctor --fix` applies it end to end', (t) => {
  const app = oldApp(t);
  const run = spawnSync(process.execPath, [CLI, 'doctor', '--fix'],
    { cwd: join(app, 'flutter-host'), encoding: 'utf8' });

  // Toolchain and binary checks depend on the machine; these lines do not.
  assert.match(run.stdout, /fixed flutter-host\/lib\/main\.dart/);
  assert.match(run.stdout, /✓ bundle refresh +re-checked on every launch/);
  assert.match(run.stdout, /✓ bundle stamp +built by build:bytecode, bundled by pubspec\.yaml/);
});

/** A checkout --runtime-from accepts: this repo's scripts/, stand-in binaries. */
function checkout(t, { withFix }) {
  const scratch = mkdtempSync(join(tmpdir(), 'skal-upgrade-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const dir = join(scratch, 'checkout');
  mkdirSync(join(dir, 'packages/skal-js'), { recursive: true });
  writeFileSync(join(dir, 'packages/skal-js/package.json'), '{"name":"skal"}\n');
  cpSync(join(REPO, 'scripts'), join(dir, 'scripts'), { recursive: true });
  if (!withFix) {
    unlinkSync(join(dir, 'scripts/skal-bundle-stamp.js'));
    unlinkSync(join(dir, 'scripts/templates/default/flutter-host/lib/skal_bundle.dart'));
  }
  for (const bin of ['build/skal-darwin/libskal.flutter.dylib', 'build/skal-iossim/libskal.dylib',
    'build/skal-android/libskal.flutter.so', 'build/skal-bun/bun']) {
    mkdirSync(join(dir, bin, '..'), { recursive: true });
    writeFileSync(join(dir, bin), '');
  }
  return { dir, home: join(scratch, 'home') };
}

function upgrade(app, co) {
  // SKAL_HOME keeps the runtime it builds out of the real ~/.skal.
  return spawnSync(process.execPath, [CLI, 'upgrade', '--runtime-from', co.dir],
    { cwd: app, encoding: 'utf8', env: { ...process.env, SKAL_HOME: co.home } });
}

test('`skal upgrade` applies it to an app already on the newest runtime', (t) => {
  const co = checkout(t, { withFix: true });
  const app = oldApp(t, join(co.home, 'runtime', 'dev'));

  const run = upgrade(app, co);

  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /app already on the current runtime/);
  assert.match(run.stdout, /stale-bundle fix applied to .*main\.dart/);
  assert.ok(read(app, MAIN).includes(DELEGATE));
});

test('`skal upgrade` to a runtime without the fix says what is missing', (t) => {
  const co = checkout(t, { withFix: false });
  const app = oldApp(t, join(co.home, 'runtime', 'dev'));
  const before = read(app, MAIN);

  const run = upgrade(app, co);

  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /note: runtime \S+ predates the stale-bundle fix, so there is nothing to apply yet/);
  assert.doesNotMatch(run.stdout + run.stderr, /run: skal upgrade/);
  assert.equal(read(app, MAIN), before);
});

// The template and every in-repo host must compile the pair and stamp it
// in that order, or a fresh app never gets the O(1) relaunch check — or,
// worse, keeps an old stamp beside a new bundle.
test('every in-repo host builds the bundle and then stamps it', () => {
  for (const host of ['scripts/templates/default', 'examples/kitchen-sink',
    'examples/gallery', 'examples/virt-bench']) {
    const script = bytecode(join(REPO, host));
    const rm = script.indexOf('rm -f ./flutter-host/assets/skal-app.stamp');
    const compile = script.indexOf('--bytecode');
    const stamp = script.indexOf('../../scripts/skal-bundle-stamp.js ./flutter-host/assets');
    assert.ok(rm >= 0 && rm < compile && compile < stamp, `${host}: ${script}`);
  }
});
