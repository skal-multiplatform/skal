// app.js — locate the enclosing app and proxy dev/build/upgrade to its
// package.json scripts (which is where the real behavior lives, so
// `bun run dev:macos` and `skal dev macos` never drift apart).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { arrow, ok, die, run } from './util.js';
import { ensureRuntime, linkRuntimeIntoApp } from './runtime.js';

/** Walk up from cwd to the nearest dir holding a skal.json. */
export function findAppRoot(from = process.cwd()) {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, 'skal.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function requireApp() {
  const root = findAppRoot();
  if (!root) die('not inside a skal app (no skal.json found up the tree)');
  return root;
}

const PLATFORMS = new Set(['macos', 'ios', 'android', 'web']);

export function dev(platform = 'macos', opts = {}) {
  if (!PLATFORMS.has(platform)) {
    die(`unknown platform: ${platform} (macos | ios | android | web)`);
  }
  // `dev:<platform>` IS the hot script — it runs scripts/dev-hot.sh. There has
  // never been a `dev:hot:<platform>`, so `skal dev macos --hot` used to fail
  // with "Script not found". Hot reload is now simply what `skal dev` does on
  // every target, web included; `dev:flutter` is the plain, non-hot run.
  //
  // --hot is accepted and ignored, for the muscle memory. It is NOT an error
  // anywhere — `skal dev web --hot` used to exit non-zero telling the user the
  // flag was for native targets, which was rejecting a flag that by then
  // selected nothing on any target.
  const script = `dev:${platform}`;
  run('bun', ['run', script], { cwd: requireApp() });
}

export function build(target) {
  if (target && !PLATFORMS.has(target)) {
    die(`unknown build target: ${target} (macos | ios | android — omit for the JS bundle)`);
  }
  run('bun', ['run', target ? `build:${target}` : 'build'], { cwd: requireApp() });
}

/** `skal upgrade` — install the latest runtime; repoint the app if inside one. */
export async function upgrade(opts = {}) {
  const runtime = await ensureRuntime({ from: opts.runtimeFrom, refresh: true });
  const appRoot = findAppRoot();
  if (!appRoot) {
    ok(`runtime ready at ${runtime} — new apps will use it`);
    return;
  }
  const metaPath = join(appRoot, 'skal.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (meta.runtime === runtime) {
    ok('app already on the current runtime');
    return;
  }
  arrow(`repointing ${meta.name}: ${meta.runtime} → ${runtime}`);
  meta.runtime = runtime;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  linkRuntimeIntoApp(appRoot, runtime);
  arrow('reinstalling JS deps against the new runtime');
  run('bun', ['install', '--force'], { cwd: appRoot });
  run('/bin/bash', [join(runtime, 'scripts', 'skal-link.sh'), meta.name],
    { env: { SKAL_APP_ROOT: join(appRoot, 'flutter-host') } });
  ok('upgraded — rebuild with: skal build <platform>');
}
