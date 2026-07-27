# Changelog

## 0.2.0

### Changed

- `SkalBridge.skal` is typed `SkalRuntime` (the 9-member interface in
  `skal/runtime.dart`) rather than the concrete `Skal`, so the op-drain
  path can be tested without a 60 MB `dlopen`. `Skal` implements it;
  reach for runtime members outside the interface (`dispose`,
  `evaluateApp`, `wasReused`, `prewarmStore`, …) on the `Skal` you
  constructed, not through the bridge.
- `EvalResult` moved to `skal/runtime.dart`; both targets re-export it,
  so `import 'package:skal_flutter/skal_ffi.dart'` is unaffected.

### Fixed

- A UI op committed in the same JS tick as a service call could take
  hundreds of milliseconds to paint, or never paint until unrelated
  traffic arrived — `setLoading(true); api.fetch()` in one handler is
  the shape. The off-frame drain applies such a batch and defers widget
  notification to the next frame drain, which returned early on an empty
  ring and never flushed. Measured 366 ms to first paint (p95 978 ms)
  against 11.5 ms for the same prop written alone. See
  `docs/TODO_OPTIMIZATIONS.md` §2c.
- Cupertino design crashed on any `<screen title>` containing a Material
  widget that needs an ink host: `_screenChrome`'s Cupertino branch
  returned a bare `CupertinoPageScaffold`, which hosts no `Material`, so
  the child threw "No Material widget found". No design switching
  involved — a pure Cupertino app hit this.
- The native `<HtmlEmbed>` placeholder drew nothing. `Color(0xFFD33)` is
  CSS `#D33` with an alpha prefix, which Dart parses as `0x000FFD33` —
  alpha `0x00` — so the border and the label were both fully
  transparent and the "visible placeholder" was an empty pink box.
- Switching design mode at runtime left the tree rendered half in each
  design. Node subtrees are cached until the node's own notifier fires,
  so the flip reached almost nothing; `opSetDesign` now invalidates every
  node when the mode changes (a brightness-only change still does not).

### Added

- `SkalRuntime` + a test seam for it. See `docs/TESTING.md` § Testing
  anything that needs a bridge.

## 0.1.0

First published release.

- `SkalBridge` — zero-copy op pump over the shared-memory bridge that
  libskal exposes; reifies the JS-produced node tree.
- `SkalRoot` / `SkalApp` — mount a live Solid tree as Flutter widgets.
- Custom-widget adapter registry + codegen'd adapters.
- Dialog/file-picker primitives dispatched from JS.
- FFI bindings for the `skal_*` C ABI (`Skal.create`, `evaluate`,
  bridge acquisition, store prewarm).
- JS hot-reload client (debug builds).

Pairs with the JS-side `skal` package and the prebuilt `libskal`
binaries — scaffold an app with `npm create skal my-app`, which wires
all three together.
