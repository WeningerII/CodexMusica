#!/usr/bin/env bash
# freshness_guard.sh — is the WORKING TREE the tree I think it is?
#
# THE FAILURE THIS EXISTS FOR, and it is the only one in this repository whose
# blast radius is every other check at once. This project runs in an ephemeral
# container. When that container is reclaimed and rebuilt mid-session the
# checkout comes back at whatever commit the snapshot held — an older one —
# and NOTHING ANNOUNCES IT. `git status` is clean, every path resolves, every
# suite passes. The files simply contain the past.
#
# MEASURED, 2026-08-31: five reverts in one sitting, each to `e61757e` (an
# Aug 28 snapshot) while `origin/main` stood at `1206fe25`. The damage was not
# a crash. A session read `quality/plan.py`, correctly reported the constant
# `WORDS_LEFT_FREE`, was reverted underneath, re-read the same path, did not
# find it, and RETRACTED A TRUE STATEMENT as a fabrication — then re-derived a
# whole analysis of the planner's binding density against pre-fix code and
# reported those numbers as current. Both the claim and its correction were
# wrong, in opposite directions, from one silently rewound file.
#
# WHY A CHECK AND NOT A HABIT. Doctrine 48: a principle that lives only in
# prose gets followed exactly as often as somebody remembers it. "Verify HEAD
# before trusting a read" was written down after the FIRST revert and was not
# followed at reverts two through five, because the whole point of this defect
# is that it gives the reader no reason to suspect anything. A guard that runs
# on its own is the only form of this rule that works.
#
# THREE STATES, NEVER TWO (doctrine 20 — "cannot tell" is not "fine"):
#   FRESH   HEAD is origin/main, or carries local work on top of it.
#   BEHIND  HEAD is an ANCESTOR of origin/main. This is the revert signature:
#           no local commits, just an older tree wearing a current branch name.
#   UNKNOWN the remote could not be reached. Reported as its own state and
#           never rendered as FRESH, because a fetch that failed has measured
#           nothing.
#
# RECOVERY IS CONDITIONAL AND THE CONDITION IS THE WHOLE SAFETY ARGUMENT.
# `--restore` moves the tree back to origin/main ONLY when it is BEHIND *and*
# the working tree is clean. BEHIND means HEAD is an ancestor, so there are no
# local commits to lose by construction; clean means there is no uncommitted
# work to overwrite. Fail either test and the guard reports and touches
# nothing — a guard that destroys a session's uncommitted work to fix its own
# staleness has made the trade backwards.
#
#   bash scripts/freshness_guard.sh            # report; exit 0/3/2
#   bash scripts/freshness_guard.sh --restore  # + recover when it is safe to
#   bash scripts/freshness_guard.sh --quiet    # print only when NOT fresh
#
# EXIT CODES follow this repo's convention: 0 fresh, 3 drift (BEHIND —
# an answer, not an error), 2 refused (UNKNOWN — the question could not be put).
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "freshness_guard: not inside a git work tree" >&2; exit 2; }

UPSTREAM="${FRESHNESS_UPSTREAM:-origin/main}"
REMOTE="${UPSTREAM%%/*}"
BRANCH="${UPSTREAM#*/}"

# TWO STAND-DOWNS, because "BEHIND and clean" is also the signature of
# deliberate archaeology. A `git bisect` parks HEAD at an ancestor with a
# clean tree on purpose, and a guard that restores over it destroys the very
# investigation it was asked to protect. FRESHNESS_GUARD_OFF=1 is the manual
# escape hatch; the in-progress checks below are the automatic one.
if [ "${FRESHNESS_GUARD_OFF:-0}" = "1" ]; then exit 0; fi
gitdir=$(git rev-parse --git-dir)
for marker in BISECT_LOG rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
  if [ -e "$gitdir/$marker" ]; then
    echo "TREE FRESHNESS: STOOD DOWN — $marker in progress; HEAD is where you put it."
    exit 0
  fi
done

restore=0; quiet=0
for a in "$@"; do
  case "$a" in
    --restore) restore=1 ;;
    --quiet)   quiet=1 ;;
    *) echo "freshness_guard: unknown flag '$a'" >&2; exit 2 ;;
  esac
done

# A fetch is the only way to learn the remote moved, and it is also the step
# that can hang. Bounded, quiet, and its failure is a REPORTED state.
if ! timeout 25 git fetch -q "$REMOTE" "$BRANCH" 2>/dev/null; then
  echo "TREE FRESHNESS: UNKNOWN — could not reach $REMOTE."
  echo "  HEAD is $(git rev-parse --short HEAD). Whether it is current CANNOT BE TOLD."
  echo "  Treat file reads as unverified until this resolves."
  exit 2
fi

head_sha=$(git rev-parse HEAD)
up_sha=$(git rev-parse "$UPSTREAM" 2>/dev/null) || {
  echo "TREE FRESHNESS: UNKNOWN — $UPSTREAM does not resolve." >&2; exit 2; }

if [ "$head_sha" = "$up_sha" ]; then
  [ $quiet -eq 1 ] || echo "TREE FRESHNESS: FRESH — HEAD is $UPSTREAM ($(git rev-parse --short HEAD))."
  exit 0
fi

if ! git merge-base --is-ancestor "$head_sha" "$up_sha"; then
  # Local commits exist that the upstream does not carry. That is ordinary
  # work in progress, not a revert, and is never restored over.
  ahead=$(git rev-list --count "$up_sha..$head_sha")
  [ $quiet -eq 1 ] || {
    echo "TREE FRESHNESS: FRESH — $ahead local commit(s) on top of $UPSTREAM."
    echo "  HEAD $(git rev-parse --short HEAD); nothing here is stale."
  }
  exit 0
fi

# BEHIND: an ancestor of the upstream, so there is no local work — the tree
# was rewound underneath the session.
missing=$(git rev-list --count "$head_sha..$up_sha")
dirty=$(git status --porcelain | wc -l | tr -d ' ')
echo "TREE FRESHNESS: BEHIND — THE FILES ON DISK ARE THE PAST. DO NOT TRUST A READ."
echo "  HEAD       $(git rev-parse --short "$head_sha")  ($(git log -1 --format=%ad --date=short "$head_sha"))"
echo "  $UPSTREAM  $(git rev-parse --short "$up_sha")  ($(git log -1 --format=%ad --date=short "$up_sha"))"
echo "  $missing commit(s) missing from this checkout; $dirty uncommitted path(s)."

if [ "$restore" -eq 1 ] && [ "$dirty" = "0" ]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  if git checkout -B "$branch" "$UPSTREAM" >/dev/null 2>&1; then
    echo "  RESTORED — $branch is now $UPSTREAM ($(git rev-parse --short HEAD))."
    exit 0
  fi
  echo "  RESTORE FAILED — recover by hand: git checkout -B $branch $UPSTREAM"
elif [ "$restore" -eq 1 ]; then
  echo "  NOT RESTORED — $dirty uncommitted path(s) would be overwritten."
  echo "  Commit or stash, then: git checkout -B \$(git rev-parse --abbrev-ref HEAD) $UPSTREAM"
else
  echo "  Recover with: bash scripts/freshness_guard.sh --restore"
fi
exit 3
