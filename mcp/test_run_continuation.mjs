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
      scheme: 'AA', // resend only part of the declaration; carry the relation
      answer: 'I left the basket underneath the oak',
    }),
    call(b, {
      run_id: initial.run_id,
      run_revision: 1,
      scheme: 'AA', // resend only part of the declaration; carry the relation
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
  // replay/verify walk must still reach the omitted questions.
  // These unchanged answers deliberately fix nothing: no accepted edit can
  // silently close the remaining obligations on this liveness control.
  // ~~The batch was the run's FIRST question, [1, 5, 6, 14, 15, 17, 19] with
  // [21, 23] omitted~~ — since M-305 the brief reads the incident verdict for
  // BOTH endpoints of a violated pair, so L1 (the earlier endpoint of violated
  // pairs in groups A and L) is a joint-conflict pivot and tier 2 asks its
  // group rewrites before the batch door opens. MEASURED on this tree at
  // attempts 3: group [1,8,9,10,11], L1 x3, group [2,8,13], L2 x3, group
  // [3,4,9,10,12], L3 x3, group [4,6,7], L4 x3, then the batch door opens on
  // continuation 16 at pivot L5 with nine independent briefs
  // [5, 6, 11, 14, 15, 17, 20, 21, 24], of which the first seven fit (336837
  // state bytes) and [21, 24] are omitted. The omitted pair is re-asked on the
  // walk's SECOND batch [13, 16, 18, 21, 24], 30 continuations after the
  // first, while 14, 15, 17 and 20 of the first batch are still unvisited.
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
  // ~~[1, 5, 6, 14, 15, 17, 19, 21, 23]~~ — the nine independent briefs the
  // batch door sees on this tree (measured at the harness's prefetch).
  const originalIndependent = [5, 6, 11, 14, 15, 17, 20, 21, 24];
  // Every question before the batch is a tier-2 group rewrite or a tier-1
  // retry of its pivot; the door opened on continuation 16 (measured).
  const BATCH_DOOR_BOUND = 18;
  // ~~8~~ — the tail is re-asked on the second batch, which the linear walk
  // reaches only after the group questions and the three attempts per pivot
  // of L5..L12; measured 30 continuations after the first batch.
  const TAIL_BOUND = 32;
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
  const membersOf = (pending) =>
    pending.kind === 'propose_batch'
      ? pending.record.records.map((r) => r.line)
      : pending.kind === 'propose_group'
        ? pending.record.members
        : [pending.record.line];
  const reached = new Set();
  // Walk to the batch door: answer each group / pivot question with the
  // draft's own line(s) until the first propose_batch appears. A run that
  // never opens the door within the bound fails here with its walk listed,
  // rather than being read as a batch.
  const doorWalk = [];
  let doorHops = 0;
  while (splitState.pending.kind !== 'propose_batch') {
    const members = membersOf(splitState.pending);
    doorWalk.push(`${splitState.pending.kind}[${members}]`);
    for (const n of members) reached.add(n);
    assert.ok(
      doorHops < BATCH_DOOR_BOUND,
      `no propose_batch within ${BATCH_DOOR_BOUND} continuations: ${doorWalk.join(' > ')}`
    );
    assert.equal(split.status, 'awaiting_proposal');
    const answer =
      splitState.pending.kind === 'propose'
        ? splitDraft[members[0] - 1]
        : members.map((n) => `L${n}: ${splitDraft[n - 1]}`).join('\n');
    split = verdict(
      await splitCall({
        run_id: split.run_id,
        run_revision: split.run_revision,
        answer,
      })
    );
    assert.equal(split.exit_code, 4, 'the fresh run is not ended before the batch door');
    splitState = decodeState(split.state);
    assert.deepEqual(splitState.accepted_lines, splitDraft);
    doorHops++;
  }
  console.log(
    JSON.stringify({
      batch_door_continuation: doorHops,
      walk: doorWalk,
      first_batch: membersOf(splitState.pending),
      state_bytes: Buffer.byteLength(JSON.stringify(splitState), 'utf8'),
    })
  );
  const firstSubset = splitState.pending.record.records.map((r) => r.line);
  // ~~[1, 5, 6, 14, 15, 17, 19]~~
  assert.deepEqual(firstSubset, [5, 6, 11, 14, 15, 17, 20]);
  const omittedTail = originalIndependent.filter((n) => !firstSubset.includes(n));
  // ~~[21, 23]~~
  assert.deepEqual(omittedTail, [21, 24]);
  for (const n of firstSubset) reached.add(n);
  const verifiedFirst = new Map();
  const tailFolded = new Set();
  let continuations = 0;
  for (
    ;
    continuations < TAIL_BOUND &&
    (omittedTail.some((n) => !tailFolded.has(n)) || !verifiedFirst.has(firstSubset[0]));
    continuations++
  ) {
    assert.equal(split.status, 'awaiting_proposal');
    const pending = splitState.pending;
    const members = membersOf(pending);
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
    const asked = membersOf(next);
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
    `PASS actual seed1/24 split liveness at attempts3: batch door on continuation ${doorHops}, first [${firstSubset}] retained, pivot rejected, omitted [${omittedTail}] reasked and folded after ${continuations} further continuation(s); exact draft preserved; actual batch results keep future unvisited answers unknown.`
  );
} finally {
  _workerInternals.kill();
  for (const peer of peers) {
    await peer.client.close();
    await peer.server.close();
  }
}
