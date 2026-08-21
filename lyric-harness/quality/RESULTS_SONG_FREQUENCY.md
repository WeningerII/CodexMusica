# RESULTS — what "the most frequent band-passing candidate" should be counted over

Cell BE, 2026-08-11.

> **THE TWO EXAMPLE LYRICS THIS DOCUMENT RUNS ON ARE NOT IN THE REPOSITORY,
> AND EVERY TRANSCRIPT BELOW THAT USES THEM IS UNREPRODUCIBLE FROM A CLEAN
> CHECKOUT.** Annotated 2026-08-21, found by asking whether the
> implementation depends on `CLAUDE.md` (it does not) and mistyping a path
> that turned out not to exist. `examples/cherokee_bill.txt` and
> `examples/never_been_to_a_scene.txt` were DELETED ON PURPOSE by commit
> `11aa19b` (2026-08-12, *"Remove Claude-authored example lyrics from the
> repo"*) and `examples/` now holds no tracked file at all. That decision is
> not in question here and is not being reversed; what had never been done is
> telling the record about it.
>
> **What this does and does not mean.** The measurements below were real when
> they were made and they are not withdrawn — nothing here is known to be
> wrong. What is gone is the ABILITY TO RE-CHECK them: a verdict of
> *REPRODUCES EXACTLY* is a claim that someone re-ran the command and got the
> same answer, and from this checkout nobody can do that any more, so those
> verdicts are frozen testimony rather than live results (doctrine 17 — kept,
> and never quoted as though the check were still available). Any command
> block naming an `examples/` path is a record of a run, not an instruction.
>
> **`quality/fixtures/anaphoric.txt` IS NOT A SUBSTITUTE** for the reader
> tempted to swap it in: it is 26 lines, and `never_been_to_a_scene.txt` was
> 41 lines / 291 tokens. It reproduces a different item, not this one.

> **WIRED CLOSED 2026-08-11**, later the same day. "Nothing here is
> committed" no longer holds: `data/opensubtitles_en_50k.tsv`,
> `data/song_endword_en.tsv` and `data/song_rhymepair_en.tsv` are committed
> and declared (`data/sources.tsv`), `lyric_harness.Lexicon.freq_rank` reads
> the first, and `quality/revise.py`'s `Reviser.joint_field` ranks primarily
> by the third via `quality/frequency.py`'s `eng-song` conditional
> (`scoring=UNSEEN`), falling back to `freq_rank` where the conditional has
> no observed partner. Every number below is kept as measured, at the
> population and instrument this document tested — it is the argument for
> the wiring, not a description of it.

**The claim.** Doctrine 9's mechanism is aimed by `wordfreq20k.txt`, and that
file is a 2006 web crawl. Fixing the *population* is worth +4.5 percentage
points. Fixing the *instrument* is worth +46.3. The instrument was the
problem, and a rank list is not the right object.

| | | |
|---|---|---|
| **What was measured** | the six words `quality/revise.py` marks FORBIDDEN, against the words 69 held-out authors actually reached for | |
| **Shipped source blocks** | 16.9% of realised rhyme partners | |
| **Line-final conditional blocks** | 63.2% | 3.7x |
| **Six words drawn at random from the same field** | 3.6% | |

Every source forbids exactly six, out of the *same* candidate field. The
comparison is by lift, not by yield — doctrine 61, and it is doctrine 61
arriving at doctrine 9.

---

## 0. Everything the brief asserted, verified by execution first

Two briefs this week sent cells to redo finished work because a register was
read instead of measured. So, before building:

| claim in the `wordfreq20k.txt` row | verdict | command |
|---|---|---|
| `email` 115, `software` 152, `yahoo` 499, `moon` 2801, `grief` 10700 | **reproduces exactly** | rank probe over the file |
| `weep` absent entirely | **reproduces** | same |
| `wordfreq.top_n_list('en', 20000)` does not reproduce the file | **reproduces** | `from wordfreq import top_n_list` |
| divergence at rank 2, 15,914 of 20,000 shared, 4,086 unaccounted | **reproduces to the digit** — `to`/`of` transposed | same |
| corpus is 4,930 items / 143 English authors | **reproduces** | `--census` |
| ~152,325 sung lines | **152,330** under `audit_corpus._MARKER` | `--census` |

```
python3 quality/build_song_frequency.py --census
```

### and the row's one wrong conclusion

Provenance was recorded UNDETERMINED. It is **determined**, and it took one
fetch:

```
curl -sS https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt
```

```
md5 c0190594b2a3a30a89bd0367b0892e0e   <- identical to wordfreq20k.txt
0 of 20,000 positions differ
```

`wordfreq20k.txt` **is** `first20hours/google-10000-english/20k.txt`, derived
from Peter Norvig's `count_1w.txt` over the Google Web Trillion Word Corpus —
upstream's own words, *"one trillion words from public Web pages"*. So "it is
a web crawl" is now **attested rather than inferred**, and it is the canonical
one.

The negative reproduction test was never wrong; the inference from it was.
`top_n_list` not reproducing the file means *not this wordfreq*, not
*unknowable* — and the 4,086 unaccounted types contained the answer in plain
sight: `acdbentity`, `acdbline` (AutoCAD DXF keywords), `abramoff`,
`bizjournalshire`. Doctrine 49: a sourcing failure is a claim about the
network at a moment. This one was re-run and it fell.

### and a licence finding that came with it

Upstream `LICENSE.md`, fetched the same minute:

> Educational and personal/research use of this data is permitted under the
> LDC license, Norvig's MIT license for his contributions, and US fair use
> doctrine. **I do not recommend using this data for commercial purposes
> without licensing it from the Linguistic Data Consortium.**

Doctrine 85 is live on that last sentence. This repo refused
`irfanzainudin/pantunis-data`, CELT and 4,347 ci for quoted non-commercial
restrictions, and the stated target of the project is an MCP server beside
Codex Musica. The grant here is weaker than an express prohibition — it is a
recommendation from a redistributor who is not the rightsholder — but the
rightsholder's terms (LDC2006T13) are the binding layer and they are not a
public grant. **This cell does not refuse it**; that call belongs with whoever
owns the gate. It notes that the replacement is already built and is MIT.

---

## 1. The list does a second job nobody had named, and it is the larger one

`lyric_harness.CandidateEngine.__init__`:

```python
rank = lex.freq_rank.get(word)
if rank is None:
    continue          # MVP: only common words as candidates
```

So `wordfreq20k.txt` is not only the **ranking** that picks the forbidden set.
It is the **membership of the entire candidate pool**.

```
CMUdict entries                                      126,052
a-z lexicon words                                    124,926
candidate index size                                  18,010
EXCLUDED because absent from wordfreq20k.txt         106,916   (85.6%)
```

`weep`, `wept`, `mourn`, `doth`, `ere`, `wilt` are all in the 85.6%. They are
not merely un-forbiddable — they are **unofferable**. `yahoo` is in the pool
and `weep` is not.

---

## 2. THE DELIVERABLE — FORBIDDEN sets, real call words, real song

Call words that really end lines of `examples/cherokee_bill.txt`, the ballad
committed two commits ago. Produced through the shipped
`quality/frequency.py`; `field_depth=complete pool`, `field_band='grader'`,
`modal_exclusion=6`.

### `floor` — L13 *it was a friend's own floor:* — field 132 words

| source | FORBIDDEN |
|---|---|
| **W** `wordfreq20k.txt` (SHIPPED) | `for, or, are, your, more, r` |
| **S** OpenSubtitles (spoken) | `for, your, are, or, more, sure` |
| **E** song line-final | `more, door, shore, before, are, store` |
| **C** song CONDITIONAL P(b\|a) | `door, more, before, shore, bore, store` |

Five of the shipped six are function words plus the bare letter `r`. `door` —
the word a writer reaching for the obvious *actually takes* — is left
**offered**.

### `night` — field 265 words

| source | FORBIDDEN |
|---|---|
| **W** (SHIPPED) | `that, not, at, about, but, site` |
| **C** conditional | `light, bright, sight, delight, white, fright` |

The shipped source spends the whole exclusion on function words and one web
word, and leaves the entire cliché field open.

### `will` — L4 *than a long one ever will.* — field 215 words

| source | FORBIDDEN |
|---|---|
| **W** (SHIPPED) | `email, well, mail, hotel, real, l` |
| **S** spoken | `well, tell, still, feel, girl, kill` |
| **E** song line-final | `still, well, tell, hill, hell, dwell` |
| **C** conditional | `still, hill, ill, fulfil, skill, kill` |

**`email` is the number-one forbidden word for the call `will`.**

### `moon` — L8 *they'd have him by the moon.* — field 95 words

| source | FORBIDDEN |
|---|---|
| **W** (SHIPPED) | `on, phone, own, join, june, loan` |
| **S** spoken | `on, own, alone, gone, phone, soon` |
| **E** song line-final | `alone, on, own, gone, throne, known` |
| **C** conditional | `june, soon, noon, tune, spoon, lagoon` |

### `hope` — L24 *what it could not teach in hope.* — field 27 words

| source | FORBIDDEN |
|---|---|
| **W** (SHIPPED) | `top, group, drop, op, scope, loop` |
| **S** spoken | `top, drop, group, nope, soup, **rope**` |
| **C** conditional | `scope, soap, pope, slope, cope, telescope` |

**The one case that goes the other way, and it is kept in because it is the
honest bound.** The song's own line 22 ends on `rope`; the subtitle rank
forbids it and the conditional does not, because in 4,930 items `rope` never
once occurs as `hope`'s realised partner. `hope`'s entire distribution is
`scope 7, soap 5, pope 4, grope 2, slope 2, cope 1, heliotrope 1, mope 1,
telescope 1`. See §4.

---

## 3. The measurement, leave-one-author-out

Ground truth is **the held-out author's own realised partners** — the only
population here that is what doctrine 9 is about: what a writer in this idiom
actually reached for.

`covered` = share of that author's realised partner tokens sitting on the six
words the source forbids. Each source forbids exactly six, drawn from the same
band-passing field, so **yield is held constant by construction** and the only
thing varying is which six.

```
# THIS COMMAND CANNOT RUN FROM A CLEAN CHECKOUT, and the reason is worse
# than a moved path: `scratchpad/cellBE/evaluate.py` was an OPERATOR'S
# SCRATCH SCRIPT and was never in the repository at all. Annotated
# 2026-08-21, found by `scripts/check_doc_paths.js` on the run that shipped
# it. THE TABLE BELOW IS NOT WITHDRAWN — nothing here is known to be wrong,
# and the six figures are quoted downstream in `data/sources.tsv` — but it
# is a measurement NO ONE CAN RE-RUN, which is exactly standing rule 3's
# subject: "any measurement or step used in producing a delivered song goes
# through a verb, and an improvised script used twice is a defect report,
# not a convenience". That rule was written for the SONGS; this is the same
# defect one layer over, in a RESULT. The real repair is to rebuild the
# evaluator as a verb so the leave-one-author-out comparison re-derives on
# demand, which is a sitting of its own and is not done here.
python3 scratchpad/cellBE/evaluate.py
```

```
evaluated (author, call word) cells : 1,760
distinct call words                 :   686
distinct authors                    :    69
k (modal_exclusion)                 :     6

source                     covered      hit  lift vs R       n
  ------------------------------------------------------------
W web-2006 (shipped)        16.9%    17.4%      4.73x   1,760
S subtitles (spoken)        21.4%    18.8%      6.01x   1,760
A song all-position         29.1%    23.3%      8.17x   1,760
E song END-position         42.3%    35.2%     11.88x   1,760
C conditional (LOO)         63.2%    61.5%     17.72x   1,760
R random from field          3.6%     4.0%      1.00x   1,760
```

A, E and C are rebuilt **leave-one-author-out for every evaluated author** —
the table that scores Burns contains none of Burns's counts. W and S are
external, so LOO is a no-op on them.

### the decomposition, and which steps are clean

| step | Δ | confounded? |
|---|---|---|
| **register** W → S | **+4.5pp** | clean — both external, both contemporary |
| corpus+period S → A | +7.7pp | **CONFOUNDED** — mixes "verse not speech" with "1867 not 2018". Not interpretable alone. |
| **position** A → E | **+13.2pp** | clean — same corpus, same period, same LOO |
| **conditionality** E → C | **+20.9pp** | clean — same corpus, same period, same LOO |

The two clean large steps are **position** and **conditionality**, and both
are properties of the *instrument*. Register — the thing the file's own row
led with, and the thing `yahoo` outranking `moon` by 5.6x makes vivid — is the
smallest step measured.

### why a global rank fails, in one line

```
ALL-position head:  the and to a of in i my that his with an for is but thy
END-position head:  me thee day love be away again heart night more god there
```

The head of any unigram list, from any population, is function words. Inside a
rhyme field the high-frequency end is therefore spent on `for, or, are, your`
and `that, not, at, but` — words no writer takes as a rhyme — while `door`,
`more`, `light` and `bright` stay offered. `sky` is line-final rank 25 and
all-position rank 212.

**So doctrine 9's mechanism, as shipped, is in the majority of cases not
firing at all.** It is not aiming in a slightly wrong direction; it is
spending its six slots on words that were never in the running.

---

## 4. What the conditional cannot do — sparsity, stated because it bounds everything above

| | |
|---|---|
| end-word types | 10,400 |
| types with **any** realised rhyme partner | 6,480 (62.3%) |
| median distinct partners per call word | **2** |
| types that cannot fill a k=6 forbidden set | 4,931 of 6,480 (**76.1%**) |

**Token-weighted the picture inverts**, which is why the file ships anyway:

| line-final tokens sitting on a call word with... | share |
|---|---|
| ≥1 realised partner | 92.7% |
| ≥6 distinct partners (can fill k=6) | **69.8%** |
| ≥20 realised partner tokens | 73.9% |

**Type-sparse, token-dense.** And the 63.2% in §3 is measured on cells with
≥20 realised partner tokens — **the dense region by construction**. It is what
the conditional does *where it has support*, not a claim about the
10,400-type tail. Doctrine 20: inconclusive by construction is not a result,
and it must not be reported as one.

**This supports a BACKOFF and does not support a replacement.** The shape the
evidence licenses, in priority order: conditional where it has support →
line-final rank → contemporary spoken rank → refuse. `hope`/`rope` in §2 is
exactly the case the second and third rungs exist to catch. **The consumer is
`quality/revise.py` and a sibling owns it this round**; this cell built the
distribution and stopped at the boundary.

---

## 5. Period — doctrine 11's third candidate instance, tested

All 143 authors died in or before **1929** (median 1867, max 1929), because
the provenance gate admits nothing later. Two features in this repo have
already been caught reading period rather than quality, so this was tested
rather than assumed.

Operationalisation kept independent of the thing measured: a word is archaic
when it is absent from the 50,000 most frequent types of contemporary spoken
English. That test is external to `corpus/song/` in both direction and period.

| | |
|---|---|
| of the top 500 line-final words, absent from spoken English | **1** (`blest`) |
| of the top 500, marked-archaic on a hand list | 7 (1.4%) — `thee, thine, ye, art, nigh, blest, thou` |
| of 10,001 forbidden slots, marked-archaic | 300 (**3.0%**), of which **192 are `thee`** |
| realised partner **mass** on marked-archaic words | **2.43%** |

The exposure is **real, small, and concentrated**: two thirds of it is one
word. A consumer that wants it gone can intersect with
`data/opensubtitles_en_50k.tsv` at a cost bounded by those figures.

**Both tests are reported because neither is sufficient.** The
absent-from-spoken test is principled and cannot see `thee` — present in film
subtitles, marked in a lyric. The hand list can see `thee` and is not
principled. The same 13.4%-absent statistic on `wordfreq20k.txt`'s own
vocabulary points at the *opposite* defect: `bizjournalshire` and `acdbentity`
are not archaic, they are web debris. **A magnitude cannot tell the two apart
and the direction has to be named.**

---

## 6. How independence is maintained

Doctrine 13's remedy here is **exact, not argued**.

`data/song_endword_en.tsv` and `data/song_rhymepair_en.tsv` carry an `author`
column. That is not provenance decoration — it makes leave-one-author-out
computable at read time, and `quality/frequency.py` **refuses to serve either
table without a `scoring=` argument naming what is about to be scored**:

```
1. pool-derived source served with NO scoring= :
   REFUSED: cell 'eng-song': 'song:corpus/song/eng_*' is derived from
   'corpus/song/eng_*', so serving it requires `scoring=` ...

2. scoring=UNSEEN (the revise loop's case, new lines in no corpus):
    [('june', 43), ('soon', 39), ('noon', 30), ('boon', 13), ('tune', 12), ('spoon', 4)]

3. scoring=<an author in the table> -> that author dropped:
    full : [('door', 64), ('more', 51), ('nevermore', 36), ('before', 32), ('lenore', 20), ('shore', 13)]
    -Poe : [('door', 28), ('more', 27), ('before', 16), ('shore', 5), ('sore', 3), ('evermore', 2)]

4. scoring=<not an author> -> refused, because leaving it out is a no-op
   that looks like a correction.
```

Case 3 is the dependence made visible in one line: `nevermore` and `lenore`
are `floor`'s third and fifth most frequent partners in the whole corpus, and
they are **one author**. A table used to grade Poe with Poe still in it is the
circle doctrine 13 names, and it is the circle that was already being closed
silently — the shipped list has no such guard because it has no such column.

**Three cases, three different answers, and none of them is a default:**

| what is being scored | argument | why |
|---|---|---|
| lines the model just wrote | `scoring=UNSEEN` | they are in no corpus; the full table is independent of them **by construction**. This is the revision loop. |
| a text by an author in the table | `scoring=<author>` | that author's counts are dropped |
| anything else | *refused* | leaving out a unit that was never in is a no-op that looks like a correction |

This is doctrine 48's move applied to doctrine 13. The existing
`justification` field records that somebody thought about the dependence once,
in 2026; `check_scoring` records that **this call** is not the circle. A
principle that lives only in prose gets followed exactly as often as someone
remembers it.

**Doctrine 14 is the part that is NOT solved by the author column** and is
stated in both rows as a prohibition: no threshold calibrated with these
tables may then be *measured* on `corpus/song/`. Leave-one-out removes an
author, not the corpus.

**The honest gap** — declared as `eng-verse` in `NO_INDEPENDENT_SOURCE`, which
raises rather than falling back: the source the modal exclusion actually wants
is **contemporary** English sung verse. `eng-song` has the right position and
medium and the wrong period; `eng-spoken` has the right period and no
line-final position at all. Nothing here has all three and nothing can — the
provenance gate stops at 1931 and post-1931 lyrics are in copyright. Doctrine
92, third instance: the admissible source and the complete source are disjoint
sets. What would close it is a line-structured, rhyme-bearing, post-1960
English corpus under an admissible licence. **No Tin Pan Alley, at all.**

---

## 7. Found on the way, in files this cell does not own

Full detail and commands in `scratchpad/cellBE/PATCHES-not-mine.md`.

1. **`lyric_harness.py:line_tokens` splits a word on any non-ASCII letter, and
   the harness scores the fragment.** `[A-Za-z'\-]+` is ASCII-only, so `ceäre`
   → `re`, `numberèd` → `d`, `outré` → `outr`. Executed:

   ```
   'While music wer a-soundèn.' vs "Wi' leafy boughs a-swaÿèn."   1.0 RHYME  scored on: n ~ n
   'my eyes can treäce'  vs  "...I don't ceäre"                   1.0 RHYME  scored on: ce ~ re
   ```

   **1,638 line ends, 19 of 143 files** — 1,521 in Barnes. The recorded hyphen
   defect was 174 and it is now a refusal; this is **9.4x larger and still a
   wrong answer**. `unread_final_piece` cannot see it because it inspects
   hyphen pieces only. Doctrine 95's own closing instruction is the one that
   was not followed: *when a defect is found in one layer, grep the others for
   the same shape before closing it.* This builder refuses all 1,635.

2. **`&c.`** — the printer's repeat-the-burden mark — is read as the end word
   `c`, 882 times over 19 authors, **line-final rank 5**. Refused here.

3. **`quality/revise.py`**: the `len(w) < 2` guard runs over `ranked[k:]` only,
   so a single-letter artifact can be FORBIDDEN while being un-offerable —
   reachable today (`l` for `will`, `r` for `floor`). The sibling owns it.

4. **`data/concreteness.txt` had no row in `data/sources.tsv`** and its
   upstream (`ArtsEngine/concreteness`) has **no licence file at all** —
   doctrine 92, silence is not permission. It is a live input to
   `quality/features.py` and `quality/within_item.py`. Row written; the
   feature question is not this cell's. Its `SUBTLEX` column was the obvious
   in-repo replacement for the web ranks and was **rejected on these grounds**
   — trading a contested dependency for an undetermined one is not a repair.

---

## 8. The battery moved under this cell, and a sibling owns it

Recorded, not chased and not repinned, per the brief.

```
python3 battery.py
```

See the run log at the end of this cell's report for the values observed. The
comparator's coda channel is being changed by a sibling this round and
`battery.py`'s pinned `1064/1014/50/81` was expected to shift. **Nothing in
this document depends on the battery**: every number here is measured over
`corpus/song/eng_*` end words and the `_field_one` predicate, neither of which
the sonnet oracle touches.

---

## 9. Files

**Written** (not committed):

| file | |
|---|---|
| `quality/build_song_frequency.py` | new — the builder, with the refusals declared |
| `quality/frequency.py` | extended — `eng-web`, `eng-spoken`, `eng-song`, `eng-verse`; `check_scoring`, `conditional()` |
| `data/song_endword_en.tsv` | new — 46,860 rows, line-final counts per author |
| `data/song_rhymepair_en.tsv` | new — 39,106 rows, the conditional per author |
| `data/opensubtitles_en_50k.tsv` | new — MIT, the register replacement |
| `data/sources.tsv` | 4 rows added, 1 rewritten (`wordfreq20k.txt`) |
| `quality/RESULTS_SONG_FREQUENCY.md` | this file |

**Not touched**: `lyric_harness.py`, `battery.py`, `quality/revise.py`,
`quality/redteam_band.py`, `quality/test_revise.py`, `quality/schemes.py`,
`quality/floor.py`, `quality/test_floor.py`, `quality/features.py`,
`MISSING.md`, `BACKLOG.md`, `CLAUDE.md`, and every file under `corpus/`.
