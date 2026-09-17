# M-196 — banked mandate reader, 2026-09-17

The reader now uses the newest recorded grading invocation whose input md5
matches the lyric being analyzed. It carries groups, token slots, returns,
letter schemes, relations and structures into `schemes.mandate`, and exposes
the selected step and md5 in the report. The invocation takes precedence over
README prose and planned groups. Facts never cross step boundaries.

Without recorded invocation facts, the legacy README/plan lookup is preserved.
An unreadable recorded mandate refuses rather than falling back. In particular,
`--cliques` does not bank the historical derived groups; this reader cannot
recreate that evidence with the current comparator. It also refuses mismatched
drafts, repeated declarations, empty mandates and invalid coordinates.

## Historical bank comparison

Both runs used the existing instrument, from `lyric-harness`:

```sh
python3 quality/ban_convergence.py --check
```

- **Before:** isolated checkout of main
  `d6f729101777b440041a5d3c0854f2e04f1df204`; complete stdout in
  `quality/results/m196_banked_mandate_2026-09-17/before.txt`; exit **1**.
- **Reader, before repinning:** the M-196 working tree against the same bank,
  staged resources and comparator; complete stdout in
  `quality/results/m196_banked_mandate_2026-09-17/reader-before-repin.txt`;
  exit **1**. This is explicitly a working-tree receipt, not a clean-commit
  measurement.
- The stdout differs only by the added `mandate_banked 0` row. Every song's
  recovered source, grade, ban findings and partner ranks are identical.
- **After adopting the measured set:** a fresh complete run returned exit
  **0**, `--check: every pinned total holds`; complete stdout in
  `quality/results/m196_banked_mandate_2026-09-17/final-check.txt`.

The bank contains no recorded invocation facts, so its source counts remain
**11 README / 4 plan-log / 1 refused / 0 banked**. The historical prediction
that adding a reader would move 11/4/1 was incorrect. `oar_lair` still has no
recoverable mandate; `the_long_way_back` still uses its disclosed plan
reconstruction. No song, log, draft or historical harness stamp was modified.

## Descriptive pins, re-derived as a set

September 2's grader pins were already stale on main. These are descriptive
counts under the current grader, not fitted thresholds. Both independent runs
returned the same replacement set:

| Count | September 2 pin | Main and M-196 reader |
|---|---:|---:|
| Mandated pairs | 719 | 719 |
| Judged pairs | 549 | 517 |
| Refused pairs | 170 | 202 |
| Ban-eligible pairs | 487 | 457 |
| Ban findings | 7 | 9 |
| HEAD | 7 | 9 |
| TAIL | 155 | 162 |
| OUTSIDE | 325 | 286 |

The screened pool remains **366 HOMEOTELEUTON / 395 MODAL_RHYME / 792 clean /
11 refused / 1 other**, read directly from the historical logs. The ranked
population is HEAD plus TAIL: 171 pairs, median 26, minimum 1, maximum 335.
The old report incorrectly called this combined population "tail ranks" and
asserted every ranked partner was past the head even when HEAD was nonzero.
The label now says "partner ranks" and states its population; the arithmetic
is unchanged.

The complete grader-count set is adopted together. This does not claim that
M-196 improved or worsened the songs, that the old grades were reproduced, or
that one particular earlier comparator edit caused all the drift. Current
flags can reflect comparator changes as well as reconstructed mandates. The
raw receipts preserve every per-song count and the original failed checks.

No comparator input or calibration row changed. The comparator gate returns
exit **0**, HOLDS, at fingerprint
`14821a50f63e8ffd3565ba36f1446117b4a6670bb42cc6c7f53970af02bed431`.
No comparator repin, reused invalidated memo or unresolved batch is involved.
The gate's stdout is retained in
`quality/results/m196_banked_mandate_2026-09-17/comparator-check.txt`.

## Regression and scope

`quality/test_ban_convergence.py` section 4 tests the actual grader and CLI,
including newer records for different drafts, stale README/plan declarations,
step-local defaults, input versus output fingerprints, all four grading verbs,
numeric group labels, names containing commas, and named refusal paths.
The existing population, one-song and planted-ban checks remain in the suite.
`quality/test_songs_log.py` also passes, checking the producer independently.
Both focused `suite_sweep.py --only` runs reported one PASS, zero FAIL and
zero CANNOT RUN. All eight record gates, full ESLint and Prettier checks,
documentation counts/path checks and `git diff --check` passed. These are
local working-tree checks; the PR's current-head CI separately qualifies the
published commit.

The reader cannot recover the three missing historical drafts or the two
unrecorded historical graded mandates. Those remain evidence limitations;
M-196's implementation work is complete and its status remains CLOSED.
