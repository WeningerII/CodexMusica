# Results — family-wise error control in the time layer

> **RAP ARM WITHDRAWN.** Every rap figure in this document came from
> `verse.txt`, an in-copyright commercial transcription that predated the
> provenance gate, was never declared in `data/sources.tsv`, and was never run
> through it. It is deleted. Under `ProvenanceDeclaration(term_years=95,
> current_year=2026)` the cutoff is **1931** and rap begins in **1979**, so no
> rap corpus is admissible here before roughly 2075 — the arm cannot be
> replicated, only replaced. The aggregate statistics are kept as an audit
> trail; the text is gone. H1's positive half is **untestable under the
> provenance policy** rather than refuted, and its replacement is a
> cross-family corpus defined by structural property rather than genre
> (`quality/POSITIVE_CONTROL.md`).

> **AND THE NULLS ARE WEAKER THAN THEY READ.** `quality/POSITIVE_CONTROL.md`
> measured the layer's minimum detectable effect for the first time. At the
> 5-8 events a corrected item actually carries, the statistic needs ~75% of an
> item's internal rhymes on ONE phase to reach 0.80 power; at 60% concentration
> it has 0.13. So a single item could never have answered the question, and the
> withdrawn rap arm's p = 0.132 / 0.626 / 0.087 did not mean "no effect", they
> meant **no power**. H1's positive half was never once tested. The sonnet arm
> IS genuinely null and now has pooled power behind it: Fisher across items
> gives p = 0.950 (stress, k=23) and p = 0.617 (syllable, k=26).


Run against `FWER_PREREGISTRATION.md`, committed before the code.
Regressions: `python3 quality/test_fwer.py`.

## Headline

**The layer is measurable for the first time, and it still finds nothing —
which is now a result rather than an absence of one.**

| prediction | verdict |
|---|---|
| P1 — saturation falls below the ceiling | **CONFIRMED** — 90–93% → **6–16%** |
| P2 — false-event rate controlled at α | **CONFIRMED** — measured 5.4% against α 5.0% |
| P3 — TRIPWIRE: the correction must not delete everything | **fired once, on a degenerate item; clear on real verse** |
| P4 — the registered hypotheses get a powered test | **CONFIRMED, and H1's positive half fails again** |

Before this, every null result from the time layer was uninterpretable: at
87–97% saturation the test had no power, so "found nothing" and "could not have
found anything" were the same output. Now the false-event rate is calibrated at
5%, saturation is in range, and the layer still reports no periodic structure.
That is a negative result with power behind it.

## What the correction does

A position is declared an event if **any** of its candidate pairs hits, so a
per-pair threshold cannot control the per-position error. The fix converts the
score into a currency that composes:

1. **A p-value per candidate pair**, against a null built by shuffling *which
   spans are paired* while preserving the span multiset — the `shuffle_twin`
   construction from `controls.py`. The null is the item's own spans, drawn
   from exactly the population being scored, which is the domain mismatch that
   broke the matrix's line-final thresholds.
2. **Šidák across each position's family**: per-pair cut `1 − (1−α)^(1/m)`.
   Bonferroni (`α/m`) agrees to within a position or two and is valid without
   the independence Šidák assumes — the comparisons overlap, so it is the safer
   of the two and both are reported.

Measured effect, at theta 0.80 and window 32 — the *original* registered
parameters, which the amendment had to abandon:

| item | uncorrected | Šidák | Bonferroni |
|---|---|---|---|
| sonnet 1 | 91% | **8%** | 8% |
| sonnet 2 | 93% | **11%** | 11% |
| lyric sheet | 90% | **8%** | 7% |
| rap, 20 lines | 91% | **13%** | 12% |

Median family size is 14–21 comparisons per position, not the ~135 estimated
from the window alone — the overlap and word-sharing filters remove most
candidates before they are ever scored. The correction is correspondingly
milder than predicted and still moves saturation by an order of magnitude.

## P2 — the null is calibrated, not assumed

Word-scrambled sonnets, which destroy rhyme structure while preserving
vocabulary and phonology:

```
scrambled sonnet 1   5.2%      4   3.0%
scrambled sonnet 2  11.7%      5   1.5%
scrambled sonnet 3   9.7%      6   1.4%
                              MEAN 5.4%   against a declared alpha of 5.0%
```

The within-item null delivers the rate it advertises. This is the check the
matrix's thresholds never had, and it is why those were wrong: they were
calibrated on line-final *word* pairs and applied to arbitrary *syllable
spans*.

## P3 — the tripwire fired, and the diagnosis is worth more than the pass

The first corrected run returned **0% saturation on every corpus**, which is a
layer with no power from the opposite direction. Two distinct causes, both
found by the registered tripwire:

**Cause 1 — the null was conditioned on the very filter it was calibrating.**
Chance pairs that failed the conjunctive band were *dropped* from the null
rather than counted. So the null consisted only of pairs that had already
passed the band, and nothing real could beat it. A chance pair that is not a
rhyme relation scores effectively −∞ and belongs in the denominator. Fixed;
`null_scores` now returns the valid-draw count separately and `_pvalue` divides
by it.

**Cause 2 — a genuinely degenerate item, which is not a bug.** A constructed
quatrain whose entire inventory is one rhyme class
(rattle/cattle/saddle/battle/gravel/travel) still returns zero, because **43%
of random re-pairings in that text already pass the band** against ~10% for
real verse. When almost half of all chance pairings rhyme, "this pair rhymes"
carries nearly no information *relative to that text*. That is a true property
of a within-item null, not something to tune away.

The layer now measures the null band-pass rate and **refuses above 25%**,
reporting "cannot tell" rather than "no rhyme". A milder planted rhyme — one
internal rhyme among otherwise unrelated words — survives at 15% saturation
with 3 events, which is what the tripwire was registered to check.

## BH is unusable at this resolution, and says so

Benjamini-Hochberg's threshold for the top-ranked p-value is `q/n`, and n here
is ~7000 candidate pairs, so it needs a tail resolved to ~1.4e-5. A 20000-draw
null resolves to 5e-5. Whether anything is discovered then depends on how many
pairs happen to pile up on the resolution floor rather than on the evidence —
measured before the guard: **63% saturation on one sonnet and 0% on the next
three.**

FWER needs no such resolution, because its cut is `α/m` with m ≈ 15, not `q/n`
with n ≈ 10⁴. BH now refuses with the number of draws it would need.

## P4 — the powered re-run of H1 and H2

Third instrument on the same hypothesis, at theta 0.80 / window 32 / Šidák
α=0.05, 2000 permutations:

| arm | n | ran | refused | median saturation | median p | sig at .05 | BH q=.10 |
|---|---|---|---|---|---|---|---|
| sonnets (stress) | 30 | 23 | 7 | 10.4% | 0.701 | 1/23 | **0** |
| rap, whole verse (stress) | 1 | 1 | 0 | 15.6% | **0.132** | 0 | **0** |
| rap, 20-line blocks (stress) | 3 | 3 | 0 | 12.6% | 0.374 | 0 | **0** |
| sonnets (syllable) | 30 | 26 | 4 | 6.3% | 0.554 | 1/26 | **0** |
| rap, whole verse (syllable) | 1 | 1 | 0 | 9.1% | 0.279 | 0 | **0** |

**H1's sonnet half holds for the third time.** Predicted null, and null under
every instrument the project has built.

**H1's rap half fails for the third time.** p = 0.132 on the registered whole-
verse unit — the closest it has come (0.626 under the amended instrument), and
still not close. Nothing survives correction on either grid.

**H2 remains unevaluable.** No arm is significant, so the recovered period is
withheld; reading an argmax off a null result is what `RESULTS_TIME.md`
established as tea leaves.

The registered honesty condition applies and costs nothing here, since there is
no positive result to discount: this was the third instrument, and a
significant rap arm would have been treated as provisional pending a second rap
corpus.

## The cost of the correction

**7 of 30 sonnets now refuse for too few events** (fewer than 4 surviving), and
the syllable grid refuses 4. That is the correction being strict enough that
short items lose their event set entirely. It is a real power cost, reported
rather than hidden, and it is the direction the tripwire warned about — just
not far enough to void the layer.

## What this establishes, and what it does not

**Establishes:** rhyme placement in this material carries no detectable
periodic structure in syllable or stress coordinates, under a declared
isochrony assumption, with a false-event rate calibrated at 5% and saturation
inside the ceiling. Three of the four registered predictions confirmed; the
fourth confirmed the instrument and refuted the hypothesis.

**Does not establish** that rap is unmetrical. The limits are unchanged and
structural: there is no audio, so isochrony is assumed and is false for
stress-timed English; the rap arm is **n=1**; and this is the third instrument,
so the hypothesis has had three chances and the corpus has had one.

The honest next step is a second rap corpus, not a fourth instrument.
