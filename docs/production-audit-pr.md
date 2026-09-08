# Enforce lyrics workflow, recovery and production qualification contracts

The lyrics pipeline could accept the wrong task, lose recoverable work around interrupted calls, expose incomplete measurements as clean results, and release code without proving the serving runtime matched the tested build. This change implements the production audit repairs and retains the original acceptance conditions and remaining qualification gates.

The change:

- Binds native tool discovery and execution to the requested task, including the Rich recipe ceiling, and requires ordered planning, grading, revision and exact artifact delivery for new lyrics.
- Preserves accepted lyrics, proposal history and accounting across cancellation, continuation, worker loss and migration; enforces byte, queue, writer-work and budget limits before work becomes unrecordable.
- Repairs relation uncertainty, candidate verification, frequency-table parsing and current corpus/calibration adoption. The final data gate remeasures all 8,545 rows and verifies all 81 rhyme families.
- Splits oversized deferred batches without truncating questions or skipping their remaining work. Partial comparisons cannot fabricate a whole-song zero-finding result or certify completion.
- Records verified kitchen decisions separately from saved application, deduplicates replayed repair evidence, and proves wall continuation against the exact checkpoint, task and build. Actual HTTP tests cover accepted repairs, rejected no-ops and completion receipt compatibility.
- Uses the final measured grade to recognize a clean last-round repair while preserving the loop's actual stop reason. Server and acceptance checker share the same complete task identity.
- Pins and checks the runtime and approved assets, validates each installed capacity receipt, and requires complete trusted CI, exact image promotion, live identity and explicit production qualification evidence.

Validation and counterexamples are recorded in [the audit ledger](production-audit-fixes.md), [the raw verification archive](production-audit-evidence/README.md) and [the data report](../lyric-harness/quality/RESULTS_PRODUCTION_DATA_2026-09-08.md). Earlier failed, incomplete and stale-source attempts are preserved separately. Local checks use Node 24 and Python 3.12; they do not replace the target Docker runtime gates.

This is a draft production candidate. Required trusted CI jobs, the exact 1 CPU / 2 GiB Docker matrix, external branch/service settings, hosted recovery and a fresh autonomous paid song remain acceptance gates. Paid schedules stay disabled until qualification; this repair pass makes no production deployment claim.
