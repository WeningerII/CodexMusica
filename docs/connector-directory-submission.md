# CodexMusica — Claude Connectors Directory submission package

Paste-ready answers for the in-app directory submission, plus the reviewer-facing
notes. Everything here reflects the deployed server (`mcp/` over Streamable HTTP).

> **Where to submit:** Claude → **Organization settings → Directory** (requires
> **Admin/Owner on a Team or Enterprise plan**). Remote MCP servers are submitted
> from that portal; the form asks for the URLs and confirmations below.

---

## Paste-ready URLs

| Field | Value |
|---|---|
| **Server / endpoint URL** | `https://mcp.codexmusica.com/mcp` |
| **Health check** | `https://mcp.codexmusica.com/health` |
| **Website** | `https://codexmusica.com` |
| **Documentation URL** | `https://github.com/WeningerII/CodexMusica/blob/main/docs/connector.md` |
| **Privacy policy URL** | `https://github.com/WeningerII/CodexMusica/blob/main/mcp/PRIVACY.md` (the connector; the site-wide policy is `PRIVACY.md`) |
| **Support URL** | `https://github.com/WeningerII/CodexMusica/blob/main/SUPPORT.md` (issues: `https://github.com/WeningerII/CodexMusica/issues`) |
| **Source repository** | `https://github.com/WeningerII/CodexMusica` (public) |
| **Icon** | `assets/icon-1024.png` (1024×1024) — also `assets/icon-512.png`, source `assets/icon-master.png` |

All doc/privacy/support URLs are live and public (the repo is public).

---

## Listing

| Field | Value |
|---|---|
| **Name** | CodexMusica |
| **Tagline** | Turn a plain-language vibe into a precise recording recipe. |
| **Category** | Creative / Music production |
| **Transport** | Streamable HTTP. No MCP transport session: a fresh server per request. Workflow state lives in application-level sessions (`session_id`) the server keeps for a bounded time. |
| **Authentication** | **None** — open. No accounts; no access to the user's files or accounts. Session ids are private bearer capabilities. |
| **Read / write** | Lookups (`search_*`, `get_*`, `list_*`, `lyric_types`, `get_operation`) are `readOnlyHint: true`. Tools that open or advance a session (`start_recipe`, `edit_recipe`, `render_recipe`, `begin_lyrics`, `resume_operation`, the `lyric_*` workflow tools) are `readOnlyHint: false`: they write only the caller's own short-lived session. Nothing is `destructiveHint: true`; every tool has a `title`. |
| **External calls** | None from any connector tool (`openWorldHint: false` throughout): recipes come from the bundled catalog and lyrics are planned and graded by local code. The caller writes every lyric line. |

### Short description (≈50 words)

CodexMusica turns a plain-language musical request — a genre, an era, a mood, an
instrument — into a precise, structured recording recipe: the instruments,
materials, room, signal chain, and per-instrument *prefaces* (named
aesthetic/technique signatures) that define how to record it. Backed by a
structured catalog spanning 5238 traditions and 1474 instruments, plus a
separate songwriting pipeline that plans and grades lyrics the caller writes. No
account; no external calls.

### Long description (≈120 words)

CodexMusica is a recording-arrangement engine exposed as MCP tools. Its
catalog places **5238 recorded-music traditions** in a 13-dimensional parameter
space alongside **1474 instruments** (decomposed into per-part variants), **256
rooms**, **122 tunings**, and **740 "prefaces"** — named aesthetic/technique/
delivery signatures (e.g. `satirical`, `keening`, `jhala-cascading`) that map
*intent → physical settings*.

Ask for a sound in plain language and Claude resolves it to real catalog ids,
seeds a tradition's deterministic default recipe — identical to what a human sees
in the companion app — then edits it: re-picking an instrument's preface (which
re-derives its physical settings), swapping part variants, overriding room/chain/
tuning, and adding or removing instruments and traditions. The result is a compact
descriptor-stack "recipe" under 1,000 characters, naming the parts, materials,
room, and signal chain to track it with. The server keeps the working recipe in a
private session, so the host carries only a short id, and the recipe is
reproducible and matches the app exactly. A separate lyric family plans a song's
shape, grades the draft the host writes, and drives a revision loop that asks the
host for each fix.

---

## Use cases

1. **Compose from a vibe.** *"outlaw country satirical, desert blues bitter,
   face-melting sitar"* → seed the traditions, then re-pick each instrument's
   preface → a ready-to-track descriptor stack with `satirical voice`,
   `face-melting sitar`, and the full chain.
2. **Blend traditions.** Seed several traditions at once → a combined roster,
   room, and chain, then trim or extend it instrument by instrument.
3. **Bend one instrument to a feeling.** Set `worn` on a voice → the engine
   re-derives the mic/medium/variant chain that realizes it, in place.
4. **Iterate.** Swap a part variant, change the room, add or remove an instrument
   or tradition — each edit re-renders the recipe, deterministically.
5. **Production reference.** Browse an instrument's parts and swappable variants,
   the room/tuning/chain option spaces, or the tradition catalog.
6. **Write a song.** Plan a shape (sections, meter, rhyme plan), write the draft,
   grade it, and answer the revision loop's questions until it stops — every line
   is the host's; the service measures and asks.

---

## Tools

The shared endpoint serves 21 tools: nine recipe tools, nine `lyric_*` tools, and
three session controls. Recipe and lyric work never share state. Annotations are
listed under **Read / write** above.

| Tool | Title | One-line summary |
|---|---|---|
| `start_recipe` | Start a recipe from tradition(s) | Seed a recipe from one or more tradition ids (first = primary, the rest explicit staples) — deterministic default cards, identical to the app's "Current Recipe". Opens a session and returns its `session_id`. |
| `edit_recipe` | Edit the recipe (the main tool) | Apply an ordered list of edits and re-render: `set_preface` (re-derive an instrument toward a mood, labeled verbatim), `set_variant`, `set_environment` (room/tuning/chain), `add`/`remove_instrument`, `move_instrument`, `add`/`remove_tradition`. |
| `render_recipe` | Re-render the recipe | Render the current recipe again (e.g. a different format or `max_chars`) without editing it. |
| `search_catalog` | Search the catalog | Free-text search across every record type — turns request words into real ids. |
| `search_prefaces` | Search prefaces | Search the prefaces (aesthetic/technique/delivery signatures) by free text; ranked ids with their descriptor-token signatures. |
| `get_instrument` | Get one instrument | Every part and the variant ids you can pass to `set_variant`, with labels and defaults. |
| `get_tradition` | Get one tradition | Name, family, lineage, and axis profile for one tradition. |
| `list_traditions` | List / browse traditions | Enumerate traditions, optionally filtered by an id/name substring or one exact family; paginated. |
| `list_options` | Enumerate a catalog list | Rooms and tunings (ids `set_environment` takes), chain stage names, tradition families, and reference-only lists. |
| `begin_lyrics` | Begin a lyric task | Open a lyrics session: `create` for a new song, `edit` for lyrics the user supplied. |
| `lyric_sweep` | Find seeds whose shape matches what you want | Plan a bounded window of seeds and return those whose song shape meets declared predicates. |
| `lyric_screen` | Screen rhyme pairs before writing | Judge candidate end-word pairs, including the two-tier ban on lazy rhymes. |
| `lyric_plan` | Plan a song shape | A seeded, reproducible shape: sections, meter, rhyme plan, returns, hook — and a writer brief. Writes no words. |
| `lyric_grade` | Grade a draft against its plan | Grade the host's draft against the same plan; returns the rendered draft and the verdict. |
| `lyric_revise` | Drive the revise loop to a stop condition | Asks the host one question per call until the loop stops; only its stamped song is finished. |
| `lyric_recover` | Structure a pasted song | First step for supplied lyrics: recover the rhyme groups and returns the text carries. |
| `lyric_check` | Check pasted lyrics against a declared rhyme plan | Rhyme grading and the slop floor for lyrics not written to a plan. |
| `lyric_verify` | Did this revision earn it? | Diff a before/after revision under one mandate. |
| `lyric_types` | Classify one rhyme pair | The rhyme-type coordinate and traditional names for one word pair. |
| `get_operation` | Read a saved operation | Read a background lyric operation (or any session) by id. |
| `resume_operation` | Resume interrupted work | Continue an interrupted operation when it reports `resumable: true`. |

---

## Reviewer test / access instructions (authless)

**No credentials are required.**

1. Add `https://mcp.codexmusica.com/mcp` as a custom connector in Claude
   (**Settings → Connectors → Add custom connector**), or point **MCP Inspector**
   (or any MCP client) at that URL. No sign-in, no API key.
2. The service runs on an always-on plan; during a deploy it can be unavailable
   for a few seconds.
3. Suggested end-to-end exercise:
   - `list_options` with `kind: "rooms"` → room ids `set_environment` takes.
   - `search_catalog` with `query: "face-melting sitar"` → resolves request words to real ids.
   - `search_prefaces` with `query: "satirical"` → ranked preface ids.
   - `list_traditions` with `query: "blues"`; `get_tradition` with `id: "delta_blues"`;
     `get_instrument` with `id: "sitar"`.
   - `start_recipe` with `traditions: ["delta_blues"]` → a recipe and a `session_id`.
   - `edit_recipe` with that `session_id` and `edits: [{action: "set_environment", room: "<a room id>"}]`
     → the re-rendered recipe and the next `session_id`.
   - `render_recipe` with the latest `session_id` and `format: "prose"`.
   - `lyric_types` with `word_a: "heart"`, `word_b: "start"` → answers at once.
   - `begin_lyrics` → `lyric_sweep` with that `session_id`, `seed_from: 0`, `count: 5`,
     `want: ["lines<=16"]` → poll `get_operation` with the returned `operation_id`
     until it is completed.

Lookups are side-effect-free. Session tools write only the caller's own session;
repeating a call with the same `session_id` and arguments returns the same operation.

---

## Policy acknowledgments (the form requires all seven)

1. **Directory guidelines** — compliant; a creative/reference tool whose only
   writes are the caller's own short-lived sessions.
2. **First-party API usage** — every MCP tool computes from the server's own
   bundled catalog and local lyric-grading code. No tool proxies a third-party API
   or makes an outbound network call. _Disclosure:_ the same deployment also serves
   the public web page's chat bar at `/chat`, which sends that page's messages —
   and, when it writes lyrics, its drafts — to Google's Gemini API. It is not part
   of the connector surface: no MCP tool reaches it, and a connector caller never
   triggers it. It runs in the same process, so it is named here rather than left
   to inference.
3. **No financial transactions** — the connector moves no money, crypto, or
   financial assets, and no connector call spends model credit.
4. **No AI media generation** — it returns **deterministic text**: recording
   recipes, song plans and grading verdicts. It generates no audio, images or
   video, and it writes no lyrics — the host writes every line.
5. **Prompt-injection safety** — closed-world, no external actions; the worst case
   of any tool is returning catalog-derived or grading text, or advancing the
   caller's own session. No tool can delete, spend, or call out.
6. **Conversation data collection** — the connector retains what a session needs
   to continue (recipe workspaces, lyric drafts and run state, recovery receipts)
   for a bounded time, as `mcp/PRIVACY.md` describes, and uses none of it for
   training. For the chat bar disclosed in acknowledgment 2, what a page visitor
   types is handled by Google under Google's terms; we make no representation
   about retention or training on their side. No MCP tool call reaches that path.
7. **Public documentation** — `docs/connector.md`, `mcp/PRIVACY.md` and
   `PRIVACY.md` are public (URLs above).

---

## Reviewer notes

- **Safe to call repeatedly.** Lookups have no side effects. Session tools write
  only the caller's own session, and a repeat with the same `session_id` and
  arguments returns the same operation. There is no MCP transport session, so an
  instance restart cannot orphan one; workflow sessions are persisted and survive
  restarts for their retention period.
- **No data egress from the connector.** No MCP tool call makes an outbound
  network request. The one endpoint on this deployment that does call out is the
  web page's chat bar (`/chat` → Google Gemini), a separate surface no MCP tool can
  reach — see acknowledgment 2.
- **Length contract.** Generated recipes are hard-capped at 1,000 characters with
  lowest-value-first trimming.
- **Long lyric calls.** Lyric tools run as background operations polled with
  `get_operation`, so no single request waits on a long grading run.
- **Annotations.** Every tool has a `title`, `destructiveHint: false` and
  `openWorldHint: false`; `readOnlyHint` is true exactly for the lookups (see
  **Read / write**). `scripts/check_connector_contract.js` enforces this on every
  connector surface.
- **Auth note.** Authless. The connector reads no private user data (OAuth is
  required only when a connector accesses private user data); session ids are
  bearer capabilities the host keeps private.

---

## Pre-submission checklist

- [x] Remote MCP server, publicly reachable over HTTPS
- [x] Every tool has a `title` + `readOnlyHint`/`destructiveHint`/`openWorldHint` annotation
- [x] Human-readable tool names and descriptions
- [x] No private user data; no external calls; writes only the caller's own sessions
- [x] Public documentation URL live (`docs/connector.md`, repo is public)
- [x] Privacy policy URL live (`mcp/PRIVACY.md`, repo is public)
- [x] Support channel reachable (`SUPPORT.md` → GitHub Issues)
- [x] Always-on hosting (no idle spin-down)
- [ ] **Owner action — listing icon:** attach the chosen square icon at submit time
- [ ] **Owner action — submit** from a **Team or Enterprise** Claude org with
      directory-management access (Admin/Owner), via Organization settings → Directory
- [ ] **Owner action — self-attest** you've run every tool (MCP Inspector or as a
      custom connector) — see the test instructions above
