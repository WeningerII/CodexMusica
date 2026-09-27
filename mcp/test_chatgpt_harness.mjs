// Session adapter tests that drive the REAL lyric harness: creation receipts
// and an edit-phase revision across reconnects. Split from test_chatgpt.mjs
// (and from test_chatgpt_revise.mjs) so each file stays inside the runner's
// per-file budget (--test-timeout) on CI runners.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';

function storeFor(t) {
  const directory = mkdtempSync(join(tmpdir(), 'chatgpt-mcp-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, store: new JobStore(directory) };
}

test('real lyric sweep, screen and plan receipts persist between operations', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new WorkflowSessions({ store });
  let session_id = sessions.open('lyrics').session_id;
  const run = async (name, args) => {
    const q = sessions.submit(session_id, 'lyrics', name, args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    assert(!r.tool_result.isError, JSON.stringify(r));
    session_id = r.session_id;
    return verdictOf(r.tool_result);
  };
  const swept = await run('lyric_sweep', { seed_from: 31, count: 1, lines: 12 });
  assert.equal(swept.exit_code, 0);
  const seed = swept.accepted_shown[0];
  assert(Number.isInteger(seed));
  const screened = await run('lyric_screen', {
    words: ['stove', 'coat'],
    relation: 'class:ASSONANCE',
  });
  assert.equal(screened.exit_code, 0, JSON.stringify(screened));
  sessions = new WorkflowSessions({ store: new JobStore(directory) });
  const planned = await run('lyric_plan', { seed, lines: 12 });
  assert.equal(planned.exit_code, 0);
  assert(sessions.store.get(session_id).response.body.session.native.task.workflow.plan);
  const q = sessions.submit(session_id, 'lyrics', 'lyric_revise', {
    seed,
    draft: Array(12).fill('The kettle whistles by the stove'),
  });
  await sessions.wait(q.operation_id);
  assert.match(
    sessions.status(q.operation_id, 'lyrics').tool_result.content[0].text,
    /CREATION_GRADE/
  );
});

test('real edit revision restores a question across reconnect and rejects changed replay input without losing the session', async (t) => {
  const { store, directory } = storeFor(t);
  let sessions = new WorkflowSessions({ store });
  let session_id = sessions.open('lyrics', { phase: 'edit' }).session_id;
  const run = async (args) => {
    const q = sessions.submit(session_id, 'lyrics', 'lyric_revise', args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    assert.equal(r.status, 'completed', JSON.stringify(r));
    session_id = r.session_id;
    return r.tool_result;
  };
  const initial = await run({
    scheme: 'AA',
    relation: 'type:rime riche',
    draft: ['Copper cat', 'Azure dog'],
    max_rounds: 1,
    backtrack: 0,
  });
  assert.equal(verdictOf(initial).exit_code, 4);
  assert(!/run_[a-f0-9]{64}/.test(JSON.stringify(initial)));
  // The raw engine's footnote names run_id; the session's names what works here.
  assert.match(
    initial.content[0].text,
    /\n\nCONTINUE: call lyric_revise with the latest session_id and `answer`[^\n]*The session carries the run, its state and its draft\.$/
  );
  sessions = new WorkflowSessions({ store: new JobStore(directory) });
  const changed = await run({
    draft: ['Different song', 'Entirely replaced'],
    answer: 'I hold you.',
  });
  assert(changed.isError);
  assert.match(changed.content[0].text, /SESSION_CONTINUATION/);
  const answered = await run({ answer: 'I left the basket underneath the oak' });
  assert(!answered.isError, JSON.stringify(answered));
  assert(verdictOf(answered).folded, JSON.stringify(answered));
});
