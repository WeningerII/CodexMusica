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
recipe_chars, score, and config (the structured arrangement). Fetch the index to get
every {id}, then fetch the per-id file you need.

## Full functionality (clone & run — for agents with a shell)
The static JSON above is the DEFAULT recipe per tradition (read-only). The full engine —
blend multiple genres, add/remove instruments, swap part variants, axis-target search,
and add/edit/delete catalog entries — runs from the repo. An agent with a shell can:

    git clone https://github.com/WeningerII/CodexMusica
    cd CodexMusica && npm ci
    node scripts/recipe.js --traditions afrobeat,post_punk --exclude-instrument=tonewheel_organ
    node scripts/recipe.js --diff bluegrass thrash_metal --weight=0.6
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
const today = new Date().toISOString().slice(0, 10);
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls
    .map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml);

process.stderr.write(
  `Wrote llms.txt and sitemap.xml (${urls.length} urls) to ${OUT_DIR}, base=${BASE}\n`
);
