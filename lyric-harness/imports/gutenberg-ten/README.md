# Ten Project Gutenberg collections — 2026-10-08

This import adds **2,696 original English lyrics and short poems** for the
Library. Its 3,998 candidate records partition into 2,696 imported works,
935 duplicates, and 367 other exclusions. Every candidate has a source locator,
printed attribution, complete extracted text, eligibility decision, and text
hash. `audit.json` records the final disposition and the retained witness for
every duplicate, including matches to the existing corpus.

| Gutenberg collection | Supplied edition | Audited works | Imported | Duplicate | Other exclusions |
| --- | --- | ---: | ---: | ---: | ---: |
| [46041 — The Christian Hymn Book](https://www.gutenberg.org/ebooks/46041) | 1870 | 1,324 | 1,051 | 231 | 42 |
| [20476 — Hymns for Christian Devotion](https://www.gutenberg.org/ebooks/20476) | 1853, twenty-second edition | 1,008 | 625 | 365 | 18 |
| [76498 — Evangelical Lutheran Hymn-Book](https://www.gutenberg.org/ebooks/76498) | 1927 | 594 | 148 | 164 | 282 |
| [22223 — English Songs and Ballads](https://www.gutenberg.org/ebooks/22223) | 1903, second impression | 269 | 103 | 155 | 11 |
| [76941 — Naval Songs and Ballads](https://www.gutenberg.org/ebooks/76941) | 1908 | 199 | 189 | 2 | 8 |
| [21300 — Cowboy Songs and Other Frontier Ballads](https://www.gutenberg.org/ebooks/21300) | February 1929 printing | 153 | 151 | 1 | 1 |
| [65524 — Modern Street Ballads](https://www.gutenberg.org/ebooks/65524) | 1888 | 139 | 137 | 1 | 1 |
| [30418 — Traditional Nursery Songs of England](https://www.gutenberg.org/ebooks/30418) | 1843 | 103 | 102 | 1 | 0 |
| [56625 — Songs of the West](https://www.gutenberg.org/ebooks/56625) | April 1913 reprint of revised fifth edition | 121 | 121 | 0 | 0 |
| [59263 — 88 Favourite Carols and Hymns for Christmas](https://www.gutenberg.org/ebooks/59263) | Undated supplied title page | 88 | 69 | 15 | 4 |

The 367 exclusions comprise 325 translations (including ten translated
liturgical chants), 21 unresolved original-language attributions, 15 long
narrative/elegiac works, five incomplete source works, and one prose parody.
No numerical length cap decides eligibility; individual exclusions state their
reason. Printed short songs retain their stanzas and abbreviated refrains.
Omission ornaments, speaker directions, and chorus labels remain explicit
apparatus or section marks, not sung words. No missing verse is invented.

## Source totals and rights

Collection totals are reconciled against the actual supplied editions:

- English Songs and Ballads has 265 first-line index entries and four additional
  independently headed body poems. The index mapping is retained.
- Naval Songs and Ballads has 199 verse entries plus five editorial contents
  entries (notes and indexes), all mapped in its contents ledger.
- Modern Street Ballads has 138 contents entries plus the independently headed
  John Hobbs, which is absent from the contents.
- Nursery Songs has 107 HTML verse blocks forming 103 source-separated rhymes;
  four page/illustration continuations are joined. A source divider between
  Pippin Hill and Little Miss is respected, even though other editions join them.
- Songs of the West has 121 numbered songs. Song 50's two parts remain one work;
  song 58's second musical setting is audited as an alternate, not another song.

Every linked Gutenberg catalogue explicitly identifies its ebook as public
domain in the USA. Each collection's `collection.json` records that affirmation,
the exact supplied imprint, source hashes, retrieval details, and evidence URLs.
Admission uses the repository's express source-affirmation route. This is a USA
rights statement, not a worldwide claim. Cowboy Songs uses 1929, not its original
1910 publication. The undated Christmas collection has a null publication year;
no guessed year is used to clear it.

Eight sources were obtained through the repository's established GITenberg mirror
route and checked against the supplied Gutenberg edition. The two newer texts,
76498 and 76941, were recovered from consecutive browser text windows because
direct shell access was blocked. Their hashes explicitly identify reconstructed
transcriptions, not original HTTP response bytes. Both decoded transcriptions
are retained as compressed source evidence for offline adapter replay.

Translation review covered printed author/translator credits, first lines,
source notes and targeted hymn authorities. Cross-collection matching caught
seven additional translated hymns during integration. Anonymous credits are
preserved; screening is not represented as exhaustive independent authorship
history for every anonymous item.

## Reproduction and scope

The existing recursive Library builder reads the generated author files under
`lyric-harness/corpus/library/gutenberg-ten/`. The research song directory and
shared reader, engines, pipelines, and runtime behavior are unchanged. The
repository's own population checker confirms that the additions are outside all
six calibrated populations; no re-adoption is owed. The all-file integrity
snapshot includes the new files. The whole-corpus section-label census is
remeasured for VERSE, CHORUS and REFRAIN; its table retains the previous counts.
Source-registry provenance and runtime byte pins include those derived updates.

Deduplication compares the existing English reading units, Shakespeare sonnets,
Whitman units, and accepted entries in the declared collection order. It records
exact normalized matches, corroborated same-opening variants, strong shared-line
containment, and the existing corpus audit's long-line containment criterion.
Titles alone never decide a match. Review covered the weakest accepted matches
and changed-opening matches. Repeated editions are counted as duplicates rather
than inflating the website's work count.

From `lyric-harness`:

```sh
python3 imports/gutenberg-ten/integrate.py --check
python3 quality/test_gutenberg_import.py
python3 quality/corpus_manifest.py --check
```

To regenerate this batch after an explicitly reviewed candidate change, run
`integrate.py` without `--check`, then `prepare_catalog.py` in this directory.
The latter updates only the ten source registry rows and the batch's complete
byte-pinned `source_manifest.json`. The production manifest at `library/catalog_sources.json` separately pins
the admitted corpus to commit `b4ca30857412b554f1c5708579d52719bf0ae933`;
its matching Docker build pin uses those exact approved bytes. Recheck population impact before publishing a new all-file
integrity snapshot.

To build a complete Library snapshot using the existing machinery, run from
`lyric-harness` with an empty output directory:

```sh
python3 -m library.catalog build --output /tmp/gutenberg-library \
  --repo-sha "$(git rev-parse HEAD)" \
  --source-manifest imports/gutenberg-ten/source_manifest.json
```

The resulting snapshot can be passed to the existing
`library.catalog_site_export` and `library.catalog_downloads` modules. Committing
the corpus does not itself publish a separate hosted Library site.

Source-specific adapters and boundary tests live alongside each collection.
The discovered `quality/test_gutenberg_import.py` suite checks duplicate controls,
section preservation, all ten source ledgers, edition dates, audit partitions,
text hashes, and exact integration reproducibility.
