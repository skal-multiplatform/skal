# Skal component reference

> GENERATED from `packages/skal-js/src/skal/index.js` by
> `scripts/gen-skill-reference.mjs` — do not hand-edit; re-run the
> script after adding or changing a widget.

All components are imported from `'skal'`:

```jsx
import { Column, Row, Text, Button, ListView } from 'skal';
```

## Shared props — `BaseProps`

Common layout / visual props every Skal widget accepts. Hot props (opacity/translation/scale/rotation) bypass the cold-prop diff cache — set them every frame without triggering full widget rebuilds.

- `children: import('solid-js').JSX.Element`
- `padding: number` — uniform padding in dp
- `paddingTop: number`
- `paddingRight: number`
- `paddingBottom: number`
- `paddingLeft: number`
- `width: number | 'fill' | 'wrap'` — literal dp, or sentinel
- `height: number | 'fill' | 'wrap'`
- `weight: number` — flex weight (f32)
- `alignment: number` — ALIGN_* enum (0..5)
- `gap: number` — gap between children, dp
- `background: string | number` — ARGB hex `"#FF…"` or u32
- `color: string | number` — foreground / text color
- `cornerRadius: number` — dp
- `borderWidth: number` — dp
- `borderColor: string | number`
- `shadow: number` — shadow elevation, dp
- `onClick: () => void` — tap handler — works on any widget, not just Button. Buttons just style themselves as pressable; any Container / Row / Text / etc. can also handle taps.
- `opacity: number` — 0..1 — hot, free to tween
- `translationX: number` — dp — hot
- `translationY: number` — dp — hot
- `scaleX: number` — 1.0 = identity — hot
- `scaleY: number` — hot
- `rotation: number` — radians — hot
- `enabled: boolean`
- `focusable: boolean`
- `visible: boolean`
- `onLongPress: () => void` — touch-and-hold handler
- `onDoubleTap: () => void` — double-tap handler
- `onPanStart: (x: number, y: number) => void` — drag began — args are the touch-down position (dp, node-local)
- `onPanUpdate: (dx: number, dy: number) => void` — per-frame drag delta (dp). Fires every pointer-move frame — for "drag this box around" prefer the `draggable` prop, which moves it host-side with zero per-frame bridge traffic.
- `onPanEnd: (vx: number, vy: number) => void` — drag ended — fling velocity in dp/s (or, when `draggable` is set, the final resting offset so the app can persist the position)
- `onScaleUpdate: (scale: number, rotation: number) => void` — pinch — cumulative scale factor + rotation (radians). A node cannot use scale and pan handlers at once; scale wins.
- `onScaleStart: () => void`
- `onScaleEnd: () => void`
- `draggable: boolean | 1 | 2 | 3 | 'free' | 'horizontal' | 'vertical'` — host-move fast-path — the widget follows the pointer with no per-frame bridge traffic. `true`/`'free'` drags both axes, `'horizontal'` / `'vertical'` lock to one.
- `spring: boolean | 1 | 2 | 3 | 'gentle' | 'bouncy' | 'stiff'` — real-physics mode — the node's hot props are driven by a SpringSimulation, not a curve. A signal that retargets the node mid-flight is picked up from the spring's current position AND velocity (no dead-stop restart). Distinct from `animate.spring`.
- `release: boolean | 1 | 2 | 'glide' | 'springBack'` — draggable release physics — what the box does when the pointer lifts. `'glide'` carries the fling velocity and decelerates to rest (friction); `'springBack'` springs home to the origin. Only applies alongside `draggable`.
- `onHover: (over: boolean) => void` — pointer enter / exit (desktop / web) — `true` on enter, `false` on exit.
- `onKey: (combo: string) => void` — a key pressed while the widget is focused — arg is a normalized combo string, e.g. `"meta+s"`, `"escape"`, `"arrow up"`. The widget takes focus on mount and on click; put `onKey` on a top-level container for app shortcuts.
- `semanticLabel: string` — accessibility label — wraps the widget in a Semantics node so screen readers announce it.
- `testID: string` — stable E2E test handle — sets the Semantics `identifier` so test tools (Maestro `tapOn: { id }`, integration_test) can target this widget without relying on visible text. See docs/TESTING.md.

## `TextProps`

`BaseProps & { label?: string, fontSize?: number, fontWeight?: number, fontFamily?: number, textAlign?: number, lineHeight?: number, maxLines?: number, textOverflow?: number, }`

## `ButtonProps`

`BaseProps & { label?: string, fontSize?: number, }`

## <Box>

Generic decorated box. Flutter `Container`. Single-child or
children-as-content. Use for backgrounds, padding, corner radius,
borders — the "wrap with a decoration" tool.

**Props:** `BaseProps`

## <Container>

Same as `<Box>`. Flutter-aligned alias. Pick whichever name
reads better in your code; both compile to the same intrinsic.

**Props:** `BaseProps`

## <Column>

Vertical flex layout. Flutter `Column`.

Children stack top-to-bottom. Cross-axis (horizontal) alignment via
`alignment` prop; gap between children via `gap`. For scrolling,
prefer `<ScrollView>` (eager) or `<ListView>` (virtualized).

**Props:** `BaseProps`

## <Row>

Horizontal flex layout. Flutter `Row`.

Children stack left-to-right.

**Props:** `BaseProps`

## <Text>

Text display. Flutter `Text`.

Content via the `label` prop (preferred for styled text), or as a
string child of a container for unstyled defaults.

**Props:** `TextProps`

## <Button>

Pressable button. Maps to a Material-neutral elevated button on
Flutter. Use `label` for the caption, `onClick` for the handler.

**Props:** `ButtonProps`

## <ScrollView>

Eagerly-built scrolling column. Flutter `SingleChildScrollView` +
`Column`. All children mount up front — fine for short content
(settings page, small form). For long feeds (>50 items) prefer
`<ListView>`, which virtualizes its children.

`scrollbar` adds an always-visible, draggable scrollbar (desktop).

**Props:** `BaseProps & { scrollbar?: boolean }`

## <ListView>

Virtualized vertical list. Flutter `ListView.builder`.

Only the visible window of children plus a small overscan buffer is
built — a 5000-tweet feed mounts ~10 child widget trees up front
instead of all 5000. The bridge's NodeState graph still tracks all
5000 entries; the host just doesn't materialize off-screen widgets.

**Append-only contract.** Children-list backing is `ListChildList`
(O(1) append + indexOf, O(N − pos) insert/remove). Inserting or
removing at random positions on a large list hits the O(N²) cliff.
For drag-and-drop or mid-list mutation, use `<ReorderableListView>`.

Must be the OUTERMOST vertical scroller — wrapping a `ListView` in
another vertical scroller (e.g. a `ScrollView`) collapses its
height to 0 because the inner viewport can't bound itself.

`scrollbar` adds an always-visible, draggable scrollbar (desktop).

**Builder mode** — for huge lists, skip children entirely and let the
host pull rows on demand:

    <ListView count={feed().length}
              renderItem={(i) => <TweetCard tweet={feed()[i]} />} />

Only the visible window (plus overscan) exists AT ALL — on both the
JS and host side. Rows materialize when scrolled toward, far-away
rows are evicted, and memory stays O(window) no matter the count:
1,000,000 rows costs the same as 100. Signals read inside
`renderItem` keep updating their row; each row disposes cleanly on
eviction. Row heights need no declaration — measured extents are
cached per row (scrolling back is placeholder-accurate) and unseen
rows use a self-tuning estimate. `renderItem` must return a single
element (no fragments). `count` + `renderItem` are mutually
exclusive with children — when both are present, children are
ignored. On the DOM (web) target rows render eagerly, capped at
1500, since the browser culls offscreen paint itself.

**Props:** `BaseProps & { scrollbar?: boolean, count?: number, renderItem?: (index: number) => JSX.Element }`

## <ReorderableListView>

Virtualized vertical list with drag-and-drop reorder support.
Flutter `ReorderableListView.builder`.

Same virtualization model as `<ListView>`, but children-list
backing is a `TreapChildList` (O(log N) on every operation — append,
insert, remove, indexOf, idAt). Pay the constant-factor overhead vs
`ListView` only when you actually need any-position mutation.

A completed drag fires `onReorder(from, to)` — the app owns the
list, so the handler must reorder its own source array (e.g. a
signal) for the new order to stick. With no `onReorder` bound the
drag snaps back.

**Props:** `BaseProps & { onReorder?: (from: number, to: number) => void }`

## <Image>

Image leaf. Flutter `Image`.

`src` is dispatched by URI scheme — `http(s)://` → network,
`file://` / absolute path → file, `asset://name` or a bare string →
asset. `contentScale` is the BoxFit enum (0 contain, 1 cover,
2 fill, 3 fitWidth, 4 fitHeight, 5 none, 6 scaleDown). A non-zero
`cornerRadius` clips the image.

**Props:** `BaseProps & { src?: string, contentScale?: number }`

## <Stack>

Overlapping-children container. Flutter `Stack`.

A child carrying any of `top` / `right` / `bottom` / `left` (dp) is
absolutely positioned; children with none sit at the top-start
corner. Give the stack a `width` / `height` if all children are
positioned.

**Props:** `BaseProps`

## <Switch>

On/off toggle. Flutter `Switch` / `CupertinoSwitch`.

Controlled: `checked` is the source of truth; `onChange(bool)` fires
on toggle. With no `onChange` bound the switch renders disabled.

**Props:** `BaseProps & { checked?: boolean, onChange?: (v: boolean) => void }`

## <Slider>

Slider. Flutter `Slider` / `CupertinoSlider`.

`value` / `min` / `max` are doubles; `onChange(double)` fires
continuously while dragging. Uncontrolled *during* a drag (the
thumb tracks the finger with zero latency), controlled otherwise.

**Props:** `BaseProps & { value?: number, min?: number, max?: number, onChange?: (v: number) => void }`

## <Checkbox>

Checkbox. Flutter `Checkbox` / `CupertinoCheckbox`.

Controlled — same `checked` + `onChange(bool)` contract as
`<Switch>`.

**Props:** `BaseProps & { checked?: boolean, onChange?: (v: boolean) => void }`

## <ActivityIndicator>

Indeterminate spinner. Flutter `CircularProgressIndicator` /
`CupertinoActivityIndicator`. `color` tints it; `width` sets the
box size.

**Props:** `BaseProps`

## <ProgressBar>

Linear progress bar. Flutter `LinearProgressIndicator`.

`progress` is 0..1 for a determinate bar; omit it (or pass a
negative value) for the indeterminate animation.

**Props:** `BaseProps & { progress?: number }`

## <LazyGrid>

Lazy 2-D grid. Flutter `GridView.builder`.

`crossAxisCount` sets the column count; `aspectRatio` the cell
width/height ratio; `gap` both spacings. Virtualized like
`<ListView>`.

**Props:** `BaseProps & { crossAxisCount?: number, aspectRatio?: number }`

## <Wrap>

Flow layout. Flutter `Wrap` — children flow and wrap onto new runs.
`gap` sets both the in-run spacing and the run spacing.

**Props:** `BaseProps`

## <SafeArea>

Insets its child past notches / system bars. Flutter `SafeArea`.

**Props:** `BaseProps`

## <RichText>

Inline styled text. Flutter `Text.rich`.

Each child `<Text>` becomes one styled run (`TextSpan`) — the
child's own text-tier props (`fontSize`, `color`, `fontWeight`…)
style that run.

**Props:** `TextProps`

## <TextInput>

Text field. Flutter `TextField` / `CupertinoTextField`.

`value` is the text (controlled — synced without caret jumps),
`placeholder` the hint, `keyboardType` an enum (0 text, 1 number,
2 email, 3 phone, 4 url, 5 multiline), `secureEntry` obscures.
`onChange(string)` fires per keystroke, `onSubmit(string)` on Enter.

**Props:** `BaseProps & { value?: string, placeholder?: string, keyboardType?: number, secureEntry?: boolean, onChange?: (v: string) => void, onSubmit?: (v: string) => void }`

## <Navigator>

Screen-stack navigator. Flutter `Navigator(pages:)`.

Children are `<Screen>` nodes — the current route stack. The JS
app owns the stack (a signal); pushing/popping is just adding or
removing a `<Screen>`. Backgrounded screens stay mounted (keep-alive
— instant back, preserved scroll + state). `onPop(from)` fires when
a route is popped by a back-gesture or the system back button — the
handler should drop the top route from the stack.

Most apps use `createRouter()` rather than driving `<Navigator>`
directly — see skal-runtime.jsx.

**Props:** `BaseProps & { onPop?: () => void }`

## <Screen>

One route in a `<Navigator>`. Flutter `MaterialPage` /
`CupertinoPage`. Its single child is the screen content.
`presentation`: 0 = push (default), 1 = modal (a bottom-up
full-screen page). A non-empty `title` adds an `AppBar` /
`CupertinoNavigationBar` with an automatic back button.

**Props:** `BaseProps & { presentation?: number, title?: string }`

## <Tabs>

Bottom tab bar. Flutter `IndexedStack` + `NavigationBar` /
`CupertinoTabBar`.

Children are `<Tab>` nodes. Every tab subtree is built once and
kept alive (`IndexedStack`) — switching tabs never re-mounts; scroll
position and signal state survive. Controlled: `activeTab` is the
selected index, `onChange(index)` fires on a destination tap.

Give `<Tabs>` an explicit `height` (or put it in a bounded parent)
for the tab body to fill; without one it sizes to its largest tab.

**Props:** `BaseProps & { activeTab?: number, onChange?: (index: number) => void }`

## <Tab>

One destination of a `<Tabs>`. `title` is the bar label, `icon`
a name from the host icon table (`home`, `search`, `settings`,
`person`, `favorite`, `star`, `list`, `mail`, `chat`, `bell`,
`grid`, `calendar`, `camera`, `cart`, `explore`, `map`, …). Its
single child is the tab body.

**Props:** `BaseProps & { title?: string, icon?: string }`

## <AnimatedList>

Animated list. Flutter `AnimatedList`.

A virtualized list (like `<ListView>`) that animates item
insertion and removal — a child added by a `<For>` fades + expands
in; a removed child collapses + fades out. The JS app owns the
array; the host runs the enter/exit motion (deferred teardown keeps
a removed node alive until its exit animation finishes). For
drag-reorder use `<ReorderableListView>` instead.

**Props:** `BaseProps`

## <CrossFade>

Cross-fade container. Flutter `AnimatedSwitcher`.

Holds a single child and cross-fades when that child swaps
(`{cond() ? <A/> : <B/>}`). The outgoing child stays mounted through
the fade via the same deferred-teardown machinery as
`<AnimatedList>`.

**Props:** `BaseProps`

## <Hero>

Shared-element transition marker. Flutter `Hero`.

Two `<Hero>` nodes with the same `tag` — one on each route — fly
into each other when a `<Navigator>` pushes/pops between the
two screens. The flight is GPU-composited host-side.

**Props:** `BaseProps & { tag?: string }`

## <ListTile>

Structured Material row. Flutter `ListTile`.

Props-keyed, not child slots: `title` / `subtitle` strings,
`leadingIcon` / `trailingIcon` icon names (the host icon table —
`home`, `search`, `settings`, …), and `onClick` to make the whole
row pressable. For an arbitrary widget as leading / trailing,
compose a `<Row>` instead.

**Props:** `BaseProps & { title?: string, subtitle?: string, leadingIcon?: string, trailingIcon?: string, }`

## <PageView>

Swipeable full-page pager. Flutter `PageView`.

Each child is one full-bleed page. Horizontal swipe by default;
`axis={1}` makes it vertical. `activeTab` is the controlled page
index — setting it animates to that page — and `onChange(index)`
fires when a swipe settles. The swipe physics run host-side.

**Props:** `BaseProps & { activeTab?: number, onChange?: (index: number) => void, }`

## <Dismissible>

Swipe-to-dismiss wrapper. Flutter `Dismissible`.

Wraps a single child. `onDismiss` fires when the user swipes the
child off-screen — the app then drops the item from its source
list. Typically one per row inside a `<ListView>`.

**Props:** `BaseProps & { onDismiss?: () => void }`

## <CustomScrollView>

Sliver scroll viewport. Flutter `CustomScrollView`.

Its children are sliver sections — `<SliverAppBar>`, `<SliverList>`,
`<SliverGrid>`. Any non-sliver child is auto-wrapped so it scrolls
along. This is the only valid parent for the sliver widgets.

**Props:** `BaseProps`

## <SliverAppBar>

Collapsing / parallax header. Flutter `SliverAppBar`.

`title` is the bar title, `height` the expanded height, `sliverMode`
picks the scroll behaviour (`'pinned'` / `'floating'` / `'both'`),
and a child becomes the parallax background that collapses. Must be
a direct child of `<CustomScrollView>`.

**Props:** `BaseProps & { title?: string, sliverMode?: 0 | 1 | 2 | 3 | 'normal' | 'pinned' | 'floating' | 'both', }`

## <SliverList>

Lazily-built list section. Flutter `SliverList`. Children are rows.
Must be a direct child of `<CustomScrollView>`.

**Props:** `BaseProps`

## <SliverGrid>

Lazily-built grid section. Flutter `SliverGrid`. `crossAxisCount`
columns, `aspectRatio` per cell, `gap` spacing. Must be a direct
child of `<CustomScrollView>`.

**Props:** `BaseProps & { crossAxisCount?: number, aspectRatio?: number, }`

## <Canvas>

Arbitrary 2-D drawing surface. Flutter `CustomPaint`.

`draw` is a callback given a recording context — call its methods
(`fillStyle`, `fillRect`, `circle`, `beginPath`/`moveTo`/`lineTo`,
`fill`, `stroke`, `fillText`, …) to describe the drawing. The
commands are recorded, shipped once, and replayed host-side; the
draw fn re-runs reactively when signals it reads change. `width` /
`height` size the surface.

**Props:** `BaseProps & { width?: number, height?: number, draw?: (ctx: { fillStyle(c: string | number): any, strokeStyle(c: string | number): any, lineWidth(w: number): any, fillRect(x: number, y: number, w: number, h: number): any, strokeRect(x: number, y: number, w: number, h: number): any, circle(x: number, y: number, r: number): any, line(x1: number, y1: number, x2: number, y2: number): any, beginPath(): any, moveTo(x: number, y: number): any, lineTo(x: number, y: number): any, closePath(): any, fill(): any, stroke(): any, fontSize(s: number): any, fillText(t: string, x: number, y: number): any, }) => void, }`

## <DragItem>

Draggable item. Flutter `Draggable`.

Wraps a single child. `dragData` is a string id carried to whatever
`<DropZone>` the item is released over. A floating copy follows
the pointer during the drag.

**Props:** `BaseProps & { dragData?: string }`

## <DropZone>

Drop target. Flutter `DragTarget`.

Wraps a single child. When a `<DragItem>` is released over it,
`onDrop(dataId)` fires with that item's `dragData`. The zone
highlights host-side while an item hovers.

**Props:** `BaseProps & { onDrop?: (dataId: string) => void }`

## <Radio>

Single radio button. Flutter `Radio`.

`checked` is its selected state; a tap fires `onChange(true)`. The
app owns the group — its handler clears the other radios' `checked`.

**Props:** `BaseProps & { checked?: boolean, onChange?: (selected: boolean) => void, }`

## <Chip>

Selectable chip. Flutter `FilterChip`.

`label` is the chip text, `checked` the selected state;
`onChange(bool)` fires on a tap.

**Props:** `BaseProps & { label?: string, checked?: boolean, onChange?: (selected: boolean) => void, }`

## <SegmentedButton>

Single-select segmented control. Flutter `SegmentedButton`.

Each child is one segment's label. `activeTab` is the selected
index; `onChange(index)` fires on a tap.

**Props:** `BaseProps & { activeTab?: number, onChange?: (index: number) => void, }`

## <ExpansionTile>

Accordion / disclosure row. Flutter `ExpansionTile`.

`title` is the always-visible header; the children are the body
revealed when expanded. `onChange(bool)` fires on expand / collapse.
The open state is managed host-side.

**Props:** `BaseProps & { title?: string, onChange?: (expanded: boolean) => void, }`

## <Dropdown>

Single-select dropdown menu. Flutter `DropdownButton`.

Each child is one option's label. `activeTab` is the selected
index; `onChange(index)` fires on a pick.

**Props:** `BaseProps & { activeTab?: number, onChange?: (index: number) => void, enabled?: boolean, }`

## <Stepper>

Multi-step flow. Flutter `Stepper`.

Children are `<Step>` nodes. `activeTab` is the current step index;
`axis` picks vertical (0) or horizontal (1). `onChange(index)` fires
on a step tap or a continue / cancel button — the app owns the index.

**Props:** `BaseProps & { activeTab?: number, axis?: number, onChange?: (index: number) => void, }`

## <Step>

One step of a `<Stepper>`. Flutter `Step`.

`title` is the step header; the single child is the step body,
shown when this step is the current one.

**Props:** `BaseProps & { title?: string }`

## <Drawer>

Slide-in side navigation panel. Flutter `Drawer`.

Place a `<Drawer>` as a child of a `<Screen>` (alongside the screen
content). The navigator routes it to that screen's `Scaffold.drawer`
slot — Flutter then owns the edge-swipe gesture and, when the screen
has a title bar, the automatic hamburger button. The drawer's
children stack in a scrolling list — typically `<ListTile>` rows.

**Props:** `BaseProps`

## <BottomSheet>

Draggable, expandable bottom sheet. Flutter `DraggableScrollableSheet`.

Place a `<BottomSheet>` as a child of a `<Stack>`: it pins to the
bottom and the user drags it between `minSize` and `maxSize`.
`initialSize` / `minSize` / `maxSize` are 0..1 fractions of the
available height. Children stack in a scroll view whose own scroll
drives the expand gesture.

**Props:** `BaseProps & { initialSize?: number, minSize?: number, maxSize?: number, }`

## <BackdropFilter>

Blur / frosted-glass layer. Flutter `BackdropFilter`.

Blurs whatever is painted *behind* it — place a `<BackdropFilter>`
inside a `<Stack>`, above the content you want frosted. Its own
children (if any) render un-blurred on top, e.g. a translucent tint
box. `blurRadius` is the blur sigma in logical pixels.

**Props:** `BaseProps & { blurRadius?: number }`

## <InteractiveViewer>

Bounded pinch-zoom + pan. Flutter `InteractiveViewer`.

Wraps a single child and lets the user pinch-zoom and drag it within
`minScale` / `maxScale` bounds — the batteries-included version of
raw scale gestures (photos, maps, diagrams).

**Props:** `BaseProps & { minScale?: number, maxScale?: number }`

## <FlutterEmbed>

Visible Flutter Web view embedded in a DOM region — Shape C of
`docs/WEB_SUPPORT_PLAN.md`.

On web, the renderer adds a Flutter view at this element via
multi-view, then asks the plugin host to render the named widget.
`props` is a JSON-serializable object passed to the widget's Dart
constructor. Each codegen-wrapped widget the app declares is
available by name (see `flutter-web-plugins/lib/main.dart` —
`_widgetFor` switch).

On native this intrinsic doesn't exist — the same widget renders
directly through its codegen adapter (e.g. `<Counter>`, `<Greeting>`
from `skal-flutter`). FlutterEmbed is the web-only escape hatch
for widgets that have no DOM equivalent.

  <FlutterEmbed widget="counter" props={{ initial: 0 }} />

Sizing follows normal CSS (a default min-height of 200px keeps
embeds visible if no size is set); the Flutter view fills the box.

**Props:** `BaseProps & { widget: string, props?: object }`

## <HtmlEmbed>

Live DOM region embedded inside Flutter's render tree — "Flutter
with DOM holes". `viewType` names a factory registered via
`registerHtmlView` that builds the DOM element to mount. Flutter
Web's HtmlElementView punches a rectangle in the CanvasKit canvas
and composites the real DOM at that position — pointer events,
scroll, selection, ARIA all stay live. Works in Chrome / Firefox /
Safari (stable since Flutter 3.10+).

Use for third-party JS widgets that have no Flutter equivalent:
Stripe Elements, OAuth iframes, embedded videos, browser-native
form controls, WebGL/Three canvases, CMS HTML inserts.

  import { HtmlEmbed, registerHtmlView } from 'skal';
  registerHtmlView('stripe-card', (el) => {
    window.Stripe('pk_...').elements().create('card').mount(el);
  });
  <HtmlEmbed viewType="stripe-card" height={48} />

On native, falls back to a sized placeholder (the underlying use
cases are inherently web — no Stripe Elements in a Flutter
Android app). Apps that share JSX across targets should gate
web-only HtmlEmbed sections with the IS_WEB_DOM flag pattern.

**Props:** `BaseProps & { viewType: string }`

## registerHtmlView(viewType, factory)

Register a JS-side factory for an `<HtmlEmbed viewType="...">`
intrinsic. The factory receives a freshly-created `<div>` to
populate (mount your widget into it) plus the Flutter-assigned
view id (useful for disambiguating multiple instances of the
same viewType).

  registerHtmlView('youtube-embed', (el, viewId) => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    iframe.style.cssText = 'width:100%;height:100%;border:0';
    el.appendChild(iframe);
  });

Re-registering the same viewType replaces the factory (HMR-safe).
Calling on non-Shape-D targets is a no-op + does not warn — the
same source can target multiple shapes.
