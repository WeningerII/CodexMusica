set -e
# FOUR AT A TIME, 2026-08-18. These are 49 independent PROCESSES
# and they ran strictly serially — ~25 of the ~35 minutes every
# push cost. The runner has 4 vCPUs and the env above already pins
# each suite's math to one thread, so width-4 moves no number in
# any suite; only the wall clock moves. Each suite prints its own
# banner and verdict (output interleaves, and that is the price);
# a failing suite touches the marker inside its own subshell (the
# group's exit is the `touch`'s 0, so the throttle's `wait -n`
# never trips `set -e` for it) and the LAST line is the gate: the
# step fails if ANY suite failed, never silently.
rm -f /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/failed.txt
rm -rf /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/logs && mkdir -p /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/logs
# THE TWO GIANTS GET A RUNNER EACH, and the list is now ordered by
# MEASURED COST — 2026-09-01, from a full timing of all 76 suites
# run four-wide, the same shape this loop runs them in:
#
#   plan 870s   capacity 698s   relations_null 261s   songs_record 211s
#   screen 194s   g2p 167s   spans 140s   readability 138s
#   ...and every remaining suite under 102s. TOTAL 3,763 CPU-s.
#
# THE RESIDUE SPLIT WAS EXACTLY-ONCE AND BALANCED BY ACCIDENT. It
# deals suites out by their position in a list whose order was
# chronological, and cost is not — measured on run #1197 the four
# shards came out 18m33 / 4m56 / 2m59 / 11m46, and a job's wall is
# its WORST shard, so two runners idled while one ran nearly seven
# times the shortest. Ordering the list by cost fixes the DEALING.
#
# IT DOES NOT FIX THE FLOOR, AND MORE SHARDS CANNOT EITHER: no
# split beats the longest single item, and `plan` (870s) plus
# `capacity` (698s) are 42% of the whole pool between them. Cost
# ordering alone leaves `plan` sitting in one lane of a four-lane
# shard with three lanes idle beside it for a quarter of an hour.
# So the two of them come OUT of the pool: shard 1 runs `plan` and
# nothing else, shard 2 runs `capacity` and nothing else, and the
# remaining 74 (2,194 CPU-s) are dealt across the rest. `plan`
# parallelises internally and gets TEST_PLAN_WORKERS=4 when it owns
# the runner -- which is also the bug this closes, because in the
# pool it forked four workers INSIDE a four-wide loop, eight
# processes on four vCPUs, dragging down whatever shared its shard.
#
# PROJECTED, from the measurements above: 691s / 698s / 293s / 255s
# against a measured 1113 / 296 / 179 / 706. The wall is `capacity`
# now, and a fifth shard would buy NOTHING -- the pool is already
# under it at 293s. That is why the count stays at four: the next
# win is splitting `capacity`, not dealing the same cards thinner.
# NO SOLOS SINCE 2026-09-05 (`MISSING.md` M-244): `plan` and
# `capacity` are their own dealt matrix jobs now (`plan`,
# `capacity` below), each cut by section through the one idiom in
# `quality/shard.py`, so the whole pool here is dealt by residue
# over three runners. The solo machinery stays, at zero, because
# the next suite that outgrows a lane is a one-word change here.
SOLO=""
_nsolo=0
_mine=""
_solo_on=0
_pool_n=${SUITES_SHARDS:-1}
_pool_k=${SUITES_SHARD:-1}
if [ "${SUITES_SHARDS:-1}" -gt "$_nsolo" ]; then
  _solo_on=1
  if [ "${SUITES_SHARD:-1}" -le "$_nsolo" ]; then
    _mine=$(echo $SOLO | cut -d' ' -f"${SUITES_SHARD:-1}")
  fi
  _pool_n=$(( ${SUITES_SHARDS:-1} - _nsolo ))
  _pool_k=$(( ${SUITES_SHARD:-1} - _nsolo ))
fi
echo "shard ${SUITES_SHARD:-1}/${SUITES_SHARDS:-1}:" \
     "solo='${_mine:-none}' pool=${_pool_k}/${_pool_n}"
for f in relations_null songs_record screen g2p spans readability \
         recover replay_memo grid propose gate_census floor fwer homograph \
         mut_oracle msa_fin corpus_audit provenance homeoteleuton null_shapes \
         phrase_commonplace mandate_relation meter_bands sentencehood \
         fit nc_census structure_census placement structures align slots \
         relations crosslinguistic capabilities declared_inputs door_census \
         suite_sweep ltc songs_log cym positive_control song_function \
         chance_rate time_layer readings_seam narrative pin_sweep taxonomy \
         section_marks phonology nucleus corpus_taxonomy mut_band coda \
         band relation_shapes matrix render_form verify_entries register_audit \
         phon_msa mandate_language phon_fas phon_non phon_san staging \
         controls data_row_claims english_text meter verify_figures expected_drift \
         ipa songs ban_convergence cross_song brief_provenance shard \
         battery_rounds audit_regressions production_harness production_relations \
         production_revision production_data production_journal candidate_pair_projection capacity_receipt floor_window; do
  # SHARDED ACROSS RUNNERS, 2026-09-01. The list above is already
  # run FOUR-WIDE on one runner (below), so this job was 5,612
  # CPU-s packed into 4 lanes = 1,403s wall — the measured
  # critical path of the whole workflow. Residue selection is
  # `test_verbs`' own idiom and carries its guarantee: every suite
  # runs EXACTLY ONCE across a full k=1..n matrix by the
  # arithmetic of the residue classes, not by review. Unset runs
  # everything, byte-identical to the pre-shard job.
  # A SOLO SUITE RUNS ONLY ON ITS OWN SHARD, and a solo shard
  # runs ONLY that suite. Everything else is dealt by residue over
  # the REMAINING shards, which keeps the guarantee the residue
  # split was chosen for: every suite runs EXACTLY ONCE across a
  # full k=1..n matrix by arithmetic, not by review. With
  # SUITES_SHARDS unset or no larger than the solo count the split
  # disengages entirely and the loop runs every suite -- the local
  # command nobody has to relearn. One thing does differ there and
  # is deliberate: `plan` gets ONE worker in the pool, on any shard
  # count, because four workers inside a four-wide loop is the
  # eight-on-four oversubscription this split exists to end. The
  # worker count is a shape coordinate and never a semantics one
  # (the A/B is in `MISSING.md` M-182: byte-identical verdicts,
  # 187 PASS / 0 FAIL either way), so the SET of suites and every
  # verdict in it are the same however this runs.
  _w=1
  case " $SOLO " in
    *" $f "*)
      if [ "$_solo_on" = 1 ]; then
        [ "$f" = "$_mine" ] || continue
        # THE RUNNER IS THIS SUITE'S ALONE, so the one suite that
        # can use more than a lane is told it may. Only `plan`
        # reads this; naming it per-suite rather than in the job
        # `env` is what keeps the pool shards at one worker, which
        # is the oversubscription this whole split closes.
        [ "$f" = plan ] && _w=4
      fi ;;
    *)
      [ -z "$_mine" ] || continue ;;
  esac
  if [ -z "$_mine" ]; then
    _i=$(( ${_i:-0} + 1 ))
    [ $(( (_i - 1) % _pool_n )) -eq $(( _pool_k - 1 )) ] || continue
  fi
  while [ "$(jobs -rp | wc -l)" -ge 4 ]; do
    wait -n
  done
  # THE OUTPUT IS ALSO KEPT PER SUITE, 2026-08-23. Four-wide
  # interleaving means a failing suite's own lines are scattered
  # through a 5,000-line step, and the retrievable log window does
  # not reach back to the suites that run first — so `test_pin_sweep`
  # could be named as failing on two consecutive runs with its
  # reason visible nowhere. `tee` keeps the live stream AND a
  # per-suite copy, and the gate below prints the tail of each
  # failing suite's own log, unmixed, where a reader is already
  # looking. A gate that names a failure it cannot show is half a
  # gate.
  { started=$SECONDS
    echo "── quality/test_$f.py"
    TEST_PLAN_WORKERS=$_w \
      python3 "quality/test_$f.py" 2>&1 | tee "/workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/logs/$f.log"
    rc=${PIPESTATUS[0]}
    printf '{"suite":"%s","exit_code":%s,"wall_s":%s}\n' "$f" "$rc" "$((SECONDS-started))" > "/workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/logs/$f.status.json"
    [ "$rc" -eq 0 ] || echo "$f" >> /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/failed.txt; } &
done
wait
# THE GATE NAMES WHAT FAILED. It was `touch` + `test ! -f`, so the
# step failed correctly and printed NOTHING about which suite did
# it -- and this loop runs FOUR AT A TIME, so its output is
# interleaved and a reader had to scroll a whole job to find out.
# Measured 2026-08-22 on run 32542791452, where the tail of this
# step is an ADOPTION CHECK passing, immediately followed by the
# step failing for a reason named nowhere near it.
if [ -f /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/failed.txt ]; then
  echo "=============================================="
  echo "FAILING SUITES ($(wc -l < /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/failed.txt)):"
  sed 's|^|  quality/test_|;s|$|.py|' /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/failed.txt
  while read -r f; do
    echo ""
    echo "=============================================="
    echo "quality/test_$f.py — its OWN last 60 lines, unmixed"
    echo "=============================================="
    tail -n 60 "/workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/logs/$f.log" 2>/dev/null \
      || echo "  (no log — the suite died before writing anything)"
  done < /workspace/scratch/b0544e4bbdd6/production-fix-results/final-python88/failed.txt
  exit 1
fi
