# First revise request: ordered-work evidence

This evidence-only branch preserves diagnostics without moving repair PR #557's
tested head. It is not a performance repair or a live-service acceptance claim.

Compared implementation heads:

- Base: 8ea94ac9d5141eb5062a8094351a9330f4edc38c
- Repair: 68e213d0aadf589319bce345b8eebc4b0d0a60f1
- Test-only CI diagnostics: 3870c8e7d257c040641c03362cdeaf2318938766

The three compressed event streams preserve their original bytes. comparison.json
records both compressed and uncompressed SHA256 values and the exact comparison:
select query/query_end/counts events, remove only pid/wall/cpu, and retain every
other field and event order. All three sequences contain 12,491 events and are
exactly equal. Query arguments, memo snapshots, result sizes, and work counts are
included. Timing fields are excluded from equality, not from the archived streams.

| First-request probe | Wall seconds | CPU seconds | Result |
| --- | ---: | ---: | --- |
| Base, isolated | 38.096 | 38.086 | Pass |
| Repair, isolated | 26.981 | 26.982 | Pass |
| Repair, three CI fixture siblings | 28.922 | 27.979 | Pass |

Each trace contains 295,052 score calls, 253,996 syllabifications, four rank-field
computations, 6,225 field-split calls, and six candidate queries. The candidate
query sequence is tonight/rain/us with n=39,426, followed by tonight/rain/us with
n=39,425; index size is 39,425. Equal query text does not prove equal engine or
lexicon coordinates and does not authorize merging cache entries.

The loaded probe ran the actual local fixture commands for test.mjs,
test_run_continuation.mjs, and test_continuation_audit.mjs. They started eight
seconds before the subject and were stopped after its result. These probes keep
the SDK's default 60-second timeout and reproduce the four declaration refusals
followed by the first substantive revise request. They do not run all of test 8,
and the instrumentation adds overhead. Archived .txt files are the exact external
instruments, including their original machine-specific paths, not portable tools.

Earlier loaded trials timed out, including a fixed-seed trial with 57.524 seconds
CPU and 2.313 seconds runnable wait in a 59.836-second observation window. The
successful loaded repetition above does not reproduce that failure. The earlier
controlled-load-conclusion.md is retained verbatim as a historical note; its
statement that CI evidence was pending is superseded by the following result.

## Actual instrumented CI

Run 38598151924, verify job 115971403154, passed all 83 regression leaves at
3870c8e7. Test 8 passed with total duration 65,099.692 ms across multiple requests.
The first substantive request took 32,201.305 ms wall and 31,488.056 ms worker CPU,
leaving 27,798.695 ms below its unchanged 60-second deadline. Host: AMD EPYC 9V45,
four logical CPUs. The cgroup reported no throttling. Runnable wait was reported
as 323.338 ms, but sched_schedstats was 0, so that counter is not used to establish
causality. No timeout or assertion was changed.

No branch-specific extra work was demonstrated. Worker import/startup measured
about 41 ms in a separate partial profile; candidate construction/scoring dominated
CPU work. Execution speed varied even in isolated runs. The cause of the earlier
intermittent CI timeouts is still unproven. Neither a hash-seed pin, test isolation,
nor a shared-engine optimization is justified as a demonstrated repair by this
evidence alone.

## Terminal census

Run 38598151924 completed FAILURE with all 48 jobs retrieved using per_page=100;
the second page is empty. There are 42 successful jobs, three skipped jobs, and
three failures. Verify, image qualification, freshness, and suite 3 (including E5)
all passed. ci-census.json preserves every job ID, name, conclusion, and failed step.

The remaining failures are inherited: record job 115971403205 (symbol total
1719 versus 1739; comparator pin 9d5d81461aec2c94c8997431b3211727f7db56686712c1678cd1348966dc0df8
versus measured 51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4;
stale lyric-map files/CLAUDE.md; corpus NOTE 1856 versus 1861), suite-2 job
115971404083 (the same comparator and sonnet buckets 813 versus 808, 208 versus
207), and suites-result job 115988964617 (aggregation of suite-2 failure).
No held measurements or pins were changed.
