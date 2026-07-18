// build-md.mjs — emit agent-consumable markdown next to the docs.
//
//   bun site/scripts/build-md.mjs        (runs as part of `bun run build`)
//
// Every docs page gets a `.md` sibling at the same URL (docs/x.html →
// docs/x.md) so an AI agent — or the "Copy for AI" button in the docs
// chrome — can pull clean markdown instead of scraping HTML. Also
// emits the site-root `llms.txt` (condensed framework brief + the .md
// link index, per the llms.txt convention) and `llms-full.txt` (all
// docs concatenated) into dist/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import turndownPluginGfm from 'turndown-plugin-gfm';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'website', 'docs');
const DIST = join(HERE, '..', 'dist');
const ORIGIN = 'https://skal.run';

// Same page set as extract-content.mjs / the sidebar in Chrome.jsx.
const DOCS = [
  ['index', 'Getting started', 'install, scaffold, first run'],
  ['architecture', 'Architecture', 'how SolidJS drives Flutter through the shared-memory bridge'],
  ['components', 'Components', 'the full component catalog with live examples'],
  ['state', 'State & the Store', 'signals, createSkalStore persistence, hot-reload state'],
  ['native', 'Wrapping pub.dev packages', 'use any Flutter widget from JSX via skal_codegen'],
  ['tooling', 'Hot reload & dev loop', 'dev commands, hot reload, release builds'],
  ['testing', 'Testing', 'testID, Maestro E2E, flutter test'],
];

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
td.use(turndownPluginGfm.gfm);
// The docs' code blocks are `<pre class="code">` with no inner <code>
// — the default rule would inline them. Fence any <pre> verbatim.
td.addRule('barePre', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (_content, node) => `\n\n\`\`\`jsx\n${node.textContent.replace(/\n+$/, '')}\n\`\`\`\n\n`,
});
// Page furniture that means nothing in markdown: the live-player block
// and its per-component "▶ run live" buttons.
td.remove((node) =>
  node.nodeName === 'BUTTON' ||
  /(^|\s)live-gallery(\s|$)/.test(node.getAttribute?.('class') ?? ''));
// Relative image paths → absolute site URLs so the markdown works
// anywhere (an agent's context, a README, a gist).
td.addRule('absImg', {
  filter: 'img',
  replacement: (_c, node) => {
    const alt = node.getAttribute('alt') ?? '';
    let src = node.getAttribute('src') ?? '';
    src = src.replace(/^(\.\.\/)+/, `${ORIGIN}/`);
    return src ? `![${alt}](${src})` : '';
  },
});

const between = (s, startRe, endRe) => {
  const m = s.match(startRe);
  if (!m) throw new Error(`start not found: ${startRe}`);
  const from = m.index + m[0].length;
  const end = s.slice(from).search(endRe);
  if (end < 0) throw new Error(`end not found: ${endRe}`);
  return s.slice(from, from + end);
};

mkdirSync(join(DIST, 'docs'), { recursive: true });

const pages = [];
for (const [name, label, blurb] of DOCS) {
  const html = readFileSync(join(SRC, `${name}.html`), 'utf8');
  const article = between(html, /<article class="doc">/, /<\/article>/);
  const body = td.turndown(article).trim();
  const url = `${ORIGIN}/docs/${name === 'index' ? '' : `${name}.html`}`;
  const md = `<!-- Skal docs — markdown mirror of ${url} -->\n\n${body}\n`;
  writeFileSync(join(DIST, 'docs', `${name}.md`), md);
  pages.push({ name, label, blurb, md });
  console.log(`✓ docs/${name}.md (${md.length} bytes)`);
}

// ── llms.txt — the condensed brief agents fetch first ───────────────
const llms = `# Skal

> Skal is a multiplatform UI framework — the modern alternative to
> React Native. You write SolidJS (signals, JSX), and a zero-copy
> shared-memory bridge drives a native Flutter renderer: real GPU
> widgets on iOS/Android/macOS, real DOM on the web. No JavaScript
> bridge tax, no CSS-in-native emulation, no WebView.

Key facts for code generation:

- UI code is **SolidJS, not React**: \`createSignal\` not \`useState\`,
  signals are read by CALLING them (\`count()\`), components run once,
  \`<Show>\`/\`<For>\` instead of ternaries/\`.map\`. React Native
  imports/idioms do not exist here.
- Components are imported from \`'skal'\` (\`<Column>\`, \`<Row>\`,
  \`<Text>\`, \`<Button>\`, \`<ListView>\`, ~50 total). Styling is
  numeric props (dp), not CSS. Colors are 8-digit \`#AARRGGBB\`.
- Big lists: \`<ListView count={n} renderItem={(i) => …} />\`
  (virtualized, O(visible-window) memory).
- Persistent state: \`createSkalStore\` from \`'skal/store'\` (reactive
  deep proxy, auto-persisted). Navigation: \`createRouter\` from
  \`'skal/runtime'\` (native push/pop, keep-alive back stack).
- Animation: set the target prop + \`animate={{ duration }}\`; Flutter
  tweens host-side. Never animate per-frame from JS.
- Scaffold: \`npm create skal my-app\`. Apps ship with an agent skill
  (\`.claude/skills/skal/\`, mirrored in \`.agents/skills/\`) teaching
  these idioms plus the generated component reference.
- Verify changes with \`bun run build:js-only\`; run with
  \`bun run dev:web\` / \`dev:macos\` / \`dev:ios\` / \`dev:android\`.

## Docs (markdown)

${pages.map((p) => `- [${p.label}](${ORIGIN}/docs/${p.name}.md): ${p.blurb}`).join('\n')}

## Optional

- [All docs in one file](${ORIGIN}/llms-full.txt)
- [GitHub](https://github.com/skal-multiplatform/skal)
`;
writeFileSync(join(DIST, 'llms.txt'), llms);
console.log(`✓ llms.txt (${llms.length} bytes)`);

const full = pages
  .map((p) => `<!-- ═══ ${p.label} — ${ORIGIN}/docs/${p.name}.md ═══ -->\n\n${p.md}`)
  .join('\n\n---\n\n');
writeFileSync(join(DIST, 'llms-full.txt'), full);
console.log(`✓ llms-full.txt (${full.length} bytes)`);
