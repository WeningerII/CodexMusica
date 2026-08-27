# Pre-registration — the structure census, run 1: English

Committed **with the instrument and before any corpus-wide number exists**.
`git log` proves the order: this file and `quality/structure_census.py` land
together; `RESULTS_STRUCTURE_CENSUS.md` and `data/structure_census_eng.tsv`
land later, and no realization rate over the population appears anywhere
until they do.

## The question, and whose question it is

For every (corpus file, catalog structure, pair population) cell: **what
fraction of pairs REALIZE the structure**, with refusals counted apart. The
owner set the direction on 2026-08-18, overturning the previous plan
(one structure against one corpus, Kalevala first): pairs realize N
structures at once, structures recur across corpora, and a survey that
records the full set per pair is strictly more information than one that
pre-assigns a single question. The half this registration adds, argued in
the same conversation and accepted: **counting where a structure appears
and measuring what is lazy under it are different measurements.** Laziness
is a property of choices made under a constraint; almost everything this
census counts in English is INCIDENTAL — chance co-occurrence, not
constrained choice. So this census is the **null half** of every future
laziness calibration: the chance-rate table. It makes **no laziness claim
about any structure**, and a phase-2 calibration may draw signal only from
cells declared `constrained` and null only from cells declared
`incidental`. Blending the two is the bias this design exists to refuse
(doctrine 14: a control may not be defined in terms of the quantity it
controls; doctrine 27: a null must not be conditioned on the filter it
calibrates).

**Why English first (the owner's de-risk, 2026-08-18):** the census is a
new instrument, and English is where instrument bugs are separable from
reading bugs — the most mature phonology, the most tested reader, and the
production language whose null table enforcement consumes first. The
schema below is world-shaped from day one so that adding a language later
adds ROWS, never changes the instrument.

> **THE SCHEMA KEEPS THAT PROMISE AND THE TOKENISER DOES NOT — AMENDED
> 2026-08-21, before run 2 rather than after it.** Measured: the judge layer is
> genuinely language-neutral, all 57 non-comparator rows through all ~~7~~
> **9** phonologies with **0 exceptions** — REPINNED 2026-08-26, and it NEVER
> HELD: `quality.phonology.declared()` answers
> `cym eng fas fin ltc msa non san som` and answered nine on the day "7" was
> written, so the figure was wrong when recorded rather than gone stale. The
> claim it supports is unchanged and slightly stronger (57 x 9 = 513 calls, 0
> exceptions) — and `items_of()` splits on the literal
> `--- TITLE:` prefix that every tradition already carries — so **section marks
> are not a blocker for any tradition**, and `language`/`phonology` are already
> columns in the output schema. That half of the promise is real.
>
> ~~**`pair_counters()` calls `lyric_harness.line_tokens`, which is ASCII-only
> and never asks the phonology for its tokens.**~~ **STRUCK 2026-08-26 —
> REPAIRED 42 MINUTES AFTER THIS BOX WAS COMMITTED, by `77b5b10`, which gave
> `pair_counters` a declared per-language tokeniser table and a `NoTokeniser`
> refusal; `1580d11` then moved `line_tokens` itself onto the declared
> `LATIN_SCRIPT` repertoire. Verified at head: `pair_counters` calls
> `tokeniser_for(language or language_of(path))`. Kept because it is the reason
> that table exists, not because it is still true (doctrine 17).** The rates it
> recorded, re-derived 2026-08-26 against a frozen ASCII control: `ltc` yields
> zero tokens on 99.9% of lines (107,743/107,868), `fas` on 100.0%
> (141,731/141,732), `san` mis-tokenises 96.6% of lines (765/792) into
> plausible-looking Latin fragments, ~~`fin` 41.6%~~ — **`fin` STRUCK
> 2026-08-26: IT REPRODUCES UNDER NO DEFINITION. Eight
> (definition x population) combinations over the same 41,805 lines span
> 21.3%-51.0% — count-differs 37.2%, any-difference 50.5%, endword-differs
> 21.3% — and none is 41.6%. The measuring script was never committed, which is
> standing rule 3's own shape: a figure from a private instrument is a figure
> nobody can check, and this is the second such figure this file has had to
> strike in one day (`MISSING.md` M-138 is the first).** **This is the exact
> substitution that VOIDED Kalevala alliteration run 1** (`CLAUDE.md`: *"the
> ASCII tokenizer had shredded ä/ö, and the fin phonology's `_tokens` was the
> one definition all along"*), and adding a language would therefore change
> the instrument after all.
>
> ~~**Run 2 may not begin until `pair_counters` asks the phonology.**~~
> **CONDITION MET 2026-08-21 by `77b5b10` — RECORDED HERE 2026-08-26, FIVE DAYS
> LATE.** The registration named a blocker, the blocker cleared 42 minutes
> later, and nothing wrote it down, so for five days this document read as
> though run 2 were still barred by a defect the tree had already repaired. A
> cleared blocker that nobody records is the same defect as an uncleared one
> nobody records, one sign flipped. Recorded
> here rather than in the results, because this is a registration promise and a
> registration is the right place to discover it cannot be kept.
> `MISSING.md` `M-22` holds the measurement; `M-23` holds the second
> obligation — ~~`RHYME_CONSTRAINED_FAMILIES` names only `eng_song`/`sonnets`,
> so every non-English cell would emit `constrained=no`~~ **STRUCK 2026-08-26:
> `6f8fc0c` gave the tag THREE states and a non-English cell emits
> `undeclared` — verified at head, `constrained()` returns
> `"yes" | "no" | "undeclared"` under a docstring citing doctrine 20. THE
> OBLIGATION ITSELF STANDS**: a ghazal's radif and a cywydd's cynghanedd still
> owe a `RHYME_CONSTRAINED` row before run 2 tags them. What changed is the
> failure mode — from a false `no`, which is a claim about a tradition nobody
> examined, to an honest `undeclared`, which is the refusal doctrine 20 asks
> for.

## The reading — one judge, the grader's own

Every pair is judged by `quality.structures.judge(name, a, b, phon)` — the
IDENTICAL call `grade()` routes declared structures through. No private
re-implementation (doctrine 48), no second spelling of any rule (doctrine
1). The `eng` phonology reads every word; a member the phonology declines
is the judge's own `None`, counted REFUSED.

**57 rows, not 58.** The comparator sentinel (`english-end-rhyme`) is
excluded: its judge REFUSES by design (the scalar path inside `grade()`
owns it), and its English base rates are already held by
`data/song_endword_en.tsv` / `data/song_rhymepair_en.tsv` and the sonnet
battery. The `masculine-rhyme` cell — perfect rhyme at the last prominent
syllable — is the catalog's nearest question and is censused, which gives
the cross-check without a second implementation of the scalar band.

## Declared coordinates

| coordinate | value |
|---|---|
| corpora, run 1 | every `corpus/song/eng_*.txt` (143 files), plus `corpus/sonnets.txt` and `corpus/whitman.txt` |
| item | `eng_*` song files: a `--- TITLE:` block — exactly `quality/build_song_frequency.py`'s convention (its 4,930-item count is the cross-check); a file with no marks is one item. `sonnets.txt`: `battery.parse_sonnets`, the oracle's own reader (152 fourteen-line items, Gutenberg matter excluded by it). `whitman.txt`: `battery.whitman_verse`, the 150-line negative-control slice every recorded Whitman figure is measured on, one item. Pairs never cross an item boundary — a pair across two songs answers no question any tradition asks |
| lyric line | `lyric_harness.is_apparatus_line` decides — the one shipped definition |
| tokenizer | `lyric_harness.line_tokens` at its shipped default (`strip_parens=True`), the same reading the corpus frequency tables were built under |
| population `endword-cross` | within each item, every pair of line-end words (`raw_final_token`) of lyric lines, each pair once, judged in LINE ORDER (earlier line's word as the judge's first argument) — the same call order `grade()` uses, which matters because some judges are asymmetric |
| population `word-within-line` | within each lyric line, all ordered pairs (earlier word, later word) of its tokens — ordered because some judges are asymmetric (a searched first anchor against a fixed last anchor); the tradition-native population for within-line structures |
| both populations for every row | which population a tradition natively binds is recorded in RESULTS prose, not used as a filter — phase-2 calibrations pick their population; the census measures both |
| verdict accounting | per cell: `n_pairs`, `n_true`, `n_false`, `n_refused`; the three verdict counts MUST sum to `n_pairs` (falsifier F1) and are never summed with each other in any reported rate (doctrine 79) |
| realization rate | `n_true / (n_true + n_false)` over JUDGED pairs only; a cell with zero judged pairs reports no rate, not 0.0 (doctrine 20) |
| dedup rule | verdicts are computed once per unique (structure, ordered spelling pair) per file and multiplied by multiplicity — sound because the judge is a deterministic pure function of spellings and phonology, and VERIFIED in the pilot by running one file both ways and requiring byte-identical cell counts |
| constrained tag, run 1 | `endword-cross` cells of the end-rhyme family rows (`masculine-rhyme`, `feminine-rhyme`, `dactylic-rhyme`, `perfect-rhyme`, `perfect-rhyme-(last-stressed-syllable)`, `rime-riche-(last-stressed-syllable)`) over `corpus/song/eng_*` and `corpus/sonnets.txt` are `constrained`; **every other cell in run 1 is `incidental`**, and `corpus/whitman.txt` is `incidental` on every row — the declared negative control |
| determinism | no RNG anywhere in the census proper; the one sampled diagnostic (D1) uses `random.Random(20260818)`; output TSV is sorted (corpus_file, structure, population) |
| output | `data/structure_census_eng.tsv` — columns `language, phonology, corpus_file, family, structure, kind, population, constrained, n_pairs, n_true, n_false, n_refused, rate_judged`; a `data/sources.tsv` row names the builder (doctrine 34) |
| budget | 4 wall-clock hours, shardable by file. If the pilot projects past it, the fallback is a uniform random FILE sample at seed 20260818, size chosen to fit, DISCLOSED in RESULTS as a sample and never reported as the population |

## Pre-registered expectations and falsifiers

- **E1 (direction, falsifiable).** For the constrained end-rhyme family
  rows over `endword-cross`: the pooled `eng_song` rate and the
  `sonnets.txt` rate each EXCEED the `whitman.txt` rate. Rhyme-constrained
  verse must out-rhyme free verse at its own question, or the instrument
  (or the tag) is wrong. Failure → no adoption; diagnose before anything
  is quoted.
- **F1 (accounting, hard).** Any cell where the three verdict counts do
  not sum to `n_pairs` is an instrument bug. No adoption.
- **F2 (readability, hard).** Rows 100% refused over BOTH populations are
  listed by name with the refusing reason. A row known readable in English
  (`masculine-rhyme` is the canary) coming back 100% refused falsifies the
  instrument. Rows genuinely unreadable in English (a fixed-index akṣara
  question, a tone-class question) SHOULD appear here — their appearing is
  the refusal accounting working, and their absence would itself be
  suspicious.
- **D1 (diagnostic, recorded, NOT a falsifier).** On 1,000 seeded
  `endword-cross` pairs from `eng_song`, the `masculine-rhyme` judge's
  verdict is tabulated against the engine's `admits()` verdict
  (RHYME/RIME_RICHE at theta). They are different questions — a cell
  compilation against a scalar band — so agreement is measured and
  disagreements exemplified, and no threshold is preregistered. Registered
  now so the number cannot be cherry-picked later.
- **Declared non-claim.** The alliteration, assonance, consonance and
  hending rates this census records over English are CHANCE RATES. No
  laziness tier, no `calibrated=True`, and no enforcement may cite them as
  anything but a null. The first signal measurement remains a constrained
  corpus in a later sitting (Kanteletar for alliteration), which will
  consume these cells as its null.

## Pilot clause

Before the full run: the first 5 `eng_*` files by name, plus `sonnets.txt`
and `whitman.txt`, are run end-to-end. The pilot (a) verifies the dedup
rule byte-for-byte on one file, (b) projects the full-run cost against the
budget, (c) exercises F1/F2 accounting. Pilot numbers are working notes,
not results; only the full run (or the disclosed sample fallback) is
quoted.
