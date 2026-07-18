// Chrome.jsx — the site's shared shell: top nav, docs sidebar, footers.
// Real Solid components (the article bodies start as extracted HTML
// islands — see src/content/).

export function TopNav(props) {
  const home = props.docs ? '../' : './';
  return (
    <nav class="top">
      <div class="wrap">
        <a class="logo" href={home}>
          <img class="mark" src="/assets/skal-logo.png" alt="Skal"
               style="height:1.5em;width:auto;vertical-align:-.35em;border-radius:5px;margin-right:.05em" />
          skal<span class="dot">.</span>
        </a>
        <span class="pill">{props.docs ? 'docs' : 'v0.1.0'}</span>
        <div class="links">
          {props.docs ? (
            <>
              <a href="./" style="color: var(--text)">Docs</a>
              <a href="../#performance">Performance</a>
            </>
          ) : (
            <>
              <a href="docs/">Docs</a>
              <a href="#components">Components</a>
              <a href="#performance">Performance</a>
              <a href="#compare">Compare</a>
            </>
          )}
          <a class="gh" href="https://github.com/skal-multiplatform/skal"><span class="star">★</span> GitHub</a>
        </div>
      </div>
    </nav>
  );
}

const SIDEBAR = [
  ['Start', [['Getting Started', './', 'docs-index']]],
  ['Concepts', [
    ['Architecture', 'architecture.html', 'architecture'],
    ['Components', 'components.html', 'components'],
    ['State & the Store', 'state.html', 'state'],
  ]],
  ['Native', [['Wrapping pub.dev packages', 'native.html', 'native']]],
  ['Workflow', [
    ['Hot reload & dev loop', 'tooling.html', 'tooling'],
    ['Testing', 'testing.html', 'testing'],
  ]],
];

export function Sidebar(props) {
  return (
    <aside class="side">
      {SIDEBAR.map(([group, items]) => (
        <>
          <div class="grp">{group}</div>
          {items.map(([label, href, key]) => (
            <a href={href} class={props.active === key ? 'on' : undefined}>{label}</a>
          ))}
        </>
      ))}
    </aside>
  );
}

export function DocsFooter() {
  return (
    <footer>
      <div class="wrap">
        <div>
          <span class="logo" style="font-size:16px">skal<span class="dot">.</span></span>
          <span style="margin-left:10px;">Skål. 🍻</span>
        </div>
        <div style="display:flex; gap:22px;">
          <a href="./">Docs</a>
          <a href="https://github.com/skal-multiplatform/skal">GitHub</a>
          <a href="https://github.com/skal-multiplatform/skal/blob/main/LICENSE">Apache-2.0</a>
        </div>
      </div>
    </footer>
  );
}

export function DocsPage(props) {
  // Every docs page has a markdown mirror at the same URL (built by
  // scripts/build-md.mjs) — the toolbar feeds it to AI agents.
  const md = (props.active === 'docs-index' ? 'index' : props.active) + '.md';
  return (
    <>
      <TopNav docs />
      <div class="wrap docs">
        <Sidebar active={props.active} />
        <div class="doc-col">
          <div class="md-toolbar">
            <div class="md-tools">
              <button class="mdt" data-copy-md={md}
                      title="Copy this page as Markdown — paste into any AI agent">
                <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                <span class="lbl">Copy for AI</span>
              </button>
              <a class="mdt raw" href={md} title="View this page as raw Markdown">.md</a>
            </div>
          </div>
          <article class="doc" innerHTML={props.content} />
        </div>
      </div>
      <DocsFooter />
    </>
  );
}
