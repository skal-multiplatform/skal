// Skal — capitalized JSX component imports.
//
// Usage:
//
//   import { Container, Column, Row, Text, Button, ListView } from 'skal';
//
//   <Column gap={8}>
//     <Text label="Hello" />
//     <Button label="Tap" onClick={…} />
//   </Column>
//
// How these names work at build time:
//
//   `babel-plugin-skal-jsx.cjs` runs before Solid's preset. It sees
//   the `import { ... } from 'skal'` line, learns which capitalized
//   identifiers map to which lowercase intrinsic tags, then walks
//   the JSX and rewrites every matching tag in place. After the
//   plugin pass:
//
//     <ListView gap={12}>       →       <listView gap={12}>
//     <Column>...</Column>      →       <column>...</column>
//
//   The import line is stripped. Solid's preset then compiles the
//   lowercase JSX into direct `createElement('listView', …)` calls
//   that hit the bridge's fast path. No component wrapper, no
//   `createComponent` indirection, no reactive owner scope —
//   bit-for-bit identical compiled output to writing lowercase tags
//   directly. Zero runtime cost.
//
// What the runtime exports below are for:
//
//   In a correctly-configured build the plugin strips the imports
//   before the bundle is produced — these functions are never called.
//   They exist purely so that IF the plugin is misconfigured (missing
//   from vite.config.js, wrong moduleName option, etc.), the
//   developer gets a *useful error message* at first render instead
//   of a silently-blank screen.
//
//   The `@type {Component<…Props>}` annotations on each export tell
//   TypeScript what props the component accepts — this drives IDE
//   auto-complete, hover docs, and type errors on prop typos in
//   the consumer's JSX. `@param` / `@returns` would NOT work here,
//   because each export is a const assigned the result of a factory
//   call — JSDoc has to declare the const's type directly with
//   `@type`, not annotate a function declaration.
//
// Adding a new widget:
//
//   1. Add the lowercase tag to `renderer.js`'s TAG_TO_WIDGET map.
//   2. Add the capitalized → lowercase entry to
//      `babel-plugin-skal-jsx.cjs`'s WIDGET_NAMES map.
//   3. Add an export here with the right `@type`.
//   4. Add the matching wire constant + builder on the Flutter side
//      (wire.dart + root.dart).

/**
 * @typedef {Object} BaseProps Common layout / visual props every Skal
 *   widget accepts. Hot props (opacity/translation/scale/rotation)
 *   bypass the cold-prop diff cache — set them every frame without
 *   triggering full widget rebuilds.
 *
 * @property {import('solid-js').JSX.Element} [children]
 * @property {number} [padding] uniform padding in dp
 * @property {number} [paddingTop]
 * @property {number} [paddingRight]
 * @property {number} [paddingBottom]
 * @property {number} [paddingLeft]
 * @property {number | 'fill' | 'wrap'} [width]   literal dp, or sentinel
 * @property {number | 'fill' | 'wrap'} [height]
 * @property {number} [weight]                    flex weight (f32)
 * @property {number} [alignment]                 ALIGN_* enum (0..5)
 * @property {number} [gap]                       gap between children, dp
 * @property {string | number} [background]       ARGB hex `"#FF…"` or u32
 * @property {string | number} [color]            foreground / text color
 * @property {number} [cornerRadius]              dp
 * @property {number} [borderWidth]               dp
 * @property {string | number} [borderColor]
 * @property {number} [shadow]                    shadow elevation, dp
 * @property {() => void} [onClick]               tap handler — works on
 *   any widget, not just Button. Buttons just style themselves as
 *   pressable; any Container / Row / Text / etc. can also handle taps.
 * @property {number} [opacity]                   0..1 — hot, free to tween
 * @property {number} [translationX]              dp — hot
 * @property {number} [translationY]              dp — hot
 * @property {number} [scaleX]                    1.0 = identity — hot
 * @property {number} [scaleY]                    hot
 * @property {number} [rotation]                  radians — hot
 * @property {boolean} [enabled]
 * @property {boolean} [focusable]
 * @property {boolean} [visible]
 */

/**
 * @typedef {BaseProps & {
 *   label?: string,
 *   fontSize?: number,
 *   fontWeight?: number,
 *   fontFamily?: number,
 *   textAlign?: number,
 *   lineHeight?: number,
 *   maxLines?: number,
 *   textOverflow?: number,
 * }} TextProps
 */

/**
 * @typedef {BaseProps & {
 *   label?: string,
 *   fontSize?: number,
 * }} ButtonProps  // onClick comes from BaseProps — every widget accepts it.
 */

/**
 * Generic component signature: takes a typed props bag, returns JSX.
 * The Solid JSX type-checker uses the parameter type to validate
 * `<Component foo={…}>` prop names + types at the call site.
 *
 * @template P
 * @typedef {(props: P) => import('solid-js').JSX.Element} Component
 */

function makeMissingMacroComponent(name) {
  return function _skalMissingMacro() {
    // Hit only when `babel-plugin-skal-jsx.cjs` didn't run. The fix is
    // almost always "add the plugin to vite.config.js". Throws loudly
    // so misconfigured builds fail fast instead of rendering blank.
    throw new Error(
      `Skal: <${name}> was used without the babel-plugin-skal-jsx ` +
      `transform. Add the plugin to your Vite/babel config — see ` +
      `js-app/vite.config.js for an example. (This wrapper exists ` +
      `as a fallback so misconfigured builds fail loud rather than ` +
      `rendering blanks.)`
    );
  };
}

/**
 * Generic decorated box. Flutter `Container`. Single-child or
 * children-as-content. Use for backgrounds, padding, corner radius,
 * borders — the "wrap with a decoration" tool.
 *
 * @type {Component<BaseProps>}
 */
export const Box = makeMissingMacroComponent('Box');

/**
 * Same as {@link Box}. Flutter-aligned alias. Pick whichever name
 * reads better in your code; both compile to the same intrinsic.
 *
 * @type {Component<BaseProps>}
 */
export const Container = makeMissingMacroComponent('Container');

/**
 * Vertical flex layout. Flutter `Column`.
 *
 * Children stack top-to-bottom. Cross-axis (horizontal) alignment via
 * `alignment` prop; gap between children via `gap`. For scrolling,
 * prefer {@link ScrollView} (eager) or {@link ListView} (virtualized).
 *
 * @type {Component<BaseProps>}
 */
export const Column = makeMissingMacroComponent('Column');

/**
 * Horizontal flex layout. Flutter `Row`.
 *
 * Children stack left-to-right.
 *
 * @type {Component<BaseProps>}
 */
export const Row = makeMissingMacroComponent('Row');

/**
 * Text display. Flutter `Text`.
 *
 * Content via the `label` prop (preferred for styled text), or as a
 * string child of a container for unstyled defaults.
 *
 * @type {Component<TextProps>}
 */
export const Text = makeMissingMacroComponent('Text');

/**
 * Pressable button. Maps to a Material-neutral elevated button on
 * Flutter. Use `label` for the caption, `onClick` for the handler.
 *
 * @type {Component<ButtonProps>}
 */
export const Button = makeMissingMacroComponent('Button');

/**
 * Eagerly-built scrolling column. Flutter `SingleChildScrollView` +
 * `Column`. All children mount up front — fine for short content
 * (settings page, small form). For long feeds (>50 items) prefer
 * {@link ListView}, which virtualizes its children.
 *
 * @type {Component<BaseProps>}
 */
export const ScrollView = makeMissingMacroComponent('ScrollView');

/**
 * Virtualized vertical list. Flutter `ListView.builder`.
 *
 * Only the visible window of children plus a small overscan buffer is
 * built — a 5000-tweet feed mounts ~10 child widget trees up front
 * instead of all 5000. The bridge's NodeState graph still tracks all
 * 5000 entries; the host just doesn't materialize off-screen widgets.
 *
 * **Append-only contract.** Children-list backing is `ListChildList`
 * (O(1) append + indexOf, O(N − pos) insert/remove). Inserting or
 * removing at random positions on a large list hits the O(N²) cliff.
 * For drag-and-drop or mid-list mutation, use {@link ReorderableListView}.
 *
 * Must be the OUTERMOST vertical scroller — wrapping a `ListView` in
 * another vertical scroller (e.g. a `ScrollView`) collapses its
 * height to 0 because the inner viewport can't bound itself.
 *
 * @type {Component<BaseProps>}
 */
export const ListView = makeMissingMacroComponent('ListView');

/**
 * Virtualized vertical list with drag-and-drop reorder support.
 * Flutter `ReorderableListView.builder`.
 *
 * Same virtualization model as {@link ListView}, but children-list
 * backing is a `TreapChildList` (O(log N) on every operation — append,
 * insert, remove, indexOf, idAt). Pay the constant-factor overhead vs
 * `ListView` only when you actually need any-position mutation.
 *
 * **Note:** drag gestures are currently swallowed — the visual snap-back
 * is the safe default until the JS reorder-event protocol lands. See
 * `TODO(reorder-events)` in `root.dart`.
 *
 * @type {Component<BaseProps>}
 */
export const ReorderableListView = makeMissingMacroComponent('ReorderableListView');
