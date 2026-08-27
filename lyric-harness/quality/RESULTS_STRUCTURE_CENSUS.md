# Results — the structure census, run 1: English

Protocol: `quality/STRUCTURE_CENSUS_PREREGISTRATION.md`, committed with the
instrument before any number below existed (`git log` shows the order).
Artifact: `data/structure_census_eng.tsv`, 16,530 cells, md5
`7d4daf7928cf7c973fdea04e17d06088`. Measured 2026-08-18 over the declared
population: 143 `eng_*` song files (4,930 items), `sonnets.txt` (152
items through the oracle's own reader), `whitman.txt` (the 150-line
negative-control slice). 57 catalog rows × 2 populations × 145 files.

> **THE COMMAND NO LONGER REPRODUCES THE ARTIFACT — DISCLOSED 2026-08-21, and
> nothing here is withdrawn.** `corpus_files()` globs `corpus/song/eng_*.txt`
> at run time, and that glob has gone from the **143 files / 4,930 items**
> declared above to **1,297 files / 8,667 items** at head. So re-running the
> shipped command today does not re-derive md5 `7d4daf79…` — it would
> **silently census a 9× population under run 1's filename**, which is the
> `M-21` shape with a corpus underneath it instead of prose.
>
> ~~**Every figure in this document is PINNED TO ITS ARTIFACT and stands**~~
> **STRUCK 2026-08-26 — TRUE OF EVERY FIGURE BUT ONE, AND THE EXCEPTION IS THE
> ONE THIS BOX EXISTS TO WARN ABOUT.** Every figure derived from
> `data/structure_census_eng.tsv` is pinned to it and re-derives forever — all
> 36 of them re-derived 2026-08-26 in 0.26s with zero drift: the md5 is the
> address, the file is committed, and a claim about a fixed table re-derives
> forever. **§D1 IS NOT ONE OF THEM.** `d1_diagnostic()` re-globs
> `corpus/song/eng_*.txt` at RUN TIME, so D1's population is the live tree and
> not the artifact — and it moved, by 84.2%. See §D1's own strike below. The
> sentence written to reassure a reader that the glob drift this box warns
> about was harmless is precisely the sentence that hid the one place it was
> not.
> What has to move is the RUN-2 registration, which must
> say which `eng` population it means rather than inheriting a glob —
> `data/calibration_manifest.tsv` is the mechanism that exists for exactly this
> and is why it exists — **though NOT AS IT STANDS (measured 2026-08-26): its
> snapshot was taken 2026-08-22, AFTER the growth below, and it asks
> `structure_census.corpus_files()` for its population, which answers with the
> LIVE glob. So it reads green over a population the artifact never measured.**
> Run 2 also owes an `eng` re-census if it wants an
> English null that describes the live tree; ~~that is ~11 core-hours~~
> **MEASURED 2026-08-26 at 6.8 core-hours** (24,389 judge calls/s over
> 599,682,180 calls — the estimate was conservative, not falsified) and is a
> separate decision from the cross-tradition arm, which is under 1.
>
> **AND THE REGISTRATION'S WORLD-SHAPE PROMISE IS NOT KEPT BY THE CODE** —
> `MISSING.md` `M-22`. The judge layer is genuinely language-neutral (0
> exceptions over ~~7~~ **9** phonologies — REPINNED 2026-08-26, 57 rows × 9
> declared phonologies = 513 calls, 0 exceptions, and NINE were already
> registered on the day "7" was written, so that figure never held) and
> ~~`pair_counters` tokenises with an
> ASCII-only reader that shreds `fin`/`san` and empties `ltc`/`fas`~~
> **STRUCK 2026-08-26 — REPAIRED 42 MINUTES AFTER THIS BOX WAS COMMITTED**
> (`77b5b10` gave `pair_counters` a declared per-language tokeniser table and a
> refusal for languages without one; `1580d11` moved `line_tokens` itself onto
> the declared `LATIN_SCRIPT` repertoire). Kept because it is the reason that
> table exists, not because it is still true (doctrine 17). That is
> the defect that voided Kalevala run 1, latent here because the glob has never
> reached a non-Latin file.

**Scale, three counts, never summed (doctrine 79):** 417,020,664 pair
judgings — 4,319,257 endword-cross and 2,996,895 word-within-line pairs,
each asked 57 questions — of which **7,710,997 TRUE**, **233,898,661
FALSE**, **175,411,006 REFUSED**. Rates below are judged-base only.

Run notes: pilot 310s (7 files); full run in 8 shards; the per-file dedup
memo is the registered rule and was byte-verified against the no-dedup arm
(`--dedup-verify`, IDENTICAL, 114 cells). The two heavy shards (Burns
17,555 lines; D'Urfey 13,845) each outran a 10-minute process cap twice
before being detached — the instrument amendment this bought is per-file
checkpointing (see the closing note).

## F1 — accounting: PASS

0 of 16,530 cells violate `n_pairs == n_true + n_false + n_refused`
(asserted at build time, re-checked on the merged artifact).

## F2 — readability: PASS, and the registered suspicion is answered

**0 rows are 100% refused over BOTH populations.** The registration said
the absence of wholly-unreadable rows "would itself be suspicious"; the
diagnosis is that every one of the 57 questions is syllable- and
channel-shaped, and English always supplies SOME word shape that answers.
The nearest misses are exactly where the phonology says they should be:
the apocopated family (a penultimate-stressed-syllable anchor) refuses
**100.0%** of word-within-line pairs and **99.9%** of endword-cross pairs
— most English words simply lack the shape, and the 0.1% sliver that
reads is the accounting working, not a hole. The canary
(`masculine-rhyme`, endword-cross) judges 80.3% of its 4,319,257 pairs
(19.7% refused — OOV endwords, monosyllable anchors), nowhere near the
100% that falsifies.

## E1 — direction: PASS on 5 of 6 rows; FAILED AS REGISTERED on one, and
## the diagnosis is a mis-specified expectation, not the instrument

Judged-base realization, endword-cross, the registered constrained
end-rhyme family, against the Whitman negative control:

| row | eng_song | sonnets | whitman | verdict |
|---|---|---|---|---|
| masculine-rhyme | 0.0318 | 0.0677 | 0.0080 | PASS |
| perfect-rhyme | 0.0441 | 0.0699 | 0.0127 | PASS |
| perfect-rhyme-(last-stressed-syllable) | 0.0317 | 0.0676 | 0.0078 | PASS |
| feminine-rhyme | 0.0014 | 0.0039 | 0.0001 | PASS |
| rime-riche-(last-stressed-syllable) | 0.0007 | 0.0007 | 0.0005 | PASS |
| dactylic-rhyme | 0.0000084 (29 true) | 0 of 12,926 | 0 of 9,870 | **FAIL** |

~~Rhyme-constrained verse out-rhymes free verse at its own question by 4-9x
on every live row~~ **STRUCK 2026-08-26 — RE-DERIVED FROM THE TABLE DIRECTLY
ABOVE AND IT DOES NOT REPRODUCE. The DIRECTION holds on all ten comparisons
and E1's PASS is untouched; the RANGE does not.** eng_song and sonnets against
whitman: masculine 3.98x / 8.46x, perfect 3.48x / 5.52x, perfect-lss 4.06x /
8.67x, feminine 14.11x / **38.94x**, rime-riche **1.38x / 1.37x**. The spread
is **1.37x to 38.94x**, and "4-9x on every live row" rounds away both ends —
including the rime-riche row, where rhyme-constrained verse barely separates
from the negative control, which is the row a phase-2 consumer most needs to
see. E1 as registered asks only EXCEEDS, and all ten exceed — the direction the instrument exists to detect, and it
detects it.

**The dactylic failure, diagnosed before anything is quoted (the
registration's own requirement).** The judge is NOT the defect: on
constructed dactyls it answers — `glamorous`/`amorous` TRUE,
`mystical`/`statistical` TRUE, the identical word FALSE, `night`/`delight`
FALSE. The zeros are the corpora's, for two stated reasons. (1) The
sonnets are iambic pentameter: a line cannot END on a
dactylic-stressed word there, so 0 of 12,926 judged pairs is METRICAL
fact, and 0 > 0 against Whitman is untestable, not failed. (2) The
tradition's dactylic rhyme is characteristically MOSAIC — multi-word
("poet laureate"/"Tory at") — and the endword population carries single
words, which cannot hold the tradition's realizations; eng_song's 29 true
pairs at 8.4 per million are the single-word residue.

**Registered consequence.** E1 as registered FAILED, so nothing is
adopted under it unamended. AMENDMENT, registered here and applying to
this same artifact without remeasurement: `dactylic-rhyme` leaves the
constrained-family expectation — its membership implied every
rhyme-constrained corpus realizes single-word dactylic end-rhyme, which
the sonnets' own meter contradicts — and E1 re-reads over the remaining
five rows: **PASS, 5 of 5, both comparisons each.** The artifact's
`constrained=yes` tag on dactylic-rhyme cells is VOID for consumers (a
phase-2 calibration may draw neither signal nor null from a tag this
amendment struck); run 2's registration drops the row from the tag list
so artifact and code re-agree. The other five rows' tags stand.

## D1 — the seeded diagnostic (recorded, not a falsifier)

> **STRUCK 2026-08-26 — THIS SECTION'S POPULATION WAS NEVER A DECLARED
> COORDINATE, AND THE TREE MOVED UNDER IT (doctrine 58).** `d1_diagnostic()`
> re-globs `corpus/song/eng_*.txt`, so unlike every other figure in this
> document D1 is not pinned to `data/structure_census_eng.tsv`. Re-run at head
> the pool is **4,436,096**, not 2,408,735 (**+84.2%**), and **every cell of
> the run-1 table moved.** The run-1 numbers are NOT withdrawn as
> measurements — they reproduce byte-for-byte from
> `git archive 2ff4e51 lyric-harness` — but they may not be quoted as current,
> and **they cannot be re-derived at head at any population**: 3 of the 143
> run-1 files were DELETED at `76f978f` and 140 changed content. That is why
> the repair is a strike and a re-derivation rather than a restoration.
>
> **THE MOVE, DECOMPOSED — four measurements, not one attribution:**
> run-1 code × run-1 corpus **2,408,735** -> head code × run-1 corpus
> **2,436,641** (+27,906, **+1.16%**, commit `1580d11`: `line_tokens` onto the
> declared `LATIN_SCRIPT` repertoire) -> head code × head corpus, the 140
> surviving files **2,881,757** (+447,388, **+18.4%**, content top-ups) ->
> head code × head corpus, all 1,297 files **4,436,096** (+1,554,339,
> **+53.9%**, the four 2026-08-20 loads `550dfb1`/`810cc5e`/`5286812`/
> `76f978f`, 1,170 files added). **Never summed as one cause.**
>
> **THE REPAIR IS AIMED AT THE MEASUREMENT, NOT AT THE NUMBER** (doctrine 58).
> Nothing is retuned and no cell is re-tagged to make a figure return: D1's
> population is a DECLARED coordinate now. `structure_census.py` carries
> `D1_RECORDED` keyed on the `data/calibration_manifest.tsv` snapshot, and
> `--check` re-derives it and exits **3** on drift, so the next corpus load
> turns this RED instead of moving it in silence.

**RUN 1, 2026-08-18 — the record, reproducible only at `2ff4e51`.**
1,000 pairs at seed 20260818 from **2,408,735** unique eng_song endword-cross
pairs over the 143-file population; the `masculine-rhyme` judge against the
engine's `admits()` (RHYME/RIME_RICHE at theta): true/admits 8 (`sold`/`hold`),
true/rejects 7 (`neighbour`/`play`), false/admits 11 (`key`/`may`),
false/rejects 714 (`note`/`pursuits`), refused/admits 5 (`rhine--`/`rhine`),
refused/rejects 255 (`common`/`mither`). Agreement over judged **722/740
(97.6%)**, refusals apart, 18 disagreements.

**RE-DERIVED 2026-08-26** — same seed, same judge, **DECLARED population: the
1,297 `eng_*` files at the `data/calibration_manifest.tsv` snapshot of
2026-08-22**, **4,436,096** unique eng_song endword-cross pairs:

| masculine-rhyme | admits() | n | example |
|---|---|---|---|
| true | admits | 11 | find/kind |
| true | rejects | 2 | thinkin'/finger |
| false | admits | 10 | house/brass |
| false | rejects | 696 | plot/feet |
| refused | admits | 5 | dream/flame-- |
| refused | rejects | 276 | daddie/douked |

Agreement over judged: **707/719 (98.3%)**, refusals apart. The 12
disagreements are the two questions being DIFFERENT questions, which is
why the row exists: `thinkin'`/`finger` rhymes on the stressed syllable
alone (the masculine cell's whole demand) while the to-end scalar
comparator correctly rejects it over the trailing syllable; `house`/`brass`
clears the scalar band the strict cell refuses. No threshold was
preregistered and none is invented here — and **the 97.6% -> 98.3% move is
RECORDED, not adopted**: nothing in this tree reads either figure.
**NOT ONE of the six example pairs run 1 names by word survives into the
re-derived sample**, which is the sharpest single statement of how far the
population moved.

## The null table this run banks (the point of the census)

Chance rates over eng_song, judged-base — what INCIDENTAL co-occurrence
produces, the denominator every phase-2 laziness calibration divides by:

| row | endword-cross | word-within-line |
|---|---|---|
| kalevala-alliteration (preset) | 0.0562 | 0.0906 |
| Kalevala-alliteration-(weak) (cell) | 0.0425 | 0.0777 |
| assonance | 0.1061 | 0.0762 |
| consonance | 0.1307 | 0.1316 |
| masculine-rhyme | 0.0318 | 0.0137 |
| pararhyme | 0.0039 | 0.0070 |

Read the alliteration row and the owner's bias question is answered with
a number: English words share an onset by CHANCE about 9% of the time
within a line. A Kanteletar measurement that found, say, 40% under the
constraint would be measuring choices; this table is what subtracts the
alphabet from the writer. **The declared non-claim stands:** these are
chance rates; no laziness tier, no `calibrated=True`, and no enforcement
may cite them as anything but a null.

## Instrument amendment for run 2 (from this run's own operations)

Three shard processes were killed by a 10-minute process cap before the
first table landed, and the recovery cost was re-running whole shards
because the instrument wrote nothing until a shard finished. Run 2 gets
per-file checkpointing — each file's cells written as computed, restart
skips finished files — so the most any interruption can cost is one
file. The owner called this during the run and the call was right.
