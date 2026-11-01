// The repeat guard on the REAL kitchen (#519 follow-up). The kitchen tool
// attaches a checkpoint (and the interview a provenance state) to EVERY
// finished exit-0/exit-3 verdict, so a guard that read "finished" as "carries
// no continuation token" never recorded a completion: an identical fresh
// lyric_revise after a finished run was dispatched to the paid writer again.
// The guard's own suite (test_revise_repeat_guard.mjs) used fake verdicts with
// no checkpoint and could not see it. Here the request goes through actual
// HTTP -> /chat -> runTurn -> MCP -> the Python kitchen, with a scripted outer
// model and a localhost writer that counts its hits. Nothing leaves 127.0.0.1.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { LIMITS, runTurn, completedRevises, reviseRepeatKey } from './gemini_agent.js';
import { buildServer } from './tools.js';
import { _workerInternals } from './lyric_tools.js';

// The kitchen-repair fixture (test_kitchen_repairs.mjs): 'sink' breaks the
// declared assonance with 'coat'; the writer's 'stove' repairs it.
const initial = ['Your fingers brush my heavy coat', 'My kettle whistles by the sink'];
const replacement = 'My kettle whistles by the stove';
const repaired = [initial[0], replacement];
const decl = { groups: '1,2', relation: 'class:ASSONANCE' };
// Writer changes the song, clean stop at exit 0 with one writer hit.
const cleanArgs = { draft: initial, ...decl, attempts: 1, backtrack: 0, max_rounds: 1 };
// No writer budget: the loop stops with line 2 open (exit 3), no writer hit.
const parkedArgs = { draft: initial, ...decl, attempts: 0, backtrack: 0, max_rounds: 1 };
// An already-clean draft: exit 0 finished_clean with no writer hit.
const alreadyCleanArgs = { draft: repaired, ...decl, attempts: 0, backtrack: 0, max_rounds: 1 };

const nativeFetch = globalThis.fetch;
let writerHits = 0;
const writer = createServer(async (request, response) => {
  for await (const chunk of request) void chunk;
  writerHits++;
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: `LINE:${replacement}` }] }, finishReason: 'STOP' }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 10,
        thoughtsTokenCount: 0,
        totalTokenCount: 20,
      },
    })
  );
});
const configured = {
  GEMINI_API_KEY: 'offline-kitchen-finished-fixture',
  LYRIC_PROPOSER_MODEL: 'gemini-3.5-flash-lite',
};
const previous = Object.fromEntries(
  [...Object.keys(configured), 'LYRIC_PROPOSER_API_BASE'].map((key) => [key, process.env[key]])
);
let server, base;
// The MCP client /chat builds, spied: the raw tool results the host receives,
// before anything is withheld from the transcript.
const rawResults = [];
class SpyClient extends Client {
  async callTool(params, ...rest) {
    const result = await super.callTool(params, ...rest);
    if (params?.name === 'lyric_revise') rawResults.push(result);
    return result;
  }
}
const lastRawVerdict = () => {
  const blocks = rawResults.at(-1)?.content || [];
  return JSON.parse(blocks.at(-1).text);
};
// The scripted outer model: each hop pops the next function call, then
// answers in text. Every request body it receives is kept.
let script = [];
let modelText = 'done';
let modelRequests = [];
const usageMetadata = { promptTokenCount: 20, candidatesTokenCount: 20, thoughtsTokenCount: 0 };

before(async () => {
  writer.listen(0, '127.0.0.1');
  await once(writer, 'listening');
  Object.assign(process.env, configured, {
    LYRIC_PROPOSER_API_BASE: `http://127.0.0.1:${writer.address().port}`,
  });
  const router = await createChatRouter({
    buildServer,
    Client: SpyClient,
    InMemoryTransport,
    apiKey: configured.GEMINI_API_KEY,
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    // The DEFAULT turn limits, so the default prune (200,000 bytes, keep 1)
    // is the one that drops the completion turn.
    turnLimits: LIMITS,
  });
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (url, options) => {
    const address = new URL(url);
    if (address.hostname === '127.0.0.1') return nativeFetch(url, options);
    assert.equal(address.hostname, 'generativelanguage.googleapis.com', 'no external service');
    modelRequests.push(JSON.parse(options.body));
    const next = script.shift();
    const parts = next
      ? [{ functionCall: { name: 'lyric_revise', args: next } }]
      : [{ text: modelText }];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts }, finishReason: 'STOP' }],
        usageMetadata,
      }),
    };
  };
});

after(() => {
  globalThis.fetch = nativeFetch;
  _workerInternals.kill();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  server?.close();
  server?.closeAllConnections();
  writer.close();
  writer.closeAllConnections();
});

// One /chat turn. `prior` is the last response body (its signed envelope).
async function chat(message, { calls = [], text = 'done', prior = null } = {}) {
  script = calls.map((c) => structuredClone(c));
  modelText = text;
  modelRequests = [];
  const envelope = prior
    ? {
        history: prior.history,
        workspace: prior.workspace,
        task: prior.task,
        sig: prior.sig,
        ...(prior.lyric != null ? { lyric: prior.lyric } : {}),
      }
    : { task: { domain: 'lyrics', phase: 'edit' } };
  const sentHistory = JSON.stringify(envelope.history ?? []);
  const http = await nativeFetch(base + '/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, ...envelope }),
  });
  const body = await http.json();
  assert.equal(http.status, 200, JSON.stringify(body).slice(0, 2000));
  return { body, sentHistory, modelRequests: modelRequests.slice() };
}
const reviseRows = (body) => body.tools.filter((t) => t.name === 'lyric_revise');
const ask = `Revise this supplied two-line draft with groups 1,2 and class:ASSONANCE.\n${initial.join('\n')}`;

test('a finished_clean kitchen run the writer changed is not paid for again after its turn is trimmed', async () => {
  const hitsBefore = writerHits;
  const a = await chat(ask, { calls: [cleanArgs] });
  const [row] = reviseRows(a.body);
  assert.equal(row.not_run, false);
  assert.equal(row.writer, 'kitchen');
  assert.equal(row.exit_code, 0);
  assert.equal(row.status, 'finished_clean');
  assert.deepEqual(row.final_draft, repaired, 'the writer changed the song');
  assert.equal(writerHits - hitsBefore, 1, 'one writer hit');
  const fr = a.body.history
    .flatMap((c) => c.parts || [])
    .map((p) => p.functionResponse)
    .find((f) => f?.name === 'lyric_revise');
  const verdict = fr.response.verdict || fr.response;
  // The real verdict carried a checkpoint — the token the old rule read as
  // "not finished" — though the host withholds it from the history.
  assert.equal(typeof lastRawVerdict().checkpoint, 'string', 'the kitchen attached its checkpoint');
  assert.equal(verdict.checkpoint, undefined);
  const K = reviseRepeatKey('lyric_revise', { ...cleanArgs, writer: 'kitchen' });
  assert.deepEqual(a.body.task.completed_revise_keys, [K], 'the signed task retains K');
  assert.equal(verdict.repeat_key, K, 'the history result carries K');

  // Discussion only, under the default prune, until A's turn is dropped.
  let state = a.body;
  let dropped = false;
  for (let i = 0; i < 20 && !dropped; i++) {
    const next = await chat('Discuss only; do not run anything. ' + 'Context. '.repeat(400), {
      prior: state,
      text: 'Discussion only. '.repeat(3000),
    });
    assert.equal(reviseRows(next.body).length, 0);
    state = next.body;
    dropped = !JSON.stringify(state.history).includes(K);
  }
  assert(dropped, 'the default whole-turn trim dropped the completion turn');
  assert.deepEqual(state.task.completed_revise_keys, [K], 'the task still carries K');

  const usageBefore = writerHits;
  const repeat = await chat(ask, { prior: state, calls: [cleanArgs] });
  assert(!repeat.sentHistory.includes(K), 'no repeat_key or K in the history sent');
  assert(!repeat.sentHistory.includes('repeat_key'));
  for (const req of repeat.modelRequests)
    assert(!JSON.stringify(req.contents).includes('"repeat_key"'), 'none in the model request');
  const [refused] = reviseRows(repeat.body);
  assert.equal(refused.not_run, true);
  assert.equal(refused.refused_by_connector, true);
  assert.match(refused.error, /^ALREADY_DONE:/);
  assert(!refused.error.includes('(status'), 'task-only retention has no status');
  assert(!refused.error.includes('Its song:'), 'task-only retention has no song');
  assert.equal(repeat.body.usage.reviseDispatched, 0);
  assert.equal(repeat.body.usage.reviseRepeated, 1);
  assert.equal(writerHits, usageBefore, 'the writer was not asked again');

  // Control: an explicit new_run is never refused by the guard.
  const fresh = await chat(ask, { prior: repeat.body, calls: [{ ...cleanArgs, new_run: true }] });
  const [rerun] = reviseRows(fresh.body);
  assert.equal(rerun.not_run, false);
  assert.equal(rerun.refused_by_connector, false);
  assert.equal(fresh.body.usage.reviseDispatched, 1);
  assert.equal(writerHits - usageBefore, 1, 'the explicit new run reaches the writer');
});

test('a parked kitchen run (exit 3) records its key; the identical repeat is not dispatched', async () => {
  const hitsBefore = writerHits;
  const a = await chat(ask, { calls: [parkedArgs] });
  const [row] = reviseRows(a.body);
  assert.equal(row.exit_code, 3);
  assert.equal(row.status, 'stopped_with_open_lines');
  assert.equal(row.proposer_calls, 0);
  assert.equal(writerHits, hitsBefore);
  assert.equal(typeof lastRawVerdict().checkpoint, 'string', 'the parked verdict carries one too');
  const K = reviseRepeatKey('lyric_revise', { ...parkedArgs, writer: 'kitchen' });
  assert.deepEqual(a.body.task.completed_revise_keys, [K]);
  const done = completedRevises(a.body.history).get(K);
  assert.equal(done?.status, 'stopped_with_open_lines');
  assert.equal(done?.exit_code, 3);
  // The carried parked run refuses the unchanged draft first (wanderRefusal
  // runs before the repeat guard); either way nothing is dispatched.
  const repeat = await chat(ask, { prior: a.body, calls: [parkedArgs] });
  const [refused] = reviseRows(repeat.body);
  // A wander refusal is reported not_run:false (it never reached the guard's
  // own row shape) but refused_by_connector, and nothing is dispatched. It is
  // the parked guard, not the completion key, that answers here.
  assert.equal(refused.refused_by_connector, true);
  assert.match(refused.error, /^REFUSED by the connector: .*PARKED at exit 3/);
  assert.doesNotMatch(refused.error, /ALREADY_DONE/);
  assert.equal(repeat.body.usage.reviseDispatched, 0);
  assert.equal(writerHits, hitsBefore);
});

test('an already-clean draft (exit 0, no writer call) is answered ALREADY_DONE on repeat', async () => {
  const hitsBefore = writerHits;
  const a = await chat(ask, { calls: [alreadyCleanArgs] });
  const [row] = reviseRows(a.body);
  assert.equal(row.exit_code, 0);
  assert.equal(row.status, 'finished_clean');
  assert.deepEqual(row.final_draft, repaired);
  assert.equal(writerHits, hitsBefore, 'no writer call');
  assert.equal(typeof lastRawVerdict().checkpoint, 'string');
  assert.equal(a.body.lyric ?? null, null, 'nothing parked to intercept the repeat');
  const K = reviseRepeatKey('lyric_revise', { ...alreadyCleanArgs, writer: 'kitchen' });
  assert.deepEqual(a.body.task.completed_revise_keys, [K]);
  const repeat = await chat(ask, { prior: a.body, calls: [alreadyCleanArgs] });
  const [refused] = reviseRows(repeat.body);
  assert.equal(refused.not_run, true);
  assert.match(refused.error, /^ALREADY_DONE:.*\(status finished_clean, exit 0\)/);
  assert.equal(repeat.body.usage.reviseDispatched, 0);
  assert.equal(repeat.body.usage.reviseRepeated, 1);
});

// The controls on runTurn itself, with verdicts shaped as the real tool
// shapes them (a continuation token on every one).
const surface = {
  instructions: '=== RECIPE TASK === r === LYRICS TASK === l',
  declarations: [{ name: 'lyric_revise', parameters: { type: 'object', properties: {} } }],
  workspaceTools: new Set(),
  stateTools: new Set(['lyric_revise']),
};
async function fakeTurn(calls, tool, { priorTask = null } = {}) {
  let hop = 0;
  const sent = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async () => {
    const next = calls[hop++];
    const parts = next
      ? [{ functionCall: { name: 'lyric_revise', args: next } }]
      : [{ text: 'ok' }];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts }, finishReason: 'STOP' }],
        usageMetadata,
      }),
    };
  };
  try {
    const out = await runTurn({
      apiKey: 'offline',
      surface,
      userText: 'Revise this.',
      history: [],
      lyric: null,
      writer: 'kitchen',
      task: priorTask || {
        version: 2,
        domain: 'lyrics',
        format: 'rich',
        maxChars: 1000,
        brief: 'b',
        phase: 'edit',
        completedSteps: [],
        turns: 0,
      },
      limits: { ...LIMITS, maxSteps: 20, maxTurnMs: 30000, maxTurnUsd: 0 },
      callTool: async (_name, args) => {
        sent.push(structuredClone(args));
        const v = tool(args, sent.length);
        return v.isError ? v : { content: [{ type: 'text', text: JSON.stringify(v) }] };
      },
    });
    return { out, sent };
  } finally {
    globalThis.fetch = saved;
  }
}
const args = { draft: initial, ...decl };

test('mid-run, refused and capacity outcomes record no key even with a token', async () => {
  const outcomes = {
    awaiting_proposal: { exit_code: 4, status: 'awaiting_proposal', state: 's' },
    interrupted: { exit_code: 5, status: 'interrupted', checkpoint: 'c' },
    uncertain_proposal: { exit_code: 5, status: 'uncertain_proposal', checkpoint: 'c' },
    suspended: { exit_code: 4, status: 'suspended', state: 's' },
    journal_capacity: { exit_code: 0, status: 'journal_capacity', checkpoint: 'c' },
    journal_capacity_bare: { exit_code: 0, status: 'journal_capacity' },
    refused_exit2: { exit_code: 2, status: 'refused', checkpoint: 'c' },
    uncertified_exit2: { exit_code: 2, status: 'uncertified', checkpoint: 'c' },
    refused_exit2_bare: { exit_code: 2, status: 'refused' },
    uncertified_exit2_bare: { exit_code: 2, status: 'uncertified' },
    refused_before_work: { exit_code: 2, status: null, measurement_status: 'refused' },
    crashed_exit1_bare: { exit_code: 1, status: null },
  };
  for (const [label, v] of Object.entries(outcomes)) {
    const { out } = await fakeTurn([args], () => ({ ...v, final_draft: initial }));
    assert.equal(out.task.completed_revise_keys, undefined, `${label} records no key`);
    const stamped = JSON.stringify(out.history).includes('repeat_key');
    assert.equal(stamped, false, `${label} carries no repeat_key`);
  }
  const { out } = await fakeTurn([args], () => ({
    isError: true,
    content: [{ type: 'text', text: 'boom' }],
  }));
  assert.equal(out.task.completed_revise_keys, undefined, 'an error result records no key');
});

test('terminal outcomes with a token are done; continuations, recovery and new_run still run', async () => {
  for (const [exit_code, status] of [
    [0, 'finished_clean'],
    [0, 'uncertified'],
    [3, 'stopped_with_open_lines'],
    [3, 'stopped_with_whole_draft_flags'],
  ])
    for (const token of [{ checkpoint: 'c' }, { state: 's' }]) {
      const { out, sent } = await fakeTurn([args, args], () => ({
        exit_code,
        status,
        ...token,
        final_draft: repaired,
      }));
      assert.equal(sent.length, 1, `${status}+${Object.keys(token)[0]}: the repeat is not sent`);
      assert.equal(out.task.completed_revise_keys.length, 1);
      // An uncertified stop is carried as an uncertified run, whose own
      // refusal answers first; every other terminal stop is ALREADY_DONE.
      assert.match(
        out.calls[1].error,
        status === 'uncertified'
          ? /^REFUSED by the connector: The lyric_revise run is UNCERTIFIED/
          : new RegExp(`^ALREADY_DONE:.*status ${status}, exit ${exit_code}`)
      );
    }
  const finished = () => ({
    exit_code: 0,
    status: 'finished_clean',
    checkpoint: 'c',
    final_draft: repaired,
  });
  const { out, sent } = await fakeTurn(
    [
      args,
      { ...args, new_run: true },
      { ...args, checkpoint: 'c' },
      { recover_only: true, checkpoint: 'c' },
    ],
    finished
  );
  assert.equal(sent.length, 4, 'new_run, a checkpoint continuation and recovery all run');
  assert.equal(out.usage.reviseRepeated, 0);
  assert(out.calls.every((c) => !c.not_run));
});
