# Results — the reader amendment run: ADOPTED, BOTH BANDS

Method: `quality/METER_BANDS_PREREGISTRATION_READER.md`, committed 6b8cc77,
before any number below existed — the third registration in this series and
the first whose adoption rule fired in the affirmative. Re-derive with

    python3 quality/meter_bands.py --reader=fallback-low   # ~49 s

**VERDICT: ADOPTED, BOTH.** The hard gate passed, both quantities' trials
passed, and the full-pool bands carry with their robustness licence:

| band | adopted value | licence |
|---|---|---|
| **DENSITY** | **[5, 12] syllables/line** | certain vs derived +0/+0/+0 at p5/p50/p95 |
| **PROMINENCE** | **[2, 7] prominent/line** | certain vs derived +1/+1/+0, inside ±1 |

Adoption is conditional, as registered: **the band check must read draft
lines with the same declared coordinate** (`English(fallback="low")`
through `fit.read_line`'s phon-derived lexicon). Wiring that is the
enforcement sitting's work; a band enforced through a different reader is
enforcing a different instrument's numbers.

## The run

| quantity | run one (default reader) | this run (fallback-low) |
|---|---|---|
| measured | 104,952 | 139,694 |
| excluded | 47,361 (31.09%) | 12,619 (**8.28%**) |
| OUT_OF_LEXICON | 46,083 | 11,010 |
| NUMERAL / ZERO_UNITS | 1,308 / 310 | 1,308 / 376 |
| runtime | 33.5 s | 48.9 s |

The split: 113,914 CERTAIN lines (every token dictionary-read) and 25,780
DERIVED lines (≥1 token answered by a non-dictionary layer) — disjoint, as
registered, so the agreement below is not diluted by overlap.

Envelope over all 139,694 measured lines (nearest rank):

| p | syllables | prominent |
|---|---|---|
| 1 | 3 | 2 |
| 5 | **5** | **2** |
| 25 | 7 | 3 |
| 50 | **8** | **4** |
| 75 | 9 | 5 |
| 95 | **12** | **7** |
| 99 | 15 | 8 |

Top contributors now include the books the first run could not read —
Burns second at 10.19% (was 8.09% of a smaller pool), Barnes fifth at
6.69% (was refused at 76%). The Watts sensitivity check still moves
nothing beyond the p1 row.

## The predictions, each against its number

**R1 — the gap mostly closes: HELD.** 31.09% → 8.28%, inside the
registered ≤10%, and not near zero for exactly the registered reason: the
residual 11,010 OUT_OF_LEXICON lines are where `sae`/`frae`/`wi'`/`nae`
and their kin still refuse.

**R2 — conservation: HELD.** The sweep completed; every measured line
obeys 0 ≤ prominent ≤ syllables and measured + excluded = 152,313 exactly.

**R3 — sung lines are sung lines: HELD, exactly.** Syllables certain vs
derived: +0 at p5, +0 at p50, +0 at p95. Dialect verse is differently
spelled, not differently sized.

**R4 — the stress prediction survives its trial: HELD.** Prominent
certain vs derived: +1 at p5, +1 at p50, +0 at p95 — the derived lines run
one prominent syllable hot at the low and middle points, inside the
registered ±1. Registered as the prediction most likely to miss; it did
not, and the +1s are reported rather than rounded away.

**R5 — the pool moves little: HELD.** Against run one's certain-line
envelope: p5 syllables 4→5 (+1), p50 8→8, p95 11→12 (+1); prominent
2/4/7 → 2/4/7 unchanged. The newly readable 30% widened the envelope by
one syllable at each edge and left prominence alone.

## One defect found and fixed during this run

The first fallback sweep printed `REPRODUCE: python3 quality/meter_bands.py`
— a command that reproduces run ONE, under a header naming this run's
reader. The sweep now records its `reader_mode` and the REPRODUCE line
derives from it; a regression in section 4 of the test file pins the
recording. Doctrine 48's smallest species: a provenance line that cannot
be wrong is one that is derived, not typed.

## What the enforcement sitting inherits

- **DENSITY [5, 12]** and **PROMINENCE [2, 7]**, per line, at reader
  `fallback-low`, subdivision-free — pigeonhole counts, no isochrony
  assumed anywhere in their derivation.
- The instrument-match condition above.
- The repo's existing pattern for shipped constants
  (`song_profile_calibration.py`): declare them in code, and let an
  instrument re-derive them against this runner so a drifted constant
  fails loud rather than lingering.
- The placement question RESULTS_METER_BANDS.md flagged stands unchanged:
  the planner's 4/4 line supplies 8 pulses and 4 heads, which sit at the
  measured medians exactly — the CROWDED/prominence notes of the live run
  were typical demand meeting a rigid all-downbeat grid, and band
  enforcement does not remove the case for placement variation.

Nothing in any of the three registrations has been edited. Three runs,
two refusals, one adoption — each decided by rules written before their
numbers, which is the only reason the adoption means anything.
