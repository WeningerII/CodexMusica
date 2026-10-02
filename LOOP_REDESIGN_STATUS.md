# Revise-loop redesign — status

Branch: `claude/revise-loop-redesign` (from `claude/practical-curie-n66u8c`, PR #460).
Last update: 2026-10-02. **The debate is passed.** Round 2 checked version 3
against the code. Both judges ruled that it passes once their changes are
applied, with no further owner question. The design is now **version 4**:
version 3 plus the binding amendments in `LOOP_REDESIGN.md` §2.8.
**Phase 3 (build) is starting.**

## Debate round 2 (2026-10-02)

- Run `wf_2fb6dff8-cad`: 2 opponents, 1 defender, 2 judges, read-only.
- **25 objections** (1 blocking, 21 major, 3 minor). Another 5 round-1 changes were not fully in version 3.
- **All were conceded.** Both judges: `passes_with_changes: true`, no owner question.
- Record: `lyric-harness/quality/loop_redesign_phase1/debate_round2.json`; summary in `LOOP_REDESIGN.md` §5.5.

The main round-2 changes:

- the rejection history is stored in the saved position, not rebuilt;
- the draft is never regressed when resuming mid-replay;
- the no-progress count is defined by position, on exit-5 and killed calls only;
- every batch answer the walk passes by gets a `not_applied` record kept apart from `outcomes`, so nothing about acceptance or question text changes;
- `pending` is computed by the connector, so nothing is added to the journal;
- the cursor and the new records live in a separate byte budget, so every state that fits today still fits;
- the group menu reuses `brief()`'s own offer code;
- the test that proves the new path was taken uses an unpublished run-record count, not the published text.

## Pre-build measurement, so far

One continuation's parts, declared relation, alone on the box, 24 lines:

| part | cold | warm |
|---|---|---|
| re-brief | 25.8 s | 22.1 s |
| verify without menus | 22.5 s | 23.5 s |
| one exact menu for the next question | **197.6 s** | **160.5 s** |

That menu offered **0 words**. With replay and `verify`'s menus gone, building
the next question's menu is the largest part of a call. The 104- and 60-line
runs are in progress.

## OWNER'S ANSWERS (2026-10-02)

The owner answered: *"Q1 B, Q2-Q6 yes, Q7a yes, 7b stays under M-240"*.

- **Q1, batch answers:** option B. Keep today's order and acceptance, and report every answer's standing.
- **Q2-Q6:** yes. That covers:
  - the new `folded` verdicts `pending` and `not_applied`;
  - exit code 5 for a safe-point stop;
  - the `no_progress_calls` and `cursor_stripped` result fields;
  - the new `lyric_revise` description.
- **Q7a:** yes. The model-writer path keeps full replay for now.
- **Q7b:** the per-pair memo stays under M-240, not this branch.

All are recorded in `lyric-harness/quality/LOOP_REDESIGN.md` §6, and each lands
in the section it names.

## Current phase

**Phase 2: design and debate.** No production code has changed.

- The design is at **version 2**: `lyric-harness/quality/LOOP_REDESIGN.md`. It takes in every change from the debate's first round, and §5 records the debate.
- The debate ran 2026-10-02 (Workflow `loop-redesign-debate`, run `wf_57ba5db3-882`): 3 opponents, 1 defender, 2 judges, all read-only and checking against the code.
- **37 objections** (5 blocking, 25 major, 7 minor). The defender conceded 35 and named 2 as the owner's.
- **Both judges ruled that version 1 does not pass as is.** Every objection is now either answered by a change in version 2 or named as an owner question.
- The full record is in `lyric-harness/quality/loop_redesign_phase1/debate_round1.json`.

**What the debate changed most:**

- The saved position (the "cursor") needed more state than version 1 listed:
  - the rejection history that question bytes depend on;
  - the input draft's ownership of declared pronunciations;
  - the round's `judged_open`;
  - the whole-draft repair phase;
  - batch staleness;
  - already-judged verdicts, so they are never re-verified.
- The seal must cover the whole state, not only the cursor. On the CLI, the cursor is bound to the run's inputs and the scorer's identity.
- Version 1 marked killed calls as interrupted operations. That is **withdrawn**: it changed a tested contract. A killed call now keeps the run through the sealed position in its last checkpoint.
- **Withdrawn** as wrong: "batch order moves *when*, never *whether*" (it can change which lines are accepted, hence Q1); "a 100-line declared song fits a call" (not shown); and §2.5's batch-size fix (it already exists since `c91bca12`).
- **Corrected in my own Phase 1 report:** the 60- and 104-line "couplet" songs were really 4-member groups, because the scheme letters past Z were case-folded. The growth finding stands.

**What the debate could not break:**

- the unit boundary the saved position rests on (within one line's work, no question follows an acceptance);
- that `verify` can skip its unread offer menus with rule 3 kept exactly;
- that the safe-point stop adds no cap.

## After the owner answers

1. Version 3 of the design records the answers.
2. A second, shorter debate round checks version 3 against the code.
3. The pre-build measurements in `LOOP_REDESIGN.md` §4.3 run: state bytes, one full 104-line continuation, one menu at 60/104 lines, genuine couplet curves.
4. Only then Phase 3, the build.

## What I did (Phase 1)

- Read `lyric-harness/CLAUDE.md` (the five standing rules, the loop section,
  test discipline) and the song-run reports on `claude/songrun-20-ballad` and
  `claude/songrun-40-soul`. I found no reports for the 60, 80 or 100-line runs
  on any remote branch. A pointer to them would help.
- Mapped the harness `defer:` protocol and the connector's `lyric_revise`
  path, with file:line references.
- Staged the runtime locally and reproduced each defect through a real verb or
  through the real connector and session code.
- Committed the measurement scripts, with a README, in
  `lyric-harness/quality/loop_redesign_phase1/`. None of them produced a song.

## The four defects: all reproduced

1. **Replay growth: REPRODUCED.** Each continuation re-runs the loop from
   round 1 and replays every answer on record. On one state with 27 answers,
   replaying alone took **47.0 s** of a **49.8 s** continuation, about 94% of
   the call. Per-call times are in the table below.
2. **No verdict on batch answers: REPRODUCED.** I ran `revise` on a 4-line
   AABB draft under the connector's defaults (`--attempts=1 --backtrack=1`),
   which asked L2 and L4 as one batch. L2 got its verdict. L4's answer, a word
   from L4's own OFFERED list, got none: the loop moved straight to a group
   question about L1+L2. The connector's own `foldedOf` renders L4 as
   `unknown` / `unverified`.
3. **Killed continuations: REPRODUCED** through the real session layer, with a
   10 s and a 12 s tool budget on a 3-line song. After the kill:
   - the operation reads `completed` with `resumable: false`;
   - `resume_operation` refuses with `RESUME_NOT_INTERRUPTED`;
   - re-sending the same answer is refused ("`state` holds no pending
     question");
   - the no-answer continuation is killed again at the same budget, because
     the kill also kills the warm worker.
4. **Empty group menus: REPRODUCED.** On a 2-line couplet, L2's line question
   offered 4 words. One call later, after a rejected answer, the group question
   printed `(none offered)` for both lines. The code records this as a
   deliberate choice (M-205); the owner has since named it a defect.

## Long drafts: what I measured

### One whole-draft grade (`song`, cold) on the planner fixture drafts

| lines | time | report size |
|---|---|---|
| 24 | 97.8 s | 517,529 B |
| 60 | 324.8 s | 1,627,839 B |
| 104 | **1,307.3 s** | 4,032,610 B, just under the connector's 4 MiB output cap |

The fixture is built the way `mcp/test.mjs` builds it, and is a worst case:
nearly every line is open, and no relation is declared, so every group is
judged against the whole relation vocabulary.

### The first deferred `finish` call on the 24-line fixture

It ran at least **31 min 42 s** and never asked its first question. The last
checkpoint it wrote was round 1, `grading`. By the profile, it was building
offer menus for every line in the first batch. It was stopped by my session's
time limit. I did not run it at 60 or 104 lines.

### Replay curves on pasted songs

(Corrected after the debate: the 24-line song is real couplets. The 60- and
104-line songs are 4-member groups, because their scheme letters ran past Z
and were case-folded. The growth stands.)

Connector defaults, one relation declared (`class:RHYME`), one cold process
per call.

| lines | seconds per call, by answers on record |
|---|---|
| 24 | 53.1 (0) · 15.3 (12) · 56.1 (13) · 30.2 (24) · 35.4 (25) · 37.6 (26) · 43.9 (27) · 49.8 (28) · 51.1 (29) · 57.7 (30) · 65.2 (31) · 68.9 (32) |
| 60 | 50.0 (0) · 49.0 (1) · 95.9 (2) · 97.7 (3) · 171.8 (4) · 173.0 (5) |
| 104 | 88.6 (0) · 82.7 (1) · 210.0 (2) · 220.6 (3) · 407.0 (4) · 373.9 (5) |

On the 60-line song, each group answer adds about 70 s to every later call.

### One line's acceptance check (`tryline`, which is the loop's `verify`), 24-line fixture

| run | time |
|---|---|
| cold | 424.8 s |
| warm, same process, same line | 261.1 s |
| warm, same process, another line | **1,832.4 s** |

A 60-second profile of the warm call puts **100% of samples** under `verify` →
`brief(target_lines=…)` → `declared_offer` → `grade`. In other words, `verify`
builds and grades the changed line's whole offer menu. Its rule 3 then reads
one fact from that menu: whether the new word is on the forbidden list.

To price this, I ran the same `tryline` sequence with `verify`'s internal
brief asked for no offers. This was an in-process patch for measurement only,
and it skips rule 3, so it gives a lower bound rather than a replacement:

| run | 24 lines | 60 lines |
|---|---|---|
| cold | 162.8 s | 574.7 s |
| warm, same line | 89.4 s | 376.0 s |
| warm, other line | 112.1 s | 432.1 s |

The verdicts were the same in all three. What remains is the whole-draft
re-inspection: 68% of it is in `relations.whole_vocabulary_pairs`.

I stopped the unpatched check at 60 and 104 lines: it would have taken hours,
and the 24-line rows already settle the question. The menu-free check at 104
lines is still running.

**Declared relation against the default, measured.** The same 104-line
fixture draft, same groups and returns, graded once on the undeclared default
and once under `--relation=class:RHYME`:

| lines | undeclared default | declared `class:RHYME` |
|---|---|---|
| 24 | 97.8 s | 35.0 s |
| 104 | 1,307.3 s | **266.1 s** |

So on this box a 100-line song with a declared relation fits a call, and one
on the undeclared default does not. The declared 104-line report was
4,167,870 bytes, 26,434 under the connector's 4 MiB output cap.

