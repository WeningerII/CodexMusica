import test from 'node:test';
import assert from 'node:assert/strict';

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
        },
      ],
      writer: 'interview',
      attempts: 1,
      max_rounds: 1,
      backtrack: 0,
    };
    assert.equal(Object.hasOwn(start.pronunciations[0], 'numbering'), false);
    const firstRun = parsed(await client.call('lyric_revise', start));
    assert.equal(firstRun.exit_code, 4, JSON.stringify(firstRun));
    assert.equal(firstRun.pronunciations[0].token, 4);
    assert.equal(firstRun.pronunciations[0].numbering, 'v2');
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
      parsed(unsupportedAlias).exit_code,
      4,
      'unsealed equivalent coordinates are checked independently by Python'
    );
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

test('edit sessions accept returned numbering through the authoritative continuation check', async () => {
  const { WorkflowSessions, verdictOf } = await import('./workflow_sessions.js');
  const { JobStore } = await import('./job_store.js');
  const { _workerInternals } = await import('./lyric_tools.js');
  const { decodeState } = await import('./state_codec.js');
  const sessions = new WorkflowSessions({ store: new JobStore() });
  let id = sessions.open('lyrics', { phase: 'edit' }).session_id;
  const revise = async (args) => {
    const operation = sessions.submit(id, 'lyrics', 'lyric_revise', args);
    await sessions.wait(operation.operation_id);
    id = operation.operation_id;
    return sessions.store.get(id).response.body.result;
  };
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
      },
    ],
    writer: 'interview',
    attempts: 1,
    max_rounds: 1,
    backtrack: 0,
  };
  try {
    const first = verdictOf(await revise(start));
    assert.equal(first?.exit_code, 4);
    const normalized = {
      ...first.numbered_mandate,
      pronunciations: first.pronunciations,
    };
    const again = await revise(normalized);
    assert(!again.isError, JSON.stringify(again));
    const verdict = verdictOf(again);
    assert.equal(verdict.exit_code, 4);
    assert.equal(decodeState(verdict.state).connector_declarations.groups, start.groups);
    assert.deepEqual(
      decodeState(verdict.state).connector_declarations.pronunciations,
      start.pronunciations
    );
    for (const changed of [
      { ...normalized, numbering: 'v1' },
      { ...normalized, groups: start.groups },
      { ...normalized, groups: '1.T5,2.end' },
      {
        ...normalized,
        pronunciations: [{ ...first.pronunciations[0], phones: ['K', 'AH1', 'T'] }],
      },
      { ...normalized, draft: ['A different cat', 'I carry a dog'] },
    ]) {
      const refused = await revise(changed);
      assert.equal(refused.isError, true, JSON.stringify(refused));
    }
    // Failed resends retain the original pending run and its own arguments.
    const original = await revise({
      groups: start.groups,
      returns: start.returns,
      numbering: start.numbering,
      pronunciations: start.pronunciations,
    });
    assert(!original.isError, JSON.stringify(original));
    assert.equal(verdictOf(original).exit_code, 4);
  } finally {
    await _workerInternals.kill();
  }
});
