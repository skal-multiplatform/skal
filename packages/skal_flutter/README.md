# skal_flutter — Dart half of the Skal framework

Pair package to JS-side [`skal`](../skal-js/README.md). This is the
host-side bridge implementation: it pumps ops out of the shared
buffer that libskal exposes, reifies them as a tree of Flutter
widgets, and drives the dispatch loop that lets JS call Dart
back (custom-widget RPCs, dialogs, callbacks).

## What it exports

Top-level Dart library entry: `package:skal_flutter/skal_flutter.dart`
re-exports the public surface. Modules:

| Module | Purpose |
|---|---|
| `package:skal_flutter/skal/bridge.dart` | The op-pump + dispatcher |
| `package:skal_flutter/skal/registry.dart` | Custom-widget adapter registry |
| `package:skal_flutter/skal/root.dart` | `SkalRoot` + `SkalApp` widget mount |
| `package:skal_flutter/skal/dialogs.dart` | `showDialog` etc. — bridge → host |
| `package:skal_flutter/skal/wire.dart` | Wire-format constants (mirror of JS bridge.js) |
| `package:skal_flutter/skal_ffi.dart` | dart:ffi bindings into libskal |

## Status

Private workspace package. Apps depend on it via path:
```yaml
dependencies:
  skal_flutter:
    path: ../../../packages/skal_flutter
```

See [`docs/RESTRUCTURE.md`](../../docs/RESTRUCTURE.md) for the boundary
plan and the eventual public-distribution story.

## Native side

The actual libskal binary (built from `vendor/bun/` + `patches/skal_entry.zig`
via `scripts/link-libskal-flutter-*.sh`) lives with the consuming app's
platform configs today — see `examples/kitchen-sink/flutter-host/`
for the working layout. A future iteration would package the prebuilt
binaries into this package's `runtime/libskal/` so new apps don't
have to wire them up.
