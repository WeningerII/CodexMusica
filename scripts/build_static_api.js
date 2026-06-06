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

const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}
const OUT = path.join(__dirname, '..', flags.out || 'api');
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

function compileTradition(t) {
  const seed = seedFromTradition(t.id, [], EMPTY_OPTS);
  if (!seed) return null;
  const result = search(seed, { maxIters: 100 });
  const recipe = translate(result.config, { ceiling: 1000 });
  return {
    id: t.id,
    name: t.name,
    family: t.family,
    lineage: t.lineage || null,
    recipe,
    recipe_chars: recipe.length,
    score: Number(result.score.toFixed(3)),
    config: result.config,
  };
}

function main() {
  const t0 = Date.now();
  mkdir(OUT);
  mkdir(path.join(OUT, 'traditions'));
  mkdir(path.join(OUT, 'instruments'));

  // ---- traditions ----
  const traditions = C.TRADITIONS.slice(0, LIMIT);
  const tindex = [];
  let ok = 0,
    fail = 0;
  for (const t of traditions) {
    let rec;
    try {
      rec = compileTradition(t);
    } catch {
      rec = null;
    }
    if (!rec) {
      fail++;
      continue;
    }
    writeJson(path.join(OUT, 'traditions', `${t.id}.json`), rec);
    tindex.push({ id: t.id, name: t.name, family: t.family, href: `traditions/${t.id}.json` });
    ok++;
    if (ok % 100 === 0) process.stderr.write(`  ...${ok} traditions\n`);
  }
  writeJson(path.join(OUT, 'traditions', 'index.json'), { count: tindex.length, items: tindex });

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
    },
    license: 'See repository LICENSE.',
  });

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  process.stderr.write(
    `Done: ${ok} traditions (${fail} failed), ${iindex.length} instruments in ${secs}s -> ${OUT}\n`
  );
  return { tindex, iindex };
}

main();
