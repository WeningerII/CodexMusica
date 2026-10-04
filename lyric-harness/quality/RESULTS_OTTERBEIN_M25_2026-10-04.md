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

Pending in this batch.

## 3. Closing sitting

Pending in this batch.
