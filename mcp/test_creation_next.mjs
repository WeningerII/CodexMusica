// P2 F1: every CREATION_* refusal, and a create session's sweep report, names
// the next call the gate admits — one derivation (nextCreationCall), appended
// at the maintained client and at /chat. This walks every gate state in three
// sweep shapes, sends wrong moves, and follows each NEXT the way a caller
// would: through the gate alone, through the real client, and through /chat's
// own wander and parked refusals with a stubbed model. The last case runs the
// real harness (sweep, screen, plan; no grade, so about 26 s here) on the
// client and on a /mcp session, so it runs in test:production:offline, whose
// CI job stages the tagger the harness reads, as test_chatgpt_parked.mjs does.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  SWEEP_COORDINATES,
  creationRefusal,
  recordCreation,
  nextCreationCall,
  formatNextCall,
  withNextCall,
  withSweepNext,
} from './lyric_workflow.js';
import { runTurn, LIMITS } from './gemini_agent.js';
import { _verdictInternals } from './lyric_tools.js';
import { LEXICON_MANIFEST } from './lexicon_basis.js';
import { encodeState } from './state_codec.js';
import { CONNECTOR_CONTRACT_VERSION } from './contract_version.js';
import { connectConnector } from './client.js';
import { buildServer } from './tools.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone = (v) => structuredClone(v);
const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
const rewritten = ['My kettle sings beside the stove', 'Your fingers brush my heavy coat'];
const other = ['A different opening line', 'A different closing line'];
const melody = '{"notes":[60,62]}';

// Three sweep shapes: no want, want only, and every coordinate declared.
const SHAPES = {
  none: { sweep: {}, plan: {}, request: {} },
  want: {
    sweep: { want: ['lines<=30'] },
    plan: { wants: ['lines<=30'] },
    request: { wants: ['lines<=30'] },
  },
  every: {
    sweep: {
      form: 'aaba',
      lines: 2,
      functions: 'verse,chorus',
      melody,
      want: ['lines<=30', 'before=verse,chorus'],
    },
    plan: {
      form: 'aaba',
      lines: 2,
      functions: 'verse,chorus',
      melody,
      wants: ['before=verse,chorus', 'lines<=30'],
    },
    request: {
      form: 'aaba',
      lines: 2,
      functions: ['verse', 'chorus'],
      melody: { notes: [60, 62] },
      wants: ['before=verse,chorus', 'lines<=30'],
    },
  },
};

function planReceipt(shape, seed) {
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
    wants: [],
    ...shape.request,
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
const coverage = () => ({
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
});
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
        coverage: coverage(),
        final_draft: lines,
        findings: [],
        lexicon: { supplement_id: V1.id, sha256: V1.sha256 },
      },
    }),
    plan_sha256: p.plan_sha256,
  };
}

const fresh = () => ({
  version: 2,
  domain: 'lyrics',
  phase: 'create',
  brief: 'New love song.',
  completedSteps: [],
});

// Every gate state, built only from recordCreation.
function states(shapeName) {
  const shape = SHAPES[shapeName];
  const sweepArgs = { seed_from: 10, count: 10, ...shape.sweep };
  const planArgs = (seed) => ({ seed, ...shape.plan });
  const at = {};
  const t = fresh();
  at.empty = clone(t);
  recordCreation(t, 'lyric_sweep', sweepArgs, { exit_code: 0, accepted_shown: [16, 17] });
  at.swept = clone(t);
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  at.screened = clone(t);
  const p = planReceipt(shape, 16);
  recordCreation(t, 'lyric_plan', planArgs(16), p);
  assert(t.workflow.plan, `${shapeName}: the plan receipt records`);
  at.planned = clone(t);
  const later = clone(t);
  recordCreation(
    later,
    'lyric_sweep',
    { ...sweepArgs, seed_from: 20 },
    {
      exit_code: 0,
      accepted_shown: [23, 24],
    }
  );
  at.later_page = later;
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, gradeReceipt(p));
  assert(t.workflow.grade, `${shapeName}: the grade receipt records`);
  at.graded = clone(t);
  recordCreation(t, 'lyric_revise', { seed: 16, draft }, { exit_code: 3 });
  assert(t.workflow.started, `${shapeName}: the started receipt records`);
  at.started = clone(t);
  const replan = clone(t);
  recordCreation(replan, 'lyric_revise', { seed: 16, draft }, { exit_code: 0 });
  recordCreation(replan, 'lyric_plan', planArgs(17), planReceipt(shape, 17));
  assert.equal(replan.workflow.plan?.request.seed, 17, `${shapeName}: the re-plan records`);
  at.replanned = replan;
  return { at, sweepArgs, planArgs, shape };
}

// The carried runs a started state can hold: the client's continuation, and
// /chat's carried records.
function carriedRuns(planArgs) {
  const decl = { ...planArgs(16) };
  const pending = encodeState({
    version: 1,
    input_draft: draft,
    accepted_lines: draft,
    connector_declarations: { writer: 'interview' },
    answered: {},
    pending: { kind: 'propose', prompt: 'Rewrite line one', record: { line: 1 } },
  });
  return {
    client: {
      answer: { seed: 16, args: { ...decl, draft, state: 'carried-state' } },
      resume: { seed: 16, args: { ...decl, draft, checkpoint: 'carried-checkpoint' } },
    },
    chat: {
      suspended: { key: 'seed:16', seed: 16, state: pending, draft, decl },
      resumable: {
        key: 'seed:16',
        seed: 16,
        resumable: true,
        uncertain_proposal: false,
        checkpoint: 'carried-checkpoint',
        draft,
        replay_draft: draft,
        decl,
      },
      parked: {
        key: 'seed:16',
        seed: 16,
        parked: true,
        exit_code: 3,
        uncertified: false,
        coverage: null,
        draft,
        final_draft: draft,
        decl,
        stop: null,
        open: [1],
        whole: [],
        standing: [],
      },
      // Held back: /chat refuses to continue these in this task, so NEXT is absent.
      uncertified_parked: {
        key: 'seed:16',
        seed: 16,
        parked: true,
        exit_code: null,
        uncertified: true,
        coverage: null,
        draft,
        final_draft: draft,
        decl,
        stop: null,
        open: [],
        whole: [],
        standing: [],
      },
      uncertain_proposal: {
        key: 'seed:16',
        seed: 16,
        resumable: false,
        uncertain_proposal: true,
        checkpoint: 'carried-checkpoint',
        draft,
        replay_draft: draft,
        final_draft: draft,
        decl,
      },
    },
  };
}
const HELD = new Set(['uncertified_parked', 'uncertain_proposal']);

// Fifteen wrong moves (some are admitted in some states, which is fine).
const wrongMoves = (planArgs) => [
  ['lyric_screen', { words: ['stove', 'coat'] }],
  ['lyric_plan', { seed: 99 }],
  ['lyric_plan', { seed: 16, form: 'ballad' }],
  ['lyric_check', { draft }],
  ['lyric_recover', { draft_text: draft.join('\n') }],
  ['lyric_grade', { seed: 99, draft }],
  ['lyric_grade', { seed: 16 }],
  ['lyric_grade', { seed: 16, draft: [draft[0]] }],
  ['lyric_grade', { seed: 16, draft, draft_text: other.join('\n') }],
  ['lyric_grade', { seed: 16, draft, scheme: 'AA' }],
  ['lyric_grade', { ...planArgs(16), draft, lines: 99 }],
  ['lyric_revise', { seed: 16, draft: other }],
  ['lyric_revise', { seed: 16, draft, pronunciations: ['stove=S T OW1 V'] }],
  ['lyric_revise', { seed: 16 }],
  ['lyric_revise', { seed: 16, draft: other, new_run: true }],
];

// The twelve texts creationRefusal can return, by their fixed words.
const GATE_TEXTS = [
  /^CREATION_ORDER: execute a successful lyric_sweep before screening\.$/,
  /^CREATION_PLAN: lyric_(check|recover) is for lyrics the user supplied\./,
  /^CREATION_ORDER: execute a successful lyric_sweep and a successful lyric_screen before planning/,
  /^CREATION_PLAN: plan a seed an accepted lyric_sweep returned/,
  /^CREATION_PLAN: execute lyric_plan successfully before grading or revising/,
  /^CREATION_PLAN: hand-authored mandate or placement fields/,
  /^CREATION_PLAN: \w+ differs from the recorded program plan\./,
  /^CREATION_DRAFT: conflicting draft and draft_text/,
  /^CREATION_DRAFT: the exact complete draft is required\./,
  /^CREATION_DRAFT: the draft line count differs/,
  /^CREATION_GRADE: lyric_grade must answer for this exact draft/,
  /^CREATION_GRADE: \w+ differs from the graded reading/,
];
const gateText = (text) => GATE_TEXTS.findIndex((re) => re.test(text));

// Parse a NEXT line the way a caller would: the named calls, with the
// arguments it names, and the caller's own words, draft and melody.
function parseNext(text, ctx) {
  const m = /(?:^| )NEXT: (.*)$/s.exec(text);
  assert(m, `no NEXT in: ${text}`);
  let line = m[1];
  const calls = [];
  if (line.startsWith('lyric_sweep')) return [['lyric_sweep', clone(ctx.sweepArgs)]];
  if (line.startsWith('lyric_screen with the end-word pairs you mean to write, then ')) {
    calls.push(['lyric_screen', { words: ['stove', 'coat'] }]);
    line = line.slice(line.indexOf(', then ') + ', then '.length);
  }
  if (line.startsWith('lyric_plan with ')) {
    const args = {};
    const re =
      /\b(seed|form|lines|functions|wants) (-?\d+|"(?:[^"\\]|\\.)*"|\[(?:"(?:[^"\\]|\\.)*"(?:,"(?:[^"\\]|\\.)*")*)?\])/g;
    for (const [, key, value] of line.matchAll(re)) args[key] = JSON.parse(value);
    if (line.includes("melody: the sweep's melody unchanged")) args.melody = ctx.sweepArgs.melody;
    calls.push(['lyric_plan', args]);
    return calls;
  }
  let r;
  if ((r = /^lyric_grade with seed (-?\d+) and the complete (\d+)-line draft\.$/.exec(line))) {
    assert.equal(Number(r[2]), draft.length);
    return [['lyric_grade', { seed: Number(r[1]), draft: ctx.newDraft }]];
  }
  if ((r = /^lyric_revise with seed (-?\d+) and `answer` to the run's pending question/.exec(line)))
    return [['lyric_revise', { seed: Number(r[1]), answer: 'Morning comes in slow' }]];
  if ((r = /^lyric_revise with seed (-?\d+) to resume the interrupted run/.exec(line)))
    return [['lyric_revise', { seed: Number(r[1]) }]];
  if (
    (r =
      /^lyric_revise with seed (-?\d+) and the complete rewritten (\d+)-line draft as draft_text\.$/.exec(
        line
      ))
  ) {
    assert.equal(Number(r[2]), draft.length);
    return [['lyric_revise', { seed: Number(r[1]), draft_text: rewritten.join('\n') }]];
  }
  if (
    (r =
      /^lyric_revise with seed (-?\d+)(, new_run: true)? and the exact (\d+)-line draft lyric_grade graded\. To change a line, grade the changed draft first\.$/.exec(
        line
      ))
  ) {
    assert.equal(Number(r[3]), draft.length);
    return [
      [
        'lyric_revise',
        { seed: Number(r[1]), draft: ctx.graded, ...(r[2] ? { new_run: true } : {}) },
      ],
    ];
  }
  assert.fail(`unparsed NEXT: ${line}`);
}

// Success receipts for the stubbed tools. A plan answers for the seed asked.
function stubResult(shape, name, args) {
  const v =
    name === 'lyric_sweep'
      ? { exit_code: 0, accepted_shown: [16, 17] }
      : name === 'lyric_screen'
        ? { exit_code: 0 }
        : name === 'lyric_plan'
          ? planReceipt(shape, args.seed)
          : { exit_code: 2, refusal: 'stub' };
  return { content: [{ type: 'text', text: JSON.stringify(v) }] };
}

// ── 1. The gate alone ───────────────────────────────────────────────────────
function walkGate(shapeName, tally) {
  const { at, sweepArgs, planArgs } = states(shapeName);
  const runs = carriedRuns(planArgs);
  const ctx = { sweepArgs, newDraft: draft, graded: draft };
  const cases = Object.entries(at).map(([state, task]) => [state, task, null]);
  for (const [k, c] of Object.entries(runs.client)) cases.push([`started+${k}`, at.started, c]);
  // The client restores its carried run's arguments before the gate reads them.
  const gate = (task, name, args, carried) => {
    if (name === 'lyric_revise' && carried && !args.new_run)
      for (const [k, v] of Object.entries(carried.args))
        if (args[k] === undefined) args[k] = clone(v);
    return creationRefusal(task, name, args, carried);
  };
  for (const [state, base, carried] of cases) {
    for (const [name, args] of wrongMoves(planArgs)) {
      const task = clone(base);
      const refusal = gate(task, name, clone(args), carried);
      if (!refusal) continue;
      const i = gateText(refusal);
      assert(i >= 0, `${shapeName}/${state}: unknown gate text ${refusal}`);
      tally.texts.add(i);
      const text = withNextCall(refusal, task, carried, name);
      assert(text.startsWith(refusal + ' NEXT: '), `${shapeName}/${state} ${name}: ${text}`);
      assert.equal(text.indexOf('NEXT: '), refusal.length + 1, 'the gate text stays first');
      // Never a draft, title, narrative or melody text.
      for (const secret of [...draft, melody, '60,62']) assert(!text.includes(secret), text);
      let follow = clone(base);
      for (const [n, a] of parseNext(text, ctx)) {
        const got = gate(follow, n, clone(a), carried);
        assert.equal(
          got,
          null,
          `${shapeName}/${state} ${name} -> ${n} ${JSON.stringify(a)}: ${got}`
        );
        if (n === 'lyric_screen') recordCreation(follow, n, a, { exit_code: 0 });
      }
      tally.followed++;
    }
  }
}

test('every gate refusal in every state names a NEXT the gate admits', (t) => {
  const tally = { texts: new Set(), followed: 0 };
  for (const shape of Object.keys(SHAPES)) walkGate(shape, tally);
  assert.equal(tally.texts.size, GATE_TEXTS.length, `gate texts reached: ${[...tally.texts]}`);
  assert(tally.followed > 200, `followed ${tally.followed}`);
  t.diagnostic(`gate: ${tally.followed} refusals followed and admitted`);
});

test('the derivation reads the receipts: plan coordinates, later pages, re-plans, held runs', () => {
  const { at, planArgs } = states('every');
  // A sweep and no screen: the screen, then the plan with every coordinate.
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.swept), null, 'lyric_plan')),
    'NEXT: lyric_screen with the end-word pairs you mean to write, then lyric_plan with seed 16, ' +
      'form "aaba", lines 2, functions "verse,chorus", wants ["before=verse,chorus","lines<=30"], ' +
      "melody: the sweep's melody unchanged."
  );
  assert.deepEqual(SWEEP_COORDINATES, ['form', 'lines', 'functions', 'melody']);
  // A later sweep page: the plan the caller is reaching for is that page's.
  assert.match(
    formatNextCall(nextCreationCall(clone(at.later_page), null, 'lyric_plan')),
    /^NEXT: lyric_plan with seed 23, /
  );
  // ... and a grade still answers for the recorded plan.
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.later_page), null, 'lyric_grade')),
    'NEXT: lyric_grade with seed 16 and the complete 2-line draft.'
  );
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.replanned), null, 'lyric_revise')),
    'NEXT: lyric_grade with seed 17 and the complete 2-line draft.'
  );
  const none = states('none');
  assert.equal(
    formatNextCall(nextCreationCall(clone(none.at.swept), null, 'lyric_plan')),
    'NEXT: lyric_screen with the end-word pairs you mean to write, then lyric_plan with seed 16.'
  );
  assert.equal(
    formatNextCall(nextCreationCall(clone(none.at.empty), null, 'lyric_screen')),
    'NEXT: lyric_sweep, declaring the form, lines, functions, melody and want you mean to plan with.'
  );
  const runs = carriedRuns(planArgs);
  assert.match(
    formatNextCall(nextCreationCall(clone(at.started), runs.chat.parked, 'lyric_grade')),
    /^NEXT: lyric_revise with seed 16 and the complete rewritten 2-line draft as draft_text\.$/
  );
  // E28: an uncertified parked run (and an unknown-outcome proposal) names nothing.
  for (const held of HELD) {
    for (const state of Object.keys(at)) {
      assert.equal(nextCreationCall(clone(at[state]), runs.chat[held], 'lyric_grade'), null);
      const text = 'CREATION_DRAFT: the exact complete draft is required.';
      assert.equal(withNextCall(text, clone(at[state]), runs.chat[held], 'lyric_grade'), text);
    }
  }
  // A carried run that does not continue the plan: a fresh run, said so.
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.graded), runs.client.answer, 'lyric_revise')),
    'NEXT: lyric_revise with seed 16, new_run: true and the exact 2-line draft lyric_grade graded. ' +
      'To change a line, grade the changed draft first.'
  );
});

test('edit sessions, recipe tasks, other texts and raw results pass through unchanged', () => {
  const edit = { domain: 'lyrics', phase: 'edit' };
  const text = 'CREATION_DRAFT: the exact complete draft is required.';
  assert.equal(nextCreationCall(clone(edit), null, 'lyric_grade'), null);
  assert.equal(withNextCall(text, clone(edit), null, 'lyric_grade'), text);
  assert.equal(withNextCall(text, { domain: 'recipe' }, null, 'lyric_grade'), text);
  assert.equal(withNextCall(text, null, null, 'lyric_grade'), text);
  const { at } = states('want');
  for (const plain of ['REFUSED by the connector: x', 'SESSION_EMPTY: y', 'Error: z'])
    assert.equal(withNextCall(plain, clone(at.swept), null, 'lyric_plan'), plain);
  const report = 'ACCEPTED\n    NEXT: lyric_plan with seed 16\n';
  const sweep = {
    content: [{ type: 'text', text: JSON.stringify({ exit_code: 0, report }) }],
  };
  assert.equal(withSweepNext(clone(edit), 'lyric_sweep', sweep, null), sweep);
  assert.equal(withSweepNext(clone(at.swept), 'lyric_plan', sweep, null), sweep);
  assert.equal(
    withSweepNext(clone(at.swept), 'lyric_sweep', { ...sweep, isError: true }, null).content,
    sweep.content
  );
  // A held run: the harness's raw plan line goes, and nothing replaces it.
  const { at: started, planArgs } = states('want');
  for (const held of HELD) {
    const carried = carriedRuns(planArgs).chat[held];
    const out = withSweepNext(clone(started.started), 'lyric_sweep', sweep, carried);
    const shown = JSON.parse(out.content[0].text).report;
    assert.equal(shown, 'ACCEPTED\n', `${held}: ${shown}`);
  }
  const got = withSweepNext(clone(at.swept), 'lyric_sweep', sweep, null);
  assert.equal(
    JSON.parse(got.content[0].text).report,
    'ACCEPTED\n    NEXT: lyric_screen with the end-word pairs you mean to write, then lyric_plan with seed 16, ' +
      'wants ["lines<=30"].\n'
  );
});

// ── 2. The maintained client ────────────────────────────────────────────────
async function stubClient(shape, session, dispatched) {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { z } = await import('zod');
  const server = new McpServer(
    { name: 'stub', version: '1' },
    { instructions: '=== LYRICS TASK ===\nstub' }
  );
  const any = z.object({}).passthrough();
  for (const name of [
    'lyric_sweep',
    'lyric_screen',
    'lyric_plan',
    'lyric_grade',
    'lyric_revise',
    'lyric_check',
    'lyric_recover',
  ])
    server.registerTool(name, { inputSchema: any.shape }, async (args) => {
      dispatched.push([name, args]);
      return stubResult(shape, name, args);
    });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const c = await connectConnector({ task: 'lyrics', transport: b, session, verifySurface: false });
  return { c, close: async () => (await c.close(), await server.close()) };
}
const sessionOf = (task, continuation = null) => ({
  version: 1,
  connector_contract: CONNECTOR_CONTRACT_VERSION,
  task: clone(task),
  continuation: clone(continuation),
});

test('the maintained client appends NEXT to every refusal and the NEXT is admitted', async (t) => {
  let followed = 0;
  for (const shapeName of Object.keys(SHAPES)) {
    const { at, sweepArgs, planArgs, shape } = states(shapeName);
    const runs = carriedRuns(planArgs);
    const ctx = { sweepArgs, newDraft: draft, graded: draft };
    const cases = Object.entries(at).map(([state, task]) => [state, task, null]);
    for (const [k, c] of Object.entries(runs.client)) cases.push([`started+${k}`, at.started, c]);
    // A carried run the plan's revision did not start (its draft is not the
    // graded one): the revise NEXT names must start a fresh run.
    cases.push([
      'graded+stale-run',
      at.graded,
      { seed: 16, args: { ...planArgs(16), draft: other, state: 'carried-state' } },
    ]);
    for (const [state, task, carried] of cases) {
      const moves = [
        ...wrongMoves(planArgs),
        // Both CREATION_CONTINUATION texts.
        ['lyric_revise', { seed: 16, draft: other }],
        ['lyric_revise', { seed: 16, draft, state: 'forged' }],
      ];
      for (const [name, args] of moves) {
        const dispatched = [];
        const { c, close } = await stubClient(shape, sessionOf(task, carried), dispatched);
        try {
          let message = null;
          try {
            await c.call(name, clone(args));
          } catch (error) {
            assert.equal(error.beforeDispatch, true);
            message = error.message;
          }
          if (message === null) continue;
          assert.match(message, /^CREATION_(ORDER|PLAN|DRAFT|GRADE|CONTINUATION): /, message);
          const head = message.slice(0, message.indexOf(' NEXT: '));
          assert(message.indexOf(' NEXT: ') > 0, `${shapeName}/${state} ${name}: ${message}`);
          if (!head.startsWith('CREATION_CONTINUATION')) assert(gateText(head) >= 0, head);
          for (const [n, a] of parseNext(message, ctx)) {
            const before = dispatched.length;
            await c.call(n, clone(a));
            assert.equal(dispatched.length, before + 1, `${shapeName}/${state} -> ${n}`);
          }
          followed++;
        } finally {
          await close();
        }
      }
    }
  }
  assert(followed > 200, `followed ${followed}`);
  t.diagnostic(`client: ${followed} refusals followed and admitted`);
});

test('the client names both CREATION_CONTINUATION texts with an admitted NEXT', async () => {
  const { at, planArgs, sweepArgs, shape } = states('want');
  const runs = carriedRuns(planArgs);
  const ctx = { sweepArgs, newDraft: draft, graded: draft };
  for (const [task, carried, args, expected] of [
    [
      at.started,
      runs.client.answer,
      { seed: 16, draft: other },
      "CREATION_CONTINUATION: draft differs from the recorded run. To answer its pending question, call lyric_revise with only `answer` or `answers`; to revise a different draft, grade it with lyric_grade, then call lyric_revise with that exact draft and `new_run: true`. NEXT: lyric_revise with seed 16 and `answer` to the run's pending question; the recorded run supplies its draft and declarations.",
    ],
    [
      at.graded,
      null,
      { seed: 16, draft, state: 'forged' },
      'CREATION_CONTINUATION: this session has no receipt for that run. Send lyric_revise without `state` or `checkpoint`; to start a run, grade the draft with lyric_grade, then call lyric_revise with that exact draft. NEXT: lyric_revise with seed 16 and the exact 2-line draft lyric_grade graded. To change a line, grade the changed draft first.',
    ],
  ]) {
    const dispatched = [];
    const { c, close } = await stubClient(shape, sessionOf(task, carried), dispatched);
    try {
      await assert.rejects(c.call('lyric_revise', args), (e) => e.message === expected);
      for (const [n, a] of parseNext(expected, ctx)) await c.call(n, a);
      assert.equal(dispatched.length, 1);
    } finally {
      await close();
    }
  }
});

// ── 3. /chat, with a stubbed model ──────────────────────────────────────────
const nativeFetch = globalThis.fetch;
const TOOLS = [
  'lyric_sweep',
  'lyric_screen',
  'lyric_plan',
  'lyric_grade',
  'lyric_revise',
  'lyric_check',
  'lyric_recover',
];
const surface = {
  instructions: '=== RECIPE TASK === Recipes. === LYRICS TASK === Lyrics.',
  declarations: TOOLS.map((name) => ({ name, parameters: { type: 'object', properties: {} } })),
  workspaceTools: new Set(),
  stateTools: new Set(['lyric_revise']),
};
const reply = (parts) => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [{ content: { parts }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, thoughtsTokenCount: 0 },
  }),
});
const fc = (name, args) => ({ functionCall: { name, args } });
const lastResponses = (init) =>
  JSON.parse(init.body)
    .contents.at(-1)
    .parts.map((p) => p.functionResponse)
    .filter(Boolean);

// One /chat turn: the wrong move, then whatever its NEXT names.
async function chatTurn({ shape, task, lyric, name, args, ctx }) {
  const dispatched = [];
  let step = 0;
  let refusal = null;
  let seen = null;
  let follow = [];
  globalThis.fetch = async (_url, init) => {
    step++;
    if (step === 1) return reply([fc(name, args)]);
    if (step === 2) {
      const [r] = lastResponses(init);
      seen = r?.response?.error ?? null;
      refusal = seen;
      if (!refusal || !/^CREATION_/.test(refusal) || !refusal.includes(' NEXT: '))
        return reply([{ text: 'done' }]);
      follow = parseNext(refusal, ctx);
      return reply(follow.map(([n, a]) => fc(n, a)));
    }
    return reply([{ text: 'done' }]);
  };
  try {
    const out = await runTurn({
      apiKey: 'offline',
      surface,
      userText: 'New love song.',
      limits: { ...LIMITS, maxSteps: 8, maxTurnMs: 5000, maxTurnUsd: 0 },
      task: clone(task),
      lyric: clone(lyric),
      callTool: async (n, a) => {
        dispatched.push([n, a]);
        return stubResult(shape, n, a);
      },
    });
    return { out, refusal, seen, follow, dispatched };
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

test('/chat: the model reads NEXT, the calls row keeps the gate text, and NEXT passes wander, parked and the gate', async (t) => {
  let followed = 0,
    held = 0,
    wandered = 0,
    stepNine = 0;
  for (const shapeName of Object.keys(SHAPES)) {
    const { at, sweepArgs, planArgs, shape } = states(shapeName);
    const runs = carriedRuns(planArgs);
    const ctx = { sweepArgs, newDraft: draft, graded: draft };
    const cases = Object.entries(at).map(([state, task]) => [state, task, null]);
    for (const [k, r] of Object.entries(runs.chat)) cases.push([k, at.started, r]);
    for (const [state, task, lyric] of cases) {
      for (const [name, args] of wrongMoves(planArgs)) {
        const { out, refusal, seen, follow, dispatched } = await chatTurn({
          shape,
          task,
          lyric,
          name,
          args: clone(args),
          ctx,
        });
        const row = out.calls[0];
        // A held run names no NEXT in ANY text the model reads: the gate's,
        // and /chat's own parked refusal, which for an uncertified run is
        // F7 step 9's note (the page path, and the in-task route only on the
        // person's request).
        if (HELD.has(state) && seen) {
          const where = `${shapeName}/${state} ${name}`;
          assert(!/(?:^| )NEXT: /.test(seen), `${where}: a held run names no NEXT: ${seen}`);
          if (
            state === 'uncertified_parked' &&
            /^(?:Error: )?REFUSED by the connector/.test(seen)
          ) {
            for (const phrase of ['Start independent work', '`new_run: true`'])
              assert(seen.includes(phrase), `${where}: step 9's note: ${seen}`);
            stepNine++;
          }
        }
        if (row?.refused_by_connector && !/^CREATION_/.test(row.error)) wandered++;
        if (!row?.error || !/^CREATION_/.test(row.error)) continue;
        const where = `${shapeName}/${state} ${name}`;
        assert(
          gateText(row.error) >= 0,
          `${where}: the row keeps the gate's own text: ${row.error}`
        );
        assert.equal(row.not_run, true);
        if (HELD.has(state)) {
          assert.equal(refusal, row.error, `${where}: no NEXT for a held run`);
          held++;
          continue;
        }
        assert(refusal.startsWith(row.error + ' NEXT: '), `${where}: ${refusal}`);
        assert(follow.length, where);
        const rows = out.calls.slice(1);
        assert.equal(rows.length, follow.length, `${where}: ${JSON.stringify(out.calls)}`);
        for (const r of rows)
          assert(!r.refused_by_connector && !r.not_run, `${where} -> ${r.name}: ${r.error}`);
        assert.deepEqual(
          dispatched.map(([n]) => n),
          follow.map(([n]) => n),
          where
        );
        followed++;
      }
    }
  }
  assert(followed > 200, `followed ${followed}`);
  assert(held > 0, 'the held runs were reached');
  assert(wandered > 0, "/chat's own refusals were reached");
  assert(stepNine > 0, "the uncertified run's parked refusal was reached");
  t.diagnostic(
    `/chat: ${followed} refusals followed and admitted; ${held} held runs named nothing; ${stepNine} parked refusals carried step 9's note and no NEXT; ${wandered} moves refused by wander/parked before the gate`
  );
});

test('/chat: a sweep result shows the derived NEXT to the model', async () => {
  const { at, sweepArgs } = states('every');
  const report = 'ACCEPTED\n      16, 17\n    NEXT: lyric_plan with seed 16\n';
  let seen = null,
    step = 0;
  globalThis.fetch = async (_url, init) => {
    step++;
    if (step === 1) return reply([fc('lyric_sweep', sweepArgs)]);
    seen = lastResponses(init)[0]?.response;
    return reply([{ text: 'done' }]);
  };
  try {
    await runTurn({
      apiKey: 'offline',
      surface,
      userText: 'New love song.',
      limits: { ...LIMITS, maxSteps: 8, maxTurnMs: 5000, maxTurnUsd: 0 },
      task: clone(at.empty),
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ exit_code: 0, accepted_shown: [16, 17], report }),
          },
        ],
      }),
    });
  } finally {
    globalThis.fetch = nativeFetch;
  }
  assert.equal(
    seen.report,
    'ACCEPTED\n      16, 17\n    NEXT: lyric_screen with the end-word pairs you mean to write, then lyric_plan ' +
      'with seed 16, form "aaba", lines 2, functions "verse,chorus", wants ["before=verse,chorus","lines<=30"], ' +
      "melody: the sweep's melody unchanged.\n"
  );
});

test('/chat: a sweep during an unknown-outcome proposal shows no plan line at all', async () => {
  const { at, sweepArgs, planArgs } = states('every');
  const report = 'ACCEPTED\n      16, 17\n    NEXT: lyric_plan with seed 16\n';
  let seen = null,
    step = 0;
  globalThis.fetch = async (_url, init) => {
    step++;
    if (step === 1) return reply([fc('lyric_sweep', sweepArgs)]);
    seen = lastResponses(init)[0]?.response;
    return reply([{ text: 'done' }]);
  };
  try {
    await runTurn({
      apiKey: 'offline',
      surface,
      userText: 'New love song.',
      limits: { ...LIMITS, maxSteps: 8, maxTurnMs: 5000, maxTurnUsd: 0 },
      task: clone(at.started),
      lyric: clone(carriedRuns(planArgs).chat.uncertain_proposal),
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ exit_code: 0, accepted_shown: [16, 17], report }),
          },
        ],
      }),
    });
  } finally {
    globalThis.fetch = nativeFetch;
  }
  assert(seen, 'the sweep ran');
  assert.equal(seen.report, 'ACCEPTED\n      16, 17\n');
});

// ── 4. The real harness: the client and a /mcp session ─────────────────────
test(
  "the real chain: the sweep's NEXT is followed, a plan before the screen names the screen, then the plan is admitted",
  { timeout: 300_000 },
  async (t) => {
    // Raw /mcp/lyrics (no client): the harness's own line, unchanged.
    const raw = buildServer({ task: { domain: 'lyrics' } });
    const [ra, rb] = InMemoryTransport.createLinkedPair();
    await raw.connect(ra);
    const rawClient = new Client({ name: 'raw', version: '1' }, { capabilities: {} });
    await rawClient.connect(rb);
    const sweepArgs = { seed_from: 31, count: 1, lines: 12 };
    let rawReport;
    try {
      const r = await rawClient.callTool({ name: 'lyric_sweep', arguments: sweepArgs });
      rawReport = JSON.parse(r.content[0].text).report;
    } finally {
      await rawClient.close();
      await raw.close();
    }
    const rawLine = /NEXT: lyric_plan with seed (\d+)$/m.exec(rawReport);
    assert(rawLine, rawReport);
    const seed = Number(rawLine[1]);
    const expected = `NEXT: lyric_screen with the end-word pairs you mean to write, then lyric_plan with seed ${seed}, lines 12.`;
    const ctx = { sweepArgs };

    // /chat: the same real sweep through runTurn, whose wrapper rewrites the
    // report the model reads.
    const chatServer = buildServer({ task: { domain: 'lyrics' } });
    const [ca, cb] = InMemoryTransport.createLinkedPair();
    await chatServer.connect(ca);
    const chatClient = new Client({ name: 'chat', version: '1' }, { capabilities: {} });
    await chatClient.connect(cb);
    let chatSeen = null,
      chatStep = 0;
    globalThis.fetch = async (_url, init) => {
      chatStep++;
      if (chatStep === 1) return reply([fc('lyric_sweep', sweepArgs)]);
      chatSeen = lastResponses(init)[0]?.response;
      return reply([{ text: 'done' }]);
    };
    try {
      await runTurn({
        apiKey: 'offline',
        surface,
        userText: 'New love song.',
        limits: { ...LIMITS, maxSteps: 4, maxTurnMs: 240_000, maxTurnUsd: 0 },
        task: fresh(),
        callTool: (n, a) => chatClient.callTool({ name: n, arguments: a }),
      });
    } finally {
      globalThis.fetch = nativeFetch;
      await chatClient.close();
      await chatServer.close();
    }
    assert(chatSeen?.report?.includes(expected), JSON.stringify(chatSeen));
    assert(!/NEXT: lyric_plan with seed \d+$/m.test(chatSeen.report), chatSeen.report);

    // The maintained client.
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = await connectConnector({ task: 'lyrics', transport: b });
    try {
      const swept = await c.call('lyric_sweep', sweepArgs);
      const report = JSON.parse(swept.content[0].text).report;
      assert(report.includes(expected), report);
      assert(!/NEXT: lyric_plan with seed \d+$/m.test(report), report);
      const [, [, plan]] = parseNext(report.match(/NEXT: .*$/m)[0], ctx);
      assert.deepEqual(plan, { seed, lines: 12 });
      await assert.rejects(
        c.call('lyric_plan', plan),
        (e) =>
          e.message ===
          `CREATION_ORDER: execute a successful lyric_sweep and a successful lyric_screen before planning or writing a new song. ${expected}`
      );
      await c.call('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
      const planned = await c.call('lyric_plan', plan);
      assert(!planned.isError, JSON.stringify(planned));
      assert(c.snapshot().task.workflow.plan, 'the plan NEXT named is admitted and recorded');
    } finally {
      await c.close();
      await server.close();
    }

    // A real /mcp session (the client in-process): the same texts.
    const directory = mkdtempSync(join(tmpdir(), 'creation-next-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const sessions = new WorkflowSessions({ store: new JobStore(directory) });
    let session_id = sessions.open('lyrics').session_id;
    const run = async (name, args) => {
      const q = sessions.submit(session_id, 'lyrics', name, args);
      await sessions.wait(q.operation_id);
      const r = sessions.status(q.operation_id, 'lyrics');
      if (r.session_id) session_id = r.session_id;
      return r;
    };
    const swept = await run('lyric_sweep', sweepArgs);
    assert(verdictOf(swept.tool_result).report.includes(expected), JSON.stringify(swept));
    const early = await run('lyric_plan', { seed, lines: 12 });
    const text = early.tool_result.content.map((block) => block.text).join('\n');
    assert(text.includes(`before planning or writing a new song. ${expected}`), text);
    await run('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
    const planned = await run('lyric_plan', { seed, lines: 12 });
    assert(!planned.tool_error, JSON.stringify(planned));
    assert.equal(verdictOf(planned.tool_result).exit_code, 0, JSON.stringify(planned));
  }
);

test(
  'real plans retain already-satisfied wants and admit the next grade',
  { timeout: 240_000 },
  async () => {
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 'satisfied-wants', version: '1' }, { capabilities: {} });
    await client.connect(b);
    try {
      for (const wants of [[], ['lines<=30', 'lines>=12']]) {
        const task = fresh();
        const call = async (name, args) => {
          const result = await client.callTool({ name, arguments: args });
          const verdict = verdictOf(result);
          assert(!result.isError, JSON.stringify(result));
          assert.equal(verdict.exit_code, 0, JSON.stringify(verdict));
          recordCreation(task, name, args, verdict);
          return verdict;
        };
        const sweep = await call('lyric_sweep', {
          seed_from: 31,
          count: 1,
          lines: 12,
          want: wants,
        });
        const seed = sweep.accepted_shown[0];
        await call('lyric_screen', { words: ['rain', 'train'] });
        const plan = await call('lyric_plan', { seed, lines: 12, wants });
        assert.deepEqual(plan.plan_request.wants, wants);
        assert(task.workflow.plan, 'a successful plan must be recorded before grading');
        assert.equal(task.workflow.plan.sha256, plan.plan_sha256);
        assert.equal(
          creationRefusal(task, 'lyric_grade', {
            seed,
            draft: Array(plan.plan.total_lines).fill('A synthetic line'),
          }),
          null,
          'the complete draft is admitted under the recorded plan'
        );
      }
    } finally {
      await client.close();
      await server.close();
    }
  }
);
