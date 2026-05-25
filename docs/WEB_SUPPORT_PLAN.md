# Web support — plan

The plan for Skal's web target: how it renders today, what's broken,
what shapes of "web support" we considered, the one we picked
(Option B.5 — DOM renderer + hidden Flutter Web for plugins), and
the build phases to get there.

Companion to [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md) §1.4 and
[`RESTRUCTURE.md`](RESTRUCTURE.md).

---

## Where we are today

Skal has a web target via `packages/skal-js/src/renderer-web.js` — a
Solid universal renderer targeting DOM. The same `App.jsx` source
compiles to either bridge ops (native) or DOM ops (web) by swapping
the `moduleName` Solid is configured with.

| | Native | Web |
|---|---|---|
| JSX → | `bridge.js` encoder | `renderer-web.js` |
| Buffer → | shared memory in libskal | DOM mutations |
| Renderer | Flutter (Skia/Impeller) | browser DOM + CSS |
| Bundle | 123 kB JS + 1.34 MB JSC bytecode + 62 MB libskal | 137 kB JS (currently broken, see below) |

The babel plugin recognizes **49 widget intrinsics**;
`renderer-web.js` has **79 case branches** covering them and their
variants. Coverage is broad — slivers, custom-scroll, page-view, hero,
dismissible all render to DOM equivalents.

### What's broken

Web is currently **non-functional**. `packages/skal-js/src/bridge.js`
line 408 calls `globalThis.__skal_acquireBridge()` at module load.
That hook is installed by libskal on native; on web nothing installs
it → `TypeError` at script start → blank page.

This is a pre-existing bug, not introduced by the restructure (verified
by stashing the restructure changes and reproducing on the OLD layout).
Phase 0 below fixes it.

### What works (once Phase 0 lands)

- Layout / box / column / row / text / button / list — full coverage
- Sliver-based widgets, page view, hero, dismissible
- Scroll, gestures (basic), text input
- Most `setDesign` / `showDialog` / `showSnackbar` stubs

### What does NOT work — and the reason for this doc

**Custom widgets and Flutter plugins.** `<QrImageView>`,
`<Shimmer>`, `<Camera>`, and the eventual plugin bridge (camera,
geolocation, biometric, FCM, file picker, …) are all **Dart code**
inside `flutter-host/`. The DOM renderer has no Dart runtime in the
browser. So these widget tags reach `renderer-web.js` as unknown
intrinsics → render nothing.

This doc is the plan to give web access to that Dart code WITHOUT
shipping Flutter Web for the entire app.

---

## Shapes we considered

Four architectural options, ranked by cost.

### Shape A — Two parallel renderers, dispatcher-routed
Mount Flutter Web views as children inside the DOM tree, per-widget.

```
<column>            → DOM
  <text>            → DOM
  <Camera>          → mini Flutter Web view inside a <div>
  <button>          → DOM
```

**Why this is a nightmare:** layout coordination across engines (Flutter
Web doesn't have a "respect parent's CSS measure" mode), event
propagation across DOM/Flutter boundary, ~3 MB engine cost even for one
widget, lifecycle thrash on scroll. *Don't pursue.*

### Shape B — DOM + per-widget JS shims (no Flutter at all on web)
For each "Flutter plugin widget" with a Web API equivalent, write a JS
implementation. `<Camera>` on web = `<video>` + `getUserMedia`. Same
Skal API; per-target implementation.

| Plugin | JS port cost |
|---|---|
| geolocator, share, file picker | trivial (~30 min — 1 hr each) |
| camera, WebAuthn biometric | bounded (~half-day each) |
| webview, firebase messaging | real work (~1–3 days each) |
| `in_app_purchase`, `flutter_contacts` | no web equivalent at all |

**Catch:** every plugin needs separate JS implementation. The Flutter
plugin's published `_web.dart` is useful **as reference**, but the
Dart code itself can't execute without a Dart runtime.

### Shape B.5 — DOM + hidden Flutter Web for plugins *(chosen)*
A `display:none` Flutter Web instance, lazy-loaded on first plugin
call, running unmodified Flutter plugin Dart code. DOM still renders
everything visible.

**Inherits every Flutter plugin's web implementation for free.** Cost:
~3 MB Flutter Web download on first plugin call (cached after). Apps
that never call a plugin pay nothing extra.

This doc's implementation plan.

### Shape C — Spotlight Flutter Web (per-route)
Marketing pages + auth in DOM. Specific in-app screens boot a full
Flutter Web instance inside a `<div>` for that route only. Hybrid at
the *route* level instead of the *widget* level.

```
/ /pricing /docs /signup     → DOM (~140 kB)
/app/dashboard               → Flutter Web (~3 MB lazy-load)
```

Reachable on top of B.5 as a separate primitive (`<FlutterEmbed bundle="..." />`).
Listed for completeness, not in this plan's scope.

### Shape D — Full Flutter Web
Skip the DOM renderer entirely. Use Flutter Web for the whole app.
Pixel parity with native, ~3-10 MB always-on download, no DOM
advantages (a11y, SEO, native scroll feel). For an app where parity
matters more than weight, this is the right call. **Shipped as an
alternate target** alongside B.5 — see `dev:web-flutter` /
`build:web-flutter` in `examples/kitchen-sink/package.json` and
§"Shape D-skwasm" below for the dart2wasm+skwasm implementation.

---

## Chosen plan — Option B.5

```
Browser tab loads:
  index.html ──▶ skal-app.js (~140 kB, DOM renderer)
                   │ user interacts; everything renders in DOM
                   │
                   │ first plugin call
                   ▼
                Lazy-load flutter-web-plugins/* (~3 MB, cached after)
                   │ Flutter Web boots into a hidden 1×1 px <div>
                   │ Dart registers __skalPluginCall on globalThis
                   │
                   ▼
JS bridge calls __skalPluginCall('geolocator.getCurrentPosition', '{}')
                   │
                   ▼
Dart runs the unmodified plugin code (e.g., geolocator_web)
                   │ which calls navigator.geolocation.getCurrentPosition
                   │
                   ▼
Result → JSON → dart:js_interop → JS Promise resolves
```

### Architectural decisions

| Decision | Chosen | Why |
|---|---|---|
| **One Flutter Web app per Skal app, or one shared?** | **Per-app** (`examples/<app>/flutter-web-plugins/`) | Matches the framework / app boundary; each app declares its plugins; an app doesn't carry plugins it doesn't use |
| **Marshaling protocol** | **JSON via `dart:js_interop`** | Plugin calls are infrequent (user interactions, not per-frame). JSON is debuggable, no bridge-protocol overhead matters at these rates |
| **When to boot the hidden Flutter Web** | **Lazy on first plugin call**, with opt-in `prewarmPlugins()` | Apps without plugins pay nothing; apps that know they'll need plugins can prewarm during idle |

### Demo flow (Phase 4 deliverable)

```jsx
// kitchen-sink/src/App.jsx (JS tab)
import { useGeolocation } from '@skal/geolocator';

function GeoButton() {
  const [pos, setPos] = createSignal(null);
  return (
    <Column gap={8}>
      <Button label="Where am I?" onClick={async () => {
        const p = await useGeolocation();
        setPos(p);
      }} />
      {pos() && <Text label={`${pos().lat}, ${pos().lon}`} />}
    </Column>
  );
}
```

- **On native**: routes through the eventual native plugin-bridge protocol → Dart-side `package:geolocator` → returns position
- **On web (this plan)**: lazy-boots the hidden Flutter Web instance → Dart runs `geolocator_web` (unmodified) → returns position
- **First click on web**: ~1-2 s (Flutter Web boot) + actual call time. Subsequent clicks: ~ms.
- **Bundle**: app stays ~140 kB; Flutter Web (~3 MB) downloaded only after first click.

---

## Build phases

### Phase 0 — Unblock web (✓ done)

Two load-time crashes blocked the web target. Both fixed in this phase.

**Fix 1 — `bridge.js` module-load TypeError.**
[`packages/skal-js/src/bridge.js`](../packages/skal-js/src/bridge.js)
called `globalThis.__skal_acquireBridge()` at module load; that hook
only exists on native, so the import threw on web. Gated behind
feature-detection:

```js
export const HAS_NATIVE_BRIDGE =
  typeof globalThis.__skal_acquireBridge === 'function';

let buffer;
if (HAS_NATIVE_BRIDGE) {
  buffer = globalThis.__skal_acquireBridge();
  if (!buffer || buffer.byteLength !== BRIDGE_SIZE) {
    throw new Error(`Skal: bridge buffer not available (got ${buffer && buffer.byteLength})`);
  }
} else {
  // Web/test: zero-init ArrayBuffer. renderer-web.js doesn't read encoded
  // ops from this buffer (it speaks DOM directly), so the module can be
  // imported safely even when no native bridge exists.
  buffer = new ArrayBuffer(BRIDGE_SIZE);
}
```

**Fix 2 — `renderer-web.js` unknown-tag hard throw.**
The vite config comment claimed unknown intrinsics rendered through a
"degraded custom-node path" — they didn't; `createElement(tag)` threw
on the first unrecognized tag, blanking the page as soon as a codegen-
wrapped widget (`<greeting>`, `<qrImageView>`, `<shimmerFromColors>`,
…) appeared. Added the graceful fallback: a visible `<div
data-skal-unknown="…">` placeholder with a dashed outline and the tag
name, plus a once-per-tag `console.warn` pointing back at this plan.
Phases 1–5 replace the placeholder with the hidden Flutter Web host.

**Verified**: `bun --filter kitchen-sink dev:web` → kitchen-sink mounts,
tweet feed scrolls, console lists every custom tag (`greeting`,
`qrImageView`, `shimmerFromColors`, `counter`, `ticker`, `stickers`)
that needs the B.5 plugin host.

### Phase 1 — Hidden Flutter Web host (✓ done)

Create `examples/kitchen-sink/flutter-web-plugins/`:

```
flutter-web-plugins/
├── pubspec.yaml       # deps: flutter, geolocator (and whichever plugins are wanted)
├── lib/
│   └── main.dart      # runApp(SizedBox.shrink()) + registers __skalPluginCall
└── web/               # generated by `flutter create --platforms=web`
```

Boot sequence in `main.dart`:

```dart
import 'dart:js_interop';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

void main() {
  runApp(const SizedBox.shrink());  // no UI

  // Expose the dispatch entry point to JS.
  globalContext['__skalPluginCall'] = (_pluginCall as JSFunction);

  // Signal readiness so the JS-side lazy loader can resolve its boot Promise.
  globalContext.callMethod('dispatchEvent'.toJS,
      Event('skal-plugin-host-ready'.toJS));
}

@JS()
external JSPromise<JSString> _pluginCall(JSString name, JSString jsonArgs);
// Body dispatches on `name`, runs the plugin's Dart API, returns
// jsonEncode(result) wrapped in a JSPromise.
```

Verify: `flutter build web --release -t lib/main.dart` produces a
`build/web/` bundle that boots in a browser and exposes
`__skalPluginCall`.

**Implementation notes (deviations from sketch above):**

- The `_pluginCall` function is wired as an inline closure converted
  via `.toJS`, not through an `@JS() external` binding — `external`
  bindings are for importing JS into Dart; for exporting Dart to JS,
  the right pattern is `.toJS` on a function reference (see Dart's
  `FunctionToJSExportedDartFunction` extension).
- Boot signals are belt-and-braces: a `globalThis.__skalPluginHostReady`
  flag (sync-readable) AND a `skal-plugin-host-ready` window event. JS
  listeners that subscribe AFTER the host boots read the flag; ones
  that subscribe BEFORE catch the event.
- The dispatcher returns a `{ok, value | error, stack}` envelope so a
  Dart-side exception becomes a JS-side rejected Promise with a useful
  message, not a swallowed unhandled rejection.
- Build script: `bun run build:flutter-plugins` from the kitchen-sink
  package (wraps `flutter build web --release`).

### Phase 2 — JS-side lazy loader (✓ done)

New file: `packages/skal-js/src/plugin-bridge-web.js`.

Surface:

```js
// Lazy-boots Flutter Web on first call. Returns when ready.
export async function ensurePluginHost();

// Optional: prewarm during idle (e.g., requestIdleCallback)
export async function prewarmPlugins();

// The dispatcher every plugin shim calls.
export async function callPlugin(name, args);
```

Implementation sketch:

```js
let _bootPromise = null;

export async function ensurePluginHost() {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async () => {
    // 1. Mount an invisible 1×1 container — Flutter Web needs a real
    //    DOM node to mount into, but visibility can be off-screen.
    const mount = Object.assign(document.createElement('div'), {
      style: 'position:fixed;width:1px;height:1px;opacity:0;left:-9999px;pointer-events:none',
    });
    document.body.appendChild(mount);

    // 2. Inject Flutter Web's bootstrap script. The bundle is served
    //    from /flutter-web-plugins/ (see Phase 3 build wiring).
    const script = document.createElement('script');
    script.src = '/flutter-web-plugins/flutter_bootstrap.js';
    script.type = 'module';
    document.head.appendChild(script);

    // 3. Wait for Dart side to signal readiness.
    await new Promise((resolve) => {
      if (globalThis.__skalPluginCall) return resolve();
      window.addEventListener('skal-plugin-host-ready', () => resolve(),
          { once: true });
    });
  })();
  return _bootPromise;
}

export async function callPlugin(name, args) {
  await ensurePluginHost();
  const result = await globalThis.__skalPluginCall(name, JSON.stringify(args));
  return JSON.parse(result);
}
```

Add to `packages/skal-js/package.json` exports:
`"./plugin-bridge-web": "./src/plugin-bridge-web.js"`.

**Implementation notes:**

- Added `setPluginHostBase(base)` so apps with a non-default static
  layout can override the `/flutter-web-plugins` URL prefix.
- The boot Promise races `Promise.race([ready, scriptLoadFailed])` so
  a 404 on `flutter_bootstrap.js` rejects cleanly with a message
  pointing at `bun run build:flutter-plugins`, instead of hanging.
- `callPlugin` unwraps the `{ok, value/error}` envelope into a normal
  resolve/reject — plugin shims don't have to know about the protocol.
- Sets `globalThis.__skalPluginHostMount = mount` before injecting the
  bootstrap so the patched bootstrap (Phase 3) can pass it as
  `hostElement` to Flutter's `initializeEngine`. Without this, Flutter
  Web mounts directly under `<body>` and expands to fill the viewport
  — visible Flutter behind the DOM app.

### Phase 3 — Build pipeline wiring (✓ done)

Extend `examples/kitchen-sink/vite.config.web.js` so `bun run build:web` also runs
`flutter build web` inside `flutter-web-plugins/` and copies the output to
`dist/flutter-web-plugins/`:

```js
{
  name: 'skal-flutter-plugin-host',
  apply: 'build',
  closeBundle: async () => {
    const sub = path.resolve(__dirname, 'flutter-web-plugins');
    if (!fs.existsSync(sub)) return;
    execSync('flutter build web --release', { cwd: sub, stdio: 'inherit' });
    fs.cpSync(`${sub}/build/web`, 'dist/flutter-web-plugins', { recursive: true });
  },
}
```

For `bun run dev:web` (vite dev server), serve the pre-built bundle via a
`server.middlewares` hook so plugin calls work in dev too. Re-build is
opt-in (a `bun run build:flutter-plugins` task) — the Flutter build is
slow, doesn't need to run on every JS edit.

**Implementation notes (what the plan sketch didn't cover):**

The plan as originally sketched assumes Flutter Web's default bootstrap
works once you put the bundle under `/flutter-web-plugins/`. It
**doesn't**. Three fixes had to land:

1. **`config.entrypointBaseUrl`** so `flutter_bootstrap.js` fetches
   `main.dart.js` from `/flutter-web-plugins/`, not the page origin.
2. **`config.canvasKitBaseUrl`** for the same reason — otherwise
   CanvasKit's `.js`/`.wasm` 404s.
3. **`config.assetBase`** for Flutter's AssetBundle. Without it, engine
   init silently dies fetching `assets/AssetManifest.json` (gets the
   host's SPA-fallback HTML, throws `FormatException: Unexpected token
   '<', "<!doctype "... is not valid JSON` as an unobserved Promise
   rejection). This is the silent-hang failure mode that took the
   longest to diagnose.
4. **Custom `onEntrypointLoaded` callback** that reads
   `globalThis.__skalPluginHostMount` and passes it as `hostElement`
   to `initializeEngine`. Without this, the Flutter view mounts under
   `<body>` and fills the viewport — invisible because its child is
   `SizedBox.shrink()`, but it still steals layout space.
5. **Strip `serviceWorkerSettings`** from the bootstrap. The default
   SW registration is deprecated in Flutter Web anyway, and its fetch
   interception caused double-mount issues on dev reload.

All five live in `patchBootstrap()` inside the vite plugin, applied
both as a dev-time middleware on-the-fly rewrite and at build time on
the copied `dist/flutter-web-plugins/flutter_bootstrap.js`.

### Phase 4 — Geolocator end-to-end (✓ done)

1. Add `geolocator: ^11.0.0` to `flutter-web-plugins/pubspec.yaml`
2. In `flutter-web-plugins/lib/main.dart`, add a switch case:

```dart
case 'geolocator.getCurrentPosition':
  final pos = await Geolocator.getCurrentPosition();
  return jsonEncode({'lat': pos.latitude, 'lon': pos.longitude}).toJS;
```

3. Create JS shim `packages/skal-plugin-geolocator/src/index.js`:

```js
import { callPlugin } from 'skal/plugin-bridge-web';

export async function useGeolocation() {
  return callPlugin('geolocator.getCurrentPosition', {});
}
```

4. Add "Where am I?" button to kitchen-sink's JS tab (`examples/kitchen-sink/src/App.jsx`).

**Implementation notes:**

- The JS shim lives at `packages/skal-plugin-geolocator/` as a workspace
  package, exporting `getCurrentPosition()`. Named for the actual
  function rather than the hook-style `useGeolocation` since the API
  doesn't return a Solid signal.
- Geolocator version: `^14.0.0` (the sketch above said `^11.0.0`, but
  current pub.dev resolved cleanly to 14 with no breaking changes for
  `getCurrentPosition`).
- Demo lives at the top of the JS tab's probe groups (cleanest hook
  into the existing "capability probe" UI; the JS tab already auto-
  runs all probes on mount, so the first visit also primes the
  Flutter Web boot).
- The Dart-side route handles the permission request flow explicitly
  (`Geolocator.checkPermission` → request → throw if still denied).
- End-to-end wire verified via the `ping` route (the smoke-test
  payload built for exactly this): 0.14 ms avg / 0.6 ms p99 warm-call
  round-trip.

### Phase 5 — Verify (✓ done)

- ✓ `bun --filter kitchen-sink build:web` produces a 140 kB Skal JS
  bundle + `dist/flutter-web-plugins/` (40 MB on disk including all
  CanvasKit variants; over-the-wire ~3 MB compressed for the variant
  the browser actually picks).
- ✓ `bun --filter kitchen-sink dev:web` boots the demo unchanged from
  the native target.
- ✓ End-to-end plugin call works: `ping` round-trip = 0.14 ms avg /
  0.6 ms p99 once warm. Geolocator wire reaches Dart-side
  `package:geolocator`, which delegates to `geolocator_web`, which
  hits `navigator.geolocation` — final result depends on the user's
  browser permission grant (verified via the `ping` smoke route since
  permission prompting needs a real user gesture).
- ✓ `<flutter-view>` is correctly parented under the hidden
  `#skal-plugin-host` div (1×1, `left:-9999px`, `opacity:0`,
  `pointer-events:none`, `aria-hidden`). The only Flutter-emitted
  elements that remain under `<body>` are
  `<flt-semantics-placeholder>` and `<flt-announcement-host>` — those
  are accessibility helpers (screen-reader politeness-live regions)
  that Flutter intentionally places at document scope; they're already
  visually inert.
- ✓ Plugin host network chunks only fetched after the first
  `ensurePluginHost()` call — apps that never invoke a plugin pay 0
  bytes.

The auto-running probe in the JS tab fires `getCurrentPosition` on
first mount, which triggers the lazy boot — Flutter Web cold-boots in
~5–8 s in a fresh browser, well over the existing 3 s probe timeout.
The probe reports "timed out after 3000 ms" on first visit; a manual
"Re-run all probes" after Flutter has booted runs the call against the
live bridge. Treat that timeout as the cost of the JS tab's
auto-run-on-mount UX rather than a plugin-host defect.

---

## Shape C — `<FlutterEmbed>` (in progress)

Architecture landed; layout-timing bug pending.

The plugin host now boots in **multi-view mode** (`config.multiViewEnabled: true` + `runWidget(ViewCollection(...))` on the Dart side). The JS side exposes:

- `addFlutterView(hostElement) → viewId` — adds a Flutter view inside the given DOM element (the same engine handles all views).
- `removeFlutterView(viewId)` — removes it.
- `<FlutterEmbed widget="..." props={...} />` intrinsic — wraps the above as a Solid primitive: on mount it waits for first non-zero layout, calls `addFlutterView`, then `embed.setSpec` to tell Dart what to render. Props changes coalesce into a single `setSpec` per tick. Removal cleans up both sides.

Dart side has a widget registry (`_widgetFor` in `flutter-web-plugins/lib/main.dart`); start with `counter` + `greeting`; new widgets are one switch case.

**Status**: end-to-end wire verified — `addView → embed.setSpec → MultiViewApp picks up the new view + spec → Dart renders the widget`. Manual proof-of-life worked: a hand-added view at body level rendered "Flutter counter: 0" + a Material `+1 (Dart)` button (tap incremented Dart-side state).

**Known issue (open)**: when `<FlutterEmbed>` is mounted deep inside a flex layout (the kitchen-sink Libs tab is nested `Tabs > Tab > ScrollView > Section > Column`), the `flt-glass-pane`'s shadow-DOM `flt-scene-host` stays at `width:auto height:auto` after `addView`. The embed div, Flutter view container, and CSS sizing are all correct — only the internal scene-host bounds fail to update. Dispatching `window.resize` after addView doesn't recover. The same widget renders fine when added at `document.body` level with explicit pixel dimensions.

Best guess: Flutter Web 3.41's multi-view `ResizeObserver` on per-view scene-host doesn't fire when the host is inside a flex column with computed (rather than declared) dimensions. Needs more investigation — possibly an explicit `flutterApp.resizeView(...)` call or a `physicalSize` config field on `addView`.

For now the architecture is in place + a single-instance hand-mounted view works. Apps that need this can use `addFlutterView` directly with a position:fixed mount as a workaround.

## Shape D-skwasm — dart2wasm + skwasm support (shipped)

Shape D runs under `flutter build web --wasm` with the skwasm renderer.
`dev:web-flutter` and `build:web-flutter` both pass `--wasm`; the
kitchen-sink renders identically to the dart2js+canvaskit baseline.

### The problem `--wasm` introduces

Under dart2js, `ByteBuffer.toJS` is a cast — the Dart `Uint8List` and
the JS `Uint8Array` view the same ArrayBuffer, so the bridge protocol
just works. Under dart2wasm, Wasm linear memory is a separate address
space from the JS heap; `ByteBuffer.toJS` **copies** the bytes out at
the moment of the call. Publishing `bridge.buffer.toJS` as
`__skal_acquireBridge` would give JS a snapshot — every later Dart
write would be invisible to JS, and vice versa.

### The fix: dual buffer + slice sync at pump boundaries

`skal_ffi_web.dart` keeps two buffers:

- **JS-side canonical buffer.** `_Uint8Array(kBridgeSize)` allocated
  in the JS heap. Its `.buffer` is what `__skal_acquireBridge` hands
  to `bridge.js`. Everything JS does — ring writes from the encoder,
  drain reads, reply-heap accesses — lands here.
- **Dart-side mirror.** A `Uint8List(kBridgeSize)` in Wasm linear
  memory. `SkalBridge` holds `ByteData.sublistView(skal.bridge)` over
  this and never re-acquires it; the `final` reference stays stable
  for the bridge's lifetime.

`pumpOps` is wrapped:

```dart
void pumpOps() {
  skal.syncFromJs();   // JS heap → Wasm linear memory
  try { _pumpOpsBody(); }
  finally { skal.syncToJs(); }  // Wasm linear memory → JS heap
}
```

And `wakeJs` (which calls `__skal_drainEvents` inline since there's no
worker thread on web) brackets the drain with `syncToJs` / `syncFromJs`
the same way, so events Dart wrote reach JS, and any ops handlers
triggered come back to Dart.

### Slice sync — only copy the bytes that changed

A naive "copy the whole 6 MiB buffer each pump in both directions"
would cost ~12 MiB/pump regardless of actual traffic — even on idle
frames where nothing moved. The bridge layout (see `wire.dart`) makes
a much cheaper protocol possible:

```
[Header 64 B]   ← carries every region's write watermark
[Op ring        4 MiB ]  JS-write, Dart-read    (hOpWritePos)     bump
[JS string heap 768 KiB] JS-write, Dart-read    (hStrWritePos)    bump
[Reply heap     256 KiB] Dart-write, JS-read    (hReplyHeapWritePos) bump
[Event ring     ~1 MiB]  Dart-write, JS-read    (hEventWritePos)  circular
```

Three regions are bump-allocators (writePos grows monotonically; on
overflow the producer spin-waits for the consumer, then resets to 0).
One — the event ring — is a true circular ring with
`writePos = (pos + 16) % ringSize`. The slice algorithm has to handle
each shape correctly.

Per direction the sync is:

1. Copy the header (64 B) — small, gives us the fresh watermarks.
2. For each bump-allocated region:
   - `currentWp > lastSynced` → copy `[lastSynced, currentWp)`
   - `currentWp < lastSynced` → reset happened; copy `[0, currentWp)`
3. For the event ring:
   - `currentWp > lastSynced` → linear; copy `[lastSynced, currentWp)`
   - `currentWp < lastSynced` → **wrapped, not reset**; copy
     `[lastSynced, ringSize)` AND `[0, currentWp)`. Both ranges are
     new content — JS reads circularly via `(pos + 16) % ringSize`
     and will look at both.

`syncFromJs` handles the two JS-write bump regions (op ring + JS
string heap); `syncToJs` handles the reply heap (bump) + event ring
(circular). Each region's `_synced*Wp` watermark is a Dart-side int
field updated after each sync; watermark reads are clamped to the
region size defensively.

Cost profile per pump:

| Frame                | Bulk copy          | Slice copy            |
| -------------------- | ------------------ | --------------------- |
| Idle                 | ~12 MiB            | 128 B (2× header)     |
| 1000-op active frame | ~12 MiB            | ~33 KB                |
| Wrap / reset frame   | ~12 MiB            | ≤ current high-water  |

~50–200× cheaper than bulk on dart2wasm (each slice crosses Wasm↔JS
twice via `slice.toJS` then JS-side `set`); ~100–400× on dart2js
where `.toDart`/`.toJS` are casts and only the JS-side memcpy runs.
On idle frames both targets save ~100,000× over bulk.

Native gets no-op implementations of `syncFromJs` / `syncToJs` in
`skal_ffi_io.dart` — the FFI bridge buffer is genuinely shared
between bun and Dart, so no marshaling is needed.

#### Bump-allocator reset miss — Dart-side fixed, JS-side limitation

The bump-allocated regions reset to 0 on overflow. The producer is
supposed to spin-wait for the consumer to drain before resetting,
which is sound on native (separate threads). On web, JS and Dart
share the main thread, so the spin can never observe progress — it
times out (5 s for JS, 50 ms for Dart) and the producer resets
blindly. The protocol was already fragile here before slice sync.

The slice algorithm adds one specific failure mode in that scenario:
if the post-reset writes push `currentWp` *past* the pre-sync
`lastSynced`, the regression detector misses it (`currentWp >
lastSynced`, so we take the monotonic branch and copy only
`[lastSynced, currentWp)`). The consumer sees the stale tail of the
old content at `[0, lastSynced)` of the new batch.

**Reply heap (Dart-owned) — fixed via in-process signal.** The
producer (`_writeReplyString` in `bridge.dart`) now calls
`skal.markReplyHeapReset()` immediately after the wraparound reset.
The web-side `Skal` keeps a `_replyHeapResetPending` flag; the next
`syncToJs` sees it, copies the full `[0, replyWp)` regardless of the
regression check, and clears the flag. On native the method is a
no-op (the FFI bridge buffer is genuinely shared between bun and
Dart, so there's nothing to sync). The most realistic trigger — a
single large RPC reply (image-picker XFile, controller state dump)
filling more than `kReplyHeapSize - _syncedReplyWp` — is now sound.

**Op ring + JS string heap (JS-owned) — still limited.** The same
producer-signal approach would require a JS-side write into a header
slot we read here; that's a wire-format change. Reachable only by
writing ~4 MiB of ops or ~768 KiB of strings in a single JS turn,
which already produces a 5-second freeze + console warning from
`flushAndWaitForDrain`'s spin timeout — i.e. the protocol is already
broken before slice sync makes it worse. Tracked for follow-up.

The proper fix shape for both — a per-region reset-epoch counter in
the header — has 16 B of free space in the 64 B header for the four
u32 counters needed. Wire-format change + `wire_test.dart` snapshot
update. Deferred until something forces it.

### The extension-type wrapper

Dart's built-in `JSUint8Array` exposes `.toDart` (for materializing
bytes back into a Dart `Uint8List`) but not the three methods the
slice protocol needs:

- `.buffer` — to hand JS the underlying ArrayBuffer for the bridge
  protocol (`__skal_acquireBridge`).
- `.subarray(begin, end)` — a no-copy JS-side view of a slice;
  `.toDart` on the subarray then materializes just that slice on the
  Dart side.
- `.set(source, offset)` — to write a Dart-produced slice into a
  specific region of the JS-side canonical buffer in one call.

`@JS('Uint8Array') extension type _Uint8Array._(JSUint8Array _) implements JSUint8Array`
adds the three missing externals without losing the built-in
conversions. See `skal_ffi_web.dart` for the full annotation.

### Threading caveat — needs cross-origin isolation

skwasm supports multi-threaded raster via Web Workers + SharedArrayBuffer,
but the browser only exposes SAB to pages served with:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The dev server (`flutter run -d chrome --wasm`) sets these by default,
so `dev:web-flutter` gets threaded skwasm. Static hosts and most CDNs
don't — `crossOriginIsolated` reads `false` in production and skwasm
silently falls back to single-threaded. The slice-sync bridge works
either way (SAB wouldn't help the bridge itself — JS and Dart are on
the main thread regardless; SAB would let skwasm fan raster across
workers, which is orthogonal to the bridge protocol).

If/when the bridge itself moves to SAB — JS allocates a SAB, both
sides view the same memory, sync becomes a no-op — `syncFromJs` and
`syncToJs` would early-return when SAB is available, with the slice-
copy path as the fallback. The current dual-buffer code is the
correct shape for that evolution: nothing in `bridge.dart` changes.

## Future extensions (NOT in this plan)

- **More plugins** — file picker, share, biometric. Each is one switch case in Dart + one JS shim. Half-day each.
- **prewarmPlugins() opt-in** — apps that know they'll need plugins call this during idle (after first paint, on user-interaction signal) to hide the first-click latency.
- **Plugin-shim publishing** — each `@skal/<plugin>` package shipped as a workspace package under `packages/skal-plugins/<name>/`, with both a native implementation (when the native plugin-bridge lands) and the B.5 web implementation.
- **Auto-routing codegen widgets through `<FlutterEmbed>`** — once Shape C is stable, the `_widgetFor` registry on the Dart side could be auto-generated from `skal_codegen.json` so every `<Greeting>` / `<QrImageView>` / `<Camera>` / etc. that today renders as a placeholder on web instead routes through Flutter via Shape C automatically. No app-level API change.

---

## What we're NOT doing

- **Shape A** (per-widget Flutter mounts inside DOM tree). Layout / event coordination is intractable.
- **Web port of libskal**. Compiling bun + JSC to WASM is multi-month engineering for marginal benefit; the browser already has a JS engine.

---

## Tracking

Phases 0-5 done. The plan as written is fully implemented.
Shape D ships under both dart2js+canvaskit and dart2wasm+skwasm.
*Last updated: 2026-05-25. Phases 0–5 done; Shape D-skwasm shipped.*
