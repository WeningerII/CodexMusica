# CodexMusica connector

**Turn a plain-language vibe into a precise recording recipe.**

CodexMusica is a read-only Claude connector backed by a structured catalog of
recorded-music traditions. Describe a sound in words — a genre, an era, a mood,
an instrument — and Claude returns a compact **recipe**: a descriptor stack
naming the instruments, materials, room, signal chain, and per-instrument
*prefaces* that tell you how to record it.

- **Catalog:** 1145 traditions · 1392 instruments (with per-part variants) ·
  256 rooms · 120 tunings · 741 prefaces, placed in a 13-dimensional parameter space.
- **Browser app:** <https://weningerii.github.io/CodexMusica/codex.html>
- **Endpoint:** `https://codex-musica-mcp.onrender.com/mcp` · health: `/health`
- **Auth:** none (open, read-only) · **Data:** stateless, no account, no personal data.

## Add it to Claude

1. Claude → **Settings → Connectors → Add custom connector**.
2. Paste the URL: `https://codex-musica-mcp.onrender.com/mcp`.
3. No sign-in — it's an open, read-only server. Start a chat and ask for a sound.

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

Every tool is read-only and deterministic. State is passed in and out — Claude
threads the `workspace` from each call into the next.

## How it works (recipe = under 1,000 chars)

Claude resolves your words to ids, seeds a tradition's **deterministic default
recipe** (identical to what a human sees in the app), then edits it — re-picking
prefaces, swapping variants, adding or removing instruments and traditions. The
engine renders a descriptor stack capped at 1,000 characters (lowest-value tokens
trimmed first; prefaces and gear preserved). The recipe is the deliverable —
present it verbatim.

## Privacy & support

- **Privacy:** [PRIVACY.md](../PRIVACY.md) — read-only, stateless, no personal data stored.
- **Support:** [SUPPORT.md](../SUPPORT.md) — GitHub Issues.
