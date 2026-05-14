# Skal — Flutter library wrapping

Open items in the custom-widgets / codegen arc. The pipeline can
already wrap most real pub.dev packages today — see
[`WRAPPING_PUB_PACKAGES.md`](WRAPPING_PUB_PACKAGES.md) for the
end-to-end DX. This doc tracks what's still gap.

For platform plumbing (Android/iOS Frameworks, asset extraction)
see [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md).
For perf-specific decisions see [`PERFORMANCE.md`](PERFORMANCE.md).

Roughly priority order.

---

## 1. Real blockers — packages we'd want to wrap but currently can't

### `Stream<T>` from RPC
Highest-value gap. Needed for subscribe-to-state APIs: camera frame
streams (`CameraController.imageStream`), video position
(`VideoPlayerController.position`), animation values, sensor feeds,
scroll-position listeners.

Architecture: similar to events but needs a subscription handle so
JS can unsubscribe. Sketch:

  • New op `OP_SUBSCRIBE_STREAM(nodeId, methodNameHash, callId)`
  • Dart-side dispatcher returns a `Stream<T>`; bridge calls `.listen`,
    emits one `EV_STREAM_VALUE` per element (same payload encoding
    as method replies).
  • JS-side: `for await (const v of ref.frames()) { … }` via an
    AsyncIterator-shaped Proxy; cleanup on iterator completion sends
    `OP_UNSUBSCRIBE_STREAM`.
  • Codegen: detect `Stream<T>`-returning methods in
    `_collectControllerMethods`, route to the subscribe path.

Probably 1–2 days. Unlocks the entire reactive-controller surface
that Flutter packages lean on.

### Multi-arg callbacks
`void Function(int, String)` shapes — e.g. list `onItemTap(index,
payload)`, table `onSort(column, direction)`. Today only
`VoidCallback` (zero-arg) and `ValueChanged<T>` (one-arg) are
supported.

The RPC side already has the arg-pack-then-fire mechanism via
`OP_METHOD_ARG`. Extending event-bind to accept multiple
`OP_EVENT_ARG`-style ops before the fire would be symmetric. ~1 day.

### More value types
Each is a small `type_mapper.dart` branch. Priority loosely matches
how many packages depend on each:

- `TextStyle` — every Text-styling widget (AutoSizeText, RichText,
  custom Text wrappers). Nests Color + double + FontWeight enum —
  all already supported individually; just needs the sub-prop
  expansion.
- `BoxDecoration` + `BorderRadius` + `BoxShadow` — Container
  styling beyond Padding. Same pattern as `EdgeInsets` (sub-prop
  expansion).
- `Gradient` (LinearGradient / RadialGradient / SweepGradient) —
  blocks Shimmer's default ctor (currently we use `.fromColors`).
- `ImageProvider` — Image, Hero, CachedNetworkImage, AssetImage.
  Needs a JSX-side convention like "string starting with http →
  NetworkImage, otherwise AssetImage".
- `Offset` / `Alignment` — animation, transform, layout.

~30 min each.

### Positional ctor params (non-host walk)
Live bug. The widget walk has `if (param.isPositional) continue;`
in `_emitAdapter` (generator.dart), which **silently drops**
positional params. Widgets like `Padding(this.padding, {this.child})`
get a broken adapter that crashes at runtime calling `Padding()`
with no padding.

At minimum: surface a skip warning so the build_runner output
flags the problem. Ideally: walk positional params for encodable
types (same `encodingFor` call, just emit `Padding(<encoding>, …)`
instead of `Padding(name: <encoding>)`).

The host pattern is unaffected — it constructs the wrapped widget
itself with a positional controller, bypassing the walk.

### Named-controller widgets
The host pattern assumes `WrappedWidget(controller)` (positional).
WebView is `WebView({controller: ...})` (named). One YAML field
away — add `controllerProp:` to `HostConfig`, default to positional.

  ```yaml
  hosts:
    WebView:
      widget: WebView
      factory: package:.../web_factory.dart#createWebView
      controllerProp: controller   # named instead of positional
  ```

The generator's host-emission path needs the corresponding branch
in the synthesized `build()` method. ~1 hour.

---

## 2. Polish

### CLI `--watch` mode
`build_runner watch` exists for the pub-package path; the local CLI
(`bin/skal_codegen.dart`) doesn't have one. Editing a local widget
(e.g. `greeting_widget.dart`) requires manually re-running the CLI.

~1 hour of `Directory.watch()` plumbing on the input file paths.

### Manifest collision warnings
Two manifests (CLI's `skal_adapters.json` + Builder's
`skal_codegen.json`) declaring the same JSX symbol silently
last-wins per the Object-spread merge in the Vite plugin. Should
warn at plugin-construction time. ~20 min in
`vite-plugin-skal-codegen.js`.

### Generic widget classes
`class Foo<T> extends StatelessWidget` — codegen skips these
today. The generated adapter would need a strategy for the type
parameter: either fix it to a concrete type per-host (declared in
YAML), or infer from prop types. Not a common shape in real
packages but blocks `Stream`-style and `Selector`-style widgets.

### Hot-reload of `skal_codegen.yaml`
Manual rebuild needed after editing the marker file.
`build_runner watch` covers this if the dev runs both watch loops
together. Document this in `WRAPPING_PUB_PACKAGES.md`'s "re-gen
flow" section.

---

## 3. Testing

Existing coverage: 8 snapshot tests over the generator core. Gaps:

- **Integration test for full `build_runner` → compile → render
  pipeline.** Snapshots prove the generator emits the right string;
  they don't prove the emitted code COMPILES and RUNS. A test that
  pubgets a real package, runs build_runner, compiles the output,
  asserts a widget instantiates would catch regressions in the
  emission shape that snapshots miss.

- **CLI binary tests.** Arg parsing, factory-function resolution
  edge cases (URI without `#`, missing function, multi-export
  ambiguity).

- **Vite plugin tests.** Multi-manifest merging, virtual module
  shape, manifest-not-found fallback.

- **Concurrent RPC stress.** Spawn 1000 simultaneous `await
  ref.method()` calls; verify all callIds resolve correctly and no
  replies get dropped to ring overflow.

---

## 4. Genuinely deferred — not in this slice

- **Hot-reload of generated code.** Codegen runs in ~1s; incremental
  doesn't add value.
- **Per-package codegen subdirectories.** Flat output works fine
  until someone wraps 50+ packages. Sharding would add plumbing
  without a real win.
- **RPC over network / out-of-process Dart side.** Would require
  rethinking the shared-memory bridge as a transport-agnostic
  channel. Feasibility study, not in this slice.
- **Source maps for generated code.** Nice-to-have for stack traces
  pointing at factory functions; in practice the Dart errors
  already include line numbers in the generated file.

---

## What I'd actually do next

If you want one more meaningful slice before declaring the feature
done: **streams + multi-arg callbacks together**. Both fall out of
the same primitive (multiple typed args per event). Covers camera
frame streams, list-tap callbacks, animation-value subscriptions in
one shot. ~1–2 days.

If you want to stop here: everything in §1 is mechanical
type-encoder branches or one-off fixes that can land incrementally
as real packages need them. §3 (testing) is the natural pre-merge
hardening pass.
