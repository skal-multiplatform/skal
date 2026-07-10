// util.js — tiny helpers shared by the skal CLI. Zero dependencies:
// everything rides on node builtins so `npx @skal/cli` stays instant.

import { spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

export const log = (msg) => console.log(msg);
export const arrow = (msg) => console.log(`→ ${msg}`);
export const ok = (msg) => console.log(`✓ ${msg}`);

export function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

/** Run a command with inherited stdio; throw on non-zero exit. */
export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with ${res.status}`);
  }
}

/** Run a command, return trimmed stdout; null on failure. */
export function capture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (res.error || res.status !== 0) return null;
  return res.stdout.trim();
}

/** True if `cmd` resolves on PATH. */
export function which(cmd) {
  return capture('/bin/sh', ['-c', `command -v ${cmd}`]) !== null;
}

const UA = { 'User-Agent': 'skal-cli' };

export async function fetchJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

export async function download(url, dest) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  await finished(Readable.fromWeb(res.body).pipe(createWriteStream(dest)));
}
