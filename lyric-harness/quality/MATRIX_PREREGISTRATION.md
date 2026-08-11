# Pre-registration — the fitted substitution matrix

Committed **before** any fitting code exists. `git log` proves the order.

Closes known gap 2 and resolves doctrine 5, which has said since the first
commit that the weights are hand-set and that the fitting path is
Hirjee-Brown log-odds — *"do not tune by single examples — accumulate, then
fit."*

## The defect, measured

The comparator is additive over channels with hand-set weights, and two of the
three channels pay out unconditionally at the anchor:

| pair | total | nucleus | coda | stress |
|---|---|---|---|---|
| `sun`/`much` | **0.772** | 1.00 | 0.347 | **1.00** |
| `dawn`/`again` | 0.729 | 0.458 | **1.00** | **1.00** |
| `love`/`prove` | 0.784 | 0.568 | **1.00** | **1.00** |
| `eye`/`memory` | 0.671 | 0.342 | **1.00** | **1.00** |
| `night`/`light` | 1.000 | 1.00 | 1.00 | 1.00 |

Two structural gifts:

1. **Stress is free.** The anchor is *defined* as the last primary stress, so
   both sides are stressed by construction and `st` is 1.0 in every row above,
   including the ones that do not rhyme. That is `channel_weights["stress"]` =
   **0.15 handed out unconditionally**.
2. **An empty-vs-empty coda scores 1.0.** `cluster_sim([], [])` returns 1.0, so
   two open syllables collect the full 0.35 coda weight for having nothing in
   common.

So a pair sharing *nothing* still floors at 0.15, and two open stressed
syllables floor at **0.50** before the vowel is examined. In `dawn`/`again`,
69% of the 0.729 is floor. The band threshold is 0.75, so the leak sits
directly under it and `sun`/`much` clears it.

## The fix

Replace additive feature similarity with **log-odds**, per channel:

```
LO(a, b) = log2 [ P(a, b | rhyme) / (P(a) · P(b)) ]
```

and combine by **summation of log-odds**, which is a log-likelihood ratio under
conditional independence between channels.

This is not a re-tuning; it changes the shape of the scale. A substitution no
more likely under rhyme than under chance scores **zero**, and one less likely
scores **negative**. There is a true zero, so nothing can accumulate a floor
from channels that carry no information — and a channel that is constant by
construction, like stress at the anchor, contributes ≈ 0 automatically rather
than having to be zeroed by hand.

It also **removes the weights entirely**. `channel_weights` and
`channel_weights_interior` are hand-set numbers that log-odds estimation makes
unnecessary: the relative contribution of nucleus, coda and onset falls out of
how informative each actually is. `Declaration.fitted` flips to True only when
a fitted matrix is loaded.

## Training data and the independence requirement

Positive class: **mandated rhyme pairs from scheme-labelled corpora** — the
1064 pairs the 152 sonnets mandate under ABABCDCDEFEFGG, plus the Lear
limericks under AABBA. These are rhymes *by the form*, not by anyone's
judgement, which is what makes them admissible.

Background: **random non-mandated line-final pairs drawn from the same
corpora**, so the phoneme marginals are the corpus's own and the log-odds
cannot learn a corpus-vs-dictionary difference and call it rhyme.

Smoothing: the existing hand-set similarity, normalized, is used as the
**prior**, with a declared concentration α. Low-count cells therefore fall back
to current behaviour and high-count cells are corrected by data. Coverage is
never a cliff.

**Doctrine 13 applies and is enforced by k-fold.** A matrix fitted on the
sonnets may not be used to score those same sonnets. All reported evaluation
numbers are cross-validated: fit on k−1 folds, score the held-out fold. A
full-data matrix may be shipped for production use, but every number in
RESULTS_MATRIX.md is held out, and the two are stored under different names so
they cannot be confused.

## Predictions

**P1 — the documented leak closes.** `sun`/`much` falls below the calibrated
threshold. Direction: **down**, and below the band.

**P2 — stress goes to zero without being told to.** The fitted log-odds for
the stress channel at the anchor is within ±0.10 bits of zero, because it is
constant by construction. This is the structural claim: the free 0.15 is not
removed by hand, it fails to be earned.

**P3 — empty-vs-empty coda stops paying full price.** Two absent codas score
strictly less than two matching present codas.

**P4 — held-out separation improves.** The fitted score separates mandated
rhyme pairs from random line-final pairs at a higher AUC than the hand-set
score, on held-out folds.

**P5 — the negative control tightens.** Whitman free-verse chain capture falls
below its documented 26.0% at a threshold calibrated to the same false-positive
rate.

**P6 — the sonnet battery improves.** Held-out mandated-pair violations fall
below the documented 8.0% (85/1064).

> **POST-HOC NOTE, 2026-08-10.** The 8.0% baseline is miscomputed: 50 of the
> 1064 mandated pairs are REFUSALS, counted in both numerator and denominator.
> The pre-band baseline on judged pairs is 35/1014 = 3.5%. P6 was scored against
> a 5%-FPR calibrated cut and reported 19.1% vs 19.5%, a comparison internal to
> that run and unaffected. The prediction text is left exactly as registered.

**P7 — the payoff: the time layer becomes measurable.** At a threshold
calibrated to the same FPR, event saturation in `quality/time_layer.py` falls
below its 0.75 ceiling on the corpora that ran at 87–97%. This is the whole
reason the matrix is being fitted now; the time layer's registered run had no
power because the comparator's floor made nearly every stressed syllable a
rhyme event.

## The tripwire

**P8 — NEGATIVE CONTROL, must come out null. The matrix must not be an Early
Modern sound-change detector.**

The training corpus is Shakespeare and Lear. Their mandated pairs include
correspondences that are rhymes in Early Modern English and not in General
American: `love`/`prove`, `eye`/`memory`, the archaic `-st` morphology, the
rhotic ER/AOR class. These are exactly the 8.0% residue the battery already
documents.

A log-odds fit will happily learn them, and then the "universal" comparator is
a period artifact — which is doctrine 11 arriving in a new place, after
`syntactic_inversion_rate` turned out to be an archaism detector and
`rhyme_predictability`'s replication turned out to be an OOV artifact.

So: the top learned nucleus correspondences will be inspected and reported. If
the Early Modern classes rank among them, the matrix is **period-specific**,
must be declared as such, and may not be shipped as a general comparator for
contemporary lyrics. P6 improving *because* the matrix learned Early Modern
phonology would be a failure wearing the costume of a success, and P6 will be
read together with P8, never alone.

## What would falsify the fix outright

- P2 fails: stress retains real weight, meaning the "constant by construction"
  reasoning is wrong and something else is going on at the anchor.
- P4 fails: the fitted score separates no better than the hand-set one, in
  which case the additive floor was not costing accuracy and only the *scale*
  was wrong.
- P7 fails: saturation stays above the ceiling. Then the floor was not what
  made the time layer unmeasurable, and the honest conclusion is that internal
  rhyme at any threshold is simply dense in English verse.
- P8 fires and the effect is large enough that removing the Early Modern
  classes reverses P4 or P6. Then there is no general matrix here, only a
  Shakespeare one.
