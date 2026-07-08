# patches/ — libskal inputs

The bun + WebKit modifications no longer live here as `.patch` files —
they are **real commits on the `skal` branch of Skal's forks**:

- <https://github.com/skal-multiplatform/bun> (branch `skal`, tracks `oven-sh/bun`)
- <https://github.com/skal-multiplatform/WebKit> (branch `skal`, tracks `oven-sh/WebKit`)

`scripts/setup.sh` clones those branches (shallow) and **pins** the
checkout: if a clone's HEAD ever differs from the pin file it is
fetched + checked out to the pin (or setup hard-fails on a dirty /
broken tree rather than building the wrong thing). No patch
application at setup time — a fresh clone, a warm CI cache, and a
stale CI cache all end up building the exact same pinned tree.

What stays in this directory:

| File | Role |
|---|---|
| `skal_entry.zig` | The libskal C-ABI entry point, compiled into vendor/bun (setup.sh copies it to `vendor/bun/src/`). Lives in THIS repo — not the fork — because it co-evolves with the Dart FFI + JS bridge halves, so bridge changes stay atomic in one PR. The fork's `skal` branch carries the `main.zig` hook (android/ios/macos) that imports it. |
| `bun-skal-commit.txt` | Pinned tip of the bun fork's `skal` branch. setup.sh enforces it; CI cache keys hash it. |
| `webkit-skal-commit.txt` | Same for the WebKit fork. |

## Bumping upstream

Work in a **full clone of the fork** — not the shallow, single-branch
`vendor/` checkout setup.sh makes (it has no `upstream` remote and no
history to rebase with):

```sh
git clone https://github.com/skal-multiplatform/bun.git && cd bun
git remote add upstream https://github.com/oven-sh/bun.git
git fetch upstream
```

1. **Find the current base** (the upstream commit the skal patches sit
   on). It is not recorded in a file — derive it:
   `base=$(git merge-base upstream/main origin/skal)`.
2. *(Optional but recommended)* keep the outgoing tip reachable before
   rewriting history: `git tag skal-pin-$(date +%Y%m%d) origin/skal &&
   git push origin --tags`. GitHub currently serves force-pushed-away
   commits by SHA (fork-network behavior), but that is undocumented —
   a tag makes old pins durable by contract.
3. **Rebase the patch series**:
   `git rebase --onto <new-upstream-commit> "$base" skal`, resolve,
   then force-push `skal`.
4. **WebKit only — check bun's internal WebKit pin.** The bun fork's
   `scripts/build/deps/webkit.ts` hardcodes `WEBKIT_VERSION`, which the
   `release` / `android-release` profiles use to download **prebuilt**
   JSC — while `ios-release` and `scripts/build-jsc-{android,ios}.sh`
   build `vendor/WebKit` from source. Bumping the WebKit fork without a
   matching `WEBKIT_VERSION` bump in the bun fork silently skews JSC
   versions across platforms (bytecode-cache/ABI mismatch). Bump them
   together, as one coordinated change.
5. **Update the pin file(s) here** with the new `skal` tip SHA(s).
6. **Invalidate derived artifacts** — this is more than `vendor/`:
   `bun run setup` will reconcile `vendor/{bun,WebKit}` to the new pins
   automatically, but the JSC/ICU outputs live under `build/` and gate
   on existence, so after a WebKit bump also
   `rm -rf build/jsc-android build/skal-jsc-ios` (and after a toolchain
   change, `build/icu-android`). Then rebuild and re-run
   `bun run build` in the affected apps to regenerate bytecode
   (see `docs/bytecode-cache.md` — the `.cjs.jsc` is JSC-version-keyed).

The `skal` branches are kept **rebased** (not merged) so
`git log upstream/main..skal` always reads as the clean patch series.
