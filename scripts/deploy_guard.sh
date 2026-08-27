#!/usr/bin/env bash
# deploy_guard.sh — may the connector be deployed from $BUILT_SHA?
#
# THE RACE THIS EXISTS FOR, and it is `publish_guard.sh`'s race one service
# over. CI runs are serialized but NOT ordered (`concurrency` with
# cancel-in-progress: false), so when two commits land minutes apart the OLDER
# run can complete last. A deploy fired from that run ships the older tree and
# the connector ROLLS BACKWARDS — live code going back in time with nothing
# red anywhere, because every gate in this repository asks about the TREE and
# none of them asks what the deployed process is serving. That is the exact
# invisibility `mcp/check_live.mjs` was built for after a stale `lyric_sweep`
# schema was found by a person reading it rather than by anything that gates
# (`MISSING.md` M-127), and a rollback is the same defect arriving on purpose.
#
# THE RULE. Deploy only if the commit CI validated is STILL the tip of main.
# If main has moved on, that newer commit has its own CI run, and that run
# deploys it — so the correct move is to stand down rather than ship a tree
# somebody has already superseded.
#
# WHY SHA EQUALITY HERE AND SOURCE COMPARISON THERE. `publish_guard.sh` cannot
# compare shas: sync-pages.yml PUBLISHES ONTO main, so main's tip is usually an
# auto-publish commit that rewrites generated outputs, and a sha test would
# refuse every legitimate publish. Nothing writes to main on this path — the
# deploy is a POST to Render and changes no ref — so the tip this job read is
# the tip CI ran on, and equality is the whole question. The auto-publish
# commit does mean a merge can stand down once and deploy on the FOLLOWING
# run (that commit carries the merge's source and gets its own CI); that is a
# few minutes of latency, not a missed deploy.
#
# Exits 0 to deploy, 10 to stand down. Any other non-zero is a real error.
#
# Usage: BUILT_SHA=<sha> scripts/deploy_guard.sh [--verbose]

set -euo pipefail

VERBOSE=0
[ "${1:-}" = "--verbose" ] && VERBOSE=1

if [ -z "${BUILT_SHA:-}" ]; then
  echo "deploy_guard: BUILT_SHA is unset — refusing to guess what CI validated" >&2
  exit 1
fi
if ! git rev-parse --verify --quiet "$BUILT_SHA^{commit}" >/dev/null; then
  echo "deploy_guard: BUILT_SHA '$BUILT_SHA' is not a commit in this repo" >&2
  exit 1
fi
if ! git rev-parse --verify --quiet "origin/main^{commit}" >/dev/null; then
  echo "deploy_guard: origin/main not found — fetch it before calling this" >&2
  exit 1
fi

BUILT=$(git rev-parse "$BUILT_SHA^{commit}")
TIP=$(git rev-parse "origin/main^{commit}")

if [ "$BUILT" = "$TIP" ]; then
  [ "$VERBOSE" = 1 ] && echo "deploy_guard: $BUILT is the tip of main — deploying."
  exit 0
fi

# NAME THE DIRECTION. Behind the tip is the ordinary case and is benign; AHEAD
# of it (or on a fork of it) means the ref this job read is not on main at all,
# which is a different problem and must not read as the same one.
if git merge-base --is-ancestor "$BUILT" "$TIP"; then
  WHERE="behind main's tip by $(git rev-list --count "$BUILT..$TIP") commit(s)"
else
  WHERE="NOT an ancestor of main's tip — this ref is not on main"
fi

echo "deploy_guard: STAND DOWN — $BUILT is $WHERE."
echo "  Deploying now would put the connector on a tree main has moved past,"
echo "  and a later-finishing older run is how a live service rolls backwards."
echo "  The newer commit has its own CI run, and that run deploys it."
echo "  built: $BUILT"
echo "  tip:   $TIP"
exit 10
