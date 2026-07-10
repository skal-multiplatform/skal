// runtime.js — manage the Skal runtime under ~/.skal/runtime/<id>/.
//
// A "runtime" is a checkout of the monorepo's packages/ + scripts/ plus
// the prebuilt libskal binaries in build/ — everything a standalone app
// needs, laid out exactly like the repo so the existing link scripts
// work unchanged. Runtimes are immutable and keyed by the skal commit
// the binaries were built from (rustup/flutter-style), so upgrading
// never mutates a runtime an existing app points at.
//
// Two sources:
//   - remote (default): the `libskal-dev` GitHub release. manifest.json
//     names the skal commit; the matching source tarball comes from
//     codeload and scripts/fetch-libskal.sh pulls the binaries. All
//     anonymous — no gh auth, no git required.
//   - --runtime-from <repo> (development): copy packages/ + scripts/ +
//     build/ out of a local monorepo checkout into the `dev` runtime.

import {
  existsSync, mkdirSync, rmSync, writeFileSync, readFileSync,
  symlinkSync, unlinkSync, mkdtempSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { arrow, ok, die, run, capture, fetchJson, download } from './util.js';

const RELEASE_REPO = process.env.SKAL_RELEASE_REPO || 'skal-multiplatform/skal';
const RELEASE_TAG = process.env.SKAL_RELEASE_TAG || 'libskal-dev';

export const skalHome = () => process.env.SKAL_HOME || join(homedir(), '.skal');
const runtimeBase = () => join(skalHome(), 'runtime');

export function latestRuntime() {
  const link = join(runtimeBase(), 'latest');
  return existsSync(link) ? link : null;
}

function writeMarker(dir, meta) {
  writeFileSync(join(dir, 'runtime.json'), JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(join(dir, '.complete'), '');
}

function pointLatest(dir) {
  const link = join(runtimeBase(), 'latest');
  try { unlinkSync(link); } catch {}
  symlinkSync(dir, link);
}

/** Copy src/<sub> → dest/<sub> via tar pipe, skipping build junk. */
function copyTree(src, dest, sub) {
  if (!existsSync(join(src, sub))) return false;
  mkdirSync(join(dest, sub), { recursive: true });
  run('/bin/bash', ['-c',
    `cd ${JSON.stringify(join(src, sub))} && tar cf - ` +
    `--exclude node_modules --exclude .dart_tool --exclude dist ` +
    `--exclude .DS_Store . | (cd ${JSON.stringify(join(dest, sub))} && tar xf -)`,
  ]);
  return true;
}

/** Build the `dev` runtime from a local monorepo checkout. */
function runtimeFromLocal(repo) {
  if (!existsSync(join(repo, 'packages', 'skal-js', 'package.json'))) {
    die(`${repo} doesn't look like a skal checkout (no packages/skal-js)`);
  }
  const dest = join(runtimeBase(), 'dev');
  arrow(`building dev runtime from ${repo}`);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  copyTree(repo, dest, 'packages');
  copyTree(repo, dest, 'scripts');
  for (const b of ['build/skal-darwin', 'build/skal-iossim', 'build/skal-android', 'build/skal-bun']) {
    copyTree(repo, dest, b);
  }

  // A source-built checkout keeps its bun at vendor/bun/build/release/
  // rather than the prebuilt layout — normalize it into the runtime.
  if (!existsSync(join(dest, 'build/skal-bun/bun'))) {
    for (const cand of ['vendor/bun/build/release/bun', 'vendor/bun/build/release/bun-profile']) {
      if (existsSync(join(repo, cand))) {
        mkdirSync(join(dest, 'build/skal-bun'), { recursive: true });
        run('cp', [join(repo, cand), join(dest, 'build/skal-bun/bun')]);
        break;
      }
    }
  }

  // Anything still missing (partial checkout) comes from the release.
  const complete = [
    'build/skal-darwin/libskal.flutter.dylib',
    'build/skal-iossim/libskal.dylib',
    'build/skal-android/libskal.flutter.so',
    'build/skal-bun/bun',
  ].every((p) => existsSync(join(dest, p)));
  if (!complete) {
    arrow('checkout is missing binaries — fetching the rest from the release');
    run('/bin/bash', ['scripts/fetch-libskal.sh'], { cwd: dest });
  }

  writeMarker(dest, {
    id: 'dev',
    source: repo,
    commit: capture('git', ['-C', repo, 'rev-parse', '--short', 'HEAD']),
    created: new Date().toISOString(),
  });
  pointLatest(dest);
  ok(`dev runtime ready at ${dest}`);
  return dest;
}

/** Resolve the skal commit the current release binaries were built from. */
async function resolveReleaseCommit() {
  const rel = await fetchJson(
    `https://api.github.com/repos/${RELEASE_REPO}/releases/tags/${RELEASE_TAG}`);
  const manifest = (rel.assets || []).find((a) => a.name === 'manifest.json');
  if (!manifest) throw new Error(`release ${RELEASE_TAG} has no manifest.json`);
  const tmp = join(mkdtempSync(join(tmpdir(), 'skal-')), 'manifest.json');
  await download(manifest.browser_download_url, tmp);
  const commit = JSON.parse(readFileSync(tmp, 'utf8')).skal_commit;
  if (!commit) throw new Error('manifest.json has no skal_commit');
  return commit;
}

/** Install (or reuse) the runtime for the current release. */
async function runtimeFromRelease({ refresh = false } = {}) {
  let commit;
  try {
    commit = await resolveReleaseCommit();
  } catch (e) {
    const fallback = latestRuntime();
    if (fallback && !refresh) {
      console.warn(`warning: can't reach ${RELEASE_REPO} (${e.message}); using cached runtime`);
      return fallback;
    }
    die(`can't resolve the skal release: ${e.message}`);
  }

  const dest = join(runtimeBase(), commit);
  if (existsSync(join(dest, '.complete')) && !refresh) {
    pointLatest(dest);
    return dest;
  }

  arrow(`installing runtime ${commit} → ${dest}`);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  const tarball = join(mkdtempSync(join(tmpdir(), 'skal-')), 'src.tar.gz');
  arrow('downloading source tree');
  await download(`https://codeload.github.com/${RELEASE_REPO}/tar.gz/${commit}`, tarball);
  run('tar', ['-xzf', tarball, '-C', dest, '--strip-components=1']);

  arrow('fetching prebuilt libskal binaries');
  run('/bin/bash', ['scripts/fetch-libskal.sh'], { cwd: dest });

  writeMarker(dest, {
    id: commit,
    source: `${RELEASE_REPO}@${RELEASE_TAG}`,
    commit,
    created: new Date().toISOString(),
  });
  pointLatest(dest);
  ok(`runtime ${commit} ready`);
  return dest;
}

/**
 * Ensure a runtime exists and return its absolute path.
 * opts.from — local checkout path (dev); opts.refresh — force reinstall.
 */
export async function ensureRuntime(opts = {}) {
  mkdirSync(runtimeBase(), { recursive: true });
  if (opts.from) return runtimeFromLocal(opts.from);
  return runtimeFromRelease(opts);
}

/** Point an app's .skal-runtime symlink at a runtime dir. */
export function linkRuntimeIntoApp(appDir, runtimeDir) {
  const link = join(appDir, '.skal-runtime');
  try { unlinkSync(link); } catch {}
  symlinkSync(runtimeDir, link);
}
