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
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  METER_LINE_DIGITS_CAP,
  METER_REQUEST_DIGITS_CAP,
  RAW_ROWS_CAP,
  ADMISSION_MAX_LINES,
  ADMISSION_MAX_LINE_CHARS,
  ADMISSION_CAUSES,
  METER_LINE_RESPONSE_BYTES,
  METER_LINE_WRAPPER_BYTES,
  METER_REQUEST_RESPONSE_BYTES,
  lineDigitBound,
  admitRecognitionArgs,
  recognitionInputOf,
} from './meter_admission.js';
import {
  MAX_LINES,
  readerPythonBridge,
  _argvInternals,
  takeLines,
  admitLyricCall,
  RUNS,
} from './lyric_tools.js';
import { buildServer } from './tools.js';
import { encodeState, continuationSemanticIdentity } from './state_codec.js';
import { requestContext } from './execution_context.js';
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

test('the per-line response figure includes the candidate rows (BB8 ruling 1)', () => {
  // Measured by lyric-harness/quality/test_meter_digit_bound.py against the
  // recognizer core: 7,507 B with the candidate rows, 5,979 B without.
  assert.equal(METER_LINE_RESPONSE_BYTES, 7_507);
  assert.equal(METER_LINE_WRAPPER_BYTES, 200);
  assert.equal(
    METER_REQUEST_RESPONSE_BYTES,
    MAX_LINES * (METER_LINE_RESPONSE_BYTES + METER_LINE_WRAPPER_BYTES)
  );
  assert.equal(METER_REQUEST_RESPONSE_BYTES, 3_568_341);
  const share = METER_REQUEST_RESPONSE_BYTES / (8 * 1024 * 1024);
  assert(share > 0.425 && share < 0.426, String(share));
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
  // Every row counts: a true duplicate (refused by the harness anyway) adds
  // its vowels, and its word leaves the undeclared rest only once.
  const dup = lineDigitBound(text, [
    { index: 1, line: text, token: 1, word: 'zyx', phones: ['AH1'] },
    { index: 2, line: text, token: 1, word: 'zyx', phones: ['AH1', 'AH0'] },
  ]);
  assert.equal(dup.declared_digits, 3);
  assert.equal(dup.undeclared_units, units - 4);
  assert.deepEqual(
    dup.contributing.map((c) => c.p),
    [1, 2]
  );
  // An opening quotation mark is not a character of the declared token.
  const quoted = '‘zyx and the sea';
  const q = lineDigitBound(quoted, [
    { index: 1, line: quoted, token: 1, word: '‘zyx', phones: ['AH1'] },
  ]);
  assert.equal(q.undeclared_units, [...quoted].length + 1 - 4);
});

test('declarations are not merged by token number: one number under two numberings is two tokens', () => {
  // Reviewer A's line. Under v1 its tokens are `U--h Lawdy U--h Lawdy`; under
  // v2 `U h Lawdy U h Lawdy`. The harness maps each row through its own
  // numbering (pronunciation.numbered_token) and accepts all four rows, as
  // v2 tokens 3, 2, 6 and 4: 512 declared digits.
  const line = 'U--h Lawdy U--h Lawdy';
  const rows = [
    [2, 'v1', 'Lawdy'],
    [2, 'v2', 'h'],
    [4, 'v1', 'Lawdy'],
    [4, 'v2', 'U'],
  ].map(([token, numbering, word]) => ({ ...decl(line, 128, token, word), numbering }));
  const b = lineDigitBound(
    line,
    rows.map((r, i) => ({ index: i + 1, ...r }))
  );
  assert.equal(b.declared_digits, 512);
  assert.deepEqual(
    b.contributing.map((c) => c.p),
    [1, 2, 3, 4]
  );
  // 22 units less the four declared tokens' (6 + 2 + 6 + 2).
  assert.equal(b.undeclared_units, 6);
  assert.equal(b.bound, 521);
  assert.throws(
    () => admitRecognitionArgs({ draft: [line], pronunciations: rows }),
    (e) =>
      e.cause === 'meter_line_digits' &&
      /L001 of `draft` could reach 521 .*\(P001 128, P002 128, P003 128, P004 128: 512 digits\)/.test(
        e.message
      )
  );
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
// The blueprint path also carries its one draft line (`a quiet line`, 19):
// 462 × 301 + 282 + 19 is the request cap exactly.
const DRAFT_LINE = 'a quiet line';
assert.equal(lineDigitBound(DRAFT_LINE).bound, 19);
const AT_REQUEST_BESIDE_DRAFT = [...Array(MAX_LINES - 1).fill(WITNESS), 'a'.repeat(187)];
assert.equal(lineDigitBound('a'.repeat(187)).bound, 282);
const OVER_REQUEST = [...AT_REQUEST, 'a'];
const OVER_REQUEST_DECL = [{ ...decl('a', 1, 1, 'a') }];

const stateWire = (lines) =>
  encodeState({ version: 1, input_draft: lines, interview: true, connector_declarations: {} });
const checkpointWire = (lines, extra = {}) =>
  encodeState({
    version: 1,
    input_draft: lines,
    accepted_lines: lines,
    answered: { propose: [], propose_group: [] },
    ...extra,
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
      lines: [DRAFT_LINE],
      scheme: 'X',
      blueprint: blueprintOf(lines),
      subdivision: 2,
      ...(pronunciations ? { pronunciations } : {}),
    },
  ],
};
// The id a refusal names for the one line of each path: the normalised
// sung-line index, except lyric_recover, whose source reader numbers its sung
// lines after setting apparatus rows aside, so its refusal names the row of
// the pasted text.
const LINE_ID = (path) =>
  path === 'recover lines_text' ? 'The line at row 1 of the pasted text' : 'L001 of `[^`]+`';
const AT_REQUEST_FOR = (path) => (path === 'blueprint' ? AT_REQUEST_BESIDE_DRAFT : AT_REQUEST);
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
        new RegExp(
          `${LINE_ID(path)}.*? could reach 302 syllable digits under its declared readings \\(P001 4: 4 digits\\)`
        )
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
        admitted(await call(path, AT_REQUEST_FOR(path)), path, 'request at cap');
        const overRequest = await call(path, OVER_REQUEST, OVER_REQUEST_DECL);
        if (path === 'blueprint') {
          // A blueprint's stored text is never recognised (BB8 ruling 2): it
          // meets the row and per-line caps above, and stays out of the total.
          admitted(overRequest, path, 'blueprint past the request total');
          assert.equal(overRequest.queued, 1, overRequest.text);
        } else refused(overRequest, 'meter_request_digits', path, 'request over');
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
      if (path === 'recover lines_text') {
        // The same bound and wording; the row, not an L id (see LINE_ID).
        assert.match(
          text,
          new RegExp(
            `RESOURCE_LIMIT: meter_line_digits — The line at row 1 of the pasted text .*? could reach ${boundOnly} `
          ),
          text
        );
        assert.equal(r.isError, true);
        continue;
      }
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
    ['state.input_draft', 'pronunciations']
  );
  assert.equal(fromState.declarations.length, 1);
  assert.throws(() => admitRecognitionArgs({ state: encodeState(held) }), /meter_line_digits/);
  // An undecodable continuation contributes nothing: the handler refuses it.
  assert.deepEqual(recognitionInputOf({ state: 'not a wire' }).sets, []);
  // `lines` as a count (the planning tools) is not a line set.
  assert.deepEqual(recognitionInputOf({ lines: 12 }).sets, []);
  // A revision's answers are not a line set: ANSWER_TOO_LONG and the
  // `answers` schema refuse them at 200 characters first, and a declared one
  // is measured as a declared line (below).
  assert.deepEqual(recognitionInputOf({ answer: 'x'.repeat(201) }).sets, []);
  const refusedCause = (args) => {
    try {
      admitRecognitionArgs(args);
      return null;
    } catch (e) {
      return e.cause;
    }
  };
  // A checkpoint: only accepted_lines over a cap still refuses (its rows,
  // which no declaration can stand in for).
  assert.equal(
    refusedCause({
      checkpoint: encodeState({
        version: 1,
        input_draft: [DRAFT_LINE],
        accepted_lines: rowsText(RAW_ROWS_CAP + 1).split('\n'),
        answered: { propose: [], propose_group: [] },
      }),
    }),
    'raw_rows'
  );
  // Every spelling of a row break counts: a lone \r, and a break inside one
  // array item (which the handler refuses later by name).
  assert.equal(refusedCause({ lines_text: 'a\r'.repeat(RAW_ROWS_CAP) + 'a' }), 'raw_rows');
  assert.equal(refusedCause({ state: stateWire(['a\n'.repeat(RAW_ROWS_CAP) + 'a']) }), 'raw_rows');
  // A checkpoint's own carried declarations count when the call sends none.
  assert.equal(
    refusedCause({
      checkpoint: checkpointWire([WITNESS], {
        connector_declarations: { pronunciations: OVER_LINE },
      }),
    }),
    'meter_line_digits'
  );
  // lyric_verify's arrays are line sets as their text twins are.
  for (const field of ['before', 'after']) {
    const other = field === 'before' ? 'after' : 'before';
    assert.throws(
      () =>
        admitRecognitionArgs({
          [field]: [WITNESS],
          [other]: [DRAFT_LINE],
          pronunciations: OVER_LINE,
        }),
      new RegExp(`meter_line_digits — L001 of \`${field}\``)
    );
  }
});

test('a declared line in no draft is measured: an answer cannot carry it past the per-line cap', async () => {
  // The harness keeps a declaration whose exact line is in no draft (it is
  // reported stale) and the revise loop reads an answer under it, by text.
  const absent = [decl(WITNESS, 128)];
  for (const args of [
    { draft: [DRAFT_LINE, 'a second line'], pronunciations: absent },
    { draft: [DRAFT_LINE], pronunciations: absent, answer: WITNESS },
    { draft: [DRAFT_LINE], pronunciations: absent, answers: [{ line: 1, text: WITNESS }] },
  ])
    assert.throws(
      () => admitLyricCall('lyric_revise', args),
      (e) =>
        e.cause === 'meter_line_digits' &&
        // Ruling (4): the P index, and the declared line's text quoted.
        e.message.includes(
          `The line ${JSON.stringify(WITNESS)}, which P001 declares readings for, is in no line set of this call, but an answer or a source reading can make it a sung line, and it could reach 426 `
        ) &&
        !/\bL\d{3}\b/.test(e.message),
      JSON.stringify(Object.keys(args))
    );
  // Reviewer A's answer: three 128-vowel rows on the answer's text.
  const answer = 'a a a';
  assert.throws(
    () =>
      admitLyricCall('lyric_revise', {
        draft: ['one two', 'three four'],
        answer,
        pronunciations: [1, 2, 3].map((t) => decl(answer, 128, t, 'a')),
      }),
    /meter_line_digits — The line "a a a", which P001, P002, P003 declare readings for, .* could reach 384 /
  );
  // A declared line no tool could ever sing (over 200 code points, or more
  // than one row) is not a sung line, so it is not measured.
  assert.doesNotThrow(() =>
    admitRecognitionArgs({ draft: [DRAFT_LINE], pronunciations: [decl('w '.repeat(101), 128)] })
  );
  // On the raw engine the wrapper refuses it before the queue.
  const { client, close } = await rawClient();
  const queue = watchQueue();
  try {
    const r = await client.callTool({
      name: 'lyric_check',
      arguments: { lines: [DRAFT_LINE, 'a second line'], scheme: 'AA', pronunciations: absent },
    });
    assert(r.isError);
    assert.match(
      textOf(r),
      /RESOURCE_LIMIT: meter_line_digits — The line "w w .*ws", which P001 declares/
    );
    assert.equal(queue.count, 0);
  } finally {
    queue.restore();
    await close();
  }
});

test('lyric_recover: rows are measured as the source reader is handed them, and named by row', () => {
  const ph = (t, line) => decl(line, 128, t, 'a');
  const sung = 'a a a';
  // Apparatus rows before the line: the refusal names row 3, not an L id the
  // source reader (which sets those rows aside) would not give.
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines: ['# credits', '---', sung],
        pronunciations: [1, 2, 3].map((t) => ph(t, sung)),
      }),
    /meter_line_digits — The line at row 3 of the pasted text \(lyric_recover numbers its sung lines after setting apparatus rows aside, so the row is named\) could reach 384 /
  );
  // A declaration on the line as the source reader reads it (a bracket span
  // resolved) is measured as a declared line.
  const read = 'cafē a a a';
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines: ['---', 'caf[=e] a a a'],
        pronunciations: [2, 3, 4].map((t) => ph(t, read)),
      }),
    /meter_line_digits — The line "cafē a a a", which P001, P002, P003 declare readings for, .* could reach 391 /
  );
  // The same declarations on lyric_check, where the line is in the draft.
  assert.throws(
    () =>
      admitLyricCall('lyric_check', {
        lines: [read],
        pronunciations: [2, 3, 4].map((t) => ph(t, read)),
      }),
    /meter_line_digits — L001 of `lines` could reach 391 /
  );
  // Blank rows of the paste are not measured lines; rows are still counted
  // (the final break ends the third row; it opens no fourth).
  const m = admitLyricCall('lyric_recover', { lines_text: '[Verse]\n\nthe line\n' });
  assert.equal(m[0].rows, 3);
  assert.deepEqual(
    m[0].lines.map((l) => l.id),
    ['row 1', 'row 3']
  );
});

test('a final line break ends the last row: 1,389 rows of `la` are admitted with or without it', () => {
  const rows = Array(RAW_ROWS_CAP).fill('la');
  const cause = (tool, args) => {
    try {
      admitLyricCall(tool, args);
      return null;
    } catch (e) {
      return e.cause;
    }
  };
  for (const [tool, field] of [
    ['lyric_grade', 'draft_text'],
    ['lyric_check', 'lines_text'],
    ['lyric_verify', 'after_text'],
    ['lyric_recover', 'lines_text'],
  ]) {
    const extra = tool === 'lyric_verify' ? { before_text: DRAFT_LINE } : {};
    for (const [ending, want] of [
      ['', null],
      ['\n', null],
      ['\r\n', null],
      ['\r', null],
      // Exactly one trailing empty row is dropped: a blank row after the
      // final break is a row.
      ['\n\n', 'raw_rows'],
      ['\r\n\r\n', 'raw_rows'],
    ]) {
      const sep = ending.startsWith('\r\n') ? '\r\n' : '\n';
      const text = rows.join(sep) + ending;
      assert.equal(
        cause(tool, { [field]: text, ...extra }),
        want,
        `${tool} ${field} ending ${JSON.stringify(ending)}`
      );
    }
    // One row more is still refused, final break or not.
    for (const ending of ['', '\n', '\r\n'])
      assert.equal(
        cause(tool, { [field]: [...rows, 'la'].join('\n') + ending, ...extra }),
        'raw_rows',
        `${tool} ${field} 1,390 rows ending ${JSON.stringify(ending)}`
      );
  }
  // The count the refusal and the measurement carry is the rows, not rows + 1.
  const m = admitRecognitionArgs({ draft_text: rows.join('\n') + '\n' });
  assert.equal(m[0].rows, RAW_ROWS_CAP);
  const r = admitLyricCall('lyric_recover', { lines_text: rows.join('\r\n') + '\r\n' });
  assert.equal(r[0].rows, RAW_ROWS_CAP);
  assert.equal(r[0].lines.at(-1).id, `row ${RAW_ROWS_CAP}`);
});

test('lyric_recover: a lone \\r is a row break in the pasted text, as on every other tool', () => {
  const cause = (args) => {
    try {
      admitLyricCall('lyric_recover', args);
      return null;
    } catch (e) {
      return e.cause;
    }
  };
  assert.equal(cause({ lines_text: 'a\r'.repeat(RAW_ROWS_CAP - 1) + 'a' }), null);
  assert.equal(cause({ lines_text: 'a\r'.repeat(RAW_ROWS_CAP) + 'a' }), 'raw_rows');
  // And the row a refusal names counts a lone \r as a break.
  const sung = 'a a a';
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines_text: `# credits\r---\r${sung}`,
        pronunciations: [1, 2, 3].map((t) => decl(sung, 128, t, 'a')),
      }),
    /meter_line_digits — The line at row 3 of the pasted text /
  );
});

// The handler reads the paste with the same split the check counts (BB8 item
// 1 on the recover handler): 463 sung rows ending in a final break pass
// checkLines' 463-line ceiling and reach the verb, whose source file holds
// exactly those rows, with no blank row written after them.
test('lyric_recover handler: 463 rows with a final break reach the verb, the file holds 463 rows', async () => {
  const { client, close } = await rawClient();
  const original = readerPythonBridge.runVerb;
  const written = [];
  readerPythonBridge.runVerb = async (args) => {
    written.push(await readFile(args.at(-1), 'utf8'));
    throw new Error(QUEUED);
  };
  try {
    const rows = Array(MAX_LINES).fill('la');
    for (const ending of ['', '\n', '\r\n', '\r']) {
      const sep = ending || '\n';
      written.length = 0;
      const r = await client.callTool({
        name: 'lyric_recover',
        arguments: { lines_text: rows.join(sep) + ending },
      });
      const text = textOf(r);
      assert.doesNotMatch(text, /between 1 and \d+ lines/, `ending ${JSON.stringify(ending)}`);
      assert.match(text, new RegExp(QUEUED), `ending ${JSON.stringify(ending)}: ${text}`);
      assert.equal(written.length, 1);
      assert.equal(written[0], rows.join('\n') + '\n', `ending ${JSON.stringify(ending)}`);
    }
    // One sung row more is still refused, with or without the final break.
    for (const ending of ['', '\n']) {
      const r = await client.callTool({
        name: 'lyric_recover',
        arguments: { lines_text: [...rows, 'la'].join('\n') + ending },
      });
      assert(r.isError);
      assert.match(
        textOf(r),
        new RegExp(`between 1 and ${MAX_LINES} lines — got ${MAX_LINES + 1}`)
      );
    }
    // The array and its text twin agree when the text ends in a break.
    const twin = { lines: ['a', 'b'], lines_text: 'a\nb\n' };
    takeLines(twin, 'lines', 'lines_text', { preserveStructure: true });
    assert.deepEqual(twin.lines, ['a', 'b']);
    // Only one final break is dropped: a blank row after it is kept.
    const blank = { lines_text: 'a\n\n' };
    takeLines(blank, 'lines', 'lines_text', { preserveStructure: true });
    assert.deepEqual(blank.lines, ['a', '']);
  } finally {
    readerPythonBridge.runVerb = original;
    await close();
  }
});

test('one total per request: the draft once, every other song the response recognises added', async () => {
  const cause = (args, tool) => {
    try {
      admitLyricCall(tool, args);
      return null;
    } catch (e) {
      return e.cause;
    }
  };
  // BB8 item 2 / ruling (2): no lyric tool's response carries recognition of
  // a blueprint's stored text (the draft's lines are fitted to its
  // placements), so 463 lines at the cap plus their blueprint is admitted.
  assert.equal(
    cause({ lines: AT_REQUEST, scheme: 'X', blueprint: blueprintOf(AT_REQUEST) }, 'lyric_check'),
    null
  );
  const measured = admitLyricCall('lyric_check', {
    lines: AT_REQUEST,
    scheme: 'X',
    blueprint: blueprintOf(AT_REQUEST),
  });
  assert.equal(measured.find((m) => m.name === 'blueprint.lines').outside_total, true);
  // ...and on the raw engine it reaches the queue.
  {
    const { client, close } = await rawClient();
    const queue = watchQueue();
    try {
      const r = await client.callTool({
        name: 'lyric_check',
        arguments: {
          lines: AT_REQUEST,
          scheme: 'X',
          blueprint: blueprintOf(AT_REQUEST),
          subdivision: 2,
        },
      });
      assert.doesNotMatch(textOf(r), /RESOURCE_LIMIT/, textOf(r).slice(0, 300));
      assert.equal(queue.count, 1);
    } finally {
      queue.restore();
      await close();
    }
  }
  // The blueprint still meets the per-line cap.
  assert.equal(
    cause(
      { lines: [DRAFT_LINE], blueprint: blueprintOf([WITNESS]), pronunciations: OVER_LINE },
      'lyric_check'
    ),
    'meter_line_digits'
  );
  // lyric_verify's two songs are one request.
  assert.equal(
    cause({ before: AT_REQUEST, after: AT_REQUEST, scheme: 'X' }, 'lyric_verify'),
    'meter_request_digits'
  );
  assert.equal(
    cause({ before: AT_REQUEST_BESIDE_DRAFT, after: [DRAFT_LINE], scheme: 'X' }, 'lyric_verify'),
    null
  );
  // The draft's spellings are one song: a continuation's input_draft and
  // accepted_lines beside the call's own draft count once, at the largest.
  assert.equal(
    cause(
      {
        draft: AT_REQUEST,
        checkpoint: checkpointWire(AT_REQUEST),
        state: stateWire(AT_REQUEST),
      },
      'lyric_revise'
    ),
    null
  );
  // The refusal names every set it summed (ruling 2), never just "the request".
  assert.throws(
    () =>
      admitLyricCall('lyric_verify', {
        before: AT_REQUEST,
        after: [DRAFT_LINE],
        scheme: 'X',
      }),
    (e) =>
      e.cause === 'meter_request_digits' &&
      e.message.includes(
        'meter_request_digits — `before` (463 lines, 139,363) and `after` (1 line, 19) together could reach 139,382 syllable digits; one request carries at most 139,363 (the per-request cap).'
      ) &&
      !/Not counted/.test(e.message) &&
      !/\bthe request\b/.test(e.message)
  );
  // ...and every set it left out, and why.
  assert.throws(
    () =>
      admitLyricCall('lyric_revise', {
        state: stateWire(OVER_REQUEST),
        blueprint: blueprintOf([DRAFT_LINE]),
        pronunciations: OVER_REQUEST_DECL,
      }),
    (e) =>
      e.cause === 'meter_request_digits' &&
      e.message.includes(
        'meter_request_digits — the draft `state.input_draft` (464 lines, 139,364) could reach 139,364 syllable digits; one request carries at most 139,363'
      ) &&
      e.message.includes(
        "Not counted, because no response carries their recognition: `blueprint.lines` (its stored text is not read; the draft's lines are fitted to its placements); the pronunciations' own lines"
      ) &&
      JSON.stringify(e.detail.not_counted) === JSON.stringify(['blueprint.lines', 'pronunciations'])
  );
});

// BB8 items 5-8 and 10: each test below fails under the mutant named.
test('mutant guards: check order, declared-only lines, the draft at its largest, fewest units', () => {
  const cause = (args) => {
    try {
      admitRecognitionArgs(args);
      return null;
    } catch (e) {
      return e.cause;
    }
  };
  // (5) Per line before per request: one line over 301 AND a total over
  // 139,363 is refused for the line.
  assert.equal(cause({ state: stateWire([...AT_REQUEST, 'x'.repeat(250)]) }), 'meter_line_digits');
  // (6) Declared-only lines stay out of the total: a draft at exactly
  // 139,363 plus a declared line in no draft is admitted.
  const elsewhere = 'a line no draft holds';
  assert(lineDigitBound(elsewhere, [{ index: 1, ...decl(elsewhere, 3, 1, 'a') }]).bound > 0);
  assert.equal(
    cause({ state: stateWire(AT_REQUEST), pronunciations: [decl(elsewhere, 3, 1, 'a')] }),
    null
  );
  // (7) The draft family is counted at its LARGEST spelling, whichever set
  // holds it.
  assert.equal(
    cause({
      draft: [DRAFT_LINE],
      state: stateWire(OVER_REQUEST),
      pronunciations: OVER_REQUEST_DECL,
    }),
    'meter_request_digits'
  );
  assert.equal(
    cause({
      draft: OVER_REQUEST,
      state: stateWire([DRAFT_LINE]),
      pronunciations: OVER_REQUEST_DECL,
    }),
    'meter_request_digits'
  );
  // (8) Two rows at one (numbering, token) take out the FEWEST units their
  // words name: taking out more would lower the bound below what the
  // recognizer can reach.
  const text = 'zyx and the sea';
  const units = [...text].length + 1;
  const two = lineDigitBound(text, [
    { index: 1, line: text, token: 1, numbering: 'v2', word: 'zyxzyx', phones: ['AH1'] },
    { index: 2, line: text, token: 1, numbering: 'v2', word: 'zyx', phones: ['AH1'] },
  ]);
  assert.equal(two.undeclared_units, units - 4);
  const reversed = lineDigitBound(text, [
    { index: 1, line: text, token: 1, numbering: 'v2', word: 'zyx', phones: ['AH1'] },
    { index: 2, line: text, token: 1, numbering: 'v2', word: 'zyxzyx', phones: ['AH1'] },
  ]);
  assert.equal(reversed.undeclared_units, units - 4);
  // (10) A declared line of more than one row can never be sung, so it is
  // not measured, even far over the cap.
  for (const br of ['\n', '\r', '\r\n', '\u2028', '\u2029'])
    assert.equal(
      cause({ draft: [DRAFT_LINE], pronunciations: [decl(`a${br}b`, 400, 1, 'a')] }),
      null,
      JSON.stringify(br)
    );
  assert.equal(
    cause({ draft: [DRAFT_LINE], pronunciations: [decl('a b', 400, 1, 'a')] }),
    'meter_line_digits'
  );
});

test('a run this process holds is measured with what it carries in; an export is not measured', async () => {
  const rec = RUNS.put('admission-test', {
    draft: [WITNESS],
    decl: { pronunciations: OVER_LINE },
  });
  try {
    assert.throws(
      () =>
        admitLyricCall('lyric_revise', {
          run_id: rec.run_id,
          run_revision: rec.revision,
          answer: DRAFT_LINE,
        }),
      /meter_line_digits — L001 of `draft` could reach 302 /
    );
    // A checkpoint run carries its replay_draft, not the displayed draft.
    const replayed = RUNS.put('admission-test-replay', {
      draft: [DRAFT_LINE],
      replay_draft: rowsText(RAW_ROWS_CAP + 1).split('\n'),
    });
    try {
      assert.throws(
        () =>
          admitLyricCall('lyric_revise', {
            run_id: replayed.run_id,
            run_revision: replayed.revision,
            answer: DRAFT_LINE,
          }),
        /RESOURCE_LIMIT: raw_rows — `draft` has 1,390 raw rows/
      );
    } finally {
      RUNS.del(replayed.run_id);
    }
    const { client, close } = await rawClient();
    const queue = watchQueue();
    try {
      const r = await client.callTool({
        name: 'lyric_revise',
        arguments: { run_id: rec.run_id, run_revision: rec.revision, answer: DRAFT_LINE },
      });
      assert.match(textOf(r), /RESOURCE_LIMIT: meter_line_digits/);
      assert.equal(queue.count, 0);
      // recover_only exports a held journal and queues no recognition: an
      // over-cap wire is still exported, so a legacy run stays recoverable.
      const wire = stateWire([WITNESS]);
      assert.equal(
        admitLyricCall('lyric_revise', {
          recover_only: true,
          state: wire,
          pronunciations: OVER_LINE,
        }),
        null
      );
      const exported = await client.callTool({
        name: 'lyric_revise',
        arguments: {
          recover_only: true,
          state: checkpointWire([WITNESS], {
            connector_declarations: { pronunciations: OVER_LINE },
          }),
        },
      });
      assert.doesNotMatch(textOf(exported), /RESOURCE_LIMIT/);
    } finally {
      queue.restore();
      await close();
    }
  } finally {
    RUNS.del(rec.run_id);
  }
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
        name: 'lyric_verify',
        arguments: { before: AT_REQUEST, after: [DRAFT_LINE], scheme: 'X' },
      },
    ],
  ];
  for (const [cause, call] of over) {
    const text = await sessionRefusal(call);
    assert.match(text, new RegExp(`RESOURCE_LIMIT: ${cause} — `), text);
  }
  for (const [name, args] of [
    ['lyric_check', { lines: [WITNESS], scheme: 'X', pronunciations: AT_LINE }],
    ['lyric_check', { lines_text: rowsText(RAW_ROWS_CAP), scheme: 'X' }],
    ['lyric_check', { lines_text: rowsText(RAW_ROWS_CAP) + '\n', scheme: 'X' }],
    ['lyric_verify', { before: AT_REQUEST_BESIDE_DRAFT, after: [DRAFT_LINE], scheme: 'X' }],
    // A blueprint's stored text stays out of the total (BB8 ruling 2).
    [
      'lyric_check',
      { lines: AT_REQUEST, scheme: 'X', blueprint: blueprintOf(AT_REQUEST), subdivision: 2 },
    ],
  ]) {
    const h = await sessionHarness();
    try {
      const r = await h.client.callTool({
        name,
        arguments: { ...args, session_id: h.session_id },
      });
      assert(!r.isError, textOf(r));
      await Promise.all([...h.sessions.active.values()]);
      assert.deepEqual(h.executed, [name]);
    } finally {
      await h.close();
    }
  }
});

// ── /mcp: a continuation is measured with the run the session carries ────
test('/mcp: a revision continuation and a resume are refused with their carried run, nothing queued', async () => {
  const { JobStore } = await import('./job_store.js');
  const { WorkflowSessions } = await import('./workflow_sessions.js');
  const executed = [];
  let mode = 'suspend';
  const sessions = new WorkflowSessions({
    store: new JobStore(),
    execute: async (session, name) => {
      executed.push(name);
      if (mode === 'suspend') {
        // The engine's answer: a suspended run whose carried args hold the
        // over-cap line and its declaration.
        const next = structuredClone(session);
        next.native.continuation = {
          seed: 1,
          args: { draft: [WITNESS], pronunciations: OVER_LINE },
        };
        return { session: next, result: { content: [{ type: 'text', text: '{}' }] } };
      }
      // An interrupted revision with a resumable checkpoint.
      requestContext().onCheckpoint({
        status: 'suspended',
        input_draft: [WITNESS],
        accepted_lines: [WITNESS],
        answered: { propose: [], propose_group: [] },
        connector_declarations: { seed: 1, pronunciations: OVER_LINE },
        connector_semantic_identity: continuationSemanticIdentity(),
      });
      throw new Error('worker lost');
    },
  });
  const settle = () => Promise.all([...sessions.active.values()]);
  const open = () => sessions.open('lyrics', { phase: 'edit' }).session_id;
  const first = sessions.submit(open(), 'lyrics', 'lyric_revise', {
    draft: [DRAFT_LINE],
    scheme: 'X',
  });
  await settle();
  assert.throws(
    () => sessions.submit(first.operation_id, 'lyrics', 'lyric_revise', { answer: DRAFT_LINE }),
    (e) =>
      e.code === 'RESOURCE_LIMIT' &&
      /meter_line_digits — L001 of `draft` could reach 302 /.test(e.message)
  );
  assert.equal(sessions.queued.size, 0);
  assert.deepEqual(executed, ['lyric_revise']);
  mode = 'interrupt';
  const second = sessions.submit(open(), 'lyrics', 'lyric_revise', {
    draft: [DRAFT_LINE],
    scheme: 'X',
  });
  await settle();
  assert.equal(sessions.status(second.operation_id, 'lyrics').resumable, true);
  assert.throws(
    () => sessions.resume(second.operation_id, 'lyrics'),
    (e) => e.code === 'RESOURCE_LIMIT' && /meter_line_digits/.test(e.message)
  );
  assert.equal(sessions.queued.size, 0);
  assert.equal(sessions.active.size, 0);
  assert.deepEqual(executed, ['lyric_revise', 'lyric_revise']);
});
