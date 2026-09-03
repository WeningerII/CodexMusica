# Round 2, reviewer C

## 1. Disputes

**A-Q3, "the MODAL_RHYME scan is 6.9%, not 69%".** Right about the shortcut (I concede below); misleading if read as "fields are cheap". M-172 itself says the candidate-field share is 56% in both regimes and the scan only changes *who pays* (`brief()`'s menus vs the ban). The pools are the money; the scan is not the lever.

**A-rec 6, "hold all harness-CPU work until round 11".** A's M2 says "warm, the constant vanishes". True of an *identical* call (3.8 s in my replication), false of a fold: one real fold in one warm process cost B 70.2 s and me 72.3 s (`r2/out.txt`: `REPLAY MEMO: warm — 11 of 25 grading call(s)`, 14 new calls at ~5 s). The memo keys `brief`/`inspect` on the exact line tuple (`replay_memo.py`, `MemoReviser.brief`), so a moved draft misses by construction, and the ~22 pools are rebuilt per Reviser (`revise.py:3810` clears the instance cache). Forty folds × 70 s ≈ 47 min is inside every clock, so a hold *for round 11* is defensible — but the `_field_one` memo is the one CPU item with measured evidence and belongs queued behind the round, not held.

**B-rec 5 (strong form), "lyric_plan carries offered/forbidden words per bound position".** Not constructible: a field is generated from a POSITIVE call word (`revise.py:4194` docstring), and a plan has no words at any position until a line exists. The weak form — M-162's reminder — is constructible and I sign it.

**A-M2's slope "~0.7 s per replayed grading call".** `timing.txt` gives (195.6−49.3)/12 ≈ 12 s per call cold at seed 7009 (18 lines, 13 `schema:` relations); my replication gives ~5 s per *new* call warm; M-172 says counts do not carry across drafts. A's figure is the low end of a shape-dependent range, not the slope.

**A-I3 / A-rec 3 — a strengthening A did not state.** The connector runs each call in a temp dir that is `rm`'d (`lyric_tools.js:711-718`); the brief-provenance ledger is written beside the draft path (`brief_provenance.py:200-231`; `lyric_harness.py:10754`). So M-200's gate is **inert on the chat path** — `admit` always sees "no ledger → first draft". A's fingerprint-in-state refusal is the only form of that gate the chat surface can have.

## 2. Concessions

- **My claim 3 (MODAL_RHYME shortcut) is withdrawn.** M-172 stubbed it: 2.8 s of a 40.5 s fold, 6.9% bare. The profile's `modal_head` attribution is a first-payer artefact of `_field_cache`; I read cumulative time as cost.
- **B-M6 is correct and I missed it.** `render.yaml` pins `CHAT_MAX_TURN_USD '0.1'`, `CHAT_DAILY_USD '2'`, `CHAT_MAX_TURNS_PER_DAY '400'` at HEAD and at deployed `e40786d6` (verified via `git show`); `chat.js`/`gemini_agent.js` read env first; `mcp/test.mjs` pins only `CHAT_TOOL_TIMEOUT_MS` (1504-1573). The deployed turn cap is $0.10 while BACKLOG records the owner setting $2.50/$25. At ~$0.025 a late hop (M-168) that is ~4 folds a turn — a live wall my "batch the folds" arithmetic assumed away.
- **A-M7 / B-M5: every battery round ran cold.** I listed the missing `worker.py` as "fixed" without the consequence: the slope that derived the 600 s budget (`budget.js:15-28`) is a cold-process slope; the warm path has never been measured in production.
- **B-M2 replicated:** one real fold warm = 72.3 s. My inferred "20–60 s" is replaced by that measurement.
- **A-M5 verified in the deployed tree:** `schema_screen`, `placement_bindable`, M-205's `_group_declared` absent; `_line_key`, `WORDS_LEFT_FREE`, `RATE_LIMIT_RETRY`, the worker COPY present.

## 3. Current answers

**Q1.** (a) The bar's measurement has never been taken on the current tree: ten rounds measured an unwritable planner, a loop that never re-asked, a cold worker, two clocks and a $0.10 turn cap. (b) The deployed spend pins contradict the owner's ruling and are unpinned. (c) M-200's gate does not operate through the connector; nothing binds draft to state. (d) The per-fold floor is ~70 s warm / 150–200 s cold at 18 lines because pools — pure functions of (word, declaration) — are rebuilt per Reviser. (e) The writer skips screen 2/2 (M-162). (f) Exit 0 coexists with unjudged mandated pairs (#21).

**Q2.** The joint statement below.

**Q3.** Cold start (0.7 s); the deferred-replay design and its memo; the MODAL_RHYME scan (6.9%); transport and clocks (round 10: zero −1/−32001); exits 3/4 as honest stops; the 2 GB instance; five `Lexicon` builds (3.6%). The 130 s pace (~11 of round 10's 22.5 min) is wasteful, not wrong — a dispatch default.

## 4. Joint statement I would sign

1. **Make `render.yaml`'s spend pins say what the owner ruled ($2.50 turn, $25 day, derived turns/day) and pin all three in `mcp/test.mjs` like `CHAT_TOOL_TIMEOUT_MS`.** Cost: one commit; the day moves with the turn so one turn cannot overshoot it. Breaks nothing. Success: round 11's `stopped` never reads MAX_TURN_COST.
2. **Merge → deploy → dispatch round 11: one short brief, nine turns, `--pace=0`.** Cost: ≤$2 of credit. Breaks nothing. Success: an exit-0 row in `loop_ladder`, or per-turn stop reason and open-line count; `answers_on_record`; wall minutes.
3. **In the same deploy, make the record answer the next question:** `tools[]` carries per-call ms, `path: warm|cold`, the REPLAY MEMO tally, redacted arguments (seed, plan line count, screened words); a worker spawn failure is a logged degradation, not silence. Cost: ~40 connector lines. Success: rows show `warm`, fold ms, the drawn shape as numbers.
4. **Bind draft to state:** fingerprint at first call; a later call with a different draft is refused (exit 2) naming both. Cost: a refusal the model must handle; breaks mid-run hand edits, which M-200 already forbids. Success: zero `stale` counts, `warm` on every resume.
5. **Put M-162's reminder to the owner; ship if granted.** Cost: one systemInstruction sentence, chat-only. Success: `lyric_screen` before the first `lyric_plan`; `banned_pairs` on the first grade.
6. **After round 11 reports, lift `_field_one`'s cache to module level on its existing key (`revise.py:3775`), LRU-bounded, proven byte-identical by the M-155/M-167 oracle.** Cost: memory; a key-completeness proof. Success: the 3→5 warm fold from 72 s to <20 s; `cmp` clean.
7. **Rule #21.** Success: `PAIRS refused` = 0 on banked exit-0 songs, or a documented clause/code.
8. Hold every other CPU item (cross-request Reviser, timeout re-derivation) until 2 and 6 have numbers.

## 5. What I cannot yet sign, and what would move me

- **That flash-lite converges on the gated planner.** Only round 11 speaks. Open lines *falling* per turn → "slow, not stuck"; the round-10 shape again on HEAD → "the writer is the wall", and B-rec 5's question (a field before writing) becomes necessary in some form.
- **A's "warm removes the constant".** I sign "removes the *replayed* constant" only; a warm fold is ~70 s until item 6. A sub-20 s warm fold without item 6 would move me.
- **Whether the Render dashboard overrides `render.yaml`'s env.** One `/chat/status` request against the deployed box (it reports `turnUsd`) settles it.
- **Item 6's saving.** Inferred from 22 pools × ~1 s bare ≈ half a fold; M-172's lesson is that profile-derived savings halve when stubbed. I sign the number only after the stub is timed.
