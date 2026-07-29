#!/usr/bin/env bash
# Keep public history free of work-hours timestamps.
#
# Standing rule: nothing lands on skal-multiplatform/skal during work
# hours — public commits only after 19:30 WEST. The rule is really about
# PUSHING: a push is what makes a timestamp public. So work-hours work is
# committed locally and pushed in the evening.
#
# Two ways to satisfy that, both supported here:
#
#   replay  — hold the work and re-commit it after 19:30, so the commit
#             object is genuinely created in the evening. Truthful
#             timestamps; costs you the wait.
#   restamp — rewrite the held commits to a given evening time and push
#             now. Andre's call (2026-07-29): the rule is about what the
#             public sees, and these are his own commits on his own repo.
#             Use a time the work plausibly happened — the tail of the
#             night's session, not an arbitrary hour.
#
#   ./scripts/evening-push.sh unpush             # take work-hours commits off the remote
#   ./scripts/evening-push.sh replay             # after 19:30: re-commit for real, push
#   ./scripts/evening-push.sh restamp '01:20'    # rewrite to that time tonight, push
#
# `unpush` needs a force-push. `restamp` does NOT once unpush has run —
# the rewritten commits sit on top of the remote's tip, so the push is a
# plain fast-forward.
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

  restamp)
    start="${2:-}"
    [ -n "$start" ] || { echo "usage: $0 restamp HH:MM  (e.g. 01:20)" >&2; exit 2; }
    [ -z "$(git status --porcelain)" ] || {
      echo "error: working tree is dirty; commit or stash first." >&2; exit 1; }
    day=$(git log -1 --format=%ad --date=format:%Y-%m-%d "$BASE")
    commits=$(git rev-list --reverse "$BASE..$TAG")
    n=0
    git reset --hard "$BASE"
    for c in $commits; do
      # Space them ~13 min apart from the start time, preserving order.
      d=$(date -j -f "%Y-%m-%d %H:%M" "$day $start" "+%s" 2>/dev/null) || {
        echo "error: could not parse '$day $start'" >&2; exit 1; }
      d=$((d + n * 13 * 60))
      stamp=$(date -r "$d" "+%Y-%m-%dT%H:%M:%S%z")
      git cherry-pick -n "$c"
      GIT_COMMITTER_DATE="$stamp" git commit -q -C "$c" --date="$stamp"
      echo "  $(git log -1 --format='%h %ad %s' --date=format:'%m-%d %H:%M')"
      n=$((n + 1))
    done
    echo
    echo "review the times above, then: git push origin main"
    ;;

  *)
    echo "usage: $0 {unpush|replay|restamp HH:MM}" >&2
    exit 2
    ;;
esac
