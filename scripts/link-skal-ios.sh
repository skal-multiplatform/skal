#!/usr/bin/env bash
# Link bun's iOS-cross-compiled Zig + C++ objects as libskal.dylib for
# real iOS device (aarch64-apple-ios). Mirrors link-skal-iossim.sh but
# for the device target — no vtool re-stamp because the input objects
# already declare LC_BUILD_VERSION=IPHONEOS.
#
# Differences from link-skal-iossim.sh:
#   * Inputs come from `build/ios-release/build.ninja` (bun's iOS C++
#     build) NOT `build/release/build.ninja` (macOS). The macOS object
#     files won't link into an iOS device binary even with vtool —
#     real iOS device dyld validates the iphoneos SDK ABI.
#   * No __clear_cache shim. iOS device's libSystem exports it
#     directly (Simulator's doesn't — that's the only platform that
#     needs the shim).
#   * `-isysroot $(xcrun --sdk iphoneos --show-sdk-path)` and
#     `-target arm64-apple-ios16.0` so the link sees iOS-targeted
#     libsystem stubs.
#   * NO explicit codesign here — Xcode's "Embed Frameworks" build
#     phase signs the dylib automatically when it's copied into the
#     .app/Frameworks/ directory. Doing it twice would just duplicate
#     work (the embed step replaces the signature anyway). This lets
#     the same script work with both free-Apple-ID personal-team
#     signing AND paid Developer Program distribution certs — Xcode
#     handles the identity selection.
#
# Prerequisites:
#   1. bun-ios-release configured + built:
#        cd vendor/bun
#        ln -sfn $PWD/../WebKit vendor/WebKit
#        PATH="$HOME/.cargo/bin:$PATH" bun scripts/build.ts \
#            --profile=ios-release --build-dir=build/ios-release --configure-only
#        PATH="$HOME/.cargo/bin:$PATH" ninja -C build/ios-release
#      (Resolves all 22 deps + bun-zig.o + bun C++ .o files for iOS
#       arm64. See patches/0004-bun-ios-target-plumbing.patch.)
#   2. WebKit iOS build complete (output at build/skal-jsc-ios/lib/
#      or vendor/bun/build/ios-release/deps/WebKit/lib/).

set -euo pipefail

SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_DIR="${SKAL_ROOT}/vendor/bun"
BUN_BUILD="${BUN_DIR}/build/ios-release"
SKAL_BUILD="${SKAL_ROOT}/build/skal-ios-device"

# Toolchain — see link-skal-dylib.sh's brew/xcrun rationale.
if ! command -v brew >/dev/null 2>&1; then
  echo "error: brew not found in PATH" >&2
  exit 1
fi
LLVM_PREFIX="${LLVM_PREFIX:-$(brew --prefix llvm@21)}"
LLVM_BIN="${LLVM_PREFIX}/bin"
if [[ ! -x "${LLVM_BIN}/clang++" ]]; then
  echo "error: ${LLVM_BIN}/clang++ not found; run: brew install llvm@21" >&2
  exit 1
fi
CXX="${LLVM_BIN}/clang++"
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"

mkdir -p "${SKAL_BUILD}"

if [[ ! -f "${BUN_BUILD}/build.ninja" ]]; then
  echo "error: bun iOS C++ build not configured at ${BUN_BUILD}" >&2
  echo "       run from vendor/bun (after applying patches/0004-...patch):" >&2
  echo "         ln -sfn \$PWD/../WebKit vendor/WebKit" >&2
  echo "         PATH=\"\$HOME/.cargo/bin:\$PATH\" bun scripts/build.ts \\" >&2
  echo "             --profile=ios-release \\" >&2
  echo "             --build-dir=build/ios-release \\" >&2
  echo "             --configure-only" >&2
  exit 1
fi

# ── Extract link inputs from build.ninja ──────────────────────────────
#
# Same shape as link-skal-dylib.sh / link-skal-iossim.sh: capture the
# lines after `build bun-profile: link`, drop $-line-continuation
# tokens, stop at the first `key = value` variable binding (ldflags),
# drop the `|` implicit-input separator. The result is the exact same
# input set bun would have linked into bun-profile (which we don't
# produce on iOS — we want a dylib, not an executable).

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

# ── Exported-symbols list ──────────────────────────────────────────────
#
# Same C ABI as iOS Simulator — Kotlin/Native cinterop binds the same
# skal.def regardless of Simulator vs Device. No JNI surface (no JVM
# on iOS). No __clear_cache (libSystem on real iOS device has it).

SKAL_SYMS="${SKAL_BUILD}/skal-exports.txt"
cat > "${SKAL_SYMS}" <<'EOF'
_skal_create_runtime
_skal_dispose_runtime
_skal_evaluate
_skal_free_string
_skal_acquire_bridge
_skal_wake_js
EOF

# ── Link flags ─────────────────────────────────────────────────────────
#
# Derived from bun's ldflags (extracted via build.ninja) plus dylib-
# specific flags. The `-target arm64-apple-ios16.0` matches every input
# object's LC_BUILD_VERSION (bun's iOS C++ build was patched to emit
# this target via cfg.crossTarget); no vtool re-stamp needed.

LDFLAGS=(
  -dynamiclib
  -Wl,-ld_new
  -Wl,-no_compact_unwind
  -fno-keep-static-consts
  -target arm64-apple-ios16.0
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
  # Same system libs bun-profile links. libicucore + libresolv exist
  # on iOS device at the same /usr/lib paths as macOS/Simulator.
  -licucore
  -lresolv
)

# ── Link + strip + codesign ────────────────────────────────────────────

UNSTRIPPED="${SKAL_BUILD}/libskal.unstripped.dylib"
OUT="${SKAL_BUILD}/libskal.dylib"
echo "linking ${UNSTRIPPED}"
cd "${BUN_BUILD}"
"${CXX}" "@${INPUTS_FILE}" "${LDFLAGS[@]}" -o "${UNSTRIPPED}"

xcrun strip -x -S -o "${OUT}" "${UNSTRIPPED}"

# NOTE: libskal.dylib is left UNSIGNED here. Xcode's "Embed Frameworks"
# build phase signs it during the .app build, using whatever identity
# the Skal Xcode project is configured for (personal team / free
# Apple ID for sideload, paid Developer Program for TestFlight or App
# Store). Doing codesign here would just be replaced by Xcode anyway.

echo
echo "✓ libskal.dylib (iOS device, unsigned) produced (stripped + unstripped):"
ls -la "${OUT}" "${UNSTRIPPED}"
file "${OUT}"
echo
echo "LC_BUILD_VERSION (must be IPHONEOS):"
xcrun vtool -show "${OUT}" | grep -A 5 "LC_BUILD_VERSION" || true
echo
echo "C ABI symbols (must all be present):"
"${LLVM_BIN}/llvm-nm" -gU "${OUT}" 2>/dev/null | grep -E "^[0-9a-f]+ T _skal_" || echo "(none — link probably failed)"
echo
echo "JNI symbols (must NOT be present per § 0.5/V3):"
"${LLVM_BIN}/llvm-nm" -gU "${OUT}" 2>/dev/null | grep -E "JNI_OnLoad|Java_com_skal" && echo "  ✗ JNI symbols leaked into iOS device binary" || echo "  ✓ none"
echo
echo "Next: Xcode's Embed Frameworks phase will sign this dylib"
echo "with the Skal app's signing identity. For free-Apple-ID sideload"
echo "use a personal team in ios-app/iosApp/project.yml's DEVELOPMENT_TEAM."
