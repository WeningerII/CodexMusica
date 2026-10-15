// BB8 order-marker helpers. Scratch only. Serves the page this folder BUILT
// for a tree (built-<tree>.html, checked byte-equal to the tree's committed
// codex.html in COMMANDS.txt) at /codex.html, every other path from the tree
// itself; stubs every mcp.codexmusica.com request in-page (no provider is
// reached) and records each POST /chat body.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h8ea/order-marker/p1');
const B = path.join(S, 'h8ea/order-marker/build');
const { chromium } = require(path.join(S, 'wt-8ea/node_modules/playwright'));
const TREES = {
  cand: { root: path.join(S, 'wt-8ea'), page: path.join(B, 'built-wt-8ea.html'), sha: '8ea94ac9' },
  c0af: { root: path.join(S, 'wt-0af'), page: path.join(B, 'built-wt-0af.html'), sha: '0af39c6f' },
  c695: { root: path.join(S, 'wt-695'), page: path.join(B, 'built-wt-695.html'), sha: '6955e342' },
  c61b: { root: path.join(S, 'wt-61b'), page: path.join(B, 'built-wt-61b.html'), sha: '61b6618a' },
  main: { root: path.join(S, 'wt-main'), page: path.join(B, 'built-wt-main.html'), sha: '8b1d2ad2' },
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
};
async function startServer(tree) {
  const { root, page } = TREES[tree];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return fs.createReadStream(page).pipe(res);
    }
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
async function launch() {
  return chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}
async function boot(browser, base) {
  const q = { calls: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      await new Promise((res) => setTimeout(res, 80));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__toastLog = [];
    const mo = new MutationObserver(() => {
      const t = document.getElementById('toast');
      if (!t) return;
      const txt = t.innerText;
      if (txt && window.__toastLog[window.__toastLog.length - 1] !== txt) window.__toastLog.push(txt);
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page, q, errors };
}
async function waitIdle(page) {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(200);
}
const toasts = (page) => page.evaluate(() => window.__toastLog.splice(0));
module.exports = { fs, path, S, OUT, TREES, startServer, launch, boot, waitIdle, toasts };
