#!/usr/bin/env bash
# RESTORE THE CODE GRAPH IN A FRESH CONTAINER — idempotent, safe to re-run.
#
# WHY THIS FILE EXISTS. Every operational piece of graphify lives OUTSIDE the
# repository and therefore does not survive a remote session:
#
#   the CLI                 /root/.local/ (uv tool)          container home
#   the Claude skill        ~/.claude/skills/graphify/       container home
#   the git hooks           .git/hooks/                      never cloned
#   the graph itself        graphify-out/                    gitignored
#
# Only `.graphifyignore`, the CLAUDE.md section and `quality/graph_probe.py`
# are in the tree. So "graphify is installed" was true of one container and of
# nothing else, and a setup somebody has to remember is the private-instrument
# defect this repo has a standing rule against: any step used twice goes
# through a command. This is that command.
#
# Point the environment's setup script at it, or run it once per session:
#   bash scripts/setup-graphify.sh
#
# WHAT IT DELIBERATELY DOES NOT DO: it never runs the SEMANTIC extraction.
# That pass sends documents to a model API and emits INFERRED edges, which is
# a non-deterministic derivation (doctrine 66) sitting beside deterministic
# ones. `--code-only` is the shipped invocation and this script hardcodes it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/.local/bin:$PATH"

say() { printf '  %-14s %s\n' "$1" "$2"; }

# 1. THE CLI. `uv tool install` is idempotent and cheap when already present.
if command -v graphify >/dev/null 2>&1; then
  say "cli" "already present ($(graphify --version 2>/dev/null || echo '?'))"
else
  if ! command -v uv >/dev/null 2>&1; then
    echo "REFUSED — uv is not on PATH and this script will not install a" >&2
    echo "package manager behind your back. Install uv, or:" >&2
    echo "    pipx install graphifyy" >&2
    exit 2
  fi
  uv tool install graphifyy >/dev/null
  say "cli" "installed"
fi

# 2. THE SKILL, so `/graphify` and the Skill tool can reach it. Without this
#    the graph is a file on disk that only a hand-typed CLI call consults —
#    which is exactly the built-but-not-reachable defect, and it is the one
#    this session committed before catching it.
if [ -f "$HOME/.claude/skills/graphify/SKILL.md" ]; then
  say "skill" "already installed"
else
  graphify install --platform claude >/dev/null
  say "skill" "installed -> ~/.claude/skills/graphify/"
fi

# 3. THE STALENESS GATE. A graph built before the change you are asking about
#    answers confidently and wrongly, which is this repository's own most
#    repeated defect. The post-commit hook re-extracts the changed files, so
#    the graph cannot silently fall behind HEAD.
if [ -f .git/hooks/post-commit ] && grep -q graphify .git/hooks/post-commit 2>/dev/null; then
  say "hooks" "already installed"
else
  graphify hook install >/dev/null
  say "hooks" "post-commit + post-checkout installed"
fi

# 4. THE GRAPH. ~47s over this tree, AST only, no API key. Rebuilt rather than
#    committed: it is a derivation whose input is already here.
if [ -f graphify-out/graph.json ]; then
  say "graph" "present ($(python3 -c "import json;print(len(json.load(open('graphify-out/graph.json'))['nodes']))" 2>/dev/null || echo '?') nodes) — delete graphify-out/ to force a rebuild"
else
  say "graph" "building (AST only, no API key) ..."
  graphify extract . --code-only >/dev/null
  say "graph" "built"
fi

echo
echo "  The graph GATES NOTHING. It is a lens: 'what depends on this' before a"
echo "  refactor, and the architectural hubs. It never settles a question a"
echo "  check can settle, and it cannot see module-level CONSTANTS at all —"
echo "  the half of this architecture doctrine 1 makes primary. See"
echo "  lyric-harness/MISSING.md M-76 for what was measured, including the"
echo "  advertised token saving that does not reproduce here."
