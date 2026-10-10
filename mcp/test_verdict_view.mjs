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
      {
        line: 'Two line there',
        token: 1,
        word: 'Two',
        matching_lines: [2],
        dictionary_readings: [{ phones: ['T', 'UW1'] }, { phones: ['T', 'UW0'] }],
      },
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
  // ~~3~~ -> 4 since 2026-10-04: a banned pair (MODAL_RHYME) is a note now,
  // not a standing finding (owner's ruling).
  assert.equal(short.notes, 4, 'every finding that does not stand is counted, none is listed');
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
    // ~~'L2/3: MODAL_RHYME — …'~~ — a banned pair no longer stands (2026-10-04).
    'L2: not judged — prominence, meter, rhyme with L3 (PROMINENCE_UNDECIDED); words with more than one reading: L2 Two',
    'L3: not judged — rhyme with L2; words with more than one reading: L2 Two',
  ]);
  const standing = findings.filter(isStanding).map((f) => f.code);
  assert.deepEqual(
    [...new Set(standing)],
    ['SLOTS_EXCEEDED', 'SCHEME_VIOLATION'],
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

test('a stopped revise names the session continuation, not run_id or state', () => {
  const stopped = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          exit_code: -1,
          status: 'interrupted',
          meaning:
            'subprocess failure (-1): verb killed at the shared tool deadline Resume explicitly with run_id or state under the same declarations; completed proposals are in that journal.',
          state: 'private-run-state',
          run_id: 'r',
        }),
      },
    ],
  };
  const out = JSON.parse(publicToolResult(stopped, null, { tool: 'lyric_revise' }).content[0].text);
  assert.equal(out.state, undefined);
  assert.equal(out.run_id, undefined);
  assert.doesNotMatch(out.meaning, /run_id|under the same declarations/);
  assert.match(out.meaning, /lyric_revise, the latest session_id and no answer/);
  assert.match(out.meaning, /^subprocess failure \(-1\): verb killed at the shared tool deadline/);
});

test('unknown words are not mislabeled as having multiple readings', () => {
  const v = {
    findings: [note('UNREADABLE_INTERIOR_WORD', [12, 25])],
    coverage: {
      refused_obligations: ['meter:COUNT_IS_A_LOWER_BOUND:L12', 'meter:COUNT_IS_A_LOWER_BOUND:L25'],
    },
    pronunciation_options: {
      items: [
        { word: 'streetlights', matching_lines: [12, 25], dictionary_readings: [] },
        {
          word: 'the',
          matching_lines: [12, 25],
          dictionary_readings: [{ phones: ['DH', 'AH0'] }, { phones: ['DH', 'IY1'] }],
        },
        {
          word: 'quick',
          matching_lines: [12],
          dictionary_readings: [{ phones: ['K', 'W', 'IH1', 'K'] }],
        },
      ],
    },
  };
  assert.deepEqual(
    blockingOf(v),
    [12, 25].map(
      (n) =>
        `L${n}: not judged — meter (UNREADABLE_INTERIOR_WORD); words with more than one reading: L${n} the; no dictionary reading listed: L${n} streetlights`
    )
  );
});

test('function failures name each failed word and sung token at its draft line', () => {
  const ids = [15, 28].map((n) => `function:END_WORD_UNREADABLE:L${n}`);
  const v = {
    findings: [note('END_WORD_UNREADABLE', [15, 28])],
    coverage: {
      refused_obligations: ['function:draft', ...ids],
      obligations: ids.map((id, i) => ({
        id,
        status: 'refused',
        line: [15, 28][i],
        token: 7,
        word: 'sixty-six',
        code: 'END_WORD_UNREADABLE',
      })),
    },
  };
  assert.deepEqual(
    blockingOf(v),
    [15, 28].map(
      (n) => `L${n}: not judged — function (END_WORD_UNREADABLE); unreadable: token 7 'sixty-six'`
    )
  );
  assert.deepEqual(obligationLines(ids[0]), [15]);
  assert.equal(detailOf(v, 'coverage', [28]).coverage.obligations[0].line, 28);
  assert.equal(detailOf(v, 'findings', [28]).findings.length, 1);
  v.coverage.refused_obligations.push('function:UNLOCATED:0');
  assert.equal(
    blockingOf(v).at(-1),
    'whole draft: not judged — function:draft, function:UNLOCATED:0'
  );
});

test('short and every detail view preserve supplied lexicon identity without inventing one', () => {
  for (const lexicon of [
    { supplement_id: 'reviewed-v1', sha256: 'a'.repeat(64) },
    { supplement_id: null, sha256: null },
  ]) {
    const v = { ...verdict, lexicon };
    const content = blocks(v);
    assert.deepEqual(JSON.parse(sessionView('lyric_grade', content)[1].text).lexicon, lexicon);
    for (const detail of DETAIL_PARTS) {
      const out = sessionView('lyric_grade', content, { detail, lines: [2] });
      assert.deepEqual(JSON.parse(out[detail === 'full' ? 1 : 0].text).lexicon, lexicon);
    }
  }
  assert.equal(
    Object.hasOwn(JSON.parse(sessionView('lyric_grade', blocks())[1].text), 'lexicon'),
    false
  );
  for (const part of DETAIL_PARTS)
    assert.equal(Object.hasOwn(detailOf(verdict, part), 'lexicon'), false);
});

test('mixed expanded function failures retain known lines alongside unlocated coverage', () => {
  const located = [1, 3].map((line) => ({
    id: `function:END_WORD_UNREADABLE:T3:L${line}`,
    layer: 'function',
    status: 'refused',
    code: 'END_WORD_UNREADABLE',
    line,
    token: 3,
    word: 'streetlights',
    text: 'Wait for streetlights',
  }));
  const unlocated = {
    id: 'function:END_WORD_UNREADABLE:0',
    layer: 'function',
    status: 'refused',
    code: 'END_WORD_UNREADABLE',
    location_scope: 'section_local',
    failed_words: ['first', 'again'].map((side) => ({
      side,
      section_line: 1,
      token: 3,
      word: 'streetlights',
      text: 'Wait for streetlights',
    })),
  };
  const v = {
    findings: [note('END_WORD_UNREADABLE', [1, 3])],
    coverage: {
      refused_obligations: ['function:draft', ...located.map((o) => o.id), unlocated.id],
      obligations: [...located, unlocated],
    },
  };
  assert.deepEqual(blockingOf(v), [
    ...[1, 3].map(
      (n) =>
        `L${n}: not judged — function (END_WORD_UNREADABLE); unreadable: token 3 'streetlights'`
    ),
    'whole draft: not judged — function:draft, function:END_WORD_UNREADABLE:0',
  ]);
  assert.deepEqual(detailOf(v, 'coverage').coverage.obligations.at(-1), unlocated);
  assert.deepEqual(detailOf(v, 'coverage', [3]).coverage.obligations, [located[1]]);
});

test('unmapped physical endpoints name the word and line without inventing a sung token', () => {
  const v = {
    findings: [note('END_WORD_UNREADABLE', [1, 2])],
    coverage: {
      refused_obligations: [
        'function:draft',
        'function:END_WORD_UNREADABLE:L1',
        'function:END_WORD_UNREADABLE:L2',
      ],
      obligations: ['我', '1966'].map((word, i) => ({
        id: `function:END_WORD_UNREADABLE:L${i + 1}`,
        status: 'refused',
        code: 'END_WORD_UNREADABLE',
        line: i + 1,
        token: null,
        word,
      })),
    },
  };
  assert.deepEqual(
    blockingOf(v),
    ['我', '1966'].map(
      (word, i) =>
        `L${i + 1}: not judged — function (END_WORD_UNREADABLE); unreadable: endpoint '${word}' (no sung-token position)`
    )
  );
  assert.equal(detailOf(v, 'coverage', [1]).coverage.obligations[0].token, null);
});
