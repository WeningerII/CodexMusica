#!/usr/bin/env bash
export LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data
PY=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python; O=/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/q574; SHA=bec6e6ddf8522b1f6ffc01bea806ef1ddb71584b2f8630670e8538de4c52fc51
run() { local n=$1; shift; local s=$(date +%s); timeout 3600 nice "$@" > "$O/$n.log" 2>&1; local rc=$?; printf '%-22s rc=%-3s %5ss  %s\n' "$n" "$rc" "$(( $(date +%s)-s ))" "$(tail -1 $O/$n.log | cut -c1-100)" >> $O/SUMMARY.txt; }
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-574/lyric-harness
run map_check python3 map/build.py --check
run comparator_pin $PY quality/check_comparator_pin.py
run blank_probe $PY /home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13/probes/blank_guard/blank_probe.py . $O/blank.json
run edge_probe $PY /home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13/probes/blank_guard/edge_probe.py . $O/edge.json
for t in 574 6eaa; do cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-$t/lyric-harness; rm -f $O/st_$t.json; run revise_cli_$t $PY lyric_harness.py --lexicon-supplement=v2 --lexicon-supplement-sha256=$SHA revise $O/draft.txt AAAA --relation=class:RHYME --propose=defer:$O/st_$t.json --attempts=1 --backtrack=0; done
cd /tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-574/lyric-harness
run t_relations $PY quality/test_relations.py
run t_reader_legacy $PY -m unittest quality.test_reader.LegacyReplay quality.test_reader.V1Frozen
run t_revise $PY quality/test_revise.py
run t_loop $PY quality/test_loop.py
echo DONE >> $O/SUMMARY.txt
