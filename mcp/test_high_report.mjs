import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import {
  _workerInternals,
  _verdictInternals,
  RUNS,
  PLAN_FORMS,
  TYPE_POSITIONS,
  LYRIC_TOOL_SCHEMAS,
  KITCHEN_REVISE_SCHEMA,
} from './lyric_tools.js';
import { PLAN_FIELDS, READING_FIELDS } from './lyric_workflow.js';
import { runRefusal } from './run_store.js';
import { declarationsFor } from './gemini_agent.js';
import { toGeminiDeclarations } from './gemini_tools.js';

const HARNESS = new URL('../lyric-harness/', import.meta.url).pathname;

async function connect(options) {
  const server = buildServer(options);
  const client = new Client(
    { name: 'high-report-regressions', version: '1' },
    { capabilities: {} }
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  return { server, client };
}

function verdictIn(response) {
  return response.content
    .map((block) => {
      try {
        return JSON.parse(block.text);
      } catch {
        return null;
      }
    })
    .find((value) => typeof value?.exit_code === 'number');
}

function caller(client) {
  return async function call(name, args) {
    const response = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 120000,
    });
    assert.ok(!response.isError, JSON.stringify(response));
    const result = verdictIn(response);
    assert.ok(result, JSON.stringify(response));
    assert.notEqual(result.exit_code, 1, JSON.stringify(result));
    return result;
  };
}

test('real MCP preserves draft coordinates and uses the placed-return judge', async () => {
  const { server, client } = await connect({ task: { domain: 'lyrics' } });
  const call = caller(client);
  try {
    const lines = [
      '#1 with a bullet and a song',
      'The day is long',
      '[Chorus] we sing along',
      '--- and the morning too',
    ];
    const checked = await call('lyric_check', {
      lines,
      groups: '1,4',
      relation: 'class:ASSONANCE',
    });
    assert.deepEqual(checked.final_draft, lines);
    const verified = await call('lyric_verify', {
      before: lines,
      after: lines,
      groups: '1,4',
      relation: 'class:ASSONANCE',
    });
    assert.doesNotMatch(verified.report, /outside 1\.\.3|outside 1\.\.1/);
    // lyric_recover reads a paste AS PRINTED (its [SECTION] rows are
    // structure), so the rows the source reader treats as apparatus are not
    // counted — and none disappears silently: each is listed in set_aside,
    // and `lines` says exactly which lines the recovered mandate numbers.
    // This pinned 4 counted lines while recover read literally, which is
    // the reading that counted [Verse] marks as sung lines.
    const recovered = await call('lyric_recover', { lines, placements: 'head' });
    assert.match(recovered.report, /total_lines\s+\[counted\] 1/);
    assert.deepEqual(recovered.lines, ['The day is long']);
    assert.deepEqual(
      recovered.set_aside.map((row) => row.row),
      [1, 3, 4]
    );
    const placed = await call('lyric_check', {
      lines: [
        'The basket rests beside the open gate',
        'A farmer waits beneath the fading light',
        'The children bring their apples home at night',
      ],
      groups: '1,2',
      relation: 'class:ASSONANCE',
      returns: '1.head,3.head',
    });
    assert.doesNotMatch(placed.report, /RETURN_NOT_VERBATIM/);
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
});

// The lyric_plan `lines` ceiling, as published in the tool schema.
const PUBLISHED_MAX_LINES = () => LYRIC_TOOL_SCHEMAS.lyric_plan.lines.unwrap().maxValue;
// ── The connector audit's lyric findings, each held by a check ─────────────

// The published text states numbers and enumerates vocabularies the harness
// owns; each is compared with the harness itself, so a moved value fails here
// rather than leaving the text stale.
test('published capacities and vocabularies match the harness they describe', () => {
  const read = JSON.parse(
    execFileSync(
      'python3',
      [
        '-c',
        'import json\n' +
          'from quality import plan, rhyme_types\n' +
          'print(json.dumps({"max_lines": plan.ENVELOPE["total_lines"][1], ' +
          '"forms": list(plan.PLAN_FORMS), "positions": list(rhyme_types.POSITION)}))',
      ],
      { cwd: HARNESS, encoding: 'utf8' }
    )
  );
  // The 31-line writing cap is deleted (owner ruling 2026-09-28): the
  // published ceiling is the planner's own envelope, nothing narrower.
  assert.equal(PUBLISHED_MAX_LINES(), read.max_lines, 'the planner envelope');
  assert.deepEqual(PLAN_FORMS, read.forms, 'the planner forms');
  assert.deepEqual(TYPE_POSITIONS, read.positions, 'the rhyme-type positions');
});

// Every published lyric string, on every surface a lyric tool is built for.
async function publishedLyricText() {
  const out = [];
  for (const kitchen of [false, true]) {
    const { server, client } = await connect({ kitchen });
    try {
      out.push(client.getInstructions());
      const { tools } = await client.listTools();
      for (const tool of tools.filter((t) => t.name.startsWith('lyric_'))) {
        out.push(tool.description);
        for (const schema of Object.values(tool.inputSchema.properties || {}))
          out.push(schema.description || '');
      }
    } finally {
      await client.close();
      await server.close();
    }
  }
  return out.join('\n');
}

test('published lyric text carries no ticket, date, doctrine number or stale claim', async () => {
  const text = await publishedLyricText();
  assert.doesNotMatch(text, /\bM-\d+/, 'no ticket numbers');
  assert.doesNotMatch(text, /\b20\d\d-\d\d-\d\d\b/, 'no dates');
  assert.doesNotMatch(text, /doctrine \d+/i, 'no doctrine numbers');
  // Claims the audit found false, each stated in the words it was published in.
  for (const stale of [
    /77[- ]schema|named schemas: \d+/, // a count the registry moved past
    /class:CONSONANCE at once|also assonance and consonance;/, // false for sky/fly
    /Ask lyric_types for the vocabulary/, // lyric_types lists none
    /client's request timeout|60 s client|398 s|10k characters/, // stale timings
    /re-derives which questions arise/, // a moved budget is refused
    /screen the title/, // screen takes bare words only
    /20\/8/, // not a drawable meter
    /unknown forms refuse by name/, // the enum refuses first
    /no mandate spelling/, // placed returns are spellable
    /every declarable row is UNCALIBRATED/, // the default row is calibrated
    /the grade repeats it/, // nothing grades the story plan
    /wrong on \d+%/, // an unpinned rate
    /THREE COUNTS/, // four are listed
    /Exit 0 clean, 2 refused/, // exit 2 is also a measured uncertified draft
    /replace those end words/, // bans sit at placed bindings
    /cannot report banned pairs\./, // verify reports introduced ones
    /For "is the song finished", use lyric_grade/, // only revise finishes
  ])
    assert.doesNotMatch(text, stale, String(stale));
  // The declarations that change a plan, and the readings a grade is taken
  // under, are named in full where the text says "the same declarations".
  const { client, server } = await connect({ task: { domain: 'lyrics' } });
  try {
    const { tools } = await client.listTools();
    const grade = tools.find((t) => t.name === 'lyric_grade').description;
    for (const field of [...PLAN_FIELDS.filter((f) => f !== 'seed'), ...READING_FIELDS])
      assert.ok(grade.includes(field), `lyric_grade names ${field}`);
    const lines = tools.find((t) => t.name === 'lyric_plan').inputSchema.properties.lines;
    assert.equal(lines.maximum, PUBLISHED_MAX_LINES());
    assert.ok(lines.description.includes(`at most ${lines.maximum} `));
    const sweep = tools.find((t) => t.name === 'lyric_sweep');
    assert.match(sweep.description, /FOUR COUNTS/);
    assert.match(sweep.inputSchema.properties.want.description, /FILTER/);
    assert.match(
      tools.find((t) => t.name === 'lyric_plan').inputSchema.properties.wants.description,
      /CONDITION the planner's draw/
    );
    const melody = tools.find((t) => t.name === 'lyric_plan').inputSchema.properties.melody;
    const example = /e\.g\. (\{.*?\})\. Repeat/.exec(melody.description)[1];
    assert.doesNotThrow(() => JSON.parse(example), 'the melody example is valid JSON');
  } finally {
    await client.close();
    await server.close();
  }
});

test('the grade stamp and meaning say what the verdict says', () => {
  const { gradeStamp, verdictOf } = _verdictInternals;
  // `quality/check_render_form.py`'s own STAMP_GRADED pattern.
  const STAMP_GRADED =
    /\[GRADED\s*—\s*seed\s*-?\d+\s*—\s*exit\s*\d+,[^\]\n]+—\s*\d+ banned pair\(s\)\]/;
  const measuredUncertified = gradeStamp(26, {
    exit_code: 2,
    measurement_status: 'graded',
    certified: false,
    flags: 1,
    whole_flags: 1,
    banned_pairs: 5,
  });
  assert.match(measuredUncertified, STAMP_GRADED);
  assert.match(measuredUncertified, /coverage INCOMPLETE, uncertified/);
  assert.doesNotMatch(measuredUncertified, /refused/, 'a measured draft is not a refusal');
  assert.match(measuredUncertified, /1 per-line and 1 whole-draft FLAG\(S\) standing/);
  const refused = gradeStamp(26, {
    exit_code: 2,
    measurement_status: 'refused',
    banned_pairs: undefined,
  });
  assert.match(refused, STAMP_GRADED);
  assert.match(refused, /exit 2, refused, nothing measured/);
  assert.equal(
    gradeStamp(6, {
      exit_code: 0,
      measurement_status: 'graded',
      certified: true,
      flags: 0,
      whole_flags: 0,
      banned_pairs: 0,
    }),
    '[GRADED — seed 6 — exit 0, no FLAG stands — 0 banned pair(s)]',
    "the clean stamp is test_render_form.py's own GRADED_STAMP, byte for byte"
  );
  // lyric_check's verb answers 0 with coverage incomplete; the meaning says so.
  const v = verdictOf({
    code: 0,
    stdout: '',
    stderr: '',
    lyric_result: {
      version: 1,
      status: 'graded',
      command: 'brief',
      coverage: { certified: false, refused_obligations: ['rhyme:3:4:1'] },
      findings: [],
    },
  });
  assert.equal(v.certified, false);
  assert.match(v.meaning, /coverage INCOMPLETE — uncertified/);
});

test('lyric_types names an ordinary rhyme at the line end, and the position is declarable', async () => {
  const { server, client } = await connect({ task: { domain: 'lyrics' } });
  const call = caller(client);
  try {
    const heart = await call('lyric_types', { word_a: 'heart', word_b: 'start' });
    assert.match(heart.report, /NAMES: .*masculine rhyme/);
    assert.doesNotMatch(heart.report, /NAMES: UNNAMED/);
    const love = await call('lyric_types', { word_a: 'love', word_b: 'above' });
    assert.doesNotMatch(love.report, /NAMES: UNNAMED/);
    const internal = await call('lyric_types', {
      word_a: 'heart',
      word_b: 'start',
      position: 'internal',
    });
    assert.match(internal.report, /position: internal \(DECLARED/);
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
});

test('recover numbers its mandate over sung lines, and every refusal carries its reason', async () => {
  const { server, client } = await connect({ task: { domain: 'lyrics' } });
  const call = caller(client);
  try {
    const paste = [
      '[Verse]',
      'You light the morning sky',
      'you make my spirit fly',
      'I give you all my heart',
      'we never drift apart',
      '[Chorus]',
      'Your love is warm and true',
      "there's nothing I won't do",
    ];
    const rec = await call('lyric_recover', { lines: paste });
    assert.match(rec.report, /total_lines\s+\[counted\] 6/, 'the markers are not lines');
    assert.match(rec.report, /sections\s+\[declared\] Verse\(4\), Chorus\(2\)/);
    assert.deepEqual(
      rec.lines,
      paste.filter((l) => !l.startsWith('['))
    );
    assert.deepEqual(
      rec.set_aside.map((row) => row.text),
      ['[Verse]', '[Chorus]']
    );
    const members = rec.mandate.groups
      .split(/[;,]/)
      .map((m) => Number(m.split('.')[0]))
      .filter(Boolean);
    assert.ok(members.length && Math.max(...members) <= 6, 'every member names a sung line');
    assert.ok(rec.refusals.length >= 1);
    for (const refusal of rec.refusals)
      assert.ok(refusal.why.length > 20, `${refusal.coordinate} carries its reason`);
    const placed = rec.refusals.find((r) => r.coordinate === 'repeats_at_a_placement');
    assert.ok(placed, 'the You/you head repeat is refused');
    assert.match(placed.why, /A placed return IS spellable/);
    assert.match(placed.why, /1\.head~2\.head/);
    // The mandate grades the lines it names when the lines ride with it.
    const checked = await call('lyric_check', { lines: rec.lines, groups: rec.mandate.groups });
    assert.equal(checked.measurement_status, 'graded');
    assert.deepEqual(checked.final_draft, rec.lines);
    // The same paste through draft and draft_text reads the same lines.
    const asText = await call('lyric_check', {
      lines_text: paste.join('\n'),
      groups: rec.mandate.groups,
    });
    const asArray = await call('lyric_check', { lines: paste, groups: rec.mandate.groups });
    assert.deepEqual(asArray.final_draft, asText.final_draft);
    assert.deepEqual(asArray.final_draft, rec.lines);
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
});

test('a ban names the bound words and their places, and an unknown name lists the vocabulary', async () => {
  const { server, client } = await connect({ task: { domain: 'lyrics' } });
  const call = caller(client);
  try {
    // The group binds the FIRST words; the end words (town/room) are not banned.
    const placed = await call('lyric_check', {
      lines: ['Night falls on the quiet town', 'Light fills the empty room'],
      groups: '1.head,2.head',
    });
    assert.equal(placed.banned_pairs, 1);
    assert.deepEqual(placed.banned[0].binding, [
      { line: 1, word: 'Night', place: '1.head', what: 'first word' },
      { line: 2, word: 'Light', place: '2.head', what: 'first word' },
    ]);
    const relation = await call('lyric_check', {
      lines: ['Night falls on the quiet town', 'Light fills the empty room'],
      groups: '1,2',
      relation: 'type:no-such-name',
    });
    assert.equal(relation.exit_code, 2);
    assert.match(relation.report, /masculine rhyme/, 'the refusal lists the type names');
    const structure = await call('lyric_check', {
      lines: ['Night falls on the quiet town', 'Light fills the empty room'],
      groups: '1,2',
      structures: 'A:no-such-row',
    });
    assert.equal(structure.exit_code, 2);
    assert.match(structure.report, /kalevala-alliteration/, 'the refusal lists the catalog');
    // D9's own example: an open-syllable perfect rhyme is not consonance.
    const screen = await call('lyric_screen', { words: ['sky', 'fly', 'heart', 'start'] });
    const pair = (a, b) => screen.pairs.find((p) => p.a === a && p.b === b);
    assert.ok(!pair('sky', 'fly').coarse_relations.includes('CONSONANCE'));
    assert.ok(pair('heart', 'start').coarse_relations.includes('CONSONANCE'));
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
});

test('lyric_revise: a pasted run refuses plan declarations, a long answer, and follows its own notes', async () => {
  const { server, client } = await connect({ task: { domain: 'lyrics' } });
  const raw = (args) => client.callTool({ name: 'lyric_revise', arguments: args });
  const draft_text =
    'I walked along the road tonight\nThe stars were cold above the sea\nI held your hand and felt the rain\nAnd nothing else was left for us';
  try {
    // Declarations that only shape a plan used to be accepted, stored and
    // never read on a pasted song's run.
    for (const extra of [{ title: 'Road Tonight' }, { lines: 12 }, { melody: 'not json' }]) {
      const refused = await raw({ draft_text, scheme: 'ABAB', ...extra });
      assert.ok(refused.isError, JSON.stringify(extra));
      assert.match(refused.content[0].text, /applies only to a seeded run/);
    }
    const seededGrid = await raw({ draft_text, seed: 5, subdivision: 2 });
    assert.ok(seededGrid.isError);
    assert.match(seededGrid.content[0].text, /subdivision/);

    const before = RUNS.size();
    const first = await raw({ draft_text, scheme: 'ABAB' });
    const v1 = verdictIn(first);
    assert.equal(v1.exit_code, 4, 'the interview suspends on its first question');
    // The note names every field a continuation needs, run_revision included.
    assert.match(
      first.content[0].text,
      /CONTINUE: call lyric_revise with `run_id`, `run_revision` 1 and `answer/
    );
    const tooLong = await raw({
      run_id: v1.run_id,
      run_revision: v1.run_revision,
      answer: 'x'.repeat(201),
    });
    assert.ok(tooLong.isError);
    assert.match(tooLong.content[0].text, /ANSWER_TOO_LONG/);
    // Continuing by state keeps one run: same run_id, advancing revision.
    let v = v1;
    const ids = new Set([v1.run_id]);
    for (let i = 0; i < 2 && v.exit_code === 4; i++) {
      const next = await raw({ state: v.state, answer: `The stars were cold and so were we ${i}` });
      assert.ok(!next.isError, next.content[0].text);
      const prior = v;
      v = verdictIn(next);
      ids.add(v.run_id);
      if (v.exit_code === 4) assert.equal(v.run_revision, prior.run_revision + 1);
    }
    assert.equal(ids.size, 1, 'one run, not one per state-carried call');
    assert.ok(RUNS.size() <= before + 1, 'the shared cache holds one record for the song');
    // Following the continue note literally works (run_id + run_revision).
    if (v.exit_code === 4) {
      const followed = await raw({
        run_id: v.run_id,
        run_revision: v.run_revision,
        answer: 'The stars were cold and so were we again',
      });
      assert.ok(!followed.isError, followed.content[0].text);
    }
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
  // The parked refusal names run_revision too.
  const parked = runRefusal(
    { status: 'parked', seed: 3, revision: 4, run_id: 'run_x', draft: ['a'], open: ['L1'] },
    { run_revision: 4, draft: ['a'] }
  );
  assert.match(parked, /`run_id`, `run_revision` 4 and `draft_text`/);
});

test('lyric_plan block 0 is the plan and brief, without the server path or CLI commands', async () => {
  const { server, client } = await connect({ task: { domain: 'lyrics' } });
  try {
    const response = await client.callTool({ name: 'lyric_plan', arguments: { seed: 1 } });
    const block0 = response.content[0].text;
    assert.match(block0, /PLAN: form=verse-chorus seed=1/);
    assert.doesNotMatch(block0, /\/tmp\/|python3|WROTE plan|GRADE IT/);
    assert.equal(verdictIn(response).exit_code, 0);
  } finally {
    _workerInternals.kill();
    await client.close();
    await server.close();
  }
});

test("the website chat's lyric text matches the fields its kitchen declarations keep", async () => {
  const { server, client } = await connect({ kitchen: true });
  try {
    const { tools } = await client.listTools();
    const surface = toGeminiDeclarations(tools);
    const decl = declarationsFor(
      {
        declarations: surface.declarations,
        stateTools: new Set(surface.stateTools),
      },
      null,
      'kitchen'
    );
    const revise = decl.find((d) => d.name === 'lyric_revise');
    const kept = Object.keys(revise.parameters.properties);
    for (const gone of ['state', 'answer', 'answers', 'writer', 'run_id', 'run_revision'])
      assert.ok(!kept.includes(gone), `${gone} is not declared to the chat model`);
    // No text the chat model reads tells it to send a field it does not have.
    assert.doesNotMatch(revise.description, /put your proposal in `answer`|plus `run_id`/);
    assert.doesNotMatch(client.getInstructions(), /'interview' \(the default\)/);
    assert.match(
      KITCHEN_REVISE_SCHEMA.attempts.description,
      /When the service writer answers, the default is 3/
    );
    assert.match(KITCHEN_REVISE_SCHEMA.backtrack.description, /asked of the service writer/);
    assert.match(LYRIC_TOOL_SCHEMAS.lyric_revise.backtrack.description, /asked of you/);
  } finally {
    await client.close();
    await server.close();
  }
  const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
  assert.doesNotMatch(chat, /no second model name exists anywhere/);
  const proposer = readFileSync(new URL('./gemini_proposer.py', import.meta.url), 'utf8');
  assert.doesNotMatch(proposer, /up to31|from1 to31|asks Gemini\s+for ONE line per question/);
  const brief = readFileSync(
    new URL('../lyric-harness/quality/propose.py', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(
    brief,
    /decline the rewrite/,
    'the brief offers no answer that does not exist'
  );
  assert.match(brief, /at most \{MAX_LINE_CHARS\} characters/, 'and states the line bound');
});
