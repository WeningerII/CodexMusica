// Item 3/5: real Chromium, touch emulation. Does tapping Run review move focus into the
// lyrics textarea (which on a touch device raises the on-screen keyboard)?
// usage: node item3_touch.js <repoRoot> <variant: b887|nohandler>
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2]);
const VARIANT = process.argv[3] || 'b887';
const HANDLER = `surface.addEventListener("mousedown",e=>{if(e.button===0&&e.target.closest('[data-ui="ly-run-review"]')){e.preventDefault();if(document.activeElement===draft)pushHistory();else{const selection=[draft.selectionStart,draft.selectionEnd,draft.selectionDirection];draft.focus({preventScroll:true});draft.setSelectionRange(...selection)}}});`;
let html = fs.readFileSync(path.join(ROOT, 'codex.html'), 'utf8');
if (VARIANT === 'nohandler') { if (!html.includes(HANDLER)) throw new Error('handler not found'); html = html.replace(HANDLER, ''); }
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '/codex.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(html); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const exe = (() => { const b = process.env.PLAYWRIGHT_BROWSERS_PATH; for (const d of fs.readdirSync(b)) if (/^chromium-\d+$/.test(d)) return path.join(b, d, 'chrome-linux', 'chrome'); })();
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox'] });
  for (const vp of [{ name: 'tablet 1024x1366 touch', width: 1024, height: 1366 }, { name: 'phone 390x844 touch', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });
    await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
      if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
        await new Promise((res) => setTimeout(res, 150));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Fixture review only', history: [], sig: 'fixture' }) });
      }
      return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
    });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, { timeout: 60000 });
    await page.evaluate(() => { $ui('lyrics-draft').value = '[SETUP — rhyme groups — 1.T3,2.end — cut v2]\n[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight'; uiSaveLyrics(); pushHistory(); lyRefresh(true); });
    if (vp.width < 600) await page.locator('#ly-mtab-review').tap();
    const visible = await page.locator('[data-ui="ly-run-review"]:visible').count();
    const before = await page.evaluate(() => ({ active: document.activeElement && (document.activeElement.id || document.activeElement.tagName), draftVisible: !!$ui('lyrics-draft').offsetParent }));
    if (!visible) { console.log(JSON.stringify({ variant: VARIANT, vp: vp.name, note: 'no visible Run review', before })); await ctx.close(); continue; }
    await page.locator('[data-ui="ly-run-review"]:visible').first().tap();
    await page.waitForFunction(() => !chatState.busy && chatState.sig === 'fixture', null, { timeout: 20000 });
    const after = await page.evaluate(() => ({ active: document.activeElement && (document.activeElement.id || document.activeElement.tagName), draftVisible: !!$ui('lyrics-draft').offsetParent }));
    console.log(JSON.stringify({ variant: VARIANT, vp: vp.name, before, after }));
    await ctx.close();
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
