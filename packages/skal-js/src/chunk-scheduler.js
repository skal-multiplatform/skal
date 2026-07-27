// When to run the next chunk of an incremental mount.
//
// Extracted from `ChunkedFor` (skal-runtime.jsx) so it can be tested.
// Solid's JSX is a compile-time transform with no runtime shim, so
// anything living in a `.jsx` file cannot be imported by `bun test` —
// and this policy has now been wrong twice, which is a poor argument
// for leaving it untestable:
//
//   1. `queueMicrotask` — browsers drain the whole microtask queue
//      before they paint, so chaining through it mounted everything in
//      one uninterrupted stretch. The streaming was invisible, and the
//      adaptive chunk sizing was measuring an interval nothing else
//      could run in. On the native JS worker it starved timers and
//      input the same way. (Native still LOOKED fine, because the
//      Flutter host drains the op ring from its own frame ticker
//      reading shared memory — the rows appeared, the timers behind
//      them did not.)
//
//   2. plain `requestAnimationFrame` — correct cadence while visible,
//      but browsers do not fire rAF at all for a background tab. A user
//      switching away mid-stream stopped it dead, and anything gated on
//      reaching the total waited forever.
//
// So: rAF while visible, a macrotask while hidden, and a
// `visibilitychange` listener to rescue a chain already parked on an
// rAF when the tab goes away AFTER it was scheduled — the case a
// schedule-time check alone cannot cover.

const isHidden = () =>
  typeof document !== 'undefined' && document.hidden === true;

/// Schedule `fn` for the next turn. Returns a handle for [cancelYield].
/// One `document.hidden` read per CHUNK, not per item.
export function yieldToPlatform(fn) {
  if (typeof requestAnimationFrame === 'function' && !isHidden()) {
    return { raf: requestAnimationFrame(fn) };
  }
  return { timer: setTimeout(fn, 0) };
}

export function cancelYield(handle) {
  if (!handle) return;
  if (handle.raf !== undefined) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle.raf);
    }
  } else if (handle.timer !== undefined) {
    clearTimeout(handle.timer);
  }
}

/// Drive `step` across turns until [stop].
///
/// `step` is called with no arguments and decides for itself whether to
/// ask for another turn (by calling `schedule()` again) or to finish (by
/// calling `stop()`). The scheduler owns only *when*, never *how much*.
export function createChunkScheduler(step) {
  let pending = null;
  let stopped = false;
  let onVisible = null;

  function schedule() {
    if (stopped) return;
    pending = yieldToPlatform(step);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelYield(pending);
    pending = null;
    if (onVisible && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible);
      onVisible = null;
    }
  }

  function start() {
    if (typeof document !== 'undefined' && !onVisible) {
      // Armed only while a stream is in flight, so an idle app carries
      // no listener.
      onVisible = () => {
        if (stopped || !isHidden()) return;
        // Any rAF we are parked on will never fire now. Swap it for a
        // macrotask so the stream finishes in the background.
        cancelYield(pending);
        pending = null;
        schedule();
      };
      document.addEventListener('visibilitychange', onVisible);
    }
    schedule();
  }

  return {
    start,
    schedule,
    stop,
    /// True once [stop] has run — `step` checks this before doing work.
    get stopped() { return stopped; },
  };
}
