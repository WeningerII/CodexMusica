// Item 3 (note): phone Song/Review round trip -- is a backward selection's direction kept?
// usage: node item3_phone_dir.js <repoRoot>
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2]);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/codex.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/json' });
  fs.createReadStream(f).pipe(res);
});
const exe = (() => { const b = process.env.PLAYWRIGHT_BROWSERS_PATH; for (const d of fs.readdirSync(b)) if (/^chromium-\d+$/.test(d)) return path.join(b, d, 'chrome-linux', 'chrome'); })();
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox'] });
  for (const [name, text] of [['migrating', '[SETUP — rhyme groups — 1.T2,2.end]'], ['already marked', '[SETUP — rhyme groups — 1.T3,2.end — cut v2]']]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
      if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') { await new Promise((res) => setTimeout(res, 150)); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Fixture review only', history: [], sig: 'fixture' }) }); }
      return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
    });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, { timeout: 60000 });
    await page.evaluate((t) => { const d = $ui('lyrics-draft'); d.value = t + '\n[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight'; uiSaveLyrics(); pushHistory(); lyRefresh(true); d.focus(); const at = d.value.indexOf('sing it'); d.setSelectionRange(at, at + 7, 'backward'); }, text);
    await page.locator('#ly-mtab-review').click();
    await page.locator('[data-ui="ly-run-review"]:visible').first().click();
    await page.waitForFunction(() => !chatState.busy && chatState.sig === 'fixture', null, { timeout: 20000 });
    await page.locator('#ly-mtab-song').click();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const got = await page.evaluate(() => { const d = $ui('lyrics-draft'); return { sel: d.value.slice(d.selectionStart, d.selectionEnd), dir: d.selectionDirection }; });
    console.log(JSON.stringify({ case: name, before: { sel: 'sing it', dir: 'backward' }, after: got }));
    await ctx.close();
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
