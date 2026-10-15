#!/bin/bash
# SlotBinding + LoopSwaps on: t0af (pristine 0af), t3e77 (exact 3e77), trev (behavioural revert), then each ablation in tA/tB
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; F=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/zero-anchor-end
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
t() { tag=$1; root=$2; cd $root; { time $S/venv311/bin/python quality/test_reader.py -v SlotBinding LoopSwaps; echo "rc=$?"; } > $F/tests/slot_$tag.log 2>&1; }
t 0af $F/trees/t0af &
t trev $F/trees/trev &
wait
t t3e77 $F/trees/t3e77
abl() { tree=$1; shift; for n in "$@"; do cp $F/variants/$n.py $F/trees/$tree/quality/loop.py; find $F/trees/$tree/quality -name __pycache__ -prune -exec rm -rf {} + ; t abl_$n $F/trees/$tree; done; cp $S/wt-0af/lyric-harness/quality/loop.py $F/trees/$tree/quality/loop.py; }
abl tA z1_zero_anchor_accepts a3_word_material_off a7_endpoint_pieces_check_off &
abl tB a1_endpoint_check_off a3e_end_word_material_off &
wait
echo ALLDONE > $F/tests/slot_done.txt
