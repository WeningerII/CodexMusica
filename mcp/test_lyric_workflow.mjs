import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEXICON_MANIFEST } from './lexicon_basis.js';
import { createHash } from 'node:crypto';
import {
  creationRefusal,
  recordCreation,
  creationQualified,
  gradeVerdictQualifies,
  planLineage,
  withPlanLineage,
} from './lyric_workflow.js';
import { runTurn, LIMITS, declarationsFor } from './gemini_agent.js';
import { _verdictInternals } from './lyric_tools.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fresh = () => ({
  version: 2,
  domain: 'lyrics',
  phase: 'create',
  brief: 'New love song.',
  completedSteps: ['lyric_sweep', 'lyric_screen', 'lyric_plan', 'lyric_grade'],
});
const sweepArgs = { seed_from: 10, count: 10, want: ['lines<=30'] };
const planArgs = { seed: 16, wants: ['lines<=30'] };
const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
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
const canonical = () => planReceipt();
function assessmentCoverage(refused = false, zeroPairs = false) {
  return {
    scope: 'requested_layers',
    certified: !refused,
    pairs_mandated: zeroPairs ? 0 : 1,
    pairs_judged: zeroPairs || refused ? 0 : 1,
    pairs_refused: refused && !zeroPairs ? 1 : 0,
    obligations: [
      { id: 'floor:draft', layer: 'floor', status: zeroPairs && refused ? 'refused' : 'answered' },
      ...(zeroPairs
        ? []
        : [{ id: 'rhyme:1:2:A', layer: 'rhyme', status: refused ? 'refused' : 'answered' }]),
    ],
    refused_obligations: refused ? [zeroPairs ? 'floor:draft' : 'rhyme:1:2:A'] : [],
  };
}
const V1 = LEXICON_MANIFEST.versions.find((v) => v.id === 'v1');
function gradeReceipt(p, lines = draft, { code = 3, coverage = assessmentCoverage() } = {}) {
  return {
    ..._verdictInternals.verdictOf({
      code,
      stdout: '',
      stderr: '',
      lyric_result: {
        version: 1,
        status: 'graded',
        command: 'song',
        coverage,
        final_draft: lines,
        findings: [],
        lexicon: { supplement_id: V1.id, sha256: V1.sha256 },
      },
    }),
    plan_sha256: p.plan_sha256,
  };
}
function preplan(t) {
  recordCreation(t, 'lyric_sweep', sweepArgs, { exit_code: 0, accepted_shown: [16, 17] });
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
}
function planned(t) {
  preplan(t);
  const p = canonical();
  recordCreation(t, 'lyric_plan', planArgs, p);
  return p;
}

test('completedSteps and model-supplied fake workflow do not establish creation receipts', () => {
  const t = fresh();
  assert.match(
    creationRefusal(t, 'lyric_revise', { scheme: 'AA', draft, completedSteps: t.completedSteps }),
    /CREATION_ORDER/
  );
  assert.match(creationRefusal(t, 'lyric_screen', { words: ['cat', 'hat'] }), /lyric_sweep/);
  assert.match(creationRefusal(t, 'lyric_plan', planArgs), /CREATION_ORDER/);
  assert.equal(creationQualified(t), false);
});

test('only accepted sweep seeds and unchanged declared structural predicates reach plan', () => {
  const t = fresh();
  preplan(t);
  assert.equal(creationRefusal(t, 'lyric_plan', { ...planArgs }), null);
  for (const args of [
    { seed: 99, wants: planArgs.wants },
    { seed: 16 },
    { ...planArgs, lines: 12 },
  ])
    assert.match(creationRefusal(t, 'lyric_plan', args), /CREATION_PLAN/);
});

test('a later sweep page keeps the screen receipt, so its seed plans without a re-screen', () => {
  // Paging the sweep used to wipe the screen receipt, forcing a screen of
  // any words at all (nothing checks which) before the new page's seed could
  // be planned. The screen records that the step ran in this session.
  const t = fresh();
  preplan(t);
  recordCreation(
    t,
    'lyric_sweep',
    { ...sweepArgs, seed_from: 20 },
    { exit_code: 0, accepted_shown: [22] }
  );
  assert.equal(creationRefusal(t, 'lyric_plan', { seed: 22, wants: planArgs.wants }), null);
  // The refusal for a plan that does not repeat the sweep names every field
  // the receipt compares, melody included.
  assert.match(
    creationRefusal(t, 'lyric_plan', { seed: 22, wants: planArgs.wants, melody: '{}' }),
    /form, lines, functions and melody, and its `want` list as `wants`/
  );
});

test('a failed, forged, stale or unadmitted plan cannot establish creation qualification', () => {
  for (const alter of [
    (p) => {
      p.exit_code = 2;
    },
    (p) => {
      p.plan_sha256 = 'fake';
    },
    (p) => {
      p.plan.request.seed = 17;
      p.plan_sha256 = sha(p.plan);
    },
  ]) {
    const t = fresh();
    preplan(t);
    const p = canonical();
    alter(p);
    recordCreation(t, 'lyric_plan', planArgs, p);
    assert.equal(t.workflow.plan, null);
    assert.match(creationRefusal(t, 'lyric_grade', { seed: 16, draft }), /CREATION_PLAN/);
  }
});

test('grade receipt binds the exact canonical plan and exact draft', () => {
  const t = fresh();
  const p = planned(t);
  assert.ok(t.workflow.plan);
  assert.match(creationRefusal(t, 'lyric_revise', { seed: 16, draft }), /CREATION_GRADE/);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, gradeReceipt(p, ['different', 'draft']));
  assert.match(creationRefusal(t, 'lyric_revise', { seed: 16, draft }), /CREATION_GRADE/);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, { ...gradeReceipt(p), plan_sha256: 'old' });
  assert.equal(t.workflow.grade, null);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, gradeReceipt(p));
  assert.equal(creationRefusal(t, 'lyric_revise', { seed: 16, draft }), null);
  assert.match(
    creationRefusal(t, 'lyric_revise', { seed: 16, draft, groups: '1,2' }),
    /hand-authored/
  );
  assert.match(
    creationRefusal(t, 'lyric_revise', { seed: 16, draft, wants: ['lines<=20'] }),
    /wants differs/
  );
  assert.match(
    creationRefusal(t, 'lyric_revise', { seed: 16, draft: ['new', 'draft'] }),
    /CREATION_GRADE/
  );
  recordCreation(t, 'lyric_revise', { seed: 16, draft }, { exit_code: 0 });
  assert.equal(creationQualified(t), true);
  recordCreation(t, 'lyric_plan', planArgs, p);
  assert.equal(creationQualified(t), false);
});

test('explicit edit tasks retain independent pasted-song grading and revision', () => {
  const t = { ...fresh(), phase: 'edit' };
  assert.equal(creationRefusal(t, 'lyric_revise', { groups: '1,2', draft }), null);
  assert.equal(creationRefusal(t, 'lyric_check', { groups: '1,2', lines: draft }), null);
  assert.equal(creationQualified(t), true);
});

test('an authenticated uncertain assessment permits repair but a pre-assessment refusal does not', () => {
  const t = fresh();
  const p = planned(t);
  const uncertain = gradeReceipt(p, draft, { code: 2, coverage: assessmentCoverage(true) });
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, uncertain);
  assert.equal(creationRefusal(t, 'lyric_revise', { seed: 16, draft }), null);
  assert.equal(t.workflow.grade.coverage_certified, false);
  assert.equal(creationQualified(t), false, 'assessment alone cannot finish a song');
  for (const patch of [
    { measurement_status: 'refused' },
    { measurement_status: 'no_authenticated_verdict' },
    { coverage: undefined },
    { coverage: { certified: true } },
    { coverage: { certified: false } },
    { certified: true },
  ]) {
    recordCreation(t, 'lyric_grade', { seed: 16, draft }, { ...uncertain, ...patch });
    assert.match(creationRefusal(t, 'lyric_revise', { seed: 16, draft }), /CREATION_GRADE/);
  }
});

test('actual graded projection requires coherent requested obligations while permitting zero rhyme pairs', () => {
  const t = fresh(),
    p = planned(t);
  const valid = assessmentCoverage(true);
  for (const patch of [
    { scope: 'capacity_stop' },
    { pairs_mandated: 2 },
    { pairs_judged: true },
    { obligations: [] },
    { refused_obligations: [] },
    { obligations: [...valid.obligations, valid.obligations[0]] },
    {
      obligations: valid.obligations.map((row) => ({ ...row, status: 'not_requested' })),
      refused_obligations: [],
      certified: true,
    },
    { pairs_mandated: 0, pairs_judged: 0, pairs_refused: 0 },
  ]) {
    recordCreation(
      t,
      'lyric_grade',
      { seed: 16, draft },
      gradeReceipt(p, draft, { code: 2, coverage: { ...valid, ...patch } })
    );
    assert.equal(t.workflow.grade, null, JSON.stringify(patch));
  }
  for (const refused of [false, true]) {
    const verdict = gradeReceipt(p, draft, {
      code: refused ? 2 : 0,
      coverage: assessmentCoverage(refused, true),
    });
    assert.equal(verdict.measurement_status, 'graded');
    recordCreation(t, 'lyric_grade', { seed: 16, draft }, verdict);
    assert.equal(creationRefusal(t, 'lyric_revise', { seed: 16, draft }), null);
    assert.equal(creationQualified(t), false, 'an assessment receipt cannot certify delivery');
  }
  const forged = _verdictInternals.verdictOf({
    code: 2,
    stdout: 'lyric result: {"status":"graded"}',
    stderr: '',
  });
  recordCreation(
    t,
    'lyric_grade',
    { seed: 16, draft },
    { ...forged, plan_sha256: p.plan_sha256, final_draft: draft, final_draft_sha256: sha(draft) }
  );
  assert.equal(
    t.workflow.grade,
    null,
    'untrusted report prose cannot stand in for the authenticated record'
  );
});

test('explicit narrative survives canonical plan receipts and omitted continuation arguments', () => {
  const t = fresh();
  preplan(t);
  const p = canonical();
  p.plan.request.narrative = { atoms: ['ESTABLISH', 'RESOLVE'], junctions: ['THEREFORE'] };
  p.plan_sha256 = sha(p.plan);
  const declared = { ...planArgs, narrative: 'establish, resolve / therefore' };
  recordCreation(t, 'lyric_plan', declared, p);
  assert.ok(t.workflow.plan);
  const gradeArgs = { seed: 16, draft };
  assert.equal(creationRefusal(t, 'lyric_grade', gradeArgs), null);
  assert.equal(gradeArgs.narrative, 'ESTABLISH,RESOLVE/THEREFORE');
  assert.equal(
    creationRefusal(t, 'lyric_grade', { ...gradeArgs, narrative: declared.narrative }),
    null
  );
  assert.match(
    creationRefusal(t, 'lyric_grade', { ...gradeArgs, narrative: 'off' }),
    /narrative differs/
  );
  recordCreation(t, 'lyric_grade', gradeArgs, gradeReceipt(p));
  const reviseArgs = { seed: 16, draft };
  assert.equal(creationRefusal(t, 'lyric_revise', reviseArgs), null);
  assert.equal(reviseArgs.narrative, gradeArgs.narrative);
});

const nativeFetch = globalThis.fetch;
const surface = {
  instructions: '=== RECIPE TASK === Recipes. === LYRICS TASK === Lyrics.',
  declarations: ['lyric_sweep', 'lyric_screen', 'lyric_plan', 'lyric_grade', 'lyric_revise'].map(
    (name) => ({ name, parameters: { type: 'object', properties: {} } })
  ),
  workspaceTools: new Set(),
  stateTools: new Set(['lyric_revise']),
};
const fc = (name, args) => ({ functionCall: { name, args } });
const response = (parts) => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [{ content: { parts }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, thoughtsTokenCount: 0 },
  }),
});
const opts = {
  apiKey: 'offline',
  surface,
  userText: 'New love song.',
  limits: { ...LIMITS, maxSteps: 8, maxTurnMs: 5000, maxTurnUsd: 0 },
};
const result = (v) => ({ content: [{ type: 'text', text: JSON.stringify(v) }] });

test('actual driver refuses reordered creation before calling any tool', async () => {
  let requests = 0,
    dispatched = 0;
  globalThis.fetch = async () =>
    response(++requests === 1 ? [fc('lyric_revise', { seed: 16, draft })] : [{ text: 'FINISHED' }]);
  try {
    const out = await runTurn({
      ...opts,
      task: fresh(),
      callTool: async () => {
        dispatched++;
      },
    });
    assert.equal(dispatched, 0);
    assert.equal(out.completion, null);
    assert.match(out.calls[0].error, /CREATION_ORDER/);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('actual kitchen driver exports the explicit original envelope without resuming its carried run', async () => {
  for (const original of [
    { recover_only: true, state: 'original-state', recovery_part: 'journal' },
    { recover_only: true, checkpoint: 'original-checkpoint' },
    { recover_only: true, state: 'original-state', answer: 'forbidden', writer: 'kitchen' },
  ]) {
    let requests = 0;
    const dispatched = [];
    const exported = {
      status: 'recovered_artifact',
      recovery_part: original.recovery_part ?? 'all',
      certified: false,
      resumable: false,
      new_run_required: true,
      original_wire_sha256: 'a'.repeat(64),
      ...(original.recovery_part === 'journal'
        ? { journal: { accepted_lines: draft, answered: {} }, journal_included: true }
        : {
            final_draft: draft,
            replay_draft: draft,
            journal_included: false,
            next_recovery_part: 'journal',
            meaning: 'Use recovery_part:"journal" with the SAME original checkpoint.',
          }),
    };
    const carried = {
      seed: 16,
      resumable: true,
      uncertain_proposal: true,
      decl: { seed: 16 },
      draft,
      final_draft: draft,
      checkpoint: 'host-checkpoint',
      run_id: 'host-run',
      run_revision: 7,
    };
    const liveArtifact = {
      text: 'Current accepted lyrics',
      final_draft: ['Current accepted lyrics'],
      certified: false,
    };
    globalThis.fetch = async () =>
      response(
        ++requests === 1
          ? [
              fc('lyric_revise', original),
              ...(!original.answer ? [fc('lyric_revise', { seed: 16, draft })] : []),
            ]
          : [{ text: 'Recovered.' }]
      );
    try {
      const out = await runTurn({
        ...opts,
        writer: 'kitchen',
        task: { ...fresh(), completedSteps: [], artifact: liveArtifact },
        lyric: carried,
        callTool: async (name, args) => {
          dispatched.push({ name, args });
          if (args.answer)
            return {
              isError: true,
              content: [{ type: 'text', text: 'Recovery forbids answers and execution fields.' }],
            };
          return result(exported);
        },
      });
      assert.deepEqual(dispatched, [{ name: 'lyric_revise', args: original }]);
      assert.equal(out.completion, null);
      assert.equal(out.task.workflow.started, null);
      assert.deepEqual(out.task.completedSteps, []);
      assert.deepEqual(out.lyric, carried);
      assert.deepEqual(out.artifact, liveArtifact);
      assert.deepEqual(out.task.artifact, liveArtifact);
      assert.equal(out.calls[0].draft_carried, false);
      assert.equal(out.calls[0].declarations_carried, false);
      assert.equal(requests, original.answer ? 2 : 1);
      if (!original.answer) {
        assert.equal(out.reply, JSON.stringify(exported));
        assert.equal(out.stopped, 'RECOVERY_EXPORTED');
        assert.equal(
          out.artifact.certified,
          false,
          'the export does not certify the live lyric artifact'
        );
        assert.equal(out.stoppedDetail.next_recovery_part, exported.next_recovery_part ?? null);
        assert.equal(out.calls[1].not_run, true);
        assert.match(out.calls[1].error, /RECOVERY_EXPORTED/);
      }
    } finally {
      globalThis.fetch = nativeFetch;
    }
  }
});

test('a bare recover_only on /chat recovers the carried continuation (the run ledger names that way out)', async () => {
  const carried = {
    seed: 16,
    resumable: true,
    decl: { seed: 16 },
    draft,
    checkpoint: 'host-checkpoint',
    run_id: 'host-run',
    run_revision: 7,
  };
  const cases = [
    [{ recover_only: true }, carried, { recover_only: true, checkpoint: 'host-checkpoint' }],
    [
      { recover_only: true, recovery_part: 'journal', seed: 16 },
      carried,
      { recover_only: true, recovery_part: 'journal', checkpoint: 'host-checkpoint' },
    ],
    [
      { recover_only: true },
      { ...carried, checkpoint: undefined, state: 'host-state' },
      { recover_only: true, state: 'host-state' },
    ],
  ];
  for (const [call, lyric, expected] of cases) {
    let requests = 0;
    const dispatched = [];
    globalThis.fetch = async () =>
      response(++requests === 1 ? [fc('lyric_revise', call)] : [{ text: 'Recovered.' }]);
    try {
      await runTurn({
        ...opts,
        writer: 'kitchen',
        task: { ...fresh(), completedSteps: [] },
        lyric,
        callTool: async (name, args) => {
          dispatched.push({ name, args });
          return result({
            status: 'recovered_artifact',
            recovery_part: args.recovery_part ?? 'all',
            certified: false,
            resumable: false,
            new_run_required: true,
            final_draft: draft,
          });
        },
      });
      assert.deepEqual(dispatched, [{ name: 'lyric_revise', args: expected }]);
    } finally {
      globalThis.fetch = nativeFetch;
    }
  }
});

test('kitchen declarations retain the recovery export door during suspended and parked runs', () => {
  const declaration = {
    name: 'lyric_revise',
    parameters: {
      type: 'object',
      required: [],
      properties: Object.fromEntries(
        [
          'draft',
          'draft_text',
          'recover_only',
          'recovery_part',
          'checkpoint',
          'writer',
          'answer',
          'answers',
          'run_id',
        ].map((key) => [key, { type: key === 'recover_only' ? 'boolean' : 'string' }])
      ),
    },
  };
  for (const lyric of [
    null,
    { seed: 16, draft, resumable: true },
    { seed: 16, draft, parked: true },
  ]) {
    const got = declarationsFor({ ...surface, declarations: [declaration] }, lyric, 'kitchen')[0]
      .parameters;
    for (const key of ['recover_only', 'recovery_part', 'checkpoint'])
      assert.ok(got.properties[key], key);
    for (const key of ['writer', 'answer', 'answers', 'run_id'])
      assert.equal(got.properties[key], undefined, key);
    assert.match(got.properties.checkpoint.description, /Only with recover_only:true/);
    assert.deepEqual(got.required, []); // an export has no draft or execution coordinates
  }
});

test('actual driver qualifies only successful sweep-screen-program-plan-exact-grade-revise sequence', async () => {
  const p = canonical();
  const artifact = draft.join('\n') + '\n[FINISHED]';
  const actions = [
    fc('lyric_sweep', sweepArgs),
    fc('lyric_screen', { words: ['stove', 'coat'] }),
    fc('lyric_plan', planArgs),
    fc('lyric_grade', { seed: 16, draft }),
    fc('lyric_revise', { seed: 16, draft }),
  ];
  let requests = 0;
  const dispatched = [];
  globalThis.fetch = async () =>
    response(requests < actions.length ? [actions[requests++]] : [{ text: 'done' }]);
  try {
    const out = await runTurn({
      ...opts,
      task: fresh(),
      callTool: async (name, args) => {
        dispatched.push(name);
        if (name === 'lyric_sweep') return result({ exit_code: 0, accepted_shown: [16] });
        if (name === 'lyric_screen') return result({ exit_code: 0 });
        if (name === 'lyric_plan') return result(p);
        if (name === 'lyric_grade') return result(gradeReceipt(p));
        assert.deepEqual(args.wants, planArgs.wants);
        return result({
          exit_code: 0,
          status: 'finished_clean',
          certified: true,
          draft_fp: 'exact',
          presentation_text: artifact,
          final_draft: draft,
          final_draft_sha256: sha(draft),
        });
      },
    });
    assert.deepEqual(
      dispatched,
      actions.map((a) => a.functionCall.name)
    );
    assert.equal(out.completion?.certified, true);
    assert.equal(out.reply, artifact);
    assert.equal(out.task.phase, 'create');
    assert.ok(out.task.plan.sha256);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('grade receipt binds pronunciation, fallback and voices; omitted readings are restored', () => {
  const t = fresh();
  const p = planned(t);
  const pronunciations = [
    {
      line: draft[0],
      token: 2,
      word: 'kettle',
      phones: ['K', 'EH1', 'T', 'AH0', 'L'],
      basis: 'dictionary',
      source: 'writer: test reading',
    },
  ];
  recordCreation(
    t,
    'lyric_grade',
    { seed: 16, draft, pronunciations, fallback: 'low', voices: true },
    gradeReceipt(p)
  );
  const args = { seed: 16, draft };
  assert.equal(creationRefusal(t, 'lyric_revise', args), null);
  assert.deepEqual(args.pronunciations, pronunciations);
  assert.equal(args.fallback, 'low');
  assert.equal(args.voices, true);
  for (const changed of [{ pronunciations: [] }, { fallback: 'high' }, { voices: false }])
    assert.match(
      creationRefusal(t, 'lyric_revise', { seed: 16, draft, ...changed }),
      /CREATION_GRADE/
    );
  args.pronunciations[0].phones[0] = 'Z';
  assert.equal(t.workflow.grade.readings.pronunciations[0].phones[0], 'K');
});

test('creation carries melody and refuses a changed tune', () => {
  const t = fresh();
  const melody = {
    meter: { beats: 4, unit: 4, groups: [2, 2] },
    bars: 2,
    subdivision: 1,
    notes: [{ pitch_hz: 432.5, ticks: 8 }],
  };
  recordCreation(
    t,
    'lyric_sweep',
    { ...sweepArgs, melody: JSON.stringify(melody) },
    { exit_code: 0, accepted_shown: [16] }
  );
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  const p = canonical();
  p.plan.request.melody = melody;
  p.plan_sha256 = sha(p.plan);
  recordCreation(t, 'lyric_plan', { ...planArgs, melody: JSON.stringify(melody) }, p);
  const args = { ...planArgs, draft };
  creationRefusal(t, 'lyric_grade', args);
  assert.deepEqual(JSON.parse(args.melody), melody);
  const reordered = JSON.stringify({
    notes: melody.notes,
    subdivision: 1,
    bars: 2,
    meter: melody.meter,
  });
  assert.equal(creationRefusal(t, 'lyric_grade', { ...args, melody: reordered }), null);
  assert.match(creationRefusal(t, 'lyric_grade', { ...args, melody: '{}' }), /melody differs/);
});

test('creation normalizes draft_text before exact grade and revision qualification', () => {
  const t = fresh();
  const p = planned(t);
  const args = { seed: 16, draft_text: draft.join('\r\n') };
  assert.equal(creationRefusal(t, 'lyric_grade', args), null);
  assert.deepEqual(args.draft, draft);
  recordCreation(t, 'lyric_grade', args, gradeReceipt(p));
  assert.ok(t.workflow.grade);
  assert.equal(creationRefusal(t, 'lyric_revise', { ...args }), null);
  assert.match(
    creationRefusal(t, 'lyric_revise', {
      seed: 16,
      draft_text: 'changed\nwords',
    }),
    /CREATION_GRADE/
  );
  assert.match(
    creationRefusal(t, 'lyric_grade', {
      seed: 16,
      draft,
      draft_text: 'changed\nwords',
    }),
    /conflicting draft/
  );
  assert.match(
    creationRefusal(t, 'lyric_grade', {
      seed: 16,
      draft_text: draft[0],
    }),
    /line count/
  );
});

test('array whitespace is normalized before binding the grade receipt', () => {
  const t = fresh();
  const p = planned(t);
  const args = { seed: 16, draft: draft.map((line) => `  ${line}  `) };
  assert.equal(creationRefusal(t, 'lyric_grade', args), null);
  recordCreation(t, 'lyric_grade', args, gradeReceipt(p));
  assert.ok(t.workflow.grade);
  assert.deepEqual(args.draft, draft);
  assert.equal(
    creationRefusal(t, 'lyric_revise', {
      seed: 16,
      draft: draft.map((line) => ` ${line} `),
    }),
    null
  );
});

test('grade receipt accepts its exact normalized reading alias without accepting changed phones', () => {
  const t = fresh();
  const p = planned(t);
  const original = [
    {
      line: draft[0],
      token: 2,
      word: 'kettle',
      phones: ['K', 'EH1', 'T', 'AH0', 'L'],
      basis: 'dictionary',
      source: 'writer: test',
      numbering: 'v1',
    },
  ];
  const normalized = [{ ...original[0], token: 3, numbering: 'v2' }];
  recordCreation(
    t,
    'lyric_grade',
    { seed: 16, draft, pronunciations: original },
    { ...gradeReceipt(p), pronunciations: normalized }
  );
  for (const choices of [original, normalized]) {
    const args = { seed: 16, draft, pronunciations: structuredClone(choices) };
    assert.equal(creationRefusal(t, 'lyric_revise', args), null);
    assert.deepEqual(args.pronunciations, original, 'preserve original run identity');
  }
  assert.match(
    creationRefusal(t, 'lyric_revise', {
      seed: 16,
      draft,
      pronunciations: [{ ...normalized[0], phones: ['Z'] }],
    }),
    /CREATION_GRADE/
  );
});

test('a grade or revise with no usable draft is refused with the CREATION_DRAFT text', () => {
  // Option B (John's ruling): the session keeps requiring the draft and the
  // text says how to send it. Whole string, anchored at both ends; the NEXT
  // clause is appended later, at the client and /chat seams.
  const remedy = (draft) =>
    new RegExp(
      `^CREATION_DRAFT: the exact complete draft is required\\. Send this same call again with ${draft} as \`draft\` \\(one line per item\\) or \`draft_text\` \\(one newline-separated string\\)\\.$`
    );
  const missing = remedy('the draft');
  const t = fresh();
  const p = planned(t);
  for (const shape of [
    {},
    { draft: [] },
    { draft: ['', '   '] },
    { draft_text: '' },
    { draft_text: '[VERSE]' },
  ]) {
    assert.match(
      creationRefusal(t, 'lyric_grade', { seed: 16, ...shape }),
      missing,
      JSON.stringify(shape)
    );
    assert.equal(t.workflow.grade, null, 'a refused grade writes no receipt');
  }
  // The revise half: the exact draft was graded, then revise is sent with
  // the seed and declarations but no draft.
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, gradeReceipt(p));
  const graded = structuredClone(t.workflow.grade);
  assert.ok(graded);
  for (const shape of [{}, { draft_text: '' }]) {
    assert.match(
      creationRefusal(t, 'lyric_revise', { ...planArgs, ...shape }),
      remedy('the exact draft lyric_grade graded'),
      JSON.stringify(shape)
    );
    assert.deepEqual(t.workflow.grade, graded, 'the grade receipt is unchanged');
    assert.equal(t.workflow.started, null, 'no revision was started');
  }
  // Control: the same revise with the exact graded draft is admitted.
  assert.equal(creationRefusal(t, 'lyric_revise', { ...planArgs, draft }), null);
});

test('the grade-receipt verdict predicate holds exactly when a grade receipt is written', () => {
  // The grade's `next` is set from this predicate alone (lyric_tools.js), so
  // it must agree with the receipt recordCreation writes for the exact draft
  // of the recorded plan.
  const t = fresh();
  const p = planned(t);
  const certified = gradeReceipt(p, draft, { code: 0 });
  const cases = [
    ['exit 0, certified', certified, true],
    ['exit 3, certified', gradeReceipt(p, draft, { code: 3 }), true],
    [
      'exit 2, uncertified',
      gradeReceipt(p, draft, { code: 2, coverage: assessmentCoverage(true) }),
      true,
    ],
    ['exit 2, certified', gradeReceipt(p, draft, { code: 2 }), false],
    ['exit 1', { ...certified, exit_code: 1 }, false],
    ['refused', { ...certified, measurement_status: 'refused' }, false],
    ['no coverage', { ...certified, coverage: undefined }, false],
    ['bare certification', { ...certified, coverage: { certified: true } }, false],
    ['certified disagrees', { ...certified, certified: false }, false],
    ['no reading basis', { ...certified, lexicon: undefined }, false],
    [
      'forged reading basis',
      { ...certified, lexicon: { supplement_id: 'v1', sha256: 'x' } },
      false,
    ],
  ];
  for (const [label, verdict, qualifies] of cases) {
    assert.equal(gradeVerdictQualifies(verdict), qualifies, label);
    recordCreation(t, 'lyric_grade', { seed: 16, draft }, verdict);
    assert.equal(!!t.workflow.grade, qualifies, label);
  }
  // The session half stays recordCreation's: a qualifying verdict for
  // another draft writes no receipt.
  const other = gradeReceipt(p, ['different', 'draft'], { code: 0 });
  assert.equal(gradeVerdictQualifies(other), true);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, other);
  assert.equal(t.workflow.grade, null);
  assert.equal(gradeVerdictQualifies(null), false);
});

test('a refused plan says what the recorded sweeps hold, bounded, and never prints a melody', () => {
  const t = fresh();
  preplan(t);
  // A seed a sweep accepted: that sweep's coordinates and the fields this call differs in.
  const differs = creationRefusal(t, 'lyric_plan', { seed: 16, lines: 12 });
  assert.match(differs, /^CREATION_PLAN: plan a seed an accepted lyric_sweep returned, /);
  assert.ok(
    differs.includes(
      'Recorded sweeps that accepted seed 16, newest first: (1) form open, lines none, ' +
        'functions none, melody none, want ["lines<=30"]; this call differs in lines, ' +
        "wants (the sweep's `want`)."
    ),
    differs
  );
  // The call the text describes is admitted.
  assert.equal(creationRefusal(t, 'lyric_plan', { seed: 16, wants: ['lines<=30'] }), null);
  // A seed no sweep accepted: each recorded sweep's accepted seeds and coordinates.
  const melody = JSON.stringify({ secret_melody_marker: [440, 880] });
  recordCreation(
    t,
    'lyric_sweep',
    { seed_from: 20, count: 10, lines: 12, functions: 'verse,chorus', melody, want: ['a=b,c'] },
    { exit_code: 0, accepted_shown: [21, 22, 23, 24, 25, 26, 27] }
  );
  const none = creationRefusal(t, 'lyric_plan', { seed: 99 });
  assert.ok(
    none.includes(
      'No recorded sweep accepted seed 99. Recorded sweeps, newest first: ' +
        '(1) accepted seeds [21,22,23,24,25] and 2 more; form open, lines 12, ' +
        'functions ["chorus","verse"], melody declared, want ["a=b,c"]; ' +
        '(2) accepted seeds [16,17]; form open, lines none, functions none, ' +
        'melody none, want ["lines<=30"].'
    ),
    none
  );
  assert.ok(!none.includes('secret_melody_marker'), 'a melody is never printed');
  // Bounded: the newest three sweeps, and how many older ones were left out.
  for (const from of [30, 40, 50])
    recordCreation(
      t,
      'lyric_sweep',
      { seed_from: from, count: 1 },
      { exit_code: 0, accepted_shown: [from + 1] }
    );
  const bounded = creationRefusal(t, 'lyric_plan', { seed: 99 });
  assert.match(bounded, /\(1\) accepted seeds \[51\].*\(3\) accepted seeds \[31\]/);
  assert.ok(!bounded.includes('[21,'), bounded);
  assert.match(bounded, / \(2 older recorded sweep\(s\) not shown\)\.$/);
  assert.equal(creationRefusal(t, 'lyric_plan', { seed: 51 }), null);
});

test('a contradicted plan declaration names the recorded value, and leaving it out is admitted', () => {
  const t = fresh();
  const p = planned(t);
  const before = structuredClone(t.workflow);
  // lyric_plan was not given lines: the drawn length is a report, never a declaration.
  assert.equal(
    creationRefusal(t, 'lyric_grade', { seed: 16, draft, lines: 2 }),
    'CREATION_PLAN: lines differs from the recorded program plan. lyric_plan was not given ' +
      '`lines`; leave it out (the plan drew 2 lines; a report, not a declaration).'
  );
  assert.equal(
    creationRefusal(t, 'lyric_grade', { seed: 16, draft, wants: ['lines<=20'] }),
    'CREATION_PLAN: wants differs from the recorded program plan. The plan recorded wants ' +
      '["lines<=30"]; leave `wants` out and the recorded value is used.'
  );
  assert.equal(
    creationRefusal(t, 'lyric_grade', { seed: 17, draft }),
    'CREATION_PLAN: seed differs from the recorded program plan. The plan recorded seed 16; ' +
      'send seed 16.'
  );
  assert.deepEqual(t.workflow, before, 'a refusal records nothing');
  const args = { seed: 16, draft };
  assert.equal(creationRefusal(t, 'lyric_grade', args), null);
  assert.deepEqual(args.wants, ['lines<=30'], 'the recorded value is used');
  // The graded reading: leaving the key out is admitted and restores it.
  const pronunciations = [
    {
      line: draft[0],
      token: 2,
      word: 'kettle',
      phones: ['K', 'EH1', 'T', 'AH0', 'L'],
      basis: 'dictionary',
      source: 'writer: test',
    },
  ];
  recordCreation(t, 'lyric_grade', { seed: 16, draft, pronunciations }, gradeReceipt(p));
  assert.equal(
    creationRefusal(t, 'lyric_revise', { seed: 16, draft, pronunciations: [] }),
    'CREATION_GRADE: pronunciations differs from the graded reading; execute lyric_grade again ' +
      'before starting a new revision. Leave `pronunciations` out and the graded reading is ' +
      'used, or grade again with this reading.'
  );
  const revise = { seed: 16, draft };
  assert.equal(creationRefusal(t, 'lyric_revise', revise), null);
  assert.deepEqual(revise.pronunciations, pronunciations);
});

// ── #676: a replaced plan says what it is not asked that the first was ──────
// The gate protects a recorded plan; an admitted new plan replaced it and
// nothing on any later result said the contract had changed. These walk the
// record with receipts in the planner's own shape.
function lineagePlan(seed, { request = {}, plan = {} } = {}) {
  const req = {
    seed,
    form: 'open',
    lines: null,
    relation: '',
    functions: null,
    title: '',
    narrative: false,
    wants: [],
    ...request,
  };
  const p = {
    plan_version: 3,
    request: req,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{ name: 'VERSE' }],
    relations: { A: 'schema:consonance' },
    groups: '1,2',
    returns: '',
    hook_slot: null,
    ...plan,
  };
  return { exit_code: 0, plan: p, plan_sha256: sha(p), plan_request: req };
}
// A first plan that asks for a returning form, a rhyme and a title, and the
// plan a session falls back to after re-sweeping with none of it declared.
const FIRST = {
  sweep: { seed_from: 10, count: 2, form: 'verse-chorus', lines: 2 },
  args: {
    seed: 16,
    form: 'verse-chorus',
    lines: 2,
    relation: 'class:RHYME',
    title: 'Salt and Rain',
  },
  receipt: () =>
    lineagePlan(16, {
      request: {
        form: 'verse-chorus',
        lines: 2,
        relation: 'class:RHYME',
        title: 'Salt and Rain',
      },
      plan: {
        relations: { A: 'class:RHYME', B: 'class:RHYME' },
        groups: '1,2;1.head,2.head',
        returns: '1,2',
        hook_slot: 1,
      },
    }),
};
const SECOND = {
  sweep: { seed_from: 20, count: 2 },
  args: { seed: 21 },
  receipt: () => lineagePlan(21),
};
function plannedTwice(t) {
  recordCreation(t, 'lyric_sweep', FIRST.sweep, { exit_code: 0, accepted_shown: [16] });
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  const first = FIRST.receipt();
  recordCreation(t, 'lyric_plan', FIRST.args, first);
  assert.equal(t.workflow.plan.sha256, first.plan_sha256, 'the first plan is recorded');
  assert.equal(planLineage(t), null, 'a session on its first plan has no lineage');
  recordCreation(t, 'lyric_sweep', SECOND.sweep, { exit_code: 0, accepted_shown: [21] });
  const second = SECOND.receipt();
  recordCreation(t, 'lyric_plan', SECOND.args, second);
  assert.equal(t.workflow.plan.sha256, second.plan_sha256, 'the replacement is recorded');
  return { first, second };
}

test('a replaced plan carries what the first plan asked and this one does not (#676)', () => {
  const t = fresh();
  const { first } = plannedTwice(t);
  const lineage = planLineage(t);
  assert.deepEqual(lineage.first_plan, { seed: 16, plan_sha256: first.plan_sha256 });
  assert.equal(lineage.plans_recorded, 2);
  assert.deepEqual(lineage.declared_changes, [
    { field: 'form', first: 'verse-chorus', now: 'open' },
    { field: 'lines', first: 2, now: null },
    { field: 'relation', first: 'class:RHYME', now: null },
    { field: 'title', first: 'Salt and Rain', now: null },
  ]);
  assert.deepEqual(lineage.drawn_changes, [
    { what: 'relation_types', first: ['class:RHYME'], now: ['schema:consonance'] },
    { what: 'bound_groups', first: 2, now: 1 },
    { what: 'returns', first: 1, now: 0 },
    { what: 'hook', first: true, now: false },
  ]);
  assert.equal(
    lineage.note,
    'PLAN REPLACED: this is not the first plan this session recorded (that was seed 16). ' +
      'It was declared differently — form verse-chorus → open; lines 2 → none; ' +
      'relation class:RHYME → none; title Salt and Rain → none. ' +
      'The planner bound a different shape — relation_types ["class:RHYME"] → ["schema:consonance"]; ' +
      'bound_groups 2 → 1; returns 1 → 0; hook yes → no. ' +
      'A grade or revise under this plan answers for this plan only: it does not show that what ' +
      "the first plan asked was met. When you present the song, say which of the first plan's " +
      'declarations it no longer answers to.'
  );
});

test('the lineage rides the verdict of a plan, grade and revise, and nothing else (#676)', () => {
  const t = fresh();
  plannedTwice(t);
  const song = { type: 'text', text: 'My kettle whistles by the stove' };
  const verdict = { type: 'text', text: JSON.stringify({ exit_code: 0, certified: true }) };
  for (const name of ['lyric_plan', 'lyric_grade', 'lyric_revise']) {
    const out = withPlanLineage(t, name, { content: [song, verdict] });
    assert.equal(out.content[0], song, 'the deliverable block is the same object');
    const v = JSON.parse(out.content[1].text);
    assert.deepEqual(v.plan_lineage, planLineage(t), name);
    assert.equal(v.exit_code, 0);
    assert.equal(v.certified, true);
  }
  // A one-block result that IS the verdict.
  const one = withPlanLineage(t, 'lyric_plan', { content: [verdict] });
  assert.ok(JSON.parse(one.content[0].text).plan_lineage);
  // Unchanged: other tools, a refused call, a result with no verdict block.
  for (const [name, result] of [
    ['lyric_sweep', { content: [verdict] }],
    ['lyric_screen', { content: [verdict] }],
    ['lyric_check', { content: [verdict] }],
    ['lyric_grade', { content: [verdict], isError: true }],
    ['lyric_grade', { content: [song] }],
    ['lyric_grade', { content: [{ type: 'text', text: '{"report":"no exit code"}' }] }],
  ])
    assert.equal(withPlanLineage(t, name, result), result, name);
});

test('no lineage on a first plan, a repeated plan, the first plan again, or an edit session (#676)', () => {
  const single = fresh();
  planned(single);
  const verdict = { content: [{ type: 'text', text: '{"exit_code":0}' }] };
  assert.equal(planLineage(single), null);
  assert.equal(withPlanLineage(single, 'lyric_grade', verdict), verdict);
  // The same plan recorded twice is one plan.
  recordCreation(single, 'lyric_plan', planArgs, canonical());
  assert.equal(planLineage(single), null);
  assert.equal(single.workflow.first_plan.recorded, 1);

  // Back on the first plan: nothing is owed to it any more.
  const t = fresh();
  plannedTwice(t);
  assert.ok(planLineage(t));
  recordCreation(t, 'lyric_plan', FIRST.args, FIRST.receipt());
  assert.equal(planLineage(t), null, 'the first plan is the recorded plan again');
  assert.equal(t.workflow.first_plan.recorded, 3);

  // A failed re-plan leaves no recorded plan, so there is nothing to compare.
  const failed = fresh();
  plannedTwice(failed);
  recordCreation(failed, 'lyric_plan', SECOND.args, { ...SECOND.receipt(), exit_code: 2 });
  assert.equal(failed.workflow.plan, null);
  assert.equal(planLineage(failed), null);

  // Lyrics the user supplied are never planned.
  const edit = { version: 2, domain: 'lyrics', phase: 'edit', brief: 'Fix my song.' };
  assert.equal(planLineage(edit), null);
  assert.equal(withPlanLineage(edit, 'lyric_revise', verdict), verdict);
});

test('same declarations under another seed: the drawn shape is named, no declaration is (#676)', () => {
  const t = fresh();
  recordCreation(t, 'lyric_sweep', SECOND.sweep, { exit_code: 0, accepted_shown: [21, 22] });
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  recordCreation(t, 'lyric_plan', { seed: 21 }, lineagePlan(21));
  recordCreation(
    t,
    'lyric_plan',
    { seed: 22 },
    lineagePlan(22, { plan: { relations: { A: 'schema:anadiplosis' } } })
  );
  const lineage = planLineage(t);
  assert.deepEqual(lineage.declared_changes, []);
  assert.deepEqual(lineage.drawn_changes, [
    { what: 'relation_types', first: ['schema:consonance'], now: ['schema:anadiplosis'] },
  ]);
  assert.equal(
    lineage.note,
    'PLAN REPLACED: this is not the first plan this session recorded (that was seed 21). ' +
      'Its declarations are the same. ' +
      'The planner bound a different shape — relation_types ["schema:consonance"] → ["schema:anadiplosis"]. ' +
      'A grade or revise under this plan answers for this plan only: it does not show that what ' +
      'the first plan asked was met.'
  );
});

test('the first plan is compared, not the one before; a melody is never printed (#676)', () => {
  const t = fresh();
  const tune = '{"notes":[60,62]}';
  const other = '{"notes":[60,64]}';
  const withTune = (seed, melody, extra = {}) =>
    lineagePlan(seed, { request: { melody: JSON.parse(melody), ...extra } });
  recordCreation(
    t,
    'lyric_sweep',
    { seed_from: 1, count: 1, melody: tune },
    { exit_code: 0, accepted_shown: [1] }
  );
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  recordCreation(
    t,
    'lyric_plan',
    { seed: 1, melody: tune, title: 'Salt and Rain' },
    withTune(1, tune, { title: 'Salt and Rain' })
  );
  // Step 1 drops the title; step 2 changes the tune. Each step alone is one
  // change; against the FIRST plan the second step shows both.
  recordCreation(t, 'lyric_plan', { seed: 1, melody: tune }, withTune(1, tune));
  assert.deepEqual(
    planLineage(t).declared_changes.map((c) => c.field),
    ['title']
  );
  recordCreation(
    t,
    'lyric_sweep',
    { seed_from: 2, count: 1, melody: other },
    { exit_code: 0, accepted_shown: [2] }
  );
  recordCreation(t, 'lyric_plan', { seed: 2, melody: other }, withTune(2, other));
  const lineage = planLineage(t);
  assert.deepEqual(lineage.declared_changes, [
    { field: 'title', first: 'Salt and Rain', now: null },
    { field: 'melody', first: 'declared', now: 'declared (a different melody)' },
  ]);
  assert.equal(lineage.plans_recorded, 3);
  assert.ok(!JSON.stringify(lineage).includes('60'), 'no melody text in the lineage');
});

test('a session saved before the record was kept takes the plan it holds as its first (#676)', () => {
  const t = fresh();
  recordCreation(t, 'lyric_sweep', FIRST.sweep, { exit_code: 0, accepted_shown: [16] });
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  recordCreation(t, 'lyric_plan', FIRST.args, FIRST.receipt());
  delete t.workflow.first_plan; // as an older session was stored
  assert.equal(planLineage(t), null);
  recordCreation(t, 'lyric_sweep', SECOND.sweep, { exit_code: 0, accepted_shown: [21] });
  recordCreation(t, 'lyric_plan', SECOND.args, SECOND.receipt());
  const lineage = planLineage(t);
  assert.equal(lineage.first_plan.seed, 16);
  assert.deepEqual(
    lineage.declared_changes.map((c) => c.field),
    ['form', 'lines', 'relation', 'title']
  );
});
