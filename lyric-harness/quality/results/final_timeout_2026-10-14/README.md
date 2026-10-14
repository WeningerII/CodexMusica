# Final-head timeout investigation — no repair applied

Repair head remains `f2e973dbb0aae0459264975745ecaaab9ca5edcd`. CI run 38634883740 is terminal: 44 success, 3 skipped, 1 failure. Only verify job 116096541955 failed, and only its `mcp/test_high_report.mjs` leaf failed among all 83 leaves. Record, all three suite shards, aggregate, freshness and image passed. Test 8 failed on its first substantive `lyric_revise` call with MCP -32001 at 60,035.643293 ms total test time. The request deadline is the unchanged SDK default of 60 seconds. Its four declaration-refusal calls preceded that request. No continuation was reached in the failed test.

## Captured CI measurements

| Head / verify job | First request wall ms | Sampled worker CPU ms | CPU model | Outcome |
| --- | ---: | ---: | --- | --- |
| 3870c8e7 / 115971403154 | 32201.304878 | 31488.056080 | AMD EPYC 9V45 | pass |
| 55e89f28 / 116012804883 | 34691.881568 | 34043.195110 | AMD EPYC 9V45 | pass |
| f2e973dbb / 116096541955 | 60002.346989 | 58923.297284 | AMD EPYC 7763 | timeout, incomplete |

All three report four logical CPUs. The failing worker consumed CPU for 98.5% of its 59.816-second sampled interval. Node used 140.583 ms CPU. The captured runnable-wait delta is 892.329 ms, but `sched_schedstats=0`; it must not establish a complete scheduler-wait account or prove absence of contention. Cgroup throttling counters did not increment, and cpu.max was unavailable. Hardware-associated throughput differences are a supported explanation, not a proved exclusive root cause. Other unchanged subtests slowed too: tests 1/6/7 took 38.8/59.5/29.2 seconds versus 25.3/35.1/22.5 on 55e89f28. No claim that isolating jobs fixes this is supported.

The earlier 68e213d0 failure was the same test and default deadline (60,061.91646 ms), but preceded the diagnostic instrumentation, so its CPU/model breakdown is unknown. The high-report test, MCP handler and reviser runtime have no source changes between successful 3870c8e7 and this head. The approved record adoption changes no runtime request inputs. The failing CI run does not contain an exhaustive score-input/result or phase trace; identical source and request do not prove every executed score was identical.

## Bounded local probes on f2e973dbb

One observer-only first-request probe used the original four-line draft and original arguments, with the original deadline. It passed in 30.043 s wall / 30.011 s process CPU, including observer overhead. All 12,491 normalized query/query_end/count events exactly equal the prior 68e isolated trace (exclude pid/wall/cpu only; preserve all other fields and order). Counts remain 295,052 score calls, 253,996 syllabify calls, 6,225 field splits, four rank-field computations and six candidate queries. This extends the limited event equality; it is not exhaustive score equality and is not a trace from the failed CI run.

Repeated candidates for tonight/rain/us at n=39,426 then 39,425 had identical indexed-input/declaration hashes (excluding n) and identical complete candidate-result hashes. The latter three scans cost only 2.11 CPU seconds in this probe. Removing those repeats alone has insufficient demonstrated margin to propose it as this repair. No engine cache change was made.

An unmodified focused test-8 control passed: first request 25,960.170311 ms wall / 25,522.107557 ms sampled CPU; test 49,244.81529 ms. A scratch-only test candidate retaining all assertions but using the first two draft lines and scheme AA passed: first request 7,003.661926 ms wall / 6,614.408792 ms sampled CPU; test 12,815.644787 ms. These are sequential runs on the same local Xeon 8573C environment with Python hash seed 0 and the existing staged fixture data. They are not failing-runner timing measurements or exact-head passing CI.

## Minimal proposal, awaiting approval

Change only test 8's draft to the first two lines and its substantive scheme to AA; update the fixture explanation. Keep the 60-second default deadline and all declaration/long-answer/run-identity/revision checks. Use one state continuation, require its suspended revision 2, then execute the returned note through run_id/run_revision and require revision 3 on the same run. The initial two-line proposal with two state continuations terminated at revision 3 and SKIPPED the conditional note branch; it is therefore not sufficient and is not the proposed patch. The revised scratch probe explicitly requires the note branch rather than relying on that condition. Retain the original four-line fixture in this diagnostic receipt. This makes an interface regression use a smaller real workload; it does not repair production latency. Its tradeoff is removal of the three-violating-member workload and one repeated state-continuation call from this particular interface test; the second continuation uses the note instead. The separate continuation tests retain their broader group/batch scenarios; they are not claimed to be an identical witness.

Only after approval: apply the test-only change, run the full high-report leaf plus relevant continuation coverage, and obtain exact-head CI with measured timing margin. No production change, timeout increase, full calibration rerun, merge or deployment is proposed. A production performance repair would require separately approved work and broader equivalence checks.

## Reproduction and artifacts

All scripts are archived as text and were external observers/scratch probes, not committed production modules. Original exact imports and paths are preserved; adapt `/workspace/musica-repair` to an unchanged checkout of f2e973dbb and the SDK/venv/staged-data paths to the same installed dependencies. Set `PATH` to the venv bin first, `PYTHONHASHSEED=0`, `LYRIC_STAGED_DATA` to staged data. For ordinary probes set `LYRIC_PYTHON` to the venv Python and run `node --test --test-name-pattern='lyric_revise: a pasted run'` with the selected scratch `.mjs` file. The control uses the committed `mcp/test_high_report.mjs`. The observer additionally uses archived `python-observer.txt` as executable LYRIC_PYTHON, `MUSICA_CPROFILE=0`, and `MUSICA_PROFILE_PREFIX` for the JSONL output. It runs `first-request.mjs.txt` as a scratch `.mjs` file. No provider calls or retry of CI occurred.

`ci-census.json`, full failed verify log, raw CI timing JSON, local output, observer trace, and scripts are banked here. `artifact_hashes.json` covers every artifact except itself, including decompressed hashes. Initial scratch startup errors were missing Node SDK resolution, before any request ran; reusing the already installed SDK corrected the environment. They are not measured engine failures.

The revised required-note probe passed in 12,698.440606 ms total test time; first request 7,031.696448 ms wall / 6,510.045452 ms sampled CPU. Explicit trace: initial exit4/revision1 → state continuation exit4/revision2 → note continuation exit3/revision3, same run identity asserted. This is the proposal supported by the local probe; it remains unapplied pending approval.
