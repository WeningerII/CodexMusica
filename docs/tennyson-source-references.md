# Tennyson source-reference recovery — 2026-09-15

This completes the uniquely supported references in the next English corpus
file after the Procter batch. Alfred Tennyson's file had ten items without a
per-item source reference. Six now have a verified reference; four still match
multiple declared witnesses and remain unassigned.

All eight source texts already named in the corpus header were fetched again
and matched their recorded MD5 checksums. Every missing item's entire body was
compared against every witness. The comparison uses NFC-normalized, casefolded
Unicode words, with punctuation, underscore emphasis and layout removed.
Each assignment matches exactly one of the eight witnesses. This establishes
a textual witness under that coordinate; it makes no new edition, rights or
printed-song eligibility decision.

| Item | Source |
|---|---|
| Thy voice is heard through rolling drums | PG791 |
| Home they brought her warrior dead | PG791 |
| Now sleeps the crimson petal, now the white | PG791 |
| The Daisy. Written At Edinburgh | PG56913 |
| To The Rev. F. D. Maurice | PG56913 |
| The Charge Of The Light Brigade | PG56913 |

The first five bodies match complete contiguous source passages. The last
matches after excluding the source's five internal stanza-number lines,
`2.` through `6.`. The first stanza's `1.` precedes the matched passage.
Each omitted heading's original text and physical line number is recorded;
every remaining source word matches the complete corpus body in order.
No lyric word is omitted, substituted or approximated. This comparison does
not modify either the corpus reader or the source text.

The [verification receipt](tennyson-source-references.json) records the
baseline commit, source URLs, encodings, byte counts, MD5 and SHA-256 hashes,
passage boundaries, body hashes, assignments and remaining matches.

## Conservation

Removing precisely the six added `--- SOURCE:` lines recovers every byte of
the baseline corpus file. All 42 items, 1,771 lyric rows, indentation and
calibration weights are preserved, including the 32 existing source references.
Every physical line moves only by the number of metadata insertions before it.
This file has no explicit edition-policy entries or apparatus-receipt entries
requiring coordinate migration. The reader fingerprint is unchanged.

The corpus manifest and its population binding are refreshed together. The
existing Princess and Maud source-ledger rows retain all prior evidence and
admission fields, with the verification appended to their notes. The runtime
source-ledger checksum is rebound. No calibration value, frequency table or
runtime code changes.

## Remaining ambiguity

| Item | Complete-body matching witnesses |
|---|---|
| As through the land at eve we went | PG791, PG2620 |
| Sweet and low, sweet and low | PG791, PG26715, PG2619 |
| The splendour falls on castle walls | PG791, PG66619, PG26715 |
| Ask me no more: the moon may draw the sea | PG791, PG2620 |

These four bodies are supported by the recorded witnesses, but the comparison
cannot identify one source uniquely. Their text is retained and no source is
chosen by title similarity, source order or another item's attribution.

## Verification

- All 36 production-data regression tests pass with pinned runtime dependencies
  and the existing research resources staged.
- An independent comparison against the Git baseline preserves every original
  normalized row, indentation, item identity and weight. All reported source
  passages and checksums were independently rechecked after editing.
- Corpus manifest (1,430 files), taxonomy checks and regressions, corpus-audit
  regressions, runtime asset integrity, documentation, formatting and traced
  build dependency closure pass.
- The complete before/after audits are identical: 1,298 findings, comprising
  one failure, 97 warnings and 1,200 notes. The standing failure treats the
  Persian Hafez licence notice as verse and is addressed separately by PR #287.
  No Tennyson finding is introduced. This batch does not claim the whole audit
  is green.

The first local application attempt stopped because it expected a separate
local Tennyson ledger row. The file is represented by its existing upstream
rows. The partial edits were restored to the baseline, and the complete rerun
appended verification notes to the existing Princess and Maud rows while
preserving every prior field. All validation above ran after that correction.
