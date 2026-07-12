#!/usr/bin/env bash
# skal-link.sh — install libskal binaries into an app's platform configs.
#
# Usage:
#   scripts/skal-link.sh <app-name>            # all host-buildable platforms
#   scripts/skal-link.sh <app-name> macos      # just macOS
#   scripts/skal-link.sh <app-name> android    # just Android arm64
#   scripts/skal-link.sh <app-name> ios        # just iOS device + simulator
#
# Thin orchestrator around the platform-specific link-libskal-flutter-*.sh
# scripts. Reads each existing platform dir under examples/<app>/flutter-host/
# and writes the matching libskal binary into it. Skips platforms whose
# dirs don't exist (run `flutter create --platforms ...` first to add them).
#
# Prereqs:
#   - vendor/bun/build/release/ (for host: macOS, iOS sim)        — bun run build:libskal
#   - vendor/bun/build/android/ (for Android arm64)               — bun run build:libskal:android
#   - For iOS device: WebKit JSC built; see scripts/build-jsc-ios.sh
#     + scripts/link-skal-ios.sh

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <app-name> [macos|ios|android]" >&2
  exit 1
fi

APP_NAME="$1"
PLATFORM="${2:-all}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Standalone apps (scaffolded by `skal create` outside the repo) override
# the app location; in-repo apps keep the examples/<name>/ convention.
APP_ROOT="${SKAL_APP_ROOT:-${REPO_ROOT}/examples/${APP_NAME}/flutter-host}"

if [[ ! -d "${APP_ROOT}" ]]; then
  echo "error: ${APP_ROOT} not found — did you run 'bun run new ${APP_NAME}'?" >&2
  exit 1
fi

did_anything=0

# ── macOS Desktop ────────────────────────────────────────────────────
if [[ "${PLATFORM}" == "all" || "${PLATFORM}" == "macos" ]]; then
  if [[ -d "${APP_ROOT}/macos" ]]; then
    echo "→ linking libskal.dylib for macOS into ${APP_ROOT}/macos/Frameworks/"
    SKAL_FLUTTER_FRAMEWORKS="${APP_ROOT}/macos/Frameworks" \
      "${SCRIPT_DIR}/link-libskal-flutter-mac.sh"
    # `flutter create` projects don't embed libskal into the .app — without
    # this the runtime dlopen fails and the app black-screens. Inject the copy
    # build phase into the Xcode project (idempotent).
    PBXPROJ="${APP_ROOT}/macos/Runner.xcodeproj/project.pbxproj"
    if [[ -f "${PBXPROJ}" ]]; then
      echo "→ ensuring libskal embed build phase in Runner.xcodeproj"
      python3 "${SCRIPT_DIR}/embed-libskal-macos.py" "${PBXPROJ}"
    fi
    did_anything=1
  elif [[ "${PLATFORM}" == "macos" ]]; then
    echo "error: ${APP_ROOT}/macos missing — run 'flutter create --platforms macos .' first" >&2
    exit 1
  fi
fi

# ── Android arm64 ────────────────────────────────────────────────────
if [[ "${PLATFORM}" == "all" || "${PLATFORM}" == "android" ]]; then
  if [[ -d "${APP_ROOT}/android" ]]; then
    JNI_DIR="${APP_ROOT}/android/app/src/main/jniLibs/arm64-v8a"
    echo "→ linking libskal.so for Android arm64 into ${JNI_DIR}/"
    mkdir -p "${JNI_DIR}"
    SKAL_FLUTTER_NATIVE_LIBS="${JNI_DIR}" \
      "${SCRIPT_DIR}/link-libskal-flutter.sh"
    did_anything=1
  elif [[ "${PLATFORM}" == "android" ]]; then
    echo "error: ${APP_ROOT}/android missing — run 'flutter create --platforms android .' first" >&2
    exit 1
  fi
fi

# ── iOS (device + simulator) ─────────────────────────────────────────
#
# The underlying iOS link scripts (link-skal-ios.sh / link-skal-iossim.sh)
# write to build/skal-ios-device/ and build/skal-iossim/ respectively;
# they don't copy into the app's Frameworks/. We do that step here.
# Pre-built variants from another app (e.g. kitchen-sink) are also
# acceptable inputs since libskal is app-agnostic.
if [[ "${PLATFORM}" == "all" || "${PLATFORM}" == "ios" ]]; then
  if [[ -d "${APP_ROOT}/ios" ]]; then
    DEV_LIB="${REPO_ROOT}/build/skal-ios-device/libskal.dylib"
    SIM_LIB="${REPO_ROOT}/build/skal-iossim/libskal.dylib"

    # iOS *device* has no prebuilt binary (it needs a from-source WebKit
    # JSC build, and shipping to a physical iPhone needs your own signing
    # identity anyway). Only attempt the device link when a source build
    # is actually present; otherwise skip cleanly — the simulator binary
    # below is enough to run the app on the iOS Simulator.
    if [[ ! -f "${DEV_LIB}" ]]; then
      if [[ -f "${REPO_ROOT}/vendor/bun/build/ios-release/build.ninja" ]]; then
        echo "→ linking libskal.dylib for iOS device"
        "${SCRIPT_DIR}/link-skal-ios.sh" || {
          echo "warning: link-skal-ios.sh failed (need build-jsc-ios.sh output?)" >&2
        }
      else
        echo "→ skipping iOS device (no source build; simulator only)."
        echo "  For a physical iPhone: build from source (drop SKAL_PREBUILT) + sign in Xcode."
      fi
    fi
    if [[ ! -f "${SIM_LIB}" ]]; then
      echo "→ linking libskal.dylib for iOS Simulator"
      "${SCRIPT_DIR}/link-skal-iossim.sh"
    fi

    if [[ -f "${DEV_LIB}" ]]; then
      echo "→ copying libskal.dylib (iOS device) into ${APP_ROOT}/ios/Frameworks/iphoneos/"
      mkdir -p "${APP_ROOT}/ios/Frameworks/iphoneos"
      cp "${DEV_LIB}" "${APP_ROOT}/ios/Frameworks/iphoneos/libskal.dylib"
      did_anything=1
    fi
    if [[ -f "${SIM_LIB}" ]]; then
      echo "→ copying libskal.dylib (iOS Simulator) into ${APP_ROOT}/ios/Frameworks/iphonesimulator/"
      mkdir -p "${APP_ROOT}/ios/Frameworks/iphonesimulator"
      cp "${SIM_LIB}" "${APP_ROOT}/ios/Frameworks/iphonesimulator/libskal.dylib"
      did_anything=1
    fi

    # `flutter create` projects don't embed libskal into the .app — same
    # story as macOS above. Inject the copy build phase (idempotent); it
    # resolves device vs simulator via $(PLATFORM_NAME) at build time.
    PBXPROJ_IOS="${APP_ROOT}/ios/Runner.xcodeproj/project.pbxproj"
    if [[ -f "${PBXPROJ_IOS}" ]]; then
      echo "→ ensuring libskal embed build phase in ios/Runner.xcodeproj"
      python3 "${SCRIPT_DIR}/embed-libskal-macos.py" "${PBXPROJ_IOS}" \
        "${SCRIPT_DIR}/embed-libskal-ios.phase.pbxproj"
    fi
  elif [[ "${PLATFORM}" == "ios" ]]; then
    echo "error: ${APP_ROOT}/ios missing — run 'flutter create --platforms ios .' first" >&2
    exit 1
  fi
fi

if [[ ${did_anything} -eq 0 ]]; then
  echo "error: no platform dirs found under ${APP_ROOT}" >&2
  echo "       run 'flutter create --platforms macos,ios,android .' inside flutter-host/ first" >&2
  exit 1
fi

echo
echo "✓ libskal binaries installed into ${APP_ROOT}/"
