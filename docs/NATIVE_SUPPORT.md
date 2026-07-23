# Native capability support — status and roadmap

What a Skal app can reach natively **today**, what it can't, and the
shortest path to "any Flutter package, with little or no glue."

For the *how-to* of wrapping a package, see
[WRAPPING_PUB_PACKAGES.md](WRAPPING_PUB_PACKAGES.md) (patterns A–D).
This doc is the status ledger and the design work still outstanding.

## TL;DR

- **Widget-shaped packages work.** Camera ships in `examples/kitchen-sink`.
  `flutter_map` was wired and **rendered on macOS** — see
  [Verified: flutter_map](#verified-flutter_map-renders).
- **Headless native services already work — no widget, no fork.**
  Verified end-to-end: ~12 lines in the app's own `main.dart` exposes
  native methods to JS, with string args and string/JSON-object returns.
  See [Verified: headless services](#verified-headless-services-work-today).
- **The transport is not the blocker.** The RPC channel carries strings,
  JSON objects (both directions, since S2), streams, and errors.
- **A1 + A2 have landed.** `registerService` on the Dart side,
  `createSkalService` on the JS side, and a `services:` key in
  `skal_codegen.yaml` that wraps a class's static methods with no
  hand-written Dart at all. Proven on macOS with clipboard + haptics.
- **Performance is the design constraint, not an afterthought.** The
  five benchmarks are **done** (macOS, 60 Hz) and they changed the plan:
  a one-shot RPC costs **one frame (16.67 ms)** regardless of payload,
  JSON is free below ~64 KB, and streams run 5,700× faster than
  sequential awaits. See [performance contract](#performance-contract).
- **The type mapper's gaps are closed.** Lists of value classes (B5),
  generics (B6), builder callbacks (B2), opaque handles (A3) and the
  escape valves (B4) have all landed. `flutter_map`'s `MarkerLayer`,
  `PolygonLayer`, `PolylineLayer` and `CircleLayer` — the four the last
  audit named — now generate and compile.
- **What's left is design, not plumbing**: permissions is still
  unmodeled and gates half the capability list, and B3's factory route
  is unbuilt.

## Capability status

Ranked by how often a real app needs them.

### Widget path — `skal_codegen` handles these

| # | Capability | Package | Status |
|---|---|---|---|
| 1 | Camera | `camera` (`CameraPreview`) | ✅ **Built & shipping** — kitchen-sink; `camera_avfoundation` integrated on iOS |
| 2 | Map | `flutter_map` | ✅ **Verified on macOS** — map, tiles, and (since B5+B6) `MarkerLayer`, `PolygonLayer`, `PolylineLayer`, `CircleLayer` |
| 3 | WebView (OAuth, embeds) | `webview_flutter` | 🟢 Codegen-ready, untried |

Same recipe, untried: video (`video_player`), QR/barcode
(`mobile_scanner`), charts (`fl_chart`).

### Imperative path — works today via the root dispatcher, needs ergonomics

| # | Capability | Package | Note |
|---|---|---|---|
| 4 | Permissions | `permission_handler` | ✅ Design settled (S5): a service + `skal-permissions.json` for platform config. Note the package has **no macOS support** |
| 5 | Geolocation / GPS | `geolocator` | exercises object returns **and** streams |
| 6 | Push + local notifications | `firebase_messaging`, `flutter_local_notifications` | |
| 7 | Image / file picker | `image_picker`, `file_picker` | returns `XFile` |
| 8 | Secure storage / keychain | `flutter_secure_storage` | |
| 9 | Share sheet | `share_plus` | |
| 10 | Haptics / vibration | *Flutter SDK* | ✅ **Shipping** in kitchen-sink's `device` service — ⚡ zero deps |
| 11 | Clipboard | *Flutter SDK* | ✅ **Shipping** in kitchen-sink's `device` service — ⚡ zero deps |
| 12 | Biometrics (Face/Touch ID) | `local_auth` | |

**3 of 12 are widgets. 9 are not.** That ratio is the whole roadmap.

## What exists today

### Tier 1 — native rendering
~52 components compile to real Flutter widgets. No DOM, no WebView.
Virtualized `ListView` (O(visible) at 1M rows), native push/pop
navigation, host-side 60/120fps animation, `Canvas`, drag-and-drop,
`BackdropFilter`, `InteractiveViewer`, slivers.

### Tier 2 — built-in platform services
Six methods, in `packages/skal_flutter/lib/skal/dialogs.dart`:

`showDialog` · `showActionSheet` · `showSnackbar` · `showDatePicker` ·
`showTimePicker` · `getDataDir`

Plus `createSkalStore` (`skal/store`) — a deep reactive proxy that
auto-persists to disk.

### Tier 3 — `skal_codegen`
Walks a pub package, detects `Widget` subclasses, emits adapters into
`skal_codegen.g.dart`. `registry.dart` puts coverage at **~70% of
Flutter packages**. `registerWidget()` / `registerValue()` are the
runtime dispatch tables; `hosts:` covers controller-owning widgets
(camera) via a dev-written factory.

## What actually crosses the bridge

| Direction | Supported |
|---|---|
| **JS → Dart method args** (`_writeMethodArgs`, `bridge.js`) | int, double, bool, **string**, **objects + arrays as JSON** (~768 KiB heap). `null`/functions → `VOID` |
| **Dart → JS returns** (`bridge.dart:1391`) | int, double, bool, **string**, **any `jsonEncode`-able object** (the wire doc names `XFile`), void |
| **Streams** | `ref.foo$(cb)` → Dart `Stream<T>`, with unsubscribe |
| **Errors** | `_writeMethodError` → Promise rejects with the message |

Nothing asymmetric is left. Object arguments used to drop to `VOID`,
forcing every caller into a `JSON.stringify` workaround; `eventArgJson`
on `opMethodArg` (S2) closed that. The built-in dialog API deliberately
STAYS on the string shape: JS hot reload pairs new bundles with old
hosts routinely, and an old host decodes an object arg as null — every
dialog would render empty, silently. New APIs (services) use object
args freely; no older host ever dispatched them.

The `createSkalRef` JSDoc used to claim string and object returns were
"deferred" and that string args passed as `VOID` — both were false and
had been for some time. Corrected.

## Why it looks blocked (and isn't)

The documented imperative API is **node-anchored**: `createSkalRef()`
requires a mounted, codegen-generated host widget, or the Promise
rejects with `status 2` (no dispatcher registered). Nine of the twelve
capabilities above are headless services with no widget to mount — so
the obvious read is that they're unreachable. They aren't.

**But nodeless RPC already works.** From `dialogs.dart:4-10`:

> "Dialogs are **not tree nodes** — they are an imperative surface. JS
> calls `showDialog(spec)`… those cross the bridge as **RPC method
> invocations on the ROOT node**, handled by the app-level dispatcher…
> the whole transport (callId correlation, the reply heap, async
> Futures) is the existing host-RPC machinery — **this file only adds a
> new consumer of it**."

The only thing between that and `geolocator` was that
`bridge.rootDispatcher` was a hardcoded six-case `switch` instead of a
registry. It is a registry now — see A1 below.

## Verified: headless services work today

**Both halves of the nodeless path are already public.** JS side:
`invokeMethod(nodeId, name, args)` and `ROOT_NODE_ID` are exported from
`skal/bridge` (`bridge.js:1552`, `:1932`) — that is exactly how
`showDialog` is implemented. Dart side: `SkalBridge.rootDispatcher` is a
public mutable field (`bridge.dart:166`), and apps own their `main.dart`.

Tested end-to-end on macOS by wrapping the dispatcher in a scaffolded
app's `main.dart`:

```dart
final base = bridge.rootDispatcher;
bridge.rootDispatcher = (String method, List<Object?> args) {
  switch (method) {
    case 'ping':       return 'pong from Dart';
    case 'deviceInfo': return {'platform': Platform.operatingSystem, 'answer': 42};
    case 'echo':       return 'echo:${args.first}';
    default:           return base!(method, args);
  }
};
// REQUIRED at the time — installAppDispatcher also attached the OLD
// closure to the root NODE, so without re-attaching, the new methods
// silently never fired.
bridge.nodes[kRootNodeId]?.methodDispatcher = bridge.rootDispatcher;
```

```jsx
import { invokeMethod, ROOT_NODE_ID } from 'skal/bridge';
await invokeMethod(ROOT_NODE_ID, 'ping', []);                 // 'pong from Dart'
await invokeMethod(ROOT_NODE_ID, 'deviceInfo', []);           // object, auto-parsed
await invokeMethod(ROOT_NODE_ID, 'echo', ['hello-from-js']);  // string arg in
```

**Do not copy the snippet above** — it is the archaeology, not the API.
The re-attach line is no longer needed (`rootDispatcher`'s setter does
it), and monkey-patching the dispatcher at all is obsolete. Write this
instead:

```dart
registerService('demo', (method, args) {
  switch (method) {
    case 'ping': return 'pong from Dart';
  }
  throw 'demo: unknown method "$method"';
});
```

```jsx
const demo = createSkalService('demo');
await demo.ping();
```

Actual output:

```
[SVC-TEST] ping=pong from Dart
[SVC-TEST] deviceInfo={"platform":"macos","answer":42}
[SVC-TEST] echo=echo:hello-from-js
[SVC-TEST] typeofDeviceInfo=object
```

**Conclusion:** `geolocator`, `share_plus`, `local_auth` et al. are
usable *today* with ~12 lines of app-side Dart. Roadmap A is therefore
**ergonomics, not enablement**.

Two papercuts found, both worth fixing regardless of A1:

1. The template `main.dart` imports fine-grained subfiles and **not**
   `skal/wire.dart`, so `kRootNodeId` is undefined — a build error the
   moment you try this. Add the import (or export it from the barrel
   the template already uses).
2. The re-attach line above is a silent-failure trap. Reassigning
   `rootDispatcher` alone appears to work and does nothing.

## Verified: flutter_map renders

Wired into `examples/kitchen-sink` (pubspec + one `skal_codegen.yaml`
line + `build_runner`), rendered on macOS, then reverted.

**What wrapped cleanly:** `FlutterMap`, `TileLayer`, `Scalebar`,
`MobileLayerTransformer`, `TranslucentPointer`, `RotatedOverlayImage`,
`TextSourceAttribution`, `LogoSourceAttribution`, `PositionedTapDetector2`.
Emitted helpers included `_skalParseMapOptions`, `_skalParseLatLng`,
`_skalParseInteractionOptions`, `_skalParseWMSTileLayerOptions`. The
generated adapter compiles (2 cosmetic `unnecessary_cast` warnings).

```jsx
import { Box } from 'skal';
import { FlutterMap, TileLayer } from 'skal-flutter';   // ← NOT 'skal'

<Box height={520} width="fill">
  <FlutterMap options={{ initialCenter: { latitude: 38.72, longitude: -9.14 },
                         initialZoom: 12, maxZoom: 19 }}>
    <TileLayer urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
               userAgentPackageName="your.bundle.id" />
  </FlutterMap>
</Box>
```

Result: `nodes=6`, no exceptions, no overflow. (macOS needs
`com.apple.security.network.client` for OSM tiles — `skal-link.sh`
already grants it.)

### Trap: custom widgets ignored `BaseProps`. ✅ Fixed (S3).

Built-ins accept `width` / `height` / `padding`. Codegen'd widgets used
to pass only the constructor's own params plus children, so
`height={520}` on a `<FlutterMap>` was silently dropped; the map went
unbounded inside a `Column`, which produced:

```
A RenderFlex overflowed by 99477 pixels on the bottom.
Unhandled Exception: Unsupported operation: Infinity or NaN toInt
  at _TileLayerState._loadAndPruneInVisibleBounds
```

Generated adapters now wrap in `_skalApplyBaseProps`, which applies
`SizedBox` / `Padding` **only when the prop is actually present** —
two null-map lookups when it isn't. A widget that declares its own
`padding` (or `width`/`height`) parameter keeps it; the wrapper is told
which names the widget already owns so nothing is applied twice.
`width="fill"` maps to `double.infinity`, matching the built-ins.

### Real skip list (empirical B-series evidence)

From the actual `build_runner` run:

| Widget | Rejected because |
|---|---|
| `MarkerLayer` | `List<Marker>` — **list of value classes** |
| `OverlayImageLayer` | `List<BaseOverlayImage>` — list of an **abstract** base |
| `OverlayImage` | `LatLngBounds` |
| `PolygonLayer`, `PolylineLayer` | **generic widget class** (`<R>`) — see B6 |
| `Tile` | `TileImage` |
| `MapInheritedModel` | `MapCamera` |

`MarkerLayer` is the headline miss — **markers are the single most-used
map feature**, and it fails on `List<Marker>`, a list of an otherwise
perfectly mappable value class. Lists-of-value-classes deserve their own
slice; it is not exotic.

The warnings are good (they name widget, param, type, and the fix) but
they are build-log only — hence the skip manifest in B4.

## Performance contract

Perf-first review findings (2026-07-21). These govern both roadmaps.
The transport is not the risk — shared memory with no platform-channel
serialization tax is the moat. The risk is what the *generators* emit
on top of it.

### Measured, 2026-07-21 — the five numbers

**Done.** Harness lives in `examples/virt-bench` (`src/rpc-bench.js` +
`flutter-host/lib/bench_service.dart`) and is reproducible with
`bun run build:js-only && cd flutter-host && flutter run -d macos`.
Full distributions: [BENCHMARKS.md § Bench 4](BENCHMARKS.md). macOS
debug build, 60 Hz.

| # | Question | Answer |
|---|---|---|
| 1 | RPC round-trip latency | **p50 16.67 ms — exactly one frame**, any payload. Batched: 0.084 ms amortized. 10 chained awaits: **163 ms** |
| 2 | JSON encode/decode cost | Invisible below ~64 KB. First visible at a 241 KB round-trip, and it costs one extra frame |
| 3 | Stream throughput | 477k/s bare int · 131k/s at 256 B JSON · 14k/s at 4 KB JSON |
| 4 | Reply heap | 256 KiB exactly; oversize replies **truncate silently**. Wraparound cheap (no spin-wait observed) |
| 5 | Coalescing | **Unbounded queue** — 3,000/3,000 delivered through a slow handler. Nothing drops, nothing coalesces |

The doc's own prediction — *"ten chained awaits ≈ 160 ms"* — measured
at 163.35 ms. That was the right thing to worry about, and it is worse
than the JSON question everyone else would have asked first.

### Rate classes — revised by the measurement

The pre-measurement worry was JSON on high-frequency streams. That was
wrong on both halves: JSON is free at realistic sizes, and streams ride
a single drain so they are the *fast* path. The real cliff is **call
count on the one-shot path**.

| Tier | Rate | Contract |
|---|---|---|
| One-shot RPC | human-paced | JSON fine. **Batch anything issued together** — each `await` is a frame |
| Low-rate stream | ≤ ~10 Hz (GPS, battery, connectivity) | JSON per event, with margin to spare |
| Frame-rate | ≥ 60 Hz (sensors, per-frame callbacks) | A *stream* is fine. A per-frame `await` cannot beat one frame per call, by construction |

So the generator's job is not "refuse to wrap fast things." It is:
**never emit an API whose natural use is a chain of awaits.** A service
returning three values returns them in one call, or as a stream —
not as three methods a caller will await in sequence. The contract is
documented, not mechanically enforced — an earlier `assertRateClass`
shim claimed to be the enforcement point while nothing called it, and
a fictional guard is worse than none.

### Payload law

**Bulk bytes never cross the bridge — paths and handles, not
payloads.** Not a preference: a reply over 256 KiB is truncated
silently, measured (270,336 B in → 262,144 B out, no error). `XFile`
already conforms (camera / image_picker return a *path*). Never base64
a photo into the reply heap. Region sizes are now recorded as budget
invariants in [PERFORMANCE.md](PERFORMANCE.md).

### Cold-path rule

Custom-widget JSON props (`options` on `<FlutterMap>`) are parsed on
*change*, not per frame — config-time cost only, and prop-write dedup
(`propSkips`) already skips unchanged strings. Corollary:
**frame-rate mutation of custom-widget props from JS is forbidden** —
that is what imperative methods and host-side animation are for (same
doctrine as ANIMATION.md).

### The finding worth acting on separately

16.67 ms of the 16.67 ms round-trip is scheduling, not work — the op
ring drains once per frame from `root.dart`'s Ticker, so a call written
just after a pump waits a full vsync. Filed as
[PERFORMANCE.md § Pending 1b](PERFORMANCE.md). It needs a design (the
current ordering is what gives same-frame rebuilds), not a patch, and
it must not be "fixed" with a short timer.

### Already right (keep it that way)

A3 handles avoid serialization entirely — the most perf-positive item
in the plan. Streams push rather than poll. Prop writes dedupe.
Don't regress any of these for ergonomics.

## Roadmap A — headless services

**A1. Open the dispatcher. ✅ Landed.**
`registerService(name, dispatcher)` in
`packages/skal_flutter/lib/skal/services.dart` replaces the hardcoded
six-case switch, mirroring `registerWidget` / `registerValue`. JS gets
`createSkalService('geo')` (`skal/runtime`) — the same Proxy shape as
`createSkalRef`, targeting a service namespace instead of a mounted
node. Method names go over the wire namespaced (`geo.getCurrentPosition`);
**the wire format did not change at all.**

`bridge.rootDispatcher` is now a setter that re-attaches to the root
node, so the silent-no-op trap is gone and app code never needs
`kRootNodeId`. Both papercuts closed.

**S2 landed with it:** `opMethodArg` carries `eventArgJson`, so object
and array arguments reach a dispatcher as real `Map`s and `List`s
instead of dropping to `VOID`. The built-in dialog API deliberately
keeps the `JSON.stringify` string shape — the one every host version
can decode — because JS hot reload routinely runs a new bundle against
an old host; services, which no old host ever dispatched, use object
args freely.

**A2. Codegen `services:` for static methods. ✅ Landed.**
`hosts:` needs a factory *because constructors can't cross the bridge*.
Most service plugins are **static** — `Geolocator.getCurrentPosition()`,
`Share.share()`, `Clipboard.setData()` — so no factory is needed:

```yaml
# skal_codegen.yaml
services:
  - geolocator                    # class inferred: Geolocator
  device:                         # or spell it out
    package: kitchen_sink
    class: DeviceService
```

```jsx
const geo = createSkalService('geolocator');
const pos = await geo.getCurrentPosition();        // JSON object back
const stop = geo.positionStream$(p => setPos(p));  // Stream<Position>
```

Dart written by the dev: **none.**

Arguments are rebuilt by the same value-class encoder that reconstructs
JSON widget props. Returns pass through when `jsonEncode` can already
see them (primitives, Maps, Lists, anything with a `toJson()`); for a
class without one, codegen emits a getter-walking encoder. `Future<T>`
becomes `.then(...)`, `Stream<T>` becomes `.map(...)`. A method that
fails either check is dropped **by name, with a reason**, and the rest
of the service still ships.

Shipping proof: `examples/kitchen-sink` declares a `device` service over
clipboard + haptics — capabilities #10 and #11, zero pub dependencies.
Verified on macOS: `copy` → `paste` round-trips through the real system
clipboard, an unknown method rejects with a legible error, and two
batched calls cost 17.6 ms against 43.8 ms for three sequential ones —
independently reproducing [Bench 4](BENCHMARKS.md).

**Web (S1) is wired:** `registerWebService(name, impl)` lets a browser
target answer with `navigator.clipboard` / `navigator.geolocation`
directly. A registered web impl wins in any browser context — including
Flutter Web, where routing through the Dart runtime would pay a copy on
its emulated shared buffer. With no web impl and no native bridge, the
call rejects naming the fix instead of hanging.

**A3. Opaque handles. ✅ Landed.** For APIs returning stateful objects
(`CameraController`, subscriptions, DB connections), don't serialize —
keep the object Dart-side and give JS an integer that names it. This is
how JNI and PyObjC bridge arbitrary object graphs, and it is what takes
coverage past the widget ceiling. Zero serialization in either
direction, so it is also the most perf-positive item in the plan: an
int arg was already a supported wire type, meaning **no new transport
at all**.

`packages/skal_flutter/lib/skal/handles.dart`. Codegen reaches for it
**last** — a type that can be serialized should be, because a
serialized value needs no lifetime management and a handle does. What
used to be a dropped method is now a working one:

```jsx
const cam = await camera.open();          // { $skalHandle: 7, $type: 'CameraController' }
try { await camera.takePicture(cam); }
finally { await handles.release(cam); }
```

JS sees a self-describing object rather than a bare int, because "why
is this API returning 7" is a question nobody should have to ask;
arguments accept either form.

**Lifetime is explicit, and that was the open question.** JS holds a
number, so Dart cannot know when it becomes garbage. A
FinalizationRegistry would tie native resource release to GC timing —
nondeterministic, and for a camera or a file lock that is a bug, not a
latency detail. So whoever takes a handle releases it, via the built-in
`handles` service. `release` calls `dispose()` when the object has one,
double-release is a no-op (crashing on it turns a small confusion into
a dead app), and ids are never reused so a stale handle fails to
resolve rather than addressing whatever landed in the recycled slot.

## Roadmap B — making unmappable types mappable

Where the mapper bails today (`packages/skal_codegen/lib/src/type_mapper.dart`):

| Line | Rejects |
|---|---|
| `:884` | abstract classes |
| `:896`, `:1216` | "stateful" classes — has `dispose()`, stateful mixin, or non-final fields (i.e. every controller) |
| `:895` | `Widget` subclasses as value params (deliberate — they belong as child nodes) |
| `:876`, `:902` | depth > 8, cyclic types |
| `:917` | factory-only constructors |
| `:940-942` | **one unmappable required field nulls the whole value class** |
| `:757` | everything else → widget skipped entirely |

Callbacks map only when the return type is `void`
(`_valueChangedTypeArg`, `_isMultiArgCallback`).

### B1. Subtype unions — generalize `Gradient`. ✅ Landed.

`Gradient` is already handled by `_skalParseGradient`, which *"switches
on `m['type']`, constructs the right concrete subtype, defaults to
LinearGradient on missing/unknown."* That is a **discriminated union
over an abstract base — hand-written for exactly one type**, while
`:884` rejects every other one: `ShapeBorder`, `ScrollPhysics`, `Curve`,
`Decoration`, `ImageFilter`, `BorderSide`, `TileProvider`,
`SliverGridDelegate`…

Generalized: when a param's type is abstract, codegen enumerates its
concrete subclasses in the analyzed library set and emits a
`$type`-discriminated parser. Each concrete subtype's constructor was
*already* mappable by the value-class encoder — this only added a
dispatch layer above it.

Discriminator policy, decided while implementing: with **one** concrete
subtype `$type` is optional (there is nothing to disambiguate); with
more than one it is required, and an unrecognized value returns null so
the parameter's **own declared default** applies. Guessing "the first
subtype" on a typo would hand back a silently wrong shape, and a wrong
shape that renders is harder to debug than a default that renders.
Capped at 16 subtypes — a 40-arm dispatch over a broad framework base
is not the ergonomic win B1 was after.

```jsx
<Card shape={{ $type: 'RoundedRectangleBorder', radius: 8 }} />
<Map  physics={{ $type: 'BouncingScrollPhysics' }} />
```

### B2. Builder callbacks — reuse builder-mode. ✅ Landed + verified.

`Widget Function(BuildContext, int)` (itemBuilder, separatorBuilder,
tileBuilder) is unmappable because the return type isn't `void`. But the
wire **already** supports "host asks JS to build a subtree for index i"
— `wire.dart:462` and `:557`, builder-mode
`<ListView count={N} renderItem={…}>`. Generalize that from the built-in
ListView to any codegen'd `Widget Function(...)` param: JS returns JSX,
mounted as a keyed child.

**The perf gate shipped with it.** `builder: true` is opt-in per param
in `overrides:`, never inferred — because
`Widget Function(BuildContext, int)` is the same Dart type whether it
fires once per list row or once per map tile per frame during a pan,
and only the second is a jank bug. Nothing in the signature
distinguishes them, so a human has to.

The contract is async-with-placeholder by construction:
`SkalBuilderChild` renders a placeholder until JS delivers the subtree.
A frame-rate builder would therefore show a pop-in cascade, which is
visible and diagnosable rather than silently janky.

Only **indexed** builders are accepted — `Widget Function(BuildContext,
int)` and `Widget Function(int)`. A builder keyed by a domain object
(flutter_map's `tileBuilder(context, tileWidget, tile)`) has nothing to
key a subtree by and is refused with that reason.

Zero new wire ops: `builderRows` / `evRowRequest` / `opListSetRow` were
already keyed by (node, index) with nothing list-specific in them. The
JS side needs to know which props are builders — a function-valued
custom prop is otherwise an event handler — so codegen writes them to
`skal_codegen.json` under `builders`, and the Vite plugin injects that
map as a `globalThis.__SKAL_BUILDER_PROPS__` assignment: a banner on
the entry chunk for `vite build --watch`, a head script via
`transformIndexHtml` for the dev server. Both re-evaluate per build —
deliberately NOT a Vite `define`, which freezes at config-resolve time
and silently ignored a `builder: true` added mid-session. When the
Dart side waits for rows the JS side never binds (a stale vendored
plugin, an old bundle), `SkalBuilderChild` now says so in the debug log
instead of rendering blank rows silently.

**Verified on `scrollable_positioned_list` 0.3.8**: 5,000 declared rows,
~90 materialized on demand. O(window), not O(count), through a
codegen'd widget. `ScrollablePositionedListSeparated` — same package,
same builder type, no override — stayed skipped, which is the gate
working rather than a coincidence.

Three bugs that only a real run could find:

1. **The registration mechanism didn't run at all.** It was a side
   effect of importing the synthesized `skal-flutter` module — and in
   a correctly-configured build the babel macro *strips every import of
   that module* before it reaches the runtime. Now a `define`, which
   has no such dependency.
2. **`overrides:` were keyed by class name, not the synthesized JSX
   symbol.** `ScrollablePositionedList.builder` surfaces as
   `ScrollablePositionedListBuilder`, and that is the name the skip
   message prints — so a dev copying the message's own suggestion got
   silence. Both keys work now, synthesized first.
3. **`Number.MAX_SAFE_INTEGER | 0` is `-1`.** Used as the row count for
   a custom builder (which has no `count` prop), it tripped
   `_fillRows`' `count <= 0` guard and materialized nothing — with
   every other link in the chain looking correct.

Non-widget returns (`bool Function(T)`) need a *synchronous* JS→Dart
return — settled: permanently out of scope (see [S4](#settled-questions-perf-first-review-2026-07-21)).

### B3. Controllers — per-param factories + handles. ◐ Handle half landed; factory half not started.

`_looksStateful` rejects anything with `dispose()` or mutable fields.
`hosts:` already solves this *per widget*; the goal is **per param**.

**Landed — the handle route.** A service method parameter typed as a
controller now accepts an opaque handle (A3), so
`camera.takePicture(cam)` exists without a bespoke host widget.

**Not started — the factory route**, where the YAML names a factory
that supplies the param. Also not started: the same handle acceptance
on *widget* constructor params, which is the case that would let a
widget with one controller param need a binding rather than a host.

### B4. Escape valves — never lose a widget. ✅ Landed.

One unmappable **required** field (`:940-942`) nulls the value class,
which skips the whole widget (`:757`). Add per-param overrides:

```yaml
overrides:
  TileLayer:
    tileProvider: { const: "NetworkTileProvider()" }  # dev supplies a Dart literal
    tileBuilder:  { ignore: true }                    # drop it, keep the widget
```

`ignore: true` on a **required** param is refused with a message naming
`const:` as the fix, rather than emitting code that won't compile.

The **skip manifest** ships in `skal_codegen.json` under `skipped`:
every dropped widget with its reason, every dropped service method with
its reason, and every silently-omitted optional prop. It used to be a
build-log warning and nothing else, so a dev who scrolled past had no
way to see what they'd lost.

### B5. Lists of value classes — as child nodes. ✅ Landed + verified on flutter_map.

`List<Marker>` kills `MarkerLayer` even though `Marker` itself is a
mappable value class. The obvious fix — extend the encoder to `List<T>`
as one JSON array prop — is an **O(n) trap**: add one marker and you
re-encode, re-send, and re-parse all 1,000. The built-in ListView grew
builder mode precisely to kill that cost class.

The O(changed) mechanism already exists: `registerValue` child
composition — `registry.dart`'s own doc example is
`<Map><Camera><LatLng/></Camera></Map>`. Child nodes are diffed
per-node by the existing tree machinery:

```jsx
<MarkerLayer>
  <For each={pins()}>{(p) =>
    <Marker point={{ latitude: p.lat, longitude: p.lng }} />
  }</For>
</MarkerLayer>
```

So B5 = teach codegen to emit a `registerValue` builder for the list's
element class and accept child nodes for `List<T>` params. The runtime
half already existed — `SkalRegistry.registerValue` /
`bridge.buildValue<T>`, and `registry.dart`'s own doc example is this
exact shape — so only the generator needed changing.

**Landed:** a `List<T>` param whose element is a mappable value class
now emits `_skalChildValues<T>(n, bridge)` plus a
`registerValue<T>` builder for the element (drained in a loop, so a
`List<Marker>` whose Marker takes a `List<Anchor>` works too). Element
classes go into the manifest, so `<Marker>` is importable from
`skal-flutter` like any wrapped widget. Covered by
`test/fixtures/value_list.dart`, which asserts child composition
specifically — a JSON-array reader would pass a "does MarkerLayer
build" test while reintroducing the O(n) cost.

**Verified against real `flutter_map` 8.3.1.** `MarkerLayer` is gone
from the skip list, `Marker` gets a `registerValue<Marker>` builder,
and the generated file compiles. So do `PolygonLayer`, `PolylineLayer`
and `CircleLayer` once B6 pins their type argument — 16 widgets
generated where the pre-B5 run produced a much shorter list.

That run found three bugs the unit test could not have:

1. **Element eligibility was too strict.** B5 was reusing
   `_looksStateful`, which asks "can I rebuild this from JSON?" and so
   rejects a class with a lazily-memoized private field. `Polygon` is
   exactly that (`LatLng? _labelPosition` behind a computed getter) and
   is a perfectly ordinary value class. A child-node builder asks a
   weaker question — can I *construct* one from props — so it now uses
   `_ownsResources`, which only looks for `dispose()`/`close()`,
   lifecycle mixins and Stream/Future fields.
2. **`List<Color>` was being hijacked into child nodes.** Gradient
   stops as `<Color>` child elements is absurd, and the attempt emitted
   a `Color.from(colorSpace: …)` builder that didn't compile. Elements
   with a dedicated scalar encoding are now excluded.
3. **Enum encodings never pulled in their declaring library**, which a
   widget adapter got away with (the wrapped package's import covers
   it) and a value builder for a `dart:ui` enum did not.

No JSON-array convenience path was added. It would be a second way to
do the same thing whose only distinguishing feature is being slower.

### B6. Generic widget classes. ✅ Landed + verified.

`PolygonLayer<R>` / `PolylineLayer<R>` were rejected with *"generic
widget class — codegen can't pick concrete type arguments."* The YAML
now pins it:

```yaml
overrides:
  PolygonLayer:
    typeArgs: [Object]
```

No default-to-the-bound. Nothing in `PolygonLayer<R>` says what R
should be, and silently choosing would bake an arbitrary decision into
every consumer's JSX — the skip message names `typeArgs:` instead, so
the choice stays where the information is.

The constructor is read off the **instantiated** type, which is the
part that matters: a param declared `List<Polygon<R>>` arrives as
`List<Polygon<Object>>`, so the encoder sees a concrete element type
instead of a type variable. Reading it off the uninstantiated class
would compile and then map nothing.

Verified on flutter_map: all three vector layers generate, and their
element classes (`Polygon`, `Polyline`, `CircleMarker`) come with them
via B5. This confirms the ordering note below — B6 alone would have
produced `List<Polygon<Object>>` and still skipped.

## What no bridge design fixes

Per-package **platform config** — `Info.plist` usage strings,
`AndroidManifest` permissions, entitlements. Real friction, unrelated
to the bridge, and unsolvable in Dart or JS because the OS reads these
files before the app runs.

**Now handled declaratively.** `flutter-host/skal-permissions.json`
states intent once:

```json
{
  "camera":   "Scan QR codes and take profile photos",
  "location": "Show places near you"
}
```

and `bun run link` (via `scripts/skal-permissions.py`) translates it
into five dialects — iOS + macOS `Info.plist` usage strings, macOS
App Sandbox entitlements, `AndroidManifest` `<uses-permission>`, and
(when the app depends on `permission_handler`) that package's
`PERMISSION_*` macros injected into `ios/Podfile`'s `post_install`
hook. The macros matter more than they look: without them the package
compiles every strategy out and answers `permanentlyDenied` to every
request, with no hint why — verified live on the iOS Simulator.

That translation is the whole value. A dev should not have to know that
"camera" means `NSCameraUsageDescription` on iOS, the same key **plus**
a `com.apple.security.device.camera` entitlement on macOS, and
`android.permission.CAMERA` in a manifest — nor that omitting the macOS
entitlement produces a silent failure rather than a prompt. The usage
string is not decoration either: Apple rejects builds missing the key
and shows the wording verbatim in the prompt.

Idempotent, and it only ever ADDS keys — a value already present (hand
edited, or from an earlier run with different copy) is left alone, so
re-linking never reverts a dev's wording. Verified on kitchen-sink:
7 keys across 5 files, a second run a no-op, AndroidManifest still
valid XML, and a pre-existing `CAMERA` entry correctly left untouched.

Still not covered: anything requiring a native build-phase edit beyond
the marked `permission_handler` macro block (which is generated,
idempotent, and refreshed in place on re-link).

## Settled questions (perf-first review, 2026-07-21)

Formerly open; performance considerations decide them.

- **S1. Web parity for `services:` → JS-side shims.** Browser APIs
  called directly from JS are *faster* than a hop into the Flutter-web
  runtime — which already pays a copy on its "shared" buffer
  (`skal_ffi_web`). A service declares an optional JS web impl
  (precedent: `renderer-web.js:1465` implements `showDialog` for DOM);
  absent one, it throws a clear capability error on web. Never route
  web service calls through the Dart web runtime.

- **S2. Object-arg asymmetry → add `eventArgJson` to `opMethodArg`, in
  A1.** Returns already support it; args drop objects to `VOID`, and
  dialogs work around it with `JSON.stringify` (`dialogs.dart:69`).
  The cost is a case statement now; retrofitting after codegen emits
  hundreds of stringify-wrapped signatures means regenerating every
  consumer.

- **S3. `BaseProps` on generated adapters → forward a bounded subset.**
  Emit a conditional `SizedBox` / `Padding` wrap only when the props
  are present — zero cost when absent — and it kills the
  99,477-px-overflow class of bug
  ([trap above](#trap-custom-widgets-ignore-baseprops)). Silent-ignore
  was the worst option.

- **S5. Permissions → a service, plus declarative platform config.**
  Two halves, and they are genuinely different mechanisms, which is why
  the question looked harder than it was.

  *Runtime:* a service (`await perms.request('camera')`), NOT woven into
  each capability's first use. Three reasons. Permission state is
  queryable independently of use, so an app can show its own rationale
  before triggering the OS prompt — weaving makes that impossible.
  Weaving also forces every capability to re-implement the same
  granted/denied/permanently-denied ladder. And the OS model is already
  "ask, then use"; hiding the ask makes the denied path invisible, which
  is the path that actually needs handling. `permission_handler` wraps
  in ~20 lines as a `services:` entry (verified — see below).

  *Build-time:* `flutter-host/skal-permissions.json` declares intent
  once and `skal-link.sh` translates it into all four platform dialects
  via `scripts/skal-permissions.py`. That translation is the value: a
  dev should not have to know that "camera" means
  `NSCameraUsageDescription` on iOS, the same key **plus** a
  `com.apple.security.device.camera` entitlement on macOS, and
  `android.permission.CAMERA` in a manifest — nor that forgetting the
  macOS entitlement produces a silent failure rather than a prompt.
  Idempotent, and it only ever adds keys, so a dev's own wording is
  never reverted.

- **S6. B3's factory route → redundant with `hosts:`; the handle route
  is the new capability.** A per-param factory called from a generated
  adapter would construct a new controller on every rebuild — leaking
  the old one and resetting state. Making the adapter stateful to fix
  that *is* `hosts:`, which already exists. So B3 shipped as the handle
  route instead: JS owns the controller's lifetime explicitly, which
  composes with A3 and needs no new lifecycle machinery.

- **S4. Sync JS→Dart returns → permanently out of scope.** Blocking
  Dart's UI thread on JS execution inverts the architecture's core
  promise (JS never blocks the frame). Shared memory makes it
  *possible*; that is not the same as sane. Escape hatch: precompute
  and pass data, or restructure as async.

## Open questions

Still genuinely open.

1. **Codegen version drift.** `.g.dart` is committed. A clean regenerate
   during this exercise produced a file 12 lines different from the
   committed one. Nothing regenerates or diffs it in CI, so drift is
   invisible until someone rebuilds.

3. **Is `skal-native` (curated first-party wrappers) in or out?** Good DX
   for the top ~6, but a maintenance surface that cuts against "flexible
   for all packages." Undecided, and it changes the pitch.

## Priority

### Done

1. ✅ **Stale JSDoc** on `createSkalRef` — corrected.
2. ✅ **Both headless papercuts** — `rootDispatcher` is a setter that
   re-attaches, so `kRootNodeId` never surfaces in app code.
3. ✅ **The five benchmarks** + the perf contract folded into
   [PERFORMANCE.md](PERFORMANCE.md) and
   [BENCHMARKS.md § Bench 4](BENCHMARKS.md). Reproducible from
   `examples/virt-bench`.
4. ✅ **A1 + A2 + S2** — service registry, `createSkalService`,
   `services:` codegen, JSON method args, web shims (S1). Verified on
   macOS with clipboard + haptics.
5. ✅ **B4** — `overrides:` escape valves + the skip manifest.
6. ✅ **S3** — `BaseProps` forwarded into generated adapters.
7. ✅ **B1** — subtype unions.
8. ✅ **B5 + B6 + A3 + B2** — lists of value classes as child nodes,
   generic widget classes, opaque handles, and indexed builder
   callbacks with their perf gate. B5 and B6 verified against real
   `flutter_map` 8.3.1: `MarkerLayer`, `PolygonLayer`, `PolylineLayer`
   and `CircleLayer` all generate and compile.

### Next

9. **Permissions** — still unmodeled and still gating half the
   capability list (open question 1). Now cheap to *build* — it is a
   `services:` entry over `permission_handler` — but the design
   question (a service vs. woven into first use) is unanswered, and the
   `Info.plist` / manifest half is a different mechanism entirely.
10. **Ship the `flutter_map` demo** — verified working; needs a gallery
    home. The sized-parent caveat is obsolete now that S3 has landed.
11. **B3's factory route** — the remaining half. Handle-accepting
    *widget* constructor params, and a YAML-named factory per param.
12. **Run B2 against a real package.** It is unit-tested and its perf
    gate is in place, but no wrapped package has exercised the
    round-trip end to end. Until one does, treat it as the least
    settled thing here — it is the item the plan called riskiest, and
    the flutter_map run showed how much a real package finds.

Ordering note, now confirmed empirically: B6 alone does **not** unblock
`PolygonLayer<R>`. Pinning its type argument turns the skip reason from
`List<Polygon<R>>` into `List<Polygon<Object>>` — progress invisible to
a user. It took B5 as well before the layer generated.

Honest positioning today: *"any Flutter package is reachable — widgets
via codegen, native services via a short Dart adapter."* Not yet "any
package, any way."
