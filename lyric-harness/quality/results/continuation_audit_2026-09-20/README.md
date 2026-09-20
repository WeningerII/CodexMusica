# Continuation repair evidence

The narrative, scope, controls and unfinished work are in
`docs/lyrics-continuation-audit.md` at the repository root. M-304 is the work
record; F01–F09 are labels from the supplied external audit.

| Artifact | Contents and interpretation |
|---|---|
| `baseline.zip` | Reproduction receipts against main `30bef2a`, supplied runnable probes, and failing regressions for later discoveries. The `baseline/` and `supplied-repro/` prefixes distinguish observations from probe source. These files intentionally contain failures. |
| `interviews.zip` | Eleven operator-written public creation sessions: exact requests, responses, plan exports and timings. Frozen and unfinished sessions are included, not relabelled as successful songs. Private client snapshots are excluded. |
| `session-metrics.json` | Receipt-derived timings and maximum saved response/state sizes. Operator intervals include debugging and other verification. Saved response bytes are not transport-wire bytes. |
| `*_case.json` | Frozen production inputs consumed directly by regression tests. |
| `ticket-source*.json` | Before/after source identity for Half a Ticket, on commit `6f28dce`; the source did not change during that run. A later test-assertion correction is not part of its writing qualification. |
| `consonance-monosyllable-bound.json` | Diagnostic count over the declared vowel features. This excludes mutually consonant groups of five monosyllabic anchors, not every possible multisyllabic realization of the plan. It supplies no lyric or word candidates. |
| `deployed-health-before.json` | Read-only health identity observed during local work. Its old commit does not verify these repairs in production. |
| `calibration-rows.zip` | Eight freshly computed row shards, their original provenance sidecars and compute logs, at comparator `de112e81810f`. Earlier partial computations were discarded. |
| `curve-check.txt` | Normal provenance-checked re-derivation: all five shipped curves hold across 8,536 items. This is the comparator pin's receipt. |
| `verification.zip` | Local test logs, including failed/intermediate history. Use the mapping below for the final results; an old filename containing “final” does not supersede a later repair. |
| `artifact-index.json` | SHA256 and size of every other file in this evidence directory, including the archives. |
| `local-history.bundle` | Original local audit commits through `8c8dfb5`, including the fresh-run source commits. Requires their main-branch ancestors, available in the full repository history. Shell push lacked credentials; authenticated GitHub object publication creates a new commit for the same source tree. This bundle preserves the original commit identities for reproduction. |

To import that history from a full checkout, run from the repository root:
`git fetch lyric-harness/quality/results/continuation_audit_2026-09-20/local-history.bundle refs/heads/fix/lyrics-continuation-audit:refs/remotes/audit/local-history`.
The bundle predates its own addition, so it cannot contain itself.

Final implementation results inside `verification.zip`:

- `continuation-audit-delivery.log`: 11 MCP continuation tests, all passing.
- `production-delivery.log`: 41 production revision and 20 journal tests pass;
  the obsolete pronunciation assertion fails. `pronunciation-delivery-final.log`
  supplies the corrected 15-test pass, retaining the real unresolved-reading guard.
- `production-offline-delivery.log`: Node and intermediate Python stages pass;
  stops at that same assertion. The pronunciation log above and
  `math-delivery.log` (24 passing tests) complete the affected stages separately.
- `replay-memo-delivery.log`, `propose-final.log`, `loop-final.log`: passing
  replay, proposer and loop controls. Later retirement coverage is also in the
  production/MCP logs above.
- `mutation-qr7-final.json` and its log: clean baseline and one caught mutant;
  earlier indeterminate attempts remain in the archive.
- `lint-delivery.log`, `docs-delivery-final.log`, `entries-delivery.log`,
  `doctrines-delivery.log`: passing local static/documentation checks.

Calibration logs from abandoned fingerprints are historical only. The eight
`calibration-adoption-*` rows and sidecars in `calibration-rows.zip`, and the
normal `curve-check.txt`, are the adopted measurement.

The diagnostic bound can be reproduced by enumerating subsets of
`lyric_harness.VOWELS` and counting those for which every pair satisfies
`vowel_sim(a, b) < Declaration().theta_nucleus`. The counts for subset sizes
1 through 5 are 15, 65, 86, 23 and 0. No candidate vocabulary, private lyric
grade, relaxed threshold or adopted calibration is involved in that count.

Run the regression witnesses from `lyric-harness/`, after the documented
Node/Python dependencies and lexical inputs are staged:

```sh
node --test --test-concurrency=1 ../mcp/test_continuation_audit.mjs
python3 -m unittest discover -s quality -p test_production_journal.py
python3 -m unittest discover -s quality -p test_production_revision.py
python3 quality/test_pronunciation_choices.py
python3 quality/test_replay_memo.py
python3 quality/test_loop.py
python3 quality/test_propose.py
npm --prefix .. run test:production:offline
```

Use the pinned Python as `LYRIC_PYTHON` and on PATH for the MCP suites: some
subprocess controls explicitly invoke `python3`. The writing runner is
`scripts/qualify_lyric_interview.mjs`; deterministic regression writers do not
establish fresh-song success.
