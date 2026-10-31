'use strict';
// Backend-generated acceptance-case records through the connection adapter.
// These authored scenarios patch fixture lexicon entries; they are not corpus evidence. The captures in
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

const load = (name, complete = true) => {
  const c = captures[name];
  const result = c.records.find((r) => r.kind === 'method_result');
  const { model } = adapt(I, {
    records: c.records,
    registry,
    report: { identity_hash: c.identity.hash },
    complete,
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

// Contract-fidelity repairs in src/connection-interaction.js (#637 6545487626).
// Each fails on d2fea651f0 and passes with the repair.

test('a capped edge names the cap, not its unknown channels', () => {
  const { cell } = load('combination_cap');
  const capped = cell('line:0:token:0', 'line:1:token:1');
  assert.deepEqual(capped.record.unknown_channels, [
    ['nucleus', 0],
    ['coda', 0],
  ]);
  const words = I.stateWords(I.cellState(capped));
  assert.equal(words, 'undecided · reading search reached its cap');
  assert.doesNotMatch(words, /\b0, 0\b/);
});

// Synthetic channel_unknown record matching the backend tuple shape.
test('a channel reason names the channels, not their positions', () => {
  const rec = {
    verdict: 'undecided',
    undecided_reason: 'channel_unknown',
    unknown_channels: [
      ['nucleus', 0],
      ['coda', 1],
      ['nucleus', 1],
    ],
  };
  const result = I.cellState({ inLocus: true, jobComplete: true, record: rec });
  assert.equal(result.reason, 'nucleus, coda not settled');
});

test("a refused method's cells show the backend's refusal detail", () => {
  const { result, cell } = load('refused_cap');
  const state = I.cellState(cell('line:0:token:3', 'line:1:token:3'));
  assert.equal(state.state, 'refused');
  assert.equal(state.reason, result.refusal.detail);
});

test('an absent reading-dependent cell is not yet computed until pages complete', () => {
  const partial = load('reading_dependent', false).cell('line:0:token:0', 'line:0:token:1');
  assert.equal(partial.record, undefined);
  assert.equal(I.cellState(partial).state, 'not_yet_computed');
  const whole = load('reading_dependent', true).cell('line:0:token:0', 'line:0:token:1');
  assert.equal(I.stateWords(I.cellState(whole)), 'Not certified across readings');
});

test('an explicit hold and an explicit refusal still answer on partial pages', () => {
  const held = load('witness_first', false).cell('line:0:token:0', 'line:1:token:1');
  assert.equal(I.cellState(held).state, 'holds');
  const refused = load('refused_cap', false).cell('line:0:token:3', 'line:1:token:3');
  assert.equal(I.cellState(refused).state, 'refused');
});

test('readings not searched in scope read as such, never as first-listed only', () => {
  const rec = { verdict: 'undecided', undecided_reason: 'readings_not_searched_in_scope' };
  const result = I.cellState({ inLocus: true, jobComplete: true, record: rec });
  assert.equal(result.reason, 'alternative readings were not searched in this scope');
});
