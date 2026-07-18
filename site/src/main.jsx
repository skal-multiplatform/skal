// skal-site entry — an MPA, not a SPA: every route is its own
// prerendered HTML page (scripts/prerender-web.js renders each with
// its location set), links are plain <a>, and this bundle re-renders
// just the current page on load. No client router by design.
import { render } from 'solid-js/web';
import { PAGES } from './pages/index.js';

// Cloudflare Pages serves the docs at CLEAN urls (/docs/architecture)
// — it 308s the .html away — but PAGES is keyed by the prerendered
// filename (/docs/architecture.html). Without the `.html` fallback the
// client boots at the clean url, misses the map, and remounts every
// docs page as the landing page. (Locally, python's http.server serves
// the .html path verbatim, so the bug only shows on Cloudflare.)
const path = location.pathname.replace(/\/index\.html$/, '/');
const Page = PAGES[path] ?? PAGES[path + '.html'] ?? PAGES['/'];
render(() => <Page />, document.getElementById('app'));
