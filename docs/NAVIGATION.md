# Skal — Navigation

The plan for screen navigation: a stack of screens with native push/pop
transitions, native back-gesture, and — the point — **keep-alive**, so
going back is instant and never re-mounts a screen.

Companion to [`FLUTTER_JS_COMPONENTS.md`](FLUTTER_JS_COMPONENTS.md)
(the fast-path widget layer this builds on).

---

## 1. The core decision

**JS owns the route stack as declarative data; Flutter's declarative
`Navigator(pages:)` reconciles it into native push/pop.**

NOT a JS-side router that swaps the active subtree. A signal-swap
router *unmounts* the previous screen on navigate — so going back
re-creates it from scratch: re-emit every `CREATE_NODE`, rebuild every
Flutter element, lose scroll position and all signal state. That is
the single worst thing for perceived performance. Native navigators
exist precisely so the previous screen stays alive.

Flutter's `Navigator(pages: [...])` takes a *list* of pages and diffs
it — exactly Skal's model. It is the same shape as the animation and
reorder subsystems:

| Subsystem  | JS owns         | Flutter does                         | per-frame JS cost |
|------------|-----------------|--------------------------------------|-------------------|
| Animation  | the target      | the tween                            | zero              |
| Reorder    | the list array  | the drag gesture                     | zero              |
| Navigation | the route stack | transitions + back-gesture + keep-alive | zero           |

## 2. Three layers — don't conflate them

1. **Mechanism** — `<navigator>` + `<screen>` widgets backed by
   `Navigator(pages:)`. The only wire / Flutter work.
2. **Router (JS)** — `createRouter({routes})`: a route table
   (`name → component`), `navigate()` / `back()` / `replace()`, route
   params. Pure JS sugar over the stack signal — zero wire cost.
3. **Platform `Router`** — Flutter's `RouterDelegate` /
   `MaterialApp.router`: the OS route-info bridge (deep links, web
   URLs, restoration). Additive — `RouterDelegate.build()` just
   returns a `Navigator(pages:)` derived from the same JS stack.
   **Deferred to Phase 2** — not needed for in-app push/pop.

**The performance-critical invariant:** the router decides the
*stack*; `<navigator>` does the keep-alive *render*. A web router
(`<Routes>`) conflates them — match, render, unmount the rest. Skal's
router must keep the two jobs split, or keep-alive is lost.

## 3. The widgets

- **`<navigator>`** (`wtNavigator`) → Flutter `Navigator(pages:)`.
  Children are `<screen>` nodes (the current stack). `onPop` handler
  fires when Flutter pops a route via gesture / system back.
- **`<screen>`** (`wtScreen`) → one `MaterialPage` / `CupertinoPage`
  (variant per the design system, §10.1). Its single child is the
  screen content. `presentation` prop: `0` push (default) / `1` modal
  (`fullscreenDialog` — bottom-up transition).

```jsx
const [stack, setStack] = createSignal([{ name: 'home' }]);
<Navigator onPop={() => setStack(stack().slice(0, -1))}>
  <For each={stack()}>
    {(route) => (
      <Screen>
        {route.name === 'home'   && <Home   push={(r) => setStack([...stack(), r])} />}
        {route.name === 'detail' && <Detail id={route.id} />}
      </Screen>
    )}
  </For>
</Navigator>
```

`createRouter` (Phase 1, JS) wraps this — a route table replaces the
`route.name === …` switch, and exposes `navigate` / `back` / params.

## 4. Push / pop flows

- **Push** — JS appends a route → `<For>` adds a `<screen>` node →
  `_buildNavigator` rebuilds with one more page → Flutter diffs
  `pages`, runs the native push transition. Only the new screen's
  subtree is created; existing screens are untouched.
- **Pop, programmatic** (a Back button → `router.back()`) — JS drops
  the last route → the `<screen>` node is removed → `pages` shrinks →
  native pop transition. No event, no race.
- **Pop, gesture / system back** — Flutter's `Navigator` pops the
  route and calls `onDidRemovePage` → Skal dispatches `evNavPop` to
  the `<navigator>`'s `onPop` handler → JS drops the last route → the
  next `pages` diff makes it real. (Same pattern as
  `reorderableListView`'s `onReorder`.)

## 5. Why it is performance-first

1. **Keep-alive is automatic + free.** Backgrounded screens stay
   children of `<navigator>` — their NodeStates, Flutter elements,
   scroll positions and Solid signals all survive. Back is instant:
   no re-mount, no re-emit.
2. **Native transitions** run host-side, GPU-composited — zero
   per-frame bridge traffic.
3. **Lazy screen construction** — a screen's node subtree is built
   only when it is pushed.
4. **Offstage screens don't paint** — Flutter's Navigator marks
   covered routes offstage after the transition completes.
5. **Route params are free** — plain JS data on the stack signal;
   zero wire cost.

## 6. The hard part — the pop-sync gap

A gesture pop animates on Flutter's side *before* the `onPop`
round-trip updates the JS stack. For ~one round-trip the JS `pages`
list still contains the popped screen.

- Use **`onDidRemovePage`** (the modern API, designed to tolerate the
  async list lag) — not the deprecated `onPopPage` (which re-adds a
  page still present in a stale list).
- If a re-add glitch ever appears, the fallback is for
  `_buildNavigator` to track a per-navigator "popped but JS hasn't
  caught up" count and build `pages` minus that count until
  `childCount` catches up.

Programmatic pop has no gap (JS removes first), so a Phase-1 demo
driven by explicit Back buttons exercises the clean path.

## 7. Back-button arbitration (vs. dialogs)

`<navigator>` is a *nested* Navigator (the tree is `MaterialApp →
Scaffold → SkalRoot`). The Android system back goes to `MaterialApp`'s
*root* Navigator first — which is also where `showDialog` (§10.2)
pushes. Correct order: dialog open → dismiss dialog; else → pop
`<navigator>`.

**Done (Phase 2).** `_buildNavigator` wraps its `Navigator` in a
`PopScope` registered on the root route: `canPop` is false while the
navigator holds more than one screen, so the system back is
intercepted and forwarded to JS as `evNavPop` (JS drops the top
route → the pages diff runs the native pop). At one screen `canPop`
is true and the system back falls through (exits the app / pops a
parent). Dialog arbitration is automatic — `showDialog` pushes its
route *above* the route the `PopScope` lives in, so a system back
with a dialog open pops the dialog first and the `PopScope` never
sees it. iOS swipe-back is a route gesture on the nested Navigator
and needs no extra wiring.

## 8. Wire additions

- Widget types: `wtNavigator`, `wtScreen` (Phase 1); `wtTabs`,
  `wtTab` (Phase 3).
- Event kind: `evNavPop` — gesture / system pop → `onPop` handler.
  `<tabs>` reuses `evChange` for the destination-tap callback.
- Props: `propPresentation` (u32 — 0 push, 1 modal) on `<screen>`;
  `propTitle` (str) on `<screen>` / `<tab>`; `propIcon` (str) on
  `<tab>`; `propActiveTab` (u32) on `<tabs>`.
- `node_state.dart`: `onPopHandlerId`. `bridge.dart`: `opBindHandler`
  case. `renderer.js`: `TAG_TO_WIDGET` + `HANDLER_EVENTS['onPop']` +
  `COLD_PROPS` (`title` / `icon` / `activeTab`). Babel plugin +
  `skal/index.js` exports.
- `root.dart`: `_buildNavigator` (→ `Navigator(pages:)`,
  `onDidRemovePage`, `PopScope`, `_screenChrome`), `_buildScreen`,
  `_buildTabs` (→ `IndexedStack` + `NavigationBar`), `_buildTab`,
  `_iconFor`.
- `createRouter` in the `skal` runtime (per-route `title`,
  `{ linking }` for web URLs).

## 9. Phases

- **Phase 1 — done.** `<navigator>` + `<screen>`, push + pop
  (programmatic + gesture), native transitions + variant, keep-alive,
  `createRouter`, a demo section.
- **Phase 2 — done.** System-back arbitration via `PopScope` (§7); an
  `AppBar` / `CupertinoNavigationBar` from `<screen title>` (a
  non-empty `propTitle` wraps the screen content in a `Scaffold` /
  `CupertinoPageScaffold` — the back button is automatic). The
  pop-sync fallback (§6) was not needed: `onDidRemovePage` tolerates
  the one-round-trip list lag without a re-add glitch.
- **Phase 3 — `<tabs>` done.** `<tabs>` + `<tab>` →
  `IndexedStack` (every tab subtree kept alive) above a
  `NavigationBar` / `CupertinoTabBar`. Controlled `activeTab` +
  `onChange(index)`. `<tab>` carries `title` + `icon` (a name
  resolved by a host-side icon table).

  **Remaining:** Flutter `Router` / `RouterDelegate` for *native*
  deep links. `createRouter({ linking: true })` already does the
  web slice — the launch URL `#/route` hash picks the initial route
  and the top route is mirrored back into the hash (shareable URLs).
  Still open: browser back/forward history integration, and the
  native `MaterialApp.router` + `RouteInformationParser` plumbing
  (which also needs OS config — Android intent filters, iOS
  associated domains). Additive — `RouterDelegate.build()` would just
  return a `Navigator(pages:)` derived from the same JS stack.
