// What bridge.js does when there is no host — i.e. on the DOM target.
//
// Importing it used to allocate the full 6 MiB shared region for bytes
// nothing reads: `skal-runtime.jsx` imports it unconditionally, and the
// store pulled it in just to ask for a data directory. Every web page
// paid for a bridge it has no host for.
//
// It now allocates only the 64-byte header. That is safe ONLY because
// the writers refuse when there is no host: everything past the header
// lives at offsets outside the stub buffer, and a typed-array write past
// the end is SILENTLY DROPPED in JS rather than throwing. Quietly
// scribbling into nowhere is exactly the failure this has to avoid, so
// the refusal is the load-bearing half of the change.
//
// These run in a SUBPROCESS. bridge.js binds its host hooks once per
// process at module-eval, and bun shares the module registry across test
// files — so a sibling file that installs `__skal_acquireBridge` first
// freezes `HAS_NATIVE_BRIDGE` to true and this can never be observed
// in-process. (Learned twice this session: once on the doorbell, once on
// the store's DOM-boot guard.)

import { test, expect, describe } from 'bun:test';

const BRIDGE = new URL('../src/bridge.js', import.meta.url).pathname;

/// Run `body` in a fresh bun process with no host installed.
async function inFreshProcess(body) {
  const src = `
    delete globalThis.__skal_acquireBridge;
    delete globalThis.__skal_notifyHost;
    const B = await import(${JSON.stringify(BRIDGE)});
    const out = [];
    const realError = console.error;
    console.error = (m) => out.push(String(m));
    ${body}
    console.error = realError;
    realError.call(console, JSON.stringify({ result, warnings: out }));
  `;
  const proc = Bun.spawn(['bun', '-e', src], { stdout: 'pipe', stderr: 'pipe' });
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  const line = err.trim().split('\n').filter(Boolean).pop();
  return JSON.parse(line);
}

describe('bridge.js with no native host', () => {
  test('reports no native bridge', async () => {
    const { result } = await inFreshProcess(
      'const result = { has: B.HAS_NATIVE_BRIDGE };');
    expect(result.has).toBe(false);
  });

  test('allocates a stub, not the 6 MiB region', async () => {
    // `process.memoryUsage().arrayBuffers` — NOT heapTotal, which does
    // not count ArrayBuffers at all (they are off-heap). The first
    // version of this test asserted on heapTotal and passed happily
    // with the 6 MiB allocation restored, which is no test.
    const { result } = await inFreshProcess(
      'const result = { ab: process.memoryUsage().arrayBuffers };');

    // 6 MiB is 6291456. A stub plus bun's own baseline is orders below.
    expect(result.ab).toBeLessThan(1024 * 1024);
  });

  test('writeOp refuses instead of writing out of bounds', async () => {
    const { result, warnings } = await inFreshProcess(`
      B.writeOp(0x01, 1, 2, 3);
      const result = { ok: true };
    `);
    expect(result.ok).toBe(true);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('no native bridge');
    expect(warnings[0]).toContain('renderer-web');   // names the likely cause
  });

  test('the refusal warns once, not per call', async () => {
    const { warnings } = await inFreshProcess(`
      for (let i = 0; i < 50; i++) B.writeOp(0x01, i, 0, 0);
      const result = { ok: true };
    `);
    expect(warnings.length).toBe(1);
  });

  test('a prop setter that writes strings also refuses', async () => {
    const { warnings } = await inFreshProcess(`
      B.setText(7, 'hello');
      const result = { ok: true };
    `);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('no native bridge');
  });

  test('importing it does not throw', async () => {
    // The DOM target imports this module on every page load. Whatever
    // else changes, that has to stay true.
    const { result } = await inFreshProcess('const result = { ok: true };');
    expect(result.ok).toBe(true);
  });
});
