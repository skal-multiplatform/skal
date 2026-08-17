// Turning a web prop back OFF.
//
// `bg={active ? RED : null}` has to be reversible. The DOM renderer's
// null branch used to `return` without touching the element, so the
// last non-null value stuck forever — a conditional style could be
// turned on and never off. The native renderer had the same defect;
// there the fix is a wire op (`opClearProp`, covered in
// skal_flutter/test/bridge_drain_test.dart).
//
// DOM has no wire, so `CLEAR_PROP` in renderer-web.js is an explicit
// name → undo table. The first attempt LEARNED each prop's declarations
// by diffing the element's style across the prop's first write; it was
// value-dependent, blind to the eleven cases that assign DOM properties
// instead of styles, and attributed shared declarations to whichever
// prop set them first. All three failure modes have a test below.
//
// The standing objection to a table is drift, which is what the first
// test here exists to remove: it parses the renderer and fails if any
// `case` in `applyProp` has no clear entry.

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';

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

const div = () => document.createElement('div');
const el = (tag) => R.createElement(tag);

describe('the clear table cannot drift from applyProp', () => {
  test('every applyProp case has a CLEAR_PROP entry', () => {
    const src = readFileSync(
      new URL('../src/renderer-web.js', import.meta.url), 'utf8');

    const applyPropBody = src.slice(
      src.indexOf('function applyProp(node, name, value)'));
    const cases = [...applyPropBody.slice(0, applyPropBody.indexOf('\n}\n'))
      .matchAll(/^\s*case '([A-Za-z]+)':/gm)].map((m) => m[1]);

    const table = src.slice(src.indexOf('const CLEAR_PROP = {'));
    const entries = new Set(
      [...table.slice(0, table.indexOf('\n};')).matchAll(/^\s{2}([A-Za-z]+):/gm)]
        .map((m) => m[1]));

    expect(cases.length).toBeGreaterThan(40);   // the parse actually worked
    const missing = cases.filter((c) => !entries.has(c));
    expect(missing).toEqual([]);
  });
});

describe('clearing a web prop', () => {
  test('a null removes the declaration the prop set', () => {
    const e = div();
    R.setProp(e, 'padding', 12);
    expect(e.style.padding).toBe('12px');
    R.setProp(e, 'padding', null);
    expect(e.style.padding).toBe('');
  });

  test('it removes only that prop, leaving its neighbours alone', () => {
    const e = div();
    R.setProp(e, 'padding', 12);
    R.setProp(e, 'gap', 8);
    R.setProp(e, 'padding', null);
    expect(e.style.padding).toBe('');
    expect(e.style.gap).toBe('8px');
  });

  test('a prop can be turned off and back on', () => {
    const e = div();
    R.setProp(e, 'gap', 8);
    R.setProp(e, 'gap', null);
    expect(e.style.gap).toBe('');
    R.setProp(e, 'gap', 4);
    expect(e.style.gap).toBe('4px');
  });

  test('clearing a prop that was never set is a no-op', () => {
    const e = div();
    expect(() => R.setProp(e, 'gap', null)).not.toThrow();
    expect(e.style.cssText).toBe('');
  });

  test('a multi-declaration prop clears every declaration it owns', () => {
    const e = div();
    R.setProp(e, 'axis', 1);
    expect(e.style.flexDirection).toBe('row');
    R.setProp(e, 'axis', null);
    expect(e.style.flexDirection).toBe('');
    expect(e.style.overflowX).toBe('');
    expect(e.style.overflowY).toBe('');
  });

  // ── The three ways the learner was wrong ─────────────────────────

  test('clearing does not depend on the value the prop was FIRST set to', () => {
    // maxLines(0) sets no declaration at all. The learner cached an
    // empty owned-list here and could never clear the prop again.
    const e = div();
    R.setProp(e, 'maxLines', 0);          // sets nothing
    R.setProp(e, 'maxLines', 2);          // NOW sets four declarations
    expect(e.style.webkitLineClamp).toBe('2');

    R.setProp(e, 'maxLines', null);
    expect(e.style.webkitLineClamp).toBe('');
    expect(e.style.webkitBoxOrient).toBe('');
    expect(e.style.display).toBe('');
    expect(e.style.overflow).toBe('');
  });

  test('a value-dependent prop clears both of its branches', () => {
    // textOverflow sets `text-overflow` for 1 and `overflow` for 2.
    const e = div();
    R.setProp(e, 'textOverflow', 1);
    R.setProp(e, 'textOverflow', 2);
    expect(e.style.overflow).toBe('visible');
    R.setProp(e, 'textOverflow', null);
    expect(e.style.overflow).toBe('');
    expect(e.style.textOverflow).toBe('');
  });

  test('non-style props clear too', () => {
    const box = el('checkbox');
    R.setProp(box, 'checked', true);
    expect(box.checked).toBe(true);
    R.setProp(box, 'checked', null);
    expect(box.checked).toBe(false);

    const b = el('button');
    R.setProp(b, 'enabled', false);
    expect(b.disabled).toBe(true);
    R.setProp(b, 'enabled', null);
    expect(b.disabled).toBe(false);
  });

  test('a shared declaration survives while a sibling still needs it', () => {
    // `position: absolute` belongs to all four stack offsets. Dropping
    // it when only `top` goes away would take the element out of the
    // stack and move `left` somewhere unrelated.
    const e = div();
    R.setProp(e, 'top', 4);
    R.setProp(e, 'left', 8);
    expect(e.style.position).toBe('absolute');

    R.setProp(e, 'top', null);
    expect(e.style.top).toBe('');
    expect(e.style.position).toBe('absolute');   // `left` still needs it
    expect(e.style.left).toBe('8px');

    R.setProp(e, 'left', null);
    expect(e.style.position).toBe('');           // last one out
  });

  test('border-style survives until both width and colour are gone', () => {
    const e = div();
    R.setProp(e, 'borderWidth', 2);
    R.setProp(e, 'borderColor', 0xFF0000FF);
    expect(e.style.borderStyle).toBe('solid');

    R.setProp(e, 'borderWidth', null);
    expect(e.style.borderStyle).toBe('solid');   // colour still needs it
    R.setProp(e, 'borderColor', null);
    expect(e.style.borderStyle).toBe('');
  });

  test('a hot prop clears to its identity, matching native', () => {
    // Native resets hot props to identity rather than spending an
    // opcode on them (HOT_PROP_IDENTITY in renderer.js). Web must agree.
    const e = div();
    R.setProp(e, 'scaleX', 2);
    expect(e.style.transform).toContain('scale');
    R.setProp(e, 'scaleX', null);
    expect(e.style.transform).not.toContain('scale(2');
  });
});

describe('every clear entry actually undoes its own prop', () => {
  // The drift test above proves COVERAGE — every applyProp case has an
  // entry. It does not prove CORRECTNESS: `paddingTop: _rm('paddingBottom')`
  // would satisfy it. With 49 entries and a dozen hand-written cases,
  // that left ~37 unverified, so this drives all of them.
  //
  // The check is a style round-trip: set the prop, and if it produced
  // any inline declaration, clearing must return the element to a
  // pristine cssText. A clear that names the wrong property, or misses
  // one of several, fails here.
  //
  // Props whose sample value produces no declaration are reported
  // rather than silently skipped — a shrinking-coverage regression
  // should be visible, not invisible.

  // Values chosen to make each case actually write something. A plain
  // number is enough for most; the rest need their own shape.
  const SAMPLE = {
    background: 0xFF3355FF, color: 0xFF112233, borderColor: 0xFF445566,
    width: 120, height: 40, maxLines: 2, textOverflow: 1, axis: 1,
    alignment: 1, contentScale: 1, fontFamily: 1, textAlign: 1,
    visible: false, secureEntry: true, keyboardType: 1, enabled: false,
    focusable: true, checked: true, progress: 0.5, src: 'x.png',
    placeholder: 'hint', value: 'v', min: 0, max: 10, aspectRatio: 1,
  };

  function tableNames() {
    const src = readFileSync(
      new URL('../src/renderer-web.js', import.meta.url), 'utf8');
    const table = src.slice(src.indexOf('const CLEAR_PROP = {'));
    return [...table.slice(0, table.indexOf('\n};'))
      .matchAll(/^\s{2}([A-Za-z]+):/gm)].map((m) => m[1]);
  }

  test('setting then clearing returns the element to pristine', () => {
    const names = tableNames();
    expect(names.length).toBeGreaterThan(40);

    const broken = [];
    const inert = [];

    for (const name of names) {
      const e = div();
      R.setProp(e, name, SAMPLE[name] ?? 1);
      const after = e.style.cssText;
      if (!after) { inert.push(name); continue; }

      R.setProp(e, name, null);
      if (e.style.cssText !== '') {
        broken.push(`${name}: "${after}" -> "${e.style.cssText}"`);
      }
    }

    expect(broken).toEqual([]);
    // Coverage floor. Most of the table is style-valued; if this drops,
    // the generated check has quietly stopped exercising things.
    expect(names.length - inert.length).toBeGreaterThanOrEqual(30);
  });

  test('clearing one prop never disturbs an unrelated one', () => {
    // Catches an entry that names too MUCH — clearing `gap` must not
    // take `padding` with it.
    const names = tableNames();
    const broken = [];
    for (const name of names) {
      if (name === 'padding' || name === 'paddingTop') continue;
      const e = div();
      R.setProp(e, 'padding', 7);
      R.setProp(e, name, SAMPLE[name] ?? 1);
      R.setProp(e, name, null);
      if (e.style.paddingTop !== '7px') {
        broken.push(`clearing ${name} disturbed padding`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('the DOM-property entries', () => {
  // The generated round-trip above is a STYLE check — it watches
  // cssText, so the eleven entries that assign a DOM property instead
  // of a declaration are invisible to it. (The five hot-lane entries
  // used to be invisible too; they became visible once clearing to rest
  // started dropping `transform` and `will-change` rather than writing
  // an identity transform.)
  //
  // These are the ones the learner could never clear at all, so they
  // are the reason the table exists. Drive each explicitly.
  const CASES = [
    ['checkbox',  'checked',      true,     (n) => n.checked,      false],
    ['button',    'enabled',      false,    (n) => n.disabled,     false],
    ['button',    'focusable',    true,     (n) => n.getAttribute('tabindex'), null],
    ['image',     'src',          'a.png',  (n) => n.getAttribute('src'), null],
    ['slider',    'min',          2,        (n) => n.getAttribute('min'), null],
    ['slider',    'max',          9,        (n) => n.getAttribute('max'), null],
    ['textInput', 'placeholder',  'hint',   (n) => n.placeholder,  ''],
    ['textInput', 'value',        'typed',  (n) => n.value,        ''],
    ['textInput', 'secureEntry',  true,     (n) => n.type,         'text'],
    ['textInput', 'keyboardType', 1,        (n) => n.inputMode,    'text'],
  ];

  for (const [tag, prop, value, read, cleared] of CASES) {
    test(`${prop} returns to its default`, () => {
      const n = el(tag);
      const before = read(n);
      R.setProp(n, prop, value);
      expect(read(n)).not.toBe(before);   // the set actually did something

      R.setProp(n, prop, null);
      expect(read(n)).toBe(cleared);
    });
  }

  test('progress clears back to indeterminate', () => {
    // <progress> with no `value` attribute renders indeterminate, which
    // IS the absent state for this prop.
    const n = el('progressBar');
    R.setProp(n, 'progress', 0.5);
    expect(n.getAttribute('value')).not.toBeNull();
    R.setProp(n, 'progress', null);
    expect(n.getAttribute('value')).toBeNull();
  });
});

// Restore the globals this file installed. bun shares one process across
// test files, so a leaked `globalThis.window` changes how a LATER file's
// modules evaluate: bridge.js only registers its hot-reload cleanup when
// `typeof window === 'undefined'` at ITS eval, and it is imported lazily
// elsewhere. Leaking window here made a hot-reload test fail on Linux CI
// and pass on macOS, purely on file order.
afterAll(() => {
  delete globalThis.window;
  delete globalThis.document;
});
