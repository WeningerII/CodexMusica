// #677 W5: the recognition caps run before anything is queued, on every path,
// with one decision rule. BB8 6692374129; R2 6692298979.
//
// For each path a lyric call reaches the queue by — `draft[]`, `draft_text`
// and the other text twins, a `state` or `checkpoint` continuation, a declared
// `blueprint`, and the shared `/mcp` endpoint before submit — this file shows:
// at the cap the call is admitted (it reaches the queue), one over it is
// refused with RESOURCE_LIMIT and its cause, and nothing was queued. The raw
// paths' queue is the Python bridge's admission (`readerPythonBridge.admit`,
// the call every lyric handler makes first); the /mcp queue is the session
// store and its operation set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  METER_LINE_DIGITS_CAP,
  METER_REQUEST_DIGITS_CAP,
  RAW_ROWS_CAP,
  ADMISSION_MAX_LINES,
  ADMISSION_MAX_LINE_CHARS,
  ADMISSION_CAUSES,
  lineDigitBound,
  admitRecognitionArgs,
  recognitionInputOf,
} from './meter_admission.js';
import { MAX_LINES, readerPythonBridge, _argvInternals, takeLines } from './lyric_tools.js';
import { buildServer } from './tools.js';
import { encodeState } from './state_codec.js';
import { draftFromText } from './lyric_text.js';

// ── the values and their derivation ──────────────────────────────────────
test('the caps are the confirmed values, derived from the connector ceilings', () => {
  assert.equal(ADMISSION_MAX_LINES, MAX_LINES);
  // checkLines' own character ceiling: 200 code points pass, 201 refuse.
  _argvInternals.checkLines(['x'.repeat(ADMISSION_MAX_LINE_CHARS)]);
  assert.throws(
    () => _argvInternals.checkLines(['x'.repeat(ADMISSION_MAX_LINE_CHARS + 1)]),
    /line over 200 chars/
  );
  assert.equal(METER_LINE_DIGITS_CAP, 301);
  assert.equal(METER_LINE_DIGITS_CAP, Math.floor(1.5 * (ADMISSION_MAX_LINE_CHARS + 1)));
  assert.equal(METER_REQUEST_DIGITS_CAP, 139_363);
  assert.equal(METER_REQUEST_DIGITS_CAP, MAX_LINES * METER_LINE_DIGITS_CAP);
  assert.equal(RAW_ROWS_CAP, 1_389);
  assert.equal(RAW_ROWS_CAP, 3 * MAX_LINES);
  assert.deepEqual(ADMISSION_CAUSES, ['raw_rows', 'meter_line_digits', 'meter_request_digits']);
});

test('an undeclared line is costed at 1.5 digits per unit; the witness line is exactly at the cap', () => {
  const witness = 'w '.repeat(99) + 'ws';
  assert.equal([...witness].length, 200);
  assert.equal(lineDigitBound(witness).bound, 301);
  // Code points, as checkLines counts: 200 astral characters are 200 units.
  assert.equal(lineDigitBound('\u{1F600}'.repeat(200)).bound, 301);
  assert.equal(lineDigitBound('x'.repeat(201)).bound, 303);
  // So no line the tools accept (<= 200 code points) is refused undeclared.
  for (let n = 1; n <= 200; n++)
    assert(lineDigitBound('a'.repeat(n)).bound <= METER_LINE_DIGITS_CAP);
});

test('a declared line: the stressed vowels of each declared reading plus 1.5 per undeclared unit', () => {
  const line = 'zyx ' + 'and the sea '.repeat(16);
  const text = line.trim();
  const phones = Array(128).fill('AH0');
  const b = lineDigitBound(text, [{ index: 2, line: text, token: 1, word: 'zyx', phones }]);
  const units = [...text].length + 1;
  assert.equal(b.declared_digits, 128);
  assert.equal(b.undeclared_units, units - 4);
  assert.equal(b.bound, 128 + Math.floor((3 * (units - 4)) / 2));
  assert.deepEqual(b.contributing, [{ p: 2, token: 1, digits: 128 }]);
  // A declaration for another line, or a consonant, adds nothing.
  assert.equal(
    lineDigitBound(text, [{ index: 1, line: 'other', token: 1, word: 'zyx', phones }]).bound,
    lineDigitBound(text).bound
  );
  assert.equal(
    lineDigitBound(text, [{ index: 1, line: text, token: 1, word: 'zyx', phones: ['K', 'AH1'] }])
      .declared_digits,
    1
  );
  // One reading per token: a duplicate is counted once, at its largest.
  const dup = lineDigitBound(text, [
    { index: 1, line: text, token: 1, word: 'zyx', phones: ['AH1'] },
    { index: 2, line: text, token: 1, word: 'zyx', phones: ['AH1', 'AH0'] },
  ]);
  assert.equal(dup.declared_digits, 2);
  assert.equal(dup.undeclared_units, units - 4);
});

// ── fixtures ─────────────────────────────────────────────────────────────
const WITNESS = 'w '.repeat(99) + 'ws'; // 200 chars, bound 301
const decl = (line, vowels, token = 1, word = 'w') => ({
  line,
  token,
  word,
  phones: Array(vowels).fill('AH0'),
  basis: 'declared',
  source: 'admission fixture',
});
// Declaring token 1 (`w`, 2 units) with k vowels: 298 + k. k = 3 is the cap,
// k = 4 is one over it.
const AT_LINE = [decl(WITNESS, 3)];
const OVER_LINE = [decl(WITNESS, 4)];
assert.equal(lineDigitBound(WITNESS, [{ index: 1, ...AT_LINE[0] }]).bound, METER_LINE_DIGITS_CAP);
assert.equal(
  lineDigitBound(WITNESS, [{ index: 1, ...OVER_LINE[0] }]).bound,
  METER_LINE_DIGITS_CAP + 1
);
// BB8 condition 1's line: its bound is over the cap, its real count is not
// (one declared 128-vowel token and ordinary words; the reader reads the
// declared reading and a few dozen dictionary syllables).
const BOUND_ONLY = ('zyx ' + 'and the sea '.repeat(16)).trim();
const BOUND_ONLY_DECL = [decl(BOUND_ONLY, 128, 1, 'zyx')];
const boundOnly = lineDigitBound(BOUND_ONLY, [{ index: 1, ...BOUND_ONLY_DECL[0] }]).bound;
assert(boundOnly > METER_LINE_DIGITS_CAP && 128 + 3 * 48 < METER_LINE_DIGITS_CAP);

const rowsText = (n) => '\n'.repeat(n - 1) + 'the only sung line';
// 463 lines at 301 is the request cap exactly; a further declared one-letter
// line at one digit is one over it (only a continuation or a blueprint can
// carry more than 463 lines past the schema).
const AT_REQUEST = Array(MAX_LINES).fill(WITNESS);
const OVER_REQUEST = [...AT_REQUEST, 'a'];
const OVER_REQUEST_DECL = [{ ...decl('a', 1, 1, 'a') }];

const stateWire = (lines) =>
  encodeState({ version: 1, input_draft: lines, interview: true, connector_declarations: {} });
const checkpointWire = (lines) =>
  encodeState({
    version: 1,
    input_draft: lines,
    accepted_lines: lines,
    answered: { propose: [], propose_group: [] },
  });
const blueprintOf = (lines) =>
  JSON.stringify({
    sections: [],
    lines: lines.map((text, i) => ({ text, bar: i + 1, beat: 1, duration: 4 })),
  });

// Each raw path: the tool, and the arguments that carry `lines` (an array of
// physical rows) and `pronunciations` on it.
const RAW_PATHS = {
  'draft[]': (lines, pronunciations) => [
    'lyric_grade',
    { seed: 1, draft: lines, ...(pronunciations ? { pronunciations } : {}) },
  ],
  draft_text: (lines, pronunciations) => [
    'lyric_grade',
    { seed: 1, draft_text: lines.join('\n'), ...(pronunciations ? { pronunciations } : {}) },
  ],
  'lines[]': (lines, pronunciations) => [
    'lyric_check',
    { lines, scheme: 'X', ...(pronunciations ? { pronunciations } : {}) },
  ],
  lines_text: (lines, pronunciations) => [
    'lyric_check',
    { lines_text: lines.join('\n'), scheme: 'X', ...(pronunciations ? { pronunciations } : {}) },
  ],
  after_text: (lines, pronunciations) => [
    'lyric_verify',
    {
      before_text: 'a quiet line',
      after_text: lines.join('\n'),
      scheme: 'X',
      ...(pronunciations ? { pronunciations } : {}),
    },
  ],
  'recover lines_text': (lines, pronunciations) => [
    'lyric_recover',
    { lines_text: lines.join('\n'), ...(pronunciations ? { pronunciations } : {}) },
  ],
  state: (lines, pronunciations) => [
    'lyric_revise',
    { state: stateWire(lines), ...(pronunciations ? { pronunciations } : {}) },
  ],
  checkpoint: (lines, pronunciations) => [
    'lyric_revise',
    { checkpoint: checkpointWire(lines), ...(pronunciations ? { pronunciations } : {}) },
  ],
  blueprint: (lines, pronunciations) => [
    'lyric_check',
    {
      lines: ['a quiet line'],
      scheme: 'X',
      blueprint: blueprintOf(lines),
      subdivision: 2,
      ...(pronunciations ? { pronunciations } : {}),
    },
  ],
};
// The array paths cannot carry more than MAX_LINES items or a 201-character
// item: the published schema refuses them before any handler. Their raw-row
// and request caps are therefore reached only through the paths that can.
const SCHEMA_BOUND = new Set(['draft[]', 'lines[]']);
const TEXT_BOUND = new Set(['draft_text', 'lines_text', 'after_text', 'recover lines_text']);

// ── the raw engine: the tool wrapper refuses before the bridge's queue ───
async function rawClient() {
  const server = buildServer({ kitchen: true });
  const client = new Client({ name: 'meter-admission', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, close: () => Promise.all([client.close(), server.close()]) };
}
// Counts every admission to the Python queue and stops the call there, so an
// admitted call is seen reaching the queue without running the harness.
const QUEUED = 'ADMISSION_TEST_QUEUED';
function watchQueue() {
  const original = readerPythonBridge.admit;
  let count = 0;
  readerPythonBridge.admit = () => {
    count++;
    throw new Error(QUEUED);
  };
  return {
    get count() {
      return count;
    },
    restore: () => {
      readerPythonBridge.admit = original;
    },
  };
}
const textOf = (r) => r.content.map((c) => c.text).join('\n');

test('every raw path: at the cap admitted, one over refused with RESOURCE_LIMIT and its cause, nothing queued', async () => {
  const { client, close } = await rawClient();
  const queue = watchQueue();
  try {
    const call = async (path, lines, pron) => {
      const [name, args] = RAW_PATHS[path](lines, pron);
      const before = queue.count;
      const r = await client.callTool({ name, arguments: args });
      return { text: textOf(r), isError: r.isError, queued: queue.count - before };
    };
    const refused = (r, cause, path, what) => {
      assert(r.isError, `${path} ${what}: ${r.text}`);
      assert.match(r.text, new RegExp(`RESOURCE_LIMIT: ${cause} — `), `${path} ${what}`);
      assert.match(r.text, /Nothing was queued; no line was truncated or renumbered\./);
      assert.equal(r.queued, 0, `${path} ${what}: nothing reaches the queue`);
    };
    const admitted = (r, path, what) => {
      assert.doesNotMatch(r.text, /RESOURCE_LIMIT/, `${path} ${what}: ${r.text.slice(0, 300)}`);
    };
    for (const path of Object.keys(RAW_PATHS)) {
      // Per line.
      admitted(await call(path, [WITNESS], AT_LINE), path, 'line at cap');
      const over = await call(path, [WITNESS], OVER_LINE);
      refused(over, 'meter_line_digits', path, 'line over cap');
      assert.match(
        over.text,
        /L001 of `[^`]+` could reach 302 syllable digits under its declared readings \(P001 4: 4 digits\)/
      );
      assert.match(over.text, /the per-line cap is 301/);
      assert.doesNotMatch(over.text, /\bhas 302\b/);
      if (!SCHEMA_BOUND.has(path)) {
        // Raw rows.
        admitted(await call(path, rowsText(RAW_ROWS_CAP).split('\n')), path, 'rows at cap');
        refused(
          await call(path, rowsText(RAW_ROWS_CAP + 1).split('\n')),
          'raw_rows',
          path,
          'rows over'
        );
      }
      if (!SCHEMA_BOUND.has(path) && !TEXT_BOUND.has(path)) {
        // Per request: 463 × 301 admitted, one digit more refused.
        admitted(await call(path, AT_REQUEST), path, 'request at cap');
        refused(
          await call(path, OVER_REQUEST, OVER_REQUEST_DECL),
          'meter_request_digits',
          path,
          'request over'
        );
      }
    }
    // An admitted call goes on to the queue: the check is before it, not instead.
    const reached = await call('draft_text', [WITNESS]);
    assert.equal(reached.queued, 1, reached.text);
  } finally {
    queue.restore();
    await close();
  }
});

test("BB8's control: 500 blank rows and one sung line are admitted, and that line is L001", async () => {
  const text = '\n'.repeat(500) + 'the only sung line';
  const measured = admitRecognitionArgs({ draft_text: text });
  assert.equal(measured[0].rows, 501);
  assert.deepEqual(
    measured[0].lines.map((l) => l.id),
    ['L001']
  );
  // The same numbering the tool reads: the handler's draft is that one line.
  const a = { draft_text: text };
  takeLines(a, 'draft', 'draft_text');
  assert.deepEqual(a.draft, ['the only sung line']);
  assert.deepEqual(draftFromText(text), a.draft);
  const { client, close } = await rawClient();
  const queue = watchQueue();
  try {
    for (const [name, args] of [
      ['lyric_grade', { seed: 1, draft_text: text }],
      ['lyric_check', { lines_text: text, scheme: 'X' }],
      ['lyric_revise', { state: stateWire(text.split('\n')) }],
    ]) {
      const r = await client.callTool({ name, arguments: args });
      assert.doesNotMatch(textOf(r), /RESOURCE_LIMIT/, name);
    }
  } finally {
    queue.restore();
    await close();
  }
});

test('one decision rule: a line whose bound is over the cap but whose count is not is refused identically on every path', async () => {
  const { client, close } = await rawClient();
  const queue = watchQueue();
  const seen = [];
  try {
    for (const path of Object.keys(RAW_PATHS)) {
      const [name, args] = RAW_PATHS[path]([BOUND_ONLY], BOUND_ONLY_DECL);
      const r = await client.callTool({ name, arguments: args });
      const text = textOf(r);
      const m = text.match(
        /RESOURCE_LIMIT: meter_line_digits — (L\d{3}) of `[^`]+` (could reach [\d,]+ syllable digits under its declared readings \(P001 128: 128 digits\) and 1\.5 digits per unit for its [\d,]+ undeclared units; the per-line cap is 301\.)/
      );
      assert(m, `${path}: ${text}`);
      seen.push(m[1] + ' ' + m[2]);
    }
    const sessionText = await sessionRefusal({
      name: 'lyric_check',
      arguments: { lines: [BOUND_ONLY], scheme: 'X', pronunciations: BOUND_ONLY_DECL },
    });
    const m = sessionText.match(
      /RESOURCE_LIMIT: meter_line_digits — (L\d{3}) of `[^`]+` (could reach .*? cap is 301\.)/
    );
    assert(m, sessionText);
    seen.push(m[1] + ' ' + m[2]);
    assert.equal(new Set(seen).size, 1, seen.join('\n'));
    assert.match(seen[0], new RegExp(`^L001 could reach ${boundOnly} `));
    assert.equal(queue.count, 0);
  } finally {
    queue.restore();
    await close();
  }
});

test('the checks run in order: rows, then lines, then the request', () => {
  // Over all three: rows decide. Over lines and request: lines decide.
  const many = Array(RAW_ROWS_CAP + 1).fill('x'.repeat(250));
  const code = (args) => {
    try {
      admitRecognitionArgs(args);
      return null;
    } catch (e) {
      return e.code;
    }
  };
  // Multi-fault fixtures assert only the code (BB8); single-fault ones the cause.
  assert.equal(code({ state: stateWire(many) }), 'RESOURCE_LIMIT');
  const cause = (args) => {
    try {
      admitRecognitionArgs(args);
    } catch (e) {
      return e.cause;
    }
  };
  assert.equal(cause({ draft_text: rowsText(RAW_ROWS_CAP + 1) }), 'raw_rows');
  assert.equal(cause({ draft: [WITNESS], pronunciations: OVER_LINE }), 'meter_line_digits');
  assert.equal(
    cause({ state: stateWire(OVER_REQUEST), pronunciations: OVER_REQUEST_DECL }),
    'meter_request_digits'
  );
  // The order is the code's, not the fixture's: a set over rows refuses as
  // rows even when an earlier set is over a line.
  assert.equal(
    cause({ draft: [WITNESS], pronunciations: OVER_LINE, lines_text: rowsText(RAW_ROWS_CAP + 1) }),
    'raw_rows'
  );
});

test('the line sets are what the handler reads, continuations and declarations included', () => {
  const held = {
    version: 1,
    input_draft: [WITNESS],
    connector_declarations: { pronunciations: OVER_LINE },
  };
  // A continuation's own declarations count when the call sends none.
  const fromState = recognitionInputOf({ state: encodeState(held) });
  assert.deepEqual(
    fromState.sets.map((s) => s.name),
    ['state.input_draft']
  );
  assert.equal(fromState.declarations.length, 1);
  assert.throws(() => admitRecognitionArgs({ state: encodeState(held) }), /meter_line_digits/);
  // An undecodable continuation contributes nothing: the handler refuses it.
  assert.deepEqual(recognitionInputOf({ state: 'not a wire' }).sets, []);
  // `lines` as a count (the planning tools) is not a line set.
  assert.deepEqual(recognitionInputOf({ lines: 12 }).sets, []);
  // A revision's answers are not a line set: ANSWER_TOO_LONG and the
  // `answers` schema refuse them at 200 characters first.
  assert.deepEqual(recognitionInputOf({ answer: 'x'.repeat(201) }).sets, []);
});

// ── /mcp: the session endpoint refuses before submit queues anything ─────
async function sessionHarness() {
  const { JobStore } = await import('./job_store.js');
  const { WorkflowSessions } = await import('./workflow_sessions.js');
  const { buildWorkflowServer } = await import('./workflow_tools.js');
  const executed = [];
  const sessions = new WorkflowSessions({
    store: new JobStore(),
    // A stand-in for the engine: an admitted call is seen being executed.
    execute: async (session, name) => {
      executed.push(name);
      return { session, result: { content: [{ type: 'text', text: '{}' }] } };
    },
  });
  const server = await buildWorkflowServer({ sessions, compatibility: true });
  const client = new Client({ name: 'meter-admission-session', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  const begun = await client.callTool({ name: 'begin_lyrics', arguments: { phase: 'edit' } });
  assert(!begun.isError, JSON.stringify(begun));
  return {
    client,
    sessions,
    executed,
    session_id: begun.structuredContent.session_id,
    close: () => Promise.all([client.close(), server.close()]),
  };
}
async function sessionRefusal(call) {
  const h = await sessionHarness();
  try {
    const r = await h.client.callTool({
      ...call,
      arguments: { ...call.arguments, session_id: h.session_id },
    });
    assert(r.isError, JSON.stringify(r));
    assert.equal(h.sessions.queued.size, 0);
    assert.equal(h.sessions.active.size, 0);
    assert.deepEqual(h.executed, []);
    return textOf(r);
  } finally {
    await h.close();
  }
}

test('/mcp: every cap refuses before submit queues an operation; at the cap the call is queued', async () => {
  const over = [
    [
      'meter_line_digits',
      {
        name: 'lyric_check',
        arguments: { lines: [WITNESS], scheme: 'X', pronunciations: OVER_LINE },
      },
    ],
    [
      'raw_rows',
      { name: 'lyric_check', arguments: { lines_text: rowsText(RAW_ROWS_CAP + 1), scheme: 'X' } },
    ],
    [
      'meter_request_digits',
      {
        name: 'lyric_check',
        arguments: {
          lines: ['a quiet line'],
          scheme: 'X',
          blueprint: blueprintOf(OVER_REQUEST),
          subdivision: 2,
          pronunciations: OVER_REQUEST_DECL,
        },
      },
    ],
  ];
  for (const [cause, call] of over) {
    const text = await sessionRefusal(call);
    assert.match(text, new RegExp(`RESOURCE_LIMIT: ${cause} — `), text);
  }
  for (const args of [
    { lines: [WITNESS], scheme: 'X', pronunciations: AT_LINE },
    { lines_text: rowsText(RAW_ROWS_CAP), scheme: 'X' },
    { lines: ['a quiet line'], scheme: 'X', blueprint: blueprintOf(AT_REQUEST), subdivision: 2 },
  ]) {
    const h = await sessionHarness();
    try {
      const r = await h.client.callTool({
        name: 'lyric_check',
        arguments: { ...args, session_id: h.session_id },
      });
      assert(!r.isError, textOf(r));
      await Promise.all([...h.sessions.active.values()]);
      assert.deepEqual(h.executed, ['lyric_check']);
    } finally {
      await h.close();
    }
  }
});
