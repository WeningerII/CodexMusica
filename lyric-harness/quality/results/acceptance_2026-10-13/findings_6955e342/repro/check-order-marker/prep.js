// payloads -> binder items. Usage: node prep.js <tree>  (reads orders_<tree>.json, extras_<tree>.json [+ extras_<tree>_X5.json])
'use strict';
const fs = require('fs'), path = require('path');
const T = process.argv[2];
const D = __dirname;
const items = [];
const rd = (f) => (fs.existsSync(path.join(D, f)) ? JSON.parse(fs.readFileSync(path.join(D, f))) : []);
for (const r of rd(`orders_${T}.json`)) {
  if (r.threw) { items.push({ id: `${r.id}.THREW`, sung: [], groups: null, returns: null, threw: r.threw }); continue; }
  r.sends.forEach((s, k) => s.forEach((p, j) => {
    const d = p.declarations || {};
    items.push({ id: `${r.id}.send${k + 1}${s.length > 1 ? '.' + j : ''}${k === r.sends.length - 1 ? '.FINAL' : ''}`, sung: r.sungAtFinal, groups: d.groups || null, returns: d.returns || null });
  }));
}
const ex = rd(`extras_${T}.json`).filter((r) => !r.threw).concat(rd(`extras_${T}_X5.json`));
for (const r of ex) (r.payload || []).forEach((d, j) => items.push({ id: `${r.id}.send${j + 1}.FINAL`, sung: r.sung, groups: (d || {}).groups || null, returns: (d || {}).returns || null }));
fs.writeFileSync(path.join(D, `items_${T}.json`), JSON.stringify(items.filter((i) => i.sung.length), null, 1));
console.log(T, items.length, 'items;', items.filter((i) => i.threw).length, 'threw');
