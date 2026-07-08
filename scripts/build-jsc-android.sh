#!/usr/bin/env bash
# Cross-build JavaScriptCore for Android NDK (arm64-v8a) using Skal's WebKit fork (skal-multiplatform/WebKit @ skal).
#
# Requires: ICU built first via scripts/build-icu-android.sh
#
# Adapted from /Users/andrepimenta/Documents/coding/explore/bun/vendor/WebKit/Dockerfile.android
# but uses NDK's bundled clang directly (the Docker uses host clang + NDK
# runtime symlinks to keep the LLVM version matching bun's main build).
# We don't need that constraint.
#
# Outputs: build/jsc-android/install/{lib/libJavaScriptCore.a, libWTF.a, libbmalloc.a, include/JavaScriptCore/, include/wtf/, include/bmalloc/, include/unicode/}

set -euo pipefail

NDK="${ANDROID_NDK_ROOT:-/opt/homebrew/share/android-ndk}"
API="${ANDROID_API:-28}"
ARCH="${ANDROID_ARCH:-aarch64}"
BUILD_TYPE="${BUILD_TYPE:-Release}"
JOBS="${JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || nproc)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEBKIT_SRC="${WEBKIT_SRC:-${ROOT}/vendor/WebKit}"
ICU_INSTALL="${ICU_INSTALL:-${ROOT}/build/icu-android/install}"
BUILD="${ROOT}/build/jsc-android"
WK_BUILD="${BUILD}/build"
INSTALL="${BUILD}/install"

case "$(uname -s)" in
  Darwin) HOST_TAG=darwin-x86_64 ;;
  Linux)  HOST_TAG=linux-x86_64 ;;
  *) echo "error: unsupported host: $(uname -s)" >&2; exit 1 ;;
esac

if [[ ! -d "$WEBKIT_SRC" ]]; then
  echo "error: WebKit source not found at $WEBKIT_SRC" >&2
  echo "       run: git clone --branch skal --depth 1 https://github.com/skal-multiplatform/WebKit.git vendor/WebKit" >&2
  exit 1
fi

if [[ ! -f "$ICU_INSTALL/lib/libicuuc.a" ]]; then
  echo "error: cross-built ICU not found at $ICU_INSTALL" >&2
  echo "       run: scripts/build-icu-android.sh" >&2
  exit 1
fi

NDK_BIN="${NDK}/toolchains/llvm/prebuilt/${HOST_TAG}/bin"
TARGET_TRIPLE="${ARCH}-linux-android${API}"
SYSROOT="${NDK}/toolchains/llvm/prebuilt/${HOST_TAG}/sysroot"

CC="${NDK_BIN}/${TARGET_TRIPLE}-clang"
CXX="${NDK_BIN}/${TARGET_TRIPLE}-clang++"
AR="${NDK_BIN}/llvm-ar"
RANLIB="${NDK_BIN}/llvm-ranlib"

if [[ ! -x "$CC" ]]; then
  echo "error: clang wrapper not found: $CC" >&2
  exit 1
fi

# Match Dockerfile.android flags. NOT setting CMAKE_SYSTEM_NAME=Android —
# that module would auto-pick the NDK's own clang binding through CMake's
# Android.cmake module which then *overrides* CMAKE_<LANG>_COMPILER. We've
# already pointed at the NDK clang explicitly.
DEFAULT_CFLAGS="-mno-omit-leaf-frame-pointer -g -fno-omit-frame-pointer \
-ffunction-sections -fdata-sections -faddrsig \
-fno-unwind-tables -fno-asynchronous-unwind-tables \
-DU_STATIC_IMPLEMENTATION=1"
MARCH_FLAG="-march=armv8-a+crc -mtune=cortex-a78"

# -fPIC: required so the static .a files can be linked into our libskal.so
# shared library. (bun links into a static executable, so its build recipe
# omits this — we need it.)
CFLAGS_COMMON="${DEFAULT_CFLAGS} ${MARCH_FLAG} -fPIC -isystem ${ICU_INSTALL}/include"

mkdir -p "$WK_BUILD" "$INSTALL/lib" "$INSTALL/include/JavaScriptCore"

if [[ ! -f "$WK_BUILD/build.ninja" ]]; then
  echo ">>> configuring WebKit/JSC for $TARGET_TRIPLE (BUILD_TYPE=$BUILD_TYPE)"
  cd "$WK_BUILD"

  cmake \
    -DCMAKE_SYSTEM_NAME=Linux \
    -DCMAKE_SYSTEM_PROCESSOR="${ARCH}" \
    -DCMAKE_SYSROOT="${SYSROOT}" \
    -DANDROID=ON \
    -DCMAKE_C_COMPILER="$CC" \
    -DCMAKE_CXX_COMPILER="$CXX" \
    -DCMAKE_AR="$AR" \
    -DCMAKE_RANLIB="$RANLIB" \
    -DPORT=JSCOnly \
    -DENABLE_STATIC_JSC=ON \
    -DENABLE_BUN_SKIP_FAILING_ASSERTIONS=ON \
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DUSE_THIN_ARCHIVES=OFF \
    -DUSE_BUN_JSC_ADDITIONS=ON \
    -DUSE_BUN_EVENT_LOOP=ON \
    -DENABLE_FTL_JIT=ON \
    -DENABLE_API_TESTS=OFF \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON \
    -DALLOW_LINE_AND_COLUMN_NUMBER_IN_BUILTINS=ON \
    -DENABLE_REMOTE_INSPECTOR=ON \
    -DCMAKE_C_FLAGS="$CFLAGS_COMMON" \
    -DCMAKE_CXX_FLAGS="$CFLAGS_COMMON -fno-c++-static-destructors" \
    -DCMAKE_EXE_LINKER_FLAGS="-fuse-ld=lld" \
    -DICU_ROOT="$ICU_INSTALL" \
    -DICU_INCLUDE_DIR="$ICU_INSTALL/include" \
    -DCMAKE_FIND_ROOT_PATH_MODE_PACKAGE=BOTH \
    -DCMAKE_FIND_ROOT_PATH_MODE_LIBRARY=BOTH \
    -DCMAKE_FIND_ROOT_PATH_MODE_INCLUDE=BOTH \
    -G Ninja \
    "$WEBKIT_SRC"
fi

echo ">>> building target: jsc"
cmake --build "$WK_BUILD" --config "$BUILD_TYPE" --target jsc -- -j"$JOBS"

echo ">>> staging into $INSTALL"
cp "$WK_BUILD"/lib/libJavaScriptCore.a "$INSTALL/lib/"
cp "$WK_BUILD"/lib/libWTF.a "$INSTALL/lib/"
[[ -f "$WK_BUILD/lib/libbmalloc.a" ]] && cp "$WK_BUILD/lib/libbmalloc.a" "$INSTALL/lib/" || true

# JavaScriptCore public C API headers (the only ones we use from Zig).
find "$WK_BUILD/JavaScriptCore/Headers/JavaScriptCore" -name '*.h' \
  -exec cp {} "$INSTALL/include/JavaScriptCore/" \; 2>/dev/null || true
find "$WK_BUILD/JavaScriptCore/PrivateHeaders/JavaScriptCore" -name '*.h' \
  -exec cp {} "$INSTALL/include/JavaScriptCore/" \; 2>/dev/null || true
find "$WK_BUILD/JavaScriptCore/DerivedSources" -name '*.h' \
  -exec cp {} "$INSTALL/include/JavaScriptCore/" \; 2>/dev/null || true

# WTF + bmalloc headers (not strictly needed for C API but harmless).
[[ -d "$WK_BUILD/WTF/Headers/wtf" ]] && cp -r "$WK_BUILD/WTF/Headers/wtf" "$INSTALL/include/" || true
[[ -d "$WK_BUILD/bmalloc/Headers/bmalloc" ]] && cp -r "$WK_BUILD/bmalloc/Headers/bmalloc" "$INSTALL/include/" || true

# Bundled ICU headers + libs so the install dir is self-contained for
# Skal's `-Djsc-dir=` consumer.
mkdir -p "$INSTALL/include/unicode"
cp "$ICU_INSTALL/include/unicode/"*.h "$INSTALL/include/unicode/" 2>/dev/null || true
cp "$ICU_INSTALL/lib/"libicu*.a "$INSTALL/lib/" 2>/dev/null || true

echo
echo "JSC built and installed to: $INSTALL"
ls "$INSTALL/lib/" | sort
