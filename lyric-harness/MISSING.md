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

### A-2 · Repetition-with-variation `OPEN`
**TESTED WHILE OPEN** — `quality/test_song_function.py` names this entry, and
what it guards is the RETURN half: `compare_returns` over `VARIATION_KINDS`
answers "the same line or a different one" with a 15-way ladder rather than a
boolean, which is a large part of this entry's first sentence. Surfaced
CONTESTED on 2026-08-21 when the citation scanner learned to read multi-key
headers; whether the remaining clauses (answer lines, call-and-response pairs)
are also built is NOT decided here — this entry is queued for the same
measured verification D-1 got, and until that pass runs it stays open on its
own text.
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

### C-4 · No groove or microtiming `OPEN`
**Missing:** pushes, pulls, laid-back and ahead-of-beat placement, syncopation
measurement, the difference between a line that lands and one that drags.

### C-5 · Tempo is not represented `OPEN`
**Now:** `Song` has bars and meters, no tempo, no tempo change.

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

### D-2 · "Hook" cannot be represented `OPEN`
**TESTED WHILE OPEN** — `quality/test_song_function.py` names this entry, and
`quality/grid.py` exports `Hook`, `HookOccurrence`, `hook_occurrences` and
`hook_findings`, which is at least "hold one, count its returns, place it".
Surfaced CONTESTED on 2026-08-21 by the multi-key citation fix; the sentence
below is at minimum PARTLY false at head, and this entry is queued for the
same clause-by-clause verification D-1 got. Not closed here because "measure
its density" and the melodic/sub-line clauses have not been measured against
the tree, and closing on a skim is how the register got eight entries stale.
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

### E-2 · English still has five relations `PARTIAL`
**Now:** `lyric_harness.py` recognises RHYME, REPEAT, RIME_RICHE, ASSONANCE,
CONSONANCE.
**Now detected by `classify_pair`:** span (masculine/feminine/dactylic and
UNBOUNDED beyond — the old SPAN dict capped everything 4+ as "extended"),
identity (distinct/same_word/rich), stress alignment including wrenched,
length match (equal/additive/subtractive), and all 27 ternary channel cells
including pararhyme and the two English never named.
**Still missing:** mosaic/compound and broken boundary detection (the axis
exists, nothing infers it from text), apocopation, and eye/historical
realisation — all three need the ORTHOGRAPHY beside the phonology, which no
caller currently passes. `lyric_harness.py` itself still runs its own
five-relation path and does not call this.

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
(`lyric_harness.py:2990`), so that layer is distance <= 1 structurally while
`relations.py` is stanza-wide; neither site says so. Two answers to one
question with no declared coordinate between them (doctrine 1). Status is
`PARTIAL`, not `CLOSED`: the capability landed, the coordinate did not.
**Verified 2026-08-16** against `quality/relations.py` and
`lyric_harness.py:2925,2990`.

### E-4 · No rhyme density over time `OPEN`
**Missing:** rhyme rate per bar, acceleration into a hook, thinning in a
bridge — rhyme as a rhythmic parameter rather than a per-pair verdict.

### E-5 · The empty/empty coda gift `OPEN`
**Now (verified by using it):** `now ~ why` scores 0.902 and types RHYME,
because two vowel-final words get a free 1.0 on the coda channel. The fitted
matrix takes this to −0.000 and is not shipped.

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

### F-4 · A transcription can invent a letter `OPEN`
**Verified 2026-08-10, inside a single Gutenberg record.** Barnes exists as two
files: `21785.txt` (ASCII) flattens the a-diaeresis to the two-letter sequence
`ae`, printing `Greaeve` and `Feaeir` — **inventing a letter in every affected
word** — while `21785-8.txt` (ISO-8859-1) keeps the single character. The
Latin-1 file is staged and the reason is in its header. Doctrine 50 with the
sharpest instance yet: same text, same repository, same day, and one encoding
silently changes the phonology.

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

### G-2 · No prosodic fit — the central songwriting problem `OPEN`
**Missing:** whether lyric stress agrees with melodic/metric accent, whether a
long vowel sits on a long note, whether a phrase breathes, whether a word is
broken across a rest. This is the thing that makes a lyric singable and nothing
here touches it.

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
We found the property, quoted Skeat's own footnote describing it, extracted 82
quatrains — and never measured the discontinuity, which is the interesting part.

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

### I-1 · Nothing generates `OPEN`
**Now:** `quality/revise.py` returns line-scoped briefs; the harness grades.
**Missing:** any writing loop, melody-first or lyric-first workflow, or way to
sample a structure from the scheme/grid spaces and write into it.

### I-2 · No way to sample the space under constraints `OPEN`
**Missing:** "give me an 11-line scheme with 3 sounds, no adjacencies, at least
2 section-crossings, and no name" — the spaces are enumerable and there is no
constrained sampler over them.

---

## J. Integration

### J-1 · Codex Musica is not connected `OPEN`
**Missing:** the MCP server (2,503 traditions, 1,406 instruments, 741 prefaces)
is in the same workspace and the harness has never called it. The recording and
the words are being designed in separate universes.

---

## K. Corpora and evidence

### K-1 · There is no SONG corpus `PARTIAL` — largely closed 2026-08-10
**Was:** Shakespeare's sonnets and Whitman. Neither is a song.
**Now:** `corpus/song/` at commit `06857f8` — **143 authors, ~~5,006~~ 4,993
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
> any trailing index stripped. The population is `corpus/song/eng_*.txt`, 143
> files. The counters row is VOLATILE by declaration — it carries no frozen
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

### K-1a · The printed record is BIASED AGAINST the chorus `OPEN`
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

### K-2 · English is single-author on BOTH sides `PARTIAL`
**Was:** positive = Shakespeare alone; negative = Whitman alone.
**Now:** the positive side spans **143 authors across 16 rhyme traditions**, 1567 to
1929. The NEGATIVE side is still Whitman alone, and K-3 shows it never
separated — so the replacement remains the corpus's own shuffled self.
**New sub-gap:** `corpus/whitman.txt` is itself structurally impoverished —
"O Captain! My Captain!" carries the "Fallen cold and dead" burden closing
every stanza and our file records no refrain marking at all.

### K-3 · The Whitman negative control does not separate `OPEN`
**Now (verified):** all four recorded Whitman figures (18.0, 20.0, 21.3, 26.0%)
fall inside one line-permutation null spanning 6.7–27.3%. Replacement is the
corpus's own shuffled self, plus a multi-author positive spanning more than one
scheme.

### K-4 · Old Norse has a phonology and no licensed corpus `BLOCKED` (doctrine 92: disjoint sets, and the disjointness is contingent on the channel map)
**Constraint:** the only complete Háttatal is inside a 1974 editor's copyright;
the 1848 edition that clears the gate has OCR that destroyed the consonants a
hending detector reads.

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
> **7 · Still BLOCKED, and here is what would move it**, in cost order:
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

**Staged, not sourced:** 297 non-English lyricists now carry rows in
`data/lyricists.tsv` with a `lang` column (added in the same commit; the 221
pre-existing rows are backfilled `eng`, which is the gap stated as data).
Author-gate outcome:

| lang | staged | refused | blocked |
|---|---:|---:|---:|
| fas | 76 | 0 | 0 |
| san | 62 | 0 | 0 |
| ltc | 59 | 0 | 0 |
| cym | 35 | 0 | 0 |
| non | 25 | 0 | 0 |
| fin | 14 | 0 | 0 |
| msa | 8 | 0 | 0 |
| som | 0 | 13 | 5 |

**The author gate is the cheaper of the two gates and clearing it means little
here.** Every row is `PENDING_TEXT`, never `SOURCED`: for a 14th-century Welsh
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

### L-4 · The floor has two length profiles and they are both stanzas `OPEN`
"4-line quatrain, 29–37 tokens" and "14-line sonnet". Anything else is an
extrapolation and gets downgraded to a note. This is what shaped the demo song.

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

### M-4a · A tighter rhyme band LOOSENS the time layer's correction `OPEN`
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
**This entry stays OPEN** because the two remaining causes are unfixed: the
degenerate-item guard's dependence on the alignment, and the fact that the layer
now has no attainable event on any item in the repository.

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

### M-7 · Doctrine 55's fix was right and its dash rule is over-general `OPEN`
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

### M-9 · `CHANNELS.md` is written as a blocklist and the policy is an ALLOWLIST `OPEN`
The gateway denies by default and the proxy enumerates its own denials:
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` → `recentRelayFailures[]`. 11
further hosts probed, all denied, including **all four Project Gutenberg
mirrors** — so GITenberg is not a convenient alternative to Gutenberg, it is the
only route. Also: `huggingface.co` is 403 at CONNECT (MCP-only) and `hf_fs cat`
refuses binaries, so `wikimedia/wikisource` config `20231201.cy` — Welsh
Wikisource, 1.25 MB, one parquet file — is **named, located and unreadable**.
Highest-value single Welsh target for whoever next has a parquet-capable channel.

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
> **REPINNED 2026-08-15: `quality/rhyme_constraints.py` is 1,652
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
**function-word list nobody wrote down.** That is worse than an unrecorded
threshold, because a threshold at least announces that it exists.

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
the only unwritten coordinate. Three entries quote **three incompatible sizes
for one corpus**, none of them saying which object they mean:

| | blocks | verse lines | tokens |
|---|---:|---:|---:|
| `corpus/song/msa_skeat_pantun.txt` (in the repo) | 129 | 513 | 2,113 |
| M-3's stated population | 330 | 3,415 | 15,519 |
| the same 330 blocks under the corpus file's own declared rule | 330 | **3,442** | **15,601** |
| N-3 / `data/sources.tsv`, all indented blocks | 705 | 5,555 | — |

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

**Coverage is the honest part of this entry:** 70 entries, all 70 carry numbers,
**681 numbers in total**, and 51 entries still have no check at all. This round
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
**Not one is a General American slant rhyme.** `theta_coda` survived the same
test because what IT cost was S~Z and D~RD — final-obstruent voicing, which
English has not changed since 1609. The nucleus is where four centuries of sound
change live, so the sonnet violation rate prices the **`dialect` coordinate**
there, not the threshold.
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

### M-20 · Two English poems are staged TWICE in their own file, and the title's air hid it `OPEN`
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
than a mechanical one — `eng_` song counts are inflated by 2 until it is
taken, and any per-song rate over those two files double-counts one poem.

**The label they surface under is imprecise and is left that way on purpose.**
`false_unit_items` reports them as `RUN-ON`, whose meaning is *the extractor
glued the next poem onto the end of this one*. That is not what these are. The
shape keys on WHERE the match falls, the match falls deep in the body, and
relabelling by hand inside a pinned test would be writing a judgement into a
count. `quality/test_corpus_audit.py` pins `RUN-ON 11` with this entry named.

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

**Owed: the question, not the answer.** A sweep that runs each instrument's
own `--check` and prints the moved figures TOGETHER. It must not repair
anything — `counters.py`'s own docstring records why a remedy that writes is
a laundering path (`WHAT --write MAY NOT WRITE`), and a sweep that repaired
would inherit that hole across thirty instruments at once instead of one.

**THIS ENTRY IS ITS OWN FIRST INSTANCE.** Filing it moves the count 76 → 77,
so both pins above move again, in the commit that describes them. That is the
cheapest possible demonstration and it is deliberate: if the two figures in
the table above do not read 77 in the tree you are looking at, this entry has
gone stale in exactly the way it is about.

## Add below this line
