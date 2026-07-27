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
- Setting a cold prop to `null` did nothing, so a conditional prop could
  be turned on but never off — `color={active ? Colors.red : null}`
  stayed red once it had been red. `null` now removes the key and the
  widget's default applies. New op `opClearProp` (0x2D); older hosts skip
  unknown fixed-size ops harmlessly.
- The reply heap's wraparound spin-waited on the UI thread for up to
  50 ms and then rewound regardless of whether JS had read the bytes it
  was about to clobber — a freeze that did not even buy correctness. On
  Flutter Web it could not work at all: the loop re-read a mirror word
  that only refreshes at pump boundaries, on a thread JS shares. Events
  whose payload does not fit are now queued behind the same overflow
  queue a full event ring uses and delivered on a later pump, in order.
- Payloads larger than the whole 256 KiB reply heap were truncated
  mid-UTF-8, handing the receiver a string that fails to decode.
  Truncation now lands on a codepoint boundary and logs in debug. A
  value that large still cannot be delivered whole — that needs chunked
  payload ownership on the wire. Such a payload also spans the entire
  heap, so it now waits for JS to drain like any other write instead of
  clobbering every live reference.
- Clearing a stack-positioning prop (`top`/`right`/`bottom`/`left`) did
  not re-dirty the parent `<stack>`, so the child stayed pinned at the
  offset that had just been removed. `opClearProp` now mirrors
  `opSetPropU32`'s follow-ups, and the two paths share their test.
- Queued events survived a hot reload, dispatching into a JS registry
  that no longer existed and pinning every deferred payload string for
  the life of the process. Both overflow queues are cleared by the tree
  sweep, and retained payloads are now capped (~4 M chars) with one
  diagnostic rather than growing until the app dies.

### Added

- `SkalRuntime` + a test seam for it. See `docs/TESTING.md` § Testing
  anything that needs a bridge.
- `opClearProp` (0x2D) — remove a built-in cold prop from all three
  typed maps, the enum-keyed counterpart of `opClearCustomProp`.

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
