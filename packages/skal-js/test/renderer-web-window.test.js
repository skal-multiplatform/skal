// Builder-mode <listView> windowing on the DOM target.
//
// This used to mount every row eagerly up to a 1500 cap, under a comment
// claiming "the browser culls offscreen paint itself". Browsers cull
// PAINT — they still build every element, lay it out, keep it in memory,
// and run every observer and Solid root hanging off it. A 10k list cost
// 10k roots and silently dropped everything past 1500.
//
// happy-dom has no layout engine: clientHeight/offsetHeight are 0. That
// is not just a testing nuisance, it is a real deployment shape — the
// site prerender runs under happy-dom, and any SSR pass would too. A
// naive viewport calculation windows to NOTHING there and renders an
// empty list, so the headless fallback below is load-bearing rather than
// a test convenience. Both paths are covered.

import { test, expect, describe, beforeAll, beforeEach } from 'bun:test';
import { Window } from 'happy-dom';

let R;

beforeAll(async () => {
  const window = new Window({ url: 'https://skal.test' });
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.customElements = window.customElements;
  R = await import('../src/renderer-web.js');
});

/// Give an element the geometry happy-dom will not compute, so the
/// windowing maths has something real to work against.
function fakeGeometry(el, { viewport, rowHeight }) {
  Object.defineProperty(el, 'clientHeight', {
    configurable: true, get: () => viewport,
  });
  let scrollTop = 0;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (v) => { scrollTop = v; },
  });
  // Every row wrapper reports a fixed height.
  Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() { return this._skalBuilderRow ? rowHeight : 0; },
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/// Mount a builder list of `count` rows and return the element.
async function list(count, opts = {}) {
  const el = R.createElement('listView');
  document.body.appendChild(el);
  if (opts.geometry) fakeGeometry(el, opts.geometry);
  if (opts.axis !== undefined) R.setProp(el, 'axis', opts.axis);
  R.setProp(el, 'renderItem', (i) => {
    const d = document.createElement('div');
    d.textContent = `row ${i}`;
    return d;
  });
  R.setProp(el, 'count', count);
  await flush();
  return el;
}

const mountedRows = (el) =>
  [...el.children].filter((c) => c._skalBuilderRow);

describe('builder-mode list windowing', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  test('a huge list mounts a viewport-sized window, not the whole thing', async () => {
    const el = await list(10000, { geometry: { viewport: 480, rowHeight: 48 } });
    const rows = mountedRows(el);

    // 480/48 = 10 visible, plus overscan both sides. Nowhere near 10000,
    // and — the part that matters — nowhere near the old 1500 cap.
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(40);
  });

  test('there is no row cap any more', async () => {
    // The old path silently dropped everything past 1500. Scrolling deep
    // into a 10k list must reach rows that never used to exist.
    const el = await list(10000, { geometry: { viewport: 480, rowHeight: 48 } });

    el.scrollTop = 9000 * 48;
    el.dispatchEvent(new window.Event('scroll'));
    await flush();

    const idx = mountedRows(el).map((r) => r._skalRowIndex);
    expect(Math.max(...idx)).toBeGreaterThan(1500);
    expect(Math.max(...idx)).toBeGreaterThan(8000);
  });

  test('scrolling swaps the window rather than growing it', async () => {
    const el = await list(5000, { geometry: { viewport: 480, rowHeight: 48 } });
    const before = mountedRows(el).length;
    const firstIdx = mountedRows(el).map((r) => r._skalRowIndex);

    el.scrollTop = 2000 * 48;
    el.dispatchEvent(new window.Event('scroll'));
    await flush();

    const after = mountedRows(el);
    // Roughly the same number of rows — a window, not an accumulation.
    expect(after.length).toBeLessThan(before + 10);
    // And a genuinely different slice.
    const laterIdx = after.map((r) => r._skalRowIndex);
    expect(Math.min(...laterIdx)).toBeGreaterThan(Math.max(...firstIdx));
  });

  test('spacers stand in for the rows that do not exist', async () => {
    const el = await list(1000, { geometry: { viewport: 480, rowHeight: 48 } });
    const spacers = [...el.children].filter((c) => c._skalSpacer);
    expect(spacers.length).toBe(2);

    // At the top: nothing above, a lot below.
    expect(parseInt(spacers[0].style.height, 10)).toBe(0);
    expect(parseInt(spacers[1].style.height, 10)).toBeGreaterThan(40000);
  });

  test('the window is ordered, and bracketed by the spacers', async () => {
    const el = await list(1000, { geometry: { viewport: 480, rowHeight: 48 } });
    const kids = [...el.children];
    expect(kids[0]._skalSpacer).toBe(true);
    expect(kids[kids.length - 1]._skalSpacer).toBe(true);

    const idx = mountedRows(el).map((r) => r._skalRowIndex);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  test('a shrinking count drops the rows past the end', async () => {
    const el = await list(1000, { geometry: { viewport: 480, rowHeight: 48 } });
    R.setProp(el, 'count', 3);
    await flush();

    const idx = mountedRows(el).map((r) => r._skalRowIndex);
    expect(Math.max(...idx)).toBeLessThan(3);
  });

  // ── the headless / SSR shape ─────────────────────────────────────

  test('with no layout at all it still renders a screenful, not zero', async () => {
    // happy-dom reports clientHeight 0. Windowing off that would mount
    // NOTHING — an empty list in every prerendered page.
    const el = await list(500);
    const rows = mountedRows(el);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(rows[0]._skalRowIndex).toBe(0);
  });

  test('a short list renders entirely even headless', async () => {
    const el = await list(3);
    expect(mountedRows(el).length).toBe(3);
  });

  // ── the horizontal fallback ──────────────────────────────────────

  test('a horizontal list keeps the eager path', async () => {
    // Windowing it needs the same work against scrollLeft/clientWidth;
    // documented as unhandled, so pin that it still renders rather than
    // silently windowing to nothing.
    const el = await list(40, { axis: 1 });
    expect(mountedRows(el).length).toBe(40);
    expect([...el.children].some((c) => c._skalSpacer)).toBe(false);
  });
});
