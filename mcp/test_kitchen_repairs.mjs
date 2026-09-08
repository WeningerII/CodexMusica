// Actual HTTP -> host -> MCP -> Python verifier -> durable receipt -> the
// production battery's repair numerator. Only localhost provider fixtures run.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { LIMITS } from './gemini_agent.js';
import { buildServer } from './tools.js';
import { JobStore, createJobRouter } from './job_store.js';
import { _workerInternals } from './lyric_tools.js';
import { acceptedRepairs } from '../scripts/battery_repairs.mjs';
import { completedArtifact } from '../scripts/battery_verdict.mjs';

const initial = [
  'The elephant elephant elephant elephant elephant elephant stove',
  'Your fingers brush my heavy coat',
];
const replacement = 'My kettle whistles by the stove';
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nativeFetch = globalThis.fetch;
const directory = mkdtempSync(join(tmpdir(), 'kitchen-repair-http-'));
const trace = [];
let mode = 'accepted',
  writerCalls = 0,
  chatCalls = 0;
const writer = createServer(async (request, response) => {
  for await (const chunk of request) void chunk;
  writerCalls++;
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: `LINE:${mode === 'accepted' ? replacement : initial[0]}` }] },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 10,
        thoughtsTokenCount: 0,
        totalTokenCount: 20,
      },
    })
  );
});
writer.listen(0, '127.0.0.1');
await once(writer, 'listening');
const configured = {
  GEMINI_API_KEY: 'offline-kitchen-repair-fixture',
  LYRIC_PROPOSER_MODEL: 'gemini-3.5-flash-lite',
  LYRIC_PROPOSER_API_BASE: `http://127.0.0.1:${writer.address().port}`,
};
const previous = Object.fromEntries(Object.keys(configured).map((key) => [key, process.env[key]]));
Object.assign(process.env, configured);
let server;
try {
  const store = new JobStore(directory);
  const router = await createChatRouter({
    buildServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline-kitchen-repair-fixture',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 1 },
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(
    createJobRouter({ store, recoverCheckpoint: (record) => router.recoverCheckpoint(record) })
  );
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (url, options) => {
    const address = new URL(url);
    if (address.hostname === '127.0.0.1') return nativeFetch(url, options);
    assert.equal(
      address.hostname,
      'generativelanguage.googleapis.com',
      'no external service is contacted'
    );
    chatCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'lyric_revise',
                    args: {
                      draft: initial,
                      groups: '1,2',
                      relation: 'class:ASSONANCE',
                      attempts: 1,
                      backtrack: 0,
                      max_rounds: 1,
                    },
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 20, thoughtsTokenCount: 0 },
      }),
    };
  };
  for (mode of ['accepted', 'noop']) {
    const requestId = randomBytes(32).toString('hex');
    const beforeCalls = writerCalls;
    const request = {
      request_id: requestId,
      task: { domain: 'lyrics', phase: 'edit' },
      message: `Revise this supplied two-line draft with groups 1,2 and class:ASSONANCE. Preserve the second line.\n${initial.join('\n')}`,
    };
    const http = await nativeFetch(base + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body = await http.json();
    trace.push({
      mode,
      request,
      http_status: http.status,
      body,
      writer_calls: writerCalls - beforeCalls,
    });
    assert.equal(http.status, 200, JSON.stringify(body));
    const call = body.tools.find((item) => item.name === 'lyric_revise');
    assert.ok(call, JSON.stringify(body));
    assert.equal(call.writer, 'kitchen');
    assert.equal(call.verified_outcomes_error, null, JSON.stringify(call));
    assert.ok(Array.isArray(call.verified_outcomes));
    assert.equal(call.verified_outcomes_draft_sha256, sha(call.final_draft));
    assert.ok(
      writerCalls > beforeCalls,
      'actual Python kitchen contacted only its localhost writer'
    );
    assert.equal(acceptedRepairs(body.tools), mode === 'accepted' ? 1 : 0);
    assert.equal(
      acceptedRepairs([...body.tools, ...body.tools]),
      mode === 'accepted' ? 1 : 0,
      'receipt replay cannot count twice'
    );
    if (mode === 'accepted') {
      assert.equal(call.status, 'finished_clean');
      assert.equal(body.artifact.status, 'finished_clean');
      assert.equal(body.lyric ?? null, null, 'a finished artifact leaves no parked repair');
      assert.ok(
        completedArtifact(body, http.status),
        'the real host completion is accepted by the battery'
      );
      for (const patch of [
        { version: body.task.version + 1 },
        { instructions: [...body.task.instructions, 'changed after delivery'] },
      ]) {
        assert.equal(
          completedArtifact({ ...body, task: { ...body.task, ...patch } }, http.status),
          null
        );
      }
      assert.deepEqual(call.final_draft, [replacement, initial[1]]);
      assert.ok(call.verified_outcomes.some((outcome) => outcome.accepted && outcome.applied));
    } else {
      assert.deepEqual(call.final_draft, initial);
      assert.ok(call.verified_outcomes.some((outcome) => outcome.accepted === false));
    }
    const stored = store.get(requestId);
    assert.equal(stored.state, 'completed');
    assert.deepEqual(
      stored.response.body.tools,
      body.tools,
      'durable receipt keeps exact authoritative outcomes'
    );
    const reopened = new JobStore(directory);
    assert.equal(
      acceptedRepairs(reopened.get(requestId).response.body.tools),
      mode === 'accepted' ? 1 : 0
    );
  }
  assert.equal(chatCalls, 2, 'one bounded host dispatch per independent repair fixture');
  console.log(
    'kitchen repair HTTP: accepted application=1, rejected noop=0, replay deduplication and durable receipt reopen passed (localhost providers only)'
  );
} finally {
  if (process.env.KITCHEN_REPAIR_TRACE)
    writeFileSync(resolve(process.env.KITCHEN_REPAIR_TRACE), JSON.stringify(trace, null, 2) + '\n');
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
  rmSync(directory, { recursive: true, force: true });
}
