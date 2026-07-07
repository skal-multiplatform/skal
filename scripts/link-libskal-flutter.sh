#!/usr/bin/env bash
# Re-link libskal.so for the Flutter Android target.
#
# Takes the input .o + .a list that bun's Android build produced for
# its `bun-profile` executable and re-links them as a position-
# independent shared library (well, technically -pie + ET_DYN; see the
# comment below) that exports just the `skal_*` C ABI from
# skal_entry.zig — the only surface dart:ffi needs.
#
# Output: examples/kitchen-sink/flutter-host/android/app/src/main/jniLibs/arm64-v8a/libskal.so
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
FLUTTER_NATIVE_LIBS="${SKAL_FLUTTER_NATIVE_LIBS:-${SKAL_ROOT}/examples/kitchen-sink/flutter-host/android/app/src/main/jniLibs/arm64-v8a}"

# Prebuilt fast path — scripts/fetch-libskal.sh downloaded a ready-made
# .so into build/skal-android/; install it without relinking (no NDK,
# no vendor/bun Android cross-build needed on this machine).
PREBUILT="${SKAL_BUILD}/libskal.flutter.so"
if [[ -n "${SKAL_PREBUILT:-}" && -f "${PREBUILT}" ]]; then
  mkdir -p "${FLUTTER_NATIVE_LIBS}"
  cp "${PREBUILT}" "${FLUTTER_NATIVE_LIBS}/libskal.so"
  echo "✓ libskal.so (prebuilt) → ${FLUTTER_NATIVE_LIBS}/libskal.so"
  exit 0
fi

NDK="/opt/homebrew/share/android-ndk"
SYSROOT="${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/sysroot"
LLVM_BIN="/opt/homebrew/opt/llvm@21/bin"
LLD="${LLVM_BIN}/ld.lld"
CXX="${LLVM_BIN}/clang++"

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
  -Wl,--undefined=skal_prewarm_store
  -Wl,--export-dynamic-symbol=skal_create_runtime
  -Wl,--export-dynamic-symbol=skal_dispose_runtime
  -Wl,--export-dynamic-symbol=skal_evaluate
  -Wl,--export-dynamic-symbol=skal_free_string
  -Wl,--export-dynamic-symbol=skal_acquire_bridge
  -Wl,--export-dynamic-symbol=skal_wake_js
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
