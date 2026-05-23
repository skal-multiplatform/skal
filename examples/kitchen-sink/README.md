# kitchen-sink — the Skal demo app

This is the demo / kitchen-sink **application**, not the framework. It
shows off every fast-path widget, the design system, dialogs, the
store, custom widgets, navigation, the JS-side runtime probes, and
the end-to-end render bench. Anything a dev would do *with* Skal
lives here.

## Why this directory exists

Phase 0 of the framework restructure (see top-level `README.md` and
the restructure proposal) draws a hard line between the **framework**
and an **app built on it**:

| Side | Lives in | Owned by |
|---|---|---|
| Framework — bridge, renderer, store, runtime primitives | `js-app/src/` | The Skal project |
| App — components, screens, business logic | `examples/kitchen-sink/src/` | The dev (this is the example) |

A third-party app would eventually look exactly like this `kitchen-sink/`
directory — a `src/App.jsx` + their own modules, depending on the
framework. The full Phase 1+ work moves the framework into a publishable
package (`skal-js` on npm + `skal_flutter` on pub.dev) so a real app
doesn't have to live alongside the framework source. Phase 0 is the
minimum step that exposes the boundary.

## What's here

- `src/App.jsx` — the demo's root component. Tabs: UI / List / Libs /
  JS / Store. About 2 100 lines, exercises essentially every Skal
  feature.

## What's not here yet

- **Demo-specific Flutter adapters** (greeting_widget, camera_factory,
  ticker) are still in `flutter/skal_flutter/lib/adapters/`. Moving
  them requires updating the codegen paths in `lib/skal_codegen.yaml`
  + the CLI invocation in `main.dart`'s comments. Deferred to Phase
  0.1 — see [`docs/TODO.md`](../../docs/TODO.md).

## How it's currently wired

The entry points still live in `js-app/src/` (`index.jsx` for native,
`web-main.jsx` for web). They each `import App from
'../../examples/kitchen-sink/src/App.jsx'`. Once Phase 1 lands the
JS framework as a workspace package, the entry points will move into
this directory too and the import becomes `import { render, root }
from 'skal'` instead of a relative `../../js-app/src/...` path.

## Running it

From the repo root:

```bash
# Native — Android / macOS / iOS via the Flutter app
cd js-app && bun run build
cd ../flutter/skal_flutter && flutter run -d macos   # or any other target

# Web — Solid in a browser via DOM renderer
cd js-app && bun run dev:web    # opens http://localhost:5173
```
