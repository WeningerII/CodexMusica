'use strict';
const fs = require('fs'), path = require('path');
const O = __dirname;
const trees = (process.argv[2] || 'cand,main,base,c61b,c678').split(',');
const short = (v) => (v && typeof v === 'object' && 'line2' in v ? `${JSON.stringify(v.line2)} marked=${v.marked} rows=${Array.isArray(v.rows) ? v.rows.length : 0}` : JSON.stringify(v));
for (const t of trees) {
  const f = path.join(O, `native_undo_${t}.json`);
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`===== ${t}`);
  for (const [k, r] of Object.entries(j.scen)) {
    if (r.threw) { console.log(`  ${k}: THREW ${r.threw.slice(0, 300)}`); continue; }
    const parts = [];
    for (const key of ['dockVisible', 'buttons', 'posts', 'sentHadContext', 'rewroteAtSend', 'chatInputAfter']) if (key in r) parts.push(`${key}=${JSON.stringify(r[key])}`);
    console.log(`  ${k}: ${parts.join(' ')} errors=${r.errors.length}`);
    for (const key of ['pasted', 'typed', 'sent', 'afterImport', 'appUndo1', 'appUndo2', 'afterAppUndo']) if (key in r) console.log(`     ${key}: ${short(r[key])}`);
    if (r.ctrlZ) r.ctrlZ.forEach((v, i) => console.log(`     ctrlZ${i + 1}: ${short(v)}`));
  }
}
