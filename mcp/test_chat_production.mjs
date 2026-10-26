import assert from 'node:assert/strict';
import { test } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import { runTurn, LIMITS, buildSurface } from './gemini_agent.js';
import { JobStore, createJobRouter } from './job_store.js';
import { RunStore, declarationsOf, movedDeclarations, runRefusal } from './run_store.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { continuationSemanticIdentity, recoverState, STATE_DECODED_BYTES } from './state_codec.js';
import { buildServer as buildRealServer } from './tools.js';
import { RUNS, _verdictInternals } from './lyric_tools.js';

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
  fixture.lyric_result.schema_instance_evidence = {
    version: 1,
    identity: { hash: 'report-fixture', source_sha256: sha('cat cat') },
    source_text: 'cat cat',
    coverage: { complete: false, status: 'partial', omitted_records: 2 },
    records: Array.from({ length: 70 }, (_, i) => ({
      id: `instance:${i}`,
      schema_name: 'perfect rhyme',
      verdict: 'undecided',
      a: { source_ranges: [{ utf16_range: [0, 3], precision: 'exact' }] },
      b: { source_ranges: [{ utf16_range: [4, 7], precision: 'exact' }] },
    })),
  };
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
      'schema_instance_evidence',
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
        Buffer.byteLength(raw) < 9 * 1024 * 1024,
        'HTTP response fits the existing durable response cap'
      );
      const receipt = store.get(id);
      assert.equal(receipt.state, 'completed');
      assert.equal(receipt.response.body.reply, expected);
      assert.ok(
        Buffer.byteLength(JSON.stringify(receipt)) < 18 * 1024 * 1024,
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

test('a lyrics task carries the page context: validated, signed into the task, shown to the writer apart from the rules, refused beside an envelope; the receipt has a progress view', async () => {
  const { lyricContext, lyricContextText } = await import('./task_contract.js');
  const { progressView } = await import('./job_store.js');
  const document =
    '[SETUP — title — Porch Light]\n\n[VERSE — 2 lines — 6/8]\nI leave the porch light on\nFor you to find your way';
  const context = {
    version: 1,
    document,
    declarations: { title: 'Porch Light' },
    brief: 'A love ballad to a city that let me go.',
    notes: [{ section: 'Verse 1', note: 'Arrival and kindness' }],
    binding: { document_sha256: 'a'.repeat(64), context_sha256: 'b'.repeat(64) },
  };
  // The validator refuses what it cannot hold exactly.
  assert.deepEqual(lyricContext(context).notes, context.notes);
  for (const bad of [
    { ...context, version: 2 },
    { ...context, document: 7 },
    { ...context, brief: 'x'.repeat(4001) },
    { ...context, notes: [{ section: '', note: 'n' }] },
    { ...context, notes: [{ section: 'Verse 1', note: 'x'.repeat(401) }] },
    { ...context, binding: { document_sha256: 'short' } },
    { ...context, extra: true },
  ])
    assert.throws(() => lyricContext(bad), /lyric_context/);
  const text = lyricContextText(lyricContext(context));
  assert.ok(text.indexOf('CREATIVE GUIDANCE') < text.indexOf('THE COMMITTED DOCUMENT'));
  assert.ok(text.includes(document), 'the document reaches the writer exactly');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-lyric-context-'));
  const store = new JobStore(dir);
  const router = await createChatRouter({
    buildServer: buildRealServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 2 },
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(createJobRouter({ store, recoverCheckpoint: (r) => router.recoverCheckpoint(r) }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const systems = [];
  globalThis.fetch = async (_url, init) => {
    const sent = JSON.parse(init.body);
    systems.push(sent.systemInstruction?.parts?.map((p) => p.text).join('\n') || '');
    return response([{ text: 'Reviewed.' }]);
  };
  const post = (body) =>
    nativeFetch(base + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    const status = await (await nativeFetch(base + '/chat/status')).json();
    assert.equal(status.lyricContextVersion, 1);
    assert.equal(status.progressView, true);
    const id = crypto.randomBytes(32).toString('hex');
    const res = await post({
      message: 'Review the draft in the page context.',
      request_id: id,
      task: { domain: 'lyrics', phase: 'edit' },
      lyric_context: context,
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
    assert.deepEqual(body.task.lyric_context, lyricContext(context), 'held in the signed task');
    assert.ok(systems[0].includes('PAGE CONTEXT'), 'the writer is shown the page context');
    assert.ok(systems[0].includes(document));
    assert.ok(
      !/ACTIVE TASK[^\n]*lyric_context/.test(systems[0]),
      'the context is its own block, not repeated inside the task JSON'
    );
    const refused = await post({
      message: 'Swap the context.',
      request_id: crypto.randomBytes(32).toString('hex'),
      history: body.history,
      workspace: body.workspace,
      task: body.task,
      sig: body.sig,
      lyric_context: { ...context, brief: 'Something else.' },
    });
    assert.equal(refused.status, 400);
    assert.equal((await refused.json()).code, 'LYRIC_CONTEXT');
    const view = await (await nativeFetch(`${base}/chat/jobs/${id}?view=progress`)).json();
    assert.equal(view.view, 'progress');
    assert.equal(view.state, 'completed');
    assert.equal(view.stage, 'finished');
    assert.equal(view.response, undefined, 'the progress view is never the result');
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // Stages read off a receipt that is still running.
  const running = (history, progress = null) =>
    progressView({
      request_id: 'c'.repeat(64),
      state: 'pending',
      created_at: 1,
      updated_at: 2,
      checkpoint: { history },
      progress,
    });
  const call = (name) => ({ role: 'model', parts: [{ functionCall: { name, args: {} } }] });
  assert.equal(running([]).stage, null);
  assert.equal(running([call('lyric_sweep'), call('lyric_screen')]).stage, 'planning');
  assert.equal(running([call('lyric_plan')]).stage, 'drafting');
  assert.equal(running([call('lyric_plan'), call('lyric_grade')]).stage, 'checking');
  const kitchen = running([call('lyric_revise')], {
    status: 'proposing',
    round: 2,
    accepted_lines: ['a', 'b'],
  });
  assert.deepEqual([kitchen.stage, kitchen.round, kitchen.accepted_lines], ['revising', 2, 2]);
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

test('a recipe task offers no format, the host format is the one sent, and a wrong-family refusal names the next step', async () => {
  // The real connector declares `format` on the recipe tools; the shared test
  // surface does not, so this one does, or the absence would prove nothing.
  const fmt = { type: 'string', enum: ['rich', 'tags', 'prose', 'compact'] };
  const withFormat = {
    ...surface,
    declarations: surface.declarations.map((d) =>
      d.name === 'start_recipe'
        ? {
            ...d,
            parameters: {
              type: 'object',
              properties: { traditions: { type: 'array' }, format: fmt },
              required: ['traditions', 'format'],
            },
          }
        : d
    ),
  };
  const bodies = [];
  const sent = [];
  globalThis.fetch = async (_url, req) => {
    bodies.push(JSON.parse(req.body));
    if (bodies.length === 1)
      return response([
        fc('lyric_revise'),
        fc('start_recipe', { traditions: ['x'], format: 'prose' }),
      ]);
    return response([{ text: 'done' }]);
  };
  try {
    const out = await runTurn({
      ...opts,
      surface: withFormat,
      task: { ...task('recipe'), format: 'tags' },
      callTool: async (name, args) => {
        sent.push([name, args.format]);
        return {
          content: [
            { type: 'text', text: JSON.stringify({ recipe: 'r', workspace: { cards: [1] } }) },
          ],
        };
      },
    });
    const start = bodies[0].tools[0].functionDeclarations.find((d) => d.name === 'start_recipe');
    assert.ok(start && !('format' in start.parameters.properties), 'format is not offered');
    assert.deepEqual(start.parameters.required, ['traditions']);
    assert.ok('traditions' in start.parameters.properties, 'the other fields stay');
    assert.deepEqual(
      sent,
      [['start_recipe', 'tags']],
      "the host's format, not 'rich' or the model's"
    );
    // The model asked for prose anyway: it is told which format it got, inside
    // the one JSON payload, so the workspace is still stripped from what it reads.
    const told = bodies[1].contents
      .flatMap((c) => c.parts || [])
      .find((p) => p.functionResponse?.name === 'start_recipe')?.functionResponse.response;
    assert.match(
      told?.format_note || '',
      /format "prose" is not offered in this chat; the recipe was rendered tags/
    );
    assert.equal(told.recipe, 'r');
    assert.ok(!('workspace' in told) && !('presentation' in told), 'still the one-payload path');
    const refusal = out.calls.find((c) => c.name === 'lyric_revise').error;
    assert.match(refusal, /outside the active recipe task\. This task's tools are start_recipe;/);
    assert.match(refusal, /lyrics need a Lyrics task, which the user starts\./);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('a lyrics task refusing a recipe tool names its own tools and the Recipe task', async () => {
  let count = 0;
  globalThis.fetch = async () =>
    ++count === 1 ? response([fc('start_recipe')]) : response([{ text: 'ok' }]);
  try {
    const out = await runTurn({ ...opts, task: task('lyrics') });
    const refusal = out.calls[0].error;
    assert.match(refusal, /outside the active lyrics task\. This task's tools are lyric_/);
    assert.doesNotMatch(refusal, /tools are[^;]*start_recipe/);
    assert.match(refusal, /a recipe needs a Recipe task, which the user starts\./);
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

test('an unfinished grade reaches the page as its rendered song and title; a later attempt with no draft keeps it', async () => {
  const draft = ['I leave the porch light on', 'For you to find your way'];
  const render = '[VERSE — 2 lines — 2 bars of 6/8]\n' + draft.join('\n');
  const stamp = '[GRADED — seed 16 — exit 3, coverage complete — 0 banned pair(s)]';
  const graded = {
    content: [
      { type: 'text', text: `${render}\n\n${stamp}` },
      {
        type: 'text',
        text: JSON.stringify({
          exit_code: 3,
          certified: false,
          measurement_status: 'graded',
          status: 'graded',
          final_draft: draft,
          final_draft_sha256: sha(JSON.stringify(draft)),
        }),
      },
    ],
  };
  const calls = [
    fc('lyric_grade', { seed: 16, title: 'Porch Light', draft }),
    fc('lyric_revise', { seed: 16, draft }),
    { text: 'The revision failed.' },
  ];
  let count = 0;
  globalThis.fetch = async () => response([calls[Math.min(count++, calls.length - 1)]]);
  try {
    const out = await runTurn({
      ...opts,
      surface: {
        ...surface,
        declarations: [...surface.declarations, { name: 'lyric_grade', parameters: {} }],
      },
      limits: { ...opts.limits, maxSteps: 4 },
      task: task('lyrics'),
      callTool: async (name) =>
        name === 'lyric_grade'
          ? graded
          : { isError: true, content: [{ type: 'text', text: 'KITCHEN: the proposer failed' }] },
    });
    assert.equal(out.artifact.text, `${render}\n\n${stamp}`, 'the song under its headers, stamped');
    assert.equal(out.artifact.title, 'Porch Light', 'the title the run declared travels with it');
    assert.deepEqual(out.artifact.final_draft, draft, 'the accepted draft survives the failure');
    assert.equal(out.artifact.certified, false);
    assert.equal(out.artifact.interim, true);
    assert.equal(out.artifact.last_attempt.tool, 'lyric_revise');
    assert.match(out.artifact.last_attempt.error, /proposer failed/);
    assert.equal(out.completion, null);
    assert.equal(
      out.reply,
      'This song has no certified final deliverable yet.',
      'an interim render is never the delivered song'
    );
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
    assert.doesNotMatch(system, /no successful lyric_sweep/);
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
      const finished = { ...envelope, lyric: { final_draft: ['line'] } };
      store.checkpoint(request_id, { ...finished, worker_progress_superseded: true });
      store.complete(request_id, 200, { reply: 'complete', ...finished });
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
      store.complete(id, 200, { reply: 'x'.repeat(9 * 1024 * 1024) }); // RESPONSE_BYTES, ~~4~~ 9 MiB since 2026-10-04
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
    const resumed = await post({ message: 'continue', ...recovered.continuation });
    assert.equal(resumed.status, 429, JSON.stringify(resumed.body));
    assert.doesNotMatch(resumed.body.error, /could not be verified/);
    const viaReceipt = await post({
      message: 'continue',
      continuation_id: id,
      request_id: crypto.randomBytes(32).toString('hex'),
    });
    assert.equal(viaReceipt.status, 429, JSON.stringify(viaReceipt.body));
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

test('every tool call a recipe turn builds carries only the arguments its tool declares', async () => {
  // The connector refuses an argument a tool does not declare (guardEditKeys).
  // The chat once stamped format: 'rich' on EVERY recipe-turn call, so each
  // search_catalog and search_prefaces was refused and the turn found no
  // tradition (BB8, #519). Driven through the chat's own real server and
  // live surface, every call the turn builds is checked against the schema.
  const server = buildRealServer({ kitchen: true });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'declared-args', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const live = await buildSurface(client);
  const declared = new Map(
    live.tools.map((t) => [t.name, new Set(Object.keys(t.inputSchema?.properties || {}))])
  );
  const sent = [];
  globalThis.fetch = async (_url, request) => {
    const hop = JSON.parse(request.body).contents.length;
    return response(
      hop <= 1
        ? [
            fc('search_catalog', { query: 'bluegrass' }),
            fc('search_prefaces', { query: 'haunting' }),
            fc('start_recipe', { traditions: ['bluegrass'] }),
          ]
        : [{ text: 'Done.' }]
    );
  };
  try {
    await runTurn({
      ...opts,
      surface: live,
      task: task('recipe'),
      userText: 'A haunting bluegrass recipe.',
      limits: { ...LIMITS, maxSteps: 3, maxTurnMs: 20000, maxTurnUsd: 0 },
      callTool: async (name, args) => {
        const result = await client.callTool({ name, arguments: args });
        sent.push({ name, keys: Object.keys(args), refused: !!result.isError });
        return result;
      },
    });
  } finally {
    globalThis.fetch = nativeFetch;
    await client.close();
  }
  assert.deepEqual(
    sent.map((c) => c.name),
    ['search_catalog', 'search_prefaces', 'start_recipe'],
    'the turn made every call it was given'
  );
  for (const c of sent) {
    assert.deepEqual(
      c.keys.filter((k) => !declared.get(c.name).has(k)),
      [],
      `${c.name} was sent only arguments it declares`
    );
    assert.equal(c.refused, false, `${c.name} was not refused`);
  }
  assert.ok(
    sent.find((c) => c.name === 'start_recipe').keys.includes('format'),
    "a tool that declares format still gets the turn's Rich"
  );
});

test('every tool family the chat calls is sent only declared arguments, its own injections included', async () => {
  // The recipe turn above covers format. This drives every other family the
  // chat's server exposes (lookups, recipe edits, each lyric verb) and a
  // lyric_revise that continues a carried run, so the run's state, run id,
  // revision, draft, declarations and the kitchen writer the chat adds all
  // pass through the connector's unknown-argument guard. A tool may still
  // refuse on its merits (a fabricated state, an offline writer); what may
  // never happen is an input refusal for an argument the chat put there.
  const server = buildRealServer({ kitchen: true });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'declared-args', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const live = await buildSurface(client);
  const declared = new Map(
    live.tools.map((t) => [t.name, new Set(Object.keys(t.inputSchema?.properties || {}))])
  );
  const draft = ['the porch light burns', 'for no one home tonight'];
  const turns = [
    {
      domain: 'recipe',
      calls: [
        fc('get_tradition', { id: 'bluegrass' }),
        fc('get_instrument', { id: 'banjo_5_string' }),
        fc('list_traditions', { query: 'blues', limit: 3 }),
        fc('list_options', { kind: 'rooms' }),
        fc('start_recipe', { traditions: ['bluegrass'] }),
        fc('render_recipe', {}),
        fc('edit_recipe', { edits: [{ action: 'set_environment', room: 'stone_cathedral' }] }),
      ],
    },
    {
      domain: 'lyrics',
      calls: [
        fc('lyric_types', { word_a: 'night', word_b: 'light' }),
        fc('lyric_check', { lines_text: draft.join('\n') }),
        fc('lyric_recover', { lines_text: draft.join('\n') }),
        fc('lyric_verify', { before_text: draft.join('\n'), after_text: draft.join('\n') }),
        fc('lyric_grade', { seed: 16, title: 'Porch Light', draft_text: draft.join('\n') }),
        fc('lyric_revise', { seed: 16, answer: 'keep it' }),
      ],
      lyric: {
        seed: 16,
        state: 'not-a-real-state',
        run_id: 'run_' + 'a'.repeat(64),
        run_revision: 1,
        draft,
        decl: {
          writer: 'kitchen',
          form: 'verse-chorus',
          voices: false,
          seed: 16,
          title: 'Porch Light',
        },
      },
    },
  ];
  const sent = [];
  try {
    for (const turn of turns) {
      let hop = 0;
      globalThis.fetch = async () => response(hop++ === 0 ? turn.calls : [{ text: 'Done.' }]);
      await runTurn({
        ...opts,
        surface: live,
        writer: 'kitchen',
        task: task(turn.domain),
        lyric: turn.lyric,
        userText: 'Every family.',
        limits: { ...LIMITS, maxSteps: 2, maxTurnMs: 120000, maxTurnUsd: 0 },
        callTool: async (name, args) => {
          const result = await client.callTool({ name, arguments: args });
          const text = (result.content || []).map((b) => b.text || '').join(' ');
          sent.push({
            name,
            keys: Object.keys(args),
            inputRefused: /Unknown argument|Input validation error|Invalid arguments/.test(text),
            text: text.slice(0, 200),
          });
          return result;
        },
      });
    }
  } finally {
    globalThis.fetch = nativeFetch;
    await client.close();
  }
  const called = new Set(sent.map((c) => c.name));
  for (const turn of turns)
    for (const c of turn.calls)
      assert.ok(called.has(c.functionCall.name), `${c.functionCall.name} reached the connector`);
  for (const c of sent) {
    assert.deepEqual(
      c.keys.filter((k) => !declared.get(c.name).has(k)),
      [],
      `${c.name} was sent only arguments it declares`
    );
    assert.equal(c.inputRefused, false, `${c.name} was not refused for its input: ${c.text}`);
  }
  const revise = sent.find((c) => c.name === 'lyric_revise');
  for (const k of ['run_id', 'run_revision', 'writer', 'draft', 'title'])
    assert.ok(revise.keys.includes(k), `the chat's own ${k} reached lyric_revise`);
});

test('a recipe turn the step limit ends reaches the page as the recipe it reached, and continues', async () => {
  // The owner's report, end to end through /chat and the real connector: a
  // model that only searches used every hop and the page showed "No
  // customized Rich recipe has been produced yet." The live chat declares no
  // step limit; this turn declares one, since the mock never stops. Every hop
  // runs normally, and when the declared count ends the turn the SERVER seeds
  // the recipe from the tradition its own search found — delivered in
  // `recipe`, with the workspace the page's "Use recipe" button needs and a
  // note saying what it is.
  const router = await createChatRouter({
    buildServer: buildRealServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 4 },
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const post = async (body) => {
    const res = await nativeFetch(`http://127.0.0.1:${server.address().port}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const bodies = [];
  let script = () => [];
  globalThis.fetch = async (_url, request) => {
    const body = JSON.parse(request.body);
    bodies.push(body);
    return response(script(body, bodies.length - 1));
  };
  try {
    script = (_body, hop) =>
      hop === 0
        ? [
            fc('search_catalog', { query: 'delta blues' }),
            fc('search_prefaces', { query: 'brooding' }),
          ]
        : [fc('search_prefaces', { query: 'hushed intimate' })];
    const first = await post({
      message: 'Folk gospel with deep delta blues, intimate low male voice with preacher-like hush',
      task: { domain: 'recipe' },
    });
    assert.equal(first.status, 200);
    const p = first.body;
    assert.equal(bodies.length, 4, 'every declared hop was taken');
    assert.deepEqual(
      bodies.map((b) => b.toolConfig.functionCallingConfig.mode),
      ['AUTO', 'AUTO', 'AUTO', 'AUTO'],
      'no hop is restricted'
    );
    assert.equal(bodies[3].toolConfig.functionCallingConfig.allowedFunctionNames, undefined);
    assert.equal(p.stopped, 'MAX_STEPS');
    assert.equal(typeof p.recipe, 'string');
    assert.equal(p.reply, p.recipe);
    assert.ok(p.recipe.length > 0 && p.recipe.length <= 1000);
    assert.notEqual(p.reply, 'No customized Rich recipe has been produced yet.');
    // Catalog additions can change tied search hits; the finish must use the
    // highest-scored tradition actually returned, preserving result order on ties.
    const search = bodies[1].contents
      .flatMap((c) => c.parts)
      .find((part) => part.functionResponse?.name === 'search_catalog')?.functionResponse.response;
    const hits = search?.items?.filter((item) => item.type === 'tradition') ?? [];
    assert.ok(hits.length > 0, 'the executed search returned traditions to seed');
    const best = hits.reduce((first, hit) => (hit.matched > first.matched ? hit : first));
    assert.deepEqual(p.stopped_detail.finish, {
      by: 'server',
      action: 'seed',
      tradition: best.id,
      applied: false,
      customized: false,
    });
    assert.match(p.stopped_detail.note, /^Reached the step limit before a recipe was started/);
    assert.equal(p.stopped_detail.maxSteps, 4);
    const last = p.tools.at(-1);
    assert.equal(last.name, 'start_recipe');
    assert.equal(last.by_server, true);
    assert.equal(last.error, null);
    assert.ok(p.tools.slice(0, -1).every((t) => t.by_server === false));
    assert.deepEqual(
      p.tools.filter((t) => t.not_run).map((t) => t.name),
      [],
      'no search was refused'
    );
    assert.ok(Array.isArray(p.cards) && p.cards.length > 0);
    assert.ok(Array.isArray(p.workspace?.cards) && p.workspace.cards.length > 0);
    assert.ok(p.workspace.cards.every((card) => card.traditionId === best.id));
    assert.equal(p.task.customized, false);

    // The signed envelope carries the seeded workspace: the next message edits it.
    const brooding = p.tools.find((t) => t.name === 'search_prefaces' && !t.not_run);
    assert.ok(brooding, 'the first hop searched prefaces');
    bodies.length = 0;
    script = (_body, hop) =>
      hop === 0
        ? [
            fc('edit_recipe', {
              edits: [{ action: 'set_preface', card: 'voice', preface: 'brooding' }],
            }),
          ]
        : [{ text: 'Done.' }];
    const next = await post({
      message: 'Make the voice brooding.',
      history: p.history,
      workspace: p.workspace,
      task: p.task,
      sig: p.sig,
    });
    assert.equal(next.status, 200);
    assert.ok(
      bodies[0].contents.some(
        (c) => c.role === 'model' && c.parts.some((part) => part.text?.includes(p.recipe))
      ),
      "the model's next turn is told what the user received"
    );
    assert.equal(next.body.stopped, null);
    assert.equal(next.body.task.customized, true);
    assert.equal(next.body.reply, next.body.recipe);
    assert.notEqual(next.body.recipe, p.recipe);
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise((resolve) => server.close(resolve));
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

test('a screen and a grade hand the lyrics page their options: pair verdicts and dictionary readings, bounded and by shape', async () => {
  const { _agentInternals: AI } = await import('./gemini_agent.js');
  const pairs = Array.from({ length: 70 }, (_, i) => ({
    a: 'rain',
    b: `w${i}`,
    codes: i === 0 ? ['HOMEOTELEUTON'] : [],
    refused: i === 1,
    reason: i === 1 ? 'no reading' : null,
    relations: ['RHYME'],
    coarse_relations: ['RHYME'],
    score: 0.5,
    extra: 'dropped',
  }));
  const row = AI.loopFields({
    exit_code: 0,
    pairs,
    pronunciation_options: {
      items: [
        {
          line: 'I read the letter',
          token: 2,
          word: 'read',
          matching_lines: [3],
          dictionary_readings: [
            { phones: ['R', 'IY1', 'D'], stress: [1], syllables: 1 },
            { phones: ['R', 'EH1', 'D'], stress: [1], syllables: 1 },
          ],
          supplied_reading_requires_source: false,
        },
      ],
      total: 9,
      truncated: false,
      scope: 'refused_lines',
    },
  });
  assert.equal(row.pairs.length, 66);
  assert.deepEqual(row.pairs[0].codes, ['HOMEOTELEUTON']);
  assert.equal(row.pairs[1].refused, true);
  assert.equal(row.pairs[1].reason, 'no reading');
  assert.ok(!('extra' in row.pairs[0]) && !('coarse_relations' in row.pairs[0]));
  assert.equal(row.pronunciation_options.items[0].word, 'read');
  assert.deepEqual(row.pronunciation_options.items[0].dictionary_readings[1].phones, [
    'R',
    'EH1',
    'D',
  ]);
  assert.equal(row.pronunciation_options.total, 9);
  assert.equal(row.pronunciation_options.scope, 'refused_lines');
  const bare = AI.loopFields(null);
  assert.equal(bare.pairs, null);
  assert.equal(bare.pronunciation_options, null);
});

test('schema occurrence evidence requires an authenticated result, not prose or checkpoint data', () => {
  const evidence = { version: 1, records: [], coverage: { complete: false, status: 'partial' } };
  const raw = {
    code: 0,
    stdout: 'lyric result: ' + JSON.stringify({ version: 1, schema_instance_evidence: evidence }),
    checkpoint: { schema_instance_evidence: evidence },
  };
  assert.equal(_verdictInternals.verdictOf(raw).schema_instance_evidence, undefined);
  const trusted = {
    ...raw,
    lyric_result: { version: 1, status: 'graded', schema_instance_evidence: evidence },
  };
  assert.deepEqual(_verdictInternals.verdictOf(trusted).schema_instance_evidence, evidence);
  trusted.lyric_result.schema_instance_evidence.version = 2;
  assert.equal(_verdictInternals.verdictOf(trusted).schema_instance_evidence, undefined);
});

test('a newer signed tool result supersedes worker progress across durable restart', async () => {
  const { CONNECTOR_CONTRACT_VERSION } = await import('./contract_version.js');
  const secret = 'checkpoint-order-fixture-secret';
  const previous = process.env.CHAT_SECRET;
  let makeRouter;
  try {
    process.env.CHAT_SECRET = secret;
    makeRouter = (await import('./chat.js?checkpoint-order-fixture')).createChatRouter;
  } finally {
    if (previous === undefined) delete process.env.CHAT_SECRET;
    else process.env.CHAT_SECRET = previous;
  }
  const router = await makeRouter({
    buildServer: () => {
      const server = new McpServer({ name: 'checkpoint-order', version: '1' }, { instructions });
      server.registerTool('lyric_types', { inputSchema: {} }, async () => ({ content: [] }));
      return server;
    },
    Client,
    InMemoryTransport,
    apiKey: 'offline',
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-order-'));
  const progress = (status) => ({
    version: 1,
    connector_semantic_identity: continuationSemanticIdentity(),
    status,
    input_draft: ['original'],
    accepted_lines: ['earlier worker draft'],
    answered: { q: 'earlier worker draft' },
    connector_declarations: { seed: 16, writer: 'kitchen' },
  });
  try {
    for (const state of ['finished_clean', 'parked']) {
      for (const workerStatus of ['accepted', 'finished', 'proposing']) {
        let store = new JobStore(directory);
        const id = crypto.randomBytes(32).toString('hex');
        store.begin(id, { request_id: id, message: 'revise' });
        store.checkpoint(id, progress(workerStatus));
        const envelope = {
          history: [
            {
              role: 'user',
              parts: [
                {
                  functionResponse: {
                    name: 'lyric_revise',
                    response: { status: state, final_draft: ['final tool draft'] },
                  },
                },
              ],
            },
          ],
          workspace: null,
          lyric: { resumable: false, status: state, final_draft: ['final tool draft'] },
          task: {
            ...task('lyrics'),
            version: CONNECTOR_CONTRACT_VERSION,
            connector_semantic_identity: continuationSemanticIdentity(),
            artifact: {
              status: state,
              certified: state === 'finished_clean',
              final_draft: ['final tool draft'],
            },
          },
        };
        const signed = {
          ...envelope,
          sig: crypto.createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex'),
        };
        // The signed checkpoint is written after the tool returned, before the
        // HTTP response is complete. Reopening simulates a crash in that gap.
        store.checkpoint(id, { ...signed, worker_progress_superseded: true });
        store = new JobStore(directory);
        const recovered = router.recoverCheckpoint(store.get(id));
        assert.deepEqual(recovered, signed, `${state} after ${workerStatus}`);
        assert.equal(store.get(id).uncertain_proposal, false);
      }
    }
    // Progress from a subsequent active tool still overrides its earlier
    // signed history and retains the genuinely newer accepted words.
    let store = new JobStore(directory);
    const id = crypto.randomBytes(32).toString('hex');
    store.begin(id, { request_id: id, message: 'revise again' });
    const envelope = {
      history: [],
      workspace: null,
      task: {
        ...task('lyrics'),
        version: CONNECTOR_CONTRACT_VERSION,
        connector_semantic_identity: continuationSemanticIdentity(),
      },
    };
    store.checkpoint(id, {
      ...envelope,
      sig: crypto.createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex'),
    });
    store.checkpoint(id, progress('accepted'));
    store = new JobStore(directory);
    const recovered = router.recoverCheckpoint(store.get(id));
    assert.deepEqual(recovered.lyric.final_draft, ['earlier worker draft']);
    assert.equal(recovered.lyric.resumable, true);
    assert.equal(recovered.task.artifact.status, 'interrupted');

    // THE RUN GOES ON (Jony's C1 crash test). The base envelope names run_c1 at
    // revision 1; the worker advanced it (the ledger says 3) and the process
    // died before the result was delivered. The recovered continuation keeps
    // the run and the ledger's revision, so it continues run_c1 rather than
    // opening a new anonymous run at revision 1, and revision 1 stays stale.
    const runId = 'run_c1_' + crypto.randomBytes(6).toString('hex');
    RUNS.ledger.mark(runId, 3);
    store = new JobStore(directory);
    const crashed = crypto.randomBytes(32).toString('hex');
    store.begin(crashed, { request_id: crashed, message: 'revise' });
    // Signed in the order the verifier rebuilds it: history, workspace, lyric, task.
    const named = {
      history: envelope.history,
      workspace: envelope.workspace,
      lyric: { run_id: runId, run_revision: 1, resumable: false },
      task: envelope.task,
    };
    store.checkpoint(crashed, {
      ...named,
      sig: crypto.createHmac('sha256', secret).update(JSON.stringify(named)).digest('hex'),
    });
    store.checkpoint(crashed, progress('accepted'));
    store = new JobStore(directory);
    const onward = router.recoverCheckpoint(store.get(crashed));
    assert.equal(onward.lyric.run_id, runId, 'the recovered call continues the same run');
    assert.equal(onward.lyric.run_revision, 3, "at the ledger's revision, not 1");
    assert.equal(
      runRefusal(
        null,
        { run_id: runId, run_revision: onward.lyric.run_revision },
        RUNS.mark(runId)
      ),
      null,
      'which the ledger accepts'
    );
    assert.match(
      runRefusal(null, { run_id: runId, run_revision: 1 }, RUNS.mark(runId)),
      /stale run revision 1; current revision is 3/,
      "while the base envelope's revision is still refused"
    );
    // A run the ledger has finished is not carried into a recovered call.
    RUNS.ledger.mark(runId, 3, true);
    assert.equal(router.recoverCheckpoint(store.get(crashed)).lyric.run_id, undefined);

    // RD1 (BB8): a pasted song's (unseeded) journal carries declarationsOf's
    // planner default form: 'verse-chorus'. Carried back, every revise from the
    // recovered continuation was refused as "form is a plan declaration …".
    // The recovered decl keeps the mandate and drops every plan-only field;
    // a seeded run keeps its plan.
    const pasted = crypto.randomBytes(32).toString('hex');
    store.begin(pasted, { request_id: pasted, message: 'revise' });
    store.checkpoint(pasted, {
      ...envelope,
      sig: crypto.createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex'),
    });
    store.checkpoint(pasted, {
      ...progress('accepted'),
      connector_declarations: {
        writer: 'kitchen',
        form: 'verse-chorus',
        voices: false,
        groups: '1,2',
        relation: 'class:RHYME',
      },
    });
    store = new JobStore(directory);
    const unseeded = router.recoverCheckpoint(store.get(pasted)).lyric;
    assert.ok(!('form' in unseeded.decl), 'no plan-only field on a pasted song');
    assert.equal(unseeded.decl.groups, '1,2', 'the mandate stays');
    assert.equal(unseeded.decl.relation, 'class:RHYME', 'and its relation');
    assert.equal(unseeded.key, 'mandate:[null,"1,2",null,"class:RHYME",null]');
    const planned = crypto.randomBytes(32).toString('hex');
    store.begin(planned, { request_id: planned, message: 'revise' });
    store.checkpoint(planned, {
      ...envelope,
      sig: crypto.createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex'),
    });
    store.checkpoint(planned, {
      ...progress('accepted'),
      connector_declarations: { seed: 16, writer: 'kitchen', form: 'verse-chorus' },
    });
    store = new JobStore(directory);
    assert.equal(router.recoverCheckpoint(store.get(planned)).lyric.decl.form, 'verse-chorus');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('only a returned revise result supersedes progress, not an error or unrelated tool', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-runner-'));
  try {
    for (const outcome of ['throw', 'error', 'returned']) {
      let store = new JobStore(directory);
      const id = crypto.randomBytes(32).toString('hex');
      store.begin(id, { request_id: id, message: 'revise' });
      const journal = {
        version: 1,
        status: 'accepted',
        input_draft: ['original'],
        accepted_lines: ['accepted worker words'],
        answered: { q: 'accepted worker words' },
        connector_declarations: { seed: 16, writer: 'kitchen' },
      };
      globalThis.fetch = async () =>
        response([fc('lyric_revise', { seed: 16, draft: ['original'] }), fc('lyric_types')]);
      const checkpoints = [];
      const calls = [];
      await runTurn({
        ...opts,
        task: task('lyrics'),
        surface: {
          ...surface,
          declarations: [
            ...surface.declarations,
            { name: 'lyric_types', parameters: { type: 'object', properties: {} } },
          ],
        },
        limits: { ...opts.limits, maxSteps: 1 },
        callTool: async (name) => {
          calls.push(name);
          if (name === 'lyric_types') return { content: [{ type: 'text', text: 'types' }] };
          store.checkpoint(id, journal);
          if (outcome === 'throw') throw new Error('transport lost after accepted progress');
          if (outcome === 'error')
            return {
              isError: true,
              content: [{ type: 'text', text: 'tool failed after progress' }],
            };
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  exit_code: 3,
                  status: 'parked',
                  final_draft: ['finished tool words'],
                  open: [1],
                }),
              },
            ],
          };
        },
        onCheckpoint: async (value) => {
          checkpoints.push(value.worker_progress_superseded);
          store.checkpoint(id, { ...value, sig: 'fixture' });
        },
      });
      assert.deepEqual(calls, ['lyric_revise', 'lyric_types']);
      assert.deepEqual(checkpoints, [outcome === 'returned', false]);
      store = new JobStore(directory);
      assert.deepEqual(store.get(id).progress, outcome === 'returned' ? null : journal);
    }
  } finally {
    globalThis.fetch = nativeFetch;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('normal chat completion retains an unfinished tool journal and directs explicit recovery', async () => {
  const { requestContext } = await import('./execution_context.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-unfinished-worker-'));
  const store = new JobStore(directory);
  let mode = 'accepted';
  let dispatches = 0;
  const router = await createChatRouter({
    buildServer: () => {
      const server = new McpServer({ name: 'unfinished-worker', version: '1' }, { instructions });
      server.registerTool('lyric_revise', { inputSchema: {} }, async () => {
        dispatches++;
        requestContext().onCheckpoint({
          version: 1,
          connector_semantic_identity:
            mode === 'invalid' ? '0'.repeat(64) : continuationSemanticIdentity(),
          status: mode === 'proposing' ? 'proposing' : 'accepted',
          input_draft: ['original'],
          accepted_lines: ['accepted worker words'],
          answered: { q: 'accepted worker words' },
          connector_declarations: { seed: 16, writer: 'kitchen' },
        });
        if (mode === 'returned')
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  exit_code: 3,
                  status: 'parked',
                  final_draft: ['final tool words'],
                  open: [1],
                }),
              },
            ],
          };
        throw new Error('transport lost after accepted progress');
      });
      return server;
    },
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 2 },
  });
  const app = express();
  app.use(express.json());
  app.use(
    createJobRouter({ store, recoverCheckpoint: (record) => router.recoverCheckpoint(record) })
  );
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = async (body) => {
    const response = await nativeFetch(url + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    for (mode of ['accepted', 'proposing', 'invalid', 'returned']) {
      let modelCalls = 0;
      globalThis.fetch = async () =>
        response(++modelCalls === 1 ? [fc('lyric_revise')] : [{ text: 'The outer turn stopped.' }]);
      const id = crypto.randomBytes(32).toString('hex');
      const input = {
        request_id: id,
        message: 'Edit these words',
        task: { domain: 'lyrics', phase: 'edit' },
      };
      const result = await post(input);
      assert.equal(result.status, mode === 'returned' ? 200 : 503, JSON.stringify(result.body));
      const record = store.get(id);
      assert.equal(store.failure, null);
      if (mode === 'returned') {
        assert.equal(record.state, 'completed');
        assert.equal(record.progress, null);
        assert.deepEqual(result.body.artifact.final_draft, ['final tool words']);
        continue;
      }
      assert.equal(record.state, 'interrupted');
      assert.deepEqual(result.body.progress.accepted_lines, ['accepted worker words']);
      assert.equal(result.body.interruption, 'worker_result_unavailable');
      assert.equal(typeof result.body.response.body.cost, 'number');
      assert.equal(result.body.response.body.tools[0].name, 'lyric_revise');
      assert.equal(
        new JobStore(directory).get(id).progress.accepted_lines[0],
        'accepted worker words'
      );
      if (mode === 'invalid') assert.equal(result.body.continuation, undefined);
      else {
        assert.deepEqual(result.body.continuation.lyric.final_draft, ['accepted worker words']);
        assert.equal(result.body.continuation.lyric.resumable, mode !== 'proposing');
        assert.equal(result.body.continuation.task.artifact.certified, false);
      }
      const before = dispatches;
      const retry = await post(input);
      assert.equal(retry.status, 409);
      assert.equal(dispatches, before, 'the same receipt cannot dispatch again');
      if (mode === 'accepted') {
        const continued = await post({
          request_id: crypto.randomBytes(32).toString('hex'),
          continuation_id: id,
          message: 'continue',
        });
        assert.equal(continued.status, 200, JSON.stringify(continued.body));
        assert.deepEqual(continued.body.lyric.final_draft, ['accepted worker words']);
        assert.equal(dispatches, before, 'outer reply does not replay the tool');
      }
      if (mode !== 'accepted') {
        const continued = await post({
          request_id: crypto.randomBytes(32).toString('hex'),
          continuation_id: id,
          message: 'continue',
        });
        assert.equal(continued.status, 409);
        assert.equal(dispatches, before, 'unsafe journals cannot authorize redispatch');
      }
    }
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('completion receipts survive stored continuation trimming and remain host-owned', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-repeat-receipts-'));
  const store = new JobStore(dir);
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  let dispatched = 0;
  const original = ['A synthetic first line', 'A synthetic second line'];
  const makeServer = () => {
    const mcp = new McpServer({ name: 'repeat-receipts', version: '1' }, { instructions });
    mcp.registerTool('lyric_revise', { inputSchema: {} }, async () => {
      dispatched++;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              exit_code: 3,
              status: 'stopped_with_open_lines',
              certified: false,
              final_draft: [original[0], 'An accepted synthetic change'],
              loop_unresolved_lines: [1],
            }),
          },
        ],
      };
    });
    return mcp;
  };
  const router = await createChatRouter({
    buildServer: makeServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 1, pruneMaxBytes: 1 },
  });
  app.use(createJobRouter({ store, recoverCheckpoint: (r) => router.recoverCheckpoint(r) }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/chat`;
  let revise = true;
  globalThis.fetch = async (_url, init) => {
    assert(
      !JSON.parse(init.body).systemInstruction.parts[0].text.includes('completed_revise_keys')
    );
    return response(
      revise
        ? [fc('lyric_revise', { draft: original, groups: '1,2' })]
        : [{ text: 'Discuss only.' }]
    );
  };
  const post = async (body) => {
    const r = await nativeFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    let id = crypto.randomBytes(32).toString('hex');
    let r = await post({
      message: 'Edit this draft',
      request_id: id,
      task: { domain: 'lyrics', phase: 'edit', completed_revise_keys: ['f'.repeat(32)] },
    });
    assert.equal(r.status, 200);
    assert.equal(dispatched, 1);
    assert.equal(r.body.task.completed_revise_keys.length, 1);
    assert.notEqual(
      r.body.task.completed_revise_keys[0],
      'f'.repeat(32),
      'unsigned metadata ignored'
    );
    const forged = {
      history: r.body.history,
      workspace: r.body.workspace,
      lyric: r.body.lyric,
      task: { ...r.body.task, completed_revise_keys: [] },
      sig: r.body.sig,
    };
    assert.equal((await post({ message: 'continue', ...forged })).status, 400);
    assert.equal(
      (
        await post({
          message: 'continue',
          continuation_id: id,
          request_id: crypto.randomBytes(32).toString('hex'),
          task: { completed_revise_keys: [] },
        })
      ).status,
      400
    );
    revise = false;
    for (let i = 0; i < 2; i++) {
      const child = crypto.randomBytes(32).toString('hex');
      r = await post({ message: 'Discuss only.', request_id: child, continuation_id: id });
      assert.equal(r.status, 200);
      id = child;
    }
    assert(!JSON.stringify(r.body.history).includes('repeat_key'), 'whole completion turn removed');
    assert.equal(r.body.task.completed_revise_keys.length, 1);
    revise = true;
    const child = crypto.randomBytes(32).toString('hex');
    r = await post({
      message: 'Continue without restarting.',
      request_id: child,
      continuation_id: id,
    });
    assert.equal(r.status, 200);
    assert.equal(dispatched, 1, 'stored continuation refuses the repeat before tool dispatch');
    assert(r.body.tools.some((row) => /^ALREADY_DONE/.test(row.error || '')));
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
