# Results — the hyphen refusal, and what it costs on each population

The decision cell AB left open, taken. `quality/RESULTS_SPANS.md` §5 named the
anchor-layer hyphen substitution and did not refuse it, because its brief
forbade moving a verdict; it measured the price first and filed the change as
a patch. **The change is made here.**

Measured 2026-08-11 at commit `2f2d26c`, against the shipped `cmudict.dict`
and `Declaration()` defaults (dialect CMUdict General American, `theta_rhyme`
0.75, conjunctive band on, `fitted` False). Pinned to a COMMIT and not to a
date: a corpus cell was de-duplicating `corpus/song/` in the same round, so
every denominator below moves under anyone who re-runs it later. (`git diff
2f2d26c b609ba0 -- corpus/song/` is empty, so the figures still hold at the
commit that carries this file; the next de-duplication will move them and the
`RESULTS_SPANS.md` figures beside them.) The commands are given so it can be
re-run rather than believed.

    python3 battery.py
    python3 quality/audit_spans.py --only corpus
    python3 quality/readability.py corpus/song/eng_*.txt
    python3 quality/test_readability.py      # the two populations, pinned
    python3 quality/test_spans.py            # test 12

---

## The decision

**The 174 line ends whose end token is a compound with an unread LAST piece
are now a REFUSAL.** `line_anchors` returns no anchor, `score` returns
`NO_ANCHOR`, `line_readability` records `final_unreadable_cause = "piece"`,
and every consumer that already separated refused from judged separates these
too. The rule is one function, `unread_final_piece`, read by the anchor path
and by the record so the two cannot drift apart.

It is 174 and not the recorded 179 for two independent reasons, and only one
of them is a correction. See § The number moved twice.

### Why refusing, and not naming

`hill-zide` was scored against `wife-zide` at 0.472 and reported READABLE.
Nothing about that output is true. The number is `hill` against `wife`; the
two words being compared are not the two words in the poem; the band was
applied to a comparison nobody asked for; and the line was certified as one
the harness could read. A reader given `hill-zide / wife-zide 0.472
NO_RELATION` learns something false about Dorset.

That is worse than the case doctrine 79 was written for. There, an unreadable
end word was being counted as a rhyme VIOLATION — the harness had no verdict
and reported one. Here the harness has no verdict, reports one, **and the
report is not even about the right words**. `a-vound` is the sharpest form:
the only piece that reads is the participial prefix `a-`, whose only phone is
a schwa, so the anchor is a schwa and any two of Barnes's participles score as
a rhyme with each other on it. The harness was manufacturing rhymes, not
merely mislabelling them.

The repo has made this exact move once already and `CLAUDE.md` keeps the
record: 50 of the sonnet battery's 1,064 mandated pairs are refusals, which
corrected a headline that had been reporting Shakespeare as failing to rhyme.
The correction there **enlarged** the effect it was measuring rather than
shrinking it, which is the reason the item ends "a rate polluted this way is
not even conservative in a predictable direction".

### Why not READ the compound instead

`zide` is Dorset initial fricative voicing — the same alternation that gives
`zummer`, `zun`, `vound` — and not a misspelling of `side`. Mapping it onto a
General American entry would make the harness answer in a dialect it has not
declared, inside a hyphen rule, which is doctrine 1's failure mode exactly:
the dialect is a coordinate of the declaration tuple and this would move it by
accident, in one branch, for one class of token. The G2P cell refused dialect
deliberately for this reason and that refusal stands. `quality/readability.py`
prints the argument in the finding itself, so the next reader meets it where
the flag is raised rather than in a document.

The same answer covers the 13 tokens where the "compound" is not a compound at
all: `about--naething`, `sweet--Persephone`, `or--LUCASTA` are two words the
token regex fused across an em dash. The rhyme word there really is `naething`
and it really is unreadable; refusing is right, and it is right for the plain
reason rather than the subtle one.

---

## The price, population 1 — the sonnet oracle

`python3 battery.py`

```
mandated 1064   judged 1014   refused 50      violations 81 (8.0% of JUDGED)
```

**Before and after. Not one count moves, and the assertion `battery.py` gained
at `9396946` is what says so rather than a reading of the output.** Cell AB
predicted this from a monkeypatch; it is now measured with the change shipped,
which is a different claim.

The mechanism, and it is the reason this defect survived: three sonnet tokens
carry an unread hyphen piece and none of them is an anchor-layer case.

| sonnet | token | pieces | why it is untouched |
|---|---|---|---|
| 51 | `wilful-slow` | `slow` reads, `wilful` does not | last piece IS the rhyme word — REPORT layer. Mandated, judged, 1.0 RHYME, correct |
| 81 | `o'er-read` | `read` reads, `o'er` does not | same. Mandated, judged, 1.0 RHYME, correct |
| 28 | `swart-complexion'd` | last piece unread | not an end word: L11 ends on `night`, and the compound is reached by a MOSAIC span |

So 152 sonnets were structurally incapable of pricing this rule — doctrine 95
("equal-length examples hid it") in its second instance, and the reason the
price had to be taken from a corpus the oracle does not cover.

`quality/audit_spans.py --only battery` is also unchanged in every cell:
632/1014 report lines true as printed, 35/81 violations, 9 of 81 that a reader
could not reconstruct in principle, 121 ties at the maximum, and the two
`('exact', 'substituted')` pairs are still there — the sonnets' own
substitution cases are the report-layer half and survive the refusal, which is
what keeps the `substituted` span kind demonstrable (doctrine 84).

---

## The price, population 2 — the 143 English song files

Three denominators, all printed rather than one chosen (doctrine 91), because
this repo has already had one argument caused by quoting a count without its
line rule:

| line rule | lines | new refusals |
|---|---:|---:|
| `line_tokens`-non-empty, outside the `#`/`---`/`[` markers | 151,894 | **174** |
| `quality.readability.read_lines` — the PINNED rule, AT THE TIME | 188,805 | **187** |
| every non-blank line | 189,261 | — |

The 13-line gap between 174 and 187 is `--- TITLE:` and `#` header lines whose
own last token is such a compound. They are countable under the pinned rule
and are not verse; both numbers are true of their own population.

**FIXED 2026-08-12: `read_lines` IS the first row now, not the second.** It
was the one line-reader in the project that did not exclude `#`/`--- `/`[`
apparatus lines — this table names the gap precisely (13 lines, both counts
true of their own population) and did not propose closing it. `read_lines`
now excludes them, matching every other reader (including `quality/grid.py`'s
`read_marked_songs` over these same files) and this table's OWN first row.
The "187" and "10231"/"5.4188%" figures below are UNCHANGED — they are still
the hyphen refusal's price on whatever population `read_lines` returns, they
now land on 151,898/9,078/5.9764% instead of 188,805/10,044/5.3198%.
`quality/test_readability.py` test 5 carries the current pin.

On the pinned rule:

```
refused BEFORE (cause token)  10044   5.3198%     <- unmoved
refused ADDED  (cause piece)    187   0.0990%
refused AFTER                 10231   5.4188%
```

The added refusals are **1.83% of all end-word refusals on this corpus**. The
prior figure is unmoved by construction, not by luck: `corpus_rate` now splits
by cause, so a reader can still check `10044` against the tree and the rule's
price is the difference between two printed lines and nothing else. Two cells
were editing this corpus and this module in the same round, and a single
number would have made their two effects inseparable (doctrine 58).

### WHERE it falls — doctrine 67, by file

A refusal rate is not a tax. Concentration, first:

| new | of | rate+ | prior rate | file |
|---:|---:|---:|---:|---|
| 84 | 13,730 | 0.61% | 16.13% | `eng_hall_william_barnes.txt` |
| 27 | 17,514 | 0.15% | 12.70% | `eng_celtic_robert_burns.txt` |
| 10 | 1,707 | 0.59% | 7.03% | `eng_hall_ws_gilbert.txt` |
| 7 | 13,836 | 0.05% | 6.23% | `eng_hall_thomas_durfey.txt` |
| 4 | 1,215 | 0.33% | 23.29% | `eng_hall_edwin_waugh.txt` |
| 3 | 373 | 0.80% | 2.68% | `eng_american_margaret_junkin_preston.txt` |
| 3 | 395 | 0.76% | 10.13% | `eng_american_paul_laurence_dunbar.txt` |
| 3 | 5,267 | 0.06% | 2.60% | `eng_british_christina_rossetti.txt` |
| 3 | 2,757 | 0.11% | 4.03% | `eng_british_jean_ingelow.txt` |
| 3 | 2,477 | 0.12% | 3.75% | `eng_british_matthew_arnold.txt` |
| 3 | 2,695 | 0.11% | 18.66% | `eng_british_richard_lovelace.txt` |
| 2 | 991 | 0.20% | 3.43% | `eng_british_charles_kingsley.txt` |

and a tail of 16 more files at 1–2 each (Fitzgerald, Hemans, Keats, Herrick,
Hogg, Lowell, Lear, Barrett Browning, Brontë, Shelley, Blake, Nairne, Scott,
Heber, Emmett, Robert Browning).

- **28 of 143 files carry one. 115 carry none.**
- **The top two carry 111 of 174 = 63.8%**, and both are dialect: Barnes is
  Dorset, Burns is Scots. **This has to be said plainly: the refusal is
  concentrated on dialect writing.**
- No file loses as much as 2% of its own line ends. The worst RATE is 1.89%
  (Gerald Griffin, 1 of 53 on the pinned rule) and 1.37% on the verse rule
  (Emmett, 1 of 73) — both files where a single line end is the whole story,
  which is why the counts above are ordered by count and the rate is printed
  beside it rather than instead of it.

### Concentrated is not the same as biased, and the difference is measurable

Doctrine 67's own history is a warning here: this project asserted that the
Persian module's 60.2% refusal was a flat tax, and was wrong for a day until
someone measured that it refuses where the question is hard and answers where
it is easy. The same question, asked of this rule:

| | prior end-word refusals | of | prior rate |
|---|---:|---:|---:|
| the 28 files this rule touches | 7,914 | 95,799 | **8.26%** |
| the 115 it does not | 1,164 | 56,095 | **2.08%** |

**A ratio of 4.0x** (medians 4.25% against 1.41%, 3.0x). The new refusals land
where CMUdict was already failing. The rule does not open a gap between
dialect and standard writing; it makes a gap that already existed visible at
the token level, where it had been hidden inside a compound and scored anyway.
Barnes's line ends were 16.13% unreadable before this rule and are 16.74%
after. Nobody reading his file could have been under the impression the
harness was reading his Dorset.

And the concentration is not purely dialectal, which the composition shows:

| | count | what it is |
|---|---:|---|
| participial `a-` prefix | 73 | `a-vound`, `a-vled`, `a-zet`. The read piece is the prefix; the anchor is a schwa. 67 Barnes, 3 Dunbar, 1 each Kingsley / Herrick / Scott |
| em dash fused into the token | 13 | `about--naething`, `sweet--Persephone`, `or--LUCASTA`. Two words, not a compound; the rhyme word is the second and it is genuinely unread |
| ordinary compounds | 88 | half Scots/Dorset (`hill-zide`, `braid-claith`, `key-stane`, `red-cwold`), half **standard literary English CMUdict simply does not list**: `high-souled`, `star-inwrought`, `deep-inwound`, `dew-pearled`, `chamber-casement`, `leaf-embowered`, `rough-hewed`, `ocean-clime`, `tempest-tost`, `self-overawed`, `down-pattering`, `rock-defiles` |

Keats, Shelley, Arnold, Rossetti, Blake, Browning and Hemans are in this set,
and not one of them is writing dialect. The gap is CMUdict's coverage of
English COMPOUNDING, and dialect writers are hit hardest because they compound
more and because their pieces are unlisted twice over.

### What is actually withdrawn, and the one honest cost

A refusal that removes nothing is free; one that removes correct answers is
expensive. Counted rather than argued: every pair at line distance 1–4 with a
refused line on at least one side, scored on the OLD path
(`scratchpad/cellAG/withdrawn.py`, which restores it by monkeypatch):

| relation the old path returned | pairs |
|---|---:|
| NO_RELATION | 637 |
| ASSONANCE | 524 |
| CONSONANCE | 78 |
| RHYME | 54 |
| REPEAT | 6 |
| RIME_RICHE | 3 |
| **total** | **1,302** |

**60 of 1,302 (4.6%) were admitted as RHYME or REPEAT.** The other 1,242 were
labels — `NO_RELATION`, `ASSONANCE` — computed on the wrong string, which is
the same defect wearing a negative verdict, and doctrine 24's point is that a
wrong ASSONANCE label is not less wrong for being unflattering.

**The one real cost, named rather than buried.** Of the 8 pairs where BOTH
sides are refused, 6 were `REPEAT` — and all 6 are `Parley-voo` against
`Parley-voo`. Token identity is a fact about the text that does not need a
pronunciation, so refusing withdraws a verdict that was true. That loss is
**not new and not this rule's**: `rhyme_graph` and `check_scheme` drop a pair
the moment either side is `final_unreadable`, so the same loss already applies
to all 10,044 token-level refusals, including any refrain whose end word
CMUdict cannot read. It is filed as a new register entry (§ Owed, below)
rather than fixed here, because a REPEAT-survives-refusal rule moves verdicts
in a second direction and belongs in its own decision with its own price.

---

## The 328-of-328 misfiling, which was owed separately

`line_readability` computed `interior_unreadable` as every unreadable string
whose folded form differed from the WHOLE final token. `Lexicon.transcribe`
emits hyphen PIECES, so `zide` — part of the END word — was filed as an
INTERIOR unreadable, under a reason string that reads

> a multi-syllable anchor reaching back past one of them is reading a line
> with a hole in it

which is a sentence about material the anchor may CROSS. It was 328 of 328
cases (327 of 327 after the de-duplication). "Interior" and "inside the end
word" mean opposite things to every consumer downstream — one is a warning
about a mosaic reach, the other is the rhyme word itself not being read — and
collapsing them is doctrine 28.

**Fixed by derivation rather than by patching the comparison.** `interior` is
now the unread pieces of `line_tokens(text)[:-1]` — interior by POSITION, so
no string coincidence can put a final piece in it and no final piece can
escape it. Nothing is deleted: the pieces move to `final_unread_pieces`
(doctrine 24 — a rule that would delete a category relabels instead), and the
line's own genuine interior unreadables stay where they are. The regression
pins both halves on one line: `zide` leaves `interior_unreadable` and `zunny`
stays in it.

Two more renderings of the same collapse, found while fixing it:

- `quality/readability.report()` emitted `UNREADABLE_END_WORD` over BOTH
  causes, so every compound case would have been printed twice under two
  sentences that say different things about it. The two flags now partition.
- the `readability` verb's summary line read
  `refusals {len(rep.get('refusals', []))}` and `report()` has no `refusals`
  key, so **the verb printed `refusals 0` on every text it has ever been run
  on** — including a Barnes file with 2,402 of 16,179. Doctrine 79's own rule
  broken in the rendering of the module that exists to enforce it. It now
  prints countable / read / refused, split by cause.

---

## The number moved twice, and only one of them is a correction

Four figures for one quantity now exist in this repo. Doctrine 70's amendment
is the rule being followed here: a figure cited as evidence has to name the
rule that produced it, or a fifth appears next round.

| figure | split | denominator | what changed |
|---|---|---:|---|
| 293 | — | 189,985 | cell U, the union, triaged wholly as ingestion |
| 328 | 179 + 149 | 153,115 | cell AB re-cut it, and SPLIT it by which piece failed |
| 327 | 178 + 149 | 151,894 | **the corpus moved** — cell AC's de-duplication, not the rule |
| **323** | **174 + 149** | **151,894** | **a correction**: a piece with no letter is not a word |

The correction: `token_pieces` classified any hyphen piece that yielded no
phones as unread, including pieces with no letters in them. `--` is an em dash
the token regex glues in, so `pie--'` split to `pie` and `'`, and a bare
closing quote was recorded as an unread piece of the rhyme word. Four line
ends — `pie--'`, `but--'`, `soap--'` in Lewis Carroll and `mind--'` in Shelley
— would have had a **correct** verdict withdrawn on the strength of a
typesetter's punctuation. `line_tokens` has always required a Latin letter of
every token it emits; this function now agrees with it. Doctrine 55 one layer
down: before treating a mark as structure, ask whether it is evidence of the
form or an artifact of the edition.

---

## What this does NOT do

- **It does not touch the 149 report-layer cases.** `threshing-floor` is
  anchored on `floor`, which is the rhyme word; the anchor is right and only
  the record of what was read is incomplete. They stay judged, `span_kind`
  returns `substituted`, and `span_label` prints both pieces. Refusing them
  would be the mirror error of scoring the other 174.
- **It does not guess a pronunciation.** Known gap 1 (g2p-en as a transcribe
  fallback) is a separate declared decision. These 174 are the size of the
  gap, and they are an argument for or against g2p rather than something to
  make disappear.
- **It does not re-triage any recorded violation count.** No number in
  `RESULTS_SPANS.md` §3 or §4 moves.

## Owed, and not done here

1. **A REPEAT that survives a refusal.** Two lines ending in the identical
   token repeat whether or not the token can be pronounced. `rhyme_graph` and
   `check_scheme` drop the pair on the first refusal, so this is lost for all
   10,231 refusals and not only the 187 new ones — 6 measured instances in the
   distance-1–4 window alone. Needs its own decision and its own price.
2. **`corpus/song/eng_*.txt` compounds are an argument for a compound rule in
   the lexicon, not only for g2p.** 88 of the 174 are ordinary compounds whose
   pieces are both English words; a rule that composed two dictionary entries
   would read most of them without inventing a phoneme. It would also change
   what `substituted` means, so it is a decision and not a tidy-up.
