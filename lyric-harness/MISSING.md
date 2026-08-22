# MISSING — the gap register

A living list of what this project does **not** have. It exists because the
repo's own documentation had drifted into describing what was built and audited,
and a reader could not tell from `CLAUDE.md` that there is no pitch layer, no
hook, no syllable-to-beat mapping, and that the rhyme-type taxonomy has nothing
calling it.

**How to use this file.** Add gaps as they are found. Do not delete an entry
when it is filled — mark it `CLOSED` with the commit, so the register also
records what it took. An entry that turns out to be wrong gets marked
`WITHDRAWN` with the reason, never quietly removed.

**Status:** `OPEN` · `PARTIAL` (something exists and is inadequate) ·
`CLOSED` · `WITHDRAWN` · `BLOCKED` (cannot be fixed under current constraints,
with the constraint named).

**Verified** means checked against the code on the date given, not recalled.

---

## A. Notation and scheme representation

### A-1 · Capital/lowercase refrain notation `OPEN`
**TESTED WHILE OPEN.** `test_english_text.py` and `test_song_function.py`
name this entry to PIN THE GAP, not to guard a fix — the citation reads
"the repo cannot represent it (MISSING.md A-1)". A test that asserts an
absence is the correct shape for an open entry and must not be read as
evidence it closed (`quality/triage.py`).
**Now (verified 2026-08-10):** `quality/schemes.py` `parse()` handles `X` and
`.` as unrhymed singletons and letters as rhyme classes. Nothing else.
**Missing:** the standard prosodic convention where **capital = a line repeated
verbatim**, **lowercase = rhyme only**, with superscripts for distinct refrains
(`A¹`, `A²`). The villanelle is `A1bA2 abA1 abA2 abA1 abA2 abA1A2` and cannot
be written down here.
**Why it matters:** every refrain, burden, tag, hook-return and radif is line
IDENTITY, not rhyme. `schemes.py` already admits this in a note on its own
villanelle entry and did not act on it.
**A third form nobody anticipated, found in the corpus 2026-08-10: LINE
IDENTITY BY REFERENCE.** Printed songsters abbreviate a chorus return as
`Oh, my poor Nelly Gray, &c.` — a stub that POINTS at the chorus instead of
reproducing it. There are ~~**941**~~ ~~**777 in the 143 English files and 818
across all languages**~~ **989 in the 1,297 English files and 1,036
across all languages** in the staged corpus (RE-MEASURED 2026-08-21
over the loaded tree, same predicate and same exclusions) (`lyric_harness.is_chorus_stub` over
verse lines only — blank, `#`, `---` and `[` excluded — measured 2026-08-11).
**The 941 does not reproduce and no rule tried lands on it:** three plausible
readings give 776 / 777 / 918. Either `is_chorus_stub` tightened after the count
was taken or "the staged corpus" meant a different set, and the entry states
neither, which is doctrine 58 with the RULE as the unwritten coordinate rather
than a threshold. **Name the rule beside the number.** Its last token strips
to `&c`, which is not a word and entered the rhyme data as one until
`lyric_harness.is_chorus_stub()` was added. A stub must be excluded from rhyme
extraction AND resolved against its target; only the exclusion is built.
**And the position is not fixed:** hymnals print the chorus after verse 1 in
some books and after the AUTHOR ATTRIBUTION at the end in others (the "sung
after every verse" convention). Both are in the corpus, source order preserved.
It broke the hymn cell's first parser.

### A-2 · Repetition-with-variation `PARTIAL` 2026-08-21
**VERIFIED CLAUSE BY CLAUSE 2026-08-21 — the pass this entry's own
declaration promised.** Two clauses are FALSE at head; two are the entry.

| A-2's clause | at head |
|---|---|
| a one-word-changed chorus is neither "the same line" nor "a different line" | **FALSE** — `compare_returns` returns `LEXICAL_VARIATION` with `invariant_lines` reported (`grid.py:834`) |
| no representation for **partial return** | **FALSE** — `PARTIAL_RETURN` is a named member of a **15-way** ladder ("at least one line invariant and nothing above holds"), beside `TRUNCATED_RETURN`, `EXTENDED_RETURN`, `FRAME_PRESERVED`, `HEAD_/TAIL_/HEAD_AND_TAIL_PRESERVED`, `ANAPHORIC_/EPIPHORIC_RETURN`, `RESTATEMENT`, `RHYME_PRESERVING_REWRITE`, `REWRITTEN_RETURN`, `VERBATIM`, `STUB` |
| no representation for **answer lines** | **TRUE** — the only tree hit is `schemes.py`'s prose about slant rhyme ("line 2 can answer line 1 on the nucleus"), which is a sentence, not a relation |
| no representation for **call-and-response pairs** | **TRUE** — zero hits repo-wide for `call.and.response`, `antiphon`, `responsorial` outside this file |

**And the 2026-08-10 evidence is DISCHARGED, not merely staged:**
`test_song_function.py` §7 reads Hanby and Russell **out of the corpus** and
resolves them to two DIFFERENT named kinds — `RHYME_PRESERVING_REWRITE` and
`FRAME_PRESERVED` — and both exemplars are cited inside the ladder's own
glosses, so the corpus evidence became the vocabulary's documentation.

**TESTED WHILE OPEN** — `test_song_function.py` guards the RETURN half above
(the ladder, and Hanby/Russell read out of the corpus). It does not touch the
two clauses below, which is why this entry stays open at PARTIAL rather than
closing on a green suite.

**Still missing, and it is one shape not two:** answer lines and
call-and-response pairs are both *a relation between two lines within a
block*, and neither is a RETURN. A return asks *did this come back, and how*;
these ask *does line B reply to line A*. `relations.py`'s `REGISTRY` is the
layer that would hold it and has no leader/response axis. See also the
2026-08-21 vocabulary census: Malay's pembayang/maksud is the same shape one
tradition over — a functional split INSIDE a quatrain that no layer can hold.
**Missing:** a chorus that returns with one word changed is neither "the same
line" nor "a different line". No representation for partial return, answer
lines, or call-and-response pairs.
**Evidence, verified 2026-08-10:** Hanby's *Darling Nelly Gray* keeps the rhyme
scheme and the tune slot and rewrites the words — `they have taken you away /
I'll never see my darling any more` returns as `up in heaven there they say /
they'll never take you from me any more`. Russell's *Cheer, Boys, Cheer* alters
the interior lines and keeps the first and last. Staged under
`corpus/song/eng_parlour_*.txt`, tagged `[CHORUS 2]`.

### A-3 · Scheme space beyond 26 sounds is untested at song length `PARTIAL`
**Now:** `label()` falls through to `A1 B1 …` past Z. Round-trip is tested to
30 sounds only.

---

## B. Pitch, harmony, melody — ABSENT

### B-1 · No pitch layer at all `OPEN`
**Now (verified):** no module in the repo represents pitch. The grep hits for
"pitch/interval/scale" are Somali pitch ACCENT, statistical confidence
INTERVALS, and rescaling.
**Missing:** pitch classes, intervals, the 12 ordered interval classes and 6
unordered ICs, the **66 unordered dyads of 12-TET**, the 208 Forte set classes,
interval vectors, Z-relations, chords, voicings, inversions, extensions,
quartal and cluster harmony, polychords, voice leading, cadence types,
modulation, tonicization, harmonic rhythm.

### B-2 · 12-TET is assumed BY OMISSION `OPEN`
**Missing:** any tuning declaration at all, and therefore every non-12 system —
just intonation, meantone, well temperaments, 19-TET (171 dyads), 22-TET,
24-TET (276 dyads), 31-TET (465), 53-TET, Bohlen-Pierce; maqām with neutral
seconds; Indian 22 śruti; gamelan slendro and pelog (non-octave-repeating);
Turkish AEU 53-comma; Thai 7-equal.
**Why it matters:** an unstated assumption is the one that never gets audited.
Doctrine 1 says assumptions live in a declaration; the tuning has no coordinate.

### B-3 · No scale or mode systems `OPEN`
**Missing:** church modes, melodic/harmonic minor modes, pentatonic, hexatonic,
octatonic, whole-tone, acoustic, altered, blues scales, the maqāmāt, the rāgas,
Japanese modes, and the fact that several of these are not scales but
behaviours (ascent/descent asymmetry, characteristic phrases, ornament rules).

### B-4 · No melodic shape `OPEN`
**Missing:** contour, range, tessitura, leap/step ratio, phrase arch, peak
placement, repetition and sequence, motif development.

---

## C. Rhythm and meter

### C-1 · Additive/aksak meter is inexpressible `CLOSED` 2026-08-10
**Was:** `pulse_groups` did not merely omit the grouping — it ASSERTED one,
returning `(3,3,3)` for 9/8 where Balkan daichovo is 2+2+2+3, and seven single
pulses for 7/8.
**Now:** `quality/meter.py`. A grouping is an ordered **composition** of the
pulse count, of which there are **2^(n-1)** — 64 at seven pulses, 256 at nine.
Undeclared returns **None**; `conventional_grouping()` exists separately and is
labelled a convention. `variants()` reports the 255 meters a declared 9/8 is
being distinguished from. `grid.Meter` delegates, so the assertion is gone
there too.

### C-2 · No cyclic-metre systems `PARTIAL` — the container exists, the
catalogues do not `OPEN`
**Now:** `Cycle` can hold every one of them — **typed groups** (a tāla's angas:
laghu/drutam/anudrutam), **per-position labels** (an usul or īqāʿ is a LABELLED
cycle, not a grouping: maqsūm is D T – T / – T D –, and identity matters, not
just accent), **marked positions** (sam, khali), **nested periodicities with
phase** (colotomic — the kempul sits offset between the kenongs), and
`origin=None` for **polycentric** cycles with no privileged beat 1.
**Missing, and it is DATA not structure:** the 35 tālas and their anga
sequences, 100+ usuls, ~100 īqāʿāt, the gamelan forms (lancaran, ketawang,
ladrang, gendhing), flamenco compases, West African timelines.
`get_named()` raises and names the gap; `register_named()` REFUSES an entry
without a `source`, because a catalogue written from memory is unsourced data
in the evidence base.

### C-3 · No metric complexity `PARTIAL` — structure built 2026-08-10
**Now:** bar duration is an exact `Fraction`, so **.125/1 through 64/32**,
fractional numerators and non-power-of-two denominators (4/3, 5/6) are one
object with no special cases; `irrational` is a declared property.
`Polymeter` (independent barlines, composite period = lcm of Fractions —
3/4 against 4/4 realigns at 3 whole-notes), `Polyrhythm` (n against m in ONE
span, 3:2 resolving at 1/6), `MeterMap` (meter per BAR, not per section), and
`Density` for irama, deliberately not a Cycle because the frame does not move.
**Still missing:** metric modulation, hemiola, tuplets, swing ratio as a
continuous value, rubato/senza misura, hypermeter, metric dissonance.

### C-4 · ~~No groove or microtiming~~ — the groove questions are DECLARED and PERMANENTLY REFUSED BY NAME `PARTIAL`
**Missing:** pushes, pulls, laid-back and ahead-of-beat placement, syncopation
measurement, the difference between a line that lands and one that drags.

> **REPINNED 2026-08-21 — `OPEN` was MISPINNED, and the difference is doctrine
> 20's.** These questions are not unrepresented; they are enumerated, named and
> **permanently refused**, which is an answer. `quality/fit.py`'s module
> docstring says so in this entry's own words — *"every groove question in
> MISSING.md C-4 (pushes, pulls, laid-back placement, syncopation as a
> measurement rather than as a declared offset) are refused permanently and by
> name, not approximated"* — and `fit.UNANSWERABLE` carries the sentence as a
> ROW (*"whether the singer LANDS on the beat, ahead of it or behind it"* /
> `PERMANENT: MISSING.md C-4 …`). `quality/declared_inputs.py`'s family
> **R5 offbeat rhyme** is `route="OUTSIDE"`, `status="PERMANENT"`, referencing
> `MISSING.md C-4, C-5, G-1; doctrine 4`, and it SPECIFIES the input that would
> answer (`BeatGrid`) while refusing the measurement.
> `relations.py`'s `offbeat internal rhyme` declares `requires=('beat',)` and
> returns a typed `Refusal(capability='beat')` rather than a false negative.
>
> **WHAT IS TRULY MISSING IS NARROWER: syncopation as a measurable quantity
> GIVEN a declared grid.** R5 accepts a `BeatGrid` and nothing computes
> displacement off one; no `groove`/`syncopat` symbol exists in `meter.py` or
> `grid.py`. C-3's *"swing ratio as a continuous value"* is the live neighbour.
>
> **AND A TEST GUARDS THIS ENTRY THAT TRIAGE CANNOT SEE** —
> `quality/test_fit.py` asserts `"C-4" in whys` over `fit.UNANSWERABLE` and
> passes. `quality/triage.py`'s `m_win` requires the literal `MISSING` within
> `MISSING_NEAR` characters of the key, and the assertion names the key bare,
> so this entry reads as `CITED` (a module names it, no test guards it) when it
> is `DECLARED` (a test names it and the entry says why). **Same class as the
> `m_re` fix that moved D-1, one spelling further on**, and it inflates CITED
> while emptying DECLARED. Recorded here, NOT fixed in this commit: widening
> the scanner reshuffles all five triage counts, which is its own change.

### C-5 · Tempo is not represented `PARTIAL`
**Now:** `Song` has bars and meters, no tempo, no tempo change. **That sentence
is TRUE at head** — `grep -n tempo quality/grid.py` returns nothing.

> **REPINNED 2026-08-21 — AND THE HEADLINE IS THE WRONG SHAPE OF CLAIM.** A
> tempo field **does** exist: `declared_inputs.BeatGrid.tempo_bpm` (`:546`),
> read by nothing anywhere in the tree. Beside it sits `fit._no_tempo`
> (`:184`), a `PERMANENT` refusal whose detail opens *"MISSING.md C-5: `Song`
> carries bars and meters and no tempo"* — constructed by nothing.
> `quality/meter.py`'s `note_value` docstring refuses seconds by name for the
> same reason. **`fit.INERT` (`:313`) already declares both dead and says why**:
> *"BOTH HALVES OF THE TEMPO STORY ARE UNWIRED, and each is dead in its own
> direction"* — a declaration with no reader, and a guard with no question.
> `test_fit.py` re-derives both directions and passes.
>
> So this is **not an unrepresented coordinate; it is a declared one with no
> reader beside a refusal with no caller**, and wiring either half alone closes
> nothing — it activates the moment one per-second question is asked. `PARTIAL`
> on `blocker="build"`, not `OPEN`.
>
> **A NAME SLIP FOUND ON THE WAY IN, AND FIXED IN THIS COMMIT.** The `INERT`
> row's `field` read `fit.NO_TEMPO / declared_inputs.TimeGrid.tempo_bpm` and
> `test_fit.py` PINNED that string — **there is no `TimeGrid` in this tree**;
> the class is `BeatGrid` (`declared_inputs.py:524`). A test pinning a
> non-existent symbol name is a check that cannot notice the symbol moving.
>
> The triage blind spot recorded under C-4 applies here identically:
> `test_fit.py` asserts `"C-5" in whys` by bare key, so this entry also reads
> `CITED` when it is `DECLARED`.

---

## D. Song architecture

### D-1 · ~~Sections have no FUNCTION~~ — they have had one since `d944ff7`, and every clause of this entry is satisfied `CLOSED` 2026-08-21
> **THIS ENTRY'S OWN `Now (verified)` CLAUSE IS FALSE AT HEAD — 2026-08-21.**
> It reads *"`Section` fields are exactly `name, bars, meter, start_bar`"*.
> That was the first finding; the reading of the rest, deferred below, is now
> done, and EVERY sentence closes:
>
> | D-1's sentence | at head |
> |---|---|
> | fields are exactly `name, bars, meter, start_bar` | FALSE — `function` is the fifth (`grid.py:356`) |
> | `name` is a free string | TRUE, and deliberately: "deliberately not evidence" (`grid.py:359`) |
> | Missing: a declared vocabulary of 20 names | FALSE — `SECTION_FUNCTIONS` holds 21 rows and all 20 of this entry's names round-trip through `as_function`, `middle-8` via a declared alias, plus `burden` and `hook` beyond the ask |
> | nothing can ask *does this song have a pre-chorus* | FALSE — `function_profile` emits `has_prechorus`; `test_song_function.py` PASSes it by name, quoting this entry |
> | nothing can ask *how many bars until the first chorus* | FALSE — `Song.bars_until` (`grid.py:475`), whose docstring quotes this sentence verbatim; tested by name |
>
> The refusal path is built too: `UNDECLARED` is not `verse`, an unknown value
> raises `UnknownFunction`, and `song_function_report` reports asked/answered/
> refused as three counts. `BACKLOG.md` already carries the close —
> *"~~Sections have no FUNCTION (D-1)~~ … `7e802d3` (field first at
> `d944ff7`)"* — so this is the eighth entry of the day whose work shipped
> while the register slept, and the second (after M-17) where the OTHER
> register knew.
>
> **AND NO INSTRUMENT FOUND THIS — a human reading the queue did.** No test
> names D-1, so `quality/triage.py` puts it in UNGUARDED, which is that
> file's OWN stated blind spot: it sorts by whether the tree names an entry
> and cannot see an entry nothing cites. Recorded here as the worked example.
> **Half of that sentence is now false for a second reason, fixed 2026-08-21:**
> `test_song_function.py` DOES name D-1 — its header reads "`MISSING.md` A-1,
> A-2, D-1, D-2, D-3" — but triage's `m_re` was non-greedy and captured only
> the FIRST key after the word `MISSING`, so the citation was read as A-1
> alone. The scanner now collects every key in the window and D-1's decade in
> UNGUARDED ends the same day the entry closes.

What remains in this area belongs to its neighbours and is already filed
there: D-3's reprise-across-two-functions clause, D-2's hook, D-4's arc.

### D-2 · ~~"Hook" cannot be represented~~ — it can be held, counted, placed and read sub-line; density and melody remain `PARTIAL` 2026-08-21
**VERIFIED CLAUSE BY CLAUSE 2026-08-21. Five of seven are FALSE at head,
including the sub-line clause the earlier declaration deferred.**

| D-2's clause | at head |
|---|---|
| a hook is not a section, it is a FRAGMENT | **FALSE** — `Hook` is a frozen dataclass with ONE field, `text` (`grid.py:1355`); empty raises |
| possibly inside other sections | **FALSE** — `hook_occurrences` walks `song.lines` and reports the containing `section`/`function` |
| nothing can hold one | **FALSE** — `Hook` |
| count its returns | **FALSE** — bar-ordered occurrence list; `HOOK_DOES_NOT_RECUR` at 1 ("a hook is defined by RETURN; one occurrence is a phrase"), `HOOK_ABSENT` at 0 |
| place it | **FALSE** — `bar`, `beat`, `next_downbeat`, `token_offset`, `has_pickup`, plus `HOOK_CONFINED` and two placement REFUSALS. At LINE granularity, and `grid.py:1389` says why: a mid-line fragment's bars are the line's, because per-syllable placement needs the setting `fit.py`'s `NO_SETTING` refuses |
| possibly shorter than a line | **FALSE** — a 3-word and a 1-word hook are both found at non-zero `token_offset`; `test_song_function.py:221` |
| possibly melodic rather than lyric | **TRUE** — `Hook.text` is words matched against `Line.text`; no pitch layer exists (B-1, re-verified absent 2026-08-21) |
| measure its density | **TRUE** — `grep -i densit quality/grid.py` returns **nothing**. Six `HOOK_` codes and not one is a density measure |

**TESTED WHILE OPEN** — `test_song_function.py` guards the five clauses that
are FALSE at head (it PASSes the sub-line case by name). Nothing tests density
or melody, because neither exists; the suite being green says nothing about
the two rows still marked TRUE.

**Still missing, and they are two different kinds of missing.** DENSITY is not
hard to build — the occurrences are already in hand, bar-ordered. What is
absent is the DECLARED COORDINATE (per bar? per section? share of lines?) and
a band to read it against, and picking one by fiat is the error doctrine 19
names. MELODIC is doctrine 92's shape: blocked on the same absent SETTING that
makes `HookOccurrence` report two bar coordinates instead of one, and
unbuildable before B-1.
**Missing:** a hook is not a section. It is a FRAGMENT that recurs, possibly
inside other sections, possibly melodic rather than lyric, possibly shorter
than a line. Nothing in the model can hold one, count its returns, place it, or
measure its density.

### D-3 · No return/variation structure `PARTIAL`
**TESTED WHILE OPEN** — `quality/test_song_function.py` guards the built half
(`compare_returns`, `return_findings`, the ladder) and this entry stays
PARTIAL on its own "Still missing" clause below, which the 2026-08-21
verification of D-1 confirmed is real: a reprise ACROSS two declared functions
is representable but not yet asked anywhere.
**Was:** how many times a section returns, in what order, with what
variation; reprise; truncated final chorus; added bar on the last return —
none of it askable.
**Now:** `quality/grid.py`'s `compare_returns` answers "with what variation"
over the ~~12-way~~ `VARIATION_KINDS` ladder including `TRUNCATED_RETURN` and
`EXTENDED_RETURN` by name (**the width is struck and NOT replaced, 2026-08-16
— it measures 15, it was already 15 when "12" was written, and the ladder-vs-
boolean argument does not turn on it; run
`python3 -c "from quality import grid as GR; print(len(GR.VARIATION_KINDS))"`.
`CLAUDE.md` known gap 7 carried the same figure and is struck with this
one**); `return_findings`/`song_function_report` run it
over every declared function's own instances, answering "how many times"
(`song.instances_of(fn)`) and "in what order" (bar-ordered by construction).
`CLAUDE.md` known gap 7 has the same correction; `examples/nobodys_native_
son.txt`'s final chorus (`HEAD_PRESERVED`) and its extra-bar payoff line
(`EXTENDED_RETURN`-shaped, caught live by `RETURN_LENGTH_DRIFT`) are a real
run, not a claim.
**Still missing:** reprise — `compare_returns` takes two line lists and does
not care where they came from, but nothing calls it ACROSS two different
declared functions (does the outro reprise the intro). The primitive exists;
the question is not asked.

### D-4 · No arc `OPEN`
**Missing:** energy, dynamics, density, register, instrumentation change across
the form — the shape a listener actually experiences.

---

## E. Rhyme

### E-1 · The type taxonomy has NO PRODUCER `CLOSED` 2026-08-10
**Was:** nothing called `rhyme_types.py` except its own test. It was a
vocabulary with nothing that could look at two words and return a coordinate.
**Now:** `classify_pair(a, b, phon)` and `verdict(a, b, phon)`. `phon` is any
object with `.syllabify()` — every module in `quality/phonology/` — so Welsh,
Finnish, Malay, Sanskrit, Old Norse and Persian relations land in ONE space
rather than six special cases. Nothing is transcribed in this file.
**AND THE CHANNELS ARE TERNARY.** A binary channel forced Persian's unwritten
short vowel to be coerced to agrees-or-differs, and both are assertions the
orthography does not support — the rhyme-side of the same defect `meter.py`
fixed. The cell space is **27**, of which the 8 named ones are the
fully-DETERMINED subset. `verdict()` propagates the unknown and
`unknown_channels` names which channel caused it. Cross-checked: on دل/گل the
generic path and `fas.rhymes()` independently return None.
**Refusals kept honest:** `'anchor'` (last stressed syllable to end) RAISES
where the phonology carries no prominence — som, msa and fas all decline a
stress grid — because the anchor rule is a coordinate, not a universal.

### E-2 · ~~English still has five relations~~ — the five-relation path is the GRADER's, and it is not the tree's `PARTIAL`
**Now:** `lyric_harness.py`'s own `score()`/`admits()` band recognises RHYME,
REPEAT, RIME_RICHE, ASSONANCE, CONSONANCE — **and that is a statement about
ONE layer, not about English in this repository.** `quality/relations.py`'s
`REGISTRY` holds **77 schemas**, of which **58 declare a `Tradition(lang='eng')`**
(59 name "English" in a tradition string). The heading invited a count and the
count is 58, not five.
**Now detected by `classify_pair`:** span (masculine/feminine/dactylic and
UNBOUNDED beyond — the old SPAN dict capped everything 4+ as "extended"),
identity (distinct/same_word/rich), stress alignment including wrenched,
length match (equal/additive/subtractive), and all 27 ternary channel cells
including pararhyme and the two English never named.
~~**Still missing:** mosaic/compound and broken boundary detection (the axis
exists, nothing infers it from text), apocopation, and eye/historical
realisation — all three need the ORTHOGRAPHY beside the phonology, which no
caller currently passes. `lyric_harness.py` itself still runs its own
five-relation path and does not call this.~~

> **REPINNED 2026-08-21 — THE `Still missing` CLAUSE ATTRIBUTED A
> `rhyme_types.py` FACT TO THE WHOLE TREE, and it is right about one layer and
> wrong about the other.** Measured at head against the real `eng` phonology:
>
> | schema | what it does when asked |
> |---|---|
> | `mosaic rhyme` | **realises** — returns a verdict list |
> | `compound / phrasal rhyme` | **realises** |
> | `broken rhyme` | **realises** (`Unit.split_left/split_right`, computed from a trailing hyphen) |
> | `apocopated rhyme` | **realises** (`unmatched='require_a'`) |
> | `eye rhyme` | **REFUSES** — `Refusal(capability='orthography', missing=('orthography',))` |
> | `historical rhyme` | **REFUSES** — `Refusal(capability='earlier')` |
>
> So *"all three need the ORTHOGRAPHY"* is a **category error for the first
> four**: they are phonemic-plus-token questions and they run. It is exactly
> right for the last two, and those refuse **by named capability** rather than
> returning a false negative, which is the honest shape. **What was NOT
> reproduced here** are the agent-reported positive instance counts on
> purpose-built fixtures (mosaic 2, compound 3, broken 2, apocopated 2); three
> attempts returned verdict lists with zero positives, so the counts are not
> carried into this entry. **The structural claim does not rest on them** — a
> verdict list and a `Refusal` are different return types, and that is what
> distinguishes the two halves of the table.
>
> **THE RESIDUE IS TWO CLAIMS, AND NEITHER IS A MISSING AXIS.**
> 1. **`rhyme_types.classify_pair`'s `boundary` and `realisation` are declared
>    parameters with defaults that NO caller infers** — `boundary='simple'`,
>    `realisation='phonetic'`, pass-through. *"The axis exists, nothing infers
>    it from text"* is exactly true HERE and exactly false of `relations.py`.
> 2. **`Stream.alt` is a declared slot (`ALT_SURFACES`) that `build_stream`
>    never populates** — the only stream builder in the tree structurally
>    cannot, so `eye rhyme` and `historical rhyme` refuse for want of a
>    **producer**, not for want of an axis. That is doctrine 44's distinction:
>    the thing to build is a surface reader, and it is not blocked.
>
> **AND THE CLOSING SENTENCE WAS FALSE.** `lyric_harness.py` DOES call this —
> `RT.classify_pair` at `:5645` (the `types` verb) and `RL.build_stream` /
> `RL.realise` at `:5985`/`:6037` (the `relations` verb). The true claim is
> narrower and is the one worth keeping: **the GRADING path — `score`,
> `admits`, `rhyme_density`, the chains — is five-valued and consults neither.**
> A CLI verb reaching the 77 schemas is not the grader reaching them.

**TESTED WHILE OPEN.** `quality/test_relations.py` names this entry while it
stays PARTIAL, and the two halves do not overlap. What the suite guards is the
TREE's side — that `REGISTRY` holds 77 schemas, that 58 declare an English
tradition, that `classify_pair` reads the axes the heading said were missing.
What stays open is the GRADER's side: `lyric_harness.score`/`admits` are still
five-valued and consult neither module. No regression asserts that they are,
so nothing here is being tested green while the gap is open — the entry closes
when the grading path consults the registry, which is the relation ladder's
own destination and not a fix this entry can make alone.

### E-3 · ~~Internal rhyme is two-line only~~ Internal rhyme has two windows and neither is declared `PARTIAL`
**Now:** ~~`internal_matches` supports a pair of lines. No verse-wide or
song-wide positional rhyme graph.~~
**REPINNED 2026-08-16 — the graph exists and this entry cited it without
reading it.** `quality/relations.py`'s `internal rhyme` schema note names THIS
ENTRY BY ID ("MISSING E-3: this is the song-wide positional graph the two-line
`internal_matches` could not build"), and has since `410a461`, 2026-08-10. So
the entry and the code have pointed at each other for six days, one saying the
thing is missing and the other saying it is the thing. Measured: `realise()`
returns true verdicts at line distances 1, 2 and 3 on a four-line fixture.
**Missing (the narrowed claim):** not the graph — the DECLARATION of which
window a caller is reading. `lyric_harness.internal_matches` takes at most two
texts and `rhyme_density` calls it only on `lines[idx]`/`lines[idx + 1]`
(`lyric_harness.py:3116`), so that layer is distance <= 1 structurally while
`relations.py` is ~~stanza-wide~~ **SONG-wide**; neither site says so. Two
answers to one question with no declared coordinate between them (doctrine 1).
Status is `PARTIAL`, not `CLOSED`: the capability landed, the coordinate did
not.
~~**Verified 2026-08-16** against `quality/relations.py` and
`lyric_harness.py:2925,2990`.~~

> **REPINNED 2026-08-21, THREE CORRECTIONS, AND THE NARROWED CLAIM SURVIVES
> ALL THREE — it gets wider, not weaker.**
> 1. **`stanza-wide` is the wrong word and it UNDERSTATES the gap.**
>    `REGISTRY['internal rhyme'].figure.frame` is `'song'`, and measured across
>    a blank-line stanza break the schema returns 22 instances of which **8
>    cross the break** (distances `{0: 13, 1: 1, 3: 1, 4: 7}`). So the two
>    windows are `<= 1` against **the whole song**, not against a stanza.
> 2. **THIS ENTRY DRIFTED ITS OWN CITATIONS, WHICH IS THE DEFECT IT IS ABOUT.**
>    `lyric_harness.py:2925,2990` were correct on 2026-08-16 and are not now —
>    `:2925` is inside a chain-report dict and `:2990` is a removed-API comment
>    block. The live sites are **`:3049`** (`def internal_matches`) and
>    **`:3116`** (`rhyme_density`'s `text_b=lines[idx + 1]`). A line number into
>    a file under edit is an offset from a moving origin, exactly as the Welsh
>    paragraph in `CLAUDE.md` records for `data/sources.tsv`.
> 3. **"TWO WINDOWS" UNDERCOUNTS: THERE IS A THIRD, ON THE SAME FUNCTION.**
>    `internal_matches(..., max_window=3)` caps the SPAN IN SYLLABLES — a
>    second undeclared coordinate wearing the same word "window" as the
>    line-distance one, in one signature. One name, two axes (doctrine 1),
>    which is this entry's own subject one level in.
>
> The close is still small and is still a declaration rather than a capability:
> a `window=` coordinate on `internal_matches`/`rhyme_density` and a frame
> statement in the `internal rhyme` schema note. It would be the first test to
> name E-3, moving it CITED → GUARDED.

### E-4 · No rhyme density over time `OPEN`
**Missing:** rhyme rate per bar, acceleration into a hook, thinning in a
bridge — rhyme as a rhythmic parameter rather than a per-pair verdict.

### E-5 · The empty/empty coda gift `OPEN` — sized 2026-08-21: the fix has a cheap half and an expensive half, and they are different claims
**Now (verified by using it):** `now ~ why` scores 0.902 and types RHYME,
because two vowel-final words get a free 1.0 on the coda channel. The fitted
matrix takes this to −0.000 and is not shipped.

**SIZED 2026-08-21.** Still live, re-verified (`0.5×0.805 + 0.35×1.0 +
0.15×1.0 = 0.902`). Two sites, two different questions: the EVIDENCE side
(`cluster_sim` returns 1.0 for two empty clusters, `lyric_harness.py:1998`,
weighted 0.35 — the gift) and the AGREEMENT side (`coda_agrees` on
empty/empty, `:2198` — CORRECT, it is what keeps `see`/`free` a rhyme, a
quarter of the sonnets' mandated pairs). They are separable, which is the
opening. A third copy of the scalar rule sits in `redteam_band.py:177-178`.
**The cheap half (~1.5–2 h): refusal-shaped disclosure** — when both codas
are empty, report the channel as cannot-tell (`coda: no evidence`) and leave
`total` and `relation` untouched; the band, the FPR calibration, `test_fwer`
and the sonnet rate all stay exactly where they are, and the 0.902 becomes
READABLE (0.35 of it visibly unsupported) instead of silent. **The expensive
half (8–12 h, M-4a-class): actually moving the scalar** — any change to
`total` moves `admits()`, and M-4a records what the last band move did to the
time layer; it drags `test_fwer` ×4, `redteam_band`'s FPR, `eval_matrix` P3
and the D18 claim pinned at 0.902. Closing this entry means the expensive
half; the cheap half only makes the gift visible.

**DECISION 2026-08-21 (owner): the cheap half is DEFERRED, deliberately.**
The disclosure does not close the entry, would be partly reworked when the
scalar moves, and touching the scoring path twice costs more than once. This
entry waits for a sitting with room for the expensive half done properly —
the M-4a-class change with the full recalibration — rather than accreting a
stopgap. Recorded so the next reader knows the cheap half was seen, priced
and declined, not missed.

---

## F. Language coverage

### F-1 · ~~Eight~~ NINE phonologies, and English IS one now `PARTIAL`
**TESTED WHILE OPEN.** The phonology suites name this entry as the ROSTER
they are counting against; the roster grows and the entry stays PARTIAL
until it stops (`quality/triage.py`).
~~**Now:** `cym fas fin ltc msa non san som`. English runs on the old CMUdict
path and is not a declared module.~~
**The English half is CLOSED, 2026-08-11.** `quality/phonology/` holds **nine**
modules — `cym eng fas fin ltc msa non san som` — and `eng.py` was added in
commit `c74fb48`, *"declare English as the ninth phonology"*. The title of this
entry was false for as long as it took nobody to re-read it. The rest of the
entry stands: the gap is the other thirty-odd languages below.
**Missing (non-exhaustive):** Spanish, Portuguese, French, Italian, German,
Dutch, Russian, Polish, Czech, Serbo-Croatian, Greek, Romanian, Hungarian,
Turkish, Arabic, Hebrew, Yiddish, Hindi/Urdu, Punjabi, Bengali, Tamil, Telugu,
Japanese, Korean, Mandarin, Cantonese, Vietnamese, Thai, Indonesian, Tagalog,
Yoruba, Swahili, Zulu, Amharic, Irish, Scots Gaelic, Quechua, Nahuatl.

### F-2 · Whole rhyme MECHANISMS are unrepresented `OPEN`
**TESTED WHILE OPEN.** `test_declared_inputs.py` pins the ABSENT field —
"closing R6 means adding the field, which is ordinary scheduled work" —
so the test tracks the gap rather than guarding a fix (`quality/triage.py`).
**Missing:** tone-contour rhyme (Cantonese, Vietnamese, Thai, Yoruba,
Mandarin); pitch accent (Japanese, Norwegian, Swedish, Serbo-Croatian); vowel
harmony (Turkish, Finnish, Hungarian) as a rhyme constraint; consonant mutation
(Celtic); root-and-pattern morphology (Semitic), where shared consonantal root
changes what rhyme even means.

### F-3 · Dialect orthography is a per-dialect SYSTEM, not a spelling quirk `OPEN`
**Found in the corpus 2026-08-10, and it contradicts what is already built.**
Three English dialects in the staged song corpus use the apostrophe and hyphen
for four different jobs, and the existing modules would corrupt three of them:

- **Lancashire (Waugh):** final-consonant elision on function words — `o'`=of,
  `an'`=and, `wi'`=with, `th'`=the. But `i'th` and `o'th` are **one token with
  one apostrophe standing for TWO elisions**; splitting there invents a syllable.
- **Dorset (Barnes):** three jobs at once — *initial*-onset loss (`'ithin`,
  `'twer`, `'oman`), unlike Lancashire; final loss (`o'`, `an'`); and the
  a-prefix is a **HYPHEN, never an apostrophe** (`a-vallen`, `a-done`). A
  hyphen-splitting tokeniser destroys it — and `cym.py` DELETES internal
  hyphens while `fin.py` treats them as compound seams, so both are wrong here.
- **18th-c stage (Gay, D'Urfey):** `'d` for `-ed` is purely metrical — a
  syllable **deletion** mark, the OPPOSITE function from the dialect elisions,
  and the one case where the apostrophe changes the syllable count.

**Why it matters:** doctrine 65 records four behaviours for the apostrophe
across four languages. This is four more inside ENGLISH ALONE, and the count
is now high enough that per-language is too coarse — it has to be per-DIALECT,
declared, like everything else in `quality/phonology/`.

> **VERIFIED AND RE-SCOPED 2026-08-21. `OPEN` stands — nothing shipped that
> closes it — but the entry reads as "nothing exists" in one direction and
> understates the live defect in the other. It is TWO coordinates with
> DIFFERENT remedies (doctrine 44) and they should not be closed together.**
>
> **THE LIVE DEFECT: the two readers fail on the SAME staged line in OPPOSITE
> directions, and nothing discloses it.** Measured on one Barnes line —
>
> ```
> relations.tokenise : ['The','greäve','wer','wide','my','Jeäne','an',
>                       'a-vallen','o','the','sky',"i'th",'hall','ithin','twer']
> lyric_harness.line_tokens : ['The','gre','ve','wer','wide','my','Je','ne',
>                       "an'",'a-vallen',"o'",'the','sky',"i'th'",'hall',
>                       "'ithin","'twer"]
> ```
>
> `relations.tokenise` KEEPS the diaeresis and DROPS every elision mark
> (`an'`→`an`, `o'`→`o`, `'ithin`→`ithin`, `'twer`→`twer`), erasing jobs (i)
> and (ii) above. `line_tokens` KEEPS all four marks and SHREDS the diaeresis
> into two fragments (`greäve` → `gre`, `ve`). **One file, two readers,
> opposite failures.** That is doctrine 1 on the same reader pair `F-4a` is
> filed against, and `F-4a`'s premise re-derives at head (**5,963 of the staged
> Barnes lines carry a non-ASCII letter**). `line_tokens` does normalise U+2019
> first (doctrine 26), so **the Lancashire half is safe and the Dorset half is
> not** — Waugh's curly apostrophes survive and Barnes's vowels do not.
>
> **THE DENOMINATOR THE ASK WAS MISSING**, over the staged Barnes, measured
> 2026-08-21 — and the patterns are given because the count is a coordinate of
> them, which is this entry's own subject: **8,008** final-elision tokens
> (`\b\w+'` before space or punctuation), **553** apheresis tokens
> (`(?<![\w'])'\w+`), **1,666** `a-` hyphen participles (`\ba-\w+`). An
> independent count under slightly different patterns returned 7,982 / 541 /
> 1,663 — a 0.3% disagreement about what a dialect mark IS, which is exactly
> the undeclared coordinate this entry names.
>
> **REPIN THE HEADLINE EXAMPLE.** `i'th` / `o'th` — the one-token-two-elisions
> case — is **1 line in Waugh and 13 in D'Urfey**. The double-elision example
> lives in the 18th-c STAGE file, not the Lancashire one this entry attributes
> it to.
>
> **THE DECLARATION IS ALREADY WRITTEN AND IS READ BY NOTHING.** All three
> dialect files carry a `# orthography:` header, and Barnes's spells out all
> three apostrophe jobs verbatim, including *"A tokeniser that treats hyphen as
> a word break destroys it."* **No `.py` in the tree reads `orthography:`**,
> and `data/song_regions.tsv` has one English row (`english`) that Barnes,
> Waugh and Gay all declare — **there is no dialect axis at all**. The seam
> exists: `build_stream(tokeniser=)` is injectable and no caller anywhere
> passes a dialect tokeniser.
>
> **AND THE PHONOLOGY HALF IS BUILT AND PROVABLY INERT**, which is the
> direction the entry understates. `relations.ALT_SURFACES` carries `poet`,
> `Stream.provides('poet')` has its branch, and the `dialect rhyme` schema
> fires on love/prove against a fixture dialect stream. `test_relations.py`
> states the blocker in its own words — *"the blocker is a SOURCED dialect
> phonology, and this repo has none"* — and `declared_inputs.PeriodPhonology`
> (R2) is the declared carrier, requiring period + reconstruction + source.
> **So ORTHOGRAPHY is a BUILD with a seam already in place, and PHONOLOGY is a
> built mechanism blocked on an OBTAINABLE source.** Two remedies, one entry.
>
> **DO NOT CLOSE THIS BY WIDENING `line_tokens`** — that is `F-4a`'s job and it
> costs the `song_endword_en.tsv` / `song_rhymepair_en.tsv` repins. The
> orthography half belongs behind `build_stream(tokeniser=)`, where
> `relations.py` imports nothing from `lyric_harness` (P10) and no shipped
> table is derived, so the blast radius is zero.

### F-5 · An EDITION can retokenise a language `OPEN`
**Verified 2026-08-10.** Rogers's 1855 *Modern Scottish Minstrel* sets a SPACE
before enclitics — `There 's high and low`, `Wha 'll buy caller herrin'` — 189
times in Nairne and 81 in Hogg, against **13 in all 17,555 lines of Burns**.
Same language, same register, opposite tokenisation, and the only cause is
which compositor set the type. It inflates a line's word count by up to 25%,
the same defect class as counting a bare hyphen as a word.
`lyric_harness.join_spaced_enclitics()` re-attaches a CLOSED set, each of which
must be the whole token, so Dorset apheresis (`'ithin`, `'twer`) and Scots
elision (`a'`, `o'`) are untouched. **Still open:** nothing detects WHICH
convention an edition uses, so a corpus mixing both is silently inconsistent.

### F-6 · The best PD source can be the one that loses the metadata `OPEN`
**Verified 2026-08-10.** Moore's *Irish Melodies* were written to named airs.
Gutenberg's own Moore (PG 8187) carries all 124 lyrics and **drops every air**.
`thabz/Kalliope` carries 122 of 124 as `<subtitle>Air - X</subtitle>`. The
obvious source is the lossy one. But Kalliope is NOT uniform: its Scots Ramsay
substitutes the Danish **æ ligature for Scots `ae`** (`sae` → `sæ`), so Ramsay
is recorded CONTESTED and was not staged. Check per-file, never per-repository.

### F-4 · A transcription can invent a letter `OPEN` — the instance is closed, the guard is not
**Verified 2026-08-10, inside a single Gutenberg record.** Barnes exists as two
files: `21785.txt` (ASCII) flattens the a-diaeresis to the two-letter sequence
`ae`, printing `Greaeve` and `Feaeir` — **inventing a letter in every affected
word** — while `21785-8.txt` (ISO-8859-1) keeps the single character. The
Latin-1 file is staged and the reason is in its header. Doctrine 50 with the
sharpest instance yet: same text, same repository, same day, and one encoding
silently changes the phonology.

**THE INSTANCE IS FULLY CLOSED — verified again 2026-08-21.** The finding is
recorded in triplicate: `data/sources.tsv:113` (the parent row, with both
transcriptions named and "USE 21785-8.txt"), `data/sources.tsv:122` (the
staged row), and `corpus/song/eng_hall_william_barnes.txt:12-14` (the header
warning, in the file itself). The letter survives in the bytes — 3,058 staged
lines carry `ä`, and the file's only `Greaeve` is line 14, the warning quoting
the defect.

**WHAT KEEPS THIS OPEN: NOTHING GUARDS A RECURRENCE.** Measured 2026-08-21:
no check anywhere reads encodings — every `latin-1` in `quality/` is a file
OPEN, never a validator. `audit_corpus.py`'s Check F is exactly the right
mechanism and points the wrong way for English: Finnish declares
`"aeiouyäö"` (a stripped text moves the count), the English channel declares
plain `"aeiou"`, and flattening `ä`→`ae` RAISES the English vowel count. A
re-stage from the ASCII transcription that repinned its own md5 would pass
every existing check. **Owed:** a declared non-ASCII-letter count for the
`eng` channel (or a per-file orthography assertion) so the flattening drops a
number to zero and Check F goes red, plus a `check_data_rows` assertion that
a row declaring ISO-8859-1 stages bytes that are actually non-ASCII. ~2–4 h
including the eng-range repin.

**AND THE SAME DOCTRINE IS VIOLATED ONE LAYER DOWN, ON THIS VERY FILE — split
out as F-4a** because it is a different actor with a different blast radius.

### F-4a · The reader flattens the letter the transcription kept `OPEN`
Found 2026-08-21 while verifying F-4. Staging the Latin-1 Barnes preserved
`ä`; `lyric_harness.line_tokens` (`lyric_harness.py:1030`) matches
`[A-Za-z'\-]+`, so the non-ASCII letter BREAKS THE TOKEN:
`line_tokens('The greäve wer wide, my Jeäne')` →
`['The', 'gre', 've', 'wer', 'wide', 'my', 'Je', 'ne']` — measured, at head.
Over the staged file: **5,934 of 13,909 verse lines contain a non-ASCII
letter; 1,515 carry it in the FINAL word**, the rhyme position, where the
harness then scores the fragment (`n ~ n` reports `1.0 RHYME`).
`quality/build_song_frequency.py:71-79` already names this as a declared
`accent_refusal` — and that disclosure lives in a BUILDER'S DOCSTRING and in
no register entry, which is how it stayed invisible: F-4 celebrated keeping
the letter while the tokenizer flattened it downstream, the same doctrine-50
failure with the reader as the actor. **Not a regex change, a COORDINATE
change:** `data/song_endword_en.tsv` and `data/song_rhymepair_en.tsv` were
derived under the current tokenization (doctrine 91), and `fit.py` mirrors
it, so widening the word class repins both tables and everything calibrated
on them. ~1 day including the repins, and it should not be started casually.

---

## G. Syllable and prosodic fit

### G-1 · No syllable-to-beat mapping `OPEN`
**TESTED WHILE OPEN.** `test_fit.py` asserts that the `NO_SETTING` REFUSAL
names G-1 and is PERMANENT. What is under test is the DISCLOSURE of the
gap, which is exactly what an open entry should have (`quality/triage.py`).
**Now:** a `Line` has a duration in beats and no idea how many syllables it
holds.
**Missing:** syllable placement on the grid, therefore any check that a line
fits, is crammed, or leaves the bar empty.

### G-2 · ~~No prosodic fit~~ — the METRIC half is delivered; melodic, vowel-length and the rest are the residue `PARTIAL`
**Missing:** whether lyric stress agrees with melodic/metric accent, whether a
long vowel sits on a long note, whether a phrase breathes, whether a word is
broken across a rest. This is the thing that makes a lyric singable and
~~nothing here touches it.~~

> **REPINNED `OPEN` → `PARTIAL` 2026-08-21, AND THIS IS A SHARPER `D-1` THAN
> `D-1` WAS: `quality/fit.py` CITES THIS ENTRY TWICE IN ITS OWN TEXT** — once
> in its module docstring (`:14`) and once in its refusal table (`:2075`) —
> so the module knew and the register did not, which is the whole shape of the
> CITED bucket `quality/triage.py` files it under. `lyric_harness.py:6141`
> names it too. The closing sentence is FALSE at head: `fit.py` exports
> **15 `ANSWERABLE` rows and 7 `UNANSWERABLE` rows**, and its findings are
> folded into the same set rhyme findings live in, so `SLOTS_EXCEEDED` is a
> hard flag ON THE REVISION LOOP.
>
> Clause by clause, because the four are in four different states:
>
> | clause | at head |
> |---|---|
> | stress agrees with **metric** accent | **DELIVERED** — five codes: `PROMINENCE_EXCEEDS_HEADS` (unconditional pigeonhole), `HEADS_EXCEED_UNITS`, `PROMINENCE_CANNOT_ALIGN` (the maximum over every order-preserving setting a declared `Subdivision` permits), `PROMINENCE_OFF_HEAD` (declared `BeatGrid`), `EVEN_DIVISION_LANDINGS` (declared `Isochrony`) |
> | stress agrees with **melodic** accent | open, and **not this entry's** — there is no tune to accent, which is `B-1` |
> | a long vowel on a long note | open and **blocked on `F-2`**, said so by the module: the note-VALUE half is already exact (`_frac_value_name`); the vowel-length half needs `Syllable` to carry length |
> | whether a phrase breathes / a word broken across a rest | open, **PERMANENT without a declared setting** — `fit.py`'s own row says melisma and rest *"IS the setting, and it comes from notation, not from text"* |
>
> **AND THE CALIBRATED PROMINENCE BAND [2, 7] IS NOT OPT-IN** — it runs on
> every `inspect()` with no blueprint declared at all. So the first clause is
> reaching drafts that never asked for meter.
>
> **THE BOUNDARY THIS LAYER IS BUILT ON, recorded so the entry stops implying
> otherwise:** every verdict here is a function of the DECLARATION (doctrine
> 4), never of a performance. **"Singable" is not a claim this layer will ever
> make**, and the residue is 3 clauses of which 2 are blocked on another
> entry's coordinate rather than on work this entry names.

### G-3 · Meter templates are unconnected to the bar grid `PARTIAL`
**Now:** `lyric_harness.py meter TEMPLATE` checks a stress template on text.
It has no relationship to `quality/grid.py`.

---

## H. Semantics and craft

### H-1 · Nothing measures meaning on the WRITING path `OPEN`
**TESTED WHILE OPEN.** `quality/phrase_commonplace.py` is the PHRASE SLICE
of this entry and carries its own suite, which names H-1 as its subject. A
part delivery with tests is not the entry closing — the concreteness half
still reaches the discriminator and not the writing path
(`quality/triage.py`).
**CORRECTED 2026-08-10 — the original entry was WRONG.** `concreteness.txt` IS
used: `quality/features.py` computes `concreteness_mean` and
`concreteness_p90`, and `quality/discriminate.py` consumes them. The true and
narrower claim: concreteness reaches the DISCRIMINATOR and never reaches the
writing path. The slop floor's own checks are MATTR, function-word ratio,
anaphora, line-length CV and predictable pairs — concreteness is not among
them, and neither is anything else semantic.
**Missing:** imagery and concreteness, specificity, metaphor and conceit,
point of view, tense, narrative movement, the turn/volta/reveal, register and
diction consistency, showing vs telling, cliché at the PHRASE level rather than
the rhyme-pair level.

### H-2 · The pembayang/maksud property is unmeasured `OPEN`
**Missing:** the Malay pantun carries rhyme ACROSS a deliberate semantic break.
We found the property, quoted Skeat's own footnote describing it, extracted ~~82
quatrains~~ — and never measured the discontinuity, which is the interesting part.

> **REPINNED 2026-08-21. `OPEN` is right and the entry reads as "nothing to
> build on", which is false twice over — there are TWO hooks, at different
> layers, and one of them is fenced BY A TEST.**
>
> **THE POPULATION WAS THE WRONG ONE.** `82` is `data/sources.tsv`'s
> *permissive extraction* figure (737 segments → 82 exact ABAB), not the staged
> file. `corpus/song/msa_skeat_pantun.txt` holds **129 `--- TITLE:` blocks over
> 1,357 lines, of which 126 are exactly four sung lines and 3 are three** —
> re-derived through `audit_corpus._items`, the corpus reader. Naming the file
> rather than the extraction is what makes the number re-derivable, and 126 is
> the denominator any statistic here reports over.
>
> **HOOK 1 — the split is already exposed, and deliberately fenced.**
> `msa.abab()` returns `{"pembayang": lines[:2], "maksud": lines[2:], "pairs",
> "confirmed", "syllables"}`, under its own module prohibition: *"This module
> makes no semantic measurement and must not be extended to make one."*
> `quality/test_phon_msa.py` §13 **pins the fence** — *"no semantic field is
> offered"* asserts the absence of `meaning`/`semantic`/`similarity`/`topic`
> keys. So the halves are handed over and the measurement must live OUTSIDE
> `msa.py`; that is a design decision already taken, not an obstacle.
>
> **HOOK 2 — `relations.py`'s `sense` capability exists at the WRONG GRAIN.**
> The `pantun ABAB` schema declares the rhyme and says the discontinuity is
> *"a sense-channel MUST-DIFFER this schema cannot state without a sense
> resource"*. Unlike the `poet` precedent, `sense` is **not branchless**:
> `Stream.provides('sense')` has its branch and `IdentityRule("sense", DIFFER)`
> is already used by antanaclasis. What is missing is the grain — sense lives
> on the per-TOKEN identity axis and this property is about two HALVES. There
> is no span-pair semantic distance and no sense channel reader.
> `declared_inputs.SenseAnnotation` (R3) demands a named inventory, annotator
> and source, and no Malay sense inventory exists here. **That route is the
> expensive one and is not what this entry is waiting on.**
>
> **THE CHEAP MEASUREMENT NEEDS NO SENSE RESOURCE AND IS BUILDABLE TODAY.**
> Lexical overlap between the two halves under msa's own tokeniser, reported as
> a distribution over the 126 quatrains, against a null that **re-pairs halves
> across quatrains** — the same doctrine-14 shape `audit_kalevala_null.py` and
> `audit_band_control.py` already use. **That null controls the function-word
> floor automatically, which is why no Malay stopword list is needed**, and
> that is the decision to write down rather than discover twice (`N-3` is what
> an unrecorded Malay function-word list costs).
>
> **STATE THE CONFOUND BEFORE ANYONE RUNS IT:** lines 1&3 and 2&4 are
> **rhyme-bound**, so their end words are not independent of each other. The
> statistic excludes end words, or reports with and without as two counts that
> are never summed (doctrine 79).
>
> **AND THIS WOULD BE THE msa CELL'S FIRST RESULT** — there is no
> `RESULTS_MSA*.md` and no rate script, while cym / fin / kalevala / hafez /
> prasa / tang each ship a `*_rate.py --check` beside an `audit_*_null.py`. The
> templates are in-tree. Preregister first, per the house pattern, and declare
> in the registration what it cannot claim: Skeat's fn.[431] is the only
> attestation, the source's own caveat is that this is charm verse *using* the
> form rather than a curated anthology, n=126 is small, and **a null is a
> result** (doctrines 20/31) — said before the run so it cannot be read as a
> failure after it.

### H-3 · No structural cliché beyond the grid `PARTIAL`
**Now:** `stanza_lock()` names ~~five~~ **six** grid clichés. That is the only
structural cliché detector.
**Re-derived 2026-08-11 by walking the AST of `quality/grid.py`** rather than by
reading the prose: `METER_LOCKED`, `SECTION_LENGTH_LOCKED`, `QUATRAIN_LOCK`,
`DOWNBEAT_LOCKED`, `UNIFORM_ANACRUSIS`, `PHRASE_LENGTH_LOCKED`.
`UNIFORM_ANACRUSIS` was added when clearing `DOWNBEAT_LOCKED` turned out to be
achievable by giving every second line one constant pickup — doctrine 24, the
rule RELABELS the second shape of the defect instead of widening the first.
**And `five` was not simply stale: the two numbers count different things.**
`DOWNBEAT_LOCKED` and `UNIFORM_ANACRUSIS` sit in one `if`/`elif`, so **six are
NAMED and at most five can FIRE on any one song** — which is what
`quality/test_grid.py` pins (`len(stanza_lock(cliche_song())) == 5`). Doctrine
91: the count is a coordinate of the question. Say which one is being asked.
**Missing:** clichéd section orders, clichéd hook placement, the exhausted
verse-chorus-bridge sequence, clichéd rhyme-scheme choice itself.

---

## I. Generation and workflow

### I-1 · ~~Nothing generates~~ — the harness does not WRITE, and that is a DECISION `PARTIAL` 2026-08-21
**Now:** `quality/revise.py` returns line-scoped briefs; the harness grades.
~~**Missing:** any writing loop, melody-first or lyric-first workflow, or way to
sample a structure from the scheme/grid spaces and write into it.~~

**VERIFIED 2026-08-21: two of the three clauses shipped, and the headline is a
category error.** *Any writing loop* exists — `quality/loop.py`'s
`revise_loop(..., propose=, propose_pair=)`, driven from the CLI by
`--propose=stub|replay:PATH|defer:PATH|call:MODULE:FACTORY`, with
`quality/propose.py` as the prompt renderer. *A way to sample a structure and
write into it* exists end to end — `quality/plan.py`'s `make_plan` →
`writer_brief` → `fill_plan` → `render_song`, with a CLI verb and
`quality/test_plan.py` pinning the round trip.

**What is left in the middle is the WORDS, and they are outside this tree on
purpose.** `CLAUDE.md`'s first page ("It never writes for you", "The model
proposes; these tools grade"), standing rule 2's PLAN → WRITE → REVISE, and
standing rule 3's NO PRIVATE INSTRUMENTS all put them there; `plan.py`'s own
docstring says "It writes NO WORDS: the writer is outside the harness" and
`propose.py` says "NO network code, NO API client". **A gap-register entry for
a stated design decision is a category error**, and this one has invited a
session to fix a thing the rules forbid for eleven days.

The accurate sentence is not *the harness writes* — it is **the harness plans,
grades, and drives a writing loop whose writer is external**. This entry stays
PARTIAL on exactly one surviving clause: **melody-first**. Nothing in the tree
can take a tune as input, because there is no pitch or tune object at all
(B-1, re-verified absent 2026-08-21). "Nothing generates" was true of the tree
and false of the SYSTEM from the day `plan.py` v2 landed.

### I-2 · No way to sample the space under constraints `PARTIAL` 2026-08-21 — the SAMPLER shipped; the PREDICATE is ruled on hold
**Missing:** "give me an 11-line scheme with 3 sounds, no adjacencies, at least
2 section-crossings, and no name" — the spaces are enumerable and there is no
constrained sampler over them.

**VERIFIED 2026-08-21. The sampler half is closed and the entry's own example
is the case it was built for.** `quality/plan.py` samples exact-uniform by
derivation — `_rgs_uniform` over Bell-triangle completion counts,
`_composition_uniform`, `_sample_meter` — held to their enumerations by
`quality/test_plan.py` §4 (exact-uniform at n=7, Bell(4)=15) and pinned by an
AST check that `plan.py` reads no corpus and opens no file. Constraint
conditioning EXISTS: rejection sampling over the generated grammar,
conditioned on a declared `ENVELOPE`, on an exact `--lines=N`, and on "at
least one mandated pair", with refusals that name the envelope. And
**`EXACT_ENUM_MAX = 10`**, so this entry's *11*-line scheme is precisely the
case that goes to the Bell sampler with its pool size disclosed — "large
stanzas are not banned by arithmetic".

**Still missing, and much narrower: the PREDICATE.** Every coordinate the
example asks to constrain on is already computed — `schemes.SchemeCoordinates`
carries `n_sounds`, `adjacencies`, `crossings`, `nestings`,
`section_crossing`, and `identify()` returning `None` is already a call the
layer makes. What no request can carry is a FILTER over them: `make_plan`
takes `seed`, `form`, `lines`, and the CLI takes the same.

**And this is neither doctrine 44's "hard to build" nor doctrine 92's "cannot
obtain" — it is RULED ON HOLD, by name.** `CLAUDE.md`: *"The seed-sweep
instrument (looping `make_plan` with filters to find a shape) stays manual for
now BY THE OWNER'S PENDING RULING, and is named here so it cannot become a
quiet fourth instrument."* Recorded here so a later session does not build it
as a favour: shipping it silently violates standing rule 3.

---

## J. Integration

### J-1 · ~~Codex Musica is not connected~~ — connected 2026-08-18, one client, two DISJOINT families `CLOSED` 2026-08-21
~~**Missing:** the MCP server (2,503 traditions, 1,406 instruments, 741 prefaces)
is in the same workspace and the harness has never called it.~~ **The
connection that shipped is the one standing rule 1 permits, and it runs the
other way: the CONNECTOR calls the HARNESS.** `mcp/lyric_tools.js` (landed
2026-08-18) registers five tools — `lyric_screen`, `lyric_plan`, `lyric_grade`,
`lyric_check`, `lyric_types` — each a subprocess-per-call over
`lyric_harness.py` with zero shared state, contract-pinned by
`scripts/check_connector_contract.js`'s allowlist and exercised live in CI
(`Install connector dependencies` plus a step that stages the harness so
`mcp/test.mjs` can drive real `python3`).

**"The recording and the words are being designed in separate universes" is
RETAINED — as the RULE it turned out to be, not as the gap it was filed as.**
That is standing rule 1: *THE RECIPE ENGINE AND THE LYRICS DO NOT TOUCH.
EVER … A session that proposes connecting them is repeating a mistake the
owner has had to correct multiple times.* So this entry spent eleven days
inviting exactly the mistake the rules forbid, in the register whose job is to
know what is missing. The two families reach one client and still do not
touch — proven at the import graph, not merely in prose: `mcp/lyric_tools.js`
imports node stdlib and zod and nothing from the recipe engine.

**One live consequence carried forward rather than deleted:** the wrap's first
field failure was doctrine 48 AT THE CONNECTOR — 43 banned pairs presented as
finished — fixed by mechanical disclosure (`banned_pairs`, the server-written
`[GRADED — seed N …]` stamp), all connector-side.

**A mechanical caveat for whoever edits this entry.** `verify_entries.py`'s
`PATH_RE` matches only `py|md|tsv|txt|json` and its ROOT is `lyric-harness/`,
so `mcp/lyric_tools.js`, `mcp/test.mjs` and `.github/workflows/ci.yml` are
invisible to `REPO_PATH_EXISTS` — no false red, but no check either. Never
spell a sibling-tree path with a `.py`/`.md` extension here or the entry goes
FALSE against a tree that does not contain it.

---

## K. Corpora and evidence

### K-1 · There is no SONG corpus `PARTIAL` — closed at 143 files; the 1,297-file corpus has never been audited under this entry
**Was:** Shakespeare's sonnets and Whitman. Neither is a song.

> **REPINNED 2026-08-21, AND THE HEADLINE WAS THE WORD `Now`.** Everything in
> the block below is a claim about the tree at `06857f8` (2026-08-10) and
> re-derives there exactly — commit-pinning did its job and nothing here is
> withdrawn. What was false is calling it the corpus: three mass loads have
> run since, and **this entry's own named-airs paragraph, further down, already
> measures the 1,297-file tree** while this one describes a 143-file one, with
> no sentence telling a reader which is which.
>
> **LIVE, at HEAD:** `corpus/song/eng_*.txt` is **1,297 files / 8,667 songs /
> 283,515 sung lines**, with **2,467 marked repeat blocks (1,580 BURDEN, 597
> REFRAIN, 290 CHORUS)**. The sung-line count is a coordinate of the reader and
> is stated as `lyric_harness.is_apparatus_line`'s — the one predicate every
> verb shares — because a hand-spelled filter gives 283,717 over the same files
> and the two are not the same question (doctrine 58's rule half).
>
> **AND THE DIRECTION OF THE DRIFT IS THE FINDING, not the size of it.** Songs
> rose **+73.6%** (4,993 → 8,667) and sung lines **+84.7%**, while marked
> repeat blocks moved **2,443 → 2,467, +1.0%** — and inside that total BURDEN
> *fell* (1,592 → 1,580) and REFRAIN *fell* (604 → 597), with only CHORUS
> rising (247 → 290). Three mass loads added some 3,700 songs and about a
> dozen net repeat blocks. **`K-1a`'s finding — that the printed record's
> chorus is concentrated rather than representative — got WORSE under the
> loads, not better**, and `K-1a` carries the current triple where this entry
> does not.

**At `06857f8`:** `corpus/song/` — **143 authors, ~~5,006~~ 4,993
songs, ~~154,346~~ 153,534 sung lines**,
with ~~2,454~~ 2,443 marked repeat blocks (1,592 BURDEN,
604 REFRAIN, 247 CHORUS) and ~~331 songs carrying a named
air~~ **318 songs carrying a named air** (see below).
Six parallel cells. Of **220** rows, **9 carry a later status** — 4
`COMPOSER_NOT_LYRICIST`, 3 `NOT_SOURCED`, 1 `CONTESTED`, 1
`JOINT_ATTRIBUTION_ONLY` — and the other 211
divide two ways: **141 of the 211 listed lyricists SOURCED, 70 NOT_FOUND** with
the exact queries recorded. ~~Five~~ **Six** statuses, 220 rows, and every count
stated.

> **EVERY SONG/LINE/BLOCK FIGURE ABOVE IS PINNED TO COMMIT `06857f8`**, and it
> has to be, because it moves under you: measured again twenty minutes later
> against an uncommitted working tree the same rule gave 4,930 songs / 152,313
> lines / 2,428 blocks, mid-edit by a live corpus cell. A commit-pinned number
> cannot go stale — it is a claim about a fixed tree and re-derives forever. A
> date-pinned one cannot even be checked. For the LIVE value run
> `python3 quality/counters.py`; `BACKLOG.md`'s counters table deliberately
> records no number for this row at all.
>
> **THE COUNTING RULE, WHICH IS THE PART THAT WAS MISSING.** `154,346` was
> recorded with no rule beside it and **reproduced under nothing**: a sweep of
> five plausible phrasings returned 154,351 / 154,339 / 154,191 / 154,179 /
> 154,339 and not one of them was 154,346. Nobody could tell whether it had
> drifted or had never been re-derivable — doctrine 58 at its purest, where the
> unwritten coordinate is the RULE rather than a threshold.
>
> Every figure in the paragraph above is now produced by ONE instrument with a
> stated rule, `quality/audit_register.py --slow` derivations D1/D2/D3, and is
> re-derivable in one command:
>
> ```
> python3 quality/counters.py     # row: corpus/song/eng_* — K-1's own quantities
> ```
>
> **The rule.** A SONG is a `--- TITLE:` line. A SUNG LINE is a non-blank line
> that does not begin `#`, `---` or `[`. A REPEAT BLOCK is a `[TAG` line with
> any trailing index stripped. The population is `corpus/song/eng_*.txt`,
> ~~143 files~~ **counted at run time — 1,297 today**. That strike is the
> repair, not a bookkeeping detail: `143` sat inside the RE-DERIVATION
> INSTRUCTION, so a reader following the rule as written got 1,297 and would
> conclude the rule had broken rather than that the corpus had grown.
> The counters row is VOLATILE by declaration — it carries no frozen
> number in `BACKLOG.md`, only the command — because these move whenever a
> corpus cell runs, which is exactly what happened below.
>
> **Why they moved, 2026-08-11 (commit `0e36b56`).** An attribution cell removed
> **819 duplicated lines**: nine poems of the 1798 *Lyrical Ballads* were staged
> under BOTH Coleridge and Wordsworth, split by a line-count cap standing in for
> an author rule, and one hymn under a joint Tate–Brady attribution was claimed
> solely by two files. `SOURCED` fell 142 → 141 and a sixth status,
> `JOINT_ATTRIBUTION_ONLY`, was added.
>
> **THE DIRECTION IS THE FINDING.** The corpus LOST 819 lines and the unreadable
> RATE went UP — 5.2677% → 5.2873% (`quality/test_readability.py`) — because only
> 6 of the 819 had an unreadable end word. **Every rate ever measured over this
> corpus was diluted by text that was in it twice.** A corpus that only grows is
> an assumption, not a property: `quality/test_song_function.py`'s repeat-block
> pins were written `>=` so a growing corpus could not break them, the corpus
> shrank, and they broke in the direction they were not built for. A bound that
> guards one direction is not a bound.

> **THE THIRD STATUS WAS MISSING AND THE SENTENCE INVITED AN ADDITION THAT DOES
> NOT CLOSE.** 142 + 70 = 212, not 220. Both figures are individually
> CONFIRMED against `data/lyricists.tsv` (220 `eng` rows: SOURCED 142,
> NOT_FOUND 70, COMPOSER_NOT_LYRICIST 4, NOT_SOURCED 3, CONTESTED 1 — sums to
> 220 exactly). Doctrine 79 at the sourcing layer: report three counts, never
> two, and where there are five report five. Check C4.

> **THE `331 NAMED AIRS` IS RE-DERIVED, AND THE RULE THAT PRODUCED IT IS THE
> FINDING.** 2026-08-11.
>
> **There is no `--- AIR:` field.** The markers `corpus/song/` actually declares
> are TITLE, SOURCE, AUTHOR, GE, RHYME, JU, SECTION, JUAN, RIME, SYLLABLES,
> FROM and NOTE. The air lives inside free-text TITLE strings.
>
> **~~331~~ 683 reproduces exactly, and it is a substring count.**
> RE-MEASURED 2026-08-21 over the loaded tree: across the 1,297 English
> files' 8,667 songs (~~143 files, 5,006 songs~~ on 2026-08-11), the
> number of TITLE strings containing the word `air`
> case-insensitively is **331** — the rule nobody wrote down. It counts *"The
> Birds Of The Air"*, *"Thrice toss these oaken ashes in the air"*, *"The
> Measureless Gulfs Of Air Are Full Of Thee"* and *"Divine providence in air,
> earth, and sea"* as songs carrying a named air.
>
> **318 is the figure the corpus supports.** That is the `[air: NAME]`
> convention — `HER HOME SHE IS LEAVING  [air: Mordelia]`,
> `KITTY REID'S HOUSE  [air: Country Bumpkin]` — and it is stable under two
> independent phrasings of the rule (`\[air:` and "air followed by a colon or
> dash" both give 318). `[tune: …]` gives 0.
>
> **The 13-title residue is not clean either**, and saying so is the point: 9
> are ordinary uses of the noun, and 4 name an air under a DIFFERENT convention
> (`Air XXXI -- You'll think ere many Days ensue`, `Air XXXVI -- Cease your
> Funning`, `GAELIC AIR`, `To The Air Of "Am Rhein, Am Rhein!"`). So there is no
> single mechanical rule that is right, which is exactly what a declared field
> would fix. **Until `--- AIR:` exists, neither this figure nor M-11's "ZERO
> across 8,009 non-English songs" is re-derivable, and the rarest field in the
> corpus is the one field the corpus does not declare.**
**Still missing:** the Tin Pan Alley generation (Dresser, Cannon, Dacre, Lamb,
Cole, Lawlor, Weatherly...) and the eight music-hall names — a
**scanned-broadside problem, not a rights problem**. Every one is out of
copyright and lives on archive.org / Wikisource / LoC / Levy / Bodleian, all
egress-blocked. Also unmined and already on disk: ~250 further Scots
songwriters in Rogers's *Modern Scottish Minstrel*, ~86 unclaimed
refrain-bearing hymns in the Otterbein Hymnal, and all fourteen Gilbert &
Sullivan libretti in GITenberg 808 with ~349 machine-separable number headings.

### K-1a · The printed record is BIASED AGAINST the chorus `OPEN` — sized 2026-08-21, and the concentration is WORSE than recorded
**SIZED 2026-08-21 (re-measured under the shipped rule).** Corpus totals:
BURDEN 1,580 / REFRAIN 597 / CHORUS 290 over `eng_*` — and **one file,
D'Urfey's songbook, is 567 of the 1,580 burdens (35.9%); two files are
52.4%; only 101 of 1,297 files carry any repeat block at all.** The entry's
"686 from one anthology" understates today's concentration. **No source-type
coordinate exists** (`sources.tsv` has no such column; `corpus_taxonomy.py`
has REGION and FUNCTION only, though 5 of the 9 FUNCTION evidence rules are
already worded in source-type terms, and the filename cohort prefix would
seed ~90% mechanically). **Smallest honest fix (~2–3 h): print the
concentration beside the total** — `_d_repeat_blocks` returns the top-3
contributing files with shares, `counters.py` renders them APPENDED after
the parsed substring (both consuming regexes survive), and the number
becomes un-quotable without its stratification, which is what this entry
asks for. **The full fix — a declared `source_type` third axis with its own
TSV and evidence rules — is a VOCABULARY DECISION and those are the owner's**
(`mark_coverage.py` records the precedent); 12–20 h once the vocabulary is
named, and it should not start before then.
**Found 2026-08-10 and it is a property of the sources, not the extraction.**
19th-century anthology editors set lyrics as continuous stanzas and drop the
chorus; songsters and hymnals keep it. So refrain density in this corpus is a
measure of EDITORIAL PRACTICE as much as of the songs — 686 burdens from one
Elizabethan songbook anthology against 8 chorus blocks across 45 American
anthology-sourced files. Any rate computed over the whole corpus without
stratifying by source type will be reading the editor.
**Corroborating notation finding:** `etc.` is used exactly as `&c.` is — a
verbatim-repeat pointer (`CHORUS. Who's now the traitor? etc.`). Two cells
found it independently in different centuries and countries.

### K-2 · ~~English is single-author on BOTH sides~~ — both halves retired `CLOSED`
**Was:** positive = Shakespeare alone; negative = Whitman alone.
~~**Now:** the positive side spans **143 authors across 16 rhyme traditions**, 1567 to
1929. The NEGATIVE side is still Whitman alone, and K-3 shows it never
separated — so the replacement remains the corpus's own shuffled self.~~

**CLOSED 2026-08-21, AND THE TITLE WAS FALSE ON BOTH HALVES.**
- **The positive side** is **1,295 distinct author slugs over 1,297 files** (two
  authors appear in two cohorts each), not 143. The arm as re-derived
  2026-08-21 draws **4,217 quatrains from 712 files across 9 tradition groups**
  in 15 distinct schemes. The *16 rhyme traditions* figure is still exactly 16
  and is still true — it is `data/lyricists.tsv`'s `tradition` column — but it
  is **not the axis the arm strata on**, which is the 9 filename cohorts
  (hbv 258, celtic 256, pah 233, american 208, oxford 194, british 95, hymn 34,
  parlour 12, hall 7). One number, two axes (doctrine 1).
- **The negative side is not a text any more.** `quality/negative_control.py`
  landed 2026-08-11 (`3e0b806`) and its FIRST LINE reads *"THE REPLACEMENT
  NEGATIVE CONTROL. MISSING.md K-2 / K-3."* The negative is
  `line_permutation` over the positive corpus's own quatrains — matched by
  construction — and Whitman is retained as an explicitly LEGACY comparator.
  "still Whitman alone" was ten days stale relative to a file that names this
  entry in its opening sentence.

**AND `BACKLOG.md` §3.5 SAID SO IN WRITING BEFORE THIS ENTRY DID.** That half
reads `CLOSED 2026-08-21`, is tagged `K-2, K-3`, and states *"the positive is
multi-author, drawn from 1,297 `eng_*` files"* — so the two halves of the
register held opposite facts about one file. That is the defect `K-6` documents
about itself and `M-21` names as a class: **the BACKLOG half closed and the
MISSING half was never told.**

**THE INSTRUMENT ITSELF CARRIED THE SAME SPLIT AND IS REPAIRED IN THIS COMMIT.**
`negative_control.py`'s docstring §2 said *"143 files, one author each"* while
its own `THE RUN` block 65 lines below said 712 files over 9 groups. The
"one author each" half was true only by filename convention — **exactly 5 of
the 1,297 English files carry a `--- AUTHOR:` line at all** — so the docstring
asserted a per-file property 1,292 of those files do not state. (Said
positively on purpose: `CORPUS_MARKER_ABSENT` reads *"no `--- X:` marker"* as
a claim that the marker is unused ANYWHERE under `corpus/song/`, which is a
different question and is false here — 10,616 occurrences, nearly all `ltc_`.
A per-file fraction has to be spelled as one.)

**WHAT SURVIVES BELONGS TO K-3, and is moved there:** `corpus/whitman.txt` is
structurally impoverished — "O Captain! My Captain!" carries the "Fallen cold
and dead" burden closing every stanza and our file records no refrain marking
at all. That is a fact about Whitman, and Whitman is K-3's subject.

### K-3 · The Whitman negative control does not separate `OPEN`
**Now (verified):** all four recorded Whitman figures (18.0, 20.0, 21.3, 26.0%)
fall inside one line-permutation null spanning 6.7–27.3%. Replacement is the
corpus's own shuffled self, plus a multi-author positive spanning more than one
scheme — BUILT, and it is `quality/negative_control.py` (2026-08-11).
**The sub-gap moved here from K-2 when that entry closed, 2026-08-21**, because
it is a fact about Whitman rather than about the control's authorship:
`corpus/whitman.txt` is itself structurally impoverished — "O Captain! My
Captain!" carries the "Fallen cold and dead" burden closing every stanza and
our file records no refrain marking at all. **This entry stays OPEN as a
FINDING and not as a task** — the replacement was built; what does not go away
is that the text this project used as its negative control carries the property
under test.

### K-4 · Old Norse has a phonology and ~~no licensed corpus~~ ~~ONE licensed corpus nobody has ruled on~~ **the ruling was made and the corpus is staged** `PARTIAL`
**Constraint:** the only complete Háttatal is inside a 1974 editor's copyright;
the 1848 edition that clears the gate has OCR that destroyed the consonants a
hending detector reads. **That is doctrine 92 and it is true OF HÁTTATAL.**

> **RETITLED 2026-08-21 — THE OUTCOME SURVIVES AND THE NAMED CAUSE DOES NOT.**
> `BLOCKED` is right: `corpus/song/non_*.txt` is **0 files, 0 songs**, confirmed
> today, and `data/lyricists.tsv` holds 25 `non` rows every one of which is
> `PENDING_TEXT`. What is false is *no licensed corpus*. **A PD-affirmed,
> verse-marked-up, ALREADY-MEASURED Old Norse source sits in this repo's own
> known-good table**: `data/CHANNELS.md` lists `sveinbjornt/sagadb.org` — BSD
> for the CODE, with *"a separate README sentence affirms the TEXTS public
> domain"*. The BSD is a decoy covering Perl build scripts; the texts clear on
> an **express PD affirmation**, quoted verbatim in `data/sources.tsv` row 61:
> *"All saga source texts are in the public domain."* Machine-readable
> `<poetry>`/`<line>` markup, 8 `*.on.xml` = 160 poetry blocks / 1,228 verse
> lines.
>
> **AND THIS ENTRY'S OWN §6 ALREADY CONCEDED IT** — *"585 extracted dróttkvætt
> lines, already measured at 55.63% skothending against a null median of
> 30.72%. It is `contested=true` and awaiting a human call nobody has made."*
> A source that has already produced a separating measurement is not "no
> licensed corpus". The entry was contradicted by a paragraph inside itself.
>
> **SO THE BLOCKER IS AN UNMADE OWNER CALL, NOT A LICENCE**, and it is the one
> blocker here with a zero-search price. It has been waiting since 2026-08-11.
> The cltk rows corroborate the NARROW reading only: `cltk/non_texts`
> CC-BY-SA-3.0 covers the Perseus fornaldarsögur and **not** the Snorra-Edda
> beside it (doctrine 54), and `cltk/old_norse_texts_heimskringla` is
> byte-identical to it (md5 `c221b3761633838018e24ccf4e43e7fd`). **There is no
> licensed *Háttatal*. There is a licensed *hending corpus*.** Once the
> `contested=true` call is made, staging is ~2–4 h from the 8 `*.on.xml` with
> the metre separation `sources.tsv` already specifies — Egill's lausavísur are
> dróttkvætt; Höfuðlausn is runhent and Sonatorrek/Arinbjarnarkviða
> kviðuháttr, so neither carries hendings; all 42 `*.is.xml` are rejected for
> epenthetic `-ur`. **FOR THE OWNER**, alongside K-1a's `source_type` axis and
> K-6's status vocabulary.

> **VERIFIED BY EXECUTION 2026-08-11, and both halves reproduce exactly — but
> the entry named one blocker where there are three, stacked, and priced none
> of them.** Full working: `quality/RESULTS_NON_HATTATAL.md`. Runners under
> `scratchpad/cellAJ/`. Six rows appended to `data/sources.tsv`.
>
> **1 · It is NOT doctrine 44.** `quality/phonology/non.py` is 959 lines and
> complete — six syllables, stuðlar/höfuðstafr, skothending, aðalhending, the
> penultimate viðrhending, oddhending/hluthending, Snorri's málfylling list,
> moraic weight, and a tri-state that refuses on a merged vowel. 16 of 16
> hendingar on Snorri's two demonstration vísur. Nothing here is hard to build.
>
> **2 · For the CORPUS it is doctrine 92, and the arithmetic is now on the
> page.** P1 = clears the gate; P2 = 102 vísur with the channel intact.
>
> | witness | P1 | P2 | reachable |
> |---|:--:|:--:|:--:|
> | `cltk` pair (Guðni Jónsson d.1974, edns 1935–54) | ✗ (to 2044) | ✓ | ✓ |
> | Faulkes / VSNR | ✗ (express reservation, living) | ✓ | ✗ |
> | `latin-ocr` Arnamagnæan **1848** | **✓** | ✗ (**0** channel chars) | ✓ |
> | Finnur Jónsson (d. **1934**) | **✓** | ✓ | **✗** |
>
> **|P1 ∩ P2 ∩ reachable| = 0.** Strike the egress row and the set is
> non-empty — so the disjointness is contingent on the **channel map**, not on
> the world (doctrine 49). Re-probed 2026-08-11: `archive.org`,
> `is.wikisource.org`, `septentrionalia.net`, `skaldic.org`, `baekur.is` all
> `000`. Doctrine 51 still holds on the left column: the two `cltk` rows are
> ONE file, md5 `c221b3761633838018e24ccf4e43e7fd`, re-confirmed today by
> `python3 quality/audit_corpus.py --calibrate`.
>
> **3 · The wipe reproduces, and its CAUSE is recorded in the artifact.**
> 121 pages, **0** occurrences of `þ ð æ ǫ ø œ á é í ó ú ý` in the window and
> in all 746 pages, **3,474** Greek-block substitutions — `--calibrate` says
> `REDISCOVERED`, and `test_corpus_audit.py` passes. Nobody had opened the 746
> `.hocr` files beside them. Their header: `tesseract 3.04.00`, and over the
> window **`lang=lat` 21,926 words (94.05 %) and `lang=grc` 1,387 (5.95 %),
> total 23,313, and nothing else.** The book was OCR'd with a Latin-plus-Greek
> model and **no Norse model at all** — so the channel characters are not in
> either charset and *could not have been emitted*, and the Greek is the `grc`
> model firing on Old Norse. The scan is fine: word confidence **75.6** mean on
> the Norse verso against **81.3** on the Latin recto. Doctrine 45 committed by
> an OCR engine — the language is a declared coordinate and it was silently
> declared wrong. The damage is in the **recognition pass**, not the images.
>
> **4 · Route "repair the wipe" is DEAD, and now has a price.** Aligned against
> an independent witness (the REFUSED `cltk` text, used as a ruler and never as
> a repair): 707 of 905 verse lines. The fan-in kills it — 60 OCR images have a
> channel character in their pre-image and **16 also stand for themselves**.
> `b` ← `ð`×133, `b`×122, `ö`×80, `þ`×56, `ó`×27, `Þ`×10, so rewriting every
> `b` to its modal source **corrupts 316 characters to fix 133**. The wipe is
> many-to-one *into the ambient alphabet*; its image has no free symbol. The
> **Bayes-optimal** inverse, fitted on the answer key itself, reproduces
> **12.6 %** of verse lines, **50.8 %** of words and **63.6 %** of line-final
> words — a pair ceiling near 0.32, and an upper bound a real repair cannot
> reach. It could not ship in any case: fitted on Guðni Jónsson it is both a
> derivative of the refused edition and non-independent of what it would score
> (doctrine 13).
>
> **5 · The real unblock is on the SPEC axis, and doctrine 62 says that is
> worth more than corpus volume. The 1848 edition is BILINGUAL.** Old Norse on
> the verso, a facing Latin translation headed `CLAVIS METRICA` on the recto —
> and Latin uses none of the destroyed characters. Over the same 121 pages:
> **62 Latin pages** against 44 Norse, Greek substitutions **11.39 per 1,000
> characters against 40.05**, clean tokens **84.7 % against 67.2 %**. All NINE
> rules `non.py` implements are legible there, including the two doctrine 62
> exists for — skothending's `diversae sunt vocales, diversaeque literae
> initiales, sed in utraque voce eaedem consonantes vocalem excipiunt` and
> aðalhending's `literae vero initiales distinguunt voces`, which is
> *upphafstafir greina orðin* — plus the málfylling list as `particulis
> hypermetris, verbi caussa: ek, aut: en, er, at, í, á, of, af, um`. The book's
> own praefatio names the translator in its bytes (scan 0013, Sveinbjörn
> Egilsson, rector of the Reykjavík school). **So `non.py`'s rules no longer
> rest on an edition the gate refuses**, and the two witnesses are 87 years and
> one language apart with no shared bytes — doctrine 87: the point of
> corroboration was never agreement, it was independence.
>
> **6 · The corpus half is smaller than the title implies.** Doctrine 32: the
> corpus is defined by the property under test, and the property is the
> hending, not Háttatal. `sveinbjornt/sagadb.org` already carries an **express
> PD affirmation** over **585 extracted dróttkvætt lines**, already measured at
> 55.63 % skothending against a null median of 30.72 %. It is `contested=true`
> and **awaiting a human call nobody has made**. That decision, not a search,
> is the cheapest thing between this project and a staged
> `corpus/song/non_*.txt` — and `corpus/song/` still holds **zero** `non_`
> files, confirmed today.
>
> **THE RULING WAS MADE 2026-08-22 — ADMIT — AND THE CORPUS IS STAGED.**
> `(a)` below is done. `corpus/song/non_*.txt` is no longer zero: **seven
> files, 160 vísur, 1,228 verse lines**, the first Old Norse text this project
> has ever held. `quality/stage_sagadb.py` is the recipe and `--check`
> re-derives every file from the upstream XML.
>
> **THE PRIOR FIGURE DOES NOT SURVIVE AND THAT IS THE POINT.** §6 cites *585
> dróttkvætt lines already extracted*, naming a file under a dead session's
> scratchpad. The path is deliberately NOT written here as a repo path: it
> does not exist, and `verify_entries`' REPO_PATH_EXISTS reads a backticked
> path as an assertion that it DOES — it caught this paragraph's first draft,
> which is the register's own checker working on the sentence written to
> record that the file is missing. So a number this register
> has quoted for eleven days rested on a rule nobody can reproduce (standing
> rule 3: an improvised script used twice is a defect report). ~~585~~ is
> struck and NOT replaced by a new dróttkvætt count, because **the edition
> declares a metre for exactly two poems** — Egils saga ch. 60 *"Egill flutti
> Höfuðlausn"* (runhent) and ch. 78 *"Egill kveðr Sonatorrek ok
> Arinbjarnarkviðu"* (kviðuháttr), both named in its own chapter titles — and
> says nothing about the rest. The verse is visibly mixed: `eiriks_saga_rauda`
> block 3 is short-lined eddic, `graenlendinga_saga`'s single block is
> eight-syllable hrynhent. Calling the remainder dróttkvætt would be the
> staging inventing a coordinate the source does not carry (doctrine 45). The
> two named poems are split into their own files; every other staged file
> declares `# metre: UNDECLARED`, and the count is `non.py`'s to make and to
> REFUSE (doctrine 79).
>
> **AND THE RULING DOES NOT COVER EVERY MEMBER — a doctrine-40 finding of the
> staging, not of this entry.** The README affirms PD over a compilation whose
> eight `.on.xml` declare FOUR different upstreams, and one refutes the
> affirmation in its own bytes: `hrafnkels_saga_freysgoda.on.xml` carries
> `<orig_publication>From reading selections from An Introduction to Old Norse
> by E.V. Gordon and A.R. Taylor, second edition (Oxford University Press,
> 1956).</orig_publication>`. A.R. Taylor died 1985 — that member runs to
> 2055. **REFUSED by name, and the refusal is FREE: it carries 0 poetry
> blocks, measured.** `gunnlaugs_saga_ormstungu.on.xml` names NO upstream at
> all (empty `<sourcename>` and `<sourceurl>`) and is **181 of the 1,228 lines
> (14.7%)** — admitted under the ruling with the hole disclosed in its own
> staged header rather than smoothed over.
>
> **THE CHANNEL IS INTACT, MEASURED.** The 42 `*.is.xml` were refused for the
> epenthetic `-ur` that breaks the six-syllable line; the staged verse carries
> **114 classical `-r` nominatives and ZERO modernised `-ur`** (`maðr` 6,
> `sonr` 2, `konungr` 2, `Þórólfr` 1, `Egill` 103), against 1,534/0 in the
> prose it was cut from. `audit_corpus` check G notes six of the seven files
> and that is the check WORKING: its hits are legitimate classical forms that
> end in `-ir`/`-ur` (`fylkir`, `hilmir`, `bróður`, `faðir`), not epenthesis.
>
> **STILL OPEN, which is why this is `PARTIAL` and not closed:** the hending
> measurement has NOT been re-run against the staged text, so 55.63% / 30.72%
> remain the dead scratchpad's figures and are not quoted as live. `(b)` and
> `(c)` below are untouched, and there is still no licensed *Háttatal* — the
> title's original subject.

> **7 · ~~Still BLOCKED~~ (a) IS DONE; here is what would move the rest**, in cost order:
> (a) make the sagadb call; (b) get `archive.org` on the egress allowlist and
> **re-OCR scans 0610–0730 with an Icelandic model** — §3 says the images are
> intact; (c) name the edition behind `is.wikisource.org`'s Old Norse, reached
> this session through the HuggingFace MCP tools (a channel no earlier Norse
> search had used) and carrying **`ǫ`, `ø` and `œ`** — the unmerged classical
> orthography that **no text this project has ever held contains**, and the
> whole reason `non.py` needs a merged-vowel tri-state. Not staged: the dump
> names no edition, and the same 4,900-row file carries `Andvökur, úrval
> Sigurðar Nordals, 2. útgáfa 1980` four rows away, which is doctrine 40 at its
> sharpest — a CC-BY-SA-3.0 licence on a compilation that demonstrably mixes
> admissible and in-copyright editions.

### K-5 · Somali has no REACHABLE corpus `BLOCKED` (doctrine 44: cannot obtain)
**Retitled 2026-08-11 from "Somali can never have a corpus". "Never" is a
universal, it was tested, and it is FALSE — while the block itself survives,
reclassified.** Measured: `python3 quality/som_channel_audit.py`. Full working
in `quality/RESULTS_SOM_BLOCKER.md`; seven probe rows in `data/sources.tsv`.

**Which of the three blocker kinds (doctrine 44/92): `cannot obtain`.** Not
`hard to build` — `som.py` is built and is measured below to record both
channels the form constrains. Not `disjoint` — that was the hypothesis, it was
tested, and it failed.

**The doctrine 92 route was tested first, because it would have closed K-5
without any date argument. IT DOES NOT HOLD.** The gabay constrains exactly two
channels: **higaad** (one consonant fixed for the whole poem → word-initial
consonant identity) and **quantitative metre** (the grid is the mora → syllable
weight). Somali metre is keyed on **vowel length**, and the 1972 orthography
writes vowel length by DOUBLING — so the script records the constraint, and an
admissible text in it would be usable. Measured over all **4,620** (C)V(V)(C)
shapes `som.py`'s own inventory builds: 0 unreadable, vowel length 1 → moras
{1}, vowel length 2 → moras {2}, while has-coda and no-coda both give {1,2}.
Weight is a total function of vowel length and blind to the coda — the Somali
rule, wrong for Greek/Latin/Sanskrit/Arabic, and it existed only as the
expression `2 if len(nuc) == 2 else 1` until it was declared as `weight_rule`.
**Corollary that inverts this entry's own reading of the module:** `som.py`
refuses a stress grid (doctrine 35) and K-5 counted that as part of the
blockage. Prominence is in NEITHER constrained channel, so the refusal costs the
constraint **nothing** (doctrine 60). Somali is the one language here whose
pitch accent is irrelevant to its own form.

**So K-5 rests entirely on DATE and REACHABILITY — and the universal breaks on
an instance.** J. W. C. Kirk (b. 1878), *A grammar of the Somali language, with
examples in prose and verse*, Cambridge University Press, **1905** — a
Latin-script transcription of Somali VERSE published 26 years inside the cutoff
and 67 years before the 1972 orthography. "Every written gabay is a modern
transcription" is false. Doctrine 38's bind ("any text `som` can read was
written down in or after 1972") is a claim about the 1972 **script**, not about
Latin script, and does not carry the universal it was asked to carry.
**It is unreachable, and that is now the blocker.** Re-probed 2026-08-11:
`archive.org` (3 paths), `web.archive.org`, `openlibrary.org`,
`books.google.com`, `cambridge.org`, `hathitrust.org` — all curl `000`; the
proxy names it verbatim as `gateway answered 403 to CONNECT`. `WebFetch` on the
same hosts returns `EGRESS_BLOCKED`, reconfirming on a second date that the
block is per-host, not per-tool. **Two things stay unverified and they are the
whole risk:** whether the verse includes *gabay* rather than only
*geeraar*/*hees*, and **whether Kirk's transcription records vowel length and
the four pharyngeals** — the title page has not been seen and his death year was
not found, so only route 3 (publication ≤ 1931) is in play. Unblock route
(doctrine 85): one fetch of the `grammarofsomalil00kirkuoft` djvu text from any
host with egress, then the channel table, then the gate.

**What the channel table says a pre-1931 witness will do**, scoring recovery of
the 1972 value rather than legibility, because a shape can stay readable and
read WRONG: a **macron** notation keeps 440/880 higaad classes and **0/2310** of
the weight channel; a **diacritic** notation keeps 1530/2310 of weight and
**0/880** higaad classes — and those four are `c`, `x`, `q`, `kh`, four distinct
alliterating consonants in a language whose entire form is one fixed
alliterating consonant. Doctrine 53: the file will very likely be admissible for
higaad and refused for the mora grid.

**The arithmetic, recomputed — and it moves against Somali, not for it.**
The counts are **14 fail the DATE gate and 4 clear**, not 13 and 5.
`data/lyricists.tsv` computes `pd_expired` as `died + 70` (verified: across all
424 rows with both, the difference is exactly 70 and no other value occurs)
while `provenance.py` declares `term_years = 95`, which IS the 1931 cutoff.
Cilmi Boodheri (1900–1940) expires 2010 at life+70 and **2035** at the declared
term; his row is corrected to `REFUSED_DATE`. **Across all 551 ledger rows
exactly one flips between the two terms — 423 clear at 70, 422 at 95 — and it is
this one**, so the undeclared term is load-bearing in precisely the entry whose
count turns on it and nowhere else (doctrine 58).
**And this entry's stated REASON for the 13 was wrong and pointed the opposite
way from its own verdict.** It read: lives "recorded only as '19th–20th
century', whose upper bound is 1900+70 past the term". 1900+70 = **1970**, which
expired 56 years ago — the sentence as written *admits* the poets it refuses.
The rows apply doctrine 81 correctly: the END of a "19th–20th century" window is
**2000**, they say `life+70 = 2070 has not expired`, and 2070 is what refuses.
The prose had copied the bound of the OTHER Somali group — the three "19th
century" poets, correctly bounded at 1900 — onto the thirteen. Two bounds, one
sentence, the wrong one quoted; the enumeration was right and nobody added it
up. (Muuse Xaaji Ismaaciil Galaal, c. 1910–1980, does fail outright as stated:
1980+70 = 2050, and 1980+95 = 2075.)
**`BLOCKED_ORTHOGRAPHY` also names the wrong thing** and the note on the 4
surviving rows is corrected in place: the label names the date of the
TRANSCRIPTION, not a defect in the script.

**A defect found on the way, in `som.py`.** `higaad()` silently DROPS a word it
cannot read, so a text in a non-1972 notation yields a plausible low share
instead of a refusal — and it is a WRONG ANSWER, not a lost one. On six shape
lines carrying a perfect higaad on `g` by construction, a macron notation
reports **`higaad='x'` at share 50.0%** with 18 of 30 words read, where the
truth is `'g'` at 100.0%. Nothing raises and nothing returns None. Doctrine 79
inside a phonology: the orthography's miss was billed to the poet. Fixed
additively by `som.Somali.readability()`, so `higaad()`'s three return values
and `test_phonology.py` test 8 are untouched. This matters here specifically —
the moment a pre-1931 witness is reachable it will be in a pre-1972 notation.

**Probes recorded so the next session does not repeat them** (doctrine 39, seven
rows): the four GITenberg Somaliland holdings fetched and read (2.27 MB, **zero**
occurrences of gabay/gabei/gabai — Swayne 1895 describes the *gerara* minstrel
at length and renders every song as English prose paraphrase, which is doctrine
93's cleanest instance here); Hugging Face 50 Somali datasets, **zero literary**,
and `wikimedia/wikisource` carries 72 language editions with **no `so`**; GitHub
code search `gabei` → 45 hits, all wordlists; three modern Somali GitHub corpora
**refused on 12 × 404 for any licence file** — silence is not permission, and
modern web text besides. `SEARCH:somali-gabay-corpus` (2026-08-10) was re-probed
under doctrine 49 and **stands**; its argument is confirmed and its framing is
superseded.

**What the evidence supports, since "never" does not:** no admissible Somali
verse text is reachable *from this container*; one admissible-by-date candidate
is known to exist and to be digitised; and the only thing between this project
and testing it is an egress block, which doctrine 49 says is a claim about the
network at a moment rather than about the world.

### K-6 · ~~Eight non-English phonologies, ZERO songs~~ — **six of the eight now have song text; two still have none** `OPEN`
**TESTED WHILE OPEN.** `test_readability.py` names K-6 while asserting the
corpus is no longer monolingual — it tracks PROGRESS on the entry, and the
entry's own heading says two of the eight still have none
(`quality/triage.py`).
**Found 2026-08-10, while closing K-1.** K-1 built a song corpus and every one
of its 143 files is English. The eight phonology cells (cym fin fas ltc msa non
san som) between them hold **five** text files, across three languages —
`cym_alun_strict.txt`, `cym_twm_or_nant_cywydd.txt`, `fin_kalevala.txt`,
`fas_hafez.json`, `san_dcs_verse.txt` — and not one of them is a song. `ltc`,
`msa`, `non` and `som` have no text at all. So the corpus is saturated in one
corner and starved everywhere else, which is doctrine 8 arriving through the
back door: the only tradition we can measure a song against is the one
tradition.

> **`four` WAS WRONG AND THE ENUMERATION WAS RIGHT — check C7, and it is the
> smallest instance of this file's commonest defect.** Re-derived from
> `corpus/`: four of the five are `.txt` and one (`fas_hafez.json`) is JSON,
> which is presumably what "four **text** files" meant — but the sentence then
> names five, so the reader cannot tell whether the count or the list is the
> claim. Counted as corpus files it is 5; counted as `.txt` it is 4 and
> `fas_hafez.json` should not be in the list. `corpus/fas_hafez.LICENSE.txt` is
> a licence, not a corpus, and is excluded from both readings. Say the number
> the list supports.

> **REPINNED 2026-08-14 at `b560014`. `ZERO` IS NOT A NUMBER THAT DRIFTED — IT
> IS A CLAIM ABOUT A KIND OF FILE EXISTING AT ALL, AND SIX OF THE EIGHT CELLS
> NOW HAVE ONE.** A stale count is repinned; a claim of the form "there are
> none" is either true or structurally wrong, and this one understated the tree
> by **117 files**. `corpus/song/` holds **260** `.txt` files, **143** of them
> English and **117** not. The paragraph above is the 2026-08-10 reading and
> stays dated; nothing in it may be quoted forward.
>
> Re-derive, in this order:
>
> ```
> python3 quality/counters.py            # the `corpus/song/` row counts the tree at run time: 260 files
> ls corpus/song/*.txt | wc -l           # 260
> ls corpus/song/*.txt | grep -vc /eng_  # 117
> python3 quality/verify_entries.py      # STAGED_FILE_COUNT re-measures each bullet below
> ```
>
> - `ltc_` — **67 Middle Chinese files**, against the `no text at all` this
>   entry records.
> - `fas_` — **31 Persian files**, against one JSON at the corpus root.
> - `fin_` — **11 Finnish files**, against one root `.txt`.
> - `cym_` — **five Welsh files**, against two root `.txt`.
> - `san_` — **two Sanskrit files**, against one root `.txt`.
> - `msa_` — one Malay file, against the `no text at all` this entry records.
>   (This is the one row `STAGED_FILE_COUNT` cannot check: its pattern requires
>   a PLURAL — `files` or `texts` — so a count of one is invisible to it. Said
>   here rather than left as a gap in the checked set, and counted by the `ls`
>   above like every other row.)
> - `non_`, `som_` — **still zero, and they are now the only two.** Both are
>   BLOCKED for reasons this register already owns and neither is waiting on a
>   sourcing round: K-4 (Old Norse, doctrine 92 — the admissible and the
>   complete sources are disjoint) and K-5 (Somali, doctrine 44 — not
>   obtainable from this container).
>
> **So "`ltc`, `msa`, `non` and `som` have no text at all" retires for `ltc`
> and `msa` and stands for `non` and `som`**, and the entry's closing sentence
> — "the only tradition we can measure a song against is the one tradition" —
> is no longer true in any reading. Counted as SONGS by K-1's own rule (a song
> is a `--- TITLE:` line), the non-English side is **20,386** against English's
> **4,930**: the corpus is now saturated in the corner this entry says is
> starved. M-11 owns the per-prefix song counts — its table carries the five
> that are its own subject (9,857) and its prose carries `ltc_`'s 10,529 — and
> `CORPUS_TABLE_ROW` checks that table on every run, so the numbers are not
> restated here and there is one place to repin.
>
> **THREE INSTRUMENTS ALREADY DISAGREED WITH THIS ENTRY IN WRITING, AND TWO OF
> THEM CITE IT BY NAME WHILE STATING THE OPPOSITE FIGURE.**
> `quality/negative_control.py`'s `arm_langs` docstring: "which is
> `MISSING.md` K-6 ... `corpus/song/` holds 260 files under seven language
> prefixes". `quality/RESULTS_NULL_SHAPES.md` §4 quotes this entry's own
> sentence and answers it with the same 260. `quality/test_readability.py`
> asserts "the corpus is no longer monolingual, which is why the scope is now
> explicit" and prints `MISSING K-6` in the failure message. So the register
> was the LAST reader of the corpus to be told, and a cell briefed from this
> page rather than from those three would have taken the five files at
> `corpus/` for the whole non-English corpus — doctrine 48, an entry read as a
> briefing is an instrument, and this one was pointing at the wrong tree.

> **REPINNED 2026-08-21, AND THE SPLIT IN WHAT WENT STALE IS ITSELF THE
> RESULT.** Every figure this entry DELEGATED to M-11 reproduces **exactly**
> seven days later — cym 391, fin 962, fas 8,350, ltc 10,529, msa 129, san 25;
> the five-language subtotal 9,857; `ltc_` 10,529; the non-English total
> **20,386**; and the per-language file counts 67/31/11/5/2/1 = 117. Every
> figure this entry KEPT FOR ITSELF drifted: total files **260 → 1,414**, eng
> files **143 → 1,297**, English songs **4,930 → 8,667**. That is a result
> about repin discipline and not a bookkeeping slip — the `b560014` decision to
> delegate is why half of this entry is still true.
>
> **THE CLOSING RATIO FALLS AND THE CONCLUSION SURVIVES.** Non-English 20,386
> against English 4,930 was **4.13:1**; against 8,667 it is **2.35:1**. The
> corpus is still saturated in the corner this entry calls starved, but the
> entry's own evidence for it is 43% weaker, and it fell because English grew
> while the non-English side did not move by a single file. `non_` and `som_`
> are still zero and still the only two.

**Staged, not sourced:** ~~297~~ **331** non-English lyricists now carry rows in
`data/lyricists.tsv` with a `lang` column (added in the same commit; the 221
pre-existing rows are backfilled `eng`, which is the gap stated as data).
Author-gate outcome, **REPINNED 2026-08-21 — 4 of the 8 rows moved and the
three columns can no longer hold the answer**:

| lang | rows | SOURCED | SOURCED_BY_PUBLICATION | PENDING_TEXT | NOT_FOUND | other |
|---|---:|---:|---:|---:|---:|---|
| fas | 76 | 30 | 0 | 0 | 46 | — |
| ltc | 76 | 24 | 0 | 0 | 26 | 9 `REFUSED_EDITION`, 17 `FOUND_NOT_ON_LIST` |
| san | 62 | 2 | 0 | 0 | 60 | — |
| cym | 40 | 5 | 0 | 0 | 35 | — |
| fin | 26 | 9 | 12 | 0 | 4 | 1 `COMPOSER_NOT_LYRICIST` |
| non | 25 | 0 | 0 | 25 | 0 | — |
| som | 18 | 0 | 0 | 0 | 0 | 14 `REFUSED_DATE`, 4 `BLOCKED_ORTHOGRAPHY` |
| msa | 8 | 0 | 0 | 8 | 0 | — |

~~| fas | 76 | 0 | 0 | · | san | 62 | 0 | 0 | · | ltc | 59 | 0 | 0 | · |
cym | 35 | 0 | 0 | · | non | 25 | 0 | 0 | · | fin | 14 | 0 | 0 | ·
| som | 0 | 13 | 5 |~~ — the superseded `staged / refused / blocked` reading,
kept rather than deleted (doctrine 17). ltc 59 → 76, cym 35 → 40, fin 14 → 26,
and som's `13 refused / 5 blocked` is `14 REFUSED_DATE / 4 BLOCKED_ORTHOGRAPHY`.

**AND THE VOCABULARY IS THE REAL FINDING: THREE COLUMNS CANNOT HOLD NINE
STATUSES.** Four statuses the old table could not express have appeared —
`REFUSED_EDITION` 9, `FOUND_NOT_ON_LIST` 17, `SOURCED_BY_PUBLICATION` 12,
`BLOCKED_ORTHOGRAPHY` 4 — and `REFUSED_EDITION` vs `REFUSED_DATE` vs
`BLOCKED_ORTHOGRAPHY` are three different reasons that a `refused` column would
sum into one. **FOR THE OWNER**, alongside K-1a's `source_type` axis and K-4's
sagadb call: name the vocabulary before anyone rebuilds this table, because the
grouping IS the claim (doctrine 79).

**The author gate is the cheaper of the two gates and clearing it means little
here.** ~~Every row is `PENDING_TEXT`, never `SOURCED`~~ — **STRUCK
2026-08-21, and it is false in the direction that matters: 82 of the 331
non-English rows are now sourced** (70 `SOURCED` + 12
`SOURCED_BY_PUBLICATION`), across cym 5, fas 30, fin 21, ltc 24, san 2.
`PENDING_TEXT` survives for exactly **msa (8) and non (25)** — and the internal
check that makes this readable is that those are precisely the two cells with
no staged text and the two cells whose rows never advanced, while `som` is 0
`PENDING_TEXT` and 18 of 18 refused-or-blocked. The ARGUMENT below is untouched
by the strike and is why the entry stays open: for a 14th-century Welsh
cywydd or a Tang shi the author has been dead for six centuries and the binding
constraint is the EDITION (doctrine 38) — `provenance.py` keys admission on the
AUTHOR and models no transcription layer with its own date and rights. Doctrines
50/52/53 are the record of what an edition can do to a text that clears every
author check: a modernised orthography, a corrupt OCR, or a collapsed vowel
merger, each admissible for one predicate and biased toward the positive for
another.
**Where the bound is a guess, the row says so.** A life given as a floruit or a
century is bounded at the END of that window, not its middle, and `pd_route`
carries `d (century only; upper bound assumed)` rather than pretending to a
verified year. 18 rows across cym/som/san are on that footing.

> **RE-DERIVED 2026-08-11 from `data/lyricists.tsv`. The table above is dated
> and stays dated; ~~this is what it says today~~ — SUPERSEDED 2026-08-14, and
> every figure in this block is now the 2026-08-11 reading of commit `ebbd741`,
> kept under doctrine 17 and quotable only with that commit beside it. The
> block below is what the file says at `b560014`.**
>
> - **The staged population is 319, not 297.** Two languages moved: `ltc`
>   59 → **76** (17 of them `FOUND_NOT_ON_LIST`, the 10th-century Later Shu
>   court poets) and `cym` 35 → **40**. `fas` 76, `san` 62, `non` 25, `fin` 14,
>   `msa` 8 and Somali's 0 staged / 13 refused / 5 blocked are unchanged and
>   CONFIRMED exactly.
> - **"Every row is `PENDING_TEXT`, never `SOURCED`" NO LONGER HOLDS.** Of the
>   319 non-English rows, **33 are PENDING_TEXT and 47 are SOURCED**; the rest
>   are 174 NOT_FOUND, 29 REFUSED_EDITION, 17 FOUND_NOT_ON_LIST, 13
>   REFUSED_DATE, 5 BLOCKED_ORTHOGRAPHY, 1 COMPOSER_NOT_LYRICIST. The sourcing
>   round this entry was written to describe succeeded and the entry did not
>   follow. The non-English files now in `corpus/song/` are the same fact from
>   the other side, which also retires "`ltc`, `msa`, `non` and `som` have no
>   text at all" for `ltc`.
> - **The century-only bound has grown 3.8×:** 18 rows across cym/som/san →
>   **68 rows across six languages** (san 36, som 15, non 13, cym 2, fas 1,
>   msa 1). Doctrine 81's cost is that much larger than this entry records, and
>   it is still the correct direction for a ledger that is evidence rather than
>   an estimate.

> **REPINNED 2026-08-14 from `data/lyricists.tsv` at `b560014`. Command:**
>
> ```
> python3 -c "import csv,collections; r=[x for x in csv.DictReader(open('data/lyricists.tsv'),delimiter='\t') if x['lang']!='eng']; print(len(r)); print(collections.Counter(x['lang'] for x in r)); print(collections.Counter(x['status'] for x in r))"
> python3 quality/audit_register.py        # derivations D11 (Somali) and D12 (this table)
> ```
>
> - **The staged population is ~~319~~ 331**, and the 319 was already the
>   second value in this block. `fin` **14 → 26** joins the `ltc` 59 → 76 and
>   `cym` 35 → 40 recorded above; `fas` 76, `san` 62, `non` 25, `msa` 8 and
>   `som` 18 hold.
> - **"Somali's 0 staged / 13 refused / 5 blocked are unchanged and CONFIRMED
>   exactly" WAS ALREADY CONTRADICTED BY K-5 ON THIS PAGE WHEN IT WAS
>   WRITTEN.** Measured: **0 staged / 14 `REFUSED_DATE` / 4
>   `BLOCKED_ORTHOGRAPHY`**. K-5 states the same correction in its own prose —
>   "the counts are 14 fail the DATE gate and 4 clear, not 13 and 5", Cilmi
>   Boodheri's row moved because `provenance.py` declares a 95-year term where
>   the ledger computed `died + 70` — and `audit_register.py`'s D11 has been
>   printing MOVED `14 / 4` on every run since. A word like `CONFIRMED
>   exactly` is a measurement claim, not an emphasis, and it was the one figure
>   in the block that had not been re-measured at all.
> - **The status enumeration is not stale — IT IS A BROKEN PARTITION, and the
>   two defects hide each other exactly.** The sentence above reads as a
>   partition: 33 + 47 + 174 + 29 + 17 + 13 + 5 + 1 = 319, its own stated
>   population, closed. Today the same eight slots hold 33 + 70 + 171 + 9 + 17
>   + 14 + 4 + 1, and that **also sums to 319** — so a reader who checks the
>   arithmetic against the population this block states finds it closes, and
>   concludes the entry is sound. The population is **331**. The 12 rows in the
>   difference all carry a NINTH status the enumeration has no slot for:
>   **`SOURCED_BY_PUBLICATION` = 12**, all `fin`. A stale total and a missing
>   category are individually detectable; together they are not, and that is
>   the reason this is written up as a defect in the SENTENCE rather than as
>   eight fresher integers. It is `C4`'s finding at the non-English layer: K-1
>   quoted two statuses of five and invited an addition that did not close, and
>   `audit_register.py`'s `_chk_status_partition` was built for exactly that.
>   K-6 has no such check, and this is what its absence bought.
> - **`SOURCED_BY_PUBLICATION` IS NEW, IT IS NOT A RELABEL, AND IT IS DECLARED
>   NOWHERE.** It first appears at commit `debf64e` (2026-08-11), on **12 rows
>   that were added, not moved** — `fin` went 14 → 26 in the same commit and no
>   pre-existing row changed status. It occurs in `data/lyricists.tsv` and in
>   no other file in this repository — not in `quality/provenance.py`, not in
>   `quality/audit_register.py`, not in `quality/METHOD.md`, not in
>   `quality/LABELS.md`, not in `data/CHANNELS.md` — so there is no written
>   statement anywhere of what the status MEANS, and the only evidence for it
>   is the rows themselves.
> - **What the 12 rows say, read rather than guessed.** All 12 are `fin`, all
>   12 point at one file, `corpus/song/fin_wahanen_laulukirja.txt` (the
>   *Wähänen Laulu-kirja*, Turku 1864), and all 12 have **`born`, `died`,
>   `pd_route` and `pd_expired` EMPTY** — the only rows in the ledger that do.
>   Their notes record why: the 1864 printing gives pen-names (`Kallio`,
>   `Tuokko`), initials and surnames (`A. Oksanen`, `C. Helenius`), and in one
>   case an abbreviation with the surname suppressed (`J. G. D-n`), and the
>   rows exist so the abbreviation is recorded as an abbreviation and not
>   resolved to a guess. So the admission was decided on the BOOK, not on an
>   author life — the EDITION gate that doctrine 80 says is the binding one,
>   reached without the author gate having anything to work on. That is a
>   distinct provenance route and doctrine 24 is the rule for it: a status
>   that would otherwise be deleted into `SOURCED` must RELABEL instead, and
>   the test of the rule is whether the ledger can say MORE afterwards. It
>   can — "sourced, author unidentifiable, publication-dated" is a fact the
>   single `SOURCED` bucket cannot express. Under doctrine 79 the two are
>   reported apart and never summed: **70 `SOURCED` and 12
>   `SOURCED_BY_PUBLICATION`**, and "82 sourced" is a number this entry does
>   not state anywhere and must not.
> - **What is owed, and it is not a number.** The status vocabulary needs a
>   declared home — the nine names, what each asserts, and which gate decided
>   it — and `audit_register.py` needs a `_chk` that FAILS when the statuses
>   present in `data/lyricists.tsv` are not the statuses the entry enumerates.
>   Until then any ninth status added tomorrow is invisible in the same way.
> - **The century-only bound holds at 68**, six languages, san 36 / som 15 /
>   non 13 / cym 2 / fas 1 / msa 1 — CONFIRMED exactly at `b560014`, and it is
>   the only figure in the block above that re-derives unchanged.

---

## L. Known instrument defects

### L-1 · The false-event rate is not controlled at α `OPEN` — and it was never a rate
~~"5.4% against 5.0%" is n=6; at n=20 the same construction gives 9.6%. The
guarding test runs three sonnets and asserts only `mean < 0.20`.~~

**RESTATED 2026-08-11, one layer deeper. Both figures were computed at the
wrong family size, so neither 5.4% nor 9.6% is a false-EVENT rate at the
declared α.** `time_layer.rhyme_events` built each position's Šidák family from
the pairs that PASSED the rhyme band — median **6–13** — when the family of
comparisons actually MADE is **89 on a quatrain and 176–265 on a sonnet**
(`python3 quality/fwer_family.py`). `_pvalue` already divided by `n_valid`,
every valid chance draw including band failures, so the correction paired an
unconditional p with a conditional family and delivered a per-position error of
about `α / band_pass`. Rebuilt at the candidate family, the H0 rate over 20
word-scrambled sonnets is **0.0% with 16 of 20 items MUTE**, and a 0.0% that
comes from refusal is not an α — it is "nothing could have fired".

**The guarding test is fixed and the fix is worth recording as a method.** All
four `test_fwer.py` assertions pass again and not one by retuning a threshold to
a downstream result: each constant was replaced by the quantity it was standing
in for. Saturation by `1 − (1−r)^m` from the measured per-pair FPR; the α
tolerance by `α + 2 s.e.` pooled over 1,321 slot decisions (n=20, 6.2%, which
CAN detect the 2× miss doctrine 72 named); the 0.25 band-pass guard by 2× the
measured maximum over 30 real sonnets (0.042–0.076), so a fixture that clears it
is a result and not an input. **The cell explicitly declined to pick an `m`
between 6 and 89 that lands the scramble rate on 5%** — an α recovered by
choosing a family size is a threshold tuned to its own result.

~~**Still OPEN, and the open part has moved.** The layer cannot control α at the
honest family because it cannot produce an event at all: at
`null_samples = 2000` the Šidák cut on sonnet 1 is **2.53e-4** and the p-value
floor is **5.00e-4**, so the cut sits BELOW the floor. What is owed is
`null_samples` and `window`, measured against the candidate family.~~ See
`quality/RESULTS_FWER.md`.

**REPINNED 2026-08-21 — THE OWED MEASUREMENT WAS MADE ON 2026-08-11 AND THIS
ENTRY NEVER FOLLOWED IT.** `BACKLOG.md` §4.1 was repinned on 2026-08-17 and
this half was not, so the register carried the discharged and the undischarged
statement of the same fact side by side for four days.

`quality/time_attainable.py` is the runner and `quality/RESULTS_FWER.md`
§*THE LEVERS, MEASURED — and the layer cannot speak* is the write-up. **Six
levers, all dead**, and `null_samples` — the one this paragraph named — is dead
in the most instructive way: it **RUNS BACKWARDS**. `min_p` goes 3.998e-3 at
2,000 samples to 4.415e-3 at 200,000, so buying resolution makes the floor
worse rather than better. The others are `window`, `max_span`, more text, a
cross-item null (L-2's ask, delivered — see there), and a declared beat, which
reaches the range and is circular.

**And the struck diagnosis was wrong in an instructive way, which is why it is
struck rather than deleted (doctrine 17).** `min_p` is not sitting on a
resolution floor at all — it is reporting a RATE. `_pvalue` returns
`(ge + 1)/(n_valid + 1)`, and for the best pair in a real sonnet every one of
the 40–83 draws at or above it is an exact TIE at 1.000 with ZERO strictly
above: the comparator saturates at a perfect rhyme.

**WHAT KEEPS THIS ENTRY OPEN IS NOT A TASK.** The gap is arithmetic:
`M_NEEDED = ln(1-α)/ln(1-min_p)` is 18–28 against a median family of 198–217 —
a factor of about **10**, not the 1.4 the earlier reading suggested. Closing it
is a redesign of the layer, not a measurement. The BACKLOG half is CLOSED under
a `TASK DISCHARGED` declaration that `quality/verify_entries.py` now reads;
this half stays OPEN because the CAPABILITY — a false-event rate controlled at
α — is exactly as missing as it was.

### L-2 · Real sonnets do not separate from scrambled text on event rate `OPEN` — EXPLAINED
~~10.9% observed vs 9.6% word-scramble (p=0.095).~~ Either the detector is
broken or these sonnets carry no internal rhyme, and this event set cannot tell
them apart — so any null placement result on it is uninterpretable.

**AND THE MECHANISM IS NOW KNOWN, 2026-08-11, which turns this from a symptom
into a design error.** At 20 items per arm the two score **identically**: 29.1%
real against 29.0% scramble at `m` = scored, and 0.0% against 0.0% at `m` =
candidate (`python3 quality/fwer_family.py --arms`). They are identical because
**an item's smallest attainable p is set by how many chance re-pairings of ITS
OWN spans are perfect rhymes, and a word scramble preserves the span multiset
exactly** — so the scramble preserves the very quantity the statistic is a
function of. This is doctrine 63/68's identity-map trap in a fourth place: a
randomisation that can be run, look rigorous, and test nothing. The word
scramble was never a null for this statistic, and the 0.095 was reporting that
rather than reporting Shakespeare.
~~**Owed:** a null that destroys the span multiset — across items rather than
within one.~~

**REPINNED 2026-08-21 — THE OWED NULL WAS BUILT TWICE AND IT DOES NOT WORK,
which is a result and not a debt.** `BACKLOG.md` §4.2 carried the same stale
`Owed:` line and is now closed under a `TASK DISCHARGED` declaration.

`quality/controls.py:176 cross_item_redeal` is that null, with
`rime_pool_redeal:253` beside it as the detection floor, driven by
`quality/negative_control.py:631 arm_spans` whose docstring names this entry.
`quality/RESULTS_NULL_SHAPES.md` §3 measures it:

| arm | `band_pass` | `min_p` move |
|---|---:|---:|
| real verse | 0.0572 | — |
| word scramble | 0.0601 | 1.15× |
| **cross-item redeal** | **0.0599** | **0.94×** |

**The purpose-built null PRESERVES the quantity it was commissioned to
destroy**, over a detection floor spanning 51× (0.00059–0.03040) — so this is
not an instrument too blunt to see a difference, it is a difference that is not
there. `RESULTS_FWER.md`'s Lever 5 agrees from the other side: pooled
perfect-pair rate 0.0028 → 0.00175, `M_NEEDED` 21 → 28, a **1.3× improvement
against a 9.4× gap**, and at window 2 the scramble saturates HIGHER than real
verse (3.15% vs 2.68%) — the sign flips.

**WHAT KEEPS THIS ENTRY OPEN IS THE FINDING, NOT A TASK.** Real sonnets still
do not separate from scrambled text on event rate, all six measured levers are
dead (L-1), and closing this needs a null that moves the perfect-pair rate by
about 10× — a redesign of the layer, a declared beat, not a backlog item.
Guarded by `quality/test_controls.py` and `quality/test_null_shapes.py`.

### L-3 · The slop floor is calibrated on one form, one language, one generator
`PARTIAL` — 152 Shakespeare sonnets vs 40 model sonnets, a 400-year register
gap. Its own docstring calls it unvalidated as a general slop detector.

### L-4 · ~~The floor has two length profiles and they are both stanzas~~ — THREE, and the third is a whole lyric sheet `CLOSED` 2026-08-21
~~"4-line quatrain, 29–37 tokens" and "14-line sonnet". Anything else is an
extrapolation and gets downgraded to a note.~~ The `song` profile landed
2026-08-11 (`quality/floor.py:630`) — whole lyric sheet, 150–400 tokens, 3,571
human items, tolerance 1.25 — so the premise that both profiles are stanzas is
false and the count is off by one. This is what shaped the demo song:
unchanged, and still true of the demo.

**WHAT WAS NEVER A GAP.** "Anything else is an extrapolation and gets
downgraded to a note" is not a defect, it is the DESIGN, stated in the module
(`quality/floor.py:498`, `:514`) and pinned by six checks in
`quality/test_floor.py` (`:209`, `:230`, `:350`, `:374`, `:388`). And it has
been PRICED: out-of-range CLICHE_PAIR fires at 14.74% against 6.35% in band —
2.3× — and that measurement is what forced `_relation_findings` through
`sev()` like every other flag (`quality/floor.py:198-215`). A recorded
limitation with a measured rate and a test that goes red is not an open entry.

**WHAT SURVIVES IS NARROWER AND IT IS NOT ABOUT LENGTH — re-filed as L-4a**
rather than left inside a headline about profile arithmetic.

**Three stale citations found with this one, all saying "two":**
`quality/floor.py:568` (a comment four lines above a three-element list),
`BACKLOG.md`'s Tier-5 row — the one section that is supposed to be
trustworthy about what does NOT exist — and `quality/FLOOR.md:39`'s
two-column profile table. All three repinned with this close.

### L-4a · The song profile has no generated class, so it carries a rate and no separation `OPEN`
Split from L-4's close, 2026-08-21, because it was buried in a headline about
profile arithmetic and it is not about length at all. `quality/floor.py`'s
`song` profile ships with `n_generated = 0`: what it has is a false-positive
rate on held-out human song text — the doctrine-22 statement of a threshold —
and NO AUC, and `evidence_for` (`quality/floor.py:546`) refuses to let a
caller borrow one (`quality/test_floor.py:436`, `:448` pin the refusal). So
the floor can say *this human text does not trip the slop checks* at a known
rate, and cannot say *the checks separate generated song lyrics from human
ones*, because no generated song class exists in this repository. What is
owed is a CORPUS, not a number — M-19's shape exactly. Until one exists this
entry is doctrine 44's "cannot obtain" for the property, with the floor's own
docstring (`quality/floor.py:124-131`) as the standing disclosure.

### L-5 · Doctrine has drifted toward auditing `CLOSED` 2026-08-11
~~`CLAUDE.md` carries 76 numbered items~~ ~~**102 numbered items, measured
2026-08-11**~~ — **95 doctrines**, and roughly the last 25 are about null
hypotheses and calibration. A future session reading it will learn to audit
rather than to write. **The stale number is this entry's own evidence, which
makes the point twice:** the drift L-5 names has continued while the figure that
measures it stood still. A split into a short WRITING doctrine and a long METHOD
appendix ~~is under way~~ **is DONE** in `CLAUDE.md` / `quality/METHOD.md`
(commit `d11ca0a`); the numbering stays global so `doctrine 79` is still
doctrine 79.

**And the 102 makes the point a third time, which is why it is corrected here
rather than quietly replaced.** `CLAUDE.md` carries TWO numbering systems that
do not collide — the doctrine run, and a `Known gaps` list cited elsewhere as
`known gap N`. Both are written `^\d+\. \*\*`, so a bare regex over the file
counts them together. **At commit `d11ca0a`, 2026-08-11**, that regex returned
**27** where the doctrine block held **20**, the gaps list ran **1–7**, and
27 + 75 = 102. Two independent runs added together as if they were one.
Measured by `python3 quality/verify_doctrines.py`, which reads only between
the `<!-- DOCTRINE-BLOCK -->` markers that exist for exactly this reason:

| | doctrines | `known gap N` |
|---|---:|---:|
| `CLAUDE.md` | 20 | ~~7~~ **10** |
| `quality/METHOD.md` | 75 | 0 |
| **total** | **95**, a contiguous run 1–95, nothing defined twice | ~~**7**, a separate run 1–7~~ **10**, a separate run 1–10 |

> **REPINNED 2026-08-14 at `b560014`: the gaps run is 1–10, the bare regex
> returns 30, and 30 + 75 = 105.** The `7` and the `1–7` above were correct on
> 2026-08-11 and are kept struck under doctrine 17; the `95` and the `20` and
> the `75` are unchanged and re-derive exactly. Superseded values, with the
> commit each was last true at:
>
> | measured at | date | gaps run | bare `^N. **` over `CLAUDE.md` | + 75 |
> |---|---|---:|---:|---:|
> | `d11ca0a` … `e85609a` | 2026-08-11 | 1–7 | 27 | 102 |
> | `4efc370` … `19d2f1e` | 2026-08-13 | 1–9 | 29 | 104 |
> | `d9f266d` … `b560014` | 2026-08-14 | **1–10** | **30** | **105** |
>
> ```
> grep -cE '^[0-9]+\. \*\*' CLAUDE.md            # 30
> grep -cE '^[0-9]+\. \*\*' quality/METHOD.md    # 75
> python3 quality/verify_doctrines.py            # "every `known gap N` resolves against CLAUDE.md's own 1-10 list"
> python3 quality/counters.py                    # doctrines row, evidence line: "1–10, 10 items … bare count is 30 = 20 + 10"
> ```
>
> **THIS IS THE ONE FIGURE ON THIS PAGE THAT `CLAUDE.md` HAD ALREADY REPINNED
> CORRECTLY, AND IT IS THE MODEL.** `CLAUDE.md`'s "Two numbering systems"
> paragraph carries the run as `1–10` with BOTH earlier repins named in place
> — 1–7 → 1–9 on 2026-08-13, 1–9 → 1–10 on 2026-08-14 — which is doctrine 17
> done properly, in the file this entry is about, for this exact number. The
> register printed `7`, undated and unstruck, as a present-tense measurement
> for a day after that. Copy the `CLAUDE.md` paragraph, not this one.

**The counter is now the record — for the 95, and NOT for the 7, which is the
whole of why this drifted again.** `python3 quality/counters.py --check` FAILS
if `BACKLOG.md`'s counters table disagrees with the measurement, and the
committed `doctrines` row states only the **95**. `counters.doctrines()` DOES
derive the gaps run live and has been printing `1–10, 10 items … bare count is
30` in its evidence line; `audit_register.py`'s D23 prints the same 30 in its
`measured:` line. **Neither is asserted, because only a row's VALUE and its
`measured by` cell are checked, and the evidence line is not a row.** So the
guard this paragraph claims — "this figure cannot go stale again without a red
test" — was true of the 95 and false of the 7, and the sentence asserting it
went stale in the same breath. That is the doctrine-48 move this entry was
itself an instance of, failing a second time in the same place: L-5 recorded
the drift of a number in prose, the prose drifted, the correction to the prose
drifted, and the instrument that could have caught it was printing the right
answer all along into a field nothing reads. **What is owed:** the gaps run
belongs in the committed counters table as its own row, so that `--check` goes
red on it.

---

## M. Instrument defects the non-English sourcing round found (2026-08-10)

Four cells were sent to turn 297 staged lyricist names into text. Three have
reported. Every one of them found a defect in the harness rather than only in
the world, which is the point of pointing a module at a corpus (doctrine 37).

### M-1 · `ltc.rhymes` uses the 詩 standard on 詞 and calls 45% of real ci rhymes failures `CLOSED`
**The single most actionable item in this section.** `quality/phonology/ltc.py`
ships the 平水韻 grouping, which is the standard for 詩. Measured against the
**欽定詞譜 of 1715** — 817 per-詞牌 files with a 韻/句/叶 marker at every line end,
i.e. the tradition's own spec (doctrine 62) — on 1,518 ci that match a 格
exactly across 119 詞牌: positions the spec marks 韻/叶 come back True **47.4%**
of the time (14,302 T / 15,887 F / 724 refused), against 4.0% at positions it
marks 句. The lift is real (+43.3 pp against 311-year-old ground truth) and the
miss rate is intolerable — **a ci cell using `rhymes()` as shipped will report
Li Qingzhao failing to rhyme.**
Relaxing tone barely helps: `(group,tone)` 47.4% → `(group,平/仄/入)` 52.7% →
`(group)` 54.1%, controls 4.0/5.0/6.4%. **Tabulating WHICH group pairs get False
at mandated positions recovers the 詞林正韻 partition from practice alone** —
the top 30 pairs are 魚/虞, 支/微/齊, 蕭/豪, 東/冬, 庚/青/蒸, 元/先/寒/刪, 眞/文,
and 上/去 within one group, and they carry 34% of ~~26,773~~ **a false-verdict
population this entry never named. `WITHDRAWN` 2026-08-11.**

> **The recorded denominator cannot be what the sentence says it is.** The entry
> says "False at **mandated positions**" and its own count of those is
> **15,887 F**; 26,773 exceeds that by **10,886**. A percentage whose
> denominator is larger than the population it claims to partition is the
> `384 + 300 > 471` shape pointed at one entry instead of two. Check C8.
>
> **What is re-derivable, and what is not.** The rest of M-1's arithmetic is
> sound and worth saying so: 14,302 / (14,302 + 15,887) = **47.37%**, and the
> 724 refusals are correctly excluded from the denominator — doctrine 79
> applied, in the entry that then broke it one sentence later. The only
> decomposition consistent with the entry's own counts is
> `15,887 mandated F + 10,886 control F = 26,773`, i.e. the mandated and 句
> control positions POOLED, which at the stated 4.0% control True rate implies
> ~11,340 control positions. **That is a reconstruction, not a measurement, and
> it cannot be checked: the 817 per-詞牌 files and the 1,518 matched ci are not
> on disk** (`data/qindingcipu_ge.tsv` holds 2,333 rows and nothing else of the
> run survives). `UNVERIFIABLE`, and the missing thing is named. Either quote
> the pooled population explicitly or quote 15,887 — the figure must not stand
> attached to a sentence that says "mandated".
>
> **Note on the check itself, so nobody reads its output as a pass.** With the
> claim withdrawn, `audit_register.py`'s C8 now reports `n/a` — *"M-1's verdict
> counts not found in their current form"* — because there is no longer a live
> "X% of N false verdicts" for it to test. That is an UNGUARDED entry, not a
> satisfied one. Restoring the claim with its population named would put the
> check back on it.
**Fix shape:** make the standard a declared coordinate,
`standard='pingshui'|'cilin'`, exactly the move `check_cynghanedd` made for
`language` (doctrine 45). Doctrine 36 was written about Qieyun → 平水韻 and it
is true one rung further in.

**CLOSED 2026-08-21 — the fix shape above is what shipped, and this entry was
the last place still calling it OPEN.** `MiddleChinese(standard=...)` accepts
`('qieyun','pingshui','cilin')`, `rhymes()` takes a per-call override, an
undeclared standard RAISES rather than defaulting, and a key names the standard
that produced it so two standards can never silently compare equal. All five
group pairs this entry named as recoverable from practice — 東/冬, 魚/虞,
支/微, 蕭/豪, 眞/文 — are False under `pingshui` and True under `cilin`.

**MEASURED ON A CORPUS THAT IS ACTUALLY ON DISK, which is the part this entry
could not do.** M-1's own 47.4% rests on 1,518 ci that were refused on an
express non-commercial grant, and the paragraphs above already record that the
run does not survive. The replication is on the admitted 花間集: 413 of 500
songs matching a 格 exactly across 60 詞牌, scored against the same 1715 spec.
**韻 78.4% → 94.0% (+15.6 pp) against a 句 control of 1.3% → 3.4% (+2.1 pp)**,
so the control gap widens 77.1 → 90.6 pp rather than everything lifting
together (doctrine 71). `python3 quality/test_ltc.py` §6 re-derives all four
rates and exits 0.

**The withdrawn 26,773 stays withdrawn and C8 stays `n/a`.** Closing this entry
does not restore that claim — the population it needed is still not on disk,
and an entry going CLOSED is not a licence to un-withdraw a number (doctrine
17). What is closed is the DEFECT, which was never the arithmetic.

### M-2 · `data/qieyun_mc.tsv` is keyed on ONE orthographic norm `CLOSED`
**CLOSED 2026-08-21, AND THE DECLARATION THAT STOOD HERE FOR TWO HOURS WAS
MINE AND WAS WRONG.** `quality/triage.py` flagged this entry CONTESTED —
open, and a regression names it — which is exactly the state it was in. It
was resolved by writing *"the entry as a whole stands"* WITHOUT READING THE
ENTRY. That is the failure the CONTESTED bucket exists to prevent, committed
by the same sitting that built the bucket. A declaration is only honest for
an entry someone has checked; otherwise it is a silencer with a date on it.

**MEASURED, every clause of this entry, 2026-08-21:**

| the entry says | today |
|---|---|
| 魂 cannot be looked up | reads, `via` **䰟** |
| 窗 absent, 窓/牕/窻 present | 窗 reads, `via` **窓** |
| 19 recoverable by an 異體字 map | **19 of 19 read** |
| 你 is vernacular, refusal correct | reads `via` **伱** — this entry's own falsified clause |
| nothing tells an ingestion defect from a correct refusal | `refusal()` returns the KIND |
| 諄/真/殷/桓/戈 name groups the data does not | authority moved to `data/ltc_rhyme_standards.tsv`, which agrees with the data |
| the docstring cites 193 rhymes | it cites 58 韻系 and says 193 was never the number in the file |

`data/qieyun_variants.tsv` is the mechanism and it does not touch the CC0
original: **7,258 rows — 810 RECOVERED** to a variant that is in the rime
book, **6,255 REFUSED with a declared kind** (後起 4,073, 簡化 2,181, 未載 1),
and **193 混同** which READ and carry a disclosed `hazard()`. The three
buckets are counted apart and reconcile to the row count exactly (doctrine
79). On the 19 arrows plus 你 and 來, `variants=True` reads **21 of 21** and
`variants=False` reads **1** — which is what the map buys, measured rather
than asserted.

**THE SHARPEST PART IS THE ONE THIS ENTRY ASKED FOR LAST.** *"Nothing
currently tells an ingestion defect from a correct refusal"* is answered in
TWO methods, not one, and the split is finer than the ask: `refusal()`
answers for a character that does NOT read (後起 = postdates the rime book,
correct; 簡化 = a simplified form, an ingestion defect), and `hazard()`
answers for one that DOES read but may be returning another word's rhyme.
**无, 云 and 丽 — the exact three this entry names as OpenCC's silent
failures — read, and each discloses its hazard** (无無, 云雲, 麗). The
loud half and the silent half of the OpenCC problem are separated,
mechanically.

**What is NOT closed by this and is not claimed:** the simplified-corpus
figures in this entry (70.95% against 99.03%, 31.7% of line-final positions
unreadable) were measured on a corpus that is not staged, and are not
re-derived here.
**魂 — the character that NAMES the 魂 rhyme group — cannot be looked up**, while
477 characters carry 魂 as their rhyme label. 窗 is absent; 窓/牕/窻 are present.
Of the 24 commonest unreadable characters in a real ci corpus, **19 are
recoverable by an 異體字 map to a variant already in the table**: 魂→䰟, 窗→窓,
匆→悤, 裙→帬, 劍→劒, 峰→峯, 群→羣, 閑→閒, 腮→顋, 鞍→鞌, 粧→妝, 裊→褭, 瀟→潚,
皓→晧, 胸→胷, 拆→坼, 儘→盡, 緲→渺, 敧→攲. The remaining five (怎 樣 褪 做 你)
are Song–Yuan **vernacular** characters postdating the rime book, where refusal
is CORRECT — and **nothing currently tells an ingestion defect from a correct
refusal**, which is doctrine 79 in a second layer.

> **`23` WAS WRONG AND IS CORRECTED TO 19, 2026-08-11 — and the correction was
> available from the prose alone.** 23 + 5 = 28 against a population of 24. The
> enumeration above was right all along (19 arrows + the remaining five = 24)
> and the summary integer in front of it was not; nobody added them up. This is
> the M-3/M-4 shape — `384 + 300 > 471` — one section EARLIER in the same file.
> `python3 quality/audit_register.py --consistency`, check C3. **It had
> propagated into doctrine 88**, which restates this sentence; the patch for
> that file is in `<scratch>/CLAUDE.patch.md`.
>
> **Re-derived rather than counted, because a count of arrows only checks the
> arithmetic.** Every one of the 19 was checked against `data/qieyun_mc.tsv`
> (19,499 characters): in **19 of 19** the source character is ABSENT from the
> table and the arrow's target is PRESENT, so each arrow is a real recovery and
> not a plausible-looking pair. All five of 怎 樣 褪 做 你 are absent, as the
> "correct refusal" reading requires. The ARGUMENT is untouched — it is
> strengthened, because it now rests on a checked map rather than on a listed
> one.
**Related, same file:** 諄, 真, 殷, 桓, 戈 appear in `ltc._GROUPS` and never in
the data file, which uses 眞/欣/寒/歌 — the grouping table was written against a
different naming convention than the data. And the table holds 58 rhyme labels
× 4 tones, the 廣韻 206 system by 韻系, not the 193 the docstring cites.
**Measured cost of getting the script wrong:** a SIMPLIFIED corpus reads at
70.95% against traditional's 99.03%, with **31.7% of line-final rhyme positions
unreadable**, failing on the commonest words (风 3,687 tokens, 来 2,327, 时 1,987,
楼 941). OpenCC is not the fix: 无, 云 and 丽 resolve because they were separate
Middle Chinese words, so the corpus fails loudly on some merges and **silently
returns a different word's rhyme** on the rest.

### M-3 · The Malay apostrophe rule — and the number that billed it `CLOSED` 2026-08-11
**The fix, one rule:** a part with no vowel is not a word, so it merges into the
part that FOLLOWS. `s'ri` → `sri`, `b'ras` → `bras`, `p'rut-'kau` → `prut`+`kau`.
`anak'nda` still splits, because `anak` is a well-formed Malay word alone. That
makes the two spellings of one pepet syncope agree — the module already accepted
`prang`, `Brapa`, `'Plam`.

**THIS ENTRY'S HEADLINE WAS WRONG BY 5×, and the correction is the finding.**
It billed **384 of 471** unreadable tokens to the apostrophe rule.

**POPULATION AND TOKENISATION, stated once so neither is substituted again
(doctrine 58, and the population is a coordinate too — M-18).** Every figure in
this entry is over **PG47873 (`47873-8.txt`, 1,422,204 B, 31,086 lines), which
is NOT in this repository** — it is on this machine at
`/workspace/mm47873/47873-8.txt`. **The selection rule's one authority is the
`selection:` header of `corpus/song/msa_skeat_pantun.txt` itself** (lines 54–66),
which states it in full. This entry used to name `scratch/src_msa/extract_pantun.py`
as the implementation beside it; that path is not in the repository and never
was — scratch is namespaced per cell and uncommitted (doctrine 77) — so it could
not be the authority for anything, and the same dangling reference is still in
the corpus file's own header, which belongs to a corpus cell. The rule: blocks
are maximal runs of lines
indented ≥ 4 (**705 blocks, 5,555 lines**), and a block is Malay where its Malay
function-word count strictly exceeds its English one (**330 blocks, 3,442
lines**). Tokens are maximal runs of `[A-Za-z'`’-]` that contain at least one
letter: **15,601**. `corpus/song/msa_skeat_pantun.txt` is a 129-block extract
cut from this, 513 verse lines, 2,113 tokens, and **no figure in this entry is
derivable from it.**

**RE-DERIVED 2026-08-11 and the table below is the measured one.** The version
this entry shipped is kept beneath it, because three of its numbers are exact
and the two that are not are the finding:

| class | before (`_merge_vowelless` off) | after (shipped `msa.py`) | layer |
|---|---:|---:|---|
| vowelless fragment FROM the apostrophe split | 79 | **1** | `msa.py` — the real defect |
| vowelless WHOLE token (`b` 101, `d` 100, `s` 99 — the `d. s. b.` stub, M-4) | 305 | 305 | ingestion, elsewhere |
| complex coda / complex medial | 87 | 88 | correct refusal |
| **total** | **471** (3.02%) | **394** (2.53%) | |

Three counts, never two (doctrine 79). Before: read 15,130 / refused 87 /
defective 384. After: read 15,207 / refused 88 / defective 306. Both sum to
15,601 exactly.

**AS SHIPPED, WITH THE VERDICT ON EACH CELL** (kept as a list rather than a
table, so the arithmetic checker reads one table in this entry and not two):

- ~~apostrophe fragment, before 76 / after 2~~ — measured **79 / 1**.
- vowelless whole token, before **305** / after ~~306~~ — the **305 is CONFIRMED
  exactly**; the 306 is the after-fix DEFECTIVE total written into a row that
  names a subset of it, which is why the shipped `after` column summed to 386
  against its own stated 384.
- ~~complex coda / complex medial, before 77 / after 78~~ — measured **87 / 88**.
- ~~total, before 458 / after 384~~ — the before total is **471, CONFIRMED
  exactly**; 384 is not an after-total at all (see below).

**WHAT `384` ACTUALLY IS, and this is the whole correction.** 384 is the
**before-fix count of vowelless tokens** — `by_code {'vowelless_token': 384,
'complex_medial': 55, 'complex_coda': 32}` — inside a before-fix unreadable
total of exactly **471**. So *"384 of 471"* is arithmetically CORRECT and was
never a false number; what was false is the ATTRIBUTION. Of those 384 vowelless
tokens the apostrophe split produced **79**; the other **305** are whole tokens
the rule never touched. The entry then carried 384 down into the `after` column,
where it belongs to nothing: the after-total is 394.

**The apostrophe rule owned 79 of 471 = 16.8%, not 82%**, and 16.6% was close
for the wrong reason. The earlier classifier keyed on *"this part has no vowel"*
rather than *"an apostrophe split produced it"*, so it charged `msa.py` for 305
tokens it never touched. `unreadable_reason()` makes the split machine-readable
so this cannot recur silently.

**WHAT DOES NOT RE-DERIVE, marked rather than restated.** This entry's stated
population is **3,415 lines / 15,519 tokens**; the corpus file's own header says
3,442 lines for the same 330 blocks, and measurement gives 3,442 / 15,601. The
gap is exactly **82 tokens, 10 of them refusals** — the entry's `read 15,135 /
refused 78` against a measured `15,207 / 88`, and 72 + 10 = 82. So M-3's
population is 82 tokens narrower than the rule the corpus file declares, under a
selection nobody wrote down; the likeliest candidate is English translation
lines dropped at the LINE level inside Malay-majority blocks (English words such
as `Hearts`, `Diamonds`, `Clubs`, `search` do appear in the measured refusals).
Seven line-level filters were swept and none lands on 3,415 or 15,519.
**UNVERIFIABLE, and the missing thing is named: a line-level filter, not a
threshold.** What survives untouched is `b` 101 / `d` 100 / `s` 99 — exact — and
the 305, the 471 and the 384, all three exact.

**TWO CELLS FOUND THE SAME ERROR FROM OPPOSITE SIDES, AND THE ARITHMETIC HAD
SAID SO ALL ALONG.** M-3 billed 384 of 471 to the apostrophe and M-4 billed 300
of the same 471 to `d. s. b.` — **384 + 300 = 684 > 471.** Two entries in one
section of one file could not both be true, and nobody added them up. The 305
vowelless whole tokens are the SAME tokens both entries were describing, and
each entry attributed them to whichever rule was under investigation at the
time. That is doctrine 79 one layer up, inside the documents written to record
doctrine 79.

**Doctrine 65's fifth apostrophe position is now enumerated** rather than
described: staged corpus initial 77, final 23, **after_hyphen 20**,
after_consonant 14, after_vowel 11, **0 unclassified** (143 after_hyphen in the
full population). Handled correctly since day one, because `_split_word` cuts
the hyphen first — the defect was only ever in the description.

**Known answers unmoved:** ABAB 80/82 `drop`, 82/82 `keep`; ~~`-ung` 0 and
`-uk` 0 against `-ong` 28 types and `-ok` 14/15~~ — see below.

**DOCTRINE 70's EVIDENTIARY FIGURE, RE-DERIVED WITH ITS RULE AND ITS POPULATION
STATED, 2026-08-11.** The figure had a different value in every place it
appeared — `CLAUDE.md` 14 and 12 "distinct types", this entry 28 types and
14/15, the corpus file's own header 25 and 24 "tokens" — and none of the three
was what you get by counting. Two of the three are now **recovered exactly**,
and the recovery is that each was a correctly-measured quantity wearing the
wrong label:

- **Rule, stated (doctrine 58).** A word ends in `-ong`/`-ok`/`-ung`/`-uk` when
  its final syllable's nucleus is `o`/`u` and its coda is `ng`/`k`, the vowel
  NOT preceded by another vowel. The vowel restriction is load-bearing:
  `gaung`, `pelaung`, `baung`, `bernaung`, `lauk` all end in the bare letter
  string and have the diphthong /au/ as their nucleus, which is a different
  vowel and not what doctrine 70 is about. Tokens are maximal runs of
  `[A-Za-z'`’-]`, lowercased, over verse lines only.
- **Over the staged file** (`corpus/song/msa_skeat_pantun.txt`, 513 verse lines,
  2,111 tokens): `-ong` **38 tokens / 26 types**, `-ok` **28 / 15**, `-ung`
  **0**, `-uk` **0**.
- **This entry's own "28 … 14/15" RECOVERED, and the labels were right.** Re-cut
  the same 513 lines with LETTERS ONLY — apostrophe and hyphen read as token
  breaks — and `-ong` is 41 tokens in **28 types**, `-ok` 30 tokens in **14
  types**. So M-3's 28 and 14 are correct, correctly labelled, and measured on a
  tokenisation this entry did not state; the "15" is the `-ok` type count under
  the *other* rule (apostrophe and hyphen kept inside the token: 28 tokens / 15
  types). **This entry quoted two tokenisations in one breath and named
  neither.** (First recovered by the owner of `quality/METHOD.md`; re-derived
  here independently and confirmed to the token. An earlier reconstruction of
  mine — that 28 was the `-ok` TOKEN count — is withdrawn: it fits the numbers
  and not the labels, and this one fits both.)
- **`CLAUDE.md`'s "14 and 12" — a rule that reproduces it, offered as a
  RECONSTRUCTION and not as recovered provenance.** Restrict to LINE-FINAL
  words, the rhyme position, and `-ong` gives **14 tokens / 12 types** — stable
  under both tokenisations above, with `-ok` at 0 line-final. That is the only
  rule found that yields a 14 beside a 12. If it is the rule, then "14 and 12
  distinct `-ong` and `-ok` types" was the token and type counts of `-ong`
  alone, relabelled as a pair of suffixes. **Nothing on disk says so**, and a
  rule invented to land on a recorded number is what doctrine 58 forbids — so
  this is reported as a candidate with its command, not as the answer.
- **The corpus header's "25 and 24 tokens" is `UNVERIFIABLE`.** Six
  tokenisations were swept — all tokens, letters-only, no-hyphen tokens, hyphen
  tail, hyphen head, unique-per-line — giving 38/28, 41/30, 35/26, 38/28, 38/28
  and 37/28. None lands on 25/24.

**AND THE ZEROS ARE A COORDINATE OF THE POPULATION, WHICH NOBODY CHECKED.** The
argument survives and the flat "zero" does not. Over PG47873's 330 Malay blocks
that the extract was cut from — this entry's own population — `-ung` is still
**0** but `-uk` is **2**: `teluk` and `bertepuk`, and the same file writes
`telok` elsewhere. Over all 705 verse blocks it is `-ung` 5 and `-uk` 4. So the
orthography is **near-**consistent rather than perfectly consistent, at 0 and 2
against 257 `-ong` and 151 `-ok` in the same population — a ratio of about
130:1, which is what doctrine 70 needs and more than it can claim. **Say the
population next to the zero, or the next reader inherits a "0" that is true of a
one-seventh extract.**

### M-4 · The `&c.` refrain stub is not an English printing convention `PARTIAL`
**TESTED WHILE OPEN, and the remainder is NAMED: WELSH.** Three of the four
languages ship in `CHORUS_STUB_FORMS` and return their language as a
coordinate; `ac ati` matches nothing (measured 2026-08-21). `BACKLOG.md`
§2.4 carries the same finding (`quality/triage.py`).
A-1 frames its 941 instances around English songsters. The same mechanism does
the same job in the same position in other languages, and the code that handles
the English case knew none of them.
**CLOSED for Finnish 2026-08-11**, and the numbers in the first version of this
entry were WRONG — corrected below rather than quietly restated.

| language | stub | stub lines | unreadable tokens before → after |
|---|---|---:|---|
| English | `&c.` / `etc.` | 941 | handled by `is_chorus_stub` |
| Finnish | `j. n. e.` (*ja niin edelleen*) | ~~8~~ **9 at `debf64e`** | `fin_kanteletar` 14 → **0**; ~~all ten `fin_*` 155 → 139~~ `UNVERIFIABLE`, see below |
| Welsh | `&c.` | ~~30 (see note)~~ **33, rule stated below** | Mynyddog, foot of a stanza; READ AS WELSH since 2026-08-21 |

**THE FINNISH ROW MOVED WITH THE CORPUS, NOT WITH THE REGISTER — and the
distinction is the whole reason the verdict is `MOVED` and not `FALSE`.**
`8 stub lines / 16 unreadable tokens` was CORRECT when it was written.
`corpus/song/fin_wahanen_laulukirja.txt` landed at `debf64e` carrying one more
`j. n. e.`, so `python3 quality/audit_register.py` derivation D7 now measures
**9 occurrences** — `fin_kanteletar` 7, `fin_kanteletar_uudempia` 1,
`fin_wahanen_laulukirja` 1 — and at 2 vowelless tokens each (`j` and `n`; the
`e` is readable) that is **18 tokens**. Nothing here was ever wrong; the
population under it changed, and the same commit broke `quality/test_msa_fin.py`'s
nine-volume constants for the same reason. **Every count in this row is pinned
to the commit it was taken at and re-derived by command** — `corpus/song/` is
written by other cells while this file is being read.

**The `155 → 139` half is now `UNVERIFIABLE`, and struck rather than replaced.**
D24 re-runs it and reports 145,280 tokens with 718 unreadable over the same
files — two orders off — because *this entry states no tokeniser and no
reason-code filter*, so there is no rule to re-run and no way to tell a drift
from a different question. Doctrine 58 with the RULE as the unwritten
coordinate. **Owed: the tokeniser, beside the number.** It is not replaced with
718, because 718 is the answer to a question this row did not ask.

**~~The Welsh 30 is `UNVERIFIABLE` and no rule tried reproduces it.~~ THE RULE
IS STATED AND THE THREE VALUES RECONCILE — 2026-08-21.** The debt this row
carried was *the rule, beside the number*, and it is paid here rather than by
picking a value:

> **RULE.** `lyric_harness.is_chorus_stub(line, language="cym")` over the lines
> of `corpus/song/cym_*.txt` that are not blank and do not begin `#`, `[` or
> `---`. **33.** Reproduce:
> `python3 -c "import lyric_harness as L,glob;print(sum(L.is_chorus_stub(l.strip(),language='cym') for f in glob.glob('corpus/song/cym_*.txt') for l in open(f,encoding='utf-8') if l.strip() and l.strip()[0] not in '#[' and not l.startswith('---')))"`

The bare `&c\.` regex's **41** is not a rival count, it is a count of a
different thing, and it decomposes to the digit: 41 occurrences = **2** on the
file's own staging header (which quotes `Dyna'i hewyrth, &c.` while explaining
the convention) + **39** on verse lines, of which **6** are the second `&c.` of
a line printed `&c., &c.`. 39 − 6 = **33 lines**, and 35 lines contain the
string at all, 35 − 2 header lines = 33. Every `&c.` on a Welsh verse line in
this corpus is line-final; there is no third population. Doctrine 58 is
satisfied by naming the rule, not by moving the number, and the number moved
only because the rule finally exists.

**AND THE ROW WAS BEING READ UNDER ENGLISH'S LABEL.** Until 2026-08-21 all 33
answered `('eng', ...)` to `chorus_stub_match`, and answered `None` — *not a
pointer* — the moment a caller supplied `language='cym'`, which is the silent
half and the one that puts 33 refrain pointers into rhyme extraction as sung
text. `CHORUS_STUB_FORMS`' first field is now a SET of the traditions a form is
attested in, `&c.` is attested for `eng` and `cym` both, and the undeclared
call answers `(None, gloss)` — *this is a pointer, which tradition printed it
cannot be told from the line*. See BACKLOG 2.4 and `quality/test_spans.py` §8b.

BACKLOG 2.4 expected the remaining work to be a Welsh WORD for *et cetera*.
Measured: `ac ati`, `ac yn y blaen` and `a.y.y.b` occur **zero** times
line-final in the staged Welsh. The entry's premise was falsified by the
corpus, and the fix is a second attestation on the existing form rather than a
fourth pattern.
| Malay | `d. s. b.` / `d.s.b.` | **108 in the SOURCE** | see the reversal below |

**THE MALAY ROW WAS WITHDRAWN ON 2026-08-11 AND THE WITHDRAWAL WAS ITSELF
FALSE. Restored, with the correction that caused it recorded rather than
erased.**

The withdrawal said `d. s. b.` occurs zero times, having grepped
`corpus/song/msa_skeat_pantun.txt` — the STAGED file, 129 blocks, 2,113 tokens.
M-4 was never describing that file. M-3 names the population in its own text:
**PG47873's 330 Malay verse blocks, 3,415 lines, 15,519 tokens** — the source
text, seven times larger. In `47873-8.txt` the stub occurs **108 times**: 100 as
`d.s.b.` unspaced and 8 as `d. s. b.` spaced. The withdrawing grep matched only
the spaced form, in the smaller file, and read 8-in-the-source as
0-in-the-corpus. A naive tokeniser turns the 100 unspaced stubs into single
letters, which is the recorded `b`(101)/`d`(100)/`s`(99) exactly.

The replacement mechanism the withdrawal proposed — that the 300 were tokeniser
artifacts of the file's own `--- RIME:` and `--- SOURCE:` annotation lines — is
also wrong: that mechanism yields b 130, **d 1, s 5**, not 101/100/99.

**And the arithmetic never required a withdrawal at all.** M-3's CORRECTED
figures are 76 apostrophe fragments + 300 stub tokens + 77 correct refusals =
453, comfortably inside its own 458. The contradiction was created entirely by
M-3's false 384, and M-3 corrects that itself. **384 was the only false number
in the pair.**

The lesson is the one this session learned twice and applied wrongly the second
time: **checking a claim against a population the claim was not about is not a
check.** The first instance was verifying `test_fwer` against a HEAD that
already contained the change under test. This is the same error committed while
correcting an error, and it took an adversary pointed at the register to find
it. `lyric_harness.CHORUS_STUB_FORMS` shipped the `msa` row throughout and was
right the whole time.

**The Finnish row is right in kind and was wrong in both numbers.** ~~16
unreadable tokens, not 13~~ — **18 at `debf64e`**, and the correction that
matters is the one above: it moved because the corpus did. "100% of that
corpus's failures" holds for the two Kanteletar files only; ~~across all ten
`fin_*` files it is 16 of 155 (10.3%), and `fin_paavo_cajander.txt` alone
carries 120 from a different cause~~ — the whole-corpus share is `UNVERIFIABLE`
for the reason given above, and the number of `fin_*` files is measured at run
time by `python3 quality/verify_entries.py` rather than written down here.
**The silent half is confirmed and is the part that mattered:** the `e` IS
readable, so on `Härkä ei juo vettä j. n. e.` `fin.line_alliteration` returns
(2 alliterating, 7 words) against (1, 4) for the real line — three phantom
words and one phantom alliteration, in the numerator *and* the denominator.
`CHORUS_STUB_FORMS` is now a declared table of `(language, gloss, pattern)` and
`chorus_stub_match` reports WHICH convention fired (doctrine 45).

### M-4a · A tighter rhyme band LOOSENS the time layer's correction `CLOSED`
**Found 2026-08-11, and it is a defect in a fix this repo shipped the day
before.** Commit `b1d7f64` (tail alignment + `theta_coda` 0.60 → 0.80) was
validated on the band's false-positive rate and on the sonnet violation rate,
held out on both. It was never run against the time layer, and it breaks all
four `test_fwer.py` assertions:

| | uncorrected saturation (want >60%) | word-scramble (want <20%) | degenerate item refused / band-pass (want yes, >0.25) |
|---|---:|---:|---|
| pre-`b1d7f64` (head, 0.60) | 70.0% | 8.8% | Yes / 0.429 |
| tail, 0.60 | 65.0% | 6.8% | **No** / 0.232 |
| head, 0.80 | 60.0% | **25.5%** | Yes / 0.426 |
| **shipped (tail, 0.80)** | **55.0%** | **26.7%** | **No** / 0.226 |

Two independent causes, cleanly separated. **`theta_coda` causes the
false-event blowup, ~3× in BOTH alignments** — a tighter rhyme band shrinks each
position's comparison family, which loosens the Šidák cut, so tightening the
band *raises* the corrected false-event rate. That is doctrine 22 arriving from
the other side: a threshold is a rate, and this one is a rate somewhere nobody
was looking. **Tail alignment alone drops the degenerate-item guard below its
0.25 threshold**, silencing doctrine 28's tripwire — the mechanism that
distinguishes "none" from "cannot tell."
**And the audit of it was wrong too.** These failures were reported twice as
"pre-existing, confirmed at clean HEAD" — a verification run against a HEAD that
already contained the change. Checking a baseline that includes what you are
testing is not a check. **The commit pair is now on the record so nobody has to
find it again:** `b1d7f64` changes `theta_coda` 0.60 → 0.80 and does not touch
`test_fwer.py` (`git diff --stat 6c265ad b1d7f64 -- quality/test_fwer.py` is
empty), so any baseline at `b1d7f64` or later contains the change and the clean
baseline is its parent **`6c265ad`**.

**FIXED 2026-08-11, and fixing it voided a recorded headline.** The diagnosis in
this entry was right and incomplete: `theta_coda` did not merely interact with
the correction, it exposed that **`m` was measured from the wrong population**.
`rhyme_events` built `family` over `scored` — band-PASSING pairs, median 6–13 —
when the candidate family is 89 on a quatrain and 176–265 on a sonnet. That is
doctrine 27's error one layer up, inside the function that fixed it. The four
assertions pass again with every constant replaced by the quantity it stood in
for (see L-1), and **`quality/RESULTS_FWER.md`'s headline is void**: at the
honest family size 18 of 20 real sonnets and 16 of 20 scrambles return
`cannot tell` and the rest return 0 events. Every arm whose events come from
`rhyme_events` — including the sonnet arm behind Fisher p = 0.950, k = 23 — now
reads "cannot tell" rather than "null". `positive_control.py` and
`run_positive_control.py` are OUTSIDE the retraction, verified by execution
rather than by reading: with `rhyme_events` replaced by a raiser, both run to
completion with a call count of **0**.
~~**This entry stays OPEN** because the two remaining causes are unfixed: the
degenerate-item guard's dependence on the alignment, and the fact that the layer
now has no attainable event on any item in the repository.~~

**CLOSED 2026-08-21 — BOTH REMAINING CAUSES WERE ANSWERED, ONE OF THEM FIVE
DAYS AGO IN `CLAUDE.md`, AND NOTHING CARRIED IT BACK HERE.** The table above
stands: it is the record of a real defect at a named commit pair
(`6c265ad` → `b1d7f64`) and the worked case for reading a baseline that
contains the change under test. What does not stand is the closing sentence.

1. **The guard's alignment dependence is a DECLARED COORDINATE, not a
   dependency.** `TimeDeclaration.max_null_band_pass` is **0.152**, not 0.25,
   and it carries `max_null_band_pass_basis` naming the alignment and the
   `theta_coda` it was measured at — *"2 x max over 30 Shakespeare sonnets =
   2 x 0.076, measured 2026-08-11 at alignment=tail, theta_coda=0.80 … the
   previous value 0.25 was the same quantity measured at alignment=head,
   theta_coda=0.60."* There is a re-measurement runner
   (`python3 quality/fwer_family.py --calibrate`) and `test_fwer.py` §5
   asserts the degenerate item is refused **under BOTH alignments** and real
   verse clear of the guard under both. **The threshold was stale, not the
   guard** — which is the diagnosis this entry was reaching for, arrived at
   from the other side. `python3 quality/test_fwer.py` exits 0 at HEAD.
2. **"no attainable event on any item in the repository" is precisely the
   absolute `CLAUDE.md` struck on 2026-08-16.** The pin is **18 `cannot_tell`
   / 0 `refused` / 2 `answered`** (`quality/audit_fwer_fpr.py --check`), and
   those 2 are `attainable=True, n_events=0` — **an observed zero, not a
   refusal**; `quality/time_attainable.py` agrees independently
   (`32 real | 18/20 mute | ev>0 0`). Two doctrines: **20**, an observed zero
   is a null and "nothing is attainable" is inconclusive-by-construction, so
   collapsing them throws away the only two items that answered; and **79**,
   18 and 2 are two counts and this sentence read them as their sum.

**WHAT IS UNCHANGED, and it is the whole load-bearing claim:** the layer is
still MUTE, the blocker is still multiplicity, and the family size is still
the measurement that says so. It was stated in one absolute too many.
`M-18`'s instance list item 2 — this entry's *"confirmed at clean HEAD"*
against a HEAD containing the change — is about the AUDIT and is unaffected.

### M-5 · A printing can spell one sound two ways, and the modernisation check cannot see it `OPEN`
Every recorded instance of the orthography rule (doctrine 50, CHANNELS.md rule
4) is a MODERNISATION. The Kanteletar is not modernised at all and still carries
a hazard: `w` and `v` are **allographs of one phoneme** and the printing MIXES
them — `Väinämöisen` and `Wäinämöinen`, same name, same book. `fin.py` keys the
alliteration class on the first onset character, so `Wiipurin`/`veti` reports no
alliteration where the tradition hears one. Folding `w`→`v`: weak 81.84% →
82.15% (+70 lines), strong 60.21% → 60.43% (+48). Small — **the shape matters
more than the size.** A text using `w` throughout is self-consistent and costs
nothing; it is the MIXING that costs. "Has this been modernised?" returns *no*
and passes the file. The question that catches it is **"does this printing spell
one sound two ways?"**

### M-6 · `fin.py` implements alliteration and nothing else — BOTH SENTENCES WERE FALSE `CLOSED` 2026-08-11
~~No `rhymes()`. Nine of the ten staged Finnish files are **rhymed strophic
verse** whose actual constraint the module cannot check. F-1 lists `fin` as
present; it is present *for the Kalevala metre only*, and the corpus that just
landed is mostly not that.~~

**Both sentences were false at the commit that wrote them, in different ways,
and a cell was briefed off them on 2026-08-11 and sent to build a relation that
already existed.** They are struck rather than deleted, per this file's own
rule, because the pair is the calibration case for `quality/verify_entries.py`.

**1 · The symbol existed.** `Finnish.rhymes()` landed at `f94383c`, with
`rime()`, `relation_type()`, `refusal_reason()` and `readability_census()`
beside it and a corpus arm in `quality/test_msa_fin.py`. `f94383c`'s own commit
title is *"two of my own MISSING entries were false"* — so this entry went stale
inside the very round that was meant to be catching that class, which is the
argument for an instrument rather than another careful read.

**2 · The corpus half was wrong twice over.** `ls corpus/song/fin_*.txt | wc -l`
returned **11** at commit `debf64e`, not the ten counted here: the eleventh,
`fin_wahanen_laulukirja.txt` (1864 song-book, PG 72965), landed *after* `fin.py`
was written. And the metre split is not 1 : 9 — measured against
`quality/kalevala_rate.py`'s own across-line permutation null,
`fin_jaakko_juteini.txt` carries a HIGHER weak-alliteration excess than the
Kanteletar itself (**+58.86pp** against **+50.65pp**), with 53.2% of its lines at
exactly eight syllables. It is Kalevala-metre material that was sitting in the
"rhymed" arm, so the corpus's Kalevala negative control has **two** members and
not one (doctrine 41: a positive control can pass for the wrong reason, and only
a second control tells you which).

**Where the relation's numbers are:** `quality/RESULTS_FIN_RHYME.md`, runner
`python3 quality/fin_rhyme_rate.py`. Ten rhymed volumes, 1,346 four-line units,
shipped depth 1 — mandated 1346, judged 1328, **refused 18**, observed 62.58%
against a null median of 24.76%, **+35.53pp**, p = 0.0050.

**No count in this entry is a present-tense claim about `corpus/song/`.** That
directory is written by other cells, so the 11 is pinned to `debf64e` and
re-derived rather than recorded; the live count is measured at run time by
`python3 quality/verify_entries.py`.

### M-7 · Doctrine 55's fix was right and its dash rule is over-general `OPEN` — sized 2026-08-21, and this entry's own proposed fix does not carry the load
**SIZED 2026-08-21 (measured, not estimated).** The 72/72 reproduces exactly —
6 llywelyn + 0 alun + 11 hwiangerddi + 54 mynyddog + 1 twm, medial dashes read
as caesura by `cym._marked_parts()`. **But the positional rule this entry
proposes (single + line-final = gwant, medial/paired = editorial) demotes only
9 of the 72** — the paired shape — because 63 are a single medial dash, and a
line-final dash never splits anything in the first place. The fix that carries
the load is the one `relations.mark_printed_caesura(marks=("/","|"))` already
ships: make the mark set a DECLARED COORDINATE on `cynghanedd`/`_marked_parts`
(`quality/phonology/cym.py:655` is the whole rule today), defaulting to
`/` and `|`, with an edition that prints the gwant opting the dash in. Blast
radius, measured: `cynghanedd_rate.py` pins move (Alun marked 129→104, all
croes/traws; Twm 5→4) and three tests rewrite (`test_phonology.py:493-497`,
`test_relations.py:2103-2106`); the 57.1% headline is `caesura='search'` and
does not move. **~2–3 h, a real sitting, not a quick win** — and note Alun
prints zero `/` or `|`, so demote-and-declare means Alun must DECLARE the
gwant to keep any marked reading, which is the honest outcome this entry
argues for.
The comma was correctly demoted from caesura to punctuation. In the same change
the **dash was promoted to gwant on the evidence of one edition**. Across five
further Welsh files the dash is punctuation **72 times out of 72**, and in the
1862 Pryse cywydd it comes in **matched pairs around an interjection** —
`'Er pan rodded—trwydded trwch—'` — so the answering "half" is the contents of a
bracket. The structural point is sharper than the count: **the gwant is an
englyn feature and a cywydd has none**, so any `caesura='marked'` result on a
cywydd file is reading the typesetter by construction. Distinguishing feature is
position and pairing: gwant single and usually line-final, editorial dash medial
and often paired.

### M-8 · No metre index was found in any reachable Welsh edition `OPEN`
Welsh hymnody is sung to named tunes with a declared metre (8.7.8.7 and so on),
which is exactly the field the English corpus records for 331 songs and the
rarest thing in it. **Not one reachable Welsh edition prints one.** The sourcing
cell declined to infer it from syllable counts off a flattened-ASCII
transcription, which is correct — that would invent the corpus's rarest field
rather than source it — and it is the largest thing that round did not deliver.

### M-9 · ~~`CHANNELS.md` is written as a blocklist and the policy is an ALLOWLIST~~ — reframed 2026-08-21 `CLOSED` 2026-08-21
~~The gateway denies by default and the proxy enumerates its own denials~~ —
**and the second half of that sentence was imprecise in a way the rewrite had
to fix:** `recentRelayFailures[]` is a failure LOG, empty until you probe, not
a policy dump; it enumerates nothing on its own (verified 2026-08-21, empty
before five probes and five `connect_rejected` rows after). 11
further hosts probed, all denied, including **all four Project Gutenberg
mirrors** — so GITenberg is not a convenient alternative to Gutenberg, it is
the only route.

**CLOSED by the rewrite this entry asked for.** `data/CHANNELS.md` now opens
with the allowlist frame (~8 open doors, deny-by-default), carries every
former blocklist row under KNOWN CLOSED with its probe date, and the rewrite
surfaced two corrections the blocklist frame had hidden: **`codeload.github.com`
was never egress-denied** (403 with a 378-byte body and no `connect_rejected`
— GitHub refuses at the origin, the tunnel opens; a different fact under
doctrine 49), and **two committed rows disagree about WebFetch rate limits**
(this file said "no rate limit", `data/sources.tsv:63` records 429 after a
couple of `/search` hits) — carried as CONTESTED in the file with both
citations, to be re-probed by whoever next needs the channel rather than
silently resolved by whichever row a reader saw first.

The Welsh parquet pointer survives in the file's OPEN table: `hf_fs cat`
refuses binaries, so `wikimedia/wikisource` config `20231201.cy` — Welsh
Wikisource, one 1,251,259-byte parquet — stays **named, located and
unreadable**. Highest-value single Welsh target for whoever next has a
parquet-capable channel.

### M-11 · ~~ZERO named airs across EVERY non-English song staged~~ — **31, and the field was inside the title all along** `PARTIAL`
The field this whole round was chasing. ~~ZERO named airs across 8,009
non-English songs~~ — **the heading carried a denominator that moves and a
finding that does not**, so it no longer carries the denominator at all. The
English corpus records a named air for 331 of 5,006 songs (6.6%); the songs
staged in Persian, Sanskrit, Finnish, Malay and Welsh record **0**, and the 500 Chinese ci that DO carry a
詞牌 for 100% of songs are the one admitted file (M-12). Per language: Welsh
prints tunes but no metre index (M-8); the Gītagovinda's rāga and tāla headings
exist and are refused on licence (M-12); the Persian EPUBs carry no per-poem
musical metadata at all. This is F-6 restated with a number and it is the single
largest structural gap left in the corpus.

> **THE DENOMINATOR HAS MOVED AND THE ZERO HAS NOT. Measured 2026-08-11**, same
> rule as K-1 (a song is a `--- TITLE:` line), over `corpus/song/`:
>
> | prefix | language | songs |
> |---|---|---:|
> | `fas_` | Persian | 8,350 |
> | `fin_` | Finnish | 962 |
> | `cym_` | Welsh | 391 |
> | `msa_` | Malay | 129 |
> | `san_` | Sanskrit | 25 |
> | | **the five M-11 names** | **9,857** |
>
> ~~8,009~~ **9,857**, and `ltc_` is a further 10,529 outside M-11's list. The
> **0 is untouched** — it is the finding, and it does not depend on the
> denominator. Recorded rather than silently swapped because the entry stated no
> rule and no date, so nobody could tell a drift from a mis-transcription; this
> is the same defect K-1's `154,346` had. Re-derive with
> `python3 quality/counters.py` (the `corpus/song/eng_*` row states the rule) or
> `python3 quality/audit_register.py --slow`. ~~**Neither figure is re-derivable as
> a NAMED-AIR rate until `--- AIR:` exists** (§3.2), which is the actual blocker
> and is unchanged.~~ **BOTH ARE RE-DERIVABLE AS OF 2026-08-21, AND THE ZERO IS
> FALSE.** See below.

> **THE ZERO IS FALSE — 31, MEASURED 2026-08-21, AND THE BLOCKER WAS AN
> INFERENCE RATHER THAN A MISSING FIELD.** `--- AIR:` does not exist and does
> not need to: the stagers already write the tune into the TITLE VALUE, as
> `--- TITLE: CHWI FEIBION DEWRION  [air: Marseillaise]`. Nothing SPLIT it, so
> `MarkedSong.title` read the whole polluted string for 11,099 songs and the
> air was a substring rather than a coordinate. `quality.grid.split_named_air`
> and `named_air_census` read it now; re-derive with
> `python3 quality/audit_register.py --slow` (derivation D5) or
> `python3 quality/test_grid.py`.
>
> | prefix | songs | air of its OWN | air RESTATING the title |
> |---|---:|---:|---:|
> | `cym_` | 391 | **13** | 0 |
> | `fin_` | 962 | **18** | 0 |
> | `fas_` | 8,350 | 0 | 0 |
> | `msa_` | 129 | 0 | 0 |
> | `san_` | 25 | 0 | 0 |
> | **the five this entry names** | **9,857** | **31** | **0** |
> | `eng_` | 8,667 | 539 | 0 |
> | `ltc_` | 10,529 | 0 | 10,529 |
>
> **THE 31 ARE WHAT FALSIFIES THE ZERO. THE 10,529 ARE NOT, AND THE TWO ARE
> NEVER SUMMED** (doctrine 79). A ci's title IS its 詞牌, and
> `quality/build_ci_corpus.py:1137` prints one variable into both fields, so
> `air == title` is guaranteed by the stager rather than measured — true, and
> no evidence that anybody recorded a tune. This entry's own text already drew
> that line ("the Chinese ci that DO carry a 詞牌 ... are the one admitted
> file"); the line is now mechanical. The count in that sentence has moved,
> ~~500~~ **10,529**.
>
> Samples, verbatim: `CHWI FEIBION DEWRION  [air: Marseillaise]` ·
> `DAU FYWYD  [air: Rodney]` ·
> `MAALLENI.  [air: Ur svenska hjärtans djup en gång]` ·
> `Juomalaulu.  [air: Sjung om studentens lyckliga dag]`.
>
> **THE ENGLISH FIGURE MOVED TOO.** `331 of 5,006 (6.6%)` is now
> **539 of 8,667 (6.2%)**, and `audit_register` D5 reads the whole corpus
> rather than `eng_` alone — its marker inventory had never seen RHYME, JU,
> GE, JUAN, SYLLABLES, RIME, FUNCTION, SPLIT or SUNG-EVIDENCE, so an
> English-only rate could not have falsified an entry about non-English songs.
>
> **TESTED WHILE OPEN** — `quality/test_grid.py` names this entry in 19
> checks, and every one of them is about the half that CLOSED: whether the air
> can be read as a coordinate, and what the census returns. None of them
> touches the half that keeps this entry PARTIAL, which is that three
> traditions record no air at all for reasons outside this repository. A test
> naming an open entry is CONTESTED by default (`quality/triage.py`), and this
> paragraph is the argument that it is not.
>
> **WHAT KEEPS THIS ENTRY PARTIAL.** Persian, Malay and Sanskrit still record
> **0** over 8,504 songs, which is the largest part of the original finding
> and is untouched: the Persian EPUBs carry no per-poem musical metadata at
> all (M-13), the Gītagovinda's rāga and tāla headings exist and are refused
> on licence (M-12), and Welsh prints tunes but no metre index (M-8). The
> finding was never only about whether a field could be read.

### M-12 · The admissible copy and the complete copy are DISJOINT `OPEN`
Doctrine 92. Three instances in one round, and "find a better source" is the
answer to none of them:
- **Gītagovinda rāga/tāla** — present in GRETIL, verified by fetch (HTTP 200,
  60,793 B, 25 `gīyate`, 5 `rāgeṇa`, 9 `tālena`), **CC BY-NC-SA**. Refused. The
  DCS copy that IS admissible is the copy that dropped the headings.
- **`Guy-Bilitski/rcc-data`** — Gītagovinda root plus commentary, **no licence
  file at all**. Silence is not permission.
- **The Chinese ci and yuefu** — 5,081 songs, express non-commercial. Refused;
  see K-7 and doctrine 85.

### M-13 · The Persian EDITION gate is OPEN on all ~~30~~ **31** files `OPEN`
**REPINNED 2026-08-21 to match its BACKLOG half.** `BACKLOG.md` §3.3 was
brought up to date that day and this entry was not — the same one-half-repinned
drift M-21 records for a different pair. Three of the four side-clauses below
were discharged on 2026-08-11; struck here individually, each with where the
evidence lives, and the HEADLINE stays open because it is true.

Every Persian row says so, and there are **31** now (`ls corpus/song/fas_* |
wc -l`; `data/sources.tsv:393` states "THE EDITION GATE ON ALL 31 PERSIAN FILES
THEREFORE STAYS OPEN" in as many words). ~~`ganjoor.net` and `api.ganjoor.net`
are egress-blocked, and the per-book منبع note — which names the printed
edition each text was keyed from — lives only there.~~ **The route was FOUND
and the premise is PARTLY FALSIFIED** (`data/sources.tsv:393`,
`SEARCH:ganjoor-edition-route-2026-08-11`): the field is reachable in ganjoor's
open source — `GanjoorPaperSource` + `GET /api/ganjoor/cat/{id}/papersources` —
and it is a machine-scored `MatchPercent` resemblance unless
`IsTextOriginalSource`/`HumanReviewed` is set, so it is not the editorial
statement this entry assumed. Two dead ends measured rather than assumed:
`ganjoor/ganjoor-db`'s dump has no source column; third-party dumps carry
`paperSources` NULL 31/31. Six hosts 403-CONNECT. So the author gate is clear
on all 31 and the edition gate is unanswered on all 31, which is doctrine 80 in
its plainest form — and closing it needs egress to `api.ganjoor.net` or
`naskban.ir`, plus an edition COORDINATE to close it into: the only one in code
is `quality/phonology/ltc.py` `EDITION_TABLES`, Chinese-only.

~~Also open: `Erfi.epub` (ʿUrfī Shīrāzī, d.1591) is a **corrupt zip**~~ —
**CLOSED as NOT_FOUND, not pending repair** (`data/sources.tsv:394`): 2,920
bytes, 7 local headers, **0 central-directory entries**. Truncated, not
damaged; nothing in it to recover.

15 on-list poets are in the EPUB set with **no ghazal section**
(Firdawsī, Niẓāmī, Jāmī, Khayyām, Rūdakī, Nāṣir Khusraw, ~~Bābā Ṭāhir~~,
ʿUnṣurī, Manūchihrī, Farrukhī, Azraqī, Mahsatī, Gurgānī, Abū Saʿīd, Kisāʾī) —
**14 now**, because ~~Bābā Ṭāhir's **do-baytī** (366 poems, a sung Luri form)
is present, unstaged, and needs its own form declaration~~ **it is STAGED with
the declaration measured**: `corpus/song/fas_baba_tahir_dobayti.txt`, 366
poems, 366 `--- SUNG-EVIDENCE: form` blocks, row at `data/sources.tsv:395`,
AABA 233 against a null max of 3 via `quality/phonology/fas.py`. Six further
ghazal-bearing poets sit in the same EPUBs off the supplied list — Nizārī
Quhistānī (d.1320, 1,408 ghazals), ʿAbd al-Qādir Gīlānī, Ibn Ḥusām Khūsfī,
Mullā Hādī Sabzavārī, Riḍā al-Dīn Ārtīmānī, Sulṭān Bāhū — free breadth if the
list extends.

### M-14 · 2 Sanskrit authors is the DCS's ceiling for this property, not a shortfall `OPEN`
Amaru, Bhartṛhari, Govardhana and every DCS stotra are reachable, CC BY 4.0 and
out of term, and the refrain detector fires **zero** on them at every setting
against 24 on Jayadeva in the same run — so they are NOT_FOUND *for this
property*, with the floor printed beside the zero (doctrine 93). Extending
Sanskrit needs either an NC decision on GRETIL or a source for the Vaiṣṇava
stotra/pada literature — Vedānta Deśika, Bilvamaṅgala, the Gosvāmins,
Śaṅkaradeva — **none of which is among the DCS's 270 texts**.
**Orthographic caveat recorded with the text:** the Gītagovinda writes word-final
`m` 1,078 times and `ṃ` 3 times; the Caurapañcāśikā does the opposite. A
final-akṣara rhyme key is **not comparable across DCS texts without folding**.

### M-15 · `RelationSchema.traditions` — ~~declared on 77 schemas and populated on ZERO~~ **75 of 77 populated, and the SOURCE is the gap** `PARTIAL`
The ZERO was left standing as live heading text under a blockquote that already
corrected it, which is how a superseded figure keeps being quoted: `BACKLOG.md`
§2.5 copied it forward for a day. Struck now, and `python3
quality/verify_entries.py` fails the run if the two files disagree about it
again.
**Found the moment the layer became reachable, which is the argument for
wiring.** Run `relations` on four lines of English and "Middle Chinese end
rhyme (同用 group)", "pantun ABAB" and "Scots vowel-length rhyme (Aitken's Law)"
all fire. They are not wrong — the RULE SHAPE matched — but nothing in the
output could say so, because the field that would scope a schema to its
tradition exists and is empty everywhere. This is doctrine 43 with a mechanism:
a checker implementing a tradition's rules while never having read that
tradition's language. It is the third declared-but-inert coordinate in that
file, after `Span.unit` and `SpanRule.terminator`.
**Not filtered, deliberately.** Inventing a language scope from the schema
NAMES would be guessing, so the `relations` verb prints the row and states in
its own output that the tradition did not match, the rule shape did.

> **POPULATED 2026-08-11 (commit `e4cc054`) — and this entry does NOT close.**
> 75 of 77 schemas now carry traditions: **298 distinct `Tradition` rows, 319
> attachments**, and only `blues AAB stanza` and `refrain by reference` carry
> none. The scoping was not invented from schema names — it was taken from
> `quality/RHYME_CANON.md`, which is better — but **every single
> `Tradition.source` is an `R<n>` pointer back into that document**, and the
> commit message calls that "sourced". See the new **M-15a**: the gap this
> entry named is filled and the fill has a gap of its own.

### M-16 · ~~One module is genuinely stranded~~ — it is not, and the decision is taken `CLOSED` 2026-08-11
`python3 lyric_harness.py wiring` now reports this mechanically instead of
requiring an audit. ~~After wiring: **`quality/rhyme_constraints.py`, 1,325
lines** — a library with no caller and no `__main__`.~~ The 1,325 stood as live
text underneath a blockquote that already corrected it, which is how a
superseded figure keeps getting quoted: it is struck now, and
`python3 quality/verify_entries.py` fails on it if it comes back. Cell 3's triage already
recommended shelving it (20 relation types against `relations.py`'s 77, three
predicates against nine, no `SequenceEqual`/`SequenceSuffix`/`SubsequenceOf` so
amphisbaenic, parechesis and the Norse cluster span are unreachable in it) while
mining its one genuine advance, **knowledge sets** — a `frozenset` per channel,
which is the right shape for the P11 homograph gap and for partial nuclei.
Decision owed: mine the idea into `relations.py` and delete the file, or give it
a `__main__` and keep it as a comparison runner.

> **DECIDED 2026-08-11, and "genuinely stranded" no longer holds.** The file
> now has an `if __name__ == "__main__"`, and it
> has callers: `quality/relations.py` and `quality/test_relations.py`.
> **REPINNED 2026-08-15, AND AGAIN 2026-08-22: `quality/rhyme_constraints.py` is ~~1,652~~ **1,738** lines (repinned 2026-08-22: the M-38 quantifier reconciliation added the shared vocabulary table, the `Selection.__post_init__` gate and their comments. The argument this figure supports — that the module is large and is KEPT on a stated ground — never rested on the third digit)
> lines** — ~~1,566~~ when this block was written (`ade8546`, 2026-08-11),
> ~~1,609~~ later the same day (`e4cdf72`), ~~1,607~~ on 2026-08-12
> (`11aa19b`), ~~1,611~~ 2026-08-13 (`010f7a7`) to 2026-08-15. The +41 is
> the dead-coordinate lot: `tie_break` removed as a settable field and the
> rule it stated written out at the two sites that ENFORCE it, plus
> `surfaces` wired into `read_channel` and `declaration_for`. Growth in the
> file's own account of why it is kept, again, which is what the sentence
> below predicted.
> **The sentence that went stale is the sentence that said it would.** This
> block already declared a line count "a coordinate of the counting convention
> AND OF THE DATE", and then the date moved three times under the figure while
> the figure stood still. `BACKLOG.md` §4.4 — the same claim, in the other
> register — says **1,611** with `1,566` and `1,609` struck beside it, and has
> a note explaining that it names exactly ONE module so
> `MODULE_LINE_COUNT` can check it. Two registers, one file, two answers, for
> three days, and the checkable one was right.
> The 1,611 is `wc -l` and `str.splitlines()`, which agree; `audit_register.py`
> D22 prints ~~1,567~~ **1,612** because it computes `src.count("\n") + 1`,
> which invents a
> final line whenever a file ends in a newline. The counting convention was
> named as a coordinate here and then two instruments picked different ones.
> Re-derive with `wc -l quality/rhyme_constraints.py`, or with
> `python3 quality/counters.py` (the `stranded modules` row, which uses
> `splitlines()`); `python3 quality/verify_entries.py`'s `MODULE_LINE_COUNT`
> shape now checks the sentence above on every run, which it could not do
> while the count sat beside the words "the file" and named no module.
> **Both branches of the decision were taken, deliberately.** The knowledge sets
> were mined into `relations.py` — `Syllable.onset/nucleus/coda/prominence/moras`
> may each hold a scalar or a `Readings` frozenset, with the TYPE as the marker
> so there is no flag to forget, and backward compatibility proven by a
> byte-identical fingerprint over 2,489 real syllabifications across all nine
> modules. **And the module is KEPT as a comparison runner, on an argument that
> names its own price:** its P6 defect (`apply_pred`'s `PRESENT_ON` testing
> whole-channel emptiness) is left unfixed on purpose, because patching it to
> agree with `relations.py` would spend the only property that justifies keeping
> a second implementation. That is what a "keep it" decision has to look like to
> be a decision rather than a default.

### K-7 · The Chinese ci and yuefu are refused, and the unblock route ~~is named~~ **WAS ALREADY BUILT** `PARTIAL` 2026-08-11
**~~`BLOCKED` 2026-08-11~~ — struck, and the strike is the finding.** This entry
was written at `ad7edca`, 05:19, and marked `BLOCKED`. The route it calls
unbuilt had landed at `16cb073`, 02:14 — **three hours and five minutes
earlier**, in the same round, on the same branch, with 66 corpus files, 70
`data/sources.tsv` rows and a runner. The entry was written by a cell whose own
instrument (`quality/verify_entries.py`, shape `STATUS_XREF`) had just found that
two documents cited a `K-7` that did not exist; it created the entry the
citations needed and asserted a STATUS from the citing documents rather than
from the repository. `BACKLOG.md` §3.1 was written at `b5e73f7`, 00:04, and was
merely stale; this entry was **written after the work it denies**.

That is adversary 8 failing in the one place it was pointed at. `ls
corpus/song/ltc_siku_kr4j*.txt | wc -l` returned 66 at the moment the word
`BLOCKED` was typed. A status is a claim about the repository and has to be
derived from it — the same rule M-6 and M-11 are already here for.

**The refusal still stands and nothing below withdraws it.** 4,347 ci and 734
樂府 were located, extracted, validated and measured, then REFUSED: the
digitiser's grant quoted inside the files is `資料自由使用，但不得為商業用途` — an
express non-commercial restriction, which this repo had already treated as a
rejection for `irfanzainudin/pantunis-data` and for CELT (doctrine 85). The ci
half fails twice over: its stated base is 唐圭璋's 《全宋詞》 (1940), he died in
1990, so life+70 runs to 2060 — and his PUNCTUATION carries the signal (45.2%
rhyme agreement at 。-ends against 2.7% at ，-ends on a 2.8% matched null).
**The build does not re-acquire that dependency by any door:** the 1782 白文 has
no punctuation at all, every line break in the staged files comes from the 1715
詞譜 by exact character count, and nothing from 網路展書讀 was read, staged or
used as a tie-break. The refused text was used for NOTHING — not as text, not
as ground truth, not as a tie-break; the only ground truth in the build is the
詞譜's own printed 例詞, which is the spec checking itself.

**What is staged.** 10,029 ci across 687 詞牌 in 66 files
`corpus/song/ltc_siku_kr4j*.txt`, from `kanripo/KR4j*` 白文, every juan
declaring `#+PROPERTY: BASEEDITION WYG` = 文淵閣四庫全書, 1782, segmented by
`data/qindingcipu_ge.tsv` (欽定詞譜, 1715, via `hulbji/couyun`, MIT). No living
copyright anywhere in either chain. 2.3× the 4,347 that were refused.

**VERIFIED 2026-08-11, offline and link by link, and the verification is a
command.** `python3 quality/build_ci_corpus.py --verify-staged` re-derives every
poem's segmentation from the committed spec with no clones and no network —
character count, printed break vector, uniqueness of that vector once the 1782
woodblock's own 片 has voted, and each header against its own punctuation. It
reports **10,029 poems / 10,029 checked / 0 unverifiable / ~~10,029~~ 10,028
segmentation confirmed + 1 UNEVIDENCED / 0 defects**, with ~~5,573~~ **5,572**
韻/句 partitions unique and 4,456 declared ambiguous. REPINNED 2026-08-21 when
the lacuna refusal below shipped: the poem that satisfied the check vacuously
no longer counts as confirming it, and it held the 5,573rd unique partition. `quality/ltc_overlap.py` already rebuilt the rhyme measurement from
the `--- RHYME` headers — but it TRUSTS them, and they were the only record of
where the spec put a line end.

**Three things the verification found, and they are the entry's live half.**

1. **The chain had a link that was not in the repository.** 479 poems (4.8%, 88
   names) head a 詞牌 `data/qindingcipu_ge.tsv` cannot resolve — 醉落魄 for
   一斛珠, 江神子 for 江城子 — because the link lived only in a `git clone` of
   `kanripo/KR4j0086`. The first `--verify-staged` run reported **436
   UNVERIFIABLE**. `data/qindingcipu_aliases.tsv` (324 links, both witnesses
   named per row) closes it to **0**. Doctrine 34 one level in: a row whose
   chain has a link outside the repo is a claim nobody here can check. The
   segmentation was never in doubt — all 436 printed break vectors already
   landed on a real 格 of exactly their character count, 436 of 436 — so this
   was an *unverifiable* claim, not a wrong one, and the difference is worth
   stating.

2. **The coverage figure was measured on the wrong denominator, and the bias
   runs both ways.** `ltc.readability` filtered `U+4E00..U+9FFF`, the BMP
   Unified Repertoire alone, so 3,703 Extension A / Ext B+ / compatibility
   ideographs fell into **no count at all** — not read, not refused, not
   unread, not `total`. The row's `97.70% of 578,974` becomes **read 565,996 /
   refused 13,040 / unread 3,641 over 582,677 = 97.14%**, so it was OVERSTATED
   by 0.56 pp here — while on `corpus/song/ltc_huajianji.txt` the same widening
   adds 58 characters that ALL read, so it was UNDERSTATED there. A rate
   polluted this way is not even conservative in a predictable direction, which
   is doctrine 79's second lesson in a second layer. **䰟 — the variant 魂 maps
   TO, the character doctrine 88 is named for — is U+4C1F and was itself outside
   the denominator of the rate that doctrine quotes.** Fixed in
   `quality/phonology/ltc.py`. At the 韻 positions, where the signal is
   (doctrine 67): **mandated 41,828 / read 40,472 (96.76%) / correctly refused
   1,134 / ingestion residue 205 / no character at all 17.**

3. **164 character positions in the corpus are not characters, and no file
   header says so.** 132 `&KRnnnn;` Kanseki gaiji entities in 123 poems (12 at a
   韻 position, 3 at a 句) — one graph with no Unicode code point, and eight
   ASCII characters to any consumer that does not know — and 32 `□` lacunae in
   6 poems, 5 at a 韻 position. **One poem is half lacuna**: 雙雁兒 其2 in
   `ltc_siku_kr4j0032.txt` is 26 of 52, its entire second 片, with 4 of its 8
   mandated 韻 positions on `□`. The character-count match is the ONLY evidence
   the segmentation is right and a lacuna run satisfies it **vacuously**, so
   that poem should have been refused and was not.

   **CLOSED 2026-08-21 — AND IT NEEDED NO RE-STAGE.** The refusal was owed to
   the BUILDER, and re-staging needs the 66 clones, so it went into the
   VERIFIER instead, which is network-free and clone-free:
   `_unevidenced_segments` finds any printed segment made ENTIRELY of lacunae,
   and a poem carrying one is counted `segmentation_unevidenced` rather than
   `segmentation_confirmed`. The staged text is untouched — it is faithful,
   and the 1782 woodblock really did lose that 片; what was wrong was calling
   it CONFIRMED (doctrine 20).

   **THE UNIT IS THE SEGMENT, NOT A RATIO, and the corpus chose it.** A
   segment holding even one real character evidences its own boundary; a run
   of `□` fits any 格 wanting a run of that length, so its break is placed by
   the count alone. Measured over all 10,029: **SIX poems carry a lacuna and
   exactly ONE has an all-lacuna segment** — 雙雁兒 其2, 4 of 9 segments, 20
   of 52 characters. The other five (1.1%–3.6% lacuna) keep every break
   evidenced and stay confirmed. A percentage threshold would have had to be
   picked; this one is read off what the evidence covers.

   **A STATE, NOT A DEFECT.** It is not in the `defects` dict, so
   `--verify-staged` still exits 0. Filing it there would hold the gate
   permanently red on a property of an 18th-century printing, and this repo's
   own rule is that such a gate is one people learn to skip —
   `partition_ambiguous`, 4,456 of them, is the standing precedent for a
   reported state that does not fail. The count is pinned by
   `quality/test_ltc.py` §15 instead, AT ONE and with the poem named, so a
   re-stage that adds another, or a criterion that over-fires, reds a check
   rather than moving a number nobody reads.

**Doctrine 88's cost is now measurable and half of it is paid.** 16,681 of the
582,677 characters do not read, and `data/qieyun_variants.tsv` files the biggest
of them under verdicts that are wrong FOR THIS EDITION: 黄 (1,205 tokens) as
`簡化`, "a 1956 simplified form", in an 18th-century manuscript; 逺 (946) and 緑
(862) as `後起`. An 異體字 verdict is a property of the character **in an
edition**, and that table models only the character. So EDITION is now a
coordinate — `MiddleChinese(edition='siku')`, **off by default**, reading the new
`data/siku_orthography.tsv`. Two witnesses build it and neither is enough alone:
Unihan's variant fields (88 types / 3,810 tokens, refusing every source with
more than one reading target — the 发→發/髮 trap) and a Needleman-Wunsch
alignment of the 1782 目録 against couyun's independent transcription of the same
1715 work (28 types / 8,024 tokens, and the only witness that reaches 逺, 緑, 㸃,
鳯, 㑹). **They overlap on 8 types and agree on 8 of 8.** Union 52.8% of the
unreadable; **441 types / 7,646 tokens neither reaches, so the majority is still
owed**.

**THE PRICE, AND THE CONTROL MOVED THE RIGHT WAY.** `--verify-staged`, `cilin`:
`edition=None` gives 韻 **90.9%** (28,330 / 31,162 judged / 2,159 refused)
against the matched 句 control's 7.4% — reproducing the committed numbers
exactly from the staged files. `edition='siku'` gives 韻 **90.8%** (29,284 /
32,251 / **1,070 refused**, a 50.4% cut) and the 句 control stays at **7.4%**.
Separation 83.5 → 83.4 pp. Recovering 1,089 refused rhyme pairs moved the result
−0.1 pp and the control not at all; a map that was manufacturing agreement would
have lifted both (doctrine 41).

**What is left, in one place.** ~~The lacuna refusal in the builder (needs a
re-stage)~~ — **CLOSED 2026-08-21 in the VERIFIER, no re-stage needed**; a
third orthography witness for the 441 unreached types; declaring
`&KRnnnn;` and `□` in the staged file headers (needs a re-stage);
`data/qieyun_variants.tsv`'s cause taxonomy, which is a sibling's file and whose
verdicts are now contradicted per-row in `data/siku_orthography.tsv` rather than
overwritten.
**Work item:** `BACKLOG.md` §3.1 — its "needs a build" is stale by the same three
hours.

### M-17 · `best_score` names a pair that did not produce the number `CLOSED` 2026-08-21
**CLOSED FOUR DAYS AFTER ITS OWN WORK ITEM AND NOBODY TOLD IT.** `BACKLOG.md`
§1.2 has read `M-17, CLOSED 2026-08-17` since the 17th; this half kept saying
*the adversary is built; the repair is not*, which had been false for four
days. The seventh already-built-and-unmarked entry of 2026-08-21, and the
first where the two registers' stale halves were REVERSED from the usual
direction (the BACKLOG closed first).

**This entry is written because `BACKLOG.md` §1.2 cited `M-17, OPEN` and no
`M-17` existed** — the same `STATUS_XREF` finding as K-7 above, and the reason a
cross-reference into this file has to be a checked claim rather than a
convention.

`best_score` printed a score beside end words that did not produce it: the
reported pair was the one a later stage selected, not the one the comparator
maximised over, so the number, the label and the evidence in a single report
line could disagree with each other and nothing noticed.

**MEASURED.** `quality/audit_spans.py` (adversary 7, landed `a914dc0`,
`quality/RESULTS_SPANS.md`): of the **1,014 judged** sonnet pairs, **382 report
lines name a pair that did not produce the number**. ~~Of the 81 violations, 35
do and 46 do not.~~ **82 / 36 / 46 since cell BA's coda-identity fix —
`RESULTS_SPANS.md` records the repin and this entry never took it.**

**THE REPAIR, VERIFIED AT HEAD 2026-08-21.** `best_score` returns a `Scored`
(`lyric_harness.py:1738`) whose `spans` is an `Attribution` that CANNOT be
separated from the number — `del`/`pop`/replace all raise (`:1771-1786`).
`report_pair` checks its own claim (`:1852`); the consumers print it
(`check_scheme` `:2696`, the graph `:2792`, the chains `:2905`); and the
writer-facing half this entry never knew about, `Reviser._attribution`, is
guarded by `test_revise.py` §44. `python3 quality/audit_spans.py --check`
passes with all six figures pinned, and `test_spans.py`'s thirteen groups
guard the type, the claim check and the sweep.

**AND THE 382 IS NOT AN OPEN DEFECT — it is the standing geometry of the span
search, disclosed.** A max over k candidate spans will often win on a span
that is not the naive end-word pair; the defect was reporting the number
beside the wrong label IN SILENCE. The fix was disclosure, disclosure is what
`--check` pins, and a report line that says `NAMED PAIR IS NOT THE EVIDENCE`
beside the real span is the repaired behaviour, not a residue.
**Work item:** `BACKLOG.md` §1.2, `CLOSED 2026-08-17`.

### M-10 · GITenberg enumeration misses about a third by any single method `OPEN`
Repo-name WebFetch → 5 Welsh holdings; `filename:metadata.yaml "language: cy"`
→ 5, missing three files that contain that exact string; `"Language: Welsh"` →
a *different* 5, because one PG header wrongly says `Language: English`.
**Union = 9.** Third confirmation that the filename suffix (`<id>.txt` /
`-0.txt` / `-8.txt`) follows no rule.

---

## N. What the round CONFIRMED, which is rarer than what it broke

### N-1 · The cynghanedd detector reads the FORM, not the author `CLOSED`
**This is the control the project did not have.** `corpus/cym_alun_strict.txt`
and the new `corpus/song/cym_song_alun.txt` are **the same book** — same poet,
same 1909 Ab Owen volume, same transcriber, same flattened-ASCII orthography,
same checker, same within-line-shuffle null, same seed.

**RE-MEASURED 2026-08-11 AND THE WHOLE TABLE MOVED.** The figures this entry
shipped were taken before doctrine 82 — before `skeleton()`'s terminus became a
property of the DIWEDDEB and `extent` lost its default. Every row below is
re-run at `caesura='search'`, 200 within-line shuffles, seed 20260810:

| | n judged | observed | null max | excess | p |
|---|---:|---:|---:|---:|---:|
| Alun, strict metre | 1558 | 57.1% | 21.8% | **+35.3** | floor |
| Twm o'r Nant cywydd | 156 | 46.2% | 26.9% | **+19.3** | floor |
| Llywelyn Goch cywydd, 1862 | 145 | 44.1% | 28.3% | **+15.8** | floor |
| Twm o'r Nant *cerdd rydd* | 804 | 28.4% | 17.0% | **+11.4** | floor |
| Welsh hwiangerddi | 1712 | 12.9% | 12.3% | +0.6 | floor |
| **Alun, his own hymns** | 262 | 14.5% | 14.5% | **+0.0** | **0.015** |
| Mynyddog, song | 2893 | 8.2% | 8.9% | −0.7 | 0.104 |

`for f in corpus/cym_*.txt corpus/song/cym_song_*.txt corpus/song/cym_cyng*.txt;
do python3 quality/cynghanedd_rate.py "$f" 200; done`

**The excess column is the difference of the two columns beside it, computed on
the values AS PRINTED.** `cynghanedd_rate.py` computes the same quantity at full
precision and rounds last, so it reports +15.9 where 44.1 − 28.3 = 15.8. That
0.1 is the whole of check C9's original finding, and the repair is to state the
rounding rule rather than to pick a number — doctrine 58 at its smallest scale.

Author, edition, printer, century, orthography and transcriber all held
constant; **the effect goes to zero off the strict metre, and the re-measured
table says so more cleanly than the shipped one did.** Every previous Welsh
number came from strict metre, so a high rate was compatible with the detector
reading the *language's* redundancy (doctrine 64) or the Ab Owen printing house.
It reads neither. The graded middle — 18th-century *cerdd rydd*, sung to named
airs, at **+11.4, about a third of the strict-metre excess** — is where the
tradition says it should be.
**Doctrine 76 from the other side:** that doctrine says report SENSITIVITY
beside a null; here SPECIFICITY was what needed showing.

> **THE ROW THAT DISAGREED WITH THE CONCLUSION, AND WHY IT NO LONGER DOES.**
> As shipped, Welsh hwiangerddi read excess **−0.2** with **p = 0.015**: a
> negative excess over the null MAX beside a p that rejects at any conventional
> alpha. Check C10 found it, correctly, and called them two different questions.
> **They are not two questions — at n = 200 they are two readings of the same
> tail**, and that is the re-derivation. The empirical p is
> `(#shuffles ≥ observed + 1) / 201`, so p at the floor (0.005) means *no*
> shuffle reached the observation, which is exactly "the excess over the null
> max is positive"; p = 0.015 means *two* did, which is exactly "the null max
> reaches or exceeds the observation". The two columns cannot point opposite
> ways once you know that — what they can do is round to figures that LOOK like
> they do, which is what happened.
>
> Re-measured, hwiangerddi is **+0.6 with p at the floor** and the apparent
> contradiction is gone. The row that now carries p < 0.05 with no positive
> excess is **Alun's own hymns: +0.0, p = 0.015 — two of 200 shuffles reached
> 14.5%.** That is the honest shape of "at chance", and it is reported here
> rather than smoothed, because a p of 0.015 sitting on a zero excess is
> precisely the pair a reader would otherwise quote selectively (doctrine 57).
> The conclusion rests on the excess column, all seven rows of it, and the
> gradient +35.3 → +19.3 → +15.8 → +11.4 → +0.6 → +0.0 → −0.7 is the finding.

### N-2 · Doctrine 65 corroborated at scale, not merely defended `CLOSED` — with the headline `UNVERIFIABLE`
~~`cym` reads all five new Welsh files at **100.00%** — 0 unreadable tokens in
29,571~~ — including 2,750 internal apostrophes (`a'i`, `sy'n`, `mae'r`) that the
elision rule joins correctly and 94 internal hyphens. A split check for `l l`,
`d d`, `l-l`, `c h`, `r h` finds every hit is a word boundary, never a broken
digraph. **The digraph corroboration stands; the 100.00% does not.**

> **`100.00%` IS NOT CHECKABLE, AND THE MISSING PIECE IS ONE FUNCTION.**
> `msa` and `fin` both expose `readability_census()` and return **read /
> refused / defective as three separate counts**, so their claims can be
> audited. ~~**`cym` exposes no census** (`hasattr(cym, "readability_census")`
> is `False`), so read and refused cannot be separated and a bare rate hides
> exactly the distinction doctrine 79 exists to enforce.~~
> **CLOSED 2026-08-11: `cym.readability_census()` exists** — added by the cell
> that gave Welsh a `rhymes()` predicate, and `hasattr` now returns `True`.
> The struck sentence is kept because `quality/verify_entries.py` found it
> STILL ASSERTING `False` after the entry had been marked CLOSED, which is the
> gap between a status and its content that the checker's `HASATTR` shape
> exists to catch. Overwriting it would have hidden the only live instance of
> that shape firing.
>
> Measured 2026-08-11 under the module's own `WORD_RE`, over verse lines only
> (blank, `#`, `---` and `[` excluded): the five `cym_song_*` files give
> **29,669 tokens, of which 219 are declined by `syllabify()`** — 83 bare `--`
> runs (the gwant), and the rest proclitic and elision fragments (`'`, `'n`,
> `'r`, `’r`, `f’`), plus a handful of ingestion leakage (`jpg`, `Mr`, single
> capitals). The two non-song Welsh files give 8,719 tokens and 144 declined,
> 124 of them `--`.
>
> **Every one of those is plausibly a CORRECT REFUSAL rather than a defect — and
> nothing in the module can say which**, which is the entire point. 0 defective
> out of 29,669 would be a strong corroboration of doctrine 65; 219 undifferen-
> tiated declines is not the same claim, and "100.00%" is neither. **Owed: a
> `readability_census()` on `cym`**, at which point this entry's headline
> becomes a measurement instead of an assertion.

### N-4 · The Gītagovinda is here, and it overturns the number doctrine 76 rests on `CLOSED`
24 aṣṭapadī recovered by ONE fixed unswept rule (a 3-token suffix recurring ≥5
times at spacing ≤6 within a chapter) — the canonical count — with 192 dhruva
refrain lines. 27.75% refrain lines against a line-permutation null **max
9.68%**, a **+18.07 pp** gap, every replicate differing.
**A verse-keyed detector got this wrong and the corpus said so:** the DCS's
`sent_counter` does not isolate the dhruva — inside aṣṭapadī 1 it is `v5.2`,
`v9.1`, `v12.1`, `v19.2` by turns — so a verse-keyed pass found 20 of 24 and
reported **ZERO for sarga 1**, which carries four. Detection had to move to
LINES.
**Two refrain SHAPES, and the second is the finding.** `[BURDEN-TAIL]` is an
invariant final run with a varying head — `keśava dhṛta<X>rūpa | jaya jagadīśa
hare` — which is **structurally the Persian radif**, measured rather than
asserted, in a language and century with no contact. New marker, declared in the
file header.
**And the calibration number was a mixture:** see CLAUDE.md doctrine 76 as
amended. 98.17% inside the aṣṭapadī couplet, at or below chance everywhere else
in the same text. `26.32%` is not Jayadeva's rhyme rate and must not be quoted
as one.
**Bilhaṇa is the opposite shape:** 47 of 100 lines open `adyāpi`, **all 47** the
first line of their couplet — positional purity 100.0% against a null median of
48.9%, p=0.0005 at 2000 replicates — while his END rhyme is 2.02% against a null
median of 4.12%, p=0.945, below chance and correctly so. The two Sanskrit songs
in this repo put their refrain at **opposite ends of the line**.

### N-5 · Persian is no longer one poet, and the radif rate is authorial `CLOSED`
Doctrine 8's Persian instance is closed. Pooled radif 71.3% of 7,949 judged at
`min_fraction=0.60` (65.4% at 1.00, 35 refused — three counts, never two),
against a cross-ghazal redeal null with median 0 and max 1 of 7,949. The rate
spreads **2.5×** across 30 poets and is **not monotone in date**: Masʿūd Saʿd
Salmān 36.4%, Qāʾānī 40.8%, Saʿdī 43.6%, Rūmī 47.4%, **Ḥāfiẓ 63.6%**, Khāqānī
82.6%, Qudsī 89.4%, Vaḥshī 90.2%, Ṣāʾib 90.8%. Either tail alone would have
given a confidently wrong narrow answer.
**Doctrines 59/67 replicate 30 times out of 30, no exception:** on qāfiya-word
pairs the real None rate runs 35.3–70.2% (median ≈57%) against a matched random
control at 3.3–8.8%. Ḥāfiẓ specifically comes back at **60.2% None, 38.8% True**
— reproducing the recorded figures to the decimal on a completely separate
rendering of the text.
**Where the over-cap authors were sampled matters and was handled:** a dīvān is
ordered alphabetically by rhyme letter, so head-truncating Ṣāʾib at 400 would
have produced a corpus of alif-rhymes. Every capped author is every ⌈n/400⌉-th
in the edition's own numbering; Ḥāfiẓ is uncapped at 495 as the control.

### N-3 · Doctrine 58, third instance — the DELTA reproduced while the COUNT did not `OPEN`
A fresh Malay implementation sharing no code gets **131/129** where
`data/sources.tsv` records 82/80. 705 blocks and 5,555 lines reproduce exactly,
and **the keep-minus-drop delta is 2 in both runs**, so doctrine 58's second
instance — that the two separating quatrains are the only two ending in a Skeat
editorial parenthesis — is CONFIRMED. Four further settings were swept and none
lands on 82/80, which places the difference **upstream of the rhyme test**: a
~~**function-word list nobody wrote down.** That is worse than an unrecorded
threshold, because a threshold at least announces that it exists.~~

**REPINNED 2026-08-21 — A FUNCTION-WORD LIST *IS* WRITTEN DOWN, AND IT LANDED
TEN DAYS AGO IN A FILE THIS ENTRY SITS BESIDE.** `quality/audit_corpus.py:2011`
carries `_MALAY_FW` (≈130 words) and `_ENGLISH_FW` under the comment *"The two
closed function-word lists that separate Skeat's Malay from his own English
translation"* — landed `3e0b806`, **2026-08-11**, the day after this entry was
filed. It is not decorative: `:2141` applies it as the block classifier and
`:2148` asserts the result against `RECORDED` — `malay_blocks` **705**,
`malay_block_lines` **5,555**, `malay_malay_blocks` **330**,
`malay_malay_lines` **3,442**. The population this entry says nobody wrote down
is pinned and re-derived on every audit run.

**THREE THINGS IT DOES NOT CLOSE, and the entry stays OPEN on all three.**
1. **It is a FRESH list and belongs to the 131/129 chain.** `_malay_blocks`'s
   own docstring says why: *"Re-stated here rather than imported from the
   extraction script, because a calibration that shares code with the thing it
   calibrates proves nothing (doctrine 58's fresh-implementation rule)."* That
   is correct and it means the list recovers **nothing** about the 82/80 run's.
2. **It is UNREACHABLE from a clone.** `MALAY_SOURCE` (`audit_corpus.py:1909`)
   is `scratch/src_msa/raw_malay_magic.txt`, which is NOT in this repository,
   so `calibrate()` returns `UNREACHABLE` and `calibration_failed`
   deliberately does not fail on it. So 330/3,442 is a pin nobody can
   re-derive from a
   checkout: doctrine 77, the exact shape `M-3` records for
   `extract_pantun.py`.
3. **"upstream of the rhyme test" is an INFERENCE, not a measurement.** It
   rests on a four-setting sweep. The old run recorded no intermediate — only
   its terminal 82/80 — so where the two implementations part is not located,
   and with the old list gone it cannot be.

**AND THE COMPARISON IS NOT LIKE FOR LIKE, which this entry never said.**
`corpus/song/msa_skeat_pantun.txt`'s own header records that the 131/129
becomes **90/88 once monorhyme quatrains are separated out**. 131 counts a
superset (ABAB + AAAA) and 82 may never have been the same object. **The
terminal state is `UNVERIFIABLE` with the missing thing named** (M-18's
ledger): the missing thing is the 82/80 run's function-word list and its block
count, both unrecorded. **What is owed is a DECISION, not a run** — state which
count ships, or state that `data/sources.tsv`'s 82/80 is superseded by 90/88.
That is a corpus-cell call and is parked for the owner, not done here, because
it moves a `sources.tsv` row and pulls the corpus-audit md5 checks with it.

---

### M-15a · `Tradition.source` is a pointer into a document that cites nothing `OPEN`
**Found 2026-08-11 by `python3 quality/audit_register.py --provenance`, auditing
the FIX to M-15 rather than the gap.** 75 of 77 schemas now carry traditions —
298 distinct `Tradition` rows, 319 attachments — and **every single
`Tradition.source` is an `R<n>` pointer into `quality/RHYME_CANON.md`.** Not one
cites anything outside this project.

`RHYME_CANON.md` in turn holds **117 named structures, 611 `from:` references,
and ZERO publication-year tokens in 94 KB.** Every reference is a cell index
(`✓E1`, `C22`, `X110`) into a six-agent survey array that **is not in this
repository**. From inside a clone the citation graph is closed: 117 of 117 canon
entries and 298 of 298 Tradition rows resolve to nothing.

**One hop out it is better than that, and the hop is the problem.** The survey
does survive, in the inventory agents' session transcripts — 578 named entries
recoverable, most carrying a real source: 詞林正韻 via ctext.org,
`cls.lib.ntu.edu.tw 唐詩入門`, Snorri's own Háttatal prose, Turco's list. So the
canon is one hop from evidence and the hop lands in a store that no clone, no
checkout and no `git log` will ever contain.

**19 named structures have no witness but this project** — every recorded source
is a `quality/phonology/*` module, a `CLAUDE.md` doctrine, or the author's
memory. Two say so outright: `chan (ฉันท์) quantitative template` is sourced
*"Thai chan from memory"*, and `hā-yi ghayr-i malfūẓ as rawī` is *"MY
characterisation"*. `C-2` already declares the rule — `register_named()` REFUSES
an entry without a source, *because a catalogue written from memory is unsourced
data in the evidence base* — and `RHYME_CANON.md` has no such gate. The full
list is in `quality/RESULTS_REGISTER_AUDIT.md` §5 and is deliberately NOT filled
in, because a plausible fill is the `gabay higaad` error repeated.

**This is not an argument for unpopulating the field.** The rule shapes are
right and M-15 was a real gap. It is an argument that "sourced" was the wrong
word for a pointer into a document whose own §0 records that its Norse, Persian,
Sanskrit, Tamil, Chinese and Malay entries were *"reconstructed from the
repository's own `quality/phonology/*` modules and CLAUDE.md doctrine …
therefore not independent of the code they were meant to critique."*
**Owed:** inline the survey's `source` strings into `RHYME_CANON.md` and put the
real citation in `Tradition.source`, before the transcripts are collected and
the provenance of 117 named structures is gone for good.

### M-18 · A number's POPULATION is a coordinate, and doctrine 58 names only the threshold `OPEN`
**Found 2026-08-11 by `quality/audit_register.py`, and it is the generalisation
of four separate errors in this file.** Doctrine 58 says a bare n-of-N is a
coordinate of a setting nobody wrote down. Section M shows the setting is not
the only unwritten coordinate. Three entries quote ~~three incompatible sizes for one corpus~~ **sizes
that were incompatible when this was written and are RECONCILED WITH A NAMED
RESIDUE since 2026-08-11**, none of them, at the time, saying which object
they meant:

| | blocks | verse lines | tokens |
|---|---:|---:|---:|
| `corpus/song/msa_skeat_pantun.txt` (in the repo) | 129 | 513 | 2,113 |
| M-3's stated population | 330 | 3,415 | 15,519 |
| the same 330 blocks under the corpus file's own declared rule | 330 | **3,442** | **15,601** |
| N-3 / `data/sources.tsv`, all indented blocks | 705 | 5,555 | — |

> **THE LEDGER, 2026-08-21 — what of this entry's debt is paid.**
> **PAID:** M-3 states population AND tokenisation in one place, citing this
> entry by name, and decomposes its own 27-line / 82-token gap (72 + 10) with
> the cause named — a line-level filter, seven swept, none landing;
> `UNVERIFIABLE` with the missing thing named is that row's terminal state,
> not an open measurement. M-4's Welsh row got the tighter form on
> 2026-08-21 — the RULE beside the number with a one-line reproduce command —
> and is the template. **UNPAID, one row:** M-4's Finnish `155 → 139` names
> no tokeniser and no reason-code filter; `audit_register.py` D24 already
> computes all three candidate readings (read / refused / defective) and
> cannot recover WHICH the row meant, so what is owed is a decision, not a
> run. **AND THE INSTRUMENT CAUGHT ITSELF:** the population scanner behind
> this entry's own check read M-4's new Welsh line counts (33, 35) as Malay
> corpus sizes — it scans three entries for `N lines` with no language
> coordinate. Fixed 2026-08-21 by scoping the scan to paragraphs that name
> the Malay corpus; the checker built to catch substituted populations had
> substituted one.

A factor of seven between the first two, **and the first was used to refute a
measurement taken on the second** (M-4). Reproducing a number checks the
arithmetic of a computation; **substituting a population is not a refutation.**
Four instances in one week, three of them found the same day:

1. M-4's Malay row, withdrawn on a grep of the 129-block extract when the claim
   was about the 705-block source.
2. M-4a's `test_fwer` baseline, "confirmed at clean HEAD" against a HEAD that
   contained the change under test.
3. `rhyme_events`, which measured its comparison family over band SURVIVORS
   rather than over the comparisons made (L-1) — the same error with a
   population that is a set of comparisons rather than a set of texts.
4. Doctrine 70's zeros, true of the 513-line extract and **not** of the 330
   Malay blocks it was cut from (`-uk` 2, not 0). See M-3.

**Mechanised, so it does not have to be found again.**
`quality/audit_register.py --consistency` runs the arithmetic pass in under a
second with no corpus and no imports — component rows that do not sum to their
own total, two figures sharing a denominator that exceeds it, an enumeration
whose length contradicts its summary — and it re-finds `384 + 300 > 471` from
the prose alone. **Run it before committing a change to this file.**

**Coverage is the honest part of this entry:** ~~70 entries, all 70 carry
numbers, **681 numbers in total**, and 51 entries still have no check at
all.~~ **REPINNED 2026-08-21, re-derived by `python3 quality/audit_register.py`
§5: 77 entries, 77 carry numbers, 2,278 numbers in total, 58 with no check** —
every one of the four figures had moved, in an entry ABOUT numbers whose
population is a coordinate. This round
touched roughly a quarter of the register's entries.

### M-19 · The nucleus threshold cannot be priced on the only corpus we have `OPEN`
**Found 2026-08-11 while closing `BACKLOG.md` §1.3, and it replaces a weaker
claim with a stronger one.** The record said tightening `theta_nucleus`
0.60 → 0.70 was "a worse trade" than the coda fix. That is `WITHDRAWN`: **the
trade cannot be computed on this corpus at all.** Of the 31 mandated sonnet
pairs the tightening newly refuses, the offending syllable pairs partition with
NO REMAINDER — **28** a stressed vowel difference (gone/alone, tongue/song,
have/grave, blood/good: correct refusals in the declared General American
dialect, the same sentence this repo already accepts for love/prove), **6**
CMUdict writing one reduced vowel two ways, **1** a promoted unstressed final.
**Not one is a General American slant rhyme.** ~~`theta_coda` survived the same
test because what IT cost was S~Z and D~RD — final-obstruent voicing, which
English has not changed since 1609.~~ **STRUCK 2026-08-21 — THE CODA IS NOT
CLEAN EITHER, AND ITS OWN TEST FILE SAID SO THE DAY THIS ENTRY WAS FILED.**
`quality/test_nucleus.py:28-38` carries an **AMENDED 2026-08-11** note against
exactly this sentence: `D~RD` is n=4, not n=2, and it is not obstruent voicing
at all — it is an **R present on one side**. `RESULTS_CODA_SHAPE.md` tables the
shape (`D~RD` 4, `0~R` 4, `RT~T` 3, `RTH~TH` 3, `DZ~RDZ` 2) and states **17
rhotic observations against 9 of final-obstruent voicing**;
`quality/redteam_band.py` §9 prints the correction on every run. So half the
coda's own mandated evidence is dialect too, and the contrast this sentence
drew does not exist. **THE CONCLUSION IS UNCHANGED AND NOW RESTS ON ONE LEG
INSTEAD OF TWO** — it stands on the nucleus's own 28/6/1 partition with no
remainder, which is what the amendment's closing sentence says: *"The
conclusion this file draws … does not depend on the coda being clean, only on
the nucleus's OWN 28/6/1 partition."* The nucleus is where four centuries of
sound change live, so the sonnet violation rate prices the **`dialect`
coordinate** there, not the threshold.
The scalar's SHAPE is uninformative too: Spearman between `vowel_sim` and each
pair's lift in mandated positions is +0.02 at n=3,000 and −0.03 at n=6,000, sign
unstable; `IH~IY` scores 0.902 and is admitted at lift 0.24 while `AY~IY` scores
0.342 and is refused at lift 6.55; 17 of 38 admitted pairs occur LESS often in
mandated positions than at chance.
**What is owed is a CORPUS, not a number: true-positive rhyme data in the
declared dialect, which this repository does not have.** Until it exists,
`theta_nucleus = 0.600` ships as the incumbent rather than the winner and
`Declaration.nucleus_agreement` declares the shape with `identity` and
`licensed` reachable. Doctrine 44's distinction applies — this is "cannot
obtain", not "hard to build".

### M-20 · Poems staged TWICE in their own file, and every instrument that could see it is looking somewhere else `OPEN`
**Found 2026-08-21 while splitting the named air out of the title (§3.2), by
the checker that was already looking.** `quality/audit_corpus.py`'s
`false_unit_items` compares each item's body lines against the OTHER items'
titles in the same file. It read `--- TITLE: X  [air: Y]` whole, so an item
whose title carried an air could never be matched against — and both halves of
each pair below carry one on exactly one side:

| file | items | shared long lines | opening line |
|---|---|---:|---|
| `corpus/song/eng_celtic_james_hogg.txt` | 10 `LOVE IS LIKE A DIZZINESS  [air: Paddy's Wedding]` / 27 `"LOVE IS LIKE A DIZZINESS"` | 25 of 45 / 44 | `I lately lived in quiet ease,` |
| `corpus/song/eng_celtic_msm_alexander_rodger.txt` | 1 `BEHAVE YOURSEL' BEFORE FOLK  [air: Good-morrow to your night-cap]` / 5 `"BEHAVE YOURSEL' BEFORE FOLK"` | 24 of 45 / 45 | `Behave yoursel' before folk,` |

Same opening line, same poem, staged twice. **The near-duplicate pair check
does NOT carry them**: Jaccard is 0.39 and 0.36, under `ITEM_OVERLAP_FLOOR`,
because the two printings differ in stanza count and refrain spelling. So
these were invisible to both instruments at once, for two different reasons.

**Recorded, not repaired**, per `CORPUS_LOADING_PROTOCOL.md`. What is owed is
a decision about which printing wins, and that is a reading question rather
than a mechanical one — ~~`eng_` song counts are inflated by 2 until it is
taken, and any per-song rate over those two files double-counts one poem.~~

**REPINNED 2026-08-21 — THE SHAPE IS RIGHT AND THE COUNT WAS THE
INSTRUMENT'S, NOT THE CORPUS'S. THE POPULATION IS 28, NOT 2.** Two is what
`false_unit_items` happened to surface, and this entry read a checker's yield
as a census. Asking the corpus directly — items inside ONE file that share a
normalised title AND a normalised opening line — returns **28 pairs, 27 `eng_`
and 1 `cym_`**. The rule has to be stated or the number is a threshold nobody
wrote down (doctrine 58): titles are read through `audit_corpus._items` with
the air split off, both title and opening line are NFKC-folded to lowercase
alphanumerics-and-spaces of ANY script, and the opening line is the item's
first body line that survives that fold. **The ASCII-only spelling of that
rule returns 31 and three of the extra are false**: `踏莎行 其28` and
`漁家傲 其28` collapse to `28`, so a normaliser that drops non-Latin script
manufactures `ltc` duplicates out of two different tune-titles. The count is a
coordinate of the fold.

**AND 28 IS A FLOOR, PROVEN INSIDE ONE OF THE TWO FILES THIS ENTRY ALREADY
NAMES.** `corpus/song/eng_celtic_james_hogg.txt` stages `THE WOMEN FOLK`
twice — items 8 (line 337) and 27 (line 1469, `--- SOURCE: PG2620`) — and it
is **not** among the 28, because the two printings open `O sarely may I rue
the day` and `O sairly may I rue the day`. One letter. **Neither side carries
an air, so the air is not why this one was missed**: `false_unit_items`
matches bodies against TITLES, neither title occurs in the other's body, and
that check is structurally blind to this pair whatever the title holds. Two
blind spots in the instrument, not one.

**THE TWO INSTRUMENTS THAT COULD SEE THIS HAVE ALMOST DISJOINT POPULATIONS,
AND NEITHER TOTALS THE OTHER.** `item_overlap_pairs` — the near-duplicate
containment check — surfaces **31** same-file pairs. The title+opening census
surfaces **28**. **The intersection is ONE** (Rossetti's `Dream-Land` /
`Dream Land`). The other 27 miss for three named reasons, counted apart
because they are three different defects (doctrine 79):

| why the near-duplicate check does not carry it | pairs | worked case |
|---|---:|---|
| **DROPPED before any comparison** — a side holds fewer than `ITEM_SIG_MIN` 8 distinct body lines over `ITEM_LINE_MIN_CHARS` 12 chars, so it is never in `recs` | 8 | Browning's `Parting at Morning`, 6 lines |
| **`ITEM_SHARED_MIN` 8** — containment is high and the poem is too short to contribute 8 shared lines | 11 | Landor's `Rose Aylmer` at containment **0.88**, refused on 7 shared lines |
| **below the `ITEM_OVERLAP_FLOOR` 0.60** — genuinely divergent printings | 8 | Barnes's `The Blackbird` at 0.37 |

**Five of the eleven sit at or above 0.75 containment** (Herrick ×2 and
O'Reilly at 0.88, Blake's `Infant Joy` at 0.78, Jago at 0.75) and are refused
by the shared-line minimum alone. So the floor is not what hides this
population — **a short poem is invisible to that instrument at any
containment**, which is a third blind spot and the one with the largest yield.

**CAUSE, which this entry did not name.** In 25 of the 28 the second printing
carries a different `--- SOURCE:` from the first — `PG2620`, `PG2619`,
`PG66619` against the author file's original PG. These are the concurrent
anthology loads (`550dfb1` *Mass load: 245 Modern Scottish Minstrel author
files*, `810cc5e` *Tier-1 concurrent load: 560 songs from five song-framed
anthologies*) staging a poem an author file already held, not an extractor
defect. **So `eng_` song counts are inflated by ≥28, not by 2**, and any
per-song rate over the affected files double-counts.

**The label they surface under is imprecise and is left that way on purpose.**
`false_unit_items` reports them as `RUN-ON`, whose meaning is *the extractor
glued the next poem onto the end of this one*. That is not what these are. The
shape keys on WHERE the match falls, the match falls deep in the body, and
relabelling by hand inside a pinned test would be writing a judgement into a
count. `quality/test_corpus_audit.py` pins `RUN-ON 11` with this entry named.
**AND THE REPIN MAKES A NON-JUDGEMENTAL SPLIT AVAILABLE THAT WAS NOT ON THE
TABLE WHEN THIS WAS PARKED.** The reason for parking stands — nobody should
adjudicate a printing by hand inside a pinned count — but the discriminator
turns out to be mechanical and needs no reading: **a double staging has a
matching OPENING LINE and a run-on does not.** That is computable from data
already in hand, so `RUN-ON` could split into `RUN-ON` and `DOUBLE-STAGED`
without anyone judging a text. Recorded as the route; NOT taken here, because
it moves `RUN-ON 11`, `test_corpus_audit.py:890`'s `shapes` dict and the
counters/`PINNED` pair in one commit, and the repin is the half going stale.

### M-21 · One fact about the registers is pinned in two media, and no instrument can be asked which pins a change moves `OPEN`
**Found 2026-08-21 by paying the cost twice in one sitting, on consecutive CI
rounds.** Filing `M-20` moved the number of entries in `MISSING.md` from 75 to
76. That single fact is pinned in **two places, in two different media**:

| pin | medium | how it is repaired |
|---|---|---|
| `BACKLOG.md:1573` — the `MISSING entries by status` counters row | a markdown table cell, written between `<!-- COUNTERS -->` markers | `python3 quality/counters.py --write` |
| `quality/audit_register.py:2000` — `PINNED["coverage_entries"]` | a Python dict literal | hand-edited, with the reason |

**NO GREP FINDS BOTH.** One is prose in a register, one is a constant in an
auditor; they share no string, no spelling of the figure and no repair
command. So the second was invisible while the first was being fixed, and it
was found the only way it could be — by a CI round going red after the first
repair landed. `counters.py --check` failed at `665c773`; `audit_register.py
--check` failed at `2d91922`, on the next push. **Two CI rounds, serially, for
one fact.**

**AND THE FLOORS DO NOT HELP, by construction.** Two other instruments read
the registers and assert only that the population is non-empty —
`quality/test_register_audit.py:215` (`len(entries) > 40`) and
`quality/test_triage.py:43` (`len(ENTRIES) > 60`). Those are doctrine 20
guards against a reader that has stopped matching, and they are right to be
floors; a floor cannot see a `+1` and is not meant to. They are named here so
the count of instruments that COULD have caught this reads 2 and not 4.

**WHAT IS MISSING IS NOT A THIRD PIN.** Every pin above is correct and each
caught the drift it was pointed at, which is the design working. What does not
exist is a way to ask, BEFORE pushing, *which committed figures does this
working tree move?* — one command over the `--check` pins under `quality/`
(about thirty files hold one), reporting every one whose measured value now
differs. Today that question is answered by CI, one failing step per round,
and the round trip is ~12 minutes.

> **AND THE FIRST DRAFT OF THIS PARAGRAPH FAILED CI, which is worth recording
> rather than quietly fixing.** It counted the pin-holding files with a digit
> immediately before the word *instruments*, and `npm run check-docs` refused
> it. The rule is `\d+\s+instruments` in `scripts/check_docs.js:233`, and it
> is RIGHT: in this repository that phrase is a claim about the CodexMusica
> catalog's 1,406 playable instruments, and the checker exists because the
> site advertised 651 of them long after the real figure had moved. The lyric
> harness calls its auditors *instruments* too, so the word is overloaded
> across the two halves of one repo and a lyric-harness document may not put a
> number in front of it. Say "about thirty files", or name the pin.
>
> The offending phrase is not quoted here, because it cannot be: the rule
> reads a quotation exactly as it reads a claim, so the second draft failed
> too, on the sentence describing the first failure. That is a real limit of a
> pattern-matched docs checker and not a defect worth fixing — the alternative
> is a checker that can be silenced by wrapping a false number in quote marks.

**BUILT 2026-08-22 — `quality/pin_sweep.py`, TESTED WHILE OPEN.**

    python3 quality/pin_sweep.py                  every instrument
    python3 quality/pin_sweep.py --only 'audit*'  a subset
    python3 quality/pin_sweep.py --json           machine-readable

**About thirty pin-holding files, discovered by a SCAN and not by a list**
(the phrasing is forced: this entry's own blockquote records that
`scripts/check_docs.js` refuses a digit before the word this repo also uses
for the CodexMusica catalog's playable instruments — and the first draft of
THIS paragraph failed on exactly that, inside the entry documenting the rule,
which is the third time the trap has been sprung by a sentence about the
trap), because a
hand-written roster is a population nobody wrote down whose failure mode is
silent: a new instrument would simply not be swept and the sweep would keep
printing a clean bill over a shrinking fraction of the pins. THREE COUNTS,
NEVER SUMMED — HOLDS / MOVED / **CANNOT RUN**, and the third is the one that
matters, because an instrument that needs a tree or a warm cache that is not
here has not passed (doctrine 20). IT REPAIRS NOTHING, and that is asserted on
the AST by `quality/test_pin_sweep.py` rather than promised in prose: no live
string literal in the module may contain `--write`, `--rebaseline`, `--adopt`,
`--fix` or `--repair` (doctrine 48).

**IT FOUND THREE DEFECTS ON ITS FIRST TWO RUNS AND ALL THREE WERE ITS OWN OR
MINE, which is what a first run should do.**
1. **A drift in the working tree, on the FIRST invocation.** `counters.py
   --check` reported `public symbols by where they are referenced` moved
   1140 → 1146 — six public symbols added minutes earlier by the tokeniser and
   indent work, never re-written. That is exactly the question M-21 asks, and
   it was answered in 27 seconds instead of a CI round.
2. **`quality.pin_sweep.sweep` named by NOTHING** — reported by that same
   `counters.py` run, on the sweep itself. `main()` had re-implemented
   `sweep()`'s loop beside it: one question, two readings, in one file
   (doctrine 1), found by the instrument written to find exactly that.
   `main` calls `sweep` now, and `test_pin_sweep.py` §6 pins it on the AST.
3. **TWO FALSE VERDICTS on the first full run, and they are OPPOSITE errors,
   which is why one fix would not have caught the other.**
   `audit_corpus.py --check` takes a VALUE (a check letter), so a bare
   `--check` is an argparse error at exit 2 and the sweep filed a
   MANUFACTURED MOVED against an instrument it had never asked — its pin flag
   is `--verify-shape`, now in a declared `CHECK_ARGV` table. And
   `audit_joint_auc_null.py --check` prints `RESULT: REFUSED (not a pass, not
   a failure -- doctrine 20)` on a cold cache and exits non-zero, which the
   conservative default read as MOVED — **the exact collapse this module's own
   docstring forbids, pointed the other way.** An instrument that states its
   own verdict is believed over a code table now (doctrine 1: the instrument
   owns its vocabulary). Both are pinned as false-positive regressions.

**AND THE FIRST FULL RUN FOUND THE LARGER SHAPE THE ENTRY DID NOT KNOW ABOUT:
SOME PINS ARE ASKED BY NOTHING AT ALL.** M-21 was filed about a fact pinned in
two media where NO GREP FINDS BOTH. Measured now over the whole population:

| | files |
|---|---:|
| pin-holding files the sweep discovers | **30** |
| named with `--check`/`--verify-shape` in `.github/workflows/ci.yml` | 23 |
| asked TRANSITIVELY by a CI test that invokes the check | 2 (`corpus_manifest`, `corpus_taxonomy`) |
| **asked by NOTHING that gates** | **5** |

The five are `audit_tang_null.py`, `kalevala_rate.py`,
`run_positive_control.py`, `expected_drift.py` and `phrase_commonplace.py`.
**`phrase_commonplace.py` is the worked case and it is worse than a gap in
CI**: it HAS a test, `quality/test_phrase_commonplace.py`, that suite PASSES,
and the suite never invokes `--check` or reads `PINNED` at all. So its pins —
`authors` 143, `tokens` 991,751, `nlines` 152,154, MEASURED 2026-08-14 over
the pre-mass-load English corpus — now read **1,297 / 1,885,292 / 283,301**
against a corpus that grew underneath them, and nothing was ever going to go
red. A test that names a module and does not ask its pins looks exactly like
one that asks them and passes.

**THOSE FIGURES ARE NOT REPINNED HERE, and that is a decision rather than an
omission.** `phrase_commonplace.py`'s header says its result was "REFUSED as a
rejection on the evidence it produced", and its own comment says the pins are
"everything EXACT over a FIXED corpus at fixed thresholds". Repinning them
would mean re-running §1–§9, the two nulls and the period control over a
corpus nine times the size and re-adopting the refusal — a research sitting,
not bookkeeping, and doctrine 58 says do not tune the statistic to meet the
number. What is owed is the re-run; what this entry now carries is that
somebody has to decide to do it, which nobody could have known before.

**AND THE SWEEP TAKES OVER AN HOUR, WHICH IS RECORDED RATHER THAN DISCOVERED
BY WAITING.** Measured on that first full run: 29 of 30 instruments in 3,600s,
killed by its own outer bound before the 30th. The time is real work —
`capacity.py` re-derives 12,387 rhyme families, and the meter-band check
re-derives its two bands over 264,082 corpus lines — and every instrument's runtime prints beside its verdict. So this is a
BEFORE-YOU-PUSH-A-BIG-CHANGE command and not a per-commit one, and `--only` is
how you ask a subset. **A tool nobody runs because it takes an hour is the
same shape as a pin nobody asks**, which is this entry's own subject.

**AND THAT KILL PRODUCED NO SUMMARY AT ALL — FIXED THE SAME DAY.** The
transcript of a sweep that had found four real drifts was byte-for-byte
indistinguishable from one that found nothing: the per-instrument lines were
there, the three counts were not. Doctrine 20, in the module written to hunt
doctrine-20 failures. On SIGTERM/SIGINT it now prints the counts over what
RAN, says `INTERRUPTED after N of M`, NAMES the instruments it never reached,
and exits **2** rather than 0 — an interrupted sweep has certified nothing.
Pinned by `test_pin_sweep.py` §7, which kills a real run mid-instrument.

**THREE OF THE FIVE UNASKED PINS ARE NOW IN CI** (`audit_tang_null.py`,
`kalevala_rate.py`, `run_positive_control.py`) — they HOLD today, so the gap
closed at no cost. The other two are deliberate: `expected_drift.py` is
reached through `song_profile_calibration.py --check`, and
`phrase_commonplace.py` is drifted, so adding it would land a red job whose
remedy is re-running a whole study.

**THE ENTRY STAYS OPEN** on the half it names last: this is the QUESTION, and
the sweep is only as complete as `CHECK_ARGV` is. Every instrument whose pin
check is not a bare `--check` needs a row, and today exactly one is known
because exactly one has been caught — the rest are `HOLDS` on a flag that may
or may not be asking about a pin, and nothing yet proves which.

~~**Owed: the question, not the answer.** A sweep that runs each instrument's
own `--check` and prints the moved figures TOGETHER. It must not repair
anything — `counters.py`'s own docstring records why a remedy that writes is
a laundering path (`WHAT --write MAY NOT WRITE`), and a sweep that repaired
would inherit that hole across thirty instruments at once instead of one.~~

**AND THE SHAPE HAS A SECOND, LARGER FORM: A GREEN CHECK OVER A FALSE
SENTENCE — measured 2026-08-21 across eight RESULTS documents.** The pins
above are one fact in two media. The wider defect is one fact in a PIN and in
PROSE, where the pin passes and the prose is wrong, because **the pin is
narrower than the document**:

| document | its `--check` | what drifted beside it |
|---|---|---|
| `RESULTS_MARK_COVERAGE.md` | PASS on 6 buckets | its **headline sentence was false the day it was repinned** — `[VERSE]` 68,976 is the pre-HBV count against a live 74,173, and `VERSE` is not in `PINNED` |
| `RESULTS_FWER.md` | PASS, pins `family=candidate` | the `scored` column moved 29.1% → 37.9% and **the comparison's sign flipped** |
| `RESULTS_CYM_RHYME.md` | PASS on 48 counts across seven sections | §0's cross-document quote inverted, and its seven `data/sources.tsv` LINE NUMBERS are no longer the rows they name |
| `RESULTS_FIN_RHYME.md` | **has no `--check`** | §7 and §9 moved; `quality/phonology/fin.py`'s docstring carries the identical stale pair, so a quote writes it back |
| `RESULTS_SONG_FLOOR.md` | PARTIAL PASS | §2 says 108 authors where §5·A says 879, with a whole FPR table measured through cuts that no longer ship |
| `RESULTS_NULL_SHAPES.md` | 27 checks pass | nine figures moved, including 17.3% asserted as "today" three times beside 10.7% asserted as "today" twice |
| `RESULTS_SPANS.md` | PASS on all six | drifted only where it declares in advance that it will |
| `RESULTS_RHYME_CAPACITY.md` | PASS | **no drift at all** |

**THE ONE THAT DID NOT DRIFT IS THE ANSWER.** `RESULTS_RHYME_CAPACITY.md`
holds because its one corpus-derived quantity carries the JUDGE'S MD5 in the
artifact itself (`#judge` header). It names the **moved file**, not the moved
number — so a stale figure cannot survive a corpus change, no matter how much
prose sits beside it. Every other document pins numbers and lets the prose
around them rot. That is the cheapest of the four mechanisms observed and the
only one that works without widening the pin to cover the whole document.

**AND THE MECHANISM IS ALWAYS THE SAME:** a repin edits the figures its
`--check` covers and leaves the figures one screen away describing the
previous corpus. Twice now the repinning commit's OWN prose contained the
correction — `RESULTS_MARK_COVERAGE.md` says HBV "adds 5,196 typed blocks"
three paragraphs above a sentence that compares against the pre-HBV count.

**MEASURED AT SCALE 2026-08-21, over sixteen verification reports folded in one
sitting, and the entry is stronger than it was filed:** the shape is not
confined to RESULTS documents and not confined to pins. The same commit-sized
folds turned up

- **a repair that landed the SAME DAY the entry was filed and never reached
  it** — `M-19`'s coda clause, corrected in `test_nucleus.py`'s own AMENDED
  note on 2026-08-11;
- **an absolute struck in `CLAUDE.md` five days before the entry that rests on
  it was read** — `M-4a`, closed here;
- **a MODULE that cites the entry twice in its own text while the entry says
  the module does not exist** — `G-2` in `fit.py`, and `K-2` in
  `negative_control.py`'s FIRST LINE;
- **one file holding one quantity at two values** — `RESULTS_FWER.md`'s guard
  range, `negative_control.py`'s 143-vs-712 files, `CLAUDE.md`'s floor
  profiles and its own doctrine-11 index row;
- **one comparator shift moving two documents at once**, `RESULTS_FWER.md`'s
  headline and `RESULTS_NULL_SHAPES.md` §3.6, with nothing connecting them;
- **a test pinning a symbol that does not exist** — `test_fit.py` on
  `declared_inputs.TimeGrid`, beneath its own comment about entries outliving
  their subjects;
- **a generated document whose GENERATOR writes the stale literal back** —
  `RHYME_CANON.md` §8.5's year count, and `quality/phonology/fin.py` beside
  `RESULTS_FIN_RHYME.md` §9.

**THE LAST TWO ARE THE ONES A SWEEP TOOL MUST HANDLE AND A PIN CANNOT.** A pin
compares a committed number to a measured one; it cannot see a number nobody
committed, a symbol that resolves to nothing, or a literal in a generator. The
`RESULTS_RHYME_CAPACITY.md` answer above generalises to all three — **name the
thing that moved, not the value it moved to** — and the generator cases have
their own corollary: **fix the writer, or the next render restates the day it
was written.**

**THIS ENTRY IS ITS OWN FIRST INSTANCE.** Filing it moves the count 76 → 77,
so both pins above move again, in the commit that describes them. That is the
cheapest possible demonstration and it is deliberate: if the two figures in
the table above do not read 77 in the tree you are looking at, this entry has
gone stale in exactly the way it is about.

### M-22 · The structure census promises to be world-shaped and its tokeniser is ASCII `OPEN`
**Found 2026-08-21 by three concurrent recon agents on the cross-tradition
structure question, and it is the defect that ALREADY VOIDED ONE ADOPTION
RUN, reintroduced one layer over.**

`quality/STRUCTURE_CENSUS_PREREGISTRATION.md:35` promises the schema is
*"world-shaped from day one so that adding a language later"* adds ROWS and
never changes the instrument. **The judge layer keeps that promise and the
tokeniser breaks it.** Measured, all 57 non-comparator rows through all 7
phonologies: **0 exceptions** — `fin` 3/51/3, `cym` 0/42/15, `ltc` 6/36/15,
`fas` 0/0/57, `msa` 0/9/48, `san` 22/25/10, `eng` 22/20/15 (true/false/
refused). `items_of()` splits on the literal `--- TITLE:` byte prefix, which
every tradition has. **Section marks are not a blocker for any tradition.**

**The English-bound stage is the one that LOOKS neutral.** `pair_counters()`
calls `lyric_harness.line_tokens`, whose body is
`re.findall(r"[A-Za-z'\-]+", norm)` — ASCII-only — and never asks the
phonology for its tokens. Re-derived at head:

```
väinämöinen   LH -> ['v', 'in', 'm', 'inen']        fin._tokens -> ['väinämöinen']
pää           LH -> ['p']                           fin._tokens -> ['pää']
adyāpi tāṃ kanakacampakadāmagaurīṃ
              LH -> ['ady','pi','t','kanakacampakad','magaur']
              san._tokens -> ['adyāpi','tāṃ','kanakacampakadāmagaurīṃ']
```

Over real corpus lines: `ltc` **99.9%** of lines yield ZERO tokens, `fas`
**100.0%**, `san` **96.6%** mis-tokenised against its native reader, `fin`
**41.6%**. `eng` is 0.0% — which is why nothing has ever gone red.

**THIS IS DOCTRINE 1's OWN CASE AND THE REPO HAS PAID FOR IT ONCE.**
`CLAUDE.md` records that Kalevala alliteration run 1 was **VOIDED** because
*"the ASCII tokenizer had shredded ä/ö, and the fin phonology's `_tokens` was
the one definition all along."* The census reintroduces the identical
substitution in a different module. **It is LATENT, not live** — `corpus_files()`
globs `eng_*.txt`, so the census has never tokenised a non-Latin line and no
recorded figure moves. It bites the first hour of run 2, which is exactly when
a registration promising world-shape is cashed.

**FIVE HARD-CODED SITES, and the tokeniser is not one of them** —
`structure_census.py:57` `RHYME_CONSTRAINED_FAMILIES`, `:59` `OUT_DEFAULT`,
`:68` the `eng_*` glob, `:200` the `"eng", "eng"` literal columns, `:231`/`:270`
`PH.get("eng")`. The first four are a rename; the fifth is a parameter. **The
tokeniser is a sixth site nobody counted**, and it is the only one that fails
SILENTLY rather than by returning nothing.

**AND `san` IS THE DANGEROUS ONE, not `ltc` or `fas`.** A language that yields
ZERO tokens announces itself. Sanskrit yields **plausible Latin-looking
fragments** — `kanakacampakad`, `magaur` — that no reader would flag, and the
census would emit rates over them. Doctrine 50's shape: an orthographic layer
silently destroying the constraint the cell measures.

**TESTED WHILE OPEN.** `quality/test_structure_census.py` §7 names this entry
and the entry stays OPEN, because **the SILENT half is fixed and the three
renames are not.** Of the sites this entry counts: the tokeniser (the sixth,
which nobody had counted) and two of the five — the `"eng", "eng"` literal
columns and the once-per-run `PH.get("eng")` — are closed. The `eng_*` glob,
`OUT_DEFAULT` and `RHYME_CONSTRAINED_FAMILIES` are run 2's to move, and
`RHYME_CONSTRAINED_FAMILIES` is `M-23`'s second obligation rather than this
one's. An entry whose dangerous half is shut is not a closed entry.

**FIXED 2026-08-21, and the shape of the fix is a DECLARED TABLE rather than
"ask the phonology", because asking is AMBIGUOUS for the one language that
matters.** `English._tokens` and `LH.line_tokens` are different functions —
the second erases `(...)` spans first — and **measured, they disagree on
1,061 of 283,515 eng sung lines (0.374%) across 192 files.** Small, and not
zero, so the naive swap would have moved `data/structure_census_eng.tsv` and
its md5 while reading like a pure refactor. `TOKENISER_SITE` declares one site
per language; `NO_TOKENISER` records **three different reasons** for the three
that have none, kept apart because doctrine 44 separates *cannot* from *not
yet*: `ltc` is PERMANENT (one character is one syllable, so WORD is not a unit
of the language), `cym` and `msa` are BUILDABLE and unbuilt. A language in
that table REFUSES; it never falls back.

**THREE THINGS THE FIRST DRAFT OF THE TEST GOT WRONG, all found by mutation
and all the same species as the defect being fixed:**
1. **The byte-identical control tested an empty population.** It ran on
   `eng_hymn_cennick.txt`, whose only two `(...)` lines are `# author:` and
   `# source:` — dropped by `is_apparatus_line` before any tokeniser sees
   them. Both readings therefore agreed, and the check guarding the 0.374%
   passed against a fixture that cannot express it. Doctrine 20 inside the
   check written to stop exactly that.
2. **Nothing asserted that `pair_counters` USES the resolved tokeniser.**
   Restoring `toks = LH.line_tokens(line)` inside the loop left every check
   GREEN, because the refusals fire in the resolver and the positives called
   the resolver directly. A resolver consulted by nobody is this repo's
   four-times-filed defect, reproduced inside its own fix.
3. **The check that catches a rotted site was unreachable.** It sat last;
   every earlier block calls `tokeniser_for` unguarded, so a rotted site
   raised out of block (b) and the one check that names the failure never
   ran. It runs first now and returns early.
   Also repaired: the resolver could not SPELL `English._tokens` (a class
   attribute), so the rejected alternative was unexpressible and the control
   guarding it died as a `ModuleNotFoundError` three frames down instead of
   refusing in this layer's words.

**PROVEN BY THREE MUTATIONS**, each killed by a named check: restoring the
ASCII reader inside `pair_counters` fails 2, pointing `eng` at
`English._tokens` fails 3, and rotting a declared site fails 1 and stops the
section. `pair_counters` on the real Kanteletar now yields **2,486 endwords
carrying ä/ö under `fin`, and 0 under the ASCII reader**.

**WHAT IS STILL OWED:** the three renames above. Cost is measured and small —
a minimal honest cross-tradition run (cym + san + msa + ltc endword-only) is
**under 1 core-hour** with per-file checkpointing already implemented.

**THE SCOPE IS WIDER THAN THE CENSUS — REPINNED 2026-08-21, and the widening
came from the owner asking whether printed line numbers were being scored.**
`line_tokens`'s own docstring says *"This is the ONLY definition of 'the words
of a line' the rhyme path may use"*, so the ASCII class above is not one
consumer's mistake — it is the harness's central reading. Measured over all
**581,468 sung lines** of `corpus/song/`:

| | lines | files |
|---|---:|---:|
| `line_tokens` returns **ZERO tokens** | **250,502** (43.1%) | 278 |
| end word carries a non-ASCII letter and is read as something else | 260,949 | 191 |
| …of which `eng_*`, where NO other tokeniser is on the path | **2,524** | — |

The 43.1% is every `ltc` and `fas` line in the corpus, and it is NOT the live
defect: those languages are dispatched to their own phonologies by the
filename prefix (doctrine 45), so the zero is `line_tokens` being asked a
question that is not its. **The live defect is the `eng_` slice**, where the
prefix routes to CMUdict and there is nothing else to fall back to:
`eng_hall_william_barnes.txt` alone has **1,320 lines whose end word reads as
two characters or fewer** — `jaÿ` reads `ja`, and that file's own header
declares the diaeresis "a SEPARATE CHARACTER here" and warns that a
transcription which flattens it "must NOT be used for any letter- or
syllable-counted measure". The harness flattens it at read time instead.
Welsh in `eng`-prefixed files is the same shape: `lân` reads `n`, `tân` reads
`n`, `Pîl` reads `l` — the rhyme word is a bare consonant.

**FIXED 2026-08-21 — `LATIN_SCRIPT` IS THE ONE DECLARED REPERTOIRE, AND BOTH
READERS USE IT. TESTED WHILE OPEN.** `lyric_harness.LATIN_SCRIPT` is
`[A-Za-zÀ-ɏḀ-ỿ]`, measured rather than guessed: over every letter in
`corpus/`, 10,164,939 fall inside it and **not one letter whose Unicode name
begins LATIN falls outside**. What falls outside is Arabic (3,411,079), CJK
(604,346) and Greek (500) — three scripts CMUdict cannot read and each of
which has, or is owed, its own phonology (doctrine 45).

**FOUR SITES, ONE EDIT, AND THE REASON IS THAT HALF-FIXING IT IS WORSE THAN
NOT FIXING IT.** `line_tokens`, `Lexicon.transcribe`, `token_pieces` and
`readability`'s piece filter each carried their own `[A-Za-z]`. Measured while
only `line_tokens` was widened: the two readers DISAGREED ABOUT WHAT A WORD
IS, `line_tokens` said `tân` was one word, `transcribe` said `t` + `n`, and
`line_anchors` glued transcribe's two LETTER-NAME syllables (T-IY, EH-N) onto
the one word and reported the Welsh line **READABLE, anchored on a
spelling-out of its own rhyme word**. `substituted_silent` — the count
`test_readability.py` says "must be watched" — went **2 → 1,462** under that
state and is back at **2** with all four sites on the one definition.

**WHAT MOVED, AND THE DIRECTION IS UP BECAUSE A REFUSAL IS NOT A FAILURE
(doctrine 79).** The corpus-wide end-word refusal rate rises **5.74% →
6.2611%**: a fragment CMUdict happened to list (`n`, `ja`) used to read, and
the whole word honestly does not. `cause TOKEN` 15,958 → 17,274,
`cause PIECE` 260 → 428. Barnes's `a-` participle class — the one this repo
records as the harness MANUFACTURING rhymes — is **29 → 118**, and the other
89 were not even ONE token before.

**AND THREE CONTROLS SAY IT MOVED ONLY WHAT WAS WRONG.** `corpus/sonnets.txt`
is pure ASCII: **0 of 2,621 lines move**, and the sonnet battery is
byte-identical either side (mandated 1064, judged 1014, refused 50, violations
82). `corpus/whitman.txt` moves 4 of 14,467. And **`data/song_endword_en.tsv`
and `data/song_rhymepair_en.tsv` rebuild BYTE-IDENTICAL** — md5
`ac36602c…`/`329ad8da…` before and after — because the words the fix newly
reveals are words CMUdict cannot read anyway, so the modal ban, the tier-2
field and everything downstream are untouched. The change moves REFUSALS, not
admissions.

**AND THE SECOND QUESTION IS NAMED AND MEASURED RATHER THAN QUIETLY CARRIED.**
The old class was `[A-Za-z'\-]+`, so `'` and `-` are FREE MEMBERS of a token
run, and the fix changed the letter repertoire and nothing else — widening
both in one edit would leave no way to say which one moved a number (doctrine
1). Measured cost of conflating them: **917** battery lines move under the
joint change against **4** under the repertoire alone. The residue is real and
this is its size: **10,286 sung lines across 834 files carry a token with a
stray `--` or an edge hyphen, and on 5,644 of them it is the END WORD** —
`drachefn--`, `weary--`, and Procter's `thee--Arise`, which is two words the
harness reads as one. `build_song_frequency`'s `accent_refusal` bucket falls
**1,635 → 10** across the fix and **8 of the 10 survivors are this**, not the
repertoire (the other 2 are Greek in Herrick's editorial notes). IT IS NOT
CAUSING REFUSALS — `weary--` reads, because `HYPHEN_SPLIT` reaches the pieces
— so it is a question about what a WORD is, not about what can be read, and
it is owed its own sitting with its own controls.

**THE ENTRY STAYS OPEN** on its original subject: `structure_census`'s promise
that the schema is world-shaped. `line_tokens` is now honest about what it can
read, and it still cannot read Chinese or Persian — that is correct, it is the
English path, and `letters_outside_repertoire` is how a caller learns the
difference between "no words" and "a script this reader does not serve"
(doctrine 20). Wiring the per-language tokenisers into the census is `M-22`'s
own fix and is done; giving the REST of the harness the same dispatch is not.

**AND THE INSTRUMENT THAT FOUND IT WALKED INTO IT.** The sweep below was
written to answer "what other typography is being scored", it used
`LH.line_tokens` as its reader, and it therefore reported the ZERO-WIDTH
NON-JOINER — 26,989 occurrences, in the 22,924 sung lines that carry one —
as INERT. It is
inert to a tokeniser that returns nothing for Persian at all. Doctrine 20: a
measurement made with a blind instrument reads as a null.

**AND THE THIRD INSTANCE WAS THE SECTION'S OWN CONTROL — FOUND 2026-08-22 BY
THE VERIFICATION SWEEP RATHER THAN BY READING.**
`quality/test_structure_census.py` §7 was written to prove this entry's fix
and it measured every positive against `LH.line_tokens` as its WRONG-ANSWER
control: `fin reads its own words (ASCII shreds them)` asserted
`line_tokens("pää") == ["p"]`, `san` asserted five ASCII fragments, and the
end-to-end check drove `tokens=LH.line_tokens` as the ASCII arm against real
Finnish. The repertoire fix landed the same day and **the control stopped
being wrong** — three checks red, the only failure in a sweep of the whole
suite tree. The section's ARGUMENT — each language's tokeniser is the one
definition, doctrine 1 — is untouched and still correct; its control had been
repaired out from under it.

`ascii_tokens` is FROZEN in the test file now, copied from
`git show 1580d11^:./lyric_harness.py` rather than imported, because it IS the
defect and nothing may fix it. A check asked FIRST — before any positive that
depends on it — pins that the control still shreds what the live reader now
reads (`tân` → `['t', 'n']` against `['tân']`), so a control that has quietly
stopped being wrong fails BY NAME instead of turning three positives into
doctrine 20's empty population. Repointing `ascii_tokens` back at the live
reader reds four checks and the guard is the first of them.

**A CONTROL MAY NOT BE A FUNCTION THAT IS ALLOWED TO IMPROVE**, and the three
instances in this entry are one shape at three depths: the census read English
with the wrong reader, the typography sweep read Persian with a blind one, and
the test read its own wrong answer out of a module entitled to stop giving it.

### M-48 · `same_object_as` is the survey's dedup column and it holds prose, so the structure canon cannot be deduped mechanically `OPEN`
**Raised by the owner, 2026-08-22, on reading the section-function list: "I'd
bet dollars to donuts that you're looking at an occurrence of a literal
translation synonym here… several of these are the same thing… there's a ton
of nuance in the differences of chorus and refrain but they're important."
Measured before filing, and the measurement is worse than the suspicion.**

`data/structure_canon.tsv` carries a column named **`same_object_as`** — the
field whose whole job is to answer "are these two rows the same object". It is
populated on **622 of 623 rows**. By shape:

| shape of the value | rows |
|---|---:|
| **long prose (>60 chars)** | **381** |
| short free text | 137 |
| `—` (explicit none) | 64 |
| bare equality (`=…`) | 26 |
| `↑` (ditto mark) | 7 |
| typed relation (`species-of`, `nesting-of`, `complements`) | **5** |
| hedged (`probably =`, `possibly =`) | 2 |
| empty | 1 |

**Five rows out of 623 use a typed relation.** And of the 551 values that are
neither empty nor a dash, **111 mention no known term anywhere in their
prose** — a value in a column named `same_object_as` that does not name an
object.

Actual values, unedited:

```
AABA                      -> the one hit is a rhyme scheme AABA=233 in fas_baba_tahir…
Accumulative form         -> probably = Cumulative form (spelling variant)
Arch form                 -> —
Blowing changes           -> ↑
Compound AABA             -> nesting-of AABA
Contrasting verse-chorus  -> species-of Verse-chorus
Head-solos-head           -> complements Blowing changes
```

That is: an em-dash, a ditto mark, a hedge, three different typed relations,
and ATTESTATION COMMENTARY that belongs in the `attested` column — all sharing
one field whose name promises an identifier.

**WHY THIS BLOCKS THE STRUCTURE LADDER AND NOT MERELY TIDINESS.** The rhyme
ladder runs 601 survey rows → 77 schemas → 49 named types → a door admitting
2. The structure ladder is meant to run 623 → 314 section rows → a vocabulary.
**It cannot take the second step.** Collapsing 314 section terms across
fifteen traditions into a vocabulary REQUIRES deciding which of them name the
same span — `estribillo` / `coro` / `pallavi` / `mukhda` / `nakarat` /
`chorus` all landed on the function `goal`, and whether they are ONE value or
six is exactly the question this column was built to answer and cannot.
A survey that cannot be deduped mechanically cannot become a vocabulary, and
this is the column standing between the two.

**THE NUANCE THE OWNER NAMED IS THE REASON TO TYPE IT, NOT A REASON TO FUDGE
IT.** `chorus` and `refrain` are NOT the same object — a chorus is a
multi-line returning span with its own words, a refrain is a returning line or
couplet inside a stanza, and this repo already treats them as distinct
`SECTION_FUNCTIONS` and distinct marks. A dedup column that can only say
"same" or nothing forces every such pair into a wrong answer. That is the
argument for a TYPED set rather than a boolean.

**PROPOSED REPLACEMENT — four pointer columns and a note, each holding a term
id or empty:**

| column | means | example |
|---|---|---|
| `same_as` | the identical object under another tradition's name. Symmetric, transitive, must be acyclic. | `Coro` → `Estribillo` |
| `species_of` | a narrower kind of the target | `Contrasting verse-chorus` → `Verse-chorus` |
| `part_of` | a span contained by the target | `Stollen` → `Bar form` |
| `complements` | a counterpart that co-occurs, neither containing the other | `Zapev` → `Pripev` |
| `note` | the prose, KEPT — it is genuinely valuable and merely in the wrong seat | |

**AND A `--check`, because a pointer nobody validates is prose with a colon in
it.** Three conditions, each failing by name: every non-empty pointer resolves
to an existing `term`; `same_as` is acyclic and its closure does not merge two
rows with DIFFERENT declared `function`s (which would silently claim
`chorus` = `refrain`); and no row carries both `same_as` and `species_of` to
the same target. The 111 unresolvable values are the population that check
would refuse on day one, which is the point.

**THIS IS THE SAME SHAPE THE RHYME SIDE ALREADY MEASURED.** M-35's strictness
work found **43 antisymmetry failures, all synonym classes**, and killed the
lattice option on exactly that evidence. Synonymy across traditions is the
recurring hard problem in both canons, and on the rhyme side it is at least
measurable because the names resolve. Here it is not measurable at all.

**Why it matters:** the owner supplied a large multi-language section list
precisely so that literal-translation collisions would surface rather than
bite later. The survey collected it faithfully — and then recorded the
collisions in a column no program can read.

### M-47 · Apparatus survives into LINE-FINAL position in 35 corpus files, which is the one position end rhyme reads `OPEN`
**Two instances found by the poet-cell agent, both reproduced here verbatim,
then sized across the whole corpus rather than filed as two anecdotes.**

**REPRODUCED:**

* `corpus/song/eng_british_percy_bysshe_shelley.txt` — Gutenberg publication
  notes are wrapped inside a `[VERSE 1]` block. The reader drops the
  `[`-opening row and **keeps its continuation**, so the first kept line of the
  file is `'1818.]'`. Every character is a digit or punctuation, so it
  tokenises to `[]` — which is the same line that reopened M-39.
* `corpus/song/eng_british_lord_byron.txt` — footnote markers survive: the
  kept line `'It has not been your lot to see,[a]'` has line-final token
  **`a`**, not `see`. Two such lines in the first 40.

**SIZED over all 1,421 `corpus/song/*.txt`:**

| shape | files | lines |
|---|---:|---:|
| a trailing footnote marker on a kept line | **11** | 132 |
| a kept line ending in a stray `]` | **24** | 137 |

**WHY THE SMALL NUMBER IS NOT THE POINT.** ~2.5% of files, ~269 lines — and
every one of them lands on the LINE-FINAL token, which is the single position
`both_line_final` schemas read and the position every end-rhyme statistic in
this repo is taken over. A footnote letter in final position does not merely
add noise: it REPLACES the rhyme word, so the pair the poet wrote is not
measured at all and a pair the printer never wrote is measured instead.

**IT REACHES WORK ALREADY DONE.** `eng_british_lord_byron.txt` is one of the
eight nominated poet cells in M-40, so the agent's own poet-cell census read
it — the agent flagged that itself rather than reporting the number quietly.
And `cym_song_alun.txt` and `cym_song_mynyddog.txt` are both in the stray-`]`
list; `mynyddog` is the file M-40(d) nominates for a Welsh `cynghanedd lusg`
cell, so this wants fixing BEFORE that cell is declared, not after.

**REMEDY, and it is a reader question rather than a corpus one.** Nothing here
argues for editing 1,421 staged files. The apparatus is recognisable —
`is_apparatus_line` already exists and already catches the opening row; what it
does not do is follow a wrapped apparatus block to its continuation, or strip a
trailing footnote marker from a line that is otherwise verse. Both are one rule
each, and both belong beside the existing one so the drop rule stays in one
place (doctrine 1). Not applied: it moves every end-rhyme number on 35 files,
including a panel cell, and wants its own sitting with the re-runs named.

### M-45 · A replicate draw that produced no VALUE is counted nowhere, so a p is drawn at an n nobody printed `OPEN`
**Found independently by TWO agents in the same batch — one re-running the
stanza-framed schemas, one measuring the poet cells — which is why it is filed
at this weight. Mechanism confirmed here by reading both runners; the sweep was
NOT re-run to reproduce their per-row counts, because the machine was busy, and
their figures are quoted as theirs.**

`sweep` (`relations_null.py:1453-1460`) and `run_many` (`:762-769`) carry the
identical shape:

```python
if vals is None:                  # the whole realise() refused
    r.refused_replicates += 1     # COUNTED
for r, v in zip(out, vals):
    if not isinstance(r, R.Refusal) and v is not None:
        r.values.append(v)        # v is None -> dropped, NO counter touched
```

**Two ways a replicate can fail to yield a number and only one is counted.**
A whole-`realise` refusal increments `refused_replicates`. A single STATISTIC
returning `None` — no denominator, the schema found no instance to take a
fraction of — is dropped and nothing records it. So `len(values) < n` while
`refused_replicates == 0`, and **`p` is computed over `values`**, which means
the p is honestly drawn at the smaller n and the row does not say so.

**Measured by the agents, kept as their numbers:** 1,225 draws over 55 of 368
rows in the re-null; 1,635 draws over 44 of 232 rows in the poet-cell run.
The worst single row reported is `monai · local_fraction@2 · global_redeal ·
fas` at **used n = 50, `refused_replicates` = 0** — a p drawn at 50 wearing an
`n=200`.

**PARTIALLY DISCLOSED ALREADY, and that is the interesting part.** `Result`'s
own repr prints `n=… used=… refused=…`, so the SHORTFALL is visible to anyone
reading a row. What is wrong is the attribution: `refused=0` says none were
refused, and the missing draws are therefore invisible as a KIND. This is
doctrine 27 one layer in — a count kept apart, reported as zero — and doctrine
79's rule that a refusal is not a failure, applied to the wrong one of two
refusals.

**It also means §A's "all 1,508 refused replicate draws are one schema"
(`epistrophe / radif`) cannot see this path**, so that sentence is true of the
counted kind and silent about the uncounted one.

**Remedy:** a second counter beside `refused_replicates` — the two are
different questions and must never be summed — and `p` reported against the
`used` n rather than the requested one. Neither is applied; both move recorded
rows.

### M-46 · `local_fraction@0` runs on 20 of 77 schemas where it cannot move, and looks like a clean null `OPEN`
**Found by the re-null agent. `_GAP_FORCED` (`relations_null.py:950-958`) has
no row for `both_line_final`.**

Two line-final spans cannot share a line, so the forced gap is `(1, None)`
exactly as `different_lines` is — but with no row, `forced_gap` returns
`(0, None)`, `statistic_degeneracy` returns `None`, and `local_fraction@0`
runs anyway. **Measured: 64 rows, all observed 0.0, 0 of 64 moved.**

That is precisely the *"`p=1.0000`, 0% differing, looking like a clean null"*
case `statistic_degeneracy`'s own docstring says the function exists to catch.
**28 of the 77 schemas declare `both_line_final`** (measured under M-42), so
the recorded panel's 2,344 rows carry the same dead statistic wherever those
schemas were swept.

**Remedy is one row in the table**, and it is not applied here because
`EXTENSION_LEDGER` reads `forced_gap` and a repin of a frozen ledger is its own
sitting.

### M-44 · The named-relation judge reached 4 of 80 names, because it STAMPED a position instead of judging at the name's own coordinate `PARTIAL`
**Raised by an agent's M-35 work, and the diagnosis below is the third one I
tried — the first two were wrong and the measurements are what corrected
them. This is the mechanical cause of the owner's complaint that the grader's
door admits two relations out of 601.**

**WHAT `satisfies_relation` DOES.** It REFUSES if the caller leaves `position`
unset — correctly, doctrine 45 — then calls `classify_pair` **without passing
the position**, and stamps the caller's value onto the result:

```python
t = _dc.replace(t, position=position)      # asserted, never verified
return canon in t.names()
```

`classify_pair` itself refuses this move. Declare a position to it with no
`Frame` and it raises `Unverifiable`: *"This parameter used to be accepted and
never consulted — it reached the label and never the span — so a declared
placement is now either verified or refused."* **`satisfies_relation`
reintroduces exactly that, one layer up**, and `revise.py` has the line
indices `i` and `j` that would build the `Frame` it never passes.

**MEASURED — `night`/`light`, the paradigm English perfect rhyme, over the
80-name vocabulary:**

| preset | position-agnostic | stamped `'end'` |
|---|---|---|
| `perfect-rhyme` | `perfect rhyme (last stressed syllable)` | **0 — stamping LOSES it** |
| `english-end-rhyme` | 0 | 4 · `antya-prasa`, `masculine rhyme`, `qafiya`, `single rhyme` |
| none (what `revise.py` passes) | 0 | **4** |

**Preset and position are COUPLED** — each preset registers its names at a
particular position slot — and no single pair of values reaches both sets. So
`revise.py`, passing `position="end"` and no preset, judges every mandated
pair against **4 of 80 names**, and `night`/`light` grades as NOT SATISFYING
`perfect rhyme (last stressed syllable)`. Not refused: **graded a violation**,
which is doctrine 20 in the judge.

**TWO WRONG DIAGNOSES, KEPT because the corrections are the finding.**
~~"24 relations are reported violated because the position is hardcoded"~~ —
the hardcoding is real and its comment already documents it honestly, but the
count is of a different thing. ~~"22 names registered at `position=None` are
unreachable, so reading `None` as a WILDCARD is the fix"~~ — measured:
position-agnostic reaches **0** names for `night`/`light` without a preset, so
a wildcard adds nothing. The registry's 49 entries sit at `'end'` 22, `None`
18, `'internal'` 4, `'head'` 2, and one each at `leonine` / `cross` /
`holorhyme`; the blocker is not the position slot alone but the (preset,
position) PAIR.

**THE REMEDY — APPLIED 2026-08-22 on the owner's instruction to proceed.** A
name knows the coordinate it is registered at, so `satisfies_relation` now
judges each canon AT THAT COORDINATE: it looks the canon's keys up in `NAMED`,
classifies the pair with THAT key's boundary, realisation and anchors, and
answers. The caller no longer guesses one global coordinate for all 80 names,
and the stamping is gone.

Three rules make it correct rather than merely wider:

* **A registered `position=None` means the name does not constrain position**,
  not that it demands the absence of one. 18 of the 49 entries are registered
  that way and they are the position-agnostic names — a perfect rhyme is a
  perfect rhyme wherever it sits. A registered position that DIFFERS from the
  caller's is a real no: `internal rhyme` at an end position is not satisfied,
  and that is a finding, not a refusal.
* **The phonetic guard is kept, and applied PER KEY.** A canon registered at
  several coordinates is judged only at the phonetic ones, so `eye rhyme`,
  `historical rhyme` and `sight rhyme` still REFUSE off a phonemic stream
  rather than matching on a surface the classifier cannot see.
* **An unreadable member is UNDECIDED, never a no.** The per-key loop skips a
  `None` classification, so a naive fall-through would have answered False for
  a word the engine cannot pronounce. `classify_pair` is therefore asked ONCE
  up front and a `None` returns `None`. **`quality/test_mandate_relation.py`
  caught exactly that when this block was first written** — the check doing
  its job on the commit that was written to widen the judge.

**MEASURED THROUGH THE REAL ENTRY POINT**, `position='end'`, coarse `RHYME`:

| pair | before | after |
|---|---:|---|
| `night`/`light` | 5 | **9** — and `perfect rhyme (last stressed syllable)` now answers YES, where it was a VIOLATION |
| `mother`/`brother` | — | 7, including `feminine rhyme` and `double rhyme` |
| `love`/`move` | — | 2 — correctly NOT a perfect rhyme |

**WHAT IS STILL OPEN.** Cross-tradition names appear for English pairs —
`adalhending` and `dvitiyakshara-prasa (full aksara)` on `mother`/`brother`.
Those are RULE SHAPE matched and tradition NOT, which is doctrine 43, and the
relations layer already has `tradition_scope` to label it while the grader
layer does not. Widening the judge makes that gap visible rather than causing
it, and closing it is the tradition coordinate M-35's ruling would supply.

**Why it matters:** this is the floor under the whole ladder. The 601 survey,
the 117 canon structures and the 77 schemas all sit above a judge that, as
called today, can say yes to four names.

### M-43 · The census threw away WHY a schema refused, in the layer that makes every panel number `CLOSED` 2026-08-22
**Found 2026-08-22 by an agent sweeping the tree for the M-39 laundering
family, and it is the sharpest thing that sweep returned: the defect is inside
the instrument written to prevent it.**

`Stream.supply` is three-valued ON PURPOSE — `absent` (nobody declared a
source), `empty` (a source WAS declared and the instrument marked nothing),
`present` — and `Refusal.kind` carries that out as `capability` against
`vacuous_frame`. `Coverage` recorded neither.

**MEASURED on the eng panel cell with its declaration step run:**

| schema | `Refusal.kind` | what it means | `Coverage` before |
|---|---|---|---|
| `antanaclasis` | `capability` | no sense inventory exists anywhere | `cannot_obtain` |
| `epistrophe / radif` | `vacuous_frame` | `mark_refrain_tail` **RAN** (`refrain_source='computed'`) and found no shared tail | `cannot_obtain` |

Byte-identical rows, and the printed remedy for both was *"declare the
capability on the stream"* — **for a capability the slice header prints as
`DECLARED refrain:all_lines` two lines above.** That is doctrine 20's own
sentence, found-nothing against never-looked, inside the census; and doctrine
44's, since the two have opposite remedies and one of them is unreachable.
`relation_report` and `capability_report` both split this correctly. `coverage`
was the single consumer that did not — and it is the one the panel and the
ledger are built from.

**CLOSED, ADDITIVELY.** `Coverage` gains `refusal_kind` and `vacuous`,
populated from the `Refusal`; `remedy` answers the vacuous case first, because
for it the other two answers are both false — the capability IS declared and
there is nothing to build. The remedy now reads *"a TEXT the declared
instrument can find something in: refrain_tail was declared and came back
EMPTY, so declaring it again changes nothing."* **The verdict does not move,
so no frozen ledger column moves** and `--verify` still reports LEDGER HOLDS.
Pinned in `quality/test_relations_null.py` §13, both directions.

**THE SCOPE THIS DOES NOT CLOSE.** `LEDGER_CANNOT_OBTAIN` still splits two
ways, declarable against never-provided, and there are now demonstrably
**three** states in that bucket. Re-splitting it moves a frozen pin and wants
its own sitting. The agent also notes the pin `(29, 2)` is safe only because
`ledger_census` runs with no `prepare` step, so no frame is declared-and-empty
on the ledger slice — safe by accident of the harness rather than by
construction, and worth knowing.

### M-42 · Two of the four nulls are ONE randomisation for 28 of the 77 schemas `OPEN`
**Found 2026-08-22 by an agent re-running the stanza-framed schemas, and
verified here independently before filing. It qualifies the published
admissible set directly and it is the sharpest instrument defect on the
panel.**

**MEASURED.** `line_permutation` and `line_final_permutation` each call
`rng.shuffle` exactly once, on a list of `len(toks)` elements, off the same
`random.Random(seed + 1 + k)` — so they draw the SAME permutation σ. Over 200
replicates on a six-line fixture at the panel's own seed:

* **200 of 200** replicates place the same line-final token in the same line.
* **0 of 200** produce identical token grids — they genuinely differ in the
  material that is NOT line-final.

So the two are one randomisation for any schema that reads only line-final
material, and two genuinely different randomisations for any schema that does
not. **28 of the 77 declare `both_line_final`**, which pins both members there
and makes the collision exact.

**WHAT IT COSTS THE PUBLISHED SET.** `RESULTS_RELATIONS_NULL.md` §A.1 prints a
`nulls` column — "4/4", "2/4", "1/4" — read by any reader as how many
independent randomisations a row survived. For a `both_line_final` schema the
denominator is **3, not 4**, and a row whose two clears ARE the collided pair
has survived **one** randomisation while printing two. Seven of the seventeen
admissible-in-tradition rows are affected, including the top row:

`perfect rhyme` · `monorhyme / leash` · `mosaic rhyme` · `light rhyme` ·
`compound / phrasal rhyme` · `rime riche` · `pantun ABAB`

**THIS IS NOT A CLAIM THAT THOSE SEVEN ARE WRONG.** `perfect rhyme` clears at
+231 against a null max of 30 and `monorhyme / leash` at +29 on `non`; a gap
that size is not manufactured by counting a randomisation twice. What is wrong
is the ROBUSTNESS number beside them. Three of §A.1's rows cleared under
exactly one of four, and for a `both_line_final` schema "one of four" and "one
of three" are different sentences about how hard the row tried.

**THE DEEPER READING, which is doctrine 68's.** `null_menu` DERIVES which
nulls can move a schema, and this pair is a case the derivation cannot see: it
reasons about which COORDINATES a randomisation destroys, and these two
destroy different coordinates *in general* while destroying identical ones
*for a line-final schema*. The collision is a property of the (schema, null)
PAIR and the table is keyed on the null alone. A menu that proposes and a
measurement that decides is exactly the arrangement this file already argues
for; this is the measurement finding something the derivation could not.

**REMEDY, not applied here.** Either give `line_final_permutation` its own
`Random` stream so the two draw different σ — cheapest, and it makes the two
nulls independent for every schema at once — or key the printed `nulls`
denominator on the schema's own read positions so a `both_line_final` row
prints `/3`. The first is a behaviour change to a recorded instrument and
would move every §A row that used either null, so it wants a re-run and an
owner's ruling on whether the recorded panel is re-derived or superseded. The
second is presentational and could land immediately. **Neither is done, and
the seven rows above are flagged in `RESULTS_RELATIONS_NULL.md` rather than
re-stated.**

### M-41 · The capacity ceiling is derived under ONE relation, and its headline says "English" `OPEN`
**Found 2026-08-22 while looking for ladder step 5 ("capacity per relation").
`quality/capacity.py` contains ZERO occurrences of `relation`, `ASSONANCE`,
`CONSONANCE` or `RIME_RICHE` — the whole layer is relation-blind, and its own
docstring says why without noticing that it is saying it: "A FAMILY is a
perfect-rhyme equivalence class."**

**THE METHOD IS SCOPED AND THE CONCLUSION IS NOT.**
`quality/RESULTS_RHYME_CAPACITY.md` §"The objects" declares the family to be a
perfect-rhyme class, so nothing is hidden. Then finding 1 reads **"English is
narrow, and the marvel verse is forced switching… a derived fact now, not a
stylistic observation"**, and that sentence has dropped the coordinate. It is
a derived fact about PERFECT RHYME. Doctrine 58: a count is a coordinate of
its rendering, and this rendering makes a claim about a language.

**MEASURED over the identical population — 39,969 words, and the shipped
12,387 reproduces exactly, which is the control that makes the rest
comparable:**

| equivalence key | families | singletons | max | mean | median |
|---|---:|---:|---:|---:|---:|
| **perfect rhyme** (shipped) | 12,387 | 8,131 | 399 | 3.2 | 1 |
| assonance (anchor nucleus) | **15** | **0** | 5,269 | 2,664.6 | **2,382** |
| consonance (anchor-to-end consonants) | 3,527 | 1,905 | 2,002 | 11.3 | 1 |
| rime riche (whole word, onset in) | 37,462 | 35,471 | 7 | 1.1 | 1 |

Under perfect rhyme the median family holds ONE word and two thirds of all
families are singletons. Under assonance there are **fifteen families, not one
of them a singleton, and the median holds 2,382 words**. Fifteen is about the
stressed vowel inventory of English, which is the sanity check that the key is
the right one rather than an artefact. **The object the narrowness sentence is
about moves by more than two orders of magnitude depending on a relation the
sentence does not name.**

**WHY THIS IS THE SAME DEFECT AS M-39 AND NOT A SEPARATE ONE.** A coordinate
that decides a number, chosen once, correctly, in the method — and then not
carried on the number. `_stream_of` chose a stanza frame and did not record
which; `capacity.py` chooses a relation and does not carry it. In both cases
the code is right and the reported claim is wider than what was measured.

**WHAT THIS DOES NOT OVERTURN, and the distinction is load-bearing.** The
CERTIFIED figures are untouched. `chain_lo`, the witness words and finding 3's
modal-tier costs are earned THROUGH THE GRADER, and a family of 2,382 words is
emphatically not 2,382 usable partners — the homeoteleuton ban, the modal tier
and the judge all still cut it, and NONE of that was re-run here. Only the
family COUNT was re-measured. The four keys above are also the obvious
phonological rendering of each relation, written by me and not by
`rhyme_types.classify_pair`, which may cut any of them finer. Neither caveat
touches the finding: the count is a function of a relation, and the headline
does not name it.

**REMEDY, which is ladder step 5 and is not done here.** `families()` takes
the relation as a declared coordinate instead of hardcoding `_rime_key`;
`derive()` and the emitted table carry it; the artifact gains a relation
column so two capacity numbers can never be read against each other without
the reader seeing they are about different relations. The expensive half is
the CERTIFICATION — `certify()` runs the grader per family and the suite is a
430-second pole already — so a per-relation certified table is a real cost and
wants an owner's ruling on which relations are worth paying for. **The cheap
half — carrying the coordinate, and refusing to print a capacity that does not
name its relation — is not blocked by that and should land first.**

**Why it matters:** this is the number that tells a writer what English can
sustain. Told under perfect rhyme alone it says the language is narrow and the
dense verse is forced to switch families. That is true, and it is one road of
several, and the owner's whole complaint about the grader admitting two
relations out of 601 is the same complaint arriving at the capacity layer.

### M-40 · Eight admissible-set failures are eight facts about the TEXT, and the survey already names a chain rhyme nobody built `OPEN`
**Raised 2026-08-22 by the owner, reading the n=200 admissible set and asking
where the missing corpora would come from. Two separable findings; the second
was found while checking the first and is the sharper of the two.**

**FINDING 1 — `E44` IS A SURVEY ROW WITH NO SCHEMA, AND THE NAME COLLISION IS
WHY NOBODY NOTICED.** `quality/canon_index.tsv` carries **two** chain rhymes:

| row | sense | source it cites | status |
|---|---|---|---|
| `E43` | chain rhyme (**rap sense**) | Bradley, *Book of Rhymes* — "extends a single rhyme over a succession of lines by deleting word boundaries and even consonants" | BUILT, as `chain rhyme (rap)` |
| `E44` | chain rhyme (**interlocking-scheme sense**) | "English literary (**Shelley, Frost**)" | `unrecorded` / `appeal` — **NO SCHEMA** |

`REGISTRY` holds `E43` and not `E44`. The `(rap)` suffix on the schema name is
correct and is doing exactly the disambiguating job it should — the defect is
that the OTHER sense, the one Chaucer, Byron, Shelley and Morris are known
for, is a row in the survey with nothing implementing it. It is not covered by
`linked rhyme` either: that schema is `cyrch-gymeriad` / `leixa-pren` /
`coblas capcaudadas`, a LAST-word-to-FIRST-word chain, where `E44` is a rhyme
SOUND carried forward into the next stanza's scheme (terza rima's `aba bcb`).
Two different relations that share an English name. **This is the
best-evidenced step-8 item on the ladder**: the survey named it, named its
poets, and nobody built it.

**WHAT E44 WOULD COST TO BUILD, MEASURED RATHER THAN GUESSED (2026-08-22).**
The obvious worry is that terza rima needs machinery this module does not
have, because `aba bcb cdc` is a relation BETWEEN ADJACENT STANZAS — the `b`
of tercet *n* is the outer rhyme of tercet *n+1* — and `_frame_key` PARTITIONS
by `Unit.stanza`, so a `frame="stanza"` figure structurally cannot reach the
next stanza. That worry is half right and the half that is wrong is the
useful half.

`Placement._raw` implements **26 kinds**. Two are section-aware
(`same_section`, `different_sections`) and **none is stanza-aware, and none is
ordinal**: there is no `adjacent_stanzas` and no `stanza_gap_at_most`. But the
pattern for a cross-frame relation already ships — `linked rhyme` is
`frame='song'` with an `across_line_break` placement, which is the same shape
one frame up. So **E44 is ONE new placement kind away, not a machinery
rewrite**, and the kind is a few lines because `_raw` already receives the
stream and `Unit.stanza` is right there.

**AND IT IS M-39 THAT MAKES IT BUILDABLE.** Before the stanza ground landed,
every unit of every stream carried `stanza == 0`, so an `adjacent_stanzas`
placement would have been INERT everywhere — answering the same thing on every
text, exactly as `different_sections` did for its whole life until the section
coordinate was supplied. Building E44 on top of a collapsed frame would have
produced a schema that fires on anything.

**ONE DESIGN CONSTRAINT, AND IT IS THE SAME TRAP ONE LAYER OVER.**
`RelationSchema.capabilities()` collects `p.requires` from each declared
`Placement`, which means a schema could use a stanza-ordinal placement and
simply FORGET to declare `requires=("stanza",)` — and it would then run
against an ungrounded stream, read `u.stanza == 0` for every unit, and answer
TRUE everywhere. That is precisely the defect M-39 closed for `figure.frame`,
arriving from the placement side. So the requirement must be derived from the
KIND, in `capabilities()`, the way `stanza` is now derived from
`figure.frame` — never left to the declaring schema to remember. A checker
whose caller picks the coordinate is the bug (doctrine 45).

**SEQUENCED, NOT DONE.** Adding the schema moves the registry 77 -> 78 and
that cascades: `EXTENSION_LEDGER` gains a row, `LEDGER_CANNOT_OBTAIN` and the
EXTENDABLE headline move, `relation_shapes.py --check` repins, `panel_census`
partitions over a different registry, and every printed "77" in the tree wants
reading. That is a settled-tree job and it is deliberately not being done
while measurement runs are in flight against the 77.

**FINDING 2 — THE EIGHT THAT LEFT THE ADMISSIBLE SET AT n=200 DID NOT LEAVE
FOR ONE REASON, AND ONLY THREE ARE CORPUS PROBLEMS.** Kept apart because the
remedies are different (doctrine 44):

*(a) CLEARED, BUT OUT OF TRADITION — the corpus IS the remedy, and
`RESULTS_RELATIONS_NULL.md` §A.2 says so in as many words.*

| schema | cleared on | its own tradition | owner's nomination |
|---|---|---|---|
| `semirhyme` | `fin` (Kalevala) | English | Charles Kingsley (d. 1875) |
| `anaphora` | `msa` (pantun) | English | William Shakespeare (d. 1616) |
| `cynghanedd lusg` | **`eng` (Poe)** | Welsh | John Ceiriog Hughes (d. 1887) |

`cynghanedd lusg` clearing on Poe and on NEITHER Welsh cell is the one that
should not be allowed to stand: §A.4 files it as an instrument problem, and a
Welsh text that actually uses the metre is how the two readings get separated.

*(b) RAN AND LOST TO THEIR OWN NULL (`RESULTS_RELATIONS_NULL.md` §A.3.1) — a
corpus MIGHT be the remedy and it is not yet shown to be.* `cross rhyme`,
`interlaced rhyme` and `linked rhyme` carry a `both_line_final` or a DIFFER
channel that **excludes the material the poet actually rhymed**, which §A.3.1
measures as the mechanism for the whole below-chance group. Ernest Henley,
John Keats and Percy Shelley are worth running BECAUSE the two hypotheses are
currently indistinguishable — "the form is not in Poe" and "the rule is
mis-specified" produce the same row — and not because the corpus is known to
be the fault.

*(c) NEITHER — one is a NULL problem.* `epistrophe / radif` accounts for **all
1,508 refused replicate draws** in the n=200 run by itself; `global_redeal`
refused 200 of 200, leaving an empty null. More Poe cannot move a schema whose
randomisation refuses to draw. §A.4 states the deeper version: no null in
`NULLS` is a null ABOUT the radif — they all destroy the definition rather
than the effect (doctrine 69).

*(d) `cynghanedd groes o gyswllt` — the nomination is sound and the EDITION
gate is the obstacle.* Tudur Aled (d. c. 1526) is a far better witness than
either Welsh cell on the panel: `cym_alun_strict.txt` is a 19th-century lyric
poet and `cym_cynghanedd_llywelyn_goch_cywydd.txt` is one cywydd marwnad.
Doctrine 80 applies with its usual force here — the author gate is trivial by
four centuries and the BINDING gate is the edition, and the standard modern
Tudur Aled is T. Gwynn Jones (d. 1949), which does **not** clear the 1931
cutoff. Gutenberg is also thin on Welsh. So (a)'s and (b)'s six come off
Gutenberg on author death and these two need a source with its own ruling.

**WHAT THIS ENTRY DOES NOT CLAIM.** That any of the eight WILL clear on the
nominated text. Every one of them is an argmax over 4 statistics × 4 nulls ×
9 slices already, and adding a tenth slice chosen because a schema is expected
to do well on it is doctrine 19's bias with a poet's name on it. The
nominations are a QUEUE, and each one lands as a slice declared in `PANEL`
before it is run, so the cell is fixed in advance of the number.

**Why it matters:** the ladder's north star is the 601, and eight schemas are
currently sitting at "measured, and the measurement is about the wrong text".
That is the cheapest kind of movement available — no new schema, no new
capability, one corpus each.

### M-39 · The section coordinate is declared four layers deep and supplied by nobody `PARTIAL`
**Found 2026-08-22 on the owner's question of whether to take the structure
work while the null sweep ran — by checking whether the relation layer was
already leaning on a structure layer, rather than assuming it was a change of
subject. It was leaning on one, and the one it leans on is empty.**

**FOUR LAYERS, EACH DECLARED, THE LAST ONE UNREACHED:**

1. `relations.build_stream(text_lines, phon, sections=None, …)` — the
   parameter has existed since the function was written. **Zero callers
   anywhere pass it** (grepped).
2. `relations.Unit.section` — populated from that parameter, therefore `""`
   on every unit of every stream this repo has ever built.
3. `Placement` kinds `different_sections` and `same_section` — implemented,
   and they read `Unit.section`. Against `""` everywhere, one is
   **always False** and the other **always True**.
4. **Zero of the 77 schemas declare either kind** (measured).

That is `SpanRule.terminator` (defect P2) and M-15 a third time: a coordinate
declared, threaded, read by a predicate, and reached by nothing.

**AND THE STREAM EATS THE MARKER AS A WORD.** `build_stream` tokenises
whatever it is handed, so an unfiltered section line becomes verse:

```
raw:   ['[VERSE 1]','the night','the light','','[CHORUS]','the day','the way']
units: ['VERSE', 'the', 'night', 'the', 'light', 'CHORUS', 'CHORUS', 'the']
```

`CHORUS`/`CHORUS` is a `repetition` instance. Every caller that matters
filters first — `lyric_harness.is_apparatus_line` catches both bracket marks
and `---` rows, and the null sweep's `_read_slice` drops them — so this is
**latent rather than live**. But the filtering lives in each caller instead of
in the coordinate, which is the arrangement that eventually gets one caller
wrong.

**WHAT IS SUPPLIED NOW.** `quality/grid.sections_from_marks(lines, language)`
returns `(sections, line_status)` for `build_stream`, and
`grid.section_census()` reports what a text's marks ARE. The parser lives in
`grid.py` because that module owns the vocabulary — `MARK_FUNCTION`,
`MARK_REFUSED` and `ingest_mark` already know that `VERSE 1` is a verse and
already REFUSE `BAYT` and `RADIF` for English because those marks belong to
other traditions. `relations.py` serves nine languages and ships no
vocabulary; it declined to ship a rime rule for the same reason (doctrine
45/65). Verified end to end: markers leave the token stream via the existing
`exclude_status` machinery, `Unit.section` reads `VERSE#0` / `CHORUS#1`, and
the two dead predicates answer — `same_section` False and
`different_sections` True across a verse/chorus boundary.

**THE IDENTITY IS PER OCCURRENCE, AND THAT IS A CHOICE.** A second `[CHORUS]`
is a DIFFERENT section (`CHORUS#3`), not the same one returning. The two
placement predicates ask whether a pair crosses a printed block boundary, and
per-occurrence is the reading that answers that. The other reading — both
choruses as one thing recurring — is a question about FUNCTION, is what
`MARK_FUNCTION` and the returns machinery already answer, and is deliberately
NOT carried in this field (doctrine 1).

**MEASURED MARK VOCABULARY**, over `corpus/song/*.txt`: `[VERSE n]` 74,318 ·
`[BAYT n]` 70,866 · `[RADIF]` 54,193 · `[BURDEN]` 1,753 · `[REFRAIN]` 709 ·
`[CHORUS]` 267 · `[SLOKA]` 144 · `[PANTUN ABAB]` 88 · `[NOTE]` 48 ·
`[QUATRAIN AAAA]` 41 · `[BURDEN-TAIL]` 19 · `[VARIANT n]` 18 · `[URLAR]` 3 ·
`[SIUBHAL]` 3.

**AND IT HAS A LIVE CONSEQUENCE THE NULL RUN ALREADY PAID.** `Figure.frame`
is `stanza` on 5 schemas and `line_pair` on 1. The panel's reader drops blank
lines along with the apparatus rows, and `_stream_of` derives stanzas FROM
blank lines — so **every panel slice is one stanza**.

> **CORRECTED 2026-08-22, same day, by measuring instead of counting the
> declarations.** This paragraph said ~~six~~ of the 77 were nulled over a
> frame that could not vary, and the number is **five**. `line_pair` is
> `u.line // 2`, which is defined wherever a line index is: measured on all
> nine slices it takes **20 distinct values**, so `symploce` was never in the
> collapsed set. The five are `analysed rhyme`, `monorhyme / leash`,
> `dvitiyakshara-prasa`, `monai` and `blues AAB stanza`. The earlier figure
> came from reading `Figure.frame` off the registry rather than reading
> `Unit.stanza` off a stream — a declaration counted where a measurement was
> owed.

**THE COLLAPSE IS CLOSED, AND THE HOLE THAT HID IT WAS ONE LINE.**
`_stream_of` did not let `build_stream` derive the stanzas; it computed the
derivation itself and passed the RESULT:

```python
stanzas=R.stanzas_from_blank_lines(lines)      # `lines` is a join of TOKENS
```

`lines` there carries no blank line by construction, so the derivation always
returned all-zeros — and passing it as an explicit list recorded the source as
`declared`, laundering "no evidence" into "the caller said so".
`Stream.supply('stanza')` then answered `present` and the five ran over one
frame. Three changes close it:

* **`Frames.stanza_source`** (`blank_lines` | `sections` | `declared` |
  `collapsed` | `none`), set by `build_stream`, and a derivation with no blank
  line to read records `none` rather than claiming the text said one stanza.
* **`RelationSchema.capabilities()` asks for `stanza`** when the figure is
  stanza-framed, so `realise()` REFUSES naming the frame instead of returning
  a number over a frame nobody supplied (doctrines 20/45).
* **`grid.MARK_OPENS_GROUP` and `grid.stanza_ground`** supply the ground from
  what the corpus already prints. One rule for every tradition: a group ends
  at a blank line, at a `---` row, or at a `[MARK]` the table declares to open
  one. Every row of that table quotes a decision already written in `grid.py`
  — `BAYT` "the couplet-unit of a ghazal", `SLOKA` "a metrical stanza-unit",
  `PANTUN` "a whole quatrain FORM" all open a group; `RADIF` "not a span of
  the song. It has no bars and no return" does not. `PART` is deliberately
  ABSENT, and a span carrying an undeclared mark refuses WHOLE rather than
  building a vector that silently merges two groups.

**MEASURED, the panel's nine slices now frame as their sources print them:**
`eng` 7 stanzas (3/6/7 lines) · `non` 5 vísur of 8 · `msa` 10 pantun of 4 ·
`ltc` 10 詞 of 4 · `fas` 7 bayts of 2 · `san` 14 verses of 2–4 pādas, from the
TSV's own verse number rather than a mark · `cym_cynghanedd` 1 declared group
· **`fin` and `cym` NO GROUND AT ALL** — the Kalevala and Alun print no blank
line, no `---` and no `[MARK]` inside the 40 lines read, so the five schemas
refuse there, which is the honest answer and not a zero. All nine readers are
byte-identical to before (hashed and compared); the ground comes from the same
single walk, so the two lists cannot fall out of correspondence.

**~~EVERY~~ ALMOST EVERY STANZA-FRAMED NUMBER IN THE PANEL MOVED, most by an
order of magnitude — and the exception is the most interesting cell.**

> **CORRECTED 2026-08-22.** On `cym_cynghanedd` the printed ground is exactly
> ONE group, so nothing moved there at all: 51→51, 5→5, 10→10, 37→37 on the
> four schemas that fire. That is why `monai` restates at *exactly* +4 /
> 2.31×. The NUMBER is unchanged and its PROVENANCE is not — it moved from a
> laundered `declared` to a measured `printed_breaks, n=1` — which is the
> whole point of the entry stated in the one cell where it changes nothing
> else. "Every" was written from the general argument rather than from the
> per-cell table, which is the mistake this register exists to catch. `monorhyme / leash` on `eng` **268 → 30** instances — and that is
the schema sitting SECOND in the admissible set of
`quality/RESULTS_RELATIONS_NULL.md` §A at +231. `analysed rhyme` 26 → 4 on
`eng`, 93 → 3 on `non`, 98 → 5 on `san`. A leash is a run of one rhyme sound
inside ONE stanza; over a 40-line block with no boundaries, 238 of those 268
"instances" were pairs no leash can contain.

**THE SAME LINE WAS IN THE CLI, AND IT IS FIXED TOO.** `lyric_harness.py`'s
`relations` verb went out of its way to KEEP blank lines — its own comment
says why, naming these five schemas — and then spent the care on
`stanzas=RL.stanzas_from_blank_lines(raw)`, the same pre-computed derivation
passed as a declaration. On a lyric that prints no blank line the five ran
over one frame. Measured on a four-line fixture: unframed it now reports
**14 finding / 33 refusing** where it reported 15/28, and the same fixture
with one blank line between two couplets reports `monorhyme / leash` at **2
instances — one leash per stanza** instead of 6 across the lot.

**PARTIAL, and this is what remains.**
1. **The five schemas' null rows are not re-run.** Their observations moved and
   so will their nulls, since both are drawn through the same frame — so
   `RESULTS_RELATIONS_NULL.md` §A.1's `monorhyme / leash` row is now a number
   whose frame is superseded, and it is struck there rather than quoted.
2. ~~**`sections=` is still supplied by nobody.**~~ **CLOSED 2026-08-22.**
   `lyric_harness.relation_ground(text_lines, language)` keeps the two
   apparatus kinds that CARRY A COORDINATE — the `[MARK]` row and the `---`
   row — gives each a line status, and drops the rest; the `relations` verb
   passes `sections=`, `stanzas=`, `stanza_source=`, `line_status=` and
   `exclude_status=`, and discloses both grounds on every run. **`Unit.section`
   is populated in production for the first time.** Measured on
   `corpus/song/eng_american_a_g_knight.txt`: source `blank_lines` →
   `printed_breaks`, `supply('stanza')` n=1 → **n=8**, distinct `Unit.section`
   1 → **8**, and the two dead predicates flip from True/False to
   **False/True**. Unit counts are untouched (256 before and after) — the kept
   rows contribute no words and are recorded in `excluded_lines`. A sweep of
   40 random `eng_*` corpus files found **zero refused-class crossings**: every
   file moves `blank_lines` → `printed_breaks`, only `found` moves, and
   `refused` is identical on all forty.

   *Still open under this number:* no schema declares `same_section` or
   `different_sections` — that is step 8, a new schema, not this.
3. **THE REFUSAL WAS BYPASSABLE FOR SEVEN HOURS, AND THE HOLE WAS IN THE
   READER.** `_stream_of` hands `build_stream` a JOIN OF TOKENS and calls it
   `text_lines`; `stanzas_from_blank_lines` reads a blank line as the
   PRINTER's mark. A page line whose characters are all digits and
   punctuation — `1818.]`, a real Gutenberg publication note wrapped inside a
   `[VERSE 1]` block in `eng_british_percy_bysshe_shelley.txt` — tokenises to
   `[]` and joins to `""`. The derivation then found a blank line the source
   never printed, recorded `blank_lines`, and `supply('stanza')` answered
   **present, n=1**: the exact collapsed frame this entry closed, re-entering
   through the reader. Reproduced on a three-line fixture. **CLOSED** —
   `build_stream` now honours an explicit `stanza_source="none"` as a
   refusable no-ground declaration, and `_stream_of` passes it whenever it
   holds no ground, because a caller holding a token grid cannot ask a
   question about a page. Pinned in `test_relations_null.py` §12 with the
   control that a declared ground still lands.

   *Latent on the recorded panel — all nine slices have zero empty-token
   lines, and `fin`/`cym` still refused — and live on the first candidate cell
   with un-stripped apparatus. `analysed rhyme` = 87 on a Shelley trial cell
   is a laundered number and is not carried anywhere.*
4. **`section` HAS NO CAPABILITY GATE, and the hole is the mirror of the one
   this entry just closed.** Measured: `Stream.supply('section')` falls through
   to the catch-all — *"`Stream.supply` has no branch for this name, so no
   declaration can supply it"* — so it answers `absent` for the wrong reason,
   by not knowing the name rather than by finding no coordinate. Today that is
   LATENT and not live: zero schemas declare `same_section` or
   `different_sections` (measured). It goes live the moment step 8 adds one,
   and then the failure is silent in the worst way — a schema declaring a
   section placement WITHOUT `requires=("section",)` would run against
   `Unit.section == ""` on every unit and answer TRUE everywhere, which is
   precisely what `figure.frame` did before this entry. Two halves to the fix,
   and both are M-39's own shape: `Frames.section_source` mirroring
   `stanza_source`, with the population being the distinct non-empty
   `Unit.section` values; and `capabilities()` deriving `section` from the
   placement KIND rather than trusting the declaring schema to have remembered
   it. Deliberately NOT done in the same sitting as the stanza half: the
   function it changes is the one being wired into production right now, and a
   coordinate changed underneath its first caller is how the stanza half got
   its bug.
5. **The ledger slice stays ungrounded on purpose.** `_read` keeps `---` rows
   as verse and `EXTENSION_LEDGER` is recorded through it, so grounding it in
   the same commit that changed what it measures would verify nothing. The
   five are repinned there as CANNOT OBTAIN, which is true of that reader.

**TESTED WHILE OPEN.** `quality/test_grid.py` guards the two BUILT halves —
`sections_from_marks` end to end, and §M-39's stanza-ground table — while the
entry stays PARTIAL for the three above. `quality/test_relations.py` §P8 pins
that an undeclared text supplies NO ground and that a stanza-framed schema
refuses on it; `quality/test_relations_null.py` §9 pins the nine slices'
grounds by name. None of the three names the unreached half, and the entry
closes when the five null rows are re-run and `sections=` has a caller.

**TWO CONSEQUENCES THAT ARE A VOCABULARY RULING, NOT A FIX.** Supplying the
ground means `MARK_OPENS_GROUP` now decides real texts, and it refuses whole
where a mark is undeclared. Two live cases, neither papered over:

* **This repo's own example lyric refuses.** `quality/fixtures/song.txt`
  prints `[pre]`, `[bridge]`, `[outro]`; the table declares none of them, so
  its stanza ground is refused whole and the verb reports 23 found / 31
  refused where it reported ~~25/26~~. `bridge` and `outro` ARE declared
  `SECTION_FUNCTIONS` in `grid.py`, and the table already carries the
  precedent `"PATTER": True — "a music-hall function" — a function is a span`.
  Adding three rows would clear it. **They were deliberately not added**: `PRE`
  is not even a declared spelling of `prechorus`, and every existing row
  quotes a decision already written in the file. Adding rows to make a fixture
  pass is the move this table exists to prevent.
* **`corpus/song/fin_kanteletar.txt` refuses.** Its 2,405 marks include
  `[PART …]`, which `MARK_OPENS_GROUP` omits on purpose — its `MARK_REFUSED`
  reason settles that it is not a FUNCTION and says nothing about whether a
  change of speaker begins a metrical group. So the ground goes whole where
  blank lines would have supplied 2,326 groups. **That is now the same answer
  the null panel already gives for `fin`**, which is exactly the asymmetry
  this piece was opened to close — the two readers finally agree — but it is a
  large behavioural consequence and it is the owner's to accept or overturn.

**Why it matters:** `verse` and `chorus` are not decoration here. They are the
frame five relation schemas quantify over, and until this entry the frame was
supplied by a derivation that had nothing to read and said so to nobody.

### M-38 · One quantifier coordinate, two modules, two spellings — and `exists_k` counts different objects in each `PARTIAL`
**Found 2026-08-22 by `quality/relation_shapes.py`'s author while reading all
77 schemas, and verified here before filing. Step 4 of the relation ladder is
an arity/quantifier extension, so it walks straight into this.**

Two modules declare the same coordinate and neither knows about the other:

| | field | vocabulary |
|---|---|---|
| `quality/relations.py:1842` | `Figure.quantifier` | `exists` · `exists_k` · `forall` · `fraction` |
| `quality/rhyme_constraints.py:682` | `Selection.quantifier` | `pair` · `exists_k` · `forall` · `count_fraction` |

Two of the four names differ for one concept (`exists`/`pair`,
`fraction`/`count_fraction`) and two are **shared** — and the shared ones are
the problem, because sharing a name is what makes the difference invisible.

**`exists_k` COUNTS A DIFFERENT OBJECT IN EACH.**

```
relations.py:2518        nodes = {e.a.idx for e in es} | {e.b.idx for e in es}
                         if len(nodes) >= fig.k:            # distinct MEMBERS

rhyme_constraints.py:1124    if len(fs) >= s.k - 1:         # found FIGURES
```

One counts distinct member positions and tests `>= k`; the other counts
found figures in a frame and tests `>= k - 1`. **Two independent
differences** — the object counted, and the threshold — under one name.

**AND THEY AGREE TODAY ONLY BECAUSE EVERY DECLARATION USES k = 2.** Measured:
`rhyme_constraints` has exactly two `Selection("exists_k", k=2, …)` and no
other value; `relations.REGISTRY` has three `exists_k` figures — `Kalevala
alliteration (strong)`, `Kalevala alliteration (weak)`, `alliterative long
line` — all `k=2`, all `nodes=2`. At k = 2 the two formulas coincide: `>= 2`
distinct members and `>= 1` figure both mean "at least one pair". **k = 2 is
the only value at which they must.**

**WHAT IS NOT MEASURED, AND IS RECORDED AS UNMEASURED.** Nobody has run
either branch at k >= 3, because no declaration asks for it. So the
divergence is LATENT rather than observed: the formulas are different, the
single value in use hides it, and there is no test on either side that would
notice. This entry claims the code difference and the k=2 coincidence — both
verified — and claims nothing about which is right above 2. Neither
`Selection.k`'s field comment nor `_select`'s docstring explains the `k - 1`,
so the intent behind it is `CANNOT TELL` from the source (doctrine 20/28).

**Missing:** one declaration of the quantifier vocabulary that both modules
read, and a decision on what `k` COUNTS — members or figures — stated once.
**Why it matters:** step 4 extends `Mandate`'s arity to the 12 non-pair
figures, which are precisely the `forall`, `fraction` and 3-/4-node cases.
Building a third implementation beside these two is the obvious next move and
is exactly the wrong one. The reconciliation belongs before step 4, not after.
**Related:** `M-37` (the same disease in the NAME space, ruled and closed by
namespacing) and the classifier's other finding that `Figure.nodes`,
`Figure.edges` and `Figure.template` are declared on all 77 and read by
nothing — the fields step 4 needs are inert, and the quantifier they would be
read alongside is doubly declared.

---

**RECONCILED 2026-08-22 ON THE OWNER'S INSTRUCTION, BEFORE STEP 4.**

**ONE TABLE, IN THE LOWER MODULE.** `quality/rhyme_constraints.py` now
declares `QUANTIFIERS` (the four canonical names),
`QUANTIFIER_ALIASES` (every spelling either module uses, mapped onto them)
and `canonical_quantifier()`. It lives there because the dependency runs one
way — `relations.py` imports `rhyme_constraints` (lazily, one call site) and
nothing there imports `relations` — so the lower module owns the vocabulary
and the upper one reads it, cached.

**BOTH SPELLINGS KEPT AS ALIASES, NOT RENAMED.** `pair` → `exists` and
`count_fraction` → `fraction` resolve; neither module's declarations were
rewritten. A rename would edit 77 schema rows and two `RhymeType` rows for a
cosmetic gain, and doctrine 17 prefers the old word visible beside the new.

**WHAT `k` COUNTS IS DECLARED ONCE: `K_COUNTS = "members"`** — distinct
member positions. That is what the traditions mean (Kalevala alliteration is
"at least two alliterating words in the line", a count of words) and what
`relations.assemble()` already implements exactly.

**AND THE DIVERGENCE IS BOUNDED RATHER THAN GUESSED AT.**
`Selection.__post_init__` now REFUSES `exists_k` with any k outside
`EXISTS_K_PROVEN_AT = (2,)`, naming why: this module's `len(fs) >= k - 1` is
a figure-count PROXY for the declared member semantics, exact only where a
figure carries two member sites and no two figures repeat a pair — verified,
both `exists_k` rows here declare `members=(WORD_HEAD, WORD_HEAD)`.
`relations.Figure` carries no such bound because it is not a proxy.
**Neither reading was adopted for k ≥ 3**; the untested branch refuses.

**A GATE THAT DID NOT EXIST BEFORE.** `Figure.__post_init__` validates the
quantifier at construction, so a typo in one of 77 schemas refuses at import
instead of falling through `assemble()`'s if/elif chain to a silent no-op —
the same shape `unmatched` was fixed for as defect P15. Verified: all 77
resolve (`exists` 69, `forall` 4, `exists_k` 3, `fraction` 1), and
`Figure(quantifier="PAIR")` — a plausible near-miss — refuses.

**STILL PARTIAL, and this is what remains.** The vocabulary is one table and
the semantics is declared; the two IMPLEMENTATIONS are still two. Reconciling
them means either making `_select()` count members, or deciding the proxy is
what `Selection` means and renaming its parameter so it stops claiming to be
`k`. That is a behaviour change to a module this entry did not set out to
rewrite, and it is not owed until something asks for k ≥ 3.

Pinned in `test_relation_shapes.py` §11, both directions: the canonical four,
the aliases, all 77 resolving, three bad spellings refusing at construction,
a good one still building, and `Selection` refusing k ∈ {1, 3, 5} while
`Figure(quantifier="exists_k", k=7)` builds.

**TESTED WHILE OPEN.** §11 guards the half that was BUILT — one vocabulary,
one canonicaliser, the construction-time gate — and asserts nothing about the
half that remains. It cannot: the open claim is that `_select()` counts a
PROXY where `assemble()` counts MEMBERS, and pinning the proxy would freeze
the disagreement rather than surface it. The entry stays PARTIAL until
something asks for k ≥ 3, at which point the two implementations have to be
reconciled and §11 gains the row that proves they agree.

### M-37 · 26 relation names mean two different things, and the two judges disagree `CLOSED` 2026-08-22
**Found 2026-08-22 on the first move of step 3 — "route the pair-shaped
schemas through the new mandate; this is wiring" — by asking, before wiring
anything, whether the names were already taken.**

They were. `quality/relations.REGISTRY` declares 77 schema names;
`quality/rhyme_types.relation_vocabulary()` declares 80. **26 names are in
both**, and 12 of those 26 are pair-shaped, i.e. exactly the ones step 3
would route:

> additive rhyme · apocopated rhyme · assonance · consonance · eye rhyme ·
> historical rhyme · pararhyme · rime riche · semirhyme · subtractive rhyme ·
> syllabic rhyme · wrenched rhyme

**MEASURED**, 12 colliding pair-shaped names × 12 real English pairs = 144
cells, each judged twice — once by `satisfies_relation` (a per-pair predicate
over `classify_pair`) and once by `realise()` on a two-line stream carrying
the pair as end words (verified to match the end words and not the shared
`the`):

| | cells |
|---|---:|
| both answer, and AGREE | **96** |
| both REFUSE (honest agreement) | **24** |
| both answer and **DISAGREE** | **6** |
| one answers, the other REFUSES | **18** |

The six that disagree, in both directions:

| name | pair | `rhyme_types` | schema |
|---|---|---|---|
| consonance | river/forever | False | **True** |
| subtractive rhyme | skies/arise | **True** | False |
| subtractive rhyme | day/away | **True** | False |
| syllabic rhyme | mother/brother | False | **True** |
| syllabic rhyme | river/forever | False | **True** |
| syllabic rhyme | water/daughter | False | **True** |

`syllabic rhyme` is the clearest: the cell means the FINAL UNSTRESSED
syllable agrees *and the stressed one does not* — mother/brother is a
feminine rhyme, so the cell says no. The schema fires on the final
unstressed syllable alone and says yes. One name, two questions, and the
answer flips on a pair any writer would use.

And 12 of the 18 one-sided refusals are `wrenched rhyme`, where the
divergence is not a bug in either: `rhyme_types` asks a phonemic
forced-stress question; the schema asks a page-versus-performance question
and refuses without the `delivered` surface. **Two genuinely different
questions wearing one name.**

**SO STEP 3 IS NOT WIRING.** Adding the pair-shaped schema names to the
mandate vocabulary would make 12 declarations ambiguous — `relations={'A':
'syllabic rhyme'}` would mean one thing or the other depending on which
resolver ran first, which is the branch-order dependency `mandate()` already
refuses for structure-plus-relation. The reconciliation comes first.
**Missing:** a ruling on what a colliding name MEANS, and a mechanism that
makes it one thing. Three shapes exist and this entry takes none of them:
namespace the two vocabularies so a declaration says which it means; make
the schema the authority and retire the cell where they collide; or refuse
the 26 collisions outright until each is adjudicated one at a time.
**Why it matters:** every collision is a name a writer would reach for
first. These are not exotic — `assonance`, `consonance`, `pararhyme`,
`internal rhyme`, `eye rhyme`.

**AND THE MEASUREMENT FOUND A DEFECT IN CODE SHIPPED THE SAME MORNING,
already fixed.** Before the fix the split read 42 one-sided refusals, and 24
of them were `eye rhyme` and `historical rhyme`: the schema refused on all 12
pairs each while `satisfies_relation` answered a flat **False** on all 12.
The `realisation` axis is `('phonetic', 'eye', 'historical')` and only 2 of
the 49 `NAMED` keys sit off `phonetic`, so `classify_pair` — which reads a
PHONEMIC stream — can never produce them. A `False` there said "I never
looked" in the words of "I looked and it is not so", which is doctrine 20 in
a function written that morning to enforce doctrine 20. It now REFUSES and
names the surface it would need. Pinned in `test_mandate_relation.py` §5,
both directions: the three names refuse, and the 47 phonetic keys still
answer.

---

**RULED 2026-08-22 BY THE OWNER: NAMESPACE THE VOCABULARIES.** A declaration
says which vocabulary it means. Three namespaces are declared —
`class:` · `type:` · `schema:` — and `resolve_relation` now:

- takes an explicit prefix as **always unambiguous**;
- resolves a **bare** name only when it names an entry in exactly ONE
  namespace, so the 51 schema-only and 54 type-only names cost nothing;
- **REFUSES a bare name in two**, printing every prefixed form, because
  picking one would make a mandate mean whichever table was consulted first
  (doctrine 1/45);
- tries EXACT match across all three **before** any case-insensitive pass,
  and carries the same ambiguity refusal into that pass.

**AND THE RULING CAUGHT A SHARPER VERSION OF THE PROBLEM THAN THIS ENTRY
FILED.** Measured while implementing: `relation_ambiguities()` returns **26
names, every one of them `(schema, type)`** — the coarse classes escape the
list *only because they are spelled in capitals*. `ASSONANCE` resolved to the
class and `assonance` to the cell: two different relations one shift key
apart, and the case-insensitive fallback was where they would have met. That
fallback now refuses on ambiguity instead of taking a first match, so the
capitalisation is no longer load-bearing.

**THE `schema:` NAMESPACE IS DECLARABLE AND NOT YET JUDGEABLE, and that is
step 3's gate rather than this entry's gap.** `satisfies_relation` refuses a
`schema:` name outright: a `RelationSchema` is a span/placement/figure object
evaluated by `realise()` over a whole STREAM, not a per-pair predicate, so
routing it is step 3 proper — and step 3 is gated on the null sweep, because
a schema that does not beat its own null must not become enforceable. The
refusal names `type:` as the alternative when the same word exists there.

**WHAT THIS ENTRY DOES NOT CLAIM.** Namespacing makes each name mean ONE
thing; it does not reconcile the two judges. Where a name exists in both
namespaces they still disagree on 6 of 102 answerable cells, and
`type:syllabic rhyme` and `schema:syllabic rhyme` remain two different
questions. That is now visible in the declaration rather than hidden in
resolver order, which is what the ruling bought. Adjudicating which of the
two a tradition MEANS, name by name, is not owed by this entry and is not
done.

Pinned in `test_mandate_relation.py` §1: the three namespaces, the 26
ambiguities with their exact namespace pair, bare refusal on three names
with both prefixed forms in the message, prefixed resolution in all three,
bare resolution still working for the unambiguous, the exact-before-case
ordering, an undeclared namespace refusing, and the `schema:` judge refusal.

### M-36 · 17 of the 77 relations can never be nulled, and the reasons are twelve declared capabilities `BLOCKED`
**Filed 2026-08-22 as step 7 of the owner's relation ladder: declare what
cannot be done, with the constraint named, rather than leaving it looking
like unfinished work.**

`quality/relations_null.BLOCKERS` names **12 capabilities** that no run can
supply, and between them they block **17 of the 77 schemas** from ever being
measured against a null. **THIS ENTRY POINTS AT THAT TABLE AND DOES NOT COPY
IT** (doctrine 1) — a second list of blockers here is the copy that goes
stale, and the proof is one paragraph below.

| blocker kind | capabilities | what it means |
|---|---:|---|
| `obtain` | **6** | the evidence does not exist here and cannot be made to |
| `build` | **4** | derivable in principle, and a heuristic written now would decide the verdict and report it as data |
| `disjoint` | **1** | declared inert ON PURPOSE (`frames.beat`, doctrine 4) |
| unstated | **1** | the table gives a reason but no kind — a gap in the table's own shape |

Which schemas, counted apart and never summed with the swept ones:

| capability | blocks |
|---|---|
| `morphology` | homoioteleuton, polyptoton |
| `lexicon` | holorhyme, rhyming slang |
| `quotient:manner` | family rhyme, multisyllabic rhyme |
| `delivered` | transformative / bent rhyme, wrenched rhyme |
| `lifts` | alliterative long line, fourth lift must not alliterate |
| `sense` · `quotient:vowel_class` · `earlier` · `poet` · `sung` · `beat` · `orthography` | antanaclasis · proest · historical rhyme · dialect rhyme · sung-delivery rhyme · offbeat internal rhyme · eye rhyme |

**A BLOCKED SCHEMA IS NOT A SCHEMA THAT FOUND NOTHING**, and the whole
purpose of counting these apart is that the two are otherwise identical in
the output. 17 unmeasurable is a fact about this repository's evidence;
"swept and did not clear" is a fact about the relation. Reporting them as one
number would be the shape doctrine 20 exists to forbid.

**AND ONE OF THE TWELVE WENT STALE INSIDE THE SAME DAY IT WAS WRITTEN, which
is why this entry points rather than copies.** `BLOCKERS['orthography']` reads
*"Blocker: build — a second stream under the `orthography` surface"*. That was
true when written and is not true now: `quality/relations.declare_orthography`
exists as of 2026-08-22 (verified: `hasattr(R,'declare_orthography')` is True),
so the mechanism is built and the blocker moved from **build** to **declare** —
the caller must supply the rime rule, which the module deliberately does not
ship because y-as-vowel and silent-final-e are English facts and the module
serves nine languages (doctrine 45/65). `eye rhyme` still refuses on a plain
stream, so the SCHEMA is still blocked for the sweep; the REASON recorded for
it is wrong. Had this entry re-typed the table, there would now be two wrong
copies instead of one.

**Missing:** `BLOCKERS['orthography']`'s kind repinned from `build` to a
`declare` kind the table does not yet have; a stated kind for the one entry
that has none; and — the general remedy — a check that the blocker kinds stay
true, since nothing today would have caught this one moving.
**Why it matters:** the admissible set the ladder is being planned against is
a set over the schemas that CAN be swept. If 17 are unmeasurable, then "N of
77 clear their null" is the wrong denominator and the honest one is N of 60.
**BLOCKED, and the constraint is named per row rather than in general:** six
want evidence that does not exist under this repo's provenance gate, four want
a resource whose naive version would answer the question it was supposed to
measure, one is inert by declaration, and one is now mis-filed.

### M-35 · A pair can stand in many relations at once, and the mandate can hold one per group — with identical groups silently deduped `OPEN`
**Filed 2026-08-22 at the owner's observation, mid-build of the declared
relation coordinate: "each poem and song are actually N dimensional webs".
Measured before writing, and the measurement sharpens the claim rather than
just confirming it.**

**HOW MANY NAMED TYPES ONE PAIR OCCUPIES, measured over the declared
`POSITION` vocabulary and all ten `PRESETS`:**

| pair | distinct named types | where the multiplicity comes from |
|---|---:|---|
| `night`/`light` | **9** | end 4 · internal 1 · leonine 1 · cross 2 · holorhyme 1 |
| `love`/`move` | **4** | end 2 · internal 2 |
| `mother`/`brother` | **2** | end 2 |

**BUT THE DIMENSIONS ARE NOT WHAT THEY LOOK LIKE, AND THIS IS THE PART WORTH
GETTING RIGHT.** At a FIXED coordinate a pair occupies exactly ONE cell. The
four names at `night`/`light` end position — `masculine rhyme`, `single
rhyme`, `qafiya`, `antya-prasa` — are **synonyms for one relation**, four
traditions' words for the same cell, not four relations. The genuine
multiplicity has two axes and they are both coordinates the PAIR does not fix:

- **position** — the same two words are a `masculine rhyme` at line end, an
  `internal rhyme` mid-line, a `leonine rhyme` across a caesura, a `cross
  rhyme` between hemistichs. Same phonology, different relation.
- **anchor/preset** — which syllable the comparison is anchored at.
  `--preset=perfect-rhyme` and the default name different types for one pair.

So a song is a web, and its edges are labelled by **(position, anchor)**, not
by "several types stacked at one place".

**WHAT THE OBJECT CAN AND CANNOT HOLD TODAY, measured:**

```
mandate([[1,2],[1,2]])    -> groups=((1,2),)          pairs=[(1,2,0)]
mandate([[1,2],[1,2,3]])  -> groups=((1,2),(1,2,3))   pairs=[(1,2,0),(1,2,1), ...]
```

`Mandate.groups` may overlap and `pairs()` carries a group index, so **one pair
already grades under two groups** — and with the 2026-08-22 relation
coordinate, under two different relations. The web is half there. But **two
groups over the IDENTICAL line set silently dedupe to one**, so "grade lines
1 and 2 as both a masculine rhyme and an assonance" is inexpressible except by
padding one group with a spare line to keep it distinct. That is a workaround,
not a representation, and a reader of the padded mandate would not know why the
extra line is there.

**THE CODEBASE ALREADY HALF-AGREES WITH THE OWNER.** `RelationSchema.figure`
is `Figure(nodes, edges, quantifier, k, fraction, frame)` — the 77 schemas are
already declared as GRAPHS, with 12 of them carrying 3- and 4-node figures,
`forall`, `fraction` and `exists_k`. `revise.mandate_from_graph` exists. What
has not caught up is `Mandate`, which is still a cover over line groups with
one judge each.

**Missing:** a representation where the unit is a labelled EDGE — (position
pair, relation, anchor) — with parallel edges permitted between the same two
positions, rather than a cover of line groups with one relation apiece. The
node is probably a POSITION (a line-and-anchor site) rather than a line, since
`internal` and `leonine` relations do not live at line granularity at all.
**Why it matters:** every count this layer produces — capacity, density, the
relation null, the earned-partner artifact — is currently a count over pairs
under one relation. If a pair legitimately occupies several, then "how many
rhymes does this song have" has no answer until the question says which axis it
is counting along, and the numbers already banked do not say.
**Scope, and the honest bound:** this is step 4 of the owner's approved
ladder, and this entry makes step 4 LARGER than it was scoped — not just an
arity extension for the 12 non-pair figures, but multiplicity: parallel edges.
The 2026-08-22 relation coordinate is unaffected and correct as far as it goes:
one relation per group, groups may overlap, and nothing here needs undoing.

### M-34 · The named-type engine can never name a masculine rhyme, and it explains the emptiness as a fact about the vocabulary `PARTIAL`
**Found 2026-08-22 while wiring the mandate's declared-relation coordinate, by
asking `classify_pair` for the name of a pair I already knew the name of.**

```
$ python3 lyric_harness.py types night -- light
  position: None
  NAMES: UNNAMED at this coordinate — the space is larger than the vocabulary,
         and that is the point of it being a space
```

`night`/`light` is a **masculine rhyme**, one of the most named relations there
is. The sentence is not wrong about the space being larger than the vocabulary.
It is wrong about why THIS coordinate is unnamed.

**MEASURED: 31 of the 49 `NAMED` keys require a non-None `position`** — `end`
22, `internal` 4, `head` 2, `leonine` 1, `cross` 1, `holorhyme` 1 — and the
other 18 are position-free. `classify_pair(w1, w2, phon)` takes two bare words
and no line, so it leaves `position=None`, and **those 31 can never match on
that path.** The verb reports a permanent structural gap in the shape of a
finding about the vocabulary. Supplying the coordinate is enough:

| pair | `position=None` | `position='end'` |
|---|---|---|
| `night`/`light` | `()` | `('masculine rhyme', 'single rhyme', 'qafiya', 'antya-prasa')` |
| `mother`/`brother` | `()` | `('feminine rhyme', 'double rhyme')` |
| `love`/`move` | `()` | `('consonance', 'slant rhyme (consonant)')` |

**IT IS NOT TOTAL, AND THE PARTIAL EXPOSURE IS WHY IT SURVIVED.** Two of the
ten presets DO name — `--preset=perfect-rhyme` gives `perfect rhyme (last
stressed syllable)` and `--preset=cynghanedd-lusg` gives `cynghanedd lusg`,
because their anchors determine a position implicitly. So the verb is not
visibly broken; it names things sometimes. Five more presets raise
`Indeterminate` on this pair. The default path — no preset, or
`--preset=english-end-rhyme` — is the one that can never name, and it is the
one a reader will use.

**AND A SECOND NAME TABLE SITS BESIDE THE FIRST.** `t.cells()` reads
`CELL_NAMES` — **8 entries, 13 names**, per-syllable channel-agreement labels —
while `NAMED` holds **49 coordinates, 76 names**. They overlap on 6. So
`cells()` prints `('perfect rhyme', 'full rhyme', 'true rhyme')` for a pair
whose `names()` is `()`, and a reader has no way to know those come from
different vocabularies answering different questions. Doctrine 1: one question,
two tables, and the accessor a caller reaches for first is the smaller one.

**PARTIAL, because the mandate path is fixed and the verb is not.**
`quality/rhyme_types.satisfies_relation()` now takes `position` as a REQUIRED
argument on the named path and refuses without it (doctrine 45 — a checker
picking a coordinate for you is the bug), and `grade()` passes `'end'`
explicitly because a mandate's groups are line-final by construction. That
reaches the 22 `end` types plus the 18 position-free ones — **40 of 49**.

**Missing:** the `types` verb still cannot declare a position, so it still
prints `UNNAMED` for a masculine rhyme; a `--position=` flag over the declared
`POSITION` vocabulary would close it. And the message must stop explaining a
missing coordinate as a property of the space.
**Why it matters:** this is the engine the whole relation ladder is being built
on, and its most-used entry point answers "no name" to two thirds of its own
vocabulary while sounding like it has thought about it.
**Not blocking the ladder:** the 9 types needing `internal`, `head`, `leonine`,
`cross` or `holorhyme` are unreachable from an end-rhyme mandate by definition,
and that is a real bound on step 1 rather than a defect — recorded so the
count 40, not 49, is the one quoted.

### M-33 · One joint AUC pair lives in twelve places in one document, and a careful repin left seven of them stale `OPEN`
**Found 2026-08-22 while repinning `quality/RESULTS.md` for M-32, by grepping
for a figure I was about to cite beside and finding it stale in seven sentences
that were not marked superseded.**

`MISSING.md` M-31's cold re-run moved the absolute joint held-out AUCs from
0.717 / 0.964 to **0.723 / 0.960**. That repin updated the headline table. It
did not update:

| line at HEAD | site in `RESULTS.md` | what it said |
|---:|---|---|
| 64 | the two-numbers argument | "**0.964 against 0.717 cold**", gap "0.247 … narrowed by 0.015" |
| 288 | the cold-rows pointer | "Cold, the last two rows read **0.717** / **0.964**" |
| 360 | the 0.975 parenthetical | "cold it is 0.964" |
| 366 | the Exp 1 fall parenthetical | "cold, that fit reads **0.717**" |
| 416 | "The joint held-out AUCs, cold" | a row labelled **COLD, current** carrying 0.717 / 0.964 |
| 424 | the seed-median comparison | "The recorded Exp 1 draw of 0.717" |
| 560 | the doctrine-73 recap | "0.717 absolute at n = 15" |

**COUNTED, not estimated:** `git show HEAD:quality/RESULTS.md | grep -c
'0\.717\|0\.964'` returns **11**, plus the live current row M-31 added, so the
absolute joint pair is written in **twelve** places in one document. M-31
handled two of them (added the live row, struck the superseded headline row);
**three** are inside blockquotes that record superseded readings on purpose
(doctrine 17) and are correct as history; **seven** — the table above — were
left stale, one of them a table row whose own third column read **"COLD,
current"**. All seven are repinned in the same commit as this entry.

**AND A SEVENTH SITE HAD AN ARITHMETIC SLIP OF ITS OWN.** The blockquote that
withdraws the unreproducible "0.062" figure — a paragraph whose entire subject
is a number that does not check out — had the M-31 pair appended to it without
recomputing the quantity it exists to state: it read *"0.960 − 0.723 = 0.237,
narrowing **0.015**"*, and 0.262 − 0.237 is **0.025**. Corrected in place, with
the seven gaps now on record re-checked against the 0.062 claim (none produces
it; the nearest is still 0.063).

**THE DEFECT IS NOT THE STALE DIGITS, IT IS THAT NOTHING COULD HAVE CAUGHT
THEM.** `quality/test_discriminate.py` pins these AUCs to 5e-4 and would go red
the instant the *measurement* drifted. Nothing relates that pin to the eleven
places `RESULTS.md` writes the same number in prose, so a repin is a manual
grep and a manual grep is a thing that gets tired. This is doctrine 1 at
document scale: one quantity, eleven copies, and only one of them mechanical.

**WHY THE OBVIOUS FIX IS NOT OBVIOUS.** A checker that greps `RESULTS.md` for
any pinned figure and demands it match would go red on every superseded reading
the document keeps ON PURPOSE — doctrine 17 requires those to stay visible, so
a naive check would either fail permanently or force their deletion, and a
permanently red gate is one nobody reads. The distinction the checker has to
make is between a figure quoted as LIVE and one quoted as HISTORY, and the
document currently marks that only in prose (`SUPERSEDED`, `~~struck~~`,
blockquotes). Making it mechanical means giving the live/history distinction a
declared form, which is a sitting of its own.

**Missing:** an instrument that relates `test_discriminate.PINNED` to the prose
that cites it, and a declared way for a document to say "this figure is quoted
as a superseded reading" that the instrument can read.
**Why it matters:** every headline number in this repo is repinned by hand
across documents that are the deliverable. M-31's sweep was careful and still
missed six sites plus an arithmetic slip; the next one will miss a different
six. A number that is right in the pin and wrong in the sentence a reader
actually reads is wrong.
**AND THE SWEEP FOUND A SECOND DOCUMENT THE REPIN NEVER TOUCHED AT ALL.**
`git log -- quality/RESULTS_WITHIN_ITEM.md` shows its last commit predates
`bd68dff`, the M-31 repin. That file's head-to-head table labelled
**"COLD — current, measured 2026-08-13"** carried 0.717 / 0.964 and 0.638 /
0.891 against live values of 0.723 / 0.960 and **0.621** / **0.896**, and the
staleness reached its conclusions, not only its tables:

- **P1's error-ratio** read "~3.1x the error"; at the M-31 figures it is
  **~2.6x**. Third reading of one quantity — 4.9x warm, 3.1x cold 08-13, 2.6x
  cold 08-22 — and every correction so far has made the fall look SMALLER,
  which is worth knowing about a claim whose load-bearing word is
  *substantial*.
- **P2's fall** read 0.079; it is **0.102**. Verdict unchanged, size not.
- **A stated non-coincidence stopped being one.** The document carried a note
  explaining that 0.638 appearing twice was not a typo — it was both a seed
  median and an observed AUC. The observed AUC is now 0.621, so the note
  explains something that is no longer on the page.
- **A seed-distribution argument got stronger for no reason.** The recorded
  draws moved (0.717 → 0.723, 0.638 → 0.621) while the medians they are
  compared against did not, because `audit_joint_auc_null` was not re-run. The
  argument's conclusion is unaffected; its margins are now a cold observation
  against a stale null and say so in place.

**AND ONE PRE-REGISTERED PREDICTION LOST ITS COMPARATOR ENTIRELY** — see M-32.
`PREREGISTRATION_WITHIN_ITEM.md`'s P3 is *"Exp 2 wrong-sign count must fall
below five"*, and the *five* was the absolute arm's count frozen into a digit.
M-32's ruling moved that count to four, so P3 now reads 4 → 4: the literal test
still passes and measures nothing. Doctrine 58 catching itself — a recorded
count became a threshold nobody wrote down, and then the recording moved. All
three of that document's predictions have now had their comparator withdrawn.

**AND A FOURTH SITE, IN CODE, FOUND BY THE MUTATION SWEEP AND NOT BY ANY
GREP.** `quality/audit_joint_auc_null.py` carried all four observed AUCs as
string literals — `"0.717", "0.964"` and `"0.638", "0.891"` — every one
superseded by M-31. The sweep filed `test_pin_sweep.py` BASELINE-RED, and the
evidence line was the instrument's own: `[FAIL] observed AUC RECORDED 0.717,
measured 0.723`. Repinned to 0.723/0.960 and 0.621/0.896.

**AND REPINNING IT MOVED SOMETHING THIS ENTRY DID NOT EXPECT: ALL FOUR SEED
MEDIANS.** `audit_joint_auc_null.PINNED` also pins the median of the true-label
AUC over CV seeds 0..199 — deterministic, and pinned SEPARATELY from the
observed AUC on the stated ground that *"the whole seed distribution can shift
while the one recorded draw sits still, and that movement is invisible to any
check that watches only the headline."* Measured:

| arm | committed | measured | Δ |
|---|---:|---:|---:|
| abs_exp1 | 0.638 | **0.635** | −0.003 |
| abs_exp2 | 0.967 | **0.961** | −0.006 |
| wi_exp1 | 0.640 | **0.623** | **−0.017** |
| wi_exp2 | 0.900 | **0.906** | +0.006 |

`wi_exp1`'s median fell by exactly the −0.017 its observed AUC fell, so that
arm's whole distribution translated down together. The separate pin earned its
keep on its first real test.

**THAT OVERTURNS A CONCLUSION.** `RESULTS_WITHIN_ITEM.md`'s doctrine-73 rescue
of P2 rested on the within-item Exp 1 median sitting *above* the absolute one —
+0.003 warm, +0.002 cold. Corrected, it is **−0.012**. P2 now fails at the
median as well as at the recorded seed, and the rescue is withdrawn in place.
What survives is only the narrower claim that one CV seed at n = 15 is a coin
flip. The deeper reading is recorded there too: +0.003, +0.002 and −0.012 are
all inside the noise that document spends its length warning about, so the
right verdict is *this comparison has never been resolvable at this sample
size* — and the first two readings said "holds" on a margin a single upstream
bug fix could invert.

**AND I TOLD THE OWNER THE OPPOSITE, TWICE, EARLIER THE SAME DAY.** I wrote
into both RESULTS documents that these medians were "NOT re-measured against
the corrected sentinel" and that re-running them was "200 cross-validation fits
per cell, a sitting of its own". `--check` re-measures them on every run. The
claim was true only of a COLD feature cache, where 384 extractions dominate the
cost; warm, the fits are the whole of it. **A statement about a cache state,
mistaken for a statement about the measurement** — which is this entry's own
shape, one layer down. Both warnings are struck in place.

**THE SUITE THAT SHOULD HAVE CAUGHT IT WAS GREEN FOR THE WRONG REASON.**
`test_pin_sweep.py` asserted that `audit_joint_auc_null` reads `CANNOT RUN` —
true only when `data/feature_cache.json` is cold. That file is **gitignored**,
so CI is always cold and the assertion was permanently, accidentally green,
while anyone who had just run the discrimination suite got a red for a reason
unrelated to the sweep. **A suite that can only pass in one environment is not
testing the thing it names.** Both arms are pinned now, the cache state is read
first from the same loader the instrument uses so the assertion is a prediction
rather than a tautology, and the state is printed on every run. Both arms were
verified to fire: cold gives `CANNOT RUN`, warm gives `HOLDS`.

**Scope, measured 2026-08-22:** `RESULTS.md` alone carries the absolute joint
pair in twelve places; `RESULTS_WITHIN_ITEM.md` was stale throughout and is
repinned in the same commit. `CLAUDE.md` doctrine 7 was repinned separately on
2026-08-22 and is current. `NULL_AUDIT.md` is **not** stale in this sense —
checked: it carries none of the cold pairs, because §1.3 audits the WARM
0.659 → 0.604 claim and labels itself warm throughout. Its exposure is the
other one: its label-permutation nulls and 200-seed medians were measured
against the sentinel M-31 corrected and have not been re-run, which makes it
the largest unre-run thing in this arm and the reason every median comparison
in the two `RESULTS` documents now carries a warning where it is made.

### M-32 · Feature 10's committed direction and its own gloss point opposite ways, and the verdict on the feature flips between them `CLOSED` 2026-08-22
**Found 2026-08-22 by asking whether feature 10 earns its place, and finding
that the question cannot be answered as posed.**

`quality/PREREGISTRATION.md` commits the ten features with their directions,
under a rule it states in the same breath: *"Direction is committed now; a
feature that separates with the **wrong** sign counts as a failed prediction,
not a success."* Feature 10's row reads:

> | 10 | `content_word_freq_mean` — mean corpus frequency rank of content words | **LOWER** (rarer words) |

**THE TWO HALVES OF THAT CELL POINT OPPOSITE WAYS.** `Lexicon.freq_rank` is
0-based and ascending by commonness — measured: `the` 2, `and` 7, `love` 122,
`melancholy` 11,547, `thistle` 35,537 — so a LOWER `content_word_freq_mean`
is **MORE COMMON** words, and the gloss says **rarer**.
`quality/features.py` encodes `DIRECTION["content_word_freq_mean"] = "lower"`,
following the word and not the parenthetical, and the AUC is computed with
that direction applied.

**~~SO THE FEATURE'S RECORDED RESULT IS EITHER A SUCCESS OR A FAILED
PREDICTION ... and it has been carried as a success for as long as the feature
set has existed.~~ STRUCK WITHIN THE HOUR, AND THE CORRECTION INVERTS IT.**
That paragraph rested on my claim that *"the AUC is computed with that
direction applied"*, and it is FALSE. `discriminate.py:489` computes the AUC
RAW and uses `DIRECTION` only to judge the sign afterwards —
`observed = "higher" if auc > 0.5 else "lower"`, then
`observed == predicted` — and a significant result whose sign disagrees is
printed **`WRONG SIGN`**. So the instrument has detected this all along, and
`quality/RESULTS.md` has carried the verdict since the original run:

> ` xcontent_word_freq_mean            0.887   0.0000      lower  WRONG SIGN`

**THE DEFECT IS THE MIRROR IMAGE OF WHAT THIS ENTRY FIRST CLAIMED.** Nothing
was carried as a success. Feature 10 has been recorded as a FAILED PREDICTION
for the life of the project — and the class means say the data follows the
GLOSS, not the coded direction. MEASURED 2026-08-22 through the shipped
`discriminate.compute` path, not fresh code:

| arm | class | n | mean rank | median |
|---|---|---:|---:|---:|
| Exp 2 | HUMAN | 152 | **6525.3** | 6338.0 |
| Exp 2 | GENERATED | 40 | **5121.6** | 5278.1 |
| Exp 1 | SURVIVED | 15 | **6625.0** | 6489.2 |
| Exp 1 | FORGOTTEN | 117 | **6388.3** | 6175.8 |

Human verse uses **RARER** content words than generated, and survived uses
rarer than forgotten — both in the direction the parenthetical *"(rarer
words)"* predicted, and both against the coded `lower`.

**SO THE LIVE QUESTION IS WHETHER A HIT HAS BEEN RECORDED AS A FAILURE.** If
the commitment was `LOWER`, feature 10 is a failed prediction, exactly as
recorded. If the commitment was `(rarer words)` — the half the data matches —
then feature 10 is a **HIT that has been printed as `WRONG SIGN` on every run
this project has ever made**, and the count of features clearing FDR with the
predicted sign is wrong by one. That count is not decorative: the
preregistration's own falsifier is *"If **zero** features clear FDR with the
predicted sign in Experiment 1, the survival-oracle thesis has failed its
cheapest available test."*

Doctrine 1 still: one coordinate, two readings, disagreeing about the verdict
rather than about a number. What changed is which way the error runs.

**EXPERIMENT 1 CANNOT ARBITRATE IT, BY THE DOCUMENT'S OWN DECLARATION.** The
analysis plan states, before any result and expressly so it could not be
retrofitted: *"with 15 vs 119, only large effects (|AUC − 0.5| > ~0.20) are
detectable. A null here is *weak* evidence of absence and must be reported
that way."* Feature 10's Exp 1 AUC is **0.523** — |AUC − 0.5| = **0.023**, an
order of magnitude inside the zone the design says it cannot see into. Reading
that number as evidence against the feature would be quoting a null the
preregistration declared unreadable in advance (doctrine 20). The same is true
of most of the ten, which is why this entry is about the DECLARATION and not
about feature 10's worth.

**AND THE OBVIOUS WAY TO ANSWER "DOES IT EARN ITS PLACE" IS FORBIDDEN BY THE
SAME DOCUMENT.** A leave-one-out over the ten would be a criterion chosen
AFTER seeing the numbers, and the preregistration already declares its own —
a two-sided permutation test at 20,000 shuffles, Benjamini-Hochberg at
q = 0.10 across all ten — and closes the door explicitly: *"No feature outside
this list may be reported as a finding. Anything discovered later is
exploratory and must be labelled as such."* Dropping a feature on a rule
invented for the occasion is doctrine 19's shape at the level of the study
design.

**WHAT IS OWED, and it is a reading of intent rather than a measurement:**
decide which half of the cell was the commitment, strike the other in place
(doctrine 17), and re-state feature 10's verdict under that reading. The class
means above say which way the DATA runs and that is necessary but not
sufficient — the preregistration's question is what was PREDICTED, and no
measurement can answer that. **The data agreeing with the gloss is exactly
what makes this urgent rather than academic:** the cheap resolution ("the
coded direction is the commitment, the gloss was loose prose") is the one that
keeps a possible HIT recorded as a failure, so it is the reading that must be
argued for rather than defaulted to.

**IN EXPERIMENT 1 THE RULING CHANGES NOTHING BUT A COLUMN LABEL.** `WRONG
SIGN` is printed only for an FDR-significant result (`discriminate.py:508`), and
feature 10's Experiment 1 p is 0.7788, so it read *null* before the ruling and
reads *null* after. Only the `dir` column moves there.

**AND IT IS NOT ONLY FEATURE 10.** Experiment 2 records FOUR `WRONG SIGN`
verdicts — `concreteness_mean`, `concreteness_p90`, `abstract_noun_ratio`,
`syntactic_inversion_rate` — beside this one. This entry makes no claim about
those: their preregistration cells carry no contradicting gloss, so their
signs are simply failed predictions and are correctly recorded. What feature
10 has that they do not is a cell that says both things at once.

**NOT CLOSED BY THE M-31 REPIN.** M-31 corrected the stale out-of-vocabulary
sentinel and moved this feature's numbers; it did not touch what the numbers
were predicted to be. The two are independent, and this one is older — it has
been true since the feature set was registered.

---

**RULED 2026-08-22 BY THE OWNER: *the gloss was the commitment — treat it as a
hit.*** This entry asked which half of the cell was predicted, said plainly
that no measurement could answer it, and named the cheap resolution as the one
that must be argued for rather than defaulted to. The owner took the other
half. `(rarer words)` is the commitment; **LOWER** is struck.

**WHAT WAS CHANGED.**
- `quality/features.py` — `DIRECTION["content_word_freq_mean"]` = `"higher"`,
  with the ruling recorded at the line.
- `quality/PREREGISTRATION.md` — row 10 struck in place (doctrine 17) and an
  amendment section added carrying the doctrine-19 warning below.
- `quality/RESULTS.md` — the Experiment 2 sign table, both hit counts, the
  wrong-sign count, and the cold tables repinned; the two 2026-08-09 run
  transcripts left verbatim and annotated rather than rewritten.

**WHAT MOVED, AND WHAT DID NOT.** `permutation_test` is direction-free and
`joint_classifier` fits logistic regression on raw values, so **no AUC moves**
— verified against the re-run: Exp 2 feature 10 is 0.707 before and after, the
joints are 0.960 / 0.723 before and after, and the within-item half is
untouched to the digit. What moves is `dir_ok`, the printed verdict, the FDR
hit count, and the cache identity (`DIRECTION` is inside `cache_identity`).

| | before | after |
|---|---|---|
| Exp 2, feature 10 | `0.707 0.0001 lower WRONG SIGN` | `0.707 0.0001 higher HIT (FDR)` |
| Exp 2, hits at q=0.10 | 4/10 | **5/10** |
| Exp 2, wrong-sign | 5 | **4** |
| Exp 1, feature 10 | `0.523 0.7788 lower null` | `0.523 0.7788 higher null` — only the `dir` column moves |
| Exp 1, hits at q=0.10 | 2/10 | 2/10 |

**THE RESPECIFICATION HAD ALREADY SIDED WITH THE GLOSS, AND NOBODY NOTICED.**
`within_item.WithinItemFeatures.DIRECTION["wi_freq_delta"]` has read `"higher"`
since it was written. So the two modules that encode this one prediction have
**disagreed with each other for the entire life of the feature set**, and
nothing compared them — the absolute half graded a rank as if lower were rarer
and the within-item half graded it as if higher were. The ruling makes them
agree. That the respecification, written later and independently, reached for
the gloss is corroboration for the reading the owner took.

**AND A SECOND SYMPTOM OF THE SAME ROOT ERROR, FOUND WHILE REPINNING.**
`quality/RESULTS.md`'s findings list carried:

> *"I predicted human writing uses rarer vocabulary. The opposite: the
> generated sonnets reach for rarer words than Shakespeare does ... the failure
> mode is over-reaching, not under-reaching."*

**That paragraph read its own number backwards.** `permutation_test` scores the
FIRST arm and Experiment 2's first arm is `rows_h` — human — so an AUC above
0.5 says human is HIGHER on mean rank, and higher rank is RARER. The class
means say it without any convention to get wrong: human 6,525.3, generated
5,121.6. The conclusion drawn from it is the exact reverse of the measurement,
and the "folk intuition is false" reading with it. Struck in place in
`RESULTS.md`.

One confusion — reading a **rank** as if it were a **frequency** — produced
both symptoms: the boldface `LOWER`, and this paragraph. The gloss is the only
part of the original commitment that never had it.

**DOCTRINE 19 WARNING, RECORDED IN THREE PLACES AND NOT SOFTENED HERE.** This
amendment was made *after* the sign was known and it **runs in the amender's
favour**: it makes the headline hit count larger and the wrong-sign count
smaller. It is corroborated (the respecification, the class means, the prose
error running the same way) but corroboration found afterwards is not
preregistration, and this row should be read as weaker than the nine that were
never amended.

**AND IT COST SOMETHING, WHICH IS THE HALF SUCH WARNINGS USUALLY OMIT.**
`RESULTS.md` §2 argued the monoculture trap on *five* features inverting
between designs, one clause of which was "uses more common words". Feature 10
does not invert under the amended direction — HIT in Exp 2, *null* in Exp 1 —
so that section now rests on **four**, and the struck clause was never a
reading of the data at all. The demonstration is weaker by exactly that much
and says so in place.

**WHAT THIS ENTRY DOES NOT TOUCH.** The other four `WRONG SIGN` verdicts stand:
their preregistration cells carry no contradicting gloss, so their signs are
failed predictions and are correctly recorded. And the ruling does not make
feature 10 a hit in Experiment 1 — 0.523 is |Δ| = 0.023, inside the band the
analysis plan declared undetectable in advance at n = 15 vs 117, so it is not
evidence about the feature in either direction (doctrine 20).

### M-31 · A source swap left its sentinel behind, and 60% of English scored as rarer than a word nobody has heard of `CLOSED` 2026-08-22
**Found 2026-08-22 while executing the owner's ruling to refuse
`wordfreq20k.txt`, by asking what still READ it rather than by reading the
licence.**

`quality/features.py` declared `MAX_RANK = 20000  # frequency-list size;
unknown words sort past the end` — the size of `wordfreq20k.txt`. When
`Lexicon.freq_rank` was repointed to `data/opensubtitles_en_50k.tsv` the
constant stayed behind, and **a sentinel that is no longer past the end of
the list is not a sentinel.** The live list holds 49,999 entries ranked to
49,998, so an out-of-vocabulary word scored 20,000 came back **commoner than
29,998 real English words — 60.0% of the list**, `thistle` (35,537) among
them.

**FEATURE 10 IS THE RARITY OF THE CONTENT VOCABULARY**, so the defect ran that
feature backwards on exactly the words a lyric reaches for. MEASURED over 30
real song texts: **30 of 30 moved**, every one understated — min 978, median
**3,600**, max 13,214 rank points — and always in the same direction, because
an unknown word can only ever have been scored too common. Not one text was
unaffected: every one of the thirty contains at least one out-of-vocabulary
content word.

**IT WAS IN TWO MODULES, AND FIXING THE DECLARING ONE WOULD HAVE LEFT THE
OTHER.** `quality/within_item.py` imports `MAX_RANK` from `features.py` and
uses it twice, so the respecification carried the identical defect.

**DOCTRINE 58 ON ITS OWN AXIS: the number was a coordinate of the RESOURCE,
not of a threshold.** Doctrine 58 says a recorded count is a threshold nobody
wrote down; this is the same shape one step out — a constant that silently
described a FILE, and survived the file being replaced. The fix is
`Lexicon.freq_rank_oov`, derived from the list at load time, so the list owns
its own "past the end" and a future swap cannot leave it behind (doctrine 1).
`MAX_RANK` is struck in place rather than deleted (doctrine 17).

**AND THE SAME SWAP LEFT A SECOND READER STALE**, found in the same pass:
`quality/discriminate.py`'s `RESOURCE_FILES` — the tuple whose own comment
reads *"Re-fetching a norm set silently re-scales concreteness and frequency;
doctrine 58 -- the resource is a coordinate of the number just as much as a
threshold is"* — digested `wordfreq20k.txt`, a file no feature reads, and did
NOT digest `opensubtitles_en_50k.tsv`, which they all do. So re-fetching the
live source would have silently reused a feature cache scaled to the refused
one: verbatim the failure that comment warns about, in the tuple that carries
the warning.

### M-30 · The mutation sweep called a suite it could not run "already-red", and a hole it never tested "SURVIVED" `PARTIAL`
**Found 2026-08-22 by running `quality/test_mutation.py` with no bound in
order to answer a question about the SWEEP, and reading its own baseline
output on the way past.**

`quality/mutate.py` computes a green baseline before any mutation is planted:
each suite runs unmutated, a red one is excluded, and the mutation sweep is
run against the rest. Two things a suite can do there are not the same thing
and were reported as one.

**"EXCLUDED AS ALREADY-RED" COVERED A SUITE THAT WAS NEVER RUN.** The summary
line read `N excluded as already-red` over every non-`PASS` status, TIMEOUT
included. A suite with a red check IS already-red and skipping it is correct.
A suite that exceeded the bound is not red at all — it is UNRUNNABLE inside
that bound, its health is unknown, and the remedy is `--timeout`, not the
test. Charging it as red sends a reader to the wrong file (doctrine 20/79).

**IT IS LIVE, BY TEN SECONDS.** `quality/test_capacity.py` — the one suite
that re-derives 12,387 rhyme families — takes **430s** against `mutate.py`'s
**420s** default, so it is dropped from every baseline on this machine and the
summary called it red. The bound is doctrine 58's own shape: a threshold with
no measurement behind it, in a module whose `--timeout` help text already says
*"raise it instead of trusting them"* — advice nobody could follow, because
nothing measured what raising it would cost.

**AND THE SAME COLLAPSE ONE LAYER DOWN MANUFACTURES HOLES.**
`run_mutation` computed `subset_missing_from_green` — the declared catchers
this run could not ask — **and read it with nothing.** `survived` was
`not caught and not refused`, and `refused` can only hold a suite that RAN and
then timed out, so a suite the baseline DROPPED could never enter it. A
mutation whose declared catcher was dropped therefore came back
`survived=True` and was printed under this module's own heading *"SURVIVING
MUTATIONS — each one is a hole in the suite"*. A hole in the tests,
manufactured by a time bound, in the adversary that exists to find holes —
and a computed-then-discarded value, which is this repository's most-filed
defect appearing inside the module written to find it.

**THE POPULATION IS EMPTY TODAY AND THE REASON IS ESCALATION, NOT LUCK.**
Measured: **7 of the 58 mutations** declare a subset naming a suite the 420s
bound excludes (QR1–QR7, all `test_loop.py`), and **0** lose their WHOLE
declared subset — so nothing is misreported at head, because a subset that
catches nothing escalates to the full green suite. Recorded rather than
asserted, because the population becomes non-empty the moment a staging slows
one more suite, and nothing connects those two facts.

**BUILT:** the baseline summary reports `already-red` and `UNRUNNABLE` as two
counts and names the unrunnable suites with the sentence *"Every mutation only
these could catch is UNGUARDED in this run"*; `outcome(caught, refused,
missing_from_green)` is the three-way decision extracted as a PURE FUNCTION —
it lived inside a routine that forks the whole suite once per mutation, so the
only way to exercise it was an hour-long sweep, which is doctrine 48's shape
inside the module written to find it — and `INDETERMINATE` now says which of
the two reasons produced it, since the remedies differ.
`quality/test_mutation.py` §3b runs all eight combinations in microseconds and
is in the `--static` arm CI already invokes; removing the new clause reds
exactly the check that names it.

**AND THE SAME RUN FOUND TWO MORE SUITES DROPPED FOR REASONS THAT ARE NOT
FAILURES — 2026-08-22, later the same day.** The baseline's own output named
`quality/test_provenance.py` and `quality/test_propose.py` `BASELINE-RED`.
**Both PASS at head and both PASS in an isolated copy**, so both were dropped
from every mutation sweep for something other than their own health, and the
causes are different.

**`test_provenance.py` WAS REFUSING, CORRECTLY, AND HAD NO WAY TO SAY SO.**
Its §12 census shells out to `git ls-files` and its own comment says a census
that cannot see its population must REFUSE rather than pass on an empty list —
which is right, and doctrine 20. But the refusal was spelled `FAIL`, so
OUTSIDE A CHECKOUT the whole suite exited 1 with nothing wrong with it. And
`mutate.py` builds its baseline in a SHADOW TREE — `shutil.copytree` into a
temp directory, no `.git` — so this suite has been red in every mutation
baseline this repo has ever run, excluded as already-red, for a question it
was right to decline. Reproduced by copying the tree and running it:
`git ls-files returned None`. **FIXED**: the suite has a third outcome.
`refuse()` prints `REFUSED`, the summary names it, and the exit code stays 0
because nothing is red — the two cases are now told apart by asking
`git rev-parse --is-inside-work-tree` first, so an empty listing INSIDE a
checkout is still the FAIL it should be. `quality/test_provenance.py` §13 has
both arms and its anti-vacuity half is the load-bearing one: inside a checkout
it requires `REFUSALS` to be EMPTY, so a detector that always refused would
turn §12 off everywhere and could not hide behind a tidy green summary.

**`test_propose.py` WENT RED UNDER THE BASELINE'S OWN PARALLELISM.** Not
reproducible at head or in an isolated copy; the baseline runs the tree at
width `cpu_count()`. `mutate.py` re-confirms a red only when it is in
`LOAD_SENSITIVE` (one member: `test_relations.py`), is a TIMEOUT, or
`--confirm-all` was passed — and that module's own comment already wrote the
remedy: *"`--confirm-all` applies the same treatment to every red, which is
the honest setting IF THIS LIST IS EVER SUSPECTED OF BEING INCOMPLETE."* It is
now measured incomplete. **FIXED**: every BASELINE red is re-confirmed in
isolation, always. A hand-kept list of load-sensitive suites is a population
nobody wrote down (doctrine 58), and here its failure mode is the expensive
one — a false red drops a suite from EVERY mutation for the whole run. The
MUTATION runs keep the old rule deliberately: there a red is a CATCH, so a
false red reports a hole as COVERED, which is the opposite direction, and
confirming every catch would multiply the sweep's cost by its catch rate. The
baseline runs once and only its reds pay.

**AND THE FOURTH IS THE WORST OF THEM, BECAUSE IT IS THE SUITE THAT GRADES THE
REGISTER.** Measured in a REAL shadow tree built by `mutate.build_shadow`
rather than an approximation of one: `quality/test_triage.py` came back
**`ERROR  IndexError`**. Its §5 carries a correct doctrine-20 guard — *"the
population is non-empty — with no open-and-tested entry every check below
would pass on an empty set"* — the guard FIRED, and **the next line indexed
`[0]` anyway**. So a legible FAIL became a crash, and `mutate.run_test`
distinguishes those two on purpose (*"FAIL means an assertion disagreed, ERROR
means it could not run"*), which means the wrong kind of evidence reached the
baseline.

**THE CAUSE IS ONE LINE UNDER IT, AND IT IS THE SAME SENTENCE THAT FILE
ALREADY WROTE.** `triage._tracked` ran `git ls-files` and returned `[]` when
git could not answer — three lines below a comment in that same module warning
that *"an empty population here reads exactly like a clean one (doctrine
20)"*. Every entry's `tests` and `code` came back empty, so `bucket()` reported
**the whole register UNGUARDED, at exit 0** — a wrong answer, not a refusal.

**FIXED, AND THE TWO CASES ARE TOLD APART BEFORE THE LISTING.**
`NotAGitCheckout` is raised only when `git rev-parse --is-inside-work-tree`
says no; INSIDE a checkout an empty listing is a real finding and is returned
as the empty list it is, so nothing about CI moves. `triage.py --check` catches
it and prints `RESULT: REFUSED (not a pass, not a failure -- doctrine 20)` at
exit 2 instead of a clean-looking register. `test_triage.py` catches it at
module scope, asks §0 FIRST — *the register scan answered, or this run says it
did not* — and stops, because every section below it reads `ENTRIES` and an
empty register makes almost all of them pass on nothing.

**VERIFIED IN THE SHADOW TREE AT HEAD**, which is the only place these three
can be tested: `test_triage` PASS, `test_provenance` PASS, `test_verify_entries`
PASS, and `triage --check` from inside the shadow rc=2 with its reason named.
The shadow run of `test_triage` prints `REFUSED — the register was not readable
from here; no section ran` and exits 0, so it re-enters the mutation baseline
without ever claiming to have graded a register it could not see.

**AND THE CENSUS IS EIGHT — the run finished, and its own closing line is the
sentence this entry is about: `baseline: 53/61 green, 8 excluded as
already-red`.** In full, with each suite's true runtime from the same day's
62-suite sweep beside the bound that excluded it:

| suite | reported | the actual reason |
|---|---|---|
| `test_verbs.py` | TIMEOUT | **1,469s** against a 420s bound |
| `test_discriminate.py` | TIMEOUT | **892s** |
| `test_capacity.py` | TIMEOUT | **455s** — by thirty-five seconds |
| `test_loop.py` | TIMEOUT | **428s** — by eight |
| `test_provenance.py` | FAIL | a CORRECT refusal, spelled `FAIL` |
| `test_propose.py` | FAIL | red under the baseline's own parallelism |
| `test_triage.py` | ERROR | an unguarded `[0]` after its own guard fired |
| `test_verify_entries.py` | FAIL | a stray stderr line from a probe that worked |

**EIGHT OF SIXTY-ONE — 13% — AND NOT ONE OF THEM FOR HAVING A RED CHECK.**
The same sweep that measured those runtimes reports the whole tree
**62 PASS / 0 FAIL / 0 CANNOT RUN**, so every one of the eight is green when
asked on its own. The four bounds are the four most expensive suites in the
repository, which is not a coincidence: a fixed bound excludes exactly the
suites that do the most work, and those are the ones whose absence from a
mutation sweep costs the most.

**THE SEVENTH IS A DIAGNOSTIC DEFECT AND IT HID ITS OWN CAUSE.**
`test_verify_entries` was reported red with `fatal: not a git repository` —
which is NOT why it failed. `run_test`'s tail was `stderr or stdout`, so ANY
line a suite's subprocesses wrote to stderr became the stated reason it was
red, and `verify_entries.py`'s best-effort `git rev-parse --short HEAD` probe
— already correctly guarded, already answering `"unknown"` on failure — simply
did not redirect stderr. A harmless line from a probe that worked became the
published cause of an unrelated failure. **BOTH ENDS FIXED**: the probe
captures its stderr, and the tail prefers the suite's own `N FAILING:` roll-up
when there is one, falling back to stderr for a CRASH, where stderr genuinely
is the evidence. `quality/test_mutation.py` §3c drives a constructed suite that
writes a red herring to stderr AND a real roll-up, and requires the roll-up to
be the reported cause; its control requires a crashing suite to still report
its traceback, so the fix cannot blind the ERROR path. At head the suite passes
in a real shadow tree, so the underlying red was transient — which is exactly
what the baseline's new re-confirmation is for.

**EIGHT INSTANCES, FIVE CAUSES, ONE SENTENCE.** A bound, a correct refusal, a
load flake, an unguarded `[0]` and a stray stderr line all arrived at the
summary spelled `already-red`, and all of them cost the same thing: a suite
silently absent from the adversary that grades the tests.

**TESTED WHILE OPEN**, and `PARTIAL` rather than closed for one reason: **the
bound itself is still unmeasured.** 420s excludes `test_capacity` (430s) and
would exclude `test_loop` (436s), `test_discriminate` (890s) and `test_verbs`
(1,442s) if the sweep reached them — so raising it to cover the tree means a
baseline measured in hours, and choosing that number is a cost decision this
entry does not take. What is fixed is that the exclusion is now LOUD and can
no longer be read as a passing sweep.

### M-23 · `Structure` has no `kind="partition"`, and that is the same missing kind four times `OPEN`
**Found 2026-08-21, and it is the one change that serves every spec-shaped
structural source this project has located.**

`quality/structures.py` is **pair-judge shaped**: `Structure.judge(a, b, phon)`
takes two end-words. Verified at head — 58 rows, kinds `comparator` 1 /
`preset` 9 / `cell` 48, and **`partition` is absent**. Every spec-shaped source
below is a **partition over line indices**, not a pair relation. The type
already exists in the RELATION registry — `quality/relations.py:3977`,
`R105: "scheme declarations as set partitions over line indices"` — so the
vocabulary is there and the catalog cannot carry it.

| source | in repo? | per-song machine-readable? | gap | cost |
|---|---|---|---|---|
| **ltc 欽定詞譜** | yes — `data/qindingcipu_ge.tsv`, 2,286 格 rows | **yes** — `GE`/`RHYME`/`JU` on all **10,029** poems, zero `RHYME: -` | catalog row + census population type | **low** |
| **fas radif** | detector yes, data no | **no** — recomputed every run | persist per-poem, carry `min_fraction` in the column | low-med |
| **msa pantun** | schema yes | form tag yes (88 `[PANTUN ABAB]`), halves no | halves are free (always 1-2 / 3-4); the discontinuity is `H-2` | split trivial |
| **fin chain-song** | pointer yes, structure no | **no** structural header at all | needs an N-ary INCREMENT edge, not a repetition edge; n=9 stubs | med-high |

**THE ltc CASE IS THE ONE THAT SHOULD EMBARRASS US.** A 1715 spec, extracted
to 2,286 rows, validated against a second independent witness (KR4j0086, the
四庫's own 御定詞譜), emitted per-poem onto 10,029 staged songs — and its
**only consumer is `quality/ltc_overlap.py`, a standalone audit script.** The
corpus ships a perfect spec-derived partition and nothing in the grading path
can ask about it, because the catalog has no shape for it.
`ltc_overlap.read_poems` is already exactly the loader needed and should be
lifted out of an audit script into a shared one.

**NOT ONE ROW, THOUGH — the four are not one shape.** ltc is a rhyme-group
partition the SPEC declares; fas radif is a shared verbatim line-tail over a
declared line subset (which would also cover eng refrain, tur redif and the
Kanteletar's `j. n. e.` in one row); msa is a fixed 2+2 functional bipartition
INSIDE a four-line unit; fin's chain is incremental, and the increment is the
whole content. Folding them into one `partition` kind and declaring victory
would be doctrine 1 in the catalog layer.

**AND `RHYME_CONSTRAINED_FAMILIES` IS A SECOND, QUIETER BLOCKER.**
`structure_census.py:57` names only `eng_song` and `sonnets`, so **every
non-English cell would emit `constrained=no`** — false for a ghazal's radif and
for a cywydd's cynghanedd. Run 2 owes a declared entry per tradition, and the
registration's own E1 amendment owes `dactylic-rhyme`'s removal from the
constrained family (its shipped `constrained=yes` tag is VOID for consumers).

**THE QUIETER BLOCKER IS SHUT — 2026-08-22 — AND THE ENTRY STAYS OPEN ON THE
`partition` KIND, WHICH IS ITS SUBJECT.** `constrained_tag` returns
`"yes" | "no" | "undeclared"` instead of a bool. A family with no declared row
now reads `undeclared`; the two-state answer spelled it `no`, which is a CLAIM
— *this corpus's end words are not rhyme-constrained* — true of `whitman`,
which was chosen for exactly that, and false of a ghazal (doctrine 20).
`RHYME_CONSTRAINED` is a table of `(verdict, reason)` and `whitman`'s False now
carries its reason, so a measured negative and an unexamined one are different
values rather than one word.

**IT MOVES NO SHIPPED ROW, and that is asserted rather than argued.** All
16,530 rows of `data/structure_census_eng.tsv` recompute to the value they
already carry (864 `yes`, 15,666 `no`), because every family in the run-1
artifact is one of the three declared ones. A coordinate was added and no
recorded value moved.

**AND THE E1 AMENDMENT IS MECHANICAL NOW INSTEAD OF PROSE.**
`RESULTS_STRUCTURE_CENSUS.md` states *"the artifact's `constrained=yes` tag on
dactylic-rhyme cells is VOID for consumers"* — and the shipped table carries
**144 such cells, 16.7% of all 864 `yes` rows**, with nothing a consumer RUNS
saying they are struck. `VOID_CONSTRAINED_ROWS` and `void_reason(row)` are the
mechanism (doctrine 48; doctrine 17 on not quoting a falsified check as live).
**The tag itself is deliberately NOT rewritten** — the artifact is a dated
snapshot, the amendment's own text defers the drop to run 2's registration, and
rewriting it here would make the code stop describing the table it produced. So
the row STAYS in `CONSTRAINED_FAMILY` and the test pins it there, which is what
stops a later tidy-up silently moving 144 recorded cells.

**AND THE MEASUREMENT FOUND SOMETHING THIS ENTRY UNDERSTATES: THE FAMILY IS
PER-FILE.** `family_of` collapses `eng_*` to one `eng_song` and returns the
FILENAME STEM for everything else, so the tree holds **124 undeclared families
— one per non-English file**: `fas_hafez_ganjoor`, `ltc_siku_kr4j0031`,
`cym_song_alun`, each its own "corpus". So run 2's owed rows are not a dozen
traditions but a table that grows with every staging, and "a declared entry per
tradition" cannot be written against this key at all. Whether the constrained
question is asked of the FILE or of the TRADITION is itself the undeclared
coordinate, and it is owed before the rows are.

**TESTED WHILE OPEN.** `quality/test_structure_census.py` §4/§4b name M-23
while the entry stays OPEN, because they test the quieter blocker and the
amendment's reachability. They test nothing about the `partition` kind, the
four spec-shaped sources, or the `ltc_overlap.read_poems` lift — which is what
this entry is actually about, and what keeps it open. Three mutations prove the
sections: restoring the two-state tag reds 4, restoring the
`"yes" if tag(...) else "no"` call site reds the truthiness guard (`"no"` is
truthy, so every cell would tag `yes` and no example-based check would catch
it), and emptying the void table reds 2.

### M-24 · The section vocabulary is keyed on a bare token, so a mark means whatever the first tradition to claim it meant `PARTIAL`
**Found 2026-08-21 by sixteen concurrent tradition-family surveys, and three
of them hit the same wall independently.**

`quality/grid.py`'s `MARK_REFUSED` holds 13 keys — `BAYT`, `CYWYDD`, `GOTHIC`,
`MUSIC`, `NOTE`, `PANTUN`, `PART`, `PATTER`, `QUATRAIN`, `RADIF`, `SIDENOTE`,
`SLOKA`, `VARIANT` — **and every one is a bare uppercase token with no
language coordinate.** `ingest_mark` resolves a mark to its base token and
looks it up; it takes no language and cannot.

**THE WORKED CASE, and it is one staging away from live.** `MARK_REFUSED
["PART"]` reads *"a speaker or role attribution in the Kalevala wedding songs
(`[PART: Kaason puoli]`), not a section function."* Irish dance music's A-part
and B-part are ordinary section names. **The moment an Irish tune is staged
with `[PART A]`, it is refused with a sentence about Finnish wedding songs
quoted over it** — a true refusal, in the wrong language, about the wrong
object. Nothing in the table can express that `PART` means one thing in `fin`
and another in `gle`.

**IT IS ALREADY LIVE ONE LAYER OVER.** `../api/instruments/manman_drum.json` — outside this harness, in the
CodexMusica tree, and spelled relative to it so the path check resolves
it rather than reading a true citation as a false one —
declares `manman_kase` with `match_tokens: ["break"]` — the Haitian drummed
cue that *starts and stops* an ensemble — while
`quality/fixtures/string_meter.blueprint.json` declares a section named
`break`, the English instrumental gap. **One token, two traditions, opposite
functions.** `as_function(value)` takes one argument; `_FUNCTION_ALIASES`
guards alias-shadowing and nothing guards two traditions claiming one name.

**AND IT IS NOT ONLY REFUSALS.** The same defect runs through the positive
table: `SECTION_FUNCTIONS` declares 21 functions on bare names, so `bridge`
means the POP bridge — declared four ways over (`recurrence="once"`,
`contrasts_with=("verse","chorus")`, the middle-8 aliases, `bridge_contrast()`
and `BRIDGE_IS_A_VERSE`) — and **the sonata bridge is a `connective` that
RECURS**, which the same row cannot also mean. Two more false friends found
the same day: fugal vs sonata *exposition*, and *stretto* vs *stretta*.

**THE MARK HALF IS BUILT — 2026-08-22 — AND THE FUNCTION HALF IS NOT, WHICH
IS WHY THIS IS `PARTIAL` AND NOT CLOSED.** `MARK_REFUSED` is keyed on
`(language, mark)`; `ingest_mark` takes a `language`; `read_marked_songs`
DERIVES it from the filename prefix — the same three characters the phonology
has dispatched on since doctrine 45 — and hands it over. The coordinate was
on the path the whole time: this reader has taken `language=` since it was
written, stored it on `MarkedSong`, and passed it to the one function that
decides what a mark MEANS never. `audit_corpus` calls it with no language at
all.

**THREE ANSWERS NOW, AND THE MIDDLE ONE IS THE ENTRY'S OWN WORKED CASE.**
A mark refused IN THIS LANGUAGE gets that language's written reason. A mark
refused in some OTHER language and not this one gets `MARK_REFUSED_ELSEWHERE`
— and the other tradition's sentence is deliberately NOT quoted, because a
reason about Kalevala wedding songs is a true statement in the wrong language
about the wrong object, and answering with it is worse than not answering
(doctrine 20: nobody has written what `PART` means in Irish, which is not the
same as its having been decided). A mark asked with NO language declared still
gets its decision, LABELLED with the tradition it was written for — so every
one of the 1,423 staged files reads exactly as before, and what changed is
that the table's single voice is no longer read as universal.

**MEASURED BEFORE THE TABLE WAS TOUCHED, AND THE MEASUREMENT IS WHY THIS WAS
LATENT RATHER THAN LIVE.** Over the whole of `corpus/song/`, EVERY refused
mark occurs in EXACTLY ONE language — `BAYT` 70,866 and `RADIF` 54,193 in fas,
`SLOKA` 136 in san, `PANTUN` 88 and `QUATRAIN` 41 in msa, `PART` 61, `NOTE` 48
and `VARIANT` 18 in fin, `CYWYDD` 1 in cym, and the rest in eng. So no reason
in the table is currently quoted over a tradition it was not written for, the
languages in the new keys are READ OFF that measurement rather than assigned,
and `mark_coverage.py --check` is byte-identical either side of the change
(typed 76,930 / decided 125,504 / undecided 32 / apparatus 59). A coordinate
was added and no number moved, which is the control that says the fix is a
coordinate and not a re-decision.

**`MARK_FUNCTION` IS DELIBERATELY NOT GIVEN THE SAME KEY, on the same
measurement.** `VERSE` is carried by eng, ltc, fin, cym AND san; `REFRAIN` by
four languages; `BURDEN` by two. The positive table is genuinely shared, so
keying it per language would manufacture five rows saying one thing —
doctrine 61's shape, a rule that fires more often is not a better rule.

**AND `gle` IS THE LIMIT, ASSERTED SO IT CANNOT READ AS CLOSED.**
`language_of_path` checks the prefix against `phonology.declared()` rather
than trusting it, so a fixture named `marked.txt` yields `""` and not the
language `mar`. The consequence is that THIS ENTRY'S OWN IRISH EXAMPLE cannot
reach the `MARK_REFUSED_ELSEWHERE` branch BY PATH — `gle` is not a declared
phonology, so a `gle_*.txt` file would derive no language and take the
labelled-reason route. Reaching it needs a caller to pass the language, or the
staging vocabulary to grow. `quality/test_grid.py` §32 asserts that limit as a
check, not as prose.

**ONE MORE THING THE FIX SURFACED AND DID NOT REPAIR:** the language
vocabulary is typed TWICE — `audit_corpus.LANG_PREFIX` is a hand-kept dict of
the same nine codes `phonology.declared()` returns (doctrine 1). Merged by
neither, because that table is read by a pinned audit; §32's last check
asserts the two sets are equal instead, so the duplication cannot drift while
it stands.

**TESTED WHILE OPEN**, and `triage.py --check` is what required this sentence
rather than a reader noticing: `quality/test_grid.py` §32 names M-24 while the
entry stays `PARTIAL`, which is CONTESTED until the body says why. The why is
the split above — §32 tests the MARK half, which is built, and asserts the two
limits (`gle` does not derive; the language vocabulary is typed twice) as
checks rather than as prose. It tests nothing about the FUNCTION half below,
and the entry stays open on that.

**STILL OPEN, AND IT IS THE HALF WITH THE FALSE FRIENDS IN IT:**
`SECTION_FUNCTIONS`' 21 functions are still declared on bare names, so the pop
`bridge` and the sonata `bridge` are one row that cannot mean both, and fugal
vs sonata *exposition* and *stretto* vs *stretta* are unaddressed. That is a
claim about the FUNCTION vocabulary rather than the MARK vocabulary, and
`RESULTS_MARK_COVERAGE.md`'s adopted answer — a global closed FUNCTION
vocabulary with per-tradition NAME rows — is still what it needs.

**WHAT IS OWED is a coordinate, not a bigger table:** a mark and a function
resolve under a declared LANGUAGE (or tradition), the way the phonology
already dispatches on the filename prefix (doctrine 45). `RESULTS_MARK_
COVERAGE.md`'s adopted answer — a global closed FUNCTION vocabulary with
per-tradition NAME rows — is exactly the shape that fixes this, and this entry
is the mechanical half of it. Until it exists, **every refusal reason in the
table is true only of the tradition that wrote it**, and no reader is told
which one that was.

### M-25 · Three staging defects the marks cannot show, found by asking sixteen traditions at once `OPEN`
**Found 2026-08-21. Each is a file whose own header or content contradicts how
it is marked, and none is visible to any current check.**

**(a) APPARATUS TYPED AS SUNG VERSE — 940 blocks in 67 files, and the surveys
found 17 of them.** Two tradition surveys reported a handful of opera headings
(`Recitativo`, `Air`) typed as verse. Asking the corpus the general question
instead — **one-line `[VERSE]` blocks whose single line is apparatus** — the
population is far larger. Rule stated so the count is re-derivable: a block
holding exactly one non-blank line, classified by that line's shape.

| what the single line is | blocks | examples |
|---|---:|---|
| an ALL-CAPS short label (≤4 words) | 493 | `B. TAYLOR.` · `ETHEL LYNN BEERS` · `EVENÈN IN THE VILLAGE.` |
| a Roman numeral | 240 | `I.` · `V.` · `II.` |
| an Arabic numeral or year | 191 | `1845.` · `1847.` |
| a printed heading word | 16 | `Recitativo` · `Air` |
| **total** | **940** | across **67** files |

Concentrated: `eng_hall_william_barnes.txt` 224, `fin_eino_leino.txt` 167,
`eng_american_henry_wadsworth_longfellow.txt` 110.

**THE FOUR CLASSES ARE AT LEAST THREE DIFFERENT OBJECTS, and reading the
context is what shows it** — so this is a census and not yet a repair list:
- **POEM TITLES.** `eng_hall_william_barnes.txt` runs `[VERSE 3]` /
  `BRINGEN WOONE GWAÏN[A] O' ZUNDAYS.` / `[VERSE 4]`. That is a second poem's
  TITLE inside one `--- TITLE:` item — a false unit (`M-20`'s family) whose
  title is additionally scored as sung text.
- **SPEAKER ATTRIBUTIONS.** `eng_american_henry_wadsworth_longfellow.txt`
  runs `[VERSE 2]` / `MERRY (_within_)` / `[VERSE 3]`. A drama's speaker name
  plus a stage direction, typed as a verse. **This is exactly the object
  `MARK_REFUSED["PART"]` refuses in Finnish**, escaping only because an
  English printer used no bracket — which is `M-24`'s missing language
  coordinate arriving from the other side.
- **NUMERALS AND BYLINES.** Stanza numbers, publication years and author
  attributions, none of them sung.

**ALL 940 ARE SCORED AS WORDS**: they enter MATTR, the function-word ratio,
the rhyme graph, the endword population and every per-line rate. The Burns
cantata's `Air` headings are additionally the named-air field (`M-11`) printed
in the body rather than in a header.

**NOT REPAIRED HERE, and the reason is `M-20`'s.** Deciding what each block is
requires reading the printing, and the classes want different remedies — a
title wants an item split, a speaker attribution wants a mark, a numeral wants
dropping. What is owed first is the discriminator, and it is cheap: a one-line
`[VERSE]` block whose line matches none of the sung-text shapes is a candidate,
and the corpus audit can raise it without anyone adjudicating a poem.

**THE DISCRIMINATOR IS BUILT — `audit_corpus.py` CHECK H, 2026-08-21 — AND
EVERY FIGURE IN THE TABLE ABOVE IS SUPERSEDED BY IT.** The table's 940/67 was
this question asked by a session script whose shape rules were never written
down, and the rule is the number (doctrine 58). Four ways it was narrow, each
found by writing the table into a module: no `D` or `M` in the roman class, no
comma inside the arabic one, a strict character class that dropped every
dash-joined range (`XLIV.—XLVI.  DA.`), no ornament class at all
(`*  *  *  *  *`), and no flush at end of file — so a file whose LAST block is
a one-line `[VERSE]` block was never asked about it, 13 files, silently.

Check H reports **THREE COUNTS AND NEVER SUMS THEM**, which is the other half
of the repair. Over `corpus/song/`, 72,803 `[VERSE]` blocks:

| | blocks | files |
|---|---:|---:|
| one-line `[VERSE]` blocks — the CANDIDATE population | 2,550 | — |
| MATCHED a declared apparatus shape — charged, WARN | 1,045 | 105 |
| RESIDUE — reported UNADJUDICATED, never as clean | 1,505 | 48 |

Shapes: `allcaps-label` 512 · `numeral` 445 · `ornament` 72 · `heading-word`
16. **The residue is the bigger half and the census never saw it**, sampled at
n=50 (seed 20260821): roughly a quarter is real text — single lines of
dramatic dialogue, which is a DIFFERENT staging defect — and the rest is
apparatus in shapes the table deliberately does not spell, because a false
positive there would be manufactured. THREE CLASSES THE 940 MISSED ENTIRELY,
and each is a whole file's worth: **`eng_hymn_watts.txt` 444**, every one a
printed scripture argument (`The nativity of Christ, Luke 1. 30 &c.`);
**`eng_british_richard_lovelace.txt` 113**, every one a modern editor's
textual footnote (`Original reads NEERE.`, `i.e. own.`); and
**`eng_celtic_robert_burns.txt` 186**, subtitles and `Tune--"..."` lines,
which are the named-air field (`M-11`) printed in the body.

**AND THE CHECK MANUFACTURED A FINDING ON EACH OF ITS FIRST TWO RUNS — same
defect one script apart, both doctrine 45, neither visible by reading the
rule.** Run 1 charged `ltc_siku_kr4j0074.txt`'s `欲寄逺憑誰是。`, a sung line of
a 詞: one whitespace token, no lowercase character, because CHINESE HAS NO
CASE. Run 2 charged `eng_british_lord_byron.txt`'s `Ζωή μου, σᾶς ἀγαπῶ.` —
*Maid of Athens*'s Greek refrain, the most sung line in the poem — because the
lowercase test was the Latin-1 class `[a-zà-öø-ÿ]`. Both are pinned as
false-positive regressions in `quality/test_corpus_audit.py` §4b, because a
fix that is not tested is a fix that comes back.

**14 OF THE 940 ARE REPAIRED, AND THEY ARE THE ONLY SUBSET THAT NEEDED NO
ADJUDICATION.** The pìobaireachd movement headings — `URLAR.`, `SIUBHAL.`,
`CRUNLUATH (FINALE).` — in `eng_celtic_msm_alexander_macdonald.txt`,
`eng_celtic_msm_duncan_macintyre.txt` and
`eng_celtic_msm_robert_mackay_rob_donn.txt` are now MARKS (`[URLAR]`,
`[SIUBHAL 2]`, `[CRUNLUATH] (FINALE)`), declared in `grid.MARK_REFUSED` with
the reason: they ARE spans of the performance, and this vocabulary has no
member for a movement in a VARIATION LADDER, so folding them into `verse`
would say the theme and its ornamented restatements are the same kind of
thing (`PATTER`'s argument, one tradition over). The mark is left EMPTY on
purpose — a movement runs over several printed stanzas and a `Block` carries
ONE mark, so marking the first stanza would under-read the rest while looking
like a complete answer. `[VERSE n]` indices under each heading are renumbered
consecutively; no sung line was added or removed; the three md5s are repinned
in `data/sources.tsv` with the reason beside them. The repair is visible in
the check's own numbers as exactly −14 out of the MATCHED half and 0 out of
the residue, which is the signature of a repair rather than a rule change.

**TESTED WHILE OPEN, and the split is exactly 14 against 1,045.** Check H is
built, wired into `audit()`, and pinned by `quality/test_corpus_audit.py` §4b
with five proven mutations (rule broken two ways, flush removed, emission
stubbed, check unregistered) — so the DISCRIMINATOR this entry asks for is
finished and has a regression. The entry stays `OPEN` because the
discriminator is not the repair: 1,045 charged blocks across 105 files are
still typed as sung verse, the residue of 1,505 is still unadjudicated, and
the three remedies the classes want — an item split, a mark, a drop — each
need a reading of the printing that no check can do. Doctrine 17: the built
half is real and is not quoted as if it closed the entry.

**THIS UNBLOCKS THE POINTER.** `quality/SECTION_ORDER_PREREGISTRATION.md` says
in as many words: *"1. `M-25(a)` — stage the movement headings as marks rather
than as verse lyrics. 2. THEN `elaborates` has 14 sections in 3 songs to point
at."* Step 1 is done, and reading the printing to do it found the reason step
2's sibling `rank` was refused: in `THE PRAISE OF MORAG` the FIRST movement is
printed with NO heading at all — the page sets a heading only where the
movement CHANGES — so the ladder's own head is unmarked in the corpus, and a
`rank` over these marks would be ordering a sequence the corpus never shows
whole.

**(b) A file that declares a structure it does not carry.**
`corpus/song/ltc_huajianji.txt`'s header states *"`[VERSE n]` marks a 片
(pian) — the stanza the TUNE divides"*, and the file holds **500 poems and
exactly 500 `[VERSE]` marks: zero 片 boundaries.** Its 更漏子, a canonical
雙調 in two equal halves, is one block. All **9,023** real 片 boundaries in
the corpus are in the 66 `ltc_siku_kr4j*` files. One ltc file states the
convention and another implements it, and nothing compares the two.

**(c) The boundary has ONE witness, and it is not the spec.** Recorded here
because it bounds what `M-23` can claim for `ltc`: the 片 break comes from the
1782 woodblock's full-width space, not from the 欽定詞譜, whose seven columns
hold no partition above the line. **And the rhyme cannot supply it** —
measured, **7,374 of 8,982** two-片 poems (82.1%) have ONE rhyme group
spanning all 片, and **8,971 of 8,982** (99.9%) boundaries sit on a rhyming
line end indistinguishable from every other 韻. So the ci corpus supports a
SECTION claim and **specifically refutes a rhyme-partition one**, which is the
opposite of what `M-23` assumed for this language and is the sharper reading.

**Also measured and not repaired:** `0 of 8,982` two-片 poems show a verbatim
片1↔片2 return, so nothing in a ci is `goal` — the "換頭 is a bridge the
vocabulary cannot ask about" worry (`RESULTS_MARK_COVERAGE.md` §5) **dies on
its own evidence**: 換頭 is the altered opening LINES of the second 片, a
phrase-layer object, its complement is 重頭, and the boundary's own name is
過片. The 66 headers use 換頭 where 過片 is the word, and **5,022 of 8,982
(55.9%) two-片 poems have equal-length halves**, so the term is indicatively
wrong for a majority of the poems those headers describe.

### M-26 · The variation ladder answers VERBATIM to traditions whose variation is not in the words `OPEN`
**Found 2026-08-21 by two tradition surveys that hit it independently, from
opposite ends of the Indian subcontinent, and confirmed here by construction.**

`quality/grid.py`'s `VARIATION_KINDS` was ~~15~~ named kinds and **every
one compared WORD CONTENT.** (The cardinality is struck and NOT replaced:
`CLAUDE.md`'s known gap 7 records a commit written to repair a stale
count writing one that was stale on arrival, and the argument here does
not turn on the number — `python3 -c "from quality import grid as G; "`
`"print(len(G.VARIATION_KINDS))"` is beside it.) So a return that holds the text fixed and varies
something else scores **`VERBATIM`** — the strongest available claim that
nothing changed.

- **Carnatic `sangati`**: the defining device of a kṛti's exposition. It holds
  the *sāhitya* (the text) fixed and varies the melodic line. Every sangati in
  a song therefore returns `VERBATIM`.
- **Hindustani `bol-baant`**: variation by redistributing the SAME words across
  the tāla. Identical words, different rhythmic placement — `VERBATIM` again.

**THIS IS NOT THE HARNESS OVERREACHING ITS TEXT, IT IS THE HARNESS MISREPORTING
ITS SILENCE.** Doctrine 93 is satisfied — melody and placement are not in a
lyric sheet and this layer should not claim them. The defect is that
`compare_returns` HAS a refusal channel (`Return.refusals`, today
`STUB_RETURN` / `NO_RHYME_KEY` / `END_WORD_UNREADABLE`, and `NO_RHYME_KEY`
refuses *"a silent default here would make a claim about a language nobody
named"*) **and no member of it says "the channel this tradition varies is not
in the text."** Doctrine 20 exactly: inconclusive-by-construction returned as
a null, and here as the most positive null the vocabulary has.

**TWO FURTHER GAPS IN THE SAME LADDER, measured by construction rather than
taken on report — and BOTH ARE NARROWER THAN THE SURVEYS CLAIMED.**

| constructed return | ladder says | `invariant_lines` |
|---|---|---|
| all 4 lines return, **order changed** | `ANAPHORIC_RETURN` | `()` |
| same body, **final line substituted** (ouvert/clos) | `LEXICAL_VARIATION` | `(1, 2, 3)` |
| *control:* one **interior** line changed | `LEXICAL_VARIATION` | `(1, 3, 4)` |
| *control:* verbatim | `VERBATIM` | `(1, 2, 3, 4)` |

1. **A RESEQUENCED RETURN HAS NO NAME.** Every line came back and the ladder
   reports a kind about heads recurring. `invariant_lines` is `()` and that is
   **defensible** — the field is documented as *"indices WITHIN the section
   that survived unchanged"*, i.e. positional, and the alignment is
   order-preserving by construction. So the survey's claim that the field is
   FALSE is **not** carried here; what is carried is that no kind can say
   *same lines, resequenced*, and the kind it does report is a positive claim
   about a different property.
2. **A SUBSTITUTED CADENCE IS INDISTINGUISHABLE FROM AN INCIDENTAL EDIT.**
   Rows 2 and 3 of the table are the same verdict on two different objects.
   The ouvert/clos pair — one body, two endings, open and closed — is a named
   formal device in the estampie, the virelai, the ballade and the medieval
   dance repertory generally, and it reports what a typo would.
   `HEAD_PRESERVED` and `TAIL_PRESERVED` show position IS partly modelled, so
   this is a missing member rather than a missing axis. The surveys proposed
   `PARTIAL_RETURN` and `CADENCE_SUBSTITUTED` as the observed and wanted
   labels respectively; **neither reproduces here** — the observed label is
   `LEXICAL_VARIATION`, and that is the figure this entry carries.

**WHAT IS OWED, and the cheap half is not the ladder.** The refusal member is
the cheap half and it is the one that stops a wrong answer: a declared
`VARIES_OFF_TEXT` refusal, reachable when a tradition declares that its
variation channel is not the words, turns a false `VERBATIM` into a stated
`cannot tell`. The two missing KINDS are a preregistration each and neither is
urgent, because both misreport a shape rather than assert a falsehood. **The
`VERBATIM` is the one that lies.**

**THE CHEAP HALF IS BUILT — 2026-08-22 — AND IT IS THE HALF THIS ENTRY SAID
STOPS A WRONG ANSWER.** `VariationDeclaration.varies_off_text` is a declared
coordinate naming the channel a tradition varies when that channel is not the
words (`"the melodic line (Carnatic sangati)"`,
`"placement across the tāla (Hindustani bol-baant)"`). Declared, a return whose
WORDS are identical earns the `VARIES_OFF_TEXT` refusal and the new headline
kind `TEXT_VERBATIM_CHANNEL_UNREAD`, ranked ABOVE `VERBATIM` — so a sangati
stops reading as the strongest available claim that nothing changed and starts
reading as *cannot tell*, which is what it is (doctrine 20). The refusal names
the declared channel, so a reader learns WHICH question went unanswered rather
than only that one did.

**THE MEASUREMENT IS KEPT, NOT DELETED (doctrine 24).** `qualities` still
carries `VERBATIM`: the words really are identical and that is true. Only the
HEADLINE moves, because `kind` is what a consumer reads. Trading one false
claim for a missing one would be the worse repair.

**UNDECLARED IS BYTE-IDENTICAL**, which is what makes it safe: the field
defaults to `""`, every comparison this repo has ever made reads unchanged, and
the whole feature is unreachable without a caller's declaration. Doctrine 93 is
respected throughout — melody and tāla placement are not in a lyric sheet and
this layer still claims neither; what changed is that its SILENCE is now
reported as silence.

**AND THE RELABEL BROKE TWO TRUE FINDINGS UNTIL THE CONSUMERS WERE MOVED ONTO
THE QUALITY.** `RETURNS_WITH_SAME_WORDS` and `RETURN_LOCKED` both gated on
`kinds == {"VERBATIM"}` — the HEADLINE — while both ask about the WORDS. Under
a declared off-text channel the headline is no longer `VERBATIM` and both
findings would have vanished, silently, for a caller who had told the harness
something true. They read `"VERBATIM" in r.qualities` now. The two spellings
could not disagree BEFORE this row existed — the only other kind above
`VERBATIM` is `STUB`, which carries no `VERBATIM` quality — and
`quality/test_grid.py` §33 asserts that equivalence so the rewrite is provably
a no-op on every existing comparison.

**STILL OPEN — the two missing KINDS.** A resequenced return still has no name
and a substituted cadence (ouvert/clos) is still indistinguishable from an
incidental edit; both are a preregistration each, and this entry's own reading
is that neither is urgent because both misreport a shape rather than assert a
falsehood. **TESTED WHILE OPEN**: §33 tests the refusal member and nothing
about those two kinds.

**AND §22 CAUGHT THE COMMIT ON ITS WAY IN**, which is the guard working: it
requires every member of `VARIATION_KINDS` to have a fixture that REACHES it as
the reported kind, so the new row failed there rather than shipping unreachable.
Its fixture is a VERBATIM pair and the DECLARATION is the whole difference,
which is the property the section exists to pin. §22's own heading and two of
its messages said *"the fifteen kinds"*; the cardinality is struck rather than
incremented, for the reason `CLAUDE.md`'s known gap 7 records — a commit written
to repair a stale count once wrote one that was stale on arrival.

### M-27 · A footnote letter is the end word of 68 rhyming lines, and 1,166 file headers declare it was stripped `OPEN`
**Found 2026-08-21 by the owner asking the right question after `M-25(a)`:
poems carry LINE NUMBERS, usually by fives, and scores carry time signatures
and tempo marks — is any of that being scored too? Three of the four answers
are reassuring and the fourth is the sharpest staging defect found so far.**

**THE THREE THAT ARE FINE, AND THE REASON IS ONE DESIGN DECISION.** Measured
over all **581,468 sung lines** of `corpus/song/` — every line no reader drops
as `#`/`--- `/`[`:

| what | lines | reaches a measurement? |
|---|---:|---|
| a trailing printed line number (`  heart.    10`) | 195 | **no** |
| a time signature anywhere in a sung line (`4/4`, `6/8`) | **0** | — |
| a tempo or expression mark (`Andante`, `crescendo`) | 5 | no — all 5 are SUNG WORDS |
| a page or folio reference (`p. 255`, `vol. i.`) | 41 | no |

`_TOKEN` is `[^\W\d_]+`, **letters only**, so a bare numeral produces no token
at all: a trailing `10` contributes nothing to the token count, nothing to
MATTR, nothing to the density band, and `raw_final_token` walks straight past
it to the real end word. Coleridge's 79, Christina Rossetti's 78 and Keats's
22 numbered lines are all read correctly. The same rule is why `M-25(a)`'s
`numeral` class (445 blocks) is the LEAST damaging of its four: those blocks
add a line to the line count and **no words to any word count**. The time
signature is a MEASURED ZERO over a named population (doctrine 79) and not an
absence nobody looked for; the 5 tempo hits are `With his soft crescendo now;`
and `Nae "lente largo" in the play,` — sung words that happen to be Italian
musical terms, correctly not apparatus.

**THE ONE THAT IS NOT FINE: a bracketed LETTER is a word to a letters-only
tokeniser.** 93 markers survive in sung lines across 9 files, and **68 of them
are the line's END WORD** — the one token a rhyme harness cares most about.

| file | markers | end word wrong |
|---|---:|---:|
| `eng_british_lord_byron.txt` | 54 | **54** |
| `eng_hall_thomas_durfey.txt` | 10 | 6 |
| `eng_british_robert_herrick.txt` | 9 | 2 |
| `eng_hall_william_barnes.txt` | 7 | 5 |
| `eng_british_richard_lovelace.txt` | 5 | 1 |
| `john_dowland` · `john_wilbye` · `thomas_campion` · `msm_charles_james_finlayson` | 6 | 0 |
| **total** | **93** | **68** |

What the harness reads, against what the page prints:

```
It has not been your lot to see,[a]              end word 'a'   not 'see'
May match the dark-eyed Girl of Cadiz.[d]        end word 'd'   not 'Cadiz'
And this dark heart is vainly craving[me]        end word 'me'  not 'craving'
That joint to ashes burnt should be,[E]          end word 'E'   not 'be'
God speed the Colonel on the hill,[D]            end word 'D'   not 'hill'
```

Every one is a rhyme-bearing line whose rhyme word has been replaced by a
Project Gutenberg footnote label, and the labels run in sequence — `a b c d g
j k l o p q r s`, then `bx by bz ca cb …`, then `le lf lg …` — so Byron's 54
are 54 pairs whose partner is a letter of the alphabet. **ONE INSTANCE OF
THIS IS ALREADY IN THE RECORD AND WAS READ AS SOMETHING ELSE**: `CLAUDE.md`'s
known gap 8 cites Byron's `...lay white on the turf,[mm]` as
`substitution_report`'s "invented relation #4" — a final token that reads and
yields no syllable — and files it as a `word_syllable_map` edge case. It is
that, and it is also the 47th of 54 footnote anchors in one file.

**~~1,166 FILE HEADERS DECLARE THIS EXACT STRIP AND 9 LEAK. Byron's own header
reads "stripped: PG header/footer, editor's biographical memoirs, `[n]`
footnote markers and footnote bodies".~~ CORRECTED 2026-08-22, AND THE
CORRECTION IS THE BETTER FINDING.**

**BYRON'S HEADER SAYS NO SUCH THING.** It declares `author`, `region`, three
`source` rows, two `licence` rows, two `edition` rows, a `note` and a
`structure` line, and it contains the word *footnote* nowhere. The sentence
quoted above was lifted from a DIFFERENT file: a repo-wide grep for `[n]`
returned hits from `eng_celtic_carolina_oliphant_lady_nairne.txt` and
`eng_celtic_james_hogg.txt` among others, and the first three lines of that
output were read as though they were Byron's. One grep, three files, attributed
to one. This entry asserted it as a quotation.

**MEASURED PROPERLY, the picture inverts and gets sharper.** 1,199 files
mention a footnote strip in their header. Of the **9 files that leak markers,
only 3 declare a strip** — Lovelace, Wilbye and Finlayson — and two of those
three leak **zero** end-word corruptions:

| file | markers | end word wrong | declares a strip? |
|---|---:|---:|---|
| `eng_british_lord_byron.txt` | 54 | **54** | **no** |
| `eng_hall_thomas_durfey.txt` | 10 | 6 | no |
| `eng_british_robert_herrick.txt` | 9 | 2 | no |
| `eng_hall_william_barnes.txt` | 7 | 5 | no |
| `eng_british_richard_lovelace.txt` | 5 | 1 | yes |
| `eng_british_john_dowland.txt` | 3 | 0 | no |
| `eng_british_john_wilbye.txt` | 2 | 0 | yes |
| `eng_british_thomas_campion.txt` | 2 | 0 | no |
| `eng_celtic_msm_charles_james_finlayson.txt` | 1 | 0 | yes |

**SO THIS IS NOT A DECLARED RULE LEAKING — IT IS FILES STAGED WITHOUT THE RULE
AT ALL, AND NOTHING ASKING.** The files that declare the strip overwhelmingly
achieve it; 67 of the 68 corrupted end words are in files whose stagers never
claimed to strip footnote markers. That is a WORSE defect than the one this
entry originally described and a different one: a missing declaration cannot be
checked against the text, so no doctrine-93 comparison was ever available. What
is owed is not a checker for a claim — it is the claim.

**NOT REPAIRED HERE, AND THE REASON IS THAT THE SHAPE IS THREE OBJECTS —
`M-25(a)`'s lesson arriving one layer down.** All 93 look like `[x]`:

1. **A FOOTNOTE ANCHOR** → drop it. Byron 54, Barnes 5, Herrick 2.
2. **THE `œ` LIGATURE written as a bracketed digraph** → expand to the two
   letters. 13 of these, every one a Latin or Greek word: `Ph[oe]bus`,
   `ph[oe]nix`, `F[oe]mina`, `C[oe]nosus`, `Mac[oe]nas`. Dropping the bracket
   here gives `Phbus` and `Fmina`, so the anchor rule is WRONG for them in
   the other direction.
3. **AN EDITOR SUPPLYING A LETTER THE COPY LACKS** → keep the letter, drop
   the brackets. 5: Lovelace's `BARNE[S].`, `to[o] weak`, `[un]numbred`;
   Dowland's `Her[e] Want of Worth`; Herrick's `courts[t] thou her`.

**AND POSITION DOES NOT SEPARATE THEM — the obvious rule was tested and
refuted.** "A bracket touching a letter is part of the word, otherwise it is
an anchor" classifies `Ph[oe]bus` and `to[o]` correctly and then breaks on
Byron's `craving[me]`, an anchor glued straight to its word with no
punctuation between. So the discriminator has to be per-file or per-class
DECLARED, the way `MARK_REFUSED` and `_COUNT_FIELDS` are, and the repair is
owed a sitting rather than a regex.

**AND IT IS NOT REACHABLE BY CHECK H**, which is why it needed the owner's
question rather than the instrument: check H asks about a `[VERSE]` block
holding ONE line, and every one of these 93 sits inside an ordinary multi-line
stanza. The population is *a token inside a sung line*, not *a block that is
not a stanza*, and the check that would raise it is a different check.

### M-28 · The printed indent carries the rhyme scheme at 6.19x, and every reader strips it `OPEN`
**Found 2026-08-21 when the owner, having seen the bracket and numeral
findings, asked the general question: what about SPACING — indent, offset,
caesura, end-stop. The answer is that one spacing channel is large, real, and
read by nothing.**

**THE CENSUS FIRST, so the claim is bounded.** Every character in the
581,468 sung lines of `corpus/song/` that is neither a letter nor whitespace:
**73 distinct characters**. Each was given a mechanical verdict — replace it
with a space, and again delete it, and see whether the token stream or the
end word moves. **Six of the seventy-three reach a measurement**, and every
one is an ALREADY DECLARED coordinate:

| char | lines where tokens move | what it is |
|---|---:|---|
| `'` U+0027 | 57,765 | the joiner; doctrine 65's Finnish hiatus, Barnes's three apostrophe jobs |
| `-` U+002D | 26,986 | the joiner; the hyphen-splitting family, 3 recorded rule errors |
| `’` U+2019 | 10,642 | normalised to `'`; doctrine 26 |
| `(` `)` | 1,104 (901 END WORDS) | `strip_parens=True` ERASES the span; the `--voices` coordinate |
| `‘` U+2018 | 478 | folds to `'` like `’`, so it JOINS: `‘tis` is one token |

**~~AND `‘` IS AN ASYMMETRY NOBODY DECLARED, unlike `’`.~~ STRUCK THE SAME
DAY, AND THE PROBE IS WHAT WAS WRONG.** `line_tokens` normalises BOTH curly
quotes to `'` on its first line, so `‘tis` and `’tis` return the byte-identical
`["'tis", ...]`. The census reported `‘` as "reaching a measurement" because
its probe REPLACED THE CHARACTER WITH A SPACE, and replacing any joiner with a
space moves the token stream — so the probe cannot tell a joiner from an
asymmetry, and the entry read its own instrument's blind spot as a finding
about the corpus. Doctrine 20, inside the sweep that was written to find
doctrine-20 failures.

**QUOTATION MARKS ARE THREE OF EIGHT, AND THEY ARE THE APOSTROPHE-SHAPED
THREE.** Asked of the whole family after the owner raised it: `'` moves the
token stream on 57,772 lines, `’` on 10,642, `‘` on 478 — all three by
FOLDING TO ONE CHARACTER, which is doctrine 26 working. Every double and angle
quote is inert: `"` 11,144 lines, `“` 1,819, `”` 1,410, `»` 807, `«` 130, all
at **0** moved. `‹ › „ ‚ 「 」 『 』 ｢ ｣` are absent from the corpus entirely.

**AND THERE IS NO MUSICAL NOTATION IN THIS CORPUS AT ALL — a measured zero
over four Unicode blocks and over EVERY line, apparatus and header included,
not just the sung ones.** Musical Symbols (U+1D100–U+1D1FF, where 𝄞 lives)
**0**; Ancient Greek Musical Notation (U+1D200–U+1D24F) **0**; the note and
accidental characters in Miscellaneous Symbols (♩♪♫♬♭♮♯, U+2669–U+266F)
**0**; the music emoji (U+1F3B5–U+1F3BC) **0**. Together with the zero time
signatures above, the whole worry that the harness is scoring engraved
notation is answered NO, and answered over a named population rather than by
not having seen any.

**THE OTHER SIXTY-SEVEN ARE INERT**, and four of those negatives are worth
having in writing because they are the ones a reader would worry about:
**digits are inert** — `_TOKEN` is letters-only, so the 195 printed line
numbers (Coleridge 79, Christina Rossetti 78, Keats 22) contribute nothing to
any token count, nothing to MATTR, nothing to the density band, and
`raw_final_token` walks straight past them to the real end word; **`*` is
inert**, so printers' ornaments cost nothing; **`_` is inert**, so italic
markers do; and there are **0 time signatures** and **0 trailing spaces** in
the whole sung corpus, with **1** line carrying a tab. Those are measured
zeroes over a named population, not absences nobody looked for (doctrine 79).
`[` and `]` are inert TOO — and that is the sharp way to say `M-27`: the
bracket corrupts nothing, it FAILS TO PROTECT the letters inside it.

**AND THEN THE INDENT, WHICH IS NOT A CHARACTER QUESTION AND IS THE BIG ONE.**
**73,672 sung lines (12.7%) across 872 files carry a leading indent**, and the
depths are a ladder rather than a smear — 2 spaces 46,732 · 4 spaces 15,783 ·
6 spaces 4,298 · 8 spaces 1,949. In printed English verse that ladder IS the
rhyme scheme set visibly: the compositor indents the b-lines of a ballad
stanza, the couplet of a sonnet, the short line of a hymn metre.

Measured over the 15,685 `eng_*` blocks of ≥4 sung lines that carry at least
two indent depths — 528,370 end-word pairs, identical end words excluded
because identity is not rhyme (doctrine 3), rhyme read as `spelled_rime`,
which is the tier-1 ban's own class and a LOWER BOUND on rhyme:

```
  SAME indent depth   287,458 pairs   11.83% share a spelled rime
  DIFF indent depth   240,912 pairs    1.91% share a spelled rime
  excess +9.92 pp     ratio 6.19x
```

**WITH ITS MATCHED NULL, because a ratio without one is not a finding.** The
null permutes the indent depths WITHIN each block — the same block, the same
rhyme structure, the same multiset of depths, only the assignment destroyed.
20 draws, seed 20260821: **excess median −2.58 pp, range −2.71 to −2.49**.
The observed +9.92 pp is **12.6 pp above the null's maximum**, and the null
does not straddle zero, so the block structure alone produces a slightly
NEGATIVE excess and the whole of the positive effect is the assignment.

**NOTHING ON ANY GRADING PATH READS IT, and that is mechanical rather than
asserted.** `lyric_harness.load_lyric_lines`, `is_apparatus_line`,
`grid.read_marked_songs` and `readability.read_lines` all `.strip()` before
anything else sees the line, and `line_tokens` never receives the leading
space at all. `grep -rn 'lstrip(" ")'` over the tree returns exactly two
hits, `audit_corpus.py:2216` and `kalevala_rate.py:266`, both STAGING
heuristics — no reader on the rhyme, meter, or structure path keeps it.

**FIXED 2026-08-21 — THE INDENT SURVIVES INGESTION AND SOMETHING READS IT.
TESTED WHILE OPEN.** `lyric_harness.line_indent` is the one definition;
`load_lyric_lines(path, with_indent=True)` returns `[(indent, text), ...]`
from the SAME walk, so the text half is byte-identical to the default and no
second reader can select different lines; `grid.Block.indents` carries it
index-aligned with `Block.lines`; and `grid.indent_partition` normalises it to
a SHAPE — a stanza printed flush/indented/flush/indented reads `(0, 1, 0, 1)`
whether the indent is 2 columns or 8 — returning `()` and never a row of zeros
for a `Block` that has no printing (doctrine 20).

**THE READER IS `audit_corpus` CHECK I, AND IT CHARGES NOTHING.** Per file,
the same-depth against different-depth spelled-rime rates. Of the 545 files
that carry a measurable indent ladder, **517 agree, 6 run opposite, 22 sit
inside the null** — three counts, never summed,
with the 517 reported ONCE because 517 notes each saying "as expected" would
bury the 28 that do not.

**AND THE THRESHOLD WAS REFUTED BY A FILE BEFORE IT WAS WRITTEN.** It is
tempting to WARN on a ratio below 1 as an extraction that destroyed the
ladder. `eng_pah_francis_lieber.txt` (1.45% against 24.64%, ratio 0.06) is not
damaged at all — it prints ABCB stanzas indenting ONLY the rhyming fourth
line, so its same-depth pairs are by construction the lines that do not rhyme:

```
Rend America asunder
And unite the Binding Sea
That emboldens man and tempers--
    Make the ocean free.
```

An indent can mark the rhyme GROUP or the rhyme BEARER, and those are opposite
conventions in the same typography. **So the corpus-wide 6.19x is an average
ACROSS the two and UNDERSTATES what the printing knows.** The per-file gate is
the MEASURED NULL and not a guess (doctrine 22): an excess inside ±2.71 pp is
not distinguishable from chance and earns no note.

**WHAT THIS IS AND IS NOT.** It is NOT a proposal to infer a mandate from
whitespace: doctrine 14 forbids a control defined in terms of the quantity it
controls, and a scheme derived from indentation would be exactly as derived
as `--cliques` and must be labelled the same way. What it IS: a DECLARED
coordinate sitting in the bytes that the harness discards before reading, in
a project whose whole architecture is about not letting a reader silently
pick a coordinate (doctrine 45). Three uses that cost nothing to state and do
not require believing the signal is a mandate — a `--- INDENT:` staging field
so the printing's own grouping survives ingestion; a corpus-audit
disclosure where the indent and the measured rhyme partition DISAGREE, which
is the M-20 false-unit detector one channel over; and a control on
`mandate_from_graph`, since a derived cover that reproduces the printer's
indentation is a different claim from one that does not.

**THE OTHER THREE SPACING CHANNELS ARE NOT ANSWERED HERE, and the reason each
is open is different.** CAESURA: Welsh already has it as a declared
coordinate — `cym.cynghanedd(caesura="marked"|"search")`, the gwant printed
as `--` — and English has no such mark; the 1,628 lines carrying an internal
run of 2+ spaces are dominated by Shelley 274, Lovelace 117, Browning 111,
and are a mix of line-number columns and dramatic speaker gaps, not a caesura
notation. ENJAMBMENT and END-STOP are a PUNCTUATION question, not a spacing
one — terminal punctuation is preserved in every staged line and no module
reads it — and they are the coordinate the meter layer would need before it
could say anything about a line's boundary, so they belong with the time
layer's gaps rather than here.

### M-29 · The corpus declares 11,099 periods and the time layer, which is mute for want of one, reads none of them `OPEN`
**Filed 2026-08-21 at the owner's request, from the observation that some
poems carry an amount of time they are meant to be performed in. Measured
before writing: the literal form of that is ABSENT here and two other forms
of it are everywhere.**

**WHAT IS NOT THERE, over every line of every file under `corpus/`:**

| | occurrences |
|---|---:|
| an explicit duration (`N minutes`, `N seconds`) | **0** |
| a metronome mark (`M.M. ♩= 96`, `crotchet = 60`) | **0** |
| a named Ottoman/Arabic *usul* | **0** |
| a named Persian *bahr* / `aruz` | **0** |
| a named Indian *tāla* | **0** |

The three "duration" and 29 "tala" regex hits are all false positives — a
Project Gutenberg edition note, and the Scots place-name in *"The lanesome
Tala and the Lyne"*. Measured zeroes over a named population (doctrine 79),
not absences nobody looked for.

**WHAT IS THERE IS BIGGER, and it is a period by another name:**

| | count | where |
|---|---:|---|
| `--- TITLE: X  [air: Y]` — a NAMED TUNE | **11,099** | 194 files |
| a 詞牌 tune-pattern name | 133 header lines | 67 files |
| `data/qindingcipu_ge.tsv` — the 欽定詞譜 格, per-line character counts for 687 patterns | **2,334 rows** | — |

A named air fixes the tune, and a tune fixes the period. A 詞牌 fixes the
character count of every line, which is a period measured in syllables rather
than seconds — the 1715 欽定詞譜 is a durational template printed as a table,
and this repository already ships it.

**WHY THIS IS THE RIGHT SHAPE OF UNBLOCK, and it is NOT the beat grid.**
`CLAUDE.md` known gap 3 says the time layer is MUTE, and its own repin says
what actually blocks it: *"the blocker was multiplicity AND the family size is
the measurement that says so"* — 18 of 20 items mute, median family over
`m_needed` 5.5x to 21.3x, candidate families of 89 on a quatrain and 156–282
across 24 sonnets. Doctrine 56 is why those families are so large: **a search
over placements needs a null under the same search.** A DECLARED period needs
no search. If the placement comes from the tune rather than from sweeping k
positions, the candidate family collapses toward **1**, `m_needed` collapses
with it, and the two items that already answered with a measured zero stop
being the only two that can answer at all. That is a different lever from
"wait for audio", and it is the one the corpus can supply today.

**WHAT IS OWED, and none of it is done here.** (1) The air is a STRING, not a
period: `M-11` split it out of the title into a coordinate, and nothing maps
`[air: Tibbie Fowler i' the Glen]` to a bar count, a cycle or a tune source —
that is a lookup table this repo does not have and a licence question it has
not asked. (2) The 詞牌 route needs no external table at all, because
`data/qindingcipu_ge.tsv` IS the table, so it is the cheaper first arm and it
is a `ltc` arm, not an English one. (3) Whatever is built must be a DECLARED
coordinate with a refusal, not a default: a song whose air is named but whose
tune is unknown must refuse, because assuming a period for it is the same
error as assuming isochrony, one level up (doctrine 20). (4) **A period
derived from the corpus's own rhyme placement would be circular** and doctrine
14 forbids it — the whole value here is that the air is an INDEPENDENT witness,
the same property that makes the printed indent worth reading in `M-28`.

### M-49 · the mandate stored a relation's BARE name and `grade()` re-resolves it, so 52 of 157 declarations were accepted at the door and refused at the judge `CLOSED` 2026-08-22
**Found wiring the owner's "wire `Mandate.relations` as the default route",
by asking whether the value a mandate KEEPS is the value the judge READS.**

`schemes._resolve_relation` returned `resolve_relation(name)[0]` — the
canonical name — and threw away the `kind` beside it. `grade()` does not hold
that kind either: it passes the stored string to `satisfies_relation`, which
**re-resolves it from scratch**. So the store had to round-trip, and for a
fifth of the vocabulary it does not.

**MEASURED over the whole vocabulary**, by resolving every namespaced
declaration and re-resolving what it stored:

| | before | after |
|---|---:|---:|
| declarations that survive the store | 105 | **157** |
| declarations REFUSED at grade time | **52** | 0 |

The 52 are the two namespaces of the **26 names that live in both `type` and
`schema`** — which is not a coincidence, it is the whole reason M-37 made the
namespace mandatory. `alliteration`, `assonance`, `consonance`, `cross rhyme`,
`cynghanedd lusg`, `interlaced rhyme`, `internal rhyme`, `mosaic rhyme`,
`pararhyme`, `rime riche`, `semirhyme`, `wrenched rhyme` and fourteen others.
Four of them are cells the owner nominated poets for this same day.

**ACCEPTED AT THE DOOR AND REFUSED AT THE JUDGE IS THE WORST OF THE THREE
AVAILABLE ANSWERS.** A refusal at declaration time is a working validator; a
clean grade is a working judge; this was neither, and it reads as taken — the
mandate is built, the origin records the declaration, and every pair in that
group comes back `SCHEME_UNREADABLE` with a message about namespaces the
writer already resolved.

**THE FIX IS THE STORED SHAPE, NOT A SECOND LOOKUP TABLE.** `_resolve_relation`
returns `f"{ns}:{canon}"`, so the invariant is structural: *the stored value
re-resolves to the same judge.* Uniformly namespaced rather than
namespaced-only-when-ambiguous, because the second rule makes the store's
spelling a function of the vocabulary's current contents — a name gaining a
`schema` twin later would silently change what an untouched mandate holds
(doctrine 1).

**AND IT IS WHY IDEMPOTENCE MATTERED.** `Mandate.__post_init__` validates, so
every `dataclasses.replace` — the re-open path's own move — re-validates. Under
the bare store, re-opening a mandate that had already been ACCEPTED refused it.
`quality/test_mandate_relation.py` §6 pins both, and the mutation that restores
the bare store reds 8 checks.

### M-50 · `mandate()`'s re-open guard did not name `relations`, so a re-declared relation was byte-identical to declaring nothing `CLOSED` 2026-08-22
**Found in the same sitting, three lines below a comment describing this exact
defect in the coordinate next door.**

`mandate(spec, ...)` re-opens an existing `Mandate` only when
`returns or scope or structures is not None`. `relations` was in neither that
guard nor the `added` list that builds `origin`. MEASURED:

```
m  = mandate('ABAB')
m2 = mandate(m, relations={'A': 'type:qafiya'})
m2.relations  -> ()
m2 == m       -> True
```

Not refused, not carried, not recorded. The comment attached to that very line
reads *"before it joined this condition, `mandate(m, structures={...})` fell
through to the idempotence branch below and DROPPED the declaration in
silence, the exact defect family `--returns=` beside `--groups=` was"* — and
the line it annotates had the identical hole one coordinate over, shipped the
day `relations` was built. **A guard written as a list of the coordinates
somebody remembered is a guard that goes stale every time one is added**; it
is now the list of every re-openable coordinate, and `origin` names each of
them (a relations-only re-open printed `letter scheme 'ABAB' + ` — a trailing
conjunction with nothing after it, which is what a provenance string looks
like when it is describing something nobody told it about).

### M-51 · a bad `--structures=` / `--relations=` name refuses under the headline "this verb was given nothing to check against" `OPEN`
**Found 2026-08-22 exercising the new CLI refusals; PRE-EXISTING and not
introduced by that work — `--structures=` has had it since it shipped.**

Both coordinates raise `NoMandate`, and every CLI surface routes `NoMandate`
to the shared no-mandate refusal, whose headline is *"this verb was given
nothing to check against."* That sentence is FALSE here: a mandate WAS given,
and what failed is a name inside it. Measured, both spellings:

```
brief FILE --groups=1,2 --structures=A:no-such-row
  REFUSED — this verb was given nothing to check against.
  'no-such-row' is not a declared structure or alias — ...
```

The DETAIL line is correct, so nothing is silently wrong and the exit code is
right; the headline is a refusal naming the wrong layer, which is the family
`UndecodableLyricFile` and the `NoMandate`-in-`fit`'s-words fixes both belong
to. **NOT FIXED HERE** because the shared path serves several verbs and moving
it is test churn that belongs in its own sitting rather than riding a wiring
commit. The remedy is a second refusal shape — *the mandate is declared and a
name in it is not* — carrying the same exit code.

### M-52 · 17 of the 21 declared section functions are printed NOWHERE, and 62% of the marks that ARE printed reach no function at all `OPEN`
**Raised by the owner 2026-08-22 — "is it possible to work on getting us the
'17 declared and never printed' parsed and working instead of just the 4
section functions currently in use?" — and MEASURED before answering, because
the two halves of that question have opposite answers.**

**HALF ONE: THE 17 ARE NOT A PARSING PROBLEM.** Searched over the WHOLE
corpus, every bracketed mark, any spelling, case-insensitive, with `_`
matching space or hyphen:

| | printed marks |
|---|---:|
| `bridge`, `intro`, `outro`, `prechorus`, `postchorus`, `hook`, `coda`, `tag`, `vamp`, `solo`, `interlude`, `reprise`, `build`, `breakdown`, `turnaround`, `false_ending` | **0** |
| `drop` | 1, and it is `[Sidenote: His shipmates drop down dead.]` |

**0 of 17.** Adding rows to `grid.MARK_FUNCTION` for them would add seventeen
rows that match zero lines — a vocabulary with no members, which is the
declared-but-unread defect the corpus taxonomy's own protocol already refuses
("a value with zero members is the declared-but-unread defect in a taxonomy
hat"). The lever is the CORPUS, not the reader, and doctrine 44 is the frame:
this is neither hard to build nor impossible to obtain — the marks are simply
not in the texts we hold, because `[BRIDGE]` is a lead-sheet convention and
this corpus is printed verse.

**HALF TWO: AND THERE IS A LARGE PARSING PROBLEM, ON A DIFFERENT SET.**
Census of every `^\[...\]$` line under `corpus/`:

| | count |
|---|---:|
| distinct marks printed | **55** |
| mapped by `MARK_FUNCTION` | 5 |
| **UNMAPPED** | **50** |
| mapped LINES | 77,067 |
| **unmapped LINES** | **125,465** |

**62% of every bracketed mark in this corpus reaches no function.** The
unmapped set is not noise — it sorts into four kinds, and only the fourth is
apparatus:

| kind | marks | lines |
|---|---|---:|
| FORM, not function | `BAYT`, `RADIF`, `SLOKA`, `PANTUN ABAB`, `QUATRAIN AAAA`, `CYWYDD` | 125,332 |
| a tradition's own SECTION names | `URLAR`, `SIUBHAL` (piobaireachd ground and variation, 3 files each) | 11 |
| VOICE / ROLE parts | `PART: KAASON PUOLI`, `PART: KOSIOMIEHEN PUOLI`, `PART: MORSIAMELLE TUTTAVILTANSA`, `PART: KAASO`, `PART: MORSIAN LÄHTIESSÄNSÄ` (Finnish wedding song) | 53 |
| apparatus | `SIDENOTE: …`, `MUSIC: …`, dates, poem titles | ~30 |

`RADIF` is the sharpest case and it is 54,193 lines: the radif IS the
returning element of a ghazal, this repo already has a `refrain` function and
a whole `repeat_licence="refrain"` machinery for it, and the two have never
been introduced. `URLAR`/`SIUBHAL` are a section vocabulary the 21-name table
does not contain at all.

**AND THE OWNER'S FOLLOW-UP INVERTED THE PREMISE — MEASURED 2026-08-22.**
Asked whether the missing attestation stops us USING these functions while
writing rather than only reading them: it does not, and it never did. Asking
`plan.make_plan` directly over every form and 40 seeds each, rather than
reading the docs:

| | functions |
|---|---|
| **writes AND printed** | `verse`, `chorus` |
| **writes, NEVER printed** | `bridge` `intro` `outro` `prechorus` `coda` `tag` `vamp` `solo` `interlude` `build` `breakdown` `drop` |
| **printed, never written** | `burden` `refrain` |
| neither | `false_ending` `hook` `postchorus` `reprise` `turnaround` |

**The planner emits 14 of 21, and 12 of those are among the 17 this entry
opened on.** It writes bridges and outros today — `interlude`/`solo` as
zero-line instrumentals, `chorus`/`tag` as verbatim returners.

**SO THE CORPUS GATES A THIRD THING, and naming it is the point of this
paragraph: CALIBRATION.** Not reading, not writing — saying what a bridge
DOES that a verse does not. `Structure.calibrated` is the exact precedent: a
declared row grades CORRECTNESS and emits `STRUCTURE_UNCALIBRATED` to say out
loud that laziness is NOT graded, and it is True for exactly one row today. A
`[BRIDGE]`-marked corpus would not let us write bridges; it would let us say a
given bridge FAILS TO CONTRAST, which is currently a convention threshold at
an uncalibrated 0.90 (`grid.stanza_lock`, `BRIDGE_IS_A_VERSE`).

**AND THE REVERSE GAP IS THE CHEAP ONE.** `burden` (1,753 marked lines, 35
files) and `refrain` (709, 40) are the most heavily ATTESTED functions in the
corpus and the planner writes NEITHER. The corpus holds them and the writer
cannot ask for them; the writer holds bridges and the corpus cannot show one.
Closing that direction needs no new text at all.

**WHAT IS OWED, and the order matters.** (1) The 50 unmapped marks are
TRIAGED — form / section / voice / apparatus — as a declared table, because
today they are one undifferentiated silence and "this mark names no function"
and "this mark is not a function" are different answers (doctrine 20). (2)
Only the SECTION kind may map to `SECTION_FUNCTIONS`; a form mark mapped to a
function would put the form layer's answer in the function layer's slot, which
is the `same_object_as` defect of M-48 one layer over. (3) The VOICE kind
needs a coordinate of its own — it is not a section function, and `--voices`
already establishes that this repo treats a voice as a declared reading. (4)
The 17 stay unwitnessed until a text prints them, and the entry says so rather
than closing on a parser that would report them found — but the entry now also
says that unwitnessed does not mean unusable, because the planner has been
using twelve of them all along. (5) `burden` and `refrain` reach the planner's
recurrence vocabulary, which costs nothing and is owed by the measurement
above. (6) `URLAR`, `SIUBHAL`, `CRUNLUATH` (piobaireachd ground, variation and
crowning) and `PATTER` (music hall) are SECTION FUNCTIONS THE 21-NAME TABLE
DOES NOT CONTAIN — they are not marks to map onto an existing function, they
are four functions missing from the vocabulary, and each is a thing the
planner could then emit.

### M-53 · `mandate()`'s re-open path re-defaulted the `ReturnRule`, so re-opening a mandate to add any coordinate silently replaced the rule its writer declared `CLOSED` 2026-08-22
**Found in the same sitting as M-50, by testing that the CLI's new
`--relation=` path — which re-opens whatever cover the other flags built —
preserves everything it is not declaring.**

`mandate()` opens with `rule = rule or ReturnRule()`, so the parameter is
non-`None` for the whole rest of the function. The re-open branch then passed
that value to BOTH `_normalise_returns(rets, n, rule)` and the stored
`rule=rule` field. **Silence was read as a declaration of the default.**
MEASURED, on a mandate built with a non-default rule:

```
r  = ReturnRule(return_verbatim='verbatim', return_rhyme='positional')
m  = mandate([[1,3],[2,4]], n_lines=4, returns=[[2,4]], rule=r)
m.rule                                   -> return_rhyme='positional'
mandate(m, structures={'A': ...}).rule   -> return_rhyme='union'
```

It fires on **every** re-open coordinate — `returns`, `scope`, `structures`,
and the `relations` / `default_relation` this sitting added — because they
all reach the same branch. And it moves a real judgement: `return_rhyme`
decides whether a return class's rhyme obligations are read as a UNION with
the group's or POSITIONALLY, which is the difference between a returning
chorus's lines each answering their own slot and all of them answering all of
them.

**THE FIX IS TO CAPTURE WHETHER THE CALLER SUPPLIED ONE, BEFORE THE DEFAULT
IS APPLIED.** `rule_declared = rule is not None`, read once, ahead of the
`or`. A later `if rule is None` cannot work here and the first attempt at this
fix used exactly that and measured `False` on all four paths — the guard was
testing a variable the function had already overwritten, which is why the
repair had to move upward rather than sideways. An explicit rule on the
re-open still wins, and a fresh build with no rule still gets the default:
both pinned.

**SAME SHAPE AS M-50 ONE FIELD OVER, AND THAT IS THE ENTRY.** The re-open
path could not distinguish *not declared* from *declared as the default* for
`rule`, and could not distinguish *not declared* from *not re-openable* for
`relations`. One branch, two ways of reading an omitted argument as a
statement.

### M-54 · "an outro is last" is enforced by CONTROL FLOW and stated nowhere, so no grader can check it and no table can extend it `OPEN`
**Raised by the owner 2026-08-22, asking whether the section vocabulary is
machine-readable to the order of "outro is at the end… in a way that does not
bar novel move-37 song structures", and naming constraint propagation as the
shape. The instinct is right and is better than what is built.**

**THE BEHAVIOUR IS CORRECT — MEASURED.** Over 300 seeds of
`plan.make_plan(form='verse-chorus')`: **84 plans contain an outro and it is
last in 84 of 84.**

**AND THE RULE IS NOWHERE.** `plan._sample_pattern` produces it structurally:

```python
if rng.random() < 0.5:
    funcs.append("intro")          # BEFORE the cell loop
...
ending = rng.choice((None, "outro", "coda"))
if ending:
    funcs.append(ending)           # AFTER the cell loop
```

`grid.FunctionSpec` carries `name`, `gloss`, `recurrence`, `returns_as`,
`contrasts_with`, `aliases` — **and no position field**. `outro`'s gloss says
*"closes the song and does not recur"*; `recurrence='once'` is the machine-
readable half of that sentence and **"closes the song" is the half that stayed
prose**. Doctrine 1's own shape: a rule enforced by the order of two
`append` calls cannot be disagreed with in a coordinate, because it is not in
one.

**THREE COSTS, and none is hypothetical.** (1) NOTHING CAN CONSULT IT — the
grader has no `SECTION_OUT_OF_POSITION`, so a hand-written blueprint with an
outro in the middle grades clean. (2) THE ROSTER CANNOT BE EXTENDED BY A TABLE
ROW: adding `urlar`/`siubhal`/`crunluath` (`M-52`) means editing control flow,
not declaring their positions. (3) `_CELLS` IS A TABLE THE V2 REWRITE WAS
MEANT TO DELETE — 12 hardcoded runs whose own comment claims they are *"a
short run the vocabulary's own adjacencies license"*, while **the vocabulary
has no adjacency field**. That derivation is ASSERTED, not performed
(doctrine 45), and it is the same table shape standing rule 2 records the
owner catching in v1.

**THE SPLIT THAT MUST SURVIVE THE FIX, and it is the owner's own condition.**
A position rule is either DEFINITIONAL or CONVENTIONAL and the two get
opposite treatment:

| | example | where it goes |
|---|---|---|
| **HARD / definitional** | an outro is LAST; a prechorus precedes a chorus; a build points at a drop | a DECLARED coordinate on `FunctionSpec`, pruning the planner's space and giving the grader a flag |
| **SOFT / conventional** | verse-chorus-verse-chorus-bridge-chorus | `FormConvention` only, a NOTE, never the planner (doctrine 6, and the "move 37" ban) |

Enforcing the hard half costs ZERO novelty: a section labelled `outro` that is
not last is not a novel structure, it is a MISLABELLED SECTION. Enforcing the
soft half is precisely the bias the v2 planner was rewritten to remove.

**AND THE OBVIOUS DERIVATION IS WRONG — MEASURED BEFORE PROPOSING IT.** The
cheap version of the fix is to read the position out of each gloss by keyword,
since the glosses do state it in prose. Run over all 21, that claims a
position or an adjacency for **11 of 21**, and **four of the eleven are
false**:

| function | keyword derivation | why it is wrong |
|---|---|---|
| `false_ending` | `last` (matched *close*) | *"a close the song comes back from"* — it is precisely NOT last; something follows it BY DEFINITION. The sign is inverted. |
| `turnaround` | `last` (matched *end*) | *"carries the end of one section into the next"* — a SEAM, not the song's end. Wrong scope. |
| `vamp` | `first` (matched *open*) | *"a repeating figure held open"* — a different sense of the word entirely. |
| `tag` | `last` (matched *closing*) | *"closing a section **or the song**"* — genuinely ambiguous, and both readings are live in one gloss. |

Only `intro` (first), `outro` (last) and `coda` (last) survive as unambiguous.
**So the position table must be HAND-DECLARED per row with the gloss quoted as
its evidence, and REFUSE where the gloss does not decide** — deriving it by
pattern would be `_CELLS`'s own defect one layer over: a derivation asserted
rather than performed (doctrine 45), and this time with four measured errors
in it rather than an unfalsifiable claim.

**THE ADJACENCY HALF HAS A SECOND PROBLEM: the TARGETS are prose too.**
`drop`'s gloss is *"the arrival a build points at"* — it names `build`, in
English, inside a sentence. `postchorus` *"returns immediately after the
chorus"*, `prechorus` *"lifts from verse into chorus"*, `burden` *"printed
AFTER a stanza"*. Every one of those is a real, checkable relation written
where no checker can reach it, which is this entry's whole subject restated
one field over.

**AND `_sample_pattern` CARRIES A SECOND RULE WITH NO EVIDENCE.**
`rng.choice((None, "outro", "coda"))` makes `outro` and `coda` **mutually
exclusive** — a song may have neither, or one, and never both. Nothing in
either gloss says so (`outro`: *"closes the song and does not recur"*; `coda`:
*"a closing section with its own material"*), and a song can plainly carry a
coda followed by an outro. A rule with no warrant, enforced by the shape of a
tuple, in the same function as the one this entry opened on.

**WHAT IS OWED.** (1) A declared position/adjacency coordinate on
`FunctionSpec` — at minimum `position ∈ {first, last, free, refused}` and
`precedes`/`follows` as NAME SETS rather than prose, every row quoting its own
gloss as the evidence and `refused` used wherever the gloss does not decide
(`tag` is the worked case: it must refuse rather than pick, doctrine 20). (2)
`_sample_pattern` DERIVES from it instead of hardcoding, and `_CELLS` either
derives from the adjacency sets or its comment stops claiming it does
(doctrine 45 — a checker that silently picks is the bug; so is a generator
that silently derives). (3) A grader finding, so a hand-written blueprint is
held to the same rule the planner is. (4) The sampler must stay UNIFORM OVER
SOLUTIONS: a greedy left-to-right collapse re-introduces exactly the
enumeration bias v2's own smoke run found (weighting a cycle by how many
groupings it admits), so the constraint layer prunes the space and the
sampler still draws by derivation, never by walking the tree.

### M-55 · there is no way to DECLARE which section functions a song wants, so the planner's roster is sampled and never asked for `OPEN`
**Raised by the owner 2026-08-22: "ok I do want a chorus and a post chorus
because this song xyz and because of that a pre chorus would mess that up."
That sentence fits neither layer M-54 named, and the gap is that a THIRD layer
was missing from the analysis.**

| layer | example | who owns it | enforcement |
|---|---|---|---|
| **1 VOCABULARY** — definitional | a prechorus requires a chorus | `grid.SECTION_FUNCTIONS` | prunes the planner; a grader FLAG |
| **2 DECLARATION** — this song | "chorus and postchorus, no prechorus" | the writer | restricts the roster before sampling |
| **3 CONVENTION** — statistical | verse-chorus-verse-chorus-bridge | `grid.FormConvention` | a NOTE, never the planner |

**LAYER 2 HAS NO IMPLEMENTATION.** `plan.make_plan(seed, form=...)` takes a
seed and a form name; the roster comes from `GENERATOR_ROSTER` and
`_sample_pattern` draws from it. `PLAN_FORMS` is a ONE-MEMBER tuple
(`'verse-chorus'`), so `form=` is not the lever either. Measured over 120 seeds
x every form: the writer has no way to say which functions they want, and
therefore no way to say which they do NOT.

**IT IS NOT THE SAME AS EITHER NEIGHBOUR, and that is the entry.** "no
prechorus" is not definitional — a song with prechorus, chorus and postchorus
is ordinary, so the vocabulary must not forbid it. And it is not conventional —
it is not a tendency to be noted, it is an instruction. It is a DECLARATION,
the same species as `--groups=` and `--structures=`, and this project's answer
to a declaration that cannot be spelled has been the same every time: a
coordinate the caller can set (doctrine 1).

**IT COMES AFTER M-54 AND MUST BE CHECKED AGAINST IT.** A roster declaring a
prechorus and no chorus has to REFUSE, and that refusal is only expressible
once the definitional `requires` edges exist. Shipping layer 2 first would give
the writer a door onto a space with no walls.

`quality/SECTION_CONSTRAINTS_DESIGN.md` §2 holds the three-layer table and §7
the build order.

### M-56 · two of the twenty-one "section functions" declare in their own glosses that they are NOT sections `OPEN`
**Found 2026-08-22 deriving the section-constraint table, by reading all 21
glosses rather than the four the work needed.**

- `refrain` — *"a returning line or couplet INSIDE or after a stanza, **not a
  standalone section**"*
- `hook` — *"a section that IS the hook. A hook is properly a **FRAGMENT**
  (`MISSING.md` D-2) and `Hook` below is the object for that"*

So `grid.SECTION_FUNCTIONS` is **19 sections and 2 sub-section objects sharing
one table**, and each of the two says so in the field a reader would consult.
`hook`'s gloss even names the object that should hold it.

**THE COST IS NOT COSMETIC.** (1) Both are among the functions
`plan._sample_pattern` cannot emit, and this is part of why — a fragment has no
section-sized slot to be sampled into. (2) Any position or adjacency coordinate
(M-54) applied to them answers a question about the wrong KIND of object: "is a
refrain first or last" has no answer when a refrain sits INSIDE a stanza.
(3) `refrain` is the second-most attested mark in the corpus (709 lines, 40
files) and `burden` — 1,753 lines — is kept deliberately separate from it
*"because the corpus marks the two differently"*, so the distinction is real
and load-bearing while the CATEGORY is wrong for one of them.

**NOT FIXED BY DELETION.** Both are needed and both are attested; what is wrong
is that one table answers two questions. The remedy is a declared KIND on the
row — `section` vs `fragment` — so every downstream reader can ask rather than
assume, and so M-54's coordinates are only applied to the rows they can mean
anything for. `verify_entries`/`corpus_taxonomy` are the precedent: a closed
vocabulary whose members carry their own definition.

### M-57 · `FunctionSpec.aliases` models SYNONYMY, and three of its five claims are SUBSUMPTION — so the specialisation is accepted at the door and discarded `OPEN`
**Raised by the owner 2026-08-22: "While all middle eights are bridges, not all
bridges are middle eights… same deal with refrain and chorus if I'm not
mistaken… just for efficiency's sake." Measured, and the efficiency instinct is
right: subsumption is what lets a dialect name exist without a 22nd row. What
is wrong is that the field modelling it is symmetric.**

**THE REPO ALREADY DREW THE HARDER LINE AND STOPPED ONE SHORT.**
`grid._FUNCTION_SPELLINGS` is spelling variants only (`pre-chorus` →
`prechorus`) and its own comment says *"NOT a synonym table: `middle8 → bridge`
would be a CLAIM, and claims live in the vocabulary above WITH a gloss."* That
distinction is correct and is not the defect. The defect is one level in:
`FunctionSpec.aliases` is documented as *"a genre dialect naming **the same
function**"* — **synonymy, a symmetric relation** — and it is carrying claims
that are not symmetric.

**MEASURED.** `Section(bars=N, function="middle-eight")` for N in 8, 4 and 13:

```
bars= 8  -> function='bridge'
bars= 4  -> function='bridge'
bars=13  -> function='bridge'
```

The bridge row's own gloss argues a middle-8 needs no row *"whose bar count
happens to be 8, **which this model already records**"*. The model records **a**
bar count and **never checks it against the claim the alias made**, and the
claim itself is not kept — after resolution nothing can ask "was this declared
as a middle-eight?". So the door accepted a SPECIALISATION and stored the
GENUS.

**THIS IS `MISSING.md` M-49's DEFECT IN A DIFFERENT TABLE.** There,
`type:rime riche` resolved and stored `rime riche`, losing the namespace, and
the judge re-resolved the lossy value. Here `middle-eight` resolves and stores
`bridge`, losing the specialisation, and nothing can recover it. One shape, two
vocabularies, found within an hour of each other and only because someone was
looking at the second one.

**THE SUBSUMPTION EDGES, and they are already written in prose.**

| specific | genus | where it is stated today | how it is stored |
|---|---|---|---|
| `middle-eight` | `bridge` | the bridge gloss | ALIAS — lossy |
| `middle-8` | `bridge` | same | ALIAS — lossy |
| `departure-section` | `bridge` | the bridge row | ALIAS — probably a true synonym |
| `burden` | `refrain` | the burden gloss: *"**a refrain** sung by all, printed AFTER a stanza"* | a SEPARATE ROW |
| `instrumental-break` | `interlude` | the interlude row | ALIAS — probably a true synonym |

`burden` is the interesting one and it is the OPPOSITE error: the subsumption
is real and stated (*"a refrain sung by all"*) and the two are correctly kept
as separate rows, because *"the corpus marks the two differently and collapsing
them would delete a distinction 1,580 blocks already carry"* — which is right.
But the table can then say only that they are UNRELATED, when what is true is
that one is a kind of the other. **Both directions of the same missing
relation:** an alias asserts identity where there is specialisation; separate
rows assert independence where there is specialisation.

**AND `refrain`/`chorus` IS NOT ONE OF THEM — checked rather than assumed.**
The owner's "same deal with refrain and chorus if I'm not mistaken" does not
hold: `chorus` is *"the returning **section**"* and `refrain` is *"a returning
line or couplet INSIDE or after a stanza, **not a standalone section**"*. They
are SIBLINGS under returning material, not parent and child — different KINDS
of object (see M-56), which is a stronger separation than subsumption, not a
weaker one. The real edge in that family is `burden ⊂ refrain`.

**WHAT IS OWED.** (1) `specialises` as its own field — asymmetric, naming the
genus, with the gloss quoted — separate from `aliases`, which keeps only TRUE
synonyms (doctrine 1: one field, one question). (2) The specialisation's own
DIFFERENTIA recorded beside it, because that is the whole content of the claim:
`middle-eight` is `bridge` + `bars == 8`. (3) Resolution KEEPS what was
declared, so a section declared `middle-eight` can be checked against its
differentia and a mismatch REFUSES rather than silently widening to the genus.
(4) `burden` gains `specialises='refrain'` while staying its own row — the two
statements are compatible and the table currently makes them look exclusive.

## Add below this line
