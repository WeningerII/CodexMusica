// A PARKED REWRITE MAY CHANGE ONLY THE LINES THAT CAN FIX IT (#853, stage T).
// The open lines, their verbatim-return partners taken to closure, and every
// line when a whole-draft flag stands. Cases are drawn by seed over draft
// length, return classes and open lines; no line of verse is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parkedChangeable, wanderRefusal, _agentInternals } from './gemini_agent.js';

const draftOf = (n) => Array.from({ length: n }, (_, i) => `line ${i + 1}`);
const parked = (fields) => ({ parked: true, seed: 1, key: 'seed:1', ...fields });
const revise = (draft) => ({ seed: 1, draft });
const refusal = (lyr, draft) => wanderRefusal(lyr, 'lyric_revise', revise(draft));
const change = (draft, lines) => draft.map((t, i) => (lines.includes(i + 1) ? `${t} rewritten` : t));

// A small deterministic generator so every case is reproducible by its seed.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}
const pick = (r, n) => 1 + Math.floor(r() * n);

test('the open line alone may change; any other line is refused, named', () => {
  const draft = draftOf(6);
  const lyr = parked({ draft, open: [3], whole: [] });
  assert.deepEqual(parkedChangeable(lyr), [3]);
  assert.equal(refusal(lyr, change(draft, [3])), null);
  const r = refusal(lyr, change(draft, [3, 5]));
  assert.match(r, /changes line\(s\) 5, which are not open/);
  assert.match(r, /may change only line\(s\) 3\b/);
});

test('a declared verbatim return opens its partners, to closure', () => {
  const draft = draftOf(10);
  const lyr = parked({ draft, open: [1], whole: [], returns: '1,4;4,9' });
  assert.deepEqual(parkedChangeable(lyr), [1, 4, 9]);
  assert.equal(refusal(lyr, change(draft, [1, 4, 9])), null);
  assert.match(refusal(lyr, change(draft, [1, 2])), /changes line\(s\) 2\b/);
});

test('a placement member (N.PLACE) counts as its line', () => {
  const draft = draftOf(8);
  const lyr = parked({ draft, open: [2], whole: [], returns: '2.end,6.end' });
  assert.deepEqual(parkedChangeable(lyr), [2, 6]);
});

test('with no return declared, a line identical to an open line is its partner', () => {
  const draft = draftOf(8);
  draft[6] = draft[2];
  const lyr = parked({ draft, open: [3], whole: [] });
  assert.deepEqual(parkedChangeable(lyr), [3, 7]);
});

test('a whole-draft flag opens every line, alone or beside a line flag', () => {
  const draft = draftOf(5);
  for (const open of [[], [2]]) {
    const lyr = parked({ draft, open, whole: ['WHOLE_CODE'] });
    assert.equal(parkedChangeable(lyr), null);
    assert.equal(refusal(lyr, change(draft, [1, 4, 5])), null);
  }
});

test('the parked note states the lines that may change', () => {
  const { PARKED_RUN_NOTE } = _agentInternals;
  const lyr = parked({ draft: draftOf(4), open: [2], whole: [], returns: '2,4' });
  assert.match(PARKED_RUN_NOTE(lyr), /only line\(s\) 2, 4 may change/);
  assert.doesNotMatch(PARKED_RUN_NOTE(lyr), /byte-identical/);
});

test('drawn by seed: allowed changes pass, one change outside is refused', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed);
    const n = 2 + Math.floor(r() * 40);
    const draft = draftOf(n);
    const classes = [];
    for (let k = Math.floor(r() * 4); k > 0; k--) {
      const a = pick(r, n);
      const b = pick(r, n);
      if (a !== b) classes.push([a, b]);
    }
    const open = [...new Set(Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(r, n)))];
    const lyr = parked({
      draft,
      open,
      whole: [],
      ...(classes.length ? { returns: classes.map((c) => c.join(',')).join(';') } : {}),
    });
    const allowed = parkedChangeable(lyr);
    for (const l of open) assert.ok(allowed.includes(l), `seed ${seed}: open line ${l} allowed`);
    assert.equal(refusal(lyr, change(draft, allowed)), null, `seed ${seed}: allowed set passes`);
    const outside = draftOf(n)
      .map((_, i) => i + 1)
      .filter((l) => !allowed.includes(l));
    if (outside.length) {
      const l = outside[Math.floor(r() * outside.length)];
      assert.match(
        refusal(lyr, change(draft, [...allowed, l])),
        new RegExp(`changes line\\(s\\) ${l}, which are not open`),
        `seed ${seed}: line ${l} refused`
      );
    }
  }
});
