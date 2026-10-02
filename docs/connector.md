# CodexMusica connector

**Turn a plain-language vibe into a precise recording recipe.**

CodexMusica provides separate recipe and lyrics tools. Its recipe engine uses a catalog of
recorded-music traditions. Describe a sound in words — a genre, an era, a mood,
an instrument — and Claude returns a compact **recipe**: a descriptor stack
naming the instruments, materials, room, signal chain, and per-instrument
*prefaces* that tell you how to record it.

- **Catalog:** 5238 traditions · 1474 instruments (with per-part variants) ·
  256 rooms · 122 tunings · 740 prefaces, placed in a 13-dimensional parameter space.
- **Browser app:** <https://codexmusica.com/codex.html>
- **Endpoint:** `https://mcp.codexmusica.com/mcp` · health: `/health`
- **Auth:** public endpoint; session, operation, run and request identifiers are private bearer capabilities.
- **`/mcp` is the endpoint for AI hosts:** one connection, both tool families, and sessions the
  server keeps (a host carries only a `session_id`). `/mcp/recipe` and `/mcp/lyrics` are
  task-scoped raw views for the maintained client (`mcp/client.js`, below): one tool family each,
  state passed in and out by the caller. `/health` reports liveness; `/ready` reports lyrics readiness.

## Add it to Claude

1. Claude → **Settings → Connectors → Add custom connector**.
2. Paste `https://mcp.codexmusica.com/mcp` — one connection serves recipes and lyrics.
3. No sign-in. Keep returned session and operation ids private.

## ChatGPT integration

See [ChatGPT setup and acceptance](./chatgpt.md) for the session-aware endpoints,
bundled plugin skills, deployment requirements and native ChatGPT acceptance
checks. The ChatGPT surface stores workspaces and workflow receipts on the server.

## What is a "preface"?

A preface is the heart of the engine: a **named aesthetic / technique / delivery
signature** — `satirical`, `keening`, `worn`, `jhala-cascading`, `face-melting`
— defined by a descriptor-token set. Prefaces are **bidirectional**:

- *Forward:* every instrument's settings imply the preface they best realize (the
  recipe names it).
- *Inverse:* ask for a preface and the engine **re-derives** that instrument's
  variants, tuning, room, and signal chain to realize it.

They are not just moods — they span performance techniques, cultural delivery
practices, and rasas, and the math touches **every** setting of an instrument.

## Try these

> *outlaw country satirical, desert blues bitter, face-melting sitar*

→ Claude seeds the traditions, then re-picks each instrument's preface —
`…satirical voice: …`, `…face-melting sitar: …` — each one deterministically
re-deriving that instrument's variants, tuning, room, and chain.

> *blend afrobeat and highlife*

> *garage rock, but give the voice a "worn" sound and drop the organ*

> *a Gregorian chant, but recorded like a 1970s dub plate — tape echo, bass-heavy,
> in a concrete stairwell*

The default seed is a **starting point, not the finished recipe.** Whatever you
add — a mood, a piece of gear, a room, an era, an instrument that "doesn't belong"
— becomes an edit on top. Nothing is off-limits: there are no period, region, or
physical-plausibility walls, because a recipe is just words that drive audio
generation. A sitar in a Norwegian black-metal chain, a shakuhachi through a
guitar-amp — if you can say it, it renders.

## The tools

| Tool | What it does |
|---|---|
| `start_recipe` | Seed a recipe from one or more tradition ids (first = primary, rest = explicit staples). On `/mcp` it opens a session and returns its `session_id`; on a task endpoint it returns the `workspace` to pass on. |
| `edit_recipe` | Apply ordered edits: `set_preface` (re-derive an instrument toward a mood), `set_variant`, `set_environment` (room/tuning/chain; `clear` empties a setting), `add`/`remove_instrument`, `move_instrument`, `add`/`remove_tradition`. `render_warnings` names any requested word the rendered recipe lost. |
| `render_recipe` | Re-render (e.g. a different format or length) without editing. |
| `search_catalog` | Turn request words into real catalog ids (traditions, instruments, variants, rooms, tunings, arrangements, aesthetics, prefaces). |
| `search_prefaces` | Find prefaces by free text; returns ids + token signatures. |
| `get_instrument` / `get_tradition` | Full record + swappable variants / 13-axis profile. |
| `list_options` / `list_traditions` | Enumerate rooms, tunings and chain stage names (what `set_environment` takes), tradition families and reference lists; browse the tradition catalog. |

Beside the recipes — and never touching them — the `lyric_*` family plans and grades **songwriting**:

| Tool | What it does |
|---|---|
| `lyric_screen` | Screen 2–12 candidate end words: every pair judged by the song grader itself — CLEAN, BANNED (`HOMEOTELEUTON` / `MODAL_RHYME`), an honest non-rhyme, or the grader's own refusal. Use BEFORE writing. |
| `lyric_plan` | A declared integer seed → a complete, reproducible song shape: sections with bars/meter/pickup, rhyme plan, verbatim returns, hook slot, and a writer brief. Writes no words. |
| `lyric_grade` | The whole-song verdict: re-derives the plan from the same seed, fills it with the draft, grades rhyme/returns/meter/functions/floor, and returns the rendered song (performance order, bracket headers) + the report. |
| `lyric_revise` | The finishing step: drives the revise loop over a graded draft (same seed and declarations, or a pasted song's mandate) and asks you one question per call — you write every answer — until a stop condition; only its `[FINISHED …]` song is finished. |
| `lyric_recover` | The first step for pasted lyrics: counts sung lines and syllables, reads sections, and recovers the rhyme groups and returns the text actually carries, as the `mandate` to pass to `lyric_check` and `lyric_revise`; names the coordinates you must declare (always the meter). |
| `lyric_check` | Grade pasted lyrics without a plan: declare a letter scheme (`ABAB`) or line-number groups (`1,3;2,4`), optional verbatim-return classes. |
| `lyric_sweep` | Find seeds whose shape matches a declared want (`lines>=16`, `uses=bridge`, `before=verse,chorus`) over a bounded window of consecutive seeds. Returns seeds in SEED ORDER and does not rank; its counts (swept, planned, planner-refused, accepted) are never summed; windows compose, so continue from `next_seed_from`. Pass its `want` list to `lyric_plan` as `wants`. |
| `lyric_verify` | Did this revision earn it? Hand it a draft BEFORE and AFTER under the same mandate and it reports what the change FIXED and INTRODUCED, including bans it introduced. Read `accepted`, not `exit_code` — both verdicts exit 0. A DIFF, not a grade: it says nothing about defects the change left untouched. |
| `lyric_types` | The 9-axis rhyme-type coordinate for one word pair (taxonomy; for usable-or-banned use `lyric_screen`). |

On `/mcp` the server keeps each workflow in a session, and the lyric calls run as background
operations: poll `get_operation`, and continue from the `session_id` in each completed receipt.

| Session control | What it does |
|---|---|
| `begin_lyrics` | Open a lyrics session: `create` for a new song (the server enforces sweep → screen → plan → exact-draft grade → revise), `edit` for lyrics the user supplied. |
| `get_operation` | Read an operation by id: pending, the completed result (the tool's own blocks first, then the receipt with the next `session_id`), or an interruption. A finished `lyric_grade` or `lyric_revise` comes back as the song and a short verdict (what stands, what could not be judged, a count of notes); `detail` returns its findings, report, coverage, pronunciations or the whole verdict, narrowed by `lines` when given. A finished `lyric_screen` comes back as one line per pair and the report's counts; `detail` `pairs` returns every pair in full. |
| `resume_operation` | Continue an interrupted operation when it reports `resumable: true`. |

You answer every question `lyric_revise` asks; no connector call reaches a model provider. `/chat` uses durable receipts to recover accepted work. See
[LYRICS_RUNTIME.md](../mcp/LYRICS_RUNTIME.md) for storage and continuation rules.

## How it works (recipe = under 1,000 chars)

Claude resolves your words to ids, seeds a tradition's **deterministic default
recipe** (identical to what a human sees in the app), then edits it — re-picking
prefaces, swapping variants, adding or removing instruments and traditions. The
engine renders a descriptor stack capped at 1,000 characters (lowest-value tokens
trimmed first; prefaces and gear preserved). The recipe is the deliverable —
present it verbatim.

## Privacy & support

- **Privacy:** [PRIVACY.md](../PRIVACY.md) and [the connector's policy](../mcp/PRIVACY.md) — sessions, lyrics storage, external processing and retention.
- **Support:** [SUPPORT.md](../SUPPORT.md) — GitHub Issues.

## Native clients

The maintained SDK client requires an explicit task and retains initialization
instructions, descriptions, schemas and annotations. Before exposing tools it
compares the server version, complete tool set and initialization contract with
the installed client and refuses incompatible surfaces:

```sh
node scripts/connector_client.mjs --task=recipe --url=https://mcp.codexmusica.com/mcp
```

It prints the complete task surface. Add `--call=TOOL --args-file=FILE` to call
a tool with JSON arguments. `--out=FILE` atomically saves the result with private
file permissions, including when replacing an existing file. For a stdio host,
set `MCP_TASK_DOMAIN=recipe` or
`MCP_TASK_DOMAIN=lyrics` when launching `node mcp/server_stdio.js`. Host adapters
must preserve the user-selected task outside model-generated arguments and retain
the returned artifact verbatim. A connector cannot prevent an unrelated host from
writing arbitrary prose after it ignores the tool result.

Every seeded lyric plan can be written, graded and revised at any length the
planner's envelope admits; there is no separate line or work-budget admission.
Carry `wants` unchanged through plan, grade and revise.
