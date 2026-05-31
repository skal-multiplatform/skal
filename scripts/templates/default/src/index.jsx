// Native entry — mounts <App /> into Skal's pre-created root box.

import { render, root } from 'skal/renderer';
import App from './App.jsx';

const mount = () => <App />;
// Native dev: route the mount through the hot-reload coordinator (see hot.js)
// so a re-evaluated bundle re-mounts in place. On web / release-web __skalHot
// is absent and we fall back to a plain render().
if (globalThis.__skalHot) globalThis.__skalHot.mount(mount);
else render(mount, root);
