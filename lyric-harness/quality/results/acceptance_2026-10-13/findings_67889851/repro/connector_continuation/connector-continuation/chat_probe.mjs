// BB8: the website chat's SIGNED continuation across the release. The model
// provider is stubbed (globalThis.fetch answers locally; nothing leaves the
// process except loopback to our own express listener).
// usage (CHAT_SECRET fixed by caller):
//   node --import ./nm_register.mjs chat_probe.mjs <tree> fresh <out.json>
//   node --import ./nm_register.mjs chat_probe.mjs <tree> continue <in.json> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';

const [tree, mode, file, out] = process.argv.slice(2);
const m = (f) => import(pathToFileURL(path.join(tree, 'mcp', f)).href);
const { createChatRouter, CHAT_LIMITS } = await m('chat.js');
const { LIMITS } = await m('gemini_agent.js');
const { continuationSemanticIdentity } = await m('state_codec.js');
const { buildServer } = await m('tools.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const express = (await import('express')).default;

const nativeFetch = globalThis.fetch;
let providerCalls = 0;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('http://127.0.0.1')) return nativeFetch(url, init);
  providerCalls++;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'working' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, thoughtsTokenCount: 0 },
    }),
  };
};
const router = await createChatRouter({
  buildServer,
  Client,
  InMemoryTransport,
  apiKey: 'offline',
  limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
  turnLimits: { ...LIMITS, maxSteps: 1 },
});
const app = express();
app.use(express.json({ limit: '8mb' }));
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
const identity = continuationSemanticIdentity();
try {
  if (mode === 'fresh') {
    const fresh = await post({ message: 'new love song', task: { domain: 'lyrics' } });
    fs.writeFileSync(file, JSON.stringify({ identity, fresh }, null, 1));
    console.log(
      JSON.stringify(
        {
          identity,
          status: fresh.status,
          keys: Object.keys(fresh.body),
          task_identity: fresh.body.task?.connector_semantic_identity,
          has_sig: typeof fresh.body.sig === 'string',
          providerCalls,
        },
        null,
        1
      )
    );
  } else {
    const { fresh, identity: writer } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const b = fresh.body;
    const envelope = { history: b.history, workspace: b.workspace, task: b.task, sig: b.sig };
    if (b.lyric != null) envelope.lyric = b.lyric;
    const cont = await post({ message: 'continue', ...envelope });
    const res = {
      reader_identity: identity,
      writer_identity: writer,
      same_identity: writer === identity,
      status: cont.status,
      code: cont.body.code ?? null,
      error: cont.body.error ?? null,
      artifact: cont.body.artifact ?? null,
      body_keys: Object.keys(cont.body),
      providerCalls,
    };
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
    console.log(JSON.stringify(res, null, 1));
  }
} finally {
  globalThis.fetch = nativeFetch;
  server.close();
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 100);
}
