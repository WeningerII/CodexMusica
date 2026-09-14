---
name: lyric-workflows
description: Use Codex Musica to plan, grade, check or revise song lyrics, including rhyme and meter checks and continuing interrupted lyric work. Use for new songwriting or supplied existing lyrics, separately from recording recipes and public-domain corpus maintenance.
---

Use the Codex Musica MCP connection. Explicit user choices take priority over defaults.

## Begin the requested task

Call `begin_lyrics` with `phase: create` for a new song or `phase: edit` for existing lyrics supplied by the user. Preserve that choice throughout the session. The default `writer: kitchen` matches the website and uses the service's Gemini writer and paid-call accounting for repairs. Select `interview` only when caller-written repair proposals are requested. Beginning the session itself makes no paid model call.

Every lyric tool needs the latest `session_id` and submits a background operation. Read its `operation_id` with `get_operation`; respect `retry_after_seconds`. While pending, poll that operation instead of submitting the work again. Once completed, use its returned `session_id` for the next step. The server holds workflow receipts, original replay input and continuation envelopes. Never manufacture or send state, checkpoint, workflow receipts or internal run IDs.

## New song

1. Translate the user's structural requirements into `lyric_sweep` predicates. Retain the declared form, line count, functions and wants; inspect accepted seeds in their returned order.
2. Screen candidate end words with `lyric_screen`. A refusal is not a successful screening.
3. Call `lyric_plan` with an accepted seed and the same structural requirements. Carry declared title and rhyme relation when supplied. Read the returned executable plan and writer brief; an inspection-only or refused plan does not authorize drafting.
4. Write the complete draft to that plan, preserving line counts, returns and section functions. Grade the exact draft with `lyric_grade` under the same declarations. The service restores omitted plan coordinates and refuses contradictory ones.
5. Call `lyric_revise` only after the exact draft has been graded. Keep the same session. For kitchen, the service answers repair proposals. For interview, answer the requested lines through `answer` or `answers`; continuation state stays on the service.

## Existing lyrics and stops

Use `lyric_check` for supplied lyrics with a declared scheme or line groups; use `lyric_recover` for a repair mandate. Use `lyric_verify` to compare a specific before/after revision, understanding that unchanged defects can survive that comparison. Declare pronunciation assumptions when needed and preserve any refused coverage.

Read both the operation status and the underlying tool verdict. `completed` means the tool call returned. `certified`, requested-layer coverage, findings and the actual lyric stop describe its outcome. Do not replace them with an unconditional success claim. Present the returned song and section headers verbatim, with the actual qualification beside it.

If a completed revision is resumable, continue `lyric_revise` with its session ID. If a run has stopped with unresolved lines, rewrite the requested lines and regrade the complete changed draft before starting a fresh revision. Use `new_run: true` for that fresh run; an archived finished checkpoint is not a pending question.

For an interrupted operation, inspect `get_operation`. Call `resume_operation` only when `resumable` is true and continuing the requested work is appropriate. Unknown provider outcomes, changed scoring semantics or exhausted journal capacity require recovering the accepted draft and reporting the limitation. Never automatically retry those proposals. Follow `successor_id` when the operation has already advanced.

Session and operation IDs are private capabilities with bounded retention. Keep them out of the song and user-facing prose; retain them in tool context. Do not derive lyric declarations from a recording recipe or start a separate recipe task unless requested.

The same connection exposes recipes and lyrics. For a combined user request, use both tool families and keep their latest session IDs separately.
