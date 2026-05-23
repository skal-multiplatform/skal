# skal_native — Skal C ABI surface

Sibling package to [`skal-js`](../skal-js/) (JS framework) and
[`skal_flutter`](../skal_flutter/) (Dart framework). This one is the
**raw C boundary** that libskal exposes — what any non-Dart embedder
(direct C/C++, Swift Package, future Obj-C SDK, future Kotlin/Native
binding) would link against.

There's no language-package-manager metadata here. The implementation
lives in [`patches/skal_entry.zig`](../../patches/skal_entry.zig)
(compiled into libskal alongside bun + JSC). This package just owns
the **header contract** + a couple of small platform shims.

## Layout

```
packages/skal_native/
├── include/
│   └── skal.h                  # the public C ABI — 7 functions
├── ios/
│   └── skal_iossim_shim.c      # __clear_cache shim for iOS Simulator
└── README.md
```

## The seven functions

| Function | What it does |
|---|---|
| `skal_create_runtime()` | Spin up bun's worker + JSC; returns an opaque handle |
| `skal_dispose_runtime(h)` | Tear it down |
| `skal_evaluate(h, source, url, …)` | Run a JS Program synchronously |
| `skal_acquire_bridge(h, &ptr, &len)` | Hand out the 2 MiB shared op buffer |
| `skal_wake_js(h)` | Wake the JS worker for host-emitted events |
| `skal_free_string(s)` | Release a buffer that `skal_evaluate` returned |
| `skal_prewarm_store(h, dir, len)` | Background-open the native KV store |

The Dart-side mirror is [`packages/skal_flutter/lib/skal_ffi.dart`](../skal_flutter/lib/skal_ffi.dart);
it must stay in lock-step with `include/skal.h`. Drift is silent —
wrong arg ABI just crashes on first call. There's no cross-language
test for the FFI shape itself (only the wire format inside the bridge
buffer is cross-checked, via `wire_cross_lang_test.dart`).

## iOS Simulator shim

`ios/skal_iossim_shim.c` provides `__clear_cache` because macOS's
libSystem exports it but iOS Simulator's doesn't. JSC's JIT codegen
*references* the symbol (to invalidate the i-cache after writing
instructions) but JIT is disabled on iOS anyway, so the symbol is
unreachable in practice — the linker just needs a definition at load
time. `scripts/link-skal-iossim.sh` compiles + links this file into
the iOS Simulator libskal.

On macOS, Android, and iOS device, no shim is needed; libSystem (or
Bionic on Android) provides everything.

## Status

Private workspace package. No external distribution today. If Phase 3
of [RESTRUCTURE.md](../../docs/RESTRUCTURE.md) ever happens, the
header here is what would ship as a public C SDK — likely a CocoaPod
+ Swift Package + a Conan/vcpkg recipe for non-Apple platforms.
