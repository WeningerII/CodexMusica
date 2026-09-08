// Staged native-worker admission regression; only the provider is localhost.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { _workerInternals } from './lyric_tools.js';

let providerCalls = 0;
const provider = createServer(async (req, res) => {
  providerCalls++;
  for await (const chunk of req) void chunk;
  res.writeHead(500);
  res.end('The inadmissible draft must never reach the provider');
});
provider.listen(0, '127.0.0.1');
await once(provider, 'listening');
const env = {
  GEMINI_API_KEY: 'offline-work-budget-fixture',
  LYRIC_PROPOSER_MODEL: 'gemini-3.5-flash-lite',
  LYRIC_PROPOSER_API_BASE: `http://127.0.0.1:${provider.address().port}`,
};
const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
Object.assign(process.env, env);
const server = buildServer();
const client = new Client({ name: 'writer-work-budget', version: '1' }, { capabilities: {} });
const [c, s] = InMemoryTransport.createLinkedPair();
try {
  await Promise.all([server.connect(s), client.connect(c)]);
  const line = Array(100).fill('a').join(' ');
  assert.equal(line.length, 199);
  const draft = Array(31).fill(line);
  const response = await client.callTool(
    {
      name: 'lyric_revise',
      arguments: {
        draft,
        scheme: 'A'.repeat(draft.length),
        relation: 'type:rime riche',
        writer: 'kitchen',
        attempts: 1,
        backtrack: 0,
        max_rounds: 1,
      },
    },
    undefined,
    { timeout: 120000 }
  );
  const values = response.content.flatMap((part) => {
    try {
      return [JSON.parse(part.text)];
    } catch {
      return [];
    }
  });
  const verdict = values.find((value) => typeof value.exit_code === 'number');
  assert.ok(verdict, JSON.stringify(response));
  assert.equal(verdict.exit_code, 2);
  assert.match(verdict.refusal, /RESOURCE_LIMIT.*actual pronunciation spans/);
  assert.deepEqual(verdict.final_draft, draft, 'the refusal preserves the exact supplied work');
  assert.equal(providerCalls, 0, 'actual draft candidate work is refused before paid dispatch');
  console.log(
    'writer work budget: admitted line count with 199-character overfull lines refused before provider, exact draft preserved'
  );
} finally {
  _workerInternals.kill();
  await client.close();
  await server.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  provider.closeAllConnections();
  await new Promise((resolve) => provider.close(resolve));
}
