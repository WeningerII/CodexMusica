// BB8: recover_only on the base-written, process-killed lyric_revise operation, read on <tree>.
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [tree, storeDir, idsFile] = process.argv.slice(2);
const m = (f) => import(pathToFileURL(path.join(tree, 'mcp', f)).href);
const { WorkflowSessions, SESSION_STORE_LIMITS } = await m('workflow_sessions.js');
const { JobStore } = await m('job_store.js');
const ids = JSON.parse(fs.readFileSync(idsFile, 'utf8'));
const sessions = new WorkflowSessions({ store: new JobStore(storeDir, SESSION_STORE_LIMITS), build: {} });
for (const [label, id] of [['killed_revise_op', ids.killed_revise_op], ['S1b', ids.S1b]]) {
  try {
    const out = sessions.recover(id, 'lyrics', {});
    const v = JSON.parse(out.content[0].text);
    console.log(label, 'OK', JSON.stringify({ status: v.status, source_format: v.source_format, source_semantic_identity: v.source_semantic_identity, checksum_verified: v.checksum_verified, final_draft: v.final_draft, replay_draft: v.replay_draft, resumable: v.resumable, new_run_required: v.new_run_required, journal_included: v.journal_included }));
  } catch (e) { console.log(label, 'THREW', e.code, e.message.slice(0, 300)); }
}
try { sessions.resume(ids.killed_revise_op, 'lyrics'); console.log('resume: no throw'); } catch (e) { console.log('resume THREW', e.code, '|', e.message); }
process.exit(0);
