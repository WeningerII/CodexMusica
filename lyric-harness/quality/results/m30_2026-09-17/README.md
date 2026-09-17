# M-30: mutation timeout coverage

The original single 420-second limit is historical. The current runner has a
600-second default and six measured exceptions: verbs 3,000; discriminate
1,800; capacity 1,000; loop 900; plan and revise 1,600 seconds each. M-178
also made the test driver's default defer to that table. This work does not
change any of those limits.

## Reporting and measurement repairs

- Cold, cached, final and baseline-only reports share one classification:
  PASS, failed checks, crashes, and timeouts. Unmeasured suites are separate.
- The isolated confirmation determines baseline health. Previously an initial
  timeout followed by a failed check retained TIMEOUT, while a failed check
  followed by exhausted timeout retries retained FAIL.
- Every attempt retains its status, execution seconds and diagnostic. The
  bound is recorded beside the attempts. The legacy `seconds` field remains
  the first attempt's duration; the attempt list records confirmation costs.
- Suite execution time excludes waiting for the runner's shared/exclusive
  gate. The overall phase wall still includes that wait.
- Isolated failures use the same diagnostic reader as first attempts, so an
  assertion roll-up outranks incidental stderr while a crash keeps its trace.
- The core mutation command identifies its three mutations in its closing
  line. It cannot claim the full mutation inventory.

These changes neither turn a timeout into a catch nor suppress a survivor.
The existing release refusal and missing-detector regressions still pass.
The baseline-only command produces a memo, exits with its existing policy,
and explicitly says that it has not run a mutation sweep.

## Existing CI evidence and its scope

[Scheduled mutation job 105149669582](https://github.com/WeningerII/CodexMusica/actions/runs/35205355952/job/105149669582)
ran on `bf48281d5a3d5f810d3be472feebaa6131795662` on 2026-09-17.
Shard 1/4 caught 15/15 mutations over a 17/106-suite baseline, with no
escalation or exclusion. Its baseline phase cost 670 seconds and its total
reported wall was 1,844.2 seconds. Those are phase costs, not per-suite costs.
Its closing claim that the detector set was the whole suite was false; the
89 unmeasured suites were outside that run. That is repaired here.

M-146's fixture assignment separately merged through
[PR #324](https://github.com/WeningerII/CodexMusica/pull/324): its twenty-seed
comparison moves 749/311/438 mandated/judged/refused obligations to
749/749/0. This assignment preserves that work and does not reproduce or
claim ownership of its fixture measurement.

## Verification

The real-child regression runs passing, failing, crashing and sleeping
scripts, plus both failure/timeout transition directions. Its half-second
bound applies only to those controls. Nine checks fail against the original
runner; all ten pass after the repair. The cache control prohibits launching
a child, and a controlled clock independently detects gate-wait inflation.

- [Original-runner controls](focused-before.txt)
- [Integrated static suite](static-integrated.txt)
- [Integrated core mutation sweep](core-integrated.txt): M1, M5 and M9 caught;
  four baseline suites passed, 102 unmeasured, no escalation.
- [Qualification tests](qualification-tests.txt): six pass.
- [Comparator gate](comparator-integrated.txt): HOLDS at
  `14821a50f63e8ffd3565ba36f1446117b4a6670bb42cc6c7f53970af02bed431`.

No comparator input, calibration, corpus text, provenance or mutation
allowlist changes. No comparator batch or repin is owed.

## Runtime census

The full baseline uses the established command from `lyric-harness`, with
CMUdict and the research assets staged, no suite sharding, and no timeout
override:

```sh
python3 quality/test_mutation.py --baseline-only --jobs 4
```

The run freezes main `e31e30e73d2c7d517efbe6cb0fbce8babbb11b82`, before
these runner repairs and before the concurrent M-79/M-174 merges.
[Measurement context](measurement-context.json) records the initial
fingerprint and environment. A snapshot comparison checked all 2,201 tracked
harness files against that commit with zero differences. Later working-tree
edits do not enter that frozen measurement. The final fingerprint printed by
the old command reads the live tree, so it must not replace the initial
snapshot identity.

The census is still running. This draft does not yet resolve the entry's
remaining runtime measurement or change its PARTIAL status.

Readable `.txt` receipts strip trailing whitespace only;
[verification-raw.zip](verification-raw.zip) preserves their original bytes.
The scheduled-job log is separately preserved in
[nightly-mutation-105149669582.zip](nightly-mutation-105149669582.zip).
