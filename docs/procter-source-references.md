# Procter source-reference recovery — 2026-09-15

The unfinished English corpus review had established source matches that were
never published. The first batch added 136 per-item references in Adelaide Anne
Procter's existing corpus file. The follow-up resolves its five unmatched bodies,
bringing the total to 141 references: 87 to PG2303 and 54 to PG2304.

All three source files already cited in the header were fetched again and
verified against their recorded MD5 hashes. Each initially assigned item's complete body
matches one contiguous passage in exactly one of those three witnesses, under
the review's declared matching coordinate: NFC-normalized, casefolded Unicode
words with punctuation, underscore emphasis and layout removed. This establishes
a textual witness; it does not establish identical typography, introduce a new
edition or licensing ruling, or settle printed-song eligibility.

The original per-item mappings, body hashes, source URLs and checksums are
recorded in [the initial verification receipt](procter-source-references.json).
That receipt retains the original batch's coordinates, counts and unresolved
cases. [The follow-up receipt](procter-source-followup.json) records the five
later assignments against merged baseline `edbd2a8ba5a661a72556b57b9916268513b0ac53`.

## Five additional references

The five bodies did not match contiguously because their source passages contain
36 standalone Roman-numeral section headings. Excluding only those exact printed
heading lines makes every remaining source word equal the complete corpus body,
in order. The receipt records each heading's original text and physical source
line, passage boundaries, body hashes and source checksums. All three cited
witnesses were checked; each of these five has exactly one matching witness.
No lyric word was omitted, substituted or approximated in this comparison.

| Corpus item | Source | Printed headings inside the passage |
|---|---|---:|
| Life In Death And Death In Life | PG2303 | 1 |
| A Chant | PG2304 | 3 |
| My Picture Gallery | PG2304 | 14 |
| A Comforter | PG2304 | 16 |
| Hearts | PG2304 | 2 |

The PG2304 passage for A Comforter itself has no XIII heading; the comparison
does not manufacture one. These exclusions apply only to source comparison;
the production reader and source files are unchanged.

## Conservation

Removing the five follow-up `--- SOURCE:` lines recovers every byte of the
merged baseline file. Its 143 items and 5,538 normalized lyric rows retain the
same text and indentation; the weighted population remains 142 items and 5,486
rows. The initial receipt's counts predate the separately merged apparatus
annotations. No lyric row changes in this follow-up.

The existing zero-weight copy of “Verse: Sent To Heaven” retains its title, body
hash and weight; its physical title coordinate moves from 5,218 to 5,221. The
earlier 5,113-to-5,218 migration remains recorded in the initial receipt.

The merged apparatus receipt also uses physical coordinates. Six of its ten
Procter entries move by four lines. Every original physical line is preserved;
the prior three hash formulas are reproduced before rebinding their values.
The follow-up receipt retains the full previous apparatus record. Neither the
annotations nor their classification changes.

The corpus manifest, population fingerprint, local source-ledger hash and
runtime asset hash are rebound to the changed metadata. No measured input text,
calibration weight, threshold, frequency table or program behavior changes.

## Initial verification

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

## Follow-up verification

- Independently checked all 141 references by physical item identity, including
  repeated titles, against the checksum-pinned source texts. The five additional
  bodies contain 2,413 normalized words across 358 lyric rows.
- All 36 production-data regressions pass with the repository's pinned runtime
  dependencies and staged research resources, including exact apparatus
  preservation and edition-policy checks.
- Corpus-audit regressions, taxonomy checks and regressions, manifest checks,
  runtime asset integrity, formatting, documentation and traced build closure pass.
- The A/B source audit has no failures or Procter findings. The complete audit
  shape remains the baseline's one failure, 97 warnings and 1,200 notes. The
  standing failure is the separately addressed Persian licence notice; this
  follow-up does not claim that finding is resolved on its branch.

The first local test attempt exposed the apparatus-coordinate dependency and
missing local test resources. Coordinates and hashes were remeasured, resources
were staged, and the full 36-test suite then passed. No calibration values,
frequency tables, runtime code or source-admission decisions changed.

## Remaining source questions in this file

Two pieces match both PG2304 and PG26715, so their exact source is not assigned:

- Sent To Heaven
- Verse: Sent To Heaven

These two remain unassigned. The five formerly unmatched pieces are resolved
above. The separate apparatus annotation work in PR #283 is already present in
the follow-up baseline; no additional apparatus annotation is included here.
