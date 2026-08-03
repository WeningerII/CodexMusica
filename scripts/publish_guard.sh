#!/usr/bin/env bash
# publish_guard.sh — may the artifact built from $BUILT_SHA be published onto main?
#
# THE RACE THIS EXISTS FOR. sync-pages.yml checks out the exact commit CI
# validated, builds codex.html from it, then does `git checkout -B main
# origin/main` and copies that build onto whatever main is at push time. Those
# are two different trees whenever main advanced in between. Publishes are
# serialized but NOT ordered (concurrency: cancel-in-progress: false), so when
# two PRs merge minutes apart the older publish can land last and overwrite main
# with an artifact built before the newer merge existed. It did, twice, on
# consecutive merge pairs: once dropping a CSS change, once dropping an 823 KB
# nav-glyph data block from the live app.
#
# THE RULE. Publish only if the SOURCE at the commit we built is identical to the
# source on main right now. Otherwise main carries source we did not build from,
# a newer CI run is already queued for it, and that run will publish the right
# thing — so the correct move is to stand down rather than overwrite.
#
# Comparing source (not commit shas) is what makes this correct rather than
# merely cautious. main's tip is usually an auto-publish commit, which by
# construction rewrites ONLY the generated outputs and never reverts source —
# so a sha comparison would refuse every legitimate publish, while a source
# comparison sees straight through it. The generated outputs are therefore
# excluded from the diff: they are what we are about to overwrite, and their
# staleness is the disease, not the symptom.
#
# Exits 0 to publish, 10 to stand down. Any other non-zero is a real error.
#
# Usage: BUILT_SHA=<sha> scripts/publish_guard.sh [--verbose]

set -euo pipefail

VERBOSE=0
[ "${1:-}" = "--verbose" ] && VERBOSE=1

if [ -z "${BUILT_SHA:-}" ]; then
  echo "publish_guard: BUILT_SHA is unset — refusing to guess what was built" >&2
  exit 1
fi
if ! git rev-parse --verify --quiet "$BUILT_SHA^{commit}" >/dev/null; then
  echo "publish_guard: BUILT_SHA '$BUILT_SHA' is not a commit in this repo" >&2
  exit 1
fi
if ! git rev-parse --verify --quiet "origin/main^{commit}" >/dev/null; then
  echo "publish_guard: origin/main not found — fetch it before calling this" >&2
  exit 1
fi

# The artifacts this job regenerates and overwrites. Everything NOT listed here
# is an input, and any difference in an input means main moved past us.
# index.html and AGENTS.md are deliberately absent: sync-pages copies them
# through verbatim from the built ref, so they are inputs too, and a change to
# either on main is a real reason to stand down.
GENERATED=(
  ':(exclude)codex.html'
  ':(exclude)llms.txt'
  ':(exclude)sitemap.xml'
  ':(exclude)robots.txt'
  ':(exclude)api'
)

if git diff --quiet "$BUILT_SHA" origin/main -- . "${GENERATED[@]}"; then
  [ "$VERBOSE" = 1 ] && echo "publish_guard: source at $BUILT_SHA matches main — publishing."
  exit 0
fi

echo "publish_guard: STAND DOWN — main has source that $BUILT_SHA was not built from."
echo "  Publishing now would overwrite the live artifact with a stale build."
echo "  The newer commit has its own CI run, and that run publishes it."
echo "  Source paths that differ:"
git diff --name-only "$BUILT_SHA" origin/main -- . "${GENERATED[@]}" | sed 's/^/    /' | head -20
exit 10
