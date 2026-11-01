'use strict';
// BB8 handoff check (#637 item 6, 3PO 6547583040 / 6547517269): the strip
// counts loaded method-token bindings of the checked methods, native non-token-pair holds apart,
// through the real adapter, marks, views and bindings.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const BASE = require('./fixtures/connection-backend.json');
const registry = require('../library/data/methods.json');

const ALLIT = 'schema:85d0a9d89593c874a7ac0fab'; // alliteration: a visual family
const RHYME = 'schema:1429ae948687ca75ce1cebde'; // internal rhyme: a visual family
const NATIVE = 'schema:aee9ef33b2f61960724959f0'; // repetition: no visual family
const FIGURE = 'schema:db58fc0589b163515ba0a9c8'; // antanaclasis: figure only

const clone = (x) => JSON.parse(JSON.stringify(x));
const inst = (r) => r.kind === 'relation_instance';
function answered(method_id) {
  return {
    id: `method_result:${method_id}`,
    kind: 'method_result',
    method_id,
    coverage: 'answered',
    domain: { projection: 'exact_token_pair', ordering: 'role_ordered' },
  };
}
// The fixture plus a native-only binding hold and a figure-only hold.
function records() {
  const rs = clone(BASE.records);
  const allit = rs.find((r) => inst(r) && r.method_id === ALLIT);
  rs.push({ ...clone(allit), id: 'relation_instance:native', method_id: NATIVE });
  rs.push(answered(NATIVE));
  rs.push({
    id: 'relation_figure:only',
    kind: 'relation_figure',
    method_id: FIGURE,
    verdict: 'true',
    frame: 'line',
    member_lines: ['line:0', 'line:1'],
    edges: [],
    edge_count: 0,
  });
  rs.push(answered(FIGURE));
  return rs;
}

function setup() {
  const dom = new JSDOM('<!doctype html><html><body><main></main></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://example.test/library',
  });
  const w = dom.window;
  w.eval(read('src/connection-interaction.js'));
  const I = w.CMConnectionInteraction;
  const M = w.eval(`(function(){${read('src/library/marks.js')}\n})()`);
  const V = w.eval(`(function(){${read('src/library/connection-views.js')}\n})()`);
  const B = w.eval(`(function(){${read('src/library/connection-bindings.js')}\n})()`);
  const adapt = w.eval(
    `(function(){${read('src/connection-families.js')}\n${read('src/library/connection-adapter.js')}\nreturn _connectionModel;})()`
  );
  const build = (recs, complete) =>
    adapt(I, { records: recs, registry, report: { identity_hash: 'x' }, complete });
  return { dom, w, I, M, V, B, build };
}
function mount(env, built) {
  const host = env.w.document.querySelector('main');
  const m = env.B.mount(host, {
    ci: env.I,
    marks: env.M,
    createViews: env.V.createViews,
    model: built.model,
    current: built.current,
    view: 'matrix',
    narrow: () => false,
  });
  const strip = () => host.querySelector('.lib-mk-count').textContent;
  return { m, host, strip };
}

test('population: native-only bindings count, figures are separate, missing negative totals remain unknown', () => {
  const env = setup();
  const { model } = env.build(records(), true);
  const c = model.countsFor(model.checkedMethods);
  assert.equal(model.countsPopulation, 'method–token binding');
  // alliteration + internal rhyme + the native-only repetition binding.
  assert.equal(c.holds, 3);
  assert.equal(c.native_holds, 1);
  // Figure-only: its method contributes no binding hold, one native non-token-pair hold.
  assert.deepEqual(
    { holds: model.countsFor([FIGURE]).holds, figs: model.countsFor([FIGURE]).native_holds },
    { holds: 0, figs: 1 }
  );
  assert.equal(model.countsFor([NATIVE]).holds, 1);
  assert.equal(model.countsFor([NATIVE]).native_holds, 0);
  // An incomplete outcomes object is not a valid supplied backend total.
  const rs = records();
  for (const r of rs)
    if (r.kind === 'method_result')
      r.domain = { ...r.domain, listed_pairs_by_state: { judged_false: 3 } };
  const m2 = env.build(rs, true).model;
  for (const k of ['does_not_hold', 'refused', 'not_yet_computed'])
    assert.equal(m2.countsFor(m2.checkedMethods)[k], undefined, k);
  env.dom.window.close();
});

test('each complete ordered binding counts once; two states for one binding give no count', () => {
  const env = setup();
  const rs = records();
  const allit = rs.find((r) => inst(r) && r.method_id === ALLIT);
  rs.push({ ...clone(allit), id: 'relation_instance:dup' }); // same binding, another record
  const c = env.build(rs, true).model.countsFor([ALLIT]);
  assert.equal(c.holds, 1);
  assert.equal(c.undecided, 0);
  // The same binding loaded as undecided too: neither population is given.
  rs.push({ ...clone(allit), id: 'relation_instance:clash', verdict: 'undecided' });
  const d = env.build(rs, true).model.countsFor([ALLIT]);
  assert.equal(d.holds, undefined);
  assert.equal(d.undecided, undefined);
  // The reversed binding is a different ordered binding, so it is not a duplicate.
  const rev = {
    ...clone(allit),
    id: 'relation_instance:rev',
    a: clone(allit.b),
    b: clone(allit.a),
  };
  assert.equal(env.build(records().concat(rev), true).model.countsFor([ALLIT]).holds, 2);
  env.dom.window.close();
});

test('toggling a method recounts the strip through the real bindings', () => {
  const env = setup();
  const { m, host, strip } = mount(env, env.build(records(), true));
  assert.match(
    strip(),
    /^3 method–token binding holds loaded · 1 native non-token-pair hold counted separately · /
  );
  const box = (id) => host.querySelector(`input[data-method="${id}"]`);
  for (const [id, text] of [
    [NATIVE, /^2 method–token binding holds loaded · 1 native non-token-pair hold/],
    [FIGURE, /^2 method–token binding holds loaded · 0 native non-token-pair holds/],
    [ALLIT, /^1 method–token binding hold loaded · 0 native non-token-pair holds/],
  ]) {
    box(id).checked = false;
    box(id).dispatchEvent(new env.w.Event('change', { bubbles: true }));
    assert.match(strip(), text, id);
    assert.ok(!m.model().checkedMethods.includes(id));
  }
  box(NATIVE).checked = true;
  box(NATIVE).dispatchEvent(new env.w.Event('change', { bubbles: true }));
  assert.match(strip(), /^2 method–token binding holds loaded · 0 native non-token-pair holds/);
  env.dom.window.close();
});

test('pagination: a partial page gives no undecided; the verified last page refreshes it', () => {
  const env = setup();
  const all = records();
  const firstPage = all.filter((r) => !(inst(r) && r.method_id === RHYME));
  const { m, strip } = mount(env, env.build(firstPage, false));
  assert.match(strip(), /^2 method–token binding holds loaded/);
  assert.match(strip(), /Undecided[^·]*: not supplied/);
  assert.equal(m.model().counts.undecided, undefined);
  m.update(env.build(all, true));
  assert.match(strip(), /^3 method–token binding holds loaded/);
  assert.equal(m.model().counts.undecided, 0);
  assert.match(strip(), /0 undecided/i);
  // A method the reader unchecked stays unchecked, and uncounted, after the refresh.
  const host = env.w.document.querySelector('main');
  const box = host.querySelector(`input[data-method="${RHYME}"]`);
  box.checked = false;
  box.dispatchEvent(new env.w.Event('change', { bubbles: true }));
  m.update(env.build(all, true));
  assert.match(strip(), /^2 method–token binding holds loaded/);
  env.dom.window.close();
});

test('an unanswered checked method withholds undecided for the whole checked set', () => {
  const env = setup();
  const rs = records();
  rs.find((r) => r.kind === 'method_result' && r.method_id === NATIVE).coverage = 'partial';
  const model = env.build(rs, true).model;
  assert.equal(model.countsFor(model.checkedMethods).undecided, undefined);
  assert.equal(model.countsFor([ALLIT, RHYME]).undecided, 0);
  env.dom.window.close();
});

test('multi-token instances join native holds without becoming token pairs or figures', () => {
  const env = setup();
  const rs = records();
  const raw = clone(rs.find((r) => inst(r) && r.method_id === ALLIT));
  assert.equal(raw.a.token_ids.length, 1);
  assert.equal(raw.b.token_ids.length, 1);
  raw.id = 'relation_instance:multi-token';
  raw.a.token_ids.push(raw.b.token_ids[0]);
  rs.push(raw);
  const { model } = env.build(rs, true);
  assert.equal(model.counts.holds, 3);
  assert.equal(model.counts.native_holds, 2);
  assert.equal(
    model.figures.find((f) => f.evidence_id === raw.id).record.kind,
    'relation_instance'
  );
  assert.ok(!model.cells.some((c) => c.record.id === raw.id));
  const { strip } = mount(env, { model, current: env.build(rs, true).current });
  assert.match(strip(), /2 native non-token-pair holds counted separately/);
  env.dom.window.close();
});

test('network captions count the actual rendered nodes and edges without invented coverage', () => {
  const env = setup();
  const { model } = env.build(records(), true);
  const views = env.V.createViews({ interaction: env.I, marks: env.M });
  const network = views.network(model);
  const groups = [...network.querySelectorAll('.cv-group')];
  assert.ok(groups.length > 0, 'fixture must render a visual network group');
  for (const group of groups) {
    const nodes = group.querySelectorAll('[data-selection^="o:"]').length;
    const edges = group.querySelectorAll('.lib-mk-edge').length;
    assert.ok(nodes > 0 && edges > 0);
    assert.ok(group.textContent.includes(`Occurrences: ${nodes}`));
    assert.ok(group.textContent.includes(`Holds shown: ${edges}`));
    assert.match(group.textContent, /Eligible pairs examined: not supplied/);
    assert.match(group.textContent, /Joint reading consistency not assessed/);
  }
  env.dom.window.close();
});

// Authored backend-shaped totals: these are whole-method listed pairs, not
// a complement computed from the fixture's displayed relation records.
function withFalseTotals(a = 3, b = 0) {
  const rs = records();
  for (const [id, count] of [
    [ALLIT, a],
    [RHYME, b],
  ]) {
    const r = rs.find((r) => r.kind === 'method_result' && r.method_id === id);
    r.coverage = 'answered';
    r.domain = {
      ...r.domain,
      projection: 'exact_token_pair',
      pair_count: count + 2,
      listed_pairs_by_state: {
        listed: count + 2,
        true_pairs: 1,
        undecided_pairs: 1,
        judged_false: count,
        reading_dependent_pairs: 0,
      },
    };
  }
  return rs;
}

test('supplied false totals include zero and sum unique checked methods without counting records', () => {
  const env = setup();
  const rs = withFalseTotals();
  const { model } = env.build(rs, true);
  assert.equal(model.countsFor([RHYME]).does_not_hold, 0);
  assert.equal(model.countsFor([ALLIT, RHYME, ALLIT]).does_not_hold, 3);
  assert.doesNotMatch(model.countsFor([ALLIT]).summary, /whole-method listed pairs/);
  const duplicate = clone(rs.find((r) => inst(r) && r.method_id === ALLIT));
  rs.push({ ...duplicate, id: 'duplicate-for-count' });
  assert.equal(env.build(rs, true).model.countsFor([ALLIT]).does_not_hold, 3);
  const result = rs.find((r) => r.kind === 'method_result' && r.method_id === ALLIT);
  result.domain.ordering = 'unordered';
  // Backend totals count unordered pairs once; the UI must not double them.
  // A dependent token touching no listed pair does not invalidate the supplied total.
  result.domain.reading_dependent_tokens = ['unlisted-token'];
  assert.equal(env.build(rs, true).model.countsFor([ALLIT]).does_not_hold, 3);
  // Unsupported selected populations cannot silently disappear from a sum.
  assert.equal(model.countsFor([ALLIT, FIGURE]).does_not_hold, undefined);
  assert.equal(model.countsFor([]).does_not_hold, undefined);
  env.dom.window.close();
});

test('incomplete, unanswered, capped, non-projecting and invalid totals stay unknown', () => {
  const env = setup();
  const mutations = [
    (r) => {
      delete r.domain.listed_pairs_by_state;
    },
    (r) => {
      delete r.domain.listed_pairs_by_state.judged_false;
    },
    ...[null, -1, '3', 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1].map((value) => (r) => {
      r.domain.listed_pairs_by_state.judged_false = value;
    }),
    ...['partial', 'refused', 'unsupported'].map((value) => (r) => {
      r.coverage = value;
    }),
    (r) => {
      r.domain = { projection: 'none', reason: 'domain_cap', cap: 1 };
    },
    (r) => {
      r.domain.projection = 'none';
    },
    (r) => {
      r.domain.pair_count += 1;
    },
    (r) => {
      r.domain.listed_pairs_by_state.reading_dependent_pairs = 1;
    },
  ];
  for (const mutate of mutations) {
    const rs = withFalseTotals();
    mutate(rs.find((r) => r.kind === 'method_result' && r.method_id === ALLIT));
    assert.equal(env.build(rs, true).model.countsFor([ALLIT, RHYME]).does_not_hold, undefined);
  }
  assert.equal(
    env.build(withFalseTotals(), false).model.countsFor([ALLIT]).does_not_hold,
    undefined
  );
  env.dom.window.close();
});

test('negative strip survives view switches, recounts toggles and rejects a different source', () => {
  const env = setup();
  const built = env.build(withFalseTotals(), true);
  built.model.checkedMethods = [ALLIT, RHYME];
  built.model.counts = built.model.countsFor(built.model.checkedMethods);
  const { m, host, strip } = mount(env, built);
  assert.match(strip(), /3 do not hold/);
  for (const view of ['poem', 'network', 'matrix']) {
    host.querySelector(`[data-view="${view}"]`).click();
    assert.equal(m.view(), view);
    assert.match(strip(), /3 do not hold/);
  }
  const box = host.querySelector(`input[data-method="${ALLIT}"]`);
  box.checked = false;
  box.dispatchEvent(new env.w.Event('change', { bubbles: true }));
  assert.match(strip(), /0 do not hold/);
  const other = env.build(withFalseTotals(9, 8), true);
  other.current.analysisIdentity = 'different-source';
  assert.throws(() => m.update(other), /different analysis requires a new mount/);
  assert.match(strip(), /0 do not hold/);
  m.update(env.build(withFalseTotals(), false));
  assert.equal(m.model().counts.does_not_hold, undefined);
  assert.match(strip(), /Does not hold[^:]*: not supplied/);
  m.update(env.build(withFalseTotals(), true));
  assert.match(strip(), /0 do not hold/);
  env.dom.window.close();
});

test('Chromium renders backend false totals across the connected views', async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('https://counts.test/', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<main></main>' })
    );
    await page.goto('https://counts.test/');
    const sources = Object.fromEntries(
      ['marks', 'connection-views', 'connection-bindings'].map((name) => [
        name,
        read(`src/library/${name}.js`),
      ])
    );
    await page.addScriptTag({ content: read('src/connection-interaction.js') });
    await page.addScriptTag({ content: read('src/connection-families.js') });
    await page.addScriptTag({ content: read('src/library/connection-adapter.js') });
    await page.evaluate(
      ({ sources, records, registry, checked }) => {
        const I = globalThis.CMConnectionInteraction;
        const load = (name) => new Function(sources[name])();
        const built = globalThis._connectionModel(I, {
          records,
          registry,
          report: { identity_hash: 'browser-counts' },
          complete: true,
        });
        built.model.checkedMethods = checked;
        built.model.counts = built.model.countsFor(checked);
        load('connection-bindings').mount(globalThis.document.querySelector('main'), {
          ci: I,
          marks: load('marks'),
          createViews: load('connection-views').createViews,
          ...built,
          view: 'matrix',
          narrow: () => false,
        });
      },
      { sources, records: withFalseTotals(), registry, checked: [ALLIT, RHYME] }
    );
    for (const view of ['poem', 'network', 'matrix']) {
      await page.locator(`[data-view="${view}"]`).click();
      assert.match(
        await page.locator('.lib-mk-count-rest').innerText(),
        /3 do not hold \(whole-method listed pairs, summed over checked methods\)/
      );
      assert.doesNotMatch(await page.locator('.lib-mk-count-lead').innerText(), /whole-method/);
    }
    await page.locator('.cv-controls summary').click();
    await page.locator(`input[data-method="${ALLIT}"]`).uncheck();
    assert.match(
      await page.locator('.lib-mk-count-rest').innerText(),
      /0 do not hold \(whole-method listed pairs, summed over checked methods\)/
    );
  } finally {
    await browser.close();
  }
});

test('negative totals carry adjacent scope and correct plurality in all three views', () => {
  const env = setup();
  const views = env.V.createViews({ interaction: env.I, marks: env.M });
  for (const [count, verb] of [
    [0, 'do'],
    [1, 'does'],
    [3, 'do'],
  ]) {
    const { model } = env.build(withFalseTotals(count, 0), true);
    model.checkedMethods = [ALLIT, RHYME];
    model.counts = model.countsFor(model.checkedMethods);
    for (const view of ['poem', 'network', 'matrix']) {
      const root = views.render(model, { view });
      const lead = root.querySelector('.lib-mk-count-lead').textContent;
      const rest = root.querySelector('.lib-mk-count-rest').textContent;
      assert.ok(
        rest.includes(
          `${count} ${verb} not hold (whole-method listed pairs, summed over checked methods)`
        ),
        `${view}: ${rest}`
      );
      assert.doesNotMatch(lead, /whole-method listed pairs|Does not hold counts/);
    }
  }
  const rs = withFalseTotals();
  rs.find(
    (r) => r.kind === 'method_result' && r.method_id === ALLIT
  ).domain.listed_pairs_by_state.judged_false = null;
  const { model } = env.build(rs, true);
  model.checkedMethods = [ALLIT, RHYME];
  model.counts = model.countsFor(model.checkedMethods);
  for (const view of ['poem', 'network', 'matrix']) {
    const rest = views.render(model, { view }).querySelector('.lib-mk-count-rest').textContent;
    assert.match(rest, /Does not hold[^:]*: not supplied/);
    assert.doesNotMatch(rest, /0 do not hold|whole-method listed pairs/);
  }
  env.dom.window.close();
});
