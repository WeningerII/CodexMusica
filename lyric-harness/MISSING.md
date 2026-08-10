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
reproducing it. There are **941** in the staged corpus. Its last token strips
to `&c`, which is not a word and entered the rhyme data as one until
`lyric_harness.is_chorus_stub()` was added. A stub must be excluded from rhyme
extraction AND resolved against its target; only the exclusion is built.
**And the position is not fixed:** hymnals print the chorus after verse 1 in
some books and after the AUTHOR ATTRIBUTION at the end in others (the "sung
after every verse" convention). Both are in the corpus, source order preserved.
It broke the hymn cell's first parser.

### A-2 · Repetition-with-variation `OPEN`
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

### C-1 · Additive/aksak meter is inexpressible `OPEN`
**Now (verified):** `Meter.pulse_groups` returns `(1,1,1,1,1,1,1)` for 7/8 and
eleven single pulses for 11/8. It only distinguishes simple from compound.
**Missing:** the grouping itself. 7/8 as 2+2+3 and as 3+2+2 are different
music. The docstring says the caller "must declare it" and **there is no field
to declare it in**.

### C-2 · No cyclic-metre systems `OPEN`
**Missing:** Carnatic tāla (35 tālas × 5 jātis = 175), Hindustani tāl, Turkish
usul, Arabic īqā'āt, clave (son, rumba, bossa, 6/8), West African bell
patterns. These are not time signatures; they are cycles with internal
structure and named strokes.

### C-3 · No metric complexity `OPEN`
**Missing:** irrational meters (4/3, 5/6), mixed meter, polymeter, polyrhythm,
metric modulation, hemiola, tuplets, swing/shuffle ratios, rubato and free
time.

### C-4 · No groove or microtiming `OPEN`
**Missing:** pushes, pulls, laid-back and ahead-of-beat placement, syncopation
measurement, the difference between a line that lands and one that drags.

### C-5 · Tempo is not represented `OPEN`
**Now:** `Song` has bars and meters, no tempo, no tempo change.

---

## D. Song architecture

### D-1 · Sections have no FUNCTION `OPEN`
**Now (verified):** `Section` fields are exactly `name, bars, meter,
start_bar`. `name` is a free string.
**Missing:** a declared section-function vocabulary — intro, verse, pre-chorus,
chorus, post-chorus, refrain, bridge, middle-8, breakdown, build, drop, vamp,
tag, turnaround, interlude, solo, coda, outro, false ending, reprise. Nothing
can ask "does this song have a pre-chorus" or "how many bars until the first
chorus".

### D-2 · "Hook" cannot be represented `OPEN`
**Missing:** a hook is not a section. It is a FRAGMENT that recurs, possibly
inside other sections, possibly melodic rather than lyric, possibly shorter
than a line. Nothing in the model can hold one, count its returns, place it, or
measure its density.

### D-3 · No return/variation structure `OPEN`
**Missing:** how many times a section returns, in what order, with what
variation; reprise; truncated final chorus; added bar on the last return.

### D-4 · No arc `OPEN`
**Missing:** energy, dynamics, density, register, instrumentation change across
the form — the shape a listener actually experiences.

---

## E. Rhyme

### E-1 · The type taxonomy has NO PRODUCER `OPEN`
**Now (verified):** nothing in the repo calls `quality/rhyme_types.py` except
its own test. `classify()` takes channel agreements that some caller must have
computed, and no caller exists.
**Missing:** a function that takes two words and a phonology and returns a
coordinate. Until then the seven-axis space is a vocabulary, not an instrument.

### E-2 · English still has five relations `PARTIAL`
**Now:** `lyric_harness.py` recognises RHYME, REPEAT, RIME_RICHE, ASSONANCE,
CONSONANCE.
**Missing detection for:** masculine/feminine/dactylic span, multisyllabic
rhyme, mosaic/compound, broken, wrenched, apocopated, additive/subtractive,
pararhyme, eye rhyme, historical rhyme.

### E-3 · Internal rhyme is two-line only `OPEN`
**Now:** `internal_matches` supports a pair of lines. No verse-wide or
song-wide positional rhyme graph.

### E-4 · No rhyme density over time `OPEN`
**Missing:** rhyme rate per bar, acceleration into a hook, thinning in a
bridge — rhyme as a rhythmic parameter rather than a per-pair verdict.

### E-5 · The empty/empty coda gift `OPEN`
**Now (verified by using it):** `now ~ why` scores 0.902 and types RHYME,
because two vowel-final words get a free 1.0 on the coda channel. The fitted
matrix takes this to −0.000 and is not shipped.

---

## F. Language coverage

### F-1 · Eight phonologies, and English is not one `PARTIAL`
**Now:** `cym fas fin ltc msa non san som`. English runs on the old CMUdict
path and is not a declared module.
**Missing (non-exhaustive):** Spanish, Portuguese, French, Italian, German,
Dutch, Russian, Polish, Czech, Serbo-Croatian, Greek, Romanian, Hungarian,
Turkish, Arabic, Hebrew, Yiddish, Hindi/Urdu, Punjabi, Bengali, Tamil, Telugu,
Japanese, Korean, Mandarin, Cantonese, Vietnamese, Thai, Indonesian, Tagalog,
Yoruba, Swahili, Zulu, Amharic, Irish, Scots Gaelic, Quechua, Nahuatl.

### F-2 · Whole rhyme MECHANISMS are unrepresented `OPEN`
**Missing:** tone-contour rhyme (Cantonese, Vietnamese, Thai, Yoruba,
Mandarin); pitch accent (Japanese, Norwegian, Swedish, Serbo-Croatian); vowel
harmony (Turkish, Finnish, Hungarian) as a rhyme constraint; consonant mutation
(Celtic); root-and-pattern morphology (Semitic), where shared consonantal root
changes what rhyme even means.

---

## G. Syllable and prosodic fit

### G-1 · No syllable-to-beat mapping `OPEN`
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

### H-1 · Nothing measures meaning `OPEN`
**Now (verified):** `concreteness.txt` is downloaded by `fetch_data.py` and
used by no analysis.
**Missing:** imagery and concreteness, specificity, metaphor and conceit,
point of view, tense, narrative movement, the turn/volta/reveal, register and
diction consistency, showing vs telling, cliché at the PHRASE level rather than
the rhyme-pair level.

### H-2 · The pembayang/maksud property is unmeasured `OPEN`
**Missing:** the Malay pantun carries rhyme ACROSS a deliberate semantic break.
We found the property, quoted Skeat's own footnote describing it, extracted 82
quatrains — and never measured the discontinuity, which is the interesting part.

### H-3 · No structural cliché beyond the grid `PARTIAL`
**Now:** `stanza_lock()` names five grid clichés. That is the only structural
cliché detector.
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

### K-1 · There is no SONG corpus `OPEN`
**Now:** English evidence is Shakespeare's sonnets and Whitman. Neither is a
song.
**Missing:** the public-domain song corpus that exists and was never fetched —
Child ballads, broadsides, spirituals, work songs, shanties, Burns. (Not Tin
Pan Alley.)

### K-2 · English is single-author on BOTH sides `OPEN`
**Now:** positive = Shakespeare alone; negative = Whitman alone. Two men, 250
years apart, two genres.

### K-3 · The Whitman negative control does not separate `OPEN`
**Now (verified):** all four recorded Whitman figures (18.0, 20.0, 21.3, 26.0%)
fall inside one line-permutation null spanning 6.7–27.3%. Replacement is the
corpus's own shuffled self, plus a multi-author positive spanning more than one
scheme.

### K-4 · Old Norse has a phonology and no licensed corpus `BLOCKED`
**Constraint:** the only complete Háttatal is inside a 1974 editor's copyright;
the 1848 edition that clears the gate has OCR that destroyed the consonants a
hending detector reads.

### K-5 · Somali can never have a corpus `BLOCKED`
**Constraint:** the Latin orthography dates from 1972 and the provenance cutoff
is 1931. Every written gabay is a modern transcription and in copyright.

---

## L. Known instrument defects

### L-1 · The false-event rate is not controlled at α `OPEN`
"5.4% against 5.0%" is n=6; at n=20 the same construction gives 9.6%. The
guarding test runs three sonnets and asserts only `mean < 0.20`.

### L-2 · Real sonnets do not separate from scrambled text on event rate `OPEN`
10.9% observed vs 9.6% word-scramble (p=0.095). Either the detector is broken
or these sonnets carry no internal rhyme, and this event set cannot tell them
apart — so any null placement result on it is uninterpretable.

### L-3 · The slop floor is calibrated on one form, one language, one generator
`PARTIAL` — 152 Shakespeare sonnets vs 40 model sonnets, a 400-year register
gap. Its own docstring calls it unvalidated as a general slop detector.

### L-4 · The floor has two length profiles and they are both stanzas `OPEN`
"4-line quatrain, 29–37 tokens" and "14-line sonnet". Anything else is an
extrapolation and gets downgraded to a note. This is what shaped the demo song.

### L-5 · Doctrine has drifted toward auditing `OPEN`
`CLAUDE.md` carries 76 numbered items and roughly the last 25 are about null
hypotheses and calibration. A future session reading it will learn to audit
rather than to write.

---

## Add below this line
