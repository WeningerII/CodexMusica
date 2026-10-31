'use strict';
// Authored acceptance scenarios captured from the real backend, not corpus evidence.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const I = require('../src/connection-interaction');
const { CONNECTION_FAMILIES } = require('../src/connection-families');
const registry = require('../library/data/methods.json');
const { captures } = require('./fixtures/connection-backend-reading.json');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const adapt = new Function(
  'CONNECTION_FAMILIES',
  read('src/library/connection-adapter.js') + '\nreturn _connectionModel;'
)(CONNECTION_FAMILIES);
function setup(name, mutate) {
  const records = structuredClone(captures[name].records);
  mutate?.(records);
  const { model } = adapt(I, {
    records,
    registry,
    report: { identity_hash: captures[name].identity.hash },
    complete: true,
  });
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  const marks = dom.window.eval(`(function(){${read('src/library/marks.js')}\n})()`);
  const source = process.env.CONNECTION_VIEWS_SOURCE
    ? fs.readFileSync(process.env.CONNECTION_VIEWS_SOURCE, 'utf8')
    : read('src/library/connection-views.js');
  const views = dom.window
    .eval(`(function(){${source}\n})()`)
    .createViews({ interaction: I, marks });
  const inspect = (cell) => {
    model.selection = cell.selection;
    return views.inspector(model);
  };
  return { model, dom, inspect, views };
}

function row(pane, heading) {
  const label = [...pane.querySelectorAll('h4')].find((h) => h.textContent === heading);
  assert.ok(label, heading);
  return label.nextElementSibling.textContent;
}

test('captured shared-sound witness uses judged anchors despite absent work anchors', () => {
  const e = setup('shared_sound_alternate');
  try {
    const cell = e.model.cells.find(
      (c) =>
        c.record.a.token_ids[0] === 'line:0:token:0' && c.record.b.token_ids[0] === 'line:1:token:1'
    );
    assert.ok(cell);
    assert.equal(cell.record.namespace, 'shared_sound');
    assert.equal(cell.record.a.anchor_position, null);
    assert.equal(cell.record.judged_under.basis, 'no_span_on_work');
    assert.equal(cell.record.judged_under.verdict, null);
    assert.deepEqual(cell.record.compared.anchors, [0, 0]);
    const pane = e.inspect(cell);
    const text = row(pane, 'Compared span / anchors (engine supplied)');
    assert.match(text, /a: anchor position 1 in the judged span; unit 1/);
    assert.match(text, /b: anchor position 1 in the judged span; unit 1/);
    assert.match(text, /Judged aligned pair 1: a unit 1 with b unit 1/);
    assert.match(text, /Aligned positions: a unit 1 with b unit 1; a unit 2 with b unit 2/);
    assert.match(row(pane, 'Whole-word witness'), /zanchor = Z IY1 T AH0/);
    assert.equal(pane.querySelector('.cv-verdict').textContent, 'holds');
  } finally {
    e.dom.window.close();
  }
});

test('authored nonzero shared-sound position indexes the supplied aligned pair, not the slice', () => {
  const e = setup('shared_sound_alternate', (records) => {
    const r = records.find((r) => r.kind === 'relation_instance');
    r.compared.position = 1;
    r.compared.aligned = [
      [0, 1],
      [2, 3],
    ];
    r.compared.anchors = [2, 3];
  });
  try {
    const cell = e.model.cells.find((c) => c.record.compared.position === 1);
    const text = row(e.inspect(cell), 'Compared span / anchors (engine supplied)');
    assert.match(text, /a: anchor position 3 in the judged span; unit 3/);
    assert.match(text, /b: anchor position 4 in the judged span; unit 4/);
    assert.match(text, /Judged aligned pair 2: a unit 3 with b unit 4/);
  } finally {
    e.dom.window.close();
  }
});

test('captured witness, compared units, locus and partial search have readable rows', () => {
  const e = setup('witness_first');
  try {
    const cell = e.model.cells.find((c) => c.record.reading?.witness);
    assert.ok(cell);
    const pane = e.inspect(cell);
    assert.equal(row(pane, 'Whole-word witness'), cell.record.reading.witness.join('; '));
    const compared = row(pane, 'Compared span / anchors (engine supplied)');
    assert.match(
      compared,
      /a: anchor position 1 in the supplied span; unit 1: zee; onset: Z; nucleus: IY/
    );
    assert.match(compared, /b: anchor position 1 in the supplied span; unit 1: bee; onset: B/);
    assert.match(compared, /Aligned positions: a unit 1 with b unit 1/);
    assert.equal(row(pane, 'Locus'), 'both members end their lines: true');
    assert.equal(
      row(pane, 'Reading search'),
      'Search: partial; Stopped because a witness was found; combinations examined: 1; search budget: 64'
    );
    assert.equal(pane.querySelector('.cv-verdict').textContent, 'holds');
    assert.deepEqual(
      cell.record.reading_search,
      captures.witness_first.records.find((r) => r.id === cell.record.id).reading_search
    );
    assert.equal(cell.record.a.anchor_position, 0);
    assert.equal(cell.record.compared.a[0].nucleus, 'IY');
  } finally {
    e.dom.window.close();
  }
});

test('captured capped search and merged sounds retain alternatives and budget semantics', () => {
  const e = setup('combination_cap');
  try {
    const cell = e.model.cells.find((c) => c.record.reading_search?.reason === 'combination_cap');
    assert.ok(cell);
    const pane = e.inspect(cell);
    assert.equal(
      row(pane, 'Reading search'),
      'Search: partial; Stopped because the search budget was reached; combinations examined: 1; search budget: 1'
    );
    assert.match(
      row(pane, 'Compared span / anchors (engine supplied)'),
      /nucleus: reading alternatives: IY \/ UW/
    );
    assert.match(pane.querySelector('.cv-verdict').textContent, /^undecided/);
  } finally {
    e.dom.window.close();
  }
});

test('authored unknown metadata replay preserves punctuation and unknown versus false', () => {
  const e = setup('witness_first', (records) => {
    const r = records.find((r) => r.kind === 'relation_instance');
    r.reading.witness = ['word[aside] = Z', 'word:two = B'];
    r.compared.a[0].text = 'word[aside]';
    r.a.anchor_position = null;
    r.placement_reads = [
      ['same_line', false],
      ['different_lines', null],
      ['future_locus', true],
    ];
    r.reading_search = {
      state: 'unavailable',
      reason: 'rebuild_unavailable',
      combinations_examined: 0,
      combination_limit: 64,
    };
  });
  try {
    const pane = e.inspect(e.model.cells.find((c) => c.record.reading?.witness));
    assert.equal(row(pane, 'Whole-word witness'), 'word[aside] = Z; word:two = B');
    assert.match(
      row(pane, 'Compared span / anchors (engine supplied)'),
      /a: anchor position not supplied; unit 1: word\[aside\]/
    );
    assert.equal(
      row(pane, 'Locus'),
      'members are on the same line: false; members are on different lines: unknown; unrecognized value: future_locus: true'
    );
    assert.equal(
      row(pane, 'Reading search'),
      'Search: unavailable; Reason: reading rebuild unavailable; combinations examined: 0; search budget: 64'
    );
  } finally {
    e.dom.window.close();
  }
});

test('authored absent and not-needed search metadata never claims an unjudged verdict', () => {
  for (const state of [undefined, 'not_needed', 'future_state']) {
    const e = setup('witness_first', (records) => {
      const r = records.find((r) => r.kind === 'relation_instance');
      r.reading_search = state ? { state } : undefined;
      r.reading.witness = { $detail_ref: 'pending' };
      delete r.compared;
      delete r.alignment;
    });
    try {
      const pane = e.inspect(e.model.cells.find((c) => c.record.reading?.witness));
      assert.equal(row(pane, 'Whole-word witness'), 'Unrecognized witness metadata');
      assert.match(
        row(pane, 'Compared span / anchors (engine supplied)'),
        /compared units not supplied/
      );
      assert.match(
        row(pane, 'Compared span / anchors (engine supplied)'),
        /Aligned positions: not supplied/
      );
      const text = row(pane, 'Reading search');
      assert.equal(
        text,
        state === undefined
          ? 'Reading search not supplied'
          : `Search: ${state === 'not_needed' ? 'not needed for this judgment' : 'unrecognized value: future_state'}; combinations examined: not supplied; search budget: not supplied`
      );
      assert.equal(pane.querySelector('.cv-verdict').textContent, 'holds');
      assert.doesNotMatch(pane.textContent, /not judged|unjudged/);
    } finally {
      e.dom.window.close();
    }
  }
});

test('real first witness keeps its existential hold and discloses only supplied assignments', () => {
  const e = setup('witness_first');
  try {
    const cell = e.model.cells.find((c) => c.record.witness_assignment);
    assert.ok(cell);
    const pane = e.inspect(cell);
    assert.equal(pane.querySelector('.cv-verdict').textContent, 'holds');
    assert.match(pane.textContent, /Witness assignment/);
    assert.match(pane.textContent, /Base · merged reading sets · undecided/);
    assert.match(pane.textContent, /no single pronunciation supplied \(merged reading set\)/);
    assert.match(pane.textContent, /bee · L2 w2: B IY1 \(only applicable reading\)/);
    assert.match(pane.textContent, /Applicable readings \(variants\): Z IY1 \/ Z AH0/);
    assert.equal(cell.record.reading_search.state, 'partial');
    assert.equal(cell.record.reading_outcomes.length, 0);
    assert.doesNotMatch(pane.textContent, /Judged alternative/);
    assert.match(pane.textContent, /No verdict is supplied for other combinations/);
    assert.equal(I.cellState(cell).state, 'holds');
  } finally {
    e.dom.window.close();
  }
});

test('real duplicate words retain distinct occurrence roles and their fixed partner', () => {
  const e = setup('repeated_words');
  try {
    for (const line of [0, 2]) {
      const id = `line:${line}:token:0`;
      const cell = e.model.cells.find(
        (c) =>
          I.selectionOccurrences(c.selection).includes(id) &&
          I.selectionOccurrences(c.selection).includes('line:1:token:1')
      );
      assert.ok(cell, 'both captured zea occurrences must have an edge to bee');
      assert.ok(cell.record.reading_outcomes.length > 0);
      const pane = e.inspect(cell);
      assert.match(pane.textContent, /Judged alternative 1 · does not hold/);
      assert.ok(
        pane.textContent.includes(
          `${line === 0 ? 'a' : 'b'} · zea · L${line + 1} w1: Z AH0 (varied reading)`
        )
      );
      assert.ok(!pane.textContent.includes(`zea · L${3 - line} w1`));
      assert.ok(
        pane.textContent.includes(
          `${line === 0 ? 'b' : 'a'} · bee · L2 w2: B IY1 (only applicable reading)`
        )
      );
      assert.equal(pane.querySelector('.cv-verdict').textContent, 'holds');
    }
  } finally {
    e.dom.window.close();
  }
});

test('real capped search shows its judged assignment without expanding the inventory into verdicts', () => {
  const e = setup('combination_cap');
  try {
    const cell = e.model.cells.find((c) => c.record.reading_outcomes?.length);
    assert.ok(cell);
    const pane = e.inspect(cell);
    assert.equal(
      pane.querySelector('.cv-verdict').textContent,
      'undecided · reading search reached its cap'
    );
    assert.equal(
      [...pane.querySelectorAll('h4')].filter((h) => h.textContent.startsWith('Judged alternative'))
        .length,
      cell.record.reading_outcomes.length
    );
    assert.match(row(pane, 'Reading search'), /the search budget was reached/);
    assert.equal(cell.record.reading_search.reason, 'combination_cap');
    assert.match(pane.textContent, /Z IY1 D \/ Z UW1 T/);
    e.model.selection = I.occurrence('line:0:token:0');
    assert.match(e.views.inspector(e.model).textContent, /Applicable readings \(variants\)/);
  } finally {
    e.dom.window.close();
  }
});

test('authored boundary replay distinguishes outside locus, unavailable inventory and unread members', () => {
  // Explicit shape replay, not a newly computed verdict. The backend separately
  // tests outside_locus and unread/merged provenance; no combinations are generated here.
  const e = setup('combination_cap', (records) => {
    const r = records.find((r) => r.kind === 'relation_instance');
    r.reading_outcomes[0].verdict = 'outside_locus';
    r.reading_outcomes[0].assignment[0].held = 'unread';
    r.reading_outcomes[0].assignment[0].phones = null;
    r.reading_outcomes[0].assignment[0].display = '<script>wrong spelling identity</script>';
    const token = records.find((r) => r.token_id === 'line:0:token:0');
    token.applicable_source = 'unlocatable';
    token.applicable_readings = null;
  });
  try {
    const pane = e.inspect(e.model.cells.find((c) => c.record.reading_outcomes?.length));
    assert.match(pane.textContent, /outside locus \(not a predicate false\)/);
    assert.match(pane.textContent, /pronunciation unavailable \(unread\)/);
    assert.match(pane.textContent, /Applicable readings \(unavailable\): not supplied/);
    assert.doesNotMatch(pane.textContent, /wrong spelling identity/);
    assert.equal(pane.querySelector('script'), null);
  } finally {
    e.dom.window.close();
  }
});

test('unresolved assignment details remain not supplied and never become invented alternatives', () => {
  // Authored pending-detail replay of the real record, not new backend evidence.
  const e = setup('witness_first', (records) => {
    const r = records.find((r) => r.kind === 'relation_instance');
    r.witness_assignment = { $detail_ref: 'pending-witness' };
    r.reading_outcomes = { $detail_ref: 'pending-outcomes' };
    r.judged_under.assignment = { $detail_ref: 'pending-base' };
  });
  try {
    const cell = e.model.cells.find((c) => c.record.witness_assignment);
    const pane = e.inspect(cell);
    assert.equal(pane.querySelector('.cv-verdict').textContent, 'holds');
    assert.match(pane.textContent, /Witness assignmentAssignment not supplied/);
    assert.doesNotMatch(pane.textContent, /Judged alternative/);
    assert.match(pane.textContent, /No verdict is supplied for other combinations/);
  } finally {
    e.dom.window.close();
  }
});
