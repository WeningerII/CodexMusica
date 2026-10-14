// Control: on every tree, is a page display-state change (lyricMeta.ui: the
// open tab / tool) an Undo step? Import a .txt with NO saved word numbers (no
// migration on any tree), then switch the tab and open a tool by real clicks,
// then Undo by a real click. Usage: node v7_control.js <cand|prev61b|main>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const V = path.join(S, 'h695/verify-f4-card-7');
const TREES = { cand: 'wt-695', prev61b: 'wt-61b', main: 'wt-main' };
const TREE = process.argv[2] || 'cand';
const ROOT = path.join(S, TREES[TREE]);
const BUILT = path.join(V, `build-${TREES[TREE]}`, `built-${TREES[TREE]}.html`);
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '/codex.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    return fs.createReadStream(BUILT).pipe(res);
  }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const SONG = ['[SETUP — title — "Plain Song"]', '', '[VERSE]', 'I walk the line tonight', 'And hold the light'].join('\n');
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const out = { tree: TREE };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
    await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
    await page.waitForTimeout(300);
    const pre = await page.evaluate(() => $ui('lyrics-draft').value);
    await page.setInputFiles('#ly-file', { name: 'plain.txt', mimeType: 'text/plain', buffer: Buffer.from(SONG) });
    await page.waitForFunction((b) => $ui('lyrics-draft').value !== b, pre);
    await page.waitForTimeout(500);
    const imported = await page.evaluate(() => $ui('lyrics-draft').value);
    const st = () => page.evaluate(() => ({ hist: [app.historyIndex, app.history.length], tab: LY.tab, tool: LY.tool, ui: { ...app.lyricMeta.ui } }));
    out.afterImport = { ...(await st()), importedIsSong: imported === SONG };
    await page.click('button[data-ui="ly-tab"][data-id="tools"]');
    await page.waitForTimeout(300);
    await page.locator('[data-ui="ly-tool"][data-id="rhymes"]').first().click();
    await page.waitForTimeout(500);
    await page.click('button[data-ui="ly-tab"][data-id="history"]');
    await page.waitForTimeout(500);
    out.afterDisplayChanges = await st();
    await page.click('#btn-undo');
    await page.waitForTimeout(700);
    out.afterUndo = { ...(await st()), draftIsPreImport: (await page.evaluate(() => $ui('lyrics-draft').value)) === pre };
  } catch (e) {
    out.error = String(e.stack || e);
  }
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(V, `v7_control_${TREE}.json`), JSON.stringify(out, null, 1));
  await browser.close();
  server.close();
})();
