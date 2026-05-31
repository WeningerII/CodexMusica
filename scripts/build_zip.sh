#!/usr/bin/env bash
# Build the publishable codex zip in Claude-Skills upload format.
#
# Layout: the zip must contain ONE named folder at root (codex-music-tool/)
# with SKILL.md and everything else inside it. This is what Claude.ai's
# Settings → Customize → Skills uploader expects.
#
# Excludes refactor-backup files (`*.pre_*`) — safety snapshots from prior
# refactors that have no value to end users and would bloat the artifact.
#
# Usage:
#   ./scripts/build_zip.sh                          # default path
#   ZIP_OUT=/tmp/codex.zip ./scripts/build_zip.sh   # custom path
set -e

SKILL_NAME="codex-music-tool"
ZIP_OUT="${ZIP_OUT:-/mnt/user-data/outputs/codex.zip}"
cd "$(dirname "$0")/.."

# Stage into a temp dir so we get a single named folder at the zip root
STAGE=$(mktemp -d)
trap "rm -rf $STAGE" EXIT
mkdir -p "$STAGE/$SKILL_NAME"
cp -r references scripts docs tests SKILL.md \
  "$STAGE/$SKILL_NAME/"

# Strip refactor backups and pre-refactor archives from the staged copy.
# These are dev-only safety copies; nothing in the engine reads them.
find "$STAGE/$SKILL_NAME" -name '*.pre_*' -delete
rm -rf "$STAGE/$SKILL_NAME/references/_archive"

rm -f "$ZIP_OUT"
(cd "$STAGE" && zip -rq "$ZIP_OUT" "$SKILL_NAME")

size_kb=$(( $(stat -c %s "$ZIP_OUT" 2>/dev/null || stat -f %z "$ZIP_OUT") / 1024 ))
echo "Built: $ZIP_OUT (${size_kb} KB)"
echo "Layout: ZIP root → $SKILL_NAME/ → SKILL.md + references/ + scripts/ + tests/ + docs/"
