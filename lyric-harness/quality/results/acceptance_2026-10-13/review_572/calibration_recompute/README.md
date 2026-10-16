# Independent cold recompute of the #572 calibration rows, 2026-10-16, 01:27–03:12 UTC

This used `cal.sh` (`../cal.sh`): 4 shards of `length_curve_calibration.py compute`, each with its own empty memo, on the `90d6de13` tree, under CPython 3.11. The rows don't depend on the later heads, which change only `floor.py` reach and test files. Wall time was 6,235 s, and all 4 shards returned rc 0.

- **The rows equal the committed rows exactly.** My 8,585 records, compared as a multiset, match `docs/evidence/m25-unqualified-2026-10-15/measurement/current-calibration-rows.tsv`: every field identical, with nothing only in mine and nothing only in theirs (`row_compare.txt`).
- **The curves re-derive from my own rows.** `length_curve_calibration.py check --rows` on my shards: **HOLDS**, 5/5 (`check_on_my_rows.txt`). `cv` matches shipped to about 1e-8. That is the fit arithmetic on this interpreter; the input rows are identical.

The shard row files are not committed, because of their size. Their sha256 are in `rows.sha256`.
