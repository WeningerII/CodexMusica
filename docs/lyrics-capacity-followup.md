# Lyrics capacity and screen follow-up

Investigation starts from `f79c979816887f07c8e4606bac0c909bdc86b0f0`
(PR #364). Main still named that commit and the open-PR search was empty.
The isolated branch is `fix/lyrics-capacity-investigation`.

## Reproduced causes and repairs

1. Candidate enumeration retained its entire visited Cartesian product until
   the query ended. It now retains duplicate history only until the final
   occurrence of each left span. Repeated, nonadjacent left spans still share
   history; overlapping buckets cannot re-emit a candidate. Mirror accounting,
   cached-pair skips, candidate order and the work guard retain their behavior.
2. Requested-pair projection rescanned every shared bucket for each queried
   line. A per-bucket line index now selects those rows, merging by original
   offset to retain order even when line origins are interleaved.
3. Fresh public screening exposed dropped score provenance. `picket / packet`
   was printed as `RIME_RICHE 1.000` without the grader's existing explanation
   that only the final syllable of each word supplied that score. `screen_pairs`
   now carries the actual verdict's spans and attribution; the CLI and MCP
   report print the attribution. This changes no score, pronunciation,
   promotion setting, named-relation answer or threshold.

4. The Spare Apron's first revision question called group A on L2 holding,
   despite graded failures involving that line. Findings are assigned once to
   the later endpoint; that ownership is not a pass for the earlier endpoint.
   Brief construction now includes every incident graded violation before
   selecting word positions and generating offers. Reported findings retain
   their original ownership and counts. Unknown groups retain their separate
   status. The exact frozen draft regression fails before this repair.

5. The Flood Map's joint-repair prompt offered `york` as answering `Dark`
   under class:CONSONANCE. A public screen rejects that exact pair. The
   per-call fallback omitted the declared-offer check used by joint menus.
   It now checks the exact requested pair obligations at their actual loci,
   and rejects new collateral failures. A partial offer can leave an existing
   unrelated failure open; it is not falsely required to solve the whole group.
   The frozen-menu regression fails before repair, and a positive control
   preserves legitimate partial offers.

6. The Last Bus Home accepted three repairs and then called L1's preserved
   first word `Rain` an end word in the verification explanation. The decision
   already used the correct locus; its sentence was hard-coded. It now uses
   the shared slot-description function. The full frozen-plan regression
   fails before repair; both it and the ordinary end-word control pass after.

The first two repairs are tracked under M-240; the four distinct feedback
causes are M-305.
`quality/test_candidate_pair_projection.py` contains exact sequence/counter
controls against the frozen enumerator, repeated-left-span coverage, and
measured cost comparisons. On the 512-span synthetic full query, both paths
yield 130,816 candidates; Python-tracked peak allocation was 23,067,824 bytes
before and 65,472 after. These are **enumerator allocations**, not whole-song
RSS or a deployment capacity qualification. On a sparse 128-line synthetic
query, line-key hashes fell from 130,048 to 1,152 with the same 508 candidates
in the same order. Full-query visit counts remain unchanged.

`quality/test_screen.py` checks the actual production verdict's attribution,
structured spans, and public CLI output. Both new screen checks failed before
the repair. The candidate memory regression also failed on the original code.

## Writing and remaining scope

The public creation runner reproduced admission refusal for 128 requested
lines. No smaller request substitutes for that run. The derived executable
limit remains 31 lines at 12 syllables per line. Neither a lower allocation
measurement nor passing equivalence tests establishes support beyond it.
M-240 remains open for scalable admission and end-to-end qualification.

The Last Casting stopped during public screening when the missing attribution
was found; its requests and responses are preserved. The Spare Apron is a new
independent writing attempt under the same seed-20261004 structure and
overlapping consonance conditions. It stopped before any answer when the false holding instruction appeared.
The Flood Map is the subsequent independent attempt under the same conditions.
It stopped at the invalid fallback menu before any answer. The Last Bus Home
is the next independent attempt under those same conditions.
The Last Bus Home stopped immediately at the misnamed anchor, with three
accepted repairs retained and its next question unanswered. The Glasshouse
Key is the next independent writing attempt under the same conditions.
None resumes Half a Ticket. The earlier
unfinished case and the limited monosyllabic feasibility diagnostic remain
unchanged; they do not prove multisyllabic realizations impossible.

The local runtime is Python 3.12.14 with pinned NLTK 3.10.3. Runtime assets
passed the repository's byte-integrity check. The read-only hosted health
response still names `740cd69f9b848ad137ea399bd18f671293dd7c61`, so it does not
verify PR #364 or this branch. Deployment requires the separate production
qualification and promotion workflow.

Verification receipts and the final writing/calibration outcomes are recorded
with the follow-up evidence. Local tests, fresh writing, PR CI and deployed
behavior are separate claims.

## Regression expectation correction

The first broader revision run had one failure: its old meter-only fixture
actually has a failed four/stairs pair, reported on L2. Expecting no L1 offer
encoded the endpoint-ownership defect. The assertion now requires that offer;
a separate red/road consonance control has a real holding pair and still
requires no rhyme menu for its meter-only repair. Both controls pass. The
original failing log is retained, not relabelled as a passing suite.

## Final fresh writing observation

The Glasshouse Key completed sweep, screen, plan, grade and one accepted
interview revision on the final implementation. Its declared compound
pronunciation for glasshouse is an explicit writer input, not a dictionary
claim. The accepted group edit fixed two findings with zero introduced flags;
the next question retained all three edited lines. Its receipt correctly
names preserved first word Rain and word 5 green. The source hashes before
and after the run agree. The runner was closed at that unanswered question.
This is an unfinished song and limited workflow evidence, not technical or
artistic completion. No song in this batch is claimed complete.

## Calibration and verification

All five shipped curves re-derived from 8,536 freshly computed items in eight
successful shards. No thresholds changed. The adopted comparator fingerprint
is `b33b56674866820765345793cef57c6a31d771cc59d01f915d2d701fa52b1c5f`; its receipt is `curve-check.txt` in the evidence
directory. The pin check also passes. The evidence README maps passing logs
and retains original failures and corrected test assumptions.

The remaining admission constraint is the global candidate-work upper bound,
not the removed whole-query history allocation. Raising its constant would
not establish supported longer execution. Longer workloads and recovery still
need implementation work and end-to-end qualification; M-240 remains open.
