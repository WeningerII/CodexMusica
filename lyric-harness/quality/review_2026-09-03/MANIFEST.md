# Evidence pack — read everything here before forming a view

You are one of three independent reviewers. You have NOT been told what anyone
thinks is wrong. Form your own view from the evidence, from first principles.

## The question

The system is a songwriting harness (lyric-harness/) plus a connector (mcp/)
that lets a language model — the deployed model is gemini-3.1-flash-lite, on
Google's free tier, 15 requests per minute — write a song against a seeded
plan and drive it to a clean finish through a revision loop.

The owner's definition of done, verbatim: the program must be "completely
functional with no skips, no silent fallbacks, no stalls" — a song goes from a
seed to a finished draft at exit 0 end to end. The owner has also said that a
run taking two to three hours is unacceptable.

Answer, from the evidence alone:

1. What is actually wrong with how this pipeline gets a song from a seed to
   exit 0, if anything? Distinguish what is measured from what is inferred.
2. What should be done about it, in what order, and what would each change
   break or cost?
3. What is NOT wrong that someone might think is wrong?

Cite the evidence (file and line, or the row in a measurement) for every
claim. Where the evidence does not settle a point, say so rather than
guessing.

## Repository (read the code itself; paths are relative to /home/user/CodexMusica)

Harness (Python):
- lyric-harness/lyric_harness.py — the CLI: verbs plan / screen / finish / revise / verify / sweep; `_defer_proposer`, `_defer_state`, `screen_pairs`, `token_anchorability`, the `finish` handler (search for "if cmd == \"finish\"")
- lyric-harness/quality/loop.py — `revise_loop`, the two tiers, its module docstring on what layers are asked
- lyric-harness/quality/replay_memo.py — the process memo the loop uses
- lyric-harness/quality/revise.py — `Reviser.brief`, `Reviser.grade`, `Reviser.inspect`, `Reviser.verify`, `modal_head`, `_field`, `_field_one`, `_function_findings`
- lyric-harness/quality/propose.py — how a proposer answers
- lyric-harness/quality/brief_provenance.py — the ledger that decides whether a revised draft may be graded
- lyric-harness/quality/plan.py — `make_plan`, `fill_plan`, `brief_legend`, `schema_asks`, the joint gate
- lyric-harness/quality/relations.py — the 77 relation schemas and the pair judge
- lyric-harness/CLAUDE.md — the project's doctrines (numbered), read them
- lyric-harness/MISSING.md — the defect ledger; the entries indexed in missing_entry_index.txt are the ones about the loop, the connector, the battery and this week's fixes. Read M-155, M-158, M-159, M-160, M-161, M-162, M-163, M-164, M-165, M-166, M-167, M-168, M-171, M-183, M-200, M-201, M-205 through M-214 in full.
- lyric-harness/BACKLOG.md — "RULINGS WANTED" section (open owner decisions, incl. #21)

Connector (Node):
- mcp/lyric_tools.js — the lyric_* tools; how lyric_revise spawns the CLI; the warm worker section (search "THE WARM WORKER")
- mcp/worker.py — the warm harness process
- mcp/chat.js — the /chat endpoint: hops per turn (`maxSteps`), per-turn and daily dollar caps, tool timeout, rate limiting, 429 handling
- mcp/budget.js — TOOL_BUDGET_MS (600 000 ms)
- mcp/gemini_agent.js — model pricing table, DEFAULT_MODEL
- render.yaml — the deployment; GEMINI_MODEL pin; env
- scripts/flash_battery.mjs — the driver that runs the model through /chat for a battery round
- .github/workflows/flash-battery.yml — how a battery round is dispatched

Songs that have finished at exit 0 (five), with their finish logs:
- lyric-harness/songs/carry_the_weight.finish.log (seed 2003), frost_still.finish.log (6006), across_the_tide.finish.log (7009), before_the_ovens.finish.log (7039), before_i_did.finish.log (7045)
- lyric-harness/songs/drafts/*.state.json — the deferred-loop state files (a replay record of every answer given)
- These five were written by a Claude session driving the CLI directly, screening candidate words with `screen` before writing. They were NOT written by gemini-3.1-flash-lite and NOT through the connector. Wall time per song in that session, dominated by the writer's own thinking: roughly 10 to 90 minutes; the harness's own compute per song is in timing.txt.

## Measurements taken today (raw)

- evidence/timing.txt — wall times of `finish`, `screen`, `plan` calls, cold and warm in one process, including a genuine replay of a completed five-answer state. Read the two CORRECTION notes in it.
- evidence/profile_finish_before_i_did.txt — cProfile of one cold `finish`, cumulative, top 60.
- evidence/flash_battery_runs.txt — every flash-battery run ever made, with the commit message current at each run. Round 9 ran 151 minutes and did not reach exit 0; round 10 ran 22 minutes and ended on the free tier's rate limit. No round has run since 2026-08-29; the deployed connector is behind this branch.
- evidence/missing_entry_index.txt — line numbers of the relevant MISSING.md entries.
- evidence/at_preloop.txt — the 18-line draft the seed-7009 loop started from; evidence/t_at3.json — its completed state.

## Rules for your written answer

- First principles: do not assume any of the design choices in the code are
  necessary; ask what the songwriting task actually requires.
- Separate MEASURED from INFERRED from UNKNOWN, explicitly.
- Every claim cites evidence.
- End with a numbered list of concrete recommendations, each with: what it
  changes, what evidence says it matters, what it would break or cost, and how
  you would measure that it worked.
- Under 1500 words. Write it as a position paper another reviewer will
  challenge.
