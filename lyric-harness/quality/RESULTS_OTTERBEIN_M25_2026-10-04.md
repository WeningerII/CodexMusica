# Otterbein refrain hymns and the M-25(a) apparatus pass — 2026-10-04

Status: LOADING BATCH OPEN. The Otterbein staging below is committed; the
M-25(a) annotation pass and the closing sitting
(`quality/CORPUS_LOADING_PROTOCOL.md`) have not run yet, so
`quality/corpus_manifest.py --check` reports drift and nothing calibrated has
been re-adopted. This file is completed by the closing sitting.

## 1. Otterbein Hymnal: Pass 1 same-gate top-up

Source: the already-cited edition, `GITenberg/The-Otterbein-HymnalFor-Use-in-Public-and-Social-Worship_16455`
(Dayton, Ohio, 1892). Both pinned hashes were re-verified against the bytes the
GITenberg mirror serves today: upstream `16455.txt` md5
`6dcb1e67cd2f7a53a6b29cc3a78f5789`, and after CRLF→LF normalization md5
`647743d8c980eac4b66f7c35d2a20b37`. No new licence or provenance question
arises; the existing `data/sources.tsv` row is the gate.

Admission rule (doctrine 93): hymnal membership plus a printed refrain mark,
`Cho.--` or `Ref.--`.

| population | hymns |
|---|---:|
| numbered hymns in the edition | 548 |
| print a refrain mark | 113 |
| already staged (≥ 50% of distinct lines found in one corpus item) | 30 |
| already staged from another printing (Phoebe Cary, hymn 500) | 1 |
| held no corpus file | 82 |
| staged now | 73 |
| held out: the source signs them to nobody | 9 |

The source's own numbering has three defects, recorded in its row: hymn 103 is
printed `1O3` (letter O), 538 is printed `588`, and 113 appears twice (the
first is 112). A parser that only reads digits merges 103 into 102; the first
extraction did exactly that and was caught by the shape scan before staging.

Extraction convention, reproduced rather than invented: of the 164
Otterbein hymns already in the corpus that the extractor can match by first
line, it re-derives 148 byte-for-byte (body and title); the other 16 come
from an older staging that kept indentation or typed the refrain as a verse,
or use a title variant. Stanzas become `[VERSE n]`; the `Cho.--` / `Ref.--` stanza
becomes `[REFRAIN]` where it is printed; indentation, stanza numerals, the
hymn-number/tune/metre heading, the italic topic line and its cross-reference
number are not staged. Titles are the first sung line with trailing `,;:.!-`
removed (`?` and quoted titles kept, as the existing files do).

Placement: 66 hymns in 47 new `corpus/song/eng_hymn_*.txt` files, one per
author as the source signs them, `# function: hymn` (hymnal membership), and
`# region:` BLANK — the hymnal prints a signature and no nationality, and
`data/song_regions.tsv` takes region from the author's tradition with edition
origin as tiebreak only. Seven hymns are appended to existing author files,
each under `--- FUNCTION: hymn` and `--- SOURCE: PG16455` with the Otterbein
source added to the file header:

| file | hymns |
|---|---|
| `corpus/song/eng_celtic_msm_horatius_bonar_d_d.txt` | 316 |
| `corpus/song/eng_hbv_frederick_william_faber.txt` | 217 |
| `corpus/song/eng_parlour_george_frederick_root.txt` | 207 |
| `corpus/song/eng_pah_jeremiah_eames_rankin.txt` | 61, 322, 399 |
| `corpus/song/eng_hbv_george_cooper.txt` | 412 |

Every staged item carries `--- AUTHOR:` quoting the printed signature
verbatim. Where the source signs one person several ways (`D. W. Whittle.` /
`D.W. Whittle` / `D.W. Whittle.`; `Rev. Wm. Hunter.` / `William Hunter, 1857` /
`Rev. William Hunter.`; `Baltzell` / `Isaiah Baltzell.`; `Edgar Page Stites.` /
`E.P. Stites.`; the Lorenz, Cushing and Rankin variants) the file header lists
every spelling. `Elizabeth Coduer, 1860.` is kept as printed.

Held out, by number: 26, 93 (`Anon.`), 377 (`Anon, Arranged.`), 379
(`Unknown.`), 189 (`Vestry H. & T. Book.`), 193 (`Arr. from Neumaster,
1671.`), 245, 252, 275 (no signature). The corpus files songs by author, and
these name none.

Checks at staging: `quality/corpus_taxonomy.py --check` holds. The corpus
audit's only new findings are the expected mid-batch ones — check C hash drift
and unrecorded hashes, which the closing sitting's manifest write resolves —
and orthography notes (check G) of the kind every Otterbein file already
carries.

## 2. M-25(a) — apparatus typed as sung verse

The population is check H's (`quality/audit_corpus.py`): every `[VERSE]` block
holding exactly one non-blank line. It was re-enumerated with physical line
numbers by check H's own rule and controlled against check H's per-file counts
for all 103 English files that have one (exact in every file).

| | blocks |
|---|---:|
| English one-line `[VERSE]` blocks | 1,889 |
| in a declared apparatus shape | 652 |
| residue (no declared shape) | 1,237 |

Reading: each block, with its surrounding lines and the item's title, was
classified by two readers working blind to each other — SUNG, NOT_SUNG or
UNDECIDED — with the register's own traps in front of them (Watts's titles
that are first lines, Burns's sung line that looks like a dateline,
Lovelace's poem that opens inside a note run, songbook one-line burdens,
capitals that are sung). They agreed on 1,887 blocks; a third reader ruled on
the other 2 (both NOT_SUNG). No block ended UNDECIDED.

| verdict | blocks | files |
|---|---:|---:|
| NOT_SUNG — annotated | 1,642 | 92 |
| SUNG — left as staged | 247 | 27 |

Remedy: the existing `# APPARATUS:` prefix, on the line and on its `[VERSE n]`
mark, in place (the convention of `data/english_nonlyric_apparatus.json`). No
line is deleted, reworded or renumbered; 3,284 physical lines carry the
prefix. 1,639 rows leave the normalized reader; the other 3 were already
apparatus to it (parenthetical lines check H reads raw). The receipt is
`data/english_apparatus_m25_2026-10-04.json`: every line's before and after
text, the class, the before/after file hashes, the 247 blocks left as sung
with their reasons, and the 103 false units.

| class | annotated |
|---|---:|
| scripture argument (Watts) | 445 |
| speaker name or stage direction | 414 |
| numeral | 227 |
| embedded title | 132 |
| subtitle, dedication, epigraph, salutation | 98 |
| editorial note | 90 |
| section heading | 82 |
| dateline | 58 |
| tune line | 44 |
| ornament or separator | 32 |
| byline or signature | 19 |
| contents line | 1 |

Largest files: Watts 445 (all), Barnes 268, Burns 203 (all), Longfellow 132,
Lovelace 104 (all), D'Urfey 84, Skinner 75, Butterworth 33.

What moved besides the corpus: two Burns items in
`data/calibration_work_editions.json` changed body hash (`To A Mountain Daisy`,
`My Wife's A Winsome Wee Thing`; weights unchanged, recorded in the receipt);
the `# lines:` headers of the Coleridge and Wordsworth files are recounted
(859 → 858, 2,857 → 2,856); 60 `local:` rows in `data/sources.tsv` are repinned
with the superseded md5 kept. `quality/test_production_data.py` now reads both
apparatus receipts, each against its file with every later pass reverted, and
two mutations (a wrong count; one annotation undone in a file both receipts
touch) turn it red.

After the pass, check H's English population is exactly the 247 SUNG blocks:
0 in a declared shape.

Not done, and why:

- **103 false units.** 103 of the annotated titles head a DIFFERENT poem inside
  one `--- TITLE:` item (D'Urfey 42, Barnes 34, Burns 14, Herrick 4, and seven
  more files). The title no longer counts as sung text, but the item is not
  split: a split moves item identity and the registry's keys, and whether two
  pieces are two works is a reading per item. The receipt lists each.
- **Multi-line blocks.** Apparatus that shares a block with sung lines is
  outside check H's population (M-25 records 33 such cases in Watts, Burns and
  Lovelace).
- **Other languages.** 487 non-English one-line blocks are untouched: 428
  Finnish, 28 Sanskrit, 22 Welsh, 9 Chinese.

## 2b. The label and apparatus pass: every mark, and labels inside lines

M-25(a) asked only about one-line `[VERSE]` blocks. The owner widened the
question the same day. Every mark's blocks were in scope, along with labels and
apparatus printed as text inside a block, searched by the draft checklist
`quality/APPARATUS_CHECKLIST.md`.

Candidates: 3,697 lyric lines in 242 files that match a checklist signal. These
are one-line blocks under any mark (refrain, chorus, burden, verse), label-only
lines, label prefixes, headings in capitals, bracketed or parenthesised
directions, italic-only lines, numerals, dates, tune and metre lines, scholarly
and bibliographic vocabulary, scripture references, and index entries. Chorus
pointers (`&c.`) and the 247 blocks M-25(a) had already read as sung were left
out. Every line of a block holding an unmistakable editorial marker (`vol.`,
`i.e.`, `MS.`, `first published` and similar) came in too. Margin line numbers
at line end (`… of blame,      _5`) were measured and left alone, because they
are neither tokens nor end words.

Reading: two blind readers per line, as in M-25(a), with a third verdict,
LABEL_PREFIX, carrying the exact characters of a label that stands in front of
sung words. They agreed on 3,689 lines. A judge ruled on 8.

| verdict | lines |
|---|---:|
| SUNG, left as staged | 2,459 |
| APPARATUS_LINE | 890 |
| LABEL_PREFIX | 348 |

Both readers also named 454 further lines in the shown context as parts of the
same notes. Two more readers checked each of those blind and confirmed all 454.
The verse among them is verse quoted inside a note or an epigraph (a Cleaveland
passage in a Lovelace note, the "Dido" stanza an editor subjoins, a Shelley
epigraph over a Hemans poem), not the poem itself.

Applied:

- **1,344 lines** take `# APPARATUS:` in place (890 read + 454 confirmed
  neighbours), and **323 marks** whose every lyric line became apparatus take
  it too (7 Burns `[CHORUS]` marks over a bare printed "Chorus" label were
  kept: the section reader joins label and stanza, so the mark is structure). That is 59 files, 1,344 rows out of the reader, nothing deleted,
  renumbered or reworded. The classes are 627 editorial notes, 142 speaker
  names and stage directions, 139 headings, 88 scholarly references, 86
  numerals, 61 other, 55 attribution lines, 42 performance directions, 30
  section labels, 25 tune and metre lines, 19 voice labels, 12 dates, 8 repeat
  marks, 6 print artifacts and 4 end markers. Watts 425, Lovelace 317 and
  Shelley 183 carry most of it.
- **348 label prefixes** in 30 files are declared per line in
  `data/lyric_label_prefixes.json`: speaker names before sung dialogue
  (Herrick 118, Gay 33, Durfey 18, Gilbert 12), `Chorus.--` before Burns's
  chorus lines (75), and similar. `quality/lyric_reader.py` strips exactly the
  declared characters and keeps the sung words. It refuses if a line drifts
  from its label or stops being a lyric row, and it never touches a draft. No
  corpus byte moves for these lines, so no physical coordinate moves.

Receipt: `data/english_apparatus_labels_2026-10-04.json`. It holds every
line, the class, the hashes, the 2,459 lines kept as sung with their reasons,
and the neighbour verification. Six registry body hashes moved, all Burns:
`Auld Lang Syne`, both `Ca' The Yowes` printings, `My Heart's In The
Highlands`, `My Wife's A Winsome Wee Thing` and `The Minstrel At Lincluden`.
The Coleridge and Wordsworth `# lines:` headers were recounted, and 42 `local:`
rows were repinned. `quality/test_production_data.py` now reads all three
apparatus receipts newest-first, and tests the prefix table exactly and by
mutation.

Not done: the section-mark reader (`quality/grid.py`) still reads the prefixed
lines whole. It counts marks, not words, so no calibrated statistic reads it
for words. The non-English blocks are untouched.

## 3. Closing sitting

**FIRST RUN, SUPERSEDED BEFORE ADOPTION WAS FINAL.** The owner moved the §2b pass ahead of the suite sweep, so this run's re-derivations describe the tree before §2b and are kept as a dated record. The sitting is re-run over the final tree in §4.

Run on the tree carrying both changes, in the order
`quality/CORPUS_LOADING_PROTOCOL.md` prescribes. Every output named here is in
`quality/results/otterbein_m25_2026-10-04/`. Each changed constant carries a
dated note beside its superseded value.

| lane | before | after | verdict |
|---|---|---|---|
| rhyme-position tables (`quality/build_song_frequency.py`) | 13,836 end types; 23,762 pair types | 13,787; 23,736 (248,874 / 190,860 occurrences) | rebuilt; `frequency.py` pin moved |
| meter bands | density [5, 12], prominence [2, 7] | same, over 231,798 lines | HOLDS |
| structure census D1 | pool 4,390,056; agreement 681/689 | pool 4,351,811; 712/717 | repinned (a re-draw of the seeded 1,000 pairs from a changed pool; the judge did not move) |
| mark coverage | typed 76,909 | 75,639 (+372 Otterbein, −1,642 annotated) | repinned; decided and undecided unmoved |
| chorus pointers | 1,163 / 442 / 35 / 686 | 1,144 / 442 / 35 / 667 | the 19 that left were scripture-reference `&c.` and note lines |
| section marks | VERSE 74,177 lines; REFRAIN 707 / 40 files | 72,829; 785 / 92 files | remeasured |
| capacity witnesses | 81 certified | 81, every one re-verified unchanged (0 repair rounds); max certified chain 39 | table header only; runtime verification 81/81; `capacity.py --check` PASS |
| calibration rows | 8,536 works | 8,609 works, 279,503 sung lines (3,958 s, 4 workers) | rebuilt |
| `lyric` length curves (the active floor) | range 10–3,244; picks mattr C1, fwr C1, anaphora C2, cv CK, predictability CK | range 9–3,244; mattr C1, **fwr C2**, anaphora C2, **cv C2**, predictability CK; every check passes every bin | re-adopted; `SHIPPED_MODEL` repinned as a set; check HOLDS |
| superseded `song` / `short` bands | 150–400 / 50–150 | 200–400 / 50–150 | re-recorded as bookkeeping; never applied (`MISSING.md` M-317) |
| manifest | 1,430 files, 2026-09-15 | 1,477 files, 2026-10-04 | written; `--check` byte-identical |
| runtime asset pins | | rhyme tables, `sources.tsv`, capacity table, section marks | repinned; `release_assets.py --integrity` clean |

The two curve-model moves are the registered pick's own answer (fewest free
parameters passing every bin, `quality/LENGTH_CURVE_PREREGISTRATION.md` §4).
The straight line for the function-word ratio fails bin 20 (480–752 tokens,
9.09% held-out against an upper bound of 8.08%). For line-length variation, the
quadratic now passes all 22 bins and has fewer parameters than the knot
table. Both quadratics turn inside the corpus range (N = 406 and N = 2,888),
which the fit discloses under E3. The predictability curve first becomes
informative at 141 tokens (was 166).

The superseded `song` band moved because 18 of the new hymns fall in its
150–200-token sub-bin, and 8 of them score a perfect 1.0 on rhyme
predictability. That puts the sub-bin's 95th percentile at its ceiling.
Without the hymns the band holds at 150–400. The profile grades nothing, so
this is recorded and parked rather than acted on. The same concentration is a
fact about hymnal text (`MISSING.md` K-1a), and the active curves absorb it.
