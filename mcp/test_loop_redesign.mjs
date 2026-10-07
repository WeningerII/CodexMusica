// The revise-loop redesign at the connector (lyric-harness/quality/LOOP_REDESIGN.md,
// design v4, built 2026-10-02 on). The harness half lives in
// lyric-harness/quality/test_loop_redesign.py; this file holds what only the
// connector does: the seal on a saved position (§2.0.1, T7), the fold by
// journal diff with the owner-approved verdicts (§2.2 option B, T3), and the
// published `cursor_stripped` (Q5), exit 5 and the no-progress count (§2.3b,
// §2.8 E; Q3, Q4), and the website chat carrying a stopped run (§2.8 F, R6).
// Every check here fails on the connector before the redesign: it had no
// seal, no `cursor_stripped`, no exit 5, no `stallsOf`, folded an unreached
// batch answer as `unknown`, and dropped an interrupted interview run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import {
  decodeState,
  encodeInterviewWire,
  verifyInterviewCursor,
} from './state_codec.js';
import { _verdictInternals as VI } from './lyric_tools.js';
import { _agentInternals as AI } from './gemini_agent.js';

const sealedState = () => ({
  version: 1,
  input_draft: ['Cat', 'Dog'],
  connector_declarations: { scheme: 'AA', relation: 'class:RHYME', writer: 'interview' },
  answered: { propose: [{ line: 2, attempt: 0, round: 1, text: 'a hat' }], propose_group: [] },
  outcomes: [{ line: 2, attempt: 0, round: 1, text: 'a hat', accepted: false, reasons: ['x'] }],
  pending: { kind: 'propose', record: { line: 2, attempt: 1, round: 1 }, prompt: 'p', answer: null },
  accepted_lines: ['Cat', 'Dog'],
  cursor: { version: 1, loop: { phase: 'pass', round: 1, at: 0, draft: ['Cat', 'Dog'] } },
});

test('T7 (connector): a sealed cursor verifies, and editing anything it covers strips it', () => {
  const wire = encodeInterviewWire(sealedState());
  const ok = decodeState(wire);
  assert.equal(typeof ok.cursor_seal, 'string', 'the returned state carries a seal');
  assert.equal(verifyInterviewCursor(ok), null, 'an unedited state keeps its cursor');
  assert.ok(ok.cursor, 'and the cursor is passed on');
  assert.equal(ok.cursor_seal, undefined, 'the seal itself never reaches the harness');

  const answered = decodeState(wire);
  answered.pending.answer = 'a new line';
  assert.equal(verifyInterviewCursor(answered), null, 'filling in pending.answer is not tampering');

  const edits = {
    cursor: (d) => {
      d.cursor.loop.at = 1;
    },
    declarations: (d) => {
      d.connector_declarations.relation = 'class:ASSONANCE';
    },
    input: (d) => {
      d.input_draft[0] = 'Bat';
    },
    outcome: (d) => {
      d.outcomes[0].accepted = true;
    },
    journal: (d) => {
      d.answered.propose[0].text = 'another';
    },
  };
  for (const [what, edit] of Object.entries(edits)) {
    const d = decodeState(wire);
    edit(d);
    assert.equal(verifyInterviewCursor(d), 'seal', `an edited ${what} fails the seal`);
    assert.equal(d.cursor, undefined, `...and the cursor is dropped (${what})`);
    assert.equal(d.cursor_strip, 'seal', `...and the harness is told why (${what})`);
  }
  const unsealed = decodeState(encodeInterviewWire({ ...sealedState(), cursor: undefined }));
  assert.equal(unsealed.cursor_seal, undefined, 'a state with no cursor carries no seal');
});

test('T3 (connector): option B — no folded row is unknown, and a passed-by answer is not_applied', () => {
  const pend = {
    kind: 'propose_batch',
    record: { records: [{ line: 1 }, { line: 3 }, { line: 5 }].map((r) => ({ ...r, attempt: 0, round: 1 })) },
    answer: 'L1: a\nL3: b\nL5: c',
  };
  const st = {
    answered: {
      propose: [1, 3, 5].map((line) => ({ line, attempt: 0, round: 1, text: `t${line}` })),
      propose_group: [],
    },
    outcomes: [{ line: 1, attempt: 0, round: 1, text: 't1', accepted: true, reasons: [] }],
    dispositions: [
      { line: 3, attempt: 0, round: 1, disposition: 'not_applied', why: 'closed', by: [1] },
    ],
    pending: { kind: 'propose_batch', record: { records: [{ line: 2, attempt: 0, round: 1 }] } },
  };
  const rows = VI.foldedOf(JSON.stringify({ pending: pend }), st);
  assert.ok(Array.isArray(rows) && rows.length === 3, 'one row per answer');
  const by = Object.fromEntries(rows.map((r) => [r.line, r]));
  assert.equal(by[1].verdict, 'accepted');
  assert.equal(by[3].verdict, 'not_applied');
  assert.match(by[3].reasons[0], /closed by the accepted rewrite of L1/);
  assert.equal(by[5].verdict, 'pending');
  assert.deepEqual(by[5].waiting_on, [2]);
  assert.ok(!rows.some((r) => r.verdict === 'unknown'), 'no row is unknown');
});

test('live: a continuation keeps a sealed cursor; a tampered one is reported and replays', async () => {
  const server = buildServer();
  const client = new Client({ name: 'loop-redesign', version: '1' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const call = async (args) => {
    const res = await client.callTool({ name: 'lyric_revise', arguments: args }, undefined, {
      timeout: 600000,
    });
    for (const part of res.content) {
      try {
        const v = JSON.parse(part.text);
        if (typeof v.exit_code === 'number') return v;
      } catch {
        /* the brief */
      }
    }
    assert.fail(JSON.stringify(res).slice(0, 500));
  };
  try {
    const draft = ['I left the kettle on the stove', 'and walked out to the empty yard'];
    const decl = { scheme: 'AA', relation: 'class:RHYME', writer: 'interview', attempts: 1, backtrack: 1 };
    const first = await call({ ...decl, draft });
    assert.equal(first.exit_code, 4);
    const st1 = decodeState(first.state);
    assert.ok(st1.cursor && typeof st1.cursor_seal === 'string', 'the first state carries a sealed cursor');
    const answer = 'and walked out to the empty field';
    const second = await call({ ...decl, draft, state: first.state, answer });
    assert.equal(second.exit_code, 4);
    assert.equal(second.cursor_stripped, undefined, 'an unedited state resumes: nothing stripped');
    // Tamper: keep the seal, move the cursor. The run replays and says why,
    // and reaches the SAME next question the resume reached.
    const forged = decodeState(first.state);
    forged.cursor.loop.at = 5;
    const { encodeState } = await import('./state_codec.js');
    const third = await call({ ...decl, draft, state: encodeState(forged), answer });
    assert.equal(third.exit_code, 4);
    assert.equal(third.cursor_stripped, 'seal', 'a forged cursor is reported as `seal`');
    assert.deepEqual(third.asked, second.asked, 'replay reaches the question the resume reached');
  } finally {
    await client.close();
    await server.close();
  }
});

test('T5 (connector): the no-progress count rises only while the position stands still', () => {
  const at = (n, extra = {}) => ({
    accepted_lines: ['a', 'b'],
    outcomes: [],
    group_outcomes: [],
    dispositions: [],
    pending: null,
    cursor: { loop: { phase: 'pass', round: 1, at: n, menus: [] } },
    ...extra,
  });
  assert.equal(VI.EXIT_MEANING[5], 'STOPPED at a safe point — resumable; continue with no answer');
  // Three calls ending at one position: 1, 2, 3 — and the count is carried in
  // the state each call returns, so it is the incoming state's plus one.
  let prev = at(0);
  const counts = [];
  for (let i = 0; i < 3; i++) {
    const n = VI.stallsOf(JSON.stringify(prev), at(0));
    counts.push(n);
    prev = { ...at(0), stalls: n };
  }
  assert.deepEqual(counts, [1, 2, 3], 'one more per call that did not move');
  // The count itself and the seal are not progress.
  assert.equal(
    VI.positionOf({ ...at(0), stalls: 7, cursor_seal: 'x' }),
    VI.positionOf(at(0)),
    'carrying the count never reads as an advance'
  );
  // Any advance resets it: the place in the pass, a menu built, a verdict.
  const moved = [
    at(1),
    { ...at(0), cursor: { loop: { phase: 'pass', round: 1, at: 0, menus: [['k', 1]] } } },
    { ...at(0), outcomes: [{ line: 1 }] },
    { ...at(0), dispositions: [{ line: 3 }] },
    { ...at(0), pending: { kind: 'propose', record: { line: 2 } } },
  ];
  for (const m of moved)
    assert.equal(VI.stallsOf(JSON.stringify({ ...at(0), stalls: 2 }), m), 0, JSON.stringify(m).slice(0, 120));
});

test('R6: the website chat carries a stopped interview run as resumable', () => {
  const surface = { stateTools: new Set(['lyric_revise']) };
  const args = { seed: 7, draft: ['x', 'y'] };
  const carried = AI.carryState(
    null,
    'lyric_revise',
    args,
    { exit_code: 5, status: 'interrupted', state: 'SEALED', run_id: 'r1', replay_draft: ['x', 'y'] },
    surface
  );
  assert.ok(carried, 'the run is carried, not dropped');
  assert.equal(carried.resumable, true);
  assert.equal(carried.state, 'SEALED', 'the sealed state rides to the next call');
  assert.equal(carried.run_id, 'r1');
  assert.deepEqual(carried.draft, ['x', 'y']);
});

test('test continuation: safe-point resumes without replaying the answer', async () => {
  const { resumeStopped } = await import('./test_resume_stopped.mjs');
  const response = (row) => ({ content: [{ text: 'checkpoint' }, { text: JSON.stringify(row) }] });
  const calls = [];
  const client = { callTool: async (request) => {
    calls.push(request);
    return response({ exit_code: 4, run_id: 'saved', run_revision: 2, state: 'next' });
  } };
  const result = await resumeStopped(client,
    response({ exit_code: 5, run_id: 'saved', run_revision: 1, state: 'checkpoint' }), {});
  assert.equal(JSON.parse(result.content[1].text).exit_code, 4);
  assert.deepEqual(calls, [{ name: 'lyric_revise', arguments: { run_id: 'saved', run_revision: 1 } }]);
});

test('test continuation: errors and killed calls cannot become passing questions', async () => {
  const { resumeStopped } = await import('./test_resume_stopped.mjs');
  const response = (row) => ({ content: [{ text: 'checkpoint' }, { text: JSON.stringify(row) }] });
  await assert.rejects(() => resumeStopped({},
    { isError: true, content: [{ text: 'original worker error' }] }, {}), /original worker error/);
  await assert.rejects(() => resumeStopped({ callTool: async () =>
    response({ exit_code: -1, run_id: 'saved', run_revision: 2 }) },
  response({ exit_code: 5, run_id: 'saved', run_revision: 1, state: 'checkpoint' }), {}),
  /must not be killed/);
});
