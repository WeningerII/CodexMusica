# Read-only drift diagnosis, 2026-10-14

Measured in isolated clean checkout 68e213d0aadf589319bce345b8eebc4b0d0a60f1. Relevant engine, calibration, corpus and source-identity files are byte-identical to diagnostic implementation head 3870c8e7. No pins, engine code or repository files changed.

## Comparator

Current check measures 51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4 against held pin 9d5d81461aec2c94c8997431b3211727f7db56686712c1678cd1348966dc0df8. Exactly one of seven input parts differs: lyric_harness.py closure. The six other parts match, including dictionary, frequency table, Declaration(), features.py and the two named function sources.

Static closure comparison from the last pin commit 53abd2e5e to saved base 8ea94ac9 finds 19 added reachable names for the reader scheme and tokenizer; seven existing reached definitions changed: Lexicon, join_spaced_enclitics, line_anchors, line_tokens, raw_final_token, token_pieces, unread_final_piece. Nothing was removed. Saved base 8ea94ac9 and continuation 68e213d0 have exactly equal closure text/names. The fingerprint failure therefore predates this continuation. This diagnoses source-identity drift, not proof that calibrated outputs hold. Full recalibration/re-pinning remains unapproved and was not performed.

## Sonnet populations

One 2.561-second per-pair measurement holds code/corpus/assets fixed and selects the existing v1 versus v2 reader explicitly. v1 exactly reproduces held populations 813 and 208; v2 exactly reproduces measured populations 808 and 207. No other scored pair changes its k. Six previously scored pairs become unscorable because v2 retains numeric final tokens instead of silently dropping the number and reading a preceding word:

- corpus/sonnets.txt:18 — October -> 2024 (k4 lost)
- corpus/sonnets.txt:2708 — E -> 8 (k4 lost)
- corpus/sonnets.txt:2773 — E -> 9 (k4 lost)
- corpus/sonnets.txt:2803 — E -> 1 (k4 lost)
- corpus/sonnets.txt:2807 — E -> 9 (k4 lost)
- corpus/sonnets.txt:2944 — Plaza -> 516 (k8 lost)

All are Gutenberg header/license/address material. search_null.sonnet_units chunks every nonempty, nonapparatus line into 14-line windows, including this material. Existing comments already disclose the inherited 187-window boilerplate population defect. Neither stripping it nor reverting the reader nor updating population/crossover pins is authorized by this diagnosis. The v1 invocation is solely a causal control.

Receipts: comparator-current-check.log, comparator-closure-drift.log, comparator-closure-drift.py, sonnet-reader-drift.log, sonnet-reader-pairs.json, sonnet-numeric-witnesses.log, sonnet-reader-drift.py, all in /tmp/musica-ci-evidence/. No providers used. This is a population/closure diagnosis, not a fresh crossover or song calibration.
