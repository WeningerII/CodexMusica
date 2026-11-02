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
