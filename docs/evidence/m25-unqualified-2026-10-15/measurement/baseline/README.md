# Full comparator remeasurement — evidence only

Measured on exact repair head `55e89f28eb98a2e133a427ab0d53f7823da584d0`, using Python 3.12.14 and nltk 3.10.3. Four cold shards completed all 8,597 feature rows in 6,376.193 seconds elapsed (1h 46m 16s); each reported zero cache hits. This is wall time, not aggregate CPU time. Per-shard CPU/wall costs are preserved in the compute logs.

All five shipped length curves re-derive from the corpus: MATTR, FWR, anaphora, CV and predictability. The full song and short profiles each answer all 21 checks with no refusal and every shipped constant reproducing. `checks-status.json` records exact commands, return codes and measured elapsed times. No full-fit search was needed because the standard curve check returned zero. No constants, thresholds, comparator pin, corpus or production code were changed.

The full multiset of normalized serialized feature records equals the 2026-10-11 bank: 8,597 old and new records, multiplicity retained, zero old-only or new-only records. This is **not** raw TSV byte equality or row-order equality. `historical-row-comparison.json` banks all compared hashes; `compare_historical.py.txt` is the exact comparison procedure. Row provenance matches the historical provenance except for the comparator fingerprint (and shard/count/row-hash fields).

Current measured comparator: `51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4`. Existing pin remains `9d5d81461aec2c94c8997431b3211727f7db56686712c1678cd1348966dc0df8`. This receipt qualifies a potential fingerprint refresh; it does not adopt one. The separate sonnet per-k receipt records the two changed complete rows; those pins also remain held for owner approval.

## Reproduce

Use the exact measured checkout with its runtime requirements installed in a Python 3.12.14 virtual environment. Set `PYTHON` to its interpreter and put that environment's bin directory first on `PATH` (the expected-drift wrapper launches `python3`). Set `LYRIC_STAGED_DATA` to the directory containing the repository's checksum-verified research data. The initial preflight refused missing concreteness data without producing feature rows; `staging.log.txt` and `preflight-refusal/` preserve this. Research inputs were staged with the repository's `quality/fetch_data.py --research` procedure. No provider calls were used.

From the measured checkout's `lyric-harness` directory, set `CAL_OUT` to a new empty output directory, then run each shard (the original ran all four concurrently):

```sh
for shard in 1 2 3 4; do
  "$PYTHON" quality/length_curve_calibration.py compute --shard "$shard/4" --cache-path "$CAL_OUT/memo-$shard-of-4.tsv" --out "$CAL_OUT/rows-$shard-of-4.tsv"
done
"$PYTHON" quality/length_curve_calibration.py check --rows "$CAL_OUT"/rows-*-of-4.tsv
"$PYTHON" quality/length_curve_calibration.py merge-cache "$CAL_OUT"/memo-*-of-4.tsv --into "$CAL_OUT/merged-memo.tsv"
"$PYTHON" quality/song_profile_calibration.py --check --cache-path "$CAL_OUT/merged-memo.tsv"
"$PYTHON" quality/song_profile_calibration.py --check --profile short --cache-path "$CAL_OUT/merged-memo.tsv"
"$PYTHON" quality/expected_drift.py song_profile_calibration-fast
```

For verification without recomputation, decompress the archived memo TSVs into a scratch output directory and use the archived rows. `run_compute.py.txt` and `run_checks.py.txt` preserve the exact original orchestration, including its absolute paths; adapt only those paths to reproduce elsewhere. Scripts have `.py.txt` extensions so archived evidence is not counted as production modules.

## Input and artifact integrity

`provenance.json` and the four row metadata files bank comparator, population, corpus, question, tagger and NLTK identities. All 1,683 input hashes were checked again after completion; `input-revalidation.json` records zero mismatches. `input-hashes.json` retains original absolute paths; `portable-input-hashes.json` maps them to `harness/` and `staged/` roots. The initial progress snapshots remain historical evidence, not final-status claims.

`artifact_hashes.json` covers every archived artifact except itself, with decompressed hashes for gzip files. `validate_artifacts.py.txt` validates archive hashes, decompression and row metadata/counts without executing the harness. Run it with Python and this receipt directory as its argument. This is offline calibration evidence, not live-service acceptance or an all-green CI claim.

## Fast-wrapper environment correction

The original supervisor's final fast check returned 1: its child selected system `python3`, which lacked `nltk`. This was a direct execution refusal, not unchanged output or measured drift. The original traceback remains in `fast-profile-check.log.txt.gz`. Only that check was rerun with `/workspace/musica-ci-venv/bin` prepended to `PATH` and the same staged-data environment. The corrected invocation exited **0**, reporting zero observed drifted values and zero declared values, followed by PASS, banked in `fast-profile-check-corrected.log.txt`. No healthy computation workers were restarted. `checks-status.json` intentionally retains the original failed attempt; `fast-profile-correction.json` records the successful corrected invocation. Its elapsed duration was not separately instrumented and is not claimed.
