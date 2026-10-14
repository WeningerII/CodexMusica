// BB8 verify-page-matrix-2 (own script): a returns declaration through a
// tree's /mcp twin (buildWorkflowServer, compatibility:true, in-process, no
// network), the pasted-song path: begin_lyrics {phase:'edit'} -> lyric_check
// -> lyric_revise, each polled with get_operation. When revise asks for a
// line, the writer keeps it (answers with the line as it stands in the
// current song). Prints the PUBLISHED short verdict and final song.
// usage: node [--import register.mjs] returns_e2e.mjs <tree> <out.json> <returns>...
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const TREE = process.argv[2];
const OUT = process.argv[3];
const DECLS = process.argv.slice(4);
const MCP = TREE + '/mcp';
const sdkReq = createRequire('/home/user/CodexMusica/mcp/package.json');
const imp = (m) => import(pathToFileURL(sdkReq.resolve(m)).href);
const { InMemoryTransport } = await imp('@modelcontextprotocol/sdk/inMemory.js');
const { Client } = await imp('@modelcontextprotocol/sdk/client/index.js');
const { JobStore } = await import(pathToFileURL(MCP + '/job_store.js').href);
const { WorkflowSessions } = await import(pathToFileURL(MCP + '/workflow_sessions.js').href);
const { buildWorkflowServer } = await import(pathToFileURL(MCP + '/workflow_tools.js').href);
const SONG = readFileSync(new URL('../harness/song8.txt', import.meta.url), 'utf8').replace(/\n$/, '').split('\n');

const server = await buildWorkflowServer({ sessions: new WorkflowSessions({ store: new JobStore() }), compatibility: true });
const client = new Client({ name: 'bb8-verify-returns', version: '1' });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
await client.connect(b);
const jsons = (res) => res.content.map((c) => { try { return JSON.parse(c.text); } catch { return null; } });
const receiptOf = (res) => [...jsons(res)].reverse().find((j) => j && (j.session_id || j.operation_id)) || {};
const verdictOf = (res) => jsons(res).find((j) => j && (j.exit_code !== undefined || j.coverage || j.blocking)) || null;
const call = (name, args) => client.callTool({ name, arguments: args }, undefined, { timeout: 900000 });
async function settle(res, sid0) {
  let r = res;
  for (let i = 0; i < 600; i++) {
    const rc = receiptOf(r);
    const st = rc.status;
    if (!rc.operation_id || (st && !['pending', 'running', 'queued'].includes(st))) return r;
    await new Promise((ok) => setTimeout(ok, 1000));
    r = await call('get_operation', { operation_id: rc.operation_id, ...(rc.session_id || sid0 ? { session_id: rc.session_id || sid0 } : {}) });
  }
  return r;
}
const out = [];
for (const returns of DECLS) {
  const rec = { tree: TREE, returns };
  let sid = receiptOf(await call('begin_lyrics', { phase: 'edit' })).session_id;
  const chk = await settle(await call('lyric_check', { session_id: sid, lines: SONG, returns }), sid);
  sid = receiptOf(chk).session_id || sid;
  const cv = verdictOf(chk);
  rec.check = { isError: !!chk.isError, exit_code: cv?.exit_code, meaning: cv?.meaning, certified: cv?.certified ?? cv?.coverage?.certified, refused: cv?.coverage?.refused_obligations, flags: (cv?.findings || []).filter((f) => f.severity === 'flag').map((f) => `${f.code}: ${f.message}`), notes_codes: (cv?.findings || []).filter((f) => f.severity !== 'flag').map((f) => f.code), raw_first: chk.content[0]?.text?.slice(0, 300) };
  // The published check detail: findings.
  let rv = await settle(await call('lyric_revise', { session_id: sid, draft: SONG, returns }), sid);
  let song = SONG.slice();
  rec.rounds = [];
  for (let i = 0; i < 30; i++) {
    const v = verdictOf(rv);
    if (!v || v.exit_code !== 4) break;
    sid = receiptOf(rv).session_id || sid;
    const asked = v.asked || {};
    const lines = asked.lines || (asked.line ? [asked.line] : []);
    if (!lines.length) { rec.rounds.push({ asked, note: 'no line asked; stop' }); break; }
    const ans = lines.length > 1 ? { answers: lines.map((n) => ({ line: n, text: SONG[n - 1] })) } : { answer: SONG[lines[0] - 1] };
    rec.rounds.push({ asked, answered_with: ans, question_head: rv.content[0]?.text?.slice(0, 900) });
    rv = await settle(await call('lyric_revise', { session_id: sid, ...ans }), sid);
  }
  const fv = verdictOf(rv);
  rec.revise = { isError: !!rv.isError, exit_code: fv?.exit_code, status: fv?.status, certified: fv?.certified, blocking: fv?.blocking, stop: fv?.stop, song_block: rv.content[0]?.text };
  out.push(rec);
  console.log(`=== ${TREE.split('/').pop()} returns=${JSON.stringify(returns)}`);
  console.log(`  lyric_check : exit ${rec.check.exit_code} certified=${rec.check.certified} refused=${JSON.stringify(rec.check.refused)}`);
  console.log(`                flags=${JSON.stringify(rec.check.flags)}`);
  console.log(`                meaning=${rec.check.meaning}`);
  for (const r of rec.rounds) console.log(`  revise asked: ${JSON.stringify(r.asked)} -> answered ${JSON.stringify(r.answered_with)}`);
  console.log(`  lyric_revise: exit ${rec.revise.exit_code} status=${rec.revise.status} certified=${rec.revise.certified}`);
  console.log(`                blocking=${JSON.stringify(rec.revise.blocking)}`);
  const final = (rec.revise.song_block || '').split('\n\n')[0].split('\n');
  console.log(`  final L4: ${JSON.stringify(final[3])}   (written: ${JSON.stringify(SONG[3])})`);
  console.log(`  final L6: ${JSON.stringify(final[5])}`);
  console.log(`  stop line: ${JSON.stringify((rec.revise.song_block || '').split('\n').find((l) => /^\[FINISHED|^\[AWAIT|^\[/.test(l)))}`);
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
await client.close();
await server.close();
process.exit(0);
