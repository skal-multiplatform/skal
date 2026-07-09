# Contributing to Skal

Thanks for your interest! Skal spans three runtimes (JS, Dart, native),
so here's the map.

## Dev setup

```sh
bun run setup                      # full from-source setup (~30-40 min host-only)
SKAL_PREBUILT=1 bun run setup      # or: download prebuilt libskal (~1 min; needs gh auth)
bun run dev:macos                  # run the kitchen-sink demo
```

Prerequisites and platform details: see the [README](README.md#build).
Repo layout: framework in `packages/`, apps in `examples/`, native
inputs in `patches/` + the pinned forks (see `patches/README.md`).

## Tests

```sh
bun run test                       # codegen (dart test) + host (flutter test)
cd examples/kitchen-sink && bun test        # JS unit tests
bun --filter kitchen-sink test:e2e          # Maestro E2E (needs emulator)
```

See [docs/TESTING.md](docs/TESTING.md) for the full test-layer guide
(including how `testID` → Maestro works).

## Pull requests

- Keep PRs focused; one concern per PR.
- Match the surrounding code style and comment density — this codebase
  explains *why*, not *what*.
- Performance-sensitive paths (bridge, renderer, store) have invariants
  documented in `docs/PERFORMANCE.md` — read it before touching them,
  and include numbers if your change affects them.
- CI must be green: the fast `tests` lane runs on every PR; platform
  lanes run when you touch their inputs.

## Changing the native layer (bun / WebKit)

The bun + WebKit modifications live as commits on the `skal` branch of
[skal-multiplatform/bun](https://github.com/skal-multiplatform/bun) and
[skal-multiplatform/WebKit](https://github.com/skal-multiplatform/WebKit),
pinned by `patches/*-skal-commit.txt`. The bump/rebase procedure is
documented in [patches/README.md](patches/README.md). `skal_entry.zig`
(the C-ABI surface) lives in this repo and is copied into the bun tree
at build time.
