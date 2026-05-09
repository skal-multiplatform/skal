#!/usr/bin/env bash
# Build the Skal Bench Android app end-to-end:
#   1. Build the JS app (vite + bun build --bytecode) → assets/skal-app.{js,cjs,cjs.jsc}
#   2. Re-link libskal.so (assumes bun's Android build is already done)
#   3. Strip + copy libskal.so + libc++_shared.so into the app's jniLibs/
#   4. Run Gradle assembleRelease
#
# Prereqs (run scripts/build-icu-android.sh + scripts/build-jsc-android.sh
# + bun scripts/build.ts --profile=android-release first if you haven't):
#   - JDK 17 at /opt/homebrew/opt/openjdk@17 (brew install openjdk@17)
#   - Android SDK at $HOME/Library/Android/sdk
#   - Android NDK at $ANDROID_NDK_ROOT
#   - skal-bench-release.keystore in android-app/ (auto-generated on first run)
#   - bun in PATH, ideally matching patches/bun-base-commit.txt (see check below)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/android-app"
JS_APP="${ROOT}/js-app"
NDK="${ANDROID_NDK_ROOT:-/opt/homebrew/share/android-ndk}"
JNI_LIBS="${APP}/app/src/main/jniLibs/arm64-v8a"

mkdir -p "${JNI_LIBS}"

# ── 0. Bun version sanity check ───────────────────────────────────
# The .jsc bytecode produced by host bun must be ABI-compatible with the
# JSC linked into libskal.so. Both are built from the same vendor/bun
# commit, so as long as host bun is at the same release as our vendored
# bun, we're fine. If they drift, JSC silently falls back to source
# parsing at load time — no crash, just no perf win.
if command -v bun >/dev/null 2>&1; then
  HOST_BUN_VER=$(bun --version)
  echo "Host bun: ${HOST_BUN_VER}"
  if [[ -f "${ROOT}/patches/bun-base-commit.txt" ]]; then
    PINNED_COMMIT=$(cat "${ROOT}/patches/bun-base-commit.txt")
    echo "vendor/bun pinned commit: ${PINNED_COMMIT:0:12}…"
    echo "  (bytecode mismatch is silent — observable only via slower eval times)"
  fi
else
  echo "error: bun not in PATH; can't generate bytecode" >&2
  exit 1
fi

# ── 1. Build the JS app ───────────────────────────────────────────
# vite produces skal-app.js (the IIFE used by debug builds).
# bun build --bytecode --format=cjs takes that and produces skal-app.cjs +
# skal-app.cjs.jsc — what release builds load via the module loader path.
# See docs/bytecode-cache.md for the full architecture.
echo
echo "── 1/4 building JS app ──"
cd "${JS_APP}"
if [[ ! -d node_modules ]]; then
  echo "  installing js-app deps (first run)"
  bun install
fi
bun run build
echo
ls -lh \
  "${APP}/app/src/main/assets/skal-app.js" \
  "${APP}/app/src/main/assets/skal-app.cjs" \
  "${APP}/app/src/main/assets/skal-app.cjs.jsc"
cd "${ROOT}"

# ── 2. Link libskal.so ────────────────────────────────────────────
echo
echo "── 2/4 linking libskal.so ──"
"${ROOT}/scripts/link-skal-so.sh"

# ── 3. Strip + stage native libs ──────────────────────────────────
echo
echo "── 3/4 staging native libs ──"
LLVM="${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/bin"
"${LLVM}/llvm-strip" -s \
  "${ROOT}/build/skal-android/libskal.so" \
  -o "${ROOT}/build/skal-android/libskal.stripped.so"

cp "${ROOT}/build/skal-android/libskal.stripped.so" "${JNI_LIBS}/libskal.so"
cp "${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" \
   "${JNI_LIBS}/libc++_shared.so"

echo "  staged into ${JNI_LIBS}:"
ls -lh "${JNI_LIBS}"

# Generate a self-signed dev keystore on first run.
KEYSTORE="${APP}/skal-bench-release.keystore"
if [[ ! -f "${KEYSTORE}" ]]; then
  /opt/homebrew/opt/openjdk@17/bin/keytool -genkey -v \
    -keystore "${KEYSTORE}" \
    -alias skal -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass skalbench -keypass skalbench \
    -dname "CN=Skal Bench, O=Skal, C=US"
fi

# ── 4. Gradle build ───────────────────────────────────────────────
echo
echo "── 4/4 assembling release APK ──"
cd "${APP}"
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
PATH=/opt/homebrew/opt/openjdk@17/bin:${PATH:-} \
ANDROID_HOME="${HOME}/Library/Android/sdk" \
./gradlew :app:assembleRelease

APK="${APP}/app/build/outputs/apk/release/app-release.apk"
echo
echo "✓ APK built: ${APK}"
ls -lh "${APK}"
echo
echo "Install on a connected device/emulator:"
echo "  ${HOME}/Library/Android/sdk/platform-tools/adb install -r ${APK}"
echo "  ${HOME}/Library/Android/sdk/platform-tools/adb shell am start -n com.skal.bench/.MainActivity"
