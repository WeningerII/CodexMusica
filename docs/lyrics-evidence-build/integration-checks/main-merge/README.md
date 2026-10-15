# Main reconciliation verification

Normal merge `77a17625952946a801cbe61023f7115e268a4c17` joins prior integration
`61b84515ec93a6ecc86f7740cc797d70a40e4eca` with main
`ae349d7f8dab5a687408baa6b171134b5283c0d4`. PR #569 remains stacked on #562.

Independent source review confirmed that H1 pronunciation files and the integrated
Lyrics page/tests are byte-identical to the prior integration. The P-A functions
occur once and match main. The only new production change is the importer audit
description constant; its 299 characters equal the historical docstring, and
matching logic is unchanged.

The generated HTML was rebuilt explicitly and compared with an independent output
path. Both retain SHA-256
`ad8332b85263638c5da92b2c0401adad09da70e529720d81b37d4b5d155f19ad`.
The map was regenerated and rechecked after resolving the merge index. An earlier
regeneration during unresolved stages counted duplicate index entries; the final
map check uses the resolved index and passes.

Fresh checks on the merged source:

- [809 page assertions](page.txt).
- [16 inspector journeys](inspector-results.json) and [8 actual local transport cases](transport-results.json).
- [14 importer tests on Python 3.12](importer312-tests.txt) and [14 on Python 3.13](importer313-tests.txt).
- [725 generated importer files byte-identical](importer-bytes.json); next/third importer checks pass.
- [Explicit HTML build](build.txt), [independent build](independent.txt), [resolved-index map check](map-final-check.txt), and [changed-file formatting](format.txt).

[Importer commands](importer-commands.txt) and [inspection receipt](inspection-receipt.txt)
record runtime details. No provider calls, merge into main, deployment, or hosted
acceptance occurred. This receipt does not claim remote CI or independent release
acceptance.

## CI registration and counters

Tools commit `cdcd76e2879ca7f5df2c474185dc66e588a098da` was consumed as
`aab487193` after the main merge. It adds `schema_instance_evidence` to the
existing runnable suite list (110 entries) and replaces the generated public-symbol
counter row. No grading, transport or frontend behavior changes.

The [registration census](ci-census.txt) accounts for all 125 quality test files,
including its adversarial controls. The [producer suite](producer.txt) passes
9 tests. The full pre-patch counter check reproduced exactly the stale
1742/436/511 row; the merged tree measures 1744/437/512, matching the generated
patch. A fresh [full post-patch counter check](counters-after.txt) passes.
The [map check after CI integration](map-after-ci-check.txt) passes.

The repository's full CI gates remain enabled; these local receipts do not stand
in for a final-head remote CI result.
