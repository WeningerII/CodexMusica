# Round 1, reviewer A — what stands between a seed and exit 0

## What the task actually requires

A song reaches exit 0 when a writer answers every brief the loop issues with a line the grader accepts (`quality/loop.py:1604-1970`). So wall time per song is `(folds needed) x (writer time per fold + harness time per fold)`, and folds needed is a property of the writer AND of whether the plan is writable and the brief truthful. The harness's own compute is the smaller term. Everything below sorts into those three factors.

## MEASURED

**M1. The harness finishes songs, and cheaply, when the writer is strong.** Five songs at exit 0 with 0, 1, 3, 5, 5 recorded answers (`songs/*.finish.log` PROPOSER lines; `songs/drafts/*.state.json`). Each was screened with `screen` before writing (MANIFEST). Harness compute: a cold `finish` is 49-58s with zero folds and 195.6s replaying five answers; the same call warm in one process is 2.9-4.3s (`timing.txt`, before_i_did/at_preloop rows). `plan` is 2s (re-timed today: 2.006s).

**M2. Per-call cost is a cold constant plus a replay slope.** cProfile of one 0-fold finish: 110.8s of 118.6s in `revise_loop` -> `brief` -> `modal_head`/`_field_one` -> `score` (1.26M calls) (`profile_finish_before_i_did.txt`). The cold constant (~50-60s) is a fresh `Reviser` rebuilding its fields per process (M-167 strike, M-170 "fold 1 replays nothing and still costs ~59s"); the slope is ~0.7s per replayed grading call, 9 -> 60 calls over six folds (M-170 addendum 2026-09-02). Warm, the slope is 0.38s/resume and the constant vanishes (M-167: 76.8 -> 6.4 -> 4.3s, M-187 table).

**M3. The chat path has produced zero exit-0 songs in ten rounds** (M-168 addendum; `flash_battery_runs.txt`). Round 9: 151 min, folds of 340-515s dying at the client's 600s clock. Round 10: 22.5 min, ROUND_LIMIT with 20 of 23 lines open, then a hard 429. No round since 2026-08-29.

**M4. Round 10's ladder was largely the harness's fault, not the writer's.** 15.9% of drawn lines had every word bound (M-171, 121 seeds); a stuck line was never re-asked after round 1 because the record key omitted the round (M-183); the parked push replayed a COMPLETE state (M-183). Since then: RETURN groups revised one member at a time (M-201), an offer built by a conjunction the grader never asks (M-202), an offer built by the scalar where a schema judges (M-204), tier 2 unreachable from a couplet (M-205, commit `0252813e`; no `### M-205` heading exists in MISSING.md), 83 of 120 seeds drawing an unsatisfiable placement (M-206), mis-attributed violations (M-207), an unscreened ban suppressing tier 2 (M-209), stale round briefs (M-210), a frozen hook phrase (M-212), a legend describing a third of each relation (M-214).

**M5. What is deployed is behind.** Render runs `e40786d6`; nine commits follow it. Checked in that commit's tree: the worker COPY (Dockerfile:43), the M-183 round key, pruning, `RATE_LIMIT_RETRY`, `$2.50` turn cap, M-171 and M-201 are present; `schema_screen` (M-204/209), the M-205 escalation, `placement_bindable` (M-206) are absent. A round today measures a loop that still grinds tier 1 against unanswerable groups and a planner that still draws unwritable ones.

**M6. Kills and transport are gone.** Rounds 9 and 10: zero exit -1, zero -32001 in round 10 (M-166, M-168). `budget.js` is the one clock (600s) read by both layers.

**M7. The warm worker ran in production for zero rounds.** From M-155 to 2026-09-01 the image lacked `worker.py`; the cold fallback was byte-identical so nothing noticed (Dockerfile comment, M-187). Every battery round paid the cold constant on every fold.

## INFERRED

**I1.** The "two to three hours" is round 9's shape: a large drawn plan (transcript prints no line count — M-166 says inferred), cold replay of a growing prefix, one answer per turn. It is not the harness's compute per song (M1) and not the writer's thinking alone.

**I2.** Under the deployed constants a flash-lite song that needs F folds costs at least F x (cold ~55s + slope) if the worker path silently falls back, versus F x ~5s warm. Whether the deployed box answers warm has never been read from a battery row: `tools[]` carries exit code, error, refusal, loop fields, not the path taken (`lyric_tools.js` verdictOf; M-169).

**I3.** The run key includes the draft's digest and the model must re-send `draft` on every call; the envelope carries only `{key, seed, state}` (`gemini_agent.js:537-550`, `replay_memo.run_key`). A model that alters one character between calls forks the memo run AND replays answers onto a different draft; the loop discloses the count at the stop (M-183) but the connector does not refuse. Unmeasured whether flash-lite does this.

**I4.** Round 10's 429s at 395 KB of history (M-197) are consistent with the per-minute request limiter (M-168's reading) and equally with a token-per-minute ceiling; the record cannot separate them. Pruning to <=200 KB is deployed.

## UNKNOWN

Whether gemini-3.1-flash-lite converges on the gated planner at all — the only question that decides the owner's bar, and no round has asked it (M-168 addendum). Whether the deployed worker is warm.

## Q1 — What is wrong

1. The measurement the bar needs has not been taken (M3, M5). Ten rounds measured an unwritable planner, an un-re-asking loop, a cold worker and two clocks. None of that is the current tree.
2. A silent fallback exists by design (`lyric_tools.js:167-170`) and cost three days of blind production (M7). The owner's bar names silent fallbacks.
3. The per-call architecture re-runs `finish` from the top on every fold (`_defer_proposer` docstring: "the loop is not driven, it is resumed"). Sound, deterministic, and 15-45x more expensive cold than warm (M2). It is only acceptable if warmth is guaranteed and visible.
4. The writer skips sweep and screen 2 of 2 times (M-162, open). Screening is what let the five songs finish in 0-5 folds; the ban refused about as many candidate pairs as it passed (M-168 ban-against-the-bank).
5. `finish` exits 0 with mandated pairs unjudged (across_the_tide: 21/18/3; BACKLOG #21). Disclosed, not silent, but "exit 0" and "every mandated pair judged" diverge here and the owner has not ruled.

## Q3 — What is NOT wrong

Process startup (0.1s import, 0.6s Lexicon; 0.8% of a fold — M-155, M-170). The MODAL_RHYME scan (6.9%, not 69% — M-172). The replay memo (proven answer-preserving, and small: ~0.34s/call — M-167). Timeouts and NAT resets (M6). Zero-round finishes are not suspicious: before_i_did had 0 folds because every pair was screened first. The five songs' 10-90 min wall time is a strong writer thinking, not the harness.

## Recommendations

1. **Merge, deploy, dispatch round 11 with the M-169 ladder, one short brief, nine turns.** Changes nothing; it is the owed measurement (M-168). Evidence: every prior round measured a defective tree (M4, M5). Cost: one round of Gemini credit; ~25 min at round-10 pace. Measure: exit-0 or not; `loop_ladder` per turn; `answers_on_record`; minutes. Done means exit 0 inside one dispatch.
2. **Make the verb path visible and refuse silence.** Add `path: warm|cold` and the REPLAY MEMO hit/miss tally to `verdictOf`, publish in `tools[]`, and have `_spawnWorker` failure produce a logged row rather than a byte-identical cold answer. Evidence: M7; I2. Cost: ~40 lines of connector; a spawn failure becomes a visible degradation, which is the point. Measure: round 11 rows show `warm` and fold `ms` in the low thousands after the first call.
3. **Bind the draft to the state.** Store `draft_fingerprint` in the state at the first call; on a later call whose `draft` digest differs, REFUSE (exit 2 message naming the two fingerprints) instead of replaying onto a moved draft. Evidence: I3; `run_key` digest; M-183 stale count. Cost: a refusal flash-lite must handle (it already handles exit 2 rows); breaks any client that legitimately edits the draft mid-run, which M-200's provenance gate already forbids. Measure: zero `stale` counts and memo `warm` on every resume in the transcript.
4. **Rule on M-162 and ship the sweep/screen reminder.** Evidence: 2/2 skips; screening is the difference between 0-5 folds and 20 open lines (M1, M-168 drift). Cost: a policy sentence in `buildSystemInstruction`, chat-only; MCP clients untouched. Measure: `lyric_screen` calls > 0 before the first `lyric_plan` in round 11; `banned_pairs` on the first grade.
5. **Record tool ARGUMENTS (redacted to plan line count, seed, screen words) in the battery row.** Evidence: M-166 could not read the shape; M-168 could not read why exit 2 fired. Cost: bytes in JSONL. Measure: the next inference about "a large drawn shape" becomes a number.
6. **Hold all further harness-CPU work until round 11 speaks.** Evidence: the remaining items are structural (cross-request `Reviser`, M-170 item 2 — explicitly NOT recommended until cache keys are proven) and the warm path already removes the constant (M2). Cost: none. Measure: none; it is a hold.
7. **Rule BACKLOG #21.** Evidence: three of seed 7009's 21 pairs unjudged at exit 0. Cost: (b) would have held that song below exit 0 for one more fold; (c) adds an exit code every client must learn. Measure: `PAIRS refused` = 0 on every banked exit-0 song, or a documented code that says otherwise.
