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
   declared 5.0%. Statistic VALIDATED against a planted signal (power
   1.00 at ceiling, 0.05 at chance) -- but UNDERPOWERED at real item
   sizes: 8 events needs ~75% of rhymes on one phase to reach 0.80
   power. Sonnet arm null with pooled power (Fisher p=0.950, k=23).
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
density FILE | weight "line" | qafiya FILE|L... |
cynghanedd [--lang=cym|eng] "line" | prasa K L... | demo

## Test discipline
- `python3 battery.py` — sonnet oracle (152 sonnets, ABABCDCDEFEFGG),
  Lear limerick known-answers, Whitman negative control.
- Current baselines, WITH the conjunctive band: sonnets 11.6%
  violations (123/1064, up from 8.0% pre-band — the rise is the typed
  residue: love/prove and its class are CONSONANCE in the declared
  General American dialect, which is correct and now named). Whitman
  20.0% chained at theta 0.82, down from 26.0%: the band tightened the
  negative control, which is why it ships and the fitted matrix does
  not. verse.txt DELETED 2026-08-10: it was an in-copyright rap
  transcription that predated the provenance gate and was never
  declared in data/sources.tsv or run through it, yet the time layer's
  entire rap arm (n=1) rested on it. No rap corpus can EVER be admitted
  under a 95-year term -- the cutoff is 1931 and the genre starts 1979.
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
   free 0.15 stress gift became -0.0999 bits, and empty/empty coda went
   from 1.0 to -0.000. Held-out separation gains +0.003 (0.9177 vs
   0.9146) -- real in sign, inside anyone's noise -- and the Whitman
   negative control still got worse (21.3% vs 18.0% at matched FPR).
   NOT the default; Declaration.fitted stays False and a test enforces
   it. (Both figures here are the CLEAN ones; the first run was fitted
   on 9.2% corrupted end words.)
   Remaining: sun/much needs a CONJUNCTIVE band rule, not a comparator
   -- its nucleus is identical, so it was never a floor case.
3. **Time layer.** Placement half built, POWERED and null. The blocker
   was never the comparator: it was multiplicity, and family-wise error
   control fixed it (RESULTS_FWER.md). The beat grid still does not
   exist and cannot until audio or a declared tempo enters. NOT a
   second rap corpus -- that was doctrine 8 broken twice (single
   source, single language) and no rap is admissible anyway. The
   binding constraint is EVENTS PER ITEM: 8 events needs ~75% of an
   item's rhymes on one phase to reach 0.80 power, so a cell needs ~40
   events or pooling to reach it. See POSITIVE_CONTROL.md.
4. **Cross-line internal walk.** internal_matches supports two lines;
   no verse-wide positional graph yet.
5. **Assonance corpus.** Moncrieff Song of Roland (1919, PD) pending
   verification that translation preserves laisse assonance.
6. **Non-English phonology.** FOUR CELLS UNBLOCKED (quality/phonology/):
   fin, som, ltc — cheap for three DIFFERENT reasons, so three
   implementations rather than one G2P with three tables. Finnish: a
   near-phonemic orthography, regular syllabification, stress fixed on
   syllable 1 (rules only, nothing to licence). Somali: phonemic 1972
   Latin script, (C)V(V)(C), and it REFUSES a stress grid — pitch
   accent, not stress, so grid_unit is the mora. Middle Chinese: not
   G2P at all but a lookup, data/qieyun_mc.tsv (CC0), 19,499 chars,
   plus the 平水韻 同用 grouping without which 流/樓 do not rhyme.
   Welsh: near-phonemic, and its EIGHT DIGRAPHS (ch dd ff ng ll ph rh
   th) are single consonants -- split them and every consonant
   skeleton in the language is wrong while still looking plausible.
   cym implements croes/traws/sain/llusg on Welsh units, with a
   PROCLITIC list (y, a, i, o, yn, ar, fy, ei ...) because penultimate
   stress otherwise makes every monosyllable stressed and llusg then
   "answers" on the definite article. FIXED: check_cynghanedd now takes
   `language` and DEFAULTS TO WELSH; `--lang=eng` keeps the original
   CMUdict path for English imitation (Hopkins wrote it) and labels
   itself an imitation. Every result declares its phonology. It had
   built its skeleton from CMUdict since the first commit, so the seven
   recorded rule errors are findings about the RULES, never about Welsh.
   PHONOLOGY still blocked: Indic (prasa), Old Norse (hendings).
   TEXT blocked for Welsh: see SEARCH:welsh-cynghanedd-corpus in
   data/sources.tsv. The capability is built; the corpus is not
   reachable.
7. **Blueprint identity-with-variation.** Outro-extends-intro,
   chorus variation. Current refs are verbatim-only.

## MCP wrap plan
Tools: transcribe, score, candidates, check_scheme, check_meter,
check_song, infer_chains, rhyme_graph, internal, density, qafiya,
cynghanedd, weight. Loop: spec -> draft -> check -> revise flagged
lines only -> re-check. Model never self-certifies.

**THE LOOP IS BUILT: quality/revise.py, tests in test_revise.py.**
`Reviser.brief(lines, scheme)` returns line-scoped instructions;
`Reviser.verify(before, after, scheme, targeted=...)` returns a verdict.
It NEVER generates text — the model proposes, this grades. Four
rejections are enforced and each is a silent failure mode:
  - a revision that fixes the flagged line and breaks another
  - a revision that takes the MODAL candidate (doctrine 9, below)
  - a revision that touches lines nobody targeted
  - a revision that restructures rather than revises
Doctrine 9 is the load-bearing one and it is now mechanical: a flagged
rhyme gets its candidate field with the MOST FREQUENT band-passing
members marked FORBIDDEN, and verify() rejects a revision that lands on
one. Passing the band by reaching for fire/desire is the slop direction,
so a loop that recommended it would manufacture what the floor rejects.
`modal_exclusion=0` disables the rule and is reachable so the defect is
demonstrable; it is not the default.

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
31. **Run the positive control before believing any null.** The time layer
   produced nulls across three instrument versions before anyone asked whether
   its statistic could detect a signal it was pointed at. It can — power 1.00
   on a planted signal, 0.05 at chance — but at the 5-8 events a real item
   carries it needs ~75% of an item's rhymes on one phase to see anything.
   Every earlier null was evidence about sample size, not about verse. A
   synthetic planted-signal control is cheap, language-agnostic and needs no
   corpus, so there was never an excuse for it coming fourth.
32. **A corpus is defined by the property under test, not by a genre or a
   language.** The replacement for the deleted rap arm is "forms in which
   sound-repetition is constrained to fixed metrical positions", which spans
   nine language families (quality/POSITIVE_CONTROL.md). Proposing "a second
   rap corpus", and then one tradition swapped for another, was doctrine 8
   broken twice over: single source AND single language. No tradition
   conceptualizes the property the same way, which is the reason to take many
   rather than a reason to pick one.
33. **Correcting across items is not combining evidence across them.**
   Benjamini-Hochberg answers "which items are discoveries"; it never asks
   whether the arm as a whole shows the effect. Fisher's method does, and is
   legitimate here because each item's KL is phase-invariant so the p-values
   are comparable even when the phases are not. The aggregate question had gone
   unasked for the whole life of the layer.
34. **Every corpus file must have a row in data/sources.tsv, including the
   local ones.** verse.txt sat in the repo from the first import, was never
   declared, was never run through the provenance gate it would have failed,
   and carried an entire experimental arm. Fixtures, generated text and
   PD downloads all now carry rows -- a file with no row is the defect.
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
37. **Test a phonology against its tradition, not against its own rules.** A
   syllabifier that satisfies only its author is untested. Kalevala lines that
   are known to alliterate must alliterate; canonical regulated verse that is
   known to rhyme must rhyme. That check is what caught the Finnish hiatus
   apostrophe: `saa'ani` was unreadable, so a line that alliterates reported
   that it did not.
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
43. **A checker can implement a tradition's rules and never have read that
   tradition's language.** lyric_harness.check_cynghanedd builds its consonant
   skeleton with word_syllable_map -- CMUdict -- so it has always tested the
   cynghanedd RULE SHAPE against English phonology. That is a real
   contribution and it is not cynghanedd on Welsh, and nothing in the code
   said so. Before crediting a checker with a tradition, look at which
   language its phonology comes from.
44. **The blocker is not always difficulty.** Welsh was listed as blocked on
   transcription from the first commit; it turned out to be as cheap as
   Finnish once someone looked -- near-phonemic, eight digraphs, penultimate
   stress, an afternoon. What is actually blocked is the TEXT. Separate
   "hard to build" from "cannot obtain" in every gap entry, because the two
   have completely different remedies.
45. **Give a form's checker the language of the form, and make the language a
   coordinate.** check_cynghanedd now defaults to `cym` because cynghanedd is
   Welsh; `--lang=eng` keeps the CMUdict path for English imitation and says
   in its own output that it IS an imitation. Every result declares which
   phonology produced it. A checker that silently picks a phonology is making
   a claim it never states.
46. **A function-word list is part of a phonology, not an optimisation.**
   Welsh penultimate stress makes every monosyllable stressed, so without a
   PROCLITIC list cynghanedd lusg "answers" the definite article `y`. The
   English engine has always had WEAK_ALWAYS for the same reason. Any new
   language needs its own before its prominence rule means anything -- and the
   list changes what a skeleton IS: a half-line ending in a proclitic has its
   last stress on an earlier word, which is an edge case that silently swept
   the final coda into the skeleton until a test line hit it.
47. **A revision loop that only checks the line it was told to fix is a rubber
   stamp.** The three ways a revision goes wrong are all silent: it fixes the
   rhyme and breaks the scheme elsewhere, it fixes the rhyme by taking the most
   predictable word in the field, or it quietly rewrites lines nobody asked
   about. verify() diffs the whole finding set, enforces the modal exclusion,
   and refuses changes outside the targeted lines. Accepting on "the flagged
   finding is gone" would pass all three.
48. **Doctrine 9 is only real once it is mechanical.** "Push away from the
   optimum" sat in this file as a sentence for the whole project. It is now a
   number -- modal_exclusion -- and an enforcement: the brief names the most
   frequent band-passing candidates as FORBIDDEN and verify() rejects a
   revision that takes one. A principle that lives only in prose gets followed
   exactly as often as someone remembers it.
49. **Re-test the channel map before believing a NOT-FOUND row.** Two channels
   were discovered mid-round that no earlier search had used: plain `git clone`
   of any public GitHub repo works, and GUTENBERG IS MIRRORED ON GITHUB as the
   GITenberg org. The second directly overturned a NOT-FOUND row this project
   had already written and committed — the Finnish Kalevala, recorded as
   unreachable, fetched in one call and validated at 81.2% alliteration. A
   sourcing failure is a claim about the network at a moment, not about the
   world; date it and re-run it when the map changes.
50. **An orthographic layer can silently destroy the very constraint a cell
   measures.** Modernised Icelandic inserts epenthetic -ur (Laetr -> Laetur),
   breaking the six-syllable drottkvaett line so hending POSITIONS become
   unrecoverable; Irish text_standard normalises spelling and destroys the
   orthographic rhymes; Somali's whole 1972 script postdates its own copyright
   cutoff. Three traditions, three different ways for a transcription to look
   fine and be unusable. Ask what the ORTHOGRAPHY does to the constraint before
   accepting any text.
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
53. **Admissibility is per-RELATION, not per-corpus.** Gudni Jonsson writes
   `o-umlaut` for both etymological `o-ogonek` and `o-slash`, and `ae` for `oe`.
   For skothending, a consonant relation, the merger is harmless and the text is
   sound. For adalhending, which needs vowel AND consonant identity, the same
   merger MANUFACTURES matches that no skald heard. One file, one orthography,
   admissible for one predicate and biased toward the positive for the other.
   The tri-state exists for exactly this: return None where the verdict depends
   on a distinction the edition has already collapsed, rather than True.
54. **A repo-root LICENSE is a claim about part of the repo.** `cltk/non_texts`
   ships `LICENSE_PERSEUS.md` (CC-BY-SA-3.0) at root covering only the Perseus
   fornaldarsogur, not the Snorra-Edda directory beside it; `sveinbjornt/
   sagadb.org` is BSD for the CODE while a separate README sentence affirms the
   TEXTS public domain; `OliverHellwig/sanskrit` is CC BY 4.0 except for the
   `corpus/GRETIL/` sibling, which is non-commercial. Three repos, three
   different scopes. Read what the licence says it covers, and record the path
   it covers in the row -- a licence name without a scope is not evidence.
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
59. **Refusing on SCRIPT has a measurable cost, and it should be paid in the
   open.** `fas.rhymes` returns None on 60.2% of 20,388 real Hafez pairs,
   because unvocalised Perso-Arabic does not write short vowels -- that is the
   designed outcome, not a failure. The 1.0% that come back False are almost
   all molamma' lines: Arabic hemistichs rhyming on an unwritten i'rab case
   vowel, which read as Persian end in a consonant. The module refuses by
   SCRIPT rather than by language, so Arabic-in-Arabic-script is accepted and
   those Falses are the price. Left standing and declared rather than patched,
   because a patch would be a language detector nobody calibrated.
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
61. **A rule that fires more often is not a better rule.** Four readings of
   which consonants carry a hending were tested against shuffled-line controls
   rather than argued about. "First post-vocalic consonant only" FINDS THE MOST
   -- 75.0% -- and is the WORST of the four, because its chance rate nearly
   triples to 31.9%. Yield is not evidence; lift over a matched control is.
   This is doctrine 56 arriving from the other side: there the search inflated
   the measurement, here a looser rule definition would have. Any time a rule
   has variants, pick between them by lift, and record the table.
62. **The tradition frequently states the rule you were about to invent.**
   Snorri's own Háttatal prose supplies two things a modern summary omits, and
   both are load-bearing: that the ONSETS MUST DIFFER for a hending to count --
   which is doctrine 3 written in the 1220s -- and a málfylling list of
   function words, which is doctrine 46 attested rather than assumed. Without
   the second, Snorri's own line 5 reads as three vowel-initial words and his
   own stanza reports as malformed. Read the tradition's own statement of its
   rules before writing a checker for them; the primary source is a spec.
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
66. **A tie broken by iterating a set is a result that does not reproduce.**
   `max(set(seen), key=seen.count)` picked a different alliterating sound under
   different PYTHONHASHSEED values. The COUNT was stable, so no rate this
   project reported was affected -- but a tally of which sound carries the
   alliteration would silently differ between runs, and nothing would have
   said so. Any tie-break is arbitrary; it has to be FIXED and stated.
