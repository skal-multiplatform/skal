# Restructure — framework / app boundary

The Skal repo today is the framework AND a single demo app entangled in
the same source tree. The goal of the restructure is to draw a hard
line: the **framework** (bridge, renderer, runtime, store, code-gen
tools, native libskal) on one side; **apps** built on it (today: the
kitchen-sink demo; tomorrow: any number of internal apps) on the other.

**Scope: private, internal, this monorepo only.** No publishing to npm
or pub.dev. No git-URL deps. No public distribution. Apps and the
framework live together in this repo and consume each other through
local workspace / path dependencies. If we ever go public, that's a
separate, later decision — none of the work below commits us to it.

Companion docs: [`TODO.md`](TODO.md) for deferred items;
[`FastStorage.md`](FastStorage.md) for store perf analysis;
[`BENCHMARKS.md`](BENCHMARKS.md) for the numbers.

---

## TL;DR

- **Phase 0** — Move the demo out of the framework's JS source tree.
  ✅ DONE.
- **Phase 0.1** — Same for the Flutter-side demo adapters.
  ✅ DONE (folded into Phase 1).
- **Phase 1** — Convert to a bun workspace (JS) + Dart `path:` deps
  (Flutter). Framework lives in `packages/skal-js/` +
  `packages/skal_flutter/`; kitchen-sink lives in
  `examples/kitchen-sink/` consuming them locally. `js-app/` deleted.
  ✅ DONE.
- **Phase 2** — Internal app scaffold. `scripts/new-app.sh` + the
  `scripts/templates/default/` tree produce a working hello-world Skal
  app under `examples/<name>/`. ✅ DONE.
- **Phase 3** *(deferred until needed)* — Public distribution. Pick
  one of git URLs / npm / pub.dev when we have a reason. Until then,
  the answer is "we have no public distribution."

---

## The boundary today (post-Phase 1)

The framework owns the **left** column; an app (here the kitchen-sink
demo) owns the **right** column. New apps follow the right column's
shape — see `scripts/templates/default/` for the scaffold.

| Framework | App (demo) |
|---|---|
| `packages/skal-js/src/bridge.js` | `examples/kitchen-sink/src/App.jsx` |
| `packages/skal-js/src/renderer.js`, `renderer-web.js` | `examples/kitchen-sink/src/{index,web-main}.jsx` (entry shells) |
| `packages/skal-js/src/skal-runtime.jsx` | `examples/kitchen-sink/{vite.config.js,vite.config.web.js}` (build pipeline) |
| `packages/skal-js/src/skal/store/*` (`db.js`, `engine.js`, `frame.js`) | `examples/kitchen-sink/{babel-plugin-skal-jsx.cjs,vite-plugin-skal-codegen.js}` |
| `packages/skal-js/src/skal/index.js` (capitalized-widget barrel) | `examples/kitchen-sink/scripts/find-vendored-bun.sh` |
| `packages/skal_flutter/lib/skal/*` (bridge, dialogs, registry, root, wire) | `examples/kitchen-sink/flutter-host/lib/main.dart` |
| `packages/skal_flutter/lib/skal_ffi.dart` | `examples/kitchen-sink/flutter-host/lib/adapters/*` (Greeting / Camera / Ticker) |
| `packages/skal_flutter/lib/skal_flutter.dart` (barrel) | `examples/kitchen-sink/flutter-host/lib/{skal_codegen.{yaml,g.dart,json}}` |
| `packages/skal_flutter/test/*` (framework tests) | `examples/kitchen-sink/flutter-host/{android,ios,macos}/*` (host platform configs incl. libskal binaries) |
| `patches/skal_entry.zig` + bun patches | `examples/kitchen-sink/Makefile` (app-specific orchestration) |
| `packages/skal_codegen/*` (Dart CLI + builder) | |
| `build/` (libskal link inputs per platform) | |
| `scripts/{link-libskal-flutter-*.sh,build-*.sh}` (framework build pipeline) | |
| `scripts/templates/default/` + `scripts/new-app.sh` (Phase 2 scaffold) | |

---

## Target end state (after Phase 1)

```
skal/                                      # private monorepo
├── packages/
│   ├── skal-js/                           # the JS framework
│   │   ├── src/{bridge,renderer,renderer-web,runtime,store}.{js,jsx}/...
│   │   ├── package.json                   # `"name": "skal"`, proper `exports`
│   │   └── README.md
│   └── skal_flutter/                      # the Flutter framework
│       ├── lib/{skal.dart, src/{bridge,registry,root,ffi,boot}.dart}
│       ├── android/  ios/  macos/         # Flutter plugin platform config
│       ├── runtime/libskal/               # pre-built binaries per platform
│       └── pubspec.yaml
├── codegen/                               # Dart codegen tool (lives here, not in packages/)
│   └── skal_codegen/
├── patches/                               # libskal source (bun patches + skal_entry.zig)
├── scripts/                               # libskal build pipeline + app scaffold
├── examples/
│   ├── kitchen-sink/                      # today's demo
│   │   ├── js-src/App.jsx
│   │   ├── flutter-host/{lib/main.dart, pubspec.yaml, …}
│   │   ├── package.json                   # depends on `"skal": "workspace:*"`
│   │   └── README.md
│   └── (future: my-second-app/, ...)      # whatever else gets built
├── package.json                           # repo root: `"workspaces": ["packages/*", "examples/*"]`
├── RESTRUCTURE.md  (this file)
└── README.md
```

**A new internal app** after Phase 2 looks like this — *inside the same
monorepo*, not a separate clone:

```
skal/examples/my-app/
├── js-src/App.jsx                         # the dev writes this
├── flutter-host/
│   ├── lib/main.dart                      # ~5 lines: `runSkalApp(adapters: [...])`
│   └── pubspec.yaml                       # `skal_flutter: { path: ../../../packages/skal_flutter }`
├── package.json                           # `"skal": "workspace:*"`
└── README.md
```

Dev workflow:

```bash
# From repo root, after Phase 1+2 land
scripts/new-app.sh my-app
cd examples/my-app
bun install                                # workspace links, no network
cd flutter-host && flutter pub get         # path deps, no network
flutter run -d macos                       # or any other target
```

No external services, no registry, no install latency. The framework
edits are visible immediately in the app (workspace symlinks). Tagging
a "framework version" is implicit in the monorepo's commit history.

---

## Status snapshot

Phase 0 + 0.1 + 1 + 2 all landed. The monorepo now has:

- **`packages/skal-js/`** — JS framework. `package.json` name `"skal"`,
  consumed by examples via `"skal": "workspace:*"`. Exports:
  `skal`, `skal/renderer`, `skal/renderer-web`, `skal/runtime`,
  `skal/store`, `skal/bridge`.
- **`packages/skal_flutter/`** — Dart/Flutter framework half (bridge,
  registry, root, dialogs, FFI bindings). Consumed via
  `skal_flutter: { path: ../../../packages/skal_flutter }`.
- **`examples/kitchen-sink/`** — The demo app, including the
  flutter-host with platform configs + libskal binaries. The build
  pipeline (vite + babel + bytecode + Makefile) lives here too.
- **`scripts/templates/default/` + `scripts/new-app.sh`** — generates
  a hello-world Skal app under `examples/<name>/`. Tested end-to-end
  with `bun run build:js-only` + `build:bytecode`.
- **`scripts/link-libskal-flutter-{mac,}.sh`** — moved from the
  former `flutter/scripts/`. Both honour `SKAL_FLUTTER_FRAMEWORKS=`
  / `SKAL_FLUTTER_NATIVE_LIBS=` env vars so they're not hard-pinned
  to the kitchen-sink target.

Build/run verified at the time of Phase 1B sign-off:
`flutter build macos --debug` succeeds, the .app boots with
`init=8.9ms eval=90.8ms nodes=885` (same node count as pre-restructure).

Known cosmetic carryover: the macOS .app is still named
`skal_flutter.app` (Xcode `PRODUCT_NAME` hasn't been renamed to
`kitchen_sink`). The Dart side is fully renamed; the Xcode-level
rename is a separate small task that doesn't affect functionality.

## Phase 0 — Clarify boundary in-place ✅ DONE

**Goal:** untangle the demo from the framework's JS source tree.
Reversible. No package changes yet.

What landed:
- `git mv js-app/src/App.jsx → examples/kitchen-sink/src/App.jsx`
- `js-app/src/index.jsx` and `web-main.jsx` updated to import App from
  the new location.
- `App.jsx`'s three framework-internal imports (`./renderer.js`,
  `./skal-runtime.jsx`, `./skal/store/db.js`) rewritten as relative
  paths into `js-app/src/`. A comment marks these as Phase-0 bridge
  paths to be replaced in Phase 1 with workspace imports
  (e.g. `from 'skal/renderer'`).
- `examples/kitchen-sink/node_modules` is a symlink to
  `../../js-app/node_modules` so npm bare specifiers resolve. The
  symlink is `.gitignore`'d. Phase 1 replaces it with workspace
  hoisting.
- `examples/kitchen-sink/README.md` explains the boundary.

**Verified:** `bun run build` succeeds, the .app launches with
`init=83.8 ms · eval=85.5 ms · 885 nodes` (same as before the move).

---

## Phase 0.1 — Flutter demo adapters ✅ DONE (folded into Phase 1)

**Goal:** finish Phase 0 by moving the demo-specific Flutter adapters
out of the framework's `lib/adapters/`.

Move these:
- `flutter/skal_flutter/lib/adapters/greeting_widget.dart`
- `flutter/skal_flutter/lib/adapters/camera_factory.dart`
- `flutter/skal_flutter/lib/adapters/ticker.dart`

Into:
- `examples/kitchen-sink/flutter-adapters/` (or under
  `examples/kitchen-sink/flutter-host/lib/adapters/` if we want to
  match the eventual Phase 1 layout)

What needs updating:
1. `flutter/skal_flutter/lib/skal_codegen.yaml` — codegen targets list
   moves to read from the example dir.
2. The CLI invocation in `main.dart`'s comment (`dart run …
   skal_codegen lib/adapters/greeting_widget.dart …`) — paths change
   to the example.
3. `vite.config.js` codegen manifests — point at the new manifest
   path.
4. `lib/adapters/generated/skal_adapters.g.dart` — codegen output.
   Path reference inside is package-URI-based so it should keep
   working after the move.

**Risk:** codegen path changes are spread across vite config + Dart
build_runner config + CLI script. Easy to miss one. Verify by running
the full pipeline + confirming QrImageView / Camera / Greeting all
still render in the demo.

---

## Phase 1 — Workspace + local packages ✅ DONE

**Goal:** convert to a workspace monorepo. Framework lives in
`packages/skal-js/` + `packages/skal_flutter/`. Demo lives in
`examples/kitchen-sink/` and depends on the framework via local
workspace links. Delete `js-app/`.

Steps:

1. **Create top-level `package.json`** with
   `"workspaces": ["packages/*", "examples/*"]`. Bun hoists
   `node_modules` to the repo root.

2. **Move `js-app/src/` content into `packages/skal-js/src/`**:
   - `bridge.js`, `renderer.js`, `renderer-web.js`, `skal-runtime.jsx`
     → `packages/skal-js/src/`
   - `skal/index.js` + `skal/store/*` → `packages/skal-js/src/`
   - Entry shells (`index.jsx`, `web-main.jsx`) → move into
     `examples/kitchen-sink/src/` (they're really demo bootstrap)
   - Build pipeline (`vite.config.js`, `vite.config.web.js`,
     `vite-plugin-skal-codegen.js`, `babel-plugin-skal-jsx.cjs`,
     `scripts/find-vendored-bun.sh`) → `examples/kitchen-sink/` for now
     (the example owns the build; the framework only ships source)

3. **Create `packages/skal-js/package.json`** with `"name": "skal"`,
   `"private": true` (we're not publishing), and proper `exports`
   for each module:
   ```json
   "exports": {
     ".": "./src/skal/index.js",
     "./renderer": "./src/renderer.js",
     "./renderer-web": "./src/renderer-web.js",
     "./runtime": "./src/skal-runtime.jsx",
     "./store": "./src/skal/store/db.js"
   }
   ```

4. **Update App.jsx imports** to use package paths:
   - `from '../../../js-app/src/renderer.js'` → `from 'skal/renderer'`
   - same for `runtime`, `store`

5. **Delete `examples/kitchen-sink/node_modules` symlink** — bun
   workspaces hoist deps, no symlink needed.

6. **Same Flutter-side treatment**: extract framework `lib/skal/*` +
   `skal_ffi.dart` into `packages/skal_flutter/lib/`. The example's
   `flutter-host/pubspec.yaml` references it via:
   ```yaml
   dependencies:
     skal_flutter:
       path: ../../../packages/skal_flutter
   ```
   This is Dart/Flutter's native local-dependency mechanism — no
   workspace tool needed beyond `pub get`.

7. **Move `main.dart`** — pull the demo-specific wiring (data dir
   resolution, prewarm call, debug log line) out of the framework
   `main.dart` into the example's `flutter-host/lib/main.dart`. The
   framework keeps a `boot.dart` helper (`runSkalApp(...)`) that the
   example calls.

8. **Delete `js-app/`** — its content is now split between
   `packages/skal-js/` and `examples/kitchen-sink/`.

What this buys:
- Clear separation by directory structure.
- Adding a second app (`examples/minimal-todo/`) is trivial — copy
  the kitchen-sink layout, edit App.jsx.
- Framework edits show up in apps immediately via workspace symlinks
  (no install/publish cycle).

What this still doesn't do:
- Make the framework consumable by anything OUTSIDE this monorepo.
  Tracked in Phase 3 if/when that's wanted.

---

## Phase 2 — New-app scaffold ✅ DONE

**Goal:** make it trivial to start a new internal app without
hand-copying the kitchen-sink layout.

Deliverable: `scripts/new-app.sh <name>` (~50 lines of bash) that:

1. Creates `examples/<name>/` from a template directory
   (`scripts/templates/default/`).
2. Substitutes `<name>` into `package.json`, `pubspec.yaml`,
   `main.dart`, etc.
3. Runs `bun install` + `flutter pub get` from the new directory.
4. Prints next-steps: `cd examples/<name> && bun run dev:web` or
   `flutter run`.

Template structure:
```
scripts/templates/default/
├── js-src/
│   ├── App.jsx                       # ~30 lines: <Column><Text label="Hello"/></Column>
│   └── main.jsx                      # mounts App
├── flutter-host/
│   ├── lib/main.dart                 # `runSkalApp(adapters: [])`
│   └── pubspec.yaml                  # depends on skal_flutter via path
├── package.json                      # depends on skal via workspace:*
└── README.md
```

Optional later: a `with-store/` template (uses createSkalStore), a
`with-custom-widget/` template (shows codegen wiring).

This is a pure convenience — devs can also copy kitchen-sink by hand
if the scaffold doesn't yet match what they need.

---

## Phase 3 — Public distribution *(deferred until needed)*

**Not part of the current plan.** Listed here so the question doesn't
recur.

If we ever decide to let people outside this repo build with Skal,
we'd choose one of:

- **Git URL deps** — consumers do `"skal": "github:.../skal#v0.1.0"`.
  Cheapest path to "public-shareable" without registry infra. The
  framework repo itself becomes the distribution mechanism.
- **npm + pub.dev** — fully public, registry-resolved, discoverable.
  Significant maintenance overhead (publish workflow, semver policy,
  CI, libskal binary distribution strategy).

Either path adds work — version policy, libskal binary distribution
(GitHub Releases-as-CDN vs bundled-in-package vs git-LFS), runtime
JSC bytecode version check, plugin bridge for camera/file-picker/etc.

Concrete hard problems if/when we go public:

- **libskal binary distribution**: ~30-60 MB per platform, multiple
  platforms = 200+ MB. Bundling in npm/pub.dev packages is awkward.
  Cleanest: GitHub Releases-as-CDN + a post-install fetch script.
- **JSC bytecode version coupling**: `.cjs.jsc` is JSC-version-keyed,
  must match the bun inside libskal. Need a runtime check (see
  [`TODO.md`](TODO.md) § Build pipeline).
- **Plugin bridge**: camera, geolocation, biometrics, file picker.
  Tracked in [`TODO.md`](TODO.md) § SDK shape.
- **Versioning**: lock-step releases of `skal` + `skal_flutter`, or a
  runtime protocol-version handshake.

Re-open this phase when there's a concrete reason to publish (a
second team using Skal, an OSS push, etc.). Until then, the internal
monorepo is the entire story.

---

## Open questions / decisions

- **`js-app/` rename to `packages/skal-js/`.** Yes, do it during
  Phase 1. The old name is anachronistic now that the demo lives
  elsewhere.
- **Codegen package location.** Originally lived at
  `codegen/skal_codegen/`; promoted to `packages/skal_codegen/`
  alongside the other framework packages so the layout is uniform
  (everything framework-shared under `packages/`). It's still a
  build-time Dart CLI, not a runtime Flutter package — the path
  change is purely organizational.
- **Multi-arch libskal builds.** Currently we build arm64-v8a for
  Android and arm64 for iOS device + simulator + macOS. Add x86_64
  Android (emulators on Intel machines) when needed.
- **macOS-debug `flutter run` boot of ~440 ms.** Documented as
  "`flutter run` dev-mode overhead, not a real regression" — see the
  boot investigation in this session's history. Real production
  launch (via Finder / App Store) is ~75 ms. Not a restructure
  concern, just a known cost of dev iteration.

---

## Phasing rationale

Each phase is independently shippable. Phase 0 is reversible refactor.
Phase 0.1 finishes the file-level untangle. Phase 1 is the real
structural lift — workspaces, package boundaries, deletes `js-app/`.
Phase 2 is convenience polish on top of Phase 1. Phase 3 is a future
decision, listed for completeness so the question doesn't keep
coming up.

If we stop after Phase 1 we have everything we need for internal
multi-app development: framework + apps cleanly separated, local
workspace deps, one-monorepo source of truth, no external services
to maintain. **That's probably the right resting place for a long
while.**

*Last updated: 2026-05-21. Phases 0, 0.1, 1, 2 all landed. Phase 3
deferred indefinitely. Scope: private monorepo, no external
distribution.*
