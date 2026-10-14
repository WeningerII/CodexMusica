#!/bin/bash
# usage: run.sh <label> <tree: cand|base|main> <harness args...>
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad
V=$S/h678/verify-legacy-replay-exec-1
label=$1; tree=$2; shift 2
case $tree in cand) T=$S/wt-678;; base) T=$S/wt-base;; main) T=$S/wt-main;; esac
PY=$S/venv311/bin/python
cmd=(env -u LYRIC_CONTROL_TOKEN -u LYRIC_REQUEST_DEADLINE_MS -u LYRIC_CHECKPOINT_PATH LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data $PY lyric_harness.py "$@")
{ echo "### $label (tree=$tree $(git -C $T rev-parse --short HEAD))"; echo "cd $T/lyric-harness && $(printf '%q ' "${cmd[@]}")"; } >> $V/COMMANDS.txt
cd $T/lyric-harness
start=$(date +%s.%N)
"${cmd[@]}" > $V/out/$label.out 2> $V/out/$label.err
rc=$?
echo "  -> [$label] rc=$rc out=out/$label.out ($(echo "$(date +%s.%N) - $start" | bc)s)" >> $V/COMMANDS.txt
echo "$label rc=$rc"
