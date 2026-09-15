# English nonlyric apparatus annotations — 2026-09-15

The owner's selected batch is the 253 nonlyric rows from the recovered English
corpus review. All original material is preserved at its original physical line
number using the existing `# APPARATUS:` convention. No source text is deleted,
no lyric is rewritten, and no reader rule is broadened.

The base is `40a28ddcd72be417b3d4d08b08580eb0aecc0f4a`. The recovered review began
at `2cfe01d0db5101c1cf89661d85022f2a1c9fb37c`; every selected original line matched
the current base before annotation. `data/english_nonlyric_apparatus.json` records
each original line, annotation, reason and before/after file hashes.

## Preserved material

| Material previously counted as lyrics | Rows annotated |
|---|---:|
| Printer separators and omission marks | 111 |
| Contents lists | 87 |
| Title-page and dedication prose | 37 |
| Ode section numbers | 10 |
| Printed author credits | 8 |
| Total | 253 |

The same convention labels 136 section markers attached only to apparatus and
nine apparatus-only title headings. Their original spellings remain in place.
The nine headings are four Stevenson contents entries, two Ingelow contents
entries, and the Clough, Kemble and Elizabeth Barrett Browning title pages.
Actual dedicatory verse, including Stevenson's `From Her Boy`, is retained as
verse. Song-count headers now count the remaining actual title records.

The production reader was run on both versions. Every remaining lyric row is
identical in text, indentation, physical position and item boundary. The explicit
work-edition policy keeps all weights and title coordinates; only the body hashes
for three affected editions change. Two annotated bylines belonged to zero-weight
editions, so 251 rows cease contributing to calibration.

| Population | Before | After |
|---|---:|---:|
| English files | 1,297 | 1,297 |
| Raw title records | 8,661 | 8,652 |
| Weighted title records | 8,546 | 8,537 |
| Nonempty weighted items | 8,545 | 8,536 |
| Normalized calibration lines | 279,753 | 279,502 |

## Dependent measurements

Measurement outputs and exact input bindings are retained in
`results/english_nonlyric_2026-09-15/`. Previous floor declarations are retained in
`profiles-before.json` there. The current tokenizer and grading code from main
are used; earlier September 13 calibration values are not substituted.

The frequency-table rebuild measures 13,836 endword types / 248,513 occurrences
and 23,762 pair types / 190,209 occurrences. The meter check reproduces density
[5,12] and prominence [2,7] over 231,658 measured lines. The live D1 structure
check measures 4,390,056 candidate pairs and 675/689 agreement; its previous
September 8 table is retained by date. Structural coverage changes only in the
136 apparatus-only marks: 101 VERSE, 33 CHORUS and two REFRAIN labels. The
vocabulary and decided/undecided classifications do not change.

## Verification and draft status

Published as a draft at the owner's request to open the PR now. The apparatus
annotations and the completed measurements are reviewable; this is not a
completed calibration adoption or a merge-ready corpus snapshot.

Completed checks: the preservation regression; frequency-table derivations;
meter bands; section marks; the updated D1 structure census; all 81 existing
rhyme-capacity witnesses against the rebuilt tables; documentation commands,
paths and behavior checks. The capacity receipt is included alongside this report.

The first full calibration-row rebuild failed because its temporary SQLite
checkpoint became corrupt. A clean retry started with a new temporary cache but
was interrupted before completion. No new band or length-curve thresholds are
claimed or adopted. The previous floor declarations remain in force and are
also archived here. The corpus manifest has deliberately not been rewritten.

Before merge, finish the current-input row rebuild, the registered 200-seed band
and length-curve fits, their adoption and checks, the manifest/population snapshot,
the final audit and all required closing suites. Existing corpus-shape regression
pins have been updated only where the actual completed measurement established
the new count; the complete suite sweep is still pending. The earlier corpus
audit also retains its existing Persian source-language failure, outside this
English annotation batch. This PR does not claim that the whole audit is clean.

## Scope and follow-up

No new source-reference assignment or edition ruling is included. The other
recorded source-reference and printed-song-admission queues remain separate.

Additional cases encountered during this check are recorded with exact source
coordinates in `results/english_nonlyric_2026-09-15/additional-apparatus-review.json`:
Longfellow's speaker labels and stage directions; Thovington's speaker labels;
Byron's printed byline and editorial drafting notes; Campion's author/date
heading; Burns's author signatures; and Watts's PAUSE directions. These examples
remain for a separate annotation pass and are not an exhaustive census.

## Reproduction

Run from the lyric-harness directory with the documented runtime resources staged:

```sh
python3 quality/test_production_data.py
python3 quality/calibration_rebuild.py --output-dir quality/results/english_nonlyric_2026-09-15 --field-cache /tmp/nonlyric-fields.sqlite --workers 6
python3 quality/results/english_nonlyric_2026-09-15/measure-bands.txt song
python3 quality/results/english_nonlyric_2026-09-15/measure-bands.txt short
python3 quality/length_curve_calibration.py fit quality/results/english_nonlyric_2026-09-15/current-calibration-rows.tsv --seeds 200 --workers 6 --picks predictability=CK --report /tmp/nonlyric-curves.json
python3 quality/length_curve_calibration.py check --rows quality/results/english_nonlyric_2026-09-15/current-calibration-rows.tsv
python3 quality/meter_bands.py --check
python3 quality/frequency.py --check
python3 quality/structure_census.py --check
python3 quality/mark_coverage.py --check
python3 quality/section_marks.py --check
python3 quality/verify_capacity.py --output /tmp/nonlyric-capacity.json --workers 2
python3 quality/capacity.py --check
python3 quality/corpus_manifest.py --check
python3 quality/corpus_taxonomy.py --check
python3 quality/suite_sweep.py
```
