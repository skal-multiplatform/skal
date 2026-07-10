# @skal/cli

Create and run Skal apps **anywhere on disk** — no monorepo clone needed.

```bash
npm i -g @skal/cli        # or one-shot: npx @skal/cli create my-app
skal create my-app
cd my-app
skal dev macos            # or: bun run dev:macos
```

Prereqs: [bun](https://bun.sh) and [Flutter](https://flutter.dev) (plus
Xcode / Android tooling for the targets you build). No LLVM, no Rust,
no NDK, no GitHub auth.

## Commands

| Command | What it does |
|---|---|
| `skal create <name>` | Scaffold a standalone app in `./<name>` (`--platforms macos,ios` / `--no-platforms`) |
| `skal dev [platform]` | Run it — `macos` (default), `ios`, `android`, `web`; `--hot` for JS hot reload |
| `skal build [platform]` | JS bundle + bytecode; with a platform, a release build |
| `skal doctor [--fix]` | Check toolchain, runtime, and app wiring; `--fix` repairs the runtime link |
| `skal upgrade` | Install the latest runtime; inside an app, repoint + relink it |

## How it works

The heavy parts — the framework packages and the prebuilt `libskal`
binaries — live in a shared, versioned **runtime** at
`~/.skal/runtime/<skal-commit>/`, fetched on first use from the
[`libskal-dev` release](https://github.com/skal-multiplatform/skal/releases/tag/libskal-dev)
(anonymous download, checksum-verified). Runtimes are immutable:
`skal upgrade` installs a new one next to the old, so existing apps
keep working until you repoint them.

Each app carries a `.skal-runtime` symlink to its runtime plus a
`skal.json` recording which one it uses. The scaffold wires the app's
dependencies through that link — `"skal": "file:.skal-runtime/packages/skal-js"`
in package.json, `path: ../.skal-runtime/packages/skal_flutter` in
pubspec.yaml — so the generated app's scripts (`bun run dev:macos`, …)
work with no Skal tooling on PATH at all. The symlink is machine-local
(gitignored); a fresh checkout of an app repairs it with
`skal doctor --fix`.

## Hacking on the CLI

`--runtime-from <path-to-skal-checkout>` builds the runtime from a
local monorepo instead of the release — packages, scripts, and
whatever binaries the checkout has (a source-built
`vendor/bun/build/release/bun` is picked up automatically; anything
missing is fetched from the release):

```bash
node packages/skal-cli/bin/skal.js create demo --runtime-from ~/code/skal
```

Env knobs: `SKAL_HOME` (default `~/.skal`), `SKAL_RELEASE_REPO`,
`SKAL_RELEASE_TAG`.

## Publishing (not yet released)

The package is `private: true` until launch. To publish: flip
`private`, then `npm publish --access public` under the `@skal` org.
A sibling `@skal/create` alias package (so `npm create @skal` works)
delegates to `skal create`.
