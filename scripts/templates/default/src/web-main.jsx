// Web entry — mounts <App /> into a DOM root. The native bridge isn't
// available on web; renderer-web.js targets the DOM instead.

import { render } from '~renderer';
import App from './App.jsx';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app element missing from document');
}
render(() => <App />, root);
