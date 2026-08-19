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

/// FOUR files carry the release version and nothing made them agree.
///
/// packages/skal-cli/package.json is the published one; website/index.html
/// and site/src/components/Chrome.jsx hardcode the pill; site/package.json
/// had already drifted to 0.1.0 while the CLI shipped 0.1.3, so the site
/// advertised a version that was two releases old. Skal/CLAUDE.md names
/// this failure directly — "when N config files or symbol lists must agree,
/// assert it" — so this runs on every extraction and refuses to emit a
/// stale site rather than reporting it in a log nobody reads.
function assertVersionsAgree() {
  const read = (p) => readFileSync(join(HERE, '..', '..', p), 'utf8');
  const cli = JSON.parse(read('packages/skal-cli/package.json')).version;
  const sources = [
    ['site/package.json', JSON.parse(read('site/package.json')).version],
    ['website/index.html',
      read('website/index.html').match(/<span class="pill">v([\d.]+)<\/span>/)?.[1]],
    ['site/src/components/Chrome.jsx',
      read('site/src/components/Chrome.jsx').match(/'v([\d.]+)'/)?.[1]],
  ];
  const bad = sources.filter(([, v]) => v !== cli);
  if (bad.length) {
    throw new Error(
      'version drift against packages/skal-cli/package.json (' + cli + '):\n' +
      bad.map(([f, v]) => '  ' + f + ' = ' + (v ?? '<not found>')).join('\n') +
      '\n\nBump them together, or the site ships a stale version pill.\n');
  }
}
assertVersionsAgree();

const stripTags = (s) => s.replace(/<[^>]+>/g, '');

/// ONE pass, not a chain of ordered replaces.
///
/// Doing `&amp;` first double-unescapes: source `&amp;mdash;` — which means
/// the reader should SEE the literal string "&mdash;" — became `&mdash;` and
/// then an em dash. Matching each entity once, left to right, makes the
/// order irrelevant. The named set covers what the ledes actually use;
/// numeric refs are handled generically.
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←',
  times: '×', middot: '·', laquo: '«', raquo: '»',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
};
const decodeEntities = (s) => s.replace(
  /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
  (whole, body) => {
    if (body[0] === '#') {
      const cp = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
    }
    const hit = ENTITIES[body.toLowerCase()];
    return hit === undefined ? whole : hit;
  });

/// Cut on a word boundary and mark the cut.
///
/// Google renders ~155-160 characters of a description and og:description
/// ~200, so the previous 300 was roughly twice any guideline — dead weight
/// on every /docs/* page, and `.slice(0, 300)` severed mid-word with
/// nothing appended when a lede ran long.
const clamp = (s, max) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.\s]+$/, '') + '…';
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
  const title = decodeEntities(between(src, /<title>/, /<\/title>/));
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
  const title = decodeEntities(between(src, /<title>/, /<\/title>/));
  const article = between(src, /<article class="doc">/, /<\/article>/);
  // Every docs page shipped with an empty description: head.js skips falsy,
  // so /docs/* rendered with only a <title> — no meta description, no
  // og:description. Derive it from the page's own lede rather than adding a
  // hand-written tag per file, so it cannot drift from the content.
  // `between` THROWS when the start pattern is missing, so a `|| ''` here
  // was unreachable — a docs page opening with anything other than a lede
  // would kill the whole extraction, taking the site build with it, rather
  // than shipping without a description. Matched directly so the fallback
  // is real.
  const lede = src.match(/<p class="lede">([\s\S]*?)<\/p>/)?.[1] ?? '';
  const description = clamp(decodeEntities(stripTags(lede)), 160);
  emit(name, article, { src: rel, title, description });
}
