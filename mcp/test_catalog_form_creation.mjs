// Exercise the same queued MCP session and native Python processes a creation
// client uses. Only waiting for the operation is in-process.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JobStore } from './job_store.js';
import { WorkflowSessions, verdictOf } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';

async function sessionHost(t) {
  const directory = await mkdtemp(join(tmpdir(), 'creation-catalog-'));
  let client, server, sessions, sessionId;
  async function disconnect() {
    if (client) await client.close();
    if (server) await server.close();
  }
  async function reconnect() {
    await disconnect();
    sessions = new WorkflowSessions({ store: new JobStore(directory) });
    server = await buildWorkflowServer({ domain: 'lyrics', sessions });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'seeded-catalog-creation', version: '1' });
    await server.connect(a);
    await client.connect(b);
  }
  await reconnect();
  t.after(async () => {
    await disconnect();
    await rm(directory, { recursive: true, force: true });
  });
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result.content));
    assert.ok(result.structuredContent);
    return result.structuredContent;
  };
  const read = (id, detail) =>
    call('get_operation', { operation_id: id, ...(detail && { detail }) });
  return {
    reconnect,
    read,
    call,
    tools: () => client.listTools(),
    async begin(phase = 'create') {
      sessionId = (await call('begin_lyrics', { phase })).session_id;
      assert.ok(sessionId);
    },
    async run(name, args) {
      const predecessor = sessionId;
      const queued = await call(name, { session_id: predecessor, ...args });
      await sessions.wait(queued.operation_id);
      const result = await read(queued.operation_id);
      assert.equal(result.status, 'completed', JSON.stringify(result));
      sessionId = result.session_id;
      return { ...result, predecessor };
    },
  };
}

function measured(operation) {
  assert.ok(!operation.tool_error, JSON.stringify(operation.tool_result.content));
  const value = verdictOf(operation.tool_result);
  assert.ok(value, JSON.stringify(operation.tool_result.content));
  return value;
}

test(
  'positioned ending words survive the registered grade, reconnect and revision',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const relation = 'class:RHYME';
    const seed = 1;
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'tritina',
        catalog_variant: 0,
        seed_from: seed,
        count: 1,
        relation,
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const planned = await host.run('lyric_plan', { seed, relation });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    const ending = plan.request.song_form.endingWords;
    assert.deepEqual(ending.groups, [
      [1, 5, 9],
      [2, 6, 7],
      [3, 4, 8],
    ]);
    assert.deepEqual(ending.gathered, [10]);
    assert.equal(plan.returns, '');
    const screen = measured(await host.run('lyric_screen', { words: ['one', 'none'], relation }));
    assert.equal(screen.exit_code, 0);
    const words = ['one', 'two', 'three'];
    const draft = Array(10);
    for (const [i, group] of ending.groups.entries()) {
      for (const line of group) draft[line - 1] = 'zero ' + words[i];
    }
    draft[9] = words.join(' ');
    async function catalog(verb, args) {
      const operation = await host.run(verb, { seed, relation, ...args });
      const result = measured(await host.read(operation.operation_id, 'full'));
      assert.ok(result.coverage?.catalog_form, result.report);
      return result.coverage.catalog_form;
    }
    const valid = await catalog('lyric_grade', { draft });
    assert.equal(valid.verdict, 'pass');
    assert.ok(valid.checks.some((c) => c.kind === 'gathered-end-words' && c.outcome === 'pass'));
    draft[4] = 'zero four';
    const wrong = await catalog('lyric_grade', { draft });
    assert.equal(wrong.verdict, 'fail');
    await host.reconnect();
    const revised = await catalog('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 });
    for (const result of [wrong, revised]) {
      assert.equal(result.id, 'tritina');
      assert.ok(
        result.checks.some((c) => c.kind === 'positioned-ending-identity' && c.outcome === 'fail')
      );
    }
  }
);

test(
  'caesural rhyme measures each marked line through grading and reconnected revision',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const seed = 11,
      relation = 'class:RHYME',
      lines = 2;
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'leonine-verse',
        seed_from: seed,
        count: 1,
        lines,
        relation,
        draw: ['functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const planned = await host.run('lyric_plan', { seed, lines, relation });
    const plan = measured(await host.read(planned.operation_id, 'full')).plan;
    assert.equal(plan.request.song_form.lineProfile, 'caesural-rhyme');
    const screen = measured(await host.run('lyric_screen', { words: ['one', 'none'], relation }));
    assert.equal(screen.exit_code, 0, JSON.stringify(screen));
    async function form(verb, args) {
      const result = await host.run(verb, { seed, relation, ...args });
      return measured(await host.read(result.operation_id, 'full')).coverage.catalog_form;
    }
    const draft = ['zero one / none', 'two | blue'];
    assert.equal((await form('lyric_grade', { draft })).verdict, 'pass');
    draft[0] = 'one ten / none';
    assert.equal((await form('lyric_grade', { draft })).verdict, 'fail');
    await host.reconnect();
    const revised = await form('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 });
    assert.equal(revised.id, 'leonine-verse');
    assert.deepEqual(
      revised.checks.map((c) => c.outcome),
      ['fail', 'pass']
    );
  }
);

const selected = {
  catalog_form: 'chorus-first',
  catalog_variant: 0,
  catalog_counts: [{ path: '1.2', count: 1 }],
};
const nativeChoices = { lines: 12, relation: 'class:RHYME' };
const songSweep = {
  seed_from: 31,
  count: 1,
  ...selected,
  ...nativeChoices,
  draw: ['functions', 'melody'],
};

test(
  'the public create session persists the chosen form from sweep through native revision and replay',
  { timeout: 300_000 },
  async (t) => {
    const host = await sessionHost(t);
    const { tools } = await host.tools();
    for (const name of ['lyric_sweep', 'lyric_plan', 'lyric_grade', 'lyric_revise']) {
      const schema = tools.find((tool) => tool.name === name).inputSchema.properties;
      for (const key of ['catalog_form', 'catalog_variant', 'catalog_counts'])
        assert.ok(schema[key], `${name} must accept ${key}`);
    }
    await host.begin();
    const sweep = await host.run('lyric_sweep', songSweep);
    const candidates = measured(sweep);
    assert.equal(candidates.exit_code, 0, candidates.report);
    const [seed] = candidates.accepted_shown;
    assert.ok(Number.isInteger(seed), JSON.stringify(candidates));

    await host.reconnect();
    const switched = await host.run('lyric_plan', {
      seed,
      ...nativeChoices,
      ...selected,
      catalog_variant: 1,
    });
    assert.equal(switched.tool_error, true, JSON.stringify(switched.tool_result.content));
    assert.match(JSON.stringify(switched.tool_result.content), /CREATION_PLAN/);
    const planned = await host.run('lyric_plan', { seed, ...nativeChoices });
    const proof = measured(await host.read(planned.operation_id, 'full'));
    assert.equal(proof.exit_code, 0, proof.report);
    assert.equal(proof.plan.request.song_form.id, selected.catalog_form);
    assert.equal(proof.plan.request.song_form.variant, 0);
    assert.deepEqual(proof.plan.request.song_form.counts, { 1.2: 1 });
    assert.equal(proof.plan.total_lines, 12);
    assert.deepEqual(
      proof.plan.sections.map((s) => s.function),
      ['chorus', 'verse', 'chorus']
    );
    assert.equal(proof.plan.line_slots.length, 12);
    assert.ok(proof.plan.groups, 'the ordinary native writer still declares its rhyme groups');
    assert.ok(proof.plan.returns, 'the ordinary native writer still declares chorus returns');
    const planDigest = proof.plan_sha256;
    assert.match(planDigest, /^[a-f0-9]{64}$/);

    const screened = measured(
      await host.run('lyric_screen', { words: ['home', 'alone'], relation: 'class:RHYME' })
    );
    assert.equal(screened.exit_code, 0);
    // Distinct counting-word rows deliberately break each represented chorus
    // return. Build the expected violations from the native plan's positions.
    const units = ['one', 'two', 'three', 'four'];
    const draft = units.flatMap((first) => units.map((last) => first + ' ' + last)).slice(0, 12);
    const expectedDrift = proof.plan.returns
      .split(';')
      .flatMap((group) => group.split(',').slice(1).map(Number));
    const grade = await host.run('lyric_grade', { seed, draft });
    const assessment = measured(await host.read(grade.operation_id, 'full'));
    assert.equal(assessment.plan_sha256, planDigest);
    assert.equal(assessment.exit_code, 3, assessment.report);
    assert.deepEqual(assessment.final_draft, draft);
    assert.equal(
      assessment.coverage.catalog_form?.id,
      selected.catalog_form,
      'a seeded grade must measure its catalog form on the filled blueprint'
    );
    assert.equal(assessment.coverage.catalog_form.verdict, 'pass');
    const roleChecks = assessment.coverage.catalog_form.checks.filter(
      (item) => item.kind === 'role'
    );
    assert.equal(roleChecks.length, 3);
    assert.ok(roleChecks.every((item) => item.outcome === 'pass'));
    const broken = assessment.findings.filter(
      (f) => f.code === 'RETURN_NOT_VERBATIM' && f.severity === 'flag'
    );
    assert.ok(expectedDrift.length);
    for (const position of expectedDrift)
      assert.ok(
        broken.some((f) => f.locations.includes(position)),
        JSON.stringify(broken)
      );

    await host.reconnect();
    const reviseArgs = { seed, max_rounds: 1, attempts: 0, backtrack: 0 };
    const revision = await host.run('lyric_revise', reviseArgs);
    const result = measured(revision);
    assert.equal(result.exit_code, 3, JSON.stringify(result));
    assert.equal(result.certified, true, 'the imposed rhyme obligation received a verdict');
    assert.equal(result.outcome?.kind, 'decision', JSON.stringify(result));
    const revised = measured(await host.read(revision.operation_id, 'full'));
    assert.equal(revised.coverage.catalog_form?.id, selected.catalog_form);
    assert.equal(revised.coverage.catalog_form.verdict, 'pass');
    const replay = await host.call('lyric_revise', {
      session_id: revision.predecessor,
      ...reviseArgs,
    });
    assert.equal(replay.operation_id, revision.operation_id);
    assert.deepEqual(measured(await host.read(replay.operation_id)), result);
  }
);

test('a creation sweep refuses deferred forms and unselected alternatives without recording an accepted seed', async (t) => {
  const host = await sessionHost(t);
  for (const [selection, expected] of [
    [{ catalog_form: 'acrostic' }, /deferred/i],
    [{ catalog_form: 'pantoum', catalog_variant: 1 }, /unsupported-line-structure/i],
    [{ catalog_form: 'echo-song' }, /no-inspectable-native-pair/i],
    [{ catalog_form: 'monostich' }, /native-line-limit|no-inspectable-native-pair/],
    [{ catalog_form: 'zeno' }, /native-free-word-reserve/i],
    [{ catalog_form: 'strophic' }, /needs-input/],
    [{ catalog_form: 'couplet' }, /variant|alternative/i],
  ]) {
    await host.begin();
    const op = await host.run('lyric_sweep', {
      seed_from: 31,
      count: 1,
      draw: ['functions', 'lines', 'melody', 'relation'],
      ...selection,
    });
    const response = op.tool_result;
    assert.match(JSON.stringify(response.content), expected);
    assert.ok(op.tool_error || verdictOf(response)?.exit_code !== 0);
    assert.equal(verdictOf(response)?.accepted_shown?.length ?? 0, 0);
    const skipped = await host.run('lyric_plan', { seed: songSweep.seed_from });
    assert.match(
      JSON.stringify(skipped.tool_result.content),
      /CREATION_ORDER|successful lyric_sweep/
    );
  }
});

test(
  'catalog repetition counts survive the public sweep-to-plan handoff; ordinary forms retain their own planner',
  { timeout: 120_000 },
  async (t) => {
    const host = await sessionHost(t);
    for (const selector of [
      { catalog_form: 'strophic', catalog_counts: [{ path: '1.1', count: 3 }] },
      { form: 'open' },
    ]) {
      await host.begin();
      const args = {
        seed_from: 31,
        count: 1,
        ...selector,
        lines: 12,
        draw: ['functions', 'relation', 'melody'],
      };
      const swept = measured(await host.run('lyric_sweep', args));
      assert.equal(swept.exit_code, 0, swept.report);
      const [seed] = swept.accepted_shown;
      assert.ok(Number.isInteger(seed), JSON.stringify(swept));
      const op = await host.run('lyric_plan', { seed, lines: 12 });
      const { plan } = measured(await host.read(op.operation_id, 'full'));
      assert.equal(plan.total_lines, 12);
      if (selector.catalog_form) {
        assert.equal(plan.request.song_form.id, selector.catalog_form);
        assert.deepEqual(plan.request.song_form.counts, { 1.1: 3 });
        assert.deepEqual(
          plan.sections.map((part) => part.function),
          ['verse', 'verse', 'verse']
        );
      } else {
        assert.equal(plan.request.form, 'open');
        assert.equal(plan.request.song_form, undefined);
      }
    }
  }
);

test(
  'a counted stanza is graded and revised at its measured boundaries on a real seeded session',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const choices = {
      catalog_form: 'table-grace-sung',
      catalog_counts: [{ path: '1.1', count: 3 }],
    };
    const relation = 'class:RHYME';
    const sweep = measured(
      await host.run('lyric_sweep', {
        seed_from: 31,
        count: 1,
        ...choices,
        relation,
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.equal(sweep.exit_code, 0, sweep.report);
    const [seed] = sweep.accepted_shown;
    assert.ok(Number.isInteger(seed), JSON.stringify(sweep));
    const planned = await host.run('lyric_plan', { seed, relation });
    const { plan, plan_sha256: digest } = measured(await host.read(planned.operation_id, 'full'));
    assert.equal(plan.request.song_form.id, choices.catalog_form);
    assert.deepEqual(plan.request.song_form.counts, { 1.1: 3 });
    assert.deepEqual(plan.request.song_form.sections, [
      { unit: 'section', role: 'verse', lines: 3 },
    ]);
    assert.equal(plan.total_lines, 3);
    assert.deepEqual(
      plan.request.song_form.rhymeGroups,
      [],
      'the source stanza only specifies its line count'
    );
    assert.ok(plan.groups, 'the ordinary native writing obligations remain in force');

    const labels = ['one', 'two', 'three'];
    const screened = measured(await host.run('lyric_screen', { words: labels, relation }));
    assert.equal(screened.exit_code, 0, screened.report);
    const draft = labels.map((word) => Array(5).fill(word).join(' '));
    const wrong = await host.run('lyric_grade', { seed, draft: draft.slice(1) });
    assert.equal(wrong.tool_error, true);
    assert.match(
      JSON.stringify(wrong.tool_result.content),
      /plan has 3 lines and this draft has 2/i
    );

    const grade = await host.run('lyric_grade', { seed, draft });
    const judged = measured(await host.read(grade.operation_id, 'full'));
    assert.equal(judged.plan_sha256, digest);
    assert.equal(judged.exit_code, 3, judged.report);
    const checkStanza = (coverage) => {
      assert.equal(coverage.catalog_form?.id, choices.catalog_form);
      assert.equal(coverage.catalog_form.verdict, 'pass');
      const span = coverage.catalog_form.checks.find((item) => item.kind === 'line-span');
      assert.equal(span?.outcome, 'pass', JSON.stringify(coverage.catalog_form));
      assert.deepEqual(span.expected, [0, 3]);
      assert.deepEqual(span.lines, [1, 2, 3]);
    };
    checkStanza(judged.coverage);
    assert.ok(
      judged.findings.some((item) => item.code === 'SCHEME_VIOLATION' && item.severity === 'flag'),
      JSON.stringify(judged.findings)
    );

    await host.reconnect();
    const args = { seed, max_rounds: 1, attempts: 0, backtrack: 0 };
    const revision = await host.run('lyric_revise', args);
    const result = measured(await host.read(revision.operation_id, 'full'));
    assert.equal(result.exit_code, 3, JSON.stringify(result));
    checkStanza(result.coverage);
    const replay = await host.call('lyric_revise', { session_id: revision.predecessor, ...args });
    assert.equal(replay.operation_id, revision.operation_id);
    assert.deepEqual(measured(await host.read(replay.operation_id, 'full')), result);
  }
);

for (const [variant, measure, lengths] of [
  [0, 'syllables', [5, 3, 5]],
  [1, 'words', [3, 5, 3]],
]) {
  test(
    `Lune ${variant} publishes and enforces the selected ${measure} counts through real revision`,
    { timeout: 180_000 },
    async (t) => {
      const host = await sessionHost(t);
      await host.begin();
      const relation = 'class:RHYME';
      const swept = measured(
        await host.run('lyric_sweep', {
          seed_from: 11,
          count: 1,
          catalog_form: 'lune',
          catalog_variant: variant,
          relation,
          draw: ['lines', 'functions', 'melody'],
        })
      );
      assert.deepEqual(swept.accepted_shown, [11], swept.report);
      const [seed] = swept.accepted_shown;
      const planned = await host.run('lyric_plan', { seed, relation });
      const { plan, plan_sha256: digest } = measured(await host.read(planned.operation_id, 'full'));
      const expected = lengths.map((count, i) => ({ line: i + 1, [measure]: count }));
      assert.equal(plan.request.song_form.variant, variant);
      assert.deepEqual(plan.request.song_form.lineRequirements, expected);
      const brief = planned.tool_result.content[0].text;
      for (const [i, n] of lengths.entries())
        assert.match(brief, new RegExp(`^\\s*L${i + 1}: (?:exactly )?${n} ${measure}\\.`, 'm'));
      const screened = measured(
        await host.run('lyric_screen', { words: ['seven', 'three'], relation })
      );
      assert.equal(screened.exit_code, 0, screened.report);

      // "seven" has two syllables, so counting tokens cannot satisfy both versions.
      const valid =
        measure === 'syllables'
          ? ['seven one two three', 'seven one', 'five seven four six']
          : ['seven one two', 'three four seven five six', 'six seven two'];
      async function grade(draft) {
        const op = await host.run('lyric_grade', { seed, draft });
        assert.ok(!op.tool_error, JSON.stringify(op.tool_result.content));
        const current = measured(await host.read(op.operation_id, 'full'));
        assert.equal(current.plan_sha256, digest);
        assert.deepEqual(current.final_draft, draft);
        return current;
      }
      function inspect(grade, outcomes) {
        const catalog = grade.coverage.catalog_form;
        assert.equal(catalog.id, 'lune');
        assert.equal(catalog.variant, variant);
        const rows = catalog.checks.filter(
          (row) => row.kind === (measure === 'words' ? 'word-count' : 'syllables')
        );
        assert.deepEqual(
          rows.map((row) => row.expected),
          lengths
        );
        assert.deepEqual(
          rows.map((row) => row.lines),
          [[1], [2], [3]]
        );
        assert.deepEqual(
          rows.map((row) => row.outcome),
          outcomes
        );
        return catalog.verdict;
      }
      const matching = await grade(valid);
      assert.equal(inspect(matching, ['pass', 'pass', 'pass']), 'pass');
      if (measure === 'syllables') {
        const unread = [...valid];
        unread[1] = 'xqzxqz one';
        const unknown = await grade(unread);
        assert.equal(inspect(unknown, ['pass', 'unknown', 'pass']), 'unknown');
        assert.equal(unknown.exit_code, 2);
      }
      const wrong = [...valid];
      wrong[1] += ' one';
      const failed = await grade(wrong);
      assert.equal(inspect(failed, ['pass', 'fail', 'pass']), 'fail');
      assert.equal(failed.exit_code, 3, failed.report);
      await host.reconnect();
      const stopped = await host.run('lyric_revise', {
        seed,
        attempts: 0,
        max_rounds: 1,
        backtrack: 0,
      });
      const revised = measured(await host.read(stopped.operation_id, 'full'));
      assert.equal(revised.exit_code, 3, JSON.stringify(revised));
      assert.equal(inspect(revised, ['pass', 'fail', 'pass']), 'fail');
    }
  );
}

test(
  'Long Metre grades placed lexical stress independently of syllable and stress counts',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const relation = 'class:RHYME';
    const swept = measured(
      await host.run('lyric_sweep', {
        seed_from: 11,
        count: 1,
        relation,
        catalog_form: 'long-metre-lm',
        catalog_variant: 0,
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(swept.accepted_shown, [11], swept.report);
    const [seed] = swept.accepted_shown;
    const planned = await host.run('lyric_plan', { seed, relation });
    const { plan, plan_sha256: digest } = measured(await host.read(planned.operation_id, 'full'));
    assert.deepEqual(
      plan.request.song_form.lineRequirements,
      [1, 2, 3, 4].map((line) => ({
        line,
        syllables: 8,
        stress: '././././',
        stresses: 4,
      }))
    );
    const screened = measured(
      await host.run('lyric_screen', { words: ['array', 'zero'], relation })
    );
    assert.equal(screened.exit_code, 0, screened.report);
    const draft = ['array', 'zero', 'begin', 'today'].map((word) => Array(4).fill(word).join(' '));
    const op = await host.run('lyric_grade', { seed, draft });
    assert.ok(!op.tool_error, JSON.stringify(op.tool_result.content));
    const grade = measured(await host.read(op.operation_id, 'full'));
    assert.equal(grade.plan_sha256, digest);
    const catalog = grade.coverage.catalog_form;
    assert.equal(catalog.verdict, 'fail');
    const results = (kind) =>
      catalog.checks.filter((row) => row.kind === kind).map((row) => [row.lines[0], row.outcome]);
    assert.deepEqual(
      results('syllables'),
      [1, 2, 3, 4].map((line) => [line, 'pass'])
    );
    assert.deepEqual(
      results('stresses'),
      [1, 2, 3, 4].map((line) => [line, 'pass'])
    );
    assert.deepEqual(results('stress'), [
      [1, 'pass'],
      [2, 'fail'],
      [3, 'pass'],
      [4, 'pass'],
    ]);
    assert.equal(grade.exit_code, 3);
  }
);

test(
  'the seeded writer enforces the selected bar layout through grading, reconnect, and revision',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    const relation = 'class:RHYME';
    const selection = {
      seed_from: 31,
      count: 1,
      catalog_form: '16-bar-blues',
      catalog_variant: 1,
      lines: 4,
      relation,
      draw: ['functions'],
    };
    const phrase = (bars) =>
      JSON.stringify({
        meter: { beats: 4, unit: 4, groups: [2, 2] },
        bars,
        subdivision: 1,
        notes: Array.from({ length: bars * 4 }, () => ({ pitch_hz: 440, ticks: 1 })),
      });
    await host.begin();
    const wrong = await host.run('lyric_sweep', { ...selection, melody: phrase(2) });
    const refusal = measured(await host.read(wrong.operation_id, 'full'));
    assert.deepEqual(refusal.accepted_shown, [], JSON.stringify(refusal));
    assert.match(
      JSON.stringify(refusal.planner_refusals),
      /catalog section bars cannot fit the declared lines, melody, and native section partition/i
    );

    await host.begin();
    const swept = measured(await host.run('lyric_sweep', { ...selection, melody: phrase(4) }));
    assert.deepEqual(swept.accepted_shown, [31], swept.report);
    const [seed] = swept.accepted_shown;
    const planned = await host.run('lyric_plan', { seed, relation, lines: 4, melody: phrase(4) });
    const { plan, plan_sha256: digest } = measured(await host.read(planned.operation_id, 'full'));
    assert.deepEqual(plan.request.song_form.sections, [
      { unit: 'section', role: 'verse', lines: 4, bars: 16 },
    ]);
    assert.deepEqual(
      plan.sections.map((s) => s.bars),
      [16]
    );
    assert.deepEqual(
      plan.line_slots.map((row) => row.duration),
      [16, 16, 16, 16]
    );
    const screened = measured(await host.run('lyric_screen', { words: ['one', 'two'], relation }));
    assert.equal(screened.exit_code, 0, screened.report);
    const draft = ['one', 'two', 'three', 'four'].map((w) => Array(4).fill(w).join(' '));
    function verifyCatalog(receipt) {
      assert.equal(receipt.coverage.catalog_form?.id, '16-bar-blues');
      assert.equal(receipt.coverage.catalog_form.variant, 1);
      const bars = receipt.coverage.catalog_form.checks.filter((c) => c.kind === 'bars');
      assert.deepEqual(
        bars.map((c) => [c.expected, c.outcome, c.lines]),
        [[16, 'pass', [1, 2, 3, 4]]]
      );
      assert.equal(receipt.coverage.catalog_form.verdict, 'pass');
      assert.equal(receipt.exit_code, 3, receipt.report);
    }
    const graded = await host.run('lyric_grade', { seed, draft });
    const actual = measured(await host.read(graded.operation_id, 'full'));
    assert.equal(actual.plan_sha256, digest);
    verifyCatalog(actual);
    await host.reconnect();
    const args = { seed, attempts: 0, max_rounds: 1, backtrack: 0 };
    const revised = await host.run('lyric_revise', args);
    const final = measured(await host.read(revised.operation_id, 'full'));
    verifyCatalog(final);
    const replay = await host.call('lyric_revise', { session_id: revised.predecessor, ...args });
    assert.equal(replay.operation_id, revised.operation_id);
    assert.deepEqual(measured(await host.read(replay.operation_id, 'full')), final);
  }
);

test(
  'repeated sections retain their individual bar counts in a real grade',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const relation = 'class:RHYME';
    const selection = {
      catalog_form: 'hip-hop-verse-hook',
      catalog_variant: 1,
      catalog_counts: [
        { path: '1.1', count: 0 },
        { path: '1.2', count: 2 },
        { path: '1.3', count: 0 },
      ],
    };
    const swept = measured(
      await host.run('lyric_sweep', {
        seed_from: 11,
        count: 1,
        ...selection,
        lines: 10,
        relation,
        draw: ['functions', 'melody'],
      })
    );
    assert.deepEqual(swept.accepted_shown, [11], swept.report);
    const [seed] = swept.accepted_shown;
    const planned = await host.run('lyric_plan', { seed, lines: 10, relation });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    const pattern = [
      ['verse', 12],
      ['hook', 8],
      ['verse', 12],
      ['hook', 8],
    ];
    assert.deepEqual(
      plan.sections.map((s) => [s.function, s.bars]),
      pattern
    );
    const screen = measured(await host.run('lyric_screen', { words: ['one', 'two'], relation }));
    assert.equal(screen.exit_code, 0);
    const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const draft = units.map((word) => Array(4).fill(word).join(' '));
    const graded = await host.run('lyric_grade', { seed, draft });
    const receipt = measured(await host.read(graded.operation_id, 'full'));
    assert.equal(
      receipt.coverage.catalog_form?.verdict,
      'pass',
      JSON.stringify(receipt.coverage.catalog_form)
    );
    const bars = receipt.coverage.catalog_form.checks.filter((row) => row.kind === 'bars');
    assert.deepEqual(
      bars.map((row) => [row.expected, row.outcome]),
      pattern.map(([, count]) => [count, 'pass'])
    );
    assert.equal(receipt.exit_code, 3, receipt.report);
  }
);

test(
  'paired stanza boundaries and line counts persist through a connector restart and revision',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const relation = 'class:RHYME';
    const sweep = measured(
      await host.run('lyric_sweep', {
        seed_from: 11,
        count: 1,
        relation,
        catalog_form: 'short-metre-double-smd',
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11], sweep.report);
    const [seed] = sweep.accepted_shown;
    const operation = await host.run('lyric_plan', { seed, relation });
    const { plan } = measured(await host.read(operation.operation_id, 'full'));
    const counts = [6, 6, 8, 6, 6, 6, 8, 6];
    assert.deepEqual(
      plan.request.song_form.lineRequirements,
      counts.map((syllables, i) => ({ line: i + 1, syllables }))
    );
    assert.deepEqual(
      plan.request.song_form.sections.map((s) => s.lines),
      [4, 4]
    );
    const screen = measured(await host.run('lyric_screen', { words: ['one', 'two'], relation }));
    assert.equal(screen.exit_code, 0, screen.report);
    const draft = counts.map((n, i) =>
      Array(i === 6 ? n - 1 : n)
        .fill('one')
        .join(' ')
    );
    const graded = await host.run('lyric_grade', { seed, draft });
    function verify(receipt) {
      const result = receipt.coverage.catalog_form;
      assert.equal(result.id, 'short-metre-double-smd');
      assert.equal(result.verdict, 'fail');
      assert.deepEqual(
        result.checks
          .filter((c) => c.kind === 'syllables' && c.outcome === 'fail')
          .map((c) => c.lines),
        [[7]]
      );
      assert.deepEqual(
        result.checks
          .filter((c) => c.kind === 'line-span' && c.outcome === 'pass')
          .map((c) => c.lines),
        [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
        ]
      );
    }
    verify(measured(await host.read(graded.operation_id, 'full')));
    await host.reconnect();
    const revised = await host.run('lyric_revise', {
      seed,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    verify(measured(await host.read(revised.operation_id, 'full')));
  }
);

test(
  'selected word lengths are remeasured on the submitted draft and on revision',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const relation = 'class:RHYME';
    const selection = {
      catalog_form: 'kwansaba',
      catalog_counts: [
        { path: '1.1.1.1', count: 3 },
        { path: '1[1].1[4].1[3].1', count: 4 },
      ],
    };
    const swept = measured(
      await host.run('lyric_sweep', {
        seed_from: 11,
        count: 1,
        relation,
        ...selection,
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(swept.accepted_shown, [11], swept.report);
    const [seed] = swept.accepted_shown;
    const planned = await host.run('lyric_plan', { seed, relation });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    assert.deepEqual(
      plan.request.song_form.lineRequirements,
      Array.from({ length: 7 }, (_, i) => ({
        line: i + 1,
        words: 7,
        wordLetters: Array.from({ length: 7 }, (_, j) => (i === 3 && j === 2 ? 4 : 3)),
      }))
    );
    const screened = measured(await host.run('lyric_screen', { words: ['one', 'two'], relation }));
    assert.equal(screened.exit_code, 0, screened.report);
    const draft = Array.from({ length: 7 }, () => Array(7).fill('one').join(' '));
    draft[3] = 'one one four one one one one';
    const matching = await host.run('lyric_grade', { seed, draft });
    const accepted = measured(await host.read(matching.operation_id, 'full')).coverage.catalog_form;
    assert.equal(accepted.verdict, 'pass');
    assert.equal(
      accepted.checks.filter((c) => c.kind === 'letter-count' && c.outcome === 'pass').length,
      49
    );
    draft[3] = 'one one three one one one one';
    const grade = await host.run('lyric_grade', { seed, draft });
    function verify(receipt) {
      const form = receipt.coverage.catalog_form;
      assert.equal(form.id, 'kwansaba');
      assert.equal(form.verdict, 'fail');
      assert.equal(
        form.checks.filter((c) => c.kind === 'word-count' && c.outcome === 'pass').length,
        7
      );
      const widths = form.checks.filter((c) => c.kind === 'letter-count');
      assert.equal(widths.length, 49);
      assert.deepEqual(
        widths
          .filter((c) => c.outcome !== 'pass')
          .map((c) => [c.address, c.lines, c.expected, c.actual]),
        [['1[1].1[4].1[3]', [4], 4, 5]]
      );
    }
    verify(measured(await host.read(grade.operation_id, 'full')));
    await host.reconnect();
    const revised = await host.run('lyric_revise', {
      seed,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    verify(measured(await host.read(revised.operation_id, 'full')));
  }
);

for (const [form, variant, good] of [
  ['couplet', 1, ['two one', 'three none']],
  ['triplet', 0, ['two one', 'three none', 'four ton']],
]) {
  test(
    `the writer binds the selected terminal rhyme for ${form} and regrades after reconnect`,
    { timeout: 180_000 },
    async (t) => {
      const host = await sessionHost(t);
      await host.begin();
      const selection = { catalog_form: form, catalog_variant: variant, seed_from: 11, count: 1 };
      const sweep = measured(
        await host.run('lyric_sweep', {
          ...selection,
          draw: ['lines', 'functions', 'melody', 'relation'],
        })
      );
      assert.deepEqual(sweep.accepted_shown, [11], sweep.report);
      const [seed] = sweep.accepted_shown;
      const planned = await host.run('lyric_plan', { seed });
      const { plan } = measured(await host.read(planned.operation_id, 'full'));
      const positions = good.map((_, i) => i + 1);
      assert.deepEqual(plan.request.song_form.rhymeGroups, [positions]);
      assert.equal(plan.groups, positions.join(','));
      assert.equal(plan.relations.A, 'class:RHYME');
      const screen = measured(
        await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' })
      );
      assert.equal(screen.exit_code, 0, screen.report);
      async function grade(draft) {
        const op = await host.run('lyric_grade', { seed, draft });
        return measured(await host.read(op.operation_id, 'full'));
      }
      function verify(receipt, outcome) {
        const catalog = receipt.coverage.catalog_form;
        assert.equal(catalog.verdict, outcome);
        const row = catalog.checks.find((c) => c.kind === 'rhyme');
        assert.deepEqual([row.lines, row.basis, row.outcome], [positions, 'class:RHYME', outcome]);
      }
      verify(await grade(good), 'pass');
      verify(await grade([...good.slice(0, -1), 'two xqzxqz']), 'unknown');
      verify(await grade([...good.slice(0, -1), 'three six']), 'fail');
      await host.reconnect();
      const revise = await host.run('lyric_revise', {
        seed,
        attempts: 0,
        max_rounds: 1,
        backtrack: 0,
      });
      verify(measured(await host.read(revise.operation_id, 'full')), 'fail');
    }
  );
}

test(
  'alternating rhyme classes stay distinct through grading and revision',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'ruthless-rhyme',
        catalog_variant: 1,
        seed_from: 11,
        count: 1,
        draw: ['lines', 'functions', 'melody', 'relation'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11]);
    const [seed] = sweep.accepted_shown;
    const planned = await host.run('lyric_plan', { seed });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    assert.deepEqual(plan.request.song_form.rhymeGroups, [
      [1, 3],
      [2, 4],
    ]);
    assert.deepEqual(plan.relations, { A: 'class:RHYME', B: 'class:RHYME' });
    const screen = measured(
      await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' })
    );
    assert.equal(screen.exit_code, 0, screen.report);
    async function grade(ends) {
      const draft = ends.map((end, i) => ['two', 'three', 'four', 'five'][i] + ' ' + end);
      const operation = await host.run('lyric_grade', { seed, draft });
      return measured(await host.read(operation.operation_id, 'full')).coverage.catalog_form;
    }
    function evidence(catalog) {
      return [
        catalog.verdict,
        ...catalog.checks.filter((c) => c.kind === 'rhyme').map((c) => c.outcome),
        catalog.checks.find((c) => c.kind === 'rhyme-distinct').outcome,
      ];
    }
    const good = await grade(['one', 'eight', 'none', 'weight']);
    assert.deepEqual(evidence(good), ['pass', 'pass', 'pass', 'pass']);
    assert.ok(
      good.checks
        .filter((c) => c.kind === 'rhyme')
        .every((c) => c.nativeOutcome === 'pass' && c.identityOutcome === 'pass')
    );
    assert.equal((await grade(['one', 'eight', 'six', 'weight'])).verdict, 'fail');
    assert.equal((await grade(['one', 'eight', 'xqzxqz', 'weight'])).verdict, 'unknown');
    const collapsed = await grade(['one', 'none', 'ton', 'sun']);
    assert.deepEqual(evidence(collapsed), ['fail', 'pass', 'pass', 'fail']);
    await host.reconnect();
    const revised = await host.run('lyric_revise', {
      seed,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    assert.deepEqual(
      evidence(measured(await host.read(revised.operation_id, 'full')).coverage.catalog_form),
      evidence(collapsed)
    );
  }
);

test(
  'fixed line returns keep separate identity and rhyme verdicts through revision',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'triolet',
        seed_from: 11,
        count: 1,
        draw: ['lines', 'functions', 'melody', 'relation'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11]);
    const [seed] = sweep.accepted_shown;
    const planned = await host.run('lyric_plan', { seed });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    assert.deepEqual(plan.request.song_form.returnGroups, [
      [1, 4, 7],
      [2, 8],
    ]);
    assert.equal(plan.returns, '1,4,7;2,8');
    assert.equal(plan.groups, '1,3,5;2,6');
    const screen = measured(
      await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' })
    );
    assert.equal(screen.exit_code, 0);
    const good = [
      'two one',
      'two ten',
      'two none',
      'two one',
      'two ton',
      'two men',
      'two one',
      'two ten',
    ];
    async function grade(draft) {
      const op = await host.run('lyric_grade', { seed, draft });
      return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
    }
    function checks(catalog, kind) {
      return catalog.checks.filter((c) => c.kind === kind).map((c) => c.outcome);
    }
    const valid = await grade(good);
    assert.equal(valid.verdict, 'pass');
    assert.deepEqual(checks(valid, 'returns'), ['pass', 'pass']);
    const drift = [...good];
    drift[6] = 'three one';
    const invalid = await grade(drift);
    assert.equal(invalid.verdict, 'fail');
    assert.deepEqual(checks(invalid, 'rhyme'), ['pass', 'pass']);
    assert.deepEqual(checks(invalid, 'returns'), ['fail', 'pass']);
    await host.reconnect();
    const revision = await host.run('lyric_revise', {
      seed,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    const revised = measured(await host.read(revision.operation_id, 'full')).coverage.catalog_form;
    assert.equal(revised.verdict, 'fail');
    assert.deepEqual(checks(revised, 'returns'), ['fail', 'pass']);
  }
);

test(
  'a stress-count setting accepts different syllable totals and regrades each line after reconnect',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'tumbling-verse',
        catalog_variant: 0,
        seed_from: 11,
        count: 1,
        draw: ['lines', 'functions', 'melody', 'relation'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11], sweep.report);
    const [seed] = sweep.accepted_shown;
    const op = await host.run('lyric_plan', { seed });
    const { plan } = measured(await host.read(op.operation_id, 'full'));
    assert.deepEqual(plan.request.song_form.lineRequirements, [
      { line: 1, stresses: 4 },
      { line: 2, stresses: 4 },
    ]);
    const screen = measured(
      await host.run('lyric_screen', {
        words: ['one', 'none'],
        relation: 'class:RHYME',
      })
    );
    assert.equal(screen.exit_code, 0);
    async function inspect(tool, args) {
      const result = await host.run(tool, args);
      const catalog = measured(await host.read(result.operation_id, 'full')).coverage.catalog_form;
      assert.equal(
        catalog.checks.some((c) => c.kind === 'syllables' || c.kind === 'stress'),
        false
      );
      return [
        catalog.verdict,
        ...catalog.checks.filter((c) => c.kind === 'stresses').map((c) => c.outcome),
      ];
    }
    const first = ['two', 'six', 'ten', 'one'].join(' ');
    const second = ['of', 'two', 'ten', 'six', 'none'].join(' ');
    assert.deepEqual(await inspect('lyric_grade', { seed, draft: [first, second] }), [
      'pass',
      'pass',
      'pass',
    ]);
    const wrong = await inspect('lyric_grade', {
      seed,
      draft: [first, second.replace('six ', 'of ')],
    });
    assert.deepEqual(wrong, ['fail', 'pass', 'fail']);
    await host.reconnect();
    assert.deepEqual(
      await inspect('lyric_revise', { seed, attempts: 0, max_rounds: 1, backtrack: 0 }),
      wrong
    );
  }
);

test(
  'a prescribed terminal pair and an internal rhyme survive session replay',
  { timeout: 180000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const selection = {
      catalog_form: 'couplet',
      catalog_variant: 1,
      relation: 'schema:internal rhyme',
      seed_from: 11,
      count: 1,
      draw: ['lines', 'functions', 'melody'],
    };
    const sweep = measured(await host.run('lyric_sweep', selection));
    assert.deepEqual(sweep.accepted_shown, [11], sweep.report);
    const seed = 11;
    const request = {
      seed,
      catalog_form: 'couplet',
      catalog_variant: 1,
      relation: selection.relation,
    };
    const op = await host.run('lyric_plan', request);
    assert.ok(!op.tool_error, JSON.stringify(op.tool_result.content));
    const { plan } = measured(await host.read(op.operation_id, 'full'));
    assert.deepEqual(plan.relations, { A: 'class:RHYME', B: 'schema:internal rhyme' });
    const positions = plan.groups
      .split(';')[1]
      .split(',')
      .map((p) => Number(p.split('.T')[1]));
    measured(
      await host.run('lyric_screen', { words: ['one', 'none'], relation: 'schema:internal rhyme' })
    );
    function check(result, internal, ending) {
      assert.equal(result.coverage.pairs_mandated, 2);
      assert.equal(result.coverage.pairs_judged, 2);
      assert.equal(result.coverage.catalog_form.verdict, ending ? 'pass' : 'fail');
      const violations = result.findings.filter((f) => f.code === 'SCHEME_VIOLATION');
      assert.deepEqual(violations.flatMap((f) => f.groups).sort(), [
        ...(ending ? [] : ['A']),
        ...(internal ? [] : ['B']),
      ]);
    }
    for (const internal of [true, false]) {
      for (const ending of [true, false]) {
        const draft = positions.map((position, i) => {
          const tokens = Array(position).fill('two');
          tokens[position - 1] = i === 0 ? 'one' : internal ? 'none' : 'three';
          tokens.push(i === 0 ? 'eight' : ending ? 'weight' : 'six');
          return tokens.join(' ');
        });
        const grade = await host.run('lyric_grade', { ...request, draft });
        assert.ok(!grade.tool_error, JSON.stringify(grade.tool_result.content));
        const result = measured(await host.read(grade.operation_id, 'full'));
        check(result, internal, ending);
      }
    }
    await host.reconnect();
    const revision = await host.run('lyric_revise', {
      ...request,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    const result = measured(await host.read(revision.operation_id, 'full'));
    check(result, false, false);
  }
);

test(
  'fixed copies keep their own internal rhyme obligations after reconnect',
  { timeout: 180000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const request = { catalog_form: 'triolet', relation: 'schema:internal rhyme' };
    const sweep = measured(
      await host.run('lyric_sweep', {
        ...request,
        seed_from: 11,
        count: 1,
        draw: ['functions', 'lines', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11], sweep.report);
    const seed = 11;
    const planned = await host.run('lyric_plan', { ...request, seed });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    assert.equal(plan.returns, '1,4,7;2,8');
    const layers = plan.groups
      .split(';')
      .slice(2)
      .map((group) => group.split(',').map((slot) => slot.split('.')));
    assert.deepEqual(
      layers.map((g) => g.map(([line]) => Number(line))),
      [
        [1, 3, 4, 5, 7],
        [2, 6, 8],
      ]
    );
    const sources = [0, 1, 2, 0, 4, 5, 0, 1];
    const endings = ['one', 'ten', 'none', '', 'ton', 'men'];
    const words = endings.map((end) => [...Array(7).fill('two'), end]);
    const vocabulary = [
      ['sun', 'run', 'done', 'fun', 'bun'],
      ['pen', 'hen', 'den'],
    ];
    const targets = [];
    for (const [group, members] of layers.entries()) {
      members.forEach(([line, place], index) => {
        if (place === 'endword') return;
        const pos = place === 'head' ? 0 : Number(place.slice(1)) - 1;
        assert.ok(Number.isInteger(pos) && pos >= 0 && pos < 7);
        const row = sources[Number(line) - 1];
        words[row][pos] = vocabulary[group][index];
        if (row === 0) targets.push(pos);
      });
    }
    measured(await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' }));
    async function grade() {
      const draft = sources.map((row) => words[row].join(' '));
      const op = await host.run('lyric_grade', { ...request, seed, draft });
      return measured(await host.read(op.operation_id, 'full'));
    }
    function inspect(result, damaged) {
      assert.equal(result.coverage.pairs_mandated, 17);
      assert.equal(result.coverage.pairs_judged, 17);
      assert.equal(result.coverage.catalog_form.verdict, 'pass');
      const broken = result.findings.filter((f) => f.code === 'SCHEME_VIOLATION');
      if (!damaged) assert.deepEqual(broken, []);
      else {
        assert.ok(broken.every((f) => f.groups.includes('C')));
        assert.ok(broken.some((f) => f.locations.every((line) => [1, 4, 7].includes(line))));
      }
    }
    inspect(await grade(), false);
    words[0][targets[0]] = 'six';
    inspect(await grade(), true);
    await host.reconnect();
    const revised = await host.run('lyric_revise', {
      ...request,
      seed,
      max_rounds: 1,
      backtrack: 0,
      attempts: 0,
    });
    inspect(measured(await host.read(revised.operation_id, 'full')), true);
  }
);

for (const example of [
  {
    id: 'rubaiyat-stanza',
    variant: 1,
    good: ['one', 'sun', 'red', 'done', 'said', 'bed', 'blue', 'fed'].map((w) => 'zero ' + w),
    change: [3, 'zero ten'],
    failedKind: 'rhyme',
    groups: '1,2,4;3,5,6,8',
  },
  ...[0, 1].map((variant) => ({
    id: 'terza-rima',
    variant,
    good: [
      'one',
      'red',
      'sun',
      'said',
      'blue',
      'bed',
      'through',
      'ten',
      'two',
      'men',
      ...(variant ? ['den'] : []),
    ].map((w) => 'zero ' + w),
    change: [9, 'zero red'],
    failedKind: 'rhyme',
    groups: '1,3;2,4,6;5,7,9;8,10' + (variant ? ',11' : ''),
  })),
  {
    id: 'traditional-ballad',
    good: ['two ten', 'two one', 'two eight', 'two sun'],
    change: [2, 'two men'],
    failedKind: 'rhyme-distinct',
    groups: '2,4',
  },
  {
    id: 'pantoum',
    good: [
      'two one',
      'three red',
      'four sun',
      'five said',
      'three red',
      'six blue',
      'five said',
      'seven through',
      'six blue',
      'four sun',
      'seven through',
      'two one',
    ],
    change: [11, 'nine one'],
    failedKind: 'returns',
    groups: '1,3;2,4;6,8',
  },
]) {
  test(
    'native catalog rhyme grading preserves the selected ' +
      example.id +
      ' variant ' +
      (example.variant ?? 0),
    { timeout: 180_000 },
    async (t) => {
      const host = await sessionHost(t);
      await host.begin();
      const sweep = measured(
        await host.run('lyric_sweep', {
          catalog_form: example.id,
          catalog_variant: example.variant ?? 0,
          seed_from: 11,
          count: 1,
          draw: ['lines', 'functions', 'melody', 'relation'],
        })
      );
      assert.deepEqual(sweep.accepted_shown, [11]);
      const op = await host.run('lyric_plan', { seed: 11 });
      const { plan } = measured(await host.read(op.operation_id, 'full'));
      assert.equal(plan.groups, example.groups);
      const screen = measured(
        await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' })
      );
      assert.equal(screen.exit_code, 0, screen.report);
      async function grade(draft) {
        const run = await host.run('lyric_grade', { seed: 11, draft });
        const receipt = measured(run);
        assert.equal(receipt.measurement_status, 'graded', JSON.stringify(receipt));
        return measured(await host.read(run.operation_id, 'full')).coverage.catalog_form;
      }
      const good = await grade(example.good);
      assert.equal(
        good.verdict,
        'pass',
        JSON.stringify(good.checks.filter((c) => c.outcome !== 'pass'))
      );
      const wrong = [...example.good];
      wrong[example.change[0]] = example.change[1];
      const bad = await grade(wrong);
      assert.equal(bad.verdict, 'fail');
      assert.ok(bad.checks.some((c) => c.kind === example.failedKind && c.outcome === 'fail'));
    }
  );
}

test(
  'Street cry keeps its printed call, and an altered return fails on the exact line',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const relation = 'class:RHYME';
    const sweep = measured(
      await host.run('lyric_sweep', {
        seed_from: 11,
        count: 1,
        catalog_form: 'street-cry',
        catalog_variant: 1,
        catalog_counts: [{ path: '1.1', count: 2 }],
        lines: 4,
        relation,
        draw: ['functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11], sweep.report);
    const seed = sweep.accepted_shown[0];
    const op = await host.run('lyric_plan', { seed, lines: 4, relation });
    const found = measured(await host.read(op.operation_id, 'full'));
    assert.deepEqual(
      found.plan.sections.map((s) => [s.source_role, s.function]),
      [
        ['call', 'chorus'],
        ['call', 'chorus'],
      ]
    );
    assert.equal(found.plan.returns, '1,3;2,4');
    assert.match(op.tool_result.content[0].text, /\[CALL — 2 lines/);
    assert.equal(
      measured(await host.run('lyric_screen', { words: ['one', 'four'], relation })).exit_code,
      0
    );
    const draft = ['one two', 'three four', 'one two', 'three four'];
    async function grade(lines) {
      const result = await host.run('lyric_grade', { seed, draft: lines });
      return measured(await host.read(result.operation_id, 'full'));
    }
    const matching = await grade(draft);
    assert.equal(matching.coverage.catalog_form.verdict, 'pass');
    assert.equal(matching.coverage.catalog_form.sectionArrangement.writingFunction, 'chorus');
    const changed = [...draft];
    changed[2] = 'five two';
    const broken = await grade(changed);
    assert.equal(broken.exit_code, 3, broken.report);
    assert.equal(broken.coverage.catalog_form.verdict, 'fail');
    assert.ok(
      broken.coverage.catalog_form.checks.some(
        (c) =>
          c.kind === 'section-text-return' && c.outcome === 'fail' && c.lines.join(',') === '1,3'
      )
    );
  }
);

test(
  'an unrhymed quatern enforces its travelling return through grade and revision',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'quatern',
        seed_from: 11,
        count: 1,
        relation: 'class:RHYME',
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [11]);
    const planned = await host.run('lyric_plan', { seed: 11, relation: 'class:RHYME' });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    assert.deepEqual(plan.request.song_form.rhymeGroups, []);
    assert.deepEqual(plan.request.song_form.returnGroups, [[1, 6, 11, 16]]);
    assert.equal(plan.returns, '1,6,11,16');
    async function check(verb, args) {
      const result = await host.run(verb, args);
      const summary = measured(result);
      assert.ok(
        !summary.stderr && !summary.refusal,
        JSON.stringify({
          exit: summary.exit_code,
          error: summary.stderr,
          refusal: summary.refusal,
          report: summary.report?.slice(-1600),
        })
      );
      return measured(await host.read(result.operation_id, 'full')).coverage.catalog_form;
    }
    const screen = measured(
      await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' })
    );
    assert.equal(screen.exit_code, 0, JSON.stringify(screen));
    const text =
      'one two three four five six seven eight nine ten eleven twelve red blue green white'
        .split(' ')
        .map((number) => 'two ' + number);
    for (const i of [5, 10, 15]) text[i] = text[0];
    const good = await check('lyric_grade', { seed: 11, relation: 'class:RHYME', draft: text });
    assert.equal(good.verdict, 'pass');
    text[10] = 'three ten';
    const drift = await check('lyric_grade', { seed: 11, relation: 'class:RHYME', draft: text });
    assert.equal(drift.verdict, 'fail');
    assert.equal(drift.checks.find((c) => c.kind === 'returns').outcome, 'fail');
    await host.reconnect();
    const revised = await check('lyric_revise', {
      seed: 11,
      relation: 'class:RHYME',
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    assert.equal(revised.checks.find((c) => c.kind === 'returns').outcome, 'fail');
  }
);
const barVariants = [
  { id: '16-bar-blues', variant: 1, bars: [16], lines: 4 },
  ...[8, 12, 16, 24].map((verse, variant) => ({
    id: 'hip-hop-verse-hook',
    variant,
    bars: [verse, 8, verse, 8],
    lines: (2 * verse + 16) / 4,
    counts: [
      { path: '1.1', count: 0 },
      { path: '1.2', count: 2 },
      { path: '1.3', count: 0 },
    ],
  })),
  ...[8, 8, 16, 16].map((bars, variant) => ({
    id: 'edm-build-drop',
    variant,
    bars: Array(8).fill(bars),
    lines: 16,
  })),
];
for (const { id, variant, bars, lines, counts } of barVariants) {
  test(
    `declared bar proof for ${id} variant ${variant} survives reconnect and rejects wrong measurements`,
    { timeout: 240_000 },
    async (t) => {
      const host = await sessionHost(t);
      await host.begin();
      const relation = 'class:RHYME';
      const selector = {
        catalog_form: id,
        catalog_variant: variant,
        ...(counts && { catalog_counts: counts }),
      };
      const seed = 11;
      const sweep = measured(
        await host.run('lyric_sweep', {
          ...selector,
          seed_from: seed,
          count: 1,
          lines,
          relation,
          draw: ['functions', 'melody'],
        })
      );
      assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
      const op = await host.run('lyric_plan', { seed, lines, relation });
      const { plan, plan_sha256: digest } = measured(await host.read(op.operation_id, 'full'));
      assert.deepEqual(
        plan.sections.map((s) => s.bars),
        bars
      );
      assert.equal(plan.total_lines, lines);
      const labels = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
      const draft = Array.from({ length: lines }, (_, i) =>
        [labels[i % 8], labels[(i + 2) % 8], labels[(i + 1) % 8]].join(' ')
      );
      const screen = measured(
        await host.run('lyric_screen', { words: labels.slice(0, 2), relation })
      );
      assert.equal(screen.exit_code, 0, screen.report);
      function assertBars(catalog, failedIndex = -1) {
        assert.equal(catalog?.id, id);
        assert.equal(catalog.variant, variant);
        const checks = catalog.checks.filter((c) => c.kind === 'bars');
        assert.deepEqual(
          checks.map((c) => c.expected),
          bars
        );
        assert.deepEqual(
          checks.map((c) => c.outcome),
          bars.map((_, i) => (i === failedIndex ? 'fail' : 'pass'))
        );
        assert.equal(catalog.verdict, failedIndex < 0 ? 'pass' : 'fail', JSON.stringify(catalog));
      }
      const graded = await host.run('lyric_grade', { seed, draft });
      const receipt = measured(await host.read(graded.operation_id, 'full'));
      assert.equal(receipt.plan_sha256, digest);
      assertBars(receipt.coverage.catalog_form);
      await host.reconnect();
      const reviseArgs = { seed, max_rounds: 1, attempts: 0, backtrack: 0 };
      const revised = await host.run('lyric_revise', reviseArgs);
      const result = measured(await host.read(revised.operation_id, 'full'));
      assertBars(result.coverage.catalog_form);
      const replay = await host.call('lyric_revise', {
        session_id: revised.predecessor,
        ...reviseArgs,
      });
      assert.equal(replay.operation_id, revised.operation_id);

      // A seeded writer owns its immutable score. The edit tool accepts an
      // independently submitted score, so it can measure a musician's alteration.
      const bp = {
        sections: structuredClone(plan.sections),
        lines: plan.line_slots.map(({ line, bar, beat, duration, section }) => ({
          text: draft[line - 1],
          bar,
          beat,
          duration,
          section,
        })),
      };
      await host.begin('edit');
      const edit = async () => {
        const checked = await host.run('lyric_check', {
          ...selector,
          lines: draft,
          groups: '1,2',
          relation,
          blueprint: JSON.stringify(bp),
          subdivision: plan.choices.subdivision,
        });
        assert.ok(!checked.tool_error, JSON.stringify(checked.tool_result.content));
        return measured(await host.read(checked.operation_id, 'full'));
      };
      assertBars((await edit()).coverage.catalog_form);
      bp.sections.at(-1).bars += 1;
      const wrong = await edit();
      assert.equal(wrong.exit_code, 3, wrong.report);
      assertBars(wrong.coverage.catalog_form, bars.length - 1);
      t.diagnostic(
        JSON.stringify({
          id,
          variant,
          seed,
          lines,
          bars,
          plan_sha256: digest,
          grade: receipt.exit_code,
          revision: result.exit_code,
          wrong_score: wrong.exit_code,
          wrong_section: bars.length,
          replay: true,
        })
      );
    }
  );
}

test(
  'Lai retains nested spans, measured lengths and rhyme classes after reconnect',
  { timeout: 180_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const seed = 11;
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'lai',
        catalog_variant: 0,
        seed_from: seed,
        count: 1,
        draw: ['lines', 'functions', 'melody', 'relation'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const operation = await host.run('lyric_plan', { seed });
    const { plan } = measured(await host.read(operation.operation_id, 'full'));
    const contract = plan.request.song_form;
    assert.deepEqual(
      contract.sections.map((s) => s.lines),
      [3, 3, 3]
    );
    assert.deepEqual(contract.rhymeGroups, [
      [1, 2, 4, 5, 7, 8],
      [3, 6, 9],
    ]);
    const lengths = [5, 5, 2, 5, 5, 2, 5, 5, 2];
    assert.deepEqual(
      contract.lineRequirements.map((line) => line.syllables),
      lengths
    );
    measured(await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' }));
    const ends = ['one', 'none', 'two', 'ton', 'sun', 'blue', 'fun', 'run', 'through'];
    const draft = ends.map((end, i) => [...Array(lengths[i] - 1).fill('ten'), end].join(' '));
    async function coverage(name, args) {
      const run = await host.run(name, { seed, ...args });
      return measured(await host.read(run.operation_id, 'full')).coverage.catalog_form;
    }
    const good = await coverage('lyric_grade', { draft });
    assert.equal(
      good.verdict,
      'pass',
      JSON.stringify(good.checks.filter((c) => c.outcome !== 'pass'))
    );
    assert.deepEqual(
      good.checks.filter((c) => c.kind === 'line-span').map((c) => c.expected),
      [
        [0, 3],
        [3, 6],
        [6, 9],
      ]
    );
    const wrong = [...draft];
    wrong[2] = 'six';
    function verifyFailure(form) {
      assert.equal(form.verdict, 'fail');
      for (const kind of ['syllables', 'rhyme'])
        assert.ok(
          form.checks.some((c) => c.kind === kind && c.outcome === 'fail'),
          kind
        );
    }
    verifyFailure(await coverage('lyric_grade', { draft: wrong }));
    await host.reconnect();
    verifyFailure(await coverage('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 }));
  }
);

test(
  'linked sonnet boundaries survive grading and reconnect before revision',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const seed = 1;
    const relation = 'class:RHYME';
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'crown-of-sonnets',
        seed_from: seed,
        count: 1,
        relation,
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const planned = await host.run('lyric_plan', { seed, relation });
    const { plan } = measured(await host.read(planned.operation_id, 'full'));
    assert.equal(plan.total_lines, 98);
    assert.equal(plan.request.song_form.returnGroups.length, 7);
    const screen = measured(await host.run('lyric_screen', { words: ['one', 'none'], relation }));
    assert.equal(screen.exit_code, 0, JSON.stringify(screen));
    const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    const draft = Array.from({ length: 98 }, (_, i) =>
      [units[Math.floor(i / 49)], units[Math.floor(i / 7) % 7], units[i % 7]].join(' ')
    );
    for (let i = 0; i < 7; i++) draft[14 * i] = draft[14 * ((i + 6) % 7) + 13] = units[i];
    async function coverage(verb, args) {
      const receipt = await host.run(verb, { seed, relation, ...args });
      const report = measured(await host.read(receipt.operation_id, 'full'));
      assert.ok(report.coverage?.catalog_form, JSON.stringify([report.refusal, report.stderr]));
      return report.coverage.catalog_form;
    }
    assert.equal((await coverage('lyric_grade', { draft })).verdict, 'pass');
    draft[97] = 'eight';
    const graded = await coverage('lyric_grade', { draft });
    await host.reconnect();
    const revised = await coverage('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 });
    for (const checked of [graded, revised]) {
      assert.equal(checked.verdict, 'fail');
      assert.ok(checked.checks.some((c) => c.kind === 'returns' && c.outcome === 'fail'));
    }
  }
);

for (const [id, variant, partition, scheme] of [
  ['madrigal', 0, [6, 1], null],
  ['bob-and-wheel', 1, [8, 3], 'ababababcbc'],
  ['bob-and-wheel', 2, [8, 3], 'ababababcac'],
  ['bob-and-wheel', 3, [8, 5], 'ababababcdddc'],
]) {
  test(
    `nested closing division survives reconnect: ${id} ${variant}`,
    { timeout: 240_000 },
    async (t) => {
      const host = await sessionHost(t);
      await host.begin();
      const seed = 11;
      const sweep = measured(
        await host.run('lyric_sweep', {
          catalog_form: id,
          catalog_variant: variant,
          seed_from: seed,
          count: 1,
          ...(scheme
            ? {}
            : { catalog_counts: [{ path: '1.1.1', count: 5 }], relation: 'class:RHYME' }),
          draw: scheme
            ? ['lines', 'functions', 'melody', 'relation']
            : ['lines', 'functions', 'melody'],
        })
      );
      assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
      const op = await host.run('lyric_plan', {
        seed,
        ...(scheme ? {} : { relation: 'class:RHYME' }),
      });
      const { plan } = measured(await host.read(op.operation_id, 'full'));
      assert.deepEqual(
        plan.request.song_form.sections.map((s) => s.lines),
        partition
      );
      measured(await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' }));
      const ends = {
        a: ['one', 'none', 'ton', 'sun', 'run'],
        b: ['two', 'blue', 'through', 'true', 'shoe'],
        c: ['ten', 'pen'],
        d: ['six', 'mix', 'fix'],
      };
      const draft = scheme
        ? [...scheme].map((k) => 'six ' + ends[k].shift())
        : ['one', 'two', 'three', 'four', 'five', 'six', 'six'].map((x) => 'ten ' + x);
      async function measure(name, args) {
        const op = await host.run(name, {
          seed,
          ...(scheme ? {} : { relation: 'class:RHYME' }),
          ...args,
        });
        const status = measured(op);
        if (name === 'lyric_grade')
          assert.equal(status.measurement_status, 'graded', JSON.stringify(status));
        return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
      }
      const good = await measure('lyric_grade', { draft });
      assert.equal(
        good.verdict,
        'pass',
        JSON.stringify(good.checks.filter((c) => c.outcome !== 'pass'))
      );
      assert.ok(good.checks.some((c) => c.kind === 'line-span' && c.outcome === 'pass'));
      const wrong = [...draft];
      wrong[wrong.length - 1] = 'ten six';
      if (!scheme) wrong[wrong.length - 1] = 'ten four';
      function mismatch(form) {
        assert.equal(form.verdict, 'fail');
        assert.ok(
          form.checks.some((c) => c.kind === (scheme ? 'rhyme' : 'returns') && c.outcome === 'fail')
        );
      }
      mismatch(await measure('lyric_grade', { draft: wrong }));
      await host.reconnect();
      mismatch(await measure('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 }));
    }
  );
}

test(
  'Virelai measures the two relative lengths and the cross-stanza rhyme independently',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const seed = 11;
    const sweep = measured(
      await host.run('lyric_sweep', {
        catalog_form: 'virelai',
        catalog_variant: 0,
        seed_from: seed,
        count: 1,
        draw: ['lines', 'functions', 'melody', 'relation'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const op = await host.run('lyric_plan', { seed });
    const { plan } = measured(await host.read(op.operation_id, 'full'));
    assert.deepEqual(plan.request.song_form.lineRequirements, [
      { line: 2, shorterThan: 1 },
      { line: 4, shorterThan: 3 },
    ]);
    assert.deepEqual(plan.request.song_form.rhymeGroups, [[1], [2, 3], [4]]);
    measured(await host.run('lyric_screen', { words: ['one', 'none'], relation: 'class:RHYME' }));
    async function grade(name, args) {
      const op = await host.run(name, { seed, ...args });
      return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
    }
    const draft = ['ten ten six', 'ten one', 'ten ten none', 'ten two'];
    const good = await grade('lyric_grade', { draft });
    assert.equal(
      good.verdict,
      'pass',
      JSON.stringify(good.checks.filter((c) => c.outcome !== 'pass'))
    );
    const bad = await grade('lyric_grade', {
      draft: [draft[0], 'ten ten one', draft[2], draft[3]],
    });
    function drift(form) {
      assert.equal(form.verdict, 'fail');
      assert.ok(
        form.checks.some(
          (c) =>
            c.kind === 'role' && c.basis === 'relative sung syllable counts' && c.outcome === 'fail'
        )
      );
      assert.ok(form.checks.some((c) => c.kind === 'rhyme' && c.outcome === 'pass'));
    }
    drift(bad);
    await host.reconnect();
    drift(await grade('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 }));
  }
);

const vocalCases = [
  { id: 'posse-cut', duties: ['distinct-solo', 'distinct-solo'] },
  { id: 'part-song-victorian', duties: ['ensemble', 'ensemble'] },
  { id: 'responsorial-psalm', variant: 1, duties: ['cantor', 'cantor'] },
  { id: 'verse-anthem', duties: ['solo', 'full', 'solo', 'full'] },
  { id: 'consort-song', duties: ['solo', 'solo', 'reprise'] },
];
for (const { id, variant = 0, duties } of vocalCases) {
  test('written vocal assignments for ' + id, { timeout: 240_000 }, async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const selection = {
      catalog_form: id,
      catalog_variant: variant,
      catalog_counts: [{ path: '1.1', count: 2 }],
    };
    const lines = duties.length * 2;
    const relation = 'class:RHYME';
    const sweep = measured(
      await host.run('lyric_sweep', {
        ...selection,
        seed_from: 11,
        count: 4,
        lines,
        relation,
        draw: ['functions', 'melody'],
      })
    );
    assert.ok(sweep.accepted_shown, JSON.stringify(sweep));
    const seed = sweep.accepted_shown[0];
    assert.ok(Number.isInteger(seed), sweep.report);
    const op = await host.run('lyric_plan', { seed, lines, relation });
    const { plan } = measured(await host.read(op.operation_id, 'full'));
    assert.deepEqual(
      plan.request.song_form.sections.map((s) => s.vocalDuty),
      duties
    );
    const draft = Array.from({ length: lines }, (_, i) => ['one', 'two', 'three', 'four'][i % 4]);
    const width = plan.line_slots.filter(
      (slot) => slot.section === plan.sections.at(-1).name
    ).length;
    if (duties.at(-1) === 'reprise') {
      for (let i = lines - width; i < lines; i++) draft[i] = draft[i - width];
      for (let n = lines - width + 1; n <= lines; n++)
        assert.ok(plan.returns.split(';').includes([n - width, n].join(',')), plan.returns);
    }
    measured(await host.run('lyric_screen', { words: ['one', 'two'], relation }));
    async function check(tool, args) {
      const op = await host.run(tool, args);
      return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
    }
    function verdict(result, expected) {
      assert.equal(
        result.verdict,
        expected,
        JSON.stringify(result.checks.filter((c) => c.outcome !== 'pass'))
      );
    }
    verdict(await check('lyric_grade', { seed, draft }), 'pass');
    await host.reconnect();
    verdict(
      await check('lyric_revise', { seed, attempts: 0, backtrack: 0, max_rounds: 1 }),
      'pass'
    );
    await host.begin('edit');
    const bp = {
      vocal_roster: [...plan.vocal_roster],
      sections: structuredClone(plan.sections),
      lines: plan.line_slots.map(({ line, bar, beat, duration, section }) => ({
        text: draft[line - 1],
        bar,
        beat,
        duration,
        section,
      })),
    };
    const edit = () =>
      check('lyric_check', {
        ...selection,
        lines: bp.lines.map((s) => s.text),
        groups: '1,2',
        relation,
        subdivision: plan.choices.subdivision,
        blueprint: JSON.stringify(bp),
      });
    // Submitted scores use arbitrary IDs, independent of the writer's chosen names.
    bp.vocal_roster = bp.vocal_roster.map((p) => 'x-' + p);
    if (plan.choir_roster) bp.choir_roster = plan.choir_roster.map((p) => 'x-' + p);
    for (const s of bp.sections) s.performers = s.performers.map((p) => 'x-' + p);
    verdict(await edit(), 'pass');
    const observed = bp.sections.at(-1),
      correct = observed.performers;
    delete observed.performers;
    verdict(await edit(), 'unknown');
    observed.performers = ['outside'];
    verdict(await edit(), 'fail');
    if (duties.at(-1) === 'cantor') bp.vocal_roster.push('other');
    observed.performers = duties.at(-1) === 'cantor' ? ['other'] : [bp.sections[0].performers[0]];
    verdict(await edit(), 'fail');
    observed.performers = correct;
    if (duties.at(-1) === 'reprise') {
      bp.lines.at(-1).text = 'ten';
      const result = await edit();
      verdict(result, 'fail');
      assert.ok(result.checks.some((c) => c.kind === 'reprise-line' && c.outcome === 'fail'));
    }
  });
}

for (const [id, variant, widths, scheme, partition] of [
  ['cyhydedd-hir', 0, [5, 5, 5, 4], 'aaab', [4]],
  ['rhupunt', 0, Array(6).fill(4), 'aabccb', [3, 3]],
  ['rhupunt', 1, Array(8).fill(4), 'aaabcccb', [4, 4]],
]) {
  test(
    `measured phrase boundaries survive grade and reconnect for ${id} ${variant}`,
    { timeout: 240_000 },
    async (t) => {
      const host = await sessionHost(t);
      await host.begin();
      const seed = 11,
        relation = 'class:RHYME';
      const sweep = measured(
        await host.run('lyric_sweep', {
          catalog_form: id,
          catalog_variant: variant,
          seed_from: seed,
          count: 1,
          relation,
          draw: ['lines', 'functions', 'melody'],
        })
      );
      assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
      const op = await host.run('lyric_plan', { seed, relation });
      const { plan } = measured(await host.read(op.operation_id, 'full'));
      assert.equal(plan.request.song_form.phraseLines, true);
      assert.deepEqual(
        plan.request.song_form.sections.map((s) => s.lines),
        partition
      );
      assert.deepEqual(
        plan.request.song_form.lineRequirements.map((l) => l.syllables),
        widths
      );
      measured(await host.run('lyric_screen', { words: ['one', 'none'], relation }));
      const ends = { a: ['one', 'none', 'ton'], b: ['two', 'blue'], c: ['ten', 'pen', 'hen'] };
      const draft = [...scheme].map((key, i) =>
        [...Array(widths[i] - 1).fill('six'), ends[key].shift()].join(' ')
      );
      async function measure(verb, args) {
        const op = await host.run(verb, { seed, relation, ...args });
        const raw = measured(op);
        if (verb === 'lyric_grade')
          assert.equal(raw.measurement_status, 'graded', JSON.stringify(raw));
        return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
      }
      const good = await measure('lyric_grade', { draft });
      assert.equal(
        good.verdict,
        'pass',
        JSON.stringify(good.checks.filter((c) => c.outcome !== 'pass'))
      );
      assert.equal(good.arrangement, 'one-printed-line-per-phrase');
      const wrong = [...draft];
      wrong[0] = 'six fix';
      const verify = (form) => {
        assert.equal(form.verdict, 'fail');
        for (const k of ['rhyme', 'syllables'])
          assert.ok(
            form.checks.some((c) => c.kind === k && c.outcome === 'fail'),
            k
          );
      };
      verify(await measure('lyric_grade', { draft: wrong }));
      await host.reconnect();
      verify(await measure('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 }));
    }
  );
}

test(
  'regular hymn meter survives registered grading, reconnect and revision',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const seed = 11;
    const lines = 8;
    const relation = 'class:RHYME';
    const selection = {
      catalog_form: 'hymn-with-refrain',
      catalog_variant: 0,
      catalog_counts: [{ path: '1.1', count: 2 }],
    };
    const sweep = measured(
      await host.run('lyric_sweep', {
        ...selection,
        seed_from: seed,
        count: 1,
        lines,
        relation,
        draw: ['functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const planned = await host.run('lyric_plan', { seed, lines, relation });
    const { plan, plan_sha256 } = measured(await host.read(planned.operation_id, 'full'));
    assert.equal(plan.request.song_form.id, selection.catalog_form);
    assert.deepEqual(
      plan.sections.map((s) => s.function),
      ['verse', 'refrain', 'verse', 'refrain']
    );
    assert.equal(plan.total_lines, lines);
    const draft = ['a b c', 'd e f', 'x y', 'y z', 'a d e', 'g h j', 'x y', 'y z'];
    const screened = measured(await host.run('lyric_screen', { words: ['x', 'y'], relation }));
    assert.equal(screened.exit_code, 0, screened.report);
    async function grade(tool, args) {
      const operation = await host.run(tool, { seed, ...args });
      const result = measured(await host.read(operation.operation_id, 'full'));
      if (tool === 'lyric_grade') assert.equal(result.plan_sha256, plan_sha256);
      const form = result.coverage.catalog_form;
      assert.equal(form.id, selection.catalog_form);
      return form;
    }
    const matching = await grade('lyric_grade', { draft });
    assert.equal(
      matching.verdict,
      'pass',
      JSON.stringify(matching.checks.filter((c) => c.outcome !== 'pass'))
    );
    assert.ok(
      matching.checks.some((c) => c.kind === 'recurring-stanza-meter' && c.outcome === 'pass')
    );
    draft[4] = 'a d';
    const changed = await grade('lyric_grade', { draft });
    await host.reconnect();
    const revised = await grade('lyric_revise', { attempts: 0, backtrack: 0, max_rounds: 1 });
    assert.deepEqual(revised, changed);
    for (const form of [changed, revised]) {
      assert.equal(form.verdict, 'fail');
      assert.deepEqual(
        form.checks.filter((c) => c.outcome !== 'pass').map((c) => c.kind),
        ['recurring-stanza-meter']
      );
      assert.ok(form.checks.some((c) => c.kind === 'verbatim-refrain' && c.outcome === 'pass'));
    }
  }
);

test(
  'pasted rondo sections keep lyrical variation separate from musical return through revision',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin('edit');
    const draft = ['a b c', 'x y', 'a b c', 'y z', 'a b d', 'x z', 'a b c'];
    const parts = ['a', 'b', 'a', 'c', 'a', 'b', 'a'];
    const bp = {
      sections: parts.map((letter, i) => ({
        name: 's' + i,
        function: 'verse',
        source_role: 'part-' + letter,
        bars: 1,
        meter: { beats: 4, unit: 4 },
      })),
      lines: draft.map((text, i) => ({ text, section: 's' + i, bar: i + 1, beat: 1, duration: 4 })),
    };
    const args = {
      catalog_form: 'rondo',
      catalog_variant: 1,
      groups: '1,2',
      relation: 'class:RHYME',
      blueprint: JSON.stringify(bp),
      subdivision: 1,
    };
    async function read(tool, params) {
      const op = await host.run(tool, params);
      const receipt = measured(op);
      assert.notEqual(receipt.measurement_status, 'refused', JSON.stringify(receipt));
      return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
    }
    const score = await read('lyric_check', { ...args, lines: draft });
    assert.equal(score.verdict, 'unknown');
    assert.deepEqual(
      score.checks.filter((c) => c.kind === 'role').map((c) => c.outcome),
      Array(7).fill('pass')
    );
    assert.deepEqual(
      score.checks.filter((c) => c.kind === 'musical-return').map((c) => c.sections),
      [
        [1, 3, 5, 7],
        [2, 6],
      ]
    );
    assert.deepEqual(
      score.lyricalReturns.map((r) => [r.sections, r.classification]),
      [
        [[1, 3], 'VERBATIM'],
        [[1, 5], 'LEXICAL_VARIATION'],
        [[2, 6], 'LEXICAL_VARIATION'],
        [[1, 7], 'VERBATIM'],
      ]
    );
    await host.reconnect();
    const revision = await read('lyric_revise', {
      ...args,
      draft,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    });
    assert.deepEqual(revision, score);
  }
);

test(
  'seeded triadic writing keeps physical rows through grade and revision',
  { timeout: 240_000 },
  async (t) => {
    const host = await sessionHost(t);
    await host.begin();
    const seed = 11,
      relation = 'class:RHYME';
    const choice = { catalog_form: 'triadic-line', catalog_counts: [{ path: '1.1', count: 2 }] };
    const sweep = measured(
      await host.run('lyric_sweep', {
        ...choice,
        seed_from: seed,
        count: 1,
        relation,
        draw: ['lines', 'functions', 'melody'],
      })
    );
    assert.deepEqual(sweep.accepted_shown, [seed], sweep.report);
    const op = await host.run('lyric_plan', { seed, relation });
    const { plan } = measured(await host.read(op.operation_id, 'full'));
    assert.equal(plan.total_lines, 6);
    assert.deepEqual(plan.request.song_form.printedSteps, [3, 3]);
    assert.equal(plan.sections.length, 1);
    assert.match(plan.writer_brief, /Rows per logical line, in order: 3, 3/);
    measured(await host.run('lyric_screen', { words: ['one', 'none'], relation }));
    const rows = ['one', ' two', '   three', '  four', '    five', '     six'];
    async function measure(verb, args) {
      const op = await host.run(verb, { seed, relation, ...args });
      return measured(await host.read(op.operation_id, 'full')).coverage.catalog_form;
    }
    const good = await measure('lyric_grade', { draft_text: rows.join('\r\n') });
    assert.equal(good.verdict, 'pass', JSON.stringify(good));
    assert.deepEqual(
      good.checks.map((c) => c.outcome),
      ['pass', 'pass', 'pass']
    );
    const wrong = [...rows];
    wrong[5] = wrong[5].trimStart();
    const bad = await measure('lyric_grade', { draft: wrong });
    assert.deepEqual(
      bad.checks.map((c) => c.outcome),
      ['pass', 'pass', 'fail']
    );
    await host.reconnect();
    const revised = await measure('lyric_revise', { attempts: 0, max_rounds: 1, backtrack: 0 });
    assert.equal(revised.verdict, 'fail');
    assert.deepEqual(revised.checks, bad.checks);
  }
);
