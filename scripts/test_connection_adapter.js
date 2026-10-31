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
const adapt = new Function(fs.readFileSync(source, 'utf8') + '\nreturn _connectionModel;')();
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
const make = (records = fixture.records, complete = true) =>
  adapt(I, {
    records,
    registry,
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
  const records = structuredClone(captured.records);
  const raw = records.find((r) => r.kind === 'relation_figure');
  // Exercise the real paged-figure hydrator with the member pages withheld.
  raw.edge_count = raw.edges.length;
  delete raw.edges;
  const hydrated = await analysis.hydrateEvidence(records);
  assert.ok(hydrated.pending.length);
  const { model } = make(hydrated.records, false);
  const figure = model.figures.find((f) => f.evidence_id === raw.id);
  assert.deepEqual(figure.members.frame, raw.frame);
  assert.deepEqual(figure.members.member_lines, raw.member_lines);
  assert.equal(figure.members.edges, undefined);
  assert.equal(figure.members.edges_incomplete, true);
  assert.equal(figure.members.edge_count, raw.edge_count);
  assert.ok(!model.cells.some((c) => c.record.id === raw.id));
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
