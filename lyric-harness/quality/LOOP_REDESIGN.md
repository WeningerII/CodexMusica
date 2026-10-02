# The revise loop, redesigned for long songs

Status: **DESIGN v4 — PASSED the debate (round 2: both judges, `passes_with_changes`).**
Version 4 is version 3 (the owner's rulings of 2026-10-02, §6) plus the binding
round-2 amendments in §2.8. The build (Phase 3) works from this version. Written 2026-10-02 on branch `claude/revise-loop-redesign`.

The owner's words: *"the biggest problem is 100+ line songs"*, and *"a new
revise loop requires a debate workflow for verification, not song runs"*.

This file has six parts:

1. what was measured before anything was designed;
2. the design, version 4: version 2 (after the debate), the owner's rulings, and the binding round-2 amendments (§2.8);
3. what stays the same, and what would change in the connector's published contract;
4. what it costs, what must still be measured before building, and the tests that must fail on the old code and pass on the new;
5. the debate's record;
6. the questions for the owner, and the owner's answers.

Every figure here comes from a command run on this branch. The commands are in
`quality/loop_redesign_phase1/` (scratch measurement scripts kept so the
figures can be re-run; none of them produced or delivered a song).

---

## 1. What was measured (Phase 1)

### 1.1 The four known defects, reproduced

| # | Defect | Reproduced? | How |
|---|---|---|---|
| 1 | Answers are replayed from round one on every call, so time and state grow with each answer | **Yes** | §1.2 |
| 2 | A batch of answers comes back with no verdict on each answer | **Yes** | `revise` on a 4-line AABB draft, connector defaults; L2 and L4 asked as one batch; L2 answered with a miss, L4 with a word from its own OFFERED list. Only L2 got an outcome. The next question was a group question on L1+L2. The connector's `foldedOf`, fed the two states, renders L4 `unknown` / `unverified`. |
| 3 | A continuation gets killed (deadline or restart) and the run is lost | **Yes** | Real session layer (`buildWorkflowServer` + `WorkflowSessions` + real worker), 3-line pasted song, tool budget 10 s and 12 s. Killed answer call: `exit_code -1`; operation `completed`, `resumable: false`; `resume_operation` refuses `RESUME_NOT_INTERRUPTED`; re-sending the answer is refused ("`state` holds no pending question"); the no-answer continuation is killed again at the same budget. |
| 4 | Group questions are asked with no options to choose from | **Yes** | `revise` on a 2-line couplet, connector defaults. L2's line question offered `tov, hargrove, alcove, mangrove`; after a rejected answer, the L1+L2 group question printed `(none offered)` for the pivot and for L1. |

"Connector defaults" means `--attempts=1 --backtrack=1`, the values
`mcp/lyric_tools.js` passes for the interview writer.

### 1.2 Defect 1: where a continuation's time goes

A pasted 24-line song (12 couplets, AABB…, each second line breaking its
rhyme) was driven through deferred `revise` under connector defaults, one
cold process per call. A scratch driver answered each question
mechanically.

Wall time per call against answers on record:

| answers on record | 0 | 12 | 13 | 24 | 25 | 26 | 27 | 28 | 29 |
|---|---|---|---|---|---|---|---|---|---|
| seconds | 53.1 | 15.3 | 56.1 | 30.2 | 35.4 | 37.6 | 43.9 | 49.8 | 51.1 |

- The first call asks a 12-line batch.
- The 13-answer call opens round 2's batch.
- From 24 answers on, each call adds one group answer and costs about 4 s more than the one before.

**The split, measured on one state.** A state with 27 answers on record and
its next answer filled in was run twice:

- with its pending question cleared, it replays the 27 answers and re-asks the same question: **47.0 s**;
- the same continuation with the new answer: **49.8 s**.

So about 94% of that call was spent getting back to a question the writer had
already been asked.

Why replay is expensive (code, confirmed by a `py-spy` profile):

- each replayed answer runs `loop._materialize` → `Reviser.brief(target_lines=…)`, which rebuilds that line's offer menu by grading every candidate word (`Reviser.declared_offer` → `Reviser.grade`);
- then it runs `Reviser.verify`, which is two whole-draft `inspect`s.

The replay memo (`quality/replay_memo.py`, M-167) only helps inside one warm
process. It keeps 4 runs and clears itself entirely past that. A kill restarts
the worker, which empties it.

### 1.3 Long drafts

The fixture drafts were built exactly as `mcp/test.mjs`'s live block builds
them: `plan --seed=1 --lines=N`, the fixture line bank, the declared returns
honoured.

They are a worst case: every line is a near-copy, so nearly every line is
open.

One whole-draft grade (`song`, cold), alone on the box except where noted:

| lines | time | report bytes |
|---|---|---|
| 24 | 97.8 s | 517,529 |
| 60 | 324.8 s | 1,627,839 |
| 104 | **1,307.3 s** | 4,032,610 (just under the connector's 4 MiB `MAX_OUTPUT_BYTES`) |

**The first deferred `finish` call on the 24-line fixture ran at least 31 min
42 s and never asked its first question.** Its last checkpoint was round 1,
`grading`. By the profile, it was inside the batch door (`prefetch`), building
an exact offer menu for every independent open line. My session's time limit
stopped it. It was not run at 60 or 104 lines.

**Replay curves at three lengths.** These use pasted songs that declare one
relation (`class:RHYME`), under connector defaults, one cold process per call.

**CORRECTED IN THE DEBATE (C4).** The 24-line song is 12 real couplets
(AABB…L). The 60- and 104-line songs are not: their schemes ran past `Z` into
lowercase letters, which the mandate case-folds. So L1 is grouped with L2, L53
and L54, and those two curves measure **4-member groups**, not couplets.
~~These use pasted couplet songs~~. The growth they show stands. What they
measure is 4-member groups. Genuine couplet fixtures at 60 and 104 lines are
on the pre-build list (§4.3).

| lines | seconds per call (answers on record) |
|---|---|
| 24 | 53.1 (0) · 15.3 (12) · 56.1 (13) · 30.2 (24) · 35.4 (25) · 37.6 (26) · 43.9 (27) · 49.8 (28) · 51.1 (29) · 57.7 (30) · 65.2 (31) · 68.9 (32) |
| 60 | 50.0 (0) · 49.0 (1) · 95.9 (2) · 97.7 (3) · 171.8 (4) · 173.0 (5) |
| 104 | 88.6 (0) · 82.7 (1) · 210.0 (2) · 220.6 (3) · 407.0 (4) · 373.9 (5) |

Each group answer on the 60-line song adds about 70 s to every later call.
The one recorded on the 104-line song added about 127 s. These ran
concurrently with other measurements on 4 cores, so the absolute seconds run
high. The growth is the finding.

**What one acceptance check costs.** `tryline` runs exactly the loop's
`verify`. It was timed three times in one process: cold, then warm on the same
line, then warm on another line.

| run | 24 lines | 60 lines | 104 lines |
|---|---|---|---|
| `verify` as it is, cold | 424.8 s | not run† | not run† |
| as it is, warm, same line | 261.1 s | not run† | not run† |
| as it is, warm, other line | **1,832.4 s** | not run† | not run† |
| without the offer menus*, cold | 162.8 s | 574.7 s | (running) |
| without the offer menus*, warm, same line | 89.4 s | 376.0 s | (running) |
| without the offer menus*, warm, other line | 112.1 s | 432.1 s | (running) |

† Stopped. At 24 lines the unpatched check already took up to 1,832 s against 112 s without the menus. At 60 and 104 lines it would have taken hours, and slowed every other measurement sharing the 4 cores. Every row in this table ran with 2 to 4 measurements sharing those cores.

\* A measurement-only, in-process patch: `verify`'s internal
`brief(target_lines=…)` was asked for no offers. That also skips rule 3's
modal check, so these rows are a lower bound, not a replacement. The verdict
was the same as `verify`'s in every row measured.

A 60-second profile of the warm unpatched check puts **100% of samples** under
`verify` → `brief(target_lines=…)` → `declared_offer` → `grade`.

`verify` builds and grades the changed line's whole offer menu. It then reads
three fields from that brief: `slot`, `forbidden_incumbent`, and
`forbidden_modal`. ~~Only the last needs the menu~~ (corrected in the debate,
A9): both `forbidden_incumbent` and `forbidden_modal` are set only inside the
offers block (`revise.py`, `brief`). Rule 3 asks of them whether each changed
line's new word, and each kept incumbent, is on the forbidden list (`revise.py`,
`verify`, `modal_hits` / `modal_kept`). §2.6 gives the exact rule.

With the menus gone, what remains is the whole-draft re-inspection. 68% of its
samples are in `relations.whole_vocabulary_pairs`. That is the
undeclared-relation path, which judges each group against every relation.

**Why warm barely helps past about 90 lines.** The per-pair memo that makes a
one-line re-grade cheap holds `PAIR_MEMO_CAP = 4_096` rows per schema slot.
Its own comment says that covers a whole draft only up to **91 lines**. The
edge memo is switched off past the same size (`relations.py`, the per-pair
memo). The comment files the scaling question under M-240, which is open.

---

## 2. The design, version 4

Version 1 went to a debate: three opponents, a defender, two judges, all
checking against the code (§5). This version takes in every change the
defender conceded and the judges accepted, and every further change the
judges required.

Version 3 adds the owner's rulings of 2026-10-02 (§6). Each ruled point is
marked where it lands.

### 2.0 The central change: resume from a saved position, not by replay

Today a deferred run's state is a **journal**: the input draft and every answer
ever given. A continuation re-runs `revise_loop` from round 1 on the input draft
and replays every answer. That rebuilds each line's offer menu and re-verifies
each answer, just to get back to where the last call stopped (§1.2: about 94% of
one measured call).

The redesign adds the loop's **position** to the state, as a field called
`cursor`. A continuation starts there.

The journal stays complete, as the fallback and the audit.

**The unit, and why it is sound.** The cursor marks a position between *units*.
A unit is the work on one line of the round's pass, or one attempt of the
whole-draft repair. Within one unit, no question is asked after an accepted
answer:

- `_try_tier1` returns on its first acceptance (`loop.py:1150-1153`);
- every exit of `_try_tier2` does the same (`:1458-1461`, `:1600-1603`, `:1675-1678`);
- group-first falls through to tier 1 only when `not attempt.accepted` (`:2186`);
- the escalation runs only on `not attempt.accepted` (`:2262`);
- the whole-draft repair `break`s on acceptance (`:1956-1960`).

Opponent A checked every path and could not break this (§5). So every question
inside a unit is asked against the unit's starting draft.

**What the cursor holds.** Stored, and covered by the seal (§2.0.1):

| field | why |
|---|---|
| `phase`: `{pass, at: i}` or `{global, attempt: k}`. (A `{batch_fold, …}` phase was needed only for §2.2 option A, which the owner did not choose.) | where the loop is. The whole-draft repair is not a pass index (A3). |
| `round`, and the round's **pass**: its line numbers in order | computed once on the round-opening draft, so it cannot be re-derived later |
| `judged_open` for the round | also computed on the round-opening draft, and read for every re-briefed line (`loop.py:2007-2009`, `:2068-2072`) (A3) |
| `touched`, `fixed_this_round`, `resolved_elsewhere` | the round's bookkeeping |
| the finished rounds and the barren-round counter | `_close` and the `no_progress` stop read them. Stored **by reference** into `outcomes` / `group_outcomes`, plus only the strings that cannot be re-derived (A7). |
| the unit's **judged verdicts** (references into `outcomes`) and its **materialized menu inputs** (the offered and forbidden lists the question was rendered with) | so an answer already judged is never re-verified, and a menu already built is never rebuilt (A6) |
| each open batch's `batch_stale` verdict, its origin draft's fingerprint, and the running stale count | so the M-183 stale disclosure matches a full replay exactly (A5) |
| the current draft, as a fingerprint plus a flag when it equals `accepted_lines`, else in full | no second copy of the draft in the common case (A7) |
| `journal_digest` over the whole journal | so later answers are still looked up after a resume (B5) |

Re-derived on resume, not stored:

- the round's `briefs` and `whole`, from the current draft and the mandate;
- ~~the defer proposer's rejection history (`last_rej`, `last_grej`)~~ **superseded by §2.8 A1: stored by reference, not rebuilt.** ~~These are rebuilt from `outcomes` / `group_outcomes` by the same rule the `record` hooks apply: the latest (round, attempt) per line or member tuple, dropped if accepted. Question bytes depend on these maps, and a group answer is looked up by a hash of its question, so they must match full replay exactly (A1).~~

**The input draft still owns two things (A2).** The resume entry takes both the
state's `input_draft` and the cursor's draft. It scopes the reviser with
`for_revision(input_draft)`, which is where declared pronunciations get their
origin and so where coverage and certification are judged. It also computes
`LoopResult.input_n` / `input_fingerprint` from the input, exactly as a full
replay does.

**Entering at the cursor (A3, B8).** On a cursor resume, the defer proposer:

1. ~~sets `replaying = False`;~~ sets `replaying = False` only when the cursor's draft equals `accepted_lines` (§2.8 B);
2. emits one checkpoint on the cursor draft, **before** the re-brief or any other expensive work, so that every call that starts leaves a state behind;
3. re-briefs and enters the loop at the cursor.

**What a continuation costs (A6).** One re-brief of the current draft, plus one
`verify` per **new** answer, plus one exact menu for the next question. Nothing
here grows with the number of answers on record. §2.7 says what that floor is at
100 lines.

**The fallback is full replay, and it must still make progress (B5).** A state
falls back to replay from round 1, exactly as today, when:

- it has no cursor (minted before this change);
- the seal fails;
- the journal digest mismatches;
- the CLI run key or scorer identity has changed (§2.0.1).

On a long song a full replay is exactly what gets killed. So during a fallback
replay the harness computes the cursor at every unit boundary, as it does live,
and emits it in the checkpoint **in its own fields**. It never overwrites
`accepted_lines` or any other progress field: those stay at their furthest
recorded values. The connector's kill branch publishes `accepted_lines` as
`final_draft`, and a checkpoint written mid-replay must not hand back a draft
missing edits the writer already had accepted (both judges, B5). A replay
killed partway therefore leaves a sealed cursor at its furthest point, and the
next call continues from there.

Every resume that falls back says so: the result carries
`cursor_stripped: missing | seal | digest | run_key | key_unavailable`.
**Ruled yes by the owner, 2026-10-02 (Q5).**

**Scope (A11).** The cursor applies only to the interview (`defer:`) journal.
The model-writer checkpoint journal replays by index, and its published
`resume_proof` asserts the whole prefix was replayed. It keeps full replay
unchanged. **Defects 1 and 3 therefore remain on the model-writer path.** This
design does not claim to fix them there. **The owner accepted this scope,
2026-10-02 (Q7a).** The model-writer path is a separate item.

**Old states (C6).**

- Connector states minted before this change are refused with `CONTINUATION_MIGRATION_REQUIRED`, as any source change already causes today.
- CLI journals that hold a recorded group answer will have that group question asked again once, because §2.4 changes the group prompt's bytes and a group answer is looked up by a hash of them.

~~Old states keep working exactly as now.~~

#### 2.0.1 Who may hand in a cursor: the seal

Today the replay is the only authority over what was accepted. A forged
`accepted_lines` changes nothing, because replay re-verifies every answer. A
cursor is trusted, so in a caller-held state it must be unforgeable.

- **What is sealed (A4, B1).** The MAC covers a canonical serialization of the whole decoded worker state except `pending.answer`. That includes `input_draft`, `connector_declarations`, `connector_semantic_identity`, `connector_run_ref`, `answered`, `outcomes`, `group_outcomes`, the cursor, and the effective revise declaration (attempts, backtrack, max_rounds, offered, modal_exclusion, pursue, allow_net_new). A seal over the cursor alone would let a caller keep the cursor while changing the declarations or input underneath it.
- **Where it is sealed (B4).** One function, `sealInterview(state)` in `mcp/lyric_tools.js`, called from every place a state is minted:
  - the suspend (exit 4), finish, kill / generic `other`, and journal-capacity branches;
  - `workflow_sessions.resumeSnapshot`, which today encodes a job-store checkpoint directly.
- **The key (A10).** Derived as `HMAC(loadChatSecret(), 'lyric-cursor-v1')`, loaded once per process in `lyric_tools.js` and shared by `server_http` and `server_stdio`. Chat envelopes and cursors never share a key.
  - In production the secret is persisted at `/data/lyrics/chat-secret.key` on a single instance (`render.yaml`, `production-config.json`, `job_store.js:131-149`), so sealed cursors survive restarts (opponent B, §5).
  - Local and stdio servers without a key file get a per-process key, so each restart costs one full replay. That replay now makes progress (above).
  - A damaged key file does not fail `lyric_revise`. Sealing is disabled for the process and every state falls back to replay.
- **The CLI (A4, judge 1).** The file is the user's own and is not sealed. But the cursor is bound to:
  - the run key: argv, plus content hashes of the draft, the blueprint and every declaration file, such as `--pronunciations`;
  - a scorer identity equivalent to the connector's `continuationSemanticIdentity` (source, assets, manifest, runtime).

  On any mismatch the harness ignores the cursor and does a full replay, with M-183's stale disclosure. "Run the SAME command again" with a changed flag, an edited file or an updated harness can then never resume a position computed under other inputs.

### 2.1 Defect 1 (replay growth): fixed by 2.0

Per-call cost no longer depends on answers on record. State bytes still grow
with the journal. The cursor is stored by reference so it does not duplicate
`outcomes` or the draft (A7). ~~It is maintained identically in cursor and
full-replay modes, so admission sees the same bytes either way.~~ Superseded by §2.8 C: the cursor is measured outside the journal's capacity, in a separate budget.

~~That growth is linear and small.~~ Withdrawn until measured (B10). State
bytes against `JOURNAL_WORK_BYTES` (384 KiB, the working ceiling, not the
448 KiB hard one) at 24, 60 and 104 lines are on the pre-build list (§4.3).

### 2.2 Defect 2 (batch answers with no verdict): keep today's order and say where every answer stands (owner's ruling: option B)

**Ruled by the owner, 2026-10-02 (Q1: B; Q2: yes).**

The debate showed that judging every batch member first (option A) can change
which lines are accepted (C2):

- `prefetch` chooses batch members as independent through `_related`, which reads only group members, return members and the first rhyme partner (`lyric_harness.py:8009-8033`);
- findings measured across many lines, such as `ANAPHORA_OVERLOAD`, still couple them;
- `verify`'s "fixed" diff keys on each finding's full locations.

The owner chose option B: **the walk order, and so what is accepted, stays
exactly as today.** What changes is that no answer is left without a stated
standing. Every answer a writer gave in a batch comes back with one of four
verdicts:

| verdict | when | carried as |
|---|---|---|
| `accepted` | `verify` accepted it | today's outcome record (`accepted: true`) |
| `rejected` | `verify` rejected it | today's outcome record (`accepted: false`, with `verify`'s reasons) |
| `not_applied` | the walk reached this member and its finding was already closed by an earlier accepted line (`resolved_elsewhere`), so the answer was never judged | a **new** outcome record: `accepted: null`, `disposition: "not_applied"`, `why` naming the line whose acceptance closed it, recorded once when the walk passes the member |
| `pending` | the answer is on record, the walk has not reached it, and the call suspended on another question first | not stored. ~~The harness adds a `waiting` list to the pending question's record: `[{line, attempt, round, on: [lines asked now]}]`. Every batch answer on record with no outcome is listed. The connector renders each as `pending: waiting on L<i>`.~~ **Superseded by §2.8 D:** the connector computes it from the returned state; nothing is added to the journal. |

`unknown` remains for one case only: a row the connector cannot match to any
record, as today for states minted before this change. T3 asserts that no row
from a run under this design is `unknown`.

~~**Why `pending` is not stored.** A pending answer is judged later by the same
walk that judges it today. Storing "pending" would be a second statement of
"no outcome yet". The `waiting` list is recomputed at every suspension from the
journal and the outcomes, so it cannot go stale.~~ (§2.8 D replaces this.)

The connector:

- ~~`foldedOne` maps … an entry in `pending.record.waiting` to verdict `pending`~~ `folded` is built by journal diff on every result branch, with `not_applied` rows read from the separate `dispositions` list (§2.8 D);
- both carry `source: "outcome"` or `source: "waiting"`, not `unverified`;
- the published `folded` verdict list grows by these two values (owner, Q2).

~~**Cost:** nothing measurable. The `waiting` list is a walk over the journal at
suspension. `not_applied` is one record written when the walk passes a member it
already skips today.~~ The records are measured in the separate budget (§2.8 C) and on the pre-build list (§4.3).

**Acceptance is unchanged.** It is pinned by test: two `_related`-independent
members share an `ANAPHORA_OVERLOAD` finding, and the run's outcomes and final
draft must equal today's code on the same journal (C2).

### 2.3 Defect 3 (killed continuations)

**(a) Per-call cost stops growing (2.0).** A retry after a kill costs about what
the killed call cost: one re-brief, the new answers' verifies, and the next
menu. It does not re-verify judged answers (A6).

**(b) The loop stops itself at a safe point.** The harness already receives its
deadline as `LYRIC_REQUEST_DEADLINE_MS` on both the warm and cold paths
(`python_bridge.js:381`, `:474-479`; `worker.py:56`). The kitchen proposer
already reads it. Opponent B could not show that this adds a cap (§5).

- **Where it may stop (B7, C6).** Only *before* judging an answer, opening a batch, starting a menu, or adding the next member to a batch under construction. Never in the middle of building a question. Whether a call stops depends on time; what any question contains never does. It stays a pure function of the draft, the mandate and the journal, so group-question hashes match full replay.
- **Batch construction is resumable (judge 1, B7).** The cursor records the batch under construction: the members chosen so far and each one's materialized menu inputs, keyed by draft fingerprint. A call that stops between members is continued by the next call, which builds the same batch. Membership follows the same deterministic rules and the same journal-capacity trimming. Without this, a batch whose menus take longer than one call could never be asked. §1.3 measured the 24-line fixture's first batch at more than 31 minutes.
- **When it stops (B12).** It stops when the time left is less than the longest step so far **plus** the measured cost of stopping itself. The harness times its own state write and checkpoint print the first time it does them in a call. Before that, it estimates the write from the state's size and the write rate measured at its first checkpoint. No constant is declared, and the bridge is not changed.
- **Tests do not read the wall clock (B11, C14).** The safe-point check reads an injectable clock: a `deadline` object passed to `revise_loop`, real time in production. Tests drive a fake clock with fixed per-step costs and assert the stop *position* in the cursor, never seconds.
- **The stop's result: exit 5 (owner, Q3, 2026-10-02).** A safe-point stop has no pending question, and exit 4 would invite an answer the next call refuses. So the harness exits **5**, "STOPPED at a safe point — resumable; continue with no answer", added to `EXIT_MEANING`.
  - It is routed through the connector's existing interrupted (`other`) branch: status `interrupted`, sealed `state`, `run_id`, the existing raw continue text, and the session's continue-with-no-answer next step.
  - Checked by the debate (B6): `client.js` treats only exit 0 and 3 as stopped, so a 5 keeps the run live. `lyric_workflow.js` counts only 0, 3 and 4 as creation steps, so a 5 is not counted.

**(c) A killed call keeps the run (B2, B3).** ~~Version 1 marked killed revises
as interrupted operations.~~ Withdrawn: that changes a tested contract and is not
needed.

- Killed revises stay `completed`, with the existing "continue with lyric_revise, the latest session_id and no answer" next step.
- Their `state` is the last checkpoint, which now carries a sealed cursor.
- The entry checkpoint (2.0) comes before the re-brief, so a call is exposed only for the re-brief itself.
- A kill that produced no new checkpoint leaves the session's previous sealed continuation in place, and the next no-answer call resumes from it.

**(d) A run that cannot advance is reported, never refused (B8, C10).**

- Progress means the journal digest advanced (a new question was asked or a new verdict recorded), or the cursor position advanced.
- ~~On a kill with no new checkpoint, the connector re-seals the *incoming* state with `stalls + 1`~~ **Superseded by §2.8 E:** the count compares positions on exit-5 and killed calls, whichever state is returned.
- At 2 or more, the result says so: the step in progress, the draft size, and that this draft does not fit one call on this server.
- The call is never refused, so no limit is added (standing rule 2).
- The result field is `no_progress_calls: n` (owner, Q4, 2026-10-02).

### 2.4 Defect 4 (empty group menus): narrowed to what actually gains (C5, C13)

The debate showed most of version 1's one-move menus would be empty or
repeated:

- A line enters group-first only when its tier-1 OFFERED list is empty (`loop.py:2104-2107`), so the pivot's one-move menu is empty by construction there. That was every question measured at 60 and 104 lines.
- In a group of three or more, a member's one-move menu must answer partners that do not rhyme with each other, so it is usually empty.
- `brief` builds no Brief for a member without per-line findings (`revise.py:5811`).

What remains, and is real:

- **The non-pivot member on the escalation path gets its one-move menu.** These are the words at its bound place that answer every group bound there while the other members keep their current words. ~~It is computed by tier 1's own call (`brief(target_lines={member})`, `declared_offer`)~~ It is computed by the shared per-place offer function factored out of `brief()` (§2.8 G), and it is the couplet case that defect 4 reproduced.
- **The pivot on the escalation path:** ~~reprinted from the cursor or named by reference~~ one fixed rendering (§2.8 G): its lists are always printed from its own `Brief` on the unit's starting draft, and the line question is cited only when asked on the same draft. Never "above".
- **The group-first path:** §2.4 adds nothing, and the prompt says so.
- **A member with no Brief** prints its own sentence ("no single-line finding on L<n>; no one-move menu was computed"), not "(none offered)".
- **Rule 3's text in the group prompt** branches on the path. On group-first it keeps today's "empty by construction" sentence. On escalation it says the pivot's forbidden list from its line question still binds, and names it (C13).
- **Labels** are worded through `slot_phrase` / `word_name`, so a slot-placement mandate reads correctly.
- **Menu presence** is a pure function of the draft and the mandate. A safe point may stop the call before a group question is built, but never builds it with a menu missing (C6).

Cost: one exact menu per escalated non-pivot member. One menu was never measured
at 60 or 104 lines. That is on the pre-build list (§4.3).

### 2.5 ~~Print a batch question's shared blocks once~~ — withdrawn (C7)

That already exists. `render_batch` has printed the whole draft and the
whole-draft findings once since commit `c91bca12` (2026-10-01). Phase 1's
103,921-byte batch was measured with that fix in place.

What still repeats per member is different:

- the offered and forbidden lists;
- the enforced-rules block, about 980 bytes;
- cross-line finding evidence such as `ANAPHORA_OVERLOAD`, about 2 KB per member on long songs.

That is a separate item: re-measure, then decide.

### 2.6 `verify` stops building offer menus it does not read (A8, A9, B9)

**Today.** `Reviser.verify` calls `brief(before, …, target_lines=changed)` with
offers on. That builds and grades the changed lines' whole offer menus.
Measured, the menus are about two-thirds of a warm check on the same line
(261.1 s against 89.4 s) and about 94% on another line (1,832.4 s against
112.1 s) (§1.3).

**What `verify` reads from that brief:**

- `slot`;
- `forbidden_incumbent`;
- `forbidden_modal`.

Both `forbidden_*` fields are set only inside the offers block (A9).

**Change.** `verify` asks `brief` for no offers and computes rule 3's answer
directly, with exactly the branch structure the field uses (A8). For each
changed line:

1. If the line has no `Brief` (no per-line finding before the change), or no `wants and groups`, rule 3 does not apply, as today (gate restored by §2.8 G).
2. Otherwise, at the line's primary place: `forbidden_incumbent = _incumbent(lines, ln, b.slot)`.
3. If the place has no call words, the head is empty.
4. Otherwise, compute the raw `joint_field_screened` forbidden head on those call words, with the incumbent excluded.
5. **When the place's relation is not explicit** (the undeclared default), that raw head *is* `forbidden_modal`, with no filter.
6. **When it is explicit**, `forbidden_modal` is the head filtered through `declared_offer`.
7. The question is then asked of **every changed line's new word and every kept incumbent**: is it in the raw head, and either the relation is not explicit or `declared_offer([word])` keeps it?

Version 1's single predicate would have let through raw-head words that fail
`declared_offer` on the undeclared default. That loosens rule 3, which is a
change to what a song is judged on. This version does not.

**The open question from version 1 is settled by the code.** `declared_offer`'s
verdict on one word does not depend on the other words in its list:

- the forbidden-list call passes no `limit` (`revise.py:6025-6027`);
- `dict.fromkeys` only removes duplicates;
- the baseline is a function of `lines` and the groups alone (`revise.py:4396-4402`).

T8 pins this.

**What it does not change.** What is accepted. Rule 3 rejects exactly what it
rejects today, on both branches.

### 2.7 The floor this design does not remove

After 2.0 and 2.6, a continuation still pays one re-brief, one `verify` per new
answer, and one exact menu for the next question.

On the fixture drafts:

- a cold whole grade: 97.8 s at 24 lines, 324.8 s at 60, **1,307.3 s at 104** (undeclared default);
- the same 104-line draft under a declared relation: 266.1 s;
- a cold menu-free verify: 162.8 s at 24 lines and 574.7 s at 60.

~~A 100-line song with a declared relation fits a call.~~ Withdrawn (C3). A call
is more than one grade. **No measured figure yet shows any 100-line
continuation, declared or not, finishing inside 600 s.** One full continuation
(re-brief + verify + next exact menu) on the declared 104-line draft, alone on
the box, cold and warm, is on the pre-build list (§4.3).

**The number of calls grows with the song (C4).**

- On the long fixtures every question was group-first, and the batch door is closed to group-first lines.
- So each open line costs at least one group question plus one tier-1 fall-through: two calls. The same 4-member group is asked again once per pivot.
- **Nothing in this design reduces that count.** It removes the growth in each call's cost, not the number of calls.
- A calls-per-song estimate (open lines × 2 × the measured per-call time) goes here once §4.3's figures exist.

**The grader's cost is the wall.**

- The per-pair memo that makes warm re-grading cheap holds `PAIR_MEMO_CAP = 4_096` rows per schema slot. That covers a whole draft only up to 91 lines, and the edge memo switches off past the same size (`relations.py`).
- The undeclared default, which judges each group against the whole relation vocabulary, cost about 4.9 times the declared relation at 104 lines (1,307.3 s against 266.1 s).
- The declared 104-line report was 4,167,870 bytes, 26,434 under the connector's 4 MiB output cap. M-240's note 5 records that a report grows with the square of the line count.

Sizing the memo to the draft, or making the whole-draft re-inspection
incremental, is the grader's work under M-240. **The owner ruled, 2026-10-02
(Q7b), that it stays there**, outside this branch. Until one of them lands, this file does
not claim the loop is fixed for 100-line songs.

### 2.8 Round-2 amendments (binding)

Debate round 2 (§5.5) found 25 more problems in version 3. All 25 were
conceded, and both judges ruled that the design **passes once these changes are
applied**. No point needed the owner.

These amendments are binding. Where they conflict with §2.0–§2.7, **they win**.
The superseded sentences above are struck and point here. Where the two judges
differed, the stricter requirement is taken.

**A. The cursor's contents (R7, R8, R9, R11, R12, S2).**

1. **The rejection maps are stored, not rebuilt (R7, judge 2).** `last_rej` and `last_grej` go in the cursor by reference: line → index into `outcomes`, member tuple → index into `group_outcomes`. They are taken exactly as the live hooks hold them at the unit boundary, live and during fallback replay alike.
   - The rebuild in §2.0 is withdrawn. `outcomes` is never pruned, so after a fallback replay whose walk changed, a rebuild would read orphan entries.
2. **The current round's attempts are stored (R8).** These are `attempts`, plus `_attempts` in the global phase, as `LineAttempt` records: by reference (outcome key plus the composed reason string) where an outcome exists, verbatim where none does (pinned, starved, escalation labels).
3. **The menu cache is the whole offers block (R9).** Per materialized question, the cursor holds every `Brief` field the offers block sets, including `fields_by_slot` and its `SlotField`s, keyed by the draft fingerprint it was computed on.
   - It is a cache. When missing, dropped or keyed to another draft, the menu is rebuilt by `brief(target_lines=…)` on the same draft, which gives the same bytes.
4. **`journal_digest` is a prefix hash (R11).** It is SHA-256 over the canonical JSON of `input_draft` plus the first k1 records of `answered.propose` and the first k2 of `answered.propose_group`, with k1 and k2 stored in the cursor.
   - Appended answers pass. An edited or removed earlier answer fails, giving `cursor_stripped: digest`.
   - Outcomes are not in the digest. They are covered by the seal.
5. **The stale disclosure is reproduced exactly (R12).** The cursor carries `tally.hit` and the full list of stale keys.
6. **The `closed_by` map (S2).** At each re-brief, a pass line still ahead that has just dropped out of `still_open` is attributed to the most recent accepted unit's touched lines. Only one unit's acceptance lies between consecutive re-briefs (`loop.py:2063`).

**B. Entering at the cursor without regressing the draft (R3).** Step 1 of
"Entering at the cursor" becomes:

- set `replaying = False` **only when the cursor's draft equals `accepted_lines`**;
- otherwise, stay in the own-fields checkpoint mode the fallback replay uses until the walk's draft reaches `accepted_lines`, the entry checkpoint included.

**C. Size: one separate budget, and the cursor never ends a run (R10, S4).**

- `dispositions`, `stalls`, `closed_by` and the cursor are measured **outside** the worker journal's capacity. They are excluded from every `_journal_admit` site's measure, and from the connector's `assertContinuationCapacity`. So every state that fits today still fits, with the same batch trimming and the same capacity stop point.
- They share one budget under `STATE_DECODED_BYTES` (512 KiB): 512 KiB minus the worker bytes (cursor excluded), minus the actual `connector_declarations` bytes, minus a fixed margin for `connector_semantic_identity`, `connector_run_ref` and the seal. The connector passes this budget to the harness.
- `dispositions` are reserved first and never dropped. Each is keyed (line, attempt, round), idempotent, at most one row per recorded answer, with `why` as a short code the connector renders as text.
- The cursor uses what remains, in three tiers:
  1. the full cursor;
  2. without its menu caches (rebuilt deterministically, A3);
  3. no cursor, in which case the next call says `cursor_stripped: missing` and the harness's report line says why.

**D. Option B, made exact (R2, S2, S3, S4, S5).**

- **Every pass-by writes a disposition (S2, S3).** The loop calls a new proposer hook, `propose.skipped(line, attempt, round, why)`, on every path where the walk passes a member that has an answer on record:
  - `resolved_elsewhere` (`loop.py:2075`, `:2097`);
  - the `touched` skip (`:2011`);
  - a group-first acceptance before tier 1;
  - `_materialize` returning None (`:2130`).

  The proposer writes a row only when an answer exists for that key, and only into its own list, `st["dispositions"]`, **never `outcomes`**. So `outcomes`, `last_rej` and every question's bytes are exactly today's. The `why` codes are: closed by the accepted rewrite of L…; rewritten by the accepted group rewrite of L…; no finding stands on L… on the current draft.
- **`pending` is not stored at all (S4).** ~~The `waiting` list~~ is dropped. The connector computes `pending` from the state it already returns: every answer in `answered` with no outcome, group outcome or disposition. It attributes each to the lines of the current pending question, or to "the run stopped before reaching it" on exit 5 or a kill. Because every pass-by now writes a record, "no record" means exactly "not yet reached".
- **`folded` is built by journal diff, on every result branch (R2, S5).** The branches are exit 4, finish, exit 5, kill or interrupted, and journal capacity. The connector compares the outcome, group-outcome and disposition records in the returned state with the incoming state's, and publishes every new or changed one as `accepted` / `rejected` / `not_applied`, with `source: "outcome"`. It publishes every still-unrecorded answer as `pending`. An answer's verdict is therefore published by the call that judged it, including a call that ends at exit 5. Only the four owner-approved verdict values are used.

**E. Stopping and kills (R1, R4, R13, S11).**

- **An exit-5 stop leaves its position in two places (R4).** It prints one final control checkpoint holding the stop cursor (`status: "stopped"`, through `checkpoint()` and B's rule), writes the same state to the defer state file, then exits 5. The cost-of-stopping term budgets both writes.
- **Group-question construction is resumable (S11),** on the same terms as batch construction. The cursor records the members whose one-move menus are done, with their cached offers blocks. A safe point is allowed between members. The question's bytes stay a pure function of the draft, the mandate and the journal.
- **The no-progress count is by position (R1; judge 1's narrowing).**
  - Position means: cursor phase and index, round, members done in any batch or group under construction, the count of verdict and disposition records, and the identity of the pending question. It excludes `stalls` itself and the seal.
  - Compared **only** on exit-5 results and killed, timed-out or cancelled calls. A refusal (exit 2), a journal-capacity stop and a finish never change the count, and exit 0 or 3 clears it.
  - If nothing advanced, the connector carries `stalls + 1` into whichever state it returns, the entry checkpoint or the incoming state, re-seals it, and puts it into the run store with a new revision even when no checkpoint was printed. The session layer stores it.
  - Any advance, or a new question, resets it to 0.
  - At 2 or more the result carries `no_progress_calls`. No call is ever refused.
- **A restart is not a bridge kill (R13).** "A kill that produced no new checkpoint leaves the session's previous sealed continuation in place" applies to bridge kills. A server restart before the entry checkpoint keeps today's behaviour: not resumable, continuation cleared, `CONTINUATION_UNCERTAIN` gives the recovery steps. The entry checkpoint narrows that window to process start-up.

**F. The connector's surfaces (R5, R6, R12, R14).**

- **One sealing helper (R5).** `encodeInterviewWire(state)`, exported from `mcp/lyric_tools.js`, is called by every interview mint:
  - the four `lyric_revise` branches;
  - `workflow_sessions.resumeSnapshot`;
  - `chat.js` checkpoint recovery.

  Kitchen checkpoints keep plain `encodeState`. A guard test fails if any interview `state` is built from bare `encodeState`.
- **The website chat (R6).** `gemini_agent.js` `carryState` carries an `interrupted` interview result that has a state, as resumable, the way it carries a kitchen checkpoint.
- **The published text (R12).** The proposer disclosure header and the session's continue text are reworded to state both paths ("resumes from its saved position, or replays its journal when that position cannot be trusted"). This is the statement the owner approved for the `lyric_revise` description (Q6).
- **Session callers see the new fields (R14).** `cursor_stripped` and `no_progress_calls` are added to `verdict_view.js`'s `KEPT`, to the hand-built exit-4 object, and to the `other` and finish verdicts.

**G. Menus and rule 3 (S1, S7, S10).**

- **One shared per-place offer function (S1, both judges).** The offers block's per-place computation is factored out of `brief()` into one function that `brief()` also calls (`revise.py` about 5953–6122). That covers the calls, `joint_field_screened`, schema widening, `_explicit` and `declared_offer`, the widening pool, the `_anchors_at` filter, and the by-call fallback.
  - The non-pivot member's one-move menu calls that function at `_slot_for(mandate, gi, m_line)`, on the unit's starting draft, with the pivot's current word among the calls and the member's own word excluded.
  - Nothing is reimplemented. This works for a member with no per-line finding, which has no `Brief`.
- **One rendering for the pivot (S10).**
  - The pivot's offered and forbidden lists are always printed from its own `Brief` as materialized on the unit's starting draft.
  - The line question is cited ("as offered in L2's line question, attempt 1, round 1") only when it was asked on the same draft fingerprint. Otherwise the prompt says "no line question was asked on this draft; these are the lists the grader enforces now."
- **Rule 3's exact gates (S7).**
  - Step 1 becomes: no `Brief` for the line (no per-line finding before the change), or no `wants and groups`: rule 3 does not apply.
  - "Explicit" means `_explicit = any(m.relation_of(k) or not self.schema_route_open(m, k) for k in ks)`, by name.
  - Only a **changed** bound word can be rejected. For a kept incumbent, head membership only selects the disclosure clause.

**H. Tests, as amended (S8, S9, and every case above).**

- **T1's positive marker (S8, both judges)** is `replayed_answers` in the harness's own `lyric_result` run record, which `verdictOf` does not publish: 0 on a cursor resume, the count otherwise. **No marker goes in the disclosure.** T1 still compares the disclosure byte for byte across both arms.
- **T1 adds these scripts:**
  - two same-round escalations of one couplet from different pivots;
  - a `not_applied` line asked again later;
  - a disposition crossed mid-run;
  - an edited earlier answer that forces a digest fallback, after which the next call resumes from the fallback's cursor;
  - `LoopResult.rounds` after a pinned tier-2 attempt, and inside the global repair;
  - A3's full script: `judged_open` false, an accepted edit introducing a flag under `allow_net_new`, then a suspension.
- **T2 (S8)** becomes: each answer is verified exactly once across the run, and the verify calls in one call equal the answers judged for the first time in that call. It is counted at the reviser proxy boundary with `LYRIC_REPLAY_MEMO=0`, one cold process per call.
- **T3 adds:**
  - a stop between an answer and its verify, and a stop after its verdict: each publishes the answer's verdict on the call that wrote it;
  - one fixture per pass-by path (S2);
  - continuing one call further, L4's final verdict, published by the call that judged it;
  - an exit-5 stop right after a batch is folded.
- **T4 adds:**
  - the connector path: the returned `state` and the state file both hold the stop position, and the next call resumes from it;
  - a fake-clock stop between two members' group menus, after which the finished question is byte-identical.
- **T5 adds:**
  - three kills after the entry checkpoint, and three exit-5 stops at one position: each gives `no_progress_calls >= 2`;
  - an advance resets the count;
  - a refused invalid answer leaves the count unchanged;
  - a fallback replay killed, then resumed and killed again: `final_draft` equals the furthest `accepted_lines`;
  - a server restart before and after the entry checkpoint.
- **T6 adds:**
  - the couplet fixture with no per-line finding on L1, where L1's printed words equal the shared function's output and equal `brief()`'s offer on a variant draft where L1 also carries a finding;
  - a non-default slot where an unanchorable word is not offered;
  - a batch member whose call word moved before escalation;
  - `--attempts=0 --backtrack=1`.
- **T7 adds:**
  - an edited earlier answer falls back, and a newly folded answer does not;
  - a chat-recovery case;
  - the `encodeInterviewWire` grep guard.
- **T8's failing half (S9).** Over T8's corpus, `verify` requests `include_offers=False`, and makes zero calls to `_widen_pool`, `schema_widened_field`, or `declared_offer` with a `limit`. The old code fails this. T8 also adds a group rewrite whose non-pivot member has no per-line finding (S7).
- **Near capacity (R10, S4).** A run whose worker part is within a few KiB of 448 KiB, with 32 KiB of declarations, that writes dispositions, must still encode and resume, and must choose the same batch members and reach the same capacity stop as today.
- **The website chat (R6).** An exit-5 interview verdict fed through `carryState` is carried.
- **Session views (R14).** Both new fields appear in the session view.

**I. Code touched, added to §4.1.** `mcp/chat.js` (recovery mint),
`mcp/gemini_agent.js` (`carryState`), `mcp/verdict_view.js` (`KEPT`), and the
factored offer function in `quality/revise.py`.

---

## 3. What stays the same, and what changes in the published contract

**Stays the same:**

- **What a song is judged on.** `verify` decides every acceptance. Rule 3 rejects exactly what it rejects today (2.6). The stop conditions, `MANDATORY_PURSUE` and the final grade are unchanged.
  - §2.2 option A, which could change which lines are accepted, was **not** chosen. The owner ruled for option B.
- The bound-word rule (M-317) and every relation judgment.
- The writer contracts `propose(...)` / `propose_group(...)` and the answer formats.
- The journal: complete, replayable from the input draft, and the fallback and audit.
- Killed revises stay `completed`, with today's next step (2.3c). Operation-level status is unchanged.
- The model-writer checkpoint journal and its `resume_proof` (2.0, scope).
- No cap or limit is added. The safe-point stop reads a deadline the connector already sets. The no-progress count reports and never refuses.
- Standing rule 1: nothing touches the recipe engine.

**Changes to the published contract, each ruled yes by the owner on 2026-10-02 (§6):**

1. New `folded` verdict values `pending` and `not_applied` (2.2; Q1 B, Q2).
2. Harness exit code 5, "STOPPED at a safe point — resumable; continue with no answer", in `EXIT_MEANING`, routed through the existing interrupted branch (2.3b; Q3).
3. The result field `no_progress_calls`, reported and never refused (2.3d; Q4).
4. The published `lyric_revise` description (Q6). It says each call "re-runs the loop from its record (deterministic, so the same questions arrive in the same order)" (`mcp/lyric_tools.js:1989-1990`). That would become: each call resumes from its saved, sealed position, or replays its record when the position cannot be trusted, and the same questions arrive in the same order either way. The forgery reasoning at `:2423-2429` would be restated to rest on the seal plus the replay fallback.
5. The result field `cursor_stripped: <reason>` (2.0; Q5).

**Writer-facing prompt text changes** (not result fields): the group question's
menus and rule-3 sentence (2.4). Because a group answer is looked up by a hash
of its question, CLI journals with recorded group answers have those questions
asked again once (2.0, old states).

## 4. Costs, pre-build measurements, and tests

### 4.1 Code touched

- `quality/loop.py`: the cursor, the resume entry, safe points with an injectable clock, the batch-construction position, and §2.2 option B (the `not_applied` record when the walk passes a member it already skips).
- `lyric_harness.py`: `_defer_proposer`, covering:
  - cursor in and out;
  - the entry checkpoint;
  - checkpoints during fallback replay that do not regress `accepted_lines`;
  - rebuilding `last_rej` / `last_grej`;
  - the CLI run key and scorer-identity binding;
  - the `waiting` list on a suspended question's record (§2.2).
- `quality/revise.py`: `verify`'s offer-less rule 3 (2.6).
- `quality/propose.py`: the group prompt's menus and rule-3 text (2.4).
- `mcp/lyric_tools.js`: `sealInterview`, the cursor key, the stall count, exit 5 in `EXIT_MEANING`, `foldedOne`'s two new verdicts, `cursor_stripped`, `no_progress_calls`, and the `lyric_revise` description (Q6).
- `mcp/workflow_sessions.js`: `resumeSnapshot` sealing, and storing a re-sealed state after a stall.
- Checked for exit-code and field assumptions: `mcp/lyric_workflow.js`, `mcp/client.js`, `mcp/verdict_view.js`, `mcp/python_bridge.js`.

### 4.2 Tests: each must fail on the old code and pass on the new

- **T1, resume equals replay.** Scripted runs are driven call by call twice: resuming from the cursor, and with the cursor stripped. Every question's bytes, `question_sha256`, outcome, `stale_answers`, proposer disclosure and final `LoopResult` must be identical.
  - The resume arm asserts the cursor path was really taken: no stripped-cursor reason, and the verify count per call equals the number of new answers. That fails on the old code, which has no cursor (C11).
  - Fixtures: a pasted 24-line couplet song, and a 6-line planner fixture that asks a question within the test budget. The 24-line planner fixture is not runnable in CI (§1.3).
  - Required scripts:
    - a tier-1 line and a group question each re-asked after a previous-round rejection (A1);
    - a `--pronunciations` run where an accepted rewrite removes a declared occurrence (A2);
    - a suspension inside the whole-draft repair, and a round that opened with `judged_open` false (A3);
    - a suspension on a later batch member after an earlier one was accepted (A5);
- **T2, cost does not grow.** The number of `verify` calls in a continuation equals the number of new answers, whatever is on record. This is counted, not timed. Old code: grows by one per answer.
- **T3, batch verdicts.** The AABB reproduction. After the batch answer, L2 is `rejected` and L4 is `pending: waiting on L1, L2` (the group question asked next), never `unknown`. A second fixture has a member whose finding an earlier member's acceptance closed, and it must come back `not_applied` with the closing line named. Old code: L4 is `unknown` / `unverified`, so the test fails there.
- **T4, deadline stop.** A fake clock stops the run at a safe point, including mid-batch-construction. The finished batch is byte-identical to the uninterrupted one, and the no-answer continuation finishes the same run T1 finishes.
- **T5, kills.**
  - After a simulated kill, the no-answer continuation resumes from the cursor (T2's count).
  - A kill before the resumed call's first checkpoint leaves the previous sealed cursor in force (B3).
  - A full replay killed partway yields a sealed cursor, and its `final_draft` equals the incoming `accepted_lines` (B5).
  - Three kills during the re-brief yield the no-progress report (B8).
  - The kill is simulated by the fake clock and a stop file, never by a timing budget.
- **T6, group menus.** The couplet escalation case lists L1's one-move words. The group-first, three-member and escalation-pivot cases each assert their exact printed lines (C5).
- **T7, the seal.** One case per sealed field: edit it, keep the seal, and the run falls back to replay with the right reason and reaches the replayed result. Also a resume through `resume_operation` and a session continuation (B4), and a CLI case that changes only the scorer identity (A4).
- **T8, `verify` is unchanged.** Over every draft and revision pair in `test_revise.py`, `test_loop.py`, `test_verbs.py` that reaches `verify`, plus the Phase 1 fixtures, the new `verify` returns the same dict, key for key, `reasons` byte for byte. It must cover:
  - an explicit-relation pair;
  - an undeclared-default pair where a revision takes a raw-head word that `declared_offer` refuses;
  - a line with no `wants`;
  - `MODAL_DRAFT`, whose kept incumbent is in its own head;
  - a multi-line `changed` set.

  A mutant that always filters, and one that drops rule 3, must each fail it.
- **Coupling test (C2).** Two `_related`-independent batch members share an `ANAPHORA_OVERLOAD` finding. The run's outcomes and final draft must equal those of today's code on the same journal, which proves option B changes nothing about acceptance. This test must also pass on the old code: it pins what must *not* change. Its failing-on-old partner is T3.
- Plus the repo's own checks: `quality/suite_sweep.py --only` for `test_loop`, `test_revise`, `test_verbs`, `test_replay_memo`, `test_production_journal`; `node mcp/test.mjs`; the continuation suites.

### 4.3 To measure before building, alone on the box

1. State bytes against `JOURNAL_WORK_BYTES` (384 KiB) at 24, 60 and 104 lines (A7, B10).
2. One full continuation (re-brief + verify + next exact menu) on the declared 104-line draft, cold and warm (C3). This is recorded once as the long-song acceptance figure; it is not a CI test (C12).
3. One exact menu at 60 and 104 lines (C5).
4. Replay curves on genuine couplet fixtures at 60 and 104 lines (C4).
5. (Supplementary, still running at this writing) the menu-free acceptance check at 104 lines.

---

## 5. The debate

### 5.1 How it was run

Run 2026-10-02 as a Workflow (`loop-redesign-debate`, run `wf_57ba5db3-882`)
against version 1 of this file. Six independent agents took part. All of them
were read-only: no file writes, no song runs, nothing over about two minutes.
Each was told to cite code as `path:line`.

- **Three opponents,** each told to refute from the code, each with its own lens:
  - A: equivalence and correctness;
  - B: trust, the connector, kills and owner boundaries;
  - C: batch, menus, size, and whether long songs are actually served.
- **One defender,** who had to answer every objection: rebut it from the code, concede it with a concrete change, or name it as the owner's decision.
- **Two judges,** each independent, who opened the cited lines themselves and ruled on every objection: answered, the design must change, or an owner question.

### 5.2 The outcome

- **37 objections** were raised: 5 blocking, 25 major, 7 minor.
- **The defender** conceded 35, named 2 as the owner's, and rebutted 0.
- **Both judges ruled that version 1 does not pass as is** (`passes_as_is: false`).
- **Judge 1** wrote that "the defender's concessions answer 26 of the 32 objections". That is its own count: 37 were raised. It required further design changes on A4, B5, B7, B8 and C10, and sent B6, C2 and C9 to the owner.
- **Judge 2:** "Every change the design needs is now named, but the design cannot pass as is." It required further changes on B5 and C5, and sent B6, B7, B8, C2 and C9, plus B5's new field, to the owner.

**What changed between version 1 and version 2.** Every concession and every
judge's further requirement is now in §2–§4, cited by objection id. Where the
two judges differed:

- On A4, C5 and C10 one judge ruled answered and the other required more. Version 2 takes the stricter ruling each time: the CLI scorer identity (A4), no "above" in a prompt (C5), and the stall count re-sealed on a kill with no checkpoint (C10, B8).
- On B7 and B8, one judge required a design change and the other sent the point to the owner. Version 2 makes the design change and also puts the published part to the owner (§6).

**What the opponents could not break** (their own words, abridged):

- **A:** the unit boundary. "Within one unit, no question is asked after an accepted answer. I checked it on every path. … So the unit boundary is sound. The failures are in what a unit's questions depend on (A1-A5), not in where it ends." Also: `declared_offer`'s verdict on one word does not depend on the other words in its list.
- **B:** "I could not break the claim that the safe-point stop adds no cap." Also: in production the sealing key is persisted, so a sealed cursor survives restarts. And "a missing cursor falls back to today's code path."
- **C:** a batch cut short does not have to be replayed with the same members, because answers are keyed per line.

**What the debate found wrong in version 1's own Phase 1 reporting,** now corrected in §1:

- the 60- and 104-line "couplet" songs are 4-member groups (C4);
- `verify` needs the offers block for `forbidden_incumbent` too, not only `forbidden_modal` (A9).

### 5.3 Every objection and its ruling

The claim column is each objection's first sentence. The full objections,
evidence, answers and rulings, verbatim, are in
`quality/loop_redesign_phase1/debate_round1.json`.

| id | severity | § | claim | defender | judge 1 | judge 2 |
|---|---|---|---|---|---|---|
| A1 | blocking | 2.0 | The cursor leaves out the defer proposer's rejection history (`last_rej` / `last_grej`). | concede | answered | answered |
| A2 | major | 2.0 | `revise_loop` captures two things from the INPUT draft at entry, and the cursor stores neither: the input identity in `LoopResult`, and the pronunciation origin that coverage is judged against. | concede | answered | answered |
| A3 | major | 2.0 | Three more pieces of loop state are missing from the cursor's 'everything revise_loop keeps between lines'. | concede | answered | answered |
| A4 | major | 2.0.1 | The seal covers only the cursor and the journal digest. | concede | design must change | answered |
| A5 | major | 2.0 | Resuming in the middle of a batch makes the connector-visible `stale_answers` count, and the M-183 'state file was reused on an edited draft' warning, differ from a full replay. | concede | answered | answered |
| A6 | major | 2.0 | The per-call cost is understated. | concede | answered | answered |
| A7 | major | 2.1 | 'State bytes ... | concede | answered | answered |
| A8 | blocking | 2.6 | 'forbidden_modal is exactly that head, filtered through declared_offer' holds only when the place's relation is `_explicit`. | concede | answered | answered |
| A9 | major | 2.6 | The premise that verify needs offers only for `forbidden_modal` is false. | concede | answered | answered |
| A10 | minor | 2.0.1 | 'its existing server secret (CHAT_SECRET / CHAT_SECRET_FILE)' is not the connector's secret. | concede | answered | answered |
| A11 | minor | 2.0 | The design does not say whether the cursor applies to the checkpoint (model-writer) journal. | concede | answered | answered |
| B1 | blocking | 2.0.1 | The seal does not cover enough of the state to keep today's guarantee. | concede | answered | answered |
| B2 | blocking | 2.3 | Recording a killed revise as an interrupted operation is a change to the connector contract, and it reverses a recent, tested decision. | concede | answered | answered |
| B3 | major | 2.3 / 2.7 | Under the session change, any kill before the first checkpoint of the killed operation would lose the run, which is worse than today. | concede | answered | answered |
| B4 | major | 2.0.1 | The design names one place where states are sealed, "when it returns a state". | concede | answered | answered |
| B5 | major | 2.0 / 2.0.1 / 2.7 | "Slower, never wrong" understates the fallback. | concede | design must change | design must change |
| B6 | major | 2.3(b) / 3 | The new harness outcome, "status: interrupted" with no question pending, needs an exit code and a connector branch, and the design specifies neither. | owner | owner question | owner question |
| B7 | major | 3 | 'What stays the same' leaves out two published statements that the design makes false. | concede | design must change | owner question |
| B8 | major | 2.7 / 2.3(b) | The livelock rule is not well defined, and it misses a livelock the design itself creates. | concede | design must change | owner question |
| B9 | major | 2.6 / 3 | The rule-3 equivalence is stated as one predicate, and as written it would loosen rule 3, which changes what a song is judged on. | concede | answered | answered |
| B10 | minor | 4.1 / 2.1 | The state-size cost is checked against the wrong ceiling and called "small" without a measurement. | concede | answered | answered |
| B11 | minor | 4.2 | Several tests cannot catch the failures that matter, or they depend on timing. | concede | answered | answered |
| B12 | minor | 2.3(b) | The stop threshold leaves no time to finish the call. | concede | answered | answered |
| C1 | blocking | 2.2 | 2.2 contradicts the invariant 2.0 rests on. | concede | answered | answered |
| C2 | major | 2.2 | Choosing members as independent does NOT keep member j's verdict the same when it is judged before member i's follow-up. | concede | owner question | owner question |
| C3 | major | 2.7 | 'A 100-line song with a declared relation fits a call: one grade in about 4.4 minutes' does not follow from the figures. | concede | answered | answered |
| C4 | major | 2.7 | The long-song measurements never touch the batch path that 2.2 and 2.5 change, and the design never estimates how many calls a 100-line song needs. | concede | answered | answered |
| C5 | major | 2.4 | One-move menus are empty, or repeat what was already shown, on exactly the long-song paths. | concede | answered | design must change |
| C6 | major | 2.4 | Gating menus behind safe points makes group-question bytes depend on the clock, and those bytes are part of the replay key. | concede | answered | answered |
| C7 | major | 2.5 | 2.5 proposes something that already exists. | concede | answered | answered |
| C8 | major | 2.2 | The cost of 2.2 is understated where it matters. | concede | answered | answered |
| C9 | major | 2.2 | The 'not applied' outcome has no representation that keeps T3 true without changing the connector's contract. | owner | owner question | owner question |
| C10 | major | 2.7 | The livelock report cannot be produced as specified. | concede | design must change | answered |
| C11 | major | 4.2 | T1 and T7 cannot fail on the old code, which breaks the plan's own rule that each test must fail on the old code and pass on the new (doctrine 48). | concede | answered | answered |
| C12 | major | 4.2 | No proposed test would fail if the owner's actual complaint stays unfixed. | concede | answered | answered |
| C13 | minor | 2.4 | The proposed label and the existing group prompt contradict each other once a pivot menu is printed. | concede | answered | answered |
| C14 | minor | 4.2 | T4 and T5 depend on timing. | concede | answered | answered |

### 5.4 Was round 1 passed?

**No.** (Round 2 passed: §5.5.)

- Every objection is either answered by a change now in version 2, or named as an owner question.
- Version 2 itself has not been put back to the judges.
- Under the rule the coordinator set (an owner decision stops work until it is answered), the next steps are, in order:
  1. the owner answers §6;
  2. version 3 records the answers;
  3. a second, shorter debate round checks version 3 against the code;
  4. only then the build (Phase 3).

### 5.5 Round 2: version 3 against the code

**How it ran.** Run 2026-10-02 as a Workflow (`loop-redesign-debate-r2`, run
`wf_2fb6dff8-cad`). It was told not to re-argue the owner's rulings.

- **Two opponents,** each told to refute from the code:
  - R: the cursor, the seal, fallback replay, safe points and exit 5;
  - S: option B, the menus, `verify`'s exactness, the tests, and whether every round-1 change was really in version 3.
- **One defender.**
- **Two independent judges.**

All five were read-only. The full record is in
`quality/loop_redesign_phase1/debate_round2.json`.

**The outcome.**

- **25 objections:** 1 blocking, 21 major, 3 minor.
- **5 round-1 ids** were reported as not fully carried into version 3: B4, B8, C10, A3, C11.
- **The defender conceded every one.**
- **Both judges ruled `passes_with_changes: true`, with no owner question.** Judge 1: "No ruling needs the owner. Every required change can be built and tested, so the design passes once the conceded and required changes are applied." Judge 2: "Each of these is buildable and testable, so version 3 passes once all conceded and required changes are applied."

Every conceded change, and every further change a judge required, is §2.8,
which binds over §2.0–§2.7. Where the judges differed, the stricter
requirement was taken:

- R7: store the rejection maps;
- R10: an explicit byte budget;
- S4: the separate budget, with dispositions reserved first;
- S8: the marker kept out of the disclosure;
- S1: one shared offer function.

**The debate is passed.** Phase 3 builds from version 4: version 3 plus §2.8.

| id | severity | claim | defender | judge 1 | judge 2 |
|---|---|---|---|---|---|
| R1 | blocking | The no-progress count cannot fire in the main stall cases. | concede | design must change | answered |
| R2 | major | A safe-point stop placed "before judging an answer" means the writer's answer never gets a published verdict. | concede | answered | answered |
| R3 | major | A fallback replay keeps `accepted_lines` at its furthest value and puts the cursor in its own fields. | concede | answered | answered |
| R4 | major | Version 3 routes exit 5 through the existing `other` branch, but that branch publishes only the last stdout checkpoint (`r.checkpoint`), never the state file the verb writes. | concede | answered | answered |
| R5 | major | The list of mint points misses one. | concede | answered | answered |
| R6 | major | One consumer mis-handles exit 5, and version 3's audit list leaves it out: the website chat's `carryState` in gemini_agent.js. | concede | answered | answered |
| R7 | major | The rebuild rule, "the latest (round, attempt) per line or member tuple, dropped if accepted", is not the rule the hooks apply, in two places. | concede | answered | design must change |
| R8 | major | The cursor table leaves out the in-progress round's `attempts` list, the LineAttempt records that become `RoundResult.attempts` when the round closes. | concede | answered | answered |
| R9 | major | "Materialized menu inputs (the offered and forbidden lists the question was rendered with)" is far less than the rendered question and the control flow read. | concede | answered | answered |
| R10 | major | Cursor bytes are admitted against the worker journal's own capacity. | concede | answered | design must change |
| R11 | major | `journal_digest` is undefined, and version 3 uses it for two things that cannot both hold. | concede | answered | answered |
| R12 | minor | The cursor carries "the running stale count". | concede | answered | answered |
| R13 | minor | "A kill that produced no new checkpoint leaves the session's previous sealed continuation in place" is false when the interruption is a server restart. | concede | answered | answered |
| R14 | minor | Session callers will not see the two new result fields on a finished run. | concede | answered | answered |
| S1 | major | The one menu §2.4 says it adds, the non-pivot member's one-move menu "computed by tier 1's own call (brief(target_lines={member}), declared_offer)", does not exist in the couplet case it claims to fix. | concede | design must change | design must change |
| S2 | major | Option B's four verdicts do not cover every way today's walk discards a batch answer. | concede | answered | answered |
| S3 | major | The new `not_applied` outcome row collides with the rejection history (`last_rej`) and with the coupling test. | concede | answered | answered |
| S4 | major | "Why pending is not stored" is false as designed. | concede | design must change | design must change |
| S5 | major | A `pending` answer's eventual verdict is never published. | concede | answered | answered |
| S6 | major | As specified, the no-progress count cannot fire in the case the owner approved it for, and T5's "three kills during the re-brief" case cannot pass. | concede | design must change | answered |
| S7 | major | The rule-3 branch list is not exactly today's behaviour. | concede | answered | answered |
| S8 | major | T2's invariant is false under option B. | concede | design must change | design must change |
| S9 | major | T8 cannot fail on the old code. | concede | answered | answered |
| S10 | major | The pivot's escalation menu, "reprinted from the cursor ... | concede | answered | answered |
| S11 | major | §2.4 puts one exact menu per escalated non-pivot member inside a single group question, and §2.3(b) forbids stopping "in the middle of building a question". | concede | answered | answered |
| B4 (round 1, reported missing from v3) | — | its round-1 change was not fully in version 3 | concede | answered | answered |
| B8 (round 1, reported missing from v3) | — | its round-1 change was not fully in version 3 | concede | design must change | answered |
| C10 (round 1, reported missing from v3) | — | its round-1 change was not fully in version 3 | concede | design must change | answered |
| A3 (round 1, reported missing from v3) | — | its round-1 change was not fully in version 3 | concede | answered | answered |
| C11 (round 1, reported missing from v3) | — | its round-1 change was not fully in version 3 | concede | answered | design must change |

---

## 6. Questions for the owner

Each of these changes what a song is judged on, or the connector's published
contract. The design cannot settle them. Each is answerable on its own. The
recommendation is mine, and the facts behind it are in the sections named.

**Q1. Batch answers: which order? (§2.2; objections C2, C8, C9)**

A writer who answers a batch of lines today gets a verdict only on the first
member before the next question. The rest show `unknown`.

- **A.** Judge every member before asking anything new.
  - Every answer gets a verdict at once.
  - But this can change which lines are accepted and the final draft, because lines the batch treats as independent can share a cross-line finding such as `ANAPHORA_OVERLOAD`.
  - On long songs the writer waits through about one call per member before the next question. That is an estimate from measured parts: at 60 lines one acceptance check took 574.7 s cold.
- **B.** Keep today's order and acceptance exactly. Report each member not yet judged as `pending: waiting on L<i>`, and one whose finding an earlier acceptance closed as `not_applied`, with the reason.

**Recommendation: B.** It answers the defect ("no verdict on each answer") with
a true statement for every answer, changes nothing about what is accepted, and
keeps today's speed.

**Q2. May `folded` publish new verdict values? (§2.2; objection C9)**

Under either option above, `pending` (B) and/or `not_applied` (A or B) would be
new values beside `accepted` / `rejected` / `unknown`.

- Each would be carried by an outcome with `accepted: null` and a `why` string.
- Without new values, the defect cannot be fixed honestly. The only alternatives are calling an unjudged answer `rejected`, which is false, or leaving it `unknown`.

**Q3. May the harness and connector publish a new exit code for "stopped at a safe point"? (§2.3b; objection B6)**

A call nearing its deadline would stop cleanly between steps instead of being
killed. It has no question to ask, so exit 4 ("answer this") is wrong for it.

- **Proposed:** exit 5, "STOPPED at a safe point — resumable; continue with no answer".
- It would be routed through the existing interrupted branch: status `interrupted`, sealed `state`, `run_id`, the existing continue-with-no-answer text for session callers.
- If no: the loop does not stop itself. It is killed as today, and a kill still keeps the run through the sealed cursor in the last checkpoint (§2.3c).

**Q4. May `lyric_revise` results publish a count of calls that made no progress? (§2.3d; objections B8, C10)**

When the same position is reached on two or more consecutive calls, the result
would carry `no_progress_calls: n`, the step in progress, the draft size, and
"this draft does not fit one call on this server".

- It is reported only. **The call is never refused**, so no limit is added.
- Without it, a 100-line song that cannot finish one step per call loops silently. Phase 1 measured one cold whole grade of the 104-line undeclared fixture at 1,307 s against a 600 s deadline.

**Q5. May `lyric_revise` results publish why a saved position was not used? (§2.0; objection B5)**

When a resume falls back to full replay, the result would name the reason:
`cursor_stripped: missing | seal | digest | run_key | key_unavailable`.

- Without it, a caller cannot tell a slow fallback replay from the fast path.

**Q6. May the published `lyric_revise` description change? (§3 item 4; objection B7)**

- **Today:** "Each call re-runs the loop from its record (deterministic, so the same questions arrive in the same order)."
- **Proposed:** "Each call resumes from its saved, sealed position, or replays its record when that position cannot be trusted; the same questions arrive in the same order either way."
- The forgery reasoning in the code (`mcp/lyric_tools.js:2423-2429`) would be restated to rest on the seal plus the replay fallback.
- This text is what callers rely on, so it is yours to change.

**Q7. The model-writer path, and the grader's wall (§2.0 scope; §2.7; objection A11; M-240)**

- (a) The saved position applies only to the interview (`defer:`) journal. The model-writer (kitchen) checkpoint journal keeps full replay and its published `resume_proof`. **Defects 1 and 3 remain on that path.** Is that acceptable for this change, with the model-writer path a separate item?
- (b) Even with every fix here, no 100-line continuation has yet been shown to fit one 600 s call. The grader is the wall:
  - one cold grade of the 104-line fixture took 1,307 s on the undeclared default, and 266 s under a declared relation;
  - the per-pair memo that makes re-grading cheap covers a whole draft only up to 91 lines (`PAIR_MEMO_CAP = 4_096`), and changing it is "a behaviour change with its own record" (M-240).

  Should this branch also take on sizing that memo to the draft? Or does that stay under M-240 as its own change?

### The owner's answers (2026-10-02)

The owner answered: *"Q1 B, Q2-Q6 yes, Q7a yes, 7b stays under M-240"*.

| question | answer | where it is now in the design |
|---|---|---|
| Q1 batch order | **B**: keep today's order, report every answer's standing | §2.2 |
| Q2 new `folded` verdicts | **yes**: `pending`, `not_applied` | §2.2, §3 item 1 |
| Q3 exit code 5 for a safe-point stop | **yes** | §2.3(b), §3 item 2 |
| Q4 `no_progress_calls` | **yes** | §2.3(d), §3 item 3 |
| Q5 `cursor_stripped` | **yes** | §2.0, §3 item 5 |
| Q6 the published `lyric_revise` description | **yes** | §3 item 4 |
| Q7a model-writer path keeps full replay | **yes** | §2.0 (scope) |
| Q7b size the per-pair memo in this branch | **no: it stays under M-240** | §2.7 |

