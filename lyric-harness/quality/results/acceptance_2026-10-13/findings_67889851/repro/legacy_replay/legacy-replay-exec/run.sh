#!/bin/bash
# usage: run.sh TREE(base|cand) LABEL [ENV=VAL ...] -- harness args...
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad
W=$S/h678/legacy-replay-exec
PY=$S/venv311/bin/python
TREE=$1
case "$1" in base) T=$S/wt-base;; cand) T=$S/wt-678;; *) echo bad tree; exit 99;; esac
LABEL=$2; shift 2
EXTRA=()
while [ "$1" != "--" ]; do EXTRA+=("$1"); shift; done
shift
cd $T/lyric-harness
start=$(date +%s.%N)
env -u LYRIC_CONTROL_TOKEN -u LYRIC_REQUEST_DEADLINE_MS -u LYRIC_CHECKPOINT_PATH \
  LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data "${EXTRA[@]}" \
  $PY lyric_harness.py "$@" > $W/out/$LABEL.out 2> $W/out/$LABEL.err
rc=$?
end=$(date +%s.%N)
echo $rc > $W/out/$LABEL.rc
{
  printf '### %s  (tree=%s, cwd=%s/lyric-harness, rc=%s, %.1fs)\n' "$LABEL" "$TREE" "$T" "$rc" "$(echo "$end - $start" | bc)"
  printf 'cd %q/lyric-harness && env -u LYRIC_CONTROL_TOKEN -u LYRIC_REQUEST_DEADLINE_MS -u LYRIC_CHECKPOINT_PATH LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data' "$T"
  for e in "${EXTRA[@]}"; do printf ' %q' "$e"; done
  printf ' %q lyric_harness.py' "$PY"
  for a in "$@"; do printf ' %q' "$a"; done
  printf '\n  -> stdout %s/out/%s.out ; stderr .err ; rc %s\n\n' "$W" "$LABEL" "$rc"
} >> $W/COMMANDS.txt
echo "rc=$rc"
