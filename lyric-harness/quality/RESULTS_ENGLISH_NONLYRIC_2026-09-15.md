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

## Calibration closure — 2026-09-15

The fresh rebuild completed all 8,536 nonempty weighted works across 1,296
populated files and 279,502 sung lines in 1,402 seconds. It rebuilt all 11,429
exact pronunciation fields with a bounded decoded cache; peak parent memory
was 778,592,256 bytes. The earlier corrupt checkpoints were not reused.
The saved row TSV and its sidecar bind the exact corpus, reader, comparator,
question and staged tagger used for this measurement.

The two historical bands still resolve to 200–400 tokens (2,231 items) and
50–150 tokens (3,650 items). Each was remeasured with 200 author-held-out
splits and 2,000 period-bootstrap draws; the period permutation arm uses its
registered 10,000 draws. Both adoption checks answer all 21 constants with
zero refusals. The song line-length-CV minimum changes from
0.11089061090642224 to 0.11080070804250827; its other four cuts hold.

All five active length curves pass every one of the 21 length bins over
200 author-held-out splits. The selected models remain C1 for MATTR and
function-word ratio, C2 for anaphora, and CK for line-length CV. Predictability
retains the existing, explicitly reported CK exception to the passing C0=1
model; it first becomes informative at 166 tokens. The measured lyric range
is now 10–3,244 tokens, previously 4–3,244, and the MATTR/TTR population is
532 works at or below 50 tokens, previously 540. The prior minimum came from
apparatus-only material. The curve adoption check re-derives all five curves.
These are calibrations against historical human text, not a generated-song
separation or a claim of musical validity.

The corpus manifest and six population bindings were refreshed together on
2026-09-15. All 1,430 corpus files now match that snapshot. The taxonomy census
is 8,652 raw English title records: 845 American, 4,495 English, 205 Irish,
1,569 Scottish, and 1,538 with an undeclared region. The nine-record decrease
is exactly five English title/contents records and four Scottish Stevenson
contents records. Their text remains in place as apparatus.

The band-report helper initially refused because it dequeued duplicate titles
in source order after the measured rows had been sorted by length. It now
matches the same stable length/file/title order and checks every row's identity,
line count and author. The adoption helper's numeric lookup and feature-key
mapping were also corrected before final adoption. Those initial failed attempts
are not counted as successful checks. Full-precision reports, the corrected
reproduction helpers and final adoption receipts are retained with the rows.

## Integration and verification

Current main at `64d32b204f493790a9c98f74f68f8ffb242cdb23` is merged. Both
source-ledger conflicts are resolved, retaining the twelve Oxford 1931 header
corrections and all prior source evidence. The three files touched by both
changes retain their lyric bodies and physical line coordinates. No admission
fields changed. The merged tree was verified against the published tree, and
GitHub reported the PR mergeable at `c54d95101b12d8f9ad5b82a3bc663a78ac515f78`.

Completed checks: all 36 production-data tests, the preservation regression,
frequency derivations, meter bands, section marks, D1 structure census, mark
coverage, taxonomy, runtime asset integrity, build closure, both historical
band adoptions, all five length curves, the refreshed manifest, and all 81
existing rhyme-capacity witnesses. The historical profile archive's formatting
was corrected without changing any values. The full closing test sweep is
in progress; draft status remains until its results are reviewed.

The original publication was a draft with unfinished calibration and merge
conflicts. This closure supersedes that calibration status. The full corpus
audit still includes its pre-existing Persian source-language finding for
`corpus/fas_hafez.LICENSE.txt`; that issue is outside this English batch and
is not described as a clean audit.

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
python3 quality/length_curve_calibration.py fit quality/results/english_nonlyric_2026-09-15/current-calibration-rows.tsv --seeds 200 --workers 6 --picks predictability=CK --report quality/results/english_nonlyric_2026-09-15/curve-adoption.json
python3 quality/results/english_nonlyric_2026-09-15/adopt-profiles.txt
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
