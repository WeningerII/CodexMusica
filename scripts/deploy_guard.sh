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
# THE RULE, AND IT WAS THE WRONG ONE FOR FOURTEEN MONTHS OF TREE TIME
# (`MISSING.md` M-289). What this guard wants is that the connector never goes
# BACKWARDS. What it asked until 2026-09-15 is that the commit being deployed
# is exactly the tip of main — a far stronger thing, and on a moving tree an
# unsatisfiable one. It stood down saying "the newer commit has its own CI run,
# and that run deploys it", which was true while CI's push run was the trigger
# and STOPPED being true at M-287, when the deploy moved to the manually
# dispatched Production qualification. After that nothing qualified the newer
# commit unless a person did, so the sentence promised a deploy that nothing
# was going to perform, and the connector silently stopped tracking main:
# live sat on 42f020e6 for 33 h while main reached 64d32b20 six
# connector-touching commits later, every workflow green the whole time. That
# is M-127's invisibility arriving through the guard built to prevent it.
#
# SO THE QUESTION IS ASKED DIRECTLY. Given LIVE_SHA — what the running process
# reports at /health, which is ground truth about the deployed bytes rather
# than an inference from CI records — deploy when BUILT is a strict DESCENDANT
# of it. That advances the connector and cannot roll it back, which is the
# whole of the hazard. Equal means Render already serves this tree; an
# ancestor means the deploy would move the connector BACKWARDS, and that is
# the case this file exists to refuse.
#
# WITHOUT LIVE_SHA NOTHING CHANGES. An unset or unreadable live commit is
# UNKNOWN, and an unknown must never be read as a match (doctrine 20) — so the
# guard falls back to exactly the tip-of-main test it has always applied. The
# monotonic rule only ever RELAXES the answer, and only on positive evidence
# about what is actually running. A guard that cannot see the live process is
# no weaker than it was before it could.
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
# THE SECOND QUESTION, ASKED ONLY AFTER THE FIRST (2026-09-02, `MISSING.md`
# M-187 (b)): is this sha the one Render was LAST ASKED to build? Five deploys
# of one sha in 38 h (deploy runs #22-#26) were four crons and a dispatch, and
# the workflow's `event == 'push'` condition stood those down; what it could
# not stand down was a RE-RUN of a push's CI run, which keeps the push event
# and redeploys the same tree once more. The optional LAST_DEPLOYED_SHA is
# what scripts/last_deployed_sha.sh read off this workflow's own run history
# — the last run whose `Deploy` step concluded success. Equal means Render
# has already been asked for exactly this tree, so asking again restarts the
# live process (and its in-memory spend counter, render.yaml's own caveat) to
# serve the bytes it is serving. UNSET means UNKNOWN and deploys: an absent
# record is never read as a match (doctrine 20), and the caller says so.
#
# Exits 0 to deploy, 10 to stand down. Any other non-zero is a real error.
#
# Usage: BUILT_SHA=<sha> [LIVE_SHA=<sha>] [LAST_DEPLOYED_SHA=<sha>] scripts/deploy_guard.sh [--verbose]

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

# WHAT IS ACTUALLY RUNNING, if the caller could find out. Resolved to a full
# sha here so every comparison below is between two commits this repository
# knows; a live commit that is not in the tree at all (a force-push took it
# away, or the process is serving something that never landed) is UNKNOWN
# rather than an answer, because ancestry against it cannot be computed and a
# guess in either direction is the rollback this file refuses.
LIVE=""
if [ -n "${LIVE_SHA:-}" ]; then
  if LIVE=$(git rev-parse --verify --quiet "$LIVE_SHA^{commit}"); then
    :
  else
    LIVE=""
    [ "$VERBOSE" = 1 ] && echo "deploy_guard: LIVE_SHA '$LIVE_SHA' is not a commit in this repo — treating the live commit as UNKNOWN."
  fi
fi

# THE MONOTONIC RULE, and it runs BEFORE the tip test so that a tree main has
# moved past can still deploy when it is a genuine advance on what is live.
# Every answer here requires BUILT to be on main: a qualified commit that is
# not an ancestor of the tip is not this branch's to ship, and that case falls
# through to the ordering message below, which names it.
if [ -n "$LIVE" ] && git merge-base --is-ancestor "$BUILT" "$TIP"; then
  if [ "$BUILT" = "$LIVE" ]; then
    echo "deploy_guard: STAND DOWN — the live connector already serves $BUILT."
    echo "  Asking again would rebuild and restart the live process to serve the tree"
    echo "  it is already serving (and reset the in-memory spend counter with it)."
    echo "  built: $BUILT"
    echo "  live:  $LIVE"
    exit 10
  fi
  if git merge-base --is-ancestor "$LIVE" "$BUILT"; then
    if [ "$VERBOSE" = 1 ]; then
      echo "deploy_guard: $BUILT advances the live connector by $(git rev-list --count "$LIVE..$BUILT") commit(s) — deploying."
      echo "  live: $LIVE"
      if [ "$BUILT" != "$TIP" ]; then
        echo "  (main's tip is $TIP, $(git rev-list --count "$BUILT..$TIP") commit(s) further on; this deploy"
        echo "   does not reach it, and the tip's own qualification is what closes that gap.)"
      fi
    fi
    exit 0
  fi
  if git merge-base --is-ancestor "$BUILT" "$LIVE"; then
    echo "deploy_guard: STAND DOWN — $BUILT is BEHIND the live connector by $(git rev-list --count "$BUILT..$LIVE") commit(s)."
    echo "  Deploying it would move the live service BACKWARDS, which is the hazard"
    echo "  this guard exists for: live code going back in time with nothing red"
    echo "  anywhere, because every gate here asks about the TREE and none asks"
    echo "  what the deployed process is serving."
    echo "  built: $BUILT"
    echo "  live:  $LIVE"
    exit 10
  fi
  echo "deploy_guard: STAND DOWN — $BUILT and the live commit $LIVE are on DIVERGENT histories."
  echo "  Neither contains the other, so there is no advance to make and no way to"
  echo "  tell which is newer. This is a real anomaly, not an ordinary supersede:"
  echo "  the live process is serving a tree that is not an ancestor of the commit"
  echo "  being promoted."
  echo "  built: $BUILT"
  echo "  live:  $LIVE"
  exit 10
fi

if [ "$BUILT" = "$TIP" ]; then
  if [ -n "${LAST_DEPLOYED_SHA:-}" ] && [ "$BUILT" = "$LAST_DEPLOYED_SHA" ]; then
    echo "deploy_guard: STAND DOWN — $BUILT is the tip of main AND the last sha Render was asked to build."
    echo "  Asking again would rebuild and restart the live process to serve the tree"
    echo "  it is already serving (and reset the in-memory spend counter with it)."
    echo "  A build Render accepted and then lost is re-asked by workflow_dispatch,"
    echo "  which skips this check on purpose."
    echo "  built:         $BUILT"
    echo "  last accepted: $LAST_DEPLOYED_SHA"
    exit 10
  fi
  if [ "$VERBOSE" = 1 ]; then
    echo "deploy_guard: $BUILT is the tip of main — deploying."
    if [ -z "${LAST_DEPLOYED_SHA:-}" ]; then
      echo "  (no last-accepted sha on record or none supplied — the same-sha check did not run)"
    else
      echo "  last accepted: $LAST_DEPLOYED_SHA (differs)"
    fi
  fi
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
echo "  This is the FALLBACK answer, reached only because the live commit was"
echo "  UNKNOWN to this run (M-289): with LIVE_SHA set, a tree behind the tip"
echo "  still deploys when it ADVANCES the live one, and only a tree behind"
echo "  LIVE is refused. Do not read this as a promise that something else"
echo "  will deploy the newer commit — since M-287 the qualification is"
echo "  dispatched by a person, and main advancing does not produce one."
echo "  built: $BUILT"
echo "  tip:   $TIP"
exit 10
