#!/bin/bash
SP=<scratch>
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd $SP/wt-61b/lyric-harness
N=${1:-6}
for k in $(seq 0 $((N-1))); do
  ( s=$(date +%s); $SP/venv311/bin/python $ACC/endpoint_guard_witness.py $SP/egw/egw_61b6618a_$k.json $SP/wt-61b/lyric-harness $k/$N > $SP/egw/egw_$k.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $SP/egw/egw_$k.done ) &
done
wait
