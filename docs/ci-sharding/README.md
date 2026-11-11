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

The suites keep their complete named module list. Five large modules partition sections or unittest IDs; worker processes cover all original sonnets or schemas and retain the original aggregate assertions. The suite-runner tests execute the workflow's actual shell across the full matrix and plant failures under both ordinary Bash and pipefail. Every selected module must still run after a failure, and the final gate must fail. Fixed calibration and evidence checks retain their always() guards and execute once across the matrix.

The required freshness fan-in still requires the build and every fault shard, proves every fault class ran exactly once, and verifies all defects were caught and every promise-bound gate is covered. Scheduled runs build cold once. Fault shards validate the producer's source/runtime fingerprint and complete byte inventory immediately before injection; failed admission cannot authorize injection.

No required job names, protections, assertion thresholds, fixture outputs, or runtime behavior are relaxed. Active PR heads and runs are not modified by this work.

## Measuring the candidate

Record the candidate commit and run attempt. Collect every job page from the GitHub Actions jobs API, then compare completed_at minus started_at for execution, started_at minus created_at for runner queue, and job.created_at minus run.created_at for dependency wait. Retain test/section/leaf timings and completeness records alongside the run URL. Report full matrix maxima, total runner minutes and queue-inclusive completion; report failures separately.

The latest successful baseline PR had a suite queued for 22m14s, separately from dependency wait and execution. The observed peak of 39 simultaneous jobs is a lower bound, not a concurrency entitlement. Runner-inventory and protection inspection returned HTTP 403 with the current integration; no settings were changed. The candidate adds fourteen target jobs, so successful sub-ten-minute execution alone cannot establish sub-ten-minute end-to-end turnaround.
