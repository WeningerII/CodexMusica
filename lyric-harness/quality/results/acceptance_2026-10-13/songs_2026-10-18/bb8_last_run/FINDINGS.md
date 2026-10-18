# "Last Run": BB8's own song through hosted /mcp (2026-10-18, live df11e3b7)

John asked each of us to write our own unrelated song through the connector, and to share every
bug. BB8 wrote every line; the connector planned and graded. No model call, no Library job.
Session and operation ids are private (BB8's scratchpad).

## The journey

1. `begin_lyrics` (create) → `lyric_sweep` (lines 16, verse+chorus, wants uses/before/returns/group)
   → `lyric_screen` (12 candidate end words) → `lyric_plan` seed 4.
2. **I turned seed 4 down.** Each line was 24 beats long ("up to 46 syllables a line"), and the
   form was one 12-line verse followed by two back-to-back 2-line choruses. A real writer
   wouldn't write to that, so I re-swept in the same session. The session allowed it.
3. A sweep with `sections>=4`, `lines_per_section>=4` and `beats_per_line<=8` accepted 0 of 28
   seeds. A sweep with `beats_per_line<=8` alone accepted 1 of 28 (seed 23).
4. `lyric_plan` seed 23: V(6) C(2) C(2) V(6), 8/8 grouped 2+3+3, one bar a line, "up to 15
   syllables a line", hook on L7 with title "Last Run".
5. `lyric_grade` on the exact draft: exit 0, certified, 0 flags, 10 banned pairs, 81 notes.
6. `lyric_revise` (max_rounds 2): the first call was refused with "CREATION_DRAFT: the exact
   complete draft is required." Resent with the draft, it returned FINISHED, exit 0, SUCCESS
   after 0 rounds. `final_draft_sha256` 5abbca8f…, the same as the graded draft.

## Findings (each to be verified with the team before anyone fixes anything)

- **F1. The brief's line ceiling contradicts what the grader then notes.**
  - The brief: "up to 15 syllables a line". The plan's meter: 8/8 grouped 2+3+3, one bar per
    line, so a line has 3 group heads.
  - Every one of my 16 lines (13–15 syllables) got CROWDED, PROMINENCE_EXCEEDS_HEADS and
    PROMINENCE_CANNOT_ALIGN, all as notes. That's 48 of the 81 notes.
  - The brief never tells the writer that only about 3 stressed syllables fit a line. So a writer
    who follows it writes lines the grader says can't be set, and the song is still "finished
    clean".
- **F2. The short verdict doesn't say what wasn't checked.**
  - `blocking: []`, `notes: 81`. The full coverage has `setting: not_requested` and NO_SETTING
    on 16 of 16 lines ("which syllable sits on which pulse — not answered").
  - The short verdict says none of that. So "certified" here is rhyme, returns, sentencehood and
    the floor; not whether the song can be sung to its own meter.
- **F3. The grader notes the plan's own mandated chorus return as a defect.**
  - What it reported: REPEAT_ACROSS_GROUPS on L7/L9 and L8/L10 ("END ON THE SAME WORD and share
    no mandated group"), and NEAR_COLLISION on L8/L9, L7/L10 and L9/L10.
  - Why that's wrong: the plan itself declared RETURNS 7,9;8,10. Lines 9 and 10 are the returned
    chorus, which belongs to no group.
  - Root cause, traced on main at c110fe24: `quality/revise.py` around line 4272 builds
    `absorbed = {(i, j) for mg in merges for i, j, *_ in mg["edges"]}`. Only group merges are
    absorbed, never declared return pairs. A returned line that sits in no group is therefore
    reported as colliding with its own original.
- **F4. The planner's default meter makes ordinary song lines rare.** Only 1 of 28 seeds
  (3.6%) has ≤ 8 beats per line. Seed 4 drew 24 beats, 12 bars of 2/4 per line. The draw is
  uniform over the beats-per-line envelope [2, 200].
- **F5. The screen prints a score above the cut on pairs it says stand in no relation.**
  - Examples: "route ~ lamp 0.850 — no coarse relation — NO_RELATION … (theta_rhyme=0.75)", and
    the same 0.850 on many unrelated pairs.
  - A writer reads 0.850 > 0.75 as a near-pass. I haven't traced what the number is yet.
- **F6. Guidance gap on the first revise call.**
  - The description says "the session carries the run, its state … and the draft it opened on".
  - The first creation revise call still needs the draft, and the refusal names no next call.
- **Not a bug, recorded:** the revise loop asked no questions (0 rounds) while 9 MODAL_RHYME and
  1 HOMEOTELEUTON stand, because banned pairs are notes and hold no line open. In the straddle
  test the loop did ask about MODAL_RHYME notes, but only on lines another FLAG had already
  opened.

## Update, 17:40 UTC

**Second draft (`song_v2.txt`), after Jony's critique.** Jony said the hook line and the smells
line are strong, and that the rhyme was driving L2 ("between"), L12 ("nothing left to wait") and
L15 ("the town was great"). I rewrote those three lines myself.
- `lyric_grade` on the same plan: exit 0, certified, 9 banned pairs (10 before), 80 notes.
- `lyric_revise new_run: true`: FINISHED, exit 0, 0 rounds, `final_draft_sha256` 43187701….
- So starting again on a revised draft works as documented.

**Two songs now confirm F3 and F4.** Don's song (seed 5, 20 lines) shows the same chorus-return
notes (14 of them) and a 122-beat line. Jony, R2 and Don traced F3 independently. Don confirms F2
on his song too: NO_SETTING on 20 of 20 lines, with `blocking: []`.

**F1 is separate from F4.** The two songs fail in opposite directions:
- Don's plan: 122 beats a line, "up to 122 syllables" → SPARSE.
- Mine: 8 beats a line, 3 heads, "up to 15 syllables" → CROWDED.

The brief gives a syllable ceiling that isn't tied to the number of heads the grader measures
against. Fixing the draw alone won't fix F1.

**F5, root cause traced (display only):**
- The screen prints `best_score(...)["total"]`, the best span-similarity total, next to
  "theta_rhyme=0.75". The cut applies only per relation the pair stands in
  (`admitted_relations`, lyric_harness.py ~4050).
- "route ~ lamp" stands in no relation at all (NO_RELATION), so its 0.850 is never compared with
  any cut.
- `unadmitted_reason` (~4066) gives the same sentence ("none of the relations it stands in is in
  the declared admit set") for two different cases: a pair with no relation, and a pair whose
  relations are outside the admit set.
- No verdict is wrong; the display misleads.

## Follow-ups logged from the #584 review (18:55 UTC)

- **The NO_RELATION sentence (Don and Jony).** For a pair in no relation, the grader still says
  "none of the relations it stands in is in the declared admit set" (`unadmitted_reason`,
  lyric_harness.py ~4076). Beside #584's new "span similarity … (no relation, so no cut
  applies)" label, it reads as two voices disagreeing.
  - **Why it isn't in #584:** the reader v1 oracle pins CLI stdout byte for byte
    (`quality/test_reader.py`, `quality/fixtures/reader_v1_oracle.json`).
  - **The fix:** a separate change that re-captures the oracle deliberately and says so.
- **`lyric_check` keeps its full payload on every session surface.** `sessionView` leaves check
  (and verify) unchanged, so #584's `not_checked` and `notes_by_code` don't reach check. In the
  straddle test, check returned about 250 KB for 8 lines; Jony and 3PO report ~310 KB on the
  ChatGPT surface. This is the pasted-lyrics (edit) journey.
- **Optional wording (Jony):** "(no relation, so no cut applies — not a rhyme score)". It rides
  #584's next push if there is one.
- **Batch-member wording (found verifying #585, logged at R2's request).** In a batch question
  (L5 and L7 asked together), each member's brief still says "The tool applies your one answer to
  L5" and "1. ONE line back, and it replaces L5", although the batch is answered with `answers`
  for both lines.
  - **Why it happens:** the per-member render only learns that it's part of a batch through
    `question`, which #585 now passes, so a fix has a handle.
  - **Status:** a separate guidance change.

## Verification status (19:05 UTC)

- **Returns fix** (`claude/collision-reads-returns` @ 1082175d2): verified twice, independently.
  - BB8: the real "Last Run" draft plus an adversarial variant (`../verify_returns_1082175d/`).
  - Don: Don's own "Last Run". 8 REPEAT_ACROSS_GROUPS and 6 SCHEME_COLLISION go to 0, there are 14
    required echoes, and the real lap/map HOMEOTELEUTON still stands.
- **#585, edit-boundary brief** (@ 6a969eff1): verified by BB8 on the straddle draft
  (`../verify_585_6a969eff/`).
