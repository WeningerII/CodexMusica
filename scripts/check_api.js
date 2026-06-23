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
const { buildResolver, recordProblems, traditionSource, stripExpandedVariants } = require('./_api_contract.js');

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
  if (missing.length) fail(`${label}: ${missing.length} catalog id(s) missing (e.g. ${missing.slice(0, 5).join(', ')})`);
  if (extra.length) fail(`${label}: ${extra.length} id(s) not in catalog (e.g. ${extra.slice(0, 5).join(', ')})`);
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
    if (it.href !== expectHref) fail(`${label}[${it.id}]: href="${it.href}", expected "${expectHref}"`);
    else if (!fs.existsSync(path.join(API, it.href))) fail(`${label}[${it.id}]: href target missing on disk: ${it.href}`);
    if (it.name !== cat.name) fail(`${label}[${it.id}]: name="${it.name}" != catalog "${cat.name}"`);
    if (it.family !== cat.family) fail(`${label}[${it.id}]: family="${it.family}" != catalog "${cat.family}"`);
  }
}

// ───────────────────────── traditions ─────────────────────────
const tindex = readJson('traditions/index.json');
if (tindex) {
  if (tindex.count !== C.TRADITIONS.length) fail(`traditions/index.json count=${tindex.count}, catalog has ${C.TRADITIONS.length}`);
  const items = Array.isArray(tindex.items) ? tindex.items : [];
  if (items.length !== tindex.count) fail(`traditions/index.json: count=${tindex.count} but items.length=${items.length}`);
  diffIds('traditions/index.json', items.map((x) => x.id), tradIds);
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
      if (rec.name !== cat.name) fail(`traditions/${id}.json: name="${rec.name}" != catalog "${cat.name}"`);
      if (rec.family !== cat.family) fail(`traditions/${id}.json: family="${rec.family}" != catalog "${cat.family}"`);
      if ((rec.lineage || null) !== (cat.lineage || null)) fail(`traditions/${id}.json: lineage differs from catalog`);
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
}

// ───────────────────────── all.json (the "one fetch" payload) ─────────────────────────
const all = readJson('all.json');
if (all) {
  if (all.count !== C.TRADITIONS.length) fail(`all.json count=${all.count}, catalog has ${C.TRADITIONS.length}`);
  const items = Array.isArray(all.items) ? all.items : [];
  if (items.length !== all.count) fail(`all.json: count=${all.count} but items.length=${items.length}`);
  diffIds('all.json', items.map((x) => x.id), tradIds);
  for (const item of items) {
    // all.json items carry recipe + recipe_chars but no config (by design).
    for (const p of recordProblems(item, R, { requireConfig: false })) fail(`all.json[${item.id}] — ${p}`);
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
      if (item.name !== cat.name) fail(`all.json[${item.id}]: name="${item.name}" != catalog "${cat.name}"`);
      if (item.family !== cat.family) fail(`all.json[${item.id}]: family="${item.family}" != catalog "${cat.family}"`);
    }
  }
}

// ───────────────────────── browse.json (Tier-1 index for the lazy-loaded app) ─────────────────────────
const browse = readJson('browse.json');
if (browse) {
  if (browse.count !== C.TRADITIONS.length) fail(`browse.json count=${browse.count}, catalog has ${C.TRADITIONS.length}`);
  const items = Array.isArray(browse.items) ? browse.items : [];
  if (items.length !== browse.count) fail(`browse.json: count=${browse.count} but items.length=${items.length}`);
  diffIds('browse.json', items.map((x) => x.id), tradIds);
  if (!Array.isArray(browse.axisKeys) || browse.axisKeys.length !== 13) {
    fail(`browse.json: axisKeys must list 13 axes (got ${browse.axisKeys && browse.axisKeys.length})`);
  }
  const badAxes = items.filter((x) => !Array.isArray(x.axes) || x.axes.length !== 13);
  if (badAxes.length) fail(`browse.json: ${badAxes.length} item(s) with axes != 13 ints (e.g. ${badAxes.slice(0, 5).map((x) => x.id).join(', ')})`);
  // The lazy-loaded app boots ENTIRELY from this index — every field its browse
  // surfaces read (search rank/render, tree leaves, find-similar) must be here.
  const badFields = items.filter(
    (x) => typeof x.name !== 'string' || typeof x.family !== 'string' ||
      typeof x.description !== 'string' || !Array.isArray(x.instruments) ||
      !('lineage' in x) || !('parent' in x)
  );
  if (badFields.length) fail(`browse.json: ${badFields.length} item(s) missing app-facing fields (name/family/description/instruments/lineage/parent) (e.g. ${badFields.slice(0, 5).map((x) => x.id).join(', ')})`);
}

// ───────────────────────── instruments ─────────────────────────
const iindex = readJson('instruments/index.json');
if (iindex) {
  if (iindex.count !== C.INSTRUMENTS.length) fail(`instruments/index.json count=${iindex.count}, catalog has ${C.INSTRUMENTS.length}`);
  const items = Array.isArray(iindex.items) ? iindex.items : [];
  diffIds('instruments/index.json', items.map((x) => x.id), instIds);
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
if (index) {
  const c = index.counts || {};
  if (c.traditions !== C.TRADITIONS.length) fail(`index.json counts.traditions=${c.traditions}, catalog has ${C.TRADITIONS.length}`);
  if (c.instruments !== C.INSTRUMENTS.length) fail(`index.json counts.instruments=${c.instruments}, catalog has ${C.INSTRUMENTS.length}`);
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
if (problems.length > MAX_SHOWN) console.error(`  … and ${problems.length - MAX_SHOWN} more (use --verbose).`);
console.error(`\nThe published api/ has drifted from the catalog or broken a promise. Rebuild with`);
console.error(`\`npm run build:api\` (which now self-verifies) and commit, or fix the offending data.`);
process.exit(1);
