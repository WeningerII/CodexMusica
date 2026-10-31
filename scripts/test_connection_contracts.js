'use strict';
// Acceptance checks for three contracts started on #637 on 2026-10-31, written
// ahead of the code so nobody waits on tests afterwards. Each runs the real
// adapter over real captured records and renders the real views.
//
//   a. counts / coverage (BB8, #637 6547009973 item 6; 3PO 6545638972)
//   b. explicit ID -> display-family table (Jony, 6547098322; 3PO 6547110130)
//   c. reading disclosure (BB8; 3PO 6547011992; frozen spec lines 57-76)
//
// A check whose code has not landed is reported as TODO, never as a pass and
// never as a failure. Each TODO names what it waits for. Guards against wrong
// output (a progress counter shown as a total, a whole-method denominator on a
// hull, a hold turned undecided) run now and fail now.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const I = require('../src/connection-interaction.js');
const registry = require('../library/data/methods.json');
const BASE = require('./fixtures/connection-backend.json');
const READING = require('./fixtures/connection-backend-reading.json').captures;
const adapterSource = read('src/library/connection-adapter.js');
const adapt = new Function(adapterSource + '\nreturn _connectionModel;')();

function model(records, { reg = registry, complete = true, report = {} } = {}) {
  return adapt(I, {
    records,
    registry: reg,
    report: { identity_hash: 'contract-checks', ...report },
    complete,
  }).model;
}

// The real views in a document, as test_connection_views.js mounts them.
function views() {
  const dom = new JSDOM(
    '<!doctype html><html data-theme="light"><body><main id="surface-library"></main></body></html>',
    { runScripts: 'outside-only', url: 'https://example.test/library' }
  );
  const w = dom.window;
  w.eval(read('src/connection-interaction.js'));
  const WI = w.CMConnectionInteraction;
  const M = w.eval(`(function(){${read('src/library/marks.js')}\n})()`);
  const api = w.eval(`(function(){${read('src/library/connection-views.js')}\n})()`);
  return { V: api.createViews({ interaction: WI, marks: M }), WI, dom };
}
const textOf = (root) => root.textContent.replace(/\s+/g, ' ');
const clone = (v) => JSON.parse(JSON.stringify(v));

// ── a. counts / coverage ────────────────────────────────────────────────────
// Sentinels no real count on these fixtures can equal.
const PROGRESS = { true: 551, false: 552, undecided: 553, candidates: 554, evidence_records: 555 };
const COUNTS_FALSE = 777;
const COUNTS_CANDIDATES = 778;
const WHOLE_PAIRS = 4343;
const WHOLE_LISTED = 4242;
function sentinelRecords({ listed } = {}) {
  const records = clone(BASE.records);
  for (const r of records.filter((x) => x.kind === 'method_result')) {
    r.counts = { ...r.counts, false: COUNTS_FALSE, candidates: COUNTS_CANDIDATES };
    r.domain = { ...r.domain, pair_count: WHOLE_PAIRS };
    if (listed) r.domain.listed_pairs_by_state = { ...listed };
  }
  return records;
}
const countsWired = (m) => Object.keys(m.counts || {}).length > 0;
const groupsWired = (m) => Object.keys(m.groupCounts || {}).length > 0;
const SENTINELS = [
  ...Object.values(PROGRESS),
  COUNTS_FALSE,
  COUNTS_CANDIDATES,
  WHOLE_PAIRS,
  WHOLE_LISTED,
];

test('a1 progress counters and method candidate counts never become displayed totals', () => {
  const m = model(sentinelRecords({ listed: { listed: WHOLE_LISTED } }), {
    report: { progress: PROGRESS },
  });
  const supplied = JSON.stringify({ counts: m.counts, groupCounts: m.groupCounts });
  for (const n of SENTINELS)
    assert.ok(!supplied.includes(String(n)), `${n} reached the counts: ${supplied}`);
  const { V, dom } = views();
  m.checkedMethods = m.methods.filter((x) => !x.disabledReason).map((x) => x.method_id);
  for (const view of ['poem', 'matrix', 'network']) {
    // The count strip and the hulls, not the raw coverage JSON in the footer.
    const root = V.render(m, { view });
    const strips = [...root.querySelectorAll('.lib-mk-count, .cv-group')].map(textOf).join(' ');
    for (const n of SENTINELS) assert.ok(!strips.includes(String(n)), `${view}: ${n} shown`);
  }
  dom.window.close();
});

test('a2 a count the backend does not emit leaves its slot unpopulated, never zero', () => {
  const m = model(sentinelRecords());
  for (const [state, value] of Object.entries(m.counts || {}))
    assert.ok(value === undefined || (Number.isInteger(value) && value >= 0), `${state}: ${value}`);
  // No listed_pairs_by_state on these records: "does not hold" has no source.
  assert.equal(m.counts?.does_not_hold, undefined);
  const { V, dom } = views();
  const strip = textOf(V.render(m, { view: 'matrix' }).querySelector('.lib-mk-count'));
  assert.match(strip, /Does not hold[^·]*: not supplied/);
  assert.doesNotMatch(strip, /\b0 does not hold/);
  dom.window.close();
});

test('a3 the strip counts the holds actually displayed for the checked methods', (t) => {
  const m = model(BASE.records);
  if (!countsWired(m)) return t.todo('waits for BB8 counts wiring (model.counts is {})');
  const checked = new Set(m.checkedMethods);
  const holds = m.cells.filter(
    (c) => checked.has(c.selection.method_id) && I.cellState(c).state === 'holds'
  ).length;
  assert.equal(m.counts.holds, holds);
});

test('a4 does-not-hold comes only from the supplied listed population, null stays unsupplied', (t) => {
  const listed = {
    listed: WHOLE_LISTED,
    true_records: 1,
    undecided_records: 0,
    judged_false: 3,
    reading_dependent_pairs: 0,
  };
  const m = model(sentinelRecords({ listed }));
  if (!countsWired(m)) return t.todo('waits for BB8 counts wiring (model.counts is {})');
  assert.equal(m.counts.does_not_hold, 3 * m.checkedMethods.length);
  const withheld = model(sentinelRecords({ listed: { ...listed, judged_false: null } }));
  assert.equal(withheld.counts.does_not_hold, undefined);
});

test('a5 "listed for this group" appears only with a hull-local population', () => {
  // The whole method's listed pairs and pair_count are supplied; no hull-local
  // count is. A hull must never borrow either as its denominator.
  const m = model(sentinelRecords({ listed: { listed: WHOLE_LISTED } }));
  for (const [id, g] of Object.entries(m.groupCounts || {}))
    for (const [k, v] of Object.entries(g))
      assert.ok(![WHOLE_LISTED, WHOLE_PAIRS].includes(v), `${id}.${k} = ${v}`);
  const { V, dom } = views();
  m.checkedMethods = m.methods.filter((x) => !x.disabledReason).map((x) => x.method_id);
  for (const g of V.render(m, { view: 'network' }).querySelectorAll('.cv-group')) {
    const text = textOf(g);
    assert.doesNotMatch(text, /listed for this group/);
    assert.doesNotMatch(text, new RegExp(`of (${WHOLE_LISTED}|${WHOLE_PAIRS})\\b`));
  }
  dom.window.close();
});

test('a6 a hull counts the holds it draws, out of a population it was given', (t) => {
  const m = model(BASE.records);
  if (!groupsWired(m)) return t.todo('waits for BB8 group-count wiring (groupCounts is {})');
  for (const [id, g] of Object.entries(m.groupCounts)) {
    const drawn = m.cells.filter(
      (c) => c.selection.method_id === id && I.cellState(c).state === 'holds'
    ).length;
    assert.equal(g.shown, drawn, `${id}: shown ${g.shown}, drawn ${drawn}`);
  }
});

// ── b. display families ─────────────────────────────────────────────────────
// Today's heuristic, frozen here as the baseline the explicit table must keep
// (connection-adapter.js at #652 e8f0a24fa5, lines 39-49).
function baselineFamily(name) {
  if (name.includes('assonance') || name === 'vowel@v1') return 'assonance';
  if (name.includes('consonance') || name === 'coda@v1') return 'consonance';
  if (name === 'alliteration' || /^(stressed_)?onset@/.test(name)) return 'alliteration';
  if (name.includes('rhyme')) return 'rhyme';
  return undefined;
}
const DISPLAYED = registry.methods.filter((m) => I.layerOfNamespace(m.namespace));
const tableLanded = () =>
  fs.existsSync(path.join(ROOT, 'src/connection-families.js')) &&
  /CONNECTION_FAMILIES/.test(adapterSource);

test('b1 84/84 ids keep today’s display family', () => {
  assert.equal(DISPLAYED.length, 84, 'registry baseline: 80 schema + 4 shared_sound');
  const families = new Map(model(BASE.records).methods.map((m) => [m.method_id, m.family]));
  const tally = {};
  for (const m of DISPLAYED) {
    const want = baselineFamily(m.name);
    assert.equal(families.get(m.id), want, `${m.id} (${m.name})`);
    tally[want || 'none'] = (tally[want || 'none'] || 0) + 1;
  }
  assert.deepEqual(tally, { rhyme: 37, consonance: 5, assonance: 3, alliteration: 3, none: 36 });
});

test('b2 renaming a method never moves its family', (t) => {
  if (!tableLanded())
    return t.todo('waits for src/connection-families.js and its adapter wiring (3PO)');
  const reg = clone(registry);
  const rhyme = reg.methods.find((m) => baselineFamily(m.name) === 'rhyme');
  const none = reg.methods.find(
    (m) => I.layerOfNamespace(m.namespace) && baselineFamily(m.name) === undefined
  );
  const before = { [rhyme.id]: 'rhyme', [none.id]: undefined };
  rhyme.name = 'renamed figure';
  none.name = 'perfect rhyme (renamed)';
  const after = new Map(model(BASE.records, { reg }).methods.map((m) => [m.method_id, m.family]));
  for (const [id, family] of Object.entries(before)) assert.equal(after.get(id), family, id);
});

test('b3 an id with no display family keeps its native evidence', () => {
  const reg = clone(registry);
  const id = 'schema:contract-check-unknown';
  reg.methods.push({ id, name: 'unlisted figure', namespace: 'schema' });
  const records = clone(BASE.records);
  const source = records.find((r) => r.kind === 'relation_instance');
  records.push({ ...clone(source), id: 'relation_instance:contract-check', method_id: id });
  const result = records.find(
    (r) => r.kind === 'method_result' && r.method_id === source.method_id
  );
  records.push({ ...clone(result), id: 'method_result:contract-check', method_id: id });
  const m = model(records, { reg });
  const method = m.methods.find((x) => x.method_id === id);
  assert.ok(method, 'the method is listed');
  assert.equal(method.family, undefined);
  assert.ok(
    m.cells.some((c) => c.selection.method_id === id) || m.figures.some((f) => f.method_id === id),
    'its evidence is kept'
  );
  const { V, dom } = views();
  m.checkedMethods = m.methods.filter((x) => !x.disabledReason).map((x) => x.method_id);
  const native = [...V.render(m, { view: 'poem' }).querySelectorAll('.cv-native button')];
  assert.ok(
    native.some((b) => I.selectionFromKey(b.dataset.selection)?.method_id === id),
    'and the native list offers it'
  );
  dom.window.close();
});

// ── c. reading disclosure ───────────────────────────────────────────────────
function inspect(capture, pick) {
  const m = model(READING[capture].records);
  const { V, WI, dom } = views();
  m.checkedMethods = m.methods.filter((x) => !x.disabledReason).map((x) => x.method_id);
  m.selection = pick(m, WI);
  const pane = V.render(m, { view: 'poem' }).querySelector('.cv-inspector');
  const verdict = pane.querySelector('.cv-verdict');
  const out = { m, text: textOf(pane), verdict: verdict ? textOf(verdict) : '' };
  dom.window.close();
  return out;
}
const holdOf =
  (i = 0) =>
  (m) =>
    m.cells.filter((c) => I.cellState(c).state === 'holds')[i].selection;
const phones = (reading) => reading.phones.join(' ');

test('c1 every reading of an occurrence is shown', (t) => {
  const records = READING.witness_first.records;
  const tok = records.find(
    (r) => r.kind === 'token' && r.reading_choices?.dictionary_readings?.length > 1
  );
  const { text } = inspect('witness_first', () => I.occurrence(tok.token_id));
  const readings = tok.reading_choices.dictionary_readings.map(phones);
  const shown = readings.filter((p) => text.includes(p));
  if (!shown.length) return t.todo('waits for reading disclosure: no reading of the word shown');
  assert.deepEqual(shown, readings, `every reading of "${tok.reading_choices.word}"`);
});

test('c2 the witnessing reading is named as word = PHONES', (t) => {
  const { m, text } = inspect('witness_first', holdOf());
  const cell = m.cells.find((c) => I.cellState(c).state === 'holds');
  const witness = cell.record.reading?.witness || [];
  assert.ok(witness.length, 'the capture supplies a witness');
  for (const w of witness) assert.ok(text.includes(w), `witness "${w}" missing`);
  if (/\["/.test(text)) return t.todo('waits for reading disclosure: witness is shown as raw JSON');
});

test('c3 failing alternatives are listed where judged', (t) => {
  const { m, text } = inspect('reading_dependent', holdOf());
  const alternates = m.cells.flatMap((c) => c.record?.alternates || []);
  if (!alternates.length)
    return t.todo('waits for BB8 judged-alternative outcomes (no record carries them)');
  for (const a of alternates) assert.ok(text.includes(a.reading || a.text || String(a)), a);
});

test('c4 readings that were not judged say so', (t) => {
  // witness_first: the search stopped at the first compatible reading.
  const { m, text } = inspect('witness_first', holdOf());
  const cell = m.cells.find((c) => I.cellState(c).state === 'holds');
  assert.equal(cell.record.reading_search.termination_reason, 'witness_found');
  const said =
    /Not computed under this reading|Other readings not examined|alternative readings were not searched in this scope/i;
  if (!said.test(text))
    return t.todo('waits for reading disclosure: unjudged readings are not named in words');
  assert.doesNotMatch(text, /search partial/i);
});

test('c5 an existential hold still reads "holds" when another reading fails', () => {
  for (const capture of ['witness_first', 'reading_dependent']) {
    const m = model(READING[capture].records);
    const holds = m.cells.filter(
      (c) => c.record?.verdict === 'true' && c.record.quantifier === 'exists_compatible_reading'
    );
    assert.ok(holds.length, `${capture}: the capture has existential holds`);
    for (const c of holds) {
      assert.equal(I.cellState(c).state, 'holds', `${capture} ${I.selectionKey(c.selection)}`);
      const { verdict } = inspect(capture, () => c.selection);
      assert.match(verdict, /^holds\b/i, `${capture}: verdict "${verdict}"`);
      assert.doesNotMatch(verdict, /undecided|search partial/i);
    }
  }
});
