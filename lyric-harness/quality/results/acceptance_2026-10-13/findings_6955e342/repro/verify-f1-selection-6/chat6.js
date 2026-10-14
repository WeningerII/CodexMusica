// The typed-request boundary with real mouse clicks only: caret at "w|alk",
// mouse on "Write with AI" -> "Edit this draft", type a request, mouse on
// the dock's Send. Where is the song's selection afterwards?
// Usage: node chat6.js <tree>
'use strict';
const L = require('./lib6.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOC = `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`;
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const c = { tree: TREE };
  try {
    const { ctx, page, q, errors } = await L.boot(browser, base);
    await L.setDraft(page, DOC);
    await page.waitForTimeout(250);
    const at = DOC.indexOf('walk') + 1;
    await page.evaluate((at) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(at, at); }, at);
    await page.waitForTimeout(150);
    c.before = (await L.sel(page)).sel;
    const menuBtn = page.locator('[data-ui="ly-menu"][data-id="ai"]:visible').first();
    c.menuFound = await menuBtn.count();
    await menuBtn.click();
    await page.waitForTimeout(200);
    await page.locator('[data-ui="edit-lyrics"]:visible').first().click();
    await page.waitForTimeout(300);
    c.afterMenu = await L.sel(page);
    c.chatActive = c.afterMenu.active;
    await page.keyboard.type('Tighten line 2', { delay: 10 });
    const n = q.calls.length;
    await page.locator('#chat-send:visible').first().click();
    await L.idle(page);
    const post = await L.sel(page);
    c.reached = q.calls.length - n;
    c.sentReturns = q.calls.slice(n).map((x) => x.lyric_context?.declarations?.returns ?? null);
    c.rewritten = post.text !== DOC;
    c.after = post.sel;
    c.expectedWalk = post.text.indexOf('walk') + 1;
    c.row0 = post.text.split('\n')[0];
    c.errors = errors;
    await ctx.close();
  } catch (x) {
    c.threw = String(x.stack || x).slice(0, 600);
  } finally {
    await browser.close();
    server.close();
  }
  delete c.afterMenu?.text;
  console.log(JSON.stringify(c, null, 1));
  L.fs.writeFileSync(L.path.join(L.OUT, `chat6_${TREE}.json`), JSON.stringify(c, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
