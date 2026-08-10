# Lyric Harness

Declaration-driven rhyme, meter, and song-structure engine. The model
proposes; these tools grade. Target: MCP server beside Codex Musica —
Codex Musica describes the recording, this disciplines the words.

## Core doctrine (do not drift from these)
1. **Declaration tuple.** Every analysis states its assumptions:
   dialect (CMUdict General American), anchor rule, channel weights,
   thresholds. All in the `Declaration` dataclass. Disagreements are
   located in a coordinate of the tuple, never argued at large.
2. **Graph first.** The full pairwise score matrix is the primary
   object (`rhyme_graph`). Letter schemes, chains, blueprints are lossy
   projections. Maximal cliques may OVERLAP = structures with no letter
   representation (chained slant). Never rebuild a projection-first
   architecture.
3. **Band-pass, TYPED.** Identity is not rhyme. Relations: RHYME
   (graded), REPEAT (same word), RIME_RICHE (same sound, different
   word), ASSONANCE (nucleus agrees, coda does not), CONSONANCE (coda
   agrees, nucleus does not). The band inverts by context: REPEAT is a
   violation inside a verse, the requirement across chorus instances,
   licensed as radif/refrain. The conjunctive coda rule RELABELS, never
   rejects — `sun`/`much` is assonance, not a non-relation — because a
   rule that closed the leak by deleting assonance from the taxonomy
   would be a worse defect than the leak. See RESULTS_BAND.md.
4. **Four layers.** Signal (phoneme channels: nucleus/coda/onset/stress,
   scored separately). Time (BUILT and POWERED, and it found nothing:
   quality/time_layer.py, RESULTS_TIME.md, RESULTS_FWER.md. Placement of
   rhyme against a metric period, phase-invariant and self-normalizing,
   with family-wise error control across each position's ~15-comparison
   family. Saturation 6-16%, false-event rate measured at 5.4% against a
   declared 5.0%. No arm survives BH on either grid.
   Still no beat grid — there is no audio, so isochrony is an assumed
   coordinate, not a measurement, and "on the beat" is not a claim this
   project can make). 
   Perception (theta is a function: per-genre theta_chain, promotion
   licensed only by declared meter). Value (cliche pairs, shared-suffix
   stem check, REPEAT flags; doggerel = value failure, not rhyme type).
5. **Weights are `fitted: false`.** Hand-set, and they stay that way:
   the Hirjee-Brown path has now been walked (quality/fit_matrix.py)
   and its answer is that it buys nothing. Do not tune by single
   examples — accumulate, then fit — and if the fit does not beat the
   hand-set weights held-out, do not ship it because it is fancier.

## Commands (python3 lyric_harness.py ...)
declaration | score A -- B | candidates W [n] | meter TEMPLATE L... |
scheme LETTERS [--profile assonance|rawi] L... | song blueprint.json
lyric.txt | chains FILE [theta] | graph FILE [theta] | internal "line" |
density FILE | weight "line" | qafiya FILE|L... | cynghanedd "line" |
prasa K L... | demo

## Test discipline
- `python3 battery.py` — sonnet oracle (152 sonnets, ABABCDCDEFEFGG),
  Lear limerick known-answers, Whitman negative control.
- Current baselines, WITH the conjunctive band: sonnets 11.6%
  violations (123/1064, up from 8.0% pre-band — the rise is the typed
  residue: love/prove and its class are CONSONANCE in the declared
  General American dialect, which is correct and now named). Whitman
  20.0% chained at theta 0.82, down from 26.0%: the band tightened the
  negative control, which is why it ships and the fitted matrix does
  not. Rap chains (verse.txt) stable at theta 0.75.
- Triage every failure to a layer: ingestion / projection / anchor /
  comparator / band / structure / value. Fix only when a category
  accumulates. Every fixed case becomes a permanent regression.
- Real exemplars over constructed tests. Constructed tests encode the
  author's assumptions; canon corrects the checker (7 rule errors
  found this way: strict groes final-consonant rule, sain any-stressed
  link, radif licensing, hyphen splitting x2, collision bar, mosaic
  anchor reach, prefix phrase-final seam).

## Known gaps, priority order
1. **G2P for OOV.** CMUdict lacks hypotenuse, shiesty, coinages.
   Canary test: score "lot o' news" -- "hypotenuse" (currently
   NO_ANCHOR). Fix: g2p-en or equivalent as transcribe fallback.
2. **Fitted substitution matrix — BUILT, and it does not help.**
   quality/fit_matrix.py, RESULTS_MATRIX.md. The floor IS removed: the
   free 0.15 stress gift became -0.107 bits, and empty/empty coda went
   from 1.0 to -0.000. But held-out separation is unchanged (0.9031 vs
   0.9043) and the Whitman negative control got worse (35.3% vs 18.7%
   at matched FPR), so the floor was not costing accuracy. NOT the
   default; Declaration.fitted stays False and a test enforces it.
   Remaining: sun/much needs a CONJUNCTIVE band rule, not a comparator
   -- its nucleus is identical, so it was never a floor case.
3. **Time layer.** Placement half built, POWERED and null. The blocker
   was never the comparator: it was multiplicity, and family-wise error
   control fixed it (RESULTS_FWER.md). The beat grid still does not
   exist and cannot until audio or a declared tempo enters. Next is a
   second rap corpus -- n=1 -- not a fourth instrument.
4. **Cross-line internal walk.** internal_matches supports two lines;
   no verse-wide positional graph yet.
5. **Assonance corpus.** Moncrieff Song of Roland (1919, PD) pending
   verification that translation preserves laisse assonance.
6. **Non-English phonology.** Welsh (real cynghanedd), Indic (prasa),
   Old Norse (hendings) all blocked on transcription.
7. **Blueprint identity-with-variation.** Outro-extends-intro,
   chorus variation. Current refs are verbatim-only.

## MCP wrap plan
Tools: transcribe, score, candidates, check_scheme, check_meter,
check_song, infer_chains, rhyme_graph, internal, density, qafiya,
cynghanedd, weight. Loop: spec -> draft -> check -> revise flagged
lines only -> re-check. Model never self-certifies.

## House rules
Never abbreviate project names: Codex Musica, Pantheon Registry,
Deus ex Homine, Chocolate Secrets. No artist/producer names as
descriptors in any generation-facing output — era+region+technique.

## Quality layer (quality/)
Separate from the correctness engine above and deliberately so: the harness
grades whether a rhyme is *correct*, this grades whether the writing is any
good. Ten pre-registered features (quality/PREREGISTRATION.md), a
discrimination test (quality/discriminate.py), results in quality/RESULTS.md.

Doctrine additions, earned from the first run — do not drift from these either:
6. **No weighted quality score, ever.** The features stay a vector. The
   exchange rate between surprise and clarity is not derivable; it is a
   genre's answer, so it belongs in a declaration, not in a constant.
7. **Rejection, not selection.** Detecting bad writing held-out at AUC 0.971;
   ranking good writing at 0.709. Enforce a floor, do not order the permitted
   region.
8. **Never fit on one tradition.** Five of ten features INVERT between the
   two experiments. A single corpus does not give a narrow answer, it gives a
   confidently wrong one; Experiment 2 alone would have recommended optimizing
   toward archaic pastiche. Cross-tradition replication is the error bar.
9. **Optimizing toward the phonetic maximum is the slop direction.** Handing a
   model "L2-L4 below theta" makes it reach for the highest-scoring rhyme,
   which is the most predictable one. A revision protocol must push away from
   the optimum: pass the band, but not by taking the modal candidate.
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
24. **When a rule would delete a category, make it RELABEL instead.** The
   conjunctive coda rule exists because `sun`/`much` has an identical nucleus
   and no comparator can stop a strong channel buying a weak one. Written as
   "rhyme requires the coda to match" it would have deleted assonance,
   consonance, oblique and slant rhyme from a harness built to represent them.
   Written as a type — nucleus-only is ASSONANCE, coda-only is CONSONANCE —
   it closes the leak and the vocabulary grows from three names to five. The
   test of such a rule is whether the harness can say MORE afterwards.
25. **Agreement is not evidence, and one channel can need both predicates.**
   The fitted matrix scored two ABSENT codas at 0.000 bits, correctly: they
   carry no evidence. The band asks whether they AGREE, and they do — `see`/
   `free` is a perfect rhyme. A quarter of the sonnets' mandated pairs have two
   empty codas, so conflating the predicates would have deleted them all while
   the case that motivated the change still looked fixed. Registered as the
   tripwire and checked first.
26. **Normalize U+2019 anywhere a word is extracted from text.** `endword()`
   in the matrix fitter did not, so `prepar’d` split and the bare letter "d"
   became an end word 75 times; 9.2% of the training pairs were corrupted, and
   two of the eight registered predictions flipped verdict once it was fixed.
   `word_syllable_map` had always normalized it — the defect was a new function
   not inheriting an old lesson. Found by reading which pairs had the LOWEST
   coda agreement and seeing `d/held` in the list, i.e. by looking at the tail
   of a distribution rather than its summary.
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
29. **BH and FWER have different resolution requirements, and BH's is brutal.**
   Benjamini-Hochberg's cut for the top-ranked p is q/n; at n ~ 10^4 candidate
   pairs that needs a tail resolved to ~1e-5, and a 20000-draw null resolves to
   5e-5. Whether anything is discovered then depends on how many p-values pile
   up on the resolution floor — measured, 63% saturation on one sonnet and 0%
   on the next three. FWER's cut is alpha/m with m ~ 15 and needs no such tail.
   Check that a correction can resolve its own threshold before using it.
30. **A powered null is a different claim from an unpowered one.** Every time-
   layer null before the correction was uninterpretable: at 87-97% saturation,
   "found nothing" and "could not have found anything" were the same output.
   Do not report the first as if it were the second, and do not let a
   correction that finally delivers power get filed as a refactor — it changes
   what the negative result means.
