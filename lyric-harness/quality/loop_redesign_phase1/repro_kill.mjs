import console from 'node:console';
import process from 'node:process';
import { setTimeout } from 'node:timers';
// PHASE-1 REPRODUCTION (scratch, not committed): a killed lyric_revise
// continuation through the real session layer.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';

const DIR = process.env.REPRO_DIR || mkdtempSync(join(tmpdir(), 'repro-'));
const store = new JobStore(DIR);
const sessions = new WorkflowSessions({ store });
const server = await buildWorkflowServer({ domain: 'lyrics', sessions });
const [a, b] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'repro', version: '1' }, { capabilities: {} });
await server.connect(a);
await client.connect(b);
const call = async (name, args) => {
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 3_600_000 });
  return { r, ms: Date.now() - t0 };
};
const sc = (x) => x.r.structuredContent || {};
async function settle(sid, op) {
  const t0 = Date.now();
  for (;;) {
    const { r } = await call('get_operation', { session_id: sid, operation_id: op });
    const s = r.structuredContent || {};
    if (s.status !== 'pending' && s.status !== 'running' && s.status !== 'queued')
      return { r, s, ms: Date.now() - t0 };
    await new Promise((res) => setTimeout(res, 500));
  }
}
const log = (...x) => console.log(new Date().toISOString().slice(11, 19), ...x);
import { readFileSync, writeFileSync } from 'node:fs';
const MODE = process.argv[2] || 'all';
let sid, x, st, done;
if (MODE !== 'kill') {
  const begun = sc(await call('begin_lyrics', { phase: 'edit' }));
  sid = begun.session_id;
  const decl = { scheme: 'AAA', relation: 'class:RHYME', attempts: 1, backtrack: 0, max_rounds: 1 };
  x = await call('lyric_revise', { session_id: sid, draft: ['Cat', 'Dog', 'Sun'], ...decl });
  st = sc(x);
  log('open queued', JSON.stringify(st).slice(0, 300));
  done = await settle(st.session_id || sid, st.operation_id);
  sid = done.s.session_id || sid;
  log(
    'open settled',
    done.ms,
    'ms; status',
    done.s.status,
    '|',
    done.r.content[0].text.slice(0, 200).replace(/\n/g, ' ')
  );
  writeFileSync(DIR + '.sid', sid);
  if (MODE === 'open') process.exit(0);
} else sid = readFileSync(DIR + '.sid', 'utf8');
x = await call('lyric_revise', { session_id: sid, answer: 'I watched the window like a diplomat' });
st = sc(x);
log('answer queued', JSON.stringify(st).slice(0, 300));
done = await settle(st.session_id || sid, st.operation_id);
sid = done.s.session_id || sid;
log('answer settled', done.ms, 'ms; op status', done.s.status, 'resumable', done.s.resumable);
for (const c of done.r.content) log('  block:', c.text.slice(0, 600).replace(/\n/g, ' '));
if (process.argv[2] === 'kill') {
  const res = await call('resume_operation', { session_id: sid, operation_id: st.operation_id });
  log('resume_operation ->', res.r.isError ? 'ERROR' : 'ok', res.r.content[0].text.slice(0, 300));
  const again = await call('lyric_revise', {
    session_id: sid,
    answer: 'I watched the window like a diplomat',
  });
  log(
    're-send same answer ->',
    again.r.isError ? 'ERROR' : 'ok',
    again.r.content[0].text.slice(0, 300)
  );
  if (!again.r.isError) {
    const d2 = await settle(sid, sc(again).operation_id);
    sid = d2.s.session_id || sid;
    log(
      '  re-send settled',
      d2.ms,
      'ms:',
      d2.r.content.map((c) => c.text.slice(0, 250).replace(/\n/g, ' ')).join(' || ')
    );
  }
  const none = await call('lyric_revise', { session_id: sid });
  log(
    'no-answer continuation ->',
    none.r.isError ? 'ERROR' : 'ok',
    none.r.content[0].text.slice(0, 200)
  );
  if (!none.r.isError) {
    const d3 = await settle(sid, sc(none).operation_id);
    log(
      '  no-answer settled',
      d3.ms,
      'ms:',
      d3.r.content.map((c) => c.text.slice(0, 250).replace(/\n/g, ' ')).join(' || ')
    );
  }
}
process.exit(0);
