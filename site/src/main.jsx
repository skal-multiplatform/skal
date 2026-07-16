// skal-site entry — an MPA, not a SPA: every route is its own
// prerendered HTML page (scripts/prerender-web.js renders each with
// its location set), links are plain <a>, and this bundle re-renders
// just the current page on load. No client router by design.
import { render } from 'solid-js/web';
import { PAGES } from './pages/index.js';

const path = location.pathname.replace(/\/index\.html$/, '/');
const Page = PAGES[path] ?? PAGES['/'];
render(() => <Page />, document.getElementById('app'));
