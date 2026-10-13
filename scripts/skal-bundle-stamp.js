// skal-bundle-stamp.js — write the stamp a release Skal app checks at launch.
//
//   bun scripts/skal-bundle-stamp.js <app>/flutter-host/assets
//
// A release build copies skal-app.cjs and skal-app.cjs.jsc out of its assets
// on first launch, because bun imports real files and Android assets live in
// the APK zip. An update keeps the app's data directory, so the host has to
// notice when the bundle changed. Reading the bundle on every launch to find
// out costs a full read of the .cjs. This writes skal-app.stamp instead, a
// line under 100 bytes that the host compares with the copy it stored:
//
//   <cjs bytes> <jsc bytes> <sha256 of the .cjs then the .jsc, hex>
//
// The sizes let the host also catch an extracted file cut short. The hash
// covers the .jsc as well as the .cjs: rebuilding the same JS with a
// different bun changes only the bytecode, and a stale .jsc makes bun parse
// from source on every launch.
//
// The reader is extractSkalBundle() in the app template's
// flutter-host/lib/skal_bundle.dart. Change the format in both places.
//
// The stamp must come from the step that wrote the pair. A stale stamp next
// to a new bundle brings the stale-bundle bug back, which is why
// build:bytecode deletes it before compiling and runs this afterwards.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: bun scripts/skal-bundle-stamp.js <flutter-host/assets>');
  process.exit(2);
}

const cjs = readFileSync(join(dir, 'skal-app.cjs'));
const jsc = readFileSync(join(dir, 'skal-app.cjs.jsc'));
const sha = createHash('sha256').update(cjs).update(jsc).digest('hex');
writeFileSync(join(dir, 'skal-app.stamp'), `${cjs.length} ${jsc.length} ${sha}\n`);
