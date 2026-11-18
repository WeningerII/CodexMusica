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
