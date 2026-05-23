#!/usr/bin/env bash
# Link bun's release object files as libskal.dylib for the iOS Simulator
# (aarch64-apple-ios-simulator). Independent of the macOS link script
# (flutter/scripts/link-libskal-flutter-mac.sh) — this script's outputs
# (build/skal-iossim/) don't depend on Desktop's outputs (build/skal-darwin/),
# and a change to Desktop's link doesn't relink this binary.
#
# How this works (and why it's not a clean cross-compile):
#
#   bun's .o files were compiled with `-target aarch64-macos-none`
#   (LC_BUILD_VERSION = MACOS in their Mach-O headers). Apple's linker
#   (both ld_new AND ld_classic in Xcode 15+) refuses to combine them
#   with an iOS-simulator output platform — "building for iOS-simulator,
#   but linking in object file built for macOS". So we can't ask the
#   linker for an iOS-tagged dylib up-front.
#
#   Workaround: link with macOS target (same flags the Desktop link
#   uses), then `vtool -set-build-version 7 14.0 14.0 -replace` to
#   overwrite LC_BUILD_VERSION to IOSSIMULATOR. iOS Simulator on Apple
#   Silicon runs arm64 darwin code natively over the macOS kernel —
#   the only thing checking the platform tag is dyld_sim at app load.
#   Re-stamping is enough.
#
# Unique requirements vs the Desktop macOS link:
#   * Compiles packages/skal_native/ios/skal_iossim_shim.c — provides __clear_cache,
#     which iOS Simulator's libSystem doesn't export but bun's .o
#     files reference (macOS libSystem.B does export it).
#   * `-Wl,-U,___clear_cache` for per-symbol flat-namespace lookup so
#     dyld at runtime resolves it to our local definition instead of
#     to libSystem.B (which, on iOS Sim, doesn't have it).
#   * Output dir is build/skal-iossim/ (Desktop ships build/skal-darwin/).
set -euo pipefail

SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_DIR="${SKAL_ROOT}/vendor/bun"
BUN_BUILD="${BUN_DIR}/build/release"
SKAL_BUILD="${SKAL_ROOT}/build/skal-iossim"

# Toolchain discovery — Homebrew llvm@21 (matches bun's build).
# We use the macOS SDK here (not iPhoneSimulator.sdk) because the bun
# .o files were built for macOS and vtool re-stamps the output to
# IOSSIMULATOR after link. Switching to iPhoneSimulator.sdk now would
# fail-link with "object file built for macOS" — see this script's
# header for the long explanation.
if ! command -v brew >/dev/null 2>&1; then
  echo "error: brew not found in PATH; install Homebrew or provide LLVM_PREFIX" >&2
  exit 1
fi
LLVM_PREFIX="${LLVM_PREFIX:-$(brew --prefix llvm@21)}"
LLVM_BIN="${LLVM_PREFIX}/bin"
if [[ ! -x "${LLVM_BIN}/clang++" ]]; then
  echo "error: ${LLVM_BIN}/clang++ not found; run: brew install llvm@21" >&2
  exit 1
fi
CXX="${LLVM_BIN}/clang++"
SDK="$(xcrun --sdk macosx --show-sdk-path)"

mkdir -p "${SKAL_BUILD}"

if [[ ! -f "${BUN_BUILD}/build.ninja" ]]; then
  echo "error: bun release build not found at ${BUN_BUILD}" >&2
  echo "       run from vendor/bun: PATH=\"\$HOME/.cargo/bin:\$PATH\" bun run build:release" >&2
  exit 1
fi

# ── Extract link inputs from build.ninja (same as Desktop) ────────────

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
  | awk '
      $0 == "|" { stop = 1; next }
      stop { next }
      $0 ~ /^[[:space:]]*$/ { next }
      $0 == "$" { next }
      { print }
    ' \
  > "${INPUTS_FILE}"

echo "$(wc -l < "${INPUTS_FILE}" | tr -d ' ') link inputs extracted from build.ninja"

# ── iOS Simulator shim (__clear_cache) ────────────────────────────────

SHIM_O="${SKAL_BUILD}/skal_iossim_shim.o"
"${CXX}" -c -arch arm64 \
  -isysroot "${SDK}" \
  -mmacosx-version-min=26 \
  -O2 -fno-pic -fno-pie \
  -o "${SHIM_O}" \
  "${SKAL_ROOT}/packages/skal_native/ios/skal_iossim_shim.c"
echo "${SHIM_O}" >> "${INPUTS_FILE}"

# ── Exported-symbols list (C ABI for dart:ffi) ────────────────────────
#
# Exports only the C ABI (`skal_*`) the Flutter host's dart:ffi
# bindings call into. Each platform binary exports only what its
# platform actually needs.

SKAL_SYMS="${SKAL_BUILD}/skal-exports.txt"
cat > "${SKAL_SYMS}" <<'EOF'
_skal_create_runtime
_skal_dispose_runtime
_skal_evaluate
_skal_free_string
_skal_acquire_bridge
_skal_wake_js
___clear_cache
EOF

# ── Link flags (macOS target — vtool re-stamps to iOS Sim post-link) ──

LDFLAGS=(
  -dynamiclib
  -Wl,-ld_new
  -Wl,-no_compact_unwind
  -fno-keep-static-consts
  # macOS min on the link is only a transient marker — vtool re-stamps
  # LC_BUILD_VERSION to IOSSIMULATOR (minos=14, sdk=14) below. This
  # value just controls which "object file built for newer macOS" link
  # warnings appear. Setting to 14 matches Desktop's link for parity.
  -mmacosx-version-min=14
  -isysroot "${SDK}"
  -dead_strip
  -dead_strip_dylibs
  -Wl,-install_name,@rpath/libskal.dylib
  -Wl,-exported_symbols_list,"${SKAL_SYMS}"
  # Anchor each C export so dead_strip doesn't drop them.
  -Wl,-u,_skal_create_runtime
  -Wl,-u,_skal_dispose_runtime
  -Wl,-u,_skal_evaluate
  -Wl,-u,_skal_free_string
  -Wl,-u,_skal_acquire_bridge
  -Wl,-u,_skal_wake_js
  # __clear_cache: per-symbol flat-namespace lookup so dyld at runtime
  # resolves to our shim instead of looking in libSystem.B (which on
  # iOS Simulator doesn't have it). Re-export is handled by the
  # exported_symbols_list above (___clear_cache is in the list);
  # an explicit -Wl,-exported_symbol,___clear_cache here would be
  # redundant — the list is the canonical source of truth for what
  # leaves this dylib's dynamic symbol table.
  -Wl,-U,___clear_cache
  # Same system libs bun-profile links. libicucore + libresolv exist
  # on iOS Simulator at the same /usr/lib paths — no SDK swap needed.
  -licucore
  -lresolv
)

# ── Link + strip + vtool re-stamp ─────────────────────────────────────

UNSTRIPPED="${SKAL_BUILD}/libskal.unstripped.dylib"
STRIPPED_MAC="${SKAL_BUILD}/libskal.stripped.macos.dylib"
OUT="${SKAL_BUILD}/libskal.dylib"
echo "linking ${UNSTRIPPED}"
cd "${BUN_BUILD}"
"${CXX}" "@${INPUTS_FILE}" "${LDFLAGS[@]}" -o "${UNSTRIPPED}"

xcrun strip -x -S -o "${STRIPPED_MAC}" "${UNSTRIPPED}"

# vtool re-stamp: MACOS → IOSSIMULATOR. Platform 7 is iOS Simulator;
# minos / sdk = 14.0 matches the iOS app's deployment target.
xcrun vtool \
  -set-build-version 7 14.0 14.0 \
  -replace \
  -output "${OUT}" \
  "${STRIPPED_MAC}"
rm -f "${STRIPPED_MAC}"

echo
echo "✓ libskal.dylib (iOS Simulator) produced (stripped + unstripped):"
ls -la "${OUT}" "${UNSTRIPPED}"
file "${OUT}"
echo
echo "LC_BUILD_VERSION (must be IOSSIMULATOR):"
xcrun vtool -show "${OUT}" | grep -A 5 "LC_BUILD_VERSION" || true
echo
echo "C ABI symbols (must all be present):"
"${LLVM_BIN}/llvm-nm" -gU "${OUT}" 2>/dev/null | grep -E "^[0-9a-f]+ T _(skal_|_clear_cache)" || echo "(none — link probably failed)"
