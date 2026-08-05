#!/usr/bin/env bash
# Re-link libskal.so for the Flutter Android target.
#
# Takes the input .o + .a list that bun's Android build produced for
# its `bun-profile` executable and re-links them as a position-
# independent shared library (well, technically -pie + ET_DYN; see the
# comment below) that exports just the `skal_*` C ABI from
# skal_entry.zig — the only surface dart:ffi needs.
#
# Output: <target app>/flutter-host/android/app/src/main/jniLibs/arm64-v8a/libskal.so
#         (default: examples/kitchen-sink — see TARGET SELECTION below)
# (Android's stock native-libs location — the directory name is set by
# AGP convention even though we don't actually use JNI; dart:ffi calls
# the C ABI directly.) Override the target via SKAL_FLUTTER_NATIVE_LIBS=<abs>
# to install into another app's android jniLibs dir.
#
# Prereq: bun's Android cross-build is current. From the repo root:
#   ANDROID_NDK_ROOT=/opt/homebrew/share/android-ndk \
#     bun --cwd vendor/bun scripts/build.ts --profile=android-release \
#     --build-dir=$(pwd)/vendor/bun/build/android

set -euo pipefail

# Script lives at top-level scripts/; repo root is the parent dir.
SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_BUILD="${SKAL_ROOT}/vendor/bun/build/android"
SKAL_BUILD="${SKAL_ROOT}/build/skal-android"
# TARGET SELECTION.
#
#   (default)                   examples/kitchen-sink
#   --app <name> | SKAL_APP     resolved under examples/ then benchmark_v2/
#   SKAL_FLUTTER_NATIVE_LIBS    an absolute jniLibs dir, wins over both
#
# The named form exists because the default installs into ONE app and
# every other Flutter host in the repo keeps whatever .so it had. A
# benchmark run against a different app then measures a stale binary and
# nothing looks wrong — which is exactly what happened on 2026-08-05,
# where skal-bench ran a day-old libskal missing the symbol under test.
# See the staleness report at the end of this script.
SKAL_APP="${SKAL_APP:-}"
if [[ "${1:-}" == "--app" ]]; then SKAL_APP="${2:?--app needs a name}"; shift 2; fi

resolve_app() {                 # <name> -> jniLibs dir, or empty
  local n="$1" c
  for c in "${SKAL_ROOT}/examples/$n" "${SKAL_ROOT}/benchmark_v2/$n"; do
    if [[ -d "$c/flutter-host/android/app/src/main" ]]; then
      echo "$c/flutter-host/android/app/src/main/jniLibs/arm64-v8a"; return
    fi
  done
}

if [[ -n "${SKAL_FLUTTER_NATIVE_LIBS:-}" ]]; then
  FLUTTER_NATIVE_LIBS="${SKAL_FLUTTER_NATIVE_LIBS}"
elif [[ -n "${SKAL_APP}" ]]; then
  FLUTTER_NATIVE_LIBS="$(resolve_app "${SKAL_APP}")"
  if [[ -z "${FLUTTER_NATIVE_LIBS}" ]]; then
    echo "no Flutter host for app '${SKAL_APP}' under examples/ or benchmark_v2/" >&2
    exit 1
  fi
else
  FLUTTER_NATIVE_LIBS="${SKAL_ROOT}/examples/kitchen-sink/flutter-host/android/app/src/main/jniLibs/arm64-v8a"
fi

# ── who else is holding a different libskal? ─────────────────────────
#
# This script installs into ONE app. Every other Flutter host in the
# repo keeps whatever it had, and a benchmark against one of those
# measures a stale binary with nothing to show for it. Printing the list
# turns a silent trap into a line of output.
report_stale() {
  local installed="$1" me
  me="$(shasum -a 256 "$installed" | cut -d' ' -f1)"
  local stale=()
  while IFS= read -r other; do
    [[ "$other" == "$installed" ]] && continue
    [[ "$(shasum -a 256 "$other" | cut -d' ' -f1)" == "$me" ]] && continue
    stale+=("${other#${SKAL_ROOT}/}")
  done < <(find "${SKAL_ROOT}/examples" "${SKAL_ROOT}/benchmark_v2" \
             -path "*/android/app/src/main/jniLibs/*/libskal.so" 2>/dev/null)
  if [[ ${#stale[@]} -gt 0 ]]; then
    echo
    echo "!! these hosts still have a DIFFERENT libskal.so:"
    printf '     %s\n' "${stale[@]}"
    echo "   re-run with --app <name> before benchmarking them."
  fi
}

# Prebuilt fast path — scripts/fetch-libskal.sh downloaded a ready-made
# .so into build/skal-android/; install it without relinking (no NDK,
# no vendor/bun Android cross-build needed on this machine). Taken when
# SKAL_PREBUILT is set, or automatically when there's no source build
# to relink from (prebuilt-only checkout).
PREBUILT="${SKAL_BUILD}/libskal.flutter.so"
if [[ -f "${PREBUILT}" ]] && [[ -n "${SKAL_PREBUILT:-}" || ! -f "${BUN_BUILD}/build.ninja" ]]; then
  mkdir -p "${FLUTTER_NATIVE_LIBS}"
  cp "${PREBUILT}" "${FLUTTER_NATIVE_LIBS}/libskal.so"
  echo "✓ libskal.so (prebuilt) → ${FLUTTER_NATIVE_LIBS}/libskal.so"
  report_stale "${FLUTTER_NATIVE_LIBS}/libskal.so"
  exit 0
fi

NDK="/opt/homebrew/share/android-ndk"
SYSROOT="${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/sysroot"
LLVM_BIN="/opt/homebrew/opt/llvm@21/bin"
CXX="${LLVM_BIN}/clang++"

# ld.lld moved out of the llvm keg into the lld/lld@21 formula on newer
# Homebrew bottles — probe the known homes instead of hardcoding one.
LLD=""
for cand in "/opt/homebrew/opt/lld@21/bin/ld.lld" "${LLVM_BIN}/ld.lld" "$(command -v ld.lld || true)"; do
  [[ -n "${cand}" && -x "${cand}" ]] && { LLD="${cand}"; break; }
done
if [[ -z "${LLD}" ]]; then
  echo "error: ld.lld not found (brew install lld@21)" >&2
  exit 1
fi

if [[ ! -f "${BUN_BUILD}/build.ninja" ]]; then
  echo "error: bun Android build not found at ${BUN_BUILD}" >&2
  echo "       see this script's header for the build command" >&2
  exit 1
fi

mkdir -p "${FLUTTER_NATIVE_LIBS}" "${SKAL_BUILD}"

# ── Extract link inputs from bun's build.ninja ─────────────────────────
#
# Ninja stmt format:
#   build bun-profile: link a.o b.o $\n    c.o d.o $\n    e.o\n
#     ldflags = ...\n
# Each non-empty content line ends with " $" (line continuation). After
# the inputs comes "  ldflags = ..." (a variable binding, indented +
# contains '='). Stop there. After the awk pass, split tokens to one
# per line and drop ninja's implicit-input separator `|` plus any
# version-script files we're replacing.

INPUTS_FILE="${SKAL_BUILD}/skal-link-inputs.rsp"

awk '
  /^build bun-profile: link / {
    capture = 1
    sub(/^build bun-profile: link /, "")
    sub(/[[:space:]]*\$$/, "")
    print
    next
  }
  capture {
    if ($0 ~ /^[[:space:]]+[a-zA-Z_][a-zA-Z_0-9]*[[:space:]]*=/) { capture = 0; next }
    sub(/^[[:space:]]+/, "")
    sub(/[[:space:]]*\$$/, "")
    print
  }
' "${BUN_BUILD}/build.ninja" \
  | tr ' ' '\n' \
  | grep -vE '^\s*$|^\|$|symbols\.dyn$|linker\.lds$|^\$$' \
  > "${INPUTS_FILE}"

echo "$(wc -l < "${INPUTS_FILE}") link inputs extracted"

# ── Link flags ─────────────────────────────────────────────────────────
#
# Derived from bun's bun-profile ldflags but as a -pie ET_DYN (so
# Android's dlopen will load it) with the `skal_*` C ABI as the
# only exported surface.
#
# Why -pie instead of -shared: bun's bun-zig.*.o files contain Zig
# generic instantiation symbols whose names embed `@` (e.g.
# `clap.Args(@as(...))`). lld parses `@` in a symbol name as the start
# of a version annotation only under -shared, which then rejects
# unrecognized versions. -pie bypasses that path. Android's dlopen
# accepts ET_DYN files with an interpreter set, so we link as -pie
# and strip the interpreter requirement at the linker step.
LDFLAGS=(
  --target=aarch64-unknown-linux-android28
  --sysroot="${SYSROOT}"
  --rtlib=compiler-rt
  --unwindlib=libunwind
  -stdlib=libc++
  -static-libstdc++
  -L"${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/lib/clang/21/lib/linux/aarch64"
  -Wl,--eh-frame-hdr
  --ld-path="${LLD}"
  -fPIC
  -pie
  -Wl,--no-dynamic-linker
  -Wl,--as-needed
  -Wl,-z,stack-size=12800000
  -Wl,-z,lazy
  -Wl,-z,norelro
  -Wl,-O2
  -Wl,-z,combreloc
  -Wl,--hash-style=both
  -Wl,--build-id=sha1
  -Wl,--gc-sections
  -Wl,-icf=safe
  -Wl,-Bsymbolic-functions

  # skal_* C-ABI exports — what dart:ffi dlsyms. --undefined anchors
  # each export so --gc-sections doesn't drop the wrapper;
  # --export-dynamic-symbol puts it in .dynsym so dlsym finds it.
  -Wl,--undefined=skal_create_runtime
  -Wl,--undefined=skal_dispose_runtime
  -Wl,--undefined=skal_evaluate
  -Wl,--undefined=skal_free_string
  -Wl,--undefined=skal_acquire_bridge
  -Wl,--undefined=skal_wake_js
  -Wl,--undefined=skal_runtime_was_reused
  -Wl,--undefined=skal_init_dart_api
  -Wl,--undefined=skal_set_host_port
  -Wl,--undefined=skal_prewarm_store
  -Wl,--export-dynamic-symbol=skal_create_runtime
  -Wl,--export-dynamic-symbol=skal_dispose_runtime
  -Wl,--export-dynamic-symbol=skal_evaluate
  -Wl,--export-dynamic-symbol=skal_free_string
  -Wl,--export-dynamic-symbol=skal_acquire_bridge
  -Wl,--export-dynamic-symbol=skal_wake_js
  -Wl,--export-dynamic-symbol=skal_runtime_was_reused
  -Wl,--export-dynamic-symbol=skal_init_dart_api
  -Wl,--export-dynamic-symbol=skal_set_host_port
  -Wl,--export-dynamic-symbol=skal_prewarm_store

  -lc -lm -llog
)

UNSTRIPPED="${SKAL_BUILD}/libskal.flutter.unstripped.so"
OUT="${SKAL_BUILD}/libskal.flutter.so"

echo "linking ${UNSTRIPPED}"
cd "${BUN_BUILD}"
"${CXX}" "@${INPUTS_FILE}" "${LDFLAGS[@]}" -o "${UNSTRIPPED}"

echo "stripping → ${OUT}"
"${LLVM_BIN}/llvm-strip" --strip-unneeded -x "${UNSTRIPPED}" -o "${OUT}"

echo "copying → ${FLUTTER_NATIVE_LIBS}/libskal.so"
cp "${OUT}" "${FLUTTER_NATIVE_LIBS}/libskal.so"

echo
echo "Dynamic exports (skal_* only):"
"${LLVM_BIN}/llvm-nm" -D "${OUT}" 2>/dev/null | grep -E " skal_" || true

echo
echo "✓ libskal.so installed ($(du -sh "${FLUTTER_NATIVE_LIBS}/libskal.so" | cut -f1))"

report_stale "${FLUTTER_NATIVE_LIBS}/libskal.so"

