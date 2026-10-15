// Local twin of the live raw lyric_check H1 call. usage: node raw_check.mjs <tree> [supplement]
import path from 'node:path';
const ROOT = path.resolve(process.argv[2]);
const sup = process.argv[3];
const sdk = (p) => path.join(ROOT, 'mcp/node_modules/@modelcontextprotocol/sdk/dist/esm', p);
const { Client } = await import(sdk('client/index.js'));
const { InMemoryTransport } = await import(sdk('inMemory.js'));
const { buildServer } = await import(path.join(ROOT, 'mcp/tools.js'));
const { _workerInternals } = await import(path.join(ROOT, 'mcp/lyric_tools.js'));
const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'h1', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
try {
  const args = { lines: ['Read--read, read it again', 'the bed is made for me'], groups: '1.T2,2.T2', relation: 'perfect rhyme', numbering: 'v2' };
  if (sup) args.lexicon_supplement = sup;
  const r = await client.callTool({ name: 'lyric_check', arguments: args }, undefined, { timeout: 600000 });
  const v = r.content.map((x) => { try { return JSON.parse(x.text); } catch { return null; } }).find((x) => x && 'coverage' in x);
  console.log(JSON.stringify({ sup: sup || 'default', certified: v?.certified, refused: v?.coverage?.refused_obligations, lexicon: v?.lexicon, codes: (v?.findings || []).map((f) => f.code) }));
} finally { _workerInternals.kill(); await client.close(); await server.close(); }
