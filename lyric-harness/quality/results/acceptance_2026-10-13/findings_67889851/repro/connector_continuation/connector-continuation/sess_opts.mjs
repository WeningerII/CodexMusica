// BB8: a lyric_check run in a SESSION on one tree, its pronunciation options
// read back with get_operation detail:'pronunciations' on another.
// usage: node --import ./nm_register.mjs sess_opts.mjs <tree> write <storeDir> <ids.json>
//        node --import ./nm_register.mjs sess_opts.mjs <tree> read  <storeDir> <ids.json> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, mode, storeDir, file, out] = process.argv.slice(2);
const mcp = (f) => pathToFileURL(path.join(tree, 'mcp', f)).href;
const { buildWorkflowServer } = await import(mcp('workflow_tools.js'));
const { WorkflowSessions, SESSION_STORE_LIMITS } = await import(mcp('workflow_sessions.js'));
const { JobStore } = await import(mcp('job_store.js'));
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const store = new JobStore(storeDir, SESSION_STORE_LIMITS);
const sessions = new WorkflowSessions({ store, build: {} });
const server = await buildWorkflowServer({ sessions, compatibility: true });
const client = new Client({ name: 'bb8-sess-opts', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
await client.connect(b);
const call = (name, args) =>
  client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
const sc = (r) => r.structuredContent ?? JSON.parse(r.content.at(-1).text);
const lines = ['Wind--wind, wind my vrexl', 'Azure vrexl'];
async function poll(id) {
  for (;;) {
    const v = sc(await call('get_operation', { operation_id: id }));
    if (v.status !== 'pending') return v;
    await new Promise((r) => setTimeout(r, 250));
  }
}
const optionsOf = (r) => {
  for (const c of r.content || [])
    try {
      const v = JSON.parse(c.text);
      const o = v?.pronunciation_options ?? v?.pronunciations?.pronunciation_options;
      if (o) return o;
    } catch {}
  return null;
};
if (mode === 'write') {
  const s0 = sc(await call('begin_lyrics', { phase: 'edit' }));
  const op = sc(await call('lyric_check', { session_id: s0.session_id, lines, scheme: 'AA' }));
  await poll(op.operation_id);
  fs.writeFileSync(file, JSON.stringify({ op: op.operation_id }));
  console.log('written', op.operation_id);
} else {
  const { op } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const old = await call('get_operation', { operation_id: op, detail: 'pronunciations' });
  const fresh0 = sc(await call('begin_lyrics', { phase: 'edit' }));
  const fop = sc(await call('lyric_check', { session_id: fresh0.session_id, lines, scheme: 'AA' }));
  await poll(fop.operation_id);
  const now = await call('get_operation', { operation_id: fop.operation_id, detail: 'pronunciations' });
  const pick = (o) =>
    (o?.items || []).map((i) => ({ line: i.line, token: i.token, word: i.word }));
  const res = {
    tree,
    old_operation_options: pick(optionsOf(old)),
    old_raw_text: optionsOf(old) ? undefined : (old.content || []).map((c) => c.text).join('\n').slice(0, 1500),
    fresh_operation_options: pick(optionsOf(now)),
  };
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
}
await client.close();
await server.close();
process.exit(0);
