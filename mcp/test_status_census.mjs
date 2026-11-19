// THE STATUS CENSUS (writer plan, stages 0 and 2). Every result a lyric tool
// can return says who acts next, as data: `outcome` is one of four kinds
// (lyric_workflow.js, outcomeOf). This file walks a list of CASES, not a list
// of labels: one row per kind of result, built as the verdict that result
// carries, with what its outcome must be. Every text in a row is a
// placeholder; no line of a song is used.
//
// Part 1 judges the verdict alone (the raw engine reads nothing else).
// Part 2 sends real calls through the raw engine and reads `outcome` off what
// comes back, so the field is known to be wired and not only derivable.
// Part 3 is a host that keeps receipts: the call it names is sent through its
// real gate. Part 4 is a session's receipt with no verdict (running,
// interrupted, retired, refused), read and followed through a real session
// server.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JobStore } from './job_store.js';
import { WorkflowSessions } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { requestContext } from './execution_context.js';
import { continuationSemanticIdentity } from './state_codec.js';
import { LEXICON_MANIFEST } from './lexicon_basis.js';
import { _verdictInternals } from './lyric_tools.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { legacySession, legacyStated, legacySweep, stated } from './statement_fixture.mjs';
import {
  CREATION_FORM,
  DEFAULT_FORM,
  FORM_ROWS,
  OUTCOME_ACTORS,
  OUTCOME_KINDS,
  STATEABLE,
  creationRefusal,
  noneKeptDeclared,
  noneKeptMeaning,
  outcomeOf,
  planShareBound,
  recordCreation,
  sessionOutcome,
  statementsOf,
  withOutcome,
  withSessionOutcome,
} from './lyric_workflow.js';

const RUN = { run_id: '<run>', run_revision: 3 };
// The Song Forms catalog's ids: a new song's form is one of them (#902).
const CATALOG_IDS = JSON.parse(
  readFileSync(new URL('../data/song-forms.json', import.meta.url), 'utf8')
).map((f) => f.id);
// A coverage record with one refused row. `row` decides whose choice it is:
// a row about words (a line, a word, a pair) or a row that is a declaration.
const coverage = (row) => ({
  scope: 'requested_layers',
  certified: false,
  obligations: [{ id: 'floor:draft', layer: 'floor', status: 'answered' }, row],
  refused_obligations: [row.id],
});
const WORD_ROW = { id: 'rhyme:1:2:0', layer: 'rhyme', status: 'refused' };
const DECLARED_ROW = {
  id: '<layer>:<declared>',
  layer: '<layer>',
  status: 'refused',
  code: '<CODE>',
};
const call = (tool, args = {}) => ({ tool, args });

// [what the result is, the tool, its verdict, the outcome it must carry]
const CASES = [
  // ── lyric_sweep ──
  [
    'a sweep that accepted a seed',
    'lyric_sweep',
    { exit_code: 0, sweep_outcome: 'accepted', accepted_shown: [7] },
    { kind: 'next_call', by: 'writer', call: call('lyric_plan') },
  ],
  [
    'a sweep whose every seed the planner refused for the seed’s own draw',
    'lyric_sweep',
    {
      exit_code: 2,
      sweep_outcome: 'planner refused every seed',
      planner_refusals: [{ scope: 'seed', reason: '<reason>' }],
      window: { seed_from: 0, count: 10, next_seed_from: 10 },
    },
    { kind: 'next_call', by: 'writer', call: call('lyric_sweep', { seed_from: 10 }) },
  ],
  [
    'a sweep the planner refused for the request itself',
    'lyric_sweep',
    {
      exit_code: 2,
      sweep_outcome: 'planner refused every seed',
      planner_refusals: [{ scope: 'request', reason: '<reason>' }],
      window: { seed_from: 0, count: 10, next_seed_from: 10 },
    },
    { kind: 'decision', by: 'person', call: call('lyric_sweep') },
  ],
  [
    'a sweep in which no planned seed held every predicate',
    'lyric_sweep',
    {
      exit_code: 2,
      sweep_outcome: 'no seed kept',
      window: { seed_from: 0, count: 10, next_seed_from: 10 },
    },
    { kind: 'decision', by: 'person', call: call('lyric_sweep') },
  ],
  [
    'a sweep whose arguments were turned down',
    'lyric_sweep',
    { exit_code: 2, sweep_outcome: 'arguments refused', refusal: '<why>' },
    { kind: 'decision', by: 'writer', call: call('lyric_sweep') },
  ],
  // ── lyric_screen (the word-check) ──
  [
    'a word-check with no banned pair',
    'lyric_screen',
    { exit_code: 0, pairs: [] },
    { kind: 'next_call', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a word-check that names a banned pair',
    'lyric_screen',
    { exit_code: 3, pairs: [] },
    { kind: 'next_call', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a word-check that was refused',
    'lyric_screen',
    { exit_code: 2, refusal: '<why>' },
    { kind: 'decision', by: 'writer', call: call('lyric_screen') },
  ],
  // ── lyric_plan ──
  [
    'a plan',
    'lyric_plan',
    { exit_code: 0, next: '<sentence>', next_call: call('lyric_grade', { seed: 7 }) },
    { kind: 'next_call', by: 'writer', call: call('lyric_grade', { seed: 7 }) },
  ],
  [
    'a plan the planner refused',
    'lyric_plan',
    { exit_code: 2, refusal: '<why>' },
    { kind: 'decision', by: 'person', call: call('lyric_sweep') },
  ],
  [
    'a plan refused for the request itself',
    'lyric_plan',
    { exit_code: 2, refusal: '<why>', plan_refusal: { version: 1, scope: 'request' } },
    { kind: 'decision', by: 'person', call: call('lyric_sweep') },
  ],
  [
    'a plan refused for what its seed drew',
    'lyric_plan',
    { exit_code: 2, refusal: '<why>', plan_refusal: { version: 1, scope: 'seed' } },
    { kind: 'next_call', by: 'writer', call: call('lyric_sweep') },
  ],
  // ── lyric_grade ──
  [
    'a grade with nothing standing',
    'lyric_grade',
    { exit_code: 0, next: '<sentence>', next_call: call('lyric_revise', { seed: 7 }) },
    { kind: 'next_call', by: 'writer', call: call('lyric_revise', { seed: 7 }) },
  ],
  [
    'a grade with a flag standing',
    'lyric_grade',
    { exit_code: 3, next: '<sentence>', next_call: call('lyric_revise', { seed: 7 }) },
    { kind: 'next_call', by: 'writer', call: call('lyric_revise', { seed: 7 }) },
  ],
  [
    'a grade with a word that could not be judged',
    'lyric_grade',
    {
      exit_code: 2,
      measurement_status: 'graded',
      next: '<sentence>',
      coverage: coverage(WORD_ROW),
    },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a grade with a flag standing and a word that could not be judged',
    'lyric_grade',
    {
      exit_code: 2,
      measurement_status: 'graded',
      flags: 1,
      next: '<sentence>',
      coverage: coverage(WORD_ROW),
    },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a grade in which only a declaration could not be judged',
    'lyric_grade',
    {
      exit_code: 2,
      measurement_status: 'graded',
      next: '<sentence>',
      coverage: coverage(DECLARED_ROW),
    },
    { kind: 'decision', by: 'person', call: call('lyric_grade') },
  ],
  [
    'a grade that was refused with nothing measured',
    'lyric_grade',
    { exit_code: 2, measurement_status: 'refused', refusal: '<why>' },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a grade in which the engine died',
    'lyric_grade',
    { exit_code: 1, stderr: '<trace>' },
    { kind: 'unknown', by: 'writer', call: null },
  ],
  // ── lyric_check (pasted lyrics) ──
  [
    'a check with nothing standing',
    'lyric_check',
    { exit_code: 0, findings_measured: true, certified: true },
    { kind: 'decision', by: 'person', call: null },
  ],
  [
    'a check with a flag standing',
    'lyric_check',
    { exit_code: 3, next: '<sentence>', next_call: call('lyric_revise') },
    { kind: 'next_call', by: 'writer', call: call('lyric_revise') },
  ],
  [
    'a check with a word that could not be judged',
    'lyric_check',
    {
      exit_code: 2,
      measurement_status: 'graded',
      next: '<sentence>',
      coverage: coverage(WORD_ROW),
    },
    { kind: 'decision', by: 'writer', call: call('lyric_check') },
  ],
  [
    'a check that was refused',
    'lyric_check',
    { exit_code: 2, refusal: '<why>' },
    { kind: 'decision', by: 'writer', call: call('lyric_check') },
  ],
  // ── lyric_recover, lyric_verify ──
  [
    'pasted lyrics recovered whole',
    'lyric_recover',
    { exit_code: 0, lines: ['<line>'], mandate: {} },
    { kind: 'next_call', by: 'writer', call: call('lyric_check') },
  ],
  [
    'pasted lyrics recovered with a coordinate left to declare',
    'lyric_recover',
    { exit_code: 3, lines: ['<line>'], refusals: [{}] },
    { kind: 'decision', by: 'writer', call: call('lyric_check') },
  ],
  [
    'a recovery that was refused',
    'lyric_recover',
    { exit_code: 2, refusal: '<why>' },
    { kind: 'decision', by: 'writer', call: call('lyric_recover') },
  ],
  [
    'a verified rewrite, accepted or not',
    'lyric_verify',
    { exit_code: 0, accepted: true },
    { kind: 'decision', by: 'writer', call: call('lyric_revise') },
  ],
  // ── lyric_revise: each stop ──
  [
    'a revise waiting for an answer',
    'lyric_revise',
    { exit_code: 4, status: 'awaiting_proposal', ...RUN },
    { kind: 'decision', by: 'writer', call: call('lyric_revise', RUN) },
  ],
  [
    'a revise stopped at its time limit',
    'lyric_revise',
    { exit_code: 5, status: 'interrupted', ...RUN },
    { kind: 'next_call', by: 'writer', call: call('lyric_revise', RUN) },
  ],
  [
    'a finished revise',
    'lyric_revise',
    { exit_code: 0, status: 'finished_clean', ...RUN },
    { kind: 'finished' },
  ],
  [
    'a revise that ended clean and uncertified',
    'lyric_revise',
    { exit_code: 0, status: 'uncertified', coverage: coverage(WORD_ROW), ...RUN },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a revise stopped with lines open',
    'lyric_revise',
    { exit_code: 3, status: 'stopped_with_open_lines', loop_unresolved: 2, ...RUN },
    { kind: 'decision', by: 'writer', call: call('lyric_revise', RUN) },
  ],
  [
    'a revise stopped on a whole-draft flag',
    'lyric_revise',
    {
      exit_code: 3,
      status: 'stopped_with_whole_draft_flags',
      loop_unresolved: 0,
      loop_whole_flag_codes: ['<CODE>'],
      ...RUN,
    },
    { kind: 'decision', by: 'writer', call: call('lyric_revise', RUN) },
  ],
  [
    'an uncertified revise stop with lines open',
    'lyric_revise',
    {
      exit_code: 2,
      status: 'uncertified',
      loop_unresolved: 1,
      coverage: coverage(DECLARED_ROW),
      ...RUN,
    },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'an uncertified revise stop with no line open, a word unread',
    'lyric_revise',
    {
      exit_code: 2,
      status: 'uncertified',
      loop_unresolved: 0,
      coverage: coverage(WORD_ROW),
      ...RUN,
    },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'an uncertified revise stop with no line open, a declaration refused',
    'lyric_revise',
    {
      exit_code: 2,
      status: 'uncertified',
      loop_unresolved: 0,
      coverage: coverage(DECLARED_ROW),
      ...RUN,
    },
    { kind: 'decision', by: 'person', call: call('lyric_grade') },
  ],
  [
    'a revise whose last proposal has an unknown outcome',
    'lyric_revise',
    { exit_code: 5, status: 'uncertain_proposal', uncertain_proposal: true, ...RUN },
    { kind: 'unknown', by: 'writer', call: call('lyric_revise', { recover_only: true }) },
  ],
  [
    'a revise whose journal is full',
    'lyric_revise',
    { exit_code: 2, status: 'journal_capacity', resumable: false, new_run_required: true, ...RUN },
    { kind: 'decision', by: 'person', call: call('lyric_revise', { new_run: true }) },
  ],
  [
    'a recovery export',
    'lyric_revise',
    { exit_code: 0, status: 'recovered_artifact', resumable: false, new_run_required: true },
    { kind: 'decision', by: 'person', call: call('lyric_revise', { new_run: true }) },
  ],
  [
    'a revise that was refused',
    'lyric_revise',
    { exit_code: 2, status: 'refused', refusal: '<why>' },
    { kind: 'decision', by: 'writer', call: call('lyric_grade') },
  ],
  [
    'a revise in which the engine died',
    'lyric_revise',
    { exit_code: 1, stderr: '<trace>' },
    { kind: 'unknown', by: 'writer', call: null },
  ],
];

async function rawClient() {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'census', version: '1' }, { capabilities: {} });
  await client.connect(b);
  return { client, close: async () => (await client.close(), await server.close()) };
}

test('every case carries one of the four outcomes, with its actor and its call', async () => {
  const { client, close } = await rawClient();
  let served;
  try {
    served = new Set((await client.listTools()).tools.map((t) => t.name));
  } finally {
    await close();
  }
  const reached = new Set();
  for (const [what, tool, verdict, want] of CASES) {
    assert.ok(served.has(tool), `${what}: ${tool} is served`);
    // A revise for a seeded plan; the same stop with no seed is a revise of
    // lyrics the person supplied, and the tool that grades a changed draft
    // is then lyric_check.
    const got = outcomeOf(tool, verdict, tool === 'lyric_revise' ? { seed: 7 } : {});
    assert.deepEqual(got, want, what);
    if (tool === 'lyric_revise') {
      const supplied = outcomeOf(tool, verdict, {});
      assert.deepEqual(
        supplied,
        want.call?.tool === 'lyric_grade' ? { ...want, call: call('lyric_check') } : want,
        `${what}, on supplied lyrics`
      );
    }
    assert.ok(OUTCOME_KINDS.includes(got.kind), what);
    reached.add(got.kind);
    if (got.kind === 'finished') {
      // Only the finished-revise record is finished.
      assert.equal(tool, 'lyric_revise', what);
      assert.equal(verdict.status, 'finished_clean', what);
      assert.deepEqual(Object.keys(got), ['kind'], what);
      continue;
    }
    assert.ok(OUTCOME_ACTORS.includes(got.by), what);
    if (got.call) {
      assert.ok(served.has(got.call.tool), `${what}: ${got.call.tool} is a served tool`);
      assert.deepEqual(Object.keys(got.call), ['tool', 'args'], what);
    }
    // The verdict's own named call and the outcome's are one object.
    if (verdict.next_call && got.kind === 'next_call') assert.equal(got.call, verdict.next_call);
    // An unknown result never names a call that does the action again: no
    // call, or the one that only reads what was kept.
    if (got.kind === 'unknown')
      assert.ok(got.call === null || got.call.args.recover_only === true, what);
    // No prose rides in the outcome: its strings are a kind, an actor, a tool
    // name and argument values.
    assert.ok(JSON.stringify(got).length < 200, what);
  }
  assert.deepEqual([...reached].sort(), [...OUTCOME_KINDS].sort(), 'every kind is reached');
  // Every lyric tool that answers with a verdict has a row.
  const covered = new Set(CASES.map(([, tool]) => tool));
  for (const name of served)
    if (name.startsWith('lyric_') && name !== 'lyric_types')
      assert.ok(covered.has(name), `${name} has no case`);
  // Each revise exit is a row.
  const reviseExits = new Set(
    CASES.filter(([, t]) => t === 'lyric_revise').map(([, , v]) => v.exit_code)
  );
  assert.deepEqual([...reviseExits].sort(), [0, 1, 2, 3, 4, 5]);
});

test('a clean grade or check is never finished; a verdict-less result has no outcome', () => {
  for (const tool of ['lyric_grade', 'lyric_check', 'lyric_plan', 'lyric_sweep', 'lyric_screen'])
    for (const exit_code of [0, 3])
      assert.notEqual(outcomeOf(tool, { exit_code, status: 'finished_clean' })?.kind, 'finished');
  assert.equal(outcomeOf('lyric_grade', null), null);
  assert.equal(outcomeOf('lyric_grade', { refusal: '<text>' }), null);
  // The verdict block gets the field; the song block and a refusal's text do not change.
  const song = { type: 'text', text: '<song>' };
  const verdict = { exit_code: 0, status: 'finished_clean' };
  const out = withOutcome('lyric_revise', {
    content: [song, { type: 'text', text: JSON.stringify(verdict) }],
  });
  assert.equal(out.content[0], song);
  assert.deepEqual(JSON.parse(out.content[1].text), { ...verdict, outcome: { kind: 'finished' } });
  const refused = { content: [{ type: 'text', text: 'Error: <refusal>' }], isError: true };
  assert.equal(withOutcome('lyric_revise', refused), refused);
  const recipe = { content: [{ type: 'text', text: JSON.stringify({ exit_code: 0 }) }] };
  assert.equal(withOutcome('render_recipe', recipe), recipe);
});

// Real calls through the raw engine: the field is on what comes back.
test('the raw engine publishes the outcome on real results', { timeout: 600_000 }, async () => {
  const { client, close } = await rawClient();
  const verdictOf = (r) => {
    for (const block of [...r.content].reverse()) {
      try {
        const v = JSON.parse(block.text);
        if (Number.isInteger(v?.exit_code)) return v;
      } catch {
        /* a song or a report */
      }
    }
    return null;
  };
  try {
    const sweep = verdictOf(
      await client.callTool({ name: 'lyric_sweep', arguments: { seed_from: 0, count: 20 } })
    );
    assert.equal(sweep.exit_code, 0);
    assert.deepEqual(sweep.outcome, outcomeOf('lyric_sweep', sweep));
    assert.equal(sweep.outcome.call.tool, 'lyric_plan');
    const seed = sweep.accepted_shown[0];
    const plan = verdictOf(await client.callTool({ name: 'lyric_plan', arguments: { seed } }));
    assert.equal(plan.exit_code, 0);
    assert.equal(plan.outcome.kind, 'next_call');
    assert.deepEqual(plan.outcome.call, plan.next_call);
    // A seed outside every form's range is refused by the planner or the schema;
    // either way no result without a verdict gains a field.
    const types = await client.callTool({ name: 'lyric_types', arguments: {} });
    assert.equal(verdictOf(types)?.outcome, undefined);
  } finally {
    await close();
  }
});

test('windows the planner refused whole: one window names the next; a host that keeps receipts adds them up', () => {
  const refusedWindow = (from, count) => ({
    exit_code: 2,
    sweep_outcome: 'planner refused every seed',
    planner_refusals: [{ scope: 'seed', reason: '<reason>' }],
    window: { seed_from: from, count, next_seed_from: from + count },
    swept: count,
    plan_share_bound: Math.round(planShareBound(count) * 1e4) / 1e4,
  });
  const sweepOn = (from) => ({
    kind: 'next_call',
    by: 'writer',
    call: call('lyric_sweep', { seed_from: from }),
  });
  const change = { kind: 'decision', by: 'person', call: call('lyric_sweep') };
  // Every window size the tool admits; no size is special.
  for (let count = 1; count <= 64; count++) {
    // The raw engine reads one window, and one window cannot say more than
    // "another seed may plan": at its own bound a further window of the same
    // size finds a plan 95 times in 100.
    assert.deepEqual(outcomeOf('lyric_sweep', refusedWindow(0, count)), sweepOn(count));
    // A host that keeps receipts counts the seeds refused in a row under one
    // request. Sweeping on stops being the next call at the first window
    // after which a further one is more likely than not to find no plan
    // (1 - 0.05^(count / seeds) < 1/2), and not before.
    const task = { domain: 'lyrics', phase: 'create' };
    const args = { form: '<form>', want: ['<predicate>'] };
    let seeds = 0;
    let stopped = null;
    for (let k = 1; k <= 8 && stopped == null; k++) {
      const from = seeds;
      const v = refusedWindow(from, count);
      recordCreation(task, 'lyric_sweep', { ...args, seed_from: from, count }, v);
      seeds += count;
      const spent = 1 - (1 - planShareBound(seeds)) ** count < 0.5;
      assert.deepEqual(
        sessionOutcome(task, 'lyric_sweep', v, null, {}),
        spent ? change : sweepOn(seeds),
        `${count} seed(s) a window, window ${k}`
      );
      if (spent) stopped = k;
    }
    // The same number of windows whatever their size.
    assert.equal(stopped, 5, `${count} seed(s) a window`);
    // A changed request starts the count again, and so does a window that planned.
    const again = refusedWindow(0, count);
    recordCreation(task, 'lyric_sweep', { ...args, lines: 12, seed_from: 0, count }, again);
    assert.deepEqual(sessionOutcome(task, 'lyric_sweep', again, null, {}), sweepOn(count));
    recordCreation(
      task,
      'lyric_sweep',
      { ...args, seed_from: 0, count },
      { exit_code: 0, sweep_outcome: 'accepted', accepted_shown: [0], swept: count }
    );
    assert.equal(task.workflow.refused_sweep, undefined);
  }
});

test('a session states the seeds refused in a row beside the outcome it worked out from them', () => {
  const task = { domain: 'lyrics', phase: 'create' };
  const window = (from) => ({
    exit_code: 2,
    sweep_outcome: 'planner refused every seed',
    planner_refusals: [{ scope: 'seed', reason: '<reason>' }],
    window: { seed_from: from, count: 4, next_seed_from: from + 4 },
    swept: 4,
    window_meaning: '<one window>',
    next: '<sentence>',
  });
  const published = (from) => {
    const v = window(from);
    recordCreation(task, 'lyric_sweep', { seed_from: from, count: 4 }, v);
    const out = withSessionOutcome(
      task,
      'lyric_sweep',
      { content: [{ type: 'text', text: JSON.stringify(v) }] },
      null,
      {}
    );
    return JSON.parse(out.content[0].text);
  };
  const first = published(0);
  assert.deepEqual(first.refused_in_a_row, {
    seeds: 4,
    plan_share_bound: Math.round(planShareBound(4) * 1e4) / 1e4,
  });
  assert.equal(first.window_meaning, '<one window>', 'one window adds no second sentence');
  assert.equal(first.outcome.kind, 'next_call');
  const second = published(4);
  assert.equal(second.refused_in_a_row.seeds, 8);
  assert.match(
    second.window_meaning,
    /^<one window> Across the windows refused in a row under this request, none of the 8 seeds planned: at most \d+\.\d% of seeds plan \(95% bound\)\.$/
  );
  // `next` stays the last field, with the outcome ahead of it.
  assert.deepEqual(Object.keys(second).slice(-2), ['outcome', 'next']);
});

// ── A window that planned and kept no seed ──────────────────────────────────
// Stage 0's agents swept 7, 15 and 22 windows on one fixed paragraph. It told a
// caller who had declared `lines` to declare it "if you have not", pointed at
// the counts without saying one, and offered a further window without end.
test('a window that kept no seed says each count, and offers only what was not done', () => {
  const window = (count, held) => ({
    exit_code: 2,
    sweep_outcome: 'no seed kept',
    swept: count,
    planned: count,
    held_by: held.map((k, i) => ({ want: `<predicate ${i}>`, held: k })),
    accept_share_bound: Math.round(planShareBound(count) * 1e4) / 1e4,
    window: { seed_from: 0, count, next_seed_from: count },
  });
  for (let count = 1; count <= 64; count++) {
    const v = window(count, [0, count - 1, count]);
    // `lines` is 'draw' when a draw leaves the length to the planner under a
    // want that does not pin it (noneKeptDeclared).
    for (const lines of [false, true, 'draw'])
      for (const functions of [false, true]) {
        const said = noneKeptMeaning(v, { lines, functions });
        // Each predicate's own count is said, of the planned.
        assert.ok(
          said.includes(
            `Each predicate held on its own, of the ${count} planned: <predicate 0> on 0; <predicate 1> on ${count - 1}; <predicate 2> on ${count}.`
          ),
          said
        );
        assert.ok(
          said.includes(
            `None of the ${count} seed(s) swept was kept, so at most ${(100 * v.accept_share_bound).toFixed(1)}% of seeds are kept under this request (95% bound).`
          ),
          said
        );
        // Advice is offered only for what the call did not declare.
        assert.equal(said.includes('`lines`'), lines !== true, said);
        // A drawn length is the person's to change: the writer is told to ask,
        // and a value is named only in place of the draw, never beside it.
        assert.equal(said.includes('in place of `lines` in `draw`'), lines === 'draw', said);
        assert.equal(
          said.includes('ask the person whether to state a length'),
          lines === 'draw',
          said
        );
        assert.equal(said.includes('declare a target length'), lines === false, said);
        assert.equal(said.includes('`functions`'), !functions, said);
        assert.doesNotMatch(said, /if you have not/);
        // One window cannot rule out the next, so it is still offered.
        assert.match(said, /continue from next_seed_from\.$/);
      }
  }
});

test('a session adds up the windows that kept no seed, and stops offering another', () => {
  const change = { kind: 'decision', by: 'person', call: call('lyric_sweep') };
  for (let count = 1; count <= 64; count++) {
    const task = { domain: 'lyrics', phase: 'create' };
    const args = { form: '<form>', lines: 12, want: ['<predicate>'] };
    let seeds = 0;
    let stopped = null;
    const publish = (from, sent = args) => {
      const v = {
        exit_code: 2,
        sweep_outcome: 'no seed kept',
        swept: count,
        planned: count,
        held_by: [{ want: '<predicate>', held: 0 }],
        accept_share_bound: Math.round(planShareBound(count) * 1e4) / 1e4,
        window: { seed_from: from, count, next_seed_from: from + count },
        window_meaning: noneKeptMeaning({ swept: count, planned: count }, {}),
        next: '<sentence>',
      };
      const call_ = { ...sent, seed_from: from, count };
      recordCreation(task, 'lyric_sweep', call_, v);
      return JSON.parse(
        withSessionOutcome(
          task,
          'lyric_sweep',
          { content: [{ type: 'text', text: JSON.stringify(v) }] },
          null,
          call_
        ).content[0].text
      );
    };
    for (let k = 1; k <= 8 && stopped == null; k++) {
      const out = publish(seeds);
      seeds += count;
      const spent = 1 - (1 - planShareBound(seeds)) ** count < 0.5;
      const bound = Math.round(planShareBound(seeds) * 1e4) / 1e4;
      assert.deepEqual(
        out.unkept_in_a_row,
        { seeds, accept_share_bound: bound, spent },
        `${count} seed(s) a window, window ${k}`
      );
      // Whose move it is does not change: a predicate is the person's to drop.
      assert.deepEqual(out.outcome, change);
      // The second window on states the sum; a spent run stops offering another.
      assert.equal(
        out.window_meaning.includes(
          `Across the windows swept in a row under this request, none of the ${seeds} seeds was kept: at most ${(100 * bound).toFixed(1)}% of seeds are kept (95% bound).`
        ),
        k > 1,
        out.window_meaning
      );
      assert.equal(out.window_meaning.includes('continue from next_seed_from'), !spent);
      assert.equal(out.window_meaning.includes('sweeping on is not offered'), spent);
      // `lines` was declared on every call, so it is never advised.
      assert.equal(out.window_meaning.includes('`lines`'), false, out.window_meaning);
      assert.deepEqual(Object.keys(out).slice(-2), ['outcome', 'next']);
      if (spent) stopped = k;
    }
    // The same number of windows whatever their size, as for refused windows.
    assert.equal(stopped, 5, `${count} seed(s) a window`);
    // A changed request starts the count again.
    assert.equal(publish(0, { ...args, lines: 13 }).unkept_in_a_row.seeds, count);
    // So does a window that kept a seed.
    recordCreation(
      task,
      'lyric_sweep',
      { ...args, lines: 13, seed_from: 0, count },
      { exit_code: 0, sweep_outcome: 'accepted', accepted_shown: [0], swept: count }
    );
    assert.equal(task.workflow.unkept_sweep, undefined);
  }
});

// The advice reads what the call STATED: a drawn length or roster, or a want
// that states it, is the person's choice already, and the paragraph does not
// tell the writer to choose a value in its place. A reordered `draw` list is
// the same request, so the windows still add up.
test('a window that kept no seed advises nothing the call stated by a draw or a want', () => {
  const rows = STATEABLE.filter((r) => ['lines', 'functions'].includes(r.field));
  const ways = (row) => [
    ['draw', { draw: [row.field] }],
    ...row.wants.map((k) => [
      'want',
      { want: [`${k.endsWith('.*') ? `${k.slice(0, -1)}<function>` : k}=1`] },
    ]),
  ];
  const v = (from) => ({
    exit_code: 2,
    sweep_outcome: 'no seed kept',
    swept: 4,
    planned: 4,
    held_by: [{ want: '<predicate>', held: 0 }],
    accept_share_bound: Math.round(planShareBound(4) * 1e4) / 1e4,
    window: { seed_from: from, count: 4, next_seed_from: from + 4 },
    window_meaning: '<one window>',
    next: '<sentence>',
  });
  const publish = (task, sent, from) => {
    const call_ = { ...sent, seed_from: from, count: 4 };
    recordCreation(task, 'lyric_sweep', call_, v(from));
    return JSON.parse(
      withSessionOutcome(
        task,
        'lyric_sweep',
        { content: [{ type: 'text', text: JSON.stringify(v(from)) }] },
        null,
        call_
      ).content[0].text
    );
  };
  for (const row of rows)
    for (const [way, said] of ways(row)) {
      const task = { domain: 'lyrics', phase: 'create' };
      const out = publish(task, { form: '<form>', ...said }, 0);
      assert.equal(out.window_meaning.includes(`\`${row.field}\``), false, `${way} ${row.field}`);
      const other = rows.find((r) => r !== row);
      assert.equal(out.window_meaning.includes(`\`${other.field}\``), true, `${way} ${row.field}`);
    }
  // Both drawn, the draw list sent in either order: the same request.
  const task = { domain: 'lyrics', phase: 'create' };
  const fields = rows.map((r) => r.field);
  publish(task, { form: '<form>', draw: fields }, 0);
  const second = publish(task, { form: '<form>', draw: [...fields].reverse() }, 4);
  assert.equal(second.unkept_in_a_row.seeds, 8);
  for (const f of fields) assert.equal(second.window_meaning.includes(`\`${f}\``), false, f);
});

test('a window that kept no seed advises a length to a call that only bounds it; the gate counts any bound', () => {
  // The planner's comparison operators, read from its table.
  const ops = JSON.parse(
    execFileSync(
      'python3',
      ['-c', 'import json, quality.plan as P; print(json.dumps(P.SWEEP_OPS))'],
      {
        cwd: fileURLToPath(new URL('../lyric-harness', import.meta.url)),
        encoding: 'utf8',
      }
    )
  );
  const [length] = STATEABLE.filter((r) => r.field === 'lines');
  const v = (from) => ({
    exit_code: 2,
    sweep_outcome: 'no seed kept',
    swept: 4,
    planned: 4,
    held_by: [{ want: '<predicate>', held: 0 }],
    accept_share_bound: Math.round(planShareBound(4) * 1e4) / 1e4,
    window: { seed_from: from, count: 4, next_seed_from: from + 4 },
    window_meaning: '<one window>',
    next: '<sentence>',
  });
  assert.ok(ops.includes('='));
  for (const name of length.wants)
    for (const op of ops) {
      const want = [`${name}${op}1`];
      const pins = op === '=';
      // The creation gate: any want on the length states it.
      assert.equal(
        statementsOf({ want }).missing.some((r) => r.field === 'lines'),
        false,
        `${want} states the length to the gate`
      );
      // The raw sweep's advice reads noneKeptDeclared; a draw of the length
      // beside a want that does not pin it leaves the length drawn.
      assert.equal(noneKeptDeclared({ want }).lines, pins, `${want} raw`);
      assert.equal(
        noneKeptDeclared({ want, draw: ['lines'] }).lines,
        pins || 'draw',
        `${want} raw, drawn`
      );
      // The session's advice, through its own rewrite, with the length left
      // out of `draw` and in it.
      for (const draw of [['functions'], ['functions', 'lines']]) {
        const task = { domain: 'lyrics', phase: 'create' };
        const call_ = { form: '<form>', draw, want, seed_from: 0, count: 4 };
        recordCreation(task, 'lyric_sweep', call_, v(0));
        const out = JSON.parse(
          withSessionOutcome(
            task,
            'lyric_sweep',
            { content: [{ type: 'text', text: JSON.stringify(v(0)) }] },
            null,
            call_
          ).content[0].text
        );
        const drawn = draw.includes('lines');
        assert.equal(
          out.window_meaning.includes('declare a target length in `lines`'),
          !pins && !drawn,
          `${want} ${draw} session`
        );
        assert.equal(
          out.window_meaning.includes('in place of `lines` in `draw`'),
          !pins && drawn,
          `${want} ${draw} session`
        );
        // A drawn length under a cap is put to the person, not replaced.
        assert.equal(
          out.window_meaning.includes('ask the person whether to state a length'),
          !pins && drawn,
          `${want} ${draw} session asks`
        );
        // The call the advice describes states the length once: a value
        // beside the draw is STATEMENT_CONFLICT, a value in its place is not.
        if (!pins && drawn) {
          const beside = { ...call_, lines: 1 };
          const inPlace = { ...beside, draw: draw.filter((f) => f !== 'lines') };
          assert.deepEqual(statementsOf(beside).conflict, ['lines'], `${want} beside`);
          assert.deepEqual(statementsOf(inPlace).conflict, [], `${want} in place`);
        }
      }
    }
});

// Real sweeps, the requests drawn by seed from the planner's own roster.
test(
  'real windows that keep no seed carry their counts and their bound',
  { timeout: 900_000 },
  async () => {
    const roster = JSON.parse(
      execFileSync(
        'python3',
        ['-c', 'import json, quality.plan as P; print(json.dumps(sorted(P.GENERATOR_ROSTER)))'],
        { cwd: fileURLToPath(new URL('../lyric-harness', import.meta.url)), encoding: 'utf8' }
      )
    );
    // A small seeded generator, so the draws repeat.
    let state = 20261116;
    const draw = (n) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % n;
    };
    const { client, close } = await rawClient();
    let kept_none = 0;
    try {
      for (let i = 0; i < 12; i++) {
        const other = roster[draw(roster.length)];
        const count = 2 + draw(4);
        const args = {
          // The native default form, at the raw boundary that keeps `form`:
          // with neither form field the sweep chooses a catalog setting
          // instead (#902), and these are the native windows' counts.
          form: DEFAULT_FORM,
          // ~~More instances of one function than a drawn pattern holds~~:
          // since stage 4 a stated section count is built into the draw, so
          // it no longer empties a window. A rhyme group deeper than drawn
          // plans reach does, beside one section of a drawn function.
          want: [`group>=${12 + draw(4)}`, `sections.${other}>=1`],
          seed_from: draw(50),
          count,
          // A length stated as a value, drawn, or left out.
          ...(i % 2 ? { lines: 8 + draw(33) } : i % 4 ? {} : { draw: ['lines'] }),
        };
        const length = args.lines != null || !!args.draw;
        const r = await client.callTool({ name: 'lyric_sweep', arguments: args });
        const v = JSON.parse(r.content[r.content.length - 1].text);
        if (v.sweep_outcome !== 'no seed kept') continue;
        kept_none++;
        assert.equal(v.accept_share_bound, Math.round(planShareBound(v.swept) * 1e4) / 1e4);
        // A `sections.F` want states the sections, so the roster is not advised.
        assert.equal(v.window_meaning, noneKeptMeaning(v, { lines: length, functions: true }));
        for (const h of v.held_by)
          assert.ok(v.window_meaning.includes(`${h.want} on ${h.held}`), v.window_meaning);
        assert.equal(v.window_meaning.includes('`lines`'), !length);
        assert.equal(v.window_meaning.includes('`functions`'), false);
        // The terminal report says the same bound and names the least-held predicate.
        assert.match(
          v.report,
          /at most \d+\.\d% of seeds are kept under this request \(95% bound\)/
        );
        const low = Math.min(...v.held_by.map((h) => h.held));
        assert.ok(
          v.report.includes(`held on its own least often (${low} of the ${v.planned} planned): `),
          v.report
        );
        assert.deepEqual(v.outcome, { kind: 'decision', by: 'person', call: call('lyric_sweep') });
      }
    } finally {
      await close();
    }
    assert.ok(kept_none >= 6, `only ${kept_none} of 12 drawn windows kept no seed`);
  }
);

// ── A host that keeps receipts: the call is the one its gate admits ─────────
// The real walk through a /mcp session is in mcp/test_chatgpt_parked.mjs (its
// own leaf: it runs the real harness for a minute). Here are the states that
// walk does not reach, built from receipts as the client records them, each
// followed through the gate itself (creationRefusal): a named call the gate
// refuses fails the row.
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const LINES = ['<line one>', '<line two>'];
const REWRITTEN = ['<line one, rewritten>', '<line two>'];
function planReceipt(seed = 16) {
  const request = {
    seed,
    form: 'open',
    lines: null,
    relation: '',
    functions: null,
    title: '',
    narrative: null,
    wants: ['lines<=30'],
  };
  const plan = {
    plan_version: 3,
    request,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{ name: '<SECTION>' }],
  };
  return { exit_code: 0, plan, plan_sha256: sha(plan), plan_request: request };
}
const V1 = LEXICON_MANIFEST.versions.find((v) => v.id === 'v1');
const gradeReceipt = (p) => ({
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
      final_draft: LINES,
      findings: [],
      lexicon: { supplement_id: V1.id, sha256: V1.sha256 },
    },
  }),
  plan_sha256: p.plan_sha256,
});
// A new-song task whose revision has started and stopped.
function started() {
  const t = { domain: 'lyrics', phase: 'create' };
  recordCreation(
    t,
    'lyric_sweep',
    { seed_from: 10, count: 10, want: ['lines<=30'] },
    {
      exit_code: 0,
      accepted_shown: [16, 17],
    }
  );
  const p = planReceipt();
  recordCreation(t, 'lyric_plan', { seed: 16, wants: ['lines<=30'] }, p);
  recordCreation(t, 'lyric_screen', { words: ['<word>', '<word>'] }, { exit_code: 0 });
  recordCreation(t, 'lyric_grade', { seed: 16, draft: LINES }, gradeReceipt(p));
  recordCreation(t, 'lyric_revise', { seed: 16, draft: LINES }, { exit_code: 3 });
  assert.ok(t.workflow.started, 'the receipts record');
  return t;
}
const parkedRun = (extra = {}) => ({
  key: 'seed:16',
  seed: 16,
  parked: true,
  exit_code: 3,
  uncertified: false,
  draft: LINES,
  final_draft: LINES,
  decl: { seed: 16 },
  open: [1],
  whole: [],
  ...extra,
});
const STOP = { exit_code: 3, status: 'stopped_with_open_lines', loop_unresolved: 1 };
const EDIT = { domain: 'lyrics', phase: 'edit' };

test('a host that keeps receipts names the call its own gate admits', () => {
  const rows = [
    // [what, task, tool, verdict, the run the host holds after it, args, outcome, the call as sent]
    [
      'a stop in a session that does not carry the run: grade the rewritten draft',
      started(),
      'lyric_revise',
      STOP,
      null,
      { seed: 16 },
      { kind: 'decision', by: 'writer', call: call('lyric_grade', { seed: 16 }) },
      { draft: REWRITTEN },
    ],
    [
      'a stop the chat carries: the rewritten draft goes to the same run',
      started(),
      'lyric_revise',
      STOP,
      parkedRun(),
      { seed: 16 },
      { kind: 'decision', by: 'writer', call: call('lyric_revise', { seed: 16 }) },
      { draft: REWRITTEN },
    ],
    [
      'a stop held uncertified: whether to go on here is the person’s',
      started(),
      'lyric_revise',
      { exit_code: 2, status: 'uncertified', loop_unresolved: 1, coverage: coverage(WORD_ROW) },
      parkedRun({ exit_code: null, uncertified: true }),
      { seed: 16 },
      { kind: 'decision', by: 'person', call: call('lyric_grade', { seed: 16 }) },
      { draft: REWRITTEN },
    ],
    [
      'a proposal with an unknown outcome, whatever tool answers next',
      started(),
      'lyric_grade',
      { exit_code: 3, next: '<sentence>', next_call: call('lyric_revise', { seed: 16 }) },
      { key: 'seed:16', seed: 16, uncertain_proposal: true, checkpoint: '<checkpoint>' },
      { seed: 16 },
      { kind: 'unknown', by: 'writer', call: call('lyric_revise', { recover_only: true }) },
      null,
    ],
    [
      'supplied lyrics: a check with a flag',
      EDIT,
      'lyric_check',
      { exit_code: 3, next: '<sentence>', next_call: call('lyric_revise') },
      null,
      {},
      { kind: 'next_call', by: 'writer', call: call('lyric_revise') },
      { draft: LINES },
    ],
    [
      'supplied lyrics: a stop in a session that does not carry the run',
      EDIT,
      'lyric_revise',
      STOP,
      null,
      {},
      { kind: 'decision', by: 'writer', call: call('lyric_revise', { new_run: true }) },
      { draft: REWRITTEN },
    ],
    [
      'supplied lyrics: a pending question',
      EDIT,
      'lyric_revise',
      { exit_code: 4, status: 'awaiting_proposal', ...RUN },
      { args: { draft: LINES, state: '<state>' } },
      {},
      { kind: 'decision', by: 'writer', call: call('lyric_revise') },
      { answer: '<line>' },
    ],
    [
      'supplied lyrics: an uncertified stop is checked again',
      EDIT,
      'lyric_revise',
      { exit_code: 2, status: 'uncertified', loop_unresolved: 0, coverage: coverage(WORD_ROW) },
      null,
      {},
      { kind: 'decision', by: 'writer', call: call('lyric_check') },
      { lines: REWRITTEN },
    ],
  ];
  for (const [what, task, tool, verdict, carried, args, want, sent] of rows) {
    const got = sessionOutcome(structuredClone(task), tool, verdict, carried, args);
    assert.deepEqual(got, want, what);
    // The outcome never shows a run's private id: a session withholds it.
    assert.doesNotMatch(JSON.stringify(got), /run_id|run_revision/, what);
    if (!sent) continue;
    // Sent as named, with the words only the caller can supply: admitted.
    const refusal = creationRefusal(
      structuredClone(task),
      got.call.tool,
      { ...got.call.args, ...sent },
      got.call.tool === 'lyric_revise' && !got.call.args.new_run ? carried : null
    );
    assert.equal(refusal, null, `${what}: the gate admits the named call`);
  }
});

// THE WORD-CHECK FOLLOWS THE PLAN. A new song's calls come in the order sweep,
// plan, word-check, grade. The verdict alone names the next tool in that
// order. A host that keeps receipts names the call its gate admits, so a
// grade reached for under a plan with no word-check is that word-check.
const nextCall = (c) => ({ kind: 'next_call', by: 'writer', call: c });
test('the verdict alone: a kept sweep names the plan, an answered word-check names the grade', () => {
  const sweep = { exit_code: 0, sweep_outcome: 'accepted', accepted_shown: [16, 17] };
  assert.deepEqual(outcomeOf('lyric_sweep', sweep), nextCall(call('lyric_plan')));
  // Answered with no banned pair, and answered naming one.
  for (const exit_code of [0, 3])
    assert.deepEqual(
      outcomeOf('lyric_screen', { exit_code, pairs: [] }),
      nextCall(call('lyric_grade')),
      `exit ${exit_code}`
    );
});

test('a host that keeps receipts: after the plan the call is the word-check, and after the word-check the grade', () => {
  const t = { domain: 'lyrics', phase: 'create' };
  const sweepArgs = { seed_from: 10, count: 10, want: ['lines<=30'] };
  const sweep = { exit_code: 0, sweep_outcome: 'accepted', accepted_shown: [16, 17] };
  recordCreation(t, 'lyric_sweep', sweepArgs, sweep);
  // After the sweep: the plan, with the seed and the sweep's own wants. Sent
  // as named, it is admitted with no word-check on record.
  const planCall = call('lyric_plan', { seed: 16, wants: ['lines<=30'] });
  assert.deepEqual(
    sessionOutcome(structuredClone(t), 'lyric_sweep', sweep, null, sweepArgs),
    nextCall(planCall)
  );
  assert.equal(creationRefusal(t, planCall.tool, structuredClone(planCall.args)), null);
  const p = planReceipt();
  recordCreation(t, 'lyric_plan', planCall.args, p);
  assert.equal(t.workflow.plan?.sha256, p.plan_sha256, 'the plan records with no word-check');
  // After the plan: the word-check, whichever call the verdict itself names
  // (the raw plan's grade, or the word-check a session has already put there).
  for (const named of [call('lyric_grade', { seed: 16 }), call('lyric_screen')]) {
    const verdict = { ...p, next: '<sentence>', next_call: named };
    assert.deepEqual(outcomeOf('lyric_plan', verdict), nextCall(named));
    assert.deepEqual(
      sessionOutcome(structuredClone(t), 'lyric_plan', verdict, null, planCall.args),
      nextCall(call('lyric_screen')),
      `the plan verdict names ${named.tool}`
    );
  }
  // The grade is refused until then. The word-check, sent as named with the
  // words only the caller can supply, is admitted.
  assert.match(
    creationRefusal(structuredClone(t), 'lyric_grade', { seed: 16, draft: LINES }),
    /^CREATION_ORDER: lyric_grade needs one answered lyric_screen under this plan/
  );
  const words = { words: ['<word>', '<word>'] };
  assert.equal(
    creationRefusal(t, 'lyric_screen', { ...call('lyric_screen').args, ...words }),
    null
  );
  const screened = { exit_code: 0, pairs: [] };
  recordCreation(t, 'lyric_screen', words, screened);
  // After the word-check: the grade, with the plan's seed. Sent as named with
  // the draft, it is admitted.
  const afterScreen = sessionOutcome(structuredClone(t), 'lyric_screen', screened, null, words);
  assert.deepEqual(afterScreen, nextCall(call('lyric_grade', { seed: 16 })));
  assert.equal(
    creationRefusal(t, afterScreen.call.tool, { ...afterScreen.call.args, draft: LINES }),
    null
  );
});

// PART 4. A SESSION RECEIPT WITH NO VERDICT. A real session server over a real
// store; only the engine behind it is a stand-in, so an operation can be held
// running, cut off, or refused on purpose. Each receipt's `outcome` is read,
// then the call it names is sent as named and must be admitted.
function storeFor(t, options) {
  const directory = mkdtempSync(join(tmpdir(), 'census-sessions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, store: new JobStore(directory, options) };
}
async function sessionClient(t, sessions) {
  const server = await buildWorkflowServer({ domain: 'lyrics', sessions });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'census-sessions', version: '1' }, { capabilities: {} });
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}
const receiptOf = (result) => {
  assert(result.structuredContent, JSON.stringify(result).slice(0, 600));
  return result.structuredContent;
};
const send = async (client, name, args) =>
  receiptOf(await client.callTool({ name, arguments: args }));
// The call an outcome names, sent as named from the session the receipt gives.
const follow = (client, receipt, extra = {}) => {
  const { tool, args } = receipt.outcome.call;
  const session = ['get_operation', 'resume_operation', 'begin_lyrics'].includes(tool)
    ? {}
    : { session_id: receipt.session_id };
  return client.callTool({ name: tool, arguments: { ...session, ...args, ...extra } });
};
const done = (name) => ({ content: [{ type: 'text', text: `<${name} result>` }] });

test('a running operation is read again and never sent again; a dropped connection reads it too', async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let dispatched = 0;
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async (session, name) => {
      dispatched++;
      await gate;
      return { session, result: done(name) };
    },
  });
  let client = await sessionClient(t, sessions);
  const opened = await send(client, 'begin_lyrics', {});
  const sweep = { session_id: opened.session_id, seed_from: 1, count: 1 };
  const queued = await send(client, 'lyric_sweep', sweep);
  assert.equal(queued.status, 'pending');
  const poll = {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'get_operation', args: { operation_id: queued.operation_id } },
  };
  assert.deepEqual(queued.outcome, poll);
  // The same call sent twice is the same operation, still to be read.
  const twice = await send(client, 'lyric_sweep', sweep);
  assert.equal(twice.operation_id, queued.operation_id);
  assert.deepEqual(twice.outcome, poll);
  // Followed while it runs: admitted, and it says the same again.
  const reading = receiptOf(await follow(client, queued));
  assert.equal(reading.status, 'pending');
  assert.deepEqual(reading.outcome, poll);
  // The connection drops; the operation finishes; the named read still works.
  await client.close();
  release();
  await sessions.wait(queued.operation_id);
  client = await sessionClient(t, sessions);
  const finished = receiptOf(await follow(client, queued));
  assert.equal(finished.status, 'completed');
  assert.equal(finished.session_id, queued.operation_id);
  assert.equal(dispatched, 1, 'the work ran once');
  // WHEN THE HOST FAILS A CALL the server cannot speak, so the step is in what
  // an agent has already read: the description of the tool that reads an
  // operation. (Not the session guide: a host shows its first 4,096
  // characters, and they are full.) The step is the same call again. It is
  // that operation, finished or not, and the work is not run a second time.
  const described = (await client.listTools()).tools.find((x) => x.name === 'get_operation');
  assert.ok(
    described.description.includes(
      'When the host fails a call in transport (a 502 answer, a dropped connection), nothing says whether it was queued: send the same call again with the same session_id and arguments. A call that was queued is answered with that same operation and is never run twice.'
    ),
    described.description
  );
  const again = await send(client, 'lyric_sweep', sweep);
  assert.equal(again.operation_id, queued.operation_id);
  assert.equal(again.status, 'completed');
  assert.equal(dispatched, 1, 'the work still ran once');
});

test('an interrupted operation is resumed only when that is safe', async (t) => {
  // Resumable: a receipt written before dispatch is what a crash leaves.
  const { store, directory } = storeFor(t);
  let sessions = new WorkflowSessions({
    store,
    execute: async (session, name) => ({ session, result: done(name) }),
  });
  const opened = sessions.open('lyrics');
  const parent = store.get(opened.session_id);
  const cut = 'c'.repeat(64);
  store.begin(
    cut,
    {
      request_id: cut,
      continuation_id: opened.session_id,
      integration: parent.intent.integration,
      action: { tool: 'lyric_sweep', arguments: { seed_from: 1, count: 1 }, resumed: false },
    },
    {},
    { session: parent.response.body.session }
  );
  sessions = new WorkflowSessions({
    store: new JobStore(directory),
    execute: async (session, name) => ({ session, result: done(name) }),
  });
  let client = await sessionClient(t, sessions);
  const safe = await send(client, 'get_operation', { operation_id: cut });
  assert.equal(safe.status, 'interrupted');
  assert.equal(safe.resumable, true);
  assert.deepEqual(safe.outcome, {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'resume_operation', args: { operation_id: cut } },
  });
  const resumed = receiptOf(await follow(client, safe));
  await sessions.wait(resumed.operation_id);
  assert.equal(
    (await send(client, 'get_operation', { operation_id: resumed.operation_id })).status,
    'completed'
  );

  // Not resumable: a revise cut off with no safe position. The writer chooses
  // the draft to keep; the call that takes it is named per kind of session.
  for (const [phase, call, extra] of [
    ['create', { tool: 'lyric_grade', args: {} }, { seed: 1, draft: ['<line>'] }],
    ['edit', { tool: 'lyric_revise', args: { new_run: true } }, { draft: ['<line>'] }],
  ]) {
    let lost = true;
    const cutting = new WorkflowSessions({
      store: storeFor(t).store,
      execute: async (session, name) => {
        if (name === 'lyric_revise' && lost) {
          lost = false;
          throw new Error('connection lost');
        }
        return { session, result: done(name) };
      },
    });
    client = await sessionClient(t, cutting);
    const begun = await send(client, 'begin_lyrics', { phase });
    const revise = await send(client, 'lyric_revise', {
      session_id: begun.session_id,
      draft: ['<line>'],
      ...(phase === 'create' ? { seed: 1 } : {}),
    });
    await cutting.wait(revise.operation_id);
    const read = await send(client, 'get_operation', { operation_id: revise.operation_id });
    assert.equal(read.status, 'interrupted', phase);
    assert.equal(read.resumable, false, phase);
    assert.deepEqual(read.outcome, { kind: 'decision', by: 'writer', call }, phase);
    const next = await follow(client, read, extra);
    assert.notEqual(next.isError, true, `${phase}: ${JSON.stringify(next).slice(0, 400)}`);
    assert.equal(receiptOf(next).status, 'pending', phase);
  }

  // A writer request that may already have been charged: read, never repeat.
  const uncertain = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async () => {
      requestContext().onCheckpoint({
        version: 1,
        status: 'proposing',
        input_draft: ['<line>'],
        accepted_lines: ['<accepted line>'],
        answered: { propose: [], propose_group: [] },
        connector_declarations: { seed: 1, writer: 'interview' },
        connector_semantic_identity: continuationSemanticIdentity(),
      });
      requestContext().onProposerUsage({ in_flight: true });
      throw new Error('connection lost after the writer request was sent');
    },
  });
  client = await sessionClient(t, uncertain);
  const held = await send(client, 'begin_lyrics', { phase: 'edit' });
  const op = await send(client, 'lyric_revise', {
    session_id: held.session_id,
    draft: ['<line>'],
  });
  await uncertain.wait(op.operation_id);
  const unknown = await send(client, 'get_operation', { operation_id: op.operation_id });
  assert.equal(unknown.status, 'interrupted');
  assert.equal(unknown.uncertain_proposal, true);
  assert.equal(unknown.resumable, false);
  assert.deepEqual(unknown.outcome, {
    kind: 'unknown',
    by: 'writer',
    call: { tool: 'get_operation', args: { operation_id: op.operation_id } },
  });
  // The read it names is admitted, and what was accepted is in it.
  const record = receiptOf(await follow(client, unknown));
  assert.deepEqual(record.accepted_draft, ['<accepted line>']);
  assert.equal(record.outcome.kind, 'unknown');
});

// Stage 0, two runs: the server was killed for memory while one long grade
// ran; the agent resumed it as told; the resume was killed the same way. The
// receipt said "interrupted, resumable" both times.
test('an operation cut by a process restart says how many in a row; after two, resuming is the person’s choice', async (t) => {
  const { store, directory } = storeFor(t);
  const never = () => new Promise(() => {});
  let sessions = new WorkflowSessions({ store, execute: never });
  let client = await sessionClient(t, sessions);
  const opened = await send(client, 'begin_lyrics', {});
  const queued = await send(client, 'lyric_sweep', {
    session_id: opened.session_id,
    seed_from: 1,
    count: 1,
  });
  assert.equal(queued.status, 'pending');
  assert.equal(queued.restarts_in_a_row, undefined);
  // The process dies while it runs, and a new one opens the same store.
  const restart = async (execute) => {
    sessions = new WorkflowSessions({ store: new JobStore(directory), execute });
    client = await sessionClient(t, sessions);
  };
  await restart(never);
  const once = await send(client, 'get_operation', { operation_id: queued.operation_id });
  assert.equal(once.status, 'interrupted');
  assert.equal(once.interruption, 'process_restarted');
  assert.equal(once.resumable, true);
  assert.equal(once.restarts_in_a_row, 1);
  // One restart: resume it. The call is admitted on the restarted server.
  const resume = { tool: 'resume_operation', args: { operation_id: queued.operation_id } };
  assert.deepEqual(once.outcome, { kind: 'next_call', by: 'writer', call: resume });
  const resumed = receiptOf(await follow(client, once));
  assert.equal(resumed.status, 'pending');
  // The resume is cut the same way.
  await restart(async (session, name) => ({ session, result: done(name) }));
  const twice = await send(client, 'get_operation', { operation_id: resumed.operation_id });
  assert.equal(twice.status, 'interrupted');
  assert.equal(twice.resumable, true);
  assert.equal(twice.restarts_in_a_row, 2);
  // Two in a row: the same work has not survived twice, so going on is the
  // person's choice. The call that takes the answer is still the resume.
  assert.deepEqual(twice.outcome, {
    kind: 'decision',
    by: 'person',
    call: { tool: 'resume_operation', args: { operation_id: resumed.operation_id } },
  });
  // And when the person says yes, the resume works: admitted, run once, finished.
  const third = receiptOf(await follow(client, twice));
  assert.equal(third.status, 'pending');
  await sessions.wait(third.operation_id);
  const finished = await send(client, 'get_operation', { operation_id: third.operation_id });
  assert.equal(finished.status, 'completed');
  assert.equal(finished.restarts_in_a_row, undefined);
  assert.equal(finished.tool_result.content[0].text, '<lyric_sweep result>');
  // An interruption that is not a restart counts none.
  const cutting = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async () => {
      throw new Error('connection lost');
    },
  });
  const other = await sessionClient(t, cutting);
  const begun = await send(other, 'begin_lyrics', { phase: 'edit' });
  const lost = await send(other, 'lyric_revise', {
    session_id: begun.session_id,
    draft: ['<line>'],
  });
  await cutting.wait(lost.operation_id);
  const read = await send(other, 'get_operation', { operation_id: lost.operation_id });
  assert.equal(read.status, 'interrupted');
  assert.notEqual(read.interruption, 'process_restarted');
  assert.equal(read.restarts_in_a_row, undefined);
});

test('a retired id is followed to its successor, or the workflow is opened again', async (t) => {
  const store = storeFor(t, { maxPayloadRecords: 2 }).store;
  const sessions = new WorkflowSessions({
    store,
    execute: async (session, name) => ({ session, result: done(name) }),
  });
  const client = await sessionClient(t, sessions);
  // No successor: three sessions opened, the store keeps two.
  const first = sessions.open('lyrics');
  sessions.open('lyrics');
  sessions.open('lyrics');
  const gone = await send(client, 'get_operation', { operation_id: first.session_id });
  assert.equal(gone.status, 'retired');
  assert.deepEqual(gone.outcome, {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'begin_lyrics', args: {} },
  });
  const reopened = receiptOf(await follow(client, gone));
  assert.equal(reopened.status, 'completed');
  // A successor: the session advanced before its saved state was retired.
  const parent = sessions.open('lyrics');
  const child = sessions.submit(parent.session_id, 'lyrics', 'lyric_sweep', { seed_from: 1 });
  await sessions.wait(child.operation_id);
  sessions.open('lyrics');
  sessions.open('lyrics');
  const advanced = await send(client, 'get_operation', { operation_id: parent.session_id });
  assert.equal(advanced.status, 'retired');
  assert.equal(advanced.successor_id, child.operation_id);
  assert.deepEqual(advanced.outcome, {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'get_operation', args: { operation_id: child.operation_id } },
  });
  const successor = await follow(client, advanced);
  assert.notEqual(successor.isError, true);
  assert.equal(receiptOf(successor).operation_id, child.operation_id);
});

// Stage 3: a sweep that leaves a thing out waits on the person, with the rows
// it leaves out as data; one that gives a field a value and a draw is the
// writer's to settle. A new song's form is a catalog form (#902): a sweep
// that sends the legacy `form` is the writer's to send again without it.
// Each outcome, followed with what it lists, is admitted.
test('a new-song sweep refused for its statements is a decision, with the rows or fields as data', async (t) => {
  const sessions = new WorkflowSessions({ store: storeFor(t).store });
  const client = await sessionClient(t, sessions);
  const settled = async (receipt) => {
    await sessions.wait(receipt.operation_id);
    return send(client, 'get_operation', { operation_id: receipt.operation_id });
  };
  const opened = await send(client, 'begin_lyrics', {});
  // A catalog form named, picked by seed, and the rest left out. It states
  // the form and the sections; every other row is listed.
  const left = await settled(
    await send(client, 'lyric_sweep', {
      session_id: opened.session_id,
      seed_from: 0,
      count: 1,
      catalog_form: CATALOG_IDS[3 % CATALOG_IDS.length],
    })
  );
  assert.equal(left.tool_error, true);
  assert.deepEqual(left.outcome, {
    kind: 'decision',
    by: 'person',
    call: { tool: 'lyric_sweep', args: {} },
    missing: STATEABLE.filter((r) => r.field !== 'form' && r.field !== 'functions').map(
      ({ thing, field, draw }) => ({ thing, field, draw })
    ),
  });
  // The legacy `form`, with every other row stated: refused before it runs.
  const legacyArgs = { ...stated({ seed_from: 0, count: 1 }), form: FORM_ROWS[0].form };
  const legacy = await settled(
    await send(client, 'lyric_sweep', { session_id: left.session_id, ...legacyArgs })
  );
  assert.equal(legacy.tool_error, true);
  assert.deepEqual(legacy.outcome, {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'lyric_sweep', args: {} },
  });
  assert.ok(legacy.tool_result.content[0].text.startsWith(CREATION_FORM), legacy.tool_result);
  const twice = await settled(
    await send(client, 'lyric_sweep', {
      session_id: legacy.session_id,
      ...stated({ seed_from: 0, count: 1 }),
      lines: FORM_ROWS[0].min_lines,
    })
  );
  assert.equal(twice.tool_error, true);
  assert.deepEqual(twice.outcome, {
    kind: 'decision',
    by: 'writer',
    call: { tool: 'lyric_sweep', args: {} },
    conflict: ['lines'],
  });
  for (const kind of [twice.outcome.kind, left.outcome.kind, legacy.outcome.kind])
    assert.ok(OUTCOME_KINDS.includes(kind));
  // Followed with every listed row stated: the gate admits it (it queues).
  const next = await follow(client, twice, stated({ seed_from: 0, count: 1 }));
  assert.notEqual(next.isError, true);
  assert.equal(receiptOf(next).status, 'pending');
  const swept = await settled(receiptOf(next));
  // And the legacy sweep, followed without its `form` from the latest
  // session: admitted too.
  const { form: _legacy, ...without } = legacyArgs;
  const again = await follow(client, { ...legacy, session_id: swept.session_id }, without);
  assert.notEqual(again.isError, true);
  assert.equal(receiptOf(again).status, 'pending');
  await sessions.wait(receiptOf(again).operation_id);
});

test('a call refused in a new-song session names the call its gate admits', async (t) => {
  const sessions = new WorkflowSessions({
    store: storeFor(t).store,
    execute: async (session, name) =>
      name === 'lyric_grade'
        ? {
            session,
            result: { isError: true, content: [{ type: 'text', text: 'Error: <refusal>' }] },
          }
        : { session, result: done(name) },
  });
  const client = await sessionClient(t, sessions);
  const opened = await send(client, 'begin_lyrics', {});
  const refused = await send(client, 'lyric_grade', {
    session_id: opened.session_id,
    seed: 1,
    draft: ['<line>'],
  });
  await sessions.wait(refused.operation_id);
  const read = await send(client, 'get_operation', { operation_id: refused.operation_id });
  assert.equal(read.status, 'completed');
  assert.equal(read.tool_error, true);
  // Nothing is on record yet, so the gate's next call is the sweep.
  assert.deepEqual(read.outcome, {
    kind: 'next_call',
    by: 'writer',
    call: { tool: 'lyric_sweep', args: {} },
  });
  const next = await follow(client, read, { seed_from: 1, count: 1 });
  assert.notEqual(next.isError, true);
  assert.equal(receiptOf(next).status, 'pending');
});

// ── A plan reaches the caller at any length ─────────────────────────────────
// Stage 0's agents drew plans whose results were 100,520, 114,773 and 167,847
// characters; their client delivered none of them. Real sessions over the
// first seeds, undeclared so the planner draws the length.
test(
  'a session publishes a plan as its brief and a verdict that does not grow with it',
  { timeout: 900_000 },
  async (t) => {
    const sessions = new WorkflowSessions({ store: storeFor(t).store });
    const client = await sessionClient(t, sessions);
    const settled = async (receipt) => {
      await sessions.wait(receipt.operation_id);
      return send(client, 'get_operation', { operation_id: receipt.operation_id });
    };
    // The smallest plan result a client is known to have dropped.
    const DROPPED = 100_520;
    let longest = 0;
    for (let seed = 1; seed <= 6; seed++) {
      // A job saved with the native default form, whose long plans are this
      // bound's case: a new-song sweep refuses `form` now (#902).
      const job = await legacySweep(legacyStated({ seed_from: seed, count: 1 }));
      assert.equal(job.result.isError, undefined, job.result.content[0].text.slice(0, 300));
      const plan = await settled(
        await send(client, 'lyric_plan', {
          session_id: await legacySession(sessions, job.task),
          seed,
        })
      );
      assert.equal(plan.status, 'completed');
      const [brief, verdictBlock] = plan.tool_result.content;
      assert.equal(plan.tool_result.content.length, 2);
      const v = JSON.parse(verdictBlock.text);
      longest = Math.max(longest, v.plan_lines);
      // The verdict carries no structured copy, and its size does not follow the plan.
      assert.equal(Object.hasOwn(v, 'plan'), false);
      // `statements` (stage 3) is bounded by its own tables, not by the song:
      // each relation type once, each section function once.
      const statementChars = JSON.stringify(v.statements).length;
      assert.ok(
        verdictBlock.text.length - statementChars < 2000,
        `seed ${seed}: ${verdictBlock.text.length}`
      );
      const rows = Object.fromEntries(v.statements.rows.map((r) => [r.field, r.value]));
      assert.equal(new Set(rows.relation.types).size, rows.relation.types.length, 'each type once');
      assert.equal(
        new Set(rows.functions.functions).size,
        rows.functions.functions.length,
        'each function once'
      );
      assert.ok(
        brief.text.length + verdictBlock.text.length < DROPPED / 2,
        `seed ${seed}: ${v.plan_lines} lines publish ${brief.text.length + verdictBlock.text.length} characters`
      );
      // Who acts next is on it, and the brief is the stored brief. The call
      // is the word-check this plan's grade needs first.
      assert.equal(v.outcome.kind, 'next_call');
      assert.deepEqual(v.outcome.call, v.next_call);
      assert.deepEqual(v.next_call, { tool: 'lyric_screen', args: {} });
      assert.equal(typeof v.next, 'string');
      const full = await send(client, 'get_operation', {
        operation_id: plan.operation_id,
        detail: 'full',
      });
      assert.equal(full.tool_result.content[0].text, brief.text);
      const stored = JSON.parse(full.tool_result.content[1].text);
      assert.equal(stored.plan.total_lines, v.plan_lines);
      // The structured copy is still there to read, alone.
      const part = await send(client, 'get_operation', {
        operation_id: plan.operation_id,
        detail: 'plan',
      });
      assert.deepEqual(JSON.parse(part.tool_result.content[0].text), {
        exit_code: 0,
        detail: 'plan',
        plan: stored.plan,
      });
      // A part a plan does not have is refused by name, and `lines` narrows no plan.
      for (const [args, code] of [
        [{ detail: 'report' }, /^DETAIL_NOT_APPLICABLE: a lyric_plan has detail plan, full/],
        [{ detail: 'plan', lines: [1] }, /^LINES_NOT_APPLICABLE: /],
      ]) {
        const refused = await client.callTool({
          name: 'get_operation',
          arguments: { operation_id: plan.operation_id, ...args },
        });
        assert.equal(refused.isError, true);
        assert.match(refused.content[0].text, code);
      }
    }
    // The draws reached a long plan, so the bound was met at length.
    assert.ok(longest >= 400, `the longest plan drawn has ${longest} lines`);
  }
);

// ── A refused window's reason, whole, and its complete text on request ──────
// A real session. The roster is found in the planner's own table: the first
// one-function roster whose window is refused for what each seed drew.
test(
  'a session gives a refused window’s reasons whole, and their complete text as a detail',
  { timeout: 900_000 },
  async (t) => {
    const roster = JSON.parse(
      execFileSync(
        'python3',
        ['-c', 'import json, quality.plan as P; print(json.dumps(sorted(P.GENERATOR_ROSTER)))'],
        { cwd: fileURLToPath(new URL('../lyric-harness', import.meta.url)), encoding: 'utf8' }
      )
    );
    // The native default form's windows, which a new-song sweep refuses now
    // (#902): the session sweeps each as a saved job's sweep was run, on the
    // raw engine, and publishes the result as its own.
    const sessions = new WorkflowSessions({
      store: storeFor(t).store,
      execute: async (session, name, args) => {
        assert.equal(name, 'lyric_sweep');
        const job = await legacySweep({ ...args, form: DEFAULT_FORM });
        const next = structuredClone(session);
        next.native.task = job.task;
        return { session: next, result: job.published };
      },
    });
    const client = await sessionClient(t, sessions);
    let read = null;
    for (const fn of roster) {
      const opened = await send(client, 'begin_lyrics', {});
      const queued = await send(
        client,
        'lyric_sweep',
        stated({ session_id: opened.session_id, seed_from: 0, count: 2, functions: fn })
      );
      await sessions.wait(queued.operation_id);
      const done_ = await send(client, 'get_operation', { operation_id: queued.operation_id });
      const v = JSON.parse(done_.tool_result.content[0].text);
      if (v.sweep_outcome !== 'planner refused every seed') continue;
      if (!v.planner_refusals.every((g) => g.scope === 'seed')) continue;
      read = { receipt: done_, v };
      break;
    }
    assert(read, "some one-function roster is refused for the seed's own draw");
    // Published: each reason whole, no second copy of its text, and the note
    // that says where the rest is.
    for (const g of read.v.planner_refusals) {
      assert.match(g.reason, /[.)]$/, g.reason.slice(-40));
      assert.equal(Object.hasOwn(g, 'text'), false);
    }
    assert.match(read.v.detail, /detail "refusals"/);
    // Who acts stays after the note, as on every short view.
    const keys = Object.keys(read.v);
    assert.ok(keys.indexOf('detail') < keys.indexOf('outcome'), keys.join(','));
    // The detail read: the same reasons, each with the refusal's later lines.
    const detail = await send(client, 'get_operation', {
      operation_id: read.receipt.operation_id,
      detail: 'refusals',
    });
    const part = JSON.parse(detail.tool_result.content[0].text);
    assert.deepEqual(Object.keys(part), ['exit_code', 'detail', 'planner_refusals']);
    assert.deepEqual(
      part.planner_refusals.map(({ text: _text, ...g }) => g),
      read.v.planner_refusals
    );
    for (const g of part.planner_refusals) {
      assert.ok(g.text.startsWith(g.reason + '\n'), g.text);
      assert.ok(g.text.split('\n').length >= 2);
    }
  }
);
