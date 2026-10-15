M25 single authorized calibration measurement — completed, exit 0
Candidate worktree /workspace/musica-m25, branch codex/m25-residue-local-20261015; base b887e5effcea84bf11722ca69bd13fc7088755c5.
Unpublished seven-file patch SHA256 abc43547bdeb88e27e51fd89773dff1d5bfe14396234c94ace52772fd30446fe. No adoption or repins.

Command, from /workspace/musica-m25/lyric-harness:
LYRIC_STAGED_DATA=/workspace/musica-ci/lyric-harness/data PYTHONUNBUFFERED=1 /workspace/musica-ci-venv/bin/python quality/calibration_rebuild.py --output-dir /tmp/m25-qualification --workers 4
PID 73143. Start receipt timestamp 2026-10-15T05:18:00.571322+00:00; exit receipt timestamp 2026-10-15T06:10:30.633108+00:00. Script measured 3147.7177004749974 seconds, 402444288 peak parent RSS bytes. One run, all 11326 fields cold, no retry. Checkpoint retained. Full input provenance rechecked at completion.

Prerequisites: all 1344 tracked English source inputs present; 1343 contribute output rows. CMU copied from existing verified bytes, SHA81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22; runtime tables verified; existing Python3.12.14/NLTK3.10.3/model initialized offline. Output directory did not exist before preflight. No source fetch/install/provider.

Comparison baseline is committed qualification 0c31fdbc76a4077a3cdbd3d6adc93a82ff34ca4d, quality/results/comparator_remeasurement_2026-10-14 four raw row shards, subsequently adopted per docs/reader-calibration-adoption-2026-10-14.md. Comparator51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4, reader population fingerprint, question, tagger, NLTK all match; only corpus SHA differs. This is not comparison against older incompatible M25 comparator.

Exact multiset comparison of EVERY serialized TSV field, retaining multiplicity and ignoring only row order: 8585 unchanged rows, 12 removed, zero added or changed surviving rows. Removed rows are the listed editorial items; Herrick's seven-line Greek-only Upon Cupid block had no calibration row. Thus 13 reader items /33 lyric lines become 12 calibration rows /26 sung lines. No general non-English rule changed.
Items8597→8585; sung lines278152→278126; tokens1827094→1826900 (194 fewer); token range4–3244→9–3244; MATTR/TTR <=50-token items539→527. Exact removed records are in row-comparison.json.

Bounded no-adoption check:
LYRIC_STAGED_DATA=/workspace/musica-ci/lyric-harness/data /workspace/musica-ci-venv/bin/python quality/length_curve_calibration.py check --rows /tmp/m25-qualification/current-calibration-rows.tsv
Exit1, MOVED: population8585 vs shipped8597. Saved-row provenance passed; check stopped before fitting. No curve coefficients refit, thresholds/manifests repinned, or historical evidence overwritten. Surviving-row equality does not restore population qualification: counts, range and TTR population pins are stale. Frozen scoring/supplement/threshold sources remain byte-identical to main (source-identity.json); no claim that every frozen-contract test ran.

Artifacts and exact hashes: artifact-hashes.json. Raw rows SHA256 c68d295cfe10b3fc989b1a1c30b02c77fc9f6f49f1541a22afbb6edee2a5d5f2. Detailed evidence: rebuild.log, current-calibration-rows.meta.json, row-comparison.json, baseline-provenance-comparison.json, curve-check.log, baseline/ immutable extracted copies, current-field-cache.sqlite. Prior patch/preservation/independent review untouched.

Still not release-ready. Full Library build remains unsupported as affected-only regeneration and blocked by unchanged catalog source pins; see /tmp/musica-m25-dependencies.txt. No Library build, calibration adoption, fitting, source/comparator manifest repin, threshold edit, broad test, commit, push, or external write performed. The next adoption/qualification decision requires separate review; no rerun needed to inspect these rows.
