# Components — the fast-path layer

The hand-coded core primitives (`<Column>`, `<Row>`, `<Text>`,
`<ListView>` …) that cross the bridge as first-class wire ops, distinct
from the codegen-wrapped pub.dev widgets.

For the codegen pipeline that wraps third-party packages see
[`WRAPPING_PUB_PACKAGES.md`](WRAPPING_PUB_PACKAGES.md). For platform
plumbing and open codegen items are tracked outside this repo.

---

## 1. Three layers, not one

A Flutter widget reaches JSX through exactly one of three layers.
Picking the right layer per widget IS the plan.

| Layer | Mechanism | For | Cost per widget |
|---|---|---|---|
| **Fast-path** | wire op + `_buildX` in `root.dart` | hot, structural, on-most-screens primitives | builder + web styler (+ schema line) |
| **Codegen adapter** | `wtCustom` + `SkalRegistry` | third-party / controller-driven widgets | `flutter pub get` + marker line + `build_runner` |
| **Imperative API** | event-ring call, not a tree node | dialogs, sheets, snackbars, toasts | a JS API surface |

This doc is **only about the fast-path layer**.

## 2. The ~250 → ~30 collapse

Flutter ships ~250+ public widgets across `widgets` / `material` /
`cupertino`. They are NOT 250 fast-path candidates. They collapse:

- **~25–30** real leaf/structural widgets → fast-path (this doc).
- **~25** `Animated*` / `*Transition` widgets → ONE feature: an
  "animate props on change" prop system. Not 25 widgets.
- **~12** `Sliver*` → advanced-scrolling concern. Deferred.
- **~30** InheritedWidgets / builders / focus / shortcuts / semantics
  → framework plumbing the renderer handles internally. Not
  "components" in the JSX sense.
- **~20** Cupertino → mostly duplicates Material; a theme/variant
  decision, not separate widgets → implementation plan in §10.1.
- Dialogs / sheets / overlays → imperative layer, not tree nodes →
  implementation plan in §10.2.

End state: **~30 fast-path primitives + a few prop systems
(animation, gestures, styling) + an imperative overlay API.**

## 3. The wire-schema drift risk

Adding one fast-path widget today = **6–7 synchronized edits across
two languages**: `wire.dart`, `bridge.js`, `renderer.js`,
`root.dart` (dispatch + builder), `renderer-web.js` (×2). A
`wtX=8` / `WT_X=8` mismatch is *silent memory corruption*, not a
compile error. `TODO.md` already flags both the missing
cross-language constant test and the single-source schema idea.

Before adding the widgets below:

- **Minimum:** a cross-language constant-equality test — parse
  `wire.dart` + `bridge.js`, assert every `wt*`/`WT_*` and
  `prop*`/`PROP_*` literal agrees. Kills the silent-corruption class.
- **Better (do this first):** a single schema file listing widgets +
  props. A generator emits the constants in `wire.dart`, the exports
  in `bridge.js`, the `TAG_TO_WIDGET` map, the `TAG_TO_HTML`
  skeleton, and the equality test. Adding a widget then drops to
  **2 edits**: the Flutter `_buildX` builder and the web CSS styler
  (the only parts that are real logic).

Everything below assumes this is done — that is why "effort" is small.

## 4. What exists today

49 widget types cross the bridge as first-class ops. The wire is the
source of truth — `packages/skal_flutter/lib/skal/wire.dart`:

**Layout** `Box` · `Column` · `Row` · `Stack` · `Wrap` · `SafeArea`
· `BackdropFilter`

**Scrolling** `ScrollView` · `ListView` · `LazyGrid` · `PageView`
· `ReorderableListView` · `CustomScrollView` · `SliverList`
· `SliverGrid` · `SliverAppBar`

**Text and media** `Text` · `RichText` · `Image` · `Canvas`
· `HtmlEmbed`

**Input** `Button` · `TextInput` · `Switch` · `Slider` · `Checkbox`
· `Radio` · `Chip` · `Dropdown` · `SegmentedButton` · `Stepper` · `Step`

**Structure** `ListTile` · `ExpansionTile` · `Drawer` · `BottomSheet`
· `Tabs` · `Tab` · `Navigator` · `Screen`

**Feedback** `ActivityIndicator` · `ProgressBar`

**Motion and gesture** `AnimatedList` · `CrossFade` · `Hero`
· `Dismissible` · `InteractiveViewer` · `DragItem` · `DropZone`

**Escape hatch** `Custom` — the codegen-wrapped pub.dev path.

**Not on the wire:** `icon`. Everything else once queued here has
shipped. Icons currently come through text glyphs or a wrapped package;
a first-class `<Icon>` needs a codepoint + font-family prop pair and a
curated name→codepoint map.

## 5. Props, not widgets

Each of these as a widget = an extra node crossing the bridge per
use — against the "RN but faster" thesis. Implement as props on
existing widgets instead.

| Want | Implement as | Replaces |
|---|---|---|
| tap / long-press / double-tap | `onTap`/`onLongPress`/`onDoubleTap` behavior props on `box` (tier 0xA0–0xA2) | `<pressable>`, `<gestureDetector>`, `<touchable*>` |
| horizontal scroll | `axis` prop on `listView`/`scrollView` | `<lazyRow>` |
| card look | `elevation`/`shadow` visual prop on `box` | `<card>` |
| centering / padding / sizing | already props (`propAlignment`, `propPadding*`, `propWidth/Height`) | `<center>`, `<padding>`, `<sizedBox>` |
| flex weighting | already `propWeight` | `<expanded>`, `<flexible>`, `<spacer>` |
| opacity / transform | already hot props | `<opacity>`, `<transform>` |
| aspect ratio | `aspectRatio` prop | `<aspectRatio>` |
| tooltip | `tooltip` string prop on `box` | `<tooltip>` |
| visibility | `visible` prop | `<visibility>` |
| divider | thin `box` (height + bg) | `<divider>` (optional convenience) |

## 6. Prop systems (one feature each, not many widgets)

- **Animation** — the `Animated*` / `*Transition` family (~25
  widgets) collapses to one "animate props on change" system: a
  per-widget `animate` prop + duration/curve → implementation plan
  in §10.3.
- **Gestures** — the `onTap*` behavior props above.
- **Styling** — decoration / border / shadow / radius props on `box`
  (mostly landed; `_applyColdVisual` in `root.dart`).

## 7. Not fast-path — leave to codegen / imperative

- **Codegen adapters** (`wtCustom`): `video`, `webview`, `map`,
  charts, `camera`, date/time pickers, animation packages.
- **Imperative JS API** (event ring, not tree nodes): dialogs,
  modals, snackbars, bottom sheets, toasts.
- **Framework internals** (renderer handles): InheritedWidgets,
  builders, `MediaQuery`, focus / shortcuts / semantics.
- **Deferred**: `Sliver*` advanced scrolling.

## 8. Design notes

Kept for the rationale, not as a queue — the dialog API and the
`animate`-on-change prop system below have both shipped, and Cupertino
variants are wired (`dialogs.dart`, `root.dart`). Read these for *why*
each is shaped the way it is.

Three subsystems from §2 that are NOT widget waves — they run in
parallel with §9.

### 8.1 — Cupertino as a design variant

**Current state.** App shell is `MaterialApp` + a static
`ThemeData.light(useMaterial3: true)` (`main.dart:174`). No dark
mode, no platform branch. Control builders read color straight from
wire props (`_buildButton` reads `propBgColor`/`propFgColor`);
structural builders are platform-agnostic already.

**Key insight.** Cupertino is NOT ~20 new widgets — it is a switch
inside ~8 *control* builders. `box`/`column`/`row`/`text`/`stack`/
`image`/`wrap`/`lazyGrid` are pixel-identical either way.

**Design.** A global `SkalDesign` mode — `material | cupertino |
adaptive` (`adaptive` resolves via `defaultTargetPlatform`).
Brightness (`light | dark`) rides the same config — free dark mode.

**Changes.**
1. Design-mode + brightness state — a root-config field set from JS
   (new root-config wire op, or a startup-manifest field).
2. App shell — keep `MaterialApp` (it provides Navigator,
   `Directionality`, the `Material` ancestor `InkWell` needs); add a
   `CupertinoTheme` wrapper above the Skal tree so Cupertino widgets
   theme correctly.
3. Variant switch in the ~8 control builders: `_buildButton` →
   `CupertinoButton` vs `ElevatedButton`; same for `switch`,
   `slider`, `activityIndicator`, `progressBar`, scrollbar, and
   future `textInput`.
4. **Theme-default fallback** — where a builder hardcodes a constant
   (e.g. `_buildText` defaults fg to `0xFF000000`), read
   `Theme.of(context)` / `CupertinoTheme.of(context)` when the prop
   is unset. This is the real "theme" plumbing and what makes dark
   mode actually work.
5. Web — root gets a `data-design` attribute; `renderer-web.js` CSS
   variants. Lower priority.

**Phases.** P1: mode/brightness state + shell + button/switch/slider
variant. P2: theme-default fallbacks (unlocks dark mode). P3: web.
**Effort: M.**

### 8.2 — Imperative dialog / sheet / overlay API

**Current state.** RPC fully works: `invokeMethod(nodeId, method,
args)` → `OP_INVOKE_METHOD(nodeId, methodHash, callId)` → the node's
`methodDispatcher` → reply via the reply heap + `EV_METHOD_REPLY`,
correlated by `callId` in `pendingCalls`. **Async Futures already
resolve** — a Dart dispatcher returning a `Future` resolves the JS
`Promise` on `.then`. *Gaps:* dispatch is per-node (no app-level
dispatcher); no root `BuildContext`/Navigator handle for a
context-free `showDialog`.

**Design.** `import { showDialog, showActionSheet, showSnackbar,
showBottomSheet } from 'skal-flutter'`. Calls reuse the entire
existing RPC + reply machinery — no new wire op.

**Changes.**
1. Global dispatcher — reserve a sentinel node id (the root, id 0)
   and register an app-level `methodDispatcher` handling
   `showDialog` etc. Reuses `OP_INVOKE_METHOD` as-is.
2. Context handles — add `navigatorKey: GlobalKey<NavigatorState>`
   and `scaffoldMessengerKey` to `MaterialApp`; Dart-side dialog
   code uses `navigatorKey.currentContext!`.
3. **Phase 1 — declarative content.** JS passes a spec
   `{title, message, actions: [{label, value, style}]}`. Dart builds
   a stock `AlertDialog` / `CupertinoAlertDialog` (variant from
   §10.1). Promise resolves with the chosen action's `value`;
   barrier-dismiss resolves `null`. Covers ~90% (alert / confirm /
   action sheet). Free extras: `showDatePicker` / `showTimePicker`
   (imperative in Flutter anyway).
4. JS module — `showDialog`/`showActionSheet`/`showBottomSheet`/
   `showSnackbar` build the args payload, call the global-dispatch
   RPC, return the Promise.
5. **Phase 2 — Skal-tree content.** Dialog body = a JS-built Skal
   subtree not mounted in the main tree, hosted via
   `SkalNode(nodeId)`. Needs off-tree subtree rendering. Separate,
   larger.

**Edge cases.** Stacked dialogs; barrier dismiss → resolve `null`;
reentrancy.
**Effort:** P1 = M (machinery exists). P2 = L.

### 8.3 — "Animate props on change" prop system

**Current state.** Hot props (`opacity`, `translationX/Y`,
`scaleX/Y`, `rotationZ`) — 6 plain doubles on `NodeState`, one `hot`
notifier, rendered by `_HotLayer` (`Transform` + `Opacity`). Updated
imperatively by JS per-frame via the op ring. **No
`AnimationController` / `Tween` / `Ticker` anywhere in the runtime.**
Cold props rebuild via the `cold` notifier.

**Design.** A node carries an optional `animate` spec; when set, a
prop change *tweens* instead of snapping. **The tween runs in Dart**
(a `Ticker` / `AnimationController`), not JS — zero per-frame bridge
traffic. This is exactly why Flutter's implicit-animation widgets
exist; it unifies the ~25 `Animated*` / `*Transition` widgets into
one prop.

**Changes.**
1. Wire — a new animation prop tier: `propAnimDuration` (u32 ms),
   `propAnimCurve` (u32 → curve table), `propAnimDelay`.
   `duration > 0` ⇒ the node is animated.
2. Curve table — enum index → `Curves.X` (linear, easeIn/Out/InOut,
   bounce, elastic…).
3. `NodeState` — an `AnimSpec` field + a lazy `AnimationController`;
   disposed in `NodeState.dispose()`.
4. **Phase 1 — hot-prop animation.** `_HotLayer` → a stateful
   `_AnimatedHotLayer` with `SingleTickerProviderStateMixin`. On a
   `hot` notify with an anim spec: capture the current rendered
   values as `from`, set the new `to`, `controller.forward(from: 0)`,
   interpolate per frame. Replaces `AnimatedOpacity` /
   `AnimatedScale` / `AnimatedSlide` / `Fade|Scale|Slide|Rotation
   Transition`.
5. **Phase 2 — cold-prop animation.** The `_applyColdVisual` / size
   path becomes implicitly-animated — tween color / cornerRadius /
   border / width / height / padding. Lean on Flutter's own
   `AnimatedContainer` / `TweenAnimationBuilder` where props map
   cleanly. Replaces `AnimatedContainer` / `AnimatedPadding` /
   `AnimatedAlign` / `DecoratedBoxTransition`.
6. **Phase 3 — enter / exit animation.** Fade/scale on insert; on
   remove the node must stay alive until the exit anim completes —
   needs renderer/bridge cooperation to *defer node destruction*.
   `AnimatedSwitcher` / `AnimatedList` territory. Separate, larger.
7. JS side — an `animate={{duration, curve, delay}}` JSX prop; the
   renderer writes the anim props.

**Effort:** P1 = M, P2 = M, P3 = L.

## Web-renderer reminder

Every fast-path widget needs its `renderer-web.js` side too
(`TAG_TO_HTML` + `applyDefaults` CSS + `applyProp`). The schema
codegen generates the tag mapping; the CSS baseline stays
hand-written. Forgetting it is a silent web-only bug.

## The analyzer constraint

`skal_codegen` pins `analyzer: ^7.0.0` while the current release is 14.x.
That is not neglect — the two ends are pinned against each other:

| | |
|---|---|
| Flutter 3.41.9 + analyzer ^7 | works — what ships today |
| Flutter 3.47.0 + analyzer ^7 | fails — `Missing implementation of visitDotShorthandPropertyAccess`; the new Dart emits AST nodes analyzer 7 cannot serialize |
| Flutter 3.41.9 + analyzer ^14 | fails — analyzer ≥13.1 needs `meta ^1.18.3`, `flutter_test` pins `meta 1.17.0` |
| Flutter 3.47.0 + analyzer ^14 | untested — needs the Flutter bump to verify |

So the migration cannot land on its own. It has to move with the Flutter
pin in `.github/workflows/*` (see the `unpin-flutter` note in tests.yml).

**The migration itself is small** — measured, not estimated. It is a
rename, because analyzer 7 carried a transitional element model and v14
simply dropped the suffixes:

    element2.dart -> element.dart        .element3      -> .element
    ClassElement2 -> ClassElement        .libraryElement2 -> .libraryElement
    ConstructorElement2 -> ConstructorElement            .name3 -> .name
    ExecutableElement2  -> ExecutableElement
    LibraryElement2     -> LibraryElement
    .methods2 / .fields2 / .getters2 / .constants2 / .constructors2 /
    .typeParameters2 / .library2 / .libraryImports2 /
    .redirectedConstructor2 / .importedLibrary2   -> drop the 2

One real semantic change, not a rename: `FieldElement.isSynthetic` is
gone. Its replacement is `!isOriginDeclaration` — v14 splits a property's
origin into `isOriginDeclaration` (an explicit `FieldDeclaration`) and
`isOriginGetterSetter` (induced by a getter/setter).

A trial run took 124 lib/ errors to 0 and left all 42 tests passing. The
snapshot fixtures shift, but only because `build ^4` pulls a newer
`dart_style`: blank lines between imports and one rewrapped expression.
Stripped of whitespace the generated output is byte-identical, so
regenerate with `SKAL_UPDATE_SNAPSHOTS=1` rather than hand-editing.
