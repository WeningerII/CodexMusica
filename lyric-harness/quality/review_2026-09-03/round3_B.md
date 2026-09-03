# Round 3 — Reviewer B

## 1. FINAL JOINT STATEMENT (execution order; I sign as written)

1. **Reconcile the spend pins.** `render.yaml` pins `CHAT_MAX_TURN_USD '0.1'`, `CHAT_DAILY_USD '2'`, `CHAT_MAX_TURNS_PER_DAY '400'` (also at deployed e40786d6); the owner ruled $2.50 / $25 / derived (BACKLOG.md:1775, OWNER); env wins (gemini_agent.js:91); no `mcp/test.mjs` pin. Set the three to the ruling and pin them beside `CHAT_TOOL_TIMEOUT_MS`. Matters: round 10's turns 0 and 4 stopped `MAX_TURN_COST` at 8 and 4 calls (job 99137676797). Cost: exposure up to $2.50 a turn. Success: no MAX_TURN_COST under 14 hops in round 11. **CONSENSUS on the change; CONTESTED on sequence** — A dispatches round 11 first ("before anything below is built"); B and C ship this in the deploy round 11 runs against, since a round under $0.10 re-measures a wall measured twice.

2. **Make the record answer the next question, same deploy.** `tools[]` carries `path: warm|cold`, the replay-memo tally, per-tool wall ms, the stale-replay count, redacted args (seed, plan line count, screened words); a spawn failure is a logged row. Matters: ten rounds ran cold unnoticed (M-187); harness/model split unmeasured (M-170); round 9's shape inferred (M-166). Cost: ~50 connector lines. Success: rows read `warm`, fold ms, shape as numbers. **CONSENSUS on path, tally, spawn row; CONTESTED on per-tool ms and args — absent from A's round-2 statement (A asked for args in round 1, rec 5).**

3. **Merge → deploy → dispatch round 11**: `--songs=1 --turns=9`, one short brief. Cost: a few dollars. Success: an exit-0 `loop_ladder` row; else per-turn stop reason, open lines, `answers_on_record`, path, ms. **CONSENSUS. Pace CONTESTED: A `--pace=15` (one 4/min IP slot, chat.js:394); B and C `--pace=0`** — round 10 ran `--pace=5` and its terminal 429 carried chat.js:601's Gemini message, not the IP limiter's (:394/:402). Harmless either way.

4. **Put M-162's sweep/screen reminder to the owner; ship if granted** (chat-only). Matters: 2/2 skips; the five songs screened first and needed 0–5 folds. Success: `lyric_screen` before the first `lyric_plan`; `banned_pairs` on the first grade. **CONSENSUS.**

5. **Bind draft to state** (after round 11): refuse at exit 2, naming both fingerprints, a resume whose `draft` digest differs from the one the state opened on. Matters: M-200's ledger gate is inert on chat — the draft is written under `withTempDir`, which `rm`s the directory (lyric_tools.js:711–718), and the ledger lives beside the draft (brief_provenance.py:197, 212). Cost: breaks mid-run hand edits, already forbidden. Success: zero stale counts in item 2's field. **CONSENSUS** (my round-2 "measure stale first" is met by item 2).

6. **Process-level memo on `_field_one`** (after round 11), keyed on its existing key plus `lex.declaration()` and the full `Declaration`, LRU-bounded, byte-identical across the five banked replays. Matters: a real warm fold is 69.2 / 70.2 / 72.3 s in three replications; ~22 pools rebuilt per `Reviser` (revise.py:3776–3840). Cost: memory; the key-completeness proof precedes shipping. Success: the 3→5-answer fold under 20 s, `cmp` clean. **CONSENSUS.** My round-2 gating condition is withdrawn: round 10 turn 0 spent 502 s on 8 tool calls, so harness time already dominates.

7. **Rule BACKLOG #21; give M-205 a ledger entry** (`grep '^### M-205'` empty). **#21 CONSENSUS. M-205 CONTESTED by omission: C raised it in round 1, absent from C's round-2 list.**

8. **Holds** (CONSENSUS): no timeout moves; no re-derivation of the 600 s budget (my round-2 item withdrawn — A's D3 stands: lowering it re-arms round 8's kill on the untimed flagged-23-line warm regime); no planner-density change; no cross-request `Reviser`; no MODAL_RHYME shortcut (M-172, 6.9%). Also withdrawn, not in the statement: my "offered field at plan time" — a field needs call words (`_field(self, calls)`, revise.py:3678); A and C are right.

## 2. Disputes still open, and what settles each

- **1 before 3 (A vs B/C).** Settled by the owner confirming BACKLOG.md:1775 is current, or by a round-11 `stopped_detail` showing MAX_TURN_COST under 14 hops — at the price of a round.
- **Pace 15 vs 0.** Round 11's retry rows carrying the 429 body (Gemini vs IP limiter).
- **Dashboard override of render.yaml.** `/chat/status` reports `ceilings.turnUsd`; unreachable from this container (proxy 403). One GET from a runner.
- **"The 2–3-hour regime is probably gone" (C).** Unsigned by A and B until a round on HEAD shows `path: warm` and fold ms.
- **Per-tool ms and args in `tools[]`.** A has only omitted them; a sentence from A settles it.

## 3. Claims I now believe factually wrong

- **A-D4** "C's ~11 min of sleep (5 × 130 s) is real" and **C §3** "the 130 s pace (~11 of round 10's 22.5 min)": run 33266613606 was dispatched `--pace=5` (job 99137676797 step header). Sleeps were 5 × 5 s plus 4 × `max(5 s, 60 s)` (flash_battery.mjs:261, 341) = 265 s; the six turns summed to 1033.7 s.
- **A-D4** charging round 10's 429s to the IP limiter: turn 5's `error` is chat.js:601's Gemini-429 text; the limiter's messages (:394, :402) appear in no row.
- **A §5** "whether $2.50 or $0.10 is the ruling is the owner's word, not a code comment's": BACKLOG.md:1775–1776 (RULINGS TAKEN UNDER DELEGATION, OWNER) records $2.50 and $2→$25. The ruling is on record; render.yaml drifts from it.
- **A-M2** "~0.7 s per replayed grading call" as *the* slope: seed 7009 cold, 11 calls 153.7 s vs 14 calls 195.6 s (~14 s per call); warm, 14 new calls ~70 s (~5 s). Shape-dependent (M-172); 0.7 s is the low end.
