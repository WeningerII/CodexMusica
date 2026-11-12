#!/usr/bin/env node
'use strict';
// Exact receiving-page engine + actual loader, with local committed-file fetch.
// This is Node source/data parity, not browser, native links or AT qualification.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const acorn = require('acorn');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const asModule = (s) => import(`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`);
const json = (p) => JSON.parse(read(p));
const fetchFile = async (url) => {
  const rel = String(url)
    .replace(/^\.\.\//, '')
    .replace(/\?.*$/, '');
  assert.ok(/^api\/[\w/-]+\.json$/.test(rel), `unexpected request ${rel}`);
  const text = read(rel);
  return { ok: true, json: async () => JSON.parse(text), text: async () => text };
};
async function check() {
  const L = await asModule(read('prototype/engine/load.js'));
  const M = await asModule(L.engineModule(read('codex.html')));
  const E = M.createEngine({ fetch: fetchFile });
  await E.CATALOG_READY;
  await E.Engine.ensure();
  const page = read('src/pages/instrument.js');
  const ast = acorn.parse(page, { ecmaVersion: 'latest', sourceType: 'script' });
  const fn = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'ipRank');
  const rank = vm.runInNewContext(`(${page.slice(fn.start, fn.end)})`, {
    normalizeSearch: E.normalizeSearch,
    searchRank: E.searchRank,
  });
  // Exercise the two new routed names against their actual engine holds and
  // planted defects without running the browser entry point.
  const gateFile = path.join(root, 'scripts/check_prototype_engine.js');
  const gateSource = read('scripts/check_prototype_engine.js');
  const gate = new Module(gateFile, module);
  gate.filename = gateFile;
  gate.paths = Module._nodeModulePaths(path.dirname(gateFile));
  gate._compile(
    gateSource.slice(0, gateSource.lastIndexOf('\n(async () => {')) +
      '\nmodule.exports = { holdSamples, holdInput, PLANTS };',
    gateFile
  );
  const { holdSamples, holdInput, PLANTS } = gate.exports;
  const input = holdInput();
  const original = await holdSamples(E, ['search'], input);
  assert.ok(!original.search.error);
  for (const name of ['INSTRUMENT_FILTER_PILLS', 'passesInstrumentFilter']) {
    const [from, to] = PLANTS[name];
    const pageSource = read('codex.html');
    assert.equal(pageSource.split(from).length, 2, name + ' plant anchor');
    const mutated = await asModule(L.engineModule(pageSource.replace(from, to)));
    const changed = mutated.createEngine({ fetch: fetchFile });
    await changed.CATALOG_READY;
    await changed.Engine.ensure();
    assert.notDeepEqual(
      await holdSamples(changed, ['search'], input),
      original,
      name + ' hold rejects plant'
    );
  }
  const workbench = read('src/workbench.js');
  const workAst = acorn.parse(workbench, { ecmaVersion: 'latest', sourceType: 'script' });
  const listenNode = workAst.body
    .flatMap((n) => n.declarations || [])
    .find((d) => d.id.name === 'listenHref').init;
  const listen = vm.runInNewContext('(' + workbench.slice(listenNode.start, listenNode.end) + ')');
  const source = read('prototype/data.js');
  const oldFetch = global.fetch;
  global.__instrumentDataEngine = E;
  global.fetch = fetchFile;
  const engineURL = `data:text/javascript;base64,${Buffer.from('export const pageEngine = async () => globalThis.__instrumentDataEngine; export const loadEngine = pageEngine;').toString('base64')}`;
  const loadModule = (src) =>
    asModule(src.replace("'./engine/load.js'", JSON.stringify(engineURL)));
  const index = json('api/instruments/index.json').items;
  const images = json('api/instrument_images.json').instruments;
  const names = [...index].sort((a, b) =>
    new Intl.Collator('en', { sensitivity: 'base' }).compare(a.name, b.name)
  );
  const order = new Map(names.map((i, n) => [i.id, n]));
  async function verify(src) {
    const D = await loadModule(src);
    const api = D.instrumentCatalogLoader();
    const data = await api.loadInstrumentCatalog();
    assert.equal(data.items.length, index.length);
    assert.ok(Object.isFrozen(data) && Object.isFrozen(data.items[0].propertyIds));
    for (const item of data.items) {
      const i = E.Inst(item.id);
      assert.equal(item.name, i.name);
      assert.equal(item.short, i.short || null);
      assert.equal(item.familyId, i.family);
      assert.equal(item.classId, i.class || null);
      assert.equal(item.listenHref, listen(i.name, true));
      assert.equal(item.nameOrder, order.get(i.id));
      assert.equal(item.partCount, i.parts.length);
      assert.deepEqual(
        item.propertyIds,
        E.INSTRUMENT_FILTER_PILLS.filter((p) => E.passesInstrumentFilter(i, new Set([p.id]))).map(
          (p) => p.id
        )
      );
      assert.deepEqual(item.photo, images[i.id] || null);
    }
    for (const query of ['ud', 'oud', 'fiddle', 'grand piano', 'ʿŪd', 'NONEXISTENT', '']) {
      const result = api.catalog.search(query),
        q = E.normalizeSearch(query);
      const expected = index
        .map(({ id }) => E.Inst(id))
        .filter(
          (i) =>
            !q ||
            E.normalizeSearch(i.name + ' ' + i.short + ' ' + i.id.replace(/_/g, ' ')).includes(q)
        )
        .map((i) => ({ id: i.id, rank: rank(i, q) }));
      assert.deepEqual(result, { normalizedQuery: q, matches: expected });
    }
    for (const id of ['oud', 'fiddle', 'grand_piano', 'electric_guitar_humbucker', 'voice']) {
      const got = await api.loadInstrumentSimilar(id);
      const want = E.findSimilarInstruments(id, 6);
      assert.deepEqual(
        got.neighbours.map((n) => [n.id, n.agreements]),
        want.map((n) => [
          n.id,
          E.getMatchingInstrumentAxes(id, n.id, 2).map((m) => m.axis.name.toLowerCase()),
        ])
      );
      assert.ok(Object.isFrozen(got.neighbours[0].agreements));
    }
    await assert.rejects(api.loadInstrumentSimilar('not-an-id'), { code: 'NOT_FOUND' });
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(api.loadInstrumentCatalog({ signal: aborted.signal }), {
      name: 'AbortError',
    });
    await assert.rejects(api.loadInstrumentSimilar('oud', { signal: aborted.signal }), {
      name: 'AbortError',
    });
    return api;
  }
  try {
    const api = await verify(source);
    const mutants = [
      [
        'similar order',
        'E.findSimilarInstruments(id, 6).map',
        'E.findSimilarInstruments(id, 6).reverse().map',
      ],
      [
        'missing neighbour',
        'E.findSimilarInstruments(id, 6).map',
        'E.findSimilarInstruments(id, 5).map',
      ],
      ['property drift', 'engine.passesInstrumentFilter(i, new Set([p.id]))', 'false'],
      ['rank drift', 'return { id: i.id, rank };', 'return { id: i.id, rank: rank + 1 };'],
    ];
    for (const [name, from, to] of mutants) {
      assert.ok(source.includes(from), name);
      await assert.rejects(verify(source.replace(from, to)), undefined, name);
    }
    const D = await loadModule(source),
      retry = D.instrumentCatalogLoader();
    global.fetch = async () => {
      throw Error('offline');
    };
    await assert.rejects(retry.loadInstrumentCatalog(), { code: 'LOAD_FAILED' });
    global.fetch = fetchFile;
    await retry.loadInstrumentCatalog();
    const concurrent = D.instrumentCatalogLoader();
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    global.fetch = async (u) => {
      await blocked;
      return fetchFile(u);
    };
    const controller = new AbortController();
    const canceled = concurrent.loadInstrumentCatalog({ signal: controller.signal });
    const kept = concurrent.loadInstrumentCatalog();
    controller.abort();
    await assert.rejects(canceled, { name: 'AbortError' });
    release();
    assert.equal((await kept).items.length, index.length);
    global.fetch = fetchFile;
    const ranks = [...api.catalog.search('ud').matches];
    console.log(
      `instrument data: ${index.length} canonical items, 7 search queries, 5 six-neighbour/axis comparisons, refusal/concurrent abort/retry, 4 loader mutants and 2 engine-hold plants pass (Node exact-source evidence)`
    );
    console.log(
      'Current-page ud order: ' +
        ranks
          .sort((a, b) => a.rank - b.rank || order.get(a.id) - order.get(b.id))
          .slice(0, 3)
          .map((x) => x.id)
          .join(', ')
    );
  } finally {
    global.fetch = oldFetch;
    delete global.__instrumentDataEngine;
  }
}
module.exports = { check };
if (require.main === module)
  check().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
