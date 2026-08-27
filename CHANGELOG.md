# Changelog

Versions here track **`@skal/cli`**, the package `npm create skal` installs —
it is the one version a user sees. `skal_flutter`, `create-skal` and
`@skal/create` version independently; where they moved, it is noted.

The **runtime** — the prebuilt `libskal` binaries and source tree the CLI
downloads — is versioned separately by GitHub release tag. See
[Runtime releases](#runtime-releases) at the bottom, because which runtime you
got is not implied by your CLI version.

## Unreleased

Everything on `main` since `@skal/cli` 0.1.3. Published to npm/pub.dev but not
yet cut as a CLI version.

- **Store** — engine handles are reused across hot-reload generations rather
  than leaked (`__skal_store_open` has no matching close, so every reload used
  to strand one). Covered by a 60-generation soak on both the native and JS
  branches, and by a test for the teardown flush that lands a debounced write
  before a reload tears its generation down.
- **`stats()` / `compact()`** guard their host hooks like their three
  siblings, so a JS bundle newer than the dylib degrades instead of throwing
  during store init.
- **`skal doctor`** gates Flutter 3.47, the floor `analyzer ^14` created via
  `meta >=1.18.3`.
- **`--hot` is now a no-op everywhere.** `skal dev` has always run the hot
  script; `--hot` selected nothing and `skal dev web --hot` exited non-zero on
  a flag that did nothing. Accepted and ignored on every target.
- **Scaffold** doc references point at GitHub rather than a `docs/` directory
  that does not exist in a generated app.
- **`Column`'s centring guidance was wrong** — `<Row alignment={1}>` centres
  nothing without `width="fill"`, because a Row is built `MainAxisSize.min`.
  Corrected in the JSDoc and the generated Claude skill reference.
- **Flutter Web (wasm) is now covered by CI.** The shape built and rendered
  but nothing guarded it.
- **CI cache**: one shared `vendor-src` entry instead of three that evicted
  each other inside a 10 GB budget.

Already published from this window, ahead of a CLI cut:

| package | version | date |
|---|---|---|
| `skal_flutter` | 0.2.0 | 2026-08-19 |
| `create-skal` | 0.1.1 | 2026-08-20 |
| `@skal/create` | 0.1.1 | 2026-08-20 |

`create-skal` / `@skal/create` 0.1.1 fix the launcher's dependency on
`@skal/cli`, which resolved through workspace hoisting locally but not from a
clean `npx` install.

### Known issues

Found while dogfooding, not yet fixed — see the repo issues:

- `weight` is accepted by the prop encoder but not implemented on Flutter, so
  flex layouts silently differ from web.
- On web, `onChange` hands the callback a DOM `Event` where native hands a
  value.
- Writing a collection element's field updates the store but does not appear
  to refresh bindings or memos reading it until an unrelated signal changes.

## 0.1.3 — 2026-08-17

Almost entirely store correctness and performance. Thirty-one fixes and twenty
performance changes, most of them in `createSkalStore` and the native engine.

- Hydration reads what is on disk rather than walking the shape of
  `initState`.
- The array format has a single owner, closing the notification gaps that
  split ownership hid.
- Key listing refuses a malformed buffer instead of silently returning a
  partial answer.
- Element release has one owner, and the holes around it are closed.
- `skal_codegen` reads `Duration` defaults from the constructor's own default
  expression instead of a private SDK field.
- **Breaking, toolchain**: `skal_codegen` moved to `analyzer ^14`, which
  requires `meta >=1.18.3` and therefore **Flutter 3.47+**. Older Flutters pin
  `meta 1.17.0` and will not resolve.

## 0.1.1 — 2026-07-18

- JS hot reload became the default dev command, and works on fresh apps across
  macOS, iOS and Android.
- Every scaffolded app ships an AI agent skill, mirrored into `.agents/`.
- Branded launcher icons and web favicon.
- Fixed a `dev:android` SIGPIPE crash.
- Docs site: `.md` mirrors, `llms.txt`, and a Copy-for-AI control.

`create-skal` and `@skal/create` stayed at 0.1.0 — they are thin launchers and
did not change.

## 0.1.0 — 2026-07-12

First public release. `npm create skal <name>` scaffolds a standalone app
against a shared `~/.skal` runtime. `create-skal` and `@skal/create` 0.1.0
shipped the same day; `skal_flutter` 0.1.0 followed on 2026-07-19.

---

## Runtime releases

The CLI downloads prebuilt `libskal` binaries from a GitHub release. The tag it
uses is **not** tied to your CLI version.

| tag | kind | notes |
|---|---|---|
| `libskal-dev` | **rolling** | The default (`runtime.js`). Overwritten on every release build, so two scaffolds days apart can differ with no version to tell them apart. |
| `libskal-v0.1.0` | immutable | First pinned runtime. Set `SKAL_RELEASE_TAG=libskal-v0.1.0` to hold one build. |

Each release carries a `manifest.json` recording `skal_commit`, the bun and
WebKit pins, and the `skal_entry.zig` hash — so a scaffolded app can always say
exactly which runtime it holds.

## Versions that never shipped

`@skal/cli` 0.1.2 was never published; npm goes 0.1.1 → 0.1.3.
