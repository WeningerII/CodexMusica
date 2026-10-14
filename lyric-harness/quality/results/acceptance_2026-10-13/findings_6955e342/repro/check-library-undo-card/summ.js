// Compact view of a run_*.json: node summ.js <run.json>
'use strict';
const o = require(require('path').resolve(process.argv[2]));
const short = (h) => (h || '').replace('[SETUP — title — ', '').replace(/"\]$/, '"').replace(/^"|"$/g, '') || '(empty)';
const W = (r) => (r && Array.isArray(r.items) ? r.items.map((m) => `${m.word}@L${(m.n || []).join('/')}`).join(',') : '-');
for (const [k, v] of Object.entries(o)) {
  if (!v || typeof v !== 'object') continue;
  if (v.threw) {
    console.log(`\n# ${o.tree} ${k} THREW ${v.threw.split('\n')[0]}`);
    continue;
  }
  const list = v.st || (k === 'payload' ? Object.values(v).flatMap((x) => [x.pre, x.post]) : null);
  if (!list) continue;
  console.log(`\n# ${o.tree} ${o.fixture} ${k}`);
  for (const s of list) {
    const rc = s.reviewCardLines ? (s.reviewCardLines.length ? s.reviewCardLines[1].replace(/^.*characters: /, '').replace(/\. Nothing.*$/, '') : 'NO CARD') : '(review panel hidden)';
    console.log(`- ${s.tag}`);
    console.log(`    draft=${short(s.head)} rows=${JSON.stringify(s.setupRows)} draftId=${s.draftId ? s.draftId.slice(0, 14) : null} ui.renumbered=${W(s.renumbered)}`);
    console.log(`    review: ${rc}`);
    console.log(`    LS: ${s.localStorage ? short(s.localStorage.head) + ' id=' + (s.localStorage.draftId || '').slice(0, 14) + ' card=' + W(s.localStorage.renumbered) : null} | SS: ${s.sessionStorage ? short(s.sessionStorage.head) + ' card=' + W(s.sessionStorage.renumbered) : null}`);
    console.log(`    IDB: ${s.idb.map((r) => `${String(r.key).slice(0, 14)}=${short(r.head)} savedAt=${r.savedAt} card=${W(r.renumbered)}`).join(' ; ') || '-'}`);
    console.log(`    hist: ${s.history.map((h) => `${h.cur ? '*' : ''}${short(h.head)}${h.draftId ? '@' + h.draftId.slice(6, 14) : ''}${h.adapted !== null ? '[ad=' + h.adapted + ']' : ''}`).join(' > ')}`);
    if (s.toasts && s.toasts.length) console.log(`    toasts: ${JSON.stringify(s.toasts)}`);
    if (s.pageSung) console.log(`    pageSung: ${JSON.stringify(s.pageSung)}`);
  }
  for (const x of ['s4', 's6']) if (v[x]) console.log(`  search ${x}: ${JSON.stringify(v[x].hits)}`);
  if (v.native) console.log(`  native: ${JSON.stringify(v.native)}`);
  if (k === 'payload') for (const [p, x] of Object.entries(v)) console.log(`  ${p}: reached=${x.sent.reached} focus=${x.sent.focus} decl=${JSON.stringify(x.sent.declarations)} doc=${JSON.stringify(x.sent.document)}`);
  if (v.errors && v.errors.length) console.log(`  PAGE ERRORS ${JSON.stringify(v.errors)}`);
}
