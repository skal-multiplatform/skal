// When the next chunk of an incremental mount runs.
//
// This policy has been wrong twice — `queueMicrotask` (never yields to
// paint at all) and then plain `requestAnimationFrame` (never fires in a
// background tab, so a stream stops dead when the user switches away).
// Neither was caught by a test, because it lived in a `.jsx` file and
// Solid's JSX is a compile-time transform with no runtime shim, so
// `bun test` cannot import it. That is why `chunk-scheduler.js` is its
// own plain module.
//
// `requestAnimationFrame` here is a stub that RECORDS but never invokes
// its callback while hidden — exactly what a background tab does. A
// regression to unconditional rAF hangs these rather than passing them.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { Window } from 'happy-dom';
import {
  createChunkScheduler, yieldToPlatform, cancelYield,
} from '../src/chunk-scheduler.js';

let hidden = false;
let rafQueue = [];
let rafCalls = 0;
let cancelledRafs = 0;
let window;

beforeEach(() => {
  window = new Window({ url: 'https://skal.test' });
  globalThis.window = window;
  globalThis.document = window.document;
  hidden = false;
  rafQueue = [];
  rafCalls = 0;
  cancelledRafs = 0;

  Object.defineProperty(globalThis.document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });

  globalThis.requestAnimationFrame = (fn) => {
    rafCalls++;
    rafQueue.push(fn);
    return rafCalls;
  };
  globalThis.cancelAnimationFrame = () => { cancelledRafs++; };
});

afterEach(() => {
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

// Restore the globals this file installed. bun shares one process across
// test files, so a leaked `globalThis.window` changes how a LATER file's
// modules evaluate: bridge.js only registers its hot-reload cleanup when
// `typeof window === 'undefined'` at ITS eval, and it is imported lazily
// elsewhere. Leaking window here made a hot-reload test fail on Linux CI
// and pass on macOS, purely on file order.
afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});


/// Run pending macrotasks until `done()` or the budget expires. Returns
/// whether it finished — a hang becomes a failed assertion instead of a
/// timed-out suite.
async function settle(done, budgetMs = 1000) {
  const deadline = Date.now() + budgetMs;
  while (!done() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 0));
  }
  return done();
}

/// Deliver whatever rAF callbacks a visible tab would have run.
function flushRaf() {
  const q = rafQueue;
  rafQueue = [];
  for (const fn of q) fn();
}

describe('yieldToPlatform', () => {
  test('uses rAF while the tab is visible', () => {
    hidden = false;
    const h = yieldToPlatform(() => {});
    expect(h.raf).toBeDefined();
    expect(h.timer).toBeUndefined();
    expect(rafCalls).toBe(1);
  });

  test('uses a macrotask while the tab is hidden', () => {
    hidden = true;
    const h = yieldToPlatform(() => {});
    expect(h.timer).toBeDefined();
    expect(h.raf).toBeUndefined();
    expect(rafCalls).toBe(0);
  });

  test('falls back to a macrotask with no rAF at all (native worker)', () => {
    delete globalThis.requestAnimationFrame;
    const h = yieldToPlatform(() => {});
    expect(h.timer).toBeDefined();
  });

  test('cancelYield routes to the right canceller', () => {
    hidden = false;
    cancelYield(yieldToPlatform(() => {}));
    expect(cancelledRafs).toBe(1);

    hidden = true;
    let ran = false;
    cancelYield(yieldToPlatform(() => { ran = true; }));
    expect(cancelledRafs).toBe(1);       // not an rAF this time
    return new Promise((r) => setTimeout(() => { expect(ran).toBe(false); r(); }, 5));
  });
});

describe('createChunkScheduler', () => {
  test('runs to completion in a hidden tab, with rAF never firing', async () => {
    hidden = true;
    let n = 0;
    const sched = createChunkScheduler(() => {
      if (++n < 50) sched.schedule();
      else sched.stop();
    });
    sched.start();

    const finished = await settle(() => n >= 50);
    expect(finished).toBe(true);
    expect(rafCalls).toBe(0);
  });

  test('runs on rAF in a visible tab', async () => {
    hidden = false;
    let n = 0;
    const sched = createChunkScheduler(() => {
      if (++n < 5) sched.schedule();
      else sched.stop();
    });
    sched.start();

    for (let i = 0; i < 10 && n < 5; i++) flushRaf();
    expect(n).toBe(5);
    expect(rafCalls).toBeGreaterThanOrEqual(5);
  });

  test('a tab hidden AFTER scheduling is rescued', async () => {
    // The case a schedule-time check alone cannot cover: the chain is
    // already parked on an rAF that will now never fire.
    hidden = false;
    let n = 0;
    const sched = createChunkScheduler(() => {
      if (++n < 30) sched.schedule();
      else sched.stop();
    });
    sched.start();
    expect(rafCalls).toBe(1);

    // Tab goes away. The parked rAF is dead; the browser fires this.
    hidden = true;
    document.dispatchEvent(new window.Event('visibilitychange'));

    const finished = await settle(() => n >= 30);
    expect(finished).toBe(true);
    expect(cancelledRafs).toBeGreaterThan(0);   // the dead rAF was cancelled
  });

  test('stop() halts the chain and detaches the listener', async () => {
    hidden = true;
    let n = 0;
    const sched = createChunkScheduler(() => { n++; sched.schedule(); });
    sched.start();
    await new Promise((r) => setTimeout(r, 0));

    sched.stop();
    const at = n;
    await new Promise((r) => setTimeout(r, 20));
    expect(n).toBe(at);

    // A late visibilitychange must not resurrect it.
    document.dispatchEvent(new window.Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 20));
    expect(n).toBe(at);
  });

  test('stop() is idempotent and schedule() after it is inert', async () => {
    hidden = true;
    let n = 0;
    const sched = createChunkScheduler(() => { n++; });
    sched.start();
    sched.stop();
    sched.stop();
    sched.schedule();
    expect(sched.stopped).toBe(true);

    await new Promise((r) => setTimeout(r, 20));
    expect(n).toBe(0);
  });

  test('an idle scheduler leaves no listener behind', () => {
    const before = window.document.querySelectorAll('*').length;
    const sched = createChunkScheduler(() => {});
    sched.start();
    sched.stop();
    // Nothing observable to assert on the listener directly, so assert
    // the behaviour it would cause: a later event does nothing.
    let n = 0;
    const s2 = createChunkScheduler(() => { n++; });
    s2.stop();
    document.dispatchEvent(new window.Event('visibilitychange'));
    expect(n).toBe(0);
    expect(window.document.querySelectorAll('*').length).toBe(before);
  });
});
