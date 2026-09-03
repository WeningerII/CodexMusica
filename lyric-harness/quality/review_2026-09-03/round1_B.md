# Round 1 — Reviewer B

## The frame

A seed reaches exit 0 only if four things hold at once: (1) the drawn plan is writable in English; (2) the writer answers the loop's briefs, in the channel the loop reads, at a pace the turn budget affords; (3) per-fold harness cost × number of folds fits under the tool clock, the turn clock, the money cap and the free tier's 15 RPM; (4) the code on the box is the code that was measured. Everything else is hygiene. I judge the pack against those four.

## MEASURED

**M1. The harness converges when the writer answers.** Five songs at exit 0 (finish logs: 2003/6006/7009/7039/7045), needing 0, 1, 3, 4 and 5 consulted answers (state files; `across_the_tide.finish.log` "4 consulted and answered").

**M2. Harness compute per call.** Cold `finish`, 0 answers: 49–58 s (timing.txt rows 1, 3, 7). Cold with 3–5 answers replayed at 18 lines: 195.6 s (timing.txt `at_preloop` call #1) and 153.7 s (my run, 3-answer state → exit 4). Identical re-call in the same process: 2.9–4.3 s (timing.txt; my call 3). **A real one-fold resume in one warm process — state with 3 answers, then the same run with 5 — cost 70.2 s** (my run; `REPLAY MEMO: warm — 11 of 25 grading call(s)`). So the memo removes the replayed prefix and the 14 new grading calls for one new fold still cost ~70 s at 18 lines.

**M3. Where the seconds go.** cProfile of a 16-line, zero-open-line `finish`: `Reviser.brief` 105.8 of 118.6 s; `modal_head`→`_rank_field`→`_field_one`→`candidates`→`score` 86.7 s, 60 `modal_head` calls, 1.26 M `score()` calls (profile_finish_before_i_did.txt). `_field_cache` is a per-`Reviser` instance dict, cleared at 64 entries (revise.py:3776–3840); every worker request builds a fresh `Reviser` (worker.py:108 runs `cli()` whole). The replay memo keys `brief`/`inspect` on the exact line tuple (replay_memo.py `MemoReviser.brief`), so any moved draft misses by construction. M-170 measured the same shape: fold 1 replays nothing and costs ~59 s; the ~18 s resume floor is "a COLD REVISER being rebuilt per call".

**M4. The chat path has never produced a song.** Ten battery rounds, zero exit 0 (flash_battery_runs.txt; M-168 addendum). Round 9: 151 min, `lyric_revise` folds 340–515 s by answer ~6, eight -32001 timeouts (M-166). Round 10: 22.5 min, parked with 20 of 23 lines open after 4 and 8 rounds, ended on a hard 429 (M-168).

**M5. Every battery round ran cold.** `mcp/Dockerfile:20` copied `mcp/*.js` and not `worker.py` until 2026-09-01 (M-187); the deployed commit e40786d6 now has `COPY mcp/worker.py` (Dockerfile:43). No round has run since 2026-08-29 (flash_battery_runs.txt). Therefore the "~34 s + ~15 s/answer" slope that derived `DEFAULT_TOOL_BUDGET_MS = 600_000` (budget.js:15–28) is a cold-process slope.

**M6. The deployed spend caps contradict the code's stated ruling.** render.yaml pins `CHAT_MAX_TURN_USD: '0.1'`, `CHAT_DAILY_USD: '2'`, `CHAT_MAX_TURNS_PER_DAY: '400'` (also at e40786d6); gemini_agent.js:91 reads `Number(process.env.CHAT_MAX_TURN_USD) || 2.5` under a comment "RAISED TO $2.50 BY THE OWNER 2026-09-02". Env wins: the box runs $0.10/turn. No `mcp/test.mjs` pin covers these names (grep: none), unlike `CHAT_TOOL_TIMEOUT_MS`. A late-song hop is ~$0.025 (M-168 addendum), so $0.10 ≈ 4 hops; round 10 turn 0 ended on MAX_TURN_COST after 8 calls (M-168).

**M7. Plan-side walls, found only by writing, all closed 08-29→09-03:** unwritable placement rule on 83/120 seeds (M-206), every-word-bound lines 15.9% (M-171), return-class rule-2 refusal 10/19 lines (M-201), tier 2 undispatchable (M-204/205/209), hook frozen at fill (M-212), stuck line never re-asked (M-183). M-206 onward — 9 commits — is not deployed.

**M8. Writer behaviour (flash-lite):** skipped sweep/screen 2 of 2 rounds, gate held for owner's go (M-162 OPEN); one-answer-per-turn relapse ×3 (M-166); abandoned the song under PARKED_CONTINUE (M-168).

**M9.** Seed 7009 banked exit 0 at `PAIRS: mandated 21, judged 18, refused 3` (finish log) — RULINGS WANTED #21 open.

## INFERRED

**I1.** Round 9's 340–515 s folds are the cold regime (M5) at a large shape; at 18 lines cold I measured 154–196 s. With the worker the per-fold floor is ~70 s (M2), so a 40-answer song is ~47 min of harness time before model time — inside every clock, not inside the owner's patience.

**I2.** The five exit-0 songs needed ≤5 answers because a strong writer screened words first (MANIFEST). Flash-lite writes blind (M8) and lands at 20/23 open lines (M4), i.e. in the O(answers) regime the banked songs never entered. The two populations differ in writer, planner version and connector version at once; this is not a controlled comparison.

**I3.** On the deployed box the binding per-turn wall is most likely the $0.10 cap, not `maxSteps` (M6, rounds 9–10 stopped MAX_TURN_COST).

## UNKNOWN

Whether flash-lite converges on the gated planner through the warm connector (no round on HEAD; M-168). Per-fold cost on a heavily flagged 23-line draft under the worker (M-170 §5, still open). The harness/model split of a battery turn (M-170). Whether the Render dashboard overrides render.yaml's pins.

## Q1 — what is actually wrong

Nothing in the pack shows the loop failing to reach exit 0 once briefs are answered (M1). What is wrong is the *deployed chat path as a system*:

1. It has never been measured with the code that closes its two known walls (M5, M7) — every conclusion about "the model's pace" and "the replay slope" was drawn against images without the worker and a planner drawing unwritable groups.
2. Its turn cap is $0.10 by pin while the code claims $2.50 (M6): a MAX_TURN_COST wall nobody thinks is live.
3. The per-fold floor is ~70 s warm / ~150–200 s cold because the candidate field — a pure function of (word, declaration) — is rebuilt per call (M3). The memo covers what was already graded, not the new fold, and never claimed otherwise.
4. The weak writer is handed the legal field only *after* a line is flagged, so it starts every song in the many-answer regime (I2, M8).
5. Exit 0 currently coexists with mandated pairs never judged (M9); "no flag stands" is true and "clean" is a ruling away.

## Q3 — not wrong

Cold start (import 0.1 s, Lexicon 0.6 s; timing.txt). The replay memo (sound, 11–14 hits per resume, byte-identical; M2). Transport: undici, NAT reset, 502, 429 — all closed with measured falsifiers; round 10 had zero -1/-32001 (M-168). Exit 3 and exit 4 are honest stops, not stalls. Round 9's 151 minutes was eight 600 s timeouts on a cold path, not an intrinsic cost — round 10 ran 22 min. "The mandate is unwritable in general" is refuted by M1 and M-173.

## Recommendations

1. **Merge → deploy → dispatch round 11 on HEAD before any further connector change.** Changes nothing; every open question above is unmeasured until this runs (M4, M5, M7). Cost: one dispatch, ≤$2 of credit at the current caps. Measure: `loop_ladder`, `stopped_detail`, exit codes per turn.
2. **Make render.yaml's spend pins say what the ruling says, and pin them in `mcp/test.mjs`** the way `CHAT_TOOL_TIMEOUT_MS` is (M6). Cost: at $2.50/turn one turn can overshoot the $2 day, as chat.js already discloses; so raise or rule `CHAT_DAILY_USD` in the same commit. Measure: round 11's `stopped` reads MAX_STEPS, never MAX_TURN_COST.
3. **Lift `_field_one`'s cache to module level, keyed on its existing declared key plus the lexicon declaration** — the `_WVP_MEMO` argument one layer down (M3). Cost: memory for thousands-of-word fields (bound it LRU), and M-170's caveat stands: the key must be proven complete over the declaration before a hit can be trusted; a wrong hit is a wrong verdict. Measure: repeat my 3→5 experiment, target <20 s; stdout byte-identical cold vs warm (test_replay_memo's oracle).
4. **Gate the MODAL_RHYME pair scan so a satisfied pair does not build two lexicon-wide fields** (M-170 item 1; 60 `modal_head` calls on a draft with nothing open, M3). Cost: answer-preserving only at `field_depth=None`; refuse otherwise. Measure: `modal_head` ncalls and cumtime in the profile.
5. **Give the weak writer the field before it writes** — at minimum ship M-162's held nudge; better, let `lyric_plan`'s response carry each bound position's offered/forbidden words, offered-not-required exactly as the brief already does (M-200's own rule). Cost: response bytes per hop; a doctrine-7 argument the owner must rule on. Measure: `banned_pairs` on the first grade and open lines on the first revise (round 10: 20/23).
6. **Rule #21.** Either the stamp says "exit 0 — 3 mandated pairs unjudged" in its own clause, or a refusal on a writer-chosen slot holds the song below 0 (M9). Cost of (b): songs like 7009 stop banking. Measure: `PAIRS: refused` on banked songs.
7. **Re-derive `DEFAULT_TOOL_BUDGET_MS` from the warm slope after 3 and 4**, and record per-tool wall-clock in `tools[]` so harness and model time are finally separable (M-170 unknown). Cost: one field. Measure: round 11's per-call ms.
