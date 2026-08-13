# METHOD — the long doctrine

The appendix to `CLAUDE.md`. Seventy-five of the ninety-five doctrines live
here: nulls, controls, calibration, thresholds, refusal rates, provenance
verification, and what an edition does to the constraint you are trying to
measure. `CLAUDE.md` keeps the twenty that decide what gets made.

**The numbering is global and unbroken across the two files.** Doctrine 79 is
doctrine 79 and it is in part C below. The index at the foot of `CLAUDE.md`
maps every number 1–95 to its home. Nothing is defined twice and nothing was
deleted in the split: where a claim here has been falsified it is marked
WITHDRAWN or AMENDED in place, per this project's own rule, which is why
several items argue with themselves and why you should read an item to its end
before quoting its first sentence.

**When to read this.** When you are about to measure something and report a
number. If you are drafting, revising, or deciding what to build, `CLAUDE.md`
is the file, and this one will cost you the afternoon it exists to save.

**Amended 2026-08-11, inline and dated.** **29** — FWER's family size had been
measured on the pairs that survived the band, so its exemption from a deep tail
is withdrawn while its ordering against BH survives. **70** — the `-ong`/`-ok`
comparison figure reproduces nowhere and is withdrawn; the zeros reproduce and
they are what the argument rests on. **88** — "23 of 24 recoverable" was
arithmetically impossible; the figure is 19 and the argument is untouched.
Each amendment names the tokenisation, the runner, or the command that
produced its replacement, which is the only thing that stops a fourth value
appearing next round.

---

<!-- DOCTRINE-BLOCK -->

## Part A · Nulls, controls, and what a negative result means

A null is a modelling decision, and a wrong one is worse than none because it
looks like rigour. Every item here is a way one of ours was wrong while
looking right.

19. **An argmax over a swept parameter is biased toward whichever end of the
   sweep has more degrees of freedom, and must be withheld on a null result.**
   The time layer sweeps a tactus period and reports the maximizing one. KL's
   small-sample bias grows with bin count (E[KL] ~ (P-1)/2n), so on pure noise
   the sweep chose the largest period offered 65% of the time and the
   second-largest 35% — against an observed sonnet split of 68%/32%,
   indistinguishable. The p-value is safe because the null takes the same
   maximum; the recovered period is not, and reporting it beside a null p is
   an invitation to read tea leaves. `analyse()` now returns period=None
   unless p < .05.

20. **"Inconclusive by construction" is not "null", and collapsing the two is
   a false negative dressed as a finding.** The time layer's first registered
   run marked 87-97% of eligible slots as rhyme events, so the event and slot
   distributions coincided by construction and the test had no power. It
   returned p = 0.087 on the rap verse, which reads like a near-miss and
   measured nothing. The layer now refuses above a declared saturation ceiling
   rather than returning a weak p, and the refusal names the instrument — not
   the verse — as what needs fixing.

25. **Agreement is not evidence, and one channel can need both predicates.**
   The fitted matrix scored two ABSENT codas at 0.000 bits, correctly: they
   carry no evidence. The band asks whether they AGREE, and they do — `see`/
   `free` is a perfect rhyme. A quarter of the sonnets' mandated pairs have two
   empty codas, so conflating the predicates would have deleted them all while
   the case that motivated the change still looked fixed. Registered as the
   tripwire and checked first.

27. **A null must not be conditioned on the filter it is calibrating.** The
   first family-wise correction dropped chance pairs that failed the rhyme band
   from its null, so the null consisted only of pairs that had already passed
   the band and nothing real could beat it — 0% saturation on every corpus. A
   chance draw that fails the filter scores minus infinity and belongs in the
   DENOMINATOR, not in the bin. Count valid draws, not surviving ones.

28. **Distinguish "none" from "cannot tell", mechanically.** A within-item null
   cannot detect rhyme in an item whose own inventory is one rhyme class: 43%
   of random re-pairings in rattle/cattle/saddle/battle already rhyme, against
   ~10% for real verse, so nothing is surprising relative to that text. That is
   true of the method, not fixable by tuning. The layer measures its own null
   band-pass rate and refuses above 25% rather than reporting 0% events.

30. **A powered null is a different claim from an unpowered one.** Every time-
   layer null before the correction was uninterpretable: at 87-97% saturation,
   "found nothing" and "could not have found anything" were the same output.
   Do not report the first as if it were the second, and do not let a
   correction that finally delivers power get filed as a refactor — it changes
   what the negative result means.

31. **Run the positive control before believing any null.** The time layer
   produced nulls across three instrument versions before anyone asked whether
   its statistic could detect a signal it was pointed at. It can — power 1.00
   on a planted signal, 0.05 at chance — but at the 5-8 events a real item
   carries it needs ~75% of an item's rhymes on one phase to see anything.
   Every earlier null was evidence about sample size, not about verse. A
   synthetic planted-signal control is cheap, language-agnostic and needs no
   corpus, so there was never an excuse for it coming fourth.

33. **Correcting across items is not combining evidence across them.**
   Benjamini-Hochberg answers "which items are discoveries"; it never asks
   whether the arm as a whole shows the effect. Fisher's method does, and is
   legitimate here because each item's KL is phase-invariant so the p-values
   are comparable even when the phases are not. The aggregate question had gone
   unasked for the whole life of the layer.

41. **A positive control can pass for the wrong reason, and only a second
   control tells you which.** Arm A of the Tang run was unanimous -- 264/264,
   Fisher p = 0 -- and dropping the rhyme requirement entirely gave the
   IDENTICAL result, 300/300. The p-value was carried by line length, not by
   rhyme: every second line-end in an isosyllabic form is periodic whether or
   not anything rhymes there. It bites harder in Chinese than English because
   one character is exactly one syllable, so the grid is perfect, whereas
   English sonnets are isosyllabic but not iso-stress-count. Pair every
   positive control with a same-positions-no-signal arm before believing it.

42. **The cross-family replication came back negative, twice.** Internal rhyme
   placement shows no periodicity in Shakespeare's sonnets (Fisher p = 0.950,
   k=23) or in Tang regulated verse (Fisher p = 0.883, n=300). Two families,
   two unrelated prosodic systems, same answer: forms fix sound-repetition at
   LINE ENDS and do not additionally organise it internally against a period.
   Every positive control this project can currently reach is positional by
   construction, so a cell whose mandated constraint is INTERNAL --
   dróttkvætt, cynghanedd, gabay -- is what would actually test the claim.

56. **A search over placements needs a null under the same search.** Trying
   every word boundary for the caesura and keeping the best is k hypotheses per
   line, and on this corpus k averages 10.6. Run that identical search over
   lines whose words have been SHUFFLED WITHIN THE LINE -- same words, same
   consonants, same length, arrangement destroyed -- and it still reports
   cynghanedd on about a quarter of them. So a bare "26% of lines carry
   cynghanedd", obtained by search, is quoting the null back at itself. The
   excess over the shuffled null is the part attributable to the poet, and it
   is the only part worth reporting. Two editions, 200 shuffles each:
   Alun 54.1% vs null max 27.8% (+26.3); Twm o'r Nant 51.3% vs 36.5% (+14.7).
   This is the `infer_chains` comparator bug in a new place: whatever advantage
   the hypothesis gets, the comparator gets too. `quality/cynghanedd_rate.py`.
   Note what the same file says about `caesura='marked'` on Twm o'r Nant --
   3.2% observed against a 5.1% null, p=0.975, BELOW chance. That is not a
   finding about Welsh. It is the mode reporting, correctly, that this edition
   prints no caesura and it has nothing to read.

57. **An empirical p sitting at 1/(n+1) is reporting the resolution, not the
   effect.** With 200 shuffles the smallest p obtainable is 0.005, so p=0.005
   means "no shuffle reached the observed value" and NOTHING about how far
   above it sat. Two results in the same run both printed p=0.005: one where
   observed beat the null's maximum by 28 points, and one where it beat it by
   0.6. Read the gap to the null's max, or raise n until p moves off the floor.
   Doctrine 20 said inconclusive-by-construction is not a null; this is the
   same error wearing a significant-looking number.

63. **Check whether your null is the identity map before you trust it.**
   Kalevala alliteration is "at least two words in the line share an initial",
   which is a SYMMETRIC function of the line's word multiset -- so shuffling
   words WITHIN the line changes nothing and returns the observation exactly.
   Run at 200 replicates it gives p=1.0000, and a cell that had reached for the
   obvious null without thinking would have reported a clean null and concluded
   the Kalevala does not alliterate. The right randomisation destroys what the
   predicate is actually sensitive to -- here, WHICH WORDS SHARE A LINE, so the
   null permutes the whole token sequence and re-cuts on the original line
   lengths. Doctrine 56 said run a null; this says the null is a modelling
   decision and a wrong one is worse than none, because it looks like rigour.
   State what each null PRESERVES and what it DESTROYS, every time.

64. **A big true effect and an uninterpretable headline are compatible.**
   Kalevala weak alliteration is 82.6% observed against a null max of 30.6% --
   the constraint is real and the excess is 51.7 points. It is also true that
   nearly a THIRD of lines alliterate with their words redealt at random, so
   only 63.7% of the hits are above chance. "81.2% of Kalevala lines
   alliterate" was never wrong and was never usable. Report the excess over the
   null, not the rate; a rate is a statement about the language's redundancy as
   much as about the poet.

68. **The identity-map trap has more than one shape.** Doctrine 63 caught it in
   Finnish, where the predicate is symmetric over the line's word multiset. It
   turned up again the same day in Persian by a different route: permuting the
   final token WITHIN a ghazal is degenerate because a ghazal that has a radif
   has identical finals, and permuting identical elements changes nothing --
   94.5% of detected ghazals came back byte-for-byte unchanged, p=1.000. Two
   cells, two languages, two mechanisms, one failure. Before trusting a null,
   check what fraction of replicates differ from the observation at all. A
   randomisation that can be run, look rigorous, and test nothing is the most
   dangerous object in this repo.

69. **A null can be a null about the wrong thing.** The Persian cell predicted
   a within-line shuffle would inflate the radif excess, left the prediction in
   the file, and was wrong: it gives the SMALLEST separation of the three nulls
   because a ghazal repeats its own function words, so the shuffle throws the
   same `ke`/`o`/`kard` to the end of several lines of the same ghazal. It is
   not a conservative null; it is a null about vocabulary. Doctrine 28 said a
   within-item null contains what the item contains -- this is that, and the
   lesson is that "more conservative" is not a property you can reason your way
   to. Name what each null is a null ABOUT, then check it empirically.

71. **A negative control that does not separate from its own null is not a
   negative control.** The conjunctive band shipped because it dropped Whitman
   from 26.0% to 20.0%. Permute Whitman's LINES within the item and the null
   spans 6.7%-27.3%: BOTH figures are inside it (p=0.055 and p=0.209), and the
   null MEDIAN falls 19.3 -> 16.7 when the band goes on, so the separation
   moved +6.7 -> +3.3 pp from a baseline that never separated. A filter that
   lowers chance and signal together has not tightened anything. The same
   statistic under the same null separates the SONNETS by +17.9 pp with p at
   the floor -- so the instrument was never the problem and the comparison was
   the empty part. Before citing a control as evidence for a decision, check
   that the control itself clears its null.

   **AMENDED 2026-08-11 — the instance expired and the doctrine got STRONGER
   for it.** Every number in the paragraph above is the pre-`b1d7f64`
   comparator's. Under the shipped one the same statistic reads 17.3%, the
   null median HALVES to 8.0%, and the separation goes +6.7 -> **+9.3** pp
   with p = 0.006 at n=2000 — the sign of the effect FLIPS. So a control can
   fail its null in the other direction too, after an instrument change nobody
   re-ran it against. The rule survives unchanged and gains a second clause:
   **re-run the control when the COMPARATOR moves**, because a negative
   control is a coordinate of the comparator exactly as a threshold is
   (doctrine 58). And the deeper reason this control failed needs no null at
   all: half its detected links are REPEAT on an identical token — `now`
   closes four consecutive lines — so the property under test was PRESENT in
   the text. **Check that the negative control LACKS the property before
   checking that it clears its null.** `quality/RESULTS_NULL_SHAPES.md`.

   **AMENDED AGAIN 2026-08-13 — the AMENDMENT expired faster than the instance
   did, and that is the finding.** Same script, same seed, same n=200: band OFF
   26.0% / null median 19.3% / +6.7 pp / p 0.0547, unchanged to the decimal;
   band ON **10.7%** / null median **5.3%** / **+5.3 pp** / **p 0.0199**. So
   the separation FALLS again — +6.7 -> +5.3, MEASURED 2026-08-13, REPINNED
   from +6.7 -> +9.3 (2026-08-11), which had superseded +6.7 -> +3.3
   (2026-08-10). **The sign did not flip; it flipped BACK**, and the paragraph
   above — which retired doctrine 71's own sentence on this text — is now the
   stale figure. Three comparators, three answers, one text. The clause the
   2026-08-11 amendment added, *re-run the control when the COMPARATOR moves*,
   is the clause that caught its own paragraph, which is the strongest thing
   that can be said for it.
   THE CONTROL ON THE CONTROL, and it is why the movement is attributable: the
   band-OFF row reproduces to the decimal on BOTH corpora — the sonnet arm was
   re-run at full n=200 and gives null median 29.9%, min 25.5%, max 35.6%,
   +23.6 pp, +17.9 pp over the MAX, p at the 0.0050 floor. The null machinery
   is unchanged, so everything that moved is downstream of the band-ON
   comparator alone. The observation falls 15.3 pp and the null median falls
   14.0 pp TOGETHER, which is this doctrine's sentence verbatim; meanwhile the
   sonnets go +23.6 -> +26.4, so the band tightens the positive corpus. The
   instrument is fine and the Whitman comparison is the empty part.
   NOTE THE TWO STATISTICS THIS PARAGRAPH QUOTES UNDER ONE WORD: +6.7, +3.3,
   +9.3 and +5.3 are the excess over the null MEDIAN; the +17.9 pp above is
   the excess over the null MAX, which grows with n and is not comparable
   across sample sizes (doctrine 57's mirror, doctrine 91's rendering point).
   The doctrine's conclusion is untouched either way, because it rests on
   `RESULTS_NULL_SHAPES.md` §2 and on none of these numbers: seven of Whitman's
   NINE detected links (78%) are REPEAT on an identical token — REPINNED
   2026-08-13 from 7 of 14 (50%), the REPEAT count unmoved and the RHYME links
   collapsed 7 -> 2, so the ground STRENGTHENED as the null argument weakened.

73. **A single CV seed is a coin flip reported as a verdict.** RESULTS_WITHIN_
   ITEM P2 recorded "FAILED. 0.659 -> 0.604" off one hard-coded seed. Over 200
   seeds the medians are 0.603 and 0.606 -- the sign of the difference flips.
   The document's CONCLUSION survives and is strengthened (neither AUC beats
   its own label-permutation null), but the scored verdict was an artifact of
   the seed. Any number from a randomised split needs its own distribution.

74. **Check that your H0 is uniform before quoting a p from it.** A pooled
   Fisher p of 0.950 was read as 1-in-20. Under 200 H0 replicates at the real
   item sizes the per-item p has median 0.559, not 0.500, and the share
   reaching >=0.950 is 0.085 -- about 1-in-12. The cause is structural: rhymes
   arrive in PAIRS inside a window while `analyse()` draws independent
   positions, so observed events are more phase-spread than the null assumes.
   The repo already contained the proof -- arm C2 is an empirical H0 arm and
   returns Fisher p=1 -- and nobody had put the two next to each other. A
   p-value inherits every assumption of the null that generated it.

75. **A null that is correct for one predicate can MANUFACTURE a null for
   another.** Shuffling words within a pāda is the right control for a
   POSITIONAL onset anchor -- it destroys which akṣara lands second while
   preserving every phoneme. Applied to END-RHYME it drags short words to the
   pāda end (final-word length 4.52 -> 4.24 akṣaras, 1-2-akṣara finals
   20.8% -> 27.9%), and short Sanskrit words are dominated by high-frequency
   inflections that collide, so the null rate rises ABOVE the observation and
   invents a null result. Same randomisation, same corpus, right for two
   variants and wrong for a third. Choose the null per PREDICATE, never per
   corpus, and check what it does to the material the predicate reads.

76. **A null is only as good as the demonstration that the instrument could
   have found something.** The Sanskrit prāsa null is believable because the
   same design detects a signal planted in as few as 5% of half-verses, and
   reads 6.16x lift on Jayadeva's attested end-rhyme while reading 1.68x on
   Bhāravi's, where it is not attested. Without those arms, "6.995% against
   6.2% chance" is indistinguishable from a broken detector. Contrast the time
   layer's sonnet arm, where the event rate does NOT separate from scrambled
   text: there the same shape of null means nothing, because "no periodic
   organisation" and "nothing to organise" have not been told apart. Doctrine
   31 said run the positive control; this says REPORT ITS SENSITIVITY next to
   the null, because a null without a detection floor is an unfalsifiable
   claim wearing a number.
   **AMENDED 2026-08-10 — the calibration SURVIVES and the number attached to
   it was a mixture.** The Gītagovinda is now on disk with its song roles
   marked, so the pooling can be undone. Stratified, adjacent-pair, depth 1:

   | stratum | pairs | observed | null max | lift |
   |---|---:|---:|---:|---:|
   | all adjacent pairs (≈ the recorded arm) | 179/691 | 25.90% | 3.49% | 7.43x |
   | **verse–verse INSIDE one aṣṭapadī** | **161/164** | **98.17%** | 4.88% | **20.12x** |
   | pair touching a refrain | 14/384 | 3.65% | 3.92% | 0.93x |
   | śloka–śloka | 4/119 | 3.36% | 5.88% | 0.57x |

   Jayadeva's end-rhyme is not a 26% tendency. It is a **~98% RULE inside the
   aṣṭapadī couplet and absent everywhere else in the same text**, at or below
   chance on refrain-adjacent and śloka pairs. So the instrument is FAR more
   sensitive than this item claimed, and the pooled figure was averaging a rule
   with the material the form never constrained — doctrine 79 one layer up, a
   denominator quietly including cases where there was no question. `26.32%`
   must never again be quoted as "Jayadeva's rhyme rate". Also corrected: the
   planted-signal floor is in INSTANCES, not percent — 0/20 at 3–4 instances,
   16–17/20 at 5, 20/20 at 6+ — and a first framing as "% of lines planted"
   hid that, because the threshold is a per-chapter count.

89. **Report the excess as a SERIES, because a falling raw rate can hide a
   collapsing constraint.** Finnish alliteration runs 82.3% (Kalevala) → 81.8%
   (Kanteletar) → 71.8% (Lönnrot's own 1840 "newer songs") → 58.4% (Kivi), which
   reads as a gentle 24-point decline. The excess over a matched null runs
   +50.8 → +15.7 → +15.0, a **3.4x collapse**, because the null RISES with the
   observation as lines lengthen (29.9% → 46.8%). Doctrine 64 said report the
   excess rather than the rate; this says the two can move in different
   directions across a series and the rate will tell you the wrong story about
   the trend, not merely an inflated one about the level. Two things this run
   settled: the SUNG book out-alliterates the narrative epic (strong 60.2% vs
   55.7%), and the negative control was **nominated by the source's own editor**
   — Lönnrot writes that in the newer songs the alliteration is `sattumoissa`,
   by accident. Measured, he is right in direction and wrong in degree: +15.7 is
   3.2x smaller and no shuffle in 200 reached it. He also says he pruned those
   songs and that one of them is in the old metre, so the control is impure by
   its own editor's admission — and it was LEFT impure, because dropping that
   song would be tuning a control to the result it exists to test.

90. **A null can be RIGHT and the statistic wrong, and only the pairing tells
   you.** Bilhaṇa's Caurapañcāśikā opens 47 of 100 lines with `adyāpi`. Line
   permutation is the correct randomisation for it. Paired with a DENSITY
   statistic it gives 47.00% observed against a null MAX of 47.00%, lift 1.00,
   p=1.000 — and below chance at K=2. Paired with a POSITION statistic — all 47
   are the FIRST line of their couplet — it gives 100.0% purity against a null
   median of 48.9%, p=0.0005 at 2000 replicates, every replicate differing.
   Same text, same null, same corpus: one pairing says nothing is there and the
   other says the effect is total. Doctrine 75 said choose the null per
   PREDICATE; this says the null and the statistic are chosen together, and a
   correct null hung on the wrong statistic manufactures a null result exactly
   like a wrong null does. Third language, third mechanism, after Finnish
   (doctrine 63) and Persian (doctrine 68). Note also what the same file says
   about Bilhaṇa's END rhyme: 2.02% against a null median of 4.12%, p=0.945,
   below chance — correct, because the form is unrhymed vasantatilaka and its
   repeat is at the line HEAD. The two Sanskrit songs in this repo put their
   refrain at opposite ends of the line, which is the argument for the anchor
   axis (doctrine 83) arriving from the corpus rather than the taxonomy.

## Part B · Thresholds, calibration, and fitting

Every number in this project is a coordinate of a setting. These are the
settings that turned out to be load-bearing after somebody quoted the number
without them.

8. **Never fit on one tradition.** Five of ten features INVERT between the
   two experiments. A single corpus does not give a narrow answer, it gives a
   confidently wrong one; Experiment 2 alone would have recommended optimizing
   toward archaic pastiche. Cross-tradition replication is the error bar.

10. **The quality layer has NO demonstrated cross-design signal.** After the
   within-item respecification: 1/8 hits in each experiment, Exp 1 at 0.604
   (n=15, does not exclude chance), Exp 2 still 0.877 (style, not quality).
   Do not build on these features or cite their earlier numbers. The one
   surviving feature, wi_predictability_advantage, has an AUC mathematically
   identical to its absolute form -- recentring is a monotone transform, so it
   buys cross-tradition comparability and exactly zero power.

11. **Two features have now been caught reading period, not quality.**
   syntactic_inversion_rate is an Early Modern English archaism detector, and
   rhyme_predictability's cross-design replication was an OOV artifact (an
   unreadable word was scored as maximally rare, so CMUdict's inability to
   read Shakespeare registered as his unpredictability). Assume any new
   feature is doing this until a within-item version says otherwise.

12. **Wimsatt binding is unsupported here, under two operationalizations.**
   Raw differing-category fraction: null. Excess over a permutation null from
   the item's own line-final tags: also null. Stop rescuing it.

13. **Any resource used to score a cell must be INDEPENDENT of that cell's
   label.** Frequency lists, background corpora, positive controls and
   correction calibrators all count as resources. A drafted matrix design was
   blocked on exactly this: it built per-cell frequency lists from the labelled
   pool, so in Finnish a word in a 362-variant type had corpus count 361 after
   leave-one-out while a singleton-type word had 0 -- making the feature a
   monotone function of the label. Where independence is impossible, state the
   dependence and argue its direction BEFORE the run.

14. **A control may not be defined in terms of the quantity it controls.** The
   same design's positive control replaced each rhyme partner with the
   highest-frequency member of its own candidate field, while the feature is
   the percentile of the realised partner in that field -- so the control
   equalled its ceiling by construction. ~52 of 80 tests were identities. Build
   controls by shuffling within a cell, and never let a calibrator be something
   Zipf's law guarantees will fire.

15. **Text length is a coordinate of the declaration, not a detail.** MATTR is
   a moving average over a 50-token window and silently degrades to plain
   type-token ratio below it, so the sonnet-calibrated floor applied to a
   30-token chorus was comparing one statistic against another statistic's
   percentile. Measured at both units the human 95th percentile for anaphora
   is 0.286 on a sonnet and 0.500 on a quatrain — the sonnet cut flags any two
   of four lines sharing an opening. On the sample lyric sheet the mismatch
   produced 15 flags where the correct profile produces 4. Every threshold now
   carries the length it was measured at, and text outside every profile gets
   no length-sensitive finding at all.

16. **An uncalibrated threshold does not fail safe, it fails loud — and it
   fails toward whoever guessed.** All three hand-estimated floor thresholds
   moved on contact with data, every one in the direction that had made the
   gate agree with its author: mattr_min 0.80 -> 0.7557, predictable-pair
   fraction 0.40 -> 0.8333, line-length CV 0.12 -> 0.0939. The guesses would
   have flagged roughly half of Shakespeare for lexical monotony and 60% of
   him for predictable rhyme.

17. **A check may be kept after its premise is falsified, but never quoted as
   if it were not.** UNIFORM_LINE_LENGTH was built expecting metronomic lines
   to be a generated-text tell; measured, Shakespeare is MORE uniform than the
   model (AUC 0.350). In a fixed form, uniformity is the form. It survives as
   a calibrated "outside the human range" note that says so in every finding
   it emits, and `report()` prints the failed expectations beside the working
   ones on every run.

18. **A licence granted by pattern must be earned by systematicity.** The
   radif band was licensed by any shared trailing run, which made a plain
   self-rhyme structurally invisible; then by a bare count of two, which read
   two of thirty-one rap couplets ending in "it" as a refrain. A repetend now
   needs both a count and a declared fraction of the item's pairs, and where
   one pair gives no evidence either way the gate says so instead of deciding.

21. **Removing a floor does not remove COMPENSATION, and they are different
   defects.** `sun`/`much` was called an additive-floor leak from the first
   commit. Its nucleus is *identical* — half the score was earned — so it was
   never a floor case. Log-odds killed the floor and `sun`/`much` still clears,
   because summing evidence across channels lets a strong nucleus outweigh a
   coda mismatch exactly as adding weighted similarities did. What it needs is a
   conjunctive band rule, which is a property of the band, not the comparator.
   The floor cases (dawn/again at 69% floor) did close.

22. **State a threshold as a false-positive rate, not as a point on a scale.**
   Nobody knew that theta 0.75 was an 11.8% FPR on random pairs and theta 0.90
   was 2.4%, so "raise theta" and "tighten the gate" were not the same
   sentence. Calibrating every threshold against the same random-pair
   background made two years of tuning decisions comparable in one table, and
   immediately showed that the time layer's saturation was a
   multiple-comparisons problem: ~135 comparisons per stressed syllable, so
   even a 2.4% per-pair FPR gives 96% saturation. A per-pair threshold cannot
   fix a family-wise error.

23. **A fix can remove one unconditional gift and hand out another.** The
   fitted matrix zeroed the stress channel for stressed-stressed, exactly as
   predicted, and then paid +5.71 bits for unstressed-unstressed on 200 real
   observations — true of the corpus, and not evidence of rhyme. The Whitman
   negative control caught it at three times the false-positive rate; nothing
   else would have. Anchor stress is CONDITIONING information, saying which
   anchors are comparable, and putting it in a likelihood ratio whose
   background treats it as independent is a modelling error.

29. **BH and FWER have different resolution requirements, and BH's is brutal.**
   Benjamini-Hochberg's cut for the top-ranked p is q/n; at n ~ 10^4 candidate
   pairs that needs a tail resolved to ~1e-5, and a 20000-draw null resolves to
   5e-5. Whether anything is discovered then depends on how many p-values pile
   up on the resolution floor — measured, 63% saturation on one sonnet and 0%
   on the next three. FWER's cut is alpha/m with m ~ 15 and needs no such tail.
   Check that a correction can resolve its own threshold before using it.
   **AMENDED 2026-08-11 — the ORDERING survives and the free pass does not.**
   "FWER's cut is alpha/m with m ~ 15" measured m on the pairs that SURVIVED
   the band. The family is the comparisons MADE. Re-measured: the median
   CANDIDATE family is 89 on the four-line fixture and 156-282 across 24
   sonnets (203 on sonnet 1), against a median SCORED family of 6-13 on the
   same items -- so FWER's required resolution is ~13x finer than this item
   claimed, alpha/203 rather than alpha/15. At `null_samples=2000` the Sidak
   cut on sonnet 1 is 2.53e-4 and the p-value floor is 5.00e-4: THE CUT SITS
   BELOW THE FLOOR, and FWER cannot resolve its own threshold either. What
   stands is the ordering -- q/n on the same sonnet is 1.37e-5, so BH would
   need 73,030 draws, where the default `null_samples=20000` already gives
   FWER 5x of headroom. So `null_samples` is load-bearing exactly where this
   item said it was not, and the last sentence above now applies to FWER too.
   `quality/test_fwer.py` test 7 prints the amendment; `quality/fwer_family.py`
   re-measures the family. The stale "~15-comparison family" also appeared in
   doctrine 4 and in a comment in `quality/time_layer.py`; doctrine 4 is
   corrected, the code comment is not this cell's to write.

58. **A recorded COUNT is a threshold nobody wrote down.** `data/sources.tsv`
   said the Hafez corpus showed radif in 297 of 495 ghazals. A fresh
   implementation found 315 and was told to report the discrepancy rather than
   tune to it. Neither number was wrong: 297 is EXACTLY `min_fraction=1.0` and
   315 is 0.60, on a sweep that runs 318/318/315/311/310/306/301/297. The
   disagreement was never about the text; it was about a parameter the first
   count had not stated. Any bare n-of-N in this repo is a coordinate of some
   setting -- write the setting next to the number, or the next person to
   measure it will think one of you is wrong. (And neither threshold dominates
   here: 0.60 wrongly admits ghazal 100, 1.00 truncates ghazal 422's radif from
   `amade i` to `i`. Both are reported for that reason.)
   **Second instance, one round later, so this is a pattern and not an
   anecdote:** `data/sources.tsv` recorded 82 ABAB pantun quatrains. A fresh
   implementation confirmed 80 of 82 -- and the two that separate are the only
   two whose end word is a Skeat EDITORIAL PARENTHESIS. The recorded 82 is
   exactly `editorial_parentheses='keep'`; 80 is `drop`. Nobody had written
   down that a bracket printed by a Victorian editor was being counted as the
   poet's rhyme word. Both settings are reported and the default is `drop`.

61. **A rule that fires more often is not a better rule.** Four readings of
   which consonants carry a hending were tested against shuffled-line controls
   rather than argued about. "First post-vocalic consonant only" FINDS THE MOST
   -- 75.0% -- and is the WORST of the four, because its chance rate nearly
   triples to 31.9%. Yield is not evidence; lift over a matched control is.
   This is doctrine 56 arriving from the other side: there the search inflated
   the measurement, here a looser rule definition would have. Any time a rule
   has variants, pick between them by lift, and record the table.

72. **A calibration measured at n=6 is not a calibration.** The time layer's
   false-event rate, "5.4% against a declared 5.0%", reproduces to the digit --
   and it is six sonnets. Run the identical construction at n=20 and it is
   9.6%, roughly twice alpha. The guarding test runs THREE sonnets and asserts
   only `mean < 0.20`, a tolerance that cannot detect a 2x miss. An alpha claim
   is a claim about a long-run rate; measure it at a length that could falsify
   it, and set the test's tolerance from the claim rather than from the
   observation.

91. **Doctrine 58 gains an axis: a count is a coordinate of the RENDERING, not
   only of the threshold.** Two independent scrapes of the same Ḥāfiẓ text
   align 495/495 by maṭlaʿ and are byte-identical on **only 81 of 495**. They
   agree on 495/495 radif verdicts at `min_fraction=0.60` and differ on exactly
   ONE at 1.00 — 297 against 298 — and the difference is ghazal
   `از سر کوی تو هر کو به ملالت برود` line 6, where one reads `ببرد` and the
   other `برود`. **A one-letter recensional variant**, not the joined-versus-
   spaced orthography doctrine 65 named. Two things follow. The normaliser is
   VINDICATED: it absorbs 414 ghazals of byte disagreement without moving a
   verdict. And the unstated RECENSION is not a footnote — 297 is a coordinate
   of a threshold AND of a manuscript tradition, and only one of those was ever
   written down. Related, from the same run: a first Persian arm paired
   LINE-FINAL tokens and got 33.2% None against the recorded 60.2%; rebuilt on
   QĀFIYA words it reproduced to the decimal. The number had not moved — it was
   a different statistic. Build the population the same way before calling a
   comparison a comparison.

94. **A positive-case suite cannot find a rule that is too GENEROUS.** Every
   comparator test in this repo was someone writing `nation`/`station` and
   checking that it passes — and a generous rule passes every positive case by
   construction. Nobody had written `five`/`of` and looked at the answer. The
   band's thresholds went eight months without a false-positive rate, and when
   one was finally measured (`quality/redteam_band.py`, 3,000 random CMUdict
   pairs against a strict-identity reference) it admitted **11.10% of random
   word pairs as RHYME while failing 7.2% of Shakespeare's mandated pairs** —
   a NEGATIVE separation. `independents`/`powersoft` passed because AH~AA
   scores 0.730 and NTS~FT scores exactly 0.600. This repo had two adversaries
   already, and neither attacked the CODE: the nulls attack our RESULTS, and
   `revise.py` attacks the WRITING. Build the third. The reference line has to
   need no judgement (here, strict identity of the tail-aligned nucleus and
   coda) and must be declared as a REFERENCE and not as truth, because a band
   tuned to agree with identity would delete slant rhyme, which is the point of
   having a band. `theta_coda` 0.60 -> 0.80 is shipped on a HELD-OUT split
   (doctrine 5): FPR 11.93% -> 4.67% for 0.6pp of true-positive cost, same
   direction in both halves. `theta_nucleus` is NOT changed — tightening it is
   a worse trade and `five`/`of` still passes at 0.603 against 0.600, which is
   now visible instead of hidden. Price the cost out loud: `bad`/`bat` is no
   longer RHYME, and it survives as ASSONANCE only because doctrine 24 makes
   the rule relabel rather than reject.

## Part C · Refusals and determinacy

The harness is allowed to say it does not know. What that costs, where the
cost falls, and why a refusal counted as a failure charges the wrong layer.

53. **Admissibility is per-RELATION, not per-corpus.** Gudni Jonsson writes
   `o-umlaut` for both etymological `o-ogonek` and `o-slash`, and `ae` for `oe`.
   For skothending, a consonant relation, the merger is harmless and the text is
   sound. For adalhending, which needs vowel AND consonant identity, the same
   merger MANUFACTURES matches that no skald heard. One file, one orthography,
   admissible for one predicate and biased toward the positive for the other.
   The tri-state exists for exactly this: return None where the verdict depends
   on a distinction the edition has already collapsed, rather than True.

59. **Refusing on SCRIPT has a measurable cost, and it should be paid in the
   open.** `fas.rhymes` returns None on 60.2% of 20,388 real Hafez pairs,
   because unvocalised Perso-Arabic does not write short vowels -- that is the
   designed outcome, not a failure. The 1.0% that come back False are almost
   all molamma' lines: Arabic hemistichs rhyming on an unwritten i'rab case
   vowel, which read as Persian end in a consonant. The module refuses by
   SCRIPT rather than by language, so Arabic-in-Arabic-script is accepted and
   those Falses are the price. Left standing and declared rather than patched,
   because a patch would be a language detector nobody calibrated.
   **AMENDED, and the amendment matters more than the original.** This item as
   first written implied the 60.2% None was a flat tax spread over all pairs.
   It is not. On RANDOM Hafez word pairs the module is decisive ~95% of the
   time -- it returns False. The refusal concentrates almost entirely on pairs
   that already agree on the written consonant skeleton, which is to say on the
   candidate rhymes. It refuses where the question is hard and answers where it
   is easy. That is the designed behaviour and it was asserted here before it
   was measured. See doctrine 67.

60. **Derive a refusal from what the RELATION needs, not from which relation
   looks vulnerable.** Doctrine 53 said Guðni Jónsson's ǫ/ø->ö merger corrupts
   aðalhending (vowel identity) and leaves skothending (consonants) alone, and
   that instruction was handed to the implementer in those words. It is wrong
   in one direction. Skothending requires the vowels to DIFFER, so two
   IDENTICALLY merged graphemes -- `jörð : hörð` -- cannot say they differ
   either, and returning True there asserts a distinction the edition already
   destroyed. It refuses in that case only. The asymmetry is real but it is a
   RATE, not a clean split: on the Háttatal text skothending refuses 1.0% of
   positions and aðalhending 6.9%. `jörð : fyrðum` stays definite in both, as
   predicted. Reason from the predicate's own requirements every time.

67. **A refusal rate is not a tax -- measure WHERE it falls.** `fas.rhymes`
   returns None on 60.2% of real Hafez rhyme pairs, and doctrine 59 read that
   as the price of refusing on script. Measured against random pairs drawn from
   the same corpus, the module answers False 92% of the time and refuses only
   ~5%. So the refusal is not spread evenly: it lands on exactly the pairs that
   already share a written consonant skeleton, the ones where the unwritten
   short vowel actually decides the answer. Among pairs it DOES decide, True is
   97.5% observed against a 2.2% null max. A high None-rate can mean the
   instrument is blunt or that it is aimed; only a matched control tells you
   which, and this project asserted the wrong one for a day.

79. **A REFUSAL is not a failure, and putting it in the numerator charges the
   wrong layer.** The sonnet battery divided violations by the 1064 pairs the
   form MANDATES. 50 of those have an end word absent from CMUdict, so the
   harness never had a verdict — and it counted every one as a rhyme violation,
   recording Shakespeare as failing to rhyme `viewest`/`renewest`. That is this
   file's own triage rule (ingestion / projection / anchor / comparator / band /
   structure / value) broken in the headline number: an ingestion miss was billed
   to the comparator. The rates on JUDGED pairs are 3.5% band-off and 7.2%
   band-on; 85−50 and 123−50, so NO COUNT MOVED. The lesson is not that the old
   numbers were large — it is that the correction ENLARGES the band's effect,
   from a 45% rise to more than a doubling, so a rate polluted this way is not
   even conservative in a predictable direction. And NULL_AUDIT.md had already
   listed 123/1064 under "reproduced exactly, no defect found": reproducing a
   number checks the arithmetic, never the construction. Report refused,
   judged and mandated as three separate counts, always.

84. **Ask the phonology in its own declared relation — and keep the channel path
   reachable.** 流/樓 is False on every channel and True under `ltc.rhymes`,
   because 平水韻 authorises a 同用 grouping the raw Qieyun does not (doctrine
   36). So where a phonology DECLARES a relation and IMPLEMENTS the predicate,
   the producer asks it and its answer wins, with `route` recording which path
   answered and `disagreements` reporting conflicts left unresolved. Two things
   this must not do. It must not silently swallow a refusal: a stub `rhymes()`
   inherited from a base class is distinguished from `fas`'s genuine None, or
   the designed 60.2% refusal would be overwritten with a channel guess. And it
   must not make the defect unreachable — `consult=False` still reproduces the
   documented wrong answer, and `test_declared_inputs.py` now pins BOTH: the
   channel path getting it wrong and the default path getting it right. A
   doctrine whose demonstration has been optimised away is a sentence nobody
   can check, which is the argument that keeps `modal_exclusion=0` reachable.

88. **A rime dictionary keyed on ONE orthographic norm silently refuses the
   character that NAMES a rhyme group.** `data/qieyun_mc.tsv` has no entry for
   魂 while 477 characters carry 魂 as their rhyme label; 窗 is absent and
   窓/牕/窻 are present. Of the 24 commonest unreadable characters in a real ci
   corpus, **19 are recoverable by an 異體字 map to a variant already in the
   table** (魂→䰟, 窗→窓, 匆→悤, 劍→劒, 峰→峯, 群→羣, 閑→閒 …) and the remaining
   five (怎 樣 褪 做 你) are Song–Yuan vernacular characters that postdate the
   rime book, where refusal is CORRECT. Nothing currently tells an ingestion
   defect from a correct refusal, which is doctrine 79's error in a second
   layer: a refusal rate is uninterpretable until its two causes are separated.
   **CORRECTED 2026-08-11.** This item read "**23 are recoverable by an 異體字
   map to a variant already in the table**", and 23 is arithmetically
   impossible: 23 + 5 = 28 against a population of 24. `MISSING.md` M-2,
   which this item restates, ENUMERATES NINETEEN arrows (魂→䰟 窗→窓 匆→悤
   裙→帬 劍→劒 峰→峯 群→羣 閑→閒 腮→顋 鞍→鞌 粧→妝 裊→褭 瀟→潚 皓→晧 胸→胷
   拆→坼 儘→盡 緲→渺 敧→攲) and 19 + 5 = 24 exactly. The summary integer was
   wrong in M-2 and this file copied it, which is how a doctrine propagates an
   arithmetic error: the enumeration was right and nobody added it up. The
   ARGUMENT is untouched -- an 異體字 map recovers most of the unreadable set
   and the vernacular remainder is a correct refusal -- and that is why the
   figure was worth checking rather than defending.
   Also unmeasured until now: a SIMPLIFIED corpus reads at 70.95% against
   traditional's 99.03%, with **31.7% of line-final rhyme positions unreadable**,
   and OpenCC is not the fix — characters that were separate Middle Chinese
   words resolve, so the corpus fails loudly on some merges and **silently
   returns a different word's rhyme** on the rest.

## Part D · Corpora, provenance, licences and editions

Doctrines 34, 44, 85 and 92 are in `CLAUDE.md` because they bind before a file
is fetched. These bind while you are reading what you fetched.

38. **A writing system can postdate the provenance cutoff, and that is a
   different trap from a modern edition.** quality/phonology/som.py reads the
   1972 Somali Latin orthography -- which is exactly why the cell was cheap --
   while the gate's cutoff is 1931. Any text old enough to clear provenance
   predates the script by 41 years; any text the module can read was written
   down in or after 1972. For an oral tradition that bind is unresolvable, and
   it is not the familiar old-text/new-edition problem. Related gap:
   provenance.py keys admission on the AUTHOR and models no edition or
   transcription layer with its own date and rights. Harmless for most corpora,
   load-bearing for oral ones.

39. **Record a failed source search as a row, not as a memory.** The gabay
   search is in data/sources.tsv with what was queried and what each channel
   returned, so the next attempt starts from the evidence instead of repeating
   it. A search that found nothing is a finding about the world.

40. **A licence on a compilation is not a licence on its contents, and the two
   layers separate cleanly.** chinese-poetry ships MIT; the Tang and Song verse
   inside it is a millennium out of any term. Read the outer layer for the
   collection and the inner layer for the work, and say which is which.

49. **Re-test the channel map before believing a NOT-FOUND row.** Two channels
   were discovered mid-round that no earlier search had used: plain `git clone`
   of any public GitHub repo works, and GUTENBERG IS MIRRORED ON GITHUB as the
   GITenberg org. The second directly overturned a NOT-FOUND row this project
   had already written and committed — the Finnish Kalevala, recorded as
   unreachable, fetched in one call and validated at 81.2% alliteration. A
   sourcing failure is a claim about the network at a moment, not about the
   world; date it and re-run it when the map changes.

51. **Corroboration across repositories can be a single file.** A GitHub-wide
   code search for the Hattatal text returned five hits in four repos, which
   looked like independent survival. They were three copies of ONE file --
   `cltk/non_texts` and `cltk/old_norse_texts_heimskringla` are byte-identical
   (md5 c221b3761633838018e24ccf4e43e7fd), and the fourth is a fork. Four
   sources, one edition, one editor's decisions, one rights status. Count
   DISTINCT BYTES, not distinct URLs, before calling a text corroborated.
   Doctrine 25 said agreement is not evidence; this is the corpus-level form of
   the same error, and it is harder to see because the URLs really are different.

52. **A perfect licence over a destroyed signal is still unusable, and the
   destruction is channel-specific.** The 1848 Arnamagnaean Hattatal clears the
   gate outright by publication year and by editor death. Its OCR contains ZERO
   occurrences of any of `th dh ae o-ogonek o-slash oe` and the accented vowels
   across 121 pages, and 3,474 Greek-block characters standing in their place:
   `jorth kann frelsa, fyrthum` prints as `jbrss kann frelsa, syrbum`. The
   corruption is CONSONANTAL -- which is precisely what a hending detector
   reads. Text that "looks readable" can be intact in every channel except the
   one under test. Check the specific channel, not the general legibility.

54. **A repo-root LICENSE is a claim about part of the repo.** `cltk/non_texts`
   ships `LICENSE_PERSEUS.md` (CC-BY-SA-3.0) at root covering only the Perseus
   fornaldarsogur, not the Snorra-Edda directory beside it; `sveinbjornt/
   sagadb.org` is BSD for the CODE while a separate README sentence affirms the
   TEXTS public domain; `OliverHellwig/sanskrit` is CC BY 4.0 except for the
   `corpus/GRETIL/` sibling, which is non-commercial. Three repos, three
   different scopes. Read what the licence says it covers, and record the path
   it covers in the row -- a licence name without a scope is not evidence.

80. **Provenance has TWO gates and the author is the cheap one.** 297 non-English
   lyricists are now staged and 284 clear the author gate trivially — a
   14th-century cywydd poet has been dead six centuries. Not one is SOURCED,
   because the binding constraint is the EDITION, and `provenance.py` keys
   admission on the AUTHOR and models no transcription layer with its own date
   and rights (doctrine 38). Doctrines 50/52/53 are the record of what an
   edition does to a text that passes every author check: a modernised
   orthography that destroys the constraint, an OCR that eats exactly the
   consonants under test, a vowel merger admissible for one predicate and
   biased toward the positive for the other. Somali shows both gates at once
   — 13 of 18 poets fail the DATE gate (lives recorded as "19th–20th century",
   whose upper bound has not expired) and the 5 who pass are still blocked by a
   script that postdates the cutoff by 41 years. A staged row says
   PENDING_TEXT, never SOURCED.

81. **Bound a vague life at the END of its window, and say in the row that you
   did.** "fl. c. 1340–1370", "15th century" and "medieval period" are not
   dates. Taking their midpoint is a guess that will be quoted back as a fact,
   so every such row is bounded at the latest year the author could have died
   and `pd_route` carries `d (century only; upper bound assumed)` rather than
   the `b (verified author death year)` that 221 English rows earned. 18 rows
   are on that footing and are visible as such by grep. The cost is paid in
   refusals — 13 Somali poets are refused on a bound they very probably clear —
   and that is the correct direction for a ledger that is evidence rather than
   an estimate.

87. **Doctrine 51's first NEGATIVE instance, and it is the more useful half.**
   Two editions of the same 500 花間集 songs — the 1893 四印齋 line and the
   網路展書讀 line — share only 91 of 369 matched poems character-for-character
   (24.7%) and disagree on the tune name in 22. The test is still DISTINCT
   BYTES; here the bytes genuinely differ, which is what let each witness
   correct the other: 卷第七's heading line is missing from one, and its 卷六
   contents list prints 和學士凝十三首 where the 1782 四庫 prints 二十首 — and
   13+13+18=44 contradicts the 卷 heading's own declared 51 two lines away,
   while 13+20+18 hits it exactly. Corroboration is worth having; **agreement
   was never the point, independence was.**

93. **"Sung in performance" is a claim about practice; the TEXT has to carry a
   mark of it.** Amaru, Bhartṛhari, Govardhana and every DCS stotra are
   reachable, CC BY 4.0, and centuries out of term — and the refrain detector
   fires ZERO on them at every setting, head and tail, against 24 on Jayadeva
   in the same run with the same rule. So they are recorded NOT_FOUND *for this
   property*, with the detector's floor printed beside the zero, rather than
   staged because the tradition says they were sung. Doctrine 32 says a corpus
   is defined by the property under test; this is the enforcement, and it is
   what stops "song corpus" quietly becoming "verse corpus by authors who had
   tunes". The same rule kept the count honest in the other direction: the
   Gītagovinda's 24 aṣṭapadī were recovered by ONE fixed unswept rule and came
   out at the canonical 24, and the looser variant of that rule (K=1) finds
   MORE and is worse — 2.38x lift against 2.87x (doctrine 61 again).

## Part E · Phonology, orthography, and what an edition does to a constraint

Read this part end to end before writing a new phonology module. Every item is
a trap that has already fired here, in a language somebody thought they
understood.

35. **Prominence is not always stress, and faking it is invisible in the
   numbers.** The time layer indexes on a stress grid because English is
   stress-timed. Somali has PITCH ACCENT and quantitative metre, so its grid is
   the mora and quality/phonology/som.py raises rather than returning a stress
   pattern. Middle Chinese has no stress at all; its binary is 平/仄, which is
   what the regulated-verse template actually constrains. A module that
   returned a plausible-looking stress pattern for either would have produced
   numbers nobody could have caught.

36. **A rime dictionary is finer than any poet worked to.** The Qieyun
   distinguishes 193 rhymes; Tang practice authorised 同用 groupings and 平水韻
   collapsed them to ~106. Raw lookup makes 流 (尤) and 樓 (侯) non-rhyming, and
   they are the rhyme of 登鸛雀樓. The lesson generalises past Chinese: the
   granularity a REFERENCE WORK records is not the granularity a FORM works at,
   and using the former because it is the one that ships is a silent error.

43. **A checker can implement a tradition's rules and never have read that
   tradition's language.** lyric_harness.check_cynghanedd builds its consonant
   skeleton with word_syllable_map -- CMUdict -- so it has always tested the
   cynghanedd RULE SHAPE against English phonology. That is a real
   contribution and it is not cynghanedd on Welsh, and nothing in the code
   said so. Before crediting a checker with a tradition, look at which
   language its phonology comes from.

50. **An orthographic layer can silently destroy the very constraint a cell
   measures.** Modernised Icelandic inserts epenthetic -ur (Laetr -> Laetur),
   breaking the six-syllable drottkvaett line so hending POSITIONS become
   unrecoverable; Irish text_standard normalises spelling and destroys the
   orthographic rhymes; Somali's whole 1972 script postdates its own copyright
   cutoff. Three traditions, three different ways for a transcription to look
   fine and be unusable. Ask what the ORTHOGRAPHY does to the constraint before
   accepting any text.

55. **Punctuation is not metre.** `cynghanedd()` split the line on `[,/|]`, so
   a printed COMMA was read as a caesura. The damage was not that it found the
   caesura in the wrong place; it was that ordinary editorial punctuation
   silently chose WHICH RULE each line was tested against -- a line with two
   commas was forced down the three-part `sain` path and could not be read as
   croes at all, and a line with none was refused outright. On a real corpus
   that is 1,558 lines whose test was selected by a typesetter. Before treating
   a mark as structure, ask whether it is evidence of the form or an artifact
   of the edition. The caesura is now either PRINTED (`/`, `|`, or the gwant
   `--`) or explicitly SEARCHED, and the caller has to say which.

65. **The same mark means opposite things in two languages, and both are
   right.** In Welsh the apostrophe is an elision mark and JOINS; in Finnish it
   blocks a vowel merger and SPLITS. In Welsh the hyphen joins a compound into
   one phonological word; in Finnish it marks a compound seam that BLOCKS
   RESYLLABIFICATION, so `ian-ikuinen` is ian + ikuinen and deleting the hyphen
   -- the correct Welsh rule -- moves a consonant across the boundary and gets
   the syllabification wrong. Both languages had the mark treated as
   out-of-inventory at some point, which returned [] and dropped the word from
   every class silently. Never port a punctuation rule between modules; derive
   it from what the mark does in THAT language.
   **Four languages, four rules for ONE glyph, none portable:** Finnish SPLITS
   on the apostrophe (it blocks a vowel merger), Welsh JOINS on it (elision),
   Old Norse FUSES it (`sá 's` is `sás`, ONE token -- this file said "expands
   to two" for a day and the corpus overruled it: dróttkvætt lines are six
   syllables, and fusion gives exactly six on 9 of 9 readable enclitic lines
   while expansion gives seven every time), and Malay reads it as A PHONEME --
   word-final `'` is hamzah /ʔ/, a real coda that ENTERS THE RIME, so `pinta'`
   rhymes `minta'` and not `pintar`. In Malay it is even two marks wearing one
   glyph, split positionally: coda when final or after a vowel, apheresis when
   word-initial (`'ku` < aku), a word break when medial after a consonant.
   The hyphen forked the same way -- Welsh joins, Finnish and Malay treat it as
   a seam that blocks resyllabification.

70. **Modernising an orthography can move it FURTHER from the sound the form
   constrains.** The reflex is to normalise 1900 Straits Rumi to modern Ejaan
   Rumi Baharu and work in the standard spelling. It is the wrong way round.
   Malay /u/ and /i/ LOWER to [o] and [e] in a final closed syllable, so the
   1900 spelling writes the SURFACE form (`burong`, `jatoh`, `adek`) and the
   modern standard restored the UNDERLYING phoneme (`burung`, `jatuh`, `adik`).
   Rhyme is a fact about surface sound, so the older spelling is the better
   guide and modernising would have destroyed the constraint being measured.
   The corpus confirms the orthography is internally consistent: word-final
   `-ung` occurs 0 times and `-uk` 0 times, against **38 `-ong` tokens in
   26 types and 28 `-ok` tokens in 15 types**, on the tokenisation stated
   in the amendment at the foot of this item.
   Doctrine 50 said ask what the orthography does to the
   constraint; this says the NEWER orthography is not automatically the safer
   one, and "normalise to the standard" is a modelling choice, not hygiene.
   The cost is declared rather than hidden: `-ong` now writes both /oŋ/ and
   /uŋ/, so where that merger lands inside a rime `rhymes()` returns None.
   **AMENDED 2026-08-11 — THE COMPARISON FIGURE IS WITHDRAWN AND THE ZEROS ARE
   NOT.** This item read "against 14 and 12 distinct `-ong` and `-ok` types."
   and that reproduces nowhere: this file said 14/12 types, `MISSING.md` M-3
   said 28 types and 14/15, the corpus file's own header says 25/24 tokens, and
   none of the three is what you get by counting. The ZEROS are what the
   argument rests on and they reproduce exactly, so the doctrine survives and
   its evidentiary number does not. Measured: over the 513 verse lines of
   `corpus/song/msa_skeat_pantun.txt`, tokens taken as maximal runs of
   `[A-Za-z'’-]` and lowercased with the `#` header and the `---`/`[` markers
   excluded, `-ong` is 38 tokens in 26 types, `-ok` is 28 tokens in 15 types,
   `-ung` and `-uk` are 0. The disagreement was never about the text: re-cut
   the same lines with LETTERS ONLY, apostrophe and hyphen read as breaks, and
   `-ong` is 41 tokens in 28 types and `-ok` 30 tokens in 14 types — which is
   exactly where M-3's "28" and "14/15" came from. Three documents, one
   measurement, and the coordinate nobody wrote down was the TOKENISATION.
   That is doctrine 58 turned on the doctrine file, and it is why a figure
   cited as evidence for a doctrine now has to name the rule that produced it.
   (`quality/audit_register.py --only "M-3 / doctrine 70"`, and
   `quality/RESULTS_REGISTER_AUDIT.md` §0, which found it.)

82. **A span that belongs to ONE class was applied to all four, and it under-read
   the line in both directions.** Welsh `skeleton()` stopped at the onset of the
   half-line's last accented syllable — which is the *cytbwys acennog* rule, and
   only that rule. For **croes** a short span is too permissive; for **traws**,
   which is a suffix test, dropping the post-accent consonant breaks the suffix
   and the line is MISSED. Alun's attested `Trwy Gwalia | tir y gelyn` compared
   `[t,r,g,l]` against `[t,r,g]` and found nothing. The terminus is a property of
   the DIWEDDEB — the half's final vowel in the balanced classes, its final
   consonant in the accented half of an *anghytbwys ddisgynedig* — so `extent`
   now has NO DEFAULT and an absent argument raises. 113 Alun lines gained, and
   **zero of them are cytbwys acennog**, exactly as the mechanism predicts.
   The reading was chosen by doctrine 61, not argued: gap to the shuffled null
   max goes +26.3 -> +35.3 on Alun and +14.7 -> +19.2 on Twm o'r Nant, and Twm
   is the row to read because the rule fires **5.1 points LESS often** and is
   still better, since its null falls 9.6. Yield is not evidence. `anghytbwys
   ddyrchafedig` is REFUSED by default — its apparent croes lift is duplicate
   placements created by consonant-free proclitics sliding across the seam —
   and `dyrchafedig="rising"` reaches the other reading so the choice stays
   measurable rather than settled by fiat.

83. **A locator is per-MEMBER, and suffix alignment was the function rather than
   a parameter of it.** `classify_pair` computed `sa[-n:]` against `sb[-n:]`,
   so `position='head'` set a FIELD on the result and never touched the span:
   `kukka`/`kalevala` compared `kuk`~`va`, `ka`~`la`, returned False, and was
   labelled **"perfect rhyme"** — a false negative on the relation and a
   false-positive label in one call, while `fin.alliterates` said True. ANCHOR is
   now axis 8, an `Anchor(rule, determinacy, span, index, side)` **per member**
   inside `key()`: 14 rules x 3 determinacies, declared independently on each
   side. That it must be per-member is measured, not asserted — cynghanedd lusg
   is recovered on **104/104** Alun lines with side A searched-prominent and
   side B rule-fixed, and on **0/104** with the same anchor on both sides; on
   559 croes/traws lines side B's origin is at its head on 184/184 croes and
   0/375 traws, so no single global alignment covers the pair. The rules are
   written on PROMINENCE, never "stress", because in `san` prominence is
   guru/laghu and in `ltc` it is tone class (doctrine 35). Consequence worth
   keeping: `length='apocopated'` was a value nothing could ever compute, and
   perfect/syllabic/apocopated now separate on nothing but the two anchors.

86. **Doctrine 50 finally has a POSITIVE instance, and it inverts the reflex.**
   Every previous case was an orthographic layer DESTROYING a constraint. Here a
   20th-century editor's punctuation *supplies* one: 。 at line ends carries
   45.2% rhyme agreement against 2.7% at ，, on a matched null of 2.8% that the
   ，-ends land exactly on. Song ci circulated unpunctuated, so every line
   boundary a rhyme detector reads in a modern ci edition is an editorial act.
   The rule is not "modern layers are dangerous" — it is **name the layer and
   measure what it does to the channel under test**, because sometimes it IS the
   channel, which makes it more load-bearing rather than less. And doctrine 70's
   converse is wrong too: reaching for the older witness fails here, since the
   1782 四庫 manuscript reads at 94.77% against a modern transcription's 98.05%
   and the Siku scribes have their own variant set. When the reference work is
   keyed on a third norm, NEITHER end of the age range is safe and the fix is a
   normalisation layer, not a choice of witness.

## Part F · Instruments, engineering, and running cells in parallel

Craft. Cheap to follow, and each one is written down because ignoring it cost
a round.

26. **Normalize U+2019 anywhere a word is extracted from text.** `endword()`
   in the matrix fitter did not, so `prepar’d` split and the bare letter "d"
   became an end word 75 times; 9.2% of the training pairs were corrupted, and
   two of the eight registered predictions flipped verdict once it was fixed.
   `word_syllable_map` had always normalized it — the defect was a new function
   not inheriting an old lesson. Found by reading which pairs had the LOWEST
   coda agreement and seeing `d/held` in the list, i.e. by looking at the tail
   of a distribution rather than its summary.

66. **A tie broken by iterating a set is a result that does not reproduce.**
   `max(set(seen), key=seen.count)` picked a different alliterating sound under
   different PYTHONHASHSEED values. The COUNT was stable, so no rate this
   project reported was affected -- but a tally of which sound carries the
   alliteration would silently differ between runs, and nothing would have
   said so. Any tie-break is arbitrary; it has to be FIXED and stated.

77. **Parallel cells share a scratchpad, so working files must be namespaced.**
   The British sourcing cell lost ~30 fetches mid-run because a sibling
   overwrote its `fetch.sh` and clobbered `scratchpad/raw/`. Only the uniquely
   named DELIVERABLES were safe. Every brief in that round told cells where to
   write their outputs and said nothing about their intermediates, which is an
   orchestration defect, not a cell's mistake. Give each cell its own
   subdirectory and say so in the brief.

78. **A parallel round needs one shared channel-map, updated as it runs.**
   Six cells independently rediscovered that gutenberg.org is blocked, and
   between them found ELEVEN further blocked hosts -- wikisource, wikipedia,
   archive.org, hathitrust, gutendex, ccel, hymnary, the Bodleian broadsides,
   gsarchive, codeload, jsdelivr -- plus two working channels nobody had:
   `WebFetch` on the GITenberg org HTML search page (no rate limit, unlike
   `search_repositories`, which throttles after ~8 calls), and `thabz/Kalliope`.
   That is six times the same probing. The map belongs in one file the cells
   read and append to.

95. **The alignment defect was in the SHIPPED comparator, not only the
   taxonomy, and equal-length examples hid it.** `channel_agreement` compared
   `anc_a[i]` with `anc_b[i]` — flush LEFT — from the first commit, while rhyme
   aligns flush RIGHT. On the 152 sonnets 67.8% of candidate anchor-span pairs
   are unequal length and the two alignments disagree on **79.9%** of those.
   The sonnet oracle never moved, because a mandated pair's best alignment is
   already the equal-length one — so the corpus that was supposed to catch
   everything was structurally incapable of catching this. Doctrine 83 found
   the identical error in `rhyme_types.classify_pair` and nobody thought to
   check whether the shipped comparator had it too. When a defect is found in
   one layer, grep the others for the same shape before closing it.

<!-- /DOCTRINE-BLOCK -->

---

## § Time layer — the standing record behind doctrine 4

**Not a doctrine definition.** Doctrine 4 is defined in `CLAUDE.md`, where the
four layers are named and the time layer is described as built, powered, null,
and still without a beat grid. What follows is the evidentiary narrative that
item carried inside a parenthesis — the largest single block of auditing that
was sitting in the first forty lines of the file a session reads before it
writes. Moved whole and dedented; not one word of it has changed.

THE FALSE-EVENT RATE IS NOT CONTROLLED AT
ALPHA: "5.4% against a declared 5.0%" reproduces to the digit and is
an n=6 figure. Run the identical construction at n=20 and it is
9.6%, ~2x alpha (verified here; quality/NULL_AUDIT.md,
quality/audit_fwer_fpr.py). test_fwer.py guards it with THREE
sonnets asserting only `mean < 0.20`, which cannot detect a 2x miss.
Worse, the comparison nobody ran: real sonnets score 10.9% against
their own word-scramble at 9.6% (null max 11.0%, p=0.095) and their
own line-permutation at 10.8% (null max 12.6%, p=0.476) -- so the
event rate on real sonnets does not separate from text with the
structure removed. Either the detector is broken or these sonnets
carry no internal rhyme, and THIS EVENT SET CANNOT TELL THEM APART;
until it can, a null placement result here cannot distinguish "no
periodic organisation" from "nothing to organise". Statistic VALIDATED against a planted signal (power
1.00 at ceiling, 0.05 at chance) -- but UNDERPOWERED at real item
sizes: 8 events needs ~75% of rhymes on one phase to reach 0.80
power. Sonnet arm null with pooled power (Fisher p=0.950, k=23) --
BUT THAT p IS NOT CALIBRATED (verified here). Under 200 H0
replicates at the real item sizes the per-item p has median 0.559,
not 0.500, and pooled Fisher reaches >=0.950 in 8.5% of H0 arms
rather than 5%. So 0.950 is ~1-in-12, not 1-in-20. The cause is
structural: rhymes arrive in PAIRS inside a window while analyse()
draws independent positions, so real events are more phase-spread
than the null assumes. This repo already contained the proof -- arm
C2 is an empirical H0 arm returning Fisher p=1 -- and nobody had put
the two side by side. The null CONCLUSION survives; the p attached
to it does not.

---

## § The sonnet battery, and what its numbers mean

Moved from `CLAUDE.md`'s test-discipline section for the same reason. The
command, the current figures, the three counts and the triage rule stay there;
this is the record of how those figures were wrong and what fixed them.
Doctrines 71 and 79 are the generalisations, and doctrine 58 is the one this
file caught itself breaking. Dedented, otherwise unchanged — which means the
deictics still point at the list they were written beside, so "the triage
discipline three lines below this one" is now `CLAUDE.md` § Test discipline.

This line said 7.2% for a day after the calibration shipped, which is
doctrine 58's own disease inside the doctrine file, found by the mutation
runner.

**THE OLD FIGURES 11.6% AND 8.0% WERE 123/1064 AND 85/1064 AND BOTH
DENOMINATORS AND NUMERATORS WERE WRONG IN THE SAME WAY.** 50 of the
1064 mandated pairs are REFUSALS — the end word is absent from
CMUdict, so the harness could not read the line and said so
(viewest/renewest, gazeth/amazeth, receivest/deceivest). Counting a
refusal as a rhyme failure charged the COMPARATOR for the INGESTION
layer's misses, which is the triage discipline three lines below this
one, violated in the headline number. 123-50=73 and 85-50=35, so no
count changed: what changed is that the harness now says which
question it declined to answer. The band's effect is unchanged in
direction and LARGER in size than the record claimed — it more than
DOUBLES the violation rate (3.5% -> 7.2%), where 8.0% -> 11.6% read
as a 45% rise. A rate whose denominator silently includes the cases
the instrument refused is not a rate.

**THAT DROP IS OVERTURNED AS EVIDENCE (quality/NULL_AUDIT.md, verified
independently).** Permute Whitman's LINES within the item -- every
line verbatim, every end word, same theta, same band, same
comparator, only the order destroyed -- and the null spans
6.7%-27.3%. Both recorded figures sit inside it: 26.0% gives
p=0.0547, 20.0% gives p=0.2090. The band lowers the observation 6.0
points and the null MEDIAN 2.7, so the separation moves only
+6.7 -> +3.3 pp from a baseline that never separated. A filter that
lowers chance and signal together has not tightened anything. So the
sentence that used to end this line -- "which is why it ships and the
fitted matrix does not" -- was never supported, and it is withdrawn.
THE BAND STILL SHIPS, on the argument in doctrine 3/24 that it
RELABELS rather than rejects, which is a claim about the taxonomy and
needs no negative control. What is gone is the empirical warrant.
The instrument is fine: the SAME statistic under the SAME null gives
sonnets 52.0% vs a null max of 34.2%, +17.9 pp with p at the floor.
It is the Whitman COMPARISON that was uninformative, not the harness.

REPINNED 2026-08-13, and every conclusion in the paragraph above
SURVIVES the repin -- which is worth saying, because it did not
survive the 2026-08-11 one. Under the shipped comparator the Whitman
arm reads 26.0% -> 10.7% with null medians 19.3% -> 5.3%, so the
separation moves +6.7 -> +5.3 pp (p 0.0547 -> 0.0199 at n=200), and
the sentence "a filter that lowers chance and signal together has not
tightened anything" is true again on this text: the observation falls
15.3 points and the null median 14.0. The 20.0%/p=0.2090 pair is the
pre-`b1d7f64` comparator's; the intervening 17.3%/+9.3/p=0.006
reading, which briefly made the separation FLIP SIGN, does not
reproduce either. The sonnet arm re-run at full n=200 gives band OFF
53.5% against a null median 29.9% and max 35.6% -- so +23.6 pp over
the median and **+17.9 pp over the MAX, reproducing to the decimal**
-- with p at the 0.0050 floor, and band ON 48.9% moving the
median-excess to +26.4 pp. The `52.0%` above is superseded by 48.9%.
Note that this paragraph's +17.9 is an excess over the null MAX while
its +6.7/+3.3 are excesses over the null MEDIAN; a MAX grows with n
and is not comparable across sample sizes (doctrine 57's mirror).

### verse.txt, deleted 2026-08-10

verse.txt DELETED 2026-08-10: it was an in-copyright rap
transcription that predated the provenance gate and was never
declared in data/sources.tsv or run through it, yet the time layer's
entire rap arm (n=1) rested on it. No rap corpus can EVER be admitted
under a 95-year term -- the cutoff is 1931 and the genre starts 1979.
