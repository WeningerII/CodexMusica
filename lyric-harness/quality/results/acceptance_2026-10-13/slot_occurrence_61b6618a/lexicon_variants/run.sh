#!/bin/bash
SP=<scratch>
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
POP=$ACC/slot_match_67889851/population.txt
cd $SP/wt-61b/lyric-harness
one() { tag=$1; shift; s=$(date +%s); $SP/venv311/bin/python $ACC/slot_occurrence.py $SP/so33/so_61b6618a_$tag $POP $SP/wt-61b/lyric-harness "$@" > $SP/so33/$tag.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $SP/so33/$tag.done; }
sw() { k=$1; s=$(date +%s); $SP/venv311/bin/python $ACC/endpoint_guard_witness.py $SP/egw33/egw_61b6618a_$k.json $SP/wt-61b/lyric-harness $k/4 > $SP/egw33/egw_$k.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $SP/egw33/egw_$k.done; }
( sw 0; one default ) &
( sw 1; one fb_low --lexicons=fb_low ) &
( sw 2; one fb_high --lexicons=fb_high ) &
( sw 3; one decl --lexicons=decl; one supp_none --lexicons=supp_none; one voices_fresh --lexicons=voices_fresh ) &
wait
