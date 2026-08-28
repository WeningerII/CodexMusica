# RESULTS — mark coverage: what the section vocabulary cannot type

> **REPINNED 2026-08-28 (M-52's close): typed ~~77,090~~ 77,093, decided
> ~~125,504~~ 125,501, declared functions ~~21~~ 22, witnessed ~~4~~ 5 —
> every unit of the delta is `patter` entering the vocabulary on its
> printed Ruddigore witness (the three `[PATTER]` blocks move DECIDED ->
> TYPED, and their old refusal reason "a function this vocabulary does
> not declare" stopped being true by declaration). `undecided` and
> `apparatus` are unmoved, which is still the half that matters. The
> percentages and per-mark tables below this block are the 2026-08-22
> reading and are ~0.004% away; they are left as history rather than
> re-derived, since the delta is three blocks in one file.**

`quality/mark_coverage.py`, run 2026-08-20 over `corpus/song/` at
~~1,423~~ **1,414** files (1,423 was the count BEFORE the same commit's
23 twin merges; `corpus/song/` has not changed since). **REPINNED 2026-08-20** after the Home Book of Verse safe subset
landed: typed 71,748 -> 76,944 and ~~36.4%~~ -> 38.0%, and **nothing
else moved at all**. HBV marks its blocks `[VERSE n]` throughout, so it
adds 5,196 typed blocks and not one new refused mark — decided,
undecided, apparatus and the witnessed-function count are byte-identical
across a load of 1,049 items. **~~and nothing else moved at all~~ —
STRUCK 2026-08-21: two UNPINNED figures moved with it, `[VERSE]` by
5,197 and the rhyme channel by 4,147, and the invariance claim was made
over the four buckets `--check` covers rather than over the document.
Scope an invariance to what is pinned, or pin what it is scoped to.** The refusal is Persian, and no amount of
English anthology moves it: that invariance is the sharper half of this
repin. Re-derived by `python3 quality/mark_coverage.py --check` (exit 1
on drift; an off-by-one on any pinned figure fails it, proven by
mutation).

The question, in the owner's words: *how many blocks, in which
languages, and what would it cost to type them.* The naming question —
what any new row should be **called** — is deliberately not answered
here. That is a vocabulary decision, and vocabulary decisions are the
owner's.

---

## 0. THE HEADLINE

**Typed is the minority. 38.0% of marked blocks in this corpus reach a
declared section function; 62.0% are refused.**

| bucket | blocks | share |
|---|---:|---:|
| **typed** — reaches a declared function | ~~76,930~~ **77,090** | 38.03% |
| **decided** — refused *with a written reason* | ~~125,490~~ **125,504** | 61.92% |
| **undecided** — refused, no row either way | 32 | 0.02% |
| **apparatus** — a bare numeral | 59 | 0.03% |

~~202,525~~ **202,685** marked blocks over ~~36~~ **39** distinct marks.

> **REPINNED 2026-08-22 (second time today), and the TABLE was carrying a
> figure its own repin note had already superseded.** Two separate things:
>
> 1. **`typed` +160, from the K-4 Old Norse load.** `non` measures 160 typed /
>    0 decided / 0 undecided — 160 songs, one `[VERSE 1]` each. The whole
>    drift is one prefix. `decided`, `undecided` and `apparatus` are UNMOVED,
>    which is the half that matters: the load added nothing to the pile nobody
>    has considered.
> 2. **`decided` was already stale HERE.** The note below repinned it
>    125,490 → 125,504 on 2026-08-22 and this table was not updated with it,
>    so the table and the note under it disagreed, and the stated total
>    (202,525) matched neither. That is a hand-kept index of a derived figure,
>    which is the thing `--check` exists to end — and `--check` did not catch
>    it, because it reads the CODE pin and not this table.
>
> Found by an audit agent, not by the load's closing sitting. This is the
> **third** gate the Old Norse load left red that no `--check` in the standard
> set catches, after `test_corpus_taxonomy` §6 and `test_grid`'s air census.

**Four counts, never
summed** (doctrine 79): a decided refusal is a position the vocabulary
has taken, an undecided one is a gap nobody has looked at, and adding
them would report the second as though someone had thought about it.

~~**The single most common section mark in this corpus is one the
vocabulary refuses to type.** `[BAYT]` appears 70,866 times against
`[VERSE]`'s 68,976.~~

**STRUCK 2026-08-21: THIS SENTENCE WAS FALSE ON THE DAY IT WAS REPINNED,
AND THE PINNED CHECK CANNOT SEE IT.** `[VERSE]` is **74,173**, not
68,976 — 68,976 is the PRE-HBV count, and the repin above says in its
own words that HBV "adds 5,196 typed blocks". 68,976 + 5,196 = 74,172,
i.e. the number this sentence compares against was superseded by the
same edit that wrote the paragraph above it. **`[VERSE]` 74,173 beats
`[BAYT]` 70,866: the most common section mark is TYPED.**

`VERSE` is not in `PINNED`, so `mark_coverage.py --check` passes green
over it — a false headline under a passing gate, which is this
document's own subject one level up.

**WHAT SURVIVES, and it is most of the point:**

* `[BAYT]` at 70,866 outnumbers **every typed mark except `VERSE`** —
  `BURDEN`, the next one, is 1,753.
* The bucket split is untouched and pinned: **38.0% typed against 62.0%
  refused**, and **99.7%** of decided refusals are `fas`.
* The refusal is Persian and no English anthology moves it. That half of
  the repin's claim holds; what does not hold is "nothing else moved at
  all" — `[VERSE]` moved by 5,197 and the rhyme channel by 4,147, and
  neither is pinned, so neither was seen.

**AND THE COMPARISON HAS A SECOND TRAP, walked into on 2026-08-21 by a
reader of this document.** `[VERSE n]` is **47,655 in `eng_` alone** and
74,173 corpus-wide (eng 47,655 · ltc 19,552 · fin 5,944 · cym 780 · san
242). Comparing the English-only count against `[BAYT]`'s corpus-wide
70,866 makes the struck sentence look true again by summing two
different populations — doctrine 79, in a paragraph that invokes
doctrine 79 three lines above. **State the population beside the mark or
the comparison is not a comparison.**

And the second headline, which is about the vocabulary rather than the
corpus:

**21 section functions are declared. 4 are witnessed.**

- witnessed: `burden`, `chorus`, `refrain`, `verse`
- unwitnessed: `breakdown`, `bridge`, `build`, `coda`, `drop`,
  `false_ending`, `hook`, `interlude`, `intro`, `outro`, `postchorus`,
  `prechorus`, `reprise`, `solo`, `tag`, `turnaround`, `vamp`

Seventeen functions are declarable in a blueprint and attested by no
printed block anywhere in the corpus. `MARK_FUNCTION` has five keys, and
that is the whole bridge between what sources print and what the model
declares. This is not new — `FormConvention.reprises` already records
that *"no printed block in `corpus/song/` can witness one of these three
pairs"* — but it had never been counted.

---

## 1. Where the refusal falls, by language

| lang | typed | decided | undecided | apparatus |
|---|---:|---:|---:|---:|
| fas | 0 | 125,059 | 0 | 0 |
| eng | 50,122 | 38 | 30 | 59 |
| ltc | 19,552 | 0 | 0 | 0 |
| fin | 5,979 | 127 | 0 | 0 |
| cym | 810 | 1 | 0 | 0 |
| san | 481 | 136 | 0 | 0 |
| msa | 0 | 129 | 2 | 0 |

**The refusal is almost entirely Persian.** 125,059 of 125,490 decided
refusals (99.7%) are `fas` — the ghazal corpus, whose every structural
mark is `[BAYT]` or `[RADIF]`. Two languages, `fas` and `msa`, have
**zero** typed blocks: not one section of Persian or Malay song in this
corpus reaches a declared function.

Middle Chinese (`ltc`) at 19,552 typed is the interesting counter-case —
it types cleanly because that material was staged with `[VERSE]` marks,
which is itself a staging decision worth re-examining rather than a
finding about the form.

## 2. The refused marks

| mark | blocks | lines | files | songs | languages |
|---|---:|---:|---:|---:|---|
| BAYT | 70,866 | 87,452 | 31 | 8,350 | fas |
| RADIF | 54,193 | 54,280 | 30 | 5,671 | fas |
| SLOKA | 136 | 136 | 1 | 24 | san |
| PANTUN | 88 | 347 | 1 | 88 | msa |
| PART | 61 | 0 | 1 | 42 | fin |
| NOTE | 48 | 39 | 2 | 3 | fin |
| QUATRAIN | 41 | 163 | 1 | 41 | msa |
| SIDENOTE | 18 | 20 | 7 | 8 | eng |
| VARIANT | 18 | 0 | 1 | 2 | fin |
| GOTHIC | 13 | 0 | 1 | 13 | eng |
| MUSIC | 4 | 0 | 1 | 1 | eng |
| PATTER | 3 | 28 | 1 | 1 | eng |
| CYWYDD | 1 | 108 | 1 | 1 | cym |

Six of these thirteen (`NOTE`, `SIDENOTE`, `MUSIC`, `GOTHIC`, `VARIANT`,
`PART`) are editorial apparatus and are refused for that reason, not for
a vocabulary reason. **The musical gap is BAYT, RADIF, SLOKA, PANTUN,
QUATRAIN, CYWYDD and PATTER** — and of those, two carry 99.7% of the
mass.

`PATTER` is the one English entry, and its refusal reason is the model
of the whole problem: *"a music-hall function this vocabulary does not
declare. It is refused rather than folded into `verse`, because folding
it in would delete the distinction the printer made."* Three blocks.

### The undecided bucket is not a vocabulary gap

**26 of its 32 blocks (81%) carry no lines at all** — a section mark has
verse under it and a bracketed editorial note does not. Inspected, they
are stage directions and provenance notes in *closed* brackets that
`_MARK_RE` matches and `ingest_mark` then refuses: `[Enter
Mephistopheles.]`, `[First published in _Memoir_ of Rev. F. Hodgson,
1878]`, `[FN#1]`, `[MS. M. First published, _Childe Harold_, 1812]`.

So it is apparatus with no refusal row yet, and reading the bare 32 as
"32 unconsidered section types" would be wrong. **The musical gap is
entirely in the decided bucket.** (This is the closed-bracket sibling of
the unclosed-bracket case `test_song_function` §9 already pins.)

---

## 3. THE SHAPE HALF — can the machinery already built describe them?

Measured with the repo's own primitives rather than a second definition
(doctrine 1): recurrence per song, and `compare_returns` on consecutive
instances placed on the 15-way `VARIATION_KINDS` ladder.

**Called with NO rhyme key, on purpose.** This material is Persian,
Sanskrit, Finnish and Malay; handing it the English phonology would be
doctrine 45's error — a checker silently picking a phonology and making
a claim it never states. The rhyme channel therefore answers
**cannot_tell ~~156,286~~ 160,433, told 0**. The refusal is the finding,
not a gap. (Repinned 2026-08-21: the count moved with the HBV load and
this figure is not in `PINNED` either. **`told 0` — the finding — is
untouched**, which is why the drift is a bookkeeping fault and not a
result.)

| mark | recurs | ladder (top kinds) |
|---|---|---|
| BAYT | 8,350 / 8,350 songs (100%) | REWRITTEN_RETURN 53,345 · ANAPHORIC_RETURN 1,809 · EPIPHORIC_RETURN 986 · HEAD_PRESERVED 247 |
| RADIF | 5,671 / 5,671 (100%) | EPIPHORIC_RETURN 30,724 · TAIL_PRESERVED 15,963 · ANAPHORIC_RETURN 1,358 · LEXICAL_VARIATION 223 |
| SLOKA | 24 / 24 (100%) | REWRITTEN_RETURN 112 |
| PATTER | 1 / 1 (100%) | REWRITTEN_RETURN 1 · EPIPHORIC_RETURN 1 |

Three things fall out, and the second is the sharp one.

**(a) Every refused mark recurs in 100% of its songs.** Whatever these
are, they are returning units. The `recurrence` contract the vocabulary
already carries (`once` / `returns` / `open`) has a well-defined answer
for all of them.

**(b) THE REPO ALREADY TYPES RADIF ON ONE LADDER WHILE REFUSING IT ON
THE OTHER.** `RADIF` lands overwhelmingly on `EPIPHORIC_RETURN` and
`TAIL_PRESERVED` — and those two kinds' own glosses, written long before
this measurement, read *"the radif shape at block scale"* and *"the
radif shape, inside a line rather than across lines."* So the variation
layer knows what a radif is and names it twice, while the section layer
refuses the mark as *"a RHYME DEVICE — not a span of the song."*

Both are defensible and they may simply be about different objects (the
device vs. the span). But one vocabulary naming a phenomenon and its
neighbour declining to is worth a deliberate answer rather than an
accident of which module was written first.

> **THE PARKED QUESTION HAS AN ANSWER NOW, AND IT IS `BOTH, AT DIFFERENT
> LAYERS` — recorded 2026-08-21 from a per-language vocabulary census plus a
> ~900-term world survey the owner compiled.** The survey's own bucket headers
> — framing / initiating / medial / goal / contrasting / instrumental /
> connective / rear-framing — are a **small closed FUNCTION vocabulary that
> nearly every world name maps into**: sthayi, coro, pallavi, drop, estribillo,
> mukhda and chorus are all *goal*. That is the GLOBAL layer, and it is closed.
> The NAMES are per-tradition data rows, attested-or-blank, entering with their
> first staged song exactly as `CORPUS_LOADING_PROTOCOL.md` already requires.
>
> **THE CENSUS IS WHY THIS IS NOT A COIN-FLIP.** Three facts decide it:
> **(1)** `SECTION_FUNCTIONS` declares 21 functions and the corpus witnesses
> **4** — one global table is not straining. **(2)** What is representable
> today is a function of *which English word a stager reached for*: `san` at
> **2 files** types 4 of 5 marks because someone wrote `BURDEN`/`BURDEN-TAIL`,
> while the identical Persian radif, transliterated, types at **0%** across
> 125,059 blocks. A per-tradition NAME table with a global FUNCTION column is
> precisely the coordinate doctrine 45 says must be declared rather than
> implied. **(3)** Building the name tables from a term LIST rather than from
> staged text would populate rows with zero members — measured, 8 of the
> survey's expected terms (sèist, penillion, toddaid, gwawdodyn, takhallus,
> matlaʿ, qafiya, anuṣṭubh) occur in **0 files**, and the 4 Finnish `seist`
> hits are `seistä`. That is the declared-but-unread defect in a taxonomy hat,
> and the protocol already refuses it.
>
> **`RADIF` RESOLVES UNDER THE SAME ANSWER AND IT IS A WRONG-LAYER REFUSAL,
> not a vocabulary gap.** It is a rhyme device refused by a SECTION table; it
> belongs beside `Mandate.returns` / `repeat_licence`, which already model
> licensed repetition, and beside `relations.py`'s `"epistrophe / radif"`
> family — which **already names English epistrophe, Persian radīf, Turkish
> redif, Arabic ḥājib and Spanish epífora as five members of one relation**.
> The cross-tradition table the section layer is missing exists in the relation
> layer and has for some time.

**(c) BAYT lands on REWRITTEN_RETURN 53,345 times, and that is the
ladder's shrug.** Its gloss says it has *"two readings the harness
cannot choose between: a chorus that rewrites, or a mark that groups two
different sections."* The ghazal is a **third** reading the gloss does
not have: a form whose unit recurs *by design* with entirely new
content, which is a positive structural fact and not a failure to match.
The ladder is not wrong here; it is under-specified, and 53,345 blocks
is a large amount of evidence landing in a category that means "none of
the above."

---

## 4. What it would cost

Cheap, and the cost is not the code:

- **`MARK_FUNCTION` and `SECTION_FUNCTIONS` are plain tables**, and
  `MARK_REFUSED` already holds a written argument for each candidate.
  The to-do list is authored and justified; nothing has to be
  rediscovered.
- **The contracts already fit.** Recurrence answers for every mark; the
  variation ladder answers for all four that recur with lines.
- **The rhyme channel would need a per-language key** to say anything,
  which is a phonology question, not a vocabulary one — and `fas` and
  `san` phonologies already exist in this repo.

What it would actually cost is a **decision about scope**, and this
document does not make it. `data/song_functions_eng.tsv` is
language-scoped *by name*, on the stated reasoning that *"functions are
attested by source types, and source types are a language community's
own genres."* That principle is adopted for **song** function and not
for **section** function, which is global and English. Applying it —
per-tradition section vocabularies with `FormConvention` as the
per-tradition expectation set — is the structural answer, and it is a
sitting of its own.

**What is NOT licensed by this measurement:** calling a bayt a `verse`.
The shape half says bayt behaves like a returning unit with new words;
that is a fact about behaviour and not a warrant for the name, and
`MARK_REFUSED` exists precisely to stop the inference. Doctrine 43.

---

## 5. Reproduce

```
python3 quality/mark_coverage.py            # the census
python3 quality/mark_coverage.py --check    # re-derive against the pins
python3 quality/mark_coverage.py --json     # the whole scan
```

**REPINNED 2026-08-22: typed ~~76,944~~ 76,930, decided ~~125,490~~ 125,504 —
exactly −14 and +14, and the sign of each is the finding.** The 14
pìobaireachd movement headings (`URLAR`/`SIUBHAL`/`CRUNLUATH`) were `[VERSE
n]` blocks whose entire lyric was the heading (`MISSING.md` M-25(a)), so they
counted TYPED. Staged as marks and declared in `grid.MARK_REFUSED` they are
DECIDED: refused with a written reason. **`undecided` is UNMOVED at 32**,
which is the half that matters — nothing was added to the pile nobody has
considered. Found by `quality/pin_sweep.py` on its first full run, not by a
suite: this figure re-DERIVES from the corpus, and the edit that moved it
landed in a commit whose gates were all green.

`--check` pins typed ~~76,930~~ **77,090** / decided 125,504 / undecided 32 /
apparatus 59, declared 21, witnessed 4. It exits 1 on drift and names
the moved figure; an off-by-one on any of them fails it, verified by
mutation.
