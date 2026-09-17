# M-146: round-trip fixture coverage

The old round trip accepted a draft whose function words prevented many
mandated positions from being graded. The replacement keeps seven token
positions and the same syllable count at each position. It replaces only
four weak words with content words:

```text
we    carry the    morning to    the    {BANK}
birds carry bright morning bells strike {BANK}
```

The existing end-word bank, its unambiguous-reading mode, explicit
performance choices and verbatim return copying remain in use. The fixture
still repeats words and may violate drawn rhyme relations and quality
findings. Those are judgments, not missing coverage.

`quality/test_plan.py` section 3 checks all token positions and all named
planner placements across both bank modes. Its two-line controls grade every
placement, including repeated heads that violate `class:RHYME`. Its guard
matches actual verdict identities to every mandated pair/group obligation,
checks the three counters, and requires both refusal collections empty.
Restoring the old filler, forging its counters or removing a verdict fails
that same guard. The old probabilistic coverage floor is replaced by this
complete, non-vacuous obligation check.

## Measured coverage

The same twenty default plans span 17–31 lines. Neither arm hits the schema
pair guard. The baseline's counts partition, but its weak-word allowances
leave most obligations ungraded. The replacement checks each obligation's
verdict record, not just these totals.

| Fixture | Mandated | Judged | Refused | Judged share |
|---|---:|---:|---:|---:|
| Baseline weak-word filler | 749 | 311 | 438 | 41.5% |
| Content-word filler | 749 | 749 | 0 | 100% |

All 438 previously refused obligations are now graded. These are pair/group
obligations as returned by `Mandate.pairs()`, not unique unordered line
pairs. The new receipt prints each seed's judged/refused counts. The baseline
receipt records the aggregate, not a per-seed coverage breakdown.

## Reproduction

From `lyric-harness`, with CMUdict and the research assets staged:

```sh
python3 -c "import lyric_harness; lyric_harness.fetch_data()"
python3 quality/fetch_data.py --research
python3 quality/test_plan.py
python3 quality/test_slots.py
python3 quality/check_comparator_pin.py
```

The sweep uses default plans for seeds 0 through 19, CMUdict General American,
the default Declaration, and the fixture's declared dictionary readings.
`TEST_PLAN_SHARD` is unset and the default pool has four workers. The baseline
is main commit `fcebe7066b44943ccc199760b0471e7d2ae4b437`; its receipt is
[before.txt](results/m146_round_trip_2026-09-17/before.txt). It ran only
`test_the_round_trip()` from that commit, followed by checking `FAILURES`.
The replacement's full suite receipt is
[after-suite.txt](results/m146_round_trip_2026-09-17/after-suite.txt).
The focused slot-suite receipt is [slots.txt](results/m146_round_trip_2026-09-17/slots.txt).

## Verification

- Full planning suite: exit 0, all 21 sections; all twenty round-trip seeds
  fully graded, all twenty new fixture controls pass. The other fixture
  consumer, performance-order rendering, passes in the same run.
- Slot suite through `suite_sweep`: PASS; zero failed or cannot-run suites.
- All eight record gates: exit 0; commands, timings and output filenames in
  [record-gates.json](results/m146_round_trip_2026-09-17/record-gates.json).
- Final M-146 entry check: exit 0. Claims outside the entry reader's declared
  shapes remain explicitly `NO_SHAPE`; that output is not a claim that every
  sentence was mechanically proved.
- Counters regenerated with `counters.py --write`: no resulting diff.
- ESLint, full Prettier, all documentation checks, build closure and promise
  coverage: passed. Complete receipts sit beside the sweep results.
- Comparator gate: exit 0, HOLDS at
  `14821a50f63e8ffd3565ba36f1446117b4a6670bb42cc6c7f53970af02bed431`.
  No comparator input changed; no recomputation, pin update or shared batch
  is owed. No other PR was open at the pre-publication refresh.

[verification.json](results/m146_round_trip_2026-09-17/verification.json)
records the measured source identities and receipt hashes. Text copies trim
trailing whitespace and blank EOF lines; [raw-stdout.zip](results/m146_round_trip_2026-09-17/raw-stdout.zip)
preserves the original output bytes. The source tree
was based on main `fcebe7066b44943ccc199760b0471e7d2ae4b437`, still current at
that refresh. GitHub CI and the confirmed merge are recorded on the PR;
these local receipts alone do not certify a published or merged commit.

The initial published-head CI failed formatting on `record-gates.json`, which
was generated after the earlier local format run. The index was formatted,
and the complete final file set was checked again. The original failure log
is retained in [initial-ci-gate.json](results/m146_round_trip_2026-09-17/initial-ci-gate.json).
The next CI run passed formatting and caught the reproduction block's suite
filter being interpreted as a file path. The example now names the direct
slot-suite entry point. This was reproduced locally after the report joined
the tracked file set; the earlier path check did not scan that untracked
report. [second-ci-gate.json](results/m146_round_trip_2026-09-17/second-ci-gate.json)
preserves this failure. The tracked final document set passes the path check.
No test or production behavior changed in either publication correction.

## Integration with M-166

Main advanced to `4faac4e175a644e68066c3cbcf899845d5e52941` when PR #323
merged. Both MISSING entries and its generated counter change are preserved.
The combined tree was regenerated with `counters.py --write` and checked
again through all eight record gates and the comparator gate; complete
command outputs are in [integration.json](results/m146_round_trip_2026-09-17/integration.json).
The test source is byte-identical to the fully exercised source above.
Fresh CI on the integrated PR head is required; the earlier green planning
shards alone do not certify this merge.

## Scope

This is a fixture-coverage improvement. It neither estimates production
refusal rates nor certifies musical quality. It does not cover every possible
seed or hand-declared plan. Full inspections still enforce the existing
shape, verbatim-return and schema-pair-wall guards. All corpus text,
provenance, production code and calibration rows are unchanged.
