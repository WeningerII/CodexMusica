# Third ten Project Gutenberg collections — 2026-10-09

This batch adds original English song lyrics and short standalone poems using
the existing Library import rules. The complete candidate ledger records imports,
retained duplicate witnesses, and individual exclusions in `audit.json`.

This batch adds **665 original English lyrics and short poems** in 51 author
files. The ledger partitions 710 candidates into 665 imports, 23 duplicates,
and 22 exclusions.

| Gutenberg collection | Supplied edition | Candidates | Imported | Duplicate | Excluded |
| --- | --- | ---: | ---: | ---: | ---: |
| 48494 — Beadle's Dime Song Book No. 1 | 1866 | 68 | 60 | 7 | 1 |
| 49629 — Beadle's Dime Song Book No. 3 | 1860 | 70 | 64 | 6 | 0 |
| 50041 — Beadle's Dime Song Book No. 4 | 1860 | 71 | 62 | 7 | 2 |
| 21723 — Songs of the Cattle Trail and Cow Camp | 1919 | 76 | 69 | 0 | 7 |
| 20774 — The Shanty Book, Part I, Sailor Shanties | 1921 | 30 | 30 | 0 | 0 |
| 1030 — The Cavalier Songs and Ballads of England, from 1642 to 1684 | 1863 | 108 | 106 | 1 | 1 |
| 33417 — Later Poems | 1923 | 114 | 111 | 0 | 3 |
| 17884 — Fifty Years & Other Poems | 1917 | 60 | 55 | 0 | 5 |
| 69866 — Dark of the Moon | 1926 | 59 | 59 | 0 | 0 |
| 18007 — More Songs From Vagabondia | 1896 | 54 | 49 | 2 | 3 |

## Source evidence

Each numbered directory retains its compressed source witness, hash, reproducible
adapter, complete candidate text, source locators, supplied-edition evidence,
and Project Gutenberg public-domain-in-USA affirmation. Edition dates describe
the supplied witnesses, not Gutenberg release dates or assumed first editions.
Rights admission is USA-specific. Source spellings and abbreviated refrains are
preserved. No music, illustrations, editorial prose or Gutenberg boilerplate is
imported. Translations and long narrative poems are individually excluded.

Gutenberg 50666 was considered and rejected before import: its connecting
narrative, translations and extended verse stories made it less suitable than
Gutenberg 20774's explicitly separate shanties. No passage was split into an
invented song to inflate this batch.

## Reproduction

From `lyric-harness`:

```sh
python3 imports/gutenberg-third-ten/integrate.py --check
python3 quality/test_gutenberg_third_import.py
python3 quality/corpus_manifest.py --check
```

Source adapters replay their compressed witnesses offline and use Beautiful Soup
where HTML extraction is needed. To regenerate this reviewed batch, run
`integrate.py` then `prepare_catalog.py` in this directory. The latter registers
the ten source records and pins the complete corpus tree in `source_manifest.json`.

The existing duplicate detector compares all prior English corpus reading units,
including both preceding ten-collection batches, before comparing new candidates
in the declared order. A completed batch preserves that comparison population
for reproducible replay. Title similarity alone does not establish duplication.

All additions live under `corpus/library/gutenberg-third-ten/`, outside the six
calibration populations. Shared engines, pronunciation dictionaries, grading and
pipelines are unchanged. Missing dictionary readings do not exclude source works.
The reader regression checks every imported lyric line against candidate text.
Boundary review also separates quoted epigraphs and editorial comparison verses
from the actual song, and records section captions and performance directions
as apparatus rather than sung lines.
The existing approved Library Site snapshot remains retained; no Site deployment
is part of this import.
