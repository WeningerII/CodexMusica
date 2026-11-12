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
//
// 2026-11-12 (#851): the line limit is 512 characters (it was 200) and the
// per-line cap 769 (it was 301). The request total did not move: 139,363,
// what 463 lines of 200 characters can reach. So this file has two witness
// lines where it had one (see the fixtures), every per-line scenario sits at
// the new boundary, and the tests marked (#851) hold what the rise changed:
// where an over-long line is refused, that long lines spend the same total
// sooner, and that a revision's answers are counted with their draft.
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
  REQUEST_BUDGET_LINE_CHARS,
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
  // checkLines' own character ceiling: 512 code points pass, 513 refuse.
  assert.equal(ADMISSION_MAX_LINE_CHARS, 512);
  _argvInternals.checkLines(['x'.repeat(ADMISSION_MAX_LINE_CHARS)]);
  assert.throws(
    () => _argvInternals.checkLines(['x'.repeat(ADMISSION_MAX_LINE_CHARS + 1)]),
    /line over 512 chars/
  );
  assert.equal(METER_LINE_DIGITS_CAP, 769);
  assert.equal(METER_LINE_DIGITS_CAP, Math.floor(1.5 * (ADMISSION_MAX_LINE_CHARS + 1)));
  // 2026-11-12 (#851): this test held the request total to MAX_LINES times
  // the per-line cap. That stopped being the design when the line limit rose
  // and the total did not: the total is 463 lines at what a line of
  // REQUEST_BUDGET_LINE_CHARS (200, the limit as it was) can reach, 463 × 301,
  // and the per-line cap times the line ceiling is far over it.
  assert.equal(REQUEST_BUDGET_LINE_CHARS, 200);
  assert(REQUEST_BUDGET_LINE_CHARS <= ADMISSION_MAX_LINE_CHARS);
  assert.equal(METER_REQUEST_DIGITS_CAP, 139_363);
  assert.equal(
    METER_REQUEST_DIGITS_CAP,
    MAX_LINES * Math.floor(1.5 * (REQUEST_BUDGET_LINE_CHARS + 1))
  );
  assert.equal(METER_REQUEST_DIGITS_CAP, 463 * 301);
  assert.equal(MAX_LINES * METER_LINE_DIGITS_CAP, 356_047);
  assert(METER_REQUEST_DIGITS_CAP < MAX_LINES * METER_LINE_DIGITS_CAP);
  assert.equal(RAW_ROWS_CAP, 1_389);
  assert.equal(RAW_ROWS_CAP, 3 * MAX_LINES);
  assert.deepEqual(ADMISSION_CAUSES, ['raw_rows', 'meter_line_digits', 'meter_request_digits']);
});

test('the per-line response figure includes the candidate rows (BB8 ruling 1)', () => {
  // Measured by lyric-harness/quality/test_meter_digit_bound.py against the
  // recognizer core: 7,507 B with the candidate rows, 5,979 B without. That
  // is a line of 301 digits, the 200-character line the request total is
  // sized for; nothing is measured for a line of 302-769 digits (#851, the
  // module's own note), and these figures did not move with the line limit.
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
  const witness = 'w '.repeat(255) + 'ws';
  assert.equal([...witness].length, 512);
  assert.equal(lineDigitBound(witness).bound, 769);
  assert.equal(lineDigitBound(witness).bound, METER_LINE_DIGITS_CAP);
  // Code points, as checkLines counts: 512 astral characters are 512 units.
  assert.equal(lineDigitBound('\u{1F600}'.repeat(512)).bound, 769);
  assert.equal(lineDigitBound('x'.repeat(513)).bound, 771);
  // So no line the tools accept (<= 512 code points) is refused undeclared.
  for (let n = 1; n <= ADMISSION_MAX_LINE_CHARS; n++)
    assert(lineDigitBound('a'.repeat(n)).bound <= METER_LINE_DIGITS_CAP);
  // The witness as it was until 2026-11-12 (#851): 200 characters, 301
  // digits. It is still admitted, well inside the per-line cap, and it is the
  // line the request total is sized for (463 of them are the total).
  const budget = 'w '.repeat(99) + 'ws';
  assert.equal([...budget].length, 200);
  assert.equal([...budget].length, REQUEST_BUDGET_LINE_CHARS);
  assert.equal(lineDigitBound(budget).bound, 301);
  assert.equal(lineDigitBound('\u{1F600}'.repeat(200)).bound, 301);
  assert.equal(MAX_LINES * lineDigitBound(budget).bound, METER_REQUEST_DIGITS_CAP);
  // One character past the old limit read 303 and was refused; it is a line
  // like any other now.
  assert.equal(lineDigitBound('x'.repeat(201)).bound, 303);
  assert(303 <= METER_LINE_DIGITS_CAP);
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
  // 2026-11-12 (#851): 521 was over the per-line cap while that was 301, and
  // this line was refused for it. At 769 it is admitted, so the refusal that
  // only four separate rows can cause is shown on the same four rows at the
  // head of a longer line (the reader cuts its head exactly as above; the
  // words after it move no token number).
  assert(b.bound <= METER_LINE_DIGITS_CAP);
  assert.doesNotThrow(() => admitRecognitionArgs({ draft: [line], pronunciations: rows }));
  const long = line + ' and the sea'.repeat(15);
  const longRows = rows.map((r) => ({ ...r, line: long }));
  const lb = lineDigitBound(
    long,
    longRows.map((r, i) => ({ index: i + 1, ...r }))
  );
  const units = [...long].length + 1;
  assert.equal(units, 202);
  assert.equal(lb.declared_digits, 512);
  assert.equal(lb.undeclared_units, units - 16);
  assert.equal(lb.bound, 791);
  assert(lb.bound > METER_LINE_DIGITS_CAP);
  // Merged by token number the four rows would be two tokens (256 digits,
  // and the two shortest words' 4 units out of the rest): inside the cap. So
  // the refusal below is the four rows counted as four.
  assert(256 + Math.floor((3 * (units - 4)) / 2) <= METER_LINE_DIGITS_CAP);
  assert.throws(
    () => admitRecognitionArgs({ draft: [long], pronunciations: longRows }),
    (e) =>
      e.cause === 'meter_line_digits' &&
      /L001 of `draft` could reach 791 .*\(P001 128, P002 128, P003 128, P004 128: 512 digits\)/.test(
        e.message
      ) &&
      /the per-line cap is 769\./.test(e.message)
  );
});

// ── fixtures ─────────────────────────────────────────────────────────────
// Two witness lines since 2026-11-12 (#851), where one line served both roles
// while the request total was 463 of the per-line cap:
//   WITNESS         512 characters, bound 769: the densest line admitted, and
//                   the line every per-line scenario below is built on.
//   BUDGET_WITNESS  200 characters, bound 301: the line the REQUEST TOTAL is
//                   sized for. 463 of them are the total exactly.
// What each fixture reads is asserted in the test right after this block, not
// here: a top-level assertion that fails stops every later test from being
// registered, and the run then reports only the tests above it.
const WITNESS = 'w '.repeat(255) + 'ws';
const BUDGET_WITNESS = 'w '.repeat(99) + 'ws';
const decl = (line, vowels, token = 1, word = 'w') => ({
  line,
  token,
  word,
  phones: Array(vowels).fill('AH0'),
  basis: 'declared',
  source: 'admission fixture',
});
const boundOf = (line, declarations = []) =>
  lineDigitBound(
    line,
    declarations.map((d, i) => ({ index: i + 1, ...d }))
  ).bound;
const sumOf = (lines) => lines.reduce((n, line) => n + boundOf(line), 0);
const fmt = (n) => n.toLocaleString('en-US');
// Declaring token 1 (`w`, 2 units) with k vowels: 766 + k. k = 3 is the cap,
// k = 4 is one over it.
const AT_LINE = [decl(WITNESS, 3)];
const OVER_LINE = [decl(WITNESS, 4)];
const OVER_LINE_BOUND = METER_LINE_DIGITS_CAP + 1;
// BB8 condition 1's line: its bound is over the cap, its real count is not
// (one declared 128-vowel token and ordinary words; the reader reads the
// declared reading and 126 one-syllable dictionary words). Rebuilt 2026-11-12
// (#851) at 507 characters: at the 195 it had, its bound is 416, which the
// cap of 769 admits.
const BOUND_ONLY_WORDS = 3 * 42;
const BOUND_ONLY = ('zyx ' + 'and the sea '.repeat(42)).trim();
const BOUND_ONLY_DECL = [decl(BOUND_ONLY, 128, 1, 'zyx')];
const boundOnly = boundOf(BOUND_ONLY, BOUND_ONLY_DECL);
// A short line over the per-line cap by declaration alone: every one of its
// one-letter tokens declared at the 128-phone ceiling a declaration has.
// Seven are 896; six are 768, inside the cap. (While the cap was 301 these
// scenarios used three, at 384.)
const SEVEN = 'a a a a a a a';
const SIX = 'a a a a a a';
const eachTokenDeclared = (line, count, first = 1) =>
  Array.from({ length: count }, (_, i) => decl(line, 128, first + i, 'a'));
const SEVEN_DECL = eachTokenDeclared(SEVEN, 7);
const P_SEVEN = 'P001, P002, P003, P004, P005, P006, P007';

const rowsText = (n) => '\n'.repeat(n - 1) + 'the only sung line';
// 463 lines of 200 characters, at 301 each, are the request cap exactly; a
// further declared one-letter line at one digit is one over it (only a
// continuation or a blueprint can carry more than 463 lines past the schema).
const AT_REQUEST = Array(MAX_LINES).fill(BUDGET_WITNESS);
// The blueprint path also carries its one draft line (`a quiet line`, 19):
// 462 × 301 + 282 + 19 is the request cap exactly.
const DRAFT_LINE = 'a quiet line';
const AT_REQUEST_BESIDE_DRAFT = [...Array(MAX_LINES - 1).fill(BUDGET_WITNESS), 'a'.repeat(187)];
const OVER_REQUEST = [...AT_REQUEST, 'a'];
const OVER_REQUEST_DECL = [{ ...decl('a', 1, 1, 'a') }];
// (#851) The same total in 512-character lines, which every path can carry:
// 181 at 769 are 139,189 and fit; 182 are 139,958 and do not. With a
// 115-character line (174) beside the 181 the draft is on the total exactly,
// and with a 116-character one (175) it is one digit over.
const LONG_LINES_FIT = Math.floor(METER_REQUEST_DIGITS_CAP / METER_LINE_DIGITS_CAP);
const LONG_UNDER_REQUEST = Array(LONG_LINES_FIT).fill(WITNESS);
const LONG_OVER_REQUEST = Array(LONG_LINES_FIT + 1).fill(WITNESS);
const LONG_AT_REQUEST = [...LONG_UNDER_REQUEST, 'a'.repeat(115)];
const LONG_ONE_OVER_REQUEST = [...LONG_UNDER_REQUEST, 'a'.repeat(116)];
// (#851) A draft 21 digits under the total (462 × 301 + 280), and the answers
// a revision could send beside it: 13 characters read 21 and land on the
// total, 14 read 22 and are one digit over.
const NEAR_REQUEST = [...Array(MAX_LINES - 1).fill(BUDGET_WITNESS), 'a'.repeat(186)];
const ANSWER_FITS = 'a'.repeat(13);
const ANSWER_OVER = 'a'.repeat(14);

test('the fixtures read what the tests below take them to read', () => {
  // Per line.
  assert.equal([...WITNESS].length, ADMISSION_MAX_LINE_CHARS);
  assert.equal(boundOf(WITNESS), METER_LINE_DIGITS_CAP);
  assert.equal(boundOf(WITNESS, AT_LINE), METER_LINE_DIGITS_CAP);
  assert.equal(boundOf(WITNESS, OVER_LINE), OVER_LINE_BOUND);
  assert.equal(OVER_LINE_BOUND, 770);
  assert.equal(boundOnly, 884);
  assert(boundOnly > METER_LINE_DIGITS_CAP);
  // Three syllables a word would still leave its real count inside the cap.
  assert(128 + 3 * BOUND_ONLY_WORDS < METER_LINE_DIGITS_CAP);
  assert([...BOUND_ONLY].length <= ADMISSION_MAX_LINE_CHARS);
  assert.equal(boundOf(SEVEN, SEVEN_DECL), 896);
  assert.equal(boundOf(SIX, eachTokenDeclared(SIX, 6)), 768);
  assert(768 <= METER_LINE_DIGITS_CAP && 896 > METER_LINE_DIGITS_CAP);
  // Per request, in the 200-character lines the total is sized for.
  assert.equal([...BUDGET_WITNESS].length, REQUEST_BUDGET_LINE_CHARS);
  assert.equal(boundOf(BUDGET_WITNESS), 301);
  assert.equal(sumOf(AT_REQUEST), METER_REQUEST_DIGITS_CAP);
  assert.equal(boundOf(DRAFT_LINE), 19);
  assert.equal(boundOf('a'.repeat(187)), 282);
  assert.equal(sumOf(AT_REQUEST_BESIDE_DRAFT) + boundOf(DRAFT_LINE), METER_REQUEST_DIGITS_CAP);
  assert.equal(
    sumOf(AT_REQUEST) + boundOf('a', OVER_REQUEST_DECL),
    METER_REQUEST_DIGITS_CAP + 1
  );
  // Per request, in 512-character lines.
  assert.equal(LONG_LINES_FIT, 181);
  assert.equal(sumOf(LONG_UNDER_REQUEST), 139_189);
  assert.equal(sumOf(LONG_OVER_REQUEST), 139_958);
  assert.equal(sumOf(LONG_AT_REQUEST), METER_REQUEST_DIGITS_CAP);
  assert.equal(sumOf(LONG_ONE_OVER_REQUEST), METER_REQUEST_DIGITS_CAP + 1);
  // A revision's draft and its answers.
  assert.equal(sumOf(NEAR_REQUEST), 139_342);
  assert.equal(METER_REQUEST_DIGITS_CAP - sumOf(NEAR_REQUEST), 21);
  assert.equal(boundOf(ANSWER_FITS), 21);
  assert.equal(boundOf(ANSWER_OVER), 22);
});

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
// the pasted text; and the blueprint, whose stored text meets no per-line cap
// (BB8's ruling on #827), so a declaration on that text is refused as a
// declared line, by its pronunciation.
const LINE_ID = (path) =>
  path === 'recover lines_text'
    ? 'The line at row 1 of the pasted text'
    : path === 'blueprint'
      ? 'The line "[^"]+", which P001 declares readings for, is a line of `blueprint.lines`, whose stored text no check reads,'
      : 'L001 of `[^`]+`';
const AT_REQUEST_FOR = (path) => (path === 'blueprint' ? AT_REQUEST_BESIDE_DRAFT : AT_REQUEST);
// The array paths cannot carry more than MAX_LINES items or a 513-character
// item: the published schema refuses them before any handler. Their raw-row
// cap, and the request total at 464 lines, are therefore reached only through
// the paths that can. Since #851 (2026-11-12) the request total is also
// passed inside those ceilings, by 182 lines of 512 characters, and that is
// checked on every path, the array and text paths included.
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
          `${LINE_ID(path)}.*? could reach ${OVER_LINE_BOUND} syllable digits under its declared readings \\(P001 4: 4 digits\\)`
        )
      );
      assert.match(over.text, /the per-line cap is 769\./);
      assert.doesNotMatch(over.text, /\bhas 770\b/);
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
        // Per request, in the 200-character lines the total is sized for:
        // 463 × 301 admitted, one digit more refused.
        admitted(await call(path, AT_REQUEST_FOR(path)), path, 'request at cap');
        const overRequest = await call(path, OVER_REQUEST, OVER_REQUEST_DECL);
        if (path === 'blueprint') {
          // A blueprint's stored text is never recognised (BB8 ruling 2 and
          // his ruling on #827): it meets the raw-row cap above, and stays
          // out of the per-line cap and the total.
          admitted(overRequest, path, 'blueprint past the request total');
          assert.equal(overRequest.queued, 1, overRequest.text);
        } else refused(overRequest, 'meter_request_digits', path, 'request over');
      }
      // Per request, in 512-character lines (#851): every path can carry
      // these, the schema-bound arrays too. 181 × 769 is inside the total and
      // admitted; 182 × 769 is over it, and it is the request total that
      // refuses, since every one of the lines is inside the per-line cap.
      admitted(await call(path, LONG_UNDER_REQUEST), path, '181 long lines');
      const longOver = await call(path, LONG_OVER_REQUEST);
      if (path === 'blueprint') {
        admitted(longOver, path, 'a blueprint of long lines past the request total');
        assert.equal(longOver.queued, 1, longOver.text);
      } else {
        refused(longOver, 'meter_request_digits', path, '182 long lines');
        assert.match(
          longOver.text,
          path === 'after_text'
            ? /`before_text` \(1 line, 19\) and `after_text` \(182 lines, 139,958\) together could reach 139,977 syllable digits; one request carries at most 139,363 /
            : /\(182 lines, 139,958\) could reach 139,958 syllable digits; one request carries at most 139,363 /,
          path
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
      if (path === 'blueprint') {
        // The same bound; the blueprint's text is not measured, so the
        // declaration is refused as a declared line (see LINE_ID).
        assert.match(
          text,
          new RegExp(
            `RESOURCE_LIMIT: meter_line_digits — ${LINE_ID(path)} .*? could reach ${boundOnly} `
          ),
          text
        );
        assert.equal(r.isError, true);
        continue;
      }
      const m = text.match(
        /RESOURCE_LIMIT: meter_line_digits — (L\d{3}) of `[^`]+` (could reach [\d,]+ syllable digits under its declared readings \(P001 128: 128 digits\) and 1\.5 digits per unit for its [\d,]+ undeclared units; the per-line cap is 769\.)/
      );
      assert(m, `${path}: ${text}`);
      seen.push(m[1] + ' ' + m[2]);
    }
    const sessionText = await sessionRefusal({
      name: 'lyric_check',
      arguments: { lines: [BOUND_ONLY], scheme: 'X', pronunciations: BOUND_ONLY_DECL },
    });
    const m = sessionText.match(
      /RESOURCE_LIMIT: meter_line_digits — (L\d{3}) of `[^`]+` (could reach .*? cap is 769\.)/
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
  // Over all three: rows decide. Over lines and request: lines decide. Each
  // row is one character past the line limit, the shortest undeclared line
  // over the per-line cap (771).
  const many = Array(RAW_ROWS_CAP + 1).fill('x'.repeat(ADMISSION_MAX_LINE_CHARS + 1));
  assert(boundOf(many[0]) > METER_LINE_DIGITS_CAP);
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
  // (#851) Lines each inside the per-line cap and together over the total:
  // the request decides, on an array the schema itself would pass.
  assert.equal(cause({ draft: LONG_OVER_REQUEST }), 'meter_request_digits');
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
  // 2026-11-12 (#851): until then a revision's answers were no line set at
  // all (at 200 characters an answer could not carry a draft past the total),
  // and this test held that. They are a line set now, on lyric_revise only:
  // named for the field that carried them and marked `answers`, which is what
  // adds them to the request total and keeps them out of the per-line check
  // (ANSWER_TOO_LONG holds an answered line to the line limit, by name). The
  // tests marked (#851) further down hold both. On any other tool, and where
  // no tool is named, the fields are not read.
  const answering = { answer: 'x'.repeat(ADMISSION_MAX_LINE_CHARS + 1) };
  assert.deepEqual(recognitionInputOf(answering).sets, []);
  assert.deepEqual(recognitionInputOf(answering, { tool: 'lyric_check' }).sets, []);
  assert.deepEqual(recognitionInputOf(answering, { tool: 'lyric_revise' }).sets, [
    { name: 'answer', family: null, rows: 1, lines: [answering.answer], answers: true },
  ]);
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
        // 766 for the 511 undeclared units and the 128 declared vowels.
        e.message.includes(
          `The line ${JSON.stringify(WITNESS)}, which P001 declares readings for, is in no line set of this call, but an answer or a source reading can make it a sung line, and it could reach 894 `
        ) &&
        !/\bL\d{3}\b/.test(e.message),
      JSON.stringify(Object.keys(args))
    );
  // Reviewer A's answer was three 128-vowel rows on the answer's text, 384:
  // over the cap while that was 301. At 769 it takes seven rows (896); six
  // (768) are inside the cap and the answer is admitted.
  assert.throws(
    () =>
      admitLyricCall('lyric_revise', {
        draft: ['one two', 'three four'],
        answer: SEVEN,
        pronunciations: SEVEN_DECL,
      }),
    new RegExp(
      `meter_line_digits — The line "${SEVEN}", which ${P_SEVEN} declare readings for, .* could reach 896 `
    )
  );
  assert.doesNotThrow(() =>
    admitLyricCall('lyric_revise', {
      draft: ['one two', 'three four'],
      answer: SIX,
      pronunciations: eachTokenDeclared(SIX, 6),
    })
  );
  // A declared line no tool could ever sing (over 512 code points, or more
  // than one row) is not a sung line, so it is not measured: at 513
  // characters this one would read 896 if it were. At 512 it is measured
  // (`absent`, above).
  const unsingable = 'w '.repeat(256) + 'w';
  assert.equal([...unsingable].length, ADMISSION_MAX_LINE_CHARS + 1);
  assert(boundOf(unsingable, [decl(unsingable, 128)]) > METER_LINE_DIGITS_CAP);
  assert.doesNotThrow(() =>
    admitRecognitionArgs({ draft: [DRAFT_LINE], pronunciations: [decl(unsingable, 128)] })
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
  // Seven one-letter tokens, each declared at 128 vowels: 896 (the fixtures).
  const sung = SEVEN;
  // Apparatus rows before the line: the refusal names row 3, not an L id the
  // source reader (which sets those rows aside) would not give. Sent as a
  // `lines` array, the row is the item's position (blank items included);
  // sent as `lines_text`, it is the row of the paste as pasted.
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines: ['# credits', '', sung],
        pronunciations: SEVEN_DECL,
      }),
    /meter_line_digits — The line at row 3 of `lines` \(the row is the item's position in the array, counted from 1 with blank items included\) could reach 896 /
  );
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines: ['# credits', '', sung],
        pronunciations: SEVEN_DECL,
      }),
    (e) => !/pasted text/.test(e.message) && e.detail.line === 'row 3' && e.detail.set === 'lines'
  );
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines_text: '# credits\n\n' + sung + '\n',
        pronunciations: SEVEN_DECL,
      }),
    /meter_line_digits — The line at row 3 of the pasted text \(rows are counted from the top, including headings and blank rows, so you can find it as pasted\) could reach 896 /
  );
  // A declaration on the line as the source reader reads it (a bracket span
  // resolved) is measured as a declared line: the seven declared tokens' 896
  // and 7 for the 5 undeclared units of `cafē`.
  const read = `cafē ${SEVEN}`;
  const readDecl = eachTokenDeclared(read, 7, 2);
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines: ['---', `caf[=e] ${SEVEN}`],
        pronunciations: readDecl,
      }),
    new RegExp(
      `meter_line_digits — The line "${read}", which ${P_SEVEN} declare readings for, .* could reach 903 `
    )
  );
  // The same declarations on lyric_check, where the line is in the draft.
  assert.throws(
    () =>
      admitLyricCall('lyric_check', {
        lines: [read],
        pronunciations: readDecl,
      }),
    /meter_line_digits — L001 of `lines` could reach 903 /
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
  assert.throws(
    () =>
      admitLyricCall('lyric_recover', {
        lines_text: `# credits\r---\r${SEVEN}`,
        pronunciations: SEVEN_DECL,
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

test("a blueprint's line text meets no per-line cap (BB8, #827): the same text as a draft line is refused", () => {
  // Over the per-line bound with no declaration at all: 513 characters, one
  // past the line limit (771). Nothing shorter is: an undeclared line of 512
  // reads 769 at most.
  const LONG = 'a'.repeat(ADMISSION_MAX_LINE_CHARS + 1);
  assert(lineDigitBound(LONG).bound > METER_LINE_DIGITS_CAP);
  const measured = admitLyricCall('lyric_check', {
    lines: [DRAFT_LINE],
    scheme: 'X',
    blueprint: blueprintOf([LONG]),
  });
  const bp = measured.find((m) => m.name === 'blueprint.lines');
  assert.equal(bp.unrecognised, true);
  assert.equal(bp.outside_total, true);
  assert.equal(bp.lines[0].text, LONG);
  // The same text as a draft line is refused, by the per-line cap.
  assert.throws(
    () => admitLyricCall('lyric_check', { lines_text: LONG, scheme: 'X' }),
    (e) => e.cause === 'meter_line_digits' && /L001 of `lines_text`/.test(e.message)
  );
  assert.throws(
    () =>
      admitLyricCall('lyric_check', { lines: [LONG], scheme: 'X', blueprint: blueprintOf([LONG]) }),
    (e) => e.cause === 'meter_line_digits' && e.detail.set === 'lines'
  );
  // The blueprint still meets the raw-row cap.
  assert.throws(
    () =>
      admitLyricCall('lyric_check', {
        lines: [DRAFT_LINE],
        scheme: 'X',
        blueprint: blueprintOf(Array(RAW_ROWS_CAP + 1).fill('')),
      }),
    (e) => e.cause === 'raw_rows' && e.detail.set === 'blueprint.lines'
  );
});

// Every tool that takes a blueprint reaches the same exemption (lyric_grade
// takes none): the tool wrapper and session submit both admit through
// admitLyricCall.
const LONG_BLUEPRINT_LINE = 'a'.repeat(ADMISSION_MAX_LINE_CHARS + 1);
const BLUEPRINT_CALLS = [
  ['lyric_check', { lines: [DRAFT_LINE], scheme: 'X', subdivision: 2 }],
  ['lyric_revise', { draft_text: DRAFT_LINE }],
  ['lyric_revise', { draft: [DRAFT_LINE] }],
  ['lyric_verify', { before: [DRAFT_LINE], after: [DRAFT_LINE], scheme: 'X' }],
];

test('a long undeclared blueprint line is admitted on every tool that carries a blueprint', async () => {
  assert(lineDigitBound(LONG_BLUEPRINT_LINE).bound > METER_LINE_DIGITS_CAP);
  const blueprint = blueprintOf([LONG_BLUEPRINT_LINE]);
  for (const [name, args] of BLUEPRINT_CALLS) {
    const measured = admitLyricCall(name, { ...args, blueprint });
    const bp = measured.find((m) => m.name === 'blueprint.lines');
    assert.equal(bp?.unrecognised, true, `${name} ${Object.keys(args)}`);
  }
  // The tool wrapper: each call reaches the queue, none is refused.
  {
    const { client, close } = await rawClient();
    const queue = watchQueue();
    try {
      for (const [name, args] of BLUEPRINT_CALLS) {
        const before = queue.count;
        const r = await client.callTool({ name, arguments: { ...args, blueprint } });
        assert.doesNotMatch(textOf(r), /RESOURCE_LIMIT/, `${name}: ${textOf(r).slice(0, 300)}`);
        assert.equal(queue.count, before + 1, `${name}: ${textOf(r).slice(0, 300)}`);
      }
    } finally {
      queue.restore();
      await close();
    }
  }
  // Session submit on /mcp, in an edit session (a pasted song).
  for (const [name, args] of BLUEPRINT_CALLS) {
    const h = await sessionHarness();
    try {
      const r = await h.client.callTool({
        name,
        arguments: { ...args, blueprint, session_id: h.session_id },
      });
      assert(!r.isError, `${name}: ${textOf(r)}`);
      await Promise.all([...h.sessions.active.values()]);
      assert.deepEqual(h.executed, [name]);
    } finally {
      await h.close();
    }
  }
});

test('a declaration on a blueprint line is refused as a blueprint line, not as a line in no set', () => {
  // Seven tokens at 128 declared vowels each, 896 (the fixtures).
  const text = SEVEN;
  const pronunciations = SEVEN_DECL;
  for (const [name, args] of BLUEPRINT_CALLS)
    assert.throws(
      () => admitLyricCall(name, { ...args, blueprint: blueprintOf([text]), pronunciations }),
      (e) =>
        e.cause === 'meter_line_digits' &&
        e.message.includes(
          `The line "${SEVEN}", which ${P_SEVEN} declare readings for, is a line of \`blueprint.lines\`, whose stored text no check reads, but an answer or a source reading can make it a sung line, and it could reach 896 `
        ) &&
        !/in no line set/.test(e.message),
      name
    );
  // A declared line in no set keeps its own wording.
  assert.throws(
    () => admitLyricCall('lyric_check', { lines: [DRAFT_LINE], scheme: 'X', pronunciations }),
    (e) => e.cause === 'meter_line_digits' && /is in no line set of this call/.test(e.message)
  );
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
  // A declaration on a blueprint's text is still a declared line: an answer
  // or a source reading could make that text sung, so the declaration meets
  // the per-line cap (the blueprint's own text does not; see the next test).
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
        "Not counted, because no response carries their recognition: `blueprint.lines` (its stored text is not read; the draft's lines are fitted to its placements); the pronunciations' own lines (a declaration on a line already counted in this total is counted with that line; any other declared line, including one on a `blueprint.lines` text, was checked against the per-line cap instead)."
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
