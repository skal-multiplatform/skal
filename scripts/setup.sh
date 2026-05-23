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
#   2. clone vendor/bun + vendor/WebKit     — ~5-10 min, shallow
#   3. apply patches + place skal_entry.zig
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

# ── 2-3. clone vendor + apply patches ────────────────────────────────
step "2/6  clone vendor/bun + vendor/WebKit"

BUN_COMMIT="$(cat "${PATCHES}/bun-base-commit.txt" | tr -d '[:space:]')"
WEBKIT_COMMIT="$(cat "${PATCHES}/webkit-base-commit.txt" | tr -d '[:space:]')"
mkdir -p "${VENDOR}"

if [[ ! -d "${VENDOR}/bun" ]]; then
  note "cloning oven-sh/bun (shallow)"
  git clone --depth 1 https://github.com/oven-sh/bun.git "${VENDOR}/bun"
else
  note "vendor/bun already present"
fi
cd "${VENDOR}/bun"
if [[ "$(git rev-parse HEAD)" != "${BUN_COMMIT}" ]]; then
  warn "vendor/bun is at $(git rev-parse --short HEAD), patches were generated against ${BUN_COMMIT:0:10}"
fi

step "3/6  apply bun patches + place skal_entry.zig"
apply_patch() {
  local p="$1"
  if git apply --reverse --check "${p}" 2>/dev/null; then
    note "already applied: $(basename "${p}")"
  else
    git apply --check "${p}" 2>/dev/null
    git apply "${p}"
    note "applied:         $(basename "${p}")"
  fi
}
for p in "${PATCHES}"/0*-bun-*.patch; do apply_patch "${p}"; done

# Order of patches:
#   0001  src/main.zig          android-only comptime import of skal_entry.zig
#   0002  scripts/build/tools.ts find ld.lld on darwin (cross-compile bug)
#   0003  packages/bun-usockets/src/eventing/epoll_kqueue.c
#                                disable epoll_pwait2 on Android (seccomp)

SKAL_ENTRY_DST="${VENDOR}/bun/src/skal_entry.zig"
if [[ ! -f "${SKAL_ENTRY_DST}" ]] || ! cmp -s "${PATCHES}/skal_entry.zig" "${SKAL_ENTRY_DST}"; then
  cp "${PATCHES}/skal_entry.zig" "${SKAL_ENTRY_DST}"
  note "placed src/skal_entry.zig"
else
  note "src/skal_entry.zig already in place"
fi

if [[ ! -d "${VENDOR}/WebKit" ]]; then
  note "cloning oven-sh/WebKit (shallow, ~5-10 min)"
  git clone --depth 1 https://github.com/oven-sh/WebKit.git "${VENDOR}/WebKit"
else
  note "vendor/WebKit already present"
fi
cd "${VENDOR}/WebKit"
if [[ "$(git rev-parse HEAD)" != "${WEBKIT_COMMIT}" ]]; then
  warn "vendor/WebKit is at $(git rev-parse --short HEAD), expected ${WEBKIT_COMMIT:0:10}"
fi

cd "${VENDOR}/bun"
note "bun install inside vendor/bun (needed for bun's own codegen)"
bun install --silent

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
