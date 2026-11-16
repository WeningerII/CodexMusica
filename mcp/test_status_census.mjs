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
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { createHash } from 'node:crypto';
import { LEXICON_MANIFEST } from './lexicon_basis.js';
import { _verdictInternals } from './lyric_tools.js';
import {
  OUTCOME_ACTORS,
  OUTCOME_KINDS,
  creationRefusal,
  outcomeOf,
  recordCreation,
  sessionOutcome,
  withOutcome,
} from './lyric_workflow.js';

const RUN = { run_id: '<run>', run_revision: 3 };
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
    { kind: 'next_call', by: 'writer', call: call('lyric_screen') },
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
    { kind: 'next_call', by: 'writer', call: call('lyric_plan') },
  ],
  [
    'a word-check that names a banned pair',
    'lyric_screen',
    { exit_code: 3, pairs: [] },
    { kind: 'next_call', by: 'writer', call: call('lyric_plan') },
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
    { kind: 'decision', by: 'person', call: call('lyric_revise') },
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
    assert.equal(sweep.outcome.call.tool, 'lyric_screen');
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
  recordCreation(t, 'lyric_screen', { words: ['<word>', '<word>'] }, { exit_code: 0 });
  const p = planReceipt();
  recordCreation(t, 'lyric_plan', { seed: 16, wants: ['lines<=30'] }, p);
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
