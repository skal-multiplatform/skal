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

#### Bump-allocator reset detection — signalled, not heuristic

The bump-allocated regions reset their write cursor to 0 on overflow.
The slice algorithm's regression heuristic (`currentWp < lastSynced` ⇒
reset) misses one case: a post-reset write that lands *above* the
pre-sync `lastSynced` looks like monotonic growth, so the copy takes
`[lastSynced, currentWp)` and the consumer sees the stale tail of the
old content at `[0, lastSynced)` of the new batch. Both reset paths are
now signalled explicitly rather than inferred — the mechanism matches
where each producer lives:

**Reply heap (Dart-produced, in-process).** `_writeReplyString` in
`bridge.dart` calls `skal.markReplyHeapReset()` right after the
wraparound reset; the web-side `Skal` zeroes `_syncedReplyWp`, so the
next `syncToJs` re-copies the full `[0, replyWp)`. No wire traffic — the
producer and the sync run in the same isolate.

**Op ring + JS string heap (JS-produced, across the bridge).** JS bumps
a new `hJsResetEpoch` header word in the same `publishProgress` store
that writes the post-reset positions (so the web mirror always reads a
consistent `{writePos, epoch}` snapshot). `syncFromJs` caches the last
epoch it saw; on a change it drops both `_syncedOpWp` and `_syncedStrWp`
to 0 (they only ever reset in lockstep) and re-copies `[0, writePos)`.
On native this is inert — the FFI buffer is shared, so Dart observes the
reset directly and `syncFromJs` is a no-op.

There are *two* checkpoints that must rewind on a reset: the slice-copy
watermarks above (in `skal_ffi_web.dart`) **and** the decoder's
`_lastDrainedWritePos` (in `SkalBridge._drain`). The decoder's own
writePos-regression heuristic only catches a reset when the post-reset
writePos lands *below* the old checkpoint — true on native (reset only at
~4 MiB ring-full) but NOT on web, where a reset can fire on a string-heap
overflow at a lightly-filled op ring, so consecutive same-size chunks land
writePos right at the old checkpoint and the chunk would be skipped. So the
epoch reset is forwarded to the decoder via `skal.takeOpRingReset()`, which
rewinds `_lastDrainedWritePos` too. (Found by the stress route — the copy
fix alone silently dropped the first chunk.)

**Verifying it** — load the kitchen-sink web build with
`?stress=<count>` (e.g. `http://localhost:5176/?stress=1500`). That swaps
in `examples/kitchen-sink/src/StressOverflow.jsx`: a synchronous mount of
N rows each carrying a ~1.5 KB label, which overflows the 768 KiB string
heap several times in one turn. Console logs `[skal-stress] … overflow
resets = N`; the list must render starting at "Row 0" in order (it started
at "Row 633" before the `_lastDrainedWritePos` fix). `globalThis.__skal_opRingResets`
holds the running overflow count.

#### Op-ring overflow — inline drain instead of a futile spin (web)

On native, `flushAndWaitForDrain` spins on `hLastDrainedSeq` until the
consumer (a separate thread) drains, then rewinds the ring. On web JS and
Dart share the main thread, so that spin can *never* observe progress — it
would burn its 5 s budget and then overwrite undrained ops (data loss +
freeze). So the web host installs `globalThis.__skal_drainOpsSync` (a thin
wrapper over `SkalBridge.pumpOps`), and `flushAndWaitForDrain` calls it to
pump the consumer **inline** when present — the op-ring counterpart to
`wakeJs` → `__skal_drainEvents`. A large mount now drains in ring-sized
chunks with no freeze and no loss. Reentrancy (an RPC reply / event
handler that itself overflows mid-drain) is bounded by two guards —
`inSyncDrain` in `bridge.js` and `_pumping` in `SkalBridge` — which fall
back to a blind rewind for that rare case. Native is unchanged (it
installs no hook, so it keeps the concurrent-thread spin). The hook is
installed *before* the bundle is injected so the initial mount can use it.

#### Header ownership — `syncToJs` pushes only Dart-owned words

The 64 B header is co-written: JS owns `hOpSeq` / `hOpWritePos` /
`hStrWritePos`, the consumer read cursors `hEventReadPos` /
`hReplyHeapReadPos`, and `hJsResetEpoch`; Dart owns `hEventSeq` /
`hEventWritePos` / `hLastDrainedSeq` / `hReplyHeapWritePos`. A blanket
`[0, 64)` push in `syncToJs` would stomp the JS-owned words with Dart's
mirror copy — which can be stale, because JS advances `hOpSeq` /
`hOpWritePos` from a `queueMicrotask(commit)` that runs *after* the last
`syncFromJs`. The clobber silently regresses JS's op watermark (the next
drain misses those ops until JS's next commit re-publishes) and rewinds
JS's read cursors (re-draining consumed events). So `syncToJs` pushes
only the three contiguous Dart-owned runs, each bounded by the next
JS-owned word. The reverse pull in `syncFromJs` stays a full-header copy
— safe, because JS never writes the Dart-owned words, so pulling them
back is an identity.

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

### Enabling threaded skwasm via COOP/COEP

skwasm runs raster on Web Worker threads when the page is
"cross-origin isolated" — `window.crossOriginIsolated === true`.
Typically 2–4× faster raster on multi-core machines for animation,
scrolling, and complex paint trees. Browser exposes the isolation
state when the host sends:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The dev server (`flutter run -d chrome --wasm`) sets these
automatically, so `dev:web-flutter` gets threaded raster for free.
Production deploys need explicit configuration; one-liner per major
host:

```yaml
# Netlify / Cloudflare Pages — public/_headers
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

```jsonc
// Vercel — vercel.json
{ "headers": [{ "source": "/(.*)", "headers": [
  { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
  { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
]}]}
```

```jsonc
// Firebase Hosting — firebase.json
{ "hosting": { "headers": [{ "source": "**", "headers": [
  { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
  { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
]}]}}
```

```nginx
# Nginx
add_header Cross-Origin-Opener-Policy   "same-origin"  always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

**Third-party content compatibility:** `require-corp` rejects
cross-origin subresources (images, scripts, iframes) that don't
opt in via `Cross-Origin-Resource-Policy: cross-origin` or CORS.
Common breakage: Google Analytics, YouTube embeds, Stripe iframes,
non-CDN third-party images. For sites that need such embeds, the
looser `Cross-Origin-Embedder-Policy: credentialless` variant
allows third-party loads without credentials (cookies) instead of
requiring CORP. Supported in modern Chrome / Firefox / Safari 17.4+.

**Verifying it's on:** the kitchen-sink boot probe in
`main_web.dart::_logIsolationState` writes one line on first paint:

```
[skal] threading: isolated=true,  sab=true, cores=8 — threaded skwasm should be active
[skal] threading: isolated=false, sab=false, cores=8 — single-threaded raster (set COOP/COEP …)
```

Also stashes the diagnostic on `globalThis.__skal_isolation_info` so
DevTools / apps can inspect it programmatically.

**Measuring the impact correctly — use INP, not FPS.** rAF frame-time
sampling is the *wrong* tool to measure threading. On any non-trivial
GPU it'll show 60 Hz on both configurations — the display refresh
rate caps `requestAnimationFrame` and skwasm fits a typical
kitchen-sink frame comfortably under 16.7 ms either way. The threading
benefit hides because the *average* frame isn't bottlenecked.

The real win shows up in **INP (Interaction to Next Paint)**, Chrome's
Core Web Vital for input responsiveness. Threading lets the main
thread dispatch pointer events while last frame's raster is still in
flight on a worker; single-threaded skwasm has to finish raster before
the next pointer event can be processed. Concrete kitchen-sink
measurements via DevTools → **Performance → Interactions** panel:

| Workload                | Non-isolated INP | Isolated INP |
| ----------------------- | ---------------- | ------------ |
| Pointer (scroll, tap)   | 56–80 ms         | 24–40 ms     |
| Event target attribution | mostly `<node>` (delayed) | always `flutter-view` (immediate) |

The ~2× INP improvement is exactly what the Flutter team's "2–4×
faster raster" claim folds into — it's not about peak FPS, it's
about freeing the main thread to handle input + widget rebuild while
raster runs in parallel.

To run this comparison yourself: open the page in Chrome → DevTools
→ Performance Insights → click Interactions tab → record while
scrolling / tapping. Compare INP rows between
`http://localhost:5174/` (non-isolated, fallback path) and
`http://localhost:5176/` (isolated, via `scripts/serve-isolated.js`).

### Why the bridge doesn't change with isolation

Worth being explicit: the bridge stays on slice-sync regardless of
isolation. I previously sketched a "SAB-aware buffer alias" path
that would replace `syncFromJs`/`syncToJs` with no-ops on isolated
origins. After measuring the actual costs, slice-sync wins on
dart2wasm anyway:

| Path                  | Drain reads / pump | Sync work / pump      |
| --------------------- | ------------------ | --------------------- |
| Slice-sync (current)  | 4 K × ~1 ns Wasm LDR | 5–50 µs slice memcpy  |
| Aliased via `toDart`  | 4 K × ~10–30 ns JS interop | 0                   |

Aliasing turns each ByteData getter (`_data.getInt32(p, …)`) into a
JS interop call. Wasm linear memory loads are ~10–30× cheaper. The
~40–120 µs per pump of interop overhead exceeds the ~5–50 µs of
slice memcpy we'd save. On dart2js it would be strictly better
(`.toDart` is a cast), but we're targeting dart2wasm so slice-sync
stays. The threading benefit lives entirely in the skwasm engine,
not in the bridge.

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
