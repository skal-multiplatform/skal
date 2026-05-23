#!/usr/bin/env bash
# Re-link libskal.dylib for the Flutter macOS Desktop target.
#
# Sibling of link-libskal-flutter.sh (Android). Re-uses bun's
# host-release link inputs and produces a Mach-O dynamic library
# exporting just the `skal_*` C ABI from skal_entry.zig — the only
# surface dart:ffi needs.
#
# Output goes to examples/kitchen-sink/flutter-host/macos/Frameworks/libskal.dylib
# so Xcode's "Embed libskal.dylib" build phase picks it up automatically
# and copies it into the .app bundle's Contents/Frameworks/.
# Override the target via SKAL_FLUTTER_FRAMEWORKS=<abs path> to install
# into a different app's macOS Frameworks dir.
#
# Prereq: bun's host release build is current
# (vendor/bun/build/release/bun-profile exists).

set -euo pipefail

# Script lives at top-level scripts/; repo root is the parent dir.
SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_DIR="${SKAL_ROOT}/vendor/bun"
BUN_BUILD="${BUN_DIR}/build/release"
SKAL_BUILD="${SKAL_ROOT}/build/skal-darwin"
FLUTTER_FRAMEWORKS="${SKAL_FLUTTER_FRAMEWORKS:-${SKAL_ROOT}/examples/kitchen-sink/flutter-host/macos/Frameworks}"

# Toolchain — Homebrew llvm@21 (matches bun's build).
if ! command -v brew >/dev/null 2>&1; then
  echo "error: brew not found; install Homebrew or set LLVM_PREFIX" >&2
  exit 1
fi
LLVM_PREFIX="${LLVM_PREFIX:-$(brew --prefix llvm@21)}"
LLVM_BIN="${LLVM_PREFIX}/bin"
CXX="${LLVM_BIN}/clang++"
SDK="$(xcrun --sdk macosx --show-sdk-path)"

if [[ ! -f "${BUN_BUILD}/build.ninja" ]]; then
  echo "error: bun release build not found at ${BUN_BUILD}" >&2
  echo "       run: cd vendor/bun && PATH=\"\$HOME/.cargo/bin:\$PATH\" bun run build:release" >&2
  exit 1
fi

mkdir -p "${SKAL_BUILD}" "${FLUTTER_FRAMEWORKS}"

# Re-use the link-inputs.rsp from a previous run if present; otherwise
# extract fresh from build.ninja.
INPUTS_FILE="${SKAL_BUILD}/skal-link-inputs.rsp"
if [[ ! -f "${INPUTS_FILE}" ]]; then
  echo "extracting link inputs from ${BUN_BUILD}/build.ninja"
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
    | awk '
        $0 == "|" { stop = 1; next }
        stop { next }
        $0 ~ /^[[:space:]]*$/ { next }
        $0 == "$" { next }
        { print }
      ' \
    > "${INPUTS_FILE}"
fi

echo "$(wc -l < "${INPUTS_FILE}" | tr -d ' ') link inputs"

# ── Exported symbols list — skal_* C ABI ─────────────────────────────
SKAL_SYMS="${SKAL_BUILD}/skal-flutter-exports.txt"
cat > "${SKAL_SYMS}" <<'EOF'
_skal_create_runtime
_skal_dispose_runtime
_skal_evaluate
_skal_free_string
_skal_acquire_bridge
_skal_wake_js
_skal_prewarm_store
EOF

LDFLAGS=(
  -dynamiclib
  -Wl,-ld_new
  -Wl,-no_compact_unwind
  -fno-keep-static-consts
  -mmacosx-version-min=14
  -isysroot "${SDK}"
  -dead_strip
  -dead_strip_dylibs
  -Wl,-install_name,@rpath/libskal.dylib
  -Wl,-exported_symbols_list,"${SKAL_SYMS}"
  # Anchor each C-ABI export so -dead_strip doesn't drop them.
  -Wl,-u,_skal_create_runtime
  -Wl,-u,_skal_dispose_runtime
  -Wl,-u,_skal_evaluate
  -Wl,-u,_skal_free_string
  -Wl,-u,_skal_acquire_bridge
  -Wl,-u,_skal_wake_js
  -Wl,-u,_skal_prewarm_store
  -licucore
  -lresolv
)

UNSTRIPPED="${SKAL_BUILD}/libskal.flutter.unstripped.dylib"
OUT="${SKAL_BUILD}/libskal.flutter.dylib"
echo "linking ${UNSTRIPPED}"
cd "${BUN_BUILD}"
"${CXX}" "@${INPUTS_FILE}" "${LDFLAGS[@]}" -o "${UNSTRIPPED}"

echo "stripping → ${OUT}"
xcrun strip -x -S -o "${OUT}" "${UNSTRIPPED}"

# Code-sign with ad-hoc identity. Flutter Mac apps run unsigned in
# dev but the dylib must be at minimum ad-hoc-signed or the loader
# rejects it on hardened runtime.
codesign --force --sign - "${OUT}"

echo "copying → ${FLUTTER_FRAMEWORKS}/libskal.dylib"
cp "${OUT}" "${FLUTTER_FRAMEWORKS}/libskal.dylib"

echo
echo "✓ libskal.dylib installed to Flutter macOS Frameworks dir ($(du -sh "${FLUTTER_FRAMEWORKS}/libskal.dylib" | cut -f1))"
echo
echo "Dynamic exports (skal_* only):"
"${LLVM_BIN}/llvm-nm" -gU "${OUT}" 2>/dev/null | grep -E " _skal_" || true
