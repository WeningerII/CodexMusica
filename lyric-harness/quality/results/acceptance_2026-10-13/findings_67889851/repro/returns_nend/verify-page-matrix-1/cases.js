// Member-level unrecognised annotations, the claim's own rows plus controls
// and extra probes; each opened as a saved session on the candidate and on
// main, then Run review through the page with /chat stubbed.
'use strict';
const V = require('./vlib.js');
const CASES = [
  // the claim's rows
  ['U6', 'rhyme groups', '[SETUP — rhyme groups — 1.head (kept),6]'],
  ['U7', 'rhyme groups', '[SETUP — rhyme groups — 1.T4 (carried across the word-cut change),6 — cut v2]'],
  ['U8', 'returns', '[SETUP — returns — 1.head (numbered under the earlier cut),6.head — cut v2]'],
  ['U12', 'rhyme groups', '[SETUP — rhyme groups — 1,6 — cut]'],
  // controls: recognised page states and row cut marks
  ['C1 carried named (valid)', 'rhyme groups', '[SETUP — rhyme groups — 1.head (carried across the word-cut change),6 — cut v2]'],
  ['C2 undecided T (valid)', 'rhyme groups', '[SETUP — rhyme groups — 1.T4 (numbered under the earlier cut),6 — cut v2]'],
  ['C3 member marked cut v3', 'rhyme groups', '[SETUP — rhyme groups — 1.T4 (marked cut v3: not read here),6 — cut v2]'],
  ['C4 plain unknown place', 'rhyme groups', '[SETUP — rhyme groups — 1.foo,6]'],
  ['C5 row cut v3', 'rhyme groups', '[SETUP — rhyme groups — 1,6 — cut v3]'],
  // extra probes
  ['X1 legacy T with unknown note beside a rebindable T', 'rhyme groups', '[SETUP — rhyme groups — 1.T4 (kept),8.T4]'],
  ['X2 page wording, other case', 'rhyme groups', '[SETUP — rhyme groups — 1.head (Carried across the word-cut change),6 — cut v2]'],
  ['X3 row mark with two spaces', 'rhyme groups', '[SETUP — rhyme groups — 1,6 — cut  v2]'],
  ['X5 unknown note, marked row', 'rhyme groups', '[SETUP — rhyme groups — 1.head (kept),6 — cut v2]'],
  ['X6 unknown note on unchanged line, unmarked', 'rhyme groups', '[SETUP — rhyme groups — 5 (kept),6]'],
];
(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : ['cand', 'main'];
  const browser = await V.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  try {
    for (const tree of only) {
      const server = V.serve(V.TREES[tree]);
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      const base = `http://127.0.0.1:${server.address().port}`;
      for (const [name, key, row] of CASES) {
        const b = await boot(browser, base, `${row}\n\n${V.SONG}`);
        const bootToasts = await b.page.evaluate(() => window.__toasts.splice(0));
        const s = await V.state(b.page, key);
        const rv = await V.runReview(b.page, b.q);
        const rec = { tree, name, written: row, rowAfterLoad: s.row, savedRow: s.saved, bootToasts, items: s.items, declNow: s.decl, chatCalls: rv.calls, sentDecl: rv.decl[0] ? Object.fromEntries(Object.entries(rv.decl[0]).filter(([k]) => /groups|returns/.test(k))) : null, runToasts: rv.toasts, ret: rv.ret, pageErrors: b.errors };
        res.push(rec);
        console.log(`[${tree}] ${name}\n  written : ${row}\n  loaded  : ${s.row}\n  saved   : ${s.saved}\n  boot    : ${JSON.stringify(bootToasts)}\n  review  : ${JSON.stringify(s.items.map((i) => `${i.tone}: ${i.title} [${i.actions.join(' | ')}]`))}\n  /chat   : ${rv.calls} call(s) ${JSON.stringify(rec.sentDecl)}\n  toasts  : ${JSON.stringify(rv.toasts)}\n  errors  : ${JSON.stringify(b.errors)}`);
        await b.ctx.close();
      }
      server.close();
    }
  } catch (e) { console.log('threw', e.stack || e); }
  await browser.close();
  V.fs.writeFileSync(V.path.join(V.OUT, `cases_${only.join('_')}.json`), JSON.stringify(res, null, 1));
})();
const boot = V.boot;
