# CodexMusica connector

**Turn a plain-language vibe into a precise recording recipe.**

CodexMusica is a read-only Claude connector backed by a structured catalog of
recorded-music traditions. Describe a sound in words — a genre, an era, a mood,
an instrument — and Claude returns a compact **recipe**: a descriptor stack
naming the instruments, materials, room, signal chain, and per-instrument
*prefaces* that tell you how to record it.

- **Catalog:** 1119 traditions · 419 instruments (with per-part variants) ·
  256 rooms · 120 tunings · 649 prefaces, placed in a 13-dimensional parameter space.
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

> *outlaw country satirical, desert blues bitter, face-melting sitar, no drums*

→ `…satirical bitter voice, … face-melting sitar: bronze-steel teak …` — the two
blended-tradition voices merge and pool their prefaces, and the sitar is baked to
`face-melting`.

> *blend afrobeat and highlife, lean ensemble*

> *I want something with high harmonic complexity but low density — what genre, and how do I record it?*

> *give the voice a "worn" sound*

## The tools

| Tool | What it does |
|---|---|
| `search_catalog` | Turn request words into real catalog ids (traditions, instruments, variants, rooms, tunings, arrangements, aesthetics, prefaces). |
| `search_prefaces` | Find prefaces by free text; returns ids + token signatures. |
| `apply_preface` | Bend one instrument toward a preface (intent → physical settings). |
| `generate_recipe` | Generate a recipe from tradition ids, with overrides + baked-in `prefaces`. |
| `blend_traditions` | Weighted two-tradition blend on a 0–1 dial. |
| `recipe_from_axis` | Best-fit tradition for a target axis profile, then its recipe. |
| `get_instrument` / `get_tradition` | Full record + swappable variants / 13-axis profile. |
| `find_similar_traditions` | Nearest traditions by axis distance. |
| `list_options` / `list_traditions` / `list_instruments` | Enumerate option spaces and the catalog. |

A `compose_recipe` prompt walks Claude through the full loop. Every tool is
read-only and deterministic.

## How it works (recipe = under 1,000 chars)

Claude resolves your words to ids, bakes any requested prefaces into the
instruments, then the engine renders a descriptor stack capped at 1,000
characters (lowest-value tokens trimmed first; prefaces and gear preserved). The
recipe is the deliverable — present it verbatim.

## Privacy & support

- **Privacy:** [PRIVACY.md](../PRIVACY.md) — read-only, stateless, no personal data stored.
- **Support:** [SUPPORT.md](../SUPPORT.md) — GitHub Issues.
