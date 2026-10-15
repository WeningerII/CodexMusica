#!/bin/bash
# usage: run.sh NAME WORKDIR CMD...
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; C=$S/check564
name=$1; wd=$2; shift 2
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data TMPDIR=$C/tmp PYTHONDONTWRITEBYTECODE=1
log=$C/$name.log
start=$(date -u +%Y-%m-%dT%H:%M:%SZ); s0=$(date +%s)
{ echo "# cwd: $wd"; echo "# cmd: $*"; echo "# start: $start"; } > $log
cd "$wd" && timeout 1500 "$@" >> $log 2>&1; rc=$?
end=$(date -u +%Y-%m-%dT%H:%M:%SZ); s1=$(date +%s)
echo "# end: $end rc: $rc duration_s: $((s1-s0))" >> $log
echo "$name rc=$rc start=$start end=$end dur=$((s1-s0))s" >> $C/summary.txt
