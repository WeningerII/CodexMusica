# M-282: capacity matrix placement

Decision date: 2026-09-17. Starting main: `fe9181f7319869ea44a7a1540b95b495705d3b81`.

The remaining placement decision is closed: the full CPU/memory capacity matrix
belongs in Production qualification. Its result is required both by that
workflow's final aggregate job and by the deployment verifier at the exact trusted
commit and workflow attempt. PR CI retains the actual-runtime capacity proof,
image smoke/restart checks and adversarial acceptance controls.

The tradeoff is explicit: a resource-capacity regression can merge to main and
will block deployment at qualification. All nine cells and eighteen executions,
resource limits, timeouts, source consistency, recovery, queue pressure, leak
checks and merger refusals remain unchanged. The scheduled and manual
qualification paths both own the matrix. No comparator or calibration changes
are needed for this move.

## Basis and coordination

[PR #262](https://github.com/WeningerII/CodexMusica/pull/262) implemented the
original sharding and proof admission and merged as
`2cfe01d0db5101c1cf89661d85022f2a1c9fb37c`. It explicitly left matrix placement
undecided. The assigned follow-up now authorizes that decision.

The September 12 measurements in MISSING remain historical: the unsharded matrix
cost 20.9 minutes in CI run
[34711856241](https://github.com/WeningerII/CodexMusica/actions/runs/34711856241),
and the first sharded run
[34719451654](https://github.com/WeningerII/CodexMusica/actions/runs/34719451654)
completed in 24.6 minutes with the pole job on its critical path. These records
motivate moving a deployment-envelope measurement to deployment qualification;
they do not establish a new wall time or promise ten-minute CI.

The four matrix runners now share qualification's existing account concurrency
limit with its component jobs. No qualification speedup is claimed. Image seeds
are optional and checked by the image's existing proof admission; a missing or
stale seed requires measurement. The runner proof has a different interpreter and
cannot supply the image proof.

Open PRs #328 (M-168) and #329 (M-256) were inspected; their implementations do not
touch this workflow placement or the comparator. Newly opened #330 adds the
M-294 counter-gate record; it also does not change these workflows. Recent merged planning, replay
and diagnostics work through #327 is present in the starting base. The separate
M-244 assignment owns other CI bottlenecks; this change only settles M-282's
placement. Current main must be integrated and checked before merge.

## Verification receipts

`mutation-controls.json` records the new tests failing against the old placement
and release requirements, and against individual removals of aggregate refusal
and the deployment matrix requirement. Each temporary mutation is restored before
final verification. These expected failures are controls, not passing suites.

`workflow-delta.json` compares parsed workflow jobs against the starting base:
the reusable matrix is semantically unchanged, CI loses only its matrix caller
and result job, and qualification adds them and changes its final aggregate.

`verification.json` records actual commands, stdout, stderr and exit codes on the
repaired tree. The workflow controls execute the actual shell result checks with
successful, empty, skipped, cancelled and failed dependencies. The release tests
reject missing, non-successful, unfinished and duplicate matrix jobs, including
an attempted substitution of successful CI evidence. The existing capacity
oracle suite still tests the complete cell deal and adverse merger inputs.

This environment has no Docker executable. The resource matrix itself was not
rerun locally; unchanged matrix semantics are covered by the oracle suite, and a
future production qualification must produce its actual matrix before deployment.
PR CI and post-merge CI outcomes are reported on the pull request after observing
the published and merged commits; local tests alone are not those outcomes.
