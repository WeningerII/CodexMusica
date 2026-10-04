# Draft genre checkpoint 040

This expanded candidate retains **2,153 reviewed repairs** and defers **201 proposals** from the complete **2,354-repair** frozen checkpoint. All proposed before/after objects, source evidence, and existing holds remain preserved. Deferral does not mean a source correction is historically wrong.

The catalog remains at **6,538 traditions and 1,638 instruments**. The original baseline cohort of **2,638 records and extras**, all existing instrument owners, shared engine, and original regression snapshots are preserved. PR #481 (main commit `70426a9861fe2591e66789879a6fde3082aad4f6`) remains unchanged. The 178 reviewed additions remain evidence only; later work remains separate.

## Current expanded qualification

- **1,149/1,149 original serial recipe snapshots pass**, without snapshot updates.
- **260/260 directly replayed complete musical configurations and outputs match baseline**, with zero changed slots. Cached numeric scores are excluded from this comparison; no exact-score equality is claimed.
- The other **889 fixtures** have identical weighted-neighbor and reachable companion-tradition graphs and no retained changed records in their read contexts. Their full configurations were not independently replayed.
- The unchanged API builder completed with two workers: **6,538 traditions, zero failures, 1,638 instruments**, in 628.8 seconds. Its self-check confirms valid IDs and recipes within 1,000 characters.
- Reference validation, lint, formatting and documentation checks pass. **27/29 supporting checks pass**, including API contract, atlas, generated HTML, browser/connector parity and edit differential.
- Two local failures remain: the photo-dialog foundation failure is byte-identical to the prior subset result; reachability is blocked by the browser administrator policy for file URLs. Both logs are preserved. **Exact-head CI remains pending; this draft is not approved for merge.**

The expanded source catalog exactly matches the independently tested in-memory candidate. See `subset-independent-audit.json`, `subset-config-coverage.json`, `subset-exact-comparison.json`, and `subset-source-binding.json`.

## Preserved history and limits

The earlier conservative candidate retained **1,734 repairs** and deferred **620**; its reports and complete archive are preserved under `historical-1734-*`. Those validation results are historical. The expanded candidate reclaims 428 of those holds and defers nine other records, retaining **419 additional repairs** overall, including 356 structural repairs.

An intermediate 2,210-repair candidate passed all rendered snapshots but changed 51 hidden slots across 29 fixtures. It remains held. Restoring 57 additional whole records produced the current candidate. No correct prose was rewritten merely to steer the optimizer.

All **104** full frozen-checkpoint differences retain their individual musical reviews: **32 compatible changed-setting cases, 72 cases with specific concerns, seven whole outputs qualified, and 97 whole-output holds**. These counts concern the original full proposal and do not authorize snapshot refreshes. `musical-qualification.json` preserves the individual findings.

Gospel quartet, Methodist hymnody, and groove-metal changes were traced to specific repaired neighboring records and fields. Whole-record counterfactuals restore their baseline configurations; rendered equality alone can hide configuration drift. `regression-data-causes.json` and the unapplied original-record proposals preserve that evidence.

Containment does not fix inherited baseline mistakes, including unsupported baseline choir identities. Original-record correction proposals remain unapplied and retain their limitations. Independent source-projection audit passes for all 6,538 generated API records and 223,214 owning slot selections; see `subset-generated-api-audit.json`. Nonfixture and inherited musical holds are not cleared by fixture equality. No shared-code fix, baseline-row edit, or blanket snapshot replacement is part of this candidate.

The `frozen-*` reports describe the earlier full 2,354-repair snapshot. `reviewed-repairs.json` preserves all proposals with explicit current dispositions; `deferred-proposals.json` contains the current 201 complete deferred before/after objects.
