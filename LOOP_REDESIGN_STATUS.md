# Revise-loop redesign — status

Branch: `claude/revise-loop-redesign` (from `claude/practical-curie-n66u8c`, PR #460).
Last update: 2026-10-02, Phase 1 in progress (3 of 4 defects reproduced).

## Current phase

**Phase 1 — verify.** No code changes yet.

## What I did

- Read `lyric-harness/CLAUDE.md` (the five standing rules, the loop section,
  test discipline) and the two song-run reports (`claude/songrun-20-ballad`,
  `claude/songrun-40-soul`). I did not find reports for the 60/80/100-line
  runs on any remote branch. If they exist somewhere else, a pointer would help.
- Mapped the code paths, with file:line references, for:
  - the harness `defer:` protocol: `lyric_harness.py` `_defer_proposer`,
    `quality/loop.py` `revise_loop`, `quality/replay_memo.py`;
  - the connector `lyric_revise`: `mcp/lyric_tools.js`, `python_bridge.js`,
    `workflow_sessions.js`, `client.js`, `run_store.js`.
- Staged the local runtime (`cmudict.dict`, the nltk wheels pinned in
  `mcp/requirements-runtime.txt`, `quality/fetch_data.py`). Built fixture
  drafts at 24, 60 and 104 lines the same way the connector's live test
  builds them (`plan --seed=1 --lines=N`, the fixture line bank, the
  declared returns honoured).

## What I measured so far

- **The first deferred `finish` call on the 24-line fixture draft, run cold
  on this box, had been running more than 11 minutes and was still in round
  1 when I took the profile.** A 60-second `py-spy` profile puts 100% of
  samples under `loop._materialize` → `Reviser.brief(target_lines=…)` →
  `Reviser.declared_offer` → `Reviser.grade`. In other words, the time goes
  into building the per-line offer menu, which grades each candidate word
  against the draft.
- The final timing is not in yet. It will be recorded here when the call
  returns.
- `song` (one whole-draft grade) on the fixture drafts: **24 lines 97.8 s,
  517,529 bytes of report; 60 lines 324.8 s, 1,627,839 bytes.** 104 lines
  is running.
- Pasted 24-line couplet song, deferred `revise` under the connector's
  defaults, answered mechanically by a scratch measurement driver (it never
  produced a song): first call 53.1 s with a 12-line batch question of
  103,921 bytes; later calls 15.3, 56.1, 30.2, 35.4, 37.6 s at 12, 13, 24,
  25, 26 answers on record.

## Defects reproduced so far (through real verbs or the real connector code)

- **Defect 2 (batch answers with no verdict): REPRODUCED.** `revise` on a
  4-line AABB draft (`--relation=class:RHYME --attempts=1 --backtrack=1`, the
  connector's defaults) asked L2 and L4 as one batch. I answered L2 with a
  miss and L4 with a word from its own OFFERED list. After the call, the state
  held both answers, but `outcomes` held only L2 (`rejected`, "nothing was
  fixed"), and the next question was a group question on L1+L2. The
  connector's own `foldedOf` (from `mcp/lyric_tools.js`), fed those two
  states, renders L4 as `verdict: "unknown", source: "unverified"`.
- **Defect 3 (killed continuations): REPRODUCED** through the real session
  layer (`buildWorkflowServer` + `WorkflowSessions` + the real worker), with
  a 10 s and a 12 s tool budget (`CHAT_TOOL_TIMEOUT_MS`) on a 3-line pasted
  song. When the answering call is killed: `exit_code -1`, the operation
  reads `status: completed, resumable: false`; `resume_operation` refuses
  with `RESUME_NOT_INTERRUPTED`; re-sending the same answer is refused with
  "`state` holds no pending question". A no-answer continuation is then
  killed again at the same budget: the kill also kills the warm worker, so
  the retry pays a cold start plus the full replay.
- **Defect 4 (empty group menus): REPRODUCED.** `revise` on a 2-line couplet
  (same flags). L2's line question offered 4 words (`tov, hargrove, alcove,
  mangrove`). After a rejected answer, the group question for L1+L2 printed
  `(none offered)` for the pivot and for L1. The code records this as a
  deliberate choice (M-205: a pivot bound by one group "may take ANY word").
  The owner has since named it a defect.
- **Defect 1 (replay growth):** being measured (below).

## What the code reading says (still to be confirmed by running it)

1. **Replay:** a continuation re-runs `revise_loop` from round 1 on the
   input draft and replays every recorded answer. Each replayed answer
   costs a whole-draft `verify`, which is two full `inspect`s. The replay
   memo lives in one process only, and a kill restarts the worker, which
   empties it.
2. **Batch verdicts:** a batch member's verdict exists only once the
   loop's linear walk reaches it. The call usually suspends on the next
   question before that happens.
3. **Killed continuations:** the bridge turns a kill into a normal tool
   result. The session layer then marks the operation `completed`, not
   `interrupted`, so `resume_operation` refuses it. The returned state is a
   checkpoint taken after the answer was folded in, so it has no pending
   question.
4. **Empty group menus:** the pivot and anchor menus in `_try_tier2` are
   searched only against a word's other groups. A word bound by one group
   (an ordinary couplet) gets no search at all.

## Next

Reproduce each defect through the real verb or the real connector code, then
measure time per call, state bytes and questions asked at 24, 60 and 104
lines.

## Open questions

None yet.
