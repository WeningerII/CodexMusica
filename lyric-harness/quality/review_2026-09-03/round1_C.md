# Round 1, reviewer C — what stands between a seed and exit 0

## The frame

The task needs four things: a plan a writer can satisfy, a brief the writer can read, a check cheap enough to iterate, and a control loop that reaches a stop. I read the harness, the connector and the record against those four, and the evidence splits cleanly: the CLI path does all four today; the chat path has never done the fourth, and nobody has measured it since the plan and brief were repaired.

## MEASURED

- **Five exit-0 songs exist and every one came through a strong writer at the CLI.** `songs/*.finish.log` stamps; MANIFEST §Songs. Harness compute per song is minutes, not hours: a cold `finish` on a clean 16–18-line draft is 49–60 s, the genuine 5-answer replay of seed 7009 is 195.6 s cold and 4.3 s warm (`timing.txt` at_preloop rows). The writer's thinking was 10–90 min (MANIFEST).
- **Zero exit-0 songs in ten chat-path rounds.** `flash_battery_runs.txt`; M-168 addendum 2026-09-01 ("ten rounds, zero exit-0 songs on the chat path"). Round 9: 151 min, turns 6–8 spending ~30 min each on `lyric_revise` calls dying at the client's 600 s clock (M-166). Round 10: 22.5 min, loop parked ROUND_LIMIT 20/23 open, then NO_PROGRESS, then a hard 429 (M-168).
- **Every fold re-runs the whole loop from the top.** `lyric_tools.js:1502,1521` passes `--propose=defer:` on every call; `_defer_proposer` replays all answers (`lyric_harness.py:6628ff`). The memo removes 87% of the *replay slope* (M-167: +2.99 s → +0.38 s per resume) but not the floor: fold 1 replays nothing and costs ~59 s (M-167), and the 4.3 s warm row in `timing.txt` is an *identical* call, not a fold with a new question.
- **Where a cold grade's seconds go.** `profile_finish_before_i_did.txt`: `modal_head` 60 calls → 86.7 of 118 s profiled; `CandidateEngine.candidates` 22 calls → 59.8 s; `score()` 1.26 M calls. I re-measured bare: index of 39,423 words, one complete-pool `candidates()` ≈ 0.9–1.1 s per call word. `_field_one` caches per Reviser instance and clears at 65 entries (`revise.py:3810`); nothing caches a word's field across processes. These fields are pure functions of `(word, declaration)` — the key is already spelled at `revise.py:3775`.
- **The plan was unwritable in ways only found this week.** 83/120 seeds drew a group no vocabulary closes (M-206); 15.9% of lines had every word bound (M-171); a return group's every answer was refused (M-201); an empty conjunction was reported as "mandate at fault" while 40 words answered (M-202); a stuck line was never re-asked and a complete state re-ran as live (M-183); the hook phrase froze (M-212). All CLOSED on this branch; **none is deployed**: the live connector is at e40786d6, 9 commits behind HEAD (`git log e40786d6..HEAD`), and no round has run since 2026-08-29.
- **The driver sleeps.** `flash_battery.mjs` sleeps `PACE_MS` after every turn, default 130 s (`flash-battery.yml`), so ~11 of round 10's 22.5 min and up to ~17 min of any 9-turn round is the client sleeping. The pace was derived for the 30/hr/IP limiter on multi-song rounds; a single-song round of 9 turns cannot reach 30/hr.
- **Model quota.** 15 requests/min on the free tier (`chat.js:44-50`); one request per hop; `maxSteps 14` (`gemini_agent.js:63`). A turn whose tools return fast (four exit-2 refusals in round 10 turn 4) can spend 14 requests in under a minute.

## INFERRED

- Round 9's 151 minutes were a large drawn shape × the pre-memo replay slope × a 600 s clock (M-166 says so and marks it inference; the transcript never printed the line count). Both factors have since moved (short-song brief; M-167 memo; M-193 short profile), so the "2–3 hours" regime is probably gone — probably, because it has not been re-run.
- Round 10's non-convergence is best explained by the planner/loop defects above, not by flash-lite's writing: seed 88291 had five-of-five-slot lines (M-171), the parked pushes replayed a COMPLETE state (M-183), and the loop briefed lines whose flag was already gone (M-210). A strong writer hit six of these on the CLI and needed a harness fix each time; a weak writer had no chance.
- The per-fold cost on the deployed box, warm, is on the order of 20–60 s (M-167's 18 s cold-Reviser rebuild + one new brief/verify ≈ three grading passes at `revise.py:4590-4600`). Forty folds ≈ 15–40 min of harness time — inside the owner's bar if and only if the model batches folds (round 10 did: 8 calls in turn 0).

## UNKNOWN

- Whether flash-lite converges on the gated planner through chat. No round since deploy #18 measured it (M-168 addendum). This is the one question everything else waits on.
- The harness/Gemini split of a chat turn's wall time; worker RSS across a song (M-170 unmeasured list).
- Why round 10's 429s fired (per-minute burst or daily quota) — `tools[]` kept no timestamps per hop.
- M-205 has no `###` entry in MISSING.md; its content is only in commit 0252813e's message. The MANIFEST asks for it "in full" and the ledger cannot supply it.

## Q1 — what is actually wrong

1. **The measurement the owner's bar demands has not been taken.** The system that has never produced an exit-0 song through chat is a *different* system from the one on HEAD, and the difference is exactly the defects that explain round 10. This is a process failure (merge → deploy → dispatch was named on 2026-09-02 and not done), not a code one.
2. **The cost structure is O(distinct call words) per grade, paid in full every process, and the work is a pure function of declared coordinates.** The whole-vocabulary memo (`relations._WVP_MEMO`) proved the pattern is admissible; `_field_one` was left out of it (M-155 "deliberately not built" — about `joint_field`, whose inputs churn; a word's field does not churn).
3. **The MODAL_RHYME check on passing pairs builds two complete fields per mandated pair** (M-170 item 1; profile). A clean 16-pair grade spends most of its time proving pairs that pass are not banned.
4. **The instrument adds sleep it does not need** (130 s pace on single-song rounds).

## Q3 — what is not wrong

- Cold start / subprocess-per-call: import 0.1 s, Lexicon 0.6 s (`timing.txt`; M-155).
- The deferred-replay design itself: answers replay instantly; determinism holds (four replicates, one digest, M-167); the memo does what it claims.
- exit 3 and exit 4: honest stops, not failures. A parked song is disclosed as parked (M-163).
- `PAIRS: mandated 21, judged 18, refused 3` at exit 0 (seed 7009): disclosed, counted apart, and an open ruling (#21) — not a silent fallback. Whether it satisfies "no skips" is the owner's call, not a bug.
- The 2 GB instance (826–882 MB measured, `render.yaml`); the missing `worker.py` in Docker (fixed, `Dockerfile:43`).
- The five `Lexicon` constructions: 3.6% (M-170).

## Q2 — recommendations, in order

1. **Merge, deploy, dispatch round 11 with `--songs=1 --turns=9 --pace=0`.** Changes: nothing in code. Evidence: every convergence hypothesis is untested on HEAD; M-168 addendum names this the owed measurement. Cost: one round of Gemini credit (~$0.10–0.50 at $0.0156/hop, M-197) and the owner's press. Measure: `loop_ladder` in the summary — an exit-0 row, or the stop reason and open-line count per turn, which M-169 made harvestable. Pace 0 removes ~17 min of sleep; the 4/min IP limiter still cannot bind on multi-minute turns. Breaks: nothing; a 429 storm is what the M-164 backoff is for.
2. **Process-level memo on `_field_one`, keyed on its own cache key (`revise.py:3775`), FIFO-bounded, same soundness argument as `_WVP_MEMO`.** Evidence: 22 `candidates()` calls ≈ half of a cold grade; the same call words recur every fold of a song. Expected: a cold clean grade from ~50 s toward ~25 s, and every later fold on the warm worker paying near zero for fields. Cost: a few MB per song; a key-completeness proof (the concern M-170 raised for holding the whole Reviser is narrower here — one function, declared key). Measure: `cmp` stdout against baseline across the five banked state replays (the M-155 method); `timing.txt` rows re-run.
3. **Shortcut the MODAL_RHYME pair check when `field_depth is None`** (M-170 item 1): membership in the forbidden head needs the head, not the offer. Evidence: profile. Cost: gated on the depth coordinate, refuses otherwise. Measure: byte-identical verdicts on the sonnet battery and the five songs; profile `modal_head` share.
4. **Only after 1–3: reconsider the fold-per-call shape.** If round 11 converges but slowly, the per-call cold-Reviser rebuild (~18 s, M-167) is the next floor; holding a Reviser across requests is M-170's item 2 and needs the cross-request safety proof it names. Do not build it before the measurement says it is the wall.
5. **Give M-205 a ledger entry.** Evidence: MANIFEST cites it; `grep '^### M-205' MISSING.md` is empty. Cost: a paragraph. Measure: `verify_entries`.

What I would not do: raise any timeout, re-derive the 600 s budget, or touch the planner's density again before round 11 — each of those is tuning a constant against a measurement nobody has.
