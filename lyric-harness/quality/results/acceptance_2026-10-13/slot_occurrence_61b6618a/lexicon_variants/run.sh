#!/bin/bash
SP=<scratch>
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
POP=$ACC/slot_match_67889851/population.txt
cd $SP/wt-61b/lyric-harness
one() { tag=$1; shift; s=$(date +%s); $SP/venv311/bin/python $ACC/slot_occurrence.py $SP/so32/so_61b6618a_$tag $POP $SP/wt-61b/lyric-harness "$@" > $SP/so32/$tag.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $SP/so32/$tag.done; }
( one default; one fb_low --lexicons=fb_low; one voices_fresh --lexicons=voices_fresh ) &
( one decl --lexicons=decl; one fb_high --lexicons=fb_high; one supp_none --lexicons=supp_none ) &
wait
