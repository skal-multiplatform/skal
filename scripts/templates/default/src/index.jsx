// Native entry — mounts <App /> into Skal's pre-created root box.

import { render, root } from 'skal/renderer';
import App from './App.jsx';

render(() => <App />, root);
