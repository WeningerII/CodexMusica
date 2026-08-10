# Results — the fitted substitution matrix

Run against `MATRIX_PREREGISTRATION.md`, committed before any fitting code
existed. Reproduce with `python3 quality/eval_matrix.py`. Every evaluation
number is 5-fold cross-validated; a matrix never scores an item that was in its
own training folds.

## Headline

**The additive floor is genuinely gone. Removing it buys a marginal
improvement in separation and still doubles the false-positive rate on free
verse.**

> **THE FIRST RUN OF THIS EVALUATION WAS WRONG AND IS CORRECTED HERE.** Its
> training data was contaminated: `endword()` did not normalize the U+2019
> apostrophe that Gutenberg's sonnets use, so `prepar’d` split into `prepar`
> and `d`, and the bare letter **"d" appeared as an end word 75 times** ("st"
> 6, "er" 1). **95 of 1028 mandated training pairs — 9.2% — had a corrupted
> side.** `word_syllable_map` in the harness has always normalized it; this
> function did not. The defect was found while calibrating the conjunctive
> band, by looking at which mandated pairs had the lowest coda agreement and
> seeing `d/held`, `breast/d`, `rest/d` in the list.
>
> On clean data **P4 and P6 flip from FAILED to CONFIRMED**, and P5's margin
> shrinks a long way. The recommendation below does not change, but the
> reasoning does, and the numbers below are the corrected ones.

| prediction | verdict | contaminated first run |
|---|---|---|
| P1 — the documented leak closes | **FAILED** | FAILED |
| P2 — stress goes to zero unprompted | **CONFIRMED** (−0.0999) | marginal (−0.107) |
| P3 — an absent coda stops paying full price | **CONFIRMED** | CONFIRMED |
| P4 — held-out separation improves | **CONFIRMED, marginally** (0.9177 vs 0.9146) | FAILED (0.9031 vs 0.9043) |
| P5 — the negative control tightens | **FAILED** (21.3% vs 18.0%) | FAILED badly (35.3% vs 18.7%) |
| P6 — the sonnet battery improves | **CONFIRMED, marginally** (19.1% vs 19.5%) | FAILED (21.4% vs 21.2%) |
| P7 — the time layer becomes measurable | **FAILED** (97% vs 95% saturation) | FAILED |
| P8 — TRIPWIRE: Early Modern sound changes | **FIRED** | FIRED |

**Recommendation, unchanged: do not ship it as the default comparator.**
The separation gain is +0.003 AUC, which is inside anyone's noise, and the
negative control is still worse. `Declaration.fitted` stays `False`, and a
regression test enforces that nothing switches by accident.

P5's earlier 35.3% was inflated twice over — once by the contamination and once
by an unfair comparison: `infer_chains` applied the conjunctive band to the
hand-set branch and bypassed it for the comparator. The band is orthogonal to
the comparator and now applies to both, which is why the honest figure is
21.3% against 18.0%.

## What did work

**P2 — the free 0.15 stopped being free.** The anchor is defined as the last
primary stress, so both sides are stressed by construction and the hand-set
comparator handed 0.15 of a 0.75 band to every pair, rhyming or not. Fitted,
that cell is **−0.0999 bits** — it fails to be earned rather than being zeroed
by hand, and lands just inside the registered ±0.10 band. On the contaminated
first run it was −0.107 and was reported as marginal.

**P3 — two absent codas stopped scoring like two matching ones.**
`cluster_sim([], [])` returned 1.0, the full coda weight for having nothing in
common. Fitted: **empty/empty −0.000 bits**, against matching consonant codas
at N +3.22, T +3.06, D +3.41, S +3.81, L +4.41.

Both structural gifts are gone, and the scale now has a true zero: a
substitution no more likely under rhyme than chance scores 0, and one less
likely scores negative. `channel_weights` is eliminated — the relative
contribution of nucleus, coda and onset falls out of estimation rather than
being hand-set. Doctrine 5's fitting path is now walked, and its answer is that
walking it gains +0.003 AUC — real in sign, negligible in size, and not worth
the register-specificity it drags along.

## Why P1 failed: the floor was not what carried `sun`/`much`

> **P1 is now fixed, elsewhere.** The diagnosis below led directly to
> `quality/BAND_PREREGISTRATION.md` and the conjunctive band, which closes
> `sun`/`much` by typing it ASSONANCE. See `RESULTS_BAND.md`.

`sun`/`much` scores **+3.600 bits against a +2.614 threshold** — still inside
the band. The project has called this an "additive-floor leak" since the first
commit, and that diagnosis was **wrong about its own example**.

`sun` is S-AH-N and `much` is M-AH-CH: the nucleus is *identical*. Half the
hand-set 0.772 was earned. What the log-odds framework preserves is not the
floor but **channel compensation** — summing log-odds across channels lets a
large positive nucleus term outweigh a negative coda term, exactly as adding
weighted similarities did. Removing an unconditional floor does nothing about
compensation, because they are different defects.

`eye`/`memory` rejects at −2.013 and `cat`/`dog` at +0.352. On clean data
`dawn`/`again` now sits exactly at the threshold. The compensation case did not
close, and no comparator was ever going to close it.

Closing `sun`/`much` needs a **conjunctive band rule** — rhyme requires the
coda to match, not merely for the total to clear a bar — which is a property of
the band, not the comparator. The harness already has one such rule in the rawi
profile's `require_final_consonant`.

## Why P7 failed, and what actually causes the saturation

At a matched 5% false-positive rate the fitted comparator saturates the time
layer **worse** than the hand-set one: 97–98% against 95%. So the comparator
was never the reason the time layer had no power.

Calibrating the hand-set thresholds against the same random-pair background
shows what was really going on:

| hand-set theta | actual FPR on random pairs |
|---|---|
| 0.75 | 11.8% |
| 0.80 | 7.7% |
| 0.85 | 5.0% |
| 0.90 | **2.4%** |
| 0.95 | 1.7% |

The time layer's registered window gives each stressed syllable on the order of
135 comparisons. At the amendment's theta 0.90 — already a 2.4% per-pair FPR —
the chance of at least one false hit is `1 − 0.976^135 ≈ 96%`, which is the
saturation that was observed.

**Saturation is a multiple-comparisons artifact, not a comparator artifact.**
No achievable per-pair threshold fixes it: holding saturation near 30% over 135
comparisons needs a per-pair FPR around **0.26%**, far stricter than any theta
in use. The fix is to control the family-wise error rate across the window or
to shrink the window — which is why the amendment's window change from 32 to 16
moved saturation from ~92% to ~35% while its threshold change only moved the
FPR from 7.7% to 2.4%.

This supersedes the explanation given in `RESULTS_TIME.md`, which attributed
the saturation to the comparator's additive floor. That attribution was wrong.

## Why P5 failed: the fix introduced a gift of its own

On 150 lines of Whitman free verse, at matched 5% FPR:

| comparator | lines captured in chains |
|---|---|
| hand-set, theta 0.82 | 20.0% |
| hand-set, theta 0.85 (= 5% FPR) | **18.0%** |
| fitted at 5% FPR, stress channel dropped | **21.3%** |
| fitted at 10% FPR | 26.0% |

(All four rows have the conjunctive band applied, which is why the hand-set
baseline reads 20.0% rather than its pre-band 26.0%. The contaminated run
reported 63.3% and 35.3% here; both were inflated by the corrupted end words
and by the band being applied to only one side of the comparison.)

The negative control caught a defect in the new code. The stress channel, which
went to ≈0 for the stressed–stressed case exactly as predicted, went to
**+5.71 bits for unstressed–unstressed** — on 200 real observations, not a
smoothing artifact. When one anchor is unstressed via final promotion the other
usually is too; that is true, and it is not evidence of rhyme. Whitman's long
lines end unstressed constantly, so the gift fired everywhere.

The post-hoc correction is to drop the stress channel entirely: anchor stress is
**conditioning information** — it says which anchors are comparable — and
putting it into a likelihood ratio whose background model treats it as
independent is a modelling error. That halves the leak. It is still nearly
double the hand-set baseline, and held-out AUC is unchanged at 0.9031.

So the fitted matrix removed one unconditional gift and introduced another, and
the pre-registered negative control is what found it.

## P8 — the tripwire fired, twice

**First, on a defect in the fitting code.** The initial top learned nucleus
correspondences were UH~OY **+3.81 bits**, OY~ER +1.37, OY~AW +1.26 — all on
**zero observations in both classes**. OY is 0.1% of the corpus, so its
marginal product is ~1e-5 and the smoothing prior alone manufactured
confidence; seven of the top twelve were this artifact. Fixed with evidence
shrinkage (`n / (n + kappa)`), so a cell with no observations scores 0, which
is what no evidence means. A regression test sets kappa=0 to show the artifact
returning, so the guard is demonstrably load-bearing.

**Then, on the substance.** After shrinkage, what survives is:

| correspondence | bits | n |
|---|---|---|
| UW ~ AH | **+1.30** | 22 |
| ER ~ AO | +0.53 | 7 |
| ER ~ AH | +0.50 | 6 |
| UH ~ AH | +0.27 | 2 |
| EH ~ AA | +0.06 | 16 |

`UW~AH` is `love`/`prove`. `ER~AO` is the rhotic class the battery already
documents inside its 8.0% residue. Exactly one substantial learned
correspondence exists and it is an **Early Modern English sound change**.

**The matrix is period-specific and is declared as such.** It may not be
shipped as a general comparator for contemporary lyrics. This is doctrine 11
arriving in a third place, after `syntactic_inversion_rate` turned out to be an
archaism detector and `rhyme_predictability`'s replication turned out to be an
OOV artifact.

## A calibration mismatch worth naming

Thresholds here are calibrated on **random line-final word pairs from
Shakespeare** and then applied to arbitrary syllable spans inside lines
(time layer) and to Whitman's line finals (P5). That is a domain mismatch of
the same class as the slop floor's length mismatch: a threshold measured on one
distribution and applied to another. It is part of why the fitted comparator
looks worse in application than its AUC suggests, and any future use of this
matrix should calibrate on the population it will actually score.

## What would make this work

1. **A conjunctive band rule** for the coda, which is what `sun`/`much`
   actually needs. Compensation is not a comparator problem.
2. **Training data that is not one author in one period.** The single learned
   correspondence is a sound change specific to the training corpus. Doctrine 8
   arriving in a fourth place.
3. **Family-wise error control in the time layer**, not a better per-pair
   score. That is the real blocker there, and it is now quantified.
