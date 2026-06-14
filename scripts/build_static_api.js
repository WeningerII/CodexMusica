#!/usr/bin/env node
// build_static_api.js — pre-compile the codex into a static, server-free "API".
//
// Path A (see README/agent docs): run the deterministic recipe engine at BUILD
// time and write plain files that GitHub Pages already serves. An agent then
// just opens a URL and reads JSON — no server, no key, no per-call cost. All
// compute happens here, once.
//
// Usage:
//   node scripts/build_static_api.js              # full build (all traditions)
//   node scripts/build_static_api.js --limit=20   # sample build (timing/preview)
//   node scripts/build_static_api.js --out=api    # output dir (default: api/)

const fs = require('fs');
const path = require('path');

const C = require('./_loader.js');
const { search, seedFromTradition } = require('./search.js');
const { translate } = require('./translate.js');
const { buildResolver, recordProblems, traditionSource, RECIPE_CHAR_CEILING } = require('./_api_contract.js');

const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}
// path.resolve (not join) so an ABSOLUTE --out (e.g. a temp dir) is honored,
// while a relative one still resolves against the repo root — matches build_html.
const OUT = path.resolve(__dirname, '..', flags.out || 'api');
const LIMIT = flags.limit ? parseInt(flags.limit, 10) : Infinity;

const EMPTY_OPTS = {
  exclude: new Set(),
  add: new Set(),
  swap: {},
  stapleMode: 'full',
  arrangement: null,
};

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

// Canonical 13-axis order — the browse index stores axes as a compact array in
// this order (named keys would repeat 13× per tradition and bloat the index at
// scale). The app maps array→named on load via the file's `axisKeys` header.
const AXIS_KEYS = ['harm', 'pitch', 'ornament', 'meter', 'density', 'transmission', 'improv', 'soundTech', 'intensity', 'voice', 'timbre', 'percussion', 'cyclicity'];

function compileTradition(t) {
  const seed = seedFromTradition(t.id, [], EMPTY_OPTS);
  if (!seed) return null;
  const result = search(seed, { maxIters: 100 });
  const recipe = translate(result.config, { ceiling: RECIPE_CHAR_CEILING });
  return {
    id: t.id,
    name: t.name,
    family: t.family,
    lineage: t.lineage || null,
    recipe,
    recipe_chars: recipe.length,
    score: Number(result.score.toFixed(3)),
    config: result.config,
    // The raw row fields the lazy-loaded browser app needs to IMPORT this
    // tradition (build workspace cards from it): tuning/room/parts + chain_*.
    // The compiled `config` above is the agent-facing arrangement; the app
    // composes its own cards from these source ids instead.
    source: traditionSource(t),
  };
}

function main() {
  const t0 = Date.now();
  mkdir(OUT);
  mkdir(path.join(OUT, 'traditions'));
  mkdir(path.join(OUT, 'instruments'));

  // The static API is the agent-facing PRODUCT, so this build is fail-CLOSED:
  // a tradition that won't compile, or any record that breaks a documented
  // promise (over-ceiling recipe, unresolvable config id), is collected and
  // makes the build exit non-zero — never silently dropped. In the publish
  // workflow this aborts before anything reaches the live site.
  const R = buildResolver(C);
  const failures = []; // [{ id, err }] — traditions that threw / returned null
  const contract = []; // ["<id> — <problem>"] — records that break the contract

  // ---- traditions ----
  const traditions = C.TRADITIONS.slice(0, LIMIT);
  const tindex = [];
  const bundle = [];
  const browseItems = []; // Tier-1 index for the lazy-loaded app (light data only)
  let ok = 0,
    fail = 0;
  for (const t of traditions) {
    let rec;
    try {
      rec = compileTradition(t);
    } catch (e) {
      rec = null;
      failures.push({ id: t.id, err: e.message });
    }
    if (!rec) {
      fail++;
      continue;
    }
    for (const p of recordProblems(rec, R)) contract.push(`${t.id} — ${p}`);
    writeJson(path.join(OUT, 'traditions', `${t.id}.json`), rec);
    tindex.push({ id: t.id, name: t.name, family: t.family, href: `traditions/${t.id}.json` });
    bundle.push({
      id: rec.id,
      name: rec.name,
      family: rec.family,
      recipe: rec.recipe,
      recipe_chars: rec.recipe_chars,
    });
    const ext = C.TRADITION_EXTRAS[t.id] || {};
    const browseItem = {
      id: t.id,
      name: t.name,
      family: t.family,
      lineage: t.lineage || null,
      parent: ext.parent || null,
      axes: AXIS_KEYS.map((k) => (ext.axes && typeof ext.axes[k] === 'number' ? ext.axes[k] : 0)),
      instruments: t.instruments || [],
      description: ext.description || '',
    };
    // Optional fields ship only when non-empty — at catalog scale the empty
    // markers alone are real bytes, and the app's guards treat absent and
    // empty identically.
    if (ext.exemplars && ext.exemplars.length) browseItem.exemplars = ext.exemplars;
    if (ext.crossRefs && ext.crossRefs.length) browseItem.crossRefs = ext.crossRefs;
    browseItems.push(browseItem);
    ok++;
    if (ok % 100 === 0) process.stderr.write(`  ...${ok} traditions\n`);
  }
  writeJson(path.join(OUT, 'traditions', 'index.json'), { count: tindex.length, items: tindex });

  // ---- browse.json: the Tier-1 index the lazy-loaded browser app boots from ----
  // Everything the BROWSE surfaces show (name/family/lineage/parent/axes/
  // instruments/description/exemplars/crossRefs) so search, the tree, find-
  // similar, and fingerprints all run locally off ONE fetch with zero loss of
  // recall or display fidelity vs the embedded build. Only the few row fields
  // an IMPORT needs (tuning/room/parts/chain_*) stay out — they ride in each
  // traditions/{id}.json as `source`, fetched once per imported tradition.
  // This split is what lets the app scale past the single-file memory ceiling
  // without a server and without per-action lag on browse interactions.
  writeJson(path.join(OUT, 'browse.json'), {
    name: 'Codex Musica — browse index (Tier-1 data for the lazy-loaded app)',
    generated: new Date().toISOString().slice(0, 10),
    axisKeys: AXIS_KEYS,
    count: browseItems.length,
    items: browseItems,
  });

  // ---- all.json: every recipe in ONE fetch (the universal "paste one link" payload) ----
  writeJson(path.join(OUT, 'all.json'), {
    name: 'Codex Musica — all recipes',
    description:
      'Every tradition with its compressed recording recipe, in one file. ' +
      'For full structured arrangements per tradition, fetch traditions/{id}.json.',
    generated: new Date().toISOString().slice(0, 10),
    count: bundle.length,
    items: bundle,
  });

  // ---- instruments (no compute; straight from catalog) ----
  const iindex = [];
  for (const inst of C.INSTRUMENTS) {
    writeJson(path.join(OUT, 'instruments', `${inst.id}.json`), inst);
    iindex.push({
      id: inst.id,
      name: inst.name,
      family: inst.family,
      href: `instruments/${inst.id}.json`,
    });
  }
  writeJson(path.join(OUT, 'instruments', 'index.json'), { count: iindex.length, items: iindex });

  // ---- top-level catalog index ----
  writeJson(path.join(OUT, 'index.json'), {
    name: 'Codex Musica — static recipe API',
    description:
      'Pre-compiled recording recipes for recorded-music traditions. ' +
      'Each tradition resolves to a descriptor-stack "recipe" plus a structured arrangement. ' +
      'Static files only — open a URL and read the JSON. No server, no key.',
    generated: new Date().toISOString().slice(0, 10),
    counts: { traditions: tindex.length, instruments: iindex.length },
    endpoints: {
      traditions_index: 'traditions/index.json',
      tradition: 'traditions/{id}.json',
      instruments_index: 'instruments/index.json',
      instrument: 'instruments/{id}.json',
      all: 'all.json',
      browse: 'browse.json',
    },
    license: 'See repository LICENSE.',
  });

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  process.stderr.write(
    `Done: ${ok} traditions (${fail} failed), ${iindex.length} instruments in ${secs}s -> ${OUT}\n`
  );

  // ---- self-verify: fail CLOSED if any promise is broken ----
  const isFull = LIMIT === Infinity;
  const errs = [];
  if (failures.length) {
    errs.push(`${failures.length} tradition(s) failed to compile:`);
    for (const f of failures.slice(0, 20)) errs.push(`    ${f.id}: ${f.err}`);
  }
  if (isFull && bundle.length !== C.TRADITIONS.length) {
    errs.push(`incomplete: built ${bundle.length} of ${C.TRADITIONS.length} traditions (the "all ${C.TRADITIONS.length}" promise)`);
  }
  if (contract.length) {
    errs.push(`${contract.length} record(s) break the API contract (<=${RECIPE_CHAR_CEILING} chars, resolvable ids):`);
    for (const p of contract.slice(0, 20)) errs.push(`    ${p}`);
  }
  if (errs.length) {
    process.stderr.write('\nAPI BUILD FAILED — refusing to publish a broken artifact:\n');
    for (const e of errs) process.stderr.write(`  ✗ ${e}\n`);
    process.exit(1);
  }
  process.stderr.write(
    isFull
      ? `Self-verify OK: ${bundle.length}/${C.TRADITIONS.length} traditions, all recipes <=${RECIPE_CHAR_CEILING} chars, all ids resolve.\n`
      : `Self-verify OK (sample build, --limit=${LIMIT}): per-record contract holds; completeness not asserted.\n`
  );
  return { tindex, iindex };
}

main();
