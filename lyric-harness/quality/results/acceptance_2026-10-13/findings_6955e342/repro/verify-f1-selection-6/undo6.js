// Context only (not the claim): does the same Chromium behaviour already hit
// a click-driven write of the editor on main? Two recorded steps A -> B, the
// caret in B's sung text, then a mouse click on the page's visible Undo
// control, versus Ctrl+Z-free keyboard activation of the same control.
// Usage: node undo6.js <tree>
'use strict';
const L = require('./lib6.js');
const TREE = process.argv[2] || 'main';
const A = `[VERSE]\nI walk the line tonight\nLove above`;
const B = `[VERSE]\nI walk the line tonight\nLove above and below`;
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = [];
  try {
    for (const how of ['click', 'kbd']) {
      const { ctx, page, errors } = await L.boot(browser, base);
      const c = { tree: TREE, how };
      try {
        await L.setDraft(page, A);
        await L.setDraft(page, B);
        await page.waitForTimeout(250);
        const at = B.indexOf('walk') + 1;
        await page.evaluate((at) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(at, at); }, at);
        await page.waitForTimeout(150);
        c.before = (await L.sel(page)).sel;
        c.undoControls = await page.evaluate(() => [...document.querySelectorAll('[data-ui="ly-undo"],#btn-undo,#ui-undo,[data-ui="undo"]')].filter((b) => b.offsetWidth).map((b) => b.dataset.ui || b.id));
        const loc = page.locator('[data-ui="ly-undo"]:visible, #btn-undo:visible, #ui-undo:visible, [data-ui="undo"]:visible').first();
        if (how === 'click') await loc.click();
        else { await loc.focus(); await page.keyboard.press('Enter'); }
        await page.waitForTimeout(600);
        const post = await L.sel(page);
        c.undone = post.text === A;
        c.after = post.sel;
        c.afterChars = post.text.slice(Math.max(0, post.sel[0] - 3), post.sel[0]) + '|' + post.text.slice(post.sel[0], post.sel[0] + 3);
        c.errors = errors;
      } catch (x) {
        c.threw = String(x.stack || x).slice(0, 400);
      }
      out.push(c);
      console.log(JSON.stringify(c));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `undo6_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
