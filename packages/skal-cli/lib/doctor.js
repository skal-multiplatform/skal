// doctor.js — `skal doctor`: check the toolchain, runtime, and (when
// run inside an app) the app's wiring. `--fix` recreates a missing or
// stale .skal-runtime symlink from skal.json, and brings an app made
// before 2026-10 up to the stale-bundle fix (see stale-bundle.js).

import { existsSync, readFileSync, readlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { capture, which } from './util.js';
import { latestRuntime, linkRuntimeIntoApp } from './runtime.js';
import { findAppRoot } from './app.js';
import { checkStaleBundle, fixStaleBundle, runtimeLabel } from './stale-bundle.js';

const BINARIES = [
  ['macOS dylib', 'build/skal-darwin/libskal.flutter.dylib'],
  ['iOS-sim dylib', 'build/skal-iossim/libskal.dylib'],
  ['Android .so', 'build/skal-android/libskal.flutter.so'],
  ['vendored bun', 'build/skal-bun/bun'],
];

export function doctor(opts = {}) {
  const checks = [];
  const add = (label, pass, detail = '', warn = false) =>
    checks.push({ label, pass, detail, warn });

  add('bun', which('bun'), capture('bun', ['--version']) || 'not on PATH — https://bun.sh');
  const flutterV = capture('/bin/sh', ['-c', 'flutter --version 2>/dev/null | head -1']);
  // Gate the VERSION, not just presence. skal_codegen uses analyzer ^14,
  // which needs meta >=1.18.3; Flutter 3.41 and older pin meta 1.17.0, and
  // the only symptom is an opaque pub solver conflict at the user's first
  // `bun run codegen`. Catch it here where the message can say why.
  const FLUTTER_MIN = [3, 47];
  const vm = /(\d+)\.(\d+)\.(\d+)/.exec(flutterV || '');
  const tooOld = vm && (
    +vm[1] < FLUTTER_MIN[0] || (+vm[1] === FLUTTER_MIN[0] && +vm[2] < FLUTTER_MIN[1]));
  add('flutter', !!flutterV && !tooOld,
      !flutterV ? 'not on PATH — https://flutter.dev'
      : tooOld ? `${vm[0]} is too old — Skal needs ${FLUTTER_MIN.join('.')}+ `
                 + '(analyzer ^14 needs meta >=1.18.3; older Flutters pin '
                 + '1.17.0 and pub get will not resolve). Run: flutter upgrade'
      : flutterV);

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

    if (opts.fix) {
      const { changed, skipped, runtimeTooOld } = fixStaleBundle(appRoot, runtime, meta.name);
      for (const p of changed) console.log(`  fixed ${p}`);
      for (const why of skipped) console.log(`  not fixed: ${why}`);
      if (runtimeTooOld) {
        console.log(`  not fixed: runtime ${runtimeLabel(runtime)} predates the stale-bundle fix`);
      }
    }
    for (const c of checkStaleBundle(appRoot, runtime)) {
      add(c.label, c.pass, c.detail, c.warn);
    }
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

  // A warning is a check that is worth acting on but does not make the
  // app wrong, so it does not fail the run.
  let failed = 0;
  let warned = 0;
  for (const c of checks) {
    if (!c.pass && !c.warn) failed++;
    if (!c.pass && c.warn) warned++;
    const mark = c.pass ? '✓' : c.warn ? '!' : '✗';
    console.log(`  ${mark} ${c.label.padEnd(20)} ${c.detail}`);
  }
  console.log(failed ? `\n${failed} problem(s) found.`
    : warned ? `\nNo problems; ${warned} warning(s) above.` : '\nAll good.');
  process.exit(failed ? 1 : 0);
}
