# Wrapping native / pub.dev libraries (skal_codegen)

When the built-in catalog lacks something — a map, a camera preview,
geolocation, biometrics, any of pub.dev — you do NOT write bridge
code, JS glue, or platform channels. You declare what you want in
`flutter-host/lib/skal_codegen.yaml`, run `bun run codegen`, and the
generator emits the Dart adapter, a JSON manifest, and (via the vite
plugin) a JSX module — so `import { FlutterMap } from 'skal-flutter'`
just works.

## The loop

```sh
# 1. add the package to flutter-host/pubspec.yaml, then:
cd flutter-host && flutter pub get && cd ..
# 2. declare it in flutter-host/lib/skal_codegen.yaml  (sections below)
bun run codegen
# 3. READ THE OUTPUT. Every widget/method codegen can't map is listed
#    with a REASON and the REMEDY — both in the build log and in
#    flutter-host/lib/skal_codegen.json under "skipped". Never guess
#    why something is missing; the manifest tells you.
# 4. import it in JSX from 'skal-flutter' and use it.
bun run build:js-only        # compile check
```

## The four yaml sections

```yaml
packages:            # walk a pub package's Widget classes → JSX components
  - qr_flutter
  - flutter_map

hosts:               # stateful widgets whose ctor needs a live controller
  Camera:
    widget: CameraPreview
    factory: package:__APP_NAME_SNAKE__/adapters/camera_factory.dart#createCamera

services:            # HEADLESS capabilities — no widget, no node
  geo:
    package: geolocator     # static-method class → callable from JS
    class: Geolocator

overrides:           # rescue widgets codegen would otherwise skip
  PolygonLayer:
    typeArgs: [Object]      # pin a generic widget's type parameter
  SomeWidget:
    someParam: { const: "const MyDefault()" }   # supply an expression
    otherParam: { ignore: true }                 # drop an OPTIONAL param
    itemBuilder: { builder: true }               # indexed builder → children
    controller: { handle: true }                 # opaque JS-held handle
```

Services from JSX — every method is an awaitable RPC; `$`-suffix
subscribes a Dart `Stream` and returns an unsubscribe function:

```jsx
import { createSkalService } from 'skal/runtime';
const geo = createSkalService('geo');
const pos = await geo.getCurrentPosition();          // JSON object
const stop = geo.getPositionStream$((p) => setPos(p));
```

Host widgets get an imperative surface for free — the controller's
public methods become `ref` calls:

```jsx
import { createSkalRef } from 'skal/runtime';
const cam = createSkalRef();
<Camera ref={cam} cameraName="back" />
await cam.takePicture();
```

## The escape-hatch ladder

When codegen can't map a library, do NOT drop to platform channels or
fork the generator. Escalate one rung at a time — each rung is a
proven pattern with a real cost, measured on real plugins:

| Rung | When | You write | Proven on |
|---|---|---|---|
| 1. `overrides:` | one unmappable ctor param, generic type args | **0 Dart** — yaml only | flutter_map's PolygonLayer |
| 2. Static forwarder + `services:` | plugin API is instance-shaped, not static | ~10–25 lines: one class of static methods delegating to the plugin | local_auth (24 lines), permission_handler |
| 3. Quirk shim method | a platform needs an argument codegen can't express | ~8 lines: one static method with the opinionated default baked in | share_plus needing `sharePositionOrigin` on iOS 26 |
| 4. `hosts:` factory | widget needs a live controller / async init | ~15–20 lines: a factory function (+ a thin adapter view if the ctor shape is odd) | camera, webview_flutter |
| 5. Plain local widget | you'd rather just write Flutter | a normal widget class in `flutter-host/lib/adapters/` — codegen walks YOUR code like any package | the Greeting / Ticker demos |
| 6. Raw registry | full control, no codegen | `SkalRegistry.registerWidget(name, (n, bridge) => …)` / `registerService(name, (method, args) => …)` | last resort; props are read untyped off NodeState |

Two properties make the ladder cheap:

- **Hand-written Dart is codegen INPUT, not a parallel system.** A
  forwarder class or local widget is walked exactly like a pub
  package: same manifest, same synthesized `'skal-flutter'` imports,
  same typed prop readers, streams and arg decoding for free. Zero
  JS-side glue at every rung except 6.
- **The skip messages name the rung.** "generic widget class — add
  `overrides: { X: { typeArgs: [...] } }`" is rung 1;
  "required param has unsupported type" usually means rung 1 or 4;
  an instance-shaped plugin API is rung 2 by inspection.

Worked rung-2 example (local_auth, complete):

```dart
// flutter-host/lib/adapters/auth_service.dart
import 'package:local_auth/local_auth.dart';

class AuthService {
  static final LocalAuthentication _auth = LocalAuthentication();
  static Future<bool> isDeviceSupported() => _auth.isDeviceSupported();
  static Future<bool> canCheckBiometrics() => _auth.canCheckBiometrics;
  static Future<bool> authenticate(String reason) =>
      _auth.authenticate(localizedReason: reason);
}
```

```yaml
services:
  auth: { package: __APP_NAME_SNAKE__, class: AuthService }
```

That is the ENTIRE integration. `await createSkalService('auth')
.authenticate('Unlock')` now works from JSX.

## Permissions

Declare intent once in `flutter-host/skal-permissions.json`:

```json
{ "camera": "Scan QR codes", "location": "Show places near you" }
```

`bun run link` translates it into iOS + macOS Info.plist usage
strings, macOS entitlements, AndroidManifest entries, and — when the
app depends on permission_handler — that package's `PERMISSION_*`
Podfile macros (without which every request answers
`permanentlyDenied`). Declaring does not prompt; the OS prompts on
first use. Available capability names are listed in the JSON file's
comment block.

## Per-package platform truths

Verified live; not Skal limitations. Budget for them:

- **permission_handler** — needs its Podfile macros (auto-injected via
  skal-permissions.json). No macOS implementation.
- **share_plus** — iOS 26/iPadOS requires a non-zero
  `sharePositionOrigin` rect → rung-3 shim.
- **camera** — simulators report no camera; test on hardware. The
  host pattern shows the factory's error text in place of the preview.
- **local_auth** — simulator biometrics need Face ID enrollment from
  the Simulator menu.
- **geolocator** — the gold standard: fully static API, zero Dart,
  works on simulator with a simulated location.

## Gotchas

- After ANY yaml or adapter edit: `bun run codegen`, then rebuild the
  JS bundle. Codegen does not watch.
- `'skal-flutter'` imports come from the manifest — if a component is
  missing there, the manifest's "skipped" section says why.
- Method args/returns must be encodable (primitives, JSON-able value
  classes, enums by name, `List<T>` of those, streams of those, or
  opaque handles). `Rect`/`Matrix4`-style Flutter types are not — bake
  them into a rung-3 shim instead of passing them from JS.
- Payloads over the bridge are for DATA, not blobs: strings beyond the
  heap sizes truncate. Pass paths and handles, not file contents.
