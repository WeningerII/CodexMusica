#!/usr/bin/env bash
# install_freshness_guard.sh — put the freshness guard somewhere the rewind
# cannot reach. Idempotent; safe to re-run.
#
# THE HOLE THIS CLOSES, and it was found by TESTING the guard rather than by
# reasoning about it. `.claude/freshness_hook.sh` is registered in the repo's
# own settings and is therefore INSIDE the thing it guards: rewind the tree to
# a commit that predates the guard and the guard is deleted by the very event
# it exists to catch. Measured — a staged rewind to 1206fe25 left
# `bash: .claude/freshness_hook.sh: No such file or directory`, exit 127, and
# the stale tree standing.
#
# `$HOME/.claude/` survives, and that is not an assumption: it carried
# CLAUDE.md, `session-start-git-identity.sh` and `stop-hook-git-check.sh`
# through all five reverts of 2026-08-31 untouched. So the durable copy lives
# there and depends on NOTHING in the repository — a full copy, never a
# symlink into a tree that may vanish.
#
# THIS IS THE `setup-graphify.sh` PATTERN AND IT CARRIES THAT PATTERN'S OWN
# RISK, stated rather than discovered later: the installed copy is a SNAPSHOT.
# Edit `scripts/freshness_guard.sh` and the installed one is stale until this
# is re-run, which is the same defect one layer out. The installed hook prints
# a divergence notice when the two differ, so the copy cannot rot in silence.
set -euo pipefail
repo=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
dest="$HOME/.claude"
mkdir -p "$dest"
install -m 0755 "$repo/scripts/freshness_guard.sh" "$dest/freshness_guard.sh"

cat > "$dest/freshness_hook.sh" <<'HOOK'
#!/usr/bin/env bash
# DURABLE freshness hook — installed by scripts/install_freshness_guard.sh.
# Lives outside the repository on purpose: a guard inside the tree is deleted
# by the rewind it guards against. Prefers the repo's copy (which may be
# newer) and falls back to this installed one when the tree has eaten it.
set -uo pipefail
proj="${CLAUDE_PROJECT_DIR:-}"
[ -n "$proj" ] || exit 0
[ -d "$proj/.git" ] || exit 0
mine="$HOME/.claude/freshness_guard.sh"
theirs="$proj/scripts/freshness_guard.sh"
if [ -f "$theirs" ]; then
  cmp -s "$mine" "$theirs" || echo "NOTE: the installed freshness guard differs from the repo's — re-run scripts/install_freshness_guard.sh"
  ( cd "$proj" && bash "$theirs" --restore --quiet 2>&1 ) || true
else
  ( cd "$proj" && bash "$mine" --restore --quiet 2>&1 ) || true
fi
exit 0
HOOK
chmod 0755 "$dest/freshness_hook.sh"

python3 - "$dest/launcher-settings.json" <<'PY'
import json, os, sys
p = sys.argv[1]
cfg = json.load(open(p)) if os.path.exists(p) else {}
hooks = cfg.setdefault("hooks", {})
ups = hooks.setdefault("UserPromptSubmit", [])
cmd = "~/.claude/freshness_hook.sh"
if not any(h.get("command") == cmd for e in ups for h in e.get("hooks", [])):
    ups.append({"hooks": [{"type": "command", "command": cmd}]})
    json.dump(cfg, open(p, "w"), indent=1); open(p, "a").write("\n")
    print("  registered UserPromptSubmit ->", cmd)
else:
    print("  already registered ->", cmd)
PY
echo "  installed $dest/freshness_guard.sh + freshness_hook.sh"
