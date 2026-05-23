# kitchen-sink — the Skal demo app

The flagship example: a single-screen tab UI exercising essentially every
Skal feature — fast-path widgets, the design system, dialogs, the
reactive store, custom widgets (codegen + host pattern), navigation,
JS-side runtime probes, and the end-to-end render bench. About 2,100
lines of JSX in [`src/App.jsx`](src/App.jsx).

Acts as the working reference for the framework / app boundary
(docs/RESTRUCTURE.md) — anything a dev would do *with* Skal lives in
this directory, anything that's framework lives in `packages/`.

## Layout

```
kitchen-sink/
├── src/
│   ├── App.jsx          # the demo's root component (tabs: UI / List / Libs / JS / Store)
│   ├── index.jsx        # native entry — `render(<App />, root)` against skal/renderer
│   └── web-main.jsx     # web entry — DOM `render(<App />, #app)` against skal/renderer-web
├── vite.config.js       # native IIFE bundle (eval'd by JSC inside libskal)
├── vite.config.web.js   # web ES module bundle (DOM target)
├── babel-plugin-skal-jsx.cjs        # capitalized-tag → lowercase-intrinsic transform
├── vite-plugin-skal-codegen.js      # synthesizes the `skal-flutter` virtual module
├── flutter-host/        # the Flutter app — Dart entry, platform configs, libskal binaries
│   ├── lib/main.dart
│   ├── lib/adapters/    # demo-specific custom widgets (Greeting / Camera / Ticker)
│   ├── lib/skal_codegen.{yaml,g.dart,json}  # codegen config + outputs
│   ├── assets/skal-app.{js,cjs,cjs.jsc}     # populated by `bun run build`
│   └── {android,ios,macos}/                 # platform configs, incl. libskal binaries
├── scripts/find-vendored-bun.sh    # pins bytecode build to vendor/bun
├── Makefile             # legacy APK orchestration (use bun scripts instead)
└── package.json         # workspace pkg; depends on `skal: workspace:*`
```

## Day-to-day

Every workflow has a `bun run` form so you never need to remember which
directory to `cd` into:

```sh
# Native dev — rebuilds JS bundle, then `flutter run` on the chosen target
bun run dev:macos
bun run dev:ios            # iPhone simulator (Dart AOT not supported in release)
bun run dev:android        # Android emulator or attached device
bun run dev:flutter        # let flutter prompt for a device

# Web preview — DOM via skal/renderer-web (no bridge; degraded preview)
bun run dev:web            # → http://localhost:5173

# JS bundle only (no flutter run)
bun run build              # vite + JSC bytecode → flutter-host/assets/
bun run build:js-only      # skip the bytecode step

# Release builds (ships bytecode for fast cold-start)
bun run build:macos
bun run build:ios
bun run build:android      # APK; arm64-only

# Flutter housekeeping
bun run pub                # flutter pub get
bun run codegen            # dart run build_runner build --delete-conflicting-outputs
bun run analyze            # dart analyze lib/
bun run test               # flutter test (currently empty)
bun run clean              # flutter clean + drop dist/ + build/

# First-time setup (idempotent)
bun run platforms          # flutter create — generates android/ios/macos configs
bun run link               # drop libskal binaries into the platform configs
```

All of the above also work from the repo root via `bun --filter kitchen-sink <task>`.

## What this app demonstrates

| Feature | Where in src/App.jsx |
|---|---|
| Fast-path widgets (Column, Row, ListView, ScrollView, Tabs, …) | UI tab |
| Reactive store (`createSkalStore` — persistent, deep-object, lazy) | Store tab |
| Custom widgets via codegen (QrImageView, Shimmer, Camera, Ticker, Greeting) | Libs tab |
| Navigator + screen lifecycle (`createRouter`, `<Screen>`) | UI tab |
| JS runtime probes + render bench | JS tab |
| Imperative dialog API (`showDialog`, `showActionSheet`, `showSnackbar`, …) | UI tab |

For a stripped-down hello-world starting point instead, run
`bun run new my-app` from the repo root.

## Adding more apps alongside this one

The `examples/` directory is a bun workspace — new apps live as siblings:

```sh
bun run new my-app --with-platforms      # scaffold + flutter create + link libskal
bun --filter my-app dev:macos
```

See top-level [`README.md`](../../README.md) + [`docs/RESTRUCTURE.md`](../../docs/RESTRUCTURE.md)
for the full layout philosophy.
