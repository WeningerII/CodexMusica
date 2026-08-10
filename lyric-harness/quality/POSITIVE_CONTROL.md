# The positive control, and the corpus that replaces the rap arm

Two things live here. First, the answer to a question the time layer never
asked in three instrument versions: **does the phase statistic detect
periodicity when periodicity is there?** Second, the specification for the
corpus that replaces `verse.txt`, defined by the structural property under test
rather than by a genre.

Run: `python3 quality/positive_control.py`.

## Part A — the instrument works, and it is underpowered

Every arm so far tested material where the right answer was unknown, so a null
said nothing about the instrument. `quality/positive_control.py` plants events
at a known phase in a synthetic slot stream and asks whether the layer recovers
them. It is language-agnostic by construction and needs no corpus, so it dodges
both the monoculture problem and provenance for the instrument question.

**Ceiling — a perfect signal is always detected.**

| events / slots | concentration | power |
|---|---|---|
| 8 / 65 | 1.00 | **1.00** |
| 20 / 120 | 1.00 | **1.00** |
| 40 / 240 | 1.00 | **1.00** |

**Floor — pure noise is not detected.** At concentration 0.25 (= 1/4, exactly
chance for period 4) the false-positive rate is 0.02, 0.03, 0.05 against a
declared α of 0.05. The permutation null delivers what it advertises.

**So the design is sound.** The statistic is not broken and never was.

### The minimum detectable effect — the number this project never had

Power at α=0.05, sweeping periods (2,3,4,6,8) exactly as the real layer does:

| events | slots | c=0.40 | c=0.50 | c=0.60 | c=0.75 | c=0.90 |
|---|---|---|---|---|---|---|
| **8** | **65** | 0.02 | 0.06 | 0.13 | **0.82** | 1.00 |
| 12 | 75 | 0.04 | 0.09 | 0.37 | 1.00 | 1.00 |
| 20 | 120 | 0.04 | 0.24 | 0.88 | 1.00 | 1.00 |
| 40 | 240 | 0.24 | **0.94** | 1.00 | 1.00 | 1.00 |
| 80 | 300 | **0.78** | 1.00 | 1.00 | 1.00 | 1.00 |

The corrected sonnets carry **5–8 events over 60–75 slots** — the top row. At
that size the layer needs **three quarters of an item's internal rhymes on a
single metrical phase** before it can see anything. That is an enormous effect,
far larger than any real form plausibly imposes.

### What this does to every null the layer has reported

**The rap arm was never testable.** One item, ~15 events, power ≈ 0.13 unless
concentration exceeded 0.75. Its p = 0.132 did not mean "no effect"; it meant
"no power". The same is true of the earlier 0.626 and 0.087. H1's positive half
was not refuted three times — it was **never once tested**, and reporting those
as failed predictions overstated what the runs could deliver.

**The sonnet arm is genuinely null, and now has pooled power.** Combining the
per-item p-values with Fisher's method — legitimate here because each item's KL
is phase-invariant, so the p-values are comparable even though the phases are
not:

```
stress    k=23 items, median p=0.701, X2=31.4 on 46 df  ->  p = 0.950
syllable  k=26 items, median p=0.554, X2=48.4 on 52 df  ->  p = 0.617
```

That is the predicted null holding under a test that pools 23–26 items instead
of correcting across them. Benjamini-Hochberg controls false discovery; it
never *combined* evidence, so the aggregate question had gone unasked.

### The design constraint this imposes on any future corpus

**A cell needs ≥40 events per item, or pooling across enough items to reach
it.** Below that, corpus quality is irrelevant — the cell cannot answer the
question no matter how well chosen. This, not genre and not language, is what
should drive corpus selection from here.

## Part B — the replacement corpus, defined by property not genre

`verse.txt` is deleted (in copyright; see `data/sources.tsv`). Its replacement
is not "a second rap corpus", and not one tradition swapped for another. Two
errors were made in proposing that, both of them violations of doctrine 8 by
the person who wrote it down: a **single source**, and a **single language**.

The corpus is therefore defined by the property under test:

> **Forms in which sound-repetition is constrained to fixed metrical
> positions by the form itself.**

Genre is irrelevant to that. So is language — and *especially* so, because a
constraint that appears in one family and not another is exactly the kind of
finding this design exists to surface. No single tradition conceptualizes it
the same way, which is the reason to take many rather than a reason to pick one.

### Positive cells — the form mandates positional sound-repetition

| tradition | family | what the form fixes |
|---|---|---|
| dróttkvætt | Germanic (Old Norse) | skothending in odd lines, aðalhending in even, at set syllable positions |
| cynghanedd | Celtic (Welsh) | consonance and rhyme mirrored around the caesura |
| dán díreach | Celtic (Irish) | uaithne and amus at set positions |
| ghazal (radif + qafiya) | Indo-Iranian / Semitic | fixed repetend closing every line, rhyme immediately before it |
| prāsa / yamaka | Indo-Aryan (Sanskrit) | syllable repetition at fixed pāda positions |
| 律詩 regulated verse | Sinitic (Classical Chinese) | rhyme at fixed line positions, over a tonal template |
| Kalevala metre | Uralic (Finnish/Karelian) | alliteration positionally constrained inside the line |
| gabay | Cushitic (Somali) | one fixed alliterating consonant sustained across the whole poem |
| pantun | Austronesian (Malay) | abab with cross-couplet sound linking |

Nine families. The harness already ships `check_cynghanedd` and `prasa`, and
the qafiya/radif machinery is built and tested.

### Negative cells — the form mandates no positional constraint

Free verse (Whitman, already held), biblical parallelism (Hebrew, already in
`sources.tsv`), and prose. These must come out null or the statistic is reading
something other than form.

### The two blockers, stated rather than discovered later

**Phonology — THE THREE CHEAPEST ARE NOW UNBLOCKED.** `quality/phonology/`
ships `fin`, `som` and `ltc`, tested in `quality/test_phonology.py`. They were
cheap for three *different* reasons, which is why they are three
implementations and not one G2P with three tables:

| cell | why it was cheap | what it gives |
|---|---|---|
| `fin` | near-phonemic orthography, fully regular syllabification, stress fixed on syllable 1 | Kalevala alliteration, strong and weak grades |
| `som` | phonemic 1972 Latin script, (C)V(V)(C), no onset clusters | gabay higaad, measured as a share of lines |
| `ltc` | one character = one syllable, sound classes lexicalised | rhyme category (韻, 聲) and the 平/仄 binary |

Two results from building them are worth more than the code.

**Prominence is not always stress.** Somali has pitch accent and quantitative
metre, so `som` declares `grid_unit = "mora"` and **raises** rather than
returning a stress pattern. Middle Chinese has no stress at all; its binary is
平/仄, which is what the regulated-verse template constrains. Either module
could have returned a plausible-looking stress pattern and nobody would have
caught it in the numbers.

**A rime dictionary is finer than any poet worked to.** The Qieyun distinguishes
193 rhymes; Tang practice authorised 同用 groupings. On raw lookup 流 (尤) and
樓 (侯) do **not** rhyme — and they are the rhyme of 登鸛雀樓. The grouping is
load-bearing, and it is validated against canonical verse rather than trusted.

**Still blocked:** Welsh, Indic and Old Norse, exactly as gap 6 has always
said. A cell without phonology cannot be run, and listing one here is a plan,
not a capability.

**Reachability.** Measured this session: Project Gutenberg returns nothing
(blocked), GitHub *search* is scoped to this repository so it cannot discover
sources, and Hugging Face has none of these corpora. GitHub **raw** works when
an exact path is already known — `cltk/old_norse_text_perseus` resolves. So
sourcing is possible and hand-guided, and each cell needs its licence checked
separately: the medieval **texts** are public domain, but modern critical
editions and translations are not. `sources.tsv` already rejects the Sangam
Tamil dataset for precisely this — ancient PD text bundled with a living
translator's apparatus.

## Part C — sourcing, attempted

### gabay: NO ADMISSIBLE SOURCE, and the reason is structural

Searched and recorded in `data/sources.tsv` so nobody repeats it. Hugging Face
holds **30 Somali datasets and not one literary text** — all ASR/TTS audio,
Alpaca instruction translations and MT sentence pairs. Wikisource and Gutenberg
are both blocked (curl 000). GitHub search is scoped to this repository.

The interesting part is not the failed search, it is the bind underneath it:

> `som` reads the **1972** Latin orthography — that is precisely why the cell
> was cheap. The provenance cutoff is **1931**. A text old enough to clear
> provenance predates the script by 41 years and `som` cannot read it; a text
> `som` can read was written down in or after 1972.

Somali gabay was overwhelmingly **oral**. The compositions of Sayyid Maxamed
Cabdulle Xasan (d. 1920) clear the gate's death-year route, but every
1972-orthography transcription of them is a modern editorial act. This is not
the familiar old-text/new-edition trap that `sources.tsv` already flags for
Sangam Tamil — here **the writing system itself postdates the cutoff**.

It also exposes a gap in the gate: `provenance.py` keys admission on the
AUTHOR, and has no concept of an edition or transcription layer with its own
date and its own rights. For most corpora that gap is harmless. For an oral
tradition it is the whole question.

### 律詩: SOURCED AND VALIDATED — this is the cell that runs

`chinese-poetry/chinese-poetry`, already on disk from the earlier label work.
MIT on the compilation; the verse is 8th–13th century and long out of any term.
Two separable layers, and only the outer one is licensed.

Validated against the form with `quality/phonology/ltc.py`. Filtering 全唐诗 to
poems of eight uniform lines of five or seven characters:

| | |
|---|---|
| poems checked | 253 |
| rhyme agreement at mandated positions (lines 2,4,6,8) | **88.1%** |
| character coverage by the rime table | **99.3%** |

**The 11.9% residue is diagnostic, not noise, and it is not being tuned away.**
Every recurring failure is a documented **通押** pair — adjacent rhymes Tang
poets used together that the 13th-century 平水韻 standard later separated:

```
庚 / 青    停/生/傾/聲,  星/驚/縈/行
支 / 微    幃/遲/滋/悲
魚 / 虞    符/書/書/胡
上 / 去    喜/翠/異/志   (same 支 group, different tones)
```

Plus fragments: one "failure" is titled 句, which means *fragment* and is not a
complete poem. Loosening the grouping to absorb these would raise the number by
fitting the reference table to the data, which is the same error as tuning a
threshold to a result. 88.1% is a **measurement of how closely Tang practice
matches the standard that codified it centuries later** — the exact analogue of
the sonnet battery's 11.6% Early Modern residue, named rather than removed.

## Part D — Part B run on the real corpora

`python3 quality/run_positive_control.py`, on 300 全唐诗 poems of eight uniform
lines of five or seven characters. Grid unit **syllable**, because one
character is exactly one syllable and the grid is therefore perfect. Periods
swept (2,4,5,7,10,14) — a 5-character couplet is 10 syllables, a 7-character
couplet is 14.

| arm | n | refused | sat | median p | sig | Fisher |
|---|---|---|---|---|---|---|
| **A** mandated rhyme, lines 2/4/6/8 | 264 | 36 | 10.0% | 0.000 | **264/264** | **0** |
| **B** internal, line-finals excluded | 300 | 0 | 50.0% | 0.529 | 18/300 | **0.883** |
| **C1** same positions, rhyme NOT required | 300 | 0 | 10.0% | 0.000 | **300/300** | **0** |
| **C2** rhyming, positions randomised | 264 | 36 | 10.0% | 0.584 | 15/264 | **1** |

### Arm A passed, and C1 shows the pass was tautological

Arm A is unanimous — every one of 264 poems significant, Fisher p = 0. It
establishes something real and something the project had never had: **the
plumbing works on natural non-English text.** A stream built by `ltc` rather
than CMUdict, indexed, run through the statistic and its permutation null, on
1,200-year-old verse.

It establishes **nothing about rhyme**, and C1 is why. Drop the rhyme
requirement — take every line-final of lines 2/4/6/8 whether or not `ltc` says
they rhyme — and the result is *identical*: 300/300, Fisher p = 0. Arm A's
p-value is carried entirely by **line length**. Every second line-end in an
isosyllabic form is periodic whether or not anything rhymes there.

That is the H3 tripwire from `TIME_PREREGISTRATION.md`, and it bites **harder
in Chinese than in English**. English sonnets are isosyllabic but not
iso-*stress*-count, so line-final position varies on the stress grid and the
English `against_all` control came out null. In Chinese, one character is one
syllable, so the degeneracy is exact and total.

C2 is the control that behaves: keep the rhyme, randomise the positions, and it
goes to Fisher p = 1. The same number of events placed at random detects
nothing. Between C1 and C2 the attribution is unambiguous — **position, not
rhyme**.

### Arm B is the real question, and it replicates the English null

With the guaranteed line-final periodicity excluded, internal rhyme placement
in Tang regulated verse shows **no periodic structure**: 18/300 at α=0.05,
Fisher p = 0.883.

That is the Chinese analogue of H1, and it agrees with the English sonnet arm
(Fisher p = 0.950, k=23). **Two language families, two unrelated prosodic
systems, same answer.** Forms fix sound-repetition at line ends; they do not
additionally organise internal rhyme against a period. This is the
cross-family replication the corpus specification was built to get, and the
answer it returns is negative in both cells.

Saturation in arm B runs at 50% — Chinese rhyme categories are coarse (58
groups), so half of all positions share a category with something. That is high
but under the 0.75 ceiling, and it is a property of the writing system's rhyme
inventory rather than of the verse.

### What Part D changes

The layer now has a validated non-English path and a second family reporting
the same null. What it still does not have is a cell where the *mandated*
constraint is internal rather than line-final — which is exactly what
dróttkvætt, cynghanedd and gabay would have supplied, and all three remain
blocked. Until one of them is sourced, every positive control available to this
project is positional by construction, and its passing says only that the
instrument runs.

### Order of work

1. **Part A is done** and it gates everything: the instrument is sound, and the
   binding constraint is events per item, not corpus choice.
2. ~~**Phonology before corpora.**~~ **DONE for the cheapest three** —
   `fin`, `som`, `ltc`. Welsh, Indic and Old Norse remain blocked.
3. **Pooling before more items.** Fisher across items is already implemented in
   this document's Part A analysis and recovers most of what n=1 threw away.
4. **律詩 first**, because it is the only cell currently sourced, phonology-clean
   and provenance-clean at once — and pooling across thousands of poems is what
   defeats the events-per-item constraint from Part A.
5. Then the remaining positive cells, in family order, each with its own
   provenance row. gabay is **blocked, not pending**: see Part C.
