'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../src/connection-interaction');
const fixture = require('./fixtures/connection-backend.json');
const registry = require('../library/data/methods.json');
const source =
  process.env.CONNECTION_ADAPTER_SOURCE ||
  path.join(__dirname, '../src/library/connection-adapter.js');
const { CONNECTION_FAMILIES } = require('../src/connection-families');
const adapt = new Function(
  'CONNECTION_FAMILIES',
  fs.readFileSync(source, 'utf8') + '\nreturn _connectionModel;'
)(CONNECTION_FAMILIES);
const complete = new Function(fs.readFileSync(source, 'utf8') + '\nreturn _connectionComplete;')();
test('absence certification requires every manifest page, record and detail part', () => {
  const report = { partial: false, page_count: 2, evidence_count: 15 };
  assert.equal(complete(report, 15, 1, null, 0), true);
  assert.equal(complete(report, 14, 1, null, 0), false);
  assert.equal(complete(report, 15, 0, null, 0), false);
  assert.equal(complete(report, 15, 1, 2, 0), false);
  assert.equal(complete(report, 15, 1, null, 1), false);
  assert.equal(complete({ ...report, partial: true }, 15, 1, null, 0), false);
});
const make = (records = fixture.records, complete = true, methodRegistry = registry) =>
  adapt(I, {
    records,
    registry: methodRegistry,
    report: { identity_hash: fixture.identity.hash },
    complete,
  });
const method = registry.methods.find((m) => m.name === 'alliteration').id;
const pair = (a = 'line:1:token:0', b = 'line:1:token:1') =>
  I.binding(method, [
    { role: 'a', entity_id: a },
    { role: 'b', entity_id: b },
  ]);

test('actual bounded AnalysisSession records retain identities, roles, ranges and evidence', () => {
  const { model, current } = make();
  assert.equal(model.occurrences.length, 4);
  assert.deepEqual(model.poem.ranges['line:1:token:0'], { start: 0, end: 3 });
  assert.equal(current.analysisIdentity, fixture.identity.hash);
  const holding = model.cell(pair('line:0:token:0', 'line:0:token:1'));
  assert.equal(I.cellState(holding).state, 'holds');
  assert.equal(holding.selection.kind, 'binding');
  const raw = fixture.records.find((r) => r.id === holding.record.id);
  assert.deepEqual(holding.record.compared.a, raw.compared.a);
  assert.deepEqual(holding.record.reading_search, raw.reading_search);
  assert.equal(I.cellState(model.cell(pair())).state, 'does_not_hold');
});
test('unloaded pages or unresolved detail parts cannot certify absence', () => {
  assert.equal(
    I.cellState(make(fixture.records, false).model.cell(pair())).state,
    'not_yet_computed'
  );
  const records = fixture.records.filter((r) => r.kind !== 'method_result');
  assert.equal(I.cellState(make(records, false).model.cell(pair())).state, 'not_yet_computed');
});
test('reading-dependent absence is distinct from engine undecided and negatives', () => {
  const records = structuredClone(fixture.records);
  records.find(
    (r) => r.method_id === method && r.kind === 'method_result'
  ).domain.reading_dependent_tokens = ['line:1:token:0'];
  const result = I.cellState(make(records).model.cell(pair()));
  assert.equal(result.uncertified, true);
  assert.equal(I.stateWords(result), 'Not certified across readings');
});
test('unrequested shared sound is disabled; a display model never requests analysis', () => {
  const sound = make().model.methods.filter((m) => m.namespace === 'shared_sound');
  assert.equal(sound.length, 4);
  assert.ok(sound.every((m) => m.disabledReason && m.layer === 'sound'));
});
test('explicitly requested backend shared sound preserves its namespace and unordered binding', () => {
  const sound = require('./fixtures/connection-backend-sound.json');
  const { model } = make(sound.records);
  const method = model.methods.find((m) => m.namespace === 'shared_sound' && !m.disabledReason);
  assert.equal(method.layer, 'sound');
  const cell = model.cells.find((c) => c.selection.method_id === method.id);
  assert.equal(cell.selection.kind, 'pair');
  assert.equal(cell.record.namespace, 'shared_sound');
  assert.equal(model.cell(I.pair(method.id, ...cell.selection.members.slice().reverse())), cell);
});
test('native multi-token bindings are not expanded into arbitrary pair cliques', () => {
  const records = structuredClone(fixture.records);
  const r = records.find((r) => r.kind === 'relation_instance');
  r.a.token_ids.push('line:1:token:0');
  const { model } = make(records);
  assert.ok(model.figures.some((f) => f.evidence_id === r.id && f.record.a.token_ids.length === 2));
  assert.deepEqual(model.figures.find((f) => f.evidence_id === r.id).members, { a: r.a, b: r.b });
  assert.ok(!model.cells.some((c) => c.record.id === r.id));
});
test('an unresolved occurrence does not change a pair into a fabricated figure', () => {
  const records = fixture.records.filter((r) => r.token_id !== 'line:0:token:0');
  const r = records.find(
    (r) => r.kind === 'relation_instance' && r.a.token_ids.includes('line:0:token:0')
  );
  const { model } = make(records, false);
  assert.ok(!model.figures.some((f) => f.evidence_id === r.id));
  assert.ok(!model.cells.some((c) => c.record.id === r.id));
});
test('actual hydrator withholds unresolved detail records before adaptation', async () => {
  const analysis = new Function(
    'CMLyricTokens',
    fs.readFileSync(path.join(__dirname, '../src/library/analysis.js'), 'utf8')
  )(require('../src/lyric-tokens'));
  const records = structuredClone(fixture.records);
  const r = records.find((r) => r.kind === 'relation_instance');
  r.compared = {
    $detail_ref: 'missing',
    encoding: 'json',
    parts: 1,
    byte_length: 2,
    sha256: '0'.repeat(64),
  };
  const hydrated = await analysis.hydrateEvidence(records);
  assert.equal(hydrated.pending.length, 1);
  const { model } = make(hydrated.records, hydrated.pending.length === 0);
  assert.equal(I.cellState(model.cell(pair())).state, 'not_yet_computed');
});
test('same spelling remains distinct and imprecise source ranges are not guessed', () => {
  const records = structuredClone(fixture.records);
  const tokens = records.filter((r) => r.kind === 'token');
  tokens[1].text = tokens[0].text;
  tokens[0].source_ranges[0].precision = 'row';
  const { model } = make(records);
  assert.notEqual(model.occurrences[0].entity_id, model.occurrences[1].entity_id);
  assert.equal(model.poem.ranges[tokens[0].token_id], undefined);
});

const analysis = new Function(
  'CMLyricTokens',
  fs.readFileSync(path.join(__dirname, '../src/library/analysis.js'), 'utf8')
)(require('../src/lyric-tokens'));
const { JSDOM } = require('jsdom');
const markDocument = new JSDOM('<!doctype html>').window.document;
const marks = new Function(
  'document',
  fs.readFileSync(path.join(__dirname, '../src/library/marks.js'), 'utf8')
)(markDocument);

test('actual native figure membership reaches the existing inspector without pair projection', async () => {
  const captured = require('./fixtures/connection-backend-figure.json');
  const hydrated = await analysis.hydrateEvidence(captured.records);
  assert.equal(hydrated.pending.length, 0);
  const raw = hydrated.records.find((r) => r.kind === 'relation_figure');
  assert.ok(raw);
  const { model } = make(hydrated.records);
  const figure = model.figures.find((f) => f.evidence_id === raw.id);
  assert.deepEqual(figure.members.frame, raw.frame);
  assert.deepEqual(figure.members.member_lines, raw.member_lines);
  assert.deepEqual(figure.members.edges, raw.edges);
  assert.ok(!model.cells.some((c) => c.record.id === raw.id));
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  const views = dom.window
    .eval(
      `(function(){${fs.readFileSync(path.join(__dirname, '../src/library/connection-views.js'), 'utf8')}\n})()`
    )
    .createViews({ interaction: I, marks });
  model.selection = I.figure(raw.id);
  const inspector = views.inspector(model);
  assert.ok(inspector.textContent.includes(JSON.stringify(figure.members)));
  dom.window.close();
});

test('partial figure edges retain supplied membership and explicit incompleteness', async () => {
  const captured = require('./fixtures/connection-backend-figure.json');
  const complete = await analysis.hydrateEvidence(structuredClone(captured.records));
  assert.deepEqual(complete.pending, []);
  const records = complete.records;
  const raw = records.find((r) => r.kind === 'relation_figure');
  assert.ok(Array.isArray(raw.edges));
  const edgeCount = raw.edges.length;
  assert.ok(Number.isSafeInteger(edgeCount) && edgeCount > 0);
  // Exercise the real paged-figure hydrator with the member pages withheld.
  raw.edge_count = edgeCount;
  delete raw.edges;
  const hydrated = await analysis.hydrateEvidence(records);
  assert.ok(hydrated.pending.includes(`Figure ${raw.id} has 0 of ${edgeCount} verified edges.`));
  const { model } = make(hydrated.records, false);
  const figure = model.figures.find((f) => f.evidence_id === raw.id);
  assert.deepEqual(figure.members.frame, raw.frame);
  assert.deepEqual(figure.members.member_lines, raw.member_lines);
  assert.equal(figure.members.edges, undefined);
  assert.equal(figure.members.edges_incomplete, true);
  assert.equal(figure.members.edge_count, edgeCount);
  assert.ok(Number.isSafeInteger(figure.members.edge_count) && figure.members.edge_count > 0);
  assert.equal(model.cells.length, 0);
});

test('supplied token order identifies line endings and drives actual margin geometry', () => {
  const { model } = make();
  const ends = model.occurrences.filter((o) => o.final);
  assert.deepEqual(
    ends.map((o) => o.entity_id),
    ['line:0:token:1', 'line:1:token:1']
  );
  const point = (o) => ({ ...o, x: 100, y: o.line * 70 });
  const geometry = marks.arcGeometry(...ends.map(point), { margin: 760, gutter: 10 });
  assert.equal(geometry.route, 'margin');
  assert.equal(geometry.stems.length, 2);
  const internal = model.occurrences.find((o) => o.entity_id === 'line:0:token:0');
  assert.equal(
    marks.arcGeometry(point(internal), point(ends[1]), { margin: 760, gutter: 10 }).route,
    'interline'
  );
  const shuffled = fixture.records.slice().reverse();
  assert.deepEqual(
    make(shuffled)
      .model.occurrences.filter((o) => o.final)
      .map((o) => o.entity_id)
      .sort(),
    ends.map((o) => o.entity_id).sort()
  );
  assert.ok(
    make(fixture.records.slice(0, 2), false).model.occurrences.every((o) => o.final !== true)
  );
});

// Exercise the production controller functions with real adaptation and a mount
// fault; isolate their closure dependencies without duplicating lifecycle logic.
test('replacement mount failure cleans current identity but superseded loads stay silent', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/library/analysis.js'), 'utf8');
  const functions = source.slice(
    source.indexOf('  function clearConnections()'),
    source.indexOf('  const fail =', source.indexOf('  function clearConnections()'))
  );
  const harness = new Function(
    'adapt',
    'complete',
    'I',
    'records',
    'registry',
    functions +
      `
    let alive = true, connections = null, connectionJob = null,
      connectionIdentity = null, connectionGeneration = 0;
    const host = { textContent: '', replaceChildren() { this.textContent = ''; } };
    const root = { querySelector: () => host }, slot = () => host;
    const st = { lens: 'sound', authorized: true, resolved: records, registry, pending: [] };
    const mem = { job: { id: 'job' }, report: { identity_hash: 'first' }, records, offset: 0, next: null };
    const _connectionModel = adapt, _connectionComplete = complete, CMConnectionInteraction = I;
    let mounts = 0, destroys = 0, release, delayed = false;
    const bindings = { mount() {
      mounts++;
      if (mounts > 1) { host.textContent = 'partially mounted'; throw Error('forced mount failure'); }
      return { destroy() { destroys++; }, update() {} };
    } };
    const libraryChunk = async name => {
      if (delayed && name === 'marks') await new Promise(r => { release = r; });
      return name === 'connection-bindings' ? bindings : {};
    };
    return { drawConnections, clearConnections, host, mem,
      counts: () => ({ mounts, destroys }), delay: () => { delayed = true; }, release: () => release() };
  `
  )(adapt, complete, I, fixture.records, registry);
  await harness.drawConnections();
  harness.mem.report.identity_hash = 'second';
  await harness.drawConnections();
  assert.deepEqual(harness.counts(), { mounts: 2, destroys: 1 });
  assert.equal(
    harness.host.textContent,
    'Connection views unavailable. Verified evidence remains below.'
  );
  harness.delay();
  const pending = harness.drawConnections();
  harness.clearConnections();
  harness.host.textContent = 'new owner';
  harness.release();
  await pending;
  assert.equal(harness.host.textContent, 'new owner');
  assert.equal(harness.counts().mounts, 2);
});

test('real backend holds draw directed; explicit reversed-record replay keeps a/b anchors', () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  const views = dom.window
    .eval(
      `(function(){${fs.readFileSync(process.env.CONNECTION_VIEWS_SOURCE || path.join(__dirname, '../src/library/connection-views.js'), 'utf8')}\n})()`
    )
    .createViews({ interaction: I, marks });
  for (const reverse of [false, true]) {
    const records = structuredClone(fixture.records);
    const raw = records.find((r) => r.kind === 'relation_instance' && r.verdict === 'true');
    assert.ok(raw);
    // Deliberate record-orientation replay, not a newly computed engine verdict.
    // It exercises the adapter boundary without sorting a/b back into text order.
    if (reverse) [raw.a, raw.b] = [raw.b, raw.a];
    const { model } = make(records);
    const cell = model.cells.find((c) => c.record.id === raw.id);
    const selection = cell.selection;
    assert.equal(selection.kind, 'binding');
    assert.deepEqual(
      selection.members.map((m) => [m.role, m.entity_id]),
      [
        ['a', raw.a.token_ids[0]],
        ['b', raw.b.token_ids[0]],
      ]
    );
    model.selection = selection;
    const edge = [...views.network(model).querySelectorAll('.lib-mk-edge')].find(
      (n) => n.dataset.selection === I.selectionKey(selection)
    );
    assert.ok(edge);
    assert.equal(edge.dataset.directed, 'true');
    assert.equal(edge.querySelectorAll('.lib-mk-head').length, 1);
    const expected = selection.members
      .map(
        (m) =>
          `${m.role}: ${I.occurrenceLabel(model.occurrences.find((o) => o.entity_id === m.entity_id))}`
      )
      .join(' → ');
    assert.ok(edge.getAttribute('aria-label').includes(expected));
    assert.ok(views.inspector(model).textContent.includes(expected));
  }
  dom.window.close();
});

test('actual adapter families survive registry renames without changing evidence', () => {
  const renamed = structuredClone(registry);
  for (const m of renamed.methods) m.name = 'consonance of renamed things';
  const baseline = make().model;
  const changed = make(fixture.records, true, renamed).model;
  assert.deepEqual(
    changed.methods.map((m) => [m.id, m.family, m.matrix_projection]),
    baseline.methods.map((m) => [m.id, m.family, m.matrix_projection])
  );
  assert.deepEqual(changed.cells, baseline.cells);
  assert.ok(changed.methods.every((m) => m.name === 'consonance of renamed things'));
});

test('a new unmapped id keeps native evidence despite a family-looking name', () => {
  // Authored id mutation of actual captured records, not a new engine result.
  const unknown = 'schema:unmapped-family-fixture';
  const records = structuredClone(fixture.records);
  for (const r of records) if (r.method_id === method) r.method_id = unknown;
  const raw = records.find((r) => r.kind === 'relation_instance' && r.method_id === unknown);
  raw.a.token_ids.push('line:1:token:0');
  const changedRegistry = structuredClone(registry);
  const entry = changedRegistry.methods.find((m) => m.id === method);
  entry.id = unknown;
  entry.name = 'alliteration';
  const { model } = make(records, true, changedRegistry);
  const adapted = model.methods.find((m) => m.id === unknown);
  assert.equal(adapted.family, undefined);
  assert.equal(adapted.matrix_projection, 'none');
  assert.equal(adapted.coverage.visual_projection, 'Native bindings only: no agreed visual family');
  const figure = model.figures.find((f) => f.evidence_id === raw.id);
  assert.deepEqual(figure.members, { a: raw.a, b: raw.b });
  assert.deepEqual(figure.record.a, raw.a);
  assert.ok(!model.cells.some((c) => c.record.id === raw.id));
});

test('an unknown-family singleton retains its record, asked binding and native control', () => {
  // Authored method-id mutation of captured singleton evidence; no new engine result.
  const unknown = 'schema:unmapped-singleton-fixture';
  const records = structuredClone(fixture.records);
  const singletons = records.filter(
    (r) =>
      r.kind === 'relation_instance' &&
      r.method_id === method &&
      r.a?.token_ids.length === 1 &&
      r.b?.token_ids.length === 1
  );
  assert.ok(singletons.length > 0, 'captured fixture must supply singleton bindings');
  const raw = singletons[0];
  assert.notEqual(raw.a.token_ids[0], raw.b.token_ids[0]);
  const baseline = make().model.cells.find((c) => c.record.id === raw.id);
  assert.ok(baseline, 'captured singleton must be available before the id mutation');
  for (const r of records) if (r.method_id === method) r.method_id = unknown;
  const changedRegistry = structuredClone(registry);
  changedRegistry.methods.find((m) => m.id === method).id = unknown;
  const { model } = make(records, true, changedRegistry);
  const cell = model.cells.find((c) => c.record.id === raw.id);
  assert.ok(cell);
  assert.deepEqual(cell.record, { ...baseline.record, method_id: unknown });
  assert.deepEqual(cell.selection, { ...baseline.selection, method_id: unknown });
  assert.equal(cell.selection.kind, 'binding');
  assert.equal(model.cell(cell.selection), cell);
  assert.equal(I.cellState(cell).state, I.cellState(baseline).state);
  assert.equal(model.methods.find((m) => m.id === unknown).family, undefined);
  assert.ok(!model.figures.some((f) => f.evidence_id === raw.id));
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  try {
    const views = dom.window
      .eval(
        `(function(){${fs.readFileSync(path.join(__dirname, '../src/library/connection-views.js'), 'utf8')}\n})()`
      )
      .createViews({ interaction: I, marks });
    model.checkedMethods = [unknown];
    model.selection = cell.selection;
    const rendered = views.render(model, { view: 'network' });
    const native = [...rendered.querySelectorAll('.cv-native button')].filter(
      (button) => button.dataset.selection === I.selectionKey(cell.selection)
    );
    assert.equal(native.length, 1, 'the unchanged binding remains natively selectable');
    assert.ok(native[0].textContent.includes('a:'));
    assert.ok(native[0].textContent.includes('b:'));
    assert.equal(rendered.querySelectorAll('.lib-mk-edge').length, 0);
  } finally {
    dom.window.close();
  }
});
