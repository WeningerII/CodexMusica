#!/usr/bin/env bash
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
T=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-572m/lyric-harness; O=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/merge; PY=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python; cd $T
run() { local n=$1; shift; local s=$(date +%s); timeout 3600 nice "$@" > "$O/$n.log" 2>&1; local rc=$?; printf '%-22s rc=%-3s %5ss  %s\n' "$n" "$rc" "$(( $(date +%s)-s ))" "$(tail -1 $O/$n.log | cut -c1-100)" >> $O/SUMMARY.txt; }
run map_check python3 map/build.py --check
run comparator_pin $PY quality/check_comparator_pin.py
run t_floor $PY quality/test_floor.py
run t_reader_legacy $PY -m unittest quality.test_reader.LegacyReplay quality.test_reader.V1Frozen
run t_readability $PY quality/test_readability.py
run t_relations $PY quality/test_relations.py
run t_loop $PY quality/test_loop.py
echo DONE >> $O/SUMMARY.txt
