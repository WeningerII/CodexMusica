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
cd "$(dirname "$0")/.."

# Default to whatever scripts/_paths.js resolves, so this script and every Node
# tool agree on where artifacts live. It used to hardcode the sandbox path
# (/mnt/user-data/outputs/codex.zip) while _paths.js falls back to
# $TMPDIR/codex-outputs off-sandbox — so on a CI runner an unqualified run wrote
# the zip somewhere tandem.js would never look for it. An explicit ZIP_OUT in
# the environment still wins, which is how tandem's own self-heal invokes this.
ZIP_OUT="${ZIP_OUT:-$(node -e 'process.stdout.write(require("./scripts/_paths.js").ZIP_OUT)')}"

# Stage into a temp dir so we get a single named folder at the zip root
STAGE=$(mktemp -d)
trap "rm -rf $STAGE" EXIT
mkdir -p "$STAGE/$SKILL_NAME"
# Stage only the paths that exist. SKILL.md + references + scripts are required;
# tests/ and docs/ are optional (docs/ in particular isn't present in every
# checkout). Missing a required path is fatal; missing an optional one is fine.
REQUIRED=(SKILL.md references scripts)
OPTIONAL=(tests docs)
for p in "${REQUIRED[@]}"; do
  if [ ! -e "$p" ]; then echo "build_zip: required path missing: $p" >&2; exit 1; fi
  cp -r "$p" "$STAGE/$SKILL_NAME/"
done
for p in "${OPTIONAL[@]}"; do
  [ -e "$p" ] && cp -r "$p" "$STAGE/$SKILL_NAME/"
done

# Strip refactor backups and pre-refactor archives from the staged copy.
# These are dev-only safety copies; nothing in the engine reads them.
find "$STAGE/$SKILL_NAME" -name '*.pre_*' -delete
rm -rf "$STAGE/$SKILL_NAME/references/_archive"

# The output DIRECTORY may not exist — `zip` will not create it and fails with a
# bare "cannot open" that reads like a missing input, not a missing parent. That
# is exactly how this failed under CI: scripts/_paths.js resolves OUTPUT_DIR to
# $TMPDIR/codex-outputs on a runner, nothing had ever created it, and tandem's
# self-heal ("zip missing, build it") failed for a reason its error text hid.
mkdir -p "$(dirname "$ZIP_OUT")"
rm -f "$ZIP_OUT"
(cd "$STAGE" && zip -rq "$ZIP_OUT" "$SKILL_NAME")

size_kb=$(( $(stat -c %s "$ZIP_OUT" 2>/dev/null || stat -f %z "$ZIP_OUT") / 1024 ))
staged=$(cd "$STAGE/$SKILL_NAME" && ls -1 | tr '\n' ' ')
echo "Built: $ZIP_OUT (${size_kb} KB)"
echo "Layout: ZIP root → $SKILL_NAME/ → ${staged}"
