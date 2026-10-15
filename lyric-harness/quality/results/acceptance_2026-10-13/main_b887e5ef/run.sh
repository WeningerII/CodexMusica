#!/bin/bash
SP=<scratch>
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd $SP/wt-main2/lyric-harness
$SP/venv311/bin/python $ACC/slot_occurrence.py $SP/sob887/so_b887e5ef $ACC/slot_match_67889851/population.txt $SP/wt-main2/lyric-harness > $SP/sob887/run.log 2>&1; echo "exit=$?" > $SP/sob887/done
for k in 0 1 2 3; do $SP/venv311/bin/python $ACC/endpoint_guard_witness.py $SP/sob887/egw_b887e5ef_$k.json $SP/wt-main2/lyric-harness $k/4 > $SP/sob887/egw_$k.log 2>&1 & done; wait; echo done > $SP/sob887/egw.done
cd <scratch>/wt-main2/lyric-harness && LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data $SP/venv311/bin/python quality/results/named_place_lookup_2026-10-14/measure.py > <scratch>/a2_b887/a_measure_stdout.json 2> <scratch>/a2_b887/a_measure_stderr.txt; echo "exit=$?" > <scratch>/a2_b887/done
