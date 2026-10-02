# Revise-loop redesign — status

Branch: `claude/revise-loop-redesign` (from `claude/practical-curie-n66u8c`, PR #460).
Last update: 2026-10-02, Phase 1 started.

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
