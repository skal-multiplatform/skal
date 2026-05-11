#!/usr/bin/env bash
# Re-link bun's release object files as libskal.dylib (Mach-O dynamic
# library) with our JNI entry symbols exported. Mirrors link-skal-so.sh
# but for the macOS host build instead of Android.
#
# Strategy: bun's release link command produces an unstripped PIE called
# bun-profile. We take the same input set extracted from build.ninja's
# `build bun-profile: link` rule, but ask clang++ for a dylib instead and
# replace bun's `-exported_symbols_list src/symbols.txt` (which exports
# only V8/Node-API surface) with our own list — just the JNI entry points
# Kotlin's System.loadLibrary("skal") needs to find.
#
# Prerequisites:
#   1. bun's darwin release build completed (build/release/build.ninja exists,
#      with bun-zig.*.o + obj/**/*.o files produced).
#      Run from vendor/bun: PATH="$HOME/.cargo/bin:$PATH" bun run build:release
#   2. The darwin patch (patches/0001-bun-main-...patch) applied — adds the
#      .macos branch to main.zig's comptime gate so skal_entry.zig is included
#      in the bun-zig.*.o files.
set -euo pipefail

SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_DIR="${SKAL_ROOT}/vendor/bun"
BUN_BUILD="${BUN_DIR}/build/release"
SKAL_BUILD="${SKAL_ROOT}/build/skal-darwin"

# Toolchain discovery — derive paths from the host's installed tools
# rather than hardcoding /opt/homebrew/... + /Applications/Xcode.app/...
# Apple Silicon hosts use /opt/homebrew, Intel hosts use /usr/local;
# `brew --prefix` papers over the difference. Likewise, Xcode might
# live at /Applications/Xcode-beta.app or be only-CommandLineTools on
# a CI host — `xcrun --show-sdk-path` resolves whatever's active per
# `xcode-select`.
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

# ── Extract link inputs from build.ninja ──────────────────────────────
#
# Same shape as link-skal-so.sh's awk pass: capture the lines after
# `build bun-profile: link`, drop trailing `$` line continuations, stop
# at the first `key = value` variable binding (the ldflags line), and
# split tokens onto their own lines. Drop the implicit-input separator
# `|` and the version-script-style files we replace below.

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
      # Stop emitting at the implicit-input separator |. Anything after
      # it is for dep tracking only (e.g. ../../src/symbols.txt drives
      # rebuilds when the export list changes; not an .o or .a input).
      $0 == "|" { stop = 1; next }
      stop { next }
      $0 ~ /^[[:space:]]*$/ { next }
      $0 == "$" { next }
      { print }
    ' \
  > "${INPUTS_FILE}"

echo "$(wc -l < "${INPUTS_FILE}" | tr -d ' ') link inputs extracted from build.ninja"

# Note: this script intentionally does NOT pull in
# native/ios/skal_iossim_shim.c. Per TODO_PLATFORMS § 0.5/V1, the iOS
# shim is iOS-only and lives in scripts/link-skal-iossim.sh — Desktop's
# binary stays clean of iOS-intent code. macOS's libSystem.B exports
# __clear_cache directly, so the bun .o files' references resolve via
# the standard two-level namespace path with no extra plumbing.

# ── Build our exported-symbols list ────────────────────────────────────
#
# darwin ld uses underscore-prefixed C names. JNI_OnLoad and the
# Java_com_skal_Skal_native* functions are declared in skal_entry.zig
# with explicit @export names; the Mach-O ABI prepends an underscore.

SKAL_SYMS="${SKAL_BUILD}/skal-exports.txt"
# Desktop-only exports — JNI surface for the Compose Desktop JVM
# consumer. The C surface (`skal_*`) is iOS-only and lives in
# scripts/link-skal-iossim.sh's exports. Per TODO_PLATFORMS § 0.5/V1
# (modularity invariant: each platform's binary exports only what its
# platform needs).
cat > "${SKAL_SYMS}" <<'EOF'
_JNI_OnLoad
_Java_com_skal_Skal_nativeCreateRuntime
_Java_com_skal_Skal_nativeDisposeRuntime
_Java_com_skal_Skal_nativeEvaluate
_Java_com_skal_Skal_nativeAcquireBridge
_Java_com_skal_Skal_nativeWakeJs
EOF

# ── Link flags ────────────────────────────────────────────────────────
#
# Derived from bun-profile's ldflags but with executable-only flags
# replaced by their dylib equivalents:
#   -exported_symbols_list src/symbols.txt   →  our JNI list
#   (implicit MH_EXECUTE)                    →  -dynamiclib
#   -Wl,-stack_size,…                        →  drop (executable-only)
#   -Wl,-map,bun-profile.linker-map           →  drop
#
# JNI symbols come from skal_entry.zig (compiled into bun-zig.*.o by bun's
# build). They're unreferenced from C++ code, so -dead_strip would drop
# them — `-Wl,-u,_symbol` anchors each one as a "force load" reference,
# matching --undefined on ld.lld.

LDFLAGS=(
  -dynamiclib
  -Wl,-ld_new
  -Wl,-no_compact_unwind
  -fno-keep-static-consts
  # Output deployment target = macOS 14 (Sonoma). Bun's input .o
  # files target macOS 26 (Tahoe), which produces ~150 benign "object
  # file was built for newer macOS version" warnings during link.
  # We accept the warnings rather than bumping the output min:
  # raising minos to 26 would gate the dylib to Tahoe-or-newer at
  # load time, blocking 95%+ of users still on Sonoma/Sequoia.
  -mmacosx-version-min=14
  -isysroot "${SDK}"
  -dead_strip
  -dead_strip_dylibs
  -Wl,-install_name,@rpath/libskal.dylib
  -Wl,-exported_symbols_list,"${SKAL_SYMS}"
  # Anchor each JNI symbol as a "must keep" reference so dead_strip
  # doesn't drop them (nothing inside bun's C++/Zig code calls them).
  -Wl,-u,_JNI_OnLoad
  -Wl,-u,_Java_com_skal_Skal_nativeCreateRuntime
  -Wl,-u,_Java_com_skal_Skal_nativeDisposeRuntime
  -Wl,-u,_Java_com_skal_Skal_nativeEvaluate
  -Wl,-u,_Java_com_skal_Skal_nativeAcquireBridge
  -Wl,-u,_Java_com_skal_Skal_nativeWakeJs
  # Same system libs bun-profile links: ICU comes from /usr/lib/libicucore
  # (Apple's vendored ICU), libresolv for DNS.
  -licucore
  -lresolv
)

UNSTRIPPED="${SKAL_BUILD}/libskal.unstripped.dylib"
OUT="${SKAL_BUILD}/libskal.dylib"
echo "linking ${UNSTRIPPED}"
cd "${BUN_BUILD}"   # so relative paths in the .rsp resolve
"${CXX}" "@${INPUTS_FILE}" "${LDFLAGS[@]}" -o "${UNSTRIPPED}"

# Strip the dylib for shipping. -x drops all local symbols; -S drops
# DWARF debug info too (bun's release build emits -gdwarf-4 -g1 which
# accounts for ~25 MB of the unstripped size). Keeps the JNI export
# table intact — those symbols are explicit -Wl,-exported_symbol entries
# and survive any strip mode that doesn't touch the dynamic export table.
#
# Two outputs: the stripped libskal.dylib is what gets shipped + embedded
# in iOS apps / desktop dmg; libskal.unstripped.dylib stays on the build
# machine for symbolicating crashes via:
#   xcrun atos -o libskal.unstripped.dylib -l <load-addr> 0x<pc>
xcrun strip -x -S -o "${OUT}" "${UNSTRIPPED}"

echo
echo "✓ libskal.dylib produced (stripped + unstripped):"
ls -la "${OUT}" "${UNSTRIPPED}"
file "${OUT}"
echo
echo "JNI symbols (stripped binary, must still be present):"
"${LLVM_BIN}/llvm-nm" -gU "${OUT}" 2>/dev/null | grep -E "JNI_OnLoad|Java_com_skal" || echo "(none — link probably failed)"
