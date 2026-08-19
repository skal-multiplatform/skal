// hot-state.js — reload-surviving signals.
//
// Lives in its OWN module with no Skal imports so both `skal` (index.js)
// and skal-runtime.jsx can re-export it. skal-runtime.jsx imports
// `Navigator`/`Screen` from 'skal', so re-exporting createHotState out of
// index.js directly would form an import cycle; this file has no such
// dependency (solid-js only) and breaks it.
import { createSignal } from 'solid-js';

let _hotStateSeq = 0;

// Back a [get, set] signal with the reload stash under `key`: restore the
// stashed value on (re)mount and mirror every set back into it. Falls back to
// a plain createSignal when the coordinator is absent (web/release). Shared by
// createHotState and createRouter so the stash protocol lives in one place.
export function hotSignal(key, initial) {
  const stash = globalThis.__skalHot && globalThis.__skalHot.stash;
  if (!stash) return createSignal(initial);
  const [get, _set] = createSignal(stash.has(key) ? stash.get(key) : initial);
  return [get, (v) => { const r = _set(v); stash.set(key, get()); return r; }];
}

/**
 * createHotState(initial, key?) — a [get, set] tuple like `createSignal`,
 * except its value survives a JS hot reload (native dev). Use it for the small
 * bits of navigation state you don't want to lose on every edit — e.g. a tab:
 *
 *   const [tab, setTab] = createHotState(0);             // call-order keyed
 *   const [tab, setTab] = createHotState(0, 'appTab');   // explicit key
 *
 * Pass an explicit `key` (any string) for state created in a conditional/lazy
 * spot: without it, the value is keyed by CALL ORDER, so adding another
 * `createHotState` above this one would shift the index and restore the wrong
 * value on the next reload. Store only primitives / plain data — like any Solid
 * signal, a function value is treated as an updater (wrap it: `setX(() => fn)`).
 *
 * On web/release it's exactly `createSignal`. The reload only resets state that
 * uses a plain `createSignal`.
 */
export function createHotState(initial, key) {
  return hotSignal('hotstate:' + (key != null ? key : _hotStateSeq++), initial);
}
