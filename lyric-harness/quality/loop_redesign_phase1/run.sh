#!/bin/bash
# usage: run.sh TAG STATEFILE -- cmd...   ; appends one row to measure.tsv
S=/tmp/claude-0/-home-user-CodexMusica/6517c01f-1c45-5a7f-8ca2-ee4b0bfeaa6a/scratchpad/p1
tag=$1; st=$2; shift 3
cd /home/user/CodexMusica/lyric-harness
t0=$(date +%s.%N)
python3 lyric_harness.py "$@" > $S/out_$tag.txt 2> $S/err_$tag.txt
rc=$?
t1=$(date +%s.%N)
ob=$(wc -c < $S/out_$tag.txt); sb=$( [ -f "$st" ] && wc -c < "$st" || echo 0)
printf "%s\t%s\t%.1f\t%s\t%s\n" "$tag" "$rc" "$(echo "$t1-$t0"|bc)" "$ob" "$sb" | tee -a $S/measure.tsv
