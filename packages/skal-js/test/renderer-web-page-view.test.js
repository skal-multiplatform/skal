// A web <pageView> pages along its axis, horizontally by default.
//
// The DOM pager has always been a horizontal scroll-snap strip, and
// native now agrees (skal_flutter/test/page_view_axis_test.dart). What
// web got wrong was the other axis: `axis={0}` turned the strip into a
// column but left `scroll-snap-type: x mandatory`, so a vertical pager
// scrolled freely and never settled on a page. And clearing `axis`
// blanked the strip's own overflow, leaving a pager that could not
// scroll at all.

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
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

const axisOf = (e) => ({
  flexDirection: e.style.flexDirection,
  overflowX: e.style.overflowX,
  overflowY: e.style.overflowY,
  snap: e.style.scrollSnapType,
});

const HORIZONTAL = {
  flexDirection: 'row', overflowX: 'auto', overflowY: '', snap: 'x mandatory',
};
const VERTICAL = {
  flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto',
  snap: 'y mandatory',
};

describe('<pageView> axis on web', () => {
  test('with no axis it is a horizontal snap strip', () => {
    expect(axisOf(R.createElement('pageView'))).toEqual(HORIZONTAL);
  });

  test('axis 1 is the same strip', () => {
    const e = R.createElement('pageView');
    R.setProp(e, 'axis', 1);
    expect(axisOf(e)).toEqual(HORIZONTAL);
  });

  test('axis 0 scrolls and snaps vertically', () => {
    const e = R.createElement('pageView');
    R.setProp(e, 'axis', 0);
    expect(axisOf(e)).toEqual(VERTICAL);
  });

  test('clearing axis returns it to the horizontal strip', () => {
    const e = R.createElement('pageView');
    R.setProp(e, 'axis', 0);
    R.setProp(e, 'axis', null);
    expect(axisOf(e)).toEqual(HORIZONTAL);
  });

  test('a page fills the strip and snaps to its start', () => {
    const e = R.createElement('pageView');
    const page = R.createElement('box');
    R.insertNode(e, page);
    expect(page.style.flex).toBe('0 0 100%');
    expect(page.style.scrollSnapAlign).toBe('start');
  });
});

// Same reason as renderer-web-clear.test.js: bun shares one process
// across files, and a leaked window changes how later modules evaluate.
afterAll(() => {
  delete globalThis.window;
  delete globalThis.document;
});
