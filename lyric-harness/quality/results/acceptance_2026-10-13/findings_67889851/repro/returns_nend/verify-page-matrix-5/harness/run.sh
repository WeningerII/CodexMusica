#!/bin/bash
# usage: run.sh <tree> <tag>
D=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/verify-page-matrix-5/harness
T=$1; TAG=$2
cd $T/lyric-harness || exit 1
i=0
while IFS=$'\t' read -r flag val; do
  i=$((i+1))
  out=$D/${TAG}_$i.log
  echo "### $flag=$val" > $out
  LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data timeout 300 python3 lyric_harness.py brief $D/song8.txt "--$flag=$val" >> $out 2>&1
  echo "exit=$?" >> $out
done < $D/cases.tsv
