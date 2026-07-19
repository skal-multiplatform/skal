#!/usr/bin/env bash
# android-emulator.sh — ensure an Android emulator is running; print its id.
#
# `flutter run -d android` does NOT work: `-d` matches a device id/name, and a
# booted emulator's id is `emulator-5554` (name "sdk gphone64 arm64") — neither
# contains "android". So the dev scripts resolve the real id through here.
#
# Behavior: if an emulator is already attached, print its id (e.g.
# emulator-5554) and exit. Otherwise launch the first Android AVD Flutter knows
# about, wait until it has finished booting, then print its id. All progress
# goes to stderr so callers can capture just the id:  DEV=$(android-emulator.sh)
set -euo pipefail

ADB="adb"
command -v adb >/dev/null 2>&1 || ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

# First attached emulator in the `adb devices` table (state == "device").
# Capture-then-parse (here-string, not a live pipe): an awk that `exit`s on the
# first match would close the pipe early and SIGPIPE the producer, which under
# `pipefail` reads as a failure. See the flutter-emulators note below.
running_id() {
  local out; out="$("$ADB" devices 2>/dev/null || true)"
  awk 'NR>1 && $2=="device" && $1 ~ /^emulator-/ {print $1; exit}' <<<"$out"
}

dev="$(running_id || true)"
if [[ -z "$dev" ]]; then
  # First AVD whose platform column is android (skips the iOS simulator row).
  # Capture flutter's full output FIRST, then parse the string. Piping it
  # straight into an awk that `exit`s on the first match closes the pipe before
  # flutter finishes writing its footer, so the Dart VM dies of SIGPIPE — and
  # under `pipefail` that fails the whole script with a fast, silent exit 255.
  # (This is the only path that runs when no emulator is attached, which is why
  # `dev:android` failed here while `dev:ios`/`dev:macos` were fine.)
  emus="$(flutter emulators 2>/dev/null || true)"
  avd="$(awk -F'•' '$NF ~ /android/ {gsub(/^[ \t]+|[ \t]+$/, "", $1); print $1; exit}' <<<"$emus")"
  if [[ -z "$avd" ]]; then
    echo "android-emulator: no Android AVD found — create one in Android Studio" \
         "or run: flutter emulators --create" >&2
    exit 1
  fi
  echo "android-emulator: no device attached — launching '$avd'…" >&2
  flutter emulators --launch "$avd" >&2 2>&1 || true
  "$ADB" wait-for-device >&2
  echo "android-emulator: waiting for boot to complete…" >&2
  until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    sleep 1
  done
  dev="$(running_id)"
fi

echo "$dev"
