#!/bin/bash
# Full loop-touching suites on ttrip (0af + tripwire logging; behaviour unchanged). One job per line of jobs.
S=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad; F=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/zero-anchor-end
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
job() { name=$1; file=$2; shardvar=$3; shard=$4; cd $F/trees/R_trip/lyric-harness
  if [ -n "$shardvar" ]; then export $shardvar=$shard; fi
  s=$(date +%s); TRIPWIRE_LOG=$F/tests/trip/$name.jsonl $S/venv311/bin/python quality/$file.py > $F/tests/trip/$name.log 2>&1; rc=$?
  echo "$name rc=$rc secs=$(( $(date +%s)-s ))" >> $F/tests/trip/done.txt; }
export -f job; export S F
cat <<JOBS | xargs -P ${P:-3} -L 1 bash -c 'job $0 $1 $2 $3'
reader test_reader
revise1 test_revise TEST_REVISE_SHARD 1/4
revise2 test_revise TEST_REVISE_SHARD 2/4
revise3 test_revise TEST_REVISE_SHARD 3/4
revise4 test_revise TEST_REVISE_SHARD 4/4
loop1 test_loop TEST_LOOP_SHARD 1/2
loop2 test_loop TEST_LOOP_SHARD 2/2
loop_redesign test_loop_redesign
production_revision test_production_revision
propose test_propose
pronunciation_choices test_pronunciation_choices
audit_regressions test_audit_regressions
floor_window test_floor_window
gate_census test_gate_census
homeoteleuton test_homeoteleuton
production_journal test_production_journal
songs_log test_songs_log
verbs1 test_verbs TEST_VERBS_SHARD 1/3
verbs2 test_verbs TEST_VERBS_SHARD 2/3
verbs3 test_verbs TEST_VERBS_SHARD 3/3
JOBS
echo ALLDONE >> $F/tests/trip/done.txt
