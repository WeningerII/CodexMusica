#!/usr/bin/env bash
# USER-PROMPT HOOK — the checkout may not silently travel backwards in time.
#
# `scripts/freshness_guard.sh` is the instrument; this is the shim that makes
# it fire without anybody remembering to fire it. The cadence is deliberate:
# the reverts this exists for happened BETWEEN turns, so the start of a turn
# is exactly when the tree needs re-asking. `--quiet` keeps a fresh tree
# silent, so the only time this speaks is the time it matters.
#
# IT NEVER BLOCKS. stdout from a UserPromptSubmit hook is added to the
# session's context, which is the whole mechanism: a rewound tree announces
# itself in the one place that will be read before the next file is. Refusing
# the turn outright would punish the user for the container's behaviour.
set -uo pipefail
bash "$CLAUDE_PROJECT_DIR/scripts/freshness_guard.sh" --restore --quiet 2>&1 || true
exit 0
