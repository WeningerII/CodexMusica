# Song Forms

Extract the complete ZIP and open `dist/index.html`. Use **Find a form** to browse 364 entries, inspect their nested structures and follow their connections. Try **AB** for Binary. **Review details** identifies the selected form’s review status. Source passages and historical examples are kept in the separate research package. **Name search only** finds similar titles independently of the reviewed graph.

## Explorer and research files

The standalone explorer consists of the seven files in `dist/`. Its catalog includes form names, curated search terms, structural labels and symbols, relationship kinds and node paths, and enumerated review judgments. Names intrinsic to a form remain searchable. The displayed diagrams use positions, counts, returns and section names.

The research files outside `dist/` preserve historical inventories, witness passages, citations, review reasoning and earlier builds. Distribute `dist/` alone for inspection without that material. The GitHub review branch contains both so reviewers can verify the evidence. The package has no production connector, writing prompt or runtime integration. The offline test substitutes markers throughout the research inputs and verifies byte-identical public output.

## Coverage

The original inventory and R2’s posted inventory both contain 364 entries in the same order. Sections A–E contain 61, 89, 105, 65 and 44 entries respectively. The original closing estimate of 378 is inconsistent with the actual tables. Fourteen descriptions and one title differ between the two inventories. The stable Cinquain identifier works with either one.

| Diagram judgment | Meaning | Count |
|---|---|---:|
| Supported | The diagram represents the organizing rule or the explicitly bounded construction that it claims. | 352 |
| Partial | The note identifies a material rule, position, branch or identification that remains unresolved or omitted. | 12 |
| Contested | Two traceable accounts disagree about the same feature at the same scope. | 0 |

**Evidence and status answer different questions.** Of 352 supported diagrams, 92 have a passage checked for the stated scope, 110 carry a reference whose passage remains unchecked for the claim, and 150 rely on the catalog and model. Of the partial diagrams, 8 have a checked passage. The evidence ledger preserves the scope and limits of each check.

Relative to the first prototype, 291 models have changed. Of 244 edited trees, 195 changed their branching structure. The node screen visits 2,734 nodes and records 418 explicit word or size matches. It covers the declared vocabulary. The explorer displays form structures for inspection.

## Connections

| Kind | Meaning | Current facts |
|---|---|---:|
| Variant | The child inherits a documented organizing feature from a broader form. | 76 |
| Contains | A specified part of a displayed construction realizes the target. Every assertion gives its node path and its scope. | 215 |
| Shared feature | A specified property occurs in both, without requiring membership or a component. | 85 |
| Comparison | A structural comparison identifies a relevant similarity or difference. | 29 |
| Other | A specific contextual association outside the preceding kinds. | 1 |

The ledger contains 448 decisions. There are 406 distinct supported connections, 20 inverse restatements redirected to canonical facts, 17 rejected and 5 ambiguous. Of the supported connections, 68 have a passage checked for their scope, 144 carry references awaiting claim verification, and 194 rely on the catalog and model.

## Gaps and meter

The survey covers 623 terms. Fifteen are present directly, 24 describe aliases or variants, 560 concern another layer of the music, 19 remain candidates, two have unidentified referents and three are supported omissions within the survey. The three are **ritornello form**, **terminally climactic form** and **the liturgical sequence in English use**. All 47 previously undecided rows now have term-specific dispositions. Current uncertainty includes English-language use and the identity of two survey terms. A candidate has no implied production or catalog approval. The research also covers 320 placements from issue #676, 62 formal or meta terms, 198 poetry glossary heading occurrences and 15 findings from seven music reference comparisons.

All 203 meter research IDs are accounted for. There are 105 illustrative ID/form pairs across 87 IDs; 116 IDs have no illustrative link. Of the 105, 53 cite evidence for the scope and 52 rely on the catalog comparison. Each pair identifies what is measured and where. A musical bar, a required verbatim return, a syllable count and a stress reading require different information. The pinned main planner’s exact total number of lines is separate from its ability to state per-line syllable or stress counts. The confirmed Onegin case collision and burden-first restriction, plus the differing bridge recurrence policies on main and Stage 4, are documented in Andrej-meter.md. No planner change is included.

## What to open

| Location | Purpose |
|---|---|
| `partial-entries.md`, `comparison/partial-entry-decisions.tsv` | Corrections and remaining questions for every one of the 90 original partial diagrams. |
| `catalog-corrections.md` | Current dispositions of the 16 catalog discrepancies. Earlier reviewer files retain their historical judgments. |
| `Andrej-reconciliation.md` | Disposition of every finding and nit from the independent review. The graph, scope, meter, build and search companion files give the underlying checks. |
| `coverage-summary.json`, `coverage.tsv`, `relationships.tsv` | Current totals, one form per row and one assertion per decision. |
| `comparison/claim-source-ledger.tsv`, `comparison/andrej-evidence.json`, `comparison/rechecked-sources.json` | Dated source access, exact locators, scoped paraphrases and cases with no passage receipt. |
| `models/`, `audit/`, `comparison/andrej-status.json` | Diagram trees, underlying judgments and later global status adjudication. The builders join them through evidence.py. |
| `model-changes.json`, `model-unit-crosswalk.tsv` | Structured differences from the first prototype and node-by-node decisions. |
| `comparison/structure-crosswalk.md`, `comparison/structure-crosswalk.json` | Evidence and dispositions for all 623 survey terms. |
| `comparison/meter.md`, `comparison/meter-crosswalk.tsv`, `comparison/meter-links.tsv` | Implementation boundaries, complete meter inventory and normalized links. Names of editors, historical terms and works here are review-only provenance. |
| `comparison/issue-676-crosswalk.tsv`, `comparison/meta-forms.json`, `comparison/song-gaps.json`, `comparison/external-poetry.json` | Earlier inventory and music/poetry reference comparisons. |
| `english-forms.md`, `comparison/r2-post.md`, `baseline/` | **Provenance only.** Preserves the original inventoried prose, names and historical prototype. Use `dist/` for the corrected explorer. |
| `R2-reconciliation.md`, `R2-*.md`, `r2-file-changes.tsv` | Prior R2 reconciliation and historical hashes against the first ZIP. Current evidence and totals are above. |
| `andrej-file-changes.tsv`, `validation.md` | Exact SHA-256 changes relative to the incoming 79-file package and reproducible verification receipts. |

From the extracted package run `python3 -I -B verify-offline.py`, then `python3 -I -B source-ledger.py --check`. The checks use Python’s standard library. For browser checks, run `node verify-browser.cjs` with Playwright and Chromium installed.
