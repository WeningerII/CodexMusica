#!/usr/bin/env bash
# last_deployed_sha.sh — the sha of the last build this workflow ASKED Render
# for, read off the workflow's own run history. (`MISSING.md` M-187 (b),
# 2026-09-02.)
#
# WHAT THE RECORD IS, AND WHAT IT IS NOT. deploy-connector.yml's `Deploy`
# step POSTs Render's hook with `?ref=<sha>` and the `Stood down` step is
# skipped; on a stand-down the two conclusions swap. So "the most recent
# successful run of this workflow whose `Deploy` step concluded success" IS
# the last sha Render was asked to build — a record this repository already
# keeps, readable with the job's own GITHUB_TOKEN under `actions: read`, and
# no new secret, service, artifact or variable. It is NOT the sha the live
# process is serving: ACCEPTED IS NOT DEPLOYED (the Deploy step says so), and
# whether Render finished that build is `mcp/check_live.mjs`'s question. A
# same-sha stand-down therefore says "already asked for", never "already
# live"; a build Render accepted and then lost is re-asked by hand
# (`workflow_dispatch` bypasses this lookup on purpose).
#
# Prints the sha, or nothing when no accepted deploy is on record. Exits 0 in
# both cases; any other exit is the API refusing to answer, and the caller
# must treat that as UNKNOWN rather than as "no match" — an unknown never
# reads as a value (doctrine 20).
#
# Usage: GH_TOKEN=… GITHUB_REPOSITORY=owner/repo [GITHUB_RUN_ID=<this run>]
#        scripts/last_deployed_sha.sh
set -euo pipefail

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is unset}"
WORKFLOW="${DEPLOY_WORKFLOW:-deploy-connector.yml}"
# The run asking is itself a success-in-progress with a pending Deploy step
# and must not read as the record; the id filter is belt and braces over the
# conclusion filter.
SKIP="${GITHUB_RUN_ID:-0}"

runs=$(gh api "repos/$REPO/actions/workflows/$WORKFLOW/runs?status=success&per_page=30" \
  --jq ".workflow_runs[] | select(.id != $SKIP) | \"\\(.id) \\(.head_sha)\"")

while read -r id sha; do
  [ -n "$id" ] || continue
  if gh api "repos/$REPO/actions/runs/$id/jobs" \
      --jq '.jobs[].steps[] | select(.name == "Deploy") | .conclusion' | grep -qx success; then
    echo "$sha"
    exit 0
  fi
done <<< "$runs"
exit 0
