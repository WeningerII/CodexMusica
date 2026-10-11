#!/usr/bin/env bash
# stage_library_code.sh — sync-pages stages the Library's chunk generations
# (scripts/library_chunk_generations.js) only when there is something to
# stage: library/code exists, or it is tracked and its last generation was
# just deleted. A build without the Library, in a tree that never held
# library/code, has no such path, and `git add library/code` would refuse an
# unmatched pathspec and stop the publish.
set -euo pipefail
if [ -e library/code ] || [ -n "$(git ls-files -- library/code)" ]; then
  git add -A -- library/code
fi
