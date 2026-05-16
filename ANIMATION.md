# Skal — Animation

The plan for motion: every animation runs **host-side on Flutter**, JS
only ever declares the target. Implicit tweens, explicit/looping
animations, list enter/exit, shared-element (Hero) transitions — all
with **zero per-frame bridge traffic**.

Companion to [`FLUTTER_JS_COMPONENTS.md`](FLUTTER_JS_COMPONENTS.md)
(the fast-path widget layer) and [`NAVIGATION.md`](NAVIGATION.md)
(which already gives native push/pop transitions).

---

## 1. The core decision

**JS declares the target value; Flutter runs the tween.**

A naive RN-style bridge animates by having JS push a new value every
frame — 60 cross-boundary writes/second per animated property, and the
animation stutters whenever the JS thread is busy. Skal never does
this. JS flips **one signal**, that's **one wire write**, and a Dart
`AnimationController` interpolates over the next N frames entirely
host-side. The JS thread can be fully blocked and the animation stays
at 60/120 fps.

This is the same shape as the rest of the framework:

| Subsystem  | JS owns         | Flutter does                         | per-frame JS cost |
|------------|-----------------|--------------------------------------|-------------------|
| Animation  | the target      | the tween                            | zero              |
| Navigation | the route stack | transitions + keep-alive             | zero              |
| Reorder    | the list array  | the drag gesture                     | zero              |
| AnimatedList | the list array | item enter / exit motion           | zero              |

**The performance-critical invariant:** no animation may route a
per-frame value across the bridge, and no animation may fire
`cold.notify()` per frame (that rebuilds the node's whole widget
subtree). Every animation is a dedicated, minimal Dart widget tweening
in isolation.

## 2. What exists today — the `animate` prop (Phase 0, done)

```jsx
<Box animate={{ duration: 450, curve: 'easeInOut', delay: 0 }}
     opacity={on() ? 0.3 : 1}
     scaleX={on() ? 1.4 : 1} rotation={on() ? 0.5 : 0} />
```

A non-zero `animate.duration` turns on **implicit tweening of the
node's hot props** — `opacity`, `translationX/Y`, `scaleX/Y`,
`rotation`. A change tweens instead of snapping. Implemented by
`_AnimatedHotLayer` in `root.dart`: one `AnimationController` per
animated node, driven by `propAnimDuration/Curve/Delay`. Curves:
`linear`, `easeIn`, `easeOut`, `easeInOut`, `bounce`, `elastic`,
`fastOutSlowIn`.

It already subsumes Flutter's `AnimatedOpacity` / `AnimatedScale` /
`AnimatedSlide` and the `Fade|Scale|Slide|RotationTransition` family.
**The animated layer wraps its memoized child in a `RepaintBoundary`**,
so the child's `paint()` is never re-run during the tween — only the
Transform/Opacity re-composites.

What it does **not** do yet: cold props (color, size, radius,
padding), looping, list enter/exit, Hero, physics. The rest of this
doc fills those in.

## 3. The animation matrix

| Animation | Flutter analogue | Mechanism in Skal | Phase |
|-----------|------------------|-------------------|-------|
| Hot-prop tween (opacity/transform) | `AnimatedOpacity`, `*Transition` | `animate` prop → `_AnimatedHotLayer` | 0 — done |
| Cold-prop tween (color/size/radius/padding/border) | `AnimatedContainer`, `AnimatedPadding` | `animate` prop widened → animated visual wrapper | 1 |
| Looping / ping-pong (pulse, spin) | `controller.repeat()` | `animate: { repeat, reverse }` | 1 |
| Text-style tween | `AnimatedDefaultTextStyle` | `animate` on `<text>` → animated style | 1 |
| List item enter / exit | `SizeTransition` + `FadeTransition` | `<animatedList>` + deferred teardown | 2 |
| Content cross-fade | `AnimatedSwitcher` | `<crossFade>` — outgoing-element retention | 2 |
| Shared-element transition | `Hero` | `<hero tag>` (the navigator is a real `Navigator`) | 3 |
| Staggered | `Interval` / delayed controllers | app pattern over `animate.delay` (+ a helper) | 3 |
| Physics / spring | spring-like `Curves` | `animate: { spring: 'bouncy' }` | 4 |
| Custom page transition | `PageRouteBuilder` | `<screen transition>` prop | 4 |
| Vector (Lottie / Rive) | `lottie`, `rive` packages | codegen-wrapped custom widget — not core | out of scope |

## 4. Cold-prop tweens (Phase 1)

Today a cold prop change (`background`, `width`, `cornerRadius`,
`padding`, `borderWidth`, …) fires `cold.notify()` → the node rebuilds
and the new value **snaps**. To tween it we must not push per-frame
values from JS, and must not re-run the children every frame.

**Implementation — let Flutter's own implicitly-animated widgets do
it.** The per-node build already splits into a *visual/sizing wrapper*
(`_applyColdVisual` → `DecoratedBox` + `Padding`, `_applyWidth/Height`
→ `SizedBox`) and the *children subtree*. When `animate.duration > 0`,
swap the wrapper widgets for their animated equivalents:

- `DecoratedBox` → `AnimatedContainer` (tweens color, border, radius,
  width, height, padding in one widget).
- `Padding` → folded into `AnimatedContainer`.
- `<text>` style → `AnimatedDefaultTextStyle` (font size, color,
  weight).

Flutter owns the tween; JS still writes the cold prop exactly once.
**No wire changes** — `animate` already exists; Phase 1 just widens
which props it covers.

Performance: `AnimatedContainer` repaints itself each frame, so the
children subtree it wraps **must** sit behind a `RepaintBoundary` (same
rule as `_AnimatedHotLayer`). The boundary is added only for animated
nodes — a static node pays nothing.

## 5. Looping & explicit control (Phase 1)

The `animate` prop is implicit (tween once to the target). A pulsing
dot or an app-drawn spinner needs the controller to **repeat**:

```jsx
<Box animate={{ duration: 600, repeat: true, reverse: true }}
     scaleX={1.15} scaleY={1.15} />   // pulses 1 ↔ 1.15 forever
```

`_AnimatedHotLayer`'s controller calls `.repeat(reverse: reverse)`
instead of `.forward()`. Still one controller, host-side, zero bridge
traffic — JS sets the endpoints once and never touches it again.

`reverse` ping-pongs; `repeat` without `reverse` saw-tooths. A
`loop: N` count caps it. Stopping is just `repeat: false` (or removing
`animate`) — the next drain reconfigures the controller.

## 6. List enter / exit — `<animatedList>` (Phase 2, shipped)

`<animatedList>` is a column whose children animate as the JS `<For>`
adds **and removes** them — a newly-inserted child fades + expands in;
a removed child collapses + fades out (`SizeTransition` +
`FadeTransition`).

**Enter — the host tracks seen ids.** `_SkalAnimatedList` keeps the set
of child ids it has already rendered; any id not in it is new → a
one-shot enter animation. The first build (the initial batch) is
exempt — a list that fully animates in on launch is noise.

**Exit — deferred teardown.** An animated exit needs the removed child
to keep rendering through its collapse, but `opRemoveNode` would tear
the `NodeState` down at once. So for a child of a `wtAnimatedList`
node the bridge **defers**:

- `opRemoveNode` detaches the child from the list's `childIds` (the
  data model is now correct) but **keeps the `NodeState` + subtree
  alive**, parked in `node.leavingChildren` (child id → removal index).
- `_SkalAnimatedList` sees the id in `leavingChildren`, flips its row's
  `_AnimatedListEntry` to `leaving` → the entry reverses its
  controller → collapse + fade.
- When the exit finishes, the host stops rendering the row (one
  `setState`, so the `SkalNode` element unmounts and drops its `cold`
  listener) and then, **post-frame**, calls `bridge.finalizeLeavingNode`
  — which runs the real `_removeSubtree`. The post-frame ordering is
  load-bearing: the element must unmount (removing its listener)
  *before* the `NodeState`'s notifiers are disposed.
- Removing the whole `<animatedList>` also tears down any
  still-leaving children (`_removeSubtree` folds `leavingChildren`
  into its DFS) — no leak.

`<animatedList>` is for short lists that mutate — for long feeds use
`<listView>` (it virtualizes; `<animatedList>` builds every row and
allocates one `AnimationController` per row).

## 7. Content cross-fade — `<crossFade>` (Phase 2, shipped)

`<crossFade>` holds one child and cross-fades when that child's node
id changes (`{cond() ? <A/> : <B/>}`). Host: `AnimatedSwitcher` keyed
by the child id.

**No deferred teardown is needed here.** `AnimatedSwitcher` *retains
the outgoing child's element* through the fade — it never rebuilds it.
So even though the bridge disposes the old child's `NodeState` in the
same drain, the retained element keeps painting its last frame as it
fades out, while the new child fades in over it. The
outgoing-node-must-survive problem solves itself because the element,
once built, is frozen (its `cold` notifier never fires again).

## 8. Shared-element (Hero) transitions (Phase 3)

```jsx
<Hero tag="avatar-42"><Image src={…} /></Hero>
```

Because `<navigator>` is backed by a *real* Flutter `Navigator`
(NAVIGATION.md), `Hero` works for free: a `<hero tag>` node wraps its
child in `Hero(tag: …)`, and when a route is pushed/popped Flutter
flies the matching-tag element between the two screens —
GPU-composited, host-side, zero bridge traffic.

Implementation is small: a `wtHero` widget (or a `propHeroTag` string
prop) → `Hero(tag: n.getPropStr(propHeroTag), child: SkalNode(child))`.
The only cost is a one-time build of the hero subtree copy Flutter
places in the flight overlay.

## 9. Staggered animations (Phase 3)

A staggered reveal is not a new primitive — it is the `animate` prop's
`delay` applied per item:

```jsx
<For each={items()}>
  {(item, i) => (
    <Box animate={{ duration: 300, delay: i() * 40 }} opacity={shown() ? 1 : 0}>…</Box>
  )}
</For>
```

A thin `createStagger(count, step)` runtime helper can hand back the
per-index delays, but the mechanism is entirely the existing
per-node controller — no wire or host work.

## 10. Physics / spring (Phase 4, shipped)

`animate: { spring: 'gentle' | 'bouncy' | 'stiff' }` gives physics-feel
motion. Skal expresses it as a spring-*like* `Curve` on the existing
bounded controller — `gentle` → `easeOutCubic`, `bouncy` →
`elasticOut` (overshoot + wobble), `stiff` → `easeOutExpo` — rather
than a true `SpringSimulation` + unbounded controller. The curve form
is allocation-identical to a normal tween and covers the UI cases
(settle, bounce). A non-zero `spring` overrides the `curve` field.

A true velocity-aware `SpringSimulation` only earns its extra
machinery (an unbounded controller, to allow overshoot past the
target) once there's gesture-driven motion to carry a fling's velocity
into — which Skal doesn't have yet. Deferred until then.

## 10a. Custom page transitions (Phase 4, shipped)

`<screen transition>` overrides a route's push animation: `1` → a
cross-fade, `2` → none (instant). Implemented by `_FadePage`, a
page-API `Page` whose `createRoute` returns a `PageRouteBuilder` with
a `FadeTransition` (or zero-duration). `0` keeps the platform default
(Material slide / Cupertino slide). The transitions run host-side on
the raster thread — see §11 rule 8.

## 11. Performance rules (cross-cutting)

1. **Zero per-frame bridge traffic.** JS sets the target once; the
   controller tweens host-side. A blocked JS thread never stutters an
   animation. This is the cardinal rule — violating it is a bug.
2. **Never `cold.notify()` per frame.** Animating a cold prop tweens
   inside a dedicated visual-wrapper widget; it must not invalidate the
   node's children subtree each frame.
3. **`RepaintBoundary` on every animated layer's child.** An animating
   `Opacity` / `Transform` / `AnimatedContainer` re-composites every
   frame; without a boundary it also re-runs the child's `paint()`.
   Every animation wrapper isolates its memoized child behind one.
4. **Per-node opt-in.** An `AnimationController` costs memory + a
   ticker. Only nodes with `animate` (or inside an `<animatedList>`)
   allocate one — a 5000-row static list pays nothing.
5. **One controller, smallest widget.** The animated layer is the
   minimal widget that can express the motion — never `setState` on
   the whole node.
6. **Coalesce.** Multiple animatable props changing in one drain →
   one controller run, not N.
7. **Offstage animations pause for free.** A controller created with a
   `TickerProvider` stops ticking when its subtree is offstage
   (`TickerMode` — a backgrounded tab or covered route). Animations on
   hidden tabs/screens cost nothing; no manual pause needed.
8. **Hero / native transitions are GPU-composited.** Page transitions
   and Hero flights run on the raster thread — they survive a busy UI
   thread, let alone a busy JS thread.

## 12. Wire additions

- Extend the `animate` config: `propAnimRepeat` (u32 bool),
  `propAnimReverse` (u32 bool), `propAnimLoop` (u32 count); a
  `propAnimPhysics` enum for Phase 4. Cold-prop tweening needs **no**
  new keys — it widens which props `_AnimatedHotLayer`'s sibling
  visual wrapper reads.
- Widget types: `wtAnimatedList`, `wtCrossFade`, `wtHero` (Phases 2–3).
- `propHeroTag` (string) — or carried on `wtHero`.
- **No new events, no bridge changes.** `<animatedList>` detects new
  items host-side (it diffs child ids against its own snapshot);
  `<crossFade>` relies on `AnimatedSwitcher` retaining the outgoing
  element. The deferred-teardown machinery (a "leaving nodes" holding
  map + `finalizeLeavingNode`) is only needed for animated list
  *removal* — a future pass.

## 13. Phases

- **Phase 1** — cold-prop tweens (`animate` widened to color / size /
  radius / padding / border / text style via `AnimatedContainer` &
  `AnimatedDefaultTextStyle`); looping / ping-pong (`repeat`,
  `reverse`, `loop`). Both are extensions of the shipped `animate`
  prop — small, no new widgets, high value.
- **Phase 2 — done.** `<animatedList>` — new rows fade + expand in,
  removed rows collapse + fade out via deferred teardown (the bridge
  parks a removed child in `node.leavingChildren` until the host's
  exit animation finishes) — and `<crossFade>` (`AnimatedSwitcher`
  with outgoing-element retention).
- **Phase 3 — done.** `<hero>` shared-element transitions (the
  navigator is a real `Navigator`, so `Hero` works directly); a
  `createStagger` runtime helper.
- **Phase 4 — done.** Physics via spring-like curves (`animate.spring`
  → `easeOutCubic` / `elasticOut` / `easeOutExpo` on the existing
  bounded controller — no `SpringSimulation` / unbounded controller);
  custom page transitions (`<screen transition>` → fade / none via a
  `_FadePage`).
- **Remaining** — a true velocity-aware `SpringSimulation` (only
  matters with gesture-driven motion, which Skal doesn't have yet).
- **Out of scope** — Lottie / Rive: vector-animation files belong on
  the codegen-wrapped custom-widget path (`<Lottie src=…>`), like the
  camera / QR widgets — not a core animation primitive.
