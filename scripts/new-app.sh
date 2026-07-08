#!/usr/bin/env bash
# bun run new — scaffold a new Skal app under examples/<name>/.
#
# Usage:
#   bun run new my-app                    # full scaffold (default)
#   bun run new my-app --platforms macos  # specific platforms only
#   bun run new my-app --no-platforms     # JS scaffold only, skip flutter create + libskal
#
# (or invoke directly: `scripts/new-app.sh my-app [flags]`)
#
# Default behaviour:
#   1. Copies scripts/templates/default/ → examples/<name>/, substitutes
#      <name> + snake-cased Dart name into package.json / pubspec.yaml /
#      main.dart / index.html.
#   2. bun install (workspace deps + register the new package).
#   3. flutter create — generates android/, ios/, macos/ platform configs.
#   4. scripts/skal-link.sh — drops libskal binaries into the new
#      platform dirs so the app can launch.
#
# Steps 3-4 require `bun run setup` to have run first (so vendor/bun
# is built + libskal binaries exist on disk).

set -euo pipefail

# ── arg parse ────────────────────────────────────────────────────────
NAME=""
DO_PLATFORMS=1
PLATFORMS="macos,ios,android"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-platforms)
      DO_PLATFORMS=0
      ;;
    --platforms)
      DO_PLATFORMS=1
      if [[ $# -ge 2 && "$2" != -* ]]; then
        PLATFORMS="$2"; shift
      fi
      ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \?//'; exit 0
      ;;
    -*) echo "error: unknown flag: $1" >&2; exit 1 ;;
    *)
      if [[ -z "${NAME}" ]]; then NAME="$1"
      else echo "error: unexpected positional arg: $1" >&2; exit 1; fi
      ;;
  esac
  shift
done

if [[ -z "${NAME}" ]]; then
  echo "usage: $0 <app-name> [--platforms <list> | --no-platforms]" >&2
  exit 1
fi

# Name must be kebab-case: lowercase letters, digits, single hyphens.
# Bun workspaces + Dart pubspec both accept these without escaping.
if ! [[ "${NAME}" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]] && ! [[ "${NAME}" =~ ^[a-z]$ ]]; then
  echo "error: name must be kebab-case (lowercase + digits + hyphens), got: ${NAME}" >&2
  exit 1
fi

# Dart package names disallow hyphens — derive a snake_case variant.
NAME_SNAKE="${NAME//-/_}"

# ── paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/templates/default"
TARGET="${REPO_ROOT}/examples/${NAME}"

if [[ ! -d "${TEMPLATE}" ]]; then
  echo "error: template dir missing: ${TEMPLATE}" >&2
  exit 1
fi

if [[ -e "${TARGET}" ]]; then
  echo "error: target exists: ${TARGET}" >&2
  echo "       remove it first, or pick a different name." >&2
  exit 1
fi

# Sanity check — refuse to do platform configs if setup hasn't run.
if [[ ${DO_PLATFORMS} -eq 1 ]]; then
  if [[ ! -x "${REPO_ROOT}/vendor/bun/build/release/bun-profile" \
     && ! -x "${REPO_ROOT}/vendor/bun/build/release/bun" ]]; then
    echo "error: vendor/bun isn't built yet — run 'bun run setup' first." >&2
    echo "       (or pass --no-platforms to scaffold the JS side only)" >&2
    exit 1
  fi
fi

# ── copy + substitute ────────────────────────────────────────────────
echo "→ Creating ${TARGET}"
mkdir -p "${TARGET}"

# tar-pipe rather than cp -R so we control which files come along
# (skips .DS_Store, node_modules, etc. — none in the template today
# but future-proof against operator error).
( cd "${TEMPLATE}" && tar cf - \
    --exclude='node_modules' \
    --exclude='.DS_Store' \
    --exclude='dist' \
    --exclude='build' \
    . ) | ( cd "${TARGET}" && tar xf - )

# Token-substitute __APP_NAME__ → kebab, __APP_NAME_SNAKE__ → snake.
# Touched files: every text file under the new tree (sed -i'' on macOS
# needs an empty backup extension passed positionally; GNU sed treats it
# as an empty extension argument).
while IFS= read -r f; do
  case "${f}" in
    *.png|*.jpg|*.ico|*.gz|*.zip|*/assets/*) continue ;;
  esac
  sed -i.bak \
    -e "s/__APP_NAME_SNAKE__/${NAME_SNAKE}/g" \
    -e "s/__APP_NAME__/${NAME}/g" \
    "${f}"
  rm -f "${f}.bak"
done < <(find "${TARGET}" -type f \( \
    -name '*.json' -o -name '*.jsx' -o -name '*.js' -o -name '*.html' \
    -o -name '*.md' -o -name '*.yaml' -o -name '*.dart' -o -name '*.sh' \
    -o -name '*.cjs' \
  \))

chmod +x "${TARGET}/scripts/find-vendored-bun.sh" 2>/dev/null || true

# ── install ──────────────────────────────────────────────────────────
echo "→ bun install (register the new workspace package)"
( cd "${REPO_ROOT}" && bun install )

# ── flutter create + libskal link ────────────────────────────────────
if [[ ${DO_PLATFORMS} -eq 1 ]]; then
  echo
  echo "→ flutter create — generating ${PLATFORMS} platform configs"
  ( cd "${TARGET}/flutter-host" && \
    flutter create --org com.example \
      --project-name "${NAME_SNAKE}" \
      --platforms "${PLATFORMS}" . )

  echo
  echo "→ linking libskal binaries into the new platform configs"
  "${SCRIPT_DIR}/skal-link.sh" "${NAME}"
fi

# ── next steps ───────────────────────────────────────────────────────
cat <<EOF


✓ examples/${NAME}/ scaffolded$( [[ ${DO_PLATFORMS} -eq 1 ]] && echo " — ready to run." )

EOF

if [[ ${DO_PLATFORMS} -eq 1 ]]; then
  cat <<EOF
  bun --filter ${NAME} dev:macos              # macOS desktop
  bun --filter ${NAME} dev:ios                # iOS simulator (boot one first)
  bun --filter ${NAME} dev:android            # Android emulator / device
  bun --filter ${NAME} dev:web                # web preview → localhost:5173

  bun --filter ${NAME} build                  # JS bundle only (no flutter run)

EOF
else
  cat <<EOF
You scaffolded with --no-platforms. To add platform configs + libskal:

  cd examples/${NAME}
  bun run platforms                           # flutter create
  bun run link                                # drop libskal binaries
  bun run dev:macos                           # ready

EOF
fi
