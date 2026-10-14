// BB8: what a raw lyric_check returns as pronunciation_options on a line whose
// v1 and v2 cuts differ, and what a declaration taken from them binds.
// usage: node --import ./nm_register.mjs options_probe.mjs <tree> <out.json> [decl.json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, out, declFile] = process.argv.slice(2);
const mcp = (f) => pathToFileURL(path.join(tree, 'mcp', f)).href;
const { buildServer } = await import(mcp('tools.js'));
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'bb8-opt', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
const call = (name, args) =>
  client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
const json = (r) => {
  for (const c of r.content || [])
    try {
      const v = JSON.parse(c.text);
      if (v && typeof v === 'object') return v;
    } catch {}
  return null;
};
const LINES = (process.env.BB8_LINES ? JSON.parse(process.env.BB8_LINES) : ['Wind--wind, the wind my love', 'Azure dog']);
const results = { tree, lines: LINES };
const r = await call('lyric_check', { lines: LINES, scheme: 'AA' });
const v = json(r);
results.check_isError = !!r.isError;
results.check_keys = v ? Object.keys(v) : null;
results.pronunciation_options = v?.pronunciation_options ?? null;
results.pronunciations = v?.pronunciations ?? null;
if (!v) results.check_text = (r.content || []).map((c) => c.text).join('\n').slice(0, 2000);
if (declFile) {
  const decls = JSON.parse(fs.readFileSync(declFile, 'utf8'));
  results.declared = [];
  for (const d of decls) {
    const rr = await call('lyric_check', { lines: LINES, scheme: 'AA', ...(process.env.BB8_REL ? { relation: process.env.BB8_REL } : {}), pronunciations: [d] });
    const vv = json(rr);
    results.declared.push({
      sent: d,
      isError: !!rr.isError,
      text: rr.isError ? (rr.content || []).map((c) => c.text).join('\n').slice(0, 800) : undefined,
      pronunciations: vv?.pronunciations ?? null,
      exit_code: vv?.exit_code, meaning: vv?.meaning, flags: vv?.flags, standing: vv?.standing,
      refused: vv?.coverage?.refused_obligations ?? null, certified: vv?.certified,
      options_for_line1: (vv?.pronunciation_options ?? []).filter?.((o) => o.line === LINES[0] || o.line === 1) ?? null,
    });
  }
}
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1).slice(0, 6000));
await client.close();
await server.close();
process.exit(0);
