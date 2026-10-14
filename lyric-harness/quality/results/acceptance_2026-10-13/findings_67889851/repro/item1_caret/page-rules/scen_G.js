// Scenario G: Export session (.json) — a session exported by the BASELINE page
// imported into the candidate, and a candidate session (carried + blocked)
// exported and imported again in a fresh browser.
'use strict';
const X = require('./cand_lib.js');
const { L, C, U } = X;
const snaps = {};

async function exportSession(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.evaluate(() => LY_ACTIONS['ly-export-session']())]);
  return { name: dl.suggestedFilename(), body: L.fs.readFileSync(await dl.path(), 'utf8') };
}
async function importSession(page, f) {
  await page.setInputFiles('#ui-file', { name: f.name, mimeType: 'application/json', buffer: Buffer.from(f.body, 'utf8') });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    if (UI.view !== 'lyrics') uiNavigate('lyrics');
  });
  await page.waitForTimeout(500);
}

(async () => {
  const sessions = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'baseline_sessions.json'), 'utf8')).out;
  const state = { root: L.WT_MAIN };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const R = (id, claim, exp, obs, ok) => L.record('G.' + id, claim, exp, obs, ok);
  try {
    // 1. The baseline page exports a session holding A + B rows (mixed).
    const mixed = sessions.A.text.replace('[SETUP — rhyme groups — 1.T4,8;3,5;2,6;4,7]', '[SETUP — rhyme groups — 1.T4,8;3,5;2,6;4,7;1.T1,6]');
    const a = await X.boot(browser, base);
    await L.setDraft(a.page, mixed);
    const baseFile = await exportSession(a.page);
    L.fs.writeFileSync(L.path.join(L.OUT, 'G_baseline_session.json'), baseFile.body);
    await a.ctx.close();
    errors.push(...a.errors);
    // 2. Imported into the candidate.
    state.root = L.WT_CAND;
    const b = await X.boot(browser, base);
    await importSession(b.page, baseFile);
    let s = (snaps.importBaseline = await X.snap(b.page));
    const EG = `[SETUP — rhyme groups — 1.T5,8;3 ${C},5;2 ${C},6;4 ${C},7;1.T1 ${U},6 — cut v2]`;
    R('baselineSession.rows', 'a session exported by the baseline page, imported with Import session, is migrated (rebind / carry / block)', EG, s.rows[0], s.rows[0] === EG);
    const send = await X.runReview(b.page, b.q);
    R('baselineSession.blocked', 'the imported session is blocked by its unrebindable member; nothing sent', '0 calls', JSON.stringify({ calls: send.calls.length, toasts: send.toasts }), send.calls.length === 0);
    // 3. Candidate export -> fresh browser import.
    const candFile = await exportSession(b.page);
    await b.ctx.close();
    errors.push(...b.errors);
    const c = await X.boot(browser, base);
    await importSession(c.page, candFile);
    const s2 = (snaps.reimport = await X.snap(c.page));
    R('candSession.roundtrip', 'Export session then Import session keeps the marks, carried and blocked states', JSON.stringify(s.rows), JSON.stringify(s2.rows), JSON.stringify(s2.rows) === JSON.stringify(s.rows) && X.carriedIds(s2).length === X.carriedIds(s).length);
    await c.ctx.close();
    errors.push(...c.errors);
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  R('pageErrors', 'no uncaught page errors', '[]', JSON.stringify(errors), errors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'scen_G.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
