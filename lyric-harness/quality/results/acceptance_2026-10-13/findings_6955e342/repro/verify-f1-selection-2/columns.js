// Every caret column of 3PO's row through the candidate's own lyMapOffset
// (extracted verbatim from wt-695 src/pages/lyrics.js), against the
// alignment of the two rows: old[0,22) = new[0,22); old[22] '2' -> new[22] '3';
// old[23,30) = new[23,30) (", 2.end"); " — cut v2" inserted at new 30; ']' old 30 -> new 39.
'use strict';
const fs = require('fs');
const src = fs.readFileSync('/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-695/src/pages/lyrics.js', 'utf8');
const m = /function lyMapOffset\(before, after, pos\) \{[\s\S]*?\n\}\n/.exec(src);
const lyMapOffset = new Function(`${m[0]}; return lyMapOffset;`)();
const OLD = '[SETUP — returns — 1.T2, 2.end]', NEW = '[SETUP — returns — 1.T3, 2.end — cut v2]';
const ref = (c) => (c <= 29 ? [c] : c === 30 ? [30, 39] : [c + 9]);
const rows = [];
for (let c = 0; c <= OLD.length; c++) {
  const got = lyMapOffset(OLD, NEW, c);
  const ok = ref(c).includes(got);
  rows.push({ col: c, ctx: OLD.slice(Math.max(0, c - 4), c) + '|' + OLD.slice(c, c + 4), got, want: ref(c), ok, gotCtx: NEW.slice(Math.max(0, got - 4), got) + '|' + NEW.slice(got, got + 4) });
}
for (const r of rows) console.log(`${String(r.col).padStart(2)} ${JSON.stringify(r.ctx).padEnd(14)} -> ${String(r.got).padStart(2)} ${JSON.stringify(r.gotCtx).padEnd(14)} want ${JSON.stringify(r.want)} ${r.ok ? 'ok' : 'MOVED'}`);
console.log('moved columns:', rows.filter((r) => !r.ok).map((r) => r.col).join(','));
// The same row in the middle of a document, and the two other orders.
const doc = (row) => `${row}\n\n[VERSE]\nOh--oh, oh my love\nI walk the line tonight`;
for (const [o, n] of [
  ['[SETUP — returns — 2.end, 1.T2]', '[SETUP — returns — 2.end, 1.T3 — cut v2]'],
  ['[SETUP — returns — 1.T2]', '[SETUP — returns — 1.T3 — cut v2]'],
]) {
  const k = o.indexOf('2.end');
  if (k >= 0) console.log(JSON.stringify(o), 'caret 2.|end', k + 2, '->', lyMapOffset(doc(o), doc(n), k + 2), 'sel [', k, k + 5, '] ->', lyMapOffset(doc(o), doc(n), k), lyMapOffset(doc(o), doc(n), k + 5));
  else console.log(JSON.stringify(o), 'caret 1.T2|', o.indexOf('1.T2') + 4, '->', lyMapOffset(doc(o), doc(n), o.indexOf('1.T2') + 4), '(new row length', n.length, ')');
}
