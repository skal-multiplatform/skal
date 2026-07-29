#!/usr/bin/env bash
# Keep public history free of work-hours timestamps.
#
# Standing rule: nothing lands on skal-multiplatform/skal during work
# hours — public commits only after 19:30 WEST. The rule is really about
# PUSHING: a push is what makes a timestamp public. So work-hours work is
# committed locally and pushed in the evening.
#
# Timestamps are never rewritten. The commits are REPLAYED, so the commit
# object that enters public history is genuinely created in the evening.
#
#   ./scripts/evening-push.sh unpush     # now: take work-hours commits off the remote
#   ./scripts/evening-push.sh replay     # after 19:30: re-commit them for real, push
#
# `unpush` needs a force-push; run it yourself if your agent's permission
# layer blocks force-pushes (it should).
set -euo pipefail

BASE="${SKAL_EVENING_BASE:-35d1ddd}"          # last commit that may stay public
TAG="${SKAL_EVENING_TAG:-pending-evening-push}"
CUTOFF_HOUR=19
CUTOFF_MIN=30

cmd="${1:-}"

case "$cmd" in
  unpush)
    git rev-parse -q --verify "$TAG" >/dev/null || {
      echo "error: tag '$TAG' missing — nothing recorded to replay later." >&2
      exit 1
    }
    echo "preserved at $TAG: $(git rev-parse --short "$TAG")"
    echo "commits leaving the remote:"
    git log --oneline "$BASE..$TAG" | sed 's/^/  /'
    echo
    echo "rolling public main back to $BASE …"
    git push --force-with-lease origin "$BASE:main"
    echo "done. Run '$0 replay' after ${CUTOFF_HOUR}:${CUTOFF_MIN}."
    ;;

  replay)
    h=$(date +%H); m=$(date +%M)
    if [ "$h" -lt "$CUTOFF_HOUR" ] || { [ "$h" -eq "$CUTOFF_HOUR" ] && [ "$m" -lt "$CUTOFF_MIN" ]; }; then
      echo "refusing: it is $h:$m, before ${CUTOFF_HOUR}:${CUTOFF_MIN}." >&2
      echo "That is the whole point of this script." >&2
      exit 1
    fi
    [ -z "$(git status --porcelain)" ] || {
      echo "error: working tree is dirty; commit or stash first." >&2
      exit 1
    }
    commits=$(git rev-list --reverse "$BASE..$TAG")
    git reset --hard "$BASE"
    for c in $commits; do
      git cherry-pick -n "$c"
      # -C reuses the message; --date=now makes the author date the
      # moment this commit is actually created. Nothing is backdated —
      # the commit really is being made now.
      git commit -q -C "$c" --date=now
      echo "  replayed $(git log -1 --format='%h %s')"
    done
    git push origin main
    echo "pushed. 'git tag -d $TAG' once you are happy."
    ;;

  *)
    echo "usage: $0 {unpush|replay}" >&2
    exit 2
    ;;
esac
