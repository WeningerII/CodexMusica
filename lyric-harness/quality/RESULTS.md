# Results — English cell

> **SUPERSEDED IN PART, TWICE. Written 2026-08-09; repinned 2026-08-13.**
>
> FIRST: the numbers in the next two sections are the pre-fix run. Two defects
> were found later by running the code against a tradition it was not designed
> for; see "Post-fix rerun" below. The headline conclusion CHANGED.
>
> SECOND: on 2026-08-13 the post-fix rerun was itself found to be a WARM
> reading — served from a feature cache keyed with no fingerprint of the code
> that wrote it — and **all four joint held-out AUCs moved when they were
> recomputed cold**: 0.659 → 0.717 and 0.975 → 0.964 here, 0.604 → 0.638 and
> 0.877 → 0.891 in `RESULTS_WITHIN_ITEM.md`. **The current numbers are in
> "Cold repin — 2026-08-13" at the foot of this file.**
>
> Every superseded reading is kept with the date it was superseded rather than
> overwritten, so both corrections are auditable (doctrine 17).

Reproduce with `python3 quality/fetch_data.py && python3 quality/discriminate.py`.
Permutation seed is fixed; the numbers below are exact, not approximate.
`python3 quality/test_discriminate.py` grades the eight joint AUCs and the
thirty-six per-feature AUCs against their pins, cold, reading no cache;
`python3 quality/audit_joint_auc_null.py --check` grades four of them against a
label-permutation null and against 200 cross-validation seeds.

Read PREREGISTRATION.md first. Directions were committed before any feature
code existed (`git log` proves the order), so a feature separating with the
wrong sign below is a failed prediction and is reported as one.

## Headline

| | Experiment 1 (survival) | Experiment 2 (generated-text) |
|---|---|---|
| contrast | anthologized vs not, within Shakespeare | Shakespeare vs model-generated |
| n | 15 vs 117 | 152 vs 40 |
| pre-registered hits | 2/10 | 4/10 |
| wrong-sign features | 0 | 5 |
| **joint held-out AUC** — pre-fix, 2026-08-09, **SUPERSEDED** twice | **0.709** | **0.971** |
| **joint held-out AUC** — cold, current, measured 2026-08-13 | **0.717** | **0.964** |

**Detecting bad writing works. Ranking good writing barely does.** That gap —
0.971 against 0.709 on the pre-fix reading, **0.964 against 0.717 cold** — is
the whole argument in two numbers. A floor is objectively enforceable; a
ceiling is not. Build the rejection gate. The gap narrowed by 0.062 between the
two readings and the argument did not change; doctrine 7 is still stated in the
pre-fix pair, which is a repin someone owning `CLAUDE.md` has to make.

## Experiment 1 — within-Shakespeare survival

One author, one form, one era, one register, one publication event. Every
confound that would wreck a cross-era comparison is eliminated by construction.

```
 *rhyme_predictability_mean         0.313   0.0184      lower  HIT (FDR)
  rhyme_predictability_min          0.454   0.4935      lower  null
  concreteness_mean                 0.673   0.0303     higher  uncorrected only
  concreteness_p90                  0.635   0.0897     higher  null
 *abstract_noun_ratio               0.315   0.0191      lower  HIT (FDR)
  pos_binding_diversity             0.461   0.6171     higher  null
  mattr                             0.366   0.0940     higher  null
  function_word_ratio               0.536   0.6542      lower  null
  syntactic_inversion_rate          0.583   0.3044      lower  null
  content_word_freq_mean            0.488   0.8837      lower  null

  joint held-out AUC, all 10 features : 0.709
  joint held-out AUC, predictability  : 0.670
```

Sonnets that entered the canon choose **less predictable rhymes** and use
**fewer abstract nouns** than sonnets that did not. Both in the predicted
direction, both surviving FDR at q=0.10.

**The internal control is the important part.** `content_word_freq_mean` is dead
flat at 0.488. If the predictability result were merely "canonical sonnets use
rarer words," feature 10 would have moved with feature 1. It did not. The signal
is specific to *rhyme choice*, not vocabulary rarity — which is exactly the
claim, and it survived the obvious confound.

## Experiment 2 — human vs model-generated

```
 *rhyme_predictability_mean         0.353   0.0043      lower  HIT (FDR)
 *rhyme_predictability_min          0.391   0.0146      lower  HIT (FDR)
 xconcreteness_mean                 0.271   0.0000     higher  WRONG SIGN
 xconcreteness_p90                  0.229   0.0000     higher  WRONG SIGN
 xabstract_noun_ratio               0.792   0.0000      lower  WRONG SIGN
  pos_binding_diversity             0.492   0.8735     higher  null
 *mattr                             0.870   0.0000     higher  HIT (FDR)
 *function_word_ratio               0.135   0.0000      lower  HIT (FDR)
 xsyntactic_inversion_rate          0.833   0.0000      lower  WRONG SIGN
 xcontent_word_freq_mean            0.887   0.0000      lower  WRONG SIGN

  joint held-out AUC, all 10 features : 0.971
  joint held-out AUC, predictability  : 0.617
```

Generated verse is detectable at 0.971 held-out. As a slop floor, this works.

## The three things this run actually establishes

### 1. Rhyme predictability is the only candidate universal

It is the sole feature that clears FDR **in both designs with the predicted
sign** — 0.313 within Shakespeare, 0.353 human vs generated. Everything else
either holds in one design and inverts in the other, or is null.

That is the feature that replaces the 30-entry `CLICHE_PAIRS` lookup, and it is
the one to trust when the two experiments disagree.

### 2. Five features invert between designs — the flattening danger, with numbers

`abstract_noun_ratio` discriminates survivors *within* Shakespeare in the
predicted direction (0.315) and inverts hard across the human/generated contrast
(0.792). Concreteness does the same. Inversion is not noise here; the effects are
large and the p-values are floor-level in both directions.

**Had this run used only Experiment 2, the conclusion would have been "human
writing is more abstract, more inverted, and uses more common words" — and a
generator built against it would have been optimized toward archaic pastiche.**
That is the monoculture trap, demonstrated rather than asserted. A single corpus
does not merely give a narrow answer; it gives a *confidently wrong* one. The
matrix across traditions is not thoroughness, it is the error bar.

### 3. Badness is objectively detectable; goodness is barely rankable

0.971 vs 0.709, same features, same code. The floor is enforceable. The ceiling
is not. Every design decision downstream should follow from that asymmetry.

## Where my own predictions failed

Reported because a pre-registration that only reports its wins is decoration.

- **`pos_binding_diversity` is dead null in both designs** (0.461, 0.492).
  Wimsatt's claim that rhyme earns its keep by binding unlike grammatical
  categories does not appear at all, as operationalized here. Either the
  coarse-POS operationalization is too blunt, or the claim does not hold at
  poem-level aggregation. Not rescued, just recorded.
- **`content_word_freq_mean` inverted badly** (0.887). I predicted human writing
  uses rarer vocabulary. The opposite: the generated sonnets reach for *rarer*
  words than Shakespeare does. The folk intuition that models write with generic
  vocabulary is, at least against this baseline, false — the failure mode is
  over-reaching, not under-reaching.
- **Concreteness inverted** (0.271 / 0.229). The generated sonnets are markedly
  more concrete than Shakespeare's. Concrete imagery is not a human fingerprint.
- **`mattr` was predicted higher in survived and came out 0.366** in Experiment 1
  (not significant, so no verdict) while landing at 0.870 in Experiment 2. Its
  direction is scale-dependent, which is itself a reason to distrust it as a
  universal.

## Caveats that materially limit these numbers

1. **This is one cell, and English is not the referent.** The survived/forgotten
   design needs only a tradition with high production volume and a surviving
   curation record; many traditions qualify. Shakespeare is used here because it
   is the only contrast reachable from this container, not because English is
   central. Nothing below is evidence about verse in general until a non-English
   cell has been run — and the inversion result above is the reason to insist on
   that rather than treat it as diligence.
2. **The survival label is model-derived.** Anthologization is a fact about the
   world, not a taste judgment, which is what makes it admissible — but it was
   not read from an anthology concordance, because those are behind the same
   403. **Experiment 1 is provisional until that label is rebuilt from source.**
   This is the single weakest link in the study.
3. **n=15.** Only large effects were ever detectable. The two nulls that came
   closest (`concreteness_mean` at p=0.030, `mattr` at p=0.094) are exactly the
   kind of thing more data would resolve either way.
4. **The generated corpus has one author — this model — and was written by the
   same model that chose the hypotheses.** That is a real bias risk. Mitigating
   evidence: five of ten predictions came out *wrong*, which is not what
   successful self-gaming looks like. But 0.971 is the detectability of *this*
   generator's sonnets, not of generated verse in general.
5. **Experiment 2's confound is not resolved, only labelled.** Pastiche artifacts
   and slop artifacts are not separated by anything here.

## What would move this forward, in order

1. **Rebuild the survival label from an anthology concordance** (Palgrave, Oxford
   Book of English Verse — both public domain). Removes caveat 2 entirely.
2. **Run a second cell in a different language before trusting any feature.**
   The inversion result makes single-corpus conclusions unsafe by demonstration,
   not by principle. Which tradition goes second is an open question for the
   research pass, and should be chosen on phonological tractability and the
   existence of a curation record — not on corpus size or familiarity.
3. **Second and third generators for Experiment 2**, so 0.971 becomes a claim
   about generated verse rather than about this model's sonnets.
4. **Establish which of these ten features are language-agnostic at all.**
   Several are English artifacts on their face: `syntactic_inversion_rate`
   presumes configurational word order, `function_word_ratio` presumes a
   function/content split that is not clean in agglutinative or polysynthetic
   languages, and Brysbaert concreteness is an English norming study. A feature
   that cannot be stated without reference to English cannot be a universal, and
   should not be carried into a second cell unchanged.


---

# Post-fix rerun (2026-08-09) — the headline conclusion changed, and this whole section is WARM

> **SUPERSEDED IN PART 2026-08-13.** Every figure in this section is a WARM
> reading, taken from a feature cache keyed with no fingerprint of the code
> that wrote it. Four of them moved when they were recomputed cold — the joint
> AUCs 0.659 → 0.717 and 0.975 → 0.964, and the two predictability-only figures
> — and the conclusion this section draws from them is reinstated in the
> opposite direction at the foot of this file. The section is kept intact
> rather than rewritten, because what it says is the record of what was
> believed and the arithmetic that produced it (doctrine 17).

Two defects were fixed (see `quality/test_crosslinguistic.py` and the commit
that added it): the anchor never skipped a **radif**, and a word absent from
the pronunciation lexicon was scored as *maximally rare* rather than as
*unknown*. Only the second one moves the English numbers. Both fixes are real
and both are still in the code; what this section gets wrong is not the fix, it
is which numbers the fix was measured against.

| feature | Exp 1 before | Exp 1 after — WARM 2026-08-09, SUPERSEDED | Exp 2 before | Exp 2 after — WARM 2026-08-09, SUPERSEDED |
|---|---|---|---|---|
| rhyme_predictability_mean | 0.313 HIT | **0.304 HIT** (p .0117) | 0.353 HIT | **0.422 null** (p .13) |
| rhyme_predictability_min | 0.454 null | **0.337 HIT** (p .0386) | 0.391 HIT | **0.494 null** (p .92) |
| concreteness_mean | 0.673 uncorrected | **0.673 HIT** | 0.271 wrong sign | 0.271 wrong sign |
| pre-registered hits | 2/10 | **4/10** | 4/10 | **2/10** |
| joint held-out AUC | 0.709 | **0.659** | 0.971 | **0.975** |
| predictability-only AUC | 0.670 | **0.676** | 0.617 | **0.560** |

Cold, the last two rows read **0.717** / **0.964** and **0.710** / **0.648**.
The full cold table is at the foot of this file.

## What this means, stated plainly

**The cross-design replication of `rhyme_predictability` was an artifact of
archaic vocabulary falling out of CMUdict.**

The old code gave an out-of-vocabulary rhyme word `rank = MAX_RANK`, i.e.
treated "I cannot read this" as "this is the rarest possible word," which
scored it as maximally *un*predictable. Shakespeare's rhyme words are
frequently OOV — the battery reports `mayst`(12), `beauteous`(9), `o'er`(9),
`canst`(7) among many others. So Shakespeare scored as choosing unpredictable
rhymes partly *because the dictionary could not read him*, which happened to
match the predicted human-vs-generated direction.

Stop scoring unreadable words and the Experiment 2 effect **collapses to
chance**: predictability alone drops from 0.617 to **0.560** held-out, and
neither variant clears significance (p = .13, p = .92).

This is the same failure mode as `syntactic_inversion_rate`, which the
typology audit identified as an Early Modern English archaism detector. Two of
the ten features were reading *period*, and one of them was the feature this
project had designated its candidate universal.

## The corrected claim

- **`rhyme_predictability` survives as a *within-tradition survival* signal.**
  In Experiment 1 it got *stronger* after the fix — both variants now clear
  FDR, where before only one did. Within one author, OOV is roughly uniform
  across poems, so removing it cut noise rather than signal.
- **It does not detect generated text.** 0.560 is chance. The earlier claim
  that it was "the only feature clearing FDR in both designs with the
  predicted sign" is **withdrawn**. It clears one design.

  > **THIS WITHDRAWAL DOES NOT REPRODUCE COLD — MEASURED 2026-08-13, AND IT
  > NEEDS A HUMAN DECISION, NOT A REPIN.** Every figure in this section is a
  > WARM figure. Until 2026-08-13 `quality/discriminate.py`'s feature cache was
  > keyed `tag:ident` — corpus, feature class, poem number, and nothing else —
  > with no fingerprint of `features.py`, `lyric_harness.py`, the `Declaration`
  > tuple or any resource file. So a warm run reproduced whatever the code
  > looked like when each entry was first written, on 2026-08-09/10. **The
  > recorded numbers reproducing exactly WAS the defect.**
  >
  > Cold, twice, independently, at two different `lyric_harness.py` digests
  > and agreeing to the digit: `rhyme_predictability_mean` clears FDR in BOTH
  > designs — Exp1 AUC 0.262 at p = 0.0018, Exp2 0.340 at p = 0.0015 — and
  > `rhyme_predictability_min` also clears in Exp2 (0.336, p = 0.0010).
  > Predictability-only Exp2 reads **0.648**, not 0.560. So the sentence above
  > and the bolded 0.560 it rests on are both measured against a stale cache,
  > and the claim they withdraw is the claim the cold run supports.
  >
  > **REINSTATED 2026-08-13**, narrowly and with the conflicts named. This
  > block read "NOT REINSTATED HERE, on purpose ... until somebody decides
  > which claim the project makes" from 2026-08-13 until later the same day.
  > The decision was made; the withdrawal above is superseded and the cold
  > reading is the current one. What is reinstated, what is not, and where it
  > collides with doctrines 10 and 11 is set out in full at "Cold repin —
  > 2026-08-13" below, which is the section to read rather than this
  > paragraph. Both readings stay visible (doctrine 17).
  >
  > Reproduce: `python3 quality/discriminate.py --cold` — 384 extractions.
  > ~~~70 minutes on an idle box.~~ **REPINNED 2026-08-13: 1,050 CPU-s over
  > 384 items, measured twice (1049.5 s and 1067.8 s, 2.73–2.78 s/item);
  > `quality/RESULTS_CACHE_IDENTITY.md` records that the 70-minute figure was
  > never measured by anyone.** The cache now carries a fingerprint of every
  > input that could change the answer and discards itself with a printed
  > reason when one moves, so this class of drift cannot recur silently.
- **Experiment 2's 0.975 is carried entirely by `mattr`, `function_word_ratio`
  and the five wrong-sign features** — that is, by register and period, not by
  quality. It is a very good Shakespeare-vs-contemporary classifier. It is not
  demonstrated to be a slop detector. *(0.975 is the WARM figure and is
  SUPERSEDED 2026-08-13; cold it is 0.964. The sentence is unaffected — all
  five wrong-sign features are still wrong-signed cold and `mattr` and
  `function_word_ratio` are unmoved at 0.870 and 0.135.)*
- **Experiment 1's joint AUC fell from 0.709 to 0.659**, so the survival
  result is weaker overall even as individual features got cleaner. At n=15
  it does not exclude chance. *(Both endpoints are WARM, and the post-fix one
  is **SUPERSEDED 2026-08-13**: cold, that fit reads **0.717**. The FALL
  cannot be recomputed — the pre-fix code has never been run cold, so there is
  no cold 0.709 to subtract from — and what can be said is only that the cold
  post-fix figure sits above the warm pre-fix one rather than below it, which
  is the opposite direction from the sentence. The conclusion that it does not
  exclude chance at n=15 stands, and is the half that never rested on the
  moved digit.)*

## Cross-linguistic defects found, and their status

| defect | status | note |
|---|---|---|
| Radif blindness — anchor lands on the refrain, all pairs return an identical value | **FIXED** | zero variance, not inverted signal; verified at 16 decimal places |
| OOV scored as maximally rare | **FIXED** | unreadable pairs skipped; NaN instead of a confident 0.0 |
| Monorhyme length confound — draw-without-replacement makes longer poems look better for free | **DOCUMENTED, NOT FIXED** | 0.9009 (2 couplets) to 0.8793 (40) at constant skill; any monorhyme cell must regress on line count first |
| No tone channel biases cross-language comparison | **NOT REPRODUCED** | simulated field inflation 1x-8x: mean shift +0.0000. Field size is mean-neutral for a normalized rank |
| `syntactic_inversion_rate` is an archaism detector | **OPEN** | should be retired rather than ported |
| `function_word_ratio` presumes a clean function/content split | **OPEN** | fails by variance collapse in agglutinative languages |
