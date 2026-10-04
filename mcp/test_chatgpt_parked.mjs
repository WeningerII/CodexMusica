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
    // open (owner's ruling), so the park comes from a drifted declared return
    // (L3 -> L6), a line FLAG no attempt-free run can close.
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
  const parked = await run('lyric_revise', { seed, draft, ...budget });
  assert.equal(verdictOf(parked.tool_result).exit_code, 3, JSON.stringify(parked));
  const note = parked.tool_result.content[0].text.match(/\n\nCONTINUE: [\s\S]*$/)[0];
  const procedure =
    'grade the complete rewritten draft with lyric_grade, then call lyric_revise with that exact draft and new_run: true';
  const plain = (text) => text.replaceAll('`', '');
  assert(plain(note).includes(procedure), note);
  // The plugin skill hosts load gives the same procedure, word for word.
  const skill = readFileSync(
    new URL('../plugins/codex-musica/skills/lyric-workflows/SKILL.md', import.meta.url),
    'utf8'
  );
  assert(plain(skill).includes(procedure));
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
