// A page review with no declared pattern ends after one answered check.
// Review mode pins every lyric_check to the page's declarations; with no
// scheme, no groups and no returns the tool refuses each call, and a model
// that kept retrying spent one paid hop per refusal (a Library reading arrives
// with no declarations). The request goes through actual HTTP -> /chat ->
// runTurn -> MCP -> the Python kitchen, with a scripted outer model that keeps
// calling lyric_check. Nothing leaves 127.0.0.1.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { LIMITS } from './gemini_agent.js';
import { buildServer } from './tools.js';
import { _workerInternals } from './lyric_tools.js';

const lines = [
  'The evening wind returns the song',
  'It carries every hour along',
  'The river keeps the colour grey',
  'And night is slower than the day',
];
const document = `[VERSE]\n${lines.join('\n')}`;
const binding = { document_sha256: 'a'.repeat(64), context_sha256: 'b'.repeat(64) };
const context = (declarations) => ({
  version: 1,
  intent: 'review',
  document,
  declarations,
  brief: '',
  notes: [],
  binding,
});

const nativeFetch = globalThis.fetch;
// Every tool call the host actually dispatched to the MCP server.
const dispatched = [];
class SpyClient extends Client {
  async callTool(params, ...rest) {
    dispatched.push(params?.name);
    return super.callTool(params, ...rest);
  }
}
// The scripted outer model: lyric_recover, then lyric_check (two at once on
// the second hop). `persistent` keeps calling lyric_check on every later hop
// and never answers in text; otherwise the third hop answers.
let modelRequests = 0;
let persistent = true;
let server, base;

before(async () => {
  const router = await createChatRouter({
    buildServer,
    Client: SpyClient,
    InMemoryTransport,
    apiKey: 'offline-review-mandate-fixture',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 8 },
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
    const hop = modelRequests++;
    const call = (name) => ({ functionCall: { name, args: { lines: ['MODEL GUESS'] } } });
    const parts =
      hop === 0
        ? [call('lyric_recover')]
        : hop === 1
          ? [call('lyric_check'), call('lyric_check')]
          : persistent
            ? [call('lyric_check')]
            : [{ text: 'Review reported.' }];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 20, thoughtsTokenCount: 0 },
      }),
    };
  };
});

after(() => {
  globalThis.fetch = nativeFetch;
  _workerInternals.kill();
  server?.close();
  server?.closeAllConnections();
});

async function review(declarations, { keepCalling = true } = {}) {
  dispatched.length = 0;
  modelRequests = 0;
  persistent = keepCalling;
  const http = await nativeFetch(base + '/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Review the committed document in the page context.',
      task: { domain: 'lyrics', phase: 'edit' },
      lyric_context: context(declarations),
    }),
  });
  const body = await http.json();
  assert.equal(http.status, 200, JSON.stringify(body).slice(0, 2000));
  return { body, dispatched: [...dispatched], hops: modelRequests };
}

test('a review with no declared pattern answers one check, dispatches none and ends the turn', async () => {
  const { body, dispatched, hops } = await review({});
  assert.deepEqual(dispatched, ['lyric_recover'], 'recovery ran and no lyric_check was dispatched');
  const checks = body.tools.filter((t) => t.name === 'lyric_check');
  assert.equal(checks.length, 1, 'one lyric_check row for the two the model asked for');
  assert.equal(checks[0].not_run, true);
  assert.match(checks[0].error, /No rhyme groups or returns are declared/);
  const recover = body.tools.find((t) => t.name === 'lyric_recover');
  assert.ok(recover && !recover.isError && !recover.error, 'lyric_recover ran normally');
  assert.equal(hops, 2, 'no outer-model hop after the refused check');
  assert.equal(body.assessment.status, 'input');
  assert.equal(body.assessment.certified, false);
  const mandate = body.assessment.coverage.obligations.find((o) => o.id === 'declaration:mandate');
  assert.equal(mandate?.status, 'refused');
  assert.match(mandate.reason, /declare them to check/);
  assert.match(body.reply, /Review needs input/);
  assert.equal(body.artifact, null);
  assert.equal(body.completion, null);
  assert.equal(body.stopped, null);
});

test('a review with declared groups still dispatches its lyric_check', async () => {
  const { body, dispatched } = await review({ groups: '1,2;3,4' }, { keepCalling: false });
  assert.equal(dispatched[0], 'lyric_recover');
  assert.ok(dispatched.includes('lyric_check'), 'lyric_check was dispatched');
  const checks = body.tools.filter((t) => t.name === 'lyric_check');
  assert.ok(checks.length >= 1 && checks.every((t) => t.not_run !== true));
  assert.ok(
    !(body.assessment?.coverage?.obligations || []).some((o) => o.id === 'declaration:mandate'),
    'no missing-declaration obligation when a pattern is declared'
  );
  assert.ok(['assessed_clear', 'assessed_findings', 'input'].includes(body.assessment?.status));
});
