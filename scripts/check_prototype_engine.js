#!/usr/bin/env node
'use strict';
/* global window */
// check_prototype_engine.js — the prototype's recipe engine is production's
// (#670 6639581575, R2's conditions 1 and 3).
//
// prototype/engine/load.js copies codex.html's own engine blocks out of the
// page it is served beside and imports them as a module. Nothing is
// committed in between, so this runs that same file on the working tree's
// codex.html and holds what it makes to production:
//
//   1. Same names: load.js returns exactly the functions the other parity
//      gates call (scripts/_load_app.js EXPORTED), plus the lazy boot.
//   2. Same recipes: the module boots the way the lazy page boots (the
//      catalog from api/browse_boot.json, the instrument engine from
//      api/engine.json, each genre's row on demand), imports each genre of a
//      fixed sample and renders it in all four formats. Each string must
//      equal the production renderer's (scripts/_seed_workspace.js, which
//      check_app_parity.js holds to src/app.js across the catalog). The
//      renderer runs in a child process: the Node catalog loader puts tables
//      on globalThis, and the engine's lazy path must not see them.
//   3. Sealed: building and running the module adds no global.
//   4. In the browser: the prototype page loads ../codex.html through
//      load.js and boots the engine from api/; a genre's recipe equals
//      production's, every request stays on the origin, and no global is
//      added.
//   5. The gate can fail: a page with one engine constant changed yields a
//      module whose recipes disagree, and a page whose shape changed is
//      refused rather than guessed at.
//
//   node scripts/check_prototype_engine.js
//
// CHROMIUM_PATH may name a Chromium executable.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { EXPORTED } = require('./_load_app.js');

const ROOT = path.resolve(__dirname, '..');
const LOAD = path.join(ROOT, 'prototype', 'engine', 'load.js');
const FORMATS = ['rich', 'tags', 'prose', 'compact'];

// The fixed sample: named genres across families and shapes (one card, many
// cards, a chain-heavy one), then every 300th genre of the index and one
// retired id.
const NAMED = [
  'bluegrass',
  'afrobeat',
  'post_punk',
  'gagaku',
  'thrash_metal',
  'qawwali',
  'band_organ',
  'chouval_bwa',
  'appalachian_folk',
  'delta_blues',
  'gamelan_degung',
  'dub',
];

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};

function sample() {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/traditions/index.json'), 'utf8'));
  const ids = index.items.map((t) => t.id);
  const live = new Set(ids);
  const aliases = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'references/_tradition_aliases.json'), 'utf8')
  ).aliases;
  const retired = Object.keys(aliases).sort()[0];
  const out = NAMED.filter((id) => live.has(id));
  for (let i = 0; i < ids.length; i += 300) if (!out.includes(ids[i])) out.push(ids[i]);
  if (retired) out.push(retired);
  return { ids: out, named: NAMED.filter((id) => live.has(id)).length, retired };
}

// What load.js lets the engine ask for, served from the working tree.
function fileFetch(ENGINE_REQUEST) {
  return (url) => {
    const rel = String(url);
    if (!ENGINE_REQUEST.test(rel) || rel.includes('..'))
      return Promise.reject(new Error(`engine asked for ${url}`));
    const file = path.join(ROOT, rel.replace(/\?.*$/, ''));
    if (!fs.existsSync(file))
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => '',
        json: async () => null,
      });
    const text = fs.readFileSync(file, 'utf8');
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => text,
      json: async () => JSON.parse(text),
    });
  };
}

const asModule = (text) =>
  import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

async function recipesOf(mod, request, ids) {
  const E = mod.createEngine({ fetch: fileFetch(request) });
  await E.CATALOG_READY;
  await E.Engine.ensure();
  const out = {};
  for (const id of ids) {
    await E.Catalog.ensureFull(E.Catalog.resolve(id));
    E.app.cards = [];
    E.importTradition(id);
    out[id] = {};
    for (const f of FORMATS) out[id][f] = E.compileRecipeStack(E.app.cards, f, { ceiling: 1000 });
  }
  return out;
}

function reference(ids) {
  const code = `
    const { seedTraditionCards, renderWorkspace } = require('./scripts/_seed_workspace.js');
    const C = require('./scripts/_loader.js');
    const ids = JSON.parse(process.argv[1]);
    const out = {};
    for (const id of ids) {
      const live = C.resolveTraditionId(id);
      out[id] = {};
      for (const f of ${JSON.stringify(FORMATS)})
        out[id][f] = renderWorkspace(seedTraditionCards(live), { format: f, ceiling: 1000 });
    }
    process.stdout.write(JSON.stringify(out));`;
  return JSON.parse(
    execFileSync(process.execPath, ['-e', code, JSON.stringify(ids)], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  );
}

function compare(got, want, ids) {
  let agree = 0;
  const diffs = [];
  for (const id of ids)
    for (const f of FORMATS) {
      const a = got[id] && got[id][f];
      const b = want[id] && want[id][f];
      if (typeof a === 'string' && a.length > 0 && a === b) agree++;
      else
        diffs.push(
          `${id} ${f}: module ${JSON.stringify(String(a).slice(0, 80))} vs production ${JSON.stringify(String(b).slice(0, 80))}`
        );
    }
  return { agree, diffs };
}

async function browserArm(want) {
  const { chromium } = require('playwright');
  const { start } = require('./_pages_server.js');
  const srv = await start({ root: ROOT });
  const base = (srv.url || `http://127.0.0.1:${srv.port}`).replace(/\/$/, '');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const offsite = [];
    const asked = [];
    page.on('request', (r) => {
      // A blob: URL of the page's own origin is the module load.js built.
      const own = r.url().startsWith(base) || r.url().startsWith(`blob:${base}/`);
      if (!own) offsite.push(r.url());
      else if (r.url().startsWith(base)) asked.push(new URL(r.url()).pathname);
    });
    await page.goto(`${base}/prototype/index.html`);
    const got = await page.evaluate(async () => {
      const before = new Set(Object.getOwnPropertyNames(window));
      const { loadEngine } = await import('./engine/load.js');
      const E = await loadEngine();
      await E.Catalog.ensureFull('bluegrass');
      E.app.cards = [];
      E.importTradition('bluegrass');
      const rich = E.compileRecipeStack(E.app.cards, 'rich', { ceiling: 1000 });
      const added = Object.getOwnPropertyNames(window).filter((k) => !before.has(k));
      return { rich, added };
    });
    expect(got.rich === want, 'browser: the bluegrass recipe differs from production’s');
    expect(offsite.length === 0, `browser: requests left the origin: ${offsite.join(', ')}`);
    expect(asked.includes('/codex.html'), 'browser: load.js did not read ../codex.html');
    expect(
      asked.includes('/api/engine.json') && asked.includes('/api/browse_boot.json'),
      `browser: the engine did not boot from api/ (asked ${asked.join(', ')})`
    );
    expect(got.added.length === 0, `browser: the engine added globals: ${got.added.join(', ')}`);
  } finally {
    await browser.close();
    if (srv.close) await srv.close();
  }
}

(async () => {
  const L = await asModule(fs.readFileSync(LOAD, 'utf8'));
  const page = fs.readFileSync(path.join(ROOT, 'codex.html'), 'utf8');

  // 1. names
  const names = ['Catalog', 'Engine', 'CATALOG_READY', ...EXPORTED.filter((n) => n !== 'Catalog')];
  expect(
    JSON.stringify([...L.NAMES].sort()) === JSON.stringify([...names].sort()),
    `load.js NAMES [${L.NAMES}] are not _load_app.js EXPORTED plus the boot [${names}]`
  );

  // 2 and 3. same recipes, sealed
  const { ids, named, retired } = sample();
  expect(named === NAMED.length, `only ${named} of ${NAMED.length} named genres are in the index`);
  expect(!!retired, 'no retired genre id to sample');
  const before = new Set(Object.getOwnPropertyNames(globalThis));
  const mod = await asModule(L.engineModule(page));
  const got = await recipesOf(mod, L.ENGINE_REQUEST, ids);
  const added = Object.getOwnPropertyNames(globalThis).filter((k) => !before.has(k));
  expect(added.length === 0, `the engine added globals: ${added.join(', ')}`);
  const production = reference(ids);
  const { agree, diffs } = compare(got, production, ids);
  expect(
    agree === ids.length * FORMATS.length,
    `${diffs.length} of ${ids.length * FORMATS.length} recipes differ:\n    ${diffs.slice(0, 5).join('\n    ')}`
  );
  // The engine's requests: the static catalog only.
  for (const [url, ok] of [
    ['api/engine.json?v=83ed4a2938b9', true],
    ['api/traditions/bluegrass.json', true],
    ['api/../codex.html', false],
    ['https://example.org/chat', false],
    ['/chat/jobs/1', false],
  ])
    expect(
      (L.ENGINE_REQUEST.test(url) && !url.includes('..')) === ok,
      `the engine's request rule ${ok ? 'refuses' : 'allows'} ${url}`
    );

  // The taxonomy the Genre detail lane reads (treeNodes): the page's
  // TREE_NODES, node for node, against the catalog's own (references/04_tree.js).
  const tree = L.treeNodes(page).map((n) => ({ id: n.id, name: n.name, parent: n.parent }));
  const refTree = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        "const C = require('./scripts/_loader.js'); process.stdout.write(JSON.stringify(C.TREE_NODES.map((n) => ({ id: n.id, name: n.name, parent: n.parent }))))",
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
  );
  expect(
    tree.length > 0 && JSON.stringify(tree) === JSON.stringify(refTree),
    `treeNodes: codex.html's TREE_NODES (${tree.length}) are not references/04_tree.js's (${refTree.length})`
  );

  // 4. in the browser
  await browserArm(production.bluegrass.rich);

  // 5. the gate can fail: the recipe ceiling the app compiles to, changed;
  // and a page whose app.js block is gone.
  const CEILING = 'const RECIPE_CHAR_CEILING=1e3;';
  expect(page.split(CEILING).length === 2, `codex.html no longer declares ${CEILING} once`);
  const pmod = await asModule(
    L.engineModule(page.replace(CEILING, 'const RECIPE_CHAR_CEILING=120;'))
  );
  const four = NAMED.slice(0, 4);
  const pcmp = compare(await recipesOf(pmod, L.ENGINE_REQUEST, four), production, four);
  expect(pcmp.diffs.length > 0, 'a module with a changed engine constant still agrees');
  let refused = false;
  try {
    L.engineModule(page.replace('// ─── runtime: src/app.js ───', '// ─── runtime: app ───'));
  } catch {
    refused = true;
  }
  expect(refused, 'a page without its app.js block is not refused');

  if (problems.length) {
    console.error(`check_prototype_engine: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(
    `check_prototype_engine: ${checks}/${checks} checks pass — ${agree} recipes (${ids.length} genres × ${FORMATS.length} formats) equal production's, and bluegrass in Chromium through ../codex.html; a planted drift fails ${pcmp.diffs.length}/${four.length * FORMATS.length}`
  );
})().catch((e) => {
  console.error('check_prototype_engine: ERROR', e && e.stack);
  process.exit(2);
});
