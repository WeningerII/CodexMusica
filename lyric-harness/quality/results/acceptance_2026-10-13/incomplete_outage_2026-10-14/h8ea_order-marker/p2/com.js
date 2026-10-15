// check-order-marker helpers (BB8). Independent re-run of the order-marker probe.
// Serves a tree's static files, but /codex.html is the page THIS folder built
// from that tree (CODEX_LIBRARY=1 build, COMMANDS.txt; cmp-equal to the tree's
// committed codex.html). Every mcp.codexmusica.com request is stubbed in-page;
// /chat POST bodies are captured. No provider is reached.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h8ea/order-marker/p2');
const B = path.join(S, 'h8ea/order-marker/build');
const { chromium } = require(path.join(S, 'wt-8ea/node_modules/playwright'));
const TREES = {
  cand: { root: path.join(S, 'wt-8ea'), page: path.join(B, 'built-wt-8ea.html') },
  c0af: { root: path.join(S, 'wt-0af'), page: path.join(B, 'built-wt-0af.html') },
  c695: { root: path.join(S, 'wt-695'), page: path.join(B, 'built-wt-695.html') },
  c61b: { root: path.join(S, 'wt-61b'), page: path.join(B, 'built-wt-61b.html') },
  main: { root: path.join(S, 'wt-main'), page: path.join(B, 'built-wt-main.html') },
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2', '.webp': 'image/webp' };
async function startServer(tree) {
  const { root, page } = TREES[tree];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = p === '/' || p === '/codex.html' ? page : path.join(root, p);
    if (!f.startsWith(root) && f !== page) return res.writeHead(404), res.end();
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404), res.end('nf');
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
    const req = r.request();
    if (/\/chat$/.test(req.url()) && req.method() === 'POST') {
      q.calls.push(JSON.parse(req.postData() || '{}'));
      await new Promise((res) => setTimeout(res, 60));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        const t = document.getElementById('toast');
        const x = t && t.innerText && t.innerText.trim();
        if (x && window.__toasts[window.__toasts.length - 1] !== x) window.__toasts.push(x);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page, q, errors };
}
const draftText = (page) => page.evaluate(() => $ui('lyrics-draft').value);
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
const hist = (page) => page.evaluate(() => ({ idx: app.historyIndex, n: app.history.length, lyrics: app.history.map((h) => JSON.parse(h).lyrics) }));
async function idle(page) {
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(200);
}
// Body entered whole by the writer: real fill() (one input event), then the refresh.
async function enterBody(page, body) {
  const ta = page.locator('#lyrics-draft').first();
  await ta.click();
  await ta.fill(body);
  await page.waitForTimeout(400);
}
// Real caret at offset 0, then real Ctrl+V of `s` (system clipboard), or real typing.
async function insertAtTop(page, s, how) {
  await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
  if (how === 'paste') {
    await page.evaluate((t) => navigator.clipboard.writeText(t), s);
    await page.keyboard.press('Control+V');
  } else {
    await page.keyboard.type(s, { delay: 5 });
  }
  await page.waitForTimeout(500);
}
async function openTool(page, id) {
  await page.locator('[data-ui="ly-tab"][data-id="tools"]').click();
  await page.waitForTimeout(150);
  const btn = page.locator(`[data-ui="ly-tool"][data-id="${id}"]`).first();
  if (await btn.count()) await btn.click();
  else await page.evaluate((i) => lyToolOpen(i), id); // fallback recorded by caller
  await page.waitForTimeout(250);
}
// Caret onto sung line n (real click is not needed: the caret drives activeLine on selectionchange/keyup).
async function caretToLine(page, n) {
  await page.evaluate((n) => {
    const d = $ui('lyrics-draft');
    const m = lyParse(d.value);
    const row = m.sung[n - 1];
    const rows = d.value.split('\n');
    let off = 0;
    for (let i = 0; i < row.i; i++) off += rows[i].length + 1;
    d.focus();
    d.setSelectionRange(off + 1, off + 1);
  }, n);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
}
module.exports = { fs, path, S, OUT, TREES, startServer, launch, boot, draftText, toasts, hist, idle, enterBody, insertAtTop, openTool, caretToLine };
