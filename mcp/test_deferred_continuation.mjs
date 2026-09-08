// Actual worker, staged lexicon and MCP handler; the caller supplies lyrics.
// No provider or model credentials are used.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { withExecutionContext } from './execution_context.js';
import { _workerInternals } from './lyric_tools.js';
import { encodeState, decodeState } from './state_codec.js';

const server = buildServer();
const client = new Client({ name: 'deferred-continuation', version: '1' }, { capabilities: {} });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
const call = (args) =>
  client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 120000 });
const verdict = (result) => {
  for (const part of result.content) {
    try {
      const v = JSON.parse(part.text);
      if (typeof v.exit_code === 'number') return v;
    } catch {
      /* human brief */
    }
  }
  assert.fail(JSON.stringify(result));
};
try {
  const input = ['Copper cat', 'Azure dog'];
  const proposed = [
    'I left the basket underneath the oak',
    'The copper kettle cooled beside the door',
  ];
  const first = verdict(
    await call({
      scheme: 'AA',
      relation: 'type:rime riche',
      draft: input,
      writer: 'interview',
      attempts: 1,
      backtrack: 0,
      max_rounds: 1,
    })
  );
  assert.equal(first.exit_code, 4);
  const state = decodeState(first.state);
  assert.deepEqual(state.input_draft, input);
  assert.equal(state.connector_declarations.relation, 'type:rime riche');
  assert.equal(state.pending.kind, 'propose', 'dependent rhyme partners are asked serially');
  const controller = new AbortController();
  const stopped = verdict(
    await withExecutionContext(
      {
        signal: controller.signal,
        onCheckpoint(record) {
          if (record.status === 'accepted' && !controller.signal.aborted) controller.abort();
        },
      },
      () => call({ state: first.state, answer: proposed[0] })
    )
  );
  assert.equal(stopped.status, 'interrupted');
  assert.equal(
    stopped.checkpoint,
    undefined,
    'interview journals never become kitchen checkpoints'
  );
  assert.ok(stopped.state);
  assert.deepEqual(stopped.final_draft, [proposed[0], input[1]]);
  assert.deepEqual(decodeState(stopped.state).accepted_lines, stopped.final_draft);
  const resumed = verdict(
    await call({ run_id: stopped.run_id, run_revision: stopped.run_revision })
  );
  assert.equal(resumed.exit_code, 4);
  assert.deepEqual(resumed.final_draft, [proposed[0], input[1]]);
  const finished = verdict(await call({ state: resumed.state, answer: proposed[1] }));
  assert.deepEqual(finished.final_draft, proposed);
  assert.deepEqual(finished.replay_draft, input);
  // Carry an otherwise valid journal near its decoded capacity. Retained
  // metadata cannot be discarded merely because it is expensive to transport.
  const nearLimit = decodeState(first.state);
  nearLimit.retained_metadata = 'x'.repeat(400 * 1024);
  const capacity = verdict(await call({ state: encodeState(nearLimit), answer: proposed[0] }));
  assert.equal(capacity.status, 'journal_capacity');
  assert.equal(capacity.new_run_required, true);
  assert.equal(capacity.resumable, false);
  assert.equal(capacity.certified, false);
  assert.deepEqual(capacity.final_draft, input, 'unconsumed answer cannot count as accepted');
  const artifact = decodeState(capacity.state);
  assert.equal(artifact.retained_metadata, nearLimit.retained_metadata);
  assert.equal(artifact.pending.answer, proposed[0], 'caller answer survives capacity stop');
  const refused = await call({ state: capacity.state });
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /JOURNAL_CAPACITY.*cannot resume/);
  console.log(
    'deferred continuation: exact accepted prefix, declaration carry and state-only restart passed'
  );
} finally {
  await Promise.allSettled([client.close(), server.close()]);
  await _workerInternals.kill();
}
