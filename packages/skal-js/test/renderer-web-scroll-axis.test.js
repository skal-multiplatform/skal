// Clearing `axis` on web gives a scroller back its default direction.
//
// `axis` sets a scroller's flex direction and overflow together: 1 is a
// row that scrolls along x, 0 a column that scrolls along y. The clear
// blanked all three, and blank is not the default. A <scrollView> or
// <listView> with no direction and no overflow lays out as a flex row
// that cannot scroll, so `axis={wide() ? 1 : null}` broke the list the
// first time it went back. The web pager had the same bug
// (renderer-web-page-view.test.js). A cleared axis is now one that was
// never set.

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

// An element's inline declarations, in any order: the clear appends what
// it puts back, so its cssText is ordered differently from a fresh one's.
const decls = (e) =>
  e.style.cssText.split(';').map((d) => d.trim()).filter(Boolean).sort();

// The tags whose native builder reads `axis` (root.dart: _buildScrollView,
// _buildListView, _buildReorderableListView, _buildCustomScrollView,
// _buildStepper and the pager). The stepper has no default axis on web,
// so for it the old blank clear was already right.
const AXIS_TAGS = [
  'scrollView', 'listView', 'reorderableListView', 'customScrollView',
  'pageView', 'stepper',
];

describe('a cleared axis on web', () => {
  for (const tag of AXIS_TAGS) {
    for (const axis of [1, 0]) {
      test(`<${tag}> with axis ${axis}, cleared, is a fresh <${tag}>`, () => {
        const e = R.createElement(tag);
        R.setProp(e, 'axis', axis);
        R.setProp(e, 'axis', null);
        expect(decls(e)).toEqual(decls(R.createElement(tag)));
      });
    }
  }

  test('a cleared scrollView is a column that scrolls along y', () => {
    const e = R.createElement('scrollView');
    R.setProp(e, 'axis', 1);
    R.setProp(e, 'axis', null);
    expect(e.style.flexDirection).toBe('column');
    expect(e.style.overflowY).toBe('auto');
  });

  test('a cleared listView windows its builder rows vertically', () => {
    // _syncBuilderRows reads the windowing axis from here, not the style.
    const e = R.createElement('listView');
    R.setProp(e, 'axis', 1);
    expect(e._skalListAxis).toBe(1);
    R.setProp(e, 'axis', null);
    expect(e._skalListAxis).toBe(0);
  });
});

// Same reason as renderer-web-clear.test.js: bun shares one process
// across files, and a leaked window changes how later modules evaluate.
afterAll(() => {
  delete globalThis.window;
  delete globalThis.document;
});
