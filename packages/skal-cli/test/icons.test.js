// Launcher icons for the platforms an app has (scripts/skal-icons.sh).
//
// `skal create <name> --platforms ios` (or macos) printed "✕ Could not
// generate launcher icons — PathNotFoundException: android/app/src/main/
// AndroidManifest.xml" and kept Flutter's logo: flutter_launcher_icons does
// Android first and throws on a missing android/ project before it reaches
// iOS or macOS. The script now hands it a copy of the config with each
// missing platform's entry taken out.
//
// Most tests swap `flutter` and `dart` for shims that keep the config the
// generator was given. The last one runs the real generator on a real
// `flutter create --platforms ios` project, since what counts is what
// flutter_launcher_icons does with that config; it skips without flutter.
//
//   node --test packages/skal-cli/test/icons.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT = join(REPO, 'scripts/skal-icons.sh');
const HOST = join(REPO, 'scripts/templates/default/flutter-host');
const PUBSPEC = readFileSync(join(HOST, 'pubspec.yaml'), 'utf8');

// The template's per-platform entries, verbatim. The expected configs are
// the pubspec with these cut out — written out here, not derived the way
// the script derives them.
const ANDROID = '  android: true\n';
const IOS = '  ios: true\n';
const MACOS = '  macos:\n    generate: true\n    image_path: "icon/skal-icon.png"\n';

function scratch(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A flutter-host with these platform dirs, an icon and a pubspec. */
function app(t, platforms, pubspec = PUBSPEC) {
  const host = scratch(t, 'skal-icons-app-');
  mkdirSync(join(host, 'icon'));
  writeFileSync(join(host, 'icon/skal-icon.png'), 'png');
  writeFileSync(join(host, 'pubspec.yaml'), pubspec);
  for (const p of platforms) mkdirSync(join(host, p));
  return host;
}

/**
 * Run the script against `host` with `flutter` and `dart` shimmed. The
 * dart shim stands in for `dart run flutter_launcher_icons`: it records
 * its arguments and working dir, and keeps the `-f` file it was given.
 */
function run(t, host) {
  const bin = scratch(t, 'skal-icons-bin-');
  const seen = join(bin, 'seen');
  writeFileSync(join(bin, 'flutter'), '#!/bin/sh\nexit 0\n');
  writeFileSync(join(bin, 'dart'), [
    '#!/bin/sh',
    `echo "$*" > '${seen}.args'`,
    `pwd -P > '${seen}.cwd'`,
    'while [ $# -gt 0 ]; do',
    `  if [ "$1" = -f ]; then cp "$2" '${seen}.yaml'; fi`,
    '  shift',
    'done',
    '',
  ].join('\n'));
  chmodSync(join(bin, 'flutter'), 0o755);
  chmodSync(join(bin, 'dart'), 0o755);

  const res = spawnSync('bash', [SCRIPT, 'demo'], {
    encoding: 'utf8',
    env: { ...process.env, SKAL_APP_ROOT: host, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(res.status, 0, res.stderr);
  const read = (ext) => existsSync(seen + ext) ? readFileSync(seen + ext, 'utf8') : null;
  return { out: res.stdout, args: read('.args'), cwd: read('.cwd'), config: read('.yaml') };
}

const cut = (text, ...parts) => parts.reduce((s, p) => {
  assert.ok(s.includes(p), `the template no longer has ${JSON.stringify(p)}`);
  return s.replace(p, '');
}, text);

test('an iOS-only app gets an iOS-only config', (t) => {
  const host = app(t, ['ios']);
  const r = run(t, host);
  assert.equal(r.config, cut(PUBSPEC, ANDROID, MACOS));
  assert.match(r.args.trim(), /^run flutter_launcher_icons -f \S+$/);
  assert.equal(r.cwd.trim(), realpathSync(host), 'it runs in the app');
  assert.match(r.out, /generating Skal launcher icons \(ios\)/);
});

test('a macOS-only app gets a macOS-only config', (t) => {
  const r = run(t, app(t, ['macos']));
  assert.equal(r.config, cut(PUBSPEC, ANDROID, IOS));
  assert.match(r.out, /launcher icons \(macos\)/);
});

test('an app with every platform gets the pubspec unchanged', (t) => {
  const r = run(t, app(t, ['android', 'ios', 'macos']));
  assert.equal(r.config, PUBSPEC);
  assert.match(r.out, /launcher icons \(android ios macos\)/);
});

test('an edited config keeps everything but the missing platforms', (t) => {
  // A string-valued android entry, a comment and an extra key nested under
  // macos, keys on either side, the deprecated block name, and a top-level
  // key straight after the last (dropped) entry.
  const edited = [
    'name: demo',
    'flutter_icons:',
    '  image_path: "icon/skal-icon.png"',
    '  android: "launcher_icon"',
    '  adaptive_icon_background: "#FFFFFF"',
    '  ios: true',
    '  macos:',
    '    # bigger mark on the dock',
    '    generate: true',
    '    image_path: "icon/mac.png"',
    'flutter:',
    '  uses-material-design: true',
    '',
  ].join('\n');
  const r = run(t, app(t, ['ios'], edited));
  assert.equal(r.config, [
    'name: demo',
    'flutter_icons:',
    '  image_path: "icon/skal-icon.png"',
    '  adaptive_icon_background: "#FFFFFF"',
    '  ios: true',
    'flutter:',
    '  uses-material-design: true',
    '',
  ].join('\n'));
});

test('flutter_launcher_icons.yaml wins over the pubspec, as in the generator', (t) => {
  const host = app(t, ['ios']);
  const own = 'flutter_launcher_icons:\n  image_path: "icon/own.png"\n  android: true\n  ios: true\n';
  writeFileSync(join(host, 'flutter_launcher_icons.yaml'), own);
  const r = run(t, host);
  assert.equal(r.config, 'flutter_launcher_icons:\n  image_path: "icon/own.png"\n  ios: true\n');
});

test('the app directory gets nothing new', (t) => {
  const host = app(t, ['ios']);
  const before = readdirSync(host).sort();
  run(t, host);
  assert.deepEqual(readdirSync(host).sort(), before);
});

const hasFlutter = spawnSync('/bin/sh', ['-c', 'command -v flutter']).status === 0;

test('the real generator brands an iOS-only app', { skip: !hasFlutter && 'flutter not on PATH', timeout: 300_000 }, (t) => {
  // A real `flutter create --platforms ios` project carrying the template's
  // icon config and icon. The template's own pubspec cannot resolve outside
  // the repo (path dependencies), so this one has just the generator.
  const host = scratch(t, 'skal-icons-real-');
  const devDep = PUBSPEC.match(/^ {2}flutter_launcher_icons: .+$/m)[0];
  const block = PUBSPEC.match(/^flutter_launcher_icons:\n(?: .*\n|\n)*?(?=\S)/m)[0];
  writeFileSync(join(host, 'pubspec.yaml'), [
    'name: icons_check',
    'environment:',
    '  sdk: ^3.11.0',
    'dependencies:',
    '  flutter:',
    '    sdk: flutter',
    'dev_dependencies:',
    devDep,
    '',
    block,
  ].join('\n'));
  mkdirSync(join(host, 'icon'));
  copyFileSync(join(HOST, 'icon/skal-icon.png'), join(host, 'icon/skal-icon.png'));
  const created = spawnSync('flutter', ['create', '--no-pub', '--platforms', 'ios',
    '--org', 'com.example', '--project-name', 'icons_check', '.'], { cwd: host, encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);

  const icon = join(host, 'ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png');
  const hash = () => createHash('sha256').update(readFileSync(icon)).digest('hex');
  const flutterLogo = hash();

  const res = spawnSync('bash', [SCRIPT, 'icons_check'], {
    encoding: 'utf8', env: { ...process.env, SKAL_APP_ROOT: host },
  });
  const out = res.stdout + res.stderr;
  assert.equal(res.status, 0, out);
  assert.doesNotMatch(out, /Could not generate|flutter_launcher_icons failed/, out);
  assert.match(out, /Successfully generated launcher icons/, out);
  assert.notEqual(hash(), flutterLogo, 'the iOS icon is still the Flutter logo');
  assert.ok(!existsSync(join(host, 'android')), 'no android/ project appeared');
  assert.ok(!existsSync(join(host, 'macos')), 'no macos/ project appeared');
});
