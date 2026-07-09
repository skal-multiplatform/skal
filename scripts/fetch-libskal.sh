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
# The repo is public — assets download anonymously via curl. The gh CLI
# is used only as a fallback (e.g. private forks via SKAL_RELEASE_REPO).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${1:-libskal-dev}"
REPO="${SKAL_RELEASE_REPO:-skal-multiplatform/skal}"

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "→ downloading release '${TAG}' from ${REPO}"

# Anonymous path: list assets via the public API, download each via curl.
# Falls back to `gh release download` (auth) if the API isn't reachable
# anonymously — e.g. a private fork.
fetch_anonymous() {
  local api="https://api.github.com/repos/${REPO}/releases/tags/${TAG}"
  local urls
  urls="$(curl -fsSL --retry 3 "${api}" \
          | grep -o '"browser_download_url": *"[^"]*"' \
          | cut -d'"' -f4)" || return 1
  [[ -n "${urls}" ]] || return 1
  local url
  while IFS= read -r url; do
    echo "  ↓ ${url##*/}"
    curl -fsSL --retry 3 -o "${TMP}/${url##*/}" "${url}" || return 1
  done <<< "${urls}"
}

if ! fetch_anonymous; then
  echo "  anonymous download failed — falling back to gh CLI"
  command -v gh >/dev/null 2>&1 || {
    echo "error: could not download release anonymously and gh CLI not found" >&2
    echo "       install GitHub CLI and run 'gh auth login', or check ${REPO}/${TAG}" >&2
    exit 1
  }
  gh release download "${TAG}" --repo "${REPO}" --dir "${TMP}"
fi

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
