# Song Forms nesting review

Extract the ZIP and open `dist/index.html`. Choose a form to inspect its diagram and follow the evidence for a connection. Search **Binary** to see competing accounts and **Petrarchan sonnet** to follow the incoming Miltonic variant. The five navigation groups retain the catalog’s organization. The **Name search only** panel finds similar titles.

## What was checked

The two source inventories contain the same 364 entries in the same order, with 61, 89, 105, 65 and 44 entries in groups A–E. The closing claim of 378 has no corresponding 14 rows. Of five fields compared per row, 349 records match completely. Fourteen descriptions remove named examples, and one title is shortened to Cinquain. The original source and R2’s posted copy are preserved for provenance. The current explorer builds from the posted copy and exports the reviewed presentation fields. The source inventories originated as knowledge surveys. Independent evidence is recorded separately.

| Current result | Count |
|---|---:|
| Diagrams audited | 364 |
| Supported within the stated scope | 211, comprising 112 with external evidence and 99 supported only by the catalog and model |
| Partial / contested diagrams | 126 / 27 |
| Models with any changed field relative to the original prototype | 282 |
| Diagrams edited / diagrams with changed branching structure | 222 / 150 |
| Reviewed candidate relationships | 404 |
| Supported / rejected / ambiguous | 383 / 16 / 5 |
| Supported relationships with per-link external evidence / with catalog and model evidence only | 185 / 198 |
| Previously displayed assertions retained / removed | 196 / 11 |
| Newly supported / withheld candidates | 187 / 10 |
| Edited alias fields / originally populated alias fields | 89 / 177 |

The relationship counts refer to directed assertions. An incoming “Has variant” points back to the same child-to-parent assertion. Several forms have alternative diagrams, and a shared scheme alone cannot establish historical descent. The 2,194 diagram nodes were screened for explicit catalog-unit vocabulary. The 289 matches carry a decision or a scoped reason for withholding an inference. These counts describe the recorded comparisons. They cannot establish worldwide completeness or demonstrate executable recognition of 364 forms.

## Gaps and meter

The independent comparison covered 623 survey rows. Of those, 15 matched catalog entries directly, 23 matched aliases or variants, 535 concerned a different level of description, and 47 require further evidence. Three supported gaps remain within that survey’s scope: ritornello form in an English vocal work, terminally climactic form, and the liturgical sequence in English use. Compound AABA can describe a higher-level reading of the existing verse–chorus–bridge diagram. The varying-length refrain already occurs in the rondel and triolet. Historic tune and English performance claims still require their own witnesses. The poetry comparison separately records 198 glossary heading occurrences, including absent genres, organizing procedures and structures. Its findings and the 15 music comparisons can overlap other inventories.

The meter ledger accounts for 203 research IDs. It links 87 IDs to illustrative catalog forms through 105 distinct pairs. Of these pairs, 53 have cited evidence for the comparison’s scope and 52 rely on the catalog comparison. The remaining 116 IDs have no illustrative link. Each pair identifies scope, governed unit, strength and evidence. This crosswalk supplies examples and leaves other form-to-meter links open. A line’s spoken stress, a syllable or mora count, a musical bar and a rhyme scheme have different tests. The pinned repository has a strict comparator for a supplied stress pattern. The writer plan’s Stage 7c addresses a declared-pattern report. The separate five-family recognizer belongs to #677 Stage 3, with the wider inventory in #804. Ordered unequal line lengths and exact counts remain explicit limits.

## Using the files

| File | Contents |
|---|---|
| `R2-reconciliation.md`, `R2-*.md` | Dispositions for T1–T29 and P1–P55 and the supporting table and meter reviews. The aggregate figures above include the final direction and evidence checks after the individual reviews. |
| `coverage-summary.json`, `coverage.tsv`, `relationships.tsv` | Regenerated counts, one row per form and one row per candidate relationship, including evidence assessed for the specific claim. |
| `model-changes.json`, `model-unit-crosswalk.tsv` | Structured differences from the original prototype and the path-level unit audit. |
| `baseline/`, `models/`, `audit/`, `dist/` | Original explorer snapshot, revised models, adjudications and current offline explorer. |
| `english-forms.md`, `comparison/r2-post.md`, `comparison/r2-row-diff.tsv`, `comparison/title-map.json` | Exact source copies, source-line differences and stable title mapping. |
| `comparison/alias-overrides.json`, `comparison/search-terms.json` | Reviewed alternate names and scoped discovery terms used in the current browser build. |
| `comparison/issue-676-crosswalk.tsv`, `comparison/meta-forms.json` | All 320 earlier placements and 62 formal or meta terms. |
| `comparison/structure-crosswalk.md`, `comparison/structure-crosswalk.json` | Findings, methods and all 623 survey dispositions. |
| `comparison/song-gaps.json`, `comparison/external-poetry.json` | Seven music references and two bounded poetry glossary screens with dispositions and remaining uncertainty. |
| `comparison/meter.md`, `comparison/meter-crosswalk.tsv`, `comparison/meter-links.tsv` | Runtime and planner boundaries, the complete research-ID index and individual meter-link records. |
| `validation.md`, `r2-file-changes.tsv` | Validation receipts, execution limits and file-by-file SHA-256 changes against the first review ZIP. |

Run `python3 -B reconcile.py` from the package root, or pass the absolute package directory to the script from elsewhere. Both explorers open offline. The revised JSON and JavaScript describe and display the data. The review package makes no production changes. R2’s findings are recorded here for the next independent review by Andrej.
