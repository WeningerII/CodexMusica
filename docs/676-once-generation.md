# Once-only generated sections (#676)

The sampler now rejects a complete proposed pattern when any function whose
`SECTION_FUNCTIONS` entry declares `recurrence="once"` occurs more than once.
The count includes opener, body cells (including compound cells), and closer.
It uses the existing bounded rejection path; it never deletes a section,
shortens a requested length, or widens a declared function roster to succeed.
The previous bridge-specific progressive cell filter is removed so all once
functions use the same whole-proposal rule. This conditions the existing
proposal distribution; it does not claim uniformity over all possible songs.

This is a generator convention, not a universal musical prohibition. Authored
blueprints still accept repeated functions and retain `SINGLE_USE_RECURRED`
as a note under the existing reporting convention. `FormConvention.single_use`
can already be overridden by Python report callers; that path is unchanged.
The planner accepts named `open` / `verse-chorus` forms and a `functions`
allow-list, not a section sequence or a recurrence-override declaration.
Repeated allow-list entries are preserved in the raw request but do not request
multiple occurrences. No new override schema is introduced.

Registry meanings, aliases, chorus/tag return classes, relation defaults,
line-count domains and defaults, placement rules, and report severities are
unchanged. Merely allowing a function still does not require it to occur.
A once-only roster may be feasible (one bridge); a reprise-only roster cannot
supply the predecessor its placement requires without repeating reprise.
Exhausting attempts is reported as a bounded failure to find a pattern, not
proof that every declaration is impossible.

## Reproduction and seed drift

Independent local baseline: main `4c03b784de84dde44eb01f272d96e1db30fc7418`.
Calling `_sample_pattern(random.Random(seed))` for seeds 0 through 2999 gave
2,990 accepted patterns, 116 with repeated reprise and 106 with repeated false
ending. Seed 2 repeated reprise; seed 42 repeated false ending. After the fix,
2,984 patterns were accepted, none with repeated once functions; 16 exhausted
the existing 200-attempt bound. This is a sampler census, not 3,000 complete
plans, a feasibility proof, or a runtime qualification.

Rejecting different proposals and removing bridge's progressive filter consumes
the random stream differently. The same seed can now produce different section
functions, line allocations, meters, groups, and subsequent workload. Seed-only
before/after performance comparisons are invalid: retain the source commit,
request, and full generated plan. Within one version, identical requests remain
deterministic. Historical measured receipts are not rewritten by this change.

## Regression coverage

The `test_once_generation` section of `python3 lyric-harness/quality/test_plan.py`
also runs under the existing planner CI shards. It covers known failing
seeds, hand-built duplicate candidates, a mutated registry entry, duplicates
inside one compound cell, edge counting independent of placement, feasible
once-only and repeatable-function patterns, bounded refusal, raw duplicate
allow-list preservation, authored-repeat notes and the existing report override,
and default/rostered/named-form generation through fill, blueprint read, and
function report. Generated plans retain requested line totals and repeat
identically within this version.

The final eleven-test suite was also run against the exact pre-fix
`_sample_pattern` function from the baseline commit, substituted only in an
isolated process. It failed twelve assertions with zero errors: known seeds,
hand-built duplicate candidates, registry/edge controls, rostered and unrestricted
plans, and duplicate allow-list handling. The same eleven tests pass after the
fix. This deterministic coverage is the guard; the census is supporting evidence
rather than a probabilistic-only regression.

The branch incorporates main `0f531f4a60f3ec8d567b14a462b77ca3a6b462b4`
(the intervening capacity-identity changes touch no planner or grid files).

The broad planner run exposed eight stale seed-witness assertions; its twenty
round trips still passed (5,066 judged obligations, zero refused). Meter
expectations remain 3/4, 2/2, 5/4, and 7/4, now witnessed by the first matching
seeds 43, 103, 383, and 282 in an exhaustive scan through 383. The denominator
support and independence assertions are unchanged. In the 40-seed chorus-rule
mutation comparison, both arms now plan without redraws, so all 40 must be
compared (the historical exclusions were 2 and 16). The multi-refusal receipt
test now supplies two distinct candidate refusals followed by an accepted plan
and checks exact seed order, codes, and findings; it no longer depends on seed
2330 needing two redraws. The separate real failing-seed test remains intact.

Final local validation: all 28 non-round-trip planner sections pass (93.3 s),
including the eleven new tests; the separately completed twenty round trips
passed without a runtime change between runs. Grid and placement suites,
46 capacity-integration tests, documentation checks, Python compilation, and
the generated harness-map check pass. A mutation retaining only the last
redraw refusal fails exactly the revised receipt assertion. Full web build,
CI, production qualification, and deployment were not run.
