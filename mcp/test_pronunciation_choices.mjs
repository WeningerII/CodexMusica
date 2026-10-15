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

test('native client copies an actual voices option marker and ambiguous unmarked reuse refuses', async () => {
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { buildServer } = await import('./tools.js');
  const { connectConnector } = await import('./client.js');
  const { _workerInternals } = await import('./lyric_tools.js');
  const server = buildServer({ task: { domain: 'lyrics', phase: 'edit' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = await connectConnector({
    task: { domain: 'lyrics', phase: 'edit' },
    transport: b,
  });
  const input = {
    lines: ['Oh--oh (oh) read read zzqxqzz', 'I read read'],
    scheme: 'AA',
    voices: true,
  };
  const parsed = (r) => {
    assert(!r.isError, JSON.stringify(r));
    return r.content
      .filter((b) => b.type === 'text')
      .map((b) => {
        try {
          return JSON.parse(b.text);
        } catch {
          return null;
        }
      })
      .find((v) => Number.isInteger(v?.exit_code));
  };
  try {
    const first = parsed(await client.call('lyric_check', input));
    const option = first.pronunciation_options.items.find(
      (o) => o.line === input.lines[0] && o.token === 4
    );
    assert(option, JSON.stringify(first.pronunciation_options));
    assert.equal(option.numbering, 'v2+voices');
    const choice = {
      line: option.line,
      token: option.token,
      word: option.word,
      phones: option.dictionary_readings[0].phones,
      basis: 'dictionary',
      source: 'test: explicit reading from returned options',
      numbering: option.numbering,
    };
    const selected = parsed(
      await client.call('lyric_check', { ...input, pronunciations: [choice] })
    );
    assert.equal(selected.measurement_status, 'graded');
    assert.equal(selected.pronunciations[0].numbering, option.numbering);
    assert.equal(selected.pronunciations[0].token, option.token);
    const { numbering: _numbering, ...unmarked } = choice;
    const refused = await client.call('lyric_check', { ...input, pronunciations: [unmarked] });
    assert.match(JSON.stringify(refused), /numbering|ambiguous/i);
    const record = parsed(refused);
    assert.equal(record.measurement_status, 'refused');
    assert.equal(choice.numbering, 'v2+voices', 'client does not mutate the producer evidence');
    const legacy = {
      lines: ['Oh--oh my love', 'I wear a glove'],
      groups: '1.T3,2.end',
      numbering: 'v1',
      pronunciations: [
        {
          line: 'Oh--oh my love',
          token: 3,
          word: 'love',
          phones: ['L', 'AH1', 'V'],
          basis: 'dictionary',
          source: 'test: chosen love',
          numbering: 'v1',
        },
      ],
    };
    const migrated = parsed(await client.call('lyric_check', legacy));
    assert(migrated.pronunciations, JSON.stringify(migrated));
    assert.equal(migrated.pronunciations[0].token, 4);
    assert.equal(migrated.pronunciations[0].numbering, 'v2');
    assert.equal(migrated.numbered_mandate.groups, '1.T4,2.end');
    assert.equal(migrated.numbered_mandate.numbering, 'v2');
    assert(migrated.numbering_notices.some((n) => /3 -> 4/.test(n)));
    assert.match(migrated.report, /NUMBERING: token 3 -> 4/);
    const normalized = parsed(
      await client.call('lyric_check', {
        ...legacy,
        ...migrated.numbered_mandate,
        pronunciations: migrated.pronunciations,
      })
    );
    assert.deepEqual(normalized.pronunciations, migrated.pronunciations);
    assert.deepEqual(normalized.numbered_mandate, migrated.numbered_mandate);
    const start = {
      draft: ['Oh--oh my cat', 'I carry a dog'],
      groups: '1.T3,2.end',
      returns: '1.T3,2.T4',
      numbering: 'v1',
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
      writer: 'interview',
      attempts: 1,
      max_rounds: 1,
      backtrack: 0,
    };
    const firstRun = parsed(await client.call('lyric_revise', start));
    assert.equal(firstRun.exit_code, 4, JSON.stringify(firstRun));
    const nextArgs = {
      run_id: firstRun.run_id,
      run_revision: firstRun.run_revision,
      ...firstRun.numbered_mandate,
      pronunciations: firstRun.pronunciations,
    };
    const changedPhones = await client.call('lyric_revise', {
      ...nextArgs,
      pronunciations: [{ ...firstRun.pronunciations[0], phones: ['K', 'AH1', 'T'] }],
    });
    assert.equal(changedPhones.isError, true);
    assert.match(JSON.stringify(changedPhones), /pronunciations/);
    const mixedMarker = await client.call('lyric_revise', { ...nextArgs, numbering: 'v1' });
    assert.equal(
      mixedMarker.isError,
      true,
      'normalized positions with original marker are different'
    );
    const mixedPosition = await client.call('lyric_revise', { ...nextArgs, groups: start.groups });
    assert.equal(
      mixedPosition.isError,
      true,
      'original positions with normalized marker are different'
    );
    const changedMember = await client.call('lyric_revise', { ...nextArgs, groups: '1.T5,2.end' });
    assert.equal(changedMember.isError, true);
    assert.match(JSON.stringify(changedMember), /groups/);
    const originalAgain = parsed(
      await client.call('lyric_revise', {
        run_id: firstRun.run_id,
        run_revision: firstRun.run_revision,
        groups: start.groups,
        returns: start.returns,
        numbering: start.numbering,
        pronunciations: start.pronunciations,
      })
    );
    assert.equal(originalAgain.exit_code, 4);
    nextArgs.run_revision = originalAgain.run_revision;
    // A normalized resend is equivalent, but the state retains the original
    // source arguments so the existing worker identity is byte-for-byte stable.
    const again = parsed(await client.call('lyric_revise', nextArgs));
    assert.equal(again.exit_code, 4, JSON.stringify(again));
    const { RUNS } = await import('./lyric_tools.js');
    const { decodeState, encodeState } = await import('./state_codec.js');
    assert.deepEqual(
      decodeState(again.state).connector_declarations.pronunciations,
      start.pronunciations
    );
    assert.equal(decodeState(again.state).connector_declarations.groups, start.groups);
    RUNS.map.clear();
    await _workerInternals.kill();
    const unsealed = decodeState(again.state);
    delete unsealed.cursor_seal;
    const unsupportedAlias = await client.call('lyric_revise', {
      state: encodeState(unsealed),
      ...again.numbered_mandate,
      pronunciations: again.pronunciations,
    });
    assert.equal(
      unsupportedAlias.isError,
      true,
      'an unsigned alias never relaxes declaration identity'
    );
    assert.match(JSON.stringify(unsupportedAlias), /declarations moved/);
    const replay = parsed(
      await client.call('lyric_revise', {
        state: again.state,
        ...again.numbered_mandate,
        pronunciations: again.pronunciations,
      })
    );
    assert.equal(replay.exit_code, 4, JSON.stringify(replay));
    assert.deepEqual(
      decodeState(replay.state).connector_declarations.pronunciations,
      start.pronunciations
    );
  } finally {
    await client.close();
    await server.close();
    await _workerInternals.kill();
  }
});

test('optional normalized alias yields to the existing combined declaration allowance', async () => {
  const { CONNECTOR_DECLARATION_BYTES, assertContinuationCapacity, encodeState, decodeState } =
    await import('./state_codec.js');
  assert.equal(
    _verdictInternals.numberingAliasOf({ pronunciations: [] }, {}),
    undefined,
    'an absent declaration and an empty normalized list create no new legacy metadata'
  );
  const original = declarationsOf({ pronunciations, title: '' });
  original.title = 'x'.repeat(
    CONNECTOR_DECLARATION_BYTES - Buffer.byteLength(JSON.stringify(original))
  );
  assert.equal(Buffer.byteLength(JSON.stringify(original)), CONNECTOR_DECLARATION_BYTES);
  const normalized = pronunciations.map((p) => ({ ...p, numbering: 'v2' }));
  const alias = _verdictInternals.numberingAliasOf({ pronunciations: normalized }, original);
  assert.equal(alias, null, 'the optional alias cannot overfill original declaration metadata');
  const state = { answered: {}, connector_declarations: original };
  assertContinuationCapacity(state);
  const saved = decodeState(encodeState(state));
  const resend = structuredClone(original);
  _verdictInternals.restoreNumberingAlias(resend, saved.connector_declarations, alias);
  assert.deepEqual(movedDeclarations(saved.connector_declarations, resend), []);
  assert.deepEqual(saved.connector_declarations, original);
  const notice = 'Declaration receipt capacity: resend original declarations.';
  assert.equal(
    _verdictInternals.verdictOf({ code: 4, stdout: '', numbering_alias_unavailable: notice })
      .numbering_alias_unavailable,
    notice
  );
});
