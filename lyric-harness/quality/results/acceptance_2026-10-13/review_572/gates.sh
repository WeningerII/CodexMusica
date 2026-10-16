#!/usr/bin/env bash
# run each gate in <tree>/lyric-harness; record rc + seconds; usage: gates.sh TREE OUTDIR PY
T=$1; O=$2; PY=$3; cd "$T/lyric-harness" || exit 9
run() { local name=$1; shift; local s=$(date +%s); timeout 2400 nice "$@" > "$O/$name.log" 2>&1; local rc=$?; printf '%-28s rc=%-3s %5ss  %s\n' "$name" "$rc" "$(( $(date +%s)-s ))" "$(tail -1 "$O/$name.log" | cut -c1-110)" | tee -a "$O/SUMMARY.txt"; }
run audit_verify_shape   $PY quality/audit_corpus.py --verify-shape
run mark_coverage        $PY quality/mark_coverage.py --check
run section_marks        $PY quality/section_marks.py --check
run corpus_manifest      $PY quality/corpus_manifest.py --check
run structure_census     $PY quality/structure_census.py --check
run length_curves        $PY quality/length_curve_calibration.py check
run comparator_pin       $PY quality/check_comparator_pin.py
run search_null          $PY quality/search_null.py --check
run capacity             $PY quality/capacity.py --check
run t_corpus_taxonomy    $PY quality/test_corpus_taxonomy.py
run t_corpus_audit       $PY quality/test_corpus_audit.py
run t_structure_census   $PY quality/test_structure_census.py
run t_section_marks      $PY quality/test_section_marks.py
run t_floor              $PY quality/test_floor.py
run t_readability        $PY quality/test_readability.py
run t_production_data    $PY quality/test_production_data.py
run t_relations          $PY quality/test_relations.py
run t_reader_legacy      $PY -m unittest quality.test_reader.LegacyReplay quality.test_reader.V1Frozen
run map_check            python3 map/build.py --check
echo DONE >> "$O/SUMMARY.txt"
