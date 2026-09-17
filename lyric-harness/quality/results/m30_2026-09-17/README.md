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
- The baseline-only completion line reads its fingerprint from the measured
  memo, not from a live tree that may have changed during the run.
- Isolated failures use the same diagnostic reader as first attempts, so an
  assertion roll-up outranks incidental stderr while a crash keeps its trace.
  Completed unittest roll-ups distinguish assertion failures from test errors,
  including a mixed failure/error run; assertion tracebacks are not crashes.
- The shadow copies the corpus, including large files. A corpus symlink lets
  resolved paths escape the shadow root, bypassing the existing edition
  policy as though repository texts were external fixtures. The real reader
  must keep Blake's two source printings and select one declared work vote.
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
bound applies only to those controls. Eleven of the twelve new checks fail against the original
runner; all twelve pass after the repair (the cache-preservation control
also passes before the repair). The cache control prohibits launching
a child, a changed-live-tree control checks the completion identity, and a
controlled clock independently detects gate-wait inflation.

- [Original-runner controls](focused-before-final.txt)
- [Final static suite](static-final.txt)
- [Final core mutation sweep](core-final.txt): M1, M5 and M9 caught;
  four baseline suites passed, 102 unmeasured, no escalation.
- [Qualification tests](qualification-tests.txt): six pass.
- [Final comparator gate](comparator-final.txt): HOLDS at
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

The run starts from main `e31e30e73d2c7d517efbe6cb0fbce8babbb11b82`, before
these runner repairs and before the concurrent M-79/M-174 merges.
[Measurement context](measurement-context.json) records the initial
fingerprint and environment. The original mirror copies source code but
symlinks bulk data, including the corpus; the path-resolution defect this
causes is documented below. A snapshot comparison checked all 2,201 tracked
harness files against that commit with zero differences at the start. Later
working-tree source edits do not enter the copied code. The final fingerprint
printed by the old command reads the live tree, so it must not replace the
initial measurement identity.

The census is still running. This draft does not yet resolve the entry's
remaining runtime measurement or change its PARTIAL status.

Readable `.txt` receipts strip trailing whitespace only;
[verification-raw.zip](verification-raw.zip) preserves their original bytes.
The scheduled-job log is separately preserved in
[nightly-mutation-105149669582.zip](nightly-mutation-105149669582.zip).

The final focused receipts, including the changed-live-tree identity control,
are preserved verbatim in [verification-final-raw.zip](verification-final-raw.zip).
[Implementation hashes](implementation-sha256.json) identify the final core-tested source.

## Exclusion investigation

The original census reported `test_production_data.py` as ERROR. Its isolated
retry actually completed 39 unittest tests with two assertion failures in
118.865 seconds. A separate frozen-snapshot replay reproduced those two
failures in 179.537 seconds; these are unittest's own run durations, not the
baseline's first-attempt or total phase costs.

- The corpus symlink bypassed the declared edition policy after path
  resolution. The shadow now copies corpus bytes; neither corpus text nor the
  reader or policy changes. A real-shadow regression checks two source
  printings and one calibration vote.
- The test deliberately changes `HOME`. NLTK was installed in this session's
  user site, so that child could not import it. The follow-up uses an isolated
  environment with the same NLTK version and its dependencies installed inside
  it. A changed-HOME import control passes. No test is skipped or weakened.

The first environment attempt installed NLTK alone and still lacked its
user-site `regex` dependency after HOME changed. That unsuccessful run is
retained separately from the fully staged follow-up. The original census
continues unchanged; its historical receipt will not be reused as a baseline
memo for the repaired tree.

The fully staged follow-up passes through `mutate.baseline` in a real shadow:
**187.8 seconds, one attempt, 600-second bound; 190.226 seconds total phase
wall**. [Output](production-data-final.txt) and the
[attempt ledger](production-data-baseline.json) retain source hashes and the
measured fingerprint. The earlier incomplete-environment run has two failed
attempts (154.1 and 172.1 seconds) and is separately retained in
[production-data-corrected.txt](production-data-corrected.txt). The frozen
[original replay](production-data-shadow.txt) retains both assertion causes.
No raised limit was needed to restore this detector.

A development static run stopped on a missing local `subprocess` import in
the new shadow control. That import was repaired; the failure is retained as
[development evidence](static-development-missing-import.txt), not counted as
successful verification. Main `95c80efb` (#330's new M-294 record) is integrated.

The final core command passes with identical before/after source hashes:
three mutations caught, four baseline suites PASS, 102 unmeasured, no
escalation. Total command wall (including the static controls) is 76.239
seconds. [Raw core receipts](verification-core-raw.zip) preserve an earlier
passing run whose output correctly disclosed a comment edit during its run;
that earlier run is not the final source-identity receipt.

After integrating #330, counters were regenerated from the combined tree;
documentation checks and all six qualification tests pass. These receipts are
in [integration-330-raw.zip](integration-330-raw.zip). The first draft's CI run
35253094547 completed with 43 successful jobs and four deliberate skips; the
subsequent substantive repairs require their own published-head CI.
