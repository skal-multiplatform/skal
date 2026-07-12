# Changelog

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
