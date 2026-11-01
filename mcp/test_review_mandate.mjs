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
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { LIMITS } from './gemini_agent.js';
import { buildServer } from './tools.js';
import { _workerInternals } from './lyric_tools.js';

// The Lyrics page's own code (src/pages/lyrics.js in check_lyrics_page.js's
// unit context), so the /chat body this suite receives is read exactly as the
// page reads it.
const helper = path.resolve(import.meta.dirname, '../scripts/check_lyrics_page.js');
const helperSource = fs.readFileSync(helper, 'utf8');
const pageSandbox = {
  require: createRequire(helper),
  __dirname: path.dirname(helper),
  console,
  process,
  Buffer,
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(
  helperSource.slice(0, helperSource.lastIndexOf('(async () => {')) +
    '\nglobalThis.page = lyricsUnitContext();',
  pageSandbox,
  { filename: helper }
);
const pageRun = pageSandbox.page.run;
pageRun('globalThis.lyInspectionReceive=()=>{}; lyRefresh=()=>{}; lyFocusQuestionSoon=()=>{};');

const lines = [
  'The evening wind returns the song',
  'It carries every hour along',
  'The river keeps the colour grey',
  'And night is slower than the day',
];
const document = `[VERSE]\n${lines.join('\n')}`;
const binding = { document_sha256: 'a'.repeat(64), context_sha256: 'b'.repeat(64) };
// One sung line over the tools' 200-character limit: lyric_recover refuses it.
const unrecoverable = `[VERSE]\n${'la '.repeat(90)}and on`;
const context = (declarations, text = document) => ({
  version: 1,
  intent: 'review',
  document: text,
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
// The scripted outer model: hop N answers with script[N] (a list of tool
// names), or with the last entry when `repeat` is set, or else in text.
let modelRequests = 0;
let script = [];
let repeat = true;
// lyric_recover, then lyric_check (two at once), then lyric_check forever.
const STUBBORN = [['lyric_recover'], ['lyric_check', 'lyric_check'], ['lyric_check']];
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
    const names = script[hop] || (repeat ? script.at(-1) : null);
    const parts = names ? names.map(call) : [{ text: 'Review reported.' }];
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

async function review(
  declarations,
  { calls = STUBBORN, keepCalling = true, text = document } = {}
) {
  dispatched.length = 0;
  modelRequests = 0;
  script = calls;
  repeat = keepCalling;
  const http = await nativeFetch(base + '/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Review the committed document in the page context.',
      task: { domain: 'lyrics', phase: 'edit' },
      lyric_context: context(declarations, text),
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
  // The page reads that reply as needing input, with no failed check.
  const shown = pageRun(
    `LY.model=lyParse(__text); UI.lyricRequest={id:'review',text:__text}; lyReceive(__payload,{request_id:'review'}); ({state:lyAnalysis().state,items:lyRunChecks(LY.model).map((i)=>[i.tone,i.title,i.text])})`,
    { __text: document, __payload: body }
  );
  assert.equal(shown.state, 'input');
  assert.ok(
    !shown.items.some(([, title]) => /failed/.test(title)),
    `a failed item is shown: ${JSON.stringify(shown.items)}`
  );
  assert.ok(
    shown.items.some(
      ([tone, title, text]) =>
        tone === 'input' &&
        title === 'Not judged: declaration:mandate' &&
        /declare them to check/.test(text)
    ),
    `no input-needed item names the missing declaration: ${JSON.stringify(shown.items)}`
  );
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

// A review turn that cannot progress ends too, however the model repeats itself.
const checkRows = (body) => body.tools.filter((t) => t.name === 'lyric_check');
const incomplete = (body, hops) => {
  assert.equal(hops, 2, 'no outer-model hop after the second hop that made no progress');
  assert.ok(checkRows(body).length <= 1, 'at most one lyric_check row');
  assert.ok(checkRows(body).every((t) => t.not_run === true));
  assert.equal(body.assessment.status, 'failed');
  assert.equal(body.assessment.certified, false);
  assert.equal(body.artifact, null);
  assert.equal(body.stopped, null);
};

for (const [label, declarations] of [
  ['no declared pattern', {}],
  ['declared groups', { groups: '1,2;3,4' }],
])
  test(`a review (${label}) whose model keeps checking before recovery is bounded`, async () => {
    const { body, dispatched, hops } = await review(declarations, {
      calls: [['lyric_check', 'lyric_check']],
    });
    assert.deepEqual(dispatched, [], 'nothing was dispatched');
    incomplete(body, hops);
    assert.match(checkRows(body)[0].error, /recover the committed document, then check it/);
  });

test('a review whose recovery fails ends at the first check after it', async () => {
  const { body, dispatched, hops } = await review(
    { groups: '1,2' },
    { calls: [['lyric_recover'], ['lyric_check', 'lyric_check']], text: unrecoverable }
  );
  assert.deepEqual(dispatched, ['lyric_recover'], 'recovery ran; no lyric_check was dispatched');
  assert.ok(body.tools.find((t) => t.name === 'lyric_recover')?.error, 'recovery failed');
  incomplete(body, hops);
  assert.match(checkRows(body)[0].error, /could not be recovered/);
});

test('a review whose model keeps retrying a failing recovery is bounded', async () => {
  const { body, dispatched, hops } = await review(
    { groups: '1,2' },
    { calls: [['lyric_recover']], text: unrecoverable }
  );
  assert.deepEqual(dispatched, ['lyric_recover', 'lyric_recover']);
  incomplete(body, hops);
});

test('a premature check does not stop a review whose recovery then succeeds', async () => {
  const { body, dispatched } = await review(
    { groups: '1,2;3,4' },
    { calls: [['lyric_check'], ['lyric_recover'], ['lyric_check']], keepCalling: false }
  );
  assert.deepEqual(dispatched, ['lyric_recover', 'lyric_check']);
  assert.ok(
    checkRows(body).some((t) => t.not_run !== true),
    'the check after recovery ran'
  );
  assert.notEqual(body.assessment.status, 'failed');
});

for (const [label, declarations] of [
  ['a returns-only mandate', { returns: '1,3' }],
  ['a letter scheme', { scheme: 'AABB' }],
])
  test(`a review with ${label} dispatches its lyric_check`, async () => {
    const { body, dispatched } = await review(declarations, {
      calls: [['lyric_recover'], ['lyric_check']],
      keepCalling: false,
    });
    assert.deepEqual(dispatched, ['lyric_recover', 'lyric_check']);
    assert.ok(checkRows(body).length === 1 && checkRows(body)[0].not_run !== true);
    assert.ok(
      !(body.assessment?.coverage?.obligations || []).some((o) => o.id === 'declaration:mandate')
    );
  });

test('a review declaring a scheme and groups together answers one check and ends the turn', async () => {
  const { body, dispatched, hops } = await review({ scheme: 'AABB', groups: '1,2;3,4' });
  assert.deepEqual(dispatched, ['lyric_recover'], 'recovery ran and no lyric_check was dispatched');
  assert.equal(checkRows(body).length, 1);
  assert.equal(checkRows(body)[0].not_run, true);
  assert.match(checkRows(body)[0].error, /takes one or the other/);
  assert.equal(hops, 2, 'no outer-model hop after the refused check');
  assert.equal(body.assessment.status, 'input');
  const mandate = body.assessment.coverage.obligations.find((o) => o.id === 'declaration:mandate');
  assert.equal(mandate?.status, 'refused');
  assert.match(mandate.reason, /scheme and rhyme groups/);
  assert.match(body.reply, /both a rhyme scheme and rhyme groups/);
});
