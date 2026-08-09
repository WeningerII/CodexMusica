# Cross-tradition matrix — pre-registration, **BLOCKED**

**Status: NOT ADOPTED. Do not run this design.** Four designs were drafted and
each was adversarially attacked. Two independent attacks found that the
headline result is *mechanically guaranteed* by the design's own construction.
Committing it would have locked in an artifact as a pre-registered prediction.

This file records the design, the defects, and the fixes — because a design
that must not be run is worth documenting precisely so it is not rebuilt.

## What the design got right, and should be kept

**1. Predicted inversion as the primary test.** The headline statistic is not
"does feature *f* work across traditions" but "does the sign of *f* flip across
the partition assigned to *f* in advance". A prediction of inversion is a real
prediction and is more informative than a prediction of agreement.

**2. The centrepiece hypothesis is genuinely good.** Rhyme predictability is
predicted to invert by **transmission channel**, not by typology: novelty is
rewarded where texts are *selected and reprinted*, memorability is rewarded
where texts must be *re-performed from memory*. Under it, the English result
(AUC 0.304, survivors LOWER) is not the universal answer but one print-tradition
datapoint, and Finnish is predicted to return the opposite sign for a stated
reason.

**3. Script depth as a pre-registered confound, tested against every feature.**
This generalises this project's worst failure. The rhyme-predictability result
was an OOV artifact — a lexicon's inability to *read* the text registering as a
property of the text. Cross-linguistically that failure has a name and a
gradient: orthographic depth. Any feature whose cell-level effects order better
by script depth than by its assigned substantive partition is reported as a
**measurement artifact**, not a parameter.

**4. Four unrhymed controls, not one** — ja, grc, hbo and fi (alliterative, not
rhymed). One control can fail idiosyncratically; four cannot.

**5. Unit-of-analysis discipline.** Spanish canonicity varies at *author* level,
so its effective n is 525 authors, not 6,166 sonnets. Hebrew is scored at
chapter, Punjabi at shabad, Czech matched *within* author. Getting this wrong
inflates n by an order of magnitude and is a standard way to manufacture
significance.

**6. Honesty about coverage** — only 8 of 14 cells carry an admissible label,
stated up front rather than papered over.

## Defect 1 — the frequency list is built from the label

**This is the blocking defect, and it kills the centrepiece.**

The design builds per-cell leave-one-out frequency lists *from the admitted
pool*. The Finnish pool is **89,247 poems, not 7,555 types.** A type collected
in 362 variants contributes 362 near-identical texts to that pool. Leave-one-out
removes **one** of them.

So, after LOO:

- a content word unique to a singleton type has corpus count **0**
- the same word inside a 362-variant type has corpus count **361**

Any frequency-ranked feature at the marked position is therefore a monotone
function of variant count — **and variant count is the label.** The predicted
Finnish inversion has a purely mechanical route to confirmation with no
linguistic content whatsoever.

The formulaicity feature fails the same way: its background pool is the same
89k items, and the same-type guard does not exclude the tens of thousands of
poems supplied by *other* high-variant types. It measures "how much do you
resemble the songs that were sung a lot", which is the label again.

Czech has the same structure in a nastier form, because there it is
*label-conditional*: the positives are the poems appearing in two books, so
after item-level LOO a positive's own vocabulary survives once and a negative's
survives zero times. A poem-unique word moves from unseen to hapax, a large rank
move, **for positives only**.

**This is the OOV bug rebuilt in a new place, and the design believed it was the
fix.**

### Fix

Frequency lists must come from a corpus **independent of the labelled pool**.
The resources sweep already established `wordfreq` for ces (605,550 types), nl
(310,781) and spa (341,461), Apache-2.0 code over CC BY-SA data. Finnish needs
an external Finnish frequency list — *not* SKVR. Any within-corpus frequency
estimate must be justified against this defect explicitly, in writing, per cell.

## Defect 2 — the positive control is an identity, and it voids the correction

The design's "twin" control replaces each realised rhyme partner with **the
highest-frequency member of its own candidate field**. But the predictability
feature is *defined* as the percentile of the realised partner within that
field. In the twin the realised partner **is** the maximum by construction, so
the feature equals its ceiling exactly, for every item, in every cell. A
permutation test on that returns the smallest p the test can express. That is
not a positive control; it is an identity.

It cascades: the frequency-delta, function-word, type-ratio and final-length
features are all deterministic under the same substitution. Roughly **52 of the
80 tests in that arm are tautological.**

Worse, the length feature is the *designated negative control whose discovery
rate calibrates the multiple-comparison correction* — and it fires by Zipf's law
alone, since frequency and length are inversely related in every language. The
calibrator is pre-destined to trip, so the run ends either self-voided or in a
post-hoc rescue of the calibrator, which is the worst possible place to spend a
degree of freedom.

### Fix

A control may not be defined in terms of the same quantity the feature
measures. Build the twin by **shuffling realised rhyme partners between poems
within a cell**, which preserves the marginal frequency distribution while
destroying the poem-specific choice. And the correction calibrator must be a
feature with no mechanical route to firing — not one that Zipf guarantees.

## The rule this produces

Both defects are the same mistake at different addresses: **a quantity derived
from the labelled data was used to measure that data.** Add to the doctrine —

> Any resource used to score a cell must be independent of that cell's label.
> Frequency lists, background corpora, controls and calibrators all count as
> resources. Where independence is impossible, the dependence must be stated
> and its direction argued before the run, not discovered after.

## What happens next

1. Rebuild the frequency layer on independent corpora, per cell.
2. Redefine the twin control as a within-cell shuffle.
3. Choose a calibrator with no mechanical firing route.
4. Re-attack the revised design **before** committing it.

Until all four are done, **no non-English cell should be scored**, because the
result would not be interpretable regardless of which way it came out.
