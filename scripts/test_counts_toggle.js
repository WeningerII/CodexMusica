'use strict';
// BB8 handoff check (#637 item 6, 3PO 6547583040 / 6547517269): the strip
// counts loaded method-token bindings of the checked methods, figures apart,
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
    `(function(){${read('src/library/connection-adapter.js')}\nreturn _connectionModel;})()`
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

test('population: native-only bindings count, figures are separate, negative unwired', () => {
  const env = setup();
  const { model } = env.build(records(), true);
  const c = model.countsFor(model.checkedMethods);
  assert.equal(model.countsPopulation, 'method–token binding');
  // alliteration + internal rhyme + the native-only repetition binding.
  assert.equal(c.holds, 3);
  assert.equal(c.figure_holds, 1);
  // Figure-only: its method contributes no binding hold, one figure hold.
  assert.deepEqual(
    { holds: model.countsFor([FIGURE]).holds, figs: model.countsFor([FIGURE]).figure_holds },
    { holds: 0, figs: 1 }
  );
  assert.equal(model.countsFor([NATIVE]).holds, 1);
  assert.equal(model.countsFor([NATIVE]).figure_holds, 0);
  // Never wired, even when a backend judged_false is supplied.
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
    /^3 method–token binding holds loaded · 1 figure hold counted separately · /
  );
  const box = (id) => host.querySelector(`input[data-method="${id}"]`);
  for (const [id, text] of [
    [NATIVE, /^2 method–token binding holds loaded · 1 figure hold/],
    [FIGURE, /^2 method–token binding holds loaded · 0 figure holds/],
    [ALLIT, /^1 method–token binding hold loaded · 0 figure holds/],
  ]) {
    box(id).checked = false;
    box(id).dispatchEvent(new env.w.Event('change', { bubbles: true }));
    assert.match(strip(), text, id);
    assert.ok(!m.model().checkedMethods.includes(id));
  }
  box(NATIVE).checked = true;
  box(NATIVE).dispatchEvent(new env.w.Event('change', { bubbles: true }));
  assert.match(strip(), /^2 method–token binding holds loaded · 0 figure holds/);
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
