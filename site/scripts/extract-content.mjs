// extract-content.mjs — pull page bodies out of the hand-written
// website/*.html into JS content modules, verbatim.
//
//   node site/scripts/extract-content.mjs
//
// The Solid app owns the chrome (nav / sidebar / footer / head); the
// article bodies start life as extracted HTML islands so the
// prerendered output stays byte-comparable with the original site.
// JSX-ify pages incrementally by replacing their content module with
// real components — this script then stops emitting that page.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'website');
const OUT = join(HERE, '..', 'src', 'content');
mkdirSync(OUT, { recursive: true });

const between = (s, startRe, endRe) => {
  const m = s.match(startRe);
  if (!m) throw new Error(`start not found: ${startRe}`);
  const from = m.index + m[0].length;
  const end = s.slice(from).search(endRe);
  if (end < 0) throw new Error(`end not found: ${endRe}`);
  return s.slice(from, from + end);
};

const emit = (name, html, meta) => {
  writeFileSync(
    join(OUT, `${name}.js`),
    `// GENERATED from website/${meta.src} by site/scripts/extract-content.mjs\n` +
    `export const title = ${JSON.stringify(meta.title)};\n` +
    `export const description = ${JSON.stringify(meta.description ?? '')};\n` +
    `export default ${JSON.stringify(html.trim())};\n`,
  );
  console.log(`✓ content/${name}.js (${html.length} bytes)`);
};

// Landing: everything between the top nav and the footer.
{
  const src = readFileSync(join(SRC, 'index.html'), 'utf8');
  const title = between(src, /<title>/, /<\/title>/).replace(/&amp;/g, "&");
  const desc = src.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const body = between(src, /<\/nav>\s*/, /<footer class="mega">/);
  emit('landing', body, { src: 'index.html', title, description: desc });
  // The landing footer is unique (mega) — extract it too.
  const footer = '<footer class="mega">' + between(src, /<footer class="mega">/, /<\/footer>/) + '</footer>';
  emit('landing-footer', footer, { src: 'index.html', title: title });
}

// Docs pages: the <article class="doc"> body.
const DOCS = [
  ['docs-index', 'docs/index.html'],
  ['architecture', 'docs/architecture.html'],
  ['components', 'docs/components.html'],
  ['state', 'docs/state.html'],
  ['native', 'docs/native.html'],
  ['tooling', 'docs/tooling.html'],
  ['testing', 'docs/testing.html'],
];
for (const [name, rel] of DOCS) {
  const src = readFileSync(join(SRC, rel), 'utf8');
  const title = between(src, /<title>/, /<\/title>/).replace(/&amp;/g, "&");
  const article = between(src, /<article class="doc">/, /<\/article>/);
  emit(name, article, { src: rel, title });
}
