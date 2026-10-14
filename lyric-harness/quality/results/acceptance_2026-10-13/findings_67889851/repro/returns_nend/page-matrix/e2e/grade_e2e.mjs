// Policy 3 end to end: the declarations the candidate PAGE sent (captured
// from its /chat request in matrix.json / keep.json) through the candidate's
// own session connector (buildWorkflowServer, the /mcp twin), pasted-song
// path: begin_lyrics {phase:'edit'} -> lyric_check -> lyric_revise (no seed),
// each polled with get_operation; prints the PUBLISHED short verdict.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const MCP = process.argv[2]; // <tree>/mcp
const OUT = process.argv[3];
const req = createRequire(MCP + '/package.json');
const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { InMemoryTransport } = await imp('@modelcontextprotocol/sdk/inMemory.js');
const { Client } = await imp('@modelcontextprotocol/sdk/client/index.js');
const { JobStore } = await import(pathToFileURL(MCP + '/job_store.js').href);
const { WorkflowSessions } = await import(pathToFileURL(MCP + '/workflow_sessions.js').href);
const { buildWorkflowServer } = await import(pathToFileURL(MCP + '/workflow_tools.js').href);

const DRAFT = ['Oh--oh, oh my love', 'Thundered the battery’s double bass--', 'My love--love is true', 'You hold my heart.    10', 'I walk the line tonight', 'Well-worn shoes upon the floor', 'Stay with me (oh--oh) tonight', 'Hold me (hold me) close--close tonight'];
const cases = JSON.parse(readFileSync(process.argv[4], 'utf8'));
const server = await buildWorkflowServer({ sessions: new WorkflowSessions({ store: new JobStore() }), compatibility: true });
const client = new Client({ name: 'bb8-policy3', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
await client.connect(b);
const receipt = (res) => { for (const c of [...res.content].reverse()) { try { const j = JSON.parse(c.text); if (j && j.session_id) return j; } catch {} } return res.structuredContent || {}; };
async function call(name, args) { const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 600000 }); return r; }
async function finish(res) {
  let rc = receipt(res);
  let op = rc.operation_id || res.structuredContent?.operation_id;
  let last = res;
  for (let i = 0; i < 400 && op; i++) {
    const g = await call('get_operation', { operation_id: op, session_id: rc.session_id });
    last = g;
    const r2 = receipt(g);
    const st = g.structuredContent?.status || r2.status;
    if (st && st !== 'pending' && st !== 'running' && st !== 'queued') return { res: g, receipt: r2 };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { res: last, receipt: receipt(last) };
}
const out = [];
for (const c of cases) {
  const begun = await call('begin_lyrics', { phase: 'edit' });
  let sid = receipt(begun).session_id || begun.structuredContent?.session_id;
  const args = { draft: DRAFT, ...c.declarations };
  const rec = { name: c.name, declarations: c.declarations };
  const chk = await finish(await call('lyric_check', { session_id: sid, lines: DRAFT, ...c.declarations }));
  sid = chk.receipt.session_id || sid;
  rec.check = chk.res.content.map((x) => x.text);
  let rv = await finish(await call('lyric_revise', { session_id: sid, ...args }));
  rec.rounds = [];
  // Answer every question with the line exactly as written (the writer keeps
  // the line), until the run stops; each round is recorded.
  for (let i = 0; i < 40; i++) {
    const meta = rv.res.content.map((x) => { try { return JSON.parse(x.text); } catch { return null; } }).find((j) => j && j.exit_code !== undefined);
    if (!meta || meta.exit_code !== 4) break;
    sid = rv.receipt.session_id || sid;
    const asked = meta.asked || {};
    const lines = asked.lines || (asked.line ? [asked.line] : []);
    rec.rounds.push({ asked, status: meta.status });
    const a = lines.length > 1 ? { answers: lines.map((n) => ({ line: n, text: DRAFT[n - 1] })) } : { answer: DRAFT[lines[0] - 1] };
    rv = await finish(await call('lyric_revise', { session_id: sid, ...a }));
  }
  rec.revise = rv.res.content.map((x) => x.text);
  rec.revise_isError = !!rv.res.isError;
  out.push(rec);
  console.log('=== ' + c.name + ' ' + JSON.stringify(c.declarations));
  for (const [k, blocks] of [['lyric_check', rec.check], ['lyric_revise', rec.revise]]) {
    console.log('--- ' + k + ' (' + blocks.length + ' blocks)');
    for (const t of blocks) {
      let j = null; try { j = JSON.parse(t); } catch {}
      if (j && (j.blocking || j.coverage || j.exit_code !== undefined)) {
        const pick = { exit_code: j.exit_code, meaning: j.meaning, status: j.status, measurement_status: j.measurement_status, certified: j.certified ?? j.coverage?.certified, refused_obligations: j.coverage?.refused_obligations, blocking: j.blocking, notes: j.notes, stop: j.stop ?? j.stop_reason, pron: j.pronunciation_options?.items?.map((p) => [p.line, p.token, p.word]) };
        console.log(JSON.stringify(pick, null, 1).slice(0, 4000));
      } else console.log(String(t).slice(0, 600).replace(/\n/g, ' ⏎ '));
    }
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
await client.close(); await server.close();
process.exit(0);
