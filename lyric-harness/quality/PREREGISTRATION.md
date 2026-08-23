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
| 10 | `content_word_freq_mean` — mean corpus frequency rank of content words | ~~**LOWER**~~ **HIGHER** (rarer words) — see the amendment below |

No feature outside this list may be reported as a finding. Anything discovered
later is exploratory and must be labelled as such.

## Amendment 2026-08-22 — feature 10's direction, by owner ruling

**Row 10 said two opposite things.** `freq_rank` is 0-based and ascending by
commonness (`the` 2, `love` 122, `thistle` 35,537), so **LOWER** is *more
common* while the parenthetical says *rarer*. `quality/features.py` encoded
`lower`, following the word; `quality/within_item.py` has always encoded
`wi_freq_delta: "higher"` for the same quantity, following the gloss. One
prediction, two readings, and the two modules disagreed with each other for
the life of the feature set (doctrine 1).

**RULED 2026-08-22: THE GLOSS WAS THE COMMITMENT.** The prediction is RARER
WORDS in survived/human, and the direction that encodes it is **higher**.
`~~lower~~` is struck in place rather than deleted (doctrine 17).

**THIS IS AN AMENDMENT TO A COMMITTED DIRECTION AND IT IS DECLARED AS ONE.**
The document's rule — *"Direction is committed now; a feature that separates
with the wrong sign counts as a failed prediction, not a success"* — is what
makes the amendment consequential rather than clerical, so it is recorded
with what it costs and what it buys:

- **It changes no measurement.** `permutation_test` is direction-free and
  `joint_classifier` fits logistic regression on raw values, so every AUC and
  every p-value is byte-identical either side of it. What moves is `dir_ok`,
  the printed per-feature verdict, and the count of features clearing FDR
  with the predicted sign.
- **It converts a recorded failure into a recorded hit.** Feature 10 has
  printed `WRONG SIGN` on every run this project has made. Measured through
  the shipped `discriminate.compute` path: human 6,525.3 vs generated 5,121.6
  mean rank, survived 6,625.0 vs forgotten 6,388.3 — human and survived use
  RARER content words in both arms, which is the glossed prediction.
- **The amendment runs IN the amender's favour, and that is the warning.** It
  makes the harness's headline hit count LARGER and its wrong-sign count
  smaller, and it was made after the sign was known. A post-hoc direction
  change of that shape is the one a reader should trust least. What is offered
  against it is not the ruling's authority but three independent facts that
  were not arranged for the purpose: `within_item.py` encoded the gloss's
  direction before any of this was noticed; the class means run that way in
  both arms; and `RESULTS.md`'s own findings prose made the identical
  rank-as-frequency error, which is what a systematic confusion looks like as
  opposed to a convenient reading. Corroboration found afterwards is still not
  preregistration. Doctrine 19 — this row is weaker than the nine that were
  never amended, and should be read that way.
- **It does not touch the other four `WRONG SIGN` verdicts** in Experiment 2
  (`concreteness_mean`, `concreteness_p90`, `abstract_noun_ratio`,
  `syntactic_inversion_rate`). Their cells carry no contradicting gloss, so
  their signs are failed predictions and stay recorded as such.
- **AND IT COSTS THE STUDY ONE OF ITS DEMONSTRATIONS.** `RESULTS.md` §2 argued
  the monoculture trap on FIVE features inverting between designs. Feature 10
  does not invert under the amended direction — a HIT in Experiment 2 and a
  *null* in Experiment 1 is "holds in one design, undetectable in the other",
  the weakest of the three patterns — so that section now rests on **four**.
  An amendment that shrinks the evidence for a claim the amender is making is
  the half a doctrine-19 warning usually omits, and it is the half that has to
  be visible for the warning to mean anything.

**MEASURED OUTCOME, re-run cold 2026-08-22 after the flip.** Every AUC is
identical to the pre-flip re-run, which is the control on the claim that the
amendment moves no measurement:

| | before | after |
|---|---|---|
| Exp 2, feature 10 | `0.707 0.0001 lower WRONG SIGN` | `0.707 0.0001 higher HIT (FDR)` |
| Exp 2, hits at q=0.10 | 4/10 | **5/10** |
| Exp 2, wrong-sign | 5 | **4** |
| Exp 1, feature 10 | `0.523 0.7788 lower null` | `0.523 0.7788 higher null` — only `dir` moves |
| Exp 1, hits at q=0.10 | 2/10 | 2/10 |
| joint held-out, Exp 1 / Exp 2 | 0.723 / 0.960 | 0.723 / 0.960 |
| within-item, all eight | unchanged | unchanged |

**Experiment 1 is NOT rescued by the amendment.** Feature 10 there is 0.523,
|AUC − 0.5| = 0.023 — an order of magnitude inside the band this document's
analysis plan declared undetectable in advance at n = 15 vs 117. It moves from
`WRONG SIGN` to *null*, not to a hit, and a null that size is not evidence
about the feature in either direction (doctrine 20).

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
