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
    async begin() {
      sessionId = (await call('begin_lyrics', { phase: 'create' })).session_id;
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
    [{ catalog_form: 'triolet' }, /unsupported/i],
    [{ catalog_form: 'couplet', catalog_variant: 1 }, /named.role|unsupported/i],
    [{ catalog_form: 'quatern' }, /named.role|unsupported/i],
    [{ catalog_form: 'monostich' }, /native-line-limit|no-inspectable-native-pair/],
    [{ catalog_form: 'cherita' }, /inconsistent-recurring-section-length/],
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
