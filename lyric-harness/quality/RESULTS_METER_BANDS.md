# Results — the meter-band calibration, first run

Method: `quality/METER_BANDS_PREREGISTRATION.md`, committed b2b1317, before
any number below existed. Re-derive everything on this page with

    python3 quality/meter_bands.py        # from the harness root, ~34 s

**HEADLINE: the registration's own falsifier fired, and by its own words NO
BAND IS ADOPTED FROM THIS RUN.** Exclusion reached 31.09% against a declared
25% ceiling. The envelope below is reported as what it is — a measurement
over the lines the reader could read — and the decision about whether that
population can support a band is made by a REGISTERED AMENDMENT
(`METER_BANDS_PREREGISTRATION_AMENDMENT.md`), not by this page deciding the
ceiling didn't count.

## The run

| quantity | value |
|---|---|
| files | 143 (`corpus/song/eng_*.txt`) |
| raw lines | 195,471 |
| lyric lines | 152,313 |
| measured | 104,952 |
| excluded | 47,361 (**31.09%**) |
| runtime | 33.5 s |

Exclusions by cause (a line can carry more than one cause, so these sum to
more than 47,361 — lines are counted once per cause here, once total above):

| cause | lines |
|---|---|
| OUT_OF_LEXICON | 46,083 |
| NUMERAL | 1,308 |
| ZERO_UNITS | 310 |

## The envelope (over the 104,952 measured lines)

Nearest-rank percentiles, as registered:

| p | syllables/line | prominent/line |
|---|---|---|
| 1 | 3 | 1 |
| 5 | **4** | **2** |
| 25 | 6 | 3 |
| 50 | **8** | **4** |
| 75 | 9 | 5 |
| 95 | **11** | **7** |
| 99 | 14 | 8 |

The runner derives a [p5, p95] cut of DENSITY [4, 11] syllables/line and
PROMINENCE [2, 7] prominent/line — printed under the word PROPOSED because
the derivation rule was registered, and **not adopted here** because the
falsifier fired first. Adoption is the amendment's question.

Top contributors (measured lines, pooled per line as registered):

| share | lines | file |
|---|---|---|
| 15.83% | 16,618 | eng_hymn_watts.txt |
| 9.96% | 10,449 | eng_hall_thomas_durfey.txt |
| 8.78% | 9,214 | eng_british_felicia_hemans.txt |
| 8.09% | 8,494 | eng_celtic_robert_burns.txt |
| 5.60% | 5,879 | eng_british_robert_herrick.txt |

## The predictions, each against its number

**P1 — sanity anchor: HELD.** Median syllables/line is 8, inside the
registered 6–9. The reader is reading song lines, not noise.

**P2 — conservation: HELD.** The sweep completed without a
`CalibrationRefused`: every one of 104,952 measured lines satisfied
0 ≤ prominent ≤ syllables, and measured + excluded = 152,313 exactly.
(These checks are code in `measure_corpus`, not an eyeball — a violation
refuses the whole run.)

**P3 — exclusion stays representative: FAILED, past the falsifier.**
Predicted under 10%; measured 31.09%; the registered falsification line was
25%. The cause is one number: 46,083 OUT_OF_LEXICON lines. The registered
reader is CMUdict-backed General American, and the population is a corpus
whose top-five contributors include D'Urfey's 17th-century orthography and
Burns's Scots. The prediction was wrong about the corpus, not the reader:
the reader did exactly what it declares, refused what it cannot read, and
said so per line.

**P4 — the pool is not one book: HELD.** Without `eng_hymn_watts.txt`
(88,334 lines kept): p5/p50/p95 syllables 4/8/12 against 4/8/11, prominent
2/4/7 against 2/4/7 — every registered point within ±1. (Unregistered
points for completeness: p25 6→7, p99 14→15, also ±1.)

**P5 — the planner-facing one: HELD, on numbers this run may not adopt.**
The planner's per-line supply, read from `quality.fit` itself rather than
hand arithmetic (2 bars/line, subdivision 2):

| meter | pulses/line | heads/line | slots/line |
|---|---|---|---|
| 4/4, groups (2,2) | 8 | 4 | 16 |
| 6/8, groups (3,3) | 12 | 4 | 24 |
| 7/8, groups (3,2,2) | 14 | 6 | 28 |

4/4's 8 pulses sits inside [4, 11] at the median exactly; its 4 heads sits
inside [2, 7] at the median exactly. The live run's CROWDED/prominence
notes were the corpus's own typical demand meeting a rigid all-downbeat
grid — evidence for the second sitting's placement-variation work, whatever
the amendment decides about bands.

## What happens next, and what does not

The falsifier's registered consequence is in force: no band constant from
this page enters any enforcement code. The open question the amendment
registers — BEFORE its analysis runs — is whether the 31% exclusion
actually distorts the envelope, testable because enforcement can only ever
band-check lines the reader reads with certainty: an OOV draft line gets
COUNT_IS_A_LOWER_BOUND, never a band verdict, so the reference class for
enforcement is certain lines by construction. Whether the certain subset's
envelope is stable across files with low and high exclusion is an empirical
claim with a declared threshold, and it is registered in
`METER_BANDS_PREREGISTRATION_AMENDMENT.md` with its own falsifier.

Nothing in `METER_BANDS_PREREGISTRATION.md` has been edited. This page
reports its misses beside its holds, which is the point of registering.
