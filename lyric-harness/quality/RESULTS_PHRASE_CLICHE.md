# RESULTS — phrase-level cliché, and why it is REFUSED

`MISSING.md` **H-1**, the tenth item on its Missing list: *cliché at the PHRASE
level rather than the rhyme-pair level*. One slice of H-1's programme, taken
on its own; the other nine (imagery, specificity, metaphor, point of view,
tense, narrative movement, the turn, register consistency, showing-vs-telling)
are untouched here on purpose.

**The result is the second of the two H-1's brief allowed: a measured argument
that the available corpus cannot support the check, and exactly what it would
take.** The instrument is built, it runs, it ships REFUSING, and every number
below re-derives from it. Doctrine 84: the demonstration stays reachable, so
this file is checkable rather than quotable.

    python3 quality/phrase_commonplace.py --measure      # T1, T2, T3
    python3 quality/phrase_commonplace.py --self-test    # the four fixtures
    python3 quality/phrase_commonplace.py FILE           # refuses, exit 2

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

**And the floor says nothing at all about either song in `examples/`:**

```
$ python3 -c "...SlopFloor().report(lines)"
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

| | preserves | destroys | is a null about | replicates differing |
|---|---|---|---|---|
| **NULL A** within-line word shuffle | word multiset, length, every unigram frequency | word order, hence which n-grams exist | whether the words are arranged as English arranges them | **97.8–98.0%** |
| **NULL C** frequency-matched content substitution | order, every closed-class token, the frame, each content word's frequency decile | which content words fill the frame | whether the dispersion belongs to the PHRASE or to the FRAME | **100.0%** |

**Neither is the identity map, checked by measurement and not by argument.**
That check was run because this repo has found five distinct shapes of the
trap; the two obvious candidates here both pass it.

```
n=4   observed 0.98% fires at k>=2   NULL A 0.02%   lift 59x
n=4   observed 0.85% fires at k>=2   NULL C 0.05%   lift 17x
```

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

The control declines monotonically to 1900 and the design therefore has power.
Against it the check is period-**flat**, 4–5x weaker in rank terms.

**This is the surprise of the run, and it buys nothing.** Period-reading is
not this check's primary defect — grammar-reading is. But flatness across
1620–1929 does not license extrapolation to 2026: the last data point is 1929
and the writer is 97 years past it, across the entire history of recorded
popular song. A statistic measured over one span is a different statistic
outside it, which is doctrine 15's lesson on the date axis.

---

## 7 · The verdict on real lines, verbatim

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

---

## 8 · Fixtures (doctrine 94)

A positive-case suite cannot find a rule that is too generous, so the module
carries one of each and `--self-test` runs all four:

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

Separately and less fundamentally, sparsity is doctrine 44's "hard to build":

```
 authors | tokens  |  n=4 reaching k>=3 | n=5 reaching k>=3
      71 |  478763 |       82           |     3
     107 |  775914 |      297           |     8
     143 |  991751 |      457           |    21
```

Super-linear, so more pre-1931 text would genuinely relieve it. **It would not
touch the disjunction**, and relieving it alone would deliver a better-powered
detector of the wrong thing — doctrine 61, one level up.

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
