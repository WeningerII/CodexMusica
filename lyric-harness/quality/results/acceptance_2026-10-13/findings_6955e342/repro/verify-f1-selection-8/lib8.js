// verify-f1-selection-8: shared helpers (scratch only, written from scratch).
// Serves a pinned tree's committed codex.html (each checked byte-equal to a
// CODEX_LIBRARY=1 build, COMMANDS.txt), stubs every mcp.codexmusica.com
// request locally (no provider is reached), drives Chromium headless.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f1-selection-8');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = {
  cand: path.join(S, 'wt-695'),
  c61b: path.join(S, 'wt-61b'),
  c678: path.join(S, 'wt-678'),
  main: path.join(S, 'wt-main'),
  base: path.join(S, 'wt-base'),
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
async function startServer(root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const launch = () => chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function boot(browser, base) {
  const q = { calls: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      await new Promise((res) => setTimeout(res, 60));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__toasts = [];
    const mo = new MutationObserver(() => {
      const t = document.getElementById('toast');
      const txt = t && t.innerText;
      if (txt && window.__toasts[window.__toasts.length - 1] !== txt) window.__toasts.push(txt);
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await ready(page);
  return { ctx, page, q, errors };
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(400);
}
async function idle(page) {
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(200);
}
const setupRows = (page) => page.evaluate(() => $ui('lyrics-draft').value.split('\n').filter((r) => /^\[SETUP/.test(r)));
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
module.exports = { fs, path, S, OUT, TREES, startServer, launch, boot, ready, idle, setupRows, toasts };
