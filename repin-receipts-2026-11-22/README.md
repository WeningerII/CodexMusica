# Repin receipts for #913, 2026-11-22 — NOT ADOPTED

These are measurements only. The owner's ruling on 2026-11-22 was "Hold it": nothing here is adopted.
`quality/comparator_pin.json`, `quality/floor.py` and `quality/results/` are unchanged.

## What was measured
- Code: branch `r2/pronunciation-batch` (#913). The shards were computed at `ded2284947` (shards 5–16) and at `04f9dcdc0d` (shards 1–4).
  - `04f9dcdc0d` changes only `quality/floor.py` and its test, and `floor.py` is not a comparator input.
  - Every shard carries cache fingerprint `a71c44af617d`.
- Population: 16 shards, 8,585 items, the same count as the 2026-10-31 repin.
- Commands, run from `lyric-harness/`:
  - `quality/length_curve_calibration.py compute --shard i/16`, then `merge-cache`, then `check --rows`;
  - `fit --seeds 200 --workers 4 --picks predictability=CK --report curve-adoption.json`;
  - `quality/song_profile_calibration.py --check [--profile short]`, run against the merged cache;
  - `--check --without-predictability --no-cache`, run on main `1f6017b0bf` and on the batch, for comparison.

## Result
- **Predictability: HOLDS.** All 21 knots hold. mattr, fwr and cv on the lyric row hold to the digit.
- **Anaphora on the lyric row: MOVED.** C2 `[1.159351, -0.245658, 0.016268]` becomes `[1.167723, -0.249616, 0.016806]`. It passes every bin, with a held-out false-positive rate of 5.02% [3.48–7.08].
- **Short profile: HOLDS.**
- **Song profile: DRIFT.**
  - On the shipped 150–350 band, only anaphora moves: 0.3086 becomes 0.3125. Main reproduces every value (`song-main-wop.txt` against `song-batch-wop.txt`).
  - Under the profile's own band rule, the band widens to 150–400. That moves the other thresholds:
    - mattr 0.7058 becomes 0.7080;
    - fwr 0.4806 becomes 0.4803;
    - anaphora becomes 0.3077;
    - cv 0.1073 becomes 0.1080;
    - n_human 3,251 becomes 3,535.
  - Predictability stays at 0.9333.
  - The held-out false-positive rate for ANY is 19.57%, against 19.39% shipped.
- **Cause:** bug-hunt finding 34. The repeated-opening check now reads a line's first word, case- and apostrophe-folded, with the marks around it cut.

Paths in the logs point to the scratch directories where the runs were made.
