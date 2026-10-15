// The original high-report test 8 first request (four-line AAAA draft, three
// violating members), with a 10-minute client deadline so the duration is
// measured rather than cut at 60 s. Run from the repository root:
//   LYRIC_PYTHON=python3 node lyric-harness/quality/results/revise_latency_2026-10-15/first_request.mjs
// Set DUMP=<file> to write the returned content blocks for a byte comparison.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const sdk = (p) => path.join(ROOT, 'mcp/node_modules/@modelcontextprotocol/sdk/dist/esm', p);
const { Client } = await import(sdk('client/index.js'));
const { InMemoryTransport } = await import(sdk('inMemory.js'));
const { buildServer } = await import(path.join(ROOT, 'mcp/tools.js'));
const { _workerInternals } = await import(path.join(ROOT, 'mcp/lyric_tools.js'));
const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'revise-latency', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
const draft_text =
  'I walked along the road tonight\nThe stars were cold above the sea\nI held your hand and felt the rain\nAnd nothing else was left for us';
try {
  const t = performance.now();
  const r = await client.callTool(
    {
      name: 'lyric_revise',
      arguments: { draft_text, scheme: 'AAAA', relation: 'class:RHYME', backtrack: 0 },
    },
    undefined,
    { timeout: 600000 }
  );
  const ms = performance.now() - t;
  const verdict = r.content
    .map((x) => {
      try {
        return JSON.parse(x.text);
      } catch {
        return null;
      }
    })
    .find((x) => typeof x?.exit_code === 'number');
  console.log(JSON.stringify({ first_request_ms: Math.round(ms), exit_code: verdict?.exit_code }));
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(r.content, null, 1));
} finally {
  _workerInternals.kill();
  await client.close();
  await server.close();
}
