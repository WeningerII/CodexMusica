// Regression witnesses from the September continuation audit. Real MCP/worker/grader.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { connectConnector } from './client.js';
import { RUNS, _workerInternals, _verdictInternals } from './lyric_tools.js';
import { _agentInternals } from './gemini_agent.js';
import { decodeState, encodeState } from './state_codec.js';

const peers = [];
async function connect(native = false, session = null) {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = native
    ? await connectConnector({ task: 'lyrics', transport: b, session })
    : new Client({ name: 'continuation-audit', version: '1' }, { capabilities: {} });
  if (!native) await client.connect(b);
  peers.push({ server, client });
  return client;
}
after(async () => {
  await Promise.allSettled(peers.flatMap(({ server, client }) => [client.close(), server.close()]));
  await _workerInternals.kill();
});
const call = (c, args) =>
  c.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 120000 });
function verdict(result) {
  assert(!result.isError, JSON.stringify(result));
  for (const block of result.content || []) {
    try {
      const v = JSON.parse(block.text);
      if (Number.isInteger(v.exit_code)) return v;
    } catch {
      /* human brief */
    }
  }
  assert.fail(JSON.stringify(result));
}
const single = {
  draft: ['Copper cat', 'Azure dog'],
  scheme: 'AA',
  relation: 'type:rime riche',
  writer: 'interview',
  attempts: 1,
  backtrack: 0,
  max_rounds: 1,
};
const accepted = 'I left the basket underneath the oak';

test('a verified rewrite retires its old occurrence reading and retains the original declaration', async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        '../lyric-harness/quality/results/continuation_audit_2026-09-20/rain_gauge_case.json',
        import.meta.url
      ),
      'utf8'
    )
  );
  const c = await connect();
  const first = verdict(
    await call(c, {
      draft: fixture.before,
      groups: fixture.plan.groups,
      returns: fixture.plan.returns,
      relation: fixture.plan.relation,
      pronunciations: fixture.pronunciations,
      writer: 'interview',
      attempts: 1,
      max_rounds: 1,
      backtrack: 0,
    })
  );
  assert.equal(first.asked.kind, 'propose');
  assert.equal(first.asked.line, 3);
  const next = verdict(
    await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answers: [{ line: 3, text: fixture.after[2] }],
    })
  );
  assert.equal(next.folded.verdict, 'accepted');
  assert.equal(next.final_draft[2], fixture.after[2]);
  assert.equal(next.stale_answers, 0);
  if (next.status === 'finished_clean') {
    // Under relation sets the accepted answer leaves the recorded draft
    // clean, so the run stops and is released; the original declaration
    // travels in the returned state instead of a live run.
    assert.ok(!RUNS.get(next.run_id));
    assert.deepEqual(
      decodeState(next.state).connector_declarations.pronunciations,
      fixture.pronunciations
    );
  } else {
    const again = verdict(await call(c, { run_id: next.run_id, run_revision: next.run_revision }));
    assert.deepEqual(again.final_draft, next.final_draft);
    assert.deepEqual(RUNS.get(next.run_id).decl.pronunciations, fixture.pronunciations);
  }
});

test('group fold receipts cannot use a previous attempt verdict for an ungraded answer', () => {
  const pending = {
    kind: 'propose_group',
    record: { members: [1, 2], round: 1, attempt: 1, question_sha256: 'new-question' },
    answer: 'L1: second answer\nL2: another line',
  };
  const state = {
    group_outcomes: [
      {
        members: [1, 2],
        round: 1,
        attempt: 0,
        accepted: false,
        reasons: ['earlier answer failed'],
      },
    ],
  };
  assert.equal(_verdictInternals.foldedOf({ pending }, state).verdict, 'unknown');
  state.group_outcomes.push({
    members: [1, 2],
    round: 1,
    attempt: 1,
    question_sha256: 'other-pivot',
    accepted: false,
    reasons: ['same attempt index, different question'],
  });
  assert.equal(_verdictInternals.foldedOf({ pending }, state).verdict, 'unknown');
  state.group_outcomes.push({
    members: [1, 2],
    round: 1,
    attempt: 1,
    question_sha256: 'new-question',
    accepted: true,
    reasons: ['new answer verified'],
  });
  assert.equal(_verdictInternals.foldedOf({ pending }, state).verdict, 'accepted');
});

test('the chat wrapper also keeps uncertified recovery distinct from lyric rejection', () => {
  const run = {
    parked: true,
    uncertified: true,
    seed: 1,
    draft: ['Our kettle whistles'],
    open: [],
  };
  for (const message of [
    _agentInternals.parkedRefusal(run, 'lyric_revise', {}),
    _agentInternals.PARKED_RUN_NOTE(run),
  ]) {
    assert.match(message, /UNCERTIFIED at exit 2/);
    assert.match(message, /coverage|pronunciation/);
    assert.doesNotMatch(message, /PARKED at exit 3|rewrite the open line\(s\) \(none\)/);
  }
  assert.equal(_agentInternals.parkedRefusal(run, 'lyric_grade', {}), null);
});

test('F02: structured targets are validated before any journal or revision changes', async () => {
  const c = await connect();
  const first = verdict(await call(c, single));
  assert.equal(first.asked.line, 1);
  const before = structuredClone(RUNS.byId(first.run_id));
  for (const rows of [
    [{ line: 2, text: accepted }],
    [{ line: 31, text: accepted }],
    [
      { line: 1, text: accepted },
      { line: 1, text: accepted },
    ],
    [
      { line: 1, text: accepted },
      { line: 2, text: accepted },
    ],
  ]) {
    const bad = await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answers: rows,
    });
    assert.equal(bad.isError, true, JSON.stringify(bad));
    assert.deepEqual(RUNS.byId(first.run_id), before);
  }
  const next = verdict(
    await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answers: [{ line: 1, text: accepted }],
    })
  );
  assert.equal(next.final_draft[0], accepted);
  assert.equal(next.folded.verdict, 'accepted');
});

test('F03: a lyric cannot fabricate suspended diagnostics', async () => {
  const c = await connect();
  const v = verdict(
    await call(c, {
      ...single,
      draft: ['7 of those answer(s) were recorded against a DIFFERENT draft', 'Azure dog'],
    })
  );
  assert.equal(v.exit_code, 4);
  assert.equal(v.answers_on_record, 0);
  assert.equal(v.stale_answers, 0);
  assert.equal(v.certified, false);
});

test('raw single-line target refusal retains a correctable pending question', async () => {
  const c = await connect();
  const first = verdict(await call(c, single));
  const before = structuredClone(RUNS.byId(first.run_id));
  const bad = verdict(
    await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answer: `L2: ${accepted}`,
    })
  );
  assert.equal(bad.exit_code, 2);
  // A pre-assessment refusal need not claim an artifact or successor. It
  // must leave the original pending run available for a correct answer.
  assert.deepEqual(RUNS.byId(first.run_id), before);
  const good = verdict(
    await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answer: accepted,
    })
  );
  assert.equal(good.final_draft[0], accepted);
});

test('F01/F03: accepted batch progress keeps authoritative counters; malformed row sets refuse', async () => {
  const c = await connect();
  const draft = [
    'we carried every box across the yard',
    'the morning light was thin and cold as tea',
    'she counted out the coins upon the bench',
    'the radio was playing to the moon',
    'a letter came addressed to no one here',
    'the kettle hummed along beside the drum',
    'we left the porch light burning through the night',
    'and nobody remembered where the soap',
  ];
  const first = verdict(
    await call(c, {
      draft,
      groups: '1,2;3,4;5,6;7,8',
      relation: 'class:RHYME',
      writer: 'interview',
      attempts: 2,
      backtrack: 0,
      max_rounds: 2,
    })
  );
  assert.equal(first.asked.kind, 'propose_batch');
  assert(first.asked.lines.includes(2));
  const answers = first.asked.lines.map((line) => ({
    line,
    text: line === 2 ? 'the morning meal had left the toast all charred' : draft[line - 1],
  }));
  for (const rows of [
    answers.slice(0, -1),
    [...answers, answers[0]],
    [...answers, { line: 1, text: draft[0] }],
  ]) {
    const bad = await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answers: rows,
    });
    assert.equal(bad.isError, true);
    assert.equal(RUNS.byId(first.run_id).revision, first.run_revision);
  }
  const next = verdict(
    await call(c, { run_id: first.run_id, run_revision: first.run_revision, answers })
  );
  assert.equal(next.exit_code, 4);
  assert.equal(next.final_draft[1], answers.find((r) => r.line === 2).text);
  assert.equal(next.stale_answers, 0);
  const journal = decodeState(next.state);
  assert(journal.outcomes.some((r) => r.line === 2 && r.accepted));
  assert(journal.outcomes.some((r) => r.line !== 2 && !r.accepted));
  assert(Array.isArray(next.folded));
  assert(
    next.folded.some((row) => row.verdict === 'unknown'),
    'unvisited answers stay unverified'
  );
  for (const row of next.folded) {
    if (!journal.outcomes.some((o) => o.line === row.line)) assert.equal(row.verdict, 'unknown');
  }
});

test('F04/F06: mixed versions refuse; repeated questions and cache-loss recovery retain accepted lyrics', async () => {
  const c = await connect();
  const first = verdict(await call(c, single));
  const next = verdict(
    await call(c, { run_id: first.run_id, run_revision: first.run_revision, answer: accepted })
  );
  const before = structuredClone(RUNS.byId(next.run_id));
  const mixed = await call(c, {
    run_id: next.run_id,
    run_revision: next.run_revision,
    state: first.state,
    answer: accepted,
  });
  assert.equal(mixed.isError, true);
  assert.match(mixed.content[0].text, /state.*revision|continuation.*mismatch/i);
  assert.deepEqual(RUNS.byId(next.run_id), before);
  let repeated = verdict(await call(c, { run_id: next.run_id, run_revision: next.run_revision }));
  for (const v of [repeated, verdict(await call(c, { state: next.state }))]) {
    assert.deepEqual(v.final_draft, [accepted, single.draft[1]]);
    assert.deepEqual(v.asked, next.asked);
    assert.equal(v.certified, false);
    assert.deepEqual(decodeState(v.state).accepted_lines, v.final_draft);
  }
  RUNS.del(repeated.run_id);
  const recovered = verdict(
    await call(c, {
      run_id: repeated.run_id,
      run_revision: repeated.run_revision,
      state: repeated.state,
    })
  );
  assert.deepEqual(recovered.final_draft, repeated.final_draft);
  assert.equal(recovered.exit_code, 4);
  assert.notEqual(recovered.run_id, repeated.run_id);
});

test('F05: a rejected whole-song answer opens a new attempt which can succeed', async () => {
  const c = await connect();
  const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
  const blueprint = {
    sections: [
      {
        name: 'VERSE',
        bars: 2,
        start_bar: 1,
        function: 'verse',
        meter: { beats: 4, unit: 4, groups: [2, 2] },
      },
    ],
    lines: draft.map((text, i) => ({ text, bar: i + 1, beat: 1, duration: 4, section: 'VERSE' })),
    hooks: ['warm kettle'],
  };
  const first = verdict(
    await call(c, {
      draft,
      blueprint: JSON.stringify(blueprint),
      scheme: 'AA',
      relation: 'class:ASSONANCE',
      subdivision: 2,
      writer: 'interview',
      attempts: 2,
      backtrack: 0,
      max_rounds: 2,
    })
  );
  assert.equal(first.asked.kind, 'propose_group');
  const retry = verdict(
    await call(c, {
      run_id: first.run_id,
      run_revision: first.run_revision,
      answers: draft.map((text, i) => ({ line: i + 1, text })),
    })
  );
  assert.equal(retry.exit_code, 4);
  assert.equal(decodeState(retry.state).pending.record.attempt, 1);
  const fixed = ['My warm kettle sings by the stove', 'Your warm kettle steams my coat'];
  const done = verdict(
    await call(c, {
      run_id: retry.run_id,
      run_revision: retry.run_revision,
      answers: fixed.map((text, i) => ({ line: i + 1, text })),
    })
  );
  assert.equal(done.exit_code, 0);
  assert.deepEqual(done.final_draft, fixed);
});

test('F07: uncertified results retain their exit code and actionable coverage recovery', async () => {
  const c = await connect();
  const first = verdict(
    await call(c, {
      draft: ['Our kettle whistles by the stove', 'Your fingers brush my heavy coat'],
      scheme: 'AA',
      relation: 'class:ASSONANCE',
      writer: 'interview',
      attempts: 0,
      backtrack: 0,
      max_rounds: 1,
    })
  );
  assert.equal(first.exit_code, 2);
  assert.equal(first.status, 'uncertified');
  assert.deepEqual(first.loop_unresolved_lines, [1]);
  const next = await call(c, { run_id: first.run_id, run_revision: first.run_revision });
  assert.equal(next.isError, true);
  const message = next.content.map((x) => x.text || '').join('\n');
  assert.match(message, /uncertified.*exit 2/i);
  assert.doesNotMatch(message, /PARKED at exit 3|rewrite the open line\(s\) \(none\)/);
  assert.match(message, /pronunciation|coverage/);
});

test('F08: native creation carries server revisions through repeated answers and reconnect', async () => {
  let c = await connect(true);
  verdict(await c.call('lyric_sweep', { seed_from: 31, count: 1, lines: 12 }));
  verdict(await c.call('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' }));
  verdict(await c.call('lyric_plan', { seed: 31, lines: 12 }));
  const draft = Array(12).fill('The kettle whistles by the stove');
  verdict(await c.call('lyric_grade', { seed: 31, lines: 12, draft }));
  let v = verdict(
    await c.call('lyric_revise', {
      seed: 31,
      lines: 12,
      draft,
      writer: 'interview',
      max_rounds: 2,
      attempts: 1,
      backtrack: 0,
    })
  );
  for (let i = 0; i < 3; i++) {
    assert.equal(v.exit_code, 4);
    const snapshot = c.snapshot();
    assert.equal(snapshot.continuation.args.run_id, v.run_id);
    assert.equal(snapshot.continuation.args.run_revision, v.run_revision);
    if (i === 1) {
      await c.close();
      c = await connect(true, snapshot);
    }
    const rows =
      v.asked.kind === 'propose'
        ? { answer: draft[v.asked.line - 1] }
        : {
            answers: (v.asked.lines || v.asked.members).map((line) => ({
              line,
              text: draft[line - 1],
            })),
          };
    const previous = v;
    v = verdict(
      await c.call('lyric_revise', {
        ...rows,
        ...(i % 2 === 0 ? { run_id: v.run_id, run_revision: v.run_revision } : {}),
      })
    );
    assert.equal(v.run_revision, previous.run_revision + 1);
  }
});

test('structured answers without a pending question name the missing question', async () => {
  const c = await connect();
  const initial = verdict(await call(c, single));
  const state = decodeState(initial.state);
  state.pending = null;
  const result = await call(c, {
    state: encodeState(state),
    answers: [{ line: 1, text: 'A replacement' }],
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /holds no pending question/);
});
