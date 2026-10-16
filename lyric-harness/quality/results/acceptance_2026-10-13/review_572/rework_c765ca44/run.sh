#!/usr/bin/env bash
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
PY=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python; O=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572r
run() { local n=$1; shift; local s=$(date +%s); timeout 3600 nice "$@" > "$O/$n.log" 2>&1; local rc=$?; printf '%-22s rc=%-3s %5ss  %s\n' "$n" "$rc" "$(( $(date +%s)-s ))" "$(tail -1 $O/$n.log | cut -c1-110)" >> $O/SUMMARY.txt; }
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-fcef2/lyric-harness && run recapture $PY /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q572/recapture.py . $O/fixture_c765.json $O/recap_c765.json
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-c765/lyric-harness
run map_check python3 map/build.py --check
run comparator_pin $PY quality/check_comparator_pin.py
run curves_rows $PY quality/length_curve_calibration.py check --rows ../docs/evidence/m25-unqualified-2026-10-15/measurement/current-calibration-rows.tsv
run t_floor $PY quality/test_floor.py
run t_plan $PY quality/test_plan.py
run t_reader_legacy $PY -m unittest quality.test_reader.LegacyReplay quality.test_reader.V1Frozen
run t_loop $PY quality/test_loop.py
echo DONE >> $O/SUMMARY.txt
