// p3/p4 payloads -> binder items for p2/bind.py (one per /chat call; FINAL = the last call of
// the run). The sung lines are the payload's own document as the page parses it.
// Usage: node prep.js <tree>   (reads p3/run_<tree>.json and p4/extras_<tree>.json)
'use strict';
const fs = require('fs'), path = require('path');
const T = process.argv[2];
const D = path.join(__dirname, '..');
const rd = (f) => (fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f))) : []);
const items = [];
for (const r of rd(`p3/run_${T}.json`)) {
  if (r.threw) continue;
  const all = [];
  r.sends.forEach((s, k) => s.calls.forEach((c, j) => all.push({ k, j, c })));
  all.forEach(({ k, j, c }, x) => {
    const d = c.declarations || {};
    items.push({ id: `${r.id}.send${k + 1}${j ? '.' + j : ''}${x === all.length - 1 ? '.FINAL' : ''}`, sung: c.sung || r.sungAtFinal, groups: d.groups || null, returns: d.returns || null });
  });
}
for (const r of rd(`p4/extras_${T}.json`)) {
  if (r.threw) continue;
  (r.payload || []).forEach((p, j) => {
    const d = p.declarations || {};
    items.push({ id: `${r.id}.send${j + 1}.FINAL`, sung: p.sung || r.sung, groups: d.groups || null, returns: d.returns || null });
  });
}
fs.writeFileSync(path.join(__dirname, `items_${T}.json`), JSON.stringify(items.filter((i) => i.sung && i.sung.length), null, 1));
console.log(T, items.length, 'items');
