# Draft genre checkpoint 040

Frozen source snapshot **8bb2cee97d5feee7b48147b61da9a61ea5f5c71c** has been rebuilt and tested in an isolated worktree. **Not qualified for merge.**

- 2,354 reviewed profile repairs, including 336 prose-only partials with musical holds still open.
- 178 reviewed additions remain evidence only and are not imported. Seven earlier queued entries remain held separately.
- Original baseline cohort of 2,638 records and extras preserved. The live catalog has 6,538 traditions and 1,638 instruments. Shared engine, pipeline and regression snapshots are unchanged.
- Later reviewed changes and unfinished work remain separately preserved on the continuation branch and in the workspace; they did not alter frozen build inputs.

## Rebuild and checks

The original static API pipeline completed with two workers: all 6,538 traditions compiled, zero failures, every recipe within 1,000 characters and every ID resolving. Discovery, atlas and HTML regeneration completed. The static API contract now passes; generated files no longer lag this source snapshot.

Reference, signature, descriptor-table, duplicate, lint, formatting and full documentation checks passed. Of 29 supporting build, regression, connector and UI checks, 27 passed. Two UI failures match earlier baseline observations: enlarged-image thumbnail retention, and browser policy blocking the reachability check's generated file URL.

Serial recipe regression matched **1,045 of 1,149 fixtures**. The other 104 were replayed independently: reverting only genre data in process memory restores every prior output, configuration and score. This proves causality, not correctness. The changed catalog affects 448 unprotected settings across 101 fixtures. Explicit emitted blockers include an Andean choir for male gospel quartet, Sardinian cantu a tenore for Methodist hymnody, and a brushes-based groove-metal rendition. No blanket snapshot refresh was performed.

See frozen-validation.json for checks and frozen-regression-review.json for all 104 individual dispositions. Baseline, current and counterfactual replay records are included beside them. Earlier source evidence and partial-repair limitations remain in reviewed-repairs.json.

**Pending:** regression qualification, remaining musical-default/render holds, unfinished source review and green exact-head CI including artifact reproducibility. Keep this PR draft and unmerged until qualified.
