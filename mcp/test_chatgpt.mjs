import { randomBytes } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions, SESSION_STORE_LIMITS, publicToolResult } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { startRecipe, editRecipe, renderRecipe } from './engine.js';
import { requestContext } from './execution_context.js';
import { continuationSemanticIdentity, decodeState } from './state_codec.js';
import { PaidLedger, createOperationBudget } from './paid_budget.js';

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
const value = (result) => JSON.parse(result.tool_result.content[0].text);
const call = (client, name, args) => client.callTool({ name, arguments: args });

test('recipe MCP carries exact workspaces through reconnects and all four formats', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new WorkflowSessions({ store });
  let client = await connect(t, 'recipe', sessions);
  const initial = data(await call(client, 'start_recipe', { traditions: ['delta_blues'] }));
  const original = startRecipe({ traditions: ['delta_blues'] });
  assert.equal(value(initial).recipe, original.recipe);
  assert(!('workspace' in value(initial)));
  await client.close();
  sessions = new WorkflowSessions({ store: new JobStore(directory) });
  client = await connect(t, 'recipe', sessions);
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  const edited = data(await call(client, 'edit_recipe', { session_id: initial.session_id, edits }));
  const expected = editRecipe({ workspace: original.workspace, edits });
  assert.equal(value(edited).recipe, expected.recipe);
  assert.deepEqual(value(edited).render_warnings, expected.render_warnings);
  let session_id = edited.session_id;
  for (const format of ['rich', 'tags', 'prose', 'compact']) {
    const result = data(await call(client, 'render_recipe', { session_id, format }));
    assert.equal(
      value(result).recipe,
      renderRecipe({ workspace: expected.workspace, format }).recipe
    );
    assert(value(result).recipe_chars <= 1000);
    session_id = result.session_id;
  }
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 11);
  for (const name of ['start_recipe', 'edit_recipe', 'render_recipe']) {
    const tool = tools.find((item) => item.name === name);
    assert(tool.outputSchema);
    assert(!tool.inputSchema.properties.workspace);
    assert.equal(tool.annotations.readOnlyHint, false);
  }
});

test('same parent and input dispatch once; stale input and cross-task capabilities refuse', async (t) => {
  const { store } = storeFor(t);
  let dispatches = 0,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const sessions = new WorkflowSessions({
    store,
    execute: async (session) => {
      dispatches++;
      await gate;
      return { session, result: { content: [{ type: 'text', text: 'done' }] } };
    },
  });
  const opened = sessions.open('recipe');
  const a = sessions.submit(opened.session_id, 'recipe', 'start_recipe', {
    traditions: ['delta_blues'],
  });
  const b = sessions.submit(opened.session_id, 'recipe', 'start_recipe', {
    traditions: ['delta_blues'],
  });
  assert.equal(a.operation_id, b.operation_id);
  assert.equal(a.status, 'pending');
  assert.throws(
    () =>
      sessions.submit(opened.session_id, 'recipe', 'start_recipe', { traditions: ['afrobeat'] }),
    /STALE_SESSION/
  );
  assert.throws(() => sessions.status(a.operation_id, 'lyrics'), /SESSION_SCOPE/);
  release();
  await sessions.wait(a.operation_id);
  assert.equal(dispatches, 1);
  assert.equal(sessions.status(a.operation_id, 'recipe').status, 'completed');
  assert.equal(
    sessions.submit(opened.session_id, 'recipe', 'start_recipe', { traditions: ['delta_blues'] })
      .operation_id,
    a.operation_id
  );
});

test('recipe operation interrupted after durable admission resumes once through MCP', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new WorkflowSessions({ store });
  let client = await connect(t, null, sessions);
  const initial = data(await call(client, 'start_recipe', { traditions: ['delta_blues'] }));
  const parent = store.get(initial.session_id);
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  // A receipt written before dispatch is the durable state left by a crash.
  const operation_id = 'e'.repeat(64);
  store.begin(
    operation_id,
    {
      request_id: operation_id,
      continuation_id: initial.session_id,
      integration: parent.intent.integration,
      action: { tool: 'edit_recipe', arguments: { edits }, resumed: false },
    },
    {},
    { session: parent.response.body.session }
  );
  await client.close();
  sessions = new WorkflowSessions({ store: new JobStore(directory) });
  client = await connect(t, null, sessions);
  const interrupted = data(await call(client, 'get_operation', { operation_id }));
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(interrupted.resumable, true);
  const resumed = data(await call(client, 'resume_operation', { operation_id }));
  const expected = editRecipe({
    workspace: startRecipe({ traditions: ['delta_blues'] }).workspace,
    edits,
  });
  assert.equal(value(resumed).recipe, expected.recipe);
  assert.equal(
    data(await call(client, 'resume_operation', { operation_id })).operation_id,
    resumed.operation_id
  );
});

test('lyrics run independently of the submitting MCP connection', async (t) => {
  const { store } = storeFor(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const sessions = new WorkflowSessions({
    store,
    execute: async (session) => {
      await gate;
      assert.equal(requestContext().signal.aborted, false);
      assert(requestContext().budget);
      return { session, result: { content: [{ type: 'text', text: 'exact result' }] } };
    },
  });
  const client = await connect(t, 'lyrics', sessions);
  const initial = data(await call(client, 'begin_lyrics', {}));
  // The caller writes every line: no outside session names the service writer.
  assert.equal(store.get(initial.session_id).response.body.session.writer, 'interview');
  const queued = data(
    await call(client, 'lyric_sweep', { session_id: initial.session_id, seed_from: 31, count: 1 })
  );
  assert.equal(queued.status, 'pending');
  await client.close();
  release();
  await sessions.wait(queued.operation_id);
  const reconnected = await connect(t, 'lyrics', sessions);
  const completed = data(
    await call(reconnected, 'get_operation', { operation_id: queued.operation_id })
  );
  assert.equal(completed.status, 'completed');
  assert.equal(completed.tool_result.content[0].text, 'exact result');
});

test('creation receipts cannot be fabricated through MCP input or skipped', async (t) => {
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({ store });
  const client = await connect(t, 'lyrics', sessions);
  const initial = data(await call(client, 'begin_lyrics', {}));
  // A forged receipt argument is not part of any schema: it is dropped before
  // the tool sees it, and the creation order still refuses the plan.
  const forged = data(
    await call(client, 'lyric_plan', {
      session_id: initial.session_id,
      seed: 31,
      workflow: { completedSteps: ['sweep', 'screen'] },
    })
  );
  await sessions.wait(forged.operation_id);
  const refusedForged = sessions.status(forged.operation_id, 'lyrics');
  assert.equal(refusedForged.tool_result.isError, true);
  assert.match(refusedForged.tool_result.content[0].text, /CREATION_ORDER/);
  assert.equal(
    store.get(forged.operation_id).response.body.session.native.task.workflow?.plan,
    undefined
  );
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 12);
  const revise = tools.find((tool) => tool.name === 'lyric_revise');
  for (const field of ['state', 'checkpoint', 'run_id', 'run_revision', 'writer', 'workspace'])
    assert(!revise.inputSchema.properties[field]);
  assert.equal(revise.annotations.readOnlyHint, false);
  // No outside surface calls a model provider: the caller writes every line.
  assert.equal(revise.annotations.openWorldHint, false);
  const begin = tools.find((tool) => tool.name === 'begin_lyrics');
  assert.deepEqual(Object.keys(begin.inputSchema.properties), ['phase']);
  assert.doesNotMatch(begin.description, /kitchen|Gemini/i);
});

test('restart marks admitted work interrupted and never automatically executes it', async (t) => {
  const { store, directory } = storeFor(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const sessions = new WorkflowSessions({
    store,
    execute: async (session) => {
      await gate;
      return { session, result: { content: [] } };
    },
  });
  const opened = sessions.open('lyrics');
  const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
  // A fresh process sees the durable intent before any worker response.
  const recovered = new WorkflowSessions({
    store: new JobStore(directory),
    execute: () => assert.fail('automatic replay'),
  });
  const r = recovered.status(q.operation_id, 'lyrics');
  assert.equal(r.status, 'interrupted');
  assert.equal(r.resumable, false);
  assert.throws(() => recovered.resume(q.operation_id, 'lyrics'), /CONTINUATION_UNCERTAIN/);
  release();
  await sessions.wait(q.operation_id);
});

function checkpoint(overrides = {}) {
  return {
    version: 1,
    status: 'accepted',
    input_draft: ['original'],
    accepted_lines: ['accepted'],
    answered: { propose: [], propose_group: [] },
    connector_declarations: { seed: 31, writer: 'interview' },
    connector_semantic_identity: continuationSemanticIdentity(),
    ...overrides,
  };
}

test('safe resume carries original replay input and accepted journal, and deduplicates', async (t) => {
  const { store } = storeFor(t);
  let executions = 0;
  const sessions = new WorkflowSessions({
    store,
    execute: async (session) => {
      executions++;
      if (executions === 1) {
        requestContext().onCheckpoint(checkpoint());
        throw new Error('lost result');
      }
      const args = session.native.continuation.args;
      assert.deepEqual(args.draft, ['original']);
      const decoded = decodeState(args.state);
      assert.deepEqual(decoded.accepted_lines, ['accepted']);
      return { session, result: { content: [{ type: 'text', text: 'resumed' }] } };
    },
  });
  const initial = sessions.open('lyrics');
  const q = sessions.submit(initial.session_id, 'lyrics', 'lyric_revise', { seed: 31 });
  await sessions.wait(q.operation_id);
  const interrupted = sessions.status(q.operation_id, 'lyrics');
  assert.equal(interrupted.resumable, true);
  assert.deepEqual(interrupted.accepted_draft, ['accepted']);
  const resumed = sessions.resume(q.operation_id, 'lyrics');
  assert.equal(sessions.resume(q.operation_id, 'lyrics').operation_id, resumed.operation_id);
  await sessions.wait(resumed.operation_id);
  assert.equal(executions, 2);
  assert.equal(
    sessions.status(resumed.operation_id, 'lyrics').tool_result.content[0].text,
    'resumed'
  );
});

// The shared /mcp endpoint serves both families, so its server has no domain of
// its own: resume_operation must take the domain from the operation's session.
// (Found by the 2026-09-27 re-audit: every lyric resume over /mcp was refused
// SESSION_SCOPE, and the tests above only resumed through the session API.)
test('resume_operation continues an interrupted lyric operation over the shared endpoint', async (t) => {
  const { store } = storeFor(t);
  let executions = 0;
  const sessions = new WorkflowSessions({
    store,
    execute: async (session) => {
      executions++;
      if (executions === 1) {
        requestContext().onCheckpoint(checkpoint());
        throw new Error('lost result');
      }
      assert.deepEqual(decodeState(session.native.continuation.args.state).accepted_lines, [
        'accepted',
      ]);
      return { session, result: { content: [{ type: 'text', text: 'resumed over /mcp' }] } };
    },
  });
  for (const client of [await connectShared(t, sessions), await connect(t, null, sessions)]) {
    executions = 0;
    const opened = sessions.open('lyrics');
    const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', { seed: 31 });
    await sessions.wait(q.operation_id);
    const read = data(await call(client, 'get_operation', { operation_id: q.operation_id }));
    assert.equal(read.status, 'interrupted');
    assert.equal(read.resumable, true);
    const resumed = data(await call(client, 'resume_operation', { operation_id: q.operation_id }));
    assert.equal(resumed.tool, 'lyric_revise');
    await sessions.wait(resumed.operation_id);
    const done = await call(client, 'get_operation', { operation_id: resumed.operation_id });
    assert.equal(data(done).status, 'completed');
    assert.equal(done.content[0].text, 'resumed over /mcp');
    assert.equal(executions, 2);
  }
});

test('unknown provider outcome blocks resume while retaining accepted lyrics', async (t) => {
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({
    store,
    execute: async () => {
      requestContext().onCheckpoint(checkpoint({ status: 'proposing' }));
      requestContext().onProposerUsage({ in_flight: true });
      throw new Error('connection lost after provider admission');
    },
  });
  const first = sessions.open('lyrics');
  const q = sessions.submit(first.session_id, 'lyrics', 'lyric_revise', {});
  await sessions.wait(q.operation_id);
  const r = sessions.status(q.operation_id, 'lyrics');
  assert.equal(r.uncertain_proposal, true);
  assert.equal(r.resumable, false);
  assert.deepEqual(r.accepted_draft, ['accepted']);
  assert.throws(() => sessions.resume(q.operation_id, 'lyrics'), /CONTINUATION_UNCERTAIN/);
});

test('a second interruption exports inherited accepted lyrics without authorizing replay', async (t) => {
  for (const providerStarted of [false, true]) {
    const { store, directory } = storeFor(t);
    const accepted = ['I kept the café open.', '', 'You’d left your coat behind.'];
    let executions = 0;
    const sessions = new WorkflowSessions({
      store,
      execute: async () => {
        executions++;
        if (executions === 1)
          requestContext().onCheckpoint(checkpoint({ accepted_lines: accepted }));
        else if (providerStarted) requestContext().onProposerUsage({ in_flight: true });
        throw new Error('connection lost before the next checkpoint');
      },
    });
    const initial = sessions.open('lyrics');
    const first = sessions.submit(initial.session_id, 'lyrics', 'lyric_revise', {});
    await sessions.wait(first.operation_id);
    const second = sessions.resume(first.operation_id, 'lyrics');
    await sessions.wait(second.operation_id);
    const recovered = new WorkflowSessions({
      store: new JobStore(directory),
      execute: () => assert.fail('recovery must not dispatch'),
    });
    const client = await connect(t, null, recovered);
    const result = data(await call(client, 'get_operation', { operation_id: second.operation_id }));
    assert.equal(result.status, 'interrupted');
    assert.deepEqual(result.accepted_draft, accepted);
    assert.equal(result.resumable, false);
    assert.equal(result.uncertain_proposal, providerStarted);
    assert.equal(recovered.store.get(second.operation_id).progress, null);
    assert.throws(() => recovered.resume(second.operation_id, 'lyrics'), /CONTINUATION_UNCERTAIN/);
    assert.equal(executions, 2);
  }
});

test('inherited accepted lyrics survive payload pressure until their own receipt expires', async (t) => {
  const { directory } = storeFor(t);
  let now = 1000;
  const store = new JobStore(directory, { maxPayloadRecords: 4, ttlMs: 100, now: () => now });
  let executions = 0;
  const sessions = new WorkflowSessions({
    store,
    execute: async () => {
      if (++executions === 1) requestContext().onCheckpoint(checkpoint());
      throw new Error('response lost');
    },
  });
  const initial = sessions.open('lyrics');
  const first = sessions.submit(initial.session_id, 'lyrics', 'lyric_revise', {});
  await sessions.wait(first.operation_id);
  now = 1050;
  const second = sessions.resume(first.operation_id, 'lyrics');
  await sessions.wait(second.operation_id);
  now = 1101; // The earlier receipt expires; this operation is the only remaining copy.
  for (let i = 0; i < 12; i++) sessions.open('recipe');
  assert.equal(store.get(first.operation_id), null);
  for (let i = 1; i <= 3; i++) {
    const request_id = i.toString(16).padStart(64, '0');
    store.begin(request_id, { request_id });
  }
  const request_id = '4'.padStart(64, '0');
  assert.throws(() => store.begin(request_id, { request_id }), { code: 'JOB_CAPACITY' });
  assert.equal(store.get(second.operation_id).state, 'interrupted');
  assert.deepEqual(sessions.status(second.operation_id, 'lyrics').accepted_draft, ['accepted']);
  now = 1151;
  assert.equal(store.get(second.operation_id), null);
  assert.equal(executions, 2);
});

test('fresh progress supersedes the inherited draft and retains its own replay decision', async (t) => {
  for (const accepted_lines of [['newly accepted'], []]) {
    const { store } = storeFor(t);
    let executions = 0;
    const sessions = new WorkflowSessions({
      store,
      execute: async () => {
        requestContext().onCheckpoint(
          ++executions === 1 ? checkpoint() : checkpoint({ accepted_lines, status: 'proposing' })
        );
        throw new Error('response lost');
      },
    });
    const initial = sessions.open('lyrics');
    const first = sessions.submit(initial.session_id, 'lyrics', 'lyric_revise', {});
    await sessions.wait(first.operation_id);
    const second = sessions.resume(first.operation_id, 'lyrics');
    await sessions.wait(second.operation_id);
    const result = sessions.status(second.operation_id, 'lyrics');
    assert.deepEqual(result.accepted_draft, accepted_lines);
    assert.equal(result.uncertain_proposal, true);
    assert.equal(result.resumable, false);
    assert.throws(() => sessions.resume(second.operation_id, 'lyrics'), /CONTINUATION_UNCERTAIN/);
  }
});

test('private result envelopes are hidden without changing the song or verdict', () => {
  const song = '[VERSE]\nThe kettle whistles by the stove';
  const raw = {
    content: [
      { type: 'text', text: song },
      {
        type: 'text',
        text: JSON.stringify({
          exit_code: 2,
          certified: false,
          workspace: { private: true },
          state: 'secret',
          checkpoint: 'secret2',
          final_draft: ['The kettle whistles by the stove'],
        }),
      },
    ],
  };
  const result = publicToolResult(raw);
  assert.equal(result.content[0].text, song);
  const verdict = JSON.parse(result.content[1].text);
  assert.equal(verdict.certified, false);
  assert.equal(verdict.exit_code, 2);
  for (const field of ['state', 'workspace', 'checkpoint']) assert(!(field in verdict));
});

test('outside lyric sessions never hand revision to the service writer', async (t) => {
  // Owner's rule (2026-09-27): the service's Gemini writer runs only where
  // Gemini writes the whole song — the website chat. A lyrics session opens on
  // any store, names the caller as its writer, and ignores a writer argument.
  const sessions = new WorkflowSessions({ store: new JobStore() });
  const opened = sessions.open('lyrics', { writer: 'kitchen' });
  assert.equal(opened.status, 'completed');
  assert.equal(sessions.record(opened.session_id, 'lyrics').session.writer, 'interview');
  assert.equal(sessions.open('recipe').durable, false);
  // A session recorded before the rule named the service writer; it cannot revise.
  const { store } = storeFor(t);
  const legacy = new WorkflowSessions({ store });
  const session = legacy.record(legacy.open('lyrics').session_id, 'lyrics').session;
  session.writer = 'kitchen';
  const oldId = randomBytes(32).toString('hex');
  const body = { request_id: oldId, integration: 'chatgpt-v1', action: 'open' };
  store.begin(oldId, body, {}, { session });
  store.complete(oldId, 200, { session, result: { content: [] } });
  const q = legacy.submit(oldId, 'lyrics', 'lyric_revise', { seed: 31, draft: ['x'] });
  await legacy.wait(q.operation_id);
  const refused = legacy.status(q.operation_id, 'lyrics');
  assert.equal(refused.tool_result.isError, true);
  assert.match(refused.tool_result.content[0].text, /SESSION_WRITER_RETIRED/);
});

test('unsettled operation budget blocks replay even without a proposer usage callback', async (t) => {
  const { store } = storeFor(t);
  const ledger = new PaidLedger({ pricing: () => ({ input: 1, output: 1 }) });
  for (const interrupted of [false, true]) {
    const sessions = new WorkflowSessions({
      store,
      createBudget: (options) => createOperationBudget({ ...options, ledger }),
      execute: async (session) => {
        requestContext().onCheckpoint(checkpoint());
        requestContext().budget.reserve({
          model: 'fixture',
          inputBytes: 100,
          maxOutputTokens: 100,
        });
        if (interrupted) throw new Error('lost usage and response');
        return { session, result: { content: [] } };
      },
    });
    const opened = sessions.open('lyrics');
    const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    assert.equal(r.status, interrupted ? 'interrupted' : 'completed');
    assert.equal(r.uncertain_proposal, true);
    assert.equal(r.resumable, false);
    assert.throws(
      () =>
        interrupted
          ? sessions.resume(q.operation_id, 'lyrics')
          : sessions.submit(q.operation_id, 'lyrics', 'lyric_revise', {}),
      /CONTINUATION_UNCERTAIN/
    );
  }
  assert(ledger.snapshot().unknownUsd > 0);
  assert.equal(ledger.snapshot().reservedUsd, 0);
});

test('failed completion preserves accepted lyrics and closes recovery admission', async (t) => {
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({
    store,
    execute: async () => {
      requestContext().onCheckpoint(checkpoint());
      store.complete = () => {
        throw new Error('disk unavailable');
      };
      store.interrupt = () => {
        throw new Error('disk unavailable');
      };
      throw new Error('response lost');
    },
  });
  const opened = sessions.open('lyrics');
  const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
  await sessions.wait(q.operation_id);
  const r = sessions.status(q.operation_id, 'lyrics');
  assert.equal(r.status, 'interrupted');
  assert.deepEqual(r.accepted_draft, ['accepted']);
  assert.equal(r.resumable, false);
  assert.throws(() => sessions.resume(q.operation_id, 'lyrics'), /disk unavailable|Recovery store/);
});

test('an accounting settlement failure marks the operation uncertain without latching the store', async (t) => {
  const { store } = storeFor(t);
  const unwritableLedger = () => ({
    reserve() {},
    settle() {},
    snapshot: () => ({ usd: 0, reservedUsd: 0, unknownUsd: 0, maxUsd: 1, events: [] }),
    close() {
      throw Object.assign(new Error('ACCOUNTING_UNAVAILABLE: ledger unwritable'), {
        code: 'ACCOUNTING_UNAVAILABLE',
      });
    },
  });
  for (const interrupted of [false, true]) {
    const sessions = new WorkflowSessions({
      store,
      createBudget: unwritableLedger,
      execute: async (session) => {
        requestContext().onCheckpoint(checkpoint());
        if (interrupted) throw new Error('response lost');
        return { session, result: { content: [{ type: 'text', text: '{"exit_code":0}' }] } };
      },
    });
    const opened = sessions.open('lyrics');
    const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    assert.equal(r.status, interrupted ? 'interrupted' : 'completed');
    assert.equal(r.uncertain_proposal, true);
    assert.equal(r.resumable, false);
    // A finished result is kept, not discarded with the settlement.
    if (!interrupted) assert.deepEqual(value(r), { exit_code: 0 });
    else assert.deepEqual(r.accepted_draft, ['accepted']);
    assert.throws(
      () =>
        interrupted
          ? sessions.resume(q.operation_id, 'lyrics')
          : sessions.submit(q.operation_id, 'lyrics', 'lyric_revise', {}),
      /CONTINUATION_UNCERTAIN/
    );
    // The fault was the ledger's, not the receipt store's: other sessions go on.
    assert.equal(store.failure, null);
    assert.equal(sessions.open('lyrics').status, 'completed');
  }
});

test('a store that cannot record its own capacity refusal latches instead of rejecting the operation', async (t) => {
  const { store } = storeFor(t);
  const capacity = () => {
    throw Object.assign(new Error('capacity again'), { code: 'JOB_CAPACITY', status: 503 });
  };
  const sessions = new WorkflowSessions({
    store,
    execute: async () => {
      requestContext().onCheckpoint(checkpoint());
      store.complete = capacity;
      store.interrupt = capacity;
      throw new Error('response lost');
    },
  });
  const opened = sessions.open('lyrics');
  const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
  // Nobody awaits a lyric operation in production; a rejection here would be
  // an unhandled one and would end the process.
  await sessions.wait(q.operation_id);
  const r = sessions.status(q.operation_id, 'lyrics');
  assert.equal(r.status, 'interrupted');
  assert.deepEqual(r.accepted_draft, ['accepted']);
  assert.equal(r.resumable, false);
  assert.match(String(store.failure), /capacity again/);
});

test('cheap unrelated sessions cannot retire an interrupted operation holding accepted lyrics', async (t) => {
  const { directory } = storeFor(t);
  const store = new JobStore(directory, { maxPayloadRecords: 8 });
  const sessions = new WorkflowSessions({
    store,
    execute: async (session, name) => {
      if (name === 'lyric_revise') {
        requestContext().onCheckpoint(checkpoint());
        throw new Error('response lost');
      }
      return { session, result: { content: [{ type: 'text', text: '{}' }] } };
    },
  });
  const opened = sessions.open('lyrics');
  const held = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
  await sessions.wait(held.operation_id);
  assert.equal(sessions.status(held.operation_id, 'lyrics').status, 'interrupted');
  // Three times the payload cap in recipe sessions, each two receipts.
  for (let i = 0; i < 12; i++) {
    const recipe = sessions.open('recipe');
    const op = sessions.submit(recipe.session_id, 'recipe', 'start_recipe', { tradition: 'x' });
    await sessions.wait(op.operation_id);
  }
  const r = sessions.status(held.operation_id, 'lyrics');
  assert.equal(r.status, 'interrupted');
  assert.deepEqual(r.accepted_draft, ['accepted']);
  assert.equal(r.resumable, true);
  // Its superseded parent was the cheapest loss and went first.
  assert.equal(store.get(opened.session_id).state, 'retired');
});

test('one connection exposes both workflows, preserving independent sessions across reconnects', async (t) => {
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({ store });
  let client = await connect(t, null, sessions);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 21);
  assert.equal(new Set(tools.map((tool) => tool.name)).size, 21);
  // The session paragraph says what a session replaces; the raw engine's own
  // guidance (fences, ids, intent->edit map, presentation, bans, pasted-lyrics
  // order, FLAGS vs NOTES) follows it verbatim instead of a shorter third copy.
  const { expectedSurface } = await import('./surface_contract.js');
  const rawGuide = (await expectedSurface(null)).init.instructions;
  assert.match(client.getInstructions(), /^Codex Musica serves recording recipes and lyrics/);
  assert.match(client.getInstructions(), /SESSIONS\. start_recipe and begin_lyrics/);
  assert(client.getInstructions().endsWith('\n' + rawGuide));
  for (const phrase of [
    /NO coherence fences/,
    /never guess ids/,
    // ~~/UNSKIPPABLE/~~ — the ban is report-only since 2026-10-04 (owner's ruling).
    /reported as notes: they hold no/,
    /lyric_recover FIRST/,
  ])
    assert.match(client.getInstructions(), phrase);
  const recipe = data(await call(client, 'start_recipe', { traditions: ['delta_blues'] }));
  const lyrics = data(await call(client, 'begin_lyrics', {}));
  const wrong = await call(client, 'render_recipe', { session_id: lyrics.session_id });
  assert.equal(wrong.isError, true);
  const wrongLyrics = await call(client, 'lyric_sweep', {
    session_id: recipe.session_id,
    seed_from: 31,
    count: 1,
    lines: 12,
  });
  assert.equal(wrongLyrics.isError, true);
  await client.close();
  client = await connect(t, null, sessions);
  for (const session of [recipe, lyrics]) {
    const saved = data(await call(client, 'get_operation', { operation_id: session.operation_id }));
    assert.equal(saved.session_id, session.session_id);
  }
  const rendered = data(
    await call(client, 'render_recipe', { session_id: recipe.session_id, format: 'prose' })
  );
  assert.equal(
    value(rendered).recipe,
    renderRecipe({
      workspace: startRecipe({ traditions: ['delta_blues'] }).workspace,
      format: 'prose',
    }).recipe
  );
  const scoped = await connect(t, 'recipe', sessions);
  assert.equal(
    (await call(scoped, 'get_operation', { operation_id: lyrics.operation_id })).isError,
    true
  );
});

test('shared surface preserves raw consumers and carries text-only session capabilities', async (t) => {
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({ store });
  const server = await buildWorkflowServer({ sessions, compatibility: true });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'shared-client', version: '1' });
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  assert.equal((await client.listTools()).tools.length, 21);
  const initial = await call(client, 'start_recipe', { traditions: ['delta_blues'] });
  const raw = JSON.parse(initial.content[0].text);
  assert(raw.workspace);
  assert.equal(raw.session_id, initial.structuredContent.session_id);
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  const legacy = JSON.parse(
    (await call(client, 'edit_recipe', { workspace: raw.workspace, edits })).content[0].text
  );
  const saved = await call(client, 'edit_recipe', { session_id: raw.session_id, edits });
  // The tool's own output leads, unchanged and escaped once; the receipt is the
  // last block. (This used to be one envelope with the recipe JSON-escaped
  // inside tool_result, which no host could reproduce character for character.)
  assert.equal(JSON.parse(saved.content[0].text).recipe, legacy.recipe);
  assert.equal(saved.content[0].text, saved.structuredContent.tool_result.content[0].text);
  const envelope = JSON.parse(saved.content.at(-1).text);
  assert.equal(envelope.session_id, saved.structuredContent.session_id);
  assert.equal(envelope.tool_result, undefined);
  assert.equal(value(saved.structuredContent).recipe, legacy.recipe);
  assert(!saved.isError);
  const mixed = await call(client, 'edit_recipe', {
    session_id: envelope.session_id,
    workspace: legacy.workspace,
    edits,
  });
  assert(mixed.isError);
  const moved = data(
    await call(client, 'edit_recipe', {
      session_id: envelope.session_id,
      edits: [{ action: 'move_instrument', card: 'harmonica' }],
    })
  );
  const expected = editRecipe({
    workspace: legacy.workspace,
    edits: [{ action: 'move_instrument', card: 'harmonica' }],
  });
  const rendered = data(
    await call(client, 'render_recipe', { session_id: moved.session_id, format: 'compact' })
  );
  assert.equal(
    value(rendered).recipe,
    renderRecipe({ workspace: expected.workspace, format: 'compact' }).recipe
  );
  const retried = data(await call(client, 'edit_recipe', { session_id: raw.session_id, edits }));
  assert.equal(retried.operation_id, envelope.operation_id);
  const legacyLyrics = await call(client, 'lyric_types', { word_a: 'cat', word_b: 'hat' });
  assert(!legacyLyrics.isError, JSON.stringify(legacyLyrics));
  assert.equal(legacyLyrics.structuredContent, undefined);
  const missing = await call(client, 'render_recipe', {});
  assert(missing.isError);
});

// ── The session layer's own contract ────────────────────────────────────────

const lyricResult = (text, extra = {}) => ({
  content: [
    { type: 'text', text },
    { type: 'text', text: JSON.stringify({ exit_code: 0, ...extra }) },
  ],
});

test('a completed operation leads with the tool’s own blocks; reading a refused call is not an error', async (t) => {
  const song = '[VERSE — 1 line]\nA line with "quotes" and a \\ backslash';
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async (session, name) => {
      if (name === 'lyric_screen') throw new Error('CREATION_ORDER: refused for this test.');
      return { session, result: lyricResult(song) };
    },
  });
  const client = await connect(t, 'lyrics', sessions);
  const begun = data(await call(client, 'begin_lyrics', {}));
  const queued = await call(client, 'lyric_plan', { session_id: begun.session_id, seed: 1 });
  // A submission carries only its receipt.
  assert.equal(queued.content.length, 1);
  assert.equal(JSON.parse(queued.content[0].text).status, 'pending');
  await sessions.wait(data(queued).operation_id);
  const done = await call(client, 'get_operation', { operation_id: data(queued).operation_id });
  // The deliverable is the first block, exactly as the tool wrote it — not a
  // JSON-escaped string inside an envelope.
  assert.equal(done.content[0].text, song);
  assert.equal(done.content[1].text, '{"exit_code":0}');
  const tail = JSON.parse(done.content[2].text);
  assert.equal(done.content.length, 3);
  assert.equal(tail.status, 'completed');
  assert.equal(tail.session_id, data(done).session_id);
  assert.equal(tail.tool_result, undefined);
  assert.deepEqual(data(done).tool_result.content, done.content.slice(0, 2));
  // A refused tool call is a successful read of a failed operation.
  const refused = data(
    await call(client, 'lyric_screen', { session_id: tail.session_id, words: ['a', 'b'] })
  );
  await sessions.wait(refused.operation_id);
  const read = await call(client, 'get_operation', { operation_id: refused.operation_id });
  assert.equal(read.isError, undefined);
  assert.equal(data(read).tool_error, true);
  assert.match(read.content[0].text, /CREATION_ORDER/);
  // Its session is the one from before the refused call, and it continues.
  assert.equal(data(read).session_id, refused.operation_id);
});

test('a failed recipe call reports its error, and a failed start opens nothing to continue', async (t) => {
  const sessions = new WorkflowSessions({ store: storeFor(t).store });
  const client = await connect(t, 'recipe', sessions);
  const failed = await call(client, 'start_recipe', { traditions: ['no_such_tradition'] });
  assert.equal(failed.isError, true);
  assert.equal(failed.structuredContent.session_id, undefined);
  assert.equal(failed.structuredContent.status, 'completed');
  const started = data(await call(client, 'start_recipe', { traditions: ['delta_blues'] }));
  const bad = await call(client, 'edit_recipe', {
    session_id: started.session_id,
    edits: [{ action: 'set_preface', card: 'voice', preface: 'no_such_preface' }],
  });
  assert.equal(bad.isError, true);
  // The refused edit left the workspace as it was, and its session_id continues it.
  const after = data(
    await call(client, 'render_recipe', { session_id: bad.structuredContent.session_id })
  );
  assert.equal(value(after).recipe, startRecipe({ traditions: ['delta_blues'] }).recipe);
});

test('an omitted recipe format means rich on every call, not the last format used', async (t) => {
  const client = await connect(t, 'recipe', new WorkflowSessions({ store: storeFor(t).store }));
  const traditions = ['delta_blues'];
  const workspace = startRecipe({ traditions }).workspace;
  const tags = data(await call(client, 'start_recipe', { traditions, format: 'tags' }));
  assert.equal(value(tags).recipe, renderRecipe({ workspace, format: 'tags' }).recipe);
  const plain = data(await call(client, 'render_recipe', { session_id: tags.session_id }));
  assert.equal(value(plain).recipe, renderRecipe({ workspace, format: 'rich' }).recipe);
  const compact = data(
    await call(client, 'render_recipe', { session_id: plain.session_id, format: 'compact' })
  );
  assert.equal(value(compact).recipe, renderRecipe({ workspace, format: 'compact' }).recipe);
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  const edited = data(await call(client, 'edit_recipe', { session_id: compact.session_id, edits }));
  assert.equal(value(edited).recipe, editRecipe({ workspace, edits }).recipe);
});

test('an uncertain revision blocks only its own replay; free work and a new run go on', async (t) => {
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async (session, name, args) =>
      name === 'lyric_revise' && !args.new_run
        ? { session: { ...session, uncertain: true }, result: lyricResult('stopped') }
        : { session, result: lyricResult(name) },
  });
  const opened = sessions.open('lyrics');
  const first = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', { seed: 31 });
  await sessions.wait(first.operation_id);
  const read = sessions.status(first.operation_id, 'lyrics');
  assert.equal(read.uncertain_proposal, true);
  assert.equal(read.session_id, first.operation_id);
  assert.throws(
    () => sessions.submit(first.operation_id, 'lyrics', 'lyric_revise', { answer: 'x' }),
    /CONTINUATION_UNCERTAIN: .*grade the draft you keep with lyric_grade, then call lyric_revise with it and new_run: true/
  );
  const free = sessions.submit(first.operation_id, 'lyrics', 'lyric_sweep', { seed_from: 1 });
  await sessions.wait(free.operation_id);
  assert.equal(sessions.status(free.operation_id, 'lyrics').status, 'completed');
  // Nothing of the uncertain run was carried into the free step.
  assert.equal(sessions.status(free.operation_id, 'lyrics').uncertain_proposal, false);
  const fresh = sessions.submit(free.operation_id, 'lyrics', 'lyric_revise', {
    new_run: true,
    draft: ['x'],
  });
  await sessions.wait(fresh.operation_id);
  assert.equal(sessions.status(fresh.operation_id, 'lyrics').status, 'completed');
  // With no suspended run, an answer has nothing to fold into.
  assert.throws(
    () => sessions.submit(fresh.operation_id, 'lyrics', 'lyric_revise', { answer: 'x' }),
    /NO_PENDING_QUESTION: .*lyric_grade/
  );
});

test('an interrupted operation that cannot resume still leaves a legal next step', async (t) => {
  let calls = 0;
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async (session, name) => {
      if (name === 'lyric_revise' && ++calls === 1) throw new Error('connection lost');
      return { session, result: lyricResult(name) };
    },
  });
  const opened = sessions.open('lyrics');
  const lost = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', { seed: 31 });
  await sessions.wait(lost.operation_id);
  const read = sessions.status(lost.operation_id, 'lyrics');
  assert.equal(read.status, 'interrupted');
  assert.equal(read.resumable, false);
  // Resuming is refused, and the refusal names what works.
  assert.throws(
    () => sessions.resume(lost.operation_id, 'lyrics'),
    /CONTINUATION_UNCERTAIN: .*accepted_draft.*recover_only: true.*pass this id as the session_id/
  );
  // …and what it names does work: the id continues with new work.
  assert.equal(read.session_id, lost.operation_id);
  const graded = sessions.submit(lost.operation_id, 'lyrics', 'lyric_grade', { seed: 31 });
  await sessions.wait(graded.operation_id);
  assert.equal(sessions.status(graded.operation_id, 'lyrics').status, 'completed');
  const again = sessions.submit(graded.operation_id, 'lyrics', 'lyric_revise', { new_run: true });
  await sessions.wait(again.operation_id);
  assert.equal(sessions.status(again.operation_id, 'lyrics').status, 'completed');
});

function seededRecord(store, domain, change) {
  const session = new WorkflowSessions({ store }).fresh(domain);
  change(session);
  const id = randomBytes(32).toString('hex');
  store.begin(id, { request_id: id, integration: 'chatgpt-v1', action: 'open' }, {}, { session });
  store.complete(id, 200, { session, result: { content: [] } });
  return id;
}

test('a changed scorer refuses old lyric sessions with an export, and never blocks a recipe', async (t) => {
  const { store } = storeFor(t);
  const workspace = startRecipe({ traditions: ['delta_blues'] }).workspace;
  const recipeId = seededRecord(store, 'recipe', (session) => {
    session.semantic_identity = 'f'.repeat(64);
    session.workspace = workspace;
  });
  const lyricId = seededRecord(store, 'lyrics', (session) => {
    session.semantic_identity = 'f'.repeat(64);
  });
  const sessions = new WorkflowSessions({ store });
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  const edited = sessions.submit(recipeId, 'recipe', 'edit_recipe', { edits });
  await sessions.wait(edited.operation_id);
  assert.equal(
    value(sessions.status(edited.operation_id, 'recipe')).recipe,
    editRecipe({ workspace, edits }).recipe
  );
  assert.throws(
    () => sessions.submit(lyricId, 'lyrics', 'lyric_sweep', { seed_from: 1 }),
    /CONTINUATION_MIGRATION_REQUIRED: .*recover_only: true.*begin_lyrics/
  );
});

test('retired and unknown ids read as such and name the next step', async (t) => {
  const store = new JobStore(storeFor(t).directory, { maxPayloadRecords: 2 });
  const sessions = new WorkflowSessions({ store });
  const first = sessions.open('recipe');
  sessions.open('recipe');
  sessions.open('recipe');
  const client = await connect(t, 'recipe', sessions);
  const read = data(await call(client, 'get_operation', { operation_id: first.session_id }));
  assert.equal(read.status, 'retired');
  assert.equal(read.session_id, undefined);
  assert.match(read.note, /start_recipe/);
  assert.throws(
    () => sessions.submit(first.session_id, 'recipe', 'render_recipe', {}),
    /SESSION_RETIRED: .*start_recipe/
  );
  const unknown = await call(client, 'render_recipe', { session_id: 'a'.repeat(64) });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0].text, /SESSION_UNAVAILABLE: .*start_recipe/);
  assert.doesNotMatch(unknown.content[0].text, /uncertain/);
});

test('session store limits keep a live session through connector-scale traffic', async () => {
  // Sized for connector sessions, not /chat's 128 large receipts: a burst of
  // other callers' recipes no longer retires a session a caller is still using.
  const store = new JobStore(null, SESSION_STORE_LIMITS);
  const sessions = new WorkflowSessions({
    store,
    execute: async (session) => ({ session, result: { content: [{ type: 'text', text: '{}' }] } }),
  });
  const mine = sessions.submit(null, 'recipe', 'start_recipe', { traditions: ['x'] });
  await sessions.wait(mine.operation_id);
  for (let i = 0; i < 300; i++) {
    const other = sessions.submit(null, 'recipe', 'start_recipe', { traditions: ['x'] });
    await sessions.wait(other.operation_id);
  }
  assert.equal(sessions.status(mine.operation_id, 'recipe').status, 'completed');
});

test('recipe calls still answer when the session store refuses, and say they were not saved', async (t) => {
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({ store });
  const alias = await connect(t, 'recipe', sessions);
  const shared = await connectShared(t, sessions);
  const traditions = ['delta_blues'];
  const workspace = startRecipe({ traditions }).workspace;
  const started = data(await call(alias, 'start_recipe', { traditions }));
  store.failure = 'disk unavailable';
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  const edited = await call(alias, 'edit_recipe', { session_id: started.session_id, edits });
  assert(!edited.isError, JSON.stringify(edited));
  assert.equal(edited.structuredContent.status, 'unsaved');
  assert.equal(edited.structuredContent.session_id, undefined);
  assert.equal(JSON.parse(edited.content[0].text).recipe, editRecipe({ workspace, edits }).recipe);
  assert.match(JSON.parse(edited.content.at(-1).text).note, /^NOT SAVED: .*disk unavailable/);
  // The caller-managed surface hands back the workspace so work can go on.
  const fresh = await call(shared, 'start_recipe', { traditions });
  assert.equal(fresh.structuredContent.status, 'unsaved');
  const unsavedStart = JSON.parse(fresh.content[0].text);
  assert.equal(unsavedStart.workspace.cards.length, workspace.cards.length);
  assert.equal(unsavedStart.recipe, startRecipe({ traditions }).recipe);
  assert.match(JSON.parse(fresh.content.at(-1).text).note, /pass the `workspace`/);
  // Lookups never touch the store; lyric sessions do need it, and say so.
  assert(!(await call(alias, 'search_catalog', { query: 'banjo' })).isError);
  const lyrics = await connect(t, 'lyrics', sessions);
  const begun = await call(lyrics, 'begin_lyrics', {});
  assert.equal(begun.isError, true);
  assert.match(begun.content[0].text, /persistence unavailable/);
});

test('the lyric queue limit does not hold back recipe calls', async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    maxActive: 1,
    execute: async (session, name) => {
      if (name.startsWith('lyric_')) await gate;
      return { session, result: { content: [{ type: 'text', text: '{}' }] } };
    },
  });
  const lyrics = sessions.open('lyrics');
  const busy = sessions.submit(lyrics.session_id, 'lyrics', 'lyric_sweep', { seed_from: 1 });
  const recipe = sessions.submit(null, 'recipe', 'start_recipe', { traditions: ['x'] });
  await sessions.wait(recipe.operation_id);
  assert.equal(sessions.status(recipe.operation_id, 'recipe').status, 'completed');
  const other = sessions.open('lyrics');
  assert.throws(
    () => sessions.submit(other.session_id, 'lyrics', 'lyric_sweep', { seed_from: 2 }),
    /SESSION_CAPACITY: .*Retry this same call/
  );
  release();
  await sessions.wait(busy.operation_id);
});

test('sessions an earlier release saved in the shared store stay readable and continuable', async (t) => {
  const legacy = storeFor(t).store;
  const old = new WorkflowSessions({ store: legacy });
  const traditions = ['delta_blues'];
  const started = old.submit(null, 'recipe', 'start_recipe', { traditions });
  await old.wait(started.operation_id);
  const { store } = storeFor(t);
  const sessions = new WorkflowSessions({ store, legacyStore: legacy });
  assert.equal(sessions.status(started.operation_id, 'recipe').status, 'completed');
  const edits = [{ action: 'set_preface', card: 'voice', preface: 'worn' }];
  const edited = sessions.submit(started.operation_id, 'recipe', 'edit_recipe', { edits });
  await sessions.wait(edited.operation_id);
  assert.equal(
    value(sessions.status(edited.operation_id, 'recipe')).recipe,
    editRecipe({ workspace: startRecipe({ traditions }).workspace, edits }).recipe
  );
  // The parent now lives in the new store with its single successor recorded.
  assert.equal(store.get(started.operation_id).successor_id, edited.operation_id);
  assert.equal(
    sessions.submit(started.operation_id, 'recipe', 'edit_recipe', { edits }).operation_id,
    edited.operation_id
  );
});

test('each surface describes its own session mechanics, and only where they apply', async (t) => {
  const sessions = new WorkflowSessions({ store: new JobStore() });
  const alias = (await (await connect(t, null, sessions)).listTools()).tools;
  const shared = (await (await connectShared(t, sessions)).listTools()).tools;
  const find = (tools, name) => tools.find((x) => x.name === name);
  const prefix = (tool) => tool.description.slice(0, tool.description.indexOf('. ', 300));
  for (const tools of [alias, shared]) {
    // Run state is named only on the tool that has it.
    assert.match(
      find(tools, 'lyric_revise').description,
      /carries the run, its state, run_id, run_revision/
    );
    assert.doesNotMatch(prefix(find(tools, 'lyric_grade')), /run_id|run_revision/);
    // The phase is chosen by this argument, and the text says so.
    assert.match(find(tools, 'begin_lyrics').description, /only for lyrics the user supplied/);
    assert.match(find(tools, 'get_operation').description, /tool_error: true/);
  }
  // A caller-managed mode exists only on the compatibility surface.
  assert.doesNotMatch(find(alias, 'edit_recipe').description, /Without session_id/);
  assert.match(find(shared, 'edit_recipe').description, /Without session_id, pass `workspace`/);
  assert.match(find(shared, 'lyric_grade').description, /no creation order is enforced/);
  for (const key of ['state', 'run_id', 'run_revision', 'checkpoint']) {
    assert.equal(find(alias, 'lyric_revise').inputSchema.properties[key], undefined);
    assert.match(
      find(shared, 'lyric_revise').inputSchema.properties[key].description,
      /^CALLER-MANAGED STATE — only without session_id/
    );
  }
  assert.match(
    find(shared, 'lyric_revise').inputSchema.properties.recover_only.description,
    /^With session_id: [^]* Without session_id: true exports/
  );
});
