# Procter source-reference recovery — 2026-09-15

The unfinished English corpus review had established source matches that were
never published. This completes its first author batch: 136 per-item references
in Adelaide Anne Procter's existing corpus file, comprising 86 references to
PG2303 and 50 to PG2304.

All three source files already cited in the header were fetched again and
verified against their recorded MD5 hashes. Each assigned item's complete body
matches one contiguous passage in exactly one of those three witnesses, under
the review's declared matching coordinate: NFC-normalized, casefolded Unicode
words with punctuation, underscore emphasis and layout removed. This establishes
a textual witness; it does not establish identical typography, introduce a new
edition or licensing ruling, or settle printed-song eligibility.

The per-item mappings, body hashes, source URLs and checksums, and remaining
cases are recorded in [the verification receipt](procter-source-references.json).

## Conservation

Removing the 136 inserted `--- SOURCE:` lines recovers every original file byte.
The normalized reader confirms the same text and indentation in all 143 items
and 5,543 lyric rows. The weighted population remains 142 items and 5,491 rows.
The existing zero-weight copy of “Verse: Sent To Heaven” retains its title, body
hash and weight; its physical title coordinate moves from 5,113 to 5,218.

The corpus manifest, population fingerprint, local source-ledger hash and
runtime asset hash are rebound to the changed metadata. No measured input text,
calibration weight, threshold, frequency table or program behavior changes.

## Verification

- Rechecked all 136 inserted references against their complete current bodies
  and all three checksum-verified source files.
- Corpus manifest and taxonomy checks pass; taxonomy regressions pass.
- All 35 production-data regression tests pass with staged research resources.
- Source/header/hash audit across 1,430 files reports no failures and no Procter
  findings. The standing findings remain nine A notes, eight B warnings and four
  B notes; this is not a claim that the whole corpus review is finished.
- Documentation checks and whitespace validation pass.

The first production-data test attempt lacked the research resources and lost
access to the locally installed NLTK package in its isolated subprocess. The
complete suite passed after those environment dependencies were supplied.

## Remaining source questions in this file

Two pieces match both PG2304 and PG26715, so their exact source is not assigned:

- Sent To Heaven
- Verse: Sent To Heaven

Five pieces have no complete-body match under the declared coordinate and need
closer source comparison:

- Verse: Life In Death And Death In Life
- Verse: A Chant
- Verse: My Picture Gallery
- Verse: A Comforter
- Verse: Hearts

These seven remain unchanged. The separate apparatus annotation work in PR #283
is outside this source-reference batch.
