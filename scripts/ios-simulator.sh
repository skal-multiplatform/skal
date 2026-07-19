#!/usr/bin/env bash
# ios-simulator.sh — ensure an iOS Simulator is booted; print its UDID.
#
# `flutter run -d iphone-simulator` (or `-d ios`) does NOT work: `-d` matches a
# device id/name, and a booted simulator's id is a UDID (name e.g. "iPhone 15")
# — neither contains "iphone-simulator". So the dev scripts resolve the real
# UDID through here (the iOS counterpart of android-emulator.sh).
#
# Behavior: if an iPhone simulator is already booted, print its UDID and exit.
# Otherwise boot the first available iPhone simulator, open the Simulator app,
# wait until it reports Booted, then print its UDID. Progress goes to stderr so
# callers can capture just the id:  DEV=$(ios-simulator.sh)
set -euo pipefail

command -v xcrun >/dev/null 2>&1 || {
  echo "ios-simulator: xcrun not found — install Xcode + command-line tools" >&2
  exit 1
}

BOOT_TIMEOUT="${SKAL_IOS_BOOT_TIMEOUT:-120}"   # seconds to wait for a cold boot

# Print the UDID of the first iPhone simulator in the given state, else nothing.
#   $1 = simctl device filter (booted | available)
#   $2 = state to require in the row (Booted | Shutdown)
# The UDID is matched as a UUID token directly — NOT by splitting on parens —
# so a device NAME that contains parentheses (e.g. "iPhone SE (3rd generation)")
# can never be mistaken for the id.
first_iphone_udid() {
  xcrun simctl list devices "$1" 2>/dev/null \
    | grep -i 'iPhone' | grep -F "($2)" \
    | grep -oiE '[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}' \
    | head -n1
}

udid="$(first_iphone_udid booted Booted || true)"
if [[ -z "$udid" ]]; then
  udid="$(first_iphone_udid available Shutdown || true)"
  if [[ -z "$udid" ]]; then
    echo "ios-simulator: no iPhone simulator found — add one in Xcode ›" \
         "Settings › Components (or: xcrun simctl create)" >&2
    exit 1
  fi
  echo "ios-simulator: booting $udid…" >&2
  xcrun simctl boot "$udid" >&2 2>&1 || true
  open -a Simulator >&2 2>&1 || true
  echo "ios-simulator: waiting for boot to complete…" >&2
  deadline=$(( SECONDS + BOOT_TIMEOUT ))
  # Substring-match the known UDID in the booted list — no re-parsing, and no
  # `grep -q` (which would SIGPIPE the producer and, under pipefail, look like
  # a non-match forever).
  until [[ "$(xcrun simctl list devices booted 2>/dev/null || true)" == *"$udid"* ]]; do
    if (( SECONDS >= deadline )); then
      echo "ios-simulator: '$udid' did not finish booting within ${BOOT_TIMEOUT}s" >&2
      exit 1
    fi
    sleep 1
  done
fi

echo "$udid"
