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

### K-1 · There is no SONG corpus `PARTIAL` — largely closed 2026-08-10
**Was:** Shakespeare's sonnets and Whitman. Neither is a song.
**Now:** `corpus/song/` — **143 authors, 5,006 songs, 154,346 sung lines**, with
2,454 marked repeat blocks (1,603 BURDEN, 604 REFRAIN, 247 CHORUS) and 331
songs carrying a named air. Six parallel cells; 142 of the 220 listed lyricists
SOURCED, 70 NOT_FOUND with the exact queries recorded.
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
**Now:** the positive side spans **143 authors across 16 traditions**, 1567 to
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

### K-4 · Old Norse has a phonology and no licensed corpus `BLOCKED`
**Constraint:** the only complete Háttatal is inside a 1974 editor's copyright;
the 1848 edition that clears the gate has OCR that destroyed the consonants a
hending detector reads.

### K-5 · Somali can never have a corpus `BLOCKED`
**Constraint:** the Latin orthography dates from 1972 and the provenance cutoff
is 1931. Every written gabay is a modern transcription and in copyright.
**Now quantified:** 18 named Somali poets are staged in `data/lyricists.tsv` and
**every one of them is unusable**, by two independent routes. 13 fail the DATE
gate on their own — their lives are recorded only as "19th–20th century", whose
upper bound is 1900+70 past the term, and one (Muuse Xaaji Ismaaciil Galaal,
c. 1910–1980) fails outright with life+70 = 2050. The remaining 5 clear the date
and are marked `BLOCKED_ORTHOGRAPHY`, because K-5 bites regardless of when the
poet died. Two gates, and the poets who pass the first are stopped by the second.

### K-6 · Eight non-English phonologies, ZERO songs `OPEN`
**Found 2026-08-10, while closing K-1.** K-1 built a song corpus and every one
of its 143 files is English. The eight phonology cells (cym fin fas ltc msa non
san som) between them hold **four** text files — `cym_alun_strict.txt`,
`cym_twm_or_nant_cywydd.txt`, `fin_kalevala.txt`, `fas_hafez.json`,
`san_dcs_verse.txt` — and not one of them is a song. `ltc`, `msa`, `non` and
`som` have no text at all. So the corpus is saturated in one corner and starved
everywhere else, which is doctrine 8 arriving through the back door: the only
tradition we can measure a song against is the one tradition.
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

## M. Instrument defects the non-English sourcing round found (2026-08-10)

Four cells were sent to turn 297 staged lyricist names into text. Three have
reported. Every one of them found a defect in the harness rather than only in
the world, which is the point of pointing a module at a corpus (doctrine 37).

### M-1 · `ltc.rhymes` uses the 詩 standard on 詞 and calls 45% of real ci rhymes failures `OPEN`
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
the top 30 pairs carry 34% of 26,773 false verdicts and are 魚/虞, 支/微/齊,
蕭/豪, 東/冬, 庚/青/蒸, 元/先/寒/刪, 眞/文, and 上/去 within one group.
**Fix shape:** make the standard a declared coordinate,
`standard='pingshui'|'cilin'`, exactly the move `check_cynghanedd` made for
`language` (doctrine 45). Doctrine 36 was written about Qieyun → 平水韻 and it
is true one rung further in.

### M-2 · `data/qieyun_mc.tsv` is keyed on ONE orthographic norm `OPEN`
**魂 — the character that NAMES the 魂 rhyme group — cannot be looked up**, while
477 characters carry 魂 as their rhyme label. 窗 is absent; 窓/牕/窻 are present.
Of the 24 commonest unreadable characters in a real ci corpus, **23 are
recoverable by an 異體字 map to a variant already in the table**: 魂→䰟, 窗→窓,
匆→悤, 裙→帬, 劍→劒, 峰→峯, 群→羣, 閑→閒, 腮→顋, 鞍→鞌, 粧→妝, 裊→褭, 瀟→潚,
皓→晧, 胸→胷, 拆→坼, 儘→盡, 緲→渺, 敧→攲. The remaining five (怎 樣 褪 做 你)
are Song–Yuan **vernacular** characters postdating the rime book, where refusal
is CORRECT — and **nothing currently tells an ingestion defect from a correct
refusal**, which is doctrine 79 in a second layer.
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

### M-3 · `msa.py`'s apostrophe rule causes 82% of its own unreadability `OPEN`
384 of 471 Malay token failures are the syncope split leaving a **vowelless
fragment**: correct for `anak'nda` where both halves have a vowel, fatal for
`s'ri` (29), `t'ada` (8), `b'ras` (4), `k'ladi`, `t'rap`, `g'lombang`, `k'ris`.
**The module already accepts the identical process spelled without the
apostrophe** — its own docstring lists `prang`=perang, `Brapa`=berapa,
`'Plam`=Pelam as accepted. Same pepet syncope, two spellings, opposite verdicts.
Doctrine 65's lesson turning up inside ONE language, between two spellings of
one process.
**Also:** doctrine 65 undercounts the Malay apostrophe's positions. There are
FIVE, not four — the fifth is **after a hyphen** (`darah-'kau`, `hati-'ku`, 20
occurrences). `msa.py` handles them correctly because `_split_word` splits the
hyphen first; the defect is in the description, so an audit checking only the
four named positions reports 20 unclassified marks in a module that gets them
all right.

### M-4 · The `&c.` refrain stub is not an English printing convention `OPEN`
A-1 frames its 941 instances around English songsters. The same mechanism, doing
the same job in the same position, appears in two more languages and the code
that handles the English case knows neither:

| language | stub | n | how it fails now |
|---|---|---:|---|
| English | `&c.` / `etc.` | 941 | handled by `is_chorus_stub` |
| Finnish | `j. n. e.` (*ja niin edelleen*) | 13 | `j`,`n` unreadable = **100%** of that corpus's failures, and the `e` IS readable and joins the vowel-initial alliteration class as a spurious word |
| Malay | `d. s. b.` (*dan sebagainya*) | ~100 | `b`(101), `d`(100), `s`(99) — **300 of 471 tokens**, the single largest source of Malay unreadability |

Both new stubs are end-of-line, so the existing anchored regex extends directly.
In the Kanteletar's cumulative chain-song every verse after the first is
abbreviated this way — a refrain pointer doing exactly `&c.`'s job, in 1840
Finnish. **Welsh makes it four:** Mynyddog uses `&c.` itself, 30 times, at the
foot of a stanza.

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

### M-6 · `fin.py` implements alliteration and nothing else `OPEN`
No `rhymes()`. Nine of the ten staged Finnish files are **rhymed strophic
verse** whose actual constraint the module cannot check. F-1 lists `fin` as
present; it is present *for the Kalevala metre only*, and the corpus that just
landed is mostly not that.

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

### M-11 · ZERO named airs across 8,009 non-English songs `OPEN`
The field this whole round was chasing. The English corpus records a named air
for 331 of 5,006 songs (6.6%); the 8,009 songs now staged in Persian, Sanskrit,
Finnish, Malay and Welsh record **0**, and the 500 Chinese ci that DO carry a
詞牌 for 100% of songs are the one admitted file (M-12). Per language: Welsh
prints tunes but no metre index (M-8); the Gītagovinda's rāga and tāla headings
exist and are refused on licence (M-12); the Persian EPUBs carry no per-poem
musical metadata at all. This is F-6 restated with a number and it is the single
largest structural gap left in the corpus.

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

### M-13 · The Persian EDITION gate is OPEN on all 30 files `OPEN`
Every Persian row says so. `ganjoor.net` and `api.ganjoor.net` are
egress-blocked, and the per-book منبع note — which names the printed edition
each text was keyed from — lives only there. So the author gate is clear on all
30 and the edition gate is unanswered on all 30, which is doctrine 80 in its
plainest form. Also open: `Erfi.epub` (ʿUrfī Shīrāzī, d.1591) is a **corrupt
zip**; 15 on-list poets are in the EPUB set with **no ghazal section**
(Firdawsī, Niẓāmī, Jāmī, Khayyām, Rūdakī, Nāṣir Khusraw, Bābā Ṭāhir, ʿUnṣurī,
Manūchihrī, Farrukhī, Azraqī, Mahsatī, Gurgānī, Abū Saʿīd, Kisāʾī), and Bābā
Ṭāhir's **do-baytī** (366 poems, a sung Luri form) is present, unstaged, and
needs its own form declaration. Six further ghazal-bearing poets sit in the same
EPUBs off the supplied list — Nizārī Quhistānī (d.1320, 1,408 ghazals), ʿAbd
al-Qādir Gīlānī, Ibn Ḥusām Khūsfī, Mullā Hādī Sabzavārī, Riḍā al-Dīn Ārtīmānī,
Sulṭān Bāhū — free breadth if the list extends.

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
same checker, same within-line-shuffle null, same seed. Excess over the null max:

| | n | observed | null max | excess | p |
|---|---:|---:|---:|---:|---:|
| Alun, strict metre | 1558 | 54.1% | 27.8% | **+26.3** | — |
| Llywelyn Goch cywydd, 1862 | 108 | 52.8% | 30.6% | **+22.2** | floor |
| Twm o'r Nant cywydd | 156 | 51.3% | 36.5% | **+14.7** | — |
| Twm o'r Nant *cerdd rydd* | 759 | 28.4% | 17.5% | **+10.8** | floor |
| Welsh hwiangerddi | 1408 | 13.0% | 13.2% | −0.2 | 0.015 |
| **Alun, his own hymns** | 216 | 9.7% | 11.1% | **−1.4** | **0.119** |
| Mynyddog, song | 2758 | 8.2% | 8.6% | −0.4 | 0.069 |

Author, edition, printer, century, orthography and transcriber all held
constant; the effect goes to zero off the strict metre. Every previous Welsh
number came from strict metre, so a high rate was compatible with the detector
reading the *language's* redundancy (doctrine 64) or the Ab Owen printing house.
It reads neither. The graded middle — 18th-century *cerdd rydd*, sung to named
airs, at +10.8, about half — is where the tradition says it should be.
**Doctrine 76 from the other side:** that doctrine says report SENSITIVITY
beside a null; here SPECIFICITY was what needed showing.

### N-2 · Doctrine 65 corroborated at scale, not merely defended `CLOSED`
`cym` reads all five new Welsh files at **100.00%** — 0 unreadable tokens in
29,571 — including 2,750 internal apostrophes (`a'i`, `sy'n`, `mae'r`) that the
elision rule joins correctly and 94 internal hyphens. A split check for `l l`,
`d d`, `l-l`, `c h`, `r h` finds every hit is a word boundary, never a broken
digraph.

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

## Add below this line
