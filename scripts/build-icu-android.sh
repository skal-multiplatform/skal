#!/usr/bin/env bash
# Cross-build ICU 75.1 for Android NDK (arm64-v8a).
#
# ICU's autoconf build needs to run generated tools (gennorm2, etc.) at build
# time, which means a host build is required first; the target build points
# at it via --with-cross-build.
#
# Adapted from /Users/andrepimenta/Documents/coding/explore/bun/vendor/WebKit/Dockerfile.android
# but uses NDK's bundled clang instead of host clang + NDK-runtime symlinks.
#
# Outputs: build/icu-android/install/{lib/libicu*.a, include/unicode/}

set -euo pipefail

NDK="${ANDROID_NDK_ROOT:-/opt/homebrew/share/android-ndk}"
API="${ANDROID_API:-28}"
ARCH="${ANDROID_ARCH:-aarch64}"
ICU_VERSION="${ICU_VERSION:-75_1}"
ICU_RELEASE_TAG="${ICU_RELEASE_TAG:-release-75-1}"
ICU_SHA256="cb968df3e4d2e87e8b11c49a5d01c787bd13b9545280fc6642f826527618caef"
JOBS="${JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || nproc)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${ROOT}/build/icu-android"
HOST="${BUILD}/host"
TARGET="${BUILD}/target"
INSTALL="${BUILD}/install"
TARBALL="${BUILD}/icu4c-${ICU_VERSION}-src.tgz"

case "$(uname -s)" in
  Darwin) HOST_TAG=darwin-x86_64 ;;
  Linux)  HOST_TAG=linux-x86_64 ;;
  *) echo "error: unsupported host: $(uname -s)" >&2; exit 1 ;;
esac

if [[ ! -d "$NDK" ]]; then
  echo "error: NDK not found at $NDK. Set ANDROID_NDK_ROOT." >&2
  exit 1
fi

NDK_BIN="${NDK}/toolchains/llvm/prebuilt/${HOST_TAG}/bin"
TARGET_TRIPLE="${ARCH}-linux-android${API}"
SYSROOT="${NDK}/toolchains/llvm/prebuilt/${HOST_TAG}/sysroot"

mkdir -p "$BUILD" "$HOST" "$TARGET" "$INSTALL/lib" "$INSTALL/include"

# ── 1. Download ICU source ────────────────────────────────────────────────
if [[ ! -f "$TARBALL" ]]; then
  echo ">>> downloading ICU $ICU_RELEASE_TAG"
  curl -fL -o "$TARBALL" \
    "https://github.com/unicode-org/icu/releases/download/${ICU_RELEASE_TAG}/icu4c-${ICU_VERSION}-src.tgz"
fi

# Verify checksum (BSD shasum on macOS, sha256sum on Linux)
if command -v sha256sum >/dev/null 2>&1; then
  echo "${ICU_SHA256}  ${TARBALL}" | sha256sum -c - >/dev/null
else
  echo "${ICU_SHA256}  ${TARBALL}" | shasum -a 256 -c - >/dev/null
fi

# ── 2. Host build (tools only) ────────────────────────────────────────────
if [[ ! -x "$HOST/source/bin/icupkg" ]]; then
  echo ">>> building ICU host tools"
  rm -rf "$HOST"
  mkdir -p "$HOST"
  tar -xf "$TARBALL" -C "$HOST" --strip-components=1
  (
    cd "$HOST/source"
    CFLAGS="-Os" CXXFLAGS="-Os" \
      ./configure --disable-shared --enable-static --disable-samples --disable-tests
    make -j"$JOBS"
  )
fi

# ── 3. Target cross-build ─────────────────────────────────────────────────
if [[ ! -f "$INSTALL/lib/libicuuc.a" ]]; then
  echo ">>> cross-building ICU for $TARGET_TRIPLE"
  rm -rf "$TARGET"
  mkdir -p "$TARGET"
  tar -xf "$TARBALL" -C "$TARGET" --strip-components=1

  # ICU's data filter — drop converters/translit/rbnf/stringprep that
  # JS engines don't need. Cuts libicudata.a by ~7MB.
  (
    cd "$TARGET/source"
    "$HOST/source/bin/icupkg" -l data/in/icudt75l.dat \
      | grep -E '\.(cnv|spp|cfu)$|^cnvalias\.icu$|^translit/|^rbnf/|^unames\.icu$' \
      > data/in/rm.lst || true
    if [[ -s data/in/rm.lst ]]; then
      "$HOST/source/bin/icupkg" --auto_toc_prefix -r data/in/rm.lst \
        data/in/icudt75l.dat data/in/icudt75l_filtered.dat
      mv -f data/in/icudt75l_filtered.dat data/in/icudt75l.dat
    fi
  )

  # NDK's per-API clang wrapper bakes in --target=<triple>--api etc.
  CC="${NDK_BIN}/${TARGET_TRIPLE}-clang"
  CXX="${NDK_BIN}/${TARGET_TRIPLE}-clang++"
  AR="${NDK_BIN}/llvm-ar"
  RANLIB="${NDK_BIN}/llvm-ranlib"

  # -fPIC: required so the .a archives can be linked into a shared library.
  # ICU's autoconf doesn't enable PIC by default for aarch64-android targets.
  COMMON_CFLAGS="-march=armv8-a+crc -mtune=cortex-a78 -Os \
    -mno-omit-leaf-frame-pointer -g -fno-omit-frame-pointer \
    -ffunction-sections -fdata-sections -faddrsig -fPIC \
    -fno-unwind-tables -fno-asynchronous-unwind-tables \
    -DU_STATIC_IMPLEMENTATION=1"

  (
    cd "$TARGET/source"
    CC="$CC" CXX="$CXX" AR="$AR" RANLIB="$RANLIB" \
    CFLAGS="$COMMON_CFLAGS -std=c17" \
    CXXFLAGS="$COMMON_CFLAGS -std=c++20 -fno-exceptions -fno-c++-static-destructors" \
    LDFLAGS="-fuse-ld=lld" \
    ./configure \
        --host="${ARCH}-linux-android" \
        --with-cross-build="$HOST/source" \
        --enable-static --disable-shared \
        --with-data-packaging=static \
        --disable-samples --disable-tests --disable-debug \
        --prefix="$INSTALL" \
      || { cat config.log; exit 1; }
    make -j"$JOBS"
  )

  cp "$TARGET/source"/lib/libicu*.a "$INSTALL/lib/"
  mkdir -p "$INSTALL/include/unicode"
  cp -r "$TARGET/source/i18n/unicode/"*.h "$INSTALL/include/unicode/"
  cp -r "$TARGET/source/common/unicode/"*.h "$INSTALL/include/unicode/"
fi

echo
echo "ICU built and installed to: $INSTALL"
ls "$INSTALL/lib/" | grep '^lib' | sort
