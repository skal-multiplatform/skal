// A new app's Flutter host and native build, as `skal create` writes them.
//
// - flutter-host/test/widget_test.dart: `flutter create` wrote its
//   counter-app stub there, which needs a `MyApp` no Skal host has, so
//   `flutter test` did not compile in a new app. The template now ships its
//   own, testing the shell: the theme and the status bar follow setDesign,
//   and the tree is drawn edge to edge. This runs it in a host built the
//   way `skal create` builds one, after a real `flutter create`, which must
//   leave the file alone.
// - The native vite build copied public/favicon.png into
//   flutter-host/assets/, which the pubspec bundles whole.
// - vite.config.js used `__dirname`, which ESM does not have, so every
//   build of a new app printed vite's config-loader warning.
//
// Each test skips when its toolchain is missing (flutter; the repo's
// `bun install`).
//
//   node --test packages/skal-cli/test/template-host.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync,
  statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { standalonePubspec } from '../lib/create.js';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const TEMPLATE = join(REPO, 'scripts/templates/default');
// The template's dependencies, installed: examples/gallery declares the
// same ones (asserted below), and the template is not a workspace member.
const DEPS = join(REPO, 'examples/gallery/node_modules');

function scratch(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function* files(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

/** The name substitution `skal create` applies to the template's text files. */
const named = (text) =>
  text.replaceAll('__APP_NAME_SNAKE__', 'new_app').replaceAll('__APP_NAME__', 'new-app');

const hasFlutter = spawnSync('/bin/sh', ['-c', 'command -v flutter']).status === 0;

test("a new app's flutter test compiles and passes",
  { skip: !hasFlutter && 'flutter not on PATH', timeout: 600_000 }, (t) => {
    // flutter-host as `skal create` leaves it: names filled in, path
    // dependencies through .skal-runtime (here, this checkout), then
    // `flutter create` for a platform.
    const app = scratch(t, 'skal-new-app-');
    const host = join(app, 'flutter-host');
    cpSync(join(TEMPLATE, 'flutter-host'), host, { recursive: true });
    symlinkSync(REPO, join(app, '.skal-runtime'));
    for (const f of files(host)) {
      if (['.dart', '.yaml', '.json'].includes(extname(f))) {
        writeFileSync(f, named(readFileSync(f, 'utf8')));
      }
    }
    const pubspec = join(host, 'pubspec.yaml');
    writeFileSync(pubspec, standalonePubspec(readFileSync(pubspec, 'utf8')));
    // The pubspec requires the JS bundle; `bun run test` builds it first.
    writeFileSync(join(host, 'assets/skal-app.js'), '');

    const created = spawnSync('flutter', ['create', '--no-pub', '--platforms', 'ios',
      '--org', 'com.example', '--project-name', 'new_app', '.'],
    { cwd: host, encoding: 'utf8' });
    assert.equal(created.status, 0, created.stderr);
    assert.equal(readFileSync(join(host, 'test/widget_test.dart'), 'utf8'),
      named(readFileSync(join(TEMPLATE, 'flutter-host/test/widget_test.dart'), 'utf8')),
      'flutter create replaced the template\'s test');

    const res = spawnSync('flutter', ['test'], { cwd: host, encoding: 'utf8' });
    const out = res.stdout + res.stderr;
    assert.equal(res.status, 0, out);
    assert.match(out, /\+3: All tests passed!/, out);
  });

test('the template declares the dependencies this file builds it with', () => {
  const deps = (dir) => {
    const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return Object.keys({ ...p.dependencies, ...p.devDependencies }).sort();
  };
  assert.deepEqual(deps(TEMPLATE), deps(join(REPO, 'examples/gallery')));
});

test('the native build puts only the bundle in flutter-host/assets',
  { skip: !existsSync(join(DEPS, 'vite')) && 'run `bun install` at the repo root',
    timeout: 120_000 }, (t) => {
    const app = scratch(t, 'skal-new-app-build-');
    cpSync(TEMPLATE, app, { recursive: true });
    symlinkSync(DEPS, join(app, 'node_modules'));

    const res = spawnSync(process.execPath, [join(DEPS, 'vite/bin/vite.js'), 'build'],
      { cwd: app, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.deepEqual(readdirSync(join(app, 'flutter-host/assets')).sort(),
      ['.gitkeep', 'skal-app.js']);
  });

test("the template's vite configs load without vite's __dirname shim",
  { skip: !existsSync(join(DEPS, 'vite')) && 'run `bun install` at the repo root',
    timeout: 120_000 }, (t) => {
    // ESM has no __dirname. Vite's default config loader bundles the
    // config and supplies one, and vite 8.3, which a new app installs,
    // warns about it on every build: `__dirname` is "unsupported by
    // configLoader: 'native'", the planned default. The 8.0 pinned here
    // says nothing, but loading natively makes the same gap a
    // ReferenceError on any vite 8, so it fails here.
    const app = scratch(t, 'skal-new-app-config-');
    cpSync(TEMPLATE, app, { recursive: true });
    symlinkSync(DEPS, join(app, 'node_modules'));

    for (const config of ['vite.config.js', 'vite.config.web.js']) {
      const res = spawnSync(process.execPath, [join(DEPS, 'vite/bin/vite.js'), 'build',
        '--config', config, '--configLoader', 'native'], { cwd: app, encoding: 'utf8' });
      assert.equal(res.status, 0, `${config}:\n${res.stdout}${res.stderr}`);
    }
  });
