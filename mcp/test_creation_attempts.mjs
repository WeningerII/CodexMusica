// A screen or grade that ran but left no receipt is an ATTEMPT: the refusal
// that follows tells "not run" from "ran but did not answer" and "measured but
// not kept", and names the move that works. Offline: receipts are recorded
// from verdict fixtures, and the session-layer case stubs only the grade.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { LEXICON_MANIFEST } from './lexicon_basis.js';
import { creationRefusal, recordCreation, creationQualified } from './lyric_workflow.js';
import { _verdictInternals } from './lyric_tools.js';
import { JobStore } from './job_store.js';
import { INTEGRATION, WorkflowSessions, executeNative } from './workflow_sessions.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fresh = () => ({ domain: 'lyrics', phase: 'create' });
const sweepArgs = { seed_from: 10, count: 10, want: ['lines<=30'] };
const planArgs = { seed: 16, wants: ['lines<=30'] };
const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
const other = ['A different opening line', 'A different closing line'];
const OVERFLOW_HEADLINE =
  'REFUSED — song printed more than this connector can carry: its report ran past the 1 MiB output cap. The latest checkpoint and usage record remain available.';

function planReceipt(seed = 16) {
  const request = {
    seed,
    // The planner echoes the form it planned: `open` when the request
    // names none (2026-10-27, D7).
    form: 'open',
    lines: null,
    relation: '',
    functions: null,
    title: '',
    narrative: false,
    wants: ['lines<=30'],
  };
  const plan = {
    plan_version: 3,
    request,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{ name: 'VERSE' }],
  };
  return { exit_code: 0, plan, plan_sha256: sha(plan), plan_request: request };
}
const V1 = LEXICON_MANIFEST.versions.find((v) => v.id === 'v1');
function gradeReceipt(p, lines = draft) {
  return {
    ..._verdictInternals.verdictOf({
      code: 3,
      stdout: '',
      stderr: '',
      lyric_result: {
        version: 1,
        status: 'graded',
        command: 'song',
        coverage: {
          scope: 'requested_layers',
          certified: true,
          pairs_mandated: 1,
          pairs_judged: 1,
          pairs_refused: 0,
          obligations: [
            { id: 'floor:draft', layer: 'floor', status: 'answered' },
            { id: 'rhyme:1:2:A', layer: 'rhyme', status: 'answered' },
          ],
          refused_obligations: [],
        },
        final_draft: lines,
        findings: [],
        lexicon: { supplement_id: V1.id, sha256: V1.sha256 },
      },
    }),
    plan_sha256: p.plan_sha256,
  };
}
// The bridge's own overflow refusal, through the real verdict reader.
const overflowVerdict = () =>
  _verdictInternals.verdictOf({ code: 2, stdout: `  ${OVERFLOW_HEADLINE}\n`, stderr: '' });
// A crash: the harness died with no authenticated record and no headline.
const crashVerdict = () =>
  _verdictInternals.verdictOf({ code: -1, stdout: '', stderr: 'worker died' });
function swept(t) {
  recordCreation(t, 'lyric_sweep', sweepArgs, { exit_code: 0, accepted_shown: [16, 17] });
}
function planned(t) {
  swept(t);
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  const p = planReceipt();
  recordCreation(t, 'lyric_plan', planArgs, p);
  assert.ok(t.workflow.plan);
  return p;
}
const revise = (t, lines = draft) => creationRefusal(t, 'lyric_revise', { seed: 16, draft: lines });

test('a screen that ran but did not answer is told apart from a screen never run', () => {
  const t = fresh();
  swept(t);
  const never = creationRefusal(t, 'lyric_plan', planArgs);
  assert.equal(
    never,
    'CREATION_ORDER: execute a successful lyric_sweep and a successful lyric_screen before planning or writing a new song.'
  );
  recordCreation(
    t,
    'lyric_screen',
    { words: ['stove', 'coat'] },
    _verdictInternals.verdictOf({ code: 2, stdout: '  REFUSED — no tagger\n', stderr: '' })
  );
  assert.equal(t.workflow.screen, null);
  const told = creationRefusal(t, 'lyric_plan', planArgs);
  assert.ok(told.startsWith(never), told);
  assert.match(told, /lyric_screen ran in this session but did not answer \(exit 2/);
  assert.match(told, /its report names why/);
  assert.match(told, /call lyric_screen again once that cause is fixed/);
  // An overflowing screen names a smaller request: the same one overflows again.
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, overflowVerdict());
  assert.match(creationRefusal(t, 'lyric_plan', planArgs), /with a smaller request/);
  // A screen that answers removes the attempt, and the plan is admitted.
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 3 });
  assert.equal(t.workflow.screen_attempt, undefined);
  assert.equal(creationRefusal(t, 'lyric_plan', planArgs), null);
});

test('an overflowing grade tells the next revise of that draft, and only that draft', () => {
  const t = fresh();
  planned(t);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, overflowVerdict());
  assert.equal(t.workflow.grade, null);
  assert.equal(t.workflow.grade_attempt.cause, 'overflow');
  const told = revise(t);
  assert.match(told, /^CREATION_GRADE: lyric_grade must answer for this exact draft/);
  assert.match(told, /ran on this exact draft but did not answer with a grade receipt/);
  assert.match(told, /exit 2, measurement_status no_authenticated_verdict/);
  assert.match(told, /printed more than this connector can carry/);
  assert.match(told, /Grading this same draft again returns the same result/);
  assert.match(told, /plan fewer lines \(lyric_sweep declaring `lines`, then lyric_plan/);
  assert.match(told, /a different draft of this plan's 2 lines/);
  assert.doesNotMatch(told, /shorter draft/);
  // Another draft of the plan was never graded: the plain text, no attempt.
  assert.equal(
    revise(t, other),
    'CREATION_GRADE: lyric_grade must answer for this exact draft and canonical plan before revision starts.'
  );
});

test('a crashed grade names its report and a regrade of the same draft', () => {
  const t = fresh();
  planned(t);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, crashVerdict());
  assert.equal(t.workflow.grade_attempt.cause, 'other');
  const told = revise(t);
  assert.match(told, /did not answer with a grade receipt \(exit -1/);
  assert.match(told, /its report names why/);
  assert.match(told, /call lyric_grade again on this draft once it is fixed/);
  assert.doesNotMatch(told, /plan fewer lines/);
});

test('the attempt is not a receipt; a qualifying grade or a recorded plan clears it', () => {
  const t = fresh();
  const p = planned(t);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, overflowVerdict());
  // Only an attempt: revision is still refused, and the song cannot qualify.
  assert.match(revise(t), /^CREATION_GRADE/);
  recordCreation(t, 'lyric_revise', { seed: 16, draft }, { exit_code: 0 });
  assert.equal(creationQualified(t), false);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, gradeReceipt(p));
  assert.ok(t.workflow.grade);
  assert.equal(t.workflow.grade_attempt, undefined);
  assert.equal(revise(t), null);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, crashVerdict());
  assert.ok(t.workflow.grade_attempt);
  recordCreation(t, 'lyric_plan', planArgs, p);
  assert.equal(t.workflow.grade_attempt, undefined);
});

test('a tool error or a missing verdict records nothing, attempt included', () => {
  const t = fresh();
  planned(t);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, overflowVerdict(), true);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, null);
  assert.equal(t.workflow.grade_attempt, undefined);
  assert.equal(
    revise(t),
    'CREATION_GRADE: lyric_grade must answer for this exact draft and canonical plan before revision starts.'
  );
  const s = fresh();
  swept(s);
  recordCreation(s, 'lyric_screen', { words: ['a'] }, overflowVerdict(), true);
  assert.equal(s.workflow.screen_attempt, undefined);
});

test('the store refusing a measured grade as too large is told, and the next revise says why', async () => {
  const store = new JobStore(null);
  const big = 'x'.repeat(9 * 1024 * 1024 + 4096);
  const execute = async (session, name, args) => {
    if (name !== 'lyric_grade') return executeNative(session, name, args);
    // The grade measured and recorded its receipt; its result is over the
    // size one receipt keeps.
    const next = structuredClone(session);
    const p = planReceipt();
    recordCreation(next.native.task, name, { ...args, draft }, gradeReceipt(p));
    assert.ok(next.native.task.workflow.grade);
    const verdict = { ...gradeReceipt(p), padding: big };
    return {
      session: next,
      result: { content: [{ type: 'text', text: JSON.stringify(verdict) }] },
    };
  };
  const sessions = new WorkflowSessions({ store, execute });
  // Seed a new-song session that has swept, screened and planned.
  const session = sessions.fresh('lyrics');
  planned(session.native.task);
  const id = randomBytes(32).toString('hex');
  store.begin(id, { request_id: id, integration: INTEGRATION, action: 'open' }, {}, { session });
  store.complete(id, 200, { session, result: { content: [] } });

  const graded = sessions.submit(id, 'lyrics', 'lyric_grade', { seed: 16, draft });
  await sessions.wait(graded.operation_id);
  const read = sessions.status(graded.operation_id, 'lyrics');
  assert.equal(read.status, 'completed');
  assert.equal(read.tool_error, true);
  assert.ok(read.session_id, 'the refused call still continues the session');
  const text = read.tool_result.content[0].text;
  assert.match(text, /^SESSION_RESULT_NOT_KEPT: lyric_grade ran/);
  assert.match(text, /over the 9437184-byte limit this session can keep/);
  assert.match(text, /nothing the call produced was kept/);
  assert.match(text, /plan fewer lines \(lyric_sweep declaring `lines`, then lyric_plan/);
  assert.match(text, /A different draft of this plan may be too large as well/);
  // The kept session is the pre-call one: no grade receipt, an attempt marked.
  const kept = sessions.record(read.session_id, 'lyrics').session.native.task.workflow;
  assert.equal(kept.grade, null);
  assert.deepEqual(
    { cause: kept.grade_attempt.cause, exit: kept.grade_attempt.exit_code },
    { cause: 'not_kept', exit: 3 }
  );
  assert.equal(kept.grade_attempt.measurement_status, 'graded');

  // A real revise of the same draft through the real client is refused before
  // dispatch, and says the draft was measured but not kept.
  const revised = sessions.submit(read.session_id, 'lyrics', 'lyric_revise', { seed: 16, draft });
  await sessions.wait(revised.operation_id);
  const refusal = sessions.status(revised.operation_id, 'lyrics').tool_result.content[0].text;
  assert.match(refusal, /^CREATION_GRADE: lyric_grade must answer for this exact draft/);
  assert.match(refusal, /measured this exact draft \(exit 3, measurement_status graded\)/);
  assert.match(refusal, /nothing it produced was kept/);
  assert.match(refusal, /Grading this same draft again returns the same result/);
  assert.doesNotMatch(refusal, /shorter draft/);
});
