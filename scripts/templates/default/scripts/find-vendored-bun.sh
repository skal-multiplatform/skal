#!/usr/bin/env bash
# Locate the vendored bun binary for bytecode generation.
#
# .cjs.jsc bytecode MUST be produced by the same bun (and therefore
# the same JSC) that libskal.{so,dylib} links against. Using the
# system $PATH bun creates a silent failure mode: JSC at runtime
# checks the bytecode cache version, finds a mismatch vs. its own
# embedded JSC, and falls back to parsing — no error, just a cold-
# start regression.
#
# Resolution order:
#   1. $SKAL_BUN env var (absolute path, for CI / explicit overrides)
#   2. build/skal-bun/bun — prebuilt (fetch-libskal.sh)
#   3. vendor/bun/build/release/bun (stripped) if present
#   4. vendor/bun/build/release/bun-profile (unstripped)
#   5. error with build instructions

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

# Script lives at <app>/scripts/. Standalone apps (scaffolded by
# `skal create`) carry a .skal-runtime symlink at the app root pointing
# at the runtime checkout; in-repo apps resolve the repo root 3 dirs up.
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RELEASE_DIR="${REPO_ROOT}/vendor/bun/build/release"

for candidate in "${APP_ROOT}/.skal-runtime/build/skal-bun/bun" \
                 "${REPO_ROOT}/build/skal-bun/bun" "${RELEASE_DIR}/bun" "${RELEASE_DIR}/bun-profile"; do
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
EOF
exit 1
