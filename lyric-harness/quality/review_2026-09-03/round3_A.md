# Round 3, reviewer A — final joint statement

## 1. FINAL JOINT STATEMENT (execution order; I sign as written)

**What is wrong.** Zero exit-0 songs in ten chat rounds, all against a system that no longer exists (no `worker.py`, M-187; unwritable plans, M-171/M-206; a loop that never re-asked, M-183; tier 2 unreachable, M-204/205/209); nine closing commits undeployed. The deployed turn cap is $0.10 (`render.yaml:145`) against the recorded $2.50/$25 ruling (BACKLOG.md:1775), unpinned by any test. A real fold costs ~70 s warm (70.2 / 72.3 / 69.2 s, three replications) and ~150-200 s cold because fields are rebuilt per `Reviser` (`revise.py:3773-3810`); no battery row says which the box paid. The harness converges when a writer answers (five songs, 0-5 folds).

1. **One connector PR before dispatch.** (a) `render.yaml` spend pins set to the recorded ruling — $2.50 turn, $25 day, turns/day derived — and all three pinned in `mcp/test.mjs` beside `CHAT_TOOL_TIMEOUT_MS`. (b) `tools[]` carries `path: warm|cold`, the REPLAY MEMO tally, per-call ms, the loop's stale-replay count (M-183), and redacted args (seed, plan line count, screened words); a worker spawn failure logs a row, not a byte-identical cold answer. Evidence: B-M6; round 10's two MAX_TURN_COST turns; `lyric_tools.js:306-319`; M-187. Cost: ~50 lines; up to $2.50 a turn. Success: every round-11 row names path and ms; no legal turn stops MAX_TURN_COST. **CONSENSUS** (A moved visibility ahead of dispatch).
2. **Merge → deploy → dispatch round 11**: one short brief, nine turns, `--pace=0`. Evidence: M-168 addendum. Cost: one dispatch, a few dollars. Success: an exit-0 `loop_ladder` row; else per-turn stop reason, open lines, `answers_on_record`, path, ms. **CONSENSUS** (A drops `--pace=15`; an IP 429 is a logged row).
3. **Rule M-162 and ship the sweep/screen reminder** (chat-only). Evidence: 2/2 skips; the five songs were screened first. Success: `lyric_screen` before the first `lyric_plan`; `banned_pairs` on the first grade. **CONSENSUS.**
4. **Rule BACKLOG #21; write M-205's ledger entry.** Cost: a paragraph; option (b) stops seed-7009-like songs banking. Success: `PAIRS refused` = 0 on banked songs or a documented clause; `grep '^### M-205'` non-empty. **CONSENSUS.**
5. **Bind draft to state**: fingerprint at first call; a later call whose `draft` differs is refused (exit 2, both fingerprints named). Evidence: M-200's gate is inert on chat — the ledger lands beside the draft path (`brief_provenance.py:200-231`, `lyric_harness.py:10754`) in a temp dir `rm`'d per call (`lyric_tools.js:711-718`). Cost: one refused hop; breaks mid-run hand edits, which M-200 forbids. Success: zero stale counts, `warm` on every resume. **CONTESTED** — A and C: in item 1; B: only after a round shows `stale > 0`, since `verify()` re-grades the current lines (a stale replay is never a wrong verdict) and a refused hop costs against a writer that abandons under pushback (M-168).
6. **Process-level `_field_one` memo**, after round 11 reports: keyed on its existing key plus `lex.declaration()` and the full `Declaration`, LRU-bounded, byte-identical on the five banked replays (M-155 `cmp` method). Evidence: the ~70 s warm fold; 22 pools rebuilt per request. Cost: memory; a key-completeness proof first — a wrong hit is a wrong verdict. Success: the 3→5 fold from ~70 s to <20 s, stdout byte-identical. **CONSENSUS on item and order; CONTESTED on trigger** — B: only if round 11's per-tool ms show harness time dominating; A, C: unconditional.
7. **Re-derive `DEFAULT_TOOL_BUDGET_MS` from the warm slope.** **CONTESTED** — B: after item 6; A and C: do not move it — the heavily flagged 23-line fold is untimed (M-170 §5), and round 8's eight kills were a budget derived from the wrong regime (M-165).
8. **Hold** all other CPU work (cross-request `Reviser`, M-170 item 2), planner density, and every other timeout until items 2 and 6 have numbers. **CONSENSUS.**

## 2. Disputes still open, and what settles each

- **Item 5 timing.** Round 11's stale count (item 1b): `stale > 0` in any row, or a `draft` changing between calls, puts the refusal in; nine turns of zero leaves it queued.
- **Item 6 trigger.** Per-tool ms in round 11: harness share above ~50% meets B's condition; below it A and C still queue the memo as the one CPU item with a measured floor.
- **Item 7.** One timed fold on a heavily flagged 23-line draft under the worker; under 200 s, B is right.
- **Render dashboard overriding `render.yaml`** (C). `/chat/status` reports `turnUsd`; unreachable here (proxy 403); the battery job can print it at startup.
- **Whether flash-lite converges on the gated planner.** Only round 11 speaks: open lines falling per turn means slow; the round-10 shape on HEAD means the writer is the wall.

## 3. Factual corrections to the round-2 papers

- **C, D3/Q3: "~11 of round 10's 22.5 min was the client sleeping."** Impossible from the pack: the turn wall is 1033.7 s (MISSING.md:17335); 5 × 130 s on top is ~28 min, above the recorded 22.5. B's job-log reading (`--pace=5`; 265 s, mostly four 60 s-floor retries, `flash_battery.mjs:261`) is the one consistent with the pack.
- **C, on my slope:** the seed-7009 baseline is `at_original` 58.0 s, not before_i_did's 49.3 s; (195.6−58.0)/12 ≈ 11.5 s per replayed call cold. Conclusion unchanged: my 0.7 s was M-170's seed-16 figure; the slope is shape-dependent.
- **B, D1: "worker.py:108".** `lyric_harness.cli()` is called at `worker.py:72`; line 108 is the `main()` entry. Citation off, substance right.
- **B, item 1: "the owner rules `CHAT_DAILY_USD` in the same commit."** Already ruled: BACKLOG.md:1775 records $2 → $25 on 2026-09-02.
- **My round 1:** "$2.50 turn cap present" and "F × ~5 s warm" were wrong; conceded in round 2.
