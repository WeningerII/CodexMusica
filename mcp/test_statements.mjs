// STATE IT OR SAY DRAW (writer plan, stage 3, boxes 3-5). A new-song session
// refuses to plan until the sweep has stated form, length, sections, rhyme and
// time, each as a value (or a `want` on it) or, for all but form, the word
// "draw". The refusal lists what is missing and suggests no value. The plan
// result says how each thing was stated and what the plan holds for it.
//
// Every value here comes from a table or a seed: forms from the planner's
// PLAN_FORMS, lengths from the form's fillable counts, rosters from the
// planner's roster holding what the form requires, relations from the
// eligible types, and want names from the STATEABLE rows. The last tests run
// the real harness (sweeps of one seed and single plans, about a minute).

import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  DEFAULT_FORM,
  DRAWABLE,
  FORM_ROWS,
  LINES_FLOOR,
  NOT_STATEABLE_YET,
  STATEABLE,
  STATEMENT_FIELDS,
  SWEEP_COORDINATES,
  ASK_PERSON,
  creationRefusal,
  nextCreationCall,
  planRefusedNext,
  planStatements,
  recordCreation,
  statementConflict,
  withNextCall,
} from './lyric_workflow.js';
import { _argvInternals, lyricInstructions } from './lyric_tools.js';
import { buildServer } from './tools.js';
import { connectConnector } from './client.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { runTurn, LIMITS, buildSurface } from './gemini_agent.js';
import { stated } from './statement_fixture.mjs';

// ── The planner's own tables, read once ─────────────────────────────────────
const HARNESS = new URL('../lyric-harness/', import.meta.url).pathname;
const P = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      'import json\nfrom quality import plan as P\n' +
        'print(json.dumps({"forms": list(P.PLAN_FORMS), ' +
        '"fillable": {f: sorted(P.fillable_line_counts(f)) for f in P.PLAN_FORMS}, ' +
        '"requires": {f: list(P.FORM_REQUIRES.get(f, ())) for f in P.PLAN_FORMS}, ' +
        '"roster": sorted(P.GENERATOR_ROSTER), "types": list(P.eligible_types()), ' +
        '"beats": list(P.ENVELOPE["beats_per_line"]), ' +
        '"registry": list(P._RL.REGISTRY)}))',
    ],
    { cwd: HARNESS, encoding: 'utf8' }
  )
);

// A seeded draw (mulberry32): the same seed, the same values.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const rosterFor = (r, form) => {
  const extra = P.roster.filter((f) => !P.requires[form].includes(f) && r() < 0.2);
  const fns = [...P.requires[form], ...extra];
  return (fns.length ? fns : [pick(r, P.roster)]).join(',');
};
// A value for one row, drawn by seed from the tables.
const VALUE = {
  form: (r) => pick(r, P.forms),
  lines: (r, form) => pick(r, P.fillable[form]),
  functions: (r, form) => rosterFor(r, form),
  relation: (r) => `schema:${pick(r, P.types)}`,
  melody: (r) => {
    const beats = P.beats[0] + Math.floor(r() * (P.beats[1] - P.beats[0] + 1));
    return JSON.stringify({
      meter: { beats, unit: 4, groups: [beats] },
      bars: 1,
      subdivision: 1,
      notes: [{ pitch_hz: null, ticks: beats }],
    });
  },
};
// A sweep `want` that states the row, from its own `wants` names.
const WANT = (r, row, form) => {
  const name = pick(r, row.wants);
  const at = name.endsWith('.*') ? `${name.slice(0, -1)}${pick(r, P.roster)}` : name;
  if (row.field === 'lines') return `${at}=${VALUE.lines(r, form)}`;
  if (row.field === 'melody') return `${at}<=${P.beats[1]}`;
  return `${at}>=0`;
};
const WAYS = (row) => [
  'value',
  ...(row.wants.length ? ['want'] : []),
  ...(row.draw ? ['draw'] : []),
];
// Sweep arguments stating the rows in `rows`, each in a way the seed picks.
function sweepStating(rows, seed) {
  const r = rng(seed);
  const form = pick(r, P.forms);
  const args = { seed_from: 0, count: 1 };
  const draw = [];
  const want = [];
  for (const row of rows) {
    const way = pick(r, WAYS(row));
    if (way === 'value') args[row.field] = row.field === 'form' ? form : VALUE[row.field](r, form);
    else if (way === 'want') want.push(WANT(r, row, form));
    else draw.push(row.field);
  }
  if (draw.length) args.draw = draw;
  if (want.length) args.want = want;
  return args;
}
const fresh = () => ({ domain: 'lyrics', phase: 'create' });
const DEFAULT_FORM_ROW = FORM_ROWS.find((f) => f.form === DEFAULT_FORM);
const rowName = (r) => (r.thing === r.field ? r.field : `${r.thing} (${r.field})`);
const listed = (xs) =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// The form clause of a refusal, if it has one.
const formClause = (text) => {
  const at = text.indexOf(' takes one name: ');
  return at < 0 ? null : text.slice(at, text.indexOf('. Cannot be stated yet', at));
};

// ── The gate, for every subset of the table ─────────────────────────────────
test('a new-song sweep names exactly what it leaves out, for every subset of STATEABLE, and its NEXT is admitted', () => {
  const subsets = 2 ** STATEABLE.length;
  assert.equal(subsets, 32);
  for (let mask = 0; mask < subsets; mask++)
    for (const seed of [mask, mask + 101, mask + 977]) {
      const given = STATEABLE.filter((_, i) => mask & (1 << i));
      const missing = STATEABLE.filter((_, i) => !(mask & (1 << i)));
      const args = sweepStating(given, seed);
      const task = fresh();
      const refusal = creationRefusal(task, 'lyric_sweep', structuredClone(args));
      const where = `mask ${mask} seed ${seed} ${JSON.stringify(args)}`;
      if (!missing.length) {
        assert.equal(refusal, null, where);
        continue;
      }
      assert.match(refusal, /^CREATION_STATEMENT: /, where);
      // Exactly the missing rows, in table order.
      assert.ok(
        refusal.includes(` leaves out ${listed(missing.map(rowName))}. Nothing ran.`),
        `${where}: ${refusal}`
      );
      // The form rows, only when form is missing; each rebuilt from its data.
      const clause = formClause(refusal);
      const formMissing = missing.some((r) => !r.draw);
      assert.equal(clause !== null, formMissing, `${where}: ${refusal}`);
      if (clause)
        for (const f of FORM_ROWS) {
          const at = clause.indexOf(`${f.form}, which requires `);
          assert.ok(at >= 0, `${f.form}: ${clause}`);
          const own = clause.slice(at).split(';')[0];
          for (const fn of f.requires) assert.ok(own.includes(fn), own);
          for (const fn of f.recurs) assert.ok(own.includes(`${fn} at least twice`), own);
          assert.equal(own.includes(`at least ${f.min_lines} lines`), f.min_lines > LINES_FLOOR);
          assert.equal(
            own.endsWith('requires nothing'),
            !f.requires.length && !f.recurs.length && f.min_lines <= LINES_FLOOR,
            own
          );
        }
      // It ends with what cannot be stated yet.
      const tail = refusal.slice(refusal.lastIndexOf('Cannot be stated yet'));
      for (const r of NOT_STATEABLE_YET) assert.ok(tail.includes(`${r.thing} (${r.what})`), tail);
      assert.ok(tail.endsWith('.'), tail);
      // It suggests no value: outside the form rows, no number, and no
      // roster function, relation type or form name.
      const rest = clause ? refusal.replace(clause, '') : refusal;
      assert.doesNotMatch(rest, /\d/, rest);
      for (const word of [...P.roster, ...P.types, ...P.forms])
        assert.ok(!rest.includes(` ${word} `) && !rest.includes(` ${word},`), `${word}: ${rest}`);
      // NEXT names the sweep and the fields it leaves out; followed, it is admitted.
      const text = withNextCall(refusal, task, null, 'lyric_sweep', args);
      const m = /NEXT: lyric_sweep stating (.*?), (?:each )?as /.exec(text);
      assert.ok(m, text);
      assert.equal(m[1], listed(missing.map((r) => r.field)), text);
      const next = sweepStating(missing, seed + 1);
      const followed = {
        ...args,
        ...next,
        draw: [...(args.draw || []), ...(next.draw || [])],
        want: [...(args.want || []), ...(next.want || [])],
      };
      assert.equal(
        creationRefusal(fresh(), 'lyric_sweep', followed),
        null,
        JSON.stringify(followed)
      );
    }
});

test('a value and a draw for one field are refused on the sweep and the plan, and NEXT names the fix', () => {
  for (const [i, field] of DRAWABLE.entries()) {
    const r = rng(500 + i);
    const form = pick(r, P.forms);
    const complete = stated({ form }, i);
    const args = { ...complete, [field]: VALUE[field](r, form) };
    assert.ok(args.draw.includes(field));
    const task = fresh();
    const refusal = creationRefusal(task, 'lyric_sweep', structuredClone(args));
    assert.equal(refusal, statementConflict([field]));
    const text = withNextCall(refusal, task, null, 'lyric_sweep', args);
    assert.ok(
      text.endsWith(
        `NEXT: lyric_sweep with ${field} as a value or in \`draw\`, not both; ` +
          "the plan repeats the sweep's form, lines, functions, relation, melody and `want`."
      ),
      text
    );
    // Followed: the draw dropped for that field.
    const followed = { ...args, draw: args.draw.filter((f) => f !== field) };
    assert.equal(creationRefusal(fresh(), 'lyric_sweep', followed), null);
    // The plan: the same conflict, before anything is compared with a sweep.
    const swept = fresh();
    recordCreation(swept, 'lyric_sweep', complete, { exit_code: 0, accepted_shown: [3] });
    assert.equal(
      creationRefusal(swept, 'lyric_plan', { seed: 3, [field]: args[field], draw: [field] }),
      statementConflict([field])
    );
  }
  // Repeats in `draw` are read once.
  assert.equal(
    creationRefusal(fresh(), 'lyric_sweep', { form: P.forms[0], draw: [...DRAWABLE, ...DRAWABLE] }),
    null
  );
});

test('a second sweep refused for what it leaves out names that sweep again, not the earlier plan', () => {
  const task = fresh();
  recordCreation(task, 'lyric_sweep', stated({ seed_from: 0, count: 1 }), {
    exit_code: 0,
    accepted_shown: [0],
  });
  const second = { seed_from: 1, count: 1, form: P.forms[0] };
  const refusal = creationRefusal(task, 'lyric_sweep', structuredClone(second));
  assert.match(refusal, /^CREATION_STATEMENT: /);
  const next = nextCreationCall(task, null, 'lyric_sweep', second);
  assert.equal(next.tool, 'lyric_sweep');
  assert.deepEqual(
    next.missing.map((r) => r.field),
    DRAWABLE
  );
  assert.match(
    withNextCall(refusal, task, null, 'lyric_sweep', second),
    / NEXT: lyric_sweep stating /
  );
  // Without the refused call's arguments, the earlier sweep's plan.
  assert.equal(nextCreationCall(task, null, 'lyric_plan').tool, 'lyric_plan');
});

test("the plan takes the sweep's form and draw; a sweep saved before this rule keeps its NEXT and plan", () => {
  // A form stated on the sweep is the plan's even when the plan leaves it out.
  for (const [i, f] of FORM_ROWS.entries()) {
    const task = fresh();
    const sweep = stated({ seed_from: 0, count: 1, form: f.form }, i);
    recordCreation(task, 'lyric_sweep', sweep, { exit_code: 0, accepted_shown: [7] });
    // Every form, not only the default: the gate restores the sweep's form.
    const plan = { seed: 7 };
    assert.equal(creationRefusal(task, 'lyric_plan', plan), null, f.form);
    assert.equal(plan.form, f.form);
    assert.deepEqual(plan.draw, sweep.draw);
    assert.equal(planStatements(plan, { request: { form: f.form } }).rows[0].said, 'value');
    const named = { seed: 7, form: f.form };
    assert.equal(creationRefusal(task, 'lyric_plan', named), null);
    assert.deepEqual(named.draw, sweep.draw);
  }
  // Two sweeps accept the seed under different forms: the newest is the plan's.
  {
    const task = fresh();
    for (const f of FORM_ROWS)
      recordCreation(task, 'lyric_sweep', stated({ seed_from: 0, count: 1, form: f.form }), {
        exit_code: 0,
        accepted_shown: [7],
      });
    const plan = { seed: 7 };
    assert.equal(creationRefusal(task, 'lyric_plan', plan), null);
    assert.equal(plan.form, FORM_ROWS[FORM_ROWS.length - 1].form);
  }
  // Saved before the rule: a sweep recorded with no form, relation or draw.
  const task = fresh();
  const old = { seed_from: 10, count: 10, want: ['lines<=30'] };
  recordCreation(task, 'lyric_sweep', old, { exit_code: 0, accepted_shown: [16] });
  assert.deepEqual(nextCreationCall(task, null, 'lyric_plan'), {
    tool: 'lyric_plan',
    args: { seed: 16, wants: ['lines<=30'] },
    melody: false,
  });
  const plan = { seed: 16, wants: ['lines<=30'] };
  assert.equal(creationRefusal(task, 'lyric_plan', plan), null);
  assert.equal(plan.draw, undefined, 'nothing was drawn by that sweep');
  // Its plan result says what it did not state.
  const rows = planStatements(plan, { request: { form: FORM_ROWS[0].form } }).rows;
  assert.deepEqual(
    rows.map((r) => [r.field, r.said]),
    [
      ['form', 'default'],
      ['lines', 'want'],
      ['functions', 'unsaid'],
      ['relation', 'unsaid'],
      ['melody', 'unsaid'],
    ]
  );
  // `draw` never reaches the planner: the CLI arguments are the same.
  const argv = _argvInternals.planArgs;
  assert.deepEqual(argv({ seed: 3 }), argv({ seed: 3, draw: [...DRAWABLE] }));
  assert.deepEqual(
    STATEMENT_FIELDS,
    STATEABLE.map((r) => r.field)
  );
});

// ── What the sweep drew is the plan's record, whatever the plan sends ────────
test("a plan's own `draw` does not rewrite what its sweep drew", () => {
  for (let seed = 0; seed < 6; seed++) {
    const r = rng(300 + seed);
    const form = pick(r, P.forms);
    const lines = VALUE.lines(r, form);
    const sweep = {
      seed_from: 0,
      count: 1,
      form,
      lines,
      draw: DRAWABLE.filter((f) => f !== 'lines'),
    };
    const task = fresh();
    recordCreation(task, 'lyric_sweep', sweep, { exit_code: 0, accepted_shown: [3] });
    const sent = [[], DRAWABLE.filter((f) => f !== 'lines' && r() < 0.5), undefined];
    for (const draw of sent) {
      const plan = { seed: 3, form, lines, ...(draw ? { draw } : {}) };
      assert.equal(creationRefusal(task, 'lyric_plan', plan), null, JSON.stringify(draw));
      assert.deepEqual(plan.draw, sweep.draw, JSON.stringify(draw));
      assert.deepEqual(
        planStatements(plan, { request: { form } }).rows.map((x) => x.said),
        STATEABLE.map((x) => (x.field === 'form' || x.field === 'lines' ? 'value' : 'draw'))
      );
    }
  }
  // A sweep that drew nothing: a plan's `draw` is dropped, not recorded.
  const task = fresh();
  const r = rng(99);
  const form = pick(r, P.forms);
  const all = Object.fromEntries(STATEABLE.map((x) => [x.field, VALUE[x.field](r, form)]));
  all.form = form;
  recordCreation(
    task,
    'lyric_sweep',
    { seed_from: 0, count: 1, ...all },
    {
      exit_code: 0,
      accepted_shown: [5],
    }
  );
  const plan = { seed: 5, ...all, draw: [] };
  assert.equal(creationRefusal(task, 'lyric_plan', plan), null);
  assert.equal(plan.draw, undefined);
});

// ── A sweep saved before `relation` was a coordinate does not bind it ────────
test('a sweep that states no relation (saved before the rule) admits a plan that declares one', () => {
  for (let seed = 0; seed < 4; seed++) {
    const r = rng(400 + seed);
    const lines = VALUE.lines(r, DEFAULT_FORM_ROW.form);
    const relation = VALUE.relation(r);
    const task = fresh();
    recordCreation(
      task,
      'lyric_sweep',
      { seed_from: 10, count: 10, lines },
      {
        exit_code: 0,
        accepted_shown: [16],
      }
    );
    assert.equal(creationRefusal(task, 'lyric_plan', { seed: 16, lines, relation }), null);
    // A sweep that DREW the relation binds the plan to the draw.
    const drew = fresh();
    recordCreation(drew, 'lyric_sweep', stated({ seed_from: 10, count: 10, lines }), {
      exit_code: 0,
      accepted_shown: [16],
    });
    const refusal = creationRefusal(drew, 'lyric_plan', { seed: 16, lines, relation });
    assert.match(refusal, /^CREATION_PLAN: .*this call differs in relation/);
  }
});

// ── The relation as the planner spells it ──────────────────────────────────
const VOCAB = JSON.parse(
  execFileSync(
    'python3',
    [
      '-c',
      'import json\nfrom quality import rhyme_types as R\nfrom quality import schemes as S\n' +
        'v = R.namespaced_vocabulary()\n' +
        'def planned(x):\n' +
        '    try: return S.mandate("AA", n_lines=2, default_relation=x).default_relation\n' +
        '    except Exception: return None\n' +
        'bare = [n for n in v["type"] if planned(n)]\n' +
        'print(json.dumps({"ns": {k: list(x) for k, x in v.items()}, ' +
        '"bare": {n: planned(n) for n in bare}}))',
    ],
    { cwd: HARNESS, encoding: 'utf8' }
  )
);
// A spelling the planner rewrites: case and outer spaces changed by seed.
const respell = (r, text) =>
  [...text]
    .map((c) => (r() < 0.5 ? c.toUpperCase() : c.toLowerCase()))
    .join('')
    .replace(':', r() < 0.5 ? ' : ' : ':');
// A plan verdict the session records: the planner's request for these args,
// its relation spelled as the planner spells it.
const { createHash } = await import('node:crypto');
function planVerdict(args, relation) {
  const request = {
    seed: args.seed,
    form: args.form,
    lines: args.lines ?? null,
    relation,
    group_types: null,
    functions: null,
    title: null,
    narrative: null,
    melody: null,
    wants: [],
  };
  const plan = {
    plan_version: 3,
    request,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{}],
  };
  const sha = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { exit_code: 0, plan, plan_sha256: sha, plan_request: structuredClone(request) };
}

test('a plan records when the planner respells the relation the sweep and plan sent', () => {
  // No namespace holds two names that differ only in case (relationKey's ground).
  for (const [ns, names] of Object.entries(VOCAB.ns))
    assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, ns);
  const cases = [];
  for (let seed = 0; seed < 8; seed++) {
    const r = rng(500 + seed);
    const ns = pick(r, Object.keys(VOCAB.ns));
    const name = pick(r, VOCAB.ns[ns]);
    cases.push([respell(r, ` ${ns}:${name} `), `${ns}:${name}`]);
  }
  for (const [n, planned] of Object.entries(VOCAB.bare).slice(0, 4)) cases.push([n, planned]);
  for (const [sent, planned] of cases) {
    const task = fresh();
    const sweep = stated({ seed_from: 0, count: 1, form: DEFAULT_FORM_ROW.form, relation: sent });
    recordCreation(task, 'lyric_sweep', sweep, { exit_code: 0, accepted_shown: [0] });
    const next = nextCreationCall(task, null, 'lyric_plan');
    const plan = { ...next.args };
    assert.equal(creationRefusal(task, 'lyric_plan', plan), null, sent);
    recordCreation(task, 'lyric_plan', plan, planVerdict(plan, planned));
    assert.ok(
      task.workflow.plan,
      `${JSON.stringify(sent)} -> ${planned}: the plan was not recorded`
    );
    // The screen follows the recorded plan.
    assert.equal(creationRefusal(task, 'lyric_screen', { words: [] }), null);
    // A plan sent in the planner's own namespaced spelling matches the sweep
    // when the sweep named the namespace too.
    if (sent.includes(':'))
      assert.equal(creationRefusal(task, 'lyric_plan', { ...plan, relation: planned }), null);
  }
});

test('the texts that list what a plan repeats from its sweep are read from SWEEP_COORDINATES', async () => {
  const { client, close } = await rawClient();
  const TOOL_DESCRIPTIONS = Object.fromEntries(
    (await client.listTools()).tools.map((t) => [
      t.name,
      t.inputSchema.properties.draw?.description,
    ])
  );
  await close();
  const instructions = lyricInstructions();
  const clause = instructions.slice(
    instructions.indexOf("lyric_plan with an accepted seed and the sweep's")
  );
  for (const k of SWEEP_COORDINATES) {
    assert.match(clause.slice(0, 120), new RegExp(`\\b${k}\\b`), `lyricInstructions: ${k}`);
    assert.match(planRefusedNext('request'), new RegExp(`\\b${k}\\b`), `planRefusedNext: ${k}`);
  }
  // The `draw` description claims a `want` only for the rows that have one.
  for (const name of ['lyric_sweep', 'lyric_plan']) {
    const d = TOOL_DESCRIPTIONS[name];
    const wants = /a `want` \(([^)]*)\)/.exec(d)[1];
    for (const row of STATEABLE)
      assert.equal(
        new RegExp(`for ${row.field}\\b`).test(wants),
        row.wants.length > 0,
        `${name}: ${row.field}`
      );
  }
});

// ── The raw engine: a conflict refuses, nothing is required ─────────────────
test(
  'the raw engine refuses a value with a draw and requires nothing',
  { timeout: 120_000 },
  async () => {
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 'raw-statements', version: '1' }, { capabilities: {} });
    await client.connect(b);
    try {
      const lines = P.fillable[P.forms[0]][0];
      for (const [name, args] of [
        ['lyric_sweep', { seed_from: 0, count: 1, lines, draw: ['lines'] }],
        ['lyric_plan', { seed: 0, lines, draw: ['lines'] }],
      ]) {
        const r = await client.callTool({ name, arguments: args });
        assert.equal(r.isError, true, name);
        assert.match(
          r.content[0].text,
          /STATEMENT_CONFLICT: lines has a value and is also named in `draw`/
        );
      }
      const r = await client.callTool({
        name: 'lyric_sweep',
        arguments: { seed_from: 0, count: 1 },
      });
      assert.notEqual(r.isError, true, JSON.stringify(r).slice(0, 400));
      assert.ok(Number.isInteger(JSON.parse(r.content[0].text).exit_code));
    } finally {
      await client.close();
      await server.close();
    }
  }
);

// ── Real plans: the record against the plan's own fields ───────────────────
async function rawClient() {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'raw-plan', version: '1' }, { capabilities: {} });
  await client.connect(b);
  return { client, close: async () => (await client.close(), await server.close()) };
}
const planOf = async (client, args) => {
  const r = await client.callTool({ name: 'lyric_plan', arguments: args });
  assert.notEqual(r.isError, true, JSON.stringify(r).slice(0, 600));
  assert.equal(r.content.length, 2, `${JSON.stringify(args)}: ${r.content[0].text.slice(0, 600)}`);
  const v = JSON.parse(r.content[1].text);
  assert.equal(v.exit_code, 0, JSON.stringify(v).slice(0, 600));
  return v;
};
const own = (plan) => ({
  form: plan.request.form,
  lines: plan.total_lines,
  functions: {
    functions: [...new Set(plan.choices.pattern.functions)],
    sections: plan.choices.pattern.functions.length,
  },
  relation: {
    types: [...new Set(plan.choices.relations.groups.map((g) => g.type))],
    groups: plan.choices.relations.groups.length,
  },
  melody: {
    meter: plan.choices.meter.value,
    beats_per_line: plan.choices.meter.beats_per_line,
    bars_per_line: plan.choices.bars_per_line,
    subdivision: plan.choices.subdivision,
  },
});

test(
  "the plan result's statements hold the plan's own values, said as value, want or draw, and a draw changes no plan byte",
  { timeout: 240_000 },
  async () => {
    const { client, close } = await rawClient();
    try {
      const form = FORM_ROWS[0].form;
      // Values drawn by seed; a seed whose roster the planner cannot build is
      // passed over for the next (the planner's refusal, not this test's).
      let valued = null;
      for (let k = 0; !valued; k++) {
        assert.ok(k < 40, 'no seed in 40 drew a roster the planner builds');
        const r = rng(41 + k);
        const args = {
          seed: 5,
          form,
          lines: pick(
            r,
            P.fillable[form].filter((n) => n <= 24)
          ),
          functions: rosterFor(r, form),
          relation: `schema:${pick(r, P.types)}`,
        };
        const res = await client.callTool({ name: 'lyric_plan', arguments: args });
        if (res.content.length === 2) valued = args;
      }
      const lines = valued.lines;
      for (const [said, args] of [
        ['value', valued],
        [
          'want',
          {
            seed: 5,
            form,
            wants: [`lines<=${lines + 20}`, 'sections>=1', `beats_per_line<=${P.beats[1]}`],
          },
        ],
        ['draw', { seed: 5, form, draw: [...DRAWABLE] }],
      ]) {
        const v = await planOf(client, args);
        const values = own(v.plan);
        assert.equal(v.statements.version, 1);
        assert.deepEqual(
          v.statements.not_stateable,
          NOT_STATEABLE_YET.map((x) => ({ ...x }))
        );
        for (const row of v.statements.rows) {
          assert.deepEqual(row.value, values[row.field], `${said} ${row.field}`);
          const expected =
            row.field === 'form'
              ? 'value'
              : said === 'value' && row.field === 'melody'
                ? 'unsaid'
                : said === 'want' && row.field === 'relation'
                  ? 'unsaid'
                  : said;
          assert.equal(row.said, expected, `${said} ${row.field}`);
        }
      }
      // A draw is what an omitted field already is: the same plan, byte for byte.
      const drawn = await planOf(client, { seed: 9, form, draw: [...DRAWABLE] });
      const plain = await planOf(client, { seed: 9 });
      assert.equal(drawn.plan_sha256, plain.plan_sha256);
      assert.deepEqual(
        plain.statements.rows.map((x) => x.said),
        ['default', 'unsaid', 'unsaid', 'unsaid', 'unsaid']
      );
    } finally {
      await close();
    }
  }
);

// ── Every surface, through the real gate ─────────────────────────────────────
const missingArgs = { seed_from: 3, count: 1 };
const completeArgs = stated({ seed_from: 3, count: 1 });

test(
  'the SDK client refuses an unstated sweep before dispatch, and plans and records a stated one',
  { timeout: 240_000 },
  async () => {
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    let dispatched = 0;
    const realCall = Client.prototype.callTool;
    const c = await connectConnector({ task: 'lyrics', transport: b });
    try {
      Client.prototype.callTool = function (...xs) {
        dispatched++;
        return realCall.apply(this, xs);
      };
      await assert.rejects(c.call('lyric_sweep', missingArgs), (e) => {
        assert.equal(e.beforeDispatch, true);
        assert.match(e.message, /^CREATION_STATEMENT: .* NEXT: lyric_sweep stating /s);
        assert.ok(e.message.includes(ASK_PERSON), 'the refusal says to ask the person');
        return true;
      });
      assert.equal(dispatched, 0, 'nothing was dispatched');
      const swept = await c.call('lyric_sweep', completeArgs);
      assert.equal(dispatched, 1);
      const seed = JSON.parse(swept.content[0].text).accepted_shown[0];
      const planned = await c.call('lyric_plan', { seed });
      const v = JSON.parse(planned.content[1].text);
      assert.equal(v.exit_code, 0);
      assert.equal(c.snapshot().task.workflow.plan.sha256, v.plan_sha256, 'the plan is recorded');
      assert.deepEqual(
        v.statements.rows.map((x) => x.said),
        ['value', 'draw', 'draw', 'draw', 'draw']
      );
    } finally {
      Client.prototype.callTool = realCall;
      await c.close();
      await server.close();
    }
  }
);

// RHYME IS SAID PER GROUP. A sweep that drew the rhyme, then a plan that
// declares one group's type: the plan's own record says which groups were
// declared, and the statements row says the same.
test(
  "after a drawn-rhyme sweep, a plan with group_types records each group's rhyme as the plan chose it",
  { timeout: 240_000 },
  async () => {
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = await connectConnector({ task: 'lyrics', transport: b });
    try {
      const sweep = stated({ seed_from: 3, count: 1 });
      assert.ok(statementsOfDraw(sweep).includes('relation'), 'the sweep draws the rhyme');
      const swept = await c.call('lyric_sweep', sweep);
      const seed = JSON.parse(swept.content[0].text).accepted_shown[0];
      const first = JSON.parse((await c.call('lyric_plan', { seed })).content[1].text);
      const groups = first.plan.choices.relations.groups;
      // One group, picked by seed, declared with the type the plan drew for it.
      const start = Math.floor(rng(seed)() * groups.length);
      const order = groups.map((_, i) => (start + i) % groups.length);
      let v = null;
      for (const i of order) {
        const group_types = [{ group: i + 1, type: P.registry.indexOf(groups[i].type) }];
        const res = await c.call('lyric_plan', { seed, group_types });
        if (res.content.length !== 2) continue;
        v = JSON.parse(res.content[1].text);
        if (v.exit_code === 0) break;
        v = null;
      }
      assert.ok(v, 'one group declared by its drawn type plans');
      const own = v.plan.choices.relations.groups;
      const declared = own.filter((g) => g.chosen_from === 'declared').map((g) => g.group);
      assert.ok(declared.length >= 1, 'the plan records a declared group');
      const row = v.statements.rows.find((x) => x.field === 'relation');
      assert.equal(row.said, declared.length === own.length ? 'value' : 'mixed');
      assert.deepEqual(row.declared_groups, declared);
      // The plan with no group_types said the rhyme the way its sweep did.
      const plain = first.statements.rows.find((x) => x.field === 'relation');
      assert.equal(plain.said, 'draw');
      assert.equal(Object.hasOwn(plain, 'declared_groups'), false);
    } finally {
      await c.close();
      await server.close();
    }
  }
);
const statementsOfDraw = (args) => (Array.isArray(args.draw) ? args.draw : []);

test(
  'through the SDK client and the real planner, a relation the planner respells records the plan its NEXT names',
  { timeout: 240_000 },
  async () => {
    const server = buildServer({ task: { domain: 'lyrics' } });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = await connectConnector({ task: 'lyrics', transport: b });
    try {
      const r = rng(77);
      const name = pick(r, VOCAB.ns.class);
      let relation = respell(r, `class:${name}`);
      if (relation === `class:${name}`) relation = ` ${relation}`;
      const sweep = stated({ seed_from: 0, count: 2, form: DEFAULT_FORM_ROW.form, relation });
      const swept = await c.call('lyric_sweep', sweep);
      const accepted = JSON.parse(swept.content[0].text).accepted_shown;
      assert.ok(accepted.length, 'the sweep accepted a seed');
      const next = nextCreationCall(c.snapshot().task, null, 'lyric_plan');
      assert.equal(next.args.relation, relation, 'NEXT names the sweep spelling');
      const planned = await c.call('lyric_plan', next.args);
      const v = JSON.parse(planned.content[1].text);
      assert.equal(v.exit_code, 0);
      assert.equal(v.plan_request.relation, `class:${name}`, 'the planner respelled it');
      assert.equal(c.snapshot().task.workflow.plan?.sha256, v.plan_sha256, 'the plan is recorded');
      // The planner's own spelling is admitted too, and records.
      const again = await c.call('lyric_plan', { ...next.args, relation: `class:${name}` });
      assert.equal(JSON.parse(again.content[1].text).exit_code, 0);
      assert.ok(c.snapshot().task.workflow.plan, 'the second plan is recorded');
    } finally {
      await c.close();
      await server.close();
    }
  }
);

for (const [surfaceName, build] of [
  ['/mcp', (sessions) => buildWorkflowServer({ sessions, compatibility: true })],
  ['/mcp/chatgpt', (sessions) => buildWorkflowServer({ domain: 'lyrics', sessions })],
])
  test(
    `${surfaceName}: an unstated sweep is the person's decision with the rows as data; a stated one plans, records and shows its statements`,
    { timeout: 300_000 },
    async (t) => {
      const directory = mkdtempSync(join(tmpdir(), 'statements-'));
      t.after(() => rmSync(directory, { recursive: true, force: true }));
      const sessions = new WorkflowSessions({ store: new JobStore(directory) });
      const server = await build(sessions);
      const client = new Client({ name: 'statements', version: '1' }, { capabilities: {} });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(a), client.connect(b)]);
      t.after(async () => {
        await client.close();
        await server.close();
      });
      const send = async (name, args) => {
        const r = await client.callTool({ name, arguments: args });
        const q = r.structuredContent;
        assert.ok(q, JSON.stringify(r).slice(0, 400));
        if (q.status !== 'pending') return q;
        await sessions.wait(q.operation_id);
        return (
          await client.callTool({
            name: 'get_operation',
            arguments: { operation_id: q.operation_id },
          })
        ).structuredContent;
      };
      const open = await send('begin_lyrics', {});
      const refused = await send('lyric_sweep', { session_id: open.session_id, ...missingArgs });
      assert.equal(refused.tool_error, true);
      assert.match(refused.tool_result.content[0].text, /^CREATION_STATEMENT: /);
      assert.ok(
        refused.tool_result.content[0].text.includes(ASK_PERSON),
        'the refusal says to ask the person'
      );
      assert.deepEqual(refused.outcome, {
        kind: 'decision',
        by: 'person',
        call: { tool: 'lyric_sweep', args: {} },
        missing: STATEABLE.map(({ thing, field, draw }) => ({ thing, field, draw })),
      });
      // Nothing ran: the session holds no sweep.
      const held = sessions.record(refused.session_id, 'lyrics').session.native.task;
      assert.equal(held.workflow?.sweeps?.length ?? 0, 0);
      // The outcome followed, with the rows it lists stated: admitted.
      const followed = stated({ ...missingArgs, ...refused.outcome.call.args }, 0);
      const swept = await send('lyric_sweep', { session_id: refused.session_id, ...followed });
      assert.notEqual(swept.tool_error, true, JSON.stringify(swept).slice(0, 600));
      const seed = verdictOf(swept.tool_result).accepted_shown[0];
      const planned = await send('lyric_plan', { session_id: swept.session_id, seed });
      assert.notEqual(planned.tool_error, true, JSON.stringify(planned).slice(0, 600));
      const short = verdictOf(planned.tool_result);
      assert.equal(Object.hasOwn(short, 'plan'), false, 'the short view');
      assert.deepEqual(
        short.statements.rows.map((x) => [x.field, x.said]),
        STATEABLE.map((r) => [r.field, r.draw ? 'draw' : 'value'])
      );
      const kept = sessions.record(planned.session_id, 'lyrics').session.native.task;
      assert.equal(kept.workflow.plan.sha256, short.plan_sha256, 'the plan is recorded');
    }
  );

// THE PERSON CHOOSES. On the website chat an unstated sweep is refused with
// what it leaves out and the instruction to ask the person; the model reads
// the same rule in its own system prompt. A model that asks ends the turn
// with nothing run or recorded. The person's answer, sent as said, reaches
// the sweep and the plan unchanged, and nothing the person did not say is
// filled in.
test(
  'the website chat: an unstated sweep is refused, the model asks the person and nothing runs; their stated choices reach the sweep and the plan',
  { timeout: 300_000 },
  async () => {
    const server = buildServer({ task: { domain: 'lyrics' }, kitchen: true });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 'chat-statements', version: '1' }, { capabilities: {} });
    await client.connect(b);
    const nativeFetch = globalThis.fetch;
    const reply = (parts) => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, thoughtsTokenCount: 0 },
      }),
    });
    const fc = (name, args) => ({ functionCall: { name, args } });
    const responses = (init) =>
      JSON.parse(init.body)
        .contents.at(-1)
        .parts.map((p) => p.functionResponse)
        .filter(Boolean);
    const surface = await buildSurface(client);
    // What the person says, drawn by seed from the planner's tables: a form
    // and a length, and a draw for the rest.
    const r = rng(29);
    const form = pick(r, P.forms);
    const lines = pick(
      r,
      P.fillable[form].filter((n) => n <= 24)
    );
    const choices = { form, lines, draw: DRAWABLE.filter((f) => f !== 'lines') };
    let dispatched = [];
    let seen = [];
    let prompts = [];
    let script = [];
    let step = 0;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      prompts.push(body.systemInstruction?.parts?.[0]?.text ?? '');
      if (step > 0) seen.push(...responses(init).map((x) => x.response));
      return reply(script[step++](seen));
    };
    const turn = (task, userText) =>
      runTurn({
        apiKey: 'offline',
        surface,
        userText,
        limits: { ...LIMITS, maxSteps: 6, maxTurnMs: 240_000, maxTurnUsd: 0 },
        task,
        callTool: (n, args) => {
          dispatched.push([n, structuredClone(args)]);
          return client.callTool({ name: n, arguments: args });
        },
      });
    try {
      // Turn 1: the person states nothing. The model sweeps without choices,
      // is refused, and asks the person.
      script = [
        () => [fc('lyric_sweep', missingArgs)],
        () => [{ text: 'Which form, length, sections, rhyme and time do you want?' }],
        () => [{ text: 'unused' }],
      ];
      const asked = await turn(fresh(), 'A new song.');
      assert.equal(step, 2, 'the turn ended on the question');
      assert.match(seen[0].error, /^CREATION_STATEMENT: .* NEXT: lyric_sweep stating /s);
      assert.ok(seen[0].error.includes(ASK_PERSON), seen[0].error);
      assert.ok(prompts[0].includes("are the person's to choose"), 'the system prompt says so');
      assert.ok(prompts[0].includes(STATEABLE.map((x) => x.thing).at(-1)), prompts[0]);
      assert.deepEqual(dispatched, [], 'nothing ran');
      assert.deepEqual(asked.task.workflow?.sweeps ?? [], [], 'no sweep is recorded');
      assert.equal(asked.task.workflow?.plan ?? null, null, 'no plan');
      // Turn 2: the person answers. The model sends their choices as said.
      dispatched = [];
      seen = [];
      prompts = [];
      step = 0;
      script = [
        () => [fc('lyric_sweep', { seed_from: 3, count: 1, ...choices })],
        (got) => [fc('lyric_plan', { seed: got.at(-1).accepted_shown[0], form, lines })],
        () => [{ text: 'done' }],
      ];
      const said = `${form}, ${lines} lines, and draw the rest.`;
      const out = await turn(asked.task, said);
      assert.deepEqual(
        dispatched.map(([n]) => n),
        ['lyric_sweep', 'lyric_plan']
      );
      const sweep = dispatched[0][1];
      for (const k of ['form', 'lines']) assert.equal(sweep[k], choices[k], k);
      assert.deepEqual(sweep.draw, choices.draw);
      const recorded = out.task.workflow.sweeps.at(-1).args;
      for (const k of ['form', 'lines']) assert.equal(recorded[k], choices[k], `recorded ${k}`);
      for (const k of ['functions', 'relation', 'melody'])
        assert.equal(recorded[k], undefined, `nothing filled in for ${k}`);
      const v = seen.at(-1).verdict;
      assert.equal(v.plan_request.form, form, 'the plan has the form the person chose');
      assert.ok(out.task.workflow.plan?.sha256, 'the plan is recorded');
      assert.deepEqual(
        v.statements.rows.map((x) => [x.field, x.said]),
        STATEABLE.map((x) => [x.field, ['form', 'lines'].includes(x.field) ? 'value' : 'draw'])
      );
      assert.equal(v.statements.rows.find((x) => x.field === 'lines').value, lines);
    } finally {
      globalThis.fetch = nativeFetch;
      await client.close();
      await server.close();
    }
  }
);
