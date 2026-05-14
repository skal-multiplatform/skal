// skal-shimmer — JSX-side companion for the hand-written Shimmer
// adapter (flutter/skal_flutter/lib/adapters/shimmer_manual.dart).
//
// The Dart adapter is HAND-WRITTEN rather than codegen-emitted
// because Shimmer's default constructor takes a `Gradient` (complex
// Flutter type, unsupported by codegen). The package's natural usage
// is via the `Shimmer.fromColors` NAMED constructor (which the
// codegen doesn't walk yet — named constructors are a separate
// feature). The manual wrapper bridges that gap in ~10 lines.

function makeMissingMacroComponent(name) {
  return function _skalMissingMacro() {
    throw new Error(
      `skal-shimmer: <${name}> was used without the babel-plugin-skal-jsx ` +
      `transform recognizing this module. Add 'skal-shimmer' to the ` +
      `plugin's \`modules\` option in vite.config.js.`
    );
  };
}

/**
 * @typedef {Object} ShimmerProps
 * @property {import('solid-js').JSX.Element} [children]   widget to shimmer over
 * @property {string | number} [baseColor]                 ARGB hex or u32
 *   (default 0xFFBDBDBD — Material grey 400)
 * @property {string | number} [highlightColor]            (default 0xFFE0E0E0 — Material grey 300)
 * @property {number} [period]                             milliseconds per
 *   shimmer cycle (default 1500)
 * @property {boolean} [enabled]                           (default true)
 * @property {number} [loop]                               number of cycles to
 *   play; 0 = forever (default 0)
 */

/**
 * Shimmering loading placeholder — wraps a child widget with an
 * animated linear-gradient sweep. Common pattern for skeleton-loader
 * UI while real content is fetching.
 *
 * @type {(props: ShimmerProps) => import('solid-js').JSX.Element}
 */
export const Shimmer = makeMissingMacroComponent('Shimmer');
