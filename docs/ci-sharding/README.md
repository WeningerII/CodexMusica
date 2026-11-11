# CI sharding evidence

The target is for each suites, verify and faults job to finish in less than ten minutes while preserving the full test set and required gates. The measurements in [baseline.json](baseline.json) come from eight GitHub Actions runs before this change. They distinguish execution (including setup), runner queue, and dependency wait.

| Job family | Baseline slowest job across eight runs | Candidate partition |
| --- | --- | --- |
| suites | 28m49s–36m29s | Eight runners, with section/test-ID partitions for the five largest modules |
| verify | 25m21s–31m23s | Eight runners; split Library discovery, Node test files, connector phases and recipe fixtures |
| faults | 9m09s–22m21s | Six runners sharing one verified artifact build from the same workflow attempt |
| capacity | 62–92s for all 24 sampled jobs | Retain three runners |

The baseline includes failed scheduled workflows; passing target jobs are distinguished from failed jobs in the JSON. A scheduling projection is not a measured candidate pass.

## Completeness and failure gates

The serial npm script remains the source of the verify test inventory. Discovery partitions bind the full test-ID digest, recipe partitions bind fixture and snapshot inventory, and the required verify fan-in rejects missing, duplicated, unexpected or failed work. Node test file options remain unchanged. The connector's default command still runs all phases.

The suites keep their complete named module list. Five large modules partition sections or unittest IDs; worker processes cover all original sonnets or schemas and retain the original aggregate assertions. The suite-runner tests execute the workflow's actual shell across the full matrix and plant failures under both ordinary Bash and pipefail. Every selected module must still run after a failure, and the final gate must fail. The twelve fixed calibration and evidence commands run in a separate four-worker job. Each command has its original arguments and private writable cache/temp paths; all commands finish even after a peer fails. The required suites-result job rejects any non-success from either the module matrix or this evidence job.

The required freshness fan-in still requires the build and every fault shard, proves every fault class ran exactly once, and verifies all defects were caught and every promise-bound gate is covered. Scheduled runs build cold once. Fault shards validate the producer's source/runtime fingerprint and complete byte inventory immediately before injection; failed admission cannot authorize injection.

No required job names, protections, assertion thresholds, fixture outputs, or runtime behavior are relaxed. Active PR heads and runs are not modified by this work.

## Measuring the candidate

Record the candidate commit and run attempt. Collect every job page from the GitHub Actions jobs API, then compare completed_at minus started_at for execution, started_at minus created_at for runner queue, and job.created_at minus run.created_at for dependency wait. Retain test/section/leaf timings and completeness records alongside the run URL. Report full matrix maxima, total runner minutes and queue-inclusive completion; report failures separately.

The latest successful baseline PR had a suite queued for 22m14s, separately from dependency wait and execution. The observed peak of 39 simultaneous jobs is a lower bound, not a concurrency entitlement. Runner-inventory and protection inspection returned HTTP 403 with the current integration; no settings were changed. The candidate adds fifteen target jobs, so successful sub-ten-minute execution alone cannot establish sub-ten-minute end-to-end turnaround.

## First hosted execution and follow-up

[PR run 43099681517](https://github.com/WeningerII/CodexMusica/actions/runs/43099681517), at head `7c847fe0c145524e1edd4bdd4a63b7c403bce8ce`, executed all 22 targets of the first candidate. [The full timing and outcome record](first-hosted-targets.json) preserves execution, setup, queues, dependency waits and every required gate's status at capture. This run did **not** meet the goal or pass all gates.

All eight verify shards passed, at 4m49s–10m53s. Their fan-in failed before verifying ownership: listing the connector phases imported Express, which the fan-in does not install. The follow-up uses one shared JSON phase declaration, read without importing the connector and bound into the fan-in's inventory digest. A clean checkout without either Node dependency tree enumerates all 203 leaves and verifies complete synthetic records. The cost map now uses direct observations for every leaf from this hosted run; the measured-cost replay predicts 5m04s–5m45s in regression, before setup and fixed checks. Those are scheduling projections, not measured follow-up results.

All eight suites passed, at 9m14s–19m15s. The module pools themselves took 5m32s–9m01s; serial fixed checks caused the longest jobs. The follow-up runs those twelve unchanged commands in the separate evidence pool and moves four ordinary modules to less loaded shards. A replay reproduces all eight original pool durations exactly and projects a maximum pool of 8m12s after those moves. Setup and queue time remain additional costs.

The six faults jobs took 3m06s–7m33s. Their complete fan-in covered all 121 classes and rejected five baseline checks because the shared archive omitted the nine generated Library JavaScript chunks referenced by fresh HTML. The follow-up transfers these chunks, inventories their exact referenced set, and refuses missing, extra, changed or linked assets and old receipts. The original assertions and payload budgets remain unchanged.

The complete fixed-evidence bundle and isolated archive are also exercised locally before hosted qualification; local timing does not stand in for the hosted result.

The follow-up still requires a complete hosted run with all 23 targets (eight verify, eight module suites, one fixed-evidence job and six faults) and all required gates passing. A green duplicate push that skips its targets is not execution evidence.
