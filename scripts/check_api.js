#!/usr/bin/env node
// check_api.js — the static-API contract gate.
//
// @covers: recipe-char-ceiling, all-traditions-one-fetch, every-id-resolves
//
// WHY: the published static API (api/*.json) is the agent-facing PRODUCT — every
// external agent is told to fetch it (AGENTS.md, llms.txt, index.html). Yet nothing
// verified it: build_static_api.js used to fail OPEN (a tradition that failed to
// compile was silently skipped, dropping all.json below the promised count), and no
// gate checked the published files against the catalog. This closes that: it asserts
// the artifact honors every documented promise.
//
// What it checks (fast — reads committed JSON, no recompile):
//   • Completeness — traditions/index, all.json, and the per-id files cover EXACTLY
//     the catalog's traditions (the "all <N> traditions in one fetch" promise); same
//     for instruments.
//   • Recipe ceiling — every recipe <= 1000 chars (AGENTS.md / llms.txt promise).
//   • recipe_chars accuracy — equals the recipe's true length (no drift).
//   • Id resolvability — every id in each tradition's `config` (room, archetype,
//     tuning, inline_chain, fx_extras, instruments + their slot variants) resolves
//     against the current catalog (the "every id resolvable" promise) — this is what
//     catches the published snapshot drifting from references/.
//   • index.json counts match the catalog.
//   • nav_glyphs.json is exactly NAV_GLYPH_SVGS (the art the lazy shell fetches).
//   • tradition_images.json and instrument_images.json are exactly what
//     scripts/_image_tables.js derives from references/_image_manifest.json.
//   • browse.json, browse_boot.json and browse_prose.json are exactly what
//     scripts/_browse_tables.js derives from the catalog (the lazy app boots
//     from the second and reads the third after its first paint; the first
//     stays published).
//   • engine.json (the instrument engine the lazy shell fetches) is exactly what
//     scripts/_page_tables.js derives from references/: one element per line,
//     unmerged, page-stripped, its digest the digest of its tables.
//
// Usage:
//   node scripts/check_api.js                 # check the committed api/
//   node scripts/check_api.js --api=_dist/api # check a freshly built dir (CI publish)
//   node scripts/check_api.js --verbose       # list every problem (default: first 40)
//   node scripts/check_api.js --json
// Exit 0 if the artifact honors the contract, 1 otherwise.

'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_loader.js');
const {
  readImageManifest,
  compactInstrumentImages,
  compactTraditionImages,
} = require('./_image_tables.js');
const B = require('./_browse_tables.js');
const P = require('./_page_tables.js');
const {
  buildResolver,
  recordProblems,
  traditionSource,
  stripExpandedVariants,
} = require('./_api_contract.js');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}
const API = flags.api ? path.resolve(ROOT, flags.api) : path.join(ROOT, 'api');
const VERBOSE = !!flags.verbose;
const MAX_SHOWN = VERBOSE ? Infinity : 40;

const problems = [];
const fail = (msg) => problems.push(msg);

function readJson(rel) {
  const p = path.join(API, rel);
  if (!fs.existsSync(p)) {
    fail(`missing file: ${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`invalid JSON in ${rel}: ${e.message}`);
    return null;
  }
}

// Compare two id sets and report missing / extra against the catalog.
function diffIds(label, actualIds, expectedIds) {
  const actual = new Set(actualIds);
  const expected = new Set(expectedIds);
  const missing = [...expected].filter((id) => !actual.has(id));
  const extra = [...actual].filter((id) => !expected.has(id));
  if (missing.length)
    fail(
      `${label}: ${missing.length} catalog id(s) missing (e.g. ${missing.slice(0, 5).join(', ')})`
    );
  if (extra.length)
    fail(`${label}: ${extra.length} id(s) not in catalog (e.g. ${extra.slice(0, 5).join(', ')})`);
}

const R = buildResolver(C);
const tradIds = C.TRADITIONS.map((t) => t.id);
const instIds = C.INSTRUMENTS.map((i) => i.id);
const tradById = new Map(C.TRADITIONS.map((t) => [t.id, t]));
const instById = new Map(C.INSTRUMENTS.map((i) => [i.id, i]));
const recipeById = new Map(); // per-id recipe text, cross-checked against all.json

// Stable structural equality via canonical JSON. Both sides derive from the same
// deterministic load+merge, so key order matches and string equality is exact.
const stable = (o) => JSON.stringify(o);

// Verify an index file's items beyond id-set membership: the href must point at
// the real per-id file (which must exist on disk), and the denormalized
// name/family must match the catalog. The index is the agent's entry map — a
// broken href or fabricated row sends every downstream fetch to a 404 or the
// wrong record, which the count/id checks alone never catch.
function checkIndexItems(label, items, dir, byId) {
  for (const it of items) {
    const cat = byId.get(it.id);
    if (!cat) continue; // diffIds already reports unknown/missing ids
    const expectHref = `${dir}/${it.id}.json`;
    if (it.href !== expectHref)
      fail(`${label}[${it.id}]: href="${it.href}", expected "${expectHref}"`);
    else if (!fs.existsSync(path.join(API, it.href)))
      fail(`${label}[${it.id}]: href target missing on disk: ${it.href}`);
    if (it.name !== cat.name)
      fail(`${label}[${it.id}]: name="${it.name}" != catalog "${cat.name}"`);
    if (it.family !== cat.family)
      fail(`${label}[${it.id}]: family="${it.family}" != catalog "${cat.family}"`);
  }
}

// ───────────────────────── traditions ─────────────────────────
const tindex = readJson('traditions/index.json');
if (tindex) {
  if (tindex.count !== C.TRADITIONS.length)
    fail(`traditions/index.json count=${tindex.count}, catalog has ${C.TRADITIONS.length}`);
  const items = Array.isArray(tindex.items) ? tindex.items : [];
  if (items.length !== tindex.count)
    fail(`traditions/index.json: count=${tindex.count} but items.length=${items.length}`);
  diffIds(
    'traditions/index.json',
    items.map((x) => x.id),
    tradIds
  );
  checkIndexItems('traditions/index.json', items, 'traditions', tradById);

  // Per-id files: each catalog tradition has a file that honors the record
  // contract AND carries the catalog's own name/family/lineage (not fabricated
  // metadata). Recipes are captured for the all.json cross-check below.
  let checked = 0;
  for (const id of tradIds) {
    const rec = readJson(`traditions/${id}.json`);
    if (!rec) continue; // readJson already logged the miss
    if (rec.id !== id) fail(`traditions/${id}.json: id field is "${rec.id}"`);
    for (const p of recordProblems(rec, R)) fail(`traditions/${id}.json — ${p}`);
    const cat = tradById.get(id);
    if (cat) {
      if (rec.name !== cat.name)
        fail(`traditions/${id}.json: name="${rec.name}" != catalog "${cat.name}"`);
      if (rec.family !== cat.family)
        fail(`traditions/${id}.json: family="${rec.family}" != catalog "${cat.family}"`);
      if ((rec.lineage || null) !== (cat.lineage || null))
        fail(`traditions/${id}.json: lineage differs from catalog`);
    }
    // `source` (the import payload for the lazy-loaded app) must be a verbatim
    // projection of the CURRENT catalog row — this is the check that catches a
    // published snapshot drifting from references/ after a chain/tuning edit.
    const wantSource = JSON.stringify(traditionSource(cat));
    if (JSON.stringify(rec.source) !== wantSource) {
      fail(`traditions/${id}.json — source != catalog row projection (tuning/room/parts/chain_*)`);
    }
    if (typeof rec.recipe === 'string') recipeById.set(id, rec.recipe);
    checked++;
  }
  if (!VERBOSE) console.error(`  …validated ${checked} tradition files`);

  // Retired ids (references/_tradition_aliases.json): each stays a working URL
  // whose file is the surviving tradition's record plus `merged_from`, the index
  // lists every alias, and nothing else sits in traditions/ — a file for an id
  // that is neither live nor an alias is a stale artifact.
  const want = Object.keys(C.TRADITION_ALIASES).sort();
  const rows = Array.isArray(tindex.aliases) ? tindex.aliases : [];
  diffIds(
    'traditions/index.json aliases',
    rows.map((r) => r.id),
    want
  );
  for (const r of rows) {
    const a = C.TRADITION_ALIASES[r.id];
    if (!a) continue;
    if (tradById.has(r.id)) fail(`alias ${r.id} is also a live tradition id`);
    if (r.of !== a.of || r.name !== a.name || r.href !== `traditions/${r.id}.json`)
      fail(`traditions/index.json aliases[${r.id}] != registry ({of, name, href})`);
    const rec = readJson(`traditions/${r.id}.json`);
    const target = readJson(`traditions/${a.of}.json`);
    if (!rec || !target) continue;
    const { merged_from, ...rest } = rec;
    if (merged_from !== r.id) fail(`traditions/${r.id}.json: merged_from="${merged_from}"`);
    if (stable(rest) !== stable(target))
      fail(`traditions/${r.id}.json is not the record of ${a.of} (plus merged_from)`);
  }
  const allowed = new Set([...tradIds, ...want, 'index'].map((id) => `${id}.json`));
  const stray = fs.readdirSync(path.join(API, 'traditions')).filter((f) => !allowed.has(f));
  if (stray.length)
    fail(
      `traditions/: ${stray.length} stale file(s) for no live or alias id (e.g. ${stray.slice(0, 5).join(', ')})`
    );
  if (!VERBOSE) console.error(`  …validated ${rows.length} alias files`);
}

// ───────────────────────── all.json (the "one fetch" payload) ─────────────────────────
const all = readJson('all.json');
if (all) {
  if (all.count !== C.TRADITIONS.length)
    fail(`all.json count=${all.count}, catalog has ${C.TRADITIONS.length}`);
  const items = Array.isArray(all.items) ? all.items : [];
  if (items.length !== all.count)
    fail(`all.json: count=${all.count} but items.length=${items.length}`);
  diffIds(
    'all.json',
    items.map((x) => x.id),
    tradIds
  );
  const wantAliases = Object.fromEntries(
    Object.keys(C.TRADITION_ALIASES)
      .sort()
      .map((id) => [id, C.TRADITION_ALIASES[id].of])
  );
  if (stable(all.aliases) !== stable(wantAliases)) fail('all.json aliases != registry');
  for (const item of items) {
    // all.json items carry recipe + recipe_chars but no config (by design).
    for (const p of recordProblems(item, R, { requireConfig: false }))
      fail(`all.json[${item.id}] — ${p}`);
    // The "one fetch" payload must agree with the per-id file an agent would
    // otherwise fetch — a recipe present in all.json but different per-id (or
    // fabricated in either) is a silent contradiction the count/ceiling checks
    // can't see.
    const perId = recipeById.get(item.id);
    if (perId !== undefined && item.recipe !== perId) {
      fail(`all.json[${item.id}]: recipe differs from traditions/${item.id}.json`);
    }
    const cat = tradById.get(item.id);
    if (cat) {
      if (item.name !== cat.name)
        fail(`all.json[${item.id}]: name="${item.name}" != catalog "${cat.name}"`);
      if (item.family !== cat.family)
        fail(`all.json[${item.id}]: family="${item.family}" != catalog "${cat.family}"`);
    }
  }
}

// ───────────────────────── browse.json (the published Tier-1 index) ─────────────────────────
const browse = readJson('browse.json');
if (browse) {
  if (browse.count !== C.TRADITIONS.length)
    fail(`browse.json count=${browse.count}, catalog has ${C.TRADITIONS.length}`);
  const items = Array.isArray(browse.items) ? browse.items : [];
  if (items.length !== browse.count)
    fail(`browse.json: count=${browse.count} but items.length=${items.length}`);
  diffIds(
    'browse.json',
    items.map((x) => x.id),
    tradIds
  );
  const wantBrowseAliases = Object.fromEntries(
    Object.keys(C.TRADITION_ALIASES)
      .sort()
      .map((id) => [id, { of: C.TRADITION_ALIASES[id].of, name: C.TRADITION_ALIASES[id].name }])
  );
  if (stable(browse.aliases) !== stable(wantBrowseAliases)) fail('browse.json aliases != registry');
  if (!Array.isArray(browse.axisKeys) || browse.axisKeys.length !== 13) {
    fail(
      `browse.json: axisKeys must list 13 axes (got ${browse.axisKeys && browse.axisKeys.length})`
    );
  }
  const badAxes = items.filter((x) => !Array.isArray(x.axes) || x.axes.length !== 13);
  if (badAxes.length)
    fail(
      `browse.json: ${badAxes.length} item(s) with axes != 13 ints (e.g. ${badAxes
        .slice(0, 5)
        .map((x) => x.id)
        .join(', ')})`
    );
  // Published for agents: every field the browse surfaces read (search
  // rank/render, tree leaves, find-similar) must be here. The app boots from
  // browse_boot.json and reads browse_prose.json (below), which split this
  // file exactly.
  const badFields = items.filter(
    (x) =>
      typeof x.name !== 'string' ||
      typeof x.family !== 'string' ||
      typeof x.description !== 'string' ||
      !Array.isArray(x.instruments) ||
      !('lineage' in x) ||
      !('parent' in x)
  );
  if (badFields.length)
    fail(
      `browse.json: ${badFields.length} item(s) missing app-facing fields (name/family/description/instruments/lineage/parent) (e.g. ${badFields
        .slice(0, 5)
        .map((x) => x.id)
        .join(', ')})`
    );
}

// ───────────────────────── the browse tables, against the catalog ─────────────────────────
// browse.json is published and no longer read by the app, so this is what holds
// it now; browse_boot.json and browse_prose.json are what the lazy shell reads.
// All three are exactly what scripts/_browse_tables.js derives from the catalog.
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const want = C.TRADITIONS.map((t) => B.browseItem(t, C.TRADITION_EXTRAS[t.id] || {}));
  const report = (file, ids) =>
    ids.length &&
    fail(
      `${file}: ${ids.length} item(s) differ from what scripts/_browse_tables.js derives from the catalog (e.g. ${ids
        .slice(0, 5)
        .join(', ')}); run npm run build:api`
    );
  if (browse) {
    report(
      'browse.json',
      want.filter((w, i) => !same(w, (browse.items || [])[i])).map((w) => w.id)
    );
    if (!same(browse.axisKeys, B.AXIS_KEYS))
      fail('browse.json: axisKeys differ from scripts/_browse_tables.js');
  }
  const boot = readJson('browse_boot.json');
  if (boot) {
    const items = Array.isArray(boot.items) ? boot.items : [];
    if (boot.count !== want.length || items.length !== want.length)
      fail(
        `browse_boot.json: count=${boot.count}, items=${items.length}, catalog has ${want.length}`
      );
    if (!same(boot.axisKeys, B.AXIS_KEYS))
      fail('browse_boot.json: axisKeys differ from scripts/_browse_tables.js');
    const prosed = new Set(items.filter((it) => it && 'description' in it).map((it) => it.id));
    report(
      'browse_boot.json',
      want
        .filter(
          (w, i) => !same(B.bootItem(w, C.TRADITION_EXTRAS[w.id], prosed.has(w.id)), items[i])
        )
        .map((w) => w.id)
    );
    const bootAliases = Object.fromEntries(
      Object.keys(C.TRADITION_ALIASES)
        .sort()
        .map((id) => [id, { of: C.TRADITION_ALIASES[id].of, name: C.TRADITION_ALIASES[id].name }])
    );
    if (!same(boot.aliases, bootAliases)) fail('browse_boot.json aliases != registry');
    if (prosed.size < 1 || prosed.size > B.BOOT_PROSE_MAX)
      fail(
        `browse_boot.json carries the prose of ${prosed.size} genres; it carries only the Genre page's starters (1..${B.BOOT_PROSE_MAX}; check_lazy_app.js holds the exact set)`
      );
  }
  const prose = readJson('browse_prose.json');
  if (prose) {
    const items = Array.isArray(prose.items) ? prose.items : [];
    if (prose.count !== want.length || items.length !== want.length)
      fail(
        `browse_prose.json: count=${prose.count}, items=${items.length}, catalog has ${want.length}`
      );
    report(
      'browse_prose.json',
      want.filter((w, i) => !same(B.proseItem(w), items[i])).map((w) => w.id)
    );
  }
}

// ───────────────────────── engine.json (the instrument engine, fetched by the lazy shell) ─────────────────────────
// The page refuses a file whose digest is not its own CODEX_ENGINE_SHA, so a
// stale copy here breaks every recipe action in the shipped page; and the file
// is internal, so nothing but this check reads it as a whole.
{
  const f = path.join(API, 'engine.json');
  if (!fs.existsSync(f)) fail('missing file: engine.json');
  else {
    const text = fs.readFileSync(f, 'utf8');
    if (text !== P.engineText(path.join(ROOT, 'references')))
      fail(
        'engine.json differs from what scripts/_page_tables.js derives from references/; run npm run build:api'
      );
    try {
      // The file leaves each instrument's index fields to INSTRUMENT_INDEX,
      // which the page derives from the same instruments; fill them back.
      const index = P.instrumentIndex(P.engineTables(path.join(ROOT, 'references')).INSTRUMENTS);
      const { header, tables, plan } = P.readEngineText(text, index);
      if (!plan || plan.merge_sha1 !== P.mergeSha())
        fail('engine.json: its merge plan was not written by the merge code in scripts/_merge.js');
      if (JSON.stringify(header.tables) !== JSON.stringify(P.ENGINE_TABLES))
        fail('engine.json: its header does not list ENGINE_TABLES (scripts/_page_tables.js)');
      if (header.tables_sha1 !== P.engineSha(tables))
        fail('engine.json: tables_sha1 is not the digest of the tables it carries');
      for (const [name, specs] of Object.entries(P.PAGE_DROP_FIELDS)) {
        if (!(name in tables)) continue;
        const t = JSON.stringify(tables[name]);
        for (const [, fields] of specs)
          for (const k of fields)
            if (t.includes(`"${k}":`))
              fail(`engine.json: ${name} keeps the page-dropped field ${k}`);
      }
    } catch (e) {
      fail('engine.json: ' + e.message);
    }
  }
}

// ───────────────────────── nav_glyphs.json (room and preface glyph art, fetched on demand) ─────────────────────────
// The lazy shell draws every room and preface glyph not in an eager store from
// this file, so it must be exactly NAV_GLYPH_SVGS: a stale copy draws the wrong
// picture or an empty slot, and nothing else would say so.
const navGlyphs = readJson('nav_glyphs.json');
if (navGlyphs) {
  const want = C.NAV_GLYPH_SVGS || {};
  const got = navGlyphs.svgs || {};
  const wrong = Object.keys({ ...want, ...got }).filter((cp) => want[cp] !== got[cp]);
  if (wrong.length || navGlyphs.count !== Object.keys(want).length)
    fail(
      `nav_glyphs.json: ${wrong.length} codepoint(s) differ from NAV_GLYPH_SVGS (e.g. ${wrong
        .slice(0, 5)
        .join(', ')}), count=${navGlyphs.count}; run npm run build:api`
    );
}

// ───────────────────────── the two photo tables (fetched by the Genre and Instrument pages) ─────────────────────────
// Each must be exactly what scripts/_image_tables.js derives from the committed
// manifest: a stale copy shows the wrong photo or credit, or none, and nothing
// else would say so. Re-derived here from references/, not trusted from api/.
{
  const manifest = readImageManifest(
    path.join(__dirname, '..', 'references', '_image_manifest.json')
  );
  const tables = [
    [
      'tradition_images.json',
      'traditions',
      compactTraditionImages(
        manifest,
        C.TRADITIONS.map((t) => t.id)
      ).traditions,
    ],
    [
      'instrument_images.json',
      'instruments',
      (compactInstrumentImages(manifest) || { instruments: {} }).instruments,
    ],
  ];
  for (const [file, key, want] of tables) {
    const got = readJson(file);
    if (!got) continue;
    const have = got[key] || {};
    const wrong = Object.keys({ ...want, ...have }).filter(
      (id) => JSON.stringify(want[id]) !== JSON.stringify(have[id])
    );
    if (wrong.length || got.count !== Object.keys(want).length)
      fail(
        `${file}: ${wrong.length} id(s) differ from references/_image_manifest.json (e.g. ${wrong
          .slice(0, 5)
          .join(', ')}), count=${got.count}; run npm run build:api`
      );
  }
}

// ───────────────────────── instruments ─────────────────────────
const iindex = readJson('instruments/index.json');
if (iindex) {
  if (iindex.count !== C.INSTRUMENTS.length)
    fail(`instruments/index.json count=${iindex.count}, catalog has ${C.INSTRUMENTS.length}`);
  const items = Array.isArray(iindex.items) ? iindex.items : [];
  diffIds(
    'instruments/index.json',
    items.map((x) => x.id),
    instIds
  );
  checkIndexItems('instruments/index.json', items, 'instruments', instById);

  // Per-instrument files are written VERBATIM from the catalog (no compute), so
  // each one must deep-equal its catalog instrument. This is what catches a
  // gutted/fabricated payload (e.g. instruments/{id}.json reduced to {id}) that
  // the index id-set check waves through.
  let ichecked = 0;
  for (const id of instIds) {
    const rec = readJson(`instruments/${id}.json`);
    if (!rec) continue; // readJson already logged the miss
    if (rec.id !== id) fail(`instruments/${id}.json: id field is "${rec.id}"`);
    // Compare against the CURATED catalog instrument: the published static file
    // carries each instrument's own variants, not the live `expanded` universal
    // string materials (served by the live get_instrument tool).
    else if (stable(rec) !== stable(stripExpandedVariants(instById.get(id)))) {
      fail(`instruments/${id}.json: payload differs from the catalog instrument`);
    }
    ichecked++;
  }
  if (!VERBOSE) console.error(`  …validated ${ichecked} instrument files`);
}

// ───────────────────────── top-level index ─────────────────────────
const index = readJson('index.json');
// engine.json is the app's own data, like nav_glyphs.json: not an endpoint.
if (index && JSON.stringify(index).includes('engine.json'))
  fail('index.json lists engine.json, which is internal to the lazy app, not a published endpoint');
if (index) {
  const c = index.counts || {};
  if (c.traditions !== C.TRADITIONS.length)
    fail(`index.json counts.traditions=${c.traditions}, catalog has ${C.TRADITIONS.length}`);
  if (c.instruments !== C.INSTRUMENTS.length)
    fail(`index.json counts.instruments=${c.instruments}, catalog has ${C.INSTRUMENTS.length}`);
  if (c.aliases !== Object.keys(C.TRADITION_ALIASES).length)
    fail(
      `index.json counts.aliases=${c.aliases}, registry has ${Object.keys(C.TRADITION_ALIASES).length}`
    );
}

// ───────────────────────── report ─────────────────────────
if (flags.json) {
  console.log(JSON.stringify({ api: path.relative(ROOT, API), problems }, null, 2));
  process.exit(problems.length ? 1 : 0);
}

console.log(`=== Static API contract (${path.relative(ROOT, API) || 'api'}) ===`);
if (problems.length === 0) {
  console.log(`PASS — artifact honors every documented promise:`);
  console.log(`  ✓ ${C.TRADITIONS.length} traditions complete (index + per-id files + all.json)`);
  console.log(`  ✓ ${C.INSTRUMENTS.length} instruments complete`);
  console.log(`  ✓ every recipe <= 1000 chars, recipe_chars accurate`);
  console.log(`  ✓ every config id resolves against the catalog`);
  process.exit(0);
}
console.error(`FAIL — ${problems.length} contract violation(s):`);
for (const p of problems.slice(0, MAX_SHOWN)) console.error(`  ✗ ${p}`);
if (problems.length > MAX_SHOWN)
  console.error(`  … and ${problems.length - MAX_SHOWN} more (use --verbose).`);
console.error(
  `\nThe published api/ has drifted from the catalog or broken a promise. Rebuild with`
);
console.error(
  `\`npm run build:api\` (which now self-verifies) and commit, or fix the offending data.`
);
process.exit(1);
