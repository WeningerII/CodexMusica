#!/bin/bash
# usage: run_brief.sh <tree> <tag> <returns>
V=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h678/verify-page-matrix-3
cd $1/lyric-harness && LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data timeout 600 python3 lyric_harness.py brief $V/harness/song.txt "--returns=$3" > $V/harness/brief_$2_$(echo "$3" | tr ',;.' '__-').log 2>&1; echo "exit=$?" >> $V/harness/brief_$2_$(echo "$3" | tr ',;.' '__-').log
