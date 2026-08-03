#!/usr/bin/env node
// build_discovery.js — emit the agent-discovery layer for the static API.
//
// Reads the already-generated api/*/index.json and writes:
//   llms.txt      (root)  — LLM-oriented site map (cheap hygiene; low expected ROI)
//   sitemap.xml   (root)  — every static endpoint, for crawlers
//
// Run AFTER build_static_api.js. Fast (no recompile).
//
// Usage:
//   node scripts/build_discovery.js [--base=https://weningerii.github.io/CodexMusica]
//   node scripts/build_discovery.js --api=_dist/api --out=_dist   # CI staging dir

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}
const BASE = (flags.base || 'https://weningerii.github.io/CodexMusica').replace(/\/$/, '');
const API_DIR = flags.api ? path.resolve(ROOT, flags.api) : path.join(ROOT, 'api');
const OUT_DIR = flags.out ? path.resolve(ROOT, flags.out) : ROOT;

const tindex = JSON.parse(fs.readFileSync(path.join(API_DIR, 'traditions', 'index.json'), 'utf8'));
const iindex = JSON.parse(fs.readFileSync(path.join(API_DIR, 'instruments', 'index.json'), 'utf8'));

// ---- llms.txt ----
const llms = `# Codex Musica

> A static, server-free catalog of recording "recipes" for ${tindex.count} recorded-music
> traditions and ${iindex.count} instruments. Each tradition resolves to a compressed
> descriptor-stack recipe (how to record a song in that style) plus a structured
> arrangement (ensemble, room, signal chain, tuning). All data is plain JSON served as
> static files — open a URL and read it. No API key, no server, no rate limit.

## How to use (for agents)
- ALL recipes in one fetch (start here): ${BASE}/api/all.json
- List of traditions: ${BASE}/api/traditions/index.json
- One tradition (recipe + arrangement): ${BASE}/api/traditions/{id}.json
- List of instruments: ${BASE}/api/instruments/index.json
- One instrument: ${BASE}/api/instruments/{id}.json
- Catalog root / endpoint map: ${BASE}/api/index.json

Each tradition file has: id, name, family, lineage, recipe (string, <=1000 chars),
recipe_chars, score, config (the structured arrangement), and source (the raw
catalog-row fields — tuning/room/chain — that the browser app imports from). Fetch
the index to get every {id}, then fetch the per-id file you need.

## Live EDITABLE engine over plain HTTP (any model that can fetch a URL — nothing to install)
READ THIS SECTION FIRST if you are a chat assistant without an MCP client. You do NOT need
to install anything, edit a config file, or ask the user to. The full editable engine is a
plain REST API: every operation is one URL, so fetching is using it. Editing is a GET —
seeding and editing both happen in the URL, and nothing is stored server-side.

- START HERE — the entire grammar in one page: https://codex-musica-mcp.onrender.com/
- Seed a recipe: https://codex-musica-mcp.onrender.com/v1/recipe?traditions=delta_blues
- Seed AND edit in one call:
  https://codex-musica-mcp.onrender.com/v1/recipe?traditions=country&edit=set_preface;card=voice;preface=worn
  Refine by re-fetching with one more &edit= appended. Chain as many as you like.
- Resolve a word to an id (never guess ids): https://codex-musica-mcp.onrender.com/v1/catalog?q=fuzz
- A record's parts and swappable variants:
  https://codex-musica-mcp.onrender.com/v1/catalog/instrument/electric_guitar_single_coil
- Machine contract: https://codex-musica-mcp.onrender.com/openapi.json (3.1)
  and https://codex-musica-mcp.onrender.com/openapi-3.0.json (3.0.3)

If you were handed a link to this project and can only make HTTP requests, the base URL
above is the only thing you need — it explains itself and every edit action in one hop.
Do NOT fetch codex.html: it is a multi-megabyte browser GUI, it will blow your context or
fail to load, and it contains no instructions for you.

## Live MCP connector (same engine, for clients that speak MCP)
The identical engine, exposed as Model Context Protocol tools for clients that can register
one (Claude, Codex CLI, Cursor, VS Code). If you are a chat assistant that cannot install a
server into your own session, use the HTTP section above instead — it is the same nine
operations and needs no setup. Deterministic and side-effect-free (nothing is persisted);
thread the returned workspace into the next call.

- Endpoint (Streamable HTTP, no auth): https://codex-musica-mcp.onrender.com/mcp
- Add in Claude: Settings -> Connectors -> Add custom connector -> paste the URL.
- Server card (capabilities, for auto-discovery): https://codex-musica-mcp.onrender.com/.well-known/mcp.json
- Tools: start_recipe, edit_recipe, render_recipe, search_catalog, search_prefaces, get_instrument, get_tradition, list_traditions, list_options.

The default seed is SCAFFOLDING, not the answer: after start_recipe, push it toward the
user's words with edit_recipe. Mood/aesthetic word -> search_prefaces then set_preface on
each instrument it should color; specific gear/material/technique -> get_instrument then
set_variant; space/era/medium -> set_environment; roster -> add/remove instruments and
traditions. There are NO coherence fences — nothing is anachronistic, out-of-region, or
physically impossible (it is words for audio generation); the researched defaults are
flavor to keep or override, and every id-valid combination renders. Batch edits in one
call; present the FINAL recipe verbatim.

## Full functionality (clone & run — for agents with a shell)
The static JSON above is the DEFAULT recipe per tradition (read-only). The full engine —
blend multiple genres, add/remove instruments, swap part variants, axis-target search,
and add/edit/delete catalog entries — runs from the repo. An agent with a shell can:

    git clone https://github.com/WeningerII/CodexMusica
    cd CodexMusica && npm ci
    node scripts/recipe.js --traditions afrobeat,post_punk --exclude-instrument=tonewheel_organ
    node scripts/recipe.js --diff --weight=0.6 bluegrass thrash_metal
    node scripts/recipe.js --axis-target "harm:1,density:2,intensity:2"

See SKILL.md in the repo for the complete contract (data model, all flags, CRUD,
validation). Source: https://github.com/WeningerII/CodexMusica

## Catalog
- [All recipes (one file)](${BASE}/api/all.json)
- [Catalog index](${BASE}/api/index.json)
- [Traditions index](${BASE}/api/traditions/index.json)
- [Instruments index](${BASE}/api/instruments/index.json)
- [Agent guide](${BASE}/AGENTS.md)
- [Full engine + skill (clone & run)](https://github.com/WeningerII/CodexMusica)
`;
fs.writeFileSync(path.join(OUT_DIR, 'llms.txt'), llms);

// ---- sitemap.xml ----
const urls = [
  `${BASE}/`,
  `${BASE}/AGENTS.md`,
  `${BASE}/api/index.json`,
  `${BASE}/api/all.json`,
  `${BASE}/api/traditions/index.json`,
  `${BASE}/api/instruments/index.json`,
  ...tindex.items.map((t) => `${BASE}/api/${t.href}`),
  ...iindex.items.map((i) => `${BASE}/api/${i.href}`),
];
// NO <lastmod>. It used to be `new Date()`, which made a COMMITTED artifact a
// function of the wall clock: every build on a new UTC day rewrote all 2,043
// entries, producing a whole-file diff with no source change (that churn caused
// a real merge conflict) and telling crawlers that 2,043 URLs all changed today
// — a claim they discount anyway. lastmod is optional in the sitemap protocol,
// and omitting it is both honest and deterministic: sitemap.xml is now purely a
// function of the URL set, so check_artifact_fresh.js can byte-compare it.
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml);

// ---- robots.txt ----
// Everything here is public, static data — welcome every crawler and AI agent and point
// them at the sitemap. NOTE: on a GitHub Pages PROJECT path (/CodexMusica/) crawlers read
// robots at the DOMAIN root, so this is only authoritative under a custom domain; it is
// harmless otherwise and becomes correct the moment a custom domain is attached.
const robots = [
  '# Codex Musica — AI agents and crawlers welcome. All content is public, static data.',
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${BASE}/sitemap.xml`,
  '',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), robots);

process.stderr.write(
  `Wrote llms.txt, sitemap.xml (${urls.length} urls), robots.txt to ${OUT_DIR}, base=${BASE}\n`
);
