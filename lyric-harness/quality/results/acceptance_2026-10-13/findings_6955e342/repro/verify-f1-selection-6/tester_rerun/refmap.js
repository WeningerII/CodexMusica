// Reference "same characters" mapping for a migration rewrite, independent of
// the page's lyMapOffset. Member-aware: a rhyme groups / returns row is cut
// into its head, its members and separators (in lyParseGroups' order), and
// its tail; a reading row into head, number, quoted word, rest, `]`. Equal
// segments map character for character; a changed segment maps its common
// prefix and suffix and leaves the middle ambiguous; segments the rewrite
// INSERTED (the ` — cut v2` mark, a member annotation) map from nothing.
// A caret between characters c-1 and c may land anywhere between where
// those two characters went: -> { lo, hi } (absolute offsets in `after`).
'use strict';

const GROUP = /^(\[SETUP\s+—\s+(?:rhyme groups|returns)\s+—\s+)(.*?)((?:\s+—\s+cut v2)?)(\])$/;
const READING = /^(\[SETUP\s+—\s+reading\s+—\s+token )(\d+)( "(?:[^"\\]|\\.)*")(.*?)((?:\s+—\s+cut v2)?)(\])$/;

function segsOf(row) {
  let m = GROUP.exec(row);
  if (m) {
    const parts = m[2].split(/([;,])/);
    return [
      { t: m[1], k: 'head' },
      ...parts.map((p, j) => ({ t: p, k: j % 2 ? 'sep' + j : 'm' + j })),
      { t: m[3], k: 'mark' },
      { t: m[4], k: 'close' },
    ];
  }
  m = READING.exec(row);
  if (m)
    return [
      { t: m[1], k: 'head' },
      { t: m[2], k: 'num' },
      { t: m[3], k: 'word' },
      { t: m[4], k: 'rest' },
      { t: m[5], k: 'mark' },
      { t: m[6], k: 'close' },
    ];
  return null;
}
// Character map x -> y for one row: map[i] = index in y, or [lo, hi] range
// for an ambiguous (replaced) character.
function rowCharMap(x, y) {
  const sx = segsOf(x),
    sy = segsOf(y);
  if (!sx || !sy || sx.length !== sy.length) return null;
  const map = new Array(x.length);
  let ox = 0,
    oy = 0;
  for (let k = 0; k < sx.length; k++) {
    const a = sx[k].t,
      b = sy[k].t;
    if (sx[k].k !== sy[k].k) return null;
    // A member that gained an annotation: its own spelling is a prefix.
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    for (let i = 0; i < a.length; i++) {
      if (i < p) map[ox + i] = oy + i;
      else if (i >= a.length - s) map[ox + i] = oy + b.length - (a.length - i);
      else map[ox + i] = [oy + p, oy + b.length - s];
    }
    ox += a.length;
    oy += b.length;
  }
  return map;
}
// -> { lo, hi } for caret offset `pos` of `before` in `after`, or null when
// the rewrite is not one this reference understands.
function refMap(before, after, pos) {
  const a = before.split('\n'),
    b = after.split('\n');
  if (a.length !== b.length) return null;
  let oa = 0,
    ob = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    if (pos <= oa + x.length) {
      const col = pos - oa;
      if (x === y) return { lo: ob + col, hi: ob + col };
      const map = rowCharMap(x, y);
      if (!map) return null;
      const endOf = (c) => (Array.isArray(map[c]) ? map[c][1] : map[c] + 1);
      const startOf = (c) => (Array.isArray(map[c]) ? map[c][0] : map[c]);
      const lo = col > 0 ? endOf(col - 1) : 0;
      const hi = col < x.length ? startOf(col) : y.length;
      return { lo: ob + Math.min(lo, hi), hi: ob + Math.max(lo, hi) };
    }
    oa += x.length + 1;
    ob += y.length + 1;
  }
  return { lo: after.length, hi: after.length };
}
// The page's own lyMapOffset, copied verbatim from wt-695 src/pages/lyrics.js
// (643e292e) so the node side can predict what the page will do.
function lyMapOffset(before, after, pos) {
  const a = before.split('\n'),
    b = after.split('\n');
  if (a.length !== b.length) return Math.min(pos, after.length);
  let oa = 0,
    ob = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    if (pos <= oa + x.length) {
      const col = pos - oa;
      if (x === y) return ob + col;
      let p = 0;
      while (p < x.length && p < y.length && x[p] === y[p]) p++;
      let s = 0;
      while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s++;
      if (col <= p) return ob + col;
      if (col >= x.length - s) return ob + y.length - (x.length - col);
      return ob + y.length - s;
    }
    oa += x.length + 1;
    ob += y.length + 1;
  }
  return after.length;
}
// Show a caret or selection in its row: «…» marks the selection, | a caret.
function show(text, s, e) {
  const rs = text.lastIndexOf('\n', s - 1) + 1;
  let re = text.indexOf('\n', e);
  if (re < 0) re = text.length;
  if (s === e) return text.slice(rs, s) + '|' + text.slice(s, re);
  return text.slice(rs, s) + '«' + text.slice(s, e) + '»' + text.slice(e, re);
}
module.exports = { segsOf, rowCharMap, refMap, lyMapOffset, show };

if (require.main === module) {
  const before = '[SETUP — returns — 1.T2, 2.end]\n\nX';
  const after = '[SETUP — returns — 1.T3, 2.end — cut v2]\n\nX';
  const at = before.indexOf('2.end') + 2; // inside 2.end, before "end"
  console.log('3PO example, caret before "end" of 2.end at', at);
  console.log('  ref', JSON.stringify(refMap(before, after, at)), show(after, refMap(before, after, at).lo, refMap(before, after, at).lo));
  const lm = lyMapOffset(before, after, at);
  console.log('  page lyMapOffset ->', lm, show(after, lm, lm));
  const b2 = '[SETUP — rhyme groups — 1.T2,2]';
  const a2 = '[SETUP — rhyme groups — 1.T3,2 — cut v2]';
  const at2 = b2.lastIndexOf('2');
  console.log('coincidence, caret before member "2" at', at2, 'ref', JSON.stringify(refMap(b2, a2, at2)), 'page', lyMapOffset(b2, a2, at2), show(a2, lyMapOffset(b2, a2, at2), lyMapOffset(b2, a2, at2)));
}
