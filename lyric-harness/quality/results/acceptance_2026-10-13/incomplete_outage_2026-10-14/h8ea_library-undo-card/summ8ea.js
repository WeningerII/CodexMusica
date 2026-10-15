// Compact view of a run_*.json from probe8ea.js: node summ8ea.js <run.json>
// (adapted from findings_6955e342/repro/check-library-undo-card/summ.js; reads
// the record wherever the tree keeps it and parses the rendered card entries).
'use strict';
const o = require(require('path').resolve(process.argv[2]));
const short = (h) => (h || '').replace('[SETUP — title — ', '').replace(/"\]$/, '"').replace(/^"|"$/g, '') || '(empty)';
const W = (r) => (r && Array.isArray(r.items) ? r.items.map((m) => `${m.word}@L${(m.n || []).join('/')}`).join(',') + (r.draftId ? `<${r.draftId.slice(6, 14)}>` : '<no id>') + (r.at === 'ui.renumbered' ? '[ui]' : '') + (r.more ? `+more=${r.more}` : '') : '-');
const RC = (lines) => {
  if (!lines) return '(review panel hidden)';
  const t = lines.join(' ');
  const got = [...t.matchAll(/(a rhyme link on|a declared return on|the reading for) “([^”]+)”(?:, (lines? [^:]+))?: word (\d+) → (\d+)/g)].map((m) => `${m[2]}@${m[3] || '?'}:${m[4]}->${m[5]}`);
  return got.length ? got.join(', ') : 'NO CARD';
};
for (const [k, v] of Object.entries(o)) {
  if (!v || typeof v !== 'object') continue;
  if (v.threw) {
    console.log(`\n# ${o.tree} ${k} THREW ${v.threw.split('\n')[0]}`);
    continue;
  }
  if (k === 'extra' || k === 'download' || k === 'render_timing') {
    console.log(`\n# ${o.tree} ${o.fixture} ${k}`);
    console.log(JSON.stringify(v, null, 1).slice(0, 6000));
    continue;
  }
  const list = v.st || (k === 'payload' ? Object.values(v).flatMap((x) => [x.pre, x.post]) : null);
  if (!list) continue;
  console.log(`\n# ${o.tree} ${o.fixture} ${k}`);
  for (const s of list) {
    console.log(`- ${s.tag}`);
    console.log(`    draft=${short(s.head)} rows=${JSON.stringify(s.setupRows)} draftId=${s.draftId ? s.draftId.slice(0, 14) : null} live=${W(s.renumbered)}`);
    console.log(`    review card: ${RC(s.reviewCardLines)}`);
    console.log(`    LS: ${s.localStorage ? short(s.localStorage.head) + ' id=' + (s.localStorage.draftId || '').slice(0, 14) + ' rec=' + W(s.localStorage.renumbered) : null} | SS: ${s.sessionStorage ? short(s.sessionStorage.head) + ' rec=' + W(s.sessionStorage.renumbered) : null}`);
    console.log(`    IDB: ${s.idb.map((r) => `${String(r.key).slice(0, 14)}=${short(r.head)} savedAt=${r.savedAt} rec=${W(r.renumbered)}${r.adapted !== null ? ' ad=' + r.adapted : ''}`).join(' ; ') || '-'}`);
    console.log(`    hist: ${s.history.map((h) => `${h.cur ? '*' : ''}${short(h.head)}${h.draftId ? '@' + h.draftId.slice(6, 14) : ''}${h.adapted !== null ? '[ad=' + h.adapted + ']' : ''}{${h.renumbered ? h.renumbered.items.map((x) => x.word).join(',') : ''}}`).join(' > ')}`);
    if (s.toasts && s.toasts.length) console.log(`    toasts: ${JSON.stringify(s.toasts)}`);
    if (s.pageSung) console.log(`    pageSung: ${JSON.stringify(s.pageSung)}`);
  }
  for (const x of ['s3', 's4', 's6', 's8']) if (v[x]) console.log(`  search ${x}: ${JSON.stringify(v[x].hits)}`);
  if (v.native) console.log(`  native: ${JSON.stringify(v.native)}`);
  if (k === 'payload') for (const [p, x] of Object.entries(v)) console.log(`  ${p}: reached=${x.sent.reached} focus=${x.sent.focus} decl=${JSON.stringify(x.sent.declarations)} doc=${JSON.stringify(x.sent.document)}`);
  if (v.errors && v.errors.length) console.log(`  PAGE ERRORS ${JSON.stringify(v.errors)}`);
}
