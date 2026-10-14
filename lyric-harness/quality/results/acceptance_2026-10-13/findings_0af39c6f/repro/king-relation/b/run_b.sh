#!/bin/bash
# usage: run_b.sh DRAFT TAG GROUPS  -- runs the brief matrix on base, 695, 0af; out -> $K/b/out/TAG/
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; K=$S/h0af/king-relation
PY=$S/venv311/bin/python; export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
DRAFT=$1; TAG=$2; GRP=$3; SKIP_V1_BROKEN=${4:-0}
O=$K/b/out/$TAG; mkdir -p $O
jobs_list=()
for tree in base 695 0af; do
  case $tree in base) T=$S/wt-base; cfgs="default fbhigh sup";; 695) T=$S/wt-695; cfgs="default v1 v2 fbhigh sup";; 0af) T=$S/wt-0af; cfgs="default v1 v2 fbhigh sup";; esac
  for cfg in $cfgs; do
    case $cfg in default) F="";; v1) F="--reader-scheme=v1";; v2) F="--reader-scheme=v2";; fbhigh) F="--fallback=high";; sup) F="--lexicon-supplement=v2";; esac
    for rel in broken perfect none; do
      if [ "$SKIP_V1_BROKEN" = 1 ] && [ $rel = broken ] && { [ $cfg = v1 ] || [ $tree = base ]; }; then continue; fi
      case $rel in broken) R=("--relation=schema:broken rhyme");; perfect) R=("--relation=schema:perfect rhyme");; none) R=();; esac
      echo "cd $T/lyric-harness && \$PY lyric_harness.py $F brief $DRAFT --groups=$GRP ${R[*]:+\"${R[*]}\"} > $O/${tree}_${cfg}_${rel}.out" >> $O/CMDS.txt
      ( cd $T/lyric-harness && $PY lyric_harness.py $F brief $DRAFT --groups=$GRP "${R[@]}" > $O/${tree}_${cfg}_${rel}.out 2>&1; echo "exit=$?" >> $O/${tree}_${cfg}_${rel}.exit ) &
      while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 1; done
    done
  done
done
wait
