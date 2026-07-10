#!/usr/bin/env node
// skal — create and run Skal apps anywhere on disk.
//
//   skal create my-app            scaffold a standalone app in ./my-app
//   skal dev [platform] [--hot]   run it (macos | ios | android | web)
//   skal build [platform]         JS bundle, or a release platform build
//   skal doctor [--fix]           check toolchain + runtime + app wiring
//   skal upgrade                  install the latest runtime / repoint app
//
// The heavy runtime (framework packages + prebuilt libskal binaries)
// lives at ~/.skal/runtime/<version>/, fetched on first use — this
// package stays a few KB so npx is instant.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { die } from '../lib/util.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(
  readFileSync(join(HERE, '..', 'package.json'), 'utf8')).version;

const USAGE = `skal ${VERSION} — Solid in JS, Flutter rendering. https://github.com/skal-multiplatform/skal

usage:
  skal create <name> [--platforms macos,ios,android | --no-platforms]
  skal dev [macos|ios|android|web] [--hot]
  skal build [macos|ios|android]
  skal doctor [--fix]
  skal upgrade

env: SKAL_HOME (default ~/.skal), SKAL_RELEASE_REPO, SKAL_RELEASE_TAG`;

// ── arg parse: positionals + the few flags we support ────────────────
const args = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--no-platforms') flags.noPlatforms = true;
  else if (a === '--platforms') flags.platforms = args[++i];
  else if (a === '--runtime-from') flags.runtimeFrom = args[++i];
  else if (a === '--hot') flags.hot = true;
  else if (a === '--fix') flags.fix = true;
  else if (a === '-v' || a === '--version') { console.log(VERSION); process.exit(0); }
  else if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
  else if (a.startsWith('-')) die(`unknown flag: ${a}\n\n${USAGE}`);
  else positional.push(a);
}

const [cmd, arg] = positional;

try {
  switch (cmd) {
    case 'create': {
      if (!arg) die(`usage: skal create <name>`);
      const { create } = await import('../lib/create.js');
      await create(arg, flags);
      break;
    }
    case 'dev': {
      const { dev } = await import('../lib/app.js');
      dev(arg, flags);
      break;
    }
    case 'build': {
      const { build } = await import('../lib/app.js');
      build(arg);
      break;
    }
    case 'doctor': {
      const { doctor } = await import('../lib/doctor.js');
      doctor(flags);
      break;
    }
    case 'upgrade': {
      const { upgrade } = await import('../lib/app.js');
      await upgrade(flags);
      break;
    }
    case undefined:
      console.log(USAGE);
      break;
    default:
      die(`unknown command: ${cmd}\n\n${USAGE}`);
  }
} catch (e) {
  die(e.message);
}
