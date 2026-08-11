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
| 4 | the TESTS — can the suite detect a broken harness? | **built** | `quality/mutate.py` — ~~30 mutations, 29 caught~~ **33 declared, all 33 applying cleanly**, 1 allowlisted equivalent (`M4`) with its premise tested; the CAUGHT count is a `--slow` measurement and is not recorded here (`python3 quality/counters.py --slow`) |
| 5 | the CORPUS — is the text what its header claims? | ~~**ad hoc**~~ **built** | `quality/audit_corpus.py` (landed `c661b93`), `quality/RESULTS_CORPUS_AUDIT.md`, regressions `quality/test_corpus_audit.py` — the by-hand era is doctrines 50/52/53 |
| 6 | the TAXONOMY — does every named entry have a source? | **built** | `quality/audit_register.py --provenance` |
| 7 | the REPORT — do the number, the label and the evidence agree? | ~~**missing**~~ **built** | `quality/audit_spans.py` (landed `a914dc0`), `quality/RESULTS_SPANS.md` — its first run: of 1,014 judged sonnet pairs, **382 report lines name a pair that did not produce the number** |
| 8 | the RECORD — do the documents agree with each other and with the code? | **built** | `quality/audit_register.py` — 7 consistency failures found and closed on 2026-08-11, 2 remaining and both deliberate; `quality/verify_entries.py` for the ENTRY CLAIMS the counters table never covered |

**EIGHT, not seven, and the file used to say both.** ~~Four to six of seven, not
one of three.~~ ~~adversaries 1–7 all attack the WORK~~ — the table has had
**eight** rows since the eighth was added, and three places in this one file
still counted seven: the sentence above, the counters row `adversaries built, of
7`, and the summary. One roster, two denominators, and nothing was checking.
`python3 quality/verify_entries.py` now reads the **instrument column** of this
table — `quality/audit_corpus.py` and `quality/audit_spans.py` either exist or
they do not — which is the checkable half of a row whose STATUS column stays a
judgement (`quality/counters.py` refuses that column for exactly that reason,
and still does). **That is the boundary, and it runs through the middle of a
single row.**

~~Adversary 4 is the highest-value item in this document~~ — it is **built**,
and the eighth was not on the list when the list was written. **Adversary 8 is
the one that found four false entries in a week**, and the argument for it is
that adversaries 1–8 all attack the WORK or the RECORD of it while, until
2026-08-11, nothing attacked the ENTRIES. Its cheapest pass costs under a
second: `python3 quality/audit_register.py --consistency`, no corpus, no
imports. **Remaining: none of the eight is `missing`; 3 is still `partial`
(`redteam_band.py` attacks the band only).**

---

## TIER 1 — blocks the next song. Do these first.

### 1.1 · Mutation testing (adversary 4) `DONE 2026-08-11`
Kill M1. A small runner that applies N declared mutations to the comparator,
the band, the anchor rule and the scheme mandate, runs the suite, and FAILS if
any mutation survives. Start with the three above and grow the list every time
a defect is found by hand — a defect found by hand is a mutation the suite
should have caught.
**Acceptance:** M1 is caught. The runner is in CI-shaped form (`__main__`) and
its surviving-mutation list is empty or explicitly declared.
**MET.** `quality/mutate.py` declares ~~**30** mutations; **29 are caught**~~
**33 mutations, all 33 applying cleanly to the current source**
(`python3 quality/mutate.py --dry-run`), including M1 and M30. The one survivor
is **M4, proved equivalent rather than missed**, allowlisted in
`quality/test_mutation.py` with the proof — and the allowlist entry's premise is
itself under test, since M11 mutates the `cluster_sim` line M4's equivalence
depends on and is caught.
**The CAUGHT count is deliberately not written down here.** It forks the whole
suite once per mutation, so `quality/counters.py` REFUSES it on the cheap path
for COST and reaches it with `python3 quality/counters.py --slow`. A number that
costs money to check is exactly the number that gets copied forward instead of
re-derived — which is how `30 / 29` survived three mutations being added.
**And the three coordinates declared on 2026-08-11 — `scalar_alignment`,
`nucleus_agreement`, `nucleus_licence_unstressed_only` — now have M31/M32/M33,
each caught by the file that declares it.** A new coordinate with a default is a
new place for a silent drift; it belongs in the list so that stays true.

### 1.2 · `best_score` does not report which span won `M-17, OPEN`
`line_anchors` returns several candidate spans per line; `best_score` takes the
max; `check_scheme` prints the score beside `endwords[i]/endwords[j]`. When the
winner is an interior mosaic reach, **the report names a pair that had nothing
to do with the number** — `go/receipt 0.579 RHYME` was `get to go` ~ `ceipt`.
This is the original bad report line and it is still there. Doctrine 45.
**Acceptance:** every score carries the two spans that produced it, and
`check_scheme`/`brief` print them. Adversary 7's first instrument.

### 1.3 · `theta_nucleus` is a coin flip `CLOSED 2026-08-11`
`five`/`of` passes at nucleus similarity **0.603** against a threshold of
**0.600**. ~~The held-out sweep says tightening it is a worse trade than the
coda fix was (2.7pp of true positives for 4.4pp of false), so it was left alone~~
— but "left alone" is not a decision. Options: a per-vowel-pair rule instead of a
scalar threshold, or accept and DECLARE that the nucleus channel is the loose
one.
**Acceptance:** either a change with a held-out price, or a written declaration
that 0.600 is chosen and what it costs.

**CLOSED by declaration, and the REASON changed.** Shipped: the second option,
made mechanical. `theta_nucleus` is unchanged at 0.600;
`Declaration.nucleus_agreement` declares the SHAPE with `identity` and
`licensed` reachable and an undeclared value raising; `quality/test_nucleus.py`
prints the enumerated 40-of-105 cut and pins `five`/`of` at 0.603 and
`bed`/`bead` at 0.758 as the declared cost.

**Not "a worse trade" — the trade cannot be computed on this corpus.** Of the 31
mandated pairs a 0.60 → 0.70 tightening newly refuses, the syllable pairs
partition with no remainder: 28 a stressed vowel difference (gone/alone,
tongue/song, have/grave, blood/good — correct refusals in the declared dialect),
6 CMUdict writing one reduced vowel two ways, 1 a promotion, and no fourth
category. The sonnet violation rate prices the **`dialect`** coordinate on this
channel, not the threshold.
**NEW ENTRY OWED AND WRITTEN: `MISSING.md` M-19** — a true-positive corpus in
the declared dialect, which this repo does not have. Doctrine 44: "cannot
obtain", not "hard to build".

### 1.4 · The revision loop cannot grade a song with no letter scheme `CLOSED 2026-08-11`
Doctrine 2 says the graph is the object and letter schemes are lossy
projections that sometimes do not exist — and the song written this week HAS no
letter scheme. `brief(lines, scheme=None)` then passed **vacuously**: nothing
declared, nothing mandated, "nothing flagged". The loop only worked on the
structures the doctrine calls lossy.
**Acceptance:** `brief` accepts a declared PARTITION or `schemes.Cover`, not
only a letter string, and refuses loudly when given neither.

**MET.** `python3 lyric_harness.py brief examples/never_been_to_a_scene.txt`
with no mandate prints a REFUSAL and **exits 2**; `--cliques` and
`--groups=1,3;2,4` both take. `Reviser.mandate_from_graph` returns a `Cover`
marked `source=derived` and NOT INDEPENDENT of the grader (doctrine 14).

> **~~21 maximal cliques, overlapping~~ — the figure was never a clique count,
> and the correction has to say so or it is just a fresher wrong number.**
> Re-derived 2026-08-11 by running the code of the commit that wrote this line
> (`6c265ad`, `theta_coda=0.60`, before the head/tail alignment fix) against the
> song file of that commit: **18 cliques and 21 OVERLAPPING NODES**. So `21` was
> the PIVOT count — the lines belonging to more than one clique — carrying the
> word "cliques". Two quantities from one call, and the wrong one was written
> down. At the shipped `theta_coda=0.80`,
> `python3 lyric_harness.py graph examples/never_been_to_a_scene.txt` reports
> **8 maximal cliques and 1 overlapping node** (L27, `ones`, in cliques 3 and 7).
> Calibrating `theta_coda` 0.60 → 0.80 on 2026-08-11 removed 20 of the 21 pivots.
>
> **AND THERE ARE TWO CLIQUE COUNTS ON THIS SONG, BOTH CORRECT.** `brief
> --cliques` reports **12 groups and 5 pivots** on the same 41 lines, because
> `Reviser.mandate_from_graph` builds its cover with `promote=True` and admits
> REPEAT edges, while `rhyme_graph` reads anchors with `promote=False` and does
> not — a divergence `revise.py` states in its own docstring and defends, since
> deriving a cover under one setting and grading it under the other would make
> the cover an approximate fixed point of the grader. Doctrine 91: the count is
> a coordinate of the RENDERING. **Never quote a clique count for this song
> without naming which of the two produced it.**

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
characters carry 魂 as their label. ~~**23**~~ **19 of the 24 commonest
unreadable characters are recoverable by an 異體字 map** to a variant already in
the table — re-derived character by character against `data/qieyun_mc.tsv`:
19 of 19 have the source absent and the variant present, and all five of the
remainder are absent as the "correct refusal" reading requires. 23 + 5 = 28 > 24
and nobody had added it up (M-2, check C3);
the other five are vernacular characters postdating the rime book, where
refusal is correct — and nothing currently tells an ingestion defect from a
correct refusal.

### 2.3 · ~~`msa.py`'s apostrophe rule causes 82% of its own unreadability~~ **17%** `M-3` — `CLOSED 2026-08-11`
~~384 of 471 Malay failures are the syncope split leaving a vowelless
fragment~~ — **79 of 471**, re-derived 2026-08-11. 384 is the before-fix count
of vowelless tokens and only 79 of them came from the syncope split (`s'ri`,
`t'ada`, `b'ras`); the other 305 are whole tokens the rule never touched, and
they are the `d. s. b.` stub of §2.4. The arithmetic was right and the
ATTRIBUTION was not. The module already ACCEPTS the identical process spelled
without the apostrophe (`prang`, `Brapa`). **The fix is shipped and this line is
now a record, not a task.** `MISSING.md` M-3 has read `CLOSED` since 2026-08-11
and this heading did not say so, so the two files disagreed about whether a TIER
2 item was still owed — caught by `python3 quality/verify_entries.py`, shape
`STATUS_XREF`.

### 2.4 · The `&c.` refrain stub is not an English convention `M-4`
Finnish `j. n. e.` is **100%** of the two Kanteletar files' unreadable tokens
(16 tokens on 8 stub lines, CONFIRMED to the token); Malay `d. s. b.` is
**305 of 471** — the row that was withdrawn on 2026-08-11 and reinstated the
same day, because the withdrawing grep read the 129-block staged extract while
the claim was about the 705-block source (`M-18`). Both are end-of-line, so the
existing anchored regex extends directly. Welsh makes it four languages.

### 2.5 · ~~`RelationSchema.traditions` is declared on 77 schemas, populated on 0~~ — **75 of 77 populated** `M-15`
~~populated on 0~~. Measured by `python3 quality/audit_register.py --provenance`
(derivation D21): **77 schemas, 75 carrying traditions, 298 distinct `Tradition`
rows over 319 attachments**. The two with no tradition at all are `blues AAB
stanza` and `refrain by reference`.
**`MISSING.md` M-15 already recorded this and §2.5 did not**, so the two
documents disagreed with each other over one field — adversary 8's exact remit,
and the reason `python3 quality/verify_entries.py` exists.
**What is still owed is not population but WITNESS**: of the 298 rows, 212 are
externally witnessed, 26 are this project's own and 60 cannot be told — three
counts, doctrine 79 — and that is `MISSING.md` M-15a, still `OPEN`. The original
complaint stands only in the sense that "Middle Chinese 同用 rhyme" firing on
English was never the population problem it was written up as. `requires` is
populated on only 17 of 77 and that half is unchanged.

### 2.6 · `relations.py` counts have no matched control
`search_k` is carried on every span and **nothing consumes it**. `internal
rhyme` returns 18,290 instances on 200 lines of Poe. Doctrines 56/61 apply
directly and there is no null.

### 2.7 · ~~`fin.py` implements alliteration and nothing else~~ — BOTH SENTENCES WERE FALSE `M-6`, `CLOSED 2026-08-11`
~~No `rhymes()`. Nine of the ten staged Finnish files are rhymed strophic verse
whose actual constraint the module cannot check.~~
**This item was never true at the commit that wrote it, and on 2026-08-11 a cell
was briefed off it and sent to build a relation that already existed.**
`Finnish.rhymes()` landed at `f94383c`, whose own commit title is *"two of my own
MISSING entries were false"*; and `ls corpus/song/fin_*.txt | wc -l` returned
**11** at `debf64e`, not ten, with `fin_jaakko_juteini.txt` measuring a HIGHER
Kalevala-metre alliteration excess than the Kanteletar itself. The corpus half
is VOLATILE — other cells write that directory — so it is pinned to a commit and
re-derived rather than recorded. Full account in `MISSING.md` M-6 and
`quality/RESULTS_FIN_RHYME.md`; the instrument that would have caught it is
`python3 quality/verify_entries.py`, shapes `SYMBOL_ABSENT` and
`STAGED_FILE_COUNT`.

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

### 3.2 · ZERO named airs across EVERY non-English song staged `M-11` — AND THE FIELD IS NOT DECLARED
The field the whole sourcing round was chasing. ~~The English corpus has 331 of
5,006.~~ ~~8,009 non-English songs~~ — **the denominator has moved and the ZERO
has not**, which is why this heading no longer carries one: `M-11` records the
per-prefix table, measured at run time, and the 0 is the finding and does not
depend on it. **There is no `--- AIR:` marker anywhere in `corpus/song/`.** The
declared markers are TITLE, SOURCE, AUTHOR, GE, RHYME, JU, SECTION, JUAN, RIME,
SYLLABLES, FROM, NOTE. The 331 reproduces exactly and is a **substring count** —
TITLE strings containing the word "air" anywhere, which includes *"The Birds Of
The Air"*. The figure the corpus supports is **318**, the `[air: NAME]`
convention, with a 13-title residue that is 9 ordinary uses of the noun and 4
airs under other conventions. **So the rarest field in the corpus is the one
field the corpus does not declare, and neither the 331 nor M-11's zero is
re-derivable until `--- AIR:` exists.** Declaring it is a one-line change to the
stagers and it makes two recorded numbers checkable.
The Gītagovinda's rāga/tāla headings exist and are CC BY-**NC**-SA
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

### 3.6 · Corpus adversary (adversary 5) `BUILT 2026-08-11`
Systematise doctrines 50/52/53: a runner that checks every `corpus/` file
against its `sources.tsv` row — declared language vs measured readability,
md5 vs recorded, licence path vs actual path, and the channel-specific
orthography check that caught the Háttatal OCR.
**MET**, at `c661b93`: `quality/audit_corpus.py`, results in
`quality/RESULTS_CORPUS_AUDIT.md`, regressions in
`quality/test_corpus_audit.py`. Its first run found that **42.3% of the
Coleridge file is Wordsworth**. §0's row said `ad hoc` for a week after it
landed — the STATUS column is a judgement and stays one, but the instrument
column is a path and `python3 quality/verify_entries.py` now checks it.

---

## TIER 4 — instrument honesty

### 4.1 · The time layer's α is not controlled `L-1` — CAUSE FOUND, STILL OPEN
~~"5.4% against 5.0%" is n=6; at n=20 it is 9.6%.~~ The guarding test runs three
sonnets and asserts only `mean < 0.20`, which cannot detect a 2× miss.

**The n=6 was the smaller of two defects.** `rhyme_events` measured each
position's Šidák family over the pairs that PASSED the band (median 6–13), not
over the comparisons made (89 on a quatrain, 176–265 on a sonnet), so neither
5.4% nor 9.6% was a false-event rate at the declared α. **`RESULTS_FWER.md`'s
headline is void.** All four `test_fwer.py` assertions pass again with every
constant replaced by the quantity it stood in for — saturation by `1−(1−r)^m`
from the measured per-pair FPR, the α tolerance by `α + 2 s.e.` over 1,321 slot
decisions (n=20, 6.2%, which CAN detect the 2× miss), the band-pass guard by 2×
the measured max over 30 real sonnets.
**Still open, and the open part moved:** at the honest family the layer cannot
produce an event at all — at `null_samples=2000` the Šidák cut (2.5e-4) sits
BELOW the p-value floor (5e-4). **Owed: `null_samples` and `window`, measured
against the candidate family.** Not a corpus, and not a fourth instrument.

### 4.2 · Real sonnets do not separate from scrambled text on event rate `L-2` — MECHANISM FOUND
~~10.9% observed vs 9.6% word-scramble, p=0.095.~~ Until that separates, a null
placement result cannot distinguish "no periodic organisation" from "nothing to
organise."

**And it can never separate, because the word scramble is an identity map for
this statistic.** At 20 items per arm the two score identically — 29.1% vs 29.0%
at `m` = scored, 0.0% vs 0.0% at `m` = candidate — because an item's smallest
attainable p is set by how many chance re-pairings of ITS OWN spans are perfect
rhymes, and a word scramble preserves the span multiset exactly. Doctrine 63/68
in a fourth place. **Owed: a null that destroys the span multiset — across items
rather than within one.**

### 4.3 · Taxonomy adversary (adversary 6) `BUILT 2026-08-11`
Every named entry in `RHYME_CANON.md` and `relations.py` must cite a source
that is not this repo. `gabay higaad` was reconstructed from our own modules
and the truncation "converted an external check into a self-confirmation."
**Acceptance:** a runner that lists every name with no external citation.
**MET.** `python3 quality/audit_register.py --provenance` lists them. Every
figure below is that runner's current output; the struck ones are what this
section recorded and are kept because two of the four moved for a reason inside
the runner rather than inside the canon.
- **117 named structures**, of which ~~117~~ **112** carry no external citation
  *in the §2 block itself* — that detector reads a year or one of six repo names
  and does not see the `- witness:` lines, and §4b is the repair's measure.
- ~~611~~ **781** `from:` references over **594 distinct indices**, counted
  MULTI-LINE. The 611 is the single-line rule, and the runner names it **as its
  own doctrine-58 error** rather than quietly replacing it.
- ~~0~~ **25** publication-year tokens in the file — the 0 was the sharpest
  single finding here and it has been repaired.
- **19** names whose only witness is this project, superseded by §4b:
  `quality/canon_index.tsv` declares **601** indices and **116 of 117** named
  structures now reach a witness outside this project, 1 reaches none.
- `relations.py` hangs **298 `Tradition` rows over 319 attachments** off 77
  schemas, of which 75 carry traditions. ~~every `Tradition.source` is an `R<n>`
  pointer~~ — **212 are externally witnessed, 26 are this project's own, 60
  cannot be told**, three counts and not a rate (doctrine 79).

**The gap it found is now `MISSING.md` M-15a and is OPEN**; the runner is done,
the repair is partial.

### 4.4 · ~~`rhyme_constraints.py` — 1,325 stranded lines~~ `DECIDED 2026-08-11`
~~The only genuinely stranded module.~~ `quality/rhyme_constraints.py` is **1,609 lines** (~~1,566~~ — the inert-coordinate cell added the `Span.unit` and `Span.terminator` docstrings, which is growth in the file's OWN account of why it is kept).
It has an `if __name__ == "__main__"` and non-test callers.
(The line count is now stated in a sentence naming exactly ONE module, because
`python3 quality/verify_entries.py`'s `MODULE_LINE_COUNT` shape REFUSES a count
whose module is ambiguous and the previous phrasing named three in one breath.
The 1,566 is `wc -l` and `str.splitlines()`, which agree. `audit_register.py`
D22 prints **1,567** for the same file: it computes `src.count("\n") + 1`, which
counts a phantom final line whenever a file ends in a newline. That is an
off-by-one in the auditor, not a drift in the module, and it is written up in
this cell's `PATCHES-not-mine.md` rather than patched from here.) **Both branches were taken, and the file says which and
why:** the knowledge sets are mined into `relations.py` — `Syllable` fields may
now each hold a scalar or a `Readings` frozenset, with the TYPE as the marker so
there is no flag to forget — **and** the module is kept as a comparison runner
on a stated argument. Its P6 defect (`apply_pred`'s `PRESENT_ON` testing
whole-channel emptiness) is deliberately left unfixed, because patching it to
agree would spend the only property that justifies keeping it. That is the shape
a "keep it" decision has to have.

### 4.5 · Doctrine has drifted to auditing `L-5` — `DONE 2026-08-11`
~~**102 numbered doctrines**~~, and roughly half the recent ones are about null
hypotheses. A future session reading `CLAUDE.md` learns to audit rather than to
write. Needs a split: a short WRITING doctrine and a long METHOD appendix.

**DONE**, in commit `d11ca0a` ("Split the doctrine file: 20 for writing, 75 for
method, numbering intact"). ~~In progress~~ — **95** doctrines, **20** in
`CLAUDE.md` and **75** in `quality/METHOD.md`, one global non-contiguous
numbering so `doctrine 79` is still doctrine 79, checked by
`python3 quality/verify_doctrines.py` across 2,090 citation sites.

> **~~102 (27 + 75)~~ — where the 102 came from, because the arithmetic is the
> lesson.** `CLAUDE.md` carries TWO numbering systems that do not collide: the
> doctrine run, and a `Known gaps` list of 7 cited elsewhere as `known gap N`.
> Both are written `^\d+\. \*\*`, so a bare regex over the file returned **27**
> where the doctrine block holds **20**, and 27 + 75 = 102. Two runs added
> together as if they were one. The fix is not a better regex — both files
> delimit their run with `<!-- DOCTRINE-BLOCK -->` markers precisely so a
> counter can tell the lists apart, which is what `verify_doctrines.py` reads
> and what `quality/counters.py` calls rather than re-parsing.

### 4.6 · The ENTRY CLAIMS of this file and `MISSING.md` `BUILT 2026-08-11`, and mostly UNCHECKED
`quality/counters.py` made the table at the foot of this file an OUTPUT. **The
counters were fixed and the ENTRIES were not**, and the cost was measured: a
cell was briefed off §2.7 / `MISSING.md` M-6 on 2026-08-11 and sent to build a
relation that had shipped at `f94383c`.

`python3 quality/verify_entries.py` is the fourth instance of this repo's one
working move — `verify_doctrines.py`, the `wiring` verb, `counters.py`, this —
and it is deliberately SMALL. It carries **eight declared claim SHAPES**
(`SYMBOL_ABSENT`, `HASATTR`, `REPO_PATH_EXISTS`, `STAGED_FILE_COUNT`,
`MODULE_LINE_COUNT`, `CORPUS_MARKER_ABSENT`, `CORPUS_TABLE_ROW`,
`STATUS_XREF`), reads statuses by CALLING `counters.missing_entry_statuses()`
rather than re-parsing them, and reports `audit_register.py`'s 26 derivations
without re-deriving one of them.

**What is still owed is the refused count, and it is the honest headline.** At
commit `ad7edca` it asked **881** claims, answered **81** and refused **800** —
every one of the refusals `NO_SHAPE`, meaning no declared shape recognises the
sentence. **Those three counts move with every entry anyone writes**, so they are
pinned to a commit here and re-derived by running the command, never read off
this page. That number is not a defect to be optimised away. Some of that
remainder is not mechanically checkable at all (doctrine 6's "the exchange rate
between surprise and clarity is not derivable" has no instrument and never
will), and the checker deliberately does NOT try to separate "unshaped because
it is a judgement" from "unshaped because nobody wrote the shape yet", because
that separation needs a reader. **The way to bring the number down is to declare
another shape, never to loosen one.** Candidates the sweep already surfaced:
a claim of the form "N of M rows in `data/*.tsv`", a table whose row count
contradicts the sentence introducing it, and a `%` stated without its
denominator.

**Acceptance, met:** non-zero exit on a false claim; three counts, never a rate;
every shape carries a TRUE probe and a FALSE probe so a clean run is a null with
a positive control behind it (doctrines 31, 76); a shape matching no live
segment is printed `[dead]` rather than passing quietly (doctrine 28).

---

## TIER 5 — whole absent layers (`MISSING` B, C, D, G, H)

Not debt, not defects — **never built**. Listed so they are not mistaken for
either.

**STILL ABSENT, verified 2026-08-11.** No pitch layer at all (B-1) — `grid.py`,
`meter.py` and `fit.py` between them expose no pitch, scale, mode or tuning
object. 12-TET assumed by omission (B-2). No tempo (C-5), which `fit.py` states
in its own refusal: *"a note DURATION is not [a coordinate], because there is no
tempo"*. The floor has two length profiles and L-4 records what they are.

**MOVED OUT ON 2026-08-11 — three absences that were FILLED and stayed on the
list.** This section exists so absences "are not mistaken for" debt or defects.
An absence that has been filled and is still listed inverts that: it makes the
one section that is supposed to be trustworthy about what does not exist the
section that is wrong about it. History kept, per `MISSING.md`'s own rule that a
filled entry is marked, never deleted.

| ~~absent~~ | what closed it | landed |
|---|---|---|
| ~~Sections have no FUNCTION (D-1)~~ | `Section.function`, a coordinate distinct from `Section.name`; the `function` verb REFUSES rather than reading `"chorus"` out of a name, and reports asked / answered / refused | `7e802d3` (field first at `d944ff7`) |
| ~~No syllable-to-beat mapping~~ | `quality/fit.py` and the `fit` verb — syllables against the pulses of the bar they are declared in, with `--subdivision` a DECLARED coordinate that has no default | `90df738` |
| ~~No hook~~ | `grid.Hook`, `hook_occurrences`, `hook_findings`, reached by the `function` verb; a hook is a FRAGMENT the writer names, and an undeclared one REFUSES | `7e802d3` |

**Verify, do not take this table's word for it:**
`python3 lyric_harness.py function examples/never_been_to_a_scene.blueprint.json`
prints `asked 3  answered 0  refused 3` and three `REFUSED` lines — the
capability is built and that blueprint declares none of it, which are different
facts. `python3 lyric_harness.py fit examples/never_been_to_a_scene.blueprint.json
--subdivision 2` prints the per-section slot table.

---

## Counters, so drift is visible

**This table is OUTPUT. Do not edit it by hand.**

```
python3 quality/counters.py            # measure and print
python3 quality/counters.py --check    # FAILS if the table below is stale
python3 quality/counters.py --write    # regenerate it
```

Every row is derived by measurement and `quality/counters.py` states the
derivation beside each one. A row it cannot measure REFUSES and says which of
the two reasons applies — JUDGEMENT (no measurement exists; somebody sets the
status) or COST (a measurement exists and this run declined to pay for it) —
rather than printing a number. Asked, answered and refused are three counts,
never one (doctrine 79).

> **Why it is output.** The hand-maintained version of this table had drifted in
> four places at once, and re-typing the values would have been the same defect
> with fresher numbers (doctrine 48). What each error was, and why:
>
> - `doctrines | 102 (27 in CLAUDE.md, 75 in quality/METHOD.md)` — **95 (20 + 75)**.
>   `CLAUDE.md` carries two numbering systems written in the same markdown shape,
>   the doctrine run and a 7-item `Known gaps` list cited as `known gap N`. A bare
>   `^\d+\. \*\*` counted 20 + 7 = 27 and called them all doctrines. §4.5.
> - `MISSING entries ... | 53 / 10 / 2 / 7 (73 entries)` — the row **contradicted
>   itself in its own cell**: 53 + 10 + 2 + 7 = **72** against a stated total of
>   73, and nobody had added it up. **The parts and the total came from two
>   different rules**, which is why they could disagree and stay unnoticed.
>   Reproduced exactly on 2026-08-11: a status regex run over the HEADING LINE
>   ONLY returns `53 / 10 / 2 / 7`, total 72 — because `L-3`'s heading wraps and
>   its `PARTIAL` sits on the next line, so the entry is dropped from every
>   bucket while a separate `grep -c '^### '` correctly says 73.
>   **Both obvious repairs are also wrong**, in opposite directions: reading the
>   LAST status token over the wrapped block flips `C-2` from `PARTIAL` to `OPEN`,
>   because `C-2`'s continuation line ends `catalogues do not \`OPEN\``. Only the
>   FIRST token over heading-plus-continuation is right, and `counters.py` states
>   that rule, RAISES if the parts do not reconcile with the total, and prints
>   them AS a sum so the arithmetic is on the page. The live values are in the
>   table and are deliberately not repeated here, because a number restated in
>   prose beside its own counter is the next thing to drift.
> - `band FPR ... | 3.57% (107/3,000 at seed 20260810)` — not wrong, and not
>   reproducible from its own command: `redteam_band.py` defaults to n=4,000 and
>   prints **3.60%**. The seed was written down and the POPULATION SIZE was not
>   (doctrines 58 and 91). Both n are measured now, so neither can be quoted alone.
> - `corpus/song/ files | 258`, `sources.tsv | 386`, `lyricists.tsv | 539` —
>   transcriptions as-of-a-date of quantities that move whenever a corpus cell
>   runs. All three were stale within the day. They carry **no number here at
>   all** now, only the command; `--check` enforces the absence. A number you know
>   is moving does not belong in a file that is read as a record.
>
> The two that were RIGHT and were checked anyway: the sonnet battery
> (`81/1014`, `mandated 1064, judged 1014, refused 50`) and the mutation count
> (**33 declared, 32 caught, 1 allowlisted**, confirmed by a full sweep on
> 2026-08-11). Confirming a number costs the same as catching one, and a table
> whose passing rows were never re-run is a table nobody has checked.

<!-- COUNTERS -->
| counter | measured | measured by |
|---|---|---|
| MISSING entries by status | 50 OPEN / 13 PARTIAL / 2 BLOCKED / 10 CLOSED = 75 entries | `python3 quality/counters.py` |
| doctrines | **95**, a contiguous run 1–95 with no number in both files (20 in `CLAUDE.md`, 75 in `quality/METHOD.md`) | `python3 quality/verify_doctrines.py` |
| stranded modules | **0** — every production module is imported or has a `__main__`; `rhyme_constraints.py` is 1,609 lines with a `__main__` and 1 non-test caller (`relations.py`), so it is kept on an argument and the DECISION is still owed (M-16) | `python3 lyric_harness.py wiring` |
| mutations declared | **33 declared, 1 allowlisted equivalent** (M4 — and the allowlist entry's PREMISE is itself under test) | `python3 quality/counters.py` |
| mutations caught | REFUSED (cost) — not measured on the cheap path | `python3 quality/test_mutation.py` |
| `corpus/song/` files | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| `corpus/song/eng_*` — K-1's own quantities | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| `data/sources.tsv` rows | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| `data/lyricists.tsv` rows | MEASURED AT RUNTIME — `python3 quality/counters.py` | `python3 quality/counters.py` |
| sonnet battery | 81/1014 = 8.0% violations (`mandated 1064, judged 1014, refused 50`) | `python3 battery.py` |
| band FPR on random pairs | **3.60%** (144 of 4,000 at seed 20260810, the runner's own default n; 3.57% = 107 of 3,000 at n=3,000 — the population size is a coordinate) | `python3 quality/redteam_band.py` |
| register-audit findings | **2** — D8 (M-4), D9 (M-4); both are the deliberate M-4 calibration pair | `python3 quality/audit_register.py` |
| adversaries built, of 8 | REFUSED (judgement) — `built` / `partial` / `ad hoc` / `missing` in §0 are statuses a person sets; no measurement distinguishes them (the INSTRUMENT column is checkable and `quality/verify_entries.py` checks it) | `read BACKLOG.md §0` |
<!-- /COUNTERS -->

> **The register-audit row was 9 findings on 2026-08-11** before seven were
> closed; the two that remain are deliberate.

> **"surviving mutations 1 of 3 tested" was the state of §1.1 before it was
> done.** The harness now declares **33** mutations and catches 32 — M31/M32/M33
> cover the three coordinates declared on 2026-08-11 (`scalar_alignment`,
> `nucleus_agreement`, `nucleus_licence_unstressed_only`). The one
> survivor is **M4, proved EQUIVALENT rather than missed**: dropping
> `channel_agreement`'s `not ca and not cb` clause ought to delete every
> open-syllable rhyme in English and deletes nothing, because `cluster_sim`
> opens with its own `if not a and not b: return 1.0`. It is allowlisted in
> `test_mutation.py` with the proof, and the allowlist entry's PREMISE is itself
> tested — M11 mutates the `cluster_sim` line and is caught, so M4 stops being
> equivalent the moment that line moves. An allowlist that outlives its reason
> is a licence nobody re-read.
>
> **Do not run `for f in quality/test_*.py`.** `test_mutation.py` matches and
> forks a 30-mutation sweep.
