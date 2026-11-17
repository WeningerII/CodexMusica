# Generated recurrence and explicit counts (#676)

## The rule now (stage 4, owner's rulings of 16 Nov 2026)

Only intro, outro and coda are dealt at most once, because the section table
says so: their `recurrence` value is "once" (`quality/grid.py`,
`SECTION_FUNCTIONS`). Any other section may be dealt any number of times,
once included. Bridge, false_ending and reprise were "once" and are "open"
now. The three "once" rows all stand at an edge (`boundary`), so the
placement check already keeps a second copy out; the planner reads no list
of "once" rows. A row marked "once" with no `boundary` is refused when the
table loads.

Every value in the `recurrence` column has a reader
(`grid.RECURRENCE_READERS`), checked when the table loads: "once" makes
`SINGLE_USE_RECURRED`, "returns" is asked by `song_function_report`, "open"
is not asked. `POPULAR_SONG.single_use` is read from the column.

Verse-chorus still brings the chorus back, because that form declares it
(`FORM_RECURS`, ruling of 27 Oct). The open form requires no return.

A stated section count (`sections=N`, `sections.<row>=N`, with `>=` and
`<=` too) is built into the draw: the number of cells and each cell are
drawn with the old odds, restricted to the draws that carry the counts,
with the form's own needs folded in. The planner refuses only what the
tables prove cannot fit, and the refusal names the row, the field or the
form:

- an empty interval, or a roster that leaves a row at 0;
- two edge rows asked for one edge place;
- named counts over the total, or over what the roster and caps allow;
- the form: a `FORM_REQUIRES` row held below 1, a `FORM_RECURS` row held
  below 2;
- a row's `requires` field naming a row held to 0;
- a row's `adjacent_before` or `adjacent_after` field: N of the row need N
  of its neighbour;
- the length: the sung sections the counts need, at the stated lines per
  section, plus the lines that let one kind of section carry the rhyme
  group, must fit the song;
- more sections than a plan holds (the planner's envelope);
- the total: a stated `sections` bound below what the counts need once the
  form's needs and the rows' own fields are added, plus the one sung
  section every plan has (fix round, 17 Nov);
- the edges: when the total leaves no room, the sections are fixed, and
  one of them must be able to open the song and another to close it
  (`needs_before`, `needs_after`, `adjacent_before`, `adjacent_after`,
  `boundary`);
- the lengths: when no further sung section fits, every copy of one kind
  has one length, so the lengths must share the song's lines kind by kind;
- the patterns: no pattern the planner builds carries the counts even at
  the longest length the bounds allow.

When counts are stated, the cell ceiling the planner uses on its own is
raised to the fewest cells that carry them, so a section may then have fewer
than 4 lines (owner's ruling). A built draw that refuses twice at one length
halves its ceiling and tries again, down to the fewest cells that carry the
counts, and stops after refusing there (fix round, 17 Nov). A draw that
passes at the first ceiling is unchanged. A stated count is met on the seed's own plan.
A request the proofs pass that still finds no plan is a bounded miss, as
before, never "cannot fit".

A repeated intro, outro or coda gets one note, `SINGLE_USE_RECURRED`, naming
each copy that is not at the song's edge; that copy's
`SECTION_NOT_AT_BOUNDARY` and its drift notes are not added. One intro in
the middle still gets `SECTION_NOT_AT_BOUNDARY`.

The grader no longer remarks that a section never came back: the
`RETURN_NEVER_RETURNS` note is gone.

`recurrence_report` and the lift policy are gone; `choices.pattern.chosen_from`
says "stated counts built into the draw" and names the counts.

Not done here: the `returns_as` values "varied" and "n/a" wait for the
owner's choice (stage 4 design, section 1).

## History (before stage 4, struck through)

~~Unsolicited generation honors `SECTION_FUNCTIONS.recurrence == "once"`.
The sampler counts complete proposals, including compound cells and edges,
and rejects duplicates without deleting sections or widening the roster.
The existing progressive bridge filter is retained for ordinary draws.
The new whole-pattern registry check handles remaining once functions.~~

~~This is a generation preference, not a musical prohibition. Authored blueprints
retain repeated functions and the existing `SINGLE_USE_RECURRED` note.
Python report callers can still override `FormConvention.single_use`.
Repeated `functions` entries remain allow-list entries, preserved in the raw
request, rather than an authored sequence or occurrence counts.~~

~~The existing `wants` grammar DOES represent explicit counts: `sections` and
`sections.<canonical function>`, with integer `=`, `>=`, or `<=` predicates
combined by conjunction. String requests may separate atoms with semicolons;
parsed tuples and lists use the same parser. No new public schema is added.
There is no inequality, strict comparison, OR, or separate range operator.
A range uses two existing atoms. Negative atoms parse, but their intersection
with nonnegative counts must be nonempty.~~

### ~~Count policy~~

~~Intersect named and total count intervals, including explicit upper bounds.
Functions absent from the effective roster have capacity zero. Boundary
functions remain capped at one, with one shared first slot and one shared last
slot. Empty intervals, excessive boundary lower bounds, named lower bounds
exceeding the total upper bound, and total lower bounds exceeding final upper
capacity are proved contradictions.
Two edge rows each asked for at least once in the one last slot were refused
by the shared-boundary proof. Proved refusals name the requested count atoms and
the conflicting numerical bounds; bounded-search exhaustion remains inconclusive.~~

~~A non-boundary once function's named lower bound above one lifts its default
cap, including bridge. Otherwise the default once cap remains preferred. If the
total lower bound exceeds the resulting capacity, lift eligible non-boundary
non-bridge once preferences first. Lift bridge only if capacity is still too
small. Every explicit upper bound remains binding. This optimistic capacity
bound is not a feasibility solver; placement, named form, and all predicates
still have to pass their existing checks. No attempt limit is increased.~~

~~How the lifts went, in plain sentences: a named lower bound above one
lifted that row's cap at once. A total that needed more room lifted the
other once rows that stand off the edges first, and the bridge last. An
upper bound alone never lifted a cap, and upper bounds that left the total
with too little room were a proved contradiction.~~

~~`choices.pattern.chosen_from` discloses lifted preferences and whether they
came from named or total lower bounds. This does not claim an exact count was
requested when the request specified a range. Sweep receives recurrence policy
separately from draw-conditioning predicates: it still filters one proposal per
seed, while plan first tries that same proposal and then uses bounded conditioned
search. An accepted sweep seed reproduces its sections and pattern in plan.~~

~~`hook` is a hook line number (zero when absent), and `returns` counts verbatim
return classes. Open form generates neither; the supported returning form
requires recurring chorus and verse. Repeating reprise or false-ending does not
create those return classes. Seven before/after rows cover open form with four
rosters, an invalid all-once verse-chorus roster, and two valid verse-chorus
rosters. Both predicates retain their former feasibility; neither drives a lift.~~

### ~~Evidence and seed drift~~

~~Independent baseline main was `4c03b784de84dde44eb01f272d96e1db30fc7418`;
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
and had 16 misses; those figures do not describe this final design.~~

~~Seed-only performance comparisons are invalid after proposal rejection changes
the RNG stream. Preserve source commit, request, and complete generated plan.
Historical receipts are not rewritten. Identical requests within this version
remain deterministic.~~

~~Only unavoidable fixture changes remain. Seeds 5 and 45 had once duplicates;
new first witnesses for the same 3/4 and 5/4 expectations are 39 and 302 (scan
0..399). The 2/2 and 7/4 witnesses 61 and 199 remain unchanged. Denominator /4
moves from seed 5 to 11; all other denominator witnesses remain. In the 40-seed
chorus mutation test the excluded redraw population is explicitly [2,16,26],
leaving 37 compared and no refusals (previously [2,16], leaving 38). The original
seed 2330 two-refusal receipt test is restored unchanged.~~

~~Regressions include hand-built duplicate proposals, registry mutation,
compound cells, edge counting, authored repeats and report override, default and
rostered plan/report integration, count interval matrices, grammar refusals,
explicit first/later candidate paths, sweep reproduction, and the seven hook /
return rows. The original eleven generation tests failed twelve assertions
against the baseline sampler, including deliberate duplicate proposals and real
generated duplicates; those tests pass with the corrected sampler. Run receipts
are recorded in the implementation handoff; no full web build is claimed.~~

### ~~Large integer capacity repair~~

~~The full planner suite passed at `a633968286a85a298d72bbcabdf92e3540b14601`,
but independent review then exposed a test gap: a supported upper bound
larger than the largest float, written as a decimal integer, mixed that finite
cap with floating infinity during capacity summation and raised `OverflowError`.
The repair detects an unbounded effective term before summing. Otherwise all
capacity arithmetic remains Python integer arithmetic. The predicate domain is
unchanged. The exact public `make_plan` regression fails before this repair;
a second regression distinguishes finite capacity `2*10**309` from that value
plus one, so large finite caps cannot silently become unbounded.~~

~~## Narrative population audit (2026-11-03, local)~~

~~The previously completed full planner suite did not cover `quality/test_narrative.py`.
That separate suite passes at pre-676 base `d3abd8e348d849761839749f1df1dc74358823c4`
and fails three population assertions at published candidate
`9a449d93f14b98113d48fc4e218ca6299d7c8de8`. No narrative production code changed.
The old expectations assumed the same seed still selected the same shape.~~

~~For `make_plan(seed, form="verse-chorus")`, seeds 1–100, both trees produce
100 plans and zero `PlanRefused` outcomes. Exactly 12 shapes change, each because
its old shape repeated a registry-once function; the other 88 are unchanged.
Here are all changes, including those not previously pinned:~~

| ~~Seed~~ | ~~Old repeated function~~ | ~~Old narrative line-ups~~ | ~~New narrative line-ups~~ |
| --- | --- | ---: | ---: |
| ~~20~~ | ~~false_ending ×3~~ | ~~88020836352000~~ | ~~0~~ |
| ~~26~~ | ~~reprise ×2~~ | ~~428318720~~ | ~~2168363520~~ |
| ~~34~~ | ~~reprise ×2~~ | ~~499008090931200~~ | ~~1917665280~~ |
| ~~41~~ | ~~false_ending ×2~~ | ~~0~~ | ~~8165376~~ |
| ~~48~~ | ~~reprise ×2~~ | ~~953218498560~~ | ~~32112640~~ |
| ~~53~~ | ~~reprise ×2~~ | ~~8222146560~~ | ~~2155991040~~ |
| ~~56~~ | ~~false_ending ×2~~ | ~~0~~ | ~~716161269104640~~ |
| ~~59~~ | ~~false_ending ×3~~ | ~~0~~ | ~~1899776~~ |
| ~~79~~ | ~~reprise ×2~~ | ~~47513600~~ | ~~32661504~~ |
| ~~87~~ | ~~false_ending ×2~~ | ~~886728425472000~~ | ~~21416000~~ |
| ~~95~~ | ~~false_ending ×2~~ | ~~50258171658240000~~ | ~~1920~~ |
| ~~99~~ | ~~reprise ×2~~ | ~~269738803200~~ | ~~16711680~~ |

~~The zero population changes from 13 to 11: seeds 41, 56 and 59 leave it,
while seed 20 enters it. Seeds 1–40 now contain two zeros (20, 38), previously
one (38). The denominator remains all 100 plans, not 100 minus story zeros.
Seed 20 begins `intro,false_ending`: RESOLVE lacks an earlier COMPLICATE.
Old seed 41 had that same forbidden prefix; its replacement begins
`intro,chorus,bridge,verse`. Old seed 59 opened with `tag` (JUDGE cannot open);
its replacement begins `chorus,postchorus,drop,solo,patter`. Old seed 56 starts
`solo,false_ending`: the length-one zero is a wordless-prefix artifact, and the
first sung section then fails RESOLVE. Its replacement starts `intro,turnaround,hook`.
A narrative zero still ships a plan with no story; generation does not promise
positive story line-ups unless requested through the existing predicate path.~~

~~The repair preserves every displaced old shape as an explicit authored-input
fixture with its old count. An independent exhaustive atom-assignment and seam
oracle checks those fixtures and all 100 new counts using the ruled tables,
without invoking the production dynamic-programming/card/seam helpers. Generated
shapes also must satisfy registry once and verse-chorus requirements. The actual
zero-depth map and explicit RESOLVE/wordless-prefix controls remain checked.
Historical seed exemplars are retained, including the three former zeros.
This changes test expectations and documents necessary population drift; it does
not alter narrative rules, recurrence policy, attempts, or user constraints.~~

~~Local validation: original base narrative suite 34 checks pass; unmodified
candidate 31 pass / 3 fail; repaired candidate 51 pass / 0 fail. Running the new
measured-seed tests against the old production base fails the generation-once
assertion, while all 12 authored fixtures and the exhaustive counter comparison
pass there. Focused `OnceGeneration`: 18 tests pass. Generated-map build/check
and `git diff --check` pass. All runs reached terminal status. No CI/log endpoints
were queried, and no new full planner or web-build claim is made for this test-only
repair. Publication remains held pending confirmation.~~