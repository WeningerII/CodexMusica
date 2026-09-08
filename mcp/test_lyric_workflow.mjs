import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { creationRefusal, recordCreation, creationQualified } from './lyric_workflow.js';
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
    form: 'verse-chorus',
    lines: null,
    relation: '',
    functions: null,
    title: '',
    narrative: false,
    wants: ['lines<=30'],
    inspection_only: false,
  };
  const plan = {
    plan_version: 3,
    request,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{ name: 'VERSE' }],
    execution_limits: { max_lines: 31, admitted: true },
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
    { ...planArgs, inspection_only: true },
  ])
    assert.match(creationRefusal(t, 'lyric_plan', args), /CREATION_PLAN/);
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
    (p) => {
      p.plan.execution_limits.admitted = false;
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
