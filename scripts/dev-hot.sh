#!/usr/bin/env bash
# dev-hot.sh <device> <app-name> [host] — JS hot-reload dev loop.
#
# Run from an app dir (examples/<app>/, i.e. the package.json that defines the
# `dev:hot:*` script). Builds the JS bundle once, starts the hot-reload dev
# server (scripts/hot-reload-server.js: vite --watch + WebSocket push), then
# runs `flutter run` with hot reload enabled. On exit (Ctrl-C / `q`) the trap
# tears the server — and the vite watcher it spawned — down.
#
# `host` is the address the device reaches the dev machine at: omit for
# macOS / iOS-simulator (localhost); pass 10.0.2.2 for the Android emulator.
set -e

DEVICE="$1"
APP="$2"
HOST="${3:-}"
if [[ -z "$DEVICE" || -z "$APP" ]]; then
  echo "usage: dev-hot.sh <device> <app-name> [host]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Build only if there is no bundle yet.
#
# hot-reload-server.js immediately spawns `vite build --watch`, which
# does its own initial build — so an unconditional build here meant
# every `dev:ios` / `dev:macos` paid for two full vite builds before the
# app even launched. The eager one still earns its place on a first-ever
# run, where `flutter run` would otherwise race the watcher and launch
# against a missing asset. After that the watcher's build is the one
# that matters, and anything stale in between is exactly what the hot
# reload is about to replace.
if [[ ! -f "examples/${APP}/flutter-host/assets/skal-app.js" \
   && ! -f "${APP}/flutter-host/assets/skal-app.js" ]]; then
  bun run build:js-only
fi
bun "${SCRIPT_DIR}/hot-reload-server.js" "$APP" &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT

DEFINES="--dart-define=SKAL_HOT=1"
[[ -n "$HOST" ]] && DEFINES="$DEFINES --dart-define=SKAL_HOT_HOST=$HOST"

# `flutter run -d android` doesn't match a booted emulator's id (it's
# `emulator-5554`) — resolve the real id, booting an AVD if none is attached.
if [[ "$DEVICE" == "android" ]]; then
  DEVICE="$("${SCRIPT_DIR}/android-emulator.sh")"
fi
# Same story for the iOS Simulator: `iphone-simulator` matches no device id/name
# on current Flutter — resolve a booted simulator's UDID (`ios` is the new
# sentinel; `iphone-simulator` kept for apps scaffolded before this change).
if [[ "$DEVICE" == "ios" || "$DEVICE" == "iphone-simulator" ]]; then
  DEVICE="$("${SCRIPT_DIR}/ios-simulator.sh")"
fi

cd flutter-host && flutter run -d "$DEVICE" $DEFINES
