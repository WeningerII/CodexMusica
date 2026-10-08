#!/bin/bash
# grade.sh N : plan, fill, song for the N-line fixture draft; logs wall time
S=/tmp/claude-0/-home-user-CodexMusica/6517c01f-1c45-5a7f-8ca2-ee4b0bfeaa6a/scratchpad/p1; n=$1
cd /home/user/CodexMusica/lyric-harness
python3 lyric_harness.py plan --seed=1 --lines=$n --out=$S/plan$n.json >/dev/null
python3 lyric_harness.py plan --seed=1 --lines=$n --fill=$S/d$n.txt --out=$S/bp$n.json >/dev/null
args=$(python3 -c "import json;p=json.load(open('$S/plan$n.json'));print(' '.join(f'--{k}={p[k]}' for k in ('groups','returns','relation') if p.get(k)))")
t0=$(date +%s.%N)
python3 lyric_harness.py song $S/bp$n.json $S/d$n.txt $args > $S/grade$n.txt 2>&1; rc=$?
t1=$(date +%s.%N)
printf "grade\t%s\trc=%s\t%.1f s\t%s bytes\n" $n $rc $(echo "$t1-$t0"|bc) $(wc -c < $S/grade$n.txt) | tee -a $S/measure.tsv
