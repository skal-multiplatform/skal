// Entry point — mounts the Solid app into the pre-created root box
// (see `renderer.js` — root is a wt_box single-child passthrough so
// the host's Expanded drives layout without an intermediate scroller).
// After this runs, the app is alive: signals/effects drive bridge ops
// on every change, the host drains them per-frame.

import { render, root } from './renderer.js';
import App from './App.jsx';

render(() => <App />, root);
