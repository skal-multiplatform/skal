// Skal — JS-side lazy loader for the B.5 hidden Flutter Web plugin
// host (Phase 2 of WEB_SUPPORT_PLAN.md).
//
// On native, Skal apps reach platform plugins (camera, geolocator,
// biometric, file picker, …) through the eventual native plugin
// bridge. On web, the same `@skal/<plugin>` shims route through here
// instead, lazy-loading a hidden Flutter Web instance the first time
// any plugin is invoked. The Flutter side (see
// `examples/<app>/flutter-web-plugins/lib/main.dart`) runs the
// unmodified pub.dev plugin Dart code, so Skal apps get every
// federated plugin's web implementation for free — at the cost of one
// ~3 MB lazy chunk per app (only paid by apps that actually call a
// plugin).
//
// Usage from a `@skal/<plugin>` shim:
//
//   import { callPlugin } from 'skal/plugin-bridge-web';
//   export async function useGeolocation() {
//     return callPlugin('geolocator.getCurrentPosition', {});
//   }
//
// First call triggers the boot (~1–2 s in cold-cache). Subsequent
// calls are ~ms. Apps that know they'll need plugins can call
// `prewarmPlugins()` during idle (after first paint, on visibilitychange,
// requestIdleCallback) to hide the first-click latency.
//
// The Flutter side exposes `globalThis.__skalPluginCall(name, jsonArgs)`
// (a Promise<JSON-string>) and sets `globalThis.__skalPluginHostReady = true`
// + dispatches a `skal-plugin-host-ready` window event when boot
// completes. We check the flag first and only attach the listener as
// a fallback to dodge the "fired before listener attached" race.

// Where the Flutter Web bootstrap script is served. In the kitchen-sink
// setup the vite middleware (Phase 3) maps `/flutter-web-plugins/*` to
// the built bundle under `examples/<app>/flutter-web-plugins/build/web/`.
// Apps with a different layout can override via setPluginHostBase().
let _hostBase = '/flutter-web-plugins';

/** Override the default `/flutter-web-plugins` path (e.g. for apps with
 *  a custom static layout). Call once, before any plugin invocation.
 *  Trailing slash is stripped. */
export function setPluginHostBase(base) {
  _hostBase = String(base).replace(/\/$/, '');
}

let _bootPromise = null;

/**
 * Lazy-boot the hidden Flutter Web plugin host. Idempotent: multiple
 * concurrent callers share one Promise; the script + DOM mount are
 * created at most once per page.
 *
 * Resolves once Flutter Web has booted AND the Dart side has registered
 * `__skalPluginCall` on globalThis. Rejects if the bootstrap script
 * fails to load (e.g. /flutter-web-plugins/flutter_bootstrap.js is
 * 404 — typically means Phase 3 build-pipeline wiring is missing).
 */
export async function ensurePluginHost() {
  if (_bootPromise) return _bootPromise;
  // Already booted by a prior page (rare — would mean the script was
  // included statically). Still no-op return so callPlugin can fire.
  if (globalThis.__skalPluginCall) {
    _bootPromise = Promise.resolve();
    return _bootPromise;
  }
  _bootPromise = _bootHost();
  return _bootPromise;
}

async function _bootHost() {
  if (typeof document === 'undefined') {
    throw new Error(
      'Skal plugin bridge: ensurePluginHost called with no DOM ' +
        '(SSR? worker?). The hidden Flutter Web host needs a real DOM ' +
        'to mount into.',
    );
  }

  // 1. Mount an invisible 1×1 container. Flutter Web needs a real DOM
  //    node to mount into, but visibility doesn't matter. Off-screen
  //    + opacity:0 + pointer-events:none + ARIA-hidden so it doesn't
  //    leak into accessibility trees or steal events.
  //
  //    We also expose the mount via `globalThis.__skalPluginHostMount`
  //    so the patched flutter_bootstrap.js (see vite.config.web.js
  //    `patchBootstrap`) can pass it to Flutter's `initializeEngine`
  //    as `hostElement` — otherwise Flutter Web mounts directly under
  //    document.body and expands to fill the visible viewport.
  const mount = document.createElement('div');
  mount.id = 'skal-plugin-host';
  mount.setAttribute('aria-hidden', 'true');
  mount.style.cssText =
    'position:fixed;width:1px;height:1px;opacity:0;left:-9999px;top:-9999px;' +
    'pointer-events:none;contain:strict;overflow:hidden';
  document.body.appendChild(mount);
  globalThis.__skalPluginHostMount = mount;

  // 2. Register the readiness listener BEFORE injecting the script —
  //    otherwise Flutter could boot fast enough to fire the event
  //    before we attach. We resolve on the event OR on flag presence
  //    (whichever wins; flag is the belt-and-braces sync signal).
  const ready = new Promise((resolve) => {
    if (globalThis.__skalPluginCall) return resolve();
    const onReady = () => {
      window.removeEventListener('skal-plugin-host-ready', onReady);
      resolve();
    };
    window.addEventListener('skal-plugin-host-ready', onReady, { once: true });
  });

  // 3. Inject Flutter Web's bootstrap script. Flutter's
  //    flutter_bootstrap.js loads canvaskit + main.dart.js as a side
  //    effect; once that's done, Dart's `main()` registers the
  //    `__skalPluginCall` hook and dispatches the ready event.
  const script = document.createElement('script');
  script.src = `${_hostBase}/flutter_bootstrap.js`;
  script.async = true;
  const loadFailed = new Promise((_, reject) => {
    script.onerror = () =>
      reject(
        new Error(
          `Skal plugin bridge: failed to load ${script.src}. ` +
            `Did you build the plugin host (\`bun run build:flutter-plugins\`) ` +
            `and is the vite middleware (Phase 3) serving ${_hostBase}/*?`,
        ),
      );
  });
  document.head.appendChild(script);

  // 4. Whoever loses first wins — either the script errors out (reject)
  //    or the Dart side signals readiness (resolve).
  await Promise.race([ready, loadFailed]);

  // Defensive: confirm the hook is actually installed. If the Flutter
  // side dispatched the event but didn't set the function, something
  // is wrong with main.dart — fail loudly so it's not silently broken.
  if (typeof globalThis.__skalPluginCall !== 'function') {
    throw new Error(
      'Skal plugin bridge: host signaled ready but __skalPluginCall is ' +
        `not a function (got ${typeof globalThis.__skalPluginCall}).`,
    );
  }
}

/**
 * Opt-in: boot the plugin host eagerly (e.g. during requestIdleCallback
 * after first paint) so the first user-triggered plugin call doesn't
 * pay the boot cost. Same Promise as ensurePluginHost — safe to call
 * multiple times.
 */
export function prewarmPlugins() {
  return ensurePluginHost();
}

// Flutter Web 3.41 multi-view has a sizing race when addView() calls
// land in quick succession: the per-view canvas's dimensions can be
// silently inherited from a sibling view (we observed two embeds of
// 354×180 + 354×60 → BOTH canvases ended up 354×60, so the bigger
// embed painted only its top 60 px). Serializing addView so each call
// fully resolves before the next starts avoids the race.
let _addViewChain = Promise.resolve();

/**
 * Add a visible Flutter Web view at the given DOM element. The host
 * runs in multi-view mode (see vite.config.web.js patchBootstrap),
 * which lets each <FlutterEmbed> get its own independent Flutter view
 * sharing the single Flutter engine.
 *
 * The returned viewId is the handle the JS side passes to
 * `callPlugin('embed.setSpec', {viewId, widget, props})` to tell Dart
 * what to render in that view, and to `removeFlutterView(viewId)` on
 * unmount.
 */
export async function addFlutterView(hostElement) {
  await ensurePluginHost();
  const app = globalThis.__skalFlutterApp;
  if (!app || typeof app.addView !== 'function') {
    throw new Error(
      'Skal plugin bridge: addView not available. ' +
        'Multi-view requires Flutter Web 3.10+ with multiViewEnabled:true in the bootstrap config.',
    );
  }
  // Serialize: chain off the previous addView so each view's canvas
  // sizing settles before the next starts (see comment above).
  _addViewChain = _addViewChain
    .catch(() => {}) // don't let a previous failure poison subsequent calls
    .then(async () => {
      const viewId = await app.addView({ hostElement });
      // Give Flutter one extra microtask + a frame to size the new
      // view's rasterizer before the next addView contends for it.
      await new Promise((r) => requestAnimationFrame(r));
      return viewId;
    });
  return _addViewChain;
}

/** Remove a Flutter Web view previously added via addFlutterView. */
export async function removeFlutterView(viewId) {
  const app = globalThis.__skalFlutterApp;
  if (!app || typeof app.removeView !== 'function') return;
  await app.removeView(viewId);
}

/**
 * The dispatcher every plugin shim calls. Boots the host if needed,
 * forwards the call, unwraps the {ok, value | error} envelope.
 *
 * @param {string} name   Plugin route (e.g. 'geolocator.getCurrentPosition').
 * @param {object} [args] JSON-serializable arguments. Defaults to {}.
 * @returns {Promise<any>} Resolves to the plugin's return value, or
 *   rejects with an Error whose message is the Dart-side exception.
 */
export async function callPlugin(name, args) {
  await ensurePluginHost();
  const argsJson = JSON.stringify(args == null ? {} : args);
  const resultJson = await globalThis.__skalPluginCall(name, argsJson);
  let parsed;
  try {
    parsed = JSON.parse(resultJson);
  } catch (e) {
    throw new Error(
      `Skal plugin bridge: host returned non-JSON for "${name}": ${resultJson}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      `Skal plugin bridge: host returned non-envelope for "${name}": ${resultJson}`,
    );
  }
  if (parsed.ok === true) return parsed.value;
  const err = new Error(parsed.error || `Skal plugin "${name}" failed`);
  if (parsed.stack) err.stack = parsed.stack;
  throw err;
}
