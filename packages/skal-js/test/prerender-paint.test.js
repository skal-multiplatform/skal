// The prerendered page must stay on screen until the live tree replaces
// it.
//
// scripts/prerender-web.js used to inject
// `<script>document.getElementById('app').innerHTML=''</script>` before
// </body>. That runs while the parser is still walking the document,
// but the app bundle is DEFERRED — it re-renders only after fetch,
// parse and execute. Everything in between was a blank page, and it
// grew with latency: the prerender bought a fast first paint and threw
// it away a few milliseconds later.
//
// main.jsx clears the mount one statement before render() instead, so
// the swap happens in a single task and there is no gap. It also fails
// better: if the bundle never arrives the reader keeps the prerendered
// content instead of a blank page.
//
// Neither half is observable from a unit test of either file, and the
// symptom (a flash, worse on slow links) is exactly what nobody
// reproduces locally. So assert the shape of both.
//
// Lives in the JS suite because that is what CI runs on every push; it
// tests repo wiring, not JavaScript.

import { test, expect, describe } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

describe('prerendered paint is not thrown away', () => {
  test('the prerenderer injects no eager clear', () => {
    const src = read('scripts/prerender-web.js');
    // Any inline script that empties the mount during parse.
    const eager = /<script>[^<]*getElementById\(['"]app['"]\)\.innerHTML\s*=/;
    expect(eager.test(src),
        'an inline clear before </body> blanks the page until the '
        + 'deferred bundle executes').toBe(false);
  });

  test('the entry clears the mount immediately before render', () => {
    const src = read('site/src/main.jsx');
    const clearAt = src.indexOf("innerHTML = ''");
    const renderAt = src.search(/\brender\(\(\) =>/);
    expect(clearAt, 'main.jsx must clear the prerendered markup itself')
        .toBeGreaterThan(-1);
    expect(renderAt).toBeGreaterThan(-1);
    expect(clearAt, 'the clear has to come BEFORE render, or the live '
        + 'tree is wiped').toBeLessThan(renderAt);

    // …and nothing may sit between them that could yield to the event
    // loop, or the gap comes back. Only whitespace/comments allowed.
    const between = src
        .slice(src.indexOf('\n', clearAt), renderAt)
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
    expect(between,
        'the clear and the render must be adjacent — anything async '
        + 'between them reopens the blank interval').toBe('');
  });
});
