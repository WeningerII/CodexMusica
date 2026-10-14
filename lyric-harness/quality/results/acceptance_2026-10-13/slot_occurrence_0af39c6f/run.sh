#!/bin/bash
SP=<scratch>
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd $SP/wt-0af/lyric-harness
$SP/venv311/bin/python $ACC/slot_occurrence.py $SP/so0af/so_0af39c6f $ACC/slot_match_67889851/population.txt $SP/wt-0af/lyric-harness > $SP/so0af/run.log 2>&1; echo "exit=$?" > $SP/so0af/done
for k in 0 1 2 3; do $SP/venv311/bin/python $ACC/endpoint_guard_witness.py $SP/so0af/egw_0af39c6f_$k.json $SP/wt-0af/lyric-harness $k/4 > $SP/so0af/egw_$k.log 2>&1 & done; wait; echo done > $SP/so0af/egw.done
