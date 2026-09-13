import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JobStore } from './job_store.js';
import { ChatGPTSessions, publicToolResult, verdictOf } from './chatgpt_sessions.js';
import { buildChatGPTServer } from './chatgpt_tools.js';
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
  const server = await buildChatGPTServer({ domain, sessions });
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
const data = (result) => {
  assert(result.structuredContent, JSON.stringify(result));
  return result.structuredContent;
};
const value = (result) => JSON.parse(result.tool_result.content[0].text);
const call = (client, name, args) => client.callTool({ name, arguments: args });

test('recipe MCP carries exact workspaces through reconnects and all four formats', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new ChatGPTSessions({ store });
  let client = await connect(t, 'recipe', sessions);
  const initial = data(await call(client, 'start_recipe', { traditions: ['delta_blues'] }));
  const original = startRecipe({ traditions: ['delta_blues'] });
  assert.equal(value(initial).recipe, original.recipe);
  assert(!('workspace' in value(initial)));
  await client.close();
  sessions = new ChatGPTSessions({ store: new JobStore(directory) });
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
  const sessions = new ChatGPTSessions({
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
  let sessions = new ChatGPTSessions({ store });
  let client = await connect(t, 'recipe', sessions);
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
  sessions = new ChatGPTSessions({ store: new JobStore(directory) });
  client = await connect(t, 'recipe', sessions);
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
  const sessions = new ChatGPTSessions({
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
  assert.equal(store.get(initial.session_id).response.body.session.writer, 'kitchen');
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
  const sessions = new ChatGPTSessions({ store });
  const client = await connect(t, 'lyrics', sessions);
  const initial = data(await call(client, 'begin_lyrics', { writer: 'interview' }));
  const forged = await call(client, 'lyric_plan', {
    session_id: initial.session_id,
    seed: 31,
    workflow: { completedSteps: ['sweep', 'screen'] },
  });
  assert(forged.isError);
  const queued = data(
    await call(client, 'lyric_plan', { session_id: initial.session_id, seed: 31 })
  );
  await sessions.wait(queued.operation_id);
  const refused = sessions.status(queued.operation_id, 'lyrics');
  assert.equal(refused.tool_result.isError, true);
  assert.match(refused.tool_result.content[0].text, /CREATION_ORDER/);
  assert.equal(
    store.get(queued.operation_id).response.body.session.native.task.workflow?.plan,
    undefined
  );
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 12);
  const revise = tools.find((tool) => tool.name === 'lyric_revise');
  for (const field of ['state', 'checkpoint', 'run_id', 'run_revision', 'writer', 'workspace'])
    assert(!revise.inputSchema.properties[field]);
  assert.equal(revise.annotations.readOnlyHint, false);
  assert.equal(revise.annotations.openWorldHint, true);
});

test('real lyric sweep, screen and plan receipts persist between operations', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new ChatGPTSessions({ store });
  let session_id = sessions.open('lyrics', { writer: 'interview' }).session_id;
  const run = async (name, args) => {
    const q = sessions.submit(session_id, 'lyrics', name, args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    assert(!r.tool_result.isError, JSON.stringify(r));
    session_id = r.session_id;
    return verdictOf(r.tool_result);
  };
  const swept = await run('lyric_sweep', { seed_from: 31, count: 1, lines: 12 });
  assert.equal(swept.exit_code, 0);
  const seed = swept.accepted_shown[0];
  assert(Number.isInteger(seed));
  const screened = await run('lyric_screen', {
    words: ['stove', 'coat'],
    relation: 'class:ASSONANCE',
  });
  assert.equal(screened.exit_code, 0, JSON.stringify(screened));
  sessions = new ChatGPTSessions({ store: new JobStore(directory) });
  const planned = await run('lyric_plan', { seed, lines: 12 });
  assert.equal(planned.exit_code, 0);
  assert(sessions.store.get(session_id).response.body.session.native.task.workflow.plan);
  const q = sessions.submit(session_id, 'lyrics', 'lyric_revise', {
    seed,
    draft: Array(12).fill('The kettle whistles by the stove'),
  });
  await sessions.wait(q.operation_id);
  assert.match(
    sessions.status(q.operation_id, 'lyrics').tool_result.content[0].text,
    /CREATION_GRADE/
  );
});

test('restart marks admitted work interrupted and never automatically executes it', async (t) => {
  const { store, directory } = storeFor(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const sessions = new ChatGPTSessions({
    store,
    execute: async (session) => {
      await gate;
      return { session, result: { content: [] } };
    },
  });
  const opened = sessions.open('lyrics', { writer: 'interview' });
  const q = sessions.submit(opened.session_id, 'lyrics', 'lyric_revise', {});
  // A fresh process sees the durable intent before any worker response.
  const recovered = new ChatGPTSessions({
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

test('real edit revision restores a question across reconnect and rejects changed replay input without losing the session', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new ChatGPTSessions({ store });
  let session_id = sessions.open('lyrics', { phase: 'edit', writer: 'interview' }).session_id;
  const run = async (args) => {
    const q = sessions.submit(session_id, 'lyrics', 'lyric_revise', args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    assert.equal(r.status, 'completed', JSON.stringify(r));
    session_id = r.session_id;
    return r.tool_result;
  };
  const initial = await run({
    scheme: 'AA',
    relation: 'type:rime riche',
    draft: ['Copper cat', 'Azure dog'],
    max_rounds: 1,
    backtrack: 0,
  });
  assert.equal(verdictOf(initial).exit_code, 4);
  assert(!/run_[a-f0-9]{64}/.test(JSON.stringify(initial)));
  sessions = new ChatGPTSessions({ store: new JobStore(directory) });
  const changed = await run({
    draft: ['Different song', 'Entirely replaced'],
    answer: 'I hold you.',
  });
  assert(changed.isError);
  assert.match(changed.content[0].text, /SESSION_CONTINUATION/);
  const answered = await run({ answer: 'I left the basket underneath the oak' });
  assert(!answered.isError, JSON.stringify(answered));
  assert(verdictOf(answered).folded, JSON.stringify(answered));
});

function checkpoint(overrides = {}) {
  return {
    version: 1,
    status: 'accepted',
    input_draft: ['original'],
    accepted_lines: ['accepted'],
    answered: { propose: [], propose_group: [] },
    connector_declarations: { seed: 31, writer: 'kitchen' },
    connector_semantic_identity: continuationSemanticIdentity(),
    ...overrides,
  };
}

test('safe resume carries original replay input and accepted journal, and deduplicates', async (t) => {
  const { store } = storeFor(t);
  let executions = 0;
  const sessions = new ChatGPTSessions({
    store,
    execute: async (session) => {
      executions++;
      if (executions === 1) {
        requestContext().onCheckpoint(checkpoint());
        throw new Error('lost result');
      }
      const args = session.native.continuation.args;
      assert.deepEqual(args.draft, ['original']);
      const decoded = decodeState(args.checkpoint);
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

test('unknown provider outcome blocks resume while retaining accepted lyrics', async (t) => {
  const { store } = storeFor(t);
  const sessions = new ChatGPTSessions({
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

test('kitchen admission requires durable storage', () => {
  const sessions = new ChatGPTSessions({ store: new JobStore() });
  assert.throws(() => sessions.open('lyrics'), /DURABLE_STORAGE_REQUIRED/);
  assert.equal(sessions.open('recipe').durable, false);
});

test('unsettled operation budget blocks replay even without a proposer usage callback', async (t) => {
  const { store } = storeFor(t);
  const ledger = new PaidLedger({ pricing: () => ({ input: 1, output: 1 }) });
  for (const interrupted of [false, true]) {
    const sessions = new ChatGPTSessions({
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
  const sessions = new ChatGPTSessions({
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
    const sessions = new ChatGPTSessions({
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
  const sessions = new ChatGPTSessions({
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
  const sessions = new ChatGPTSessions({
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
