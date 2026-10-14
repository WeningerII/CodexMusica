// The same pre-batch rows reaching the candidate by other routes than a saved
// session: Import (.txt written by the baseline page), and a paste over the
// draft. Plus: a legacy silent row whose line is edited later; Keep on a
// carried member in a row that also holds a blocked member.
'use strict';
const X = require('./cand_lib.js');
const { L, C, U } = X;
const { expect } = require('./expect.js');
const IDS = ['G|v0|L1|N', 'G|v0|L2|endword', 'G|v0|L5|end', 'G|v0|L1|T4', 'G|v0|L1|T1', 'R|v0|L3|head', 'R|v0|L5|line', 'R|v0|L8|T4', 'R|v0|L2|T5', 'G|v1|L7|headrime', 'R|v1|L8|T6'];
(async () => {
  const main = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'main_cells.json'), 'utf8')).out;
  const server = L.serve({ root: L.WT_CAND });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  let pass = 0, n = 0;
  const R = (id, ok, obs) => { n++; if (ok) pass++; res.push({ id, ok, obs }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(obs).slice(0, 400)}`); };
  try {
    for (const id of IDS) {
      const m = main[id];
      const c = m.cell;
      const mainRow = m.text.split('\n').find((r) => r.startsWith(`[SETUP — ${c.key} —`));
      const exp = expect(c, mainRow);
      for (const route of ['import', 'paste']) {
        const b = await X.boot(browser, base);
        if (route === 'import') await X.importFile(b.page, 'old-song.txt', m.text);
        else await L.setDraft(b.page, m.text);
        const s = await X.snap(b.page);
        const row = s.rows.find((r) => r.startsWith(`[SETUP — ${c.key} —`));
        const nk = s.items.filter((i) => i.id.startsWith(c.key + ':')).map((i) => `${i.tone}:${/carried/.test(i.id) ? 'carried' : /undecided/.test(i.id) ? 'undecided' : 'other'}`);
        const rv = await X.runReview(b.page, b.q);
        const f = c.key === 'returns' ? 'returns' : 'groups';
        const okSend = exp.blocked ? rv.calls.length === 0 : rv.calls.length === 1 && rv.calls[0][f] === exp.sent[f];
        const okNotice = exp.notice ? nk.length === 1 && nk[0] === exp.notice : nk.length === 0;
        R(`${route}:${id}`, row === exp.row && okSend && okNotice, { row, expRow: exp.row, notices: nk, calls: rv.calls.length, sent: rv.calls[0] ? rv.calls[0][f] : null });
        // Undo after the import: back to the previous draft, never to unmigrated numbers.
        if (route === 'import' && id === 'G|v0|L1|T4') {
          await X.undo(b.page);
          const u = await X.snap(b.page);
          await X.redo(b.page);
          const r2 = await X.snap(b.page);
          R('import.undoRedo:G|v0|L1|T4', !u.rows.some((r) => /1\.T4,6\]$/.test(r)) && r2.rows.some((r) => r === exp.row), { afterUndo: u.rows, afterRedo: r2.rows });
        }
        await b.ctx.close();
      }
    }
    // Legacy silent row, line edited afterwards so its cut now differs.
    {
      const m = main['G|v0|L5|end'];
      const b = await X.boot(browser, base, { session: m.ls });
      const s0 = await X.snap(b.page);
      await L.setDraft(b.page, s0.text.replace('I walk the line tonight', 'I walk the line--line tonight'));
      const s1 = await X.snap(b.page);
      R('legacySilentThenEdited', true, { before: s0.rows, after: s1.rows, notices: s1.items.filter((i) => /carried/.test(i.id)).map((i) => i.title + ' | ' + i.text.slice(0, 140)) });
      await b.ctx.close();
    }
    // Keep on a carried member in a row that also holds a blocked member.
    {
      const ses = JSON.parse(main['G|v0|L1|N'].ls);
      ses.lyrics = ses.lyrics.replace('[SETUP — rhyme groups — 1,6]', '[SETUP — rhyme groups — 1,6;3.T2,5]');
      const b = await X.boot(browser, base, { session: JSON.stringify(ses) });
      const s0 = await X.snap(b.page);
      const it = X.carriedIds(s0)[0];
      await b.page.evaluate((id) => LY_ACTIONS['ly-carried-keep'](id), it.actions[0][2]);
      const s1 = await X.snap(b.page);
      const rv = await X.runReview(b.page, b.q);
      R('keepWithBlockedRowMate', s1.rows[0] === `[SETUP — rhyme groups — 1,6;3.T2 ${U},5 — cut v2]` && rv.calls.length === 0 && X.carriedIds(s1).length === 0, { before: s0.rows[0], after: s1.rows[0], calls: rv.calls.length, decl: s1.decl, refusal: rv.toasts.filter((t) => /Nothing/.test(t)) });
      await b.ctx.close();
    }
  } catch (e) {
    console.log('threw', e.stack || e);
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, 'paths.json'), JSON.stringify(res, null, 1));
  console.log(`done ${pass}/${n}`);
})();
