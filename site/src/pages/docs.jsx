// docs.jsx — one factory for all docs pages: extracted-content island
// inside the componentized chrome, with per-route head tags.
import { onMount } from 'solid-js';
import { DocsPage } from '../components/Chrome.jsx';
import { setHead } from '../head.js';
import { initSiteBehaviors } from '../behaviors.js';

import * as docsIndex from '../content/docs-index.js';
import * as architecture from '../content/architecture.js';
import * as components from '../content/components.js';
import * as state from '../content/state.js';
import * as native from '../content/native.js';
import * as tooling from '../content/tooling.js';
import * as testing from '../content/testing.js';

const CONTENT = {
  'docs-index': docsIndex, architecture, components, state, native, tooling, testing,
};

export function docsPage(key) {
  const mod = CONTENT[key];
  return function Docs() {
    setHead({ title: mod.title, description: mod.description });
    onMount(initSiteBehaviors);
    return <DocsPage active={key} content={mod.default} />;
  };
}
