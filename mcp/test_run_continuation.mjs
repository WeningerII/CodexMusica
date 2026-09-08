import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { RUNS, _workerInternals } from './lyric_tools.js';
import { encodeState, decodeState } from './state_codec.js';
import { TOOL_BUDGET_MS } from './budget.js';
import { createHash } from 'node:crypto';

const peers = [];
async function connect(name) {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const client = new Client({ name, version: '1' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  peers.push({ client, server });
  return client;
}
const verdict = (result) => {
  for (const block of result.content || []) {
    try {
      const v = JSON.parse(block.text);
      if (typeof v.exit_code === 'number') return v;
    } catch {}
  }
  throw Error(
    (result.content || [])
      .map((c) => c.text)
      .join('\n')
      .slice(0, 1500)
  );
};
const a = await connect('continuation-race-A'),
  b = await connect('continuation-race-B');
const call = (client, args) =>
  client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 120000 });
try {
  const initial = verdict(
    await call(a, {
      scheme: 'AA',
      relation: 'type:rime riche',
      draft: ['Copper cat', 'Azure dog'],
      writer: 'interview',
      max_rounds: 1,
      backtrack: 0,
    })
  );
  assert.equal(initial.exit_code, 4);
  assert.equal(initial.run_revision, 1);
  const saved = structuredClone(RUNS.byId(initial.run_id));
  assert.equal(saved.decl.attempts, 1);
  const movedBudget = await call(a, {
    run_id: initial.run_id,
    run_revision: 1,
    attempts: 2,
    answer: 'I hold you.',
  });
  assert.equal(movedBudget.isError, true);
  assert.match(movedBudget.content[0].text, /attempts/);
  const movedDraft = await call(a, {
    run_id: initial.run_id,
    run_revision: 1,
    draft: ['Different song', 'Entirely replaced'],
    answer: 'I hold you.',
  });
  assert.equal(movedDraft.isError, true);
  assert.match(movedDraft.content[0].text, /original replay draft/);
  assert.deepEqual(RUNS.byId(initial.run_id).draft, saved.draft);
  const [first, second] = await Promise.all([
    call(a, {
      run_id: initial.run_id,
      run_revision: 1,
      answer: 'I left the basket underneath the oak',
    }),
    call(b, {
      run_id: initial.run_id,
      run_revision: 1,
      answer: 'I put the basket underneath the oak',
    }),
  ]);
  assert.equal([first, second].filter((r) => r.isError).length, 1);
  const refused = [first, second].find((r) => r.isError);
  assert.match(refused.content[0].text, /RUN_BUSY|stale run revision/);
  const accepted = verdict([first, second].find((r) => !r.isError));
  assert.equal(accepted.run_revision, 2);
  assert.ok(accepted.folded, 'run_id plus a separate answer returns its actual fold receipt');
  const retained = RUNS.byId(initial.run_id);
  assert.equal(retained.revision, 2);
  const stale = await call(b, {
    run_id: initial.run_id,
    run_revision: 1,
    answer: 'A stale answer',
  });
  assert.equal(stale.isError, true);
  assert.match(stale.content[0].text, /stale run revision/);
  assert.equal(RUNS.byId(initial.run_id).revision, 2);
  const nearCapacity = decodeState(initial.state);
  nearCapacity.capacity_test_evidence = 'retained journal evidence '.repeat(15500);
  const stopped = verdict(
    await call(a, {
      state: encodeState(nearCapacity),
      answer: 'I left the basket underneath the oak',
    })
  );
  assert.equal(stopped.exit_code, 3);
  assert.equal(stopped.status, 'journal_capacity');
  assert.equal(stopped.certified, false);
  assert.equal(stopped.new_run_required, true);
  assert.deepEqual(stopped.final_draft, saved.draft);
  const recovery = decodeState(stopped.state);
  assert.equal(recovery.new_run_required, true);
  assert.equal(recovery.capacity_test_evidence, nearCapacity.capacity_test_evidence);
  assert.equal(recovery.pending.answer, 'I left the basket underneath the oak');
  const replayCapacity = await call(a, { state: stopped.state });
  assert.equal(replayCapacity.isError, true);
  assert.match(replayCapacity.content[0].text, /JOURNAL_CAPACITY/);
  console.log(
    'PASS real MCP + real Python: immutable defaults/input; one concurrent continuation; stale revision refused; capacity stop preserves exact artifact and journal and refuses replay.'
  );
  // Actual seed1/24-line regression: the original nine independent briefs
  // exceeded the journal limit. After admitting the first seven, the real
  // replay/verify walk must still reach the omitted L21/L23 questions.
  // These unchanged answers deliberately fix nothing: no accepted edit can
  // silently close the remaining obligations on this liveness control.
  const splitDraft = [
    'we carry the morning to the stone',
    'we carry the morning to the rain',
    'we carry the morning to the door',
    'we carry the morning to the light',
    'we carry the morning to the road',
    'we carry the morning to the name',
    'we carry the morning to the glass',
    'we carry the morning to the train',
    'we carry the morning to the hill',
    'we carry the morning to the salt',
    'we carry the morning to the wire',
    'we carry the morning to the bell',
    'we carry the morning to the coat',
    'we carry the morning to the dust',
    'we carry the morning to the song',
    'we carry the morning to the tide',
    'we carry the morning to the map',
    'we carry the morning to the map',
    'we carry the morning to the paper',
    'we carry the morning to the stone',
    'we carry the morning to the rain',
    'we carry the morning to the door',
    'we carry the morning to the light',
    'we carry the morning to the road',
  ];
  const originalIndependent = [1, 5, 6, 14, 15, 17, 19, 21, 23];
  const splitCall = (args) =>
    a.callTool({ name: 'lyric_revise', arguments: args }, undefined, {
      timeout: TOOL_BUDGET_MS + 30000,
    });
  let split = verdict(
    await splitCall({
      seed: 1,
      lines: 24,
      draft: splitDraft,
      writer: 'interview',
      attempts: 3,
      new_run: true,
    })
  );
  assert.equal(split.exit_code, 4);
  let splitState = decodeState(split.state);
  const firstSubset = splitState.pending.record.records.map((r) => r.line);
  assert.deepEqual(firstSubset, [1, 5, 6, 14, 15, 17, 19]);
  const omittedTail = originalIndependent.filter((n) => !firstSubset.includes(n));
  assert.deepEqual(omittedTail, [21, 23]);
  const reached = new Set(firstSubset);
  const verifiedFirst = new Map();
  const tailFolded = new Set();
  let continuations = 0;
  for (
    ;
    continuations < 8 &&
    (omittedTail.some((n) => !tailFolded.has(n)) || !verifiedFirst.has(firstSubset[0]));
    continuations++
  ) {
    assert.equal(split.status, 'awaiting_proposal');
    const pending = splitState.pending;
    const members =
      pending.kind === 'propose_batch'
        ? pending.record.records.map((r) => r.line)
        : pending.kind === 'propose_group'
          ? pending.record.members
          : [pending.record.line];
    const answer =
      pending.kind === 'propose'
        ? splitDraft[members[0] - 1]
        : members.map((n) => `L${n}: ${splitDraft[n - 1]}`).join('\n');
    split = verdict(
      await splitCall({
        run_id: split.run_id,
        run_revision: split.run_revision,
        answer,
      })
    );
    assert.equal(
      split.exit_code,
      4,
      'the original unanswered tail must be reached before any stop'
    );
    splitState = decodeState(split.state);
    assert.deepEqual(splitState.accepted_lines, splitDraft);
    if (split.final_draft) assert.deepEqual(split.final_draft, splitDraft);
    if (continuations === 0) {
      assert.ok(
        Array.isArray(split.folded),
        'the actual batch result reports each supplied answer'
      );
      assert.equal(split.folded.length, firstSubset.length);
      for (const row of split.folded) {
        const measured = splitState.outcomes.find(
          (o) => o.line === row.line && o.attempt === row.attempt && o.round === row.round
        );
        if (measured) {
          assert.equal(row.verdict, 'rejected');
          assert.equal(row.source, 'outcome');
        } else {
          assert.equal(
            row.verdict,
            'unknown',
            'unused attempts cannot label an unvisited answer accepted'
          );
          assert.equal(row.source, 'unverified');
          assert.deepEqual(row.reasons, []);
        }
      }
    }
    const next = splitState.pending;
    const asked =
      next.kind === 'propose_batch'
        ? next.record.records.map((r) => r.line)
        : next.kind === 'propose_group'
          ? next.record.members
          : [next.record.line];
    for (const n of asked) reached.add(n);
    for (const n of firstSubset) {
      const folded = splitState.answered.propose.find(
        (r) => r.line === n && r.attempt === 0 && r.round === 1
      );
      assert.ok(folded, `first-batch L${n} was folded into the real replay journal`);
      assert.equal(folded.text, splitDraft[n - 1]);
      assert.ok(
        !Object.hasOwn(folded, 'accepted'),
        'an answer record cannot claim it was verified'
      );
      const outcome = splitState.outcomes.find(
        (r) => r.line === n && r.attempt === 0 && r.round === 1
      );
      // Folding happens as soon as the batch answer arrives; verification
      // follows the real linear walk, which can ask L2 before visiting the
      // already-recorded L5. Once visited, its exact outcome must survive.
      if (verifiedFirst.has(n)) assert.deepEqual(outcome, verifiedFirst.get(n));
      if (outcome) {
        assert.equal(
          outcome.accepted,
          false,
          'unchanged answers cannot be recorded as improvements'
        );
        assert.ok(outcome.reasons.length > 0);
        verifiedFirst.set(n, structuredClone(outcome));
      }
    }
    for (const n of omittedTail) {
      const folded = splitState.answered.propose.find(
        (r) => r.line === n && r.attempt === 0 && r.round === 1
      );
      if (folded) {
        assert.ok(reached.has(n), 'a tail answer cannot appear before its actual question');
        assert.equal(folded.text, splitDraft[n - 1]);
        tailFolded.add(n);
      }
    }
    console.log(
      JSON.stringify({
        split_continuation: continuations + 1,
        question_kind: next.kind,
        asked,
        answered: splitState.answered.propose.map((r) => r.line),
        rejected_first_subset: [...verifiedFirst.keys()],
        unvisited_first_subset: firstSubset.filter((n) => !verifiedFirst.has(n)),
        omitted_tail_folded: [...tailFolded],
        accepted_draft_sha256: createHash('sha256')
          .update(JSON.stringify(splitState.accepted_lines))
          .digest('hex'),
      })
    );
  }
  assert.ok(
    omittedTail.every((n) => reached.has(n)),
    'both original omitted questions are eventually asked'
  );
  assert.deepEqual(splitState.accepted_lines, splitDraft);
  assert.ok(
    verifiedFirst.has(firstSubset[0]),
    'the real walk visited and rejected the first pivot'
  );
  assert.deepEqual(
    [...tailFolded].sort((x, y) => x - y),
    omittedTail
  );
  assert.ok(
    verifiedFirst.size < firstSubset.length,
    'later first-batch answers remain recorded but unvisited at this stop'
  );
  console.log(
    `PASS actual seed1/24 split liveness at attempts3: first [${firstSubset}] retained, pivot rejected, omitted [${omittedTail}] reasked and folded after ${continuations} continuation(s); exact draft preserved; actual batch results keep future unvisited answers unknown.`
  );
} finally {
  _workerInternals.kill();
  for (const peer of peers) {
    await peer.client.close();
    await peer.server.close();
  }
}
