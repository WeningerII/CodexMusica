# Generated recurrence and explicit counts (#676)

Unsolicited generation honors `SECTION_FUNCTIONS.recurrence == "once"`.
The sampler counts complete proposals, including compound cells and edges,
and rejects duplicates without deleting sections or widening the roster.
The existing progressive bridge filter is retained for ordinary draws.
The new whole-pattern registry check handles remaining once functions.

This is a generation preference, not a musical prohibition. Authored blueprints
retain repeated functions and the existing `SINGLE_USE_RECURRED` note.
Python report callers can still override `FormConvention.single_use`.
Repeated `functions` entries remain allow-list entries, preserved in the raw
request, rather than an authored sequence or occurrence counts.

The existing `wants` grammar DOES represent explicit counts: `sections` and
`sections.<canonical function>`, with integer `=`, `>=`, or `<=` predicates
combined by conjunction. String requests may separate atoms with semicolons;
parsed tuples and lists use the same parser. No new public schema is added.
There is no inequality, strict comparison, OR, or separate range operator.
A range uses two existing atoms. Negative atoms parse, but their intersection
with nonnegative counts must be nonempty.

## Count policy

Intersect named and total count intervals, including explicit upper bounds.
Functions absent from the effective roster have capacity zero. Boundary
functions remain capped at one, with one shared first slot and one shared last
slot. Empty intervals, excessive boundary lower bounds, named lower bounds
exceeding the total upper bound, and total lower bounds exceeding final upper
capacity are proved contradictions.
In particular, requesting both `sections.outro>=1` and `sections.coda>=1`
is refused by the shared-boundary proof: together they require two sections
in the single last slot. Proved refusals name the requested count atoms and
the conflicting numerical bounds; bounded-search exhaustion remains inconclusive.

A non-boundary once function's named lower bound above one lifts its default
cap, including bridge. Otherwise the default once cap remains preferred. If the
total lower bound exceeds the resulting capacity, lift eligible non-boundary
non-bridge once preferences first. Lift bridge only if capacity is still too
small. Every explicit upper bound remains binding. This optimistic capacity
bound is not a feasibility solver; placement, named form, and all predicates
still have to pass their existing checks. No attempt limit is increased.

Examples:

- `[false_ending,reprise]`, total four, each at most two: allows two plus two.
- Add `reprise<=1` while retaining `false_ending<=2`: upper capacity three,
  hence a proved contradiction. Without the false-ending cap it may repeat.
- `[verse,reprise]`, total four: repeat verse, keep reprise once. Cap verse
  at one and reprise becomes eligible to repeat.
- `[bridge,reprise]`, total four: lift reprise first. Cap reprise at two and
  bridge must also lift. A named `bridge>=2` lifts directly.
- Upper bounds alone never trigger a lift; `reprise>=1` and `reprise<=3`
  retain the once preference. `reprise>=2` lifts it.

`choices.pattern.chosen_from` discloses lifted preferences and whether they
came from named or total lower bounds. This does not claim an exact count was
requested when the request specified a range. Sweep receives recurrence policy
separately from draw-conditioning predicates: it still filters one proposal per
seed, while plan first tries that same proposal and then uses bounded conditioned
search. An accepted sweep seed reproduces its sections and pattern in plan.

`hook` is a hook line number (zero when absent), and `returns` counts verbatim
return classes. Open form generates neither; the supported returning form
requires recurring chorus and verse. Repeating reprise or false-ending does not
create those return classes. Seven before/after rows cover open form with four
rosters, an invalid all-once verse-chorus roster, and two valid verse-chorus
rosters. Both predicates retain their former feasibility; neither drives a lift.

## Evidence and seed drift

Independent baseline main was `4c03b784de84dde44eb01f272d96e1db30fc7418`;
integration base is `0f531f4a60f3ec8d567b14a462b77ca3a6b462b4`.
For sampler seeds 0..2999, baseline accepted 2990: 116 repeated reprise and
106 repeated false-ending (210 distinct violating patterns). Narrow rejection
with the original bridge filter accepted 2986 with no once duplicates.
Exactly those 210 previously violating outcomes changed; no previously valid
accepted pattern changed. Existing ten bounded misses remained; four additional
misses were seeds 12, 1546, 2616, and 2974. These are sampler misses within the
existing 200 draws, not proofs of infeasibility. All seeds in the previously
investigated refusal union produced complete default plans through the public
planner. The discarded rewrite without the bridge filter changed 2817 outcomes
and had 16 misses; those figures do not describe this final design.

Seed-only performance comparisons are invalid after proposal rejection changes
the RNG stream. Preserve source commit, request, and complete generated plan.
Historical receipts are not rewritten. Identical requests within this version
remain deterministic.

Only unavoidable fixture changes remain. Seeds 5 and 45 had once duplicates;
new first witnesses for the same 3/4 and 5/4 expectations are 39 and 302 (scan
0..399). The 2/2 and 7/4 witnesses 61 and 199 remain unchanged. Denominator /4
moves from seed 5 to 11; all other denominator witnesses remain. In the 40-seed
chorus mutation test the excluded redraw population is explicitly [2,16,26],
leaving 37 compared and no refusals (previously [2,16], leaving 38). The original
seed 2330 two-refusal receipt test is restored unchanged.

Regressions include hand-built duplicate proposals, registry mutation,
compound cells, edge counting, authored repeats and report override, default and
rostered plan/report integration, count interval matrices, grammar refusals,
explicit first/later candidate paths, sweep reproduction, and the seven hook /
return rows. The original eleven generation tests failed twelve assertions
against the baseline sampler, including deliberate duplicate proposals and real
generated duplicates; those tests pass with the corrected sampler. Run receipts
are recorded in the implementation handoff; no full web build is claimed.

## Large integer capacity repair

The full planner suite passed at `a633968286a85a298d72bbcabdf92e3540b14601`,
but independent review then exposed a test gap: a supported predicate
`sections.verse<=10**309` (written as its decimal integer) mixed that finite
cap with floating infinity during capacity summation and raised `OverflowError`.
The repair detects an unbounded effective term before summing. Otherwise all
capacity arithmetic remains Python integer arithmetic. The predicate domain is
unchanged. The exact public `make_plan` regression fails before this repair;
a second regression distinguishes finite capacity `2*10**309` from that value
plus one, so large finite caps cannot silently become unbounded.


## Narrative population audit (2026-11-03, local)

The previously completed full planner suite did not cover `quality/test_narrative.py`.
That separate suite passes at pre-676 base `d3abd8e348d849761839749f1df1dc74358823c4`
and fails three population assertions at published candidate
`9a449d93f14b98113d48fc4e218ca6299d7c8de8`. No narrative production code changed.
The old expectations assumed the same seed still selected the same shape.

For `make_plan(seed, form="verse-chorus")`, seeds 1–100, both trees produce
100 plans and zero `PlanRefused` outcomes. Exactly 12 shapes change, each because
its old shape repeated a registry-once function; the other 88 are unchanged.
Here are all changes, including those not previously pinned:

| Seed | Old repeated function | Old narrative line-ups | New narrative line-ups |
| --- | --- | ---: | ---: |
| 20 | false_ending ×3 | 88020836352000 | 0 |
| 26 | reprise ×2 | 428318720 | 2168363520 |
| 34 | reprise ×2 | 499008090931200 | 1917665280 |
| 41 | false_ending ×2 | 0 | 8165376 |
| 48 | reprise ×2 | 953218498560 | 32112640 |
| 53 | reprise ×2 | 8222146560 | 2155991040 |
| 56 | false_ending ×2 | 0 | 716161269104640 |
| 59 | false_ending ×3 | 0 | 1899776 |
| 79 | reprise ×2 | 47513600 | 32661504 |
| 87 | false_ending ×2 | 886728425472000 | 21416000 |
| 95 | false_ending ×2 | 50258171658240000 | 1920 |
| 99 | reprise ×2 | 269738803200 | 16711680 |

The zero population changes from 13 to 11: seeds 41, 56 and 59 leave it,
while seed 20 enters it. Seeds 1–40 now contain two zeros (20, 38), previously
one (38). The denominator remains all 100 plans, not 100 minus story zeros.
Seed 20 begins `intro,false_ending`: RESOLVE lacks an earlier COMPLICATE.
Old seed 41 had that same forbidden prefix; its replacement begins
`intro,chorus,bridge,verse`. Old seed 59 opened with `tag` (JUDGE cannot open);
its replacement begins `chorus,postchorus,drop,solo,patter`. Old seed 56 starts
`solo,false_ending`: the length-one zero is a wordless-prefix artifact, and the
first sung section then fails RESOLVE. Its replacement starts `intro,turnaround,hook`.
A narrative zero still ships a plan with no story; generation does not promise
positive story line-ups unless requested through the existing predicate path.

The repair preserves every displaced old shape as an explicit authored-input
fixture with its old count. An independent exhaustive atom-assignment and seam
oracle checks those fixtures and all 100 new counts using the ruled tables,
without invoking the production dynamic-programming/card/seam helpers. Generated
shapes also must satisfy registry once and verse-chorus requirements. The actual
zero-depth map and explicit RESOLVE/wordless-prefix controls remain checked.
Historical seed exemplars are retained, including the three former zeros.
This changes test expectations and documents necessary population drift; it does
not alter narrative rules, recurrence policy, attempts, or user constraints.

Local validation: original base narrative suite 34 checks pass; unmodified
candidate 31 pass / 3 fail; repaired candidate 51 pass / 0 fail. Running the new
measured-seed tests against the old production base fails the generation-once
assertion, while all 12 authored fixtures and the exhaustive counter comparison
pass there. Focused `OnceGeneration`: 18 tests pass. Generated-map build/check
and `git diff --check` pass. All runs reached terminal status. No CI/log endpoints
were queried, and no new full planner or web-build claim is made for this test-only
repair. Publication remains held pending confirmation.
