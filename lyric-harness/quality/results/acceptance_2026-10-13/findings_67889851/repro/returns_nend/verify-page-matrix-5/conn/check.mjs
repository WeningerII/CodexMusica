// Own script: what the published lyric_check verdict says for the strings the
// candidate page sends, via the candidate's session connector in-process.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const MCP = process.argv[2];
const OUT = process.argv[3];
const req = createRequire(MCP + '/package.json');
const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { InMemoryTransport } = await imp('@modelcontextprotocol/sdk/inMemory.js');
const { Client } = await imp('@modelcontextprotocol/sdk/client/index.js');
const { JobStore } = await import(pathToFileURL(MCP + '/job_store.js').href);
const { WorkflowSessions } = await import(pathToFileURL(MCP + '/workflow_sessions.js').href);
const { buildWorkflowServer } = await import(pathToFileURL(MCP + '/workflow_tools.js').href);
const LINES = ['Oh--oh, oh my love', 'Thundered the battery’s double bass--', 'My love--love is true', 'You hold my heart.    10', 'I walk the line tonight', 'Well-worn shoes upon the floor', 'Stay with me (oh--oh) tonight', 'Hold me (hold me) close--close tonight'];
const CASES = [
  ['groups', '1.T4 (carried across the word-cut change),6'],
  ['groups', '1,6 — cut'],
  ['returns', '1.head (numbered under the earlier cut),6.head'],
  ['returns', '1.head (kept),6.head'],
  ['returns', '1.head,6.head'],
];
const server = await buildWorkflowServer({ sessions: new WorkflowSessions({ store: new JobStore() }), compatibility: true });
const client = new Client({ name: 'bb8-v5', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a); await client.connect(b);
const receipt = (res) => { for (const c of [...(res.content || [])].reverse()) { try { const j = JSON.parse(c.text); if (j && j.session_id) return j; } catch {} } return res.structuredContent || {}; };
const call = (name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 600000 });
const out = [];
for (const [field, value] of CASES) {
  const begun = await call('begin_lyrics', { phase: 'edit' });
  const sid = receipt(begun).session_id;
  const first = await call('lyric_check', { session_id: sid, lines: LINES, [field]: value });
  let rc = receipt(first); let last = first;
  for (let i = 0; i < 200 && rc.operation_id; i++) {
    const g = await call('get_operation', { operation_id: rc.operation_id, session_id: rc.session_id || sid });
    last = g; const r2 = receipt(g);
    const st = g.structuredContent?.status || r2.status;
    if (st && !['pending', 'running', 'queued'].includes(st)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const blocks = (last.content || []).map((x) => x.text);
  out.push({ field, value, isError: !!last.isError, firstIsError: !!first.isError, first: (first.content || []).map((x) => x.text), blocks });
  console.log(`=== ${field}=${value}  isError=${!!last.isError}`);
  for (const t of blocks) console.log('  ' + String(t).slice(0, 1500).replace(/\n/g, ' ⏎ '));
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
await client.close(); await server.close();
process.exit(0);
