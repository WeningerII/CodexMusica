# Lyric continuation audit — 2026-09-20

This repair batch starts at main `30bef2a` (PR #361). All nine findings from the
audit of `740cd69f9b848ad137ea399bd18f671293dd7c61` still reproduced. The intervening
main change concerned alphabetical catalog lists, not lyrics. The open-PR search
was empty at investigation. PR #363 opened during verification; it changes
recipe card controls, two preface-history records and a profiler timing test,
not the lyric continuation implementation. It merged as `aaba238` during this
work and was integrated in `6f28dce` before final qualification. Work used the isolated
`fix/lyrics-continuation-audit` branch. M-304 tracks this batch; F01–F09 below are
the external audit's labels, not MISSING identifiers. Main advanced to
`5a338ac` (PR #362, removal of a recipe preface) during verification. That
non-overlapping change was integrated in `f3f9d44` before the Greenhouse run.

The supplied audit and runnable ZIP were retrieved by their supplied Library IDs.
The original audit demonstrated F01 both hosted and locally; its other findings
were local. This sitting's baseline and repair regressions use actual local MCP
handlers, Python workers, the maintained native client and production grading.
They do not attest deployment.

## Repairs and regression witnesses

| Finding | Reproduced failure | Repair and witness |
|---|---|---|
| F01 | An accepted batch edit made the next answer appear stale against the advanced draft. | Record the shared batch origin and compare it before its first replayed member. The real eight-line MCP case accepts an edit before rejecting another; stale count is zero. A native external-input mutation still reports both consulted members stale. |
| F02 | A single row addressed to L2 or nonexistent L31 was consumed for pending L1. | Validate exact target membership, cardinality and duplicates before mutation. Bare, fenced and `LINE:` answers also validate echoed labels through the production ModelProposer and interview parser. Correct targets still work. |
| F03 | Suspended counters disagreed with the worker, and a lyric fabricated seven stale answers with no journal. | Project authenticated `verdictOf` fields into suspended responses. The spoofed lyric yields zero; accepted batch progress also yields zero. Human report text never establishes these counters. |
| F04 | Current run revision plus older state rewound accepted lyrics and outcomes. | Bind supplied state/checkpoint bytes to the cached revision before decoding or folding. Mixed versions refuse without changing the record; no-ID standalone state recovery and cache-loss recovery remain available as independent runs. |
| F05 | Rejected whole-song and atomic group answers were replayed for a new attempt. | Include attempt in group question identity, pending records and group outcome identity. A real whole-song control rejects its first answer, asks again, and accepts its second. An ungraded new attempt cannot borrow an earlier attempt's outcome. |
| F06 | Repeating a pending question returned `final_draft: null` despite retained accepted lines. | The native no-answer path emits an authoritative suspended artifact; MCP also preserves the journal's accepted draft. No-answer state and run continuations remain uncertified. |
| F07 | An uncertified exit-2 continuation claimed exit 3 and demanded nonexistent rewrites. | Store the terminal distinction and give coverage/pronunciation recovery guidance. The chat wrapper uses the same distinction. Neither path invents readings or certifies unresolved work. |
| F08 | The server advanced to revision 2 while the native snapshot kept revision 1. | Persist returned run ID and revision together with returned state/checkpoint. Real creation tests make successive explicit/automatic continuations and reconnect from the saved snapshot. |
| F09 | Atomic whole-repair prompts dropped actual previous-round rejection reasons. | Use the common attempt/prior-feedback renderer on that branch. The witness executes the real atomic repair/grader path in rounds 1 and 2 and checks the round-1 reason in the round-2 prompt. |

Raw single-line labels (F02), group outcome attribution and collisions between
different pivots at the same attempt (F05), and chat-wrapper recovery (F07) share
the original root mechanisms. Group identity now binds a digest of the complete
rendered question, pivot and label, in addition to members, round and attempt.
Legacy folded batch ambiguity is a compatibility consequence of F01.

The frozen fresh runs exposed additional defects, under regression:

- The floor projected internal rhyme obligations onto unrelated line endings.
  It could flag an unmandated `fire/desire` pair and report a chorus edit as
  “fixed 39” while the ten actually declared end-rhyme pairs were unchanged.
  Its pair projection now follows the declared slots and schema/structure;
  lexical checks still inspect the complete draft. The original 28-line plan
  and retained drafts are preserved in
  `lyric-harness/quality/results/continuation_audit_2026-09-20/dead_letter_case.json`.
- Explicit occurrence stress was overwritten by function-word defaults in
  transcription, internal anchors, final anchors and meter. Those readers now
  honor the supplied phones. Unselected occurrences retain their defaults.
- Text-dependent unknown checks could terminate revision without asking for
  an available repair. The loop now gives them a repair pass, keeps them
  distinct from judged defects, and targets the unreadable endpoint when
  known. Exhausted unknown-only work remains uncertified at exit 2. Missing
  calibration or undeclared grid information is not treated as writable text.
- The expanded candidate menu claimed every offered word came from an
  exact-vowel pool, although a second route searches a broader ranked pool.
  Greenhouse's L6 offered `have` against `waits`: the production grader accepts
  its near vowel under the declared coarse class, but its vowel nucleus is
  different. The prompt now describes the expanded search without inventing
  exact-vowel provenance. This is a reporting fix, not a grading change. The
  exact plan and retained draft are in
  `lyric-harness/quality/results/continuation_audit_2026-09-20/greenhouse_case.json`.
- The admission summary added one to already one-based production line
  numbers and credited named-relation judgments to the default scalar cutoff.
  It now reads the original numbers and reports only groups using the default
  admission route, with the active declaration's cuts. Custom cuts are not
  assigned the shipped calibration's chance rate. A real CLI regression and
  mixed named/default-group control cover this, alongside the frozen input in
  `lyric-harness/quality/results/continuation_audit_2026-09-20/bell_foundry_case.json`.

- Spare Key exposed a scheduling gap: a computed empty single-partner menu
  still went through single-line attempts before M-205 released the partners.
  A verified joint repair exists for the frozen case. With a declared group
  writer and nonzero backtrack budget, empty computed menus now ask that
  writer first, including exclusion from prefetched single-line batches.
  A declined group still leaves the complete single-line attempt budget;
  an empty bounded menu is not a proof of impossibility.
- Clock Shop stopped at planning: the audibility inventory ignored the global
  relation and called explicit consonance groups bare defaults. It now resolves
  global and per-group declarations, and identifies class/type declarations
  outside its schema-only predicate. The report no longer says explicit
  declarations were sampled by the planner.
- Red Flag stopped at its first grade: the D group was unknown because “Good”
  has different dictionary readings, but a neighboring violation made the
  renderer label D as holding. Reports and writer questions now retain that
  unknown status. The frozen input is in
  `lyric-harness/quality/results/continuation_audit_2026-09-20/signal_flags_case.json`.

- Rain Gauge stopped after a rewrite was rejected solely because its old
  occurrence pronunciation no longer matched the changed line. Revision now
  scopes retirement to the immutable input: removed occurrences remain visible
  as retired, with no phones applied to new text. Fresh stale declarations
  still refuse, and changed ambiguous text still loses coverage. The replay
  proxy retains this scope in its memo identity. The exact before/after and
  declarations are in
  `lyric-harness/quality/results/continuation_audit_2026-09-20/rain_gauge_case.json`.

These changes do not make a grading threshold easier to pass. The original
failing inputs remain regression evidence; the compensated writing run is not
counted as qualification.

## Compatibility and recovery

The existing connector semantic envelope hashes source, assets and runtime. Old
envelopes refuse automatic replay after this deployment. Preserve the original
wire and use `lyric_revise` with only `recover_only:true` and that `state` or
`checkpoint` to export the accepted/input drafts and journal without replay.
Start independent work explicitly with the complete retained draft and its
declarations. Nothing rewrites an old capability or deletes history to fit.

Native journals retain version 1 with additive question metadata:

- New batch answers carry their shared `batch` origin. New single answers carry
  `batch:null`; checkpoint single answers do too.
- A legacy pending batch still has its exact member set, so folding it can stamp
  its origin. A legacy pending single can likewise be identified unambiguously.
- Already-folded legacy records without that marker may share a fingerprint
  across different lines. This cannot distinguish a batch from independent
  rejected singles. Native defer refuses that ambiguous history at exit 2,
  preserves the file, and names `accepted_lines` and a new independent state file
  as recovery. It does not silently invent batch boundaries.
- A legacy group answer without an attempt or complete-question digest is bound to the first matching
  question on the deterministic native replay walk. Re-reading that exact
  question hits; subsequent attempts and rounds cannot consume it again. New
  records have exact round/attempt and complete-question identity. This policy does not reconstruct
  provenance an old journal never recorded.

Current run-ID continuations must carry the current revision and, if supplied,
its exact state/checkpoint. Standalone state recovery does not assert that a
cached run is current; it creates a separate run and leaves the existing one
alone. This was a consistency defect, not a demonstrated authorization breach.

## Coverage and limits

`mcp/test_continuation_audit.mjs` exercises the shared public tools through MCP
in-memory transport, the real worker and grader. It is in `test:connector:live`.
`quality/test_production_journal.py` is already in the CI suite matrix. The new
tests failed on the old production paths; the supplied observational probes
also reproduced all nine before implementation. These deterministic writers
are regression fixtures, not fresh-song evidence.

Related controls include immutable declarations/input, capability isolation,
stale revisions, simultaneous continuation exclusion, interruption/checkpoint
recovery, cancelled/queued work, response authenticity, capacity preservation,
unvisited batch answers, cache loss, and warm/cold replay parity. Existing
run/deferred-continuation suites include the real 24-line split-batch path. The
largest journal tests exercise all 31 admitted lines and exact capacity refusal.
No grading thresholds, admission bounds, fingerprint inputs or assertions were
weakened. Recipe construction and lyric construction remain separate.

There is no claim of exhaustiveness. In particular, an old native group record
names its member texts, not every outside line; no full-context migration is
inferred from it. The historical modal-menu observations in M-303 are not
resolved by this audit. A current offered list is not an artistic ranking or a
promise that a candidate fixes a whole-draft finding.

## Fresh writing through the public creation workflow

`scripts/qualify_lyric_interview.mjs` records an operator-written JSON request per
line, exact public responses, private client snapshots and timing receipts. It
uses `connectConnector` in creation mode and MCP transport; completed songs execute
sweep → screen → program plan → exact-draft grade → interview revision; frozen
cases stop at the first identified software failure. The
runner writes no lyrics, edits no journal, and makes no paid writer calls.

Run it from the repository root with `node scripts/qualify_lyric_interview.mjs
--out=NEW_DIRECTORY`; provide `{ "tool": "lyric_sweep", "args": { ... } }` records
on stdin. Use the documented Python/dependency setup first. Output directories
and snapshots are private while the session is active.

| Work | Creative brief and generated structure | Observed result |
|---|---|---|
| Last Ferry, seed 20260921, 17 lines | A ferry operator recognizes a passenger's escape from an abusive home; compassion changes the meaning of lateness. Four sections: verse, bridge, chorus, identical chorus; 11/8, 11 rhyme groups and six verbatim return classes. | Historical local exit 0 after two rounds. It predates the additional floor/reading fixes and is not final-build qualification. Exact continuation behavior is retained as evidence. |
| Dead Letter Office, seed 20260922, 28 lines | A clerk finds a mother's unmailed letter and reconnects the archive to living people. Two identical choruses, ten-line bridge, two changing verses; 3/8, 19 rhyme groups and five return classes. | Frozen diagnostic case, ending uncertified at exit 2. The operator wrongly continued drafting through suspected defects. The exact trace is preserved, the defects are under regression, and this run is not counted as success. |
| Night Shift Ledger, requested 128 lines | A night-shift work narrative with verse, chorus, bridge and outro available, at least six sections. | Public sweep refuses at admission. No shorter substitute, operator-written plan or purported long-song completion is counted. |
| The Greenhouse Clock, seed 20260924, 28 lines | A caretaker learns that living growth does not follow charts. Seven-line chorus, bridge, nine-line verse, identical chorus and outro; 2/4, 19 groups and seven verbatim return pairs. Most lines have exactly five available syllable slots. | Frozen at public call 7 after a prompt misdescribed its candidate source. One verified edit and its return were retained; three supplied batch answers remained explicitly unverified. No later answer was sent. This run is diagnostic evidence, not completed-song qualification. |
| The Bell That Kept Its Scar, seed 20260926, 28 lines | A founder values an unmarked casting until an apprentice hears the cracked bell differently. Two verbatim choruses, two changing verses and a final bridge; 2/4, 12 overlapping groups and five return pairs. | Frozen at its first public grade, call 4, when the admission report named the wrong lines and credited the wrong judge. No revise call followed that defective grade. |
| The Last Label, seed 20260927, 28 lines | A museum guard rescues a child during a flood; the child's muddy name replaces the patrons' brass labels as the object worth keeping. A 20-line opening bridge, two one-line verses, one repeated one-line chorus and a four-line outro; 8/8 grouped 2+3+3, 13 overlapping groups, at most eight syllables per line. | Exit 0 on `b330acc`, one round and one accepted single-line repair. A public dictionary selection for the verb “records” was regraded before revision. All 28 lines and the return survived. |
| Spare Key, seed 20260930, 12 lines | A shopkeeper leaves a key for someone displaced by a leak; verbatim returns and overlapping consonance groups. | Frozen when an empty single-partner menu consumed line attempts before offering the available group repair. The actual frozen draft has a verified joint repair, now pinned in production tests. |
| Clock Shop, seed 20261001, 12 lines | Repairing a clock while accepting a changed household; repeated sections and explicit consonance. | Frozen at the plan's incorrect audibility inventory, before writing lyrics. One earlier sweep used the invalid predicate `returns`; its public refusal is retained as operator error. |
| Red Flag, seed 20261002, 12 lines | Railway signal flags and a warning that changes meaning; internal consonance and verbatim returns. | Frozen at the first grade when an unreadable neighboring group was rendered as holding. No revision was attempted. |
| Rain Gauge, seed 20261003, 12 lines | A gardener learns what a gauge cannot promise; short slots, interacting consonance groups and identical returns. | Frozen when changing L3 was rejected solely because its old pronunciation record no longer matched. Earlier verified edits and unverified batch members remain in the trace. A read-only screen was already queued; no subsequent draft answer was sent. |
| Half a Ticket, seed 20261004, 12 lines | A traveler reads a lost companion's presence into a ticket stub. Seven-line verse, repeated one-line chorus and three-line outro; 7/8 grouped 2+3+2, five to six syllables per line, a five-member consonance group overlapping a four-member group. | On `6f28dce`, two atomic group edits were accepted, both obsolete occurrence readings retired, and the draft carried into round two. An unanswered continuation retained the exact draft and question, uncertified at exit 4. One genuine consonance violation remains. This is an unfinished writing run, not completed-song qualification. |

Half a Ticket ran without source changes: the before/after runtime source hash
was `31630a64d21ce0f346c633b7bb4fc7beb702054d4cb07943469ec1f229b62f55`.
Its empty menus prompted a diagnostic of the relation itself: among the 15
declared vowel features at the unchanged nucleus cutoff 0.6, the largest set of
pairwise-disagreeing nuclei contains four. Thus five **monosyllabic** anchors
cannot all satisfy this consonance class. That is a necessary bound for that
restricted case, not a proof that the generated plan is impossible: longer
anchors and changed words remain available subject to its other constraints.
The bounded menus did not supply such a repair, and this writer did not complete
one. Neither the plan's feasibility nor general writing capability is inferred
from the two accepted partial repairs. No private word search or lyric grader
was used; the diagnostic counted vowel-feature combinations, and all creative
word screens went through the public tool.

The connector declares a 447-line ceiling; the current public plan reports a
463-line structural envelope. Neither is executable capacity: writer admission
currently reaches **31 lines at up to 12 syllables per line**, derived from the
2,000,000 candidate-pair ceiling. The 17-line plan reports 585,225 projected
candidates; the 28-line plan reports 1,587,600. These are admission projections,
not measured CPU, latency or memory promises. The 128-line request cannot reach
grading, batching or revision under the current bound. Therefore this sitting
does not establish writing capability, continuation behavior or performance over
100 lines. Raising that bound requires capacity work, not a larger constant.

Artistic assessment is separate from certification. Last Ferry sustains a
speaker, concrete action and a clear bridge reversal. Its repeated hook gains a
specific escape meaning, but “the coast crowns the sky” and “Time will hold back
the clouds” are less direct than its opening image; shifting between “you” and
“her” needs a performance decision. Dead Letter Office's handwriting, stamp and
wax give it a material setting, while some compressed metaphors need editorial
review. Neither a single author's assessment nor a passing phonological grade
establishes listener response, sung setting, originality or general artistic
quality. No unsupported score is assigned.

The Last Label has a continuous action and a concrete change in what the speaker
values. The repair replaces a predictable rope pairing with an unshown injury,
connecting the rescue to the later line about unrecorded hands. Some images,
particularly “blue bloom stains hems” and “Lamp oil draws rings inside a bowl”,
remain compressed and would benefit from editorial/listener review. The unusual
opening bridge has no declared narrative rubric; its coherence is this author's
assessment, not a harness measurement.

Half a Ticket retains its travel, work and remembered-companion thread, but
“the rails have long chewed heat” is strained and the compressed sewing images
need editorial work. Its technical partial progress is not an artistic success
claim. The unfinished five-member repair is a limitation of this demonstration,
not a reason to loosen its relation or silently simplify its structure.

Timing receipts separate public call wall time from worker-reported harness
time. Operator intervals include writing, reading feedback and interleaved code
investigation; they are **not** pure writing time. Last Ferry used 161.01 seconds
of public call time, 159.29 seconds of harness time, and 606.46 seconds between
calls (including initial wait). One first-grade request mistakenly supplied a
string in `draft` and was refused before dispatch; the identical text was then
sent as the documented line array. An earlier local HTTP connection attempt was
refused by the execution environment before any harness call. Neither is hidden
as successful writing or attributed to a harness defect.
Greenhouse also records one operator error: `want` instead of `wants` on its
first plan request. The native client refused it before dispatch; the correctly
named request was then sent through the public workflow.
Greenhouse used 91.223 seconds of public call time and 89.733 seconds of
harness time; its 687.118 operator seconds include investigation. These are
costs of a frozen diagnostic run, not a completed-song benchmark. The Last Label
used 134.386 seconds of public call time, 129.136 seconds of harness time and
413.112 operator seconds. Those calls overlapped calibration work; they are not
an isolated service-latency benchmark.

All eleven closed sessions (including frozen and unfinished work) are banked in
`lyric-harness/quality/results/continuation_audit_2026-09-20/interviews.zip`.
The adjacent `session-metrics.json` derives timings and saved response/state
sizes from those receipts. Private client snapshots are excluded from the
archive; exact public requests, responses and timing receipts are retained.

| Run | Public seconds | Harness seconds | Operator interval seconds |
|---|---:|---:|---:|
| Last Ferry | 161.008 | 159.292 | 606.456 |
| Dead Letter Office | 244.536 | 242.814 | 918.857 |
| Night Shift Ledger | 0.520 | 0.514 | 19.437 |
| Greenhouse Clock | 91.223 | 89.733 | 687.118 |
| Bell That Kept Its Scar | 39.798 | 38.233 | 232.783 |
| Last Label | 134.386 | 129.136 | 413.112 |
| Spare Key | 113.374 | 108.009 | 587.317 |
| Clock Shop | 10.607 | 10.572 | 62.662 |
| Red Flag | 23.395 | 21.951 | 112.309 |
| Rain Gauge | 156.705 | 150.463 | 573.356 |
| Half a Ticket | 234.828 | 227.328 | 999.120 |

## Verification and delivery record

Before the additional fresh-run repairs: ten new connector tests; 20 production
journal tests; 167 connector checks; proposer regressions; replay-memo parity;
run/deferred continuation; state codec and lyric state controls. Related lifecycle
tests exposed a missing NLTK package in the system `python3` used explicitly by
one test. That test passed with the pinned environment on PATH; its provider is
a local fixture, not a paid model. Original failures and resource refusals remain
in the evidence record.

The final implementation passed 11 real-worker MCP continuation tests, all 41
production revision tests, all 20 production journal tests, replay-memo parity,
the proposer suite and all 27 revision-loop sections. The production-offline
pipeline passed its Node and intermediate Python suites before one old
pronunciation assertion failed: it expected retirement itself to be a coverage
regression. The replacement still correctly rejects the edit for unresolved
`prominence:L1`; the updated assertion pins both that rejection and the old
record's retirement. All 15 pronunciation tests then passed, as did the final
24 computational-audit tests. The first assertion edit used the wrong fixture
field (`key` instead of `id`); that test-author error and its corrected run are
retained. The pipeline is not represented as one uninterrupted green run.

The QR7 mutation was caught after a clean production baseline, with no surviving,
indeterminate or stale mutant in that targeted run. An earlier attempt had an
indeterminate baseline because of obsolete coverage assertions; it is retained
and is not counted as a caught mutation. These checks used Node 24.19.0,
Python 3.12.14 and NLTK 3.10.3, with the pinned Python also placed on PATH for
tests that explicitly invoke `python3`.

The first full PR run exposed integration expectations missed by those targeted
checks: the new floor-scope note needed its explicit disclosure disposition;
the planner import guard needed a narrowly scoped admission for the relation
name resolver; the CLI audibility test still matched the old wording; and a
historical whole-flag fixture now correctly retained its unknown-reading lines.
The disposition and census are recorded, the import guard permits only the
resolver inside the report, and the CLI tests retain exact counts, uncertainty
and the separate fully judged success control. The initial failures are banked
in `lyric-harness/quality/results/continuation_audit_2026-09-20/ci-integration.json`.
These integration repairs do not change the comparator or lyric acceptance.

The comparator batch changes `lyric_harness.py`, including explicit-reading
handling. Its defaults are preserved, but this still requires calibration.
Partial calibrations were stopped when later correctness bugs required
another fingerprinted-file change; their rows and memos are not adopted. Eight
current-source calibration shards recomputed 8,536 rows from the corpus with
fresh memos. No previous-fingerprint memo or unverified saved rows were adopted.
The normal check verified row provenance, the complete population, the range,
the MATTR/TTR population and all five shipped curves: **HOLDS**. No curve was
changed. The pin is now
`de112e81810ffafa953024c77e29df618e1bc5ef8befd9de5ad4022acbdc8bda`,
backed by
`lyric-harness/quality/results/continuation_audit_2026-09-20/curve-check.txt`.
The adjacent `calibration-rows.zip` contains all eight TSVs, original provenance
sidecars and compute logs. The longest shard took 2,499 wall seconds; the final
check took 33.058 wall seconds. The shards ran concurrently with other checks,
so their timings are not an isolated benchmark.

The pull request is the delivery record for its exact head, required checks and
merge commit. Those facts are intentionally separate from local qualification.
Local success and a merge are not evidence that the hosted process runs these bytes.
The read-only deployed health check during verification still reported audited
commit `740cd69f9b848ad137ea399bd18f671293dd7c61`, release
`1255164302:35479806389:1:lyrics-image`; it therefore cannot demonstrate any of
this branch's repairs.
