// P2 F1: every CREATION_* refusal, and a create session's sweep report, names
// the next call the gate admits — one derivation (nextCreationCall), appended
// at the maintained client and at /chat. This walks every gate state in three
// sweep shapes, sends wrong moves, and follows each NEXT the way a caller
// would: through the gate alone, through the real client, and through /chat's
// own wander and parked refusals with a stubbed model. The last case runs the
// real harness (sweep, plan, screen; no grade, so about 26 s here) on the
// client and on a /mcp session, so it runs in test:production:offline, whose
// CI job stages the tagger the harness reads, as test_chatgpt_parked.mjs does.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  SWEEP_COORDINATES,
  creationRefusal,
  creationQualified,
  recordCreation,
  nextCreationCall,
  formatNextCall,
  withNextCall,
  withSweepNext,
  planNext,
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
import { stated } from './statement_fixture.mjs';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clone = (v) => structuredClone(v);
const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
const rewritten = ['My kettle sings beside the stove', 'Your fingers brush my heavy coat'];
const other = ['A different opening line', 'A different closing line'];
const melody = '{"notes":[60,62]}';

// A relation from the planner's eligible types (the table the Lyrics page
// reads, written from `type_eligibility`), picked by seed.
const ELIGIBLE = JSON.parse(
  readFileSync(new URL('../src/pages/lyric_types.json', import.meta.url), 'utf8')
).types.map((t) => `schema:${t[1]}`);
const relation = ELIGIBLE[16 % ELIGIBLE.length];
// Three sweep shapes: nothing declared, want only, and every coordinate
// declared. Each sweep states form, length, sections, rhyme and time (stage
// 3): what a shape leaves out is drawn (statement_fixture.mjs).
const SHAPES = {
  none: { sweep: stated({}), plan: {}, request: {} },
  want: {
    sweep: stated({ want: ['lines<=30'] }),
    plan: { wants: ['lines<=30'] },
    request: { wants: ['lines<=30'] },
  },
  every: {
    sweep: {
      form: 'aaba',
      lines: 2,
      functions: 'verse,chorus',
      relation,
      melody,
      want: ['lines<=30', 'before=verse,chorus'],
    },
    plan: {
      form: 'aaba',
      lines: 2,
      functions: 'verse,chorus',
      relation,
      melody,
      wants: ['before=verse,chorus', 'lines<=30'],
    },
    request: {
      form: 'aaba',
      lines: 2,
      functions: ['verse', 'chorus'],
      relation,
      melody: { notes: [60, 62] },
      wants: ['before=verse,chorus', 'lines<=30'],
    },
  },
};

// The sweep's NEXT before any sweep, and the form a stated shape names.
const SWEEP_LINE =
  "NEXT: lyric_sweep stating form, lines, functions, relation and melody, each as a value or in `draw` (form as one name); the plan repeats the sweep's form, lines, functions, relation, melody and `want`.";
const FORM = JSON.stringify(SHAPES.none.sweep.form);

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
  // The plan is recorded with no word-check; the word-check is recorded for it.
  const p = planReceipt(shape, 16);
  recordCreation(t, 'lyric_plan', planArgs(16), p);
  assert(t.workflow.plan, `${shapeName}: the plan receipt records`);
  at.planned = clone(t);
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  assert.equal(
    t.workflow.screen?.plan_sha256,
    p.plan_sha256,
    `${shapeName}: the screen receipt records for its plan`
  );
  at.screened = clone(t);
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
  // The screen on record is the first plan's: the re-plan has none of its own.
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

// The fourteen texts creationRefusal can return, by their fixed words.
const GATE_TEXTS = [
  /^CREATION_ORDER: a new song's lyric_screen comes after its lyric_plan, and its receipt is recorded for that plan\. Call lyric_sweep, then lyric_plan, before lyric_screen\.$/,
  /^CREATION_PLAN: lyric_(check|recover) is for lyrics the user supplied\./,
  /^CREATION_ORDER: execute a successful lyric_sweep before planning or writing a new song\.$/,
  /^CREATION_ORDER: lyric_grade needs one answered lyric_screen under this plan, and none is on record for it\./,
  /^CREATION_PLAN: plan a seed an accepted lyric_sweep returned/,
  /^CREATION_PLAN: execute lyric_plan successfully before grading or revising/,
  /^CREATION_PLAN: hand-authored mandate or placement fields/,
  /^CREATION_PLAN: \w+ differs from the recorded program plan\./,
  /^CREATION_DRAFT: conflicting draft and draft_text/,
  /^CREATION_DRAFT: the exact complete draft is required\./,
  /^CREATION_DRAFT: the draft line count differs/,
  /^CREATION_GRADE: lyric_grade must answer for this exact draft/,
  /^CREATION_GRADE: no graded draft is on record for this plan, and this call sent none\./,
  /^CREATION_GRADE: \w+ differs from the graded reading/,
];
const gateText = (text) => GATE_TEXTS.findIndex((re) => re.test(text));

// Parse a NEXT line the way a caller would: the named calls, with the
// arguments it names, and the caller's own words, draft and melody.
function parseNext(text, ctx) {
  const m = /(?:^| )NEXT: (.*)$/s.exec(text);
  assert(m, `no NEXT in: ${text}`);
  const line = m[1];
  if (line.startsWith('lyric_sweep')) return [['lyric_sweep', clone(ctx.sweepArgs)]];
  if (line.startsWith('lyric_plan with ')) {
    const args = {};
    const re =
      /\b(seed|form|lines|functions|relation|wants) (-?\d+|"(?:[^"\\]|\\.)*"|\[(?:"(?:[^"\\]|\\.)*"(?:,"(?:[^"\\]|\\.)*")*)?\])/g;
    for (const [, key, value] of line.matchAll(re)) args[key] = JSON.parse(value);
    if (line.includes("melody: the sweep's melody unchanged")) args.melody = ctx.sweepArgs.melody;
    return [['lyric_plan', args]];
  }
  let r;
  // A plan with no word-check under it: the screen, with the caller's own
  // words, then the grade the line names.
  if (
    (r =
      /^lyric_screen with candidate words for this plan's rhymes; then lyric_grade with seed (-?\d+) and the complete (\d+)-line draft\.$/.exec(
        line
      ))
  ) {
    assert.equal(Number(r[2]), draft.length);
    return [
      ['lyric_screen', { words: ['stove', 'coat'] }],
      ['lyric_grade', { seed: Number(r[1]), draft: ctx.newDraft }],
    ];
  }
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
  // The record holds the graded draft: the call sends none, and the gate
  // fills it in (writer plan, stage 2).
  if (
    (r =
      /^lyric_revise with seed (-?\d+)(, new_run: true)? and no draft; the (\d+)-line draft lyric_grade graded is taken from the record\. To change a line, grade the changed draft first\.$/.exec(
        line
      ))
  ) {
    assert.equal(Number(r[3]), draft.length);
    return [['lyric_revise', { seed: Number(r[1]), ...(r[2] ? { new_run: true } : {}) }]];
  }
  // A grade receipt written before the draft's text was kept: the caller
  // sends the graded draft again.
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

// ── 1b. The word-check follows the plan ─────────────────────────────────────
// A create session enforces sweep, plan, screen, grade, revise. The screen's
// receipt names the plan it ran under, and a grade needs the receipt of its
// own plan. Each walk is built from recordCreation alone, and every refusal's
// NEXT is parsed and sent back through the gate.
const LINES = ['<line 1>', '<line 2>'];
const WORDS = { words: ['stove', 'coat'] };
const SCREEN_AFTER_PLAN =
  "CREATION_ORDER: a new song's lyric_screen comes after its lyric_plan, and its receipt is recorded for that plan. Call lyric_sweep, then lyric_plan, before lyric_screen.";
const GRADE_NEEDS_SCREEN =
  'CREATION_ORDER: lyric_grade needs one answered lyric_screen under this plan, and none is on record for it.';
// The call a plan with no word-check under it names: after "NEXT: " in a
// refusal, after "Call " in the plan verdict's `next`.
const screenThenGradeCall = (seed, lines = LINES.length) =>
  `lyric_screen with candidate words for this plan's rhymes; then lyric_grade with seed ${seed} and the complete ${lines}-line draft.`;
const screenThenGrade = (seed, lines) => `NEXT: ${screenThenGradeCall(seed, lines)}`;
const WALK = { sweepArgs: stated({ seed_from: 10, count: 10 }), newDraft: LINES, graded: LINES };
// A task that has swept and planned seed 16, with no screen.
function sweptAndPlanned() {
  const t = fresh();
  recordCreation(t, 'lyric_sweep', WALK.sweepArgs, { exit_code: 0, accepted_shown: [16, 17] });
  const p = planReceipt(SHAPES.none, 16);
  recordCreation(t, 'lyric_plan', { seed: 16 }, p);
  return { t, p };
}
// The refusal as a caller reads it, with each call its NEXT names sent through
// the gate: all must be admitted. A screen it names is recorded as answered.
function followNext(task, refusal, name, ctx = WALK) {
  const text = withNextCall(refusal, task, null, name);
  for (const [n, a] of parseNext(text, ctx)) {
    assert.equal(creationRefusal(task, n, clone(a), null), null, `${n}, after: ${text}`);
    if (n === 'lyric_screen') recordCreation(task, n, a, { exit_code: 0 });
  }
  return text;
}

test('the word-check follows the plan: a screen before it and a grade without it are refused, and each NEXT is admitted', () => {
  const shape = SHAPES.want;
  const ctx = { ...WALK, sweepArgs: { seed_from: 10, count: 10, ...shape.sweep } };
  const t = fresh();
  // Nothing on record: the screen is refused, and its NEXT is the sweep.
  assert.equal(creationRefusal(t, 'lyric_screen', clone(WORDS)), SCREEN_AFTER_PLAN);
  assert.equal(
    followNext(t, SCREEN_AFTER_PLAN, 'lyric_screen', ctx),
    `${SCREEN_AFTER_PLAN} ${SWEEP_LINE}`
  );
  // A sweep and no plan: the same refusal, and its NEXT is the plan.
  recordCreation(t, 'lyric_sweep', ctx.sweepArgs, { exit_code: 0, accepted_shown: [16, 17] });
  assert.equal(creationRefusal(t, 'lyric_screen', clone(WORDS)), SCREEN_AFTER_PLAN);
  assert.equal(
    followNext(t, SCREEN_AFTER_PLAN, 'lyric_screen', ctx),
    `${SCREEN_AFTER_PLAN} NEXT: lyric_plan with seed 16, form ${FORM}, wants ["lines<=30"].`
  );
  // A screen that ran all the same leaves nothing: there is no plan to record it for.
  recordCreation(t, 'lyric_screen', WORDS, { exit_code: 0 });
  recordCreation(t, 'lyric_screen', WORDS, { exit_code: 2 });
  assert.equal(t.workflow.screen, null);
  assert.equal(t.workflow.screen_attempt, undefined);
  // The plan is admitted and recorded with no screen.
  const planArgs = { seed: 16, ...shape.plan };
  assert.equal(creationRefusal(t, 'lyric_plan', clone(planArgs)), null);
  const p = planReceipt(shape, 16);
  recordCreation(t, 'lyric_plan', planArgs, p);
  assert.equal(t.workflow.plan?.sha256, p.plan_sha256);
  // The grade, and a revise with nothing graded under the plan, are refused
  // for the screen, with or without a draft.
  for (const [name, args] of [
    ['lyric_grade', { seed: 16, draft: LINES }],
    ['lyric_grade', { seed: 16 }],
    ['lyric_revise', { seed: 16, draft: LINES }],
    ['lyric_revise', { seed: 16 }],
  ])
    assert.equal(creationRefusal(t, name, clone(args)), GRADE_NEEDS_SCREEN, name);
  // Followed: the screen is admitted and recorded for this plan, then the grade is admitted.
  assert.equal(
    followNext(t, GRADE_NEEDS_SCREEN, 'lyric_grade', ctx),
    `${GRADE_NEEDS_SCREEN} ${screenThenGrade(16)}`
  );
  assert.deepEqual(t.workflow.screen, {
    words: ['stove', 'coat'],
    relation: null,
    plan_sha256: p.plan_sha256,
  });
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 16, draft: LINES }), null);
});

test('a replacement plan needs a word-check of its own before its grade', () => {
  const { t, p: a } = sweptAndPlanned();
  recordCreation(t, 'lyric_screen', WORDS, { exit_code: 0 });
  assert.equal(t.workflow.screen?.plan_sha256, a.plan_sha256);
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 16, draft: LINES }), null);
  // Plan B is admitted with no screen of its own, and replaces plan A.
  const b = planReceipt(SHAPES.none, 17);
  assert.notEqual(b.plan_sha256, a.plan_sha256);
  assert.equal(creationRefusal(t, 'lyric_plan', { seed: 17 }), null);
  recordCreation(t, 'lyric_plan', { seed: 17 }, b);
  assert.equal(t.workflow.plan?.sha256, b.plan_sha256);
  // The screen on record is plan A's: plan B's grade is refused until its own.
  assert.equal(t.workflow.screen.plan_sha256, a.plan_sha256);
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 17, draft: LINES }), GRADE_NEEDS_SCREEN);
  assert.equal(
    followNext(t, GRADE_NEEDS_SCREEN, 'lyric_grade'),
    `${GRADE_NEEDS_SCREEN} ${screenThenGrade(17)}`
  );
  assert.equal(t.workflow.screen.plan_sha256, b.plan_sha256);
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 17, draft: LINES }), null);
  // The same plan recorded again is the same plan: its screen still stands.
  recordCreation(t, 'lyric_plan', { seed: 17 }, b);
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 17, draft: LINES }), null);
});

test('a planner changed between plan and grade: the grade names a new plan, and the way on through a new plan is admitted', () => {
  const { t, p } = sweptAndPlanned();
  recordCreation(t, 'lyric_screen', WORDS, { exit_code: 0 });
  // The grade builds seed 16's plan again, and a deployed planner builds a
  // different one: no receipt can be written under the recorded plan.
  const rebuilt = planReceipt(SHAPES.none, 16);
  rebuilt.plan.sections = [{ name: 'VERSE' }, { name: 'VERSE' }];
  rebuilt.plan_sha256 = sha(rebuilt.plan);
  assert.notEqual(rebuilt.plan_sha256, p.plan_sha256);
  recordCreation(t, 'lyric_grade', { seed: 16, draft: LINES }, gradeReceipt(rebuilt, LINES));
  assert.equal(t.workflow.grade, null);
  assert.equal(t.workflow.grade_attempt.cause, 'plan_changed');
  const CHANGED =
    "CREATION_ORDER: lyric_grade rebuilt seed 16's plan and got a different plan from the one on record (the planner changed after lyric_plan ran), so no grade under the recorded plan can be written. Call lyric_plan again with seed 16; then lyric_screen and lyric_grade under the new plan.";
  // Grading again, or revising with nothing graded, is refused with the way on.
  for (const [name, args] of [
    ['lyric_grade', { seed: 16, draft: LINES }],
    ['lyric_revise', { seed: 16 }],
    ['lyric_revise', { seed: 16, draft: LINES }],
  ])
    assert.equal(creationRefusal(t, name, clone(args)), CHANGED, name);
  assert.equal(
    followNext(t, CHANGED, 'lyric_grade'),
    `${CHANGED} NEXT: lyric_plan with seed 16, form ${FORM}.`
  );
  // The new plan replaces the old one; its own screen, then its grade, are admitted.
  recordCreation(t, 'lyric_plan', { seed: 16 }, rebuilt);
  assert.equal(t.workflow.plan.sha256, rebuilt.plan_sha256);
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 16, draft: LINES }), GRADE_NEEDS_SCREEN);
  followNext(t, GRADE_NEEDS_SCREEN, 'lyric_grade');
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 16, draft: LINES }), null);
  recordCreation(t, 'lyric_grade', { seed: 16, draft: LINES }, gradeReceipt(rebuilt, LINES));
  assert.equal(t.workflow.grade?.plan_sha256, rebuilt.plan_sha256);
});

test('a word-check that ran under this plan and did not answer adds its note; one under another plan does not', () => {
  const { t, p } = sweptAndPlanned();
  const NOTE = ' lyric_screen ran in this session but did not answer (exit 2)';
  const NEEDS = 'A grade needs one lyric_screen under its plan that answers (exit 0 or 3): ';
  recordCreation(t, 'lyric_screen', WORDS, { exit_code: 2, refusal: '<why>' });
  assert.equal(t.workflow.screen, null, 'an attempt is not a receipt');
  assert.deepEqual(t.workflow.screen_attempt, {
    exit_code: 2,
    cause: 'other',
    plan_sha256: p.plan_sha256,
  });
  const told = creationRefusal(t, 'lyric_grade', { seed: 16, draft: LINES });
  assert.equal(
    told,
    `${GRADE_NEEDS_SCREEN}${NOTE}; its report names why. ${NEEDS}call lyric_screen again once that cause is fixed.`
  );
  // One that printed past what the connector carries names a smaller request.
  recordCreation(t, 'lyric_screen', WORDS, {
    exit_code: 2,
    refusal: '<screen> printed more than this connector can carry',
  });
  assert.equal(
    creationRefusal(t, 'lyric_revise', { seed: 16 }),
    `${GRADE_NEEDS_SCREEN}${NOTE}: it printed more than this connector can carry, so screening the same request again returns the same result. ${NEEDS}call lyric_screen again with a smaller request.`
  );
  // The NEXT is the same call; once the screen answers, the note and the refusal go.
  assert.equal(followNext(t, told, 'lyric_grade'), `${told} ${screenThenGrade(16)}`);
  assert.equal(t.workflow.screen_attempt, undefined);
  assert.equal(creationRefusal(t, 'lyric_grade', { seed: 16, draft: LINES }), null);
  // An attempt under plan A says nothing about plan B.
  const { t: u, p: a } = sweptAndPlanned();
  recordCreation(u, 'lyric_screen', WORDS, { exit_code: 2, refusal: '<why>' });
  recordCreation(u, 'lyric_plan', { seed: 17 }, planReceipt(SHAPES.none, 17));
  assert.equal(u.workflow.screen_attempt.plan_sha256, a.plan_sha256);
  assert.equal(creationRefusal(u, 'lyric_grade', { seed: 17, draft: LINES }), GRADE_NEEDS_SCREEN);
});

test('a session opened before the screen named its plan: one screen at the grade, and what already stands is not sent back', () => {
  // Receipts as recordCreation writes them, then the screen receipt as a
  // session stored before this change holds it: with no plan named.
  const stored = (...steps) => {
    const { t, p } = sweptAndPlanned();
    recordCreation(t, 'lyric_screen', WORDS, { exit_code: 0 });
    for (const [name, verdict] of steps)
      recordCreation(t, name, { seed: 16, draft: LINES }, verdict(p));
    delete t.workflow.screen.plan_sha256;
    assert.deepEqual(t.workflow.screen, { words: ['stove', 'coat'], relation: null });
    return t;
  };
  const grade = ['lyric_grade', (p) => gradeReceipt(p, LINES)];
  // Planned, never graded: refused once at the grade, admitted after one screen.
  const planned = stored();
  assert.equal(
    creationRefusal(planned, 'lyric_grade', { seed: 16, draft: LINES }),
    GRADE_NEEDS_SCREEN
  );
  assert.equal(
    followNext(planned, GRADE_NEEDS_SCREEN, 'lyric_grade'),
    `${GRADE_NEEDS_SCREEN} ${screenThenGrade(16)}`
  );
  assert.equal(planned.workflow.screen.plan_sha256, planned.workflow.plan.sha256);
  assert.equal(creationRefusal(planned, 'lyric_grade', { seed: 16, draft: LINES }), null);
  // A grade already under the plan: a revise takes the graded draft from the
  // record, and the next call the receipts name is that revise. No new screen.
  const graded = stored(grade);
  assert.ok(graded.workflow.grade, 'the grade receipt records');
  const taken = { seed: 16 };
  assert.equal(creationRefusal(graded, 'lyric_revise', taken), null);
  assert.deepEqual(taken.draft, LINES);
  assert.equal(creationRefusal(graded, 'lyric_revise', { seed: 16, draft: LINES }), null);
  assert.equal(
    formatNextCall(nextCreationCall(clone(graded), null, 'lyric_revise')),
    'NEXT: lyric_revise with seed 16 and no draft; the 2-line draft lyric_grade graded is taken from the record. ' +
      'To change a line, grade the changed draft first.'
  );
  assert.deepEqual(graded.workflow.screen, { words: ['stove', 'coat'], relation: null });
  // A run under way continues without one.
  const running = stored(grade, ['lyric_revise', () => ({ exit_code: 4 })]);
  assert.equal(
    creationRefusal(
      running,
      'lyric_revise',
      { seed: 16, draft: LINES, answer: '<answer>' },
      { seed: 16 }
    ),
    null
  );
  // A finished song stays qualified.
  const finished = stored(grade, ['lyric_revise', () => ({ exit_code: 0 })]);
  assert.equal(creationQualified(finished), true);
});

test('the derivation reads the receipts: plan coordinates, later pages, re-plans, held runs', () => {
  const { at, planArgs } = states('every');
  // A sweep and no plan: the plan with every coordinate, and no screen first.
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.swept), null, 'lyric_plan')),
    'NEXT: lyric_plan with seed 16, ' +
      `form "aaba", lines 2, functions "verse,chorus", relation ${JSON.stringify(relation)}, wants ["before=verse,chorus","lines<=30"], ` +
      "melody: the sweep's melody unchanged."
  );
  // A plan with no word-check under it: the screen, then the grade it is for.
  // The call names no words (they are the writer's); the seed is the grade's.
  assert.deepEqual(nextCreationCall(clone(at.planned), null, 'lyric_grade'), {
    tool: 'lyric_screen',
    args: {},
    seed: 16,
    lines: 2,
  });
  for (const reached of ['lyric_grade', 'lyric_revise', undefined])
    assert.equal(
      formatNextCall(nextCreationCall(clone(at.planned), null, reached)),
      "NEXT: lyric_screen with candidate words for this plan's rhymes; " +
        'then lyric_grade with seed 16 and the complete 2-line draft.'
    );
  // The screen on record under the plan: the grade.
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.screened), null, 'lyric_grade')),
    'NEXT: lyric_grade with seed 16 and the complete 2-line draft.'
  );
  assert.deepEqual(SWEEP_COORDINATES, ['form', 'lines', 'functions', 'relation', 'melody']);
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
  // A re-plan: the screen on record is the first plan's, so the new plan's
  // grade is reached through a screen of its own.
  assert.equal(
    formatNextCall(nextCreationCall(clone(at.replanned), null, 'lyric_revise')),
    "NEXT: lyric_screen with candidate words for this plan's rhymes; " +
      'then lyric_grade with seed 17 and the complete 2-line draft.'
  );
  const rescreened = clone(at.replanned);
  recordCreation(rescreened, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  assert.equal(
    formatNextCall(nextCreationCall(rescreened, null, 'lyric_revise')),
    'NEXT: lyric_grade with seed 17 and the complete 2-line draft.'
  );
  const none = states('none');
  assert.equal(
    formatNextCall(nextCreationCall(clone(none.at.swept), null, 'lyric_plan')),
    `NEXT: lyric_plan with seed 16, form ${FORM}.`
  );
  assert.equal(
    formatNextCall(nextCreationCall(clone(none.at.empty), null, 'lyric_screen')),
    SWEEP_LINE
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
    'NEXT: lyric_revise with seed 16, new_run: true and no draft; the 2-line draft lyric_grade graded is taken from the record. ' +
      'To change a line, grade the changed draft first.'
  );
  // A grade receipt written before the draft's text was kept holds only its
  // fingerprint: the caller is still told to send the graded draft, and that
  // call is admitted.
  const legacy = clone(at.graded);
  delete legacy.workflow.grade.draft;
  const told = formatNextCall(nextCreationCall(legacy, null, 'lyric_revise'));
  assert.equal(
    told,
    'NEXT: lyric_revise with seed 16 and the exact 2-line draft lyric_grade graded. ' +
      'To change a line, grade the changed draft first.'
  );
  const ctx = { newDraft: draft, graded: draft };
  for (const [name, args] of parseNext(told, ctx))
    assert.equal(creationRefusal(legacy, name, args, null), null);
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
    `ACCEPTED\n    NEXT: lyric_plan with seed 16, form ${FORM}, wants ["lines<=30"].\n`
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
      'CREATION_CONTINUATION: this session has no receipt for that run. Send lyric_revise without `state` or `checkpoint`; to start a run, grade the draft with lyric_grade, then call lyric_revise with that exact draft. NEXT: lyric_revise with seed 16 and no draft; the 2-line draft lyric_grade graded is taken from the record. To change a line, grade the changed draft first.',
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
    'ACCEPTED\n      16, 17\n    NEXT: lyric_plan ' +
      `with seed 16, form "aaba", lines 2, functions "verse,chorus", relation ${JSON.stringify(relation)}, wants ["before=verse,chorus","lines<=30"], ` +
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
// #671 B9/C4: a grade verdict keeps its `next` sentence and gains `next_call`,
// the same call as {tool, args}. A session (the maintained client) and /chat
// read their receipts after the grade is recorded; a raw grade knows only its
// seed.
test('a grade verdict names its next call from the receipts, in a session and in /chat', () => {
  const graded = (task, carried) => {
    const p = planReceipt(SHAPES.none, 16);
    const v = { ...gradeReceipt(p), next: 'raw sentence', next_call: { tool: 'x', args: {} } };
    const result = {
      content: [
        { type: 'text', text: 'the rendered song' },
        { type: 'text', text: JSON.stringify(v) },
      ],
    };
    return JSON.parse(withSweepNext(task, 'lyric_grade', result, carried).content[1].text);
  };
  const { at } = states('none');
  const runs = carriedRuns((seed) => ({ seed }));
  // No run yet: lyric_revise with the seed, no new_run.
  const first = graded(clone(at.graded), null);
  assert.deepEqual(first.next_call, { tool: 'lyric_revise', args: { seed: 16 } });
  // The receipt holds the graded draft, so the call sends none.
  assert.match(
    first.next,
    /^Call lyric_revise with this grade's seed and no draft: the graded draft and its declarations are taken from the record; /
  );
  assert.doesNotMatch(first.next, /new_run|this exact draft/);
  // A run open (the client's continuation, /chat's suspended record), or
  // stopped under this plan: a new run, as the stop's CONTINUE note says.
  for (const carried of [runs.client.answer, runs.chat.suspended, runs.chat.parked, null]) {
    const v = graded(clone(at.started), carried);
    assert.deepEqual(v.next_call, { tool: 'lyric_revise', args: { seed: 16, new_run: true } });
    assert.match(v.next, /^Call lyric_revise with this grade's seed, new_run: true and no draft: /);
  }
  // A grade receipt written before the draft's text was kept: the caller
  // sends the graded draft again, as the sentence always said.
  for (const [state, run] of [
    [
      'graded',
      /^Call lyric_revise with this exact draft, unchanged, and this grade's seed and declarations; /,
    ],
    ['started', /^Call lyric_revise with this exact draft, unchanged, .*, with new_run: true; /],
  ]) {
    const legacy = clone(at[state]);
    delete legacy.workflow.grade.draft;
    const v = graded(legacy, null);
    assert.match(v.next, run);
    assert.deepEqual(Object.keys(v.next_call), ['tool', 'args']);
  }
  // A held run, or a grade with no receipt for this plan (with or without the
  // plan's word-check on record), names none.
  for (const [task, carried] of [
    [at.started, runs.chat.uncertified_parked],
    [at.planned, null],
    [at.screened, null],
  ]) {
    const v = graded(clone(task), carried);
    assert.equal(Object.hasOwn(v, 'next'), false);
    assert.equal(Object.hasOwn(v, 'next_call'), false);
  }
  // An edit session and a raw call keep the raw grade's own fields.
  const edit = graded({ domain: 'lyrics', phase: 'edit' }, null);
  assert.equal(edit.next, 'raw sentence');
});

// Writer plan, stage 2: a finished plan names the call that takes it on. The
// CLI's closing lines are cut from the plan report and nothing replaced them.
// As with the grade, a session reads its receipts after the plan is recorded.
test('a plan verdict names its next call from the receipts, in a session and in /chat', () => {
  const planned = (task, carried) => {
    const p = planReceipt(SHAPES.none, 16);
    const v = { exit_code: 0, ...p, next: 'raw sentence', next_call: { tool: 'x', args: {} } };
    const result = {
      content: [
        { type: 'text', text: 'the plan report' },
        { type: 'text', text: JSON.stringify(v) },
      ],
    };
    return JSON.parse(withSweepNext(task, 'lyric_plan', result, carried).content[1].text);
  };
  const { at } = states('none');
  const runs = carriedRuns((seed) => ({ seed }));
  const lines = at.planned.workflow.plan.lines;
  assert.ok(
    Number.isInteger(lines) && lines > 0,
    `the plan receipt holds its line count (${lines})`
  );
  // A plan with no word-check under it, as a plan just recorded is: the
  // screen, which its grade needs first. The call names no words.
  const unscreened = planned(clone(at.planned), null);
  assert.deepEqual(unscreened.next_call, { tool: 'lyric_screen', args: {} });
  assert.equal(
    unscreened.next,
    "Call lyric_screen with candidate words for this plan's rhymes; " +
      `then lyric_grade with seed 16 and the complete ${lines}-line draft.`
  );
  assert.equal(
    unscreened.next,
    planNext(nextCreationCall(clone(at.planned), null), lines),
    'the sentence is the NEXT line the gate prints'
  );
  // The word-check already on record under this same plan, and nothing
  // graded under it: write the lines, then the grade.
  const first = planned(clone(at.screened), null);
  assert.deepEqual(first.next_call, { tool: 'lyric_grade', args: { seed: 16 } });
  assert.equal(first.next, planNext(first.next_call, lines));
  assert.ok(first.next.includes(`Write the ${lines} lines`) && first.next.includes('lyric_grade'));
  // A grade already stands under this same plan: the revise, on the graded draft.
  const regraded = planned(clone(at.graded), null);
  assert.equal(regraded.next_call.tool, 'lyric_revise');
  assert.match(regraded.next, /^Call lyric_revise with seed 16 /);
  // A held run names none, and neither does a session whose receipts hold no
  // plan (no accepted sweep, or a plan that was not recorded).
  for (const [task, carried] of [
    [at.started, runs.chat.uncertified_parked],
    [at.empty, null],
    [at.swept, null],
  ]) {
    const v = planned(clone(task), carried);
    assert.equal(Object.hasOwn(v, 'next'), false);
    assert.equal(Object.hasOwn(v, 'next_call'), false);
  }
  // An edit session and a raw call keep the raw plan's own fields.
  const edit = planned({ domain: 'lyrics', phase: 'edit' }, null);
  assert.equal(edit.next, 'raw sentence');
});

// #671 B1: an edit session refuses the calls that make a new song, as a
// create session refuses lyric_check and lyric_recover. The supplied-lyrics
// path, and a recovery export, stay open.
test('an edit session refuses a new song and keeps the supplied-lyrics path', () => {
  const edit = () => ({ domain: 'lyrics', phase: 'edit' });
  for (const [name, args] of [
    ['lyric_sweep', { seed_from: 0, count: 5 }],
    ['lyric_plan', { seed: 1 }],
    ['lyric_grade', { seed: 1, draft }],
    ['lyric_revise', { seed: 1, draft }],
    // A held seeded run: the session restores its seed before the gate reads it.
    ['lyric_revise', { seed: 1, answer: 'x', state: 'carried-state' }],
  ]) {
    const refusal = creationRefusal(edit(), name, args);
    assert.match(refusal, /^CREATION_PLAN: .*begin_lyrics phase 'create'/, name);
    assert.equal(withNextCall(refusal, edit(), null, name), refusal, 'no NEXT in an edit session');
  }
  for (const [name, args] of [
    ['lyric_recover', { lines: draft }],
    ['lyric_check', { lines: draft, scheme: 'AA' }],
    ['lyric_screen', { words: ['stove', 'coat'] }],
    ['lyric_verify', { before: draft, after: draft, scheme: 'AA' }],
    ['lyric_revise', { lines: draft, scheme: 'AA' }],
    ['lyric_revise', { seed: 1, recover_only: true, state: 'x' }],
  ])
    assert.equal(creationRefusal(edit(), name, args), null, name);
  // A held seeded run is refused even when the caller leaves the seed out:
  // the SDK's continuation and the chat's carried record both name it (3PO).
  for (const held of [{ args: { seed: 1 } }, { seed: 1 }, { decl: { seed: 1 } }]) {
    for (const args of [{ answer: 'x' }, { state: 'carried-state' }, { draft }]) {
      const refusal = creationRefusal(edit(), 'lyric_revise', args, held);
      assert.match(refusal, /^CREATION_PLAN: lyric_revise with a seed .*phase 'create'/);
    }
    // Recovery still exports it, and a fresh seedless run is still the edit route.
    assert.equal(
      creationRefusal(edit(), 'lyric_revise', { recover_only: true, state: 'x' }, held),
      null
    );
    assert.equal(
      creationRefusal(edit(), 'lyric_revise', { lines: draft, scheme: 'AA', new_run: true }, held),
      null
    );
  }
  // A held seedless run continues as before.
  for (const held of [{ args: { scheme: 'AA' } }, { seed: null, key: 'mandate:x' }])
    assert.equal(creationRefusal(edit(), 'lyric_revise', { answer: 'x' }, held), null);
});

// #671 C2: a raw sweep's NEXT carries the sweep's own declarations — lines
// and wants — not the seed alone.
test(
  'a raw lyric_sweep names the plan call with its lines and wants',
  { timeout: 300_000 },
  async () => {
    const raw = buildServer({ task: { domain: 'lyrics' } });
    const [ra, rb] = InMemoryTransport.createLinkedPair();
    await raw.connect(ra);
    const client = new Client({ name: 'raw', version: '1' }, { capabilities: {} });
    await client.connect(rb);
    try {
      const r = await client.callTool({
        name: 'lyric_sweep',
        arguments: { seed_from: 0, count: 20, lines: 12, want: ['sections>=3'] },
      });
      const { report, accepted_shown } = JSON.parse(r.content[0].text);
      assert.match(
        report,
        new RegExp(
          `NEXT: lyric_plan with seed ${accepted_shown[0]}, lines 12, wants \\["sections>=3"\\]\\.`
        )
      );
    } finally {
      await client.close();
      await raw.close();
    }
  }
);

test(
  "the real chain: the sweep's NEXT is followed, a screen before the plan names the plan, and the plan names the screen its grade needs",
  { timeout: 300_000 },
  async (t) => {
    // Raw /mcp/lyrics (no client): the line rebuilt from the sweep's own
    // arguments (#671, C2), the same call a fresh session names.
    const raw = buildServer({ task: { domain: 'lyrics' } });
    const [ra, rb] = InMemoryTransport.createLinkedPair();
    await raw.connect(ra);
    const rawClient = new Client({ name: 'raw', version: '1' }, { capabilities: {} });
    await rawClient.connect(rb);
    const sweepArgs = stated({ seed_from: 31, count: 1, lines: 12 });
    let rawReport;
    try {
      const r = await rawClient.callTool({ name: 'lyric_sweep', arguments: sweepArgs });
      rawReport = JSON.parse(r.content[0].text).report;
    } finally {
      await rawClient.close();
      await raw.close();
    }
    const rawLine = new RegExp(
      `NEXT: lyric_plan with seed (\\d+), form ${FORM}, lines 12\\.$`,
      'm'
    ).exec(rawReport);
    assert(rawLine, rawReport);
    const seed = Number(rawLine[1]);
    const expected = `NEXT: lyric_plan with seed ${seed}, form ${FORM}, lines 12.`;
    const ctx = { sweepArgs };
    const words = { ...WORDS, relation: 'class:ASSONANCE' };
    const placeholders = (lines) => Array.from({ length: lines }, (_, i) => `<line ${i + 1}>`);

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
      const [[, plan]] = parseNext(report.match(/NEXT: .*$/m)[0], ctx);
      assert.deepEqual(plan, { seed, form: sweepArgs.form, lines: 12 });
      // A screen before the plan is refused, and names the plan.
      await assert.rejects(
        c.call('lyric_screen', words),
        (e) => e.message === `${SCREEN_AFTER_PLAN} ${expected}`
      );
      const planned = await c.call('lyric_plan', plan);
      assert(!planned.isError, JSON.stringify(planned));
      const recorded = c.snapshot().task.workflow.plan;
      assert(recorded, 'the plan NEXT named is admitted and recorded, with no screen');
      // The plan's verdict names the screen its grade needs first.
      const v = verdictOf(planned);
      assert.deepEqual(v.next_call, { tool: 'lyric_screen', args: {} });
      assert.equal(v.next, `Call ${screenThenGradeCall(seed, recorded.lines)}`);
      // A grade before that screen is refused, and names the screen, then the grade.
      const lines = placeholders(recorded.lines);
      await assert.rejects(
        c.call('lyric_grade', { seed, draft: lines }),
        (e) => e.message === `${GRADE_NEEDS_SCREEN} ${screenThenGrade(seed, recorded.lines)}`
      );
      // Followed: the screen is admitted and recorded for the plan, and the
      // gate then admits the grade (not run here).
      await c.call('lyric_screen', words);
      const held = c.snapshot().task;
      assert.equal(held.workflow.screen?.plan_sha256, held.workflow.plan.sha256);
      assert.equal(creationRefusal(clone(held), 'lyric_grade', { seed, draft: lines }), null);
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
    const text = (r) => r.tool_result.content.map((block) => block.text).join('\n');
    const swept = await run('lyric_sweep', sweepArgs);
    assert(verdictOf(swept.tool_result).report.includes(expected), JSON.stringify(swept));
    const early = await run('lyric_screen', words);
    assert(text(early).includes(`${SCREEN_AFTER_PLAN} ${expected}`), text(early));
    const planned = await run('lyric_plan', { seed, lines: 12 });
    assert(!planned.tool_error, JSON.stringify(planned));
    const v = verdictOf(planned.tool_result);
    assert.equal(v.exit_code, 0, JSON.stringify(planned));
    assert.deepEqual(v.next_call, { tool: 'lyric_screen', args: {} });
    assert.equal(v.next, `Call ${screenThenGradeCall(seed, v.plan_lines)}`);
    const lines = placeholders(v.plan_lines);
    const ungated = await run('lyric_grade', { seed, draft: lines });
    assert(
      text(ungated).includes(`${GRADE_NEEDS_SCREEN} ${screenThenGrade(seed, v.plan_lines)}`),
      text(ungated)
    );
    const screened = await run('lyric_screen', words);
    assert(!screened.tool_error, JSON.stringify(screened));
    const kept = sessions.record(session_id, 'lyrics').session.native.task;
    assert.equal(kept.workflow.screen?.plan_sha256, kept.workflow.plan.sha256);
    assert.equal(creationRefusal(clone(kept), 'lyric_grade', { seed, draft: lines }), null);
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
        const plan = await call('lyric_plan', { seed, lines: 12, wants });
        assert.deepEqual(plan.plan_request.wants, wants);
        assert(task.workflow.plan, 'a successful plan must be recorded before grading');
        assert.equal(task.workflow.plan.sha256, plan.plan_sha256);
        await call('lyric_screen', { words: ['rain', 'train'] });
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

// #676: a session that plans a returning, rhymed, titled song and then plans
// again with none of that declared is admitted, as before. What changed is
// that the replacement's own result, and the grade under it, now say so. The
// real harness on a real /mcp session: two sweeps, two plans, a screen under
// each, and a grade read back as the short verdict.
test(
  'the real chain: a replaced plan says what it is not asked that the first was, on the plan and on the grade',
  { timeout: 420_000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'plan-lineage-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const sessions = new WorkflowSessions({ store: new JobStore(directory) });
    let session_id = sessions.open('lyrics').session_id;
    const run = async (name, args) => {
      const q = sessions.submit(session_id, 'lyrics', name, args);
      await sessions.wait(q.operation_id);
      const r = sessions.status(q.operation_id, 'lyrics');
      if (r.session_id) session_id = r.session_id;
      assert(!r.tool_error, `${name}: ${JSON.stringify(r).slice(0, 2000)}`);
      return verdictOf(r.tool_result);
    };
    const asked = { lines: 12, form: 'verse-chorus' };
    // SWEPT FROM 32, NOT 31 (re-measured 2026-11-15). A chorus that recurs is
    // repeated line for line in every form since the owner's ruling of that
    // day, and seed 31's `open` plan draws its chorus twice, so it plans the
    // same returns the first plan did and has no drop to report. Seed 32's
    // `open` plan draws no section twice.
    // The plan's relation is the sweep's own (stage 3: relation is a sweep
    // coordinate); what else the sweep leaves out it draws.
    const sweep1 = await run(
      'lyric_sweep',
      stated({ seed_from: 32, count: 1, ...asked, relation: 'class:RHYME' })
    );
    const seed1 = sweep1.accepted_shown[0];
    const plan1 = await run('lyric_plan', {
      seed: seed1,
      ...asked,
      relation: 'class:RHYME',
      title: 'Kettle and Coat',
    });
    assert.equal(plan1.exit_code, 0, JSON.stringify(plan1).slice(0, 2000));
    assert.equal(Object.hasOwn(plan1, 'plan_lineage'), false, 'a first plan has no lineage');
    await run('lyric_screen', { words: ['stove', 'coat'], relation: 'class:RHYME' });

    // Swept again with only the length declared, and planned.
    const sweep2 = await run('lyric_sweep', stated({ seed_from: 32, count: 1, lines: 12 }));
    const seed2 = sweep2.accepted_shown[0];
    const plan2 = await run('lyric_plan', { seed: seed2, lines: 12 });
    assert.equal(plan2.exit_code, 0, JSON.stringify(plan2).slice(0, 2000));
    const lineage = plan2.plan_lineage;
    assert(lineage, 'the replacement plan carries its lineage');
    assert.deepEqual(lineage.first_plan, { seed: seed1, plan_sha256: plan1.plan_sha256 });
    assert.equal(lineage.plans_recorded, 2);
    assert.deepEqual(lineage.declared_changes, [
      { field: 'form', first: 'verse-chorus', now: 'open' },
      { field: 'relation', first: 'class:RHYME', now: null },
      { field: 'title', first: 'Kettle and Coat', now: null },
    ]);
    // The first plan planned a hook and returning lines; this `open` plan
    // declares no hook and repeats no section, so it plans neither.
    const drawn = Object.fromEntries(lineage.drawn_changes.map((c) => [c.what, c]));
    assert.deepEqual(drawn.hook, { what: 'hook', first: true, now: false });
    assert.equal(drawn.returns.now, 0);
    assert.match(lineage.note, /^PLAN REPLACED: this is not the first plan this session recorded/);
    assert.match(lineage.note, /title Kettle and Coat → none/);

    // The grade under the replacement, read back as the short verdict. The
    // screen on record is the first plan's: the replacement gets its own first.
    await run('lyric_screen', { words: ['stove', 'coat'] });
    // The session publishes a plan without its structured copy; the count is its own field.
    const lines = plan2.plan_lines;
    const draft = Array.from(
      { length: lines },
      (_, i) =>
        `The kettle sings beside the stove at number ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'][i % 16]}`
    );
    const graded = await run('lyric_grade', { seed: seed2, draft });
    assert(Number.isInteger(graded.exit_code), JSON.stringify(graded).slice(0, 2000));
    assert.deepEqual(graded.plan_lineage, lineage, 'the grade carries the same lineage');
    assert(Array.isArray(graded.blocking), 'this is the short verdict');
  }
);
