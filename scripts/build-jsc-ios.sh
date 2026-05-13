#!/usr/bin/env bash
# Build JavaScriptCore (the JS engine bun embeds) for iOS arm64.
#
# Output: a static libJavaScriptCore.a + headers, ready to be linked into
# libskal.dylib for the iOS device path. The macOS Simulator path uses
# the existing vtool re-stamp shortcut in scripts/link-skal-iossim.sh;
# this script is the foundation for real iOS device builds.
#
# CRITICAL: JIT is disabled at RUNTIME on iOS via JSC config flags
# (g_jscConfig.useJIT / useDFGJIT / useFTLJIT — set false on iOS
# startup, mirroring how bun's Android build handles the same
# constraint). At COMPILE time the JIT code paths are still built —
# matching bun's Android prebuilt — because WebKit's DOMJIT uses
# DFG types regardless of JIT enablement, and disabling DFG_JIT at
# compile time breaks unrelated DOMJIT headers. The JIT code never
# executes on iOS at runtime (Apple disallows W^X in third-party
# apps), so the embedded-but-unused code costs only static size.
#
# Prerequisites:
#   1. WebKit cloned at vendor/bun/vendor/WebKit (run from vendor/bun:
#      `git clone https://github.com/oven-sh/WebKit.git vendor/WebKit
#       && cd vendor/WebKit
#       && git checkout 88b2f7a2159c913f7dd0d73c0e88d66138cd67ba`).
#   2. cmake 3.20+ (`brew install cmake`).
#   3. ninja (`brew install ninja`).
#   4. Xcode (full install, not just CommandLineTools — needed for
#      iPhoneOS SDK).
#
# Estimated build time on M1: 1-2 hours (clean), ~10 min (incremental).
# Build dir: build/skal-jsc-ios/, output: build/skal-jsc-ios/lib/libJavaScriptCore.a
set -euo pipefail

SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# WebKit source — Skal pins to the same commit bun does
# (88b2f7a2159c913f7dd0d73c0e88d66138cd67ba). Lives at
# vendor/WebKit/ in the Skal tree (gitignored — 8 GB). Single checkout
# is shared by the macOS/Android prebuilt fetches AND by this iOS-from-
# source build.
WEBKIT_SRC="${SKAL_ROOT}/vendor/WebKit"
BUILD_DIR="${SKAL_ROOT}/build/skal-jsc-ios"
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"

if [[ ! -d "${WEBKIT_SRC}/Source/JavaScriptCore" ]]; then
  echo "error: WebKit source not at ${WEBKIT_SRC}" >&2
  echo "       expected vendor/WebKit/Source/JavaScriptCore/ to exist." >&2
  echo "       clone if missing:" >&2
  echo "         git clone https://github.com/oven-sh/WebKit.git vendor/WebKit \\" >&2
  echo "           && cd vendor/WebKit \\" >&2
  echo "           && git checkout 88b2f7a2159c913f7dd0d73c0e88d66138cd67ba" >&2
  exit 1
fi

mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

# ── CMake configure ────────────────────────────────────────────────────
#
# Each flag is load-bearing; comments explain why. If a future WebKit
# version breaks one of these, follow the comment trail rather than
# silently dropping the flag.
#
# Cross-compile invariants:
#   CMAKE_SYSTEM_NAME=Darwin: WebKit's cmake treats iOS like macOS at
#     this level (Apple is one OS family for the build system). The
#     actual iOS-vs-macOS gating happens via CMAKE_OSX_SYSROOT below.
#   CMAKE_CROSSCOMPILING=YES: required to skip try_run checks (which
#     compile-and-execute a test binary; on cross builds it'd try to
#     run an iOS binary on the macOS host and fail).
#
# JIT disables — see file header.
#
# Bun-specific flags mirror what bun's local-mode build of WebKit
# enables (see vendor/bun/scripts/build/deps/webkit.ts):
#   USE_BUN_JSC_ADDITIONS: enables bun's JSC extensions (extra GC hooks,
#     fast-path bindings — required for bun's JSC consumer code to link).
#   USE_BUN_EVENT_LOOP: same — bun's event loop integrates with JSC's
#     drainMicrotasks at specific hook points.
#   ENABLE_BUN_SKIP_FAILING_ASSERTIONS / ALLOW_LINE_AND_COLUMN_NUMBER_IN_BUILTINS:
#     small bun-specific behavior tweaks; baked in by bun's WebKit fork.

cmake -G Ninja "${WEBKIT_SRC}" \
  -DPORT=JSCOnly \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SYSTEM_NAME=Darwin \
  -DCMAKE_SYSTEM_PROCESSOR=arm64 \
  -DCMAKE_CROSSCOMPILING=YES \
  -DCMAKE_OSX_SYSROOT="${SDK}" \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=14.0 \
  -DENABLE_STATIC_JSC=ON \
  -DUSE_THIN_ARCHIVES=OFF \
  -DENABLE_FTL_JIT=ON \
  -DENABLE_WEBASSEMBLY=ON \
  -DENABLE_API_TESTS=OFF \
  -DENABLE_REMOTE_INSPECTOR=ON \
  -DENABLE_MEDIA_SOURCE=OFF \
  -DENABLE_MEDIA_STREAM=OFF \
  -DENABLE_WEB_RTC=OFF \
  -DUSE_BUN_JSC_ADDITIONS=ON \
  -DUSE_BUN_EVENT_LOOP=ON \
  -DENABLE_BUN_SKIP_FAILING_ASSERTIONS=ON \
  -DALLOW_LINE_AND_COLUMN_NUMBER_IN_BUILTINS=ON \
  -DUSE_SYSTEM_MALLOC=ON \
  -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
  -DCMAKE_C_COMPILER="$(xcrun --sdk iphoneos -f clang)" \
  -DCMAKE_CXX_COMPILER="$(xcrun --sdk iphoneos -f clang++)" \
  -DCMAKE_ASM_COMPILER="$(xcrun --sdk iphoneos -f clang)" \
  -DCMAKE_FIND_ROOT_PATH="${SDK}" \
  -DCMAKE_FIND_ROOT_PATH_MODE_PROGRAM=NEVER \
  -DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=ONLY \
  -DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=ONLY \
  -DCMAKE_FIND_ROOT_PATH_MODE_PACKAGE=ONLY

# ── Build (target: jsc — produces libJavaScriptCore.a + lib*.a deps) ───
#
# Parallelism: -j$(sysctl -n hw.ncpu) — WebKit's build scales linearly
# up to ~10 cores then plateaus. M1 Max with 10 perf cores → ~60 min;
# Mac Pro (Mn) → 30-40 min.
ninja -j"$(sysctl -n hw.ncpu)" jsc

# ── Summary ────────────────────────────────────────────────────────────
echo
echo "✓ JSC for iOS built:"
ls -la "${BUILD_DIR}/lib/libJavaScriptCore.a" 2>/dev/null || ls -la "${BUILD_DIR}/JavaScriptCore" 2>/dev/null
echo
echo "Next: wire into scripts/link-skal-ios.sh (TODO)"
