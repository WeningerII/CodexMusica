#!/usr/bin/env bash
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-572/lyric-harness
s=$(date +%s)
for shard in 1 2 3 4; do
  ( nice /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python quality/length_curve_calibration.py compute --shard "$shard/4" --cache-path "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/memo-$shard-of-4.tsv" --out "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/rows-$shard-of-4.tsv" > "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/compute-$shard.log" 2>&1; echo $? > "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/compute-$shard.rc" ) &
done
wait
echo "compute wall $(( $(date +%s)-s ))s" > /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/compute_wall.txt
/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python quality/length_curve_calibration.py check --rows /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/rows-*-of-4.tsv > /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/check.log 2>&1; echo $? > /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/check.rc
echo DONE > /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/cal/DONE
