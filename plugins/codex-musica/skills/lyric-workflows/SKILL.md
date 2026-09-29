---
name: lyric-workflows
description: Use Codex Musica to plan, grade, check or revise song lyrics, including rhyme and meter checks and continuing interrupted lyric work. Use for new songwriting or supplied existing lyrics, separately from recording recipes and public-domain corpus maintenance.
---

Use the single Codex Musica MCP connection at `https://mcp.codexmusica.com/mcp` for both recipes and lyrics. Explicit user choices take priority over defaults.

## Begin the requested task

Call `begin_lyrics` with `phase: create` for a new song or `phase: edit` for existing lyrics supplied by the user. Preserve that choice throughout the session. You write every line — the complete draft and every answer the revise loop asks for; the service plans and grades and never writes lyrics for you. No lyric call makes a model call or spends money.

Every lyric tool except `lyric_types` (a lookup that answers at once) needs the latest `session_id` and submits a background operation. Read its `operation_id` with `get_operation`; respect `retry_after_seconds`. While pending, poll that operation instead of submitting the work again. A completed operation's content leads with the tool's own result blocks — present the song from them exactly — and ends with a receipt holding the `session_id` for the next step. A finished `lyric_grade` or `lyric_revise` carries a short verdict: its status fields, `blocking` (what stands, and each line a requested obligation could not be judged on) and a count of notes; read findings, the report, coverage or pronunciation options with `get_operation` and `detail`. The server holds workflow receipts, original replay input and continuation envelopes. Never manufacture or send state, checkpoint, workflow receipts or internal run IDs.

## New song

1. Translate the user's structural requirements into `lyric_sweep` predicates. Retain the declared form, line count, functions and wants; inspect accepted seeds in their returned order.
2. Screen candidate end words with `lyric_screen`. A refusal is not a successful screening.
3. Call `lyric_plan` with an accepted seed and the same structural requirements. Carry declared title and rhyme relation when supplied. Read the returned plan and writer brief; a refused plan does not authorize drafting.
4. Write the complete draft to that plan, preserving line counts, returns and section functions. Grade the exact draft with `lyric_grade` under the same declarations. The service restores omitted plan coordinates and refuses contradictory ones.
5. Call `lyric_revise` only after the exact draft has been graded. Keep the same session. Each suspended call asks one question: answer the requested lines through `answer` (one line) or `answers` (one `{line, text}` per asked line); continuation state stays on the service. Repeat until the loop reaches a stop condition.

## Existing lyrics and stops

For supplied lyrics, run the same steps a planned song gets: `lyric_recover` first (blank stanza breaks as empty entries, `[SECTION]` rows as they are) to read the rhyme groups and returns the text actually carries — it returns the sung `lines` its mandate is numbered over — then `lyric_check` with those lines and that mandate, then `lyric_revise` without a seed and with the same lines and mandate. Use `lyric_verify` to compare a specific before/after revision, understanding that unchanged defects can survive that comparison. Declare pronunciation assumptions when needed and preserve any refused coverage.

Read both the operation status and the underlying tool verdict. `completed` means the tool call returned. `certified`, requested-layer coverage, findings and the actual lyric stop describe its outcome (on a short verdict: `certified`, `status`, `blocking`, and `detail` for the rest). Do not replace them with an unconditional success claim. Present the returned song and section headers verbatim, with the actual qualification beside it.

If a revision is awaiting an answer, call `lyric_revise` with the latest session ID and `answer` or `answers`. If a run has stopped with open lines, no question is pending: rewrite those lines, grade the complete rewritten draft with `lyric_grade`, then call `lyric_revise` with that exact draft and `new_run: true`. For supplied lyrics (phase edit) there is no grade step: send the complete rewritten draft with the same declarations and `new_run: true`. The stopped run's own note says the same; an archived finished checkpoint is not a pending question.

For an interrupted operation, inspect `get_operation`. Call `resume_operation` only when `resumable` is true and continuing the requested work is appropriate. Otherwise its `accepted_draft` holds the accepted lines, `lyric_revise` with `recover_only: true` and that session ID exports its journal, and the `session_id` it returns continues the session from before the interruption (grade the draft you keep, then revise it with `new_run: true`). Changed scoring semantics refuse the old session: export it, then begin a new one. Report the limitation rather than retrying the lost work automatically. Follow `successor_id` when the operation has already advanced.

Session and operation IDs are private capabilities with bounded retention. Keep them out of the song and user-facing prose; retain them in tool context. Do not derive lyric declarations from a recording recipe or start a separate recipe task unless requested.

The same connection exposes recipes and lyrics. For a combined user request, use both tool families and keep their latest session IDs separately.
