#!/usr/bin/env bash
# bun run setup — install everything needed to develop Skal.
#
# Run once after `git clone`. Idempotent — re-running skips steps
# whose outputs already exist. Total time on a fresh clone:
#   • host-only (no Android NDK):  ~30-40 min
#   • with Android NDK installed:  ~90-120 min
#
# Steps:
#   1. bun install                          — workspace deps
#   2. clone Skal's bun + WebKit forks and pin them — shallow; WebKit
#      only when something needs it (Android/iOS JSC builds)
#   3. place skal_entry.zig
#   4. build vendor/bun for host            — ~30 min cold, ~3 min incremental
#   5. (if NDK present) ICU + JSC + bun for Android — ~60-90 min cold
#   6. link libskal binaries into kitchen-sink
#
# To opt out of Android even if NDK is present, set SKAL_NO_ANDROID=1.
# To opt out of iOS device (skipped by default — needs Apple cert),
# see scripts/build-jsc-ios.sh + scripts/link-skal-ios.sh.

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="${ROOT}/vendor"
PATCHES="${ROOT}/patches"
NDK="${ANDROID_NDK_ROOT:-/opt/homebrew/share/android-ndk}"

cd "${ROOT}"

step() { echo -e "\n\033[1;34m===>\033[0m \033[1m$*\033[0m"; }
note() { echo -e "\033[2m     $*\033[0m"; }
warn() { echo -e "\033[1;33m     warning:\033[0m $*"; }

# Decide up-front whether to do Android. Either way, host is built.
ANDROID=1
if [[ -n "${SKAL_NO_ANDROID:-}" ]]; then
  ANDROID=0
elif [[ ! -d "${NDK}" ]]; then
  ANDROID=0
fi

# ── 1. bun install ───────────────────────────────────────────────────
step "1/6  bun install (workspace deps)"
if [[ -d "${ROOT}/node_modules" && -f "${ROOT}/bun.lock" ]]; then
  note "node_modules + bun.lock present — running incremental install"
fi
bun install --silent

# ── prebuilt fast path ───────────────────────────────────────────────
# SKAL_PREBUILT=1 downloads CI-built libskal binaries + the matching
# host bun from the release-libskal workflow's GitHub release instead
# of building the vendor stack (30-120 min → ~1 min; needs `gh` auth).
# Override the release tag with SKAL_PREBUILT_TAG. See
# scripts/fetch-libskal.sh and .github/workflows/release-libskal.yml.
if [[ -n "${SKAL_PREBUILT:-}" ]]; then
  export SKAL_PREBUILT
  step "2-5/6  fetch prebuilt libskal (skipping vendor clone + builds)"
  "${ROOT}/scripts/fetch-libskal.sh" "${SKAL_PREBUILT_TAG:-libskal-dev}"

  step "6/6  link libskal binaries into kitchen-sink"
  "${ROOT}/scripts/skal-link.sh" kitchen-sink macos
  if [[ -f "${ROOT}/build/skal-android/libskal.flutter.so" ]]; then
    "${ROOT}/scripts/skal-link.sh" kitchen-sink android
  fi
  if [[ -f "${ROOT}/build/skal-iossim/libskal.dylib" ]]; then
    "${ROOT}/scripts/skal-link.sh" kitchen-sink ios 2>/dev/null || true
  fi

  cat <<EOF


✓ Prebuilt setup done. Try the demo:

  bun run dev:macos                 # macOS desktop
  bun run dev:android               # Android emulator / device

(Bytecode generation uses the downloaded bun at build/skal-bun/bun —
see scripts/find-vendored-bun.sh. For from-source development, re-run
without SKAL_PREBUILT.)

EOF
  exit 0
fi

# ── 2-3. clone vendor forks (patch commits live on the forks) ────────
step "2/6  clone vendor forks — skal-multiplatform/{bun,WebKit} @ skal"

FORK_URL="https://github.com/skal-multiplatform"

read_pin() { tr -d '[:space:]' < "$1"; }
BUN_COMMIT="$(read_pin "${PATCHES}/bun-skal-commit.txt")"
WEBKIT_COMMIT="$(read_pin "${PATCHES}/webkit-skal-commit.txt")"
mkdir -p "${VENDOR}"

# Clone <url>'s `skal` branch into <dir> and put it AT the pinned
# commit — the pin, not the branch tip, is the source of truth for
# what gets built (the branch moves; builds must not). Self-heals a
# clean clone whose HEAD drifted (fork advanced, pin bumped, stale CI
# cache restored) by fetching + checking out the pin. Hard-fails
# instead of building the wrong tree when the directory is not a git
# checkout (interrupted clone / partial cache restore — git would
# otherwise walk UP and answer for the Skal repo itself) or carries
# local modifications (e.g. a pre-fork checkout whose patches live as
# uncommitted edits — the fork's commits replace those).
clone_pinned_fork() {
  local dir="$1" url="$2" pin="$3"
  if [[ ! -d "${dir}" ]]; then
    note "cloning ${url#https://github.com/} @ skal (shallow)"
    git clone --branch skal --depth 1 "${url}" "${dir}"
  else
    note "$(basename "${dir}") already present"
  fi
  if [[ ! -e "${dir}/.git" ]]; then
    echo "error: ${dir} exists but is not a git checkout (interrupted clone?)" >&2
    echo "       remove it and re-run:  rm -rf ${dir}" >&2
    exit 1
  fi
  if [[ "$(git -C "${dir}" rev-parse HEAD)" == "${pin}" ]]; then
    return 0
  fi
  if [[ -n "$(git -C "${dir}" status --porcelain --untracked-files=no)" ]]; then
    echo "error: ${dir} is not at the pinned commit ${pin:0:10} AND has local" >&2
    echo "       modifications, so it won't be reset automatically." >&2
    echo "       A pre-fork checkout carries the old patches as uncommitted edits —" >&2
    echo "       the fork's commits replace them, so they are safe to discard:" >&2
    echo "         git -C ${dir} fetch --depth 1 ${url} ${pin}" >&2
    echo "         git -C ${dir} checkout -f ${pin}" >&2
    echo "       (or start clean:  rm -rf ${dir}  and re-run setup)" >&2
    exit 1
  fi
  note "reconciling $(basename "${dir}") to pinned commit ${pin:0:10}"
  git -C "${dir}" fetch --depth 1 "${url}" "${pin}"
  git -C "${dir}" checkout --detach --quiet "${pin}"
}

clone_pinned_fork "${VENDOR}/bun" "${FORK_URL}/bun.git" "${BUN_COMMIT}"

# vendor/WebKit is only consumed by the Android/iOS JSC cross-builds
# (scripts/build-jsc-{android,ios}.sh) — the host bun build downloads
# its own PREBUILT JSC. Skip the 1.65 GiB clone unless a consumer is
# in play (or it's already on disk, in which case keep it reconciled
# to the pin). Force with SKAL_WEBKIT=1.
if [[ ${ANDROID} -eq 1 || -n "${SKAL_WEBKIT:-}" || -d "${VENDOR}/WebKit" ]]; then
  clone_pinned_fork "${VENDOR}/WebKit" "${FORK_URL}/WebKit.git" "${WEBKIT_COMMIT}"
else
  note "skipping vendor/WebKit — only the Android/iOS JSC builds need it (SKAL_WEBKIT=1 to force)"
fi

step "3/6  place skal_entry.zig"
# The bun + WebKit modifications live as real commits on the `skal`
# branch of Skal's forks (github.com/skal-multiplatform/{bun,WebKit})
# — no patch application at setup time. skal_entry.zig stays in THIS
# repo because it co-evolves with the Dart FFI + JS bridge halves; it
# is copied into the bun tree, which imports it via the fork's
# android/ios/macos build hook in src/main.zig.
SKAL_ENTRY_DST="${VENDOR}/bun/src/skal_entry.zig"
if [[ ! -f "${SKAL_ENTRY_DST}" ]] || ! cmp -s "${PATCHES}/skal_entry.zig" "${SKAL_ENTRY_DST}"; then
  cp "${PATCHES}/skal_entry.zig" "${SKAL_ENTRY_DST}"
  note "placed src/skal_entry.zig"
else
  note "src/skal_entry.zig already in place"
fi

cd "${VENDOR}/bun"
note "bun install inside vendor/bun (needed for bun's own codegen)"
bun install --silent

# CI bootstrap mode — stop after clone+pin+entry placement so the
# workflow's named steps own the builds (real per-step timing/logs
# instead of a 60-min opaque "Bootstrap"). Local `bun run setup` never
# sets this.
if [[ -n "${SKAL_BOOTSTRAP_ONLY:-}" ]]; then
  note "SKAL_BOOTSTRAP_ONLY set — skipping build/link steps (4-6)"
  exit 0
fi

# ── 4. build vendor/bun for host ─────────────────────────────────────
cd "${ROOT}"
step "4/6  build vendor/bun for host"

BUN_PROFILE="${VENDOR}/bun/build/release/bun-profile"
BUN_STRIPPED="${VENDOR}/bun/build/release/bun"

if [[ -x "${BUN_PROFILE}" || -x "${BUN_STRIPPED}" ]]; then
  note "vendor/bun host build already present"
  note "to rebuild, run: bun run build:libskal"
else
  note "first cold build — expect ~30 min on Apple Silicon"
  ( cd "${VENDOR}/bun" && PATH="$HOME/.cargo/bin:$PATH" bun run build:release )
fi

# ── 5. Android (optional) ────────────────────────────────────────────
if [[ ${ANDROID} -eq 1 ]]; then
  step "5/6  Android cross-builds (ICU + JSC + bun) — set SKAL_NO_ANDROID=1 to skip"

  # Build scripts install to <out>/install/lib/, not <out>/lib/.
  ICU_LIB="${ROOT}/build/icu-android/install/lib/libicuuc.a"
  if [[ -f "${ICU_LIB}" ]]; then
    note "ICU for Android already built"
  else
    note "building ICU for Android (~10 min)"
    ANDROID_NDK_ROOT="${NDK}" "${ROOT}/scripts/build-icu-android.sh"
  fi

  JSC_LIB="${ROOT}/build/jsc-android/install/lib/libJavaScriptCore.a"
  if [[ -f "${JSC_LIB}" ]]; then
    note "JSC for Android already built"
  else
    note "building JSC for Android (~30-60 min)"
    ANDROID_NDK_ROOT="${NDK}" "${ROOT}/scripts/build-jsc-android.sh"
  fi

  # bun's Android cross-build leaves bun-profile next to build.ninja —
  # check the binary specifically (build.ninja may exist mid-build).
  BUN_ANDROID="${VENDOR}/bun/build/android/bun-profile"
  if [[ -x "${BUN_ANDROID}" ]]; then
    note "vendor/bun Android build already present"
  else
    note "cross-building vendor/bun for Android (~20-30 min)"
    ANDROID_NDK_ROOT="${NDK}" bun --cwd "${VENDOR}/bun" scripts/build.ts \
      --profile=android-release --build-dir="${VENDOR}/bun/build/android"
  fi
else
  step "5/6  Android cross-builds"
  if [[ -n "${SKAL_NO_ANDROID:-}" ]]; then
    note "skipped (SKAL_NO_ANDROID=1)"
  else
    warn "Android NDK not found at ${NDK}"
    note "to enable: install via 'brew install --cask android-ndk' (or set ANDROID_NDK_ROOT) then re-run"
    note "host targets (macOS desktop, iOS Simulator, web) still work without it"
  fi
fi

# ── 6. link libskal binaries into kitchen-sink ───────────────────────
step "6/6  link libskal binaries into kitchen-sink"
"${ROOT}/scripts/skal-link.sh" kitchen-sink macos

if [[ ${ANDROID} -eq 1 ]]; then
  "${ROOT}/scripts/skal-link.sh" kitchen-sink android
fi

# iOS sim is best-effort — falls through silently if the sim libskal
# hasn't been built (not strictly needed for `bun run dev:macos`).
if [[ -f "${ROOT}/build/skal-iossim/libskal.dylib" ]]; then
  "${ROOT}/scripts/skal-link.sh" kitchen-sink ios 2>/dev/null || true
fi

# ── done ─────────────────────────────────────────────────────────────
cat <<EOF


✓ Setup done. Try the demo:

  bun run dev:macos                 # macOS desktop
  bun run dev:ios                   # iOS Simulator (boot one first via simctl)
$( [[ ${ANDROID} -eq 1 ]] && echo "  bun run dev:android               # Android emulator / device" )
  bun run dev:web                   # web preview → localhost:5173

Or scaffold your own:

  bun run new my-app                # creates examples/my-app/ ready to run

EOF
