// Exact identity controls and the planner brief through existing connector handlers.
// Run: node --test mcp/test_function_disclosure_identity.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { recordCreation, creationRefusal } from './lyric_workflow.js';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const functions = [' Pre-Chorus ', 'chorus', ' Pre-Chorus '];
function fixture() {
  const task = { domain: 'lyrics', phase: 'create' };
  const request = {
    seed: 16,
    form: 'open',
    lines: null,
    relation: '',
    functions: [...functions],
    title: '',
    narrative: false,
    wants: [],
  };
  recordCreation(
    task,
    'lyric_sweep',
    { functions: [...functions] },
    { exit_code: 0, accepted_shown: [16] }
  );
  recordCreation(task, 'lyric_screen', { words: ['light', 'night'] }, { exit_code: 0 });
  const plan = {
    plan_version: 3,
    request,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{ name: 'A' }],
  };
  return {
    task,
    request,
    receipt: {
      exit_code: 0,
      plan,
      plan_sha256: hash(plan),
      plan_request: structuredClone(request),
    },
  };
}

test('stored request and carry-forward retain raw bytes, order and duplicates', () => {
  const { task, request, receipt } = fixture();
  recordCreation(task, 'lyric_plan', request, receipt);
  assert.deepEqual(task.workflow.plan.request.functions, functions);
  const args = { draft: ['A light', 'The night'] };
  assert.equal(creationRefusal(task, 'lyric_grade', args), null);
  assert.equal(args.functions, ' Pre-Chorus ,chorus, Pre-Chorus ');
  assert.deepEqual(receipt.plan.request.functions, functions);
});

test('baseline argument comparison trims and sorts but does not equate aliases or case', () => {
  const { task, request, receipt } = fixture();
  recordCreation(task, 'lyric_plan', request, receipt);
  const draft = ['A light', 'The night'];
  assert.equal(
    creationRefusal(task, 'lyric_grade', {
      draft,
      functions: ['chorus', 'Pre-Chorus', 'Pre-Chorus'],
    }),
    null
  );
  for (const changed of [
    ['prechorus', 'chorus', 'prechorus'],
    ['pre-chorus', 'chorus', 'pre-chorus'],
    ['popular_song::Pre-Chorus', 'chorus', 'popular_song::Pre-Chorus'],
    ['Pre-Chorus', 'chorus'],
  ]) {
    assert.match(
      creationRefusal(task, 'lyric_grade', { draft, functions: changed }),
      /^CREATION_PLAN: functions differs/
    );
  }
});

test('stored plan hash rejects raw changes even where argument comparison permits them', () => {
  for (const changed of [
    ['chorus', ' Pre-Chorus ', ' Pre-Chorus '],
    ['Pre-Chorus', 'chorus', 'Pre-Chorus'],
    [' Pre-Chorus ', 'chorus'],
    ['prechorus', 'chorus', 'prechorus'],
  ]) {
    const { task, request, receipt } = fixture();
    receipt.plan.request.functions = changed;
    receipt.plan_request = structuredClone(receipt.plan.request);
    recordCreation(task, 'lyric_plan', request, receipt);
    assert.equal(task.workflow.plan, null);
  }
});

test('plan_request must match the exact stored request independently of a valid hash', () => {
  const { task, request, receipt } = fixture();
  receipt.plan_request.functions = ['chorus', ' Pre-Chorus ', ' Pre-Chorus '];
  recordCreation(task, 'lyric_plan', request, receipt);
  assert.equal(task.workflow.plan, null);
});

test('brief bytes remain part of the exact stored plan receipt', () => {
  const { task, request, receipt } = fixture();
  receipt.plan.writer_brief = 'Changed disclosure';
  recordCreation(task, 'lyric_plan', request, receipt);
  assert.equal(task.workflow.plan, null);
  receipt.plan_sha256 = hash(receipt.plan);
  recordCreation(task, 'lyric_plan', request, receipt);
  assert.equal(task.workflow.plan.sha256, receipt.plan_sha256);
});

// Real handlers, no provider calls: a grade must re-plan to the same receipt.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';
import { JobStore } from './job_store.js';
import { _workerInternals } from './lyric_tools.js';
import { continuationSemanticIdentity } from './state_codec.js';
import { runtimeAssets } from './runtime_assets.js';
import { runtimeSourceFingerprint } from './build_identity.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function connection(t) {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const client = new Client({ name: 'function-disclosure', version: '1' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

// The optional baseline is a separate checkout of the released runtime, not
// a forged identity on a current-runtime wire. Without a second checkout,
// test_state_codec.mjs's top-level oldWire/oldBodyWire assertions cover
// synthetic mismatch refusal, exact recovery and refusal to restamp old state.
// test_chatgpt.mjs: "a changed scorer refuses old lyric sessions with an export,
// and never blocks a recipe" checks synthetic session admission refusal and
// the recovery instruction (not execution of recovery or an old-runtime grade).
// These are complementary checks, not substitutes for the released fixture.
test(
  'released runtime session and sealed caller state refuse before execution and recover exactly',
  { skip: !process.env.FUNCTION_DISCLOSURE_BASELINE_ROOT, timeout: 120000 },
  async (t) => {
    const root = process.env.FUNCTION_DISCLOSURE_BASELINE_ROOT;
    const source = `
      import {encodeInterviewWire,decodeState,verifyInterviewCursor,continuationSemanticIdentity,recoverState} from './mcp/state_codec.js';
      import {WorkflowSessions} from './mcp/workflow_sessions.js';
      import {JobStore} from './mcp/job_store.js';
      import {runtimeAssets} from './mcp/runtime_assets.js';
      import {runtimeSourceFingerprint} from './mcp/build_identity.js';
      const journal={version:1,input_draft:['Original line'],accepted_lines:['Accepted line'],
        answered:{propose:[],propose_group:[]},cursor:{phase:'fixture'},
        connector_semantic_identity:continuationSemanticIdentity()};
      const wire=encodeInterviewWire(journal);
      const decoded=decodeState(wire);
      if (!decoded.cursor_seal || verifyInterviewCursor(decoded)!==null) throw Error('unsealed fixture');
      const session=new WorkflowSessions({store:new JobStore(null)}).fresh('lyrics');
      const {execFileSync}=await import('node:child_process');
      const {createHash}=await import('node:crypto');
      const plan=JSON.parse(execFileSync('python3',['-B','-c',
        'import json; from quality.plan import make_plan; print(json.dumps(make_plan(11,functions=[" verse ","reprise","reprise"],lines=24)))'],
        {cwd:'lyric-harness',encoding:'utf8'}));
      session.task.plan={result:plan,sha256:createHash('sha256').update(JSON.stringify(plan)).digest('hex')};
      session.recovery=wire;
      console.log(JSON.stringify({wire,session,journal:recoverState(wire).journal,
        assets:runtimeAssets(),source:runtimeSourceFingerprint()}));
    `;
    const previous = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', source], {
        cwd: root,
        env: { ...process.env, CHAT_SECRET: 'function-disclosure-local-test-key' },
        encoding: 'utf8',
      })
    );
    const assets = runtimeAssets();
    assert.equal(previous.assets.ok, true, JSON.stringify(previous.assets));
    assert.equal(assets.ok, true, JSON.stringify(assets));
    for (const key of ['assets_sha256', 'manifest_sha256', 'python', 'nltk'])
      assert.equal(previous.assets[key], assets[key], key);
    assert.notEqual(previous.source, runtimeSourceFingerprint());
    assert.notEqual(previous.session.semantic_identity, continuationSemanticIdentity());
    assert.equal(previous.session.task.plan.sha256, hash(previous.session.task.plan.result));
    assert.doesNotMatch(
      previous.session.task.plan.result.writer_brief,
      /(?:Your|The) request allowed these functions/
    );
    const directory = mkdtempSync(join(tmpdir(), 'disclosure-session-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const store = new JobStore(directory);
    const id = 'a'.repeat(64);
    store.begin(
      id,
      { request_id: id, integration: 'chatgpt-v1', action: 'open' },
      {},
      { session: previous.session }
    );
    store.complete(id, 200, { session: previous.session, result: { content: [] } });
    let executions = 0;
    const sessions = new WorkflowSessions({
      store,
      execute: async () => {
        executions++;
        throw Error('executed');
      },
    });
    const before = JSON.stringify(store.get(id));
    assert.throws(
      () => sessions.submit(id, 'lyrics', 'lyric_grade', { seed: 11, draft: ['Accepted line'] }),
      /CONTINUATION_MIGRATION_REQUIRED/
    );
    assert.equal(executions, 0);
    assert.equal(JSON.stringify(store.get(id)), before);
    const exported = JSON.parse(sessions.recover(id, 'lyrics').content[0].text);
    assert.deepEqual(exported.journal, previous.journal);
    const client = await connection(t);
    const pid = _workerInternals.pid();
    const refused = await client.callTool({
      name: 'lyric_revise',
      arguments: { state: previous.wire },
    });
    assert.equal(refused.isError, true);
    assert.match(refused.content[0].text, /CONTINUATION_MIGRATION_REQUIRED/);
    assert.equal(_workerInternals.pid(), pid);
    const recovered = await client.callTool({
      name: 'lyric_revise',
      arguments: { state: previous.wire, recover_only: true },
    });
    assert.notEqual(recovered.isError, true);
    const value = JSON.parse(recovered.content[0].text);
    assert.deepEqual(value.journal, previous.journal);
    assert.deepEqual(value.final_draft, ['Accepted line']);
    assert.deepEqual(value.replay_draft, ['Original line']);
    assert.equal(value.resumable, false);
    assert.equal(value.certified, false);
    assert.equal(value.new_run_required, true);
    assert.equal(_workerInternals.pid(), pid);
    assert.equal(JSON.stringify(store.get(id)), before);
  }
);

test(
  'real plan and grade agree on the whole brief-bearing plan hash',
  { timeout: 120000 },
  async (t) => {
    const client = await connection(t);
    const task = { domain: 'lyrics', phase: 'create' };
    const raw = ' verse ,, English_Song::BREAK ,reprise,reprise';
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return verdictOf(result);
    };
    const sweepArgs = { seed_from: 11, count: 1, lines: 24, functions: raw };
    const sweep = await call('lyric_sweep', sweepArgs);
    assert.equal(sweep.exit_code, 0);
    recordCreation(task, 'lyric_sweep', sweepArgs, sweep);
    const screenArgs = { words: ['rain', 'train'] };
    recordCreation(task, 'lyric_screen', screenArgs, await call('lyric_screen', screenArgs));
    const args = { seed: sweep.accepted_shown[0], lines: 24, functions: raw };
    const planned = await call('lyric_plan', args);
    assert.equal(planned.exit_code, 0);
    assert.match(
      planned.plan.writer_brief,
      /The request allowed these functions \(as written → resolved name\):/
    );
    assert.deepEqual(planned.plan.functions_unused, ['interlude', 'reprise']);
    assert.match(planned.plan.writer_brief, /Not drawn in this song: interlude, reprise\./);
    assert.equal(planned.plan_sha256, hash(planned.plan));
    recordCreation(task, 'lyric_plan', args, planned);
    assert.equal(task.workflow.plan.sha256, planned.plan_sha256);
    const gradeArgs = {
      ...args,
      draft: Array(planned.plan.total_lines).fill('I hold your hand beside the rain'),
    };
    assert.equal(creationRefusal(task, 'lyric_grade', gradeArgs), null);
    const graded = await call('lyric_grade', gradeArgs);
    assert.equal(graded.plan_sha256, planned.plan_sha256);
    assert.deepEqual(graded.plan_request, planned.plan_request);
    recordCreation(task, 'lyric_grade', gradeArgs, graded);
    assert(task.workflow.grade, JSON.stringify(graded));
    recordCreation(task, 'lyric_grade', gradeArgs, {
      ...graded,
      plan_sha256: 'stale-within-runtime',
    });
    assert.equal(task.workflow.grade, null);
  }
);
