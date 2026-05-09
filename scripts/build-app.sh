#!/usr/bin/env bash
# Build the Skal Bench Android app end-to-end:
#   1. Re-link libskal.so (assumes bun's Android build is already done)
#   2. Strip + copy libskal.so + libc++_shared.so into the app's jniLibs/
#   3. Run Gradle assembleRelease
#
# Prereqs (run scripts/build-icu-android.sh + scripts/build-jsc-android.sh
# + bun scripts/build.ts --profile=android-release first if you haven't):
#   - JDK 17 at /opt/homebrew/opt/openjdk@17 (brew install openjdk@17)
#   - Android SDK at $HOME/Library/Android/sdk
#   - Android NDK at $ANDROID_NDK_ROOT
#   - skal-bench-release.keystore in android-app/ (auto-generated on first run)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/android-app"
NDK="${ANDROID_NDK_ROOT:-/opt/homebrew/share/android-ndk}"
JNI_LIBS="${APP}/app/src/main/jniLibs/arm64-v8a"

mkdir -p "${JNI_LIBS}"

# ── 1. Link libskal.so ────────────────────────────────────────────
"${ROOT}/scripts/link-skal-so.sh"

# ── 2. Strip + stage native libs ──────────────────────────────────
LLVM="${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/bin"
"${LLVM}/llvm-strip" -s \
  "${ROOT}/build/skal-android/libskal.so" \
  -o "${ROOT}/build/skal-android/libskal.stripped.so"

cp "${ROOT}/build/skal-android/libskal.stripped.so" "${JNI_LIBS}/libskal.so"
cp "${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so" \
   "${JNI_LIBS}/libc++_shared.so"

echo "Staged into ${JNI_LIBS}:"
ls -lh "${JNI_LIBS}"

# ── 3. Generate a self-signed dev keystore on first run ───────────
KEYSTORE="${APP}/skal-bench-release.keystore"
if [[ ! -f "${KEYSTORE}" ]]; then
  /opt/homebrew/opt/openjdk@17/bin/keytool -genkey -v \
    -keystore "${KEYSTORE}" \
    -alias skal -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass skalbench -keypass skalbench \
    -dname "CN=Skal Bench, O=Skal, C=US"
fi

# ── 4. Gradle build ───────────────────────────────────────────────
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
