# RESULTS — phrase-level cliché, and why it is REFUSED

`MISSING.md` **H-1**, the tenth item on its Missing list: *cliché at the PHRASE
level rather than the rhyme-pair level*. One slice of H-1's programme, taken
on its own; the other nine (imagery, specificity, metaphor, point of view,
tense, narrative movement, the turn, register consistency, showing-vs-telling)
are untouched here on purpose.

**The result is the second of the two H-1's brief allowed: a measured argument
that the available corpus cannot support the check, and exactly what it would
take.** The instrument is built, it runs, and it ships REFUSING. Doctrine 84:
the demonstration stays reachable, so this file is checkable rather than
quotable.

    python3 quality/phrase_commonplace.py --measure      # §1 §2 §3 §4
    python3 quality/phrase_commonplace.py --nulls        # §5
    python3 quality/phrase_commonplace.py --period       # §6
    python3 quality/phrase_commonplace.py --scaling      # §9's second table
    python3 quality/phrase_commonplace.py --self-test    # §8, the four fixtures
    python3 quality/phrase_commonplace.py FILE           # refuses, exit 2
    python3 quality/phrase_commonplace.py --check        # 0 pass 1 moved 2 cannot tell

---

## THE SENTENCE THAT USED TO BE HERE, AND WHY IT IS GONE — 2026-08-14

Line 11 of this file read, in an unbroken sentence with the paragraph above:

> The instrument is built, it runs, it ships REFUSING, **and every number
> below re-derives from it.**

**That clause was false from the day it was written, and it stayed false for
three days after two of the sections it covered had already been annotated
WITHDRAWN.** It is a document asserting a mechanical property it did not have,
which is worse than any single wrong number in it: a reader who checks one
section and finds it reproduces is licensed by that sentence to believe the
rest do too. §5 and §6 had no producer, §9's scaling table had none, and §0
and §7 read inputs deleted in `11aa19b`.

It is replaced by a claim that is now true and, more to the point, by a table
that can be checked one row at a time instead of trusted in one clause. Where
a row says PINNED, `--check` goes red if the figure moves.

| § | figures | producer | runs? | reproduces? |
|---|---|---|---|---|
| **0** | features computed vs read on a sonnet | ad-hoc, ~10 lines over `SlopFloor`+`QualityFeatures`; **not a shipped command** | yes | **YES, exactly** — re-run 2026-08-14, same ten computed, same two read, `concreteness computed? True / READ? False` |
| **0** | 152,313 / 152,154 / 159 | `--measure` | yes | **YES** · PINNED |
| **0** | the two `examples/` floor reports | **INPUT DELETED** (`11aa19b`) | no | **NO** — annotated 2026-08-13, values kept; token counts 327/291 reproduce, the findings do not |
| **1** | 143 authors, 991,751 tokens, the line counts | `--measure` | yes | **YES** · PINNED |
| **2** | T1, all five rows | `--measure` | yes | **YES, to the digit** · PINNED |
| **3** | T2, all eight published rows | `--measure` | yes | **YES, to the digit** · PINNED — and the producer prints a NINTH row this section omits, see §3 |
| **4** | T3, 81 firings / 72 witnesses / the full list | `--measure` | yes | **YES, every witness** · PINNED |
| **5** | the doctrine-68 `differ` fractions | **BUILT 2026-08-14**, `--nulls` | yes | **CLOSE, NOT EXACT** — 97.6–97.8% vs 97.8–98.0%, 99.9% vs 100.0% · PINNED as a floor |
| **5** | null rates 0.02% / 0.05%, lifts 59x / 17x, observed 0.98% / 0.85% | **BUILT 2026-08-14**, `--nulls` | yes | **NO** — measured 0.028% / 0.035%, 36.8x / 28.9x, observed 1.01%. Recorded values SUPERSEDED, kept visible |
| **6** | 115 authors, 1620–1929, bands 27/34/43/11 | **BUILT 2026-08-14**, `--period` | yes | **YES, EXACTLY** — and this overturns part of the 2026-08-13 withdrawal, see §6 · PINNED |
| **6** | the four correlations, the eight band rates | **BUILT 2026-08-14**, `--period` | yes | **NO, but close** — see §6 for how close and why not closer. New values PINNED, recorded ones SUPERSEDED |
| **7** | nine firings, every witness, line number and author count | `--force -n 3 -k 5`, **INPUT DELETED** | only via `git show` | **YES, exactly** — re-run 2026-08-13 off the recovered files |
| **8** | the `--self-test` transcript | `--self-test` | yes | **NO — DRIFTED, FOUND 2026-08-14.** `FIXTURE_SILENT` changed in `11aa19b`; the transcript still showed the old string. Corrected in §8 |
| **9** | the three-class table, the doctrine 92 argument | none needed — a licensing argument, not a measurement | n/a | n/a |
| **9** | the scaling table, rows 1 and 2 (71/107 authors) | **NONE, and the selection rule was never written down** | n/a | **NO — UNREPRODUCIBLE AS RECORDED.** Replaced with a declared rule, see §9 · PINNED |
| **9** | the scaling table, row 3 (143 authors) | `--measure` (it is T1's n=4/n=5 at k≥3) | yes | **YES** · PINNED |
| **10** | the `SEARCH:` row | none — a record of a search, not a measurement | n/a | n/a |
| **11** | prose | none | n/a | n/a |

**34 figures are pinned and `--check` reads all of them.** Three exit codes,
because two would collapse the case this file is about: **0** every pin holds,
**1** a figure moved, **2** cannot tell — the corpus is not on disk, or the
tagger the T2 columns and NULL C need is not installed, in which case nothing
was measured and nothing moved (doctrines 20, 28).

---

## 0 · What reproduced, and the one thing that did not

The brief's mechanism was verified by execution before anything was built.

| claim | verdict |
|---|---|
| `concreteness.txt` reaches the discriminator, never the writing path | **REPRODUCES, and mechanically** |
| the floor's checks are MATTR, function-word ratio, anaphora, line-length CV, predictable pairs | **REPRODUCES**, plus 4 relation-level checks |
| `CLICHE_PAIRS` is on rhyme PAIRS, so a phrase cliché is invisible | **REPRODUCES** |
| corpus is ~152,325 sung lines | **152,313** on K-1's rule — the working-tree figure, not the brief's. And **152,154** once rows with no alphabetic token are dropped; see §1, two statistics (doctrine 58) |

The concreteness claim is sharper than "not among them". `quality/floor.py`
**does** import `QualityFeatures` and **does** compute both concreteness
features on every run — it then reads exactly two keys out of the ten-feature
vector and discards the rest. Measured by wrapping the returned dict in a
recording `dict` subclass and running the floor on a sonnet:

```
features COMPUTED     : abstract_noun_ratio, concreteness_mean, concreteness_p90,
                        content_word_freq_mean, function_word_ratio, mattr,
                        pos_binding_diversity, rhyme_predictability_mean,
                        rhyme_predictability_min, syntactic_inversion_rate
features READ by floor: function_word_ratio, mattr
concreteness computed? True
concreteness READ?     False
```

So the semantic feature is not merely absent from the writing path — it is
computed on the writing path and thrown away.

> **RE-MEASURED 2026-08-14 AND IT REPRODUCES EXACTLY** — all ten computed
> features in the same order, the same two read, `concreteness computed? True`
> and `concreteness READ? False`. It is the one block in this file whose
> producer is neither a shipped command nor absent but **ad-hoc**: about ten
> lines wrapping `QualityFeatures.extract`'s return in a recording `dict`
> subclass and running `SlopFloor.report` on a sonnet. It is not in
> `phrase_commonplace.py` and it is not in `--check`, because it measures
> `quality/floor.py` and `quality/features.py`, which this cell does not own
> (doctrine 34's ownership half). **So it reproduces today and nothing will
> notice when it stops** — recorded as the residual gap rather than closed,
> since closing it means writing in a sibling's file.

**And the floor says nothing at all about either song in `examples/`:**

> **THE INPUT IS GONE FROM HEAD AND THIS BLOCK NO LONGER REPRODUCES —
> ANNOTATED 2026-08-13.** `examples/` was deleted entire in commit `11aa19b`
> (*"Remove Claude-authored example lyrics from the repo; fix the CLI's
> apparatus-line gap"*, 2026-08-12); `ls lyric-harness/examples` returns *No
> such file or directory* and `git log --diff-filter=D --
> 'lyric-harness/examples/*'` names `11aa19b` and nothing since. Recover both,
> read-only:
>
>     git show 11aa19b^:lyric-harness/examples/cherokee_bill.txt        > /tmp/cbill.txt
>     git show 11aa19b^:lyric-harness/examples/never_been_to_a_scene.txt > /tmp/nbtas.txt
>
> Re-run at head 2026-08-13: **`327 tokens` and `291 tokens` reproduce
> exactly**, and the rest of this block does not. `cherokee_bill` now reports
> `0 flag(s), 0 note(s)` — no findings at all — and `never_been_to_a_scene`
> reports `1 flag(s), 1 note(s)`: an `ANAPHORA_OVERLOAD` **flag** (14 of 41
> lines open with `i`, 34%) and a `PREDICTABLE_RHYME` note. So the sentence
> below this block — *at song length nothing length-sensitive runs at all* —
> **is false at head**, and it is false because of the exact work this section
> names as live: the `song` profile (150–400 tokens) shipped, and 327 and 291
> both sit inside it. `RESULTS_SONG_FLOOR.md` §6 is the record. Kept as
> written per doctrine 17. **Nothing in §1–§6 or §8–§9 reads these two files**,
> and none of it was re-run here (COST).

```
$ python3 -c "...SlopFloor().report(lines)"      # UNRUNNABLE — see the note above
examples/cherokee_bill.txt          SLOP FLOOR — 0 flag(s), 1 note(s)
  [NOTE] OUT_OF_CALIBRATED_LENGTH: 327 tokens is outside every calibrated length
examples/never_been_to_a_scene.txt  SLOP FLOOR — 0 flag(s), 1 note(s)
  [NOTE] OUT_OF_CALIBRATED_LENGTH: 291 tokens is outside every calibrated length
```

Zero flags on both, and the single note is doctrine 15 declining to serve.
That is stronger than H-1 claims: it is not that the craft checks stay silent,
it is that **at song length nothing length-sensitive runs at all**. The
`song` profile in `quality/floor.py` is a sibling's live work this round and
is not this cell's to touch or to report on.

---

## 1 · The statistic, declared

Full declaration in the module docstring (doctrine 1). The load-bearing
choices:

* **population** `corpus/song/eng_*.txt` — 143 files, one per AUTHOR,
  991,751 tokens, **pre-1931 by construction**.
* **two line counts, because they are two statistics** (doctrine 58).
  **152,313** is `MISSING.md` K-1's rule verbatim. **152,154** is the subset
  carrying at least one alphabetic token and is what the index is built on.
  The 159-line difference is rows of `*  *  *  *` and bare years like
  `1845.` — editorial furniture, not sung lines. `--measure` prints all
  three numbers so neither can be quoted as the other.
* **statistic** `disp(L)` = the largest number of distinct authors *other than
  this line's own* carrying any n-gram of L.
* **leave-one-author-out is mandatory.** Without it every n-gram of an
  author's own line scores at least 1 — doctrine 13's Finnish case exactly, a
  feature that is a monotone function of its own label.
* **authors, not token counts.** `the hills and far away` is 30 tokens in
  **two** authors: a burden, repeated because the form requires repeating it.
  Author-dispersion declines to call that a commonplace; raw frequency would
  not. Doctrine 8 at the author level.
* **length-independent.** Unlike five of the six shipped floor checks this
  needs no length profile — the one axis on which it behaves better than what
  ships (doctrine 15).

Tokenisation is stated in the module because a bare n-of-N is a coordinate of
a rule nobody wrote down (doctrine 58): lowercase, U+2019 → U+0027
(doctrine 26), tokens are maximal `[a-z']` runs, hyphens break, n-grams do not
cross a line boundary. The sung-line rule is `MISSING.md` K-1's own, reused
verbatim so the two cannot drift.

---

## 2 · T1 — the sparsity wall

```
 n | distinct  |  max | ngrams reaching k authors
   |  ngrams   | disp |    k=3     k=5     k=8    k=13
 2 |    348858 |  109 |   32939   14659    6736    2815
 3 |    569549 |   33 |    9264    2406     664     136
 4 |    508723 |   13 |     457      43       8       1
 5 |    378575 |    3 |      21       0       0       0
 6 |    251614 |    2 |       0       0       0       0
```

At n≥5 the corpus has no counts to work with — maximum dispersion 3 authors of
143. At n=4 the ceiling is 13 (9% of authors) and exactly **one** 4-gram in the
whole corpus reaches 13.

---

## 3 · T2 — the false-positive rate (doctrines 22, 94)

Stated as an FPR against a reference that **needs no judgement**, which is what
doctrine 94 requires of a reference line: *a phrase whose every token is
closed-class cannot be a cliché.* `it was a`, `and all the`, `of all the` are
the grammar of English — there is no craft decision inside them, so there is
nothing a writer could be asked to revise, and firing on one is a false
positive by construction. Closed-class membership is the repo's own
`FUNCTION_TAGS` from `quality/features.py`, tagged in context; no list this
cell wrote (doctrine 16).

8,000 held-out lines, leave-one-author-out, seed 20260811:

```
  n |  k | fires on | witness ALL closed-class | >=half closed-class
    |    | held-out |  = FPR lower bound       |
  3 |  2 |  26.27%  |    246/2102  =  11.7%    |  71.6%
  3 |  3 |  18.62%  |    196/1490  =  13.2%    |  74.2%
  3 |  5 |  11.10%  |    122/888   =  13.7%    |  74.2%
  3 |  8 |   6.02%  |     77/482   =  16.0%    |  77.0%
  4 |  2 |   1.01%  |      0/81    =   0.0%    |  86.4%
  4 |  3 |   0.50%  |      0/40    =   0.0%    |  92.5%
  4 |  5 |   0.14%  |      0/11    =   0.0%    | 100.0%
  5 |  2 |   0.06%  |      0/5     =   0.0%    |  80.0%
```

> **THE PRODUCER PRINTS NINE ROWS AND THIS TABLE HAS EIGHT — FOUND
> 2026-08-14.** `--measure` also emits `4 | 8 | 0.01% | 0/1 = 0.0% | 100.0%`,
> which this section drops with no note. Every published row reproduces to the
> digit; the defect is an omission, not a drift, and it is the smaller sibling
> of the one this file's header is about — a table that is a subset of its
> producer's output reads, to anyone re-running the command, exactly like a
> table that has moved. The row is now in `--check`'s pins (`t2[(4,8)]`), so
> the omission cannot become a drift later. Not silently inserted into the
> table above, because the table above is what reproduced.

**This is a LOWER bound and it is declared as one.** The reference is a
REFERENCE and not truth (doctrine 94): it under-counts, because a phrase with
one content word is scaffolding too — `the voice of the` is the English
genitive periphrasis, and the all-closed-class test scores it as a legitimate
hit because `voice` is a noun.

**There is no operating point.** At n=3 the check fires on a quarter of
ordinary verse and one witness in eight is pure grammar. At n=4 it almost
never fires, and when it does, 86–100% of witnesses are at least half
closed-class.

---

## 4 · T3 — every witness at n=4, k≥2

The whole inventory, 81 firings over 8,000 held-out lines, 72 distinct. This
is the table that decides the question, and it is printed in full rather than
summarised because the summary is what would have hidden it:

```
x3 the glory of the      x2 without and fears within  x2 in the land of
x2 for thine and thee    x2 in the blood of           x2 my heart within me
x2 let there be light    x2 both night and day
   on the verge of    the shade of the    ah woe is me     o'er the hills and
   the glory of thy   as in a dream       give me leave to the soul of the
   the spirit of thy  in spite of all     on the rock of   peace and joy and
   the sons of men    tis the voice of    the middle of the do what you can
   thy will be done   my love and me      i know not but   the hour that brings
   close of the day   on the top of       my god to thee   and all in vain
   the heart of a     at dawn of day      as well as i     on the throne of
   sing you a song    from pole to pole   the hills and far the voice of my
   as clear as the    the dawn of day     leave me to my   here's a health to
   on the wings of    my doubts and fears when first i saw on the edge of
   to god on high     in the midst of     what is it to    from day to day
   no more no more    at the end of       in all the land  from heart to heart
   from morn till night the lamb of god   the noble and the is at an end
   and i shall see    now here now there  the spirit of the what shall i do
   let me tell you    the flower of the   i love my love   and listen to the
   the treasures of the the darkness of the one by one the and the voice of
```

Sorted by what they are:

* **the genitive frame** (~40): `the glory of the`, `the shade of the`,
  `the soul of the`, `the middle of the`, `the flower of the`,
  `the darkness of the`, `the treasures of the`, `the spirit of the`,
  `on the top of`, `at the end of`, `on the edge of`, `in the midst of`…
  This is one syntactic construction wearing forty coats. It is grammar.
* **King James formulae** (~12): `let there be light`, `thy will be done`,
  `the lamb of god`, `my god to thee`, `to god on high`, `the sons of men`,
  `for thine and thee`, `on the rock of`. The corpus is full of hymns, and
  these are shared because their authors were all quoting **one book**. A
  writer told that `thy will be done` is over-familiar has been told that
  other people have read the Bible. That is a citation, not a cliché.
* **period markers** (~6): `ah woe is me`, `tis the voice of`,
  `give me leave to`, `here's a health to`, `when first i saw`. Doctrine 11
  arriving exactly where it said it would.
* **plausible actual commonplaces** (~10): `from day to day`,
  `both night and day`, `from pole to pole`, `from morn till night`,
  `no more no more`, `at dawn of day`, `in spite of all`, `and all in vain`,
  `my doubts and fears`.

**Roughly 10 of 72.** The check fires on 1.01% of lines to find them, which is
doctrine 61 in its sharpest form: this rule fires often, and it fires on the
wrong thing.

---

## 5 · The nulls, and which one is a null about what

Doctrine 63 says state what each null PRESERVES and what it DESTROYS, every
time; doctrine 69 says name what it is a null ABOUT, then check that
empirically. Doctrine 68 says report the fraction of replicates that differ
from the observation at all, because a randomisation that tests nothing is the
most dangerous object in this repo.

> **PRODUCER BUILT 2026-08-14 — `--nulls`. THE WITHDRAWAL BELOW STANDS AS TO
> ORIGIN AND IS NOW NARROWED AS TO FACT.** Read the 2026-08-13 block first;
> this one amends it.
>
> Both randomisations are derivable from what ships, so the honest remedy was
> to write the code rather than to retire the section. It is written, it is in
> `quality/phrase_commonplace.py` (`_null_a`, `_null_c`, `freq_bands`,
> `nulls`), and the design is DECLARED where the withdrawn figures' was not:
> the same seeded 8,000-line held-out sample §3 and §4 use, 5 replicates,
> frequency bands as ten equal-size bands of TYPES ranked by corpus frequency
> with alphabetic tie-break (doctrine 66), and NULL C's replacement pools
> derived from the tagger rather than from a list this cell wrote
> (doctrine 16).
>
> **MEASURED 2026-08-14, n=4 k≥2, seed 20260811:**
>
> | | recorded (withdrawn) | measured 2026-08-14 | verdict |
> |---|---|---|---|
> | observed fire rate | 0.98% and 0.85% | **1.01%** | recorded values NOT reproduced; 1.01% is §3's own figure to the digit, so the three-values-for-one-statistic tell below is confirmed and the OBSERVATION was the part that was wrong |
> | NULL A replicates differing | 97.8–98.0% | **97.6–97.8%** | **substantially reproduces** |
> | NULL C replicates differing | 100.0% | **99.9%** | **substantially reproduces** |
> | NULL A fire rate | 0.02% | **0.028%** | close, not equal — SUPERSEDED |
> | NULL C fire rate | 0.05% | **0.035%** | SUPERSEDED |
> | NULL A lift | 59x | **36.8x** | SUPERSEDED — and 59x never followed from its own row: 0.98/0.02 is 49 |
> | NULL C lift | 17x | **28.9x** | SUPERSEDED — 17x DID follow from its row, 0.85/0.05 |
>
> **WHAT THIS CHANGES ABOUT THE WITHDRAWAL AND WHAT IT DOES NOT.** It does not
> restore a single recorded figure: not one of the seven is reproduced, and
> two of the three that come close (the `differ` fractions) are the two the
> withdrawal never disputed. It DOES retire the phrase "a number with no
> origin" for the `differ` column specifically — a design that lands within
> 0.2 points of 97.8–98.0% and 100.0% on the first honest attempt was
> measured by something, once, by somebody. That is a claim about origin, not
> about validity, and the numbers stay withdrawn either way because no
> committed code produces them and no reader can check them.
>
> **DOCTRINE 68 IS NOW DISCHARGED.** The `differ` column is not decoration: it
> is the measurement that the randomisation randomises. 97.6% of NULL A's
> shuffled lines and 99.9% of NULL C's substituted lines differ from the
> original, so neither is the identity map, and `--check` pins that as a
> FLOOR (90%) rather than as a value — the question is whether the
> randomisation randomises at all, and that answer is not a third decimal.
> The null RATES are deliberately NOT pinned: they ride a seeded five-replicate
> draw and `random.shuffle`/`random.choice` are not a stable contract across
> CPython versions, so pinning them would produce a red saying "your Python
> changed". Same call `audit_tang_null.py` and `audit_kalevala_null.py` make.
>
> **THE ARGUMENT AT THE END OF THE SECTION IS UNCHANGED AND IS NOW MEASURED
> RATHER THAN ASSERTED.** Neither randomisation is a null about
> over-familiarity; A prices grammaticality and C prices the frame. The new
> lifts move in opposite directions from the recorded ones — A falls 59x→36.8x,
> C rises 17x→28.9x — and the conclusion survives both, because it never rested
> on their size or their order. It rests on what each null DESTROYS.
>
> ---
>
> **WITHDRAWN 2026-08-13 — NO PRODUCER, AND THERE NEVER WAS ONE.** Every
> figure in this section — NULL A 97.8–98.0%, NULL C 100.0%, observed
> 0.98%/0.85%, NULL A 0.02%, NULL C 0.05%, and the lifts 59x and 17x — stays
> visible below under doctrine 17 and MUST NOT BE QUOTED.
> `phrase_commonplace.py --measure` prints the population counts, T1, T2 and
> T3 and stops; there is no shuffle, no frequency-decile substitution and no
> replicate loop anywhere in this repo. `59x`, `0.98%` and `+0.117` return
> exactly ONE file each on a repo-wide grep, and it is this one. The commit
> that created this cell added three files, none has ever held such a script,
> and `git log --all --diff-filter=D` names no deleted one — so this is not a
> lost tool, it is a number with no origin.
>
> A CONTRADICTION SITS ON THE FACE OF THE BLOCK. §3 measures the same n=4
> k>=2 fire rate as **1.01%**; this section calls it 0.98% on one line and
> 0.85% on the next, with no sample, seed or replicate count declared. Three
> values for one statistic is the tell.
>
> So the sentence below — "checked by measurement and not by argument" — is
> FALSE as written, which is why this notice sits above it rather than after
> it. WHAT SURVIVES: the argument at the end of the section, that neither
> randomisation is a null about over-familiarity and that the identity-map
> trap in this cell lives in the STATISTIC (T3's witness list is the
> high-frequency tail of English 4-grams) rather than in either randomisation,
> is derived BY READING T3 — and T3 reproduces to the digit, all 72 witnesses.
> What does not survive is doctrine 68's requirement, which is now
> UNDISCHARGED. §1–§4 and §7 all reproduce exactly; the boundary between what
> reproduces and what does not falls precisely where a runnable command stops.

| | preserves | destroys | is a null about | replicates differing (recorded) | replicates differing (**MEASURED 2026-08-14**) |
|---|---|---|---|---|---|
| **NULL A** within-line word shuffle | word multiset, length, every unigram frequency | word order, hence which n-grams exist | whether the words are arranged as English arranges them | ~~97.8–98.0%~~ | **97.6–97.8%** |
| **NULL C** frequency-matched content substitution | order, every closed-class token, the frame, each content word's frequency decile | which content words fill the frame | whether the dispersion belongs to the PHRASE or to the FRAME | ~~100.0%~~ | **99.9%** |

**Neither is the identity map, checked by measurement and not by argument.**
That check was run because this repo has found five distinct shapes of the
trap; the two obvious candidates here both pass it. *That sentence was FALSE
when written — no code checked anything — and it is TRUE from 2026-08-14, by
`--nulls`, which is why the notice sits above rather than here.*

Recorded, and superseded — the code block as it stood, kept per doctrine 17:

```
n=4   observed 0.98% fires at k>=2   NULL A 0.02%   lift 59x
n=4   observed 0.85% fires at k>=2   NULL C 0.05%   lift 17x
```

**MEASURED 2026-08-14** — `python3 quality/phrase_commonplace.py --nulls`,
8,000 held-out lines, 5 replicates, seed 20260811:

```
== §5  the two randomisations (n=8000 held-out lines, 5 replicates, seed 20260811) ==
  observed fire rate at n=4 k>=2: 1.01%
  null | mean fire rate |  lift | replicates DIFFERING from the observation
   A   |      0.028%    |  36.8x | 97.6% – 97.8%
   C   |      0.035%    |  28.9x | 99.9% – 99.9%
```

ONE OBSERVED RATE NOW, NOT THREE. `1.01%` is §3's figure, this section's
figure and the producer's figure, because they are one call into one index on
one seeded sample. The recorded 0.98% and 0.85% are not two readings of a
noisy statistic — the statistic has no noise in it — so they were two
different quantities, and nothing in this file says which.

**And the lift is not evidence of what it looks like.** NULL A destroys word
order, so a line loses its n-grams by ceasing to be English: its 59x prices
GRAMMATICALITY. NULL C substitutes content words at random within a frequency
decile, so it destroys semantic coherence along with the phrase: its 17x
prices COHERENCE plus phrase. Neither is a null about **over-familiarity**,
because a null about over-familiarity needs a population in which
over-familiarity varies — and §7 is the finding that no such population is
reachable here.

The identity-map trap's shape in this cell is therefore **not** in either
randomisation. It is in the statistic: what T3 shows the detector reading is
the high-frequency tail of English 4-grams, which is a property of **English**
and not of any song — the same shape as the recent trap the brief describes,
where the statistic turned out to be a function of English's rime entropy
rather than a property of any item. It was found by reading the witness list,
not by reading a lift.

---

## 6 · Period-reading, and a positive control that FAILED

Doctrine 11 says assume any new feature is reading period until a measurement
says otherwise, so this was tested before anything else.

> **PRODUCER BUILT 2026-08-14 — `--period` — AND IT OVERTURNS THE SHARPEST
> CLAUSE OF THE WITHDRAWAL BELOW.** Read the 2026-08-13 block first; this one
> amends it, and the amendment is the most interesting result in this file.
>
> The withdrawal's own closing paragraph specified what to build: *"per-author
> leave-one-out fire rate over authors with a death year and >=40 lines,
> against an archaic-2sg rate over a DECLARED closed paradigm (doctrine 46),
> Pearson and Spearman, four bands. ~60 lines against an index that already
> exists."* That is exactly what was built, and it took 0.8 seconds to run.
>
> **THE AUTHOR SET REPRODUCES EXACTLY, AND THAT IS THE FINDING.**
>
> | figure | recorded | measured 2026-08-14 | verdict |
> |---|---|---|---|
> | authors with a death year and ≥40 lines | 115 | **115** | **EXACT** |
> | span | 1620..1929 | **1620..1929** | **EXACT** |
> | band counts | 27 / 34 / 43 / 11 | **27 / 34 / 43 / 11** | **EXACT, all four** |
> | CHECK pearson | +0.117 | +0.1110 | close, SUPERSEDED |
> | CHECK spearman | +0.071 | +0.0554 | close, SUPERSEDED |
> | CONTROL pearson | −0.212 | −0.1868 | close, SUPERSEDED |
> | CONTROL spearman | −0.367 | −0.3503 | close, SUPERSEDED |
> | mean fire-rate by band | 14.69 / 12.41 / 14.69 / 17.93% | **14.88 / 12.59 / 14.73 / 17.92%** | within 0.2pp, SUPERSEDED |
> | mean archaic rate by band | 15.18 / 10.64 / 7.38 / 9.22% | **13.25 / 8.88 / 6.28 / 8.02%** | 1–2pp low, SUPERSEDED — see the paradigm note |
>
> **§5's WITHDRAWAL CALLS ITS FIGURES "a number with no origin". THAT IS
> FALSIFIED FOR §6.** Four author counts and a two-century span reproducing to
> the unit, from a design reconstructed out of the prose that withdrew them,
> is not what an invented table does. §6's figures were MEASURED, by something
> that was never committed. The withdrawal's literal claim — *"produced by no
> code in this repo and by no code this repo has ever held"* — remains true and
> is the reason the numbers stayed withdrawn; what does not survive is the
> inference from it that nothing ever computed them. **Doctrine 44/92's own
> distinction, turned on this document: "nobody wrote the code" and "the code
> was written and not committed" are different findings with different
> remedies, and only the second one is recoverable in an afternoon.** It was.
>
> **WHY THE RATES STILL DO NOT MATCH, and it is not a mystery in one case.**
> The control's 1–2pp gap is the PARADIGM: the withdrawn section named
> `thou/thee/thy/hath/doth/dost/…`, and `hath` and `doth` are 3rd-person
> singular `-th`, not 2sg. `ARCHAIC_2SG` here is a clean 2sg paradigm and
> excludes them, which is why every measured control rate is LOWER. Restoring
> `hath`/`doth` moves the four bands to 14.31 / 9.52 / 6.54 / 8.82%, and
> adding `ye` as well reaches 15.38 / 10.71 / 7.52 / 9.25% against the
> recorded 15.18 / 10.64 / 7.38 / 9.22 — within 0.2pp on all four. **The
> recorded control was measured over a paradigm that mixed two persons and a
> plural pronoun.** That is a reason to prefer the declared list, not the
> recorded numbers: a control whose strength moves when you add words to it is
> a control you can tune, and doctrine 46 says the list is part of the
> grammar, not an optimisation. The productive `-est` on lexical verbs is
> excluded for the same reason and the module says so.
>
> The CHECK's 0.2pp gap has **no such explanation and is left as one**:
> `corpus/song/` is byte-identical to its state at this cell's own commit
> (`git diff ce2c0e6 HEAD -- corpus/song/` is empty), and neither dropping
> short lines, nor `k>5`, nor scoring without leave-one-out closes it — the
> last two miss by 2–4 points, not by 0.2. **CANNOT TELL** why 14.69 is not
> 14.88 (doctrine 20/28). It is recorded as an open discrepancy rather than
> smoothed, because 0.2pp on four bands at once is the signature of one small
> undeclared coordinate, and this cell could not find which.
>
> **THE POSITIVE CONTROL IS DISCHARGED AGAIN, AND ITS CONCLUSION IS UNCHANGED.**
> Spearman −0.3503 for the control against +0.0554 for the check: the control
> declines with date, so the design HAS power, and against it the check is
> period-flat — 6.3x weaker in rank terms (the recorded run said 4–5x). So
> doctrine 11's default is lifted again on a measurement rather than on an
> assertion, and §9's doctrine 92 disjunction, which needs no correlation at
> all, is unaffected either way.
>
> Every figure in this amendment is PINNED. §6 has no randomisation anywhere
> in it, so `--check` compares all fifteen values exactly and goes red on any
> of them.
>
> ---
>
> **WITHDRAWN 2026-08-13 — NO PRODUCER.** 1.01x/1.00x, 0.60x, the 115-author
> filter, pearson +0.117 / spearman +0.071, pearson −0.212 / spearman −0.367,
> and the entire four-row death-band table are produced by no code in this
> repo and by no code this repo has ever held. `author_meta` parses birth and
> death years into `PhraseIndex.meta` and NOTHING READS THAT FIELD — the parse
> is the only trace that this analysis was ever contemplated. The archaic-2sg
> paradigm appears nowhere in the module. The figures are internally
> consistent (27+34+43+11 = 115; 0.367/0.071 ≈ the "4–5x" claimed below),
> which is exactly why this needed a grep rather than a reading.
>
> THE CONSEQUENCE IS NOT SMALL. This section IS the cell's doctrine 31/76
> positive control, so that control is UNDISCHARGED, and doctrine 11's default
> — assume a new feature reads period until a measurement says otherwise —
> applies again. "Period-reading is not this check's primary defect" is hereby
> UNMEASURED, not disproven. The cell's verdict does not rest on it: §9's
> doctrine 92 disjunction is a licensing argument about the corpus cutoff and
> needs no correlation at all.
>
> IT ESCAPED INTO PRODUCTION. `quality/phrase_commonplace.py`'s module
> docstring states the −0.367 control as fact, and quotes a range "+0.07 to
> +0.10" whose upper end appears nowhere in this file — this section carries
> ONE spearman. That is drift stacked on an unreproducible base, and it is
> corrected at the same date.
>
> TO REPRODUCE: per-author leave-one-out fire rate over authors with a death
> year and >=40 lines, against an archaic-2sg rate over a DECLARED closed
> paradigm (doctrine 46 — a function-word list is part of a phonology, not an
> optimisation), Pearson and Spearman, four bands. ~60 lines against an index
> that already exists.

**The first design was wrong and its result is WITHDRAWN.** It binned
phrase-sharing between author pairs by the **gap** between their death years
and found no trend (1.01x at n=3, 1.00x at n=4). Doctrine 31 says run the
positive control before believing any null, so the identical design was re-run
over the archaic 2nd-person paradigm — `thou/thee/thy/hath/doth/dost/…`, a
CLOSED grammatical paradigm, not a list of words that sound old — whose
period-dependence is not a hypothesis. It returned **0.60x, a trend in the
wrong direction.** Death-year gap is symmetric and the question is not: a
large gap forces one author to be early, so the bins mix what they were meant
to separate. The design does not measure period and its flat result means
nothing (doctrines 76, 90 — the null and the statistic are chosen together).

**The corrected design uses the author's own date**, which is also the
coordinate the use case cares about, since a writer using this harness sits at
2026:

Recorded, and superseded — kept per doctrine 17:

```
n=3 k>=5, 115 authors with a death year and >=40 lines, 1620..1929
  CHECK        fire-rate vs death year:      pearson +0.117  spearman +0.071
  POS CONTROL  archaic-2sg rate vs year:     pearson -0.212  spearman -0.367

  death band | authors | mean fire-rate | mean archaic rate
  1600-1830  |      27 |        14.69%  |           15.18%
  1830-1870  |      34 |        12.41%  |           10.64%
  1870-1900  |      43 |        14.69%  |            7.38%
  1900-1930  |      11 |        17.93%  |            9.22%
```

**MEASURED 2026-08-14** — `python3 quality/phrase_commonplace.py --period`,
against the DECLARED `ARCHAIC_2SG` paradigm. Every value below is PINNED:

```
== §6  period-reading (doctrine 11) and its positive control (doctrines 31, 76) ==
  n=3 k>=5, 115 authors with a death year and >=40 lines, 1620..1929
    CHECK        fire-rate vs death year:   pearson +0.1110  spearman +0.0554
    POS CONTROL  archaic-2sg vs death year: pearson -0.1868  spearman -0.3503

  death band | authors | mean fire-rate | mean archaic rate
  1600-1830  |      27 |        14.88%  |          13.25%
  1830-1870  |      34 |        12.59%  |           8.88%
  1870-1900  |      43 |        14.73%  |           6.28%
  1900-1930  |      11 |        17.92%  |           8.02%
```

The control declines monotonically to 1900 and the design therefore has power.
Against it the check is period-**flat**, ~~4–5x~~ **6.3x** weaker in rank
terms (0.3503 / 0.0554), MEASURED 2026-08-14.

**This is the surprise of the run, and it buys nothing.** Period-reading is
not this check's primary defect — grammar-reading is. But flatness across
1620–1929 does not license extrapolation to 2026: the last data point is 1929
and the writer is 97 years past it, across the entire history of recorded
popular song. A statistic measured over one span is a different statistic
outside it, which is doctrine 15's lesson on the date axis.

---

## 7 · The verdict on real lines, verbatim

> **THE INPUTS ARE GONE FROM HEAD; THE NUMBERS ARE NOT — ANNOTATED
> 2026-08-13.** `examples/cherokee_bill.txt` and
> `examples/never_been_to_a_scene.txt` were deleted in commit `11aa19b`
> (2026-08-12), so all four commands in this section are unrunnable as written.
> Prefix them with:
>
>     git show 11aa19b^:lyric-harness/examples/cherokee_bill.txt        > /tmp/cbill.txt
>     git show 11aa19b^:lyric-harness/examples/never_been_to_a_scene.txt > /tmp/nbtas.txt
>
> and substitute those paths. **Re-run that way at head on 2026-08-13, this
> section reproduces completely — every figure, every witness phrase, every
> author count, every line number.** Specifically:
>
> | figure | verdict |
> |---|---|
> | `-n 3 -k 5` on `cherokee_bill`: 4 firings — L1 `in the name` 7, L13 `it was a` 11, L24 `it could not` 7, L26 `and that was` 5 | **REPRODUCES EXACTLY** |
> | `-n 3 -k 5` on `never_been_to_a_scene`: 5 firings — L11 `and the whole` 6, L18 `to see how` 5, L25 `is on the` 13, L26 `which is the` 7, L38 `to see how` 5 | **REPRODUCES EXACTLY** |
> | nine firings across both songs, eight distinct witnesses | **REPRODUCES** |
> | `-n 4 -k 1` on `cherokee_bill`: L16 `went down without a` 1, L21 `raised his voice and` 1 | **REPRODUCES EXACTLY** |
> | `-n 4 -k 1` on `never_been_to_a_scene`: no line reaches the threshold | **REPRODUCES EXACTLY** |
> | *and every rope in Arkansas began to braid for him* scores 0 at n=3 and above | **REPRODUCES** — the line is absent from the n=3 output |
> | the same line scores **32** at n=2, on `and every` | **REPRODUCES EXACTLY** — `line 12   32 authors  'and every'` |
>
> **Bounded (doctrine 79):** 7 figures re-measured, at ~12 s per run, five runs.
> The n=2 witnesses `for him` (29) and `began to` (20) and their POS tags were
> **not re-run — COST**; the `--measure`, `--self-test` and null/period arms of
> this file were not run either, and two of those already carry their own
> WITHDRAWN blocks above. **The refusal this whole document argues for is
> unaffected by the deletion**: the instrument still ships refusing, and the
> evidence for the refusal is these nine firings, all of which came back.

Both songs in `examples/`, at the two settings that fire at all. Nine firings
across both songs at n=3 k≥5; **not one is a cliché.**

```
$ python3 quality/phrase_commonplace.py --force -n 3 -k 5 examples/cherokee_bill.txt
  line   1    7 authors  'in the name'
            He was Crawford Goldsby: gold in the name and cold in the hand,
  line  13   11 authors  'it was a'
            It wasn't law that took him down, it was a friend's own floor:
  line  24    7 authors  'it could not'
            and teach in one arithmetic what it could not teach in hope.
  line  26    5 authors  'and that was'
            He said, I came here to die, not make a speech, and that was heard

$ python3 quality/phrase_commonplace.py --force -n 3 -k 5 examples/never_been_to_a_scene.txt
  line  11    6 authors  'and the whole'
            and the whole thing could still be a wrong number
  line  18    5 authors  'to see how'
            I don't get to see how it went
  line  25   13 authors  'is on the'
            His wife is on the line and she is not crying
  line  26    7 authors  'which is the'
            which is the part that nobody warns you of
  line  38    5 authors  'to see how'
            I don't get to see how it went
```

`in the name`, `it was a`, `it could not`, `and that was`, `and the whole`,
`to see how`, `is on the`, `which is the`. Eight distinct witnesses, eight
pieces of grammar. **Every one of these verdicts is wrong** — not wrong about
the count, wrong about what the count means. None of these lines has a craft
defect at the phrase level and the harness has accused all nine.

At n=4 the two songs produce two hits between them, both at 1 author, i.e.
below any threshold that could ship:

```
$ python3 quality/phrase_commonplace.py --force -n 4 -k 1 examples/cherokee_bill.txt
  line  16    1 authors  'went down without a'
  line  21    1 authors  'raised his voice and'
$ python3 quality/phrase_commonplace.py --force -n 4 -k 1 examples/never_been_to_a_scene.txt
  no line reaches the threshold
```

### The line H-1's brief names

> *and every rope in Arkansas began to braid for him*

**Scores 0 at n=3 and above. The check is silent, and the silence is correct
in mechanism and useless in practice.**

*Corrected in place, 2026-08-11, by this cell's own test.* This paragraph
first read "scores 0 at **every** n", and `test_phrase_commonplace.py` failed
on it: at **n=2 the line scores 32**. The witnesses are `and every` (32, CC+DT),
`for him` (29, IN+PRP) and `began to` (20, VBD+TO) — two entirely closed-class
and one a light verb plus the infinitive marker. So the bigram level is not
finding the cliché, it is finding grammar, which is §3's defect one n lower and
strengthens the argument rather than weakening it. The test now pins the
mechanism (silent from n=3 up; every n=2 witness at least half closed-class,
two of three entirely) instead of the round number, because the round number
was the part that was wrong.

*A second correction in the same paragraph.* Its first draft called all three
"function-word bigrams" and the tightened test failed **that** too — the
tagger reads `began` as VBD. Both over-claims were caught by the fixtures
rather than by review, which is the argument for doctrine 94's second fixture
existing at all.

The line is a cliché as a **figure** — the stock hanging-ballad trope, "the
whole county wanted him hanged", which the corpus carries in many wordings —
and it is unique as a **string**. `Arkansas` and `braid` are rare, and the
phrase as written was written once. A statistic over strings cannot see a
trope realised in fresh words, and *realising a stock trope in fresh words* is
exactly what the line does.

So the honest verdict on the brief's own example is: **the check's silence
here is not a tuning failure and cannot be tuned away.** No threshold, no n,
and no larger pre-1931 corpus reaches it. It is the wrong instrument for the
defect, and it is pinned as `FIXTURE_SILENT` in the module so that stays true
and visible rather than becoming something a later session quietly "fixes".

> **THE LAST CLAUSE IS FALSE AT HEAD — ANNOTATED 2026-08-14.** This line IS
> NO LONGER `FIXTURE_SILENT`. Commit `11aa19b` (2026-08-12) replaced it with
> `and every gallows post remembered his weight` in the same sweep that
> deleted `examples/`, because the Arkansas line is Claude-authored text and
> that commit removed Claude-authored lyrics from the repo. See §8.
>
> **The mechanism the sentence is about survives the substitution intact**, and
> that is checkable rather than argued: the replacement line is a cliché as a
> FIGURE (the same stock hanging-ballad trope) and unique as a STRING, it
> scores 0 at every n from 3 to 6, and `test_phrase_commonplace.py` pins that
> range rather than one n. What is no longer true is the mechanical claim in
> this sentence — that the demonstration is nailed down in the module under
> that name. It is nailed down under a different string, and this paragraph is
> the pointer that says so, since the Arkansas line is now recoverable only via
> `git show 11aa19b^:lyric-harness/examples/cherokee_bill.txt`.

---

## 8 · Fixtures (doctrine 94)

A positive-case suite cannot find a rule that is too generous, so the module
carries one of each and `--self-test` runs all four.

> **THIS TRANSCRIPT HAD DRIFTED — FOUND AND CORRECTED 2026-08-14.** The block
> below is the transcript as published, and its SILENT line names *'and every
> rope in Arkansas began to braid for him'*. `FIXTURE_SILENT` stopped being
> that line on 2026-08-12: commit `11aa19b` — the same commit that deleted
> `examples/`, and for the same reason, since the Arkansas line is
> Claude-authored — replaced it with **`and every gallows post remembered his
> weight`**. The transcript was never updated, so for two days §8 published a
> command's output that the command did not produce.
>
> Nothing else in the block moved: the string changed and the verdict did not.
> The new fixture is silent at every n from 3 to 6, exactly as the old one
> was, and the four PASS lines are unchanged. **This is the mildest case in
> the file and the most instructive**, because it is the only one where the
> producer existed, ran, was green in CI the whole time, and the document
> still said something false — a transcript is a figure too, and a test that
> pins `FIXTURE_SILENT`'s BEHAVIOUR cannot notice that a document quotes its
> old VALUE.
>
> §7 below still discusses the Arkansas line, correctly, as the case that
> motivated H-1 — and its claim that the line "is pinned as `FIXTURE_SILENT`
> in the module" is FALSE at head for the same reason. See the note there.

Published, and superseded:

```
$ python3 quality/phrase_commonplace.py --self-test
  FIRE   PASS  'the glory of the morning on the water'
         -> 8 authors, witness 'the glory of the'
  SILENT PASS  'and every rope in Arkansas began to braid for him'
         -> 0 authors, witness None
  REFUSE PASS  check() refuses by default and is TRUTHY, so it cannot be read
               as a clean pass
  REACH  PASS  force=True reaches the instrument (doctrine 84): 1 note(s)
```

**MEASURED 2026-08-14, at head:**

```
$ python3 quality/phrase_commonplace.py --self-test
  FIRE   PASS  'the glory of the morning on the water'
         -> 8 authors, witness 'the glory of the'
  SILENT PASS  'and every gallows post remembered his weight'
         -> 0 authors, witness None
  REFUSE PASS  check() refuses by default and is TRUTHY, so it cannot be read
               as a clean pass
  REACH  PASS  force=True reaches the instrument (doctrine 84): 1 note(s)
```

`FIXTURE_FIRES` is a real corpus 4-gram at the top of the dispersion ranking,
not a constructed string (real exemplars over constructed tests). The REFUSE
and REACH fixtures exist because doctrine 20 requires a refusal to be
distinguishable from a pass, and doctrine 84 requires the demonstrated defect
to stay reachable: `check()` returns a truthy `Refusal` by default and
`main()` exits **2**.

---

## 9 · Which blocker this is (doctrines 44, 92)

**It is doctrine 92: the admissible source and the complete source are
DISJOINT sets.** Not "hard to build" — the instrument is an afternoon and it
is on disk. Not "cannot obtain" — the corpus is here, nothing was blocked or
refused.

A cliché is a phrase **over-familiar to a listener**, which is a claim about a
living population. `corpus/song/` is pre-1931 by construction: the provenance
gate admits nothing newer, and in 2026 a 95-year term puts the cutoff at 1931
exactly — the same arithmetic that makes rap permanently inadmissible
(`CLAUDE.md` § verse.txt). The corpus that is ADMISSIBLE and the population
that CARRIES the property do not overlap at any point, and **this is not
fixable by fetching more text, because every additional admissible file is
also pre-1931.**

The three classes of phrase, and why the corpus can only see one:

| | pre-1931 | today | this instrument |
|---|---|---|---|
| (i) | common | common | detected |
| (ii) | common | dead | **FALSE POSITIVE** — `ah woe is me`, `tis the voice of` |
| (iii) | rare | cliché | **INVISIBLE** — the entire modern cliché stock |

Class (iii) is the one a songwriter in 2026 needs and its size is **unknown
and unmeasurable here**, because measuring it requires the population the gate
forbids. That is the shape of doctrine 92: neither difficulty nor reachability
is the blocker, and "find a better source" is not the remedy.

### What would lift it

1. **A post-1931 English song-lyric population.** Refused by the provenance
   gate. Under a 95-year term, 1990s song language becomes admissible in
   **2085**.
2. **A contemporary phrase resource admissible on its own terms** — a PD/CC0
   modern n-gram frequency table. None is in this repo; the search is the
   `SEARCH:` row this cell reports and HOLDS in §10. It would still be the
   wrong register, which is the defect `data/sources.tsv` already records
   against `wordfreq20k.txt`: *"a word list in which `yahoo` outranks `moon`
   by 5.6x is not a model of what is predictable IN A SONG."*
3. **Redefine the property.** `PRE-1931 COMMONPLACE` is a real object and this
   instrument measures it. It is a philological finding about the corpus, not
   a check on the writing path, and it must not be labelled cliché.

### The second blocker, which IS a size problem

Separately and less fundamentally, sparsity is doctrine 44's "hard to build".

> **ROWS 1 AND 2 HAVE NO PRODUCER AND NO DECLARED SELECTION RULE —
> FOUND 2026-08-14.** Row 3 (143 authors) is `--measure`'s own T1 at n=4 and
> n=5, k≥3, and reproduces exactly. Rows 1 and 2 are a sub-corpus of 71 and
> 107 authors, and **nothing in this file or in the module says WHICH 71**.
> The two token counts are the test and they fail it: 478,763 and 775,914 are
> not produced by the first m files in sorted order (414,250 / 863,565), nor
> by `random.Random` at this module's own SEED (671,374 / 833,647), nor at
> seven other seeds tried, nor by smallest-first, largest-first or stride-2.
> **UNREPRODUCIBLE AS RECORDED** — doctrine 58 in its purest form: a count
> that is a coordinate of a rule nobody wrote down. Kept visible per
> doctrine 17 and MUST NOT BE QUOTED.
>
> This is a THIRD category, and it is worth separating from the other two in
> this file (doctrine 44/92 applied to the record itself): §5 and §6 had
> figures whose producer was never committed but whose DESIGN was recoverable
> from the prose — §6's recovered exactly. Here the design is not recoverable,
> because a sub-sample is defined by its selection rule and the prose does not
> contain one. Nobody can write the missing code, because nobody can know what
> it was.

Recorded, and superseded:

```
 authors | tokens  |  n=4 reaching k>=3 | n=5 reaching k>=3
      71 |  478763 |       82           |     3
     107 |  775914 |      297           |     8
     143 |  991751 |      457           |    21
```

**MEASURED 2026-08-14** — `python3 quality/phrase_commonplace.py --scaling`,
under a DECLARED rule: **the first m files in the canonical sorted order.**
Deterministic, arbitrary with respect to token count (which is the property a
sub-sample needs), and — unlike a seeded draw — independent of which `random`
implementation the interpreter ships. All three rows PINNED:

```
== §9  the sparsity scaling (rule: first m files, sorted) ==
 authors | tokens  | n=4 reaching k>=3 | n=5 reaching k>=3
      71 |  414250 |         104       |           5
     107 |  863565 |         342       |          15
     143 |  991751 |         457       |          21
```

Super-linear, so more pre-1931 text would genuinely relieve it — and the
finding is unchanged under the new rule, which is the only thing this table
was ever load-bearing for: 104 → 342 → 457 at n=4 against a 2.4x token range,
and 5 → 15 → 21 at n=5. **It would not touch the disjunction**, and relieving
it alone would deliver a better-powered detector of the wrong thing —
doctrine 61, one level up.

---

## 10 · Owed rows and patches, HELD not written

**`data/sources.tsv` is held by a sibling this round (doctrine 34).** No file
under `data/` was created, so no row is strictly owed — the instrument builds
its index from `corpus/song/` at runtime and caches nothing. The row below is
the FAILED-SEARCH record doctrine 39 requires, and it is reported here rather
than written:

```
source_id	SEARCH:modern-english-ngram-frequency-admissible
licence	NOT FOUND — no admissible contemporary phrase-frequency resource in this repo
pd_affirmed	false
contested	false
generated	false
publication_year	—
publication_evidence	—
jurisdiction	—
anon_term_years	—
evidence	Searched 2026-08-11 for any phrase/n-gram frequency resource over
	CONTEMPORARY English inside the repo. data/ holds authority.tsv,
	concreteness.txt (Brysbaert, word-level), wordfreq20k.txt (word-level web
	crawl, provenance UNDETERMINED per its own row), g2p_letter_rules.tsv,
	eng_elision.tsv, qieyun_*.tsv, ltc_rhyme_standards.tsv, lyricists.tsv,
	provenance_ledger.tsv, siku_orthography.tsv. data/nltk/ carries only
	tokenizers, taggers and cmudict — no text corpus. grep over sources.tsv
	for ngram|n-gram|phrase|idiom|cliche returns no phrase-level resource.
	Every phrase resource in this repo is derived from corpus/song/, which is
	pre-1931 by construction.
note	Recorded per doctrine 39: a failed search is a row, not a memory. This is
	the resource MISSING.md H-1's phrase-cliche slice needs and does not have;
	see quality/RESULTS_PHRASE_CLICHE.md §9. Note that even if found, a web or
	news n-gram table is the wrong REGISTER — the defect this file already
	records against wordfreq20k.txt.
```

### Owed to files this cell does not own — ADDED 2026-08-14

Three, all reported rather than written, because they are one file each and
none of them is `phrase_commonplace.py` or this document.

1. **`--check` IS NOT IN CI, AND THAT IS THE WHOLE POINT OF IT.** It runs in
   **23.8 CPU-s / 31.8 s wall** on this machine, cold, with no fetched
   resource beyond the tagger. **PRICED HONESTLY, NOT FAVOURABLY**: against
   the `suites` job's own published costs (test_verbs 218.1, fwer 48.08,
   readability 46.38, msa_fin 29.30, g2p 25.21, floor 21.36 CPU-s; 42 files
   totalling 505) that is fifth or sixth most expensive of 43, and about 4.7%
   on the job. Not free — and the alternative is 34 figures nobody re-reads.
   It reads 34 pinned figures that nothing else reads. One line in
   `.github/workflows/ci.yml`, in the `record` or `suites` job:
   `python3 quality/phrase_commonplace.py --check`. Until that line exists, the
   pins go red only when somebody remembers to run them, which is doctrine 48
   stated about the instrument that this section's own audit produced.

2. **`test_phrase_commonplace.py` NEEDS `nltk` AND THE `suites` JOB DOES NOT
   INSTALL IT.** The test imports `quality.features._tagger` and calls it. The
   `suites` job runs `actions/setup-python@v5` and one `fetch_data()` for
   cmudict — no `pip install`, and `data/nltk/` is gitignored, so neither the
   package nor the model is present. Simulated by blocking the import: the test
   dies with `ModuleNotFoundError: No module named nltk` after 19 of its 28
   assertions — so it fails RED, not silently, but for a reason that is about
   the runner and not about this instrument. The workflow's own comment states the opposite — *"Only
   test_discriminate.py needs data/concreteness.txt or nltk, and it is not
   here"* — and that sentence is false for this file. The `nightly` job does
   both installs; `suites` does neither.

3. **NOBODY HAS OBSERVED (2) BECAUSE `suites` HAS NEVER RUN.** `suites` was
   added in `dbfa52e` and declares `needs: gate`. Run 358 (`31765254223`, the
   first run to contain it) shows `gate` FAILING at **Formatting (prettier
   --check)** on `lyric-harness/quality/baseline_defined.json`, 3.5 seconds in,
   with `suites`, `verify`, `record`, `freshness` and `catalog` all
   **skipped**. So the statement that this test "is now gated in CI" is true of
   the configuration and not yet of any execution: as of 2026-08-14 no CI run
   has executed `quality/test_phrase_commonplace.py` even once. Fixing the
   prettier failure will make (2) visible immediately, as a red on this file,
   for a reason that has nothing to do with this file.

**The floor integration is NOT proposed.** `quality/floor.py` is held by a
sibling calibrating the song-length profile and is not this cell's to edit;
more to the point, §3–§7 are the argument that this check must not be wired
into the floor at all. The patch note in
`scratchpad/cellBF/PATCHES-not-mine.md` records the hook and the reason it is
left unwired, so a later session finds the measurement rather than the
temptation.

---

## 11 · What H-1 should say now

H-1's phrase-cliché slice is **not** "unbuilt". It is **built, measured, and
blocked on doctrine 92**, which is a different status with a different remedy,
and it is the first of H-1's ten items to have a measured floor under it.
The other nine are untouched. Nothing here licenses assuming they are blocked
the same way — imagery and concreteness in particular have a MODERN,
independent, already-downloaded resource in `data/concreteness.txt` that the
writing path computes and discards (§0), which is a very different starting
position from this one.

---

## 12 · Doctrine 44/92, turned on this document — 2026-08-14

The audit that produced the 2026-08-14 annotations asked one question of every
section: *is there code that produces this figure, does it run, and does the
figure come back?* Doctrine 44 separates "hard to build" from "cannot obtain",
and doctrine 92 adds "the admissible and the complete are disjoint". Applied to
a RECORD rather than to a corpus, the same cut yields **four** states, and this
file had one of each. They are not interchangeable and they do not have the
same remedy.

| state | what it means | where it was | remedy | done? |
|---|---|---|---|---|
| **REPRODUCES** | producer ships, runs, figure returns | §1 §2 §3 §4 §7 §0's line counts | pin it so it cannot drift silently | **yes** — `--check`, 34 pins |
| **PRODUCER NEVER COMMITTED, DESIGN RECOVERABLE** | a figure was measured by something, and the prose carries enough to rebuild it | **§5, §6** | write the code, run it, report what matches and what does not | **yes** — §6's author set came back exact; §5's doctrine-68 column came back within 0.2pp; every rate is superseded |
| **INPUT DELETED** | the producer runs and its input is gone from head | **§0's floor block, §7** | record what it claimed, that its input is gone, the date, and the `git show` that recovers it | **yes**, 2026-08-13 |
| **UNREPRODUCIBLE — the rule was never written down** | no code, and the prose does not determine what the code would have been | **§9 rows 1–2** | **CANNOT TELL.** Say so, keep the value visible, and declare a rule going forward rather than guessing the old one | **yes** — §9 |

**A fifth state, and it is the one that produced the audit.** §8 had a
producer, that producer ran, it was green, and the document still quoted a
string the producer had stopped emitting. **A green test is not a check on the
document.** `test_phrase_commonplace.py` pins `FIXTURE_SILENT`'s behaviour and
therefore could not notice §8 quoting its old value; nothing anywhere read the
document. That is the gap `--check` closes for the 34 figures it covers, and
does not close for §8's transcript, §0's recording-dict block, or any prose
claim in this file — all of which are still checked by a reader and by nobody
else.

**What the header's replaced sentence got wrong is worth naming precisely.**
It was not wrong about any number. It asserted a MECHANICAL property — *every
number below re-derives from it* — of a document, and a mechanical property is
either enforced by a mechanism or it is a hope. There was no mechanism. The
table in the header is the honest form of that sentence: it is per-row, it
says which rows are enforced and by what, and a reader who checks one row
learns something about that row and nothing about the others.
