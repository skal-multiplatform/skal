# Wrapping pub.dev packages for Skal

End-to-end DX rundown for the codegen pipeline. Cold-read this if you
want to expose a Flutter package's widget to JSX.

## Decision tree

```
              Does the widget need lifecycle (init / dispose)
              OR a stateful controller object?
                          │
                ┌─────────┴─────────┐
              NO                   YES
               │                     │
               ▼                     ▼
   ┌─────────────────────┐   ┌─────────────────────┐
   │  Pattern A: PROPS   │   │  Pattern C: HOST    │
   │  (qr_flutter)       │   │  (camera, video,    │
   │                     │   │   ticker, webview)  │
   │  Multi-child?       │   │                     │
   │  → Pattern B        │   │  Needs imperative   │
   │  (Wrap, Stack)      │   │  methods?           │
   │                     │   │  → Pattern D: RPC   │
   └─────────────────────┘   └─────────────────────┘
```

All four patterns share the same five-step ritual:

1. Add the package to `flutter/skal_flutter/pubspec.yaml` + `flutter pub get`
2. (Patterns C/D only) Write a tiny factory function in `lib/adapters/<name>_factory.dart`
3. Declare the wrap in `flutter/skal_flutter/lib/skal_codegen.yaml`
4. Run `dart run build_runner build`
5. Import the synthesized symbol from `'skal-flutter'` in your JSX

The build_runner step regenerates BOTH `lib/skal_codegen.g.dart` (the
Dart adapter) AND `lib/skal_codegen.json` (the manifest the Vite
plugin reads). The JS side picks up new widgets automatically — no
edits to `vite.config.js` or any per-widget stub module.

---

## Pattern A — pure-prop widget

The widget's constructor takes only primitive/value-typed params. No
controller, no lifecycle. Most pure-UI packages fit here.

**Example:** `qr_flutter`'s `QrImageView`.

**1. Add the pubspec dependency.**

```yaml
# flutter/skal_flutter/pubspec.yaml
dependencies:
  qr_flutter: ^4.1.0
```

Run `flutter pub get`.

**2. List the package in the marker file.**

```yaml
# flutter/skal_flutter/lib/skal_codegen.yaml
packages:
  - qr_flutter
```

**3. Regenerate.**

```bash
cd flutter/skal_flutter
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
// flutter/skal_flutter/lib/adapters/camera_factory.dart
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
# flutter/skal_flutter/lib/skal_codegen.yaml
packages:
  - camera                          # listed so analyzer can resolve types
hosts:
  Camera:                                   # JSX symbol name
    widget: CameraPreview                   # widget class to wrap
    factory: package:skal_flutter/adapters/camera_factory.dart#createCamera
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

## What doesn't work yet (intentional gaps)

| Type / Pattern                          | Status      | Notes                                              |
|-----------------------------------------|-------------|----------------------------------------------------|
| `Stream<T>` returns                     | not encoded | One-shot Promises only. Subscriptions on the roadmap. |
| `Function`-valued props (other than `VoidCallback`/`ValueChanged<T>`) | partial | Most lifecycle is covered; multi-arg callbacks need design. |
| `ImageProvider`                         | unsupported | Needs a "string → NetworkImage/AssetImage" coercion. |
| `Gradient`, `BoxDecoration`, `TextStyle` | unsupported | Mechanical to add; each is a sub-prop expansion like `EdgeInsets`. |
| Positional ctor params (non-host)       | silently dropped | The host pattern handles positional ctors fine; the regular widget walk skips them today. |
| `String` length > heap capacity         | truncates   | JS heap: 768 KiB, reply heap: 256 KiB. Per-string limit. |
| Hot-reload of `skal_codegen.yaml`       | manual      | Re-run `build_runner build` after edits.           |

---

## Cheat sheet

The minimum number of files / lines for each pattern:

| Pattern | New files                        | YAML lines | Dart hand-written |
|---------|----------------------------------|------------|--------------------|
| A. Props        | _none_                   | 1          | 0                  |
| B. Multi-child  | _none_                   | 1          | 0                  |
| C. Host         | `<name>_factory.dart`    | 4          | ~15                |
| D. Host + RPC   | (same as C)              | 4          | ~15                |

JSX-side: 1 import line + however much UI code you'd write anyway.

---

## Re-generation flow

After ANY change to:
- `skal_codegen.yaml` (added a package, host, etc.)
- A factory function's signature
- A wrapped package's version (controller method signatures change)

…run `dart run build_runner build` from `flutter/skal_flutter/`. It
re-emits `lib/skal_codegen.g.dart` + `lib/skal_codegen.json`. The
Vite plugin watches the JSON manifest, so `vite dev` picks up the
new symbols on next `bun run build`.

For LOCAL widgets (in `lib/adapters/`) you can use the CLI directly
instead of build_runner — same generator, same outputs:

```bash
dart run ../../codegen/skal_codegen/bin/skal_codegen.dart \
  lib/adapters/greeting_widget.dart \
  -o lib/adapters/generated/skal_adapters.g.dart
```

---

## Architectural reference

For internal contributors:

- **Wire format** — `flutter/skal_flutter/lib/skal/wire.dart` is the
  source of truth; `js-app/src/bridge.js`'s top section must match
  byte-for-byte.
- **Codegen** — `codegen/skal_codegen/lib/src/generator.dart` for the
  emission shapes, `type_mapper.dart` for value-type encodings,
  `builder.dart` for the build_runner integration.
- **Tests** — `codegen/skal_codegen/test/generator_test.dart` snapshots
  every fixture in `test/fixtures/`. Add a fixture per new type or
  emission shape; the test harness auto-diffs the generator's output
  against the saved `.expected.dart`.
- **JS-side runtime** — `js-app/src/bridge.js` for wire encode/decode,
  `js-app/src/renderer.js` for the Solid universal-renderer hooks,
  `js-app/src/skal-runtime.jsx` for the public `createSkalRef` API.
- **The bridge buffer layout** — 6 MiB shared region:
  - 64 B header (seq counters, write positions)
  - 4 MiB op ring (JS write, Dart read)
  - 768 KiB JS string heap (JS write, Dart read)
  - 256 KiB reply heap (Dart write, JS read)
  - ~1 MiB event ring (Dart write, JS read)
