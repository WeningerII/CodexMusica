'use strict';
// Acceptance checks for three contracts started on #637 on 2026-10-31, written
// ahead of the code so nobody waits on tests afterwards. Each runs the real
// adapter over real captured records and renders the real views.
//
//   a. counts / coverage (BB8, #637 6547009973 item 6; 3PO 6545638972)
//   b. explicit ID -> display-family table (Jony, 6547098322; 3PO 6547110130)
//   c. reading disclosure (BB8; 3PO 6547011992; frozen spec lines 57-76)
//
// Three kinds of check (3PO, #637 6547341635):
//   - GUARDS against wrong output (a progress counter shown as a total, a
//     whole-method denominator on a hull, a hold turned undecided) always run
//     and always fail on wrong output.
//   - GATES for a feature run only once LANDED below declares it. From then on
//     missing output FAILS: a regression that removes the feature cannot stay
//     green. Until then each gate is a static TODO naming what it waits for.
//   - Open TODOs for checks whose data contract is not agreed yet (a4, c1).
//     They assert nothing until BB8's bounded data contract fixes the shape.
// A feature is declared landed by flipping its flag in the same change that
// lands it (or, to try a gate early, CONNECTION_CONTRACTS_LANDED=counts,...).
// The honesty guard fails if a feature's output appears while its flag is off,
// so a gate is never left switched off over code that exists.
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

const LANDED = {
  counts: true, // landed on #652 at d59dde55b1 (item 6)
  groupCounts: true, // landed on #652 at d59dde55b1 (item 6)
  familyTable: true, // landed on #652 at c4b0114af6
  readingDisclosure: true, // landed on #652 at d59dde55b1 (item 5)
  judgedAlternatives: true, // landed on #652 at d59dde55b1 (item 5, reading_outcomes)
  negativeTotals: false, // backend #673 (8eec7302b0); strip wiring is #674 (3PO)
};
for (const k of (process.env.CONNECTION_CONTRACTS_LANDED || '').split(',').filter(Boolean)) {
  if (!(k in LANDED)) throw Error(`CONNECTION_CONTRACTS_LANDED: unknown feature ${k}`);
  LANDED[k] = true;
}
// A gate: enforced once its feature is declared landed, a static TODO before.
const gate = (feature, waits) => (LANDED[feature] ? {} : { todo: `not landed: ${waits}` });
// The adapter reads the family table as a page global, as test_connection_adapter.js supplies it.
const FAMILIES_FILE = path.join(ROOT, 'src/connection-families.js');
const FAMILIES = fs.existsSync(FAMILIES_FILE)
  ? require(FAMILIES_FILE).CONNECTION_FAMILIES
  : undefined;
const adapt = new Function('CONNECTION_FAMILIES', adapterSource + '\nreturn _connectionModel;')(
  FAMILIES
);

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
  // `summary` is the strip's own sentence; every other entry is a count.
  const { summary, ...numbers } = m.counts || {};
  assert.ok(summary === undefined || typeof summary === 'string', 'summary is text');
  assert.doesNotMatch(summary || '', /does not hold|not yet computed|refused/i, summary);
  for (const [state, value] of Object.entries(numbers))
    assert.ok(value === undefined || (Number.isInteger(value) && value >= 0), `${state}: ${value}`);
  // No listed_pairs_by_state on these records: "does not hold" has no source.
  assert.equal(m.counts?.does_not_hold, undefined);
  const { V, dom } = views();
  const strip = textOf(V.render(m, { view: 'matrix' }).querySelector('.lib-mk-count'));
  assert.match(strip, /Does not hold[^·]*: not supplied/);
  assert.doesNotMatch(strip, /\b0 does not hold/);
  dom.window.close();
});

test(
  'a3 the strip counts the holds actually displayed for the checked methods',
  gate('counts', 'BB8 counts wiring'),
  () => {
    const m = model(BASE.records);
    assert.ok(Number.isInteger(m.counts?.holds), `counts.holds is ${m.counts?.holds}`);
    const checked = new Set(m.checkedMethods);
    const holds = m.cells.filter(
      (c) => checked.has(c.selection.method_id) && I.cellState(c).state === 'holds'
    ).length;
    assert.equal(m.counts.holds, holds);
  }
);

// The listed population is `domain.listed_pairs_by_state` on each method's
// result (#673, contracts.py DomainOutcomes): whole-method listed pairs, with
// `judged_false` null unless the method answered with no reading-dependent pair.
const LISTED = [
  { listed: 2, true_pairs: 1, undecided_pairs: 0, judged_false: 1, reading_dependent_pairs: 0 },
  { listed: 5, true_pairs: 1, undecided_pairs: 1, judged_false: 3, reading_dependent_pairs: 0 },
];
function withListed(edit = () => {}) {
  const records = clone(BASE.records);
  records
    .filter((r) => r.kind === 'method_result')
    .forEach((r, i) => {
      r.domain = { ...r.domain, listed_pairs_by_state: clone(LISTED[i]) };
      edit(r, i);
    });
  return records;
}
const dnh = (m) => (m.countsFor ? m.countsFor(m.checkedMethods) : m.counts)?.does_not_hold;

test(
  'a4 does-not-hold comes only from the supplied listed population; an unsupplied part stays unsupplied',
  gate('negativeTotals', 'does-not-hold strip wiring (#674)'),
  () => {
    // Summed over the checked methods' supplied totals: 1 + 3.
    const m = model(withListed());
    assert.equal(dnh(m), 4);
    const { V, dom } = views();
    const strip = textOf(V.render(m, { view: 'matrix' }).querySelector('.lib-mk-count'));
    assert.match(strip, /\b4 does not hold/);
    assert.doesNotMatch(strip, /Does not hold[^·]*: not supplied/);
    dom.window.close();
    // A whole-method total, not a count of loaded records: a duplicate
    // relation record moves nothing.
    const dup = withListed();
    const inst = dup.find((r) => r.kind !== 'method_result' && r.method_id);
    dup.push({ ...clone(inst), id: `${inst.id}:dup` });
    assert.equal(dnh(model(dup)), 4);
    // One method with no total, or a null total, leaves the sum unsupplied:
    // never the other method's part alone and never zero.
    for (const edit of [
      (r, i) => i === 1 && delete r.domain.listed_pairs_by_state,
      (r, i) => i === 1 && (r.domain.listed_pairs_by_state.judged_false = null),
    ]) {
      const part = model(withListed(edit));
      assert.equal(dnh(part), undefined);
      const { V: V2, dom: d2 } = views();
      const s2 = textOf(V2.render(part, { view: 'matrix' }).querySelector('.lib-mk-count'));
      assert.match(s2, /Does not hold[^·]*: not supplied/);
      assert.doesNotMatch(s2, /\b[01] does not hold/);
      d2.window.close();
    }
    // An incomplete load supplies nothing.
    assert.equal(dnh(model(withListed(), { complete: false })), undefined);
  }
);

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

test(
  'a6 a hull counts the holds it draws, out of a population it was given',
  gate('groupCounts', 'BB8 group-count wiring'),
  () => {
    const m = model(BASE.records);
    const withHolds = new Set(
      m.cells.filter((c) => I.cellState(c).state === 'holds').map((c) => c.selection.method_id)
    );
    for (const id of withHolds) assert.ok(m.groupCounts?.[id], `no group counts for ${id}`);
    for (const [id, g] of Object.entries(m.groupCounts)) {
      const drawn = m.cells.filter(
        (c) => c.selection.method_id === id && I.cellState(c).state === 'holds'
      ).length;
      assert.equal(g.shown, drawn, `${id}: shown ${g.shown}, drawn ${drawn}`);
    }
  }
);

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

test(
  'b2 renaming a method never moves its family',
  gate('familyTable', 'src/connection-families.js (Jony) and its adapter line (3PO)'),
  () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'src/connection-families.js')), 'the table file');
    assert.match(adapterSource, /CONNECTION_FAMILIES/, 'the adapter reads the table');
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
  }
);

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
  const out = {
    m,
    text: textOf(pane),
    verdict: verdict ? textOf(verdict) : '',
    pane: { witness: witnessText(pane) },
  };
  dom.window.close();
  return out;
}
// The text under the inspector's witness heading, up to the next heading.
function witnessText(pane) {
  const h = [...pane.querySelectorAll('h4')].find((x) => /witness/i.test(x.textContent));
  let out = '';
  for (let n = h?.nextElementSibling; n && n.tagName !== 'H4'; n = n.nextElementSibling)
    out += n.textContent + ' ';
  return out.trim();
}
const witnessBlock = (pane) => pane.witness;
const holdOf =
  (i = 0) =>
  (m) =>
    m.cells.filter((c) => I.cellState(c).state === 'holds')[i].selection;

// Which readings apply (the reading inventory and its policy) is part of BB8's
// bounded data contract; every dictionary entry is not assumed eligible.
test.todo(
  "c1 every applicable reading of an occurrence is shown — waits for BB8's bounded data contract"
);

test('c2-guard the witnessing reading is never dropped', () => {
  const { m, text } = inspect('witness_first', holdOf());
  const cell = m.cells.find((c) => I.cellState(c).state === 'holds');
  const witness = cell.record.reading?.witness || [];
  assert.ok(witness.length, 'the capture supplies a witness');
  for (const w of witness) assert.ok(text.includes(w), `witness "${w}" missing`);
});

test(
  'c2 the witnessing reading is named as word = PHONES, not raw JSON',
  gate('readingDisclosure', 'inspector reading wording'),
  () => {
    const { m, pane } = inspect('witness_first', holdOf());
    const cell = m.cells.find((c) => I.cellState(c).state === 'holds');
    const block = witnessBlock(pane);
    for (const w of cell.record.reading.witness) assert.ok(block.includes(w), w);
    assert.doesNotMatch(block, /[[\]"{}]/, `witness shown as data: ${block}`);
  }
);

test(
  'c3 the selected binding lists its own judged failing alternatives',
  gate('judgedAlternatives', 'BB8 bounded outcomes for judged alternatives'),
  () => {
    // Only the selected binding's record: another binding's alternatives
    // cannot fail this check (3PO 6547341635).
    const { m, text } = inspect('reading_dependent', holdOf());
    const selected = m.cells.find((c) => I.sameSelection(c.selection, m.selection));
    // Judged outcomes ride on the record as reading_outcomes (#652 d59dde55b1).
    const failing = (selected.record?.reading_outcomes || []).filter((o) => o.verdict !== 'true');
    assert.ok(failing.length, 'the selected record carries judged failing alternatives');
    // Each is shown with its verdict and every role's phones under it.
    const shown = text.split(/Judged alternative \d+ · /).slice(1);
    assert.equal(shown.length, failing.length, 'one entry per judged failing alternative');
    failing.forEach((o, i) => {
      assert.match(shown[i], /^does not hold/, `alternative ${i + 1}: ${shown[i].slice(0, 40)}`);
      for (const r of o.assignment) assert.ok(shown[i].includes(`: ${r.phones}`), r.display);
    });
  }
);

test('c4-guard a witness-found hold never reads "search partial"', () => {
  const { m, text } = inspect('witness_first', holdOf());
  const cell = m.cells.find((c) => I.cellState(c).state === 'holds');
  assert.equal(cell.record.reading_search.termination_reason, 'witness_found');
  assert.doesNotMatch(text.replace(/\{[^}]*\}/g, ''), /search partial/i);
});

test(
  'c4 readings that were not judged say so in words',
  gate('readingDisclosure', 'inspector reading wording'),
  () => {
    const { text } = inspect('witness_first', holdOf());
    assert.match(
      text,
      /Not computed under this reading|Other readings not examined|alternative readings were not searched in this scope|No verdict is supplied for other combinations/i
    );
  }
);

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

// ── declared landings ───────────────────────────────────────────────────────
test('honesty: a feature whose output exists is declared landed, so its gate runs', () => {
  const m = model(BASE.records);
  const seen = {
    counts: Object.keys(m.counts || {}).length > 0,
    groupCounts: Object.keys(m.groupCounts || {}).length > 0,
    familyTable: fs.existsSync(path.join(ROOT, 'src/connection-families.js')),
    negativeTotals: dnh(model(withListed())) !== undefined,
    judgedAlternatives: Object.values(READING).some((c) =>
      c.records.some((r) => Array.isArray(r.reading_outcomes) && r.reading_outcomes.length)
    ),
  };
  for (const [feature, present] of Object.entries(seen))
    assert.ok(!present || LANDED[feature], `${feature} exists: set LANDED.${feature} = true`);
});
