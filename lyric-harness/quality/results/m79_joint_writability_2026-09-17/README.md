# M-79: joint gate and current preference sweeps

Measured 2026-09-17 on main base `fcebe7066b44943ccc199760b0471e7d2ae4b437`
with this PR's changes. The suite runner reports that base commit because the
changes were still uncommitted. Source hashes in `sources.json` identify the
actual modified implementation and tests. No corpus, comparator, calibration
or default preference was changed.

M-79 remains PARTIAL. This repair independently enforces the existing
free-word reserve on the emitted plan. It does not establish simultaneous
lexical or grammatical feasibility. M-174 owns the separate two-member
overhang capacity work; passing this gate is not that witness.

## Defect and controls

Five distinct bindings on a five-slot line passed the original gate despite
leaving none of M-171's declared free-word reserve. `NO_FREE_WORD` now checks
distinct word identities against the integer minimum of the grid capacity
and density ceiling. The sampler's existing distribution is unchanged.

`before.txt` records all three new regression methods failing against the
original implementation. `after.txt` records those same methods passing with
the repair. Controls allow a spare word, reject fractional spare slots, read
subdivision, deduplicate aliases, distinguish token reach from binding count,
and require `make_plan` to refuse before constructing the writer brief.

The full production harness suite passes (`production-suite.json`, exit 0).
Four existing planning sections pass (`planning-sections.txt`, exit 0):
joint gate including its collision mutation; sweep including the predicate
intersection; bound share; and whole-line participation. The production
explicit-brief regression checks ten seeds for reproducibility, satisfaction
of all seven declared predicates and absence of joint findings.

## What the current sweeps measure

All ranges are half-open. The CLI's default form is `verse-chorus`, default
production planning, with no corpus-weighted sampler. Counts of planned,
refused and accepted seeds remain separate.

| Receipt | Seeds | Planned | Refused | Accepted | Question |
|---|---:|---:|---:|---:|---|
| `historical-shape-predicates.txt` | 1–399 | 399 | 0 | 23 | Widest line 5–12 slots; group at most 4; verse first; 8–24 lines |
| `six-preference-sweep.txt` | 0–159 | 160 | 0 | 5 | The existing six-preference conjunction, also checked in section 10 |
| `binding-cap-sweep.txt` | 0–199 | 200 | 0 | 200 | Maximum pins per line at most 4 |
| `sparse-sweep.txt` | 0–199 | 200 | 0 | 78 | Mean bound words per line at most 1.5 |
| `chorus-first-sweep.txt` | 0–199 | 200 | 0 | 132 | First chorus precedes first verse |
| `both-functions-sweep.txt` | 0–199 | 200 | 0 | 200 | Both functions actually occur |

The first row is a fully specified current transcription of the historical
criteria, not a reproduction of the unavailable private script. In particular,
`slots_per_line` is the widest line; the final joint gate separately checks
every line's lower bound. These counts are preferences over emitted plans,
not counts of writable songs. The earlier 13/399 and 56% observations remain
historical; no current corpus-order rate is claimed. Surplus slots remain
legal, and chorus-first plans are not rejected unless the caller asks for
the other order.

## Reproduction

Run from `lyric-harness`, after staging the lexicon with `fetch_data()`:

```sh
python3 -m unittest quality.test_production_harness.HarnessProduction.test_joint_gate_preserves_a_free_word quality.test_production_harness.HarnessProduction.test_joint_free_word_check_obeys_density_ceiling quality.test_production_harness.HarnessProduction.test_joint_free_word_check_runs_before_writer_brief
python3 quality/suite_sweep.py --only '*production_harness*' --json
python3 -c 'import sys; from quality import test_plan as t; from quality.shard import run_sections; sys.exit(run_sections((t.test_the_joint_gate, t.test_the_seed_sweep_is_a_verb, t.test_the_bound_share, t.test_the_planner_plans_the_whole_line), "M79_TEST_SHARD", t.FAILURES, footer="M-79 focused planning sections"))'
python3 lyric_harness.py plan --sweep=1-400 '--want=slots_per_line>=5;slots_per_line<=12;group<=4;before=verse,chorus;lines>=8;lines<=24'
python3 lyric_harness.py plan --sweep=0-160 '--want=sections<=6;lines_per_section>=2;group<=4;uses=verse,chorus;before=verse,chorus;pins_per_line<=5'
python3 lyric_harness.py plan --sweep=0-200 '--want=pins_per_line<=4'
python3 lyric_harness.py plan --sweep=0-200 '--want=bound_words_per_line<=1.5'
python3 lyric_harness.py plan --sweep=0-200 '--want=before=chorus,verse'
python3 lyric_harness.py plan --sweep=0-200 '--want=uses=verse,chorus'
python3 quality/check_comparator_pin.py
```

Leave `M79_TEST_SHARD` unset to execute all four named sections. These are
the repository's suite, section and sweep instruments, not a second planner.
`record-gates.json` records each record gate's actual argv, exit code and
output. `comparator.txt` records HOLDS at exit 0; no repin is owed.

Integration and CI for the published head are recorded on this assignment's
pull request. These local receipts do not claim a hosted writer completion,
a full round-trip fixture audit (M-146), or a production qualification run.

The first published head's record job failed `triage.py --check`: the entry
explained its remaining requirement but omitted the required `TESTED WHILE
OPEN` declaration. The follow-up makes that declaration explicit beside the
regression description. `triage-check.json` records the corrected gate and
`triage-suite.txt` its existing suite; neither the checker nor status was
weakened to clear it.
