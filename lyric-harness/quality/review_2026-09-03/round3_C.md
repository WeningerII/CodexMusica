# Round 3, reviewer C — convergence

## 1. FINAL JOINT STATEMENT (I sign as written; execution order)

*What is wrong.* Zero exit-0 songs in ten chat rounds, all against a system that no longer exists (no `worker.py` in the image, M-187; unwritable plans, M-171/M-206; a loop that never re-asked, M-183; tier 2 unreachable, M-204/205/209); nine commits of closures undeployed. The deployed turn cap is $0.10 by `render.yaml` pin against a $2.50 ruling in code, unpinned by any test, and it ended two of round 10's six turns (job 99137676797: turns 0 and 4 `stopped: MAX_TURN_COST`). A real fold costs ~70 s warm (69.2 / 70.2 / 72.3 s, three independent replications) and 150–200 s cold because the candidate field, a pure function of (word, declaration), is rebuilt per Reviser; no battery row can say which the box paid.

1. **Reconcile the spend pins.** `render.yaml`'s three `CHAT_*` values state the owner's ruling ($2.50 turn, $25 day, derived turns/day), pinned in `mcp/test.mjs` beside `CHAT_TOOL_TIMEOUT_MS` (the only pinned name, `test.mjs:1504-1573`). Cost: one commit. Success: round 11's `stopped` never reads MAX_TURN_COST on a legal turn. **CONTESTED on order only**: A dispatches first while conceding the cap is a live wall (A-C2); B and C ship before dispatch.
2. **Make the record answer the next question**, same PR: `tools[]` carries `path: warm|cold`, the memo tally, per-tool ms, redacted args (seed, plan line count, screened words), and the loop's stale-answer count (printed at the stop, `lyric_harness.py:6815`; `grep stale mcp/lyric_tools.js` is empty); a failed worker spawn logs a row instead of a byte-identical cold answer (`lyric_tools.js:306-319`). Cost: ~50 lines. Breaks nothing. Success: rows read `warm`, fold ms, the drawn shape as numbers. **CONSENSUS on substance; CONTESTED on order** (A after dispatch).
3. **Merge → deploy → round 11**: `--songs=1 --turns=9`, one short brief. Cost: one dispatch at the ruled caps. Success: an exit-0 `loop_ladder` row; failing that, a ladder naming the wall (open lines per turn, stop reason, path, ms, cap hit). **CONSENSUS**, except `--pace`: **CONTESTED** — A 15 s (one slot of the 4/min IP limiter, `chat.js:79`; a 429 costs a 60 s sleep, `flash_battery.mjs:261`), B 0, C moves to 15 on A's derivation.
4. **Put M-162's screen/sweep reminder to the owner; ship if granted** (chat-only). Success: `lyric_screen` before the first `lyric_plan`; `banned_pairs` on the first grade. **CONSENSUS.**
5. **Rule BACKLOG #21; give M-205 a ledger entry** (`grep '^### M-205' MISSING.md` empty; content only in commit 0252813e). Cost: a paragraph; #21(b) stops songs like seed 7009 banking. **CONSENSUS** (in my round 1; omitted from my round-2 list by oversight).
6. **Process-level memo on `_field_one`**, keyed on its existing key (`revise.py:3775`) plus `lex.declaration()` and the full `Declaration` (A-C1: both constant per instance today, hence absent from the key), LRU-bounded, byte-identical across the five banked replays (M-155 `cmp` method). Cost: memory; the key proof precedes the ship. Success: the 3→5 warm fold from ~70 s to <20 s, stdout unchanged. **CONTESTED on condition**: B builds it only if round 11's per-tool ms show harness time dominating; A and C build it after round 11 regardless.
7. **Bind the draft to the state** — refuse a resume whose `draft` digest differs (exit 2, both fingerprints named). Evidence: the connector `rm`s its temp dir per call (`lyric_tools.js:711-718`), so M-200's ledger gate is inert on the chat path. Cost: one refused hop; breaks mid-run hand edits M-200 already forbids. Success: zero `stale` in `tools[]`. **CONTESTED**: A ships now; B after a round shows `stale > 0`; C moves to B — item 2 gives the measurement free, and a refusal spends a hop against a writer that already abandons songs under pushback (M-168).
8. **Not before round 11**: any timeout, the 600 s budget, planner density, a `Reviser` held across requests (M-170 item 2). **CONSENSUS.**

Withdrawn by all three: the MODAL_RHYME shortcut (M-172: 6.9%); a field at plan time (no call words exist before a line does, `revise.py:4194`).

## 2. Open disputes and what settles them

- **Pins/record before or after dispatch (A vs B, C).** Judgement: a round on a $0.10 cap re-measures round 10's turn-0 wall. A round measuring "the deployed truth" is a legitimate alternative round; it is not the owner's bar.
- **`--pace` 0 vs 15.** Round 11's retry rows: a 429 after a sub-60 s turn at pace 0 proves A; none in nine turns proves B. Round 10's four retries came at pace 5 after an 80 s turn, which the IP limiter cannot explain — likely Gemini's; neither side may claim them.
- **Refusal now vs after evidence.** `stale` in round 11's rows.
- **Memo conditional vs unconditional.** Per-tool ms: if a fold's harness share is under ~30% of turn time, B is right.
- **Warm box / dashboard override.** One `/chat/status` request (reports `turnUsd`); the `path` field.

## 3. Factual errors in the other round-2 papers

- **None material.** Verified: B-D3 (`--pace=5`; turn ms sum 1,033,738; turns 0 and 4 MAX_TURN_COST — job log); B-D5 (no stale extraction in `lyric_tools.js`); A-C1 (key omits lexicon and Declaration); A-C2/B-M6 (pins at HEAD and e40786d6).
- **Citation slip, A-D4:** the per-IP limiter is `chat.js:79` (hit at `:390`), not `:87`.
- **My own round-2 error:** "~11 min of round 10 was sleep" assumed the 130 s default; the dispatch ran `--pace=5`, sleeps ≈ 265 s. Withdrawn; B was right.
