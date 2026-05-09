// Entry point — mounts the Solid app into the pre-created root scroll
// column. After this runs, the app is alive: signals/effects drive bridge
// ops on every change, Compose drains them per-frame.

import { render, root } from './renderer.js';
import App from './App.jsx';

render(() => <App />, root);
