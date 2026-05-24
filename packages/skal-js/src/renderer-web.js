// Solid universal-renderer adapter for Skal — DOM target.
//
// Parallel to renderer.js (which targets the native Flutter host).
// Same JSX tags (`<column>`, `<box>`, `<row>`, `<scrollView>`,
// `<listView>`, `<reorderableListView>`, `<text>`, `<button>`),
// same prop names (`background`, `padding`,
// `cornerRadius`, `opacity`, ...), but here we produce real DOM nodes
// and inline CSS instead of writing bridge ops.
//
// The whole point: `App.jsx` (and `Tweet`, and any future user code)
// compiles to the SAME JSX. Vite swaps the `~renderer` alias between
// renderer.js (native) and this file (web), so the same component
// tree drives either Flutter-on-native or DOM-in-browser.

import { createRenderer } from 'solid-js/universal';
import {
  addFlutterView,
  removeFlutterView,
  callPlugin,
} from './plugin-bridge-web.js';

// ──────────────────────────────────────────────────────────────────────
// Tag → HTML element + per-tag baseline styling.
//
// Defaults match the Flutter widget builders in root.dart so an
// un-styled <column> on web has the same shape as on native (fill
// width, 16dp padding, 8dp gap). Without these defaults you'd see
// every primitive collapse to a 0×0 container at first render.
// ──────────────────────────────────────────────────────────────────────

const TAG_TO_HTML = {
  column:               'div',
  scrollView:           'div',
  // Web has no virtualization story for arbitrary DOM children — a
  // <listView> / <reorderableListView> just degrades to a regular
  // scrollable div with all children eagerly mounted. The virtualization
  // is a host-side optimization (Flutter ListView.builder); on web the
  // browser's own scroll virtualization handles render culling at the
  // GPU layer. Reorder UX is also not wired up on web; the tag is
  // accepted for renderer parity so the SAME JSX runs both targets.
  listView:             'div',
  reorderableListView:  'div',
  row:                  'div',
  box:                  'div',
  text:                 'span',
  button:               'button',
  // <image> → <img>. `src` sets the element src; `contentScale`
  // maps to CSS object-fit.
  image:                'img',
  // <stack> → position:relative div; positioned children go absolute.
  stack:                'div',
  // Wave-2 controls. switch/checkbox → checkbox input; slider → range
  // input; activityIndicator → spinner div; progressBar → <progress>.
  switch:               'input',
  slider:               'input',
  checkbox:             'input',
  activityIndicator:    'div',
  progressBar:          'progress',
  // Wave-3. lazyGrid → CSS grid; wrap → flex-wrap; safeArea → env()
  // inset padding; richText → inline span of styled spans.
  lazyGrid:             'div',
  wrap:                 'div',
  safeArea:             'div',
  richText:             'span',
  // <textInput> → <input>.
  textInput:            'input',
  // <navigator>/<screen> — stacked divs; the last screen sits on top.
  navigator:            'div',
  screen:               'div',
  // <tabs>/<tab> — a flex column of stacked tab panes (the host shows
  // one at a time; on web all panes are present, CSS-degraded).
  tabs:                 'div',
  tab:                  'div',
  // Animation widgets — on web these degrade to plain divs (the
  // enter/exit + Hero motion is host-side; CSS parity is best-effort).
  animatedList:         'div',
  crossFade:            'div',
  hero:                 'div',
  // <listTile> — a flex row; <pageView> — a scroll-snap strip;
  // <dismissible> — a plain div (swipe-away is host-side; web shows
  // the child without the swipe gesture — best-effort).
  listTile:             'div',
  pageView:             'div',
  dismissible:          'div',
  // <flutterEmbed widget="counter" props={...} /> — Shape C of
  // WEB_SUPPORT_PLAN.md. A plain DOM div on web that's used as a
  // hostElement for a real Flutter Web view (multi-view). The bound
  // Dart widget renders inside; setProperty hooks below drive the
  // view lifecycle (addView on mount, embed.setSpec on prop change,
  // removeView on unmount). Inert on native — pure web primitive.
  flutterEmbed:         'div',
  // Slivers — <customScrollView> is a scroll container; sliver
  // sections are plain divs (a <sliverAppBar> uses position:sticky).
  customScrollView:     'div',
  sliverAppBar:         'div',
  sliverList:           'div',
  sliverGrid:           'div',
  // <canvas> — a real DOM <canvas> element (the draw program would
  // replay onto its 2-D context; native-fast-path is the product).
  canvas:               'canvas',
  // Drag-and-drop — plain divs on web (the drag session is host-side;
  // HTML5 DnD parity is best-effort, not wired here).
  dragItem:             'div',
  dropZone:             'div',
  // §2 controls — radio → an <input>, dropdown → a native <select>;
  // the rest degrade to divs on web.
  radio:                'input',
  chip:                 'div',
  segmentedButton:      'div',
  expansionTile:        'div',
  dropdown:             'select',
  stepper:              'div',
  step:                 'div',
  drawer:               'aside',
  bottomSheet:          'div',
  backdropFilter:       'div',
  interactiveViewer:    'div',
};

// Spinner keyframes for <activityIndicator> — injected once.
if (typeof document !== 'undefined' && !document.getElementById('skal-kf')) {
  const _st = document.createElement('style');
  _st.id = 'skal-kf';
  _st.textContent = '@keyframes skal-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(_st);
}

// ──────────────────────────────────────────────────────────────────────
// <tabs> / <tab> — best-effort web parity for the host's IndexedStack +
// NavigationBar combo. The native renderer pivots on `propActiveTab`
// to show exactly one tab + draws a host NavigationBar from each
// <tab>'s `title` / `icon`; on web we replicate both halves:
//
//   1. Active-tab selection: each <tab> sibling is hidden via
//      `display:none` except the active one.
//   2. The bar: a flex row pinned at the bottom of <tabs> with one
//      button per <tab>. Clicking fires the <tabs>'s `onChange(index)`
//      handler — same surface JS sees on native.
//
// We can't use a fast-path Flutter widget on web, so this is JS-side
// glue that runs on every relevant setProperty / insertNode call.
// ──────────────────────────────────────────────────────────────────────

// Icon-name → glyph map. Skal's icon prop is a host-side font lookup
// on native (Material icon names); on web we fall back to a small
// monochrome glyph table so the bar is at least recognizable. Add
// names here as new tabs surface them.
const TAB_ICON_GLYPHS = {
  grid: '▦',     // ▦
  list: '☰',     // ☰
  explore: '⦿',  // ⦿
  code: '⟨⟩', // ⟨⟩
  storage: '☰',  // ☰ (same as list — close enough as a fallback)
  home: '⌂',     // ⌂
  settings: '⚙', // ⚙
  search: '🔍', // 🔍
  user: '☻',     // ☻
  heart: '♡',    // ♡
  star: '★',     // ★
  plus: '+',     // +
};

const TAB_BAR_ACTIVE_COLOR = '#0A84FF';
const TAB_BAR_INACTIVE_COLOR = '#8E8E93';
const TAB_BAR_BG = '#F2F2F7';
const TAB_BAR_BORDER = '#E5E5EA';

function _tabsContentChildren(tabsEl) {
  // Bar sits as the last child of <tabs>; everything else with
  // _skalTag==='tab' is a content pane.
  const out = [];
  for (const c of tabsEl.children) {
    if (c._skalTag === 'tab') out.push(c);
  }
  return out;
}

function _ensureTabsBar(tabsEl) {
  let bar = tabsEl._skalBar;
  if (bar && bar.parentElement === tabsEl) return bar;
  bar = document.createElement('div');
  bar.setAttribute('role', 'tablist');
  bar.style.cssText =
    'display:flex;flex-direction:row;align-items:stretch;flex:0 0 auto;' +
    `border-top:1px solid ${TAB_BAR_BORDER};background:${TAB_BAR_BG};` +
    'padding:6px 4px;padding-bottom:calc(6px + env(safe-area-inset-bottom, 0px));' +
    'min-height:50px;gap:4px;user-select:none;box-sizing:border-box;';
  tabsEl.appendChild(bar);
  tabsEl._skalBar = bar;
  return bar;
}

// ──────────────────────────────────────────────────────────────────────
// <flutterEmbed> — visible Flutter Web rendering via multi-view.
//
// Lifecycle (driven by insertNode + setProperty + removeNode hooks):
//   1. insertNode → request a Flutter view bound to this DOM element.
//      `addFlutterView` lazy-boots the host if needed; returned viewId
//      is stashed on the element.
//   2. setProperty('widget' | 'props') → coalesce a microtask, then
//      send embed.setSpec(viewId, widget, props) to Dart so the right
//      widget renders. (Both props arrive separately as Solid sets
//      them; coalescing means one Dart-side rebuild per JSX change,
//      not two.)
//   3. removeNode → embed.unsetSpec + removeFlutterView.
//
// Async cost: addView is a Promise (Flutter has to wire up a new
// view), so the first render lags by a paint or two. Subsequent prop
// changes are just JSON-RPC over the plugin bridge (~ms).
// ──────────────────────────────────────────────────────────────────────

// Flutter Web reads the hostElement's size at addView time + binds the
// FlutterView's glass-pane to whatever it reads. If the embed div has
// 0 width/height at that instant (Solid inserts the node BEFORE CSS
// layout runs the first time), the glass-pane gets fixed at 0×0 and
// later CSS-driven resizes are NOT picked up — the view renders into
// nothing forever. So we wait for the first non-zero layout before
// calling addView.
function _waitForFirstLayout(el) {
  return new Promise((resolve) => {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      resolve();
      return;
    }
    if (typeof ResizeObserver === 'undefined') {
      // No ResizeObserver → fall back to a single rAF; if still 0, just
      // resolve and hope (the view will at least be created).
      requestAnimationFrame(() => resolve());
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        if (r.width > 0 && r.height > 0) {
          ro.disconnect();
          resolve();
          return;
        }
      }
    });
    ro.observe(el);
  });
}

async function _ensureFlutterView(embedEl) {
  if (embedEl._skalViewPromise) return embedEl._skalViewPromise;
  embedEl._skalViewPromise = (async () => {
    await _waitForFirstLayout(embedEl);
    // The embed might have been removed while we were waiting.
    if (embedEl._skalEmbedRemoved) {
      throw new Error('Skal <flutterEmbed>: removed before view could be added');
    }
    const viewId = await addFlutterView(embedEl);
    embedEl._skalViewId = viewId;
    // Wake Flutter's render pipeline. The flutter-view + flt-glass-pane
    // get created at addView time, but the scene-host inside (shadow
    // DOM) is sized via a ResizeObserver on the view that fires on
    // the FIRST size change after the view exists. With CSS-driven
    // sizing this can race and leave the scene-host at width:auto
    // height:auto → no pixels paint. Dispatching window.resize coaxes
    // Flutter to re-sync all view sizes, fixing the scene-host bounds.
    if (typeof window !== 'undefined') {
      // Defer one frame so the new view has its CSS applied.
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }
    return viewId;
  })();
  return embedEl._skalViewPromise;
}

function _scheduleEmbedSync(embedEl) {
  if (embedEl._skalSyncScheduled) return;
  embedEl._skalSyncScheduled = true;
  queueMicrotask(async () => {
    embedEl._skalSyncScheduled = false;
    const widget = embedEl._skalEmbedWidget;
    if (!widget) return; // widget prop not set yet — wait for it
    try {
      const viewId = await _ensureFlutterView(embedEl);
      // The embed may have been removed while addView was pending.
      // _skalEmbedRemoved is set by removeNode; if true, drop the sync.
      if (embedEl._skalEmbedRemoved) return;
      await callPlugin('embed.setSpec', {
        viewId,
        widget,
        props: embedEl._skalEmbedProps || {},
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Skal <flutterEmbed widget="${widget}"> failed:`, e);
    }
  });
}

async function _teardownFlutterEmbed(embedEl) {
  embedEl._skalEmbedRemoved = true;
  if (!embedEl._skalViewPromise) return;
  try {
    const viewId = await embedEl._skalViewPromise;
    // Tell Dart to drop the spec first (otherwise the next addView's
    // viewId might collide with a stale spec from this one).
    try { await callPlugin('embed.unsetSpec', { viewId }); } catch (_) {}
    await removeFlutterView(viewId);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Skal <flutterEmbed> teardown failed:', e);
  }
}

function _renderTabs(tabsEl) {
  const tabs = _tabsContentChildren(tabsEl);
  const requested = (tabsEl._skalActiveTab | 0);
  const active = tabs.length === 0
    ? 0
    : Math.min(Math.max(requested, 0), tabs.length - 1);

  // Make <tabs> a column flex so the bar pins at the bottom and the
  // active pane fills the rest. Override the applyDefaults('tabs')
  // baseline (which left height unspecified).
  tabsEl.style.flexDirection = 'column';
  tabsEl.style.height = '100%';
  tabsEl.style.minHeight = '0';
  tabsEl.style.overflow = 'hidden';

  // Show only the active pane; keep the others mounted for keep-alive
  // parity with the native IndexedStack.
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    if (i === active) {
      t.style.display = 'flex';
      t.style.flexDirection = 'column';
      t.style.flex = '1 1 auto';
      t.style.minHeight = '0';
      t.style.overflow = 'auto';
    } else {
      t.style.display = 'none';
    }
  }

  const bar = _ensureTabsBar(tabsEl);
  // Rebuild bar buttons. Tabs rarely change in count + their title /
  // icon are mount-once cold props, so the rebuild cost is paid at
  // most once per structural change. Switching the active tab only
  // needs to re-color buttons; full-rebuild keeps the code simple.
  bar.innerHTML = '';
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    const isActive = i === active;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.style.cssText =
      'flex:1 1 0;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;background:transparent;border:0;cursor:pointer;' +
      'font:inherit;padding:4px 2px;gap:2px;line-height:1.15;font-size:11px;' +
      'color:' + (isActive ? TAB_BAR_ACTIVE_COLOR : TAB_BAR_INACTIVE_COLOR) + ';';
    const iconName = t._skalIcon;
    if (iconName) {
      const ico = document.createElement('span');
      ico.textContent = TAB_ICON_GLYPHS[iconName] || '●'; // ●
      ico.style.cssText = 'font-size:20px;line-height:1;';
      btn.appendChild(ico);
    }
    const title = t._skalTitle;
    if (title) {
      const lbl = document.createElement('span');
      lbl.textContent = title;
      btn.appendChild(lbl);
    }
    // Capture the index — closure over `i` is fine since we rebuild
    // every render, so stale handlers never linger across structural
    // changes.
    btn.onclick = () => {
      const h = tabsEl._skalOnChange;
      if (typeof h === 'function') h(i);
    };
    bar.appendChild(btn);
  }
}

// Baseline inline styles applied at createElement time. Each prop set
// later via setProperty wins over these (last-style-wins in inline CSS).
//
// NOTE: `align-items: flex-start` on the flex columns matches the native
// behavior where children of a Column are NOT auto-stretched to the
// cross-axis (width). Each child uses its natural / wrap-content width
// unless the dev applies fillMaxWidth (width="fill"). Without this,
// every Button child of a Column would stretch to 100% width — looks
// totally different from native.
function applyDefaults(el, tag) {
  const s = el.style;
  switch (tag) {
    case 'column':
      s.display = 'flex';
      s.flexDirection = 'column';
      s.alignItems = 'flex-start';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.padding = '16px';
      s.gap = '8px';
      break;
    case 'scrollView':
    case 'listView':
    case 'reorderableListView':
      // All three render as scrollable flex-column div on web. Native
      // host distinguishes them for virtualization + reorder UX; the
      // browser handles render culling itself, so on web they're the
      // same shape.
      s.display = 'flex';
      s.flexDirection = 'column';
      s.alignItems = 'flex-start';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.height = '100%';
      s.overflowY = 'auto';
      s.padding = '16px';
      s.gap = '8px';
      // Scroll-on-iOS-mobile-Safari fluidity. Harmless elsewhere.
      s.webkitOverflowScrolling = 'touch';
      break;
    case 'row':
      s.display = 'flex';
      s.flexDirection = 'row';
      s.boxSizing = 'border-box';
      // Native default has horizontalScroll — emulate it, but hide
      // the scrollbar to match the native invisible-scrollbar behavior.
      // (native horizontal-scroll exposes the gesture but doesn't
      // paint a track; Firefox / WebKit need separate rules.)
      s.overflowX = 'auto';
      s.scrollbarWidth = 'none';            // Firefox
      s.msOverflowStyle = 'none';           // legacy Edge
      // ::-webkit-scrollbar { display: none } can't be set inline — see
      // the global stylesheet rule we inject below in index.html.
      break;
    case 'listTile':
      // Structured Material row — leading / text / trailing in a flex
      // row. Web renders `title` as the text; subtitle / icons are a
      // native-fast-path nicety not mirrored here (best-effort).
      s.display = 'flex';
      s.flexDirection = 'row';
      s.alignItems = 'center';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.minHeight = '56px';
      s.padding = '8px 16px';
      s.gap = '16px';
      break;
    case 'pageView':
      // Swipeable pages — a horizontal scroll-snap strip. Each child
      // page is sized to the full viewport by the child-insert path.
      s.display = 'flex';
      s.flexDirection = 'row';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.height = '100%';
      s.overflowX = 'auto';
      s.scrollSnapType = 'x mandatory';
      s.scrollbarWidth = 'none';
      s.msOverflowStyle = 'none';
      break;
    case 'customScrollView':
      s.display = 'flex';
      s.flexDirection = 'column';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.height = '100%';
      s.overflowY = 'auto';
      s.webkitOverflowScrolling = 'touch';
      break;
    case 'sliverAppBar':
      // Collapsing header → a sticky bar on web (best-effort: no
      // parallax-collapse, just stays pinned at the top on scroll).
      s.position = 'sticky';
      s.top = '0';
      s.zIndex = '1';
      s.boxSizing = 'border-box';
      s.width = '100%';
      break;
    case 'sliverList':
      s.display = 'flex';
      s.flexDirection = 'column';
      s.boxSizing = 'border-box';
      s.width = '100%';
      break;
    case 'sliverGrid':
      s.display = 'grid';
      s.boxSizing = 'border-box';
      s.width = '100%';
      break;
    case 'box':
      s.display = 'block';
      s.position = 'relative';
      s.boxSizing = 'border-box';
      break;
    case 'stack':
      // Containing block for absolutely-positioned children.
      s.display = 'block';
      s.position = 'relative';
      s.boxSizing = 'border-box';
      break;
    case 'switch':
    case 'checkbox':
      el.type = 'checkbox';
      break;
    case 'slider':
      el.type = 'range';
      el.min = '0';
      el.max = '1';
      el.step = 'any';
      s.width = '100%';
      break;
    case 'activityIndicator':
      s.width = '24px';
      s.height = '24px';
      s.boxSizing = 'border-box';
      s.border = '3px solid rgba(0,0,0,0.15)';
      s.borderTopColor = 'rgba(0,0,0,0.55)';
      s.borderRadius = '50%';
      s.animation = 'skal-spin 0.8s linear infinite';
      break;
    case 'progressBar':
      s.width = '100%';
      break;
    case 'text':
      // <span> by default — inherits inline flow. Monospace matches
      // native FontFamily.Monospace default for unstyled text.
      s.fontFamily = 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace';
      // Pre-line preserves user-provided newlines without collapsing
      // multiple spaces (closer to native Text behavior).
      s.whiteSpace = 'pre-line';
      break;
    case 'button':
      // Approximate Material3 Button default: pill, primary purple,
      // white text, 24×8 content padding, 14sp text. Custom bg/color
      // props win via setProperty.
      s.display = 'inline-flex';
      s.alignItems = 'center';
      s.justifyContent = 'center';
      s.padding = '8px 24px';
      s.background = '#6750A4';  // M3 primary
      s.color = '#FFFFFF';        // M3 onPrimary
      s.border = 'none';
      s.borderRadius = '20px';
      s.fontSize = '14px';
      s.fontWeight = '500';
      s.cursor = 'pointer';
      s.fontFamily = 'inherit';
      s.boxSizing = 'border-box';
      break;
    case 'image':
      // <img> is inline by default — make it a block leaf so width/
      // height props behave like the native Image. Default object-fit
      // matches the native BoxFit.contain default.
      s.display = 'block';
      s.objectFit = 'contain';
      break;
    case 'lazyGrid':
      s.display = 'grid';
      s.gridTemplateColumns = 'repeat(2, 1fr)';
      s.gap = '8px';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.padding = '16px';
      s.overflowY = 'auto';
      break;
    case 'wrap':
      s.display = 'flex';
      s.flexWrap = 'wrap';
      s.gap = '8px';
      s.boxSizing = 'border-box';
      break;
    case 'safeArea':
      s.display = 'block';
      s.boxSizing = 'border-box';
      s.paddingTop = 'env(safe-area-inset-top)';
      s.paddingBottom = 'env(safe-area-inset-bottom)';
      s.paddingLeft = 'env(safe-area-inset-left)';
      s.paddingRight = 'env(safe-area-inset-right)';
      break;
    case 'richText':
      s.fontFamily =
        'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif';
      s.whiteSpace = 'pre-line';
      break;
    case 'textInput':
      el.type = 'text';
      s.boxSizing = 'border-box';
      s.padding = '8px 12px';
      s.border = '1px solid rgba(0,0,0,0.4)';
      s.borderRadius = '4px';
      s.fontSize = '14px';
      s.fontFamily = 'inherit';
      break;
    case 'navigator':
      // Children are <screen> with `position:absolute;inset:0`, so the
      // navigator gets no intrinsic height from its content. Force it
      // to fill its flex-column parent (typical home: a <tab> pane or
      // the document body); without this the navigator collapses to 0
      // and screens render but are invisible.
      s.position = 'relative';
      s.overflow = 'hidden';
      s.boxSizing = 'border-box';
      s.width = '100%';
      s.height = '100%';
      s.flex = '1 1 auto';
      s.minHeight = '0';
      break;
    case 'screen':
      // Stacked absolutely — DOM order is stack order, so the last
      // <screen> covers the ones below it (keep-alive, no transition).
      s.position = 'absolute';
      s.inset = '0';
      s.overflow = 'auto';
      s.boxSizing = 'border-box';
      s.background = '#FFFFFF';
      break;
    case 'tabs':
      // Flex column — active-tab pane on top of a NavigationBar-style
      // bar at the bottom. _renderTabs() (called from setProperty +
      // insertNode hooks) (a) hides inactive <tab> children with
      // `display:none` so only the active one renders, and (b)
      // populates a bar with one button per <tab> that calls the
      // <tabs>'s `onChange(index)` — close-enough parity with the
      // native IndexedStack + NavigationBar.
      s.display = 'flex';
      s.flexDirection = 'column';
      s.boxSizing = 'border-box';
      s.height = '100%';
      s.minHeight = '0';
      s.overflow = 'hidden';
      break;
    case 'tab':
      s.display = 'block';
      s.boxSizing = 'border-box';
      break;
    case 'flutterEmbed':
      // Visible block. `alignSelf:stretch` makes the embed claim its
      // flex parent's cross-axis size — most Skal columns use
      // `align-items:flex-start`, so a `width:100%` child of zero-
      // width-shrink-fit parent would collapse to 0. align-self:stretch
      // sidesteps that by telling the flex parent "give me the full
      // cross-axis", which then propagates a definite width to the
      // Flutter view inside. Height is left unset on purpose so the
      // user's prop wins.
      s.display = 'block';
      s.boxSizing = 'border-box';
      s.position = 'relative';
      s.width = '100%';
      s.alignSelf = 'stretch';
      s.overflow = 'hidden';
      break;
  }
}

// contentScale wire enum → CSS object-fit. CSS has no fitWidth /
// fitHeight, so those degrade to `contain`.
const OBJECT_FITS = ['contain', 'cover', 'fill', 'contain', 'contain', 'none', 'scale-down'];

// ──────────────────────────────────────────────────────────────────────
// Color encoding — Skal sends ARGB-packed strings ("#AARRGGBB") and
// integers. CSS uses rgba() or #RRGGBBAA. We always emit rgba() — it
// round-trips cleanly through both forms and the alpha channel is
// explicit (no ambiguity between #RGB and #RGBA short forms).
// ──────────────────────────────────────────────────────────────────────

function parseColor(v) {
  if (v == null) return null;
  if (typeof v === 'number') {
    // ARGB int: high byte = alpha
    const a = (v >>> 24) & 0xFF;
    const r = (v >>> 16) & 0xFF;
    const g = (v >>> 8) & 0xFF;
    const b = v & 0xFF;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  }
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (s.startsWith('#')) s = s.slice(1);
  let r = 0, g = 0, b = 0, a = 255;
  if (s.length === 3) {
    r = parseInt(s[0] + s[0], 16);
    g = parseInt(s[1] + s[1], 16);
    b = parseInt(s[2] + s[2], 16);
  } else if (s.length === 6) {
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
  } else if (s.length === 8) {
    // AARRGGBB — alpha first to match Dart's Color(0xAARRGGBB) encoding.
    // Matches what renderer.js's parseColor produces on the native side.
    a = parseInt(s.slice(0, 2), 16);
    r = parseInt(s.slice(2, 4), 16);
    g = parseInt(s.slice(4, 6), 16);
    b = parseInt(s.slice(6, 8), 16);
  } else {
    // Already a CSS color name / function ("red", "rgba(...)", etc.) —
    // hand it back unchanged.
    return v;
  }
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

// ──────────────────────────────────────────────────────────────────────
// Dimension encoding — Skal accepts numbers (dp), or 'fill' / 'wrap'
// sentinels. Map to CSS lengths.
// ──────────────────────────────────────────────────────────────────────

function parseDim(v) {
  if (typeof v === 'number') return `${v}px`;
  if (v === 'fill') return '100%';
  if (v === 'wrap') return 'auto';
  if (typeof v === 'string') return v;  // pass through "50%", "10rem", etc.
  return null;
}

// ──────────────────────────────────────────────────────────────────────
// Font family enum — matches the native fontFamilyFor() mapping.
// ──────────────────────────────────────────────────────────────────────

const FONT_FAMILIES = {
  0: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif',
  1: '"Times New Roman", Times, serif',
  2: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
  3: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif',
};

// `animate.curve` name → wire enum, and wire enum → CSS easing.
// CSS has no bounce/elastic easing — those degrade to fastOutSlowIn.
const ANIM_CURVES_WEB = {
  linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3,
  bounce: 4, elastic: 5, fastOutSlowIn: 6,
};
const WEB_EASINGS = [
  'linear', 'ease-in', 'ease-out', 'ease-in-out',
  'cubic-bezier(.4,0,.2,1)', 'cubic-bezier(.4,0,.2,1)',
  'cubic-bezier(.4,0,.2,1)',
];

const TEXT_ALIGNS = ['start', 'center', 'end', 'justify'];
// Skal alignment enum (for arrangement/contentAlignment). Container-
// specific — we mostly use these via flexbox justify-content.
const ALIGN_TO_JUSTIFY = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];

// ──────────────────────────────────────────────────────────────────────
// Hot-prop transforms. Same six axes as the native graphicsLayer:
// opacity, translation X/Y, scale X/Y, rotation Z. The native side uses
// a GPU layer; the browser compositor does the equivalent for the
// `transform` and `opacity` CSS properties when the element is layer-
// promoted (the will-change hint forces this).
//
// We track current values per-node so re-setting one axis doesn't
// clobber the others.
// ──────────────────────────────────────────────────────────────────────

function ensureHotState(node) {
  if (!node._skalHot) {
    node._skalHot = { tx: 0, ty: 0, sx: 1, sy: 1, rz: 0 };
    // Promote to a compositor layer so transform/opacity updates skip
    // layout + paint. Equivalent to native's always-on graphicsLayer.
    node.style.willChange = 'transform, opacity';
  }
  return node._skalHot;
}

function updateTransform(node) {
  const h = node._skalHot;
  if (!h) return;
  node.style.transform =
    `translate(${h.tx}px, ${h.ty}px) ` +
    `scale(${h.sx}, ${h.sy}) ` +
    `rotate(${h.rz}deg)`;
}

// ──────────────────────────────────────────────────────────────────────
// Gesture wiring. The native renderer routes pan / scale through the
// event ring + a host GestureDetector; in the browser we're already in
// JS, so Pointer Events drive the handlers directly. The handler set
// lives in `node._skalG`; listeners are attached once per node.
//
// `draggable` is the same host-move fast-path as native — the element
// follows the pointer via the compositor `transform`, and JS only
// hears onPanStart / onPanEnd (never a per-frame onPanUpdate).
// ──────────────────────────────────────────────────────────────────────

function attachGestures(node) {
  if (node._skalGAttached) return;
  node._skalGAttached = true;
  node.style.touchAction = 'none'; // let us own the gesture

  const pts = new Map();           // live pointers (for pinch)
  let panId = -1, lastX = 0, lastY = 0, lastT = 0, vx = 0, vy = 0;
  let pinchBase = 1, pinchRot0 = 0, pinching = false;

  node.addEventListener('pointerdown', (e) => {
    const g = node._skalG;
    if (!g) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const wantScale = g.scaleStart || g.scaleUpdate || g.scaleEnd;
    if (pts.size === 2 && wantScale) {
      const [a, b] = [...pts.values()];
      pinchBase = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchRot0 = Math.atan2(b.y - a.y, b.x - a.x);
      pinching = true;
      if (g.scaleStart) g.scaleStart();
      return;
    }
    const wantPan = g.panStart || g.panUpdate || g.panEnd || g.draggable;
    if (panId === -1 && wantPan && !wantScale) {
      // Re-grabbing the box cancels any release simulation in flight.
      if (node._skalReleaseCancel) { node._skalReleaseCancel(); node._skalReleaseCancel = null; }
      panId = e.pointerId;
      node.setPointerCapture(e.pointerId);
      const r = node.getBoundingClientRect();
      lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
      vx = 0; vy = 0;
      if (g.panStart) g.panStart(e.clientX - r.left, e.clientY - r.top);
    }
  });

  node.addEventListener('pointermove', (e) => {
    const g = node._skalG;
    if (!g) return;
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinching && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rot = Math.atan2(b.y - a.y, b.x - a.x) - pinchRot0;
      if (g.scaleUpdate) g.scaleUpdate(dist / pinchBase, rot);
      return;
    }
    if (e.pointerId !== panId) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    const dt = Math.max(1, e.timeStamp - lastT);
    vx = (dx / dt) * 1000; vy = (dy / dt) * 1000;
    lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp;
    if (g.draggable) {
      const h = ensureHotState(node);
      if (g.draggable !== 3) h.tx += dx;   // 3 = vertical-only
      if (g.draggable !== 2) h.ty += dy;   // 2 = horizontal-only
      updateTransform(node);
    } else if (g.panUpdate) {
      g.panUpdate(dx, dy);
    }
  });

  const endPointer = (e) => {
    const g = node._skalG;
    pts.delete(e.pointerId);
    if (pinching && pts.size < 2) {
      pinching = false;
      if (g && g.scaleEnd) g.scaleEnd();
    }
    if (e.pointerId !== panId) return;
    panId = -1;
    if (!g) return;
    if (g.draggable && g.release) {
      // Release physics — keep moving, then report the resting offset.
      runRelease(node, g, vx, vy);
    } else if (g.panEnd) {
      if (g.draggable) {
        const h = node._skalHot || { tx: 0, ty: 0 };
        g.panEnd(h.tx, h.ty);   // final resting offset
      } else {
        g.panEnd(vx, vy);       // fling velocity (px/s)
      }
    }
  };
  node.addEventListener('pointerup', endPointer);
  node.addEventListener('pointercancel', endPointer);
}

// Web release-physics — the rAF counterpart of native's _MomentumDraggable.
// `glide` decays the fling velocity with friction; `springBack` integrates
// a numeric spring back to the origin. Runs entirely on the compositor's
// transform, then reports the resting offset through `onPanEnd`.
function runRelease(node, g, vx, vy) {
  const h = ensureHotState(node);
  const spring = g.release === 2;
  const k = 200, c = 2 * Math.sqrt(200) * 0.7; // springBack stiffness + damping
  // Honour the draggable axis lock — no off-axis glide / spring.
  if (g.draggable === 2) vy = 0;   // horizontal-only
  if (g.draggable === 3) vx = 0;   // vertical-only
  let last = performance.now();
  let raf = 0;
  const step = (now) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp a tab-switch stall
    if (spring) {
      vx += (-k * h.tx - c * vx) * dt;
      vy += (-k * h.ty - c * vy) * dt;
      h.tx += vx * dt; h.ty += vy * dt;
      if (Math.abs(h.tx) < 0.5 && Math.abs(h.ty) < 0.5 &&
          Math.abs(vx) < 5 && Math.abs(vy) < 5) {
        h.tx = 0; h.ty = 0; updateTransform(node);
        node._skalReleaseCancel = null;
        if (g.panEnd) g.panEnd(0, 0);
        return;
      }
    } else {
      const decay = Math.exp(-3 * dt); // friction e-fold
      vx *= decay; vy *= decay;
      h.tx += vx * dt; h.ty += vy * dt;
      if (Math.abs(vx) < 5 && Math.abs(vy) < 5) {
        updateTransform(node);
        node._skalReleaseCancel = null;
        if (g.panEnd) g.panEnd(h.tx, h.ty);
        return;
      }
    }
    updateTransform(node);
    raf = requestAnimationFrame(step);
  };
  node._skalReleaseCancel = () => { if (raf) cancelAnimationFrame(raf); };
  raf = requestAnimationFrame(step);
}

// onPan* / onScale* prop name → `node._skalG` slot.
const GESTURE_HANDLER_SLOTS = {
  onPanStart: 'panStart', onPanUpdate: 'panUpdate', onPanEnd: 'panEnd',
  onScaleStart: 'scaleStart', onScaleUpdate: 'scaleUpdate', onScaleEnd: 'scaleEnd',
};

// `draggable` enum: friendly string → 1 free / 2 horizontal / 3 vertical.
const DRAGGABLE_MODES = {
  free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3,
};

// `release` enum: friendly string → 1 glide (friction) / 2 springBack.
const RELEASE_MODES = {
  none: 0, glide: 1, friction: 1, springback: 2, spring: 2,
};

// `spring` enum: friendly string → 1 gentle / 2 bouncy / 3 stiff.
const SPRING_MODES = { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 };

// ──────────────────────────────────────────────────────────────────────
// Per-tag prop dispatch.
//
// Each prop name maps to one or a few CSS property writes. Unknown
// props are silently dropped — same contract as the native renderer.
// ──────────────────────────────────────────────────────────────────────

function applyProp(node, name, value) {
  const s = node.style;
  switch (name) {
    // ── Layout ──────────────────────────────────────────────────────
    case 'padding':       s.padding = `${value}px`; return;
    case 'paddingTop':    s.paddingTop = `${value}px`; return;
    case 'paddingRight':  s.paddingRight = `${value}px`; return;
    case 'paddingBottom': s.paddingBottom = `${value}px`; return;
    case 'paddingLeft':   s.paddingLeft = `${value}px`; return;
    case 'width':         { const w = parseDim(value); if (w != null) s.width = w; return; }
    case 'height':        { const h = parseDim(value); if (h != null) s.height = h; return; }
    case 'weight':        s.flexGrow = String(value); return;
    case 'gap':           s.gap = `${value}px`; return;
    case 'alignment': {
      // Map to flexbox arrangement on the main axis.
      const v = ALIGN_TO_JUSTIFY[value];
      if (v) s.justifyContent = v;
      return;
    }
    case 'axis': {
      // Scroll axis for scrollView / listView. 1 = horizontal.
      if (value === 1) {
        s.flexDirection = 'row';
        s.overflowX = 'auto';
        s.overflowY = 'hidden';
      } else {
        s.flexDirection = 'column';
        s.overflowX = 'hidden';
        s.overflowY = 'auto';
      }
      return;
    }
    // Grid (lazyGrid). aspectRatio can't be expressed from the grid
    // container in CSS — left as a no-op on web.
    case 'crossAxisCount':
      s.gridTemplateColumns = `repeat(${value}, 1fr)`;
      return;
    case 'aspectRatio':
      return;

    // Stack-child positioning — set on a child of <stack>. Any one of
    // these promotes the child to absolute positioning.
    case 'top':    s.position = 'absolute'; s.top = `${value}px`; return;
    case 'right':  s.position = 'absolute'; s.right = `${value}px`; return;
    case 'bottom': s.position = 'absolute'; s.bottom = `${value}px`; return;
    case 'left':   s.position = 'absolute'; s.left = `${value}px`; return;

    // ── Visual ──────────────────────────────────────────────────────
    case 'background':  { const c = parseColor(value); if (c) s.background = c; return; }
    case 'color':       { const c = parseColor(value); if (c) s.color = c; return; }
    case 'cornerRadius': s.borderRadius = `${value}px`; return;
    case 'borderWidth':  s.borderWidth = `${value}px`; s.borderStyle = 'solid'; return;
    case 'borderColor':  { const c = parseColor(value); if (c) s.borderColor = c; return; }
    case 'shadow':       s.boxShadow = `0 ${value / 2}px ${value}px rgba(0,0,0,0.2)`; return;

    // ── Text ────────────────────────────────────────────────────────
    case 'fontSize':   s.fontSize = `${value}px`; return;
    case 'fontWeight': s.fontWeight = String(value); return;
    case 'fontFamily': s.fontFamily = FONT_FAMILIES[value] || FONT_FAMILIES[0]; return;
    case 'textAlign':  s.textAlign = TEXT_ALIGNS[value] || 'start'; return;
    case 'lineHeight': s.lineHeight = `${value}px`; return;
    case 'maxLines':   {
      if (value && value > 0 && value !== 0x7FFFFFFF) {
        s.display = '-webkit-box';
        s.webkitLineClamp = String(value);
        s.webkitBoxOrient = 'vertical';
        s.overflow = 'hidden';
      }
      return;
    }
    case 'textOverflow': {
      if (value === 1) s.textOverflow = 'ellipsis';
      else if (value === 2) s.overflow = 'visible';
      else s.textOverflow = 'clip';
      return;
    }

    // ── Image ───────────────────────────────────────────────────────
    case 'src':
      if (node._skalTag === 'image') node.src = String(value);
      return;
    case 'contentScale':
      s.objectFit = OBJECT_FITS[value] || 'contain';
      return;

    // ── Controls (switch / checkbox / slider / progressBar) ─────────
    case 'checked':  node.checked = !!value; return;
    case 'min':      node.min = String(value); return;
    case 'max':      node.max = String(value); return;
    case 'progress':
      // <progress> with no `value` attribute renders indeterminate.
      if (value < 0) node.removeAttribute('value');
      else node.value = String(value);
      return;

    // ── Input ───────────────────────────────────────────────────────
    case 'placeholder': if (node._skalTag === 'button') return; node.placeholder = String(value); return;
    case 'value':       if (node._skalTag === 'button') return; node.value = String(value); return;
    case 'secureEntry':
      if (node._skalTag === 'textInput') node.type = value ? 'password' : 'text';
      return;
    case 'keyboardType': {
      const modes = ['text', 'numeric', 'email', 'tel', 'url', 'text'];
      node.inputMode = modes[value] || 'text';
      return;
    }

    // ── Behavior ────────────────────────────────────────────────────
    case 'enabled':   node.disabled = !value; return;
    case 'focusable': node.tabIndex = value ? 0 : -1; return;
    case 'visible':   s.display = value ? '' : 'none'; return;

    // ── Hot props — CSS transform / opacity. The compositor handles
    // these without layout invalidation, equivalent to native's
    // graphicsLayer. ───────────────────────────────────────────────
    case 'opacity':      s.opacity = String(value); return;
    case 'translationX': ensureHotState(node).tx = value; updateTransform(node); return;
    case 'translationY': ensureHotState(node).ty = value; updateTransform(node); return;
    case 'scaleX':       ensureHotState(node).sx = value; updateTransform(node); return;
    case 'scaleY':       ensureHotState(node).sy = value; updateTransform(node); return;
    case 'rotation':     ensureHotState(node).rz = value; updateTransform(node); return;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Solid universal-renderer plumbing. Same contract as renderer.js;
// the only difference is the sink (DOM here, bridge ops there).
// ──────────────────────────────────────────────────────────────────────

// Unknown tags get a degraded fallback (a plain <div> placeholder with
// children still parented in). Most "unknown" tags on web come from
// codegen-wrapped Flutter widgets like <Greeting>, <QrImageView>,
// <Camera>, etc. — they reach this renderer as lowercase intrinsics
// (<greeting>, <qrImageView>, <camera>) the babel macro emitted. They
// can't render natively in a browser; under the B.5 plan they'll be
// served by a hidden Flutter Web instance. Until that lands (Phases
// 1–5 of WEB_SUPPORT_PLAN.md), we render a visible placeholder so the
// surrounding layout still works instead of throwing and blanking the
// page.
const _warnedUnknownTags = new Set();
function warnOnce(tag) {
  if (_warnedUnknownTags.has(tag)) return;
  _warnedUnknownTags.add(tag);
  // eslint-disable-next-line no-console
  console.warn(`Skal web: unknown intrinsic <${tag}> — rendering placeholder. ` +
    `Custom widgets / Flutter plugins need the B.5 plugin host (WEB_SUPPORT_PLAN.md Phases 1–5).`);
}

const _renderer = createRenderer({
  createElement(tag) {
    const html = TAG_TO_HTML[tag];
    if (html === undefined) {
      warnOnce(tag);
      const el = document.createElement('div');
      el._skalTag = tag;
      el.setAttribute('data-skal-unknown', tag);
      // Make the placeholder visible-but-quiet: a 1px dashed outline,
      // a small label, no layout impact otherwise. Helps devs spot
      // codegen-wrapped widgets that need a B.5 plugin shim.
      el.style.outline = '1px dashed #d33';
      el.style.padding = '4px';
      el.style.color = '#d33';
      el.style.font = '11px ui-monospace, monospace';
      el.appendChild(document.createTextNode(`<${tag}>`));
      return el;
    }
    const el = document.createElement(html);
    el._skalTag = tag;
    applyDefaults(el, tag);
    return el;
  },

  createTextNode(value) {
    return document.createTextNode(value == null ? '' : String(value));
  },

  replaceText(textNode, value) {
    textNode.data = value == null ? '' : String(value);
  },

  setProperty(node, name, value, _prev) {
    // <flutterEmbed widget="..." props={...}> — capture the two
    // declarative props and coalesce a single embed.setSpec call per
    // tick. We don't pass these through to the DOM (they're not CSS).
    const tag = node._skalTag;
    if (tag === 'flutterEmbed') {
      if (name === 'widget') {
        node._skalEmbedWidget = value == null ? '' : String(value);
        _scheduleEmbedSync(node);
        return;
      }
      if (name === 'props') {
        node._skalEmbedProps = value && typeof value === 'object' ? value : {};
        _scheduleEmbedSync(node);
        return;
      }
    }

    // <tabs> / <tab> props — handled here so they don't fall through
    // to the generic CSS / attribute path (which would set them as
    // inline-style `activeTab:0` / DOM attribute `title=…`, etc.).
    // See _renderTabs for the layout + bar contract.
    if (tag === 'tabs') {
      if (name === 'activeTab') {
        node._skalActiveTab = (value | 0);
        _renderTabs(node);
        return;
      }
      if (name === 'onChange') {
        node._skalOnChange = typeof value === 'function' ? value : null;
        return;
      }
    } else if (tag === 'tab') {
      if (name === 'title' || name === 'icon') {
        if (name === 'title') node._skalTitle = value == null ? '' : String(value);
        else node._skalIcon = value == null ? '' : String(value);
        const p = node.parentElement;
        if (p && p._skalTag === 'tabs') _renderTabs(p);
        return;
      }
    }

    // Gesture handlers — direct DOM handlers. No event ring / handler-
    // id indirection needed; we're already in the browser's JS context.
    if (name === 'onClick' || name === 'onclick' || name === 'onTap') {
      node.onclick = typeof value === 'function' ? value : null;
      return;
    }
    if (name === 'onDoubleTap') {
      node.ondblclick = typeof value === 'function' ? value : null;
      return;
    }
    // onChange — value-change callback for controls. range/checkbox
    // inputs fire `input` for live updates.
    if (name === 'onChange') {
      node.oninput = typeof value === 'function' ? value : null;
      return;
    }
    // onSubmit — Enter key on a text input.
    if (name === 'onSubmit') {
      node.onkeydown = typeof value === 'function'
        ? (e) => { if (e.key === 'Enter') value(node.value); }
        : null;
      return;
    }
    if (name === 'onLongPress') {
      // The DOM has no long-press event — approximate with contextmenu
      // (right-click / touch-and-hold), suppressing the default menu.
      node.oncontextmenu = typeof value === 'function'
        ? (e) => { e.preventDefault(); value(e); }
        : null;
      return;
    }
    // Pan / scale gesture handlers — Pointer Events drive them.
    const gSlot = GESTURE_HANDLER_SLOTS[name];
    if (gSlot !== undefined) {
      (node._skalG ||= {})[gSlot] = typeof value === 'function' ? value : null;
      attachGestures(node);
      return;
    }
    // draggable — host-move fast-path. Accepts the enum (1/2/3), a
    // friendly string, or `true` (free).
    if (name === 'draggable') {
      const g = (node._skalG ||= {});
      g.draggable = typeof value === 'string'
        ? (DRAGGABLE_MODES[value] || 0)
        : (value === true ? 1 : (value | 0));
      attachGestures(node);
      return;
    }
    // release — draggable release physics: 1 glide, 2 springBack.
    if (name === 'release') {
      const g = (node._skalG ||= {});
      g.release = typeof value === 'string'
        ? (RELEASE_MODES[value.toLowerCase()] || 0)
        : (value === true ? 1 : (value | 0));
      attachGestures(node);
      return;
    }
    // spring — real-physics mode. The browser can't do native's
    // velocity-aware retargeting, so we approximate with a spring-
    // shaped CSS transition (bouncy overshoots via a >1 bezier).
    if (name === 'spring') {
      const m = typeof value === 'string'
        ? (SPRING_MODES[value] || 0)
        : (value === true ? 1 : (value | 0));
      if (m) {
        const easing = m === 2 ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' // bouncy
          : m === 3 ? 'cubic-bezier(0.22, 1, 0.36, 1)'               // stiff
          : 'cubic-bezier(0.4, 0, 0.2, 1)';                          // gentle
        const dur = m === 2 ? 620 : m === 3 ? 340 : 460;
        node.style.transition =
          `transform ${dur}ms ${easing}, opacity ${dur}ms ${easing}`;
      } else {
        node.style.transition = '';
      }
      return;
    }

    // <button label=...> / <text label=...> — set text content.
    // Mirrors the native renderer's `label` short-circuit so user code
    // can use the same prop name on both targets.
    if (name === 'label' && (node._skalTag === 'button' || node._skalTag === 'text')) {
      node.textContent = value == null ? '' : String(value);
      return;
    }
    // <listTile title> — web renders the title as the row's text
    // (subtitle / icons are a native-only nicety; best-effort web).
    if (name === 'title' && node._skalTag === 'listTile') {
      node.textContent = value == null ? '' : String(value);
      return;
    }

    // animate={{ duration, curve, delay }} — on web, a CSS transition
    // does the tweening. `all` so cold props (color/size) ride along
    // too — web gets §10.3 Phase 2 for free.
    if (name === 'animate' && value && typeof value === 'object') {
      const dur = value.duration | 0;
      let curve = value.curve;
      curve = typeof curve === 'string'
        ? (ANIM_CURVES_WEB[curve] ?? 0)
        : (curve | 0);
      const delay = value.delay | 0;
      node.style.transition =
        `all ${dur}ms ${WEB_EASINGS[curve] || 'linear'} ${delay}ms`;
      return;
    }

    if (value == null) return;
    applyProp(node, name, value);
  },

  insertNode(parent, node, anchor) {
    // <tabs> children: the bar should always remain the last DOM
    // child. If a new <tab> arrives with no anchor (append), insert it
    // *before* the bar so the bar stays pinned at the end.
    if (parent._skalTag === 'tabs' && parent._skalBar && !anchor) {
      parent.insertBefore(node, parent._skalBar);
    } else {
      parent.insertBefore(node, anchor || null);
    }
    // A <pageView> child is one full-bleed snap page.
    if (parent._skalTag === 'pageView' && node.style) {
      node.style.flex = '0 0 100%';
      node.style.scrollSnapAlign = 'start';
    }
    if (parent._skalTag === 'tabs' && node._skalTag === 'tab') {
      _renderTabs(parent);
    }
    if (node._skalTag === 'flutterEmbed') {
      // Lazy-boot + addView fire here, but actual setSpec waits for
      // `widget` to be set via setProperty. If widget is already on
      // node (could happen with re-mount), kick off the sync.
      _scheduleEmbedSync(node);
    }
  },

  removeNode(parent, node) {
    parent.removeChild(node);
    if (parent._skalTag === 'tabs' && node._skalTag === 'tab') {
      _renderTabs(parent);
    }
    if (node._skalTag === 'flutterEmbed') {
      _teardownFlutterEmbed(node);
    }
  },

  isTextNode(node) { return node.nodeType === 3; },
  getParentNode(node) { return node.parentNode; },
  getFirstChild(node) { return node.firstChild; },
  getNextSibling(node) { return node.nextSibling; },
});

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
  use,
} = _renderer;

// App-facing design-system selection — web parity for renderer.js's
// `setDesign`. Sets the document color-scheme so native form
// controls + scrollbars follow the chosen brightness.
const _WEB_DESIGN_MODES = ['material', 'cupertino', 'adaptive'];
export function setDesign(mode, brightness) {
  if (typeof document === 'undefined') return;
  const dark = brightness === 1 || brightness === 'dark';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.skalDesign =
    typeof mode === 'string' ? mode : (_WEB_DESIGN_MODES[mode] || 'material');
}

// Imperative dialog API — web parity for §10.2. Best-effort with the
// browser's native dialogs (no multi-button UI), so the same app code
// runs on web. The Flutter target gets the full AlertDialog surface.
export function showDialog(spec) {
  spec = spec || {};
  const actions = spec.actions || [];
  const msg = [spec.title, spec.message].filter(Boolean).join('\n\n');
  if (actions.length >= 2) {
    const ok = window.confirm(msg);
    const a = ok ? actions[actions.length - 1] : actions[0];
    return Promise.resolve(a ? a.value : null);
  }
  window.alert(msg);
  return Promise.resolve(actions[0] ? actions[0].value : null);
}
export function showActionSheet(spec) {
  return showDialog(spec);
}
export function showSnackbar(spec) {
  const s = typeof spec === 'string' ? { message: spec } : (spec || {});
  // No native equivalent — log so the call is observable in dev.
  if (s.message) console.log('[skal] snackbar:', s.message);
  return Promise.resolve(null);
}

// Date / time pickers — web parity for §2. Best-effort with the
// browser's native prompt (the Flutter target gets the real pickers).
// Same wire shape: date → ISO `YYYY-MM-DD`, time → 24h `HH:MM`.
export function showDatePicker(spec) {
  spec = spec || {};
  const def = typeof spec.initialDate === 'string' ? spec.initialDate : '';
  const v = typeof window !== 'undefined'
    ? window.prompt('Pick a date (YYYY-MM-DD)', def) : null;
  return Promise.resolve(v && v.trim() ? v.trim() : null);
}
export function showTimePicker(spec) {
  spec = spec || {};
  const h = Number.isInteger(spec.initialHour) ? spec.initialHour : 12;
  const m = Number.isInteger(spec.initialMinute) ? spec.initialMinute : 0;
  const def = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const v = typeof window !== 'undefined'
    ? window.prompt('Pick a time (HH:MM)', def) : null;
  return Promise.resolve(v && v.trim() ? v.trim() : null);
}
