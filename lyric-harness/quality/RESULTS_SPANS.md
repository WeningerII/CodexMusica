# Results — adversary 7, span provenance

`python3 quality/audit_spans.py` · regressions in `quality/test_spans.py` ·
measured 2026-08-11 against the shipped `cmudict.dict`, `Declaration()`
defaults (dialect CMUdict General American, `theta_rhyme` 0.75, conjunctive
band on, `fitted` False).

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

| | count |
|---|---:|
| markdown files scanned | 34 |
| pairs quoted **with** a number (adjudicable) | **20** |
| pairs quoted with no number (not a claim about a score) | 84 |
| — reproduces as the pair's total | 12 |
| — REFUSED, the number is a different quantity | 5 |
| — DISAGREES with the total | 3 |

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

Of the **12 that reproduce, 10 name the spans that produced them.** The two
that do not are the same row in two files — `` `dawn`/`again` 0.729 `` in
`quality/MATRIX_PREREGISTRATION.md:18` and `quality/RESULTS_BAND.md:54`, scored
on `dawn` ~ `-again`, the anchor cut.

**The 5 refusals are named and never charged** (doctrine 79): `five`/`of`
0.603 (three sites), `bed`/`bead` 0.758, `sun`/`much` 1.000 are **channel**
values, not totals. A sweep that called them wrong would be inventing a claim
in order to check it.

**The 3 that disagree:**

| site | recorded | measured from the words it names |
|---|---|---|
| `BACKLOG.md:76` | `go/receipt 0.579` | **0.272 NO_RELATION** |
| `quality/RESULTS_REDTEAM.md:8` | `go/receipt 0.579` | **0.272 NO_RELATION** |
| `quality/MATRIX_PREREGISTRATION.md:20` | `` `eye`/`memory` 0.671 `` | **0.492 CONSONANCE** |

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
single row that does not. That is doctrine 95 — "equal-length examples hid
it" — reproduced on the repo's own record, by an instrument that was not
looking for it. **The document is a PRE-REGISTRATION and is not to be
rewritten** (doctrine 17: a check may be kept after its premise is falsified,
but never quoted as if it were not); the number is quoted nowhere else as
current, so nothing downstream inherits it.

**Scope, stated rather than implied:** markdown only. Numbers recorded in `.py`
docstrings and in test assertions are not swept.

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
