# Diagnostic workload comparison, 2026-10-14

Heads: base 8ea94ac9d5141eb5062a8094351a9330f4edc38c and continuation 68e213d0aadf589319bce345b8eebc4b0d0a60f1. No relevant runtime, high_report test, package runner or Python engine source differs. Scratch worktree only; no production changes.

Three real CI fixture siblings: node mcp/test.mjs; node mcp/test_run_continuation.mjs; node --test mcp/test_continuation_audit.mjs. Each started 8 seconds before the subject; stopped after its result. SDK timeout remained 60 seconds.

Unseeded full focused test8: base PASS 84.737 seconds; first request 35.750 wall / 34.619 CPU. Current first request TIMEOUT, whole subject 65.592 seconds.

Reverse order PYTHONHASHSEED=0 full focused test8: current TIMEOUT; sampled first-request 59.836-second window contains 57.524 CPU + 2.313 runnable-wait seconds. Base PASS 142.328 seconds total, first request 43.446 wall / 33.126 CPU. These uncontrolled host execution-rate differences do not establish branch regression or a hash-seed fix.

Isolated first-request diagnostic (four original declaration refusals then exact original substantive arguments, unchanged default deadline), same hash seed 0, external lightweight query/count wrappers:

- base PASS 38.096 wall / 38.086 CPU seconds
- current PASS 26.981 wall / 26.982 CPU seconds
- current with three real CI fixture siblings PASS 28.922 wall / 27.979 CPU seconds

All 12,491 normalized ordered query/query_end/count events are exactly equal across these three traces, including memo snapshots and result sizes. Each performs 295,052 score calls, 253,996 syllabify calls, 4 rank-field computations, 6,225 field-split calls, and 6 candidate queries. Candidate query order: tonight/rain/us at n=39,426, then tonight/rain/us at n=39,425; index size 39,425.

Receipts: {8ea,68e}-controlled*, {8ea,68e}-seed0*, {8ea,68e}-isolated-count*, 68e-loaded-count*. External scripts: load-probe.py, load-probe-seeded.py, load-probe-counted.py, first-request.mjs. Instrumentation adds diagnostic overhead; first-request probes are not full-test qualification.

Conclusion: no extra branch-specific work demonstrated; CPU execution rate varies even in isolation. This final loaded repetition does not reproduce timeout and cannot justify environment isolation as a proven CI fix. Actual instrumented CI scheduler/cgroup evidence is still needed. No timeout, test assertions, production engine, measurements, or pins changed.
