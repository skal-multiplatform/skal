#!/usr/bin/env bash
# Locate the vendored bun binary for bytecode generation.
#
# Per TODO_PLATFORMS § 1.1, .cjs.jsc bytecode MUST be produced by the
# same bun (and therefore the same JSC) that libskal.{so,dylib} links
# against. Using the system $PATH bun creates a silent failure mode:
# JSC at runtime checks the bytecode cache version, finds a mismatch
# vs. its own embedded JSC, and falls back to parsing — no error,
# just a cold-start regression.
#
# Resolution order:
#   1. $SKAL_BUN env var (absolute path, for CI / explicit overrides)
#   2. build/skal-bun/bun — prebuilt, placed by scripts/fetch-libskal.sh
#      (the SKAL_PREBUILT=1 setup path)
#   3. vendor/bun/build/release/bun (stripped) if present
#   4. vendor/bun/build/release/bun-profile (unstripped) — what
#      `bun run build:release` actually produces
#   5. error with build instructions
#
# Prints the absolute path on stdout; nothing else (the calling
# package.json script captures it via $(./scripts/find-vendored-bun.sh)).

set -euo pipefail

if [[ -n "${SKAL_BUN:-}" ]]; then
    if [[ -x "${SKAL_BUN}" ]]; then
        echo "${SKAL_BUN}"
        exit 0
    else
        echo "error: SKAL_BUN=${SKAL_BUN} does not point at an executable" >&2
        exit 1
    fi
fi

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RELEASE_DIR="${REPO_ROOT}/vendor/bun/build/release"

# `bun` is the stripped final artifact; `bun-profile` is the unstripped
# upstream of strip. Both are content-equivalent for bundling / bytecode
# (strip only removes debug syms, doesn't alter JSC version), so either
# works. Prefer the stripped one if both exist.
for candidate in "${REPO_ROOT}/build/skal-bun/bun" "${RELEASE_DIR}/bun" "${RELEASE_DIR}/bun-profile"; do
    if [[ -x "${candidate}" ]]; then
        echo "${candidate}"
        exit 0
    fi
done

cat >&2 <<EOF
error: no skal bun found. Looked at:
  ${REPO_ROOT}/build/skal-bun/bun   (prebuilt — SKAL_PREBUILT=1 bun run setup)
  ${RELEASE_DIR}/bun
  ${RELEASE_DIR}/bun-profile

Build it with:
  cd vendor/bun && PATH="\$HOME/.cargo/bin:\$PATH" bun run build:release

(See TODO_PLATFORMS § 1.1 for why bytecode generation must use the
vendored bun, not the system \$PATH bun.)
EOF
exit 1
