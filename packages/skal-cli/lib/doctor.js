// doctor.js — `skal doctor`: check the toolchain, runtime, and (when
// run inside an app) the app's wiring. `--fix` recreates a missing or
// stale .skal-runtime symlink from skal.json.

import { existsSync, readFileSync, readlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { capture, which } from './util.js';
import { latestRuntime, linkRuntimeIntoApp } from './runtime.js';
import { findAppRoot } from './app.js';

const BINARIES = [
  ['macOS dylib', 'build/skal-darwin/libskal.flutter.dylib'],
  ['iOS-sim dylib', 'build/skal-iossim/libskal.dylib'],
  ['Android .so', 'build/skal-android/libskal.flutter.so'],
  ['vendored bun', 'build/skal-bun/bun'],
];

export function doctor(opts = {}) {
  const checks = [];
  const add = (label, pass, detail = '') =>
    checks.push({ label, pass, detail });

  add('bun', which('bun'), capture('bun', ['--version']) || 'not on PATH — https://bun.sh');
  const flutterV = capture('/bin/sh', ['-c', 'flutter --version 2>/dev/null | head -1']);
  add('flutter', !!flutterV, flutterV || 'not on PATH — https://flutter.dev');

  const appRoot = findAppRoot();
  let runtime = null;
  if (appRoot) {
    const meta = JSON.parse(readFileSync(join(appRoot, 'skal.json'), 'utf8'));
    runtime = meta.runtime;
    add('app', true, `${meta.name} at ${appRoot}`);

    const link = join(appRoot, '.skal-runtime');
    let linkOk = false;
    try {
      linkOk = lstatSync(link).isSymbolicLink() && readlinkSync(link) === runtime
        && existsSync(join(runtime, '.complete'));
    } catch {}
    if (!linkOk && opts.fix && existsSync(join(runtime, '.complete'))) {
      linkRuntimeIntoApp(appRoot, runtime);
      linkOk = true;
    }
    add('.skal-runtime link', linkOk,
      linkOk ? `→ ${runtime}` : 'missing/stale — run: skal doctor --fix');
  } else {
    runtime = latestRuntime();
    add('runtime', !!runtime,
      runtime || 'none installed — skal create fetches one');
  }

  if (runtime && existsSync(runtime)) {
    for (const [label, rel] of BINARIES) {
      add(label, existsSync(join(runtime, rel)), rel);
    }
  }

  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.label.padEnd(20)} ${c.detail}`);
  }
  console.log(failed ? `\n${failed} problem(s) found.` : '\nAll good.');
  process.exit(failed ? 1 : 0);
}
