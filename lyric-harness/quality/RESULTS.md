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
> 0.877 → 0.891 in `RESULTS_WITHIN_ITEM.md`. ~~**The current numbers are in
> "Cold repin — 2026-08-13" at the foot of this file.**~~ *THIRD: the cold
> reading was itself superseded on 2026-08-22 by `MISSING.md` M-31 (a frequency
> sentinel left pointing at the old 20k list), which moved the joints again to
> 0.723 and 0.960. The current numbers are in "The joint held-out AUCs, cold" at
> the foot of this file.*
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
| pre-registered hits | 2/10 | ~~4/10~~ **5/10** |
| wrong-sign features | 0 | ~~5~~ **4** |
| **joint held-out AUC** — pre-fix, 2026-08-09, **SUPERSEDED** twice | **0.709** | **0.971** |
| **joint held-out AUC** — cold, current, measured 2026-08-22 | **0.723** | **0.960** |
| ~~joint held-out AUC — cold, measured 2026-08-13~~ | ~~0.717~~ | ~~0.964~~ |

**AMENDED 2026-08-22 — `MISSING.md` M-32, BY OWNER RULING.** The Experiment 2
column moves one row without any measurement moving. `PREREGISTRATION.md`
committed feature 10 with a boldface **LOWER** and a gloss reading *rarer
words*; those two disagree, because a lower rank IS a commoner word. The
owner ruled that the gloss was the commitment, so the declaration now reads
**HIGHER**, and `content_word_freq_mean` in Experiment 2 — AUC 0.707, p 0.0001,
unchanged to the digit — stops being a WRONG SIGN and is recorded as a HIT.
Experiment 1 is untouched: at p 0.7788 the feature is not FDR-significant, and
`WRONG SIGN` is only ever printed for a significant result, so it read *null*
before the ruling and reads *null* after — only its `dir` column moves. **DOCTRINE 19 WARNING: this amendment runs in the
amender's favour** — it makes the headline hit count larger and the wrong-sign
count smaller, and it was made after the sign was known. It is recorded that
way deliberately. It touches no other row: the remaining four wrong-sign
verdicts stand.

**REPINNED 2026-08-22 — `MISSING.md` M-31.** `features.py` carried
`MAX_RANK = 20000`, the size of `wordfreq20k.txt`, after the frequency source
was swapped to a 50k list. A sentinel that is not past the end of the list is
not a sentinel: an out-of-vocabulary word scored 20,000 came back commoner
than 60% of English, so feature 10 — the RARITY of the content vocabulary —
ran backwards on exactly the words a lyric reaches for. Cold re-run, 892s, no
cache.

**ONLY THE FREQUENCY FEATURE AND THE JOINTS CONTAINING IT MOVED**, which is
the control on this repin: all four predictability-only joints and every other
per-feature AUC in all four arms came back inside tolerance (5e-4). Had
anything else drifted, the fix would have touched more than it should.

**THE TWO LARGE FALLS ARE A DOWNGRADE AND ARE RECORDED AS ONE.**
`content_word_freq_mean` on human-vs-generated falls ~~0.807~~ **0.707**, and
`wi_freq_delta` falls ~~0.639~~ **0.544** — barely above chance. Under the
stale sentinel this feature was partly measuring whether a text contains words
outside a 20,000-word list — an out-of-vocabulary RATE, which tracks the label
— rather than the rarity it names. Removing that removes real discriminative
power, and the power was spurious. Nothing was tuned to recover it.

**Detecting bad writing works. Ranking good writing barely does.** That gap —
0.971 against 0.709 on the pre-fix reading, ~~**0.964 against 0.717 cold**~~
**0.960 against 0.723 cold** — is the whole argument in two numbers. A floor is
objectively enforceable; a ceiling is not. Build the rejection gate. The gap is
**0.262 pre-fix and ~~0.247~~ 0.237 cold, so it narrowed by ~~0.015~~ 0.025**,
and the argument did not change. ~~doctrine 7 is still stated in the pre-fix
pair, which is a repin someone owning `CLAUDE.md` has to make.~~ *Doctrine 7 was
repinned to the current cold pair on 2026-08-22 and no longer states the pre-fix
one. The cold figures here are repinned the same day for `MISSING.md` M-31 — the
sentinel fix, not M-32's amendment, which moves no joint.*

> **~~"The gap narrowed by 0.062 between the two readings."~~ WITHDRAWN
> 2026-08-14. The narrowing above is measured — 0.015 to the 2026-08-13 cold
> pair, **0.025** to the M-31 pair; where 0.062 came from is `CANNOT
> TELL` (doctrine 20/28), and it is recorded as that rather than quietly
> replaced.**
>
> The sentence's own subject is the Exp 2 − Exp 1 gap across the two readings
> it names, and that arithmetic does not produce 0.062 under any pairing:
> pre-fix 0.971 − 0.709 = 0.262, cold 0.964 − 0.717 = 0.247, and with the
> M-31 sentinel corrected 0.960 − 0.723 = 0.237. The narrowing is
> **0.015** to the 2026-08-13 cold pair (0.0143 with that pair taken at the
> precision `test_discriminate.py` pins and the pre-fix pair at the three
> decimals that are the only reading the record has for it) and **0.025** to
> the M-31 pair (0.0254 at pinned precision). Bringing in
> the warm reading does not help either — warm 0.975 − 0.659 = 0.316, so
> warm→cold is 0.069 and pre-fix→warm is +0.054, a WIDENING. No pair of the
> **seven** gaps on record (absolute pre-fix 0.262, warm 0.316, cold 0.247,
> **cold M-31 0.237**; within-item warm 0.273, cold 0.253, **cold M-31
> 0.275**) differs by 0.062; the nearest is still 0.063,
> and it is warm-absolute minus cold-within-item, which crosses the cache
> state AND the feature set at once and is the same collapse doctrine 58 is
> about.
>
> *CORRECTED 2026-08-22. This paragraph gained the M-31 pair without
> recomputing the quantity it exists to state: it read "0.960 − 0.723 = 0.237,
> narrowing **0.015**", and 0.262 − 0.237 is 0.025. A paragraph whose subject
> is an unreproducible number, carrying an arithmetic slip of its own, is the
> defect it was written about — recorded here rather than silently fixed. The
> two additional gaps were re-checked against the 0.062 claim at the same time
> and neither produces it; the conclusion is unchanged and now rests on seven
> readings instead of five.*
>
> **The one quantity in the repo that IS 0.062** is the cold
> predictability-only spread, Exp 1 − Exp 2: 0.70997150997151 −
> 0.6476973684210526 = **0.062274**, i.e. the **0.710** and **0.648** sitting
> side by side in the "ABSOLUTE, predictability only" row of "The joint
> held-out AUCs, cold" below — a different FEATURE SET
> (two features, not ten), and a LEVEL rather than a narrowing of anything.
> The same commit (`de4313e`) added that table and this sentence, so a
> transcription is plausible. It is not established, and this document does
> not assert it: sweeping every three-decimal figure in this file and
> `RESULTS_WITHIN_ITEM.md` finds **six** pairs differing by exactly 0.062 —
> 0.366−0.304, 0.580−0.518, 0.582−0.520, 0.676−0.614, 0.719−0.657 and
> 0.710−0.648 — so a digit match here is a coincidence rate, not a
> provenance. `git log -S"0.062"` returns exactly one commit and its diff
> carries no working.
>
> What can be said: the figure was never reproducible from the sentence it
> was attached to, the narrowing it claimed is real but is 0.015, and the
> conclusion it supports — that the argument did not change — is unaffected in
> either direction, because 0.015 and 0.062 are both small against a gap of
> 0.247.

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

*This block is the 2026-08-09 run verbatim and is left standing as the record
of what the instrument printed that day (doctrine 17). Two things in it have
since been superseded and are NOT live: every figure was re-measured cold on
2026-08-22 (see "The ten features, cold"), and feature 10's `verdict` column
was computed against a declaration the owner has since amended (M-32) — though
in this experiment that amendment changes only the `dir` column and not the
verdict, the feature not being significant here under either reading. The
current cold reading of feature 10 here is 0.523, p 0.7788, `higher`, null.*

Sonnets that entered the canon choose **less predictable rhymes** and use
**fewer abstract nouns** than sonnets that did not. Both in the predicted
direction, both surviving FDR at q=0.10.

**The internal control is the important part.** `content_word_freq_mean` is dead
flat at ~~0.488~~ **0.523** (repinned cold 2026-08-22; the direction it is
graded against was amended the same day, M-32, which moved neither its AUC nor
its verdict — `WRONG SIGN` is only printed for an FDR-significant result and
this one is p 0.7788, so it read *null* under both declarations). If the predictability
result were merely "canonical sonnets use rarer words," feature 10 would have
moved with feature 1. It did not — |Δ| = 0.023 against a 0.50 midline, inside
the band Experiment 1 declared undetectable in advance at n = 15 vs 117. The
signal is specific to *rhyme choice*, not vocabulary rarity — which is exactly
the claim, and it survived the obvious confound. **The control survives the
amendment**: flipping the predicted direction cannot rescue a feature that did
not separate, and this one did not separate in either direction.

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

*The 2026-08-09 run verbatim, left standing as the record (doctrine 17) and not
live. Superseded twice: cold re-measurement on 2026-08-22, and M-32's amendment
to feature 10's declared direction. The current cold reading of the last row is
`*content_word_freq_mean 0.707 0.0001 higher HIT (FDR)` — the AUC fell with the
sentinel fix and the verdict flipped with the ruling, and those are two separate
events that happened to land on the same row.*

Generated verse is detectable at 0.971 held-out. As a slop floor, this works.

## The three things this run actually establishes

### 1. Rhyme predictability is the only candidate universal

It is the sole feature that clears FDR **in both designs with the predicted
sign** — 0.313 within Shakespeare, 0.353 human vs generated. Everything else
either holds in one design and inverts in the other, or is null.

That is the feature that replaces the 30-entry `CLICHE_PAIRS` lookup, and it is
the one to trust when the two experiments disagree.

### 2. ~~Five~~ **Four** features invert between designs — the flattening danger, with numbers

`abstract_noun_ratio` discriminates survivors *within* Shakespeare in the
predicted direction (0.315) and inverts hard across the human/generated contrast
(0.792). Concreteness does the same. Inversion is not noise here; the effects are
large and the p-values are floor-level in both directions.

**Had this run used only Experiment 2, the conclusion would have been "human
writing is more abstract, more inverted, and ~~uses more common words~~" — and a
generator built against it would have been optimized toward archaic pastiche.**
That is the monoculture trap, demonstrated rather than asserted. A single corpus
does not merely give a narrow answer; it gives a *confidently wrong* one. The
matrix across traditions is not thoroughness, it is the error bar.

**AMENDED 2026-08-22 (`MISSING.md` M-32) — AND THE AMENDMENT COSTS THIS SECTION
ONE OF ITS FOUR CLAUSES.** The struck clause was never a reading of the data (see
the corrected finding above: Experiment 2 says human writing uses the *rarer*
words, and the class means are 6,525.3 against 5,121.6). With feature 10's
declared direction amended, it does not invert between designs at all: it is a
HIT in Experiment 2 and a *null* in Experiment 1, which is a feature that holds
in one design and is undetectable in the other — the weakest of the three
patterns, not an inversion. The inverting set is `concreteness_mean`,
`concreteness_p90`, `abstract_noun_ratio` and `syntactic_inversion_rate`: **four**.

The section's argument survives on four features instead of five, and the
demonstration is weaker by exactly that much. It is recorded here rather than
quietly re-counted, because an amendment that shrinks the evidence for a claim
the amender is making is the half a doctrine-19 warning is usually not applied
to — and it is the half that has to be visible for the warning to mean anything.

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
- ~~**`content_word_freq_mean` inverted badly** (0.887). I predicted human
  writing uses rarer vocabulary. The opposite: the generated sonnets reach for
  *rarer* words than Shakespeare does. The folk intuition that models write with
  generic vocabulary is, at least against this baseline, false — the failure mode
  is over-reaching, not under-reaching.~~
  **STRUCK 2026-08-22 — THIS PARAGRAPH READ ITS OWN NUMBER BACKWARDS** (`MISSING.md`
  M-32). `content_word_freq_mean` is a mean **rank**, and in
  `data/opensubtitles_en_50k.tsv` rank 0 is *you* and the OOV sentinel is 49,999:
  **higher is rarer.** `permutation_test` scores the FIRST arm, and the first arm
  of Experiment 2 is `rows_h` — human. So an AUC above 0.5 says *human* is higher,
  which says **human uses the rarer words**, and the class means say it in the
  plainest possible terms: human 6,525.3 against generated 5,121.6. The
  conclusion above is the exact reverse of the measurement it cites, and so is
  everything drawn from it — models write with the *more generic* vocabulary
  here, and the failure mode against this baseline is under-reaching.

  **This is the same root error as M-32's declaration defect, not a second one.**
  Reading a rank as if it were a frequency produces both symptoms at once: the
  boldface **LOWER** in `PREREGISTRATION.md`, and this paragraph. The one part of
  the original commitment that was never confused is the gloss — *rarer words* —
  which is what the owner's ruling elevated. That the prose erred in the same
  direction as the declaration is corroboration for the ruling and is recorded
  as such; it does not repeal the doctrine-19 warning attached to it.
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

Cold, the last two rows read ~~**0.717** / **0.964**~~ **0.723** / **0.960** and
**0.710** / **0.648**. The full cold table is at the foot of this file.

*(The first pair is repinned 2026-08-22 — `MISSING.md` M-31's cold re-run moved
both joints and this line was missed in that pass, which is what a second reader
is for. The predictability-only pair contains no frequency feature and did not
move, in either the M-31 repin or M-32's amendment.)*

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
  > ~~about 70 minutes on an idle box.~~ **REPINNED 2026-08-13: 1,050 CPU-s over
  > 384 items, measured twice (1049.5 s and 1067.8 s, 2.73–2.78 s/item);
  > `quality/RESULTS_CACHE_IDENTITY.md` records that the 70-minute figure was
  > never measured by anyone.** The cache now carries a fingerprint of every
  > input that could change the answer and discards itself with a printed
  > reason when one moves, so this class of drift cannot recur silently.
- **Experiment 2's 0.975 is carried entirely by `mattr`, `function_word_ratio`
  and the five wrong-sign features** — that is, by register and period, not by
  quality. It is a very good Shakespeare-vs-contemporary classifier. It is not
  demonstrated to be a slop detector. *(0.975 is the WARM figure and is
  SUPERSEDED 2026-08-13; cold it is ~~0.964~~ **0.960** — repinned 2026-08-22,
  M-31. The sentence is unaffected — ~~all five wrong-sign features are~~ **the
  four remaining wrong-sign features are** still wrong-signed cold, `mattr` and
  `function_word_ratio` are unmoved at 0.870 and 0.135, and the fifth left the
  set by M-32's amendment rather than by moving. The sentence's claim is that
  Experiment 2 is carried by register and period rather than quality: feature 10
  joining the hit column does not soften it, because a human/generated split on
  vocabulary rarity is a register fact too.)*
- **Experiment 1's joint AUC fell from 0.709 to 0.659**, so the survival
  result is weaker overall even as individual features got cleaner. At n=15
  it does not exclude chance. *(Both endpoints are WARM, and the post-fix one
  is **SUPERSEDED 2026-08-13**: cold, that fit reads ~~**0.717**~~ **0.723**
  (repinned 2026-08-22, M-31). The FALL
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


---

# Cold repin — 2026-08-13

**This section is the current state of the English cell.** Everything above it
is a warm reading of one kind or another and is kept for audit.

## What was warm, and why

MEASURED 2026-08-13; the mechanism is recorded in full at
`quality/RESULTS_CACHE_IDENTITY.md`.

Until 2026-08-13 `quality/discriminate.py`'s on-disk feature cache was keyed
`tag:ident` — corpus, feature class, poem number, and nothing else. The key
named the poem and never the code, so it carried no fingerprint of
`features.py`, `within_item.py`, `lyric_harness.py`, the `Declaration` tuple or
any of the three resource files. Every run served whatever the feature code had
produced when each entry was first written, on 2026-08-09/10. **The recorded
numbers reproducing exactly WAS the defect** — the cache could not tell "the
answer did not change" from "the question was never asked again."

Closed at the module: the format-2 cache fingerprints the source files, the
resource files, the `Declaration` tuple and the feature names and directions,
and content-addresses each entry on the poem's own lines. A fingerprint
mismatch discards the cache and prints the coordinate that moved.

## The joint held-out AUCs, cold

| feature set | Exp 1 | Exp 2 | reading |
|---|---|---|---|
| ABSOLUTE, all 10 features | **0.723** | **0.960** | COLD, current, 2026-08-22 |
| ABSOLUTE, predictability only | **0.710** | **0.648** | COLD, current, 2026-08-22 |
| ~~ABSOLUTE, all 10 features~~ | ~~0.717~~ | ~~0.964~~ | ~~cold 2026-08-13~~, **SUPERSEDED** by M-31 |
| ABSOLUTE, all 10 features | 0.659 | 0.975 | warm 2026-08-09, **SUPERSEDED** |
| ABSOLUTE, predictability only | 0.676 | 0.560 | warm 2026-08-09, **SUPERSEDED** |

Over 200 cross-validation seeds rather than the one hard-coded seed every
figure above is a single draw from (`audit_joint_auc_null.PINNED`, 2026-08-13):
Exp 1 median **0.638**, Exp 2 median **0.967**. The recorded Exp 1 draw of
~~0.717~~ **0.723** sits well above its own median, which is doctrine 73's point
and is why the seed distribution is pinned separately from the headline. *(The
draw is repinned 2026-08-22 for M-31; the median is not re-measured against the
corrected sentinel, so the comparison is a current draw against a
2026-08-13 null and is weaker than it looks by exactly that much.)*

## The ten features, cold

Cold AUCs pinned in `quality/test_discriminate.py` and graded there at a
tolerance of 0.0005, **repinned 2026-08-22** for M-31's sentinel fix.

**THE COLD p COLUMN IS NEW AS OF 2026-08-22 AND DISCHARGES A STANDING CAVEAT.**
This section used to read "every p-value below is the 2026-08-09 warm reading and
is **not** re-measured cold", because a permutation p costs 20,000 shuffles per
feature and `test_discriminate.py` pins no p at all. The full run of 2026-08-22
(1,108s, no cache) measured all twenty, so both columns are stated. The warm
column is kept beside the cold one rather than replaced (doctrine 17), and it
earns its place: **five verdicts differ between them**, and four of the five are
warm-cache artifacts rather than re-readings — `rhyme_predictability_min` and
`concreteness_mean` lose their Experiment 1 hits, and both predictability
variants gain Experiment 2 hits they did not have warm. The fifth is
`content_word_freq_mean` in Experiment 2, and it did not move for that reason at
all: its p is .0000 warm and .0001 cold, and what changed its verdict is M-32's
amendment to the direction it is graded against.

The warm AUC column is the post-fix rerun's figure where that rerun restated one
(the two predictability variants in both experiments, and `concreteness_mean`
in Experiment 1) and the pre-fix figure otherwise, because the post-fix rerun
restated only three of the ten features. Both readings are warm; the
distinction matters only for reading the tables above against these.

Experiment 1 — survived vs forgotten, n = 15 vs 117:

*The `predicted` column is `PREREGISTRATION.md` as amended: one row carries a
strikethrough where the owner's 2026-08-22 ruling replaced it (M-32). The nine
others are the original commitments, unchanged.*

| feature | predicted | **cold AUC** | **cold p / verdict** | warm AUC | warm p / verdict |
|---|---|---|---|---|---|
| `rhyme_predictability_mean` | lower | **0.262** | **.0018 HIT (FDR)** | 0.304 | .0117 HIT (FDR) |
| `rhyme_predictability_min` | lower | **0.350** | **.0572 null** | 0.337 | .0386 HIT (FDR) |
| `concreteness_mean` | higher | **0.673** | **.0303 uncorrected only** | 0.673 | HIT (FDR) |
| `concreteness_p90` | higher | **0.635** | **.0897 null** | 0.635 | .0897 null |
| `abstract_noun_ratio` | lower | **0.315** | **.0191 HIT (FDR)** | 0.315 | .0191 HIT (FDR) |
| `pos_binding_diversity` | higher | **0.461** | **.6171 null** | 0.461 | .6171 null |
| `mattr` | higher | **0.366** | **.0940 null** | 0.366 | .0940 null |
| `function_word_ratio` | lower | **0.536** | **.6542 null** | 0.536 | .6542 null |
| `syntactic_inversion_rate` | lower | **0.583** | **.3044 null** | 0.583 | .3044 null |
| `content_word_freq_mean` | ~~lower~~ **higher** | ~~0.518~~ **0.523** | **.7788 null** | 0.488 | .8837 null |

Experiment 2 — human vs generated, n = 152 vs 40:

| feature | predicted | **cold AUC** | **cold p / verdict** | warm AUC | warm p / verdict |
|---|---|---|---|---|---|
| `rhyme_predictability_mean` | lower | **0.340** | **.0015 HIT (FDR)** | 0.422 | .13 null |
| `rhyme_predictability_min` | lower | **0.336** | **.0010 HIT (FDR)** | 0.494 | .92 null |
| `concreteness_mean` | higher | **0.271** | **.0000 WRONG SIGN** | 0.271 | .0000 WRONG SIGN |
| `concreteness_p90` | higher | **0.229** | **.0000 WRONG SIGN** | 0.229 | .0000 WRONG SIGN |
| `abstract_noun_ratio` | lower | **0.792** | **.0000 WRONG SIGN** | 0.792 | .0000 WRONG SIGN |
| `pos_binding_diversity` | higher | **0.492** | **.8735 null** | 0.492 | .8735 null |
| `mattr` | higher | **0.870** | **.0000 HIT (FDR)** | 0.870 | .0000 HIT (FDR) |
| `function_word_ratio` | lower | **0.135** | **.0000 HIT (FDR)** | 0.135 | .0000 HIT (FDR) |
| `syntactic_inversion_rate` | lower | **0.833** | **.0000 WRONG SIGN** | 0.833 | .0000 WRONG SIGN |
| `content_word_freq_mean` | ~~lower~~ **higher** | ~~0.807~~ **0.707** | **.0001 HIT (FDR)** | 0.887 | .0000 WRONG SIGN |

**Exactly three features moved, and they are the three that rank a word against
a lexicon**: the two predictability variants and `content_word_freq_mean`. The
other seven — built from concreteness norms, part-of-speech tags,
function-word membership and type counts — are bit-identical warm to cold. That
is a coherent signature rather than drift: the warm cache was serving pre-fix
*rank* arithmetic and nothing else.

~~**The five wrong-sign features are still wrong-sign cold**, at magnitudes that
barely moved. Nothing in this repin softens the register-and-period reading of
Experiment 2.~~
**AMENDED 2026-08-22 (`MISSING.md` M-32): FOUR, not five.** Feature 10 left the
set — not by moving, but because the direction it is graded against was amended
by owner ruling. Its AUC is 0.707 either way. The other four are still wrong-sign
cold at magnitudes that barely moved, and nothing in this repin or that amendment
softens the register-and-period reading of Experiment 2 — the amendment removes
one row from the wrong-sign column and adds it to the hit column, and touches no
other row in either table.

## `rhyme_predictability` is REINSTATED, narrowly

**What was withdrawn.** "The corrected claim" above withdrew the sentence that
`rhyme_predictability` "was the only feature clearing FDR in both designs with
the predicted sign", and replaced it with "It clears one design."

**On what numbers.** On the warm post-fix reading: Experiment 2 at AUC 0.422,
p = .13, with predictability-only held out at 0.560 — "0.560 is chance."

**Why the withdrawal is superseded.** The comparator does not produce those
numbers. Cold, at two `lyric_harness.py` digests and agreeing to the digit:

| | Exp 1 | Exp 2 |
|---|---|---|
| `rhyme_predictability_mean` | AUC **0.262**, p = **0.0018** | AUC **0.340**, p = **0.0015** |
| `rhyme_predictability_min` | AUC **0.350**, p not restated cold | AUC **0.336**, p = **0.0010** |
| predictability-only joint AUC | **0.710** | **0.648** |

**These three p-values clear Benjamini–Hochberg FDR at q = 0.10 without
needing the other nine, and that is worth spelling out**, because the other
nine cold p-values have not been measured and a BH verdict normally depends on
the whole family. BH rejects at rank *r* when p ≤ q·r/m = 0.01·r. Any p ≤ 0.01
therefore satisfies the condition at its own rank whatever that rank turns out
to be, so it is rejected regardless of where the rest of the family falls.
0.0018, 0.0015 and 0.0010 are all below 0.01. The verdict is safe on the
numbers in hand.

**The cold result is that `rhyme_predictability_mean` clears FDR in BOTH
designs with the predicted sign (lower), and `rhyme_predictability_min` clears
in Experiment 2.** The OOV fix is real, is still in the code, and did not
destroy the Experiment 2 effect; the stale cache did. Predictability-only Exp 2
is 0.648, not 0.560, so "0.560 is chance" is arithmetic on a number nothing
produces.

`rhyme_predictability_min` in Experiment 1 reads 0.350 cold against 0.337 warm,
and no cold p has been recorded for it. It is **not** claimed to clear here.
The reinstated claim rests on `_mean` in both designs and on `_min` in
Experiment 2 only.

### The doctrine 10 and doctrine 11 check, stated rather than skipped

Reinstating a withdrawn finding is a claim about what this project has
demonstrated, so it is checked against the two doctrines that stand in its way.
One of them it contradicts.

**Doctrine 11 — CONTRADICTED, in its second clause.** That doctrine reads "two
features have now been caught reading period, not quality", and names
`syntactic_inversion_rate` and `rhyme_predictability`, whose "cross-design
replication was an OOV artifact." The second half rests on the warm 0.422 at
p = .13 and the warm 0.560. Cold the comparator gives 0.340 at p = 0.0015 and
0.648. **That clause is superseded by measurement**, and `quality/METHOD.md`
and `CLAUDE.md` — which is where doctrine 11 lives, and which this document
does not own — still state it. The count in its opening sentence is affected
too: it is one feature caught reading period, not two.

The FIRST clause is untouched. `syntactic_inversion_rate` reads 0.583 in
Experiment 1 and 0.833 wrong-signed in Experiment 2, cold, both unmoved. It is
still an Early Modern English archaism detector and should still be retired
rather than ported.

The doctrine's standing INSTRUCTION — assume a feature reads period until a
within-item version says otherwise — is **not** satisfied here, and this
document does not claim it is. The within-item version of feature 1,
`wi_predictability_advantage`, is `mean(pred) − 0.5`: a monotone transform, so
its AUC is bit-identical to the absolute feature's in both experiments
(0.26153846153846155 and 0.33963815789473684 — the same floats, pinned as
such). It is the same measurement under another name and it cannot corroborate
anything. The instruction is unmet, not met.

**Doctrine 10 — NOT overturned, but two of its numbers are superseded and one
of its sentences is dented.** That doctrine reads "the quality layer has NO
demonstrated cross-design signal", supported by "1/8 hits in each experiment,
Exp 1 at 0.604 (n=15, does not exclude chance), Exp 2 still 0.877."

- The two AUCs are warm. Cold they are **0.638** and **0.891**. They need a
  repin in `METHOD.md`, which this document does not own.
- "1/8 hits in each experiment" is a tally over permutation p-values, and no p
  has been re-run cold. It is not re-verified, and two of the eight within-item
  AUCs it rests on moved.
- The layer-level claim survives, on numbers that did not move in its favour:
  Experiment 1's joint AUC is 0.638 within-item and ~~0.717~~ **0.723** absolute
  at n = 15;
  `quality/NULL_AUDIT.md` §1.3 measured that neither beats its own
  label-permutation null's MAXIMUM, and the within-item one is not separated
  from that null at all (p = 0.13). That audit is warm and has not been re-run
  cold, so the layer's status is unchanged in both directions.
- What is dented is the reach of the word "no". One feature clears FDR in both
  designs cold, and the doctrine's sentence, read strictly, denies that.

**And what neither doctrine has to give up: cross-design is not
cross-tradition.** Experiment 1's 15 survived and 117 forgotten sonnets are a
**subset of Experiment 2's 152 human items** — `discriminate.py` draws both from
the same 384 cached vectors and they share cache keys. The two designs share
their entire human side: one author, one form, one language, one era, one
publication event. A feature clearing both is being asked about the same corpus
twice with different negatives. Doctrine 8 decides what that is worth, and the
answer is that it is a replication across LABELS and not across traditions.

**So what is reinstated is exactly this and no more:** the sentence "It clears
one design" is withdrawn, and `rhyme_predictability_mean` clears FDR in both
designs with the predicted sign on the cold figures. The stronger sentence it
replaced — that this is "the only candidate universal" — is **not** reinstated.
Nothing about universality follows from two overlapping contrasts in one
corpus, and the second cell that would test it has still not been run.

## What is still warm, and is not repinned here

- ~~**Every permutation p-value and every FDR verdict in this file**, apart from
  the four cold p's quoted above.~~ ~~**Both hit counts and the wrong-sign
  count**, which are tallies over those p-values.~~
  **DISCHARGED 2026-08-22.** The full run (1,108s, no cache) measured every
  permutation p in both feature sets, so the p columns, the FDR verdicts and all
  six tallies are now cold and are stated as such above. The reason the caveat
  existed is unchanged and still governs the PINS: an AUC is free and a p costs
  20,000 shuffles per feature, so `test_discriminate.py` pins all forty-four
  AUCs and deliberately pins no p (doctrine 57) — a cold p is measured when the
  full run is made, not guarded between runs.
- **`quality/NULL_AUDIT.md` §1.3's label-permutation nulls and seed
  distributions**, measured warm 2026-08-13 — and, separately, measured against
  the frequency sentinel that M-31 corrected. Every comparison of a current draw
  against one of those medians in this file or in `RESULTS_WITHIN_ITEM.md` is a
  cold observation against a stale null, and is flagged where it is made. This
  is the largest thing in the discrimination arm that has NOT been re-run.
- Doctrine 20 for all of it: an instrument that has not fired is not an
  instrument that fired and found nothing.

## Provenance

**Current, measured 2026-08-22** — cache fingerprint `2901613b0de5e63a`, 384
extractions in 1,108 CPU-s, 0 entries loaded (genuinely cold):

| kind | file | digest |
|---|---|---|
| src | `features.py` | `ast:c0c1b48feb25833f` |
| src | `lyric_harness.py` | `ast:b90835b87fa99800` |
| src | `within_item.py` | `ast:f4279bd7d70b098d` |
| res | `cmudict.dict` | `81917843c7f44ce2` |
| res | `concreteness.txt` | `0b4082dbd38585b0` |
| res | `opensubtitles_en_50k.tsv` | `c0519dbd5b0fc30e` |

The `features.py` digest is post-M-32: `DIRECTION` is inside `cache_identity`, so
the ruling invalidated the cache even though it moves no measurement — which is
the fingerprint doing its job, not a cost.

> ~~Cold AUCs pinned in `quality/test_discriminate.py` at `features.py`
> `affe2209d56e24b5`, `within_item.py` `703b700a530925c7`, `lyric_harness.py`
> `10c1dca86b15860a` and `7c894bfce92a48a7`, `concreteness.txt`
> `0b4082dbd38585b0`, `wordfreq20k.txt` `4ed6e5336d7760d2`, `cmudict.dict`
> `81917843c7f44ce2` — measured 2026-08-13 ... The four joint AUCs were first
> repinned cold in commit `98f07a4`.~~ **SUPERSEDED 2026-08-22.** Kept because it
> is the provenance of the superseded readings this file still carries — and
> because it names `wordfreq20k.txt`, the resource the owner refused on
> 2026-08-22 and which no longer feeds this measurement. Verification history
> for that reading is unchanged: two `lyric_harness.py` digests agreeing on all
> forty-four, and two full 69-assertion passes with 0 failures, one
> fingerprint-matched and one genuinely cold at 1,053 CPU-s.

Seed medians from `audit_joint_auc_null.PINNED`, 200 seeds, 2026-08-13 — **not**
re-measured against the corrected sentinel.

### One coordinate had already moved again when this section was written

STATED RATHER THAN IMPLIED, 2026-08-13. At the moment of writing,
`quality/features.py` and `quality/within_item.py` are byte-identical to the
digests these pins declare. **`lyric_harness.py` is not**: it carries an
uncommitted edit and digests `022c22430df553b4` against the pinned
`7c894bfce92a48a7`. In the same window `quality/discriminate.py` changed its
cache identity from a byte digest to an AST digest with docstrings stripped —
the fix `RESULTS_CACHE_IDENTITY.md` recorded as held — so `SOURCE_FILES` now
key as `ast:...` and every cache on disk was discarded once.

Neither change is known to move any number here, and neither is known not to.
The pins above are verified at the digests they name and this file does not
claim more than that. Re-running to find out would recompute against a
comparator that is still moving, which is the condition
`audit_joint_auc_null.py` already refuses under rather than answering: *"a cold
recompute cannot outrun the rate at which this repo's own comparator moves."*
Doctrine 20 — this is a "cannot tell", and it is recorded as one.

Doctrine 58: argue these and repin them with the date. Do not tune the
measurement to meet them.
