#!/bin/bash
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; F=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/zero-anchor-end; POP=/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13/slot_match_67889851/population.txt; CR=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/so3/skeptic-counterexamples/lines.json
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
run() { tag=$1; root=$2; cd $root; s=$(date +%s); $S/venv311/bin/python -I $F/scripts/endmatrix.py $root $F/out/em_$tag.jsonl.gz $POP $CR > $F/out/em_$tag.log 2>&1; echo "exit=$? secs=$(( $(date +%s)-s ))" > $F/out/em_$tag.done; }
run 0af $S/wt-0af/lyric-harness &
run 695 $S/wt-695/lyric-harness &
run trev $F/trees/trev &
run t3e77 $F/trees/t3e77 &
run 61b $S/wt-61b/lyric-harness &
# (678 has no lex keyword on swap_at_slot; the skeptic's end_678 dump is used instead)
wait
