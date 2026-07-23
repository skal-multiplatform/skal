# Wrapping pub.dev packages for Skal

End-to-end DX rundown for the codegen pipeline. Cold-read this if you
want to expose a Flutter package's widget to JSX.

## Decision tree

```
              Is there a WIDGET to render at all?
                          │
                ┌─────────┴─────────┐
              NO                   YES
               │                     │
               ▼                     ▼
   ┌─────────────────────┐   Does it need lifecycle
   │ Pattern E: SERVICE  │   (init / dispose) or a
   │ (geolocation,       │   stateful controller?
   │  clipboard, share,  │             │
   │  haptics, biometrics)│   ┌─────────┴─────────┐
   └─────────────────────┘  NO                   YES
                             │                     │
                             ▼                     ▼
                  ┌─────────────────────┐ ┌─────────────────────┐
                  │  Pattern A: PROPS   │ │  Pattern C: HOST    │
                  │  (qr_flutter)       │ │  (camera, video,    │
                  │                     │ │   ticker, webview)  │
                  │  Multi-child?       │ │                     │
                  │  → Pattern B        │ │  Needs imperative   │
                  │  (Wrap, Stack)      │ │  methods?           │
                  │                     │ │  → Pattern D: RPC   │
                  └─────────────────────┘ └─────────────────────┘
```

Ask the widget question first. Nine of the twelve capabilities in
[NATIVE_SUPPORT.md](NATIVE_SUPPORT.md) have no widget, and reaching for
Pattern C on one of them is the most common wrong turn.

All the widget patterns share the same five-step ritual:

1. Add the package to `examples/kitchen-sink/flutter-host/pubspec.yaml` + `flutter pub get`
2. (Patterns C/D only) Write a tiny factory function in `lib/adapters/<name>_factory.dart`
3. Declare the wrap in `examples/kitchen-sink/flutter-host/lib/skal_codegen.yaml`
4. Run `dart run build_runner build`
5. Import the synthesized symbol from `'skal-flutter'` in your JSX

The build_runner step regenerates BOTH `lib/skal_codegen.g.dart` (the
Dart adapter) AND `lib/skal_codegen.json` (the manifest the Vite
plugin reads). The JS side picks up new widgets automatically — no
edits to `vite.config.js` or any per-widget stub module.

---

## The escape-hatch ladder

When codegen can't map a library, don't drop to platform channels and
don't fork the generator — escalate one rung at a time. Every rung is
a shipped pattern with a measured cost (line counts are from real
plugins wrapped during the 2026-07-23 iOS verification run):

| Rung | When | You write | Proven on |
|---|---|---|---|
| 1. `overrides:` in the yaml | one unmappable ctor param; generic type args | **0 Dart** | flutter_map's `PolygonLayer` (`typeArgs:`) |
| 2. Static forwarder + `services:` | plugin API is instance-shaped, not static | ~10–25 lines | local_auth (24 lines), permission_handler |
| 3. Platform-quirk shim method | a platform needs an arg codegen can't encode | ~8 lines | share_plus's `sharePositionOrigin` on iOS 26 |
| 4. `hosts:` factory (Patterns C/D) | live controller / async init | ~15–20 lines | camera, webview_flutter (`WebShell`) |
| 5. Plain local widget class | you'd rather just write Flutter | normal widget code — codegen walks YOUR lib like any package | kitchen-sink's Greeting, Ticker |
| 6. Raw `SkalRegistry.registerWidget` / `registerService` | full control | untyped NodeState reads | last resort |

Two properties keep the ladder cheap. First, **hand-written Dart is
codegen input, not a parallel system**: a forwarder class or local
widget is walked exactly like a pub package — same manifest, same
synthesized `'skal-flutter'` imports, same typed prop readers, streams
and arg decoding for free. Second, **the skip report names the rung**:
every widget/method codegen drops is listed in `skal_codegen.json`
under `"skipped"` (and in the build log) with the reason and the exact
remedy — never diff generated output to find out what's missing.

The scaffold ships this ladder to coding agents too:
`scripts/templates/default/.claude/skills/skal/references/codegen.md`
(mirrored into `.agents/skills/` at scaffold time), so an AI working
inside a generated app climbs the same rungs instead of inventing
platform channels.

---

## Pattern A — pure-prop widget

The widget's constructor takes only primitive/value-typed params. No
controller, no lifecycle. Most pure-UI packages fit here.

**Example:** `qr_flutter`'s `QrImageView`.

**1. Add the pubspec dependency.**

```yaml
# examples/kitchen-sink/flutter-host/pubspec.yaml
dependencies:
  qr_flutter: ^4.1.0
```

Run `flutter pub get`.

**2. List the package in the marker file.**

```yaml
# examples/kitchen-sink/flutter-host/lib/skal_codegen.yaml
packages:
  - qr_flutter
```

**3. Regenerate.**

```bash
cd examples/kitchen-sink/flutter-host
dart run build_runner build
```

The codegen walks `qr_flutter`'s `lib/`, finds every Widget class,
filters to those whose constructors take only encodable types, emits
one `_build_<ClassName>` adapter each.

**4. Import + use.**

```jsx
import { QrImageView } from 'skal-flutter';

<QrImageView data="https://skal.dev" size={200} />
```

That's it. The babel macro lowers `<QrImageView>` to the camelCased
registry key `<qrImageView>`; the bridge dispatches to the codegen
adapter at runtime; the adapter reads each prop from the bridge and
constructs `QrImageView(data: ..., size: ...)`.

### Supported value types

| Dart type      | JSX type             | Wire encoding         |
|----------------|----------------------|-----------------------|
| `String`       | string               | string heap           |
| `int`          | number (integer)     | u32                   |
| `double`       | number (fractional)  | f32                   |
| `bool`         | boolean              | u32 (0/1)             |
| `Color`        | `"#RRGGBB"` or u32   | u32 ARGB              |
| `enum`         | number (index)       | u32                   |
| `Duration`     | number (ms)          | u32                   |
| `EdgeInsets`   | 4 props `xxxLeft`…   | 4×f32 sub-props       |
| `Widget child` | JSX child            | bridge child node     |
| `List<Widget>` | JSX children         | child-node-per-element|

Unsupported types (e.g. `Gradient`, `BoxDecoration`, `ImageProvider`)
get the param OMITTED if optional, or the whole widget SKIPPED with
a build-time warning. Skipped widgets show in the `build_runner`
output:

```
[WARNING] skal_codegen: skipped Shimmer — required param 'gradient'
          has unsupported type 'Gradient'. Write a manual
          SkalRegistry.registerWidget call to wrap it.
```

### Named constructors

Codegen emits one adapter per public, non-redirecting ctor. A widget
with both a default AND a named ctor produces both JSX symbols:

```dart
// shimmer package
class Shimmer extends StatelessWidget {
  Shimmer({Gradient gradient, ...});               // skipped (Gradient)
  Shimmer.fromColors({Color baseColor, ...});      // → ShimmerFromColors
}
```

JSX:
```jsx
import { ShimmerFromColors } from 'skal-flutter';
<ShimmerFromColors baseColor={0xFFBDBDBD} highlightColor={0xFFE0E0E0}>
  <SomeChild />
</ShimmerFromColors>
```

Symbols follow `ClassName + PascalCase(ctorName)`. Default ctors keep
the class name verbatim.

---

## Pattern B — multi-child wrapper

A widget that takes `List<Widget> children`. Identical to Pattern A;
codegen detects the list type and emits the per-child reader:

```jsx
import { Stack } from 'skal-flutter';  // hypothetical
<Stack alignment={0}>
  <Image src="bg.jpg" />
  <Text label="overlay" fontSize={20} color="#FFFFFFFF" />
</Stack>
```

Every JSX child becomes one element in the Dart-side `children` list.

---

## Pattern C — controller-host (stateful widget)

The widget's constructor REQUIRES a runtime-constructed controller
object (`CameraController`, `VideoPlayerController`, `ChangeNotifier`-
derived things). The bridge can't encode a live controller; instead
you write a 10-15 line factory function that constructs one, and
codegen synthesizes a `StatefulWidget` wrapper around it.

**Example:** the camera package.

**1. Add the pubspec dependency.**

```yaml
dependencies:
  camera: ^0.11.0
```

**2. Write the factory.** This is the only hand-written Dart for the
whole integration. It's specific to the package's API (call
`availableCameras()`, pick one, construct + initialize the controller):

```dart
// examples/kitchen-sink/flutter-host/lib/adapters/camera_factory.dart
import 'package:camera/camera.dart';

Future<CameraController> createCamera({
  String? cameraName,
  int resolutionIndex = 1,
}) async {
  final cams = await availableCameras();
  if (cams.isEmpty) throw StateError('no cameras');
  final picked = cameraName == null
      ? cams.first
      : cams.firstWhere((c) => c.name == cameraName,
          orElse: () => cams.first);
  final c = CameraController(picked, ResolutionPreset.values[resolutionIndex]);
  await c.initialize();
  return c;
}
```

The factory's PARAMETER LIST becomes the JSX-side prop set (`cameraName`,
`resolutionIndex`); the factory's RETURN TYPE tells codegen which
controller class to wrap. Async (`Future<...>`) factories work — codegen
injects `await` in the synthesized initState.

**3. Declare the host.**

```yaml
# examples/kitchen-sink/flutter-host/lib/skal_codegen.yaml
packages:
  - camera                          # listed so analyzer can resolve types
hosts:
  Camera:                                   # JSX symbol name
    widget: CameraPreview                   # widget class to wrap
    factory: package:kitchen_sink/adapters/camera_factory.dart#createCamera
```

**4. Regenerate + import.**

```bash
dart run build_runner build
```

```jsx
import { Camera } from 'skal-flutter';
<Camera resolutionIndex={1} />
```

What codegen emits behind the scenes (~80 lines of `_CameraHost`
StatefulWidget): initState calls `createCamera`, awaits, setState's
the controller; build renders `SizedBox.shrink` while pending, an
inline error widget if the factory throws (e.g. macOS without camera
permission), `CameraPreview(controller)` once ready; dispose cleanly
disposes the controller.

---

## Pattern D — imperative RPC (calling methods)

Same as Pattern C, plus you want to call methods on the controller
from JSX:

```jsx
const camera = createSkalRef();
<Camera ref={camera} resolutionIndex={1} />
<Button onClick={async () => {
  const file = await camera.takePicture();   // Promise<XFile>
  setLastShot(file.path);
}} />
```

No additional setup — Pattern C already gave you everything. The
codegen walks the controller's `methods2` (its own non-inherited
methods), filters to those with encodable args + return types, and
auto-emits a dispatcher switch on the host's State that routes
`OP_INVOKE_METHOD` ops to the controller.

**JSX ref API:**

```jsx
import { createSkalRef } from './skal-runtime.jsx';

const ref = createSkalRef();
<Ticker ref={ref} intervalMs={500} />

// Anywhere — typically inside event handlers (the ref needs to be
// bound to a mounted node first, which happens on first render):
await ref.pause();                         // Promise<void>
const v = await ref.getValue();            // Promise<number>
const snap = await ref.snapshot();         // Promise<{value, paused, ...}>
```

The Proxy emits one `OP_INVOKE_METHOD` per call (plus `OP_METHOD_ARG`
for each positional arg), stores a `{resolve, reject}` keyed by callId,
returns a Promise. Dart dispatches the call + writes
`EV_METHOD_REPLY(callId, argType, value)` back through the event ring;
JS resolves the matching Promise.

### Supported method-arg + return types

|                | int | double | bool | String | Object/Map/List | void  |
|----------------|-----|--------|------|--------|-----------------|-------|
| **Args** (JSX → Dart) | ✅   | ✅     | ✅   | ✅      | dropped         | —     |
| **Returns** (Dart → JS) | ✅   | ✅     | ✅   | ✅      | JSON-encoded ✅  | ✅    |

Object returns use `jsonEncode` on the Dart side. Any class with a
`toJson()` method works, plus Map/List of primitives, plus nested
combinations. Non-jsonable values resolve with `undefined` on the JSX
side.

Async methods (returning `Future<T>`) are auto-awaited before the
reply lands — no extra plumbing.

### Errors

If the dispatcher throws (or its returned Future rejects), the
matching JSX `Promise` rejects with `new Error('skal RPC: <method>
threw: <message>')`. Try/catch around the await as usual:

```jsx
try {
  const v = await ticker.totallyMadeUp();
} catch (e) {
  console.error(e.message);
}
```

---

## Pattern E — headless service (no widget at all)

Nine of the twelve capabilities in
[NATIVE_SUPPORT.md](NATIVE_SUPPORT.md) have nothing to mount:
geolocation, clipboard, haptics, share sheet, secure storage,
biometrics, permissions. Patterns A–D are all about widgets; this one
is for everything else.

Most capability plugins expose **static** methods, which means no
factory is needed (a static method has no constructor to cross the
bridge). Name the class in `services:` and you are done:

```yaml
# lib/skal_codegen.yaml
services:
  - geolocator                  # class inferred as `Geolocator`
  device:                       # or spell it out
    package: my_app
    class: DeviceService
```

```jsx
import { createSkalService } from 'skal/runtime';

const geo = createSkalService('geolocator');
const pos  = await geo.getCurrentPosition();       // JSON object back
const stop = geo.positionStream$(p => setPos(p));  // Stream<Position>
onCleanup(stop);
```

Dart hand-written: **none** — unless you want to reshape the API, which
is often worth it. See
`examples/kitchen-sink/flutter-host/lib/adapters/device_service.dart`
for why: `Clipboard.getData()` returns a `ClipboardData?` whose useful
content is one nullable field, and each `await` costs a frame, so
collapsing "call then read the field" into one method is the difference
between one frame and two.

For a service without a static surface, `registerService` takes a
hand-written dispatcher directly — see
`packages/skal_flutter/lib/skal/services.dart`.

**Web:** `registerWebService('clipboard', { read: … })` answers with a
browser API instead. A registered web impl wins in any browser context.
Without one, the call rejects with a message naming the fix.

**Batch.** A one-shot RPC costs one frame
([PERFORMANCE.md](PERFORMANCE.md)), so:

```jsx
const [a, b, c] = await Promise.all([svc.a(), svc.b(), svc.c()]);  // 1 frame
// NOT: await svc.a(); await svc.b(); await svc.c();               // 3 frames
```

---

## When codegen can't map a param

Codegen drops a widget when a **required** constructor param has a type
it can't rebuild from bridge props. Every drop is now reported twice:
as a build warning, and in `lib/skal_codegen.json` under `skipped`
(along with optional props that were silently omitted). Read that file
before concluding a package "doesn't work."

Two escape valves, both in `lib/skal_codegen.yaml`:

```yaml
overrides:
  TileLayer:
    imports: ['package:flutter_map/flutter_map.dart']
    tileProvider: { const: 'NetworkTileProvider()' }  # supply a fixed value
    tileBuilder:  { ignore: true }                    # drop it, keep the widget
  PolygonLayer:
    typeArgs: [Object]                                # pin a generic widget
  MyFeed:
    itemBuilder: { builder: true }                    # JS builds each row
  VideoView:
    controller: { handle: true }                      # JS owns the object
```

Key the entry by the symbol JSX uses. For a named constructor that is
the synthesized name (`ScrollablePositionedListBuilder`), which is also
what the skip message prints; the bare class name also works and covers
every constructor of that class.

`const:` pastes a Dart expression verbatim — use it when a param is
unmappable but a single fixed instance is fine, which is the common
case for providers and strategies. `ignore:` only applies to *optional*
params; using it on a required one is refused with an error that names
`const:` as the fix, rather than emitting code that won't compile.

---

## What doesn't work yet (intentional gaps)

| Type / Pattern | Status | Notes |
|---|---|---|

| Builder callbacks keyed by something other than an index | unsupported | `Widget Function(BuildContext, int)` works via `builder: true`. A builder keyed by a domain object (flutter_map's `tileBuilder`) has nothing to key a subtree by. |
| Non-`void` callbacks (`bool Function(T)`) | permanently out of scope | Needs a synchronous JS→Dart return, which would block the frame. See S4. |
| `String` longer than the heap | truncates **silently** | JS heap 768 KiB, reply heap 256 KiB. Pass paths and handles, not payloads. |
| Hot-reload of `skal_codegen.yaml` | manual | Re-run `build_runner build` after edits. |

Things this table used to list that now work: `Stream<T>` returns
(`ref.foo$(cb)`), `ImageProvider`, `Gradient`, `BoxDecoration`,
`TextStyle`, positional constructor params, abstract param types with
concrete subclasses (B1), `width`/`height`/`padding` on generated
widgets (S3), `List<ValueClass>` as child nodes (B5), generic widget
classes via `typeArgs:` (B6), indexed builder callbacks via
`builder: true` (B2), and controller params via `handle: true` (B3).

### Platform truths (verified live, iOS Simulator 2026-07-23)

Not Skal limitations — per-package / per-platform behavior you will
hit wrapping these exact packages, recorded so nobody rediscovers them:

| Package | Truth | What to do |
|---|---|---|
| `permission_handler` | iOS compiles each permission strategy only when its `PERMISSION_*` macro is set in the Podfile; without it every request answers `permanentlyDenied`, no error. No macOS implementation at all. | Declare the capability in `skal-permissions.json` — `skal-permissions.py` injects the macros into `ios/Podfile` automatically when the package is a dependency. |
| `share_plus` | iOS 26 (and iPadOS generally) rejects the share sheet unless `sharePositionOrigin` is a non-zero rect: `PlatformException(sharePositionOrigin: argument must be set)`. `Rect` isn't bridge-encodable, so JS can't pass it. | One static wrapper method that calls `Share.share(text, sharePositionOrigin: const Rect.fromLTWH(0, 0, 200, 200))`; keep the raw walk for other platforms. |
| `camera` | Simulators report no usable camera even though iOS 26 sims expose a virtual capture device. The host pattern surfaces the factory's error text in place of the preview. | Expected on simulator; test on hardware. |
| `geolocator` | Fully functional on simulator once `simctl location set` and a location grant are in place — including `getPositionStream$`. | Nothing; this is the zero-Dart raw-walk proof. |
| `local_auth` | Simulator biometrics need enrollment (`notifyutil -s com.apple.BiometricKit.enrollmentChanged 1` + `-p` post). Query methods then report Face ID; `authenticate()` still needs the Simulator's Face ID menu to answer the prompt. | Query in probes; keep `authenticate()` behind a button. |
| Photos on iOS 26 | The limited-library flow prompts even when TCC was pre-granted via `simctl privacy grant photos`. | Probe `status`, not `request`, in headless runs. |
| Emoji on iOS 26 **simulator** | Non-text glyphs render as tofu on the iOS 26.3 simulator runtime — a Flutter-engine ↔ new-runtime gap, not a Skal bug. Same binary renders full color emoji on the iOS 18.6 simulator and macOS. | Test emoji-bearing UI on an 18.x sim or hardware until the engine catches up. |

---

## Cheat sheet

The minimum number of files / lines for each pattern:

| Pattern | New files                        | YAML lines | Dart hand-written |
|---------|----------------------------------|------------|--------------------|
| A. Props        | _none_                   | 1          | 0                  |
| B. Multi-child  | _none_                   | 1          | 0                  |
| C. Host         | `<name>_factory.dart`    | 4          | ~15                |
| D. Host + RPC   | (same as C)              | 4          | ~15                |
| E. Service      | _none_                   | 1–3        | 0 (static surface) |

JSX-side: 1 import line + however much UI code you'd write anyway.

---

## Re-generation flow

After ANY change to:
- `skal_codegen.yaml` (added a package, host, etc.)
- A factory function's signature
- A wrapped package's version (controller method signatures change)

…run `dart run build_runner build` from `examples/kitchen-sink/flutter-host/`. It
re-emits `lib/skal_codegen.g.dart` + `lib/skal_codegen.json`. The
Vite plugin watches the JSON manifest, so `vite dev` picks up the
new symbols on next `bun run build`.

For LOCAL widgets (in `lib/adapters/`) you can use the CLI directly
instead of build_runner — same generator, same outputs:

```bash
dart run ../../../packages/skal_codegen/bin/skal_codegen.dart \
  lib/adapters/greeting_widget.dart \
  -o lib/adapters/generated/skal_adapters.g.dart
```

---

## Architectural reference

For internal contributors:

- **Wire format** — `packages/skal_flutter/lib/skal/wire.dart` is the
  source of truth; `packages/skal-js/src/bridge.js`'s top section
  must match byte-for-byte.
- **Codegen** — `packages/skal_codegen/lib/src/generator.dart` for the
  emission shapes, `type_mapper.dart` for value-type encodings,
  `builder.dart` for the build_runner integration.
- **Tests** — `packages/skal_codegen/test/generator_test.dart` snapshots
  every fixture in `test/fixtures/`. Add a fixture per new type or
  emission shape; the test harness auto-diffs the generator's output
  against the saved `.expected.dart`.
- **JS-side runtime** — `packages/skal-js/src/bridge.js` for wire encode/decode,
  `packages/skal-js/src/renderer.js` for the Solid universal-renderer hooks,
  `packages/skal-js/src/skal-runtime.jsx` for the public `createSkalRef` API.
- **The bridge buffer layout** — 6 MiB shared region:
  - 64 B header (seq counters, write positions)
  - 4 MiB op ring (JS write, Dart read)
  - 768 KiB JS string heap (JS write, Dart read)
  - 256 KiB reply heap (Dart write, JS read)
  - ~1 MiB event ring (Dart write, JS read)
