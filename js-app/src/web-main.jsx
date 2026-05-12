// Web entry — mounts the Solid app into a DOM root element.
//
// The web counterpart to index.jsx (which mounts into the Skal bridge's
// pre-created root WT_SCROLL_COLUMN). On web there's no bridge; we just
// reuse the standard DOM <body><div id="app"></div> root.
//
// Same App.jsx, same Tweet component, same JSX. The `~renderer` alias
// is swapped at build time (see vite.config.web.js) to renderer-web.js,
// so the same JSX compiles into DOM operations here instead of bridge
// ops.

import { render } from '~renderer';
import App from './App.jsx';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Skal web: #app element missing from document');
}
render(() => <App />, root);
