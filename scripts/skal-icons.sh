#!/usr/bin/env bash
# skal-icons.sh — generate the app launcher icons (macOS/iOS/Android)
# from flutter-host/icon/skal-icon.png, replacing the default Flutter
# logo that `flutter create` drops in.
#
# Usage:
#   scripts/skal-icons.sh <app-name>
#   SKAL_APP_ROOT=/path/to/app/flutter-host scripts/skal-icons.sh <app-name>
#
# Driven by the `flutter_launcher_icons:` block in flutter-host/pubspec.yaml,
# for the platforms the app has (see below). Best-effort by design: icons
# are cosmetic, so a missing tool, no network, or a generator error warns
# and exits 0 — it must never break a scaffold or a `bun run link`. Re-run
# any time after editing icon/skal-icon.png.

set -uo pipefail

APP_NAME="${1:-app}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Standalone apps (scaffolded outside the repo) point SKAL_APP_ROOT at
# themselves; in-repo apps keep the examples/<name>/ convention.
APP_ROOT="${SKAL_APP_ROOT:-${REPO_ROOT}/examples/${APP_NAME}/flutter-host}"

warn() { echo "warning: $*" >&2; }

if [[ ! -d "${APP_ROOT}" ]]; then
  warn "skal-icons: ${APP_ROOT} not found — skipping icon generation"
  exit 0
fi

if [[ ! -f "${APP_ROOT}/icon/skal-icon.png" ]]; then
  warn "skal-icons: ${APP_ROOT}/icon/skal-icon.png missing — skipping icon generation"
  exit 0
fi

# Nothing to brand until at least one platform dir exists.
if [[ ! -d "${APP_ROOT}/macos" && ! -d "${APP_ROOT}/ios" && ! -d "${APP_ROOT}/android" ]]; then
  warn "skal-icons: no platform dirs under ${APP_ROOT} yet — run 'bun run platforms' first"
  exit 0
fi

if ! command -v flutter >/dev/null 2>&1; then
  warn "skal-icons: flutter not on PATH — skipping icon generation"
  exit 0
fi

# Only the platforms this app has. flutter_launcher_icons does Android
# first and throws when there is no android/ project ("PathNotFoundException:
# android/app/src/main/AndroidManifest.xml") before reaching the others, so
# an app made with `skal create --platforms ios` got no icons at all. It
# reads a copy of the config with each missing platform's entry taken out.
present=""
missing=""
for p in android ios macos web windows; do
  if [[ -d "${APP_ROOT}/${p}" ]]; then present="${present} ${p}"; else missing="${missing} ${p}"; fi
done

# The generator's own config file wins over the pubspec, as it does there.
CONFIG_SRC="${APP_ROOT}/flutter_launcher_icons.yaml"
[[ -f "${CONFIG_SRC}" ]] || CONFIG_SRC="${APP_ROOT}/pubspec.yaml"
CONFIG_DIR="$(mktemp -d)"
trap 'rm -rf "${CONFIG_DIR}"' EXIT
CONFIG="${CONFIG_DIR}/flutter_launcher_icons.yaml"
# Copy the YAML through, dropping each missing platform's entry (and the
# lines nested under it) from the icon block. The generator reads only
# that block; the deprecated `flutter_icons:` key is handled the same way.
awk -v drop="${missing}" '
  BEGIN { n = split(drop, list, " "); for (i = 1; i <= n; i++) skip[list[i]] = 1 }
  /^(flutter_launcher_icons|flutter_icons):/ { block = 1; level = 0; dropping = 0; print; next }
  block && /^[^ \t#]/ { block = 0 }
  !block { print; next }
  /^[ \t]*$/ { print; next }
  /^[ \t]*#/ { if (!dropping) print; next }
  {
    match($0, /^[ \t]*/)
    if (level == 0) level = RLENGTH
    if (RLENGTH <= level) {
      key = substr($0, RLENGTH + 1)
      sub(/[ \t]*:.*$/, "", key)
      dropping = (key in skip)
    }
    if (!dropping) print
  }
' "${CONFIG_SRC}" > "${CONFIG}"

echo "→ generating Skal launcher icons (${present# }) from icon/skal-icon.png"

# flutter_launcher_icons is a dev_dependency; `flutter create` already ran
# pub get, but do it again (cheap, idempotent) so a bare app still resolves.
if ! ( cd "${APP_ROOT}" && flutter pub get >/dev/null 2>&1 ); then
  warn "skal-icons: 'flutter pub get' failed — skipping (icons unchanged)"
  exit 0
fi

if ! ( cd "${APP_ROOT}" && dart run flutter_launcher_icons -f "${CONFIG}" ); then
  warn "skal-icons: flutter_launcher_icons failed — skipping (icons unchanged)"
  exit 0
fi

# The Skal mark is full-bleed (horns to the edges, "SKAL" low), so we ship
# a legacy square icon, not an adaptive/masked one. `flutter create` leaves
# an adaptive descriptor (mipmap-anydpi-v26/ic_launcher.xml) pointing at its
# own foreground — remove it so Android 8+ falls back to our square PNG
# instead of the stale Flutter adaptive icon.
ADAPTIVE_DIR="${APP_ROOT}/android/app/src/main/res/mipmap-anydpi-v26"
if [[ -d "${ADAPTIVE_DIR}" ]]; then
  rm -f "${ADAPTIVE_DIR}/ic_launcher.xml" "${ADAPTIVE_DIR}/ic_launcher_round.xml"
  rmdir "${ADAPTIVE_DIR}" 2>/dev/null || true
  echo "→ removed Android adaptive-icon descriptor (using full-square Skal icon)"
fi

echo "✓ Skal launcher icons installed into ${APP_ROOT}/"
