// Summarise e2e_*.json: per trigger, cases / migrated at boundary / sameChars / page selection == in-page lyMapOffset prediction;
// and whether prog/chat/kbd agree offset-for-offset.
'use strict';
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const by = {};
  const sel = {};
  for (const c of j.cases) {
    const b = (by[c.trig] = by[c.trig] || { cases: 0, threw: 0, migratedBefore: 0, migratedAtBoundary: 0, sameChars: 0, predMatch: 0, predNull: 0, requests: 0, focusedAfter: 0 });
    b.cases++;
    if (c.threw) { b.threw++; continue; }
    if (c.migratedBeforeBoundary) b.migratedBefore++;
    if (c.migratedAtBoundary) b.migratedAtBoundary++;
    if (c.sameChars) b.sameChars++;
    if (c.predictionMatches === true) b.predMatch++;
    if (c.predictionMatches === null) b.predNull++;
    if (c.requests > 0) b.requests++;
    if (c.after.focused) b.focusedAfter++;
    (sel[`${c.row}|${c.label}`] = sel[`${c.row}|${c.label}`] || {})[c.trig] = JSON.stringify(c.after.sel.slice(0, 2));
  }
  console.log(f, j.tree, j.feed);
  for (const [t, b] of Object.entries(by)) console.log('  ', t, JSON.stringify(b));
  const trigs = Object.keys(by);
  let agree = 0, n = 0;
  const diff = [];
  for (const [k, v] of Object.entries(sel)) {
    n++;
    const ref = ['prog', 'chat', 'kbd'].filter((t) => v[t]).map((t) => v[t]);
    if (ref.every((x) => x === ref[0])) agree++; else diff.push([k, v]);
  }
  console.log(`   prog/chat/kbd identical after-selection: ${agree}/${n}`);
  if (trigs.includes('click')) console.log('   click after-selections:', JSON.stringify([...new Set(Object.values(sel).map((v) => v.click))]));
  for (const d of diff) console.log('   DIFF', JSON.stringify(d));
}
