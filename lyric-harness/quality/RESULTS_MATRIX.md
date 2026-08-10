# Results — the fitted substitution matrix

Run against `MATRIX_PREREGISTRATION.md`, committed before any fitting code
existed. Reproduce with `python3 quality/eval_matrix.py`. Every evaluation
number is 5-fold cross-validated; a matrix never scores an item that was in its
own training folds.

## Headline

**The additive floor is genuinely gone. Removing it bought nothing, and cost
something.**

| prediction | verdict |
|---|---|
| P1 — the documented leak closes | **FAILED** |
| P2 — stress goes to zero unprompted | **CONFIRMED in substance, marginal on the letter** |
| P3 — an absent coda stops paying full price | **CONFIRMED** |
| P4 — held-out separation improves | **FAILED** (0.9031 vs 0.9043) |
| P5 — the negative control tightens | **FAILED badly** (35.3% vs 18.7%) |
| P6 — the sonnet battery improves | **FAILED** (21.4% vs 21.2%) |
| P7 — the time layer becomes measurable | **FAILED** (97% vs 95% saturation) |
| P8 — TRIPWIRE: Early Modern sound changes | **FIRED** |

The registered falsification criterion for P4 read: *"the fitted score
separates no better than the hand-set one, in which case the additive floor was
not costing accuracy and only the scale was wrong."* That is what happened.

**Recommendation: do not ship it as the default comparator.**
`Declaration.fitted` stays `False`, and a regression test enforces that nothing
switches by accident.

## What did work

**P2 — the free 0.15 stopped being free.** The anchor is defined as the last
primary stress, so both sides are stressed by construction and the hand-set
comparator handed 0.15 of a 0.75 band to every pair, rhyming or not. Fitted,
that cell is **−0.107 bits** — it fails to be earned rather than being zeroed
by hand. The registered band was ±0.10, so this misses the letter of the
prediction by 0.007 bits and is reported as marginal rather than as a win.

**P3 — two absent codas stopped scoring like two matching ones.**
`cluster_sim([], [])` returned 1.0, the full coda weight for having nothing in
common. Fitted: **empty/empty −0.000 bits**, against matching consonant codas
at N +3.17, T +2.94, D +3.54, S +3.79, L +4.45.

Both structural gifts are gone, and the scale now has a true zero: a
substitution no more likely under rhyme than chance scores 0, and one less
likely scores negative. `channel_weights` is eliminated — the relative
contribution of nucleus, coda and onset falls out of estimation rather than
being hand-set. Doctrine 5's fitting path is now walked, and its answer is that
walking it does not help.

## Why P1 failed: the floor was not what carried `sun`/`much`

`sun`/`much` scores **+3.532 bits against a +2.522 threshold** — still inside
the band. The project has called this an "additive-floor leak" since the first
commit, and that diagnosis was **wrong about its own example**.

`sun` is S-AH-N and `much` is M-AH-CH: the nucleus is *identical*. Half the
hand-set 0.772 was earned. What the log-odds framework preserves is not the
floor but **channel compensation** — summing log-odds across channels lets a
large positive nucleus term outweigh a negative coda term, exactly as adding
weighted similarities did. Removing an unconditional floor does nothing about
compensation, because they are different defects.

`dawn`/`again`, which really was a floor case at 69% floor, now correctly
rejects (+2.488 against +2.522). `eye`/`memory` rejects at −2.158. `cat`/`dog`
rejects at +0.245. The floor cases closed; the compensation case did not.

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
| hand-set, theta 0.82 (documented baseline) | 26.0% |
| hand-set, theta 0.85 (= 5% FPR) | **18.7%** |
| fitted, as registered | **63.3%** |
| fitted, stress channel dropped (post-hoc) | **35.3%** |

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
