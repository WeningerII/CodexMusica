#!/usr/bin/env bash
# Phase A: ping runs (RSS, cleanup cost, outputs); base and head run as a concurrent pair, 3 reps per cell.
# Phase B: back-to-back turnaround (noping), strictly sequential, base/head interleaved, 3 reps per cell.
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd $Q578
for cell in "24 20260910" "24 20260908"; do set -- $cell
  for r in 1 2 3; do
    python3 drive2.py $SCRATCH/wt-578b $2 $1 runs/ping_base_$1_$2_r$r.json ping > runs/ping_base_$1_$2_r$r.log 2>&1 &
    python3 drive2.py $SCRATCH/wt-578  $2 $1 runs/ping_head_$1_$2_r$r.json ping > runs/ping_head_$1_$2_r$r.log 2>&1 &
    wait
  done
done
for r in 1 2 3; do for cell in "24 20260910" "24 20260908"; do set -- $cell
  if [ $r = 2 ]; then order="head base"; else order="base head"; fi
  for t in $order; do tree=$SCRATCH/wt-578b; [ $t = head ] && tree=$SCRATCH/wt-578
    python3 drive2.py $tree $2 $1 runs/seq_${t}_$1_$2_r$r.json noping > runs/seq_${t}_$1_$2_r$r.log 2>&1
  done; done; done
echo DONE > runs/DONE
