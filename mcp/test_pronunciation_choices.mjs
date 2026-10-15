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
  // `none`: CMUdict alone, so no supplement flags lead (lexicon_basis.js).
  const args = { pronunciations, lexicon_supplement: 'none' };
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

test('source numbering is optional, bounded and preserved across schemas and argv', () => {
  for (const numbering of ['v1', 'v1+voices', 'v2', 'v2+voices']) {
    const choices = pronunciations.map((p) => ({ ...p, numbering }));
    for (const name of [
      'lyric_grade',
      'lyric_revise',
      'lyric_check',
      'lyric_verify',
      'lyric_recover',
    ])
      assert.deepEqual(LYRIC_TOOL_SCHEMAS[name].pronunciations.parse(choices), choices);
    for (const name of ['lyric_revise', 'lyric_check', 'lyric_verify']) {
      assert.equal(LYRIC_TOOL_SCHEMAS[name].numbering.parse(numbering), numbering);
      assert.throws(() => LYRIC_TOOL_SCHEMAS[name].numbering.parse('v9'));
    }
    assert.deepEqual(
      _argvInternals.globalsFor({ numbering, pronunciations: choices, lexicon_supplement: 'none' }),
      [`--numbering=${numbering}`, `--pronunciations=${JSON.stringify(choices)}`]
    );
    assert.equal(
      movedDeclarations(declarationsOf({ numbering }), { numbering: 'invalid' })[0].field,
      'numbering'
    );
  }
  assert.throws(() =>
    LYRIC_TOOL_SCHEMAS.lyric_check.pronunciations.parse([{ ...pronunciations[0], numbering: 'v9' }])
  );
  assert.deepEqual(
    LYRIC_TOOL_SCHEMAS.lyric_check.pronunciations.parse(pronunciations),
    pronunciations
  );
});

test('chat options copy actual numbering and do not label unmarked held options', async () => {
  const { _agentInternals: AI } = await import('./gemini_agent.js');
  const option = { line: 'Oh--oh (oh) oh', token: 4, word: 'oh', dictionary_readings: [] };
  for (const numbering of ['v1', 'v1+voices', 'v2', 'v2+voices', undefined]) {
    const item = numbering ? { ...option, numbering } : option;
    const got = AI.loopFields({ pronunciation_options: { items: [item] } }).pronunciation_options
      .items[0];
    assert.equal(got.numbering, numbering);
    assert.equal(Object.hasOwn(got, 'numbering'), numbering !== undefined);
  }
});

test('normalization is independent of optional metadata capacity', async () => {
  const { CONNECTOR_DECLARATION_BYTES } = await import('./state_codec.js');
  const { _workerInternals } = await import('./lyric_tools.js');
  const original = declarationsOf({
    title: '',
    groups: '1.T3,2.end',
    numbering: 'v1',
    lexicon_supplement: 'none',
    pronunciations: [
      {
        line: 'Oh--oh my cat',
        token: 3,
        word: 'cat',
        phones: ['K', 'AE1', 'T'],
        basis: 'dictionary',
        source: 'test: chosen cat',
        numbering: 'v1',
      },
    ],
  });
  original.title = 'x'.repeat(
    CONNECTOR_DECLARATION_BYTES - Buffer.byteLength(JSON.stringify(original))
  );
  const candidate = {
    groups: '1.T4,2.end',
    numbering: 'v2',
    pronunciations: [{ ...original.pronunciations[0], token: 4, numbering: 'v2' }],
  };
  try {
    await _verdictInternals.restoreEquivalentNumbering(
      candidate,
      original,
      ['Oh--oh my cat', 'I carry a dog'],
      'v2'
    );
    assert.deepEqual(movedDeclarations(original, candidate), []);
    assert.deepEqual(candidate.pronunciations, original.pronunciations);
    assert.equal(candidate.groups, original.groups);
    const oldDraft = ['Oh--oh my cat', 'I carry a dog'];
    const rewritten = ['Oh my new cat', 'I carry a dog'];
    const parked = { status: 'parked', replay_draft: oldDraft, draft: oldDraft };
    const effective = _verdictInternals.numberingInputForRun(parked, { draft: rewritten });
    assert.equal(effective, rewritten);
    const moved = { groups: '1.T4,2.end', numbering: 'v2' };
    await _verdictInternals.restoreEquivalentNumbering(moved, original, effective, 'v2');
    assert(
      movedDeclarations(original, moved).some((d) => d.field === 'groups'),
      'old-draft equivalence must not silently change the rewritten draft binding'
    );
    assert.equal(
      _verdictInternals.numberingInputForRun(
        { ...parked, status: 'suspended' },
        { draft: rewritten }
      ),
      oldDraft
    );
  } finally {
    await _workerInternals.kill();
  }
});
