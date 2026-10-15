#!/usr/bin/env node
'use strict';
// test_library_declarations.js — the Library tab's saved pronunciation choices
// across the reader's word cut (src/library/analysis.js savedInterpretation,
// src/lyric-tokens.js v1GraderSpans / rebindBySpan).
//
// A choice saved on a device names a word of an exact line by token number.
// Records written now carry `token_cut`; a record without it is legacy by
// compatibility policy and is rebound once, by exact raw-span identity, from
// the grader's earlier cut (scheme v1) to the current one (v2), or set aside
// as needing the reader's decision. The harness is the oracle for both cuts:
// lyric_harness._v1_token_spans and reader_token_spans(..., 'v2').
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const LT = require('../src/lyric-tokens.js');
// The chunk runs in its own realm: compare its values as plain JSON.
const P = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const same = (a, b, m) => assert.deepStrictEqual(P(a), P(b), m);

const ROOT = path.join(__dirname, '..');
const HARNESS = path.join(ROOT, 'lyric-harness');

// The analysis chunk as the build wraps it (CMLibraryDefine), in a context
// with the shared reader and inert page helpers.
function loadAnalysis() {
  let chunk = null;
  const ctx = vm.createContext({
    CMLyricTokens: LT,
    CMLibraryDefine: (name, factory) => {
      chunk = factory();
    },
    esc: (s) => String(s),
    icon: () => '',
    showToast: () => {},
    uiDownload: () => {},
    uiEmptyState: () => '',
    uiTabIndex: () => -1,
    crypto: globalThis.crypto,
    TextEncoder,
    console,
  });
  const src = fs.readFileSync(path.join(ROOT, 'src/library/analysis.js'), 'utf8');
  vm.runInContext(`CMLibraryDefine("analysis", function () {\n${src}\n});`, ctx);
  return chunk;
}
const A = loadAnalysis();

// The harness's own cuts for a list of lines: [{ v1, v2 }] per line, each
// [[text, [[a, b], ...]], ...] in codepoints (strip_parens False, as the
// Library reads every line with its asides sung).
function harnessCuts(lines, stripParens = false) {
  const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(HARNESS)})
import lyric_harness as LH
out = []
for t in json.load(sys.stdin):
    v1 = LH._v1_token_spans(t, ${stripParens ? 'True' : 'False'})
    v2 = LH.reader_token_spans(t, ${stripParens ? 'True' : 'False'}, 'v2')
    out.append({'v1': None if v1 is None else [[x, [list(p) for p in ps]] for x, ps in v1],
                'v2': [[x, [list(p) for p in ps]] for x, ps in v2]})
print(json.dumps(out))`;
  return JSON.parse(
    execFileSync('python3', ['-c', py], { input: JSON.stringify(lines), maxBuffer: 1 << 28 })
  );
}
// UTF-16 pieces -> codepoint pieces, for comparing with the harness.
function cpPieces(text, pieces) {
  const map = new Map();
  let u = 0,
    cp = 0;
  for (const c of Array.from(text)) {
    map.set(u, cp++);
    u += c.length;
  }
  map.set(u, cp);
  return pieces.map(([a, b]) => [map.get(a), map.get(b)]);
}

const OH = 'Oh--oh, oh my love';
const LOVE = 'love 4 love, love me true';
const PLAIN = 'the night is long above';
const SPLIT = 'ways:--and the road';
const row = (line, token, word, extra = {}) => ({
  line,
  token,
  word,
  phones: ['AA1'],
  basis: 'declared',
  source: 'the singer',
  ...extra,
});
// A device store over a Map, counting writes (the page's lib.device shape).
function memoryDevice(seed = {}) {
  const map = new Map(Object.entries(structuredClone(seed)));
  const dev = {
    writes: 0,
    map,
    get: async (k, fallback) => (map.has(k) ? structuredClone(map.get(k)) : fallback),
    set: async (k, v) => {
      dev.writes++;
      map.set(k, structuredClone(v));
    },
  };
  return dev;
}
const KEY = 'interpretation:unit:rev';
const READING = { reading_unit_id: 'unit', reading_revision: 'rev' };

test('the v1 migration cut is the harness’s _v1_token_spans on every fixture line', () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(HARNESS, 'quality/fixtures/reader_v2_mirror.json'), 'utf8')
  );
  const lines = [
    ...fixture.cases.map((c) => c.text),
    OH,
    LOVE,
    SPLIT,
    'There ’s high and low',
    "Wha 'll buy caller herrin'",
    "we 'S  go (oh) 'd",
    'O’er ʼtis ＇d',
    "gie 'm his dues",
    "x 'S y",
    "\u{1D400}b 's x",
  ];
  for (const strip of [false, true]) {
    const py = harnessCuts(lines, strip);
    let bad = 0;
    lines.forEach((t, i) => {
      const got = LT.v1GraderSpans(t, strip);
      const mine = got && got.map((s) => [s.text, cpPieces(t, s.pieces)]);
      if (JSON.stringify(mine) !== JSON.stringify(py[i].v1)) {
        bad++;
        if (bad <= 3) console.error('DISAGREE', strip, JSON.stringify(t), mine, py[i].v1);
      }
    });
    assert.equal(bad, 0, `stripParens ${strip}`);
  }
});

test('an unmarked choice is rebound to the same characters, with a notice (R3 repro)', () => {
  const [oh, love] = harnessCuts([OH, LOVE]);
  // The pre-release choice for the standalone "oh" is token 2 under v1, at
  // codepoints 8-10; under v2 token 2 is the "oh" inside "Oh--oh" (4-6).
  same(oh.v1[1], ['oh', [[8, 10]]]);
  same(oh.v2[1], ['oh', [[4, 6]]]);
  same(love.v1[2], ['love', [[13, 17]]]);
  same(love.v2[2], ['love', [[7, 11]]]);
  const stored = { declarations: { pronunciations: [row(OH, 2, 'oh'), row(LOVE, 3, 'love')] } };
  const s = A.savedInterpretation(stored);
  const sent = s.declarations.pronunciations;
  same(
    sent.map((r) => [r.token, r.word]),
    [
      [3, 'oh'],
      [4, 'love'],
    ]
  );
  // The token sent now names exactly the characters the old number named.
  same(oh.v2[sent[0].token - 1][1], [[8, 10]]);
  same(love.v2[sent[1].token - 1][1], [[13, 17]]);
  // Nothing but `token` moves: the row keeps the connector's six keys.
  same(Object.keys(sent[0]), Object.keys(row(OH, 2, 'oh')));
  same(s.undecided, []);
  same(
    s.renumbered.map((m) => [m.word, m.from, m.to]),
    [
      ['oh', 2, 3],
      ['love', 3, 4],
    ]
  );
  const notice = A.renumberedNotice(s.renumbered);
  assert.match(notice, /“oh” token 2 → 3/);
  assert.match(notice, /“love” token 3 → 4/);
  assert.match(notice, /no word-cut mark/);
  const body = A.analysisRequest(READING, s, null, 'k');
  same(body.declaration_set.pronunciations, sent);
  assert.equal(body.idempotency_key, 'k');
});

test('a line whose cut did not change binds byte-identically', () => {
  const stored = {
    declarations: { pronunciations: [row(PLAIN, 5, 'above')], hooks: [{ text: 'x', source: 's' }] },
  };
  const s = A.savedInterpretation(stored);
  assert.equal(JSON.stringify(s.declarations), JSON.stringify(stored.declarations));
  assert.equal(s.declarations.pronunciations[0], stored.declarations.pronunciations[0]);
  same(s.renumbered, []);
  same(s.undecided, []);
  assert.equal(s.legacy, undefined, 'nothing moved, so no legacy copy is kept');
  assert.equal(A.renumberedNotice(s.renumbered), '');
  assert.equal(
    JSON.stringify(A.analysisRequest(READING, s, null, 'k').declaration_set),
    JSON.stringify(stored.declarations)
  );
});

test('a choice no current word covers exactly is set aside, never sent', () => {
  const [split] = harnessCuts([SPLIT]);
  same(split.v1[1], ['--and', [[5, 10]]]);
  same(split.v2[1], ['and', [[7, 10]]]);
  const stored = {
    declarations: {
      pronunciations: [
        row(SPLIT, 2, '--and'), // v2 splits the old token: no exact span
        row(LOVE, 2, 'oh'), // the old number no longer names its word
        row(OH, 3, 'my'), // moves (my is token 3 under v1, 4 under v2)
        row(PLAIN, 1, 'the'), // unchanged
      ],
    },
  };
  const s = A.savedInterpretation(stored);
  same(
    s.declarations.pronunciations.map((r) => [r.word, r.token]),
    [
      ['my', 4],
      ['the', 1],
    ]
  );
  same(
    s.undecided.map((u) => [u.row.word, u.row.token]),
    [
      ['--and', 2],
      ['oh', 2],
    ]
  );
  assert.match(s.undecided[0].reason, /no word of the current cut covers exactly/);
  assert.match(s.undecided[1].reason, /no longer names “oh”/);
  same(s.legacy, stored.declarations, 'the original rows are kept beside');
  const body = A.analysisRequest(READING, s, null, 'k');
  assert.ok(body.refused, 'no analysis starts while a choice awaits a decision');
  assert.match(body.refused, /^Nothing was sent\. 2 saved pronunciation choices/);
  assert.match(body.refused, /“--and”, “oh”/);
  // Once the reader removes them, the rest is sent, set-aside rows never.
  const after = A.analysisRequest(READING, { ...s, undecided: [] }, null, 'k');
  same(after.declaration_set.pronunciations, s.declarations.pronunciations);
});

test('a record marked with the current cut is left untouched', async () => {
  const stored = {
    declarations: { pronunciations: [row(OH, 2, 'oh')] },
    token_cut: LT.SCHEME,
  };
  const s = A.savedInterpretation(stored);
  assert.equal(s.declarations, stored.declarations);
  assert.equal(s.changed, false);
  same(s.renumbered, []);
  const dev = memoryDevice({ [KEY]: stored });
  const loaded = await A.loadInterpretation(dev, KEY);
  assert.equal(dev.writes, 0);
  assert.equal(loaded.migrated, false);
  same(loaded.declarations.pronunciations[0].token, 2, 'token 2 is a v2 number here');
});

test('an unknown cut mark refuses, naming the accepted value', async () => {
  const stored = { declarations: { pronunciations: [row(PLAIN, 5, 'above')] }, token_cut: 'v9' };
  const s = A.savedInterpretation(stored);
  same(s.declarations.pronunciations, []);
  assert.equal(s.undecided.length, 1);
  assert.match(s.undecided[0].reason, /“v9”; this page accepts only “v2”/);
  assert.ok(A.analysisRequest(READING, s, null, 'k').refused);
  // Left exactly as stored until the reader acts, before and after a reload.
  const dev = memoryDevice({ [KEY]: stored });
  for (let i = 0; i < 2; i++) {
    const loaded = await A.loadInterpretation(dev, KEY);
    assert.equal(loaded.undecided.length, 1);
  }
  assert.equal(dev.writes, 0);
  same(dev.map.get(KEY), stored);
  // The reader removes the row: the record written is the current cut's,
  // and the removed row is gone from what is sent.
  const kept = { ...s, undecided: [] };
  await dev.set(KEY, A.interpretationRecord(kept));
  const again = await A.loadInterpretation(dev, KEY);
  assert.equal(again.changed, false);
  same(again.undecided, []);
});

test('the rebinding is written back once, marked, and survives a reload', async () => {
  const original = {
    declarations: {
      pronunciations: [row(OH, 2, 'oh'), row(SPLIT, 2, '--and'), row(PLAIN, 1, 'the')],
    },
  };
  const dev = memoryDevice({ [KEY]: original });
  const first = await A.loadInterpretation(dev, KEY);
  assert.equal(first.migrated, true);
  assert.equal(dev.writes, 1);
  const saved = dev.map.get(KEY);
  assert.equal(saved.token_cut, LT.SCHEME);
  same(saved.legacy_declarations, original.declarations);
  same(
    saved.declarations.pronunciations.map((r) => [r.word, r.token]),
    [
      ['oh', 3],
      ['the', 1],
    ]
  );
  // Reopened: not rebound a second time (token 3 stays 3), the notice and the
  // set-aside choice are still shown, and nothing is written.
  const second = await A.loadInterpretation(dev, KEY);
  assert.equal(second.migrated, false);
  assert.equal(dev.writes, 1);
  same(second.declarations, first.declarations);
  same(second.renumbered, first.renumbered);
  same(
    second.undecided.map((u) => u.row.word),
    ['--and']
  );
  assert.match(A.renumberedNotice(second.renumbered), /“oh” token 2 → 3/);
  assert.ok(A.analysisRequest(READING, second, null, 'k').refused);
});

test('the Lyrics handoff carries the current cut’s rows only (route 3)', async () => {
  const dev = memoryDevice({
    'interpretation:unit:rev': {
      declarations: { pronunciations: [row(OH, 2, 'oh'), row(SPLIT, 2, '--and')] },
    },
  });
  const lib = { device: { read: (k, f) => dev.get(k, f), write: (k, v) => dev.set(k, v) } };
  const handed = await A.declarations(READING, lib);
  same(
    handed.pronunciations.map((r) => [r.word, r.token]),
    [['oh', 3]]
  );
  assert.equal(dev.writes, 0, 'reading for a handoff never rewrites the device record');
});
