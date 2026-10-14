# Exact-head CI receipt, first attempt

PR #557 head: `55e89f28eb98a2e133a427ab0d53f7823da584d0`.
Run: https://github.com/WeningerII/CodexMusica/actions/runs/38610350932
Attempt 1 completed FAILURE at 2026-10-14T18:59:47Z.
The tested merge `e4ab9ac78ec9845a6a4c345323288c72dc5f1f46` and the head have identical Git tree `082b6d260d35871265081ce6c3fefa8ece22b1ca`.

Complete census: 48 jobs (page 1 requested per_page=100 returned48; page2 returned0): 41 success, 3 failure, 3 skipped, 1 cancelled. See `attempt1-census.json` for every job and step.

## Passed qualification

- Verify116012804883: all83 regression leaves passed. Full lyrics-page gate617 assertions, fixture replies/no provider. High-report10/10 passed.
- The instrumented substantive revise request measured34691.881568ms wall and34043.19511ms worker CPU; margin25308.118432ms below the unchanged60000ms deadline. NodeCPU425.259ms. Runnable-wait124.041237ms is reported with schedulerStatsEnabled0 and is not causal evidence. Four logical CPUs, AMD EPYC9V45. Historical intermittent timeout cause remains unproven.
- Record116012804887: approved counters1739, generated map, and audit2328files/0FAIL/38WARN/1861NOTE all pass. Its only failed step is the held comparator fingerprint.
- Image, freshness, suite1 and revision-loop aggregate pass.

## Failures and missing qualification

- Record116012804887: comparator fingerprint only, inherited and intentionally held pending full remeasurement and separate adoption approval.
- Suite2 116012804942: comparator-pin tests and sonnet bucket counts813→808/208→207. Complete sonnet remeasurement is published separately; pins remain unchanged.
- Suites-result116044370354: aggregate failure.
- Suite3 116012805282: cancelled at18:59:41 after65m01s. Its main suite collection passed; E-5 empty-coda compatibility was still in_progress (started18:44:58). The workflow has an unchanged60-minute job guard; cancellation timing is consistent with that guard, but the job log returned GitHub BlobNotFound404, so no cancellation-tail or E-5 assertion result is claimed. E-5 is unqualified on this attempt, not a demonstrated assertion failure.

One rerun of the cancelled suite3 job was requested successfully at approximately19:04UTC, without changing the timeout or code. Its outcome is separate from this immutable first-attempt census.

The three available logs are losslessly gzip-compressed. Evidence-only publication skips CI and is not additional test qualification. No merge, deployment, provider calls or calibration-pin adoption occurred.
