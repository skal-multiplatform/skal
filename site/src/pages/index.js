// PAGES — pathname → page component. An MPA map, not a router: every
// route is prerendered to its own HTML file (see package.json
// "prerender"), and the client bundle re-renders just the page it's on.
import { Landing } from './Landing.jsx';
import { docsPage } from './docs.jsx';

export const PAGES = {
  '/': Landing,
  '/docs/': docsPage('docs-index'),
  '/docs/architecture.html': docsPage('architecture'),
  '/docs/components.html': docsPage('components'),
  '/docs/state.html': docsPage('state'),
  '/docs/native.html': docsPage('native'),
  '/docs/tooling.html': docsPage('tooling'),
  '/docs/testing.html': docsPage('testing'),
};
