// Screenshot of the Library source card after M (main-made working copy) is
// imported, unedited, into a tree.  Usage: node v11c.js <tree>
'use strict';
const L = require('./vlib');
const TREE = process.argv[2];
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  try {
    const M = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'B_M_main_download.json'), 'utf8'));
    const ctx = await L.newCtx(browser);
    const page = await L.open(ctx, url, errors);
    await L.importFile(page, L.path.join(L.OUT, 'B_M_main_download.json'), M.draftId);
    await page.waitForTimeout(4500); // let the toast clear
    const el = await page.$('[aria-label="Library source"]');
    const vis = el ? await el.isVisible() : false;
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: L.path.join(L.OUT, `C_${TREE}_source_card.png`) });
    }
    const s = await L.state(page);
    console.log(JSON.stringify({ tree: TREE, visible: vis, label: s.label, adapted: s.adapted, pageErrors: errors }));
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
})();
