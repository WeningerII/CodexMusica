# Sonnet per-k remeasurement — evidence only

Measured on 2026-10-14 at exact checkout `55e89f28eb98a2e133a427ab0d53f7823da584d0`, with Python 3.12.14 and `PYTHONHASHSEED=0`. The process exited 0. No engine, corpus, grading policy, or calibration pin changed. Adoption remains a separate owner decision. The song-arm crossovers were not remeasured by this sonnet-only task.

## Procedure and reproduction

`per_k_original.py.txt` is the verbatim procedure embedded in `quality/results/any_reading_pins_2026-10-01/RECEIPT.txt` on the measured checkout. `per_k_bank.py.txt` has that exact prefix plus lossless JSON banking. The suffix records already computed scores and derives the full output grid using the same estimator. Sources use `.py.txt` so archived evidence is not treated as an importable production module.

From the repository root, with the exact measured checkout and its staged inputs available, set `MEASURED_HARNESS` to that checkout's absolute `lyric-harness` directory and `PYTHON` to a Python 3.12.14 interpreter with the runtime requirements installed. Run:

```sh
SONNET_RECEIPT=lyric-harness/quality/results/sonnet_per_k_2026-10-14
SONNET_OUTPUT=$(mktemp -d)
cp "$SONNET_RECEIPT/per_k_bank.py.txt" "$SONNET_OUTPUT/per_k_bank.py"
PYTHONHASHSEED=0 "$PYTHON" "$SONNET_OUTPUT/per_k_bank.py" "$MEASURED_HARNESS" > "$SONNET_OUTPUT/raw_output.txt" 2>&1
```

The script writes JSON beside its scratch copy. Do not pass the optional historical `weak` argument. The original invocation used `/workspace/musica-ci-venv/bin/python`, `/workspace/musica-ci/lyric-harness`, and a script/output directory under `/tmp/musica-ci-evidence/sonnet-per-k-55e89f28`. Source creation to stdout completion was approximately 6.379 seconds; this is an artifact-based elapsed estimate, not separately measured process CPU time.

The sweep uses ten within-unit permutation replicates, seeds 4242–4251, and theta values 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90. Both arms are bucketed by each pair's own realized search k. Lift is full-search share minus k=1 share; buys is real lift minus median null lift. Crossover uses the original first-sign-change interpolation. Clears counts strict real-lift > null-lift replicates at theta 0.75. The existing 187-window population, including Gutenberg boilerplate, is preserved.

## Results

| Bucket | Real pairs | Crossover | Buys at 0.75 (pp) | Clears |
| --- | ---: | ---: | ---: | ---: |
| All | 1102 | 0.7160653820065024 | +1.3085167223693306 | 10/10 |
| k=3–4 | 808 | 0.7589803820901831 | −0.16058170555497053 | 4/10 |
| k=5–8 | 207 | 0.642407362941597 | +5.301107706058865 | 10/10 |
| k=9–16 | 62 | 0.7056191835992299 | +4.102452112060895 | 8/10 |
| k≥17 | 12 | 0.85 | +8.095238095238097 | 7/10 |

The modal k=3–4 crossover remains above shipped theta 0.75 and buys nothing there. The all-pairs crossover remains below the adopted scalar 0.72. These measurements do not authorize adoption of new pins.

## Evidence

- `raw_output.txt`: complete original procedure stdout.
- `raw_scores.json`: every ordered real and per-seed null triple `(k, full_search_score, endword_only_score)`.
- `per_k_rows.json`: all buckets, all seven theta rows, all ten null lifts per theta, unrounded medians/buys/crossovers, clears and null population sizes.
- `input_hashes.json`: exact measured head and SHA-256 of 429 harness Python/data files, the sonnet corpus, staged CMUdict and originating receipt. Every hash was reverified after environment recovery, before publication.
- `validation.json`: grid, seeds, population sizes and verbatim procedure-prefix checks.
- `artifact_hashes.json`: SHA-256 of the archived receipt files, excluding itself.

The input hash inventory records the measured checkout, not later evidence-branch files. The six lost scored pairs (813→808 and 208→207) were separately traced to v2 retaining numeric endings in Gutenberg metadata, licence and address material; see the adjacent approved-record-refresh receipt. Neither filtering that population nor reverting the reader is part of this measurement. No provider calls were used.
