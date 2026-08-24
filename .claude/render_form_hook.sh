#!/usr/bin/env bash
# STOP HOOK — the section apparatus may not leave this session flattened.
#
# `quality/plan.py:section_header` is the ONE builder for a section bracket
# and it puts the line count, the bar count, the METER and the pickup INSIDE
# it. `test_plan.py` §6 gates the renderer; `test_songs.py` gates the shipped
# file. NEITHER CAN READ A MESSAGE, which is where the flattening kept
# happening — `[INTRO — 2 lines — 2 bars of 8/8, one-beat pickup]` retyped as
# `[INTRO]`, repeatedly, because nothing could see it.
#
# A Stop hook is handed the TRANSCRIPT. That is the jurisdiction the tree
# does not have. Exit 2 blocks the turn and feeds stderr back as the reason.
set -uo pipefail
payload=$(cat)
transcript=$(printf '%s' "$payload" | python3 -c \
  'import json,sys; print((json.load(sys.stdin) or {}).get("transcript_path",""))' 2>/dev/null)
active=$(printf '%s' "$payload" | python3 -c \
  'import json,sys; print((json.load(sys.stdin) or {}).get("stop_hook_active",False))' 2>/dev/null)

# BLOCK ONCE, NEVER LOOP. `stop_hook_active` is true on a turn that is already
# a response to this hook; refusing again there would trap the session.
[ "$active" = "True" ] && exit 0
[ -z "$transcript" ] && exit 0
[ -f "$transcript" ] || exit 0

out=$(python3 "$CLAUDE_PROJECT_DIR/lyric-harness/quality/check_render_form.py" \
      --transcript "$transcript" 2>&1)
rc=$?
if [ $rc -ne 0 ]; then
  printf '%s\n' "$out" >&2
  exit 2
fi
exit 0
