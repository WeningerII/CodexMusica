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

**Phonology.** Known gap 6 has always said it: Welsh, Indic and Old Norse are
"blocked on transcription". The layer needs syllable boundaries and a
sound-identity relation per language. Some cells are cheap — Finnish is close
to phonemic, Somali alliteration is on the initial consonant, and Chinese rhyme
categories are lexicalized in rime tables. Others need real G2P. **A cell
without phonology cannot be run, and listing it here is a plan, not a
capability.**

**Reachability.** Measured this session: Project Gutenberg returns nothing
(blocked), GitHub *search* is scoped to this repository so it cannot discover
sources, and Hugging Face has none of these corpora. GitHub **raw** works when
an exact path is already known — `cltk/old_norse_text_perseus` resolves. So
sourcing is possible and hand-guided, and each cell needs its licence checked
separately: the medieval **texts** are public domain, but modern critical
editions and translations are not. `sources.tsv` already rejects the Sangam
Tamil dataset for precisely this — ancient PD text bundled with a living
translator's apparatus.

### Order of work

1. **Part A is done** and it gates everything: the instrument is sound, and the
   binding constraint is events per item, not corpus choice.
2. **Phonology before corpora.** A cell with text and no G2P contributes
   nothing. Finnish, Somali and Chinese are the cheapest three.
3. **Pooling before more items.** Fisher across items is already implemented in
   this document's Part A analysis and recovers most of what n=1 threw away.
4. Then the positive cells, in family order, each with its own provenance row.
