# Pre-registration — within-item respecification

**Committed before `within_item.py` exists.** Check `git log`: predictions here
were fixed before the code that tests them.

## The move

Every feature in the original ten is an **absolute** value — a level, compared
across items. Levels are exactly what carries era, register, author idiolect,
language typology, and the norming study a resource was built from. That is why
five of ten features inverted between designs, why `syntactic_inversion_rate`
turned out to be an archaism detector, and why the OOV defect could masquerade
as a quality signal.

The respecification: **every feature becomes a comparison of an item's marked
positions against that same item's own unmarked positions.**

- *Marked* = the rhyme-bearing word of each line (after radif stripping).
- *Unmarked* = the rest of the same poem.

The item is its own control. Era, register, author, language, form and
resource-calibration are all shared between the two subsets, so they cancel by
subtraction rather than by statistical adjustment.

This is not an analogy to the time-layer result, it is the same operation. Rhyme
lands on beat 4 at 2.90x in rap and 0.63x in sung pop — the absolute rate
inverts between genres of one language. What survives there is
KL(rhyme positions || that item's own syllable positions). Same structure.

### What this does and does not buy

**Buys:** era-drift immunity, author immunity, and — the important one —
resources no longer need to be *commensurable across languages*. A concreteness
norm still has to exist per language, but it never has to be calibrated against
the English one, because it is only ever compared to itself.

**Does not buy:** resource *existence*. A language with no concreteness norms
and no frequency list still cannot run features 2–4. Within-item normalization
weakens the requirement; it does not remove it.

## Features and predicted directions (survived / human)

`syntactic_inversion_rate` is **retired, not respecified** — the typology audit
identified two of its three patterns as Early Modern English period markers, and
a within-item version would still be measuring archaism.

| # | Feature | Definition | Predicted |
|---|---|---|---|
| 1 | `wi_predictability_advantage` | mean(observed predictability) − 0.5, where 0.5 is the exact expectation of a uniform draw from that pair's own candidate field | **LOWER** |
| 2 | `wi_concreteness_delta` | mean concreteness(rhyme words) − mean concreteness(non-rhyme content words) | **HIGHER** |
| 3 | `wi_abstract_delta` | abstract-noun ratio(rhyme nouns) − abstract-noun ratio(non-rhyme nouns) | **LOWER** |
| 4 | `wi_freq_delta` | mean frequency rank(rhyme words) − mean rank(non-rhyme content words); higher rank = rarer | **HIGHER** |
| 5 | `wi_function_delta` | function-word share(line-final) − share(non-final) | **LOWER** |
| 6 | `wi_binding_excess` | observed POS-binding diversity − its permutation expectation over that item's *own* line-final tag multiset | **HIGHER** |
| 7 | `wi_type_ratio` | distinct rhyme words / rhyme words, minus the item's own MATTR | **HIGHER** |
| 8 | `wi_conc_spread` | p90 − p50 of the item's own content-word concreteness | **HIGHER** |

Feature 1 is self-normalizing against candidate-field size, which was verified
mean-neutral under field inflation (1x–8x shifted the mean by +0.0000), so it
carries no lexicon-size dependence.

Feature 6 replaces a raw fraction with an excess over the item's own null. If a
poem ends 90% of its lines on nouns, a differing pair is unlikely *by
construction*; the old version scored that as a defect. The permutation baseline
removes it.

## The structural predictions — the actual test

These matter more than any individual feature.

**P1. Experiment 2's joint held-out AUC will FALL substantially below 0.975.**
That number is carried by `mattr`, `function_word_ratio` and five wrong-sign
features — i.e. by register and period. Within-item normalization removes
register and period by construction. **If Experiment 2 stays at ~0.975, the
respecification did not work**, and the honest reading is that the within-item
features are still reading style rather than quality.

**P2. Experiment 1's joint held-out AUC will hold or improve on 0.659.** Within
one author, era/register/idiolect are already constant, so within-item
normalization should cost little there while removing noise. If Experiment 1
*also* collapses, then there was never a survival signal and the original 0.709
was noise at n=15 — which the power caveat always allowed.

**P3. Wrong-sign count in Experiment 2 will fall below five.** Sign inversions
were the signature of level-based features tracking period. If within-item
features still invert, the diagnosis was wrong.

## What would falsify the whole respecification

If P1 fails (Exp 2 stays high) **and** P3 fails (signs still invert), then
within-item normalization is not removing what it was supposed to remove, and
the correct conclusion is that these features cannot be rescued by
normalization — they should be replaced, not respecified.

A result where Exp 2 falls to near chance **and** Exp 1 also falls to near
chance is *not* a failure of this pre-registration. It is the finding that the
quality layer has no demonstrated signal at all, and it must be reported as
such rather than reframed.
