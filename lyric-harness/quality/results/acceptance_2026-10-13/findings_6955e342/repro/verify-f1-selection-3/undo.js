// undo: after the destructive typing (chat Send click, keyboard return,
// ZQ typed over the mapped selection), does Ctrl+Z bring the row back?
'use strict';
const L = require('./lib.js');
const DOC = '[SETUP — returns — 1.T2, 2.end]\n\n[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
(async () => {
  const { server, base } = await L.serveTree('cand');
  const browser = await L.launch();
  try {
    const { ctx, page, calls } = await L.open(browser, base);
    await page.evaluate((t) => { const d = $ui('lyrics-draft'); d.value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, DOC);
    await page.waitForTimeout(300);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(19, 23); });
    await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
    await page.waitForTimeout(200);
    await page.keyboard.type('Tighten line 2', { delay: 5 });
    await page.locator('#chat-send').click();
    await page.waitForTimeout(600);
    let k = 0;
    while (k < 60 && (await page.evaluate(() => document.activeElement !== $ui('lyrics-draft')))) { await page.keyboard.press('Shift+Tab'); k++; }
    const s0 = await L.state(page);
    console.log('returned after', k, 'Shift+Tab:', JSON.stringify(s0.sel), L.show(s0.text, s0.sel[0], s0.sel[1]));
    await page.keyboard.type('ZQ', { delay: 20 });
    await page.waitForTimeout(300);
    const s1 = await L.state(page);
    console.log('typed:', s1.text.split('\n')[0]);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const s2 = await L.state(page);
    console.log('after Ctrl+Z:', s2.text.split('\n')[0], JSON.stringify(s2.sel));
    await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
    const s3 = await L.state(page); console.log('after 2nd Ctrl+Z:', s3.text.split('\n')[0], JSON.stringify(s3.sel));
    await ctx.close();
  } finally { await browser.close(); server.close(); }
})().catch((e) => (console.error(e), process.exit(1)));
