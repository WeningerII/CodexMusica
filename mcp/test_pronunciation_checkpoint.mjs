import test from 'node:test';
import assert from 'node:assert/strict';

test('cacheless kitchen checkpoint normalizes resends without another provider request', async () => {
  const { createServer } = await import('node:http');
  const { once } = await import('node:events');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const { buildServer } = await import('./tools.js');
  const { RUNS, _workerInternals } = await import('./lyric_tools.js');
  const { decodeState } = await import('./state_codec.js');
  let calls = 0;
  // REPINNED 2026-11-23: ~~'I watched the window like a diplomat'~~ — the
  // same-spelled-ending ban now cuts a word's spelling at the vowel its rhyme
  // starts on, a lighter last syllable included (bug hunt 2026-11-21, finding
  // 17), so 'cat' / 'diplomat' is one spelled ending. The first answer was
  // refused and the second was then accepted (before: the first accepted,
  // the second refused as fixing nothing), and this file still passed
  // (measured on both trees). 'matte' rhymes with 'cat' and spells the ending
  // its own way (measured: accepted, and the second refused as before).
  const proposals = [
    'I watched the window dry from gloss to matte',
    'The copper kettle cooled beside the door',
  ];
  const writer = createServer(async (req, res) => {
    for await (const _chunk of req) {
      /* local fixture only */
    }
    const text = proposals[calls++];
    assert(text, 'no extra fixture writer request is authorized');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8, totalTokenCount: 18 },
      })
    );
  });
  writer.listen(0, '127.0.0.1');
  await once(writer, 'listening');
  const env = {
    GEMINI_API_KEY: 'offline-numbering-fixture',
    LYRIC_PROPOSER_MODEL: 'gemini-3.5-flash-lite',
    LYRIC_PROPOSER_API_BASE: `http://127.0.0.1:${writer.address().port}`,
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  const server = buildServer({ kitchen: true });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'numbering-checkpoint', version: '1' }, { capabilities: {} });
  await client.connect(b);
  const call = (args) =>
    client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 120000 });
  const verdict = (result) => {
    assert(!result.isError, JSON.stringify(result));
    return result.content
      .map((b) => {
        try {
          return JSON.parse(b.text);
        } catch {
          return null;
        }
      })
      .find((v) => Number.isInteger(v?.exit_code));
  };
  const original = {
    draft: ['Oh--oh my cat', 'Dog', 'Sun', 'Tree'],
    groups: '1.T3,2.end;3.end,4.end',
    numbering: 'v1',
    relation: 'class:RHYME',
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
    writer: 'kitchen',
    attempts: 1,
    backtrack: 0,
    max_rounds: 1,
  };
  try {
    assert.equal(Object.hasOwn(original.pronunciations[0], 'numbering'), false);
    const first = verdict(await call(original));
    // The first answer is accepted and the second is not, so the checkpoint
    // holds a line the loop wrote beside the chosen reading of 'cat'. Without
    // this the file passed while both answers went the other way (see the
    // repin note on `proposals`).
    assert.deepEqual(first.final_draft, [
      original.draft[0],
      proposals[0],
      ...original.draft.slice(2),
    ]);
    assert.equal(first.pronunciations[0].token, 4);
    assert.equal(first.pronunciations[0].numbering, 'v2');
    assert.equal(calls, 2);
    assert(first.checkpoint, JSON.stringify(first));
    assert.deepEqual(
      decodeState(first.checkpoint).connector_declarations.pronunciations,
      original.pronunciations
    );
    RUNS.map.clear();
    await _workerInternals.kill();
    const normalized = {
      checkpoint: first.checkpoint,
      ...first.numbered_mandate,
      pronunciations: first.pronunciations,
    };
    const changedPhones = await call({
      ...normalized,
      pronunciations: [{ ...first.pronunciations[0], phones: ['K', 'AH1', 'T'] }],
    });
    assert.equal(changedPhones.isError, true);
    const changedOccurrence = await call({ ...normalized, numbering: 'v1' });
    assert.equal(changedOccurrence.isError, true);
    const resumed = verdict(await call(normalized));
    assert.deepEqual(resumed.final_draft, first.final_draft);
    assert.equal(resumed.proposer_calls, 0);
    assert.equal(calls, 2, 'completed checkpoint replay invokes no writer');
    assert.deepEqual(
      decodeState(resumed.checkpoint).connector_declarations.pronunciations,
      original.pronunciations
    );
  } finally {
    await client.close();
    await server.close();
    await _workerInternals.kill();
    await new Promise((resolve) => writer.close(resolve));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
