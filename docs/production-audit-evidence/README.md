# Local verification evidence

Raw local records from **Node 24 and Python 3.12**, each applying to its recorded source epoch. They do not qualify a Docker image, production CPU/memory capacity, or a paid provider run.

The [artifact index](artifact-index.json) records SHA-256, bytes, original path, and classification. Raw outputs, failures, commands, and captured identities are unchanged; the index excludes its own recursive hash. The [final composite](final-python-evidence-decision.json) explains source changes and applicable followups. Its evidence paths are relative to this directory; source-code paths are relative to the repository root. [Final static checks](final-static/result.json) passed four commands and 85 ledger invariants.

| Evidence | What it establishes |
| --- | --- |
| [First Python88](final-python88/result.json) / [round two](final-python88-round2/result.json) | All 88 scripts completed: 65/23 and 87/1 pass/fail. **Both invocations failed.** Every suite log/status and runner is retained. |
| [Final null rerun](relations-null-round2-fix.json) | 77 checks passed in 759.83s under the explicit 1200s aggregate research bound. Prior 600s timeout and setup exit 127 remain; production clocks were unchanged. |
| [INT31 dependencies](int31-python/result.json) | Four passing stages and four failed loop assertions remain intact. [Reconciliation](int31-loop-reconciled/result.json) passed 26 assertions; Python/data were stable while broader runtime source changed. |
| [Final committed runtime](final-runtime-candidate6/result.json) | 74 offline and 65 runtime Node tests plus Python 16/7/5/6 controls passed in 99.09s. Source/data were identical throughout; ordinary nonproduction mode. |
| [INT35 actual MCP](int35-mcp/result.json) / [135 connector checks](connector-checks-final-int35.json) | Four actual dependency stages passed, including host→MCP→Python repair receipts and collector. Final checks-only inventory passed separately. |
| [Split-tail continuation](connector-split-liveness-final.json) | Actual 24-line, three-attempt continuation retained seven answers, kept unvisited outcomes unknown, and reasked/folded the omitted tail. Earlier oracle and separate-answer failures remain. |
| [Native application](int35-native-final-fourteen.json) / [wall consumer](wall-proof-fix.json) | 14 native controls and 43 lifecycle controls passed. Exact nested replay evidence, command provenance, source deltas, and earlier failures are retained. |
| [Runtime attempt four](final-runtime-candidate4/result.json) / [attempt five](final-runtime-candidate5/result.json) | Four failed a stale storage fixture. Five exited zero but its source changed unexpectedly: **nonqualifying unexplained drift**. Neither is replaced by attempt six. |
| [Maximum supplement](maximum-supplement-final/summary.json) | Six local cases with worker repeats and failed captures. First deferred checkpoints, not completed writing or production capacity qualification. |

Earlier captured Node e99, candidate3 runtime, and 152-check native runs retain their own source epochs. The original Node log is incomplete, unexplained, and **not a pass**. Offline/docs/lint logs lack complete per-command source receipts; four older connector checks have only an approximate epoch after the capture correction and before the frequency-loader correction.

[Claim checks](current-claims-final-native.json) report 790 true/8260 refused of 9050 asked; prose 211 true/9 refused. **Refusals remain unproven.** Both 103-file and [124-file data integrity](data-final-root-integrity-124.json) epochs are preserved. Setup budgets remain estimates for the unqualified target Python 3.11 image.

The **88-script lane excludes verbs and four required revision-loop shards**. Earlier full verbs checks span declared epochs; post-INT31 checks cover six sections/51 assertions. A complete final four-shard revision-loop run remains unrun locally. All **12 required hosted CI jobs**, exact image/resource qualification, deployment recovery, fresh paid-song completion, and a real 40-minute wall continuation still require their own evidence. This bundle is a composite, never one clean final invocation.
