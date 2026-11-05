// Offline test helper: real local tool/agent/HTTP path; only model tool choice is stubbed.
// Neither report evidence nor request_binding is manufactured or changed here.
// The page's Run review is review-only (#636): the agent accepts lyric_recover,
// then lyric_check, and builds both calls' arguments from the signed page
// context. The stub therefore asks for recover, then check (with the
// scenario's own arguments, which the agent must discard), then stops.
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { buildServer } from '../mcp/tools.js';
import { createChatRouter, CHAT_LIMITS } from '../mcp/chat.js';
import { LIMITS } from '../mcp/gemini_agent.js';
const requireMcp = createRequire(new URL('../mcp/package.json', import.meta.url));
const express = requireMcp('express');
const { Client } = requireMcp('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = requireMcp('@modelcontextprotocol/sdk/inMemory.js');
export async function createOfflineChat({ args } = {}) {
  const nativeFetch = globalThis.fetch;
  let selectedArgs = args;
  let hop = 0;
  const router = await createChatRouter({
    buildServer,
    Client,
    InMemoryTransport,
    apiKey: 'offline-fixture',
    limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    turnLimits: { ...LIMITS, maxSteps: 3, maxTurnMs: 120000 },
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
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
    async close() {
      globalThis.fetch = nativeFetch;
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
