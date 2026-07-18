# Engine choice — JS runtime + host renderer

Decision record. Captures **why** Skal is bun + JSC + Flutter rather
than any of the obvious alternatives, so future re-evaluation has a
starting point.

Last reviewed: 2026-05-12.

---

## TL;DR

- **JS runtime:** bun + JavaScriptCore, statically linked into libskal.
- **Host renderer:** Flutter on Android / iOS / macOS / Linux / Windows.
- **Web target:** Solid + DOM directly by default; Flutter Web (wasm) is also
  available for the live component showcase and plugin-heavy screens.

The JS runtime choice is load-bearing for performance + Web API
parity with Node/Bun. The host renderer choice is load-bearing for
the cross-platform native-plugin ecosystem.

---

## JS runtime — bun + JavaScriptCore

### Hard constraints (anything missing these is out)

1. **No JIT on iOS.** Apple disallows JIT in App Store apps. The
   runtime must work in interpreter / AOT / bytecode-cached mode.
2. **Standards-conformant Web APIs.** `fetch`, `URL`, `TextEncoder`,
   `Atomics`, `Streams`. Skal apps are JS apps; they expect a
   browser/node-equivalent global surface.
3. **Bytecode cache.** Cold-launch parse cost must be skippable.
4. **Linkable as a single .so / .dylib.** We embed the runtime in
   the host process; no out-of-process IPC.
5. **`FinalizationRegistry`** — Solid's universal renderer wants it
   for cleanup hooks. Spec-conformant impl required, not "exists but
   leaks under certain shapes".

### Candidates considered

| Engine | Notes | Verdict |
|---|---|---|
| **bun + JSC** | What we shipped. JSC is mature (Safari's engine), full Web Standards in interpreter mode, no JIT path on iOS. Bun gives us native `fetch`/`URL`/`Streams` for free — Node-style global surface implemented in Zig + WebKit's WTF utilities. Embeddable as a static lib (we vendor it and link). ~87 MB on Android arm64. | **chosen** |
| **QuickJS-NG** | Tiny (~400 KB), pure interpreter, no JIT — iOS-clean. Predictable bytecode cache. Smaller memory footprint than JSC (~50% less per-process). **But:** doesn't ship `fetch`/`URL`/`Streams`/`Response` — we'd write them all ourselves. ~3× slower than JSC on Octane and most real-world benchmarks. | **rejected** — building Web API parity from scratch is years of work |
| **Hermes** | Facebook's RN engine. AOT-compiled bytecode (no JIT, iOS-clean), tuned for RN's specific access patterns. Cold-start beats JSC on cold-RN apps. **But:** Hermes is RN-flavored — its module loader assumes RN's bundler shape; ES module support is incomplete; no native fetch. Embedding outside RN requires more work than QuickJS. | **rejected** — RN-coupled, Web API gap |
| **V8** | Fastest JS engine in steady state. Used by Node, Chrome. **But:** mandatory JIT means it's banned on iOS App Store. Could ship `--jitless` but that gives up the perf advantage. No native Streams or Fetch — would build on top. | **rejected** — iOS-blocked |
| **Static Hermes** | Newer fork with optional AOT. Same RN bias. Less mature than Hermes. | **rejected** — same as Hermes plus maturity risk |
| **Boa (Rust)** | Pure-Rust interpreter. Memory-safe, clean integration story. **But:** slow (~10× JSC on Octane), incomplete ECMA spec, no Web APIs. Single-maintainer-ish. | **rejected** — not production-ready |

### Decisive arguments for bun + JSC

- **Web API parity.** A Skal app should be able to write `await fetch(...)`
  and have it work. Bun ships a WHATWG-spec `fetch` over native HTTP/2,
  TLS, gzip — same shape as Node 18+'s undici-backed fetch. None of the
  alternatives ship this; the cost of building it from scratch is
  multi-month engineering.
- **JSC is fast in interpreter mode.** No-JIT JSC is faster than
  no-JIT V8 and ~2-3× faster than QuickJS on Octane. For an
  interpreter-bound stack (iOS App Store + bytecode cache), this
  matters.
- **Static linkable.** `libskal.so` / `.dylib` bundles JSC + bun's
  Zig glue + our bridge code into one shared library; the host
  links via dart:ffi and gets the whole runtime. Minimal embedder
  ceremony.
- **`Bun__REPL__evaluate` is the ergonomic eval entry point.**
  Returns a string for the result, surfaces exceptions, drains
  microtasks at the right moments. We pass through this from the
  host with three lines of FFI.

### What we give up

- **Binary size.** libskal is 87 MB on Android arm64 (33 MB
  compressed in the APK). QuickJS would be 1-2 MB. For an app that
  wants <50 MB total download, this is a real cost.
- **iOS port effort.** Cross-compiling bun + WebKit to iOS arm64
  takes several days the first time. QuickJS would be ~an hour.
- **Memory.** JSC is the largest of the candidates by RAM footprint.

These costs are real but bounded — they don't grow as we add
features. The Web API parity benefit, by contrast, would grow
linearly as we tried to backfill `Streams`, `URL`, `crypto`,
`Headers`, `Response`, etc. against a smaller engine.

### Trigger to revisit

- **Bun stops shipping** or fragments support for embedding.
- **App download size becomes the binding business constraint**
  (e.g. shipping to low-storage devices). At that point QuickJS +
  hand-written fetch is the alternative.
- **JSC's no-JIT performance regresses** vs Hermes on Skal-shaped
  workloads (unlikely; both have had years of tuning).

---

## Host renderer — Flutter

### Hard constraints

1. **All major platforms.** Android, iOS, macOS, Linux, Windows.
   Web via a separate target (we use Solid + DOM there).
2. **Native plugin ecosystem.** Camera, geolocation, biometrics,
   file picker, push notifications — all must be available without
   writing per-platform Kotlin / Swift / C++.
3. **dart:ffi-level bridge.** Direct C calls into libskal. No
   platform-channel serialization in the hot path.
4. **AOT compilation.** No JIT in shipped apps.
5. **Mature.** > 5 years in production at scale.

### Candidates considered

| Renderer | Notes | Verdict |
|---|---|---|
| **Flutter** | Mature on 6 platforms. Massive plugin ecosystem (pub.dev — tens of thousands of packages, federated platform support). dart:ffi for sync FFI. AOT compiler ships native arm64/x86_64 binaries. Backed by full-time Google engineering. | **chosen** |
| **React Native** | Massive plugin ecosystem (the gold standard for "RN replacement" feature parity). **But:** the whole point of Skal is to be "RN but faster" — RN's old bridge is the perf bottleneck Skal eliminates. Going back to RN gives up the architectural advantage. New Architecture (Fabric/JSI) closes some of the gap but still defaults to React's reconciler, which is slower than Solid. | **rejected** — defeats the purpose |
| **Capacitor / Tauri (WebView-based)** | Real native UI via WebView's already-correct OS chrome. **But:** WebView is slow, has memory issues at scale, and the rendering layer is HTML/CSS — not the native widget look the spec calls for. | **rejected** — wrong rendering model for our perf bar |
| **Native per platform** (Compose Android / SwiftUI iOS / etc.) | True native UI. **But:** N codebases. Doesn't match the "write once" thesis. Also: per-platform native still needs the JS bridge solved, which is the actual hard problem. | **rejected** — defeats the cross-platform thesis |

### Decisive arguments for Flutter

- **Plugins.** pub.dev has tens of thousands of packages with
  federated platform support — official `camera`, `geolocator`,
  `local_auth`, `file_picker`, `share_plus`, `in_app_purchase`,
  `connectivity_plus`, etc. For an RN replacement, plugins ARE
  the product.
- **AOT-compiled Dart.** `libapp.so` is native arm64 code; cold-start
  with bytecode cache hit is ~50 ms.
- **Impeller (Vulkan on Android, Metal on iOS).** Pre-compiled
  shaders, no first-animation jank.
- **dart:ffi.** Same shape as the C ABI we already have. No
  platform-channel serialization in the hot path.
- **Pixel-uniform rendering across platforms.** Skia/Impeller
  paints the same on all targets. Cupertino library mimics iOS
  look closely enough that 99% of users won't notice the
  difference from real UIKit.

### What we give up

- **Not literally native UIKit on iOS.** Flutter renders through
  its own engine, not Apple's platform widgets. Cupertino widgets
  are the closest we get — physically-modeled iOS scroll,
  native-looking navigation transitions, accurate text shaping.
  Pixel-level inspection reveals it's drawn, not platform-native.
- **Dart is fine, not great.** Pragmatic. The JS layer is what
  Skal devs write; Dart is host-only and invisible from the JSX
  side.
- **Flutter Web is ~5 MB CanvasKit.** The DEFAULT web target sidesteps
  this by using Solid + DOM (no engine download) — same JS bundle,
  different host. Flutter Web (wasm) is available as an opt-in for the
  live component showcase and plugin-heavy screens, where a real Flutter
  render is the point and the download cost is acceptable.

### Trigger to revisit

- **Flutter team cancellation or major rewrite** (very low
  probability; Flutter is Google's strategic cross-platform bet).
- **Apple bans engine-rendered UI on iOS** (no signal in any
  direction; would also kill RN-with-Hermes, etc.).

---

## Web target — Solid + DOM by default (Flutter Web wasm available)

### Rationale

Flutter Web ships CanvasKit (~5 MB engine download). Skia drawing
on HTML5 Canvas. Works, but:

- 5 MB engine to download
- Accessibility is custom (Flutter's a11y bridge to ARIA is partial)
- Browser dev tools don't see widgets
- SEO is hard (CanvasKit doesn't emit semantic HTML)

For an app whose primary distribution model is the App Store + Play
Store, Web is an "also-ship" channel. CanvasKit isn't justifiable
when we already have:

- Solid.js's standard DOM renderer (`solid-js/web`)
- `packages/skal-js/src/renderer-web.js` already wired to use it
- Same JSX, same components, same skal-app bundle — different
  imports decided at build time via vite alias

Web target ships as a static site (HTML + JS + CSS), zero engine
download, gets SEO and a11y for free.

**Flutter Web (wasm) is now available too**, for the cases where the
DOM renderer isn't enough: the live component gallery (real Flutter
widgets, compiled to WebAssembly) and screens that need a pub.dev plugin
with no DOM equivalent. It's opt-in per build, not the default — the
three web shapes are Solid→DOM (default, SEO/size), Flutter Web wasm
(showcase/plugins), and static prerender (SSG) for SEO on either.

### Trigger to revisit

- **CanvasKit Wasm becomes <500 KB and tree-shakeable** (no signal).
- **DOM gains a "draw widgets as Skia" surface** (very low
  probability).
