// Phase 2: each baseline cell opened on the CANDIDATE page as a pre-batch
// user's saved session (localStorage written by the wt-main page), then
// Run review through the page with /chat stubbed and its request captured.
'use strict';
const X = require('./cand_lib.js');
const { L } = X;
const { expect } = require('./expect.js');
const filt = new RegExp(process.argv[2] || '.');
const outName = process.argv[3] || 'matrix';
(async () => {
  const main = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'main_cells.json'), 'utf8')).out;
  const server = L.serve({ root: L.WT_CAND });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  const t0 = Date.now();
  try {
    for (const [id, m] of Object.entries(main)) {
      if (id.startsWith('__') || !filt.test(id)) continue;
      const c = m.cell;
      const mainRow = m.text.split('\n').find((r) => r.startsWith(`[SETUP — ${c.key} —`));
      const exp = expect(c, mainRow);
      const b = await X.boot(browser, base, { session: m.ls });
      const bootToasts = await L.toasts(b.page);
      const s = await X.snap(b.page);
      const view = await b.page.evaluate((key) => {
        const lab = [...document.querySelectorAll('.ly-r-setup')].map((e) => e.querySelector('.ly-lab')?.innerText || '').filter((t) => t.toLowerCase().startsWith(key));
        const items = (LY.items || []).filter((i) => i.id.startsWith(key + ':')).map((i) => ({ id: i.id, tone: i.tone, title: i.title, text: i.text, actions: (i.actions || []).map((a) => a[1]) }));
        LY_ACTIONS['ly-tool'](key === 'returns' ? 'repeats-voices' : 'rhymes');
        const tool = $ui('ly-panel-tools')?.innerText || document.querySelector('.ly-tool-view')?.innerText || '';
        const m = lyParse($ui('lyrics-draft').value);
        const row = lySetupOf(m, key)[0];
        const mem = row ? lyRowGroups(row).flat()[0] : null;
        return { lab, items, toolLine: tool.split('\n').filter((l) => /Line \d|carried|numbered under|\d\.T\d/.test(l)).slice(0, 4), word: mem ? lyMemberWord(m, mem) : null, ctxEdit: (() => { const x = window.uiLyricContext('lyrics-edit'); return x && x.blocked ? { blocked: x.blocked } : { declarations: x && x.declarations }; })() };
      }, c.key);
      const rv = await X.runReview(b.page, b.q);
      const reviewHas = { carried: /carried across the word-cut change/.test(s.review), undecided: /numbered under the earlier word cut/.test(s.review) };
      const row = s.rows.find((r) => r.startsWith(`[SETUP — ${c.key} —`)) || null;
      const field = c.key === 'returns' ? 'returns' : 'groups';
      const sent = rv.calls[0] || null;
      const noticeKinds = view.items.map((i) => `${i.tone}:${/carried/.test(i.id) ? 'carried' : /undecided/.test(i.id) ? 'undecided' : /unknown-cut/.test(i.id) ? 'unknown' : 'other'}`);
      const ok = {
        row: row === exp.row,
        notice: exp.notice ? noticeKinds.length === 1 && noticeKinds[0] === exp.notice : noticeKinds.length === 0,
        sent: exp.blocked ? rv.calls.length === 0 : rv.calls.length === 1 && sent && sent[field] === exp.sent[field] && !Object.keys(sent).some((k) => /need_decision/.test(k)) && (!c.voices || sent.voices === true),
        needDecision: exp.blocked ? JSON.stringify(view.ctxEdit.blocked ? true : false) === 'true' : !view.ctxEdit.blocked,
        actions: exp.kind === 'carried' ? view.items[0] && view.items[0].actions.join('|') === 'Keep the link|Remove it' : true,
        saved: s.saved === s.text,
      };
      const pass = Object.values(ok).every(Boolean);
      const rec = { id, cell: c, mainRow, mainSent: m.decl, mainWord: m.mainWord, expected: exp, observed: { row, rows: s.rows, bootToasts, notices: view.items, editorLabel: view.lab, toolLines: view.toolLine, currentWord: view.word, decl: s.decl, chatCalls: rv.calls.length, sent, reviewToasts: rv.toasts, ctxEditBlocked: view.ctxEdit.blocked || null, reviewHas, savedEqualsDraft: s.saved === s.text, pageErrors: b.errors }, ok, pass };
      res.push(rec);
      console.log(`${pass ? 'PASS' : 'FAIL'} ${id} | main ${mainRow} | now ${row} | notices ${JSON.stringify(noticeKinds)} | calls ${rv.calls.length} sent ${sent ? JSON.stringify({ [field]: sent[field], voices: sent.voices, nd: Object.keys(sent).filter((k) => /need/.test(k)) }) : 'none'} | word ${JSON.stringify(view.word)}${pass ? '' : ' | ok ' + JSON.stringify(ok)}`);
      await b.ctx.close();
    }
  } catch (e) {
    console.log('threw', e.stack || e);
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `${outName}.json`), JSON.stringify(res, null, 1));
  console.log(`done ${res.length} cells, ${res.filter((r) => r.pass).length} pass, secs ${(Date.now() - t0) / 1000}`);
})();
