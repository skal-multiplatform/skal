#!/usr/bin/env bash
# Link bun's iOS-cross-compiled Zig + C++ objects against the iOS-built
# JSC as a static framework binary embeddable in a real iOS device app.
#
# This is the device path. The Simulator path lives in
# scripts/link-skal-iossim.sh and uses the vtool re-stamp shortcut.
# This script does a real iOS cross-link — no shortcuts.
#
# Status: SKELETON. The Zig portion exists
# (vendor/bun/zig-out/bun-zig.o, built via patches/0004-bun-ios-target-
# plumbing.patch). The C++ portion + JSC + deps don't exist yet — see
# IOS_DEVICE_TODO.md § B-D.
#
# Prerequisites once Phase 2-Device lands:
#   1. JSC iOS built: build/skal-jsc-ios/lib/libJavaScriptCore.a
#      (via scripts/build-jsc-ios.sh).
#   2. Bun C++ side cross-compiled for iOS: build/bun-ios-release/*.o
#      (not yet wired — need to patch scripts/build/ in vendor/bun to
#      add an ios-release profile that drives the C++ side too).
#   3. Bun Zig portion built: vendor/bun/zig-out/bun-zig.o (works today
#      with the iOS plumbing patch).
#   4. iOS-built deps: mimalloc, BoringSSL, libuv, brotli, libdeflate,
#      picohttpparser, zlib-ng, zstd, lsquic, lshpack, lsqpack, c-ares,
#      libarchive, hdrhistogram, highway, libjpeg-turbo, libspng,
#      libwebp, lolhtml. Each currently builds for darwin/linux/windows
#      — adding ios is mechanical per-dep work (point at iPhoneOS.sdk +
#      iOS triple).
set -euo pipefail

SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
BUN_ZIG_OBJ="${SKAL_ROOT}/vendor/bun/zig-out/bun-zig.o"
JSC_LIB="${SKAL_ROOT}/build/skal-jsc-ios/lib/libJavaScriptCore.a"

# Toolchain — see link-skal-dylib.sh's brew/xcrun rationale.
if ! command -v brew >/dev/null 2>&1; then
  echo "error: brew not found in PATH" >&2
  exit 1
fi
LLVM_PREFIX="${LLVM_PREFIX:-$(brew --prefix llvm@21)}"
LLVM_BIN="${LLVM_PREFIX}/bin"
CXX="${LLVM_BIN}/clang++"

# ── Prerequisite checks ────────────────────────────────────────────────

if [[ ! -f "${BUN_ZIG_OBJ}" ]]; then
  echo "error: bun-zig.o for iOS not built." >&2
  echo "       run from vendor/bun (after applying patches/0004-...patch):" >&2
  echo "         ./vendor/zig/zig build obj \\" >&2
  echo "             -Dcodegen_path=build/release/codegen \\" >&2
  echo "             -Dtarget=aarch64-ios.14.0" >&2
  exit 1
fi
if [[ ! -f "${JSC_LIB}" ]]; then
  echo "error: libJavaScriptCore.a for iOS not built." >&2
  echo "       run scripts/build-jsc-ios.sh first." >&2
  exit 1
fi

echo "WARNING: this script is incomplete (Phase 2-Device skeleton)." >&2
echo "  Missing: cross-compiled bun C++ objects + deps (see header)." >&2
echo "  See IOS_DEVICE_TODO.md § B + C." >&2
exit 1

# ── (Future) the actual link, once all inputs are ready ────────────────
#
# Skeleton — fill in once C++ side cross-compiles cleanly. Differs from
# link-skal-iossim.sh in three ways:
#
#   1. No vtool re-stamp. Objects already have LC_BUILD_VERSION=IPHONEOS.
#   2. No __clear_cache shim. iOS device's libSystem exports it
#      directly, unlike iOS Simulator.
#   3. iOS-specific framework linking: -framework Foundation
#      -framework CoreFoundation -framework UIKit (or whichever subset
#      bun's C++ side actually uses).
#
# Skeleton ldflags (TODO: verify against bun's actual symbol references):
#
#   LDFLAGS=(
#     -dynamiclib
#     -Wl,-ld_new
#     -target arm64-apple-ios14.0
#     -isysroot "${SDK}"
#     -dead_strip
#     -Wl,-install_name,@rpath/libskal.dylib
#     -Wl,-exported_symbols_list,"${SKAL_SYMS}"
#     # iOS frameworks bun's C++ references via WebCore / WTF:
#     -framework Foundation
#     -framework CoreFoundation
#     -framework CoreGraphics
#     -framework CoreText
#     # libicucore lives at /usr/lib on iOS too — same path as macOS.
#     -licucore
#     -lresolv
#   )
#
# Output: build/skal-ios-device/libskal.dylib (real iOS binary).
