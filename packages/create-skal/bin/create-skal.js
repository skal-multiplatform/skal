#!/usr/bin/env node
// create-skal — the `npm create @skal <name>` entry point.
//
// npm resolves `npm create @skal` to this package and runs its bin with
// the remaining args. All real behavior lives in @skal/cli; this just
// re-invokes `skal create <args>` so the two front doors can't drift.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const skal = require.resolve('@skal/cli/bin/skal.js');

const res = spawnSync(process.execPath, [skal, 'create', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(res.status ?? 1);
