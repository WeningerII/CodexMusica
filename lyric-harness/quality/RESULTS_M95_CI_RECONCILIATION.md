# M-95 — historical nightly and tandem failures reconciled

Inspected 2026-09-17 against main `50e4de4459f2055ce01d45cfc6ee67dcdb2e1640`.
M-95 closes as a status correction backed by existing repairs and executed
checks. No runtime, corpus, calibration, workflow or comparator input changes.

## The formerly unexplained AUC failures

The [August 23 nightly job](https://github.com/WeningerII/CodexMusica/actions/runs/32618905302/job/97143923438)
ran at `e24e716463c03feb15debf9291e697c1e87676e3`. Its log, unavailable to the
original investigation at the required offset, is accessible now. The two
commands explicitly refused the same absent resource:

```text
2026-08-23T05:08:10.3756933Z   cache:  data/feature_cache.json   384 entries   status 'fingerprint match'
2026-08-23T05:08:10.3757637Z   REFUSED -- a DECLARED coordinate of every cached vector is absent:
2026-08-23T05:08:10.3758166Z       wordfreq20k.txt
2026-08-23T05:08:10.4812834Z ##[error]Process completed with exit code 2.
2026-08-23T05:08:10.7123744Z   REFUSED — a DECLARED coordinate of every feature vector is absent:
2026-08-23T05:08:10.7124287Z       wordfreq20k.txt
2026-08-23T05:08:10.7236300Z ##[error]Process completed with exit code 2.
```

The first block is `quality/audit_joint_auc_null.py --check`; the second is
`quality/test_discriminate.py`. A warm cache did not satisfy the stale resource
declaration. Neither command reached an AUC comparison, so the failures were
not drift measurements or missing-package diagnoses (doctrine 20).

[Commit fcff2abe](https://github.com/WeningerII/CodexMusica/commit/fcff2abe89e764c5a0482eb5a38358fb6dc9312a)
replaced the retired wordfreq20k.txt reference in
`quality/discriminate.py:RESOURCE_FILES` with
`data/opensubtitles_en_50k.tsv`, the frequency table actually consumed by the
features. The same change derived the out-of-vocabulary sentinel from that
table; `bd68dfff` and `aaf04558` recorded its AUC and seed-median re-adoptions.
All three landed in [PR #189](https://github.com/WeningerII/CodexMusica/pull/189)
at **2026-08-23 12:49:22Z**, after the failed run began at **04:51:43Z**.
The August 22 author date of the repair was not its availability on main.

## Executed scheduled-run evidence

The table reports each named job's conclusion, not an inference from the
workflow's overall color. All times and dates are UTC. `Skipped` is neither
a successful check nor a failing check.

| Run / date / head | Relevant job evidence | Interpretation |
| --- | --- | --- |
| 832 / 2026-08-23 / `e24e7164` | [nightly failed](https://github.com/WeningerII/CodexMusica/actions/runs/32618905302/job/97143923438): both AUC commands refused at exit 2; capacity and Kalevala skipped | Original failure, now diagnosed directly from its log. |
| 1045 / 2026-08-27 / `baae4121` | [nightly succeeded](https://github.com/WeningerII/CodexMusica/actions/runs/33086717655/job/98568244413): both AUC commands, capacity, Kalevala, song-profile and memo save succeeded; [mutation succeeded](https://github.com/WeningerII/CodexMusica/actions/runs/33086717655/job/98568244647) | Executed evidence that the pending AUC question and the original nightly repairs were resolved. Tandem was skipped. |
| 1180 / 2026-08-31 / `1206fe25` | [tandem succeeded](https://github.com/WeningerII/CodexMusica/actions/runs/33389402929/job/99479297264), including its cross-artifact command | Weekly lane succeeded; nightly and mutation were skipped. |
| 1652 / 2026-09-14 / `d12108fe` | [tandem succeeded](https://github.com/WeningerII/CodexMusica/actions/runs/34838313817/job/103957157617) | Weekly success after the schedule restoration. Nightly and mutation were skipped. |
| 1713 / 2026-09-15 / `64d32b20` | [nightly failed](https://github.com/WeningerII/CodexMusica/actions/runs/34952583021/job/104329000807), but both AUC commands, both adoption checks, song-profile, length curves and memo save succeeded | The failed nightly step was deployment freshness: 47 differences between the tree and the live connector surface. This did not reopen the historical AUC refusal. |
| 1903 / 2026-09-16 / `4d1c4181` | [nightly succeeded](https://github.com/WeningerII/CodexMusica/actions/runs/35078809014/job/104780414165), including both AUC commands, adoption checks, calibration checks, deployment freshness and memo save; [mutation succeeded](https://github.com/WeningerII/CodexMusica/actions/runs/35078809014/job/104737535695) | Subsequent nightly success, with tandem skipped on this cron. |

Run 1713 also had a separate [plan shard installation failure](https://github.com/WeningerII/CodexMusica/actions/runs/34952583021/job/104327208112):
pip reported no matching distribution for `regex==2026.9.3`, before the test
step ran. The plan-result job inherited that failure. This is a dependency
installation failure in that run; its underlying package-service cause is
not established here. It is separate from nightly's measured live-surface
mismatch and from M-95's AUC refusal.

Selected API metadata, step conclusions and timestamped log excerpts are
banked in `quality/results/m95_ci_reconciliation_2026-09-17/receipts.json`.
The run population was retrieved through the Actions runs endpoint with
`event=schedule`; each receipt records the jobs endpoint and full head SHA.
The selection is an incident-to-repair sequence, not a success-rate estimate.

## Repairs already on main

| Original concern | Existing repair and subsequent evidence |
| --- | --- |
| Hardcoded chat font sizes bypassed the phone's token floor | `739a7ca9` in [PR #191](https://github.com/WeningerII/CodexMusica/pull/191) replaced the literals with existing font tokens. The executed tandem checks above passed. |
| Mutation work exhausted the nightly job and prevented later checks | The same commit moved mutation to its own bounded, rotating shard job. The current workflow keeps it separate. The nightly and mutation successes above are separate jobs, not a claim that every mutation shard ran in one night. |
| Failure/cancellation prevented memo persistence | The original split removed the mutation timeout from nightly. M-147 / `acab5913` in [PR #196](https://github.com/WeningerII/CodexMusica/pull/196) completed the repair with `actions/cache/restore@v4` and an explicit `actions/cache/save@v4` guarded by `if: always()`. Run 1713's save succeeded even though nightly failed. This does not promise saving after forced termination. |
| Capacity and Kalevala checks were silently skipped after earlier failures | `739a7ca9` added `if: always()` to the checks; current main retains those guards. Both checks executed successfully in the named later nightly runs. |
| The two fast AUC failures remained unexplained | The recovered original log and PR #189 establish the stale resource reference; the later named AUC steps executed successfully. |

M-227 records the owner's schedule suspension; M-287 records its restoration
by a later owner instruction. The September 14 tandem and September 16
nightly runs establish that scheduled execution resumed. Subsequent defects
and recalibrations remain in their own entries, including M-147, M-177,
M-270 and M-288. The normalized-tokenizer AUC re-adoption in
[PR #269](https://github.com/WeningerII/CodexMusica/pull/269) and the length-curve
repin in [PR #311](https://github.com/WeningerII/CodexMusica/pull/311) retain
their own measurement evidence; this reconciliation neither repeats nor
supersedes it.

## Scope and verification ownership

No open PR was returned by the repository's pulls endpoint during the
2026-09-17 overlap check. This documentation change owns no comparator input
and joins no comparator batch. The staged-input comparator check must still
be run on the final tree; historical green runs cannot substitute for it.

The run heads above precede current main. Their success resolves the
historical incident, not a claim that all current calibrations were rerun
here. Ordinary PR CI does not execute the cron-only nightly/tandem jobs;
their skip on this PR must remain disclosed separately from passed checks.
No M-95 implementation requirement remains. Verification of this change's
published commit is recorded on its PR.
