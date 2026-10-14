// BB8 connector-continuation probe: the SESSION endpoint (/mcp shared surface,
// buildWorkflowServer({sessions, compatibility:true}) as server_http.js mounts
// it), in-process, over a DURABLE JobStore directory that outlives the process.
//
// usage (CHAT_SECRET fixed by the caller so cursor seals verify across processes):
//   node --import ./nm_register.mjs session_probe.mjs <tree> write <storeDir> <out.json>
//   node --import ./nm_register.mjs session_probe.mjs <tree> read  <storeDir> <in.json> <out.json> [rawState.json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [tree, mode, storeDir, file, out, rawStateFile] = process.argv.slice(2);
const mcp = (f) => pathToFileURL(path.join(tree, 'mcp', f)).href;
const { buildWorkflowServer } = await import(mcp('workflow_tools.js'));
const { WorkflowSessions, SESSION_STORE_LIMITS } = await import(mcp('workflow_sessions.js'));
const { JobStore } = await import(mcp('job_store.js'));
const codec = await import(mcp('state_codec.js'));
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');

const store = new JobStore(storeDir, SESSION_STORE_LIMITS);
const sessions = new WorkflowSessions({ store, build: { tree: path.basename(tree) } });
const server = await buildWorkflowServer({ sessions, compatibility: true });
const client = new Client({ name: 'bb8-session', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
await client.connect(b);
const identity = codec.continuationSemanticIdentity();
console.log('TREE', tree, 'IDENTITY', identity);

const call = async (name, args) =>
  client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
const textOf = (r) => (r.content || []).map((c) => c.text).join('\n');
const sc = (r) => r.structuredContent ?? null;
const receiptOf = (r) => {
  const blocks = r.content || [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      const v = JSON.parse(blocks[i].text);
      if (v && typeof v === 'object' && ('operation_id' in v || 'status' in v)) return v;
    } catch {}
  }
  return null;
};
async function poll(opId) {
  for (let i = 0; i < 600; i++) {
    const r = await call('get_operation', { operation_id: opId });
    const v = sc(r) ?? receiptOf(r);
    if (v?.status && v.status !== 'pending') return { r, v };
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error('poll timeout ' + opId);
}
const brief = (r) => {
  const v = sc(r) ?? receiptOf(r);
  return {
    isError: !!r.isError,
    status: v?.status ?? null,
    tool_error: v?.tool_error ?? null,
    resumable: v?.resumable ?? null,
    interruption: v?.interruption ?? null,
    has_session_id: !!v?.session_id,
    text: textOf(r).slice(0, 1400),
  };
};
const draft = ['Copper cat', 'Azure dog'];
const mandate = { scheme: 'AA', relation: 'type:rime riche', max_rounds: 1, backtrack: 0 };
const answer = 'I left the basket underneath the oak';
const results = { tree, identity };
const log = (label, value) => {
  results[label] = value;
  console.log(`\n=== ${label}\n`, JSON.stringify(value, null, 1).slice(0, 3000));
};

try {
  if (mode === 'write') {
    // (1) edit-phase session, a revision that suspends on a question
    const begun = receiptOf(await call('begin_lyrics', { phase: 'edit' }));
    const sub = await call('lyric_revise', { session_id: begun.session_id, draft, ...mandate });
    const subV = sc(sub) ?? receiptOf(sub);
    log('revise_submit', brief(sub));
    const done = await poll(subV.operation_id);
    log('revise_done', brief(done.r));
    const S1 = done.v.session_id;
    const rec1 = store.get(S1);
    const sess1 = rec1.response?.body?.session;
    log('S1_record', {
      state: rec1.state,
      session_semantic_identity: sess1?.semantic_identity,
      continuation: !!sess1?.native?.continuation,
      continuation_state_reader_scheme: sess1?.native?.continuation?.args?.state
        ? (codec.decodeState(sess1.native.continuation.args.state).reader_scheme ?? '(absent)')
        : null,
    });
    // (2) a completed grade, to read across the release with detail
    const begun2 = receiptOf(await call('begin_lyrics', { phase: 'edit' }));
    const g = await call('lyric_check', { session_id: begun2.session_id, lines: draft, scheme: 'AA' });
    const gV = sc(g) ?? receiptOf(g);
    if (!gV?.operation_id) { console.log('GRADE SUBMIT', JSON.stringify(brief(g))); process.exit(3); }
    const gDone = await poll(gV.operation_id);
    log('grade_done', brief(gDone.r));
    // (3) an operation interrupted by a process death: a lyric_grade submitted
    //     and the process killed before it runs (record stays `pending` on disk)
    const begun3 = receiptOf(await call('begin_lyrics', { phase: 'edit' }));
    // (4) and a revision continuation killed mid-run, after its first checkpoint
    //     if the worker writes one before it finishes -- on a SECOND suspended
    //     session S1b, so S1 itself stays unanswered for the read phase
    const begunB = receiptOf(await call('begin_lyrics', { phase: 'edit' }));
    const subB = await call('lyric_revise', { session_id: begunB.session_id, draft, ...mandate });
    const doneB = await poll((sc(subB) ?? receiptOf(subB)).operation_id);
    const S1b = doneB.v.session_id;
    const ans = await call('lyric_revise', { session_id: S1b, answer });
    const ansV = sc(ans) ?? receiptOf(ans);
    let progressSeen = false;
    for (let i = 0; i < 2000; i++) {
      const rec = store.get(ansV.operation_id);
      if (rec?.progress) {
        progressSeen = true;
        break;
      }
      if (rec?.state !== 'pending') break;
      await new Promise((res) => setTimeout(res, 5));
    }
    const ansRec = store.get(ansV.operation_id);
    const killed = await call('lyric_check', { session_id: begun3.session_id, lines: draft, scheme: 'AA' });
    const killedV = sc(killed) ?? receiptOf(killed);
    const saved = {
      S1,
      S1b,
      grade_op: gV.operation_id,
      killed_grade_op: killedV.operation_id,
      killed_revise_op: ansV.operation_id,
      killed_revise_state_at_exit: ansRec?.state,
      killed_revise_progress_at_exit: progressSeen,
      writer_identity: identity,
    };
    log('saved', saved);
    fs.writeFileSync(file, JSON.stringify(saved, null, 1));
    // die abruptly: the store keeps the pending records as they are on disk
    process.exit(0);
  } else if (mode === 'read') {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    results.same_identity = saved.writer_identity === identity;
    results.writer_identity = saved.writer_identity;
    // records as this process loaded them
    log('records_on_load', {
      S1: store.get(saved.S1)?.state,
      grade_op: store.get(saved.grade_op)?.state,
      killed_grade_op: {
        state: store.get(saved.killed_grade_op)?.state,
        interruption: store.get(saved.killed_grade_op)?.interruption,
      },
      killed_revise_op: {
        state: store.get(saved.killed_revise_op)?.state,
        interruption: store.get(saved.killed_revise_op)?.interruption,
        has_progress: !!store.get(saved.killed_revise_op)?.progress,
        progress_semantic_identity:
          store.get(saved.killed_revise_op)?.progress?.connector_semantic_identity ?? null,
        progress_reader_scheme: store.get(saved.killed_revise_op)?.progress
          ? (store.get(saved.killed_revise_op).progress.reader_scheme ?? '(absent)')
          : null,
      },
    });
    // get_operation reads (read-only)
    log('get_S1', brief(await call('get_operation', { operation_id: saved.S1 })));
    log(
      'get_grade_findings',
      brief(await call('get_operation', { operation_id: saved.grade_op, detail: 'findings' }))
    );
    log('get_killed_grade', brief(await call('get_operation', { operation_id: saved.killed_grade_op })));
    log(
      'get_killed_revise',
      brief(await call('get_operation', { operation_id: saved.killed_revise_op }))
    );
    // resume_operation across the release
    log(
      'resume_killed_grade',
      brief(await call('resume_operation', { operation_id: saved.killed_grade_op }))
    );
    log(
      'resume_killed_revise',
      brief(await call('resume_operation', { operation_id: saved.killed_revise_op }))
    );
    // continue the suspended run with its answer
    const cont = await call('lyric_revise', { session_id: saved.S1, answer });
    log('continue_S1_answer', brief(cont));
    const contV = sc(cont) ?? receiptOf(cont);
    if (contV?.operation_id && contV.status === 'pending') {
      const d = await poll(contV.operation_id);
      log('continue_S1_answer_done', brief(d.r));
    }
    // any other lyric tool on the old session
    const other = await call('lyric_check', { session_id: saved.grade_op, lines: draft, scheme: 'AA' });
    log('lyric_check_on_old_session', brief(other));
    // recover_only on the old session
    log(
      'recover_only_S1',
      brief(await call('lyric_revise', { session_id: saved.S1, recover_only: true }))
    );
    // a new session still works
    const fresh = receiptOf(await call('begin_lyrics', { phase: 'edit' }));
    const fg = await call('lyric_check', { session_id: fresh.session_id, lines: draft, scheme: 'AA' });
    const fgV = sc(fg) ?? receiptOf(fg);
    log('fresh_session_grade', brief((await poll(fgV.operation_id)).r));
    // caller-managed (raw) state through the SAME shared surface, no session_id
    if (rawStateFile) {
      const raw = JSON.parse(fs.readFileSync(rawStateFile, 'utf8'));
      log('shared_surface_raw_state', brief(await call('lyric_revise', { state: raw.state, answer })));
    }
    fs.writeFileSync(out, JSON.stringify(results, null, 1));
  }
} finally {
  if (mode !== 'write') {
    await client.close();
    await server.close();
    process.exit(0);
  }
}
