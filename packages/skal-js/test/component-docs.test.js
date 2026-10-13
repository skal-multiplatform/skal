// `axis` in the component docs, and the skill reference built from them.
//
// <ScrollView> and <ListView> scroll sideways with `axis={1}` on both
// targets, but their JSDoc never declared `axis`. The agent skill that
// ships in every new app is generated from that JSDoc
// (scripts/gen-skill-reference.mjs → the template's
// .claude/skills/skal/references/components.md), so it never taught
// horizontal scrolling there, and an agent that wanted a scrolling row
// had nothing to reach for. <PageView> and <Stepper> declared it already.
//
// Pinned here, like link-exports.test.js, because CI runs this suite on
// every push; it tests docs, not JavaScript.

import { test, expect, describe } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = path.resolve(import.meta.dirname, '../../..');
const INDEX = 'packages/skal-js/src/skal/index.js';
const GENERATOR = 'scripts/gen-skill-reference.mjs';
const REFERENCE =
  'scripts/templates/default/.claude/skills/skal/references/components.md';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

/// The `@type {Component<…>}` of the JSDoc block right above an export.
function jsdocType(src, name) {
  const at = src.indexOf(`export const ${name} = makeMissingMacroComponent`);
  expect(at).toBeGreaterThan(-1);
  const block = src.slice(src.lastIndexOf('/**', at), at);
  const m = block.match(/@type\s+\{Component<([\s\S]*?)>\}\s*\*\/\s*$/);
  expect(m).not.toBeNull();
  return m[1].replace(/\s*\*\s*/g, ' ');
}

/// The **Props:** line of a component's section in the skill reference.
function referenceProps(md, name) {
  const at = md.indexOf(`\n## <${name}>\n`);
  expect(at).toBeGreaterThan(-1);
  const section = md.slice(at + 1, md.indexOf('\n## ', at + 1));
  return section.match(/^\*\*Props:\*\* (.*)$/m)?.[1] ?? '';
}

describe('axis in the component docs', () => {
  for (const name of ['ScrollView', 'ListView', 'PageView', 'Stepper']) {
    test(`<${name}> declares axis, and the skill reference teaches it`, () => {
      expect(jsdocType(read(INDEX), name)).toMatch(/\baxis\?: number\b/);
      expect(referenceProps(read(REFERENCE), name)).toMatch(/\baxis\?: number\b/);
    });
  }
});

describe('the skill reference', () => {
  test('is what gen-skill-reference.mjs makes of index.js', () => {
    // The generator writes next to itself, so run a copy in a scratch
    // tree with the same layout rather than touching the template.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skal-skill-ref-'));
    try {
      for (const p of [GENERATOR, INDEX]) {
        fs.mkdirSync(path.dirname(path.join(tmp, p)), { recursive: true });
        fs.copyFileSync(path.join(REPO, p), path.join(tmp, p));
      }
      const res = spawnSync(process.execPath, [path.join(tmp, GENERATOR)],
        { encoding: 'utf8' });
      expect(res.status).toBe(0);
      // A mismatch means index.js changed without a regenerate:
      //   bun scripts/gen-skill-reference.mjs
      expect(read(REFERENCE))
        .toBe(fs.readFileSync(path.join(tmp, REFERENCE), 'utf8'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
