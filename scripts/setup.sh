#!/usr/bin/env bash
# Bootstrap a fresh Skal checkout: clone vendored sources at pinned commits,
# apply our patches, and place skal_entry.zig in bun's source tree.
#
# Run once after `git clone`. Re-running is safe — it skips already-cloned
# trees and re-applies patches with `--reverse --check` first to avoid
# double-applying.
#
# Prerequisites: git. Build prerequisites are checked by the build scripts
# themselves (Android NDK, LLVM 21, lld 21, rustup, cargo, Zig fork is
# auto-downloaded by bun's build).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="${ROOT}/vendor"
PATCHES="${ROOT}/patches"

BUN_COMMIT="$(cat "${PATCHES}/bun-base-commit.txt" | tr -d '[:space:]')"
WEBKIT_COMMIT="$(cat "${PATCHES}/webkit-base-commit.txt" | tr -d '[:space:]')"

mkdir -p "${VENDOR}"

# ── Clone bun ──────────────────────────────────────────────────────────
if [[ ! -d "${VENDOR}/bun" ]]; then
  echo ">>> cloning oven-sh/bun (shallow)"
  git clone --depth 1 https://github.com/oven-sh/bun.git "${VENDOR}/bun"
fi
cd "${VENDOR}/bun"
if [[ "$(git rev-parse HEAD)" != "${BUN_COMMIT}" ]]; then
  echo "warning: vendor/bun is at $(git rev-parse --short HEAD), patches were generated against ${BUN_COMMIT:0:10}"
  echo "         re-clone with --depth and fetch the pinned commit if patches fail to apply"
fi

# ── Apply bun-side patches ─────────────────────────────────────────────
apply_patch() {
  local p="$1"
  if git apply --reverse --check "${p}" 2>/dev/null; then
    echo "    already applied: $(basename "${p}")"
  else
    git apply --check "${p}" 2>/dev/null
    git apply "${p}"
    echo "    applied:         $(basename "${p}")"
  fi
}

echo ">>> applying bun patches"
for p in "${PATCHES}"/0*-bun-*.patch; do
  apply_patch "${p}"
done

# ── Copy skal_entry.zig into bun's source tree ─────────────────────────
SKAL_ENTRY_DST="${VENDOR}/bun/src/skal_entry.zig"
if [[ ! -f "${SKAL_ENTRY_DST}" ]] || ! cmp -s "${PATCHES}/skal_entry.zig" "${SKAL_ENTRY_DST}"; then
  cp "${PATCHES}/skal_entry.zig" "${SKAL_ENTRY_DST}"
  echo ">>> placed src/skal_entry.zig"
fi

# ── Clone WebKit ───────────────────────────────────────────────────────
if [[ ! -d "${VENDOR}/WebKit" ]]; then
  echo ">>> cloning oven-sh/WebKit (shallow, slow — ~5–10 min)"
  git clone --depth 1 https://github.com/oven-sh/WebKit.git "${VENDOR}/WebKit"
fi
cd "${VENDOR}/WebKit"
if [[ "$(git rev-parse HEAD)" != "${WEBKIT_COMMIT}" ]]; then
  echo "warning: vendor/WebKit is at $(git rev-parse --short HEAD), expected ${WEBKIT_COMMIT:0:10}"
fi

# ── Install bun's npm deps (needed for codegen) ────────────────────────
cd "${VENDOR}/bun"
echo ">>> bun install (in vendor/bun)"
bun install --silent

echo
echo "Setup done. Next steps:"
echo "  1. Build ICU + JSC (one-time, ~30–60 min):"
echo "     scripts/build-icu-android.sh"
echo "     scripts/build-jsc-android.sh"
echo
echo "  2. Build bun for Android (one-time ~20–30 min, incremental rebuilds ~3 min):"
echo "     cd vendor/bun && bun scripts/build.ts --profile=android-release \\"
echo "       --build-dir=\$(pwd)/build/android"
echo
echo "  3. Re-link as libskal.so:"
echo "     scripts/link-skal-so.sh"
