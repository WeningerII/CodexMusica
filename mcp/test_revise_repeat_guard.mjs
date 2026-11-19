// The repeat guard (BB8 Q1, #519): one /chat request whose model re-sends the
// same lyric_revise asked the paid writer the same questions every time (a
// measured 40 revises and 160 writer calls in one request). A repeat of
// completed work, in the request or in the signed history, is answered from
// the earlier result with nothing dispatched. The key is the work the call
// would dispatch, not the model's raw arguments: a changed draft, a changed
// effective declaration, a new answer the writer reads, or an explicit
// new_run still runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  runTurn,
  LIMITS,
  reviseRepeatKey,
  completedRevises,
  MAX_COMPLETED_REVISE_KEYS,
  _agentInternals,
} from './gemini_agent.js';

const nativeFetch = globalThis.fetch;
const surface = {
  instructions: '=== RECIPE TASK === r === LYRICS TASK === l',
  declarations: ['lyric_revise'].map((name) => ({
    name,
    parameters: { type: 'object', properties: {} },
  })),
  workspaceTools: new Set(),
  stateTools: new Set(['lyric_revise']),
};
const usageMetadata = { promptTokenCount: 20, candidatesTokenCount: 10, thoughtsTokenCount: 0 };
const response = (parts) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts }, finishReason: 'STOP' }], usageMetadata }),
});
const fc = (name, args = {}) => ({ functionCall: { name, args } });
const task = () => ({
  version: 2,
  domain: 'lyrics',
  format: 'rich',
  maxChars: 1000,
  brief: 'b',
  phase: 'edit',
  completedSteps: [],
  turns: 0,
});
const draft = ['Your fingers brush my heavy coat', 'My kettle whistles by the sink'];
const decl = { groups: '1,2', relation: 'class:ASSONANCE' };
// The demonstrated case (3PO, #519 6393659117): the writer fixed line 2 and
// left line 1 open, so the run stops with open lines (exit 3) on a song that
// is NOT the draft sent, and the model re-sends its ORIGINAL draft.
const accepted = [draft[0], 'My kettle whistles by the stove'];
const verdict = (v) => ({ content: [{ type: 'text', text: JSON.stringify(v) }] });
const parked = () =>
  verdict({
    exit_code: 3,
    status: 'stopped_with_open_lines',
    certified: false,
    loop_unresolved_lines: [1],
    final_draft: accepted,
    proposer_calls: 4,
    proposer_cost_usd: 0.004,
  });
const finished = () =>
  verdict({ exit_code: 0, status: 'certified', certified: true, final_draft: draft });
// The model asks for each scripted call in turn, then answers in text.
async function turn(
  script,
  {
    history = [],
    lyric = null,
    tool = parked,
    writer,
    limits,
    priorTask = null,
    userText = 'Revise this.',
    modelText = 'done',
    onCheckpoint,
  } = {}
) {
  let hop = 0;
  const sent = [];
  globalThis.fetch = async () => {
    const next = script[hop++];
    return response(next ? [fc('lyric_revise', next)] : [{ text: modelText }]);
  };
  try {
    const out = await runTurn({
      apiKey: 'offline',
      onCheckpoint,
      surface,
      userText,
      history,
      lyric,
      task: priorTask || task(),
      ...(writer ? { writer } : {}),
      limits: { ...LIMITS, maxSteps: 60, maxTurnMs: 30000, maxTurnUsd: 0, ...limits },
      callTool: async (name, args) => {
        sent.push(structuredClone(args));
        return tool(args, sent.length);
      },
    });
    return { out, dispatched: sent.length, sent };
  } finally {
    globalThis.fetch = nativeFetch;
  }
}
const repeats = (out) => out.calls.filter((c) => /^ALREADY_DONE/.test(c.error || '')).length;

test('a change to selected printed indentation reaches the writer after reconnect', async () => {
  const stepped = ['a', ' b', '  c'];
  const flat = ['a', 'b', 'c'];
  const args = {
    catalog_form: 'triadic-line',
    catalog_counts: [{ path: '1.1', count: 1 }],
    scheme: 'AAA',
  };
  const repeatKey = (draft, extra) => reviseRepeatKey('lyric_revise', { draft, ...extra });
  assert.equal(repeatKey(stepped), repeatKey(flat));
  assert.notEqual(repeatKey(stepped, args), repeatKey(flat, args));
  assert.equal(
    repeatKey(stepped, args),
    reviseRepeatKey('lyric_revise', { draft_text: stepped.join('\n'), ...args })
  );
  const tool = (a) =>
    verdict({ exit_code: 0, status: 'certified', certified: true, final_draft: a.draft });
  const first = await turn([{ ...args, draft_text: stepped.join('\n') }], { tool });
  assert.deepEqual(first.sent[0].draft, stepped);
  const next = await turn([{ ...args, draft: flat }], { tool, history: first.out.history });
  assert.equal(next.dispatched, 1);
  assert.deepEqual(next.sent[0].draft, flat);
});

test('the original draft re-sent 40 times after open lines reaches the writer once', async () => {
  const { out, dispatched } = await turn(Array.from({ length: 40 }, () => ({ draft, ...decl })));
  assert.equal(dispatched, 1);
  assert.equal(repeats(out), 39);
  assert.deepEqual(
    {
      reviseDispatched: out.usage.reviseDispatched,
      reviseUnreported: out.usage.reviseUnreported,
      writerCallsReported: out.usage.writerCallsReported,
      reviseRepeated: out.usage.reviseRepeated,
    },
    { reviseDispatched: 1, reviseUnreported: 0, writerCallsReported: 4, reviseRepeated: 39 }
  );
  const note = out.calls[1].error;
  assert.match(note, /Nothing was run and the writer was not asked again/);
  assert.match(note, /stopped_with_open_lines, exit 3/);
  assert.ok(
    note.includes(JSON.stringify(accepted)),
    'the note carries the accepted song, not the draft re-sent'
  );
  assert.match(note, /send a draft you changed yourself/);
  // A deliberate re-roll is named, and only on the user's own request
  // (BB8 A4): it is not permission for repeated paid runs.
  assert.match(
    note,
    /Only if the user has asked, in this conversation, for another attempt at this same song, send it again with new_run: true \(an independent run\); never re-run it on your own\./
  );
});

test('every spelling the tools read as the same song is the same work (3PO 6393791362 §1)', async () => {
  const k = reviseRepeatKey('lyric_revise', { draft, ...decl });
  assert.match(k, /^[0-9a-f]{32}$/);
  const aliases = [
    { draft_text: draft.join('\n'), ...decl },
    { draft_text: `[Verse 1]\r\n  ${draft[0]}  \r\n\r\n[Chorus]\n${draft[1]}\n`, ...decl },
    { draft: ['[Verse 1]', ` ${draft[0]}`, '', '   ', '[Chorus]', `${draft[1]} `], ...decl },
    { relation: decl.relation, groups: decl.groups, draft },
  ];
  for (const a of aliases) assert.equal(reviseRepeatKey('lyric_revise', a), k, JSON.stringify(a));
  // A bracket inside a sung line, a line moved or a line added is another song.
  for (const other of [
    [`${draft[0]} [softly]`, draft[1]],
    [draft[1], draft[0]],
    [...draft, 'And the light goes out'],
  ])
    assert.notEqual(reviseRepeatKey('lyric_revise', { draft: other, ...decl }), k);
  // End to end: the array first, then the text spelling with headers and
  // blank rows, then the array with them — one dispatch.
  const { dispatched, out } = await turn([{ draft, ...decl }, aliases[1], aliases[2]]);
  assert.equal(dispatched, 1);
  assert.equal(repeats(out), 2);
});

test('the key is the dispatched work: changed effective declarations, answers and new_run run (§2)', async () => {
  // A changed draft runs.
  // Rewritten at the open line, on the song the run stopped on (#853: a
  // parked rewrite may change only the lines that can fix it).
  const changed = ['Your fingers brush my winter coat', accepted[1]];
  assert.equal(
    (
      await turn([
        { draft, ...decl },
        { draft: changed, ...decl },
      ])
    ).dispatched,
    2
  );
  // An explicit new_run restart has no key and always runs.
  assert.equal(reviseRepeatKey('lyric_revise', { draft, ...decl, new_run: true }), null);
  const restart = await turn([
    { draft, ...decl },
    { draft, ...decl, new_run: true },
  ]);
  assert.equal(restart.dispatched, 2);
  assert.equal(restart.out.usage.reviseDispatched, 2);
  // Identical raw arguments, different dispatched work: the run the model
  // continues carries declarations it did not resend. Turn 1 completes and
  // parks; turn 2 sends the same raw call against that carried run.
  const first = await turn([{ draft, ...decl }]);
  assert.equal(first.dispatched, 1);
  const carried = first.out.lyric;
  assert.ok(carried && carried.decl, 'turn 1 carries the parked run');
  const same = await turn([{ draft, ...decl }], {
    history: first.out.history,
    lyric: carried,
  });
  assert.equal(same.dispatched, 0, 'same effective work: answered from turn 1');
  const moved = await turn([{ draft, ...decl }], {
    history: first.out.history,
    lyric: { ...carried, decl: { ...carried.decl, max_rounds: 2 } },
  });
  assert.equal(moved.dispatched, 1, 'the carried declarations changed the work, so it runs');
  assert.equal(moved.sent[0].max_rounds, 2);
  // Answers: the kitchen writer answers every question itself and the
  // model's answers are stripped before dispatch, so they are not new work
  // there; on the interview writer the tool reads them, so they are.
  const ans = (text) => ({ draft, ...decl, answers: [{ line: 2, text }] });
  const kitchen = await turn([ans('a'), ans('b')], { tool: finished, writer: 'kitchen' });
  assert.equal(kitchen.dispatched, 1);
  assert.equal(kitchen.sent[0].answers, undefined);
  const interview = await turn([ans('a'), ans('b'), ans('b')], {
    tool: finished,
    writer: 'interview',
  });
  assert.equal(interview.dispatched, 2);
  assert.deepEqual(
    interview.sent.map((a) => a.answers[0].text),
    ['a', 'b']
  );
});

test('the counters count admission: a failed revise is counted and is not a completed one (§3)', async () => {
  const flaky = await turn(
    [
      { draft, ...decl },
      { draft, ...decl },
    ],
    {
      tool: (_args, n) => {
        if (n === 1) throw new Error('transport dropped');
        return parked();
      },
    }
  );
  assert.equal(flaky.dispatched, 2, 'a failed call completed nothing, so the retry runs');
  assert.equal(flaky.out.usage.reviseDispatched, 2);
  assert.equal(flaky.out.usage.reviseUnreported, 1);
  assert.equal(flaky.out.usage.writerCallsReported, 4);
  // A result that does not report its writer calls is counted as unreported.
  const silent = await turn([{ draft, ...decl }], { tool: finished });
  assert.equal(silent.out.usage.reviseDispatched, 1);
  assert.equal(silent.out.usage.reviseUnreported, 1);
  assert.equal(silent.out.usage.writerCallsReported, 0);
});

test('across turns the guard holds while the result is in the signed history, stubbed or not (§4)', async () => {
  const first = await turn([{ draft, ...decl }]);
  const done = completedRevises(first.out.history);
  assert.equal(done.size, 1);
  assert.deepEqual([...done.values()][0].final_draft, accepted);
  // From the completed receipt, the original draft is not run again.
  const again = await turn([{ draft, ...decl }], { history: first.out.history });
  assert.equal(again.dispatched, 0);
  assert.match(again.out.calls[0].error, /already completed in an earlier turn/);
  assert.ok(again.out.calls[0].error.includes(JSON.stringify(accepted)));
  assert.equal(again.out.usage.reviseDispatched, 0);
  // The accepted song itself is a changed draft, and runs.
  assert.equal(
    (await turn([{ draft: accepted, ...decl }], { history: first.out.history })).dispatched,
    1
  );
  // Two turns later the first result is pruned to a stub: the stub keeps the
  // key, status and exit code, so the repeat is still answered, without the
  // song (the stub does not keep final_draft).
  const changed = [draft[0], 'My kettle hums beside the stove'];
  const second = await turn([{ draft: changed, ...decl }], { history: first.out.history });
  const third = await turn([{ draft, ...decl }], { history: second.out.history });
  assert.equal(third.dispatched, 0);
  const stub = third.out.history
    .flatMap((c) => c.parts || [])
    .map((p) => p.functionResponse)
    .find((fr) => fr?.name === 'lyric_revise' && fr.response?.pruned);
  assert.ok(stub && typeof stub.response.repeat_key === 'string', 'the stub keeps the key');
  assert.equal(stub.response.final_draft, undefined);
  assert.match(third.out.calls[0].error, /stopped_with_open_lines, exit 3\)\. Nothing was run/);
  // Import legacy history receipts before the byte ceiling drops their turn.
  // A result recorded before repeat keys existed still carries no key.
  const dropped = await turn([{ draft, ...decl }], {
    history: second.out.history,
    limits: { pruneMaxBytes: 1 },
  });
  assert.equal(dropped.dispatched, 0);
  assert(dropped.out.task.completed_revise_keys.length);
  const legacy = first.out.history.map((c) => ({
    ...c,
    parts: (c.parts || []).map((p) => {
      const fr = p.functionResponse;
      if (fr?.name !== 'lyric_revise') return p;
      const { repeat_key: _k, ...response } = fr.response;
      return { functionResponse: { ...fr, response } };
    }),
  }));
  assert.equal(completedRevises(legacy).size, 0);
  assert.equal((await turn([{ draft, ...decl }], { history: legacy })).dispatched, 1);
  // A refused call in the history completed nothing and carries no key.
  const refused = [
    { role: 'user', parts: [{ text: 'Revise this.' }] },
    { role: 'model', parts: [fc('lyric_revise', { draft, ...decl })] },
    {
      role: 'user',
      parts: [{ functionResponse: { name: 'lyric_revise', response: { error: 'REFUSED: x' } } }],
    },
  ];
  assert.equal(completedRevises(refused).size, 0);
});

test('not keyed: recovery, a resume, a continuation, a draft-less call, other tools', () => {
  assert.equal(reviseRepeatKey('lyric_revise', { recover_only: true, checkpoint: 'c' }), null);
  assert.equal(reviseRepeatKey('lyric_revise', { ...decl }), null);
  assert.equal(reviseRepeatKey('lyric_grade', { draft, ...decl }), null);
  // A resume (checkpoint) or a continuation (sealed state) is the run's own
  // next step, never a repeat (Jony 466263826).
  assert.equal(reviseRepeatKey('lyric_revise', { draft, ...decl, checkpoint: 'c' }), null);
  assert.equal(reviseRepeatKey('lyric_revise', { draft, ...decl, state: 's' }), null);
  // Run coordinates are not part of the work; an echoed key is ignored.
  assert.equal(
    reviseRepeatKey('lyric_revise', {
      draft,
      ...decl,
      run_id: 'run_x',
      run_revision: 3,
      repeat_key: 'echoed',
    }),
    reviseRepeatKey('lyric_revise', { draft, ...decl })
  );
  // The writer is: the tool's default is the interview writer.
  const plain = reviseRepeatKey('lyric_revise', { draft, ...decl });
  assert.equal(reviseRepeatKey('lyric_revise', { draft, ...decl, writer: 'interview' }), plain);
  assert.notEqual(reviseRepeatKey('lyric_revise', { draft, ...decl, writer: 'kitchen' }), plain);
});

// An interrupted kitchen run (Jony, #519 466263826): the result is not an
// error, carries a checkpoint, and the next call resumes it with that
// checkpoint injected. It must never be answered as a repeat.
const interrupted = () =>
  verdict({
    exit_code: 5,
    status: 'interrupted',
    certified: false,
    checkpoint: 'ckpt-1',
    replay_draft: draft,
    final_draft: accepted,
    proposer_calls: 2,
  });
const interruptThenFinish = (_args, n) => (n === 1 ? interrupted() : finished());

test('an interrupted kitchen run resumes in the same request, and its finished run is then done', async () => {
  const { dispatched, sent, out } = await turn(
    [
      { draft, ...decl },
      { draft, ...decl },
      { draft, ...decl },
    ],
    { tool: interruptThenFinish }
  );
  assert.equal(dispatched, 2, 'the resume runs; the repeat after it finished does not');
  assert.equal(sent[1].checkpoint, 'ckpt-1', 'the second call resumed from the checkpoint');
  assert.equal(repeats(out), 1);
  assert.equal(out.lyric?.resumable ?? false, false, 'the run is no longer resumable');
  // The interrupted result was never stamped done.
  const stamped = out.history
    .flatMap((c) => c.parts || [])
    .map((p) => p.functionResponse)
    .filter((fr) => fr?.name === 'lyric_revise' && fr.response && !fr.response.error)
    .map((fr) => (fr.response.verdict || fr.response).repeat_key ?? null);
  assert.equal(stamped[0], null, 'the interrupted result carries no repeat_key');
  assert.equal(typeof stamped[1], 'string', 'the finished resume carries one');
  // An interrupted call with nothing to resume from is not done either: the
  // identical retry, with no checkpoint to carry, runs.
  const bare = () => verdict({ exit_code: 5, status: 'interrupted', certified: false });
  const retry = await turn(
    [
      { draft, ...decl },
      { draft, ...decl },
    ],
    { tool: (_args, n) => (n === 1 ? bare() : finished()) }
  );
  assert.equal(retry.dispatched, 2);
  assert.equal(retry.sent[1].checkpoint, undefined);
});

test('an interrupted kitchen run resumes in the next turn (§ blocker, across turns)', async () => {
  const first = await turn([{ draft, ...decl }], { tool: interrupted });
  assert.equal(first.dispatched, 1);
  assert.equal(first.out.lyric?.resumable, true, 'turn 1 carries the resumable checkpoint');
  assert.equal(completedRevises(first.out.history).size, 0, 'nothing is recorded as done');
  const second = await turn([{ draft, ...decl }], {
    history: first.out.history,
    lyric: first.out.lyric,
    tool: finished,
  });
  assert.equal(second.dispatched, 1, 'the resume is dispatched, not answered ALREADY_DONE');
  assert.equal(second.sent[0].checkpoint, 'ckpt-1');
  assert.equal(repeats(second.out), 0);
  // A history stamped by an earlier build on an interrupted result does not
  // count either.
  const forged = first.out.history.map((c) => ({
    ...c,
    parts: (c.parts || []).map((p) => {
      const fr = p.functionResponse;
      if (fr?.name !== 'lyric_revise') return p;
      return {
        functionResponse: { ...fr, response: { ...fr.response, repeat_key: 'x'.repeat(32) } },
      };
    }),
  }));
  assert.equal(completedRevises(forged).size, 0);
});

test('a draft one writer stopped on is new work for the other writer (false repeat)', async () => {
  const interview = await turn([{ draft, ...decl }], { writer: 'interview' });
  assert.equal(interview.dispatched, 1);
  const kitchen = await turn([{ draft, ...decl }], {
    history: interview.out.history,
    lyric: interview.out.lyric,
    writer: 'kitchen',
  });
  assert.equal(kitchen.dispatched, 1, 'the kitchen runs the draft the interview stopped on');
  assert.equal(kitchen.sent[0].writer, 'kitchen');
  // The same writer again is still a repeat.
  const again = await turn([{ draft, ...decl }], {
    history: interview.out.history,
    lyric: interview.out.lyric,
    writer: 'interview',
  });
  assert.equal(again.dispatched, 0);
});

test('completed work survives default whole-turn trimming in the carried task', async () => {
  const first = await turn([{ draft, ...decl }]);
  let state = first.out;
  let dropped = false;
  for (let i = 0; i < 45; i++) {
    const next = await turn([], {
      history: state.history,
      lyric: state.lyric,
      priorTask: state.task,
      userText: 'Discuss only; do not restart. ' + 'Synthetic context. '.repeat(200),
      modelText: 'Discussion only. '.repeat(220),
    });
    state = next.out;
    if (!completedRevises(state.history).size) {
      dropped = true;
      break;
    }
  }
  assert(dropped, 'the default byte ceiling deleted the completion turn');
  assert(state.task.turns < 49, 'within the default 50-turn HTTP admission limit');
  const again = await turn([{ draft, ...decl }], {
    history: state.history,
    lyric: state.lyric,
    priorTask: state.task,
  });
  assert.equal(again.dispatched, 0, 'transcript trimming must not authorize another paid revise');
  assert.equal(repeats(again.out), 1);
  const explicit = await turn([{ draft, ...decl, new_run: true }], {
    history: state.history,
    lyric: state.lyric,
    priorTask: state.task,
  });
  assert.equal(explicit.dispatched, 1, 'explicit independent runs retain their existing semantics');
  const independent = await turn([{ draft, ...decl }]);
  assert.equal(independent.dispatched, 1, 'receipts are scoped to one conversation');
});

test('completion receipt capacity refuses new keyed work without evicting old protection', async () => {
  const keys = Array.from({ length: MAX_COMPLETED_REVISE_KEYS }, (_, i) =>
    i.toString(16).padStart(32, '0')
  );
  const key = reviseRepeatKey('lyric_revise', { draft, ...decl, writer: 'kitchen' });
  keys[0] = key;
  const priorTask = { ...task(), completed_revise_keys: keys };
  const repeated = await turn([{ draft, ...decl }], { priorTask });
  assert.equal(repeated.dispatched, 0);
  assert.equal(repeats(repeated.out), 1);
  const changed = { draft: ['A new synthetic line', draft[1]], ...decl };
  const full = await turn([changed], { priorTask });
  assert.equal(full.dispatched, 0);
  assert.match(full.out.calls[0].error, /^REVISE_RECEIPTS_FULL:/);
  assert.deepEqual(full.out.task.completed_revise_keys, keys);
  assert.equal(full.out.usage.reviseRepeated, 0, 'capacity refusal is not an observed repeat');
  const restart = await turn([{ ...changed, new_run: true }], { priorTask });
  assert.equal(restart.dispatched, 1);
  assert.deepEqual(restart.out.task.completed_revise_keys, keys);
  const held = await turn([{ draft, ...decl }], { tool: interrupted });
  const resumed = await turn([{ draft, ...decl }], {
    priorTask,
    lyric: held.out.lyric,
    tool: finished,
  });
  assert.equal(resumed.dispatched, 1, 'capacity does not block a checkpoint continuation');
  assert.equal(resumed.sent[0].checkpoint, 'ckpt-1');
  assert.deepEqual(resumed.out.task.completed_revise_keys, keys);
  const recovered = await turn([{ recover_only: true }], { priorTask });
  assert.equal(recovered.dispatched, 1, 'capacity does not block recovery-only exports');
  const room = { ...task(), completed_revise_keys: keys.slice(1) };
  const last = await turn([{ draft, ...decl }], { priorTask: room });
  assert.equal(last.dispatched, 1);
  assert.equal(last.out.task.completed_revise_keys.length, MAX_COMPLETED_REVISE_KEYS);
  assert(last.out.task.completed_revise_keys.includes(key));
});

test('completion receipts are carried by the first checkpoint after a finished revise', async () => {
  const checkpoints = [];
  const result = await turn([{ draft, ...decl }], {
    onCheckpoint: async (value) => checkpoints.push(structuredClone(value)),
  });
  assert(checkpoints.length);
  assert.deepEqual(
    checkpoints[0].task.completed_revise_keys,
    result.out.task.completed_revise_keys
  );
  assert.equal(checkpoints[0].task.completed_revise_keys.length, 1);
});

// A PARKED REWRITE IS JUDGED ON THE SUNG LINES THE TOOL READS (3PO on #866).
// A blank row or a bracketed header in the array is dropped by the revise
// tool's own normalisation, so it must not move the parked-line comparison:
// the decorated closed-line rewrite is refused exactly like the bare one.
// Line 3 is in no group and no return, so it is closed; line 2 shares line
// 1's group, so the loop's group question may move it (Andrej on #866).
const three = ['Placeholder line one', 'Placeholder line two', 'Placeholder line three'];
const threeDecl = { groups: '1,2', relation: 'class:ASSONANCE' };
const parkedThree = () =>
  verdict({
    exit_code: 3,
    status: 'stopped_with_open_lines',
    certified: false,
    loop_unresolved_lines: [1],
    final_draft: three,
  });
const rewrite = (lines) => three.map((t, i) => (lines.includes(i + 1) ? `${t} rewritten` : t));
test('a parked rewrite of a closed line is refused with or without array decoration', async () => {
  const first = { draft: three, ...threeDecl };
  const closed = rewrite([1, 3]);
  for (const sendDraft of [closed, ['', ...closed], ['[SECTION]', ...closed]]) {
    const { out, dispatched } = await turn([first, { draft: sendDraft, ...threeDecl }], {
      tool: parkedThree,
    });
    assert.equal(
      dispatched,
      1,
      `only the first revise reaches the tool: ${JSON.stringify(sendDraft)}`
    );
    assert.match(out.calls[1].error || '', /changes line\(s\) 3, which are not open/);
  }
  // A genuine change of sung-line count is refused by name, not admitted.
  const { out, dispatched } = await turn(
    [first, { draft: [...three, 'An added placeholder line'], ...threeDecl }],
    { tool: parkedThree }
  );
  assert.equal(dispatched, 1);
  assert.match(out.calls[1].error || '', /sends 4 sung line\(s\) for a 3-line song/);
  // The open line and its group partner, decorated or not, still reach the tool.
  const open = rewrite([1, 2]);
  for (const sendDraft of [open, ['[SECTION]', '', ...open]]) {
    const r = await turn([first, { draft: sendDraft, ...threeDecl }], { tool: parkedThree });
    assert.equal(r.dispatched, 2, `the open group's rewrite runs: ${JSON.stringify(sendDraft)}`);
  }
  // A letter scheme declares the same group: line 3 (X) is still closed.
  const schemeDecl = { scheme: 'AAX', relation: 'class:ASSONANCE' };
  const s = await turn(
    [
      { draft: three, ...schemeDecl },
      { draft: closed, ...schemeDecl },
    ],
    {
      tool: parkedThree,
    }
  );
  assert.equal(s.dispatched, 1);
  assert.match(s.out.calls[1].error || '', /changes line\(s\) 3, which are not open/);
});

// 3PO 6904924023: the changeable set does not depend on the order groups are
// declared in, survives line text that names an object property, and folds a
// scheme's case the way the harness does.
const parkedOn = (lines) => () =>
  verdict({
    exit_code: 3,
    status: 'stopped_with_open_lines',
    certified: false,
    loop_unresolved_lines: [1],
    final_draft: lines,
  });
const rewriteOf = (lines, at) => lines.map((t, i) => (at.includes(i + 1) ? `${t} rewritten` : t));
const second = async (lines, decl, sendDraft) =>
  turn(
    [
      { draft: lines, ...decl },
      { draft: sendDraft, ...decl },
    ],
    { tool: parkedOn(lines) }
  );

test('declared groups give the same changeable lines in either order', async () => {
  const four = ['Placeholder one', 'Placeholder two', 'Placeholder three', 'Placeholder four'];
  for (const groups of ['1,2;2,3', '2,3;1,2']) {
    const decl = { groups, relation: 'class:ASSONANCE' };
    const ok = await second(four, decl, rewriteOf(four, [1, 2]));
    assert.equal(ok.dispatched, 2, `${groups}: the open line's group runs`);
    const no = await second(four, decl, rewriteOf(four, [1, 2, 3]));
    assert.equal(no.dispatched, 1, `${groups}: a group the open line is not in stays closed`);
    assert.match(no.out.calls[1].error || '', /changes line\(s\) 3, which are not open/);
  }
});

test('line text that names an object property is read as text', async () => {
  const props = ['constructor', 'toString', '__proto__', 'constructor', 'hasOwnProperty'];
  // A group away from the open line keys the run; line 4 is line 1's text.
  const decl = { groups: '2,5', relation: 'class:ASSONANCE' };
  const ok = await second(props, decl, rewriteOf(props, [1, 4]));
  assert.equal(ok.dispatched, 2, 'the open line and its identical partner run');
  for (const at of [[2], [3], [5]]) {
    const no = await second(props, decl, rewriteOf(props, [1, ...at]));
    assert.equal(no.dispatched, 1);
    assert.match(no.out.calls[1].error || '', new RegExp(`changes line\\(s\\) ${at[0]}, which`));
  }
});

test('a mixed-case scheme keeps its rhyme partners', async () => {
  for (const scheme of ['aAX', 'AaX', 'a A x', 'A^1a¹X']) {
    const decl = { scheme, relation: 'class:ASSONANCE' };
    const ok = await second(three, decl, rewrite([1, 2]));
    assert.equal(ok.dispatched, 2, `${scheme}: lines 1 and 2 rhyme`);
    const no = await second(three, decl, rewrite([1, 3]));
    assert.equal(no.dispatched, 1, `${scheme}: line 3 is unrhymed`);
  }
});

test("the scheme reader agrees with the harness's parse, drawn by seed", async () => {
  const { execFileSync } = await import('node:child_process');
  const { schemeGroups } = _agentInternals;
  const alphabet = ['a', 'b', 'c', 'A', 'B', 'C', 'x', 'X', '.', '-', '1', '2', '^', '¹', ' '];
  let s = 7;
  const r = () => (s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const schemes = Array.from({ length: 400 }, () =>
    Array.from(
      { length: 1 + Math.floor(r() * 12) },
      () => alphabet[Math.floor(r() * alphabet.length)]
    ).join('')
  ).filter((t) => /\S/.test(t));
  const codes = JSON.parse(
    execFileSync(
      'python3',
      [
        '-B',
        '-c',
        'import json,sys; from quality.schemes import parse; print(json.dumps([parse(t) for t in json.load(sys.stdin)]))',
      ],
      { cwd: 'lyric-harness', encoding: 'utf8', input: JSON.stringify(schemes) }
    )
  );
  schemes.forEach((t, k) => {
    const want = new Map();
    codes[k].forEach((c, i) => (want.has(c) ? want.get(c) : want.set(c, []).get(c)).push(i + 1));
    const pairs = (cells) =>
      cells
        .filter((c) => c.length > 1)
        .map((c) => c.join(','))
        .sort();
    assert.deepEqual(
      pairs(schemeGroups(t)),
      pairs([...want.values()]),
      `scheme ${JSON.stringify(t)}`
    );
  });
});
