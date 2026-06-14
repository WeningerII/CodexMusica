# CodexMusica MCP server

This turns the CodexMusica **engine** into callable tools for AI agents — the same
reach a human has in the browser app, not a read-only lookup of precompiled
defaults. An agent can blend traditions, add/remove instruments, swap part
variants, target an axis profile, and override room/arrangement, then iterate on
the result. Every recipe response also carries an `affordances` block — the knobs
still available — so the tool behaves like an instrument to play, not a table to read.

It wraps the existing engine in-process (`scripts/search.js`, `scripts/translate.js`,
the catalog in `references/`); it adds no new music logic.

## Tools

| Tool | What it does |
|---|---|
| `generate_recipe` | Recipe for one tradition or a blend (first = primary, rest stapled). Customize: `exclude_instruments`, `add_instruments`, `swap_variants`, `arrangement`, `room`, `staple_mode`, `max_chars`. |
| `blend_traditions` | Weighted two-way blend on a dial (`weight`: 0 = pure A, 0.5 = max blend, 1 = pure B). |
| `recipe_from_axis` | Best-fit tradition for an axis profile (e.g. `"harm:1,density:2,intensity:2"`), then its recipe. |
| `list_traditions` / `get_tradition` | Discover/search traditions; full record incl. axis profile. |
| `list_instruments` / `get_instrument` | Discover instruments; `get_instrument` is the **knob catalog** — every part and the variant ids you pass to `swap_variants`. |
| `find_similar_traditions` | Nearest traditions by axis distance (what to blend next). |
| `list_options` | Enumerate override spaces: `rooms`, `tunings`, `chain_sections`, `archetypes`, `aesthetics`, `arrangements`, `instrument_families`, `tradition_families`, `axes`. |

## Quick start

```sh
cd mcp
npm ci          # install (or: npm install)
npm test        # 11 checks against the live engine
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

Notes: the `free` plan **spins down when idle** — the first call after a lull cold-starts in ~30–60s, which can stall the connector handshake; bump to `starter` to stay warm. The blueprint deploys from the `claude/happy-lamport-8t4yw5` branch; change `branch:` to `main` after you merge.

- **No login.** The engine is read-only compute, so the server is open. Don't add
  auth for onboarding; put **edge rate-limiting** in front (e.g. Cloudflare) to
  catch runaway/broken agents. Add API-key/OAuth metering later only if you monetize.
- `GET /health` is a plain health check for your host's probes.
- **Scaling:** sessions are kept in-process and in-memory, so run a single instance
  or use sticky sessions if you scale horizontally.
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

- `engine.js` — in-process adapter over the CJS engine (validation, response shaping, affordances).
- `tools.js` — MCP tool definitions (zod schemas) + `buildServer()`.
- `server_stdio.js` — stdio entry (local).
- `server_http.js` — Streamable HTTP entry (hosted connector).
- `test.mjs` — `npm test`.
