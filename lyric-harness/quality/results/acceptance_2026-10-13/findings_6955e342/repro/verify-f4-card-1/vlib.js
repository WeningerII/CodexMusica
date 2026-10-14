// verify-f4-card-1 helpers (independent of h695/f4-card/lib.js; same
// mechanisms: serve a tree root over HTTP, stub mcp.codexmusica.com, drive
// the Lyrics page's own #ly-file input). Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-1');
const TREES = {
  cand: path.join(S, 'wt-695'),
  prev: path.join(S, 'wt-61b'),
  main: path.join(S, 'wt-main'),
  base: path.join(S, 'wt-base'),
};
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };
async function start(tree) {
  const root = TREES[tree];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  return { server, url, browser };
}
async function ctxOf(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  await ctx.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        const t = document.getElementById('toast');
        const s = t && t.innerText;
        if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
  });
  return ctx;
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
}
async function openPage(ctx, url, errs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(500);
  return page;
}
const draft = (page) => page.evaluate(() => $ui('lyrics-draft').value);
async function importFile(page, name, mimeType, text, done) {
  const before = await draft(page);
  await page.setInputFiles('#ly-file', { name, mimeType, buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(done || ((b) => $ui('lyrics-draft').value !== b), before, { timeout: 30000 });
  await page.waitForTimeout(700);
}
// What the page itself would show: its renumbered Review item, the rendered
// Review pane, and the stored display state.
const cardOf = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    const it = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    LY_ACTIONS['ly-tab']('review');
    const pane = $ui('ly-panel-review') ? $ui('ly-panel-review').innerText : '';
    const ui = (app.lyricMeta && app.lyricMeta.ui) || {};
    return {
      item: it && { title: it.title, text: it.text },
      pane,
      renumbered: ui.renumbered ? JSON.parse(JSON.stringify(ui.renumbered)) : null,
      uiJsonLen: JSON.stringify(ui).length,
    };
  });
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
module.exports = { fs, path, S, OUT, TREES, start, ctxOf, openPage, ready, draft, importFile, cardOf, toasts };
