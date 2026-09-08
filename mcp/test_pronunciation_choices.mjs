import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { LYRIC_TOOL_SCHEMAS, _argvInternals, _verdictInternals } from './lyric_tools.js';
import { declarationsOf, movedDeclarations } from './run_store.js';
const pronunciations = [
  {
    line: 'Cut that record',
    token: 3,
    word: 'record',
    phones: ['R', 'EH1', 'K', 'ER0', 'D'],
    basis: 'dictionary',
    source: 'writer: noun, the disc',
  },
];

test('connector exposes the same bounded occurrence declaration on all draft readers', () => {
  for (const name of [
    'lyric_grade',
    'lyric_revise',
    'lyric_check',
    'lyric_verify',
    'lyric_recover',
  ]) {
    const field = LYRIC_TOOL_SCHEMAS[name].pronunciations;
    assert(field, name);
    assert.deepEqual(field.parse(pronunciations), pronunciations);
    assert.throws(() => field.parse(Array(129).fill(pronunciations[0])));
    assert.throws(() => field.parse([{ ...pronunciations[0], token: true }]));
    assert(z.toJSONSchema(field).description.includes('Rerun grade'));
  }
});
test('argv preserves exact JSON; continuation rejects altered declarations', () => {
  const args = { pronunciations };
  assert.deepEqual(_argvInternals.globalsFor(args), [
    `--pronunciations=${JSON.stringify(pronunciations)}`,
  ]);
  const frozen = declarationsOf(args);
  assert.deepEqual(movedDeclarations(frozen, {}), []);
  assert.deepEqual(movedDeclarations(frozen, args), []);
  assert.equal(movedDeclarations(frozen, { pronunciations: [] })[0].field, 'pronunciations');
});
test('choices and options come from the authenticated result', () => {
  const options = { items: [], total: 0, truncated: false };
  const verdict = _verdictInternals.verdictOf({
    code: 2,
    stdout: '',
    stderr: '',
    lyric_result: {
      version: 1,
      status: 'graded',
      pronunciations,
      pronunciation_options: options,
      final_draft: ['Cut that record'],
      findings: [],
    },
  });
  assert.deepEqual(verdict.pronunciations, pronunciations);
  assert.deepEqual(verdict.pronunciation_options, options);
});

test('crashes retain bounded diagnostics instead of promising omitted stderr', () => {
  const result = _verdictInternals.verdictOf({
    code: 1,
    stdout: '',
    stderr: 'x'.repeat(9000) + '\nUnboundLocalError: cmd',
  });
  assert.equal(result.stderr.length, 8000);
  assert.equal(result.stderr_truncated, true);
  assert.match(result.stderr, /UnboundLocalError: cmd$/);
  assert.equal(result.certified, false);
});
