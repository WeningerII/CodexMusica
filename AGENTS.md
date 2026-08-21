# Codex Musica — guide for AI agents

This repository publishes a **static, server-free "API"**: pre-compiled recording
**recipes** for **2503 recorded-music traditions** and data for **1406 instruments**.
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

**Fastest path — one fetch for everything:** `…/api/all.json` returns all 2503
traditions with their `recipe` strings in a single file (~1.9 MB). Fetch it once and you
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
- `render_recipe` takes `format`: `rich` (default), `tags`, `prose`, `compact`. Every one of
  them returns the byte-identical string the app shows for the same workspace.
  <!-- @promise: connector-render-parity -->
- **The recipe's environment comes from the FIRST card.** Tuning, room and every signal-chain
  stage are rendered from `cards[0]` alone — in all four formats, in both the connector renderer
  and the browser (`buildStackParts(cards[0])`), which is why the app calls that card primary.
  Instruments come from every card; the environment comes from one. So "record the whole thing in
  a cathedral" is a SINGLE `set_environment` edit, and `card` is optional there — omit it and it
  targets the primary. Setting an environment on any other card writes fields nothing renders; it
  can only surface at all by nudging that one card's auto-derived preface label.
- `set_variant` **reshapes the rest of the card**, exactly as picking a variant does in the app:
  the same inverse cascade a preface pick runs, pinning the part you set so your choice is never
  reverted while the other axes move toward the preface the new sound implies. On a card whose
  preface is still auto-derived, that can change which preface the card is heading toward. It is
  not a bare field write — batch a `set_preface` first if you want to steer the cascade.
  <!-- @promise: connector-edit-parity -->
- Every tool is **read-only, idempotent and closed-world**: state is passed in and out, nothing is
  stored server-side, and every answer comes from the bundled catalog. Thread the returned
  `workspace` into the next call — there is no session to resume and no handle to hold.
  <!-- @promise: connector-tools-read-only -->
- Published tool schemas stay inside the shape a restricted function-calling client can represent:
  no `additionalProperties`, `propertyNames`, `anyOf`/`oneOf`/`allOf`, `$ref` or empty schema nodes,
  beyond a short exemption list enumerated and justified in the gate itself.
  <!-- @promise: connector-schema-subset -->
- Each card in a recipe response carries `changed` — the parts, room, tuning and chain stages that
  differ from the card as it was seeded — so an edit can be confirmed without diffing the workspace
  or trusting a recipe string that may have been truncated. Absent on an untouched card.
  <!-- @promise: connector-edit-visible -->
- A chain id never needs guesswork: `search_catalog types=["chain"]` returns each hit with the
  `stage` that accepts it (a chain id is only usable as `chain: {<stage>: <id>}`, and there are
  eight stages), and a real id offered to the wrong stage is refused with the stage that would
  take it rather than a bare "Unknown".
  <!-- @promise: chain-id-stage-known -->
- The tool surface also drives **restricted function-calling clients** (Gemini and the like), whose
  schema dialect is narrower than MCP's. The declarations derived from a live `tools/list` carry no
  keyword such a client rejects and no `workspace` parameter — the caller holds the workspace and
  threads it, so the model never emits one.
  <!-- @promise: connector-gemini-legal -->
- A chain override is validated for **shape** as well as id. A multi-select stage such as `fx` holds
  a list; passing one id is accepted and lifted, and anything else is refused loudly rather than
  written through and silently dropped at render time.
  <!-- @promise: chain-stage-validated -->

**No MCP client?** Then use the static JSON below — it is the default recipe per tradition,
read-only. Editing needs the connector; there is no HTTP fallback that edits.

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
Every file path those commands name is checked to exist, in this file and in every `*.md` the repository tracks — including the `$ python3 …` transcripts under `lyric-harness/`. A path that is gone on purpose has to say so where it is cited, so a deleted fixture cannot go on reading as a runnable example. <!-- @promise: documented-paths-exist -->

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
- **A tradition's recipe answers only to its own record.** The engine scores a
  tradition against neighbouring ones — that adjacency is deliberate and is how a
  variant nobody pinned still surfaces where it belongs. What it does NOT read is
  what those neighbours are *called*: a name is a label, edited for readers, and
  renaming one record can never move another record's picks.
  <!-- @promise: name-isolation -->
- **Stable URLs.** The `{id}` values are the catalog ids listed in the index files.
- **Reproduce locally.** Clone the repo and run `node scripts/recipe.js --tradition <id>`
  for live generation, or `npm run build:api` to regenerate the whole static set.

## Provenance

Generated from `references/` by `scripts/build_static_api.js` +
`scripts/build_discovery.js`. See the repo `README.md` and `SKILL.md` for the full data
model and engine.
