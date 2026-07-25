# Codex Musica — guide for AI agents

This repository publishes a **static, server-free "API"**: pre-compiled recording
**recipes** for **1167 recorded-music traditions** and data for **651 instruments**.
There is no server to call, no API key, and no rate limit — every "endpoint" is just a
plain JSON file you fetch and read.

## What you get

For any tradition, you get:

- `recipe` — a compressed descriptor-stack string (≤1000 chars) describing **how to
  record a song in that style**: ensemble timbres, instruments, room, signal chain,
  tuning. No prose, no artist names. <!-- @promise: recipe-char-ceiling -->
- `config` — the structured arrangement behind that recipe (instruments + chosen part
  variants, room, chain, tuning, aesthetic), every id resolvable against the catalog. <!-- @promise: every-id-resolves -->

## How to use it (zero setup)

Base URL: `https://weningerii.github.io/CodexMusica`

**Fastest path — one fetch for everything:** `…/api/all.json` returns all 1167
traditions with their `recipe` strings in a single file (~0.8 MB). Fetch it once and you
have the whole catalog; no per-id requests needed. <!-- @promise: all-traditions-one-fetch -->

**Do NOT fetch `codex.html`** — it is the human GUI shell (it lazy-loads this same `api/`
at runtime), not a machine-readable payload. Use the JSON endpoints.

For full structured arrangements (ensemble, room, chain, tuning) per tradition:

1. **Discover ids** — fetch the index:
   - `…/api/traditions/index.json` → `{ count, items: [{ id, name, family, href }] }`
   - `…/api/instruments/index.json`
2. **Fetch one entry** by id:
   - `…/api/traditions/{id}.json` (e.g. `…/api/traditions/bluegrass.json`)
   - `…/api/instruments/{id}.json` (e.g. `…/api/instruments/oud.json`)
3. **Read the `recipe` field** for the human-usable answer; read `config` if you need
   the structured breakdown.

`…/api/index.json` is the machine-readable endpoint map and catalog counts.

### Example (tradition record, abridged)

```json
{
  "id": "bluegrass",
  "name": "Bluegrass",
  "family": "vernacular",
  "recipe": "classic North American 1945-1948 bluegrass, …",
  "recipe_chars": 759,
  "score": 234.156,
  "config": { "traditions": ["bluegrass", …], "instruments": [ … ], "room": "bristol_sessions_appalachian_pre_commercial", "archetype": "arch_late60s_us_multitrack", "inline_chain": { … }, "tuning": "bluegrass_high_lonesome_pentatonic", "aesthetic": …, "arrangement": …, "fx_extras": [ … ] }
}
```

## Live MCP connector (hosted — no clone, no setup)

A hosted **Model Context Protocol** server is the headless twin of the browser app — it
exposes the full *editable* engine as tools. Seed a recipe from any tradition, then edit
it (re-pick a preface, swap a part variant, override room/chain/tuning, add/remove
instruments or traditions) and re-render. Deterministic and read-only; state passes in and
out, so thread the returned `workspace` into the next call.

- **Endpoint** (Streamable HTTP, no auth): `https://codex-musica-mcp.onrender.com/mcp`
- **Add in Claude:** Settings → Connectors → Add custom connector → paste the URL.
- **Server card** (capabilities, for clients that auto-discover): `https://codex-musica-mcp.onrender.com/.well-known/mcp.json`
- **Tools:** `start_recipe`, `edit_recipe`, `render_recipe`, `search_catalog`, `search_prefaces`, `get_instrument`, `get_tradition`, `list_traditions`, `list_options`.

**The default seed is scaffolding, not the answer.** `start_recipe` returns a
tradition's stock cards; the tool's job is to push them toward the user's words.
Map intent to edits — each mapping below is one `edit_recipe` op:

| The user said… | Do this |
|---|---|
| a mood / feel / aesthetic word ("bitter", "dreamy", "face-melting") | `search_prefaces` → `set_preface` on **each** instrument it should color — this re-derives that instrument's physical settings toward the word |
| specific gear / material / technique ("brushes", "mahogany", "fingerpicked") | `get_instrument` → `set_variant` |
| a space, era, or medium ("in a cathedral", "1950s broadcast", "on wax") | `set_environment` — any room, tuning, or chain stage |
| an instrument to add or drop | `add_instrument` / `remove_instrument` — any instrument fits any tradition |
| another style to fold in | `add_tradition` / `remove_tradition` |

**There are no coherence fences.** Nothing is anachronistic, out-of-region, or
physically impossible here — recipes are *words for audio generation*, so a
Delta-blues igil through a cathedral chain onto shellac is exactly as renderable
as the period-correct default. The catalog's researched defaults are flavor to
keep or override, never a wall. Every id-valid combination renders; the only
errors are unknown ids.

A typical exchange ("haunted Appalachian murder ballad, banjo like it's underwater"):
`search_catalog "appalachian ballad"` → `start_recipe {traditions:["appalachian_ballad_singing"]}`
→ `search_prefaces "haunted eerie"` and `search_prefaces "underwater submerged"`
→ one `edit_recipe` with `[{action:"set_preface", card:"voice", preface:"<haunted-hit>"},
{action:"set_preface", card:"five_string_banjo", preface:"<underwater-hit>"}]`
→ present the returned `recipe` verbatim. One search per user-word, one batched
edit call, done.

Use the connector for *composition*; the static JSON below is the browse layer —
read it when you only need a tradition's default recipe as reference.

## Full functionality (clone & run)

The JSON endpoints above serve the **default** recipe per tradition — read-only. The
**full engine** runs from the repo and does much more: blend multiple genres, add/remove
instruments, swap part variants, axis-target search, and add/edit/delete catalog
entities. An agent with a shell gets all of it: <!-- @promise: documented-commands-run -->

```sh
git clone https://github.com/WeningerII/CodexMusica
cd CodexMusica && npm ci

node scripts/recipe.js --traditions afrobeat,post_punk            # blend genres
node scripts/recipe.js --tradition afrobeat --exclude-instrument=saxophone --swap-variant=voice:voice_register:falsetto
node scripts/recipe.js --diff --weight=0.6 bluegrass thrash_metal  # weighted blend
node scripts/recipe.js --axis-target "harm:1,density:2,intensity:2"
npm run validate                                                   # reference-integrity check
```

`SKILL.md` in the repo is the complete contract: data model, every flag, CRUD, output
rules, and invariants. Source: <https://github.com/WeningerII/CodexMusica>

## Notes

- **Static & deterministic.** Files are generated by running this repo's recipe engine
  at build time (`npm run build:api`). The intelligence is in the dataset + compiler;
  fetching costs you nothing and invokes no model.
- **Stable URLs.** The `{id}` values are the catalog ids listed in the index files.
- **Reproduce locally.** Clone the repo and run `node scripts/recipe.js --tradition <id>`
  for live generation, or `npm run build:api` to regenerate the whole static set.

## Provenance

Generated from `references/` by `scripts/build_static_api.js` +
`scripts/build_discovery.js`. See the repo `README.md` and `SKILL.md` for the full data
model and engine.
