// The parked new song's continuation, on the REAL lyric harness: a revise
// that stops with open lines says how to go on, skipping the grade it names is
// refused, and following it starts a new run. It walks the whole creation
// order (sweep, screen, plan, grade, revise, grade, revise): 55-60 s here, of
// which the first grade is about 29 s (a second grade of the same draft is
// 4 s), and 85 s to past 120 s on a CI runner beside other leaves.
//
// So this file is its own leaf, run WITHOUT --test-timeout: node applies that
// flag to each FILE, and the 120 s the other session suites share cut this
// test off (main CI 2776 and 2777, PR 428's first attempt) while it was
// passing, under the 300 s it declares for itself below. That declared
// timeout is the one that governs it now.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';
import { BRIEFS } from './lyric_tools.js';

function storeFor(t) {
  const directory = mkdtempSync(join(tmpdir(), 'chatgpt-mcp-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, store: new JobStore(directory) };
}

test('a parked new song continues exactly as its note says', { timeout: 300_000 }, async (t) => {
  const sessions = new WorkflowSessions({ store: storeFor(t).store });
  let session_id = sessions.open('lyrics').session_id;
  const run = async (name, args) => {
    const q = sessions.submit(session_id, 'lyrics', name, args);
    await sessions.wait(q.operation_id);
    const r = sessions.status(q.operation_id, 'lyrics');
    if (r.session_id) session_id = r.session_id;
    return r;
  };
  const swept = await run('lyric_sweep', { seed_from: 31, count: 1, lines: 12 });
  const seed = verdictOf(swept.tool_result).accepted_shown[0];
  await run('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
  await run('lyric_plan', { seed, lines: 12 });
  const draft = [
    'The kettle hums a low and steady tone',
    'I hear it singing when I am alone',
    'Morning light',
    'The window holds the frost',
    'I count the things I lost',
    // ~~'Morning light'~~ — since 2026-10-04 banned pairs no longer hold a line
    // open (owner's ruling), so the park comes from the plan's declared
    // returns (3-7, 4-8, 5-9, 6-10) not repeated verbatim, line FLAGs no
    // attempt-free run can close. L3 itself is not open: it is a partner (of
    // group A and of return 3-7), so a parked rewrite may change it.
    'Morning lights',
    'Down the road the old dog sleeps',
    'Down the lane the cold fog creeps',
    'Nobody calls the house at night',
    'Nobody walls the mouse from sight',
    'I will keep the fire going',
    'I will keep the fire glowing',
  ];
  const budget = { max_rounds: 1, attempts: 0, backtrack: 0 };
  await run('lyric_grade', { seed, draft });
  // An earlier run on this song left L3 protected. L3 is not open at the
  // park, but it is a partner of open lines under the PLAN's groups and
  // returns (a planned run declares none), so the park briefs it, as the
  // website chat's parked note says, and the rewrite below may change it.
  BRIEFS.resetForTests();
  t.after(() => BRIEFS.resetForTests());
  await BRIEFS.capture({ runId: 'an-earlier-run', cur: draft, input: draft, flagged: [3] });
  const parked = await run('lyric_revise', { seed, draft, ...budget });
  assert.equal(verdictOf(parked.tool_result).exit_code, 3, JSON.stringify(parked));
  for (const e of BRIEFS.free.values())
    if (!e.retired) assert.ok(!e.prot.includes(3), JSON.stringify(e.prot));
  // As data: the choice is the writer's (which words), and the call that
  // takes the rewritten draft in this session is the grade. No run id shows.
  assert.deepEqual(verdictOf(parked.tool_result).outcome, {
    kind: 'decision',
    by: 'writer',
    call: { tool: 'lyric_grade', args: { seed } },
  });
  const note = parked.tool_result.content[0].text.match(/\n\nCONTINUE: [\s\S]*$/)[0];
  const procedure =
    'grade the complete rewritten draft with lyric_grade, then call lyric_revise with that exact draft and new_run: true';
  const plain = (text) => text.replaceAll('`', '');
  assert(plain(note).includes(procedure), note);
  // The plugin skill hosts load defers to that note rather than restating it.
  const skill = readFileSync(
    new URL('../plugins/codex-musica/skills/lyric-workflows/SKILL.md', import.meta.url),
    'utf8'
  );
  assert(plain(skill).includes("If a run has stopped, follow the stop's CONTINUE/NEXT line"));
  // A regrade after the stop names the same call as the note: new_run: true.
  const regraded = verdictOf((await run('lyric_grade', { seed, draft })).tool_result);
  assert.deepEqual(regraded.next_call, { tool: 'lyric_revise', args: { seed, new_run: true } });
  // The session holds the graded draft, so the call it names sends none
  // (writer plan, stage 2).
  assert.match(
    regraded.next,
    /^Call lyric_revise with this grade's seed, new_run: true and no draft: /
  );
  // Followed to the letter, with no draft: the graded draft is the one
  // revised, and the same draft stops on the same lines.
  const again = await run('lyric_revise', { seed, new_run: true, ...budget });
  assert(!again.tool_error, JSON.stringify(again));
  assert.equal(verdictOf(again.tool_result).exit_code, 3, JSON.stringify(again));
  const rewritten = draft.map((line) =>
    line === 'Morning light' ? 'Morning comes in slow' : line
  );
  // Skipping the grade is refused, and the refusal names the grade.
  const skipped = await run('lyric_revise', { draft: rewritten, new_run: true, ...budget });
  assert.match(skipped.tool_result.content[0].text, /CREATION_GRADE: lyric_grade must answer/);
  // Following the note starts the new run.
  await run('lyric_grade', { seed, draft: rewritten });
  const resumed = await run('lyric_revise', { draft: rewritten, new_run: true, ...budget });
  assert(!resumed.tool_error, JSON.stringify(resumed));
  assert([0, 3].includes(verdictOf(resumed.tool_result).exit_code), JSON.stringify(resumed));
});

// The grade names the call that takes its exact draft on (`next`, the short
// verdict's last field), and following it is admitted; a changed draft, or a
// regraded rewrite while a run is open, is refused unless it says new_run.
test(
  'the next call a grade names is admitted, and only the exact graded draft follows it',
  { timeout: 300_000 },
  async (t) => {
    const sessions = new WorkflowSessions({ store: storeFor(t).store });
    let session_id = sessions.open('lyrics').session_id;
    const run = async (name, args) => {
      const q = sessions.submit(session_id, 'lyrics', name, args);
      await sessions.wait(q.operation_id);
      const r = sessions.status(q.operation_id, 'lyrics');
      if (r.session_id) session_id = r.session_id;
      return r;
    };
    const text = (r) => r.tool_result.content[0].text;
    // THE CENSUS, IN A REAL SESSION (writer plan, stage 2): each result says
    // who acts next as data, and the call it names is the one sent next. A
    // call the session did not admit would fail the step that follows it.
    const outcome = (r) => verdictOf(r.tool_result).outcome;
    const swept = await run('lyric_sweep', { seed_from: 31, count: 1, lines: 12 });
    const seed = verdictOf(swept.tool_result).accepted_shown[0];
    assert.deepEqual(outcome(swept), {
      kind: 'next_call',
      by: 'writer',
      call: { tool: 'lyric_screen', args: {} },
    });
    const screened = await run(outcome(swept).call.tool, {
      words: ['stove', 'coat'],
      relation: 'class:ASSONANCE',
    });
    // After the screen, the plan: the seed and the sweep's own length.
    assert.deepEqual(outcome(screened), {
      kind: 'next_call',
      by: 'writer',
      call: { tool: 'lyric_plan', args: { seed, lines: 12 } },
    });
    const planned = await run(outcome(screened).call.tool, outcome(screened).call.args);
    assert(!planned.tool_error, JSON.stringify(planned));
    assert.deepEqual(outcome(planned), {
      kind: 'next_call',
      by: 'writer',
      call: { tool: 'lyric_grade', args: { seed } },
    });
    const draft = [
      'The kettle hums a low and steady tone',
      'I hear it singing when I am alone',
      'Morning light',
      'The window holds the frost',
      'I count the things I lost',
      'Morning lights',
      'Down the road the old dog sleeps',
      'Down the lane the cold fog creeps',
      'Nobody calls the house at night',
      'Nobody walls the mouse from sight',
      'I will keep the fire going',
      'I will keep the fire glowing',
    ];
    const graded = await run('lyric_grade', { seed, draft });
    const short = verdictOf(graded.tool_result);
    assert([0, 3].includes(short.exit_code), JSON.stringify(short));
    assert.equal(Object.keys(short).at(-1), 'next', JSON.stringify(short));
    assert.match(
      short.next,
      /lyric_revise with this grade's seed and no draft: the graded draft and its declarations are taken from the record/
    );
    // No run is open yet: the graded draft, without new_run (#671, C4).
    assert.deepEqual(short.next_call, { tool: 'lyric_revise', args: { seed } });
    assert.deepEqual(short.outcome, { kind: 'next_call', by: 'writer', call: short.next_call });
    assert.doesNotMatch(short.next, /new_run/);
    const rewritten = draft.map((line) =>
      line === 'Morning light' ? 'Morning comes in slow' : line
    );
    const edited = await run('lyric_revise', { seed, draft: rewritten });
    assert.match(text(edited), /CREATION_GRADE: lyric_grade must answer/);
    // As `next` says: the grade's seed and no draft. The refused call above
    // changed nothing, so the graded draft is still the one on record.
    const opened = await run('lyric_revise', { seed });
    assert(!opened.tool_error, JSON.stringify(opened));
    const open = verdictOf(opened.tool_result);
    assert.equal(open.exit_code, 4, 'the interview run is open: it asks its first question');
    // A pending question is the writer's to answer, through the same tool.
    assert.deepEqual(open.outcome, {
      kind: 'decision',
      by: 'writer',
      call: { tool: 'lyric_revise', args: { seed } },
    });
    const regraded = await run('lyric_grade', { seed, draft: rewritten });
    // A run is open: the grade's next says new_run (#671, C4).
    const reread = verdictOf(regraded.tool_result);
    assert.deepEqual(reread.next_call, { tool: 'lyric_revise', args: { seed, new_run: true } });
    assert.match(reread.next, /seed, new_run: true and no draft: /);
    const kept = await run('lyric_revise', { seed, draft: rewritten });
    assert.match(text(kept), /CREATION_CONTINUATION: draft differs from the recorded run/);
    const fresh = await run('lyric_revise', { seed, draft: rewritten, new_run: true });
    assert(!fresh.tool_error, JSON.stringify(fresh));
  }
);
