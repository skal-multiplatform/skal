#!/usr/bin/env bash
# Build libskal.so for the standard Android NDK ABIs.
#
# Prerequisites:
#   - Zig 0.14.0+ on PATH        (https://ziglang.org/download/)
#   - $ANDROID_NDK_ROOT pointing at an NDK r26+ install
#   - For -Dengine=jsc: a JavaScriptCore tree built against the same
#     ABI/API level, with libJavaScriptCore.a + libWTF.a + libicu*.a
#     under <jsc-dir>/lib and headers under <jsc-dir>/include.
#     Set SKAL_JSC_DIR_<ABI> per ABI, e.g.:
#       export SKAL_JSC_DIR_ARM64=/path/to/jsc/arm64-v8a
#
# Usage: scripts/build-android.sh [api-level] [engine]
#   api-level defaults to 24, engine defaults to "null".
#   Pass "jsc" to link against JavaScriptCore.

set -euo pipefail

API_LEVEL="${1:-24}"
ENGINE="${2:-null}"

if [[ -z "${ANDROID_NDK_ROOT:-}" ]]; then
  echo "error: ANDROID_NDK_ROOT is not set" >&2
  exit 1
fi

case "$(uname -s)" in
  Darwin) HOST_TAG=darwin-x86_64 ;;
  Linux)  HOST_TAG=linux-x86_64 ;;
  *) echo "error: unsupported host: $(uname -s)" >&2; exit 1 ;;
esac

SYSROOT="${ANDROID_NDK_ROOT}/toolchains/llvm/prebuilt/${HOST_TAG}/sysroot"
if [[ ! -d "$SYSROOT" ]]; then
  echo "error: NDK sysroot not found: $SYSROOT" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/zig-out"

build_abi() {
  local arch_zig="$1"
  local arch_android="$2"
  local ndk_triple="$3"
  local jsc_env_name="SKAL_JSC_DIR_$(echo "$arch_android" | tr 'a-z-' 'A-Z_')"
  local jsc_dir="${!jsc_env_name:-}"

  echo ">>> building libskal.so for ${arch_android} (api=${API_LEVEL}, engine=${ENGINE})"

  local extra=()
  if [[ "$ENGINE" == "jsc" ]]; then
    if [[ -z "$jsc_dir" ]]; then
      echo "error: ${jsc_env_name} not set" >&2
      exit 1
    fi
    extra+=("-Djsc-dir=${jsc_dir}")
  fi

  zig build \
    -Dos=android \
    -Darch="${arch_zig}" \
    -Dndk-sysroot="${SYSROOT}" \
    -Dandroid-api="${API_LEVEL}" \
    -Dengine="${ENGINE}" \
    -Dlib=true \
    -Dcli=false \
    -Doptimize=ReleaseSafe \
    "${extra[@]}"

  mkdir -p "${OUT}/jniLibs/${arch_android}"
  cp "${OUT}/lib/libskal.so" "${OUT}/jniLibs/${arch_android}/libskal.so"

  # JSC is C++; we link against libc++ which on Android is libc++_shared.so.
  # Apps need this .so packaged alongside libskal.so. The non-versioned
  # path is the canonical NDK location for the shared variant.
  if [[ "$ENGINE" == "jsc" ]]; then
    local libcpp="${SYSROOT}/usr/lib/${ndk_triple}/libc++_shared.so"
    if [[ -f "$libcpp" ]]; then
      cp "$libcpp" "${OUT}/jniLibs/${arch_android}/libc++_shared.so"
    fi
  fi
}

build_abi aarch64 arm64-v8a   aarch64-linux-android
build_abi armv7   armeabi-v7a arm-linux-androideabi
build_abi x86_64  x86_64      x86_64-linux-android

echo
echo "wrote:"
find "${OUT}/jniLibs" -name 'libskal.so' -print
