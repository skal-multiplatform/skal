# Skal — Flutter library wrapping

Open items in the custom-widgets / codegen arc. The pipeline now
covers the patterns most pub.dev packages use — see
[`WRAPPING_PUB_PACKAGES.md`](WRAPPING_PUB_PACKAGES.md) for the
end-to-end DX. This doc tracks the remaining gap.

For platform plumbing (Android/iOS Frameworks, asset extraction)
see [`TODO_PLATFORMS.md`](TODO_PLATFORMS.md).
For perf-specific decisions see [`PERFORMANCE.md`](PERFORMANCE.md).

---

## Done since the last revision

A focused pass landed most of the original §1/§2/§3 list:

- ✅ Positional ctor params (non-host walk) — was a silent-drop bug
- ✅ Named-controller hosts via `controllerProp:` YAML field
- ✅ Value types — `TextStyle`, `BoxDecoration`, `BorderRadius`,
  `Offset`, `Alignment`, `ImageProvider` (string-coercion)
- ✅ Multi-arg callbacks — `void Function(int, String)` via
  `EVENT_ARG_TUPLE` + JS-side spread
- ✅ `Stream<T>` from RPC — `ref.foo$(cb)` subscribe syntax, full
  subscribe/unsubscribe/done/error lifecycle
- ✅ Manifest collision warnings in the Vite plugin
- ✅ CLI `--watch` mode
- ✅ Generic widget classes — explicit skip-with-warning + a
  documented manual escape hatch
- ✅ CLI binary tests (5 cases via `Process.runSync`)
- ✅ Vite plugin tests (8 cases via `bun test`)
- ✅ Concurrent-RPC stress — demo button fires 1000 parallel calls
- ✅ Integration test — opt-in via `SKAL_INTEGRATION=1`, spawns the
  real `build_runner build` against the demo project

10 generator snapshot tests + 5 CLI tests + 8 Vite plugin tests +
1 opt-in integration test. `dart analyze lib/ bin/` clean across all
packages.

---

## Still open

### Gradient (Linear/Radial/Sweep)
Variable-length `List<Color>` doesn't fit the existing primitive-
expansion pattern. Would unlock `Shimmer`'s default ctor + many
decoration-heavy widgets.

Possible shape: a `gradient` JSX prop accepting either an array
literal `[colors: [...], stops: [...]]` (JSON-encoded, decoded
Dart-side into a Gradient) or sub-props (`gradientStartColor`,
`gradientEndColor` for the common 2-color case). The latter is
simpler + matches the value-type pattern; the former generalizes.

Probably ~half day. Lower priority than it sounds — most decoration
gradient needs are 2-color, handleable via a manual escape-hatch
widget that takes `startColor` + `endColor` props.

### Other deferred items
- **Hot-reload of generated code.** Codegen runs in ~1s; incremental
  doesn't add value.
- **Per-package codegen subdirectories.** Flat output works fine
  until someone wraps 50+ packages.
- **RPC over network / out-of-process Dart side.** Would require
  rethinking the shared-memory bridge as a transport-agnostic
  channel. Feasibility study, not in this slice.
- **Source maps for generated code.** Nice-to-have for stack traces
  pointing at factory functions; in practice the Dart errors
  already include line numbers in the generated file.
- **More value types** as real packages reveal needs — `Curve`,
  `BorderSide` (per-side `Border`), `DecorationImage`, `Locale`,
  `IconData`, etc. Each is a ~30 min type_mapper branch.

---

## What I'd actually do next

The architecture is at a natural endpoint. Three reasonable next
moves, depending on goals:

1. **Stop here + merge.** The remaining items are mechanical
   extensions handleable as pub packages reveal needs.

2. **Land Gradient.** Closes the last visible §1 gap. Half day.

3. **Wrap a substantial real-world pub package** (e.g.
   `flutter_map`, `syncfusion_flutter_charts`, a state-management
   library) to surface the next batch of unsupported types empirically.
   This drives priorities better than guessing.
