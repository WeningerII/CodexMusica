// Probe: can a real clipboard paste (Ctrl+V) and real typing reach the draft; which controls are visible.
'use strict';
const L = require('./lib.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nI hold the dove\nRun to the sea\nLove above`;
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  try {
    const { ctx, page, q, errors } = await L.boot(browser, base);
    // starting text: typed in as a whole (no [SETUP] row, so no boundary has anything to do)
    await page.locator('[data-ui="lyrics-draft"], #lyrics-draft').first().click().catch(()=>{});
    const ids = await page.evaluate(() => ({ draftId: $ui('lyrics-draft').id, dataUi: $ui('lyrics-draft').getAttribute('data-ui') }));
    console.log('draft', ids);
    await page.evaluate((b) => { const d = $ui('lyrics-draft'); d.focus(); d.select(); }, BODY);
    await page.keyboard.insertText(BODY);
    await page.waitForTimeout(400);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.setSelectionRange(0, 0); });
    await page.evaluate((t) => navigator.clipboard.writeText(t), '[SETUP — rhyme groups — 1.T4,8; 2,3]\n\n');
    await page.keyboard.press('Control+V');
    await page.waitForTimeout(500);
    console.log('after paste', JSON.stringify(await page.evaluate(() => $ui('lyrics-draft').value.split('\n').slice(0, 3))));
    console.log('toasts', await L.toasts(page));
    const vis = await page.evaluate(() => [...document.querySelectorAll('[data-ui="ly-run-review"],[data-ui="ly-tool"],#chat-send,#btn-undo')].map((b) => [b.getAttribute('data-ui') || b.id, b.getAttribute('data-id'), b.offsetParent !== null, b.innerText.trim().slice(0, 30)]));
    console.log(JSON.stringify(vis));
    console.log('errors', errors);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
})().catch((e) => (console.error(e), process.exit(1)));
