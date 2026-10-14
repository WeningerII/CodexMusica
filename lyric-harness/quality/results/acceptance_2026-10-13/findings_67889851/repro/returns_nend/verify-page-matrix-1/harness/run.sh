#!/bin/bash
# brief over the values the page sent, on the candidate harness and the pre-batch harness
D=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/verify-page-matrix-1
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
i=0
while IFS='|' read -r tag flag val; do
  [ -z "$tag" ] && continue
  for t in wt-678 wt-base; do
    out=$D/harness/${tag}_${t}.log
    ( cd $S/$t/lyric-harness && echo "\$ cd $S/$t/lyric-harness && LYRIC_STAGED_DATA=$LYRIC_STAGED_DATA python3 lyric_harness.py brief $D/harness/song8.txt '--$flag=$val'" && python3 lyric_harness.py brief $D/harness/song8.txt "--$flag=$val"; echo "exit=$?" ) > $out 2>&1
  done
done <<'CASES'
U6|groups|1.head (kept),6
U7|groups|1.T4 (carried across the word-cut change),6
U8|returns|1.head (numbered under the earlier cut),6.head
U12|groups|1,6 — cut
X1|groups|1.T4 (kept),8.T5
X1v1|groups|1.T4,8.T4
X1strip|groups|1.T4,8.T5
C4|groups|1.foo,6
C1|groups|1.head,6
CASES
