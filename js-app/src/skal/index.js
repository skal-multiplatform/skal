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
 * @property {() => void} [onLongPress]   touch-and-hold handler
 * @property {() => void} [onDoubleTap]   double-tap handler
 * @property {(x: number, y: number) => void} [onPanStart]  drag began —
 *   args are the touch-down position (dp, node-local)
 * @property {(dx: number, dy: number) => void} [onPanUpdate]  per-frame
 *   drag delta (dp). Fires every pointer-move frame — for "drag this box
 *   around" prefer the `draggable` prop, which moves it host-side with
 *   zero per-frame bridge traffic.
 * @property {(vx: number, vy: number) => void} [onPanEnd]  drag ended —
 *   fling velocity in dp/s (or, when `draggable` is set, the final
 *   resting offset so the app can persist the position)
 * @property {(scale: number, rotation: number) => void} [onScaleUpdate]
 *   pinch — cumulative scale factor + rotation (radians). A node cannot
 *   use scale and pan handlers at once; scale wins.
 * @property {() => void} [onScaleStart]
 * @property {() => void} [onScaleEnd]
 * @property {boolean | 1 | 2 | 3 | 'free' | 'horizontal' | 'vertical'} [draggable]
 *   host-move fast-path — the widget follows the pointer with no
 *   per-frame bridge traffic. `true`/`'free'` drags both axes,
 *   `'horizontal'` / `'vertical'` lock to one.
 * @property {boolean | 1 | 2 | 3 | 'gentle' | 'bouncy' | 'stiff'} [spring]
 *   real-physics mode — the node's hot props are driven by a
 *   SpringSimulation, not a curve. A signal that retargets the node
 *   mid-flight is picked up from the spring's current position AND
 *   velocity (no dead-stop restart). Distinct from `animate.spring`.
 * @property {boolean | 1 | 2 | 'glide' | 'springBack'} [release]
 *   draggable release physics — what the box does when the pointer
 *   lifts. `'glide'` carries the fling velocity and decelerates to
 *   rest (friction); `'springBack'` springs home to the origin. Only
 *   applies alongside `draggable`.
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
 * A completed drag fires `onReorder(from, to)` — the app owns the
 * list, so the handler must reorder its own source array (e.g. a
 * signal) for the new order to stick. With no `onReorder` bound the
 * drag snaps back.
 *
 * @type {Component<BaseProps & { onReorder?: (from: number, to: number) => void }>}
 */
export const ReorderableListView = makeMissingMacroComponent('ReorderableListView');

// ─────────────────────────────────────────────────────────────────────
// Extended widget set — image, stack, controls, grid, etc.
// ─────────────────────────────────────────────────────────────────────

/**
 * Image leaf. Flutter `Image`.
 *
 * `src` is dispatched by URI scheme — `http(s)://` → network,
 * `file://` / absolute path → file, `asset://name` or a bare string →
 * asset. `contentScale` is the BoxFit enum (0 contain, 1 cover,
 * 2 fill, 3 fitWidth, 4 fitHeight, 5 none, 6 scaleDown). A non-zero
 * `cornerRadius` clips the image.
 *
 * @type {Component<BaseProps & { src?: string, contentScale?: number }>}
 */
export const Image = makeMissingMacroComponent('Image');

/**
 * Overlapping-children container. Flutter `Stack`.
 *
 * A child carrying any of `top` / `right` / `bottom` / `left` (dp) is
 * absolutely positioned; children with none sit at the top-start
 * corner. Give the stack a `width` / `height` if all children are
 * positioned.
 *
 * @type {Component<BaseProps>}
 */
export const Stack = makeMissingMacroComponent('Stack');

/**
 * On/off toggle. Flutter `Switch` / `CupertinoSwitch`.
 *
 * Controlled: `checked` is the source of truth; `onChange(bool)` fires
 * on toggle. With no `onChange` bound the switch renders disabled.
 *
 * @type {Component<BaseProps & { checked?: boolean, onChange?: (v: boolean) => void }>}
 */
export const Switch = makeMissingMacroComponent('Switch');

/**
 * Slider. Flutter `Slider` / `CupertinoSlider`.
 *
 * `value` / `min` / `max` are doubles; `onChange(double)` fires
 * continuously while dragging. Uncontrolled *during* a drag (the
 * thumb tracks the finger with zero latency), controlled otherwise.
 *
 * @type {Component<BaseProps & {
 *   value?: number, min?: number, max?: number,
 *   onChange?: (v: number) => void }>}
 */
export const Slider = makeMissingMacroComponent('Slider');

/**
 * Checkbox. Flutter `Checkbox` / `CupertinoCheckbox`.
 *
 * Controlled — same `checked` + `onChange(bool)` contract as
 * {@link Switch}.
 *
 * @type {Component<BaseProps & { checked?: boolean, onChange?: (v: boolean) => void }>}
 */
export const Checkbox = makeMissingMacroComponent('Checkbox');

/**
 * Indeterminate spinner. Flutter `CircularProgressIndicator` /
 * `CupertinoActivityIndicator`. `color` tints it; `width` sets the
 * box size.
 *
 * @type {Component<BaseProps>}
 */
export const ActivityIndicator = makeMissingMacroComponent('ActivityIndicator');

/**
 * Linear progress bar. Flutter `LinearProgressIndicator`.
 *
 * `progress` is 0..1 for a determinate bar; omit it (or pass a
 * negative value) for the indeterminate animation.
 *
 * @type {Component<BaseProps & { progress?: number }>}
 */
export const ProgressBar = makeMissingMacroComponent('ProgressBar');

/**
 * Lazy 2-D grid. Flutter `GridView.builder`.
 *
 * `crossAxisCount` sets the column count; `aspectRatio` the cell
 * width/height ratio; `gap` both spacings. Virtualized like
 * {@link ListView}.
 *
 * @type {Component<BaseProps & { crossAxisCount?: number, aspectRatio?: number }>}
 */
export const LazyGrid = makeMissingMacroComponent('LazyGrid');

/**
 * Flow layout. Flutter `Wrap` — children flow and wrap onto new runs.
 * `gap` sets both the in-run spacing and the run spacing.
 *
 * @type {Component<BaseProps>}
 */
export const Wrap = makeMissingMacroComponent('Wrap');

/**
 * Insets its child past notches / system bars. Flutter `SafeArea`.
 *
 * @type {Component<BaseProps>}
 */
export const SafeArea = makeMissingMacroComponent('SafeArea');

/**
 * Inline styled text. Flutter `Text.rich`.
 *
 * Each child {@link Text} becomes one styled run (`TextSpan`) — the
 * child's own text-tier props (`fontSize`, `color`, `fontWeight`…)
 * style that run.
 *
 * @type {Component<TextProps>}
 */
export const RichText = makeMissingMacroComponent('RichText');

/**
 * Text field. Flutter `TextField` / `CupertinoTextField`.
 *
 * `value` is the text (controlled — synced without caret jumps),
 * `placeholder` the hint, `keyboardType` an enum (0 text, 1 number,
 * 2 email, 3 phone, 4 url, 5 multiline), `secureEntry` obscures.
 * `onChange(string)` fires per keystroke, `onSubmit(string)` on Enter.
 *
 * @type {Component<BaseProps & {
 *   value?: string, placeholder?: string, keyboardType?: number,
 *   secureEntry?: boolean,
 *   onChange?: (v: string) => void, onSubmit?: (v: string) => void }>}
 */
export const TextInput = makeMissingMacroComponent('TextInput');

/**
 * Screen-stack navigator. Flutter `Navigator(pages:)`.
 *
 * Children are {@link Screen} nodes — the current route stack. The JS
 * app owns the stack (a signal); pushing/popping is just adding or
 * removing a `<Screen>`. Backgrounded screens stay mounted (keep-alive
 * — instant back, preserved scroll + state). `onPop(from)` fires when
 * a route is popped by a back-gesture or the system back button — the
 * handler should drop the top route from the stack.
 *
 * Most apps use `createRouter()` rather than driving `<Navigator>`
 * directly — see skal-runtime.jsx.
 *
 * @type {Component<BaseProps & { onPop?: () => void }>}
 */
export const Navigator = makeMissingMacroComponent('Navigator');

/**
 * One route in a {@link Navigator}. Flutter `MaterialPage` /
 * `CupertinoPage`. Its single child is the screen content.
 * `presentation`: 0 = push (default), 1 = modal (a bottom-up
 * full-screen page). A non-empty `title` adds an `AppBar` /
 * `CupertinoNavigationBar` with an automatic back button.
 *
 * @type {Component<BaseProps & { presentation?: number, title?: string }>}
 */
export const Screen = makeMissingMacroComponent('Screen');

/**
 * Bottom tab bar. Flutter `IndexedStack` + `NavigationBar` /
 * `CupertinoTabBar`.
 *
 * Children are {@link Tab} nodes. Every tab subtree is built once and
 * kept alive (`IndexedStack`) — switching tabs never re-mounts; scroll
 * position and signal state survive. Controlled: `activeTab` is the
 * selected index, `onChange(index)` fires on a destination tap.
 *
 * Give `<Tabs>` an explicit `height` (or put it in a bounded parent)
 * for the tab body to fill; without one it sizes to its largest tab.
 *
 * @type {Component<BaseProps & {
 *   activeTab?: number, onChange?: (index: number) => void }>}
 */
export const Tabs = makeMissingMacroComponent('Tabs');

/**
 * One destination of a {@link Tabs}. `title` is the bar label, `icon`
 * a name from the host icon table (`home`, `search`, `settings`,
 * `person`, `favorite`, `star`, `list`, `mail`, `chat`, `bell`,
 * `grid`, `calendar`, `camera`, `cart`, `explore`, `map`, …). Its
 * single child is the tab body.
 *
 * @type {Component<BaseProps & { title?: string, icon?: string }>}
 */
export const Tab = makeMissingMacroComponent('Tab');

/**
 * Animated list. Flutter `AnimatedList`.
 *
 * A virtualized list (like {@link ListView}) that animates item
 * insertion and removal — a child added by a `<For>` fades + expands
 * in; a removed child collapses + fades out. The JS app owns the
 * array; the host runs the enter/exit motion (deferred teardown keeps
 * a removed node alive until its exit animation finishes). For
 * drag-reorder use {@link ReorderableListView} instead.
 *
 * @type {Component<BaseProps>}
 */
export const AnimatedList = makeMissingMacroComponent('AnimatedList');

/**
 * Cross-fade container. Flutter `AnimatedSwitcher`.
 *
 * Holds a single child and cross-fades when that child swaps
 * (`{cond() ? <A/> : <B/>}`). The outgoing child stays mounted through
 * the fade via the same deferred-teardown machinery as
 * {@link AnimatedList}.
 *
 * @type {Component<BaseProps>}
 */
export const CrossFade = makeMissingMacroComponent('CrossFade');

/**
 * Shared-element transition marker. Flutter `Hero`.
 *
 * Two `<Hero>` nodes with the same `tag` — one on each route — fly
 * into each other when a {@link Navigator} pushes/pops between the
 * two screens. The flight is GPU-composited host-side.
 *
 * @type {Component<BaseProps & { tag?: string }>}
 */
export const Hero = makeMissingMacroComponent('Hero');

/**
 * Structured Material row. Flutter `ListTile`.
 *
 * Props-keyed, not child slots: `title` / `subtitle` strings,
 * `leadingIcon` / `trailingIcon` icon names (the host icon table —
 * `home`, `search`, `settings`, …), and `onClick` to make the whole
 * row pressable. For an arbitrary widget as leading / trailing,
 * compose a `<Row>` instead.
 *
 * @type {Component<BaseProps & {
 *   title?: string, subtitle?: string,
 *   leadingIcon?: string, trailingIcon?: string,
 * }>}
 */
export const ListTile = makeMissingMacroComponent('ListTile');

/**
 * Swipeable full-page pager. Flutter `PageView`.
 *
 * Each child is one full-bleed page. Horizontal swipe by default;
 * `axis={1}` makes it vertical. `activeTab` is the controlled page
 * index — setting it animates to that page — and `onChange(index)`
 * fires when a swipe settles. The swipe physics run host-side.
 *
 * @type {Component<BaseProps & {
 *   activeTab?: number, onChange?: (index: number) => void,
 * }>}
 */
export const PageView = makeMissingMacroComponent('PageView');

/**
 * Swipe-to-dismiss wrapper. Flutter `Dismissible`.
 *
 * Wraps a single child. `onDismiss` fires when the user swipes the
 * child off-screen — the app then drops the item from its source
 * list. Typically one per row inside a {@link ListView}.
 *
 * @type {Component<BaseProps & { onDismiss?: () => void }>}
 */
export const Dismissible = makeMissingMacroComponent('Dismissible');
