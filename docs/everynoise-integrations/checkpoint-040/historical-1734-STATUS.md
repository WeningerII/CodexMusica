# Draft genre checkpoint 040

Historical checkpoint receipt: counts below describe that frozen build, not the current catalog. The inline count exclusions preserve its original measurements.
This candidate retains **1,734 reviewed repairs** and defers **620 proposals** from the complete 2,354-repair frozen checkpoint. The deferred source changes and their evidence remain preserved here and in commit `d63210cbe63b8d9e7edb9b52de3fa0ee1971aa25`. No proposal was discarded or silently declared incorrect.

PR #481, main commit `70426a9861fe2591e66789879a6fde3082aad4f6`, is included unchanged. The original baseline cohort of 2,638 records and extras, instrument catalog, shared engine, pipeline, and regression snapshots are preserved. The catalog remains at 6,538 traditions and 1,638 instruments. The 178 reviewed additions remain evidence only; later reviews and unfinished work remain separate. <!-- check_docs:ignore -->

## Regression qualification

All 104 frozen-checkpoint differences were individually reviewed. Of these, 32 have compatible changed settings and 72 retain specific concerns. Only seven complete frozen outputs qualify without reservations; other whole-output holds include explicitly identified pre-existing defects. These counts are not permission to refresh snapshots.

The named regressions were traced with unchanged-engine counterfactuals:

- Gospel quartet: the revised Gospel Singers description changes the selected regional choir configuration.
- Methodist hymnody: British Choir's parent change alters the selected companion tradition and choir result.
- Groove metal: the revised Belgian Death Metal description changes the drum technique; ordinary prose affects the original neighbor scoring.

Restoring those three complete neighboring records reproduces the three baseline configurations exactly. Restoring selected fields alone can conceal other changed settings, so output equality alone was not accepted as sufficient evidence.

## Conservative subset

The subset withholds repaired records read by baseline fixture scoring or possible companion-tradition selection, plus structural changes that could alter those dependencies. It is intentionally conservative, not a claim that all 620 deferred source corrections are wrong.

- **1,149/1,149 recipe regressions pass**, with zero snapshot updates.
- **104/104 complete configurations, numeric scores, and emitted outputs** match the baseline exactly.
- The existing API builder completed with two workers: **6,538 traditions, zero failures**, valid IDs and recipes within 1,000 characters. <!-- check_docs:ignore -->
- Reference, lint, formatting and documentation checks pass. Of 29 supporting checks, 27 pass. The local enlarged-photo check repeats the frozen predecessor failure that passes GitHub CI; file-URL reachability remains blocked by browser administration. Exact-head CI for this subset is pending. See subset-validation.json.

Containment does not fix inherited baseline mistakes. The old gospel and Methodist results already contain unsupported choir identities. Concrete original-record data proposals remove the three named mismatches in isolated tests, but remain **unapplied** under the original-record preservation constraint; their full before/after evidence and remaining limitations are retained.

The earlier frozen commit passed CI artifact reproducibility and 62 of 63 verification checks; recipe regression was its sole failing verification check. Its local enlarged-photo UI failure did not reproduce in CI. The new subset requires its own exact-head CI and remains draft until qualified.

See musical-qualification.json, regression-data-causes.json, subset-selection.json, subset-exact-comparison.json, deferred-proposals.json, and reviewed-repairs.json. The frozen-prefixed reports describe the earlier full snapshot, not the current subset. No shared-code fix or blanket snapshot replacement was made.
