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
  the longest length the bounds allow;
- the search: finding the fewest sections that carry the counts took more
  than 50,000 combinations of section counts. The refusal says to state
  fewer counts, or smaller ones (fix round, 18 Nov).

The table the built draw uses is bounded (fix round, 18 Nov). It holds one
entry per step for each combination of the stated counts, at most 50,000
(`plan._BUILT_STATES`). A request whose whole table fits is drawn as
before, byte for byte. A larger request builds its tightest counts into the
table and checks every stated count on each drawn pattern, drawing again on
a miss; `choices.pattern.chosen_from` then names the counts left to the
check. Such a request can end "not found" on a seed. That is a bounded
miss, never "cannot fit". Before the bound, three ordinary upper caps on a
463-line song took 50 s and 4.8 GB, and four ran out of memory; each now
takes about 2 s and 180 MB, which is what a plan of that length costs with
no count. A seed that finds nothing after a partial build says on its first
line which stated counts were only checked, as the request spelled them, so
the caller knows which to drop or loosen.

Before and after the bound, on 300 requests drawn by seed (80 with no
count, 220 with counts on rows of the section table, each form, lengths up
to 463 lines), each planned by the planner at d2f3c709fa and by this one.
The old planner ran under a 2.5 GB cap and 45 s per request.

| requests | outcome | count |
|---|---|---:|
| no count | both planned, byte-equal | 74 |
| no count | both refused, same text | 6 |
| counts | both planned, byte-equal | 141 |
| counts | both refused, same text | 29 |
| counts | both planned, different output | 29 |
| counts | old: over 45 s or out of memory; new: planned | 17 |
| counts | old: over 45 s; new: not found in 64 candidates | 3 |
| counts | old: planned; new: not found in 64 candidates | 1 |

Every request that changed had a table past the bound; no request whose
whole table fits changed. Of the 29 with different output, 25 differ in
structure and 4 only in the `chosen_from` clause. All 187 counted plans the
new planner returned meet their stated counts.

The known cost of the bound is the last row: `sections.verse>=3;
sections.bridge<=4; sections.burden<=5; sections.vamp<=4;
sections.turnaround>=1; sections=23` at 16 lines, verse-chorus. The old
planner found a plan in 20 s; this one reports "not found" after 3 s.

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
the middle still gets `SECTION_NOT_AT_BOUNDARY`. The note says the
convention expects the row at most once, because its trigger is the
convention's `single_use` list and a caller may pass its own. The section
table's own value for the row is given beside it, as it stands (fix round,
18 Nov).

The grader no longer remarks that a section never came back: the
`RETURN_NEVER_RETURNS` note is gone.

`recurrence_report` and the lift policy are gone; `choices.pattern.chosen_from`
says "stated counts built into the draw" and names the counts.

Incremental repetition is asked by one check (`relations.OneTokenDiffers`):
two lines hold it when each has the same number of words, at least two, and
exactly one word differs. Every word of the line counts, read from the
line's own word list, whether or not the dictionary can read it (fix round,
18 Nov). Capitals are folded. A mark beside a word is not part of the word.

What the grader answers when a word of the pair cannot be read:

| the pair | the unread word is | answer |
|---|---|---|
| one word changed, nothing else | any kind | stands |
| a second difference (a word changed, added or dropped) | hyphen-joined, or outside the dictionary | refused as unreadable, not failed |
| a second difference | a dictionary word whose readings differ in syllable count | fails, with the count |

The refusal in the second row is the existing rule for whole-line rows
(`line_pairs_for`), left as it is.

Two known limits, neither changed here:

- Apostrophe, backtick and hyphen stay inside a word, at its edge too. Two
  lines that differ only in such a mark at a word's edge count as one
  changed word and stand, though a listener hears the same line twice.
- The other identity rows still read a span's words from its sounded
  units, which leave out a word the dictionary cannot read. A row that asks
  two spans to agree can read them as equal when they differ only in such a
  word. Tracked apart from stage 4.

Every value in the `returns_as` column has a reader
(`grid.RETURNS_AS_READERS`), checked when the table loads (owner's ruling of
18 Nov 2026). "verbatim" gets `RETURNS_WITH_NEW_WORDS` when a return changes
the words and `RETURN_LOCKED` when every return is word for word in the same
slot; "new words" (verse, patter) and "varied" (prechorus, drop) get
`RETURNS_WITH_SAME_WORDS` when every later copy repeats the first word for
word. An empty cell means nothing is asked about a return: "n/a" is gone,
every row that is not "returns" is empty (breakdown, build, vamp and reprise
said "varied" and nothing read it), and the table refuses a value on such a
row. `RETURNS_WITH_SAME_WORDS` is a note and never blocks a song; copies with
no lines under them get none.

## Measured before and after (stage 4)

Before is commit `d336c17f51` (the stage 3 merge). After is commit
`d2f3c709fa` (stage 4 as committed). On 18 Nov 2026 each commit's
`lyric-harness` folder was unpacked on its own and measured there, so every
figure below is of one of those two commits and of nothing uncommitted.
Where the stage 4 build and its fix round counted the same thing on 16 and
17 Nov, the counts are the same. The times are from the 18 Nov run, in one
process.

### Default plans, seeds 1 to 1000 per form

Method: for each form in `PLAN_FORMS` ("open", "verse-chorus") and each
seed from 1 to 1000, one call `quality.plan.make_plan(seed, form=form)`
with nothing else stated. That is 1,000 plans per form on each commit; no
call was refused. A plan's sections are read from `plan["sections"]` and a
section's lines are counted from `plan["line_slots"]`. A sung section is any
section but interlude and solo, which hold no lines.

Sections and lines:

| | open before | open after | verse-chorus before | verse-chorus after |
|---|---|---|---|---|
| plans whose section list changed | - | 640 of 1000 | - | 821 of 1000 |
| plans whose total lines changed | - | 0 | - | 0 |
| sections min/median/max (mean) | 1/4/31 (5.69) | 1/5/45 (5.95) | 4/12/36 (13.25) | 4/13/45 (14.22) |
| total lines median | 222 | 222 | 224 | 224 |
| one-line sung sections | 307 of 5,311 | 318 of 5,547 | 1,202 of 12,400 | 1,496 of 13,328 |
| sung sections under 4 lines | 777 | 864 | 3,080 | 3,502 |
| plans with bridge more than once | 0 | 25 | 0 | 82 |
| plans with false_ending more than once | 0 | 30 | 0 | 90 |
| plans with reprise more than once | 0 | 18 | 0 | 79 |
| plans with intro, outro or coda more than once | 0 | 0 | 0 | 0 |

Plans by number of sections:

| sections in the plan | open before | open after | verse-chorus before | verse-chorus after |
|---|---|---|---|---|
| 1 to 4 | 516 | 487 | 5 | 4 |
| 5 to 8 | 301 | 307 | 157 | 159 |
| 9 to 16 | 154 | 170 | 616 | 536 |
| 17 to 32 | 29 | 35 | 217 | 284 |
| 33 or more | 0 | 1 | 5 | 17 |

Sung sections by number of lines:

| lines in the section | open before | open after | verse-chorus before | verse-chorus after |
|---|---|---|---|---|
| 1 | 307 | 318 | 1,202 | 1,496 |
| 2 or 3 | 470 | 546 | 1,878 | 2,006 |
| 4 to 7 | 671 | 730 | 2,292 | 2,645 |
| 8 to 15 | 859 | 935 | 2,644 | 2,736 |
| 16 to 31 | 984 | 1,039 | 2,212 | 2,374 |
| 32 or more | 2,020 | 1,979 | 2,172 | 2,071 |
| median (longest) | 20 (441) | 18 (460) | 9 (329) | 9 (356) |

Sections dealt per row, the same 2,000 plans on each commit. Each cell is
sections dealt (plans holding the row):

| row | open before | open after | verse-chorus before | verse-chorus after |
|---|---|---|---|---|
| breakdown | 237 (196) | 226 (192) | 413 (321) | 433 (322) |
| bridge | 143 (143) | 192 (160) | 308 (308) | 407 (308) |
| build | 208 (175) | 224 (198) | 405 (295) | 454 (342) |
| burden | 226 (192) | 215 (177) | 729 (587) | 786 (607) |
| chorus | 656 (427) | 688 (451) | 2587 (1000) | 2600 (1000) |
| coda | 364 (364) | 366 (366) | 366 (366) | 360 (360) |
| drop | 188 (165) | 196 (166) | 416 (328) | 449 (349) |
| false_ending | 163 (163) | 206 (169) | 258 (258) | 471 (354) |
| hook | 207 (175) | 211 (177) | 416 (324) | 404 (309) |
| interlude | 170 (156) | 170 (152) | 406 (326) | 419 (314) |
| intro | 554 (554) | 549 (549) | 540 (540) | 549 (549) |
| outro | 369 (369) | 347 (347) | 326 (326) | 332 (332) |
| patter | 200 (174) | 217 (182) | 420 (318) | 449 (337) |
| postchorus | 242 (199) | 238 (203) | 915 (661) | 920 (657) |
| prechorus | 218 (184) | 235 (194) | 931 (663) | 934 (666) |
| refrain | 192 (166) | 219 (177) | 413 (337) | 466 (351) |
| reprise | 139 (139) | 179 (160) | 269 (269) | 427 (332) |
| solo | 205 (177) | 232 (194) | 440 (350) | 478 (367) |
| tag | 199 (171) | 198 (174) | 407 (322) | 439 (341) |
| turnaround | 164 (144) | 136 (120) | 399 (315) | 406 (316) |
| vamp | 225 (197) | 239 (215) | 390 (322) | 486 (367) |
| verse | 417 (313) | 466 (331) | 1492 (1000) | 1556 (1000) |

Refused and redrawn draws, the same 2,000 plans on each commit. The counts
were taken during the calls above by counting, inside
`plan._sample_pattern`, each pattern it tried, each one
`grid.placement_findings` turned down, and each call that ended refused
after its 200 tries (`PATTERN_ATTEMPTS`). A seed redraw is one entry of the
plan's `choices.seed_redraw.refused`: a draw the joint gate refused. A
pattern that was tried and never reached placement was dropped earlier by
the form's own needs or, before stage 4, by the deleted "once" check.

| | open before | open after | verse-chorus before | verse-chorus after |
|---|---|---|---|---|
| plans with a joint-gate seed redraw | 28 | 31 | 37 | 29 |
| seed redraws | 28 | 31 | 38 | 29 |
| pattern draws that ran out (200 refused, a new total tried) | 3 | 0 | 985 | 817 |
| patterns drawn | 21,015 | 19,446 | 283,868 | 249,224 |
| median patterns per plan (max) | 10 (238) | 9 (187) | 168 (2,773) | 142 (2,045) |
| refused by placement | 2,791 | 18,395 | 9,809 | 160,790 |

### Requests that state section counts

Method: the request draw of the stage 0 baseline
(`draw` in `docs/writer-baseline-2026-11-15/draw_requests.py`), request
seeds 1 to 200. The 94 requests that state section counts are planned on
planner seeds 1, 2 and 3 with `make_plan(seed, form=..., lines=...,
wants=...)`: one `sections.<row>=N` for each stated count, and
`beats_per_line=N` when the request states it. A refusal that says "can't
be met" is a proof, and that request is not tried on the other seeds.

| | before | after |
|---|---|---|
| requests stating counts | 94 | 94 |
| refused with a proof that names the reason | 17 | 19 (17 edge-slot + 2 length) |
| requests left | 77 | 75 |
| planned on at least one planner seed | 35 | 73 |
| planner-seed successes | 71 of 231 | 204 of 225 |
| delivered plans with exactly the stated counts | 71 of 71 | 204 of 204 |
| a request that planned before and not after | - | none |
| misses left | 160, all "no accepted plan in 64 bounded candidate draws" | 21, all bounded misses on a request that states counts and `beats_per_line`; 2 requests miss on all 3 seeds |

A count with a line range: 60 requests drawn by seed 1 to 60. Each is one
row that does not stand at an edge, at a count from 2 to 4, with `lines<=N`
where N is at least 4 and under 4 lines per copy, in a form drawn by the
same seed, on planner seed 1.

| | before | after |
|---|---|---|
| no feasible total (the line bound alone) | 33 | 33 |
| planned with exactly the count | 0 | 21 |
| refused by the length proof, with the reason | 0 | 6 |
| bounded misses | 27 | 0 |

A count below what the form needs: 200 requests drawn by seed 1 to 200,
each a form with one row it requires held to 0, or one row it brings back
held to 0 or 1, at 24 lines, on planner seed 1.

| | before | after |
|---|---|---|
| refused | 200, as "no accepted plan in 64 bounded candidate draws" | 200, each naming the form and `FORM_REQUIRES` or `FORM_RECURS` |
| time | 189.2 s total, up to 2.8 s each | 0.01 s total |

### The removed remark

The stage 0 census (`docs/writer-baseline-2026-11-15/seed_count.txt`) had
the "never comes back" note in 109 of 200 open songs and 173 of 200
verse-chorus songs. After stage 4 it is in none: the code is gone from the
grader, its severity table and the census.

## Grading a long section (fix round, 18 Nov)

Seed 0's default plan has one section of 422 lines. For a figure of three
or four lines, `relations._full_shape` drew every tuple of the section's
lines with `itertools.combinations` and then asked the tuple's edges. Four
lines out of 422 is 1.3 billion tuples on each call. The round trip of that
seed took 6,137 s (stage 4 build report), over the 60 minutes CI gives the
plan shard.

`_full_shape` now searches for the tuples. It binds a figure's lines in
printed order and drops a partial tuple as soon as an edge between two
bound lines reads False. An edge is read from its own two lines and from
nothing else, so each tuple dropped this way is one the old loop dropped
too. Each tuple that is left goes through the old loop body, which is
unchanged. The search serves the two judges that bind three or four lines,
`crossed` and `aab` (the rows `analysed rhyme` and `blues AAB stanza`).
`symploce` binds two lines and keeps the plain loop.

Time of `test_plan._round_trip_one(seed)`, in one process, with the grader
built first:

| seed | longest section | old loop | search |
|---|---|---|---|
| 0 | 422 lines | 6,137 s (stage 4 build report) | 84 s |
| 2 | 141 lines | 165 s | 64 s |
| 6 | 208 lines | 412 s | 49 s |

Seed 0's 84 s is one run on the working tree of this fix round. The 6,137 s
is from another day's run, and the machine was shared during the new run (4
cores, load 4 to 5), so read that pair loosely. Seeds 2 and 6 were run on
18 Nov on one copy of the tree, old loop against search, on the same shared
machine, while the records of check 1 below were taken. The old loop was
not run again on seed 0: it takes over two hours.

The output is the same. Three checks say so:

1. Round trips. Each run records the round trip's result tuple. For every
   `_full_shape` call it records the row's name, the number of figures and
   a hash of the whole result in order: frame, member lines, every edge,
   verdict. For every `Reviser.inspect` call it records the finding codes,
   the counts of mandated, judged and refused pairs, the number of
   violations, and hashes of the whole grade and of every finding. Seeds 2
   and 6, old loop against search on one copy of the tree: every record is
   equal (170 and 403 `blues AAB stanza` figures). Seed 0, search: every
   record is equal to the old-loop run recorded on 17 Nov, on the stage 4
   tree before its commit (3,570 figures). No round-trip draft holds an
   `analysed rhyme` figure, so the next two checks use streams that do.
2. `FullShapeSearch` in `quality/test_production_relations.py`. It draws 34
   streams by seed from dictionary words: 4 to 24 lines, 1 to 3 stanzas,
   some lines repeated, some ending in a generated word no dictionary
   holds. For the three rows it compares `_full_shape` with a plain
   enumeration kept in the test: figures, edges, verdicts and order. The
   draw holds 1,436 `analysed rhyme` figures, 98 `blues AAB stanza` figures
   and 6 `symploce` figures. The first two rows have decided and undecided
   figures, and tuples that fail only on their last-bound line. The test
   passes on the old loop too. It fails under each of five deliberate
   changes to the search: one never binds a frame's last line, one walks
   each level backwards, two drop a tuple at an undecided edge (one for
   each judge), and one asks an edge of the wrong pair of lines.
3. A one-off run on 325 longer streams (300 of 4 to 40 lines, 25 of 60 to
   90), with crossing end words, repeated lines, an unreadable word and 1
   to 3 stanzas: 167,104 figures over the three rows. The old loop's
   serialised output (frame, member lines, every edge, verdict) and the
   search's hash the same on every stream and row.

The search still grows like the old loop in a section where nearly every
edge holds. No fixture draws such a section.

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