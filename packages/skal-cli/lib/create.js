// create.js — `skal create <name>`: scaffold a standalone Skal app.
//
// Mirrors scripts/new-app.sh but for apps living anywhere on disk:
// the runtime (packages/ + scripts/ + prebuilt binaries) is shared at
// ~/.skal/runtime/<id>/ and each app carries a `.skal-runtime` symlink
// to it. The scaffold rewires the template's three monorepo tethers:
//   1. package.json  "skal": "workspace:*"  → file:.skal-runtime/packages/skal-js
//   2. package.json  ../../scripts/…        → ./.skal-runtime/scripts/…
//   3. pubspec.yaml  ../../../packages/…    → ../.skal-runtime/packages/…

import {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, statSync, chmodSync,
} from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { arrow, ok, die, run, which } from './util.js';
import { ensureRuntime, linkRuntimeIntoApp } from './runtime.js';

const TEXT_EXT = new Set(['.json', '.jsx', '.js', '.html', '.md', '.yaml', '.dart', '.sh', '.cjs']);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

export async function create(name, opts = {}) {
  // Same naming rule as new-app.sh: kebab-case, no leading/trailing hyphen.
  if (!/^[a-z]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
    die(`name must be kebab-case (lowercase + digits + hyphens), got: ${name}`);
  }
  const snake = name.replaceAll('-', '_');
  const target = resolve(process.cwd(), name);
  if (existsSync(target)) die(`target exists: ${target}`);
  if (!which('bun')) die('bun is required — install from https://bun.sh');
  if (!opts.noPlatforms && !which('flutter')) {
    die('flutter is required for platform builds — install it, or pass --no-platforms');
  }

  const runtime = await ensureRuntime({ from: opts.runtimeFrom });
  const template = join(runtime, 'scripts', 'templates', 'default');
  if (!existsSync(template)) die(`runtime is missing the app template: ${template}`);

  // ── copy + substitute ──────────────────────────────────────────────
  arrow(`creating ${target}`);
  mkdirSync(target, { recursive: true });
  run('/bin/bash', ['-c',
    `cd ${JSON.stringify(template)} && tar cf - --exclude node_modules ` +
    `--exclude dist --exclude .DS_Store . | (cd ${JSON.stringify(target)} && tar xf -)`,
  ]);
  for (const file of walk(target)) {
    if (!TEXT_EXT.has(extname(file))) continue;
    const src = readFileSync(file, 'utf8');
    const out = src.replaceAll('__APP_NAME_SNAKE__', snake).replaceAll('__APP_NAME__', name);
    if (out !== src) writeFileSync(file, out);
    // The template's helper scripts aren't mode-755 in git (same reason
    // new-app.sh chmods after copying).
    if (file.endsWith('.sh')) chmodSync(file, 0o755);
  }

  // ── rewire the monorepo tethers to the runtime ─────────────────────
  const pkgPath = join(target, 'package.json');
  let pkg = readFileSync(pkgPath, 'utf8')
    .replaceAll('"skal": "workspace:*"', '"skal": "file:.skal-runtime/packages/skal-js"')
    .replaceAll('../../scripts/', './.skal-runtime/scripts/')
    // dev-hot.sh takes an app *name* in the repo; standalone apps pass
    // their own dir (`.`) — hot-reload-server.js resolves either.
    .replace(new RegExp(`(dev-hot\\.sh [a-z-]+) ${name}`, 'g'), '$1 .')
    // skal-link.sh resolves examples/<name>/ by default; standalone
    // apps point it at themselves.
    .replaceAll('"link": "./.skal-runtime/scripts/skal-link.sh',
                '"link": "SKAL_APP_ROOT=$PWD/flutter-host ./.skal-runtime/scripts/skal-link.sh');
  writeFileSync(pkgPath, pkg);

  const pubspecPath = join(target, 'flutter-host', 'pubspec.yaml');
  writeFileSync(pubspecPath, readFileSync(pubspecPath, 'utf8')
    .replaceAll('path: ../../../packages/skal_flutter', 'path: ../.skal-runtime/packages/skal_flutter'));

  linkRuntimeIntoApp(target, runtime);
  writeFileSync(join(target, 'skal.json'), JSON.stringify({
    name,
    runtime,
    created: new Date().toISOString(),
  }, null, 2) + '\n');
  // .skal-runtime is machine-local (recreate with `skal doctor --fix`).
  writeFileSync(join(target, '.gitignore'),
    'node_modules/\ndist/\n.skal-runtime\n.DS_Store\n');

  // ── install + platforms + libskal ──────────────────────────────────
  arrow('bun install');
  run('bun', ['install'], { cwd: target });

  if (!opts.noPlatforms) {
    const platforms = opts.platforms || 'macos,ios,android';
    arrow(`flutter create — ${platforms}`);
    run('flutter', ['create', '--org', 'com.example', '--project-name', snake,
      '--platforms', platforms, '.'], { cwd: join(target, 'flutter-host') });

    arrow('linking libskal binaries');
    run('/bin/bash', [join(runtime, 'scripts', 'skal-link.sh'), name],
      { env: { SKAL_APP_ROOT: join(target, 'flutter-host') } });
  }

  ok(`${name}/ scaffolded${opts.noPlatforms ? '' : ' — ready to run.'}`);
  console.log(`
  cd ${name}
  bun run dev:macos        # macOS desktop (or: skal dev macos)
  bun run dev:ios          # iOS simulator (boot one first)
  bun run dev:android      # Android emulator / device
  bun run dev:web          # web preview → localhost:5173
`);
}
