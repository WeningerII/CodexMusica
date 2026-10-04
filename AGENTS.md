# Codex Musica — guide for AI agents

This repository publishes a **static, server-free "API"**: pre-compiled recording
**recipes** for **6725 recorded-music traditions** and data for **1653 instruments**.
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

Base URL: `https://codexmusica.com`

**Fastest path — one fetch for everything:** `…/api/all.json` returns all 6725
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

For native SDK/CLI integration, use `mcp/client.js`. New lyrics default to creation
mode with executed sweep/screen/plan/grade/revise receipts; retain the connection
or its private snapshot. CLI creation calls require the same `--session-file=FILE`
on every call. An explicit host `phase: 'edit'` is for an existing song only.
The raw endpoint cannot enforce an external host's user intent. See
`docs/session-workflow-repairs.md` for the exact integration and verification scope.

`edit_recipe` also supports `move_instrument` (`card`, optional `before`); omitting
`before` moves that existing card to the front without rebuilding its settings — its
tradition leads the header, and the environment moves with it only if the card has one.
Rich compression prioritizes explicitly pinned part descriptors. Inspect the returned
`render_warnings` for requested words — part descriptors, prefaces, environment
settings — absent from the actual output, and `render_scope` for the one shared
environment and the card it comes from; neither a preface nor a chain description
establishes a measured audio result.

A hosted **Model Context Protocol** server is the headless twin of the browser app — it
exposes the full *editable* engine as tools. Seed a recipe from any tradition, then edit
it (re-pick a preface, swap a part variant, override room/chain/tuning, add/remove
instruments or traditions) and re-render. Recipe operations are deterministic; on `/mcp` the server
keeps the workspace in a session (the task endpoints pass it in and out instead). A separate lyrics
pipeline plans and grades songs whose every line you write; no connector call reaches a model provider.

- **Endpoint** (Streamable HTTP, no auth): `https://mcp.codexmusica.com/mcp`
- **Add in Claude:** Settings → Connectors → Add custom connector → paste the URL.
- **Server card** (capabilities, for clients that auto-discover): `https://mcp.codexmusica.com/.well-known/mcp.json`
- **Recipe tools:** `start_recipe`, `edit_recipe`, `render_recipe`, `search_catalog`, `search_prefaces`, `get_instrument`, `get_tradition`, `list_traditions`, `list_options`.
- **Lyric tools:** `lyric_sweep`, `lyric_screen`, `lyric_plan`, `lyric_grade`, `lyric_revise`, `lyric_recover`, `lyric_check`, `lyric_verify`, `lyric_types`.
  A new song: `begin_lyrics` → `lyric_sweep` → `lyric_screen` → `lyric_plan` → write the draft →
  `lyric_grade` → `lyric_revise` (answer each question it asks until it stops). Lyrics the user
  pasted: `begin_lyrics {phase:"edit"}` → `lyric_recover` → `lyric_check` → `lyric_revise` without a seed.
- **Session controls** (on `/mcp`): `begin_lyrics`, `get_operation`, `resume_operation`.
  A finished `lyric_grade` or `lyric_revise` read with `get_operation` is the song and a short
  verdict: status fields, `blocking` (what stands, and each line a requested obligation could not
  be judged on) and a count of notes. `get_operation` with `detail` (`findings`, `report`,
  `coverage`, `pronunciations` or `full`, narrowed by `lines`) returns the rest. A finished
  `lyric_screen` is one line per pair and the report's counts; `detail` `pairs` returns every pair.
- `render_recipe` takes `format`: `rich` (default), `tags`, `prose`, `compact`. Every one of
  them returns the byte-identical string the app shows for the same workspace.
  <!-- @promise: connector-render-parity -->
- **The recipe's environment comes from ONE card: the first card that has one.** Tuning, room and
  every signal-chain stage are rendered, whole, from that card (`envCardOf` in
  `scripts/_recipe_stack.js`, mirrored in the browser, whose Recording environment panel edits the
  same card) — in all four formats. Instruments come from every card; the environment comes from
  one, and every response names it in `render_scope.environment_card`. So "record the whole thing
  in a cathedral" is a SINGLE `set_environment` edit, and `card` is optional there — omit it and it
  lands on that card. Setting an environment on any other card writes fields nothing renders, and
  the response says so (`ENVIRONMENT_NOT_RENDERED`). The environment lives on its card: removing or
  moving that card hands the environment to the next card that has one, and a `set_preface` on it
  re-derives its room, tuning and chain — `render_warnings` reports both (`ENVIRONMENT_MOVED`,
  `ENVIRONMENT_OVERWRITTEN`), so put `set_environment` after `set_preface` in a batch.
- `set_variant` does exactly what picking a variant does in the app: it sets and pins the part (your
  choice is never reverted), and on a card whose preface is still auto-derived it re-derives the
  preface label from the new sound. A **material** part (woods, strings and other shared materials)
  also runs the inverse cascade a preface pick runs, so other parts of that card may move toward the
  preface — most edits move nothing else. Room, tuning and the chain never move. Batch a
  `set_preface` first if you want to steer the cascade.
  <!-- @promise: connector-edit-parity -->
- **What each tool touches.** Recipe computation is deterministic and closed-world, and no tool on
  any connector surface reaches a model provider or the open web (`openWorldHint: false`
  throughout); the website chat's own server is the only one whose `lyric_revise` calls a model.
  On the raw engine (`/mcp/recipe`, `/mcp/lyrics`, stdio) every tool is read-only and idempotent
  except `lyric_revise`, which advances its run; a caller-managed client threads the returned
  `workspace`. On the session endpoints (`/mcp`, `/mcp/chatgpt*`) the lookups and `get_operation`
  are read-only, and every tool that opens or takes a `session_id` records the session, so it is
  annotated as a write: a repeat with the same `session_id` and arguments returns the same
  operation, except `start_recipe` and `begin_lyrics`, which open a new session each call, and
  `lyric_revise` on `/mcp`, whose caller-managed mode advances a run. You write every lyric line:
  no connector surface hands a song to the service's own writer, which runs only inside the
  website chat. `/chat` persists request receipts, accepted progress, signed continuations and
  accounting when durable storage is configured. Preserve `run_id` and `run_revision` for direct
  continuations, and `request_id` for chat recovery. See `mcp/LYRICS_RUNTIME.md`.
  <!-- @promise: connector-tool-effects -->
- Use `/mcp` for one shared connection. Consume initialization instructions and
  full tool descriptions/schemas. The shared `/mcp` endpoint exposes both families and
  cannot infer an external host's task. Use session IDs for saved recipe workspaces and background lyrics; caller-managed state remains supported. Recipes default to Rich with a 1,000-character
  ceiling. A recipe request does not authorize lyric work.
- Published tool schemas on every connector surface — the raw engine and the session endpoints
  alike — stay inside the shape a restricted function-calling client can represent: no
  `additionalProperties`, `propertyNames`, `anyOf`/`oneOf`/`allOf`, `$ref` or empty schema nodes,
  beyond a short exemption list enumerated and justified in the gate itself.
  <!-- @promise: connector-schema-subset -->
- Each card in a recipe response carries `changed` — the parts, room, tuning and chain stages that
  differ from the card as it was seeded (or as `add_instrument` built it), and a pinned preface the
  card now shows instead of the one it would show — so an edit can be confirmed without diffing the
  workspace or trusting a recipe string that may have been truncated. Absent on an untouched card.
  <!-- @promise: connector-edit-visible -->
- A chain id never needs guesswork: `search_catalog types=["chain"]` returns each hit with the
  `stage` that accepts it (a chain id is only usable as `chain: {<stage>: <id>}`, and there are
  eight stages), and a real id offered to the wrong stage is refused with the stage that would
  take it rather than a bare "Unknown".
  <!-- @promise: chain-id-stage-known -->
- The tool surface also drives **restricted function-calling clients** (Gemini and the like), whose
  schema dialect is narrower than MCP's. The declarations `mcp/gemini_tools.js` derives from a live
  `tools/list` — of the website chat's own server and of every connector surface — carry no keyword
  such a client rejects and no `workspace` or `state` parameter: the caller holds those and threads
  them (a session caller holds only its `session_id`), so the model never emits one.
  <!-- @promise: connector-gemini-legal -->
- A chain override is validated for **shape** as well as id. A multi-select stage such as `fx` holds
  a list; passing one id is accepted, lifted and **added** to the list (as picking an effect does in
  the app), `clear: ["fx"]` empties it, and anything else is refused loudly rather than written
  through and silently dropped at render time.
  <!-- @promise: chain-stage-validated -->

**No MCP client?** Then use the static JSON above — it is the default recipe per tradition,
read-only. Editing needs the connector; there is no HTTP fallback that edits.

**The default seed is scaffolding, not the answer.** `start_recipe` returns a
tradition's stock cards; the tool's job is to push them toward the user's words.
Map intent to edits — each mapping below is one `edit_recipe` op:

| The user said… | Do this |
|---|---|
| a mood / feel / aesthetic word ("bitter", "dreamy", "face-melting") | `search_prefaces` → `set_preface` on **each** instrument it should color — this re-derives that instrument's physical settings toward the word |
| specific gear / material / technique ("brushes", "mahogany", "fingerpicked") | `get_instrument` → `set_variant` |
| a space, era, or medium ("in a cathedral", "1950s broadcast", "on wax") | `set_environment` with no `card` — one edit for the whole recording; any room, tuning, or chain stage |
| an instrument to add or drop | `add_instrument` / `remove_instrument` — any instrument fits any tradition |
| another style to fold in | `add_tradition` / `remove_tradition` |

**There are no coherence fences.** Nothing is anachronistic, out-of-region, or
physically impossible here — recipes are *words for audio generation*, so a
Delta-blues igil through a cathedral chain onto shellac is exactly as renderable
as the period-correct default. The catalog's researched defaults are flavor to
keep or override, never a wall. Every id-valid combination renders; an edit is
refused only for an unknown id, a misspelled field, or doing nothing (a tradition
already in the recipe, an environment edit with nothing to set, a batch that
leaves no cards), and the refusal names what to do instead.

A typical exchange ("haunted Appalachian murder ballad, banjo drowned in reverb, recorded
like it's underwater"):
`search_catalog "appalachian ballad"` → `start_recipe {traditions:["appalachian_folk"]}`
→ `search_prefaces "haunted"` (→ `haunting`), `search_prefaces "submerged"` (→ `drowning`) and
`search_catalog "underwater"` (→ `hydrophone_piezo`, stage `mic`)
→ one `edit_recipe` with `[{action:"set_preface", card:"voice", preface:"haunting"},
{action:"set_preface", card:"banjo_5_string", preface:"drowning"},
{action:"set_environment", chain:{mic:"hydrophone_piezo"}}]` — the environment edit last, and
with no `card`, because it is the whole recording's
→ present the returned `recipe` verbatim. One search per user-word, one batched
edit call, done.

Use the connector for *composition*; the static JSON above is the browse layer —
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
