# Pre-registration — survival discrimination, English cell

**Committed before any feature code was written.** Check `git log` on this file
versus `features.py`: the labels and predicted directions below were fixed first,
so no feature can be fitted to a label it has already seen.

## Why this corpus, and why no corpus is privileged

The design is *survived vs. forgotten, holding era, idiom and publishing system
constant*. That design is **language-agnostic by construction**: it requires only
a tradition with high production volume and a surviving curation record, and
those exist in many traditions. No single corpus — in any language — is the
oracle, and none should be named as the intended one.

That is not a stylistic preference. It is forced by this study's own result:
five of ten features **invert** between the two experiments below. A feature set
fitted to one corpus does not return a narrow answer, it returns a confidently
wrong one. Privileging any single corpus makes every downstream conclusion hang
on that choice, which is precisely the failure mode to avoid.

This run uses Shakespeare because it is the only contrast reachable from this
container (see the network note in `fetch_data.py`) and because within-author
comparison eliminates confounds by construction. It is **an instance of the
design, not the referent of it.** English is one cell in a matrix. Results here
are not evidence about verse in general until at least one non-English cell has
been run.

## Experiment 1 — within-author survival (clean design, weak power)

**Contrast:** Shakespeare's sonnets that entered the anthology canon vs. those
that did not.

One author, one form, one metre, one register, one publication event (1609).
Era, genre, medium, market and idiolect are eliminated *by construction* rather
than by statistical control. This is the strongest confound elimination available
for a survival question, and it is why n=15 is worth running at all.

**Positive class (survived, n=15).** Sonnets appearing in effectively every major
English-verse anthology:

    18, 29, 30, 55, 60, 65, 71, 73, 94, 106, 116, 129, 130, 138, 146

**Ambiguous middle (EXCLUDED from the contrast, n=20).** Frequently but not
universally anthologized; excluded so the contrast is between clear cases:

    12, 20, 33, 53, 54, 64, 66, 87, 91, 97, 98, 104, 107, 110, 128, 144,
    147, 151, 1, 2

**Negative class (forgotten).** All remaining sonnets (n=119).

**Label provenance — this is the weakest link in the whole study.** The
anthologization label is derived from model knowledge of the reception history,
not from a machine-readable anthology index (Palgrave, the Oxford Book of English
Verse and every other source are behind the same 403). Anthologization is a fact
about the world rather than a taste judgment, which is what makes it admissible
at all, but it is unverified here. **Any result below is provisional until the
label is rebuilt from an actual anthology concordance.** Flagged loudly, not
buried.

## Experiment 2 — generated-text detection (strong power, real confound)

**Contrast:** all 154 Shakespeare sonnets vs. 154 model-generated sonnets written
to the same form, metre and register.

Power is good. The confound is that generation-in-imitation leaves imitation
artifacts, so a separating feature may be detecting *pastiche* rather than
*slop*. Reported separately from Experiment 1 for that reason, and never pooled.

## Pre-registered features and predicted directions

Ten features. Direction is committed now; a feature that separates with the
**wrong** sign counts as a failed prediction, not a success.

| # | Feature | Predicted in survived/human |
|---|---|---|
| 1 | `rhyme_predictability_mean` — mean percentile of the chosen rhyme word among phonetically valid candidates ranked by frequency | **LOWER** |
| 2 | `rhyme_predictability_min` — the single least predictable rhyme in the poem | **LOWER** |
| 3 | `concreteness_mean` — mean Brysbaert concreteness over content words | **HIGHER** |
| 4 | `concreteness_p90` — 90th-percentile concreteness (does one vivid image exist) | **HIGHER** |
| 5 | `abstract_noun_ratio` — nouns with concreteness < 2.5, as a fraction of nouns | **LOWER** |
| 6 | `pos_binding_diversity` — fraction of rhyme pairs whose members differ in part of speech (Wimsatt) | **HIGHER** |
| 7 | `mattr` — moving-average type/token ratio, length-normalized | **HIGHER** |
| 8 | `function_word_ratio` | **LOWER** |
| 9 | `syntactic_inversion_rate` — marked inversions per line | **LOWER** |
| 10 | `content_word_freq_mean` — mean corpus frequency rank of content words | **LOWER** (rarer words) |

No feature outside this list may be reported as a finding. Anything discovered
later is exploratory and must be labelled as such.

## Analysis plan

- **Statistic:** AUC (probability a randomly chosen survived item scores above a
  randomly chosen forgotten one). Reported with the observed direction.
- **Significance:** two-sided permutation test, 20,000 label shuffles. Chosen
  over a t-test because n=15 and nothing here is plausibly normal.
- **Multiple comparisons:** Benjamini–Hochberg FDR at q = 0.10 across all ten
  features. Uncorrected p-values are also printed, marked as such.
- **Power, stated in advance:** with 15 vs 119, only large effects (|AUC − 0.5| >
  ~0.20) are detectable. A null here is *weak* evidence of absence and must be
  reported that way.

## What would falsify the method

If **zero** features clear FDR with the predicted sign in Experiment 1, the
survival-oracle thesis has failed its cheapest available test, and the correct
conclusion is that it does not work — not that the corpus was too small. The
power caveat above is stated *before* seeing results precisely so it cannot be
retrofitted as an excuse.

If Experiment 2 separates strongly while Experiment 1 is null, the honest reading
is: these features detect *generated text*, not *quality*. That is still a useful
result for the harness — it is a slop floor — but it is not the survival oracle,
and it must not be relabelled as one.
