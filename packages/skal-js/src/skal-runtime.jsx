// Skal runtime — Solid components and helpers built on top of the
// bridge. Apps import from here for primitives that are Skal-specific
// (i.e. not part of stock Solid).
//
// Status: reserved tooling. <ChunkedFor> exists but the demo
// (App.jsx) uses plain <For> because <listView>'s Flutter-side
// virtualization already bounds per-frame work to ~10 widgets and
// JS-side chunking becomes redundant. ChunkedFor remains useful for
// the cases listView can't help with: non-virtualized layouts,
// infinite-feed UX where users expect to see items stream in, or
// "the list is small enough that scrolling doesn't matter but the
// initial mount is expensive enough to want progressive feedback."
// Re-import in App.jsx when one of those shapes shows up.

import { createSignal, createMemo, createEffect, onCleanup, For } from 'solid-js';
import * as B from './bridge.js';
import { Navigator, Screen } from 'skal';

/**
 * Create a JSX-side handle for invoking imperative methods on a
 * codegen-generated host widget.
 *
 * Usage:
 *
 * ```jsx
 * const ticker = createSkalRef();
 *
 * <Ticker ref={ticker} intervalMs={500} />
 * <Button onClick={() => ticker.pause()} label="Pause" />
 * <Button onClick={async () => {
 *   const v = await ticker.getValue();
 *   alert(`Tick count: ${v}`);
 * }} label="Read" />
 * ```
 *
 * Mechanics:
 *
 *  • `createSkalRef()` returns a Proxy. Any property access produces
 *    a function that, when called, emits an `OP_INVOKE_METHOD` (with
 *    one `OP_METHOD_ARG` per positional arg) and returns a `Promise`.
 *
 *  • The matching JSX element MUST be a codegen-generated host widget
 *    (declared via `hosts:` in `skal_codegen.yaml`). Other widgets
 *    don't have a method dispatcher registered on the Dart side; the
 *    Promise will reject with `status 2` (no dispatcher registered).
 *
 *  • The Promise resolves with the Dart method's return value, decoded
 *    by the bridge's argType discriminator: int, double, bool, String,
 *    void, and **any `jsonEncode`-able object** (Map, List, or a class
 *    with `toJson()` — `XFile` and friends). Objects arrive on the JS
 *    side already parsed. See `_writeMethodReply` in
 *    `skal_flutter/lib/skal/bridge.dart`.
 *
 *  • If the ref's node hasn't mounted yet when you call a method, the
 *    Promise rejects (status 2). Either await the next tick after
 *    mounting, or wire your call into a JSX event handler (those run
 *    after mount by construction).
 *
 *  • Arg encoding: integers → I32, fractional numbers → F32, booleans
 *    → BOOL, strings → STR via the JS string heap (bounded by heap
 *    capacity, ~768 KiB — not by the wire encoding). Objects and arrays
 *    → JSON via the same heap; the Dart side hands your dispatcher the
 *    decoded `Map` / `List`. `null` and unsupported types → VOID, which
 *    Dart reads as `null` in that arg slot.
 *
 * Returns: a Proxy you assign to `ref=` on a host widget.
 */
export function createSkalRef() {
  let nodeId = 0;
  // The target MUST be callable so that `ref={ticker}` in JSX (which
  // Solid's babel preset compiles to `use(ticker, element)`) can
  // invoke the proxy as a function. Without a callable target, the
  // Proxy isn't callable regardless of traps and Solid's use-call
  // throws "f is not a function".
  //
  // The function-target itself does nothing — the actual binding
  // happens in the `apply` trap below.
  const target = function () {};
  target.__skalBind = (id) => { nodeId = id; };
  return new Proxy(target, {
    // Called as `ref(element)` — Solid's universal renderer passes
    // the rendered SkalNode here. Read the bridge node id off it.
    apply(_, _this, args) {
      const el = args[0];
      if (el && typeof el.id === 'number') {
        nodeId = el.id;
      }
    },
    get(_, prop) {
      // Symbol props (Proxy iteration, util.inspect, …) and the
      // __skalBind escape-hatch return the target's own values.
      if (prop === '__skalBind' || typeof prop === 'symbol') {
        return target[prop];
      }
      // String prop access. Two conventions:
      //
      //   `ref.foo$(cb)` — STREAM subscription. JSX writes `$` to
      //     mark a method that returns a Dart-side Stream<T>.
      //     Returns an unsubscribe function. Last arg = onValue
      //     callback. Optional 2nd-to-last arg can be a {onError,
      //     onDone} options object.
      //
      //   `ref.foo(...)`  — one-shot RPC. Returns a Promise.
      //
      // The `$` is a JSX-side disambiguator; the Dart-side method
      // name strips it before dispatch. Codegen doesn't need to know
      // which methods are streams — it walks every method and emits a
      // dispatcher arm that returns whatever the controller's method
      // returns. The bridge picks the right path based on the op
      // (subscribe vs invoke) + the result type (Stream vs Future vs
      // value).
      if (typeof prop === 'string' && prop.endsWith('$') && prop.length > 1) {
        const methodName = prop.slice(0, -1);
        return (...args) => {
          if (nodeId === 0) {
            // Subscribe-time bind miss — eagerly throw so the dev
            // sees the issue at the call site, not silently dropped.
            throw new Error(
              `skal ref: cannot call .${String(prop)}() before the host `
              + `mounts. Move the call into a JSX event handler.`);
          }
          const h = _streamHandlers(args, `ref .${String(prop)}()`);
          return B.subscribeStream(
            nodeId, methodName, h.args, h.onValue, h.opts);
        };
      }
      // One-shot RPC.
      return (...args) => {
        if (nodeId === 0) {
          // Ref not yet bound — would dispatch to nodeId=0 (the root
          // host's reserved id) and almost certainly error out. Reject
          // upfront with a clearer message.
          return Promise.reject(new Error(
            `skal ref: cannot call .${String(prop)}() before the host `
            + `mounts. Move the call into a JSX event handler.`));
        }
        return B.invokeMethod(nodeId, prop, args);
      };
    },
  });
}

/**
 * Handle for a **nodeless** native service — geolocation, clipboard,
 * share sheet, biometrics, secure storage, permissions. Anything with
 * no widget to mount.
 *
 * ```jsx
 * const clip = createSkalService('clipboard');
 * await clip.write('hello');
 * const text = await clip.read();
 *
 * const geo = createSkalService('geolocator');
 * const pos  = await geo.getCurrentPosition();      // JSON object back
 * const stop = geo.positionStream$(p => setPos(p)); // Stream<Position>
 * onCleanup(stop);
 * ```
 *
 * Mechanics — identical to {@link createSkalRef}, with two differences:
 *
 *  • It targets the ROOT node rather than a mounted host, so there is
 *    no bind step and no "called before mount" failure mode. The root
 *    node exists from `ensureRoot()` onward, i.e. before any JS runs.
 *
 *  • Method names are namespaced on the wire — `clip.read()` dispatches
 *    `'clipboard.read'`. The Dart side routes on the namespace via
 *    `registerService` (`skal_flutter/lib/skal/services.dart`). The
 *    wire format is unchanged; this is a naming convention layered over
 *    the same ops that already back the dialog API.
 *
 * The `$` suffix means the same thing here as on a ref: subscribe to a
 * Dart `Stream<T>`, last argument is the callback, returns an
 * unsubscribe function.
 *
 * Rate classes apply (docs/PERFORMANCE.md): a one-shot RPC costs one
 * frame regardless of payload, so batch calls issued together and
 * prefer streams for anything recurring.
 *
 * @param {string} name  The registered service namespace, e.g. 'geolocator'.
 * @returns {any} A Proxy whose every property is a callable RPC.
 */
export function createSkalService(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError(
      `createSkalService: name must be a non-empty string (got ${typeof name})`);
  }
  if (name.includes('.')) {
    throw new TypeError(
      `createSkalService('${name}'): the name must not contain "." — `
      + `the dot separates service from method on the wire.`);
  }
  return new Proxy(Object.create(null), {
    get(_, prop) {
      // Symbols (util.inspect, Proxy iteration) and `then` must NOT
      // become RPC calls. `then` especially: returning a function for
      // it makes the proxy look thenable, so `await someService` would
      // hang forever on a Promise that never settles.
      if (typeof prop === 'symbol' || prop === 'then') return undefined;

      const isStream = prop.endsWith('$') && prop.length > 1;
      const method = isStream ? prop.slice(0, -1) : prop;
      const qualified = `${name}.${method}`;

      // Web first — see S1 in docs/NATIVE_SUPPORT.md. A browser API
      // called straight from JS beats a hop into the Flutter-web
      // runtime, which pays a copy on its "shared" buffer. So in ANY
      // browser context (DOM target or Flutter Web), a registered web
      // impl wins over the bridge.
      const webImpl = IS_BROWSER ? _webServices.get(name) : undefined;
      if (webImpl) {
        return (...args) => _callWebService(
          webImpl, qualified, name, method, isStream, args);
      }

      if (!B.HAS_NATIVE_BRIDGE) {
        // DOM target, no web impl: fail with the fix, not a hang.
        return () => {
          const err = new Error(
            `skal service: "${qualified}" is not available on this target. `
            + `No native bridge, and no web implementation registered for `
            + `"${name}". Call registerWebService('${name}', …) in your `
            + `web entry, or guard the call with a platform check.`);
          if (isStream) throw err;
          return Promise.reject(err);
        };
      }

      if (isStream) {
        return (...args) => {
          const h = _streamHandlers(args, `service ${name}.${prop}()`);
          return B.subscribeStream(
            B.ROOT_NODE_ID, qualified, h.args, h.onValue, h.opts);
        };
      }
      return (...args) => B.invokeMethod(B.ROOT_NODE_ID, qualified, args);
    },
  });
}

// Parse the trailing subscription handlers off a `$`-method's arg list.
//
// Two accepted shapes, because a stream that can only report values —
// never errors or completion — pushes every consumer into inventing
// their own sentinel:
//
//   svc.foo$(a, b, (v) => …)
//   svc.foo$(a, b, { onValue, onError?, onDone? })
//
// Everything before the handler is forwarded to Dart as positional
// args. `label` only shapes the error message.
function _streamHandlers(args, label) {
  const last = args[args.length - 1];
  if (typeof last === 'function') {
    return { args: args.slice(0, -1), onValue: last, opts: undefined };
  }
  if (last && typeof last === 'object' && typeof last.onValue === 'function') {
    return {
      args: args.slice(0, -1),
      onValue: last.onValue,
      opts: { onError: last.onError, onDone: last.onDone },
    };
  }
  throw new TypeError(
    `skal ${label} requires a callback — or an { onValue, onError?, onDone? } `
    + `object — as its last argument (got ${last === null ? 'null' : typeof last})`);
}

// From the bridge — the shared three-valued platform picture (see
// bridge.js). Local `typeof window` re-derivations drift.
const IS_BROWSER = B.IS_BROWSER;

/** name → method-bag. See {@link registerWebService}. */
const _webServices = new Map();

/**
 * Provide a JS implementation of a service for browser targets.
 *
 * Rationale (S1): on web, the capability usually *is* a browser API —
 * `navigator.geolocation`, `navigator.clipboard`, `navigator.share`.
 * Calling it from JS is strictly faster than routing through the Dart
 * web runtime, which copies across its emulated shared buffer. So a web
 * impl, when present, wins in any browser context.
 *
 * `impl` is either a method bag or a dispatcher:
 *
 * ```js
 * registerWebService('clipboard', {
 *   read:  () => navigator.clipboard.readText(),
 *   write: (t) => navigator.clipboard.writeText(t),
 * });
 * ```
 *
 * A STREAM method (`svc.foo$(…)`) receives its leading args plus a
 * final handlers object — `{ onValue, onDone, onError }`, all three
 * always callable — and returns an unsubscribe function. The impl owns
 * its own `watchPosition` / `removeEventListener` lifecycle and calls
 * `onDone`/`onError` so completion semantics match the native path:
 *
 * ```js
 * registerWebService('geolocator', {
 *   positionStream: (opts, h) => {
 *     const id = navigator.geolocation.watchPosition(
 *       (p) => h.onValue(p), (e) => h.onError(e));
 *     return () => navigator.geolocation.clearWatch(id);
 *   },
 * });
 * ```
 *
 * Method bags only — a `(method, args)` dispatcher form used to be
 * accepted, but it had no stream discriminator and an undocumented
 * handler convention nothing implemented; a dispatcher-shaped impl can
 * wrap itself in a Proxy in one line if it ever needs to.
 *
 * @param {string} name
 * @param {Record<string, Function>} impl
 */
export function registerWebService(name, impl) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('registerWebService: name must be a non-empty string');
  }
  if (!impl || typeof impl !== 'object' || Array.isArray(impl)) {
    throw new TypeError(
      `registerWebService('${name}'): impl must be an object of methods `
      + `({ read: () => … }); the (method, args) dispatcher form is no `
      + `longer accepted`);
  }
  _webServices.set(name, impl);
}

/** True when `name` has a web implementation registered. */
export function hasWebService(name) {
  return _webServices.has(name);
}

// Shared call path for both the one-shot and stream forms. Kept out of
// the Proxy body so the hot path there stays a single property lookup.
function _callWebService(impl, qualified, name, method, isStream, args) {
  const fn = impl[method];
  if (typeof fn !== 'function') {
    const err = new Error(
      `skal service: web implementation for "${name}" has no method `
      + `"${method}". Registered: ${Object.keys(impl).join(', ') || '(none)'}.`);
    if (isStream) throw err;
    return Promise.reject(err);
  }
  if (isStream) {
    // Stream contract for web impls: the LAST argument is a handlers
    // OBJECT — { onValue, onDone?, onError? } — and the return value
    // unsubscribes. An object rather than a bare callback, because a
    // stream that can only report values has no way to signal
    // completion or failure: the previous shape smuggled onDone/
    // onError as properties on a function that no impl knew to read,
    // so every drain-until-done consumer hung forever on web while
    // identical code worked on native.
    //
    // onDone/onError are always-present no-op defaults so an impl can
    // call them unconditionally. A missing unsubscribe return degrades
    // to a no-op rather than an undefined the caller will call.
    const h = _streamHandlers(args, `web service ${qualified}`);
    const handlers = {
      onValue: (v) => h.onValue(v),
      onDone: (h.opts && h.opts.onDone) || (() => {}),
      onError: (h.opts && h.opts.onError) || (() => {}),
    };
    const stop = fn(...h.args, handlers);
    return typeof stop === 'function' ? stop : () => {};
  }
  // Normalize to a Promise so callers can always await, whether the
  // web impl is sync (clipboard write via execCommand) or async.
  try {
    return Promise.resolve(fn(...args));
  } catch (e) {
    return Promise.reject(e);
  }
}

/**
 * <ChunkedFor each={items}>{(item) => <Tweet …/>}</ChunkedFor>
 *
 * Drop-in replacement for Solid's `<For>` that mounts items in
 * adaptively-sized chunks across multiple frames, yielding to the
 * event loop between chunks. The host (Flutter) gets to drain the
 * bridge ring and paint partial results, so a 5000-item list shows
 * "the list growing" instead of "click → freeze → everything appears."
 *
 * Adaptive sizing: each chunk's wall-clock time is measured, and the
 * next chunk's target size shrinks or grows toward `targetMs` (default
 * 6 ms — leaves ~half the 16 ms frame budget for the host's drain +
 * paint pass). After 2–3 chunks this self-tunes to whatever device is
 * running the app, regardless of how heavy each item is to mount.
 *
 * Cancellation: if `each` changes mid-stream (user clicks a different
 * count button), the previous stream stops immediately. Solid's
 * keyed-list diff still works because we only ever feed a prefix of
 * the new `each` array to the inner <For>.
 *
 * Props:
 *   each:        the source array (re-runs whenever it changes)
 *   children:    item renderer, same signature as Solid's <For>
 *   initial:     starting visible count (default 50 — feels instant)
 *   targetMs:    per-chunk wall-clock budget (default 6 ms)
 *   minChunk:    smallest chunk size (default 10)
 *   maxChunk:    largest chunk size (default 2000)
 *   onProgress:  optional (count, total) => void called after each chunk
 *
 * Returns: whatever <For> returns. Use exactly like <For>.
 */
export function ChunkedFor(props) {
  const [visible, setVisible] = createSignal(0);

  // Re-run whenever the source array identity changes — Solid memos
  // are identity-based on what we read inside, so this triggers on
  // every `each` reassignment by the parent component.
  createEffect(() => {
    const source = props.each;
    if (!source) { setVisible(0); return; }

    const total = source.length;
    const initial = Math.min(props.initial ?? 50, total);
    const targetMs = props.targetMs ?? 6;
    const minChunk = props.minChunk ?? 10;
    const maxChunk = props.maxChunk ?? 2000;

    // Preserve already-mounted items when `each` changes. Naive "reset
    // visible to initial" causes a dispose-and-remount of every shared
    // component (e.g. going 5000 → 2000 throws away the 2000 we
    // already have and re-mounts them, generating O(N) churn that can
    // even crash JSC's GC under high disposal volume). Instead:
    //
    //   - If new total < visible (source shrunk): clamp down, no churn.
    //   - If new total > visible (source grew):  resume streaming from
    //     wherever we already were, not from `initial`.
    //   - First-time mount: visible is 0, clamp up to `initial`.
    let chunkSize = initial;
    let cancelled = false;

    const startFrom = Math.min(Math.max(visible(), initial), total);
    if (startFrom !== visible()) setVisible(startFrom);

    function step() {
      if (cancelled) return;
      const current = visible();
      if (current >= total) return;

      const t0 = performance.now();
      const next = Math.min(current + chunkSize, total);
      try {
        setVisible(next);
      } catch (e) {
        // Microtasks aren't covered by the caller's try/catch; an
        // uncaught throw here would reach bun's error printer (which
        // has its own bugs at scale). Swallow + log so streaming
        // degrades gracefully instead of crashing the runtime.
        console.error('Skal: ChunkedFor step failed:', e?.message ?? e);
        cancelled = true;
        return;
      }
      const elapsed = performance.now() - t0;

      // Adaptive sizing — converge toward `targetMs` per chunk. The
      // 1.5× / ÷1.5 step damps oscillation while still adapting fast
      // (3–4 chunks to lock in on the right size).
      if (elapsed < targetMs * 0.5) {
        chunkSize = Math.min(((chunkSize * 3) >> 1) || chunkSize + 1, maxChunk);
      } else if (elapsed > targetMs) {
        chunkSize = Math.max((chunkSize * 2 / 3) | 0, minChunk);
      }

      props.onProgress?.(next, total);

      if (next < total) queueMicrotask(step);
    }

    if (initial < total) queueMicrotask(step);
    onCleanup(() => { cancelled = true; });
  });

  // Slice memo — only the prefix the streamer has revealed so far
  // reaches the inner <For>. Identity-based diffing inside <For>
  // means already-mounted items aren't remounted on each slice grow.
  const sliced = createMemo(() => (props.each ?? []).slice(0, visible()));

  return <For each={sliced()}>{props.children}</For>;
}

// ───────────────────────────────────────────────────────────────────────
// Hot-reload state preservation (native dev). The hot coordinator
// (globalThis.__skalHot, see hot.js) carries a key/value `stash` across reload
// generations, so "where am I" state survives a reload instead of snapping
// back to its initial value. Keys are assigned by CALL ORDER, which is stable
// across reloads because the bundle re-runs identically — so only use these
// for state created in a deterministic spot (a router, a top-level tab index),
// not inside loops/conditionals whose call order can shift. No-op on
// web/release, where __skalHot is absent (web restores nav via the URL hash).
// ───────────────────────────────────────────────────────────────────────

let _hotStateSeq = 0;
let _routerInstanceSeq = 0;

// Back a [get, set] signal with the reload stash under `key`: restore the
// stashed value on (re)mount and mirror every set back into it. Falls back to a
// plain createSignal when the coordinator is absent (web/release). Shared by
// createHotState and createRouter so the stash protocol lives in one place.
function hotSignal(key, initial) {
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

/**
 * createRouter — a screen-stack router over `<Navigator>` / `<Screen>`.
 *
 * The router owns the route stack (a signal). `routes` maps a route
 * name to either a screen component, or `{ component, title, transition }`
 * — `title` drives the screen's AppBar / nav-bar (NAVIGATION.md
 * Phase 2); `transition` ('fade' | 'none') overrides the push
 * animation (ANIMATION.md §10). Each screen is rendered with the
 * props `{ params, router }`.
 *
 * ```jsx
 * const router = createRouter({
 *   home:   (p) => <Home router={p.router} />,
 *   detail: { component: (p) => <Detail id={p.params.id} />, title: 'Detail' },
 * }, 'home');
 *
 * // in App:        <router.View />
 * // from a screen: props.router.navigate('detail', { id: 5 })
 * //                props.router.back()
 * ```
 *
 * Push / pop just add / remove a route entry — and because <For> keys
 * by the entry object's identity (which spread + slice preserve),
 * backgrounded screens stay mounted: keep-alive, instant back, no
 * re-mount. A back-gesture / system-back pop arrives via <Navigator>'s
 * `onPop`, which calls `router.back()`.
 *
 * `navigate(name, params, { presentation: 'modal', title, transition })`
 * pushes a bottom-up modal page and/or overrides the route's title +
 * transition.
 *
 * Web URL linking (NAVIGATION.md Phase 3): pass `{ linking: true }` as
 * the third arg. On the web target the launch URL's `#/route` hash
 * picks the initial route (deep-link entry) and the top route is
 * mirrored back into the hash (shareable / bookmarkable URLs). Inert
 * on the Flutter target — there is no `window`. Full browser
 * back/forward history integration is the remaining Phase 3 work.
 */
export function createRouter(routes, initial, options) {
  // A route table entry is either a component function or
  // `{ component, title }`. Normalize both reads through these.
  const compFor = (name) => {
    const r = routes[name];
    return typeof r === 'function' ? r : (r && r.component) || null;
  };
  const defaultTitleFor = (name) => {
    const r = routes[name];
    return r && typeof r === 'object' ? r.title : undefined;
  };
  const defaultTransitionFor = (name) => {
    const r = routes[name];
    return r && typeof r === 'object' ? r.transition : undefined;
  };
  // Route `transition` → the propTransition enum: 'fade' → 1,
  // 'none' → 2, 0 = the platform default push. A number passes
  // through; anything else resolves to the default.
  const transitionEnum = (t) =>
    t === 'fade' ? 1 : t === 'none' ? 2 : (typeof t === 'number' ? t : 0);

  const linking = !!(options && options.linking);
  const hasWindow = typeof window !== 'undefined';
  // `#/name` → `name`, when `name` is a known route. Null otherwise.
  const routeFromHash = () => {
    if (!hasWindow) return null;
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    const name = h.split('?')[0];
    return name && routes[name] ? name : null;
  };

  let firstName = typeof initial === 'string'
    ? initial
    : (initial && initial.name) || Object.keys(routes)[0];
  // Deep-link entry — a launch URL hash overrides the initial route.
  if (linking) {
    const fromUrl = routeFromHash();
    if (fromUrl) firstName = fromUrl;
  }
  // Restore the route stack the previous generation stashed before it was torn
  // down (hot reload), so a reload lands on the same screen instead of the
  // initial route. `options.key` (any string) gives a stable key for a router
  // created in a conditional/lazy spot; otherwise fall back to call order.
  const initialStack = [
    {
      name: firstName,
      params: {},
      title: defaultTitleFor(firstName),
      transition: defaultTransitionFor(firstName),
    },
  ];
  const routerKey = 'router:' +
      (options && options.key != null ? options.key : _routerInstanceSeq++);
  const [stack, setStack] = hotSignal(routerKey, initialStack);
  // If the route table changed (a stashed route no longer exists), start fresh.
  const restored = stack();
  const restoredValid = Array.isArray(restored) && restored.length > 0 &&
      restored.every((e) => e && routes[e.name]);
  if (!restoredValid) setStack(initialStack);

  const router = {
    stack,
    navigate(name, params, opts) {
      setStack([
        ...stack(),
        {
          name,
          params: params || {},
          presentation: opts && opts.presentation,
          title: (opts && opts.title) !== undefined
            ? opts.title
            : defaultTitleFor(name),
          transition: (opts && opts.transition) !== undefined
            ? opts.transition
            : defaultTransitionFor(name),
        },
      ]);
    },
    back() {
      const s = stack();
      if (s.length > 1) setStack(s.slice(0, -1));
    },
    replace(name, params, opts) {
      setStack([
        ...stack().slice(0, -1),
        {
          name,
          params: params || {},
          title: (opts && opts.title) !== undefined
            ? opts.title
            : defaultTitleFor(name),
          transition: (opts && opts.transition) !== undefined
            ? opts.transition
            : defaultTransitionFor(name),
        },
      ]);
    },
    reset(name, params) {
      setStack([
        {
          name,
          params: params || {},
          title: defaultTitleFor(name),
          transition: defaultTransitionFor(name),
        },
      ]);
    },
    canGoBack() {
      return stack().length > 1;
    },
  };

  // Mirror the top route into the URL hash so the address bar reflects
  // where the user is (shareable links). `replaceState` — the router
  // owns the stack, the URL just tracks it; we don't add browser
  // history entries (that integration is the remaining Phase 3 item).
  if (linking && hasWindow) {
    createEffect(() => {
      const s = stack();
      const top = s[s.length - 1];
      const want = '#/' + top.name;
      if (window.location.hash !== want) {
        window.history.replaceState({}, '', want);
      }
    });
  }

  router.View = () => (
    <Navigator onPop={() => router.back()}>
      <For each={stack()}>
        {(entry) => {
          const Comp = compFor(entry.name);
          return (
            <Screen
              presentation={entry.presentation === 'modal' ? 1 : 0}
              title={entry.title || ''}
              transition={transitionEnum(entry.transition)}
            >
              {Comp ? <Comp params={entry.params || {}} router={router} /> : null}
            </Screen>
          );
        }}
      </For>
    </Navigator>
  );

  return router;
}

/**
 * createStagger — per-index animation delays for a staggered reveal.
 *
 * Staggered animation is not a primitive — it is the `animate` prop's
 * `delay` applied per item (ANIMATION.md §9). `createStagger(step)`
 * returns a function mapping a list index to a delay in milliseconds.
 *
 * ```jsx
 * const stagger = createStagger(40);
 * <For each={items()}>
 *   {(item, i) => (
 *     <Box animate={{ duration: 300, delay: stagger(i()) }}
 *          opacity={shown() ? 1 : 0}>…</Box>
 *   )}
 * </For>
 * ```
 *
 * @param {number} [step] ms added per index (default 50)
 * @returns {(index: number) => number}
 */
export function createStagger(step = 50) {
  return (index) => (index | 0) * step;
}
