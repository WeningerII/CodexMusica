# Next ten Project Gutenberg collections — 2026-10-08

This batch adds **1,299 original English lyrics and short poems** to the
Library, in 76 author files. The complete ledger partitions 1,492 candidate
units into 1,299 imports, 77 duplicates and 116 exclusions. Every candidate
retains its text, printed attribution, source locator and eligibility reason;
`audit.json` records the retained witness for each duplicate.

| Gutenberg collection | Supplied edition | Candidates | Imported | Duplicate | Excluded |
| --- | --- | ---: | ---: | ---: | ---: |
| 69378 — Negro Workaday Songs | 1926 | 329 | 270 | 1 | 58 |
| 27195 — Negro Folk Rhymes | 1922 | 349 | 333 | 0 | 16 |
| 58414 — Anti-slavery Harp | Third edition, 1851 | 46 | 46 | 0 | 0 |
| 51226 — Connecticut Wide-Awake Songster | 1860 | 51 | 50 | 1 | 0 |
| 934 — Songs of a Savoyard | Transcription credits 1920 and 1884 editions | 87 | 35 | 52 | 0 |
| 40048 — Newcastle Song Book | 1842 | 214 | 210 | 1 | 3 |
| 50878 — Beadle's Dime Song Book No. 5 | Copyright 1860 | 73 | 61 | 10 | 2 |
| 13646 — A Book of Nonsense | 1894 supplied edition | 113 | 113 | 0 | 0 |
| 1568 — Poems, Henley | 1907 | 130 | 120 | 7 | 3 |
| 3138 — Ballades and Rhymes, Lang | 1911 | 100 | 61 | 5 | 34 |

Each collection directory contains a reproducible adapter, compressed source
witness, source hashes, complete candidates, edition and USA rights evidence,
and boundary tests. Every Gutenberg catalogue's express public-domain-in-USA
affirmation was checked. No worldwide rights claim or guessed original
publication date replaces the supplied edition. The Gilbert and Lang browser
witnesses identify reconstructed text, not original HTTP-response bytes.

Source spellings and printed variants remain intact. Folk Rhymes uses the HTML
witness's native macron/breve vowels instead of feeding plaintext markup
fragments into the tokenizer. Gilbert's soft wraps and Lang's Bird-Gods line
wraps are resolved against the supplied HTML. Chorus labels, speaker labels,
tune directions and editorial notes use existing section/apparatus conventions.
Abbreviated printed refrains remain abbreviated; no absent stanza is invented.

Complete source-supplied improvisations and variants are not excluded merely
because an editor discusses their formation. Explicitly incomplete excerpts,
translations, mixed-language units outside this English-only batch, prose and
extended narrative works are excluded with individual reasons. There is no
numerical length ceiling. Workaday's full songs embedded in commentary are
included where the source identifies a complete performance text. Its editors'
distinction between folk-minstrel and black-face vaudeville is not erased.

The integration reuses the preceding batch's duplicate and rendering rules.
It compares all prior English corpus reading units, including the first ten
collections, and then this batch in the order above. A completed batch replays
against its recorded comparison population, so a later import cannot
retroactively replace an earlier retained witness. Members' bytes are still
reread and checked. Titles alone never establish a duplicate. For the two complete Workaday performances
sharing two floating stanzas, the source adapter places the complete 48-line
Free Labor Gang Song before the eight-line That Ol’ Letter. Normal deduplication
therefore retains all source lines, with the short witness preserved in the ledger.

All additions live under `corpus/library/gutenberg-next-ten/`, outside the six
song-calibration populations. The population checker confirms no re-adoption is
owed. Only the all-file integrity snapshot, measured section census, source
registry and affected runtime byte pins are updated; calibration constants and
shared pronunciation engines are unchanged. The actual Library reader is
checked against every imported lyric line.

Missing dictionary coverage is not an admission exclusion. Existing exact-line
pronunciation declarations supply selected readings during analysis. The reader
attaches this supplement only after verifying its exact source binding and before
computing cache identity. Explicit caller sets take precedence, including an
empty set to opt out; existing dictionary alternatives are unchanged.
The [pronunciation supplement](pronunciations/README.md) packages 6,973 optional
occurrence declarations for 892 works using that existing API. All are absent
from default and high-confidence dictionary lookup. They are explicitly selected
performance readings, not claims of authentic historical pronunciation; the
supplement documents remaining coverage gaps and exact caller usage.

From `lyric-harness`:

```sh
python3 imports/gutenberg-next-ten/integrate.py --check
python3 quality/test_gutenberg_next_import.py
python3 quality/corpus_manifest.py --check
```

Adapters replay their retained witnesses offline; HTML adapters require
Beautiful Soup. To regenerate reviewed data, run `integrate.py`, then
`prepare_catalog.py`. To build this expanded Library with existing machinery:

```sh
python3 -m library.catalog build --output /tmp/gutenberg-next-library \
  --repo-sha "$(git rev-parse HEAD)" \
  --source-manifest imports/gutenberg-next-ten/source_manifest.json
```

The batch source manifest pins the complete corpus bytes for reproducible local
builds. The production catalog manifest and Docker build name the committed
source tree containing this import. The previously approved Library Site snapshot
is retained by the existing release assembler; advancing the new catalog does
not remove that immutable reader source.
