// The session's short verdict (verdict_view.js): what a finished grade or
// revise publishes on the session endpoints, and what get_operation's
// `detail` returns in its place. The engine verdict is the input and is never
// changed; every assertion here is about the projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  sessionView,
  pairLine,
  detailOf,
  blockingOf,
  obligationLines,
  DETAIL_PARTS,
} from './verdict_view.js';
import { publicToolResult } from './workflow_sessions.js';
import { isStanding } from './lyric_tools.js';

const song =
  '[VERSE — 3 lines — 3 bars of 4/4]\nOne line here\nTwo line there\nThree line near\n\n' +
  '[FINISHED — seed 7 — exit 3 — ROUND_LIMIT after 2 round(s) — UNRESOLVED: L2]';
const note = (code, locations, evidence = 'the whole explanation, at length') => ({
  code,
  severity: 'note',
  message: `${code} message`,
  evidence,
  locations,
  groups: [],
  obligations: [],
  subject: [],
});
const flag = (code, locations, message, evidence) => ({
  ...note(code, locations, evidence),
  severity: 'flag',
  message,
});
const findings = [
  flag(
    'SLOTS_EXCEEDED',
    [1],
    'more syllables than slots',
    '7 syllables, 6 slots (6 pulses x 1). More.'
  ),
  flag(
    'SLOTS_EXCEEDED',
    [3],
    'more syllables than slots',
    '7 syllables, 6 slots (6 pulses x 1). More.'
  ),
  flag(
    'SCHEME_VIOLATION',
    [1, 3],
    'L1 and L3 are both in group A but do not stand in the relation it requires',
    "NO_RELATION: no admitted relation (score 0.3; 'here' ~ 'near')"
  ),
  { ...note('MODAL_RHYME', [2, 3]), message: 'L2/L3 rhyme on a modal pair' },
  note('CROWDED', [1]),
  note('CROWDED', [2]),
  note('PROMINENCE_UNDECIDED', [2]),
];
const verdict = {
  exit_code: 3,
  meaning: 'measured, a flag stands',
  measurement_status: 'finished',
  certified: false,
  status: 'stopped_with_open_lines',
  loop_stop_reason: 'ROUND_LIMIT',
  loop_rounds: 2,
  loop_unresolved_lines: [2],
  loop_whole_flag_codes: [],
  banned_pairs: 1,
  findings_measured: true,
  findings,
  report: 'x'.repeat(5000),
  coverage: {
    certified: false,
    refused_obligations: ['prominence:L2', 'meter:PROMINENCE_UNDECIDED:L2', 'rhyme:2:3:1'],
    obligations: [
      { id: 'prominence:L2', layer: 'prominence', line: 2, status: 'refused' },
      { id: 'rhyme:1:3:1', layer: 'rhyme', status: 'answered' },
      { id: 'rhyme:2:3:1', layer: 'rhyme', status: 'refused' },
    ],
  },
  pronunciations: [],
  pronunciation_options: {
    items: [
      { line: 'Two line there', token: 1, word: 'Two', matching_lines: [2] },
      { line: 'One line here', token: 1, word: 'One', matching_lines: [1] },
    ],
    total: 9,
  },
  final_draft: ['One line here', 'Two line there', 'Three line near'],
  final_draft_sha256: 'f'.repeat(64),
  presentation_text: song,
  song_at_stop: song,
};
const blocks = (v = verdict, first = song + '\n\nSTANDING AT THE STOP — L2') => [
  { type: 'text', text: first },
  { type: 'text', text: JSON.stringify(v) },
];

test('a finished grade or revise publishes the song and a short verdict', () => {
  const content = blocks();
  const out = sessionView('lyric_revise', content);
  assert.equal(out[0], content[0], 'block 0, the song, is published as stored');
  const short = JSON.parse(out[1].text);
  for (const key of [
    'findings',
    'report',
    'coverage',
    'final_draft',
    'presentation_text',
    'song_at_stop',
  ])
    assert.equal(short[key], undefined, `${key} stays with the operation`);
  assert.equal(short.exit_code, 3);
  assert.equal(short.status, 'stopped_with_open_lines');
  assert.deepEqual(short.loop_unresolved_lines, [2]);
  assert.equal(short.banned_pairs, 1);
  assert.equal(short.notes, 3, 'every finding that does not stand is counted, none is listed');
  assert.equal(
    short.presentation_sha256,
    createHash('sha256').update(song).digest('hex'),
    'the song is checkable against the verdict without a second copy of it'
  );
  assert.match(short.detail, /get_operation/);
  assert.ok(out[1].text.length < 2000, `short verdict is short (${out[1].text.length})`);
});

test('blocking: one line per thing that stands, merged, and one per unjudged line', () => {
  const lines = blockingOf(verdict);
  assert.deepEqual(lines, [
    'L1/3: SLOTS_EXCEEDED — more syllables than slots (7 syllables, 6 slots)',
    "L1/3: SCHEME_VIOLATION — L1 and L3 are both in group A but do not stand in the relation it requires (NO_RELATION: no admitted relation); compared 'here' ~ 'near'",
    'L2/3: MODAL_RHYME — L2/L3 rhyme on a modal pair (the whole explanation, at length)',
    'L2: not judged — prominence, meter, rhyme with L3 (PROMINENCE_UNDECIDED); words with more than one reading: Two',
    'L3: not judged — rhyme with L2',
  ]);
  const standing = findings.filter(isStanding).map((f) => f.code);
  assert.deepEqual(
    [...new Set(standing)],
    ['SLOTS_EXCEEDED', 'SCHEME_VIOLATION', 'MODAL_RHYME'],
    'what stands is the verdict’s own `standing` predicate'
  );
  const whole = blockingOf({
    ...verdict,
    findings: [],
    coverage: { refused_obligations: ['function:hook:1'] },
  });
  assert.deepEqual(whole, ['whole draft: not judged — function:hook:1']);
});

test('obligation ids name lines the way the harness reads them', () => {
  assert.deepEqual(obligationLines('rhyme:13:14:5'), [13, 14]);
  assert.deepEqual(obligationLines('return:2:9'), [2, 9]);
  assert.deepEqual(obligationLines('prominence:L4'), [4]);
  assert.deepEqual(obligationLines('meter:PROMINENCE_UNDECIDED:L19'), [19]);
  assert.equal(obligationLines('function:hook:1'), null);
  assert.equal(obligationLines('rhyme:x:2'), null);
});

test('detail returns the part asked for, narrowed to lines when given', () => {
  assert.deepEqual(DETAIL_PARTS, [
    'full',
    'findings',
    'report',
    'coverage',
    'pronunciations',
    'pairs',
  ]);
  const content = blocks();
  assert.deepEqual(sessionView('lyric_grade', content, { detail: 'full' }), content);
  const one = (detail, lines) => {
    const out = sessionView('lyric_grade', content, { detail, lines });
    assert.equal(out.length, 1, `${detail}: the verdict part alone, no second copy of the song`);
    return JSON.parse(out[0].text);
  };
  assert.equal(one('findings').findings.length, findings.length);
  assert.deepEqual(
    one('findings', [2]).findings.map((f) => f.code),
    ['MODAL_RHYME', 'CROWDED', 'PROMINENCE_UNDECIDED']
  );
  assert.equal(one('report').report.length, 5000);
  assert.deepEqual(
    one('coverage', [2]).coverage.obligations.map((o) => o.id),
    ['prominence:L2', 'rhyme:2:3:1']
  );
  assert.equal(one('coverage').coverage.obligations.length, 3);
  assert.deepEqual(
    one('pronunciations', [1]).pronunciation_options.items.map((o) => o.word),
    ['One']
  );
  assert.deepEqual(detailOf(verdict, 'findings', [9]).findings, []);
});

test('only a measured grade or stopped revise is shortened', () => {
  const suspended = blocks({ ...verdict, exit_code: 4, findings_measured: false });
  assert.deepEqual(sessionView('lyric_revise', suspended), suspended, 'a question is the answer');
  const single = [{ type: 'text', text: JSON.stringify(verdict) }];
  assert.deepEqual(
    sessionView('lyric_grade', single),
    single,
    'a one-block result keeps its shape'
  );
  assert.deepEqual(sessionView('lyric_check', blocks()), blocks(), 'check keeps its shape');
  assert.deepEqual(sessionView('lyric_verify', blocks()), blocks(), 'verify keeps its shape');
  const noJson = [
    { type: 'text', text: song },
    { type: 'text', text: 'plain' },
  ];
  assert.deepEqual(sessionView('lyric_grade', noJson), noJson);
});

test('the session publishes the short view only when it names the tool', () => {
  const stored = {
    content: blocks({ ...verdict, state: 'private-run-state', run_id: 'r' }),
  };
  const raw = publicToolResult(stored);
  assert.equal(JSON.parse(raw.content[1].text).report.length, 5000, 'no tool: published as stored');
  assert.equal(JSON.parse(raw.content[1].text).state, undefined, 'private state still withheld');
  const short = publicToolResult(stored, null, { tool: 'lyric_revise' });
  assert.equal(JSON.parse(short.content[1].text).report, undefined);
  const full = publicToolResult(stored, null, { tool: 'lyric_revise', detail: 'full' });
  assert.equal(
    JSON.parse(full.content[1].text).state,
    undefined,
    'detail never reveals private state'
  );
});

// THE SCREEN. A finished lyric_screen is one block, and on ten words it was
// 66,251 characters: every pair with every schema and the same fifteen
// undecided schema names, then the report table restating the pairs.
const UNDECIDED = Array.from({ length: 15 }, (_, i) => `undecided schema number ${i + 1}`);
const UNRESOLVED =
  'the default relation remains unresolved in schema(s): chain rhyme (rap), holorhyme, internal rhyme';
const pair = (a, b, extra = {}) => ({
  a,
  b,
  relations: [],
  coarse_relations: [],
  schema_relations: [],
  undecided: UNDECIDED,
  score: 0.5,
  codes: [],
  refused: false,
  reason: UNRESOLVED,
  why: null,
  ...extra,
});
const screenPairs = [
  pair('tape', 'drape', {
    relations: ['ASSONANCE', 'RHYME', 'perfect rhyme'],
    coarse_relations: ['ASSONANCE', 'RHYME'],
    schema_relations: ['perfect rhyme'],
    score: 1,
    codes: ['HOMEOTELEUTON'],
    reason: null,
  }),
  pair('tape', 'mic', { score: 0.818 }),
  pair('tape', 'zzyzx', {
    refused: true,
    reason: "'zzyzx' is not in the dictionary",
    undecided: [],
  }),
];
const screenReport =
  '  SCREEN: 3 pair(s) from 4 word(s)\n  tape ~ drape  1.000  BANNED: HOMEOTELEUTON  | ' +
  'x'.repeat(4000) +
  '\n  1 banned, 1 refused, 0 standing in at least one relation, 1 standing in none\n' +
  '  ANCHOR : every word anchors as a declared token';
const screened = (extra = {}) => ({
  exit_code: 0,
  meaning: 'answered — screened response; whole-draft findings were not measured',
  report: screenReport,
  measurement_status: 'screened',
  findings_measured: false,
  certified: false,
  pairs: screenPairs,
  ...extra,
});
const screenBlocks = (v = screened()) => [{ type: 'text', text: JSON.stringify(v) }];

test('a finished screen publishes one line per pair and the report’s own counts', () => {
  const content = screenBlocks();
  const out = sessionView('lyric_screen', content);
  assert.equal(out.length, 1, 'still one block');
  const short = JSON.parse(out[0].text);
  assert.equal(short.report, undefined, 'the table stays with the operation');
  assert.equal(short.exit_code, 0);
  assert.equal(short.measurement_status, 'screened');
  assert.deepEqual(short.pairs, [
    'tape ~ drape 1.000 — BANNED: HOMEOTELEUTON — ASSONANCE, RHYME — schemas: perfect rhyme — 15 schema(s) undecided',
    'tape ~ mic 0.818 — no coarse relation — grade: the default relation remains unresolved in 3 schema(s) — 15 schema(s) undecided',
    "tape ~ zzyzx 0.500 — REFUSED: 'zzyzx' is not in the dictionary — no coarse relation",
  ]);
  assert.deepEqual(
    short.counts,
    ['1 banned, 1 refused, 0 standing in at least one relation, 1 standing in none'],
    'the counts are the harness’s own partition, read off its report'
  );
  assert.match(short.detail, /detail "pairs"/);
  assert.ok(
    out[0].text.length * 3 < content[0].text.length,
    `short screen is short (${out[0].text.length} of ${content[0].text.length})`
  );
});

test('a declared relation’s answer rides each pair line', () => {
  assert.equal(
    pairLine(pair('line', 'I', { named: true, named_reason: null, reason: null })),
    'line ~ I 0.500 — no coarse relation — SATISFIES the declared relation — 15 schema(s) undecided'
  );
  assert.match(pairLine(pair('mic', 'line', { named: false })), /VIOLATES the declared relation/);
  assert.match(
    pairLine(pair('I', 'sign', { named: null, named_reason: "'I' has two readings" })),
    /declared relation not judged: 'I' has two readings/
  );
  assert.match(
    pairLine(pair('sun', 'much', { why: 'NO_RELATION: no admitted relation' })),
    /grade: NO_RELATION: no admitted relation — 15/,
    'the grader’s own charge is named whole'
  );
});

test('screen detail returns the pairs, the report or the whole result', () => {
  const content = screenBlocks();
  assert.deepEqual(sessionView('lyric_screen', content, { detail: 'full' }), content);
  const part = (detail) => JSON.parse(sessionView('lyric_screen', content, { detail })[0].text);
  assert.deepEqual(part('pairs').pairs, screenPairs);
  assert.deepEqual(part('findings').pairs, screenPairs, 'a screen’s findings are its pairs');
  assert.equal(part('report').report, screenReport);
  assert.equal(part('coverage').coverage, null, 'a screen has no coverage');
});

test('only a screened result is shortened, and only for lyric_screen', () => {
  const refused = screenBlocks({
    exit_code: 2,
    meaning: 'refused',
    measurement_status: 'refused',
    pairs: undefined,
  });
  assert.deepEqual(sessionView('lyric_screen', refused), refused, 'a refusal keeps its shape');
  assert.deepEqual(sessionView('lyric_types', screenBlocks()), screenBlocks());
  const stored = { content: screenBlocks(screened({ state: 'private-run-state' })) };
  const raw = publicToolResult(stored);
  assert.equal(JSON.parse(raw.content[0].text).report, screenReport, 'no tool: as stored');
  const short = publicToolResult(stored, null, { tool: 'lyric_screen' });
  assert.equal(JSON.parse(short.content[0].text).report, undefined);
  assert.equal(JSON.parse(short.content[0].text).pairs.length, 3);
});
