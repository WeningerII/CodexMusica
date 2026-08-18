# Results — the amendment run: REFUSED at the floor

Method: `quality/METER_BANDS_PREREGISTRATION_AMENDMENT.md`, committed
763cf29, before any number below existed. Re-derive with

    python3 quality/meter_bands.py --amendment    # from the harness root

**VERDICT: REFUSED — no band is adopted, by the amendment's own floor.**
At the declared 15% per-file exclusion line, 51 files are LOW and 92 are
HIGH, and the LOW files keep 28,992 of 104,952 measured lines — **27.6%**,
under the registered 40% meaningfulness floor. The registered consequence
is in force: a licence issued by a quarter of the data is not a licence,
and A2's subset envelope was therefore **never computed** — the code
refuses before aggregating it, so there is no number to be tempted by.

## A1 — the gap has an address: HELD

Every file named in advance landed on its predicted side:

| named in the registration | exclusion | side |
|---|---|---|
| eng_celtic_robert_burns.txt (Scots) | 51.61% | HIGH ✓ |
| eng_hall_thomas_durfey.txt (17th-c. orthography) | 24.53% | HIGH ✓ |
| eng_hymn_watts.txt (18th-c. hymn English) | 10.04% | LOW ✓ |

And the unnamed worst are the same story, stronger:

| exclusion | lines | file |
|---|---|---|
| 76.25% | 10,482/13,746 | eng_hall_william_barnes.txt (Dorset dialect) |
| 71.44% | 868/1,215 | eng_hall_edwin_waugh.txt (Lancashire dialect) |
| 58.64% | 614/1,047 | eng_celtic_carolina_oliphant_lady_nairne.txt (Scots) |
| 57.59% | 129/224 | eng_celtic_william_motherwell.txt (Scots) |
| 54.68% | 216/395 | eng_american_paul_laurence_dunbar.txt (dialect verse) |

## What the two refusals together establish

This is not a corpus with some noise in it. **Dialect verse is a large,
deliberate part of this song corpus** — Dorset, Lancashire, Scots,
African-American dialect — and the grader's CMUdict-backed General-American
reader refuses it at rates from 25% to 76% per file. 92 of 143 files sit
past the 15% line. The original registration's falsifier (31.09% aggregate
exclusion) and the amendment's floor (27.6% kept) fired on the same fact
from two directions, and both were written before their numbers.

The measured envelope (RESULTS_METER_BANDS.md) stands as a reproducible
description of the 104,952 lines the reader can hold — median 8 syllables,
4 prominent, [4,11] / [2,7] at the p5–p95 cut — but **nothing licenses it
as a band**, and per both registrations nothing on this page may.

## The registered fork forward

The amendment names the only two admissible next steps, each a NEW
registration, neither a third aggregation of this run:

1. **Reader amendment** — calibrate with the declared G2P fallback
   (`quality/g2p.py`, already wired as an opt-in declared coordinate), so
   dialect words are read instead of refused. Its registration must carry
   the instrument-match argument (the band check must then declare the same
   fallback when it reads a draft line) and must answer the stress-channel
   question honestly: fallback SYLLABLE counts are robust, fallback STRESS
   is a prediction, and a predicted coordinate inside the prominence
   envelope needs its own justification or a split treatment.

2. **Population redesign** — declare a sub-population by a criterion
   independent of this measurement (the files' own header metadata, not
   their measured exclusion rates), and calibrate over it, accepting that
   the resulting band describes standardized-orthography sung English and
   says nothing about dialect verse.

Which fork, or neither, is the owner's call — it shapes what the band
MEANS, not just what it costs. Nothing in either preregistration has been
edited; the misses on this page sit beside the holds, which is the point
of registering.
