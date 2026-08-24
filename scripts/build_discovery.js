#!/usr/bin/env node
// build_discovery.js — emit the agent-discovery layer for the static API.
//
// Reads the already-generated api/*/index.json and writes:
//   llms.txt      (root)  — the agent-facing entry point, and the ONLY document
//                           that bridges this origin to the MCP connector on
//                           codex-musica-mcp.onrender.com (a sitemap cannot: see
//                           the cross-origin note above ENTRY_POINTS)
//   sitemap.xml   (root)  — entry points + every static endpoint, for crawlers
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
// ORDERING IS THE MESSAGE, so it is load-bearing and not to be shuffled casually.
// The editable engine leads and the static JSON follows. It used to be the other
// way round, with the engine section carrying a "READ THIS SECTION FIRST" shout to
// compensate — but an in-band instruction to read out of order is a much weaker
// signal than the order itself, and a model reading top-down met `api/all.json`
// first, got a usable answer, and stopped. Worse, both sections said "start here",
// which is how a reader ends up on the read-only mirror believing it is the
// product. The static JSON is only the DEFAULT recipe per tradition; the MCP
// connector is the thing that can actually be edited, so it goes first and it is
// the only section that says START HERE.
//
// The connector URL is also emitted as a markdown link in the ## Catalog list at
// the bottom, not just as a bare URL inside a prose bullet. Many llms.txt
// consumers parse rather than read: they extract the `[text](url)` link lists and
// drop the surrounding prose. Without that entry such a parser comes away with
// every static-JSON endpoint and ZERO links to the engine that does the editing.
const llms = `# Codex Musica

> A static, server-free catalog of recording "recipes" for ${tindex.count} recorded-music
> traditions and ${iindex.count} instruments. Each tradition resolves to a compressed
> descriptor-stack recipe (how to record a song in that style) plus a structured
> arrangement (ensemble, room, signal chain, tuning). All data is plain JSON served as
> static files — open a URL and read it. No API key, no server, no rate limit.

## START HERE — the live EDITABLE engine (MCP connector)
The full editable engine is a Model Context Protocol server: seed a recipe from any
tradition, then re-pick prefaces, swap part variants, override room/chain/tuning, and
add/remove instruments or traditions. Deterministic and side-effect-free (nothing is
persisted); thread the returned workspace into the next call. Everything below this
section is a SEPARATE read-only product — one pre-compiled recipe per tradition, built by
a different pipeline and worded differently. Use it for bulk reads; use the connector for
anything you want to change, and do not expect the two strings to match.

- Endpoint (Streamable HTTP, no auth): https://codex-musica-mcp.onrender.com/mcp
- Add in Claude: Settings -> Connectors -> Add custom connector -> paste the URL.
- Any MCP client works the same way (Claude, Codex CLI, Cursor, VS Code, Gemini CLI);
  registering the endpoint is the only setup.
- Server card (capabilities, for auto-discovery): https://codex-musica-mcp.onrender.com/.well-known/mcp.json
- Tools: start_recipe, edit_recipe, render_recipe, search_catalog, search_prefaces, get_instrument, get_tradition, list_traditions, list_options.
- Lyric tools (disjoint family; songwriting plan/grade, writes no words): lyric_screen, lyric_sweep, lyric_plan, lyric_grade, lyric_check, lyric_verify, lyric_types.

Do NOT fetch codex.html: it is a multi-megabyte browser GUI, it will blow your context or
fail to load, and it contains no instructions for you.

The default seed is SCAFFOLDING, not the answer: after start_recipe, push it toward the
user's words with edit_recipe. Mood/aesthetic word -> search_prefaces then set_preface on
each instrument it should color; specific gear/material/technique -> get_instrument then
set_variant; space/era/medium -> set_environment; roster -> add/remove instruments and
traditions. There are NO coherence fences — nothing is anachronistic, out-of-region, or
physically impossible (it is words for audio generation); the researched defaults are
flavor to keep or override, and every id-valid combination renders. Batch edits in one
call; present the FINAL recipe verbatim.

## Pre-compiled catalog (static JSON — bulk reads, no editing)
One recipe per tradition, pre-compiled at build time. Use it to read the whole catalog
cheaply or to work offline; use the connector above to change anything.

NOT a snapshot of what start_recipe returns. These recipes come from a search over the
axis space, the connector's from seeding a workspace and rendering it, so the two describe
the same tradition in different words. If you need the string a user would see in the app,
call the connector; if you need 2503 recipes in one fetch, this is the only thing that
does that.
- ALL default recipes in one fetch: ${BASE}/api/all.json
- List of traditions: ${BASE}/api/traditions/index.json
- One tradition (recipe + arrangement): ${BASE}/api/traditions/{id}.json
- List of instruments: ${BASE}/api/instruments/index.json
- One instrument: ${BASE}/api/instruments/{id}.json
- Catalog root / endpoint map: ${BASE}/api/index.json

Each tradition file has: id, name, family, lineage, recipe (string, <=1000 chars),
recipe_chars, score, config (the structured arrangement), and source (the raw
catalog-row fields — tuning/room/chain — that the browser app imports from). Fetch
the index to get every {id}, then fetch the per-id file you need.

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
- [Live editable engine — MCP endpoint, START HERE](https://codex-musica-mcp.onrender.com/mcp)
- [Server card (capabilities)](https://codex-musica-mcp.onrender.com/.well-known/mcp.json)
- [All default recipes (one file)](${BASE}/api/all.json)
- [Catalog index](${BASE}/api/index.json)
- [Traditions index](${BASE}/api/traditions/index.json)
- [Instruments index](${BASE}/api/instruments/index.json)
- [Agent guide](${BASE}/AGENTS.md)
- [Complete contract (data model, flags, CRUD)](${BASE}/SKILL.md)
- [Full engine + skill (clone & run)](https://github.com/WeningerII/CodexMusica)
`;
fs.writeFileSync(path.join(OUT_DIR, 'llms.txt'), llms);

// ---- sitemap.xml ----
// ENTRY POINTS FIRST, then the per-record bulk. The head of this list is the set
// of documents somebody should be able to reach cold, with no prior link; the
// tail is coverage.
//
// llms.txt was missing from it entirely (`grep llms.txt sitemap.xml` returned 0).
// The one file whose entire job is to be found — the document that tells a model
// where the connector is and how to drive it — was the one file declared to no
// index. SKILL.md and server.json had the same problem: llms.txt and AGENTS.md
// both name SKILL.md as "the complete contract" without ever giving a fetchable
// address for it, and README calls server.json part of the discovery surface.
//
// Deliberately NOT here, so nobody re-adds them as "missing":
//   • index.html — GitHub Pages serves it AT `${BASE}/`, which is already the
//     first entry. Listing both declares two URLs for one document.
//   • codex.html — the 5 MB browser GUI. llms.txt tells agents in as many words
//     not to fetch it; putting it in the machine-readable "please crawl this"
//     manifest would contradict that in the one place a machine actually looks,
//     and invite every crawler to pull 5 MB on every sitemap poll. index.html
//     links to it, so a human-facing crawler still finds it.
//   • api/browse.json — the 2.4 MB Tier-1 boot payload for the lazy-loaded app.
//     api/index.json lists it as an endpoint for the app's benefit; it is not a
//     document anyone should be told to open cold.
//   • anything on codex-musica-mcp.onrender.com — a sitemap may only declare URLs
//     under its own origin, so cross-origin entries here would simply be dropped.
//     llms.txt is the bridge that points at that host.
//
// Each entry carries the file that BACKS it, and the loop below refuses to build
// a sitemap that names a file the published tree does not contain. A sitemap
// entry that 404s is worse than no entry at all, and it would be invisible here
// otherwise, since nothing in this script has ever opened the documents it
// advertises.
const ENTRY_POINTS = [
  // Pages serves index.html AT the root path, so the URL is the bare origin.
  { url: '', backedBy: path.join(ROOT, 'index.html') },
  // Written by this script a few lines up, hence OUT_DIR and not ROOT: under
  // `--out=_dist` the repo copy is the previous build, not the one being shipped.
  { url: 'llms.txt', backedBy: path.join(OUT_DIR, 'llms.txt') },
  { url: 'AGENTS.md', backedBy: path.join(ROOT, 'AGENTS.md') },
  { url: 'SKILL.md', backedBy: path.join(ROOT, 'SKILL.md') },
  { url: 'server.json', backedBy: path.join(ROOT, 'server.json') },
];
const missing = ENTRY_POINTS.filter((e) => !fs.existsSync(e.backedBy));
if (missing.length) {
  process.stderr.write(
    'build_discovery: refusing to declare sitemap URLs with no file behind them:\n' +
      missing.map((e) => `  ${BASE}/${e.url} -> ${e.backedBy} (not found)\n`).join('')
  );
  process.exit(1);
}

const urls = [
  ...ENTRY_POINTS.map((e) => `${BASE}/${e.url}`),
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

// ---- server.json (the MCP registry manifest) ----
//
// GENERATED, because hand-maintained it went stale in public and nothing could
// say so. It advertised 1145 traditions and version 2.0.0 while the catalog held
// 2503 and mcp/package.json read 2.1.0 — and the server's own
// /.well-known/mcp.json card, which is built at runtime from `counts.traditions`
// and the package version, served the true numbers the whole time. Two
// co-advertised discovery surfaces describing the same server differently is
// worse than either being merely out of date: a registry reads this file, a
// client reads that card, and they disagree about what they are looking at.
//
// It also sat outside the freshness gate while its peers (sitemap/llms/robots)
// were byte-compared on every PR, which is precisely why it could drift for as
// long as it did. Generating it here puts it under that same gate.
//
// The description text is kept in step with the runtime card by construction:
// same sentence, same two substituted values.
const mcpPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp', 'package.json'), 'utf8'));
const serverManifest = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
  name: 'io.github.weningerii/codex-musica',
  title: 'Codex Musica',
  description:
    `Deterministic recording-recipe workspace: seed a recipe from any of ${tindex.count} music ` +
    'traditions and edit it (prefaces, part variants, room/chain/tuning, instruments) — ' +
    'the headless twin of the browser app, read-only and reproducible. Plus the lyric_* ' +
    'family: seeded song-shape planning and whole-song lyric grading (rhyme bans, verbatim ' +
    'returns, meter fit) — a disjoint, stateless songwriting harness.',
  version: mcpPkg.version,
  websiteUrl: BASE,
  repository: {
    url: 'https://github.com/WeningerII/CodexMusica',
    source: 'github',
  },
  remotes: [
    {
      type: 'streamable-http',
      url: 'https://codex-musica-mcp.onrender.com/mcp',
    },
  ],
};
fs.writeFileSync(path.join(OUT_DIR, 'server.json'), JSON.stringify(serverManifest, null, 2) + '\n');

process.stderr.write(
  `Wrote llms.txt, sitemap.xml (${urls.length} urls), robots.txt, server.json to ${OUT_DIR}, base=${BASE}\n`
);
