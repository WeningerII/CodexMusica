// verify-page-matrix-3 (BB8): what the returns spelling the page sends does
// downstream, through the candidate's session connector (buildWorkflowServer,
// the /mcp twin) in-process. Pasted-song path: begin_lyrics {phase:'edit'} ->
// lyric_check -> lyric_revise; every question is answered with the writer's
// own original line (the writer keeps every line) until the run stops.
// Scratch only. No provider is reached.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const MCP = process.argv[2];
const OUT = process.argv[3];
const ONLY = process.argv[4] ? process.argv[4].split('|') : null;
const req = createRequire(MCP + '/package.json');
const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { InMemoryTransport } = await imp('@modelcontextprotocol/sdk/inMemory.js');
const { Client } = await imp('@modelcontextprotocol/sdk/client/index.js');
const { JobStore } = await import(pathToFileURL(MCP + '/job_store.js').href);
const { WorkflowSessions } = await import(pathToFileURL(MCP + '/workflow_sessions.js').href);
const { buildWorkflowServer } = await import(pathToFileURL(MCP + '/workflow_tools.js').href);

const DRAFT = [
  'Hold on--hold on to me',
  'The night is cold and grey',
  'We danced until the morning',
  'Meet me at the corner at 9',
  'I walk the line tonight',
  'Stay with me tonight',
  'The station clock says nine',
  'Hold on--hold on tonight',
];
const CASES = [
  ['A1 as main sends (4.end,7.end)', '4.end,7.end'],
  ['A2 as candidate sends after upgrade (4,7)', '4,7'],
  ['B1 as main sends (5.end,6.end)', '5.end,6.end'],
  ['B2 the collapsed class alone (5,6)', '5,6'],
  ['C1 as main sends (1.end,6.head)', '1.end,6.head'],
  ['C2 as candidate sends after upgrade (1,6.head)', '1,6.head'],
].filter(([n]) => !ONLY || ONLY.some((o) => n.startsWith(o)));

const server = await buildWorkflowServer({ sessions: new WorkflowSessions({ store: new JobStore() }), compatibility: true });
const client = new Client({ name: 'bb8-verify3', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
await client.connect(b);
const blocks = (res) => (res.content || []).map((c) => c.text);
const jsonBlocks = (res) => blocks(res).map((t) => { try { return JSON.parse(t); } catch { return null; } }).filter(Boolean);
const receipt = (res) => [...jsonBlocks(res)].reverse().find((j) => j.session_id) || {};
const verdict = (res) => jsonBlocks(res).find((j) => j.exit_code !== undefined) || null;
const call = (name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 900000 });
async function settle(res) {
  const op = res.structuredContent?.operation_id || jsonBlocks(res).map((j) => j.operation_id).find(Boolean);
  let last = res;
  if (res.structuredContent?.status === 'completed') return { res, rc: receipt(res) };
  for (let i = 0; i < 600 && op; i++) {
    const g = await call('get_operation', { operation_id: op });
    last = g;
    const r2 = receipt(g);
    const st = r2.status || g.structuredContent?.status;
    if (!['pending', 'running', 'queued'].includes(st)) return { res: g, rc: r2 };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { res: last, rc: receipt(last) };
}
const out = [];
for (const [name, returns] of CASES) {
  const rec = { name, returns };
  const begun = await call('begin_lyrics', { phase: 'edit' });
  let sid = receipt(begun).session_id;
  const chk = await settle(await call('lyric_check', { session_id: sid, lines: DRAFT, returns }));
  sid = chk.rc.session_id || sid;
  rec.check_isError = !!chk.res.isError;
  const cv = verdict(chk.res);
  rec.check = cv ? { exit_code: cv.exit_code, status: cv.status, certified: cv.certified, blocking: cv.blocking, meaning: cv.meaning } : blocks(chk.res).map((t) => t.slice(0, 600));
  let rv = await settle(await call('lyric_revise', { session_id: sid, draft: DRAFT, returns }));
  rec.rounds = [];
  for (let i = 0; i < 8; i++) {
    const v = verdict(rv.res);
    if (!v || v.exit_code !== 4) break;
    sid = rv.rc.session_id || sid;
    const asked = v.asked || {};
    const lines = asked.lines || asked.members || (asked.line ? [asked.line] : []);
    rec.rounds.push({ asked });
    const ans = lines.length > 1 ? { answers: lines.map((n) => ({ line: n, text: DRAFT[n - 1] })) } : { answer: DRAFT[lines[0] - 1] };
    rv = await settle(await call('lyric_revise', { session_id: sid, ...ans }));
  }
  rec.revise_isError = !!rv.res.isError;
  const fv = verdict(rv.res);
  rec.revise = fv
    ? { exit_code: fv.exit_code, status: fv.status, certified: fv.certified, loop_stop_reason: fv.loop_stop_reason, blocking: fv.blocking, folded: fv.folded, meaning: fv.meaning }
    : null;
  const song = blocks(rv.res)[0] || '';
  rec.song_head = song.split('\n').slice(0, 10);
  rec.changed_lines = DRAFT.map((l, i) => [i + 1, l, rec.song_head[i]]).filter(([, l, s]) => s !== undefined && s !== l);
  if (!fv) rec.revise_raw = blocks(rv.res).map((t) => t.slice(0, 800));
  out.push(rec);
  console.log(JSON.stringify(rec, null, 1));
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
await client.close();
await server.close();
process.exit(0);
