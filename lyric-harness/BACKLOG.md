# BACKLOG — everything we owe, ordered

Written 2026-08-11. `MISSING.md` is the gap REGISTER (what does not exist).
This is the WORK LIST (what to do about it, in what order, and why).

---

## 0. The adversary question, answered empirically

The claim was "we have 2 of 3 adversaries." That was wrong twice over: the
count is lower than 2 in one place and the denominator is higher than 3.

**Proof the third is not finished.** Mutation test, run 2026-08-11: revert the
head/tail alignment fix — the one made hours earlier, which changes the band's
verdict on **79.9% of unequal-length anchor pairs** — and run all 23 test files
plus the battery.

| mutation | detected? |
|---|---|
| **M1 · revert `channel_agreement` to head alignment** | **SURVIVED. Nothing caught it.** |
| M2 · `theta_rhyme` 0.75 → 0.50 | caught by `test_readability` |
| M3 · coda channel ignored entirely | caught by `test_band` |

So today's most consequential fix is **unprotected**, and the suite that
"passes" would pass identically with the bug back in. `redteam_band.py` found
the defect once, by hand, chasing one bad report line. Nothing stops it
returning.

**The adversary taxonomy, honestly counted:**

| # | attacks | status | instrument |
|---|---|---|---|
| 1 | our RESULTS — is the effect real? | **built** | line-permutation nulls, matched redeals, shuffled controls |
| 2 | the WRITING — is the draft any good? | **built** | `quality/revise.py` |
| 3 | the CODE's generosity — is the rule too loose? | **partial** | `quality/redteam_band.py`, band only |
| 4 | the TESTS — can the suite detect a broken harness? | **missing** | mutation testing. M1 above is the proof it is needed |
| 5 | the CORPUS — is the text what its header claims? | **ad hoc** | doctrines 50/52/53 were each found by hand, one file at a time |
| 6 | the TAXONOMY — does every named entry have a source? | **missing** | `gabay higaad` was reconstructed from our own modules and fed back as confirmation |
| 7 | the REPORT — do the number, the label and the evidence agree? | **missing** | `best_score` prints a score beside end words that did not produce it |

**Four to six of seven, not one of three.** Adversary 4 is the highest-value
item in this document, because it protects every other fix we will ever make.

---

## TIER 1 — blocks the next song. Do these first.

### 1.1 · Mutation testing (adversary 4) `NEW`
Kill M1. A small runner that applies N declared mutations to the comparator,
the band, the anchor rule and the scheme mandate, runs the suite, and FAILS if
any mutation survives. Start with the three above and grow the list every time
a defect is found by hand — a defect found by hand is a mutation the suite
should have caught.
**Acceptance:** M1 is caught. The runner is in CI-shaped form (`__main__`) and
its surviving-mutation list is empty or explicitly declared.

### 1.2 · `best_score` does not report which span won `M-17, OPEN`
`line_anchors` returns several candidate spans per line; `best_score` takes the
max; `check_scheme` prints the score beside `endwords[i]/endwords[j]`. When the
winner is an interior mosaic reach, **the report names a pair that had nothing
to do with the number** — `go/receipt 0.579 RHYME` was `get to go` ~ `ceipt`.
This is the original bad report line and it is still there. Doctrine 45.
**Acceptance:** every score carries the two spans that produced it, and
`check_scheme`/`brief` print them. Adversary 7's first instrument.

### 1.3 · `theta_nucleus` is a coin flip `OPEN`
`five`/`of` passes at nucleus similarity **0.603** against a threshold of
**0.600**. The held-out sweep says tightening it is a worse trade than the coda
fix was (2.7pp of true positives for 4.4pp of false), so it was left alone —
but "left alone" is not a decision. Options: a per-vowel-pair rule instead of a
scalar threshold, or accept and DECLARE that the nucleus channel is the loose
one.
**Acceptance:** either a change with a held-out price, or a written declaration
that 0.600 is chosen and what it costs.

### 1.4 · The revision loop cannot grade a song with no letter scheme
Doctrine 2 says the graph is the object and letter schemes are lossy
projections that sometimes do not exist — and the song written this week HAS no
letter scheme (21 maximal cliques, overlapping). `brief(lines, scheme=None)`
then passes **vacuously**: nothing declared, nothing mandated, "nothing
flagged". The loop only works on the structures the doctrine calls lossy.
**Acceptance:** `brief` accepts a declared PARTITION or `schemes.Cover`, not
only a letter string, and refuses loudly when given neither.

### 1.5 · Duplicate findings in the brief
`SHARED_SUFFIX` printed six times identically for one line. Cosmetic, one line
of code, actively obscures the real findings.

---

## TIER 2 — load-bearing defects with a measured cost

### 2.1 · `ltc.rhymes` uses the 詩 standard on 詞 `M-1`
Returns True on **47.4%** of positions the 欽定詞譜 of 1715 marks as rhymes. As
shipped it reports Li Qingzhao failing to rhyme. Tabulating the false verdicts
recovers the 詞林正韻 partition from practice alone. **Fix shape is known:**
`standard='pingshui'|'cilin'` as a declared coordinate, the move
`check_cynghanedd` made for `language`.

### 2.2 · `qieyun_mc.tsv` is keyed on one orthographic norm `M-2`
The character that NAMES the 魂 rhyme group cannot be looked up, while 477
characters carry 魂 as their label. **23 of the 24 commonest unreadable
characters are recoverable by an 異體字 map** to a variant already in the table;
the other five are vernacular characters postdating the rime book, where
refusal is correct — and nothing currently tells an ingestion defect from a
correct refusal.

### 2.3 · `msa.py`'s apostrophe rule causes 82% of its own unreadability `M-3`
384 of 471 Malay failures are the syncope split leaving a vowelless fragment
(`s'ri`, `t'ada`, `b'ras`). The module already ACCEPTS the identical process
spelled without the apostrophe (`prang`, `Brapa`).

### 2.4 · The `&c.` refrain stub is not an English convention `M-4`
Finnish `j. n. e.` is **100%** of that corpus's unreadable tokens; Malay
`d. s. b.` is **300 of 471**. Both are end-of-line, so the existing anchored
regex extends directly. Welsh makes it four languages.

### 2.5 · `RelationSchema.traditions` is declared on 77 schemas, populated on 0 `M-15`
So "Middle Chinese 同用 rhyme" and "pantun ABAB" fire on English and nothing can
say the rule shape matched while the tradition did not. Third inert coordinate
in that file after `Span.unit` and `SpanRule.terminator`. `requires` is
populated on only 17 of 77.

### 2.6 · `relations.py` counts have no matched control
`search_k` is carried on every span and **nothing consumes it**. `internal
rhyme` returns 18,290 instances on 200 lines of Poe. Doctrines 56/61 apply
directly and there is no null.

### 2.7 · `fin.py` implements alliteration and nothing else `M-6`
No `rhymes()`. Nine of the ten staged Finnish files are rhymed strophic verse
whose actual constraint the module cannot check.

### 2.8 · Five relations.py defects left OPEN by triage
`Span.unit` (needs the granularity ladder), `SpanRule.terminator` (duplicates
`magnitude`), chorus-stub line status, homograph knowledge sets, text-order
convention. All asserted as OPEN in the suite so closing one fails a test.

---

## TIER 3 — corpus and provenance

### 3.1 · The clean Chinese route `K-7`
4,347 ci and 734 樂府 refused on an express non-commercial grant. The unblock
route carries **no living copyright**: `kanripo/KR4j` 白文 (文淵閣四庫全書, 1782)
segmented by the 欽定詞譜 (1715). Needs a build; the pieces are all reachable.

### 3.2 · ZERO named airs across 8,009 non-English songs `M-11`
The field the whole sourcing round was chasing. The English corpus has 331 of
5,006. The Gītagovinda's rāga/tāla headings exist and are CC BY-**NC**-SA
(doctrine 92: the admissible copy and the complete copy are disjoint).

### 3.3 · The Persian edition gate is open on all 30 files `M-13`
`ganjoor.net` is egress-blocked and the per-book منبع note lives only there.
Also: `Erfi.epub` is a corrupt zip; 15 on-list poets have no ghazal section;
Bābā Ṭāhir's do-baytī (366 poems, a sung Luri form) is present and unstaged.

### 3.4 · Finno's 1583 hymnal — the cheapest open probe left
Sung by definition, printed four centuries ago, needs no rights argument, and
`doria.fi` / `kansalliskirjasto.fi` were **never probed**. A guess standing
where a measurement should be.

### 3.5 · The negative control is still Whitman alone `K-2, K-3`
All four recorded Whitman figures sit inside one line-permutation null. The
replacement is the corpus's own shuffled self plus a multi-author positive.

### 3.6 · Corpus adversary (adversary 5)
Systematise doctrines 50/52/53: a runner that checks every `corpus/` file
against its `sources.tsv` row — declared language vs measured readability,
md5 vs recorded, licence path vs actual path, and the channel-specific
orthography check that caught the Háttatal OCR.

---

## TIER 4 — instrument honesty

### 4.1 · The time layer's α is not controlled `L-1`
"5.4% against 5.0%" is n=6; at n=20 it is 9.6%. The guarding test runs three
sonnets and asserts only `mean < 0.20`, which cannot detect a 2× miss.

### 4.2 · Real sonnets do not separate from scrambled text on event rate `L-2`
10.9% observed vs 9.6% word-scramble, p=0.095. Until that separates, a null
placement result cannot distinguish "no periodic organisation" from "nothing to
organise."

### 4.3 · Taxonomy adversary (adversary 6)
Every named entry in `RHYME_CANON.md` and `relations.py` must cite a source
that is not this repo. `gabay higaad` was reconstructed from our own modules
and the truncation "converted an external check into a self-confirmation."
**Acceptance:** a runner that lists every name with no external citation.

### 4.4 · `rhyme_constraints.py` — 1,325 stranded lines
The only genuinely stranded module. Decision owed: mine its **knowledge sets**
(a `frozenset` per channel — the right shape for the homograph gap) into
`relations.py` and delete it, or give it a `__main__` and keep it as a
comparison runner.

### 4.5 · Doctrine has drifted to auditing `L-5`
**102 numbered doctrines**, and roughly half the recent ones are about null
hypotheses. A future session reading `CLAUDE.md` learns to audit rather than to
write. Needs a split: a short WRITING doctrine and a long METHOD appendix.

---

## TIER 5 — whole absent layers (`MISSING` B, C, D, G, H)

Not debt, not defects — **never built**. Listed so they are not mistaken for
either. No pitch layer at all (B-1). 12-TET assumed by omission (B-2). No
tempo (C-5). Sections have no FUNCTION (D-1). No syllable-to-beat mapping.
No hook. The floor has two length profiles and both are stanzas (L-4).

---

## Counters, so drift is visible

| | 2026-08-11 |
|---|---|
| MISSING entries OPEN / PARTIAL / BLOCKED | 53 / 11 / 3 |
| doctrines | 102 |
| stranded modules | 1 (1,325 lines) |
| surviving mutations | **1 of 3 tested** |
| `corpus/song/` files | 192 |
| `data/sources.tsv` rows | 311 |
| `data/lyricists.tsv` rows | 539 |
| sonnet battery | 81/1014 = 8.0% |
| band FPR on random pairs | 3.15% |
