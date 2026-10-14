// Unknown / malformed markers on hand-written rows, opened on the candidate.
'use strict';
const X = require('./cand_lib.js');
const { L } = X;
const { TEXT } = require('./cells.js');
const CASES = [
  ['U1 row cut v3 (T)', '[SETUP — rhyme groups — 1.T4,6 — cut v3]'],
  ['U2 row cut v3 (named, returns)', '[SETUP — returns — 1.head,6.head — cut v3]'],
  ['U3 row cut v1', '[SETUP — rhyme groups — 1.T4,6 — cut v1]'],
  ['U4 row cut V2 (case)', '[SETUP — rhyme groups — 1.T4,6 — cut V2]'],
  ['U5 member marked cut v3', '[SETUP — rhyme groups — 1.T4 (marked cut v3: not read here),6 — cut v2]'],
  ['U6 unknown member note, unmarked row', '[SETUP — rhyme groups — 1.head (kept),6]'],
  ['U7 carried marker on a T member', '[SETUP — rhyme groups — 1.T4 (carried across the word-cut change),6 — cut v2]'],
  ['U8 undecided marker on a named place', '[SETUP — returns — 1.head (numbered under the earlier cut),6.head — cut v2]'],
  ['U9 carried marker, unchanged line, unmarked row', '[SETUP — rhyme groups — 5 (carried across the word-cut change),6]'],
  ['U10 marked row, named place on changed line, no state', '[SETUP — rhyme groups — 1.head,6 — cut v2]'],
  ['U11 row cut v9 + other text', '[SETUP — rhyme groups — 1,6 — cut v9]'],
  ['U12 garbage mark', '[SETUP — rhyme groups — 1,6 — cut]'],
];
(async () => {
  const m0 = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'main_cells.json'), 'utf8')).out['G|v0|L1|N'];
  const server = L.serve({ root: L.WT_CAND });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  try {
    for (const [name, row] of CASES) {
      const ses = JSON.parse(m0.ls);
      ses.lyrics = `${row}\n\n${TEXT}`;
      const b = await X.boot(browser, base, { session: JSON.stringify(ses) });
      const bootToasts = await L.toasts(b.page);
      const key = /returns/.test(row) ? 'returns' : 'rhyme groups';
      const s = await X.snap(b.page);
      const items = await b.page.evaluate((key) => (LY.items || []).filter((i) => i.id.startsWith(key + ':')).map((i) => ({ id: i.id, tone: i.tone, title: i.title, text: i.text.slice(0, 300), actions: (i.actions || []).map((a) => a[1]) })), key);
      const rv = await X.runReview(b.page, b.q);
      const f = key === 'returns' ? 'returns' : 'groups';
      const rec = { name, written: row, rowAfter: s.rows.find((r) => r.includes(key)) || null, bootToasts, notices: items, chatCalls: rv.calls.length, sent: rv.calls[0] ? { [f]: rv.calls[0][f], nd: rv.calls[0][`${f}_need_decision`] } : null, declWouldSend: s.decl, refusal: rv.toasts.filter((t) => /Nothing was sent/.test(t)), pageErrors: b.errors };
      res.push(rec);
      console.log(`${name}\n  written: ${row}\n  after:   ${rec.rowAfter}\n  notices: ${JSON.stringify(items.map((i) => `${i.tone}: ${i.title}`))}\n  calls ${rec.chatCalls} sent ${JSON.stringify(rec.sent)} decl ${JSON.stringify(s.decl)}\n  refusal ${JSON.stringify(rec.refusal)}\n  bootToasts ${JSON.stringify(bootToasts)}`);
      await b.ctx.close();
    }
  } catch (e) {
    console.log('threw', e.stack || e);
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, 'unknown.json'), JSON.stringify(res, null, 1));
})();
