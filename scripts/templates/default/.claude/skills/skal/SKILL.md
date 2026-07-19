---
name: skal
description: How to build UI in this Skal app. Use this skill whenever you create or modify screens, components, layouts, lists, forms, state, navigation, storage, or animations here — even for a "small tweak," and even if the request never says "Skal." Skal looks like React Native but is NOT — it is SolidJS (signals, not hooks) rendered natively by Flutter. Writing from React/React Native memory produces code that does not compile; consult this skill first.
---

# Building Skal apps

Skal renders SolidJS through Flutter. Your JSX runs in a JS engine
(JavaScriptCore on device, the browser on web); each `<Column>` /
`<Text>` / `<Button>` becomes a real Flutter widget on native — there
is no DOM, no CSS, no WebView. On the web target the same JSX renders
to real DOM instead. One codebase, native everywhere.

Two consequences drive everything below:

1. **This is Solid, not React.** Components run ONCE — there is no
   re-render. Reactivity is per-value: a signal read inside JSX updates
   just that spot. React idioms (hooks, `useState`, dependency arrays)
   do not exist and will not compile.
2. **Styling is props, not CSS.** No `style=`, no `className`, no
   StyleSheet. Layout and paint are explicit numeric props (`padding`,
   `gap`, `background`, `cornerRadius`) interpreted by Flutter.

## Never write (the React reflexes)

| React / React Native reflex        | Skal reality                                      |
|------------------------------------|---------------------------------------------------|
| `import ... from 'react-native'`   | `import { Column, Text, ... } from 'skal'`        |
| `useState(0)`                      | `createSignal(0)` from `'solid-js'`               |
| `useEffect(fn, [dep])`             | `createEffect(fn)` — deps are tracked automatically |
| `count` in JSX                     | `count()` — signals are FUNCTIONS, always call them |
| `cond && <X/>` re-evaluated        | `<Show when={cond()}><X/></Show>`                 |
| `items.map(x => <Row/>)`           | `<For each={items()}>{(x) => <Row/>}</For>`       |
| `<View>`, `<div>`                  | `<Box>` / `<Column>` / `<Row>`                    |
| `style={{ padding: 24 }}`          | `padding={24}` — props directly on the component  |
| `'#F2F2F7'` (6-digit color)        | `"#FFF2F2F7"` — 8-digit **AARRGGBB**, alpha first |
| `onPress`                          | `onClick` — and it works on ANY widget, not just Button |
| `<FlatList renderItem={...}/>`     | `<ListView count={n} renderItem={(i) => ...} />`  |

Forgetting `()` on a signal read is the #1 silent bug: `label={count}`
renders nothing useful and never updates. `label={count()}` is reactive.

## The shape of a screen

```jsx
import { createSignal, Show, For } from 'solid-js';
import { Column, Row, Text, Button, TextInput, ListView, Switch } from 'skal';

export default function Settings() {
  const [name, setName] = createSignal('');
  const [dark, setDark] = createSignal(false);

  return (
    <Column padding={24} gap={16} background="#FFF2F2F7">
      <Text label="Settings" testID="settings-title"
            fontSize={28} fontWeight={800} color="#FF1C1C1E" />
      <Row gap={12} alignment={3}>
        <Text label="Dark mode" fontSize={16} />
        <Switch checked={dark()} onChange={setDark} />
      </Row>
      <TextInput value={name()} placeholder="Display name"
                 onChange={setName} testID="name-input" />
      <Show when={name().length > 0}>
        <Text label={`Hello, ${name()}`} color="#FF8E8E93" />
      </Show>
    </Column>
  );
}
```

Rules embedded in that example:

- **Import every component from `'skal'`.** The imports compile away at
  build time (a babel macro rewrites the tags) — zero runtime cost, but
  the import line must exist or the tag is undefined.
- **Layout = `Column` / `Row` + `gap` + `padding` + `weight`.** All
  numbers are dp. `alignment` is main-axis: 0 start, 1 center, 2 end,
  3 space-between, 4 space-around, 5 space-evenly. `weight` is flex
  (like CSS `flex-grow`).
- **`width` / `height`** take dp numbers or the sentinels `'fill'` /
  `'wrap'`. Do NOT put `width="fill"` / `height="fill"` on the app's
  ROOT node — the template shell already handles fill, and the
  combination collapses the tree on iOS today.
- **Controlled components everywhere.** `Switch`/`Checkbox`/`Radio`/
  `Chip` use `checked` + `onChange(bool)`; `TextInput` uses `value` +
  `onChange(string)`; index-selection widgets (`Tabs`, `Dropdown`,
  `SegmentedButton`, `Stepper`, `PageView`) use `activeTab` +
  `onChange(index)`. Your handler must write the signal or the widget
  snaps back.
- **`testID` on anything interactive or asserted in tests** — it becomes
  the Semantics identifier Maestro targets (`.maestro/smoke.yaml`).

The full catalog — ~50 components with per-prop docs (images, tabs,
sliders, sheets, drawers, canvas, drag-and-drop, blur, pinch-zoom…) —
is in [references/components.md](references/components.md). Read it
before picking components or guessing a prop name; do not invent props.

## Lists

- Short static content that scrolls: `<ScrollView>` (eager).
- Real lists: `<ListView>` (virtualized). It must be the OUTERMOST
  vertical scroller — nesting it inside another vertical scroller
  collapses its height to 0. Give it a bounded parent (e.g. a `<Box
  height={520}>` or a `weight` slot), not another scroller.
- Big or unbounded lists (feeds, search results, logs): **builder
  mode** — no children at all, rows are pulled on demand and memory
  stays O(visible window) even at 1,000,000 rows:

  ```jsx
  <ListView count={feed().length}
            renderItem={(i) => <TweetCard tweet={feed()[i]} />} />
  ```

  `renderItem` must return a single element (no fragments/arrays).
- Drag-to-reorder: `<ReorderableListView>` + `onReorder(from, to)` —
  reorder your source array in the handler or the drag snaps back.
- Never `<For>` over thousands of items inside a `ScrollView` — that
  eagerly mounts everything. Reach for builder-mode `ListView`.

## State

- **Local / ephemeral:** `createSignal`, `createMemo`, `createEffect`
  from `'solid-js'` — standard Solid.
- **Persistent app state:** `createSkalStore` from `'skal/store'` — a
  deep reactive proxy that auto-persists to disk. Mutate it directly;
  reads are fine-grained reactive. No redux, no AsyncStorage, no
  serialization code:

  ```jsx
  import { createSkalStore } from 'skal/store';
  const state = createSkalStore(
    { settings: { dark: false }, todos: [] },
    { paths: { draft: { persist: false } } },   // opt-outs per subtree
  );
  // read (reactive):   state.settings.dark
  // write (persisted): state.settings.dark = true
  // collections:       state.todos.push({ id: 1, title: 'hi' })
  ```

  `initState` is the schema; arrays of objects become stable-id
  collections with per-record persistence.
- **Survive dev hot-reload:** `createHotState(initial, key?)` from
  `'skal/runtime'` — a signal whose value survives a JS hot reload
  (tab index, current route). Plain `createSignal` resets on reload.

## Navigation

Use `createRouter` from `'skal/runtime'` — real native push/pop
transitions, back-gesture, keep-alive screens (instant back, scroll
preserved):

```jsx
import { createRouter } from 'skal/runtime';

const router = createRouter({
  home:   (p) => <Home router={p.router} />,
  detail: { component: (p) => <Detail id={p.params.id} />, title: 'Detail' },
}, 'home', { linking: true });   // linking: web URL-hash deep links

// in App():        <router.View />
// from any screen: props.router.navigate('detail', { id: 5 })
//                  props.router.back()   .replace(...)   .reset(...)
// modal push:      router.navigate('compose', {}, { presentation: 'modal' })
```

A route `title` gives the screen a native app bar with an automatic
back button. Tab UIs use `<Tabs>`/`<Tab>` (state preserved across tab
switches); side menus use `<Drawer>` as a child of a `<Screen>`.

## Animation

JS declares targets, Flutter runs the frames — never animate a value
per-frame from JS (no rAF loops, no timers driving props).

```jsx
<Box animate={{ duration: 300, curve: 'easeInOut' }}
     opacity={open() ? 1 : 0} translationY={open() ? 0 : 24} />
```

- `animate` + a change to a **hot prop** (`opacity`, `translationX/Y`,
  `scaleX/Y`, `rotation`) tweens host-side at 60/120fps even if JS is
  blocked. Curves: `linear`, `easeIn`, `easeOut`, `easeInOut`,
  `bounce`, `elastic`, `fastOutSlowIn`; plus `delay`, `repeat`.
- `spring` prop: physics instead of curves (retargeting mid-flight
  keeps velocity). `draggable` + `release` ('glide' | 'springBack'):
  host-side drag with zero bridge traffic.
- Enter/exit of list items: `<AnimatedList>`. Content swaps:
  `<CrossFade>`. Shared-element across screens: `<Hero tag="...">`.
  Staggers: `createStagger(ms)` from `'skal/runtime'`.

## Custom native widgets

When the catalog lacks something (a map, a chart, a camera preview),
wrap any Flutter/pub.dev widget via `skal_codegen` — declare it in
`flutter-host/lib/skal_codegen.yaml`, run `bun run codegen`, and it
becomes a JSX component. Imperative methods use `createSkalRef()`.
Full guide: https://skal.run/docs/native.md (fetchable markdown).

## Verify your work

```sh
bun run build:js-only   # fastest compile check of src/ (vite, native bundle)
bun run build:web       # compile check via the web bundle
bun run dev:web         # run in a browser → http://localhost:5173
bun run dev:macos       # run the native app with JS hot reload (also dev:ios / dev:android)
bun run test:e2e        # Maestro flows in .maestro/ (targets testIDs)
```

After any nontrivial UI change, at minimum run `bun run build:js-only`
(or `build:web`) to prove it compiles; prefer actually launching
`dev:web` or a native target when you can observe the result. The web
target is a fast preview — some native-only widgets degrade there, so
final visual checks belong on a native target.

## Mental model recap

Solid signals drive a shared-memory bridge; Flutter owns pixels,
gestures, and animation frames. If you find yourself reaching for a
React pattern, a CSS property, a DOM API, or a per-frame JS loop —
stop and check this skill or [references/components.md](references/components.md);
the Skal-native way is already built and it is faster.
