#!/bin/bash
SP=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad
ACC=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
POP=$ACC/slot_match_67889851/population.txt
run() { tag=$1; tree=$2; cd $tree/lyric-harness; s=$(date +%s); $SP/venv311/bin/python $ACC/slot_occurrence.py $SP/so3/so_$tag $POP $tree/lyric-harness > $SP/so3/so_$tag.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $SP/so3/so_$tag.done; }
run fce4bf0f $SP/wt-base &
run 67889851 $SP/wt-678 &
run 61b6618a $SP/wt-61b &
( cd $SP/wt-61b/lyric-harness; s=$(date +%s); $SP/venv311/bin/python $ACC/slot_binding.py $SP/so3/sb_v2tool_61b6618a.json $SP/wt-61b/lyric-harness > $SP/so3/sb_v2tool_61b.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $SP/so3/sb_v2tool_61b.done ) &
wait
