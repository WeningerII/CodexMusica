'use strict';
const L = require('./vlib.js');
(async () => {
  const { server, base } = await L.startServer(L.TREES[process.argv[2] || 'cand']);
  const browser = await L.launch();
  const { ctx, page } = await L.boot(browser, base);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-ui="ly-tab"]')].map((b) => ({ html: b.outerHTML.slice(0, 200), vis: !!(b.offsetWidth || b.offsetHeight) })));
  console.log(JSON.stringify(tabs, null, 1));
  await ctx.close(); await browser.close(); server.close();
})();
