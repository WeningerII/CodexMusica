import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import { runTurn, LIMITS } from './gemini_agent.js';
import { JobStore, createJobRouter } from './job_store.js';
import { RunStore, declarationsOf, movedDeclarations, runRefusal } from './run_store.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { continuationSemanticIdentity, recoverState, STATE_DECODED_BYTES } from './state_codec.js';
import { buildServer as buildRealServer } from './tools.js';
import { _verdictInternals } from './lyric_tools.js';

const nativeFetch = globalThis.fetch;
const instructions =
  '=== RECIPE TASK === Recording recipe instructions. === LYRICS TASK === Lyrics instructions.';
const surface = {
  instructions,
  declarations: ['start_recipe', 'lyric_revise', 'lyric_plan', 'lyric_screen', 'lyric_sweep'].map(
    (name) => ({ name, parameters: { type: 'object', properties: {} } })
  ),
  workspaceTools: new Set(),
  stateTools: new Set(['lyric_revise']),
};
const usageMetadata = { promptTokenCount: 20, candidatesTokenCount: 10, thoughtsTokenCount: 0 };
const response = (parts) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts }, finishReason: 'STOP' }], usageMetadata }),
});
const fc = (name, args = {}) => ({ functionCall: { name, args } });
const opts = {
  apiKey: 'offline',
  surface,
  userText: 'A new love song.',
  limits: { ...LIMITS, maxSteps: 3, maxTurnMs: 3000, maxTurnUsd: 0 },
  callTool: async () => {
    throw Error('Unexpected tool');
  },
};
const task = (domain) => ({
  version: 2,
  domain,
  format: 'rich',
  maxChars: 1000,
  brief: 'The exact original creative brief.',
  phase: domain === 'recipe' ? 'recipe' : 'edit',
  completedSteps: [],
  turns: 0,
});
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

function verificationFixture() {
  const before = ['a small café', 'an old door'];
  const after = ['the bright café', 'an old door'];
  const outcome = {
    outcome_id: 'a'.repeat(64),
    kind: 'propose',
    proposal_index: 0,
    question_sha256: 'b'.repeat(64),
    round: 1,
    attempt: 0,
    members: [1],
    accepted: true,
    applied: true,
    reasons: ['actual native verifier finding'],
    before_draft_sha256: sha(JSON.stringify(before)),
    after_draft_sha256: sha(JSON.stringify(after)),
    applied_draft_sha256: sha(JSON.stringify(after)),
  };
  const proof = {
    version: 1,
    journal_id: 'c'.repeat(32),
    checkpoint_loaded: true,
    input_checkpoint_sha256: sha('exact worker input\n'),
    input_draft_sha256: sha(JSON.stringify(before)),
    accepted_draft_sha256_at_start: sha(JSON.stringify(before)),
    applied_outcome_ids_at_start: [],
    completed_proposals_at_start: 1,
    completed_proposals_replayed: 1,
    new_proposer_dispatches: 0,
    completed_proposal_redispatches: 0,
    replay_prefix_consumed: true,
  };
  return {
    code: 3,
    stdout: 'Native verifier result.',
    checkpoint_input_sha256: proof.input_checkpoint_sha256,
    checkpoint_wire_sha256: sha('exact signed checkpoint wire'),
    lyric_result: {
      version: 1,
      status: 'finished',
      final_draft: after,
      findings: [],
      verified_outcomes: [outcome],
      resume_proof: proof,
    },
  };
}

test('verified application evidence stays distinct from missing, rejected and unapplied proposals', () => {
  const { verdictOf } = _verdictInternals;
  const fixture = verificationFixture();
  const native = fixture.lyric_result.verified_outcomes[0];
  const valid = verdictOf(fixture);
  assert.equal(valid.verified_outcomes.length, 1);
  assert.equal(valid.verified_outcomes[0].applied, true);
  assert.equal(valid.verified_outcomes_draft_sha256, native.after_draft_sha256);
  assert.equal(valid.journal_id, fixture.lyric_result.resume_proof.journal_id);
  assert.equal(valid.verified_outcomes_error, null);
  assert.ok(!Object.hasOwn(valid.verified_outcomes[0], 'reasons'), 'compact wire omits long prose');
  assert.equal(valid.resume_proof.wire_checkpoint_sha256, fixture.checkpoint_wire_sha256);
  for (const accepted of [true, false]) {
    const r = structuredClone(fixture);
    Object.assign(r.lyric_result.verified_outcomes[0], { accepted, applied: false });
    delete r.lyric_result.verified_outcomes[0].applied_draft_sha256;
    assert.equal(verdictOf(r).verified_outcomes[0].applied, false);
  }
  const empty = structuredClone(fixture);
  empty.lyric_result.verified_outcomes = [];
  assert.deepEqual(verdictOf(empty).verified_outcomes, []);
  const missing = structuredClone(fixture);
  delete missing.lyric_result.verified_outcomes;
  assert.equal(verdictOf(missing).verified_outcomes, null);
  assert.match(verdictOf(missing).verified_outcomes_error, /No authenticated/);
  for (const mutate of [
    (r) => {
      r.lyric_result.verified_outcomes[0].accepted = 'true';
    },
    (r) => {
      r.lyric_result.verified_outcomes[0].applied_draft_sha256 = 'd'.repeat(64);
    },
    (r) => {
      r.lyric_result.verified_outcomes[0].members = [1, 1];
    },
    (r) => {
      r.lyric_result.verified_outcomes.push({ ...native, accepted: false });
    },
  ]) {
    const r = structuredClone(fixture);
    mutate(r);
    const v = verdictOf(r);
    assert.equal(v.verified_outcomes, null);
    assert.match(v.verified_outcomes_error, /Malformed|Conflicting/);
  }
  const duplicate = structuredClone(fixture);
  duplicate.lyric_result.verified_outcomes.push(structuredClone(native));
  assert.equal(verdictOf(duplicate).verified_outcomes.length, 1);
  for (const mutate of [
    (r) => {
      r.checkpoint_input_sha256 = 'd'.repeat(64);
    },
    (r) => {
      r.lyric_result.resume_proof.completed_proposals_replayed = 2;
    },
    (r) => {
      delete r.checkpoint_wire_sha256;
    },
  ]) {
    const r = structuredClone(fixture);
    mutate(r);
    assert.equal(verdictOf(r).resume_proof, null);
    assert.ok(verdictOf(r).resume_proof_error);
  }
});

test('actual chat tool rows preserve compact verifier/application and exact checkpoint replay receipts', async () => {
  const fixture = verificationFixture();
  const verdict = { ..._verdictInternals.verdictOf(fixture), writer: 'kitchen' };
  const makeServer = () => {
    const mcp = new McpServer(
      { name: 'verified-evidence-fixture', version: '1' },
      { instructions }
    );
    mcp.registerTool('lyric_revise', { inputSchema: {} }, async () => ({
      content: [{ type: 'text', text: JSON.stringify(verdict) }],
    }));
    return mcp;
  };
  const router = await createChatRouter({
    buildServer: makeServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 1 },
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  globalThis.fetch = async () => response([fc('lyric_revise')]);
  try {
    const http = await nativeFetch(`http://127.0.0.1:${server.address().port}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: 'Edit my pasted lyrics',
        task: { domain: 'lyrics', phase: 'edit' },
      }),
    });
    assert.equal(http.status, 200);
    const payload = await http.json();
    assert.equal(payload.tools.length, 1);
    assert.equal(payload.tools[0].writer, 'kitchen');
    for (const key of [
      'verified_outcomes',
      'verified_outcomes_error',
      'verified_outcomes_draft_sha256',
      'journal_id',
      'resume_proof',
      'resume_proof_error',
      'final_draft',
    ])
      assert.deepEqual(payload.tools[0][key], verdict[key], `${key} survives both projections`);
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('maximum recovery exports complete through actual HTTP and durable receipts within existing byte caps', async (t) => {
  const journal = { version: 1, input_draft: [''], accepted_lines: [''], padding: '' };
  const copies = Math.floor((STATE_DECODED_BYTES - Buffer.byteLength(JSON.stringify(journal))) / 4);
  journal.input_draft[0] = '\\'.repeat(copies);
  journal.accepted_lines[0] = '"'.repeat(copies);
  journal.padding = 'x'.repeat(STATE_DECODED_BYTES - Buffer.byteLength(JSON.stringify(journal)));
  const original = JSON.stringify(journal);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-recovery-export-'));
  const store = new JobStore(dir);
  const router = await createChatRouter({
    buildServer: buildRealServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 3 },
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(createJobRouter({ store, recoverCheckpoint: (r) => router.recoverCheckpoint(r) }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let requests = 0,
    activePart = 'all',
    parent;
  globalThis.fetch = async () => {
    requests++;
    return response([
      fc('lyric_revise', { recover_only: true, checkpoint: original, recovery_part: activePart }),
    ]);
  };
  try {
    for (const part of ['all', 'journal']) {
      activePart = part;
      const id = crypto.randomBytes(32).toString('hex');
      const expected = JSON.stringify(recoverState(original, { part }));
      const before = requests;
      const intent = {
        message: 'Export the original stored work.',
        request_id: id,
        ...(parent ? { continuation_id: parent } : { task: { domain: 'lyrics' } }),
      };
      const http = await nativeFetch(base + '/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(intent),
      });
      const raw = await http.text(),
        body = JSON.parse(raw);
      assert.equal(http.status, 200, raw.slice(0, 500));
      assert.equal(body.reply, expected);
      assert.equal(body.completion, null);
      assert.equal(body.stopped, 'RECOVERY_EXPORTED');
      assert.equal(requests, before + 1, 'no provider sees the recovered output');
      assert.ok(
        Buffer.byteLength(raw) < 4 * 1024 * 1024,
        'HTTP response fits the existing durable response cap'
      );
      const receipt = store.get(id);
      assert.equal(receipt.state, 'completed');
      assert.equal(receipt.response.body.reply, expected);
      assert.ok(
        Buffer.byteLength(JSON.stringify(receipt)) < 8 * 1024 * 1024,
        'complete receipt fits the existing record cap'
      );
      t.diagnostic(
        `${part}: HTTP ${Buffer.byteLength(raw)} bytes; durable receipt ${Buffer.byteLength(JSON.stringify(receipt))} bytes; exact export ${Buffer.byteLength(body.reply)} bytes`
      );
      const restarted = new JobStore(dir);
      assert.equal(
        restarted.get(id).response.body.reply,
        expected,
        'a fresh store reopens the exact durable export'
      );
      assert.equal(body.task.workflow.started, null);
      assert.deepEqual(body.task.completedSteps, []);
      parent = id;
    }
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('recipe task excludes lyric instructions and declarations and rejects wrong-family dispatch', async () => {
  const bodies = [];
  let executed = 0;
  globalThis.fetch = async (_url, req) => {
    bodies.push(JSON.parse(req.body));
    return bodies.length === 1
      ? response([fc('lyric_revise')])
      : response([{ text: 'fabricated song' }]);
  };
  try {
    const out = await runTurn({
      ...opts,
      task: task('recipe'),
      callTool: async () => {
        executed++;
        return {};
      },
    });
    assert.equal(executed, 0);
    assert.match(out.calls[0].error, /outside the active recipe task/);
    for (const body of bodies) {
      const text = body.systemInstruction.parts[0].text;
      assert.doesNotMatch(text, /Lyrics instructions|Nothing skips a step|sweep, then screen/);
      assert.ok(body.tools[0].functionDeclarations.every((d) => !d.name.startsWith('lyric_')));
    }
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('certified delivery uses the exact authoritative artifact and binds full draft digest', async () => {
  const draft = ['I love you, still.', 'I love you now.'];
  const text = '[VERSE]\n' + draft.join('\n') + '\n[FINISHED]';
  let count = 0;
  globalThis.fetch = async () =>
    ++count === 1
      ? response([fc('lyric_revise', { seed: 16, draft })])
      : response([{ text: 'Ungraded replacement' }]);
  try {
    const out = await runTurn({
      ...opts,
      task: task('lyrics'),
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              exit_code: 0,
              certified: true,
              status: 'finished_clean',
              presentation_text: text,
              final_draft: draft,
              draft_fp: '123456789a',
              final_draft_sha256: sha(JSON.stringify(draft)),
            }),
          },
        ],
      }),
    });
    assert.equal(count, 1, 'no model gets to replace the completed deliverable');
    assert.equal(out.reply, text);
    assert.equal(out.stopped, null);
    assert.equal(out.completion.delivery_sha256, sha(text));
    assert.equal(out.completion.final_draft_sha256, sha(JSON.stringify(draft)));
    assert.equal(out.artifact.final_draft_sha256, out.completion.final_draft_sha256);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('parked verdict defeats a later model finished claim and a later request cannot reuse an old pass', async () => {
  let count = 0;
  globalThis.fetch = async () =>
    ++count === 1
      ? response([fc('lyric_revise', { seed: 16, draft: ['old'] })])
      : response([{ text: 'Finished and fully verified: changed words' }]);
  try {
    const out = await runTurn({
      ...opts,
      task: task('lyrics'),
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              exit_code: 3,
              certified: false,
              status: 'parked',
              presentation_text: '[VERSE]\nold',
              final_draft: ['old'],
            }),
          },
        ],
      }),
    });
    assert.equal(out.reply, '[VERSE]\nold');
    assert.equal(out.stopped, 'LYRICS_UNFINISHED');
    assert.equal(out.completion, null);
    const previous = {
      ...task('lyrics'),
      artifact: {
        text: 'prior song',
        final_draft: ['prior song'],
        certified: true,
        draft_fp: '123',
        status: 'finished_clean',
      },
    };
    globalThis.fetch = async () => response([{ text: 'I made your changes.' }]);
    const changed = await runTurn({ ...opts, task: previous, userText: 'Change every line.' });
    assert.equal(changed.completion, null);
    assert.equal(changed.artifact.certified, false);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('missing, blocked, empty and malformed candidates never persist an empty model turn', async () => {
  try {
    for (const json of [
      { promptFeedback: { blockReason: 'SAFETY' } },
      { candidates: [] },
      { candidates: [{}] },
      { candidates: [{ content: { parts: [] } }] },
      { candidates: [{ content: { parts: [null, {}] } }] },
      { candidates: [{ finishReason: 'MALFORMED_FUNCTION_CALL', content: { parts: [] } }] },
    ]) {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ...json, usageMetadata }),
      });
      const out = await runTurn({ ...opts, task: task('lyrics') });
      assert.ok(out.stopped);
      assert.equal(out.completion, null);
      assert.ok(out.history.every((c) => c.role !== 'model' || c.parts.length > 0));
    }
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('canonical brief, accepted instructions, current plan and step history survive pruning', async () => {
  const t = {
    ...task('lyrics'),
    turns: 20,
    instructions: ['Keep the man deeply in love.'],
    plan: { id: 'unique-plan', detail: 'only plan' },
    completedSteps: ['lyric_sweep', 'lyric_screen', 'lyric_plan'],
  };
  const history = [
    { role: 'user', parts: [{ text: 'original' }] },
    { role: 'model', parts: [{ text: 'x'.repeat(220000) }] },
    { role: 'user', parts: [{ text: 'continue' }] },
    { role: 'model', parts: [{ text: 'recent' }] },
  ];
  let body;
  globalThis.fetch = async (_url, req) => {
    body = JSON.parse(req.body);
    return response([{ text: 'working' }]);
  };
  try {
    const out = await runTurn({
      ...opts,
      task: t,
      history,
      userText: 'Continue.',
      limits: { ...opts.limits, pruneFolded: true, pruneKeepTurns: 1, pruneMaxBytes: 200000 },
    });
    assert.equal(out.task.turns, 21);
    assert.ok(JSON.stringify(out.history).length < 200000);
    const system = body.systemInstruction.parts[0].text;
    for (const kept of [t.brief, 'Keep the man deeply in love.', 'unique-plan', 'only plan'])
      assert.ok(system.includes(kept));
    assert.doesNotMatch(system, /has not yet called lyric_sweep/);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('quota retries do not consume transient retries in a mixed response sequence', async () => {
  const statuses = [429, 429, 503, 503, 200];
  let requests = 0;
  globalThis.fetch = async () => {
    const status = statuses[requests++];
    return status === 200
      ? response([{ text: 'done' }])
      : {
          ok: false,
          status,
          headers: { get: () => '0' },
          json: async () => ({ error: { message: 'busy' } }),
        };
  };
  try {
    const out = await runTurn({
      ...opts,
      retries: 3,
      retryStatuses: [500, 502, 503],
      rateLimit: { retries: 2, backoffMs: [0, 0], maxTotalWaitMs: 0 },
    });
    assert.equal(requests, 5);
    assert.equal(out.reply, 'done');
    assert.equal(out.usage.retries, 4);
    assert.equal(out.usage.providerAttempts, 5);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('per-run admission lock and revisions reject simultaneous and stale operations; input identity is immutable', () => {
  const store = new RunStore();
  const rec = store.put('seed:16', {
    run_id: 'run_fixture',
    status: 'suspended',
    draft: ['original'],
    replay_draft: ['original'],
    decl: declarationsOf({ seed: 16, max_rounds: 8, attempts: 1, backtrack: 1 }),
  });
  const release = store.acquire(rec.run_id);
  assert.equal(typeof release, 'function');
  assert.equal(store.acquire(rec.run_id), null);
  assert.match(runRefusal(rec, { run_revision: 0 }), /stale/);
  assert.match(runRefusal(rec, {}), /run_revision is required/);
  assert.match(
    runRefusal(rec, { run_revision: 1, draft: ['replacement'] }),
    /original replay draft/
  );
  assert.equal(runRefusal(rec, { run_revision: 1, draft: ['original'] }), null);
  assert.equal(movedDeclarations(rec.decl, { attempts: 2 })[0].field, 'attempts');
  assert.equal(movedDeclarations(rec.decl, { fallback: 'high' })[0].field, 'fallback');
  release();
  assert.equal(typeof store.acquire(rec.run_id), 'function');
  assert.equal(store.put('seed:16', rec).revision, 2);
});

test('run cache pressure cannot evict an active record or reuse an earlier revision', () => {
  const store = new RunStore({ cap: 1 });
  let rec = store.put('seed:1', { status: 'suspended', draft: ['original'] });
  rec = store.put('seed:1', { ...rec, draft: ['accepted'] });
  assert.equal(rec.revision, 2);
  const release = store.acquire(rec.run_id);
  try {
    store.put('seed:2', { draft: ['another run'] });
    assert.equal(store.size(), 1, 'pressure still respects the cache count bound');
    assert.equal(store.byId(rec.run_id), rec, 'the active operation retains its record');
    const completed = store.put('seed:1', { ...rec, draft: ['next accepted'] });
    assert.equal(completed.revision, 3);
    assert.match(runRefusal(completed, { run_revision: 1 }), /stale/);
    assert.match(runRefusal(completed, { run_revision: 2 }), /stale/);
  } finally {
    release();
  }
  store.put('seed:3', { draft: ['later run'] });
  assert.equal(store.byId(rec.run_id), null, 'released records remain normally evictable');
});

test('run TTL cannot erase an in-flight revision but still expires released records', () => {
  let now = 0;
  const store = new RunStore({ ttlMs: 10, now: () => now });
  let rec = store.put('seed:1', { status: 'suspended', draft: ['original'] });
  rec = store.put('seed:1', rec);
  const release = store.acquire(rec.run_id);
  try {
    now = 11;
    assert.equal(store.byId(rec.run_id), rec);
    const completed = store.put('seed:1', { ...rec, draft: ['accepted after delay'] });
    assert.equal(completed.revision, 3);
    assert.match(runRefusal(completed, { run_revision: 1 }), /stale/);
  } finally {
    release();
  }
  now = 22;
  assert.equal(store.byId(rec.run_id), null);
});

test('largest carried ASCII, escaped and multibyte receipts complete durably without a global latch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-capacity-'));
  try {
    const store = new JobStore(dir);
    for (const text of ['x'.repeat(1410000), '"'.repeat(700000), '愛'.repeat(470000)]) {
      const request_id = crypto.randomBytes(32).toString('hex');
      const envelope = {
        history: [{ role: 'user', parts: [{ text }] }],
        workspace: null,
        sig: 'fixture',
      };
      store.begin(request_id, { request_id, message: 'continue', ...envelope });
      store.checkpoint(request_id, envelope);
      store.checkpoint(request_id, { accepted_lines: ['line'], journal: 'j'.repeat(500000) });
      store.complete(request_id, 200, { reply: 'complete', ...envelope });
      assert.equal(store.get(request_id).state, 'completed');
      assert.equal(store.failure, null);
    }
    const restarted = new JobStore(dir);
    assert.equal(restarted.records.size, 3);
    assert.equal(restarted.failure, null);
    const id = crypto.randomBytes(32).toString('hex');
    store.begin(id, { request_id: id, message: 'small' });
    let err;
    try {
      store.complete(id, 200, { reply: 'x'.repeat(4 * 1024 * 1024) });
    } catch (e) {
      err = e;
    }
    assert.equal(err.code, 'JOB_PAYLOAD_TOO_LARGE');
    store.failedCompletion(id, err);
    assert.equal(store.failure, null);
    assert.equal(store.get(id).state, 'interrupted');
    const next = crypto.randomBytes(32).toString('hex');
    assert.equal(store.begin(next, { request_id: next, message: 'another' }).created, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function browser(
  saved = new Map(),
  fetchImpl = async () => {
    throw Error('offline');
  }
) {
  const nodes = new Map();
  const element = () => ({
    children: [],
    hidden: false,
    value: '',
    innerHTML: '',
    disabled: false,
    classList: { toggle() {} },
    appendChild(n) {
      this.children.push(n);
    },
    addEventListener(name, fn) {
      this['on' + name] = fn;
    },
    focus() {},
    remove() {},
    get firstElementChild() {
      return element();
    },
  });
  for (const id of [
    'chat-log',
    'chat-panel',
    'chat-dock',
    'chat-input',
    'chat-send',
    'chat-domain',
  ])
    nodes.set(id, element());
  nodes.get('chat-domain').value = 'lyrics';
  const copied = [];
  const context = vm.createContext({
    window: {},
    document: { getElementById: (id) => nodes.get(id), createElement: element },
    localStorage: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) },
    crypto: crypto.webcrypto,
    Uint8Array,
    AbortController,
    Date,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    esc: String,
    RECIPE_CHAR_CEILING: 1000,
    copyToClipboard(text) {
      copied.push(text);
    },
  });
  const src = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  vm.runInContext(
    src.slice(src.indexOf('const CHAT_BACKEND ='), src.indexOf('// Reveal the dock')) +
      '\nglobalThis.ui={chatState,_chatSubmit,_chatReset,_chatRecover,_chatLoad,_chatReceive,_chatRenderReply};',
    context
  );
  return { ui: context.ui, nodes, saved, context, copied };
}

test('shipped UI exposes explicit lyric creation and pasted-edit task phases', async () => {
  for (const [choice, phase] of [
    ['lyrics', 'create'],
    ['lyrics-edit', 'edit'],
  ]) {
    let body;
    const b = browser(new Map(), async (_url, req) => {
      body = JSON.parse(req.body);
      return {
        json: async () => ({
          reply: 'working',
          history: [],
          workspace: null,
          sig: 'signed',
          task: { ...task('lyrics'), phase },
        }),
        headers: { get: () => null },
      };
    });
    b.nodes.get('chat-domain').value = choice;
    b.nodes.get('chat-input').value = 'Please work on these lyrics';
    await b.ui._chatSubmit({ preventDefault() {} });
    assert.deepEqual(body.task, { domain: 'lyrics', phase });
    assert.equal(b.nodes.get('chat-domain').value, choice);
  }
});

test('shipped UI stores a request capability before dispatch, recovers a lost response and preserves signed errors and pacing', async () => {
  const saved = new Map();
  let dispatched = 0,
    recovered = 0,
    id;
  const envelope = {
    history: [{ role: 'user', parts: [{ text: 'advanced' }] }],
    workspace: null,
    lyric: { state: 'saved' },
    task: task('lyrics'),
    sig: 'signed',
  };
  const b = browser(saved, async (url, req) => {
    if (req?.method === 'POST') {
      dispatched++;
      id = JSON.parse(req.body).request_id;
      assert.match(id, /^[a-f0-9]{64}$/);
      assert.ok([...saved.values()].some((v) => v.includes(id)));
      throw Error('524');
    }
    recovered++;
    assert.ok(url.endsWith('/' + id));
    return {
      ok: true,
      json: async () => ({
        state: 'completed',
        response: { body: { error: 'Wait', ...envelope }, headers: { 'retry-after': '120' } },
      }),
    };
  });
  b.nodes.get('chat-input').value = 'Write a new love song';
  await b.ui._chatSubmit({ preventDefault() {} });
  assert.equal(dispatched, 1);
  assert.equal(recovered, 1);
  assert.equal(b.ui.chatState.sig, 'signed');
  assert.equal(b.ui.chatState.pending, null);
  assert.ok(b.ui.chatState.retryAt > Date.now() + 119000);
  b.nodes.get('chat-input').value = 'Continue';
  await b.ui._chatSubmit({ preventDefault() {} });
  assert.equal(dispatched, 1);
});

test('shipped UI reload recovers pending work and Reset cannot resurrect a discarded conversation', async () => {
  const saved = new Map();
  let release;
  const first = browser(
    saved,
    async () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  first.nodes.get('chat-input').value = 'Start';
  const ongoing = first.ui._chatSubmit({ preventDefault() {} });
  const oldId = first.ui.chatState.pending.request_id;
  const restored = browser(saved, async (url) => {
    assert.ok(url.endsWith(oldId));
    return {
      ok: true,
      json: async () => ({
        state: 'completed',
        response: {
          body: {
            reply: 'exact',
            history: [],
            workspace: null,
            task: task('lyrics'),
            sig: 'restored',
          },
        },
      }),
    };
  });
  restored.ui._chatLoad();
  await restored.ui._chatRecover();
  assert.equal(restored.ui.chatState.sig, 'restored');
  first.ui._chatReset();
  release({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ reply: 'late', history: [], workspace: null, sig: 'old' }),
  });
  await ongoing;
  assert.equal(first.ui.chatState.sig, null);
  assert.equal(first.ui.chatState.pending, null);
  assert.equal(first.ui.chatState.archives[0].request_id, oldId);
  assert.equal(first.ui.chatState.busy, false);
});

test('shipped lyric display and Copy preserve the authoritative performance text and unfinished verdict', () => {
  const b = browser();
  const text = '[VERSE]\n  I love you.\n\nI still do.\n[UNFINISHED]';
  b.ui._chatRenderReply({
    reply: 'Fully finished, with different words',
    artifact: { text, status: 'parked', certified: false },
    completion: null,
  });
  const message = b.nodes.get('chat-log').children.at(-1);
  const box = message.children[0];
  assert.equal(box.children[0].textContent, 'Unfinished · parked');
  assert.equal(box.children[1].textContent, text);
  box.children[2].onclick();
  assert.equal(b.copied[0], text);
});

test('shipped recovery display and Copy preserve the exact export while retaining the live artifact', () => {
  for (const part of ['all', 'journal']) {
    const b = browser();
    const live = {
      text: 'Current accepted lyrics',
      final_draft: ['Current accepted lyrics'],
      certified: false,
    };
    const lyric = { run_id: 'current-live-run', draft: live.final_draft };
    const text =
      '  {"recovery_part":"' +
      part +
      '","journal":"\\n \\t <tag> &","next_recovery_part":"journal"}\n';
    const payload = {
      reply: text,
      stopped: 'RECOVERY_EXPORTED',
      completion: null,
      artifact: live,
      task: { ...task('lyrics'), artifact: live },
      lyric,
      history: [],
      workspace: null,
      sig: 'signed',
    };
    b.ui._chatReceive(payload);
    const box = b.nodes.get('chat-log').children.at(-1).children[0];
    assert.equal(box.children[0].textContent, 'Recovered export · not graded');
    assert.equal(box.children[1].textContent, text);
    assert.equal(box.children[2].textContent, 'Copy export');
    box.children[2].onclick();
    assert.equal(b.copied[0], text);
    assert.deepEqual(b.ui.chatState.task.artifact, live);
    assert.deepEqual(b.ui.chatState.lyric, lyric);
  }
});

test('actual chat admission keeps a signed turn counter even when history is pruned', async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const store = new JobStore();
  const makeServer = () => {
    const mcp = new McpServer({ name: 'chat-production-fixture', version: '1' }, { instructions });
    mcp.registerTool('lyric_types', { inputSchema: {} }, async () => ({
      content: [{ type: 'text', text: 'types' }],
    }));
    return mcp;
  };
  const router = await createChatRouter({
    buildServer: makeServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, maxTurns: 2, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 1, pruneMaxBytes: 1 },
  });
  app.use(createJobRouter({ store, recoverCheckpoint: (r) => router.recoverCheckpoint(r) }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/chat`;
  globalThis.fetch = async () => response([{ text: 'working' }]);
  const post = async (body) => {
    const res = await nativeFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    const invalid = await post({ message: 'brief', task: { domain: 'lyrics', phase: 'revise' } });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error, /create or edit/);
    const edit = await post({
      message: 'Edit my pasted lyrics',
      task: { domain: 'lyrics', phase: 'edit' },
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.task.phase, 'edit');
    let r = await post({ message: 'brief', task: { domain: 'lyrics' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.task.phase, 'create');
    assert.equal(r.body.task.turns, 1);
    const carry = (r) => ({
      history: r.history,
      workspace: r.workspace,
      task: r.task,
      sig: r.sig,
      ...(r.lyric ? { lyric: r.lyric } : {}),
    });
    r = await post({ message: 'continue', ...carry(r.body) });
    assert.equal(r.status, 200);
    assert.equal(r.body.task.turns, 2);
    assert.equal((await post({ message: 'continue', ...carry(r.body) })).status, 429);
    assert.equal(
      (
        await post({
          message: 'continue',
          ...carry(r.body),
          task: { ...r.body.task, domain: 'recipe' },
        })
      ).status,
      400
    );
    const id = crypto.randomBytes(32).toString('hex');
    store.begin(id, { request_id: id, message: 'resume' });
    store.checkpoint(id, { ...carry(r.body) });
    store.checkpoint(id, {
      version: 1,
      connector_semantic_identity: continuationSemanticIdentity(),
      status: 'accepted',
      input_draft: ['original'],
      accepted_lines: ['accepted'],
      answered: { q: 'accepted' },
      connector_declarations: { seed: 16, writer: 'kitchen' },
    });
    store.interrupt(id, 'process_restarted');
    const recovered = await (
      await nativeFetch(url.replace(/\/chat$/, '') + '/chat/jobs/' + id)
    ).json();
    assert.deepEqual(recovered.continuation.lyric.replay_draft, ['original']);
    assert.deepEqual(recovered.continuation.lyric.final_draft, ['accepted']);
    assert.equal(recovered.continuation.lyric.resumable, true);
    assert.equal(recovered.continuation.task.brief, 'brief');
    const uncertain = router.recoverCheckpoint({ ...store.get(id), uncertain_proposal: true });
    assert.equal(uncertain.lyric.resumable, false);
    assert.equal(uncertain.lyric.uncertain_proposal, true);
    for (const identity of [undefined, '0'.repeat(64)]) {
      assert.equal(
        router.recoverCheckpoint({
          ...store.get(id),
          progress: { ...store.get(id).progress, connector_semantic_identity: identity },
        }),
        null,
        'an old raw checkpoint cannot be stamped with current semantics'
      );
    }
    assert.equal(
      router.recoverCheckpoint({ ...store.get(id), checkpoint: { ...carry(r.body), sig: 'bad' } }),
      null
    );
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
  }
});

test('signed lyrics with missing or changed semantic identity refuse before any provider call', async () => {
  const fixtureSecret = 'offline-semantic-contract-test-key';
  const oldSecret = process.env.CHAT_SECRET;
  let create;
  try {
    process.env.CHAT_SECRET = fixtureSecret;
    create = (await import('./chat.js?semantic-identity-fixture')).createChatRouter;
  } finally {
    if (oldSecret === undefined) delete process.env.CHAT_SECRET;
    else process.env.CHAT_SECRET = oldSecret;
  }
  const makeServer = () => {
    const mcp = new McpServer({ name: 'semantic-fixture', version: '1' }, { instructions });
    mcp.registerTool('lyric_types', { inputSchema: {} }, async () => ({
      content: [{ type: 'text', text: 'types' }],
    }));
    return mcp;
  };
  const router = await create({
    buildServer: makeServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 1 },
  });
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return response([{ text: 'working' }]);
  };
  const post = async (body) => {
    const res = await nativeFetch(`http://127.0.0.1:${server.address().port}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    const fresh = await post({ message: 'new love song', task: { domain: 'lyrics' } });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.task.connector_semantic_identity, continuationSemanticIdentity());
    for (const identity of [undefined, '0'.repeat(64)]) {
      const envelope = { history: fresh.body.history, workspace: fresh.body.workspace };
      if (fresh.body.lyric != null) envelope.lyric = fresh.body.lyric;
      envelope.task = {
        ...fresh.body.task,
        connector_semantic_identity: identity,
        artifact: { final_draft: ['accepted original lyric'], certified: true },
      };
      const sig = crypto
        .createHmac('sha256', fixtureSecret)
        .update(JSON.stringify(envelope))
        .digest('hex');
      const refused = await post({ message: 'continue', ...envelope, sig });
      assert.equal(refused.status, 409);
      assert.equal(refused.body.code, 'CONTINUATION_MIGRATION_REQUIRED');
      assert.deepEqual(refused.body.artifact.final_draft, ['accepted original lyric']);
      assert.equal(refused.body.artifact.certified, false);
      assert.equal(router.recoverCheckpoint({ checkpoint: { ...envelope, sig } }), null);
    }
    assert.equal(requests, 1, 'only the fresh request can reach the provider');
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
  }
});

test('lyric output allowance is reserved at 32768 and truncation cannot certify a song', async () => {
  let body, reserved;
  const budget = {
    reserve: (opts) => {
      reserved = opts;
      return 'reservation';
    },
    settle() {},
    snapshot: () => ({ usd: 0, reservedUsd: 0, unknownUsd: 0 }),
  };
  globalThis.fetch = async (_url, request) => {
    body = JSON.parse(request.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        usageMetadata,
        candidates: [
          { finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'incomplete lyric' }] } },
        ],
      }),
    };
  };
  try {
    const out = await runTurn({ ...opts, task: task('lyrics'), budget });
    assert.equal(body.generationConfig.maxOutputTokens, 32768);
    assert.equal(reserved.maxOutputTokens, 32768);
    assert.equal(out.stopped, 'MAX_TOKENS');
    assert.equal(out.completion, null);
    assert.doesNotMatch(out.reply, /incomplete lyric/);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('recipe creation needs a successful customization; explicit browse can return a stock recipe', async () => {
  try {
    for (const browse of [false, true]) {
      let calls = 0;
      globalThis.fetch = async () =>
        ++calls === 1
          ? response([fc('start_recipe')])
          : response([{ text: 'Use the stock answer.' }]);
      const out = await runTurn({
        ...opts,
        task: {
          ...task('recipe'),
          requiresCustomization: !browse,
          phase: browse ? 'browse' : 'create',
        },
        callTool: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ recipe: 'Stock recipe', workspace: { cards: [] } }),
            },
          ],
        }),
      });
      assert.equal(out.reply === 'Stock recipe', browse);
      assert.equal(out.task.customized, false);
    }
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('durable continuation bypasses wire-size limits and admits exactly one successor', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-continuation-'));
  const store = new JobStore(dir);
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const makeServer = () => {
    const server = new McpServer({ name: 'continuation-fixture', version: '1' }, { instructions });
    server.registerTool('lyric_types', { inputSchema: {} }, async () => ({
      content: [{ type: 'text', text: 'types' }],
    }));
    return server;
  };
  const router = await createChatRouter({
    buildServer: makeServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, maxTurns: 50, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 1 },
  });
  app.use(createJobRouter({ store, recoverCheckpoint: (r) => router.recoverCheckpoint(r) }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let requests = 0;
  globalThis.fetch = async () =>
    response([{ text: ++requests === 1 ? 'x'.repeat(1600000) : 'working' }]);
  const post = async (body) => {
    const res = await nativeFetch(base + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    const parent = crypto.randomBytes(32).toString('hex');
    const initial = await post({
      message: 'brief',
      task: { domain: 'lyrics' },
      request_id: parent,
    });
    assert.equal(initial.status, 200);
    const full = {
      history: initial.body.history,
      workspace: initial.body.workspace,
      task: initial.body.task,
      sig: initial.body.sig,
    };
    assert.ok(Buffer.byteLength(JSON.stringify(full)) > CHAT_LIMITS.maxHistoryBytes);
    assert.equal((await post({ message: 'continue', ...full })).status, 413);
    const child = crypto.randomBytes(32).toString('hex');
    const next = await post({ message: 'continue', request_id: child, continuation_id: parent });
    assert.equal(next.status, 200);
    assert.equal(next.body.task.turns, 2);
    assert.equal(store.get(parent).successor_id, child);
    assert.equal(requests, 2);
    const duplicate = await post({
      message: 'continue',
      request_id: crypto.randomBytes(32).toString('hex'),
      continuation_id: parent,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'STALE_CONTINUATION');
    assert.equal(duplicate.body.successor_id, child);
    assert.equal(requests, 2);
    assert.equal(
      (
        await post({
          message: 'continue',
          request_id: crypto.randomBytes(32).toString('hex'),
          continuation_id: child,
          task: { domain: 'recipe' },
        })
      ).status,
      400
    );
    assert.equal(
      (
        await post({
          message: 'continue',
          request_id: crypto.randomBytes(32).toString('hex'),
          continuation_id: '0'.repeat(64),
        })
      ).status,
      409
    );
    // The real catch path returns signed fields at top level. The receipt
    // must remain usable even though the provider answered with a final error.
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      headers: new Headers(),
      text: async () => 'fixture provider rejected the turn',
    });
    const errorId = crypto.randomBytes(32).toString('hex');
    const failed = await post({ message: 'continue', request_id: errorId, continuation_id: child });
    assert.equal(failed.status, 502);
    assert.equal(typeof failed.body.sig, 'string');
    assert(Array.isArray(failed.body.history));
    assert.equal(failed.body.envelope, undefined);
    assert.equal(store.get(errorId).state, 'completed');
    globalThis.fetch = async () => response([{ text: 'continued safely after the error' }]);
    const resumedId = crypto.randomBytes(32).toString('hex');
    const resumed = await post({
      message: 'continue',
      request_id: resumedId,
      continuation_id: errorId,
    });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.task.brief, 'brief');
    assert.equal(resumed.body.task.turns, failed.body.task.turns + 1);
    assert.equal(store.get(errorId).successor_id, resumedId);
    const restarted = new JobStore(dir);
    assert.equal(restarted.get(parent).successor_id, child);
    assert.equal(restarted.get(child).response.body.task.brief, 'brief');
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
