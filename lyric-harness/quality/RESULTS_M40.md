# M-40 follow-up — 2026-09-16

The interlocking chain-rhyme **link** is implemented as
`chain rhyme (interlocking scheme)`: matching line-end nucleus/coda across
consecutive, grounded stanzas. It does not certify the whole `aba bcb cdc`
template. Rap chain rhyme and last-word-to-first-word linked rhyme remain
separate schemas. The stanza capability follows from the placement kind,
including when the declaration omits `requires`. Missing ground refuses.

Registry 77 → 78; pair-shaped schemas 25 → 26; span slots 154 → 156;
placement slots 93 → 95; cited survey rows 375 → 376 (E44).
The existing ledger slice has no stanza ground: the new row is
`cannot_obtain`, with seven derived statistic/null pairs and no arm.
Its input-resolvable/implementation-required split moves 28/5 → 29/5.
These are coverage measurements, not statistical qualification. The E44
survey row's external witness is still unrecorded; attaching the existing
R105 citation does not manufacture one.

## Declared poet measurements

Reproduce from `lyric-harness`:

```
python3 -m quality.m40_poet_cells --output=quality/results/m40_poet_cells.json
```

`M40_PANEL` fixes eight available author cells (seven existing files and one new excerpt) and `TARGETS` fixes their
questions before measurement. Each cell is the first work, capped at 40 lyric
lines, at seed 20260811 and n=200. The actual seed, input hashes, normalized
full-file hashes/counts, lines, stanza indices, coverage refusals, every null
value, and refused/void draw counts are in the JSON. Read the JSON's seed as
authoritative if the shared null seed changes.

The new `normalized_one_song` reader uses the runtime apparatus/footnote
repairs and retains printed stanza boundaries. It stops at the next title,
so rhymes cannot link unrelated songs. The historical nine-cell `PANEL` and
its readers/results are unchanged. These follow-up measurements do **not**
replace the earlier census: the previous banked poet-cell artifacts were not
found in this checkout, so no numerical before/after claim is made.

| Cell | Full-file normalized lyric lines | Measured lines / stanzas | Findings on this fixed slice |
|---|---:|---:|---|
| Kingsley | 1,050 | 12 / 6 | Semirhyme: 10 confirmed instances; count exceeds both global-redeal and within-line-shuffle maxima. |
| Shakespeare | 767 | 15 / 3 | Anaphora: 4 confirmed; no tested row clears. |
| Henley | 293 | 16 / 4 | Cross: unresolved witness only; interlaced: 3 confirmed, 9 unresolved; linked: no instance. No row clears. |
| Keats | 782 | 40 / 11 | Cross: 2 confirmed, 3 unresolved; interlaced: 4 confirmed, 48 unresolved; linked: unresolved witness only. No row clears. |
| Shelley | 2,532 | 22 / 1 | Cross: 1 confirmed, 1 unresolved; interlaced: unresolved witnesses only; linked and interlocking chain: no instance. No row clears. |
| Byron | 1,183 | 40 / 5 | Interlocking chain: 2 confirmed; local-fraction@2 exceeds line-permutation and line-final-permutation maxima. |
| Ceiriog | 16 (staged excerpt) | 16 / 4 | Lusg: no instance in the first poem, “NANT Y MYNYDD”. |
| Mynyddog | 2,755 | 16 / 2 | Neither lusg nor groes o gyswllt has a confirmed instance. |

Four of 40 statistic/null rows clear their sampled maximum, across two
schemas. This is exploratory evidence over deliberately nominated texts,
**not** a corrected significance test or promotion into the admissible set.
“No instance” applies only to the stated slice. Unresolved witnesses are
reported separately and never converted to an absence. No poet's entire
output is claimed to lack a form. The new schema is not added to the
planner's adopted drawable set.

## Ceiriog acquisition

[Gutenberg 3500](https://www.gutenberg.org/ebooks/3500) identifies the
1902 Ab Owen edition, author John Ceiriog Hughes (1832–1887), and editor
Owen Morgan Edwards (1858–1920), and declares the text public domain in the
USA. The first poem was staged as a research excerpt before running its
cell; the source row is `gutenberg/3500#nant-y-mynydd` in
`data/sources.tsv`. No spelling repairs were guessed. This is acquisition
of a fixed witness, not ingestion of the whole collection.

## Remaining work

- Tudur Aled: a staged edition satisfying the repository's edition gate is
  still missing. No modern edition was silently admitted. The
  [National Library biography](https://biography.wales/article/s-TUDU-ALE-1480.html)
  cites the 1926 T. Gwynn Jones edition and links an approximately 1840
  printing; the [1773 anthology catalog record](https://archifau.llyfrgell.cymru/index.php/gorchestion-beirdd-cymru)
  supplies another lead, but neither catalog metadata alone establishes a
  transcribed, attributed poem. Those leads were not admitted as verse.
- Radif: acquiring more poetry does not fix nulls that destroy the defining
  refrain. That instrument work remains separate from corpus acquisition.
- These runs do not establish whether the cross/interlaced/linked failures
  are absent forms, unreadable witnesses, or mis-specified rules. They provide
  the fixed-cell evidence needed to investigate that distinction.

M-40 therefore remains **PARTIAL**: the implementation and available-cell
follow-up are complete; the named acquisition and statistical questions are
not represented as solved.

## Verification

Seven focused tests cover positive chain links, wrong positions/stanzas,
missing ground, separate senses, apparatus repairs and song boundaries.
The existing relation regression suite, relation-shape suite, null-shape
suite (50 checks), and panel-null suite (77 checks) pass. The extension
ledger, relation-shape pins and audit-register pins pass. The focused suite
is included in the CI suite list. No paid model calls were made.
