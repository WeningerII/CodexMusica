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
| **Server / endpoint URL** | `https://codex-musica-mcp.onrender.com/mcp` |
| **Health check** | `https://codex-musica-mcp.onrender.com/health` |
| **Website** | `https://weningerii.github.io/CodexMusica` |
| **Documentation URL** | `https://github.com/WeningerII/CodexMusica/blob/main/docs/connector.md` |
| **Privacy policy URL** | `https://github.com/WeningerII/CodexMusica/blob/main/PRIVACY.md` |
| **Support URL** | `https://github.com/WeningerII/CodexMusica/blob/main/SUPPORT.md` (issues: `https://github.com/WeningerII/CodexMusica/issues`) |
| **Source repository** | `https://github.com/WeningerII/CodexMusica` (public) |
| **Icon** | `assets/icon-1024.png` (1024×1024) — also `assets/icon-512.png`, source `assets/icon.svg` |

All doc/privacy/support URLs are live and public (the repo is public).

---

## Listing

| Field | Value |
|---|---|
| **Name** | CodexMusica |
| **Tagline** | Turn a plain-language vibe into a precise recording recipe. |
| **Category** | Creative / Music production |
| **Transport** | Streamable HTTP (stateless — a fresh server/transport per request, no sessions) |
| **Authentication** | **None** — open, read-only compute. No accounts, no user data accessed. |
| **Read / write** | **Read-only.** Every tool is annotated `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`, each with a human-readable `title`. |
| **External calls** | None. Closed-world; zero runtime dependencies; responses are derived entirely from the bundled catalog. |

### Short description (≈50 words)

CodexMusica turns a plain-language musical request — a genre, an era, a mood, an
instrument — into a precise, structured recording recipe: the instruments,
materials, room, signal chain, and per-instrument *prefaces* (named
aesthetic/technique signatures) that define how to record it. Backed by a
structured catalog spanning 1165 traditions and 651 instruments. Read-only and
stateless; no account or personal data.

### Long description (≈120 words)

CodexMusica is a recording-arrangement engine exposed as read-only tools. Its
catalog places **1165 recorded-music traditions** in a 13-dimensional parameter
space alongside **651 instruments** (decomposed into per-part variants), **256
rooms**, **120 tunings**, and **649 "prefaces"** — named aesthetic/technique/
delivery signatures (e.g. `satirical`, `keening`, `jhala-cascading`) that map
*intent → physical settings*.

Ask for a sound in plain language and Claude resolves it to real catalog ids,
seeds a tradition's deterministic default recipe — identical to what a human sees
in the companion app — then edits it: re-picking an instrument's preface (which
re-derives its physical settings), swapping part variants, overriding room/chain/
tuning, and adding or removing instruments and traditions. The result is a compact
descriptor-stack "recipe" under 1,000 characters, naming the parts, materials,
room, and signal chain to track it with. State is passed in and out, so the recipe
is reproducible and matches the app exactly.

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

---

## Tools

All 9 tools are read-only and deterministic, and state is passed in and out (no
sessions). Each is annotated `readOnlyHint`/`idempotentHint`/`openWorldHint:false`
with a human-readable `title`.

| Tool | Title | One-line summary |
|---|---|---|
| `start_recipe` | Start a recipe from tradition(s) | Seed a recipe from one or more tradition ids (first = primary, the rest explicit staples) — deterministic default cards, identical to the app's "Current Recipe". Returns the recipe, a per-card summary, and the `workspace` to thread on. |
| `edit_recipe` | Edit the recipe | Apply an ordered list of edits to a workspace and re-render: `set_preface` (re-derive an instrument toward a mood, labeled verbatim), `set_variant`, `set_environment` (room/tuning/chain), `add`/`remove_instrument`, `add`/`remove_tradition`. |
| `render_recipe` | Re-render the workspace | Render an existing workspace again (e.g. a different format or `max_chars`) without editing it. |
| `search_catalog` | Search the whole catalog | Free-text search across every record type (traditions incl. lineage, instruments, part-variants, rooms, tunings, arrangements, aesthetics, prefaces) — turns request words into real ids. |
| `search_prefaces` | Search prefaces | Search the 649 prefaces (aesthetic/technique/delivery signatures) by free text; returns ranked ids with their descriptor-token signatures. |
| `get_instrument` | Get one instrument (the knob catalog) | Every part and the variant ids you can pass to `set_variant`, with labels and defaults. |
| `get_tradition` | Get one tradition | Name, family, lineage, and the 13-axis profile for one tradition. |
| `list_traditions` | List / filter traditions | Enumerate traditions, optionally filtered by substring or family. |
| `list_options` | Enumerate an option space | Valid ids for rooms / tunings / chain sections / archetypes / aesthetics / arrangements / families / axes. |

---

## Reviewer test / access instructions (authless)

**No credentials are required** — the server is open, read-only, and stateless.

1. Add `https://codex-musica-mcp.onrender.com/mcp` as a custom connector in Claude
   (**Settings → Connectors → Add custom connector**), or point **MCP Inspector**
   (or any MCP client) at that URL. No sign-in, no API key.
2. The endpoint is kept warm (no cold-start spin-down), so the handshake responds
   immediately.
3. Suggested end-to-end exercise of every tool:
   - `list_options` with `kind: "families"` → see the option spaces.
   - `search_catalog` `"face-melting sitar"` → resolves request words to real ids.
   - `search_prefaces` `"satirical"` → ranked preface ids.
   - `list_traditions` filter `"blues"`; `get_tradition` `delta_blues`;
     `get_instrument` `electric_guitar`.
   - `start_recipe` with `tradition_ids: ["delta_blues"]` → returns a recipe +
     `workspace`.
   - `edit_recipe` on that `workspace` (e.g. `set_preface` toward a mood, or
     `set_environment` to override the room) → re-rendered recipe.
   - `render_recipe` on the workspace with a different `max_chars`.

Every call is idempotent and side-effect-free; repeat freely.

---

## Policy acknowledgments (the form requires all seven)

1. **Directory guidelines** — compliant; read-only creative/reference tool.
2. **First-party API usage** — the server computes entirely from its own bundled,
   immutable catalog. It proxies no third-party API and makes **no outbound
   network calls**.
3. **No financial transactions** — the connector moves no money, crypto, or
   financial assets.
4. **No AI media generation** — it returns **deterministic text** recording
   *recipes/descriptors*; it does not generate audio, images, or video via AI
   models.
5. **Prompt-injection safety** — read-only, closed-world, no external actions; the
   worst case of any tool is returning catalog-derived text. No tool can write,
   delete, spend, or call out.
6. **Conversation data collection** — none. Stateless; request content is not
   persisted or used for training (see PRIVACY.md).
7. **Public documentation** — `docs/connector.md` and `PRIVACY.md` are public
   (URLs above).

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
  directory (OAuth is only required when a connector accesses private user data);
  the web custom-connector and directory paths handle authless servers fine.

---

## Pre-submission checklist

- [x] Remote MCP server, publicly reachable over HTTPS
- [x] Every tool has a `title` + `readOnlyHint`/`destructiveHint` annotation
- [x] Human-readable tool names and descriptions
- [x] Read-only; no private user data; no external calls
- [x] Public documentation URL live (`docs/connector.md`, repo is public)
- [x] Privacy policy URL live (`PRIVACY.md`, repo is public)
- [x] Support channel reachable (`SUPPORT.md` → GitHub Issues)
- [x] Hosting kept warm during review (endpoint configured not to spin down)
- [ ] **Owner action — listing icon:** attach the chosen square icon at submit time
- [ ] **Owner action — submit** from a **Team or Enterprise** Claude org with
      directory-management access (Admin/Owner), via Organization settings → Directory
- [ ] **Owner action — self-attest** you've run every tool (MCP Inspector or as a
      custom connector) — see the test instructions above
