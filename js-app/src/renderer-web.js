// Solid universal-renderer adapter for Skal — DOM target.
//
// Parallel to renderer.js (which targets the native Flutter host).
// Same JSX tags (`<column>`, `<box>`, `<row>`, `<scrollColumn>`,
// `<text>`, `<button>`), same prop names (`background`, `padding`,
// `cornerRadius`, `opacity`, ...), but here we produce real DOM nodes
// and inline CSS instead of writing bridge ops.
//
// The whole point: `App.jsx` (and `Tweet`, and any future user code)
// compiles to the SAME JSX. Vite swaps the `~renderer` alias between
// renderer.js (native) and this file (web), so the same component
// tree drives either Flutter-on-native or DOM-in-browser.

import { createRenderer } from 'solid-js/universal';

// ──────────────────────────────────────────────────────────────────────
// Tag → HTML element + per-tag baseline styling.
//
// Defaults match the Flutter widget builders in root.dart so an
// un-styled <column> on web has the same shape as on native (fill
// width, 16dp padding, 8dp gap). Without these defaults you'd see
// every primitive collapse to a 0×0 container at first render.
// ──────────────────────────────────────────────────────────────────────

const TAG_TO_HTML = {
  column:       'div',
  scrollColumn: 'div',
  // Web has no virtualization story for arbitrary DOM children — a
  // <lazyColumn> just degrades to a regular scrollable div with all
  // children eagerly mounted. The virtualization is a host-side
  // optimization (Flutter ListView.builder); on web the browser's own
  // scroll virtualization handles render culling at the GPU layer.
  lazyColumn:   'div',
  row:          'div',
  box:          'div',
  text:         'span',
  button:       'button',
};

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
    case 'scrollColumn':
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
    case 'box':
      s.display = 'block';
      s.position = 'relative';
      s.boxSizing = 'border-box';
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
  }
}

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

    // ── Image / input — basic pass-through. Real Image / TextField
    // support would need different host elements (we use <span> and
    // <button> as our two leaves, neither is <img> or <input>). A
    // future change can introduce a <skalImage> / <input> mapping.
    case 'src':         /* would set on <img> */ return;
    case 'placeholder': if (node._skalTag === 'button') return; node.placeholder = String(value); return;
    case 'value':       if (node._skalTag === 'button') return; node.value = String(value); return;

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

const _renderer = createRenderer({
  createElement(tag) {
    const html = TAG_TO_HTML[tag];
    if (html === undefined) throw new Error(`Skal: unknown JSX tag <${tag}>`);
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
    // onClick — direct DOM handler. No event ring / handler-id
    // indirection needed; we're already in the browser's JS context.
    if (name === 'onClick' || name === 'onclick') {
      if (typeof value === 'function') {
        node.onclick = value;
      } else {
        node.onclick = null;
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

    if (value == null) return;
    applyProp(node, name, value);
  },

  insertNode(parent, node, anchor) {
    parent.insertBefore(node, anchor || null);
  },

  removeNode(parent, node) {
    parent.removeChild(node);
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
