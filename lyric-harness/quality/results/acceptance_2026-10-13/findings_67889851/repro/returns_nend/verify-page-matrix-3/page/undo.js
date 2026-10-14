// After the candidate's load-time migration of a pre-batch returns row: can
// Undo, or anything in history/storage, give back the written `.end`?
'use strict';
const path = require('path');
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8');
// reuse page.js internals without running its main
const m = { exports: {} };
new Function('require', 'module', '__dirname', 'process', src.replace(/\n\(async \(\) => \{[\s\S]*$/, '\nmodule.exports = { server, state, TREES, context, ready, rowOf, writeDraft, SONG, chromium, toasts };'))(require, m, __dirname, process);
const X = m.exports;
(async () => {
  await new Promise((r) => X.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${X.server.address().port}`;
  const browser = await X.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  for (const value of ['4.end,7.end', '5.end,6.end;2.T2,3.T2']) {
    X.state.root = X.TREES.main;
    const { ctx } = await X.context(browser);
    const page = await ctx.newPage();
    await page.goto(`${base}/codex.html#lyrics`);
    await X.ready(page);
    await X.writeDraft(page, `[SETUP — returns — ${value}]\n\n${X.SONG}`);
    await page.reload();
    await X.ready(page);
    X.state.root = X.TREES.cand;
    await page.reload();
    await X.ready(page);
    const rec = { written: value };
    rec.after_upgrade = await X.rowOf(page, 'returns');
    rec.history_has_end = await page.evaluate(() => (app.history || []).some((h) => /\d\.end\b/.test(h)));
    rec.storage_has_end = await page.evaluate(() => Object.keys(localStorage).some((k) => /\d\.end\b/.test(localStorage.getItem(k) || '')));
    for (let i = 0; i < 3; i++) await page.evaluate(() => { $ui('btn-undo').click(); lyRefresh(true); });
    rec.after_3_undos = await X.rowOf(page, 'returns');
    await page.reload();
    await X.ready(page);
    rec.after_reopen = await X.rowOf(page, 'returns');
    out.push(rec);
    console.log(JSON.stringify(rec));
    await ctx.close();
  }
  await browser.close();
  X.server.close();
  fs.writeFileSync(path.join(__dirname, 'undo.json'), JSON.stringify(out, null, 1));
})();
