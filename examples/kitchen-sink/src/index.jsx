// Entry point — mounts the Solid app into the pre-created root box
// (see `skal/renderer` — root is a wt_box single-child passthrough so
// the host's Expanded drives layout without an intermediate scroller).
// After this runs, the app is alive: signals/effects drive bridge ops
// on every change, the host drains them per-frame.

import { render, root } from 'skal/renderer';
import App from './App.jsx';
import StressOverflow from './StressOverflow.jsx';

// Dev/stress route (web only): `?stress=<count>` swaps in a synchronous
// big-list mount that overflows the bridge's string heap, exercising the
// op-ring inline-drain overflow path (see StressOverflow.jsx). Guarded on
// `location` so native — which has no URL — always renders the real app.
let stressCount = 0;
if (typeof location !== 'undefined' && location.search) {
  const p = new URLSearchParams(location.search).get('stress');
  // Clamp: a few thousand rows overflows the heap several times; an
  // unbounded value (e.g. ?stress=2000000000) would OOM the tab in the
  // Array.from below before the bridge ever sees it.
  if (p) stressCount = Math.min(20000, Math.max(0, parseInt(p, 10) || 0));
}

if (stressCount > 0) {
  render(() => <StressOverflow count={stressCount} />, root);
} else {
  render(() => <App />, root);
}
