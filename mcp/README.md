# CodexMusica MCP server

This drives the CodexMusica **deterministic workspace** as callable tools for AI
agents — the same canvas a human edits in the browser app, headless. An agent
seeds a tradition's default cards (identical to the app's "Current Recipe"), then
edits them: re-pick an instrument's **preface** (which deterministically re-derives
its variants/tuning/room/chain), swap a part variant, override room/chain/tuning,
add or remove instruments, add or remove traditions. State is passed in and out —
each recipe call returns the `workspace` to thread into the next. There is **no
scoring search and no auto-staple**: the recipe is reproducible and equal to what a
human sees in the app.

It reuses the shared SSOT modules in-process (`scripts/_workspace_ops.js` →
`_seed_workspace.js` / `_recipe_stack.js` / `_inverse_configure.js`, the catalog in
`references/`); it adds no new music logic.

## Tools

| Tool | What it does |
|---|---|
| `start_recipe` | Seed a recipe from one or more `traditions` (first = primary, rest = explicit staples). Returns the recipe, a per-card summary, and the `workspace` to thread on. |
| `edit_recipe` | Apply an ordered `edits` list to a `workspace`: `set_preface` (re-derive an instrument toward a mood, labeled verbatim), `set_variant`, `set_environment`, `add_instrument` / `remove_instrument`, `add_tradition` / `remove_tradition`. |
| `render_recipe` | Re-render a `workspace` (e.g. different `format` or `max_chars`) without editing it. |
| `search_catalog` | Free-text search → ids, across traditions, instruments, variants, rooms, tunings, arrangements, aesthetics, prefaces, chain. Resolve words before guessing. |
| `search_prefaces` | Mood/feel words → preface ids for `set_preface`. |
| `get_instrument` | The **knob catalog** — every part and the variant ids you pass to `set_variant`. |
| `get_tradition` / `list_traditions` | Full tradition record (incl. axis profile + default instruments); browse/filter traditions. |
| `list_options` | Enumerate override spaces: `rooms`, `tunings`, `chain_sections`, `archetypes`, `aesthetics`, `arrangements`, `instrument_families`, `tradition_families`, `axes`. |

## Quick start

```sh
cd mcp
npm ci          # install (or: npm install)
npm test        # engine checks against the deterministic workspace (server build needs the SDK)
```

### Local use (stdio — runs on your machine, zero hosting)

```sh
npm run stdio
```

Wire it into a desktop MCP client. Example client config entry:

```json
{
  "mcpServers": {
    "codex-musica": {
      "command": "node",
      "args": ["/absolute/path/to/CodexMusica/mcp/server_stdio.js"]
    }
  }
}
```

Inspect it interactively:

```sh
npm run inspect   # opens the MCP Inspector against the stdio server
```

### Hosted use (the Connectors menu)

This is what makes "CodexMusica" appear in Claude's **Connectors** list with its own
toggle. Deploy `server_http.js` to any Node host (Render, Fly, Railway, a VPS):

```sh
npm start         # serves Streamable HTTP on http://localhost:3000/mcp  (PORT overridable)
```

Then in Claude → **Add connectors → custom** → paste your public `https://…/mcp` URL.

#### Deploy to Render (one step)

A `render.yaml` blueprint is included at the repo root:

1. Render dashboard → **New + → Blueprint** → connect `WeningerII/CodexMusica` → **Apply**. It builds `mcp/Dockerfile` and probes `/health`.
2. Your endpoint is `https://<service-name>.onrender.com/mcp`.
3. Claude → **Add connectors → custom** → paste that `…/mcp` URL.

Notes: the `free` plan **spins down when idle** — the first call after a lull cold-starts in ~30–60s, which can stall the connector handshake; bump to `starter` to stay warm. The blueprint deploys from `main` (configured in `render.yaml`).

- **No login.** The engine is read-only compute, so the server is open. Don't add
  auth for onboarding; put **edge rate-limiting** in front (e.g. Cloudflare) to
  catch runaway/broken agents. Add API-key/OAuth metering later only if you monetize.
- `GET /health` is a plain health check for your host's probes.
- **Scaling:** the server is stateless (no in-process sessions), so it scales
  horizontally without sticky sessions — run as many instances as you like.
- **Cloudflare Workers** specifically: port `server_http.js` to
  `WebStandardStreamableHTTPServerTransport` (the SDK's web-standard variant); the
  Node transport used here targets Node hosts.

## Cost

Pure deterministic compute — no model inference, no GPU, no database. Per call is
milliseconds of CPU and a few KB of JSON, and results are deterministic (cacheable).
At personal usage it's effectively free; even at scale the dominant lever is response
size + caching, not compute.

## Privacy & support

See [PRIVACY.md](./PRIVACY.md) — in short: no accounts, no auth, no personal
data; stateless compute over a public catalog, persisting no request content.

- **Privacy policy:** https://github.com/WeningerII/CodexMusica/blob/main/mcp/PRIVACY.md
- **Support:** https://github.com/WeningerII/CodexMusica/issues

## Connectors Directory readiness

For submission to Anthropic's [Connectors Directory](https://claude.com/docs/connectors/building/submission):

- ✅ Public HTTPS endpoint; handlers return in milliseconds (far under the 5-minute limit); tool results are small (far under the 25k-token cap).
- ✅ Every tool carries annotations — all `readOnlyHint: true` (they compute over a fixed catalog and mutate nothing), plus `idempotentHint`/`openWorldHint: false`.
- ✅ No authentication required (open, read-only public data).
- ✅ Privacy policy + support channel (above); all listed domains are owned by the publisher.
- ⚠️ **Host on a non-sleeping instance** before submitting — the Render free tier spins down after idle, which delays the first request ~50s; reviewers and users need prompt responses.

## Files

- `engine.js` — the deterministic workspace surface (start/edit/render + discovery) over `scripts/_workspace_ops.js`; validation + state-passing response shaping.
- `tools.js` — MCP tool definitions (zod schemas) + `buildServer()`.
- `server_stdio.js` — stdio entry (local).
- `server_http.js` — Streamable HTTP entry (hosted connector).
- `test.mjs` — `npm test`.
