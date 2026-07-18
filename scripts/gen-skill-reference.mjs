// gen-skill-reference.mjs — emit the agent-skill component reference
// from the JSDoc in packages/skal-js/src/skal/index.js.
//
//   bun scripts/gen-skill-reference.mjs
//
// The skill that ships in every scaffolded app (`skal create` →
// .claude/skills/skal/ + .agents/skills/skal/) teaches an AI agent the
// component catalog. Hand-written copies of an API reference drift;
// this script re-derives it from the same `@type {Component<…>}` JSDoc
// that drives IDE completion, so the skill and the editor always agree.
// Re-run after adding a widget to index.js (step 5 of the "Adding a
// new widget" checklist there).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'packages', 'skal-js', 'src', 'skal', 'index.js');
const OUT = join(ROOT, 'scripts', 'templates', 'default',
  '.claude', 'skills', 'skal', 'references', 'components.md');

const src = readFileSync(SRC, 'utf8');

// ── JSDoc block scanner ─────────────────────────────────────────────
// Pull every `/** … */` block together with the first non-blank line
// that follows it, so we can tell component docs from typedefs. Peek
// at that line without consuming it — folding it into the match would
// swallow the `/**` opener of a back-to-back block (BaseProps →
// TextProps) and silently drop it.
const blocks = [];
const re = /\/\*\*([\s\S]*?)\*\//g;
for (let m; (m = re.exec(src));) {
  const body = m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\* ?/, '').replace(/^\s*\*$/, ''))
    .join('\n')
    .trim();
  const next = src.slice(re.lastIndex).match(/^\s*([^\n]*)/)?.[1] ?? '';
  blocks.push({ body, next: next.trim() });
}

// ── typedef props (BaseProps etc.) ──────────────────────────────────
// `@property {type} [name] description…` — description runs until the
// next @property. Render one bullet per prop.
function typedefProps(body) {
  const out = [];
  const propRe = /@property\s+\{([^}]*)\}\s+(\[?[\w$]+\]?)\s*([\s\S]*?)(?=@property|$)/g;
  for (let m; (m = propRe.exec(body));) {
    const type = m[1].replace(/\s+/g, ' ').trim();
    const name = m[2].replace(/[[\]]/g, '');
    const desc = m[3].replace(/\s+/g, ' ').trim();
    out.push(`- \`${name}: ${type}\`${desc ? ` — ${desc}` : ''}`);
  }
  return out;
}

// ── component docs ──────────────────────────────────────────────────
// Doc text = the block minus its @type tail; the @type's Component<…>
// parameter becomes the "Props:" line.
function componentEntry(name, body) {
  const typeM = body.match(/@type\s+\{Component<([\s\S]*?)>\}/);
  const props = typeM
    ? typeM[1].replace(/\n\s*\*?\s*/g, ' ').replace(/\s+/g, ' ').trim()
    : 'BaseProps';
  const text = body
    .replace(/@type\s+\{[\s\S]*$/, '')     // strip the @type tail
    .replace(/\{@link\s+(\w+)\}/g, '`<$1>`')
    .trim();
  return `## <${name}>\n\n${text}\n\n**Props:** \`${props}\`\n`;
}

const sections = [];
let baseProps = null;
const typedefs = [];

for (const { body, next } of blocks) {
  const compM = next.match(/^export const (\w+) = makeMissingMacroComponent/);
  if (compM) {
    sections.push(componentEntry(compM[1], body));
    continue;
  }
  if (/@typedef/.test(body)) {
    const nameM = body.match(/\}\}?\s*(\w+)\s*(?:\/\/[^\n]*)?$/m)
      || body.match(/@typedef\s+\{Object\}\s+(\w+)/);
    const name = nameM?.[1];
    if (name === 'BaseProps') baseProps = body;
    else if (name && name !== 'Component') typedefs.push({ name, body });
  }
  if (next.startsWith('export function registerHtmlView')) {
    const text = body
      .replace(/@param[\s\S]*$/, '')
      .replace(/\{@link\s+(\w+)\}/g, '`<$1>`')
      .trim();
    sections.push(`## registerHtmlView(viewType, factory)\n\n${text}\n`);
  }
}

if (!baseProps || sections.length < 10) {
  console.error(`gen-skill-reference: parse looks wrong — baseProps=${!!baseProps}, components=${sections.length}`);
  process.exit(1);
}

const baseIntro = baseProps
  .slice(0, baseProps.indexOf('@property'))
  .replace(/@typedef\s+\{Object\}\s+BaseProps\s*/, '')
  .replace(/\s+/g, ' ')
  .trim();

const md = `# Skal component reference

> GENERATED from \`packages/skal-js/src/skal/index.js\` by
> \`scripts/gen-skill-reference.mjs\` — do not hand-edit; re-run the
> script after adding or changing a widget.

All components are imported from \`'skal'\`:

\`\`\`jsx
import { Column, Row, Text, Button, ListView } from 'skal';
\`\`\`

## Shared props — \`BaseProps\`

${baseIntro}

${typedefProps(baseProps).join('\n')}

${typedefs.map(({ name, body }) => {
  const propsM = body.match(/BaseProps & \{([\s\S]*?)\}\}/);
  const inner = propsM ? propsM[1].replace(/\s+/g, ' ').trim() : '';
  return `## \`${name}\`\n\n\`BaseProps & { ${inner} }\``;
}).join('\n\n')}

${sections.join('\n')}`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md);
console.log(`✓ ${OUT.replace(ROOT + '/', '')} (${md.length} bytes, ${sections.length} components)`);
