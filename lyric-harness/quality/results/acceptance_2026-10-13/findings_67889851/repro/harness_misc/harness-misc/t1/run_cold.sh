#!/bin/bash
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/harness-misc/t1
N="meter meterlow api gradesup gradeplain gradevoices gradepron"
for s in v2 v1; do for n in $N; do echo $n@$s; done; done | xargs -P3 -I{} sh -c "python3 cachetest.py /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678 cold/{}.json {} > cold/{}.log 2>&1"
mkdir -p cold2
for r in gradesup@v2 gradesup@v1 api@v1; do python3 cachetest.py /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-678 cold2/$r.json $r > cold2/$r.log 2>&1; done
echo done
