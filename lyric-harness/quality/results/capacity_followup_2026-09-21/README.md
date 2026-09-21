# Capacity and repair-guidance evidence

See `docs/lyrics-capacity-followup.md` at the repository root. M-240 remains
open; M-305 tracks the four distinct feedback causes. The two enumeration
repairs do not raise the 31-line admission ceiling.

| Artifact | Meaning |
|---|---|
| `capacity-public-baseline/` | Exact public refusal of a 128-line request. No shorter run substitutes for it. |
| `fresh-foundry/` | The Last Casting, frozen at missing screen attribution. |
| `fresh-apron/` | The Spare Apron, frozen before answering the false holding instruction. |
| `fresh-flood/` | The Flood Map, frozen before answering the invalid per-call menu. |
| `fresh-bus/` | The Last Bus Home, three accepted edits, then frozen at the false end-word disclosure. |
| `fresh-glasshouse/` | The Glasshouse Key, one accepted edit on final code and an unanswered next question. Source hashes agree before/after. |
| `*_case.json` | Exact frozen regression inputs; the last-bus case includes the public plan. |
| `session-metrics.json` | Receipt-derived timings. Operator intervals include debugging and are not pure writing time. |
| `verification.zip` | Before, intermediate and passing checks. Mapping below distinguishes them. |
| `deployed-health-before.json` | Healthy old runtime; does not verify these repairs in deployment. |
| `calibration-rows.zip` | Fresh row shards, original provenance sidecars and computation logs. |
| `curve-check.txt` | Normal provenance-checked re-derivation receipt; comparator pin refers here. |
| `local-history.bundle` | Local source history, including original commit identities in source records. |
| `artifact-index.json` | SHA256 and byte size of every other evidence file, recursively. |

The session directory names in the table are prefixes inside `interviews.zip`;
that archive preserves their exact JSON bytes. All public runners were closed. Private client snapshots are excluded. No
song in this batch is claimed complete. The preserved pending questions are
not assumed to be live continuations on a later runtime.

## Verification mapping

- `candidate-before.log`: original memory regression fails. `candidate-after.log`:
  all five enumeration controls pass, including exact sequence/counters,
  repeated left spans, sparse projection cost and full-query allocation.
- `projection-mutation-final.log`: restoring repeated bucket scans trips the
  cost assertion while retaining result parity. The earlier mutation log is
  an invalid setup: its cloned globals bypassed the patched span reader.
- `screen-before.log`: two provenance checks fail. `screen-after.log`: screen
  suite passes, including actual CLI output.
- `incident-before.log` / `incident-after.log`: frozen false holding failure,
  followed by its pass and the existing unknown-neighbor control.
- `menu-before.log` / `menu-after.log`: frozen invalid named-relation offer
  fails before and passes after. `flood-menu-probe.log` is the public screen
  of Dark/york. `partial-positive-final.log` preserves legitimate partial
  answers; the earlier positive log used a pair that actually satisfied the
  whole group and is retained as a corrected fixture assumption.
- `kept-before-with-plan.log`: exact false position disclosure fails.
  `kept-frozen-plan.log`: passes using the archived public plan.
  `kept-endword-control.log`: ordinary end-word and real modal-rejection
  controls still pass. The earlier `kept-before.log` omitted the blueprint
  and therefore did not reproduce the public brief; it is not the witness.
- `production-relations-final.log` and `relations.log`: relation semantics,
  frozen enumerator parity and resource guards pass.
- `production-revision-delivery.log`: 44 tests pass before the final wording
  repair; the added frozen-plan test and end-word control above verify that
  final repair separately.
- `revise-final.log`: one obsolete expectation fails. `revise-delivery.log`:
  all 59 sections pass with the corrected fixture and a new holding-pair
  control. The later wording change is covered by the controls above.
- `continuation-final.log`: all 11 public continuation regressions pass.
- The `*-delivery.log` static checks, `entries-complete.log`,
  `counters-complete.log`, `pin-check.log` and doctrine log pass. Historical
  failed and intermediate logs are deliberately retained.

Run the witnesses from `lyric-harness/` with documented dependencies/assets:

```sh
python3 quality/test_candidate_pair_projection.py
python3 quality/test_screen.py
python3 quality/test_production_revision.py
python3 quality/test_revise.py
node --test --test-concurrency=1 ../mcp/test_continuation_audit.mjs
```

To import local history from a full repository checkout:
`git fetch lyric-harness/quality/results/capacity_followup_2026-09-21/local-history.bundle refs/heads/fix/lyrics-capacity-investigation:refs/remotes/audit/capacity-local`.
The bundle predates its own addition and cannot contain itself.
