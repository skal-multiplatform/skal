# skal — the Skal JS framework

This package is the JS half of Skal: the bridge encoder, the Solid
universal renderer, the deep-object store, and the runtime primitives
(navigator, refs, screen lifecycle).

## What it exports

| Entry | What's in it |
|---|---|
| `skal` (default) | Capitalized-component barrel — `<Column>`, `<Row>`, `<Text>`, `<Button>`, `<ListView>`, ... |
| `skal/renderer` | Solid universal renderer hooked to the native bridge (libskal → Flutter) |
| `skal/renderer-web` | Same shape, but emits DOM ops — used by `bun run dev:web` |
| `skal/runtime` | `createRouter`, `createSkalRef`, `createSkalService`, `registerWebService`, `<Screen>`, navigation primitives |
| `skal/store` | `createSkalStore`, `createSkalEffect`, `STORE` |
| `skal/bridge` | Low-level bridge ops — most apps don't need this directly |

## Status

Private workspace package. Consumed locally from `examples/*` via bun
workspaces. Not published to npm. See top-level
[`docs/RESTRUCTURE.md`](../../docs/RESTRUCTURE.md) for the framework / app
boundary and the eventual public-distribution story.

## What ships with it

The native side (libskal — bun + JSC bundled into a single dynamic
library) is built by the pipeline under top-level `patches/` +
`scripts/` and is consumed by `skal_flutter` (the Dart-side
framework half). This package only contains the JS source — the
bytecode bundle is produced by each app's build step.
