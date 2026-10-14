#!/bin/bash
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/harness-misc/t1
N="meter meterlow api gradesup gradeplain gradevoices gradepron"
A=""; for n in $N; do A="$A $n@v2"; done; for n in $N; do A="$A $n@v1"; done
B=""; for n in $N; do B="$B $n@v1"; done; for n in $N; do B="$B $n@v2"; done
mkdir -p cold
( python3 cachetest.py /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678 warm_v2_then_v1.json $A > warmA.log 2>&1 ) &
( python3 cachetest.py /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678 warm_v1_then_v2.json $B > warmB.log 2>&1 ) &
wait
for s in v2 v1; do for n in $N; do echo $n@$s; done; done | xargs -P3 -I{} sh -c "python3 cachetest.py /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678 cold/{}.json {} > cold/{}.log 2>&1"
echo done
