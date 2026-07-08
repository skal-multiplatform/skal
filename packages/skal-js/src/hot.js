// hot.js — JavaScript hot-reload coordinator (native dev only).
//
// Re-evaluating the app bundle inside the live VM re-runs every module's
// top-level code, so each "generation" of the bundle gets a fresh copy of all
// module state: new node-id / handler-id counters (bridge.js), a fresh
// renderer root, fresh diff caches. Two invariants must survive a reload:
//
//   1. Event dispatch. The native worker permanently caches the FIRST
//      `globalThis.__skal_drainEvents` it sees and calls that cached function
//      forever (patches/skal_entry.zig — `drain_fn` is protected once). A
//      re-evaluated bundle installs a NEW drain the worker would never call.
//      Fix: install a stable trampoline ONCE that forwards to the current
//      generation's drain (`currentDrain`); each bundle eval re-points it.
//
//   2. Mount lifecycle. Before the incoming generation mounts, the outgoing
//      one must be torn down (dispose its Solid owners so its effects stop,
//      and reset the host widget tree) — otherwise old effects keep firing and
//      the host tree leaks orphaned nodes.
//
// The reload is driven from Dart as a SINGLE `evaluate()` of:
//
//     globalThis.__skalHot.beginReload();\n<new bundle IIFE>
//
// `beginReload()` runs in the OUTGOING generation's module world: it uses that
// generation's `_dispose` / `_cfg.reset` (and therefore that generation's
// op-ring cursors) and publishes synchronously. Only AFTER that does the new
// bundle's bridge seed its cursors from the (now-advanced) header and mount.
// This is what keeps the two generations from writing the shared op-ring at
// the same cursor — the single biggest hazard of in-VM re-eval.
//
// This module has NO imports on purpose: it manages globals only, so it can
// survive across re-evals and never forms an import cycle with bridge.js /
// renderer.js (which both call installHotCoordinator()).

export function installHotCoordinator() {
  const existing = globalThis.__skalHot;
  if (existing) return existing;

  const hot = {
    // Live event-drain of the current generation. The trampoline forwards
    // here; each bundle eval re-registers its own drain via setDrain().
    currentDrain: null,
    setDrain(fn) { this.currentDrain = fn; },

    // Reload-scoped key/value stash — survives across reload generations (it
    // hangs off this persistent coordinator) but is NOT persisted to disk, so
    // it's fresh on a cold launch. Used to carry "where am I" state across a
    // reload: createRouter mirrors its route stack here, and createHotState
    // (skal-runtime) backs opt-in signals like a tab index, so a reload lands
    // you back on the screen/tab you were on instead of the initial route.
    stash: new Map(),

    // Per-generation primitives, replaced on every bundle eval:
    //   render(factory) -> disposeFn   (renderer.js: render into the root)
    //   reset()                        (bridge.js: emit OP_RESET_ROOT_SUBTREE
    //                                   then flush/publish synchronously)
    //   cleanup()                      (bridge.js: reject in-flight RPCs)
    // Merged, not replaced: bridge.js contributes `cleanup`, renderer.js
    // contributes `render`/`reset`. On a reload each incoming generation
    // overwrites the keys it owns, so after its eval `_cfg` is fully the new
    // generation's. (beginReload, which runs BEFORE the new bundle's
    // configure calls, still sees the outgoing generation's complete _cfg.)
    _cfg: null,
    configure(cfg) { this._cfg = Object.assign({}, this._cfg, cfg); },

    _mounted: false,
    _dispose: null,

    // Mount the app. First boot — and every post-beginReload remount — runs
    // with `_mounted === false` and simply renders; teardown is beginReload's
    // job (the Dart trigger always runs it first). If we're somehow asked to
    // mount over a live generation (a raw re-eval that skipped beginReload),
    // skip rather than double the tree — reloads are only supported through
    // the Dart trigger.
    mount(factory) {
      if (this._mounted) return;
      const cfg = this._cfg;
      this._dispose = cfg ? cfg.render(factory) : null;
      this._mounted = true;
    },

    // Tear down the OUTGOING generation. Invoked as the first statement of the
    // reload eval, while `_cfg`/`_dispose` still belong to that generation, so
    // every op it emits uses that generation's cursors. `_cfg.reset()`
    // publishes synchronously so the incoming bundle seeds past these writes.
    beginReload() {
      const cfg = this._cfg;
      // Dispose the previous generation's reactive root if there is one. After
      // a FAILED reload (the new bundle threw mid-mount) there is no _dispose,
      // but the host tree may still hold the partial nodes that attempt
      // created — so we do NOT early-return on `!_mounted`; the reset below
      // must still run to clear them, so the recovery re-mount lands clean.
      try { if (this._dispose) this._dispose(); } catch (_) { /* keep going */ }
      this._dispose = null;
      this._mounted = false;
      try { if (cfg && cfg.cleanup) cfg.cleanup(); } catch (_) { /* keep going */ }
      // Always reset the host tree (idempotent) — clears a fully-mounted prior
      // generation OR the orphan nodes left by a broken save's partial mount.
      try { if (cfg && cfg.reset) cfg.reset(); } catch (_) { /* keep going */ }
    },
  };

  // Drain trampoline — installed ONCE and never replaced, so the function the
  // native worker caches on its first wake stays valid across every reload.
  const trampoline = function () {
    const d = globalThis.__skalHot && globalThis.__skalHot.currentDrain;
    if (d) d();
  };
  trampoline.__skalTrampoline = true;
  globalThis.__skal_drainEvents = trampoline;

  globalThis.__skalHot = hot;
  return hot;
}
