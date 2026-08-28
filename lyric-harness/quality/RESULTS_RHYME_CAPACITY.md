# Results — Rhyme capacity: what the lexicon sustains, derived (density stage 1)

Instrument: `quality/capacity.py`; `--check` re-derives tier 1 in full
and re-grades every sample witness (nightly CI lane). Artifact:
`data/rhyme_capacity_eng.tsv`, 12,387 rows + header. Derived
2026-08-19. NOT a corpus measurement: no songs were read, no nulls
resampled — the inputs are the pronunciation lexicon, the frequency
population, and the previously-calibrated two-tier ban, and the
derivation is math over them. The same move that derived the planner's
meter space from the cycle grammar, made here because a census of
what's been done would band the middle of the distribution and rate
the ten-line marvel verse out-of-band (the owner's move-37 rule; the
owner's own ruling on this sitting: "solve, don't census").

**Run 1 is VOID and the voiding is the sitting's first finding.** Its
family key mirrored `_spelled_rime`'s primary-first anchor; the
comparator anchors at the LAST PROMINENT vowel (secondary included),
and test_capacity §1's control pair convicted the conflation before
anything was committed: gasoline/tambourine grade as a satisfied rhyme
(the judge hears the final -ine) while the primary-first key filed
them apart. The two anchors are BOTH the grader's — one for hearing,
one for tier 1's spelling — and capacity now uses each exactly where
the judge does. The correction also consolidated the space (17,423
families under the wrong key, 12,387 under the right one) and TRIPLED
the certifiable tier, which forced the second declared bound below.

## The objects

A FAMILY is a perfect-rhyme class under the comparator's anchor. A
SPELLING CLASS within it is `_spelled_rime`'s value — tier 1: same
class = HOMEOTELEUTON, banned outright. A family's earned-chain
CEILING (`chain_hi`) is therefore its spelling-class count: a scheme
group of k mutually-earned lines needs k distinct spellings of one
sound, because every pair in a mandated group is judged. The certified
FLOOR (`chain_lo`) is built THROUGH THE GRADER: a witness (one word
per class, most frequent first, attempts capped at
`CERTIFY_ATTEMPT_CAP` = 40) is graded as a real mandated group by
`Reviser.inspect`, repaired until clean, and stored with its words —
chain_lo is what the judge accepted, by construction, and the crown
test re-grades the sample on every push.

Two declared computational bounds, both of `EXACT_ENUM_MAX`'s species
(honesty bounds on construction, never on the ceiling): the 40-class
attempt cap (the uncapped attempt on a 99-class family re-graded
~4,900 pairs per repair round and ran past 30 CPU-minutes), and the
certification floor of 20 classes (raised from 8 when the corrected
anchor tripled the certifiable set from 98 to 272 families, pricing
floor-8 certification at ~4 hours; below 20 classes a family cannot
hold a 20-line single-sound chain in principle, so tier-1 arithmetic
answers alone, and `certify()` remains callable on any family).

## The numbers (`ADOPTED`, re-derived exactly by `--check`)

39,969 words — the declared population: the frequency lexicon,
alphabetic, two letters up, readable — collapse into **12,387 rhyme
families**. Ceilings: 2,817 families sustain even a 2-chain, 593 a
5-chain, 162 a 12-chain, **81 a 20-chain**. All 81 of the >=20-class
tier are certified; the deepest verified chain is **40, at the
construction cap** — every class the cap admitted survived the modal
tier. That 40 is held by NINE families, not one; ~~40 (EY:
day/weigh/bouquet…)~~ named the first of a sorted tie, and the section
below names all nine and says what the cap does and does not measure.

## RE-DERIVED 2026-08-21 against the rebuilt modal tables, and NOT ONE
ADOPTED CONSTANT MOVED

`66eb44e` rebuilt `data/song_endword_en.tsv` and `song_rhymepair_en.tsv` over
the loaded corpus — 46,881 → 131,394 and 39,122 → 97,129 rows. `chain_lo` is
certified THROUGH the grader, whose tier-2 (MODAL) ban reads exactly those two
files, so every committed witness had been certified against a ranking that no
longer exists. `test_capacity` §3 went red with six families carrying banned
pairs and **0 drift** — the family key was fine, the judge had moved. All 81
families were re-certified from scratch.

**THE HEADLINE IS THAT THE HEADLINE HELD.** Every `ADOPTED` constant
re-derives exactly: population 39,969, families 12,387, the six
`chain_hi_at_least` counts, certified 81, `max_chain_lo` 40. A rebuild that
tripled both tables moved no committed number.

**Because the ceiling is a property of ENGLISH and the floor is a property of
the CORPUS THAT JUDGES IT.** `chain_hi` is spelling-class arithmetic over the
pronunciation lexicon; the lexicon did not change, so it could not. `chain_lo`
is what a grader accepted, and the grader is corpus-derived. That distinction
was implicit in the design and is now measured.

| | |
|---|---|
| certified families | 81 |
| moved | 23 |
| unchanged | **58** |
| total chain links lost | 33 |
| deltas observed | −1, 1, 2, 3 |

**IT IS NOT UNIFORMLY STRICTER — `UW-M` GAINED A LINK, 13 → 14.** A pair that
was modal under the old ranking need not be under the new one, so the rebuild
is a different judge rather than a harsher one. One family out of 81 is not a
trend, and it is recorded because a table of losses would imply a direction the
data does not have.

**THE COST CONCENTRATES BY DEPTH, which is what a per-PAIR ban predicts.**
Families with ≥60 spelling classes moved 9 of 17 (53%); those below 60 moved 14
of 64 (22%). A deeper family has more pairs for the ban to land on. The three
families this document quotes by name all moved: `AY-ER` (fire's) 28 → **27**,
`IY` 37 → **34**, `EH-R` 33 → **31**.

**AND `max_chain_lo_family` NAMES ONE OF NINE.** 40 is held by `AE-K`, `AE-N`,
`AO-L`, `EH-L`, `EY`, `EY-T-AH-D`, `EY-T-ER`, `EY-T-IH-NG` and `IH-Z-AH-M` —
every one of them at `CERTIFY_ATTEMPT_CAP`. Saying "the deepest verified chain
is 40 (EY)" reads as though EY were special; it is first in a sorted tie. What
40 actually measures is THE CONSTRUCTION BOUND, not the language: those nine
families are bounded BELOW at 40 and their true ceilings are unmeasured. The
constant is kept because it is honest about what was attempted, and this
paragraph exists so the singular is never read as a discovery.

**The artifact now records its judge.** `emit_table` writes a `#judge` header
with the md5 of each table the modal tier reads, and `check()` compares it
before re-grading anything — so the next rebuild names the moved file in one
line instead of presenting six mysterious family failures. Establishing the
cause this time took re-grading the witnesses under both tables.

---

## The findings

1. **~~English is narrow, and the marvel verse is forced switching.~~
   ENGLISH IS NARROW *UNDER PERFECT RHYME*, and that qualifier is the whole
   sentence.** A sustained single-sound earned run of 12+ lines exists in 162
   families out of 12,387 (1.3%); 20+ in 81 (0.65%). Under perfect rhyme the
   ten-plus-line dense verse changes sound families because the lexicon leaves
   no other road — a derived fact, not a stylistic observation.

   > **SCOPED 2026-08-22, and the qualifier is not a hedge — it is two orders
   > of magnitude.** §"The objects" declares a FAMILY to be a perfect-rhyme
   > class, so the METHOD was never wrong; this FINDING dropped the coordinate
   > and rendered the number as a fact about English (doctrine 58: a count is
   > a coordinate of its rendering). Re-measured over the identical population
   > (39,969 words; the shipped 12,387 reproduces exactly, which is the
   > control):
   >
   > | equivalence key | families | singletons | max | mean | median |
   > |---|---:|---:|---:|---:|---:|
   > | **perfect rhyme** (shipped) | 12,387 | 8,131 | 399 | 3.2 | 1 |
   > | assonance (anchor nucleus) | **15** | **0** | 5,269 | 2,664.6 | **2,382** |
   > | consonance (anchor-to-end consonants) | 3,527 | 1,905 | 2,002 | 11.3 | 1 |
   > | rime riche (whole word, onset in) | 37,462 | 35,471 | 7 | 1.1 | 1 |
   >
   > Under perfect rhyme the median family holds ONE word and 8,131 of 12,387
   > are singletons. Under assonance there are **fifteen families, none of
   > them a singleton, and the median holds 2,382 words** — fifteen being
   > about the stressed vowel inventory of English, which is the sanity check
   > that the key is the right one. "The lexicon leaves no other road" is
   > true of one road.
   >
   > **WHAT THIS DOES NOT OVERTURN.** The certified figures — `chain_lo`, the
   > witness words, the modal-tier cost in finding 3 — are earned through the
   > GRADER and are untouched: a family of 2,382 words is not 2,382 usable
   > partners, because the homeoteleuton ban, the modal tier and the judge all
   > still cut it, and none of that was re-run here. What moves is the OBJECT
   > the narrowness sentence is about. And the four keys above are the obvious
   > phonological rendering of each relation, mine and not the repo's judge —
   > `classify_pair` may cut any of them finer. That caveat does not touch the
   > finding, which is that the count is a function of a relation this
   > sentence did not name.
   >
   > **BUILT 2026-08-28 (`MISSING.md` M-41's ladder step 5, the cheap
   > half).** The relation is a DECLARED coordinate of the layer now:
   > `capacity.families(reviser, relation=...)` keys by
   > `RELATION_KEYS` (the four keys above, verbatim, promoted from this
   > block's one-off script to the implementation — and the vocabulary
   > is checked against `ADMITTABLE_RELATIONS` at import, so a capacity
   > can only be partitioned under a relation a mandate can admit); the
   > artifact's rows LEAD with a `relation` column and `read_table`
   > refuses a table without it; the verb prints the coordinate; and
   > this block's table re-derives as `python3 quality/capacity.py
   > --families=RELATION` — every cell above reproduced exactly on the
   > build day (`test_capacity` §7 pins all four rows). The EXPENSIVE
   > half — a certified `chain_lo` under a non-RHYME relation, priced
   > at hours of grading per relation — is deliberately not built: which
   > relations are worth paying for is the owner's ruling, parked in
   > `BACKLOG.md` RULINGS WANTED.
2. **Secondary-stress clusters are the deep water.** Under the judge's
   own rules the -ate/-ee/-ine families are tier-1 deep (EY-T: 192
   classes; IY: 228 classes), because the spelled rime anchors at the
   PRIMARY and digs a distinct string per word (dictate -ictate, rotate
   -otate). Tier 1 barely binds there; the modal tier is what pinches.
3. **The modal tier costs real chain length.** AY-ER (fire's family):
   34 classes, certified ~~28~~ **27**. IY: attempts 40, certified ~~37~~
   **34**. EH-R (there/care/hair): 47 classes, certified ~~33~~ **31**.
   (Re-derived 2026-08-21 against the rebuilt modal tables — see the
   section above.) The chain_hi/chain_lo gap is the ban system working,
   family by family.
4. **The witness cliques are usable objects, not just numbers.** Each
   certified row carries the words the grader accepted — `capacity
   fire` prints the ~~28~~ **27**-word clique a writer could actually
   walk (re-derived 2026-08-21; the witness is re-read from the
   artifact, so the number above is the only place it is retyped).

## What this does NOT license

Nothing grades a draft against these numbers: stage 2 (the
earned-event counter over the grid, notes only) and stage 3 (the
declared density coordinate) are DELIBERATELY UNBUILT pending the
owner's ruling on these results. A capacity is a ceiling, not a score;
the planner samples none of it; the `capacity` verb is a reader over
the committed artifact, disclosure only.
