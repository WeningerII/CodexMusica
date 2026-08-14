# Results — adversary 7, span provenance

`python3 quality/audit_spans.py` · regressions in `quality/test_spans.py` ·
measured 2026-08-11 against the shipped `cmudict.dict`, `Declaration()`
defaults (dialect CMUdict General American, `theta_rhyme` 0.75, conjunctive
band on, `fitted` False).

Sweeps 1 and 2 re-measured 2026-08-13 and unmoved. **Sweep 3's four `DISAGREES`
rows were adjudicated 2026-08-13 — §7, which is the first time any of them was
decided rather than reported.** One of the four was the instrument's own error
and `audit_spans.py` is fixed; `PINNED` did not move, because every pinned
figure is sweep 1's.

`BACKLOG.md` §0 lists eight adversaries and marks this one **missing**:
"`best_score` prints a score beside end words that did not produce it". This is
its first instrument and its first measurement.

---

## Headline

**Of the 1,014 sonnet pairs the harness JUDGES, 632 name the two words that
produced their number and 382 do not. Of the 82 violations, 36 do and 46 do
not; 9 of those 46 could not be reconstructed from the printed words even in
principle.**

*632 / 382 / 1014 REPRODUCES BIT-IDENTICALLY, re-measured 2026-08-13 — the
headline of this file is unmoved. The VIOLATION split is REPINNED from
`81 violations, 35 do and 46 do not`: the battery now judges 82 violations
(`CLAUDE.md` Test discipline, repinned the same day from 81), and the 82nd is
true as printed, so 35 -> 36 while the 46 does not move. The `9 of those 46`
still reproduces. This split was missed when the battery figure was repinned
earlier on 2026-08-13 — the note at the head of the table below records the
82 and the sentence above it was left at 81, which is the two-place drift
this file exists to catch, committed inside this file itself.*

*AND IT COULD NOT HAVE GONE RED. Until 2026-08-13 `audit_spans.py`'s `main`
returned a literal `0` whatever the sweep found, so the process exited clean
while printing that 382 of 1014 report lines name a pair that did not produce
their number — and nothing ran it anyway. `--check` now pins the six figures
above and exits 1 on drift, and CI runs it. Doctrine 48: a check that cannot
fail is decoration, and this is the instrument CLAUDE.md calls adversary 7.*

Three counts, always (doctrine 79): **mandated 1064, judged 1014, refused 50**.
The 50 refusals have no spans to be right or wrong about — the harness never
compared them — so they are outside every numerator and every denominator
below.

**No verdict moved.** `violations 81 (8.0% of judged)` before and after; the
whole of this is a change to what the report says about a number, not to the
number. `quality/test_spans.py` test 8 is the pin.

REPINNED 2026-08-13: the battery now prints `violations 82 (8.1% of judged)`.
The BEFORE-AND-AFTER claim is what this section asserts and it is untouched —
this cell moved no verdict then and moves none now. The absolute value moved
later and elsewhere (cell BA's coda-identity fix, `81 -> 82`).

---

## 1 · What was wrong, in one report line

`line_anchors` offers several candidate spans per line — the end word's
dictionary variants, and the last **two** stress positions, which is what makes
mosaic rhyme representable. `best_score` maximises over every pairing of them.
Every consumer then printed the winning number beside `endwords[i]`/
`endwords[j]`.

BEFORE — the project's own canonical bad line, as `BACKLOG.md` and
`quality/RESULTS_REDTEAM.md` both record it:

```
go/receipt 0.579 RHYME
```

AFTER — the same call, `python3 lyric_harness.py scheme ...`:

```
(go/receipt): 0.579  NO_RELATION
        NAMED PAIR IS NOT THE EVIDENCE: left reaches past `go`, right is part of `receipt`
        scored on: get to go  ~  -receipt [last 1 of 2 syllables of 'receipt']   (best of k=6)   MOSAIC (left): the winning span reaches back past the end word
```

The relation moved from `RHYME` to `NO_RELATION` between those two lines for a
reason that has nothing to do with this cell — the conjunctive band shipped in
between. The **0.579 is unchanged**, and it is unchanged because the selection
rule is untouched: first strict maximum wins, exactly as before.

**The mosaic reach is CORRECT behaviour.** `get to go` against `-ceipt` is a
mosaic rhyme and this harness deliberately supports them. Only the report was
wrong, so the fix relabels rather than suppresses — doctrine 24's shape.

---

## 2 · What the fix is, and why a key was not enough

The stated acceptance was "every score carries the two spans that produced it".
Carrying them as a **key** on a plain dict meets the words and not the point: a
key is a flag, and this file's history is a list of flags nobody read.
`check_scheme` copied `s["total"]` into a field called `score` and left the
provenance in a sibling field; the violation tuples carried the bare float;
`battery.py` printed `it / it` twice in its failing-pair table and both were
`enjoys it` ~ `destroys it`.

So the **type** is the marker, in the idiom the repo already uses — `Readings`
is a frozenset whose type says what a list-with-a-flag would have had to
remember, and `FitRefusal.__bool__` RAISES rather than being quietly falsy:

| object | what it is | the hostility |
|---|---|---|
| `Scored` | what `best_score` returns; a `dict` subclass so every existing reader works unchanged | `del s["spans"]`, `s.pop("spans")` and `s["spans"] = <not an Attribution>` all **raise**. `str(s)` renders the number **with** its provenance, so formatting the object cannot print a bare number |
| `Attribution` | the record of which spans won, how big the search was, how many tied | **frozen** after construction. A provenance record that can be edited after the fact is one that can be invented |
| `score()` | one comparison, no search | returns a plain dict — so "this came out of a max over k" is an `isinstance` question, not a remember-to-check-a-key question |

`report_pair(score, word_a, word_b)` is the one sanctioned rendering: it takes
the two words a caller wants to print and **evaluates that claim** in the same
call that renders it.

### The banner is graded and the count is not

`part` alone — the declared anchor cut, `-again` of `again` — is 380 of the
1,014 judged pairs. A `NAMED PAIR IS NOT THE EVIDENCE` banner on every one of
them would train a reader to skip the line that matters, so the banner fires
only for `reach`, `substituted` and `unattributed`, while the anchor cut stays
visible in the span label (`-again [last 1 of 2 syllables of 'again']`).
`spans_claim` still records it as not-claimed and every count here includes it.
Doctrine 91: the count is a coordinate of the RENDERING, and the two are named
separately rather than reconciled by quietly dropping cases.

---

## 3 · The sweep — the sonnet oracle

`python3 quality/audit_spans.py --only battery`

The five-way partition. A span is `exact` when it IS the end word, whole;
`part` when it lies inside it; `reach` when it covers more than it;
`substituted` when the token did not all read; `unattributed` when there is no
provenance to check against.

**All 1,014 judged pairs**, by (left kind, right kind):

| spans | pairs |
|---|---:|
| exact / exact | **632** |
| exact / part | 287 |
| part / part | 83 |
| reach / reach | 6 |
| exact / reach | 3 |
| exact / substituted | 2 |
| part / reach | 1 |
| **total** | **1014** |

**The 81 violations** — the number that decides whether a triage lands on the
right layer:

| spans | violations |
|---|---:|
| exact / exact | **35** |
| exact / part | 30 |
| part / part | 7 |
| reach / reach | 5 |
| exact / reach | 3 |
| part / reach | 1 |
| **total** | **81** |

**35 of 81 violation lines are true as printed. 46 are not. 9 of those 46
involve a reach**, which is the class a reader could not reconstruct from the
printed words even in principle:

| sonnet | lines | printed as | scored on |
|---|---|---|---|
| 1 | L2-L4 | die/memory 0.773 | `never die` ~ `memory` |
| 9 | L10-L12 | it/it 1.0 REPEAT | `-enjoys it` ~ `-destroys it` |
| 14 | L10-L12 | art/convert' 0.674 | `such art` ~ `thou convert'` |
| 26 | L6-L8 | it/it 1.0 REPEAT | `show it` ~ `-bestow it` |
| 33 | L2-L4 | eye/alchemy 0.7 | `sovereign eye` ~ `alchemy` |
| 54 | L5-L7 | dye/wantonly 0.7 | `deep a dye` ~ `-wantonly` |
| 102 | L1-L3 | forth/worth 0.733 | `forth` ~ `more worth` |
| 104 | L10-L12 | words/affords 0.716 | `other words` ~ `scope affords` |
| 150 | L5-L7 | thee/thee 1.0 REPEAT | `-accuse thee` ~ `-misuse thee` |

**A second, independent way the named span is one of several: 121 of the 1,014
judged pairs (6 of the 81 violations) have a TIE at the maximum.** `best_score`
keeps the first and the report now says a twin exists. Doctrine 56's
precondition is also now recorded — `search_k`, the size of the search the
maximum was taken over, without which no null under the same search can be
built.

### `battery.py`'s own failing-pairs table, re-asked

The table the battery prints every run, with the misattribution beside it:

| count | printed pair | misnamed |
|---:|---|---|
| 5x | love / prove | — |
| 3x | one / alone | **3 of 3** |
| 3x | prove / love | — |
| 3x | come / doom | — |
| 2x | it / it | **2 of 2** |
| 2x | is / amiss | **2 of 2** |
| 2x | forth / worth | **1 of 2** |
| 2x | dumb / tomb | — |
| 2x | words / affords | **2 of 2** |
| 2x | care / are | — |
| 1x | die / memory | **1 of 1** |
| 1x | glass / was | — |

`it / it` is the row worth reading twice. Printed as a REPEAT violation on a
pronoun; scored on `enjoys it` against `destroys it`, which is a real mosaic
rhyme. The report named the one word in the line that carries no information.

---

## 4 · Triage — which layer these belong to, and which they were sent to

`CLAUDE.md`'s rule is: triage every failure to a layer — ingestion /
projection / anchor / comparator / band / structure / value.

**No recorded violation count is re-triaged here.** What changes is what a
person triaging them is looking at.

- The **9 reach cases** were, on their printed words, comparator or band
  findings: `forth/worth 0.733 NO_RELATION` reads as "the comparator scores
  two rhyming words below theta". It is not. `forth` was compared against
  `more worth`, a two-syllable span against a one-syllable one, and the
  question is whether the ANCHOR rule should have offered that reach at all —
  an **anchor**-layer question, reached through `line_anchors`'s
  `starts = stressed[-2:]`. Three of them (`it/it`, `thee/thee`) are REPEAT
  verdicts on a function word where the mosaic span is the actual rhyme, which
  is a **projection** question: the letter scheme mandates a pair of LINES and
  the report labels it with a pair of WORDS.
- The **37 part-only cases** stay where they were. The anchor cut is the
  declared rule and the label now shows it.
- The **35 exact cases** are unaffected and are where the recorded
  `love`/`prove` dialect residue lives.

**The instrument does not re-triage anything by itself, and that is deliberate.**
It reports which spans produced each number; whether a reach should have been
offered is a decision about the anchor rule with a held-out price, and it is
not made here.

---

## 5 · The substitution that survives INSIDE a word

`python3 quality/audit_spans.py --only corpus`

Found by the G2P cell on 2026-08-11 and folded in here, because it is
`go/receipt` one level down: a number computed from one string and reported
against another.

`Lexicon.transcribe` splits a token on its hyphens and looks each piece up
separately, so a compound whose pieces do not all read still yields phones —
from the ones that do. `line_anchors` finds an anchor, `line_readability` sets
`final_unreadable = False`, and the span's own provenance recorded the WHOLE
token as the word it covered. `hill-zide` is anchored on `hill`.

**Measured over the 143 `corpus/song/eng_*.txt` files: 328 line ends report
READABLE with an unread piece inside the end token**, on a denominator of
**153,115** countable line ends (`line_tokens`-non-empty, outside the
`#`/`---`/`[` markers) or **190,441** counting every non-blank line. Both are
printed rather than one chosen — doctrine 91, and doctrine 58: cell U's own
denominator was 189,985 under a third line rule, and the numerator moves with
it (293 there, 328 here).

**The split by WHICH piece failed is the triage, and it was not in the original
report:**

| | count | distinct | layer |
|---|---:|---:|---|
| the **LAST** piece is unread, so the anchor is built from an earlier one and the rhyme verdict is on the wrong syllable | **179** | 124 | **anchor** — a wrong answer |
| an **earlier** piece is unread and the last one reads, so the anchor is on the right piece and only the LABEL overstates | **149** | 105 | **report** — this cell's |

Heads of the two distributions: `a-vound` (14), `a-vled` (9), `parley-voo`
(6), `a-zet` (5) — Barnes's Dorset participial `a-` prefix, where the readable
piece is the prefix — against `yonghy-bonghy-b` (27, Lear), `heigh-ho` (8),
`threshing-floor` (2), where the last piece reads and the anchor is right.
Cell U's headline example `yonghy-bonghy-b` is in the second class and its
`hill-zide` is in the first; a single count over both would send them to one
layer, and they need two.

### What was done about it, and what was not

**Named, not refused.** `span_kind` gains a fifth member, `substituted`,
ranked worst because the other kinds name the right string and get its extent
wrong while this one names a different string. The label prints the piece that
was read and the piece that was not:

```
scored on: hill-zide [read as hill: zide not in the lexicon, inside 'hill-zide']
   ~  wife-zide [read as wife: zide not in the lexicon, inside 'wife-zide']
   (best of k=4)   SUBSTITUTED (both sides)
```

Two Dorset words that do rhyme, scored `hill` against `wife` at 0.472, and the
report line now says why.

**Refusing instead is the right fix for the 179 and it is not made here.**
It is an INGESTION change that removes a verdict from 179 song line ends, and
this cell's constraint is that no verdict moves. `line_readability` still says
READABLE. The change and its price are filed as a patch.

### It is in the sonnets too, and they could never have caught it

Three sonnet tokens carry an unread hyphen piece: `swart-complexion'd` (28),
`wilful-slow` (51), `o'er-read` (81). **Two of them stand in a mandated,
judged pair — sonnet 51 `wilful-slow`/`go` and sonnet 81 `o'er-read`/`dead` —
and both score 1.0 RHYME, correctly**, because in both the LAST piece is the
one that reads. The oracle gets the right answer on a label that overstates,
so 152 sonnets were structurally incapable of catching this. That is doctrine
95's shape exactly, and doctrine 95's instruction — when a defect is found in
one layer, grep the others for the same shape — is what produced this section.

`swart-complexion'd` is the third and it is not an end word: sonnet 28 L11 ends
on `night` and the compound is reached by a MOSAIC span, so the substitution
rides inside a span label rather than an end-word label. Two of this cell's
defects compounding.

---

## 6 · The record — every pair this repo quotes beside a number

`python3 quality/audit_spans.py --only record`

A recorded table is a report line that outlived its run, and it is the only
artefact a reader of this project ever sees.

| | 2026-08-11 | 2026-08-13 |
|---|---:|---:|
| markdown files scanned | 34 | 45 → **46** |
| pairs quoted **with** a number (adjudicable) | **20** | **26** |
| pairs quoted with no number (not a claim about a score) | 84 | 147 |
| — reproduces as the pair's total | 12 | 17 |
| — REFUSED, the number is a different quantity | 5 | 6 |
| — DISAGREES with the total | 3 | 3 |

*The 2026-08-11 column is SUPERSEDED and is kept visible rather than
overwritten (doctrine 17); the 2026-08-13 column is the current one. The tree
grew by 11 markdown files in between, which is the bulk of the movement. The
2026-08-13 column is also POST-FIX: before §7's fix to the instrument the same
run read 29 adjudicable / 144 no-number / 17 / 8 / **4**, and three of those
rows were the instrument's own misattribution. `DISAGREES` reading 3 on both
dates is a coincidence of two different threes — see §7.*

*`45 → 46` is not a typo and is worth leaving in. The file count moved **during
the sweep run that recorded it**: a sibling cell landed a markdown file between
the run that produced §7's verbatim block and the confirming re-run an hour
later. Every other count held. That is doctrine 78 happening to the instrument
rather than being argued about — and it is the concrete reason
`quality/test_spans.py` pins this sweep's SHAPE and not its numbers.*

**This file is excluded from the sweep, by name, and the sweep says so when it
runs.** It quotes `go/receipt 0.579` and `die/memory 0.773` as the defects the
sweep FOUND, so sweeping it re-finds them and reports the instrument's own
output as fresh evidence — with the exclusion off, `DISAGREES` goes 3 → 12 and
every one of the nine additions is a row of the tables above. A count that
grows when its own report is edited is measuring prose.

**These counts are a state of the tree, not a constant.** Sibling cells write
markdown into this repo in the same round (doctrine 78), so
`quality/test_spans.py` pins the SHAPE — refusals are named and never charged,
and the three outcomes partition the adjudicable rows — and not the numbers.

Of the **17 that reproduce, 14 name the spans that produced them**
(2026-08-13; was **12 that reproduce, 10 name the spans** on 2026-08-11).
The three that do not are the same shape in three places — the anchor cut:
`` `dawn`/`again` 0.729 `` in `quality/MATRIX_PREREGISTRATION.md:18` and
`quality/RESULTS_BAND.md:54`, scored on `dawn` ~ `-again`, and
`` `heat`/`receipt` 1.0 `` in `quality/RESULTS_COLLISION_PARTITION.md:53`,
scored on `heat` ~ `-receipt`.

**The 6 refusals are named and never charged** (doctrine 79; was 5 on
2026-08-11): `five`/`of` 0.603 (four sites), `bed`/`bead` 0.758, `sun`/`much`
1.000 are **channel** values, not totals. A sweep that called them wrong would
be inventing a claim in order to check it.

**The 3 that disagree**, at the line numbers they now sit on:

| site | recorded | measured from the words it names |
|---|---|---|
| `BACKLOG.md:96` | `go/receipt 0.579` | **0.272 NO_RELATION** |
| `quality/RESULTS_REDTEAM.md:8` | `go/receipt 0.579` | **0.272 NO_RELATION** |
| `quality/MATRIX_PREREGISTRATION.md:20` | `` `eye`/`memory` 0.671 `` | **0.492 CONSONANCE** |

*`BACKLOG.md:76` was this row's site on 2026-08-11; the file grew above it and
the row did not move. **All three are adjudicated in §7** — the first two in
the documents' favour, the third against the record.*

The two `go/receipt` rows are the documents that DECLARE the discrepancy, not
ones that inherited it — the sweep cannot tell those apart and does not try;
it reports "does not reproduce" and a reader separates them. That they are
found at all is the point: this project's own canonical bad report line is off
by **0.307 on a 0-1 scale**, more than a third of the range, from the pair it
names.

`eye`/`memory` is the interesting one. Its table in
`MATRIX_PREREGISTRATION.md` has five rows and **the four whose two anchors are
the same length reproduce to the digit** — `sun`/`much` 0.772, `dawn`/`again`
0.729, `love`/`prove` 0.784, `night`/`light` 1.000. The single row whose
anchors are unequal in length (`eye` 1 syllable against `memory` 3) is the
single row that does not. **The document is a PRE-REGISTRATION and is not to be
rewritten** (doctrine 17: a check may be kept after its premise is falsified,
but never quoted as if it were not); the number is quoted nowhere else as
current, so nothing downstream inherits it — RE-VERIFIED 2026-08-13, `0.671`
occurs in exactly two places in this repo, `MATRIX_PREREGISTRATION.md:20` and
this file's own table above, which labels it as not reproducing.

> ~~That is doctrine 95 — "equal-length examples hid it" — reproduced on the
> repo's own record, by an instrument that was not looking for it.~~
> **SUPERSEDED 2026-08-13.** That sentence attributes the non-reproduction to
> doctrine 95's subject, *the alignment defect in the shipped comparator*, and
> the attribution does not survive being checked: the row does not reproduce at
> its OWN commit either, so no comparator ever moved under it. The observation
> (four reproduce, the unequal-length one does not) is right and the mechanism
> named is wrong, and it is wrong in the direction that flatters the record.
> **§7 row 2 has the measurement.** Doctrine 95's *shape* survives intact and
> is if anything sharper: four 1-syllable-against-1-syllable rows hid a fifth
> row that was never a measurement at all.

**Scope, stated rather than implied:** markdown only. Numbers recorded in `.py`
docstrings and in test assertions are not swept.

---

## 7 · The `DISAGREES` rows, ADJUDICATED

**Adjudicated 2026-08-13.** Until this section existed, sweep 3 had reported
`DISAGREES` on every run since 2026-08-11 and **no row had ever been decided**.
The sweep's own closing paragraph says why it cannot decide them — *"a document
QUOTING a bad report line in order to criticise it looks exactly like one that
inherited it, and only a reader can tell them apart"* — which is a correct
statement of the instrument's limit and was silently doing duty as a verdict.
Doctrine 20: **"inconclusive by construction" is not a finding.** A row the
instrument cannot decide has to be decided by a reader or labelled undecided,
and neither had happened.

Four rows stood on 2026-08-13. Three were the record's business and one was the
instrument's. Each is adjudicated below against the underlying data, not
against the prose around it.

### The four rows, verbatim from the run that opened this section

```
  DISAGREES — a recorded number in the total's range that is not the total:
    BACKLOG.md:96  `go`/`receipt` recorded 0.579, measured 0.272 NO_RELATION
        to do with the number** — `go/receipt 0.579 RHYME` was `get to go` ~ `ceipt`.
    quality/MATRIX_PREREGISTRATION.md:20  `eye`/`memory` recorded 0.671, measured 0.492 CONSONANCE
        | `eye`/`memory` | 0.671 | 0.342 | **1.00** | **1.00** |
    quality/RESULTS_REDTEAM.md:8  `go`/`receipt` recorded 0.579, measured 0.272 NO_RELATION
        Writing one song surfaced a report line reading `go/receipt 0.579 RHYME`. Two
    quality/RESULTS_REVISION_LOOP.md:323  `ear`/`clear` recorded 0.996, measured 1.0 RHYME
        The `ear`/`clear` row is the one to read. `ear` ~ `will` scores **0.996** and is
```

| # | row | verdict | who was wrong |
|---:|---|---|---|
| 1 | `BACKLOG.md:96` `go`/`receipt` | **document RIGHT, number RIGHT** | nobody — two true statements about different objects |
| 2 | `MATRIX_PREREGISTRATION.md:20` `eye`/`memory` | **RECORD WRONG** | the record, and at its own commit |
| 3 | `RESULTS_REDTEAM.md:8` `go`/`receipt` | **document RIGHT, number RIGHT** | nobody — same as row 1 |
| 4 | `RESULTS_REVISION_LOOP.md:323` `ear`/`clear` | **INSTRUMENT WRONG** | `audit_spans.py`, now fixed |

---

### Rows 1 and 3 — `go/receipt 0.579` · VERDICT: both sides right, no edit

**The two sides.** The record says the harness printed `go/receipt 0.579
RHYME`. The sweep says `go` against `receipt` measures **0.272 NO_RELATION**,
a gap of 0.307 on a 0–1 scale.

**The evidence that decides it** is a re-run of the original call, and the
deciding fact is that the two sides are not about the same object:

```
lh.best_score(line_anchors("I don't get to go"),
              line_anchors("how they read the address like a receipt"),
              Declaration(), "go", "receipt")

  total 0.579  NO_RELATION
  scored on: get to go  ~  -receipt [last 1 of 2 syllables of 'receipt']
             (best of k=6)   MOSAIC (left)
  s.claims("go", "receipt")  ->  False
```

against the two words on their own:

```
lh.best_score(line_anchors("go"), line_anchors("receipt"), Declaration(),
              "go", "receipt")
  total 0.272  NO_RELATION      scored on: go  ~  -receipt   (best of k=1)
```

**0.579 is a true number about a pair of LINES. 0.272 is a true number about
the pair of WORDS.** Neither is a mistake; the mistake was the original report
line asserting the first while naming the second, which is this whole file's
subject. `s.claims("go","receipt")` returning `False` is the fix working.

**Both documents are of the criticising kind, and `BACKLOG.md:96` proves it in
its own sentence** — it reads `` `go/receipt 0.579 RHYME` was `get to go` ~
`ceipt` ``, naming the winning spans in the same breath as the number.
`RESULTS_REDTEAM.md:8` opens the report *about* the defect (*"Writing one song
surfaced a report line reading..."*) and its §1 dissects the same span pair at
line 28. Neither inherits the number as current.

**Two different answers, and doctrine 28 wants both named.** The INSTRUMENT
returns *cannot tell* on rows 1 and 3 — structurally, forever, because
criticising and inheriting are textually identical and it reads no intent. The
READER returns *criticism*, on the evidence quoted above. Recording only the
first would understate what is known; recording only the second would hide that
the sweep cannot get there on its own. **No edit is made to either document,
and the rows stay in `DISAGREES`,** because the arithmetic they report is true
and a sweep that suppressed them would stop finding the inherited kind.

---

### Row 2 — `eye`/`memory` 0.671 · VERDICT: the RECORD is wrong

**The two sides.** `quality/MATRIX_PREREGISTRATION.md:20` records
`` | `eye`/`memory` | 0.671 | 0.342 | **1.00** | **1.00** | `` — total,
nucleus, coda, stress. The sweep measures **0.492 CONSONANCE**.

Three independent measurements decide it, and all three go against the record.

**(a) The row does not reproduce at its own commit.** `git log --diff-filter=A`
gives `e8aa6ae` as the commit that added `MATRIX_PREREGISTRATION.md`. Running
that commit's own `lyric_harness.py` on all five rows:

| row | recorded | at `e8aa6ae` | today |
|---|---:|---:|---:|
| `sun`/`much` | 0.772 | 0.772 ✓ | 0.772 ✓ |
| `dawn`/`again` | 0.729 | 0.729 ✓ | 0.729 ✓ |
| `love`/`prove` | 0.784 | 0.784 ✓ | 0.784 ✓ |
| **`eye`/`memory`** | **0.671** | **0.492 ✗** | **0.492 ✗** |
| `night`/`light` | 1.000 | 1.000 ✓ | 1.000 ✓ |

The comparator returns 0.492 at the pre-registration's own commit and 0.492
now. **Nothing moved under this row; it was never 0.671 here.** That is what
retires the doctrine-95 explanation struck through in §6 — a number that never
reproduced cannot have been broken by a later comparator change.

**(b) The row's own nucleus column names a pairing the comparator has never
used.** `line_anchors` returns `memory`'s anchor as the whole span from its last
primary stress, `M EH1 M ER0 IY0` — three syllables — against `eye`'s one, and
`Declaration.scalar_alignment` is `'head'` (pinned by `quality/test_align.py`).
So the comparator compares `AY` with `EH`:

```
vowel_sim('AY','EH') = 0.585      <- what the comparator computes
vowel_sim('AY','IY') = 0.3425     <- rounds to 0.342, the RECORDED column
```

The recorded 0.342 is `eye`'s `AY` against `memory`'s **final** syllable `IY`.

**(c) The row is internally incoherent: no single syllable pairing produces its
three columns at once.** All three available pairings, enumerated:

| pairing | nucleus | coda | stress |
|---|---:|---:|---:|
| `AY`(str 1) ~ `EH`(str 1) | 0.585 | 1.0 | **1.0** |
| `AY`(str 1) ~ `ER`(str 0) | 0.513 | 1.0 | 0.0 |
| `AY`(str 1) ~ `IY`(str 0) | **0.342** | 1.0 | **0.0** |
| **recorded** | **0.342** | **1.00** | **1.00** |

The recorded row takes its **nucleus from the third pairing and its stress from
the first.** `memory`'s `IY` is unstressed, so the section's own argument —
*"Stress is free. The anchor is defined as the last primary stress, so both
sides are stressed by construction"* — is true of the pairing it did not use
and false of the pairing its nucleus came from. And the total is exactly the
weighted sum of its own columns with the length penalty omitted:

```
0.5(0.342) + 0.35(1.00) + 0.15(1.00) = 0.671     <- the recorded total, exactly
```

`Declaration.trailing_syllable_penalty` is 0.15 and was already present at
`e8aa6ae`; with `extra = 2` the comparator docks 0.30 that this row never paid,
which is the whole of the 0.671 → 0.492 difference (0.7925 − 0.30 = 0.4925).

**VERDICT: the row is a hand-assembled illustration, not a measurement**, and
its section is headed *"The defect, measured"*. The four rows around it are
1-syllable-against-1-syllable, where hand-assembly and the comparator agree
exactly, so the fifth row's construction was invisible.

**NOT REWRITTEN.** `MATRIX_PREREGISTRATION.md` is a pre-registration whose
whole evidential value is that it was committed before the fitting code
existed, and doctrine 17 keeps a falsified check visible rather than tidy. It
is also not my file. The correction lives here, the row stays in `DISAGREES`,
and `0.671` is quoted as current nowhere in the repo — re-verified 2026-08-13,
it occurs at `MATRIX_PREREGISTRATION.md:20` and in §6's table above, which
labels it as not reproducing.

**What does NOT change: the pre-registration's argument.** Its two structural
gifts — free stress at the anchor, and `cluster_sim([], []) == 1.0` — are both
real and both visible in the four rows that do reproduce (`stress` is 1.00 in
every one; `dawn`/`again` and `love`/`prove` collect a full coda 1.00). The
defective row was an illustration of a defect that the sound rows already
demonstrate.

---

### Row 4 — `ear`/`clear` 0.996 · VERDICT: the INSTRUMENT was wrong

**The two sides.** The sweep read `quality/RESULTS_REVISION_LOOP.md:323` as
recording `ear`/`clear` = 0.996 and measured `ear`/`clear` = 1.0 RHYME.

**The evidence is the line itself**, which never makes that claim:

```
The `ear`/`clear` row is the one to read. `ear` ~ `will` scores **0.996** and is
```

The **0.996 belongs to `ear` ~ `will`**, named later in the same line. The
sweep's `PAIR_RE` matched `` `ear`/`clear` `` at columns 4–17, then scanned 90
characters past it for a number and found 0.996 at offset 49 — across a
sentence boundary **and across a second pair mention**. Re-scored:

```
ear / clear :  1.0    RHYME       claims=True
ear / will  :  0.996  ASSONANCE   claims=True
```

Both are right in the document. `ear`/`clear` **is** 1.0 — that is why §4 of
that file names it as a rhyme group at all — and `ear` ~ `will` **is** 0.996,
which is that section's entire point about two licences stacking. The same line
yields a second `PAIR_RE` match, `` `ear` ~ `will` ``, which the sweep already
counted correctly in `reproduces / true as printed`. **The document was right
twice and the instrument charged it once.**

**This is adversary 7 committing adversary 7's own defect.** The file exists to
ask *do the number, the label and the evidence agree?*, and it was printing a
number beside a pair that did not produce it. Doctrine 45's shape, one level
out: the silently-picked coordinate is **which pair the number is a claim
about**, and nothing stated it.

**THE FIX**, in `sweep_record`: the tail scan now stops at the next pair
mention on the same line. A number belongs to the last pair named before it.

**Two silent siblings fell out of the same fix**, neither of which had ever
been noticed, both in `quality/RESULTS_COLLISION_PARTITION.md:53`:

```
| §6 | the three value-layer findings are `does`/`mailboxes`, `does`/`winters`,
  `heat`/`receipt` | **REPRODUCES EXACTLY** — L1~L5 1.000, L1~L7 0.910,
  L2~L28 1.000, all typed RHYME |
```

`does`/`mailboxes` and `does`/`winters` were each charged with the `1.000` that
appears after `heat`/`receipt`. That cell's numbers are keyed to **line** pairs
(`L1~L5`, `L1~L7`, `L2~L28`), not to the word pairs, so no word pair there
carries a number of its own. Both were sitting in `REFUSED` — a *quieter* wrong
answer than row 4's, because a refusal reads as a considered outcome. They now
land in *quoted with no number*, which is what they are.

**What the fix moved, and nothing else moved:**

| | before | after |
|---|---:|---:|
| pairs quoted WITH a number (adjudicable) | 29 | **26** |
| pairs quoted with no number | 144 | **147** |
| reproduces as the pair total | 17 | 17 |
| REFUSED, a different quantity | 8 | **6** |
| DISAGREES with the total | 4 | **3** |

The adjudicable + no-number total is 173 on both sides, so the three rows moved
between buckets rather than vanishing. A line-by-line diff of the sweep-3
output before and after is exactly those three rows and the five counts above.

**`PINNED` DID NOT MOVE, and that is a fact about which sweep it pins, not a
convenience.** All six pinned figures — `mandated` 1064, `judged` 1014,
`refused` 50, `violations` 82, `claimed` 632, `violations_claimed` 36 — come
from **sweep 1**, and this fix is entirely in sweep 3. `--check` runs sweep 1
only and passes green after the fix. Sweep 3's counts are deliberately NOT
pinned: sibling cells write markdown into this repo in the same round (doctrine
78), so `quality/test_spans.py` pins the sweep's SHAPE — refusals named and
never charged, the three outcomes partitioning the adjudicable rows — and not
its numbers. That is why a 29 → 26 correction breaks no test, and it is also
why this section, not a pin, is where the correction had to be recorded.

**Proven still able to go red.** With `violations_claimed` perturbed 36 → 37,
`python3 quality/audit_spans.py --check` exits **1** and names the moved figure
(`[FAIL] violations_claimed   committed 37, measured 36`); reverted, it exits
**0** with all six `[ok]`. The check is real after the edit as well as before.

**The residual limit, stated rather than left to be rediscovered.** The cut is
at the next PAIR mention, not at a sentence boundary. A number separated from
its pair by a sentence with no intervening pair mention would still be
mis-attached. Measured 2026-08-13: **0 of the 24** surviving `PAIR_RE` rows have
their number past a sentence boundary, so the case is unrealised in this tree
today — unrealised, not impossible.

---

## What is still open

1. **`quality/revise.py`'s verdicts do not carry `spans`.** The `brief` verb
   prints them by reading `grade`'s own cached matrix, so no second comparison
   exists and the two cannot disagree — but the proper home is a field on the
   verdict dict, and `revise.py` is not this cell's file. Filed as a patch.
2. **`battery.py`'s failing-pairs table still prints end words only.** The
   data is now available (`check_scheme` returns `violation_spans`,
   index-aligned with `violations`). Filed as a patch.
3. **The 179 anchor-layer hyphen substitutions are named, not refused.** The
   fix is a rule in `line_readability`: a compound whose LAST piece is unread
   has no end-rhyme anchor. It removes a verdict from 179 song line ends and
   moves no sonnet pair (both mandated sonnet cases read on their last piece),
   so its price is measurable and small. Filed as a patch, with the
   measurement.
4. **`search_k` is recorded and no null under it exists yet.** Doctrine 56
   says a max over k hypotheses needs a null under the same search. Recording
   k was the precondition; the null is not built. Over the 1,014 judged
   sonnet pairs k runs **2 to 36**, median 4 (695 pairs at k=4, 96 at 8, 75 at
   6, 65 at 9, and a tail of 3 pairs at 36), and the winner beat `k-1` rivals
   on every one of them. A maximum over 36 hypotheses reported as a bare
   number is a search quoted back at itself.
5. **`quality/MATRIX_PREREGISTRATION.md:20`'s `eye`/`memory` row is wrong and
   is deliberately left standing.** §7 row 2 has the measurement: the row is
   hand-assembled from two different syllable pairings and never reproduced
   from any comparator this repo has shipped, including the one live at its own
   commit. It is a PRE-REGISTRATION, doctrine 17 keeps a falsified check
   visible, and it is not this cell's file — so the correction is recorded here
   and the row is not touched. What a later session must NOT do is "fix" the
   number: rewriting a pre-registration after the fact destroys the only thing
   it is evidence of. If anything is added there it should be a dated note
   pointing at this section.
6. **The CI step's own cost estimate is stale, in `.github/workflows/ci.yml`.**
   Its comment and the commit that added it both say `--check` "runs sweep 1
   only (~1 min)". Measured 2026-08-13 on this machine: **10.3 s and 10.6 s**
   over two consecutive runs, against **18.6 s** for the full three-sweep run.
   The estimate errs in the safe direction (the check is ~6x cheaper than
   advertised, and the FULL run is well under the quoted minute) so nothing is
   mis-gated, but doctrine 58 applies to a cost the same way it applies to a
   threshold: it is a number nobody wrote down after measuring. Not this cell's
   file; filed rather than edited.
