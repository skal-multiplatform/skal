#!/usr/bin/env bash
# Download prebuilt libskal binaries from the GitHub release produced by
# .github/workflows/release-libskal.yml, and place them exactly where the
# link scripts + bytecode pipeline already look:
#
#   build/skal-darwin/libskal.flutter.dylib   macOS desktop  (link-libskal-flutter-mac.sh fast path)
#   build/skal-iossim/libskal.dylib           iOS Simulator  (skal-link.sh copies as-is)
#   build/skal-android/libskal.flutter.so     Android arm64  (link-libskal-flutter.sh fast path)
#   build/skal-bun/bun                        host bun — bytecode generation
#                                             (find-vendored-bun.sh resolution order)
#
# Usage:  scripts/fetch-libskal.sh [tag]      (default: libskal-dev)
# Normally invoked via `SKAL_PREBUILT=1 bun run setup`.
#
# Requires the `gh` CLI authenticated with access to the repo (the repo
# is private until launch; post-launch this can fall back to plain curl).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-libskal-dev}"
REPO="${SKAL_RELEASE_REPO:-andrepimenta/skal}"

command -v gh >/dev/null 2>&1 || {
  echo "error: gh CLI not found — install GitHub CLI and run 'gh auth login'" >&2
  exit 1
}

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "→ downloading release '${TAG}' from ${REPO}"
gh release download "${TAG}" --repo "${REPO}" --dir "${TMP}"

# Verify whatever checksum files the release carries (one per builder job).
(
  cd "${TMP}"
  found=0
  for c in checksums-*.txt; do
    [[ -f "${c}" ]] || continue
    found=1
    shasum -a 256 -c "${c}"
  done
  [[ ${found} -eq 1 ]] || echo "warning: release has no checksum files — skipping verification" >&2
)

install_asset() {  # <asset-name> <dest-path> [chmod-x]
  local asset="$1" dest="$2"
  if [[ ! -f "${TMP}/${asset}" ]]; then
    echo "  – ${asset}: not in release (skipping)"
    return 0
  fi
  mkdir -p "$(dirname "${dest}")"
  cp "${TMP}/${asset}" "${dest}"
  [[ "${3:-}" == "x" ]] && chmod +x "${dest}"
  echo "  ✓ ${asset} → ${dest#${ROOT}/}"
}

echo "→ installing artifacts"
install_asset libskal-macos-arm64.dylib   "${ROOT}/build/skal-darwin/libskal.flutter.dylib"
install_asset libskal-iossim-arm64.dylib  "${ROOT}/build/skal-iossim/libskal.dylib"
install_asset libskal-android-arm64.so    "${ROOT}/build/skal-android/libskal.flutter.so"
install_asset bun-darwin-arm64            "${ROOT}/build/skal-bun/bun" x

if [[ -f "${TMP}/manifest.json" ]]; then
  cp "${TMP}/manifest.json" "${ROOT}/build/skal-prebuilt-manifest.json"
  echo "→ manifest:"
  sed 's/^/    /' "${TMP}/manifest.json"
fi

echo "✓ prebuilt libskal installed (link with: scripts/skal-link.sh <app> <platform>, SKAL_PREBUILT=1)"
