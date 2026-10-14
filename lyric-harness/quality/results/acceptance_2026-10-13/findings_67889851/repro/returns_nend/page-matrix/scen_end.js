// N.end in a RETURNS row: the harness reads `N.end` as a placed (end-word)
// return member and bare `N` as a whole-line one (quality/schemes.py). What
// does the candidate page do to a hand-written pre-batch `N.end`, and what does
// it send? Also the baseline page, for the pre-existing form path.
'use strict';
const X = require('./cand_lib.js');
const { L } = X;
const { TEXT } = require('./cells.js');
const CASES = [
  ['E1 returns 4.end,6.end (changed line 4)', '[SETUP — returns — 4.end,6.end]'],
  ['E2 returns 5.end,6.end (unchanged lines only)', '[SETUP — returns — 5.end,6.end]'],
  ['E3 returns 5.end,6.end;1.T4,8.T4 (unchanged N.end + a rebindable T row-mate)', '[SETUP — returns — 5.end,6.end;1.T4,8.T4]'],
  ['E4 rhyme groups 5.end,6.end;1.T4,8.T4', '[SETUP — rhyme groups — 5.end,6.end;1.T4,8.T4]'],
  ['E5 returns 1.end,8.end (changed lines)', '[SETUP — returns — 1.end,8.end]'],
];
async function run(root, label, browser, m0) {
  const server = L.serve({ root });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = [];
  for (const [name, row] of CASES) {
    const ses = JSON.parse(m0.ls);
    ses.lyrics = `${row}\n\n${TEXT}`;
    const b = await X.boot(browser, base, { session: JSON.stringify(ses) });
    const key = /returns/.test(row) ? 'returns' : 'rhyme groups';
    const f = key === 'returns' ? 'returns' : 'groups';
    const s0 = await b.page.evaluate((key) => { lyRefresh(true); const m = lyParse($ui('lyrics-draft').value); return { row: $ui('lyrics-draft').value.split('\n').find((r) => r.includes(key)), items: (LY.items || []).filter((i) => i.id.startsWith(key + ':')).map((i) => `${i.tone}: ${i.title}`) }; }, key);
    const rv = await X.runReview(b.page, b.q);
    // Then the Repeats form adds an unrelated placed return (lines 2,3 head).
    let afterForm = null;
    if (key === 'returns') {
      await X.addPlacedUI(b.page, [[2, 'head'], [3, 'head']]);
      afterForm = await b.page.evaluate((key) => $ui('lyrics-draft').value.split('\n').find((r) => r.includes(key)), key);
    }
    const rec = { tree: label, name, written: row, afterLoad: s0.row, notices: s0.items, chatCalls: rv.calls.length, sent: rv.calls[0] ? rv.calls[0][f] : null, afterRepeatsFormAdd: afterForm, errors: b.errors };
    out.push(rec);
    console.log(`[${label}] ${name}\n  written:   ${row}\n  afterLoad: ${s0.row}\n  notices:   ${JSON.stringify(s0.items)}\n  sent:      ${JSON.stringify(rec.sent)} (calls ${rv.calls.length})\n  after Repeats form add: ${afterForm}`);
    await b.ctx.close();
  }
  server.close();
  return out;
}
(async () => {
  const m0 = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'main_cells.json'), 'utf8')).out['G|v0|L1|N'];
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  try {
    res.push(...(await run(L.WT_MAIN, 'main', browser, m0)));
    res.push(...(await run(L.WT_CAND, 'cand', browser, m0)));
  } catch (e) { console.log('threw', e.stack || e); }
  await browser.close();
  L.fs.writeFileSync(L.path.join(L.OUT, 'end_returns.json'), JSON.stringify(res, null, 1));
})();
