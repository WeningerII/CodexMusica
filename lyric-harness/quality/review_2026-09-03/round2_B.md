# Round 2 — Reviewer B

## 1. Disputes

**D1 — A's M2/I2/Q1.3: "warm, the constant vanishes"; "F × ~5 s warm"; "15–45× more expensive cold than warm".** The 2.9–4.3 s rows are *identical* re-calls (timing.txt; M-187's table: "on an identical call"). A real resume — state with 3 answers, then the same run with 5, one warm process — cost **70.2 s** (`REPLAY MEMO: warm — 11 of 25`; my run on `at_preloop.txt`, seed 7009). Cold for the same shape: 153.7–195.6 s. A real fold is ~2–3× cheaper warm, not 15–45×, and the constant does not vanish: `_field_cache` is per-`Reviser` instance (revise.py:3776–3840) and every worker request builds a fresh one (worker.py:108). A's own M2 quotes M-170's "cold Reviser rebuilt per call" and then draws the opposite conclusion.

**D2 — A's M5: "$2.50 turn cap … present" in e40786d6.** The JS *default* is (gemini_agent.js:91), but `render.yaml` at that commit pins `CHAT_MAX_TURN_USD: '0.1'` (line 145 of `git show e40786d6:render.yaml`); env wins. It is live: round 10's job log (99137676797) shows `stopped: MAX_TURN_COST` on turn 0 after 8 calls (history 235 KB) and turn 4 after 4 calls (395 KB). A's other present/absent claims I verified and accept.

**D3 — C: "~11 of round 10's 22.5 min was the client sleeping."** The dispatch ran `--pace=5`, not 130 (job log). Turn wall sums to 1033.7 s; sleeps were 5 × 5 s plus 4 retries × `max(5 s, 60 s)` = 265 s (flash_battery.mjs:261, 341). `--pace=0` is still right; it buys seconds.

**D4 — A's Q3: "the MODAL_RHYME scan is 6.9%, not 69% (M-172)."** Half right, and it moves me (C4). M-172 stubbed the scan on a *flagged* 22-line fold: 2.8 of 40.5 s, because `brief()` rebuilds the same 22 fields for the menus. On a *clean* draft no menus are built, so the profile's 22 `candidates()` builds (59.8 of 118 s profiled) are the scan's alone — M-172 itself: "the regime changes WHO PAYS, not how much." The scan is not the lever; the field builds are.

**D5 — A's rec 3 (refuse on draft mismatch) before round 11.** The loop already counts stale replays at the stop (M-183); `verdictOf` does not extract it. Measure first; a refusal costs a hop against a $0.10 cap and a writer that already abandons songs under pushback (M-168).

**D6 — C's inferred warm fold "20–60 s".** Measured 70.2 s at 18 lines; round 10's shape was 23. Bound too low, direction right.

## 2. Concessions

**C1 (A, rec 2).** Nothing records whether the box answers warm; my I1 assumed it. `path: warm|cold` and the memo tally go into `tools[]` before round 11; a failed spawn must log a row.

**C2 (A M4; C).** Round 10's ladder was largely the harness's: turn 2's push returned `ROUND_LIMIT after 8 round(s)` with the *identical* 20 lines open (M-183's complete-state replay, visible in the row); seed 88291's five-of-five-slot line (M-171). The planner half is measured; the writer half stays unknown.

**C3 (C).** `grep '^### M-205' MISSING.md` is empty. `--pace=0`, `--songs=1 --turns=9` adopted.

**C4 (A).** My rec 4 (gate the MODAL_RHYME scan) is withdrawn; a cross-process field memo makes it moot.

**C5 (A, rec 6, in part).** No harness-CPU work before round 11; the field memo stays as the next item, contingent on per-tool ms.

## 3. Current answers

**Q1.** The loop converges when briefs are answered (five songs, 0–5 answers). Wrong: (a) the bar's measurement has never been taken on the current tree — ten rounds ran a cold worker, an unwritable planner, an un-re-asking loop; (b) the deployed turn cap is $0.10 against a $2.50 ruling in code, and it ended two of round 10's six turns; (c) a real fold costs ~70 s warm / ~150–200 s cold because the candidate field, a pure function of (word, declaration), is rebuilt per call; (d) the writer never screens (M-162 open); (e) exit 0 coexists with unjudged mandated pairs (#21).

**Q2.** §4.

**Q3.** Cold start; the replay memo; transport and clocks (round 10: zero -1, zero -32001); exit 3/4 as honest stops; the 151-minute round (cold path × eight 600 s timeouts); "mandates are unwritable in general" (M1, M-173); the MODAL_RHYME scan as a headline saving (M-172).

## 4. JOINT STATEMENT (I would sign as written)

*What is wrong.* Zero exit-0 songs in ten chat rounds, every round against a system that no longer exists: images without `worker.py` (M-187), a planner drawing unwritable groups (M-171/M-206), a loop that never re-asked and replayed complete states (M-183), tier 2 unreachable (M-204/205/209). Nine commits of closures are undeployed. The deployed per-turn wall is a $0.10 cap pinned in render.yaml against a $2.50 ruling in code, unpinned by any test. The harness converges when a writer answers; a real fold costs ~70 s warm, ~150–200 s cold, and no battery row can say which the box paid.

*In order.*
1. **One connector PR before dispatch:** `tools[]` carries `path: warm|cold`, the memo tally, per-tool wall ms, redacted args (seed, plan line count, screen words); a failed spawn logs a row. render.yaml's spend pins set to the ruling and pinned in `mcp/test.mjs`; the owner rules `CHAT_DAILY_USD` in the same commit. Cost: ~50 lines; exposure up to the ruled cap per turn. Breaks nothing.
2. **Merge → deploy → round 11:** `--songs=1 --turns=9 --pace=0`, one short brief. Cost: one dispatch, a few dollars. Success: an exit-0 row in `loop_ladder`; failing that, a ladder that names the wall (open lines, stop reason, path, ms per tool, cap hit).
3. **Rule and ship M-162's reminder** (chat-only). Success: `lyric_screen` before the first `lyric_plan`; `banned_pairs` on the first grade below round 10's drift.
4. **Rule #21**; give **M-205** a ledger entry. Cost: a paragraph; option (b) stops songs like seed 7009 banking.
5. **Only if round 11's per-tool ms show harness time dominating:** a process-level `_field_one` memo on its declared key plus the lexicon declaration, LRU-bounded, byte-identical on the five banked replays; then re-derive `DEFAULT_TOOL_BUDGET_MS` from the warm slope. Cost: memory; a key-completeness proof (M-170). Success: the 3→5-answer resume under 20 s, stdout unchanged.
6. **Do not** raise timeouts, touch planner density, or hold a `Reviser` across requests before that measurement.

## 5. Not yet signable

- **A's refuse-on-draft-mismatch.** Sign after a round shows `stale > 0` in `tools[]`, or a transcript where flash-lite alters `draft` between calls.
- **My rec 5 (offered field at plan time).** Needs an owner ruling on doctrine 7. Moved by round 11: converging without it drops it; parking at 20/23 with screening done raises it.
- **C's "the 2–3-hour regime is probably gone".** Contingent on the box answering warm. Moved by `path: warm` and fold ms in round 11.
- **A's I4 (429s as token-per-minute).** Moved by per-hop timestamps in the row.
