'use strict';
// Real backend reading records through the connection adapter. The captures in
// fixtures/connection-backend-reading.json come from the backend's own
// acceptance scenarios (scripts/capture_connection_reading_fixtures.py); the
// older connection fixtures exercise no reading branch at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../src/connection-interaction');
const registry = require('../library/data/methods.json');
const { captures } = require('./fixtures/connection-backend-reading.json');
const source =
  process.env.CONNECTION_ADAPTER_SOURCE ||
  path.join(__dirname, '../src/library/connection-adapter.js');
const adapt = new Function(fs.readFileSync(source, 'utf8') + '\nreturn _connectionModel;')();

const load = (name) => {
  const c = captures[name];
  const result = c.records.find((r) => r.kind === 'method_result');
  const { model } = adapt(I, {
    records: c.records,
    registry,
    report: { identity_hash: c.identity.hash },
    complete: true,
  });
  const cell = (a, b) =>
    model.cell(
      I.binding(result.method_id, [
        { role: 'a', entity_id: a },
        { role: 'b', entity_id: b },
      ])
    );
  return { c, result, model, cell };
};

test('every capture is a real reading case, not a not_needed search', () => {
  const states = Object.values(captures).flatMap((c) =>
    c.records.filter((r) => r.kind === 'relation_instance').map((r) => r.reading_search.state)
  );
  assert.ok(states.includes('partial'));
  assert.equal(
    captures.reading_dependent.records.find((r) => r.kind === 'method_result').domain
      .reading_dependent_tokens.length,
    1
  );
  assert.equal(
    captures.refused_cap.records.find((r) => r.kind === 'method_result').refusal.kind,
    'reading_combinations'
  );
});

test('a first-reading witness holds and keeps its witness and partial search', () => {
  const { cell } = load('witness_first');
  const held = cell('line:0:token:0', 'line:1:token:1');
  assert.equal(I.cellState(held).state, 'holds');
  assert.deepEqual(held.record.reading.witness, ['zee = Z IY1']);
  assert.equal(held.record.reading_search.state, 'partial');
  assert.equal(held.record.reading_search.termination_reason, 'witness_found');
});

test('a combination cap is undecided, never false, and keeps its cap reason', () => {
  const { cell } = load('combination_cap');
  const capped = cell('line:0:token:0', 'line:1:token:1');
  assert.equal(I.cellState(capped).state, 'undecided');
  assert.equal(capped.record.undecided_reason, 'combination_cap');
  assert.equal(capped.record.reading_search.state, 'partial');
});

test('a reading-dependent occurrence keeps the backend domain policy', () => {
  const { result, cell } = load('reading_dependent');
  assert.deepEqual(result.domain.reading_dependent_tokens, ['line:0:token:1']);
  assert.equal(result.domain.reading_policy, 'exists_compatible_reading');
  const held = cell('line:0:token:1', 'line:0:token:0');
  assert.equal(I.cellState(held).state, 'holds');
  assert.equal(held.record.reading.witness.length, 2);
});

test('a method refused for its reading cap refuses its cells', () => {
  const { result, cell } = load('refused_cap');
  assert.equal(result.coverage, 'refused');
  assert.match(result.refusal.detail, /combination/);
  assert.equal(I.cellState(cell('line:0:token:3', 'line:1:token:3')).state, 'refused');
});
