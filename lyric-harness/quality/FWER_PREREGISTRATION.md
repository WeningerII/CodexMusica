# Pre-registration — family-wise error control in the time layer

Committed **before** the code. `git log` proves the order.

## The problem, already quantified

`RESULTS_MATRIX.md` established that the time layer's event saturation is not a
comparator defect. Each stressed syllable is compared against roughly **135**
candidate partners inside the declared window, and the event set is a *maximum*
over those comparisons. So a per-pair false-positive rate of α gives a
per-position false-event rate of `1 − (1−α)^135`:

| per-pair FPR | hand-set theta | false-event rate per position |
|---|---|---|
| 11.8% | 0.75 | ~100% |
| 7.7% | 0.80 | ~100% |
| 2.4% | 0.90 | **96%** |

Measured saturation was 87–97%, which those numbers predict almost exactly.
Holding saturation near 30% would need a per-pair FPR around **0.26%** — far
stricter than any threshold in use, and not reachable by moving theta, because
theta is not stated in a currency that composes.

The conjunctive band moved saturation to 86–93%. Real, and not the fix: the
band removes assonance-only events, it does not remove the comparison count.

**A per-pair threshold cannot control a family-wise error.** This is the
missing layer.

## The design

**Step 1 — a p-value per candidate pair, from a within-item null.**

The score has to be converted into a currency that composes. For each item,
build a null by **shuffling which spans are paired** while preserving the
multiset of spans (same span lengths, same phonology, same vocabulary; only the
pairing destroyed). That is the `shuffle_twin` construction from `controls.py`,
which exists because doctrine 14 says a control may not be defined in terms of
the quantity it controls.

`p(pair) = P(null score ≥ observed score)`.

The null is the **item's own spans**, so no external resource is consulted and
doctrine 13 holds by construction — the same self-normalizing property the
phase statistic already has.

This also fixes the domain mismatch that broke the matrix's thresholds, which
were calibrated on line-final *word* pairs and applied to arbitrary *syllable
spans*. Here the null is drawn from exactly the population being scored.

**Step 2 — correct across each position's family.**

A position is declared an event if any of its `m` candidate pairs is
significant. To control the probability that a position is *falsely* an event
at level α:

- **Šidák** (primary): per-pair cut `1 − (1−α)^(1/m)`.
- **Bonferroni**: `α/m`. Reported alongside, since the comparisons overlap and
  are not independent, so Šidák's exactness assumption does not hold and
  Bonferroni is valid regardless.
- **Benjamini-Hochberg at q**: reported as the more powerful alternative, over
  all candidate pairs in the item. BH controls the expected *proportion* of
  false events, which is arguably the better guarantee for a statistic that is
  a histogram over many events, and q=0.10 is what the rest of this project
  uses.

Primary is **Šidák FWER at α = 0.05**, because the question the event set asks
is per-position — "is this position an event?" — and FWER is the guarantee that
matches that question.

## Declared coordinates

| coordinate | value |
|---|---|
| null samples per item | 20000 |
| p-value resolution | 1/20000 = 5e-5; below that, reported as `p < 5e-5` |
| α (per-position FWER) | 0.05 |
| q (BH, secondary) | 0.10 |
| null construction | span-pair shuffle within the item, span multiset preserved |

20000 is chosen so the resolution clears the Šidák cut: at m ≈ 135 and α = 0.05
the per-pair cut is ≈ 3.8e-4, which needs a tail resolved an order of magnitude
finer.

## Predictions

**P1 — saturation falls below the 0.75 ceiling on every corpus**, and lands at
approximately *(true event rate) + α*. This is the whole point: after
correction, saturation becomes an interpretable quantity rather than an
artifact of the comparison count.

**P2 — the false-event rate is controlled at α.** On text where no rhyme
relation should exist, the corrected event rate is ≤ 0.05 + sampling error.
Tested by scrambling the phonological content, not by assertion.

**P3 — TRIPWIRE, must not fire. The correction must not simply delete
everything.** A layer that reports 0% saturation has no power either, from the
opposite direction. Genuine internal rhymes — a constructed line with a planted
internal rhyme, and known dense material — must survive the correction. If the
retained event count goes to zero on material that visibly rhymes, the
correction is too strong and the honest answer is that this window cannot be
corrected, not that the verse has no rhyme.

**P4 — the layer becomes measurable, and the registered time-layer hypotheses
finally get a powered test.** With saturation inside the ceiling, `analyse()`
stops refusing, and H1/H2 from `TIME_PREREGISTRATION.md` can be re-run.

Direction unchanged from the original registration: **rap > sonnet**, sonnet
predicted null.

## The honesty condition on P4

This will be the **third instrument** used to test H1: the original (theta 0.80,
window 32), the amended one (theta 0.90, window 16), and now the corrected one.
Three instrument revisions on the same hypothesis is a garden of forking paths,
and a nominally significant result here deserves more skepticism than its
p-value states.

So P4 is registered with a constraint: **the result is reported with the
instrument count attached**, and a significant rap arm will be treated as
provisional pending a second rap corpus rather than as a finding. The sonnet
arm, predicted null across all three instruments, is the one that can be
believed if it stays null.

## What would falsify this

- P3 fires: everything is deleted, and the window is simply too wide to be
  corrected at any α.
- P1 fails: saturation stays above the ceiling even under Bonferroni, which
  would mean the events are not driven by multiplicity after all and the
  diagnosis in RESULTS_MATRIX.md was wrong.
- P2 fails: the corrected false-event rate exceeds α materially, meaning the
  within-item null does not represent chance for this population — the same
  class of error as the matrix's line-final calibration.
