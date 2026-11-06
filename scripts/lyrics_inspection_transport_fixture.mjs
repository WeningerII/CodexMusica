// Offline test helper: real local tool/agent/HTTP path; only model tool choice is stubbed.
// Neither report evidence nor request_binding is manufactured or changed here.
// The page's Run review is review-only (#636): the agent accepts lyric_recover,
// then lyric_check, and builds both calls' arguments from the signed page
// context. The stub therefore asks for recover, then check (with the
// scenario's own arguments, which the agent must discard), then stops.
//
// Receipts (#668 6672431561 §1 and §3, 6672462725), opt-in with `jobs: true`:
// as in production (mcp/server_http.js), a real JobStore and createJobRouter
// are mounted BEFORE the chat router, the setup mcp/test_chat_production.mjs
// already uses. A POST carrying a request_id is then recorded by the job router
// itself, and GET /chat/jobs/<id> serves that stored receipt unchanged. Nothing
// here writes, edits, delays or resets a receipt.
// The default stays `jobs: false`, the topology the other importers were
// written against: check_lyrics_inspection.js posts `fixture-...` request ids,
// which the real job router refuses (400) as not 64 hex characters. With jobs
// off, GET /chat/jobs/<id> is not served at all, which is also the control
// that withholds every receipt. `requests` is an observation-only log of what
// reached the backend, in both modes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { buildServer } from '../mcp/tools.js';
import { createChatRouter, CHAT_LIMITS } from '../mcp/chat.js';
import { LIMITS } from '../mcp/gemini_agent.js';
import { JobStore, createJobRouter } from '../mcp/job_store.js';
const requireMcp = createRequire(new URL('../mcp/package.json', import.meta.url));
const express = requireMcp('express');
const { Client } = requireMcp('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = requireMcp('@modelcontextprotocol/sdk/inMemory.js');
// Release a listening server and a job directory. Every step runs even when an
// earlier one fails, and the failures are returned, never swallowed: a close
// callback's error, a synchronous throw from server.close() and a failed
// directory removal are each reported to the caller.
async function releaseResources(server, dir) {
  const errors = [];
  if (server) {
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      errors.push(error);
    }
  }
  if (dir) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

export async function createOfflineChat({ args, jobs = false } = {}) {
  const nativeFetch = globalThis.fetch;
  let selectedArgs = args;
  let hop = 0;
  const requests = [];
  const router = await createChatRouter({
    buildServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline-fixture',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 3, maxTurnMs: 120000 },
  });
  // The job directory is allocated only once the router exists, and any later
  // startup failure releases it: a caller that never receives close() must not
  // be left holding a temporary directory or a listening socket.
  let dir = null;
  let store = null;
  let server = null;
  try {
    if (jobs) {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyrics-inspection-jobs-'));
      store = new JobStore(dir);
    }
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use((req, _res, next) => {
      requests.push({
        method: req.method,
        path: req.path,
        request_id: typeof req.body?.request_id === 'string' ? req.body.request_id : null,
      });
      next();
    });
    if (store)
      app.use(createJobRouter({ store, recoverCheckpoint: (r) => router.recoverCheckpoint(r) }));
    app.use(router);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
  } catch (error) {
    // The startup error stays the one thrown; a cleanup failure is attached to
    // it rather than replacing it.
    const cleanup = await releaseResources(server?.listening ? server : null, dir);
    if (cleanup.length && error && typeof error === 'object') error.cleanupErrors = cleanup;
    throw error;
  }
  const url = `http://127.0.0.1:${server.address().port}`;
  let closing = null;
  const turn = [
    () => ({ functionCall: { name: 'lyric_recover', args: {} } }),
    () => ({ functionCall: { name: 'lyric_check', args: selectedArgs } }),
  ];
  globalThis.fetch = async () => {
    const part = (turn[hop++] || (() => ({ text: 'Review done.' })))();
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [part] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    };
  };
  return {
    url,
    setArgs(next) {
      selectedArgs = next;
      hop = 0;
    },
    fetch: nativeFetch,
    requests,
    store,
    // Idempotent: a second call returns the first call's outcome. One cleanup
    // failure is thrown as itself; several are thrown together.
    close() {
      closing ??= (async () => {
        globalThis.fetch = nativeFetch;
        const errors = await releaseResources(server, dir);
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, 'offline chat teardown failed');
      })();
      return closing;
    },
  };
}
