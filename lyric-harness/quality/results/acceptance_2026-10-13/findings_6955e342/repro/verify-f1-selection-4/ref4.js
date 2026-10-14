// Independent "same characters" reference for one migrated [SETUP] row.
// Model: the rewrite keeps the row's head, every separator, every member it
// does not respell and the closing "]" (team policy + R2's F6 text: only the
// changed members are respelled, then the mark ` — cut v2` is added at the end
// of the value). Within a respelled member, the common prefix and suffix of
// the old and new spelling survive; its middle is replaced. A reading row
// keeps everything but its number (and quoted word, if it changed), plus the
// mark. Each SURVIVING old character gets the index it now has. A caret is
// "on the same characters" when it has exactly the same surviving characters
// on its left: it may land anywhere from just after the last surviving
// character before it to just before the first surviving one after it.
// -> per old row: { surv: old index -> new index | null, regions: [{kind,
// from, to, member}] } or null when the rewrite is not of this shape.
'use strict';
const GROUP_OLD = /^(\[SETUP\s+—\s+(?:rhyme groups|returns)\s+—\s+)(.*)(\])$/;
const GROUP_NEW = /^(\[SETUP\s+—\s+(?:rhyme groups|returns)\s+—\s+)(.*?)(\s+—\s+cut v2)(\])$/;
const READ_OLD = /^(\[SETUP\s+—\s+reading\s+—\s+token )(\d+)( "(?:[^"\\]|\\.)*")(.*)(\])$/;
const READ_NEW = /^(\[SETUP\s+—\s+reading\s+—\s+token )(\d+)( "(?:[^"\\]|\\.)*")(.*?)(\s+—\s+cut v2)(\])$/;

function pieces(a, b) {
  // common prefix / suffix of one segment
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { p, s };
}
// segs: [[oldText, newText, kind, label], ...] in order; mark inserted where kind==='mark' (old '')
function build(segs) {
  const surv = [];
  const regions = [];
  let ox = 0, oy = 0;
  for (const [a, b, kind, label] of segs) {
    const changed = a !== b;
    if (a.length) regions.push({ kind: changed ? 'changed-' + kind : kind, label, from: ox, to: ox + a.length, text: a, now: b });
    if (!changed) for (let i = 0; i < a.length; i++) surv[ox + i] = oy + i;
    else {
      const { p, s } = pieces(a, b);
      for (let i = 0; i < a.length; i++) surv[ox + i] = i < p ? oy + i : i >= a.length - s ? oy + b.length - (a.length - i) : null;
    }
    ox += a.length;
    oy += b.length;
  }
  return { surv, regions, oldLen: ox, newLen: oy };
}
function rowModel(x, y) {
  if (x === y) {
    const surv = [...x].map((_, i) => i);
    return { surv, regions: [{ kind: 'row-unchanged', from: 0, to: x.length, text: x }], oldLen: x.length, newLen: y.length };
  }
  let a = GROUP_OLD.exec(x), b = GROUP_NEW.exec(y);
  if (a && b && !/\s+—\s+cut v2$/.test(a[2])) {
    const pa = a[2].split(/([;,])/), pb = b[2].split(/([;,])/);
    if (pa.length !== pb.length) return null;
    const segs = [[a[1], b[1], 'head', 'head']];
    let k = -1;
    for (let j = 0; j < pa.length; j++) {
      if (j % 2) {
        if (pa[j] !== pb[j]) return null;
        segs.push([pa[j], pb[j], 'sep', pa[j]]);
      } else {
        k++;
        // leading / trailing spaces of a member are layout, kept with it
        segs.push([pa[j], pb[j], 'member', `m${k}:${pa[j].trim()}`]);
      }
    }
    segs.push(['', b[3], 'mark', 'mark']);
    segs.push([a[3], b[4], 'close', ']']);
    if (a[1] !== b[1] || a[3] !== b[4]) return null;
    return build(segs);
  }
  a = READ_OLD.exec(x);
  b = READ_NEW.exec(y);
  if (a && b) {
    return build([
      [a[1], b[1], 'head', 'head'],
      [a[2], b[2], 'num', 'num'],
      [a[3], b[3], 'word', 'word'],
      [a[4], b[4], 'rest', 'rest'],
      ['', b[5], 'mark', 'mark'],
      [a[5], b[6], 'close', ']'],
    ]);
  }
  return null;
}
// caret col (0..oldLen) -> {lo, hi} in the new row
function caretRange(m, col) {
  let lo = 0, hi = m.newLen;
  for (let i = col - 1; i >= 0; i--) if (m.surv[i] != null) { lo = m.surv[i] + 1; break; }
  for (let i = col; i < m.oldLen; i++) if (m.surv[i] != null) { hi = m.surv[i]; break; }
  return { lo, hi };
}
// whole-document helpers: row index + col for an absolute offset
function locate(text, pos) {
  const rows = text.split('\n');
  let o = 0;
  for (let i = 0; i < rows.length; i++) {
    if (pos <= o + rows[i].length) return { i, col: pos - o, rowStart: o };
    o += rows[i].length + 1;
  }
  return null;
}
function docRange(before, after, pos) {
  const a = before.split('\n'), b = after.split('\n');
  if (a.length !== b.length) return null;
  const L = locate(before, pos);
  let ob = 0;
  for (let i = 0; i < L.i; i++) ob += b[i].length + 1;
  const m = rowModel(a[L.i], b[L.i]);
  if (!m) return null;
  const r = caretRange(m, L.col);
  return { lo: ob + r.lo, hi: ob + r.hi };
}
function regionOf(m, col, side) {
  // the region the character right of (side 'r') or left of (side 'l') the caret belongs to
  const idx = side === 'l' ? col - 1 : col;
  return m.regions.find((r) => idx >= r.from && idx < r.to) || null;
}
function show(text, s, e) {
  const rs = text.lastIndexOf('\n', s - 1) + 1;
  let re = text.indexOf('\n', Math.max(s, e));
  if (re < 0) re = text.length;
  return s === e ? text.slice(rs, s) + '|' + text.slice(s, re) : text.slice(rs, s) + '«' + text.slice(s, e) + '»' + text.slice(e, re);
}
module.exports = { rowModel, caretRange, docRange, regionOf, show, locate };
