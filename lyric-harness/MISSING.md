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
reproducing it. There are ~~**941**~~ **777 in the 143 English files and 818
across all languages** in the staged corpus (`lyric_harness.is_chorus_stub` over
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

### F-1 · ~~Eight~~ NINE phonologies, and English IS one now `PARTIAL`
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
2,454 marked repeat blocks (1,603 BURDEN, 604 REFRAIN, 247 CHORUS) and ~~331
songs carrying a named air~~ **318 songs carrying a named air** (see below).
Six parallel cells. Of **220** rows, **8 carry a third status** — 4
`COMPOSER_NOT_LYRICIST`, 3 `NOT_SOURCED`, 1 `CONTESTED` — and the other 212
divide two ways: **142 of the 212 listed lyricists SOURCED, 70 NOT_FOUND** with
the exact queries recorded. Five statuses, 220 rows, and every count stated.

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
> **331 reproduces exactly, and it is a substring count.** Over the 143 English
> files' 5,006 songs, the number of TITLE strings containing the word `air`
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
> and stays dated; this is what it says today.**
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

**Still OPEN, and the open part has moved.** The layer cannot control α at the
honest family because it cannot produce an event at all: at
`null_samples = 2000` the Šidák cut on sonnet 1 is **2.53e-4** and the p-value
floor is **5.00e-4**, so the cut sits BELOW the floor. What is owed is
`null_samples` and `window`, measured against the candidate family. See
`quality/RESULTS_FWER.md`.

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
**Owed:** a null that destroys the span multiset — across items rather than
within one.

### L-3 · The slop floor is calibrated on one form, one language, one generator
`PARTIAL` — 152 Shakespeare sonnets vs 40 model sonnets, a 400-year register
gap. Its own docstring calls it unvalidated as a general slop detector.

### L-4 · The floor has two length profiles and they are both stanzas `OPEN`
"4-line quatrain, 29–37 tokens" and "14-line sonnet". Anything else is an
extrapolation and gets downgraded to a note. This is what shaped the demo song.

### L-5 · Doctrine has drifted toward auditing `OPEN`
~~`CLAUDE.md` carries 76 numbered items~~ **102 numbered items, measured
2026-08-11** — and roughly the last 25 are about null hypotheses and
calibration. A future session reading it will learn to audit rather than to
write. **The stale number is this entry's own evidence, which makes the point
twice:** the drift L-5 names has continued for 26 doctrines while the figure
that measures it stood still. A split into a short WRITING doctrine and a long
METHOD appendix is under way in `CLAUDE.md` / `quality/METHOD.md`; the numbering
stays global so `doctrine 79` is still doctrine 79.

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

### M-2 · `data/qieyun_mc.tsv` is keyed on ONE orthographic norm `OPEN`
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
`/workspace/mm47873/47873-8.txt`. The selection rule is the one
`corpus/song/msa_skeat_pantun.txt`'s own `selection:` header declares and
`scratch/src_msa/extract_pantun.py` implements: blocks are maximal runs of lines
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
A-1 frames its 941 instances around English songsters. The same mechanism does
the same job in the same position in other languages, and the code that handles
the English case knew none of them.
**CLOSED for Finnish 2026-08-11**, and the numbers in the first version of this
entry were WRONG — corrected below rather than quietly restated.

| language | stub | stub lines | unreadable tokens before → after |
|---|---|---:|---|
| English | `&c.` / `etc.` | 941 | handled by `is_chorus_stub` |
| Finnish | `j. n. e.` (*ja niin edelleen*) | 8 | `fin_kanteletar` 14 → **0**; all ten `fin_*` 155 → 139 |
| Welsh | `&c.` | 30 (see note) | Mynyddog, foot of a stanza |

**The Welsh 30 is `UNVERIFIABLE` and no rule tried reproduces it.** A bare
`&c\.` regex over the five `cym_song_*` files gives **41**, all of them in
`cym_song_mynyddog.txt`; the register audit reports 33 under a rule it does not
state. Three values, three unstated tokenisations, and the row is left at 30
rather than silently moved to whichever number the last person measured —
doctrine 58, and M-18's population clause. **Owed: the rule, beside the number.**
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

**The Finnish row is right in kind and was wrong in both numbers.** 16
unreadable tokens, not 13. "100% of that corpus's failures" holds for the two
Kanteletar files only; across all ten `fin_*` files it is 16 of 155 (10.3%), and
`fin_paavo_cajander.txt` alone carries 120 from a different cause.
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

### M-15 · `RelationSchema.traditions` is declared on 77 schemas and populated on ZERO `OPEN`
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

### M-16 · One module is genuinely stranded, and it is the one already shelved `OPEN`
`python3 lyric_harness.py wiring` now reports this mechanically instead of
requiring an audit. After wiring: **`quality/rhyme_constraints.py`, 1,325
lines** — a library with no caller and no `__main__`. Cell 3's triage already
recommended shelving it (20 relation types against `relations.py`'s 77, three
predicates against nine, no `SequenceEqual`/`SequenceSuffix`/`SubsequenceOf` so
amphisbaenic, parechesis and the Norse cluster span are unreachable in it) while
mining its one genuine advance, **knowledge sets** — a `frozenset` per channel,
which is the right shape for the P11 homograph gap and for partial nuclei.
Decision owed: mine the idea into `relations.py` and delete the file, or give it
a `__main__` and keep it as a comparison runner.

> **DECIDED 2026-08-11, and "genuinely stranded" no longer holds.** The file is
> **1,566 lines** (not 1,325 — a line count is a coordinate of the counting
> convention AND of the date), it now has an `if __name__ == "__main__"`, and it
> has callers: `quality/relations.py` and `quality/test_relations.py`.
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
> audited. **`cym` exposes no census** (`hasattr(cym, "readability_census")` is
> `False`), so read and refused cannot be separated and a bare rate hides
> exactly the distinction doctrine 79 exists to enforce.
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

## Add below this line
