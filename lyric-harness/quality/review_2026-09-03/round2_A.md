# Round 2, reviewer A

## 1. Disputes

**D1 (C, Q3: the missing `worker.py` is "not wrong — fixed").** The file is fixed; the mechanism that hid it for three days is live. `runVerb` (`mcp/lyric_tools.js:306-319`) turns every non-timeout rejection — spawn failure included — into `_runVerbCold(args)` with byte-identical output, and nothing in `verdictOf` or `tools[]` says which path answered. A fallback whose only trace is a 50 s slowdown is what the owner's bar names. I hold.

**D2 (B, rec 5 second half: let `lyric_plan` carry offered/forbidden words per bound position).** Not constructible: a field is a function of CALL WORDS — `_field(self, calls)` (`revise.py:3678`), `_rank_field` (`revise.py:3903`) — and a plan has positions and no words, so before a member is written there is no field. Pre-word there is only `screen`, the M-213 ANCHOR block and the legend. B-5's first half (M-162's nudge) stands; its second asks for a field with no argument.

**D3 (B, rec 7: re-derive `DEFAULT_TOOL_BUDGET_MS` from the warm slope).** A ceiling that a 69 s fold never touches costs nothing; lowering it re-arms the kill on the one regime nobody has timed — a heavily flagged 23-line draft under the worker (M-170 §5, still open; C lists it UNKNOWN). Round 8's eight kills (M-165) were a budget derived from the wrong regime. Not before round 11.

**D4 (C, rec 1: `--pace=0`).** Partly. `chat.js:87` allows an IP 4 requests a minute; five quick turns (exit-2 rows, text-only replies) earn a 429 and the driver then sleeps `max(PACE_MS, 60_000)` (`flash_battery.mjs:261`), longer than the pace it saved. The derived value is one IP slot, 15 s. C's ~11 min of sleep (5 x 130 s) is real; I had charged it to the pipeline.

**D5 (C, "per-fold warm cost 20-60 s").** Measured 69.2 s (below); the point survives, the range does not.

## 2. Concessions

**C1. My "F x ~5 s warm" was wrong.** `timing.txt`'s 2.9-4.3 s rows are identical re-calls. I reproduced B's experiment through `mcp/worker.py` on the seed-7009 replay: 3-answer state → exit 4 in **149.7 s** (memo cold, 0/11); 5-answer state, same process → exit 0 in **69.2 s** (memo warm, 11/25 — the replayed prefix free, the new fold paid); identical re-call → **2.9 s** (25/39). The warm per-fold floor is ~70 s at 18 lines: the candidate-field rebuild in a fresh `Reviser` per request (`worker.py:run_one` runs `cli()` whole; `_field_cache` is per instance, cleared at 65, `revise.py:3773-3810`). My rec 6 ("hold all harness-CPU work") is withdrawn for ONE item, the module-level `_field_one` memo — the one change with a bounded soundness argument aimed at the measured floor. Condition: the current key (`revise.py:3773-3775`) omits the lexicon and the rest of the `Declaration` because both are constant per instance; a process-level key must add `lex.declaration()` and the full `Declaration`, as `_WVP_MEMO` does (M-155).

**C2. B's M6 is correct and I missed it.** `render.yaml:108-109, 139-140, 144-145` pin `CHAT_DAILY_USD '2'`, `CHAT_MAX_TURNS_PER_DAY '400'`, `CHAT_MAX_TURN_USD '0.1'` at HEAD and at deployed `e40786d6`; `gemini_agent.js:91` reads the env first; `mcp/test.mjs` has no pin on any of the three (grep empty; `CHAT_TOOL_TIMEOUT_MS` has three). The deployed cap is $0.10; a late hop is ~$0.0125-0.025 (M-197, M-168), so 4-8 hops a turn under `maxSteps 14`; round 10 turn 0 ended MAX_TURN_COST after 8 calls. A live wall and a doctrine-1 drift.

**C3.** Their four-condition frame beats my three-factor one; adopted.

## 3. Current answers

**Q1.** (a) The measurement the bar demands has never been taken on the current tree; every round measured unwritable plans, a loop that never re-asked, a cold path and two clocks (my M4, M5; B M7; C). (b) The deployed turn cap is $0.10 by pin against a $2.50 ruling in code, unpinned (C2). (c) The per-fold floor is ~70 s warm / ~150 s cold because a pure function of (word, declaration) is rebuilt per request (C1). (d) The warm→cold fallback is silent (D1). (e) The writer skips screen 2/2 and meets the legal field only after a flag (M-162; B I2). (f) Exit 0 coexists with unjudged mandated pairs (#21).

**Q2.** The joint statement below.

**Q3.** Cold start (0.8%); the replay memo (sound, small); the MODAL_RHYME scan (6.9% bare, M-172); transport and kills; exit 3/4 as honest stops; harness compute per banked song (minutes).

## 4. JOINT STATEMENT (I would sign as written)

The pipeline reaches exit 0 when a strong writer screens words and answers briefs — five songs, 0-5 folds, minutes of harness time. It has never done so through the chat path in ten rounds, none of which ran the code that closes the walls they hit. In order:

1. **Merge, deploy, dispatch round 11**: one song, nine turns, `--pace=15`. Cost: one round of credit at the current caps; changes no code. Success: an exit-0 `loop_ladder` row; otherwise the per-turn stop reason and open-line count, which M-169 made harvestable. This runs before anything below is built.
2. **Reconcile the spend pins**: make `render.yaml`'s three `CHAT_*` values state the owner's ruling and pin them in `mcp/test.mjs` beside `CHAT_TOOL_TIMEOUT_MS`. Cost: at $2.50/turn one turn can overshoot a $2 day (chat.js discloses it), so `CHAT_DAILY_USD` moves in the same commit. Success: round 11's `stopped` never reads MAX_TURN_COST on a legal turn.
3. **Make the verb path visible**: `path: warm|cold` and the memo tally on every lyric verdict, published in `tools[]`; a spawn failure becomes a logged row, not a silent slow answer. Cost: ~40 connector lines. Success: rows read `warm`, and a cold row is a finding.
4. **Process-level memo on `_field_one`**, keyed on its existing key plus `lex.declaration()` and the full `Declaration`, LRU-bounded, proven byte-identical cold-vs-warm across the five banked replays (the M-155 `cmp` method). Cost: memory; a key-completeness proof, which precedes the ship because a wrong hit is a wrong verdict. Success: the 3→5 fold experiment falls from 69 s toward <20 s with identical stdout.
5. **Bind the draft to the state**: refuse a resume whose `draft` digest differs from the one the state was opened on (exit 2, both fingerprints named). Cost: breaks mid-run hand edits, which M-200's gate already forbids. Success: zero `stale` counts and memo `warm` on every resume.
6. **Rule M-162 and ship the sweep/screen reminder** (chat-only). Success: `lyric_screen` before the first `lyric_plan`; `banned_pairs` on the first grade.
7. **Rule BACKLOG #21**, and give M-205 a ledger entry (MANIFEST cites it; `grep '^### M-205' MISSING.md` is empty).

Not before round 11: moving any timeout, re-deriving the 600 s budget, touching planner density, holding a `Reviser` across requests (M-170 item 2).

## 5. What I cannot yet sign, and what would move me

- **The MODAL_RHYME shortcut (B-4, C-3).** M-172: 2.8 s of 40 s bare, the profiler doubling the apparent prize, and the fields are rebuilt for `brief()`'s menus anyway. Verdict-touching logic for ~7%. A bare profile of a heavily flagged draft with the scan above ~15% would move me.
- **The direction of the spend-pin fix.** The drift is certain; whether $2.50 or $0.10 is the ruling is the owner's word, not a code comment's.
- **"The 2-3 hour regime is probably gone" (C).** Unsigned until round 11 runs on HEAD.
- **B-I2's "40-answer song ≈ 47 min"** presumes 40 folds; the banked songs needed ≤5 and round 10's open lines were mostly the planner's (M-171, M-183). Round 11's `answers_on_record` moves me.
