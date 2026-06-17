# CodexMusica — Claude Connectors Directory submission package

Paste-ready answers for the directory submission form, plus the reviewer-facing
notes. Everything here reflects the deployed server (`mcp/` over Streamable HTTP).

---

## Listing

| Field | Value |
|---|---|
| **Name** | CodexMusica |
| **Tagline** | Turn a plain-language vibe into a precise recording recipe. |
| **Category** | Creative / Music production |
| **Endpoint** | `https://codex-musica-mcp.onrender.com/mcp` |
| **Health check** | `https://codex-musica-mcp.onrender.com/health` |
| **Transport** | Streamable HTTP (stateless — a fresh server/transport per request, no sessions) |
| **Authentication** | **None** — open, read-only compute. No accounts, no user data accessed. |
| **Read / write** | **Read-only.** Every tool is annotated `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`, each with a human-readable `title`. |
| **External calls** | None. Closed-world; zero runtime dependencies; responses are derived entirely from the bundled catalog. |
| **Documentation** | `docs/connector.md` (publish at `https://github.com/WeningerII/CodexMusica/blob/main/docs/connector.md` or the GitHub Pages site) |
| **Support** | `SUPPORT.md` — GitHub Issues (add a non-personal support email if desired) |
| **Privacy policy** | `PRIVACY.md` |

### Short description (≈50 words)

CodexMusica turns a plain-language musical request — a genre, an era, a mood, an
instrument — into a precise, structured recording recipe: the instruments,
materials, room, signal chain, and per-instrument *prefaces* (named
aesthetic/technique signatures) that define how to record it. Backed by a
structured catalog spanning 1119 traditions and 419 instruments. Read-only and
stateless; no account or personal data.

### Long description (≈120 words)

CodexMusica is a recording-arrangement engine exposed as read-only tools. Its
catalog places **1119 recorded-music traditions** in a 13-dimensional parameter
space alongside **419 instruments** (decomposed into per-part variants), **256
rooms**, **120 tunings**, and **649 "prefaces"** — named aesthetic/technique/
delivery signatures (e.g. `satirical`, `keening`, `jhala-cascading`) that map
*intent → physical settings*.

Ask for a sound in plain language and Claude resolves it to real catalog ids,
bakes any requested prefaces into the instruments, and returns a compact
descriptor-stack "recipe" — under 1,000 characters — naming the parts, materials,
room, and signal chain to track it with. It also blends traditions on a dial,
matches an axis profile to the closest genre, and introspects the whole catalog.

---

## Use cases

1. **Compose from a vibe.** *"outlaw country satirical, desert blues bitter,
   face-melting sitar, no drums"* → a ready-to-track descriptor stack with
   `satirical bitter voice`, `face-melting sitar`, and the full chain.
2. **Blend two traditions on a dial.** Afrobeat × Highlife at weight 0.5 — a
   coherent hybrid roster, room, and chain.
3. **Reverse-engineer a sound.** Give a target axis profile (high harmonic
   complexity, low density, high intensity) → the closest tradition + its recipe.
4. **Bend one instrument to a feeling.** Apply `worn` to a voice → the engine
   re-derives the mic/medium/variant chain that realizes it.
5. **Production reference.** Browse an instrument's parts and swappable variants,
   the room/tuning/chain option spaces, or nearest-neighbor traditions.

---

## Tools

All 12 tools are read-only and deterministic. A user-invoked workflow prompt,
`compose_recipe`, ties them into the end-to-end loop.

| Tool | Title | One-line summary |
|---|---|---|
| `search_catalog` | Search the whole catalog | Free-text search across every record type (traditions incl. lineage, instruments, part-variants, rooms, tunings, arrangements, aesthetics, prefaces) — turns request words into real ids. |
| `search_prefaces` | Search prefaces | Search the 649 prefaces (aesthetic/technique/delivery signatures) by free text; returns ranked ids with their descriptor-token signatures. |
| `apply_preface` | Apply a preface to an instrument | Bend one instrument toward a preface (intent → physical settings): re-derives its variants/tuning/room/chain; returns ready-to-bake overrides. |
| `generate_recipe` | Generate a recording recipe | Build a recipe from one or more tradition ids (first = primary, rest blended), with optional instrument/variant/room/tuning/chain overrides and baked-in `prefaces`. Returns the descriptor-stack recipe + the knobs still available. |
| `blend_traditions` | Weighted blend of two traditions | Weighted A→B blend on a 0–1 dial (B's share); primary flips past 0.5. |
| `recipe_from_axis` | Recipe from an axis profile | Find the best-fit tradition for a target point in the 13-axis space, then emit its recipe. |
| `get_instrument` | Get one instrument (the knob catalog) | Every part and the variant ids you can pass to `swap_variants`, with labels and defaults. |
| `get_tradition` | Get one tradition | Name, family, lineage, and the 13-axis profile for one tradition. |
| `find_similar_traditions` | Find similar traditions | Nearest traditions by 13-axis distance — what to blend in next. |
| `list_options` | Enumerate an option space | Valid ids for rooms / tunings / chain sections / archetypes / aesthetics / arrangements / families / axes. |
| `list_traditions` | List / filter traditions | Enumerate traditions, optionally filtered by substring or family. |
| `list_instruments` | List / filter instruments | Enumerate instruments, optionally filtered by substring or family. |
| `compose_recipe` *(prompt)* | Compose a recipe from a vibe | Step-by-step workflow guide: resolve words → ids, bake prefaces, generate, present verbatim. |

---

## Reviewer notes

- **Stateless & safe to call repeatedly.** No sessions, no persistence, no side
  effects; an instance restart can never orphan a session. Every tool is
  idempotent and read-only.
- **No data egress.** The server makes no outbound network calls; all responses
  come from the bundled, immutable catalog. `npm audit` = 0 vulnerabilities; zero
  runtime dependencies.
- **Length contract.** Generated recipes are hard-capped at 1,000 characters with
  graceful, lowest-value-first trimming.
- **Annotations.** `readOnlyHint`/`idempotentHint`/`openWorldHint:false` + `title`
  are set on every tool (`mcp/tools.js`), which is the metadata the directory
  review weighs most heavily.
- **Auth note.** This is an authless read-only server. That is permitted for the
  directory (OAuth is only required when a connector accesses private user data),
  but be aware some org-managed/Desktop admin flows currently assume OAuth 2.1 +
  Dynamic Client Registration; the web custom-connector and directory paths handle
  authless servers fine.

## Pre-submission checklist

- [x] Remote MCP server, publicly reachable over HTTPS
- [x] Every tool has a `title` + `readOnlyHint`/`destructiveHint` annotation
- [x] Human-readable tool names and descriptions
- [x] Read-only; no private user data; no external calls
- [ ] Public documentation URL live (publish `docs/connector.md`)
- [ ] Privacy policy URL live (publish `PRIVACY.md`)
- [ ] Support channel reachable (confirm `SUPPORT.md` contact)
- [ ] Hosting kept warm during review (Render starter spins down on idle — bump
      the plan or add a keep-warm ping so reviewers don't hit a cold start)
- [ ] Submitting from a **Team or Enterprise** Claude org with directory-management
      access (org Owner by default)
