#!/bin/bash
SP=<scratch>
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd $SP/wt-8ea/lyric-harness
$SP/venv311/bin/python $ACC/slot_occurrence.py $SP/so8ea/so_8ea94ac9 $ACC/slot_match_67889851/population.txt $SP/wt-8ea/lyric-harness > $SP/so8ea/run.log 2>&1; echo "exit=$?" > $SP/so8ea/done
for k in 0 1 2 3; do $SP/venv311/bin/python $ACC/endpoint_guard_witness.py $SP/so8ea/egw_8ea94ac9_$k.json $SP/wt-8ea/lyric-harness $k/4 > $SP/so8ea/egw_$k.log 2>&1 & done; wait; echo done > $SP/so8ea/egw.done
