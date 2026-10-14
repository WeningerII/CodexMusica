// Probe: does a Review-tab card action that rewrites the text above the caret
// exist on every tree (the "Set the header to N lines" fix)?
'use strict';
const L = require('./lib7.js');
const TREE = process.argv[2];
const DOC = `[VERSE — 12 lines]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  try {
    const { ctx, page } = await L.boot(browser, base);
    await L.setDraft(page, DOC);
    await page.waitForTimeout(300);
    await L.activate(page, 'tab', 'review', 'prog');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      checks: lyLocalChecks(LY.model).map((c) => ({ id: c.id, title: c.title, actions: c.actions })),
      buttons: [...document.querySelectorAll('[data-ui="ly-fix-count"]')].map((b) => ({ text: b.innerText, id: b.dataset.id, visible: !!(b.offsetWidth || b.offsetHeight) })),
    }));
    console.log(TREE, JSON.stringify(r, null, 1));
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => (console.error(e), process.exit(1)));
