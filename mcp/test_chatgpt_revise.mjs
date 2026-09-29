// Session adapter tests that drive the REAL lyric harness: recover_only after
// a stopped revise, and lyric_types. Split from test_chatgpt.mjs so each file
// stays inside the runner's per-file budget (--test-timeout) on CI runners;
// the parked new song's continuation is in test_chatgpt_parked.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';

function storeFor(t) {
  const directory = mkdtempSync(join(tmpdir(), 'chatgpt-mcp-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, store: new JobStore(directory) };
}

async function connect(t, domain, sessions) {
  const server = await buildWorkflowServer({ domain, sessions });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'chatgpt-contract-test', version: '1' }, { capabilities: {} });
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}
async function connectShared(t, sessions) {
  const server = await buildWorkflowServer({ sessions, compatibility: true });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'shared-contract-test', version: '1' }, { capabilities: {} });
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}
const data = (result) => {
  assert(result.structuredContent, JSON.stringify(result));
  return result.structuredContent;
};
const call = (client, name, args) => client.callTool({ name, arguments: args });

test('lyric_types is a lookup: it answers at once and takes no session', async (t) => {
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    execute: () => assert.fail('a lookup queues no session work'),
  });
  for (const client of [await connect(t, 'lyrics', sessions), await connectShared(t, sessions)]) {
    const tool = (await client.listTools()).tools.find((x) => x.name === 'lyric_types');
    assert.equal(tool.inputSchema.properties.session_id, undefined);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.outputSchema, undefined);
    const result = await call(client, 'lyric_types', { word_a: 'cat', word_b: 'hat' });
    assert(!result.isError, JSON.stringify(result));
    assert.equal(result.structuredContent, undefined);
  }
  assert.equal(sessions.store.records.size, 0);
});

test('recover_only exports what a lyrics session holds, without an operation', async (t) => {
  const sessions = new WorkflowSessions({ store: storeFor(t).store });
  const client = await connect(t, 'lyrics', sessions);
  const begun = data(await call(client, 'begin_lyrics', { phase: 'edit' }));
  const nothing = await call(client, 'lyric_revise', {
    session_id: begun.session_id,
    recover_only: true,
  });
  assert.equal(nothing.isError, true);
  assert.match(nothing.content[0].text, /NOTHING_TO_RECOVER: .*accepted_draft/);
  const draft = ['Copper cat', 'Azure dog'];
  const queued = data(
    await call(client, 'lyric_revise', {
      session_id: begun.session_id,
      scheme: 'AA',
      relation: 'type:rime riche',
      draft,
      max_rounds: 1,
      attempts: 0,
      backtrack: 0,
    })
  );
  await sessions.wait(queued.operation_id);
  const stopped = data(await call(client, 'get_operation', { operation_id: queued.operation_id }));
  assert.equal(verdictOf(stopped.tool_result).exit_code, 3, JSON.stringify(stopped));
  // The stop's note is the session procedure, and no run capability leaks.
  assert.match(
    stopped.tool_result.content[0].text,
    /CONTINUE: no question is pending\. Rewrite the open line\(s\), then call lyric_revise with the latest session_id, the complete rewritten draft, the same declarations/
  );
  assert.doesNotMatch(JSON.stringify(stopped), /run_[a-f0-9]{64}|run_id/);
  const records = sessions.store.records.size;
  const exported = await call(client, 'lyric_revise', {
    session_id: stopped.session_id,
    recover_only: true,
  });
  assert(!exported.isError, JSON.stringify(exported));
  const artifact = JSON.parse(exported.content[0].text);
  assert.equal(artifact.status, 'recovered_artifact');
  assert.equal(artifact.resumable, false);
  assert(artifact.journal && typeof artifact.journal === 'object');
  // Nothing was recorded, and the session continues from the same id.
  assert.equal(sessions.store.records.size, records);
  assert.equal(data(exported).session_id, stopped.session_id);
  const mixed = await call(client, 'lyric_revise', {
    session_id: stopped.session_id,
    recover_only: true,
    draft: ['x'],
  });
  assert.equal(mixed.isError, true);
  assert.match(mixed.content[0].text, /send only session_id, recover_only/);
  const revise = (await client.listTools()).tools.find((x) => x.name === 'lyric_revise');
  assert.match(revise.inputSchema.properties.recover_only.description, /^With session_id: true/);
  assert.doesNotMatch(revise.inputSchema.properties.recover_only.description, /supplied state/);
});
