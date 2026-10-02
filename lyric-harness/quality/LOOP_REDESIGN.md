# The revise loop, redesigned for long songs

Status: **DRAFT — Phase 2, before the debate.** Nothing here is built yet.
Written 2026-10-02 on branch `claude/revise-loop-redesign`.

The owner's words: *"the biggest problem is 100+ line songs"*, and *"a new
revise loop requires a debate workflow for verification, not song runs"*.

This file has five parts:

1. what was measured before anything was designed;
2. the design: one central change and four fixes;
3. what stays the same;
4. what it costs, and the tests that must fail on the old code and pass on the new;
5. the debate's record.

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

**Replay curves at three lengths.** These use pasted couplet songs, which
declare one relation (`class:RHYME`), under connector defaults, one cold
process per call:

| lines | seconds per call (answers on record) |
|---|---|
| 24 | 53.1 (0) · 15.3 (12) · 56.1 (13) · 30.2 (24) · 35.4 (25) · 37.6 (26) · 43.9 (27) · 49.8 (28) · 51.1 (29) · 57.7 (30) · 65.2 (31) · 68.9 (32) |
| 60 | 50.0 (0) · 49.0 (1) · 95.9 (2) · 97.7 (3) · 171.8 (4) · 173.0 (5) |
| 104 | 88.6 (0) · 82.7 (1) · 210.0 (2) |

Each group answer on the 60-line song adds about 70 s to every later call.
The one recorded on the 104-line song added about 127 s. These ran
concurrently with other measurements on 4 cores, so the absolute seconds run
high. The growth is the finding.

**What one acceptance check costs.** `tryline` runs exactly the loop's
`verify`. It was timed three times in one process: cold, then warm on the same
line, then warm on another line.

| run | 24 lines | 60 lines | 104 lines |
|---|---|---|---|
| `verify` as it is, cold | 424.8 s | (running) | (running) |
| as it is, warm, same line | 261.1 s | (running) | (running) |
| without the offer menus*, cold | 162.8 s | 574.7 s | (running) |
| without the offer menus*, warm, same line | 89.4 s | (running) | (running) |
| without the offer menus*, warm, other line | 112.1 s | (running) | (running) |

\* A measurement-only, in-process patch: `verify`'s internal
`brief(target_lines=…)` was asked for no offers. That also skips rule 3's
modal check, so these rows are a lower bound, not a replacement. The verdict
was the same as `verify`'s in every row measured.

A 60-second profile of the warm unpatched check puts **100% of samples** under
`verify` → `brief(target_lines=…)` → `declared_offer` → `grade`.

`verify` builds and grades the changed line's whole offer menu. It then reads
three fields from that brief: `slot`, `forbidden_incumbent`, and
`forbidden_modal`. Only the last needs the menu, and rule 3 asks one question
of it: is the new word on it (`revise.py` around `verify`, `modal_hits` /
`modal_kept`).

With the menus gone, what remains is the whole-draft re-inspection. 68% of its
samples are in `relations.whole_vocabulary_pairs`. That is the
undeclared-relation path, which judges each group against every relation.

**Why warm barely helps past about 90 lines.** The per-pair memo that makes a
one-line re-grade cheap holds `PAIR_MEMO_CAP = 4_096` rows per schema slot.
Its own comment says that covers a whole draft only up to **91 lines**. The
edge memo is switched off past the same size (`relations.py`, the per-pair
memo). The comment files the scaling question under M-240, which is open.

---

## 2. The design

### 2.0 The one change everything else rests on: resume from a saved position, not by replay

Today a deferred run's state is a **journal**: the input draft and every answer
ever given. A continuation re-runs `revise_loop` from round 1 on the input
draft and replays every answer, re-verifying each, to rebuild the loop's
position.

The redesign adds the **position** to the state, as a field called `cursor`. A
continuation then starts where the last call stopped.

The journal stays, complete, for audit and for the fallback below.

**What the cursor holds.** This is everything `revise_loop` keeps between
lines, read off `quality/loop.py`:

- `draft`: the draft as the loop now holds it, with its fingerprint.
- `round`, plus the **pass**: the line numbers of this round's pass, in the order the round opened with. The pass is computed once at round open, on the round-opening draft, so it must be stored rather than re-derived.
- `at`: the index in the pass of the line whose work is in progress (its "unit").
- `unit_draft`: the draft when that unit started.
- the round's own bookkeeping: `touched`, `fixed_this_round`, `resolved_elsewhere`, the `LineAttempt`s so far.
- the finished rounds (`RoundResult`s) and the barren-round counter, because `_close` and the `no_progress` stop read them.
- `journal_digest`: a hash of the journal prefix the cursor was taken against, so a cursor cannot be paired with a different journal.

Things the loop also holds but that are *re-derived* rather than stored,
because each is a pure function of the draft and the mandate:

- the round's `briefs`;
- `whole` (the whole-draft findings);
- `brief_lines` / `latest_open`.

The loop already re-derives all of these whenever the draft has moved
(the M-210 re-brief).

**What a continuation does with it.**

1. Re-brief `unit_draft`.
2. Enter the round at `at`.
3. Re-run only the unit in progress. Inside the unit, the deferred proposer still answers from the journal, but the only answers it is asked for are this unit's own:
   - its tier-1 attempts;
   - its tier-2 walk, which is bounded by `backtrack_width`.

   Answers to earlier lines are never looked up. Their effect is already in `draft`, and their records are already in the round's history.

A continuation's cost becomes:

- one brief of the current draft;
- the current unit's bounded replay;
- the verification of the new answer(s);
- building the next question.

None of that grows with the number of answers on record.

**Why a unit, and not a finer position.** Inside a unit the loop is nested
(`_try_tier1`'s attempt loop, `_try_tier2`'s pivot walk). Storing a position
inside those would mean rewriting both as resumable state machines. A unit's
replay is already bounded by the declared budget (`attempts_per_line` and
`backtrack_width`), so it does not grow with the song. A rejected answer does
not move the draft, so re-running a unit from `unit_draft` reaches the same
place.

**The claim this rests on: within one unit, no question is asked after an
accepted answer.** `_try_tier1` returns on its first acceptance
(`loop.py:1151`). `_try_tier2` returns on its first acceptance (`:1459`,
`:1601`, `:1676`). The unit's only two-tier sequences continue after a
*non*-acceptance:

- tier 1, then the escalation to tier 2;
- tier 2 first, then the fall-through to tier 1.

So every question inside a unit is asked against `unit_draft`, and the unit
ends at its first acceptance.

**The fallback is today's behaviour.** A state with no cursor is replayed from
round 1, exactly as now. That covers:

- legacy states;
- a cursor whose `journal_digest` does not match;
- a connector state whose seal fails (§2.0.1).

So old states keep working, and full replay remains the audit: anyone can
still replay a journal from the input draft and must reach the same result.

**The equivalence this rests on, and the test that holds it.** Resuming from a
cursor must reach exactly what a full replay of the same journal reaches:

- the same questions, byte for byte;
- the same verdicts;
- the same final `LoopResult`.

That is the main test (§4.2, T1). It is checked at every call boundary of
scripted runs, not only at the end.

#### 2.0.1 Who may hand in a cursor

Today the replay is the only authority over what was accepted. A forged
`accepted_lines` in a caller-held state changes nothing, because the replay
re-verifies every answer from the input draft.

A cursor is trusted, so it must not be forgeable where the caller holds the
state. `verify` enforces rules that a final grade alone does not; for example,
rule 3 rejects a line that *takes* a modal candidate word.

- **The CLI** (`--propose=defer:PATH`): the file is the user's own, as the defer state is today. The harness trusts the cursor it reads.
- **The connector**: the connector seals the cursor when it returns a state. It uses an HMAC with its existing server secret (`CHAT_SECRET` / `CHAT_SECRET_FILE`, `mcp/job_store.js`) over the cursor and the journal digest. When a state comes back in, the connector checks the seal:
  - **valid seal**: the cursor is passed to the harness;
  - **missing or wrong seal**: the connector strips the cursor, and the harness falls back to full replay. That is slower, never wrong.

  Session callers never see the state, so their cursors are always sealed by the same server. A server restart with a fresh random secret only costs one slow replay.

### 2.1 Defect 1 (replay growth): fixed by 2.0

No further change. State bytes still grow with the journal, by the answer
text and its outcome. That growth is linear and small next to the question
text the state already carries.

### 2.2 Defect 2 (batch answers with no verdict): judge every member's answer before asking anything new

**Today.** A batch member is judged only when the loop's walk reaches it.
Under one attempt per line, a rejected earlier member escalates to a group
question immediately, and the call suspends on that question before later
members are judged. A member whose finding an earlier acceptance closed is
never judged at all (`resolved_elsewhere`).

**Change.** When a batch answer is folded, every member's first answer is
judged before anything else is asked:

1. Members are judged in pass order.
2. Each is judged against the draft as the members before it left it, with accepted members applied.

Then the walk returns to the first member that needs a follow-up (a re-ask, or
the tier-2 escalation) and continues as today.

A member whose finding was closed by an earlier member's accepted line gets a
recorded outcome: not applied, and why. It is not left "unknown".

**Why this is safe.**

- Batch members are chosen to be independent (`prefetch` / `_related`: no member's groups, return classes or first rhyme partner touch another's).
- Every acceptance is still a whole-draft `verify` against the draft as it stands.

So the change moves *when* a member is judged, never *whether a wrong line can
be accepted*.

**What changes for the writer.**

- Every answer in a batch comes back with a verdict.
- Follow-up questions for rejected members come after all the verdicts, not in between.

**What it costs.** One `verify` per member, in the same call. On a long song,
a large batch could take longer than one call's deadline. §2.3's safe-point
stop covers this: the state is saved after each judged member.

### 2.3 Defect 3 (killed continuations): stop cleanly before the deadline, and make a kill recoverable

Three parts.

**(a) Per-call cost no longer grows (2.0).** The self-reinforcing kill is
gone: a retry after a kill costs about what the killed call cost, not more.

**(b) The loop stops itself at a safe point.** The harness already receives
its deadline as `LYRIC_REQUEST_DEADLINE_MS` (`mcp/python_bridge.js`), but only
the kitchen's Gemini proposer reads it.

The loop will check it at **safe points**:

- after each judged answer;
- before building each question's menu;
- before adding each member to a batch.

It stops when the time left is shorter than the longest single step it has
taken so far in this call. That threshold is measured in-process, not a
declared number.

On stopping, it writes the state (cursor and journal) and returns
`status: "interrupted"` with the same "continue with no answer" instruction
the connector already gives.

A batch being assembled when the deadline nears is asked with the members
built so far. The code already allows that today, when the journal reaches
capacity: the omitted members are asked later. Replay does not need to
reproduce the batch's makeup, because answers are keyed per line.

**(c) A kill that still happens loses at most the step in progress.**

- The harness emits a resumable checkpoint (cursor and journal) after every judged answer. Today's interview checkpoint carries no position.
- The connector already returns the last checkpoint as `state` on a kill. With a cursor in it, the no-answer continuation resumes cheaply.
- The session layer records such a result as an interrupted operation (`resumable: true`), not `completed`, so `resume_operation` works.
- `get_operation`'s own description already promises this ("interrupted: when resumable is true, call resume_operation"). Today's behaviour breaks that promise; the fix makes the description true.

**Re-sending an answer the server already holds** stays a refusal. The
refusal text changes to name what happened: the answer is on record, with its
verdict, so continue with no answer.

### 2.4 Defect 4 (empty group menus): offer each member the words that answer the group if the others stay

**Today.** A group question's menus are searched only against a member's
*other* groups (`_try_tier2`: `joint_field(other_calls)` for the pivot,
`joint_field(m_other)` for each anchor).

A word bound by one group, which is every plain couplet, has no other groups.
So nothing is searched and the menu is empty. M-205 recorded this as
deliberate: the pivot "may take ANY word".

**Change.** Where a member's coupled menu is empty, the question also prints
that member's **one-move menu**: the words at its bound place that answer
every group bound there *while every other member keeps its current word*.

This is exactly tier 1's OFFERED list. It is computed by the same call
(`brief(target_lines={member})`, `declared_offer`, the same judge the verdict
uses), and it is labelled for what it is: "if L1 keeps 'stove', L2 could end
on: …".

**Why this is honest.**

- Every word in a one-move menu is already verified to answer the group with the others held.
- `verify` still judges whatever comes back.
- Nothing is invented, and no coupled search is claimed that was not run.
- The M-205 sentence stays true; the brief now also says what single-member moves exist.

**What it costs.** One exact brief per member whose coupled menu is empty: for
a couplet, two menus. This is the same cost as asking each member a tier-1
question. Each menu is built only if a safe point (2.3b) allows it.

**What it does not do.** It does not search coupled pairs for a free pivot
(new words for *both* lines at once). That search has no bound in the code
today, and adding one would be a new limit. It is named here as not done.

### 2.5 (Separate, and put to the debate) the size of a batch question on a long song

This is not one of the four defects, but it is the next long-song wall:

- in Phase 1, a 12-line batch question was 103,921 bytes;
- song run B's 15-line batch was 264,759 characters, too large for the client to display.

Each member's brief repeats the whole draft, every whole-draft finding, and
the grader's rules.

**Change.** A batch question prints the shared blocks once, then each member's
own block. This is rendering only: the same facts, once.

Whether this belongs in this change or in its own is a question for the
debate.

### 2.6 (Found in Phase 1) `verify` stops building offer menus it does not read

**Today.** `Reviser.verify` calls `self.brief(before, …, target_lines=changed)`
with the default `include_offers=True`. That builds the changed line's whole
candidate field (`joint_field_screened`) and grades every offered and every
forbidden word through `declared_offer`. It does this to learn three things:

- the line's `slot`;
- its `forbidden_incumbent`, a word read off the line;
- whether the new bound word is in `forbidden_modal`.

Rule 3 rejects a revision that *takes* a modal candidate. Measured above, this
menu is about two-thirds of a warm acceptance check on the 24-line fixture
(261.1 s against 89.4 s).

**Change.** `verify` asks `brief` for no offers. It then answers rule 3 for the
one new word directly, with the same two steps the field takes:

1. Is the word in the raw modal head of these call words? (`joint_field_screened`'s forbidden split, on the same calls and exclusion.)
2. If so, does it pass `declared_offer` for this place, on its own?

`forbidden_modal` is exactly that head, filtered through `declared_offer`. So
"word ∈ forbidden_modal" and "word ∈ head and the word passes `declared_offer`
alone" are the same predicate. One difference has to be checked: whether
`declared_offer`'s per-word verdict can depend on the other words in its input
list. If it can (it carries a `limit` and a baseline computed once), this
equivalence fails. The debate must settle that from the code, and the build
pins it by test.

**Test (T8).** Over every draft and revision pair in `quality/test_revise.py` /
`test_loop.py` / `test_verbs.py` that reaches `verify`, plus the Phase 1
fixtures, the new `verify` returns the same dict as the old one, key for key,
including `reasons` text and `modal_endword_unchanged`. A mutant that drops
the rule 3 check must fail it.

**What it does not change.** What is accepted. Rule 3 still rejects exactly
what it rejects today.

### 2.7 (Found in Phase 1) The floor this design does not remove, stated plainly

After 2.0 and 2.6, a continuation still pays:

- one whole-draft re-inspection per answer it judges;
- one exact menu for the question it asks next.

On the fixture drafts, a cold whole grade costs 97.8 s at 24 lines, 324.8 s at
60, and **1,307.3 s at 104**. A cold acceptance check without menus costs
162.8 s at 24 and 574.7 s at 60.

**So at about 100 lines, on this box, a call that starts cold cannot judge even
one answer inside a 600 s deadline.** Warm calls are cheaper only while the
per-pair memo holds the draft, which is up to 91 lines.

Two ways through, neither in this design without a ruling:

1. **Size the per-pair memo to the draft** instead of the fixed
   `PAIR_MEMO_CAP = 4_096`. The bound would be derived (rows ≥ the draft's
   pair count), not removed. Memory cost would be measured first. Its comment
   says changing it "is a behaviour change with its own record". It belongs to
   M-240, and to the owner.
2. **Make the whole-draft re-inspection incremental**: recompute only the
   findings a changed line can reach. That is the grader's own work (M-240),
   not the loop's.

**What 2.3(b)'s safe points can and cannot do here.**

- They stop a call *between* steps.
- They cannot stop one *inside* a single verification.
- A fresh call has no measured step yet, so it starts its first verification.

If that one verification takes longer than the whole deadline, the call is
killed mid-step. The kill takes the warm worker and its memos, so the next call
is cold again and the same thing happens. **That is a livelock, not slow
progress.**

The design must not hide this. When a run is stopped twice at the same cursor
with no step completed, the state says so: `status: "interrupted"` plus
`no_step_completed: true`, naming the step and the draft size. A caller is told
that this draft does not fit one call on this server. A third identical
attempt is never presented as progress.

**Where the line falls, measured.** The same 104-line fixture draft was graded
twice. Only the relation differed: the plan's groups and returns are
identical with and without `--relation=class:RHYME`, which was checked.

| lines | undeclared default (every relation) | declared `class:RHYME` |
|---|---|---|
| 24 | 97.8 s | 35.0 s |
| 104 | 1,307.3 s | **266.1 s** |

The declared runs shared the 4 cores with three other measurements; the
undeclared 104-line run shared them with two. So the gap is, if anything,
understated.

The planner draws no relation (the N-relation model, 2026-09-22), so a planned
song judged on the default pays the left-hand column. So on this box, with
this design:

- a 100-line song **with a declared relation** fits a call: one grade in about
  4.4 minutes;
- a 100-line song on the **undeclared default** does not, until M-240 brings
  that grade under the deadline or the deadline changes.

A second wall sits beside it. The declared 104-line report was 4,167,870
bytes, which is 26,434 bytes under the connector's 4 MiB `MAX_OUTPUT_BYTES`.
M-240's note 5 already records that a report grows with the square of the
line count. A slightly longer song meets the output cap even when the time
fits.

Whether the default should cost less is the grader's question and the owner's,
not the loop's. Nothing here changes what the default judges.

This file says that rather than claim the loop is fixed for every 100-line
song.

---

## 3. What stays the same

- **What a song is judged on.** No check is added, removed or loosened:
  - `verify` decides every acceptance, exactly as now;
  - the stop conditions are the same;
  - `MANDATORY_PURSUE` is the same;
  - the final grade is the same.
- **The bound-word rule (M-317)** and every relation judgment.
- **The writer contracts** `propose(...)` and `propose_group(...)`, and the answer formats (`L<n>: text`).
- **The journal.** It stays complete and replayable from the input draft. Full replay remains both the fallback and the audit.
- **The connector's tool arguments and result fields.** `state`, `answers`, `run_id`, `run_revision`, `recover_only` and `new_run` keep their meanings. The changes add a field inside the state, populate `folded` verdicts that were `unknown`, and make an interrupted run resumable as `get_operation` already says it is.
- **No cap or limit is added.**
  - The safe-point stop reads the deadline the connector already sets.
  - The one-move menus use the same offer machinery tier 1 uses, with no new bound.
- **Standing rule 1.** Nothing here touches the recipe engine.

## 4. Costs and tests

### 4.1 Costs

- **State bytes:** the cursor adds the current draft, the pass list and the round history (`LineAttempt` summaries). It is measured in Phase 3 against the 448 KiB journal ceiling.
- **Per-call time:** no longer depends on answers on record (2.0). A batch answer costs one `verify` per member (2.2). A group question costs up to one exact brief per member (2.4).
- **Code:**
  - `quality/loop.py`: the cursor, the resume entry point, batch-first judging, safe points;
  - `lyric_harness.py`: `_defer_proposer` (cursor in and out, the resumable checkpoint);
  - `quality/propose.py`: one-move menus, and 2.5 if kept;
  - `mcp/lyric_tools.js`, `mcp/workflow_sessions.js`: the seal, interrupted-as-resumable.

### 4.2 Tests (each must fail on the old code and pass on the new)

- **T1 — resume equals replay.** Scripted runs (pasted couplets, the planner fixture at 24 lines, groups and batches present) are driven call by call twice: once resuming from the cursor, once with the cursor stripped (full replay). Every question's bytes, every outcome and the final `LoopResult` must be identical.
- **T2 — a continuation's cost does not grow.** On a fixed state, the number of `verify` calls a continuation makes is independent of answers on record. This is counted through the reviser, not timed. Old code: grows by one per answer. New code: constant.
- **T3 — every batch answer gets a verdict.** The AABB reproduction: after the batch answer, `outcomes` holds L2 and L4, and the connector's `folded` shows no `unknown` row.
- **T4 — a deadline stop is clean.** With `LYRIC_REQUEST_DEADLINE_MS` set near, the run stops at a safe point with a cursor. The no-answer continuation then finishes the same run T1 finishes.
- **T5 — a kill is resumable.** The session reproduction from 1.1:
  - the killed operation reads `interrupted` and `resumable: true`;
  - `resume_operation` succeeds;
  - the continuation is not killed again at the same budget.
- **T6 — group questions offer one-move menus.** The couplet reproduction: the group question lists L2's one-move words (the same 4 tier 1 offered) and L1's, each labelled.
- **T7 — the seal.** A connector state with an edited cursor falls back to full replay and reaches the same result. An unedited one resumes.

Plus the repo's own checks:

- `quality/suite_sweep.py --only` for `test_loop`, `test_revise`, `test_verbs`, `test_replay_memo`, `test_production_journal`;
- `node mcp/test.mjs` and the continuation suites (`test_run_continuation.mjs`, `test_deferred_continuation.mjs`, `test_continuation_audit.mjs`).

## 5. The debate

(Not yet run.)
