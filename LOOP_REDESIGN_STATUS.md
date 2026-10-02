# Revise-loop redesign — status

Branch: `claude/revise-loop-redesign` (from `claude/practical-curie-n66u8c`, PR #460).
Last update: 2026-10-02, **Phase 1 closed; Phase 2 (the debate) starting.**
All four defects are reproduced and scaling is measured at 24, 60 and 104
lines. One supplementary figure is still running (the 104-line acceptance
check without menus). The debate does not depend on it.

## Current phase

**Phase 2 — design and debate.** No production code has changed.

A design draft is already written, marked pre-debate:
`lyric-harness/quality/LOOP_REDESIGN.md`. It is not built, and it will be
revised with the findings below before the debate runs.

## What I did

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

### Replay curves on pasted couplet songs

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

## What this changes in the design draft

- **Resume from a saved position** still removes the growth (defect 1).
- **But at 104 lines one cold whole grade alone is 1,307 s**, more than twice
  the 600 s call deadline. So the per-answer verification cost must come down
  too, or a long song cannot take even one answer per call. Two measured
  levers:
  1. `verify` should stop building offer menus it does not read. It needs a
     yes/no for one word. This must be exactly equivalent, pinned by a test
     that compares verdicts.
  2. The rest is the grader's own whole-draft cost. The per-pair memo that
     makes warm re-grading cheap holds 4,096 rows per schema, which its own
     comment says covers a whole draft **only up to 91 lines**. The edge memo
     switches off past the same size. That cost is the open M-240. The design
     will state this floor plainly at each length rather than claim to fix it.

## Next

1. `LOOP_REDESIGN.md` now carries all of the above, plus two new parts:
   - 2.6: `verify` stops building menus it does not read;
   - 2.7: the floor the design does not remove, including the livelock that
     one over-deadline verification causes.
2. **The debate workflow is running** (started 2026-10-02): three independent
   opponents (A: equivalence and correctness; B: trust, connector, kills and
   owner boundaries; C: batch, menus, size, and whether long songs are
   actually served), one defender, two independent judges. All are read-only.
   Every objection must be answered, or the design changes.
3. Record the debate's outcome in `LOOP_REDESIGN.md` §5, then build only if
   it passes.

## Open questions

None for the owner yet. One will likely come: whether the per-pair memo bound
(4,096 rows, set aside under M-240) may be sized to the draft. Changing it is
"a behaviour change with its own record". I will put it to the debate first.
