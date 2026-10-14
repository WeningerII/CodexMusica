#!/bin/bash
# one brief per (tree, flag) on the song; raw logs kept
V=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/verify-page-matrix-4
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
for T in wt-678 wt-base; do
  for F in "--returns=4,6" "--returns=4.end,6.end" "--returns=4.line,6.line" "--returns=4,6.head" "--returns=4.end,6" "--groups=4,6" "--groups=4.end,6.end"; do
    n=$(echo "$F" | tr -c 'A-Za-z0-9.,\n' '_')
    (cd $S/$T/lyric-harness && timeout 300 python3 lyric_harness.py brief $V/harness/song.txt "$F" > $V/harness/${T}_${n}.log 2>&1; echo "exit $?" >> $V/harness/${T}_${n}.log)
  done
done
