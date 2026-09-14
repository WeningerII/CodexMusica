---
name: recording-recipes
description: Use Codex Musica to search musical traditions and instruments, compose recording recipes, blend genres, or edit an existing recipe's sound, instrumentation, room, chain, and tuning. Use for recording recipe requests, separately from lyric writing or catalog maintenance.
---

Use the Codex Musica MCP connection. Explicit user choices take priority over defaults.

1. Resolve tradition and instrument names with `search_catalog`. Use `search_prefaces` for mood and feel; use `get_instrument` to find exact material or technique variants.
2. Call `start_recipe` with the resolved traditions, in the requested primary order. Rich is the default; use Tags, Prose or Compact when requested. Every format has a 1,000-character ceiling.
3. Carry the latest returned `session_id` into `edit_recipe` and `render_recipe`. The server stores the workspace; do not reconstruct cards or send workspace JSON. Apply edits sequentially and use each new session ID for the next call.
4. Realize the user's preferences before presenting the final recipe. Apply mood/preface edits to each intended instrument, then specific part variants. Batch ordered edits in one call. A room or signal-chain change targets the first card and controls the shared recording environment. `move_instrument` preserves settings while changing which card is primary.
5. Read `render_warnings` and `render_scope`. Report any requested detail omitted by compression. Present the returned final `recipe` string verbatim; keep explanations outside that string.

Any instrument may fit any tradition. The catalog's researched defaults do not forbid combinations across places or eras. Resolve identifiers through tools; do not invent them.

Use `get_operation` to recover a result after a lost response. Repeating an edit with the same session ID and identical inputs returns the same operation. Different input against an advanced session refuses; follow its `successor_id`. If no receipt remains, say that continuation is unavailable rather than claiming to have recovered it.

If an operation was interrupted, call `resume_operation` only when `get_operation` reports `resumable: true`. It restores the exact workspace and repeats the recorded deterministic edit. Changed engine semantics or unavailable storage can prevent continuation.

A recipe is a text description for recording or audio generation. It does not establish a rendered recording or measured acoustic result. A recipe request does not start lyric work.

The same connection exposes recipes and lyrics. For a combined user request, use both tool families and keep their latest session IDs separately.
