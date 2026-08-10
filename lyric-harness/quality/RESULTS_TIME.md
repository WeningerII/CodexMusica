# Results — the time layer

> **ONE EXPLANATION HERE IS SUPERSEDED.** This document attributes the
> instrument's saturation to the comparator's additive floor. That was wrong,
> and `RESULTS_MATRIX.md` shows why: fitting the matrix removed the floor and
> saturation got *worse* at matched false-positive rate (97% against 95%).
> Saturation is a **multiple-comparisons artifact** — ~135 comparisons per
> stressed syllable, so even the amendment's theta 0.90, which is a 2.4%
> per-pair FPR, gives `1 - 0.976^135 ~ 96%`. Holding saturation near 30% would
> need a per-pair FPR of ~0.26%, far stricter than any theta in use. The fix is
> family-wise error control across the window, or a smaller window — which is
> why the amendment's window change from 32 to 16 did most of the work. The
> null results below are unaffected; only the diagnosis of the first failure
> changes.

Run against `TIME_PREREGISTRATION.md` as amended by
`TIME_PREREGISTRATION_AMENDMENT.md`. Both were committed before the numbers
existed; `git log` proves the order. Reproduce with
`python3 quality/time_layer.py FILE`.

Amended parameters: theta 0.90, window 16 syllables, spans to 3, periods
{2,3,4,6,8}, 2000 permutations, saturation ceiling 0.75. Grid unit **stress**
is primary; **syllable** is reported as the pre-registered H5 sensitivity
check.

## Headline

**The layer is built, correctly instrumented, and finds nothing.** After
Benjamini-Hochberg at q=0.10, **no arm on either grid shows phase structure in
rhyme placement.** The predicted null held; the predicted effect did not
appear.

| arm | n | ran | median saturation | median p | sig at .05 | survives BH q=.10 |
|---|---|---|---|---|---|---|
| Shakespeare sonnets (stress) | 40 | 40 | 39% | 0.500 | 0/40 | **0** |
| generated sonnets (stress) | 20 | 20 | 33% | 0.361 | 2/20 | **0** |
| rap, whole verse (stress) | 1 | 1 | 35% | **0.626** | 0/1 | **0** |
| rap, 20-line blocks (stress) | 3 | 3 | 32% | 0.454 | 1/3 | 1 |
| Shakespeare sonnets (syllable) | 40 | 40 | 22% | 0.491 | 2/40 | **0** |
| generated sonnets (syllable) | 20 | 20 | 17% | 0.487 | 0/20 | **0** |
| rap, whole verse (syllable) | 1 | 1 | 18% | 0.515 | 0/1 | **0** |

Saturation is now 17–39% across every arm, inside the 25–40% target the
amendment set, and **zero items were refused**. The instrument fix worked. What
it revealed is an absence.

## The predictions, as they came out

**H1 — rap organizes internal rhyme against a period; the sonnet does not.
FAILED, in its positive half.**

The sonnet arm was predicted null and **is** null: 0 of 40 significant, median
p exactly 0.500. That half is confirmed, and it matters, because a significant
sonnet result would have meant the statistic was reading the pentameter.

The rap arm was predicted significant and is not. The registered unit is the
whole verse, and it lands at **p = 0.626** — not a weak effect, no effect. One
of three exploratory 20-line blocks reaches p = 0.005, which is more than
chance would usually give across three tests, but the pooled analysis with the
most data is flatly null and the block split was not registered. The direction
rap > sonnet is not supported.

**H2 — the recovered period is binary in rap. NOT EVALUABLE, and the question
was malformed.**

The observed argmax was P=8 in every rap arm and split 27/13 between P=8 and
P=6 across the sonnets. That looks like a finding and is an artifact. KL's
small-sample bias grows with bin count — E[KL] ≈ (P−1)/2n on noise — so a
maximum over the sweep lands on the largest period offered. Measured on pure
noise at n=40 over 120 slots, **the sweep chose P=8 65% of the time and P=6
35%**, against an observed sonnet split of 68%/32%. The two distributions are
indistinguishable.

The p-value is unaffected, because the null takes the same maximum. The
*period* is not, so `analyse()` now returns `period=None` unless p < .05 and
keeps the raw argmax in `period_argmax` with a note. Reading a period off a
null result is reading tea leaves, and this measure made it easy to do.

**H3 — the line-final tripwire. PASSED, after the registered version turned out
to be a tautology.**

As originally registered and run at theta 0.80, the control compared line-final
events against line-final slots when 86–100% of line-finals rhymed, so the
event set equalled the slot set and it could only ever return KL=0, p=1. A
control that cannot fire is not a control — doctrine 14, reproduced in this
module's own first draft, caught by running it. It now labels itself DEGENERATE
in that case instead of reporting p=1.0 as a pass.

At theta 0.90 the control became live: median saturation 35%, zero degenerate,
and it came out **null on all 20 sonnets** (median p = 0.388, 0 significant).
The tripwire did not fire. Raising theta to desaturate the primary statistic
rescued the control as a side effect.

**H4 — the null preserves the marginals. HOLDS by construction**, and is tested
rather than asserted: the permutation draws the same number of events from the
same eligible slots, so line lengths, the stress layout, and anything the form
forces are all present in the null.

**H5 — grid-unit sensitivity. The warning was justified.** The two grids
disagree about which arms are nominally significant: on stress, 0/40 sonnets
and 2/20 generated; on syllable, 2/40 sonnets and 0/20 generated. Nothing
survives correction on either, so the consistent reading is that all of it is
noise — but the reversal is exactly the instability the prediction warned
about, and it means no single-grid result from this layer should ever be
quoted alone.

## The post-hoc control, and a concern that turned out not to be real

`mode="against_all"` compares line-final events against **all** grid slots and
was expected to fire hard: in an isosyllabic form every line-final syllable
should share a phase while the slots spread across all of them. It did not
fire — 0 of 14 significant, median p = 0.53.

The reason is worth keeping. Sonnets are isosyllabic but **not
iso-stress-count**: lines vary in how many stresses they carry, so line-final
position varies on the stress grid and the degeneracy never materializes there.
The concern was correct in principle for a syllable grid and does not bite on
the primary one. Excluding line-final events from the primary statistic was
therefore unnecessary caution rather than a fix — defensible, but it should be
recorded as caution and not as a defect avoided.

## What this does and does not establish

It establishes that **rhyme placement in this material carries no detectable
periodic structure in syllable or stress coordinates**, under a declared
isochrony assumption, at a strong-rhyme threshold, with a properly calibrated
null. That is a real negative result and it is reported as one.

It does not establish that rap is unmetrical. Three limits, all structural:

1. **There is no audio.** Isochrony is assumed and is false for stress-timed
   English. The layer measures rhyme placement in symbolic coordinates, not in
   time, and no output of it should be worded otherwise.
2. **One rap verse.** The registered rap arm has n=1. A negative result at n=1
   is barely a result; the sonnet arm is the only one with real power, and its
   prediction was that it would find nothing.
3. **theta 0.90 narrows the claim.** Events are strong internal matches only,
   well above the harness's declared `theta_rhyme` of 0.75. Weaker internal
   rhyme is invisible to this run, and weaker internal rhyme is a large part of
   what the craft actually uses.

## What would move this forward

1. **Family-wise error control across the window.** This was written as "fit
   the substitution matrix", and the matrix has since been fitted: it does not
   help, and at matched FPR it saturates worse. The blocker is the number of
   comparisons, not the quality of any one of them. See RESULTS_MATRIX.md.
2. **More rap, from more writers.** n=1 is not a corpus. This is the same
   lesson as doctrine 8, arriving in a new layer.
3. **Audio, or a declared tempo.** Everything above is conditional on an
   assumption known to be false. Until timing enters the project, this layer
   cannot make a claim about time, and calling it "the time layer" is
   generous — it is a placement layer.
