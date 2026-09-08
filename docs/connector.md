# CodexMusica connector

**Turn a plain-language vibe into a precise recording recipe.**

CodexMusica provides separate recipe and lyrics tools. Its recipe engine uses a catalog of
recorded-music traditions. Describe a sound in words — a genre, an era, a mood,
an instrument — and Claude returns a compact **recipe**: a descriptor stack
naming the instruments, materials, room, signal chain, and per-instrument
*prefaces* that tell you how to record it.

- **Catalog:** 2503 traditions · 1406 instruments (with per-part variants) ·
  256 rooms · 120 tunings · 741 prefaces, placed in a 13-dimensional parameter space.
- **Browser app:** <https://weningerii.github.io/CodexMusica/codex.html>
- **Endpoint:** `https://codex-musica-mcp.onrender.com/mcp` · health: `/health`
- **Auth:** public endpoint; run and request identifiers are private bearer capabilities.
- **Task endpoints:** `/mcp/recipe` and `/mcp/lyrics`. `/health` reports liveness; `/ready` reports lyrics readiness.

## Add it to Claude

1. Claude → **Settings → Connectors → Add custom connector**.
2. Paste `https://codex-musica-mcp.onrender.com/mcp/recipe` for recipe work, or use `/mcp/lyrics` for lyric work.
3. No sign-in. Keep returned run and request capabilities private.

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
| `start_recipe` | Seed a recipe from one or more tradition ids (first = primary, rest = explicit staples). Returns the recipe + a `workspace` to thread on. |
| `edit_recipe` | Apply ordered edits to a `workspace`: `set_preface` (re-derive an instrument toward a mood), `set_variant`, `set_environment`, `add`/`remove_instrument`, `add`/`remove_tradition`. |
| `render_recipe` | Re-render a `workspace` (e.g. a different format or length) without editing it. |
| `search_catalog` | Turn request words into real catalog ids (traditions, instruments, variants, rooms, tunings, arrangements, aesthetics, prefaces). |
| `search_prefaces` | Find prefaces by free text; returns ids + token signatures. |
| `get_instrument` / `get_tradition` | Full record + swappable variants / 13-axis profile. |
| `list_options` / `list_traditions` | Enumerate the override spaces and the tradition catalog. |

Beside the recipes — and never touching them — the `lyric_*` family plans and grades **songwriting**:

| Tool | What it does |
|---|---|
| `lyric_screen` | Screen 2–12 candidate end words: every pair judged by the song grader itself — CLEAN, BANNED (`HOMEOTELEUTON` / `MODAL_RHYME`), an honest non-rhyme, or the grader's own refusal. Use BEFORE writing. |
| `lyric_plan` | A declared integer seed → a complete, reproducible song shape: sections with bars/meter/pickup, rhyme plan, verbatim returns, hook slot, and a writer brief. Writes no words. |
| `lyric_grade` | The whole-song verdict: re-derives the plan from the same seed, fills it with the draft, grades rhyme/returns/meter/functions/floor, and returns the rendered song (performance order, bracket headers) + the report. |
| `lyric_check` | Grade pasted lyrics without a plan: declare a letter scheme (`ABAB`) or line-number groups (`1,3;2,4`), optional verbatim-return classes. |
| `lyric_sweep` | Find seeds whose shape matches a declared want (`lines>=16`, `uses=bridge`, `before=verse,chorus`) over a bounded window of consecutive seeds. Returns seeds in SEED ORDER and does not rank; three counts never summed; windows compose, so continue from `next_seed_from`. |
| `lyric_verify` | Did this revision earn it? Hand it a draft BEFORE and AFTER under the same mandate and it reports what the change FIXED and INTRODUCED. Read `accepted`, not `exit_code` — both verdicts exit 0. A DIFF, not a grade: it cannot report banned pairs that survived the change. |
| `lyric_types` | The 9-axis rhyme-type coordinate for one word pair (taxonomy; for usable-or-banned use `lyric_screen`). |

Recipe tools pass `workspace` in and out. `lyric_revise` also retains run state;
its optional kitchen writer sends the lyric brief and draft to Google and incurs
model costs. `/chat` uses durable receipts to recover accepted work. See
[LYRICS_RUNTIME.md](../mcp/LYRICS_RUNTIME.md) for storage and continuation rules.

## How it works (recipe = under 1,000 chars)

Claude resolves your words to ids, seeds a tradition's **deterministic default
recipe** (identical to what a human sees in the app), then edits it — re-picking
prefaces, swapping variants, adding or removing instruments and traditions. The
engine renders a descriptor stack capped at 1,000 characters (lowest-value tokens
trimmed first; prefaces and gear preserved). The recipe is the deliverable —
present it verbatim.

## Privacy & support

- **Privacy:** [PRIVACY.md](../PRIVACY.md) — lyrics storage, external processing and retention.
- **Support:** [SUPPORT.md](../SUPPORT.md) — GitHub Issues.

## Native clients

The maintained SDK client requires an explicit task and retains initialization
instructions, descriptions, schemas and annotations. Before exposing tools it
compares the server version, complete tool set and initialization contract with
the installed client and refuses incompatible surfaces:

```sh
node scripts/connector_client.mjs --task=recipe --url=https://codex-musica-mcp.onrender.com/mcp
```

It prints the complete task surface. Add `--call=TOOL --args-file=FILE` to call
a tool with JSON arguments. `--out=FILE` atomically saves the result with private
file permissions, including when replacing an existing file. For a stdio host,
set `MCP_TASK_DOMAIN=recipe` or
`MCP_TASK_DOMAIN=lyrics` when launching `node mcp/server_stdio.js`. Host adapters
must preserve the user-selected task outside model-generated arguments and retain
the returned artifact verbatim. A connector cannot prevent an unrelated host from
writing arbitrary prose after it ignores the tool result.

Ordinary seeded lyric plans are admitted against the grader's work budget, reported
in `execution_limits`. `inspection_only` exposes larger mathematical shapes but
does not authorize writing. Carry `wants` unchanged through plan, grade and revise.
