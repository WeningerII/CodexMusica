// BB8 verify: one raw-engine lyric_check per declaration set, full verdict dumped.
// usage: node --import ./reg.mjs raw.mjs <tree> <out.json> '<lines json>' '<relation or ->' '<[[decl...],...] json>'
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [tree, out, linesJ, rel, declSetsJ] = process.argv.slice(2);
const { buildServer } = await import(pathToFileURL(path.join(tree, 'mcp', 'tools.js')).href);
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'bb8-verify-raw', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
const lines = JSON.parse(linesJ);
const sets = JSON.parse(declSetsJ || '[[]]');
const res = { tree, lines, relation: rel, runs: [] };
for (const decls of sets) {
  const args = { lines, scheme: 'A'.repeat(lines.length) };
  if (rel && rel !== '-') args.relation = rel;
  if (decls.length) args.pronunciations = decls;
  const r = await client.callTool({ name: 'lyric_check', arguments: args }, undefined, { timeout: 300000 });
  let v = null;
  for (const c of r.content || []) { try { const j = JSON.parse(c.text); if (j && typeof j === 'object') { v = j; break; } } catch {} }
  res.runs.push({ sent: decls, isError: !!r.isError, raw_text: v ? undefined : (r.content || []).map((c) => c.text).join('\n'), verdict: v });
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
for (const x of res.runs) console.log(JSON.stringify({ sent: x.sent.map((d) => [d.token, d.word, d.phones.join(' ')]), isError: x.isError, exit: x.verdict?.exit_code, meaning: x.verdict?.meaning, certified: x.verdict?.certified, flags: x.verdict?.flags, standing: x.verdict?.standing, refused: x.verdict?.coverage?.refused_obligations, err: x.raw_text?.slice(0, 300) }));
await client.close(); await server.close(); process.exit(0);
