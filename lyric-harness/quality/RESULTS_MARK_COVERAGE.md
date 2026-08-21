# RESULTS — mark coverage: what the section vocabulary cannot type

`quality/mark_coverage.py`, run 2026-08-20 over `corpus/song/` at 1,423
files. **REPINNED 2026-08-20** after the Home Book of Verse safe subset
landed: typed 71,748 -> 76,944 and ~~36.4%~~ -> 38.0%, and **nothing
else moved at all**. HBV marks its blocks `[VERSE n]` throughout, so it
adds 5,196 typed blocks and not one new refused mark — decided,
undecided, apparatus and the witnessed-function count are byte-identical
across a load of 1,049 items. The refusal is Persian, and no amount of
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
| **typed** — reaches a declared function | 76,944 | 38.00% |
| **decided** — refused *with a written reason* | 125,490 | 61.96% |
| **undecided** — refused, no row either way | 32 | 0.02% |
| **apparatus** — a bare numeral | 59 | 0.03% |

202,525 marked blocks over 36 distinct marks. **Four counts, never
summed** (doctrine 79): a decided refusal is a position the vocabulary
has taken, an undecided one is a gap nobody has looked at, and adding
them would report the second as though someone had thought about it.

**The single most common section mark in this corpus is one the
vocabulary refuses to type.** `[BAYT]` appears 70,866 times against
`[VERSE]`'s 68,976.

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
**cannot_tell 156,286, told 0**. The refusal is the finding, not a gap.

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

`--check` pins typed 76,944 / decided 125,490 / undecided 32 /
apparatus 59, declared 21, witnessed 4. It exits 1 on drift and names
the moved figure; an off-by-one on any of them fails it, verified by
mutation.
