#!/bin/bash
# usage: run.sh NAME TREE(base|cand) [ENV=.. ...] -- args...
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad
D=$S/h678/verify-legacy-replay-exec-0
PY=$S/venv311/bin/python
name=$1; tree=$2; shift 2
case $tree in base) T=$S/wt-base;; cand) T=$S/wt-678;; *) echo bad tree; exit 9;; esac
envs=()
while [ "$1" != "--" ]; do envs+=("$1"); shift; done; shift
cmd=(env -u LYRIC_CONTROL_TOKEN -u LYRIC_REQUEST_DEADLINE_MS -u LYRIC_CHECKPOINT_PATH LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data "${envs[@]}" $PY lyric_harness.py "$@")
t0=$(date +%s.%N)
(cd $T/lyric-harness && "${cmd[@]}") > $D/out/$name.out 2> $D/out/$name.err
rc=$?
echo $rc > $D/out/$name.rc
{ echo "### $name (tree=$tree rc=$rc)"; printf 'cd %q && ' "$T/lyric-harness"; printf '%q ' "${cmd[@]}"; echo; echo "  -> out/$name.out .err rc=$rc"; echo; } >> $D/COMMANDS.txt
echo "$name rc=$rc"
