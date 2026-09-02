# The 2026-09-01 triage of how a song is written — index and dispositions

The audit itself is the owner's private artifact *Lyric Harness Triage*
(claude.ai, 2026-09-01), built by reading the working order end to end and
verifying each finding by a second, skeptical reader before it was banked;
31 findings survived, 6 skeptic refutations are recorded inside it. This
file is the REPOSITORY's copy of what the audit found and what became of
each finding, so the artifact is not the only place the map lives. The
owner's answer to the audit's questions was a delegation — *"I leave the
answers to your capable hands and taste"* — and every ruling taken on it
is listed in `BACKLOG.md` § RULINGS TAKEN UNDER DELEGATION, one line each,
with the argument in the named `MISSING.md` entry.

Tiers are the audit's own: **A** blocks a finished song; **B** why every
song sounds the same; **C** cost, clocks and the deploy; **D** the record.
"Where it went" names the register entry that closed, repinned or records
it; an OPEN row says what it waits on.

| id | tier | finding, in one line | where it went |
|---|---|---|---|
| C16 | A | a tier-1 answer was keyed on (line, attempt) and `attempt` restarts each round, so a stuck line was never asked twice; a finished deferred state re-ran as live | M-183 CLOSED — verified at HEAD 2026-09-02; a reused state's stale answers are counted at the stop |
| C17 | A | the brief intersected one candidate field ACROSS a line's binding places; tier 2 rewrote the wrong line | M-184 CLOSED — verified 2026-09-02; two prompt pins repinned; tier 2's ANCHOR side recorded OPEN in the addendum |
| C02 | A | the chat surface finished zero songs: the suspended run was re-injected after a stop, and an unseeded song could not be carried | M-183, M-195, M-197 CLOSED (the code rungs); ~~the rungs that ended round 10 — the swerve refusals, the turn cap, the 429 — are touched by no entry~~ — taken 2026-09-02 in M-168's addendum (the 429 bounded and counted; the swerve read off the job log as a harness refusal whose cause the record could not hold, and the headline now reaches `tools[]`; the cap read and unmoved); OPEN — round 11 is the owner's, after a merge and a deploy |
| C14 | A | `quality/recover.py` — the human door — had no verb and no tool | M-195 CLOSED (`recover`, `lyric_recover`) — verified 2026-09-02: the CLI door held, the connector's read no refusals and refused its own mandate at a 400-char ceiling; both repaired (addendum) |
| C05 | A | a pasted song could be looped but never FINISHED: only `finish` rendered, and it needs a seed | M-195 CLOSED (`revise` under `defer:` renders and stamps) — verified 2026-09-02 end to end on the CLI; the connector route chains only after the same-day repair |
| C20 | B | the participation draw pinned the mean density near 2.5 bound words a line; the sparse band was unreachable at any seed | M-191 CLOSED (the density cap) |
| C03 | B | the length envelope's floor rose past four of the five listenable songs | M-193 CLOSED (the `short` profile; envelope 12–55) |
| C04 | B | a 108–126-token song was graded on the sonnet profile by list order | M-193 CLOSED (the line-count tie-break) |
| C09 | B | a drawn end-web can be inaudible as rhyme and nothing said so (M-120) | M-192 CLOSED (disclosed); RULINGS WANTED #18 for the draw |
| C19 | B | the brief named `T5`, `headrime` and a schema with no gloss, and never the syllable ceiling `SLOTS_EXCEEDED` grades against | M-192 CLOSED (legend, capacity line) |
| C12 | B | the screen could not ask the question the grade asks of a drawn schema | M-189 CLOSED |
| C18 | B | the two-tier ban closes every common rhyme family; its effect on convergence and end-word rarity is measured nowhere | ~~OPEN~~ PARTIAL 2026-09-02 — the measurement as asked is NOT CONSTRUCTIBLE (no first draft is banked; every banked `revise` row is 0 rounds, so the ban acted at the screen); `quality/ban_convergence.py` reads what IS banked — the screened pool 366 HOMEOTELEUTON / 395 MODAL_RHYME / 792 CLEAN / 11 REFUSED over nine songs, and per final the HEAD/TAIL/OUTSIDE rank of every rhyming pair (carry_it_over 0/2/7); the bank-wide totals are MEASURED and pinned 2026-09-02 on a quiet box — 719 mandated / 549 judged / 170 refused, and of 487 eligible pairs **7 sit in the modal head, 155 in the offered tail and 325 outside the candidate field entirely**, tail ranks median 26 — so two thirds of the bank's rhymes were never in the ban's field at all; all 7 head pairs fall in the four songs whose graded mandate is reconstructed. The draft-banking mechanism ships (M-196) and the lost drafts are four, of which git holds one |
| C07 | B | the instructions let a chat skip the sweep and the screen | M-189 CLOSED (sweep-first sentence; the screen judges the drawn relation) |
| C22 | B | a chorus drawn once finished at exit 0 with no hook askable | M-190 CLOSED |
| C08 | B | every song shops the same clean glossary (M-111) | OPEN — RULINGS WANTED #5 is the owner's (may a check read `songs/`) |
| C21 | A | `revise`/`finish` exited 0 over a standing whole-draft flag; the stop printed no findings | M-186 CLOSED — verified 2026-09-02; four carriers that dropped the cause (the connector's status label, three transcripts, the deferred state) repaired the same day; the whole-only `finish` pin is paid (test_verbs §53, seed 176) |
| C15 | B | `lyric_check`'s verdict dropped the whole-draft flags and unreadable end words | M-186 CLOSED |
| C06 | B | `--voices` / `--fallback` were unreachable from the connector | M-189 CLOSED |
| C23 | B | the song-length floor has a false-positive rate and no true-positive rate (no generated class) | ~~OPEN~~ RULED 2026-09-02 under the delegation: the sitting is DECLINED in the proposed design — the human class is pre-1929 by SELECTION (71 of 72 staging rows `pd_affirmed`, the dated ones 1794–1919) and three thresholds carry a measured period slope in the direction that would inflate the AUC — and named in a design that is not confounded, whose search has never been run. The row's own second clause was FALSE in the code (`PREDICTABLE_RHYME` printed the sonnet arm's AUCs under a profile with no generated class, and §15's pin could not see it) and is mechanical now |
| C13 | B | three parked grader rulings (M-136, M-138, M-140) live on bare groups | M-140 CLOSED (normative filter); M-136, M-138 ruled in part — the disclosure halves COMPLETED 2026-09-02 (the band-off flag, verdict flags, the priced `ADMIT DOOR` and `SCHEMA DEFAULT` lines; `test_readability.py` §14–15, battery byte-identical), the verdict-moving halves parked with preregistration outlines |
| C10 | B | the empty/empty coda gift (E-5), cheap half | ~~NOT TAKEN — the owner's 2026-08-21 deferral stands~~ — CLOSED 2026-09-02: the owner lifted their own deferral on *"finish the rest of the work"* and the cheap half SHIPS. `now`/`why` still 0.902 RHYME with 0.350 of it named as agreement by absence, `cat`/`hat` unflagged, battery unmoved at 1064/1014/50/12; `test_readability` §14. E-5 itself stays OPEN on the expensive half |
| C01 | C | the image never shipped `mcp/worker.py` | M-187 PARTIAL (shipped; the live-engagement probe open) — the probe is spelled out 2026-09-02 (two identical deferred `lyric_revise` calls on the live `/mcp`, 6.4 s against 76.8 s) and binds only after a merge and a deploy: the owner's |
| C11 | C | late in a song a chat turn buys ~4 tool calls under the re-sent transcript and the $0.10 cap | M-197: `cost` and `usage` ride the `/chat` response now; ~~`CHAT_MAX_TURN_USD` and brief pruning are the owner's~~ — pruning SHIPPED 2026-09-02 (`pruneHistory`: turn 9 re-sends ~135 KB instead of ~453 KB), and the same day the CAP's own defect was closed: `maxSteps` and `maxTurnUsd` are two answers to one question and the smaller won in silence, so `turnBudget()` derives it ($0.015572 a hop, worst legal turn $0.2180, the $0.10 cap buying 6 hops of 14) and the stop carries its numbers. The dollar figure and the counter's disk stay the owner's |
| C29 | C | tool descriptions promised 10–25 s; a grade measures 88–167 s, past an external client's 60 s default | M-189 CLOSED (measured envelope in every description); the SDK-default-client question is the owner's |
| C24 | C | the CI record was stale in two figures and the nightly sized on a rate nobody re-ran | M-187 ~~PARTIAL~~ CLOSED 2026-09-02 — the sizing re-read off nightly run #1183: cold worst case ~227 min of 240, margin ~13 min, the old ~23 struck in `ci.yml` |
| C28 | C | a mid-turn 429 throws the turn away and is never charged; the spend counter is in-memory | M-197 CLOSED (the throw carries its partial usage and is charged); the counter's disk is AUDIT.md F128, an ops decision |
| C25 | C | five deploys of one sha in 38 h | M-187 ~~PARTIAL~~ CLOSED 2026-09-02 — the re-run case stands down against the sha last asked of Render, read from the workflow's own run history (`last_deployed_sha.sh`); and PINNED the same day in `mcp/test.mjs` — eight checks driving the real scripts against a temporary git repository and a replayed `gh`, five mutations recorded, suite 94 checks |
| C30 | C | a missing staged resource crashed every grading verb at exit 1 in three voices | M-188 CLOSED |
| C26 | C | `main` is unprotected | RULED 2026-09-02 under the delegation: eight required checks (`gate`, `verify`, `freshness`, `catalog-result`, `suites-result`, `verbs-result`, `record`, `revision-loop`), admins NOT exempt, the four additions costing zero wall clock; `verbs-result` is a new job because shard names moved 2 → 4 in five days. The finding sharpened on re-reading — the four red merges were red in TWO jobs, not one. APPLYING it stays the owner's: a repository setting is outside the delegation |
| C31 | C | M-170's unmeasured fold costs | M-170 addendum (the clean-regime fold timed); the FLAGGED regime timed 2026-09-02 as a series — grading calls 9 → 19 → 22 → 25 → 35 → 57 → 60 over six answers in a cold process, ~0.7 s a call, walls 56–135 s under load; `quality/fold_series.py` is the driver; item 3 leaves M-170's unmeasured list |
| C27 | D | 124 of 164 RESULTS rows and 93% of log rows carry a dirty-tree stamp; `song_log` had no parser for `finish`; two songs sit in the bank at exit 3 with no README entry | the `finish` parser SHIPS; re-read 2026-09-02: the writers refuse on a dirty tree, the bank is re-written once at a clean sha with every number unmoved, both songs have sections and `--verdicts` reads 131 resolved / 0 mismatched / 0 refused; the 124 + 2,721 `-WORKING` stamps are history and stay; M-196 stays PARTIAL only on C18's two lost mandates and the draft-banking design |

What the audit got WRONG is inside it and is repeated here so it is not
lost: M-94 was moot (prettier stopped reading the blueprints on 08-25);
M-139's site count was stale; M-135's null exists and gates CI; the
multi-answer fold remedy for C11 does not exist (the loop cannot brief a
question it has not reached); M-168's per-minute-limiter attribution is
asserted, not measured.

## Verified at HEAD, 2026-09-02

The six tier-A rows were re-verified the next day by independent agents,
one per row, each reproducing the audit's own probe on the tree, reading
the code path, and reading the test pin (and, where a copy could be made,
reverting the fix on the copy to see the pin go red). What they found is in
the named entries' addenda; the short form:

| row | verdict | what the verification added |
|---|---|---|
| C16 | CLOSED | a reused state on an edited draft replayed stale answers silently — counted at the stop now (M-183) |
| C17 | PARTIAL, then repaired | the mechanism is closed and pinned; §40/§43 prompt pins repinned; tier 2's anchor side was slot-blind and is repaired the same day (§19 pins both probes); a two-place tie still misattributes a ban note — OPEN in M-184's addendum |
| C02 | PARTIAL | the code rungs are closed and undeployed; round 11 is the owner's after a merge; three rungs of round 10's ladder have no entry (M-168) |
| C14 | PARTIAL, repaired the same day | the CLI door held; the connector read no refusals and refused its own mandate — both repaired, a live `lyric_recover` pin added; the recover → check → revise chain on a recovered DEFAULT mandate is pinned at the schema only, not run end to end (M-195) |
| C05 | PARTIAL, repaired the same day | the CLI paste finishes end to end; the connector chained only with `placements` narrowed until the same two defects were repaired; the repaired chain on a default recovered mandate is not run by any pin (M-195) |
| C21 | CLOSED | the exit and both stamps hold and agree with `song`; four carriers dropped the whole-flag cause (status label, three transcripts, the deferred state) and were repaired; the whole-only `finish` pin is paid on a swept seed (M-186, test_verbs §53) |

Two CLOSED (C16, C21), four PARTIAL (C17, C02, C14, C05) as the verifiers
gave them — the commit message of `551e8e8` says "four CLOSED, two PARTIAL",
which is the count inverted, and a pushed message is not rewritten; this
table is the record. The same verification found CI red at `94e736f` in four jobs — two
`test_revise` prompt pins (M-184), the verb roster and the modal-exclusion
fixture in `test_verbs` (M-195, M-193), a `revise` exit that moved with
M-185, and the record job reading a staged resource as a repo path
(M-188) — all repinned or reworded in the commit that carries this section.
