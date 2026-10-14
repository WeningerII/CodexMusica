// verify-f4-card-1: after ONE .txt import that renumbers 200 numbers, can the
// writer get back the numbers the card no longer lists from inside the app?
// Looks at Undo/Redo and at every recorded history step for the imported,
// unmarked rows. Usage: node v3_undo.js <tree>
'use strict';
const L = require('./vlib');
const TREE = process.argv[2] || 'cand';
(async () => {
  const errs = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE };
  try {
    const text = L.fs.readFileSync(L.path.join(L.OUT, 'gen_mixed_200.txt'), 'utf8');
    const firstUnmarked = text.split('\n').find((r) => r.startsWith('[SETUP — reading'));
    const ctx = await L.ctxOf(browser);
    const page = await L.openPage(ctx, url, errs);
    const pre = await L.draft(page);
    await L.importFile(page, 'verify-200.txt', 'text/plain', text);
    const migrated = await L.draft(page);
    out.importChangedRows = migrated.split('\n').filter((r, i) => r !== text.split('\n')[i]).length;
    out.historyHoldsUnmarked = await page.evaluate((row) => app.history.map((h) => JSON.parse(h).lyrics.includes(row)), firstUnmarked);
    out.historyLen = await page.evaluate(() => app.history.length);
    await page.evaluate(() => undo());
    await page.waitForTimeout(400);
    const u = await L.draft(page);
    out.undo = { equalsPreImport: u === pre, equalsImportedText: u === text, hasUnmarkedRow: u.includes(firstUnmarked) };
    await page.evaluate(() => redo());
    await page.waitForTimeout(400);
    const r = await L.draft(page);
    out.redo = { equalsMigrated: r === migrated, hasUnmarkedRow: r.includes(firstUnmarked) };
    out.historyPaneMentionsUnmarked = await page.evaluate((row) => {
      LY_ACTIONS['ly-tab']('history');
      const p = $ui('ly-panel-history');
      return p ? p.innerText.includes(row.slice(0, 60)) : null;
    }, firstUnmarked);
    out.cardAfterUndoRedo = await L.cardOf(page).then((c) => c.item && c.item.title);
    console.log(JSON.stringify(out, null, 1));
    await ctx.close();
  } catch (e) {
    out.error = String(e && e.stack);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errs;
    L.fs.writeFileSync(L.path.join(L.OUT, `v3_undo_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
