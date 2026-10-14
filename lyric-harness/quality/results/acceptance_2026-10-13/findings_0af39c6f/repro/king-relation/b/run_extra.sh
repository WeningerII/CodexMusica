#!/bin/bash
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; K=$S/h0af/king-relation
PY=$S/venv311/bin/python; export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
G5="1,4;5,8;9,12;13,16;17,20"
run() { # tag tree flags draft groups rel
  local tag=$1 T=$2 F=$3 D=$4 G=$5 R=$6; local O=$K/b/out/extra; mkdir -p $O
  local RA=(); [ -n "$R" ] && RA=("--relation=schema:$R rhyme")
  echo "cd $T/lyric-harness && \$PY lyric_harness.py $F brief $D --groups=$G ${RA[*]:+\"${RA[*]}\"} > $O/$tag.out" >> $O/CMDS.txt
  ( cd $T/lyric-harness && $PY lyric_harness.py $F brief $D --groups=$G "${RA[@]}" > $O/$tag.out 2>&1; echo "exit=$?" > $O/$tag.exit ) &
  while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 1; done
}
for tr in 0af 695; do T=$S/wt-$tr
  for rel in broken perfect ""; do run five_${tr}_v2_${rel:-none} $T --reader-scheme=v2 $K/b/five.txt "$G5" "$rel"; done
  for rel in broken perfect; do run ctl_${tr}_v2_$rel $T --reader-scheme=v2 $K/b/controls.txt "$G5" "$rel"; done
  for rel in broken perfect; do run ctl_${tr}_fbhigh_$rel $T --fallback=high $K/b/controls.txt "$G5" "$rel"; done
  for rel in broken perfect; do run wh_${tr}_v1sup_$rel $T "--reader-scheme=v1 --lexicon-supplement=v2" $K/b/windhover.txt 1,4 "$rel"; done
done
for rel in broken perfect; do run five_0af_fbhigh_$rel $S/wt-0af --fallback=high $K/b/five.txt "$G5" "$rel"; run five_0af_sup_$rel $S/wt-0af --lexicon-supplement=v2 $K/b/five.txt "$G5" "$rel"; done
wait
for tr in 0af 695; do for sc in v1 v2; do (cd $S/wt-$tr/lyric-harness && $PY lyric_harness.py --reader-scheme=$sc types king- -- wing > $K/b/out/extra/types_${tr}_$sc.out 2>&1); done; done
