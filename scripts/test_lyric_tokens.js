// The website's reader (src/lyric-tokens.js) against the harness's
// (lyric_harness.reader_line, scheme v2), on the generated fixture the harness
// writes (lyric-harness/quality/reader_cases.py mirror_fixture(); its
// freshness is checked by lyric-harness/quality/test_reader.py). Texts,
// codepoint pieces (converted from the mirror's UTF-16 offsets), numeral and
// aside flags, for tokens and raw runs, under both paren declarations. Then
// the page's own word spans (lyWordSpans) are checked to number exactly the
// tokens lyTokens returns.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const LT = require('../src/lyric-tokens.js');

const ROOT = path.join(__dirname, '..');
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'lyric-harness/quality/fixtures/reader_v2_mirror.json'), 'utf8')
);

// UTF-16 offset -> codepoint offset, for one line.
function toCodepoints(text) {
  const map = new Map();
  let cp = 0,
    u = 0;
  for (const c of Array.from(text)) {
    map.set(u, cp);
    u += c.length;
    cp += 1;
  }
  map.set(u, cp);
  return (offset) => {
    assert.ok(
      map.has(offset),
      `offset ${offset} splits a surrogate pair in ${JSON.stringify(text)}`
    );
    return map.get(offset);
  };
}

const shape = (text, list) => {
  const cp = toCodepoints(text);
  return list.map((t) => [t.text, t.pieces.map(([a, b]) => [cp(a), cp(b)]), t.numeral, t.aside]);
};

test('the mirror agrees with the harness on every fixture case', () => {
  assert.equal(FIXTURE.scheme, LT.SCHEME);
  assert.ok(FIXTURE.cases.length > 1000);
  let disagreements = 0;
  for (const c of FIXTURE.cases) {
    for (const [key, stripParens] of [
      ['strip', true],
      ['keep', false],
    ]) {
      const got = LT.readerLine(c.text, { stripParens });
      const ok =
        JSON.stringify(shape(c.text, got.tokens)) === JSON.stringify(c[key].tokens) &&
        JSON.stringify(shape(c.text, got.runs)) === JSON.stringify(c[key].runs);
      if (!ok) {
        disagreements += 1;
        if (disagreements <= 5)
          console.error(
            'DISAGREE',
            key,
            JSON.stringify(c.text),
            JSON.stringify(shape(c.text, got.tokens)),
            JSON.stringify(c[key].tokens)
          );
      }
    }
  }
  assert.equal(disagreements, 0);
});

test('pieces slice the source line', () => {
  for (const c of FIXTURE.cases) {
    for (const t of LT.readerLine(c.text, { stripParens: false }).tokens) {
      let prev = -1;
      for (const [a, b] of t.pieces) {
        assert.ok(prev <= a && a < b && b <= c.text.length, JSON.stringify(c.text));
        prev = b;
      }
    }
  }
});

test("the page's word spans number exactly the tokens it declares against", () => {
  const ctx = vm.createContext({
    console,
    $ui: () => null,
    uiRegisterPage: () => {},
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {},
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/pages/lyrics.js'), 'utf8'), ctx, {
    filename: 'src/pages/lyrics.js',
  });
  for (const c of FIXTURE.cases.slice(0, 600)) {
    for (const voices of [false, true]) {
      ctx.__text = c.text;
      ctx.__voices = voices;
      const tokens = vm.runInContext('lyTokens(__text, __voices)', ctx);
      const spans = vm.runInContext('lyWordSpans(__text, __voices)', ctx);
      assert.deepEqual(
        Array.from(tokens),
        c[voices ? 'keep' : 'strip'].tokens.map((t) => t[0])
      );
      // Every printed character is shown once, in order.
      assert.equal(spans.map((p) => (p.gap !== undefined ? p.gap : p.word)).join(''), c.text);
      // Each numbered span belongs to token n, in order; a joined token's
      // pieces share n. Where two tokens' pieces overlap (a chunk the reader
      // could only map whole) the later one may have nothing left to show.
      const numbers = Array.from(spans.filter((p) => p.token).map((p) => p.token));
      assert.deepEqual(
        numbers,
        [...numbers].sort((x, y) => x - y)
      );
      const pieces = c[voices ? 'keep' : 'strip'].tokens.flatMap((t) => t[1]);
      const overlap = pieces.some((p, i) => i && p[0] < pieces[i - 1][1]);
      if (!overlap) assert.equal(new Set(numbers).size, tokens.length, JSON.stringify(c.text));
    }
  }
});

test('no class in the mirror case-folds: every such codepoint is in the fixture', () => {
  // Under the `i` flag a Unicode class matches whatever case-folds into it,
  // which Python's re.I does not do for \w. Enumerate, in the engine this runs
  // on, every codepoint where the mirror's word class differs with and without
  // `i`; each must be a fixture case (reader_cases.CLASS_BOUNDARY_CODEPOINTS),
  // so the agreement test above reads it in the positions a class decides.
  const plain = /^[\p{L}\p{N}_]$/u;
  const folded = /^[\p{L}\p{N}_]$/iu;
  const differ = [];
  for (let c = 0; c <= 0x10ffff; c++) {
    if (c >= 0xd800 && c <= 0xdfff) continue;
    const s = String.fromCodePoint(c);
    if (plain.test(s) !== folded.test(s)) differ.push(s);
  }
  assert.ok(differ.includes('ͅ'));
  const texts = FIXTURE.cases.map((c) => c.text);
  for (const s of differ) {
    const hex = s.codePointAt(0).toString(16);
    assert.ok(
      texts.some((t) => t.includes(`dog 's${s} bone`)),
      `U+${hex} is not a fixture case`
    );
  }
  const source = fs.readFileSync(path.join(ROOT, 'src/lyric-tokens.js'), 'utf8');
  const flags = [
    ...[...source.matchAll(/new RegExp\([^;]*?,\s*'([a-z]+)'\s*\)/g)].map((m) => m[1]),
    ...[...source.matchAll(/\/([dgimsuvy]+)\s*[;,)]/g)].map((m) => m[1]),
  ];
  assert.ok(flags.length >= 4, `found flags ${flags}`);
  for (const f of flags) assert.ok(!f.includes('i'), `a regex in the mirror takes flags '${f}'`);
});

test("a symbol's normal-form mark: every such starter is in the fixture", () => {
  // A non-letter starter whose NFC form carries a combining mark (U+2ADC,
  // the musical note symbols) maps that form to its own codepoint, and its
  // mark must not start the next word's raw run. Enumerate them in the engine
  // this runs on; each must be a fixture case (reader_cases.NFC_MARK_SYMBOLS),
  // and after one the end word reads as it does after U+266A.
  const M = /^\p{M}$/u;
  const L = /^\p{L}$/u;
  const N = /^\p{N}$/u;
  const found = [];
  for (let c = 0; c <= 0x10ffff; c++) {
    if (c >= 0xd800 && c <= 0xdfff) continue;
    const s = String.fromCodePoint(c);
    const nfc = s.normalize('NFC');
    if (nfc !== s && !M.test(s) && !L.test(s) && !N.test(s) && /\p{M}/u.test(nfc)) found.push(s);
  }
  assert.ok(found.includes('⫝̸') && found.includes('\u{1d160}'));
  const texts = FIXTURE.cases.map((c) => c.text);
  for (const s of found) {
    const hex = s.codePointAt(0).toString(16);
    assert.ok(texts.includes(`sing along ${s}love`), `U+${hex} is not a fixture case`);
    const runs = (t) => LT.readerLine(t).runs.map((r) => r.text);
    assert.deepEqual(runs(`sing along ${s}love`), runs('sing along ♪love'), `U+${hex}`);
    assert.deepEqual(runs(`we sing${s}tonight`), ['we', 'sing', 'tonight'], `U+${hex}`);
  }
});
